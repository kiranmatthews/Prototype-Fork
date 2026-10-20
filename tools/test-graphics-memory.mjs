import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {resizeRendererSurface}=await server.ssrLoadModule('/src/render-quality/surfaceSize.ts');
 let width=1280,height=720,ratio=1,writes=0;
 const renderer={getSize:v=>v.set(width,height),getPixelRatio:()=>ratio,setDrawingBufferSize(w,h,r){width=w;height=h;ratio=r;writes++;}};
 for(let i=0;i<20;i++)assert.equal(resizeRendererSurface(renderer,1280,720,1),false);
 assert.equal(writes,0);assert.equal(resizeRendererSurface(renderer,960,540,1),true);assert.equal(writes,1);
 assert.equal(resizeRendererSurface(renderer,390,844,2),true);assert.equal(writes,2,'DPR and dimensions change in one allocation');
 assert.equal(resizeRendererSurface(renderer,0,844,2),false);assert.equal(resizeRendererSurface(renderer,390,NaN,2),false);assert.equal(writes,2,'invalid transient viewport is ignored');
 const {AssetLoadQueue}=await server.ssrLoadModule('/src/assetLoadQueue.ts');
 const queue=new AssetLoadQueue(2),pending=[];let active=0,peak=0,started=0,wanted=true;
 const load=()=>{active++;started++;peak=Math.max(peak,active);return new Promise(resolve=>pending.push(()=>{active--;resolve(started);}));};
 const a=queue.run(load),b=queue.run(load),c=queue.run(load,()=>wanted),d=queue.run(load);
 const cancelled=assert.rejects(c,/released/);wanted=false;await Promise.resolve();assert.equal(started,2);
 pending.shift()();await a;await new Promise(resolve=>setTimeout(resolve,0));assert.equal(started,3);assert.equal(peak,2);
 while(pending.length)pending.shift()();await Promise.all([b,d,cancelled]);
 await assert.rejects(queue.run(async()=>{throw Error('decode failed');}),/decode failed/);
 assert.equal(await queue.run(async()=>42),42,'a failed decoder releases its slot');
 const {releaseLostGraphicsResources,isGraphicsReset}=await server.ssrLoadModule('/src/lostGraphicsResources.ts');
 const geometry=new THREE.BoxGeometry(),texture=new THREE.Texture({close(){throw Error('reset closed a decoded image');}});
 const material=new THREE.MeshBasicMaterial({map:texture}),mesh=new THREE.InstancedMesh(geometry,material,2);
 const morph=new THREE.DataTexture(new Float32Array([.25,.75,0,1]),1,1);mesh.morphTexture=morph;
 const target=new THREE.WebGLRenderTarget(8,8);target.depthTexture=new THREE.DepthTexture(8,8);
 const detached={geometry:new THREE.BoxGeometry()},root=new THREE.Scene();root.add(mesh);
 const owners={root,detached:new Map([['retained',detached]]),targets:new Set([target]),cycle:null};owners.cycle=owners;
 const resources=[mesh,geometry,texture,morph,target,target.texture,target.depthTexture,detached.geometry],resets=new Map(resources.map(r=>[r,0]));
 for(const r of resources)r.addEventListener('dispose',event=>{assert.ok(isGraphicsReset(event));resets.set(r,resets.get(r)+1);});
 let materialDisposals=0;material.addEventListener('dispose',()=>materialDisposals++);
 const positions=geometry.attributes.position.array.slice(),instances=mesh.instanceMatrix.array.slice();
 releaseLostGraphicsResources([owners,root]);
 assert.ok([...resets.values()].every(n=>n===1),'reset reaches shared, detached and target resources once');
 assert.equal(materialDisposals,0,'reset cannot end material-owned asset leases');
 assert.equal(mesh.morphTexture,morph,'reset preserves CPU morph state');assert.equal(mesh.parent,root);
 assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(mesh.instanceMatrix.array,instances);
 const {GraphicsRecovery}=await server.ssrLoadModule('/src/graphicsRecovery.ts');
 let lost=0,restored=0,removed=0;const overlayChildren=[];
 const canvas=new EventTarget();canvas.dataset={};canvas.ownerDocument={
  body:{append:node=>overlayChildren.push(node)},
  createElement:()=>({style:{},dataset:{},setAttribute(){},append(){},remove(){removed++;}}),
 };
 const recovery=new GraphicsRecovery(canvas,()=>lost++,()=>restored++);
 const event=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(recovery.lost,true);assert.equal(lost,1);
 let ready=false;const waiting=recovery.ready().then(()=>ready=true);await Promise.resolve();assert.equal(ready,false);
 canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));assert.equal(lost,1,'duplicate loss does not recreate resources');
 canvas.dispatchEvent(new Event('webglcontextrestored'));await waiting;
 assert.equal(recovery.lost,false);assert.equal(restored,1);assert.equal(removed,1);assert.equal(canvas.dataset.graphicsState,'ready');
 // Real Level image loading must complete across a GPU reset, while ordinary
 // ownership disposal must still suppress a late image callback.
 const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
 runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
 const {Level}=await server.ssrLoadModule('/src/level.ts'),originalLoad=THREE.ImageLoader.prototype.load,callbacks=[];
 THREE.ImageLoader.prototype.load=function(_url,ready){callbacks.push(ready);return {};};
 try{
  const owner={root:new THREE.Scene(),surfaceImageJobs:new Set()},image={width:16,height:16};
  const loaded=Level.prototype.surfaceImage.call(owner,'reset-image.png');
  releaseLostGraphicsResources([owner,loaded]);callbacks.shift()(image);await Promise.all([...owner.surfaceImageJobs]);
  assert.equal(loaded.image,image,'pending image survives a graphics reset');assert.equal(loaded.userData.surfaceImageReady,true);
  loaded.dispose();
  const retired=Level.prototype.surfaceImage.call(owner,'retired-image.png'),placeholder=retired.image;
  retired.dispose();callbacks.shift()(image);await Promise.all([...owner.surfaceImageJobs]);
  assert.equal(retired.image,placeholder,'ordinary retirement still cancels late artwork');
 }finally{THREE.ImageLoader.prototype.load=originalLoad;}
 console.log('PASS no-op viewport events, atomic resizing, bounded decoders, graphics recovery and GPU reset with intact source data/owners.');
}finally{await server.close();}
