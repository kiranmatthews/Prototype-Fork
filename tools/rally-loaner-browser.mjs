import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5498';
const out=process.env.RALLY_LOANER_OUTPUT??'/private/tmp/rally-loaner-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',42);});
 await page.waitForFunction(()=>{const r=window.__game.getSkateRace();return r.phase==='running'&&r.elapsed>5;},null,{timeout:30000});
 const opening=await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;return {count:c.count,delivered:c.stats.loanerDrops,landed:c.stats.loanerLandings,active:c.drops.activeCount,health:c.fleet.physics.carts.slice(1).map(k=>k.health)};});
 assert.equal(opening.count,1);assert.equal(opening.delivered,opening.landed);assert.equal(opening.active,0);assert.ok(opening.health.every(h=>h===1));
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts,w=c.fleet.physics,step=r.step.bind(r),render=g.renderer.render.bind(g.renderer),shot=g.sfx.playManaged.bind(g.sfx);
  const q=window.loanerReview={initial:c.stats.loanerDrops,target:-1,frames:[],sounds:[],paused:false,captureAt:null,camera:false,angle:0};
  g.sfx.playManaged=(id,name,gain,rate)=>{const stop=shot(id,name,gain,rate);if(name==='kartLanding')q.sounds.push({id,name,gain,rate,started:!!stop});return stop;};
  r.step=(dt,input)=>{
   if(q.paused)return;step(dt,input);
   if(q.target<0&&c.stats.loanerDrops>q.initial)q.target=w.carts.findIndex((_,i)=>c.drops.isDescending(i));
   if(q.target<0)return;
   const k=w.carts[q.target],d=c.drops.drops.get(q.target);
   q.frames.push({age:d?.age??null,released:d?.released??null,grounded:k.grounded,health:k.health,height:k.y-c.ground(k.x,k.z).height,rolls:k.rolls,compression:k.landingCompression,loops:[...g.sfx.loops.keys()]});
   if(q.captureAt==='descent'&&d?.age>=.65&&d.released<0||q.captureAt==='low'&&d?.age>=2.2&&d.released<0||q.captureAt==='touchdown'&&d?.released===0||q.captureAt==='collapse'&&d?.released>=.8||q.captureAt==='clear'&&!d)q.paused=true;
  };
  g.renderer.render=(scene,camera)=>{
   if(q.camera&&q.target>=0&&scene===g.scene&&camera===g.camera){
    const k=w.carts[q.target],floor=c.ground(k.x,k.z).height,angle=k.yaw+q.angle;
    camera.position.set(k.x+Math.sin(angle)*24,floor+15,k.z+Math.cos(angle)*24);camera.fov=55;camera.lookAt(k.x,floor+10,k.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();c.updateView(camera);
   }
   return render(scene,camera);
  };
  c.exit(0,false);c.wreck(0);const p=r.course.support(g.getLevel(),900);
  g.player.resetRacePosition(g.getLevel(),p,r.course.tangent(900),true);r.riders[0].progress=r.riders[0].anchorProgress=900;r.riders[0].anchor.copy(p);c.actionCooldown[0]=0;
  for(let i=1;i<w.carts.length;i++)c.locked[i]=120;
  g.renderQualitySettings.setRegularResolution(null);
 });
 // First pass is an uninterrupted natural rescue, with real simulation and audio.
 await page.waitForFunction(()=>window.loanerReview.target>0,null,{timeout:30000});
 const airborne=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts,q=window.loanerReview;return {hud:c.hud(),canTake:c.canTake(0,q.target),height:c.fleet.physics.carts[q.target].y-c.ground(c.fleet.physics.carts[q.target].x,c.fleet.physics.carts[q.target].z).height};});
 assert.equal(airborne.canTake,false);assert.equal(airborne.hud.actionReady,false);assert.match(airborne.hud.target,/INCOMING/);
 await page.keyboard.press('KeyE');assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.isDriving(0)),false);
 await page.waitForFunction(()=>{const q=window.loanerReview,c=window.__game.getSkateRace().carts;return q.target>0&&c.fleet.physics.carts[q.target].grounded&&!c.drops.drops.has(q.target);},null,{timeout:15000});
 const delivery=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts,q=window.loanerReview;return {target:q.target,dispatched:c.stats.loanerDrops-q.initial,landed:c.stats.loanerLandings-q.initial,frames:q.frames,sounds:q.sounds,audioState:g.sfx.ctx?.state,falls:g.getSkateRace().riders[0].falls};});
 assert.equal(delivery.dispatched,1);assert.equal(delivery.landed,1);assert.equal(delivery.falls,0);assert.equal(delivery.audioState,'running');assert.ok(delivery.frames.some(f=>f.compression>.06));assert.ok(delivery.frames.every(f=>f.health===1&&f.rolls===0&&!f.loops.some(k=>k.startsWith('rally-engine-'))));assert.ok(delivery.sounds.some(s=>s.id===`rally-landing-${delivery.target}`&&s.started&&s.gain>.04));
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),c=r.carts;g.player.resetRacePosition(g.getLevel(),c.exitPoint(window.loanerReview.target,-1),r.course.tangent(r.riders[0].progress),true);c.actionCooldown[0]=0;});
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__game.getSkateRace().carts.isAnimating(0),null,{timeout:5000});
 await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return c.cartForRacer[0]===window.loanerReview.target&&!c.isAnimating(0);},null,{timeout:10000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.speed>8,null,{timeout:6000});await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');await page.keyboard.down('KeyQ');await page.waitForFunction(()=>Math.abs(window.__game.player.speed)<.3,null,{timeout:6000});await page.keyboard.up('KeyQ');
 // Second pass pauses only the actual simulation for native/normal visual review.
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts,q=window.loanerReview,w=c.fleet.physics;
  c.exit(0,false);const index=q.target===2?3:2,home={...c.homes[q.target]};
  Object.assign(q,{target:index,frames:[],paused:false,captureAt:'descent',camera:true,angle:.68});
  c.dropLoaner(index,home);
 });
 const views=[];
 for(const stage of ['descent','low','touchdown','collapse','clear']){
  await page.evaluate(stage=>{const q=window.loanerReview;q.captureAt=stage;q.paused=false;},stage);
  await page.waitForFunction(()=>window.loanerReview.paused,null,{timeout:12000});
  await page.screenshot({path:`${out}/${stage}-native.png`});
  views.push(await page.evaluate(stage=>{const g=window.__game,c=g.getSkateRace().carts,q=window.loanerReview,d=c.drops.drops.get(q.target);return {stage,age:d?.age,released:d?.released,canopyScale:d?.cloth.scale.toArray(),cords:d?[...d.cords.instanceMatrix.array].every(Number.isFinite):true,health:c.fleet.physics.carts[q.target].health,drawBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],gl:g.renderer.getContext().getError()};},stage));
  if(stage==='descent'){
   await page.evaluate(()=>{window.loanerReview.angle=-.85;});await page.waitForTimeout(100);await page.screenshot({path:out+'/descent-reverse-native.png'});
   await page.evaluate(()=>{window.loanerReview.angle=.68;window.__game.renderQualitySettings.setRegularResolution(720);});await page.waitForTimeout(150);await page.screenshot({path:out+'/descent-normal.png'});
   await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  }
 }
 assert.ok(views.every(v=>v.cords&&v.health===1&&v.gl===0));assert.deepEqual(errors,[]);
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,full:!!process.env.CART_FULL,stamp,opening,airborne,delivery,keyboardEntryAndDrive:true,views,errors},null,2)+'\n');
 console.log('PASS real rescue descent, blocked airborne entry, local touchdown sound, keyboard entry/drive, native and normal canopy review',JSON.stringify({opening,delivery:{target:delivery.target,dispatched:delivery.dispatched,landed:delivery.landed,sounds:delivery.sounds,falls:delivery.falls},views,errors}));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log('BROWSER ERRORS',errors);console.log(await page.evaluate(()=>({review:window.loanerReview,race:window.__game?.getSkateRace()?.phase,hud:window.__game?.getSkateRace()?.carts?.hud()})).catch(()=>null));throw e;}finally{await browser.close();}
