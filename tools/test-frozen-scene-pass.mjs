import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {FrozenScenePass}=await server.ssrLoadModule('/src/frozenScenePass.ts');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),pass=new FrozenScenePass(scene,camera);
 const read=new THREE.WebGLRenderTarget(960,540,{type:THREE.HalfFloatType}),write=read.clone();
 let target=null,world=0,copies=0;
 const renderer={autoClear:true,setRenderTarget:t=>target=t,getRenderTarget:()=>target,clear(){},render:object=>{if(object===scene)world++;else copies++;}};
 pass.setFrozen('intro:1');pass.render(renderer,write,read);
 assert.equal(world,1);assert.equal(copies,1);assert.equal(pass.snapshot.texture.type,THREE.HalfFloatType);
 let retired=0;pass.snapshot.addEventListener('dispose',()=>retired++);
 for(let i=0;i<60;i++)pass.render(renderer,write,read);
 assert.equal(world,1,'frozen presentation must not resubmit the scene or shadows');assert.equal(copies,61);
 pass.setFrozen('judges:1');pass.render(renderer,write,read);assert.equal(world,2,'a new shot needs a fresh image');
 read.setSize(540,960);pass.render(renderer,write,read);assert.equal(world,3);assert.equal(retired,1);assert.equal(pass.snapshot.width,540);
 pass.snapshot.addEventListener('dispose',()=>retired++);pass.setFrozen(null);assert.equal(retired,2);assert.equal(pass.snapshot,null,'gameplay cannot retain the frozen target');
 pass.render(renderer,write,read);pass.render(renderer,write,read);assert.equal(world,5,'normal gameplay must render every frame');
 assert.equal(renderer.autoClear,true);pass.dispose();read.dispose();write.dispose();
 console.log('PASS frozen-scene identity, full-resolution HDR storage, phase/resize invalidation, normal live rendering and GPU target retirement.');
}finally{await server.close();}
