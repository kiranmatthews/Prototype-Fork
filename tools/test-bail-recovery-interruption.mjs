import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const measureOnly = process.argv.includes('--measure-only');
const bytes = await readFile(new URL('../public/characters/three-finger-hand/three-finger-hand.glb', import.meta.url));
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST, TUNING }) => {
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { createRiggedCartoonHandPairFromScene, attachAndSyncRiggedCartoonHandPair } = await server.ssrLoadModule('/src/character/riggedCartoonHand.ts');
  const { removeProceduralCartoonGloveSurface } = await server.ssrLoadModule('/src/character/cartoonGlove.ts');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'interrupted-recovery', name: 'Interrupted recovery', data: {
    v: 1, name: 'Interrupted recovery', spawn: [0, .04, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false },
      { t: 'platform', p: [0, -4.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }],
  } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  const pair = createRiggedCartoonHandPairFromScene(gltf.scene);
  attachAndSyncRiggedCartoonHandPair(pair, p.gloveLeft, p.gloveRight);
  p.riggedCartoonHands = pair; p.riggedCartoonHandState = 'ready';
  removeProceduralCartoonGloveSurface(p.gloveLeft); removeProceduralCartoonGloveSurface(p.gloveRight);
  p.rebuildCharacterRenderBatches(); p.syncCharacterAppearance();
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const grounds = [...level.groundMeshes], walls = [...level.walls];
  const random = Math.random, rows = [], head = new THREE.Vector3(), previous = new THREE.Vector3();
  const delta = new THREE.Vector3(), lastDelta = new THREE.Vector3(), body = new THREE.Quaternion(), priorBody = new THREE.Quaternion();
  const angular = new THREE.Quaternion(), expectedSpin = new THREE.Vector3(), actualSpin = new THREE.Vector3();
  const observe = () => {
    p.group.updateMatrixWorld(true);
    p.headM.localToWorld(head.set(0, .3, 0)).sub(p.pos); delta.copy(head).sub(previous);
    const velocityChange = delta.clone().sub(lastDelta).length();
    previous.copy(head); lastDelta.copy(delta);
    priorBody.copy(body); p.bodyGroup.getWorldQuaternion(body);
    assert.ok(head.toArray().every(Number.isFinite));
    return velocityChange;
  };
  try {
    for (const seed0 of [42, 829]) for (const heading of [0, 1.11]) for (const phase of [.06, .28, .7])
      for (const cause of ['trip', 'pvp', 'manual', 'nose-manual']) for (const interruption of ['platform', 'hop']) {
        let seed = seed0; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
        level.groundMeshes = [...grounds]; level.walls = [...walls];
        p.respawn(level, true, true, { position: new THREE.Vector3(0, .04, 0), heading: new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading)) });
        level.discardedBoards.clear(); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level); p.speed = 24; p.freeSkate = true;
        if (cause.includes('manual')) {
          const sign = cause === 'manual' ? 1 : -1; p.speed = 12; p.enterManual(sign);
          for (let i = 0; i < 12; i++) { p.balance = sign * .8; p.step(CONST.fixedStep, input, level); }
          p.balance = sign; p.balanceVel = sign * 5; p.balanceCritT = TUNING.bailGrace + .05; p.step(CONST.fixedStep, input, level);
        } else if (cause === 'pvp') p.beginPvpKnockdown(5, seed0 % 2 ? -1 : 1);
        else { p.bail(false, 24, 'trip', 30); p.startRagdoll('forward'); p.vVel = 7; p.state = 'air'; p.grounded = false; p.airFromSkate = false; p.airMomentum = true; }
        previous.set(0, 0, 0); lastDelta.set(0, 0, 0); body.identity();
        let frames = 0;
        while (p.bailRecoverT / p.bailRecoverDuration < phase && frames++ < 140) { p.step(CONST.fixedStep, input, level); observe(); }
        assert.ok(p.bailRecoverT > 0 && p.isBailing, 'fixture never entered recovery');
        if (interruption === 'platform') {
          // Real geometry removal, exactly like a phase pad disappearing.
          // A lower catch floor lets the same incident complete naturally.
          level.groundMeshes = grounds.filter(mesh => new THREE.Box3().setFromObject(mesh).max.y < -2);
          level.walls = walls.filter(box => box.max.y < -2);
        } else { p.state = 'air'; p.grounded = false; p.groundHit = null; p.vVel = 4.2; }
        let entry = null, maxEarlyVelocityChange = 0, maxCarryVelocityChange = 0, maxFreeCarryVelocityChange = 0;
        let entryImpacts = 0, completed = false, minClearance = Infinity;
        for (let f = 0; f < 240; f++) {
          const recovering = p.bailRecoverT >= 0;
          angular.copy(priorBody).invert().premultiply(body).normalize();
          if (angular.w < 0) angular.set(-angular.x, -angular.y, -angular.z, -angular.w);
          const s = Math.hypot(angular.x, angular.y, angular.z);
          expectedSpin.set(angular.x, angular.y, angular.z).multiplyScalar(s > 1e-8 ? 2 * Math.atan2(s, angular.w) / (s * CONST.fixedStep) : 2 / CONST.fixedStep);
          p.step(CONST.fixedStep, input, level); const velocityChange = observe();
          if (recovering && p.bailRecoverT < 0 && !entry) {
            p.ragdollWorldSpin(actualSpin);
            entry = { frame: f, headShift: delta.length(), velocityChange, spinError: actualSpin.distanceTo(expectedSpin) };
            entryImpacts = p.ragImpacts + p.ragWallImpacts;
          }
          if (f < 4) maxEarlyVelocityChange = Math.max(maxEarlyVelocityChange, velocityChange);
          if (entry && f < entry.frame + 12 && !p.grounded) {
            maxCarryVelocityChange = Math.max(maxCarryVelocityChange, velocityChange);
            if (p.ragImpacts + p.ragWallImpacts === entryImpacts) maxFreeCarryVelocityChange = Math.max(maxFreeCarryVelocityChange, velocityChange);
          }
          if (p.grounded && p.isBailing) {
            const clearance = p.interactionMeasure.sampledPlaneDistance(p.riderG, p.groundHit.normal, new THREE.Vector3(p.pos.x, p.groundHit.y, p.pos.z));
            minClearance = Math.min(minClearance, clearance);
          }
          assert.equal(p.breakApartDiagnostics?.active ?? false, false, 'nonfatal interruption detached the body');
          if (entry && !p.isBailing && p.bailRiseAge < 0) { completed = true; break; }
        }
        const row = { cause, seed: seed0, heading, phase, interruption, entry, maxEarlyVelocityChange, maxCarryVelocityChange, maxFreeCarryVelocityChange, minClearance, completed };
        assert.ok(entry && completed, `incomplete resumed fall: ${JSON.stringify(row)}`);
        assert.ok(minClearance > -.012, `resumed contact penetrated the floor: ${JSON.stringify(row)}`);
        if (!measureOnly) {
          assert.ok(maxEarlyVelocityChange < .14, `head snapped when support changed: ${JSON.stringify(row)}`);
          assert.ok(maxFreeCarryVelocityChange < .19, `free carry snapped before the next impact: ${JSON.stringify(row)}`);
          assert.ok(entry.spinError < 1e-5, `recovery spin was replaced: ${JSON.stringify(row)}`);
        }
        rows.push(row);
      }
    const result = { passed: true, measureOnly, cases: rows.length, realHandTriangles: pair.triangleCount, rows };
    const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
    if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { Math.random = random; runtime.dispose(); level.dispose(); }
});
