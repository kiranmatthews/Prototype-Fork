import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {CameraSightline}=await server.ssrLoadModule('/src/cameraSightline.ts');
 const slab=new THREE.Mesh(new THREE.BoxGeometry(18,2,24),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
 slab.position.set(0,63,-22);slab.updateMatrixWorld();
 const surfaces={raycastGround:ray=>ray.intersectObject(slab,false)};
 const camera=new THREE.PerspectiveCamera(49,16/9,.1,400),layer=new CameraSightline();
 const bounds=new THREE.Box3(new THREE.Vector3(-.6,59,-36.5),new THREE.Vector3(.6,61.4,-35.5));
 camera.position.set(0,65,-31);camera.lookAt(0,62.6,-36);camera.updateMatrixWorld();
 const eye=camera.position.clone(),q=camera.quaternion.clone(),fov=camera.fov;
 layer.apply(camera,bounds,surfaces,1/60,true);
 assert.ok(camera.position.y<eye.y,'a ledge underside lowers the eye');
 assert.equal(camera.position.x,eye.x);assert.equal(camera.position.z,eye.z);assert.equal(camera.fov,fov);
 assert.ok(Math.abs(camera.getWorldDirection(new THREE.Vector3()).x)<1e-9);
 const center=bounds.getCenter(new THREE.Vector3()),direction=camera.position.clone().sub(center),ray=new THREE.Raycaster(center,direction.clone().normalize(),.15,direction.length()-.15);
 assert.equal(surfaces.raycastGround(ray).length,0,'body and eye share the clear side of the platform');
 layer.restore(camera);assert.ok(camera.position.equals(eye));assert.ok(camera.quaternion.angleTo(q)<1e-7);
 // A deep landing squash is framed even with no platform blocking the eye.
 const empty={raycastGround:()=>[]};
 bounds.set(new THREE.Vector3(-.6,10,-36.5),new THREE.Vector3(.6,11,-35.5));
 camera.position.set(0,17,-31);camera.lookAt(0,14.63,-36);camera.updateMatrixWorld();
 for(let i=0;i<60;i++){
   layer.apply(camera,bounds,empty,1/60,i===0);
   for(const y of [bounds.min.y,bounds.max.y])assert.ok(Math.abs(new THREE.Vector3(0,y,-36).project(camera).y)<1,'touchdown stays in frame');
   layer.restore(camera);
 }
 layer.apply(camera,null,empty,1/60);assert.equal(layer.diagnostics.offsetY,0);
 console.log('Periodic camera sightlines, landing framing, yaw/lens and restore passed');
}finally{await server.close();}
