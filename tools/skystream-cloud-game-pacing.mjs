import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.slice(2).find(s=>/^https?:/.test(s))||'http://127.0.0.1:5187/';
const output=process.env.CLOUD_PACING_OUTPUT||'/private/tmp/skystream-cloud-game-pacing.json';
const reference=await readFile(new URL('./fixtures/skystream/cloud-road-volume-e3.frag.glsl',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,errors:[],samples:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'?playtest&level=skystream',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async reference=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js'),pairs=[];
  g.getLevel().root.traverse(root=>{if(!root.userData.cloudRoadSource)return;
   const original=root.children[0].material,previous=original.clone();previous.uniforms=original.uniforms;previous.fragmentShader=reference;
   for(const mesh of root.children){const {min,max}=mesh.userData.volumeChunk,size=max.clone().sub(min),centre=min.clone().add(max).multiplyScalar(.5),oldGeometry=new THREE.BoxGeometry(...size.toArray());oldGeometry.translate(...centre.toArray());pairs.push({mesh,original,previous,geometry:mesh.geometry,oldGeometry});}
  });
  window.__paceVariant=variant=>{for(const p of pairs){p.mesh.material=variant==='reference'?p.previous:p.original;p.mesh.geometry=variant==='reference'?p.oldGeometry:p.geometry;}};
 },reference);
 // Whole game, same stationary supported spawn, all effects and CRT enabled.
 // Alternate the order between resolutions; never infer FPS from GPU timers.
 for(const [resolution,variants] of [[720,['reference','optimized']],[null,['optimized','reference']]])for(const variant of variants){
  await page.evaluate(({resolution,variant})=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(resolution);g.crtGuestSettings.setEnabled(true);window.__paceVariant(variant);}, {resolution,variant});
  await page.waitForTimeout(2500);
  const sample=await page.evaluate(async({resolution,variant})=>{
   const g=window.__game,start=performance.now(),first=g.frameStats.frame,frames=[];let last=first;
   await new Promise(resolve=>{function tick(){if(g.frameStats.frame!==last){last=g.frameStats.frame;frames.push(g.frameStats.rawDt*1000);}if(performance.now()-start<10000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
   const elapsedMs=performance.now()-start,delivered=g.frameStats.frame-first;frames.sort((a,b)=>a-b);
   return {variant,resolution:resolution??'native',elapsedMs,delivered,fps:delivered/(elapsedMs/1000),medianFrameMs:frames[Math.floor(frames.length*.5)],p95FrameMs:frames[Math.floor(frames.length*.95)],drawingBuffer:[g.renderer.getContext().drawingBufferWidth,g.renderer.getContext().drawingBufferHeight],position:g.player.pos.toArray(),grounded:g.player.grounded};
  },{resolution,variant});report.samples.push(sample);console.log(JSON.stringify(sample));assert.equal(sample.grounded,true);
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(output,JSON.stringify(report,null,2));await browser.close();}
