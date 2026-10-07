import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { pumpAqueductRow } from './test-blockworks-aqueduct.mjs';

// Execute the production camera against a real, input-driven high-air session.
const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const begin = main.indexOf('const cameraViewFraming = new CameraViewFraming();');
const end = main.indexOf('\ncamera.position\n  .copy(player.renderPosition)', begin);
assert.ok(begin >= 0 && end > begin);
const code = ts.transpileModule(main.slice(begin, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const makeRig = new Function('deps', `
  const {THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CameraFallHold,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
    CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,
    newLaneCursor,level,player,camera}=deps;
  const current={id:'codex-lab'},worldMapController=null,oceanOverview=false,oceanReview=false;
  const BOULDER_FOV=27,input={lookX:0,lookY:0};
  const cameraLook=new CameraLookOffset(),cameraLaneCursor=newLaneCursor();
  const camF=new THREE.Vector3(0,0,-1),camControlDir=new THREE.Vector3(0,0,-1);
  const prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
  const cameraLaneTarget=new THREE.Vector3(),cameraViewForward=new THREE.Vector3(),cameraLaneOrigin=new THREE.Vector3(),cameraLaneHeading=new CourseCameraHeading(),skateChaseCamera=new SkateChaseCamera();
  let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0;
  let camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
  ${code}
  return {step:updateCamera,heading:camControlDir};
`);
let observe = () => {};
const focus = 874, k = 2 * Math.PI / 660;
await withBlockworksRuntime(async r => {
  const { p, l, THREE, TUNING, source, server } = r;
  const tuningBefore = JSON.stringify(TUNING);
  const { Level, newLaneCursor, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { cameraRigFraming, setCameraRigAim, CameraFallHold,CourseCameraHeading, fitCameraRigHorizontal } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { ChiefCamera } = await server.ssrLoadModule('/src/boss/camera.ts');
  const { SkateChaseCamera, SkateChaseCameraOverlay } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const { LoopCameraFraming } = await server.ssrLoadModule('/src/loopCamera.ts');
  const { CameraHeroFraming } = await server.ssrLoadModule('/src/cameraHeroFraming.ts');
  const { cameraViewAt, cameraViewDirection, CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraLookOffset } = await server.ssrLoadModule('/src/cameraLook.ts');
  const { speedSkateFovTarget, stepSpeedSkateFov } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  assert.equal(l.cameraAirLift, .8);
  assert.equal(l.cameraViews.length, 0, 'vertical follow must not acquire camera-view input ownership');
  assert.equal(l.captureData().cameraAirLift, .8);
  const plain = { v: 1, name: 'Default camera scope', spawn: [0, .1, 0], killY: -20,
    components: [{ t: 'platform', p: [0,-.5,0], s: [10,1,30] }, { t: 'gate', p: [0,0,-10] }] };
  const defaultLevel = new Level(new THREE.Scene(), { id: 'default-camera-scope', name: plain.name, data: plain });
  assert.equal(defaultLevel.cameraAirLift, undefined, 'opt-in leaked to an unrelated level');
  assert.equal(defaultLevel.captureData().cameraAirLift, undefined);
  defaultLevel.dispose();
  for (const value of [0, .5, 1]) assert.equal(normalizeCustomLevelData({ ...plain, cameraAirLift: value })?.cameraAirLift, value);
  for (const value of [-.01, 1.01, NaN, Infinity, '1', true, null])
    assert.equal(normalizeCustomLevelData({ ...plain, cameraAirLift: value }), null, `invalid air follow ${value}`);
  assert.equal(normalizeCustomLevelData(l.captureData())?.cameraAirLift, .8, 'capture lost authored camera follow');

  const camera = new THREE.PerspectiveCamera(TUNING.camFov, 16/9, .1, 500);
  const previousCamera = camera.clone();
  const defaults = new Proxy(l, { get: (target, key) => key === 'cameraAirLift' ? undefined : Reflect.get(target, key, target) });
  const deps = { THREE,TUNING,LoopCameraFraming,CameraHeroFraming,ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,cameraRigFraming,setCameraRigAim,CameraFallHold,CourseCameraHeading,fitCameraRigHorizontal,cameraViewAt,cameraViewDirection,
    CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,player:p };
  const rig = makeRig({ ...deps, level:l, camera });
  const legacy = makeRig({ ...deps, level:defaults, camera:previousCamera });
  const samples = [], point = new THREE.Vector3();
  observe = () => {
    rig.step(r.dt); legacy.step(r.dt);
    assert.ok(rig.heading.distanceTo(legacy.heading) < 1e-9, 'vertical follow rotated the input/camera heading');
    assert.equal(camera.fov, previousCamera.fov, 'vertical follow changed the lens');
    if (p.grounded || p.pos.y < 6 || r.frame % 4 !== 0) return;
    p.group.updateMatrixWorld(true); camera.updateMatrixWorld(true); previousCamera.updateMatrixWorld(true);
    let top=-Infinity,bottom=Infinity,oldTop=-Infinity,oldBottom=Infinity,vertices=0;
    p.riderRef.traverseVisible(object => {
      if (!object.isMesh || !object.geometry?.getAttribute('position')) return;
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      if (mats.every(mat => mat.visible === false || mat.opacity === 0)) return;
      const count = object.geometry.getAttribute('position').count;
      for (let i=0; i<count; i++) {
        object.getVertexPosition(i,point); point.applyMatrix4(object.matrixWorld);
        const old=point.clone().project(previousCamera); point.project(camera);
        top=Math.max(top,point.y); bottom=Math.min(bottom,point.y);
        oldTop=Math.max(oldTop,old.y); oldBottom=Math.min(oldBottom,old.y); vertices++;
      }
    });
    assert.ok(vertices>100, 'framing must measure the visible character geometry');
    samples.push({frame:r.frame,y:p.pos.y,top,bottom,oldTop,oldBottom,vertices});
  };
  r.stepFor(60);
  const session = pumpAqueductRow(r, focus, 1);
  observe = () => {};
  const high = samples.filter(sample => sample.y > 12);
  assert.ok(high.length > 30 && Math.max(...samples.map(sample=>sample.y)) > 15,
    'camera regression did not execute the real high-air target height');
  const peak = Math.max(...samples.map(sample=>sample.y));
  const apex = samples.filter(sample=>sample.y>peak-.25);
  assert.ok(apex.length>2 && apex.every(sample=>sample.top<1 && sample.bottom>-1),
    'the complete visible rider must remain framed at the authored high-reward apex');
  const summary = {samples:samples.length,highSamples:high.length,
    apexMaxTop:Math.max(...apex.map(s=>s.top)),apexMinBottom:Math.min(...apex.map(s=>s.bottom)),
    maxTop:Math.max(...samples.map(s=>s.top)),minBottom:Math.min(...samples.map(s=>s.bottom)),
    oldMaxTop:Math.max(...samples.map(s=>s.oldTop)),oldMinBottom:Math.min(...samples.map(s=>s.oldBottom)),
    peak:Math.max(...samples.map(s=>s.y)),airs:session.airs.length};
  console.log(JSON.stringify(summary,null,2));
  assert.ok(summary.maxTop < 1, 'authored high-air follow let the character leave the top of frame');
  assert.ok(summary.oldMaxTop > 1, 'fixture no longer reproduces the grounded-camera high-air clipping');
  assert.equal(JSON.stringify(TUNING), tuningBefore, 'level framing changed shared movement/camera tuning');
  assert.equal(l.cameraViews.length, 0);
  console.log('PASS bounded level-only camera follow, scope/roundtrip validation, unchanged controls/lens, and actual high-air character framing');
}, { start: [66*Math.sin(k*focus)-18*Math.sin(2*k*focus), .02, 20-focus], onTick:()=>observe() });
