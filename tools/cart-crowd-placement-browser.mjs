import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE??'playwright');
const b=await build({entryPoints:['src/levels/cart-stadium-layout.ts'],bundle:true,format:'esm',write:false}),layout=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const out=process.env.CART_CROWD_OUTPUT??'/private/tmp/cart-crowd-placement',base=process.env.CART_BASE??'http://127.0.0.1:5497';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running'&&window.__game.getSkateRace().elapsed>2);
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();r.step=()=>{};g.renderQualitySettings.setRegularResolution(null);window.crowdCamera=g.camera.clone();r.carts.crowd.time.value=5;const render=g.renderer.render.bind(g.renderer);g.renderer.render=(s,c)=>render(s,c===g.camera?window.crowdCamera:c);});
 for(const resolution of [720,null]){
  await page.evaluate(resolution=>{const g=window.__game,c=window.crowdCamera;g.renderQualitySettings.setRegularResolution(resolution);c.position.set(67.1179,37.7341,-338.0385);c.lookAt(64.73,31,-364.24);c.updateProjectionMatrix();c.updateMatrixWorld();},resolution);
  await page.waitForTimeout(350);await page.screenshot({path:`${out}/replay-view-${resolution??'native'}.png`});
 }
 for(const s of [234,259,425,745,1275]){
  for(const side of [-1,1]){
   const p=layout.stadiumPoint(s,side*34,18),f=layout.cartRallyFrame(s),centre=layout.stadiumPoint(s,0,5);
   await page.evaluate(({p,centre})=>{const c=window.crowdCamera;c.position.set(centre[0],p[1]+3,centre[2]+12);c.lookAt(...p);c.fov=55;c.aspect=16/9;c.updateProjectionMatrix();c.updateMatrixWorld();},{p,centre});
   await page.waitForTimeout(300);await page.screenshot({path:`${out}/stand-${s}-${side}-native.png`});
  }
 }
 const report=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts.crowd;return {stamp:document.querySelector('.hud-build')?.textContent,spectators:c.count,sections:c.sections.length,glError:g.renderer.getContext().getError(),resolution:g.renderQualitySettings.regularResolution,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],frame:g.getRenderFrameStats()};});
 assert.equal(report.glError,0);assert.equal(report.spectators,65160);assert.equal(report.sections,196);assert.equal(report.resolution,'max');assert.deepEqual(report.canvas,process.env.CART_LITE?[800,450]:[1600,900]);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors}));
}finally{await browser.close();}
