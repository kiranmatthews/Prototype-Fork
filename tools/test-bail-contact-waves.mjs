// Impact deformation must start at the struck body part, travel through the
// connected rig, rebound and stop. Exercise production springs and contact wiring.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { BailMotion } = await server.ssrLoadModule('/src/character/bailMotion.ts');
  const q = new THREE.Quaternion(), zero = new THREE.Vector3(), normal = new THREE.Vector3(0, 1, 0);
  const id = (part, side) => `deform.${part}.${side}.length`;
  const fresh = () => {
    const motion = new BailMotion(); motion.begin('air', zero, 414);
    for (let i = 0; i < 600; i++) motion.step(1 / 60, q, zero, true, 0, 0, 1);
    return motion;
  };
  const rows = [];
  for (const [joint, part, side] of [[7, 'arm.lower', 'left'], [4, 'arm.lower', 'right'],
    [13, 'leg.lower', 'left'], [10, 'leg.lower', 'right']]) {
    const hit = fresh(), control = fresh(), near = id(part, side), far = id(part, side === 'left' ? 'right' : 'left');
    hit.impact(18, normal, undefined, joint);
    let firstNear = null, firstFar = null, compressed = 0, rebound = 0;
    for (let frame = 0; frame < 600; frame++) {
      for (const motion of [hit, control]) motion.step(1 / 120, q, zero, true, 0, 0, 1);
      const nearChange = hit.deformations[near] - control.deformations[near];
      const farChange = hit.deformations[far] - control.deformations[far];
      if (firstNear === null && nearChange < -.001) firstNear = (frame + 1) / 120;
      if (firstFar === null && farChange < -.001) firstFar = (frame + 1) / 120;
      compressed = Math.min(compressed, nearChange); rebound = Math.max(rebound, nearChange);
    }
    const settled = Math.max(...Object.values(hit.deformations).map(value => Math.abs(value - 1)));
    assert.ok(firstNear > 0 && firstNear < .025, `${near}: contact compression was delayed`);
    assert.ok(firstFar > firstNear + .04, `${near}: opposite limb compressed in unison`);
    assert.ok(compressed < -.04 && rebound > .005, `${near}: missing readable squash/rebound`);
    assert.ok(settled < .0001, `${near}: deformation never came to rest`);
    rows.push({ joint, near, firstNear, firstFar, compressed, rebound, settled });
  }
  // Alternating close contacts must add to moving springs without postponing
  // an older impulse forever. Frame subdivision must preserve the same result.
  const a = fresh(), b = fresh(); let min = 1, max = 1, error = 0;
  for (let frame = 0; frame < 240; frame++) {
    if (frame < 90 && frame % 2 === 0) for (const motion of [a, b])
      motion.impact(40, normal, undefined, frame % 4 ? 4 : 13);
    a.step(1 / 60, q, zero, false, 0, 0, 1);
    for (let i = 0; i < 2; i++) b.step(1 / 120, q, zero, false, 0, 0, 1);
    for (const key in a.deformations) {
      const value = a.deformations[key];
      assert.ok(Number.isFinite(value) && value > .65 && value < 1.35, 'rapid impact escaped length limits');
      min = Math.min(min, value); max = Math.max(max, value);
      error = Math.max(error, Math.abs(value - b.deformations[key]));
    }
  }
  assert.ok(error < 1e-9, 'frame subdivision changed the contact wave');
  assert.ok(min < .9 && max > 1.01, 'repeated contacts lost compression or rebound');
  a.reset(); a.begin('air', zero, 414);
  const resetControl = new BailMotion(); resetControl.begin('air', zero, 414);
  for (const motion of [a, resetControl]) motion.step(1 / 60, q, zero, false, 0, 0, 1);
  assert.deepEqual(a.deformations, resetControl.deformations, 'contact waves leaked into the next bail');

  const scene = new THREE.Scene(), level = new Level(scene, { id: 'contact-wave-test', name: 'Contact waves', data: {
    v: 1, name: 'Contact waves', spawn: [0, .04, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [40, 1, 40] }, { t: 'gate', p: [15, 0, -15] }],
  } });
  try {
    const p = new Player(scene), input = makeInput({ inventoryHeld: true });
    p.rawInput = input; p.respawn(level, true); p.step(CONST.fixedStep, input, level);
    p.invulnTimer = 0; p.beginPvpKnockdown(5, 1); p.syncVisual(input, CONST.fixedStep);
    const actual = p.bailMotion.impact.bind(p.bailMotion); let struck = -1;
    p.bailMotion.impact = (...args) => { struck = args[3]; return actual(...args); };
    const wiring = [];
    for (const [name, joint, side] of [['wristR', 7, 'left'], ['wristL', 4, 'right'],
      ['ankleR', 13, 'left'], ['ankleL', 10, 'right']]) {
      const node = p[name], original = node.position.clone();
      assert.equal(node.userData.anatomicalSide, side, `${name}: semantic rig side changed`);
      // Put just this contact below the posed body, using the actual selector.
      const point = new THREE.Vector3(0, -5, 0); node.parent.worldToLocal(point); node.position.copy(point);
      p.group.updateMatrixWorld(true);
      p.kickRagdollContact(normal, new THREE.Vector3(0, 16, 0), 12);
      assert.equal(struck, joint, `${name}: collision sent the wave to a different joint`);
      wiring.push({ name, side, joint: struck });
      node.position.copy(original); p.group.updateMatrixWorld(true);
    }
    console.log(JSON.stringify({ passed: true, rows, repeatedContacts: { min, max, subdivisionError: error }, wiring }, null, 2));
  } finally { level.dispose(); }
});
