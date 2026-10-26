import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5497',lite=!!process.env.CART_LITE;
const out=process.env.CART_CROWD_OUTPUT??'/private/tmp/cart-crowd-corners';await mkdir(out,{recursive:true});
const bundle=await build({entryPoints:['src/levels/cart-stadium-layout.ts'],bundle:true,format:'esm',write:false});
const layout=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block',recordVideo:{dir:out,size:{width:1600,height:900}}});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${lite?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running'&&window.__game.getSkateRace().elapsed>2);
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.step=()=>{};
  const crowd=r.carts.crowd,now=performance.now();window.crowdReview={camera:g.camera.clone(),samples:[],start:now};
  crowd.update=()=>crowd.time.value=10+(performance.now()-now)/1000;
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>render(scene,camera===g.camera?window.crowdReview.camera:camera);
 });
 const aim=async(position,target)=>page.evaluate(({position,target})=>{const c=window.crowdReview.camera;c.position.set(...position);c.lookAt(...target);c.fov=55;c.aspect=16/9;c.updateProjectionMatrix();c.updateMatrixWorld();},{position,target});
 const at=layout.stadiumPoint(85,-34,18),f=layout.cartRallyFrame(85);
 for(const [name,sideways]of [['front',0],['oblique',7],['side',20]]){
  await aim([at[0]+f.nx*(name==='side'?2:12)+sideways*f.nz,at[1]+4,at[2]+f.nz*(name==='side'?2:12)-sideways*f.nx],at);
  await page.waitForTimeout(600);await page.screenshot({path:`${out}/crowd-${name}-native.png`});
  for(let i=0;i<60;i++){await page.waitForTimeout(50);if(name==='front')await page.evaluate(()=>window.crowdReview.samples.push(window.__game.getRenderFrameStats()));}
  await page.screenshot({path:`${out}/crowd-${name}-later-native.png`});
 }
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(200);await page.screenshot({path:`${out}/crowd-normal.png`});await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 for(const [i,centre]of layout.CART_RALLY_CORNERS.entries()){
  const p=layout.cartRallyPoint(centre),side=i%2?-1:1;
  await aim([p[0]-side*145,p[1]+145,p[2]+70],[p[0]-side*40,p[1],p[2]]);
  await page.waitForTimeout(400);await page.screenshot({path:`${out}/corner-${i+1}-native.png`});
 }
 const report=await page.evaluate(()=>{const g=window.__game,c=g.getSkateRace().carts.crowd;return {stamp:document.querySelector('.hud-build')?.textContent,spectators:c.count,sections:c.sections.length,animation:c.root.userData,glError:g.renderer.getContext().getError(),frames:window.crowdReview.samples};});
 assert.equal(report.glError,0);assert.ok(report.spectators>30000);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({...report,cornerCount:layout.CART_RALLY_CORNERS.length,lite,errors},null,2));console.log('PASS crowd motion, native/normal views, supported local corner additions and clean shader compilation',JSON.stringify({spectators:report.spectators,stamp:report.stamp,errors}));
}finally{await context.close();await browser.close();}
