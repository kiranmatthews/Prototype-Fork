import { readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

// Actual supported Player inputs and production camera rigs. The historical
// rig is compiled from the exact reported revision, not a duplicated formula.
const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
const source = pack.levels.find(entry => entry.id === 'slip').data;
const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const historical = await readFile(new URL('./fixtures/slipstream-camera-90b9b0d.txt', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(historical).digest('hex'), '5acfe3a77b0dc919f97fc40c7dd7ee92ce9d8beed61f0e6cdea18f0f4833dbcf',
  'Historical fixture must remain the exact production camera block from 90b9b0d');
const cameraBlock = source => {
  const begin = source.indexOf('const camTarget = new THREE.Vector3();');
  const end = source.indexOf('\ncamera.position\n  .copy(player.renderPosition)', begin);
  if (begin < 0 || end <= begin) throw Error('Production camera extraction markers changed');
  return source.slice(begin, end);
};
const factory = source => {
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function('deps', `
  const {THREE,TUNING,newLaneCursor,cameraRigFraming,setCameraRigAim,LoopCameraFraming,CameraHeroFraming,
    cameraViewAt,cameraViewDirection,CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,
    ChiefCamera,SkateChaseCamera,SkateChaseCameraOverlay,CourseCameraHeading,fitCameraRigHorizontal,level,player,camera}=deps;
  const current={id:'slip'},worldMapController=null,oceanOverview=false,oceanReview=false,BOULDER_FOV=27,input={lookX:0,lookY:0};
  ${code}
  return {step:updateCamera,heading:camControlDir,cursor:cameraLaneCursor};
`);
};
const makeRig = factory(cameraBlock(main)), makeHistorical = factory(historical);
const secondBegin = main.indexOf('const cam2LaneTarget = new THREE.Vector3();');
const secondEnd = main.indexOf('\nplayer.cam = camera;', secondBegin);
assert.ok(secondBegin >= 0 && secondEnd > secondBegin, 'P2 production camera extraction markers changed');
const secondCode = ts.transpileModule(main.slice(secondBegin, secondEnd), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const makeSecondRig = new Function('deps', `
  const {THREE,TUNING,newLaneCursor,cameraRigFraming,setCameraRigAim,LoopCameraFraming,CameraHeroFraming,
    cameraViewAt,cameraViewDirection,CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,
    ChiefCamera,SkateChaseCameraOverlay,CourseCameraHeading,fitCameraRigHorizontal,level,p2,camera,camera2}=deps;
  const current={id:'slip'},oceanOverview=false,oceanReview=false,BOULDER_FOV=27,boulderF=0,input2={lookX:0,lookY:0};
  const cam2F=new THREE.Vector3(0,0,-1),cam2Aim=new THREE.Vector3(),cam2Look=new CameraLookOffset(),cam2LaneCursor=newLaneCursor();
  let cam2RenderSnapVersion=-1,cam2SpeedFovBoost=0;
  ${secondCode}
  return {step:updateBaseCamera2,cursor:cam2LaneCursor,localHeading:cam2F};
`);
const yaw = p => Math.atan2(p.x, -p.z);
const angle = value => Math.atan2(Math.sin(value), Math.cos(value)) * 180 / Math.PI;

await withBlockworksRuntime(async r => {
  const { p, l, THREE, TUNING, server } = r;
  const dependencies = { THREE, TUNING };
  for (const name of ['level','cameraRig','loopCamera','cameraHeroFraming','cameraViews','cameraLook','cameraSpeedEffect','boss/camera','skateChaseCamera'])
    Object.assign(dependencies, await server.ssrLoadModule(`/src/${name}.ts`));
  const legacyLevel = new Proxy(l, { get: (target, key) => key === 'cameraLookAhead' ? undefined : Reflect.get(target, key, target) });
  const cameras = [[l, makeRig, 'current'], [l, makeHistorical, '90b9b0d'], [legacyLevel, makeRig, 'without look-ahead']].map(([level, create, name]) => {
    const camera = new THREE.PerspectiveCamera(TUNING.camFov, 16 / 9, .1, 1800);
    const rig = create({ ...dependencies, level, player: p, camera });
    rig.step(r.dt); return { name, camera, rig, previousYaw: yaw(camera.getWorldDirection(new THREE.Vector3())) };
  });
  const phases = [], rows = [];
  const move = (label, frames, input) => {
    const metrics = { label, frames: 0, maxVisualControlError: [0, 0, 0], maxYawDegreesPerSecond: [0, 0, 0],
      maxRelativeEyeSpeed: [0, 0, 0], maxCanonicalDifference: 0, maxPitchDifference: 0, maxFovDifference: 0,
      maxEyeHeightDifference: 0, minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    let previousPos = p.renderPosition.clone(), previousEyes = cameras.map(c => c.camera.position.clone());
    for (let i = 0; i < frames; i++) {
      const canonical = cameras[0].rig.heading;
      const quantized = Math.round(Math.atan2(canonical.x, canonical.z) * 1e4) / 1e4;
      p.camDir.set(Math.sin(quantized), 0, Math.cos(quantized));
      r.tick(typeof input === 'function' ? input(i) : input);
      const row = { frame: r.frame, label, position: p.pos.toArray(), state: p.state, grounded: p.grounded,
        speed: p.speed, cameras: [] };
      const dx = p.renderPosition.x - previousPos.x, dz = p.renderPosition.z - previousPos.z;
      for (let k = 0; k < cameras.length; k++) {
        const { camera, rig } = cameras[k]; rig.step(r.dt); camera.updateMatrixWorld(true);
        const direction = camera.getWorldDirection(new THREE.Vector3()), visualYaw = yaw(direction), canonicalYaw = yaw(rig.heading);
        const mismatch = angle(visualYaw - canonicalYaw), rate = angle(visualYaw - cameras[k].previousYaw) / r.dt;
        const relativeEyeSpeed = Math.hypot(camera.position.x - previousEyes[k].x - dx, camera.position.z - previousEyes[k].z - dz) / r.dt;
        metrics.maxVisualControlError[k] = Math.max(metrics.maxVisualControlError[k], Math.abs(mismatch));
        metrics.maxYawDegreesPerSecond[k] = Math.max(metrics.maxYawDegreesPerSecond[k], Math.abs(rate));
        metrics.maxRelativeEyeSpeed[k] = Math.max(metrics.maxRelativeEyeSpeed[k], relativeEyeSpeed);
        row.cameras.push({ visualYaw: visualYaw * 180 / Math.PI, controlYaw: canonicalYaw * 180 / Math.PI,
          mismatch, rate, relativeEyeSpeed, eye: camera.position.toArray(), laneStation: rig.cursor.s });
        cameras[k].previousYaw = visualYaw; previousEyes[k].copy(camera.position);
      }
      metrics.maxCanonicalDifference = Math.max(metrics.maxCanonicalDifference,
        Math.abs(angle(yaw(cameras[0].rig.heading) - yaw(cameras[1].rig.heading))));
      metrics.maxPitchDifference = Math.max(metrics.maxPitchDifference,
        Math.abs(cameras[0].camera.getWorldDirection(new THREE.Vector3()).y - cameras[1].camera.getWorldDirection(new THREE.Vector3()).y));
      metrics.maxFovDifference = Math.max(metrics.maxFovDifference, Math.abs(cameras[0].camera.fov - cameras[1].camera.fov));
      metrics.maxEyeHeightDifference = Math.max(metrics.maxEyeHeightDifference, Math.abs(cameras[0].camera.position.y - cameras[1].camera.position.y));
      previousPos.copy(p.renderPosition); rows.push(row); metrics.frames++;
      metrics.minX = Math.min(metrics.minX, p.pos.x); metrics.maxX = Math.max(metrics.maxX, p.pos.x);
      metrics.minZ = Math.min(metrics.minZ, p.pos.z); metrics.maxZ = Math.max(metrics.maxZ, p.pos.z);
      if (p.isBailing || ['dead', 'gameover'].includes(p.state)) { metrics.failedAt = row; break; }
    }
    phases.push(metrics);
  };
  move('opening idle', 30, {});
  move('opening right strafe', 55, { moveX: 1 });
  move('opening right coast', 30, {});
  move('opening left reversal', 105, { moveX: -1 });
  move('opening left coast', 30, {});
  move('opening recenter', 60, { moveX: 1 });
  move('opening settle', 30, {});
  move('opening backtrack', 30, { moveY: -1 });
  move('opening backward coast', 30, {});
  move('opening reverse to forward', 35, { moveY: 1 });
  move('opening reverse settle', 30, {});
  const target = new THREE.Vector3(); let braking = false;
  move('real controlled charge through first drop, bends and corkscrew', 3100, () => {
    const next = l.cameraLanePointAhead(p.laneCursor, 5, target);
    if (p.speed > 20) braking = true; else if (p.speed < 17) braking = false;
    return { ...(next ? r.steerToward(next) : { moveY: 1 }), jumpHeld: true,
      grabHeld: braking && p.grounded };
  });
  const { SLIPSTREAM_CAMERA } = await server.ssrLoadModule('/src/levels/slipstream-camera.ts');
  assert.equal(l.lanePts.length, 170);
  assert.deepEqual(source.components.filter(c => c.t === 'camnode').map(c => c.p), SLIPSTREAM_CAMERA);
  assert.deepEqual(source.components.find(c => c.t === 'gate').p, [0, .2, -842]);
  const { SLIPSTREAM_2_LEVEL } = await server.ssrLoadModule('/src/levels/slipstream-2.ts');
  assert.deepEqual(pack.levels.find(c => c.id === 'slipstream-2').data, JSON.parse(JSON.stringify(SLIPSTREAM_2_LEVEL)), 'Camera repair must preserve Slipstream 2');
  const native = new r.Level(new THREE.Scene(), { id: 'slip', name: 'Native Slipstream' });
  for (let i = 0; i < l.lanePts.length; i++) assert.ok(Math.hypot(l.lanePts[i].x - native.lanePts[i].x,
    l.lanePts[i].y - native.lanePts[i].y, l.lanePts[i].z - native.lanePts[i].z) < 1e-6);
  native.dispose();
  const points = l.lanePts, arc = l.laneArc;
  const at = s => {
    let i = arc.findIndex(v => v > s) - 1;
    i = Math.max(0, i < 0 ? points.length - 2 : i);
    const a = points[i], b = points[i + 1], t = (s - arc[i]) / (arc[i + 1] - arc[i]);
    return new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  };
  const stationary = [];
  for (const hz of [30, 60]) for (const aspect of [16 / 9, 9 / 16]) for (const s of [2, 80, 240, 440, 620, 960, 1160]) {
    const base = at(s), tangent = l.cameraDirAt(...base.toArray()), current = {
      renderPosition: base.clone(), renderSnapVersion: 1, grounded: true, state: 'ride', speed: 0,
      cameraSkateSpeed: 0, groundBelowY: base.y, swimming: false, balanceMeter: null,
      cameraPoseBounds: null,
    }, centre = { ...current, renderPosition: base.clone() };
    const camera = new THREE.PerspectiveCamera(TUNING.camFov, aspect, .1, 1800), centreCamera = camera.clone();
    const rig = makeRig({ ...dependencies, level: l, player: current, camera });
    const centreRig = makeRig({ ...dependencies, level: l, player: centre, camera: centreCamera });
    let error = 0, jump = 0, heroX = 0, previous;
    for (let i = 0; i < hz * 4; i++) {
      const side = 7.5 * Math.sin(i / hz * Math.PI / 2);
      current.renderPosition.copy(base).add(new THREE.Vector3(-tangent.z * side, 0, tangent.x * side));
      rig.step(1 / hz); centre.renderPosition.copy(at(rig.cursor.s)); centre.groundBelowY = centre.renderPosition.y;
      centreRig.step(1 / hz); camera.updateMatrixWorld(true); centreCamera.updateMatrixWorld(true);
      const currentYaw = yaw(camera.getWorldDirection(new THREE.Vector3())), centreYaw = yaw(centreCamera.getWorldDirection(new THREE.Vector3()));
      error = Math.max(error, Math.abs(angle(currentYaw - centreYaw)));
      if (previous !== undefined) jump = Math.max(jump, Math.abs(angle(currentYaw - previous)));
      previous = currentYaw;
      for (const x of [-.7, .7]) for (const y of [0, 2.8]) for (const z of [-.7, .7]) {
        const ndc = current.renderPosition.clone().add(new THREE.Vector3(x, y, z)).project(camera);
        heroX = Math.max(heroX, Math.abs(ndc.x));
      }
    }
    stationary.push({ hz, aspect, s, maximumMatchedCentreYawError: error, maximumFrameYawJump: jump, maximumHeroX: heroX });
  }
  const cursorStress = { samples: 0, maximumProjectionError: 0, maximumArcStep: 0 };
  for (const side of [-7.5, 0, 7.5]) for (const height of [0, 8, 20]) for (const direction of [1, -1]) {
    const cursor = dependencies.newLaneCursor(), reference = dependencies.newLaneCursor(), future = new THREE.Vector3();
    for (let i = 0; i <= Math.floor(1100 / 3); i++) {
      const s = direction > 0 ? i * 3 : 1100 - i * 3, centre = at(s);
      const tangent = l.cameraDirAt(...centre.toArray(), reference);
      const subject = centre.add(new THREE.Vector3(-tangent.z * side, height, tangent.x * side));
      const previous = cursor.s;
      l.cameraDirAt(...subject.toArray(), cursor);
      cursorStress.maximumProjectionError = Math.max(cursorStress.maximumProjectionError, Math.abs(cursor.s - s));
      if (previous >= 0) cursorStress.maximumArcStep = Math.max(cursorStress.maximumArcStep, Math.abs(cursor.s - previous));
      const selected = cursor.s;
      l.cameraLanePointAhead(cursor, 15, future);
      assert.equal(cursor.s, selected, 'Presentation look-ahead must not move the selected branch');
      assert.ok(future.distanceTo(at(selected + 15)) < 1e-6, 'Look-ahead must retain the selected self-crossing branch');
      cursorStress.samples++;
    }
  }
  const secondPlayer = [];
  for (const hz of [30, 60]) for (const aspect of [16 / 9, 9 / 16]) for (const s of [2, 440]) {
    const base = at(s), tangent = l.cameraDirAt(...base.toArray());
    const p2 = { renderPosition: base.clone(), renderSnapVersion: 1,
      grounded: true, state: 'ride', speed: 0, cameraSkateSpeed: 0, swimming: false,
      cameraPoseBounds: null, camDir: new THREE.Vector3(0, 0, -1) };
    const camera = new THREE.PerspectiveCamera(TUNING.camFov, aspect, .1, 1800), camera2 = camera.clone();
    const rig = makeSecondRig({ ...dependencies, level: l, p2, camera, camera2 });
    let yawError = 0, controlError = 0, heroX = 0, angularJump = 0, previous, initialYaw, initialAnticipation;
    for (let i = 0; i < hz * 4; i++) {
      const side = 7.5 * Math.sin(i / hz * Math.PI / 2);
      p2.renderPosition.copy(base).add(new THREE.Vector3(-tangent.z * side, 0, tangent.x * side));
      rig.step(1 / hz); camera2.updateMatrixWorld(true);
      const visual = yaw(camera2.getWorldDirection(new THREE.Vector3()));
      if (i === 0) {
        initialYaw = visual; initialAnticipation = Math.abs(angle(visual - yaw(p2.camDir)));
        assert.ok(p2.camDir.distanceTo(new THREE.Vector3(tangent.x, 0, tangent.z)) < 1e-12,
          'P2 snapped controls must retain the local lane tangent');
      }
      yawError = Math.max(yawError, Math.abs(angle(visual - initialYaw)));
      controlError = Math.max(controlError, Math.abs(angle(yaw(p2.camDir) - yaw(rig.localHeading))));
      if (previous !== undefined) angularJump = Math.max(angularJump, Math.abs(angle(visual - previous)));
      previous = visual;
      for (const x of [-.7, .7]) for (const y of [0, 2.8]) for (const z of [-.7, .7]) {
        const ndc = p2.renderPosition.clone().add(new THREE.Vector3(x, y, z)).project(camera2);
        heroX = Math.max(heroX, Math.abs(ndc.x));
      }
    }
    secondPlayer.push({ hz, aspect, s, maximumYawError: yawError, maximumControlError: controlError,
      initialAnticipation, maximumFrameYawJump: angularJump, maximumHeroX: heroX });
  }
  const firstHeading = new dependencies.CourseCameraHeading(), secondHeading = new dependencies.CourseCameraHeading();
  const origin = new THREE.Vector3(), local = { x: 0, z: -1 };
  firstHeading.step(origin, new THREE.Vector3(10, 0, 0), local, 1 / 60, true);
  secondHeading.step(origin, new THREE.Vector3(0, 0, -10), local, 1 / 60, true);
  const savedSecondHeading = secondHeading.forward.clone();
  firstHeading.step(null, null, local, 1 / 60, false);
  firstHeading.step(origin, new THREE.Vector3(0, 0, 10), local, 1 / 60, true);
  assert.ok(secondHeading.forward.distanceTo(savedSecondHeading) < 1e-12, 'P1 heading reset must not alter P2');
  const savedFirstHeading = firstHeading.forward.clone();
  secondHeading.step(null, null, local, 1 / 60, false);
  secondHeading.step(origin, new THREE.Vector3(-10, 0, 0), local, 1 / 60, true);
  assert.ok(firstHeading.forward.distanceTo(savedFirstHeading) < 1e-12, 'P2 heading reset must not alter P1');
  const report = { cameraLookAhead: l.cameraLookAhead, tuning: { camDist: TUNING.camDist, camHeight: TUNING.camHeight,
    camPitch: TUNING.camPitch, camFov: TUNING.camFov }, phases, stationary, cursorStress, secondPlayer,
    independentHeadingResets: true, end: r.snapshot(), deaths: p.totalDeaths, rows };
  await writeFile(`${tmpdir()}/slipstream-camera-dynamics.json`, JSON.stringify(report, null, 2));
  const opening = phases.filter(phase => phase.label.startsWith('opening'));
  console.log(JSON.stringify({ frames: r.frame, deaths: p.totalDeaths, end: p.pos.toArray(), cameraNames: cameras.map(c => c.name),
    openingMaximumYawError: [0, 1, 2].map(k => Math.max(...opening.map(row => row.maxVisualControlError[k]))),
    openingMaximumYawDegreesPerSecond: [0, 1, 2].map(k => Math.max(...opening.map(row => row.maxYawDegreesPerSecond[k]))),
    controlledCourse: phases.at(-1), stationarySweeps: stationary.length,
    maximumMatchedCentreYawError: Math.max(...stationary.map(row => row.maximumMatchedCentreYawError)),
    maximumStationaryFrameYawJump: Math.max(...stationary.map(row => row.maximumFrameYawJump)),
    maximumHeroNdcX: Math.max(...stationary.map(row => row.maximumHeroX)), nodes: l.lanePts.length,
    cursorStress, secondPlayer, independentHeadingResets: true }, null, 2));
  if (!process.argv.includes('--diagnostic')) {
    assert.ok(opening.every(phase => phase.maxVisualControlError[0] < .5), 'Actual opening strafes must not orbit the camera');
    assert.ok(opening.every(phase => phase.maxYawDegreesPerSecond[0] < 1), 'Opening lateral input must preserve stable yaw');
    assert.ok(opening.some(phase => phase.maxVisualControlError[1] > 20), 'Historical fixture must reproduce the reported swing');
    assert.ok(phases.every(phase => phase.maxCanonicalDifference < 1e-6), 'Presentation fix must preserve canonical control yaw');
    assert.ok(phases.every(phase => phase.maxPitchDifference < 1e-10 && phase.maxFovDifference === 0 && phase.maxEyeHeightDifference < 1e-10),
      'Yaw/pan fix must preserve authored lens, pitch and vertical framing');
    assert.ok(phases.every(phase => !phase.failedAt), 'Actual movement must remain supported through the tested course');
    assert.equal(p.totalDeaths, 0);
    assert.ok(stationary.every(row => row.maximumMatchedCentreYawError < 1e-4), 'A lateral offset cannot steer anticipation');
    assert.ok(stationary.every(row => row.maximumFrameYawJump < 2), 'Stationary lateral sweeps must not jump angularly');
    assert.ok(stationary.every(row => row.maximumHeroX < 1), 'Minimum lateral pan must keep the full rider envelope visible');
    assert.ok(cursorStress.maximumProjectionError < 12 && cursorStress.maximumArcStep < 40,
      'Forward/backward lateral airborne poses must retain the current corkscrew branch');
    assert.ok(secondPlayer.every(row => row.maximumYawError < .5 && row.maximumControlError < 1e-6 && row.maximumFrameYawJump < 1),
      'P2 lateral opening movement must preserve view and local control yaw');
    assert.ok(secondPlayer.every(row => row.maximumHeroX < 1), 'P2 minimum pan must preserve the complete rider envelope');
    assert.ok(secondPlayer.some(row => row.initialAnticipation > 2), 'P2 local-control check must exercise a real bend with different presentation yaw');
    assert.equal(TUNING.hugeDropDistance, 24); assert.equal(TUNING.hugeDropImpact, 20);
  }
}, { modulePath: '/src/level.ts', source: () => source, levelId: 'slip', endlessDeaths: true,
  maxFrames: 4000, controlFrame: r => r.p.courseInputDirection(r.l) ?? { x: r.p.camDir.x, z: r.p.camDir.z } });
