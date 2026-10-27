import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5453';
const out=process.env.CART_BROWSER_OUTPUT??'/private/tmp/coconut-cart-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.screenshot({path:out+'/grid.png'});
 console.log('READY',await page.evaluate(()=>({name:window.__game.getLevel().name,carts:window.__game.getSkateRace().carts.fleet.stats,errors:document.querySelector('.vite-error-overlay')?.textContent})));
 if(process.env.CART_CAPTURE_ONLY){await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1200);await page.screenshot({path:out+'/stadium.png'});await writeFile(out+'/errors.json',JSON.stringify(errors));process.exitCode=errors.length?1:0;}
 else{
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 // Isolate physical-button assertions from rival hits; the full field is restarted below.
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',0);});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(1500);await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');await page.waitForTimeout(1800);
 const drive=await page.evaluate(()=>({speed:window.__game.player.speed,s:window.__game.getSkateRace().riders[0].progress,yaw:window.__game.getSkateRace().carts.fleet.physics.carts[0].yaw}));assert.ok(drive.speed>5,'Real throttle accelerates');
 await page.keyboard.down('ArrowRight');await page.waitForTimeout(300);await page.keyboard.up('ArrowRight');
 const steering=await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].yaw);assert.ok(Math.abs(steering-drive.yaw)>.03,'Real steering turns the cart');
 await page.keyboard.down('KeyQ');await page.waitForTimeout(600);await page.keyboard.up('KeyQ');
 const braking=await page.evaluate(()=>window.__game.player.speed);assert.ok(Math.abs(braking)<drive.speed,'Brake slows the cart');
 await page.evaluate(()=>window.__game.getSkateRace().start('race',0));
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 const beforeHop=await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].airborneCount);
 await page.keyboard.down('Space');await page.waitForTimeout(400);await page.keyboard.up('Space');await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].airborneCount),beforeHop,'X release keeps the kart grounded');
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),update=g.input.update.bind(g.input),poll=g.input.pollGamepad.bind(g.input);let sample={};
  window.stopCartPilot=()=>{r.step=step;g.input.pollGamepad=poll;};
  r.start('race',0);window.cartReview={frames:0,air:0,maxHeight:0,engineFrames:0};
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;return {id:'Rally validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>{const held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!(sample.spinHeld||sample.spinPressed),3:!!(sample.grindHeld||sample.grindPressed),6:!!sample.itemPressed,7:!!sample.transferHeld};return {pressed:!!held[i],value:held[i]?1:0};})};};
  // AI requests are semantic taps. A physical controller must release Triangle
  // between attempts, including an attempt during the normal entry cooldown.
  r.step=(dt,input)=>{sample=r.phase==='running'?r.drive(0):{};if(sample.grindPressed)sample.grindPressed=window.cartReview.frames%18===0;update();step(dt,input);window.cartReview.frames++;if([...g.sfx.loops.keys()].some(k=>k.startsWith('rally-engine-')))window.cartReview.engineFrames++;if(!g.player.grounded){window.cartReview.air++;window.cartReview.maxHeight=Math.max(window.cartReview.maxHeight,g.player.pos.y-r.course.sample(r.riders[0].progress).y);}};
 });
 let mark=-1,done=false,jumpShot=false,pipeShot=false,preview=null;
 for(let i=0;i<2400;i++){
  await page.waitForTimeout(250);
  const s=await page.evaluate(()=>{const r=window.__game.getSkateRace();return {phase:r.phase,time:r.elapsed,s:r.riders[0].progress,air:!r.riders[0].player.grounded,height:r.riders[0].player.pos.y-r.course.sample(r.riders[0].progress).y,finished:r.riders.filter(r=>r.finish!==null).length,falls:r.riders.map(r=>r.falls),unfinished:r.riders.filter(v=>v.finish===null).map(v=>({id:v.id,s:v.progress,cart:r.carts.cartForRacer[v.id],pos:v.player.pos.toArray(),speed:v.player.speed}))};});
  if(i%80===0)console.log(JSON.stringify(s));
  const section=Math.floor(s.s/500);if(section!==mark){mark=section;await page.screenshot({path:`${out}/section-${section}.png`});}
  if(!jumpShot&&s.s>140&&s.s<250&&s.air&&s.height>5){jumpShot=true;await page.screenshot({path:out+'/big-jump.png'});}
  if(!pipeShot&&s.s>575&&s.s<630){
   pipeShot=true;await page.screenshot({path:out+'/half-pipe.png'});
   if(process.env.CART_FULL)preview=await page.evaluate(()=>{
    const g=window.__game,renderer=g.renderer,camera=g.camera.clone(),p=g.player.pos,old=renderer.getRenderTarget();
    camera.aspect=16/9;camera.fov=62;camera.position.set(p.x+28,p.y+25,p.z+38);camera.lookAt(p.x,p.y+2,p.z-25);camera.updateProjectionMatrix();
    renderer.setRenderTarget(null);renderer.render(g.scene,camera);
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').drawImage(renderer.domElement,0,0,640,360);
    const image=canvas.toDataURL('image/jpeg',.9);renderer.setRenderTarget(old);return image;
   });
  }
  if(s.finished===8){done=true;break;}
  if(process.env.CART_MAX_RACE_SECONDS&&s.time>Number(process.env.CART_MAX_RACE_SECONDS))break;
 }
 if(done)await page.waitForFunction(()=>{
  const g=window.__game,c=g.getSkateRace().carts;
  return c.fleet.physics.carts.every((k,i)=>c.driverForCart[i]<0||Math.hypot(k.vx,k.vy,k.vz)<.12)&&![...g.sfx.loops.keys()].some(k=>k.startsWith('rally-engine-'));
 },null,{timeout:12000});
 const finishAudio=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts;return {state:g.sfx.ctx?.state,engineFrames:window.cartReview.engineFrames,engineLoops:[...g.sfx.loops.keys()].filter(k=>k.startsWith('rally-engine-')),occupiedMotion:c.fleet.physics.carts.flatMap((k,i)=>c.driverForCart[i]<0?[]:[Math.hypot(k.vx,k.vy,k.vz)])};});
 assert.equal(finishAudio.state,'running');assert.ok(finishAudio.engineFrames>100,'The race actually played moving engine audio');assert.deepEqual(finishAudio.engineLoops,[],'Finished stationary carts are silent');
 const result=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {level:g.getCurrentLevel().id,stamp:document.querySelector('.hud-build')?.textContent,...window.cartReview,checkpoints:g.getLevel().checkpoints.map(cp=>cp.active),hud:r.hud(),carts:r.carts.fleet.stats,riders:r.riders.map(v=>({id:v.id,finish:v.finish,falls:v.falls,s:v.progress,cart:r.carts.cartForRacer[v.id],pos:v.player.pos.toArray(),speed:v.player.speed}))};});
 await page.screenshot({path:out+'/results.png'});await writeFile(out+'/report.json',JSON.stringify({done,drive,steering,braking,result,finishAudio,errors},null,2));
 if(preview)await writeFile(out+'/preview.jpg',Buffer.from(preview.split(',')[1],'base64'));console.log(JSON.stringify({done,riders:result.riders,errors}));
 assert.ok(done);assert.deepEqual(errors,[]);assert.match(result.stamp,/Codex\/sol fork/);assert.ok(result.carts.count>8);assert.equal(result.checkpoints.length,0,'Race levels have no checkpoint objects');
 await page.evaluate(()=>window.stopCartPilot());
 // A losing race correctly keeps the trial locked. Use an explicit test
 // fixture for solo recovery without manufacturing a campaign win.
 const trial=page.getByRole('button',{name:'TIME TRIAL',exact:true});
 if(await trial.count())await trial.click();
 else await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',0);});
 await page.waitForFunction(()=>window.__game.getSkateRace().mode==='time-trial'&&window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.cartForRacer.length),1);
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),at=r.course.length*.35;g.player.resetRacePosition(g.getLevel(),r.course.support(g.getLevel(),at),r.course.tangent(at));});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
 await page.waitForTimeout(6500);
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().riders[0].falls),0,'Tall stadium banks keep steering mistakes inside');
 await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');
 // Coasting is intentionally slow; use the real brake before inspecting support.
 await page.keyboard.down('KeyQ');
 await page.waitForFunction(()=>window.__game.player.grounded&&Math.abs(window.__game.player.speed)<1,null,{timeout:10000});
 await page.keyboard.up('KeyQ');
 const recovery=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {pos:g.player.pos.toArray(),anchor:r.riders[0].anchor.toArray(),falls:r.riders[0].falls,clock:g.player.ttTime,supported:r.carts.ground(g.player.pos.x,g.player.pos.z).safe};});
 assert.ok(recovery.supported&&recovery.clock>0);await page.screenshot({path:out+'/recovery.png'});
 await writeFile(out+'/report.json',JSON.stringify({done,drive,steering,braking,result,finishAudio,recovery,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS keyboard drive/steer/brake/coast, complete race, silent parked finish, trial restart and supported stadium containment');
 }
}catch(error){console.log('BROWSER ERRORS',JSON.stringify(errors));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await browser.close();}
