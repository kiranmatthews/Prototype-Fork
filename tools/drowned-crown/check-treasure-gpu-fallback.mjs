// Corrupt only the optional GPU colour payloads in an isolated browser. The
// original WebP images and all geometry in the real release remain untouched.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../..',import.meta.url));
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'/private/tmp/crown-treasure-gpu-fallback';
const corrupted=new Map(),requests={},errors=[],expectedErrors=[],warnings=[];
for(const name of ['shallow','bank','hero']){
 const file='treasure-mound-'+name+'.glb',bytes=await readFile(path.join(root,'public/drowned-crown/excellence',file));
 const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
 const texture=doc.textures[doc.materials[0].pbrMetallicRoughness.baseColorTexture.index];
 const image=doc.images[texture.extensions.KHR_texture_basisu.source],view=doc.bufferViews[image.bufferView];
 assert.equal(bytes[28+jsonLength+view.byteOffset],0xab);bytes[28+jsonLength+view.byteOffset]=0;
 corrupted.set(file,bytes);requests[file]=0;
}
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={base,cycles:[],requests,errors,expectedErrors,warnings};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 await page.addInitScript(()=>{
  Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{e.stopImmediatePropagation();e.preventDefault();},true);
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('Page crashed'));
 page.on('console',m=>{
  const message=m.text();
  if(m.type()==='error'){if(message.startsWith("THREE.GLTFLoader: Couldn't load texture blob:"))expectedErrors.push(message);else errors.push(message);}
  if(m.type()==='warning'&&message.includes('compressed atlas unavailable'))warnings.push(message);
 });
 await page.route('**/drowned-crown/excellence/treasure-mound-*.glb',route=>{
  const file=new URL(route.request().url()).pathname.split('/').at(-1);assert.ok(corrupted.has(file));requests[file]++;
  return route.fulfill({contentType:'model/gltf-binary',body:corrupted.get(file)});
 });
 await page.goto(new URL('?playtest&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>window.__game.campaign.startEphemeral());
 for(let cycle=0;cycle<2;cycle++){
  if(cycle)for(const id of ['sky','drowned-crown']){
   await page.evaluate(async id=>{const g=window.__game;await g.gameFlow.transition(()=>{if(!g.switchLevel(id))throw Error('Level switch failed');g.gameFlow.hide();});},id);
   await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  }
  await page.evaluate(async()=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(1032,20.1,-425),heading:g.player.camDir.clone().set(0,0,-1)});await g.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(2200);
  await page.waitForFunction(()=>!window.__game.getLoadingDiagnostics().pending.length&&window.__game.player.grounded,null,{timeout:90000});
  await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();});
  const state=await page.evaluate(()=>{
   const g=window.__game,r=g.renderer,kinds=new Map();
   g.getLevel().jungleAssets.root.traverse(m=>{
    if(!m.isMesh||!String(m.userData.jungleAsset).startsWith('crowntreasuremound'))return;
    const material=m.material,map=material.map;
    if((kinds.get(m.userData.jungleAsset)?.triangles??0)>=m.geometry.index.count/3)return; // retain the native visible mesh, not its shadow-only copy
    kinds.set(m.userData.jungleAsset,{kind:m.userData.jungleAsset,triangles:m.geometry.index.count/3,map:{width:map?.image?.width,height:map?.image?.height,compressed:!!map?.isCompressedTexture},normal:!!material.normalMap,roughness:!!material.roughnessMap,sharedMetal:material.metalnessMap===material.roughnessMap});
   });
   return{kinds:[...kinds.values()].sort((a,b)=>a.kind.localeCompare(b.kind)),grounded:g.player.grounded,deaths:g.player.totalDeaths,position:g.player.pos.toArray(),glError:r.getContext().getError(),contextLost:r.getContext().isContextLost(),loading:g.getLoadingDiagnostics(),diagnostics:g.getLevel().jungleAssets.diagnostics};
  });
  report.cycles.push(state);
  assert.equal(state.kinds.length,3);assert.equal(state.grounded,true);assert.equal(state.deaths,0);assert.equal(state.glError,0);assert.equal(state.contextLost,false);assert.deepEqual(state.loading.failed,[]);assert.deepEqual(state.loading.pending,[]);
  for(const item of state.kinds){assert.deepEqual(item.map,{width:2048,height:2048,compressed:false});assert.ok(item.normal&&item.roughness);assert.equal(item.sharedMetal,item.kind!=='crowntreasuremoundhero');assert.equal(item.triangles,{crowntreasuremoundshallow:46223,crowntreasuremoundbank:71278,crowntreasuremoundhero:60763}[item.kind]);}
  console.log(JSON.stringify({cycle,readyKinds:state.kinds.length,expectedErrors:expectedErrors.length,warnings:warnings.length}));
 }
 assert.equal(expectedErrors.length,6);assert.equal(warnings.length,3);assert.deepEqual(errors,[]);
 for(const count of Object.values(requests))assert.equal(count,4,'one initial load and one portable retry per level');
 report.pass=true;
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
