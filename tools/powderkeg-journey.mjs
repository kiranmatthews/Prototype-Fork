// Powderkeg Peak · one input-only journey from the lodge yard to the powder works gate.
// Ordinary device samples only: the walker climbs Kindling Steps, the rider takes First Tracks to the tarn,
// rides the hoist, walks both ledge rows of the Headwall and rides Powderkeg Run through the gate.
// Beats are keyed by name so a run can start at any checkpoint (POWDERKEG_START=crest|tarn|hoist|east|summit).
export const POWDERKEG_STARTS = {
  crest: { position: [0, 10.62, -197], heading: [0, 0, -1], beat: 'first tracks' },
  adit: { position: [0, -7.88, -562], heading: [0, 0, -1], beat: 'old adit' },
  tarn: { position: [0, -7.88, -560], heading: [0, 0, -1], beat: 'tarn and hoist' },
  hoist: { position: [4, 6.12, -606], heading: [1, 0, 0], beat: 'lower row' },
  east: { position: [85, 19.92, -611], heading: [0, 0, -1], beat: 'upper row' },
  summit: { position: [-24, 28.12, -614], heading: [-1, 0, 0], beat: 'powderkeg run' },
};

export async function runPowderkegJourney(r, { from = null, log = console.log } = {}) {
  const { p, l } = r, m = r.sourceModule, { RUN1, RUN2 } = m.POWDERKEG_PATHS, PLAN = m.POWDERKEG_PLAN;
  const dt = r.CONST.fixedStep;
  const dead = () => p.isBailing || ['dead', 'gameover'].includes(p.state);
  const pose = () => ({ x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), state: p.state, grounded: p.grounded, board: p.freeSkate, speed: +p.speed.toFixed(2), vVel: +p.vVel.toFixed(2), deaths: p.totalDeaths, t: +(r.frame * dt).toFixed(1), ground: p.groundHit?.name ?? null });
  const fail = message => { throw new Error(`${message} at ${JSON.stringify(pose())}`); };
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
  const debug = process.env.POWDERKEG_DEBUG === '1';
  const step = (sample, label) => {
    const out = autoSpin(sample);
    if (out.grabHeld && !p.grounded) out.grabHeld = false;
    r.tick(out);
    if (debug) log('dbg', label, JSON.stringify(pose()));
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
  const walk = (x, z, { tol = .3, label = 'walk', pace = 1, keep = false, max = 1500 } = {}) => {
    run(label, () => dist(x, z) < tol, () => { const d = dist(x, z); return toward(x, z, keep ? pace : clamp((d - .15) / 1.4, .14, pace)); }, max);
    if (!keep) run(`${label} stop`, () => p.grounded && p.walkVelocity.length() < .3, () => ({}), 240);
  };
  /** Standing charged jump toward a landing point. */
  const jump = (x, z, y, { double = false, label = 'jump', charge = 24, tol = 1.9, spin = false } = {}) => {
    for (let i = 0; i < charge; i++) step({ jumpHeld: true }, `${label} charge`);
    step({ ...toward(x, z, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.grounded) fail(`${label} did not launch`);
    fly(x, z, y, { double, label, tol, spin });
  };
  /** `spin` holds Spin on the way down: the counter for a landing with a foe on it. */
  const fly = (x, z, y, { double = false, label = 'air', tol = 1.9, spin = false } = {}) => {
    let doubled = false;
    run(`${label} air`, () => p.grounded, () => {
      const d = dist(x, z), sample = { ...toward(x, z, clamp(d / 1.2, 0, 1)), ...(spin && p.vVel < 3 ? { spinHeld: true } : {}) };
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
  const arrowLaunch = ([ax, az], [lx, lz], y, label, standOff = true) => {
    run(`${label} approach`, () => dist(ax, az) < 2.5, () => toward(ax, az, 1), 600);
    for (let i = 0; i < 12; i++) step({ ...toward(ax, az, 1), jumpHeld: true }, `${label} hop`);
    step({ ...toward(ax, az, 1), jumpHeld: false, jumpReleased: true }, `${label} hop`);
    let bounced = false, doubled = false;
    for (let i = 0; i < 700 && !(bounced && p.grounded && Math.abs(p.pos.y - y) < .4); i++) {
      const before = p.vVel; let sample;
      if (p.state === 'hang') sample = { ...toward(lx, lz - 3, 1), jumpHeld: i % 20 < 10, jumpPressed: i % 20 === 0 };
      else {
        const overArrow = toward(ax, az + (standOff ? -.3 : 0), clamp(dist(ax, az) / 1.2, 0, 1));
        const aim = !bounced ? overArrow : doubled && p.pos.y > y - 2.6 ? toward(lx, lz, 1) : standOff ? overArrow : toward(lx, lz, .5);
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
    const ahead = l.stones.map(st => ({ st, q: path.nearest(st.mesh.position.x, st.mesh.position.z, 16) })).filter(o => o.q && o.q.s - s > -2.5 && o.q.s - s < 50);
    if (!ahead.length) return null;
    const station = Math.min(...ahead.map(o => o.q.s)), group = ahead.filter(o => o.q.s - station < 3), f = path.at(station);
    const arrive = Math.max(0, station - s) / Math.max(8, Math.abs(p.speed));
    const stoneLats = group.map(({ st }) => { const v = stoneIn(st, arrive), sx = st.axis === 'x' ? v : st.mesh.position.x, sz = st.axis === 'x' ? st.mesh.position.z : v; return (sx - f.x) * f.rx + (sz - f.z) * f.rz; });
    const lanes = [-4.8, -2.4, 0, 2.4, 4.8].map(c => ({ c, clear: Math.min(...stoneLats.map(v => Math.abs(c - v))) - Math.abs(c - lat) * .1 }));
    return lanes.sort((a, b) => b.clear - a.clear)[0].c;
  };
  const mount = (x, z, label = 'mount') => run(label, () => p.freeSkate, () => ({ ...toward(x, z, 1), jumpHeld: true }), 300);
  /** Ride a path to station `to`: steer at the lane a few metres ahead, hold X to push when `push`, brake above `cap`, ollie at `pops`. */
  const ride = (path, to, { lane = () => 0, cap = 60, push = false, pops = [], label = 'ride', look = 9 } = {}) => {
    const popped = new Set(); let braking = false;
    const here = () => path.nearest(p.pos.x, p.pos.z, 40) ?? fail(`${label}: left the piste`);
    run(label, () => here().s >= to, () => {
      const q = here(), s = q.s, dodge = boulderLane(path, s, q.lat);
      const target = path.w(Math.min(path.length + 20, s + look), dodge ?? (typeof lane === 'function' ? lane(s) : lane));
      if (p.state === 'grind') { const c = clamp(-p.balance * 5 - p.balanceVel * .7, -1, 1); return { moveY: 1, moveX: c, grindHeld: true }; }
      const pop = pops.find(q2 => !popped.has(q2) && s >= q2 - .4 && s < q2 + 4 && p.grounded);
      if (pop !== undefined) popped.add(pop);
      if (p.speed > cap) braking = true; else if (p.speed < cap - 3) braking = false;
      const steer = p.grounded || !p.airFromSkate ? toward(target[0], target[2], 1) : {};
      const charging = pops.some(q2 => !popped.has(q2) && s >= q2 - 26 && s < q2);
      return { ...steer, jumpHeld: pop === undefined && (push || charging) && !braking, grabHeld: pop === undefined && braking && p.grounded };
    }, Math.round((to - here().s + 80) * 60 / 5) + 1200);
  };
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
      walk(0, Z(13), { keep: true }); walk(0, Z(22), { keep: true }); walk(0, Z(35.4));
      jump(0, Z(39.2), 2.5, { label: 'onto the mill pond' });
      walk(0, Z(52), { keep: true }); walk(-2.6, Z(58.5));
      // Boulder trough: go as the boulder passes the walker's side heading away.
      const stone = stoneAt(0, Z(62.5));
      run('wait for the boulder to roll away', () => stone.mesh.position.x > .4 && stone.dir > 0, () => ({}), 900);
      walk(-2.6, Z(66), { keep: true });
      walk(3, Z(70), { keep: true }); walk(3, Z(75.5), { keep: true }); walk(0, Z(80), { keep: true });
      leap([0, Z(85)], [0, Z(90.4), 2.5], { label: 'first crevasse' });
      walk(0, Z(98), { keep: true }); walk(0, Z(107), { keep: true });
      leap([0, Z(116)], [0, Z(121.2), 5], { label: 'second crevasse off the ice shelf' });
      walk(-3.4, Z(123.4)); still(20, 'bank the powder landing checkpoint');
      walk(-1, Z(130), { keep: true }); walk(0, Z(139), { keep: true }); walk(0, Z(146.5), { keep: true });
      leap([0, Z(151)], [0, Z(155.4), 7.5], { label: 'first pillar' });
      leap([0, Z(157.3)], [0, Z(161.6), 8], { label: 'glazed pillar', tap: true });
      leap([0, Z(163.8)], [0, Z(168.4), 8.5], { label: 'third pillar', tap: true, spin: true });
      walk(0, Z(169.6));
      jump(0, Z(173.4), 9.4, { label: 'onto the lookout shelf' });
      walk(0, Z(183), { keep: true }); walk(0, Z(191), { keep: true }); walk(0, Z(196.2));
      still(20, 'bank the crest checkpoint');
    } },
    { name: 'first tracks', run() {
      mount(0, -212);
      ride(RUN1, RUN1.length - 34, { label: 'first tracks', pops: [403] });
      ride(RUN1, RUN1.length - 8, { cap: 9, label: 'slow for the shore' });
      dismount('tarn shore');
    } },
    { name: 'old adit', run() {
      // The gem route: steel arrow, double jump, grab the lip, into the mine mouth; out again by the ring on the gem shelf.
      const [mx, my, mz] = PLAN.MOUTH, X = PLAN.CAVE_X, z = PLAN.CAVE_Z, A = PLAN.ADIT;
      walk(0, -560); still(20, 'bank the tarn checkpoint');
      walk(-16, -593.4);
      arrowLaunch([-16, -597.6], [mx, mz + .5], my, 'arrow to the adit mouth');
      run('into the adit', () => p.pos.x > X - 5, () => toward(mx, mz - 1.4, 1), 240);
      still(12, 'arrive'); walk(X + 4.5, z); still(20, 'bank the adit checkpoint');
      walk(X + 7.4, z - .5, { tol: .35 }); spinOnce('adit landing pair');
      walk(X + 6, z, { keep: true });
      leap([X + A[0].x1, z], [X + 15.2, z, A[1].y], { label: 'onto the glazed drift' });
      // Nitro goes off on the body's whole silhouette, not its feet: leave the ice a good stride before it.
      leap([X + 19.8, z], [X + 27.9, z, A[2].y], { label: 'over the Nitro at the lip', double: true, hold: 3 });
      leap([X + A[2].x1, z], [X + 32.5, z, A[3].y], { label: 'second rotten shelf', tap: true });
      leap([X + A[3].x1, z], [X + 36.6, z, A[4].y], { label: 'quick stamper gallery', tap: true });
      // Quick stampers: go as each nears the top of its rise. The second is the run-up to the wide gap, so there is no stopping under it.
      walk(X + 36.9, z); waitRise(X + 39.4, z, 'quick stamper, first'); walk(X + 41.5, z, { tol: .3 }); spinOnce('pocket crate'); walk(X + 42.9, z, { tol: .3 });
      waitRise(X + 45.2, z, 'quick stamper, second');
      leap([X + A[4].x1, z], [X + 53.3, z, A[5].y], { label: 'the wide gap onto the bristleback pillar', spin: true, hold: 3.4 });
      leap([X + A[5].x1, z], [X + 59.8, z, A[6].y], { label: 'arrow floor', tap: true });
      walk(X + 60.6, z - .5, { tol: .35 }); spinOnce('arrow floor pair');
      walk(X + 62.2, z); walk(X + 63, z, { tol: .25 }); spinOnce('the box beside the arrow');
      arrowLaunch([X + 65.06, z], [X + 68.6, z], PLAN.GEM_Y, 'arrow to the gem shelf');
      walk(X + 70, z, { keep: true }); walk(X + 72.3, z - .5, { tol: .4 });
      for (let k = 0; k < 4; k++) { spinOnce('gem shelf tower'); still(14, 'let the tower settle'); }
      run('out by the ring', () => p.pos.x < 100, () => toward(X + 77.4, z, 1), 400);
      still(12, 'back on the shore');
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
      walk(85, -610.4); still(20, 'bank the east landing checkpoint');
    } },
    { name: 'upper row', run() {
      const z = ROW_B;
      walk(84, z); walk(87.6, z);
      { const c = stamperAt(75.5, z); run('stamper over the ice: go as it nears the top of its rise', () => { const f = stampPhase(c); return f > .84 && f < .92; }, () => ({}), 600); }
      walk(69, z, { keep: true });
      leap([B[0].x0, z], [61.6, z, B[1].y], { label: 'bristleback pillar', spin: true });
      leap([B[1].x0, z], [54.8, z, B[2].y], { label: 'rotten shelf one', tap: true });
      leap([B[2].x0, z], [50.3, z, B[3].y], { label: 'rotten shelf two', tap: true });
      leap([B[3].x0, z], [45.8, z, B[4].y], { label: 'rotten shelf three', tap: true });
      leap([B[4].x0, z], [41.4, z + .6, B[5].y], { label: 'switch ledge', tap: true });
      walk(41.4, z - .5, { tol: .3 }); spinOnce('break the mask crate');
      walk(39, z + 1); walk(34.4, z + 1); walk(33.2, z - .1, { tol: .25 }); spinOnce('hit the switch');
      if (!l.crates.some(c => c.alive && !c.pending && Math.abs(c.box.min.x - 26.4) < .7 && Math.abs(c.mesh.position.z - z) < .5)) fail('the switch did not build the bridge');
      // Walk the lids: a jump onto a wooden lid is a stomp and would break the footing.
      walk(31.6, z, { keep: true }); walk(24, z, { tol: .35 });
      jump(21, z, B[6].y, { label: 'off the bridge', charge: 12, tol: 1.8 });
      waitStamper(19.5, z, .8, 'twin stampers, first'); walk(16.6, z);
      waitStamper(13.5, z, .8, 'twin stampers, second'); walk(11, z, { keep: true });
      leap([B[6].x0, z], [4.8, z, B[7].y], { label: 'last pillar', hold: 1 });
      leap([B[7].x0, z], [-1.8, z, B[8].y], { label: 'summit approach', tap: true });
      walk(-5.5, z, { keep: true }); walk(-15, z, { keep: true }); walk(-23.4, z); still(20, 'bank the summit checkpoint');
    } },
    { name: 'powderkeg run', run() {
      mount(-36, -614);
      ride(RUN2, RUN2.length - 40, { label: 'powderkeg run', pops: [239, 451, 595] });
      ride(RUN2, RUN2.length - 4, { cap: 9, label: 'slow for the works yard' });
      dismount('works yard');
      const [fx, , fz] = PLAN.FINISH;
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
