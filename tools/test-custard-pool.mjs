import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {custardPoolMaterial,attachCustardPoolReflection,CustardFinalePresentation,addCustardPoolBedLook}=await server.ssrLoadModule('/src/custardPool.ts');
 const clock={value:0},component={t:'mesh',p:[0,0,0],materialStyle:'jungle-stream',tex:'custard-pool',solid:false};
 const material=custardPoolMaterial(clock,component,[]),geometry=new THREE.PlaneGeometry(60,80,12,8).rotateX(-Math.PI/2);
 const water=new THREE.Mesh(geometry,material);water.position.y=-28;
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#c19f91',55,190);scene.add(water);scene.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(49,16/9,.1,400);camera.position.set(0,5,40);camera.lookAt(0,-28,0);camera.updateMatrixWorld(true);
 const presentation=new CustardFinalePresentation(water,scene);scene.add(presentation.root);
 const original=scene.fog.clone();presentation.update(camera);
 assert.equal(scene.fog.near,108);assert.equal(scene.fog.far,245);assert.ok(presentation.root.children.every(l=>l.intensity>0&&!l.castShadow));
 camera.position.set(1000,5,1000);camera.updateMatrixWorld(true);presentation.update(camera);
 assert.equal(scene.fog.near,original.near);assert.equal(scene.fog.far,original.far);assert.equal(scene.fog.color.getHex(),original.color.getHex());
 camera.position.set(0,5,40);camera.updateMatrixWorld(true);presentation.update(camera);presentation.dispose();
 assert.equal(scene.fog.near,55);assert.equal(scene.fog.far,190);assert.equal(presentation.root.parent,null);
 scene.fog.near=72;presentation.update(camera);presentation.dispose();assert.equal(scene.fog.near,72,'disposed presentation cannot change a later view');
 const other=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial());other.material.userData.waterSurface=true;scene.add(other);
 const hidden=other.clone();hidden.visible=false;scene.add(hidden);
 attachCustardPoolReflection(water,clock,false);
 const target={viewport:new THREE.Vector4(0,0,640,360)},viewport=target.viewport.clone(),scissor=true;let active=target,draws=0,fail=false,reflected;
 const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:false,
  getRenderTarget:()=>active,setRenderTarget:t=>{active=t;viewport.copy(t?.viewport??target.viewport);},
  getCurrentViewport:v=>v.copy(viewport),getScissorTest:()=>scissor,
  state:{buffers:{depth:{setMask(){}}},viewport:v=>viewport.copy(v)},clear(){},
  render(s,c){draws++;reflected=active;assert.equal(water.visible,false);assert.equal(other.visible,false);assert.equal(hidden.visible,false);
   assert.equal(renderer.xr.enabled,false);assert.equal(renderer.shadowMap.autoUpdate,false);assert.ok(c.position.y<-28,'mirror camera is below the water plane');
   assert.equal(s,scene);if(fail)throw Error('synthetic capture failure');},
 };
 const render=()=>water.onBeforeRender(renderer,scene,camera,geometry,material,null);
 render();assert.equal(draws,1);assert.equal(material.userData.custardReflection.ready.value,1);assert.equal(water.userData.poolReflection.stateRestored,true);
 assert.equal(active,target);assert.equal(water.visible,true);assert.equal(other.visible,true);assert.equal(hidden.visible,false);
 assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);assert.ok(viewport.equals(target.viewport));
 render();assert.equal(draws,1,'paused clock and camera reuse the reflection');
 camera.position.x+=1;camera.updateMatrixWorld(true);render();assert.equal(draws,2,'camera movement refreshes the reflection even with a paused clock');
 clock.value=.2;fail=true;assert.throws(render,/synthetic capture failure/);
 assert.equal(active,target);assert.equal(water.visible,true);assert.equal(other.visible,true);assert.equal(hidden.visible,false);
 assert.equal(renderer.xr.enabled,true);assert.equal(renderer.shadowMap.autoUpdate,true);
 let releases=0;reflected.addEventListener('dispose',()=>releases++);material.dispose();material.dispose();
 assert.equal(releases,1);assert.equal(material.userData.custardReflection.ready.value,0);assert.equal(material.userData.custardReflection.reflection.value,null);
 const lite=custardPoolMaterial(clock,component,[]),liteMesh=new THREE.Mesh(geometry,lite);attachCustardPoolReflection(liteMesh,clock,true);
 assert.equal(liteMesh.userData.poolReflection,undefined,'lite mode has no additional reflection pass');lite.dispose();
 const bed=new THREE.MeshStandardMaterial();bed.customProgramCacheKey=()=> 'existing-sandstone-look';addCustardPoolBedLook(bed,clock);
 assert.equal(bed.customProgramCacheKey(),'existing-sandstone-look|custard-pool-bed-v1','caustics cannot share an ordinary bank shader');bed.dispose();
 geometry.dispose();other.geometry.dispose();other.material.dispose();
 console.log('PASS Custard pool: actual reflected camera, hidden-water restoration, render-target/viewport/XR/shadow state, paused reuse, moving camera, failure cleanup, one-time disposal, lite fallback and bounded/restored finale lighting.');
}finally{await server.close();}
