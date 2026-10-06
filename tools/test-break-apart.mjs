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
    const lives = f.p.lives; f.p.die('blast', new THREE.Vector3(-1, 0, 0)); f.p.respawnTimer = 20;
    let maxProbes = 0;
    for (let i = 0; i < 250; i++) { tick(f); maxProbes = Math.max(maxProbes, f.p.breakApartDiagnostics.probesThisStep); }
    assert.equal(f.p.lives, lives - 1);
    assert.equal(f.p.breakApartDiagnostics.style, 'blast');
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

    // Direct presentation fixtures exercise collision geometry independently
    // of controller policy: slope normals, compact support, edges and sweeps.
    const physicsEvidence = [];
    function debrisFixture(slope = 0, width = 80) {
      const root = new THREE.Group(); root.position.y = 2.4;
      const saved = [];
      for (const [i, name] of ['hips', 'torso-root', 'head', 'shoulder-left', 'wrist-left', 'shoulder-right', 'wrist-right', 'knee-left', 'knee-right'].entries()) {
        const joint = new THREE.Group(); joint.name = name;
        joint.position.set((i % 3 - 1) * .4, Math.floor(i / 3) * .25, 0);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(.22, .72, .18), new THREE.MeshBasicMaterial());
        joint.add(mesh); root.add(joint);
        saved.push({ joint, position: joint.position.clone(), quaternion: joint.quaternion.clone(), scale: joint.scale.clone() });
      }
      const floor = new THREE.Mesh(new THREE.BoxGeometry(width, .5, 80), new THREE.MeshBasicMaterial());
      floor.position.y = -.25; floor.rotation.z = slope;
      root.updateWorldMatrix(true, true); floor.updateWorldMatrix(true, true);
      const debris = new CharacterBreakApart(root);
      const world = { groundMeshes: [floor], walls: [], crumbles: [], killY: -30 };
      const update = (dt = 1 / 120) => { debris.restore(); debris.step(dt, world, false, 10, true); };
      return { root, floor, debris, world, update, saved };
    }
    const serial = d => d.parts.filter(p => p.selected).map(p => [...p.position.toArray(), ...p.velocity.toArray(), ...p.rotation.toArray()]);
    for (const style of ['blast', 'crush']) {
      const a = debrisFixture(), b = debrisFixture();
      const options = { style, origin: new THREE.Vector3(-2, 1, 0), seed: 42 };
      a.debris.request('air', new THREE.Vector3(1, 0, 0), true, null, options);
      b.debris.request('air', new THREE.Vector3(1, 0, 0), true, null, options);
      let high = -Infinity, peakVertical = -Infinity, maxQueries = 0;
      for (let i = 0; i < 600; i++) {
        a.update(); b.update();
        assert.deepEqual(serial(a.debris), serial(b.debris), `${style} cosmetic seed is nondeterministic`);
        maxQueries = Math.max(maxQueries, a.debris.diagnostics.probesThisStep);
        if (i === 0) {
          assert.ok(a.debris.parts.every(p => p.velocity.x > 0), `${style} should move away from its source`);
          peakVertical = Math.max(...a.debris.parts.map(p => p.velocity.y));
        }
        high = Math.max(high, ...a.debris.parts.map(p => p.position.y));
      }
      assert.equal(a.debris.diagnostics.sleeping, 9, `${style} never settles`);
      assert.ok(maxQueries <= 2);
      const probes = a.debris.diagnostics.probes;
      for (let i = 0; i < 60; i++) a.update();
      assert.equal(a.debris.diagnostics.probes, probes, 'static settled pieces still raycast');
      for (const part of a.debris.parts) {
        const support = a.debris.supportRadius(part, new THREE.Vector3(0, 1, 0));
        assert.ok(Math.abs(part.position.y - support - .008) < .02, `${style} floats or penetrates ground`);
        assert.ok(part.node.scale.distanceTo(part.scale) < 1e-8, 'segment recoil did not finish');
        const dimensions = part.halfSize.clone().multiply(part.scale);
        assert.ok(support <= Math.min(dimensions.x, dimensions.y, dimensions.z) * 1.35 + 1e-6,
          `${style} settled balanced on a corner instead of a broad face`);
      }
      assert.ok(style === 'blast' ? peakVertical > 2 : peakVertical < 0, `${style} launch is not distinct`);
      physicsEvidence.push({ style, peakVertical, high, maxQueries, sleepingQueries: a.debris.diagnostics.probes - probes });
      a.debris.reset();
      for (const { joint, position, quaternion, scale } of a.saved) {
        assert.ok(joint.position.equals(position) && joint.quaternion.equals(quaternion) && joint.scale.equals(scale), 'reset changed source joint');
      }
      // Explicit seeds are repeatable even after another incident/reset.
      a.debris.request('air', new THREE.Vector3(1, 0, 0), true, null, options);
      b.debris.reset(); b.debris.request('air', new THREE.Vector3(1, 0, 0), true, null, options);
      a.update(); b.update(); assert.deepEqual(serial(a.debris), serial(b.debris));
    }
    const slope = debrisFixture(.24);
    slope.debris.request('back', new THREE.Vector3(), true, null, { style: 'head-pop', seed: 6 });
    for (let i = 0; i < 600; i++) slope.update();
    const head = slope.debris.parts.find(p => p.name === 'head');
    assert.ok(head.sleeping && head.floorNormal.y < .99 && head.floorNormal.y > .95);
    const normalClearance = head.position.clone().sub(head.floorPoint).dot(head.floorNormal) - slope.debris.supportRadius(head, head.floorNormal);
    assert.ok(Math.abs(normalClearance - .008) < .02, `slope contact ignores surface normal: ${normalClearance}`);
    // Local box projection proves thin pieces no longer use their diagonal
    // sphere as ground height (the old implementation hovered by ~0.2m).
    head.rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    assert.ok(Math.abs(slope.debris.supportRadius(head, new THREE.Vector3(0, 1, 0)) - .11) < 1e-6);
    const edge = debrisFixture(0, 1);
    edge.debris.request('back', new THREE.Vector3(), true, null, { style: 'head-pop', impulse: new THREE.Vector3(18, 0, 0), seed: 3 });
    for (let i = 0; i < 240; i++) edge.update();
    assert.ok(edge.debris.parts.find(p => p.name === 'head').position.y < -8, 'cached floor kept fragment floating beyond ledge');
    const wall = debrisFixture();
    wall.world.walls.push(new THREE.Box3(new THREE.Vector3(1, 0, -3), new THREE.Vector3(1.02, 6, 3)));
    wall.debris.request('back', new THREE.Vector3(), true, null, { style: 'head-pop', seed: 3 });
    wall.update();
    const wh = wall.debris.parts.find(p => p.name === 'head');
    wh.position.set(0, 2, 0); wh.velocity.set(24, 0, 0); wh.angular.set(0, 0, 0); wh.rotation.identity();
    wall.update(.1);
    assert.ok(wh.position.x < 1 && wh.velocity.x < 0, 'fast piece tunneled through thin wall');
    const escalation = debrisFixture();
    escalation.debris.request('back', new THREE.Vector3(), false, null, { style: 'head-pop' }); escalation.update();
    const beforeFatal = serial(escalation.debris);
    escalation.debris.request('air', new THREE.Vector3(), true);
    assert.deepEqual(serial(escalation.debris), beforeFatal, 'generic fatal escalation teleported existing piece');
    assert.equal(escalation.debris.diagnostics.style, 'head-pop');
    assert.ok(escalation.debris.diagnostics.fatal);
    const activeEscalation = debrisFixture();
    activeEscalation.debris.request('back', new THREE.Vector3(), false, null, { style: 'head-pop' }); activeEscalation.update();
    for (let i = 0; i < 40; i++) activeEscalation.update();
    const scatteredHead = activeEscalation.debris.parts.find(p => p.name === 'head').position.clone();
    activeEscalation.debris.request('air', new THREE.Vector3(), true, null, { style: 'blast' });
    assert.ok(activeEscalation.debris.parts.find(p => p.name === 'head').position.distanceTo(scatteredHead) < 1e-8, 'blast escalation teleported detached head');
    activeEscalation.update();
    assert.equal(activeEscalation.debris.diagnostics.parts, 9);
    assert.equal(activeEscalation.debris.diagnostics.style, 'blast');
    const raisedEscalation = debrisFixture();
    raisedEscalation.debris.request('back', new THREE.Vector3(), false, null, { style: 'head-pop' }); raisedEscalation.update();
    const raisedHead = raisedEscalation.debris.parts.find(p => p.name === 'head');
    raisedHead.position.set(4, 1, 0);
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(2, .5, 3), new THREE.MeshBasicMaterial());
    ledge.position.set(0, 4.75, 0); ledge.updateWorldMatrix(true, true); raisedEscalation.world.groundMeshes.push(ledge);
    raisedEscalation.debris.request('air', new THREE.Vector3(), true, { y: 5, mesh: ledge }, { style: 'blast', seed: 42 });
    raisedEscalation.update();
    assert.ok(raisedHead.position.distanceTo(new THREE.Vector3(4, 1, 0)) < .25,
      `fatal launch clamped an already-detached head to the rider's raised platform: ${raisedHead.position.toArray()}`);
    const pendingEscalation = debrisFixture();
    pendingEscalation.debris.request('back', new THREE.Vector3(), false, null, { style: 'head-pop' });
    pendingEscalation.debris.request('air', new THREE.Vector3(), true);
    assert.equal(pendingEscalation.debris.diagnostics.style, 'head-pop', 'same-tick pit upgrade changed separation style');
    const moving = debrisFixture();
    moving.floor.userData.moverId = 0;
    moving.debris.request('air', new THREE.Vector3(), true, null, { style: 'blast' });
    for (let i = 0; i < 600; i++) moving.update();
    assert.equal(moving.debris.diagnostics.sleeping, 9);
    const previousHeight = moving.debris.parts[0].position.y;
    moving.floor.position.y -= 2; moving.floor.updateWorldMatrix(true, true); moving.update();
    assert.equal(moving.debris.diagnostics.sleeping, 0, 'moving support did not wake every resting piece immediately');
    for (let i = 0; i < 60; i++) moving.update();
    assert.ok(moving.debris.parts[0].position.y < previousHeight - 1, 'moving floor left floating debris');
    const replacement = debrisFixture();
    replacement.debris.request('back', new THREE.Vector3(), true, null, { style: 'head-pop', seed: 42 });
    for (let i = 0; i < 500; i++) replacement.update();
    const replacedHead = replacement.debris.parts.find(p => p.name === 'head');
    assert.ok(replacedHead.sleeping);
    const lowerFloor = replacement.floor.clone(); lowerFloor.position.y -= 1; lowerFloor.updateWorldMatrix(true, true);
    replacement.world.groundMeshes[0] = lowerFloor; // same array and same count
    for (let i = 0; i < 120; i++) replacement.update();
    assert.equal(replacedHead.floorMesh, lowerFloor, 'same-count support replacement remained absent from candidate list');
    assert.ok(replacedHead.position.y > -1 && replacedHead.position.y < -.5, 'replacement floor failed to catch falling debris');
    const phase = debrisFixture(); phase.world.groundMeshes.length = 0;
    phase.debris.request('back', new THREE.Vector3(), true, null, { style: 'head-pop', seed: 42 });
    for (let i = 0; i < 30; i++) phase.update();
    phase.world.groundMeshes.push(phase.floor);
    for (let i = 0; i < 500; i++) phase.update();
    const phasedHead = phase.debris.parts.find(p => p.name === 'head');
    assert.ok(phasedHead.sleeping && phasedHead.position.y > 0 && phasedHead.floorMesh === phase.floor,
      'a newly-solid phase floor failed to catch an active fragment');
    for (let i = 0; i < 48; i++) {
      const extra = phase.floor.clone(); extra.position.x += 8 + i * .3; extra.position.y -= 2; extra.updateWorldMatrix(true, true);
      phase.world.groundMeshes.push(extra);
    }
    phase.update();
    assert.equal(phase.debris.diagnostics.candidates, 32, 'membership refresh exceeded bounded candidate budget');
    assert.ok(phase.debris.diagnostics.probesThisStep <= 2);
    const invalid = debrisFixture();
    invalid.debris.request('air', new THREE.Vector3(NaN, Infinity, 0), true, null,
      { style: 'blast', strength: NaN, impulse: new THREE.Vector3(Infinity, 0, 0), origin: new THREE.Vector3(NaN, 0, 0) });
    invalid.update(); assert.ok(serial(invalid.debris).flat().every(Number.isFinite), 'bad external impact options poisoned transforms');
    console.log(JSON.stringify({ physicsEvidence, slopeClearance: normalClearance, edgeY: edge.debris.parts.find(p => p.name === 'head').position.y, wallX: wh.position.x }));

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
    assert.equal(p.state, 'dead'); assert.ok(!p.breakApartDiagnostics?.active, 'ordinary pit death should remain intact');
    for (let i = 0; i < 360 && p.state === 'dead'; i++) tick(course);
    assert.notEqual(p.state, 'dead'); assert.ok(!p.breakApartDiagnostics?.active);
    assert.ok(p.pos.z < -60 && p.pos.z > -74, 'pit did not respawn at the checkpoint');
    console.log(JSON.stringify({ evidence, fatalParts: 9, maxProbes, courseFrames,
      tests: 'real collisions, exact movement/RNG parity, finite recall, slow scrapes, fatal settle, removed floor, respawn cleanup; playground spawn, checkpoints, continuous bypass, finish, pit and respawn' }, null, 2));
  } finally { for (const f of fixtures) { f.runtime.dispose(); f.level.dispose(); } }
});
