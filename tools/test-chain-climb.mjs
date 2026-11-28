// The chain of a swinging ball is something to hold: caught from a jump, climbed up and down, swung with and leapt
// off, like a rope. And the ball on the end of it is as deadly as it ever was.
//
// Played with the real player and the production animation on a small fixture course:
//   - every ball with chain enough above it has a chain to hold (`Level.chainGrabs`), and none of them is a rope
//     swing; a ball on too short a chain has none;
//   - a full jump from under the post, timed so that the ball goes by under his feet, catches the chain at its
//     lowest hold; held there for two whole swings the ball's box never reaches him;
//   - he swings with it, climbs to the top hold and back down to the lowest and no further, and leaps off;
//   - a body under the post when the ball comes through is killed, and so is a body on a chain that another
//     ball swings into;
//   - a chain whose ball has been smashed off its gallows lets go of whoever holds it.
// (On a side-scrolling line a rider holding a chain stays on the line: tools/test-side-platform-lab.mjs plays that.)
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const FLOOR = 0;
const BALL = { up: 7, len: 6, amp: 0.95, speed: 1.25 };
const course = {
  v: 1, name: 'Chain climb fixture', spawn: [0, FLOOR + 0.6, 12], killY: -60,
  components: [
    { t: 'platform', p: [20, FLOOR - 0.5, -20], s: [80, 1, 110] },
    // the one that is played: it swings along the corridor, over a body stood under its post
    { t: 'pendulum', p: [0, FLOOR + BALL.up, 0], len: BALL.len, amp: BALL.amp, speed: BALL.speed, phase: 0, yaw: 90 },
    // a ball on too short a chain to hang from clear of it
    { t: 'pendulum', p: [0, FLOOR + 5, -30], len: 4, amp: 0.8, speed: 1.3, phase: 0, yaw: 90 },
    // a chain that hangs still, and a second ball that swings through whoever is on it
    { t: 'pendulum', p: [40, FLOOR + 7, 0], len: 6, amp: 0, speed: 1, phase: 0, yaw: 90 },
    { t: 'pendulum', p: [40, FLOOR + 8.9, 0], len: 6, amp: 0.9, speed: 1.2, phase: 0, yaw: 0 },
    { t: 'gate', p: [0, FLOOR + 0.5, -70] },
  ],
};

