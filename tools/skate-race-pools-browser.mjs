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
  g.input.pollGamepad=()=>({id:'Pool route validation controller',index:0,connected:true,mapping:'standard',axes:[sample.moveX||0,-(sample.moveY||0),0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!sample.jumpHeld,touched:i===0&&!!sample.jumpHeld,value:i===0&&sample.jumpHeld?1:0}))});
  r.step=(dt,input)=>{
   const q=window.poolReview,p=g.player;
   if(q?.active){
    if(p.swimming){q.swam=true;q.swimFrames++;}
    if(q.swam&&!p.swimming&&p.grounded&&q.charge<0){q.exited=true;q.charge=0;}
    sample=q.charge>=0&&q.charge<24?{jumpHeld:true}:{moveY:1};if(q.charge>=0)q.charge++;
   }else sample={};
   update();step(dt,input);
   if(q?.active){q.frames++;if(q.charge===25){q.hopped=p.state==='air'&&!p.airFromSkate;if(!q.hopped){q.failure='First shore jump did not launch';q.active=false;}}
    if(q.hopped&&p.grounded&&r.riders[0].progress>q.target){q.active=false;q.done=true;q.result={frames:q.frames,swam:q.swam,swimFrames:q.swimFrames,exited:q.exited,hopped:q.hopped,board:p.boardRolling,falls:r.riders[0].falls,position:p.pos.toArray(),lives:p.lives,phase:r.phase};}
   }
  };
 });
 for(let i=0;i<6;i++){
  await page.evaluate(i=>{const g=window.__game,r=g.getSkateRace();r.start('time-trial');r.phase='running';const a=r.riders[0],j=r.jumps[i],s=j.s-4,at=r.course.support(r.level,s);g.player.resetRacePosition(r.level,at,r.course.tangent(s));a.progress=a.previousProgress=a.anchorProgress=s;a.anchor.copy(at);g.input.consumeEdges();window.poolReview={active:true,done:false,frames:0,swimFrames:0,swam:false,exited:false,hopped:false,charge:-1,target:j.end+7};},i);
  await page.waitForFunction(()=>window.poolReview.swam,null,{timeout:60000});await page.screenshot({path:`${output}/pool-${i+1}-swimming.png`});
  await page.waitForFunction(()=>window.poolReview.done||window.poolReview.failure,null,{timeout:90000});await page.screenshot({path:`${output}/pool-${i+1}-exit.png`});
  const failure=await page.evaluate(()=>window.poolReview.failure);assert.equal(failure,undefined);
  const report=await page.evaluate(()=>window.poolReview.result);reports.push({pool:i+1,...report});console.log(JSON.stringify(reports.at(-1)));
  assert.ok(report.swam&&report.exited&&report.hopped&&!report.board);assert.ok(report.frames<1200,'Must exit this pool, not reach a later gap');assert.equal(report.falls,0);assert.equal(report.lives,4);assert.equal(report.phase,'running');
 }
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 await writeFile(output+'/report.json',JSON.stringify({base,stamp,reports,errors},null,2));console.log('PASS six full-render water entries, swims, downhill hops and on-foot continuations');
}finally{await browser.close();}
