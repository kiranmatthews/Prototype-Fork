// Level geometry audit for the campaign courses and the puzzle trilogy: gaps, platforms,
// obstacles and hazards, enemies and rhythm along each course.
//
//   node tools/level-geometry-report.mjs                 writes docs/crate-bible/data/current-game-geometry.json
//                                                        and docs/crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md
//   node tools/level-geometry-report.mjs --levels jungle,codex-lab   only these level ids
//   node tools/level-geometry-report.mjs --stock         ignore public/levels.json overrides
//   node tools/level-geometry-report.mjs --json a.json --md a.md     other output paths
//   node tools/level-geometry-report.mjs --render-only   rewrite the report from the existing JSON
//
// Sibling of tools/crate-placement-report.mjs and deliberately built the same way: every level
// is constructed through the real Level class inside the headless withSkateRuntime harness,
// the published pack (public/levels.json) is restored first as a fresh browser does, the scope
// is the same (authored campaign courses plus the three puzzle-trilogy layouts; races,
// competitions, parks and bonus rooms are skipped) and the route line is chosen the same way
// (camnode lane, else spawn -> checkpoints -> gate), so progress values and checkpoint sections
// line up with the crate audit. Nothing here asserts: a level that fails to build is recorded
// with its error and the others continue.
//
// The heart of the gap measurement is a "walker" that follows the route line in 0.25 m steps
// and looks for standable ground (Level.groundMeshes, the same set the player's ground probe
// uses) in a 4.8 m corridor around itself, tracking the floor height from the ground itself
// (camnode heights are not floor heights: several lanes sit at y = 0 over roofs 13 m up).
// Where the floor ends it classifies what lies below (ground, pit, lethal water, lethal mesh,
// out-of-bounds mesh, or void below killY) and looks ahead for the landing.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT_JSON = path.resolve(ROOT, option('--json') ?? 'docs/crate-bible/data/current-game-geometry.json');
const OUT_MD = path.resolve(ROOT, option('--md') ?? 'docs/crate-bible/CURRENT_GAME_GEOMETRY_AUDIT.md');
const ONLY = option('--levels')?.split(',').filter(Boolean);
const STOCK = argv.includes('--stock');
const RENDER_ONLY = argv.includes('--render-only');
const log = (...a) => process.stdout.write(a.join(' ') + '\n');

// Thresholds. Distances in metres along / across the route line.
const T = {
  step: 0.25,        // route sampling step of the walker
  corridor: 2.4,     // half-width of the support search around the walker's own line
  colStep: 0.4,      // spacing of the support columns inside that corridor
  cMax: 12,          // furthest the walker's line may drift sideways from the route line
  wide: 10,          // when the corridor finds no landing, look this far either side of the walker's line
  contDown: 1.5,     // continuous ground may fall this much between two samples (slopes, kerbs, small steps)
  contUp: 1.0,       // ... and rise this much; higher steps are recorded as climbs
  climbMax: 5.2,     // highest step-up still taken as a climb (full-jump ledge-grab lip, bible XV.2)
  jumpScan: 15,      // a landing at take-off height within this distance makes a floor end a gap
  scan: 60,          // furthest look-ahead for any landing
  transit: 120,      // a lane segment longer than this crossing a void is a portal / teleport transit, not route
  minGap: 0.6,       // narrower breaks are seams (the player box is 1 m wide)
  shallow: 3,        // a safe gap floor less than this below the take-off is "shallow"
  onPath: 1.5,       // hazard placement: swept area within this of the walked line = across the route
  flank: 8,          // ... within this = flanking; beyond = off-route
  enemyOnPath: 3,    // enemy patrol within this of the walked line = on the route
  beatCorridor: 10,  // rhythm beats count only within this lateral distance
  near: 4,           // enemy / hazard / crate adjacency (box-to-box or segment distance)
  edgeGuard: 4,      // enemy or hazard within this along the route before a take-off / after a landing
  alone: 12,         // a first appearance is "alone" without another enemy within this along the route
  narrow: 2.0,       // supported width across travel below this = narrow surface
  veryNarrow: 1.2,
  widthEvery: 2,     // width sampling interval along the walk
  beatMerge: 4,      // same-kind beats closer than this merge into one
  short: 2,          // landing depth below this = short landing pad
};
const r1 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
const r2 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const mean = xs => xs.length ? sum(xs) / xs.length : null;
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
const boxGap = (a, b) => Math.hypot(Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
  Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z));
const KINDS = ['wood', 'empty', 'mystery', 'life', 'mask', 'multihit', 'bouncy', 'metalbounce', 'metal', 'tnt', 'nitro', 'bang', 'nitrobang'];
const kindOf = c => c.nitroBang ? 'nitrobang' : c.bang ? 'bang' : c.nitro ? 'nitro' : c.tnt ? 'tnt'
  : c.metalBounce ? 'metalbounce' : c.bouncy ? 'bouncy' : c.metal ? 'metal' : c.multiHit ? 'multihit'
  : c.life ? 'life' : c.mask ? 'mask' : c.mystery ? 'mystery' : c.empty ? 'empty' : 'wood';
const ENEMY_KINDS = ['grunt', 'spiker', 'turtle', 'charger', 'hopper', 'floater', 'sentry', 'spinner', 'moa'];
const ENEMY_NAMES = { grunt: 'Coral Crab', spiker: 'Bristleback', turtle: 'Mossback', charger: 'Russet Bull', hopper: 'Spring Frog',
  floater: 'Violet Watcher', sentry: 'Ember Sentry', spinner: 'Brass Whirler', moa: 'Moa' };
const HAZARD_KINDS = ['crusher', 'pendulum', 'boulder', 'boulder-chase', 'firetiki', 'grindosaurus', 'angryball', 'minefield', 'mover',
  'phasepad', 'crumble', 'ropeswing', 'spinbridge', 'snaprope', 'movingrail', 'thorn', 'tumblezone'];
const TIMED = new Set(['crusher', 'pendulum', 'boulder', 'firetiki', 'grindosaurus', 'mover', 'phasepad', 'ropeswing', 'movingrail']);
// Hazards that can kill or knock the player down by themselves (the rest are platforms or traversal aids with timing).
const DANGER = new Set(['crusher', 'pendulum', 'boulder', 'boulder-chase', 'firetiki', 'grindosaurus', 'angryball', 'minefield']);
const BEAT_HAZARDS = new Set(['crusher', 'pendulum', 'boulder', 'boulder-chase', 'firetiki', 'grindosaurus', 'angryball', 'minefield',
  'mover', 'phasepad', 'crumble', 'ropeswing', 'spinbridge', 'snaprope']);

// ---------------------------------------------------------------------------
// Crossing reach. The thresholds are MEASURED flat ranges (take-off to touchdown on flat ground) from
// real-input Player runs: docs/crate-bible/data/skate-crate-probe.json, scenario "range"
// (tools/probe-crate-skate-rules.mjs). Foot: full jump at 9 m/s, and full jump + double jump fired at
// the apex. Board: full (charged) ollie starting from 12 m/s cruise (charging accelerates the board to
// about 15.6 m/s at take-off) and full ollie at 23 m/s. Only the height difference between take-off and
// landing is modelled: a two-gravity arc with src/tuning.ts gravities and the measured apex heights gives
// an airtime ratio t(dh) / t(0), which scales the measured flat range; a landing above the apex is out of reach.
const RANGE_LANES = { foot: 'run-full-jump', double: 'run-full-jump-plus-double', ollie12: 'board-full-ollie-12', ollie23: 'board-full-ollie-23' };
const RANGE_FALLBACK = { foot: { distance: 5.85, apex: 2.85, takeoffSpeed: 9 }, double: { distance: 9.15, apex: 4.59, takeoffSpeed: 9 },
  ollie12: { distance: 9.36, apex: 1.78, takeoffSpeed: 15.6 }, ollie23: { distance: 13.83, apex: 1.78, takeoffSpeed: 23.06 } };
function makeModel(TUNING, probe) {
  const lane = id => probe?.find?.(r => r.scenario === 'range' && r.lane === id) ?? null;
  const measured = Object.fromEntries(Object.entries(RANGE_LANES).map(([k, id]) => {
    const r = lane(id); return [k, r ? { distance: r.distance, apex: r.apex, takeoffSpeed: r.takeoffSpeed, lane: id } : { ...RANGE_FALLBACK[k], lane: id, fallback: true }];
  }));
  const reference = ['run-tap-jump', 'board-tap-ollie-12', 'board-full-ollie-18'].map(lane).filter(Boolean).map(r => ({ lane: r.lane, distance: r.distance, apex: r.apex, takeoffSpeed: r.takeoffSpeed }));
  const g = { footRise: TUNING.riseGravity, footFall: TUNING.fallGravity, boardRise: TUNING.boardRiseGravity, boardFall: TUNING.boardFallGravity };
  const footApex = measured.foot.apex, doubleApex = measured.double.apex, boardApex = measured.ollie23.apex;
  const tUpFoot = Math.sqrt(2 * footApex / g.footRise), tUpDouble = Math.sqrt(2 * Math.max(0, doubleApex - footApex) / g.footRise), tUpBoard = Math.sqrt(2 * boardApex / g.boardRise);
  // Airtime to touchdown dh above the take-off (null above the apex).
  const air = {
    foot: dh => dh > footApex ? null : tUpFoot + Math.sqrt(2 * (footApex - dh) / g.footFall),
    double: dh => dh > doubleApex ? null : tUpFoot + tUpDouble + Math.sqrt(2 * (doubleApex - dh) / g.footFall),
    ollie12: dh => dh > boardApex ? null : tUpBoard + Math.sqrt(2 * (boardApex - dh) / g.boardFall),
  };
  air.ollie23 = air.ollie12;
  const modes = {
    foot: { label: 'foot jump (9 m/s)', apex: footApex },
    double: { label: 'foot jump + double jump at the apex', apex: doubleApex },
    ollie12: { label: 'board: full charged ollie from 12 m/s cruise', apex: boardApex },
    ollie23: { label: 'board: full ollie at 23 m/s', apex: boardApex },
  };
  const range = (mode, dh) => { const t = air[mode](dh); return t === null ? null : measured[mode].distance * t / air[mode](0); };
  const flat = Object.fromEntries(Object.keys(modes).map(k => [k, measured[k].distance]));
  const describe = { source: 'docs/crate-bible/data/skate-crate-probe.json scenario "range" (measured flat ranges)', measured, reference, gravity: g,
    heightAdjustment: 'range(dh) = measured flat range x t(dh) / t(0), t from two-gravity arcs through the measured apex; double jump fired at the apex',
    flatRange: flat, apex: Object.fromEntries(Object.keys(modes).map(k => [k, r2(modes[k].apex)])), labels: Object.fromEntries(Object.entries(modes).map(([k, v]) => [k, v.label])),
    examples: Object.fromEntries(Object.keys(modes).map(k => [k, { 'dh -3': r2(range(k, -3)), 'dh -1': r2(range(k, -1)), 'dh +1': r2(range(k, 1)), 'dh +1.7': r2(range(k, 1.7)) }])) };
  return { modes, range, describe };
}
const MODES = ['foot', 'double', 'ollie12', 'ollie23'];

// ---------------------------------------------------------------------------
/** Vertical probes against ground meshes. Unlike a first-hit probe this returns every
 * standable face in the column (upward faces; downward faces too on double-sided meshes, the
 * player's own probe ignores winding), highest first. */
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
  /** Standable faces between yTop and yBot at (x, z), highest first: {y, mesh, up}. */
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
  /** Lowest downward-facing face above (x, y, z) within `far`, or null (open sky / inside a closed solid). */
  ceiling(x, y, z, far) {
    const meshes = this.candidates(x, z, y + far, y); if (!meshes.length) return null;
    this.rays++;
    this.origin.set(x, y, z); this.ray.set(this.origin, this.up); this.ray.near = 0; this.ray.far = far;
    const hit = this.ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.y : null;
  }
}

