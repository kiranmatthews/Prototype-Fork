import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import ts from 'typescript';
import * as THREE from 'three';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
const near = (a, b, why, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${why}: ${a} != ${b}`);
let level;
try {
  const { Level, newLaneCursor } = await server.ssrLoadModule('/src/level.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { cameraRigFraming, setCameraRigAim } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { cameraViewAt, cameraViewDirection, CameraViewFraming } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CameraLookOffset } = await server.ssrLoadModule('/src/cameraLook.ts');
  const { speedSkateFovTarget, stepSpeedSkateFov } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_SECTIONS: sections } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
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
  const world = (section, u, y, v) => {
    const a = section.yaw * Math.PI / 180;
    return new THREE.Vector3(section.start[0] + Math.cos(a) * u - Math.sin(a) * v, y,
      section.start[2] - Math.sin(a) * u - Math.cos(a) * v);
  };
  let directionSamples = 0, cameraFrames = 0;
  const evidence = [];
  for (const [index, start, end] of [[1, 5, 150], [7, 25, 155], [11, 20, 155]]) {
    const section = sections[index], yaw = section.yaw * Math.PI / 180;
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    // Sweep former view boundaries, side switches, both travel directions,
    // jump apices and returns from checkpoints, with separate camera cursors.
    for (const direction of [1, -1]) {
      const cursor = newLaneCursor();
      for (let step = 0; step <= 120; step++) {
        const v = direction > 0 ? start + (end - start) * step / 120 : end - (end - start) * step / 120;
        for (const u of [-14, -12, -6, 0, 6, 12, 14]) for (const rise of [0, 2.4, 6, 12]) {
          const p = world(section, u, section.start[1] + rise, v);
          for (const history of [undefined, cursor]) {
            const heading = level.cameraDirAt(p.x, p.y, p.z, history);
            assert.ok(heading, 'puzzle camera lost its spine');
            near(heading.x, forward.x, `section ${index + 1} heading X at ${[u, rise, v]}`);
            near(heading.z, forward.z, `section ${index + 1} heading Z at ${[u, rise, v]}`);
            directionSamples++;
          }
        }
      }
    }
    for (const aspect of [16 / 9, 390 / 844]) {
      const player = { renderPosition: world(section, 0, section.start[1], start),
        renderSnapVersion: 1, grounded: true, speed: 0, cameraSkateSpeed: 0,
        groundBelowY: section.start[1], swimming: false, balanceMeter: null };
      const camera = new THREE.PerspectiveCamera(TUNING.camFov, aspect, .1, 500);
      const referenceCamera = camera.clone();
      // A normal straight corridor is the control. Backtracking's ordinary
      // dolly and skate-speed FOV must remain identical, not be disabled.
      const referenceLevel = { cameraViews: [], boulder: null, skatepark: false,
        isCampaignMap: false, zoneAt: () => null, cameraDirAt: () => forward };
      const actual = makeRig({ ...dependencies, level, player, camera });
      const reference = makeRig({ ...dependencies, level: referenceLevel, player, camera: referenceCamera });
      let lastHeading, maxYawDelta = 0, minFov = Infinity, maxFov = -Infinity;
      const length = Math.ceil((end - start) / .12);
      for (let frame = 0; frame < length * 2; frame++) {
        const t = frame < length ? frame / length : 1 - (frame - length) / length;
        const v = start + (end - start) * t;
        const jump = Math.max(0, Math.sin(frame / 28)) * 5.4;
        const u = 9 * Math.sin(frame / 90);
        player.renderPosition.copy(world(section, u, section.start[1] + jump, v));
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
      evidence.push({ section: index + 1, aspect, footFov: [minFov, maxFov], maxYawDelta,
        normalFollowPosePreserved: true });
    }
  }
  assert.equal(JSON.stringify(TUNING), tuningBefore, 'camera test changed shared tuning');
  console.log(JSON.stringify({ directionSamples, cameraFrames, evidence }, null, 2));
  console.log('PASS Blockworks puzzle heading, no framing volumes, actual camera parity through jumps/backtracking and preserved ordinary speed lens');
} finally { level?.dispose(); await server.close(); }
