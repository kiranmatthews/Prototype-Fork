import assert from 'node:assert/strict';
import { withSkateRuntime,makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,player:p,level,step,CONST,TUNING})=>{
  const {SkateChaseCamera,SKATE_CAMERA}=await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const {setCameraRigAim}=await server.ssrLoadModule('/src/cameraRig.ts');
  const camera=()=>new THREE.PerspectiveCamera(SKATE_CAMERA.verticalFov,16/9,.1,400);
  const framing={camDist:TUNING.camDist,camHeight:TUNING.camHeight,camPitch:TUNING.camPitch,camFov:TUNING.camFov};
  const subject={position:new THREE.Vector3(2,1,3),heading:new THREE.Vector3(0,0,-1),up:new THREE.Vector3(0,1,0),
    vertAir:false,vertNormal:new THREE.Vector3(0,0,1),verticalSpeed:0,speed:12,grounded:true,bailing:false};
  for(const settings of [framing,{camDist:6.3,camHeight:6.6,camPitch:35,camFov:54}])for(const yaw of [0,.7,Math.PI,-1.8]){
    const rig=new SkateChaseCamera(),actual=camera(),expected=camera(),aim=new THREE.Vector3();
    subject.heading.set(Math.sin(yaw),0,-Math.cos(yaw));
    rig.update(actual,subject,0,true,[],settings);
    expected.position.copy(subject.position).addScaledVector(subject.heading,-settings.camDist);expected.position.y+=settings.camHeight;
    setCameraRigAim(aim,expected.position,subject.heading,settings.camPitch);expected.lookAt(aim);
    assert.ok(actual.position.distanceTo(expected.position)<1e-10,'flat eye differs from main-game framing');
    assert.ok(actual.quaternion.angleTo(expected.quaternion)<1e-7,'flat pitch/yaw differs from main game');
    assert.equal(actual.fov,settings.camFov);assert.equal(rig.groundFramingWeight,1);
  }
  // Both runs keep exactly the same legacy internal frame, even though one
  // presents the main-game shot on the approach. Steep/vert output must match.
  const oldRig=new SkateChaseCamera(),newRig=new SkateChaseCamera(),oldCamera=camera(),newCamera=camera();
  let protectedFrames=0,maxStep=0;const previous=new THREE.Vector3();
  for(let frame=0;frame<240;frame++){
    const rising=frame<60,air=frame>=60&&frame<150;
    const angle=rising?frame/60*Math.PI/2:air?Math.PI/2:Math.max(0,(210-frame)/60*Math.PI/2);
    subject.grounded=!air;subject.vertAir=air;subject.up.set(0,Math.cos(angle),Math.sin(angle));
    subject.heading.set(0,Math.sin(angle),-Math.cos(angle));
    if(frame>=150)subject.heading.negate();
    subject.position.set(0,5*(1-Math.cos(angle))+(air?4*Math.sin((frame-60)/90*Math.PI):0),-5*Math.sin(angle));
    oldRig.update(oldCamera,subject,1/60,frame===0,[]);
    newRig.update(newCamera,subject,1/60,frame===0,[],framing);
    if(frame>0)maxStep=Math.max(maxStep,newCamera.position.distanceTo(previous));previous.copy(newCamera.position);
    if(air||angle>=35*Math.PI/180){
      protectedFrames++;
      assert.equal(newRig.groundFramingWeight,0);
      assert.ok(newCamera.position.distanceTo(oldCamera.position)<1e-10,'steep/vert eye changed');
      assert.ok(newCamera.quaternion.angleTo(oldCamera.quaternion)<1e-7,'steep/vert swing changed');
      assert.equal(newCamera.fov,SKATE_CAMERA.verticalFov);
    }
  }
  assert.ok(maxStep<.7,`approach/recovery snapped ${maxStep}m`);
  const end=[];
  for(const hz of [30,60,120]){
    const rig=new SkateChaseCamera(),cam=camera();subject.position.set(0,0,0);subject.up.set(0,1,0);subject.heading.set(0,0,-1);subject.vertAir=false;subject.grounded=true;
    rig.update(cam,subject,0,true,[],framing);
    subject.up.set(0,Math.cos(.35),Math.sin(.35));subject.heading.set(.5,Math.sin(.35),-Math.cos(.35)).normalize();
    for(let i=0;i<hz;i++)rig.update(cam,subject,1/hz,false,[],framing);
    end.push({p:cam.position.clone(),q:cam.quaternion.clone(),fov:cam.fov});
  }
  for(const view of end){assert.ok(view.p.distanceTo(end[0].p)<1e-7);assert.ok(view.q.angleTo(end[0].q)<1e-7);assert.ok(Math.abs(view.fov-end[0].fov)<1e-7);}
  // Real perimeter approaches include camera collision, launch and return.
  let airs=0,worstFraming=0;
  for(const [pos,heading] of [[[0,.1,10],[0,0,1]],[[28,.1,-90],[0,0,-1]],[[28,.1,-42],[1,0,0]],[[-37,.1,-108],[-1,0,-1]]]){
    p.respawn(level,true,true,{position:new THREE.Vector3(...pos),heading:new THREE.Vector3(...heading)});
    p.axisF.set(...heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=16;
    p.groundHit=p.queryGround(level);p.rideNormal.copy(p.groundHit.normal);
    const rig=new SkateChaseCamera(),cam=camera();let launched=false,landed=false;
    for(let i=0;i<420;i++){
      step(makeInput({jumpHeld:true}));
      const s={position:p.pos,heading:p.skateCameraHeading,up:p.skateCameraUp,vertAir:p.vertAir,vertNormal:p.vertNormal,
        verticalSpeed:p.vVel,speed:p.cameraSkateSpeed,grounded:p.skateCameraSupported,bailing:p.skateCameraBailing};
      rig.update(cam,s,CONST.fixedStep,i===0,level.groundMeshes,framing);cam.updateMatrixWorld(true);
      for(const height of [.1,1.5,3]){const point=p.pos.clone().addScaledVector(p.skateCameraUp,height).project(cam);
        worstFraming=Math.max(worstFraming,Math.abs(point.x),Math.abs(point.y));assert.ok(Math.abs(point.x)<.97&&Math.abs(point.y)<.97,'new shot cropped the rider');}
      if(p.vertAir){launched=true;assert.equal(rig.groundFramingWeight,0);}
      if(launched&&p.grounded){landed=true;break;}
      assert.equal(p.isBailing,false,'neutral approach bailed');
    }
    assert.ok(landed,'real vert route did not return');airs++;
  }
  console.log(`PASS main-game flat framing, ${protectedFrames} unchanged steep/vert samples, smooth return, 30/60/120 Hz parity and ${airs} real vert routes; framing ${worstFraming.toFixed(3)}.`);
});
