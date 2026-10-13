// Native input smoke for the Ruins foliage pass, locally or on Pages.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5273/';
const out=process.env.JUNGLE_REVIEW_OUT||'/private/tmp/jungle-ruins-smoke';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],reports=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(`${base}?playtest&level=jungle${lite?'&lite':''}`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
  const report={mode:lite?'lite':'full',stamp:await page.locator('.hud-build').textContent()};reports.push(report);
  assert.match(report.stamp,/Codex\/sol fork/);
  const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{
   id:g.getCurrentLevel().id,position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,snap:p.renderSnapVersion,
   crates:p.cratesBroken,total:l.totalCrates,checkpoint:l.checkpoints.indexOf(l.activeCheckpoint),currentSpawn:l.currentSpawn.toArray(),frame:g.getRenderFrameStats()};});
  const stage=(x,z,y=null)=>page.evaluate(({x,z,y})=>{const g=window.__game,p=g.player,l=g.getLevel();
   if(x===null)x=l.lanePts.reduce((a,b)=>Math.abs(b.z-z)<Math.abs(a.z-z)?b:a).x;
   const ray=new p.raycaster.constructor(p.pos.clone().set(x,55,z),p.pos.clone().set(0,-1,0));
   const floor=y??ray.intersectObjects(l.groundMeshes,false)[0]?.point.y??0;
   p.respawn(l,false,true,{position:p.pos.clone().set(x,floor+.06,z),heading:p.camDir.clone().set(l.hudMode==='bonus'?1:0,0,l.hudMode==='bonus'?0:-1)});
  },{x,z,y});
  const until=async(fn,arg,timeout=12000)=>{
   try{return await page.waitForFunction(fn,arg,{timeout});}
   catch(error){report.failure=await sample();await page.screenshot({path:`${out}/${report.mode}-failure.png`});throw error;}
  };
  const hold=async(key,ms)=>{await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);};
  report.spawn=await sample();
  // On-foot charged double jump over the first cut. New foliage cannot become
  // accidental support or block the takeoff/landing corridor.
  await stage(null,-33);
  await until(()=>window.__game.player.grounded);
  await page.keyboard.down('Space');await page.waitForTimeout(450);
  await page.keyboard.down('ArrowUp');await page.keyboard.up('Space');
  await until(()=>window.__game.player.state==='air');
  report.takeoff=await sample();
  await page.waitForTimeout(220);await page.keyboard.press('Space');
  await until(()=>window.__game.player.pos.z<-40.5&&window.__game.player.grounded);
  await page.keyboard.up('ArrowUp');
  report.jump=await sample();assert.ok(report.jump.position[2]<-40.5);
  // The original continuous containment still stops a sideways walk.
  await stage(null,-48);const before=await sample();await hold('ArrowRight',1400);
  report.boundary=await sample();assert.ok(Math.abs(report.boundary.position[0]-before.position[0])<6.5);assert.equal(report.boundary.grounded,true);
  // Earn a real checkpoint with an attack, then fall into the previous pit.
  await stage(-1.42,-114.6,-2.8);
  await page.keyboard.down('ArrowUp');await hold('KeyF',380);await page.keyboard.up('ArrowUp');
  await until(()=>window.__game.getLevel().checkpoints[0].active);
  report.checkpoint=await sample();
  await stage(null,-107,.5);
  const pitStart=await sample();
  await until(s=>window.__game.player.renderSnapVersion>s&&window.__game.player.grounded&&window.__game.player.pos.z<-111,pitStart.snap,20000);
  report.respawn=await sample();assert.ok(Math.abs(report.respawn.position[2]+116)<3);
  // Enter the parent's actual bonus session, then prove that a failed gap
  // returns to the same parent level without rebuilding its checkpoint.
  await page.evaluate(()=>{const g=window.__game;window.__jungleParent=g.getLevel();g.enterBonusRound();});
  await until(()=>window.__game.getCurrentLevel().id==='bonus:jungle'&&!window.__game.gameFlow.blocksGameplay,null,120000);
  report.bonusEntry=await sample();assert.equal(report.bonusEntry.grounded,true);
  await stage(45,0,1);
  await until(()=>window.__game.getCurrentLevel().id==='jungle'&&!window.__game.gameFlow.blocksGameplay,null,120000);
  report.bonusFailure=await page.evaluate(()=>({same:window.__game.getLevel()===window.__jungleParent,checkpoint:window.__game.getLevel().checkpoints[0].active}));
  assert.deepEqual(report.bonusFailure,{same:true,checkpoint:true});
  // The existing themed-bonus pilot separately proves the complete positive
  // puzzle journey without warps, including all boxes and the real return.
  await stage(0,-688,0);await until(()=>window.__game.player.grounded);
  await page.keyboard.down('Space');await page.waitForTimeout(450);
  await page.keyboard.down('ArrowUp');await page.keyboard.up('Space');
  await until(()=>window.__game.player.state==='finished');await page.keyboard.up('ArrowUp');
  report.finish=await sample();await page.screenshot({path:`${out}/${report.mode}-finish.png`});
  await page.close();console.log('PASS',report.mode,'Jungle Ruins and Fern Reliquary native input smoke');
 }
 assert.deepEqual(errors,[],'no browser console errors');
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
