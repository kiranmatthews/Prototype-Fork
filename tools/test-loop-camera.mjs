import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import ts from 'typescript';
import * as THREE from 'three';
import { normalizeGameInput } from './blockworks-runner.mjs';

const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
new Function('noop', fixture.slice(fixture.indexOf('function installHeadlessDom()'),
  fixture.indexOf('\nconst held')) + '\ninstallHeadlessDom();')(() => {});
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
const levels=[];
try {
  const { LoopCameraFraming } = await server.ssrLoadModule('/src/loopCamera.ts');
 const {SkateChaseCamera,SkateChaseCameraOverlay}=await server.ssrLoadModule('/src/skateChaseCamera.ts');
 const {ChiefCamera}=await server.ssrLoadModule('/src/boss/camera.ts');
  const { CameraHeroFraming } = await server.ssrLoadModule('/src/cameraHeroFraming.ts');
  const { sampleLoop, createLoopMeshData } = await server.ssrLoadModule('/src/loopRide.ts');
  const { Level, newLaneCursor } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { TUNING, CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { cameraRigFraming, setCameraRigAim, CourseCameraHeading, fitCameraRigHorizontal } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { cameraViewAt, cameraViewDirection, CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraLookOffset } = await server.ssrLoadModule('/src/cameraLook.ts');
  const { speedSkateFovTarget, stepSpeedSkateFov } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  const framing=cameraRigFraming(TUNING), distance=Math.hypot(framing.distance,framing.height);
  const near=(a,b,why,e=1e-8)=>assert.ok(Math.abs(a-b)<e,`${why}: ${a} != ${b}`);
  assert.ok(framing.distance<6 && distance<8,'loop camera must use the normal close skating distances');
  const base=(camera,subject,forward)=>{
    camera.position.copy(subject).addScaledVector(forward,-framing.distance).add(new THREE.Vector3(0,framing.height,0));
    camera.up.set(0,1,0);setCameraRigAim(new THREE.Vector3(),camera.position,forward,framing.pitch);
    camera.lookAt(setCameraRigAim(new THREE.Vector3(),camera.position,forward,framing.pitch));
  };
  const shape={radius:26,width:12,offset:20}, turn=new THREE.Vector3(0,1,0);
  // Entry, both walls, crown and exit in three world headings. Camera distance
  // and lens stay ordinary; the inward up/tangent basis carries inversion.
  for(const yaw of [0,90,180]) {
    const q=new THREE.Quaternion().setFromAxisAngle(turn,yaw*Math.PI/180);
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(q);
    const camera=new THREE.PerspectiveCamera(49,16/9,.1,500),layer=new LoopCameraFraming();
    for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2]) {
      const sample=sampleLoop(shape,angle),subject=new THREE.Vector3(...sample.point).applyQuaternion(q).add(new THREE.Vector3(138,0,0));
      const frame={normal:new THREE.Vector3(...sample.normal).applyQuaternion(q),tangent:new THREE.Vector3(...sample.tangent).applyQuaternion(q)};
      layer.restore(camera);base(camera,subject,forward);
      const original=camera.position.clone(),orientation=camera.quaternion.clone(),up=camera.up.clone();
      layer.apply(camera,frame,subject,framing,1/60);
      near(camera.position.distanceTo(subject),distance,'loop camera widened its normal follow distance');
      near(camera.up.dot(frame.normal),1,'camera did not turn its up with the track');
      near(camera.fov,49,'loop camera changed the normal lens');
      camera.updateMatrixWorld(true);
      for(const height of [.1,1.2,2.4]) {
        const point=subject.clone().addScaledVector(frame.normal,height).project(camera);
        assert.ok(Math.abs(point.x)<1 && Math.abs(point.y)<1,'ordinary rider envelope left the close camera');
      }
      layer.restore(camera);
      near(camera.position.distanceTo(original),0,'overlay polluted the underlying camera position');
      near(camera.quaternion.angleTo(orientation),0,'overlay polluted camera orientation',1e-7);
      near(camera.up.distanceTo(up),0,'overlay polluted camera up');
    }
    // A failure can release the camera while inverted. Its transition must
    // stay outside the rider, and expire back to the exact normal rig.
    const subject=new THREE.Vector3(138,45,0),frame={normal:new THREE.Vector3(0,-1,0),tangent:forward.clone().negate()};
    base(camera,subject,forward);layer.apply(camera,frame,subject,framing,1/60);
    for(let i=0;i<60;i++) {
      layer.restore(camera);subject.y-=.25;base(camera,subject,forward);
      const original=camera.position.clone(),orientation=camera.quaternion.clone();
      layer.apply(camera,null,subject,framing,1/60);
      assert.ok(camera.position.distanceTo(subject)>5 && camera.position.distanceTo(subject)<8,'exit blend passed through the rider or zoomed away');
      if(i===59){near(camera.position.distanceTo(original),0,'failed loop retained camera offset');near(camera.quaternion.angleTo(orientation),0,'failed loop retained camera roll',1e-7);}
    }
    layer.restore(camera);base(camera,subject,forward);layer.apply(camera,frame,subject,framing,1/60);
    layer.restore(camera);subject.set(400,0,80);base(camera,subject,forward);
    const teleported=camera.clone();layer.apply(camera,null,subject,framing,1/60,true);
    assert.ok(camera.position.equals(teleported.position)&&camera.quaternion.equals(teleported.quaternion),
      'a respawn/level snap retained the old loop horizon');
    const unused=new LoopCameraFraming(),saved=camera.clone();
    unused.apply(camera,null,subject,framing,1/60);
    assert.ok(camera.position.equals(saved.position)&&camera.quaternion.equals(saved.quaternion)&&camera.up.equals(saved.up)&&camera.fov===saved.fov,
      'an ordinary nonloop camera changed');
  }

  // Execute the production wrapper, with a second camera whose presentation
  // getter is disabled, proving the loop overlay cannot feed back into controls.
  const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  const begin=main.indexOf('const cameraViewFraming = new CameraViewFraming();');
  const end=main.indexOf('\ncamera.position\n  .copy(player.renderPosition)',begin);
  const code=ts.transpileModule(main.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const makeRig=new Function('deps',`
    const {THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
      CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,level,player,camera}=deps;
    const current={id:'loop-camera-fixture'},worldMapController=null,oceanOverview=false,oceanReview=false,BOULDER_FOV=27,input={lookX:0,lookY:0};
    const cameraLook=new CameraLookOffset(),cameraLaneCursor=newLaneCursor(),camF=new THREE.Vector3(0,0,1),camControlDir=new THREE.Vector3(0,0,1),prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
    const cameraLaneTarget=new THREE.Vector3(),cameraViewForward=new THREE.Vector3(),cameraLaneOrigin=new THREE.Vector3(),cameraLaneHeading=new CourseCameraHeading(),skateChaseCamera=new SkateChaseCamera();
    let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0,camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
    ${code}
    return {step:updateCamera,heading:camControlDir};`);
  const deps={THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
    CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor};
  const source={v:1,name:'Yawed close loop',spawn:[138,.03,-14],killY:-30,cameraAirLift:1,components:[
    {t:'platform',p:[138,-.5,-12],s:[12,1,24],edgeGrinding:false},
    {t:'speedpad',p:[138,.025,-7],s:[12,.15,14],speed:64,cycle:.6},
    {t:'mesh',p:[138,0,0],yaw:180,...createLoopMeshData(26,12,20),w:12,loopRadius:26,loopOffset:20,loopRequired:true,doubleSided:true,edgeGrinding:false},
    {t:'platform',p:[118,-.5,22],s:[12,1,44],edgeGrinding:false},{t:'gate',p:[118,0,38],yaw:180},
    {t:'camnode',p:[138,0,-40]},{t:'camnode',p:[138,0,80]},
  ]};
  const results=[];
  for(const coast of [false,true]) {
    const l=new Level(new THREE.Scene(),{id:'loop-camera-fixture',name:source.name,data:source});levels.push(l);l.root.updateMatrixWorld(true);
    const p=new Player(l.scene);p.enterLevel('loop-camera-fixture');p.respawn(l,true,false,{position:new THREE.Vector3(...source.spawn),heading:new THREE.Vector3(0,0,1)});
    const camera=new THREE.PerspectiveCamera(TUNING.camFov,16/9,.1,500),oldCamera=camera.clone();
    const unchanged=new Proxy(p,{get:(target,key)=>(key==='loopPresentationFrame'||key==='loopFallPresentation')?null:Reflect.get(target,key,target)});
    const rig=makeRig({...deps,level:l,player:p,camera}),ordinary=makeRig({...deps,level:l,player:unchanged,camera:oldCamera});
    let previous={},entered=false,detached=false,after=0,maxDistance=0,minY=Infinity,maxY=-Infinity,vertices=0;
    const releaseBounds={minY:Infinity,maxY:-Infinity,samples:0};
    const quarters=new Set(),tuningBefore=JSON.stringify(TUNING),v=new THREE.Vector3();
    for(let frame=0;frame<1400;frame++) {
      const input=normalizeGameInput({moveY:1,jumpHeld:!coast||!entered},previous);previous={...input};
      p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);p.commitRenderStep(l);
      entered ||= p.loopStatus.active;
      if(entered&&!p.loopStatus.active&&p.state==='air')detached=true;
      p.applyRenderInterpolation(.5);
      const motion=JSON.stringify({pos:p.pos.toArray(),speed:p.speed,heading:p.axisF.toArray(),state:p.state});
      rig.step(CONST.fixedStep);ordinary.step(CONST.fixedStep);
      assert.equal(JSON.stringify({pos:p.pos.toArray(),speed:p.speed,heading:p.axisF.toArray(),state:p.state}),motion,'camera altered gameplay state');
      near(rig.heading.distanceTo(ordinary.heading),0,'camera altered canonical control direction');near(camera.fov,oldCamera.fov,'loop lens diverged from normal speed framing');
      if(p.loopStatus.active) {
        const frameInfo=p.loopPresentationFrame,mesh=l.loopMeshes[0],local=mesh.worldToLocal(p.renderPosition.clone());
        const expected=sampleLoop(shape,Math.atan2(-local.z,26-local.y));
        const n=new THREE.Vector3(...expected.normal).transformDirection(mesh.matrixWorld);
        near(n.distanceTo(frameInfo.normal),0,'getter sampled physics rather than interpolated surface normal');
        maxDistance=Math.max(maxDistance,camera.position.distanceTo(p.renderPosition));
        near(camera.position.distanceTo(p.renderPosition),distance,'production loop widened the camera');
        quarters.add(Math.min(3,Math.floor(p.loopStatus.progress*4)));
      }
      if((p.loopStatus.active||after>0)&&frame%6===0) {
          p.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
          p.riderRef.traverseVisible(o=>{
            if(!o.isMesh||!o.geometry?.getAttribute('position'))return;
            const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m.visible===false||m.opacity===0))return;
            for(let i=0;i<o.geometry.getAttribute('position').count;i++) {
              o.getVertexPosition(i,v);v.applyMatrix4(o.matrixWorld).project(camera);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);vertices++;
              if(!p.loopStatus.active){releaseBounds.minY=Math.min(releaseBounds.minY,v.y);releaseBounds.maxY=Math.max(releaseBounds.maxY,v.y);releaseBounds.samples++;}
            }
          });
      }
      p.restoreRenderPose();
      assert.equal(p.totalDeaths,0);
      if(!coast)assert.equal(p.isBailing,false,'charged camera fixture did not keep a clean rider');
      if((!coast&&p.loopStatus.completed)||(coast&&detached)) {if(++after>25)break;}
    }
    assert.ok(entered&&vertices>100,'fixture never rendered a mounted loop rider');
    assert.ok(minY>-1&&maxY<1,`actual close-loop rider left viewport: ${JSON.stringify({coast,minY,maxY,releaseBounds})}`);
    if(coast){assert.ok(detached&&p.isBailing&&p.loopFallPresentation);assert.equal(p.freeSkate,false);assert.equal(p.loopPresentationFrame,null,'failed loop retained contact presentation');assert.ok(camera.up.y>.85,'fall horizon did not level');}
    else {assert.equal(quarters.size,4,'charged fixture missed a quarter of the loop');assert.equal(p.loopStatus.completed,1);assert.ok(Math.abs(p.pos.x-118)<7,'yaw180 loop exited on the wrong world side');}
    assert.equal(JSON.stringify(TUNING),tuningBefore);
    results.push({coast,quarters:[...quarters],maxDistance,minY,maxY,vertices,releaseBounds,completed:p.loopStatus.completed,detached});p.group.removeFromParent();
  }
  console.log(JSON.stringify({normalDistance:framing.distance,normalHeight:framing.height,results},null,2));
  console.log('PASS normal-distance loop camera through yawed inversion, interpolated contact, failure/exit restore, actual rider framing, and unchanged controls/tuning/lens');
} finally {for(const l of levels)l.dispose();await server.close();console.warn=warn;console.error=error;}
