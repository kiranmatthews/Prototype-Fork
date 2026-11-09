// Temple of Embers · one input-only journey from the spawn ledge to the sanctuary gate.
// Ordinary device samples only: the rider charges the smash stagger and grinds the gutter
// coping, walks the Great Stair and its six short hops, rides the sluice's smash lane, ollies
// the Ravine Break and charges the Far Break, waits out the abutment pair, drops into the
// reservoir and rides the ramp to the gallery, climbs the sanctuary steps on foot, rides the
// sentinel wave onto the dais, drops between the Nitro rows, hits the green switch and
// crosses the gate. Beats are keyed by station so a run can start at any room boundary
// (TEMPLE_START: 172, 240, 309, 398, 476, 660, 742, 776).
export async function runTempleJourney(r, { startStation = null } = {}) {
  const { p, l } = r, route = r.route;
  const { templeTikiPhase } = await r.server.ssrLoadModule('/src/templeBreath.ts');
  const { templeFloorCentre } = await r.server.ssrLoadModule('/src/levels/temple-of-embers.ts');
  const loc = () => route.toLocal(p.pos.toArray()), S = () => loc()[0], X = () => loc()[2];
  const dead = () => p.isBailing || ['dead', 'gameover'].includes(p.state);
  const pose = () => ({ s: +S().toFixed(2), x: +X().toFixed(2), y: +p.pos.y.toFixed(2), state: p.state, grounded: p.grounded, board: p.freeSkate, speed: +p.speed.toFixed(2), vVel: +p.vVel.toFixed(2), deaths: p.totalDeaths, frame: r.frame });
  const fail = m => { throw new Error(`${m} at ${JSON.stringify(pose())}`); };
  const camera = () => { const c = l.cameraDirAt(p.pos.x, p.pos.y, p.pos.z) ?? { x: 0, z: -1 }; p.camDir.set(c.x, 0, c.z); };
  // Spin policy: bank checkpoints, break plain boxes, spin killable foes that come close; never spin beside TNT or nitro.
  let lastSpin = false;
  const autoSpin = sample => {
    if (!p.grounded || p.state === 'grind' || 'spinHeld' in sample) return sample;
    const cp = l.checkpoints.some(c => !c.active && c.box.distanceToPoint(p.pos) < 3.2);
    const foe = l.enemies.some(e => e.alive && e.spinKill && (e.kind !== 'charger' || e.state === 'recover' || e.state === 'patrol') && e.box.distanceToPoint(p.pos) < 3);
    const plain = l.crates.some(c => c.alive && !c.pending && !c.metal && !c.metalBounce && !c.bang && !c.nitroBang && !c.bouncy && !c.tnt && !c.nitro && c.box.distanceToPoint(p.pos) < 2.6);
    const explosive = l.crates.some(c => c.alive && !c.pending && (c.tnt || c.nitro) && c.box.distanceToPoint(p.pos) < 3.6);
    if (cp || ((plain || foe) && !explosive)) { const held = p.spinning || !lastSpin; lastSpin = held; return { ...sample, spinHeld: held }; }
    lastSpin = false; return sample;
  };
  // TEMPLE_DEBUG="a,b" prints every frame between those stations.
  const debug = (process.env.TEMPLE_DEBUG ?? '').split(',').map(Number);
  const step = (sample, label) => {
    if (r.nodeCamera) camera();
    const out = autoSpin(sample);
    if (out.grabHeld && !p.grounded) out.grabHeld = false; // a grab is only ever a grounded brake
    r.tick(out);
    if (debug.length === 2 && S() >= debug[0] && S() <= debug[1]) console.log('dbg', JSON.stringify({ ...pose(), in: [out.moveX, out.moveY, out.jumpHeld ? 'J' : '', out.grabHeld ? 'B' : '', out.spinHeld ? 'S' : '', out.grindHeld ? 'R' : ''].join(' '), bailDown: +(p.bailDownT ?? 0).toFixed(2), stepOff: p.stepOff, ride: p.rideNormal?.y?.toFixed(2), ground: p.groundHit?.name, label }));
    if (dead()) fail(`${label}: lost control`);
  };
  const toward = (s, x, pace = 1) => { const t = route.toWorld(s, p.pos.y, x); return r.worldDirectionInput({ x: t[0] - p.pos.x, z: t[2] - p.pos.z }, pace); };
  const dist = (s, x) => Math.hypot(s - S(), x - X());
  // Predicates may be stateful, so each frame evaluates them exactly once.
  const run = (label, pred, sampler, max) => { let done = pred(); for (let i = 0; i < max && !done; i++) { step(sampler(i), label); done = pred(); } if (!done) fail(`${label} timed out`); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const channelCentre = s => { const f = route.floors.find(q => q.xa !== undefined && s >= q.a && s <= q.b); return f ? templeFloorCentre(f, s) : 0; };

  // ---- board beats ----
  /** Hold X to push, steer to the lane six metres ahead, brake to the cap, ollie at the pop stations, catch rails when launched for one. */
  const skate = (to, { lane = () => 0, cap = 40, pops = [], grindPops = [], label = 'skate' } = {}) => {
    const popped = new Set(); let braking = false;
    run(label, () => S() >= to, () => {
      const s = S(), x = typeof lane === 'function' ? lane(s) : lane;
      if (p.state === 'grind') { const c = clamp(-p.balance * 5 - p.balanceVel * .7, -1, 1); return { moveY: 1, moveX: c, grindHeld: true }; }
      const pop = [...pops, ...grindPops].find(q => !popped.has(q) && s >= q - .3 && s < q + 3 && p.grounded);
      if (pop !== undefined) popped.add(pop);
      if (p.speed > cap) braking = true; else if (p.speed < cap - 3) braking = false;
      const launchedForRail = grindPops.some(q => popped.has(q) && s < q + 12) && !p.grounded;
      const move = p.grounded || !p.airFromSkate || launchedForRail ? toward(Math.min(route.end - 2, s + 6), x, 1) : {};
      return { ...move, jumpHeld: pop === undefined && !launchedForRail, grabHeld: pop === undefined && braking && p.grounded, grindHeld: launchedForRail };
    }, Math.round((to - S() + 60) * 60 / 3) + 900);
  };
  /** Pull-back brake to a stop, then stand: the board is stowed once it stops rolling. */
  const dismount = (label = 'dismount') => {
    run(`${label} brake`, () => Math.abs(p.speed) < .3 && p.grounded, () => ({ grabHeld: p.grounded }), 420);
    run(`${label} settle`, () => !p.freeSkate && p.grounded, () => ({}), 90);
  };
  const mount = (label = 'mount') => run(label, () => p.freeSkate, () => ({ ...toward(S() + 6, X(), 1), jumpHeld: true }), 240);

  // ---- foot beats ----
  const walk = (s, x, { tol = .3, label = 'walk', pace = 1, maxFrames = 1200 } = {}) => {
    run(label, () => dist(s, x) < tol, () => { const d = dist(s, x); return toward(s, x, clamp((d - .15) / 1.4, .12, pace)); }, maxFrames);
    run(`${label} stop`, () => p.grounded && Math.abs(p.speed) < .25 && p.walkVelocity.length() < .25, () => ({}), 90);
  };
  /** Standing charged jump toward a landing point; `double` pops the second jump at the apex; `spinAir` spins on the way down. */
  const jump = (s, x, y, { double = false, label = 'jump', spinAir = false, charge = 24 } = {}) => {
    for (let i = 0; i < charge; i++) step({ jumpHeld: true }, `${label} charge`);
    step({ ...toward(s, x, 1), jumpHeld: false, jumpReleased: true }, `${label} release`);
    if (p.state !== 'air') fail(`${label} did not launch`);
    let doubled = false;
    run(`${label} air`, () => p.grounded, () => {
      const sample = { ...toward(s, x, 1), ...(spinAir && p.vVel < 0 ? { spinHeld: true } : {}) };
      if (double && !doubled && p.vVel < 1.5) { doubled = true; return { ...sample, jumpHeld: true, jumpPressed: true }; }
      if (double && doubled && p.vVel > 0) return { ...sample, jumpHeld: true };
      return sample;
    }, 300);
    if (dist(s, x) > 1.7) fail(`${label} missed the target`);
    if (Math.abs(p.pos.y - y) > .5) fail(`${label} landed at the wrong height`);
    r.report?.evidence?.push({ action: label, landing: pose() });
  };

  // ---- hazards ----
  const tikisNear = (s, x, radius = 12) => l.fireTikis.filter(t => { const q = route.toLocal(t.group.position.toArray()); return Math.hypot(q[0] - s, q[2] - x) < radius; });
  const cool = (tikis, need) => tikis.every(t => { const c = t.spec.cycle ?? 7.8, ph = t.spec.phase ?? 0, amp = t.spec.amp ?? 28; return templeTikiPhase(l.time, c, ph, amp).phase === 'cool' && templeTikiPhase(l.time + need, c, ph, amp).phase === 'cool'; });
  const waitCool = (tikis, need, label) => run(label, () => cool(tikis, need), () => ({}), 1200);
  const censerAngle = pd => Math.sin(l.time * pd.speed + pd.phase) * pd.amp;
  const waitCenser = (pd, label) => { let prev = Math.abs(censerAngle(pd)), n = 0; run(label, () => { const a = Math.abs(censerAngle(pd)); const ok = a > .5 && a > prev + 1e-6; if (debug.length === 2 && n++ < 4) console.log('censer', JSON.stringify({ time: l.time, a, prev, speed: pd.speed, amp: pd.amp, phase: pd.phase })); prev = a; return ok; }, () => ({}), 600); };
  const enemyNear = (s, x, kind) => l.enemies.find(e => e.kind === kind && Math.hypot(route.toLocal(e.group.position.toArray())[0] - s, route.toLocal(e.group.position.toArray())[2] - x) < 4);

  // ---- the course, as beats keyed by the station each ends at ----
  const beats = [
    { to: 172, name: 'Ravine floor', run() {
      // Charge down the bank and through the smash stagger (whole stacks clear at smash speed), thread the checkpoint lane,
      // grind the gutter coping from 65 to 120, charge the stair-foot stack, thread the lane at speed, then brake for the stair.
      skate(60, { lane: s => s < 30 ? 1.2 - 1.2 * s / 30 : s < 56 ? 0 : 5.9, cap: 30, label: 'ravine floor and the smash stagger' });
      skate(126, { lane: s => s < 64 ? 5.9 : 7, cap: 24, grindPops: [64.6], label: 'gutter coping grind' });
      skate(166.5, { lane: 0, cap: 30, label: 'charge the stair foot stack and the lane' });
      skate(171, { lane: 0, cap: 9, label: 'brake before the gateway' });
    } },
    { to: 240, name: 'Gateway, first flight and the collapse', run() {
      if (p.freeSkate) dismount('stair foot');
      // The crab paces the lane's centre toward you: pass it wide on the left, clear of the wall at the flight's foot.
      walk(178, -6, { label: 'gateway' }); walk(190, -4.5, { label: 'lower run' }); walk(199.2, -1.5, { label: 'edge of the collapse', tol: .25 });
      jump(203.5, -1.5, 3.1, { label: 'plinth one' });
      jump(208, 1.5, 3.6, { label: 'plinth two', double: true });
      jump(213.2, 1.5, 4.43, { label: 'upper run', double: true });
      walk(239, -3, { label: 'upper run' });
    } },
    { to: 309, name: 'First landing and the climb', run() {
      walk(241.7, -2.4, { label: 'first landing checkpoint' });
      // The turtle and the TNT are on the right, the sentinel's sweep on the left: walk the centre to the landing's edge.
      walk(265.4, 0, { label: 'landing edge', tol: .25 });
      // [station, x, top, depth]: land a metre inside the near edge, take off from the far corner nearest the next ledge; the last entry is the fuse court.
      const ledges = [[271.5, -2, 10, 4], [279, 2, 12, 4], [287.5, 0, 14, 6], [296, -2, 15, 4], [303.5, 2, 16, 4], [310.2, 1, 16, 4]];
      jump(ledges[0][0] - ledges[0][3] / 2 + 1.1, -1.2, 10, { label: 'fallen ledge 1', double: true });
      for (let i = 0; i < ledges.length - 1; i++) {
        const [s0, x0, , d0] = ledges[i], [s1, x1, y1, d1] = ledges[i + 1], side = Math.sign(x1 - x0) || 1, last = i === ledges.length - 2;
        // The rest tier's block stands at its back left: cross it on the right. The crab on the fifth landing is spun on the way down.
        walk(s0 + d0 / 2 - .6, d0 > 4 ? x0 + 1.6 : x0 + side * 1.2, { label: `ledge ${i + 1} far corner`, tol: .22 });
        jump(last ? s1 : s1 - d1 / 2 + 1.1, last ? x1 : x1 - side * 1.1, y1, { label: last ? 'fuse court' : `fallen ledge ${i + 2}`, double: true, spinAir: !!enemyNear(s1, x1, 'grunt') });
      }
    } },
    { to: 398, name: 'Fuse court and the narrow stair', run() {
      walk(315.3, 2.8, { label: 'fuse court checkpoint' }); walk(339, 1, { label: 'through the fuse court' }); walk(343.2, -2.3, { label: 'foot of the narrow stair' });
      const turtle = enemyNear(346, 0, 'turtle');
      if (turtle) run('wait for the mossback', () => { const q = route.toLocal(turtle.group.position.toArray()); return !turtle.alive || q[2] > .3; }, () => ({}), 600);
      walk(349, -2.3, { label: 'past the mossback' }); walk(366, -1.2, { label: 'past the stair stack' }); walk(376, 0, { label: 'narrow stair' }); walk(378.6, 0, { label: 'before the censer', tol: .25 });
      const pd = l.pendulums.find(q => Math.abs(route.toLocal(q.pivot.position.toArray())[0] - 382) < 1);
      if (pd) waitCenser(pd, 'wait for the censer');
      walk(387, 0, { label: 'under the censer', pace: 1 }); walk(398, 0, { label: 'stair top' });
    } },
    { to: 476, name: 'Stair top and the sluice', run() {
      // The bristleback patrols the stair top's centre line: round it on the right, take the checkpoint, drop in.
      walk(399.5, 6.6, { label: 'round the bristleback' }); walk(409.4, 1.2, { label: 'stair top checkpoint' });
      mount('drop in');
      // The smash lane: skirt the first stack while speed is still building, smash the second and third.
      skate(476, { lane: s => s < 424 ? 0 : channelCentre(s) + (s > 429 && s < 438 ? -1.5 : 0), label: 'the sluice' });
    } },
    { to: 660, name: 'Broken aqueduct and the abutment', run() {
      // Hold charge through the lane group and both checkpoints, ollie the Ravine Break and the Far Break, smash the third span's stacks.
      skate(636, { lane: s => channelCentre(s), pops: [519.4, 589.4], label: 'aqueduct spans' });
      skate(644.3, { lane: 0, cap: 11, label: 'abutment court checkpoint' });
      dismount('before the abutment pair');
      waitCool(tikisNear(649, 0, 10), 2.6, 'wait for both sentinels to breathe out');
      // Skirt the stack beyond the sweep, then come back to the line for the cistern's lane stacks.
      mount('cross the abutment'); skate(660, { lane: s => s > 650 && s < 656 ? 1.9 : 0, cap: 18, label: 'through the abutment' });
    } },
    { to: 742, name: 'The Cistern', run() {
      // Charge the entry lane and bank its checkpoint, drop in and cross at speed, trim to twelve before the ramp, climb, land on the gallery, stop before the drain.
      skate(708, { lane: 0, label: 'cistern: drop in and cross the basin' });
      skate(720.5, { lane: 0, cap: 12, label: 'trim speed before the ramp' });
      skate(732.2, { lane: 0, label: 'ramp up to the gallery' });
      dismount('gallery');
      walk(738.4, .9, { label: 'gallery checkpoint' });
    } },
    { to: 776, name: 'Sanctuary steps', run() {
      walk(743.2, -2, { label: 'gallery edge', tol: .22 });
      const steps = [[748, -2, 21.75], [756, 2, 24], [764, -2, 26.25], [772, 2, 28.5]];
      jump(747, -2, steps[0][2], { label: 'sanctuary step 1', double: true });
      for (let i = 0; i < steps.length - 1; i++) {
        const [s0, x0] = steps[i], [s1, x1, y1] = steps[i + 1], side = Math.sign(x1 - x0) || 1;
        walk(s0 + 1.8, x0 + side * 1.4, { label: `step ${i + 1} far corner`, tol: .22 });
        jump(s1 - 1.2, x1 - side * 1.4, y1, { label: `sanctuary step ${i + 2}`, double: true, spinAir: !!enemyNear(s1, x1, 'spiker') });
      }
      walk(773.8, 2, { label: 'last step edge', tol: .22 }); jump(776.8, 1, 30, { label: 'onto the terrace' });
    } },
    { to: 876, name: 'Sanctuary terrace', run() {
      walk(781.2, .7, { label: 'terrace checkpoint' });
      // The wave: wait until both heads are cool for the run, push through them and up the bank; let go of X in the air, brake on the dais.
      waitCool(tikisNear(796, 0, 8), 3.2, 'wait for the wave');
      mount('terrace'); skate(810.6, { lane: 0, label: 'launch off the bank' });
      run('fly to the dais', () => p.grounded && S() > 812, () => ({}), 240);
      run('brake on the dais', () => Math.abs(p.speed) < .3 && p.grounded, () => ({ grabHeld: p.grounded }), 420);
      run('stow the board', () => !p.freeSkate, () => ({}), 90);
      walk(823, 0, { label: 'crystal' }); walk(833.4, 2.2, { label: 'dais back edge', tol: .25 });
      // Drop straight between the Nitro rows, stay right of the third head's sweep, then cut behind the height budget stack to the green switch.
      run('drop off the dais', () => p.grounded && S() > 834.6, () => toward(839, 2.5, .8), 240);
      walk(847.2, 2.4, { label: 'past the third sentinel' }); walk(851.4, -2.2, { label: 'green switch approach' });
      const bang = l.crates.find(c => c.nitroBang);
      if (bang && !bang.bangUsed) { let held = false; run('green switch', () => bang.bangUsed, () => { held = p.spinning || !held; return { ...toward(853, -4, .3), spinHeld: held }; }, 240); }
      for (let i = 0; i < 90; i++) step({}, 'watch the rows go');
      mount('to the gate'); run('cross the gate', () => p.state === 'finished', () => ({ ...toward(Math.min(route.end - 2, S() + 6), 0, 1), jumpHeld: true }), 900);
    } },
  ];
  const first = startStation === null ? 0 : beats.findIndex(b => b.to > startStation);
  for (const beat of beats.slice(first)) { r.report.stage = beat.name; beat.run(); r.report.actions.push({ name: beat.name, station: +S().toFixed(1), frame: r.frame }); }
  return { state: p.state, deaths: p.totalDeaths, position: p.pos.toArray(), cratesBroken: p.cratesBroken };
}
