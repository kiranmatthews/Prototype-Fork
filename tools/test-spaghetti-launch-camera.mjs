import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {LaunchCamera}=await server.ssrLoadModule('/src/launchCamera.ts');
 const {validVerticalLoop}=await server.ssrLoadModule('/src/verticalLoop.ts');
 assert.ok(validVerticalLoop({minY:-48,height:96,launchCamera:true}));
 assert.ok(!validVerticalLoop({minY:-48,height:96,launchCamera:'yes'}));
 const a=new LaunchCamera(),b=new LaunchCamera(),ca=new THREE.PerspectiveCamera(49),cb=ca.clone(),subject=new THREE.Vector3(0,44,0);
 for(let f=0;f<100;f++){
  const offset=f>=40?-96:0,point=subject.clone().add(new THREE.Vector3(f*.1,0,-f*.1));
  const launch={id:1,strength:1,elapsed:f/60,rise:.7,gather:.1,verticalSpeed:-12,board:false};
  a.restore(ca);b.restore(cb);if(f===40)b.shiftY(-96);
  ca.position.copy(point).add(new THREE.Vector3(0,8,12));ca.lookAt(point);cb.copy(ca);cb.position.y+=offset;
  a.apply(ca,point,launch,1/60,f===0);b.apply(cb,point.clone().add(new THREE.Vector3(0,offset,0)),launch,1/60,f===0);
  assert.ok(ca.position.clone().add(new THREE.Vector3(0,offset,0)).distanceTo(cb.position)<1e-7,'Periodic rebasing must preserve the complete launch shot');
  assert.ok(ca.quaternion.angleTo(cb.quaternion)<1e-7);assert.equal(a.diagnostics.weight,b.diagnostics.weight);
 }
 console.log('PASS launch-camera seam continuity, unchanged rotation/weight and strict editor configuration.');
}finally{await server.close();}
