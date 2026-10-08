// Menu entry, native controls, checkpoint death/respawn and finish contracts.
// Gate placement is deliberate: this tests lifecycle, not complete traversal.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5342/';
const output=process.env.LIFECYCLE_OUTPUT||'/private/tmp/level-lifecycle';
const ids=process.env.LIFECYCLE_LEVELS?.split(',');
const full=process.env.LIFECYCLE_FULL==='1';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={base,full,rows:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});let current='startup';
 page.on('pageerror',e=>report.errors.push({id:current,message:String(e)}));
 page.on('console',m=>{if(m.type()==='error')report.errors.push({id:current,message:m.text()});});
 await page.goto(new URL(`?${full?'':'lite&'}playtest&level=sky`,base).href);
 const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await ready();
 const entries=await page.evaluate(()=>window.__game.levelList().map(e=>({id:e.id,name:e.name})));
 report.stamp=await page.locator('.hud-build').textContent();assert.match(report.stamp,/Codex\/sol fork/);
 for(const entry of entries.filter(e=>!ids||ids.includes(e.id))){
  current=entry.id;const row={...entry};
  try{
   // A gate begins the results transition on the following simulation tick.
   // Wait for that owner to finish before asking the menu to switch levels.
   if(report.rows.at(-1)?.finish==='gate accepted')await page.waitForFunction(()=>{const g=window.__game;return !!g.gameFlow.currentScreen&&!g.gameFlow.loadingPhase&&!g.gameFlow.transitionActive;},null,{timeout:30000});
   await page.evaluate(id=>window.__game.ui.onLevelSelect(id),entry.id);await ready();
   assert.equal(await page.evaluate(()=>window.__game.getCurrentLevel().id),entry.id);
   const kind=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {hub:l.hudMode==='hub',bonus:l.hudMode==='bonus',competition:!!g.getCompetition(),boss:!!l.boss,checkpoints:l.checkpoints.length,gate:!l.finishGlow.isEmpty(),loops:l.loopMeshes.filter(m=>m.userData.loopRequired).length};});row.kind=kind;
   if(kind.competition){await page.evaluate(()=>window.__game.competitionAction('start'));await page.waitForFunction(()=>window.__game.getCompetition().phase==='running',null,{timeout:15000});}
   await page.waitForTimeout(200);
   const before=await page.evaluate(()=>window.__game.player.pos.toArray());
   row.key=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),z=l.zoneAt(g.player.pos.x,g.player.pos.z);return l.hudMode==='bonus'||z?.dir==='E'?'ArrowRight':z?.dir==='W'?'ArrowLeft':'ArrowUp';});
   await page.keyboard.down(row.key);await page.waitForTimeout(350);await page.keyboard.up(row.key);
   row.movement=await page.evaluate(before=>{const p=window.__game.player;return {distance:Math.hypot(...p.pos.toArray().map((v,i)=>v-before[i])),state:p.state};},before);
   if(!kind.hub)assert.ok(row.movement.distance>.1,'native control must move the player');
   row.checkpoint=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {warped:l.checkpoints.length?g.player.warpCheckpoint(l,1):null,expected:l.currentSpawn.toArray()};});
   row.death=await page.evaluate(()=>{
    const g=window.__game,p=g.player,l=g.getLevel(),before={lives:p.lives,deaths:p.totalDeaths};
    p.pos.copy(l.currentSpawn);p.pos.y=l.killY-5;p.prevPos.copy(p.pos);p.grounded=false;p.state='air';p.vVel=-5;p.snapRenderInterpolation();return before;
   });
   await page.waitForFunction(()=>{const g=window.__game,p=g.player;return p.state==='ride'&&p.grounded&&p.pos.y>g.getLevel().killY;},null,{timeout:20000});
   row.respawn=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return {lives:p.lives,deaths:p.totalDeaths,position:p.pos.toArray(),distance:p.pos.distanceTo(l.currentSpawn),boss:g.getBossDiagnostics(),contextLost:g.renderer.getContext().isContextLost()};});
   assert.ok(row.respawn.distance<3,'respawn must return to supported checkpoint ground');assert.equal(row.respawn.contextLost,false);
   if(!kind.hub)assert.ok(row.respawn.lives<row.death.lives||row.respawn.deaths>row.death.deaths||kind.competition,'death must use normal life accounting');
   if(kind.boss){assert.equal(row.respawn.boss.health,9);assert.equal(row.respawn.boss.phase,1);row.finish='boss victory is covered by the dedicated fight test';}
   else if(kind.competition)row.finish='competition scorecard is covered by the dedicated event test';
   else if(kind.hub||!kind.gate)row.finish='no ordinary finish gate';
   else{
    await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;const position=l.finishGlow.getCenter(p.pos.clone());p.respawn(l,false,true,{position,heading:p.camDir.clone()});p.snapRenderInterpolation();});
    if(kind.loops){
     await page.waitForTimeout(350);assert.notEqual(await page.evaluate(()=>window.__game.player.state),'finished','required loops must still gate completion');
     row.finish='required loop lock retained; complete loop traversal is a separate check';
    }else{
     await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:10000});row.finish='gate accepted';
    }
   }
   row.assets=await page.evaluate(()=>window.__game.getLoadingDiagnostics());assert.deepEqual(row.assets.failed,[]);
   console.log(`PASS ${entry.id}: input, respawn${row.checkpoint.warped?', checkpoint':''}, ${row.finish}`);
  }catch(error){row.failure=String(error);console.log(`FAIL ${entry.id}: ${error}`);await page.screenshot({path:`${output}/${entry.id}-failure.png`}).catch(()=>{});}
  report.rows.push(row);await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 }
 assert.ok(report.rows.every(r=>!r.failure),'Review lifecycle report.json');assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
