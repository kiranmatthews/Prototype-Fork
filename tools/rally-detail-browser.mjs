import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');const out=process.env.RALLY_DETAIL_OUTPUT??'/private/tmp/rally-polish-detail',base=process.argv[2]??'http://127.0.0.1:5498';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`);await page.waitForFunction(()=>window.__game?.getSkateRace().carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();g.renderQualitySettings.setRegularResolution(null);r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=10;r.step=()=>{};});
 await page.waitForTimeout(300);
 const grid=await page.evaluate(()=>({look:window.__game.getLookDiagnostics(),render:window.__game.getRenderFrameStats()}));
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),fleet=r.carts.fleet,c=fleet.physics.carts[0];window.detailReview={stage:'clean',render:g.renderer.render.bind(g.renderer)};
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene){const stage=window.detailReview.stage;if(stage==='sky'){camera.position.set(c.x,c.y+4,c.z);camera.lookAt(c.x-.18*100,c.y+4+.16*100,c.z-.97*100);}else {const sn=Math.sin(c.yaw),cs=Math.cos(c.yaw);camera.position.set(c.x+cs*4.0+sn*4.1,c.y+3.0,c.z-sn*4.0+cs*4.1);camera.lookAt(c.x,c.y+1.45,c.z);}camera.updateMatrixWorld();}
   return window.detailReview.render(scene,camera);
  };
 });await page.waitForTimeout(200);await page.screenshot({path:out+'/cart-clean-native.png'});
 const wear=await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),f=r.carts.fleet,c=f.physics.carts[0];Object.assign(c,{speed:24,grounded:true});
  for(let i=0;i<60*60;i++)r.carts.mud.update(1/60,f.physics.carts,r.carts.driverForCart,0,g.player.pos);
  c.speed=0;c.health=.45;c.damage=[.4,.3,.35];f.present(0);return {deposits:r.carts.mud.diagnostics.deposits,health:c.health,geometry:f.stats};
 });await page.waitForTimeout(200);await page.screenshot({path:out+'/cart-muddy-scratched-native.png'});
 await page.evaluate(()=>{window.detailReview.stage='sky';});await page.waitForTimeout(200);await page.screenshot({path:out+'/clean-sky-sun-native.png'});
 const sky=await page.evaluate(()=>{const g=window.__game;return {look:g.getLookDiagnostics(),islandMist:g.scene.children.filter(o=>o.isMesh&&o.geometry.type==='SphereGeometry'&&o.renderOrder===6).map(o=>o.visible),gl:g.renderer.getContext().getError()};});
 assert.ok(wear.deposits[0]>.4);assert.ok(sky.islandMist.every(v=>!v));assert.equal(sky.gl,0);assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({grid,wear,sky,errors,stagedReview:'Wear: sixty seconds of production mud update; damage state .45 to review scratches. Closeup camera only.'},null,2));console.log('PASS detail review',JSON.stringify({grid,wear,sky}));
}finally{await browser.close();}
