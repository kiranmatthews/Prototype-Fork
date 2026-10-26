import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497',lite=!!process.env.CART_STEERING_LITE;
const out=process.env.CART_STEERING_BROWSER_OUTPUT??'/private/tmp/cart-steering-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const scenarios=[
 {name:'backwards-facing-coast',yaw:Math.PI,speed:-8,x:0,y:1,seconds:3,device:'keyboard'},
 {name:'reverse-coast-right',yaw:0,speed:-8,x:1,y:0,seconds:3.5,device:'keyboard'},
 {name:'spin-recovery-from-rest',yaw:Math.PI,speed:0,x:0,y:1,throttle:true,seconds:3.5,device:'keyboard'},
 {name:'controller-reverse-diagonal',yaw:Math.PI,speed:-8,x:-.7,y:.7,seconds:3.5,device:'controller'},
 // Stay on packed dirt and measure the completed recovery before the tyre chicane.
 {name:'controller-spin-recovery',offset:6,yaw:Math.PI-.05,speed:8,x:0,y:1,throttle:true,seconds:3,device:'controller'},
 {name:'controller-brake-in-reverse',yaw:0,speed:-8,x:0,y:0,throttle:true,brake:true,seconds:1.5,device:'controller'},
];
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${lite?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',0);});
 await page.waitForFunction(()=>{const r=window.__game.getSkateRace();return r.mode==='time-trial'&&r.phase==='running';},null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);
  const original=r.step.bind(r),poll=g.input.pollGamepad.bind(g.input);
  const review=window.cartSteeringReview={paused:true,time:0,samples:[],scenario:null};
  g.input.pollGamepad=()=>{
   const s=review.scenario;if(!s||s.device!=='controller')return poll();
   const length=Math.hypot(s.x,s.y),magnitude=length?.22+.78*Math.min(1,length):0;
   return {id:'Wireless Controller steering regression',index:0,connected:true,mapping:'standard',axes:length?[s.x/length*magnitude,-s.y/length*magnitude,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0?!!s.throttle:i===1?!!s.brake:false,value:i===0&&s.throttle||i===1&&s.brake?1:0}))};
  };
  r.step=(dt,input)=>{
   if(review.paused)return;
   original(dt,input);review.time+=dt;
   const c=r.carts.fleet.physics.carts[0],f=g.player.raceInputBasis(g.getLevel()),s=review.scenario;
   const tx=f.x*s.y-f.z*s.x,tz=f.z*s.y+f.x*s.x;
   const motion=Math.atan2(-c.vx,-c.vz),target=Math.atan2(-tx,-tz),error=Math.abs(Math.atan2(Math.sin(motion-target),Math.cos(motion-target)));
   review.samples.push({time:review.time,speed:c.speed,yaw:c.yaw,error,steer:r.carts.fleet.physics.inputs[0].steer,input:[input.moveX,input.moveY],grounded:c.grounded,rolls:c.rolls,falls:r.riders[0].falls,position:[c.x,c.y,c.z],ground:r.carts.ground(c.x,c.z),throttle:r.carts.fleet.physics.inputs[0].throttle});
   if(review.time>=s.seconds)review.paused=true;
  };
 });
 const reports=[];
 for(const scenario of scenarios){
  await page.evaluate(s=>{
   const g=window.__game,r=g.getSkateRace(),rally=r.carts,w=rally.fleet.physics,p=r.course.sample(35,s.offset??0),v=window.cartSteeringReview;
   // Reproduce the post-collision pose and velocity, then use the real Input ->
   // RallyControls -> physics pipeline. No driver or steering result is mocked.
   Object.assign(w.spawns[0],{x:p.x,z:p.z,yaw:0});w.reset(0);rally.sync();
   const f=g.player.raceInputBasis(g.getLevel()),c=w.carts[0],yaw=Math.atan2(-f.x,-f.z)+s.yaw;
   Object.assign(c,{yaw,speed:s.speed,vx:-Math.sin(yaw)*s.speed,vz:-Math.cos(yaw)*s.speed});rally.controls[0].reset();rally.sync();
   r.riders[0].progress=r.course.project(g.player.pos).s;r.riders[0].anchor.copy(g.player.pos);r.riders[0].anchorProgress=r.riders[0].progress;
   v.scenario=s;v.time=0;v.samples=[];
  },scenario);
  const keys=scenario.device==='keyboard'?[...(scenario.x>0?['ArrowRight']:scenario.x<0?['ArrowLeft']:[]),...(scenario.y>0?['ArrowUp']:scenario.y<0?['ArrowDown']:[]),...(scenario.throttle?['Space']:[])]:[];
  for(const key of keys)await page.keyboard.down(key);
  await page.evaluate(()=>window.cartSteeringReview.paused=false);
  await page.waitForFunction(()=>window.cartSteeringReview.paused,null,{timeout:45000});
  for(const key of keys)await page.keyboard.up(key);
  const result=await page.evaluate(()=>{const v=window.cartSteeringReview,tail=v.samples.filter(s=>s.time>v.time-1);return {scenario:v.scenario,last:v.samples.at(-1),tailSteer:tail.reduce((n,s)=>n+Math.abs(s.steer),0)/tail.length,samples:v.samples};});
  reports.push(result);await writeFile(`${out}/scenarios.json`,JSON.stringify(reports,null,2));console.log('SCENARIO',scenario.name,JSON.stringify({speed:result.last.speed,error:result.last.error,tailSteer:result.tailSteer}));await page.screenshot({path:`${out}/${scenario.name}.png`});
  assert.equal(result.last.falls,0);assert.equal(result.last.rolls,0);
  if(scenario.brake)assert.ok(Math.abs(result.last.speed)<.1,'Controller Circle stops reversing while X is held');
  else{
   assert.ok(result.last.error<.17,`${scenario.name}: direction converges`);
   assert.ok(result.tailSteer<.25,`${scenario.name}: steering settles instead of flipping lock`);
   assert.ok(result.samples.some(s=>Math.abs(s.input[0]-scenario.x)<.02&&Math.abs(s.input[1]-scenario.y)<.02),'The real input sampler receives the requested direction');
   if(scenario.throttle)assert.ok(result.last.speed>20,'X drives the spun cart out of recovery');
  }
  console.log('PASS',scenario.name,JSON.stringify({speed:result.last.speed,error:result.last.error,tailSteer:result.tailSteer}));
 }
 const runtime=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {stamp:document.querySelector('.hud-build')?.textContent,level:g.getCurrentLevel().id,gravity:r.carts.fleet.physics.gravity,stableLandings:r.carts.fleet.physics.stableLandings,spectators:r.carts.crowd.count,checkpoints:g.getLevel().checkpoints.length,glError:g.renderer.getContext().getError()};});
 await writeFile(`${out}/report.json`,JSON.stringify({lite,runtime,reports,errors},null,2));
 assert.deepEqual(errors,[]);assert.equal(runtime.glError,0);assert.match(runtime.stamp,/Codex\/sol fork/);assert.equal(runtime.gravity,24);assert.equal(runtime.stableLandings,true);assert.equal(runtime.checkpoints,0);
 console.log('PASS browser steering',JSON.stringify({lite,runtime,errors}));
}catch(error){console.log('BROWSER ERRORS',JSON.stringify(errors));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw error;}finally{await browser.close();}
