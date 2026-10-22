// Compare the optimized fixed-step path with the former eager appearance
// update, including the actual local artist-hand asset and render matrices.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const bytes = await readFile(new URL('../public/characters/three-finger-hand/three-finger-hand.glb', import.meta.url));
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST, TUNING }) => {
  const { createRiggedCartoonHandPairFromScene, attachAndSyncRiggedCartoonHandPair } =
    await server.ssrLoadModule('/src/character/riggedCartoonHand.ts');
  const { removeProceduralCartoonGloveSurface } = await server.ssrLoadModule('/src/character/cartoonGlove.ts');
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const random = Math.random, input = makeInput({ inventoryHeld: true });
  let drawSeed = 7721;
  Math.random = () => ((drawSeed = (Math.imul(drawSeed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const actors = [];
  function create(eager) {
    drawSeed = 7721;
    const scene = new THREE.Scene(), level = new Level(scene, { id: 'bail-matrix-test', name: 'Bail matrices', data: {
      v: 1, name: 'Bail matrices', spawn: [0, .04, 0], killY: -100,
      components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }],
    } });
    const p = new Player(scene); p.rawInput = input; p.respawn(level, true);
    const pair = createRiggedCartoonHandPairFromScene(gltf.scene);
    attachAndSyncRiggedCartoonHandPair(pair, p.gloveLeft, p.gloveRight);
    p.riggedCartoonHands = pair; p.riggedCartoonHandState = 'ready';
    removeProceduralCartoonGloveSurface(p.gloveLeft); removeProceduralCartoonGloveSurface(p.gloveRight);
    p.rebuildCharacterRenderBatches(); p.syncCharacterAppearance();
    const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
    const nodes = []; p.riderG.traverse(node => nodes.push(node));
    const actor = { p, level, pair, runtime, nodes, count: false, passes: 0 };
    const nativeAppearance = p.syncCharacterAppearance.bind(p), nativeMatrices = p.bodyGroup.updateMatrixWorld;
    if (eager) {
      p.syncCharacterAppearance = options => nativeAppearance({ ...options, deferWorldMatrices: false });
      const nativeMeasure = p.interactionMeasure.measure.bind(p.interactionMeasure);
      p.interactionMeasure.measure = (root, box, ready, intact) => nativeMeasure(root, box, ready, intact, intact);
    }
    p.bodyGroup.updateMatrixWorld = function(force) { if (actor.count) actor.passes++; return nativeMatrices.call(this, force); };
    return actor;
  }
  const snapshot = actor => {
    const values = [];
    for (const node of actor.nodes) values.push(...node.position.toArray(), ...node.quaternion.toArray(),
      ...node.scale.toArray(), ...node.matrixWorld.elements, ...(node.morphTargetInfluences ?? []),
      ...(node.bindMatrixInverse?.elements ?? []));
    values.push(...actor.p.characterBounds.min.toArray(), ...actor.p.characterBounds.max.toArray());
    return values;
  };
  const gameplay = p => [p.state, p.grounded, p.isBailing, ...p.pos.toArray(), p.speed, p.vVel,
    p.ragdollImpactCount, p.ragdollWallImpactCount, p.bailRecoverT];
  function start(actor, cause, seed) {
    drawSeed = seed;
    const { p, level } = actor;
    p.respawn(level, true, true); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
    p.speed = cause === 'balance' ? 10 : 24; p.freeSkate = true;
    if (cause === 'manual' || cause === 'nose-manual') {
      const sign = cause === 'manual' ? 1 : -1; p.speed = 12; p.enterManual(sign);
      for (let i = 0; i < 12; i++) { p.balance = sign * .8; p.step(CONST.fixedStep, input, level); }
      p.balance = sign; p.balanceVel = sign * 5; p.balanceCritT = TUNING.bailGrace + .05;
      p.step(CONST.fixedStep, input, level);
    } else if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
    else {
      p.bail(false, p.speed, cause, 30);
      if (cause === 'wall' || cause === 'trip') {
        p.startRagdoll(cause === 'wall' ? 'back' : 'forward'); p.vVel = cause === 'wall' ? 3.6 : 7;
        p.state = 'air'; p.grounded = false; p.airFromSkate = false; p.airMomentum = true;
      }
    }
    actor.passes = 0;
  }
  const rows = []; let framesCompared = 0, maxPoseError = 0;
  try {
    actors.push(create(true), create(false));
    const [reference, optimized] = actors;
    for (const seed of [42, 1229]) for (const cause of ['balance', 'wall', 'trip', 'landing', 'pvp', 'manual', 'nose-manual']) {
      for (const actor of actors) start(actor, cause, seed);
      let frames = 0, riseFrames = 0, eagerRisePasses = 0, deferredRisePasses = 0;
      for (; frames < 240 && (reference.p.isBailing || reference.p.bailRiseAge >= 0); frames++) {
        const rise = !reference.p.isBailing;
        const beforePasses = actors.map(actor => actor.passes);
        const frameSeed = drawSeed; let nextSeed;
        for (const actor of actors) {
          drawSeed = frameSeed;
          actor.count = true; actor.p.step(CONST.fixedStep, input, actor.level); actor.count = false;
          if (nextSeed === undefined) nextSeed = drawSeed;
          else assert.equal(drawSeed, nextSeed, 'matrix timing changed random draws');
          // Match the renderer's final update after the support offset.
          actor.p.group.updateMatrixWorld(true);
        }
        const a = snapshot(reference), b = snapshot(optimized); assert.equal(a.length, b.length);
        for (let i = 0; i < a.length; i++) {
          const error = Math.abs(a[i] - b[i]); maxPoseError = Math.max(maxPoseError, error);
          assert.ok(Number.isFinite(error) && error < 1e-11, `${cause}/${seed} frame ${frames}, value ${i}: ${error}`);
        }
        assert.deepEqual(gameplay(reference.p), gameplay(optimized.p), `${cause}/${seed}: matrix timing changed gameplay`);
        if (rise) {
          riseFrames++; eagerRisePasses += reference.passes - beforePasses[0]; deferredRisePasses += optimized.passes - beforePasses[1];
        }
        framesCompared++;
      }
      assert.ok(!optimized.p.isBailing && optimized.p.grounded && optimized.p.bailRiseAge < 0);
      assert.ok(riseFrames >= 40 && deferredRisePasses < eagerRisePasses, 'post-control rebound did not remove its duplicate matrix pass');
      assert.ok(optimized.passes < reference.passes, 'no full-body work was removed');
      rows.push({ cause, seed, frames, eagerPasses: reference.passes, deferredPasses: optimized.passes, riseFrames, eagerRisePasses, deferredRisePasses });
    }
    // Paused/editor calls must still publish the complete hierarchy now.
    const p = optimized.p; p.bodyGroup.rotation.z += .3;
    optimized.passes = 0; optimized.count = true; p.syncCharacterAppearance(); optimized.count = false;
    assert.ok(optimized.passes > 0, 'public appearance sync deferred its matrices');
    const published = snapshot(optimized); p.bodyGroup.updateMatrixWorld(true);
    assert.deepEqual(snapshot(optimized), published, 'public appearance sync left a stale matrix');
    console.log(JSON.stringify({ passed: true, realHandTriangles: optimized.pair.triangleCount,
      cases: rows.length, framesCompared, maxPoseError, immediatePublicSync: true, rows }, null, 2));
  } finally {
    Math.random = random;
    for (const { runtime, level } of actors) { runtime.dispose(); level.dispose(); }
  }
});
