// Measures how the real Player/Level treat crates on the skateboard (plus jump
// reach and range, and enemy stomp and shell bounces), so the
// design bible (docs/GAMEPLAY_DESIGN_BIBLE.md) states engine facts, not
// guesses. Read-only: builds a throwaway flat test level, changes no tuning.
//
//   node tools/probe-crate-skate-rules.mjs [out.json]
//
// Each scenario resets the level, places the rider, steps the fixed-step
// simulation and records what happened to the crates and the rider.
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const out = process.argv[2];
const G = 0.96; // authored crate grid (enlarged x1.2 at build time)
const LANES = {};
const components = [{ t: 'platform', p: [150, -0.5, -70], s: [800, 1, 200] }];
let laneX = -180;
const lane = (name, crates = [], extra = []) => {
  const x = laneX; laneX += 24; LANES[name] = x;
  for (const c of crates) components.push({ t: 'crate', kind: c.kind ?? 'wood', p: [x + (c.dx ?? 0), c.y ?? 0, c.z] });
  for (const e of extra) components.push({ ...e, p: [x + e.p[0], e.p[1], e.p[2]] });
};
// A straight row of touching crates along -Z starting at z0.
const row = (kinds, z0 = -12, y = 0) => kinds.map((kind, i) => ({ kind, z: z0 - i * G, y }));

lane('single-wood', [{ kind: 'wood', z: -12 }]);
lane('single-tnt', [{ kind: 'tnt', z: -12 }]);
lane('single-nitro', [{ kind: 'nitro', z: -12 }]);
lane('single-arrow', [{ kind: 'bouncy', z: -12 }]);
lane('single-steel', [{ kind: 'metal', z: -12 }]);
lane('row-wood', row(['wood', 'wood', 'wood', 'wood', 'wood', 'wood']));
lane('row-tnt-mid', row(['wood', 'wood', 'tnt', 'wood', 'wood', 'wood', 'wood', 'wood']));
lane('row-nitro-mid', row(['wood', 'wood', 'nitro', 'wood', 'wood', 'wood', 'wood', 'wood']));
lane('row-switch', row(['wood', 'wood', 'bang', 'wood', 'wood', 'wood']));
lane('row-steel', row(['wood', 'wood', 'metal', 'wood', 'wood', 'wood']));
// Crate row floating over a void between two decks: a one-way grind bridge.
lane('bridge-over-pit', row(['wood', 'wood', 'wood', 'wood', 'wood', 'wood', 'wood'], -12, 0));
// An authored rail with a wood crate sitting on its line.
lane('rail-crate', [{ kind: 'wood', z: -16, y: 1.0 }], [{ t: 'rail', p: [0, 1.0, -14], len: 20, yaw: 0 }]);
lane('rail-tnt', [{ kind: 'tnt', z: -16, y: 1.0 }], [{ t: 'rail', p: [0, 1.0, -14], len: 20, yaw: 0 }]);
// Stacks met by a fast board, and crates landed on from a board air.
lane('stack2-wood', [{ kind: 'wood', z: -12 }, { kind: 'wood', z: -12, y: G }]);
lane('stack3-wood', [{ kind: 'wood', z: -12 }, { kind: 'wood', z: -12, y: G }, { kind: 'wood', z: -12, y: 2 * G }]);
lane('board-stomp-wood', [{ kind: 'wood', z: -12 }]);
lane('board-stomp-arrow', [{ kind: 'bouncy', z: -12 }]);
// On-foot launch heights off a crate lid (drop onto it, measure the apex).
lane('launch-wood', [{ kind: 'wood', z: -12 }]);
lane('launch-arrow', [{ kind: 'bouncy', z: -12 }]);
lane('launch-steel-arrow', [{ kind: 'metalbounce', z: -12 }]);
// Enemies to stomp: a stationary turtle (whose shell is then landed on) and a crab.
lane('enemy-turtle', [], [{ t: 'enemy', foe: 'turtle', p: [0, 0, -12], range: 0, speed: 0 }]);
lane('enemy-grunt', [], [{ t: 'enemy', foe: 'grunt', p: [0, 0, -12], range: 0, speed: 0 }]);
// Cut the floor out under the bridge lane: replace the shared platform there.
const bx = LANES['bridge-over-pit'];
components.push({ t: 'pit', p: [bx, -0.4, -15.5], s: [10, 1, 8.5] });

