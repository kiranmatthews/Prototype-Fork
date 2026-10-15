import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5244').replace(/\/$/,'');
const full=process.argv.includes('--full'),railRun=process.argv.includes('--rails'),tag=(full?'full':'lite')+(railRun?'-rails':'');
const out=process.env.COUNTRY_CLUB_OUTPUT||`${tmpdir()}/country-club-browser`;await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/country-club'; export {createCountryClubPilot} from './tools/country-club-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
if(process.argv.includes('--stale-stock')){
 const old=JSON.parse(execFileSync('git',['show','4e8c41fd:public/levels.json'],{maxBuffer:32*1024*1024})).levels.find(e=>e.id==='country-club');
 await page.addInitScript(entry=>localStorage.setItem('solProtoUserLevels',JSON.stringify([entry])),old);
}
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/country-club-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
  await page.goto(`${base}/?playtest&level=country-club${full?'':'&lite'}`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.waitForTimeout(600);
  await page.screenshot({path:`${out}/${tag}-spawn.png`});
  await page.evaluate(async(railRun)=>{
    const {source,createCountryClubPilot}=await import('/country-club-fixture.js');
    const g=window.__game,p=g.player,l=g.getLevel(),pilot=createCountryClubPilot(source,{waterRails:railRun});
    const report=window.countryClubReview={done:false,error:null,frame:0,phase:pilot.phase,evidence:pilot.evidence,
      stamp:document.querySelector('.hud-build')?.textContent,initialTuning:JSON.stringify(g.TUNING),race:g.getSkateRace()?.active??false,expectedCheckpoints:source.COUNTRY_CLUB_CHECKPOINTS.length,expectedJumps:railRun?0:source.COUNTRY_CLUB_GAPS.length,
      components:g.getCurrentLevel().data.components.length,expectedComponents:source.COUNTRY_CLUB_LEVEL.components.length};
    if(report.components!==report.expectedComponents)throw Error("Loaded stale course geometry");
    let sample={},advanced=false;
    const update=g.input.update.bind(g.input),step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
    g.input.pollGamepad=()=>{
      const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;
      const held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};
      return {id:'Country Club validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};
    };
    p.step=(dt,input,level)=>{
      if(report.done)return;
      try{sample=pilot.sample(p,l);update();step(dt,input,level);advanced=true;}catch(e){report.error=String(e);report.done=true;}
    };
    p.commitRenderStep=(...args)=>{
      commit(...args);if(!advanced||report.done)return;advanced=false;
      try{pilot.observe(p,l);}catch(e){report.error=String(e);report.done=true;}
      report.frame++;report.phase=pilot.phase;report.progress=pilot.progress;
      const stations=[45,202,388,530,705,910,1080,1238,1403,1580,1755,1920,2090,2295,2450,2600,2800,2940];
      const hole=stations.findLastIndex(s=>pilot.progress>=s);report.shot=hole>=0?source.COUNTRY_CLUB_SECTIONS[hole].name:null;report.position=p.pos.toArray();report.state=p.state;report.deaths=p.totalDeaths;report.grounded=p.grounded;
      if(p.state==='finished')report.done=true;
      if(report.done)report.finalTuning=JSON.stringify(g.TUNING);
    };
  },railRun);
  const shots=new Set();
  for(let i=0;i<1200;i++){
    await page.waitForTimeout(250);
    const r=await page.evaluate(()=>({done:window.countryClubReview.done,phase:window.countryClubReview.shot,frame:window.countryClubReview.frame}));
    if(r.phase&&!shots.has(r.phase)){shots.add(r.phase);await page.screenshot({path:`${out}/${tag}-${r.phase.replaceAll(' ','-')}.png`});console.log(JSON.stringify(r));}
    if(r.done)break;
  }
  const report=await page.evaluate(()=>window.countryClubReview);
  await page.screenshot({path:`${out}/${tag}-finish.png`});
  await writeFile(`${out}/${tag}.json`,JSON.stringify({base,report,errors},null,2));
  console.log(JSON.stringify({...report,initialTuning:undefined,finalTuning:undefined,errors},null,2));
  assert.equal(report.error,null);assert.equal(report.state,'finished');assert.equal(report.deaths,0);
  assert.deepEqual(report.evidence.checkpoints,Array.from({length:report.expectedCheckpoints},(_,i)=>i));assert.equal(report.evidence.jumps.length,report.expectedJumps);
  assert.equal(report.initialTuning,report.finalTuning);assert.equal(report.race,false);
  assert.equal(report.components,report.expectedComponents);
  assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
}finally{await browser.close();}
