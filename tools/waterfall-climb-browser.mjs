import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fromBeat=Number(process.env.WATERFALL_FROM_BEAT||0),withBonus=process.env.WATERFALL_WITH_BONUS==='1';
const base=(process.argv[2]||'http://127.0.0.1:5274').replace(/\/$/,''),mode=process.env.WATERFALL_MODE||'lite';
const out=process.env.WATERFALL_OUTPUT||'docs/waterfall-climb/runs/browser';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:"export {WATERFALL_CLIMB_LEVEL as source,WATERFALL_BEATS as route} from './src/levels/waterfall-climb';export {WATERFALL_CLIMB_BONUS as bonus} from './src/levels/waterfall-climb-bonus';export {runWaterfallClimb,runWaterfallBonus} from './tools/waterfall-climb-pilot.mjs';export {puzzleControls} from './tools/puzzle-controls.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
await page.route('**/waterfall-test-fixture.js',route=>route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=waterfall-climb${mode==='lite'?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='waterfall-climb'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const start=await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  return {id:g.getCurrentLevel().id,position:g.player.pos.toArray(),grounded:g.player.grounded,resolution:g.renderQualitySettings.regularResolution,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};});
 console.log('READY',mode,JSON.stringify(start));assert.match(start.stamp,/Codex\/sol fork/);if(mode==='full')assert.deepEqual(start.buffer,[1920,1080]);
 await page.screenshot({path:`${out}/${mode}-arrival.png`});
 if(fromBeat){await page.keyboard.press('m');for(let i=0;i<7;i++){await page.keyboard.press('l');await page.waitForTimeout(180);}await page.keyboard.press('m');await page.waitForTimeout(600);}
 if(process.env.WATERFALL_SMOKE==='1'){
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(1200);await page.keyboard.up('ArrowUp');await page.waitForTimeout(600);
  const moved=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,state:window.__game.player.state}));
  await page.screenshot({path:`${out}/${mode}-walk.png`});assert.ok(moved.position[2]<start.position[2]-3);assert.ok(moved.grounded);
  await writeFile(`${out}/${mode}-smoke.json`,JSON.stringify({start,moved,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS browser spawn and keyboard run');
 }else{
  await page.evaluate(async({fromBeat,withBonus})=>{
   const m=await import('/waterfall-test-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
   const report=window.waterfallJourney={frame:0,done:false,error:null,actions:[],evidence:[],trace:[],tuning:JSON.stringify(g.TUNING),sourceMatches:JSON.stringify(m.source)===JSON.stringify(g.getCurrentLevel().data)};
   const context={p,l,source:m.source,route:m.route,report,get frame(){return report.frame;}};
   function* completeLevel(){
    report.phase='river';yield* m.runWaterfallClimb(context,{untilBeat:42});
    const c=m.puzzleControls(context),b=l.bonusPlatformDiagnostics;
    yield* c.walk([b.x+5,b.y,b.z],'Find the hidden spillway');yield* c.hop([b.x,b.topY,b.z],'Jump into the hidden spillway',{tolerance:1.6});
    while(g.getCurrentLevel().id!=='bonus:waterfall-climb')yield {};
    report.phase='bonus';const bonusContext={p,l:g.getLevel(),source:m.bonus,report,get frame(){return report.frame;}};
    report.bonusResult=yield* m.runWaterfallBonus(bonusContext);
    while(g.getCurrentLevel().id!=='waterfall-climb')yield {};
    c.check(g.getLevel()===l,'Bonus restored the same suspended parent');c.check(p.bonusCrates===22,'All bonus boxes returned');
    report.phase='waterfall';const result=yield* m.runWaterfallClimb(context,{fromBeat:42});
    c.check(p.cratesBroken+p.bonusCrates===l.totalCrates,'Combined all-box denominator');
    c.check(p.gemEarned,'Complete river, bonus and ascent earned the real clear gem');
    return {...result,bonusCrates:p.bonusCrates,gemEarned:p.gemEarned};
   }
   const pilot=withBonus?completeLevel():m.runWaterfallClimb(context,{fromBeat});report.fromBeat=fromBeat;report.initialCheckpointWarp=fromBeat>0;report.withBonus=withBonus;
   let next=pilot.next(),last={},advanced=false;
   const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
   p.step=(dt,input,level)=>{
    if(report.done)return step(dt,input,level);
    const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
    const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
    input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
    for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
     input[held]=sample[held]??false;input[held.replace('Held','Pressed')]=sample[held.replace('Held','Pressed')]??(input[held]&&!last[held]);
    }
    input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;
    last={...sample};step(dt,input,level);advanced=true;
   };
   p.commitRenderStep=(...args)=>{
    commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
    const pose={frame:report.frame,position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,crates:p.cratesBroken,
      camera:g.camera.position.toArray(),ground:p.groundHit?.name,beat:report.beat,phase:report.phase};
    report.pose=pose;if(report.frame%24===0)report.trace.push(pose);
    try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;}}
    catch(error){report.done=true;report.error=String(error);}
   };
  },{fromBeat,withBonus});
  const began=Date.now(),shots=new Set();let state,lastLog=0;
  do{
   await page.waitForTimeout(1000);state=await page.evaluate(()=>({done:window.waterfallJourney.done,error:window.waterfallJourney.error,stage:window.waterfallJourney.stage,pose:window.waterfallJourney.pose}));
   const beat=state.pose?.beat??0,shot=`${state.pose?.phase??'route'}-${String(Math.floor(beat/12)).padStart(2,'0')}`;
   if(!shots.has(shot)){shots.add(shot);await page.screenshot({path:`${out}/${mode}-route-${String(shot).padStart(2,'0')}.png`});}
   if(Date.now()-lastLog>30000){console.log('PROGRESS',JSON.stringify(state));lastLog=Date.now();await writeFile(`${out}/${mode}-progress.json`,JSON.stringify(state));}
  }while(!state.done&&Date.now()-began<2400000);
  const report=await page.evaluate(()=>window.waterfallJourney);
  await writeFile(`${out}/${mode}-journey.json`,JSON.stringify({report,errors},null,2));
  await page.screenshot({path:`${out}/${mode}-${report.error?'failure':'finish'}.png`});
  assert.ok(report.done,'journey ended within 40 minutes');assert.equal(report.error,null);assert.ok(report.tuningUnchanged);assert.ok(report.sourceMatches);
  assert.equal(report.result.state,'finished');assert.equal(report.result.deaths,0);
  assert.ok(report.trace.every(frame=>!['dead','bailing'].includes(frame.state)),'Continuous journey contains no death or bail recovery');
  assert.deepEqual(errors,[]);console.log('PASS browser journey',mode,JSON.stringify(report.result));
 }
}catch(error){console.log('ERRORS',JSON.stringify(errors));await page.screenshot({path:`${out}/${mode}-error.png`}).catch(()=>{});throw error;}
finally{await browser.close();}
