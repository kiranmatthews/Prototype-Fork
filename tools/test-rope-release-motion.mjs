// A leap off a swing rope, watched one frame at a time with the real player and the production animation.
//
// Each case catches a rope of a small fixture course, waits for a point of its swing, holds Jump for a while,
// lets go and follows the body to the ground (or onto the next rope). What must hold in every one of them:
//
//   - no joint of the body turns more than a quick limb does in a frame. (A hand left chasing a rope that had
//     gone, a blend of an upright body with one half way round a flip, and an elbow solved from the wrong side
//     each turned a joint 90 to 180 degrees in one frame: the "glitch" of the old dismount.)
//   - the body does not turn about its own height as the hands open, whichever way the rope was going;
//   - a leap below the backflip's charge plays no release clip at all, and a backflip's clip is over, opened
//     out, before the ground;
//   - the soles are at the floor when the body lands, not hanging over it;
//   - nothing steps: away from the leap itself and the landing itself, the hips keep the speed they had.
//
// The same holds for a leap into the next rope (which takes him as soon as he reaches it, with his arms already
// out for it) and for a leap with no steer in it, which falls back onto the rope it left.
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderLeft', 'elbowLeft', 'wristLeft', 'shoulderRight', 'elbowRight', 'wristRight',
  'hipLeft', 'kneeLeft', 'ankleLeft', 'hipRight', 'kneeRight', 'ankleRight'];
