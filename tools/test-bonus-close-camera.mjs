import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {THEMED_BONUS_COURSES}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {CameraViewFraming}=await r.server.ssrLoadModule('/src/cameraViews.ts');
 for(const course of THEMED_BONUS_COURSES){
  const normalized=normalizeCustomLevelData(course.data);assert.ok(normalized,course.id);
  const spec=normalized.components.find(c=>c.t==='camnode'&&c.cameraView);
  assert.equal(spec.cameraFollowDistance,18);assert.equal(spec.cameraFollowTargetHeight,5.3);
  for(const aspect of [16/9,4/3,390/844]){
   const camera=new r.THREE.PerspectiveCamera(49,aspect,.1,400),framing=new CameraViewFraming();
   framing.apply(camera,{weight:1,view:{p:spec.p,s:spec.s,yaw:0,feather:1,...spec}},new r.THREE.Vector3(),true);camera.updateMatrixWorld(true);
   for(const [name,point]of [['feet',[0,.1,0]],['head',[0,2.5,0]],['high cap',[3,10.56,0]]]){
    const q=new r.THREE.Vector3(...point).project(camera);assert.ok(Math.abs(q.x)<1.1&&q.y>-.85&&q.y<.7&&q.z<1,`${course.id}/${aspect} cropped ${name}: ${q.toArray()}`);
   }
   framing.restore(camera);framing.apply(camera,{weight:1,view:{p:spec.p,s:spec.s,yaw:0,feather:1,...spec}},new r.THREE.Vector3(12.5,0,0),true);camera.updateMatrixWorld(true);
   const receiver=new r.THREE.Vector3(12.5,1,0).project(camera);assert.ok(Math.abs(receiver.x)<1&&Math.abs(receiver.y)<1,'close camera failed to follow to the receiver');
   assert.ok(camera.fov<=49,'portrait fitting zoomed out the gameplay lens');
  }
 }
 const view=r.l.cameraViews[0];assert.equal(view.cameraFollowTargetHeight,5.3);
 const captured=r.l.captureData();assert.equal(captured.components.find(c=>c.cameraView).cameraFollowTargetHeight,5.3);
 console.log('PASS',THEMED_BONUS_COURSES.length,'close bonus cameras: hero, high caps and receivers visible; bounded target height round-trips; portrait views follow to distant receivers without zooming out');
},{modulePath:'/src/level.ts',levelId:'bonus-jungle-terraces',source:m=>m.findLevel('bonus-jungle-terraces').data});
