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
  // A real-height jump crosses close past the chief; the camera must turn
  // continuously, show both actors and settle back to its close framing.
  let maxTurn=0,maxDistance=0,dynamicSamples=0;
  for(const aspect of [16/9,9/16])for(const fps of [30,60,144]){
    const camera=new THREE.PerspectiveCamera(49,aspect,.1,400);
    const subject=new THREE.Vector3(),centre=new THREE.Vector3(0,0,-24);
    let previous=null;
    for(let i=0;i<fps*5;i++){
      const t=i/fps,z=t<1.4?-14-t*10:t<2.8?-28+(t-1.4)*10:-14;
      subject.set(.7,t<2.8?6:0,z);boss.model.root.position.copy(centre);boss.model.cameraTop.set(0,8.2,-24);
      bossCamera.restore(camera);bossCamera.apply(camera,boss,subject,1/fps,i===0||i===Math.ceil(fps*2.8));
      const heading=bossCamera.heading.clone();
      if(previous&&i!==Math.ceil(fps*2.8)){
        const turn=Math.acos(THREE.MathUtils.clamp(previous.dot(heading),-1,1));
        maxTurn=Math.max(maxTurn,turn*fps);
        assert.ok(turn<THREE.MathUtils.degToRad(700)/fps,'camera snapped through the chief');
      }
      previous=heading;maxDistance=Math.max(maxDistance,bossCamera.diagnostics.distance);
      for(const point of [subject.clone(),subject.clone().add(new THREE.Vector3(0,2.6,0)),boss.model.cameraTop.clone()]){
        const projected=point.project(camera);
        assert.ok(projected.z<1&&Math.abs(projected.x)<.95&&Math.abs(projected.y)<1,`moving camera lost an actor at ${t}s, aspect ${aspect}: ${projected.toArray()}`);
      }
      dynamicSamples++;
    }
    assert.ok(bossCamera.diagnostics.distance<9,'camera never returned to the close view');
  }
  console.log(JSON.stringify({dynamicSamples,maxTurnDegreesPerSecond:THREE.MathUtils.radToDeg(maxTurn),maxDistance}));
  console.log(`PASS ${samples} boss-facing close camera samples, rider/chief vertical framing, nine-metre settled distance ceiling and independent base-rig restoration.`);
});
