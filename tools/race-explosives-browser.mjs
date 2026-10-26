import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',full=!!process.env.RACE_FULL,out=process.env.RACE_OUTPUT??'/private/tmp/race-explosives-browser';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),results=[];
try{for(const id of (process.env.RACE_LEVELS??'slipstream-race,country-club,coconut-cart-rally').split(',')){
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(`${base}/?playtest&level=${id}${full?'':'&lite'}`,{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.keyboard.down('Space');await page.waitForTimeout(1000);await page.keyboard.up('Space');
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);window.testStep=r.step.bind(r);r.step=(dt,input)=>{if(input.itemPressed)window.testStep(dt,input);};r.drive=()=>({moveX:0,moveY:0});
  window.place=(id,s,offset=0)=>{const rider=r.riders[id],p=r.course.sample(s,offset),at=r.course.supportAt(r.level,p,p.clone(),15,40)||p,heading=r.course.tangent(s);rider.player.resetRacePosition(r.level,at,heading);rider.player.invulnTimer=0;rider.knockGrace=0;rider.itemCooldown=999;rider.progress=rider.anchorProgress=s;rider.anchor.copy(at);if(r.carts){const c=r.carts.fleet.physics.carts[r.carts.cartForRacer[id]];Object.assign(c,{x:at.x,y:at.y,z:at.z,yaw:Math.atan2(-heading.x,-heading.z),vx:0,vy:0,vz:0,speed:0,grounded:true,health:1});r.carts.sync();r.carts.present(1);}};
  window.resetTrap=()=>{r.start('race',0);r.phase='running';r.elapsed=8;if(r.carts)r.carts.drive=()=>({moveX:0,moveY:0});for(let i=0;i<8;i++)window.place(i,50+i*18,i?9:0);};window.resetTrap();
  window.trapCamera={x:7,y:4,z:9};window.trapFocus=r.riders[0].player.pos.clone();
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args)=>{if(args[1]===g.camera){g.camera.position.copy(window.trapFocus).add(window.trapCamera);g.camera.fov=45;g.camera.lookAt(window.trapFocus.x,window.trapFocus.y+.4,window.trapFocus.z);g.camera.updateProjectionMatrix();}return render(...args);};
 });
 const models=[];
 for(const item of ['tnt','nitro']){
  await page.evaluate(item=>{window.resetTrap();const r=window.__game.getSkateRace();r.riders[0].item=item;window.trapFocus.copy(r.riders[0].player.pos);window.trapCamera={x:9,y:6,z:10};},item);await page.waitForTimeout(80);
  await page.screenshot({path:`${out}/${id}-${item}-hud.png`});await page.keyboard.press('KeyI');
  await page.waitForFunction(item=>window.__game.getSkateRace().projectiles.some(p=>p.type===item),item,{timeout:5000});
  const model=await page.evaluate(async item=>{const r=window.__game.getSkateRace(),p=r.projectiles.find(p=>p.type===item);await p.mesh.userData.explosiveBundle.ready;for(let i=0;i<40;i++)window.testStep(1/60,{moveX:0,moveY:0});window.trapFocus.copy(p.mesh.position);window.trapCamera={x:5,y:3,z:6};return {item,loaded:p.mesh.userData.explosiveBundle.loaded,remaining:p.mesh.userData.explosiveBundle.remaining,positions:p.mesh.children[0].children[0].children[0].geometry.attributes.position.count};},item);
  await page.waitForTimeout(100);await page.screenshot({path:`${out}/${id}-${item}-native.png`});assert.equal(model.loaded,true);models.push(model);
  await page.evaluate(item=>{const r=window.__game.getSkateRace(),p=r.projectiles.find(p=>p.type===item);if(item==='tnt')for(let i=0;i<137;i++)window.testStep(1/60,{moveX:0,moveY:0});const s=r.course.project(p.mesh.position).s;window.place(1,s,0);const victim=r.riders[1];victim.player.pos.x=p.mesh.position.x;victim.player.pos.z=p.mesh.position.z;if(r.carts){const v=r.carts.fleet.physics.carts[r.carts.cartForRacer[1]];v.x=p.mesh.position.x;v.z=p.mesh.position.z;r.carts.sync();}for(let i=0;i<(item==='tnt'?7:2);i++)window.testStep(1/60,{moveX:0,moveY:0});},item);
  const hit=await page.evaluate(()=>{const r=window.__game.getSkateRace();return r.carts?r.carts.fleet.physics.carts[r.carts.cartForRacer[1]]?.health<1||!r.carts.isDriving(1):r.riders[1].player.skateCameraBailing;});if(!hit)console.log('Miss diagnostics',await page.evaluate(()=>{const r=window.__game.getSkateRace(),a=r.riders[1];return {position:a.player.pos.toArray(),speed:a.player.speed,invuln:a.player.invulnTimer,grace:a.knockGrace,recovery:a.recovery,state:a.player.state,projectiles:r.projectiles.map(p=>({type:p.type,time:p.time,position:p.mesh.position.toArray()}))};}));assert.ok(hit,`${id} ${item} damages its target`);
  await page.waitForTimeout(60);await page.screenshot({path:`${out}/${id}-${item}-blast.png`});
 }
 const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {stamp:document.querySelector('.hud-build')?.textContent,checkpoints:r.level.checkpoints.length,glError:g.renderer.getContext().getError(),items:r.riders.map(a=>a.item)};});
 assert.equal(report.checkpoints,0);assert.equal(report.glError,0);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 if(full){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(100);await page.screenshot({path:`${out}/${id}-720p.png`});}
 results.push({id,full,models,...report,errors});console.log('PASS',JSON.stringify(results.at(-1)));await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));await page.close();
}}finally{await context.close();await browser.close();}
