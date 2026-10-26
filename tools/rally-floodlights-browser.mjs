import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright'),base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.RALLY_LIGHT_OUTPUT??'/private/tmp/rally-light-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`);await page.waitForFunction(()=>window.__game?.getSkateRace().carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=10;r.step=()=>{};
  const render=g.renderer.render.bind(g.renderer),lighting=g.getLevel().stadiumLighting;window.lightReview={off:false,lighting};
  g.renderer.render=(scene,camera)=>{if(scene===g.scene){g.getLevel().standingWaterClock.value=10;r.carts.crowd.update(10);if(window.lightReview.off)for(const l of lighting.root.children)if(l.isLight)l.intensity=0;}return render(scene,camera);};
 });await page.waitForTimeout(300);
 const lighting=await page.evaluate(()=>window.__game.getLevel().stadiumLightingDiagnostics);assert.equal(lighting.fixtures,34);assert.equal(lighting.pool,6);assert.ok(lighting.lights.filter(l=>l.intensity>1000).length>=2);
 await page.screenshot({path:out+'/lights-on-native.png'});await page.evaluate(()=>window.lightReview.off=true);await page.waitForTimeout(150);await page.screenshot({path:out+'/lights-off-comparison.png'});await page.evaluate(()=>window.lightReview.off=false);await page.waitForTimeout(150);
 const gpu=await page.evaluate(async()=>{
  const g=window.__game,gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)return {available:false};
  const render=g.renderer.render.bind(g.renderer),samples=[],root=window.lightReview.lighting.root;let pending=null,collect=false;
  g.renderer.render=(scene,camera)=>{if(scene!==g.scene||!collect||pending)return render(scene,camera);pending=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,pending);try{return render(scene,camera);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);}};
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve)),measure=async visible=>{root.visible=visible;for(let i=0;i<45;i++)await frame();samples.length=0;collect=true;
   for(let i=0;i<600&&samples.length<40;i++){await frame();if(pending&&gl.getQueryParameter(pending,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))samples.push(gl.getQueryParameter(pending,gl.QUERY_RESULT)/1e6);gl.deleteQuery(pending);pending=null;}}
   collect=false;if(pending){gl.deleteQuery(pending);pending=null;}const sorted=[...samples].sort((a,b)=>a-b);return {samples:sorted.length,meanMs:sorted.reduce((a,b)=>a+b,0)/sorted.length,p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)]};};
  try{return {available:true,lightsExcluded:await measure(false),sixSpotlights:await measure(true),scope:'GPU main scene only; native 1600x900, frozen race pose; no FPS claim'};}finally{collect=false;root.visible=true;g.renderer.render=render;}
 });
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await page.screenshot({path:out+'/lights-on-normal.png'});
 const state=await page.evaluate(()=>({gl:window.__game.renderer.getContext().getError(),render:window.__game.getRenderFrameStats(),memory:window.__game.renderer.info.memory}));assert.equal(state.gl,0);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,lighting,gpu,state,errors,comparison:'Same production scene and pose; comparison disables only the six spotlight intensities. Luminous fixture faces are retained.'},null,2));console.log('PASS stadium illumination',JSON.stringify({lighting,gpu,state}));
}finally{await browser.close();}
