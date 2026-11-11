// Measures how high and how far the real Player reaches with the skate verbs that THPS-style
// collectible routes depend on: vert airs (analytic halfpipe and decked quarter pipe), pumped
// sessions, kicker launches, grind ollies (straight and sideways), the rail-length "slipstream"
// launch, wallrides and wallies, and trampolines. Read-only: builds a throwaway test level and
// changes no tuning. Results feed docs/THPS_DESIGN_BIBLE.md.
//
//   node tools/probe-skate-reach.mjs [out.json]
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const out = process.argv[2];
const HP = { x: -300, z: -150, len: 80, flat: 4, R: 3.6 };              // analytic halfpipe (axis z)
const QP = { x: -200, z: -150, len: 24, R: 3.6, deck: 3 };              // decked quarter pipe, rises toward +X
const KICKERS = [{ x: -120, rise: 0.8, len: 4 }, { x: -100, rise: 1.2, len: 4 }, { x: -80, rise: 1.8, len: 4 }];
const KZ = -150;                                                        // kicker centres (lip at KZ - len/2)
const RAIL = { x: 0, y: 1.0, z0: -100, len: 80 };                       // long rail for grind ollies
const SHORT_RAIL = { x: 30, y: 1.0, z0: -100, len: 24 };                // end-to-end rail for the slipstream
// Wallrides use straight walls on the 90° grid: a wall yawed off the grid is built from
// axis-aligned collision slabs, so its wallride normal follows a slab, not the face, and an
// angled approach usually reads as a head-on smack. The rider therefore arrives at 35° instead.
const DEG = Math.PI / 180;
const WDIR = [Math.sin(35 * DEG), -Math.cos(35 * DEG)];                 // heading of a ramp at yaw -35
const WK = { x: 150, z: -150, rise: 1.8, len: 4, yaw: -35 };            // kicker aimed 35° into WALL_K
const WALL_K = { faceX: 153.6, z: -170, len: 40, h: 24 };               // runs along Z; face toward -X
const WALL_F = { faceX: 253.2, z: -170, len: 40, h: 24 };               // flat-entry wall (no kicker)
const TRAMP = { x: 100, z: -150, top: 0.3 };
const components = [
  { t: 'platform', p: [0, -0.5, -150], s: [900, 1, 500] },
  { t: 'vertramp', p: [HP.x, 0, HP.z], len: HP.len, w: HP.flat, rise: HP.R, vkind: 'half', arc: 90, arcSteps: 24 },
  { t: 'vertramp', p: [QP.x, 0, QP.z], len: QP.len, w: 0.5, rise: QP.R, vkind: 'quarter', arc: 90, arcSteps: 24, deck: QP.deck },
  ...KICKERS.map(k => ({ t: 'ramp', p: [k.x, 0, KZ], len: k.len, rise: k.rise, w: 4 })),
  { t: 'rail', p: [RAIL.x, RAIL.y, RAIL.z0 - RAIL.len / 2], len: RAIL.len, yaw: 0 },
  { t: 'rail', p: [SHORT_RAIL.x, SHORT_RAIL.y, SHORT_RAIL.z0 - SHORT_RAIL.len / 2], len: SHORT_RAIL.len, yaw: 0 },
  { t: 'ramp', p: [WK.x, 0, WK.z], len: WK.len, rise: WK.rise, w: 4, yaw: WK.yaw },
  ...[WALL_K, WALL_F].map(w => ({ t: 'wall', p: [w.faceX + 0.5, 0, w.z], s: [w.len, w.h, 1], yaw: 90 })),
  { t: 'trampoline', p: [TRAMP.x, TRAMP.top, TRAMP.z], s: [5, TRAMP.top, 5] },
  { t: 'crystal', p: [-50, 0, -430] },                                 // over the void past the floor's far edge
  { t: 'gate', p: [200, 0, -380] },
];
const levelEntry = { id: '__skate_reach_probe', name: 'Skate reach probe',
  data: { v: 1, name: 'Skate reach probe', spawn: [200, 0.2, 0], killY: -20, perfectGrindBoost: true, components } };

