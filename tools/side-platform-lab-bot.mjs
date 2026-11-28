// A scripted player for Side Platform Lab (src/levels/side-platform-lab.ts): one controller per
// station, each doing what a person would at that object and timing it off the object's own live
// state (a swing's angle, a deck's place, a head's breath, a turret's wind-up), never off a clock
// of its own.
//
//   const bot = makeLabBot({ p, level, lab, CONST, makeInput });
//   const log = bot.play({ station: 'swings' });   // from that station's checkpoint to its end
//   const log = bot.play();                         // the whole course, spawn to gate
//
// Options: `warm` (seconds the level's clock runs on first, so everything that moves is met at
// another point of its round), `naive` (hold right and nothing else), `plain` (the finale without
// its side routes), `seconds`, `trace`, `carryOn` (play on after a death).
//
// A log has: ok, reached (furthest x), goal, died (a list), bails, seconds, finished, facts (what
// the controllers measured on the way), evidence (station id -> what the game's own state shows
// was done there: boxes broken, foes beaten, grinds, swings, swims, doors gone through), and
// visited (station id -> { t0, t1 }).
//
// The moves, as the game has them: a jump leaves the ground when Jump is LET GO (a tap is two
// frames; a full jump is held 24, which is 3.6 m of run); with the stick held, Jump held for half
// a second from his feet is the push-off onto the board, so a hop from a standstill is made with
// the stick let go; Jump again in the air is the double jump; Spin breaks boxes and enemies; Grind
// catches a rail or a rope within 2.1 m; on the board, Spin in the air is a deck trick (stick at
// rest: kickflip; stick right: heelflip), and the stick left or right in the air SPINS him.

const BREAKS = c => c.alive && !c.pending && !c.tnt && !c.nitro && !c.metal && !c.metalBounce && !c.bouncy && !c.bang && !c.nitroBang;
const EXPLODES = c => c.alive && (c.tnt || c.nitro);

