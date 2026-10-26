import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.CART_FESTIVAL_OUTPUT??'/private/tmp/cart-festival-browser';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 await page.waitForTimeout(200);
 const grid=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts;return {look:g.getLookDiagnostics(),mud:c.mud.diagnostics,crowd:c.crowd.count,sky:g.getLevel().skyPreset};});
 assert.equal(grid.look.mud.enabled,true);assert.ok(grid.mud.groundClods>3000);assert.equal(grid.mud.bursts,0);assert.equal(grid.crowd,32958);assert.equal(grid.sky,'sunset');
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown');await page.screenshot({path:out+'/festival-grid-native.png'});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',251026);
  const drive=r.carts.drive.bind(r.carts),step=r.step.bind(r);window.festivalReview={pilot:true,landings:0,wasGrounded:true,peakSplats:0,peakClods:0,restore:()=>{r.step=step;}};
  r.step=(dt,input)=>{const q=window.festivalReview;step(dt,q.pilot&&r.phase==='running'?drive(0):{...input,jumpHeld:false,grabHeld:true});const c=r.carts.fleet.physics.carts[0],m=r.carts.mud.diagnostics;
   if(!q.wasGrounded&&c.grounded)q.landings++;q.wasGrounded=c.grounded;q.peakSplats=Math.max(q.peakSplats,m.splats);q.peakClods=Math.max(q.peakClods,m.clods);};
 });
 await page.waitForFunction(()=>window.festivalReview.landings>0&&window.__game.getSkateRace().carts.mud.diagnostics.splats>0,null,{timeout:70000});
 await page.waitForTimeout(180);await page.screenshot({path:out+'/mud-camera-native.png'});
 const motion=await page.evaluate(()=>({review:window.festivalReview,mud:window.__game.getSkateRace().carts.mud.diagnostics,look:window.__game.getLookDiagnostics(),progress:window.__game.getSkateRace().riders[0].progress}));
 assert.ok(motion.review.peakClods>0&&motion.review.peakClods<=192);assert.ok(motion.review.peakSplats>0&&motion.review.peakSplats<=12);assert.ok(motion.progress>100);assert.ok(motion.mud.deposits[0]>0);assert.equal(motion.look.mud.sun[2],1,'Low afternoon sun remains in the driving view');
 await page.evaluate(()=>{window.festivalReview.pilot=false;window.__game.renderQualitySettings.setRegularResolution(720);});await page.waitForTimeout(100);await page.screenshot({path:out+'/mud-camera-normal.png'});
 await page.waitForFunction(()=>window.__game.getSkateRace().carts.mud.diagnostics.splats===0,null,{timeout:14000});
 const cleared=await page.evaluate(()=>window.__game.getSkateRace().carts.mud.diagnostics);assert.equal(cleared.splats,0);
 await page.keyboard.press('Escape');await page.waitForTimeout(150);const paused=await page.evaluate(()=>window.__game.getSkateRace().carts.mud.diagnostics.time);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.mud.diagnostics.time),paused);
 await page.keyboard.press('Escape');await page.evaluate(()=>{window.festivalReview.restore();window.__game.switchLevel('slipstream-race');});
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='slipstream-race'&&!window.__game.gameFlow.blocksGameplay&&!window.__game.getLookDiagnostics().mud.enabled&&window.__game.getLoadingDiagnostics().pending.length===0,null,{timeout:120000});
 const other=await page.evaluate(()=>({look:window.__game.getLookDiagnostics(),gl:window.__game.renderer.getContext().getError(),loading:window.__game.getLoadingDiagnostics(),stamp:document.querySelector('.hud-build')?.textContent,stadiumLights:window.__game.getLevel().stadiumLightingDiagnostics,stadiumRoot:!!window.__game.scene.getObjectByName('Stadium floodlight illumination')}));
 assert.equal(other.gl,0);assert.equal(other.stadiumLights,null);assert.equal(other.stadiumRoot,false,'Rally illumination is removed when switching levels');assert.equal(other.look.mud.enabled,false);assert.deepEqual(other.loading.failed,[]);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({grid,motion,cleared,pauseFrozen:true,other,errors},null,2));console.log('PASS festival browser',JSON.stringify({grid:grid.mud,motion,cleared,other}));
}catch(error){console.log('ERRORS',errors);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}finally{await context.close();await browser.close();}