await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST, TUNING, THREE }) => {
  const { Level, CHAIN_HOLD_CLEAR, CHAIN_HOLD_TOP, CHAIN_EYE } = await server.ssrLoadModule('/src/level.ts');
  stock.dispose();
  const level = new Level(scene, { id: 'chain-climb', name: course.name, data: course });
  scene.updateMatrixWorld(true);
  p.competitionMode = false; p.endlessDeaths = true;
  const DT = CONST.fixedStep, point = new THREE.Vector3(), body = new THREE.Box3(), size = new THREE.Vector3();
  const tick = input => { p.step(DT, input, level); level.update(DT); p.flushLevelCrateRewards(level); p.commitRenderStep(level); };
  const [played, short, still, other] = level.pendulums;
  const restart = () => { level.reset(true); level.time = 0; level.update(0); };
  const standAt = (x, z) => { p.respawn(level, true, false, { position: new THREE.Vector3(x, FLOOR + 0.15, z), heading: new THREE.Vector3(0, 0, -1) }); for (let i = 0; i < 30; i++) tick(makeInput()); };
  const airAt = (x, y, z) => { p.respawn(level, true, false, { position: new THREE.Vector3(x, y, z), heading: new THREE.Vector3(0, 0, -1) });
    p.pos.set(x, y, z); p.prevPos.copy(p.pos); p.state = 'air'; p.grounded = false; p.groundHit = null; p.vVel = 0; p.lastVelX = 0; p.lastVelZ = -3; p.ropeCoolT = 0; p.walkVelocity.set(0, 0, -3); };
  /** How far the ball's touch-kill box is from the body's box (0 or less: they overlap). */
  const clearOf = pendulum => {
    const half = p.hitboxHalf;
    body.setFromCenterAndSize(point.set(p.pos.x, p.pos.y + half.y, p.pos.z), size.set(half.x * 2, half.y * 2, half.z * 2));
    const ball = pendulum.box;
    return Math.max(body.min.x - ball.max.x, ball.min.x - body.max.x, body.min.y - ball.max.y, ball.min.y - body.max.y, body.min.z - ball.max.z, ball.min.z - body.max.z);
  };
  /** Seconds until that pendulum's chain next hangs straight down (a swing is a sine of the level's clock). */
  const untilDown = pendulum => { const phase = level.time * pendulum.speed + pendulum.phase; return (Math.ceil(phase / Math.PI - 1e-9) * Math.PI - phase) / pendulum.speed; };

  // ---- what is built ----------------------------------------------------------------
  assert.equal(level.ropeSwings.length, 0, 'a chain is not a rope swing: a level\'s rope swings are the ropes it was given');
  assert.equal(level.pendulums.length, 4);
  assert.equal(level.chainGrabs.length, 3, 'every ball with chain enough above it has a chain to hold');
  assert.equal(short.chain, undefined, 'a ball 4 m below its post has no chain long enough to hang from clear of it');
  const chain = played.chain;
  assert.ok(chain && level.chainGrabs.includes(chain));
  assert.ok(Math.abs(chain.maxGrip - (BALL.len - CHAIN_HOLD_CLEAR)) < 1e-9 && Math.abs(chain.len - (BALL.len - CHAIN_EYE)) < 1e-9 && chain.rigid === true);
  assert.ok(CHAIN_HOLD_CLEAR >= 3.22, 'the lowest hold is where no swing of the chain brings the ball\'s box to a body hung from it');

  // ---- the ball still hurts: stood under the post, he is struck as it comes through ---------------
  restart();
  standAt(0, 0);
  for (let i = 0; i < 400 && p.state !== 'dead'; i++) tick(makeInput());
  assert.equal(p.state, 'dead', 'a body stood under the post is killed by the ball');

  // ---- caught from a jump -------------------------------------------------------------
  // He waits beside its swing, steps under the post once the ball has gone by, and jumps: a full charge, let go so
  // that the top of the jump comes a tenth of a second before the chain next hangs straight down. The ball goes
  // by under his feet.
  restart();
  standAt(2.6, 0);
  let was = false, k = 0, under = false, lowestOverBall = Infinity;
  for (; k < 900 && p.state !== 'rope' && p.state !== 'dead'; k++) {
    const next = untilDown(played), half = Math.PI / played.speed;
    if (!under && next > 1.5 && next < half - 0.3) under = true;
    const jump = under && Math.abs(p.pos.x) < 0.4 && p.grounded && next <= 0.92 && next > 0.52;
    const input = makeInput({ moveX: !under || !p.grounded || jump || Math.abs(p.pos.x) < 0.12 ? 0 : Math.max(-0.6, Math.min(0.6, -p.pos.x)) });
    input.jumpHeld = jump; input.jumpPressed = jump && !was; input.jumpReleased = !jump && was; was = jump;
    tick(input);
    if (!p.grounded && p.state === 'air') lowestOverBall = Math.min(lowestOverBall, clearOf(played));
  }
  assert.equal(p.state, 'rope', `a full jump from under the post did not catch the chain (state ${p.state}, ${(k * DT).toFixed(1)} s)`);
  assert.equal(p.ropeObj, chain, 'what he has hold of is the ball\'s chain');
  assert.ok(Math.abs(p.ropeD - chain.maxGrip) < 0.05, `caught from below, it is held at its lowest hold (${p.ropeD.toFixed(2)} of ${chain.maxGrip.toFixed(2)} m)`);
  assert.ok(lowestOverBall > 0, `the ball went by clear of him as he jumped (${lowestOverBall.toFixed(2)} m)`);

  // ---- held, and swung with -----------------------------------------------------------
  let nearest = Infinity, far = 0;
  const period = Math.ceil(2 * Math.PI / played.speed / DT);
  for (let i = 0; i < 2 * period; i++) {
    tick(makeInput());
    assert.equal(p.state, 'rope', `he lost the chain ${(i * DT).toFixed(2)} s into holding it (${p.state})`);
    // (within what the chain moves in the one step between his place being taken from it and its being asked here)
    level.ropePointAt(chain, p.ropeD, point);
    assert.ok(Math.abs(p.pos.x - point.x) < 0.08 && Math.abs(p.pos.z - point.z) < 0.08 && Math.abs(p.pos.y - (point.y - 1.85)) < 0.08, 'he hangs straight down from his hold on it');
    nearest = Math.min(nearest, clearOf(played)); far = Math.max(far, Math.abs(p.pos.z));
  }
  assert.ok(nearest > 0, `at the lowest hold the ball's box never reaches him (${nearest.toFixed(3)} m at its nearest)`);
  assert.ok(far > 1.8, `he swings with it (${far.toFixed(2)} m out from under the post)`);

  // ---- climbed -----------------------------------------------------------------------
  const from = p.ropeD; let frames = 0;
  while (p.ropeD > CHAIN_HOLD_TOP + 1e-6 && frames++ < 600) tick(makeInput({ moveY: 1 }));
  assert.ok(Math.abs(p.ropeD - CHAIN_HOLD_TOP) < 1e-6 && p.state === 'rope', `up climbs to the top hold (${p.ropeD.toFixed(2)} m below the post)`);
  const rate = (from - p.ropeD) / (frames * DT);
  assert.ok(Math.abs(rate - CONST.ropeClimbSpeed) < 0.15, `at a rope's climbing speed (${rate.toFixed(2)} m/s)`);
  for (let i = 0; i < 10; i++) tick(makeInput({ moveY: 1 }));
  assert.ok(Math.abs(p.ropeD - CHAIN_HOLD_TOP) < 1e-6, 'and no higher');
  for (let i = 0; i < 240; i++) tick(makeInput({ moveY: -1 }));
  assert.ok(Math.abs(p.ropeD - chain.maxGrip) < 1e-6 && p.state === 'rope', `down climbs to the lowest hold and no lower (${p.ropeD.toFixed(2)} m)`);
  for (let i = 0; i < period; i++) { tick(makeInput({ moveY: -1 })); nearest = Math.min(nearest, clearOf(played)); }
  assert.ok(p.state === 'rope' && nearest > 0, 'held down against the lowest hold for a whole swing, the ball still does not reach him');

  // ---- leapt off -----------------------------------------------------------------------
  was = false; let left = -1;
  for (k = 0; k < 600; k++) {
    const jump = k < 2 && p.state === 'rope';
    const input = makeInput({ moveX: p.state === 'rope' ? 0 : 1 });
    input.jumpHeld = jump; input.jumpPressed = jump && !was; input.jumpReleased = !jump && was; was = jump;
    const before = p.state; tick(input);
    if (before === 'rope' && p.state === 'air') { left = k; assert.ok(p.vVel >= TUNING.jumpMinVelocity - 1e-6, 'Jump leaps off it as off a rope'); }
    if (left >= 0 && k < left + 20) assert.notEqual(p.state, 'rope', 'the chain a leap has just left does not take him straight back');
    if (left >= 0 && p.grounded && p.state === 'ride') break;
    assert.notEqual(p.state, 'dead', 'the leap off the chain killed him');
  }
  assert.ok(left >= 0 && p.grounded && p.state === 'ride' && Math.abs(p.pos.y - FLOOR) < 0.05, 'he lands on his feet');

  // ---- the ball still hurts a body on a chain: another ball swings into him -------------------
  restart();
  level.ropePointAt(still.chain, still.chain.maxGrip, point);
  // (out of the other ball's way for now: it is at the bottom of its swing at time zero)
  for (let i = 0; i < Math.round(0.9 / DT); i++) level.update(DT);
  airAt(point.x, point.y - 1.3, point.z + 0.4);
  for (let i = 0; i < 4 && p.state !== 'rope'; i++) tick(makeInput());
  assert.ok(p.state === 'rope' && p.ropeObj === still.chain, 'the still chain was not caught');
  let struck = false;
  for (let i = 0; i < Math.ceil(2 * Math.PI / other.speed / DT) && !struck; i++) { tick(makeInput()); struck = p.state === 'dead'; }
  assert.ok(struck, 'a ball that swings into a body on a chain kills it: holding a chain makes no ball safe');

  // ---- a chain whose ball is gone lets go --------------------------------------------------
  restart();
  level.ropePointAt(chain, chain.maxGrip, point);
  airAt(point.x, point.y - 1.3, point.z + 0.4);
  for (let i = 0; i < 4 && p.state !== 'rope'; i++) tick(makeInput());
  assert.ok(p.state === 'rope' && p.ropeObj === chain, 'the played chain was not caught again');
  played.crushed = true;
  tick(makeInput()); tick(makeInput());
  assert.ok(p.state === 'air' && p.ropeObj === null && chain.live === false, 'a chain whose ball was smashed off its gallows lets go of him');
  airAt(point.x, point.y - 1.3, point.z + 0.4);
  tick(makeInput());
  assert.notEqual(p.state, 'rope', 'and cannot be caught while it is gone');
  played.crushed = false;

  // ---- a ball on a short chain has nothing to hold ------------------------------------------
  restart();
  airAt(short.pivot.position.x, short.pivot.position.y - 2.4, short.pivot.position.z + 0.3);
  tick(makeInput());
  assert.notEqual(p.state, 'rope', 'a ball on too short a chain was caught');

  level.dispose();
  console.log(`PASS chain climb: caught from a full jump at its lowest hold (${chain.maxGrip.toFixed(2)} m below the post, ${CHAIN_HOLD_CLEAR} m above the ball), ` +
    `the ball never nearer than ${nearest.toFixed(2)} m, swung ${far.toFixed(2)} m out, climbed at ${rate.toFixed(2)} m/s between ${CHAIN_HOLD_TOP} and ${chain.maxGrip.toFixed(2)} m, leapt off; ` +
    'struck under the post, struck on a chain by another ball, dropped by a smashed one');
}, { animationScheme: 'D' });
