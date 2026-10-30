import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const experiment=process.argv.includes('--experiment');
const out=process.env.BATCH_OUT??`art/carlisle-shipyard/deck-batching/${experiment?'experiment':'final'}`,base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484';
await mkdir(out,{recursive:true});
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const report={base,experiment,method:'Frozen native scene, shared full geometry/materials/transforms; coarse, spatial, runtime and repeated coarse control. Main and shadow passes. Short timings do not establish whole-course frame rate.',errors:[],views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,grounds:l.groundMeshes.length,crates:l.crates.length,movers:l.movers.length,wetSlopes:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.grounds,334);assert.equal(report.main.crates,270);assert.equal(report.main.movers,28);assert.equal(report.main.wetSlopes,18);
 report.inventory=await page.evaluate(async sizes=>{
  const g=window.__game,originals=[],groups=new Map();g.scene.traverse(n=>{if(n.isInstancedMesh&&n.name==='Solid timber modules')originals.push(n);});
  for(const n of originals){const key=n.parent.uuid+':'+n.geometry.uuid+':'+n.material.uuid;let b=groups.get(key);if(!b){b={source:n,parent:n.parent,matrices:[]};groups.set(key,b);}for(let i=0;i<n.count;i++)b.matrices.push(n.matrix.clone().fromArray(n.instanceMatrix.array,i*16));}
  const variants=new Map();
  for(const size of sizes){
   const nodes=[];
   for(const b of groups.values()){
    const cells=new Map();for(const matrix of b.matrices){const e=matrix.elements,key=size?[Math.floor(e[12]/size),Math.floor(e[13]/size),Math.floor(e[14]/size)].join(':'):'all';let a=cells.get(key);if(!a){a=[];cells.set(key,a);}a.push(matrix);}
    for(const matrices of cells.values()){
     const n=new b.source.constructor(b.source.geometry,b.source.material,matrices.length);n.matrix.copy(b.source.matrix);n.matrixAutoUpdate=false;n.name='Deck batching probe';n.castShadow=b.source.castShadow;n.receiveShadow=b.source.receiveShadow;
     matrices.forEach((m,i)=>n.setMatrixAt(i,m));n.computeBoundingSphere();n.visible=false;b.parent.add(n);nodes.push(n);
    }
   }variants.set(size,nodes);
  }
  window.__deckBatchProbe={originals,variants};
  // Sorted exact module records are independent of partitioning. UUIDs verify
  // shared original geometry/materials; local and instance transforms match.
  const describe=async nodes=>{
   const records=[];for(const n of nodes)for(let i=0;i<n.count;i++)records.push(JSON.stringify([n.parent.uuid,n.geometry.uuid,n.material.uuid,n.castShadow,n.receiveShadow,n.matrix.elements,Array.from(n.instanceMatrix.array.slice(i*16,i*16+16))]));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(records.sort().join('\n')))),v=>v.toString(16).padStart(2,'0')).join('');
   return{batches:nodes.length,modules:records.length,triangles:nodes.reduce((s,n)=>s+n.count*n.geometry.index.count/3,0),moduleFingerprint:hash};
  };
  return{originals:await describe(originals),variants:await Promise.all([...variants].map(async([size,nodes])=>({size,...await describe(nodes)})))};
 },experiment?[0,32,48,64,96]:[0,48]);
 const inventory=report.inventory;
 assert.equal(inventory.originals.modules,567);assert.equal(inventory.originals.triangles,21843906);
 assert.ok(inventory.variants.every(v=>v.moduleFingerprint===inventory.originals.moduleFingerprint),'geometry, materials or transforms changed');
 if(!experiment){assert.equal(inventory.originals.batches,177);assert.equal(report.main.art.timber.instanceBatches,177);}
 for(const [name,station,offset,look,mirror] of [
  ['arrival',30,[12,18,22],[0,0,-45]],
  ['first-bounce',170,[35,130,55],[0,4,-20]],
  ['birdseye-bounce',170,[0,220,12],[0,0,0]],
  ['lift-yard',500,[-50,70,85],[15,4,-50]],
  ['crane-yard',2100,[-90,55,75],[0,0,-55]],
  ['homecoming',3760,[35,45,90],[0,4,-55]],
  ['mirrored-arrival',30,[12,18,22],[0,0,-45],true],
 ]){
  const p=carlislePoint(station,3),camera=p.map((v,i)=>v+offset[i]),center=p.map((v,i)=>v+look[i]);
  if(mirror){const water=carlislePoint(station,-8)[1];camera[1]=2*water-camera[1];center[1]=2*water-center[1];}
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},p);await page.waitForTimeout(250);
  const capture=!experiment&&['arrival','first-bounce','birdseye-bounce','crane-yard','mirrored-arrival'].includes(name);
  const results=await page.evaluate(({camera,center,mirror,capture})=>{
   const g=window.__game,{originals,variants}=window.__deckBatchProbe,c=g.camera.clone(),was=g.player.group.visible,target=g.renderer.getRenderTarget();g.player.group.visible=false;
   // A reflected scene pass omits its reflecting water surface. This is a
   // camera/frustum stress test, not an assertion of planar water rendering.
   const hidden=[];if(mirror)g.scene.traverse(n=>{if(n.name==='Blue-hour tidal water'&&n.visible){hidden.push(n);n.visible=false;}});
   const originalCulling=originals.map(n=>n.frustumCulled);
   c.position.set(...camera);if(mirror)c.up.set(0,-1,0);c.fov=52;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.setRenderTarget(null);g.scene.updateMatrixWorld(true);
   const gl=g.renderer.getContext(),width=g.renderer.domElement.width,height=g.renderer.domElement.height;let reference,runtimePixels;const results=[];
   try{
    for(const [id,nodes]of [...variants,['runtime',originals],['unculled',originals],['coarse-repeat',variants.get(0)]]){
     originals.forEach(n=>n.visible=false);for(const other of variants.values())other.forEach(n=>n.visible=false);nodes.forEach(n=>n.visible=true);
     originals.forEach((n,i)=>n.frustumCulled=id==='unculled'?false:originalCulling[i]);
     // Settle shader/VAO creation outside the measured draw. Every draw uses
     // the same frozen scene time, lights and camera, including its shadow pass.
     g.renderer.render(g.scene,c);gl.finish();g.renderer.info.reset();
     const before=performance.now();g.renderer.render(g.scene,c);gl.finish();const ms=performance.now()-before,render={...g.renderer.info.render};
     const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     const comparison=id==='unculled'?runtimePixels:reference;
     let changed=0,changedPixels=0,maxDifference=0,absolute=0;const bounds=[width,height,-1,-1];
     for(let i=0;comparison&&i<pixels.length;i+=4){let pixelChanged=false;for(let k=0;k<4;k++){const d=Math.abs(pixels[i+k]-comparison[i+k]);if(d){changed++;absolute+=d;maxDifference=Math.max(maxDifference,d);pixelChanged=true;}}if(pixelChanged){changedPixels++;const x=(i/4)%width,y=height-1-Math.floor(i/4/width);bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}}
     if(id===0)reference=pixels;
     if(id==='runtime')runtimePixels=pixels;
     results.push({id,comparison:id==='unculled'?'runtime':'coarse',render,elapsedMs:ms,pixelChannelsChanged:changed,changedPixels,maxDifference,meanAbsoluteDifference:absolute/pixels.length,changedBounds:changedPixels?bounds:null,width,height,...(capture&&(id===0||id==='runtime')?{png:g.renderer.domElement.toDataURL('image/png')}:{})});
    }
   }finally{originals.forEach((n,i)=>{n.visible=true;n.frustumCulled=originalCulling[i];});for(const nodes of variants.values())nodes.forEach(n=>n.visible=false);hidden.forEach(n=>n.visible=true);g.player.group.visible=was;g.renderer.setRenderTarget(target);}
   return results;
  },{camera,center,mirror:!!mirror,capture});
  for(const result of results)if(result.png){result.image=`${name}-${result.id===0?'coarse':'runtime'}.png`;await writeFile(out+'/'+result.image,Buffer.from(result.png.split(',')[1],'base64'));delete result.png;}
  report.views.push({name,station,mirrored:!!mirror,camera,center,results});
  // Report spatial-batch differences for visual review. Do not declare these
  // pixel-identical. Repeating the exact coarse control must be stable.
  assert.equal(results.at(-1).changedPixels,0,name+': frozen control was unstable');
  assert.equal(results.find(r=>r.id==='unculled').changedPixels,0,name+': frustum culling altered visible pixels');
 }
 await page.evaluate(()=>{const {variants}=window.__deckBatchProbe;for(const nodes of variants.values())for(const n of nodes){n.removeFromParent();n.dispose();}delete window.__deckBatchProbe;});
 if(!experiment){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForFunction(()=>window.__game.player.grounded);
  report.bonus=await page.evaluate(()=>{const l=window.__game.getLevel();return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length,crates:l.crates.length};});assert.equal(report.bonus.art.status,'ready');assert.equal(report.bonus.movers,4);await page.screenshot({path:out+'/bonus-native.png'});
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForFunction(()=>window.__game.player.grounded);
  report.returned=await page.evaluate(()=>window.__game.getLevel().carlisleShipyardDiagnostics);assert.equal(report.returned.status,'ready');assert.equal(report.returned.timber.instanceBatches,177);await page.screenshot({path:out+'/normal-arrival.png'});
  const z=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths}));assert.ok(report.walk.z<z-2);assert.equal(report.walk.deaths,0);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,inventory:report.inventory,views:report.views.map(v=>({name:v.name,results:v.results.map(r=>({id:r.id,triangles:r.render.triangles,calls:r.render.calls,pixels:r.changedPixels,max:r.maxDifference}))})),errors:report.errors}));
