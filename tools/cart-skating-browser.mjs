import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497';
const out=process.env.CART_SKATING_OUTPUT??'/private/tmp/cart-skating-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.screenshot({path:out+'/grid.png'});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 // Let the UI's queued start input be consumed before replacing it with a solo fixture.
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',42);g.renderQualitySettings.setRegularResolution(null);});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().count),1);
 await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return !c.isDriving(0)&&!c.isAnimating(0);},null,{timeout:8000});
 assert.equal(await page.evaluate(()=>window.__game.player.boardRolling),false);
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
 await page.waitForFunction(()=>{const g=window.__game;return g.player.boardRolling&&g.player.speed>14&&g.sfx.loops.has('skate');},null,{timeout:12000});
 const skating=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts;return {board:g.player.boardRolling,speed:g.player.speed,pos:g.player.pos.toArray(),driving:c.isDriving(0),loops:[...g.sfx.loops.keys()]};});
 assert.equal(skating.driving,false);assert.ok(!skating.loops.some(k=>k.startsWith('rally-engine-')));await page.screenshot({path:out+'/skating-native.png'});
 await page.keyboard.up('Space');
 await page.waitForFunction(()=>!window.__game.player.grounded&&window.__game.player.state==='air',null,{timeout:4000});
 const ollie=await page.evaluate(()=>({state:window.__game.player.state,vy:window.__game.player.vVel,speed:window.__game.player.speed}));
 await page.screenshot({path:out+'/ollie.png'});await page.keyboard.up('ArrowUp');await page.keyboard.down('KeyQ');
 await page.waitForFunction(()=>window.__game.player.grounded&&Math.abs(window.__game.player.speed)<.3,null,{timeout:10000});await page.keyboard.up('KeyQ');
 // Place a slow skating approach beside the original parked kart. The device
 // press, entry animation, ownership change and subsequent drive are real.
 await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts;g.player.resetRacePosition(g.getLevel(),c.exitPoint(0,-1),g.player.raceHeading,false);g.player.speed=2;c.actionCooldown[0]=0;c.locked[0]=0;});
 await page.keyboard.press('KeyE');
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.isAnimating(0),null,{timeout:5000});
 const entering=await page.evaluate(()=>{const g=window.__game;return {board:g.player.vehicleVisualRoot.getObjectByName('skateboard-scale-compensation').visible,loops:[...g.sfx.loops.keys()]};});
 assert.equal(entering.board,false);assert.ok(!entering.loops.includes('skate'));await page.screenshot({path:out+'/entry.png'});
 await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return c.isDriving(0)&&!c.isAnimating(0);},null,{timeout:8000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
 await page.waitForFunction(()=>{const g=window.__game,c=g.getSkateRace().carts;return g.player.speed>14&&g.sfx.loops.has(`rally-engine-${c.cartForRacer[0]}`);},null,{timeout:10000});
 const driving=await page.evaluate(()=>{const g=window.__game;return {speed:g.player.speed,loops:[...g.sfx.loops.keys()],physics:{topSpeed:g.getSkateRace().carts.fleet.physics.topSpeed,speedLimit:g.getSkateRace().carts.fleet.physics.speedLimit}};});
 assert.ok(!driving.loops.includes('skate'));await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');await page.keyboard.down('KeyQ');
 await page.waitForFunction(()=>Math.abs(window.__game.player.speed)<.12&&!window.__game.sfx.loops.has('rally-engine-0'),null,{timeout:10000});await page.keyboard.up('KeyQ');
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return !c.isDriving(0)&&!c.isAnimating(0);},null,{timeout:8000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.boardRolling,null,{timeout:8000});await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
 assert.deepEqual(errors,[]);
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,full:!!process.env.CART_FULL,stamp,skating,ollie,entering,driving,skatingAfterReentry:true,errors},null,2)+'\n');
 console.log('PASS native skate mount/ollie/audio, animated stowing/entry, kart audio, stationary silence, repeat exit/skate',JSON.stringify({skating,ollie,entering,driving}));
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log('BROWSER ERRORS',errors);throw error;}finally{await browser.close();}
