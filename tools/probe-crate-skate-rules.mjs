// Measures how the real Player/Level treat crates on the skateboard, so the
// crate design bible (docs/CRATE_DESIGN_BIBLE.md) states engine facts, not
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
