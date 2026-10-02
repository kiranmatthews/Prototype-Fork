import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withTempleRuntime as withBlockworksRuntime } from './temple-test-runtime.mjs';
import { puzzleControls } from './puzzle-controls.mjs';

const MODULE = '/src/levels/jungle-sequels.ts';
const reports = [];
const requestedCase = process.argv.find(value => value.startsWith('--case='))?.slice(7);

function* roomCorrect(r, index) {
  const c = puzzleControls(r), { p } = r;
  const room = r.sourceModule.JUNGLE_SEQUEL_ROUTES[index].rooms[0];
  const { x, y, capY, switchX } = room;
  const arrow = c.crateSpecAt(x, y), rewards = [c.crateSpecAt(x + 4, capY), c.crateSpecAt(x + 6, capY)];
  yield* c.stepFor(20);
  if (switchX !== undefined) {
    assert.ok(rewards.every(crate => crate.pending), 'return rewards must begin as visible outlines');
    yield* c.walk([x - 2, y, 0], 'move onto the clear central lane');
    yield* c.walk([switchX - 1.2, y, 0], 'pass the preserved arrow to the distant reveal switch');
    yield* c.walk([switchX - 1.2, y, -2.3], 'approach the reveal switch from its supported side');
    yield* c.hit(c.crateSpecAt(switchX, y), 'reveal the earlier balcony rewards');
    assert.ok(rewards.every(crate => !crate.pending && crate.alive));
    yield* c.walk([switchX - 1.8, y, 0], 'return to the clear central lane');
    yield* c.walk([x - 1.8, y, 0], 'return to the conserved arrow');
  }
  yield* c.bounce(arrow, [x + 4.9, capY, -2.3], 'use the preserved arrow to reach the upper balcony',
    { double: true, airSpinAbove: capY - 1.2 });
  for (const reward of rewards) if (reward.alive) yield* c.hit(reward, 'claim the upper reward before removing the arrow');
  assert.ok(arrow.alive && rewards.every(crate => !crate.alive));
  yield* c.walk([x + 2.95, capY, -2.3], 'stage at the balcony return edge');
  yield* c.hop([x - 1.8, y, -2.3], 'return to the supported court');
  yield* c.hit(arrow, 'clear the spent arrow last');
  assert.equal(arrow.alive, false);
  assert.equal(p.totalDeaths, 0);
  return { test: 'optional balcony upper-first solution', id: r.id, switchX, rewards: rewards.length,
    launcherAlive: arrow.alive, deaths: p.totalDeaths };
}

function* roomWrong(r, index) {
  const c = puzzleControls(r), { p } = r;
  const { x, y, capY, switchX } = r.sourceModule.JUNGLE_SEQUEL_ROUTES[index].rooms[0];
  const arrow = c.crateSpecAt(x, y), rewards = [c.crateSpecAt(x + 4, capY), c.crateSpecAt(x + 6, capY)];
  yield* c.stepFor(20);
  if (switchX !== undefined) {
    yield* c.walk([x - 2, y, 0], 'take the central lane before the wrong-order trial');
    yield* c.walk([switchX - 1.2, y, 0], 'approach the later reveal switch');
    yield* c.walk([switchX - 1.2, y, -2.3], 'reach the reveal switch on the lower court');
    yield* c.hit(c.crateSpecAt(switchX, y), 'materialise the high targets before testing donor loss');
    yield* c.walk([switchX - 1.8, y, 0], 'return from the used switch');
    yield* c.walk([x - 1.8, y, 0], 'return to the donor before the wrong-order trial');
    assert.ok(rewards.every(crate => crate.alive && !crate.pending));
  }
  yield* c.hit(arrow, 'wrong order: destroy the access arrow');
  yield* c.walk([x + 1.6, y, -2.3], 'attempt the balcony after losing the arrow');
  const attempts = [];
  for (const timing of [7, 3, .5, -1.5]) {
    const first = r.frame;
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel <= timing, {}, { label: 'ordinary charged-jump ascent', limit: 100 });
    yield* c.tick({ jumpHeld: true }); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.grounded, () => ({ ...c.steer([x + 4, y, -2.3]),
      jumpHeld: p.state === 'hang', spinHeld: p.pos.y > y + 3.8 }),
    { label: 'attempt ordinary double jump, air spin and native ledge grab', limit: 240 });
    const trace = r.trace.slice(first), peak = Math.max(...trace.map(row => row.position[1]));
    assert.ok(peak < capY - 1, 'ordinary jump bypassed the missing access arrow');
    assert.ok(rewards.every(crate => crate.alive), 'the upper rewards were collected without the access arrow');
    assert.ok(!trace.some(row => row.state === 'hang'), 'native ledge grab bypassed the missing arrow');
    attempts.push({ timing, peak, capY });
    yield* c.stepFor(25);
    yield* c.walk([x + 1.6, y, -2.3], 'reset the ordinary-jump approach');
  }
  assert.equal(p.totalDeaths, 0);
  return { test: 'early donor destruction blocks balcony access', id: r.id, attempts, deaths: p.totalDeaths };
}

