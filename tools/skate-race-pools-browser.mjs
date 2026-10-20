import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5229').replace(/\/$/,'');
const output=process.env.RACE_POOL_OUTPUT||join(tmpdir(),'skate-race-pools-browser');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),page=await context.newPage(),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.RACE_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),update=g.input.update.bind(g.input);let sample={};
  g.input.pollGamepad=()=>({id:'Pool route validation controller',index:0,connected:true,mapping:'standard',axes:[sample.moveX||0,-(sample.moveY||0),0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0?!!sample.jumpHeld:i===1&&!!sample.grabHeld,touched:i===0?!!sample.jumpHeld:i===1&&!!sample.grabHeld,value:(i===0&&sample.jumpHeld)||(i===1&&sample.grabHeld)?1:0}))});
  r.step=(dt,input)=>{
   const q=window.poolReview,p=g.player;
   if(q?.active){
    if(p.swimming){q.swam=true;q.swimFrames++;}
    if(q.swam&&!p.swimming&&p.grounded&&q.charge<0){q.exited=true;q.charge=0;}
    sample=q.frames===0?{grabHeld:true}:q.charge>=0&&q.charge<24?{jumpHeld:true}:{moveY:1};if(q.charge>=0)q.charge++;
   }else sample={};
   update();step(dt,input);
   if(q?.active){q.frames++;if(q.charge===25){q.hopped=p.state==='air'&&!p.airFromSkate;if(!q.hopped){q.failure='First shore jump did not launch';q.active=false;}}
    if(q.hopped&&p.grounded&&r.riders[0].progress>q.target){q.active=false;q.done=true;q.result={frames:q.frames,swam:q.swam,swimFrames:q.swimFrames,exited:q.exited,hopped:q.hopped,board:p.boardRolling,falls:r.riders[0].falls,position:p.pos.toArray(),lives:p.lives,phase:r.phase};}
   }
  };
 });
 const count=await page.evaluate(()=>{const r=window.__game.getSkateRace();window.reviewPools=r.level.captureData().components.filter(c=>c.swimDepth).sort((a,b)=>a.grp-b.grp).map(c=>{const v=c.vertices,endZ=c.p[2]+(v[v.length-4]+v[v.length-1])/2;const first=r.level.skateRace.jumps.findIndex(j=>Math.abs(j.takeoff[2]-(c.p[2]-4))<.1),last=r.level.skateRace.jumps.findIndex(j=>Math.abs(j.landing[2]-(endZ+4))<.1);if(first<0||last<0)throw Error('Pool jump bounds missing');return {s:r.jumps[first].s,end:r.jumps[last].end};});return window.reviewPools.length;});
 assert.equal(count,8);
 for(let i=Number(process.env.RACE_POOL_FROM||0);i<count;i++){
  await page.evaluate(i=>{const g=window.__game,r=g.getSkateRace();r.start('time-trial');r.phase='running';const a=r.riders[0],j=window.reviewPools[i],s=j.s-4,at=r.course.supportAt(r.level,r.course.sample(s,i>=6?8:0));g.player.resetRacePosition(r.level,at,r.course.tangent(s));a.progress=a.previousProgress=a.anchorProgress=s;a.anchor.copy(at);g.input.consumeEdges();window.poolReview={active:true,done:false,frames:0,swimFrames:0,swam:false,exited:false,hopped:false,charge:-1,target:j.end+7};},i);
  await page.waitForFunction(()=>window.poolReview.swam,null,{timeout:60000});await page.screenshot({path:`${output}/pool-${i+1}-swimming.png`});
  await page.waitForFunction(()=>window.poolReview.done||window.poolReview.failure,null,{timeout:90000});await page.screenshot({path:`${output}/pool-${i+1}-exit.png`});
  const failure=await page.evaluate(()=>window.poolReview.failure);assert.equal(failure,undefined);
  const report=await page.evaluate(()=>window.poolReview.result);reports.push({pool:i+1,...report});console.log(JSON.stringify(reports.at(-1)));
  assert.ok(report.swam&&report.exited&&report.hopped&&!report.board);assert.ok(report.frames<1800,'Must exit this pool, not reach a later gap');assert.equal(report.falls,0);assert.equal(report.lives,4);assert.equal(report.phase,'running');
 }
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 await writeFile(output+'/report.json',JSON.stringify({base,stamp,reports,errors},null,2));console.log(`PASS ${reports.length} full-render water entries, swims, downhill hops and on-foot continuations`);
}finally{await browser.close();}
