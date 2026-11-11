// Crystal placement audit for the campaign courses and the puzzle trilogy: where each level's
// crystal sits, which surfaces it can be collected from, what it takes to reach it, which
// traversal aids are near it and whether it can be seen from the route.
//
//   node tools/crystal-placement-report.mjs                 writes docs/thps-bible/data/current-game-crystals.json
//                                                          and docs/thps-bible/CURRENT_GAME_CRYSTAL_AUDIT.md
//   node tools/crystal-placement-report.mjs --levels jungle,codex-lab   only these level ids
//   node tools/crystal-placement-report.mjs --stock         ignore public/levels.json overrides
//   node tools/crystal-placement-report.mjs --json a.json --md a.md     other output paths
//   node tools/crystal-placement-report.mjs --render-only   rewrite the report from the existing JSON
//
// Sibling of tools/level-geometry-report.mjs and tools/crate-placement-report.mjs and built the
// same way: every level is constructed through the real Level class inside the headless
// withSkateRuntime harness, the published pack (public/levels.json) is restored first as a fresh
// browser does, the scope is the same (authored campaign courses plus the three puzzle-trilogy
// layouts; races, competitions, parks and bonus rooms are skipped), the route line is chosen the
// same way (camnode lane, else spawn -> checkpoints -> gate) and the route floor is tracked by the
// same walker as the geometry audit, so progress values line up with both audits.
//
// The crystal itself comes from Level.crystalPickup. Level.prototype.crystal and
// Level.prototype.placeCampaignCrystal are wrapped before each build so the report can tell an
// authored crystal from the engine default (6 m before the gate) and can also see crystals that
// a level authors but Level.crystal() suppresses (Secret Island and boss courses).
//
// Reach is analysed on a grid of vertical probes around the crystal: standable surfaces are
// grouped into walkable patches, patches are linked by the measured jump / ollie / ledge moves,
// and a bottleneck search from the route finds the easiest way into the pickup envelope. Grind
// lines, vert ramps, launchers (trampolines, crates, enemies, kickers), movers and swings are
// evaluated separately. Nothing here asserts: a level that fails to build is recorded with its
// error and the others continue.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT_JSON = path.resolve(ROOT, option('--json') ?? 'docs/thps-bible/data/current-game-crystals.json');
const OUT_MD = path.resolve(ROOT, option('--md') ?? 'docs/thps-bible/CURRENT_GAME_CRYSTAL_AUDIT.md');
const ONLY = option('--levels')?.split(',').filter(Boolean);
const STOCK = argv.includes('--stock');
const RENDER_ONLY = argv.includes('--render-only');
const log = (...a) => process.stdout.write(a.join(' ') + '\n');

// ---------------------------------------------------------------------------
// REACH THRESHOLDS. Every height and distance the reach classification uses, as named constants.
// Sources:
//   [crate probe] docs/crate-bible/data/skate-crate-probe.json (tools/probe-crate-skate-rules.mjs),
//                 summarised in docs/GAMEPLAY_DESIGN_BIBLE.md Part XV (XV.2 vertical, XV.3 horizontal reach);
//   [reach probe] docs/thps-bible/data/skate-reach-probe.json (tools/probe-skate-reach.mjs): vert airs,
//                 kickers, grind exits, trampolines, wallrides and wallies, and the crystal pickup envelope.
// Every value is a feet height (the rider's collision-box bottom) unless it says otherwise. The only
// entries still PROVISIONAL are marked so; update any of these when the probes are rerun.
const REACH = {
  // On foot [crate probe]: feet apex above the take-off surface; flat take-off-to-touchdown range at 9 m/s.
  footJumpApex: 2.85, footJumpRange: 5.85,
  doubleJumpApex: 4.59, doubleJumpRange: 9.15,           // full jump + double jump fired at the apex
  doubleJumpAdd: 1.74,                                   // what the double jump adds after any launch
  runSpeed: 9,                                           // on-foot run speed (bounces keep it)
  ledgeGrab: 2.4,                                        // a lip up to 2.4 m above the feet is caught (TUNING.ledgeReach)
  // Board [crate probe].
  ollieApex: 1.78, ollieRange: 9.36,                     // full charged ollie from 12 m/s cruise (15.6 m/s at take-off)
  ollieChargedRange: 13.83,                              // full ollie at the 23 m/s charge maximum
  // Grind exits [reach probe grind-ollie / grind-ollie-side]: apex above the grinding feet (rail line + railRideHeight).
  grindExitTap: 1.229, grindExitFull: 2.301,
  grindExitSideTap: 1.964, grindExitSideFull: 3.248,     // sideways landing offset at rail height
  grindBalanceSeconds: 1.2,                              // with no stick correction the rider tips off after ~1.2-1.4 s
  railCatchRadius: 2.1,                                  // TUNING.railSnapDistance
  railCatchAbove: 2.3,                                   // a rail up to ollie apex + 0.5 m above the feet can be caught
  railCatchBelow: 2.0,                                   // ... or up to 2 m below them (dropping onto it)
  railTransfer: 3.0,                                     // rail-to-rail hop between two lines' nearest points
  // Launchers [crate probe]: feet apex above the launcher's top.
  crateStomp: 2.87, crateStompDouble: 4.61,
  arrow: 3.77, arrowDouble: 5.51, arrowHeld: 5.92, arrowHeldDouble: 7.65,
  gruntBack: 1.1, gruntStomp: 2.67,                      // Coral Crab: back 1.1 m up, bounce 2.67 m above it (+ double jump)
  turtleAboveFloor: 5.17, turtleHeldAboveFloor: 7.32,    // live turtle or its shell, from the floor
  turtleDoubleAboveFloor: 6.91, turtleHeldDoubleAboveFloor: 9.05,
  launcherRadius: 4,                                     // crate / enemy launcher within this of the pickup square
  // Trampoline [reach probe trampoline]: 3.75 m above its deck, 5.9 m with Jump held, for the default
  // bounce 16 m/s (held x1.25); other bounce speeds scale with the square of the launch speed.
  trampolineApex: 3.746, trampolineHeldApex: 5.895, trampolineRefSpeed: 16, trampolineRefHeld: 1.25,
  trampolineRadius: 15,                                  // springs launch long transfers (as the crate audit)
  // Kickers [reach probe kicker]: ollie released at the lip of a 4 m ramp. Feet apex above the
  // kicker's floor and touchdown distance past the lip, by rise (m) and approach speed (m/s).
  // Rolling off without an ollie never launches; a kicker needs >= sqrt(90 x rise) m/s to crest.
  kicker: {
    0.8: { 12: [2.473, 8.891, 10.914], 18: [2.992, 16.204, 18.454], 23: [3.364, 21.177, 22.853] },
    1.2: { 12: [3.616, 8.474, 9.302], 18: [3.78, 17.784, 18.049], 23: [4.445, 24.362, 22.753] },
    1.8: { 12: [4.481, 5.925, 6.327], 18: [5.807, 19.267, 16.717], 23: [6.987, 26.557, 21.355] },
  },                                                     // [apex above floor, touchdown past lip, take-off speed]
  kickerCrest: 90,
  // Vert [reach probe halfpipe-first-air, halfpipe-pumped-session, quarter-air], measured on a 3.6 m
  // transition: feet apex above the coping. Vert airs go straight up and land back on the same face,
  // so the rider's centre stays on the coping line; with the 1.5 m pickup reach a crystal must sit
  // within 1.5 m (horizontally) of a coping line.
  halfpipeCoast: { 18: 0.914, 23: 4.541 },               // no pumping: clears the coping only from 18 m/s
  halfpipePumped: { 12: 0.567, 15: 1.995, 18: 3.846, 23: 7.101 }, // first pumped air
  halfpipeSession: 8.758,                                // pumped session cap after 3-4 swings
  quarterCoast: { 23: 3.536 },
  quarterPumped: { 15: 1.635, 18: 3.245, 23: 6.647 },    // decked quarter pipe; straight airs never land on the deck
  vertLateral: 1.5,
  // Wallride [reach probe wallride]: only on wall colliders (level.walls: wall boxes and wall paths),
  // and only straight walls on the 90-degree grid (walls yawed off the grid are slab colliders and an
  // angled approach reads as a head-on smack). Catch needs air + Grind held + speed >= 7.5 m/s +
  // facing within 76 degrees of the wall normal. Heights are feet above the floor in front of the wall.
  wallEntryTapOllie: [0.2, 0.7], wallEntryFullOllie: [1.0, 1.5], wallEntryKicker: [3.8, 3.9], // 1.8 m kicker at 18-23 m/s
  wallieApexFlatTap: 4.0,                                // best feet apex after a tap-ollie entry (3.4-4.0)
  wallieApexFlatFull: 6.3,                               // full-ollie entry + 0.5 s pump (4.3-6.3)
  wallieApexKicker: { 12: 7.4, 18: 14.1, 23: 18.8 },     // kicker-fed entry
  wallieOut: 2.8,                                        // the wallie carries the rider along the wall, only 1-2.8 m out from the face
  wallRideOut: 0.5,                                      // rider centre while on the wall (player half-width)
  // PROVISIONAL (not measured).
  kickerFeedRadius: 12,    // PROVISIONAL: a kicker this close to a wall can feed a kicker-entry wallride
};
// The pickup and the rider box. Level.crystal() (src/level.ts) centres a 2.0 x 3.4 x 2.0 m box at
// p + (0, 1.3, 0) and floats the mesh at p.y + 1.75; the Player collects on Box3.intersectsBox with its
// collision box (src/player.ts), which drops 0.35 m below the feet while grinding. The rider box
// height is read from the live Player (0.936 m for the default character, [reach probe]
// crystal-pickup-envelope: feet from p.y - 1.336 m to p.y + 3.0 m, centre within 1.5 m per axis).
const ENVELOPE = { centreAbove: 1.3, size: [2.0, 3.4, 2.0], meshAbove: 1.75, grindDrop: 0.35, ropeChest: 1.0, riderHeightFallback: 0.936 };
// Analysis grid and search radii (metres).
const T = {
  // Walker: identical to tools/level-geometry-report.mjs so route floors match the geometry audit.
  step: .25, corridor: 2.4, colStep: .4, cMax: 12, wide: 10, contDown: 1.5, contUp: 1.0, climbMax: 5.2, jumpScan: 15, scan: 60, transit: 120,
  // Reach grid.
  grid: .5,                // probe spacing
  radius: 40,              // first pass: square half-width around the crystal
  radiusWide: 120,         // second pass when the first finds no way from the route
  walkStep: .6,            // adjacent probes (0.5 m apart) with less height change than this are one walkable patch
  headroom: .9,            // standing needs this much clear height (player box 0.92 m)
  maxJump: 14,             // longest patch-to-patch jump considered (full ollie at 23 m/s, 13.83 m)
  below: 12, above: 6,     // probe window around the pickup band
  // Aid search radii.
  railNear: 12, edgeNear: 6, vertNear: 25, kickerNear: 25, trampolineNear: 20, moverNear: 20, ropeNear: 20, crateNear: 8, enemyNear: 10, padNear: 40,
  // Visibility.
  eye: 1.5,                // eye height above the walked floor
  visRange: 60,            // route samples within this straight-line distance are tested
  visEvery: 1,             // one route sample per metre of progress
  frameRange: 40,          // camera-frame test: route samples within this horizontal distance, crystal ahead of travel
  // Placement bands (as the crate audit).
  onPath: 3, detour: 8, nearGate: 20,
  // Level context: route-side samples.
  ctxEvery: 5, ctxRail: 10, ctxVert: 15, ctxWall: 6,
};
// Reach classes, easiest first. 'wallride' was added once the wallride probe landed; 'transfer' means
// a crystal over a spine (back-to-back transitions), reached by a vert air or spine transfer.
const CLASSES = ['walk', 'ollie', 'jump', 'double-jump', 'ledge', 'grind-line', 'launch-aid', 'mover', 'vert-air', 'transfer', 'wallride', 'unclear'];
const CLASS_LABEL = { walk: 'walk', ollie: 'ollie', jump: 'on-foot jump', 'double-jump': 'double jump', ledge: 'ledge grab', 'grind-line': 'grind line',
  'launch-aid': 'launch aid', mover: 'mover', 'vert-air': 'vert air', transfer: 'transfer (spine)', wallride: 'wallride', unclear: 'unreachable / unclear' };
const BASIC = ['walk', 'ollie', 'ollie', 'jump', 'double-jump', 'ledge']; // by internal rank 0, 1, 1.5 (charged), 2, 3, 4
const basicName = r => r === null || r === undefined ? null : r <= 0 ? 'walk' : r <= 1.5 ? 'ollie' : r <= 2 ? 'jump' : r <= 3 ? 'double-jump' : 'ledge';

