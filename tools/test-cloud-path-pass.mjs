import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {CloudPathPass,cloudPathSize}=await server.ssrLoadModule('/src/cloudPathPass.ts');
 assert.deepEqual(cloudPathSize(1920,1080),{width:640,height:360});
 assert.deepEqual(cloudPathSize(3840,2160),{width:640,height:360});
 assert.deepEqual(cloudPathSize(1152,720),{width:576,height:360});
 assert.deepEqual(cloudPathSize(390,844),{width:166,height:360});
 assert.deepEqual(cloudPathSize(320,200),{width:320,height:200});
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),cloud=new THREE.Mesh(),solid=new THREE.Mesh();
 cloud.userData.cloudRoadVisual=true;cloud.layers.enable(2);scene.add(cloud,solid);scene.background=new THREE.Color(.2,.3,.4);
 const pass=new CloudPathPass(),viewport=new THREE.Vector4(0,400,1280,400),scissor=viewport.clone(),background=scene.background;
 pass.featherEdges=false; // Real GPU filtering/occlusion is exercised by the browser fixture.
 let target=null,clearColor=new THREE.Color(.3,.2,.1),alpha=.75,scissored=true,calls=0,fail=0,disposals=0;
 const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:true},
  getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
  getViewport:v=>v.copy(viewport),getCurrentViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),getScissorTest:()=>scissored,
  getClearColor:c=>c.copy(clearColor),getClearAlpha:()=>alpha,
  setViewport:v=>viewport.copy(v),setScissor:v=>scissor.copy(v),setScissorTest:v=>{scissored=v;},
  setClearColor:(c,a)=>{clearColor.set(c);alpha=a;},setRenderTarget:t=>{target=t;},clear:()=>{},
  render:(s,c)=>{calls++;if(calls===fail)throw Error('injected render failure');
   if(calls%2){assert.equal(c.layers.mask,1<<29);assert.equal(cloud.layers.mask,1<<29);assert.equal(solid.layers.mask,1);assert.equal(s.background,null);assert.equal(alpha,0);assert.equal(target.height,360);target.addEventListener('dispose',()=>disposals++);}
   else{assert.equal(c.layers.mask,1);assert.equal(cloud.layers.mask,0);assert.equal(solid.layers.mask,1);assert.equal(s.background,background);assert.ok(s.children.some(o=>o.userData.cloudPathComposite));}
  },
 };
 const restored=()=>{assert.equal(camera.layers.mask,1);assert.equal(cloud.layers.mask,5);assert.equal(solid.layers.mask,1);assert.equal(scene.background,background);assert.equal(target,null);assert.equal(scissored,true);assert.equal(alpha,.75);assert.deepEqual(viewport.toArray(),[0,400,1280,400]);assert.deepEqual(scissor.toArray(),viewport.toArray());assert.equal(renderer.autoClear,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.ok(!scene.children.some(o=>o.userData.cloudPathComposite));};
 assert.equal(pass.render(renderer,scene,camera,null),true);restored();assert.equal(pass.diagnostics.width,1152);assert.equal(pass.diagnostics.height,360);
 for(const phase of [1,2]){calls=0;fail=phase;assert.throws(()=>pass.render(renderer,scene,camera,null),/injected/);restored();}
 fail=0;calls=0;cloud.visible=false;assert.equal(pass.render(renderer,scene,camera,null),false);assert.equal(pass.diagnostics.targetBytes,0);assert.ok(disposals>0);
 cloud.visible=true;camera.layers.set(7);assert.equal(pass.render(renderer,scene,camera,null),false,'Clouds outside the active camera must stay excluded');
 pass.dispose();cloud.geometry.dispose();cloud.material.dispose();solid.geometry.dispose();solid.material.dispose();
 console.log('PASS fixed cloud cap, aspect ratios, split viewport, full-res scene membership, failure cleanup and lazy release');
}finally{await server.close();}
