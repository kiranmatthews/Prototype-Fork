import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, scene, player, level, step, TUNING }) => {
  let cases = 0, frames = 0;
  const catchRail = (rail, t, dir, speed = 14) => {
    const heading = rail.tangentAt(t).multiplyScalar(dir);
    const position = rail.pointAt(t).add(new THREE.Vector3(0, .25, 0));
    player.respawn(level, true, true, { position, heading });
    player.pos.copy(position); player.prevPos.copy(position);
    player.axisF.copy(heading); player.axisL.set(heading.z, 0, -heading.x);
    player.freeSkate = player.airFromSkate = true;
    player.state = 'air'; player.grounded = false; player.speed = speed; player.vVel = 0;
    player.rawInput = makeInput({ grindHeld: true, grindPressed: true });
    step(player.rawInput);
    assert.equal(player.state, 'grind', 'actual Triangle catch');
    assert.equal(player.grindRail, rail);
    assert.equal(player.grindDir, dir);
    // Complete the ordinary catch ease before the needle pegs.
    player.balanceBoostT = 1;
    for (let i = 0; i < 15; i++) step(makeInput({ grindHeld: true }));
    player.balanceBoostT = 0;
  };
  const fail = side => {
    player.balance = side;
    player.balanceVel = side;
    player.balanceCritT = TUNING.bailGrace;
    player.rawInput = makeInput({ grindHeld: true, moveX: side });
    step(player.rawInput);
  };
  const drop = (rail, t, dir, side, label, speed = 14) => {
    catchRail(rail, t, dir, speed);
    const start = player.pos.clone(), combo = player.comboPoints;
    fail(side);
    assert.equal(player.state, 'ride', `${label}: launched instead of dropping in`);
    assert.equal(player.grounded, true, `${label}: lost ramp support`);
    assert.equal(player.skateCameraSupported, true);
    assert.equal(player.vertAir, false);
    assert.equal(player.isBailing, false);
    assert.equal(player.freeSkate, true);
    assert.ok(player.comboPoints >= combo && player.comboMult > 0, `${label}: lost grind combo`);
    assert.ok(player.pos.distanceTo(start) < .45, `${label}: teleported away from coping`);
    assert.ok(player.pos.y < start.y && player.vVel <= 0, `${label}: upward pop`);
    assert.ok(player.parkVelocity.y < -1, `${label}: not heading down the wall`);
    let previous = player.pos.clone(), bottom = false;
    for (let f = 0; f < 150; f++) {
      // Keep the failed balance direction held through the initial drop beat.
      player.rawInput = makeInput({ grindHeld: true, moveX: f < 12 ? side : 0 });
      step(player.rawInput); frames++;
      assert.ok(player.pos.toArray().every(Number.isFinite));
      assert.equal(player.isBailing, false, `${label}: drop caused bail`);
      assert.equal(player.totalDeaths, 0);
      assert.equal(player.freeSkate, true);
      assert.equal(player.state, 'ride', `${label}: lost contact down the arc at ${f}`);
      assert.equal(player.grounded, true);
      assert.ok(player.pos.y <= previous.y + .025, `${label}: went uphill before bottom`);
      assert.ok(player.pos.distanceTo(previous) < .65, `${label}: discontinuous descent`);
      previous.copy(player.pos);
      if (player.rideNormal.y > .995) { bottom = true; break; }
    }
    assert.ok(bottom, `${label}: failed to ride out`);
    cases++;
  };
  const coping = level.grindRails[0];
  // Uniform perimeter samples cover straight walls, all rounded corners and
  // both travel directions. The authored closed perimeter has its bowl right.
  for (let i = 0; i < 16; i++) for (const dir of [-1, 1])
    drop(coping, (i + .5) / 16 * coping.totalLength, dir, dir, `bowl/${i}/${dir}`);
  // The low-speed catch is also a drop, not a stall glued onto the lip.
  drop(coping, coping.totalLength * .37, 1, 1, 'slow bowl', 4);
  catchRail(coping, coping.totalLength * .37, 1);
  fail(-1);
  assert.equal(player.isBailing, true, 'outward deck-side failure must still bail');
  cases++;
  const bar = level.grindRails.find(r => !r.coping && r.totalLength > 8);
  catchRail(bar, bar.totalLength * .5, 1);
  fail(1);
  assert.equal(player.isBailing, true, 'ordinary flat bar failure must still bail');
  cases++;

  // The same handoff must use exact analytic support on legacy halfpipes,
  // including both cross axes and both coping sides in campaign controls.
  for (const yaw of [0, 90]) {
    const firstRail = level.rails.length;
    level.buildVertRamp({ t: 'vertramp', p: [200 + yaw, 0, 0], len: 45, w: 3,
      rise: 6, vkind: 'half', arc: 90, yaw });
    level.grindRails.push(...level.rails.slice(firstRail));
    scene.updateMatrixWorld(true);
    for (const park of [true, false]) for (const rail of level.rails.slice(firstRail)) for (const dir of [-1, 1]) {
      level.skatepark = park;
      const hp = level.halfpipes.at(-1), pt = rail.pointAt(20);
      const tangent = rail.tangentAt(20).multiplyScalar(dir);
      const inward = hp.axis === 'z' ? new THREE.Vector3(Math.sign(hp.cross - pt.x), 0, 0)
        : new THREE.Vector3(0, 0, Math.sign(hp.cross - pt.z));
      const side = Math.sign(new THREE.Vector3(-tangent.z, 0, tangent.x).dot(inward));
      drop(rail, 20, dir, side, `analytic/${park}/${yaw}/${dir}`);
    }
  }
  console.log(`PASS coping drop-in: ${cases} inward/deck/bar cases, ${frames} supported descent frames; curved bowls, both pipe axes/travel directions, slow entry, held balance input, intact board/combo/camera.`);
});