const r1 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
const r2 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const r3 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const quantile = (xs, q) => { const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; const k = (s.length - 1) * q, i = Math.floor(k); return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (k - i); };
const median = xs => quantile(xs, .5);
const tally = (xs, key = x => x) => { const m = {}; for (const x of xs) { const k = key(x); if (k === undefined || k === null) continue; m[k] = (m[k] ?? 0) + 1; } return m; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const maxBy = (xs, f) => xs.reduce((best, x) => best === null || f(x) > f(best) ? x : best, null);
const minBy = (xs, f) => xs.reduce((best, x) => best === null || f(x) < f(best) ? x : best, null);
const segDist2D = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
/** Horizontal distance from a point to an axis-aligned XZ rectangle (0 inside). */
const rectDist = (px, pz, minX, maxX, minZ, maxZ) => Math.hypot(Math.max(0, minX - px, px - maxX), Math.max(0, minZ - pz, pz - maxZ));
const P3 = a => a.map(r2);

// ---------------------------------------------------------------------------
/** Ballistic arcs through the measured apexes, with the src/tuning.ts gravities. A mode's
 * horizontal speed is set so its modelled flat range equals the measured one (the geometry
 * audit's normalisation); launchers use the run speed. Heights are feet above the take-off. */
function makeArcs(TUNING) {
  const g = { rise: TUNING.riseGravity ?? 33, fall: TUNING.fallGravity ?? 119, boardRise: TUNING.boardRiseGravity ?? 33,
    boardFall: TUNING.boardFallGravity ?? 70, rampFall: TUNING.rampFallGravity ?? 40 };
  const arc = ({ apex, apex2 = null, rise, fall, flat = null, speed = null }) => {
    const t1 = Math.sqrt(2 * apex / rise), top = apex2 ?? apex, t2 = apex2 ? Math.sqrt(2 * (apex2 - apex) / rise) : 0;
    const tUp = t1 + t2, tFlat = tUp + Math.sqrt(2 * top / fall), vh = flat !== null ? flat / tFlat : speed;
    const yAt = t => t <= t1 ? rise * t1 * t - .5 * rise * t * t
      : t <= tUp ? apex + rise * t2 * (t - t1) - .5 * rise * (t - t1) ** 2 : top - .5 * fall * (t - tUp) ** 2;
    const xApex = vh * tUp;
    return {
      apex: top, vh, xApex,
      /** Highest the feet can be while crossing the pickup square whose near edge is d away. The
       * take-off speed can be lowered freely, so the apex can sit anywhere up to xApex. */
      maxOver: d => d <= xApex ? top : yAt(d / vh),
      /** Horizontal distance to touchdown dh above the take-off (null above the apex). */
      range: dh => dh > top ? null : vh * (tUp + Math.sqrt(2 * (top - dh) / fall)),
    };
  };
  const arcs = {
    stepoff: { apex: 0, vh: REACH.runSpeed, xApex: 0, maxOver: d => -.5 * g.fall * (d / REACH.runSpeed) ** 2, range: dh => dh > 0 ? null : REACH.runSpeed * Math.sqrt(-2 * dh / g.fall) },
    ollie: arc({ apex: REACH.ollieApex, rise: g.boardRise, fall: g.boardFall, flat: REACH.ollieRange }),
    ollieCharged: arc({ apex: REACH.ollieApex, rise: g.boardRise, fall: g.boardFall, flat: REACH.ollieChargedRange }),
    foot: arc({ apex: REACH.footJumpApex, rise: g.rise, fall: g.fall, flat: REACH.footJumpRange }),
    double: arc({ apex: REACH.footJumpApex, apex2: REACH.doubleJumpApex, rise: g.rise, fall: g.fall, flat: REACH.doubleJumpRange }),
  };
  // Launcher arcs: apex above the launcher top, carried forward at run speed (no air control), optional double jump.
  const launch = (apex, withDouble = false) => arc({ apex, apex2: withDouble ? apex + REACH.doubleJumpAdd : null, rise: g.rise, fall: g.fall, speed: REACH.runSpeed });
  /** Kicker air from the measured table: heights above the kicker's floor, x from the lip along the
   * launch. Rise is interpolated between the measured 0.8 / 1.2 / 1.8 m rows (a flat ollie below 0.8 m,
   * the 1.8 m row above it). Null when the approach speed cannot crest the kicker. */
  const kicker = (rise, speed) => {
    if (speed < Math.sqrt(REACH.kickerCrest * rise)) return null;
    const rows = Object.keys(REACH.kicker).map(Number).sort((a, b) => a - b), row = r => REACH.kicker[r][speed];
    let apex, land, vt;
    if (rise >= rows[rows.length - 1]) [apex, land, vt] = row(rows[rows.length - 1]);
    else if (rise <= rows[0]) { const [a, l, v] = row(rows[0]), f = rise / rows[0]; apex = REACH.ollieApex + (a - REACH.ollieApex) * f; land = l; vt = v; }
    else { const hi = rows.find(r => r >= rise), lo = rows[rows.indexOf(hi) - 1], f = (rise - lo) / (hi - lo), a = row(lo), b = row(hi);
      apex = a[0] + (b[0] - a[0]) * f; land = a[1] + (b[1] - a[1]) * f; vt = a[2] + (b[2] - a[2]) * f; }
    apex = Math.max(apex, rise + .05);
    const tUp = Math.sqrt(2 * (apex - rise) / g.boardRise), v0 = g.boardRise * tUp, tDown = Math.sqrt(2 * apex / g.rampFall), vh = land / (tUp + tDown);
    const yAt = x => { const t = x / vh; return t <= tUp ? rise + v0 * t - .5 * g.boardRise * t * t : apex - .5 * g.rampFall * (t - tUp) ** 2; };
    const xApex = vh * tUp;
    // Fixed take-off point: the highest the feet are while crossing [d, d + w] past the lip.
    return { apex, land, speed, takeoff: vt, xApex, maxOver: (d, w = 3) => xApex >= d && xApex <= d + w ? apex : Math.max(yAt(d), yAt(Math.min(d + w, land))) };
  };
  // Basic moves in rank order: [internal rank, arc key, label].
  const basic = [[0, 'stepoff', 'step off the edge'], [1, 'ollie', 'full ollie from cruise'], [1.5, 'ollieCharged', 'full ollie at 23 m/s'],
    [2, 'foot', 'full jump'], [3, 'double', 'jump + double jump']];
  return { g, arcs, launch, kicker, basic };
}

// ---------------------------------------------------------------------------
/** Vertical probes against ground meshes (as tools/level-geometry-report.mjs): every standable
 * face in a column (upward faces; downward faces too on double-sided meshes), highest first. */
class Surfaces {
  constructor(THREE, meshes, cell = 16) {
    this.cell = cell; this.grid = new Map(); this.big = []; this.byMesh = new Map();
    this.ray = new THREE.Raycaster(); this.ray.firstHitOnly = false;
    this.origin = new THREE.Vector3(); this.down = new THREE.Vector3(0, -1, 0); this.up = new THREE.Vector3(0, 1, 0); this.n = new THREE.Vector3();
    this.rays = 0;
    for (const mesh of meshes) {
      const g = mesh.geometry; if (!g?.getAttribute?.('position')) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox || g.boundingBox.isEmpty()) continue;
      const box = g.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const e = { mesh, box, nm: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), dbl: mats.some(m => m?.side === THREE.DoubleSide) };
      this.byMesh.set(mesh, e);
      const x0 = Math.floor(box.min.x / cell), x1 = Math.floor(box.max.x / cell), z0 = Math.floor(box.min.z / cell), z1 = Math.floor(box.max.z / cell);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { this.big.push(e); continue; }
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(e);
      }
    }
  }
  candidates(x, z, yTop, yBot) {
    const list = this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`), out = [];
    for (const src of [list ?? [], this.big]) for (const e of src) {
      const b = e.box;
      if (x >= b.min.x - 1e-3 && x <= b.max.x + 1e-3 && z >= b.min.z - 1e-3 && z <= b.max.z + 1e-3 && b.min.y <= yTop + 1e-3 && b.max.y >= yBot - 1e-3) out.push(e.mesh);
    }
    return out;
  }
  column(x, z, yTop, yBot) {
    if (!(yTop > yBot)) return [];
    const meshes = this.candidates(x, z, yTop, yBot);
    if (!meshes.length) return [];
    this.rays++;
    this.origin.set(x, yTop, z); this.ray.set(this.origin, this.down); this.ray.near = 0; this.ray.far = yTop - yBot;
    const hits = this.ray.intersectObjects(meshes, false), out = [];
    for (const h of hits) {
      const e = this.byMesh.get(h.object);
      const ny = h.face ? this.n.copy(h.face.normal).applyMatrix3(e.nm).normalize().y : 1;
      if (ny < .45 && !(ny <= -.45 && e.dbl)) continue;
      const last = out[out.length - 1];
      if (last && last.mesh === h.object && Math.abs(last.y - h.point.y) < .02) continue;
      out.push({ y: h.point.y, mesh: h.object, up: ny >= .45 });
    }
    return out;
  }
  /** Lowest face above (x, y, z) within `far`, or null. */
  ceiling(x, y, z, far) {
    const meshes = this.candidates(x, z, y + far, y); if (!meshes.length) return null;
    this.rays++;
    this.origin.set(x, y, z); this.ray.set(this.origin, this.up); this.ray.near = 0; this.ray.far = far;
    const hit = this.ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.y : null;
  }
}

/** XZ hash of axis-aligned boxes (wall colliders, crates). */
class BoxIndex {
  constructor(items, boxOf, cell = 8) {
    this.cell = cell; this.grid = new Map(); this.items = items; this.boxOf = boxOf;
    items.forEach((it, i) => { const b = boxOf(it); if (!b || b.isEmpty()) return;
      for (let x = Math.floor(b.min.x / cell); x <= Math.floor(b.max.x / cell); x++) for (let z = Math.floor(b.min.z / cell); z <= Math.floor(b.max.z / cell); z++) {
        const k = `${x},${z}`; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(i);
      } });
  }
  near(x, z, r = 0) {
    const out = new Set(), c = this.cell;
    for (let gx = Math.floor((x - r) / c); gx <= Math.floor((x + r) / c); gx++) for (let gz = Math.floor((z - r) / c); gz <= Math.floor((z + r) / c); gz++)
      for (const i of this.grid.get(`${gx},${gz}`) ?? []) out.add(i);
    return [...out].map(i => this.items[i]);
  }
}

/** Polyline with arc length; projection is full 3D like Level.laneDirAt (as both sibling audits). */
function makeRoute(THREE, raw) {
  const points = raw.filter((p, i) => i === 0 || p.distanceToSquared(raw[i - 1]) > 1e-4);
  const arc = [0];
  for (let i = 1; i < points.length; i++) arc.push(arc[i - 1] + points[i].distanceTo(points[i - 1]));
  const project = p => {
    let best = Infinity, hit = null;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz;
      if (l2 < 1e-9) continue;
      const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2, 0, 1);
      const cx = a.x + dx * t, cy = a.y + dy * t, cz = a.z + dz * t, d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2;
      if (d2 < best) { best = d2; hit = { i, t, cx, cy, cz }; }
    }
    if (!hit) return { s: 0, dist: p.distanceTo(points[0]), lat: 0, y: points[0].y, fx: 0, fz: -1 };
    const a = points[hit.i], b = points[hit.i + 1], fl = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const fx = (b.x - a.x) / fl, fz = (b.z - a.z) / fl;
    return { s: arc[hit.i] + hit.t * (arc[hit.i + 1] - arc[hit.i]), dist: Math.sqrt(best),
      lat: (p.x - hit.cx) * -fz + (p.z - hit.cz) * fx, y: hit.cy, fx, fz };
  };
  const heads = [];
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x, dz = points[i + 1].z - points[i].z, l = Math.hypot(dx, dz);
    heads.push(l > 1e-6 ? [dx / l, dz / l] : null);
  }
  for (let i = 0; i < heads.length; i++) if (!heads[i]) heads[i] = heads[i - 1] ?? heads.find(Boolean) ?? [0, -1];
  const pointAt = s => {
    s = clamp(s, 0, arc[arc.length - 1]);
    let lo = 0, hi = arc.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arc[m] <= s) lo = m; else hi = m; }
    const i = Math.min(lo, points.length - 2), span = arc[i + 1] - arc[i], t = span > 1e-9 ? (s - arc[i]) / span : 0;
    const a = points[i], b = points[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, fx: heads[i][0], fz: heads[i][1] };
  };
  return { points, arc, length: arc[arc.length - 1], project, pointAt };
}

function chooseRoute(THREE, level) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const spawn = level.spawnPos.clone(), g = level.gateSpec, gate = g ? V(g.x, g.y, g.z) : null;
  const lane = (level.lanePts ?? []).map(q => V(q.x, q.y, q.z));
  let note = '';
  if (lane.length >= 2) {
    const route = makeRoute(THREE, lane), a = route.project(spawn), b = gate ? route.project(gate) : { s: route.length, dist: 0 };
    if (a.dist < 40 && b.dist < 40 && Math.abs(b.s - a.s) >= .5 * route.length)
      return { route, method: 'camnode lane', startS: a.s, endS: b.s, laneNodes: lane.length };
    note = `camnode lane rejected (spawn ${a.dist.toFixed(0)} m, gate ${b.dist.toFixed(0)} m off it, spans ${Math.abs(b.s - a.s).toFixed(0)} of ${route.length.toFixed(0)} m)`;
  }
  const cps = level.checkpoints.map(c => c.mesh.position.clone());
  const rest = cps.slice(), greedy = [spawn];
  while (rest.length) {
    const cur = greedy[greedy.length - 1]; let bi = 0;
    rest.forEach((p, k) => { if (p.distanceTo(cur) < rest[bi].distanceTo(cur)) bi = k; });
    greedy.push(rest.splice(bi, 1)[0]);
  }
  let chain = gate ? [...greedy, gate] : greedy;
  if (gate) {
    const axis = gate.clone().sub(spawn), along = p => p.clone().sub(spawn).dot(axis);
    const alt = [spawn, ...cps.sort((a, b) => along(a) - along(b)), gate], len = pts => sum(pts.slice(1).map((p, i) => p.distanceTo(pts[i])));
    if (len(alt) < len(chain)) chain = alt;
  }
  if (chain.length < 2) chain = [spawn, spawn.clone().add(V(0, 0, -1))];
  const route = makeRoute(THREE, chain);
  return { route, method: 'spawn-checkpoint-gate chain', note, startS: 0, endS: route.length, laneNodes: lane.length };
}

// ---------------------------------------------------------------------------
/** Builds the per-level record from a constructed Level. */
function measureLevel(THREE, level, target, ctx) {
  const { arcs: AR, CONST, TUNING } = ctx, A = AR.arcs, V = (x, y, z) => new THREE.Vector3(x, y, z);
  level.root.updateMatrixWorld(true);
  if (level.crateRailsDirty) level.rebuildCrateRails?.();
  const dataBuilt = !!target.entry.data, comps = level.builtFromData?.components ?? [];
  const killY = level.killY;
  const { route, method, note, startS, endS, laneNodes } = chooseRoute(THREE, level);
  const dir = Math.sign(endS - startS) || 1, L = Math.abs(endS - startS);
  const where = p => { const q = route.project(p); return { prog: (q.s - startS) * dir, lat: q.lat * dir, fx: q.fx * dir, fz: q.fz * dir, off: q.dist }; };
  const at = prog => { const q = route.pointAt(startS + prog * dir), fx = q.fx * dir, fz = q.fz * dir; return { x: q.x, z: q.z, fx, fz, lx: -fz, lz: fx }; };
  const colXZ = (pos, o) => [pos.x + pos.lx * o, pos.z + pos.lz * o];
  const meshBox = mesh => { const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(mesh.matrixWorld); };

  // ---- surface typing (as the geometry audit) ----
  const moverMeshes = new Set(level.movers.map(m => m.mesh));
  const underMover = mesh => { for (let o = mesh; o; o = o.parent) if (moverMeshes.has(o)) return true; return false; };
  const phaseMeshes = new Set(level.phasePads.map(p => p.mesh)), crumbleMeshes = new Set(level.crumbles.map(c => c.mesh));
  const compOf = mesh => { const idx = mesh?.userData?.editorIdx; return dataBuilt && Number.isInteger(idx) ? comps[idx] ?? null : null; };
  const cidOf = obj => { for (let o = obj; o && o !== level.root; o = o.parent) { const i = o.userData?.editorIdx; if (dataBuilt && Number.isInteger(i)) return i; } return null; };
  const typeCache = new Map();
  const surfaceType = mesh => {
    if (!mesh) return 'none';
    if (mesh.isCrateLid) return mesh.kind;
    if (typeCache.has(mesh)) return typeCache.get(mesh);
    const u = mesh.userData, comp = compOf(mesh), name = mesh.name ?? '';
    let t;
    if (underMover(mesh)) t = 'mover';
    else if (phaseMeshes.has(mesh)) t = 'phasepad';
    else if (crumbleMeshes.has(mesh) || u.crumbleId !== undefined) t = 'crumble';
    else if (u.trampolineBounce !== undefined) t = 'trampoline';
    else if (u.speedPadSpeed !== undefined) t = 'speedpad';
    else if (u.finishPad || u.startWarpPad || /warp (plinth|pad)/.test(name)) t = 'gate/warp';
    else if (name === 'bonus platform deck' || comp?.t === 'bonusplatform') t = 'bonusplatform';
    else if (u.bridgeBoard) t = 'bridge-board';
    else if (comp) t = comp.t === 'platform' && comp.pts?.length >= 3 ? 'platform-polygon' : comp.t === 'mesh' && u.vert === true ? 'mesh-vert' : comp.t;
    else if (u.terrainComp) t = 'terrain';
    else if (u.woodPathComp) t = 'woodpath';
    else if (u.vertComp || u.vertRampMesh || u.vert === true) t = 'vertramp';
    else if (u.nativeRampDeck || /ramp|kicker/i.test(name)) t = 'ramp';
    else if (/rock island/i.test(name)) t = 'rock-island';
    else if (/platform|pier|quay|jetty|balcony|terrace|walk|landing|step/i.test(name)) t = 'platform';
    else t = 'mesh';
    typeCache.set(mesh, t);
    return t;
  };
  const nameOf = mesh => mesh ? ((mesh.isCrateLid ? mesh.name : (compOf(mesh)?.nm ?? mesh.name ?? '')).split(' · ')[0].slice(0, 48) || null) : null;
  const walkMeshes = level.groundMeshes.filter(m => !underMover(m));
  const surf = new Surfaces(THREE, walkMeshes);
  const pits = level.pitBoxes;
  const pitAt = (x, z, y) => pits.some(b => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y >= y - .3 && b.max.y <= y + 1 && !level.pitMissesPoly?.(b, x, z));
  const waterAt = (x, z) => level.lethalWaterSurfaceAt?.(x, z) ?? null;
  const badSurface = (h, x, z) => {
    if (h.mesh.userData?.lethal || h.mesh.userData?.outOfBounds || h.y < killY || pitAt(x, z, h.y)) return true;
    const w = waterAt(x, z); return w !== null && w > h.y + .05;
  };
  const fallOutcome = (x, z, yFrom, S = surf) => {
    const h = S.column(x, z, yFrom, killY - 2)[0] ?? null;
    let kind = 'void', y = killY, mesh = null;
    if (h && h.y >= killY) { y = h.y; mesh = h.mesh; kind = h.mesh.userData.lethal ? 'lethal' : h.mesh.userData.outOfBounds ? 'oob' : 'ground'; }
    for (const b of pits) if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= yFrom + .3 && b.max.y >= y - .3 && !level.pitMissesPoly?.(b, x, z)) { kind = 'pit'; y = Math.max(y, b.max.y); }
    const w = waterAt(x, z);
    if (w !== null && w <= yFrom && w > y + .05) { kind = 'water'; y = w; }
    return { kind, y, mesh: kind === 'ground' ? mesh : null };
  };

  // ---- the route walker (verbatim policy of tools/level-geometry-report.mjs) ----
  const OFFS = [0]; for (let d = T.colStep; d <= T.corridor + 1e-9; d += T.colStep) OFFS.push(-r2(d), r2(d));
  const OFFS_WIDE = []; for (let d = T.corridor + .5; d <= T.wide + 1e-9; d += .5) OFFS_WIDE.push(-r2(d), r2(d));
  const bestInBand = (pos, c, f, lo, hi, opt = {}) => {
    let best = null; const seen = new Set();
    for (const d of opt.offsets ?? OFFS) {
      const o = clamp(c + d, -T.cMax, T.cMax), key = Math.round(o * 100);
      if (seen.has(key)) continue; seen.add(key);
      const [x, z] = colXZ(pos, o);
      for (const h of surf.column(x, z, f + hi + .02, f + lo - .02)) {
        if (h.y > f + hi || h.y < f + lo || (opt.upOnly && !h.up) || (opt.noDecor && surfaceType(h.mesh) === 'decor') || badSurface(h, x, z)) continue;
        const score = Math.abs(h.y - f) + .5 * Math.abs(d) + (surfaceType(h.mesh) === 'decor' ? 1.5 : 0);
        if (!best || score < best.score) best = { y: h.y, o, x, z, mesh: h.mesh, score };
        if (opt.any) return best;
      }
      if (d === 0 && best && Math.abs(best.y - f) <= .35) return best;
    }
    return best;
  };
  const standAt = (prog, c, f, any = false) => { const pos = at(prog);
    return bestInBand(pos, c, f, -T.contDown, T.contUp, { any }) ?? bestInBand(pos, c, f, T.contUp, T.climbMax, { upOnly: true, any }); };
  const LANE_COLS = [0, -2, 2, -4, 4, -6, 6];
  const anyAt = (prog, fRef, c, top = 12, offsets = OFFS, bottom = null) => {
    const pos = at(prog); let best = null; const seen = new Set();
    for (const [o0, d] of [...offsets.map(d => [clamp(c + d, -T.cMax, T.cMax), d]), ...LANE_COLS.map(o => [o, Math.abs(o - c)])]) {
      const key = Math.round(o0 * 10); if (seen.has(key)) continue; seen.add(key);
      const [x, z] = colXZ(pos, o0);
      for (const h of surf.column(x, z, fRef + top, bottom === null ? killY - 1 : fRef + bottom)) {
        if (surfaceType(h.mesh) === 'decor' || badSurface(h, x, z)) continue;
        const score = Math.abs(h.y - fRef) + .5 * Math.abs(d);
        if (!best || score < best.score) best = { y: h.y, o: o0, x, z, mesh: h.mesh, score };
      }
    }
    return best;
  };
  const findAny = (from, to, fRef, c, step = T.step, far = false, lvl = false) => {
    for (let s = from; s <= to + 1e-9; s += step) {
      const hit = lvl ? anyAt(s, fRef, c, T.climbMax, OFFS, -3) : far ? anyAt(s, fRef, c, 40, [0, -1.2, 1.2, -2.4, 2.4]) : anyAt(s, fRef, c);
      if (hit) return { prog: s, ...hit };
    }
    return null;
  };
  const refine = (lo, hi, pred, firstTrue = false) => { for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (pred(m) !== firstTrue) lo = m; else hi = m; } return [lo, hi]; };
  const isCrateRail = r => !!level.isCrateRail?.(r);
  const rails = level.rails.filter(r => r.grindable !== false && !isCrateRail(r));
  const moverEnv = level.movers.map(m => {
    const b = meshBox(m.mesh), v = m.axisV.clone().multiplyScalar(m.amp);
    b.union(b.clone().translate(v)).union(b.clone().translate(v.clone().negate()));
    if (m.orbit) b.expandByScalar(Math.max(...m.orbit));
    if (m.spin) { const c = b.getCenter(V(0, 0, 0)), r = Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2; b.min.x = Math.min(b.min.x, c.x - r); b.max.x = Math.max(b.max.x, c.x + r); b.min.z = Math.min(b.min.z, c.z - r); b.max.z = Math.max(b.max.z, c.z + r); }
    return { m, box: b };
  });
  const spinDecks = level.spinBridges.map(b => { const cmp = b.component, [span, , width] = cmp.s ?? [5, .36, 1.2], yaw = (cmp.yaw ?? 0) * Math.PI / 180; return { b, cmp, span, width, yaw, p: cmp.p }; });
  const inSpinDeck = (d, x, z, y) => { const dx = x - d.p[0], dz = z - d.p[2], lx = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw), lz = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
    return lx >= -.5 && lx <= d.span + .5 && Math.abs(lz) <= d.width / 2 + .8 && Math.abs(y - d.p[1]) <= 3; };
  const swingReach = rs => rs.len * Math.sin(Math.min(Math.PI / 2, Math.abs(rs.amp))) + (rs.travel ? Math.abs(rs.travel.amp) : 0) + 1.5;
  const rideAhead = (s0, s1, c0, y0) => {
    for (let s = s0; s <= s1 + 1e-9; s += 1) {
      const [x, z] = colXZ(at(s), c0), P = V(x, y0 + 1, z);
      for (const r of rails) { if (r.distanceLowerBound(P) > 5) continue; const q = r.closest(P); if (Math.hypot(q.point.x - x, q.point.z - z) <= T.corridor + .6 && q.point.y >= y0 - 2 && q.point.y <= y0 + 4) return true; }
      if (moverEnv.some(({ box }) => box.max.y >= y0 - 3 && box.min.y <= y0 + 4 && x >= box.min.x - 1 && x <= box.max.x + 1 && z >= box.min.z - 1 && z <= box.max.z + 1)) return true;
      if (level.ropeSwings.some(rs => rs.anchor.y > y0 && Math.hypot(rs.anchor.x - x, rs.anchor.z - z) <= swingReach(rs))) return true;
      if (spinDecks.some(d => inSpinDeck(d, x, z, y0))) return true;
    }
    return false;
  };
  const onEdge = (prog0, f0, c0) => {
    const [e0, eHi] = refine(prog0, Math.min(L, prog0 + T.step), s => !!standAt(s, c0, f0, true));
    const bottoms = [], end = Math.min(L, e0 + T.scan);
    let lv = null, lower = null;
    for (let s = eHi; s <= end + 1e-9; s += T.step) {
      const hit = standAt(s, c0, f0);
      if (hit) { lv = { s, ...hit }; break; }
      const [x, z] = colXZ(at(s), c0), out = fallOutcome(x, z, f0 - T.contDown);
      bottoms.push({ s, ...out });
      if (!lower && out.kind === 'ground') lower = { s, y: out.y, o: c0, mesh: out.mesh };
    }
    const first = bottoms[0];
    let landing = null, wd = null;
    const ride = !(lv && lv.s - e0 <= T.jumpScan) && rideAhead(e0 + .5, Math.min(L, e0 + 12), c0, f0);
    if (!(lv && lv.s - e0 <= T.jumpScan) && !ride) for (let s = eHi; s <= end + 1e-9; s += T.step) {
      const hit = bestInBand(at(s), c0, f0, -T.contDown, T.contUp, { offsets: OFFS_WIDE, noDecor: true });
      if (hit) { wd = { s, ...hit }; break; }
    }
    const res = h => ({ prog: h.s ?? h.prog, y: h.y, o: h.o, mesh: h.mesh });
    if (lv && lv.s - e0 <= T.jumpScan) landing = lv;
    else if (wd && wd.s <= eHi + 1) return { type: 'shift', resume: res(wd), ride };
    else if (first?.kind === 'ground') return { type: 'drop', resume: { prog: first.s, y: first.y, o: c0, mesh: first.mesh }, ride };
    else if (wd && wd.s - e0 <= T.jumpScan) landing = wd;
    else if (lower && (!lv || lower.s < lv.s) && (!wd || lower.s < wd.s)) landing = lower;
    else if (lv && (!wd || lv.s <= wd.s)) landing = lv;
    else if (wd) landing = wd;
    else {
      const near = findAny(eHi, end, f0, c0, T.step, false, true);
      if (near) landing = { s: near.prog, ...near };
      else {
        const later = findAny(end, Math.min(L, e0 + 2 * T.scan), f0, c0, .5, false, true);
        if (later) return { type: 'void', resume: res(later), ride, e0 };
        const any = findAny(eHi, end, f0, c0); if (any) landing = { s: any.prog, ...any };
      }
    }
    if (!landing) { const far = findAny(end, L, f0, c0, 1, true); return { type: 'void', resume: far ? res(far) : null, ride, e0 }; }
    return { type: 'gap', resume: res(landing), ride, e0 };
  };
  const ground = [];
  // Outline crates and inactive outline surfaces: geometry that exists only after a ! switch.
  const outlineBoxes = [...level.crates.filter(c => c.pending && !c.raceItem).map(c => c.box.clone()), ...(level.outlinedSurfaces ?? []).filter(o => !o.active).map(o => meshBox(o.mesh))];
  /** A leap the walker made across a stretch that outline geometry would bridge. */
  const switchGated = (s0, s1, c0, c1, y0, y1) => {
    if (!outlineBoxes.length) return false;
    const lo = Math.min(y0, y1) - 3, hi = Math.max(y0, y1) + 4;
    for (let s = s0; s <= s1 + 1e-9; s += 1) {
      const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0, [x, z] = colXZ(at(s), c0 + (c1 - c0) * t);
      if (outlineBoxes.some(b => b.max.y >= lo && b.min.y <= hi && rectDist(x, z, b.min.x, b.max.x, b.min.z, b.max.z) <= 3)) return true;
    }
    return false;
  };
  const cpProgs = level.checkpoints.map(cp => where(cp.mesh.position).prog).sort((a, b) => a - b);
  const cpPoints = level.checkpoints.map(cp => ({ p: cp.mesh.position.clone(), prog: where(cp.mesh.position).prog }));
  const sp = level.spawnPos, spw = where(sp);
  {
    let c = clamp(spw.lat, -T.cMax, T.cMax), f = null, prog = 0;
    { const h = surf.column(sp.x, sp.z, sp.y + 1.5, sp.y - 8).find(h => !badSurface(h, sp.x, sp.z)); if (h) f = h.y; }
    if (f === null) { const any = findAny(0, Math.min(L, T.scan), sp.y, c); if (any) { f = any.y; c = any.o; prog = any.prog; } }
    let guard = 0, trusted = true;
    if (f !== null) {
      ground.push([prog, f, c, trusted]);
      while (prog < L - 1e-6 && guard++ < 4e5) {
        const next = Math.min(L, prog + T.step), pos = at(next);
        let cand = bestInBand(pos, c, f, -T.contDown, T.contUp);
        if (!cand) cand = bestInBand(pos, c, f, T.contUp, T.climbMax, { upOnly: true });
        if (cand) {
          if (Math.abs(cand.o) > 1e-6) {
            const o2 = cand.o - Math.sign(cand.o) * Math.min(T.colStep, Math.abs(cand.o)), [x, z] = colXZ(pos, o2);
            const h = surf.column(x, z, cand.y + .37, cand.y - .37).find(h => !badSurface(h, x, z));
            if (h) { cand.o = o2; cand.y = h.y; cand.mesh = h.mesh; }
          }
          if (!trusted) { const [wx, wz] = colXZ(pos, cand.o); if (cpPoints.some(cp => cp.prog > prog - T.step && cp.prog <= next + 1e-9 && cp.p.distanceTo(V(wx, cand.y, wz)) <= 8)) trusted = true; }
          f = cand.y; c = cand.o; prog = next; ground.push([prog, f, c, trusted]);
          continue;
        }
        const ev = onEdge(prog, f, c);
        if (!ev.resume) break;
        // A stretch the walker reaches by leaping beyond every jump across a span that outline
        // geometry (switch-built crates or surfaces) would bridge is not used as a start for the
        // reach search: in the build state it cannot be reached. Trust returns at a ride (rail,
        // mover, swing, spin bridge) or at a checkpoint the walk passes. Other unexplained leaps
        // (portals, launches the walker cannot model) keep the route trusted.
        const leap = ev.resume.prog - (ev.e0 ?? prog);
        if (ev.ride) trusted = true;
        else if (!(ev.type === 'drop' || ev.type === 'shift' || (ev.type === 'gap' && leap <= T.maxJump)) && switchGated(ev.e0 ?? prog, ev.resume.prog, c, ev.resume.o, f, ev.resume.y)) trusted = false;
        prog = Math.max(ev.resume.prog, prog + T.step); f = ev.resume.y; c = ev.resume.o;
        ground.push([prog, f, c, trusted]);
      }
    }
  }
  const gProg = ground.map(g => g[0]);
  const nearestGround = p => { let lo = 0, hi = gProg.length - 1; if (hi < 0) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gProg[m] <= p) lo = m; else hi = m; } return Math.abs(gProg[lo] - p) <= Math.abs(gProg[hi] - p) ? ground[lo] : ground[hi]; };
  const lineAt = p => nearestGround(p)?.[2] ?? 0;
  // The walk did not end on the gate's floor: the route floor near the end is not the course's.
  const endSample = nearestGround(L), walkEndGap = endSample && level.gateSpec ? endSample[1] - level.gateSpec.y : null;
  const walkSuspect = walkEndGap !== null && (Math.abs(walkEndGap) > 5 || Math.abs(endSample[0] - L) > 30);
  // World points of the walked line, one per sample, with a coarse XZ hash.
  const walkPts = ground.map(([prog, f, c, trusted]) => { const [x, z] = colXZ(at(prog), c); return { prog, x, y: f, z, trusted }; });
  const walkHash = new Map(), wkey = (x, z) => `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  for (const w of walkPts) { const k = wkey(w.x, w.z); if (!walkHash.has(k)) walkHash.set(k, []); walkHash.get(k).push(w); }
  const walkNear = (x, z, r) => { const out = []; for (let gx = Math.floor((x - r) / 4); gx <= Math.floor((x + r) / 4); gx++) for (let gz = Math.floor((z - r) / 4); gz <= Math.floor((z + r) / 4); gz++)
    for (const w of walkHash.get(`${gx},${gz}`) ?? []) if (Math.hypot(w.x - x, w.z - z) <= r) out.push(w); return out; };

  // ---- crates, wall colliders, outline geometry ----
  const kindOf = c => c.nitroBang ? 'nitrobang' : c.bang ? 'bang' : c.nitro ? 'nitro' : c.tnt ? 'tnt' : c.metalBounce ? 'metalbounce' : c.bouncy ? 'bouncy' : c.metal ? 'metal'
    : c.multiHit ? 'multihit' : c.life ? 'life' : c.mask ? 'mask' : c.mystery ? 'mystery' : c.empty ? 'empty' : 'wood';
  const crates = level.crates.filter(c => !c.raceItem && !c.concealed && c.alive !== false).map(c => ({ c, kind: kindOf(c), box: c.box.clone(), pending: !!c.pending }));
  const wallIndex = new BoxIndex(level.walls, b => b, 8);
  const insideWall = (x, y, z) => wallIndex.near(x, z).some(b => x > b.min.x + .02 && x < b.max.x - .02 && z > b.min.z + .02 && z < b.max.z - .02 && y > b.min.y && y < b.max.y);
  const outlineMeshes = (level.outlinedSurfaces ?? []).filter(s => !s.active).map(s => s.mesh);
  const outlineCrates = crates.filter(c => c.pending);
  const rampMeshes = level.groundMeshes.filter(mesh => {
    if (underMover(mesh) || mesh.userData.trampolineBounce !== undefined) return false;
    const comp = compOf(mesh), t = surfaceType(mesh), b = meshBox(mesh), long = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    return comp?.t === 'ramp' || ((t === 'ramp' || (comp?.t === 'mesh' && /kicker|ramp|launch/i.test(comp.nm ?? mesh.name ?? '')) || (!comp && /kicker/i.test(mesh.name ?? ''))) && long <= 60);
  });
  const context = levelContext();

  // ---- the crystal ----
  const calls = level.__crystalCalls ?? [], pickup = level.crystalPickup ?? null;
  const call = [...calls].reverse().find(c => c.allowed) ?? calls[calls.length - 1] ?? null;
  const definition = ctx.campaignDef(target.id);
  const base = {
    id: target.id, title: target.title, name: level.name, group: target.group, island: target.island ?? null, islandName: target.islandName ?? null, boss: !!target.boss, source: target.source,
    killY: r2(killY), spawn: P3(level.spawnPos.toArray()), gate: level.gateSpec ? P3([level.gateSpec.x, level.gateSpec.y, level.gateSpec.z]) : null,
    route: { method, length: r1(L), laneNodes, walked: ground.length ? r1(ground[ground.length - 1][0] - ground[0][0]) : 0, walkEndGap: r2(walkEndGap), walkSuspect, ...(note ? { note } : {}) }, checkpoints: cpProgs.map(r1),
    allowsCrystal: !!level.allowsCrystal,
  };
  let status, p = null, why = null;
  if (pickup) { status = 'in-game'; p = call ? [call.x, call.y, call.z] : [(pickup.box.min.x + pickup.box.max.x) / 2, pickup.box.min.y + ENVELOPE.size[1] / 2 - ENVELOPE.centreAbove, (pickup.box.min.z + pickup.box.max.z) / 2]; }
  else if (calls.length) { status = 'suppressed'; p = [call.x, call.y, call.z]; }
  else status = 'none';
  if (!pickup) why = !level.allowsCrystal
    ? (definition?.islandId === 'hidden-shores' ? 'Secret Island course: levelAllowsCrystal() is false' : level.isBossLevel ? 'boss encounter: Level.isBossLevel' : 'levelAllowsCrystal() is false')
    : !ctx.isCampaign(target.id) ? 'not a campaign level, so Level.placeCampaignCrystal() does not run, and none is authored' : 'no crystal authored and no default placed';
  if (!p) return { ...base, crystal: { status, why }, context };
  const [px, py, pz] = p;
  const compIdx = comps.findIndex(c => c.t === 'crystal' && Math.abs(c.p[0] - px) < 1e-3 && Math.abs(c.p[1] - py) < 1e-3 && Math.abs(c.p[2] - pz) < 1e-3);
  const origin = call?.inDefault ? 'default' : 'authored';
  const via = origin === 'default' ? 'Level.placeCampaignCrystal (6 m before the gate along the lane)'
    : compIdx >= 0 ? (dataBuilt ? `level data component #${compIdx}` : `native builder, mirrored as component #${compIdx}`) : 'native builder component list';
  const nm = compIdx >= 0 ? comps[compIdx].nm ?? null : null;

  // ---- the pickup envelope (exact Box3 rule) ----
  const half = CONST.playerHalf, rideH = CONST.railRideHeight ?? .15, riderH = ctx.riderHeight;
  const cbox = pickup ? pickup.box.clone() : new THREE.Box3().setFromCenterAndSize(V(px, py + ENVELOPE.centreAbove, pz), V(...ENVELOPE.size));
  const hx = (cbox.max.x - cbox.min.x) / 2 + half.x, hz = (cbox.max.z - cbox.min.z) / 2 + half.z;
  const yLo = cbox.min.y - riderH, yHi = cbox.max.y;                                  // feet band
  const railLo = cbox.min.y - riderH - rideH, railHi = cbox.max.y + ENVELOPE.grindDrop - rideH; // rail heights a grind collects from
  const qMinX = px - hx, qMaxX = px + hx, qMinZ = pz - hz, qMaxZ = pz + hz;
  const inQ = (x, z) => x >= qMinX - 1e-6 && x <= qMaxX + 1e-6 && z >= qMinZ - 1e-6 && z <= qMaxZ + 1e-6;
  const dQ = (x, z) => rectDist(x, z, qMinX, qMaxX, qMinZ, qMaxZ);
  const envelope = { feet: [r3(yLo - py), r3(yHi - py)], halfXZ: [r2(hx), r2(hz)], railY: [r3(railLo - py), r3(railHi - py)] };

  // ---- relation to the route ----
  const cw = where(V(px, py, pz)), gw = nearestGround(cw.prog);
  const floor = gw ? gw[1] : null, floorGap = gw ? Math.abs(gw[0] - cw.prog) : null;
  const before = cpProgs.filter(c => c <= cw.prog), after = cpProgs.filter(c => c > cw.prog);
  const below = fallOutcome(px, pz, py + .05);
  const gateP = level.gateSpec ? V(level.gateSpec.x, level.gateSpec.y, level.gateSpec.z) : null;
  const routeRec = {
    prog: r1(cw.prog), frac: L > 0 ? r2(cw.prog / L) : null, lat: r1(cw.lat), latWalked: r1(cw.lat - lineAt(cw.prog)), off3d: r1(cw.off),
    toGate: r1(L - cw.prog), gateDist: gateP ? r1(gateP.distanceTo(V(px, py, pz))) : null,
    sec: before.length, sinceCp: before.length ? r1(cw.prog - before[before.length - 1]) : null, toNextCp: after.length ? r1(after[0] - cw.prog) : null,
    floor: r2(floor), aboveFloor: floor === null ? null : r2(py - floor), floorKnown: floorGap !== null && floorGap <= 2, floorGap: r1(floorGap),
    ...(() => { const band = walkPts.filter(w => Math.abs(w.prog - cw.prog) <= 20), near = minBy(walkPts, w => Math.hypot(w.x - px, w.z - pz));
      return { aboveFloorRange20: band.length ? [r2(py - Math.max(...band.map(w => w.y))), r2(py - Math.min(...band.map(w => w.y)))] : null,
        nearestWalk: near ? { d: r1(Math.hypot(near.x - px, near.z - pz)), prog: r1(near.prog), above: r2(py - near.y) } : null }; })(),
    band: Math.abs(cw.lat - lineAt(cw.prog)) <= T.onPath ? 'on-path' : Math.abs(cw.lat - lineAt(cw.prog)) <= T.detour ? 'off-line' : 'detour',
  };
  const belowRec = { kind: below.kind, y: r2(below.y), above: r2(py - below.y), ...(below.mesh ? { t: surfaceType(below.mesh), nm: nameOf(below.mesh) } : {}) };
  const belowSafe = below.kind === 'ground';

  let surfSwitched = null;
  const glow = level.finishGlow && !level.finishGlow.isEmpty() ? level.finishGlow : null;
  const finishTouch = (x, y, z) => !!glow && x + half.x >= glow.min.x && x - half.x <= glow.max.x && z + half.z >= glow.min.z && z - half.z <= glow.max.z && y + riderH >= glow.min.y && y <= glow.max.y;

  // ---- reach graph ----
  const SOLID_LID = new Set(['metal', 'bang', 'nitrobang']);
  const lidSurface = (cr, switched) => SOLID_LID.has(cr.kind) && (!cr.pending || switched);
  function buildGraph(radius, switched) {
    const S = switched ? (surfSwitched ??= new Surfaces(THREE, [...walkMeshes, ...outlineMeshes])) : surf;
    const g = T.grid, n = Math.round(radius / g), N = 2 * n + 1;
    const lids = crates.filter(cr => lidSurface(cr, switched)), lidIndex = new BoxIndex(lids, cr => cr.box, 4);
    const routeNear = walkPts.filter(w => Math.abs(w.x - px) <= radius && Math.abs(w.z - pz) <= radius);
    let yTop = yHi + T.above, yBot = yLo - T.below;
    if (routeNear.length) { yTop = Math.max(yTop, Math.max(...routeNear.map(w => w.y)) + 1); yBot = Math.min(yBot, Math.min(...routeNear.map(w => w.y)) - 1); }
    yBot = Math.max(yBot, killY - 1, yTop - 140);
    const sx = [], sy = [], sz = [], smesh = [], colFirst = new Int32Array(N * N).fill(-1), colCount = new Uint8Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const x = px + (ix - n) * g, z = pz + (iz - n) * g, col = iz * N + ix;
      const faces = [];
      for (const h of S.column(x, z, yTop, yBot)) {
        if (badSurface(h, x, z)) continue;
        faces.push({ y: h.y, mesh: h.mesh });
      }
      for (const cr of lidIndex.near(x, z)) {
        const b = cr.box; if (x < b.min.x || x > b.max.x || z < b.min.z || z > b.max.z || b.max.y > yTop || b.max.y < yBot) continue;
        if (lids.some(o => o !== cr && Math.abs(o.box.min.y - b.max.y) < .1 && x >= o.box.min.x && x <= o.box.max.x && z >= o.box.min.z && z <= o.box.max.z)) continue; // covered by a crate above
        faces.push({ y: b.max.y, mesh: { isCrateLid: true, kind: cr.kind === 'metal' ? 'steel crate' : 'switch crate', name: cr.kind === 'metal' ? 'steel crate lid' : '! switch lid', crate: cr } });
      }
      faces.sort((a, b) => b.y - a.y);
      let first = -1, count = 0;
      for (let k = 0; k < faces.length && count < 250; k++) {
        const h = faces[k];
        if (k > 0 && faces[k - 1].y - h.y < T.headroom) continue;                      // no headroom under the face above
        if (!h.mesh.isCrateLid && S.ceiling(x, h.y + .02, z, T.headroom) !== null) continue;
        if (insideWall(x, h.y + riderH / 2, z)) continue;
        if (h.mesh.userData?.finishPad || finishTouch(x, h.y, z)) continue;   // touching the finish pad or its glow column ends the run
        if (first < 0) first = sx.length;
        sx.push(x); sy.push(h.y); sz.push(z); smesh.push(h.mesh); count++;
      }
      colFirst[col] = first; colCount[col] = count;
    }
    const M = sx.length, parent = new Int32Array(M), links = new Uint8Array(M);
    for (let i = 0; i < M; i++) parent[i] = i;
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const col = iz * N + ix; if (colFirst[col] < 0) continue;
      for (const [jx, jz] of [[ix + 1, iz], [ix, iz + 1]]) {
        if (jx >= N || jz >= N) continue;
        const nc = jz * N + jx; if (colFirst[nc] < 0) continue;
        for (let a = colFirst[col]; a < colFirst[col] + colCount[col]; a++) for (let b = colFirst[nc]; b < colFirst[nc] + colCount[nc]; b++) {
          if (Math.abs(sy[a] - sy[b]) > T.walkStep) continue;
          if (insideWall((sx[a] + sx[b]) / 2, Math.max(sy[a], sy[b]) + .5, (sz[a] + sz[b]) / 2)) continue;
          links[a]++; links[b]++;
          const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb;
        }
      }
    }
    const patchOf = new Int32Array(M), rootId = new Map();
    for (let i = 0; i < M; i++) { const r = find(i); if (!rootId.has(r)) rootId.set(r, rootId.size); patchOf[i] = rootId.get(r); }
    const P = rootId.size;
    const patch = Array.from({ length: P }, () => ({ n: 0, minY: Infinity, maxY: -Infinity, start: null, samples: [] }));
    for (let i = 0; i < M; i++) { const q = patch[patchOf[i]]; q.n++; q.minY = Math.min(q.minY, sy[i]); q.maxY = Math.max(q.maxY, sy[i]); q.samples.push(i); }
    // Start patches: the walked route line inside the grid.
    let untrustedStarts = 0;
    for (const w of routeNear) {
      if (!w.trusted) { untrustedStarts++; continue; }
      const ix0 = Math.round((w.x - px) / g) + n, iz0 = Math.round((w.z - pz) / g) + n;
      let hit = -1;
      for (let dz = -1; dz <= 1 && hit < 0; dz++) for (let dx = -1; dx <= 1 && hit < 0; dx++) {
        const ix = ix0 + dx, iz = iz0 + dz; if (ix < 0 || iz < 0 || ix >= N || iz >= N) continue;
        const col = iz * N + ix; if (colFirst[col] < 0) continue;
        for (let a = colFirst[col]; a < colFirst[col] + colCount[col]; a++) if (Math.abs(sy[a] - w.y) <= .35) { hit = a; break; }
      }
      if (hit >= 0) { const q = patch[patchOf[hit]]; if (q.start === null || Math.abs(w.prog - cw.prog) < Math.abs(q.start - cw.prog)) { q.start = w.prog; q.startSrc = 'route'; } }
    }
    // Anchors the course guarantees: the floor around the finish pad and around each checkpoint
    // (the walker can lose the route; these are reachable by design).
    const anchors = [...(level.gateSpec ? [{ x: level.gateSpec.x, y: level.gateSpec.y, z: level.gateSpec.z, r: 6, src: 'gate', prog: L }] : []),
      ...level.checkpoints.map((cp, k) => ({ x: cp.mesh.position.x, y: cp.box.min.y, z: cp.mesh.position.z, r: 3, src: `checkpoint ${k + 1}`, prog: where(cp.mesh.position).prog }))];
    for (const a of anchors) {
      if (Math.abs(a.x - px) > radius + a.r || Math.abs(a.z - pz) > radius + a.r) continue;
      const span = Math.ceil(a.r / g), ia = Math.round((a.x - px) / g) + n, ja = Math.round((a.z - pz) / g) + n;
      for (let dz = -span; dz <= span; dz++) for (let dx = -span; dx <= span; dx++) {
        const ix = ia + dx, iz = ja + dz; if (ix < 0 || iz < 0 || ix >= N || iz >= N || Math.hypot(dx, dz) * g > a.r) continue;
        const col = iz * N + ix; if (colFirst[col] < 0) continue;
        for (let k = colFirst[col]; k < colFirst[col] + colCount[col]; k++) if (Math.abs(sy[k] - a.y) <= 1.5) {
          const q = patch[patchOf[k]]; if (q.start === null) { q.start = a.prog; q.startSrc = a.src; }
        }
      }
    }
    // Patch-to-patch moves from boundary samples.
    const ledgeOk = i => level.ledgeGrabs !== false && !smesh[i].isCrateLid;   // crate tops are never ledge-grabbable; a level may disable ledge grabs
    const moveClass = (gap, dh, ledge) => {
      if (gap <= .6) {
        if (dh <= T.walkStep) return { r: 0, how: dh < -T.walkStep ? 'drop down' : 'step' };
        if (dh <= REACH.ollieApex) return { r: 1, how: 'hop / ollie up' };
        if (dh <= REACH.footJumpApex) return { r: 2, how: 'jump up' };
        if (dh <= REACH.doubleJumpApex) return { r: 3, how: 'double jump up' };
        if (ledge && dh <= REACH.footJumpApex + REACH.ledgeGrab) return { r: 4, how: 'jump + ledge grab' };
        if (ledge && dh <= REACH.doubleJumpApex + REACH.ledgeGrab) return { r: 4, how: 'double jump + ledge grab' };
        return null;
      }
      for (const [r, key, how] of [[0, 'stepoff', 'step off'], [1, 'ollie', 'ollie gap'], [1.5, 'ollieCharged', 'charged ollie gap'], [2, 'foot', 'jump gap'], [3, 'double', 'double-jump gap']]) {
        const range = A[key].range(dh); if (range !== null && range >= gap) return { r, how };
      }
      if (ledge) for (const [key, how] of [['foot', 'jump gap + ledge grab'], ['double', 'double-jump gap + ledge grab']]) {
        const range = A[key].range(dh - REACH.ledgeGrab); if (range !== null && range >= gap) return { r: 4, how };
      }
      return null;
    };
    const bHash = new Map(), bkey = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    const boundary = [];
    for (let i = 0; i < M; i++) if (links[i] < 4) { boundary.push(i); const k = bkey(sx[i], sz[i]); if (!bHash.has(k)) bHash.set(k, []); bHash.get(k).push(i); }
    const edges = Array.from({ length: P }, () => new Map());
    const R = T.maxJump, cells = Math.ceil(R / 2);
    for (const a of boundary) {
      const pa = patchOf[a], gx = Math.floor(sx[a] / 2), gz = Math.floor(sz[a] / 2), out = edges[pa];
      for (let dx = -cells; dx <= cells; dx++) for (let dz = -cells; dz <= cells; dz++) for (const b of bHash.get(`${gx + dx},${gz + dz}`) ?? []) {
        const pb = patchOf[b]; if (pb === pa) continue;
        const prev = out.get(pb); if (prev && prev.r === 0) continue;
        const r = Math.hypot(sx[b] - sx[a], sz[b] - sz[a]); if (r > R) continue;
        const mc = moveClass(Math.max(0, r - g), sy[b] - sy[a], ledgeOk(b)); if (!mc) continue;
        if (!prev || mc.r < prev.r || (mc.r === prev.r && r < prev.dist)) out.set(pb, { ...mc, dist: r, a, b });
      }
    }
    // Bottleneck search: minimise the hardest move, then the number of non-walking moves.
    const rank = new Float64Array(P).fill(Infinity), steps = new Int32Array(P).fill(1 << 30), prev = new Int32Array(P).fill(-1), via = new Array(P).fill(null);
    const heap = [], push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (cmp(heap[i], heap[j]) >= 0) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
    const cmp = (x, y) => x[0] - y[0] || x[1] - y[1];
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && cmp(heap[l], heap[m]) < 0) m = l; if (r < heap.length && cmp(heap[r], heap[m]) < 0) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    for (let q = 0; q < P; q++) if (patch[q].start !== null) { rank[q] = 0; steps[q] = 0; push([0, 0, q]); }
    while (heap.length) {
      const [rk, st, q] = pop(); if (rk > rank[q] || (rk === rank[q] && st > steps[q])) continue;
      for (const [pb, e] of edges[q]) {
        const nr = Math.max(rk, e.r), ns = st + (e.r > 0 ? 1 : 0);
        if (nr < rank[pb] || (nr === rank[pb] && ns < steps[pb])) { rank[pb] = nr; steps[pb] = ns; prev[pb] = q; via[pb] = e; push([nr, ns, pb]); }
      }
    }
    // Collecting from each reachable patch.
    let bestSafe = null, bestAny = null;
    const consider = c => {
      const better = (x, y) => !y || x.total < y.total || (x.total === y.total && (x.steps < y.steps || (x.steps === y.steps && x.d < y.d)));
      if (better(c, bestAny)) bestAny = c;
      if (c.safe && better(c, bestSafe)) bestSafe = c;
    };
    for (let q = 0; q < P; q++) {
      if (!Number.isFinite(rank[q])) continue;
      for (const i of patch[q].samples) {
        const x = sx[i], y = sy[i], z = sz[i], d = dQ(x, z);
        if (d > R + 1) continue;
        let r = null, how = null, safe = false;
        if (d === 0 && y >= yLo && y <= yHi) { r = 0; how = 'stand inside the pickup envelope'; safe = true; }
        else if (y > yHi) {
          // Dropping in from above: only from a surface edge, and only while the fall still reaches the square.
          if (links[i] < 4 && A.stepoff.maxOver(d) >= yLo - y) { r = 0; how = `drop in from a surface ${r2(y - yLo)} m above the band floor`; safe = belowSafe; }
        } else {
          const rise = yLo - y;
          for (const [mr, key, label] of AR.basic) if (A[key].maxOver(d) >= rise) {
            r = mr; how = rise <= 0 ? `${label} from a surface at band height, ${r2(d)} m from the pickup square` : `${label} from ${r2(rise)} m below the band floor${d > 0 ? `, ${r2(d)} m from the pickup square` : ''}`;
            safe = d === 0 || belowSafe; break;
          }
        }
        if (r === null) continue;
        consider({ total: Math.max(rank[q], r), collect: r, how, safe, patch: q, sample: i, d, steps: steps[q] + (r > 0 ? 1 : 0) });
      }
    }
    const pathOf = q => { const moves = []; for (let k = q, guard = 0; prev[k] >= 0 && guard < 50; k = prev[k], guard++) { const e = via[k];
      moves.unshift({ how: e.how, r: e.r, gap: r2(Math.max(0, e.dist - g)), dh: r2(sy[e.b] - sy[e.a]), from: P3([sx[e.a], sy[e.a], sz[e.a]]), to: P3([sx[e.b], sy[e.b], sz[e.b]]), onto: surfaceType(smesh[e.b]), ontoName: nameOf(smesh[e.b]) }); }
      return { start: patch[k0(q)].start, startSrc: patch[k0(q)].startSrc ?? null, moves }; };
    const k0 = q => { let k = q, guard = 0; while (prev[k] >= 0 && guard++ < 50) k = prev[k]; return k; };
    const describe = c => c && { rank: c.total, class: basicName(c.total), collectRank: c.collect, how: c.how, safe: c.safe, from: P3([sx[c.sample], sy[c.sample], sz[c.sample]]),
      fromSurface: surfaceType(smesh[c.sample]), fromName: nameOf(smesh[c.sample]), d: r2(c.d), ...pathOf(c.patch) };
    // Collection surfaces: standable samples inside the envelope, grouped by surface.
    const groups = new Map();
    for (let i = 0; i < M; i++) if (inQ(sx[i], sz[i]) && sy[i] >= yLo && sy[i] <= yHi) {
      const key = smesh[i].isCrateLid ? smesh[i].crate : smesh[i];
      if (!groups.has(key)) groups.set(key, { mesh: smesh[i], n: 0, lo: Infinity, hi: -Infinity, patches: new Set() });
      const gr = groups.get(key); gr.n++; gr.lo = Math.min(gr.lo, sy[i]); gr.hi = Math.max(gr.hi, sy[i]); gr.patches.add(patchOf[i]);
    }
    const collection = [...groups.values()].map(gr => { const ps = [...gr.patches], rk = Math.min(...ps.map(q => rank[q]));
      return { t: surfaceType(gr.mesh), nm: nameOf(gr.mesh), cid: gr.mesh.isCrateLid ? null : cidOf(gr.mesh), area: r2(gr.n * g * g), feet: [r3(gr.lo - py), r3(gr.hi - py)],
        reach: Number.isFinite(rk) ? basicName(rk) : null, rank: Number.isFinite(rk) ? rk : null, onRoute: ps.some(q => patch[q].start !== null), patchArea: r1(Math.max(...ps.map(q => patch[q].n)) * g * g),
        ...(Number.isFinite(rk) ? { path: pathOf(ps.find(q => rank[q] === rk)).moves.map(m => m.how) } : {}) }; })
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || b.area - a.area);
    // Hop from directly below: the highest standable face under the band inside the square.
    let hop = null;
    for (let i = 0; i < M; i++) if (inQ(sx[i], sz[i]) && sy[i] < yLo) {
      const rise = yLo - sy[i]; if (!hop || rise < hop.rise) hop = { rise, i };
    }
    const hopRec = hop && hop.rise <= REACH.doubleJumpApex + REACH.ledgeGrab ? { rise: r2(hop.rise), surface: surfaceType(smesh[hop.i]), nm: nameOf(smesh[hop.i]), reach: Number.isFinite(rank[patchOf[hop.i]]) ? basicName(rank[patchOf[hop.i]]) : null } : null;
    // How far inside the band the best standing spot is (a few centimetres = a marginal walk).
    let standMargin = null;
    for (let i = 0; i < M; i++) if (inQ(sx[i], sz[i]) && sy[i] >= yLo && sy[i] <= yHi && Number.isFinite(rank[patchOf[i]])) standMargin = Math.max(standMargin ?? -Infinity, Math.min(sy[i] - yLo, yHi - sy[i]));
    const reachable = []; for (let i = 0; i < M; i++) if (Number.isFinite(rank[patchOf[i]])) reachable.push(i);
    return { radius, switched, M, P, boundary: boundary.length, starts: patch.filter(q => q.start !== null).length, untrustedStarts, sx, sy, sz, smesh, patchOf, rank,
      bestSafe: describe(bestSafe), bestAny: describe(bestAny), collection, hop: hopRec, standMargin, reachable, rays: S.rays };
  }
  let graph = buildGraph(T.radius, false);
  if (!graph.bestSafe) { const wide = buildGraph(T.radiusWide, false); if (wide.bestSafe || (!graph.bestAny && wide.bestAny)) graph = wide; }
  // A switch-built path counts too: rerun with every outline crate and outline surface materialised.
  let switched = null;
  const nearOutline = outlineCrates.some(cr => cr.box.distanceToPoint(V(px, py, pz)) <= graph.radius + T.maxJump) ||
    outlineMeshes.some(m => meshBox(m).distanceToPoint(V(px, py, pz)) <= graph.radius + T.maxJump);
  if (nearOutline) {
    const sw = buildGraph(graph.radius, true);
    if (sw.bestSafe && (!graph.bestSafe || sw.bestSafe.rank < graph.bestSafe.rank)) switched = sw;
  }
  const G = switched ?? graph;
  const reachIdx = new Map(); // XZ hash of reachable samples: rank of their patch
  { const hk = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    for (const i of G.reachable) { const k = hk(G.sx[i], G.sz[i]); if (!reachIdx.has(k)) reachIdx.set(k, []); reachIdx.get(k).push(i); } }
  const reachNear = (x, z, r) => { const out = []; for (let gx = Math.floor((x - r) / 2); gx <= Math.floor((x + r) / 2); gx++) for (let gz = Math.floor((z - r) / 2); gz <= Math.floor((z + r) / 2); gz++)
    for (const i of reachIdx.get(`${gx},${gz}`) ?? []) if (Math.hypot(G.sx[i] - x, G.sz[i] - z) <= r) out.push(i); return out; };
  const rankAt = i => G.rank[G.patchOf[i]];
  /** Easiest basic class with which a reachable sample gets the feet within `r` horizontally and up to height y. */
  const reachPoint = (x, y, z, r, lo = -Infinity) => {
    let best = null;
    for (const i of reachNear(x, z, r + T.maxJump)) {
      const dh = y - G.sy[i]; if (dh < lo) continue;
      const d = Math.max(0, Math.hypot(G.sx[i] - x, G.sz[i] - z) - r);
      let mr = null;
      for (const [rk, key] of AR.basic) if (A[key].maxOver(d) >= dh) { mr = rk; break; }
      if (mr === null) continue;
      const tot = Math.max(rankAt(i), mr); if (best === null || tot < best.rank) best = { rank: tot, i };
    }
    return best;
  };

  // ---- special methods ----
  const methods = [];
  const addMethod = (cls, how, extra = {}) => methods.push({ class: cls, how, ...extra });
  // Grind lines: rails through the grind envelope, or a grind ollie into it.
  const edgeSet = new Set(level.surfaceEdgeRails ?? []), crateRailSet = new Set(level.crateRails ?? []);
  const ropeRails = new Set(level.ropes.map(r => r.rail)), movingRailSet = new Set(level.movingRails.map(m => m.rail)), trickRailSet = new Set(level.trickRails.map(t => t.rail));
  const railKind = r => crateRailSet.has(r) || isCrateRail(r) ? 'crate rail' : edgeSet.has(r) ? 'edge' : r.coping ? 'coping' : ropeRails.has(r) ? 'rope' : movingRailSet.has(r) ? 'moving rail' : trickRailSet.has(r) ? 'trick rail' : 'rail';
  const allRails = [...new Set([...level.rails, ...(level.surfaceEdgeRails ?? []), ...(level.crateRails ?? [])])].filter(r => r.grindable !== false);
  const crystalV = V(px, py, pz);
  const railSamples = (r, stepLen) => { const pts = []; for (let i = 0; i < r.points.length - 1; i++) { const a = r.points[i], b = r.points[i + 1], len = a.distanceTo(b), k = Math.max(1, Math.ceil(len / stepLen));
    for (let j = 0; j <= k; j++) pts.push(a.clone().lerp(b, j / k)); } return pts; };
  const catchFromRoute = pts => { let best = null; for (const q of pts) for (const w of walkNear(q.x, q.z, REACH.railCatchRadius)) {
    if (!w.trusted) continue;
    const dh = q.y - w.y; if (dh <= REACH.railCatchAbove && dh >= -REACH.railCatchBelow) { if (!best || Math.abs(w.prog - cw.prog) < Math.abs(best.prog - cw.prog)) best = { prog: w.prog, dh }; } } return best; };
  const catchFromGraph = pts => { let best = null; for (const q of pts) for (const i of reachNear(q.x, q.z, REACH.railCatchRadius)) {
    const dh = q.y - G.sy[i]; if (dh <= REACH.railCatchAbove && dh >= -REACH.railCatchBelow) { const rk = Math.max(rankAt(i), dh > T.walkStep ? 1 : 0); if (!best || rk < best.rank) best = { rank: rk, dh }; } } return best; };
  const railInfo = [];
  for (const r of allRails) {
    if (r.distanceLowerBound(crystalV) > T.railNear + 8) continue;
    const q = r.closest(crystalV), kind = railKind(r), hd = Math.hypot(q.point.x - px, q.point.z - pz);
    if (hd > (kind === 'edge' || kind === 'crate rail' ? T.edgeNear : T.railNear)) continue;
    const near = railSamples(r, .1).filter(s => Math.abs(s.x - px) <= hx + REACH.grindExitSideFull + .5 && Math.abs(s.z - pz) <= hz + REACH.grindExitSideFull + .5);
    const through = near.find(s => inQ(s.x, s.z) && s.y >= railLo && s.y <= railHi) ?? null;
    // A grind exit pops the feet up to 2.30 m (full) above the grinding feet and up to 3.25 m sideways.
    const ollie = through ? null : near.filter(s => dQ(s.x, s.z) <= REACH.grindExitSideFull && s.y + rideH + REACH.grindExitFull >= yLo && s.y + rideH <= yHi)
      .sort((a, b) => dQ(a.x, a.z) - dQ(b.x, b.z))[0] ?? null;
    const pts = railSamples(r, .5);
    const fromRoute = catchFromRoute(pts), fromGraph = catchFromGraph(pts);
    railInfo.push({ r, kind, len: r.totalLength, hd, dh: q.point.y - py, through, ollie, fromRoute, fromGraph, pts });
  }
  for (const ri of railInfo) if ((ri.through || ri.ollie) && !ri.fromRoute && !ri.fromGraph) {
    // One rail-to-rail hop from a catchable line.
    const link = railInfo.find(o => o !== ri && (o.fromRoute || o.fromGraph) && o.pts.some(a => ri.pts.some(b => a.distanceTo(b) <= REACH.railTransfer)));
    if (link) ri.viaRail = link.kind;
  }
  for (const ri of railInfo) {
    if (!(ri.through || ri.ollie) || !(ri.fromRoute || ri.fromGraph || ri.viaRail)) continue;
    const exitTap = ri.ollie && ri.ollie.y + rideH + REACH.grindExitTap >= yLo && dQ(ri.ollie.x, ri.ollie.z) <= REACH.grindExitSideTap;
    const how = `${ri.through ? 'grind through it on' : `${exitTap ? 'tap' : 'full'} grind exit off`} a ${r1(ri.len)} m ${ri.kind} ${ri.through ? `(line ${r2(ri.through.y - py)} m relative to the crystal)` : `(line ${r2(ri.ollie.y - py)} m relative, ${r2(dQ(ri.ollie.x, ri.ollie.z))} m from the pickup square)`}`;
    const catchText = ri.fromRoute ? `caught from the route at ${r1(ri.fromRoute.prog)} m` : ri.fromGraph ? `caught from ground reached by ${basicName(ri.fromGraph.rank)}` : `reached by a rail-to-rail hop from a ${ri.viaRail}`;
    addMethod('grind-line', how, { evidence: catchText, railKind: ri.kind, through: !!ri.through });
  }
  // Vert ramps: coping lines (coping rails, else the top edge of steep vert faces).
  const vertMeshes = level.groundMeshes.filter(m => m.userData.vert === true && !underMover(m));
  const lipPts = [];
  for (const r of allRails) if (r.coping && r.distanceLowerBound(crystalV) <= T.vertNear + 5) for (const s of railSamples(r, .5)) lipPts.push({ x: s.x, y: s.y - .05, z: s.z, src: 'coping rail', len: r.totalLength });
  for (const m of vertMeshes) {
    const b = meshBox(m); if (rectDist(px, pz, b.min.x, b.max.x, b.min.z, b.max.z) > T.vertNear) continue;
    if (lipPts.some(l => l.src === 'coping rail' && l.x >= b.min.x - 1 && l.x <= b.max.x + 1 && l.z >= b.min.z - 1 && l.z <= b.max.z + 1 && Math.abs(l.y - b.max.y) < 1.2)) continue;
    const pos = m.geometry.getAttribute('position'), idx = m.geometry.index, vA = V(0, 0, 0), vB = V(0, 0, 0), vC = V(0, 0, 0), nrm = V(0, 0, 0);
    const tri = idx ? idx.count / 3 : pos.count / 3, pts = [];
    for (let t = 0; t < tri && pts.length < 4000; t++) {
      const ia = idx ? idx.getX(3 * t) : 3 * t, ib = idx ? idx.getX(3 * t + 1) : 3 * t + 1, ic = idx ? idx.getX(3 * t + 2) : 3 * t + 2;
      vA.fromBufferAttribute(pos, ia).applyMatrix4(m.matrixWorld); vB.fromBufferAttribute(pos, ib).applyMatrix4(m.matrixWorld); vC.fromBufferAttribute(pos, ic).applyMatrix4(m.matrixWorld);
      nrm.subVectors(vC, vB).cross(vA.clone().sub(vB)).normalize();
      if (Math.abs(nrm.y) > .5) continue;
      for (const v of [vA, vB, vC]) if (v.y >= b.max.y - .3) pts.push({ x: v.x, y: v.y, z: v.z, src: 'vert face top' });
    }
    lipPts.push(...pts);
  }
  const vertRec = [];
  if (lipPts.length) {
    const near = lipPts.map(l => ({ ...l, hd: Math.hypot(l.x - px, l.z - pz) })).filter(l => l.hd <= T.vertNear).sort((a, b) => a.hd - b.hd);
    const lip = near[0];
    if (lip) {
      const vray = new THREE.Raycaster(), down = V(0, -1, 0);
      const vertBelow = (x, z, top, depth) => { vray.set(V(x, top, z), down); vray.near = 0; vray.far = depth; return vray.intersectObjects(vertMeshes, false)[0] ?? null; };
      const overRamp = !!vertBelow(px, pz, yHi, yHi - lip.y + 25);
      // A spine: the transition falls away on two opposite sides of the coping.
      const probes = Array.from({ length: 8 }, (_, k) => vertBelow(lip.x + 1.5 * Math.cos(k * Math.PI / 4), lip.z + 1.5 * Math.sin(k * Math.PI / 4), lip.y + .5, 12));
      const falls = probes.map(h => !!h && h.point.y < lip.y - .3), spine = falls.some((f, k) => f && falls[(k + 4) % 8]);
      // Quarter (one wall, usually decked) or half pipe, from the vertramp component when one is known.
      const vcomp = probes.map(h => h && (compOf(h.object) ?? h.object.userData.vertComp)).find(Boolean) ?? null;
      const vkind = vcomp?.vkind === 'quarter' ? 'quarter' : 'half';
      const tiers = vkind === 'quarter'
        ? [[REACH.quarterPumped[15], 'pumped air from 15 m/s'], [REACH.quarterPumped[18], 'pumped air from 18 m/s'], [REACH.quarterCoast[23], 'coasting at 23 m/s'], [REACH.quarterPumped[23], 'pumped air from 23 m/s']]
        : [[REACH.halfpipePumped[12], 'pumped air from 12 m/s'], [REACH.halfpipeCoast[18], 'coasting at 18 m/s'], [REACH.halfpipePumped[15], 'pumped air from 15 m/s'], [REACH.halfpipePumped[18], 'pumped air from 18 m/s'],
          [REACH.halfpipeCoast[23], 'coasting at 23 m/s'], [REACH.halfpipePumped[23], 'pumped air from 23 m/s'], [REACH.halfpipeSession, 'pumped session (3-4 swings)']];
      const rise = yLo - lip.y, lateral = lip.hd;
      const entry = reachNear(lip.x, lip.z, 10).find(i => G.sy[i] <= lip.y + .2 && G.sy[i] >= lip.y - 15) ?? null;
      const onLine = lateral <= REACH.vertLateral;
      const tier = rise <= 0 ? [0, 'no air: ride up the transition to the coping'] : tiers.find(([h]) => h >= rise) ?? null;
      const position = onLine ? (overRamp ? 'above the transition' : 'over the coping line') : overRamp ? 'above the transition, off the coping line' : 'beyond the coping';
      vertRec.push({ kind: vkind, copingY: r2(lip.y - py), lipDist: r2(lateral), rise: r2(rise), position, tier: !onLine ? 'out of vert reach' : tier ? tier[1] : 'beyond the measured session cap', spine, ridable: !!entry, src: lip.src,
        ...(onLine ? {} : { note: 'vert airs go straight up and land back on the same face, so only crystals within 1.5 m of a coping line are in vert reach' }) });
      if (entry && onLine && tier && yHi >= lip.y - .1)
        addMethod(spine ? 'transfer' : 'vert-air', `${spine ? 'vert air or spine transfer at' : 'vert air off'} a ${vkind}-pipe coping ${r2(lip.y - py)} m relative to the crystal, ${r2(lateral)} m away: needs ${r2(Math.max(0, rise))} m above the coping (${tier[1]})`,
          { evidence: `measured on a 3.6 m transition; flat in front of it reached by ${basicName(rankAt(entry))}` });
    }
  }
  // Launchers.
  const launchers = [];
  const lidOf = cr => cr.box.max.y;
  for (const cr of crates) {
    if (cr.pending && !switched) continue;
    const d = dQ((cr.box.min.x + cr.box.max.x) / 2, (cr.box.min.z + cr.box.max.z) / 2) - .58;
    const cd = Math.max(0, d); if (cd > T.crateNear) continue;
    const covered = crates.some(o => o !== cr && Math.abs(o.box.min.y - cr.box.max.y) < .1 && Math.abs((o.box.min.x + o.box.max.x) / 2 - (cr.box.min.x + cr.box.max.x) / 2) < .4 && Math.abs((o.box.min.z + o.box.max.z) / 2 - (cr.box.min.z + cr.box.max.z) / 2) < .4);
    if (covered) continue;
    const k = cr.kind, lid = lidOf(cr);
    const kinds = ['wood', 'empty', 'mystery', 'life', 'mask', 'multihit'].includes(k) ? [['crate stomp + double jump', REACH.crateStomp, true]]
      : ['bouncy', 'metalbounce'].includes(k) ? [['arrow bounce + double jump', REACH.arrow, true], ['held arrow bounce + double jump', REACH.arrowHeld, true]] : k === 'tnt' ? [['TNT stomp + double jump', REACH.crateStomp, true]] : [];
    for (const [label, apex, dbl] of kinds) {
      const arc = AR.launch(apex, dbl), reach = lid + arc.maxOver(cd) >= yLo, access = reachPoint((cr.box.min.x + cr.box.max.x) / 2, lid, (cr.box.min.z + cr.box.max.z) / 2, .6);
      launchers.push({ kind: 'crate', what: `${k} crate`, label, top: r2(lid - py), d: r2(cd), apexTop: r2(lid + arc.apex - py), reaches: reach, access: access ? basicName(access.rank) : null });
      if (reach && access && cd <= REACH.launcherRadius) { addMethod('launch-aid', `${label} off a ${k} crate (lid ${r2(lid - py)} m, ${r2(cd)} m from the pickup square)`, { evidence: `crate reached by ${basicName(access.rank)}` }); break; }
    }
  }
  for (const m of level.groundMeshes) {
    if (m.userData.trampolineBounce === undefined) continue;
    const b = meshBox(m), d = Math.max(0, rectDist((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, qMinX, qMaxX, qMinZ, qMaxZ) - Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
    if (d > T.trampolineNear) continue;
    // Measured apexes for the default 16 m/s bounce (x1.25 held); other bounce speeds scale with v^2.
    const v = m.userData.trampolineBounce, held = m.userData.trampolineHeldMult ?? 1, top = b.max.y;
    const apex = REACH.trampolineApex * (v / REACH.trampolineRefSpeed) ** 2, apexHeld = REACH.trampolineHeldApex * (v * held / (REACH.trampolineRefSpeed * REACH.trampolineRefHeld)) ** 2;
    const arc = AR.launch(Math.max(apex, apexHeld), false), reaches = top + arc.maxOver(d) >= yLo, mover = underMover(m);
    const access = mover ? null : reachPoint((b.min.x + b.max.x) / 2, top, (b.min.z + b.max.z) / 2, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
    launchers.push({ kind: 'trampoline', what: mover ? 'moving trampoline' : 'trampoline', top: r2(top - py), d: r2(d), apex: r2(apex), apexHeld: r2(apexHeld), reaches, access: access ? basicName(access.rank) : null });
    if (reaches && access && d <= REACH.trampolineRadius) addMethod('launch-aid', `trampoline bounce (deck ${r2(top - py)} m relative to the crystal, ${r2(d)} m away; apex ${r2(apex)} m, ${r2(apexHeld)} m with Jump held)`, { evidence: `trampoline reached by ${basicName(access.rank)}` });
  }
  for (const e of level.enemies) {
    if (!['grunt', 'turtle', 'hopper'].includes(e.kind)) continue;
    const seg = e.axis === 'z' ? [e.cross, e.x0, e.cross, e.x1] : [e.x0, e.cross, e.x1, e.cross], y0 = e.baseY ?? e.group.position.y;
    let d = Infinity; for (let t = 0; t <= 1.0001; t += .1) d = Math.min(d, dQ(seg[0] + (seg[2] - seg[0]) * t, seg[1] + (seg[3] - seg[1]) * t));
    if (d > T.enemyNear) continue;
    const opts = e.kind === 'turtle' ? [['turtle shell bounce', y0, REACH.turtleAboveFloor, false], ['held turtle bounce + double jump', y0, REACH.turtleHeldDoubleAboveFloor, false]]
      : [['crab stomp + double jump', y0 + REACH.gruntBack, REACH.gruntStomp, true]];
    const access = reachPoint((seg[0] + seg[2]) / 2, y0, (seg[1] + seg[3]) / 2, Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) / 2 + .5);
    for (const [label, top, apex, dbl] of opts) {
      const arc = AR.launch(apex, dbl), reaches = top + arc.maxOver(d) >= yLo;
      launchers.push({ kind: 'enemy', what: e.kind, label, top: r2(top - py), d: r2(d), apexTop: r2(top + arc.apex - py), reaches, access: access ? basicName(access.rank) : null });
      if (reaches && access && d <= REACH.launcherRadius) { addMethod('launch-aid', `${label} (${e.kind} patrol ${r2(d)} m from the pickup square)`, { evidence: `enemy reached by ${basicName(access.rank)}` }); break; }
    }
  }
  // Kickers and launch ramps: the measured ollie-at-the-lip airs, along the ramp's launch direction.
  const kickers = [];
  {
    const kray = new THREE.Raycaster(), down = V(0, -1, 0), nm3 = new THREE.Matrix3();
    for (const mesh of rampMeshes) {
      const b = meshBox(mesh), d0 = rectDist(px, pz, b.min.x, b.max.x, b.min.z, b.max.z); if (d0 > T.kickerNear) continue;
      const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      kray.set(V(cx, b.max.y + 1, cz), down); kray.near = 0; kray.far = b.max.y - b.min.y + 2;
      const hit = kray.intersectObject(mesh, false)[0]; if (!hit?.face) continue;
      nm3.getNormalMatrix(mesh.matrixWorld); const n = hit.face.normal.clone().applyMatrix3(nm3).normalize();
      if (Math.abs(n.y) > .995 || n.y < .2) continue;                                  // flat, or not an up-facing slope
      const fl = Math.hypot(n.x, n.z), dx = -n.x / fl, dz = -n.z / fl;
      const halfAlong = Math.abs(dx) * (b.max.x - b.min.x) / 2 + Math.abs(dz) * (b.max.z - b.min.z) / 2, halfWide = Math.abs(dz) * (b.max.x - b.min.x) / 2 + Math.abs(dx) * (b.max.z - b.min.z) / 2;
      const lipX = cx + dx * halfAlong, lipZ = cz + dz * halfAlong, rise = b.max.y - b.min.y, floorY = b.min.y;
      const along = (px - lipX) * dx + (pz - lipZ) * dz, lat = Math.abs((px - lipX) * -dz + (pz - lipZ) * dx);
      const inLine = lat <= halfWide + hx && along >= -hx;
      const access = reachPoint(cx - dx * halfAlong, floorY, cz - dz * halfAlong, Math.max(1, halfWide));
      let best = null;
      if (inLine) for (const speed of [12, 18, 23]) {
        const arc = AR.kicker(rise, speed); if (!arc) continue;
        const d = Math.max(0, along - hx), lo = yLo - floorY, hi = yHi - floorY;
        const top = arc.maxOver(d, 2 * hx), bottom = Math.min(arc.maxOver(d, 0), arc.maxOver(Math.min(d + 2 * hx, arc.land), 0));
        if (d <= arc.land && top >= lo && bottom <= hi) { best = { speed, apex: arc.apex }; break; }
      }
      kickers.push({ nm: nameOf(mesh), rise: r2(rise), lip: r2(b.max.y - py), d: r2(d0), along: r2(along), lateral: r2(lat), inLine, reaches: !!best, speed: best?.speed ?? null, crest: r1(Math.sqrt(REACH.kickerCrest * rise)), access: access ? basicName(access.rank) : null });
      if (best && access && b.max.y < yLo) addMethod('launch-aid', `kicker air off "${nameOf(mesh) ?? 'ramp'}" (${r2(rise)} m rise, lip ${r2(b.max.y - py)} m relative, crystal ${r2(along)} m past the lip): ollie at the lip from ${best.speed} m/s`,
        { evidence: `measured kicker airs; run-up reached by ${basicName(access.rank)}` });
    }
  }
  // Movers: ride through the envelope, or jump from the deck.
  const movers = [];
  for (const mv of level.movers) {
    const b0 = meshBox(mv.mesh), orbit = mv.orbit ? Math.max(...mv.orbit) : 0, spinR = mv.spin ? Math.hypot(b0.max.x - b0.min.x, b0.max.z - b0.min.z) / 2 : 0;
    { const env = moverEnv.find(e => e.m === mv)?.box; if (env && rectDist(px, pz, env.min.x, env.max.x, env.min.z, env.max.z) > T.moverNear + 2) continue; }
    let best = null, near = Infinity, access = null;
    for (let k = -8; k <= 8; k++) {
      const v = mv.axisV.clone().multiplyScalar(mv.amp * k / 8), b = b0.clone().translate(v).expandByVector(V(orbit + spinR, 0, orbit + spinR));
      const top = b.max.y, d = Math.max(0, rectDist((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, qMinX, qMaxX, qMinZ, qMaxZ) - Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2);
      const overlap = b.max.x >= qMinX && b.min.x <= qMaxX && b.max.z >= qMinZ && b.min.z <= qMaxZ;
      near = Math.min(near, rectDist(px, pz, b.min.x, b.max.x, b.min.z, b.max.z));
      let r = null, how = null;
      if (overlap && top >= yLo && top <= yHi) { r = 0; how = 'ride the deck through the pickup envelope'; }
      else if (top <= yHi) for (const [rk, key, label] of AR.basic) if (A[key].maxOver(overlap ? 0 : d) >= yLo - top) { r = rk; how = `${label} from the deck`; break; }
      if (r !== null && (!best || r < best.r)) best = { r, how, top };
      const acc = reachPoint((b.min.x + b.max.x) / 2, top, (b.min.z + b.max.z) / 2, Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2, -REACH.footJumpApex * 4);
      if (acc && (!access || acc.rank < access.rank)) access = acc;
    }
    if (near > T.moverNear) continue;
    const bounce = mv.mesh.userData.trampolineBounce;
    movers.push({ near: r2(near), axis: mv.orbit ? 'orbit' : mv.axisV.y > .7 ? 'lift' : 'slide', travel: r2(2 * mv.amp), period: mv.speed > 0 ? r2(2 * Math.PI / mv.speed) : null,
      collects: best ? best.how : null, access: access ? basicName(access.rank) : null, ...(bounce !== undefined ? { bounce: r2(bounce) } : {}) });
    if (best && access) addMethod('mover', `${best.how} (${mv.orbit ? 'orbiting' : mv.axisV.y > .7 ? 'lift' : 'sliding'} platform, travel ${r2(2 * mv.amp)} m)`, { evidence: `deck reached by ${basicName(access.rank)}`, moveClass: basicName(best.r) });
  }
  // Rope swings: the hands can hold anywhere along the rope; feet hang 1.0 m below the grip.
  const ropes = [];
  for (const rs of level.ropeSwings) {
    const reachH = swingReach(rs) + 2; if (Math.hypot(rs.anchor.x - px, rs.anchor.z - pz) > T.ropeNear + reachH) continue;
    const dx = Math.cos(rs.yaw), dz = -Math.sin(rs.yaw), travel = rs.travel ? [-1, -.5, 0, .5, 1].map(t => rs.travel.axisV.clone().multiplyScalar(rs.travel.amp * t)) : [V(0, 0, 0)];
    let through = false, nearest = Infinity;
    for (const off of travel) for (let k = -8; k <= 8 && !through; k++) {
      const th = rs.amp * k / 8;
      for (let rr = .5; rr <= rs.len + 1e-9; rr += .5) {
        const gx = rs.anchor.x + off.x + dx * rr * Math.sin(th), gy = rs.anchor.y + off.y - rr * Math.cos(th), gz = rs.anchor.z + off.z + dz * rr * Math.sin(th), feet = gy - ENVELOPE.ropeChest;
        nearest = Math.min(nearest, Math.hypot(gx - px, gz - pz));
        if (inQ(gx, gz) && feet >= yLo && feet <= yHi) { through = true; break; }
      }
    }
    const low = V(rs.anchor.x, rs.anchor.y - rs.len, rs.anchor.z), access = reachPoint(low.x, low.y - ENVELOPE.ropeChest + 1.2, low.z, swingReach(rs));
    ropes.push({ len: r2(rs.len), anchor: r2(rs.anchor.y - py), nearest: r2(nearest), through, access: access ? basicName(access.rank) : null });
    if (through && access) addMethod('mover', `swing on a ${r2(rs.len)} m rope through the pickup envelope`, { evidence: `rope reached by ${basicName(access.rank)}` });
  }
  // Wallrides: wall colliders only (level.walls boxes and wall paths), measured entry heights and wallies.
  const walls = [];
  {
    const reachOut = REACH.wallRideOut + REACH.wallieOut + Math.max(hx, hz);
    const fray = new THREE.Raycaster(), nm3 = new THREE.Matrix3(), nrm = V(0, 0, 0);
    const seenPaths = new Set();
    for (const b of wallIndex.near(px, pz, reachOut + 1)) {
      if (b.max.y < yLo || b.min.y > yHi + 1) continue;
      const path = level.wallPathForBox?.(b) ?? null;
      let nx, nz, faceD, faceX, faceZ, top, bottom, shape;
      if (path) {
        if (seenPaths.has(path)) continue; seenPaths.add(path);
        const c = level.closestWallPath(path, px, pz); if (!c || c.cap) continue;
        nx = c.nx; nz = c.nz; faceD = c.distance - path.halfThickness; faceX = c.x + c.nx * path.halfThickness; faceZ = c.z + c.nz * path.halfThickness; top = c.y + c.height; bottom = c.y; shape = 'wall path';
      } else {
        const alongZ = b.max.x - b.min.x <= b.max.z - b.min.z;
        if (alongZ) { if (pz < b.min.z - hz || pz > b.max.z + hz) continue; const side = px >= (b.min.x + b.max.x) / 2 ? 1 : -1, plane = side > 0 ? b.max.x : b.min.x;
          nx = side; nz = 0; faceD = (px - plane) * side; faceX = plane; faceZ = clamp(pz, b.min.z, b.max.z); }
        else { if (px < b.min.x - hx || px > b.max.x + hx) continue; const side = pz >= (b.min.z + b.max.z) / 2 ? 1 : -1, plane = side > 0 ? b.max.z : b.min.z;
          nx = 0; nz = side; faceD = (pz - plane) * side; faceX = clamp(px, b.min.x, b.max.x); faceZ = plane; }
        top = b.max.y; bottom = b.min.y; shape = 'wall box';
      }
      if (!(faceD > 0) || faceD > reachOut) continue;
      // The visible face: a wall yawed off the 90-degree grid is built from slab colliders and cannot be ridden.
      let offGrid = false;
      { const o = V(px, clamp((yLo + yHi) / 2, bottom + .2, top - .2), pz), dv = V(-nx, 0, -nz); fray.set(o, dv); fray.near = 0; fray.far = faceD + .6;
        const occ = occluders(), cand = occ.index.near(faceX, faceZ, 1.5).filter(e => fray.ray.intersectsBox(e.box)).map(e => e.mesh);
        const h = fray.intersectObjects(cand, false).find(h => h.face);
        if (h) { nm3.getNormalMatrix(h.object.matrixWorld); nrm.copy(h.face.normal).applyMatrix3(nm3).normalize(); if (Math.abs(nrm.y) < .5 && !path && Math.min(Math.abs(nrm.x), Math.abs(nrm.z)) > .17) offGrid = true; } }
      const fx = faceX + nx * .8, fz = faceZ + nz * .8;
      const floorHit = surf.column(fx, fz, Math.min(top, yHi) + .1, killY - 1).find(h => !badSurface(h, fx, fz)) ?? null;
      const floorY = floorHit ? floorHit.y : null;
      const approach = floorY === null ? null : reachNear(fx, fz, 3).find(i => Math.abs(G.sy[i] - floorY) <= .6) ?? null;
      const feeder = floorY === null ? null : rampMeshes.map(m => meshBox(m)).find(rb => rectDist(faceX, faceZ, rb.min.x, rb.max.x, rb.min.z, rb.max.z) <= REACH.kickerFeedRadius && rb.max.y - rb.min.y >= 1.5 && Math.abs(rb.min.y - floorY) <= 1);
      let fit = null, cls = null;
      if (floorY !== null && !offGrid) {
        const onWall = faceD <= REACH.wallRideOut + Math.max(hx, hz);
        if (onWall && floorY + REACH.wallEntryFullOllie[1] >= yLo && floorY + REACH.wallEntryTapOllie[0] <= yHi && top >= yLo) fit = 'ride the wall itself (flat ollie entry, 0.2-1.5 m up)';
        else if (floorY + REACH.wallieApexFlatTap >= yLo && top >= floorY + REACH.wallEntryTapOllie[0]) fit = 'tap-ollie wallride + wallie (feet apex ~4.0 m)';
        else if (floorY + REACH.wallieApexFlatFull >= yLo && top >= floorY + REACH.wallEntryFullOllie[0]) fit = 'full-ollie wallride + 0.5 s pumped wallie (feet apex ~6.3 m)';
        else if (feeder) { const sp = Object.entries(REACH.wallieApexKicker).find(([, h]) => floorY + h >= yLo); if (sp && top >= floorY + REACH.wallEntryKicker[0]) fit = `kicker-fed wallride + wallie from ${sp[0]} m/s (feet apex ~${sp[1]} m)`; }
        cls = fit ? 'wallride' : null;
      }
      walls.push({ d: r2(faceD), shape, top: r2(top - py), floor: floorY === null ? null : r2(floorY - py), floorUp: floorY === null ? null : r2(yLo - floorY), offGrid, fit, access: approach !== null ? basicName(rankAt(approach)) : null });
      if (cls && approach !== null) addMethod('wallride', `${fit}, off a ${shape} ${r2(faceD)} m from the crystal (floor ${r2(floorY - py)} m relative)`, { evidence: `approach floor reached by ${basicName(rankAt(approach))}; wallie lands 4-26 m along the wall` });
    }
    walls.sort((a, b) => (a.fit ? 0 : 1) - (b.fit ? 0 : 1) || a.d - b.d);
    { const seen = new Set(); for (let k = walls.length - 1; k >= 0; k--) { const key = `${r1(walls[k].d)}|${walls[k].fit}|${walls[k].top}`; if (seen.has(key)) walls.splice(k, 1); else seen.add(key); } walls.reverse(); walls.sort((a, b) => (a.fit ? 0 : 1) - (b.fit ? 0 : 1) || a.d - b.d); walls.splice(4); }
  }
  // Speed pads.
  const pads = level.groundMeshes.filter(m => m.userData.speedPadSpeed !== undefined).map(m => { const b = meshBox(m); return { d: r2(rectDist(px, pz, b.min.x, b.max.x, b.min.z, b.max.z)), speed: m.userData.speedPadSpeed }; }).filter(x => x.d <= T.padNear);

  // ---- reach classification ----
  const basicSafe = G.bestSafe, basicAny = G.bestAny;
  const requires = []; if (switched) requires.push('switch (outline crates or surfaces materialised)');
  const cands = [];
  if (basicSafe) cands.push({ class: basicSafe.class, rank: CLASSES.indexOf(basicSafe.class), how: basicSafe.how, safe: true, basic: true });
  for (const m of methods) cands.push({ ...m, rank: CLASSES.indexOf(m.class), safe: true });
  cands.sort((a, b) => a.rank - b.rank || (a.provisional ? 1 : 0) - (b.provisional ? 1 : 0));
  let primary = cands[0] ?? null, leap = null;
  if (basicAny && !basicAny.safe && (!basicSafe || CLASSES.indexOf(basicAny.class) < CLASSES.indexOf(basicSafe.class))) leap = { class: basicAny.class, how: basicAny.how };
  if (!primary && leap) primary = { class: leap.class, rank: CLASSES.indexOf(leap.class), how: `${leap.how}; landing is lethal (${below.kind} below)`, safe: false };
  const reach = {
    class: primary ? primary.class : 'unclear', safe: primary ? primary.safe !== false : null, how: primary?.how ?? 'no basic path, grind line, launcher, mover or vert line found',
    provisional: !!primary?.provisional, requires, leapOfFaith: leap,
    basic: basicSafe ? { class: basicSafe.class, how: basicSafe.how, from: basicSafe.from, fromSurface: basicSafe.fromSurface, fromName: basicSafe.fromName, startFrom: basicSafe.startSrc, routeAt: r1(basicSafe.start), moves: basicSafe.moves } : null,
    methods: Object.values([...methods].sort((a, b) => CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class) || (b.through ? 1 : 0) - (a.through ? 1 : 0)).reduce((acc, m) => { const k = m.class + (m.railKind && m.class === 'grind-line' ? `|${m.railKind}` : ''); if (!acc[k]) acc[k] = { ...m, n: 0 }; acc[k].n++; return acc; }, {}))
      .sort((a, b) => CLASSES.indexOf(a.class) - CLASSES.indexOf(b.class)),
    grid: { radius: G.radius, samples: G.M, patches: G.P, routePatches: G.starts, switched: !!switched },
  };

  // ---- visibility from the route ----
  const target3 = V(px, py + ENVELOPE.meshAbove, pz);
  const vis = visibility(target3, railInfo.filter(ri => ri.through && (ri.fromRoute || ri.fromGraph || ri.viaRail)).sort((a, b) => a.hd - b.hd)[0] ?? null);
  return {
    ...base,
    crystal: { status, why, origin, via, cid: compIdx >= 0 ? compIdx : null, nm, p: P3(p), meshY: r2(py + ENVELOPE.meshAbove), envelope, route: routeRec, below: belowRec,
      collection: { surfaces: G.collection.slice(0, 8), standable: G.collection.length > 0, fromRoute: G.collection.some(c => c.onRoute), standMargin: r3(G.standMargin),
        marginal: G.standMargin !== null && G.standMargin < .05, hop: G.collection.length ? null : G.hop },
      reach, aids: {
        rails: [...new Map(railInfo.filter(ri => ri.kind !== 'edge' && ri.kind !== 'crate rail').sort((a, b) => a.hd - b.hd).map(ri => ({ kind: ri.kind, len: r1(ri.len), hd: r2(ri.hd), dh: r2(ri.dh), through: !!ri.through, grindOllie: !!ri.ollie,
          catch: ri.fromRoute ? `route ${r1(ri.fromRoute.prog)} m` : ri.fromGraph ? basicName(ri.fromGraph.rank) : ri.viaRail ? `via ${ri.viaRail}` : null })).map(r => [`${r.kind}|${r.hd}|${r.dh}|${r.len}`, r])).values()].slice(0, 6),
        edges: (() => { const es = railInfo.filter(ri => ri.kind === 'edge'); const n0 = minBy(es, ri => ri.hd); return { n: es.length, through: es.filter(ri => ri.through).length, nearest: n0 ? { hd: r2(n0.hd), dh: r2(n0.dh) } : null }; })(),
        crateRails: railInfo.filter(ri => ri.kind === 'crate rail').map(ri => ({ len: r1(ri.len), hd: r2(ri.hd), dh: r2(ri.dh), through: !!ri.through })),
        vert: vertRec, kickers: kickers.sort((a, b) => a.d - b.d).slice(0, 4), launchers: launchers.sort((a, b) => a.d - b.d).slice(0, 8), movers: movers.sort((a, b) => a.near - b.near).slice(0, 4),
        ropes: ropes.sort((a, b) => a.nearest - b.nearest).slice(0, 3), walls, pads: pads.sort((a, b) => a.d - b.d).slice(0, 3),
      },
      visibility: vis,
    },
    context,
  };

  // ---- helpers that need the walker ----
  function visibility(tgt, throughRail) {
    const occ = occluders(), ray = new THREE.Raycaster(); ray.firstHitOnly = true;
    // The course camera (src/main.ts, cameraRigFraming in src/cameraRig.ts): outside side-scroll and
    // boulder shots it sits camHeight above the ground under the rider and camDist behind along the
    // course direction, pitched camPitch down with vertical field of view camFov. It never tilts up.
    const rig = cameraRigOf(), pitch = rig.camPitch * Math.PI / 180, halfFov = rig.camFov * Math.PI / 360, aspect = 16 / 9;
    const blocked = (from, to) => {
      const dirv = to.clone().sub(from), far = dirv.length() - .6; if (far <= 0) return false; dirv.normalize();
      ray.set(from, dirv); ray.near = .05; ray.far = far;
      const lo = from.clone().min(to), hi = from.clone().max(to), seg = new THREE.Box3(lo, hi);
      const cand = occ.index.near((lo.x + hi.x) / 2, (lo.z + hi.z) / 2, Math.max(hi.x - lo.x, hi.z - lo.z) / 2 + 1).filter(o => o.box.intersectsBox(seg) && ray.ray.intersectsBox(o.box));
      if (!cand.length) return false;
      return ray.intersectObjects(cand.map(o => o.mesh), false).some(h => h.distance < far);
    };
    let tested = 0, seen = 0, first = null, firstDist = null, closest = null, next = -Infinity;
    let fTested = 0, fTop = 0, fSeen = 0, fFirst = null, bestMargin = -Infinity, bestAt = null;
    for (const [prog, f, c] of ground) {
      if (prog < next) continue; next = prog + T.visEvery;
      const pos = at(prog), [x, z] = colXZ(pos, c), eye = V(x, f + T.eye, z), dist = eye.distanceTo(tgt);
      if (!closest || dist < closest.dist) closest = { prog, dist, floor: f };
      // (1) Line of sight from the rider's eye, within 60 m.
      if (dist <= T.visRange) { tested++; if (!blocked(eye, tgt)) { seen++; if (first === null || prog < first) { first = prog; firstDist = dist; } } }
      // (2) The course camera frame: route samples within 40 m with the crystal ahead of the travel direction.
      const hx2 = tgt.x - x, hz2 = tgt.z - z, dh = Math.hypot(hx2, hz2), alongD = hx2 * pos.fx + hz2 * pos.fz;
      if (dh > T.frameRange || alongD <= 0) continue;
      fTested++;
      const camP = V(x - pos.fx * rig.camDist, f + rig.camHeight, z - pos.fz * rig.camDist);
      const margin = camP.y + (rig.camDist + alongD) * Math.tan(halfFov - pitch) - tgt.y;      // frame-top clearance (m), positive = inside
      if (margin > bestMargin) { bestMargin = margin; bestAt = { prog, d: dh, floor: f }; }
      const fwd = V(pos.fx * Math.cos(pitch), -Math.sin(pitch), pos.fz * Math.cos(pitch)), right = V(-pos.fz, 0, pos.fx), up = right.clone().cross(fwd).negate();
      const v = tgt.clone().sub(camP), depth = v.dot(fwd);
      if (depth <= .3 || margin < 0) continue;
      fTop++;
      if (Math.abs(v.dot(up) / depth) <= Math.tan(halfFov) && Math.abs(v.dot(right) / depth) <= Math.tan(halfFov) * aspect && !blocked(camP, tgt)) {
        fSeen++; if (fFirst === null || prog < fFirst) fFirst = prog;
      }
    }
    // (3) Approaching along the rail the crystal sits on: the rig anchors to the grinding rider (railFollow).
    let railFrame = null;
    if (throughRail) {
      const pts = throughRail.pts, arcs = [0]; for (let k = 1; k < pts.length; k++) arcs.push(arcs[k - 1] + pts[k].distanceTo(pts[k - 1]));
      const k0 = pts.reduce((bi, q, k) => q.distanceTo(crystalV) < pts[bi].distanceTo(crystalV) ? k : bi, 0);
      let n = 0, vis = 0, far = null;
      for (let k = 0; k < pts.length - 1; k++) {
        const ds = arcs[k0] - arcs[k]; if (Math.abs(ds) > T.frameRange || Math.abs(ds) < .5) continue;
        const q = pts[k], q2 = pts[k + 1], tl = Math.hypot(q2.x - q.x, q2.z - q.z); if (tl < 1e-6) continue;
        const sg = Math.sign(ds), fx = (q2.x - q.x) / tl * sg, fz = (q2.z - q.z) / tl * sg, feet = q.y + rideH;
        const camP = V(q.x - fx * rig.camDist, feet + rig.camHeight, q.z - fz * rig.camDist);
        const fwd = V(fx * Math.cos(pitch), -Math.sin(pitch), fz * Math.cos(pitch)), right = V(-fz, 0, fx), up = right.clone().cross(fwd).negate();
        const v = tgt.clone().sub(camP), depth = v.dot(fwd); n++;
        if (depth > .3 && Math.abs(v.dot(up) / depth) <= Math.tan(halfFov) && Math.abs(v.dot(right) / depth) <= Math.tan(halfFov) * aspect && !blocked(camP, tgt)) { vis++; far = Math.max(far ?? 0, Math.abs(ds)); }
      }
      railFrame = { kind: throughRail.kind, tested: n, visible: vis, farthest: r1(far) };
    }
    // (4) From the course's guaranteed anchors (checkpoints, the gate) within 60 m: eye line of sight and
    // the default frame with the camera behind the anchor along the route direction there.
    const anchorViews = [];
    for (const a of [...level.checkpoints.map((cp, k) => ({ src: `checkpoint ${k + 1}`, x: cp.mesh.position.x, y: cp.box.min.y, z: cp.mesh.position.z })),
      ...(level.gateSpec ? [{ src: 'gate', x: level.gateSpec.x, y: level.gateSpec.y, z: level.gateSpec.z }] : [])]) {
      const eye = V(a.x, a.y + T.eye, a.z), d = eye.distanceTo(tgt); if (d > T.visRange) continue;
      const w = where(V(a.x, a.y, a.z)), pos = at(w.prog), los = !blocked(eye, tgt);
      const camP = V(a.x - pos.fx * rig.camDist, a.y + rig.camHeight, a.z - pos.fz * rig.camDist);
      const fwd = V(pos.fx * Math.cos(pitch), -Math.sin(pitch), pos.fz * Math.cos(pitch)), right = V(-pos.fz, 0, pos.fx), up = right.clone().cross(fwd).negate();
      const v = tgt.clone().sub(camP), depth = v.dot(fwd);
      const frame = depth > .3 && Math.abs(v.dot(up) / depth) <= Math.tan(halfFov) && Math.abs(v.dot(right) / depth) <= Math.tan(halfFov) * aspect && !blocked(camP, tgt);
      anchorViews.push({ src: a.src, d: r1(d), above: r2(py - a.y), los, frame });
    }
    const limit = d => rig.camHeight + (rig.camDist + d) * Math.tan(halfFov - pitch) - ENVELOPE.meshAbove; // highest p.y above the rider's floor that is in frame
    return {
      lineOfSight: { tested, visible: seen, first: r1(first), lead: first === null ? null : r1(cw.prog - first), firstDist: r1(firstDist) },
      frame: { rig: { camDist: rig.camDist, camHeight: rig.camHeight, camPitch: rig.camPitch, camFov: rig.camFov, source: rig.source }, airLift: level.cameraAirLift ?? null,
        limitClose: r2(limit(0)), limit20: r2(limit(20)), tested: fTested, insideTop: fTop, visible: fSeen, first: r1(fFirst), lead: fFirst === null ? null : r1(cw.prog - fFirst),
        bestMargin: Number.isFinite(bestMargin) ? r2(bestMargin) : null, bestAt: bestAt ? { prog: r1(bestAt.prog), d: r1(bestAt.d), floor: r2(bestAt.floor - py) } : null, ...(railFrame ? { rail: railFrame } : {}) },
      anchors: anchorViews, routeSuspect: walkSuspect && (cw.prog > L - 80 || !routeRec.floorKnown),
      closest: closest ? { prog: r1(closest.prog), dist: r1(closest.dist), floor: r2(closest.floor - py) } : null, fogFar: level.theme?.fogFar ?? null, occluders: occ.list.length,
    };
  }
  function cameraRigOf() {
    const r = level.cameraRig;
    return r ? { camDist: r.camDist, camHeight: r.camHeight, camPitch: r.camPitch, camFov: r.camFov, source: 'level cameraRig' }
      : { camDist: TUNING.camDist ?? 5.05, camHeight: TUNING.camHeight ?? 5.1, camPitch: TUNING.camPitch ?? 25.35, camFov: TUNING.camFov ?? 49, source: 'TUNING defaults' };
  }
  function occluders() {
    if (occluders.cache) return occluders.cache;
    const crystalGroup = pickup?.group ?? null, list = [];
    const visibleChain = o => { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true; };
    const isCrystal = o => { for (let x = o; x; x = x.parent) if (x === crystalGroup) return true; return false; };
    level.root.traverse(o => {
      if (!o.isMesh || o.isSprite || o.isPoints || o.isLine) return;
      if (!visibleChain(o) || isCrystal(o)) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.every(m => !m || m.visible === false || m.colorWrite === false || (m.transparent && (m.opacity ?? 1) < .6))) return;
      let box;
      try { if (o.isInstancedMesh) { o.computeBoundingBox?.(); box = (o.boundingBox ?? new THREE.Box3()).clone().applyMatrix4(o.matrixWorld); } else box = meshBox(o); } catch { return; }
      if (!box || box.isEmpty()) return;
      list.push({ mesh: o, box });
    });
    occluders.cache = { list, index: new BoxIndex(list, e => e.box, 16) };
    return occluders.cache;
  }
  function levelContext() {
    const authored = rails.filter(r => !(level.surfaceEdgeRails ?? []).includes(r)), ropeSet = new Set(level.ropes.map(r => r.rail));
    const vertBoxes = level.groundMeshes.filter(m => m.userData.vert === true && !underMover(m)).map(meshBox);
    const tramp = level.groundMeshes.filter(m => m.userData.trampolineBounce !== undefined).map(meshBox);
    const ray = new THREE.Raycaster(), nm3 = new THREE.Matrix3(), nrm = V(0, 0, 0);
    const rampBoxes = rampMeshes.map(meshBox);
    let n = 0, withRail = 0, withVert = 0, walled = 0, next = -Infinity;
    const railsNear = new Set(), vertNear = new Set(), trampNear = new Set(), moversNear = new Set(), swingsNear = new Set(), rampsNear = new Set();
    for (const [prog, f, c] of ground) {
      if (prog < next) continue; next = prog + T.ctxEvery; n++;
      const pos = at(prog), [x, z] = colXZ(pos, c), P = V(x, f + 1, z);
      let rail = false;
      for (const r of authored) { if (r.distanceLowerBound(P) > T.ctxRail + 6) continue; const q = r.closest(P); if (Math.hypot(q.point.x - x, q.point.z - z) <= T.ctxRail && q.point.y >= f - 2 && q.point.y <= f + 6) { rail = true; railsNear.add(r); } }
      if (rail) withRail++;
      let vert = false; vertBoxes.forEach((b, i) => { if (rectDist(x, z, b.min.x, b.max.x, b.min.z, b.max.z) <= T.ctxVert && b.max.y >= f - 3 && b.min.y <= f + 6) { vert = true; vertNear.add(i); } });
      if (vert) withVert++;
      tramp.forEach((b, i) => { if (rectDist(x, z, b.min.x, b.max.x, b.min.z, b.max.z) <= 15 && Math.abs(b.max.y - f) <= 6) trampNear.add(i); });
      rampBoxes.forEach((b, i) => { if (rectDist(x, z, b.min.x, b.max.x, b.min.z, b.max.z) <= 15 && b.max.y >= f - 3 && b.min.y <= f + 3) rampsNear.add(i); });
      moverEnv.forEach(({ box }, i) => { if (rectDist(x, z, box.min.x, box.max.x, box.min.z, box.max.z) <= 15 && box.max.y >= f - 6 && box.min.y <= f + 8) moversNear.add(i); });
      level.ropeSwings.forEach((rs, i) => { if (Math.hypot(rs.anchor.x - x, rs.anchor.z - z) <= 15 + swingReach(rs)) swingsNear.add(i); });
      // A wall face within 6 m either side, rising at least 2.5 m above the walked floor.
      let wall = false;
      for (const side of [-1, 1]) {
        const o = V(x, f + 1.2, z), d = V(pos.lx * side, 0, pos.lz * side);
        ray.set(o, d); ray.near = 0; ray.far = T.ctxWall;
        const cand = surf.candidates(x + d.x * 3, z + d.z * 3, f + 4, f + .5).concat(surf.candidates(x + d.x * 5.5, z + d.z * 5.5, f + 4, f + .5));
        for (const h of ray.intersectObjects([...new Set(cand)], false)) { if (!h.face) continue; nm3.getNormalMatrix(h.object.matrixWorld); nrm.copy(h.face.normal).applyMatrix3(nm3).normalize();
          if (Math.abs(nrm.y) < .3) { const top = surf.column(h.point.x + d.x * .05, h.point.z + d.z * .05, f + 40, f + 1.2)[0]?.y ?? f + 40; if (top - f >= 2.5) { wall = true; break; } } }
        if (!wall) for (const b of wallIndex.near(x + d.x * 3, z + d.z * 3, 4)) { if (b.max.y - f < 2.5 || b.min.y > f + 1.2) continue; const p3 = ray.ray.intersectBox(b, V(0, 0, 0)); if (p3 && p3.distanceTo(o) <= T.ctxWall) { wall = true; break; } }
        if (wall) break;
      }
      if (wall) walled++;
    }
    const lenOf = set => r1(sum([...set].map(r => r.totalLength)));
    return { samples: n, railShare: n ? r2(withRail / n) : 0, rails: railsNear.size, railLen: lenOf(railsNear), coping: [...railsNear].filter(r => r.coping).length,
      ropes: [...railsNear].filter(r => ropeSet.has(r)).length, edgeRails: (level.surfaceEdgeRails ?? []).length, vertShare: n ? r2(withVert / n) : 0, vertMeshes: vertNear.size,
      walledShare: n ? r2(walled / n) : 0, trampolines: trampNear.size, movers: moversNear.size, ropeSwings: swingsNear.size, kickers: rampsNear.size,
      camera: { rig: level.cameraRig ? { ...level.cameraRig } : null, airLift: level.cameraAirLift ?? null, lookAhead: level.cameraLookAhead ?? null },
      flags: { ledgeGrabs: level.ledgeGrabs !== false, perfectGrindBoost: !!level.perfectGrindBoost, alwaysSkate: !!level.alwaysSkate } };
  }
}

