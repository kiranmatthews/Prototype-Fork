import assert from 'node:assert/strict';
import * as THREE from 'three';
import {withChiefRuntime} from './crab-chief-harness.mjs';
await withChiefRuntime(async ({l,bossCamera})=>{
  const boss=l.boss;let samples=0;
  for(const state of ['idle','recover','phase','defeated']) {
    boss.model.pose({state,stateTime:2,time:2,phase:3,target:new THREE.Vector3(5,0,-15),left:true,exposed:state==='recover',defeated:state==='defeated'});
    for(const radius of [4,8,18,45]) for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,subject=boss.model.root.position.clone().add(new THREE.Vector3(Math.sin(a)*radius,0,Math.cos(a)*radius));
      const camera=new THREE.PerspectiveCamera(49,16/9,.1,400);camera.position.set(6,9,10);camera.lookAt(0,2,0);
      const original=camera.position.clone(),q=camera.quaternion.clone();
      bossCamera.apply(camera,boss,subject,1/60,true);
      const f=camera.getWorldDirection(new THREE.Vector3());f.y=0;f.normalize();
      const toward=boss.model.root.position.clone().sub(camera.position);toward.y=0;toward.normalize();
      assert.ok(f.dot(toward)>.99999,'camera stopped facing the chief');
      assert.ok(camera.position.y>subject.y&&Math.hypot(camera.position.x-subject.x,camera.position.z-subject.z)<=9.001);
      for(const point of [subject.clone().add(new THREE.Vector3(0,.02,0)),subject.clone().add(new THREE.Vector3(0,2.6,0)),boss.model.cameraTop.clone()]) {
        const projected=point.project(camera);assert.ok(projected.z<1&&Math.abs(projected.y)<1,'close camera lost the rider/chief vertically');
      }
      bossCamera.restore(camera);assert.ok(camera.position.distanceTo(original)<1e-9);assert.ok(camera.quaternion.angleTo(q)<1e-7);samples++;
    }
  }
  console.log(`PASS ${samples} boss-facing close camera samples, rider/chief vertical framing, nine-metre distance ceiling and independent base-rig restoration.`);
});
