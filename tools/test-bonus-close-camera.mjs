import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {THEMED_BONUS_COURSES}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {EASY_BONUS_LEVEL}=await r.server.ssrLoadModule('/src/levels/bonus-easy.ts');
 const {BONUS_LEVEL}=await r.server.ssrLoadModule('/src/levels/bonus-level.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {CameraViewFraming,BONUS_PRESENTATION_VIEW}=await r.server.ssrLoadModule('/src/cameraViews.ts');
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
  const normalized=normalizeCustomLevelData(course.data);assert.ok(normalized,course.id);
  const spec=normalized.components.find(c=>c.t==='camnode'&&c.cameraView)??BONUS_PRESENTATION_VIEW.view;
  assert.ok(spec,`${course.id} has no authored side view`);
  assert.equal(spec.cameraFollowDistance,13.4);assert.equal(spec.cameraFollowTargetHeight,2.7);
  for(const aspect of [16/9,4/3,390/844]){
   const camera=new r.THREE.PerspectiveCamera(49,aspect,.1,400),framing=new CameraViewFraming();
   const match={weight:1,view:{yaw:0,feather:1,...spec}};
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
   const size=(projected([0,2.5,0]).y-projected([0,0,0]).y)/2;
   assert.ok(size>.19&&size<.29,`hero scale ${size} should match the playable reference shot`);
   for(const [name,point]of [['feet',[0,.1,0]],['head',[0,2.5,0]]]){
    const q=projected(point);assert.ok(Math.abs(q.x)<1.1&&q.y>-.85&&q.y<.7&&q.z<1,`${course.id}/${aspect} cropped ${name}: ${q.toArray()}`);
   }
   // Ordinary jumps pass through the stable shot. A crate or ledge under an
   // airborne rider must not be mistaken for an already-supported height.
   for(const [y,floor]of [[1,0],[2,0],[3,2],[2,null],[0,0]]){
    step(0,y,floor);actorVisible(0,y);
    assert.ok(Math.abs(camera.position.y-supportedEye.y)<1e-8,`${course.id} followed an ordinary jump or future receiver`);
    assert.ok(camera.quaternion.angleTo(supportedAim)<1e-7,'jump rotated the side view');
   }
   // Tall arrow bounces retain the head; settling on a raised receiver then
   // moves the stable floor anchor, without changing the lens or orientation.
   for(const y of [7,9,12]){step(0,y,0);actorVisible(0,y);}
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
   assert.ok(camera.fov<=49,'portrait fitting zoomed out the gameplay lens');
   // Existing non-bonus authored views retain their original live-Y follow.
   framing.restore(camera);framing.apply(camera,match,new r.THREE.Vector3(0,0,0),true);
   const normalY=camera.position.y;
   framing.restore(camera);framing.apply(camera,match,new r.THREE.Vector3(0,6,0));
   assert.ok(Math.abs(camera.position.y-normalY-6)<1e-8,'optional bonus context changed ordinary authored views');
  }
 }
 const view=r.l.cameraViews[0];assert.equal(view.cameraFollowTargetHeight,2.7);
 const captured=r.l.captureData();assert.equal(captured.components.find(c=>c.cameraView).cameraFollowTargetHeight,2.7);
 console.log('PASS',courses.length,'production bonus cameras: stable jump/ledge/gap shot; tall-bounce, raised/lower receiver and respawn framing; ordinary views unchanged; desktop and portrait caps visible');
},{modulePath:'/src/level.ts',levelId:'bonus-jungle-terraces',source:m=>m.findLevel('bonus-jungle-terraces').data});