// ---------------------------------------------------------------------------
const results = [], skipped = [];
let constants;
if (!RENDER_ONLY) await withSkateRuntime(async ({ server, THREE, Level, CONST, TUNING, player }) => {
  const api = await server.ssrLoadModule('/src/level.ts');
  const campaign = await server.ssrLoadModule('/src/campaign.ts');
  const { CAMPAIGN_LEVELS, CAMPAIGN_ISLANDS } = campaign;
  const islandName = id => CAMPAIGN_ISLANDS.find(island => island.id === id)?.name ?? id;
  const { PUZZLE_LEVELS } = await server.ssrLoadModule('/src/levels/puzzle-trilogy.ts');
  const arcs = makeArcs(TUNING);
  // The live rider box (Character Lab stature scales it; 0.936 m for the default character).
  const riderHeight = Number.isFinite(player?.hitboxHalf?.y) ? player.hitboxHalf.y * 2 : ENVELOPE.riderHeightFallback;
  const lo = r3(-.4 - riderHeight), railLo = r3(-.4 - riderHeight - (CONST.railRideHeight ?? .15)), railHi = r3(3 + ENVELOPE.grindDrop - (CONST.railRideHeight ?? .15));
  constants = {
    reachSources: ['docs/crate-bible/data/skate-crate-probe.json (tools/probe-crate-skate-rules.mjs; docs/GAMEPLAY_DESIGN_BIBLE.md Part XV)', 'docs/thps-bible/data/skate-reach-probe.json (tools/probe-skate-reach.mjs)'],
    reach: REACH, envelope: { ...ENVELOPE, riderHeight: r3(riderHeight), playerHalf: CONST.playerHalf, railRideHeight: CONST.railRideHeight,
      rule: `Box3.intersectsBox(playerBox, crystalBox): the rider's centre within ±${1 + CONST.playerHalf.x} m of the crystal on X and on Z, feet between p.y − ${-lo} m and p.y + 3.0 m (rider box ${r3(riderHeight)} m tall). ` +
        `While grinding the box reaches ${ENVELOPE.grindDrop} m below the feet, which ride ${CONST.railRideHeight} m above the rail, so a rail line between p.y − ${-railLo} m and p.y + ${railHi} m collects.` },
    thresholds: T, classes: CLASSES,
    arcs: Object.fromEntries(Object.entries(arcs.arcs).map(([k, a]) => [k, { apex: r2(a.apex), speed: r2(a.vh), xApex: r2(a.xApex), flatRange: r2(a.range(0)) }])),
    gravity: arcs.g, camera: { dist: TUNING.camDist, height: TUNING.camHeight, pitch: TUNING.camPitch, fov: TUNING.camFov },
  };
  const published = JSON.parse(await readFile(path.join(ROOT, 'public/levels.json'), 'utf8')).levels;
  const restored = !STOCK && api.restoreUserLevels(published);
  const overrides = new Set(restored ? api.getUserLevels().map(l => l.id) : []);
  const sourceOf = entry => { const b = api.BUILTIN_LEVELS.find(l => l.id === entry.id); return b === entry ? (b.data ? 'builtin-data' : 'builtin-native') : overrides.has(entry.id) ? 'published-override' : 'source'; };

  const targets = [];
  for (const def of CAMPAIGN_LEVELS) {
    const base = { id: def.levelId, title: def.name, island: def.islandId, islandName: islandName(def.islandId), group: 'campaign', boss: !!def.boss };
    if (ONLY && !ONLY.includes(def.levelId)) continue;
    if (def.placeholder) { skipped.push({ ...base, reason: 'placeholder slot: no level authored yet' }); continue; }
    if (def.competition) { skipped.push({ ...base, reason: 'skate competition (judged trick runs, no platforming route)' }); continue; }
    if (def.skateRace) { skipped.push({ ...base, reason: def.levelId === 'coconut-cart-rally' ? 'cart race' : 'skate race' }); continue; }
    const entry = api.findLevel(def.levelId);
    if (!entry) { skipped.push({ ...base, reason: 'level id not found' }); continue; }
    if (entry.data?.skatepark) { skipped.push({ ...base, reason: 'free-skate park (skatepark: true)' }); continue; }
    targets.push({ ...base, entry, source: sourceOf(entry) });
  }
  for (const entry of PUZZLE_LEVELS) if (!ONLY || ONLY.includes(entry.id))
    targets.push({ id: entry.id, title: entry.name, group: 'puzzle', entry, source: 'source (src/levels/puzzle-trilogy.ts, unregistered)' });
  if (ONLY) for (const id of ONLY) if (!targets.some(t => t.id === id) && !skipped.some(s => s.id === id)) {
    const entry = api.findLevel(id);
    if (entry) targets.push({ id, title: entry.name, group: 'extra', entry, source: sourceOf(entry) });
    else skipped.push({ id, reason: 'level id not found' });
  }
  if (!ONLY) {
    const bonus = api.BUILTIN_LEVELS.filter(l => l.data?.hudMode === 'bonus');
    skipped.push({ id: 'bonus rooms', title: `${bonus.length} bonus stages`, group: 'bonus', reason: `separate bonus-room levels reached from bonus platforms, not CAMPAIGN_LEVELS entries; measure with --levels ${bonus.slice(0, 2).map(b => b.id).join(',')},...` });
  }

  // Record every crystal placement and whether the engine default made it.
  const proto = Level.prototype, origCrystal = proto.crystal, origDefault = proto.placeCampaignCrystal;
  proto.crystal = function (x, y, z) { (this.__crystalCalls ??= []).push({ x, y, z, allowed: !!this.allowsCrystal, inDefault: !!this.__inDefaultCrystal }); return origCrystal.call(this, x, y, z); };
  proto.placeCampaignCrystal = function (...args) { this.__inDefaultCrystal = true; try { return origDefault.apply(this, args); } finally { this.__inDefaultCrystal = false; } };
  const ctx = { arcs, CONST, TUNING, riderHeight, campaignDef: id => campaign.campaignLevelById(id), isCampaign: id => campaign.isCampaignLevel(id) };
  const quiet = () => {};
  console.warn = quiet; console.error = quiet; const rawLog = console.log; console.log = quiet;
  try {
    for (const target of targets) {
      const t0 = Date.now(); let level = null;
      try {
        level = new Level(new THREE.Scene(), target.entry);
        const t1 = Date.now();
        const record = measureLevel(THREE, level, target, ctx);
        record.timing = { buildMs: t1 - t0, measureMs: Date.now() - t1 };
        results.push(record);
        const c = record.crystal;
        log(`${target.id}: ${c.status}${c.origin ? ` (${c.origin})` : ''}${c.p ? ` at ${c.p.join(', ')}, ${c.route.prog} m of ${record.route.length} m, ${c.route.aboveFloor} m above the route floor, reach ${c.reach.class}${c.reach.safe === false ? ' (lethal landing)' : ''}, seen ${c.visibility.lineOfSight.visible}/${c.visibility.lineOfSight.tested}, in frame ${c.visibility.frame.visible}/${c.visibility.frame.tested}` : ` (${c.why})`}; ${Date.now() - t1} ms`);
      } catch (error) {
        results.push({ id: target.id, title: target.title, group: target.group, island: target.island ?? null, source: target.source, error: String(error?.stack ?? error).split('\n').slice(0, 5).join(' | ') });
        log(`${target.id}: FAILED ${String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ')}`);
      } finally { try { level?.dispose(); } catch { /* best effort */ } }
    }
  } finally { console.log = rawLog; proto.crystal = origCrystal; proto.placeCampaignCrystal = origDefault; }
}, { levelEntry: { id: '__crystal_report', name: 'Crystal report', data: { v: 1, name: 'Crystal report', spawn: [0, 1, 0], killY: -20, components: [] } } });


