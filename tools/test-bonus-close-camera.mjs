import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {THEMED_BONUS_COURSES}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {EASY_BONUS_LEVEL}=await r.server.ssrLoadModule('/src/levels/bonus-easy.ts');
 const {BONUS_LEVEL}=await r.server.ssrLoadModule('/src/levels/bonus-level.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {CameraViewFraming,cameraViewAt,BONUS_PRESENTATION_VIEW}=await r.server.ssrLoadModule('/src/cameraViews.ts');
 // Legacy rooms use cardinal travel zones. A new cameraView would also opt
 // their physics into held-camera input, doubling the existing axis swap.
 for(const legacy of [EASY_BONUS_LEVEL,BONUS_LEVEL]){
  assert.ok(legacy.components.some(c=>c.t==='zone'&&c.dir==='E'));
  assert.ok(!legacy.components.some(c=>c.cameraView),'legacy zone movement must not acquire a camera-owned input frame');
  const level=new r.Level(new r.THREE.Scene(),{id:'bonus-legacy-camera-check',name:legacy.name,data:legacy});
  try{
   assert.equal(level.cameraViews.length,0,'render fallback was registered as a movement view');
   assert.equal(level.zoneAt(legacy.spawn[0],legacy.spawn[2])?.dir,'E');
  }finally{level.dispose();}
 }
 const courses=[...THEMED_BONUS_COURSES,{id:'bonus-easy',data:EASY_BONUS_LEVEL},{id:'bonus',data:BONUS_LEVEL}];
 for(const course of courses){
  // Validate the camera export independently of each theme's scenery schema.
  const normalized=normalizeCustomLevelData({...course.data,components:course.data.components.filter(c=>c.t==='camnode')});assert.ok(normalized,course.id);
  const views=normalized.components.filter(c=>c.t==='camnode'&&c.cameraView).map(c=>({yaw:0,...c,feather:c.radius??1}));
  const match=cameraViewAt(views,...normalized.spawn,true),spec=match.view;
  assert.ok(spec,`${course.id} has no authored side view`);
  assert.equal(spec.cameraFollowDistance,26);assert.equal(spec.cameraFollowTargetHeight,5.3);
  assert.equal(match,BONUS_PRESENTATION_VIEW,`${course.id} did not use the uniform shot`);
  assert.equal(cameraViewAt(views,1e4,100,-100,true),match,'bonus shot changed outside the camera volume');
  for(const aspect of [16/9,4/3,390/844]){
   const camera=new r.THREE.PerspectiveCamera(49,aspect,.1,400),framing=new CameraViewFraming();
   const step=(x,y,groundY,grounded=false,snap=false)=>{
    framing.restore(camera);
    framing.apply(camera,match,new r.THREE.Vector3(x,y,0),snap,{groundY,grounded,dt:1/60});
    camera.updateMatrixWorld(true);
   };
   const projected=point=>new r.THREE.Vector3(...point).project(camera);
   const actorVisible=(x,y)=>{
    const feet=projected([x,y,0]),head=projected([x,y+2.5,0]);
    assert.ok(feet.y>=-.801&&head.y<=.651&&Math.abs(feet.x)<1,
     `${course.id}/${aspect} clipped actor at ${y}: feet ${feet.y}, head ${head.y}`);
   };
   step(0,0,0,true,true);
   const supportedEye=camera.position.clone(),supportedAim=camera.quaternion.clone();
   assert.ok(Math.abs(camera.position.distanceTo(new r.THREE.Vector3(0,5.3,0))-26)<1e-8,'bonus zoom was clamped back to the ordinary camera limit');
   const direction=camera.getWorldDirection(new r.THREE.Vector3());
   const expected=new r.THREE.Vector3(0,-2.6,-22).normalize();
   assert.ok(direction.distanceTo(expected)<1e-8,'bonus angle drifted from the shared side view');
   for(const [name,point]of [['feet',[0,.1,0]],['head',[0,2.5,0]],['high cap',[3,10.56,0]]]){
    const q=projected(point);assert.ok(Math.abs(q.x)<1.1&&q.y>-.85&&q.y<.7&&q.z<1,`${course.id}/${aspect} cropped ${name}: ${q.toArray()}`);
   }
   // Ordinary jumps pass through the stable shot. A crate or ledge under an
   // airborne rider must not be mistaken for an already-supported height.
   for(const [y,floor]of [[1,0],[3,0],[6,4],[4,null],[2,0],[0,0]]){
    step(0,y,floor);actorVisible(0,y);
    assert.ok(camera.position.distanceTo(supportedEye)<1e-8,`${course.id} followed an ordinary jump or future receiver`);
    assert.ok(camera.quaternion.angleTo(supportedAim)<1e-7,'jump rotated the side view');
   }
   // Tall arrow bounces retain the head; settling on a raised receiver then
   // moves the stable floor anchor, without changing the lens or orientation.
   for(const y of [18,21,24]){step(0,y,0);actorVisible(0,y);}
   assert.ok(camera.position.y>supportedEye.y,'tall bounce did not lift the safety frame');
   for(let frame=0;frame<150;frame++){step(0,10,10,true);actorVisible(0,10);}
   assert.ok(Math.abs(camera.position.y-supportedEye.y-10)<.001,'raised landing did not settle the floor anchor');
   for(const y of [9,7,4,2,0]){step(0,y,0);actorVisible(0,y);}
   for(let frame=0;frame<150;frame++)step(0,0,0,true);
   assert.ok(Math.abs(camera.position.y-supportedEye.y)<.001,'lower receiver did not restore floor framing');
   step(12.5,50,50,true,true);actorVisible(12.5,50);
   assert.ok(Math.abs(camera.position.y-supportedEye.y-50)<1e-8,'respawn reused the previous floor anchor');
   const receiver=projected([12.5,51,0]);
   assert.ok(Math.abs(receiver.x)<1&&Math.abs(receiver.y)<1,'close camera failed to follow to the receiver');
   assert.equal(camera.fov,49,'bonus changed the shared lens');
   // Existing non-bonus authored views retain their original live-Y follow.
   framing.restore(camera);framing.apply(camera,match,new r.THREE.Vector3(0,0,0),true);
   const normalY=camera.position.y;
   framing.restore(camera);framing.apply(camera,match,new r.THREE.Vector3(0,6,0));
   assert.ok(Math.abs(camera.position.y-normalY-6)<1e-8,'optional bonus context changed ordinary authored views');
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
 console.log('PASS',courses.length,'uniform 26m bonus cameras: shared angle/lens; stable jumps, tall bounces, raised/lower receivers and respawn; legacy movement and ordinary views preserved; desktop and portrait visible');
},{modulePath:'/src/level.ts',levelId:'bonus-jungle-terraces',source:m=>m.findLevel('bonus-jungle-terraces').data});
