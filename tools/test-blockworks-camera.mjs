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
  const { cameraRigFraming, setCameraRigAim } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { cameraViewAt, cameraViewDirection, CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraInputFrame } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraLookOffset } = await server.ssrLoadModule('/src/cameraLook.ts');
  const { speedSkateFovTarget, stepSpeedSkateFov } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_SECTIONS: sections, BLOCKWORKS_ROADS: roads,
    BLOCKWORKS_CAMERA_ROUTE: chord, ROUTE_END, routePoint, routeTangent } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
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
    const {THREE,TUNING,cameraRigFraming,setCameraRigAim,cameraViewAt,cameraViewDirection,
      CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,
      newLaneCursor,level,player,camera}=deps;
    const current={id:'codex-lab'}, worldMapController=null, oceanOverview=false, oceanReview=false;
    const BOULDER_FOV=27, input={lookX:0,lookY:0};
    const cameraLook=new CameraLookOffset(), cameraLaneCursor=newLaneCursor();
    const camF=new THREE.Vector3(0,0,-1),camControlDir=new THREE.Vector3(0,0,-1);
    const prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
    let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0;
    let camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
    ${cameraCode}
    return {step:updateCamera,heading:camControlDir};
  `);
  const dependencies = { THREE, TUNING, cameraRigFraming, setCameraRigAim, cameraViewAt,
    cameraViewDirection, CameraViewFraming, CameraLookOffset, speedSkateFovTarget,
    stepSpeedSkateFov, newLaneCursor };
  const scalar = (v, s) => typeof v === 'function' ? v(s) : v;
  const topAt = s => {
    const available = roads.filter(road => s >= road.a && s <= road.b);
    return available.length ? Math.max(...available.map(road => scalar(road.top, s))) : null;
  };
  const world = (s, u, y) => new THREE.Vector3(...routePoint(s, y, u));
  const forward = { x: 0, z: -1 };
  for (let i = 0; i < chord.length; i++) {
    near(chord[i][0], 0, 'camera/control chord follows the physical road sideways');
    if (i) assert.ok(chord[i][2] < chord[i - 1][2], 'camera chord reverses');
  }
  let directionSamples = 0, cameraFrames = 0, physicallyTurningSamples = 0;
  const evidence = [];
  for (const direction of [1, -1]) {
    const cursor = newLaneCursor(), held = new CameraInputFrame();
    for (let sample = 0; sample <= ROUTE_END; sample += 2) {
      const s = direction > 0 ? sample : ROUTE_END - sample;
      const floor = topAt(s) ?? 0, tangent = routeTangent(s);
      if (Math.abs(Math.atan2(tangent[0], -tangent[2])) > .3) physicallyTurningSamples++;
      for (const u of [-18, -6, 0, 6, 18]) for (const rise of [0, 3, 7, 15]) {
        const p = world(s, u, floor + rise);
        for (const history of [undefined, cursor]) {
          const heading = level.cameraDirAt(p.x, p.y, p.z, history);
          assert.ok(heading, 'curve lost its control chord');
          near(heading.x, 0, `auto-steered road at station ${s}`);
          near(heading.z, -1, `reversed camera at station ${s}`);
          const inputFrame = held.sample(0, 1, heading);
          near(inputFrame.x, 0, 'held Up steered a physical bend');
          near(inputFrame.z, -1, 'held Up changed course direction');
          directionSamples++;
        }
      }
    }
  }
  assert.ok(physicallyTurningSamples > 500, 'course geometry lacks substantial physical bends');
  for (const section of sections) {
    const start = section.a, end = section.b, index = sections.indexOf(section);
    for (const aspect of [16 / 9, 390 / 844]) {
      const player = { renderPosition: world(start, 0, topAt(start) ?? 0),
        renderSnapVersion: 1, grounded: true, speed: 0, cameraSkateSpeed: 0,
        groundBelowY: topAt(start), swimming: false, balanceMeter: null };
      const camera = new THREE.PerspectiveCamera(TUNING.camFov, aspect, .1, 500);
      const referenceCamera = camera.clone();
      // A normal straight corridor is the control. Backtracking's ordinary
      // dolly and skate-speed FOV must remain identical, not be disabled.
      const referenceLevel = { cameraViews: [], boulder: null, skatepark: false,
        isCampaignMap: false, zoneAt: () => null, cameraDirAt: () => forward };
      const actual = makeRig({ ...dependencies, level, player, camera });
      const reference = makeRig({ ...dependencies, level: referenceLevel, player, camera: referenceCamera });
      let lastHeading, maxYawDelta = 0, minFov = Infinity, maxFov = -Infinity;
      const length = Math.ceil((end - start) / .24);
      for (let frame = 0; frame < length * 2; frame++) {
        const t = frame < length ? frame / length : 1 - (frame - length) / length;
        const v = start + (end - start) * t;
        const jump = Math.max(0, Math.sin(frame / 28)) * 5.4;
        const u = 9 * Math.sin(frame / 90);
        const floor = topAt(v);
        player.groundBelowY = floor;
        player.renderPosition.copy(world(v, u, (floor ?? section.y) + jump));
        player.grounded = jump < .05;
        actual.step(1 / 60); reference.step(1 / 60);
        near(camera.position.distanceTo(referenceCamera.position), 0, 'puzzle changed normal follow distance/height');
        near(camera.quaternion.angleTo(referenceCamera.quaternion), 0, 'puzzle changed normal follow orientation');
        near(camera.fov, referenceCamera.fov, 'puzzle changed normal lens');
        near(camera.fov, TUNING.camFov, 'foot jumps/backtracking changed FOV');
        near(actual.heading.x, forward.x, 'jump/backtrack heading X');
        near(actual.heading.z, forward.z, 'jump/backtrack heading Z');
        const heading = Math.atan2(actual.heading.x, actual.heading.z);
        if (lastHeading !== undefined) maxYawDelta = Math.max(maxYawDelta,
          Math.abs(Math.atan2(Math.sin(heading - lastHeading), Math.cos(heading - lastHeading))));
        lastHeading = heading; minFov = Math.min(minFov, camera.fov); maxFov = Math.max(maxFov, camera.fov);
        cameraFrames++;
      }
      // The familiar high-speed lens remains a global, smoothly eased effect.
      player.cameraSkateSpeed = TUNING.maxSpeed;
      for (let frame = 0; frame < 120; frame++) {
        actual.step(1 / 60); reference.step(1 / 60);
        near(camera.fov, referenceCamera.fov, 'authored camera altered skate speed lens');
        cameraFrames++;
      }
      assert.ok(camera.fov > TUNING.camFov + TUNING.camSpeedFovBoost * .99);
      evidence.push({ section: section.name, aspect, footFov: [minFov, maxFov], maxYawDelta,
        normalFollowPosePreserved: true });
    }
  }
  const walking = new Player(level.scene), northOnlyRuns = [];
  for (const station of [30, 535, 1080, 1450, 1890]) {
    walking.enterLevel('blockworks-camera'); walking.respawn(level, true);
    walking.pos.copy(world(station, 0, (topAt(station) ?? 0) + .02));
    walking.prevPos.copy(walking.pos); walking.laneCursor.s = -1; walking.viewInput.reset();
    walking.settle(level); walking.groundHit = walking.queryGround(level);
    const before = walking.pos.clone();
    for (let frame = 0; frame < 48; frame++) {
      walking.step(1 / 60, makeInput({ moveY: 1 }), level); level.update(1 / 60);
      assert.ok(walking.grounded && !walking.isBailing, 'north-input probe lost its supported dry road');
    }
    near(walking.pos.x, before.x, 'held Up followed the road bend automatically', .001);
    assert.ok(walking.pos.z < before.z - 1, `held Up did not travel north at ${station}: ${before.toArray()} -> ${walking.pos.toArray()}`);
    const physicalCurveShift = routePoint(20 - walking.pos.z, 0)[0] - routePoint(station, 0)[0];
    assert.ok(Math.abs(physicalCurveShift) > .1, 'north-input probe was not on a physical bend');
    northOnlyRuns.push({ station, playerXShift: walking.pos.x - before.x, physicalCurveXShift: physicalCurveShift });
  }
  assert.equal(JSON.stringify(TUNING), tuningBefore, 'camera test changed shared tuning');
  console.log(JSON.stringify({ directionSamples, physicallyTurningSamples, cameraFrames, northOnlyRuns, evidence }, null, 2));
  console.log('PASS physically curved Blockworks retains north-facing camera/control, ordinary framing and unmodified speed lens');
} finally { level?.dispose(); await server.close(); console.warn = warn; console.error = error; }