const levelEntry = {
  id: '__crate_skate_probe', name: 'Crate skate probe',
  data: { v: 1, name: 'Crate skate probe', spawn: [0, 0.2, 10], killY: -20, components },
};

const results = [];
await withSkateRuntime(async ({ THREE, player: p, level, step, TUNING, CONST }) => {
  TUNING.balanceNoise = 0; // grind balance is not under test
  // Record why a run ended (the Player does not keep its last wipeout cause).
  let lastCause = null;
  const die = p.die.bind(p);
  p.die = (cause, origin) => { if (p.state !== 'dead') lastCause = cause ?? 'contact'; return die(cause, origin); };
  const near = (name, r = 4) => level.crates.filter(c => Math.abs(c.mesh.position.x - LANES[name]) < r);
  const fwd = new THREE.Vector3(0, 0, -1);
  const reset = () => { level.reset(true); level.update(CONST.fixedStep); };
  const place = (pos, { speed, air = false }) => {
    p.respawn(level, true, true, { position: pos, heading: fwd });
    p.pos.copy(pos); p.prevPos.copy(pos);
    p.axisF.copy(fwd); p.axisL.set(fwd.z, 0, -fwd.x);
    p.freeSkate = true; p.airFromSkate = air;
    p.state = air ? 'air' : 'ride'; p.grounded = !air; p.speed = speed; p.vVel = 0;
  };
  // Watch every fixed step: transient bails recover inside the window, so
  // the final state alone under-reports them.
  let watch = null;
  const beginWatch = (name) => { lastCause = null; watch = { name, everBailed: false, everGrind: false, firstBreakT: null, fuseT: null, t: 0, minSpeed: Infinity }; };
  const tick = () => {
    if (!watch) return;
    watch.t += CONST.fixedStep;
    if (p.isBailing) watch.everBailed = true;
    if (p.state === 'grind') watch.everGrind = true;
    watch.minSpeed = Math.min(watch.minSpeed, Math.abs(p.speed));
    const cs = near(watch.name);
    if (watch.firstBreakT === null && cs.some(c => !c.alive)) watch.firstBreakT = +watch.t.toFixed(3);
    if (watch.fuseT === null && cs.some(c => c.tnt && c.alive && c.fuse !== undefined)) watch.fuseT = +watch.t.toFixed(3);
  };
  const run = (input) => { step(input); tick(); };
  const summary = (name, deaths0, extra = {}) => {
    const cs = near(name).slice().sort((a, b) => b.mesh.position.z - a.mesh.position.z);
    const kind = c => c.tnt ? 'T' : c.nitro ? 'N' : c.metal ? 'M' : c.bang ? '!' : c.bouncy ? 'A' : 'W';
    return {
      cratesStart: cs.length,
      cratesBroken: cs.filter(c => !c.alive).length,
      survivors: cs.map(c => c.alive ? kind(c) : '.').join(''),
      switchUsed: cs.some(c => c.bang && c.bangUsed),
      fuseLitAt: watch?.fuseT ?? null, firstBreakAt: watch?.firstBreakT ?? null,
      died: p.totalDeaths > deaths0 || p.state === 'dead', deathCause: lastCause,
      everBailed: !!watch?.everBailed, grind: !!watch?.everGrind,
      minSpeed: watch && Number.isFinite(watch.minSpeed) ? +watch.minSpeed.toFixed(2) : null,
      endState: p.state, speedAfter: +p.speed.toFixed(2), ...extra,
    };
  };

  // 1. Board ridden straight into a single crate (no input).
  for (const [name, speeds] of [
    ['single-wood', [6, 8, 10, 11, 12, 12.5, 13, 14, 18]],
    ['single-arrow', [11, 13, 18]],
    ['single-steel', [10, 16]],
    ['single-tnt', [1, 3, 5, 10, 12, 13, 16]],
    ['single-nitro', [8, 16]],
    ['stack2-wood', [14, 18, 23]],
    ['stack3-wood', [14, 23]],
  ]) for (const speed of speeds) {
    reset();
    const x = LANES[name], deaths0 = p.totalDeaths;
    place(new THREE.Vector3(x, 0.02, -8), { speed });
    beginWatch(name);
    for (let i = 0; i < 150 && p.state !== 'dead'; i++) run(makeInput());
    results.push({ scenario: 'board-into-crate', lane: name, speed, ...summary(name, deaths0) });
  }

  // 2. Grind along a crate row (catch its edge from the air).
  const grindRow = (name, speeds, { z = -12.4 } = {}) => {
    for (const speed of speeds) {
      reset();
      const x = LANES[name], deaths0 = p.totalDeaths;
      const rail = level.crateRails
        .filter(r => r.points.some(pt => Math.abs(pt.x - x) < 3))
        .sort((a, b) => a.points[0].x - b.points[0].x)[0];
      if (!rail) { results.push({ scenario: 'grind-row', lane: name, speed, error: 'no crate rail built' }); continue; }
      const start = rail.closest(new THREE.Vector3(x, 1.2, z)).point.clone().add(new THREE.Vector3(0, CONST.railRideHeight + 0.05, 0));
      place(start, { speed, air: true });
      beginWatch(name);
      run(makeInput({ grindHeld: true, grindPressed: true }));
      for (let i = 0; i < 240 && p.state !== 'dead'; i++) run(makeInput({ grindHeld: true }));
      results.push({ scenario: 'grind-row', lane: name, speed, ...summary(name, deaths0) });
    }
  };
  grindRow('row-wood', [4, 8, 12, 16]);
  grindRow('row-tnt-mid', [4, 5, 5.5, 6, 6.5, 7, 9, 13, 16]);
  grindRow('row-nitro-mid', [4, 5, 5.5, 6, 7, 12, 18]);
  grindRow('row-switch', [8, 14]);
  grindRow('row-steel', [8, 14]);
  grindRow('bridge-over-pit', [6, 12]);

  // 4. On foot: fall onto a crate lid from 0.6 m above and record the apex of
  // the bounce above that lid, with and without Jump held at contact.
  for (const name of ['launch-wood', 'launch-arrow', 'launch-steel-arrow']) for (const held of [false, true]) {
    reset();
    const crate = near(name)[0], lid = crate.box.max.y, deaths0 = p.totalDeaths;
    const pos = new THREE.Vector3(crate.mesh.position.x, lid + 0.6, crate.mesh.position.z);
    p.respawn(level, true, true, { position: pos, heading: fwd });
    p.pos.copy(pos); p.prevPos.copy(pos); p.freeSkate = false; p.airFromSkate = false;
    p.state = 'air'; p.grounded = false; p.speed = 0; p.vVel = -3;
    beginWatch(name);
    let apex = -Infinity, bounced = false;
    for (let i = 0; i < 150 && p.state !== 'dead'; i++) {
      run(makeInput({ jumpHeld: held }));
      if (p.vVel > 0) bounced = true;
      if (bounced) apex = Math.max(apex, p.pos.y);
      if (bounced && p.grounded) break;
    }
    results.push({ scenario: 'launch-off-lid', lane: name, speed: 0, jumpHeld: held, lidY: +lid.toFixed(3),
      apexAboveLid: Number.isFinite(apex) ? +(apex - lid).toFixed(3) : null, ...summary(name, deaths0) });
  }

  // 4b. Real-input reach: a held full jump from the floor (release-to-jump),
  // and each launch above followed by a double jump pressed at the apex.
  // Records the highest feet height above the take-off surface.
  const reach = (setup, { holdFrames = 0, doubleAtApex = false, held = false } = {}) => {
    reset();
    const { lid, pos } = setup();
    p.respawn(level, true, true, { position: pos, heading: fwd });
    p.pos.copy(pos); p.prevPos.copy(pos); p.freeSkate = false; p.airFromSkate = false; p.speed = 0;
    if (holdFrames) { p.state = 'ride'; p.grounded = true; p.vVel = 0; } else { p.state = 'air'; p.grounded = false; p.vVel = -3; }
    // This controller jumps on RELEASE: the double jump is a fresh press held
    // briefly, then released, near the apex.
    let apex = -Infinity, rising = false, doubled = false, frame = 0, releaseAt = -1;
    for (let i = 0; i < 240 && p.state !== 'dead'; i++, frame++) {
      let input;
      if (holdFrames && i < holdFrames) input = makeInput({ jumpHeld: true, jumpPressed: i === 0 });
      else if (holdFrames && i === holdFrames) input = makeInput({ jumpReleased: true });
      else if (doubleAtApex && rising && !doubled && p.vVel <= 2.5) { input = makeInput({ jumpPressed: true, jumpHeld: true }); doubled = true; releaseAt = i + 3; }
      else if (i === releaseAt) input = makeInput({ jumpReleased: true });
      else if (doubled && i < releaseAt) input = makeInput({ jumpHeld: true });
      else input = makeInput({ jumpHeld: held && !doubled });
      step(input);
      if (p.vVel > 0) rising = true;
      if (rising) apex = Math.max(apex, p.pos.y);
      if (rising && p.grounded && i > holdFrames + 2) break;
    }
    return { apexAboveSurface: Number.isFinite(apex) ? +(apex - lid).toFixed(3) : null, doubled };
  };
  const floorAt = name => () => {
    const c = near(name)[0];
    return { lid: 0, pos: new THREE.Vector3(c.mesh.position.x + 4, 0.02, c.mesh.position.z) };
  };
  const lidOf = name => () => {
    const c = near(name)[0], lid = c.box.max.y;
    return { lid, pos: new THREE.Vector3(c.mesh.position.x, lid + 0.6, c.mesh.position.z) };
  };
  for (const [label, setup, opts] of [
    ['floor-full-jump', floorAt('launch-wood'), { holdFrames: 26 }],
    ['floor-full-plus-double', floorAt('launch-wood'), { holdFrames: 26, doubleAtApex: true }],
    ['wood-stomp-plus-double', lidOf('launch-wood'), { doubleAtApex: true }],
    ['arrow-plus-double', lidOf('launch-arrow'), { doubleAtApex: true }],
    ['held-arrow-plus-double', lidOf('launch-arrow'), { doubleAtApex: true, held: true }],
  ]) results.push({ scenario: 'reach', lane: label, speed: 0, ...reach(setup, opts) });

  // 4d. Enemy bounces: drop onto a live enemy from 0.6 m above its box top and
  // record the bounce apex; then land on the turtle's shell (plain, Jump held,
  // with a double jump at the apex). The shell drops place the rider directly,
  // because respawn() resets the level and would remove the shell.
  const enemyIn = name => level.enemies.find(e => Math.abs(e.group.position.x - LANES[name]) < 4);
  const dropOnto = (top, x, z, { held = false, doubleAtApex = false, viaRespawn = false } = {}) => {
    const pos = new THREE.Vector3(x, top + 0.6, z);
    if (viaRespawn) p.respawn(level, true, true, { position: pos, heading: fwd });
    p.pos.copy(pos); p.prevPos.copy(pos); p.freeSkate = false; p.airFromSkate = false;
    p.state = 'air'; p.grounded = false; p.speed = 0; p.vVel = -3;
    let apex = -Infinity, rising = false, doubled = false, releaseAt = -1;
    for (let i = 0; i < 240 && p.state !== 'dead'; i++) {
      let input;
      if (doubleAtApex && rising && !doubled && p.vVel <= 2.5) { input = makeInput({ jumpPressed: true, jumpHeld: true }); doubled = true; releaseAt = i + 3; }
      else if (i === releaseAt) input = makeInput({ jumpReleased: true });
      else if (doubled && i < releaseAt) input = makeInput({ jumpHeld: true });
      else input = makeInput({ jumpHeld: held && !doubled });
      step(input);
      if (p.vVel > 0) rising = true;
      if (rising) apex = Math.max(apex, p.pos.y);
      if (rising && p.grounded) break;
    }
    return { apex, doubled, died: p.state === 'dead' };
  };
  for (const [name, foe] of [['enemy-turtle', 'turtle'], ['enemy-grunt', 'grunt']]) {
    reset();
    const e = enemyIn(name);
    const top = e.box.max.y, x = e.group.position.x, z = e.group.position.z;
    const r = dropOnto(top, x, z, { viaRespawn: true });
    results.push({ scenario: 'enemy-bounce', lane: `${foe}-stomp`, speed: 0, topY: +top.toFixed(3),
      apexAboveTop: Number.isFinite(r.apex) ? +(r.apex - top).toFixed(3) : null, apexAboveFloor: Number.isFinite(r.apex) ? +r.apex.toFixed(3) : null,
      defeated: !e.alive, leftShell: !!e.shell, leftCarcass: !!e.crabCarcass, died: r.died });
    if (foe !== 'turtle' || !e.shell) continue;
    for (const opts of [{}, { held: true }, { doubleAtApex: true }, { held: true, doubleAtApex: true }]) {
      for (let i = 0; i < 30; i++) step(makeInput()); // settle on the floor before the next drop
      const belly = e.shell.box.max.y;
      const s = dropOnto(belly, x, z, opts);
      results.push({ scenario: 'enemy-bounce', lane: `turtle-shell${opts.held ? '-held' : ''}${opts.doubleAtApex ? '-plus-double' : ''}`, speed: 0,
        topY: +belly.toFixed(3), apexAboveTop: Number.isFinite(s.apex) ? +(s.apex - belly).toFixed(3) : null,
        apexAboveFloor: Number.isFinite(s.apex) ? +s.apex.toFixed(3) : null, doubled: s.doubled, died: s.died, shellStill: !!e.shell });
    }
  }

  // 4c. Horizontal range on flat ground with real inputs: take-off to touchdown
  // distance and apex for running jumps (tap / full / + double jump) and board
  // ollies (tap / full charge) at several entry speeds. Jumps fire on release.
  const flatX = LANES['launch-wood'] + 10;
  const range = ({ board = false, speed = 0, holdFrames = 1, doubleAtApex = false, runFrames = 45 }) => {
    reset();
    const start = new THREE.Vector3(flatX, 0.02, 5);
    p.respawn(level, true, true, { position: start, heading: fwd });
    p.pos.copy(start); p.prevPos.copy(start);
    p.axisF.copy(fwd); p.axisL.set(fwd.z, 0, -fwd.x);
    p.freeSkate = board; p.airFromSkate = false; p.state = 'ride'; p.grounded = true; p.vVel = 0; p.speed = speed;
    const move = { moveY: 1 };
    let takeoff = null, landing = null, apex = -Infinity, released = false, doubled = false, releaseAt = -1, vTake = null;
    for (let i = 0; i < 400 && p.state !== 'dead'; i++) {
      const t = i - runFrames; // run-up first, then the jump input
      let input;
      if (t < 0) input = makeInput(move);
      else if (t < holdFrames) input = makeInput({ ...move, jumpHeld: true, jumpPressed: t === 0 });
      else if (t === holdFrames) { input = makeInput({ ...move, jumpReleased: true }); released = true; }
      else if (doubleAtApex && takeoff && !doubled && p.vVel <= 2.5) { input = makeInput({ ...move, jumpPressed: true, jumpHeld: true }); doubled = true; releaseAt = i + 3; }
      else if (i === releaseAt) input = makeInput({ ...move, jumpReleased: true });
      else if (doubled && i < releaseAt) input = makeInput({ ...move, jumpHeld: true });
      else input = makeInput(move);
      const wasGrounded = p.grounded;
      step(input);
      if (released && !takeoff && wasGrounded && !p.grounded) { takeoff = p.pos.clone(); vTake = Math.abs(p.speed); }
      if (takeoff) apex = Math.max(apex, p.pos.y);
      if (takeoff && !landing && p.grounded && i > runFrames + holdFrames + 2) { landing = p.pos.clone(); break; }
    }
    const d = takeoff && landing ? Math.hypot(landing.x - takeoff.x, landing.z - takeoff.z) : null;
    return { distance: d === null ? null : +d.toFixed(2), apex: Number.isFinite(apex) ? +apex.toFixed(2) : null,
      takeoffSpeed: vTake === null ? null : +vTake.toFixed(2), doubled, movedToward: takeoff ? (takeoff.z < start.z ? '-Z' : '+Z') : null };
  };
  for (const [label, opts] of [
    ['run-tap-jump', { holdFrames: 1 }],
    ['run-full-jump', { holdFrames: 24 }],
    ['run-full-jump-plus-double', { holdFrames: 24, doubleAtApex: true }],
    ['board-tap-ollie-12', { board: true, speed: 12, holdFrames: 1 }],
    ['board-full-ollie-12', { board: true, speed: 12, holdFrames: 24 }],
    ['board-full-ollie-18', { board: true, speed: 18, holdFrames: 24 }],
    ['board-full-ollie-23', { board: true, speed: 23, holdFrames: 24 }],
  ]) results.push({ scenario: 'range', lane: label, speed: opts.speed ?? 0, ...range(opts) });

  // 5. On the board, come down onto a crate lid from a board air while rolling
  // forward: does it count as a stomp (break + crate bounce / arrow launch)?
  for (const name of ['board-stomp-wood', 'board-stomp-arrow']) for (const speed of [6, 12]) {
    reset();
    const crate = near(name)[0], lid = crate.box.max.y, deaths0 = p.totalDeaths;
    const pos = new THREE.Vector3(crate.mesh.position.x, lid + 0.7, crate.mesh.position.z + 0.15);
    place(pos, { speed, air: true }); p.vVel = -3;
    beginWatch(name);
    let apex = -Infinity, bounced = false;
    for (let i = 0; i < 150 && p.state !== 'dead'; i++) {
      run(makeInput());
      if (p.vVel > 0) bounced = true;
      if (bounced) apex = Math.max(apex, p.pos.y);
      if (bounced && p.grounded) break;
    }
    results.push({ scenario: 'board-land-on-lid', lane: name, speed, lidY: +lid.toFixed(3), bounced,
      apexAboveLid: Number.isFinite(apex) ? +(apex - lid).toFixed(3) : null, ...summary(name, deaths0) });
  }

  // 3. Grinding an authored rail into a crate that sits on its line.
  for (const [name, speeds] of [['rail-crate', [8, 12, 12.5, 13, 16]], ['rail-tnt', [8, 12, 16]]]) for (const speed of speeds) {
    reset();
    const x = LANES[name], deaths0 = p.totalDeaths;
    const rail = level.rails.find(r => Math.abs(r.points[0].x - x) < 1);
    const start = rail.closest(new THREE.Vector3(x, 1, -6)).point.clone().add(new THREE.Vector3(0, CONST.railRideHeight + 0.05, 0));
    place(start, { speed, air: true });
    beginWatch(name);
    run(makeInput({ grindHeld: true, grindPressed: true }));
    for (let i = 0; i < 180 && p.state !== 'dead'; i++) run(makeInput({ grindHeld: true }));
    results.push({ scenario: 'rail-into-crate', lane: name, speed, ...summary(name, deaths0) });
  }
}, { levelEntry });

for (const r of results) console.log(JSON.stringify(r));
if (out) await writeFile(out, JSON.stringify(results, null, 2) + '\n');
