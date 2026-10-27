import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5278';
const section=Number(process.argv.find(a=>a.startsWith('--section='))?.split('=')[1]??-1);
const to=Number(process.argv.find(a=>a.startsWith('--to='))?.split('=')[1]??(section<0?11:section));
const native=process.argv.includes('--native'),full=native||process.argv.includes('--full');
const trial=process.argv.includes('--trial');
const output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-browser';await mkdir(output,{recursive:true});
const tag=`${native?'native':full?'full':'lite'}${trial?'-trial':''}-${section}-${to}`;
const fixture=await build({entryPoints:['tools/ancient-gates-browser-runtime.mjs'],bundle:true,format:'iife',globalName:'ancientReview',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:native?{width:2560,height:1440}:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=jungle-gate-run${full?'':'&lite'}`,{timeout:240000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-gate-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:240000});
 if(trial)await page.evaluate(()=>{
  // Time trials unlock only after a normal clear. Seed that pre-run save
  // prerequisite; the pilot still reaches and collects the actual clock.
  const g=window.__game,id='jungle-gate-run',before={...g.campaign.levelProgress(id)};
  g.campaign.commitClear(id,{crystal:true,boxGem:true,comboGem:false});
  if(!g.campaign.runModesUnlocked(id))throw Error('Completed-save trial fixture did not unlock the clock');
  if(!g.switchLevel(id))throw Error('Trial fixture level reload failed');
  window.ancientTrialFixture={kind:'pre-run completed campaign save',before,after:{...g.campaign.levelProgress(id)}};
 });
 await page.addScriptTag({content:fixture.outputFiles[0].text});
 if(native)await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
 if(section>0)await page.evaluate(section=>{
  const g=window.__game;for(let i=0;i<section;i++)g.player.warpCheckpoint(g.getLevel(),1);
 },section);
 await page.screenshot({path:`${output}/${tag}-start.png`});
 await page.evaluate(({section,to,trial})=>{
  const r=window.ancientReview.installAncientPilot('main',{from:Math.max(0,section),to,trial});
  r.stamp=document.querySelector('.hud-build')?.textContent;
  if(trial)r.trialUnlockSetup=window.ancientTrialFixture;
 },{section,to,trial});
 const shots=new Set();let prior='';
 for(let i=0;i<3600;i++){
  await page.waitForTimeout(250);const s=await page.evaluate(()=>({done:window.ancientPilotReport.done,stage:window.ancientPilotReport.stage,section:window.ancientPilotReport.section,frame:window.ancientPilotReport.frame}));
  if(s.stage!==prior){console.log(s.frame,s.stage);prior=s.stage;}
  if(s.section!==undefined&&!shots.has(s.section)){shots.add(s.section);await page.screenshot({path:`${output}/${tag}-gate-${s.section+1}.png`});}
  if(s.done)break;
 }
 const report=await page.evaluate(()=>window.ancientPilotReport);
 const display=await page.evaluate(()=>({buffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height],resolution:window.__game.renderQualitySettings.regularResolution,crt:window.__game.crtGuestSettings.enabled}));
 await page.screenshot({path:`${output}/${tag}-end.png`});await writeFile(`${output}/${tag}.json`,JSON.stringify({report,errors,display},null,2));
 console.log(JSON.stringify({result:report.result,failure:report.failure,errors,display}));
 assert.equal(report.done,true);assert.equal(report.failure,null);assert.equal(report.sourceMatches,true);assert.equal(report.result.deaths,0);assert.equal(report.maskHits,0);assert.deepEqual(errors,[]);
 if(native)assert.deepEqual(display.buffer,[2560,1440]);
 if(trial)assert.ok(report.result.trialTime<=report.result.medalTimes.bronze,'Reference route must earn an authored medal');
}finally{await browser.close();}
