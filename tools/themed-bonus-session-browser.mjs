import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5194/';
const output=process.env.BONUS_SESSION_OUTPUT||`${tmpdir()}/themed-bonus-sessions`;
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try{
 for(const parentId of ['jungle-cup','waterpark-cup','jungle-terraces']){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],retired=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(r.url().includes('/bonus-parallax/'))retired.push(r.url());});
  await page.goto(new URL(`?playtest&level=${parentId}`,base).href);
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,parentId,{timeout:120000});
  const before=await page.evaluate(()=>{const g=window.__game;window.bonusParent=g.getLevel();window.bonusEvent=g.getCompetition();return {id:g.getCurrentLevel().id,lives:g.player.lives,fruit:g.player.fruit,phase:g.getCompetition()?.phase};});
  if(parentId.endsWith('cup')){
   for(const [width,height] of [[1280,720],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(350);
    const bounds=await page.locator('.competition-host button[data-action="bonus"]').boundingBox();
    assert.ok(bounds&&bounds.width>=40&&bounds.height>=30&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+.5&&bounds.y+bounds.height<=height+.5,'bonus action escaped the cup card');
    await page.screenshot({path:`${output}/${parentId}-menu-${width}x${height}.png`});
   }
   await page.setViewportSize({width:1280,height:720});
   await page.locator('.competition-host button[data-action="bonus"]').click();
  }else await page.evaluate(()=>window.__game.enterBonusRound());
  await page.waitForFunction(id=>window.__game.getCurrentLevel().id===`bonus:${id}`&&!window.__game.gameFlow.blocksGameplay,parentId,{timeout:120000});
  assert.equal(await page.evaluate(()=>window.__game.getCompetition()),null);
  assert.equal(await page.evaluate(()=>!!window.__game.scene.getObjectByName('BonusParallax_CameraQuad')),false);
  await page.screenshot({path:`${output}/${parentId}-bonus-full.png`});
  if(parentId==='waterpark-cup'){
   // Real input intentionally jumps back off the arrival terrace. A failed
   // bonus must return to the same scorecard with its event and purse intact.
   await page.keyboard.down('ArrowLeft');await page.keyboard.down('Space');await page.waitForTimeout(650);
   await page.keyboard.up('Space');await page.waitForTimeout(2500);await page.keyboard.up('ArrowLeft');
  }else{
   await page.evaluate(async parentId=>{
    const g=window.__game,p=g.player,l=g.getLevel();
    const {THEMED_BONUS_COURSES}=await import('/src/levels/themed-bonuses.ts');
    const {runThemedBonusJourney}=await import('/tools/themed-bonus-pilot.mjs');
    const course=THEMED_BONUS_COURSES.find(c=>c.parentId===parentId);
    const report=window.bonusJourney={stage:'start',frame:0,done:false,failed:null,actions:[],evidence:[],trace:[]};
    const ctx={id:course.id,p,l,course,source:course.data,report,trace:report.trace,get frame(){return report.frame;}};
    const pilot=runThemedBonusJourney(ctx);let next=pilot.next(),last={},advanced=false;
    const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
    const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,crates:p.cratesBroken,gem:p.gemEarned});
    p.step=(dt,input,level)=>{
     if(report.done)return step(dt,input,level);
     const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
     const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
     input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
     for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
      input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);
     }
     input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
     last={...sample};step(dt,input,level);advanced=true;
    };
    p.commitRenderStep=(...args)=>{
     commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.trace.push(snapshot());
     try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;report.end=snapshot();}}
     catch(error){report.done=true;report.failed=String(error);report.end=snapshot();}
    };
   },parentId);
   for(let i=0;i<1000;i++){
    await page.waitForTimeout(250);
    const state=await page.evaluate(()=>({done:window.bonusJourney.done,stage:window.bonusJourney.stage,failed:window.bonusJourney.failed,frame:window.bonusJourney.frame}));
    if(i%80===0)console.log(JSON.stringify({parentId,...state}));if(state.done)break;
   }
   const journey=await page.evaluate(()=>window.bonusJourney);
   await writeFile(`${output}/${parentId}-journey.json`,JSON.stringify(journey,null,2));
   assert.equal(journey.failed,null,`${parentId}: ${journey.failed}`);assert.equal(journey.done,true);
   assert.equal(journey.end.state,'finished');assert.equal(journey.end.gem,false);
   assert.equal(journey.result.cratesBroken,journey.result.totalCrates);
  }
  await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,parentId,{timeout:90000});
  const after=await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,sameParent:g.getLevel()===window.bonusParent,sameEvent:g.getCompetition()===window.bonusEvent,
   phase:g.getCompetition()?.phase,lives:g.player.lives,fruit:g.player.fruit,completed:g.getLevel().bonusRoundCompleted,bonusCrates:g.player.bonusCrates,
   bonusButton:!!document.querySelector('.competition-host button[data-action="bonus"]'),bonusMode:g.player.bonusMode,competitionMode:g.player.competitionMode};});
  assert.ok(after.sameParent&&after.sameEvent,'bonus discarded parent or competition event');
  assert.equal(after.completed,parentId!=='waterpark-cup');
  assert.equal(after.bonusMode,false);
  if(parentId==='waterpark-cup'){assert.equal(after.lives,before.lives);assert.equal(after.fruit,before.fruit);assert.equal(after.bonusButton,true);}
  if(parentId==='jungle-cup'){assert.equal(after.bonusButton,false);assert.equal(after.phase,before.phase);assert.equal(after.competitionMode,true);}
  assert.deepEqual(retired,[]);assert.deepEqual(errors,[]);
  await page.screenshot({path:`${output}/${parentId}-returned-full.png`});
  reports.push({parentId,before,after,errors,retired});console.log(JSON.stringify(reports.at(-1)));await page.close();
 }
 await writeFile(`${output}/report.json`,JSON.stringify(reports,null,2));
}finally{await browser.close();}