// ---- aggregate ----------------------------------------------------------------
const BINS = {
  frac: [[-Infinity, 0], [0, .25], [.25, .5], [.5, .75], [.75, .9], [.9, 1.0001], [1.0001, Infinity]],
  height: [[-Infinity, .7], [.7, 1.34], [1.34, 3.1], [3.1, 4.2], [4.2, 5.9], [5.9, Infinity]],
};
const binLabel = ([a, b], unit = '') => a === -Infinity ? `< ${b}${unit}` : b === Infinity ? `≥ ${a}${unit}` : `${a}–${b > 1 && b < 1.001 ? 1 : b}${unit}`;
const hist = (xs, bins) => Object.fromEntries(bins.map(b => [binLabel(b), xs.filter(x => x >= b[0] && x < b[1]).length]));
function aggregate(levels) {
  const ok = levels.filter(l => !l.error), withC = st => ok.filter(l => l.crystal?.status === st);
  const inGame = withC('in-game'), sup = withC('suppressed');
  const summarise = list => {
    const cs = list.map(l => l.crystal), known = cs.filter(c => c.route.floorKnown);
    return {
      n: list.length, authored: cs.filter(c => c.origin === 'authored').length, defaults: list.filter(l => l.crystal.origin === 'default').map(l => l.id),
      frac: { median: r2(median(cs.map(c => c.route.frac))), hist: hist(cs.map(c => c.route.frac), BINS.frac) },
      nearGate: list.filter(l => Math.abs(l.crystal.route.toGate) <= T.nearGate).map(l => l.id), beyondGate: list.filter(l => l.crystal.route.toGate < 0).map(l => l.id),
      toGateMedian: r1(median(cs.map(c => c.route.toGate))),
      bands: tally(cs, c => c.route.band), latMedian: r1(median(cs.map(c => Math.abs(c.route.latWalked)))),
      aboveFloor: { n: known.length, median: r2(median(known.map(c => c.route.aboveFloor))), max: r2(Math.max(...known.map(c => c.route.aboveFloor))), hist: hist(known.map(c => c.route.aboveFloor), BINS.height) },
      aboveSupport: { median: r2(median(cs.filter(c => c.below.kind === 'ground').map(c => c.below.above))), hist: hist(cs.filter(c => c.below.kind === 'ground').map(c => c.below.above), BINS.height) },
      belowKinds: tally(cs, c => c.below.kind),
      standable: cs.filter(c => c.collection.standable).length, fromRoute: cs.filter(c => c.collection.fromRoute).length,
      marginal: list.filter(l => l.crystal.collection.marginal).map(l => l.id), hopOnly: list.filter(l => !l.crystal.collection.standable && l.crystal.collection.hop).map(l => l.id),
      classes: tally(cs, c => c.reach.class), unsafe: list.filter(l => l.crystal.reach.safe === false).map(l => l.id),
      leap: list.filter(l => l.crystal.reach.leapOfFaith).map(l => ({ id: l.id, class: l.crystal.reach.leapOfFaith.class })),
      switchGated: list.filter(l => l.crystal.reach.requires.length).map(l => l.id), provisional: list.filter(l => l.crystal.reach.provisional).map(l => l.id),
      methods: tally(cs.flatMap(c => [...new Set(c.reach.methods.map(m => m.class))])),
      throughRail: list.filter(l => l.crystal.aids.rails.some(r => r.through)).map(l => l.id), railNear: cs.filter(c => c.aids.rails.length).length,
      edgeThrough: cs.filter(c => c.aids.edges.through).length, vertNear: cs.filter(c => c.aids.vert.length).length,
      vertOnLine: list.filter(l => l.crystal.aids.vert.some(v => v.lipDist <= REACH.vertLateral)).map(l => l.id),
      wallFit: cs.filter(c => c.aids.walls.some(w => w.fit)).length, kickerNear: cs.filter(c => c.aids.kickers.length).length,
      launchers: tally(cs.flatMap(c => [...new Set(c.aids.launchers.map(x => x.kind))])), moverNear: cs.filter(c => c.aids.movers.length).length, ropeNear: cs.filter(c => c.aids.ropes.length).length,
      los: { seen: cs.filter(c => c.visibility.lineOfSight.visible > 0).length, untested: list.filter(l => !l.crystal.visibility.lineOfSight.tested).map(l => l.id),
        leadMedian: r1(median(cs.map(c => c.visibility.lineOfSight.lead).filter(v => v !== null))) },
      frame: { seen: cs.filter(c => c.visibility.frame.visible > 0).length, untested: list.filter(l => !l.crystal.visibility.frame.tested).map(l => l.id),
        never: list.filter(l => !l.crystal.visibility.routeSuspect && l.crystal.visibility.frame.tested && !l.crystal.visibility.frame.visible).map(l => l.id),
        aboveTop: list.filter(l => !l.crystal.visibility.routeSuspect && l.crystal.visibility.frame.tested && !l.crystal.visibility.frame.insideTop).map(l => l.id),
        rail: list.filter(l => l.crystal.visibility.frame.rail?.visible).map(l => l.id), leadMedian: r1(median(cs.map(c => c.visibility.frame.lead).filter(v => v !== null))) },
      suspect: list.filter(l => l.crystal.visibility.routeSuspect).map(l => l.id),
    };
  };
  const ctx = ok.filter(l => l.group === 'campaign');
  return {
    levels: ok.length, failed: levels.length - ok.length, campaign: ctx.length, puzzle: ok.filter(l => l.group === 'puzzle').length,
    inGame: summarise(inGame), suppressed: { ids: sup.map(l => l.id), ...summarise(sup) },
    none: withC('none').map(l => ({ id: l.id, group: l.group, why: l.crystal.why })),
    context: { rails: ctx.filter(l => l.context.rails > 0).length, railShareMedian: r2(median(ctx.map(l => l.context.railShare))), coping: ctx.filter(l => l.context.coping > 0).length,
      vert: ctx.filter(l => l.context.vertMeshes > 0).length, walledMedian: r2(median(ctx.map(l => l.context.walledShare))), kickers: ctx.filter(l => l.context.kickers > 0).length,
      trampolines: ctx.filter(l => l.context.trampolines > 0).length, movers: ctx.filter(l => l.context.movers > 0).length, swings: ctx.filter(l => l.context.ropeSwings > 0).length,
      rigs: ok.filter(l => l.context.camera.rig).map(l => ({ id: l.id, ...l.context.camera.rig })), airLift: ok.filter(l => l.context.camera.airLift !== null).map(l => ({ id: l.id, airLift: l.context.camera.airLift })),
      lookAhead: ok.filter(l => l.context.camera.lookAhead !== null).map(l => l.id), ledgeOff: ok.filter(l => !l.context.flags.ledgeGrabs).map(l => l.id),
      slipstream: ok.filter(l => l.context.flags.perfectGrindBoost).map(l => l.id), walkSuspect: ok.filter(l => l.route.walkSuspect).map(l => l.id) },
  };
}

