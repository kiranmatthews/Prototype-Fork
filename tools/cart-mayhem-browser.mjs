import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5491',full=!!process.env.CART_FULL;
const out=process.env.CART_BROWSER_OUTPUT??`/private/tmp/cart-mayhem-${full?'full':'lite'}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const shot=async n=>page.screenshot({path:`${out}/${n}.png`});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await shot('grid');console.log('READY');
 const controls=await page.locator('[data-cart-controls]').textContent();assert.match(controls,/Accelerate/);assert.match(controls,/Steal/);
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 // Park rivals only for isolated physical-button checks; the native route tests run the full AI field.
 await page.evaluate(()=>{const r=window.__game.getSkateRace(),c=r.carts;c.drive=()=>({moveX:0,moveY:0});});
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;return c.fleet.physics.inputs[c.cartForRacer[0]].throttle;}),0,'stick alone never applies throttle');await page.keyboard.down('Space');await page.waitForTimeout(1400);await page.keyboard.up('ArrowUp');
 assert.ok(await page.evaluate(()=>window.__game.player.speed)>5);await page.keyboard.up('Space');await page.waitForTimeout(1800);
 await page.keyboard.down('KeyQ');await page.waitForTimeout(1000);await page.keyboard.up('KeyQ');
 const hop=await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].airborneCount);
 await page.keyboard.down('Space');await page.waitForTimeout(600);
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].airborneCount),hop);
 await page.keyboard.up('Space');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.carts[0].airborneCount),hop,'releasing X does not jump');await shot('release-coast');
 await page.waitForTimeout(1800);
 await page.keyboard.down('KeyT');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.fleet.physics.inputs[0].handbrake),true);await page.keyboard.up('KeyT');
 await page.keyboard.press('KeyF');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.stats.thrusters),1);await shot('side-flames');await page.waitForTimeout(750); // Let the active burst end before placing a theft target inside its damage volume.
 await page.evaluate(()=>{const r=window.__game.getSkateRace(),c=r.carts,a=c.fleet.physics.carts[0],b=c.fleet.physics.carts[1];Object.assign(b,{x:a.x+3.2,y:a.y,z:a.z,vx:0,vz:0,health:.55,tumbling:false});c.sync();});
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__game.getSkateRace().carts.cartForRacer[0]===1,null,{timeout:8000});await shot('stolen');
 await page.evaluate(()=>{const c=window.__game.getSkateRace().carts,v=c.fleet.physics.carts[c.cartForRacer[0]];v.health=.32;});await page.waitForTimeout(1800);await shot('damaged-smoke');
 await page.evaluate(()=>{const r=window.__game.getSkateRace(),c=r.carts,w=c.fleet.physics,i=c.cartForRacer[0],v=w.carts[i];for(let n=0;n<32;n++){v.cooldown=0;w.damage(i,18,v.x,v.z-1);}});
 await page.waitForFunction(()=>!window.__game.getSkateRace().carts.isDriving(0),null,{timeout:8000});await page.waitForTimeout(700);await shot('burnout');
 await page.waitForTimeout(14000);await shot('burnt-husk');assert.equal(await page.locator('[data-cart-health-bar], [data-cart-health]').count(),0,'no damage meter');assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.effects.flames.count),0,'fire leaves a burnt husk');
 const foot=await page.evaluate(()=>window.__game.player.pos.toArray());await page.keyboard.down('ArrowUp');await page.waitForTimeout(1000);await page.keyboard.up('ArrowUp');
 const moved=await page.evaluate(()=>({pos:window.__game.player.pos.toArray(),board:window.__game.player.boardRolling}));assert.ok(Math.hypot(...moved.pos.map((v,i)=>v-foot[i]))>1);assert.equal(moved.board,false);
 await page.evaluate(()=>{const r=window.__game.getSkateRace(),c=r.carts,v=c.fleet.physics.carts[c.count],p=r.riders[0].player;p.resetRacePosition(r.level,p.pos.clone().set(v.x+2.7,v.y+.1,v.z),r.course.tangent(r.course.project(p.pos).s),true);c.actionCooldown[0]=0;});
 await page.waitForTimeout(100);await shot('loaner');await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__game.getSkateRace().carts.isDriving(0),null,{timeout:8000});
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.riders[0].item='green-shell';});
 await page.keyboard.press('KeyI');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>window.__game.getSkateRace().projectiles.length),3);await shot('coconut-volley');
 if(full){await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));await page.waitForTimeout(1200);await shot('native-max');}
 const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {stamp:document.querySelector('.hud-build')?.textContent,stats:r.carts.stats,hud:r.hud().cart,frame:g.frameStats,health:r.carts.fleet.physics.carts.map(v=>v.health),owners:r.carts.cartForRacer};});
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.stats.wrecks,1);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({full,controls,report,errors},null,2));console.log('PASS browser physical controls / theft / burnout / foot movement / loaner / volley',JSON.stringify(report.stats));
}catch(e){await shot('failure');console.log('ERRORS',JSON.stringify(errors));throw e;}finally{await browser.close();}
