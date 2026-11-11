// Powderkeg Peak · one input-only journey from the lodge yard to the powder works gate.
// Ordinary device samples only: the walker climbs Kindling Steps, the rider takes First Tracks to the tarn,
// rides the hoist, walks both ledge rows of the Headwall and rides Powderkeg Run through the gate.
// Beats are keyed by name so a run can start at any checkpoint (POWDERKEG_START=crest|tarn|hoist|east|upper|summit).
// POWDERKEG_SKIP_ADIT=1 leaves the optional gem route out (the line a time trial takes).
export const POWDERKEG_STARTS = {
  crest: { position: [0, 10.62, -197], heading: [0, 0, -1], beat: 'first tracks' },
  tarn: { position: [0, -7.88, -560], heading: [0, 0, -1], beat: 'tarn and hoist' },
  hoist: { position: [4, 6.12, -606], heading: [1, 0, 0], beat: 'lower row' },
  east: { position: [86.5, 19.14, -608.4], heading: [0, 0, -1], beat: 'old adit' },
  upper: { position: [86, 19.14, -610], heading: [0, 0, -1], beat: 'upper row' },
  summit: { position: [-24, 28.12, -614], heading: [-1, 0, 0], beat: 'powderkeg run' },
};

export async function runPowderkegJourney(r, { from = null, log = console.log, collect = false } = {}) {
  const { p, l } = r, m = r.sourceModule, { RUN1, RUN2 } = m.POWDERKEG_PATHS, PLAN = m.POWDERKEG_PLAN;
  const dt = r.CONST.fixedStep;
  if (process.env.POWDERKEG_DEBUG) for (const name of ['bail', 'die']) { const inner = p[name].bind(p); p[name] = (...args) => { log(`${name}(${args.slice(0, 3).map(a => typeof a === 'object' ? '…' : a).join(', ')}) grab ${p.grabPhase} spinAngle ${p.grabSpinAngle} fromSkate ${p.airFromSkate} freeSkate ${p.freeSkate} spinT ${p.spinTimer} flipT ${p.flipT} pipeEnd ${p.pipeEndFly} rollOff ${p.rollOffT} align ${p.landingAlignPose} state ${p.state} ${new Error().stack.split('\n').slice(2, 6).map(line => line.trim().replace(/\(.*\/src\//, '(')).join(' < ')}`); return inner(...args); }; }
  const dead = () => p.isBailing || ['dead', 'gameover'].includes(p.state);
  const pose = () => ({ x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), state: p.state, grounded: p.grounded, board: p.freeSkate, speed: +p.speed.toFixed(2), vVel: +p.vVel.toFixed(2), deaths: p.totalDeaths, t: +(r.frame * dt).toFixed(1), ground: p.groundHit?.name ?? null });
  const near = () => [...l.enemies.filter(e => e.box.distanceToPoint(p.pos) < 6).map(e => `${e.kind}${e.alive ? '' : '(dead)'}@${[e.box.min.x, e.box.max.x].map(v => v.toFixed(2)).join('..')}`), ...l.crushers.filter(c => Math.abs(c.x - p.pos.x) < 5 && Math.abs(c.z - p.pos.z) < 3).map(c => `stamper@${c.x}`)].join(' ');
  const fail = message => { throw new Error(`${message} at ${JSON.stringify(pose())} bailing ${p.isBailing} spinning ${p.spinning} near [${near()}]`); };
  // Spin policy: bank checkpoints, break plain boxes and spin killable foes that come close; never spin beside TNT or Nitro.
  let lastSpin = false;
  const autoSpin = sample => {
    if (!p.grounded || p.state === 'grind' || 'spinHeld' in sample) return sample;
    const cp = l.checkpoints.some(c => !c.active && c.box.distanceToPoint(p.pos) < 3.2);
    const foe = l.enemies.some(e => e.alive && e.spinKill && e.box.distanceToPoint(p.pos) < 3);
    const plain = l.crates.some(c => c.alive && !c.pending && !c.metal && !c.metalBounce && !c.bang && !c.nitroBang && !c.bouncy && !c.tnt && !c.nitro && c.box.distanceToPoint(p.pos) < 2.6);
    const explosive = l.crates.some(c => c.alive && !c.pending && (c.tnt || c.nitro) && c.box.distanceToPoint(p.pos) < 3.6);
    if (cp || ((plain || foe) && !explosive)) { const held = p.spinning || !lastSpin; lastSpin = held; return { ...sample, spinHeld: held }; }
    lastSpin = false; return sample;
  };
  const debug = process.env.POWDERKEG_DEBUG === 'all' ? 'all' : process.env.POWDERKEG_DEBUG === '1';
  const step = (sample, label) => {
    const out = autoSpin(sample);
    if (out.grabHeld && !p.grounded) out.grabHeld = false;
    r.tick(out);
    if (debug === 'all') log(`dbg ${label} ${JSON.stringify(pose())}`);
    if (dead()) fail(`${label}: lost control`);
  };
  // A stick held along one axis reads exactly zero on the other (the input layer's dead zone); the engine treats any
  // two non-zero axes in the air as a diagonal and scales the jump, so the pilot applies the same dead zone.
  const toward = (x, z, pace = 1) => {
    const q = r.worldDirectionInput({ x: x - p.pos.x, z: z - p.pos.z }, pace);
    if (Math.abs(q.moveX) < .1 * pace) q.moveX = 0; if (Math.abs(q.moveY) < .1 * pace) q.moveY = 0;
    return q;
  };
  const dist = (x, z) => Math.hypot(x - p.pos.x, z - p.pos.z);
  const run = (label, pred, sampler, max) => { let done = pred(); for (let i = 0; i < max && !done; i++) { step(sampler(i), label); done = pred(); } if (!done) fail(`${label} timed out`); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- foot ----
  /** Walk to a point and stop there. `keep` leaves the walker moving. */
  const walk = (x, z, { tol = .3, label = 'walk', pace = 1, keep = false, max = 1500, noSpin = false } = {}) => {
    const hold = noSpin ? { spinHeld: false } : {};
    run(label, () => dist(x, z) < tol, () => { const d = dist(x, z); return { ...toward(x, z, keep ? pace : clamp((d - .15) / 1.4, .14, pace)), ...hold }; }, max);
    if (!keep) run(`${label} stop`, () => p.grounded && p.walkVelocity.length() < .3, () => ({ ...hold }), 240);
  };
  /** Standing charged jump toward a landing point. */
  const jump = (x, z, y, { double = false, label = 'jump', charge = 24, tol = 1.9, spin = false, noSpin = false } = {}) => {
    for (let i = 0; i < charge; i++) step({ jumpHeld: true, ...(noSpin ? { spinHeld: false } : {}) }, `${label} charge`);
    step({ ...toward(x, z, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.grounded) fail(`${label} did not launch`);
    fly(x, z, y, { double, label, tol, spin });
  };
  /** `spin` holds Spin on the way down: the counter for a landing with a foe on it. */
  const fly = (x, z, y, { double = false, label = 'air', tol = 1.9, spin = false } = {}) => {
    let doubled = false, spun = false;
    run(`${label} air`, () => p.grounded, () => {
      // A spin lasts 0.3 s: begin it on the way down, a metre and a half above the landing, so it is live at touchdown.
      const d = dist(x, z), spinning = spin && p.vVel < 0 && (y === undefined || p.pos.y - y < 1.5), press = spinning && (p.spinning || !spun); spun = press;
      const sample = { ...toward(x, z, clamp(d / 1.2, 0, 1)), ...(spinning ? { spinHeld: press } : {}) };
      if (double && !doubled && p.vVel < 1.5) { doubled = true; return { ...sample, jumpHeld: true, jumpPressed: true }; }
      if (double && doubled && p.vVel > 0) return { ...sample, jumpHeld: true };
      return sample;
    }, 360);
    if (dist(x, z) > tol) fail(`${label} missed the landing (${dist(x, z).toFixed(2)} m off)`);
    if (y !== undefined && Math.abs(p.pos.y - y) > .6) fail(`${label} landed at the wrong height`);
  };
  /** Running jump: run at the landing point, hold Jump through the last metres before `edge` and release at the lip. */
  const leap = (edge, land, { double = false, label = 'leap', hold = 3.4, tol = 1.9, tap = false, spin = false } = {}) => {
    const [ex, ez] = edge, [lx, lz, ly] = land, along = () => { const dx = lx - ex, dz = lz - ez, n = Math.hypot(dx, dz) || 1; return ((ex - p.pos.x) * dx + (ez - p.pos.z) * dz) / n; };
    run(`${label} run-up`, () => along() < (tap ? .55 : hold), () => toward(lx, lz, 1), 600);
    if (!tap) run(`${label} charge`, () => along() < .32 || !p.grounded, () => ({ ...toward(lx, lz, 1), jumpHeld: true }), 120);
    else step({ ...toward(lx, lz, 1), jumpHeld: true, jumpPressed: true }, `${label} tap`);
    step({ ...toward(lx, lz, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.grounded) step({ ...toward(lx, lz, 1) }, `${label} lift`);
    fly(lx, lz, ly, { double, label, tol, spin });
  };
  const still = (frames, label = 'wait') => { for (let i = 0; i < frames; i++) step({}, label); };
  /** Jump onto an arrow crate, double jump as the bounce slows, then make for a landing `y` up: grab its lip and climb, or land on it. */
  const arrowLaunch = ([ax, az], [lx, lz], y, label, off = [0, -.3]) => {
    const away = Math.hypot(lx - ax, lz - az) || 1, cx = lx + (lx - ax) / away * 3, cz = lz + (lz - az) / away * 3;
    run(`${label} approach`, () => dist(ax, az) < 2.5, () => toward(ax, az, 1), 600);
    for (let i = 0; i < 12; i++) step({ ...toward(ax, az, 1), jumpHeld: true }, `${label} hop`);
    step({ ...toward(ax, az, 1), jumpHeld: false, jumpReleased: true }, `${label} hop`);
    let bounced = false, doubled = false;
    for (let i = 0; i < 700 && !(bounced && p.grounded && Math.abs(p.pos.y - y) < .4); i++) {
      const before = p.vVel; let sample;
      if (p.state === 'hang') sample = { ...toward(cx, cz, 1), jumpHeld: i % 20 < 10, jumpPressed: i % 20 === 0 };
      else {
        const overArrow = toward(ax + off[0], az + off[1], clamp(dist(ax + off[0], az + off[1]) / 1.2, 0, 1));
        const aim = !bounced ? overArrow : doubled && p.pos.y > y - 2.6 ? toward(lx, lz, 1) : overArrow;
        if (bounced && !doubled && p.vVel > 0 && p.vVel < 4) { doubled = true; sample = { ...aim, jumpHeld: true, jumpPressed: true }; }
        else sample = doubled && p.vVel > 0 ? { ...aim, jumpHeld: true } : aim;
      }
      step(sample, label);
      if (before < 0 && p.vVel > 8) { bounced = true; doubled = false; } // every bounce re-arms the double jump
    }
    if (!(p.grounded && Math.abs(p.pos.y - y) < .4)) fail(`${label} did not reach the landing`);
  };

  // ---- board ----
  /** Where a boulder will be along its own axis `t` seconds from now (constant speed, turning at both ends). */
  const stoneIn = (st, t) => {
    const lo = st.axis === 'x' ? st.x1 : st.z1, hi = st.axis === 'x' ? st.x0 : st.z0;
    let v = st.axis === 'x' ? st.mesh.position.x : st.mesh.position.z, dir = st.dir, left = t * st.speed;
    while (left > 0 && hi > lo) { const room = dir > 0 ? hi - v : v - lo; if (left <= room) { v += dir * left; left = 0; } else { v = dir > 0 ? hi : lo; left -= room; dir = -dir; } }
    return v;
  };
  /** A rider reads the next boulder trough ahead and takes the lane its boulders will be furthest from on arrival. */
  const boulderLane = (path, s, lat) => {
    const ahead = l.stones.map(st => ({ st, q: path.nearest(st.mesh.position.x, st.mesh.position.z, 16) })).filter(o => o.q && o.q.s - s > -2.5 && o.q.s - s < 30);
    if (!ahead.length) return null;
    const station = Math.min(...ahead.map(o => o.q.s)), group = ahead.filter(o => o.q.s - station < 3), f = path.at(station);
    const arrive = Math.max(0, station - s) / Math.max(8, Math.abs(p.speed));
    const stoneLats = group.map(({ st }) => { const v = stoneIn(st, arrive), sx = st.axis === 'x' ? v : st.mesh.position.x, sz = st.axis === 'x' ? st.mesh.position.z : v; return (sx - f.x) * f.rx + (sz - f.z) * f.rz; });
    const lanes = [-4.8, -2.4, 0, 2.4, 4.8].map(c => ({ c, clear: Math.min(...stoneLats.map(v => Math.abs(c - v))) - Math.abs(c - lat) * .1 }));
    return lanes.sort((a, b) => b.clear - a.clear)[0].c;
  };
  const mount = (x, z, label = 'mount') => run(label, () => p.freeSkate, () => ({ ...toward(x, z, 1), jumpHeld: true }), 300);
  /**
   * Ride a path to station `to`: steer at the lane a few metres ahead, hold X to push when `push`, brake above `cap`,
   * ollie at `pops`, and for each of `grinds` ({ pop, end }) ollie at `pop` holding Grind to catch the rail in that lane
   * and ride it to `end`, spinning any watcher that swoops while on it.
   */
  const ride = (path, to, { lane = () => 0, cap = 60, push = false, pops = [], grinds = [], label = 'ride', look = 9 } = {}) => {
    const popped = new Set(); let braking = false;
    const here = () => path.nearest(p.pos.x, p.pos.z, 40) ?? fail(`${label}: left the piste`);
    run(label, () => here().s >= to, () => {
      const q = here(), s = q.s, rail = grinds.find(g => s >= g.pop - 14 && s < g.end);
      const dodge = rail ? null : boulderLane(path, s, q.lat);
      const target = path.w(Math.min(path.length + 20, s + look), dodge ?? (typeof lane === 'function' ? lane(s) : lane));
      if (p.state === 'grind') {
        const c = clamp(-p.balance * 5 - p.balanceVel * .7, -1, 1), watcher = l.enemies.some(e => e.alive && e.kind === 'floater' && e.box.distanceToPoint(p.pos) < 4.5);
        return { moveY: 1, moveX: c, grindHeld: true, ...(watcher ? { spinHeld: true } : {}) };
      }
      const steer = p.grounded || !p.airFromSkate ? toward(target[0], target[2], 1) : {};
      if (rail) {
        if (s < rail.pop - .4) return { ...steer, jumpHeld: true };
        if (!popped.has(rail) && p.grounded) { popped.add(rail); return { ...steer, jumpHeld: false, grindHeld: true }; }
        return { ...steer, jumpHeld: false, grindHeld: true };
      }
      const pop = pops.find(q2 => !popped.has(q2) && s >= q2 - .4 && s < q2 + 4 && p.grounded);
      if (pop !== undefined) popped.add(pop);
      if (p.speed > cap) braking = true; else if (p.speed < cap - 3) braking = false;
      const charging = pops.some(q2 => !popped.has(q2) && s >= q2 - 26 && s < q2);
      return { ...steer, jumpHeld: pop === undefined && (push || charging) && !braking, grabHeld: pop === undefined && braking && p.grounded };
    }, Math.round((to - here().s + 80) * 60 / 5) + 1200);
  };
  /** A lane as a list of [station, lateral] knots, linear between them. */
  const laneOf = knots => s => { if (s <= knots[0][0]) return knots[0][1]; for (let i = 1; i < knots.length; i++) if (s <= knots[i][0]) { const [a, la] = knots[i - 1], [b, lb] = knots[i]; return la + (lb - la) * (s - a) / (b - a); } return knots[knots.length - 1][1]; };
  const dismount = (label = 'dismount') => {
    run(`${label} brake`, () => Math.abs(p.speed) < .3 && p.grounded, () => ({ grabHeld: p.grounded }), 600);
    run(`${label} settle`, () => !p.freeSkate && p.grounded, () => ({}), 120);
  };

  const { ROW_A, ROW_B, TARN_Y, B0_Y } = PLAN, Z = s => -s, A = PLAN.ROW_A_LEDGES, B = PLAN.ROW_B_LEDGES;
  // ---- hazards ----
  /** A stamper hangs for the first 38 % of its cycle, slams, rests as a wall and rises for the last 30 %. */
  const stamperAt = (x, z) => l.crushers.find(c => Math.abs(c.x - x) < 1 && Math.abs(c.z - z) < 2) ?? fail(`no stamper at ${x}`);
  const stampPhase = c => (((l.time + c.phase) % c.cycle) + c.cycle) % c.cycle / c.cycle;
  /** Wait until the stamper has at least `need` seconds of hang left (or is well into its rise with a full hang to follow). */
  const waitStamper = (x, z, need, label) => { const c = stamperAt(x, z); run(label, () => { const f = stampPhase(c); return f > .9 || f * c.cycle < .38 * c.cycle - need; }, () => ({}), 600); };
  /** Go-signal for a stamper you must pass without stopping: it is past the middle of its rise, with the whole hang still to come. */
  const waitRise = (x, z, label) => { const c = stamperAt(x, z); run(label, () => { const f = stampPhase(c); return f > .85 && f < .93; }, () => ({}), 600); };
  const stoneAt = (x, z) => l.stones.find(q => Math.hypot(q.mesh.position.x - x, q.mesh.position.z - z) < 12 && Math.abs(q.mesh.position.z - z) < 1.5) ?? fail('no boulder');
  const spinOnce = label => { for (let i = 0; i < 16; i++) step({ spinHeld: i < 8 }, label); };
  const beats = [
    { name: 'kindling steps', run() {
      if (collect) { walk(-2.7, Z(8.2), { tol: .3 }); for (let k = 0; k < 3; k++) { spinOnce('yard stack'); still(12, 'settle'); } }
      walk(0, Z(13), { keep: true }); walk(0, Z(22), { keep: true });
      if (collect) { walk(2.6, Z(33.4), { tol: .35 }); spinOnce('pair past the crab'); walk(0, Z(33), { tol: .4 }); }
      walk(0, Z(35.4));
      jump(0, Z(39.2), 2.5, { label: 'onto the mill pond' });
      walk(0, Z(52), { keep: true }); walk(-2.6, Z(58.5));
      // Boulder trough: go as the boulder passes the walker's side heading away.
      const stone = stoneAt(0, Z(62.5));
      run('wait for the boulder to roll away', () => stone.mesh.position.x > .4 && stone.dir > 0, () => ({}), 900);
      walk(-2.6, Z(66), { keep: true });
      if (collect) {
        // The box over the open half of the crevasse hangs above a spin from the bank: jump the gap through it.
        walk(-3, Z(66.4)); leap([-3, Z(71)], [-3, Z(75.4), 2.5], { label: 'the open half, through the box over it' });
        // Arrow: bounce to break the pair overhead, then the row, the arrow last.
        walk(-3.4, Z(76.9), { tol: .3 });
        for (let i = 0; i < 12; i++) step({ ...toward(-3.4, Z(79), 1), jumpHeld: true }, 'hop onto the arrow'); step({ ...toward(-3.4, Z(79), 1), jumpHeld: false, jumpReleased: true }, 'hop onto the arrow');
        // Jump held as the feet meet the arrow makes the bounce a high one; a fresh press at its top adds the double jump.
        { let fresh = false; run('bounce on the arrow until the pair overhead is gone', () => !l.crates.some(c => c.alive && Math.abs(c.mesh.position.x + 3.4) < .4 && Math.abs(c.mesh.position.z - Z(79)) < .4 && c.mesh.position.y > 6), () => {
          const aim = toward(-3.4, Z(79), clamp(dist(-3.4, Z(79)) / 1, 0, .7));
          if (p.vVel > 6) { fresh = true; return aim; }                                                  // rising off the arrow: release
          if (fresh && p.vVel > 0 && p.vVel < 4) { fresh = false; return { ...aim, jumpHeld: true, jumpPressed: true }; }   // the double jump at the top
          return { ...aim, jumpHeld: true };                                                             // held through the fall and the next impact
        }, 1500); }
        run('down off the arrow', () => p.grounded && p.pos.y < 2.7, () => toward(-3.4, Z(76.6), 1), 600);
        walk(-3.4, Z(77.2), { tol: .3 }); for (let k = 0; k < 3; k++) { spinOnce('arrow row'); still(10, 'settle'); }
        walk(0, Z(80), { tol: .5 });
      } else { walk(3, Z(70), { keep: true }); walk(3, Z(75.5), { keep: true }); walk(0, Z(80), { keep: true }); }
      leap([0, Z(85)], [0, Z(90.4), 2.5], { label: 'first crevasse' });
      if (collect) { walk(2.7, Z(94.6), { tol: .35 }); for (let k = 0; k < 4; k++) { spinOnce('first landing stack'); still(12, 'settle'); } walk(0, Z(96), { tol: .5 }); }
      walk(0, Z(98), { keep: true }); walk(0, Z(107), { keep: true });
      leap([0, Z(116)], [0, Z(121.2), 5], { label: 'second crevasse off the ice shelf' });
      walk(-3.4, Z(123.4)); still(20, 'bank the powder landing checkpoint');
      walk(-1, Z(130), { keep: true }); walk(0, Z(139), { keep: true });
      if (collect) { walk(-3.1, Z(148.3), { tol: .35 }); for (let k = 0; k < 3; k++) { spinOnce('mask stack'); still(12, 'settle'); } walk(0, Z(146.2), { tol: .4 }); }
      walk(0, Z(146.5), { keep: true });
      leap([0, Z(151)], [0, Z(155.4), 7.5], { label: 'first pillar' });
      leap([0, Z(157.3)], [0, Z(161.6), 8], { label: 'second pillar', tap: true });
      leap([0, Z(163.8)], [0, Z(168.4), 8.5], { label: 'third pillar', tap: true, spin: true });
      walk(0, Z(169.6));
      jump(0, Z(173.4), 9.4, { label: 'onto the lookout shelf' });
      if (collect) { walk(-1.8, Z(177.6), { tol: .35 }); for (let k = 0; k < 4; k++) { spinOnce('lookout block'); still(12, 'settle'); } }
      walk(0, Z(183), { keep: true }); walk(0, Z(190), { keep: true });
      if (collect) { walk(2.3, Z(191.3), { tol: .35 }); for (let k = 0; k < 3; k++) { spinOnce('count trap'); still(12, 'settle'); } }
      walk(0, Z(193), { tol: .5 }); walk(0, Z(196.2));
      still(20, 'bank the crest checkpoint');
    } },
    { name: 'first tracks', run() {
      mount(0, -212);
      // The collector's line pushes all the way (a board trips on a box below 12.5 m/s), takes each stack in its lane and the log rail over the half crevasse.
      if (collect) ride(RUN1, RUN1.length - 34, { label: 'first tracks, every box', push: true, grinds: [{ pop: 394.6, end: 421 }],
        lane: laneOf([[52, 0], [84, 3], [100, 3], [114, -2.6], [128, -2.6], [142, 2.6], [158, 2.6], [176, 0], [192, -2.8], [208, -2.8], [224, 0], [306, 0], [314, -1.2], [338, -1.2], [352, 0], [372, 0], [384, -3.7], [423, -3.7], [428, -2.6], [437, -2.6], [452, 2.6], [466, 2.6], [484, -2.8], [500, -2.8], [514, 2.8], [524, 2.8], [532, 0]]) });
      // The plain line banks the mid-run checkpoint and rides on down the sound half beside the crevasse.
      else ride(RUN1, RUN1.length - 34, { label: 'first tracks', lane: laneOf([[306, 0], [314, -1.2], [338, -1.2], [352, 0], [380, 0], [394, 3], [414, 3], [430, 0]]) });
      ride(RUN1, RUN1.length - 8, { cap: 9, label: 'slow for the shore' });
      dismount('tarn shore');
    } },
    { name: 'tarn and hoist', run() {
      walk(0, -560); still(20, 'bank the tarn checkpoint');
      walk(-3, -598, { keep: true }); walk(-3, -602.4, { tol: .25 });
      const hoist = l.movers.find(q => Math.abs(q.mesh.position.x + 3) < 1 && Math.abs(q.mesh.position.z - (ROW_A + 1)) < 1) ?? fail('no hoist');
      // Step aboard only as the deck settles at the bottom of its travel.
      { let last = hoist.mesh.position.y; run('wait for the hoist', () => { const y = hoist.mesh.position.y, down = y <= last; last = y; return down && y < TARN_Y + .22; }, () => ({}), 1200); }
      walk(-3, ROW_A + 1, { tol: .5 });
      run('ride the hoist', () => p.pos.y > PLAN.A0_Y - .25, () => ({}), 900);
      walk(3.5, ROW_A, { tol: .6 }); still(20, 'bank the hoist landing checkpoint');
    } },
    { name: 'lower row', run() {
      const z = ROW_A;
      walk(13.6, z); waitStamper(17, z, .9, 'first stamper'); walk(22, z, { keep: true });
      leap([A[0].x1, z], [30.4, z, A[1].y], { label: 'onto the bristleback ledge' });
      walk(34.5, z, { keep: true });
      leap([A[1].x1, z], [42.7, z, A[2].y], { label: 'lone pillar' });
      leap([A[2].x1, z], [49.2, z, A[3].y], { label: 'stamper gallery', tap: true });
      walk(49.6, z); waitStamper(53, z, 1.05, 'stamper pair'); walk(63, z, { keep: true }); walk(67.5, z + 1, { keep: true }); walk(72, z + 1, { keep: true }); walk(76.4, z + 1);
      waitStamper(84.5, z, 1.2, 'far-bank stamper');
      leap([A[5].x1, z + 1], [83, z, A[6].y], { label: 'far bank', hold: 2.4 });
      walk(88.6, z);
      jump(93.5, z, A[7].y, { label: 'buttress tier one' }); walk(94.6, z, { tol: .4 });
      jump(99, z, A[8].y, { label: 'buttress tier two' }); walk(98, z, { tol: .4 });
      jump(93.5, z, A[9].y, { label: 'buttress tier three' }); walk(92.4, z, { tol: .4 });
      jump(88.4, z, B0_Y, { label: 'east landing' });
      walk(87.4, ROW_A + .2, { tol: .4 }); still(20, 'bank the east landing checkpoint');
    } },
    { name: 'old adit', run() {
      if (process.env.POWDERKEG_SKIP_ADIT === '1') return;
      // The gem route: steel arrow in the corner, double jump, onto the door sill and in; out again by the ring past the gem.
      const [dx, dy, dz] = PLAN.DOOR, [ax, , az] = PLAN.ARROW, X = PLAN.CAVE_X, z = PLAN.CAVE_Z, A = PLAN.ADIT;
      walk(86.4, az + 3);
      arrowLaunch([ax, az], [dx + 1.5, az], dy, 'arrow to the adit door', [.3, 0]);
      run('into the adit', () => p.pos.x > X - 5, () => toward(dx, dz - 1.4, 1), 300);
      still(12, 'arrive');
      walk(X + 6.4, z - .5, { tol: .35 }); spinOnce('adit landing pair');
      walk(X + 6, z + .8, { keep: true });
      // The glazed drift: along the lip, clear of the Nitro by the wall, and off the end of the ice.
      leap([X + A[0].x1, z + .8], [X + 15.2, z + .8, A[1].y], { label: 'onto the glazed drift' });
      leap([X + A[1].x1, z + .8], [X + 27.6, z + .4, A[2].y], { label: 'off the ice onto the first rotten shelf', hold: 3 });
      leap([X + A[2].x1, z], [X + 32.4, z, A[3].y], { label: 'second rotten shelf', tap: true });
      leap([X + A[3].x1, z], [X + 37, z, A[4].y], { label: 'quick stamper gallery', tap: true });
      // Quick stampers: go as each nears the top of its rise; the pocket between them holds one box.
      walk(X + 38.7, z); waitRise(X + 41.3, z, 'quick stamper, first'); walk(X + 43.6, z, { tol: .3 }); spinOnce('pocket crate'); walk(X + 44.9, z, { tol: .3 });
      waitRise(X + 47.3, z, 'quick stamper, second'); walk(X + 50.4, z, { keep: true });
      leap([X + A[4].x1, z], [X + 59.7, z, A[5].y], { label: 'the wide gap onto the bristleback pillar', spin: true, hold: 3.4 });
      // Step into its beat spinning (the pilot spins any killable foe within three metres).
      run('clear the bristleback', () => !l.enemies.some(e => e.alive && e.box.distanceToPoint(p.pos) < 5), () => toward(X + 62, z, .45), 300);
      leap([X + A[5].x1, z], [X + 67.8, z, A[6].y], { label: 'arrow floor', tap: true });
      walk(X + 68.2, z - .5, { tol: .35 }); spinOnce('arrow floor pair');
      walk(X + 70.4, z);
      arrowLaunch([X + 73.2, z], [X + 76.8, z], PLAN.GEM_Y, 'arrow to the gem shelf', [-.3, 0]);
      walk(X + 78.6, z, { keep: true }); walk(X + 80.8, z - .5, { tol: .4 });
      for (let k = 0; k < 4; k++) { spinOnce('gem shelf tower'); still(14, 'let the tower settle'); }
      run('out by the ring', () => p.pos.x < 200, () => toward(X + 86.6, z, 1), 400);
      still(12, 'back on the east landing');
    } },
    { name: 'upper row', run() {
      const z = ROW_B;
      walk(84, z); walk(86.4, z);
      { const c = stamperAt(75.5, z); run('stamper over the ice: go as it nears the top of its rise', () => { const f = stampPhase(c); return f > .84 && f < .92; }, () => ({}), 600); }
      walk(69, z, { keep: true });
      leap([B[0].x0, z], [62.5, z, B[1].y], { label: 'bristleback pillar', spin: true });
      run('clear the bristleback', () => !l.enemies.some(e => e.alive && e.box.distanceToPoint(p.pos) < 5), () => toward(60.6, z, .45), 300);
      leap([B[1].x0, z], [54.8, z, B[2].y], { label: 'rotten shelf one', tap: true });
      leap([B[2].x0, z], [50.3, z, B[3].y], { label: 'rotten shelf two', tap: true });
      leap([B[3].x0, z], [45.8, z, B[4].y], { label: 'rotten shelf three', tap: true });
      leap([B[4].x0, z], [41.4, z + .6, B[5].y], { label: 'switch ledge', tap: true });
      walk(39, z + 1); walk(33.4, z + 1); walk(32.3, z - .2, { tol: .25 }); spinOnce('hit the switch');
      const bridge = () => l.crates.filter(c => c.alive && !c.pending && Math.abs(c.mesh.position.z - z) < .5 && c.mesh.position.x > 25 && c.mesh.position.x < 31.2);
      if (bridge().length < 5) fail('the switch did not build the bridge');
      // Walk the lids: a jump onto a wooden lid is a stomp and would break the footing.
      walk(31.4, z, { keep: true }); walk(26.5, z, { tol: .3, noSpin: true });
      if (debug) log(`bridge end: masks ${p.masks} uber ${p.uberTimer.toFixed(1)} crates ${bridge().map(c => c.mesh.position.x.toFixed(1)).join(',')} at ${p.pos.x.toFixed(2)},${p.pos.y.toFixed(2)}`);
      jump(24.3, z, B[6].y, { label: 'off the bridge', charge: 12, tol: 1.8, noSpin: true });
      walk(23.7, z - .45, { tol: .3 }); for (let k = 0; k < 2; k++) { spinOnce('mask stack past the bridge'); still(12, 'settle'); } walk(22.2, z, { tol: .3 });
      waitStamper(19.5, z, .8, 'twin stampers, first'); walk(16.6, z);
      waitStamper(13.5, z, .8, 'twin stampers, second'); walk(11, z, { keep: true });
      leap([B[6].x0, z], [4.8, z, B[7].y], { label: 'last pillar', hold: 1 });
      leap([B[7].x0, z], [-1.8, z, B[8].y], { label: 'summit approach', tap: true });
      walk(-5.5, z, { keep: true }); walk(-15, z, { keep: true }); walk(-23.4, z); still(20, 'bank the summit checkpoint');
    } },
    { name: 'powderkeg run', run() {
      mount(-36, -614);
      if (collect) ride(RUN2, RUN2.length - 40, { label: 'powderkeg run, every box', push: true, pops: [243, 595], grinds: [{ pop: 50.6, end: 85 }, { pop: 450.6, end: 462 }],
        lane: laneOf([[30, 0], [44, 0], [50, 3.2], [114, 3.2], [132, -2.4], [146, -2.4], [162, 0], [426, 0], [438, -3.6], [464, -3.6], [476, 0], [568, 0]]) });
      else ride(RUN2, RUN2.length - 40, { label: 'powderkeg run', pops: [243, 451, 595] });
      ride(RUN2, RUN2.length - 4, { cap: 9, label: 'slow for the works yard' });
      dismount('works yard');
      const [fx, , fz] = PLAN.FINISH;
      if (collect) { walk(fx - 3, fz + 7.6, { tol: .35 }); for (let k = 0; k < 3; k++) { spinOnce('works yard stack'); still(12, 'settle'); } }
      walk(fx + 4.4, fz + 8.4, { tol: .35 }); spinOnce('hit the green switch');
      walk(fx, fz + 14, { keep: true });
      run('through the gate', () => p.state === 'finished', () => toward(fx, fz + 30, 1), 900);
    } },
  ];
  let started = from === null;
  for (const beat of beats) {
    if (!started) { if (beat.name !== POWDERKEG_STARTS[from]?.beat) continue; started = true; }
    const f0 = r.frame; beat.run();
    log(`beat ${beat.name}: ${((r.frame - f0) * dt).toFixed(1)} s · ${JSON.stringify(pose())}`);
    if (p.state === 'finished') break;
  }
}
