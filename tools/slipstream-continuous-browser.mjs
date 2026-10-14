import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5193').replace(/\/$/,'');
const output='/private/tmp/slipstream-continuous-browser';await mkdir(output,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/slipstream'; export * as reservoir from './src/levels/slipstream-2'; export { createContinuousPilot } from './tools/slipstream-continuous-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
const page=await context.newPage();const errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/continuous-validation-fixture.js',route=>route.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try {
 for(const lite of process.argv.includes('--full')?[false]:[true]) {
  await page.goto(`${base}/?playtest&level=slip${lite?'&lite':''}`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='slip'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-spawn.png`});
  await page.evaluate(async highRoute=>{
   const fixture=await import('/continuous-validation-fixture.js');
   const g=window.__game,p=g.player,l=g.getLevel();
   const pilot=fixture.createContinuousPilot(fixture.source,fixture.reservoir,{highRoute});
   const report=window.continuousReview={frame:0,phase:pilot.phase,done:false,error:null,evidence:pilot.evidence,
    stamp:document.querySelector('.hud-build')?.textContent,initialTuning:JSON.stringify(g.TUNING),checkpointCount:l.checkpoints.length};
   let sample={},advanced=false;
   const update=g.input.update.bind(g.input),step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
   g.input.pollGamepad=()=>{
    const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;
    const held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld,7:!!sample.transferHeld};
    return {id:'Continuous Slipstream validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};
   };
   p.step=(dt,input,level)=>{
    if(report.done)return;
    try {sample=pilot.sample(p,l);update();step(dt,input,level);advanced=true;} catch(e){report.error=String(e);report.done=true;}
   };
   p.commitRenderStep=(...args)=>{
    commit(...args);if(!advanced||report.done)return;advanced=false;
    try {pilot.observe(p,l);}catch(e){report.error=String(e);report.done=true;}
    report.frame++;report.phase=pilot.phase;report.position=p.pos.toArray();report.state=p.state;
    report.deaths=p.totalDeaths;report.grounded=p.grounded;report.speed=p.speed;
    if(p.state==='finished')report.done=true;
    if(report.done)report.finalTuning=JSON.stringify(g.TUNING);
   };
  },process.argv.includes('--high-route'));
  const shots=new Set();
  for(let i=0;i<2200;i++) {
   await page.waitForTimeout(250);
   const state=await page.evaluate(()=>{const {evidence,initialTuning,finalTuning,...s}=window.continuousReview;return s;});
   if(!shots.has(state.phase)) {shots.add(state.phase);console.log(JSON.stringify(state));await page.screenshot({path:`${output}/${lite?'lite':'full'}-${state.phase.replaceAll(' ','-')}.png`});}
   if(state.done)break;
  }
  const report=await page.evaluate(()=>window.continuousReview);reports.push(report);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-end.png`});
  console.log(JSON.stringify({...report,evidence:{...report.evidence,footLandings:report.evidence.footLandings.length},initialTuning:undefined,finalTuning:undefined}));
  assert.equal(report.error,null);assert.equal(report.state,'finished');assert.equal(report.deaths,0);
  assert.equal(report.initialTuning,report.finalTuning);assert.equal(report.evidence.checkpoints.length,report.checkpointCount);
  assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 }
} finally {await writeFile(`${output}/${process.argv.includes('--full')?'full':'lite'}-report.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