function* crownCorrect(r) {
  const c = puzzleControls(r), { p } = r, x = 354, y = 34.5, z = -2.3;
  const arrow = c.crateSpecAt(x, y), cap = c.crateSpecAt(x, 43.9);
  yield* c.stepFor(20);
  yield* c.walk([x - 1.65, y, z], 'crown arrow takeoff');
  yield* c.charge(); yield* c.tick({ jumpReleased: true });
  yield* c.until(() => p.vVel > 15 && p.pos.y < arrow.box.max.y + .2,
    () => ({ ...c.steer([x, y, z]), jumpHeld: true }), { label: 'real crown arrow contact', limit: 140 });
  yield* c.until(() => !cap.alive || p.vVel < .65, () => ({ ...c.steer([x, y, z]), jumpHeld: true }),
    { label: 'rise toward the upper crown reward', limit: 100 });
  if (cap.alive) {
    yield* c.tick({}); yield* c.tick({ jumpHeld: true }); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => !cap.alive, () => c.steer([x, y, z]), { label: 'double-jump head bump claims the crown reward', limit: 100 });
  }
  assert.ok(arrow.alive, 'crown arrow was destroyed before the high reward');
  yield* c.until(() => p.grounded, () => c.steer([x - 2.3, y, z]), { label: 'leave the crown arrow intact', limit: 180 });
  yield* c.hit(arrow, 'clear the crown arrow after the reward');
  assert.equal(p.totalDeaths, 0);
  return { test: 'crown upper-first solution', capAlive: cap.alive, arrowAlive: arrow.alive, deaths: p.totalDeaths };
}

function* crownWrong(r) {
  const c = puzzleControls(r), { p } = r;
  const arrow = c.crateSpecAt(354, 34.5), cap = c.crateSpecAt(354, 43.9);
  yield* c.stepFor(20);
  yield* c.hit(arrow, 'wrong order: remove the crown donor before its high target');
  yield* c.walk([354, 34.5, -2.3], 'stand under the inaccessible crown reward');
  const attempts = [];
  for (const timing of [7, 3, .5, -1.5]) {
    const first = r.frame;
    yield* c.charge(); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.vVel <= timing, {}, { label: 'ordinary jump toward the crown target', limit: 100 });
    yield* c.tick({ jumpHeld: true }); yield* c.tick({ jumpReleased: true });
    yield* c.until(() => p.grounded, () => ({ spinHeld: p.pos.y > 38.3 }),
      { label: 'try double jump and air spin without the crown donor', limit: 180 });
    assert.ok(cap.alive, 'ordinary double jump collected the crown without its donor');
    attempts.push({ timing, peak: Math.max(...r.trace.slice(first).map(row => row.position[1])), capY: 43.9 });
    yield* c.stepFor(25);
  }
  assert.equal(p.totalDeaths, 0);
  return { test: 'crown donor loss blocks ordinary jump and air-spin collection', attempts, capAlive: cap.alive, deaths: 0 };
}

