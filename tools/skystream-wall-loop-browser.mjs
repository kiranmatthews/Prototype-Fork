import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5188/';
const lite=process.argv.includes('--lite');
const out=process.env.SKYSTREAM_WALL_OUTPUT||'/private/tmp/skystream-wall-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}?playtest&level=skystream${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),mesh=l.loopMeshes.find(m=>m.userData.loopKind==='wall');
  if(l.ledgeGrabs!==false)throw Error('Main course ledge catches still enabled');
  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  // Start at rest on the real approach. From here, use only normal held input.
  p.respawn(l,true,false,{position:mesh.localToWorld(p.pos.clone().set(0,.15,12)),heading:p.axisF.clone().set(0,0,-1).transformDirection(mesh.matrixWorld)});
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  const review=window.__wallReview={frame:0,done:false,failed:null,samples:[],quarters:[]};
  p.step=(dt,input,level)=>{
   const drive=!review.done&&!review.failed;
   step(dt,{...input,moveX:0,moveY:drive?1:0,jumpHeld:drive,jumpPressed:drive&&!p.rawInput.jumpHeld,jumpReleased:!drive&&p.rawInput.jumpHeld,
    grabHeld:false,grabPressed:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,transferHeld:false,transferPressed:false,restartPressed:false},level);
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(review.done||review.failed)return;review.frame++;
   if(p.loopRide?.mesh===mesh){
    p.boardG.updateWorldMatrix(true,false);
    const progress=p.loopStatus.progress,quarter=Math.min(3,Math.floor(progress*4));
    review.samples.push({progress,boardDot:p.pos.clone().set(0,1,0).transformDirection(p.boardG.matrixWorld).dot(p.rideNormal)});
    if(!review.quarters.includes(quarter))review.quarters.push(quarter);
   }
   review.done=p.loopStatus.completed===1;
   if(p.isBailing||['dead','gameover','hang'].includes(p.state))review.failed=`Unexpected ${p.state} at ${p.pos.toArray()}`;
   if(review.frame>2400)review.failed='Wall loop timed out';
  };
 });
 const shots=new Set();let state;
 for(let i=0;i<600;i++){
  await page.waitForTimeout(150);
  state=await page.evaluate(()=>{const r=window.__wallReview,p=window.__game.player;return {frame:r.frame,done:r.done,failed:r.failed,loop:p.loopStatus};});
  if(state.loop.active){const quarter=Math.min(3,Math.floor(state.loop.progress*4));if(!shots.has(quarter)){shots.add(quarter);await page.screenshot({path:`${out}/wall-quarter-${quarter}.png`});}}
  if(state.done||state.failed)break;
 }
 const report=await page.evaluate(()=>({base:location.href,stamp:document.querySelector('.hud-build')?.textContent,ledgeGrabs:window.__game.getLevel().ledgeGrabs,...window.__wallReview}));
 assert.ok(report.done&&!report.failed,JSON.stringify(state));assert.equal(report.quarters.length,4);assert.ok(report.samples.length>60);
 const steady=report.samples.filter(s=>s.progress>.13&&s.progress<.87);assert.ok(steady.length>40);report.minSteadyBoardDot=Math.min(...steady.map(s=>s.boardDot));
 assert.ok(report.minSteadyBoardDot>.995);assert.match(report.stamp,/Codex\/sol fork/);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
 await page.screenshot({path:`${out}/exit-normal.png`});
 await page.evaluate(()=>window.__game.switchLevel('bonus-skystream'));
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus-skystream'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.bonusLedgeGrabs=await page.evaluate(()=>window.__game.getLevel().ledgeGrabs);assert.equal(report.bonusLedgeGrabs,false);
 await page.screenshot({path:`${out}/bonus.png`});
 report.errors=errors;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));assert.deepEqual(errors,[]);
 console.log(JSON.stringify({...report,samples:report.samples.length}));
}finally{await browser.close();}
