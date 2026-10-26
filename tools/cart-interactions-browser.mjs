import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.CART_INTERACTION_OUTPUT??'/private/tmp/cart-interactions-browser',full=!!process.env.CART_FULL;
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block',...(process.env.CART_VIDEO?{recordVideo:{dir:out,size:{width:1600,height:900}}}:{})}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts;c.drive=()=>({moveX:0,moveY:0});g.renderQualitySettings.setRegularResolution(null);
  window.stageCart=(index,offset)=>{const q=r.course.sample(45,offset),v=r.carts.fleet.physics.carts[index];Object.assign(v,{x:q.x,y:r.carts.ground(q.x,q.z).height,z:q.z,yaw:0,vx:0,vy:0,vz:0,speed:0,grounded:true});};
  window.stageCart(0,4);window.stageCart(1,0);c.sync();c.present(1);
  window.cartCamera={x:-7,y:4.3,z:6};window.cartFocus=c.fleet.models[0].root.position.clone();
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{if(args[1]===g.camera){g.camera.position.copy(window.cartFocus).add(window.cartCamera);g.camera.fov=46;g.camera.lookAt(window.cartFocus.x-.8,window.cartFocus.y+1.25,window.cartFocus.z);g.camera.updateProjectionMatrix();}return render(...args);};

 });
 await page.keyboard.press('KeyE');await page.waitForTimeout(300);await shot('exit-brace');await page.waitForTimeout(250);await shot('exit-step');
 await page.waitForFunction(()=>!window.__game.getSkateRace().carts.isDriving(0),null,{timeout:5000});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.stats.steals),0);await shot('on-foot');
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts;c.actionCooldown[0]=0;c.locked[1]=0;
  const p=r.riders[0].player,v=c.fleet.physics.carts[1],at=c.exitPoint(1,-1);p.resetRacePosition(r.level,at,p.raceHeading,true);window.cartFocus.set(v.x,v.y,v.z);
 });
 await page.keyboard.press('KeyE');await page.waitForTimeout(280);await shot('steal-grab');await page.waitForTimeout(250);await shot('steal-yank');await page.waitForTimeout(500);await shot('steal-step-in');
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.cartForRacer[0]===1,null,{timeout:6000});await shot('seated');
 // Sample every beat from three native-resolution angles, with simulation frozen.
 await page.evaluate(()=>{const r=window.__game.getSkateRace();window.cartStep=r.step.bind(r);r.step=()=>{};});
 const samples=[];
 for(const [view,offset]of [['front',{x:-5,y:3.3,z:-7}],['quarter',{x:-7,y:4.3,z:6}],['side',{x:-9,y:3.5,z:.5}]]){
  await page.evaluate(offset=>{
   const r=window.__game.getSkateRace();r.start('race',0);r.phase='running';r.elapsed=4;const c=r.carts;c.drive=()=>({moveX:0,moveY:0});window.stageCart(0,7);window.stageCart(1,0);c.sync();c.exit(0,false);c.actionCooldown[0]=0;c.locked[1]=0;c.present(1);
   const p=r.riders[0].player,v=c.fleet.physics.carts[1];p.resetRacePosition(r.level,c.exitPoint(1,-1),p.raceHeading,true);window.cartFocus.set(v.x,v.y,v.z);window.cartCamera=offset;if(!c.interact(0)||c.interactions[0]?.cart!==1)throw new Error('The visual fixture must target the occupied cart');
  },offset);
  let previous=0;
  for(const time of [.12,.32,.56,.78,1.05,1.40,1.82,2.05]){
   await page.evaluate(seconds=>{for(let t=0;t<seconds-1e-8;t+=1/60)window.cartStep(1/60,{moveX:0,moveY:0});},time-previous);previous=time;
   await page.waitForTimeout(40);await shot(`${view}-${time.toFixed(2)}`);
   samples.push(await page.evaluate(()=>{const c=window.__game.getSkateRace().carts,a=c.interactions[0];return {age:a?.age,kind:a?.kind,owner:c.driverForCart[1],actor:a?{hands:[...a.actor.contacts.hands],feet:[...a.actor.contacts.feet]}:null};}));
  }
 }
 // Inspect stepping out and the full passenger-side walk into an empty seat.
 await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;c.actionCooldown[0]=0;c.interact(0);window.cartCamera={x:-7,y:4.3,z:6};});
 let elapsed=0;
 for(const time of [.12,.32,.55,.80,1.08]){await page.evaluate(seconds=>{for(let t=0;t<seconds-1e-8;t+=1/60)window.cartStep(1/60,{moveX:0,moveY:0});},time-elapsed);elapsed=time;await page.waitForTimeout(40);await shot(`exit-${time.toFixed(2)}`);}
 const duration=await page.evaluate(()=>{const r=window.__game.getSkateRace(),c=r.carts,p=r.riders[0].player;p.resetRacePosition(r.level,c.exitPoint(1,1),p.raceHeading,true);c.locked[1]=0;c.actionCooldown[0]=0;if(!c.interact(0))throw new Error('Passenger-side entry failed');return c.interactions[0].duration;});
 elapsed=0;for(const portion of [.15,.30,.45,.60,.80,1.02]){const time=duration*portion;await page.evaluate(seconds=>{for(let t=0;t<seconds-1e-8;t+=1/60)window.cartStep(1/60,{moveX:0,moveY:0});},time-elapsed);elapsed=time;await page.waitForTimeout(40);await shot(`approach-${portion.toFixed(2)}`);}
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(100);await shot('normal-720p');
 const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {stamp:document.querySelector('.hud-build')?.textContent,stats:r.carts.stats,owner:r.carts.driverForCart[1],glError:g.renderer.getContext().getError()};});
 await writeFile(`${out}/report.json`,JSON.stringify({full,report,samples,errors},null,2));
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.owner,0);assert.equal(report.glError,0);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({full,report,samples,errors},null,2));console.log('PASS',JSON.stringify(report));
}catch(e){await shot('failure');console.log('ERRORS',JSON.stringify(errors));throw e;}finally{await context.close();await browser.close();}
