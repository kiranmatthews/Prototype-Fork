import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Exact vertices are an independent test oracle only. Production contact
// must stay sparse, including during the first bounce and the later roll-up.
await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { CharacterInteractionBounds } = await server.ssrLoadModule('/src/character/interactionBounds.ts');
  // A warm support hint cannot keep an invisible/removed mesh alive, reuse a
  // stale pose, or change contact-point tie order for callers that need it.
  const probe = new CharacterInteractionBounds(), root = new THREE.Group(), hidden = new THREE.Group();
  const material = new THREE.MeshBasicMaterial(), geometry = new THREE.SphereGeometry(.4, 16, 12);
  const meshes = Array.from({ length: 6 }, (_, i) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(i * .13, i * .3, i * -.07); root.add(mesh); return mesh;
  });
  root.add(hidden);
  const normal = new THREE.Vector3(), origin = new THREE.Vector3(), refPoint = new THREE.Vector3(), fastPoint = new THREE.Vector3(), box = new THREE.Box3();
  for (let frame = 0; frame < 120; frame++) {
    meshes[frame % 6].position.y = Math.sin(frame * .73);
    root.rotation.set(frame * .07, frame * -.13, frame * .05);
    if (frame === 20) { hidden.add(meshes[0]); hidden.visible = false; }
    if (frame === 40) { hidden.visible = true; root.remove(meshes[1]); }
    if (frame === 60) { root.add(meshes[0], meshes[1]); meshes[0].visible = false; }
    if (frame === 80) meshes[0].visible = true;
    normal.set(Math.sin(frame), 1, Math.cos(frame)).normalize(); root.updateMatrixWorld(true);
    const fast = probe.sampledPlaneDistance(root, normal, origin);
    const reference = probe.sampledPlaneDistance(root, normal, origin, refPoint, box);
    assert.ok(Math.abs(fast - reference) < 1e-12, 'support hint used stale visibility or pose');
    const withContact = probe.sampledPlaneDistance(root, normal, origin, fastPoint);
    assert.ok(Math.abs(withContact - reference) < 1e-12 && fastPoint.distanceTo(refPoint) < 1e-12,
      'support optimization changed the requested contact point');
    probe.measure(root, box, true, true);
    const measured = probe.sampledPlaneDistance(root, normal, origin, undefined, undefined, true);
    assert.ok(Math.abs(measured - reference) < 1e-12, 'shared bail hierarchy changed support distance');
  }
  geometry.dispose(); material.dispose();
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'bail-support-test', name: 'Bail support', data: {
    v: 1, name: 'Bail support', spawn: [0, .04, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }],
  } });
  level.ramp('bail-roll-bank', -16, 6, -28, 0, 12, new THREE.MeshLambertMaterial(), 85);
  level.groundMeshes.at(-1).userData.vert = true;
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const measure = p.interactionMeasure, exact = measure.minimumPlaneDistance.bind(measure);
  const skin = measure.skinnedBounds.bind(measure), sample = measure.sampledPlaneDistance.bind(measure);
  const seat = p.seatBailOnGround, random = Math.random, point = new THREE.Vector3();
  let fullScans = 0, maxSamples = 0, supportCalls = 0;
  measure.minimumPlaneDistance = () => { throw new Error('production bail scanned exact surface vertices'); };
  measure.skinnedBounds = mesh => { if (p.isBailing) fullScans++; return skin(mesh); };
  measure.sampledPlaneDistance = (...args) => {
    const result = sample(...args); supportCalls++; maxSamples = Math.max(maxSamples, measure.supportSamples); return result;
  };
  const rows = [];
  function start(cause, initialSeed) {
    let seed = initialSeed;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    p.respawn(level, true, true, cause === 'bank' ? { position: new THREE.Vector3(85, 4.04, -20), heading: new THREE.Vector3(0, 0, -1) } : undefined);
    p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
    p.speed = cause === 'balance' ? 10 : cause === 'bank' ? 12 : 24; p.freeSkate = true;
    if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
    else {
      p.bail(false, p.speed, cause === 'bank' ? 'balance' : cause, 30);
      if (cause === 'wall' || cause === 'trip') {
        p.startRagdoll(cause === 'wall' ? 'back' : 'forward'); p.vVel = cause === 'wall' ? 3.6 : 7;
        p.state = 'air'; p.grounded = false; p.airFromSkate = false; p.airMomentum = true;
      }
    }
  }
  const gameplay = () => [p.state, p.grounded, p.isBailing, ...p.pos.toArray(), ...p.axisF.toArray(),
    p.speed, p.vVel, p.ragdollImpactCount, p.bailRecoverT];
  try {
    for (const seed of [1234, 42, 109, 829, 1229]) for (const cause of ['balance', 'wall', 'trip', 'landing', 'pvp', 'bank']) {
      start(cause, seed);
      let min = Infinity, max = -Infinity, contacts = 0, impacts = 0, airborneNearFloor = 0, priorImpacts = 0;
      const trace = [];
      for (let frame = 0; frame < 240 && p.isBailing; frame++) {
        p.step(CONST.fixedStep, input, level); trace.push(gameplay());
        const hit = p.groundHit;
        if (p.isBailing && hit && hit.normal.y >= .3) {
          const height = (p.pos.y - hit.y) * hit.normal.y;
          const clearance = exact(p.riderG, hit.normal, point.set(p.pos.x, hit.y, p.pos.z));
          const impact = p.ragdollImpactCount > priorImpacts;
          if (p.grounded || impact) {
            min = Math.min(min, clearance); max = Math.max(max, clearance); contacts++; if (impact) impacts++;
            assert.ok(clearance >= -.012 && clearance <= .026,
              `${cause}/${seed} frame ${frame}: floor contact floated/clipped by ${clearance}m`);
          } else if (height >= 0 && height < .8) {
            airborneNearFloor++;
            assert.ok(clearance >= -.012, `${cause}/${seed}: airborne limb passed through reachable floor`);
          }
        }
        priorImpacts = p.ragdollImpactCount;
      }
      assert.ok(!p.isBailing && p.grounded && contacts > 0, `${cause}/${seed}: failed to recover`);
      // Disable only the visual correction and reproduce the same bail.
      // Neither random contact details nor support offsets may steer gameplay.
      p.seatBailOnGround = () => {};
      try {
        start(cause, seed); const reference = [];
        for (let frame = 0; frame < 240 && p.isBailing; frame++) { p.step(CONST.fixedStep, input, level); reference.push(gameplay()); }
        assert.deepEqual(trace, reference, `${cause}/${seed}: presentation contact changed gameplay`);
      } finally { p.seatBailOnGround = seat; }
      rows.push({ cause, seed, frames: trace.length, contacts, impacts, airborneNearFloor, min, max });
    }
    start('pvp', 1234); p.state = 'air'; p.grounded = false;
    const hit = p.groundHit;
    for (const support of [null, { ...hit, y: p.pos.y + 1 }, { ...hit, y: p.pos.y - 3 }, { ...hit, normal: new THREE.Vector3(1, .1, 0).normalize() }]) {
      p.groundHit = support; p.syncVisual(input, CONST.fixedStep);
      const before = p.bodyGroup.position.clone(); p.seatBailOnGround(CONST.fixedStep);
      assert.ok(before.equals(p.bodyGroup.position), 'missing, overhead, distant, or steep support altered the airborne pose');
      assert.equal(p.bailSupportOffset, 0);
    }
    assert.equal(fullScans, 0, 'bail support invoked full skin scans');
    assert.ok(maxSamples > 0 && maxSamples < 12000, 'sparse support work exceeded budget');
    const result = { passed: true, cases: rows.length, supportHintCases: 120, fullScans, supportCalls, maxSamples, gameplayUnchanged: true, rows };
    const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
    if (report) await writeFile(report, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { p.seatBailOnGround = seat; Math.random = random; runtime.dispose(); level.dispose(); }
});