function* tntRefuge(r, x, y) {
  const c = puzzleControls(r), { p, TUNING, THREE } = r;
  const tnt = c.crateSpecAt(x, y), cap = c.crateSpecAt(x, y + .96), reward = c.crateSpecAt(x + 5.5, y);
  yield* c.stepFor(20);
  const rewardDistance = reward.mesh.position.distanceTo(tnt.mesh.position);
  assert.ok(rewardDistance > TUNING.tntRadius + .6,
    'recovery reward intersects the configured TNT blast');
  yield* c.charge(); yield* c.tick({ jumpReleased: true });
  yield* c.until(() => !cap.alive, () => c.steer([x, y, -2.3]), { label: 'stomp the wooden cap without spinning', limit: 160 });
  yield* c.until(() => tnt.fuse !== undefined, () => c.steer([x, y, -2.3]),
    { label: 'rebound onto TNT and prime its normal fuse', limit: 180 });
  assert.ok(tnt.alive && tnt.fuse > 2.7);
  const fuseStart = r.frame, destination = [x + 5.5, y, 0];
  yield* c.until(() => p.grounded && c.distance(destination) < .3, () => c.steer(destination),
    { label: 'retreat into the clear recovery refuge', limit: 160 });
  const refugeFrames = r.frame - fuseStart;
  yield* c.until(() => !tnt.alive, {}, { label: 'wait beyond the TNT blast radius', limit: 240 });
  const fuseFrames = r.frame - fuseStart;
  yield* c.stepFor(45);
  assert.ok(reward.alive, 'the recovery reward was destroyed by the TNT blast');
  assert.equal(p.totalDeaths, 0);
  assert.ok(p.grounded && !p.isBailing);
  const blastDistance = new THREE.Vector3(...destination).distanceTo(tnt.mesh.position);
  yield* c.hit(reward, 'collect the safe recovery reward after the blast');
  return { test: 'TNT cap stomp, fuse and supported refuge', id: r.id, blastRadius: TUNING.tntRadius,
    blastDistance, rewardDistance, fuseFrames, refugeFrames, rewardSurvivedBlast: true,
    rewardCollectedAfterBlast: !reward.alive, deaths: p.totalDeaths };
}

const cases = [
  ['terraces-upper', 0, [25.9, .12, -2.3], r => roomCorrect(r, 0)],
  ['skyline-return', 1, [28.9, .12, -2.3], r => roomCorrect(r, 1)],
  ['terraces-wrong', 0, [25.9, .12, -2.3], r => roomWrong(r, 0)],
  ['skyline-wrong', 1, [28.9, .12, -2.3], r => roomWrong(r, 1)],
  ['skyline-crown', 1, [351.9, 34.62, -2.3], crownCorrect],
  ['skyline-crown-wrong', 1, [351.9, 34.62, -2.3], crownWrong],
  ['terraces-tnt', 0, [363.7, 34.62, -2.3], r => tntRefuge(r, 366, 34.5)],
  ['skyline-tnt', 1, [236.7, 17.37, -2.3], r => tntRefuge(r, 239, 17.25)],
];
for (const [name, index, start, pilot] of cases) {
  if (requestedCase && requestedCase !== name) continue;
  const id = index ? 'jungle-skyline' : 'jungle-terraces';
  const report = await withBlockworksRuntime(async r => {
    r.id = id; r.report = { stage: 'start', actions: [], evidence: [] };
    try {
      const generator = pilot(r); let next = generator.next();
      while (!next.done) { r.tick(next.value); next = generator.next(); }
      const result = { name, ...next.value, frames: r.frame, seconds: r.frame * r.dt };
      r.report.result = result;
      return result;
    } catch (error) {
      r.report.error = error.message;
      throw error;
    } finally {
      await writeFile(`${tmpdir()}/jungle-sequel-${name}.json`, JSON.stringify({ report: r.report, trace: r.trace }, null, 2));
    }
  }, { modulePath: MODULE, levelId: id, source: module => module.JUNGLE_SEQUEL_ROUTES[index].data,
    controlFrame: () => ({ x: 0, z: -1 }), start, maxFrames: 9000 });
  reports.push(report); console.log(JSON.stringify(report));
}
assert.ok(reports.length, `unknown case: ${requestedCase}`);
console.log(`PASS ${reports.length} optional Jungle sequel crate-room and TNT-refuge input checks.`);
