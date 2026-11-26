// The Side Pipe Lab route bot: the REAL Player and Level, driven the way a
// side-scrolling player holds the pad. Right is held from the first step to
// the gate; the bot adds a jump at each gap, step and falling stair, a spin
// at each enemy, box and checkpoint, Jump at each lip he has walked up to
// (he is on his board there, waiting to be told), Jump in each east hang (the
// pop-out and the spine transfer), the grind button at the rail — and it
// WAITS, as a player does, for a lift, the ferry, a timed pad, a crusher and
// the Whirler.
// Every wait reads the hazard's own clock; nothing here reaches into the
// player to move it.
//
// Used by tools/test-side-pipe-lab.mjs (npm run check:side-pipe). `start` exposes one run as decide/observe
// halves, so the same decisions can be delivered to the game in a browser as real key presses.

/**
 * @param {object} ctx  { p, level, CONST, lab, makeInput, parts } — the player, the built level,
 *                      engine constants, the level module's exports, the input factory and the
 *                      level's authored components.
 */
export function makeCourseBot({ p, level, CONST, lab, makeInput, parts }) {
  const { P0, P1, L1, DEEP, VALLEY, SWITCH_PIPE, SWITCH_SLAB, C1, C2, C3, RAIL_PIPE, RAIL, RAIL_CATCH, LONG_PIPE, LONG_RAIL, FINISH,
    CRUMBLE_STAIRS, TRAMPOLINE, LIFT1, LIFT2, PHASE, PHASE_DEBUT, PHASE_PAIR, FERRY, CRUSHERS } = lab;
  const PIPES = [P0, P1, L1, DEEP, VALLEY, SWITCH_PIPE, C1, C2, C3, RAIL_PIPE, RAIL_CATCH, LONG_PIPE];
  /** Bare east walls left by the rail over the lip: [pipe, its rail]. */
  const RAILS = [[RAIL_PIPE, RAIL], [LONG_PIPE, LONG_RAIL]];
  /** Pipes left by popping out onto their own east deck. */
  const DECKED = PIPES.filter(q => q.eastDeck > 0);
  /** Ridges shared by two pipes: [pipe west of it, pipe east of it]. */
  const RIDGES = PIPES.flatMap(a => PIPES.filter(b => b !== a && Math.abs(b.westLip - a.eastLip) < 0.01).map(b => [a, b]));
  const pipeAt = x => PIPES.find(q => x > q.westLip - 0.6 && x < q.eastLip + 0.6) ?? null;
  const dt = CONST.fixedStep;
  const RUN = 9, ACCEL = 12; // on foot: top speed (m/s) and how fast it is reached (m/s²)
  const TAP_JUMP = 5.25; // metres a tapped running jump carries on the flat
  /** Seconds to cover `d` metres on foot from speed `v`, holding the stick. */
  const eta = (d, v) => { if (d <= 0) return 0; const ta = (RUN - v) / ACCEL, da = v * ta + ACCEL * ta * ta / 2;
    return d <= da ? (-v + Math.sqrt(v * v + 2 * ACCEL * d)) / ACCEL : ta + (d - da) / RUN; };

  const blocks = parts.filter(c => c.t === 'platform');
  const floors = blocks.filter(c => !/footing/.test(c.nm ?? ''))
    .map(c => ({ x0: c.p[0] - c.s[0] / 2, x1: c.p[0] + c.s[0] / 2, top: c.p[1] + c.s[1] / 2 }));
  // steps up on the on-foot floors: where one block's top meets a taller one's west face
  const steps = floors.flatMap(b => floors.filter(a => Math.abs(a.x1 - b.x0) < 0.01 && b.top - a.top > 0.4 && b.top - a.top <= 2)
    .map(a => ({ x: b.x0, rise: b.top - a.top, below: a.top })));
  const inside = (x, a, b) => x > a - 0.01 && x < b + 0.01;
  const pits = parts.filter(c => c.t === 'pit').map(c => [c.p[0] - c.s[0] / 2, c.p[0] + c.s[0] / 2]);
  // holes crossed in the air (behind a bare east wall) or on a timed tool are never jumped on foot
  const tooled = ([a, b]) => { const m = (a + b) / 2; return inside(m, SWITCH_PIPE.eastLip, SWITCH_SLAB.x1) || inside(m, RAIL_PIPE.eastLip, RAIL_CATCH.westLip) || inside(m, LONG_PIPE.eastLip, FINISH.x0) ||
    inside(m, PHASE_DEBUT.x0, PHASE_DEBUT.x1) || inside(m, PHASE_PAIR[0].x0 - 1, PHASE_PAIR[1].x1 + 1) ||
    inside(m, LIFT2.x0 - 0.5, LIFT2.x1 + 0.5) || inside(m, FERRY.x0, FERRY.x1); };
  const gaps = pits.filter(g => !tooled(g));
  /** Where a running jump is thrown: 2.4 m short of each of these edges. */
  const edges = [...gaps.map(([a]) => a), ...CRUMBLE_STAIRS.map(s => s.x1)];

  const moverNear = x => level.movers.reduce((best, m) => !best || Math.abs(m.base.x - x) < Math.abs(best.base.x - x) ? m : best, null);
  const lift2 = moverNear((LIFT2.x0 + LIFT2.x1) / 2), ferry = moverNear((FERRY.x0 + FERRY.x1) / 2);
  const moverAt = (m, t) => m.amp * Math.sin(m.speed * t + m.phase); // offset along its axis
  const padOn = (pad, t) => ((t / PHASE.cycle + pad.phase) % 1) < PHASE.share;
  const padOnThrough = (pad, t0, t1) => { for (let t = t0; t <= t1 + 1e-9; t += 0.05) if (!padOn(pad, t)) return false; return padOn(pad, t1); };
  /** A crusher is passable from t0 to t1 if it is never slamming or resting low in between. */
  const crusherClear = (cr, t0, t1) => { for (let t = t0; t <= t1 + 0.04; t += 0.04) { const f = ((t + cr.phase) % cr.cycle) / cr.cycle; if (f > 0.34 && f < 0.86) return false; } return true; };

  /**
   * One run of the course from the spawn (or `from`), right held throughout,
   * as two halves: `decide()` is what the pad does this step and `observe()`
   * records what the step did. `play` below steps the simulation between
   * them; a browser can press real keys between them instead.
   * `pump` holds X on every transition; `spin` (default on) spins at enemies,
   * boxes and checkpoints; `pop` (default on) presses Jump once in each east
   * hang; `grind` (default on) asks for the rail out of the rail pipe's east
   * hang, and `grind: 'early'` also holds the button up that pipe's wall until
   * it has parked one lip stall; `depth` adds a toward/away stick; `jumpInAt`
   * leaves the deck before that lip in a jump; `patient: false` walks into
   * every timed hazard without waiting; `balance: false` rides the rails on
   * the travel stick alone and `balance: 'neutral'` lets go of the stick for
   * the length of each rail; `heldBounce` takes the trampoline from further
   * back with Jump held as it lands; `stompTurtle` lands on the Mossback and
   * rises straight off its shell; `go: 'stick'` tells him to drop in off a
   * coping by letting the stick go and pressing it again instead of with
   * Jump, and `go: 'wait'` never tells him; `until` ends the run early.
   */
  const start = (opts = {}) => {
    const { pump = false, spin = true, pop = true, grind = true, until = () => false, seconds = 240, from = null, depth = 0,
      jumpInAt = null, patient = true, balance = true, heldBounce = false, stompTurtle = false, trace = false, traceX = null, ride = false, go = 'jump' } = opts;
    level.reset(true);
    p.respawn(level, true);
    if (from) { p.pos.set(from[0], from[1], 0); p.prevPos.copy(p.pos); }
    const log = { mounts: [], perches: [], hangs: [], stalls: [], exits: new Map(), transfers: new Map(), kills: [], waits: new Map(),
      switchAt: null, grinds: [], maxZ: 0, deaths: 0, bails: 0, grabs: 0, finished: false, t: 0, checkpoints: 0,
      respawns: [], masksSpent: 0, firstEastReach: new Map(), eastmostBeforeSwitch: -Infinity, trouble: [], maxHeadingZ: 0,
      peak: new Map(), bounces: [], rides: [], cratesBroken: 0, topSpeed: new Map(), minY: Infinity, maxY: -Infinity,
      stairs: new Set(), pads: new Set(), stomps: [] };
    let jump = 0, jumpFrames = 14, stuck = 0, lastX = p.pos.x, spinWas = false, spinAge = 0, grindWas = false, grindAge = 0, hang = 0, heldWas = false;
    let perched = 0;
    let prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks, stall: false, perch: false, pipe: false,
      x: p.pos.x, surface: p.surfaceName, grounded: p.grounded, crates: level.crates.filter(c => c.alive).length, vV: 0 };
    const alive = new Map(level.enemies.map(e => [e, e.alive]));
    const swing = new Map(); // pipe -> { side, peak } for the wall currently being climbed
    const wait = (name) => log.waits.set(name, (log.waits.get(name) ?? 0) + dt);
    const startJump = (frames = 14) => { jump = 1; jumpFrames = frames; };
    const committed = new Set(); // brinks the bot has already decided to cross
    let turtleWas = null, straightUp = false, exitAir = false, hungWas = false;
    let frame = 0, shown = { standing: false, moveX: 1 };
    /** What the pad does this step, from what the player can see now. */
    const decide = () => {
      const i = frame;
      log.t = i * dt;
      const x = p.pos.x, y = p.pos.y, onFoot = !p.freeSkate, at = pipeAt(x), now = level.time;
      const walking = onFoot && p.grounded && p.state === 'ride';
      let moveX = 1, standing = false;
      // The air out of a pipe lands on the board, like any other air. The course between the pipes is walked,
      // so the bot gets off the way a player does: it lets go on the way down to each deck and holds the
      // brake there until it is on its feet (`ride: true` rides on instead).
      if (hungWas && !p.vertAir && p.state === 'air' && p.freeSkate) exitAir = true;          // carried out over a lip
      hungWas = p.vertAir;
      if (exitAir && (onFoot || p.vertAir || (p.grounded && p.groundHit?.halfpipe))) exitAir = false;
      const braking = !ride && exitAir && p.grounded;
      if (!ride && exitAir && (p.vVel < 0 || p.grounded)) moveX = 0;
      /** Stop short of `edge` until `ok()` says the crossing can be made from here, then commit to it. */
      const brink = (name, edge, ok) => {
        if (x < edge - 6 || x > edge - 0.05) { if (x > edge + 1) committed.delete(name); return; }
        if (committed.has(name)) return;
        if (x > edge - 3.9 && ok()) { committed.add(name); return; }
        if (x > edge - 3.9) { standing = true; wait(name); }
      };

      // (optional) leave the deck in a jump instead of walking over the coping
      if (jumpInAt !== null && walking && jump === 0 && x > jumpInAt - 3.2 && x < jumpInAt - 1.4) startJump();
      const edge = edges.find(a => x < a && a - x < 2.4);
      const stepUp = steps.find(s => x < s.x && s.x - x < 2.2 && Math.abs(y - s.below) < 0.3);
      if ((edge !== undefined || stepUp) && walking && jump === 0) startJump();
      // the trampoline is jumped ONTO: a walker is simply carried across it
      const net = heldBounce ? TRAMPOLINE.x0 - 3.4 : TRAMPOLINE.x0 - 1.0; // (the held bounce needs the west half of the net to clear the perch's edge)
      if (walking && jump === 0 && Math.abs(y - TRAMPOLINE.top) < 0.3 && x > net - 0.6 && x < net) startJump(3);
      // a Mossback is jumped over (a spin leaves its shell standing in the lane) — or, to use it, landed on
      const turtle = level.enemies.find(e => e.alive && e.kind === 'turtle' && Math.abs(e.group.position.y - y) < 1.5);
      if (turtle && walking && jump === 0) {
        const tx = turtle.group.position.x, d = tx - x;
        // (over it: a tapped jump is above its shell from 0.8 m to 4.5 m after take-off, so it is thrown to
        // put the Mossback — wherever it will have walked to — under the middle of that)
        if (!stompTurtle) { if (Math.abs(tx + (tx - (turtleWas ?? tx)) / dt * 0.35 - (x + 0.45 + 2.65)) < 0.35) startJump(3); }
        else if (Math.abs(tx + (tx - (turtleWas ?? tx)) / dt * 0.66 - (x + 0.45 + TAP_JUMP)) < 0.2) startJump(3);
        turtleWas = tx;
      }

      if (patient && walking) {
        const v = Math.max(0, p.speed);
        // LIFT over a drop: step on while its deck is at or under the bank, then lean on the far wall
        const onLift2 = p.surfaceName === 'moving platform' && inside(x, LIFT2.x0 - 0.3, LIFT2.x1 + 0.3);
        if (!onLift2 && Math.abs(y - LIFT2.low) < 0.3) brink('second lift', LIFT2.x0, () => {
          const ta = now + eta(LIFT2.x0 - x, v), deck = t => lift2.base.y + 0.25 + moverAt(lift2, t) - LIFT2.low;
          return deck(ta) < 0.02 && deck(ta + 0.3) < 0.02 && deck(ta) > -0.45;
        });
        // FERRY: wait for it at the near bank, stand toward its bow, step off at the far bank
        const onFerry = p.surfaceName === 'moving platform' && inside(x, FERRY.x0, FERRY.x1) && Math.abs(y - FERRY.top) < 0.4;
        if (!onFerry && Math.abs(y - FERRY.top) < 0.3) brink('ferry', FERRY.x0, () => {
          const ta = now + eta(FERRY.x0 - x, v), gap = t => (ferry.base.x + moverAt(ferry, t) - FERRY.width / 2) - FERRY.x0;
          return gap(ta) < 0.4 && gap(ta + 0.25) < 0.5;
        });
        if (onFerry) {
          const bow = t => ferry.base.x + moverAt(ferry, t) + FERRY.width / 2;
          if (!(FERRY.x1 - bow(now + 0.2) < 0.4 && FERRY.x1 - bow(now + 0.45) < 0.5)) {
            const spot = ferry.mesh.position.x + FERRY.width / 2 - 0.7; moveX = x < spot - 0.15 ? 1 : x > spot + 0.15 ? -1 : 0; standing = moveX === 0;
          }
        }
        // TIMED PADS: step on only when the pad will hold for the crossing (and the next one for the landing)
        if (Math.abs(y - LIFT2.low) < 0.3) {
          const debut = PHASE_DEBUT, first = PHASE_PAIR[0], second = PHASE_PAIR[1];
          brink('timed pad', debut.x0, () => padOnThrough(debut, now + eta(debut.x0 - x, v) - 0.05, now + eta(debut.x1 - x, v) + 0.2));
          brink('timed pair', first.x0 - 0.5, () => {
            const takeoff = now + eta(first.x1 - 0.45 - x, v);
            return padOnThrough(first, now + eta(first.x0 - x, v) - 0.05, takeoff + 0.1) && padOnThrough(second, takeoff + 0.45, takeoff + 1.1);
          });
          // the hop between the pair, thrown short so it lands mid-pad
          if (jump === 0 && x > first.x1 - 1.0 && x < first.x1 - 0.4) startJump(3);
        }
        // CRUSHERS: go under while it hangs or has risen clear
        if (Math.abs(y - lab.GALLERY.top) < 0.3) level.crushers.forEach((cr, k) => {
          const west = cr.x - cr.w / 2, east = cr.x + cr.w / 2;
          brink(`crusher ${k + 1}`, west - 0.7, () => crusherClear(cr, now + eta(west - 0.6 - x, v), now + eta(east + 0.6 - x, v) + 0.1));
        });
        // WHIRLER: wait short of it while its blades are out
        const whirler = level.enemies.find(e => e.alive && e.kind === 'spinner' && Math.abs(e.group.position.y - y) < 1.5);
        if (whirler) brink('whirler', whirler.group.position.x - 2.2, () => {
          const reach = eta(whirler.group.position.x - 1.2 - x, v);
          const left = whirler.state === 'in' ? 1.35 - whirler.stateT : -(2.2 - whirler.stateT); // seconds of "in" left, or minus the wait for it
          return left > reach + 0.15 || (left < 0 && -left < reach - 0.05 && -left + 1.35 > reach + 0.15);
        });
      }
      if (standing || (straightUp && !p.grounded)) moveX = 0;
      // AT A LIP he walked up to he is on his board, tail on the coping, waiting. The stick that brought him
      // there asks for nothing; Jump tells him to go (or the stick let go and pressed again).
      perched = p.dropInPerch && p.dropInTipT < 0 ? perched + 1 : 0;
      if (go === 'stick' && perched >= 6 && perched < 12) moveX = 0;
      // THE LONG RAIL: let go of the travel stick and keep the needle in the middle
      // (the stick held at the catch is the travel stick and tips nothing until it is let go)
      grindAge = p.state === 'grind' ? grindAge + 1 : 0;
      if (balance === 'neutral' && grindAge > 0) moveX = 0;
      else if (balance && grindAge > 0) { const lead = p.balance + p.balanceVel * 0.12; moveX = grindAge < 4 || Math.abs(lead) < 0.05 ? 0 : -Math.sign(lead); }
      // a Watcher hovers over a walker's head: a jump-spin takes it
      const watcher = spin && level.enemies.find(e => e.alive && e.kind === 'floater' && e.group.position.x - x < 2.4 && e.group.position.x - x > 1.2 &&
        Math.abs(e.group.position.y - y) < 2.5);
      if (watcher && walking && jump === 0) startJump(3);
      const input = { moveX, moveY: depth, grabHeld: braking };

      stuck = walking && !standing && moveX !== 0 && Math.abs(x - lastX) < 0.002 ? stuck + 1 : 0;
      const liftShaft = inside(x, LIFT1.x0 - 0.6, LIFT1.x1 + 0.3) || inside(x, LIFT2.x0 - 0.6, LIFT2.x1 + 0.3);
      if (stuck > 15 && jump === 0 && !liftShaft) startJump(); // a box in the lane: hop it
      let held = false;
      if (jump > 0) { jump++; held = jump <= jumpFrames; if (jump > 40) jump = 0; }
      if (pump && p.freeSkate && p.grounded && p.groundHit?.halfpipe) held = true;
      // (held from the top of the jump onto the net, and kept held up the bounce: letting go cuts a rise short)
      if (heldBounce && p.state === 'air' && (log.bounces.length ? log.bounces.length === 1 && p.vVel > 0
        : p.vVel < 0 && inside(x, TRAMPOLINE.x0 - 1, TRAMPOLINE.x1))) held = true;
      // POP OUT: one Jump in each east hang, right still held — the spine transfer's input
      hang = pop && p.vertAir && at && x > at.cross ? hang + 1 : 0;
      if (hang >= 3 && hang < 7) held = true;
      if (go === 'jump' && perched >= 6 && perched < 9) held = true;
      input.jumpHeld = held; input.jumpPressed = held && !heldWas; input.jumpReleased = !held && heldWas; heldWas = held;
      const foe = spin && level.enemies.find(e => e.alive && e.kind !== 'turtle' && (e.kind !== 'spinner' || e.state === 'in') &&
        Math.abs(e.group.position.x - x) < (p.freeSkate ? 5.5 : 2.6) && Math.abs(e.group.position.y - y) < 2.5);
      const post = spin && onFoot && level.checkpoints.find(c => !c.active && Math.abs(c.mesh.position.x - x) < 1.6 &&
        Math.abs(c.mesh.position.y - y) < 2);
      // a box standing in the lane of an on-foot floor: spin through it, as a player does
      const box = spin && onFoot && level.crates.find(c => c.alive && !c.pending && !c.bang &&
        c.mesh.position.x > x && c.mesh.position.x - x < 1.7 && Math.abs(c.mesh.position.y - y) < 2.4);
      const wantSpin = !!(foe || post || box);
      // (a spin is pressed again while something is still in reach: a stack's cap drops into the lane)
      spinAge = wantSpin ? spinAge + 1 : 0;
      input.spinHeld = wantSpin; input.spinPressed = wantSpin && (!spinWas || spinAge % 27 === 0); spinWas = wantSpin;
      const wantGrind = (grind && p.state === 'air' && RAILS.some(([q, rail]) => Math.abs(x - q.eastLip) < 1 && y > rail.y0 - 1.9)) ||
        (grind === 'early' && log.stalls.length === 0 && p.freeSkate && at === RAIL_PIPE);
      input.grindHeld = wantGrind || p.state === 'grind'; input.grindPressed = wantGrind && !grindWas; grindWas = wantGrind;
      // (right stays held on the rail too: on a side-on line the stick held at the catch is not a lean)
      lastX = x;
      shown = { standing, moveX };
      return input;
    };
    /** Record what that step did. Returns true when the run is over. */
    const observe = () => {
      const i = frame++, { standing, moveX } = shown;
      const here = pipeAt(p.pos.x);
      log.maxZ = Math.max(log.maxZ, Math.abs(p.pos.z));
      log.minY = Math.min(log.minY, p.pos.y); log.maxY = Math.max(log.maxY, p.pos.y);
      if (p.freeSkate && p.grounded && p.groundHit?.halfpipe) log.maxHeadingZ = Math.max(log.maxHeadingZ, Math.abs(p.axisF.z));
      // on his board at a coping he came to on foot, and then on the wall under it
      if (p.dropInPerch && !prev.perch) log.perches.push({ pipe: here?.name, x: p.pos.x, y: p.pos.y, t: log.t, fromFoot: !prev.free, arrived: (p.pos.x - prev.x) / dt, waited: 0 });
      if (p.dropInPerch && log.perches.length) log.perches.at(-1).waited += dt;
      if (p.freeSkate && p.grounded && p.groundHit?.halfpipe && !prev.pipe && (prev.perch || !prev.free))
        log.mounts.push({ pipe: here?.name, x: p.pos.x, y: p.pos.y, speed: p.speed, fromPerch: prev.perch });
      if (p.vertAir && !prev.vert && here)
        log.hangs.push({ pipe: here.name, side: p.pos.x < here.cross ? 'west' : 'east', vV: p.vVel, t: log.t });
      if (p.vertAir && here) log.peak.set(here.name, Math.max(log.peak.get(here.name) ?? -Infinity, p.pos.y));
      if (here && p.freeSkate && p.grounded && Math.abs(p.pos.x - here.cross) < here.flatHalf)
        log.topSpeed.set(here.name, Math.max(log.topSpeed.get(here.name) ?? 0, Math.abs(p.speed)));
      // (a wait at a coping is held on the lip stall's own fields, and is not one)
      const stalled = p.lipStallT > 0 && !p.dropInPerch;
      if (stalled && !prev.stall && here) log.stalls.push({ pipe: here.name, side: p.pos.x < here.cross ? 'west' : 'east', t: log.t });
      if (!stalled && prev.stall && log.stalls.length) Object.assign(log.stalls.at(-1), { seconds: log.t - log.stalls.at(-1).t,
        backInPipe: !p.isBailing && here !== null && p.pos.x > here.westLip && p.pos.x < here.eastLip });
      // the first touchdown past each decked pipe's east lip: it is on the board, like any landing...
      for (const q of [...DECKED, SWITCH_PIPE]) if (!log.exits.has(q.name) && p.grounded && p.state === 'ride' && !p.groundHit?.halfpipe &&
        p.pos.x > q.eastLip + 0.05 && p.pos.x < q.eastLip + 9 && Math.abs(p.pos.y - q.eastLipY) < 0.5)
        log.exits.set(q.name, { onBoard: p.freeSkate, onFoot: false, x: p.pos.x, t: log.t, speed: Math.abs(p.speed) });
      // ...and he is on foot once he has got off it there (the brake, or the roll running out), not before
      for (const out of log.exits.values()) if (!out.onFoot && log.t - out.t < 4 && p.grounded && !p.freeSkate) { out.onFoot = true; out.offAfter = log.t - out.t; out.offAt = p.pos.x; }
      // highest point reached on each wall, per swing (first east reach is the pump claim)
      if (here && p.grounded && p.groundHit?.halfpipe && Math.abs(p.pos.x - here.cross) > here.flatHalf) {
        const side = p.pos.x < here.cross ? 'west' : 'east';
        const s = swing.get(here.name);
        if (!s || s.side !== side) {
          if (s && s.side === 'east' && !log.firstEastReach.has(here.name)) log.firstEastReach.set(here.name, s.peak);
          swing.set(here.name, { side, peak: p.pos.y });
        } else s.peak = Math.max(s.peak, p.pos.y);
      }
      // a ridge crossed in the air, into the pipe behind it
      for (const [a, b] of RIDGES) if (!log.transfers.has(a.name) && prev.x <= a.eastLip + 0.05 && p.pos.x > a.eastLip + 0.05 && p.pos.y > b.floorY + 0.5)
        log.transfers.set(a.name, { t: log.t, y: p.pos.y, into: b.name });
      for (const e of level.enemies) { if (alive.get(e) && !e.alive) log.kills.push({ kind: e.kind, onBoard: p.freeSkate, x: p.pos.x, t: log.t }); alive.set(e, e.alive); }
      const crates = level.crates.filter(c => c.alive).length;
      if (crates < prev.crates) log.cratesBroken += prev.crates - crates;
      if (p.surfaceName === 'moving platform' && prev.surface !== 'moving platform' && p.grounded) log.rides.push({ x: p.pos.x, y: p.pos.y, t: log.t });
      if (p.grounded && p.surfaceName === 'crumble pad') CRUMBLE_STAIRS.forEach((pad, k) => { if (inside(p.pos.x, pad.x0, pad.x1)) log.stairs.add(k); });
      if (p.grounded && p.surfaceName === 'phase pad') [PHASE_DEBUT, ...PHASE_PAIR].forEach((pad, k) => { if (inside(p.pos.x, pad.x0, pad.x1)) log.pads.add(k); });
      // a bounce off an enemy's back (the Mossback's shell is the tall one)
      if (!p.freeSkate && p.vVel > 10 && prev.vV < -1 && !inside(p.pos.x, TRAMPOLINE.x0, TRAMPOLINE.x1)) {
        const under = level.enemies.find(e => Math.abs(e.group.position.x - p.pos.x) < 1.6 && Math.abs(e.group.position.y - p.pos.y) < 2.5);
        if (under) { log.stomps.push({ kind: under.kind, x: p.pos.x, vV: p.vVel, t: log.t }); if (stompTurtle && under.kind === 'turtle') straightUp = true; }
      }
      if (p.grounded) straightUp = false;
      if (!p.freeSkate && p.vVel > 15 && prev.vV < -1 && inside(p.pos.x, TRAMPOLINE.x0, TRAMPOLINE.x1)) log.bounces.push({ x: p.pos.x, vV: p.vVel, t: log.t });
      if (log.switchAt === null && level.crates.some(c => c.bang && c.bangUsed)) log.switchAt = { t: log.t, x: p.pos.x, y: p.pos.y, vert: p.vertAir || prev.vert };
      if (log.switchAt === null && here === SWITCH_PIPE) log.eastmostBeforeSwitch = Math.max(log.eastmostBeforeSwitch, p.pos.x);
      if (p.state === 'grind' && prev.state !== 'grind') log.grinds.push({ t: log.t, x: p.pos.x, y: p.pos.y, lean: 0 });
      if (p.state === 'grind') Object.assign(log.grinds.at(-1), { lean: Math.max(log.grinds.at(-1).lean, Math.abs(p.balance)), needle: p.balance });
      if (prev.state === 'grind' && p.state !== 'grind' && log.grinds.length)
        Object.assign(log.grinds.at(-1), { endX: p.pos.x, speed: Math.abs(p.speed), bailed: p.isBailing, seconds: log.t - log.grinds.at(-1).t, exitSpin: 0, flying: true });
      // the air off the rail's end: how far the board is turned in it (radians)
      const off = log.grinds.at(-1);
      if (off?.flying) { if (p.state === 'air') off.exitSpin = Math.max(off.exitSpin, Math.abs(p.grabSpinAngle)); else off.flying = false; }
      if (p.state === 'hang' && prev.state !== 'hang') { log.grabs++; log.trouble.push(`ledge grab at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} t ${log.t.toFixed(1)}`); }
      if (p.isBailing && !prev.bail) { log.bails++; log.trouble.push(`bailed at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} t ${log.t.toFixed(1)}`); }
      if (p.masks < prev.masks) log.masksSpent++;
      log.checkpoints = level.checkpoints.filter(c => c.active).length;
      if (p.totalDeaths > prev.deaths) { log.deaths++; log.trouble.push(`died at x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} t ${log.t.toFixed(1)}`); }
      if (prev.state === 'dead' && p.state !== 'dead') log.respawns.push({ x: p.pos.x, y: p.pos.y });
      if (trace && (!traceX || (p.pos.x > traceX[0] && p.pos.x < traceX[1])) && (i % trace === 0 || p.state !== prev.state || p.freeSkate !== prev.free))
        console.log(`## t${log.t.toFixed(2)} x${p.pos.x.toFixed(2)} y${p.pos.y.toFixed(2)} v${p.speed.toFixed(1)} vV${p.vVel.toFixed(1)} ${p.state}/${p.freeSkate ? 'board' : 'foot'}/${p.grounded ? 'gnd' : 'air'}${p.vertAir ? '/vert' : ''}${standing ? '/WAIT' : ''} ${p.surfaceName}${p.state === 'grind' ? ` bal ${p.balance.toFixed(2)} stick ${moveX}` : ''} lt${level.time.toFixed(2)}`);
      prev = { free: p.freeSkate, vert: p.vertAir, bail: p.isBailing, state: p.state, deaths: p.totalDeaths, masks: p.masks, stall: stalled,
        perch: p.dropInPerch, pipe: p.grounded && !!p.groundHit?.halfpipe,
        x: p.pos.x, surface: p.surfaceName, grounded: p.grounded, crates, vV: p.vVel };
      if (p.state === 'finished') { log.finished = true; return true; }
      return !!until(log, p);
    };
    return { log, decide, observe, steps: Math.round(seconds / dt) };
  };
  /** A whole run, headless: decide, step the real Player and Level, observe. Returns the log. */
  const play = (opts = {}) => {
    const run = start(opts);
    for (let i = 0; i < run.steps; i++) {
      const pad = run.decide();
      const input = Object.assign(makeInput({ moveX: pad.moveX, moveY: pad.moveY }), pad);
      // The drawn drop-in is advanced where the game advances it: after each step.
      p.step(dt, input, level); level.update(dt); p.stepDropInPresentation(); input.consumeEdges();
      if (run.observe()) break;
    }
    return run.log;
  };
  return { play, start, PIPES, DECKED, RIDGES, pipeAt, steps, floors, gaps, edges };
}
