import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5229').replace(/\/$/,'');
const output=process.env.RACE_BROWSER_OUTPUT||'/private/tmp/skate-race-full-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=country-club${process.env.RACE_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.screenshot({path:output+'/grid.png'});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown',null,{timeout:30000});
 if(process.env.RACE_FROM)await page.evaluate(from=>{
  const r=window.__game.getSkateRace();r.phase='running';
  for(const a of r.riders){const s=from+a.id*4,point=r.course.sample(s,(a.id%2?1:-1)*2);point.y+=.12;a.player.resetRacePosition(r.level,point,r.course.tangent(s));a.player.speed=28;a.progress=a.previousProgress=a.anchorProgress=s;a.anchor.copy(point);}
 },Number(process.env.RACE_FROM));
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),update=g.input.update.bind(g.input);let sample={};
  window.raceReview={frames:0,initialTuning:JSON.stringify(g.TUNING),started:performance.now()};
  g.input.pollGamepad=()=>{
   const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;
   const held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld,6:!!sample.itemPressed,7:!!sample.transferHeld};
   return {id:'Skate race validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};
  };
  r.step=(dt,input)=>{sample=r.phase==='running'?r.drive(0):{};update();step(dt,input);window.raceReview.frames++;};
 });
 let mark=-1,finishShot=false,complete=false;
 for(let i=0;i<4200;i++){
  await page.waitForTimeout(250);
  const s=await page.evaluate(()=>{const r=window.__game.getSkateRace();return {traffic:window.__game.getGolfCarts()?.root.userData.traffic,phase:r.phase,time:r.elapsed,progress:r.riders[0].progress,length:r.course.length,finished:r.riders.filter(v=>v.finish!==null).length,falls:r.riders.map(v=>v.falls),riders:r.riders.map(v=>({id:v.id,s:v.progress,p:v.player.pos.toArray(),state:v.player.state,speed:v.player.speed,bailing:v.player.skateCameraBailing,grounded:v.player.grounded,recovery:v.recovery,finished:v.finish})),fps:1/window.__game.frameStats.rawDt};});
  if(i%80===0){console.log(JSON.stringify({heartbeat:true,...s}));await writeFile(output+'/latest.json',JSON.stringify(s));}
  const next=Math.floor(s.progress/700);if(next!==mark){mark=next;console.log(JSON.stringify(s));await page.screenshot({path:`${output}/section-${mark}.png`});}
  if(!finishShot&&s.length-s.progress<65&&s.phase==='running'){finishShot=true;await page.screenshot({path:output+'/finish-approach.png'});}
  if(s.finished===8){complete=true;break;}
 }
 const result=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {...window.raceReview,finalTuning:JSON.stringify(g.TUNING),wallSeconds:(performance.now()-window.raceReview.started)/1000,traffic:{...g.getGolfCarts().root.userData.traffic,...g.getGolfCarts().stats,moving:g.getGolfCarts().physics.carts.filter(c=>c.travel>5).length},phase:r.phase,level:g.getCurrentLevel().id,stamp:document.querySelector('.hud-build')?.textContent,
  hud:r.hud(),riders:r.riders.map(a=>({id:a.id,finish:a.finish,falls:a.falls,deaths:a.player.totalDeaths,fruit:a.player.fruit,lives:a.player.lives})),campaign:g.campaign.levelProgress('country-club')};});
 await page.screenshot({path:output+'/results.png'});await writeFile(output+'/report.json',JSON.stringify({base,complete,result,errors},null,2));
 console.log(JSON.stringify({complete,...result,hud:undefined,initialTuning:undefined,finalTuning:undefined,errors}));
 assert.ok(complete);assert.equal(result.phase,'finished');
 if(process.env.RACE_CARTS){assert.equal(result.traffic.count,10);assert.equal(result.traffic.scale,2);assert.equal(result.traffic.moving,10,'independent carts keep roaming; random contact counts are not a race quota');}assert.match(result.stamp,/Codex\/sol fork/);assert.equal(result.initialTuning,result.finalTuning);
 for(const r of result.riders){assert.equal(r.deaths,0);assert.equal(r.fruit,0);assert.ok(r.finish>0);}
 assert.deepEqual(errors,[]);
 // A fresh save earns the trial by winning the crystal; losing results keep it locked.
 const trialButton=page.getByRole('button',{name:'TIME TRIAL',exact:true});
 assert.equal(result.hud.timeTrialUnlocked,result.hud.won);
 if(result.hud.timeTrialUnlocked){
  await trialButton.click();await page.waitForFunction(()=>window.__game.getSkateRace().mode==='time-trial',null,{timeout:30000});
  const trial=await page.evaluate(()=>{const r=window.__game.getSkateRace();return {unlocked:true,count:r.count,phase:r.phase,clock:r.level.clockPickup,others:r.riders.slice(1).some(v=>v.scene.visible)};});
  assert.equal(trial.count,1);assert.equal(trial.clock,null);assert.equal(trial.others,false);await writeFile(output+'/trial.json',JSON.stringify(trial,null,2));
 }else{
  assert.equal(await trialButton.count(),0);await writeFile(output+'/trial.json',JSON.stringify({unlocked:false,reason:'Race crystal not earned'},null,2));
 }
}finally{await browser.close();}
