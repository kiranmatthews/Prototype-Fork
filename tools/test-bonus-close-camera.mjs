import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {THEMED_BONUS_COURSES}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {CameraViewFraming,cameraViewAt,BONUS_PRESENTATION_VIEW}=await r.server.ssrLoadModule('/src/cameraViews.ts');
 for(const course of THEMED_BONUS_COURSES){
  const normalized=normalizeCustomLevelData({...course.data,components:course.data.components.filter(c=>c.t==='camnode')});assert.ok(normalized,course.id);
  const views=normalized.components.filter(c=>c.t==='camnode'&&c.cameraView).map(c=>({yaw:0,...c,feather:c.radius??1}));
  const match=cameraViewAt(views,...normalized.spawn,true),spec=match.view;
  assert.equal(match,BONUS_PRESENTATION_VIEW);
  assert.equal(cameraViewAt(views,1e4,100,-100,true),match);
  assert.equal(spec.cameraFollowDistance,26);assert.equal(spec.cameraFollowTargetHeight,5.3);
  for(const aspect of [16/9,4/3,390/844]){
   const camera=new r.THREE.PerspectiveCamera(49,aspect,.1,400),framing=new CameraViewFraming();
   framing.apply(camera,match,new r.THREE.Vector3(),true);camera.updateMatrixWorld(true);
   assert.ok(Math.abs(camera.position.distanceTo(new r.THREE.Vector3(0,5.3,0))-26)<1e-8,'bonus distance was clamped');
   assert.ok(camera.getWorldDirection(new r.THREE.Vector3()).distanceTo(new r.THREE.Vector3(0,-2.6,-22).normalize())<1e-8,'bonus angle drifted');
   for(const [name,point]of [['feet',[0,.1,0]],['head',[0,2.5,0]],['high cap',[3,10.56,0]]]){
    const q=new r.THREE.Vector3(...point).project(camera);assert.ok(Math.abs(q.x)<1.1&&q.y>-.85&&q.y<.7&&q.z<1,`${course.id}/${aspect} cropped ${name}: ${q.toArray()}`);
   }
   framing.restore(camera);framing.apply(camera,match,new r.THREE.Vector3(12.5,0,0),true);camera.updateMatrixWorld(true);
   const receiver=new r.THREE.Vector3(12.5,1,0).project(camera);assert.ok(Math.abs(receiver.x)<1&&Math.abs(receiver.y)<1,'close camera failed to follow to the receiver');
   assert.equal(camera.fov,49,'bonus changed the shared lens');
  }
 }
 const view=r.l.cameraViews[0];assert.equal(view.cameraFollowTargetHeight,5.3);
 const captured=r.l.captureData();assert.equal(captured.components.find(c=>c.cameraView).cameraFollowTargetHeight,5.3);
 // Saved/editor framing and the underlying rig cannot change the bonus lens
 // or angle; ordinary authored views still retain their own framing and cap.
 const overridden={...BONUS_PRESENTATION_VIEW.view,p:[0,0,0],s:[200,200,200],cameraPosition:[20,30,-4],cameraFov:35,cameraFollowDistance:80};
 assert.equal(cameraViewAt([overridden],0,0,0,true),BONUS_PRESENTATION_VIEW);
 const ordinary=cameraViewAt([overridden],0,0,0);
 assert.equal(ordinary.view,overridden);
 for(const lens of [35,75]){
  const camera=new r.THREE.PerspectiveCamera(lens,16/9,.1,400),framing=new CameraViewFraming();
  framing.apply(camera,BONUS_PRESENTATION_VIEW,new r.THREE.Vector3(),true);
  assert.equal(camera.fov,49);framing.restore(camera);assert.equal(camera.fov,lens);
  framing.apply(camera,ordinary,new r.THREE.Vector3(),true);
  assert.ok(Math.abs(camera.position.distanceTo(new r.THREE.Vector3(0,5.3,0))-18)<1e-8);
  assert.equal(camera.fov,35);
 }
 console.log('PASS',THEMED_BONUS_COURSES.length,'uniform 26 m bonus cameras: shared angle/lens, visible hero/caps/receivers, saved overrides ignored and ordinary views preserved');
},{modulePath:'/src/level.ts',levelId:'bonus-jungle-terraces',source:m=>m.findLevel('bonus-jungle-terraces').data});