// ---------------------------------------------------------------------------
/** Polyline with arc length; projection is full 3D like Level.laneDirAt (as the crate audit). */
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
  // Horizontal heading per segment, carried across zero-length XZ segments.
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
  // Fallback, as Level.bonusCourseRoute: spawn -> checkpoints -> gate, checkpoints chained
  // greedily (or by projection on spawn->gate when that is shorter).
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
  const { S, model } = ctx, V = (x, y, z) => new THREE.Vector3(x, y, z);
  level.root.updateMatrixWorld(true);
  if (level.crateRailsDirty) level.rebuildCrateRails?.();
  const dataBuilt = !!target.entry.data, comps = dataBuilt ? (level.builtFromData?.components ?? []) : [];
  const killY = level.killY;
  const { route, method, note, startS, endS, laneNodes } = chooseRoute(THREE, level);
  const dir = Math.sign(endS - startS) || 1, L = Math.abs(endS - startS);
  const where = p => { const q = route.project(p); return { prog: (q.s - startS) * dir, lat: q.lat * dir, fx: q.fx * dir, fz: q.fz * dir, off: q.dist }; };
  const at = prog => { const q = route.pointAt(startS + prog * dir), fx = q.fx * dir, fz = q.fz * dir; return { x: q.x, z: q.z, fx, fz, lx: -fz, lz: fx }; };
  const colXZ = (pos, o) => [pos.x + pos.lx * o, pos.z + pos.lz * o];

  // ---- surfaces ----
  const moverMeshes = new Set(level.movers.map(m => m.mesh));
  const underMover = mesh => { for (let o = mesh; o; o = o.parent) if (moverMeshes.has(o)) return true; return false; };
  const phaseMeshes = new Set(level.phasePads.map(p => p.mesh)), crumbleMeshes = new Set(level.crumbles.map(c => c.mesh));
  const compOf = mesh => { const idx = mesh?.userData?.editorIdx; return dataBuilt && Number.isInteger(idx) ? comps[idx] ?? null : null; };
  const typeCache = new Map();
  const surfaceType = mesh => {
    if (!mesh) return 'none';
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
    else if (u.vertComp || u.vertRampMesh) t = 'vertramp';
    else if (u.nativeRampDeck || /ramp|kicker/i.test(name)) t = 'ramp';
    else if (/rock island/i.test(name)) t = 'rock-island';
    else if (/platform|pier|quay|jetty|balcony|terrace|walk|landing|step/i.test(name)) t = 'platform';
    else t = 'mesh';
    typeCache.set(mesh, t);
    return t;
  };
  const meshBox = mesh => { const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(mesh.matrixWorld); };
  /** Footprint of a surface: [short side, long side] in metres, from component size where authored, else the world AABB. */
  const nameOf = mesh => mesh ? ((compOf(mesh)?.nm ?? mesh.name ?? '').split(' · ')[0].slice(0, 40) || null) : null;
  const cidOf = obj => { for (let o = obj; o && o !== level.root; o = o.parent) { const i = o.userData?.editorIdx; if (dataBuilt && Number.isInteger(i)) return i; } return null; };
  const footprint = mesh => {
    const comp = compOf(mesh);
    if (comp && ['platform', 'crumble', 'phasepad', 'mover', 'trampoline', 'speedpad', 'bonusplatform'].includes(comp.t) && comp.s && !(comp.pts?.length >= 3))
      return { dims: [comp.s[0], comp.s[2]].sort((a, b) => a - b).map(r2), src: 'component' };
    if (comp?.t === 'terrain') return { dims: [comp.w ?? 12, null], src: 'terrain width' };
    if (comp?.t === 'woodpath') return { dims: [Math.min(...(comp.widths?.length ? comp.widths : [comp.w ?? 6])), null], src: 'woodpath min width' };
    const p = mesh.geometry?.parameters;
    if (p && Number.isFinite(p.width) && Number.isFinite(p.depth) && Math.abs(mesh.rotation.x) < 1e-6 && Math.abs(mesh.rotation.z) < 1e-6)
      return { dims: [p.width * Math.abs(mesh.scale.x), p.depth * Math.abs(mesh.scale.z)].sort((a, b) => a - b).map(r2), src: 'geometry' };
    const b = meshBox(mesh);
    return { dims: [b.max.x - b.min.x, b.max.z - b.min.z].sort((a, b) => a - b).map(r2), src: 'aabb' };
  };
  const shapeOf = dims => { const [a, b] = dims; if (b === null) return a < T.narrow ? 'narrow strip' : 'strip';
    if (a < T.narrow) return b >= 3 * a ? 'narrow beam' : 'small block'; if (b <= 4) return 'small pad'; if (b <= 10) return 'pad'; if (b <= 30) return 'platform'; return 'large ground'; };
  const walkMeshes = level.groundMeshes.filter(m => !underMover(m));
  const surf = new Surfaces(THREE, walkMeshes);
  const pits = level.pitBoxes;
  const pitAt = (x, z, y) => pits.some(b => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y >= y - .3 && b.max.y <= y + 1 && !level.pitMissesPoly?.(b, x, z));
  const waterAt = (x, z) => level.lethalWaterSurfaceAt?.(x, z) ?? null;
  const badSurface = (h, x, z) => {
    if (h.mesh.userData.lethal || h.mesh.userData.outOfBounds || h.y < killY || pitAt(x, z, h.y)) return true;
    const w = waterAt(x, z); return w !== null && w > h.y + .05;
  };
  /** What a fall from yFrom at (x, z) ends in. */
  const fallOutcome = (x, z, yFrom) => {
    const h = surf.column(x, z, yFrom, killY - 2)[0] ?? null;
    let kind = 'void', y = killY, mesh = null;
    if (h && h.y >= killY) { y = h.y; mesh = h.mesh; kind = h.mesh.userData.lethal ? 'lethal' : h.mesh.userData.outOfBounds ? 'oob' : 'ground'; }
    for (const b of pits) if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z && b.max.y <= yFrom + .3 && b.max.y >= y - .3 && !level.pitMissesPoly?.(b, x, z)) { kind = 'pit'; y = Math.max(y, b.max.y); }
    const w = waterAt(x, z);
    if (w !== null && w <= yFrom && w > y + .05) { kind = 'water'; y = w; }
    return { kind, y, mesh: kind === 'ground' ? mesh : null };
  };
  const OFFS = [0]; for (let d = T.colStep; d <= T.corridor + 1e-9; d += T.colStep) OFFS.push(-r2(d), r2(d));
  const OFFS_WIDE = []; for (let d = T.corridor + .5; d <= T.wide + 1e-9; d += .5) OFFS_WIDE.push(-r2(d), r2(d));
  /** Best standable surface with height in [f+lo, f+hi] across the corridor around line c. */
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
  /** Any standable, non-lethal, non-decor surface around the walker's line or the route line itself. */
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
  const findAny = (from, to, fRef, c, step = T.step, far = false, level = false) => {
    for (let s = from; s <= to + 1e-9; s += step) {
      const hit = level ? anyAt(s, fRef, c, T.climbMax, OFFS, -3) : far ? anyAt(s, fRef, c, 40, [0, -1.2, 1.2, -2.4, 2.4]) : anyAt(s, fRef, c);
      if (hit) return { prog: s, ...hit };
    }
    return null;
  };
  const WSTEPS = [.25, .5, .75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4, 5, 6];
  /** Supported width across travel at prog on floor f (each side followed outward until the floor ends; capped at 12 m). */
  const widthAt = (prog, f, c) => {
    const pos = at(prog), ext = [], [cx, cz] = colXZ(pos, c);
    const h0 = surf.column(cx, cz, f + T.contUp, f - T.contDown).find(h => !badSurface(h, cx, cz));
    if (!h0) return 0;
    for (const side of [-1, 1]) {
      // Follow the surface outward (cross-slopes up to about 45 degrees), so banked roads and troughs keep their width.
      let last = 0, prevD = 0, prevY = h0.y;
      for (const d of WSTEPS) {
        const [x, z] = colXZ(pos, c + side * d), band = .15 + (d - prevD);
        const h = surf.column(x, z, prevY + band, prevY - band).find(h => !badSurface(h, x, z));
        if (!h) break; last = d; prevD = d; prevY = h.y;
      }
      ext.push(last);
    }
    return ext[0] + ext[1] + .25;
  };
  const refine = (lo, hi, pred, firstTrue = false) => { // pred(lo) !== pred(hi); returns [lo, hi]
    for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (pred(m) !== firstTrue) lo = m; else hi = m; }
    return [lo, hi];
  };
  const bottomSummary = (bottoms, f0) => {
    const n = bottoms.length, lethal = bottoms.filter(b => b.kind !== 'ground');
    const depths = bottoms.filter(b => b.kind === 'ground').map(b => f0 - b.y);
    const kinds = tally(bottoms, b => b.kind), dominant = Object.entries(tally(lethal, b => b.kind)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return { n, kinds, lethalShare: n ? lethal.length / n : 0, cls: !n ? 'unknown' : !lethal.length ? 'safe' : lethal.length === n ? 'lethal' : 'mixed',
      lethalKind: dominant, minSafeDepth: depths.length ? Math.min(...depths) : null, maxSafeDepth: depths.length ? Math.max(...depths) : null };
  };

  const rails = level.rails.filter(r => r.grindable !== false && !level.isCrateRail?.(r));
  const ropeRails = new Set(level.ropes.map(r => r.rail)), movingRailSet = new Set(level.movingRails.map(m => m.rail)), trickRailSet = new Set(level.trickRails.map(t => t.rail));
  const moverEnv = level.movers.map(m => {
    const b = meshBox(m.mesh), v = m.axisV.clone().multiplyScalar(m.amp);
    b.union(b.clone().translate(v)).union(b.clone().translate(v.clone().negate()));
    if (m.orbit) b.expandByScalar(Math.max(...m.orbit));
    if (m.spin) { const c = b.getCenter(V(0, 0, 0)), r = Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2; b.min.x = Math.min(b.min.x, c.x - r); b.max.x = Math.max(b.max.x, c.x + r); b.min.z = Math.min(b.min.z, c.z - r); b.max.z = Math.max(b.max.z, c.z + r); }
    return { m, box: b };
  });
  const spinDecks = level.spinBridges.map(b => { const cmp = b.component, [span, , width] = cmp.s ?? [5, .36, 1.2], yaw = (cmp.yaw ?? 0) * Math.PI / 180;
    return { b, cmp, span, width, yaw, p: cmp.p }; });
  const inSpinDeck = (d, x, z, y) => { const dx = x - d.p[0], dz = z - d.p[2], lx = dx * Math.cos(d.yaw) - dz * Math.sin(d.yaw), lz = dx * Math.sin(d.yaw) + dz * Math.cos(d.yaw);
    return lx >= -.5 && lx <= d.span + .5 && Math.abs(lz) <= d.width / 2 + .8 && Math.abs(y - d.p[1]) <= 3; };
  const swingReach = rs => rs.len * Math.sin(Math.min(Math.PI / 2, Math.abs(rs.amp))) + (rs.travel ? Math.abs(rs.travel.amp) : 0) + 1.5;
  /** A grind line, mover, swing or spin bridge continuing the route ahead of an edge at take-off height. */
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

  // ---- the walk ----
  const events = [], ground = [], meshIds = new Map(), meshList = [];
  const mid = m => { if (!m) return -1; if (!meshIds.has(m)) { meshIds.set(m, meshList.length); meshList.push(m); } return meshIds.get(m); };
  const sp = level.spawnPos, spw = where(sp);
  let c = clamp(spw.lat, -T.cMax, T.cMax), f = null, prog = 0, curMesh = null;
  { const h = surf.column(sp.x, sp.z, sp.y + 1.5, sp.y - 8).find(h => !badSurface(h, sp.x, sp.z)); if (h) { f = h.y; curMesh = h.mesh; } }
  if (f === null) { const any = findAny(0, Math.min(L, T.scan), sp.y, c); if (any) { f = any.y; c = any.o; prog = any.prog; curMesh = any.mesh; } }
  const onEdge = (prog0, f0, c0, takeMesh) => {
    const [e0, eHi] = refine(prog0, Math.min(L, prog0 + T.step), s => !!standAt(s, c0, f0, true));
    const pos0 = at(e0), [x0, z0] = colXZ(pos0, c0);
    // Something rising past climb reach right after the edge with no open space under it is a wall, not a gap.
    const [xh, zh] = colXZ(at(eHi), c0), tall = surf.column(xh, zh, f0 + 40, f0 + T.climbMax).find(h => h.up);
    const wall = tall && surf.ceiling(xh, f0 + .5, zh, tall.y - f0 - .5) === null ? tall.y - f0 : null;
    const bottoms = [], end = Math.min(L, e0 + T.scan);
    let lv = null, lower = null;
    for (let s = eHi; s <= end + 1e-9; s += T.step) {
      const hit = standAt(s, c0, f0);
      if (hit) { lv = { s, ...hit }; break; }
      const [x, z] = colXZ(at(s), c0), out = fallOutcome(x, z, f0 - T.contDown);
      bottoms.push({ s, ...out });
      if (!lower && out.kind === 'ground') lower = { s, y: out.y, o: c0, x, z, mesh: out.mesh };
    }
    const first = bottoms[0];
    let landing = null, how = null, wd = null;
    // Wide fallback: a landing at take-off height beside the corridor (zig-zag layouts, lanes that run beside the path).
    const ride = !(lv && lv.s - e0 <= T.jumpScan) && rideAhead(e0 + .5, Math.min(L, e0 + 12), c0, f0);
    if (!(lv && lv.s - e0 <= T.jumpScan) && !ride) for (let s = eHi; s <= end + 1e-9; s += T.step) {
      const hit = bestInBand(at(s), c0, f0, -T.contDown, T.contUp, { offsets: OFFS_WIDE, noDecor: true });
      if (hit) { wd = { s, ...hit }; break; }
    }
    if (lv && lv.s - e0 <= T.jumpScan) { landing = lv; how = 'level'; }
    else if (wd && wd.s <= eHi + 1) return { type: 'shift', s: e0, from: c0, to: wd.o, y0: f0, resume: { prog: wd.s, y: wd.y, o: wd.o, mesh: wd.mesh } };
    else if (first?.kind === 'ground') return { type: 'drop', s: e0, h: f0 - first.y, y0: f0, o0: c0, p: [x0, f0, z0], wall, resume: { prog: first.s, y: first.y, o: c0, mesh: first.mesh } };
    else if (wd && wd.s - e0 <= T.jumpScan) { landing = wd; how = 'offset'; }
    else if (lower && (!lv || lower.s < lv.s) && (!wd || lower.s < wd.s)) { landing = lower; how = 'lower'; }
    else if (lv && (!wd || lv.s <= wd.s)) { landing = lv; how = 'level-long'; }
    else if (wd) { landing = wd; how = 'offset-long'; }
    else {
      // Nothing in the corridor: look round the route line too, first near take-off height, then at any height.
      const near = findAny(eHi, end, f0, c0, T.step, false, true);
      if (near) { landing = { s: near.prog, ...near }; how = 'void'; }
      else {
        const later = findAny(end, Math.min(L, e0 + 2 * T.scan), f0, c0, .5, false, true);
        if (later) return { type: 'void', s0: e0, s1: later.prog, y0: f0, o0: c0, p: [x0, f0, z0], bottom: bottomSummary(bottoms, f0), takeMesh,
          resume: { prog: later.prog, y: later.y, o: later.o, mesh: later.mesh } };
        const any = findAny(eHi, end, f0, c0); if (any) { landing = { s: any.prog, ...any }; how = 'void'; }
      }
    }
    if (!landing) {
      const far = findAny(end, L, f0, c0, 1, true);
      return { type: 'void', s0: e0, s1: far ? far.prog : L, y0: f0, o0: c0, p: [x0, f0, z0], bottom: bottomSummary(bottoms, f0), takeMesh,
        resume: far ? { prog: far.prog, y: far.y, o: far.o, mesh: far.mesh } : null };
    }
    const pred = how === 'lower' ? s => { const [x, z] = colXZ(at(s), c0); return fallOutcome(x, z, f0 - T.contDown).kind === 'ground'; }
      : how === 'void' ? s => !!anyAt(s, f0, c0) : how.startsWith('offset') ? s => !!bestInBand(at(s), c0, f0, -T.contDown, T.contUp, { offsets: OFFS_WIDE, any: true, noDecor: true })
      : s => !!standAt(s, c0, f0, true);
    const prev = Math.max(eHi, landing.s - T.step);
    const s1 = prev < landing.s && !pred(prev) ? refine(prev, landing.s, pred, true)[1] : landing.s;
    const w = s1 - e0, resume = { prog: landing.s, y: landing.y, o: landing.o, mesh: landing.mesh };
    if (w < T.minGap) return { type: 'crack', s: e0, w, resume };
    const [x1, z1] = colXZ(at(s1), landing.o);
    return { type: wall !== null ? 'wall' : 'gap', s0: e0, s1, w, jump: Math.hypot(x1 - x0, z1 - z0), y0: f0, y1: landing.y, dh: landing.y - f0, o0: c0, o1: landing.o, how, wall,
      bottom: bottomSummary(bottoms, f0), takeMesh, landMesh: landing.mesh, p0: [x0, f0, z0], p1: [x1, landing.y, z1], resume };
  };
  let guard = 0;
  if (f !== null) {
    ground.push([prog, f, c, mid(curMesh)]);
    while (prog < L - 1e-6 && guard++ < 4e5) {
      const next = Math.min(L, prog + T.step), pos = at(next);
      let cand = bestInBand(pos, c, f, -T.contDown, T.contUp);
      if (!cand) { cand = bestInBand(pos, c, f, T.contUp, T.climbMax, { upOnly: true }); if (cand) events.push({ type: 'climb', s: next, h: cand.y - f, y0: f }); }
      if (cand) {
        if (Math.abs(cand.o) > 1e-6) { // ease the line back toward the route line while the floor allows it
          const o2 = cand.o - Math.sign(cand.o) * Math.min(T.colStep, Math.abs(cand.o)), [x, z] = colXZ(pos, o2);
          const h = surf.column(x, z, cand.y + .37, cand.y - .37).find(h => !badSurface(h, x, z));
          if (h) { cand.o = o2; cand.y = h.y; cand.mesh = h.mesh; }
        }
        f = cand.y; c = cand.o; prog = next; curMesh = cand.mesh; ground.push([prog, f, c, mid(curMesh)]);
        continue;
      }
      const ev = onEdge(prog, f, c, curMesh);
      events.push(ev);
      if (!ev.resume) break;
      prog = Math.max(ev.resume.prog, prog + T.step); f = ev.resume.y; c = ev.resume.o; curMesh = ev.resume.mesh;
      ground.push([prog, f, c, mid(curMesh)]);
    }
  }
  const rays = surf.rays;
  // Walker line lookup: lateral offset of the walked line at a progress value.
  const gProg = ground.map(g => g[0]);
  const nearestGround = p => { let lo = 0, hi = gProg.length - 1; if (hi < 0) return null; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (gProg[m] <= p) lo = m; else hi = m; } return Math.abs(gProg[lo] - p) <= Math.abs(gProg[hi] - p) ? ground[lo] : ground[hi]; };
  const lineAt = p => nearestGround(p)?.[2] ?? 0;
  const floorAt = p => nearestGround(p)?.[1] ?? null;
  const rel = (p, y) => { const w = where(V(p[0], y ?? p[1], p[2])); return { prog: w.prog, lat: w.lat - lineAt(w.prog), fx: w.fx, fz: w.fz }; };
  const orient = (dx, dz, fx, fz) => { const l = Math.hypot(dx, dz); if (l < 1e-6) return 'vertical'; const d = Math.abs((dx * fx + dz * fz) / l); return d > .866 ? 'along' : d < .5 ? 'across' : 'diagonal'; };

  // ---- sections ----
  const cpItems = level.checkpoints.map(cp => ({ p: cp.mesh.position.clone(), ...where(cp.mesh.position) }));
  const cpProgs = cpItems.map(c => c.prog).sort((a, b) => a - b);
  const bounds = [0, ...cpProgs.map(p => clamp(p, 0, L)), L];
  const secOf = p => { for (let k = 1; k < bounds.length - 1; k++) if (p < bounds[k]) return k - 1; return bounds.length - 2; };
  const cpRel = p => { const before = cpProgs.filter(c => c <= p), after = cpProgs.filter(c => c > p);
    return [before.length ? r1(p - before[before.length - 1]) : null, after.length ? r1(after[0] - p) : null]; };

  // ---- crates and clusters ----
  const crates = level.crates.filter(c => !c.raceItem).map((c, i) => ({ c, i, kind: kindOf(c), outline: !!c.pending, box: c.box.clone(), p: c.mesh.position.clone() }));
  const solidCrates = crates.filter(c => !c.outline && !c.c.concealed);
  { const Lk = 1.2 * S, parent = solidCrates.map((_, i) => i), find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const hash = new Map(), key = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
    solidCrates.forEach((c, i) => { const k = key(c.p.x, c.p.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(i); });
    solidCrates.forEach((a, i) => { const gx = Math.floor(a.p.x / 2), gz = Math.floor(a.p.z / 2);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const j of hash.get(`${gx + dx},${gz + dz}`) ?? []) {
        if (j <= i) continue; const b = solidCrates[j];
        if (Math.abs(a.p.x - b.p.x) <= Lk && Math.abs(a.p.y - b.p.y) <= Lk && Math.abs(a.p.z - b.p.z) <= Lk) parent[find(i)] = find(j);
      } });
    solidCrates.forEach((c, i) => { c.root = find(i); }); }
  const clusterMap = new Map();
  for (const c of solidCrates) { if (!clusterMap.has(c.root)) clusterMap.set(c.root, []); clusterMap.get(c.root).push(c); }
  const clusters = [...clusterMap.values()].map(ms => {
    const p = [mean(ms.map(m => m.p.x)), Math.min(...ms.map(m => m.box.min.y)), mean(ms.map(m => m.p.z))], q = rel(p, mean(ms.map(m => m.p.y)));
    return { n: ms.length, kinds: tally(ms, m => m.kind), steelOnly: ms.every(m => m.kind === 'metal'), p, prog: q.prog, lat: q.lat };
  }).sort((a, b) => a.prog - b.prog);
  const cratesNear = (box, d = T.near) => solidCrates.filter(c => boxGap(c.box, box) <= d).length;
  const nearestCrate = box => { let best = Infinity; for (const c of solidCrates) best = Math.min(best, boxGap(c.box, box)); return Number.isFinite(best) ? best : null; };

  // ---- gaps: post-processing ----
  events.sort((a, b) => (a.s0 ?? a.s) - (b.s0 ?? b.s));
  const breaks = events.filter(e => ['gap', 'drop', 'wall', 'void'].includes(e.type) || (e.type === 'climb' && e.h >= T.contUp));
  const startOf = e => e.s0 ?? e.s, endOf = e => e.s1 ?? e.s;
  const gaps = events.filter(e => e.type === 'gap');
  const trampolines = [], speedPads = [], ramps = [];
  for (const mesh of level.groundMeshes) {
    const u = mesh.userData, b = meshBox(mesh), center = b.getCenter(V(0, 0, 0)), comp = compOf(mesh), t = surfaceType(mesh), long = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
    if (u.trampolineBounce !== undefined) trampolines.push({ mesh, box: b, center, bounce: u.trampolineBounce, mover: underMover(mesh) });
    else if (u.speedPadSpeed !== undefined) speedPads.push({ mesh, box: b, center, speed: u.speedPadSpeed });
    // Discrete launch features only: ramp components, or ramp/kicker-named meshes no longer than 60 m (a whole road called "... and ramp" is not one).
    else if (comp?.t === 'ramp' || ((t === 'ramp' || (comp?.t === 'mesh' && /kicker|ramp|launch/i.test(comp.nm ?? mesh.name ?? '')) || (!comp && /kicker/i.test(mesh.name ?? ''))) && long <= 60))
      ramps.push({ mesh, box: b, center, kind: /kicker/i.test(comp?.nm ?? mesh.name ?? '') ? 'kicker' : 'ramp' });
    else if ((t === 'vertramp' || u.vertComp) && long <= 40) ramps.push({ mesh, box: b, center, kind: 'vert' });
  }
  const outlineSurfaces = (level.outlinedSurfaces ?? []).filter(s => !s.active).map(s => ({ s, box: meshBox(s.mesh) }));
  const enemiesRaw = level.enemies.map(e => {
    const seg = e.axis === 'z' ? [e.cross, e.x0, e.cross, e.x1] : [e.x0, e.cross, e.x1, e.cross];
    return { e, seg, y: e.baseY ?? e.group.position.y };
  });
  /** Traversal aids along a stretch of route [s0, s1] at floor y0 -> y1 on line o0 -> o1. */
  const aidsFor = (s0, s1, o0, o1, y0, y1, takeMesh) => {
    const pts = [];
    for (let s = s0; s <= s1 + 1e-9; s += Math.max(.5, (s1 - s0) / 24)) { const pos = at(s), o = o0 + (o1 - o0) * (s - s0) / Math.max(1e-6, s1 - s0), [x, z] = colXZ(pos, o); pts.push([x, z]); }
    const yLo = Math.min(y0, y1) - 3, yHi = Math.max(y0, y1) + 4, aids = new Set();
    if (moverEnv.some(({ box }) => box.max.y >= yLo && box.min.y <= yHi && pts.some(([x, z]) => x >= box.min.x - 1 && x <= box.max.x + 1 && z >= box.min.z - 1 && z <= box.max.z + 1))) aids.add('mover');
    if (spinDecks.some(d => pts.some(([x, z]) => inSpinDeck(d, x, z, y0)))) aids.add('spinbridge');
    for (const r of rails) {
      let hits = 0;
      for (const [x, z] of pts) { const P = V(x, y0 + 1, z); if (r.distanceLowerBound(P) > 5) continue; const q = r.closest(P); if (Math.hypot(q.point.x - x, q.point.z - z) <= T.corridor + .6 && q.point.y >= y0 - 2 && q.point.y <= y0 + 4) hits++; }
      if (hits >= Math.min(2, pts.length)) aids.add(ropeRails.has(r) ? 'rope' : movingRailSet.has(r) ? 'moving-rail' : trickRailSet.has(r) ? 'trick-rail' : 'rail');
    }
    if (level.ropeSwings.some(rs => rs.anchor.y > y0 && pts.some(([x, z]) => Math.hypot(rs.anchor.x - x, rs.anchor.z - z) <= swingReach(rs)))) aids.add('ropeswing');
    for (const t of trampolines) { const q = rel(t.center.toArray()); if (Math.abs(q.lat) <= 4 && q.prog >= s0 - 8 && q.prog <= s1 && t.box.max.y <= y0 + 1.5) aids.add(t.mover ? 'bounce-mover' : 'trampoline'); }
    for (const p of speedPads) { const q = rel(p.center.toArray()); if (Math.abs(q.lat) <= 6 && q.prog >= s0 - 40 && q.prog <= s0) aids.add('speedpad'); }
    // A launch: take-off from a ramp / kicker / vert-ramp component, or a floor rising >= 0.5 m over the last 3 m before the edge.
    const tt = surfaceType(takeMesh), fa = floorAt(s0), fb = floorAt(s0 - 3);
    if (ramps.some(r => r.mesh === takeMesh) || (fa !== null && fb !== null && fa - fb >= .5)) aids.add('kicker');
    for (const c of crates) {
      if (c.c.concealed || c.box.max.y < y0 - 2.5 || c.box.max.y > y0 + 3) continue;
      if (pts.some(([x, z]) => x >= c.box.min.x - .6 && x <= c.box.max.x + .6 && z >= c.box.min.z - .6 && z <= c.box.max.z + .6))
        aids.add(c.outline ? 'outline-crate' : c.kind === 'bouncy' || c.kind === 'metalbounce' ? 'arrow-crate' : c.kind === 'metal' ? 'steel-crate' : c.kind === 'nitro' || c.kind === 'tnt' ? 'explosive-crate' : 'crate');
    }
    if (enemiesRaw.some(({ seg, y }) => y >= y0 - 4 && y <= y0 + 3 && pts.some(([x, z]) => segDist2D(x, z, ...seg) <= 1.5))) aids.add('enemy');
    if (outlineSurfaces.some(({ box }) => box.max.y >= y0 - 2 && box.max.y <= y0 + 3 && pts.some(([x, z]) => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z))) aids.add('outline-surface');
    return [...aids];
  };
  for (const e of events) if (e.type === 'void') e.aids = aidsFor(e.s0, e.s1, e.o0 ?? 0, e.o0 ?? 0, e.y0, e.y0, e.takeMesh);
  // Portal / teleport links: a lane segment longer than T.transit across a void is not walked route.
  const longSegs = [];
  for (let i = 0; i < route.arc.length - 1; i++) if (route.arc[i + 1] - route.arc[i] > T.transit) {
    const a = (route.arc[i] - startS) * dir, b = (route.arc[i + 1] - startS) * dir; longSegs.push([Math.min(a, b), Math.max(a, b)]); }
  for (const e of events) if (e.type === 'void') {
    e.transit = longSegs.some(([a, b]) => Math.min(b, e.s1) - Math.max(a, e.s0) > .5 * (b - a));
    if (e.transit) continue;
    // Standable ground at about take-off height further off the walked line (lane drawn beside the path, or a split route).
    let worst = 0;
    for (const t of [.25, .5, .75]) {
      const sm = e.s0 + (e.s1 - e.s0) * t, pos = at(sm); let found = null;
      for (let d = 0; d <= 20 + 1e-9 && found === null; d += 1) for (const sg of d ? [-1, 1] : [1]) {
        const o = (e.o0 ?? 0) + sg * d, [x, z] = colXZ(pos, o);
        if (surf.column(x, z, e.y0 + 8, e.y0 - 8).some(h => !badSurface(h, x, z))) { found = d; break; }
      }
      if (found === null) { worst = null; break; } worst = Math.max(worst, found);
    }
    e.offLane = worst;
  }
  // A drop with a grind line continuing at take-off height: the route may stay high (a rope or rail over the drop).
  for (const e of events) if (e.type === 'drop') { const a = aidsFor(e.s + 2, Math.min(L, e.s + 12), e.o0 ?? 0, e.o0 ?? 0, e.y0, e.y0, null).filter(k => ['rail', 'rope', 'moving-rail', 'trick-rail', 'mover'].includes(k)); if (a.length) e.aids = a; }
  for (const g of gaps) {
    g.aids = aidsFor(g.s0, g.s1, g.o0, g.o1, g.y0, g.y1, g.takeMesh);
    g.range = Object.fromEntries(MODES.map(m => [m, model.range(m, g.dh)]));
    g.cross = MODES.filter(m => g.range[m] !== null && g.range[m] >= g.jump);
    // Ground beside the gap at take-off height (outside the corridor) on one side at its 25/50/75 % points: the gap can be walked round.
    let side = null;
    for (const sgn of [-1, 1]) {
      let worst = 0, ok = true;
      for (const t of [.25, .5, .75]) {
        const s = g.s0 + (g.s1 - g.s0) * t, pos = at(s), o0 = g.o0 + (g.o1 - g.o0) * t; let found = null;
        for (let d = T.corridor + .4; d <= 12 + 1e-9; d += .8) {
          const o = o0 + sgn * d, [x, z] = colXZ(pos, o), h = surf.column(x, z, g.y0 + T.contUp, g.y0 - T.contDown).find(h => !badSurface(h, x, z));
          if (h) { found = d; break; }
        }
        if (found === null) { ok = false; break; } worst = Math.max(worst, found);
      }
      if (ok && (side === null || worst < side)) side = worst;
    }
    g.side = side;
  }
  for (const e of events) if (['gap', 'wall'].includes(e.type)) {
    const i = breaks.indexOf(e), next = breaks.slice(i + 1).find(b => startOf(b) > e.s1 + 1e-6), prev = [...breaks.slice(0, i)].reverse().find(b => endOf(b) < e.s0 - 1e-6);
    e.landDepth = (next ? startOf(next) : L) - e.s1; e.runup = e.s0 - (prev ? endOf(prev) : 0);
    e.landWidth = e.type === 'gap' ? widthAt(Math.min(L, e.s1 + Math.min(.6, Math.max(.1, e.landDepth / 2))), e.y1, e.o1) : null;
  }

  // ---- platforms: what the route stands on ----
  const byType = {}, byMesh = new Map();
  for (let i = 1; i < ground.length; i++) {
    const len = Math.min(T.step, ground[i][0] - ground[i - 1][0]), m = meshList[ground[i][3]], t = surfaceType(m);
    byType[t] = (byType[t] ?? 0) + len;
    if (m) byMesh.set(m, (byMesh.get(m) ?? 0) + len);
  }
  const widths = [];
  for (let next = 0, i = 0; i < ground.length; i++) if (ground[i][0] >= next) { widths.push([ground[i][0], widthAt(ground[i][0], ground[i][1], ground[i][2]), surfaceType(meshList[ground[i][3]])]); next = ground[i][0] + T.widthEvery; }
  const narrowRuns = []; let run = null;
  for (const [p, w] of widths) {
    if (w < T.narrow) { if (run && p - run.to <= T.widthEvery * 1.5) { run.to = p; run.min = Math.min(run.min, w); run.n++; } else { run = { from: p, to: p, min: w, n: 1 }; narrowRuns.push(run); } }
  }
  const surfaces = [...byMesh.entries()].map(([m, len]) => { const fp = footprint(m), q = rel(meshBox(m).getCenter(V(0, 0, 0)).toArray());
    return { t: surfaceType(m), nm: (compOf(m)?.nm ?? m.name ?? '').slice(0, 60) || null, len: r1(len), dims: fp.dims, shape: shapeOf(fp.dims), src: fp.src, prog: r1(q.prog) }; })
    .sort((a, b) => b.len - a.len);
  const landTypes = tally(gaps, g => surfaceType(g.landMesh));
  const landShapes = tally(gaps, g => g.landMesh ? shapeOf(footprint(g.landMesh).dims) : 'none');

  // ---- dynamic platforms and hazards ----
  const hazards = [];
  const addHazard = (kind, center, pts, box, extra = {}) => {
    const q = rel(center);
    const rels = pts.map(pt => rel(pt)), lats = rels.map(r => r.lat);
    const minAbs = Math.min(Math.abs(q.lat), ...lats.map(Math.abs)), straddle = lats.some(l => l < 0) && lats.some(l => l > 0);
    const progs = [q.prog, ...rels.map(r => r.prog)], outside = Math.max(...progs) < -5 || Math.min(...progs) > L + 5;
    const placement = outside ? 'off' : minAbs <= T.onPath || (straddle && minAbs <= T.flank) ? 'across' : minAbs <= T.flank ? 'flank' : 'off';
    const { src, ...rest } = extra;
    hazards.push({ kind, center, box, q, placement, progRange: [Math.min(...progs), Math.max(...progs)], cid: cidOf(src), ...rest });
  };
  const ring = (cx, cz, r, y, n = 8) => Array.from({ length: n }, (_, k) => [cx + r * Math.cos(k * 2 * Math.PI / n), y, cz + r * Math.sin(k * 2 * Math.PI / n)]);
  const boxPts = (b, y = b.max.y) => [[b.min.x, y, b.min.z], [b.max.x, y, b.min.z], [b.min.x, y, b.max.z], [b.max.x, y, b.max.z]];
  for (const c of level.crushers) {
    const box = new THREE.Box3(V(c.x - c.w / 2, c.restY - c.h / 2, c.z - c.d / 2), V(c.x + c.w / 2, c.restY + c.raise + c.h / 2, c.z + c.d / 2));
    addHazard('crusher', [c.x, c.restY - c.h / 2, c.z], boxPts(box, box.min.y), box, { src: c.mesh, orient: 'vertical', timing: { cycle: c.cycle, phase: c.phase }, size: [c.w, c.d].map(r2), drop: r2(c.raise) });
  }
  for (const p of level.pendulums) {
    const pv = p.pivot.position, reach = p.len * Math.sin(Math.min(Math.PI / 2, Math.abs(p.amp))), dx = Math.cos(p.yaw), dz = -Math.sin(p.yaw);
    const pts = [-1, -.5, 0, .5, 1].map(t => { const a = t * Math.abs(p.amp); return [pv.x + dx * p.len * Math.sin(a), pv.y - p.len * Math.cos(a), pv.z + dz * p.len * Math.sin(a)]; });
    const box = p.box.clone().expandByVector(V(Math.abs(dx) * reach, 0, Math.abs(dz) * reach)); box.min.y = Math.min(box.min.y, pv.y - p.len - 1); box.max.y = Math.max(box.max.y, pv.y);
    const q = rel([pv.x, pv.y - p.len, pv.z]);
    addHazard('pendulum', [pv.x, pv.y - p.len, pv.z], pts, box, { src: p.pivot, orient: orient(dx, dz, q.fx, q.fz), timing: { speed: p.speed, period: r2(2 * Math.PI / p.speed), phase: p.phase, amp: r2(p.amp) }, size: [r2(p.len), r2(2 * reach)],
      bobClear: (() => { const fl = floorAt(q.prog); return fl === null ? null : r2(pv.y - p.len - fl); })() });
  }
  const chaseStone = level.boulder?.st ?? null;
  const stones = [...level.stones]; if (chaseStone && !stones.includes(chaseStone)) stones.push(chaseStone);
  for (const s of stones) {
    const chase = !!s.chase || s === chaseStone, y = s.mesh.position.y - s.r;
    const a = s.axis === 'x' && s.x0 !== undefined ? [s.x0, y, s.z ?? s.mesh.position.z] : [s.x, y, s.z0], b = s.axis === 'x' && s.x0 !== undefined ? [s.x1, y, s.z ?? s.mesh.position.z] : [s.x, y, s.z1];
    const box = new THREE.Box3(V(Math.min(a[0], b[0]) - s.r, y, Math.min(a[2], b[2]) - s.r), V(Math.max(a[0], b[0]) + s.r, y + 2 * s.r, Math.max(a[2], b[2]) + s.r));
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]), mid = [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2], q = rel(mid);
    const pts = chase ? [a, mid, b] : Array.from({ length: 7 }, (_, k) => [a[0] + (b[0] - a[0]) * k / 6, y, a[2] + (b[2] - a[2]) * k / 6]);
    addHazard(chase ? 'boulder-chase' : 'boulder', mid, pts, box, { src: s.mesh, orient: orient(b[0] - a[0], b[2] - a[2], q.fx, q.fz),
      timing: chase ? { speed: r2(s.speed) } : { speed: r2(s.speed), period: s.speed > 0 ? r2(2 * len / s.speed) : null }, size: [r2(2 * s.r), r2(len)] });
  }
  for (const t of level.fireTikis) {
    const sp = t.spec, yaw = (sp.yaw ?? 0) * Math.PI / 180, R = (sp.range ?? 7.1) * (sp.w ?? 1), amp = (sp.amp ?? 28) * .65 * Math.PI / 180, y = sp.p[1] + 1;
    const pts = [[sp.p[0], y, sp.p[2]]];
    for (const r of [R / 2, R]) for (const a of [-amp, 0, amp]) pts.push([sp.p[0] + r * Math.sin(yaw + a), y, sp.p[2] + r * Math.cos(yaw + a)]);
    const box = new THREE.Box3().setFromPoints(pts.map(p => V(...p))).expandByVector(V(.6, 1.2, .6)), q = rel(sp.p);
    addHazard('firetiki', sp.p, pts, box, { src: t.group, orient: orient(Math.sin(yaw), Math.cos(yaw), q.fx, q.fz), timing: { cycle: sp.cycle ?? 7.8, phase: sp.phase ?? 0, fireShare: .23, sweepDeg: r1((sp.amp ?? 28) * .65) }, size: [r2(R)] });
  }
  for (const g of level.grindosauri) {
    const a = g.home.clone().addScaledVector(g.axis, g.minimum), b = g.home.clone().addScaledVector(g.axis, g.maximum), q = rel(g.home.toArray());
    const box = g.body.clone().union(new THREE.Box3().setFromPoints([a, b]).expandByScalar(1.5));
    addHazard('grindosaurus', g.home.toArray(), [a.toArray(), g.home.toArray(), b.toArray()], box, { src: g.group, orient: orient(g.axis.x, g.axis.z, q.fx, q.fz), timing: { speed: r2(g.speed), period: g.speed > 0 ? r2(2 * Math.abs(g.maximum - g.minimum) / g.speed) : null }, size: [r2(Math.abs(g.maximum - g.minimum))] });
  }
  for (const a of level.angryBalls) {
    const half = a.flatHalf + a.pipeRadius, p0 = a.bottom.clone().addScaledVector(a.cross, -half), p1 = a.bottom.clone().addScaledVector(a.cross, half), q = rel(a.bottom.toArray());
    addHazard('angryball', a.bottom.toArray(), [p0.toArray(), p1.toArray()], a.box.clone().union(new THREE.Box3().setFromPoints([p0, p1])), { src: a.mesh, orient: orient(a.cross.x, a.cross.z, q.fx, q.fz), timing: { speed: r2(a.speed), trigger: r2(a.activationRadius) }, size: [r2(2 * half)] });
  }
  for (const fd of level.minefields?.fields ?? []) {
    const d = fd.data, box = new THREE.Box3(V(d.p[0] - d.s[0] / 2, d.p[1] - 1, d.p[2] - d.s[1] / 2), V(d.p[0] + d.s[0] / 2, d.p[1] + 2, d.p[2] + d.s[1] / 2));
    addHazard('minefield', d.p, boxPts(box, d.p[1]), box, { size: d.s.map(r2), mines: fd.mines.length, safeSpots: (d.spots?.length ?? 0) + (d.rectangles?.length ?? 0) });
  }
  for (const m of level.movers) {
    const b = moverEnv.find(x => x.m === m).box, base = m.base, q = rel(base.toArray()), gp = m.mesh.geometry.parameters ?? {};
    const sz = Number.isFinite(gp.width) ? [gp.width, gp.depth] : (() => { const bb = m.mesh.geometry.boundingBox; return [bb.max.x - bb.min.x, bb.max.z - bb.min.z]; })();
    addHazard('mover', base.toArray(), boxPts(b), b, { src: m.mesh, orient: m.orbit ? 'orbit' : orient(m.axisV.x, m.axisV.z, q.fx, q.fz),
      timing: { speed: r2(m.speed), period: m.speed > 0 ? r2(2 * Math.PI / m.speed) : null, amp: r2(m.amp), travel: r2(2 * m.amp), phase: r2(m.phase), ...(m.spin ? { spin: m.spin } : {}), ...(m.orbit ? { orbit: m.orbit } : {}) },
      size: sz.map(r2), bounce: m.mesh.userData.trampolineBounce ?? undefined });
  }
  for (const p of level.phasePads) {
    const b = meshBox(p.mesh), gp = p.mesh.geometry.parameters ?? {};
    addHazard('phasepad', b.getCenter(V(0, 0, 0)).toArray(), boxPts(b), b, { src: p.mesh, timing: { cycle: p.cycle, duty: r2(p.duty), on: r2(p.cycle * p.duty), off: r2(p.cycle * (1 - p.duty)), phase: r2(p.phase) }, size: [gp.width, gp.depth].map(r2) });
  }
  for (const c of level.crumbles) {
    const b = meshBox(c.mesh), gp = c.mesh.geometry.parameters ?? {};
    addHazard('crumble', b.getCenter(V(0, 0, 0)).toArray(), boxPts(b), b, { src: c.mesh, timing: { shake: r2(c.shakeTime), fall: r2(c.fallSpeed), returns: 10 }, size: [gp.width, gp.depth].map(r2) });
  }
  for (const rs of level.ropeSwings) {
    const reach = swingReach(rs) - 1.5, dx = Math.cos(rs.yaw), dz = -Math.sin(rs.yaw), a = rs.anchor, low = a.y - rs.len;
    const pts = [[a.x - dx * reach, low, a.z - dz * reach], [a.x, low, a.z], [a.x + dx * reach, low, a.z + dz * reach]], q = rel([a.x, low, a.z]);
    const box = new THREE.Box3().setFromPoints(pts.map(p => V(...p))).expandByScalar(1); box.max.y = a.y;
    addHazard('ropeswing', [a.x, low, a.z], pts, box, { src: rs.pivot, orient: orient(dx, dz, q.fx, q.fz), timing: { speed: rs.speed ? r2(rs.speed) : 'natural', period: rs.speed ? r2(2 * Math.PI / rs.speed) : null, amp: r2(rs.amp), ...(rs.travel ? { travel: r2(2 * rs.travel.amp), travelSpeed: r2(rs.travel.speed) } : {}) }, size: [r2(rs.len)] });
  }
  for (const d of spinDecks) {
    const e = [d.p[0] + d.span * Math.cos(d.yaw), d.p[1], d.p[2] - d.span * Math.sin(d.yaw)], q = rel(d.p);
    const box = new THREE.Box3().setFromPoints([V(...d.p), V(...e)]).expandByScalar(d.width / 2 + .3);
    addHazard('spinbridge', [(d.p[0] + e[0]) / 2, d.p[1], (d.p[2] + e[2]) / 2], [d.p, e], box, { src: d.b.pivot, orient: orient(e[0] - d.p[0], e[2] - d.p[2], q.fx, q.fz), timing: { open: d.cmp.cycle ?? .55, hold: d.cmp.hold ?? 'latched' }, size: [r2(d.span), r2(d.width)] });
  }
  for (const r of level.ropes) {
    const pts = r.rail.points.map(p => p.toArray()), box = new THREE.Box3().setFromPoints(r.rail.points).expandByScalar(1);
    addHazard('snaprope', box.getCenter(V(0, 0, 0)).toArray(), pts, box, { src: r.rail.object, timing: { breakAfter: r2(r.breakTime), restring: r.regen ?? 'reset' }, size: [r2(r.rail.totalLength)] });
  }
  for (const m of level.movingRails) {
    const pts = m.rail.points.map(p => p.toArray()), box = new THREE.Box3().setFromPoints(m.rail.points), v = m.axisV.clone().multiplyScalar(m.amp);
    box.union(box.clone().translate(v)).union(box.clone().translate(v.clone().negate())).expandByScalar(.5);
    const c = box.getCenter(V(0, 0, 0)), q = rel(c.toArray());
    addHazard('movingrail', c.toArray(), pts, box, { src: m.object, orient: orient(m.axisV.x, m.axisV.z, q.fx, q.fz), timing: { speed: r2(m.speed), period: m.speed > 0 ? r2(2 * Math.PI / m.speed) : null, travel: r2(2 * m.amp) }, size: [r2(m.rail.totalLength)] });
  }
  for (const t of level.thornClusters ?? []) {
    const box = new THREE.Box3().setFromObject(t.group); if (box.isEmpty()) box.setFromCenterAndSize(t.group.position, V(1, 1, 1));
    addHazard('thorn', t.group.position.toArray(), boxPts(box, box.min.y), box, { src: t.group, size: [r2(box.max.x - box.min.x), r2(box.max.z - box.min.z)] });
  }
  for (const b of level.tumbleBoxes ?? []) addHazard('tumblezone', b.getCenter(V(0, 0, 0)).toArray(), boxPts(b, b.min.y), b.clone(), { size: [r2(b.max.x - b.min.x), r2(b.max.z - b.min.z)] });

  // ---- enemies ----
  const variantOf = e => { const v = e.visual?.diagnostics; const parts = [];
    if (v?.appearance) parts.push(v.appearance);
    const comp = compOf(e.group); if (comp?.dkind) parts.push(comp.dkind);
    return parts.join('/') || null; };
  const enemies = enemiesRaw.map(({ e, seg, y }, i) => {
    const home = e.homePosition?.clone() ?? e.group.position.clone(), q = rel(home.toArray(), y);
    const segPts = []; const len = Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
    for (let k = 0; k <= Math.max(1, Math.ceil(len)); k++) { const t = k / Math.max(1, Math.ceil(len)); segPts.push([seg[0] + (seg[2] - seg[0]) * t, y, seg[1] + (seg[3] - seg[1]) * t]); }
    const rels = segPts.map(p => rel(p)), minLat = Math.min(...rels.map(r => Math.abs(r.lat)));
    const box = new THREE.Box3(V(Math.min(seg[0], seg[2]) - .6, y, Math.min(seg[1], seg[3]) - .6), V(Math.max(seg[0], seg[2]) + .6, y + 1.6, Math.max(seg[1], seg[3]) + .6));
    // Lethal drop (pit / water / void / > 3 m fall) within 2 m of the patrol line.
    let edge = false;
    outer: for (const [x, , z] of segPts) for (const r of [1.2, 2]) for (let k = 0; k < 8; k++) {
      const px = x + r * Math.cos(k * Math.PI / 4), pz = z + r * Math.sin(k * Math.PI / 4), out = fallOutcome(px, pz, y + .5);
      if (out.kind !== 'ground' || y - out.y > 3) { edge = true; break outer; }
    }
    const under = fallOutcome(home.x, home.z, y + .5), supported = under.kind === 'ground' && y - under.y <= 1.2;
    const progs = rels.map(r => r.prog), outside = Math.max(...progs) < -5 || Math.min(...progs) > L + 5;
    return { i, kind: e.kind, cid: cidOf(e.group), variant: variantOf(e), p: home.toArray(), y, seg, prog: q.prog, lat: q.lat, progRange: [Math.min(...progs), Math.max(...progs)],
      placement: outside ? 'off-route' : minLat <= T.enemyOnPath ? 'on-route' : minLat <= T.flank ? 'flank' : 'off-route',
      axis: e.kind === 'sentry' || e.kind === 'spinner' || len < .1 ? 'static' : orient(seg[2] - seg[0], seg[3] - seg[1], q.fx, q.fz), extent: len, speed: e.speed, box, edge, supported };
  });

  // ---- relations ----
  const gapRelation = (range, lateralOk) => {
    if (!lateralOk) return null;
    let best = null;
    for (const g of gaps) {
      const [a, b] = range;
      let r = null, d = null;
      if (b >= g.s0 - .5 && a <= g.s1 + .5) { r = 'in-gap'; d = 0; }
      else if (b < g.s0 && g.s0 - b <= T.edgeGuard) { r = 'takeoff'; d = g.s0 - b; }
      else if (a > g.s1 && a - g.s1 <= T.edgeGuard) { r = 'landing'; d = a - g.s1; }
      if (r && (!best || d < best.d)) best = { r, d, gap: gaps.indexOf(g) };
    }
    return best;
  };
  for (const h of hazards) {
    h.gap = gapRelation(h.progRange, h.placement !== 'off');
    h.crates = cratesNear(h.box); h.crateDist = nearestCrate(h.box);
    h.enemies = enemies.filter(e => boxGap(e.box, h.box) <= T.near).length;
    h.cp = cpRel(h.q.prog); h.sec = secOf(h.q.prog);
  }
  for (const e of enemies) {
    e.gap = gapRelation(e.progRange, e.placement !== 'off-route');
    e.crates = cratesNear(e.box); e.crateDist = nearestCrate(e.box);
    e.hazards = [...new Set(hazards.filter(h => boxGap(e.box, h.box) <= T.near).map(h => h.kind))];
    e.danger = e.hazards.filter(k => DANGER.has(k));
    e.group = enemies.filter(o => o !== e && o.placement !== 'off-route' && Math.abs(o.prog - e.prog) <= 6 && Math.abs(o.y - e.y) <= 4).length;
    e.cp = cpRel(e.prog); e.sec = secOf(e.prog);
  }
  const firsts = {};
  for (const e of [...enemies].filter(e => e.placement !== 'off-route').sort((a, b) => a.prog - b.prog)) {
    if (firsts[e.kind]) continue;
    const others = enemies.filter(o => o !== e && o.placement !== 'off-route' && Math.abs(o.prog - e.prog) <= T.alone);
    const dangerNear = hazards.filter(h => DANGER.has(h.kind) && boxGap(e.box, h.box) <= 8);
    const alone = !others.length && !dangerNear.length && !e.gap;
    const safe = e.supported && !e.edge && e.gap?.r !== 'in-gap';
    firsts[e.kind] = { enemy: e.i, prog: r1(e.prog), sec: e.sec, alone, safe, others: others.length, danger: [...new Set(dangerNear.map(h => h.kind))], edge: e.edge, gap: e.gap?.r ?? null, variant: e.variant };
  }

  // ---- rhythm ----
  const beats = [];
  const inRoute = (p, lat) => p >= -1 && p <= L + 1 && Math.abs(lat) <= T.beatCorridor;
  for (const g of gaps) beats.push({ t: 'G', s: g.s0 });
  for (const e of enemies) if (inRoute(e.prog, e.lat) || e.placement !== 'off-route') beats.push({ t: 'E', s: e.prog });
  for (const h of hazards) if (BEAT_HAZARDS.has(h.kind) && h.placement !== 'off' && h.q.prog >= -1 && h.q.prog <= L + 1) beats.push({ t: 'H', s: h.q.prog, k: h.kind });
  for (const cl of clusters) if (!cl.steelOnly && inRoute(cl.prog, cl.lat)) beats.push({ t: 'C', s: cl.prog });
  const railRecs = rails.map(r => {
    const rr = r.points.map(p => rel(p.toArray())), near = rr.filter(q => Math.abs(q.lat) <= T.beatCorridor && q.prog >= -1 && q.prog <= L + 1);
    return { kind: ropeRails.has(r) ? 'rope' : movingRailSet.has(r) ? 'moving' : trickRailSet.has(r) ? 'trick' : 'rail', len: r.totalLength, on: near.length > 0, s: near.length ? Math.min(...near.map(q => q.prog)) : null };
  });
  for (const r of railRecs) if (r.on) beats.push({ t: 'R', s: r.s });
  const rampRecs = [...ramps.map(r => ({ kind: r.kind, center: r.center })), ...trampolines.filter(t => !t.mover).map(t => ({ kind: 'trampoline', center: t.center })), ...speedPads.map(p => ({ kind: 'speedpad', center: p.center }))]
    .map(r => { const q = rel(r.center.toArray()); return { kind: r.kind, s: q.prog, lat: q.lat, on: inRoute(q.prog, q.lat) }; });
  for (const r of rampRecs) if (r.on) beats.push({ t: 'K', s: r.s, k: r.kind });
  beats.sort((a, b) => a.s - b.s);
  const merged = [];
  for (const b of beats) { const last = [...merged].reverse().find(m => m.t === b.t); if (last && b.s - last.s <= T.beatMerge) continue; merged.push({ ...b, s: clamp(b.s, 0, L) }); }
  merged.sort((a, b) => a.s - b.s);
  const quietOf = (list, from, to) => { let q = { len: 0, from, to: from }; [from, ...list.map(b => b.s), to].forEach((p, i, arr) => { if (i && p - arr[i - 1] > q.len) q = { len: p - arr[i - 1], from: arr[i - 1], to: p }; }); return q; };
  const quiet = quietOf(merged, 0, L);

  // ---- sections ----
  const sections = bounds.slice(1).map((to, k) => {
    const from = bounds[k], inSec = p => (k === 0 || p >= from) && (k === bounds.length - 2 || p < to);
    const bs = merged.filter(b => inSec(b.s));
    return { i: k, from: r1(from), to: r1(to), len: r1(to - from), gaps: gaps.filter(g => inSec(g.s0)).length, lethal: gaps.filter(g => inSec(g.s0) && g.bottom.lethalShare >= .5).length,
      enemies: enemies.filter(e => e.placement !== 'off-route' && inSec(e.prog)).length, danger: hazards.filter(h => DANGER.has(h.kind) && h.placement !== 'off' && inSec(h.q.prog)).length,
      timed: hazards.filter(h => !DANGER.has(h.kind) && BEAT_HAZARDS.has(h.kind) && h.placement !== 'off' && inSec(h.q.prog)).length,
      beats: bs.map(b => b.t).join(''), quiet: r1(quietOf(bs, from, to).len) };
  });

  // ---- summaries ----
  const transitLen = sum(events.filter(e => e.type === 'void' && e.transit).map(e => e.s1 - e.s0)), Lm = Math.max(1, L - transitLen);
  const lethalGaps = gaps.filter(g => g.bottom.lethalShare >= .5);
  const exceed = m => gaps.filter(g => g.range[m] === null || g.range[m] < g.jump).length;
  const gapBreaks = gaps.map(g => [g.s0, g.s1]).sort((a, b) => a[0] - b[0]);
  let gapless = { len: 0, from: 0, to: 0 };
  [[0, 0], ...gapBreaks, [L, L]].forEach((g, i, arr) => { if (i) { const len = g[0] - arr[i - 1][1]; if (len > gapless.len) gapless = { len, from: arr[i - 1][1], to: g[0] }; } });
  const groundLen = sum(ground.slice(1).map((g, i) => Math.min(T.step, g[0] - ground[i][0])));
  const voids = events.filter(e => e.type === 'void');
  const narrowLen = widths.filter(w => w[1] < T.narrow).length * T.widthEvery, veryNarrowLen = widths.filter(w => w[1] < T.veryNarrow).length * T.widthEvery;
  const longestNarrow = maxBy(narrowRuns, r => r.to - r.from + T.widthEvery);
  const hz = hazards.filter(h => h.placement !== 'off');
  const timingRange = (kind, key) => { const v = hazards.filter(h => h.kind === kind && Number.isFinite(h.timing?.[key])).map(h => h.timing[key]); return v.length ? [r2(Math.min(...v)), r2(Math.max(...v))] : null; };
  const enemyOn = enemies.filter(e => e.placement !== 'off-route');
  const summary = {
    routeLen: r1(L), measuredLen: r1(Lm), transit: r1(transitLen),
    coverage: { ground: r2(groundLen / Lm), gaps: r2(sum(gaps.map(g => g.w)) / Lm), walls: r2(sum(events.filter(e => e.type === 'wall').map(e => e.w)) / Lm),
      void: r2(sum(voids.filter(v => !v.transit).map(v => v.s1 - v.s0)) / Lm) },
    gaps: gaps.length, lethalGaps: lethalGaps.length, safeGaps: gaps.length - lethalGaps.length, per100m: r2(100 * gaps.length / Lm), lethalPer100m: r2(100 * lethalGaps.length / Lm),
    width: { median: r2(median(gaps.map(g => g.w))), p90: r2(quantile(gaps.map(g => g.w), .9)), max: r2(Math.max(0, ...gaps.map(g => g.w))) },
    jump: { median: r2(median(gaps.map(g => g.jump))), p90: r2(quantile(gaps.map(g => g.jump), .9)), max: r2(Math.max(0, ...gaps.map(g => g.jump))) },
    hows: tally(gaps, g => g.how), shifts: events.filter(e => e.type === 'shift').length,
    exceed: Object.fromEntries(MODES.map(m => [m, exceed(m)])), aidOnly: gaps.filter(g => !g.cross.length).length,
    aidOnlyWithAid: gaps.filter(g => !g.cross.length && g.aids.some(a => !['kicker', 'speedpad'].includes(a))).length,
    gapless: { len: r1(gapless.len), from: r1(gapless.from), to: r1(gapless.to) }, landDepthMedian: r2(median(gaps.map(g => g.landDepth))), shortLandings: gaps.filter(g => g.landDepth < T.short).length,
    landWidthMedian: r2(median(gaps.map(g => g.landWidth))), avoidable: gaps.filter(g => g.side !== null && g.side <= 6).length,
    bottoms: tally(gaps, g => g.bottom.cls), lethalKinds: tally(lethalGaps, g => g.bottom.lethalKind), aids: tally(gaps.flatMap(g => g.aids)),
    up: gaps.filter(g => g.dh > .5).length, down: gaps.filter(g => g.dh < -.5).length,
    drops: events.filter(e => e.type === 'drop').length, climbs: events.filter(e => e.type === 'climb' && e.h >= T.contUp).length,
    climbsOverJump: events.filter(e => e.type === 'climb' && e.h > model.modes.foot.apex).length, walls: events.filter(e => e.type === 'wall').length,
    voids: voids.filter(v => !v.transit).length, voidAid: voids.filter(v => !v.transit && v.aids?.some(a => !['kicker', 'speedpad'].includes(a))).length,
    voidOffLane: voids.filter(v => !v.transit && !v.aids?.some(a => !['kicker', 'speedpad'].includes(a)) && v.offLane !== null && v.offLane !== undefined).length, transits: voids.filter(v => v.transit).length,
    cracks: events.filter(e => e.type === 'crack').length,
    surfaceShare: Object.fromEntries(Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v / Math.max(1, groundLen))])),
    distinctSurfaces: byMesh.size, narrowShare: r2(narrowLen / Math.max(1, widths.length * T.widthEvery)), veryNarrowShare: r2(veryNarrowLen / Math.max(1, widths.length * T.widthEvery)),
    longestNarrow: longestNarrow ? { len: r1(longestNarrow.to - longestNarrow.from + T.widthEvery), from: r1(longestNarrow.from), min: r2(longestNarrow.min) } : null,
    widthMedian: r2(median(widths.map(w => w[1]))), landTypes, landShapes,
    dynamic: { movers: level.movers.length, crumbles: level.crumbles.length, phasepads: level.phasePads.length, spinbridges: level.spinBridges.length, ropeswings: level.ropeSwings.length,
      movingrails: level.movingRails.length, snapropes: level.ropes.length, trampolines: trampolines.length, speedpads: speedPads.length },
    hazards: tally(hazards, h => h.kind), hazardsOnRoute: tally(hz, h => h.kind), placement: tally(hazards, h => h.placement),
    dangerOnRoute: hz.filter(h => DANGER.has(h.kind)).length, hazardsAtGaps: hz.filter(h => h.gap).length, hazardsNearCrates: hz.filter(h => h.crates > 0).length,
    hazardsAfterCheckpoint: hz.filter(h => h.cp[0] !== null && h.cp[0] <= 10).length,
    timing: Object.fromEntries(['crusher:cycle', 'pendulum:period', 'boulder:period', 'firetiki:cycle', 'mover:period', 'phasepad:cycle', 'crumble:shake', 'ropeswing:period', 'movingrail:period']
      .map(k => [k, timingRange(...k.split(':'))]).filter(([, v]) => v)),
    pits: pits.length, lethalWaterMeshes: level.lethalWater?.length ?? 0,
    enemies: enemies.length, enemiesOnRoute: enemyOn.length, enemyKinds: tally(enemies, e => e.kind), enemyVariants: tally(enemies.filter(e => e.variant), e => `${e.kind}/${e.variant}`),
    enemiesPer100m: r2(100 * enemyOn.length / Lm), patrolMedian: r2(median(enemies.filter(e => e.axis !== 'static').map(e => e.extent))),
    enemyPlacement: tally(enemies, e => e.placement), enemyAxis: tally(enemyOn, e => e.axis), enemiesAtGaps: tally(enemyOn.filter(e => e.gap), e => e.gap.r),
    enemiesNearCrates: enemyOn.filter(e => e.crates > 0).length, enemiesWithDanger: enemyOn.filter(e => e.danger.length).length, enemiesWithHazard: enemyOn.filter(e => e.hazards.length).length,
    enemiesOnEdge: enemyOn.filter(e => e.edge).length, enemiesGrouped: enemyOn.filter(e => e.group > 0).length,
    enemiesAfterCheckpoint: enemyOn.filter(e => e.cp[0] !== null && e.cp[0] <= 10).length,
    firstAloneSafe: Object.values(firsts).filter(f => f.alone && f.safe).length, firstKinds: Object.keys(firsts).length,
    crateClusters: clusters.filter(c => !c.steelOnly).length, rails: railRecs.filter(r => r.on).length, railLen: r1(sum(railRecs.filter(r => r.on).map(r => r.len))), ramps: tally(rampRecs.filter(r => r.on), r => r.kind),
    beats: merged.length, beatsPer100m: r2(100 * merged.length / Lm), beatMix: tally(merged, b => b.t),
    beatsPer100mByKind: Object.fromEntries(['G', 'E', 'H', 'C', 'R', 'K'].map(t => [t, r2(100 * merged.filter(b => b.t === t).length / Lm)])),
    quiet: { len: r1(quiet.len), from: r1(quiet.from), to: r1(quiet.to) }, checkpoints: cpProgs.length, rays,
  };

  // ---- compact records ----
  const P = a => a.map(r2);
  const gapRecords = gaps.map((g, i) => ({ i, s0: r1(g.s0), s1: r1(g.s1), w: r2(g.w), j: r2(g.jump), dh: r2(g.dh), y0: r2(g.y0), p0: P(g.p0), p1: P(g.p1),
    ...(nameOf(g.takeMesh) ? { tnm: nameOf(g.takeMesh) } : {}), ...(nameOf(g.landMesh) ? { lnm: nameOf(g.landMesh) } : {}),
    bot: g.bottom.cls, ...(g.bottom.lethalKind ? { lk: g.bottom.lethalKind } : {}), ...(g.bottom.minSafeDepth !== null ? { dep: r1(g.bottom.minSafeDepth) } : {}),
    ...(g.bottom.cls === 'mixed' ? { ls: r2(g.bottom.lethalShare) } : {}), how: g.how, take: surfaceType(g.takeMesh), land: surfaceType(g.landMesh),
    ...(g.landMesh ? { ldims: footprint(g.landMesh).dims } : {}), ld: r1(g.landDepth), lw: r1(g.landWidth), ru: r1(g.runup),
    x: g.cross, ...(g.aids.length ? { aids: g.aids } : {}), ...(g.side !== null ? { side: r1(g.side) } : {}), sec: secOf(g.s0) }));
  const otherEvents = events.filter(e => ['drop', 'wall', 'void', 'shift'].includes(e.type) || (e.type === 'climb' && e.h >= T.contUp)).map(e => ({ t: e.type,
    s: r1(e.s ?? e.s0), ...(e.h !== undefined ? { h: r2(e.h) } : {}), ...(e.w !== undefined ? { w: r2(e.w) } : {}), ...(e.type === 'void' ? { to: r1(e.s1), bot: e.bottom?.cls } : {}), ...(e.wall ? { wall: r1(e.wall) } : {}), ...(e.aids?.length ? { aids: e.aids } : {}), ...(e.transit ? { transit: true } : {}),
    ...(e.offLane !== undefined && e.offLane !== null ? { offLane: e.offLane } : {}), ...(e.type === 'shift' ? { from: r1(e.from), to: r1(e.to) } : {}) }));
  const hazardRecords = hazards.map(h => ({ k: h.kind, ...(h.cid !== null ? { cid: h.cid } : {}), p: P(h.center), s: r1(h.q.prog), lat: r1(h.q.lat), pl: h.placement, ...(h.orient ? { or: h.orient } : {}),
    ...(h.timing ? { tm: h.timing } : {}), ...(h.size ? { sz: h.size } : {}), ...(h.gap ? { gap: [h.gap.r, r1(h.gap.d), h.gap.gap] } : {}), ...(h.crates ? { cr: h.crates } : {}),
    ...(h.enemies ? { en: h.enemies } : {}), cp: h.cp, sec: h.sec, ...(h.bobClear !== undefined ? { bob: h.bobClear } : {}), ...(h.drop !== undefined ? { drop: h.drop } : {}),
    ...(h.mines !== undefined ? { mines: h.mines } : {}), ...(h.bounce !== undefined ? { bounce: h.bounce } : {}) }));
  const enemyRecords = enemies.map(e => ({ k: e.kind, ...(e.cid !== null ? { cid: e.cid } : {}), ...(e.variant ? { v: e.variant } : {}), p: P(e.p), s: r1(e.prog), lat: r1(e.lat), pl: e.placement, ax: e.axis, ext: r1(e.extent), spd: r2(e.speed),
    ...(e.gap ? { gap: [e.gap.r, r1(e.gap.d), e.gap.gap] } : {}), ...(e.crates ? { cr: e.crates } : {}), ...(e.crateDist !== null ? { crd: r1(e.crateDist) } : {}),
    ...(e.hazards.length ? { hz: e.hazards } : {}), ...(e.group ? { grp: e.group } : {}), ...(e.edge ? { edge: true } : {}), ...(!e.supported ? { unsupported: true } : {}), cp: e.cp, sec: e.sec }));
  return {
    id: target.id, title: target.title, name: level.name, group: target.group, island: target.island ?? null, islandName: target.islandName ?? null, boss: !!target.boss, source: target.source,
    killY: r2(killY), spawn: level.spawnPos.toArray().map(r2), gate: level.gateSpec ? [level.gateSpec.x, level.gateSpec.y, level.gateSpec.z].map(r2) : null,
    route: { method, length: r1(L), laneNodes, ...(note ? { note } : {}) }, checkpoints: cpProgs.map(r1), summary,
    sections, firsts, gaps: gapRecords, events: otherEvents,
    surfaces: surfaces.slice(0, 12), narrow: narrowRuns.filter(r => r.to - r.from + T.widthEvery >= 6).sort((a, b) => (b.to - b.from) - (a.to - a.from)).slice(0, 6).map(r => ({ from: r1(r.from), len: r1(r.to - r.from + T.widthEvery), min: r2(r.min) })),
    hazards: hazardRecords, enemies: enemyRecords, rails: railRecs.filter(r => r.on).map(r => ({ k: r.kind, s: r1(r.s), len: r1(r.len) })),
    ramps: rampRecs.filter(r => r.on).map(r => ({ k: r.kind, s: r1(r.s) })), clusters: clusters.filter(c => !c.steelOnly && inRoute(c.prog, c.lat)).map(c => [r1(c.prog), c.n]),
  };
}