// ---- report -------------------------------------------------------------------
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map(r => `| ${r.map(v => v === null || v === undefined || v === '' ? '—' : String(v).replace(/\|/g, '/')).join(' | ')} |`)].join('\n');
const frac = (a, b) => b ? `${a} of ${b} (${Math.round(100 * a / b)}%)` : `${a}`;
const topOf = (m, k = 4) => Object.entries(m ?? {}).sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, v]) => `${key} ${v}`).join(', ') || '—';
const ids = xs => xs.length ? xs.map(x => `\`${x.id ?? x}\``).join(', ') : 'none';
const at3 = p => `(${p.map(v => Math.round(v * 10) / 10).join(', ')})`;
const sgn = v => v === null || v === undefined ? '—' : `${v > 0 ? '+' : ''}${v}`;
const cls = c => CLASS_LABEL[c] ?? c;
const an = w => /^[aeiou]/i.test(String(w)) ? `an ${w}` : `a ${w}`;
const plural = (n, one, many) => n === 1 ? one : many;

/** Rule-based notable examples over the in-game crystals; each rule names its own selection. */
function notableExamples(levels) {
  const live = levels.filter(l => l.crystal?.status === 'in-game'), out = [];
  const add = (l, title, rule, text) => out.push({ level: l.id, course: l.title, title, rule, text });
  const c = l => l.crystal, rk = l => CLASSES.indexOf(c(l).reach.class);
  const desc = l => `${c(l).nm ? `"${c(l).nm}"` : 'unnamed crystal'} at ${at3(c(l).p)}, ${c(l).route.prog} m along the ${l.route.length} m route`;
  // 1. Most demanding easiest way in.
  const hard = maxBy(live, l => rk(l) * 1000 + (c(l).reach.leapOfFaith ? 0 : 100) - c(l).reach.methods.length * 10 - c(l).route.frac);
  if (hard) add(hard, 'Most demanding placement', 'highest reach class; ties: no fatal shortcut, then fewest other methods, then earliest',
    `${desc(hard)}. Easiest survivable way: ${cls(c(hard).reach.class)} — ${c(hard).reach.how}${c(hard).reach.methods[0]?.evidence ? ` (${c(hard).reach.methods.find(m => m.class === c(hard).reach.class)?.evidence ?? ''})` : ''}. ` +
    `${c(hard).below.kind === 'ground' ? `Ground ${c(hard).below.above} m below.` : `Below it: ${c(hard).below.kind}.`}${c(hard).reach.leapOfFaith ? ` ${an(cls(c(hard).reach.leapOfFaith.class))} with a lethal landing also touches it (a soft death keeps the crystal).` : ' No other move found touches it, survivable or not.'}`);
  // 2. Highest above the route floor (known floor).
  const high = maxBy(live.filter(l => c(l).route.floorKnown), l => c(l).route.aboveFloor);
  if (high) add(high, 'Highest above the route floor', 'largest p.y − walked route floor at the crystal\'s progress (known floors only)',
    `${desc(high)}: ${c(high).route.aboveFloor} m above the route floor, ${c(high).below.kind === 'ground' ? `${c(high).below.above} m above "${c(high).below.nm ?? c(high).below.t}" directly under it` : c(high).below.kind + ' under it'}. Reached by ${cls(c(high).reach.class)}: ${c(high).reach.how}.`);
  // 3. Farthest off the walked line.
  const far = maxBy(live, l => Math.abs(c(l).route.latWalked));
  if (far) add(far, 'Farthest off the walked line', 'largest lateral offset from the walked route line',
    `${desc(far)}: ${Math.abs(c(far).route.latWalked)} m to the side (${c(far).route.band}). ${c(far).reach.basic ? `Path from the ${c(far).reach.basic.startFrom ?? 'route'}${c(far).reach.basic.routeAt !== null ? ` at ${c(far).reach.basic.routeAt} m` : ''}: ${c(far).reach.basic.moves.map(m => `${m.how} (${m.gap} m${m.dh ? `, ${sgn(m.dh)} m` : ''})`).join(' → ') || 'on the route'}; then ${c(far).reach.basic.how}.` : ''}`);
  // 4. Earliest in the course.
  const early = minBy(live, l => c(l).route.frac);
  if (early) add(early, 'Earliest in the course', 'lowest progress share', `${desc(early)}: ${Math.round(100 * c(early).route.frac)}% of the way to the gate, ${c(early).route.toGate} m before it. Reach: ${cls(c(early).reach.class)} (${c(early).reach.how}).`);
  // 5. At the finish.
  const fin = live.filter(l => c(l).route.toGate <= T.nearGate && c(l).route.toGate >= 0), last = minBy(fin, l => c(l).route.toGate);
  if (last) add(last, 'Crystal at the finish', `smallest distance before the gate among the ${fin.length} crystals within ${T.nearGate} m of it`,
    `${desc(last)}: ${c(last).route.toGate} m before the gate (${c(last).route.gateDist} m straight-line). Reach: ${cls(c(last).reach.class)} (${c(last).reach.how}). ${fin.length} of ${live.length} crystals sit within ${T.nearGate} m before the gate.`);
  // 6. Beyond the gate.
  const past = minBy(live.filter(l => c(l).route.toGate < 0), l => c(l).route.toGate);
  if (past) add(past, 'Crystal past the gate', 'negative distance to the gate along the route',
    `${desc(past)}: ${-c(past).route.toGate} m beyond the gate along the route (${c(past).origin === 'default' ? 'engine default: Level.placeCampaignCrystal steps 6 m back along Level.laneDirAt(gate), and this level\'s camnode lane is authored from the finish backwards' : 'authored'}). ` +
    `The finish triggers only on the pad or its glow column, so the reach search excludes both; it still finds ${cls(c(past).reach.class)}.`);
  // 7. Standing on the obvious surface does not collect it.
  const hop = minBy(live.filter(l => !c(l).collection.standable && c(l).collection.hop), l => c(l).collection.hop.rise);
  if (hop) add(hop, 'A perch that does not collect by standing', 'no standable surface inside the pickup envelope; smallest hop from directly below',
    `${desc(hop)}: standing on "${c(hop).collection.hop.nm ?? c(hop).collection.hop.surface}" leaves the feet ${c(hop).collection.hop.rise} m under the band floor (p.y − ${-c(hop).envelope.feet[0]} m), so the crystal is taken only in the air: ${c(hop).reach.how}. ` +
    `${live.filter(l => !c(l).collection.standable && c(l).collection.hop).length} crystals are like this.`);
  // 8. Marginal walk.
  const marg = minBy(live.filter(l => c(l).collection.marginal), l => c(l).collection.standMargin);
  if (marg) add(marg, 'A walk-in crystal with centimetres to spare', 'smallest margin inside the band among standing collections',
    `${desc(marg)}: ${c(marg).route.aboveFloor} m above the route floor; the only standing spots are ${c(marg).collection.standMargin} m inside the band floor (p.y − ${-c(marg).envelope.feet[0]} m), on "${c(marg).collection.surfaces[0]?.nm ?? c(marg).collection.surfaces[0]?.t}".`);
  // 9. Never in the course camera frame from the approach.
  const unseen = maxBy(live.filter(l => !c(l).visibility.routeSuspect && c(l).visibility.frame.tested && !c(l).visibility.frame.visible), l => c(l).visibility.frame.tested);
  if (unseen) { const v = c(unseen).visibility.frame;
    add(unseen, 'Never in the course camera frame from the approach', 'most route samples tested (within 40 m, crystal ahead) with none in frame',
      `${desc(unseen)}: 0 of ${v.tested} route samples put the crystal centre in the ${v.rig.source === 'level cameraRig' ? 'level\'s camera rig' : 'default'} frame (camDist ${v.rig.camDist}, camHeight ${v.rig.camHeight}, pitch ${v.rig.camPitch}°, fov ${v.rig.camFov}°)` +
      `${v.insideTop ? `; it clears the frame top from ${v.insideTop} of them but is outside the sides or occluded` : `; it is above the frame top from all of them (best margin ${v.bestMargin} m)`}. Eye line of sight: ${c(unseen).visibility.lineOfSight.visible}/${c(unseen).visibility.lineOfSight.tested}.`); }
  // 10. Longest and shortest sight lead.
  const lead = live.filter(l => !c(l).visibility.routeSuspect && c(l).visibility.lineOfSight.lead > 0), lo = minBy(lead, l => c(l).visibility.lineOfSight.lead);
  if (lo) add(lo, 'Seen latest', 'smallest positive progress lead between the first eye line of sight (≤ 60 m) and the crystal',
    `${desc(lo)}: first visible from the route at ${c(lo).visibility.lineOfSight.first} m, ${c(lo).visibility.lineOfSight.lead} m of progress before it (${c(lo).visibility.lineOfSight.visible}/${c(lo).visibility.lineOfSight.tested} samples within 60 m see it).`);
  // 11. Fatal shortcut.
  const leap = live.filter(l => c(l).reach.leapOfFaith), lf = minBy(leap, l => CLASSES.indexOf(c(l).reach.leapOfFaith.class));
  if (lf) add(lf, 'A fatal shortcut', 'crystals whose easiest touch has a lethal landing; easiest such class shown',
    `${desc(lf)}: reached safely by ${cls(c(lf).reach.class)} (${c(lf).reach.how}), but ${an(c(lf).reach.leapOfFaith.how)} also touches it before a lethal landing (${c(lf).below.kind} below). A crystal touched in mid-air counts at once and survives the soft death; it is banked at the gate. ${leap.length} crystals have such a shortcut.`);
  // 12. Switch-gated.
  const sw = live.find(l => c(l).reach.requires.length);
  if (sw) add(sw, 'Reached only after a switch', 'reach search succeeds only with outline crates and outline surfaces materialised',
    `${desc(sw)}: from the route the path needs switch-built geometry (${c(sw).reach.basic?.moves.map(m => m.ontoName).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'outline geometry'}), then ${c(sw).reach.how}.`);
  // 13. The most skate-equipped course with a walk-in crystal.
  const rich = maxBy(live.filter(l => c(l).reach.class === 'walk'), l => l.context.railShare + l.context.vertShare + l.context.kickers / 50);
  if (rich) add(rich, 'Skate-rich course, walk-in crystal', 'walk-class crystal in the course with the most rails, vert and kickers beside its route',
    `${desc(rich)}: ${Math.round(100 * rich.context.railShare)}% of route samples have an authored rail within ${T.ctxRail} m (${rich.context.rails} rails, ${rich.context.railLen} m, ${rich.context.coping} coping), ${rich.context.vertMeshes} vert surfaces and ${rich.context.kickers} kickers beside the route; ` +
    `the crystal stands ${c(rich).route.aboveFloor} m above the route floor, ${c(rich).route.toGate} m before the gate, collected by walking${c(rich).aids.rails.length ? ` (nearest authored rail ${c(rich).aids.rails[0].hd} m away)` : ''}.`);
  return out;
}

