import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
 const {AssetCache,disposeTextures}=await server.ssrLoadModule('/src/assetLifetime.ts');
 const disposed=[];let loaded=0;
 const cache=new AssetCache(async key=>({key,generation:++loaded}),value=>disposed.push(value));
 const a=cache.scope(),b=cache.scope();
 const first=await a.load('tree');assert.equal(await b.load('tree'),first);
 assert.equal(await a.load('tree'),first);assert.equal(loaded,1);
 a.dispose();a.dispose();assert.equal(disposed.length,0,'successor still owns shared resource');
 b.dispose();assert.deepEqual(disposed,[first]);
 const c=cache.scope();assert.notEqual(await c.load('tree'),first);c.dispose();
 await assert.rejects(c.load('tree'),/disposed/);

 const pending=[],lateDisposed=[];
 const delayed=new AssetCache(key=>new Promise(resolve=>pending.push(resolve)),v=>lateDisposed.push(v));
 const old=delayed.scope(),oldPromise=old.load('tree');old.dispose();
 const next=delayed.scope(),nextPromise=next.load('tree');await Promise.resolve();
 pending[1]('new');assert.equal(await nextPromise,'new');
 pending[0]('old');await oldPromise;assert.deepEqual(lateDisposed,['old']);
 const overlap=delayed.scope();assert.equal(await overlap.load('tree'),'new','late completion cannot evict replacement');
 next.dispose();assert.deepEqual(lateDisposed,['old']);overlap.dispose();assert.deepEqual(lateDisposed,['old','new']);

 let fail=true;const retries=new AssetCache(async()=>{if(fail)throw Error('network');return 'retry';},()=>{});
 const failed=retries.scope();await assert.rejects(failed.load('x'),/network/);fail=false;
 const retry=retries.scope();assert.equal(await retry.load('x'),'retry');failed.dispose();retry.dispose();

 const freed=[];
 const dependencies=new AssetCache(async(key,depend)=>key==='canopy'?{key,tree:await depend('tree')}:{key},v=>freed.push(v.key));
 const crown=dependencies.scope(),tree=dependencies.scope();
 await crown.load('canopy');await tree.load('tree');tree.dispose();assert.deepEqual(freed,[]);
 crown.dispose();assert.deepEqual(freed,['canopy','tree']);

 let closes=0,disposals=0;const image={close:()=>closes++};
 const t1=new THREE.Texture(image),t2=new THREE.Texture(image);
 t1.addEventListener('dispose',()=>disposals++);t2.addEventListener('dispose',()=>disposals++);
 disposeTextures([t1,t1],[t2]);assert.equal(closes,0);assert.equal(disposals,1);
 disposeTextures([t2,t2]);assert.equal(closes,1);assert.equal(disposals,2);

 // The runtime may share these atlases only while their encoded pixels,
 // samplers and material texture references remain exactly identical.
 function atlas(bytes){const length=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+length)),bin=bytes.subarray(28+length);return {
  images:json.images.map(i=>{const v=json.bufferViews[i.bufferView];return bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength);}),
  textures:json.textures,samplers:json.samplers,materials:json.materials,
 };}
 const [trunk,canopy]=await Promise.all(['tree','canopy'].map(name=>readFile(new URL(`../public/treehouse-trail/${name}.glb`,import.meta.url)).then(atlas)));
 assert.deepEqual(trunk,canopy,'separated canopy must use identical atlas pixels and mapping');
 const {installShadowTextureCleanup}=await server.ssrLoadModule('/src/shadowTextureCleanup.ts');
 const stale=new THREE.Texture(),cutout=new THREE.Texture(),uniforms={map:{value:stale},alphaMap:{value:cutout},displacementMap:{value:stale}};
 const depth=new THREE.MeshDepthMaterial({alphaMap:cutout,alphaTest:.3});let draws=0;
 const renderer={properties:{get:()=>({uniforms})},renderBufferDirect(){draws++;assert.equal(uniforms.map.value,null);assert.equal(uniforms.displacementMap.value,null);assert.equal(uniforms.alphaMap.value,cutout);}};
 installShadowTextureCleanup(renderer);renderer.renderBufferDirect(null,null,null,depth,null,null);assert.equal(draws,1);
 assert.equal(depth.alphaTest,.3,'cutout threshold and geometry render are unchanged');
 console.log('Asset lifetime: sharing, retirement races, dependencies, retries, bitmap cleanup and identical Treehouse atlases passed.');
} finally {await server.close();}