// ---------------------------------------------------------------------------
const results = [], skipped = [];
let constants;
if (!RENDER_ONLY) await withSkateRuntime(async ({ server, THREE, Level }) => {
  const api = await server.ssrLoadModule('/src/level.ts');
  const { CAMPAIGN_LEVELS, CAMPAIGN_ISLANDS } = await server.ssrLoadModule('/src/campaign.ts');
  const islandName = id => CAMPAIGN_ISLANDS.find(island => island.id === id)?.name ?? id;
  const { PUZZLE_LEVELS } = await server.ssrLoadModule('/src/levels/puzzle-trilogy.ts');
  const { CRATE_SIZE } = await server.ssrLoadModule('/src/crateDimensions.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  let probe = null;
  try { probe = JSON.parse(await readFile(path.join(ROOT, 'docs/crate-bible/data/skate-crate-probe.json'), 'utf8')); } catch { /* fall back to the recorded numbers */ }
  const model = makeModel(TUNING, probe);
  constants = { crateSize: CRATE_SIZE, model: model.describe, thresholds: T };
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

  const quiet = () => {};
  console.warn = quiet; console.error = quiet; const rawLog = console.log; console.log = quiet;
  try {
    for (const target of targets) {
      const t0 = Date.now(); let level = null;
      try {
        level = new Level(new THREE.Scene(), target.entry);
        const t1 = Date.now();
        const record = measureLevel(THREE, level, target, { S: CRATE_SIZE, model });
        record.timing = { buildMs: t1 - t0, measureMs: Date.now() - t1 };
        results.push(record);
        const s = record.summary;
        log(`${target.id}: route ${s.routeLen} m [${record.route.method}], ground ${Math.round(100 * s.coverage.ground)}%, ${s.gaps} gaps (${s.lethalGaps} lethal), ${s.drops} drops, ${s.walls} walls, ${s.voids} voids, ${s.enemies} enemies, ${hazCount(s)} hazards, ${s.beats} beats; ${s.rays} rays, ${Date.now() - t1} ms`);
      } catch (error) {
        results.push({ id: target.id, title: target.title, group: target.group, island: target.island ?? null, source: target.source, error: String(error?.stack ?? error).split('\n').slice(0, 5).join(' | ') });
        log(`${target.id}: FAILED ${String(error?.stack ?? error).split('\n').slice(0, 3).join(' | ')}`);
      } finally { try { level?.dispose(); } catch { /* best effort */ } }
    }
  } finally { console.log = rawLog; }
}, { levelEntry: { id: '__geometry_report', name: 'Geometry report', data: { v: 1, name: 'Geometry report', spawn: [0, 1, 0], killY: -20, components: [] } } });
function hazCount(s) { return sum(Object.values(s.hazards)); }

// ---- route-quality grade ------------------------------------------------------
/** How far the walk can be trusted: lane-less routes, scenery walking, walls and unexplained voids lower it. */
function quality(l) {
  const s = l.summary, notes = [];
  if (l.route.method !== 'camnode lane') notes.push('no camnode lane: route is the spawn -> checkpoint -> gate chain');
  const decor = s.surfaceShare.decor ?? 0;
  if (decor >= .1) notes.push(`${Math.round(100 * decor)}% of the walk on solid decor scenery`);
  if (s.walls) notes.push(`${s.walls} walls across the corridor`);
  const unexplained = s.voids - s.voidAid;
  if (unexplained) notes.push(`${unexplained} void stretch(es) with no detected aid${s.voidOffLane ? ` (${s.voidOffLane} with ground beside the lane)` : ''}`);
  if (s.shifts >= 15) notes.push(`${s.shifts} lateral shifts (lane drawn beside the walkable path)`);
  if (s.transits) notes.push(`${s.transits} portal transit(s) excluded (${s.transit} m)`);
  const grade = decor >= .15 || s.walls >= 5 || (s.coverage.void >= .1 && unexplained) ? 'low' : unexplained || s.shifts >= 15 || decor >= .05 ? 'medium' : 'high';
  return { grade, notes };
}

// ---- aggregate ----------------------------------------------------------------
const BINS = {
  width: [[.6, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 8], [8, 10], [10, 12.5], [12.5, 16], [16, 25], [25, Infinity]],
  dh: [[-Infinity, -3], [-3, -.5], [-.5, .5], [.5, 1.7], [1.7, 2.85], [2.85, 4.59], [4.59, Infinity]],
  depth: [[0, 2], [2, 4], [4, 8], [8, 16], [16, 32], [32, Infinity]],
  lwidth: [[0, 1.2], [1.2, 2], [2, 4], [4, 8], [8, Infinity]],
};
const binLabel = ([a, b], unit = '') => a === -Infinity ? `< ${b}${unit}` : b === Infinity ? `≥ ${a}${unit}` : `${a}–${b}${unit}`;
const hist = (xs, bins) => Object.fromEntries(bins.map(b => [binLabel(b), xs.filter(x => x >= b[0] && x < b[1]).length]));
const ladder = g => g.x.includes('foot') ? 'foot jump' : g.x.includes('double') ? 'double jump' : g.x.includes('ollie12') ? 'board from cruise' : g.x.includes('ollie23') ? 'board at 23 m/s only' : 'beyond measured reach';
function aggregate(levels) {
  const ok = levels.filter(l => !l.error), gaps = ok.flatMap(l => l.gaps.map(g => ({ ...g, level: l.id }))), lethal = gaps.filter(g => g.bot !== 'safe' && (g.bot === 'lethal' || (g.ls ?? 0) >= .5));
  const S = k => sum(ok.map(l => l.summary[k] ?? 0)), Lm = sum(ok.map(l => l.summary.measuredLen));
  const hz = ok.flatMap(l => l.hazards.map(h => ({ ...h, level: l.id }))), en = ok.flatMap(l => l.enemies.map(e => ({ ...e, level: l.id })));
  const onH = hz.filter(h => h.pl !== 'off'), onE = en.filter(e => e.pl !== 'off-route');
  const merge = key => ok.reduce((m, l) => { for (const [k, v] of Object.entries(l.summary[key] ?? {})) m[k] = (m[k] ?? 0) + v; return m; }, {});
  const surfaceLen = ok.reduce((m, l) => { const g = l.summary.measuredLen * l.summary.coverage.ground; for (const [k, v] of Object.entries(l.summary.surfaceShare)) m[k] = (m[k] ?? 0) + v * g; return m; }, {});
  const groundLen = sum(Object.values(surfaceLen));
  const timing = (kind, key) => { const v = hz.filter(h => h.k === kind && Number.isFinite(h.tm?.[key])).map(h => h.tm[key]); return v.length ? { n: v.length, min: r2(Math.min(...v)), median: r2(median(v)), max: r2(Math.max(...v)) } : null; };
  const patrol = Object.fromEntries(ENEMY_KINDS.map(k => [k, en.filter(e => e.k === k && e.ax !== 'static')]).filter(([, v]) => v.length).map(([k, v]) => [k, r1(median(v.map(e => e.ext)))]));
  const firsts = ok.flatMap(l => Object.entries(l.firsts).map(([kind, f]) => ({ kind, level: l.id, ...f })));
  const beats = ok.flatMap(l => l.sections.map(s => ({ level: l.id, ...s })));
  const per = (n) => r2(100 * n / Math.max(1, Lm));
  return {
    levels: ok.length, failed: levels.length - ok.length, routeKm: r2(sum(ok.map(l => l.summary.routeLen)) / 1000), measuredKm: r2(Lm / 1000),
    coverage: { ground: r2(sum(ok.map(l => l.summary.coverage.ground * l.summary.measuredLen)) / Lm), gaps: r2(sum(ok.map(l => l.summary.coverage.gaps * l.summary.measuredLen)) / Lm),
      void: r2(sum(ok.map(l => l.summary.coverage.void * l.summary.measuredLen)) / Lm) },
    quality: tally(ok, l => l.quality?.grade),
    gaps: gaps.length, lethal: lethal.length, safe: gaps.length - lethal.length, per100m: per(gaps.length), lethalPer100m: per(lethal.length),
    per100mLevels: { median: r2(median(ok.map(l => l.summary.per100m))), min: r2(Math.min(...ok.map(l => l.summary.per100m))), max: r2(Math.max(...ok.map(l => l.summary.per100m))) },
    levelsWithoutGaps: ok.filter(l => !l.summary.gaps).map(l => l.id),
    width: { median: r2(median(gaps.map(g => g.w))), p25: r2(quantile(gaps.map(g => g.w), .25)), p75: r2(quantile(gaps.map(g => g.w), .75)), p90: r2(quantile(gaps.map(g => g.w), .9)), max: r2(Math.max(0, ...gaps.map(g => g.w))) },
    widthHist: hist(gaps.map(g => g.w), BINS.width), widthHistLethal: hist(lethal.map(g => g.w), BINS.width), dhHist: hist(gaps.map(g => g.dh), BINS.dh),
    exceed: Object.fromEntries(MODES.map(m => [m, gaps.filter(g => !g.x.includes(m)).length])), ladder: tally(gaps, ladder),
    aidOnly: gaps.filter(g => !g.x.length).length, aidOnlyWithAid: gaps.filter(g => !g.x.length && (g.aids ?? []).some(a => !['kicker', 'speedpad'].includes(a))).length,
    aidOnlyLaunch: gaps.filter(g => !g.x.length && (g.aids ?? []).includes('kicker')).length,
    aids: tally(gaps.flatMap(g => g.aids ?? [])), bottoms: tally(gaps, g => g.bot), lethalKinds: tally(lethal, g => g.lk ?? 'void'),
    safeDepth: { median: r1(median(gaps.filter(g => g.dep !== undefined).map(g => g.dep))) }, hows: tally(gaps, g => g.how),
    landDepthHist: hist(gaps.map(g => g.ld), BINS.depth), landDepthMedian: r1(median(gaps.map(g => g.ld))), landWidthHist: hist(gaps.map(g => g.lw), BINS.lwidth), landWidthMedian: r1(median(gaps.map(g => g.lw))),
    landTypes: tally(gaps, g => g.land), landShapes: merge('landShapes'), avoidable: gaps.filter(g => g.side !== undefined && g.side <= 6).length,
    up: gaps.filter(g => g.dh > .5).length, down: gaps.filter(g => g.dh < -.5).length,
    gapless: { median: r1(median(ok.map(l => l.summary.gapless.len))), max: r1(Math.max(...ok.map(l => l.summary.gapless.len))) },
    drops: S('drops'), climbs: S('climbs'), climbsOverJump: S('climbsOverJump'), walls: S('walls'), voids: S('voids'), voidAid: S('voidAid'), transits: S('transits'), shifts: S('shifts'),
    voidKm: r2(sum(ok.map(l => l.summary.coverage.void * l.summary.measuredLen)) / 1000),
    surfaceShare: Object.fromEntries(Object.entries(surfaceLen).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, r2(v / Math.max(1, groundLen))])),
    narrowShare: r2(sum(ok.map(l => (l.summary.narrowShare ?? 0) * l.summary.measuredLen * l.summary.coverage.ground)) / Math.max(1, groundLen)),
    veryNarrowShare: r2(sum(ok.map(l => (l.summary.veryNarrowShare ?? 0) * l.summary.measuredLen * l.summary.coverage.ground)) / Math.max(1, groundLen)),
    widthMedian: r1(median(ok.map(l => l.summary.widthMedian).filter(Number.isFinite))),
    walkedShapes: tally(ok.flatMap(l => l.surfaces), s => s.shape), dynamic: merge('dynamic'),
    hazards: tally(hz, h => h.k), hazardsOnRoute: tally(onH, h => h.k), placement: tally(hz, h => h.pl),
    dangerOnRoute: onH.filter(h => DANGER.has(h.k)).length, dangerPer100m: per(onH.filter(h => DANGER.has(h.k)).length), timedOnRoute: onH.filter(h => !DANGER.has(h.k) && BEAT_HAZARDS.has(h.k)).length,
    dangerAtGaps: tally(onH.filter(h => DANGER.has(h.k) && h.gap), h => h.gap[0]), timedAtGaps: onH.filter(h => !DANGER.has(h.k) && h.gap).length,
    dangerNearCrates: onH.filter(h => DANGER.has(h.k) && h.cr).length, dangerAfterCheckpoint: onH.filter(h => DANGER.has(h.k) && h.cp[0] !== null && h.cp[0] <= 10).length,
    dangerWithEnemy: onH.filter(h => DANGER.has(h.k) && h.en).length, orientation: tally(onH.filter(h => h.or && h.or !== 'vertical'), h => `${h.k}:${h.or}`),
    timing: Object.fromEntries([['crusher', 'cycle'], ['pendulum', 'period'], ['boulder', 'period'], ['firetiki', 'cycle'], ['mover', 'period'], ['mover', 'travel'], ['phasepad', 'cycle'], ['phasepad', 'duty'],
      ['crumble', 'shake'], ['ropeswing', 'period'], ['movingrail', 'period'], ['spinbridge', 'open'], ['snaprope', 'breakAfter']].map(([k, f]) => [`${k}.${f}`, timing(k, f)]).filter(([, v]) => v)),
    levelsWithDanger: ok.filter(l => l.hazards.some(h => DANGER.has(h.k) && h.pl !== 'off')).length,
    enemies: en.length, enemiesOnRoute: onE.length, enemyKinds: tally(en, e => e.k), enemyKindsOnRoute: tally(onE, e => e.k), variants: tally(en.filter(e => e.v), e => `${e.k}/${e.v}`),
    enemiesPer100m: per(onE.length), enemiesPer100mLevels: { median: r2(median(ok.map(l => l.summary.enemiesPer100m))), max: r2(Math.max(...ok.map(l => l.summary.enemiesPer100m))) },
    levelsWithoutEnemies: ok.filter(l => !l.summary.enemiesOnRoute).map(l => l.id), patrolByKind: patrol, patrolMedian: r1(median(en.filter(e => e.ax !== 'static').map(e => e.ext))),
    enemyPlacement: tally(en, e => e.pl), enemyAxis: tally(onE, e => e.ax), enemiesAtGaps: tally(onE.filter(e => e.gap), e => e.gap[0]),
    enemiesNearCrates: onE.filter(e => e.cr).length, enemiesWithDanger: onE.filter(e => (e.hz ?? []).some(k => DANGER.has(k))).length, enemiesWithHazard: onE.filter(e => e.hz?.length).length,
    enemiesOnEdge: onE.filter(e => e.edge).length, enemiesGrouped: onE.filter(e => e.grp).length, enemiesAfterCheckpoint: onE.filter(e => e.cp[0] !== null && e.cp[0] <= 10).length,
    firsts: firsts.length, firstAlone: firsts.filter(f => f.alone).length, firstSafe: firsts.filter(f => f.safe).length, firstAloneSafe: firsts.filter(f => f.alone && f.safe).length,
    firstBlockers: tally(firsts.filter(f => !(f.alone && f.safe)).flatMap(f => [...(f.edge ? ['lethal edge'] : []), ...(f.gap ? [`gap ${f.gap}`] : []), ...(f.others ? ['other enemy'] : []), ...(f.danger.length ? ['danger hazard'] : [])])),
    firstSection: { median: median(firsts.map(f => f.sec)) },
    beats: S('beats'), beatsPer100m: per(S('beats')), beatsPer100mLevels: { median: r2(median(ok.map(l => l.summary.beatsPer100m))), min: r2(Math.min(...ok.map(l => l.summary.beatsPer100m))), max: r2(Math.max(...ok.map(l => l.summary.beatsPer100m))) },
    beatMix: merge('beatMix'), beatsPer100mByKind: Object.fromEntries(['G', 'E', 'H', 'C', 'R', 'K'].map(t => [t, per(sum(ok.map(l => l.summary.beatMix[t] ?? 0)))])),
    quiet: { median: r1(median(ok.map(l => l.summary.quiet.len))), max: r1(Math.max(...ok.map(l => l.summary.quiet.len))) },
    sections: beats.length, sectionsNoGap: beats.filter(b => !b.gaps).length, sectionsNoEnemy: beats.filter(b => !b.enemies).length, sectionsNoThreat: beats.filter(b => !b.gaps && !b.enemies && !b.danger).length,
    sectionQuietMedian: r1(median(beats.map(b => b.quiet))), sectionBeatsPer100m: r2(median(beats.filter(b => b.len >= 20).map(b => 100 * b.beats.length / b.len))),
  };
}

