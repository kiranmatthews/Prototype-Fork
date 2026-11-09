// Temple of Embers · one input-only journey from the spawn ledge to the sanctuary gate.
// Ordinary device samples only, through all seven legs of the switchback: the rider charges the smash
// stagger and grinds the gutter coping, turns west through the corner court and hops the pillar chain,
// climbs the fallen ledges to the roofed fuse court, walks the side-scroll broken stair under its slab, drops down the
// sluice and rides the aqueduct back over the start (ollie the Ravine Break, charge the Far Break), waits
// out the abutment pair, turns east through the cistern and up the ramp, climbs the sanctuary steps and
// rides the sentinel wave onto the dais, drops between the Nitro rows, hits the green switch and crosses the
// gate. Beats are keyed by station so a run can start at any room boundary
// (TEMPLE_START: 143, 205, 235, 278, 367, 458, 640, 728, 758).
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
  // Targets are compared in world space: at every corner the two legs overlap, and route.toLocal may describe a court
  // point in the next leg's frame, so a route-local distance would never close.
  const worldAt = (s, x) => route.toWorld(s, p.pos.y, x);
  const toward = (s, x, pace = 1) => { const t = worldAt(s, x); return r.worldDirectionInput({ x: t[0] - p.pos.x, z: t[2] - p.pos.z }, pace); };
  const dist = (s, x) => { const t = worldAt(s, x); return Math.hypot(t[0] - p.pos.x, t[2] - p.pos.z); };
  const near = (pos, s, x, radius) => { const t = worldAt(s, x); return Math.hypot(pos.x - t[0], pos.z - t[2]) < radius; };
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
  /** Hop onto the board, pushing toward the next station (or an explicit target) so the board sets off along the course. */
  const mount = (label = 'mount', target = null) => run(label, () => p.freeSkate, () => ({ ...(target ? toward(target[0], target[1], 1) : toward(S() + 6, X(), 1)), jumpHeld: true }), 240);

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
  const tikisNear = (s, x, radius = 12) => l.fireTikis.filter(t => near(t.group.position, s, x, radius));
  // Cool for the whole of the next `need` seconds: sampled along the interval, since a cool-now, cool-later pair can straddle a breath.
  const cool = (tikis, need) => tikis.every(t => { const c = t.spec.cycle ?? 7.8, ph = t.spec.phase ?? 0, amp = t.spec.amp ?? 28; for (let k = 0; k <= 12; k++) if (templeTikiPhase(l.time + need * k / 12, c, ph, amp).phase !== 'cool') return false; return true; });
  const waitCool = (tikis, need, label) => run(label, () => cool(tikis, need), () => ({}), 1200);
  /** The slab's cycle: hanging for 38 %, slamming, resting as a wall, then rising; go only with a second of hang time left. */
  const slabPhase = cr => ((l.time + cr.phase) % cr.cycle) / cr.cycle;
  const waitSlab = (cr, label) => run(label, () => { const f = slabPhase(cr); return f > .8 || f < .1; }, () => ({}), 600);
  const enemyNear = (s, x, kind) => l.enemies.find(e => e.kind === kind && near(e.group.position, s, x, 4));

  // ---- the course, as beats keyed by the station each ends at ----
  // Leg starts on the continuous station axis (see TEMPLE_LEGS in the level source).
  const L2 = 149, L3 = 235, L4 = 311, L5 = 406, L6 = 640, L7 = 728, T = L7 + 30.5;
  const beats = [
    { to: 143, name: 'Ravine floor', run() {
      // Charge down the bank and through the smash stagger, thread the checkpoint lane, grind the gutter coping from 65 to 112,
      // charge the court lane at speed, then brake inside the corner court.
      skate(60, { lane: s => s < 30 ? 1.2 - 1.2 * s / 30 : s < 56 ? 0 : 5.9, cap: 30, label: 'ravine floor and the smash stagger' });
      skate(118, { lane: s => s < 64 ? 5.9 : 7, cap: 24, grindPops: [64.6], label: 'gutter coping grind' });
      skate(130, { lane: 0, cap: 30, label: 'charge toward the court' });
      skate(138.5, { lane: 0, cap: 15, label: 'through the court lane' });
      skate(143, { lane: 0, cap: 7, label: 'brake in the corner court' });
    } },
    { to: L2 + 56, name: 'Pillar chain', run() {
      if (p.freeSkate) dismount('corner court');
      // Turn west through the arch onto the court apron, then hop the chain: two plinths, the walkway (spin the crab), the rest pad
      // (round the wall), two pillars, the landing court.
      walk(L2 + 4, 0, { label: 'court apron' }); walk(L2 + 5.6, -1.2, { label: 'apron edge', tol: .25 });
      jump(L2 + 9.55, -1.5, 1, { label: 'pillar one' });
      jump(L2 + 14.05, 1.5, 2, { label: 'pillar two', double: true });
      jump(L2 + 18.9, 0, 3, { label: 'the walkway', double: true });
      walk(L2 + 23, 0, { label: 'along the walkway', pace: .7 }); walk(L2 + 27.4, 0, { label: 'walkway end', tol: .22 });
      jump(L2 + 32, 0, 4, { label: 'the rest pad', double: true });
      walk(L2 + 34.5, 2.6, { label: 'round the wall' }); walk(L2 + 37.5, 2.6, { label: 'rest pad far corner', tol: .22 });
      jump(L2 + 42.6, -1.6, 5.5, { label: 'pillar three', double: true });
      walk(L2 + 44.9, -1.4, { label: 'pillar three far edge', tol: .22 });
      jump(L2 + 50.1, 1.6, 7, { label: 'pillar four', double: true });
      walk(L2 + 52.4, 1.4, { label: 'pillar four far edge', tol: .22 });
      jump(L2 + 57.4, 0, 8, { label: 'the landing court', double: true });
    } },
    { to: L3, name: 'Landing court', run() {
      walk(L2 + 61.3, -3.6, { label: 'landing court checkpoint' });
      // North side past the turtle and the TNT, to the court's edge above the first fallen ledge (which lies on the next leg).
      walk(L2 + 61.5, 9, { label: 'court north side, before the turtle' }); walk(L2 + 73, 9.4, { label: 'court north edge', tol: .25 });
    } },
    { to: L3 + 43, name: 'Fallen ledges', run() {
      // [station, x, top, depth]: land a metre inside the near edge, take off from the far corner nearest the next ledge; the last entry is the fuse court.
      const ledges = [[L3 + 5.5, -2, 10, 4], [L3 + 13, 2, 12, 4], [L3 + 21.5, 0, 14, 6], [L3 + 30, -2, 15, 4], [L3 + 37.5, 2, 16, 4], [L3 + 44.2, 1, 16, 4]];
      jump(ledges[0][0] - ledges[0][3] / 2 + 1.1, -1.4, 10, { label: 'fallen ledge 1', double: true });
      for (let i = 0; i < ledges.length - 1; i++) {
        const [s0, x0, , d0] = ledges[i], [s1, x1, y1, d1] = ledges[i + 1], side = Math.sign(x1 - x0) || 1, last = i === ledges.length - 2;
        walk(s0 + d0 / 2 - .6, d0 > 4 ? x0 + 1.6 : x0 + side * 1.2, { label: `ledge ${i + 1} far corner`, tol: .22 });
        jump(last ? s1 : s1 - d1 / 2 + 1.1, last ? x1 : x1 - side * 1.1, y1, { label: last ? 'fuse court' : `fallen ledge ${i + 2}`, double: true, spinAir: !!enemyNear(s1, x1, 'grunt') });
      }
    } },
    { to: L4 + 56, name: 'Fuse court and the broken stair', run() {
      walk(L3 + 49.3, 2.8, { label: 'fuse court checkpoint' }); walk(L3 + 59, 8, { label: 'court east edge' });
      // Through the opening onto the stair (side view from here): three flights with two 2.5 m breaks, the mossback on the second, the slab over the third.
      walk(L4 + 1, 0, { label: 'stair foot apron' }); walk(L4 + 17.4, 0, { label: 'first break edge', tol: .25 });
      jump(L4 + 21.7, 0, 16 + 8 * 19.7 / 54, { label: 'over the first break' });
      const turtle = enemyNear(L4 + 28, 0, 'turtle');
      walk(L4 + 24.5, -2.3, { label: 'before the mossback' });
      if (turtle) run('wait for the mossback', () => { const q = route.toLocal(turtle.group.position.toArray()); return !turtle.alive || q[2] > .3; }, () => ({}), 600);
      walk(L4 + 31, -2.3, { label: 'past the mossback' }); walk(L4 + 35.4, 0, { label: 'second break edge', tol: .25 });
      jump(L4 + 39.7, 0, 16 + 8 * 37.7 / 54, { label: 'over the second break' });
      walk(L4 + 43.4, 0, { label: 'before the slab', tol: .25 });
      const slab = l.crushers.find(c => Math.abs(route.toLocal([c.x, c.restY, c.z])[0] - (L4 + 46)) < 1.5);
      if (slab) waitSlab(slab, 'wait for the slab to rise');
      walk(L4 + 58.5, 0, { label: 'under the slab and onto the stair top', pace: 1 });
    } },
    { to: L5 + 52, name: 'Stair top and the sluice', run() {
      // The bristleback patrols the stair top's centre line: round it on the south side, take the checkpoint, walk to the mouth of the sluice, drop in.
      walk(L4 + 59.5, 6.6, { label: 'round the bristleback' }); walk(L4 + 70.6, 1.2, { label: 'stair top checkpoint' });
      walk(L4 + 84, 5, { label: 'toward the sluice mouth' }); walk(L4 + 85, 7, { label: 'sluice mouth', tol: .3 });
      mount('drop in', [L5 + 6, 0]);
      // The smash lane: skirt the first stack while speed is still building, smash the second and third.
      skate(L5 + 52, { lane: s => s < L5 + 2 ? 0 : channelCentre(s) + (s > L5 + 5 && s < L5 + 14 ? -1.5 : 0), label: 'the sluice' });
    } },
    { to: L6, name: 'Aqueduct and the abutment', run() {
      // Hold charge through the lane group and both checkpoints, ollie the Ravine Break and the Far Break.
      skate(L5 + 166, { lane: s => channelCentre(s), pops: [L5 + 95.4, L5 + 165.4], label: 'aqueduct spans' });
      // Let go of X over the Far Break so the landing rolls instead of re-charging (a release that began in the air never pops),
      // then pull-back brake to a stop on the third span and stand.
      run('fly the Far Break', () => p.grounded && S() > L5 + 177, () => ({}), 300);
      run('brake on the third span', () => Math.abs(p.speed) < .3 && p.grounded, () => ({ grabHeld: p.grounded }), 420);
      run('stow the board', () => !p.freeSkate && p.grounded, () => ({}), 90);
      if (S() < L5 + 198) walk(L5 + 199, 0, { label: 'up to the lane stacks' });
      waitCool(tikisNear(L5 + 220, 0, 10), 3.6, 'wait for both sentinels to breathe out');
      // Bank the checkpoint at speed, pass between the pair while they are cool, and turn east into the cistern.
      mount('through the pair', [L5 + 210, 0]); skate(L5 + 212, { lane: 0, label: 'bank the third span checkpoint' });
      skate(L5 + 223, { lane: 0, cap: 10, label: 'through the abutment pair' });
      // The lane turns east at z 27 with an 8 m radius (its fillet runs from (16, 19) to (24, 27) about (24, 19)): follow that arc
      // on world waypoints with the stick hard over and the push held, since a release would pop an ollie.
      const steerWorld = (tx, tz) => { const inp = r.worldDirectionInput({ x: tx - p.pos.x, z: tz - p.pos.z }, 1); return Math.abs(inp.moveX) > .12 ? { moveX: Math.sign(inp.moveX), moveY: Math.max(.2, inp.moveY) } : inp; };
      run('turn into the cistern', () => p.pos.x > 27, () => { const [tx, tz] = p.pos.x < 17 ? [17.6, 24.5] : p.pos.x < 20 ? [21, 26.8] : p.pos.x < 24.5 ? [27, 28] : [38, 27.5]; return { ...steerWorld(tx, tz), jumpHeld: true, grabHeld: p.grounded && p.speed > 11 }; }, 400);
    } },
    { to: L6 + 88, name: 'The Cistern', run() {
      // Charge the entry lane and bank its checkpoint, drop in and cross at speed, trim to twelve before the ramp, climb, land on the gallery, stop.
      // Swing south of the censer's track through the hall, back to the centre line for the reservoir.
      skate(L6 + 52, { lane: s => s > L6 + 14 && s < L6 + 24 ? 4.2 : 0, label: 'cistern: round the censer, drop in and cross the basin' });
      skate(L6 + 64.5, { lane: 0, cap: 12, label: 'trim speed before the ramp' });
      skate(L6 + 76.2, { lane: 0, label: 'ramp up to the gallery' });
      dismount('gallery');
      walk(L6 + 82.4, .9, { label: 'gallery checkpoint' });
    } },
    { to: T, name: 'Sanctuary steps', run() {
      // The steps lie on the next leg, north of the gallery's edge.
      walk(L6 + 82, -7.3, { label: 'gallery north edge', tol: .22 });
      const steps = [[L7 + 4, -1, 21.75], [L7 + 12, 2, 24], [L7 + 20, -2, 26.25], [L7 + 28, 2, 28.5]];
      jump(L7 + 3, -1.5, steps[0][2], { label: 'sanctuary step 1', double: true });
      for (let i = 0; i < steps.length - 1; i++) {
        const [s0, x0] = steps[i], [s1, x1, y1] = steps[i + 1], side = Math.sign(x1 - x0) || 1;
        walk(s0 + 1.8, x0 + side * 1.4, { label: `step ${i + 1} far corner`, tol: .22 });
        jump(s1 - 1.2, x1 - side * 1.4, y1, { label: `sanctuary step ${i + 2}`, double: true, spinAir: !!enemyNear(s1, x1, 'spiker') });
      }
      walk(L7 + 29.8, 2, { label: 'last step edge', tol: .22 }); jump(T + 2.3, 1, 30, { label: 'onto the terrace' });
    } },
    { to: 860, name: 'Sanctuary terrace', run() {
      walk(T + 6.7, .7, { label: 'terrace checkpoint' });
      // The wave: wait until both heads are cool for the run, push through them and up the bank; let go of X in the air, brake on the dais.
      waitCool(tikisNear(T + 21.5, 0, 8), 3.2, 'wait for the wave');
      mount('terrace'); skate(T + 36.1, { lane: 0, label: 'launch off the bank' });
      run('fly to the dais', () => p.grounded && S() > T + 37.5, () => ({}), 240);
      run('brake on the dais', () => Math.abs(p.speed) < .3 && p.grounded, () => ({ grabHeld: p.grounded }), 420);
      run('stow the board', () => !p.freeSkate, () => ({}), 90);
      walk(T + 48.5, 0, { label: 'crystal' }); walk(T + 58.9, 2.2, { label: 'dais back edge', tol: .25 });
      // Drop straight between the Nitro rows, stay right of the third head's sweep, then cut behind the height budget stack to the green switch.
      run('drop off the dais', () => p.grounded && S() > T + 60.1, () => toward(T + 64.5, 2.5, .8), 240);
      walk(T + 72.7, 2.4, { label: 'past the third sentinel' }); walk(T + 76.9, -2.2, { label: 'green switch approach' });
      const bang = l.crates.find(c => c.nitroBang);
      if (bang && !bang.bangUsed) { let held = false; run('green switch', () => bang.bangUsed, () => { held = p.spinning || !held; return { ...toward(T + 78.5, -4, .3), spinHeld: held }; }, 240); }
      for (let i = 0; i < 90; i++) step({}, 'watch the rows go');
      mount('to the gate'); run('cross the gate', () => p.state === 'finished', () => ({ ...toward(Math.min(route.end - 2, S() + 6), 0, 1), jumpHeld: true }), 900);
    } },
  ];
  const first = startStation === null ? 0 : beats.findIndex(b => b.to > startStation);
  for (const beat of beats.slice(first)) { r.report.stage = beat.name; beat.run(); r.report.actions.push({ name: beat.name, station: +S().toFixed(1), frame: r.frame }); }
  return { state: p.state, deaths: p.totalDeaths, position: p.pos.toArray(), cratesBroken: p.cratesBroken };
}
