import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2],out=process.env.CART_FIRE_OUTPUT??'/private/tmp/cart-fire-review',full=!!process.env.CART_FULL;
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
 await page.evaluate(()=>{const g=window.__game;g.getSkateRace().canStartTimeTrial=()=>true;g.getSkateRace().start('time-trial',0);g.getSkateRace().phase='running';const c=g.getSkateRace().carts;c.drive=()=>({moveX:0,moveY:0});g.renderQualitySettings.setRegularResolution(null);});
 await page.waitForTimeout(1200);await page.keyboard.press('KeyF');await page.waitForTimeout(220);await page.screenshot({path:`${out}/jets-driving.png`});
 await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts,render=g.renderer.render.bind(g.renderer);window.fireView={x:8,y:5,z:10};g.renderer.render=(...a)=>{if(a[1]===g.camera){const p=c.fleet.models[0].root.position;g.camera.position.copy(p).add(window.fireView);g.camera.fov=47;g.camera.lookAt(p.x,p.y+1.3,p.z);g.camera.updateProjectionMatrix();}return render(...a);};});
 await page.waitForTimeout(1400);
 const sequence=[];
 for(const [name,view]of [['quarter',{x:8,y:5,z:10}],['end-on',{x:11,y:3,z:3}]]){
  await page.evaluate(view=>{window.fireView=view;const c=window.__game.getSkateRace().carts;c.thrustTime[0]=1.7;},view);
  for(let i=0;i<3;i++){await page.waitForTimeout(110);await page.screenshot({path:`${out}/jets-${name}-${i}.png`});}
  await page.waitForTimeout(1400);
  sequence.push(await page.evaluate(()=>{const e=window.__game.getSkateRace().carts.effects;return {jets:e.jets.count,source:e.jets.diagnostics.source,emitted:e.jets.diagnostics.emitted,embers:e.embers.count};}));
 }
 await page.evaluate(()=>{window.fireView={x:6,y:3.3,z:6};const c=window.__game.getSkateRace().carts;c.fleet.physics.carts[0].health=0;c.wreck(0);});
 await page.waitForTimeout(1600);
 for(let i=0;i<3;i++){await page.screenshot({path:`${out}/wreck-${i}.png`});await page.waitForTimeout(140);}
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(180);await page.screenshot({path:`${out}/wreck-normal.png`});
 const burning=await page.evaluate(()=>{const g=window.__game,e=g.getSkateRace().carts.effects;return {flames:e.flames.count,embers:e.embers.count,gouraud:e.flames.material.userData.gouraud,stamp:document.querySelector('.hud-build')?.textContent,frame:g.getRenderFrameStats(),glError:g.renderer.getContext().getError()};});
 assert.match(burning.stamp,/Codex\/sol fork/);assert.ok(burning.flames>20);assert.ok(burning.embers>0);assert.equal(burning.glError,0);assert.ok(sequence.every(s=>s.jets===0),'emitted tail finishes after cutoff');assert.ok(sequence.every(s=>s.source==='Temple of Embers'),'All six mouths use the shared Temple flame renderer');
 await page.waitForTimeout(11000);await page.screenshot({path:`${out}/husk.png`});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().carts.effects.flames.count),0);
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({full,sequence,burning,errors},null,2));console.log('PASS',JSON.stringify({full,sequence,burning,errors}));
}catch(e){await page.screenshot({path:`${out}/failure.png`});console.log('ERRORS',JSON.stringify(errors));throw e;}finally{await browser.close();}
