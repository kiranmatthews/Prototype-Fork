import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497',full=!!process.env.CART_FULL;
const out=process.env.RALLY_EXTENSION_OUTPUT??'/private/tmp/rally-extension-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r);window.liveGrid={frames:[]};
  r.step=(dt,input)=>{step(dt,input);if(r.phase==='countdown'){const c=r.carts;window.liveGrid.frames.push({remaining:r.countdown,world:c.fleet.physics.time,crowd:c.crowd.time.value,height:c.fleet.physics.carts[r.count].y,engines:[...g.sfx.loops].filter(([key])=>key.startsWith('rally-engine-')).map(([key,v])=>({key,rate:v.src.playbackRate.value,gain:v.gain.gain.value})),speed:g.player.speed,elapsed:r.elapsed});}};
  g.renderQualitySettings.setRegularResolution(null);
 });
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>{const r=window.__game.getSkateRace();return r.phase==='countdown'&&r.countdown<1.2;},null,{timeout:30000});
 await page.screenshot({path:out+'/countdown-native.png'});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 const grid=await page.evaluate(()=>window.liveGrid.frames);assert.ok(grid.length>10);assert.ok(grid.at(-1).height<grid[0].height-10);assert.ok(grid.some(f=>f.engines.length===8));assert.ok(grid.every(f=>f.elapsed===0&&Math.abs(f.speed)<.1));assert.ok(grid.at(-1).crowd>2.5);
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',42);});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),update=g.input.update.bind(g.input);let sample={};
  window.extensionReview={paused:false,target:3240,shots:[],frames:0};
  const q=window.extensionReview;
  window.placeRally=(station)=>{
   const at=r.course.project(g.player.pos.clone().set(0,25,-station)).s,p=r.course.sample(at),f=r.course.tangent(at),c=r.carts,w=c.fleet.physics;
   Object.assign(w.spawns[0],{x:p.x,z:p.z,yaw:Math.atan2(-f.x,-f.z)});w.reset(0);c.sync();
   const rider=r.riders[0];rider.progress=rider.previousProgress=rider.anchorProgress=at;rider.anchor.copy(g.player.pos);rider.finish=null;r.phase='running';q.paused=false;
  };
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;return {id:'Rally extension validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>{const held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinPressed,3:!!sample.grindPressed,6:!!sample.itemPressed};return {pressed:!!held[i],value:held[i]?1:0};})};};
  r.step=(dt,input)=>{if(q.paused)return;sample=r.phase==='running'?r.drive(0):{};update();step(dt,input);q.frames++;if(q.target&&-g.player.pos.z>=q.target){q.paused=true;q.target=null;}};
  window.placeRally(3160);
 });
 const views=[];
 for(const [name,station]of [['entrance',3240],['underground',3300],['exit',3404],['launch',3473],['airborne',3500],['landing',3560]]){
  await page.evaluate(s=>{Object.assign(window.extensionReview,{target:s,paused:false});},station);
  await page.waitForFunction(()=>window.extensionReview.paused,null,{timeout:30000});
  await page.waitForTimeout(250);await page.screenshot({path:out+`/${name}-native.png`});
  views.push(await page.evaluate(name=>{const g=window.__game,r=g.getSkateRace(),k=r.carts.fleet.physics.carts[r.carts.cartForRacer[0]];return {name,position:g.player.pos.toArray(),grounded:k.grounded,gap:k.y-r.carts.ground(k.x,k.z).height,rolls:k.rolls,falls:r.riders[0].falls,camera:g.camera.position.toArray(),buffer:[g.renderer.domElement.width,g.renderer.domElement.height],grinds:g.getLevel().grindRails.length,gl:g.renderer.getContext().getError()};},name));
  if(name==='underground'||name==='airborne'){
   await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(250);await page.screenshot({path:out+`/${name}-normal.png`});await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  }
 }
 await page.evaluate(()=>{window.extensionReview.target=null;window.placeRally(4605);});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='finished',null,{timeout:15000});await page.waitForTimeout(1500);
 await page.screenshot({path:out+'/finish-native.png'});
 const finish=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {phase:r.phase,camera:g.camera.position.toArray(),trackOffset:r.course.project(g.camera.position).offset,falls:r.riders[0].falls,grinds:g.getLevel().grindRails.length,engineLoops:[...g.sfx.loops.keys()].filter(k=>k.startsWith('rally-engine-'))};});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(250);await page.screenshot({path:out+'/finish-normal.png'});
 assert.ok(views.every(v=>v.rolls===0&&v.falls===0&&v.grinds===0&&v.gl===0));assert.ok(views.find(v=>v.name==='airborne').gap>9);assert.ok(Math.abs(finish.trackOffset)<2);assert.equal(finish.falls,0);assert.equal(finish.grinds,0);assert.deepEqual(errors,[]);
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,full,stamp,grid,views,finish,errors},null,2)+'\n');console.log('PASS',JSON.stringify({full,gridFrames:grid.length,views,finish,errors}));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log('BROWSER ERRORS',errors);throw e;}finally{await browser.close();}