// ---- report -------------------------------------------------------------------
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map(r => `| ${r.map(v => v === null || v === undefined || v === '' ? '—' : String(v).replace(/\|/g, '/')).join(' | ')} |`)].join('\n');
const frac = (a, b) => b ? `${a} (${Math.round(100 * a / b)}%)` : `${a}`;
const pc = (a, b) => b ? `${Math.round(100 * a / b)}%` : '—';
const topOf = (m, k = 3, f = v => v) => Object.entries(m ?? {}).sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, v]) => `${key} ${f(v)}`).join(', ') || '—';
const at = p => `(${p.map(v => Math.round(v * 10) / 10).join(', ')})`;
const MODE_LABEL = { foot: 'foot jump', double: 'double jump', ollie12: 'board from cruise', ollie23: 'board at 23 m/s' };
const crossText = x => x.length ? x.map(m => MODE_LABEL[m]).join(', ') : 'none of the measured moves';
const BEAT_NAMES = { G: 'gap', E: 'enemy', H: 'hazard / timed platform', C: 'crate cluster', R: 'rail', K: 'ramp / kicker / launcher' };
const rng = r => r ? (r.min === r.max ? `${r.min}` : `${r.min}–${r.max} (median ${r.median})`) : '—';

/** Rule-based notable examples: each rule picks the most extreme instance it can find. */
function notableExamples(levels, C) {
  const camp = levels.filter(l => l.group === 'campaign'), puz = levels.filter(l => l.group === 'puzzle'), out = [];
  const add = (lv, where, title, text) => out.push({ level: lv.id, course: lv.title, where, title, text, quality: lv.quality?.grade });
  const trusted0 = camp.filter(l => l.quality?.grade !== 'low');
  const trusted = trusted0.length ? trusted0 : camp;
  const pick = (f, list) => { const a = f(list.filter(l => trusted.includes(l))); return a ?? f(list); };
  const PLACE = { across: 'across the route', flank: 'beside the route', off: 'off the route' };
  const VERB = { pendulum: 'swinging', boulder: 'rolling', 'boulder-chase': 'rolling', mover: 'travelling', firetiki: 'breathing', grindosaurus: 'patrolling', angryball: 'rolling', ropeswing: 'swinging', spinbridge: 'opening', movingrail: 'travelling' };
  const orientText = h => h.or && h.or !== 'vertical' ? `, ${VERB[h.k] ?? 'oriented'} ${h.or === 'orbit' ? 'in an orbit' : `${h.or} it`}` : '';
  const dhText = dh => Math.abs(dh) < .05 ? 'level landing' : `landing ${dh > 0 ? '+' : ''}${dh} m`;
  const gapsOf = ls => ls.flatMap(l => l.gaps.map(g => ({ l, g })));
  const isLethal = g => g.bot === 'lethal' || (g.ls ?? 0) >= .5;
  const ride = g => (g.aids ?? []).filter(a => !['kicker', 'speedpad'].includes(a));
  const gapWhere = g => `take-off ${at(g.p0)}, ${g.s0} m along the route`;
  const R = C.model.flatRange;
  // 1. Widest gap that only the charged board clears.
  const charged = maxBy(gapsOf(trusted).filter(({ g }) => ladder(g) === 'board at 23 m/s only' && !ride(g).length && isLethal(g)), x => x.g.j);
  if (charged) add(charged.l, gapWhere(charged.g), 'Widest lethal gap that only a full-speed board clears',
    `${charged.g.j} m edge to edge (${charged.g.w} m along the route), ${dhText(charged.g.dh)}, over ${charged.g.lk ?? 'void'}${charged.g.tnm ? ` from "${charged.g.tnm}"` : ''}${charged.g.lnm ? ` to "${charged.g.lnm}"` : ''}${(charged.g.aids ?? []).includes('kicker') ? ', taken off a kicker' : ''}. Measured flat ranges are ${R.foot} m (foot jump), ${R.double} m (double jump), ${R.ollie12} m (charged ollie from cruise) and ${R.ollie23} m (full ollie at 23 m/s); adjusted for this landing height only the 23 m/s ollie reaches. ` +
    `${gapsOf(camp).filter(({ g }) => ladder(g) === 'board at 23 m/s only').length} campaign gaps are in this "board at 23 m/s only" band.`);
  // 2. Widest gap beyond every measured move with no aid at all.
  const bare = maxBy(gapsOf(trusted).filter(({ g }) => !g.x.length && !(g.aids ?? []).length), x => x.g.j);
  if (bare) add(bare.l, gapWhere(bare.g), 'Gap beyond every measured move with no aid detected',
    `${bare.g.j} m, ${dhText(bare.g.dh)} (${bare.g.tnm ? `"${bare.g.tnm}"` : bare.g.take} to ${bare.g.lnm ? `"${bare.g.lnm}"` : bare.g.land}), bottom ${bare.g.bot}${bare.g.lk ? ` (${bare.g.lk})` : ''}. No mover, rail, rope, swing, trampoline, crate, enemy or rising lip was found along it. ` +
    `${gapsOf(camp).filter(({ g }) => !g.x.length && !(g.aids ?? []).length).length} campaign gaps are like this; they need a launch the reach thresholds leave out (slopes, trampolines out of range, vert air) or mark a place where the route line leaves the walkable path.`);
  // 3. Longest ride over a lethal gap.
  const rideGap = maxBy(gapsOf(camp).filter(({ g }) => !g.x.length && ride(g).length && isLethal(g)), x => x.g.w);
  if (rideGap) add(rideGap.l, gapWhere(rideGap.g), 'Longest crossing carried by a ride',
    `${rideGap.g.w} m of ${rideGap.g.lk ?? 'void'} crossed by ${ride(rideGap.g).join(' + ')} (${dhText(rideGap.g.dh)} on ${rideGap.g.lnm ? `"${rideGap.g.lnm}"` : rideGap.g.land}). ` +
    `${gapsOf(camp).filter(({ g }) => !g.x.length && ride(g).length).length} campaign gaps are beyond every measured jump but have a ride or grind line across them.`);
  // 4. Highest upward gap.
  const up = maxBy(gapsOf(trusted).filter(({ g }) => isLethal(g)), x => x.g.dh);
  if (up && up.g.dh > 1) add(up.l, gapWhere(up.g), 'Highest upward lethal gap',
    `The landing is ${up.g.dh} m above the take-off across ${up.g.j} m (${up.g.take} to ${up.g.land}). Crossable by: ${crossText(up.g.x)}${ride(up.g).length ? `; aids: ${ride(up.g).join(', ')}` : ''}. Measured apexes: foot jump ${C.model.apex.foot} m, double jump ${C.model.apex.double} m, full ollie ${C.model.apex.ollie23} m.`);
  // 5. Deepest drop.
  const drop = pick(ls => maxBy(ls.flatMap(l => l.events.filter(e => e.t === 'drop').map(e => ({ l, e }))), x => x.e.h), camp);
  if (drop) add(drop.l, `${drop.e.s} m along the route`, 'Deepest step down onto safe ground',
    `The floor ends and safe ground continues ${drop.e.h} m lower with no landing at take-off height within ${T.jumpScan} m${drop.e.aids ? `; a ${drop.e.aids.join('/')} continues at the upper level, so the course offers a high line over the drop` : ''}. ` +
    `The campaign has ${sum(camp.map(l => l.summary.drops))} such drops (≥ ${T.contDown} m).`);
  // 6. Densest gap section.
  const dense = pick(ls => maxBy(ls.flatMap(l => l.sections.filter(s => s.len >= 40 && s.gaps >= 3).map(s => ({ l, s }))), x => x.s.gaps / x.s.len), camp);
  if (dense) add(dense.l, `section ${dense.s.i} (${dense.s.from}–${dense.s.to} m)`, 'Densest run of gaps between two checkpoints',
    `${dense.s.gaps} gaps (${dense.s.lethal} lethal) in ${dense.s.len} m: ${r1(100 * dense.s.gaps / dense.s.len)} per 100 m, against a campaign rate of ${r2(100 * sum(camp.map(l => l.summary.gaps)) / sum(camp.map(l => l.summary.measuredLen)))}. Beat string: \`${dense.s.beats}\`.`);
  // 7. Longest gapless stretch.
  const flat = maxBy(trusted, l => l.summary.gapless.len);
  if (flat) add(flat, `${flat.summary.gapless.from}–${flat.summary.gapless.to} m`, 'Longest stretch with no gap',
    `${flat.summary.gapless.len} m of continuous ground without a gap (${flat.summary.gaps} gaps in the whole ${flat.summary.measuredLen} m course). The campaign median of each course's longest gapless stretch is ${r1(median(camp.map(l => l.summary.gapless.len)))} m.`);
  // 8-9. Short and narrow landings after lethal gaps.
  const area = g => g.ldims && g.ldims[1] !== null ? g.ldims[0] * g.ldims[1] : Infinity;
  const short = minBy(gapsOf(trusted).filter(({ g }) => isLethal(g) && Number.isFinite(area(g))), x => area(x.g));
  if (short) add(short.l, `landing ${at(short.g.p1)}, ${short.g.s1} m along the route`, 'Smallest landing platform after a lethal gap',
    `A ${short.g.j} m gap (${dhText(short.g.dh)}) onto ${short.g.lnm ? `"${short.g.lnm}", ` : ''}a ${short.g.land} of ${short.g.ldims.join(' × ')} m; the walk runs ${short.g.ld} m on it before the next break and it is ${short.g.lw} m wide across travel. ` +
    `Campaign medians: landing depth ${r1(median(gapsOf(camp).map(({ g }) => g.ld)))} m, width ${r1(median(gapsOf(camp).map(({ g }) => g.lw)))} m; ${gapsOf(camp).filter(({ g }) => g.ld < T.short).length} landings are shorter than ${T.short} m along travel.`);
  const narrowLand = minBy(gapsOf(trusted).filter(({ g }) => isLethal(g) && g.lw !== null && g.ld >= 1 && ['level', 'offset'].includes(g.how) && !['vertramp', 'mesh-vert'].includes(g.land)), x => x.g.lw);
  if (narrowLand) add(narrowLand.l, `landing ${at(narrowLand.g.p1)}, ${narrowLand.g.s1} m along the route`, 'Narrowest landing after a lethal gap',
    `${narrowLand.g.lw} m of supported width across travel just past the landing edge of a ${narrowLand.g.j} m gap (landing on ${narrowLand.g.land}${narrowLand.g.ldims ? `, ${narrowLand.g.ldims.join(' × ')} m` : ''}). Campaign median landing width: ${r1(median(gapsOf(camp).map(({ g }) => g.lw)))} m.`);
  // 10. Longest narrow run.
  const nar = maxBy(trusted.filter(l => l.narrow.length).map(l => ({ l, n: l.narrow[0] })), x => x.n.len);
  if (nar) add(nar.l, `${nar.n.from}–${r1(nar.n.from + nar.n.len)} m along the route`, 'Longest walk on a narrow surface',
    `${nar.n.len} m where the supported width across travel stays under ${T.narrow} m (minimum ${nar.n.min} m). ${pc(Math.round(100 * nar.l.summary.narrowShare), 100)} of this course's sampled walk is narrow; the campaign share is ${Math.round(100 * aggregate(camp).narrowShare)}%.`);
  // 11. Fastest danger hazard.
  const hzsOf = ls => ls.flatMap(l => l.hazards.filter(h => h.pl !== 'off').map(h => ({ l, h }))), hzs = hzsOf(camp);
  const cyc = h => h.tm?.cycle ?? h.tm?.period ?? null;
  const fast = pick(ls => minBy(hzsOf(ls).filter(({ h }) => ['crusher', 'pendulum', 'boulder', 'firetiki'].includes(h.k) && cyc(h)), x => cyc(x.h)), camp);
  if (fast) add(fast.l, `${at(fast.h.p)}, ${fast.h.s} m along the route`, 'Fastest-cycling danger hazard on the route',
    `A ${fast.h.k} on a ${cyc(fast.h)} s ${fast.h.tm.cycle ? 'cycle' : 'period'}, ${PLACE[fast.h.pl]}${orientText(fast.h)}${fast.h.gap ? `, at a gap ${fast.h.gap[0]}` : ''}. Campaign ranges: crusher ${rng(aggregate(camp).timing['crusher.cycle'])} s, pendulum ${rng(aggregate(camp).timing['pendulum.period'])} s, rolling boulder ${rng(aggregate(camp).timing['boulder.period'])} s.`);
  // 12. Danger hazard at a gap edge.
  const edgeHz = hzs.filter(({ h }) => DANGER.has(h.k) && h.gap), edgeT = edgeHz.filter(({ l }) => trusted.includes(l)), pool = edgeT.length ? edgeT : edgeHz;
  const eh = pool.find(({ h }) => h.gap[0] === 'landing') ?? pool.find(({ h }) => h.gap[0] === 'takeoff') ?? pool[0];
  if (eh) add(eh.l, `${at(eh.h.p)}, ${eh.h.s} m along the route`, `Danger hazard at a gap ${eh.h.gap[0]}`,
    `A ${eh.h.k}${cyc(eh.h) ? ` (${cyc(eh.h)} s)` : ''} sits ${eh.h.gap[1]} m from ${eh.h.gap[0] === 'in-gap' ? 'inside' : `the ${eh.h.gap[0]} edge of`} gap #${eh.h.gap[2]} (${eh.l.gaps[eh.h.gap[2]]?.j} m). ` +
    `${edgeHz.length} of ${hzs.filter(({ h }) => DANGER.has(h.k)).length} campaign danger hazards on the route are within ${T.edgeGuard} m of a gap edge or over a gap.`);
  // 13. Shortest crumble warning.
  const crumble = pick(ls => minBy(hzsOf(ls).filter(({ h }) => h.k === 'crumble' && Number.isFinite(h.tm?.shake) && h.s >= 0), x => x.h.tm.shake), camp);
  if (crumble) add(crumble.l, `${at(crumble.h.p)}, ${crumble.h.s} m along the route`, 'Crumbling platform with the shortest warning',
    `Shakes for ${crumble.h.tm.shake} s before dropping (pad ${crumble.h.sz?.join(' × ')} m; it returns after 10 s). Campaign crumble warnings: ${rng(aggregate(camp).timing['crumble.shake'])} s over ${aggregate(camp).hazards.crumble ?? 0} pads.`);
  // 14. Enemies guarding gaps.
  const guard = pick(ls => maxBy(ls.filter(l => Object.keys(l.summary.enemiesAtGaps).length), l => sum(Object.values(l.summary.enemiesAtGaps))), camp);
  if (guard) { const e = guard.enemies.find(e => e.gap && e.gap[0] !== 'in-gap') ?? guard.enemies.find(e => e.gap);
    add(guard, `${at(e.p)}, ${e.s} m along the route`, 'Enemies posted at gap edges',
      `${sum(Object.values(guard.summary.enemiesAtGaps))} of ${guard.summary.enemiesOnRoute} enemies on the route stand within ${T.edgeGuard} m of a gap edge (${topOf(guard.summary.enemiesAtGaps)}); this ${ENEMY_NAMES[e.kind ?? e.k]} (${e.k}) is ${e.gap[1]} m from the ${e.gap[0]} edge of gap #${e.gap[2]}. ` +
      `Campaign: ${sum(camp.map(l => sum(Object.values(l.summary.enemiesAtGaps))))} enemies at gap edges out of ${sum(camp.map(l => l.summary.enemiesOnRoute))}.`); }
  // 15. First appearance stacked with a hazard or at an edge.
  const firsts = camp.flatMap(l => Object.entries(l.firsts).map(([k, f]) => ({ l, k, f })));
  const firstsT = firsts.filter(x => trusted.includes(x.l)), stacked = firstsT.find(x => x.f.danger.length) ?? firstsT.find(x => x.f.gap) ?? firsts.find(x => x.f.danger.length) ?? firsts.find(x => x.f.gap);
  if (stacked) { const e = stacked.l.enemies[stacked.f.enemy];
    add(stacked.l, `${at(e.p)}, ${e.s} m along the route`, 'A first appearance that is not alone on safe ground',
      `The course's first ${ENEMY_NAMES[stacked.k]} (${stacked.k}) appears ${stacked.f.danger.length ? `within 8 m of a ${stacked.f.danger.join(' and ')}` : `at a gap ${stacked.f.gap}`}${stacked.f.edge ? ', beside a lethal drop' : ''}. ` +
      `Across the campaign ${firsts.filter(x => x.f.alone && x.f.safe).length} of ${firsts.length} first appearances (per course and kind) are alone on safe ground.`); }
  // 16. Enemy density.
  const dEn = pick(ls => maxBy(ls.filter(l => l.summary.measuredLen >= 300), l => l.summary.enemiesPer100m), camp);
  if (dEn) add(dEn, 'whole course', 'Most enemies per 100 m',
    `${dEn.summary.enemiesOnRoute} enemies on the route over ${dEn.summary.measuredLen} m (${dEn.summary.enemiesPer100m} per 100 m): ${topOf(tally(dEn.enemies.filter(e => e.pl !== 'off-route'), e => e.v ? `${e.k} (${e.v})` : e.k), 9)}. ` +
    `${dEn.summary.enemiesOnEdge} stand within 2 m of a lethal drop and ${dEn.summary.enemiesWithDanger} beside a danger hazard. ${camp.filter(l => !l.summary.enemiesOnRoute).length} campaign courses have no enemy on the route.`);
  // 17. Longest quiet stretch.
  const q = maxBy(trusted, l => l.summary.quiet.len);
  if (q) add(q, `${q.summary.quiet.from}–${q.summary.quiet.to} m`, 'Longest stretch with no beat',
    `${q.summary.quiet.len} m without a gap, enemy, hazard, crate cluster, rail or ramp inside ${T.beatCorridor} m of the route. The course averages ${q.summary.beatsPer100m} beats per 100 m; the campaign median of each course's longest quiet stretch is ${r1(median(camp.map(l => l.summary.quiet.len)))} m.`);
  // 18. Densest beat section.
  const busy = pick(ls => maxBy(ls.flatMap(l => l.sections.filter(s => s.len >= 40).map(s => ({ l, s }))), x => x.s.beats.length / x.s.len), camp);
  if (busy) add(busy.l, `section ${busy.s.i} (${busy.s.from}–${busy.s.to} m)`, 'Busiest section',
    `${busy.s.beats.length} beats in ${busy.s.len} m (${r1(100 * busy.s.beats.length / busy.s.len)} per 100 m): \`${busy.s.beats}\` (G gap, E enemy, H hazard or timed platform, C crate cluster, R rail, K ramp/launcher).`);
  // 19. Timed-platform field.
  const timedLv = pick(ls => maxBy(ls, l => (l.summary.hazards.phasepad ?? 0) + (l.summary.hazards.mover ?? 0)), camp);
  const span = (xs, d = 2) => { const a = Math.min(...xs), b = Math.max(...xs); return a === b ? `${+a.toFixed(d)}` : `${+a.toFixed(d)}–${+b.toFixed(d)}`; };
  if (timedLv) { const ph = timedLv.hazards.filter(h => h.k === 'phasepad'), mv = timedLv.hazards.filter(h => h.k === 'mover');
    const first = timedLv.hazards.find(h => h.k === 'phasepad') ?? timedLv.hazards.find(h => h.k === 'mover');
    add(timedLv, first ? `${at(first.p)}, ${first.s} m along the route (first one)` : 'whole course', 'Largest field of timed platforms',
      `${mv.length} moving platforms${mv.length ? ` (periods ${span(mv.map(h => h.tm.period))} s, travel ${span(mv.map(h => h.tm.travel), 1)} m)` : ''}` +
      `${ph.length ? ` and ${ph.length} phase pads (cycle ${[...new Set(ph.map(h => h.tm.cycle))].join('/')} s, solid ${[...new Set(ph.map(h => h.tm.duty))].map(d => Math.round(100 * d) + '%').join('/')} of it)` : ''}; ` +
      `${timedLv.summary.coverage.ground < .5 ? `only ${Math.round(100 * timedLv.summary.coverage.ground)}% of the measured route is static ground` : `${Math.round(100 * timedLv.summary.coverage.ground)}% of the measured route is static ground`}, ${timedLv.summary.gaps} gaps (${timedLv.summary.aidOnlyWithAid} carried by rides).`); }
  // 20. Puzzle contrast.
  if (puz.length) { const P = aggregate(puz), A = aggregate(camp);
    add(puz[0], 'all three puzzle levels', 'Puzzle-trilogy contrast',
      `${P.gaps} gaps in ${Math.round(P.measuredKm * 1000)} m (${P.per100m} per 100 m against ${A.per100m} in the campaign), ${P.beatsPer100m} beats per 100 m (campaign ${A.beatsPer100m}), ${P.enemiesPer100m} enemies per 100 m (campaign ${A.enemiesPer100m}); ` +
      `gaps are bridged by ${topOf(P.aids, 4)}, and ${P.firstAloneSafe} of ${P.firsts} first appearances are alone on safe ground.`); }
  return out.slice(0, 20);
}

