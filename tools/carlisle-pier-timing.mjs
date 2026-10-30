import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true}),report={errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto('http://127.0.0.1:5484/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
 await page.waitForFunction(()=>window.__game.player.grounded);
 report.comparison=await page.evaluate(async()=>{
  const g=window.__game,nodes=[],old=[];let oldGeometry,oldMaterial;
  g.scene.traverse(n=>{if(n.userData.pierTimber)nodes.push(n);if(n.isMesh){if(n.geometry.type==='CylinderGeometry'&&n.geometry.parameters.radialSegments===10&&n.geometry.parameters.radiusBottom===.56)oldGeometry=n.geometry;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m.name==='Harbour wood')oldMaterial=m;}});
  if(!oldGeometry||!oldMaterial||!nodes.length)throw Error('Prior column geometry/material unavailable');
  // Reconstruct only the preceding pier shafts, in the same scene/camera/process.
  // The old shafts used these exact matrices and one batch per scenery chunk.
  const chunks=new Map();
  for(const n of nodes)if(n.userData.pierTimber[0].role==='pile'){
   let batch=chunks.get(n.parent);if(!batch){batch=[];chunks.set(n.parent,batch);}for(let i=0;i<n.count;i++)batch.push(n.matrix.clone().fromArray(n.instanceMatrix.array,i*16));
  }
  for(const [parent,matrices]of chunks){const m=new nodes[0].constructor(oldGeometry,oldMaterial,matrices.length);matrices.forEach((a,i)=>m.setMatrixAt(i,a));m.computeBoundingSphere();m.castShadow=m.receiveShadow=true;m.visible=false;parent.add(m);old.push(m);}
  const sample=async(state)=>{
   nodes.forEach(n=>n.visible=state==='new');old.forEach(n=>n.visible=state==='prior');
   for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
   const times=[];let previous=performance.now();for(let i=0;i<240;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-previous);previous=now;}
   times.sort((a,b)=>a-b);return{state,median:times[120],p95:times[228],samples:times.length,render:{...g.renderer.info.render},canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};
  };
  const results=[];try{for(const state of ['new','prior','new','prior'])results.push(await sample(state));}finally{nodes.forEach(n=>n.visible=true);old.forEach(n=>{n.removeFromParent();n.dispose();});}
  return{method:'Same browser, camera, resolution, assets and fixed gameplay; alternate new full structure with reconstructed prior cylindrical shafts, 90 settling and 240 sampled frames per window.',results};
 });assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile('art/carlisle-shipyard/pier-structure/timing-comparison.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