function renderReport(out) {
  const levels = out.levels.filter(l => !l.error), A = out.aggregate, G = A.inGame, X = A.context, C = out.constants;
  const failed = out.levels.filter(l => l.error), live = levels.filter(l => l.crystal?.status === 'in-game'), sup = levels.filter(l => l.crystal?.status === 'suppressed');
  const both = [...live, ...sup], lines = [];
  const camp = levels.filter(l => l.group === 'campaign');
  const noneCamp = A.none.filter(x => x.group === 'campaign'), nonePuz = A.none.filter(x => x.group === 'puzzle');
  lines.push('# Current game crystal audit', '',
    `Generated by \`node tools/crystal-placement-report.mjs\` (commit \`${out.commit ?? 'unknown'}\`); per-level records are in [\`data/current-game-crystals.json\`](data/current-game-crystals.json). ` +
    'This is a factual baseline of where the game places its level crystal (one per level) and what it takes to reach it, measured on the same courses and route lines as the crate and geometry audits ' +
    '([../crate-bible/CURRENT_GAME_AUDIT.md](../crate-bible/CURRENT_GAME_AUDIT.md), [../crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md](../crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md)). ' +
    'It makes no comparison with Tony Hawk\'s Pro Skater; that belongs in the bible. Rerun the script after level changes; it takes about two minutes.', '');
  const cl = G.classes, clText = CLASSES.filter(k => cl[k]).map(k => `${cls(k)} ${cl[k]}`).join(', ');
  lines.push('## Headline numbers', '',
    `- **${G.n} crystals are in play in ${camp.length} campaign courses**: ${G.authored} authored in level data or a native builder, ${G.defaults.length} placed by the engine default (\`Level.placeCampaignCrystal\`, 6 m before the gate): ${ids(G.defaults)}. ` +
      `${noneCamp.length + A.suppressed.n} campaign courses have no crystal in play: ${noneCamp.map(x => `\`${x.id}\` (${x.why})`).join(', ')}${A.suppressed.n ? `, and ${ids(A.suppressed.ids)}, Secret Island courses that author one which \`Level.crystal()\` suppresses (measured separately below)` : ''}. ` +
      `The ${nonePuz.length} puzzle-trilogy levels have none: they are not campaign levels, so the default never runs, and none is authored.${failed.length ? ` ${failed.length} level(s) failed to build: ${ids(failed)}.` : ''}`,
    `- **Where:** median position ${Math.round(100 * G.frac.median)}% of the way from spawn to gate (median ${G.toGateMedian} m before the gate); ${frac(G.nearGate.length, G.n)} sit within ${T.nearGate} m of the gate (${ids(G.nearGate)})` +
      `${G.beyondGate.length ? `, ${ids(G.beyondGate)} past it` : ''}. By lateral offset from the walked line: ${topOf(G.bands, 3)} (on-path ≤ ${T.onPath} m, off-line ≤ ${T.detour} m, detour beyond).`,
    `- **Height:** median ${G.aboveFloor.median} m above the walked route floor at the crystal's progress (highest ${G.aboveFloor.max} m; ${G.aboveFloor.n} crystals with a known floor there) and ${G.aboveSupport.median} m above the surface directly under it. ` +
      `${frac(G.fromRoute, G.n)} can be collected by standing on the route floor itself; ${frac(G.standable, G.n)} by standing anywhere. Under the crystal: ${topOf(G.belowKinds, 5)}.`,
    `- **Reach** (easiest survivable way in, from the measured moves): ${clText}. ${G.leap.length ? `${G.leap.length} more can be touched by a move with a lethal landing, which still counts (${G.leap.map(x => `\`${x.id}\` ${cls(x.class)}`).join(', ')}). ` : ''}` +
      `${G.switchGated.length ? `${ids(G.switchGated)} ${plural(G.switchGated.length, 'needs', 'need')} a ! switch first. ` : ''}${G.marginal.length ? `${ids(G.marginal)} ${plural(G.marginal.length, 'is a marginal walk', 'are marginal walks')} (standing spots within 5 cm of the band floor). ` : ''}${G.hopOnly.length ? `${ids(G.hopOnly)} cannot be collected by standing on the surface under ${plural(G.hopOnly.length, 'it', 'them')}: a hop is needed.` : ''}`,
    `- **Aids near the crystal:** a grind line passes through the pickup envelope for ${frac(G.throughRail.length, G.n)} (${ids(G.throughRail)}); an authored rail lies within ${T.railNear} m of ${G.railNear}; a vert coping within ${T.vertNear} m of ${G.vertNear}${G.vertOnLine.length ? ` (within ${REACH.vertLateral} m of the coping line: ${ids(G.vertOnLine)})` : ''}; a wall a wallride could use for ${G.wallFit}; ${G.kickerNear ? `a kicker within ${T.kickerNear} m of ${G.kickerNear}` : `no kicker within ${T.kickerNear} m of any crystal`}; launchers that reach: ${topOf(G.launchers, 4)}.`,
    `- **Visibility:** an eye line of sight from the walked route within ${T.visRange} m reaches ${frac(G.los.seen, G.n)} (median lead ${G.los.leadMedian} m of progress); the course camera frame under each level's rig shows ${frac(G.frame.seen, G.n)} from route samples within ${T.frameRange} m ahead (median lead ${G.frame.leadMedian} m). ` +
      `${G.frame.never.length ? `Never in frame from the approach: ${ids(G.frame.never)}${G.frame.aboveTop.length ? ` (always above the frame top: ${ids(G.frame.aboveTop)})` : ''}. ` : ''}${G.frame.untested.length ? `No route sample within ${T.frameRange} m ahead: ${ids(G.frame.untested)}. ` : ''}${G.frame.rail.length ? `In frame while grinding the line that passes through its envelope (rail, rope, coping or surface edge): ${ids(G.frame.rail)}.` : ''}${G.suspect.length ? ` Route-based visibility is unreliable for ${ids(G.suspect)} (the walk lost the course near the gate).` : ''}`,
    `- **Camera:** ${X.rigs.length} levels set \`cameraRig\` (${X.rigs.map(r => `\`${r.id}\` ${r.camDist}/${r.camHeight}/${r.camPitch}°/${r.camFov}°`).join(', ') || 'none'}; camDist/camHeight/camPitch/camFov) and ${X.airLift.length} set \`cameraAirLift\` (${X.airLift.map(r => `\`${r.id}\` ${r.airLift}`).join(', ') || 'none'}). ` +
      `With the default rig a crystal centre is in frame only up to ${out.levels.find(l => l.crystal?.visibility?.frame?.rig?.source === 'TUNING defaults')?.crystal.visibility.frame.limitClose ?? '≈3.3'} m (p.y above the rider's floor) at close range.`,
    `- **Level context:** ${frac(X.rails, camp.length)} campaign courses have authored rails beside the walked route (median share of route samples with a rail within ${T.ctxRail} m: ${Math.round(100 * X.railShareMedian)}%); ${X.coping} have coping rails, ${X.vert} vert surfaces, ${X.kickers} kickers, ${X.trampolines} trampolines, ${X.movers} movers and ${X.swings} rope swings near the route. ` +
      `Median share of route samples with a wall face (≥ 2.5 m) within ${T.ctxWall} m: ${Math.round(100 * X.walledMedian)}%.`, '');

  lines.push('## Scope', '', 'Included: every authored campaign platforming course in `CAMPAIGN_LEVELS` plus the three unregistered puzzle-trilogy layouts from `src/levels/puzzle-trilogy.ts` — the same set as the crate and geometry audits. ' +
    (out.levelSources.startsWith('stock') ? 'Run with `--stock`: source data only, public/levels.json ignored.' : 'The published pack (public/levels.json) is restored first, as in a fresh browser.'), '',
    mdTable(['Island', 'Course', 'Level id', 'Source', 'Crystal'], out.scope.included.map(sc => { const l = out.levels.find(x => x.id === sc.id);
      return [sc.islandName ?? (sc.group === 'puzzle' ? 'puzzle contrast' : '—'), sc.title, `\`${sc.id}\``, sc.source, l?.error ? 'failed to build' : l?.crystal?.status === 'in-game' ? `${l.crystal.origin}${l.crystal.nm ? ` — "${l.crystal.nm}"` : ''}` : l?.crystal?.status === 'suppressed' ? `suppressed (authored${l.crystal.nm ? ` "${l.crystal.nm}"` : ''})` : `none — ${l?.crystal?.why}`]; })), '',
    'Skipped:', '', mdTable(['Course', 'Level id', 'Reason'], out.scope.skipped.map(sk => [sk.title ?? '—', `\`${sk.id}\``, sk.reason])), '');

  const R = C.reach, E = C.envelope;
  lines.push('## Method', '',
    '- **Loading and identification.** Each level is built with `new Level(scene, entry)` in the headless `withSkateRuntime` harness after restoring the published pack. `Level.prototype.crystal` and `Level.prototype.placeCampaignCrystal` are wrapped for the run: every crystal call is recorded with its position, whether the level allows a crystal and whether the engine default made it. ' +
      'A crystal is *in-game* when `Level.crystalPickup` exists, *suppressed* when a level authors one but `levelAllowsCrystal()` / `Level.isBossLevel` stops `Level.crystal()` (Secret Island and bosses), *none* otherwise. *Authored* crystals come from a `crystal` component (level data, or a native builder\'s component list); the *default* is `Level.placeCampaignCrystal`.',
    `- **Pickup envelope.** ${E.rule} The visible gem floats at p.y + ${E.meshAbove} m. Source: \`Level.crystal()\` in \`src/level.ts\`, the collection test in \`src/player.ts\`, confirmed by the reach probe's \`crystal-pickup-envelope\` row. A crystal touched in mid-air counts at once, survives a soft death and is banked at the gate (probe row \`crystal-death\`), so a touch with a lethal landing is reported as a *fatal shortcut*.`,
    `- **Route line and walk.** As the geometry audit: the camnode lane when spawn and gate lie within 40 m of it and it spans at least half its length, otherwise spawn → checkpoints → gate; *progress* is arc length from the spawn's projection toward the gate's. The route floor is tracked by the geometry audit's walker (0.25 m steps, ±${T.corridor} m corridor, ≤ ${T.cMax} m drift). ` +
      'A stretch the walker reaches by leaping beyond every jump across a span that outline (switch-built) crates or surfaces would bridge is not used as a start for the reach search until a ride or a checkpoint; other unexplained leaps keep the route trusted. The floor around the finish pad and around each checkpoint is added as a start, because the course reaches them by design.',
    `- **Reach grid.** Vertical probes every ${T.grid} m over a ${2 * T.radius} m square around the crystal (${2 * T.radiusWide} m when the first pass finds no way in) collect every standable face (\`Level.groundMeshes\` minus movers, plus steel and ! crate lids), skipping faces in pits, under lethal water, below \`killY\`, lethal or out-of-bounds meshes, faces without ${T.headroom} m of headroom, points inside wall colliders, the finish pad and its glow column. ` +
      `Neighbouring probes less than ${T.walkStep} m apart in height form walkable patches. Patches are linked by measured moves: a step up of ≤ ${R.ollieApex} m is an ollie, ≤ ${R.footJumpApex} m a jump, ≤ ${R.doubleJumpApex} m a double jump, ≤ ${r2(R.doubleJumpApex + R.ledgeGrab)} m a ledge grab (lip ≤ ${R.ledgeGrab} m above the feet; never crate tops); gaps up to ${T.maxJump} m use the measured flat ranges (foot ${R.footJumpRange} m, double ${R.doubleJumpRange} m, board ${R.ollieRange} m from cruise, ${R.ollieChargedRange} m at 23 m/s), stretched or shortened for the height difference by a two-gravity arc through the measured apex (as the geometry audit). ` +
      'A bottleneck search from the start patches minimises the hardest move, then the number of moves. From every reachable probe the crystal is then collected by standing in the envelope, by dropping in from a surface edge above, or in the air: the arc of each move is tested over the 3 m pickup square at its distance. A touch is *survivable* when it is a vertical hop back onto its own surface or when safe ground lies under the crystal. The search is repeated with every outline crate and outline surface materialised; when only that succeeds the crystal *needs a switch*.',
    `- **Grind lines.** Authored rails (including coping, ropes, moving and trick rails), the systemic edge grinds and crate rails are sampled every 0.1 m. A rail *passes through* the envelope when a point lies inside the pickup square at a collecting rail height; a *grind exit* reaches it when the rail passes within ${R.grindExitSideFull} m of the square and the exit apex (${R.grindExitTap} m tap, ${R.grindExitFull} m full above the grinding feet) reaches the band. ` +
      `The line must be catchable: a rail point within ${R.railCatchRadius} m (horizontal) of a trusted route sample or a reachable probe, between ${R.railCatchBelow} m below and ${R.railCatchAbove} m above its feet, or one rail-to-rail hop (≤ ${R.railTransfer} m) from such a line.`,
    `- **Vert.** Coping lines come from coping rails, else from the top edge of steep faces of vert meshes. Vert airs go straight up and land back on the same face, so a crystal is in vert reach only within ${R.vertLateral} m of a coping line; the air needed above the coping is matched to the measured tiers (half pipe: pumped first air ${Object.entries(R.halfpipePumped).map(([k, v]) => `${k} m/s ${v}`).join(', ')} m, coasting ${Object.entries(R.halfpipeCoast).map(([k, v]) => `${k} m/s ${v}`).join(', ')} m, pumped session ${R.halfpipeSession} m; decked quarter: ${Object.entries(R.quarterPumped).map(([k, v]) => `${k} m/s ${v}`).join(', ')} m pumped, ${R.quarterCoast[23]} m coasting at 23 m/s). ` +
      'A coping with transition on both sides is a spine (vert air or spine transfer from either pipe; class *transfer*). The flat in front of the coping must be reachable.',
    `- **Launchers.** Crates (stomp ${R.crateStomp} m, arrow ${R.arrow} m, held arrow ${R.arrowHeld} m above the lid, each plus a ${R.doubleJumpAdd} m double jump), Coral Crabs (${R.gruntStomp} m above the back) and turtles (${R.turtleAboveFloor} m, held + double ${R.turtleHeldDoubleAboveFloor} m above the floor) within ${R.launcherRadius} m of the pickup square, carried forward at run speed; trampolines within ${R.trampolineRadius} m (${R.trampolineApex} m above the deck, ${R.trampolineHeldApex} m held, scaled with the square of the bounce speed). ` +
      `Kickers and launch ramps use the measured ollie-at-the-lip table (0.8, 1.2 and 1.8 m rises at 12, 18 and 23 m/s; a kicker needs at least √(${R.kickerCrest} × rise) m/s to crest), along the launch direction taken from the ramp face; the crystal must lie in the ramp's launch lane. Every launcher must itself be reachable.`,
    `- **Movers, swings, wallrides.** Movers are swept along their travel (and orbit/spin); a deck that passes through the envelope, or a basic move from the deck, counts. Rope swings: the hands hold anywhere along the rope and the feet hang ${E.ropeChest} m below the grip. Wallrides use only wall colliders (\`level.walls\` boxes and wall paths; a wall whose visible face is off the 90° grid is skipped as a slab collider): ` +
      `riding the wall reaches ${R.wallEntryFullOllie[1]} m above the floor in front of it, a tap-ollie entry + wallie ${R.wallieApexFlatTap} m, a full-ollie entry + 0.5 s pumped wallie ${R.wallieApexFlatFull} m, a kicker-fed entry ${Object.entries(R.wallieApexKicker).map(([k, v]) => `${v} m at ${k} m/s`).join(', ')} (a ≥ 1.5 m kicker within ${R.kickerFeedRadius} m — PROVISIONAL), with the rider at most ${R.wallieOut} m out from the face.`,
    `- **Classification.** The *reach class* is the easiest survivable way found, in the order ${CLASSES.map(cls).join(' < ')}. *Other ways* lists the other methods found (best one per kind). Thresholds are named constants at the top of the script with their sources (${C.reachSources.map(x => `\`${x.split(' ')[0]}\``).join(', ')}); the only provisional value is the kicker-feed radius for wallrides.`,
    `- **Visibility.** (1) *Line of sight*: from the walked floor + ${T.eye} m every ${T.visEvery} m of progress to the gem centre (p.y + ${E.meshAbove} m), for route samples within ${T.visRange} m, against every visible, mostly opaque mesh built in the headless level. ` +
      `(2) *Course frame*: for route samples within ${T.frameRange} m with the crystal ahead of the travel direction, the camera sits camHeight above the walked floor and camDist behind along the route direction, pitched camPitch down with vertical field of view camFov and a 16:9 frame (the level's \`cameraRig\`, else the TUNING defaults: ${C.camera.dist}/${C.camera.height}/${C.camera.pitch}°/${C.camera.fov}°), exactly the course rig of \`src/main.ts\` outside side-scroll and boulder shots with the rider on the ground. ` +
      'The crystal centre must be inside the frustum (the frame top is at elevation camFov/2 − camPitch from the camera, so the centre is in frame only when p.y + 1.75 ≤ floor + camHeight + (camDist + d)·tan(camFov/2 − camPitch), d along the view) and unoccluded from the camera. (3) When a catchable grind line passes through the envelope, the same frame test from points of that line within 40 m, travelling toward the crystal, with the rig anchored to the grinding rider. (4) Views from checkpoints and the gate within 60 m.', '');

  // Per-level tables.
  const crystalRows = both.map(l => { const c = l.crystal; return { l, c }; });
  lines.push('## Per-level tables', '', '### Placement', '',
    mdTable(['Level', 'Course', 'Crystal', 'Position (x, y, z)', 'Progress m (share)', 'Before gate m', 'Off walked line m', 'Above route floor m', 'Above surface below m (what)', 'Checkpoint section'],
      crystalRows.map(({ l, c }) => [`\`${l.id}\``, l.title, `${c.status === 'suppressed' ? 'SUPPRESSED, ' : ''}${c.origin}${c.nm ? `: "${c.nm}"` : ''}`, at3(c.p), `${c.route.prog} (${c.route.frac})`, c.route.toGate,
        `${c.route.latWalked} (${c.route.band})`, c.route.floorKnown ? c.route.aboveFloor : `— (no walked floor at this progress; nearest walked point ${c.route.nearestWalk?.d} m away, ${c.route.nearestWalk?.above} m below)`,
        c.below.kind === 'ground' ? `${c.below.above} (${c.below.nm ?? c.below.t})` : `${c.below.kind} ${c.below.above} m down`, `${c.route.sec}: ${c.route.sinceCp ?? '—'} m after, ${c.route.toNextCp ?? '—'} m before the next`])), '',
    '### Reach', '',
    mdTable(['Level', 'Collected from (feet relative to p.y)', 'Reach class', 'How', 'Path from the start', 'Other ways', 'Fatal shortcut', 'Needs'],
      crystalRows.map(({ l, c }) => { const r = c.reach, s0 = c.collection.surfaces[0];
        return [`\`${l.id}\``, s0 ? `${s0.nm ?? s0.t} (${s0.feet.join(' … ')}${c.collection.marginal ? ', marginal' : ''})${c.collection.surfaces.length > 1 ? ` +${c.collection.surfaces.length - 1}` : ''}` : c.collection.hop ? `none: ${c.collection.hop.rise} m hop from ${c.collection.hop.nm ?? c.collection.hop.surface}` : 'no standing spot',
          `**${cls(r.class)}**${r.safe === false ? ' (lethal landing)' : ''}${r.provisional ? ' (provisional)' : ''}`, r.how,
          r.basic ? `${r.basic.startFrom ?? 'route'}${r.basic.routeAt !== null ? ` @ ${r.basic.routeAt} m` : ''}${r.basic.moves.length ? ': ' + r.basic.moves.map(m => `${m.how} ${m.gap} m${m.dh ? ` (${sgn(m.dh)})` : ''}`).join(' → ') : ''}` : '—',
          r.methods.filter(m => m.class !== r.class || m.how !== r.how).map(m => `${cls(m.class)}${m.railKind ? ` (${m.railKind})` : ''}${m.n > 1 ? ` ×${m.n}` : ''}`).join(', '),
          r.leapOfFaith ? cls(r.leapOfFaith.class) : '', r.requires.join('; ')]; })), '',
    '### Visibility and camera', '',
    mdTable(['Level', 'Eye line of sight (visible / tested, first at m, lead m)', 'Course frame (visible / tested, lead m)', 'Best frame-top margin m (at d m)', 'Rail approach in frame', 'Rig (dist / height / pitch / fov)', 'Air lift', 'Anchor views (line of sight / frame)'],
      crystalRows.map(({ l, c }) => { const v = c.visibility, f = v.frame;
        return [`\`${l.id}\`${v.routeSuspect ? ' (route unreliable)' : ''}`, `${v.lineOfSight.visible}/${v.lineOfSight.tested}${v.lineOfSight.first !== null ? `, ${v.lineOfSight.first}, ${v.lineOfSight.lead}` : ''}`,
          `${f.visible}/${f.tested}${f.lead !== null ? `, ${f.lead}` : ''}`, f.bestMargin !== null ? `${f.bestMargin} (${f.bestAt?.d})` : '—', f.rail ? `${f.rail.visible}/${f.rail.tested} (${f.rail.kind})` : '—',
          `${f.rig.camDist} / ${f.rig.camHeight} / ${f.rig.camPitch}° / ${f.rig.camFov}°${f.rig.source === 'level cameraRig' ? ' (level)' : ''}`, f.airLift ?? '0 (default)',
          v.anchors.map(a => `${a.src} ${a.d} m: ${a.los ? 'seen' : 'hidden'} / ${a.frame ? 'in frame' : 'out'}`).join('; ')]; })), '',
    '### Aids near the crystal', '',
    mdTable(['Level', `Rails ≤ ${T.railNear} m (kind, Δh m, through)`, 'Edge grinds (through)', `Vert ≤ ${T.vertNear} m`, `Kickers ≤ ${T.kickerNear} m`, 'Launchers', 'Movers / swings', 'Walls (wallride)'],
      crystalRows.map(({ l, c }) => { const a = c.aids;
        return [`\`${l.id}\``, a.rails.map(r => `${r.kind} ${r.hd} m, ${sgn(r.dh)}${r.through ? ', through' : r.grindOllie ? ', exit' : ''}`).join('; '), a.edges.n ? `${a.edges.n} (${a.edges.through})` : '',
          a.vert.map(v => `${v.kind}-pipe coping ${sgn(v.copingY)} m, ${v.lipDist} m (${v.position}; ${v.tier}${v.spine ? '; spine' : ''})`).join('; '),
          a.kickers.map(k => `${k.rise} m rise, ${k.d} m${k.inLine ? ` in line${k.reaches ? ` (reaches from ${k.speed} m/s)` : ''}` : ''}`).join('; '),
          a.launchers.filter(x => x.reaches).map(x => `${x.what}${x.label ? ` (${x.label})` : ''} ${x.d} m`).join('; '),
          [...a.movers.map(m => `${m.axis} ${m.near} m${m.collects ? ' (collects)' : ''}`), ...a.ropes.map(r => `swing ${r.nearest} m${r.through ? ' (through)' : ''}`)].join('; '),
          a.walls.map(w => `${w.shape} ${w.d} m${w.offGrid ? ' off-grid' : ''}${w.fit ? `: ${w.fit}` : ''}`).join('; ')]; })), '',
    '### Level context (all built levels)', '',
    mdTable(['Level', 'Crystal', 'Rails beside route (share, count, length m)', 'Coping rails', 'Vert (share, meshes)', 'Walled share', 'Kickers / trampolines / movers / swings', 'Camera'],
      levels.map(l => { const x = l.context; return [`\`${l.id}\``, l.crystal.status === 'in-game' ? cls(l.crystal.reach.class) : l.crystal.status, `${Math.round(100 * x.railShare)}%, ${x.rails}, ${x.railLen}`, x.coping, `${Math.round(100 * x.vertShare)}%, ${x.vertMeshes}`,
        `${Math.round(100 * x.walledShare)}%`, `${x.kickers} / ${x.trampolines} / ${x.movers} / ${x.ropeSwings}`, [x.camera.rig ? `rig ${x.camera.rig.camDist}/${x.camera.rig.camHeight}/${x.camera.rig.camPitch}°/${x.camera.rig.camFov}°` : '', x.camera.airLift !== null ? `air lift ${x.camera.airLift}` : '', x.camera.lookAhead !== null ? `look-ahead ${x.camera.lookAhead}` : ''].filter(Boolean).join(', ')]; })), '');

  const row = (label, f) => [label, f(G), A.suppressed.n ? f(A.suppressed) : '—'];
  lines.push('## Aggregate statistics', '', mdTable(['Measure', `In-game crystals (${G.n})`, `Suppressed authored (${A.suppressed.n})`], [
    row('Authored / engine default', a => `${a.authored} / ${a.defaults.length}`),
    row('Progress share: median; histogram', a => `${a.frac.median}; ${Object.entries(a.frac.hist).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}`),
    row(`Within ${T.nearGate} m of the gate / past the gate`, a => `${a.nearGate.length} / ${a.beyondGate.length}`),
    row('Distance before the gate: median m', a => a.toGateMedian),
    row('Lateral band (on-path / off-line / detour); median |offset| m', a => `${a.bands['on-path'] ?? 0} / ${a.bands['off-line'] ?? 0} / ${a.bands.detour ?? 0}; ${a.latMedian}`),
    row('Above the route floor m: median, max; histogram', a => `${a.aboveFloor.median}, ${a.aboveFloor.max}; ${Object.entries(a.aboveFloor.hist).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}`),
    row('Above the surface directly below m: median; histogram', a => `${a.aboveSupport.median}; ${Object.entries(a.aboveSupport.hist).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ')}`),
    row('Under the crystal', a => topOf(a.belowKinds, 5)),
    row('Collectable standing: on the route floor / anywhere; marginal; hop only', a => `${a.fromRoute} / ${a.standable}; ${a.marginal.length}; ${a.hopOnly.length}`),
    row('Reach class (easiest survivable)', a => CLASSES.filter(k => a.classes[k]).map(k => `${cls(k)} ${a.classes[k]}`).join(', ')),
    row('Fatal shortcut; needs a switch; provisional class', a => `${a.leap.length}; ${a.switchGated.length}; ${a.provisional.length}`),
    row('Crystals with each method available', a => CLASSES.filter(k => a.methods[k]).map(k => `${cls(k)} ${a.methods[k]}`).join(', ') || '—'),
    row(`Grind line through the envelope / authored rail ≤ ${T.railNear} m / edge grind through`, a => `${a.throughRail.length} / ${a.railNear} / ${a.edgeThrough}`),
    row(`Vert coping ≤ ${T.vertNear} m (≤ ${REACH.vertLateral} m of the line) / kicker ≤ ${T.kickerNear} m / wallride wall`, a => `${a.vertNear} (${a.vertOnLine.length}) / ${a.kickerNear} / ${a.wallFit}`),
    row('Launchers that reach (crystals)', a => topOf(a.launchers, 4)),
    row('Mover / rope swing nearby', a => `${a.moverNear} / ${a.ropeNear}`),
    row(`Eye line of sight within ${T.visRange} m: seen; median lead m; no sample in range`, a => `${a.los.seen}; ${a.los.leadMedian}; ${a.los.untested.length}`),
    row('Course frame: seen; median lead m; never (above the frame top); no sample ahead', a => `${a.frame.seen}; ${a.frame.leadMedian}; ${a.frame.never.length} (${a.frame.aboveTop.length}); ${a.frame.untested.length}`),
    row('In frame while grinding the line through its envelope', a => a.frame.rail.length),
  ]), '');

  lines.push('## Notable examples', '', 'Selected by fixed rules over the in-game crystals (the rule is given with each). Positions are world metres; "along the route" is progress from the spawn.', '');
  notableExamples(levels).forEach((x, i) => lines.push(`${i + 1}. **${x.title}** · \`${x.level}\` (${x.course}). *Rule: ${x.rule}.* ${x.text}`));
  lines.push('');
  if (sup.length) {
    lines.push('### Suppressed authored crystals', '', 'These Secret Island courses author a crystal, but `levelAllowsCrystal()` returns false, so `Level.crystal()` never builds it. They are measured as if present and kept out of the in-game statistics.', '',
      ...sup.map(l => `- \`${l.id}\` (${l.title}): ${l.crystal.nm ? `"${l.crystal.nm}" ` : ''}at ${at3(l.crystal.p)}, ${l.crystal.route.prog} m (${Math.round(100 * l.crystal.route.frac)}%), ${l.crystal.route.toGate} m before the gate, ${l.crystal.route.aboveFloor} m above the route floor; reach ${cls(l.crystal.reach.class)} — ${l.crystal.reach.how}.`), '');
  }
  lines.push('### Engine default (6 m-before-gate fallback)', '', G.defaults.length ? G.defaults.map(id => { const l = levels.find(x => x.id === id), c = l.crystal;
    return `- \`${id}\` (${l.title}): no \`crystal\` component, so \`Level.placeCampaignCrystal\` puts it at gate − 6 m × \`Level.laneDirAt(gate)\`, 0.65 m above the floor found there: ${at3(c.p)}, ${c.route.toGate < 0 ? `${-c.route.toGate} m PAST the gate along the route, because the level's camnode lane runs from the finish back to the start` : `${c.route.toGate} m before the gate`}; reach ${cls(c.reach.class)} (${c.reach.how}).`; }).join('\n') : '- No level uses the fallback.', '');

  // Ground truth.
  const gt = id => levels.find(l => l.id === id)?.crystal;
  const codex = gt('codex-lab'), jungle = gt('jungle'), tree = gt('treehouse-trail'), tribal = gt('tribal-run'), hollow = gt('hollowwake-descent');
  lines.push('## Ground-truth check', '', 'The detection was compared with the level sources:', '');
  if (codex?.p) lines.push(`- \`codex-lab\` — \`src/levels/codex-lab.ts\` (the foundry block) authors \`box(crystalPerch, 3.6, 2.4, 2.4, …, 'Foundry crystal precision perch')\`, a 2.4 × 2.4 m perch with its top at 3.6 m, 8.4 m from the reward perch, and \`{t:'crystal', p:[crystalPerch[0], 5, crystalPerch[2]], nm:'Foundry optional precision reward'}\`. ` +
    `The audit finds the authored component #${codex.cid} at ${at3(codex.p)} with "${codex.below.nm}" ${codex.below.above} m below. With the ${C.envelope.riderHeight} m rider box the band floor is p.y − ${-codex.envelope.feet[0]} m, so standing on the perch leaves the feet ${codex.collection.hop?.rise ?? '—'} m short: the crystal is taken by a hop (${cls(codex.reach.class)}). ` +
    `${codex.reach.requires.length ? `In the build state the reward perch is cut off by the switch puzzle's gap; the path appears only with the outline geometry materialised (${[...new Set(codex.reach.basic?.moves.map(m => m.ontoName).filter(Boolean))].join(', ')}).` : ''}`);
  if (jungle?.p) lines.push(`- \`jungle\` — the native builder (\`buildJungle\` in \`src/level.ts\`, "THE FALLEN TRUNK") seats the crystal on \`pts[N / 2]\`, a node of the trunk's grind \`Rail\` across the ravine (the trunk itself has no collider). The audit finds it at ${at3(jungle.p)}, ${jungle.below.kind} below, a ${jungle.aids.rails[0]?.kind} passing through the envelope ${sgn(jungle.aids.rails[0]?.dh)} m from p.y, reach ${cls(jungle.reach.class)} (${jungle.reach.methods[0]?.evidence ?? ''}).`);
  if (tree?.p) lines.push(`- \`treehouse-trail\` — \`src/levels/treehouse-trail.ts\` places "Treehouse Trials crystal on the rope rail" at the exact centre of the \`rope\` component "Single taut grindable rope across the missing bridge" over the cavern river. The audit: ${tree.below.kind} below, a ${tree.aids.rails[0]?.kind} through the envelope, reach ${cls(tree.reach.class)}${tree.reach.leapOfFaith ? `, fatal shortcut ${cls(tree.reach.leapOfFaith.class)}` : ''}.`);
  if (tribal?.p) lines.push(`- \`tribal-run\` — \`src/levels/tribal-run.ts\` puts "Festival crystal · final grind line" on the last crossing rail, 1.85 m above the ground line. The audit: a ${tribal.aids.rails[0]?.kind} ${sgn(tribal.aids.rails[0]?.dh)} m from p.y passes through the envelope over a ${tribal.below.kind}; reach ${cls(tribal.reach.class)}.`);
  if (hollow?.p) lines.push(`- \`hollowwake-descent\` — no \`crystal\` component; \`src/levels/hollowwake-descent.ts\` authors its camnodes from the end backwards ("Stable reverse chase lane"). The audit records the engine default at ${at3(hollow.p)}, ${-hollow.route.toGate} m past the gate.`);
  lines.push('');

  lines.push('## Limitations', '',
    '- The route line is the camera lane (or a checkpoint chain) and the floor comes from the geometry audit\'s walker, not a recorded player path. The walker can follow a lower path or lose the course; levels where its walk does not end on the gate floor are flagged (`route.walkSuspect`), and their route-based floors and visibility are unreliable. Checkpoint and gate floors are added as starts so reach does not depend on the walk alone.',
    '- Reach is a geometric search with measured apexes and ranges, not a simulation: run-up length, approach speed, air control, steering into a ledge and timing are not modelled; jump arcs are not tested for obstructions; ledge grabs are allowed on any non-crate surface lip; a 0.5 m probe grid can miss beams narrower than that. "Unclear" means nothing was found, not proven unreachable.',
    '- Vert numbers were measured on a 3.6 m transition; other radii behave differently. Half or quarter pipe is read from the vertramp component when one is found (default half). Kicker airs come from 4 m ramps at three rises; other shapes are interpolated. Wallrides assume a flat approach floor in front of the wall; the wallie\'s travel along the wall is not modelled and the off-grid test reads the visible wall face.',
    '- The state is the level at build time: movers at their base phase (their whole travel is swept, without timing), crumbles and phase pads solid, spin bridges closed, switches unpressed except in the switch pass. Trampoline air jumps and board double jumps are not included.',
    '- Visibility uses the meshes built synchronously in the headless level; art that streams in later (GLB props, some dressing) is missing, so line of sight can be optimistic. Fog is not applied (the level\'s fog far distance is recorded). The camera model ignores camera collision, lane look-ahead, side-scroll zones, boulder shots and the speed field-of-view push, and assumes a 16:9 frame.',
    `- The rider box is the default character's (${C.envelope.riderHeight} m); Character Lab stature changes the band floor. Bonus rooms, races, competitions and parks are outside the scope (see Skipped); add a level with \`--levels id1,id2\`.`, '');
  return lines.join('\n');
}

/** JSON with short arrays/objects kept on one line each. */
function compactJson(value, indent = '') {
  const flat = JSON.stringify(value);
  if (flat === undefined) return 'null';
  if (flat.length <= 400 || value === null || typeof value !== 'object') return flat;
  const next = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map(v => next + compactJson(v, next)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${next}${JSON.stringify(k)}: ${compactJson(v, next)}`).join(',\n')}\n${indent}}`;
}

let commit = null;
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
const output = RENDER_ONLY ? JSON.parse(await readFile(OUT_JSON, 'utf8')) : {
  generatedBy: 'node tools/crystal-placement-report.mjs', commit, levelSources: STOCK ? 'stock source only' : 'public/levels.json restored first (fresh-browser state)',
  constants, scope: { included: results.map(r => ({ id: r.id, title: r.title, group: r.group, island: r.island, islandName: r.islandName ?? null, source: r.source })), skipped },
  aggregate: aggregate(results),
  levels: results,
};
await mkdir(path.dirname(OUT_JSON), { recursive: true });
if (!RENDER_ONLY) await writeFile(OUT_JSON, compactJson(output) + '\n');
await mkdir(path.dirname(OUT_MD), { recursive: true });
await writeFile(OUT_MD, renderReport(output));
log(`wrote ${RENDER_ONLY ? '' : `${path.relative(ROOT, OUT_JSON)} and `}${path.relative(ROOT, OUT_MD)} (${output.levels.length} levels)`);
