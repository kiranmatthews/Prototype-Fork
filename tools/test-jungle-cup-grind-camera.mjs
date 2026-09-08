import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, player, level, step, CONST }) => {
  const { SkateChaseCamera, SKATE_CAMERA } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const { SKATE_PARK } = await server.ssrLoadModule('/src/skateParkPhysics.ts');
  // Exercise the same supported-state routing as the shipped render loop.
  const main = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /grounded: player\.skateCameraSupported/);
  const subject = () => ({ position: player.pos, heading: player.skateCameraHeading,
    up: player.skateCameraUp, vertAir: player.vertAir, vertNormal: player.vertNormal,
    verticalSpeed: player.vVel, speed: player.cameraSkateSpeed,
    grounded: player.skateCameraSupported, bailing: player.skateCameraBailing });
  const makeCamera = () => ({ rig: new SkateChaseCamera(),
    camera: new THREE.PerspectiveCamera(SKATE_CAMERA.verticalFov, 16 / 9, .1, 400) });
  const tickCamera = ({ rig, camera }, snap = false) => {
    rig.update(camera, subject(), CONST.fixedStep, snap, level.groundMeshes);
    camera.updateMatrixWorld(true);
    assert.ok(camera.position.toArray().every(Number.isFinite));
    assert.ok(camera.quaternion.toArray().every(Number.isFinite));
    for (const height of [.1, 1.5, 3]) {
      const ndc = player.pos.clone().addScaledVector(player.skateCameraUp, height).project(camera);
      assert.ok(Math.abs(ndc.x) < .97 && Math.abs(ndc.y) < .97,
        `grind camera cropped the rider (${ndc.x}, ${ndc.y})`);
    }
  };
  const place = (position, heading, speed = 14) => {
    player.respawn(level, true, true, { position, heading });
    player.pos.copy(position); player.prevPos.copy(position);
    player.axisF.copy(heading).normalize(); player.axisL.set(player.axisF.z, 0, -player.axisF.x);
    player.freeSkate = player.airFromSkate = true; player.speed = speed;
    player.balanceBoostT = 20; // Isolate camera travel from unrelated random balance bails.
  };
  const checkTangent = rail => {
    const travel = rail.tangentAt(player.grindT).multiplyScalar(player.grindDir);
    assert.ok(player.skateCameraHeading.dot(travel) > .999999,
      'grind camera retained the approach heading instead of the signed rail tangent');
    assert.equal(player.skateCameraSupported, true);
    assert.equal(player.vertAir, false, 'rail catch retained the completed vert camera mode');
    return travel;
  };

  let catches = 0, grindFrames = 0, exits = 0;
  for (const rail of level.grindRails.slice(1, 6)) for (const dir of [-1, 1]) {
    const t = dir > 0 ? 1 : rail.totalLength - 1;
    const tangent = rail.tangentAt(t).multiplyScalar(dir);
    const approach = tangent.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    const start = rail.pointAt(t).add(new THREE.Vector3(.1, .3, .1));
    place(start, approach);
    player.state = 'air'; player.grounded = false; player.vVel = 0;
    const view = makeCamera(); tickCamera(view, true);
    step(makeInput({ grindHeld: true, grindPressed: true, moveX: .7 }));
    assert.equal(player.state, 'grind', 'actual input did not catch the authored rail');
    assert.equal(player.grindRail, rail);
    assert.equal(player.grindDir, dir);
    assert.ok(['board', 'lip'].includes(player.grindStyle), 'test did not catch with a crosswise trick pose');
    checkTangent(rail); tickCamera(view); catches++;
    const runOff = rail === level.grindRails[3];
    for (let frame = 0; frame < (runOff ? 120 : 28); frame++) {
      // Crouch and release through the real grind handler to check the hop.
      // The south flat bar also checks natural end exits in both directions.
      step(makeInput({ grindHeld: true, jumpHeld: !runOff && frame < 27,
        jumpReleased: !runOff && frame === 27 }));
      tickCamera(view);
      if (player.state !== 'grind') break;
      const travel = checkTangent(rail); grindFrames++;
      if (frame >= 14) {
        const behind = view.camera.position.clone().sub(view.rig.aim).normalize();
        assert.ok(behind.dot(travel) < -.95, 'camera did not settle behind the rail travel');
      }
    }
    assert.equal(player.state, 'air');
    assert.equal(player.skateCameraSupported, false);
    assert.ok(player.skateCameraHeading.dot(tangent) > .999999, 'grind hop changed follow direction');
    const before = player.pos.clone();
    step(makeInput()); tickCamera(view);
    assert.ok(player.pos.clone().sub(before).dot(tangent) > 0, 'grind exit stopped rail momentum');
    exits++;
  }

  // The real continuous coping changes its tangent while axisF remains the
  // catch heading. Follow a complete corner in both directions.
  const coping = level.grindRails[0];
  for (const dir of [-1, 1]) {
    const startT = dir > 0 ? 1 : 25;
    const tangent = coping.tangentAt(startT).multiplyScalar(dir);
    place(coping.pointAt(startT).add(new THREE.Vector3(0, .25, 0)), tangent);
    player.state = 'air'; player.grounded = false; player.vVel = 0;
    const view = makeCamera(); tickCamera(view, true);
    step(makeInput({ grindHeld: true, grindPressed: true }));
    assert.equal(player.state, 'grind'); catches++;
    let changed = 0;
    for (let frame = 0; frame < 90; frame++) {
      step(makeInput({ grindHeld: true }));
      assert.equal(player.state, 'grind', 'continuous corner unexpectedly ejected rider');
      const travel = checkTangent(coping); grindFrames++;
      changed = Math.max(changed, tangent.angleTo(travel));
      tickCamera(view);
      // The unchanged reference spring can lag a moving corner, but it must
      // remain behind travel rather than parking at the original heading.
      if (frame >= 30) {
        const behind = view.camera.position.clone().sub(view.rig.aim).normalize();
        assert.ok(behind.dot(travel) < -.6, 'camera lost the rider around curved coping');
      }
    }
    assert.ok(changed > 1, 'test did not traverse a meaningful coping bend');
  }

  // Actual angled vert launches, then Triangle catches nearby coping. The
  // signed expectation comes from incoming flight, not the resulting grind
  // state: that would miss a catch which reversed direction and slowed down.
  for (const [label, position, heading] of [
    ['curved', [30, .1, 8], [.8, 0, 1]],
    ['left', [0, .1, 10], [-.6, 0, 1]],
    ['right', [0, .1, 10], [.6, 0, 1]],
    ['zero', [0, .1, 10], [0, 0, 1]],
  ]) {
    place(new THREE.Vector3(...position), new THREE.Vector3(...heading).normalize(), 15.3);
    player.state = 'ride'; player.grounded = true;
    player.groundHit = player.queryGround(level); player.rideNormal.copy(player.groundHit.normal);
    const view = makeCamera(); tickCamera(view, true);
    let sawVert = false, caught = false;
    for (let frame = 0; frame < 400; frame++) {
      const wasVert = player.vertAir;
      const incoming = new THREE.Vector3(-player.vertNormal.z * player.vertLatVel,
        0, player.vertNormal.x * player.vertLatVel);
      step(makeInput({ jumpHeld: true, grindHeld: sawVert, grindPressed: sawVert && !caught }));
      tickCamera(view);
      if (player.vertAir) sawVert = true;
      if (player.state === 'grind') {
        assert.equal(wasVert, true, `${label}: test failed to catch directly from vert air`);
        const travel = checkTangent(coping);
        if (label === 'zero') {
          assert.equal(incoming.length(), 0, 'test did not make a straight-up catch');
          assert.equal(player.grindDir, 1, 'stationary coping catch lost its existing direction fallback');
          assert.equal(player.grindVel, CONST.grindMinSpeed, 'stationary coping catch lost its existing speed fallback');
        } else assert.ok(incoming.dot(travel) > 0, `${label}: coping catch reversed incoming travel`);
        if (label === 'left' || label === 'right') {
          assert.ok(incoming.length() > 8, 'test did not carry meaningful coping speed');
          assert.ok(Math.abs(player.grindVel - incoming.length()) < 1e-8,
            `${label}: aligned vert catch discarded incoming coping speed`);
        }
        assert.equal(player.pipeHang, false);
        assert.equal(player.vertTracked, false);
        assert.equal(player.parkFlightGravity, SKATE_PARK.airGravity, 'rail exit inherits completed vert gravity');
        caught = true; catches++;
        break;
      }
    }
    assert.ok(sawVert && caught, `${label}: test never completed a real vert-to-coping catch`);
    for (let frame = 0; frame < 35; frame++) {
      step(makeInput({ grindHeld: true, jumpHeld: frame < 34, jumpReleased: frame === 34 }));
      tickCamera(view);
      if (player.state === 'grind') checkTangent(coping);
    }
    assert.equal(player.state, 'air');
    assert.equal(player.vertAir, false);
    assert.equal(player.skateCameraSupported, false);
    exits++;
  }
  console.log(`PASS Jungle Cup grind camera: ${catches} actual rail catches, ${grindFrames} straight/curved grind frames in both directions, ${exits} exits, and immediate vert-to-coping handoff with full rider framing.`);
});