function renderReport(out) {
  const levels = out.levels.filter(l => !l.error), camp = levels.filter(l => l.group === 'campaign'), puz = levels.filter(l => l.group === 'puzzle');
  const A = out.aggregate.campaign, P = out.aggregate.puzzle, C = out.constants, M = C.model, lines = [];
  const failed = out.levels.filter(l => l.error);
  lines.push('# Current game level geometry audit', '',
    `Generated by \`node tools/level-geometry-report.mjs\` (commit \`${out.commit ?? 'unknown'}\`); per-level, per-gap, per-hazard and per-enemy records are in ` +
    '[`data/current-game-geometry.json`](data/current-game-geometry.json). This is a factual baseline of the gaps, platforms, hazards, enemies and pacing the game currently builds, ' +
    'measured on the same courses and route lines as the crate audit ([CURRENT_GAME_AUDIT.md](CURRENT_GAME_AUDIT.md)). It makes no comparison with Crash Bandicoot 2–4; that belongs in a separate document. ' +
    'Rerun the script after level changes; it takes about two minutes.', '');
  lines.push('## Headline numbers', '',
    `- ${A.levels} campaign courses (${A.measuredKm} km measured${A.routeKm !== A.measuredKm ? `, ${A.routeKm} km of route line including ${A.transits} portal transit` : ''}) and ${P.levels} puzzle-trilogy levels (${P.measuredKm} km) were built through the real \`Level\` class and walked in 0.25 m steps.${failed.length ? ` ${failed.length} failed to build: ${failed.map(f => `\`${f.id}\``).join(', ')}.` : ' None failed to build.'}`,
    `- Coverage of the campaign walk: ${Math.round(100 * A.coverage.ground)}% static standable ground, ${Math.round(100 * A.coverage.gaps)}% gap spans, ${Math.round(100 * A.coverage.void)}% longer stretches with no static ground (${A.voidAid} of ${A.voids} carried by movers, rails, trampolines or swings). Route-quality grades: ${topOf(A.quality, 3)}.`,
    `- Gaps: ${A.gaps} in the campaign (${A.lethal} lethal, ${A.safe} over a safe floor), ${A.per100m} per 100 m overall; per course the median is ${A.per100mLevels.median} (range ${A.per100mLevels.min}–${A.per100mLevels.max}). ${A.levelsWithoutGaps.length ? `${A.levelsWithoutGaps.length} course(s) have none: ${A.levelsWithoutGaps.map(id => `\`${id}\``).join(', ')}.` : 'Every course has at least one gap.'}`,
    `- Gap width along the route: median ${A.width.median} m (quartiles ${A.width.p25}–${A.width.p75} m, 90th percentile ${A.width.p90} m, widest ${A.width.max} m).`,
    `- Reach (measured flat ranges from the skate-crate probe: foot jump ${M.flatRange.foot} m, double jump ${M.flatRange.double} m, charged ollie from 12 m/s cruise ${M.flatRange.ollie12} m, full ollie at 23 m/s ${M.flatRange.ollie23} m; height differences adjusted with a two-gravity arc): ` +
      `${frac(A.exceed.foot, A.gaps)} of campaign gaps exceed a foot jump, ${frac(A.exceed.double, A.gaps)} a double jump, ${frac(A.exceed.ollie12, A.gaps)} a charged ollie from cruise and ${frac(A.exceed.ollie23, A.gaps)} a full ollie at 23 m/s (the board cannot land higher than its ${M.apex.ollie23} m apex). ` +
      `Of the ${A.aidOnly} gaps beyond every measured move, ${A.aidOnlyWithAid} have a ride or grind aid across them (${topOf(A.aids, 5)} across all gaps).`,
    `- Lethal gaps end in ${topOf(A.lethalKinds, 5)}. Landing pads after gaps: median ${A.landDepthMedian} m deep along travel and ${A.landWidthMedian} m wide across it.`,
    `- Longest gapless stretch per course: median ${A.gapless.median} m, longest ${A.gapless.max} m. Besides gaps the walk records ${A.drops} step-downs of ≥ ${T.contDown} m, ${A.climbs} step-ups of ≥ ${T.contUp} m (${A.climbsOverJump} above the ${M.apex.foot} m jump apex) and ${A.walls} walls.`,
    `- Walkable surfaces: ${topOf(A.surfaceShare, 5, v => `${Math.round(100 * v)}%`)} of the walked length; ${Math.round(100 * A.narrowShare)}% of the sampled walk is narrower than ${T.narrow} m across travel.`,
    `- Hazards: ${sum(Object.values(A.hazards))} hazard and timed-platform objects (${topOf(A.hazards, 8)}). ${A.dangerOnRoute} danger hazards (crusher, pendulum, boulder, fire tiki, grindosaurus, angry ball, minefield) lie across or beside the route in ${A.levelsWithDanger} course(s) (${A.dangerPer100m} per 100 m).`,
    `- Enemies: ${A.enemies} (${A.enemiesOnRoute} on or beside the route; ${A.enemiesPer100m} per 100 m): ${topOf(A.enemyKinds, 9)}. Median patrol length ${A.patrolMedian} m. ${A.levelsWithoutEnemies.length} courses have no enemy on the route. ` +
      `${A.firstAloneSafe} of ${A.firsts} first appearances (per course and kind) are alone on safe ground.`,
    `- Rhythm: ${A.beatsPer100m} beats per 100 m (per course median ${A.beatsPer100mLevels.median}, range ${A.beatsPer100mLevels.min}–${A.beatsPer100mLevels.max}); by kind per 100 m: ${Object.entries(A.beatsPer100mByKind).map(([k, v]) => `${BEAT_NAMES[k]} ${v}`).join(', ')}. Longest stretch without a beat: median ${A.quiet.median} m per course, longest ${A.quiet.max} m.`, '');

  lines.push('## Scope', '', 'Included: every authored campaign platforming course in `CAMPAIGN_LEVELS`, plus the three unregistered puzzle-trilogy layouts from `src/levels/puzzle-trilogy.ts` as a contrast group — the same set as the crate audit. ' +
    (out.levelSources.startsWith('stock') ? 'Run with `--stock`: source data only, public/levels.json ignored.' : 'The published pack (public/levels.json) is restored first, as in a fresh browser.'), '',
    mdTable(['Island', 'Course', 'Level id', 'Source', 'Route quality'], out.scope.included.map(s => { const l = out.levels.find(x => x.id === s.id); return [s.islandName ?? (s.group === 'puzzle' ? 'puzzle contrast' : '—'), s.title, `\`${s.id}\``, s.source, l?.quality ? `${l.quality.grade}${l.quality.notes.length ? `: ${l.quality.notes.join('; ')}` : ''}` : (l?.error ? 'failed to build' : '—')]; })), '',
    'Skipped:', '', mdTable(['Course', 'Level id', 'Reason'], out.scope.skipped.map(s => [s.title ?? '—', `\`${s.id}\``, s.reason])), '');

  lines.push('## Method', '',
    '- **Loading.** Each level is constructed with `new Level(scene, entry)` inside the headless `withSkateRuntime` harness (as `tools/crate-placement-report.mjs`). The state measured is the level at build time: switches unpressed, outline crates and surfaces inactive, spin bridges closed, movers at their base positions, phase pads solid, crumbles intact.',
    '- **Route line and sections.** Identical to the crate audit: the camnode lane (`lanePts`) when spawn and gate lie within 40 m of it and it spans at least half its length, otherwise spawn → checkpoints → gate. *Progress* is arc length from the spawn\'s projection toward the gate\'s; checkpoint progress values split the route into sections. ' +
      `A lane segment longer than ${T.transit} m that crosses a stretch with no ground is a portal or teleport link; it is excluded from the *measured length*, which is the denominator of every per-100 m figure.`,
    `- **The walk.** Camnode heights are camera data, not floor heights, so the floor is tracked from the ground itself. From the spawn, a walker steps along the route line every ${T.step} m and probes standable faces of \`Level.groundMeshes\` (the set the player's own ground probe uses; faces steeper than about 63° are walls) in ${Math.round(2 * T.corridor / T.colStep) + 1} vertical columns ${T.colStep} m apart across a ±${T.corridor} m corridor centred on its own line, which may drift up to ${T.cMax} m from the route line and eases back toward it whenever the floor allows. ` +
      `Moving platforms are excluded from the walk (they are reported as rides); crumbling pads and phase pads count as platforms in their initial state. A surface is not standable if it lies in a pit volume, under lethal water, below \`killY\`, or is a lethal or out-of-bounds mesh. ` +
      `Continuous ground may fall ${T.contDown} m or rise ${T.contUp} m between samples; a rise of ${T.contUp}–${T.climbMax} m is a *climb* (step-up). Anything else ends the floor.`,
    `- **Gaps.** Where the floor ends, the edge is bisected to ±1 cm and the walker looks ahead (up to ${T.scan} m) for a landing between ${T.contDown} m below and ${T.climbMax} m above the take-off, first inside its corridor, then up to ${T.wide} m either side. Each column on the way records what a fall there ends in: ground, pit, lethal water, lethal mesh, out-of-bounds mesh, or void (nothing above \`killY\`). ` +
      `Classification: a landing within ${T.jumpScan} m makes a **gap** (*level*, or *offset* when beside the corridor); safe ground directly under the edge with no near landing is a **drop** (step down, not a gap); if the floor simply continues beside the corridor within 1 m it is a lateral **shift**, not a gap; otherwise the first safe floor below (*lower*), a farther level landing (*level-long*), or any surface (*void*) ends the gap. ` +
      `A gap that rises into something taller than ${T.climbMax} m with no open space beneath is a **wall**. With no surface for ${T.scan} m the stretch is a **void** (rides, rail sections, vehicles; aids are listed). Breaks narrower than ${T.minGap} m are seams. ` +
      'A gap is *lethal* when at least half of its sampled columns end in a lethal outcome; *safe* gaps record the depth of the floor below. *Width* is measured along the route line; *jump* is the edge-to-edge horizontal distance on the walked line (they differ for offset landings and curved lanes) and is what the reach check uses.',
    `- **Crossing reach.** The reach thresholds are the measured flat ranges (take-off to touchdown on flat ground) from real-input Player runs in [\`data/skate-crate-probe.json\`](data/skate-crate-probe.json), scenario \`range\`: foot jump at ${M.measured.foot.takeoffSpeed} m/s ${M.flatRange.foot} m (apex ${M.apex.foot} m); full jump + double jump at the apex ${M.flatRange.double} m (apex ${M.apex.double} m); ` +
      `full charged ollie from 12 m/s cruise ${M.flatRange.ollie12} m (charging accelerates the board to ${M.measured.ollie12.takeoffSpeed} m/s at take-off); full ollie at 23 m/s ${M.flatRange.ollie23} m (apex ${M.apex.ollie23} m)${M.reference.length ? `; for reference ${M.reference.map(r => `${r.lane} ${r.distance} m`).join(', ')}` : ''}. ` +
      `Only the height difference is modelled: a two-gravity arc through the measured apex with \`src/tuning.ts\` gravities (foot rise ${M.gravity.footRise}, fall ${M.gravity.footFall}; board rise ${M.gravity.boardRise}, fall ${M.gravity.boardFall} m/s²) gives the airtime ratio t(dh) / t(0), which scales the measured flat range; a landing above the apex is out of reach. ` +
      `For example a landing 1 m lower stretches the foot jump to ${M.examples.foot['dh -1']} m and the 23 m/s ollie to ${M.examples.ollie23['dh -1']} m; 1 m higher shortens them to ${M.examples.foot['dh +1']} m and ${M.examples.ollie23['dh +1']} m. ` +
      'Ledge grabs, kicker and slope launches, trampolines, crate and enemy bounces and speed lost before take-off are not included, so "beyond the measured reach" often means "needs a launch or a ride", which the aid list records.',
    '- **Aids** listed per gap or void: a mover travel envelope, deployed spin-bridge deck, grind rail / sagging rope / moving rail running across it (within the corridor, at −2…+4 m of take-off height), a rope swing within reach, a trampoline within 8 m before take-off, a speed pad within 40 m before it, a *kicker* (take-off from a ramp component, a ramp- or kicker-named surface up to 60 m long or a vert ramp up to 40 m long, or a floor rising ≥ 0.5 m over the last 3 m), solid / steel / arrow / explosive / outline crates or an enemy patrol inside the gap, or an inactive outline surface. ' +
      '*Side* gives the lateral distance to ground at take-off height beside the gap at its 25/50/75 % points (≤ 6 m counts as avoidable).',
    `- **Platforms.** Every walker sample records the surface stood on, typed from its component (\`platform\`, \`mesh\`, \`terrain\`, \`woodpath\`, \`ramp\`, \`vertramp\`, \`crumble\`, \`phasepad\`, \`trampoline\`, \`decor\` …) or, for the native builders, from its runtime tags and name. Footprints come from the component size where authored, otherwise the world bounding box. Every ${T.widthEvery} m the supported width across travel is probed outward to 6 m each side; *narrow* is < ${T.narrow} m, *very narrow* < ${T.veryNarrow} m. *Landing depth* runs from a landing edge to the next break of any kind (gap, drop, wall, void, or step-up ≥ ${T.contUp} m).`,
    `- **Hazards and timed platforms.** From the runtime arrays: crushers, pendulums (swing envelope), rolling boulders (patrol lane; chase boulders separately), fire tikis (breath sector, firing 23% of each cycle), grindosauri, angry balls, minefields, movers, phase pads, crumbles, rope swings, spin bridges, snapping ropes, moving rails, thorn clusters and tumble zones. ` +
      `*Placement* compares the swept area with the walked line: within ${T.onPath} m (or straddling it within ${T.flank} m) is *across*, within ${T.flank} m *flank*, beyond — or more than 5 m behind the spawn or past the gate — *off*. *Orientation* compares swing, roll, travel or patrol direction with the route direction (along > 30° … across < 60° off perpendicular). ` +
      `Relations: *at a gap* means within ${T.edgeGuard} m before a take-off edge, after a landing edge, or over the gap; *near crates* means a solid crate within ${T.near} m (box to box); checkpoint distances are along the route.`,
    `- **Enemies.** Patrol segments from \`Level.enemies\` (sentries and spinners are stationary). *On route* means the patrol comes within ${T.enemyOnPath} m of the walked line, *flank* within ${T.flank} m (patrols more than 5 m behind the spawn or past the gate are off-route). *Edge* means a pit, lethal water, void or a fall of more than 3 m within 2 m of the patrol line. ` +
      `A kind's *first appearance* in a course is its on-route enemy with the lowest progress; it is *alone* with no other enemy within ${T.alone} m along the route, no danger hazard within 8 m and no gap edge within ${T.edgeGuard} m, and on *safe ground* when supported, not at a lethal edge and not over a gap. Variants are the runtime appearance (tribal, nightworks) and ghost skins.`,
    `- **Rhythm.** A *beat* is a gap (G, at its take-off), an enemy (E), a hazard or timed platform (H), a crate cluster with any non-steel crate (C, clusters linked within 1.2 crate widths as in the crate audit), a rail, rope or moving rail (R, at its first point near the route) or a ramp, kicker, short vert ramp, trampoline or speed pad (K), within ${T.beatCorridor} m of the route. Beats of the same kind closer than ${T.beatMerge} m merge. *Quiet* is the longest distance between consecutive beats (route start and gate included).`,
    '- **Route quality.** *low* when ≥ 15% of the walk is on solid decor scenery, there are ≥ 5 walls, or ≥ 10% of the measured route is void with no detected aid; *medium* with any unexplained void, ≥ 15 lateral shifts or ≥ 5% decor; otherwise *high*. Read gap and coverage numbers of *low* courses with care.', '');

  lines.push('## Per-level tables', '', '### Route, gaps and reach', '',
    mdTable(['Level', 'Course', 'Measured m', 'Ground / gap / void %', 'Gaps (lethal)', 'Gaps / 100 m', 'Width median / p90 / max m', '> foot / > double / > board cruise / > board 23', 'Beyond reach (with aid)', 'Bottoms of lethal gaps', 'Longest gapless m', 'Drops / climbs / walls', 'Void stretches (with aid)'],
      levels.map(l => { const s = l.summary;
        return [`\`${l.id}\``, l.title, `${s.measuredLen}${s.transit ? ` (+${s.transit} transit)` : ''}`, `${Math.round(100 * s.coverage.ground)} / ${Math.round(100 * s.coverage.gaps)} / ${Math.round(100 * s.coverage.void)}`,
          `${s.gaps} (${s.lethalGaps})`, s.per100m, `${s.width.median ?? '—'} / ${s.width.p90 ?? '—'} / ${s.width.max || '—'}`, `${s.exceed.foot} / ${s.exceed.double} / ${s.exceed.ollie12} / ${s.exceed.ollie23}`, `${s.aidOnly} (${s.aidOnlyWithAid})`,
          topOf(s.lethalKinds, 3), s.gapless.len, `${s.drops} / ${s.climbs} / ${s.walls}`, `${s.voids} (${s.voidAid})`]; })), '',
    '### Platforms and landings', '',
    mdTable(['Level', 'Walked surfaces (share)', 'Distinct surfaces', 'Width median m', 'Narrow < 2 m / < 1.2 m', 'Longest narrow run m', 'Landing depth median m', 'Landing width median m', 'Short landings (< 2 m)', 'Landing surfaces', 'Gap aids', 'Dynamic platforms'],
      levels.map(l => { const s = l.summary, d = s.dynamic;
        const dyn = Object.entries({ movers: d.movers, crumbles: d.crumbles, 'phase pads': d.phasepads, 'spin bridges': d.spinbridges, swings: d.ropeswings, 'moving rails': d.movingrails, 'snap ropes': d.snapropes, trampolines: d.trampolines }).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(', ');
        return [`\`${l.id}\``, topOf(s.surfaceShare, 3, v => `${Math.round(100 * v)}%`), s.distinctSurfaces, s.widthMedian, `${Math.round(100 * s.narrowShare)}% / ${Math.round(100 * s.veryNarrowShare)}%`, s.longestNarrow?.len ?? 0,
          s.landDepthMedian, s.landWidthMedian, s.shortLandings, topOf(s.landTypes, 3), topOf(s.aids, 4), dyn || '—']; })), '',
    '### Hazards and timings', '',
    mdTable(['Level', 'Danger hazards on route', 'Timed platforms on route', 'Placement across / flank / off', 'Timing ranges (s)', 'Danger at gaps', 'Near crates', '≤ 10 m after a checkpoint', 'Pits / lethal-water meshes'],
      levels.map(l => { const s = l.summary, on = l.hazards.filter(h => h.pl !== 'off');
        const danger = tally(on.filter(h => DANGER.has(h.k)), h => h.k), timed = tally(on.filter(h => !DANGER.has(h.k)), h => h.k);
        return [`\`${l.id}\``, topOf(danger, 6), topOf(timed, 6), `${s.placement.across ?? 0} / ${s.placement.flank ?? 0} / ${s.placement.off ?? 0}`,
          Object.entries(s.timing).map(([k, v]) => `${k.replace(':', ' ')} ${v[0] === v[1] ? v[0] : `${v[0]}–${v[1]}`}`).join('; ') || '—',
          on.filter(h => DANGER.has(h.k) && h.gap).length, s.hazardsNearCrates, s.hazardsAfterCheckpoint, `${s.pits} / ${s.lethalWaterMeshes}`]; })), '',
    '### Enemies', '',
    mdTable(['Level', 'Enemies (on route)', 'Per 100 m', 'Kinds', 'Variants', 'Patrol median m', 'Patrol axis vs route', 'At gap edges', 'Near crates', 'Beside danger hazard', 'At a lethal edge', 'First appearances alone & safe'],
      levels.map(l => { const s = l.summary;
        return [`\`${l.id}\``, `${s.enemies} (${s.enemiesOnRoute})`, s.enemiesPer100m, topOf(s.enemyKinds, 9), topOf(s.enemyVariants, 3), s.patrolMedian, topOf(s.enemyAxis, 4), topOf(s.enemiesAtGaps, 3), s.enemiesNearCrates, s.enemiesWithDanger, s.enemiesOnEdge,
          s.firstKinds ? `${s.firstAloneSafe} / ${s.firstKinds}` : '—']; })), '',
    '### Rhythm', '',
    mdTable(['Level', 'Beats / 100 m', 'G / E / H / C / R / K per 100 m', 'Longest quiet m (where)', 'Sections', 'Sections without gap / enemy', 'Median section quiet m'],
      levels.map(l => { const s = l.summary, b = s.beatsPer100mByKind;
        return [`\`${l.id}\``, s.beatsPer100m, ['G', 'E', 'H', 'C', 'R', 'K'].map(k => b[k]).join(' / '), `${s.quiet.len} (${s.quiet.from}–${s.quiet.to})`, l.sections.length,
          `${l.sections.filter(x => !x.gaps).length} / ${l.sections.filter(x => !x.enemies).length}`, r1(median(l.sections.map(x => x.quiet)))]; })), '',
    '<details><summary>Section-by-section beat sequences (start → gate; G gap, E enemy, H hazard or timed platform, C crate cluster, R rail, K ramp / launcher)</summary>', '',
    ...levels.map(l => `- \`${l.id}\`: ${l.sections.map(s => `[${s.i}] ${s.beats || '·'}`).join(' ')}`), '', '</details>', '');

  const row = (label, f) => [label, f(A), f(P)];
  const histText = m => Object.entries(m).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
  lines.push('## Aggregate statistics', '', '### Gaps and reach', '', mdTable(['Measure', `Campaign (${A.levels} courses)`, `Puzzle trilogy (${P.levels})`], [
    row('Measured length km (route line km)', a => `${a.measuredKm} (${a.routeKm})`),
    row('Static ground / gap / void share of the walk', a => `${Math.round(100 * a.coverage.ground)}% / ${Math.round(100 * a.coverage.gaps)}% / ${Math.round(100 * a.coverage.void)}%`),
    row('Gaps (lethal / safe)', a => `${a.gaps} (${a.lethal} / ${a.safe})`),
    row('Gaps per 100 m: overall; per-course median (range)', a => `${a.per100m}; ${a.per100mLevels.median} (${a.per100mLevels.min}–${a.per100mLevels.max})`),
    row('Lethal gaps per 100 m', a => a.lethalPer100m),
    row('Width m: median, quartiles, p90, max', a => `${a.width.median}, ${a.width.p25}–${a.width.p75}, ${a.width.p90}, ${a.width.max}`),
    row('Width histogram (m)', a => histText(a.widthHist)),
    row('Width histogram, lethal gaps only (m)', a => histText(a.widthHistLethal)),
    row('Landing height dh histogram (m)', a => histText(a.dhHist)),
    row('Landing higher / lower than take-off (> 0.5 m)', a => `${a.up} / ${a.down}`),
    row('Exceed foot jump / double jump / board from cruise / board at 23 m/s', a => `${frac(a.exceed.foot, a.gaps)} / ${frac(a.exceed.double, a.gaps)} / ${frac(a.exceed.ollie12, a.gaps)} / ${frac(a.exceed.ollie23, a.gaps)}`),
    row('Easiest crossing (foot → double → board from cruise → board at 23 m/s → none)', a => topOf(a.ladder, 5)),
    row('Beyond measured reach: with a ride or grind aid / with a launch lip', a => `${a.aidOnly}: ${a.aidOnlyWithAid} / ${a.aidOnlyLaunch}`),
    row('Aids across gaps', a => topOf(a.aids, 10)),
    row('Gap bottoms (lethal kinds)', a => `${topOf(a.bottoms, 3)} (${topOf(a.lethalKinds, 5)})`),
    row('Safe gaps: median floor depth m', a => a.safeDepth.median),
    row('Landing found as', a => topOf(a.hows, 7)),
    row('Landing depth histogram (m)', a => histText(a.landDepthHist)),
    row('Landing width histogram (m)', a => histText(a.landWidthHist)),
    row('Landing surfaces', a => topOf(a.landTypes, 6)),
    row('Avoidable gaps (ground beside, ≤ 6 m)', a => a.avoidable),
    row('Longest gapless stretch per course: median / max m', a => `${a.gapless.median} / ${a.gapless.max}`),
    row('Drops / climbs (above jump apex) / walls', a => `${a.drops} / ${a.climbs} (${a.climbsOverJump}) / ${a.walls}`),
    row('Void stretches (with aid) / lateral shifts / transits', a => `${a.voids} (${a.voidAid}) / ${a.shifts} / ${a.transits}`),
  ]), '', '### Platforms, hazards and enemies', '', mdTable(['Measure', `Campaign (${A.levels} courses)`, `Puzzle trilogy (${P.levels})`], [
    row('Walked surface types (share of standable walk)', a => topOf(a.surfaceShare, 8, v => `${Math.round(100 * v)}%`)),
    row('Shapes of the most-walked surfaces (top 12 per course)', a => topOf(a.walkedShapes, 7)),
    row('Narrow (< 2 m) / very narrow (< 1.2 m) share of the walk', a => `${Math.round(100 * a.narrowShare)}% / ${Math.round(100 * a.veryNarrowShare)}%`),
    row('Dynamic platforms', a => topOf(a.dynamic, 9)),
    row('Hazard objects by kind', a => topOf(a.hazards, 17)),
    row('Placement across / flank / off', a => `${a.placement.across ?? 0} / ${a.placement.flank ?? 0} / ${a.placement.off ?? 0}`),
    row('Danger hazards on route (per 100 m); courses with any', a => `${a.dangerOnRoute} (${a.dangerPer100m}); ${a.levelsWithDanger}`),
    row('Danger hazards at gap edges / near crates / ≤ 10 m after a checkpoint / beside an enemy', a => `${topOf(a.dangerAtGaps, 3)} / ${a.dangerNearCrates} / ${a.dangerAfterCheckpoint} / ${a.dangerWithEnemy}`),
    row('Timed platforms on route; at gaps', a => `${a.timedOnRoute}; ${a.timedAtGaps}`),
    row('Orientation vs route (on route)', a => topOf(a.orientation, 8)),
    ...Object.keys({ ...A.timing, ...P.timing }).map(k => row(`Timing: ${k} (s or m)`, a => rng(a.timing[k]))),
    row('Enemies (on route); per 100 m', a => `${a.enemies} (${a.enemiesOnRoute}); ${a.enemiesPer100m}`),
    row('Enemy kinds', a => topOf(a.enemyKinds, 9)),
    row('Variants', a => topOf(a.variants, 5)),
    row('Courses without an enemy on the route', a => a.levelsWithoutEnemies.length),
    row('Patrol median m (by kind)', a => `${a.patrolMedian} (${Object.entries(a.patrolByKind).map(([k, v]) => `${k} ${v}`).join(', ')})`),
    row('Placement on / flank / off route', a => `${a.enemyPlacement['on-route'] ?? 0} / ${a.enemyPlacement.flank ?? 0} / ${a.enemyPlacement['off-route'] ?? 0}`),
    row('Patrol axis vs route', a => topOf(a.enemyAxis, 4)),
    row('At gap edges; near crates; beside a danger hazard; at a lethal edge; grouped', a => `${topOf(a.enemiesAtGaps, 3)}; ${a.enemiesNearCrates}; ${a.enemiesWithDanger}; ${a.enemiesOnEdge}; ${a.enemiesGrouped}`),
    row('First appearances: alone / safe / both (of)', a => `${a.firstAlone} / ${a.firstSafe} / ${a.firstAloneSafe} (${a.firsts})`),
    row('What spoils a first appearance', a => topOf(a.firstBlockers, 4)),
  ]), '', '### Rhythm', '', mdTable(['Measure', `Campaign (${A.levels} courses)`, `Puzzle trilogy (${P.levels})`], [
    row('Beats per 100 m: overall; per-course median (range)', a => `${a.beatsPer100m}; ${a.beatsPer100mLevels.median} (${a.beatsPer100mLevels.min}–${a.beatsPer100mLevels.max})`),
    row('Beats per 100 m by kind', a => Object.entries(a.beatsPer100mByKind).map(([k, v]) => `${k} ${v}`).join(', ')),
    row('Beat mix (count)', a => topOf(a.beatMix, 6)),
    row('Longest quiet stretch per course: median / max m', a => `${a.quiet.median} / ${a.quiet.max}`),
    row('Sections; without a gap; without an enemy; without gap, enemy or danger hazard', a => `${a.sections}; ${a.sectionsNoGap}; ${a.sectionsNoEnemy}; ${a.sectionsNoThreat}`),
    row('Section medians: beats per 100 m; longest quiet m', a => `${a.sectionBeatsPer100m}; ${a.sectionQuietMedian}`),
  ]), '');

  lines.push('## Notable examples', '', 'Selected by fixed rules (the most extreme instance of each pattern; rules marked by course quality skip *low*-quality routes). Positions are world metres; "along the route" is progress from the spawn.', '');
  notableExamples(levels, C).forEach((x, i) => lines.push(`${i + 1}. **${x.title}** · \`${x.level}\` (${x.course}${x.quality && x.quality !== 'high' ? `, ${x.quality}-quality route` : ''}), ${x.where}. ${x.text}`));
  lines.push('');

  // Neutral, data-driven pattern summary.
  const share = (a, b) => b ? Math.round(100 * a / b) : 0;
  const byGap = [...camp].sort((a, b) => b.summary.per100m - a.summary.per100m);
  const rideLevels = camp.filter(l => l.summary.coverage.ground < .6);
  const kindsOn = A.enemyKindsOnRoute, totalOn = A.enemiesOnRoute;
  const dangerLv = camp.filter(l => l.hazards.some(h => DANGER.has(h.k) && h.pl !== 'off')).sort((a, b) => b.hazards.filter(h => DANGER.has(h.k)).length - a.hazards.filter(h => DANGER.has(h.k)).length);
  const top4 = byGap.slice(0, 4), top4Gaps = sum(top4.map(l => l.summary.gaps)), top4Len = sum(top4.map(l => l.summary.measuredLen)), campLen = sum(camp.map(l => l.summary.measuredLen));
  const beatOrder = Object.entries(A.beatsPer100mByKind).sort((a, b) => b[1] - a[1]);
  lines.push('## Patterns (summary)', '',
    `- **Gap density.** The four gap-densest courses (${top4.map(l => `\`${l.id}\` ${l.summary.per100m}`).join(', ')} per 100 m) hold ${share(top4Gaps, A.gaps)}% of the campaign's gaps on ${share(top4Len, campLen)}% of its measured length; ${camp.filter(l => l.summary.per100m < .25).length} courses have fewer than 0.25 gaps per 100 m. ` +
      `${share(A.lethal, A.gaps)}% of gaps are lethal, ending mostly in ${topOf(A.lethalKinds, 3)}; safe gaps sit over floors a median ${A.safeDepth.median} m down.`,
    `- **Gap widths and reach.** Half of all campaign gaps are narrower than ${A.width.median} m and a quarter are ${A.width.p75} m or wider; ${A.exceed.ollie23} are out of reach of the measured 23 m/s ollie (${M.flatRange.ollie23} m on the flat). ` +
      `By easiest crossing: ${Object.entries(A.ladder).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${share(v, A.gaps)}%`).join(', ')}. Crossings beyond the measured reach mostly have a ride or grind aid (${topOf(Object.fromEntries(Object.entries(A.aids).filter(([k]) => !['kicker', 'speedpad'].includes(k))), 4)} across all gaps).`,
    `- **Static ground and rides.** ${rideLevels.length ? `${rideLevels.length} course(s) have less than 60% static standable ground along the measured route (${rideLevels.map(l => `\`${l.id}\` ${Math.round(100 * l.summary.coverage.ground)}%`).join(', ')}); there movers, trampolines, rails and swings carry long stretches.` : 'Every course has at least 60% static standable ground along the measured route.'} ` +
      `The median course's longest gapless stretch is ${A.gapless.median} m.`,
    `- **Landings and surfaces.** The median landing pad runs ${A.landDepthMedian} m along travel and ${A.landWidthMedian} m across; ${A.landDepthHist['0–2']} landings are shorter than 2 m. ${Math.round(100 * A.narrowShare)}% of the sampled walk is narrower than 2 m. ` +
      `Walked surfaces by length: ${topOf(A.surfaceShare, 4, v => `${Math.round(100 * v)}%`)}.`,
    `- **Hazards.** ${A.dangerOnRoute} danger hazards lie on or beside the route, ${share(sum(dangerLv.slice(0, 3).map(l => l.hazards.filter(h => DANGER.has(h.k) && h.pl !== 'off').length)), A.dangerOnRoute)}% of them in ${dangerLv.slice(0, 3).map(l => `\`${l.id}\``).join(', ')}; ` +
      `${camp.length - A.levelsWithDanger} courses have none. Timed platforms outnumber them (${A.timedOnRoute} on the route), ${A.timedAtGaps} of them at gap edges or spans. ` +
      `Crusher cycles run ${rng(A.timing['crusher.cycle'])} s, pendulum periods ${rng(A.timing['pendulum.period'])} s, mover periods ${rng(A.timing['mover.period'])} s.`,
    `- **Enemies.** ${A.levelsWithoutEnemies.length} of ${A.levels} courses have no enemy on the route; ${topOf(A.enemyKindsOnRoute, 3)} make up ${share(sum(Object.entries(kindsOn).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([, v]) => v)), totalOn)}% of on-route enemies. ` +
      `Median patrol ${A.patrolMedian} m, mostly ${topOf(A.enemyAxis, 1).split(' ')[0]} the route. ${share(A.enemiesOnEdge, totalOn)}% of on-route enemies stand within 2 m of a lethal drop, ${share(sum(Object.values(A.enemiesAtGaps)), totalOn)}% at a gap edge and ${share(A.enemiesWithDanger, totalOn)}% beside a danger hazard. ` +
      `${A.firstAloneSafe} of ${A.firsts} first appearances are alone on safe ground; the others fail on ${topOf(A.firstBlockers, 3)} (a first appearance can fail on several).`,
    `- **Rhythm.** Per 100 m the campaign averages ${beatOrder.map(([k, v]) => `${v} ${BEAT_NAMES[k]}`).join(', ')}. ` +
      `${A.sectionsNoGap} of ${A.sections} checkpoint sections contain no gap, ${A.sectionsNoEnemy} no enemy and ${A.sectionsNoThreat} neither gap, enemy nor danger hazard. The median course has a ${A.quiet.median} m stretch with no beat.`,
    `- **Puzzle contrast.** The puzzle levels run ${P.per100m} gaps, ${P.enemiesPer100m} enemies and ${P.beatsPer100m} beats per 100 m against ${A.per100m}, ${A.enemiesPer100m} and ${A.beatsPer100m}; their gaps have a median width of ${P.width.median} m and are bridged by ${topOf(P.aids, 3)}.`, '');

  lines.push('## Limitations', '',
    '- The route line is the camera lane (or a checkpoint chain), not a recorded player path. The walker follows the ground within ±12 m of it, so gaps are measured where that line crosses them: widths are along the line (edge-to-edge *jump* distances are also given), a lane drawn beside the path produces lateral shifts, and a route that splits is followed along one branch only (for example a lower ledge path rather than a rope or rail above it; drops record a grind line continuing overhead). Check the route-quality column before quoting a course.',
    '- Reach thresholds are measured flat ranges; only height differences are modelled (two-gravity arc ratio). Run-up length, ledge grabs, kicker and slope launches, trampolines, crate or enemy bounces and board double jumps are not included; "beyond the measured reach" therefore often means "needs a launch or a ride", which the aid list records.',
    '- Everything is measured in the build-time state. Switch-activated outline crates and surfaces, deployed spin bridges and moving platforms are not walked; gaps they bridge appear as gaps or voids with the aid listed. Crumbling and phase pads count as solid.',
    '- Standability uses face normals (≈ 63° limit) and ignores ceilings, so a corridor column inside a closed building or under an overhang can see the floor beneath it; vert transitions, loops and tubes are walked only where they are flat enough.',
    '- Hazard sweeps are approximate envelopes (pendulum arc endpoints, fire-tiki breath sector at 65% of its turn, mover bounding boxes); enemy "edge" checks sample 16 points around each metre of patrol; danger/timing categories are by kind, not by measured lethality.',
    '- Bonus rooms, races, competitions and free-skate parks are outside the scope (see Skipped). Add any level id with `--levels id1,id2`.', '');
  return lines.join('\n');
}

/** JSON with short arrays/objects (records) kept on one line each. */
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
for (const r of results) if (!r.error) r.quality = quality(r);
const output = RENDER_ONLY ? JSON.parse(await readFile(OUT_JSON, 'utf8')) : {
  generatedBy: 'node tools/level-geometry-report.mjs', commit, levelSources: STOCK ? 'stock source only' : 'public/levels.json restored first (fresh-browser state)',
  constants, scope: { included: results.map(r => ({ id: r.id, title: r.title, group: r.group, island: r.island, islandName: r.islandName ?? null, source: r.source })), skipped },
  legend: {
    gap: 'i index, s0/s1 take-off / landing progress m, w width along route m, j edge-to-edge jump m, dh landing minus take-off height m, y0 take-off floor y, p0/p1 edge points, bot safe|lethal|mixed, lk dominant lethal outcome, dep safe floor depth m, ls lethal share (mixed), how landing class, take/land surface types, ldims landing footprint [short, long] m, tnm/lnm take-off / landing surface names, ld landing depth m, lw landing width m, ru run-up m, x modes that cross (measured flat range, height-adjusted): foot, double, ollie12 = charged ollie from 12 m/s cruise, ollie23 = full ollie at 23 m/s, aids, side lateral distance to ground beside the gap m, sec section',
    event: 't drop|climb|wall|void|shift, s progress m, h height m, w width m, to end progress (void), aids, transit (portal link), offLane ground beside the lane (m)',
    hazard: 'k kind, cid editor component index (data-built levels), p position, s progress m, lat lateral offset from walked line m, pl across|flank|off, or orientation vs route, tm timing, sz size m, gap [relation, distance m, gap index], cr crates within 4 m, en enemies within 4 m, cp [m since previous checkpoint, m to next], sec section, bob pendulum bob clearance above floor m, drop crusher drop m',
    enemy: 'k kind, cid editor component index, v variant, p home position, s progress m, lat lateral offset m, pl on-route|flank|off-route, ax patrol axis vs route, ext patrol length m, spd speed m/s, gap [relation, distance m, gap index], cr crates within 4 m, crd nearest crate m, hz hazard kinds within 4 m, grp other enemies within 6 m, edge lethal drop within 2 m, cp checkpoint distances, sec section',
    section: 'beats: G gap, E enemy, H hazard or timed platform, C crate cluster, R rail, K ramp / launcher; quiet longest distance between beats m',
  },
  aggregate: { campaign: aggregate(results.filter(r => r.group === 'campaign')), puzzle: aggregate(results.filter(r => r.group === 'puzzle')),
    ...(results.some(r => r.group === 'extra') ? { extra: aggregate(results.filter(r => r.group === 'extra')) } : {}) },
  levels: results,
};
await mkdir(path.dirname(OUT_JSON), { recursive: true });
if (!RENDER_ONLY) await writeFile(OUT_JSON, compactJson(output) + '\n');
await mkdir(path.dirname(OUT_MD), { recursive: true });
await writeFile(OUT_MD, renderReport(output));
log(`wrote ${RENDER_ONLY ? '' : `${path.relative(ROOT, OUT_JSON)} and `}${path.relative(ROOT, OUT_MD)} (${output.levels.length} levels)`);
