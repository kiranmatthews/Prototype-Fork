import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST }) => {
  const { CharacterBreakApart } = await server.ssrLoadModule('/src/character/breakApart.ts');
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const fixtures = [], evidence = [];
  function fixture(height = 3, enabled = true) {
    const scene = new THREE.Scene();
    const level = new Level(scene, { id: 'bones', name: 'Bones', data: {
      v: 1, name: 'Bones', spawn: [0, .04, 0], killY: -30, components: [
        { t: 'platform', p: [0, -.5, -20], s: [60, 1, 100], edgeGrinding: false },
        { t: 'wall', p: [0, 0, -6], s: [8, height, .5] }, { t: 'gate', p: [20, 0, -55] },
      ],
    }});
    scene.updateMatrixWorld(true);
    const p = new Player(scene); p.rawInput = makeInput(); p.respawn(level, true);
    const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
    if (!enabled) { p.breakApart = new CharacterBreakApart(p.bodyGroup); p.breakApart.request = () => {}; }
    p.freeSkate = true; p.speed = 24;
    const f = { p, scene, level, runtime }; fixtures.push(f); return f;
  }
  const tick = (f, input = makeInput()) => { f.p.step(CONST.fixedStep, input, f.level); f.level.update(CONST.fixedStep); };
  const state = p => [p.state, p.grounded, ...p.pos.toArray(), p.speed, p.vVel, ...p.axisF.toArray(), p.lives, p.bailDownT, p.simSeed];
  try {
    for (const [height, style] of [[3, 'head-pop'], [.5, 'waist-split']]) {
      const on = fixture(height), off = fixture(height, false);
      let entered = false, recalled = false, peakSeparation = 0, maxProbes = 0;
      let minClearance = Infinity, peakParts = 0;
      for (let i = 0; i < 300; i++) {
        tick(on); tick(off);
        assert.deepEqual(state(on.p), state(off.p), `cosmetic layer changed movement at frame ${i}`);
        const d = on.p.breakApartDiagnostics;
        if (d?.active) {
          entered = true; assert.equal(d.style, style);
          recalled ||= d.phase === 'reassembling';
          maxProbes = Math.max(maxProbes, d.probesThisStep); peakParts = Math.max(peakParts, d.parts);
          on.scene.updateMatrixWorld(true);
          const top = on.p.headM.getWorldPosition(new THREE.Vector3());
          const waist = on.p.legs.getWorldPosition(new THREE.Vector3());
          peakSeparation = Math.max(peakSeparation, top.distanceTo(waist));
          for (const part of on.p.breakApart.parts.filter(p => p.selected)) {
            assert.ok([...part.position.toArray(), ...part.rotation.toArray(), ...part.node.scale.toArray()].every(Number.isFinite));
            minClearance = Math.min(minClearance, part.position.y);
          }
        }
        if (entered && !d.active && !on.p.isBailing) break;
      }
      assert.ok(entered && recalled, `${style} never completed its real collision/recall path`);
      assert.equal(on.p.breakApartDiagnostics.active, false);
      assert.ok(peakSeparation > 2.1, `${style} never visibly separated (${peakSeparation})`);
      assert.ok(maxProbes <= 2); assert.ok(minClearance > 0);
      assert.equal(peakParts, style === 'head-pop' ? 1 : 2);
      // Once joined, every semantic joint is exactly back on the authored rig.
      for (const joint of on.p.animationRig.joints) {
        const reference = off.p.animationRig.joints.find(j => j.id === joint.id);
        assert.ok(joint.node.position.distanceTo(reference.node.position) < 1e-6, `${joint.id} retained a loose offset`);
      }
      evidence.push({ style, peakSeparation, maxProbes, peakParts, minClearance });
    }
    const f = fixture();
    f.p.freeSkate = false; f.p.speed = 0; tick(f);
    const lives = f.p.lives; f.p.die(); f.p.respawnTimer = 20;
    let maxProbes = 0;
    for (let i = 0; i < 250; i++) { tick(f); maxProbes = Math.max(maxProbes, f.p.breakApartDiagnostics.probesThisStep); }
    assert.equal(f.p.lives, lives - 1);
    assert.equal(f.p.breakApartDiagnostics.style, 'yard-sale');
    assert.equal(f.p.breakApartDiagnostics.fatal, true);
    assert.equal(f.p.breakApartDiagnostics.parts, 9);
    assert.equal(f.p.breakApartDiagnostics.sleeping, 9);
    assert.ok(maxProbes <= 2);
    // A removed support wakes cosmetic parts; death still charges only once.
    f.level.groundMeshes.length = 0;
    const y = f.p.breakApart.parts.find(p => p.name === 'head').position.y;
    for (let i = 0; i < 45; i++) tick(f);
    assert.ok(f.p.breakApart.parts.find(p => p.name === 'head').position.y < y - .1,
      JSON.stringify({ y, head: f.p.breakApart.parts.find(p => p.name === 'head').position.y, ...f.p.breakApartDiagnostics }));
    assert.equal(f.p.lives, lives - 1);
    f.p.respawn(f.level, true);
    assert.equal(f.p.breakApartDiagnostics.active, false);
    assert.ok(f.p.animationRig.joints.every(j => [...j.node.position.toArray(), ...j.node.scale.toArray()].every(Number.isFinite)));

    // Slow scrapes preserve the existing soft response, without losing parts.
    const slow = fixture(); slow.p.speed = 8;
    for (let i = 0; i < 180 && !slow.p.softSkateImpactT; i++) tick(slow, makeInput({ moveY: 1 }));
    assert.ok(slow.p.softSkateImpactT > 0); assert.ok(!slow.p.breakApartDiagnostics?.active);
    const interrupted = fixture(.5);
    for (let i = 0; i < 60 && !interrupted.p.breakApartDiagnostics?.active; i++) tick(interrupted);
    assert.ok(interrupted.p.breakApartDiagnostics.active);
    interrupted.p.respawn(interrupted.level, true);
    assert.equal(interrupted.p.breakApartDiagnostics.active, false);
    tick(interrupted);
    assert.ok(interrupted.p.headM.getWorldPosition(new THREE.Vector3()).distanceTo(interrupted.p.pos) < 3);
    // The optional playground is an actual finishable course, with earned
    // checkpoints and a safe left-hand bypass around its fatal test pit.
    const { findLevel } = await server.ssrLoadModule('/src/level.ts');
    const scene = new THREE.Scene(), level = new Level(scene, findLevel('bone-yard'));
    const p = new Player(scene); p.rawInput = makeInput(); p.respawn(level, true);
    const course = { p, level, scene, runtime: { dispose() {} } }; fixtures.push(course);
    tick(course); assert.equal(p.grounded, true, 'unsupported playground spawn');
    let courseFrames = 0;
    for (const [x, z] of [[0, -67], [-10, -69], [-10, -87], [0, -99], [0, -110]]) {
      let arrived = false;
      for (let i = 0; i < 1500; i++) {
        const dx = x - p.pos.x, dz = z - p.pos.z, distance = Math.hypot(dx, dz);
        if (distance < .6 || p.state === 'finished') { arrived = true; break; }
        tick(course, makeInput({ moveX: dx / distance, moveY: -dz / distance,
          spinPressed: p.spinTimer <= 0 && level.checkpoints.some(cp => !cp.active && cp.box.distanceToPoint(p.pos) < 2) }));
        courseFrames++;
        assert.notEqual(p.state, 'dead', 'playground bypass killed its walker');
      }
      assert.ok(arrived, `playground waypoint ${x},${z} unreachable: ${p.pos.toArray()}`);
    }
    assert.equal(p.state, 'finished'); assert.ok(level.checkpoints.every(cp => cp.active));
    p.respawn(level, false); assert.ok(p.pos.z < -60, 'checkpoint did not restore');
    p.pos.set(3, .1, -78); p.prevPos.copy(p.pos); p.grounded = false; p.state = 'air'; p.vVel = -4;
    for (let i = 0; i < 90 && p.state !== 'dead'; i++) tick(course);
    assert.equal(p.state, 'dead'); assert.ok(p.breakApartDiagnostics.fatal);
    for (let i = 0; i < 360 && p.state === 'dead'; i++) tick(course);
    assert.notEqual(p.state, 'dead'); assert.equal(p.breakApartDiagnostics.active, false);
    assert.ok(p.pos.z < -60 && p.pos.z > -74, 'pit did not respawn at the checkpoint');
    console.log(JSON.stringify({ evidence, fatalParts: 9, maxProbes, courseFrames,
      tests: 'real collisions, exact movement/RNG parity, finite recall, slow scrapes, fatal settle, removed floor, respawn cleanup; playground spawn, checkpoints, continuous bypass, finish, pit and respawn' }, null, 2));
  } finally { for (const f of fixtures) { f.runtime.dispose(); f.level.dispose(); } }
});