export function makeLabBot({ p, level, lab, CONST, makeInput }) {
  const DT = CONST.fixedStep;
  const S = Object.fromEntries(lab.STATIONS.map(s => [s.id, s]));
  const stationAt = x => lab.STATIONS.find(s => x >= s.x0 && x < s.x1) ?? null;
  const byX = (list, x, pos) => list.reduce((best, o) => (best === null || Math.abs(pos(o) - x) < Math.abs(pos(best) - x) ? o : best), null);
  const moverNear = x => byX(level.movers, x, o => o.base.x);
  const moversNear = (x, within) => level.movers.filter(o => Math.abs(o.base.x - x) < within);
  const swingNear = x => byX(level.ropeSwings, x, o => o.travel ? (o.travel.base?.x ?? o.anchor.x) : o.anchor.x);
  const pendulumNear = x => byX(level.pendulums, x, o => o.pivot.position.x);
  const stoneNear = x => byX(level.stones, x, o => (o.axis === 'x' ? ((o.x0 ?? 0) + (o.x1 ?? 0)) / 2 : o.x));
  const tikiNear = x => byX(level.fireTikis, x, o => o.group.position.x);
  const bridgeNear = x => byX(level.spinBridges, x, o => o.pivot.position.x);
  const enemyNear = (x, kind) => byX(level.enemies.filter(e => e.kind === kind), x, o => o.homeX ?? o.group.position.x);
  const crateNear = (x, test = () => true) => byX(level.crates.filter(test), x, o => (o.box.min.x + o.box.max.x) / 2);
  const scratch = p.pos.clone();
  const deckTop = mover => { const box = mover.mesh.geometry.boundingBox ?? (mover.mesh.geometry.computeBoundingBox(), mover.mesh.geometry.boundingBox); return mover.mesh.position.y + box.max.y; };

  /** One fixed step, in the order the game's own loop takes it. (The last call is where a rope bridge learns
   *  who is standing on it: left out, every bridge is a rigid floor.) */
  const tick = input => { p.step(DT, input, level); level.update(DT); p.flushLevelCrateRewards(level); p.commitRenderStep(level); };

  function play(opts = {}) {
    const { station = null, from = null, seconds = station ? 70 : 600, until = null, trace = false, skip = () => false } = opts;
    level.reset(true);
    // (the level's clock runs on through a reset, and everything that moves is a function of it: it is put
    // back to zero here so that a run meets the same course whatever was played before it)
    level.time = 0;
    const first = station ? S[station] : null;
    // (`onward`: from that station's checkpoint on to the gate)
    const goal = opts.goal ?? (first && !opts.onward ? first.x1 - 0.6 : lab.STATIONS.at(-1).marks.gate + 0.5);
    if (from) p.respawn(level, true, false, { position: p.pos.clone().set(from[0], from[1], 0), heading: p.pos.clone().set(1, 0, 0) });
    else if (first) p.respawn(level, true, false, { position: p.pos.clone().set(first.checkpoints[0][0] + 1.3, first.checkpoints[0][1] + 0.15, 0), heading: p.pos.clone().set(1, 0, 0) });
    else p.respawn(level, true);
    const idle = makeInput();
    // (`warm` lets the level's clock run on first, so that everything that moves is met at another point of its round)
    for (let i = 0; i < 20 + Math.round((opts.warm ?? 0) * 60); i++) tick(idle);

    const log = { ok: false, reached: p.pos.x, goal, died: [], bails: 0, seconds: 0, facts: {}, evidence: {}, visited: new Map(), finished: false, maxZ: 0, events: [] };
    const was = { jump: false, spin: false, grab: false, grind: false };
    let k = 0, jumpUntil = -1, hopUntil = -1, spinUntil = -1, spinGap = 0, blocked = 0, lastX = p.pos.x, memoFor = null, m = {}, prevState = p.state, prevBail = false, stationT0 = 0;
    // what a controller may ask for
    const api = {
      get k() { return k; }, get t() { return k * DT; },
      /** Hold Jump for `frames` from now (it is let go after them: that is when a jump leaves the ground).
       *  Asked for again on the frames that follow, it is one press and not a hold: it is not pressed again for a fifth of a second. */
      jump(frames = 2) { if (jumpUntil < k - 12) jumpUntil = k + frames; },
      jumping: () => jumpUntil >= k,
      /** A list of jumps along the line, each taken once when its x is reached on the ground. */
      plan(list) { m.plan ??= 0; while (m.plan < list.length && p.pos.x > list[m.plan].x + 1.5) m.plan++;
        const next = list[m.plan]; if (next && p.pos.x >= next.x && p.grounded && jumpUntil < k) { jumpUntil = k + next.hold; m.plan++; m.double = next.double ? k : -1;
          if (Math.abs(p.speed) < 1.5) hopUntil = k + next.hold + 2; } }, // (from a standstill the stick is let go for the press)
      spin(frames = 4) { if (spinUntil < k && spinGap <= 0) { spinUntil = k + frames; spinGap = 14; } },
      /** A jump from a standstill. (With the stick held, Jump there is the push-off onto the board: the stick is let go for it.) */
      hop(frames = 3) { if (jumpUntil < k && hopUntil < k - 20) { jumpUntil = k + frames; hopUntil = k + frames + 2; } },
      fact(key, value) { log.facts[key] = value; },
      note(text) { log.events.push(`t${(k * DT).toFixed(2)} x${p.pos.x.toFixed(1)} ${text}`); },
      S, level,
    };
    const tap = x => ({ x, hold: 2 }), full = x => ({ x: x - 3.6, hold: 24 });

    // ---- the controllers: (station, a = its x0, t = its floor height) -> what to hold this step -------
    const run = () => ({ moveX: 1 });
    /** Onto the board from his feet: Jump held with a direction until the board is under him (it is the hold that mounts, not the release). */
    const mount = () => ({ moveX: 1, jump: true, mounting: true });
    /** Stand at `x` (within a hand's breadth), facing east. */
    const standAt = x => ({ moveX: p.pos.x < x - 0.25 ? (p.pos.x < x - 1.2 ? 1 : 0.45) : p.pos.x > x + 0.35 ? -0.45 : 0 });
    const C = {
      ramps: s => { api.plan([tap(s.marks.kicker - 0.8)]); return run(); },
      terrain: run,
      timber: run,
      rocks: s => { const a = s.x0; api.plan([tap(a + 8.6), tap(a + 15.8), tap(a + 19.6), tap(a + 23.0), full(a + 38.1), tap(a + 46.4)]); return run(); },
      ice: s => { api.plan([tap(s.marks.brink - 1.2)]); return run(); },
      sand: run,
      water: s => { api.plan([tap(s.marks.lethal - 0.9)]); return run(); },

      // empty boxes and the five-hit box are spun through; a hop at the wall comes down on the arrow;
      // the steel is climbed a step at a time; the steel arrow is landed on with Jump held
      arrows: s => {
        const shelf = s.top + 4.6, high = s.endTop, M = s.marks;
        if (p.pos.y < shelf - 0.4 && p.pos.x < M.wall1) { api.plan([tap(M.arrow - 3.1)]); return run(); }
        if (p.pos.x >= M.wall2 - 0.2 && p.pos.y > high - 0.3) return run();
        if (p.pos.x < M.steelArrow - 3.3 && !m.leapt) { api.plan([tap(M.arrow - 3.1), tap(M.steel - 3.4), tap(M.block - 2.5)]); return run(); }
        if (p.grounded && p.pos.y < shelf + 0.3 && !m.leapt && p.pos.x >= M.steelArrow - 3.1) { api.jump(2); m.leapt = k; return run(); }
        // in the air toward the steel arrow: Jump pressed at the top of the hop (the double jump) and HELD
        // onto the arrow and through the rise it gives
        if (m.leapt && !m.launched) { if ((!p.grounded && p.vVel < 1.5 && k - m.leapt > 8) || m.holding) { m.holding = true; jumpUntil = k + 2; } if (p.vVel > 15) { m.launched = k; api.fact('steelArrowLaunch', +p.vVel.toFixed(1)); } }
        else if (m.launched && p.vVel > 0) jumpUntil = k + 2;
        if (m.leapt && !m.launched && k - m.leapt > 150 && p.grounded && p.pos.y < shelf + 0.3) { m.leapt = 0; m.holding = false; } // missed it: again
        return run();
      },

      // the mask is spun; the TNT is jumped ONTO over the boxes beside it, and left; the lone nitro is
      // jumped; the green ! is spun, and only then is the way under the roof open
      explosives: s => {
        const tnt = crateNear(s.marks.tnt, c => c.tnt), M = s.marks;
        if (p.pos.x < M.tnt + 5) {
          // (a running tap comes down on a lid 4.6 m on: over the two boxes this side of it, onto the TNT)
          if (tnt && tnt.alive) { api.plan([tap(M.tnt - 5.05)]); return run(); }
          return run();
        }
        if (tnt && tnt.alive) return standAt(M.tnt + 8); // lit, and it has three seconds: wait well clear
        api.fact('tntCleared', level.crates.filter(c => !c.alive && Math.abs((c.box.min.x + c.box.max.x) / 2 - M.tnt) < 2.6).length);
        // (the top of a tap is 3.35 m after it leaves the ground: it is put over the nitro)
        api.plan([tap(M.tnt - 5.05), tap(M.nitro - 3.8)]);
        const under = crateNear(M.nitro2, c => c.nitro);
        if (under && under.alive) {
          if (p.pos.x > M.green - 1.7 && p.pos.x < M.green) { api.spin(); return standAt(M.green - 1.0); }
          if (p.pos.x >= M.green) return standAt(M.green + 1.5);
          return run();
        }
        if (!m.cleared) { m.cleared = true; api.fact('nitrosLeft', level.crates.filter(c => c.nitro && c.alive).length); }
        // (the green ! is steel: it stays, and is hopped)
        if (p.grounded && p.pos.x > M.green - 2.9 && p.pos.x < M.green - 2.2) api.jump(2);
        return run();
      },

      // stand at the leaf, spin, wait for it to lie down
      spinbridge: s => {
        for (const hinge of [s.marks.hinge1, s.marks.hinge2]) {
          const bridge = bridgeNear(hinge);
          if (bridge.deployed) api.fact(hinge === s.marks.hinge1 ? 'leaf1Down' : 'leaf2Down', true);
          if (p.pos.x < hinge + 0.2 && !bridge.deployed) {
            if (p.pos.x > hinge - 1.5) { if (bridge.state === 'closed') api.spin(); return standAt(hinge - 0.9); }
            return run();
          }
        }
        return run();
      },
      // (run across: what is recorded is how far each deck gave under him, and how many rotten boards went)
      ropebridge: s => {
        const M = s.marks, dip = s.top - p.pos.y;
        if (p.grounded && p.pos.x > M.span1 && p.pos.x < M.pier) api.fact('sag1', Math.max(log.facts.sag1 ?? 0, +dip.toFixed(2)));
        if (p.grounded && p.pos.x > M.span2 && p.pos.x < M.far) api.fact('sag2', Math.max(log.facts.sag2 ?? 0, +dip.toFixed(2)));
        api.fact('rottenShaken', level.crumbles.filter(c => c.state !== 'idle' && c.base.x > s.x0 && c.base.x < s.x1).length);
        return run();
      },

      // the first net is walked onto and stood on (it gives under him), then hopped on from a standstill: he
      // comes down on it and is thrown, and steers off it. The second is jumped onto from the brink with Jump
      // pressed again in the air and HELD: the landing with it held is the high bounce, and the stick carries
      // him over the wall's top onto the shelf.
      trampoline: s => {
        const M = s.marks, x = p.pos.x, nets = level.groundMeshes.filter(g => g.userData.ropeNet && g.position.x > s.x0 && g.position.x < s.x1).sort((g, h) => g.position.x - h.position.x);
        api.fact('nets', nets.length);
        if (nets[0]) api.fact('sag', Math.max(log.facts.sag ?? 0, +nets[0].userData.ropeNet.weightDepth.toFixed(2)));
        if (p.trampolineAir && m.launch !== p.trampolineLaunchId) { m.launch = p.trampolineLaunchId; (m.bounces ??= []).push(+p.trampolineLaunchSpeed.toFixed(1)); api.fact('bounces', m.bounces.join(',')); }
        if (x < M.net1End && !m.hopped) {
          const mid = (M.net1 + M.net1End) / 2;
          if (Math.abs(x - mid) > 0.5 || !p.grounded) return standAt(mid);
          m.stood = (m.stood ?? 0) + 1;
          if (m.stood > 45) { api.hop(3); m.hopped = k; }
          return { moveX: 0 };
        }
        if (x < M.net1End + 0.5 && !(m.bounces?.length)) return { moveX: 0 }; // up from the hop, and down onto the net
        if (x < M.brink - 3) return run();
        if (x < M.brink + 0.5 && p.grounded && p.pos.y < s.top + 1) { api.plan([tap(M.brink - 0.9)]); return run(); }
        // in the air over the second net, and up from it
        if (!p.grounded && x > M.brink && p.pos.y < s.top + 5.2 && (p.vVel < -2 || m.holding || (m.bounces?.length ?? 0) >= 2)) { m.holding = true; jumpUntil = k + 2; }
        if (p.grounded && p.pos.y > s.top + 4.9) { m.holding = false; api.fact('shelf', true); }
        return run();
      },

      // wait short of the brink until the rope WILL be on the near side of straight down when he gets to it,
      // three quarters of a second on (a rope swings as the sine of the level's clock, so where it will be is
      // read off it: to the eye, it is jumped at as it swings toward him and has come most of the way back).
      // Let go at the east end of a swing. The travelling one is a ferry: it is jumped at when it will be 1 to
      // 3 m out as he gets to it, and let go of once it has carried him to within reach of the far floor.
      swings: s => {
        const M = s.marks, ropes = level.ropeSwings.filter(o => o.anchor.x > s.x0 - 12 && o.anchor.x < s.x1 + 12 || (o.travel && o.travel.base.x > s.x0 && o.travel.base.x < s.x1));
        const LEAD = 0.75; // from the word go, at rest 2.3 m short of the brink, to his chest meeting the rope
        const thetaIn = (rope, lead) => rope.amp * Math.sin((level.time + lead) * rope.speed + rope.phase);
        const anchorIn = (rope, lead) => rope.travel ? rope.travel.base.x + rope.travel.axisV.x * rope.travel.amp * Math.sin((level.time + lead) * rope.travel.speed + rope.travel.phase) : rope.anchor.x;
        if (p.state === 'rope') {
          const rope = ropes.reduce((best, o) => Math.abs(o.anchor.x - p.pos.x) < Math.abs(best.anchor.x - p.pos.x) ? o : best), i = ropes.indexOf(rope);
          const vx = p.pos.x - (m.ropeX ?? p.pos.x); m.ropeX = p.pos.x; m.hung = (m.hung ?? 0) + 1;
          const east = p.pos.x - rope.anchor.x;
          if (m.letGo > 0) { m.letGo--; return { moveX: 1 }; }
          const now = rope.travel ? p.pos.x > M.far3 - 5.8 : m.hung > 12 && east > 1.6 && (m.ropeVx ?? 0) > 0 && vx <= (m.ropeVx ?? 0) && vx < 0.04;
          if (now) { jumpUntil = k + 3; m.letGo = 8; api.note(`let go of rope ${i + 1}, ${east.toFixed(1)} m east of its anchor`); }
          m.ropeVx = vx; return { moveX: 0 };
        }
        m.hung = 0; m.ropeX = undefined; m.ropeVx = 0;
        if (!p.grounded) return run();
        for (const [i, [brink, far, rope]] of [[M.brink1, M.far1, ropes[0]], [M.brink2, M.far2, ropes[1]], [M.brink3, M.far3, ropes[3]]].entries()) {
          if (p.pos.x >= far - 0.5) continue;
          if (p.pos.y < s.top - 0.8) { m[`go${i}`] = false; if (p.pos.x > far - 1.2) api.hop(); return run(); } // down in the trench: out by its east end
          if (p.pos.x < brink - 2.6) return run();
          const meet = anchorIn(rope, LEAD) + 5 * Math.sin(thetaIn(rope, LEAD)) - brink; // where the rope will be, at chest height
          const ready = rope.travel ? meet > 1.2 && meet < 2.9 : thetaIn(rope, LEAD) < -0.22;
          if (p.pos.x < brink - 1.6) m[`leapt${i}`] = false;
          if (!m[`go${i}`]) { if (ready && Math.abs(p.speed) < 0.5 && p.pos.x > brink - 2.6) m[`go${i}`] = true; else return standAt(brink - 2.3); }
          if (p.pos.x >= brink - 0.95 && !m[`leapt${i}`]) { api.jump(2); m[`leapt${i}`] = true; }
          return run();
        }
        return run();
      },

      // the wheel is boarded at its west point and left at its east; the springboard is landed on from a
      // jump; the turntable is crossed as it lines up; the lift is ridden down
      decks: s => {
        const M = s.marks, a = s.x0, t = s.top;
        if (p.pos.x < a + 24.3 && p.pos.y > t - 5) {
          // (the wheel turns one way only: a deck comes over the top to the west point, dives past the
          // floor there, goes under, and rises past the far floor at the east point)
          const decks = moversNear(M.wheel, 1).filter(o => o.orbit), brink = a + 10;
          const mine = p.grounded ? decks.find(o => Math.abs(o.mesh.position.x - p.pos.x) < 2.2 && Math.abs(deckTop(o) - p.pos.y) < 0.45) ?? null : null;
          if (mine) { // riding: keep to its middle until it has come up level with the far floor
            if (!m.rodeWheel) { m.rodeWheel = true; api.note('on the wheel'); }
            m.wheelLow = Math.min(m.wheelLow ?? 0, deckTop(mine) - t); api.fact('wheelDip', +m.wheelLow.toFixed(2));
            if (mine.mesh.position.x > M.wheel + 4.4 && deckTop(mine) > t - 0.3) return run();
            return standAt(mine.mesh.position.x);
          }
          if (p.pos.x >= a + 23.7 || m.wheelGo) return run();
          // step on as a deck comes down level with the floor: it is a short step down by the time he is on it
          const coming = decks.find(o => o.mesh.position.x < M.wheel - 4.3 && deckTop(o) < t + 0.15 && deckTop(o) > t - 0.4);
          if (coming) { m.wheelGo = true; return run(); }
          return standAt(brink - 0.75);
        }
        if (p.pos.x < M.shelf && p.pos.y < t + 2.4) {
          const board = moverNear(M.spring), bx = board.mesh.position.x, bv = (bx - (m.bx ?? bx)) / DT; m.bx = bx;
          if (p.vVel > 13 && !m.sprung) { m.sprung = true; api.fact('springboardLaunch', +p.vVel.toFixed(1)); }
          if (!p.grounded) return run();
          if (Math.abs(deckTop(board) - p.pos.y) < 0.3 && Math.abs(bx - p.pos.x) < 1.9) { api.jump(2); return {}; } // stood on it: a hop, to come down on it from the air
          // a running tap leaves the ground 1.05 m after the press and comes down on a deck 0.8 m up 4.55 m after
          // that, 0.63 s in all: it is pressed when that is where the board will be
          const aligned = Math.abs(p.pos.x + 5.6 - (bx + bv * 0.63)) < 0.45;
          if (p.pos.y < t + 0.3 && Math.abs(p.speed) > 8.5 && aligned) { api.jump(2); return run(); }
          if (m.back || (p.pos.y < t + 0.3 && p.pos.x > bx - 4.4 && !api.jumping())) { m.back = p.pos.x > a + 27.5; return { moveX: -1 }; } // too near it for a run-up: round again
          return run();
        }
        if (p.pos.x < a + 65.2 && p.pos.y > t + 2) {
          const table = moverNear(M.turntable), brink = a + 55;
          if (p.pos.x > brink - 0.15) return run();
          // the plank is along the line when its turn is a multiple of half a turn
          const turn = ((table.mesh.rotation.y % Math.PI) + Math.PI) % Math.PI, toGo = Math.PI - turn, rate = Math.abs(table.spin ?? 20) * Math.PI / 180;
          const lined = toGo < rate * 1.0 && toGo > rate * 0.5;
          return lined ? run() : standAt(brink - 0.8);
        }
        const lift = moverNear(M.lift), top = deckTop(lift);
        if (p.pos.x < a + 81 && p.pos.x > a + 65) {
          const on = p.grounded && Math.abs(top - p.pos.y) < 0.4 && Math.abs(lift.mesh.position.x - p.pos.x) < 2.9;
          if (on) return top < t + 0.2 ? run() : standAt(M.lift);
          if (p.pos.y > t + 2 && p.pos.x < a + 75.2) return top > t + 2.85 ? run() : standAt(a + 74.2);
          return run();
        }
        return run();
      },

      // wait short of each pendulum until its bob has just crossed the line and is on its way out. The one
      // that swings ALONG the line is run under while it is up: he sets off half a second before its bob has
      // risen clear of his head (where it will be is read off the level's clock, as a swing is a sine of it)
      // ...and the first one's chain is caught on the way: he waits short of it for its ball to go by, stands
      // under its post, and jumps (a full charge) so as to be at the top of the jump a tenth of a second before
      // the chain next hangs straight down: the ball goes by under his feet, his chest meets the chain, he climbs
      // to the top of it for the fruit hung over it, and leaps off east.
      pendulums: s => {
        const first = pendulumNear(s.marks.first), X0 = s.marks.first;
        if (p.state === 'rope') {
          const chain = level.chainGrabs.includes(p.ropeObj);
          api.fact('chainHeld', chain);
          m.chainLow = Math.max(m.chainLow ?? 0, p.ropeD); m.chainTop = Math.min(m.chainTop ?? 99, p.ropeD);
          api.fact('chainClimbed', +(m.chainLow - m.chainTop).toFixed(2));
          // (the fruit hung over it: how much of it had come to him from the lowest hold, and how much has by now)
          const taken = level.pickups.filter(o => Math.abs(o.mesh.position.x - X0) < 1 && o.mesh.userData.baseY > s.top + 8 && (!o.alive || o.magnetOwner)).length;
          if (p.ropeD > m.chainLow - 0.05) api.fact('chainFruitFromBelow', taken);
          api.fact('chainFruit', taken);
          if (m.letGo > 0) { m.letGo--; return { moveX: 1 }; }
          if (p.ropeD > 1.02) return { moveY: 1 };
          // at the top: once round with it, for the fruit, then off
          m.onTop = (m.onTop ?? 0) + 1;
          if (m.onTop > Math.PI / first.speed / DT) { jumpUntil = k + 3; m.letGo = 8; m.chainDone = true; api.note('let go of the chain'); }
          return { moveX: 0 };
        }
        if (first.chain && !m.chainDone && p.pos.x < X0 + 1.2) {
          if (p.pos.x < X0 - 2.7) return run();
          if (!p.grounded) return { moveX: 0 };
          // seconds until its chain next hangs straight down (a swing is a sine of the level's clock)
          const phase = level.time * first.speed + first.phase, next = (Math.ceil(phase / Math.PI - 1e-9) * Math.PI - phase) / first.speed;
          const half = Math.PI / first.speed;
          // (its ball is on the line for a fifth of a second either side of that: he goes under once it has gone
          // by, with two seconds in hand, and is off the ground half a second before it comes back)
          if (p.pos.x < X0 - 0.4 && !m.chainGo) { if (next > 1.5 && next < half - 0.3) m.chainGo = true; else return standAt(X0 - 2.5); }
          if (next > 0.92 || next < 0.3) return standAt(X0);
          return { moveX: 0, jump: next > 0.52 };
        }
        for (const x of [s.marks.first, s.marks.pairA, s.marks.pairB, s.marks.sand]) {
          if (p.pos.x > x + 1.7) continue;
          if (p.pos.x > x - 1.8) return run(); // under it: keep going
          const bob = pendulumNear(x), z = (bob.box.min.z + bob.box.max.z) / 2, key = `bob${x}`;
          const out = Math.abs(z) > 1.7 && Math.abs(z) > Math.abs(m[key] ?? z); m[key] = z;
          if (p.pos.x < x - 2.7) return run();
          return out || m[`go${x}`] ? (m[`go${x}`] = true, run()) : standAt(x - 2.5);
        }
        const X = s.marks.along, along = pendulumNear(X);
        if (p.pos.x < X + 5 && along.yaw === 0) {
          const swing = ahead => Math.abs(along.amp * Math.sin((level.time + ahead) * along.speed + along.phase));
          if (m.goAlong || p.pos.x < X - 7.4) return run();
          // (its bob clears his head past 0.56 rad: he goes when it will have, half a second on, and is still rising)
          if (Math.abs(p.speed) < 0.5 && p.pos.x > X - 7 && swing(0.5) > 0.62 && swing(0.5) < 0.8 && swing(0.55) > swing(0.5)) { m.goAlong = true; api.fact('underLongPendulum', true); return run(); }
          return standAt(X - 6.6);
        }
        return run();
      },

      // the stone along the line is jumped as it comes; the one across it is passed behind
      stones: s => {
        const a = s.x0, along = stoneNear(s.marks.along), across = stoneNear(s.marks.across);
        if (p.pos.x < s.marks.along + 10.5) {
          const sx = (along.box.min.x + along.box.max.x) / 2, gap = sx - p.pos.x;
          if (p.pos.x < a + 12.5 && !m.in) { if (along.dir < 0 && gap < 17 && gap > 9) m.in = true; else return standAt(a + 12); }
          // jump so that the top of the hop is over it: he closes at 9 m/s and it at 5, and a tap peaks 0.36 s after it leaves
          if (p.grounded && gap > 0 && gap < (along.dir < 0 ? 5.3 : 2.6) && gap > 1.2) api.jump(2);
          return run();
        }
        if (p.pos.x < s.marks.across + 2.6) {
          const z = (across.box.min.z + across.box.max.z) / 2, away = Math.abs(z) > Math.abs(m.acrossZ ?? z); m.acrossZ = z;
          if (p.pos.x > s.marks.across - 2.6) return run();
          if (p.pos.x < s.marks.across - 4.2) return run();
          return (Math.abs(z) > 2.6 && away) || m.goAcross ? (m.goAcross = true, run()) : standAt(s.marks.across - 3.8);
        }
        return run();
      },

      // pass each head just after its breath has stopped; hop the lava
      fire: s => {
        for (const x of [s.marks.head, s.marks.pairA, s.marks.pairB]) {
          if (p.pos.x > x + 2.2) continue;
          const tiki = tikiNear(x), phase = tiki.state.phase, key = `cool${x}`;
          if (phase !== 'cool') m[key] = null; else m[key] ??= k;
          if (p.pos.x > x - 2.3) return run();
          if (p.pos.x < x - 3.6) return run();
          const justCooled = m[key] !== null && m[key] !== undefined && k - m[key] < 50 && m[`seen${x}`];
          if (phase === 'fire') m[`seen${x}`] = true;
          return justCooled || m[`go${x}`] ? (m[`go${x}`] = true, run()) : standAt(x - 3.2);
        }
        api.plan([tap(s.marks.lava - 0.9)]);
        return run();
      },

      // (a running tap leaves the ground 0.9 m after the press and lands 4.95 m after that: pressed 3.4 m short of a patch's middle)
      thorns: s => { const M = s.marks; api.plan([tap(M.thorn1 - 3.4), tap(M.thorn2 - 3.4), tap(M.thorn3 - 3.4)]); return run(); },

      // off its floor until it has charged and stands dizzy; then in, and spin
      bull: s => {
        const bull = enemyNear(s.marks.bull, 'charger');
        if (!bull || !bull.alive) return run();
        const gap = bull.group.position.x - p.pos.x;
        if (bull.state === 'recover') { if (gap < 2.3 && gap > -1) api.spin(); return run(); }
        if (p.pos.x < s.marks.pen - 1.6) return run();
        if (!m.seenDash && bull.state === 'dash') { m.seenDash = true; api.note('the bull charged'); }
        return standAt(s.marks.pen - 1.5);
      },

      // over the steel; into each hole while an orb is in flight, and out when it has passed overhead; in the
      // open an orb is jumped (the top of a tap is over it as they pass); the turret is spun
      turret: s => {
        const M = s.marks, sentry = enemyNear(M.sentry, 'sentry'), orbs = level.projectiles;
        m.seen ??= new Set(); for (const o of orbs) if (!m.seen.has(o)) { m.seen.add(o); api.fact('orbsFired', m.seen.size); }
        if (!sentry || !sentry.alive) { if (!m.down) { m.down = true; api.fact('sentryDown', true); } return run(); }
        const ahead = orbs.filter(o => o.mesh.position.x > p.pos.x - 0.6).sort((u, v) => u.mesh.position.x - v.mesh.position.x)[0] ?? null;
        const gap = ahead ? ahead.mesh.position.x - p.pos.x : Infinity;
        if (p.pos.x < M.cover + 0.6) { api.plan([tap(M.cover - 3.4)]); return run(); }
        if (p.pos.y < s.top - 0.6 && !(m.leaving && k - m.leaving < 45)) { // in a hole: against the wall nearest the turret
          const east = p.pos.x < M.hole1End + 0.5 ? M.hole1End : M.hole2End;
          const calm = sentry.state === 'cooldown' || (sentry.state === 'track' && sentry.stateT < 0.6);
          if (ahead && !m.ducking) { m.ducking = true; m.ducked = (m.ducked ?? 0) + 1; api.fact('orbsDucked', m.ducked); }
          if (!ahead) m.ducking = false;
          m.inHole = (m.inHole ?? 0) + 1;
          // out when the orb has gone over and the turret has just fired (or has just had nothing to fire at)
          if (!ahead && calm && p.grounded && p.pos.x > east - 1.5) { api.hop(); m.leaving = k; m.inHole = 0; return {}; }
          // shown nothing, it waits. A hop on the spot shows him to it: it winds up, he is down again, and it lets the shot go
          if (!ahead && !calm && sentry.state === 'track' && m.inHole > 150 && p.grounded) { api.hop(); m.inHole = 60; api.fact('baited', (log.facts.baited ?? 0) + 1); }
          return standAt(east - 1.0);
        }
        // (an orb comes at 10.5 m/s and he runs at it; a tap is over 1.1 m from 0.11 to 0.5 s after it leaves the
        // ground: it is pressed a third of a second before they pass. While the turret winds up, 0.55 s, the orb
        // it is about to fire is counted too.)
        const closing = 10.5 + Math.max(0, p.speed);
        let crossIn = ahead ? gap / closing : Infinity;
        if (sentry.state === 'charge') { const left = Math.max(0, 0.55 - sentry.stateT), d = sentry.group.position.x - 0.8 - p.pos.x - Math.max(0, p.speed) * left; crossIn = Math.min(crossIn, left + Math.max(0, d) / closing); }
        // (with a hole a stride ahead there is nothing to jump: he will be in it)
        const holeAhead = [M.hole1, M.hole2].some(h => h - p.pos.x > -0.2 && h - p.pos.x < 2.4);
        if (p.grounded && !holeAhead && crossIn < 0.38 && crossIn > 0.1 && !api.jumping()) { api.jump(2); if (api.jumping()) { m.jumped = (m.jumped ?? 0) + 1; api.fact('orbsJumped', m.jumped); } }
        if (sentry.group.position.x - p.pos.x < 2.1) api.spin();
        return run();
      },

      bird: s => {
        const moa = enemyNear(s.marks.moa, 'moa');
        if (moa && moa.alive && Math.abs(moa.group.position.x - p.pos.x) < 2.4) api.spin();
        return run();
      },

      // a tap jump at each rope and the Grind button; on it, the stick leans against the needle
      rope: s => {
        const M = s.marks;
        if (p.state === 'grind') return {};
        for (const [start, far] of [[M.rope1, M.far1], [M.rope2, M.far2]]) {
          if (p.pos.x > far - 0.5) continue;
          if (p.pos.y < s.top - 0.8 && p.grounded) { if (p.pos.x > far - 2.2) api.jump(2); return run(); } // down in the trench
          if (p.grounded && p.pos.x >= start - 1.9 && p.pos.x < start + 1.5) api.jump(p.freeSkate ? 6 : 2);
          if (!p.grounded && p.pos.x > start - 1.2 && p.pos.x < far - 2) return { moveX: 1, grind: true };
          return run();
        }
        return run();
      },

      // mounted by a push-off; over the pad; through the boxes; down
      speed: s => {
        if (!p.freeSkate && p.grounded && p.pos.x < s.marks.pad - 3) return mount();
        if (p.pos.x > s.marks.pad && p.pos.x < s.marks.pad + 6) api.fact('padSpeed', Math.max(log.facts.padSpeed ?? 0, +Math.abs(p.speed).toFixed(1)));
        if (p.pos.x > s.marks.boxes - 2 && p.pos.x < s.marks.boxes) api.fact('wallSpeed', +Math.abs(p.speed).toFixed(1));
        return run();
      },

      // stop short of the drop, wait for the rail to come west, then jump at it with Grind
      ferry: s => {
        const M = s.marks, ferry = level.movingRails.find(o => Math.abs((o.rail.points[0].x + o.rail.points.at(-1).x) / 2 - M.rail) < 8) ?? null, rail = ferry?.rail ?? null;
        const ends = rail ? [rail.points[0].x, rail.points.at(-1).x] : [0, 0];
        if (p.state === 'grind') { if (!m.rode) { m.rode = true; api.fact('ferryCaught', +(p.pos.x - M.brink).toFixed(1)); } if (rail && Math.max(...ends) - p.pos.x < 0.9) api.jump(2); return {}; }
        if (m.rode) return run();
        if (p.pos.x > M.far - 0.5) return run();
        if (p.freeSkate && p.grounded) return p.pos.x < M.brink - 9 ? run() : { moveX: -1 }; // on the board: pull back to a stop, and off it
        if (!rail) return run();
        const west = Math.min(...ends);
        if (!p.grounded) return { moveX: 1, grind: p.pos.x > M.brink - 1 };
        if (p.pos.x < M.brink - 3.2) return run();
        // go when its west end is as near as it comes and it has begun to come back east
        const near = west - M.brink < 1.1, turning = west > (m.railWest ?? west) - 1e-4; m.railWest = west;
        if (near && turning) m.goRail = true;
        if (m.goRail) { if (p.pos.x >= M.brink - 1.5) api.jump(2); return run(); }
        return standAt(M.brink - 2.6);
      },

      // mounted; an ollie short of the gate and Spin with the stick at rest (a kickflip) in the air that goes
      // through it; an ollie short of the rail, Spin with the stick right (a heelflip), and Grind at the rail
      // the flip has made real. In a board's air the stick left or right SPINS him, and a landing half turned
      // is a fall: but for the one press of the heelflip it is at rest until the wheels are down.
      tricks: s => {
        const M = s.marks, gate = level.trickGates[0];
        if (gate?.unlocked) api.fact('gateOpen', true);
        if (level.trickRails[0]?.unlocked) api.fact('railReal', true);
        if (p.state === 'grind') { m.onRail = true; return {}; }
        if (!p.freeSkate && p.grounded) return mount();
        if (!p.grounded) {
          m.aloft = (m.aloft ?? 0) + 1;
          const press = m.aloft >= 2 && m.aloft < 6;
          if (m.trick === 'kick') return { moveX: 0, spin: press };
          if (m.trick === 'heel') return { moveX: press ? 1 : 0, spin: press, grind: p.pos.x > M.rail - 1.5 };
          return { moveX: 0 };
        }
        if (m.aloft) { m.aloft = 0; m.trick = null; }
        if (gate && !gate.unlocked && p.pos.x > M.gate - 6.5 && p.pos.x < M.gate - 3) { api.jump(8); m.trick = 'kick'; }
        else if (!m.onRail && p.pos.x > M.rail - 6 && p.pos.x < M.rail - 3) { api.jump(8); m.trick = 'heel'; }
        return run();
      },

      // onto the step, wait for its back to come west, jump at it with Grind, ride it off its east end
      spine: s => {
        const M = s.marks, saur = level.grindosauri[0] ?? null;
        if (p.state === 'grind') { m.rode = true; return {}; }
        if (saur && !saur.alive && !m.beaten) { m.beaten = true; api.fact('spineBeaten', true); }
        if (m.rode || !saur || saur.alive === false) return run();
        // (a rider pulls back to a stop short of the step, and is on his feet for it)
        if (p.freeSkate && p.grounded && p.pos.x < M.step - 4) return { moveX: -1 };
        if (p.pos.y < s.top + 0.9 && p.pos.x < M.step - 0.4) { api.plan([tap(M.step - 6.3)]); return run(); }
        if (!p.grounded) return { moveX: 1, grind: p.pos.x > M.step - 0.6 };
        const west = saur.position.x - 2.1 - M.step, coming = saur.direction < 0;
        if (west < 2.3 && west > 1.1 && !coming) m.goSpine = true;
        if (m.goSpine) { if (p.pos.x >= M.step - 1.3) api.jump(2); return run(); }
        return standAt(M.step - 2);
      },

      // Jump at the lip he waits on; Spin when the ball is on him; Jump in the east hang with the stick held out
      ball: s => {
        const M = s.marks, ball = level.angryBalls[0];
        if (ball && !ball.alive) api.fact('ballDown', true);
        if (p.dropInPerch && p.dropInTipT < 0) { m.wait = (m.wait ?? 0) + 1; if (m.wait > 6) api.jump(3); return run(); }
        m.wait = 0;
        if (ball?.alive && ball.active) { const gap = Math.hypot(ball.mesh.position.x - p.pos.x, ball.mesh.position.y - (p.pos.y + 0.5)); if (gap < 2.6) api.spin(3); }
        const hang = p.vertAir && !p.grounded && p.pos.x > M.cross; m.hang = hang ? (m.hang ?? 0) + 1 : 0;
        if (hang && m.hang >= 3 && m.hang < 7) jumpUntil = k + 1;
        return run();
      },

      // ridden: the panes break on him, and the plane between the posts takes his board
      glass: s => {
        api.fact('panesBroken', level.breakableScenery.brokenCount); api.fact('boardTrips', p.checkpointTripCount);
        if (!p.freeSkate && p.grounded && p.pos.x < s.marks.glass - 4) return mount();
        return run();
      },

      // through the portal over the chasm. Then, unless the plain way is asked for: a hop onto the arrow, which
      // throws him into the door in the air; along the cloud to the gem and the portal back down; a hop onto the
      // steel arrow, which throws him onto the ledge; a hop onto the bonus stone. Then the crystal and the gate.
      finale: s => {
        const M = s.marks, t = s.top, gem = level.colouredGemPickups[0];
        if (p.hasCrystal) api.fact('crystal', true);
        if (gem && (gem.collected || gem.collectedThisRun)) api.fact('gem', true);
        if (p.pos.x < M.far) return run();
        if (p.pos.y > t + 8) { m.door = true; api.fact('cloud', true); return run(); }
        if (opts.plain) { api.plan([tap(M.airDoor - 3.4), tap(M.bonusArrow - 3.4)]); return run(); }
        /** Stand beside a crate, hop, and come down on its lid. */
        const onto = x => {
          if (!p.grounded) return { moveX: p.pos.x < x - 0.12 ? 1 : p.pos.x > x + 0.12 ? -1 : 0 };
          if (p.pos.x > x - 1.6 && p.pos.x < x - 1.1 && Math.abs(p.speed) < 0.6) { api.hop(); return {}; }
          return standAt(x - 1.3);
        };
        if (!m.door) return p.pos.x < M.airDoor + 1.5 ? onto(M.airDoor) : { moveX: -1 }; // (missed it: back round)
        if (!m.bonus) {
          if (p.vVel > 13) m.thrown = true;
          if (p.grounded && p.pos.y > t + 2.9 && p.pos.y < t + 3.3) { // on the ledge: a hop onto the stone
            if (p.pos.x > M.bonus - 2.6 && p.pos.x < M.bonus - 2.1 && Math.abs(p.speed) < 0.6) { api.hop(); return {}; }
            return standAt(M.bonus - 2.35);
          }
          if (!p.grounded && p.pos.y > t + 2.9 && p.pos.x > M.ledge) return { moveX: p.pos.x < M.bonus - 0.3 ? 1 : 0 }; // from the ledge to the stone
          if (!p.grounded && m.thrown) return { moveX: p.pos.x < M.ledge + 0.7 ? 1 : 0 }; // from the arrow to the ledge
          if (p.grounded && p.pos.y < t + 0.4) m.thrown = false;
          if (p.pos.x > M.bonusArrow + 1.2 && p.pos.y < t + 2) return { moveX: -1 };
          return onto(M.bonusArrow);
        }
        return run();
      },
    };

    // ---- the loop ------------------------------------------------------------------------------
    for (; k < seconds * 60; k++) {
      const s = stationAt(p.pos.x);
      if (s?.id !== memoFor) { if (memoFor && log.visited.has(memoFor)) log.visited.get(memoFor).t1 = k * DT; memoFor = s?.id ?? null; m = {}; if (s && !log.visited.has(s.id)) log.visited.set(s.id, { t0: k * DT, t1: null }); }
      // (`naive` is a player who only holds right: what every hazard on the course is measured against)
      const controller = s && !opts.naive ? C[s.id] : run;
      const want = { moveX: 0, moveY: 0, ...(p.state === 'dead' || p.isBailing ? {} : controller(s ?? { x0: p.pos.x, marks: {} })) };
      // on a rail or a rope: lean against the needle (the stick's left and right)
      if (p.state === 'grind') { m.grindAge = (m.grindAge ?? 0) + 1; const lead = p.balance + p.balanceVel * 0.12; want.moveX = m.grindAge < 4 || Math.abs(lead) < 0.05 ? 0 : -Math.sign(lead); want.grind = true; }
      else m.grindAge = 0;
      // boxes and checkpoints in the way are spun through, unless something that explodes is within reach of the spin
      // (a rider spins them too, a little sooner: under 12.5 m/s a board that meets a box trips over it, and a
      // checkpoint tripped over is not banked)
      if (!skip('spin') && p.grounded && p.state === 'ride') {
        const reach = p.freeSkate ? Math.max(0.75, Math.abs(p.speed) * 0.14) : 0.75;
        const ahead = box => box.min.x - (p.pos.x + 0.5) < reach && box.max.x > p.pos.x && box.max.y > p.pos.y + 0.1 && box.min.y < p.pos.y + 1;
        const danger = level.crates.some(c => EXPLODES(c) && Math.abs((c.box.min.x + c.box.max.x) / 2 - p.pos.x) < 4.6 && Math.abs(c.box.min.y - p.pos.y) < 2.4);
        if (!danger && (level.crates.some(c => BREAKS(c) && ahead(c.box)) || level.checkpoints.some(c => !c.active && ahead(c.box)))) api.spin();
      }
      // stopped against something that is not a box to spin: hop it (a step, a steel crate)
      const holdingEast = (want.moveX ?? 0) > 0.5 && p.grounded && p.state === 'ride' && !p.freeSkate && !p.dropInPerch;
      blocked = holdingEast && Math.abs(p.pos.x - lastX) < 0.004 ? blocked + 1 : 0; lastX = p.pos.x;
      if (blocked > 10 && jumpUntil < k && !skip('hop') && !want.mounting) { jumpUntil = k + 3; hopUntil = k + 5; blocked = 0; }
      // (with the stick held, Jump from a standstill is the push-off onto the board: the stick is let go for the hop)
      if (hopUntil >= k) want.moveX = 0;
      // the double jump of a planned jump: Jump again at the top
      if (m.double > 0 && !p.grounded && p.vVel < 1 && k - m.double > 8) { jumpUntil = k + 2; m.double = -1; }

      const input = makeInput({ moveX: want.moveX ?? 0, moveY: want.moveY ?? 0 });
      const held = { jump: !!want.jump || jumpUntil >= k, spin: !!want.spin || spinUntil >= k, grab: !!want.grab, grind: !!want.grind };
      input.jumpHeld = held.jump; input.jumpPressed = held.jump && !was.jump; input.jumpReleased = !held.jump && was.jump;
      input.spinHeld = held.spin; input.spinPressed = held.spin && !was.spin;
      input.grabHeld = held.grab; input.grabPressed = held.grab && !was.grab;
      input.grindHeld = held.grind; input.grindPressed = held.grind && !was.grind;
      Object.assign(was, held); spinGap--;
      const jumpEdge = input.jumpPressed || input.jumpReleased, xBefore = p.pos.x;
      tick(input); input.consumeEdges();
      // what the station's object did, read off the game's own state
      if (s) {
        const e = (log.evidence[s.id] ??= {});
        if (p.state !== prevState) { if (p.state === 'grind') e.grinds = (e.grinds ?? 0) + 1; if (p.state === 'rope') e.swings = (e.swings ?? 0) + 1; if (p.state === 'swim') e.swims = (e.swims ?? 0) + 1; if (p.state === 'hang') e.hangs = (e.hangs ?? 0) + 1; }
        if (Math.abs(p.pos.x - xBefore) > 15 || Math.abs(p.pos.y - (m.yBefore ?? p.pos.y)) > 8) e.doors = (e.doors ?? 0) + 1;
        m.yBefore = p.pos.y;
        if (p.freeSkate && p.grounded) e.rode = true;
        // the bonus stone: the game's loop asks this each frame, and starts the round on a yes. Here the round is
        // not played: he is put where it would bring him back.
        if (s.id === 'finale' && !opts.plain && !m.bonus && level.consumeBonusLanding(p.pos, { enabled: true, grounded: p.grounded, jump: jumpEdge, rising: p.vVel > 0.2 })) {
          m.bonus = true; api.fact('bonusStone', true);
          const back = level.bonusReturnPoint(); p.pos.copy(back); p.prevPos.copy(back); p.speed = 0; p.vVel = 0;
        }
      }

      log.reached = Math.max(log.reached, p.pos.x); log.maxZ = Math.max(log.maxZ, Math.abs(p.pos.z));
      if (p.isBailing && !prevBail) log.bails++;
      prevBail = p.isBailing;
      if (p.state === 'dead' && prevState !== 'dead') { log.died.push({ t: +(k * DT).toFixed(2), x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), station: s?.id ?? null }); if (!opts.carryOn) break; }
      if (trace && (p.state !== prevState || k % trace === 0)) console.log(`## t${(k * DT).toFixed(2)} x${p.pos.x.toFixed(2)} y${p.pos.y.toFixed(2)} v${p.speed.toFixed(1)} vV${p.vVel.toFixed(1)} ${p.state}/${p.freeSkate ? 'board' : 'foot'}/${p.grounded ? 'gnd' : 'air'}${p.isBailing ? '/BAIL' : ''} ${s?.id ?? '-'} want ${JSON.stringify(want)}${held.jump ? ' J' : ''}${held.spin ? ' S' : ''}${held.grind ? ' G' : ''} boxes ${level.crates.filter(c => c.alive).length}${opts.watch ? ' ' + opts.watch(p, level) : ''}`);
      prevState = p.state;
      if (p.state === 'finished') log.finished = true;
      if (p.pos.x >= goal || log.finished || (until && until(log))) break;
    }
    // what was broken and what was beaten, station by station
    for (const st of lab.STATIONS) {
      if (!log.visited.has(st.id)) continue;
      const inside = x => x >= st.x0 && x < st.x1, e = (log.evidence[st.id] ??= {});
      const boxes = level.crates.filter(c => !c.alive && inside((c.box.min.x + c.box.max.x) / 2) && !c.metal).length;
      const foes = level.enemies.filter(en => !en.alive && inside(en.homeX ?? en.group.position.x)).length;
      if (boxes) e.boxes = boxes; if (foes) e.foes = foes;
    }
    log.banked = level.checkpoints.filter(c => c.active || c.banked || c.collected).length;
    log.seconds = +(k * DT).toFixed(2); log.ok = log.died.length === 0 && (log.reached >= goal || log.finished);
    return log;
  }
  return { play, tick, S, stationAt, moverNear, swingNear, pendulumNear, stoneNear, tikiNear, bridgeNear, enemyNear, crateNear, deckTop };
}