/** Degrees a joint may turn in one sixtieth of a second: half as much again as the fastest thing a landing does. */
const TURN_LIMIT = 45, CATCH_TURN_LIMIT = 50;
const FLOOR = 0, SWING = { up: 8, len: 6, amp: 0.6 }, TRAVEL = 8;
// The course runs the way a corridor does, toward -Z; a rope at yaw 90 swings along it, forward as its angle grows.
const course = {
  v: 1, name: 'Rope release motion fixture', spawn: [0, FLOOR + 0.6, 12], killY: -60,
  components: [
    { t: 'platform', p: [0, FLOOR - 0.5, -30], s: [12, 1, 140] },
    { t: 'ropeswing', p: [0, FLOOR + SWING.up, 0], len: SWING.len, amp: SWING.amp, speed: 0, phase: 0, yaw: 90 },
    // a pair: the second comes to meet a leap off the first
    { t: 'ropeswing', p: [0, FLOOR + SWING.up, -30], len: SWING.len, amp: SWING.amp, speed: 0, phase: 0, yaw: 90 },
    { t: 'ropeswing', p: [0, FLOOR + SWING.up, -39.3], len: SWING.len, amp: SWING.amp, speed: 0, phase: Math.PI, yaw: 90 },
    // a travelling one
    { t: 'ropeswing', p: [0, FLOOR + SWING.up, -70], len: SWING.len, amp: 0.2, speed: 0, phase: 0, yaw: 90, range: TRAVEL, cycle: 0.8, axis: 'z', travelPhase: 0 },
    // and one that hangs still: a leap straight up off it comes straight back down onto it
    { t: 'ropeswing', p: [0, FLOOR + SWING.up, 28], len: SWING.len, amp: 0, speed: 1, phase: 0, yaw: 90 },
    { t: 'gate', p: [0, FLOOR + 0.5, -95] },
  ],
};
const CASES = [
  // rope, the point of its swing, seconds Jump is held (0.4 is a full charge), the stick after letting go
  { name: 'tap at the forward end', rope: 0, at: 'front', hold: 0, stick: 1 },
  { name: 'tap through the bottom', rope: 0, at: 'bottom', hold: 0, stick: 1 },
  { name: 'tap at the back end', rope: 0, at: 'back', hold: 0, stick: 1 },
  { name: 'half charge', rope: 0, at: 'front', hold: 0.2, stick: 1 },
  { name: 'full charge at the forward end', rope: 0, at: 'front', hold: 0.45, stick: 1, flips: true },
  { name: 'full charge through the bottom', rope: 0, at: 'bottom', hold: 0.45, stick: 1, flips: true },
  { name: 'tap off the travelling rope', rope: 3, at: 'far', hold: 0, stick: 1 },
  { name: 'tap into the next rope', rope: 1, at: 'front', hold: 0, stick: 1, into: 2 },
  { name: 'tap with no steer: back onto the same rope', rope: 0, at: 'front', hold: 0, stick: 0, into: 0 },
  { name: 'full charge with no steer: back onto the same rope', rope: 4, at: 'any', hold: 0.45, stick: 0, into: 4, flips: true },
];

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST, TUNING, THREE }) => {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { UNITY_ROPE_CLIP_IDS } = await server.ssrLoadModule('/src/animation/index.ts');
  stock.dispose();
  const level = new Level(scene, { id: 'rope-release-motion', name: course.name, data: course });
  scene.updateMatrixWorld(true);
  p.competitionMode = false; p.endlessDeaths = true;
  const DT = CONST.fixedStep, deg = radians => radians * 180 / Math.PI;
  const tick = input => { p.step(DT, input, level); level.update(DT); p.flushLevelCrateRewards(level); p.commitRenderStep(level); };
  const node = id => p.animationRig.jointsById.get(id)?.node;
  for (const id of JOINTS) assert.ok(node(id), `the rig has no ${id} joint to watch`);
  const point = new THREE.Vector3(), other = new THREE.Vector3();
  const snapshot = () => {
    // (The rig is drawn under a body scaled unevenly: its world turns are only turns once normalized.)
    const turn = {}, at = {};
    for (const id of JOINTS) { turn[id] = node(id).getWorldQuaternion(new THREE.Quaternion()).normalize(); at[id] = node(id).getWorldPosition(new THREE.Vector3()); }
    let sole = Infinity;
    for (const { sole: mesh } of p.proceduralFootwear ?? []) {
      mesh.updateWorldMatrix(true, false);
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i += 3) sole = Math.min(sole, point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).y);
    }
    return { turn, at, sole, feet: p.pos.clone(), state: p.state, grounded: p.grounded, clip: p.animationClipHint, yaw: p.visualYaw, rope: p.ropeObj,
      release: { ...p.ropeAnimationDiagnostics } };
  };
  const summary = [];
  for (const test of CASES) {
    const rope = level.ropeSwings[test.rope];
    level.reset(true); level.time = 0; level.update(0);
    // Into the air beside the rope, travelling forward: the catch is the game's own.
    level.ropePointAt(rope, rope.len - 1.2, point);
    p.respawn(level, true, false, { position: new THREE.Vector3(0, point.y - 1.0, point.z + 0.6), heading: new THREE.Vector3(0, 0, -1) });
    p.pos.set(0, point.y - 1.0, point.z + 0.6); p.prevPos.copy(p.pos);
    p.state = 'air'; p.grounded = false; p.groundHit = null; p.vVel = -1; p.lastVelX = 0; p.lastVelZ = -9; p.ropeCoolT = 0; p.walkVelocity.set(0, 0, -9);
    for (let i = 0; i < 4 && p.state !== 'rope'; i++) tick(makeInput({ moveY: 1 }));
    assert.equal(p.state, 'rope', `${test.name}: the fixture did not catch its rope`);
    const facing = p.visualYaw;
    // Let the hang settle, then wait for the asked point of the swing.
    for (let i = 0; i < 90; i++) tick(makeInput());
    const there = () => test.at === 'any' ? true : test.at === 'front' ? rope.theta > 0.93 * rope.amp
      : test.at === 'back' ? rope.theta < -0.93 * rope.amp
        : test.at === 'bottom' ? rope.thetaV > 0 && Math.abs(rope.theta) < 0.06 * rope.amp
          : rope.anchor.distanceTo(rope.travel.base) > 0.93 * TRAVEL;
    let waited = 0;
    while (!there()) { tick(makeInput()); assert.ok(++waited < 1500 && p.state === 'rope', `${test.name}: the rope never came to its ${test.at} point`); }
    // Hold Jump, let go, and follow it.
    const frames = [snapshot()];
    let held = 0, was = false, released = -1, landed = -1, caught = -1;
    for (let k = 0; k < 400; k++) {
      const jump = released < 0 && (held++ * DT <= Math.max(test.hold, 2 * DT));
      const input = makeInput({ moveY: released >= 0 && landed < 0 ? test.stick : 0 });
      input.jumpHeld = jump; input.jumpPressed = jump && !was; input.jumpReleased = !jump && was; was = jump;
      const before = p.state;
      tick(input);
      frames.push(snapshot());
      if (released < 0) { if (before === 'rope' && p.state === 'air') released = frames.length - 1; continue; }
      if (caught < 0 && p.state === 'rope') caught = frames.length - 1;
      if (landed < 0 && caught < 0 && p.grounded && p.state === 'ride') landed = frames.length - 1;
      if ((landed >= 0 && frames.length - 1 - landed >= 30) || (caught >= 0 && frames.length - 1 - caught >= 40)) break;
    }
    assert.ok(released > 0, `${test.name}: never left the rope`);
    const leap = frames[released], flight = frames.slice(released);
    assert.ok(Math.abs(Math.atan2(Math.sin(facing), Math.cos(facing))) < 0.05, `${test.name}: the fixture does not hang facing along its swing`);
    if (test.into === undefined) assert.ok(landed > 0, `${test.name}: never landed`);
    else {
      assert.ok(caught > 0, `${test.name}: never had hold of a rope again`);
      assert.equal(frames[caught].rope, level.ropeSwings[test.into], `${test.name}: the wrong rope took him`);
    }

    // A backflip or a plain leap, never part of each.
    if (test.flips) {
      assert.equal(leap.clip, UNITY_ROPE_CLIP_IDS.release, `${test.name}: a full charge did not play the backflip`);
      assert.equal(leap.release.releaseCharge, 1);
      assert.ok(leap.release.releaseDuration > 0.4 && leap.release.releaseDuration < 0.75, `${test.name}: backflip paced to ${leap.release.releaseDuration.toFixed(2)} s`);
      // (Onto the ground, that is. Straight up off a still rope he has hold of it again, higher, before he is round.)
      const over = frames.findIndex((frame, i) => i > released && frame.clip !== UNITY_ROPE_CLIP_IDS.release);
      if (landed >= 0) assert.ok(over > 0 && over < landed, `${test.name}: the backflip's clip was still playing when the air ran out`);
    } else {
      assert.equal(leap.release.releaseDuration, 0, `${test.name}: a plain leap was given a release clip`);
      assert.equal(leap.release.releaseCharge, 0, `${test.name}: a plain leap blends toward the backflip`);
      assert.ok(flight.every(frame => frame.clip !== UNITY_ROPE_CLIP_IDS.release), `${test.name}: a plain leap played the release clip`);
    }

    // No joint flips, and the body does not turn as the hands open.
    let worst = { turn: 0 };
    for (let i = released; i < frames.length; i++) for (const id of JOINTS) {
      const turn = deg(frames[i - 1].turn[id].angleTo(frames[i].turn[id]));
      if (turn > worst.turn) worst = { turn, id, t: (i - released) * DT, clip: frames[i].clip };
    }
    const limit = test.into === undefined ? TURN_LIMIT : CATCH_TURN_LIMIT;
    assert.ok(worst.turn <= limit,
      `${test.name}: ${worst.id} turned ${worst.turn.toFixed(0)} degrees in one frame, ${worst.t?.toFixed(2)} s after the hands opened (${worst.clip})`);
    for (let i = released; i < Math.min(frames.length, released + 9); i++) {
      const facing = deg(Math.abs(Math.atan2(Math.sin(frames[i].yaw - frames[i - 1].yaw), Math.cos(frames[i].yaw - frames[i - 1].yaw))));
      assert.ok(facing < 1, `${test.name}: the body turned ${facing.toFixed(0)} degrees about its height as the hands opened`);
    }

    // Nothing steps: away from the leap's own push and the landing's or the catch's own stop, the hips move on
    // at the speed they had (second difference of their place in the world, metres).
    const events = new Set([released, released + 1, landed, landed + 1, landed - 1, caught, caught + 1, caught + 2]);
    let step = 0;
    for (let i = released + 2; i < frames.length; i++) {
      if (events.has(i)) continue;
      const a = frames[i - 2].at.hips, b = frames[i - 1].at.hips, c = frames[i].at.hips;
      step = Math.max(step, point.copy(c).sub(b).sub(other.copy(b).sub(a)).length());
    }
    assert.ok(step < 0.35, `${test.name}: the body stepped ${step.toFixed(2)} m in one frame`);

    // The hands have come away with the body: a tenth of a second on they are well clear of where they held.
    // (They were IK'd to the departed rope before, a metre behind the shoulders.)
    const after = frames[Math.min(frames.length - 1, released + 6)];
    for (const side of ['Left', 'Right']) {
      const reach = after.at[`wrist${side}`].distanceTo(after.at[`shoulder${side}`]);
      assert.ok(reach < 0.95, `${test.name}: the ${side.toLowerCase()} hand is ${reach.toFixed(2)} m from its shoulder a tenth of a second after letting go`);
    }

    if (landed >= 0) {
      const over = frames[landed].sole - FLOOR;
      assert.ok(over < 0.2, `${test.name}: the soles are ${over.toFixed(2)} m over the floor as he lands`);
      summary.push(`${test.name}: ${worst.turn.toFixed(0)} deg, soles ${over.toFixed(2)} m`);
    } else {
      // Going on to a rope ahead, the arms are out for it before the hands close: each hand most of an arm's
      // length from its shoulder toward where the catch will plant it (a metre over the feet is where a rope is
      // caught).
      if (test.into !== test.rope) {
        const before = frames[caught - 1], ahead = level.ropeSwings[test.into];
        const chest = before.feet.clone(); chest.y += 1;
        level.ropePointAt(ahead, level.ropeClosestDistance(ahead, chest), point);
        for (const side of ['Left', 'Right']) {
          const shoulder = before.at[`shoulder${side}`];
          const toward = other.copy(before.at[`wrist${side}`]).sub(shoulder).dot(point.clone().sub(shoulder).normalize());
          assert.ok(toward > 0.35, `${test.name}: the ${side.toLowerCase()} hand was not out for the next rope as it was caught (${toward.toFixed(2)} m toward it)`);
        }
        assert.ok((caught - released) * DT < TUNING.jumpChargeTime + 0.12, `${test.name}: the next rope took ${((caught - released) * DT).toFixed(2)} s to take him`);
      }
      summary.push(`${test.name}: ${worst.turn.toFixed(0)} deg, caught after ${((caught - released) * DT).toFixed(2)} s`);
    }
  }
  level.dispose();
  console.log(`PASS rope release motion: ${summary.join('; ')}`);
}, { animationScheme: 'D' });
