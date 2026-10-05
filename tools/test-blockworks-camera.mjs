import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import ts from 'typescript';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
const near = (a, b, why, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${why}: ${a} != ${b}`);
let level;
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
try {
  const { Level, newLaneCursor } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { cameraRigFraming, setCameraRigAim, CourseCameraHeading, fitCameraRigHorizontal } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { ChiefCamera } = await server.ssrLoadModule('/src/boss/camera.ts');
  const { SkateChaseCamera, SkateChaseCameraOverlay } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const { LoopCameraFraming } = await server.ssrLoadModule('/src/loopCamera.ts');
  const { CameraHeroFraming } = await server.ssrLoadModule('/src/cameraHeroFraming.ts');
  const { cameraViewAt, cameraViewDirection, CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraInputFrame } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraLookOffset } = await server.ssrLoadModule('/src/cameraLook.ts');
  const { speedSkateFovTarget, stepSpeedSkateFov } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_SECTIONS: sections, BLOCKWORKS_ROADS: roads,
    BLOCKWORKS_CAMERA_ROUTE: chord, BLOCKWORKS_GAPS: gaps, ROUTE_END, routePoint, routeTangent } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  level = new Level(new THREE.Scene(), { id: 'blockworks-camera', name: data.name, data });
  level.root.updateMatrixWorld(true);
  assert.equal(level.cameraViews.length, 0, 'Blockworks reintroduced spatial zoom/framing volumes');
  assert.equal(level.zones.length, 0, 'puzzle zones override the ordinary camera');
  assert.ok(level.laneActive, 'the winding route still needs its ordered camera spine');
  const tuningBefore = JSON.stringify(TUNING);

  // Run the exact production camera functions, transpiled in isolation from
  // the renderer and main loop. No copied camera algorithm can drift from main.
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  const from = main.indexOf('const cameraViewFraming = new CameraViewFraming();');
  const to = main.indexOf('\ncamera.position\n  .copy(player.renderPosition)', from);
  assert.ok(from >= 0 && to > from, 'camera function extraction points changed');
  const cameraCode = ts.transpileModule(main.slice(from, to), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const makeRig = new Function('deps', `
    const {THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
      CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,
      newLaneCursor,level,player,camera}=deps;
    const current={id:'codex-lab'}, worldMapController=null, oceanOverview=false, oceanReview=false;
    const BOULDER_FOV=27, input={lookX:0,lookY:0};
    const cameraLook=new CameraLookOffset(), cameraLaneCursor=newLaneCursor();
    const camF=new THREE.Vector3(0,0,-1),camControlDir=new THREE.Vector3(0,0,-1);
    const prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
    const cameraLaneTarget=new THREE.Vector3(),cameraViewForward=new THREE.Vector3(),cameraLaneOrigin=new THREE.Vector3(),cameraLaneHeading=new CourseCameraHeading(),skateChaseCamera=new SkateChaseCamera();
    let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0;
    let camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
    ${cameraCode}
    return {step:updateCamera,heading:camControlDir};
  `);
  const dependencies = { THREE, TUNING, LoopCameraFraming, CameraHeroFraming, ChiefCamera, SkateChaseCamera, SkateChaseCameraOverlay, cameraRigFraming, setCameraRigAim, CourseCameraHeading, fitCameraRigHorizontal, cameraViewAt,
    cameraViewDirection, CameraViewFraming, CameraLookOffset, speedSkateFovTarget,
    stepSpeedSkateFov, newLaneCursor };
  const jumps=gaps.filter(g=>g.kind==='charged gap');
  const scalar=(value,s)=>typeof value==='function'?value(s):value;
  const floorAt=s=>{const road=roads.find(r=>s>=r.a&&s<=r.b);assert.ok(road,`no approach floor at ${s}`);return scalar(road.top,s);};
  const angle=(a,b)=>Math.abs(Math.atan2(a.x*b.z-a.z*b.x,a.x*b.x+a.z*b.z))*180/Math.PI;
  const chordDir=g=>{const a=routePoint(g.a,0),b=routePoint(g.b,0),dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz);return{x:dx/n,z:dz/n};};
  assert.ok(chord.some(p=>Math.abs(p[0])>50),'camera nodes stayed on the obsolete north-only line');
  let courseError=0,gapError=0;
  for(let s=0;s<ROUTE_END;s+=2){
    if(jumps.some(g=>s>=g.a-55&&s<=g.b+35))continue;
    const p=routePoint(s,0),t=routeTangent(s),dir=level.cameraDirAt(...p);
    courseError=Math.max(courseError,angle(dir,{x:t[0],z:t[2]}));
  }
  assert.ok(courseError<1,`camera departs from course tangent by ${courseError} degrees`);
  for(const gap of jumps)for(let s=gap.a-8;s<=gap.b+6;s+=.5)for(const u of [-3,0,3])for(const y of [0,5,15]){
    const p=routePoint(s,y,u);gapError=Math.max(gapError,angle(level.cameraDirAt(...p),chordDir(gap)));
  }
  assert.ok(gapError<.01,`gap requires a lateral aim correction of ${gapError} degrees`);
  const evidence=[];
  for(const gap of jumps){
    // Replay the actual camera at normal skate speed through the run-up.
    const player={renderPosition:new THREE.Vector3(...routePoint(gap.a-65,0)),renderSnapVersion:1,
      grounded:true,speed:23,cameraSkateSpeed:23,groundBelowY:0,swimming:false,balanceMeter:null};
    const camera=new THREE.PerspectiveCamera(TUNING.camFov,16/9,.1,500);
    const rig=makeRig({...dependencies,level,player,camera});
    for(let s=gap.a-65;s<=gap.a-1;s+=23/60){player.renderPosition.set(...routePoint(s,0));rig.step(1/60);}
    const renderedError=angle(rig.heading,chordDir(gap));
    assert.ok(renderedError<.6,`camera has not settled before jump ${gap.a}: ${renderedError} degrees`);
    evidence.push({gap:gap.a,renderedTakeoffError:renderedError});
  }
  // Actual controller, no seeded momentum and no horizontal stick correction.
  const starts=new Map([[166,135],[724,610],[1687,1590],[1754,1729],[2018,1945]]);
  for(const gap of jumps){
    const start=starts.get(gap.a);assert.ok(start!==undefined);
    const p=new Player(level.scene);p.enterLevel('blockworks-camera');
    const point=routePoint(start,floorAt(start)+.08),heading=level.cameraDirAt(...point);
    p.respawn(level,true,false,{position:new THREE.Vector3(...point),heading:new THREE.Vector3(heading.x,0,heading.z)});
    let frame=0,released=false,sawAir=false,landed=false;
    for(;frame<2400;frame++){
      const station=20-p.pos.z,release=!released&&station>=gap.a-1.7;
      let mx=0,my=1;
      if(station<gap.a-20){const target=routePoint(station+10,0),dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.hypot(dx,dz),f=level.cameraDirAt(p.pos.x,p.pos.y,p.pos.z);
        mx=(dx*-f.z+dz*f.x)/n;my=(dx*f.x+dz*f.z)/n;}
      const input=makeInput({moveX:mx,moveY:my,jumpHeld:!released&&!release,jumpPressed:frame===0,jumpReleased:release});
      if(release){assert.ok(p.grounded,`premature departure at ${gap.a}`);released=true;}
      p.step(1/60,input,level);level.update(1/60);p.flushLevelCrateRewards(level);p.commitRenderStep(level);
      assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),`forward-only jump ${gap.a} failed at ${JSON.stringify(p.pos.toArray())}`);
      if(released&&!p.grounded)sawAir=true;
      if(sawAir&&p.grounded){assert.ok(20-p.pos.z>=gap.b,`jump ${gap.a} landed short`);landed=true;break;}
    }
    assert.ok(landed,`forward-only jump ${gap.a} did not finish`);
    evidence.find(e=>e.gap===gap.a).forwardOnlyLanding=p.pos.toArray();
    p.group.removeFromParent();
  }
  assert.equal(JSON.stringify(TUNING),tuningBefore,'node alignment changed movement tuning');
  console.log(JSON.stringify({courseError,gapError,evidence},null,2));
  console.log('PASS course-aligned camera nodes and five forward-only skate jumps without lateral correction');
}finally{level?.dispose();await server.close();console.warn=warn;console.error=error;}
