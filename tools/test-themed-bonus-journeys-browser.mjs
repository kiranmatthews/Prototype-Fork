// Continuous normal-loop playthroughs with the same device-sample pilots as
// the headless checks. No warps or live physics/collectible-state edits.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5343/';
const source=process.env.BONUS_PILOT_SOURCE||base;
const output=process.env.BONUS_JOURNEY_OUTPUT||join(tmpdir(),'bonus-journeys-full');
const selected=process.env.BONUS_JOURNEY_LEVELS?.split(',');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 let errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('?playtest&level=bonus-treehouse-trail',base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const ids=await page.evaluate(async source=>{const {THEMED_BONUS_COURSES}=await import(new URL('src/levels/themed-bonuses.ts',source).href);return THEMED_BONUS_COURSES.map(c=>c.id);},source);
 for(const id of ids.filter(id=>!selected||selected.includes(id))){
  errors=[];await page.goto(new URL(`?playtest&level=${id}`,base).href);
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:120000});
  await page.evaluate(async({id,source})=>{
   const g=window.__game,p=g.player,l=g.getLevel();
   const {THEMED_BONUS_COURSES}=await import(new URL('src/levels/themed-bonuses.ts',source).href);
   const {runThemedBonusJourney}=await import(new URL('tools/themed-bonus-pilot.mjs',source).href);
   const course=THEMED_BONUS_COURSES.find(c=>c.id===id);p.respawn(l,true);
   const report=window.bonusJourney={id,stage:'start',frame:0,done:false,failed:null,actions:[],evidence:[],trace:[],tuning:JSON.stringify(g.TUNING),raf:[]};
   const ctx={id,p,l,course,source:course.data,report,trace:report.trace,get frame(){return report.frame;}};
   const generator=runThemedBonusJourney(ctx);let next=generator.next(),last={},advanced=false;
   const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
   const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,lives:p.lives,crates:p.cratesBroken,gem:p.gemEarned});
   p.step=(dt,input,level)=>{
    if(report.done)return step(dt,input,level);
    const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
    const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
    input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
    for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
     input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);
    }
    input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;
    last={...sample};step(dt,input,level);advanced=true;
   };
   p.commitRenderStep=(...args)=>{
    commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
    if(report.frame%12===0)report.trace.push(snapshot());
    try{next=generator.next();if(next.done){report.done=true;report.result=next.value;report.end=snapshot();report.finalTuning=JSON.stringify(g.TUNING);}}
    catch(error){report.done=true;report.failed=String(error);report.end=snapshot();}
   };
   let previous=0;const frame=time=>{if(report.done)return;if(previous)report.raf.push(time-previous);previous=time;requestAnimationFrame(frame);};requestAnimationFrame(frame);
  },{id,source});
  const started=Date.now();let status;
  do{
   await page.waitForTimeout(1000);
   status=await page.evaluate(()=>({done:window.bonusJourney.done,stage:window.bonusJourney.stage,frame:window.bonusJourney.frame}));
  }while(!status.done&&Date.now()-started<240000);
  const row=await page.evaluate(()=>({journey:window.bonusJourney,stamp:document.querySelector('.hud-build')?.textContent,assets:window.__game.getLoadingDiagnostics(),contextLost:window.__game.renderer.getContext().isContextLost()}));
  row.errors=[...errors];rows.push(row);
  await page.screenshot({path:`${output}/${id}.png`});await writeFile(`${output}/${id}.json`,JSON.stringify(row,null,2));await writeFile(`${output}/report.json`,JSON.stringify({base,source,rows},null,2));
  console.log(`${id}: ${row.journey.failed||row.journey.end?.state}, ${row.journey.frame} frames, ${row.journey.end?.crates}/${row.journey.result?.totalCrates} crates, ${errors.length} console errors`);
  assert.equal(row.journey.done,true);assert.equal(row.journey.failed,null);assert.equal(row.journey.end.state,'finished');assert.equal(row.journey.end.deaths,0);
  assert.equal(row.journey.end.gem,true);assert.equal(row.journey.result.cratesBroken,row.journey.result.totalCrates);
  assert.equal(row.journey.finalTuning,row.journey.tuning);assert.equal(row.contextLost,false);assert.deepEqual(row.errors,[]);
 }
}finally{await browser.close();}
