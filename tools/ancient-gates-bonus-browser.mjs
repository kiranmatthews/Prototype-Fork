import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5278';
const full=process.argv.includes('--full'),output=process.env.ANCIENT_GATES_OUTPUT||'/private/tmp/ancient-gates-bonus-browser';
const completeCourse=process.argv.includes('--complete-course');
await mkdir(output,{recursive:true});const tag=`${full?'full':'lite'}${completeCourse?'-complete-course':''}`,reports=[];
const fixture=await build({entryPoints:['tools/ancient-gates-browser-runtime.mjs'],bundle:true,format:'iife',globalName:'ancientReview',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=jungle-gate-run${full?'':'&lite'}`,{timeout:240000});
 const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
 await ready('jungle-gate-run');await page.addScriptTag({content:fixture.outputFiles[0].text});
 await page.evaluate(complete=>{const g=window.__game;if(!complete)for(let i=0;i<9;i++)g.player.warpCheckpoint(g.getLevel(),1);window.ancientParent=g.getLevel();},completeCourse);
 const pilot=async(kind,options={})=>{
  await page.evaluate(({kind,options})=>window.ancientReview.installAncientPilot(kind,options),{kind,options});
  let prior='';
  for(let i=0;i<3600;i++){
   await page.waitForTimeout(250);const state=await page.evaluate(()=>({done:window.ancientPilotReport.done,stage:window.ancientPilotReport.stage,frame:window.ancientPilotReport.frame}));
   if(state.stage!==prior){console.log(state.frame,state.stage);prior=state.stage;}if(state.done)break;
  }
  const r=await page.evaluate(()=>window.ancientPilotReport);reports.push({kind,...r});
  await writeFile(`${output}/${tag}-journeys.json`,JSON.stringify(reports,null,2));
  assert.equal(r.done,true);assert.equal(r.failure,null);assert.equal(r.sourceMatches,true);assert.equal(r.maskHits,0);
  return r;
 };
 await pilot('main',{from:completeCourse?0:9,to:9,stopAtBonus:true});await ready('bonus:jungle-gate-run');
 const parentBefore=await page.evaluate(()=>{const g=window.__game;return{deaths:g.player.totalDeaths,returnPoint:window.ancientParent.bonusReturnPoint().toArray(),switchUsed:window.ancientParent.crates.find(c=>c.bang)?.bangUsed};});
 await page.screenshot({path:`${output}/${tag}-entered.png`});
 // A real failed jump off the arrival court must return without consuming
 // a parent life or resetting the restored sunken stair.
 await page.keyboard.down('ArrowLeft');await page.keyboard.down('Space');await page.waitForTimeout(650);
 await page.keyboard.up('Space');await page.waitForTimeout(2500);await page.keyboard.up('ArrowLeft');
 await ready('jungle-gate-run');
 const returned=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{sameParent:l===window.ancientParent,position:g.player.pos.toArray(),grounded:g.player.grounded,
  deaths:g.player.totalDeaths,crates:g.player.cratesBroken,bonusCrates:g.player.bonusCrates,completed:l.bonusRoundCompleted,switchUsed:l.crates.find(c=>c.bang)?.bangUsed};});
 await page.waitForTimeout(350);const failedReturn=await returned();
 assert.ok(failedReturn.sameParent&&failedReturn.switchUsed);assert.equal(failedReturn.completed,false);assert.equal(failedReturn.deaths,parentBefore.deaths);
 await page.screenshot({path:`${output}/${tag}-failed-return.png`});
 await pilot('entrance');await ready('bonus:jungle-gate-run');
 const complete=await pilot('bonus');assert.equal(complete.result.cratesBroken,28);assert.equal(complete.result.gemEarned,false);
 await ready('jungle-gate-run');await page.waitForTimeout(500);const successfulReturn=await returned();
 assert.ok(successfulReturn.sameParent&&successfulReturn.switchUsed&&successfulReturn.grounded);assert.equal(successfulReturn.completed,true);
 assert.equal(successfulReturn.bonusCrates,28);assert.equal(successfulReturn.deaths,parentBefore.deaths);
 assert.ok(Math.abs(successfulReturn.position[0]-1137)<.2&&Math.abs(successfulReturn.position[1]-8)<.2);
 await page.screenshot({path:`${output}/${tag}-complete-return.png`});assert.deepEqual(errors,[]);
 let courseClear=null;
 if(completeCourse){
  const clear=await pilot('main',{from:9,to:11,resumeAfterBonus:true,requireAllMainBoxes:true});courseClear=clear.result;
  assert.equal(courseClear.gemEarned,true);assert.equal(courseClear.cratesBroken+courseClear.bonusCrates,courseClear.totalCrates);
  await page.screenshot({path:`${output}/${tag}-gem-clear.png`});assert.deepEqual(errors,[]);
 }
 const result={parentBefore,failedReturn,successfulReturn,courseClear,errors};await writeFile(`${output}/${tag}-session.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
