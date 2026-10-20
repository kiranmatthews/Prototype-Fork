import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { withWaterparkRuntime } from './waterpark-runner.mjs';
import { createWaterparkPilot } from './waterpark-pilot.mjs';

const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
const begin=main.indexOf('const cameraViewFraming = new CameraViewFraming();');
const end=main.indexOf('\ncamera.position\n  .copy(player.renderPosition)',begin);
assert.ok(begin>=0&&end>begin);
const code=ts.transpileModule(main.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const rigFactory=cameraCode=>new Function('deps',`
 const {THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CameraFallHold,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
 CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,level,player,camera}=deps;
 const current={id:'waterpark'},worldMapController=null,oceanOverview=false,oceanReview=false,BOULDER_FOV=27,input={lookX:0,lookY:0};
 const cameraLook=new CameraLookOffset(),cameraLaneCursor=newLaneCursor(),camF=new THREE.Vector3(0,0,1),camControlDir=new THREE.Vector3(0,0,1),prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
 const cameraLaneTarget=new THREE.Vector3(),cameraViewForward=new THREE.Vector3(),cameraLaneOrigin=new THREE.Vector3(),cameraLaneHeading=new CourseCameraHeading(),skateChaseCamera=new SkateChaseCamera();
 let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0,camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
 ${cameraCode}
 return {step:updateCamera,heading:camControlDir,target:camTarget,get surfaceOverlayActive(){return loopCameraFraming.active||player.authoredSkateCamera;}};`);
const makeRig=rigFactory(code);
// Preserve the exact previous damping as the reference for every non-opt-in
// path, including a user who sets the global tuning slider to full follow.
const legacyCode=code.replace(/if \(level\.cameraAirLift === 1\)\s*camera\.position\.y = camTarget\.y;\s*else\s*camera\.position\.y \+= \(camTarget\.y - camera\.position\.y\) \* kY;/,
 'camera.position.y += (camTarget.y - camera.position.y) * kY;');
assert.notEqual(legacyCode,code,'authored full-follow comparison point missing');
const legacyRig=rigFactory(legacyCode);
await withWaterparkRuntime(async r=>{
 const {p,l,server,THREE,TUNING,CONST,source}=r,tuningBefore=JSON.stringify(TUNING);
 const {newLaneCursor}=await server.ssrLoadModule('/src/level.ts');
 const {LoopCameraFraming}=await server.ssrLoadModule('/src/loopCamera.ts');
 const {SkateChaseCameraOverlay,SkateChaseCamera}=await server.ssrLoadModule('/src/skateChaseCamera.ts');
 const {ChiefCamera}=await server.ssrLoadModule('/src/boss/camera.ts');
  const { CameraHeroFraming } = await server.ssrLoadModule('/src/cameraHeroFraming.ts');
 const {cameraRigFraming,setCameraRigAim,CameraFallHold,CourseCameraHeading,fitCameraRigHorizontal}=await server.ssrLoadModule('/src/cameraRig.ts');
 const {cameraViewAt,cameraViewDirection,CameraViewFraming}=await server.ssrLoadModule('/src/cameraViews.ts');
 const {CameraLookOffset}=await server.ssrLoadModule('/src/cameraLook.ts');
 const {speedSkateFovTarget,stepSpeedSkateFov}=await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
 const camera=new THREE.PerspectiveCamera(TUNING.camFov,16/9,.1,500),partialCamera=camera.clone();
 assert.equal(l.cameraAirLift,1,'Deadwater must explicitly opt into full vertical follow');
 assert.equal(TUNING.camAirLift,0,'Deadwater authored follow must leave the shared camera default unchanged');
 const full=l;
 const partial=new Proxy(l,{get:(target,key)=>key==='cameraAirLift'?.8:Reflect.get(target,key,target)});
 const deps={THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CameraFallHold,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
 CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,player:p};
 const rig=makeRig({...deps,level:full,camera}),old=makeRig({...deps,level:partial,camera:partialCamera});
 const scopes=[{name:'ordinary default',value:undefined,global:TUNING.camAirLift},
  {name:'Blockworks partial follow',value:.8,global:TUNING.camAirLift},
  {name:'global full-follow slider',value:undefined,global:1}].map(spec=>{
   const scope=new Proxy(l,{get:(target,key)=>key==='cameraAirLift'?spec.value:Reflect.get(target,key,target)});
   const scopeTuning={...TUNING,camAirLift:spec.global},a=camera.clone(),b=camera.clone();
   return {...spec,a,b,current:makeRig({...deps,TUNING:scopeTuning,level:scope,camera:a}),
    previous:legacyRig({...deps,TUNING:scopeTuning,level:scope,camera:b})};
 });
 const gap=source.WATERPARK_JUMPS[2],pilot=createWaterparkPilot(source,{fastTurns:true}),phases={};
 assert.equal(l.cameraViews.length,0,'normal close camera must have no spectator override');
 let released=false,airborne=false,landed=false,peak=0,maxY=-Infinity,minY=Infinity,maxX=0,oldMaxY=-Infinity,oldMinY=Infinity,samples=0,vertices=0,maxYFollowError=0;
 const point=new THREE.Vector3(),referenceCamera=camera.clone(),referenceSwing=new SkateChaseCamera();
 let swingWasActive=false,swingVersion=-1,swingFrames=0,swingAirFrames=0;
 for(let frame=0;frame<5000;frame++){
  r.tick(pilot.sample(p,l));pilot.observe(p,l);
  released ||= p.state==='air';airborne ||= !p.grounded;
  p.applyRenderInterpolation(.5);
  const physical=JSON.stringify({p:p.pos.toArray(),speed:p.speed,axis:p.axisF.toArray(),state:p.state,bounds:p.interactionBoundsDiagnostics});
  rig.step(CONST.fixedStep);old.step(CONST.fixedStep);
  if(p.authoredSkateCamera){
   referenceSwing.update(referenceCamera,{position:p.renderPosition,heading:p.skateCameraHeading,up:p.skateCameraUp,
    vertAir:p.vertAir,vertNormal:p.vertNormal,verticalSpeed:p.vVel,speed:p.cameraSkateSpeed,grounded:p.skateCameraSupported,bailing:p.skateCameraBailing},
    CONST.fixedStep,!swingWasActive||swingVersion!==p.renderSnapVersion,l.groundMeshes,
    {camDist:TUNING.parkCamDist,camHeight:TUNING.parkCamHeight,camPitch:TUNING.parkCamPitch,camFov:TUNING.parkCamFov});
   assert.ok(camera.position.distanceTo(referenceCamera.position)<1e-8&&camera.quaternion.angleTo(referenceCamera.quaternion)<1e-7,'Giant vert must use the competition swing unchanged');
   assert.equal(camera.fov,referenceCamera.fov);swingFrames++;swingAirFrames+=p.vertAir;
  }
  swingWasActive=p.authoredSkateCamera;swingVersion=p.renderSnapVersion;
  if(!rig.surfaceOverlayActive)
   maxYFollowError=Math.max(maxYFollowError,Math.abs(camera.position.y-rig.target.y));
  for(const scope of scopes){
   scope.current.step(CONST.fixedStep);scope.previous.step(CONST.fixedStep);
   assert.ok(scope.a.position.equals(scope.b.position)&&scope.a.quaternion.equals(scope.b.quaternion)&&
    scope.a.up.equals(scope.b.up)&&scope.a.fov===scope.b.fov&&scope.current.heading.equals(scope.previous.heading),
    `${scope.name} camera no longer matches its exact previous behavior`);
  }
  assert.equal(JSON.stringify({p:p.pos.toArray(),speed:p.speed,axis:p.axisF.toArray(),state:p.state,bounds:p.interactionBoundsDiagnostics}),physical,'camera changed movement');
  assert.ok(rig.heading.distanceTo(old.heading)<1e-9,'air following changed the canonical control heading');
  assert.equal(camera.fov,partialCamera.fov,'air framing widened the lens');
  assert.equal(TUNING.camDist,5.05,'air framing changed normal camera distance');
  if(airborne&&!p.grounded){
   peak=Math.max(peak,p.pos.y);
   const phase=phases[pilot.phase]??={minY:Infinity,maxY:-Infinity,samples:0};phase.samples++;
   p.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);partialCamera.updateMatrixWorld(true);samples++;
   p.riderRef.traverseVisible(object=>{
    if(!object.isMesh||!object.geometry?.getAttribute('position'))return;
    const mats=Array.isArray(object.material)?object.material:[object.material];if(mats.every(m=>m.visible===false||m.opacity===0))return;
    for(let i=0;i<object.geometry.getAttribute('position').count;i++){
     object.getVertexPosition(i,point);point.applyMatrix4(object.matrixWorld);const previous=point.clone().project(partialCamera);point.project(camera);
     minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);phase.minY=Math.min(phase.minY,point.y);phase.maxY=Math.max(phase.maxY,point.y);maxX=Math.max(maxX,Math.abs(point.x));oldMinY=Math.min(oldMinY,previous.y);oldMaxY=Math.max(oldMaxY,previous.y);vertices++;
    }
   });
  }
  p.restoreRenderPose();
  assert.ok(!p.isBailing&&p.totalDeaths===0,'flume camera test hid a failed jump');
  if(pilot.evidence.jumps.length===source.WATERPARK_JUMPS.length)landed=true;
  if(p.state==='finished')break;
 }
 assert.ok(swingFrames>200&&swingAirFrames>60);
 const result={swingFrames,swingAirFrames,released,airborne,landed,peak,samples,vertices,minY,maxY,maxX,oldMinY,oldMaxY,maxYFollowError,phases};
 console.log(JSON.stringify(result,null,2));
 assert.ok(landed&&peak>gap.takeoff[1]+3&&samples>20,'test must traverse the actual flume ramp air');
 assert.ok(minY>-1&&maxY<1&&maxX<1,'actual close-camera ordinary-air rider left the viewport');
 assert.equal(maxYFollowError,0,'ordinary full follow must exactly track interpolated Y outside the surface overlay');
 assert.equal(JSON.stringify(TUNING),tuningBefore);
 console.log('PASS complete close-camera spine/transfer/ramp-air route, exact fullfollowY, and unchanged default/partial/global-slider camera behavior');
});