const results = [];
const r3 = v => Number.isFinite(v) ? +v.toFixed(3) : null;
await withSkateRuntime(async ({ THREE, player: p, level, step, TUNING, CONST }) => {
  TUNING.balanceNoise = 0; // grind/manual balance is not under test
  const reset = () => { level.reset(true); level.update(CONST.fixedStep); };
  const place = (pos, heading, { speed = 0, air = false, board = true } = {}) => {
    const fwd = new THREE.Vector3(heading[0], 0, heading[1]).normalize();
    p.respawn(level, true, true, { position: pos.clone(), heading: fwd });
    p.pos.copy(pos); p.prevPos.copy(pos);
    p.axisF.copy(fwd); p.axisL.set(fwd.z, 0, -fwd.x);
    p.freeSkate = board; p.airFromSkate = air && board;
    p.state = air ? 'air' : 'ride'; p.grounded = !air; p.speed = speed; p.vVel = 0;
  };
  const hp = level.halfpipes[0];
  const lipY = hp.lipY;

  // ---- A. Vert air in the analytic halfpipe -------------------------------------------------
  // One swing from the centre at a given speed: coast (no input), or pump (hold Jump on the
  // way up) and release at the coping. Then a pumped session of 14 swings.
  const pipeSwings = (speed, { pump, swings }) => {
    reset();
    place(new THREE.Vector3(hp.cross, 0.05, HP.z), [1, 0], { speed });
    const airs = [];
    let held = false, inAir = false, apex = -Infinity, t = 0;
    for (let i = 0; i < swings * 400 && airs.length < swings && p.state !== 'dead'; i++, t += CONST.fixedStep) {
      const onWall = p.grounded && Math.abs(hp.crossCoord(p.pos.x, p.pos.z) - hp.cross) > hp.flatHalf + 0.05;
      let input = makeInput();
      if (pump) {
        const rising = onWall && p.pos.y > p.prevPos.y + 1e-4;
        if (rising && !held && p.pos.y < lipY - 0.6) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
        else if (held && (p.pos.y >= lipY - 0.12 || !p.grounded)) { input = makeInput({ jumpReleased: true }); held = false; }
        else if (held) input = makeInput({ jumpHeld: true });
      }
      step(input);
      const airborne = !p.grounded && p.pos.y > lipY - 0.05;
      if (airborne) { inAir = true; apex = Math.max(apex, p.pos.y); }
      if (inAir && p.grounded) {
        airs.push({ apexAboveLip: r3(apex - lipY), apexAboveFloor: r3(apex - hp.yBottom), t: r3(t) });
        inAir = false; apex = -Infinity; held = false;
      }
    }
    return airs;
  };
  for (const speed of [6, 9, 12, 15, 18, 23]) {
    const coast = pipeSwings(speed, { pump: false, swings: 1 })[0] ?? null;
    const pumped = pipeSwings(speed, { pump: true, swings: 1 })[0] ?? null;
    results.push({ scenario: 'halfpipe-first-air', speed, lipY: r3(lipY), coast, pumped });
  }
  results.push({ scenario: 'halfpipe-pumped-session', startSpeed: 9, lipY: r3(lipY), airs: pipeSwings(9, { pump: true, swings: 14 }) });
  results.push({ scenario: 'halfpipe-coast-session', startSpeed: 12, lipY: r3(lipY), airs: pipeSwings(12, { pump: false, swings: 8 }) });

  // ---- B. Decked quarter pipe (mesh vert): air height and where the landing is ----------------
  const qpCopingX = QP.x + 0.5 + QP.R;
  for (const speed of [9, 12, 15, 18, 23]) for (const pump of [false, true]) {
    reset();
    place(new THREE.Vector3(QP.x - 14, 0.05, QP.z), [1, 0], { speed });
    let held = false, apex = -Infinity, left = false, maxX = -Infinity, landed = null, t = 0;
    for (let i = 0; i < 600 && p.state !== 'dead'; i++, t += CONST.fixedStep) {
      const onWall = p.grounded && p.pos.x > QP.x + 0.5 && p.pos.y > 0.05;
      let input = makeInput();
      if (pump) {
        if (onWall && !held && p.pos.y < QP.R - 0.6) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
        else if (held && (p.pos.y >= QP.R - 0.12 || !p.grounded)) { input = makeInput({ jumpReleased: true }); held = false; }
        else if (held) input = makeInput({ jumpHeld: true });
      }
      step(input);
      if (!p.grounded && p.pos.y > QP.R - 0.05) { left = true; apex = Math.max(apex, p.pos.y); maxX = Math.max(maxX, p.pos.x); }
      if (left && p.grounded) { landed = { x: r3(p.pos.x - qpCopingX), y: r3(p.pos.y), onDeck: p.pos.y > QP.R - 0.2 && p.pos.x > qpCopingX }; break; }
    }
    results.push({ scenario: 'quarter-air', speed, pump, copingY: QP.R, apexAboveCoping: left ? r3(apex - QP.R) : null,
      maxPastCoping: left ? r3(maxX - qpCopingX) : null, landing: landed, t: r3(t) });
  }

  // ---- C. Kickers: roll-off and a full ollie released at the lip ----------------------------
  for (const k of KICKERS) for (const speed of [9, 12, 18, 23]) for (const mode of ['roll', 'ollie']) {
    reset();
    const lipZ = KZ - k.len / 2;
    place(new THREE.Vector3(k.x, 0.05, KZ + k.len / 2 + 25), [0, -1], { speed });
    let phase = 'approach', held = false, apex = -Infinity, takeoff = null, land = null, speedAtLip = null;
    for (let i = 0; i < 900 && p.state !== 'dead'; i++) {
      let input = makeInput();
      if (mode === 'ollie' && phase === 'approach') {
        const toLip = p.pos.z - lipZ;
        if (!held && toLip <= Math.max(0.5, Math.abs(p.speed) * 0.4)) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
        else if (held && toLip <= 0.15) { input = makeInput({ jumpReleased: true }); held = false; }
        else if (held) input = makeInput({ jumpHeld: true });
      }
      const beforeZ = p.pos.z;
      step(input);
      if (phase === 'approach' && !p.grounded && p.pos.z < lipZ + 0.6) { phase = 'air'; takeoff = { z: beforeZ, y: p.pos.y }; speedAtLip = Math.abs(p.speed); }
      if (phase === 'air') { apex = Math.max(apex, p.pos.y); if (p.grounded) { land = { z: p.pos.z, y: p.pos.y }; break; } }
    }
    results.push({ scenario: 'kicker', rise: k.rise, len: k.len, angleDeg: r3(Math.atan2(k.rise, k.len) * 180 / Math.PI), speed, mode,
      launched: takeoff !== null && Number.isFinite(apex) && apex > k.rise + 0.05, speedAtTakeoff: r3(speedAtLip), apexAboveFloor: r3(apex), apexAboveLip: r3(apex - k.rise),
      distanceFromLip: land ? r3(lipZ - land.z) : null, landedY: land ? r3(land.y) : null });
  }

  // ---- D. Grind ollies: tap and full, straight and sideways -----------------------------------
  const rail = level.rails.find(r => Math.abs(r.points[0].x - RAIL.x) < 1);
  const shortRail = level.rails.find(r => Math.abs(r.points[0].x - SHORT_RAIL.x) < 1);
  // With the stock drift and no stick correction the balance needle tips the rider off the
  // rail; measure how long that takes, then switch drift off so the rail geometry is measured
  // alone (grind ollies and slipstream). Restored after section E.
  const grindFrom = (speed, endOf) => {
    reset();
    const a = endOf.points.reduce((m, q) => (q.z > m.z ? q : m)); // the end the rider travels away from (toward -Z)
    place(new THREE.Vector3(a.x, a.y + CONST.railRideHeight + 0.05, a.z - 0.05), [0, -1], { speed, air: true });
    step(makeInput({ grindHeld: true, grindPressed: true }));
    for (let i = 0; i < 3 && p.state !== 'grind'; i++) step(makeInput({ grindHeld: true }));
  };
  for (const speed of [6, 9, 12]) {
    grindFrom(speed, rail);
    const caught = p.state === 'grind';
    let t = 0;
    for (let i = 0; i < 1200 && p.state === 'grind'; i++, t += CONST.fixedStep) step(makeInput({ grindHeld: true }));
    results.push({ scenario: 'grind-balance-no-correction', speed, balanceDrift: TUNING.balanceDrift, caught, secondsUntilOff: caught ? r3(t) : null,
      speedAfter: r3(Math.abs(p.speed)), state: p.state });
  }
  const stockDrift = TUNING.balanceDrift;
  TUNING.balanceDrift = 0;
  const railTop = RAIL.y + CONST.railRideHeight;
  const grindJump = (speed, holdFrames, side) => {
    reset();
    const start = rail.closest(new THREE.Vector3(RAIL.x, RAIL.y, RAIL.z0 - 4)).point.clone().add(new THREE.Vector3(0, CONST.railRideHeight + 0.05, 0));
    place(start, [0, -1], { speed, air: true });
    step(makeInput({ grindHeld: true, grindPressed: true }));
    for (let i = 0; i < 30; i++) step(makeInput({ grindHeld: true }));
    const grinding = p.state === 'grind';
    const z0 = p.pos.z, x0 = p.pos.x, y0 = p.pos.y;
    // The stick also steers the grind balance, so a sideways exit holds the direction only for
    // the frame before release and the release itself (the engine reads intent on both frames).
    const move = side ? { moveX: side } : {};
    step(makeInput({ ...(holdFrames === 0 ? move : {}), jumpPressed: true, jumpHeld: true, grindHeld: false }));
    for (let i = 0; i < holdFrames; i++) step(makeInput({ ...(i === holdFrames - 1 ? move : {}), jumpHeld: true }));
    step(makeInput({ ...move, jumpReleased: true }));
    let apex = -Infinity, cross = null, prev = null;
    for (let i = 0; i < 400 && p.state !== 'dead'; i++) {
      step(makeInput(side ? { moveX: side } : {}));
      apex = Math.max(apex, p.pos.y);
      if (prev && prev.y >= y0 && p.pos.y < y0 && apex > y0 + 0.05) {
        const f = (prev.y - y0) / Math.max(1e-6, prev.y - p.pos.y);
        cross = { along: z0 - (prev.z + (p.pos.z - prev.z) * f), lateral: (prev.x + (p.pos.x - prev.x) * f) - x0 };
        break;
      }
      prev = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
      if (p.grounded) break;
    }
    return { grinding, apexAboveRailTop: r3(apex - y0), alongAtRailHeight: cross ? r3(cross.along) : null, lateralAtRailHeight: cross ? r3(cross.lateral) : null };
  };
  for (const speed of [6, 12, 18, 23]) for (const [label, hold] of [['tap', 0], ['full', 24]]) {
    results.push({ scenario: 'grind-ollie', speed, jump: label, ...grindJump(speed, hold, 0) });
    results.push({ scenario: 'grind-ollie-side', speed, jump: label, ...grindJump(speed, hold, 1) });
  }
  void railTop;

  // ---- E. Slipstream: ride a rail end to end and leave its end ------------------------------
  for (const speed of [8, 12, 18]) for (const mode of ['roll-off', 'ollie-off']) {
    grindFrom(speed, shortRail);
    let left = false, exitSpeed = null, apex = -Infinity, land = null, endZ = Math.min(...shortRail.points.map(q => q.z));
    let jumped = false;
    for (let i = 0; i < 900 && p.state !== 'dead'; i++) {
      let input = makeInput({ grindHeld: !left });
      if (mode === 'ollie-off' && !jumped && p.state === 'grind' && p.pos.z < endZ + 1.0) { input = makeInput({ jumpPressed: true, jumpHeld: true }); jumped = true; }
      else if (mode === 'ollie-off' && jumped && !left) input = makeInput({ jumpReleased: true });
      step(input);
      if (!left && p.state !== 'grind' && p.pos.z < endZ + 1.5) { left = true; exitSpeed = Math.abs(p.speed); }
      if (left) { apex = Math.max(apex, p.pos.y); if (p.grounded) { land = { z: p.pos.z }; break; } }
    }
    results.push({ scenario: 'slipstream', railLen: SHORT_RAIL.len, entrySpeed: speed, mode, exitSpeed: r3(exitSpeed),
      boosted: exitSpeed !== null && exitSpeed > speed + 1, apexAboveFloor: r3(apex), distancePastRailEnd: land ? r3(endZ - land.z) : null });
  }
  TUNING.balanceDrift = stockDrift;

  // ---- F. Wallride and wallie -----------------------------------------------------------
  // Entries: a charged ollie off a 1.8 m kicker aimed 35° into WALL_K, or a tap/full ollie from
  // flat ground into WALL_F at the same 35°. Grind is held once airborne; on the wall Jump is then
  // held for the listed seconds and released (the wallie), or never pressed ('none').
  const wallRun = (entry, speed, hold) => {
    reset();
    const wall = entry === 'kicker' ? WALL_K : WALL_F;
    let start, toTakeoff;
    if (entry === 'kicker') {
      const lip = { x: WK.x + WDIR[0] * WK.len / 2, z: WK.z + WDIR[1] * WK.len / 2 };
      start = new THREE.Vector3(WK.x - WDIR[0] * (WK.len / 2 + 25), 0.05, WK.z - WDIR[1] * (WK.len / 2 + 25));
      toTakeoff = pos => (lip.x - pos.x) * WDIR[0] + (lip.z - pos.z) * WDIR[1];
    } else {
      const aim = { x: wall.faceX - CONST.playerHalf.x, z: wall.z + wall.len / 2 - 6 };
      start = new THREE.Vector3(aim.x - WDIR[0] * 22, 0.05, aim.z - WDIR[1] * 22);
      toTakeoff = pos => (aim.x - pos.x) / WDIR[0] - 3.0;   // take off 3 m of path before contact
    }
    place(start, WDIR, { speed });
    const charge = entry === 'flat-tap' ? 0 : 0.4;            // seconds of ollie charge before takeoff
    let phase = 'approach', held = false, entryState = null, rideT = 0, wallHold = 0, release = null, apex = -Infinity;
    let maxY = -Infinity, end = null, land = null, samples = [];
    for (let i = 0; i < 1500 && p.state !== 'dead'; i++) {
      let input = makeInput({ grindHeld: phase !== 'approach' && !p.grounded });
      if (phase === 'approach') {
        const left = toTakeoff(p.pos);
        if (!held && left <= Math.max(0.05, Math.abs(p.speed) * charge)) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
        else if (held && left <= 0.15) { input = makeInput({ jumpReleased: true }); held = false; phase = 'air'; }
        else if (held) input = makeInput({ jumpHeld: true });
      } else if (phase === 'wall' && hold !== 'none') {
        if (wallHold === 0) { input = makeInput({ grindHeld: true, jumpPressed: true, jumpHeld: true }); wallHold = CONST.fixedStep; }
        else if (wallHold < hold - 1e-9) { input = makeInput({ grindHeld: true, jumpHeld: true }); wallHold += CONST.fixedStep; }
        else { input = makeInput({ jumpReleased: true }); release = { x: p.pos.x, y: p.pos.y, z: p.pos.z, t: rideT }; }
      }
      step(input);
      maxY = Math.max(maxY, p.pos.y);
      if (phase === 'air' && p.wallriding) { phase = 'wall'; entryState = { y: p.pos.y, vVel: p.vVel, speed: p.speed }; }
      else if (phase === 'wall') {
        rideT += CONST.fixedStep;
        if (p.wallriding && Math.abs(rideT / 0.25 - Math.round(rideT / 0.25)) < CONST.fixedStep / 0.5) samples.push([r3(rideT), r3(p.pos.y)]);
        if (!p.wallriding) {
          end = release ? 'wallie' : p.grounded ? 'landed-from-wall' : p.wallrideT <= 0 ? 'timed-out' : 'left-wall';
          phase = 'after';
        }
      }
      if (phase === 'after') { apex = Math.max(apex, p.pos.y); if (p.grounded) { land = { x: p.pos.x, y: p.pos.y, z: p.pos.z }; break; } }
      if (phase === 'air' && p.grounded) { end = 'missed-wall'; break; }
    }
    const away = land && release ? -(land.x - release.x) : null;    // wall normal is -X
    const along = land && release ? release.z - land.z : null;      // ride direction is -Z
    return { scenario: 'wallride', entry, speed, wallieHoldS: hold, caught: entryState !== null,
      wallEntryY: r3(entryState?.y), wallEntryVVel: r3(entryState?.vVel), wallEntrySpeed: r3(entryState?.speed),
      rideSeconds: r3(rideT), end, releaseY: r3(release?.y), releaseAfterS: r3(release?.t),
      apexAboveFloor: r3(Number.isFinite(apex) ? apex : null), apexAboveRelease: release && Number.isFinite(apex) ? r3(apex - release.y) : null,
      landingAwayFromWall: r3(away), landingAlongWall: r3(along), landingY: r3(land?.y), maxYWholeRun: r3(maxY), rideHeightEvery250ms: samples.slice(0, 16) };
  };
  for (const entry of ['kicker', 'flat-tap', 'flat-full']) for (const speed of [9, 12, 18, 23])
    for (const hold of ['none', 0, 0.25, 0.5, 1.0, 1.5]) results.push(wallRun(entry, speed, hold));

  // ---- G. Trampoline (on foot and on the board) --------------------------------------
  for (const [label, board, held, speed] of [['foot', false, false, 0], ['foot-held', false, true, 0], ['board-land-6', true, false, 6], ['board-land-6-held', true, true, 6]]) {
    reset();
    const pos = board ? new THREE.Vector3(TRAMP.x, TRAMP.top + 1.5, TRAMP.z + 1.5) : new THREE.Vector3(TRAMP.x, TRAMP.top + 1.0, TRAMP.z);
    place(pos, [0, -1], { speed: board ? 6 : 0, air: true, board });
    p.vVel = -3;
    let apex = -Infinity, bounced = false, startZ = p.pos.z, land = null;
    for (let i = 0; i < 600 && p.state !== 'dead'; i++) {
      step(makeInput({ jumpHeld: held }));
      if (p.vVel > 0 && p.pos.y > TRAMP.top + 0.2) bounced = true;
      if (bounced) { apex = Math.max(apex, p.pos.y); if (p.grounded) { land = p.pos.z; break; } }
    }
    results.push({ scenario: 'trampoline', mode: label, apexAboveFloor: r3(apex), apexAboveDeck: r3(apex - TRAMP.top),
      travelAlong: land !== null ? r3(startZ - land) : null });
  }

  // ---- H. Crystal pickup envelope and what a death does to a held crystal ------------------
  // The pickup is a box test: crystal box (from Level.crystal) against the rider's collision box.
  reset();
  place(new THREE.Vector3(200, 0.05, -300), [0, -1]);
  step(makeInput());
  const cb = level.crystalPickup.box, cp = { x: -50, y: 0, z: -430 };
  const body = { below: p.pos.y - p.playerBox.min.y, above: p.playerBox.max.y - p.pos.y, halfX: (p.playerBox.max.x - p.playerBox.min.x) / 2 };
  results.push({ scenario: 'crystal-pickup-envelope', crystalP: [cp.x, cp.y, cp.z],
    pickupBox: { min: cb.min.toArray().map(r3), max: cb.max.toArray().map(r3) }, riderBox: { feetToTop: r3(body.above + body.below), halfWidth: r3(body.halfX) },
    feetMayBeAsLowAs: r3(cb.min.y - (body.above)), feetMayBeAsHighAs: r3(cb.max.y + body.below),
    horizontalReach: r3((cb.max.x - cb.min.x) / 2 + body.halfX),
    note: 'feet height range (relative to crystal p.y = 0) and horizontal centre distance at which the rider collects the crystal' });
  // Touch it in mid-air over the void, fall to killY, respawn; then hard-reset the level.
  reset();
  place(new THREE.Vector3(cp.x, cp.y + 0.2, cp.z), [0, -1], { air: true });
  step(makeInput());
  const touched = p.hasCrystal;
  let died = false, back = false;
  for (let i = 0; i < 900; i++) { step(makeInput()); if (p.state === 'dead') died = true; if (died && p.state !== 'dead') { back = true; break; } }
  const afterDeath = { hasCrystal: p.hasCrystal, levelCollected: level.crystalPickup.collected, visible: level.crystalPickup.group.visible };
  level.reset(true);
  results.push({ scenario: 'crystal-death', collectedMidAir: touched, died, respawned: back, afterDeath,
    afterHardReset: { levelCollected: level.crystalPickup.collected, visible: level.crystalPickup.group.visible },
    note: 'A soft death keeps a crystal taken this run; it is banked only when the run clears the gate (main.ts commitClear). A restart before clearing returns it to the level.' });
}, { levelEntry });

for (const r of results) console.log(JSON.stringify(r));
if (out) await writeFile(out, JSON.stringify(results, null, 2) + '\n');
