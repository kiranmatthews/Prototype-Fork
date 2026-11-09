// Crate placement audit for the campaign courses, the Codex lab and the puzzle trilogy.
//
//   node tools/crate-placement-report.mjs                 writes docs/crate-bible/data/current-game-crates.json
//                                                         and docs/crate-bible/CURRENT_GAME_AUDIT.md
//   node tools/crate-placement-report.mjs --levels jungle,codex-lab   only these level ids
//   node tools/crate-placement-report.mjs --stock         ignore public/levels.json overrides
//   node tools/crate-placement-report.mjs --json a.json --md a.md     other output paths
//   node tools/crate-placement-report.mjs --render-only   rewrite the report from the existing JSON
//
// Every level is built through the real Level class inside the headless
// withSkateRuntime harness (the tools/audit-crate-layout.mjs pattern). A fresh
// browser adopts public/levels.json on first run, so the published pack is
// restored first and whatever findLevel() then returns is what gets measured.
// Nothing here asserts: oddities are recorded, and a level that fails to build
// is reported with its error while the others continue.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const option = name => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT_JSON = path.resolve(ROOT, option('--json') ?? 'docs/crate-bible/data/current-game-crates.json');
const OUT_MD = path.resolve(ROOT, option('--md') ?? 'docs/crate-bible/CURRENT_GAME_AUDIT.md');
const ONLY = option('--levels')?.split(',').filter(Boolean);
const STOCK = argv.includes('--stock');
const RENDER_ONLY = argv.includes('--render-only');
const log = (...a) => process.stdout.write(a.join(' ') + '\n');

// Thresholds. Distances in metres; crate widths are CRATE_SIZE (1.152 m).
const T = {
  link: 1.2,         // cluster link: centres within 1.2 crate widths on every axis (touching, stacked, diagonal)
  reach: 3.0,        // "above normal jump reach": crate base more than this over the ground under it
  dropHeight: 1.5,   // a drop: ground this far below the crate's floor, a pit, lethal water or nothing
  nearDrop: 1.5,     // drop edge within this distance of a crate face
  onPath: 3,         // |lateral offset| from the route line: on-path <= 3, off-line <= 8, detour > 8
  detour: 8,
  near: 4,           // enemy patrol / hazard body within this distance
  downhill: 0.1,     // route grade (fall per metre over +-10 m) counted as a fast downhill
  padRunout: 40,     // metres after a speed pad still counted as a speed section
  floatLink: 4,      // floating crates within this distance chain into a floating group
  groupLink: 4,      // clusters whose crates come within this distance form a loose group
};
const KINDS = ['wood', 'empty', 'mystery', 'life', 'mask', 'multihit', 'bouncy', 'metalbounce', 'metal', 'tnt', 'nitro', 'bang', 'nitrobang'];
const REWARD = new Set(['wood', 'empty', 'mystery', 'life', 'mask', 'multihit']);
const EXPLOSIVE = new Set(['tnt', 'nitro']);
const ARROW = new Set(['bouncy', 'metalbounce']);
const UNCOUNTED = new Set(['bang', 'nitrobang', 'metalbounce', 'metal']); // Level.totalCrates rule
const TARGET = new Set([...REWARD, 'bouncy', 'metalbounce', 'bang', 'nitrobang']); // crates a player sets out to reach
// Composition keys used by the Crash maps in docs/crate-bible/data (multihit ~ striped bounce crate).
const CRASH_KEY = { wood: 'wood', empty: 'wood', mystery: 'question', multihit: 'multiHit', bouncy: 'arrowWood',
  metalbounce: 'arrowSteel', metal: 'steel', life: 'life', mask: 'aku', tnt: 'tnt', nitro: 'nitro',
  bang: 'switch', nitrobang: 'switchGreen', checkpoint: 'checkpoint' };
const kindOf = c => c.nitroBang ? 'nitrobang' : c.bang ? 'bang' : c.nitro ? 'nitro' : c.tnt ? 'tnt'
  : c.metalBounce ? 'metalbounce' : c.bouncy ? 'bouncy' : c.metal ? 'metal' : c.multiHit ? 'multihit'
  : c.life ? 'life' : c.mask ? 'mask' : c.mystery ? 'mystery' : c.empty ? 'empty' : 'wood';

const r2 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 100) / 100;
const r1 = v => v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
const sum = xs => xs.reduce((a, b) => a + b, 0);
const mean = xs => xs.length ? sum(xs) / xs.length : null;
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const tally = (xs, key = x => x) => { const m = {}; for (const x of xs) { const k = key(x); m[k] = (m[k] ?? 0) + 1; } return m; };
const pct = (a, b) => b ? `${(100 * a / b).toFixed(1)}%` : '—';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const boxGap = (a, b) => Math.hypot(Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x),
  Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y), Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z));
const segDist2D = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 > 1e-9 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
/** Share of variance on the first principal axis (1 = perfectly collinear). */
function linearity(points) {
  if (points.length < 3) return 1;
  const m = [0, 1, 2].map(k => mean(points.map(p => p[k])));
  const c = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i][j] += (p[i] - m[i]) * (p[j] - m[j]);
  let v = [1, 1, 1], lambda = 0;
  for (let it = 0; it < 60; it++) {
    const w = [0, 1, 2].map(i => c[i][0] * v[0] + c[i][1] * v[1] + c[i][2] * v[2]);
    lambda = Math.hypot(...w); if (lambda < 1e-12) return 1; v = w.map(x => x / lambda);
  }
  const trace = c[0][0] + c[1][1] + c[2][2];
  return trace > 1e-9 ? lambda / trace : 1;
}

/** Vertical ground probes against Level.groundMeshes, pre-filtered by an XZ grid of mesh bounds. */
class GroundIndex {
  constructor(THREE, meshes, cell = 16) {
    this.cell = cell; this.grid = new Map(); this.big = [];
    this.ray = new THREE.Raycaster(); this.ray.firstHitOnly = true;
    this.origin = new THREE.Vector3(); this.down = new THREE.Vector3(0, -1, 0);
    for (const mesh of meshes) {
      const g = mesh.geometry; if (!g) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox || g.boundingBox.isEmpty()) continue;
      const box = g.boundingBox.clone().applyMatrix4(mesh.matrixWorld), e = { mesh, box };
      const x0 = Math.floor(box.min.x / cell), x1 = Math.floor(box.max.x / cell);
      const z0 = Math.floor(box.min.z / cell), z1 = Math.floor(box.max.z / cell);
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { this.big.push(e); continue; }
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = `${x},${z}`; if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(e);
      }
    }
  }
  /** Highest surface hit by a ray cast down from (x, y, z), or null. */
  top(x, y, z, far = 400) {
    const list = (this.grid.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? []).concat(this.big);
    const meshes = [];
    for (const { mesh, box } of list) if (x >= box.min.x - 1e-3 && x <= box.max.x + 1e-3 && z >= box.min.z - 1e-3 &&
      z <= box.max.z + 1e-3 && box.min.y <= y && box.max.y >= y - far) meshes.push(mesh);
    if (!meshes.length) return null;
    this.origin.set(x, y, z); this.ray.set(this.origin, this.down); this.ray.near = 0; this.ray.far = far;
    const hits = this.ray.intersectObjects(meshes, false);
    return hits.length ? hits[0].point.y : null;
  }
}

/** Polyline with arc length; projection is full 3D like Level.laneDirAt. */
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
  const yAt = s => {
    s = clamp(s, 0, arc[arc.length - 1]);
    let i = 0; while (i < arc.length - 2 && arc[i + 1] < s) i++;
    const span = arc[i + 1] - arc[i];
    return points[i].y + (points[i + 1].y - points[i].y) * (span > 1e-9 ? (s - arc[i]) / span : 0);
  };
  return { points, arc, length: arc[arc.length - 1], project, yAt };
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

/** Builds the per-level record from a constructed Level. */
function measureLevel(THREE, level, target, ctx) {
  const { S, JUMP, TUNING, HEAD } = ctx, V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Reach budgets for a crate's BASE above a launch surface: every bounce refreshes the double
  // jump (Player.bounceRefresh) and the 0.92 m hitbox head-bumps a crate from below.
  const B = { doubleJump: JUMP.double + HEAD, bounce: JUMP.crateBounce + JUMP.doubleAdd + HEAD,
    arrowPlain: JUMP.arrow + HEAD, arrowPerfect: JUMP.arrowPerfect + HEAD, arrowMax: JUMP.arrowPerfect + JUMP.doubleAdd + HEAD };
  level.root.updateMatrixWorld(true);
  if (level.crateRailsDirty) level.rebuildCrateRails(); // what the first update() would derive
  const dataBuilt = !!target.entry.data, components = level.builtFromData?.components ?? [];
  const ground = new GroundIndex(THREE, level.groundMeshes);
  const ghostSurfaces = (level.outlinedSurfaces ?? []).filter(s => !s.active);
  const ghostGround = new GroundIndex(THREE, ghostSurfaces.map(s => s.mesh));
  const killY = level.killY;
  const { route, method, note, startS, endS, laneNodes } = chooseRoute(THREE, level);
  const dir = Math.sign(endS - startS) || 1, routeLen = Math.abs(endS - startS);
  const where = p => { const q = route.project(p); return { prog: (q.s - startS) * dir, lat: q.lat * dir, dy: p.y - q.y, fx: q.fx * dir, fz: q.fz * dir, off: q.dist }; };
  const gradeAt = prog => { const s = startS + prog * dir; return (route.yAt(s - 10 * dir) - route.yAt(s + 10 * dir)) / 20; };
  // A pit counts only when it is what you would land in: below y and not underneath other ground.
  const inPit = (x, z, y, groundY) => level.pitBoxes.some(b => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z &&
    b.max.y <= y + .3 && (groundY === null || b.max.y >= groundY - .3));
  const lethalWater = (x, z) => level.lethalWaterSurfaceAt?.(x, z) ?? null;

  // ---- crates (race item boxes are out of scope) and checkpoint crates ----
  const items = [];
  level.crates.forEach((c, i) => { if (!c.raceItem) items.push({ c, ref: `c${i}`, kind: kindOf(c), cp: false }); });
  level.checkpoints.forEach((c, i) => items.push({ c, ref: `cp${i}`, kind: 'checkpoint', cp: true }));
  const byCrate = new Map(items.map(it => [it.c, it]));
  for (const it of items) {
    const b = it.c.box, p = it.c.mesh.position;
    it.p = p.clone(); it.base = b.min.y; it.top = b.max.y;
    it.outline = !!it.c.pending; it.sys = !!it.c.systemicEndNitroBang; it.buried = !!it.c.concealed;
    const idx = it.c.mesh.userData.editorIdx;
    it.cid = dataBuilt && Number.isInteger(idx) ? idx : null;
    it.nm = it.cid !== null ? components[it.cid]?.nm ?? null : null;
    it.counted = !it.cp && !UNCOUNTED.has(it.kind);
    Object.assign(it, where(p));
  }
  // Crate-on-crate support via a coarse XZ hash.
  const hash = new Map(), hkey = (x, z) => `${Math.floor(x / 2)},${Math.floor(z / 2)}`;
  for (const it of items) { const k = hkey(it.p.x, it.p.z); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(it); }
  const near = (x, z, f) => { const gx = Math.floor(x / 2), gz = Math.floor(z / 2); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of hash.get(`${gx + a},${gz + b}`) ?? []) f(o); };
  // A spin bridge's deck (hinge p, local +X span before yaw) supports crates only once spun open.
  const onSpinBridge = it => level.spinBridges.some(b => {
    const c = b.component, [span, , width] = c.s ?? [5, .36, 1.2], yaw = (c.yaw ?? 0) * Math.PI / 180;
    const dx = it.p.x - c.p[0], dz = it.p.z - c.p[2], lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    return lx >= -.3 && lx <= span + .3 && Math.abs(lz) <= width / 2 + .3 && Math.abs(it.base - c.p[1]) <= .35;
  });
  const corners = [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => [a * (S / 2 - .1), b * (S / 2 - .1)]);
  for (const it of items) {
    const { x, z } = it.p;
    if (it.buried) { it.sup = 'buried'; continue; }
    let under = null;
    near(x, z, o => { if (o !== it && Math.abs(o.top - it.base) < .06 && Math.abs(o.p.x - x) < S * .7 && Math.abs(o.p.z - z) < S * .7) under = under && !under.outline ? under : o; });
    const feet = corners.map(([dx, dz]) => ground.top(x + dx, it.base + .05, z + dz, .25) !== null);
    // Footprint corners with ground within 0.6 m (slopes up to ~1:1 still count as footing).
    it.corners = corners.slice(1).filter(([dx, dz]) => ground.top(x + dx, it.base + .05, z + dz, .6) !== null).length;
    const ghost = !feet.some(Boolean) && corners.some(([dx, dz]) => ghostGround.top(x + dx, it.base + .05, z + dz, .25) !== null);
    it.sup = feet.some(Boolean) ? 'ground' : under ? (under.outline ? 'outline-crate' : 'crate') : ghost ? 'outline-surface'
      : onSpinBridge(it) ? 'spin-bridge' : 'none';
    it.under = under;
    const g = ground.top(x, it.base + .05, z, 400);
    const water = lethalWater(x, z);
    it.groundY = g !== null && g > killY ? g : null;
    it.pit = inPit(x, z, it.base, g);
    it.void = it.groundY === null || (water !== null && water > it.groundY && water < it.base) || (it.pit && it.sup === 'none');
    it.elev = it.groundY !== null ? it.base - it.groundY : null;
  }
  // Column floor for stacked crates: walk down the support chain.
  for (const it of items) {
    let b = it, guard = 0; while (b.under && guard++ < 64) b = b.under;
    it.colBase = b.base; it.colSup = b.sup;
  }
  // Drop edges (supported crates) and the highest standing surface within 3 m (reach).
  const dirs = Array.from({ length: 8 }, (_, k) => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)]);
  const ring = Array.from({ length: 12 }, (_, k) => [Math.cos(k * Math.PI / 6), Math.sin(k * Math.PI / 6)]);
  for (const it of items) {
    if (it.buried) continue;
    const { x, z } = it.p;
    if (['ground', 'outline-surface', 'spin-bridge'].includes(it.colSup)) {
      // A drop must persist outward along its direction, so a seam between two floor meshes is not an edge.
      const floor = it.colBase, steps = [.95, 1.5, 2.1];
      const isDrop = (sx, sz) => {
        const gy = ground.top(sx, floor + 3, sz, 60), wy = lethalWater(sx, sz);
        return gy === null || gy < floor - T.dropHeight || gy < killY || inPit(sx, sz, floor, gy) || (wy !== null && wy > gy && wy < floor);
      };
      let drop = null;
      for (const [cx, cz] of dirs) {
        const flags = steps.map(d => isDrop(x + cx * d, z + cz * d));
        const k = flags.findIndex((f, i) => f && (i === steps.length - 1 || flags[i + 1]));
        if (k >= 0 && (drop === null || steps[k] - S / 2 < drop)) drop = steps[k] - S / 2;
      }
      it.dropDist = drop;
    } else it.dropDist = null;
    let best = it.groundY !== null ? it.groundY : -Infinity;
    for (const rad of [1.2, 2, 3]) for (const [cx, cz] of ring) {
      const gy = ground.top(x + cx * rad, it.base + 3, z + cz * rad, 60);
      if (gy !== null && gy > killY && gy > best) best = gy;
    }
    it.reachGap = Number.isFinite(best) ? it.base - best : null;
    // Inactive outline surfaces become standing room once their switch fires.
    let ghostBest = -Infinity;
    if (ghostSurfaces.length) for (const rad of [0, 1.2, 2, 3]) for (const [cx, cz] of rad ? ring : [[0, 0]]) {
      const gy = ghostGround.top(x + cx * rad, it.base + 3, z + cz * rad, 60);
      if (gy !== null && gy > ghostBest) ghostBest = gy;
    }
    it.ghostGap = Number.isFinite(ghostBest) ? it.base - ghostBest : null;
  }

  // ---- actors ----
  const enemies = level.enemies.map(e => {
    const seg = e.axis === 'z' ? [e.cross, e.x0, e.cross, e.x1] : [e.x0, e.cross, e.x1, e.cross];
    return { kind: e.kind, seg, y: e.baseY ?? e.group.position.y };
  });
  const meshBox = mesh => { const g = mesh.geometry; if (!g.boundingBox) g.computeBoundingBox(); return g.boundingBox.clone().applyMatrix4(mesh.matrixWorld); };
  const hazards = [];
  for (const c of level.crushers) hazards.push({ kind: 'crusher', box: new THREE.Box3(V(c.x - c.w / 2, c.restY - c.h / 2, c.z - c.d / 2), V(c.x + c.w / 2, c.restY + c.raise + c.h / 2, c.z + c.d / 2)) });
  for (const p of level.pendulums) { const r = p.len * Math.sin(Math.min(Math.PI / 2, Math.abs(p.amp))); hazards.push({ kind: 'pendulum', box: p.box.clone().expandByVector(V(r, 0, r)) }); }
  for (const m of level.movers) {
    const b = meshBox(m.mesh), v = m.axisV.clone().multiplyScalar(m.amp);
    b.union(b.clone().translate(v)).union(b.clone().translate(v.clone().negate()));
    if (m.orbit) b.expandByScalar(Math.max(...m.orbit));
    hazards.push({ kind: 'mover', box: b });
  }
  for (const c of level.crumbles) hazards.push({ kind: 'crumble', box: meshBox(c.mesh) });
  for (const p of level.phasePads) hazards.push({ kind: 'phasepad', box: meshBox(p.mesh) });
  for (const s of level.stones) {
    const b = s.box.clone();
    if (s.axis === 'x' && s.x0 !== undefined) { b.min.x = Math.min(b.min.x, s.x0 - s.r); b.max.x = Math.max(b.max.x, s.x1 + s.r); }
    else if (s.z0 !== undefined) { b.min.z = Math.min(b.min.z, Math.min(s.z0, s.z1) - s.r); b.max.z = Math.max(b.max.z, Math.max(s.z0, s.z1) + s.r); }
    hazards.push({ kind: 'boulder', box: b });
  }
  for (const t of level.fireTikis) hazards.push({ kind: 'firetiki', box: new THREE.Box3().setFromCenterAndSize(t.group.position.clone().add(V(0, 1, 0)), V(1.6, 2, 1.6)) });
  for (const a of level.angryBalls) hazards.push({ kind: 'angryball', box: a.box.clone() });
  for (const g of level.grindosauri) hazards.push({ kind: 'grindosaurus', box: g.body.clone() });
  const pads = [], trampolines = [], vertBoxes = level.groundMeshes.filter(m => m.userData.vert).map(meshBox);
  level.root.traverse(o => {
    if (!o.isMesh) return;
    if (o.userData.speedPadSpeed !== undefined) pads.push({ p: o.getWorldPosition(V(0, 0, 0)) });
    if (o.userData.trampolineBounce !== undefined) trampolines.push({ box: meshBox(o) });
  });
  for (const pad of pads) Object.assign(pad, where(pad.p));
  const rails = level.rails.filter(r => r.grindable !== false && !level.isCrateRail?.(r));
  const fruit = level.pickups.map(p => p.mesh.position.clone());

  for (const it of items) {
    const { x, z } = it.p, cy = it.p.y;
    let ed = Infinity, ek = null;
    for (const e of enemies) {
      const h = segDist2D(x, z, ...e.seg);
      if (Math.abs(cy - (e.y + .7)) <= 3 && h < ed) { ed = h; ek = e.kind; }
    }
    it.enemyDist = Number.isFinite(ed) ? ed : null; it.enemyKind = ek;
    let hd = Infinity, hk = null;
    for (const h of hazards) { const d = boxGap(it.c.box, h.box); if (d < hd) { hd = d; hk = h.kind; } }
    it.hazardDist = Number.isFinite(hd) ? hd : null; it.hazardKind = hk;
    let rd = Infinity;
    for (const r of rails) if (r.distanceLowerBound(it.p) < rd) rd = Math.min(rd, r.closestDistance(it.p));
    it.railDist = Number.isFinite(rd) ? rd : null;
    it.grade = gradeAt(it.prog);
    it.afterPad = pads.some(pad => it.prog - pad.prog >= 0 && it.prog - pad.prog <= T.padRunout && Math.abs(it.lat - pad.lat) <= 8);
  }

  // ---- clusters (union-find): crates whose centres are within 1.2 widths on every axis ----
  const L = T.link * S, parent = items.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  items.forEach((it, i) => { it.n = i; });
  for (const a of items) near(a.p.x, a.p.z, b => {
    if (b.n <= a.n || b.buried || a.buried) return;
    if (Math.abs(a.p.x - b.p.x) <= L && Math.abs(a.p.y - b.p.y) <= L && Math.abs(a.p.z - b.p.z) <= L) parent[find(a.n)] = find(b.n);
  });
  for (const it of items) it.root = find(it.n);

  // ---- reach: what serves a crate whose base is more than T.reach over its ground ----
  const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const it of items) {
    if (it.cp || it.buried) { it.reach = it.cp ? 'checkpoint' : 'buried'; continue; }
    const elevation = it.elev ?? it.reachGap;
    it.high = elevation === null || elevation > T.reach;
    if (!it.high) { it.reach = it.sup === 'none' ? 'jump' : 'walk'; continue; }
    const { x, z } = it.p, tools = [];
    if ((it.sup === 'crate' || it.sup === 'outline-crate') && ['ground', 'outline-surface', 'spin-bridge'].includes(it.colSup)) tools.push('stack');
    for (const o of items) {
      if (o === it || o.cp || o.outline || o.top > it.base + .05 || horiz(o.p, it.p) > 2) continue;
      const h = it.base - o.top;
      if (ARROW.has(o.kind) && h <= B.arrowMax) tools.push(h <= B.arrowPlain ? 'arrow' : h <= B.arrowPerfect ? 'arrow-perfect' : 'arrow-perfect-double');
      else if (!ARROW.has(o.kind) && !EXPLOSIVE.has(o.kind) && h > .1 && h <= B.bounce) tools.push('crate-bounce');
    }
    const flat = b => Math.hypot(Math.max(0, b.min.x - x, x - b.max.x), Math.max(0, b.min.z - z, z - b.max.z));
    // Springs launch long transfers, so a trampoline counts within 15 m.
    if (trampolines.some(t => t.box.max.y < it.base && flat(t.box) <= 15)) tools.push('trampoline');

    if (enemies.some(e => segDist2D(x, z, ...e.seg) <= 2.5 && e.y + 1 + B.bounce >= it.base && e.y < it.base)) tools.push('enemy');
    if (it.reachGap !== null && it.reachGap <= T.reach) tools.push('ledge');
    if (rails.some(r => { const q = r.closest(it.p); return Math.hypot(q.point.x - x, q.point.z - z) <= 2.5 && q.point.y < it.base && q.point.y + T.reach >= it.base; })) tools.push('rail');
    if (hazards.some(h => h.kind === 'mover' && h.box.max.y < it.base && h.box.max.y + T.reach >= it.base && boxGap(it.c.box, h.box) <= 3)) tools.push('mover');
    if (vertBoxes.some(b => b.max.y < it.base && flat(b) <= 12)) tools.push('vert-air');
    if (Math.min(elevation ?? Infinity, it.reachGap ?? Infinity) <= B.doubleJump) tools.push('double-jump');
    if (it.ghostGap !== null && it.ghostGap <= T.reach && (it.reachGap === null || it.reachGap > T.reach)) tools.push('ledge-after-switch');
    it.tools = [...new Set(tools)];
    it.reach = it.tools[0] ?? null;
  }
  // Chained stomps spread outward from reachable crates: a crate (or arrow) within 6 m whose
  // bounce (+ double jump + head) carries to this base. Floating crates cannot vouch for each other.
  for (let changed = true; changed;) {
    changed = false;
    for (const it of items) {
      if (!it.high || it.reach) continue;
      if (it.under?.reach && it.under.reach !== 'none-found') { it.tools.push('stack'); it.reach = 'stack'; changed = true; continue; }
      const source = items.find(o => o !== it && !o.cp && !o.outline && o.reach && o.reach !== 'none-found' && !EXPLOSIVE.has(o.kind) &&
        horiz(o.p, it.p) <= 6 && o.top <= it.base + 6 && o.top >= it.base - (ARROW.has(o.kind) ? B.arrowMax : B.bounce));
      if (source) { it.tools.push('crate-chain'); it.reach = 'crate-chain'; changed = true; }
    }
  }
  for (const it of items) if (it.high && !it.reach) it.reach = 'none-found';

  // ---- cluster records ----
  const groups = new Map();
  for (const it of items) { const k = find(it.n); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); }
  const clusters = [...groups.values()].sort((a, b) => mean(a.map(m => m.prog)) - mean(b.map(m => m.prog))).map((members, id) => {
    for (const m of members) m.cl = id;
    const fx = mean(members.map(m => m.fx)), fz = mean(members.map(m => m.fz));
    const shape = classify(members, S, fx, fz);
    const kinds = tally(members, m => m.outline ? 'outline' : CRASH_KEY[m.kind]);
    const floating = !members.some(m => ['ground', 'outline-surface', 'spin-bridge', 'buried'].includes(m.sup));
    const lat = members.map(m => Math.abs(m.lat)), progs = members.map(m => m.prog);
    const hasExplosive = members.some(m => EXPLOSIVE.has(m.kind)), hasReward = members.some(m => REWARD.has(m.kind) || m.kind === 'bouncy');
    const tags = [];
    if (Math.min(...lat) <= T.onPath) tags.push('ON-PATH'); else if (Math.min(...lat) > T.detour) tags.push('DETOUR'); else tags.push('OFF-LINE');
    if (members.some(m => m.dropDist !== null && m.dropDist <= T.nearDrop) || members.some(m => m.void)) tags.push('EDGE-BAIT');
    if (members.some(m => m.high)) tags.push('HIGH');
    if (Math.max(...members.map(m => m.dy)) < -3) tags.push('LOW');
    if (Math.max(...progs) < -2) tags.push('BACKTRACK');
    if (floating) tags.push('FLOATING');
    if (members.some(m => m.void)) tags.push('OVER-VOID');
    if (hasExplosive) tags.push(hasReward ? 'MIXED-EXPLOSIVE' : 'EXPLOSIVE');
    if (members.some(m => m.outline)) tags.push('OUTLINE');
    if (members.some(m => m.enemyDist !== null && m.enemyDist <= T.near)) tags.push('ENEMY');
    if (members.some(m => m.hazardDist !== null && m.hazardDist <= T.near)) tags.push('HAZARD');
    if (members.some(m => m.grade >= T.downhill || m.afterPad)) tags.push('SPEED');
    return { id, count: members.length, counted: members.filter(m => m.counted).length, composition: kinds, ...shape, floating, tags,
      access: [...new Set(members.map(m => m.reach))],
      prog: r1(mean(progs)), progRange: [r1(Math.min(...progs)), r1(Math.max(...progs))], lat: r1(mean(members.map(m => m.lat))),
      p: [r2(mean(members.map(m => m.p.x))), r2(Math.min(...members.map(m => m.base))), r2(mean(members.map(m => m.p.z)))],
      members: members.map(m => m.ref), cids: [...new Set(members.map(m => m.cid).filter(c => c !== null))].slice(0, 12) };
  });

  // ---- crate rails (derived grind ledges) ----
  const runKey = run => run.map(c => byCrate.get(c)?.ref ?? '?').sort().join(',');
  const runMap = new Map();
  for (const rail of level.crateRails) {
    const run = level.crateRunFor(rail); if (!run) continue;
    const key = runKey(run); if (!runMap.has(key)) runMap.set(key, { run, sides: 0, rail }); runMap.get(key).sides++;
  }
  const runs = [...runMap.values()].map(({ run, sides }, id) => {
    const ms = run.map(c => byCrate.get(c)).filter(Boolean);
    for (const m of ms) m.run = id;
    const a = ms[0].p, b = ms[ms.length - 1].p, axis = Math.abs(b.x - a.x) > Math.abs(b.z - a.z) ? 'x' : 'z';
    const fx = mean(ms.map(m => m.fx)), fz = mean(ms.map(m => m.fz)), dot = Math.abs(axis === 'x' ? fx : fz) / (Math.hypot(fx, fz) || 1);
    const unsupported = ms.filter(m => m.sup === 'none').length, voids = ms.filter(m => m.void || m.pit).length;
    return { id, crates: ms.length, length: r2(ms.length * S), axis, orientation: dot > .866 ? 'along' : dot < .5 ? 'across' : 'diagonal', top: r2(ms[0].top), sides,
      support: unsupported === 0 ? 'grounded' : unsupported === ms.length ? 'floating' : 'bridges-gap', overVoid: voids,
      kinds: tally(ms, m => m.kind), explosive: ms.some(m => EXPLOSIVE.has(m.kind)), prog: r1(mean(ms.map(m => m.prog))), lat: r1(mean(ms.map(m => m.lat))),
      onPath: Math.min(...ms.map(m => Math.abs(m.lat))) <= T.onPath, cluster: ms[0].cl, members: ms.map(m => m.ref) };
  });
  // Lines that would exist once every outline is materialised (all switches hit).
  const ghosts = level.crates.filter(c => c.pending);
  let afterSwitches = { runs: runs.length, crates: sum(runs.map(r => r.crates)) };
  if (ghosts.length) {
    for (const c of ghosts) c.pending = false;
    level.rebuildCrateRails();
    const keys = new Map();
    for (const rail of level.crateRails) { const run = level.crateRunFor(rail); if (run) keys.set(runKey(run), run.length); }
    afterSwitches = { runs: keys.size, crates: sum([...keys.values()]) };
    for (const c of ghosts) c.pending = true;
    level.rebuildCrateRails();
  }

  // ---- explosives ----
  const crateItems = items.filter(it => !it.cp);
  const blasts = crateItems.filter(it => EXPLOSIVE.has(it.kind)).map(e => {
    const radius = (e.kind === 'tnt' ? TUNING.tntRadius : TUNING.nitroRadius) + .6; // centre distance used by Level.update
    const hit = crateItems.filter(o => o !== e && !ARROW.has(o.kind) && !o.outline && o.p.distanceTo(e.p) < radius);
    return { ref: e.ref, kind: e.kind, cid: e.cid, buried: e.buried, rewardsInBlast: hit.filter(o => REWARD.has(o.kind)).length,
      explosivesChained: hit.filter(o => EXPLOSIVE.has(o.kind)).length, switchesInBlast: hit.filter(o => o.kind === 'bang' || o.kind === 'nitrobang').length,
      cluster: e.cl, prog: r1(e.prog), p: e.p.toArray().map(r2) };
  });
  const greens = crateItems.filter(it => it.kind === 'nitrobang'), nitros = crateItems.filter(it => it.kind === 'nitro');
  const explosives = {
    tnt: crateItems.filter(it => it.kind === 'tnt').length, nitro: nitros.length, buriedNitro: nitros.filter(n => n.buried).length,
    greenAuthored: greens.filter(g => !g.sys).length, greenSystemic: greens.filter(g => g.sys).length,
    nitroWithoutGreen: nitros.length > 0 && greens.length === 0,
    greens: greens.map(g => ({ ref: g.ref, systemic: g.sys, cid: g.cid, prog: r1(g.prog), toGate: r1(routeLen - g.prog), nitrosBefore: nitros.filter(n => n.prog < g.prog).length, p: g.p.toArray().map(r2) })),
    clusters: clusters.filter(c => c.tags.includes('EXPLOSIVE') || c.tags.includes('MIXED-EXPLOSIVE')).length,
    mixedClusters: clusters.filter(c => c.tags.includes('MIXED-EXPLOSIVE')).length,
    tntWithNeighbours: blasts.filter(b => b.kind === 'tnt' && b.rewardsInBlast + b.explosivesChained + b.switchesInBlast > 0).length,
    blasts,
  };
  // ---- switches and outline groups ----
  const outlines = crateItems.filter(it => it.c.wasOutline);
  const wiredTo = (ids, groupIds) => ids.length ? (groupIds ?? []).some(id => ids.includes(id)) : !(groupIds?.length);
  const switches = crateItems.filter(it => it.kind === 'bang').map(b => {
    const ids = b.c.groupIds ?? [], wired = outlines.filter(o => wiredTo(ids, o.c.groupIds));
    const surfaces = (level.outlinedSurfaces ?? []).filter(s => ids.length ? s.groups.some(id => ids.includes(id)) : !s.groups.length);
    const d = wired.map(o => o.p.distanceTo(b.p)), dp = wired.map(o => o.prog - b.prog);
    for (const o of wired) o.wired = true;
    return { ref: b.ref, cid: b.cid, nm: b.nm, prog: r1(b.prog), outlines: wired.length, outlineKinds: tally(wired, o => o.kind), surfaces: surfaces.length,
      dist: d.length ? [r1(Math.min(...d)), r1(mean(d)), r1(Math.max(...d))] : null,
      progDelta: dp.length ? [r1(Math.min(...dp)), r1(Math.max(...dp))] : null, p: b.p.toArray().map(r2) };
  });
  const orphanOutlines = outlines.filter(o => !o.wired).length;
  // ---- arrows and multi-hit crates: what is there to reach above them ----
  // Targets above a launcher: crates whose base its bounce (+ double jump + head) reaches, fruit,
  // or a surface too high for a double jump from the launcher's own floor.
  const above = (it, feet) => {
    const crates = crateItems.filter(o => o !== it && horiz(o.p, it.p) <= 2 && o.base >= it.top - .05 && o.base <= it.top + feet + HEAD);
    const fruitAbove = fruit.filter(f => Math.hypot(f.x - it.p.x, f.z - it.p.z) <= 2 && f.y > it.top + 1.5 && f.y <= it.top + feet + HEAD + .5).length;
    let ledge = false;
    for (const rad of [1.5, 2.5, 3.5, 5]) for (const [cx, cz] of ring) {
      const gy = ground.top(it.p.x + cx * rad, it.top + feet + .2, it.p.z + cz * rad, feet + .2);
      if (gy !== null && gy > it.colBase + JUMP.double + .2 && gy <= it.top + feet) ledge = true;
    }
    const highest = Math.max(-Infinity, ...crates.map(o => o.base - it.top));
    return { crates: crates.length, crateRefs: crates.map(o => o.ref).slice(0, 6), fruit: fruitAbove, ledge,
      need: !crates.length ? null : highest <= B.arrowPlain ? 'plain' : highest <= B.arrowPerfect ? 'perfect' : 'perfect+double' };
  };
  const arrows = crateItems.filter(it => ARROW.has(it.kind)).map(a => {
    const t = above(a, JUMP.arrowPerfect + JUMP.doubleAdd);
    return { ref: a.ref, kind: a.kind, cid: a.cid, nm: a.nm, target: t.crates ? 'crate' : t.ledge ? 'ledge' : t.fruit ? 'fruit-only' : 'nothing', ...t,
      gapAnchor: a.void || (a.dropDist !== null && a.dropDist <= T.nearDrop), sup: a.sup, outline: a.outline, prog: r1(a.prog), p: a.p.toArray().map(r2) };
  });
  const multihit = crateItems.filter(it => it.kind === 'multihit').map(m => {
    const t = above(m, JUMP.crateBounce + JUMP.doubleAdd);
    return { ref: m.ref, cid: m.cid, nm: m.nm, sup: m.sup, elev: r2(m.elev), cluster: clusters[m.cl].arrangement, clusterSize: clusters[m.cl].count,
      targetAbove: t.crates ? 'crate' : t.ledge ? 'ledge' : t.fruit ? 'fruit-only' : 'nothing', enemyDist: r1(m.enemyDist), prog: r1(m.prog), p: m.p.toArray().map(r2) };
  });

  // ---- patterns ----
  const patterns = [];
  const singles = clusters.filter(c => c.count === 1).map(c => items.find(m => m.cl === c.id)).filter(m => m.counted).sort((a, b) => a.prog - b.prog);
  for (let i = 0; i < singles.length - 1;) {
    let j = i + 1; const gaps = [];
    while (j < singles.length) {
      const d = singles[j].p.distanceTo(singles[j - 1].p);
      if (d < 1.6 || d > 24 || Math.abs(singles[j].lat - singles[j - 1].lat) > 3) break;
      const g2 = [...gaps, d], m = mean(g2), cv = Math.sqrt(mean(g2.map(g => (g - m) ** 2))) / m;
      if (g2.length >= 2 && cv > .25) break;
      gaps.push(d); j++;
    }
    if (j - i >= 4) {
      const run = singles.slice(i, j), m = mean(gaps);
      patterns.push({ type: 'evenly-spaced-singles', count: run.length, spacing: r2(m), spacingCv: r2(Math.sqrt(mean(gaps.map(g => (g - m) ** 2))) / m),
        kinds: tally(run, r => r.kind), grounded: run.every(r => r.sup === 'ground'), heightRange: r2(Math.max(...run.map(r => r.base)) - Math.min(...run.map(r => r.base))),
        progRange: [r1(run[0].prog), r1(run[run.length - 1].prog)], first: run[0].ref, firstCid: run[0].cid, firstP: run[0].p.toArray().map(r2), members: run.map(r => r.ref) });
      i = j;
    } else i++;
  }
  const chain = (list, link) => {
    const par = list.map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
    for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) if (list[a].p.distanceTo(list[b].p) <= link) par[f(a)] = f(b);
    const out = new Map(); list.forEach((x, i) => { const k = f(i); if (!out.has(k)) out.set(k, []); out.get(k).push(x); });
    return [...out.values()];
  };
  const floaters = crateItems.filter(it => it.sup === 'none' && !it.outline);
  for (const g of chain(floaters, T.floatLink).filter(g => g.length >= 3)) {
    const lin = linearity(g.map(m => m.p.toArray()));
    patterns.push({ type: lin >= .9 ? 'floating-line' : 'floating-group', count: g.length, linearity: r2(lin), overVoid: g.filter(m => m.void).length,
      kinds: tally(g, m => m.kind), progRange: [r1(Math.min(...g.map(m => m.prog))), r1(Math.max(...g.map(m => m.prog)))],
      first: g[0].ref, firstCid: g[0].cid, firstP: g[0].p.toArray().map(r2), members: g.map(m => m.ref) });
  }
  const reps = clusters.filter(c => !c.composition.checkpoint || c.count > 1).map(c => ({ c, ms: items.filter(m => m.cl === c.id) }));
  const close = (A, B) => A.ms.some(a => B.ms.some(b => a.p.distanceTo(b.p) <= T.groupLink));
  const par = reps.map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  for (let a = 0; a < reps.length; a++) for (let b = a + 1; b < reps.length; b++) {
    if (Math.abs(reps[a].c.prog - reps[b].c.prog) > 40) continue;
    if (close(reps[a], reps[b])) par[f(a)] = f(b);
  }
  const loose = new Map(); reps.forEach((r, i) => { const k = f(i); if (!loose.has(k)) loose.set(k, []); loose.get(k).push(r); });
  for (const g of [...loose.values()].filter(g => g.length >= 3)) {
    const ms = g.flatMap(r => r.ms), lin = linearity(ms.map(m => m.p.toArray()));
    patterns.push({ type: lin >= .9 ? 'spaced-line' : 'scattered', clusters: g.length, count: ms.length, linearity: r2(lin),
      kinds: tally(ms, m => m.kind), progRange: [r1(Math.min(...ms.map(m => m.prog))), r1(Math.max(...ms.map(m => m.prog)))],
      first: ms[0].ref, firstCid: ms[0].cid, firstP: ms[0].p.toArray().map(r2) });
  }

  // ---- sections along the route ----
  const cpProgs = items.filter(it => it.cp).map(it => it.prog).sort((a, b) => a - b);
  const bounds = [0, ...cpProgs.map(p => clamp(p, 0, routeLen)), routeLen];
  const counted = crateItems.filter(it => it.counted);
  const sections = bounds.slice(1).map((to, k) => {
    const from = bounds[k], inside = crateItems.filter(it => (k === 0 || it.prog >= from) && (k === bounds.length - 2 || it.prog < to));
    return { index: k, from: r1(from), to: r1(to), length: r1(to - from), counted: inside.filter(it => it.counted).length, physical: inside.length,
      byKind: tally(inside, it => it.outline ? `outline-${it.kind}` : it.kind), clusters: new Set(inside.map(it => it.cl)).size };
  });
  const onRoute = counted.map(it => it.prog).filter(p => p >= 0 && p <= routeLen).sort((a, b) => a - b);
  let emptiest = { length: 0, from: 0, to: 0 };
  [0, ...onRoute, routeLen].forEach((p, i, arr) => { if (i && p - arr[i - 1] > emptiest.length) emptiest = { length: r1(p - arr[i - 1]), from: r1(arr[i - 1]), to: r1(p) }; });

  // ---- summaries ----
  const solid = crateItems.filter(it => !it.outline && !it.buried);
  const sizeHist = tally(clusters.filter(c => c.counted > 0), c => c.count >= 10 ? '10+' : c.count >= 5 ? '5-9' : String(c.count));
  const real = clusters.filter(c => c.counted > 0), structural = clusters.filter(c => !c.counted && !(c.count === 1 && c.composition.checkpoint));
  const highs = crateItems.filter(it => it.high && TARGET.has(it.kind) && !it.outline);
  const summary = {
    physical: crateItems.length, counted: counted.length, checkpoints: cpProgs.length, gemTally: level.totalCrates,
    byKind: tally(crateItems.filter(it => !it.outline), it => it.kind), outlineByKind: tally(crateItems.filter(it => it.outline), it => it.kind),
    per100m: routeLen > 1 ? r2(100 * counted.length / routeLen) : null, physicalPer100m: routeLen > 1 ? r2(100 * crateItems.length / routeLen) : null,
    checkpointGaps: [0, ...cpProgs, routeLen].slice(1).map((p, i, arr) => r1(p - (i ? arr[i - 1] : 0))),
    clusters: real.length, singles: real.filter(c => c.count === 1).length, meanClusterSize: r2(mean(real.map(c => c.count))), sizeHist,
    structuralClusters: structural.length, structuralCrates: sum(structural.map(c => c.count)), maxStackAll: Math.max(0, ...clusters.map(c => c.stackHeight)),
    arrangements: tally(real, c => c.shapeClass), maxStack: Math.max(0, ...real.map(c => c.stackHeight)), largestCluster: Math.max(0, ...real.map(c => c.count)),
    floatingClusters: real.filter(c => c.floating).length,
    support: tally(solid, it => it.sup), floatingCrates: solid.filter(it => it.sup === 'none').length,
    overVoid: solid.filter(it => it.void).length, overPit: solid.filter(it => it.pit).length,
    nearDrop: solid.filter(it => it.dropDist !== null && it.dropDist <= T.nearDrop).length,
    overhanging: solid.filter(it => it.sup === 'ground' && it.corners < 4).length,
    high: highs.length, highTools: tally(highs, it => it.reach),
    onPath: counted.filter(it => Math.abs(it.lat) <= T.onPath).length, offLine: counted.filter(it => Math.abs(it.lat) > T.onPath && Math.abs(it.lat) <= T.detour).length,
    detour: counted.filter(it => Math.abs(it.lat) > T.detour).length, behindStart: counted.filter(it => it.prog < -2).length,
    beyondGate: counted.filter(it => it.prog > routeLen + 2).length, routeOffset: r1(median(counted.map(it => it.off)) ?? 0),
    enemyNear: counted.filter(it => it.enemyDist !== null && it.enemyDist <= T.near).length,
    hazardNear: tally(counted.filter(it => it.hazardDist !== null && it.hazardDist <= T.near), it => it.hazardKind),
    onRail: crateItems.filter(it => it.railDist !== null && it.railDist <= 1).length, nearRail: crateItems.filter(it => it.railDist !== null && it.railDist <= 2.5).length,
    downhill: counted.filter(it => it.grade >= T.downhill).length, afterPad: counted.filter(it => it.afterPad).length,
    plainOnSpeed: counted.filter(it => REWARD.has(it.kind) && !it.outline && (it.grade >= T.downhill || it.afterPad)).length,
    runs: runs.length, runCrates: sum(runs.map(r => r.crates)), longestRun: Math.max(0, ...runs.map(r => r.crates)),
    runsBridging: runs.filter(r => r.support !== 'grounded').length, runsAfterSwitches: afterSwitches,
    arrows: arrows.length, arrowTargets: tally(arrows, a => a.target), multihit: multihit.length,
    emptiest, authoredRails: rails.length, speedPads: pads.length, enemies: enemies.length, hazards: tally(hazards, h => h.kind),
  };
  const crateRecords = items.map(it => {
    const rec = { ref: it.ref, cid: it.cid, kind: it.kind, p: it.p.toArray().map(r2), base: r2(it.base), prog: r1(it.prog), lat: r1(it.lat), dy: r1(it.dy),
      sec: it.cp ? null : sections.findIndex(s => s.index === sections.length - 1 || it.prog < s.to), cl: it.cl, sup: it.sup, elev: r2(it.elev), reach: it.reach };
    if (it.nm) rec.nm = it.nm;
    if (it.outline) rec.outline = true;
    if (it.sys) rec.systemic = true;
    if (it.buried) rec.buried = true;
    if (it.tools?.length > 1) rec.tools = it.tools;
    if (it.reachGap !== null && it.reachGap !== undefined && it.sup === 'none') rec.reachGap = r2(it.reachGap);
    if (it.void) rec.void = true;
    if (it.pit) rec.pit = true;
    if (it.dropDist !== null && it.dropDist !== undefined) rec.drop = r2(it.dropDist);
    if (it.sup === 'ground' && it.corners < 4) rec.corners = it.corners;
    if (it.run !== undefined) rec.run = it.run;
    if (it.railDist !== null && it.railDist <= 2.5) rec.rail = r2(it.railDist);
    if (it.enemyDist !== null && it.enemyDist <= T.near) rec.enemy = [it.enemyKind, r1(it.enemyDist)];
    if (it.hazardDist !== null && it.hazardDist <= T.near) rec.hazard = [it.hazardKind, r1(it.hazardDist)];
    if (it.grade >= T.downhill) rec.grade = r2(it.grade);
    if (it.afterPad) rec.afterPad = true;
    return rec;
  });
  return {
    id: target.id, title: target.title, name: level.name, group: target.group, island: target.island ?? null, islandName: target.islandName ?? null, progressKey: target.progressKey ?? null,
    boss: !!target.boss, source: target.source, killY: r2(killY), spawn: level.spawnPos.toArray().map(r2),
    gate: level.gateSpec ? [level.gateSpec.x, level.gateSpec.y, level.gateSpec.z].map(r2) : null,
    route: { method, length: r1(routeLen), laneNodes, ...(note ? { note } : {}) },
    summary, checkpoints: cpProgs.map(r1), sections, explosives, switches, orphanOutlines, arrows, multihit, runs, patterns,
    clusters, crates: crateRecords,
  };
}

/** Arrangement of one cluster on the crate grid (crates share world axes; there is no per-crate yaw). */
function classify(members, S, fx, fz) {
  const n = members.length, fl = Math.hypot(fx, fz) || 1;
  fx /= fl; fz /= fl;
  const x0 = Math.min(...members.map(m => m.p.x)), y0 = Math.min(...members.map(m => m.base)), z0 = Math.min(...members.map(m => m.p.z));
  const cells = members.map(m => [Math.round((m.p.x - x0) / S), Math.round((m.base - y0) / S), Math.round((m.p.z - z0) / S)]);
  const cols = new Map(); for (const [x, y, z] of cells) { const k = `${x},${z}`; cols.set(k, (cols.get(k) ?? 0) + 1); }
  const wx = Math.max(...cells.map(c => c[0])) + 1, wz = Math.max(...cells.map(c => c[2])) + 1;
  const layers = new Set(cells.map(c => c[1])).size, stackHeight = Math.max(...cols.values());
  const orient = (dx, dz) => { const l = Math.hypot(dx, dz) || 1, d = Math.abs((dx * fx + dz * fz) / l); return d > .866 ? 'along' : d < .5 ? 'across' : 'diagonal'; };
  const layerCounts = [...new Set(cells.map(c => c[1]))].sort((a, b) => a - b).map(y => cells.filter(c => c[1] === y).length);
  const base = { stackHeight, footprint: cols.size, dims: [wx, wz, layers], ...(layers > 1 ? { layerCounts } : {}) };
  if (n === 1) return { arrangement: 'single', shapeClass: 'single', ...base };
  if (cols.size === 1) return { arrangement: 'stack', shapeClass: 'stack', ...base };
  const line = wx === 1 || wz === 1, longX = wz === 1;
  if (layers === 1) {
    if (n === 2) { const [a, b] = members; const o = orient(b.p.x - a.p.x, b.p.z - a.p.z); return { arrangement: 'pair', shapeClass: 'pair', orientation: o, ...base }; }
    if (line) { const o = orient(longX ? 1 : 0, longX ? 0 : 1); return { arrangement: 'row', shapeClass: 'row', orientation: o, ...base }; }
    const d1 = new Set(cells.map(c => c[0] - c[2])).size === 1, d2 = new Set(cells.map(c => c[0] + c[2])).size === 1;
    if (d1 || d2) return { arrangement: 'row', shapeClass: 'row', orientation: orient(1, d1 ? 1 : -1), diagonal: true, ...base };
    if (cols.size === wx * wz) return { arrangement: 'grid', shapeClass: 'grid', ...base };
    return { arrangement: 'irregular', shapeClass: 'irregular', ...base };
  }
  const byLayer = [...new Set(cells.map(c => c[1]))].sort((a, b) => a - b).map(y => new Set(cells.filter(c => c[1] === y).map(c => `${c[0]},${c[2]}`)));
  const pyramid = byLayer[0].size >= 2 && byLayer.every((s, i) => !i || (s.size < byLayer[i - 1].size && [...s].every(k => byLayer[i - 1].has(k))));
  if (pyramid) return { arrangement: 'pyramid', shapeClass: 'pyramid', ...(line ? { orientation: orient(longX ? 1 : 0, longX ? 0 : 1) } : {}), ...base };
  if (line) { const o = orient(longX ? 1 : 0, longX ? 0 : 1); return { arrangement: 'wall', shapeClass: o === 'across' ? 'wall-across-path' : o === 'along' ? 'wall-along-path' : 'wall-diagonal', orientation: o, ...base }; }
  if (n === wx * wz * layers) return { arrangement: 'block', shapeClass: 'block', ...base };
  return { arrangement: 'irregular', shapeClass: 'irregular', ...base };
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
  const peak = v => v * v / (2 * TUNING.riseGravity);
  const JUMP = { single: peak(TUNING.jumpVelocity), double: peak(TUNING.jumpVelocity) + peak(TUNING.doubleJumpVelocity),
    doubleAdd: peak(TUNING.doubleJumpVelocity), crateBounce: peak(TUNING.crateBounce), arrow: peak(TUNING.arrowBounce),
    arrowPerfect: peak(TUNING.arrowBounce * TUNING.arrowBoostMult) };
  const { BASE_CHARACTER_HITBOX_HEIGHT: HEAD } = await server.ssrLoadModule('/src/character/collisionDimensions.ts');
  constants = { crateSize: CRATE_SIZE, hitboxHeight: HEAD, jump: Object.fromEntries(Object.entries(JUMP).map(([k, v]) => [k, r2(v)])),
    tntRadius: TUNING.tntRadius, nitroRadius: TUNING.nitroRadius, blastReach: TUNING.tntRadius + .6, smashSpeed: TUNING.smashSpeed, thresholds: T };
  const published = JSON.parse(await readFile(path.join(ROOT, 'public/levels.json'), 'utf8')).levels;
  const restored = !STOCK && api.restoreUserLevels(published);
  const overrides = new Set(restored ? api.getUserLevels().map(l => l.id) : []);
  const sourceOf = entry => { const b = api.BUILTIN_LEVELS.find(l => l.id === entry.id); return b === entry ? (b.data ? 'builtin-data' : 'builtin-native') : overrides.has(entry.id) ? 'published-override' : 'source'; };
  const crateComponents = data => (data?.components ?? []).filter(c => ['crate', 'outline', 'metal'].includes(c.t)).length;

  const targets = [];
  for (const def of CAMPAIGN_LEVELS) {
    const base = { id: def.levelId, title: def.name, island: def.islandId, islandName: islandName(def.islandId), progressKey: def.progressKey, group: 'campaign', boss: !!def.boss };
    if (ONLY && !ONLY.includes(def.levelId)) continue;
    if (def.placeholder) { skipped.push({ ...base, reason: 'placeholder slot: no level authored yet' }); continue; }
    if (def.competition) { skipped.push({ ...base, reason: 'skate competition (judged trick runs, no platforming route)' }); continue; }
    if (def.skateRace) { skipped.push({ ...base, reason: def.levelId === 'coconut-cart-rally' ? 'cart race (crates are race item boxes)' : 'skate race (crates are race item boxes)' }); continue; }
    const entry = api.findLevel(def.levelId);
    if (!entry) { skipped.push({ ...base, reason: 'level id not found' }); continue; }
    if (entry.data?.skatepark) { skipped.push({ ...base, reason: `free-skate park (skatepark: true); ${crateComponents(entry.data)} crate components` }); continue; }
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
    skipped.push({ id: 'bonus rooms', title: `${bonus.length} bonus stages`, group: 'bonus',
      reason: `separate bonus-room levels reached from bonus platforms, not CAMPAIGN_LEVELS entries (${sum(bonus.map(b => crateComponents(b.data)))} crate components in total); measure with --levels ${bonus.slice(0, 2).map(b => b.id).join(',')},...` });
  }

  // Asset loaders log 404s headlessly; keep only the Level's own [nitro] notes.
  let notes = [];
  const quiet = (...a) => { const s = String(a[0] ?? ''); if (s.startsWith('[nitro]')) notes.push(s); };
  console.warn = quiet; console.error = quiet; const rawLog = console.log; console.log = quiet;
  try {
    for (const target of targets) {
      const t0 = Date.now(); notes = []; let level = null;
      try {
        level = new Level(new THREE.Scene(), target.entry);
        const record = measureLevel(THREE, level, target, { S: CRATE_SIZE, JUMP, TUNING, HEAD });
        if (notes.length) record.notes = notes.slice();
        results.push(record);
        log(`${target.id}: ${record.summary.physical} crates (+${record.summary.checkpoints} checkpoints), ${record.clusters.length} clusters, route ${record.route.length} m [${record.route.method}] in ${Date.now() - t0} ms`);
      } catch (error) {
        results.push({ id: target.id, title: target.title, group: target.group, island: target.island ?? null, source: target.source, error: String(error?.stack ?? error).split('\n').slice(0, 4).join(' | ') });
        log(`${target.id}: FAILED ${String(error?.message ?? error)}`);
      } finally { try { level?.dispose(); } catch { /* best effort */ } }
    }
  } finally { console.log = rawLog; }
}, { levelEntry: { id: '__crate_report', name: 'Crate report', data: { v: 1, name: 'Crate report', spawn: [0, 1, 0], killY: -20, components: [] } } });

// ---- aggregate --------------------------------------------------------------
function aggregate(levels) {
  const ok = levels.filter(l => !l.error), crates = ok.flatMap(l => l.crates.filter(c => c.kind !== 'checkpoint'));
  const counted = crates.filter(c => !UNCOUNTED.has(c.kind)), clusters = ok.flatMap(l => l.clusters.filter(c => c.counted > 0));
  const structural = ok.flatMap(l => l.clusters.filter(c => !c.counted && !(c.count === 1 && c.composition.checkpoint)));
  const solid = crates.filter(c => !c.outline && !c.buried), highs = solid.filter(c => TARGET.has(c.kind) && c.reach && !['walk', 'jump', 'checkpoint', 'buried'].includes(c.reach));
  const gaps = ok.flatMap(l => l.summary.checkpointGaps), dens = ok.filter(l => l.summary.per100m !== null && l.summary.counted).map(l => l.summary.per100m);
  const blasts = ok.flatMap(l => l.explosives.blasts), arrows = ok.flatMap(l => l.arrows), runs = ok.flatMap(l => l.runs);
  return {
    levels: ok.length, failed: levels.length - ok.length, withCrates: ok.filter(l => l.summary.physical).length, routeKm: r2(sum(ok.map(l => l.route.length)) / 1000),
    physical: crates.length, counted: counted.length, checkpoints: sum(ok.map(l => l.summary.checkpoints)),
    byKind: tally(crates.filter(c => !c.outline), c => c.kind), outlineByKind: tally(crates.filter(c => c.outline), c => c.kind),
    per100m: { median: r2(median(dens)), min: r2(Math.min(...dens)), max: r2(Math.max(...dens)), overall: r2(100 * counted.length / Math.max(1, sum(ok.filter(l => l.summary.counted).map(l => l.route.length)))) },
    checkpointGap: { median: r1(median(gaps)), min: r1(Math.min(...gaps)), max: r1(Math.max(...gaps)) },
    clusters: clusters.length, singles: clusters.filter(c => c.count === 1).length, meanClusterSize: r2(mean(clusters.map(c => c.count))),
    sizeHist: tally(clusters, c => c.count >= 10 ? '10+' : c.count >= 5 ? '5-9' : String(c.count)), arrangements: tally(clusters, c => c.shapeClass),
    orientation: tally(clusters.filter(c => c.orientation), c => `${c.arrangement}-${c.orientation}`),
    maxStack: Math.max(0, ...clusters.map(c => c.stackHeight)), stackHist: tally(clusters, c => c.stackHeight),
    structuralClusters: structural.length, structuralCrates: sum(structural.map(c => c.count)), maxStackAll: Math.max(0, ...structural.map(c => c.stackHeight), ...clusters.map(c => c.stackHeight)),
    floatingClusters: clusters.filter(c => c.floating).length, tags: tally(clusters.flatMap(c => c.tags)),
    support: tally(solid, c => c.sup), overVoid: solid.filter(c => c.void).length, overPit: solid.filter(c => c.pit).length,
    nearDrop: solid.filter(c => c.drop !== undefined && c.drop <= T.nearDrop).length, high: highs.length, highTools: tally(highs, c => c.reach),
    route: { onPath: counted.filter(c => Math.abs(c.lat) <= T.onPath).length, offLine: counted.filter(c => Math.abs(c.lat) > T.onPath && Math.abs(c.lat) <= T.detour).length,
      detour: counted.filter(c => Math.abs(c.lat) > T.detour).length, behindStart: sum(ok.map(l => l.summary.behindStart)), beyondGate: sum(ok.map(l => l.summary.beyondGate)) },
    explosives: { tnt: sum(ok.map(l => l.explosives.tnt)), nitro: sum(ok.map(l => l.explosives.nitro)), levelsWithNitro: ok.filter(l => l.explosives.nitro).length,
      greenAuthored: sum(ok.map(l => l.explosives.greenAuthored)), greenSystemic: sum(ok.map(l => l.explosives.greenSystemic)),
      explosiveClusters: sum(ok.map(l => l.explosives.clusters)), mixedClusters: sum(ok.map(l => l.explosives.mixedClusters)),
      tntWithNeighbours: sum(ok.map(l => l.explosives.tntWithNeighbours)), rewardsInBlasts: sum(blasts.map(b => b.rewardsInBlast)) },
    switches: sum(ok.map(l => l.switches.length)), outlineCrates: sum(ok.map(l => l.switches.reduce((a, s) => a + s.outlines, 0))), orphanOutlines: sum(ok.map(l => l.orphanOutlines)),
    arrows: arrows.length, arrowTargets: tally(arrows, a => a.target), multihit: sum(ok.map(l => l.multihit.length)),
    multihitPlacement: tally(ok.flatMap(l => l.multihit), m => `${m.cluster}/${m.sup}/above:${m.targetAbove}`),
    runs: runs.length, runCrates: sum(runs.map(r => r.crates)), runLengths: tally(runs, r => r.crates >= 8 ? '8+' : String(r.crates)), runSupport: tally(runs, r => r.support), runOrientation: tally(runs, r => r.orientation),
    onRail: sum(ok.map(l => l.summary.onRail)), nearRail: sum(ok.map(l => l.summary.nearRail)), downhill: sum(ok.map(l => l.summary.downhill)), afterPad: sum(ok.map(l => l.summary.afterPad)),
    enemyNear: sum(ok.map(l => l.summary.enemyNear)), hazardNear: ok.reduce((m, l) => { for (const [k, v] of Object.entries(l.summary.hazardNear)) m[k] = (m[k] ?? 0) + v; return m; }, {}),
    patterns: tally(ok.flatMap(l => l.patterns), p => p.type),
  };
}

let commit = null;
try { commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a checkout */ }
const output = RENDER_ONLY ? JSON.parse(await readFile(OUT_JSON, 'utf8')) : {
  generatedBy: 'node tools/crate-placement-report.mjs', commit, levelSources: STOCK ? 'stock source only' : 'public/levels.json restored first (fresh-browser state)',
  constants, scope: { included: results.map(r => ({ id: r.id, title: r.title, group: r.group, island: r.island, islandName: r.islandName ?? null, source: r.source })), skipped },
  aggregate: { campaign: aggregate(results.filter(r => r.group === 'campaign')), puzzle: aggregate(results.filter(r => r.group === 'puzzle')),
    ...(results.some(r => r.group === 'extra') ? { extra: aggregate(results.filter(r => r.group === 'extra')) } : {}) },
  levels: results,
};

/** JSON with short arrays/objects (crate and cluster records) kept on one line each. */
function compactJson(value, indent = '') {
  const flat = JSON.stringify(value);
  if (flat === undefined) return 'null';
  if (flat.length <= 400 || value === null || typeof value !== 'object') return flat;
  const next = indent + '  ';
  if (Array.isArray(value)) return `[\n${value.map(v => next + compactJson(v, next)).join(',\n')}\n${indent}]`;
  return `{\n${Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => `${next}${JSON.stringify(k)}: ${compactJson(v, next)}`).join(',\n')}\n${indent}}`;
}
// ---- report -----------------------------------------------------------------
const LABEL = { wood: 'wood', empty: 'empty', mystery: '?', life: 'life', mask: 'mask', multihit: 'multi-hit', bouncy: 'arrow',
  metalbounce: 'steel arrow', metal: 'steel', tnt: 'TNT', nitro: 'Nitro', bang: '!', nitrobang: 'green !', checkpoint: 'checkpoint' };
const kindText = (m, outline) => [...KINDS.filter(k => m?.[k]).map(k => `${LABEL[k]} ${m[k]}`),
  ...KINDS.filter(k => outline?.[k]).map(k => `outline ${LABEL[k]} ${outline[k]}`)].join(', ') || '—';
const mdTable = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map(r => `| ${r.map(v => v === null || v === undefined || v === '' ? '—' : v).join(' | ')} |`)].join('\n');
const frac = (a, b) => b ? `${a} (${Math.round(100 * a / b)}%)` : `${a}`;
const topOf = (m, k = 3) => Object.entries(m ?? {}).sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, v]) => `${key} ${v}`).join(', ') || '—';
const at = p => `(${p.map(v => Math.round(v * 10) / 10).join(', ')})`;
const ident = rec => rec.cid !== null && rec.cid !== undefined ? `component #${rec.cid}` : `crate \`${rec.ref}\``;
const locate = rec => `${ident(rec)} at ${at(rec.p)}, ${rec.prog} m along the route`;
const cidRange = cids => !cids?.length ? null : cids.length === 1 ? `component #${cids[0]}` : `components #${Math.min(...cids)}–#${Math.max(...cids)}`;

/** Rule-based notable examples: each rule picks the most extreme instance it can find. */
function notableExamples(levels, C) {
  const camp = levels.filter(l => l.group === 'campaign'), puz = levels.filter(l => l.group === 'puzzle'), out = [];
  const add = (lv, where, title, text) => out.push({ level: lv.id, course: lv.title, where, title, text });
  const crate = (lv, ref) => lv.crates.find(c => c.ref === ref);
  const firstName = (lv, refs) => refs.map(r => crate(lv, r)?.nm).find(Boolean);
  const memberKinds = (lv, c) => kindText(tally(c.members.map(r => crate(lv, r)?.kind ?? '?')));
  // 1. Evenly spaced single crates.
  const spaced = camp.flatMap(lv => lv.patterns.filter(p => p.type === 'evenly-spaced-singles').map(p => ({ lv, p }))).sort((a, b) => b.p.count - a.p.count);
  if (spaced.length) {
    const { lv, p } = spaced[0], runsHere = lv.patterns.filter(q => q.type === 'evenly-spaced-singles').length, rec = crate(lv, p.first);
    add(lv, locate(rec), `${p.count} evenly spaced single crates`,
      `${p.count} single crates (${kindText(p.kinds)}) one every ${p.spacing} m (spacing CV ${p.spacingCv}) over ${Math.round(p.progRange[1] - p.progRange[0])} m of route, ` +
      `${p.grounded ? 'all on supported ground' : 'not all on supported ground'}${p.heightRange ? `, lids varying ${p.heightRange} m in height as the ground rises and falls` : ', all at one height'}. ` +
      `${lv.title} has ${runsHere} such runs (spacing ${Math.min(...lv.patterns.filter(q => q.spacing).map(q => q.spacing))}–${Math.max(...lv.patterns.filter(q => q.spacing).map(q => q.spacing))} m); ` +
      `${frac(lv.summary.singles, lv.summary.clusters)} of its collectible clusters are single crates.`);
  }
  // 2. Courses without crates.
  const empty = camp.filter(lv => !lv.summary.physical);
  if (empty.length) add(empty[0], 'whole course', `${empty.length} campaign courses without crates`,
    `${empty.map(lv => `${lv.title} (\`${lv.id}\`, ${Math.round(lv.route.length)} m, ${lv.summary.checkpoints} checkpoint crates)`).join('; ')} contain no crates apart from checkpoints.`);
  // 3. Largest collectible cluster.
  const big = camp.flatMap(lv => lv.clusters.filter(c => c.counted).map(c => ({ lv, c }))).sort((a, b) => b.c.count - a.c.count)[0];
  if (big) { const c = big.c, nm = firstName(big.lv, c.members);
    add(big.lv, `${cidRange(c.cids) ?? c.members[0]} around ${at(c.p)}, ${c.prog} m along the route`, `Largest collectible cluster`,
      `${c.count} touching crates (${Object.entries(c.composition).map(([k, v]) => `${k} ${v}`).join(', ')}) in one ${c.dims[0]}×${c.dims[1]} footprint` +
      `${c.layerCounts ? ` with ${c.layerCounts.length} layers (${c.layerCounts.join(' + ')}, classified ${c.shapeClass})` : ` (${c.shapeClass})`}${c.tags.includes('OVER-VOID') ? ', partly over a void' : ''}` +
      `${nm ? `: "${nm.split(' · ')[0]}"` : ''}. Tags ${c.tags.join(', ')}.`); }
  // 4. Tallest stack.
  const tall = levels.flatMap(lv => lv.clusters.map(c => ({ lv, c }))).sort((a, b) => b.c.stackHeight - a.c.stackHeight || b.c.count - a.c.count)[0];
  if (tall && tall.c.stackHeight >= 3) {
    const sameHeight = tall.lv.clusters.filter(c => c.stackHeight === tall.c.stackHeight).length;
    add(tall.lv, `${cidRange(tall.c.cids)} around ${at(tall.c.p)}`, `Tallest stack: ${tall.c.stackHeight} crates`,
      `${sameHeight} cluster(s) here stack ${tall.c.stackHeight} crates high (this one: ${memberKinds(tall.lv, tall.c)}${tall.c.composition.outline ? `, ${tall.c.composition.outline} of them outline crates` : ''}, ${tall.c.dims[0]}×${tall.c.dims[1]} footprint). ` +
      `The tallest stack inside any collectible cluster in the campaign is ${Math.max(...camp.map(l => Math.max(0, ...l.clusters.filter(c => c.counted).map(c => c.stackHeight))))}.`);
  }
  // 5. Largest switch -> outline group.
  const sw = levels.flatMap(lv => lv.switches.map(s => ({ lv, s }))).sort((a, b) => b.s.outlines - a.s.outlines)[0];
  if (sw?.s.outlines) add(sw.lv, locate(sw.s), `One ! switch materialises ${sw.s.outlines} outline crates`,
    `"${sw.s.nm ?? sw.s.ref}" wires ${sw.s.outlines} outline crates (${kindText(sw.s.outlineKinds)}) and ${sw.s.surfaces} outlined surfaces. They lie ${sw.s.dist[0]}–${sw.s.dist[2]} m from the switch ` +
    `(${sw.s.progDelta[0]} to ${sw.s.progDelta[1]} m further along the route).`);
  // 6. Switch whose outlines lie behind it.
  const back = [...camp, ...puz].flatMap(lv => lv.switches.filter(s => s.progDelta && s.progDelta[1] < 0).map(s => ({ lv, s }))).sort((a, b) => (a.lv.group === 'puzzle') - (b.lv.group === 'puzzle') || a.s.progDelta[0] - b.s.progDelta[0])[0];
  if (back) add(back.lv, locate(back.s), `Switch that rewards backtracking`,
    `"${back.s.nm ?? back.s.ref}" materialises ${back.s.outlines} outline crate(s) (${kindText(back.s.outlineKinds)}) ${-back.s.progDelta[1]}–${-back.s.progDelta[0]} m behind the switch along the route, ${back.s.dist[0]}–${back.s.dist[2]} m away.`);
  // 7. Wall across the path.
  const wall = camp.flatMap(lv => lv.clusters.filter(c => c.shapeClass === 'wall-across-path').map(c => ({ lv, c }))).sort((a, b) => b.c.count - a.c.count)[0];
  if (wall) {
    const walls = camp.flatMap(lv => lv.clusters.filter(c => c.shapeClass === 'wall-across-path'));
    add(wall.lv, `${cidRange(wall.c.cids)} around ${at(wall.c.p)}, ${wall.c.prog} m along the route`, `Crate wall across the path`,
      `${wall.c.count} crates (${Object.entries(wall.c.composition).map(([k, v]) => `${k} ${v}`).join(', ')}) stand ${wall.c.dims[2]} high in a single-thickness wall at right angles to the route. ` +
      `The campaign has ${walls.length} walls across the path (crate kinds present: ${Object.entries(tally(walls.flatMap(c => Object.keys(c.composition)))).map(([k, v]) => `${k} in ${v}`).join(', ')}).`);
  }
  // 8. Unsupported crates with no access found.
  const lost = camp.flatMap(lv => lv.crates.filter(c => c.reach === 'none-found' && TARGET.has(c.kind)).map(c => ({ lv, c }))).sort((a, b) => (b.c.elev ?? 99) - (a.c.elev ?? 99));
  if (lost.length) {
    const lv = lost[0].lv, here = lost.filter(x => x.lv === lv), lowest = here.map(x => x.c.elev).filter(e => e !== null);
    add(lv, locate(lost[0].c), `Crates with no detected way up`,
      `${here.length} crates${lost[0].c.nm ? ` ("${lost[0].c.nm}")` : ''} have no detected access: ${here.length - lowest.length} with no ground below at all` +
      `${lowest.length ? `, ${lowest.length} ${Math.min(...lowest)}–${Math.max(...lowest)} m above the floor below` : ''}. ` +
      `No arrow, grounded stack, enemy, trampoline, vert ramp, rail or ledge within reach was detected. These are all ${lost.length} campaign target crates in this class.`);
  }
  // 9. Floating formations over a void.
  const fl = camp.flatMap(lv => lv.patterns.filter(p => p.type.startsWith('floating') && p.overVoid).map(p => ({ lv, p })));
  if (fl.length) {
    const biggest = [...fl].sort((a, b) => b.p.count - a.p.count)[0], lv = biggest.lv, mine = fl.filter(x => x.lv === lv), rec = crate(lv, biggest.p.first);
    const tools = tally(lv.crates.filter(c => c.sup === 'none' && TARGET.has(c.kind)), c => c.reach);
    add(lv, locate(rec), `Mid-air crate formations over a void`,
      `${mine.length} floating formations (${sum(mine.map(x => x.p.count))} crates) hang with only void or water beneath. The largest, ${biggest.p.count} crates (${kindText(biggest.p.kinds)})` +
      `${rec.nm ? ` named "${rec.nm.split(' · ').slice(0, 2).join(' · ')}"` : ''}, spans ${Math.round(biggest.p.progRange[1] - biggest.p.progRange[0])} m of route. ` +
      `Access detected for their target crates: ${topOf(tools, 4)}.`);
  }
  // 10. Crate rail across a gap.
  const bridge = camp.flatMap(lv => lv.runs.filter(r => r.support !== 'grounded' && r.overVoid).map(r => ({ lv, r }))).sort((a, b) => b.r.crates - a.r.crates)[0];
  if (bridge) {
    const rec = crate(bridge.lv, bridge.r.members[0]), twin = bridge.lv.clusters[bridge.r.cluster];
    add(bridge.lv, locate(rec), `Crate row that is a grind bridge over a void`,
      `${bridge.r.crates} touching crates (${kindText(bridge.r.kinds)}) with equal lids (${bridge.r.length} m, ${bridge.r.orientation} the route) form a derived grind rail, ${bridge.r.overVoid} of them over open void. ` +
      `Grinding smashes each breakable box as it is left (steel never breaks), so ${bridge.r.kinds.metal === bridge.r.crates ? 'this steel row survives every ride' : 'a wood row like this can be ridden across once'}. ` +
      `The run belongs to a ${twin.count}-crate cluster (${memberKinds(bridge.lv, twin)})${rec.nm ? `, "${rec.nm.split(' · ')[0]}"` : ''}.`);
  }
  // 11. Arrow with nothing above it.
  const bare = camp.flatMap(lv => lv.arrows.filter(a => a.target === 'nothing').map(a => ({ lv, a })));
  if (bare.length) {
    const pick = bare.find(x => !x.a.gapAnchor) ?? bare[0];
    add(pick.lv, locate(pick.a), `Arrow crate with nothing above it`,
      `This ${LABEL[pick.a.kind]} crate${pick.a.nm ? ` ("${pick.a.nm}")` : ''} has no crate within its bounce reach, no fruit above, and no ledge within 5 m that a double jump could not already reach. ` +
      `${bare.length} of ${camp.reduce((n, lv) => n + lv.arrows.length, 0)} campaign arrows are like this, ${bare.filter(x => x.a.gapAnchor).length} of them at a drop edge or over a void.`);
  }
  // 12-14. Nitro and its clear switch.
  const nitroLevels = camp.filter(lv => lv.explosives.nitro);
  const heavy = [...nitroLevels].sort((a, b) => b.explosives.nitro - a.explosives.nitro)[0];
  if (heavy) { const g = heavy.explosives.greens[0], derived = nitroLevels.filter(lv => lv.explosives.greenSystemic);
    add(heavy, g ? locate(g) : 'whole course', `Most Nitro, cleared only at the end`,
      `${heavy.explosives.nitro} Nitro crates; the only green ! is ${g ? `${g.toGate} m before the gate, after all ${g.nitrosBefore} of them` : 'missing'}. ` +
      `${nitroLevels.filter(lv => lv.explosives.greens.length && lv.explosives.greens.every(x => x.toGate <= 40)).length} of ${nitroLevels.length} campaign courses with Nitro put their green ! within 40 m of the gate. ` +
      `${derived.length ? `No green ! is authored in ${derived.map(lv => `\`${lv.id}\``).join(' and ')}; Level.placeSystemicEndNitroBang derives one ${derived.map(lv => lv.explosives.greens.find(x => x.systemic)?.toGate).join(' / ')} m before the gate.` : ''}`); }
  const far = nitroLevels.flatMap(lv => lv.explosives.greens.map(g => ({ lv, g }))).sort((a, b) => b.g.toGate - a.g.toGate)[0];
  if (far && far.g.toGate > 40) add(far.lv, locate(far.g), `Green ! far from the finish`,
    `The ${far.g.systemic ? 'derived' : 'authored'} green ! sits ${far.g.toGate} m before the gate; ${far.g.nitrosBefore} of the course's ${far.lv.explosives.nitro} Nitro crates lie before it on the route.`);
  const idle = camp.filter(lv => lv.explosives.greens.length && !lv.explosives.nitro)[0];
  if (idle) add(idle, locate(idle.explosives.greens[0]), `Green ! with no Nitro to clear`,
    `An authored green ! (${idle.explosives.greens[0].toGate} m before the gate) in a course with no Nitro crate. Its kinds are ${kindText(idle.summary.byKind)}.`);
  // 15. TNT next to rewards.
  const tnt = camp.flatMap(lv => lv.explosives.blasts.filter(b => b.kind === 'tnt').map(b => ({ lv, b }))).sort((a, b) => b.b.rewardsInBlast - a.b.rewardsInBlast)[0];
  if (tnt?.b.rewardsInBlast) add(tnt.lv, locate(tnt.b), `TNT with reward crates inside its blast`,
    `${tnt.b.rewardsInBlast} reward crate(s) sit within ${C.blastReach} m of this TNT (blast radius ${C.tntRadius} m + 0.6 m, centre to centre), so its explosion breaks them. ` +
    `${camp.reduce((n, lv) => n + lv.explosives.tntWithNeighbours, 0)} campaign TNT crates have another crate inside their blast.`);
  // 16. Plain crates on a fast downhill.
  const fast = camp.filter(lv => lv.summary.plainOnSpeed).sort((a, b) => b.summary.plainOnSpeed - a.summary.plainOnSpeed)[0];
  if (fast) { const c = [...fast.crates].filter(x => x.grade !== undefined).sort((a, b) => b.grade - a.grade)[0];
    add(fast, locate(c), `Plain crates on a fast downhill`,
      `${fast.summary.plainOnSpeed} of ${fast.summary.counted} counted crates are plain reward crates where the route falls ≥ ${T.downhill * 100}% (this one ${Math.round(c.grade * 100)}%). ` +
      `A skater at ≥ ${C.smashSpeed} m/s plows through plain crates. Campaign total: ${camp.reduce((n, lv) => n + lv.summary.plainOnSpeed, 0)}.`); }
  // 17. Crate in an authored grind line.
  const onRail = camp.flatMap(lv => lv.crates.filter(c => c.rail !== undefined && c.rail <= 1).map(c => ({ lv, c }))).sort((a, b) => a.c.rail - b.c.rail)[0];
  if (onRail) add(onRail.lv, locate(onRail.c), `Crate sitting in an authored rail line`,
    `A ${LABEL[onRail.c.kind]} crate${onRail.c.nm ? ` ("${onRail.c.nm}")` : ''} ${onRail.c.rail} m from an authored rail's line. ${camp.reduce((n, lv) => n + lv.summary.onRail, 0)} campaign crates are within 1 m of one and ${camp.reduce((n, lv) => n + lv.summary.nearRail, 0)} within 2.5 m.`);
  // 18. Enemies beside crates.
  const guard = camp.filter(lv => lv.summary.enemyNear).sort((a, b) => b.summary.enemyNear - a.summary.enemyNear)[0];
  if (guard) { const c = guard.crates.filter(x => x.enemy).sort((a, b) => a.enemy[1] - b.enemy[1])[0];
    add(guard, locate(c), `Enemies patrolling beside crates`,
      `${guard.summary.enemyNear} of ${guard.summary.counted} counted crates lie within ${T.near} m of an enemy patrol (nearest: a ${c.enemy[0]} ${c.enemy[1]} m from this ${LABEL[c.kind]} crate). ` +
      `Campaign total: ${camp.reduce((n, lv) => n + lv.summary.enemyNear, 0)} crates near enemies and ${camp.reduce((n, lv) => n + Object.values(lv.summary.hazardNear).reduce((a, b) => a + b, 0), 0)} near hazards (${topOf(camp.reduce((m, lv) => { for (const [k, v] of Object.entries(lv.summary.hazardNear)) m[k] = (m[k] ?? 0) + v; return m; }, {}), 4)}).`); }
  // 19-20. Puzzle-trilogy contrast.
  const upper = puz.flatMap(lv => lv.crates.filter(c => c.reach === 'none-found' && REWARD.has(c.kind)).map(c => ({ lv, c })));
  if (upper.length) add(upper[0].lv, locate(upper[0].c), `Puzzle contrast: "upper-first" reward beyond the modelled reach`,
    `"${upper[0].c.nm}" floats ${upper[0].c.elev} m above its floor. A crate stomp below it reaches at most ${r2(C.jump.crateBounce + C.jump.doubleAdd + C.hitboxHeight)} m to a crate base (with double jump and head), ` +
    `so no access was found under the measured tuning. ${upper.length} such puzzle rewards.`);
  const pg = puz.flatMap(lv => lv.explosives.greens.filter(g => g.nitrosBefore === 0).map(g => ({ lv, g })))[0];
  if (pg) add(pg.lv, locate(pg.g), `Puzzle contrast: green ! before its Nitro field`,
    `All ${pg.lv.explosives.nitro} Nitro crates lie after this green ! (${pg.g.toGate} m before the gate). ${puz.filter(lv => lv.explosives.greens.every(g => g.nitrosBefore === 0)).length} of ${puz.length} puzzle levels order switch → field; ` +
    `${nitroLevels.filter(lv => lv.explosives.greens.length && lv.explosives.greens.every(g => g.nitrosBefore === lv.explosives.nitro)).length} of ${nitroLevels.length} campaign Nitro courses place the green ! after all their Nitro.`);
  return out.slice(0, 20);
}

function renderReport(out) {
  const levels = out.levels.filter(l => !l.error), camp = levels.filter(l => l.group === 'campaign'), puz = levels.filter(l => l.group === 'puzzle');
  const A = out.aggregate.campaign, P = out.aggregate.puzzle, C = out.constants, lines = [];
  const kindShare = (agg, kinds) => kinds.map(k => `${LABEL[k]} ${frac(agg.byKind[k] ?? 0, agg.physical - sum(Object.values(agg.outlineByKind)))}`).join(', ');
  lines.push('# Current game crate placement audit', '',
    `Generated by \`node tools/crate-placement-report.mjs\` (commit \`${out.commit ?? 'unknown'}\`); per-level, per-cluster and per-crate records are in ` +
    '[`data/current-game-crates.json`](data/current-game-crates.json). This is a factual baseline of where the game currently puts crates. ' +
    'It makes no comparison with Crash Bandicoot 2–4; that belongs in a separate document. Rerun the script after level changes. It takes about two minutes.', '');
  const failed = out.levels.filter(l => l.error);
  lines.push('## Headline numbers', '',
    `- ${A.levels} campaign courses (${A.routeKm} km of route between spawn and gate) and ${P.levels} puzzle-trilogy levels (${P.routeKm} km) were built through the real \`Level\` class.${failed.length ? ` ${failed.length} failed to build: ${failed.map(f => `\`${f.id}\``).join(', ')}.` : ''}`,
    `- Campaign: ${A.physical} crates, of which ${A.counted} count toward the gem tally, plus ${A.checkpoints} checkpoint crates. ${A.levels - A.withCrates} courses contain no crates except checkpoints.`,
    `- Solid crate kinds: ${kindShare(A, ['wood', 'mystery', 'mask', 'life', 'multihit', 'bouncy', 'metalbounce', 'metal', 'tnt', 'nitro', 'bang', 'nitrobang'])}. Outline (switch-activated) crates: ${kindText({}, A.outlineByKind)}.`,
    `- Density: median ${A.per100m.median} counted crates per 100 m of route (range ${A.per100m.min}–${A.per100m.max}; ${A.per100m.overall} overall). The puzzle levels average ${P.per100m.overall} per 100 m.`,
    `- Checkpoint spacing along the route: median ${A.checkpointGap.median} m (range ${A.checkpointGap.min}–${A.checkpointGap.max} m). Puzzle levels: median ${P.checkpointGap.median} m.`,
    `- Clusters: ${frac(A.singles, A.clusters)} of ${A.clusters} collectible clusters are single crates, with mean size ${A.meanClusterSize} and the tallest collectible stack ${A.maxStack} high. ` +
      `Another ${A.structuralClusters} clusters (${A.structuralCrates} crates) hold no counted crate (steel, outline steel, ! switches, steel arrows) and stack up to ${A.maxStackAll} high.`,
    `- Support: of ${sum(Object.values(A.support))} solid crates, ${frac(A.support.ground ?? 0, sum(Object.values(A.support)))} rest on ground, ${A.support.crate ?? 0} on another crate and ${A.support.none ?? 0} on nothing. ` +
      `${A.overVoid} hang over a void or pit and ${A.nearDrop} sit within ${T.nearDrop} m of a ≥ ${T.dropHeight} m drop.`,
    `- ${A.high} target crates are more than ${T.reach} m above the ground under them. They are reached by: ${topOf(A.highTools, 8)}.`,
    `- Route relation (counted crates vs the camera lane): ${frac(A.route.onPath, A.counted)} within ${T.onPath} m, ${A.route.offLine} at ${T.onPath}–${T.detour} m and ${A.route.detour} beyond ${T.detour} m. ${A.route.behindStart ? `${A.route.behindStart} lie behind the start.` : 'None lies behind the start.'}`,
    `- Explosives: ${A.explosives.tnt} TNT and ${A.explosives.nitro} Nitro (Nitro in ${A.explosives.levelsWithNitro} courses). There are ${A.explosives.greenAuthored} authored and ${A.explosives.greenSystemic} derived green ! crates. ` +
      `${A.explosives.mixedClusters} of ${A.explosives.explosiveClusters} explosive clusters also hold reward crates.`,
    `- Tools: ${A.arrows} arrow crates (targets above: ${topOf(A.arrowTargets, 4)}), ${A.multihit} multi-hit crates, and ${A.switches} ! switches wiring ${A.outlineCrates} outline crates (${A.orphanOutlines} unwired).`,
    `- Skating: ${A.runs} derived crate rails cover ${A.runCrates} crates (by support: ${topOf(A.runSupport, 3)}). ${A.onRail} crates sit within 1 m of an authored rail line, and ${A.downhill} counted crates are on a ≥ ${T.downhill * 100}% downhill.`, '');

  lines.push('## Scope', '', 'Included: every authored campaign platforming course in `CAMPAIGN_LEVELS` (the Codex lab is the campaign course Haunted Hassle, `codex-lab`), plus the three unregistered puzzle-trilogy layouts from `src/levels/puzzle-trilogy.ts` as a contrast group. ' +
    (out.levelSources.startsWith('stock') ? 'Run with `--stock`: source data only, public/levels.json ignored.'
      : 'The published pack (public/levels.json) is restored first, as in a fresh browser. "published-override" marks courses whose published copy replaces the source.'), '',
    mdTable(['Island', 'Course', 'Level id', 'Source'], out.scope.included.map(s => [s.islandName ?? (s.group === 'puzzle' ? 'puzzle contrast' : '—'), s.title, `\`${s.id}\``, s.source])), '',
    'Skipped:', '', mdTable(['Course', 'Level id', 'Reason'], out.scope.skipped.map(s => [s.title ?? '—', `\`${s.id}\``, s.reason])), '');

  const J = C.jump;
  lines.push('## Method', '',
    '- **Loading.** Each level is constructed with `new Level(scene, entry)` inside the headless `withSkateRuntime` harness (the `tools/audit-crate-layout.mjs` pattern). The published pack is restored into the in-memory store first, as a fresh browser does, so `findLevel()` returns what a new player gets. A failed build is recorded and the run continues; nothing asserts.',
    '- **Crates.** Measured from `level.crates` (after the ×1.2 cluster enlargement, so every crate is a 1.152 m cube) and `level.checkpoints`. Race item boxes are excluded. The derived end-of-course green ! is included and flagged `systemic`. ' +
      '"Counted" follows `Level.totalCrates`: every crate except !, green !, steel and steel-arrow crates. Checkpoint crates, which the gem tally also includes, are reported separately. Outline crates are reported under their underlying kind. Component indices (`cid`) index the level\'s built data (`builtFromData.components`). Native builders (`beachfront`, `jungle`, `dark`) have none, so those crates are named `c<n>` in `level.crates` order.',
    '- **Route and sections.** The route line is the level\'s camnode lane (`lanePts`), used when spawn and gate lie within 40 m of it and it spans at least half its length. Otherwise it is spawn → checkpoints → gate, as in `Level.bonusCourseRoute`. ' +
      'Each crate is projected in 3D onto the line, like `Level.laneDirAt`: *progress* is arc length from the spawn\'s projection toward the gate\'s, and *lateral* is the signed horizontal offset. Checkpoint progress values split the route into sections. Density is counted crates per 100 m of spawn→gate route.',
    `- **Clusters.** Crates (checkpoints included) are linked when their centres are within ${T.link} crate widths on every axis. That covers touching, stacked and diagonal neighbours. Arrangement is classified on the crate grid: single, pair, row, stack (one column), pyramid (each layer smaller and resting on the one below; includes staircases), wall (one crate thick, ≥ 2 layers), grid (one layer, full rectangle), block (full box) or irregular. ` +
      'Rows, walls and pairs are oriented along, across or diagonal to the route. A *collectible* cluster contains at least one counted crate. *Floating* means no member rests on ground.',
    `- **Patterns.** Evenly spaced singles: ≥ 4 consecutive single crates 1.6–24 m apart, lateral change ≤ 3 m and spacing CV ≤ 0.25. Floating line or group: ≥ 3 unsupported crates chained within ${T.floatLink} m, a line if the first principal axis holds ≥ 90% of the variance. Spaced line or scattered: ≥ 3 clusters chained within ${T.groupLink} m.`,
    '- **Support and elevation.** Vertical raycasts against `level.groundMeshes` (centre plus four footprint corners) decide whether a crate rests on ground, on another crate, on an inactive outline surface or on a spin-bridge deck that appears once spun, or on nothing. ' +
      `*Void* means no ground above \`killY\` below, lethal water first, or a pit first. A pit counts only when it is not underneath other ground, so level-wide safety pits are ignored. *Near drop* means a ≥ ${T.dropHeight} m drop, pit or void, found in 8 directions, that persists outward and starts within ${T.nearDrop} m of the crate face.`,
    `- **Reach.** A crate is *above jump reach* when its base is more than ${T.reach} m above the ground under it (single jump peak ${J.single} m). Tools are tested in this order: grounded stack; arrow below within 2 m (plain ${J.arrow} m, perfect ${J.arrowPerfect} m, plus the double jump refreshed by every bounce and the ${C.hitboxHeight} m head-bump hitbox); trampoline within 15 m; crate stomp below (${J.crateBounce} m + double jump + head); ` +
      `enemy stomp; a standing surface within 3 m; an authored rail; a mover; a vert ramp within 12 m; own double jump (${J.double} m + head); a surface that appears after a switch. Last comes *crate-chain*: a reachable crate or arrow within 6 m whose bounce carries to the crate base, spread outward from reachable crates. Anything left is *none-found*. ` +
      'Crates within reach are tagged *walk* (resting on ground or on another crate, base no more than 3 m up) or *jump* (unsupported but within 3 m of a standing surface).',
    `- **Explosives and switches.** The blast reach is radius + 0.6 m centre-to-centre (TNT ${C.tntRadius} m, Nitro ${C.nitroRadius} m), as in \`Level.update\`. Arrow and outline crates are immune. ! wiring follows \`Level.activateOutlines\`: shared group ids, or both ungrouped.`,
    '- **Arrows and multi-hit crates.** For each one, the report lists what is above it: crates within its bounce reach (2 m horizontally), fruit, or a surface out of double-jump reach from its floor within 5 m. *gapAnchor* marks arrows over a void or at a drop edge.',
    `- **Skating.** Crate rails are \`level.crateRails\` grouped by run, as derived by "CRATE RUNS ARE RAILS". A second derivation is also counted with every outline materialised. *On rail* means a crate centre within 1 m of an authored rail line (within 2.5 m: near). *Downhill* means route grade ≥ ${T.downhill * 100}% over ±10 m. *After pad* means within ${T.padRunout} m after a speed pad. Plain crates on such stretches are where fast skating (≥ ${C.smashSpeed} m/s) plows through boxes.`,
    `- **Enemies and hazards.** Horizontal distance to an enemy patrol segment ≤ ${T.near} m (vertically within 3 m), and box-to-box distance ≤ ${T.near} m to a crusher, pendulum (swing envelope), mover (travel envelope), crumble, phase pad, boulder lane, fire tiki or angry ball body.`, '');

  lines.push('## Per-level tables', '', '### Inventory, density and checkpoint sections', '',
    mdTable(['Level', 'Course', 'Route m', 'Crates', 'Counted', 'CPs', 'Counted /100 m', 'CP gap median / max', 'Kinds', 'Counted crates per section (start → gate)'],
      levels.map(lv => { const s = lv.summary;
        return [`\`${lv.id}\``, lv.title, Math.round(lv.route.length), s.physical, s.counted, s.checkpoints, s.per100m, `${r1(median(s.checkpointGaps))} / ${r1(Math.max(...s.checkpointGaps))}`,
          kindText(s.byKind, s.outlineByKind), lv.sections.map(x => x.counted).join(' · ')]; })), '',
    '### Clusters, support and reach', '',
    mdTable(['Level', 'Collectible clusters', 'Singles', 'Mean size', 'Max stack', 'Largest', 'Arrangements', 'Floating crates', 'Over void', 'Near drop', 'Above reach (served by)', 'On / off / detour', 'Uncounted-only clusters'],
      levels.map(lv => { const s = lv.summary;
        return [`\`${lv.id}\``, s.clusters, frac(s.singles, s.clusters), s.meanClusterSize, s.maxStack, s.largestCluster, topOf(s.arrangements, 4), s.floatingCrates, s.overVoid, s.nearDrop,
          s.high ? `${s.high} (${topOf(s.highTools, 4)})` : 0, `${s.onPath} / ${s.offLine} / ${s.detour}`, s.structuralClusters ? `${s.structuralClusters} (${s.structuralCrates} crates, ≤ ${s.maxStackAll} high)` : '—']; })), '',
    '### Explosives, switches, tools and skating', '',
    mdTable(['Level', 'TNT', 'Nitro', 'Green ! (m before gate)', 'Explosive clusters (mixed)', 'TNT with crates in blast', 'Switches → outlines', 'Arrows (targets)', 'Multi-hit', 'Crate rails: runs / crates / longest / over gaps', 'On / near rail', 'Downhill / after pad', 'Near enemy', 'Near hazard'],
      levels.map(lv => { const s = lv.summary, e = lv.explosives;
        return [`\`${lv.id}\``, e.tnt, e.nitro, e.greens.map(g => `${g.toGate}${g.systemic ? ' (derived)' : ''}`).join(', '), `${e.clusters} (${e.mixedClusters})`, e.tntWithNeighbours,
          lv.switches.length ? `${lv.switches.length} → ${lv.switches.reduce((a, x) => a + x.outlines, 0)} crates, ${lv.switches.reduce((a, x) => a + x.surfaces, 0)} surfaces` : 0,
          s.arrows ? `${s.arrows} (${topOf(s.arrowTargets, 4)})` : 0, s.multihit, `${s.runs} / ${s.runCrates} / ${s.longestRun} / ${s.runsBridging}`, `${s.onRail} / ${s.nearRail}`,
          `${s.downhill} / ${s.afterPad}`, s.enemyNear, topOf(s.hazardNear, 3)]; })), '');

  const row = (label, f) => [label, f(A), f(P)];
  const hist = (m, keys) => keys.filter(k => m[k]).map(k => `${k}: ${m[k]}`).join(', ') || '—';
  lines.push('## Aggregate statistics', '', mdTable(['Measure', `Campaign (${A.levels} courses)`, `Puzzle trilogy (${P.levels})`], [
    row('Crates (counted) + checkpoints', a => `${a.physical} (${a.counted}) + ${a.checkpoints}`),
    row('Counted crates per 100 m: median (range)', a => `${a.per100m.median} (${a.per100m.min}–${a.per100m.max})`),
    row('Checkpoint gap: median (range) m', a => `${a.checkpointGap.median} (${a.checkpointGap.min}–${a.checkpointGap.max})`),
    row('Collectible clusters / singles', a => `${a.clusters} / ${frac(a.singles, a.clusters)}`),
    row('Cluster size histogram', a => hist(a.sizeHist, ['1', '2', '3', '4', '5-9', '10+'])),
    row('Arrangements', a => topOf(a.arrangements, 10)),
    row('Row/wall/pair orientation', a => topOf(a.orientation, 8)),
    row('Stack height histogram (collectible)', a => Object.entries(a.stackHist).map(([k, v]) => `${k}: ${v}`).join(', ')),
    row('Floating collectible clusters', a => frac(a.floatingClusters, a.clusters)),
    row('Support of solid crates', a => topOf(a.support, 5)),
    row('Over void / near drop', a => `${a.overVoid} / ${a.nearDrop}`),
    row('Target crates above reach (tools)', a => `${a.high} (${topOf(a.highTools, 8)})`),
    row('Counted crates on-path / off-line / detour', a => `${a.route.onPath} / ${a.route.offLine} / ${a.route.detour}`),
    row('Cluster tags', a => topOf(a.tags, 12)),
    row('TNT / Nitro / green ! (authored + derived)', a => `${a.explosives.tnt} / ${a.explosives.nitro} / ${a.explosives.greenAuthored} + ${a.explosives.greenSystemic}`),
    row('Explosive clusters (mixed with rewards)', a => `${a.explosives.explosiveClusters} (${a.explosives.mixedClusters})`),
    row('TNT with crates in blast; reward crates inside any blast', a => `${a.explosives.tntWithNeighbours}; ${a.explosives.rewardsInBlasts}`),
    row('! switches → outline crates (unwired)', a => `${a.switches} → ${a.outlineCrates} (${a.orphanOutlines})`),
    row('Arrow crates (what is above)', a => `${a.arrows} (${topOf(a.arrowTargets, 4)})`),
    row('Multi-hit crates (arrangement, support, what is above)', a => `${a.multihit} (${topOf(Object.entries(a.multihitPlacement ?? {}).reduce((m, [k, v]) => {
      const [arrangement, support, above] = k.split('/'), key = `${arrangement} on ${support}, ${above.replace('above:', '')} above`; m[key] = (m[key] ?? 0) + v; return m; }, {}), 5)})`),
    row('Crate rails: runs / crates', a => `${a.runs} / ${a.runCrates}`),
    row('Crate rail length histogram (crates)', a => hist(a.runLengths, ['2', '3', '4', '5', '6', '7', '8+'])),
    row('Crate rail support / orientation', a => `${topOf(a.runSupport, 3)} / ${topOf(a.runOrientation, 3)}`),
    row('Crates within 1 m / 2.5 m of an authored rail', a => `${a.onRail} / ${a.nearRail}`),
    row('Counted crates on downhill / after speed pad', a => `${a.downhill} / ${a.afterPad}`),
    row('Counted crates near enemies; near hazards', a => `${a.enemyNear}; ${topOf(a.hazardNear, 6)}`),
    row('Patterns', a => topOf(a.patterns, 6)),
  ]), '');

  lines.push('## Notable examples', '', 'Selected by fixed rules (the most extreme instance of each pattern). Positions are crate centres in world metres; "along the route" is progress from the spawn.', '');
  notableExamples(levels, C).forEach((x, i) => lines.push(`${i + 1}. **${x.title}** · \`${x.level}\` (${x.course}), ${x.where}. ${x.text}`));
  lines.push('');

  // Neutral, data-driven pattern summary.
  const share = (a, b) => b ? Math.round(100 * a / b) : 0;
  const dens = camp.filter(l => l.summary.counted).sort((a, b) => b.summary.per100m - a.summary.per100m);
  const spacedRuns = camp.flatMap(l => l.patterns.filter(p => p.type === 'evenly-spaced-singles'));
  const spacedLevels = new Set(camp.filter(l => l.patterns.some(p => p.type === 'evenly-spaced-singles')).map(l => l.id));
  const greensEnd = camp.filter(l => l.explosives.nitro && l.explosives.greens.length && l.explosives.greens.every(g => g.toGate <= 40 && g.nitrosBefore === l.explosives.nitro));
  const most = (key, f) => [...camp].sort((a, b) => f(b) - f(a)).find(l => f(l) > 0);
  const highLevel = most('high', l => l.summary.high), steelLevel = most('steel', l => l.summary.outlineByKind.metal ?? 0);
  const gapRuns = l => l.runs.filter(r => r.support !== 'grounded').length, gapLevel = most('gap', gapRuns);
  const puzzleGreensFirst = puz.length && puz.every(l => l.explosives.greens.every(g => g.nitrosBefore === 0));
  lines.push('## Patterns (summary)', '',
    `- **Singles dominate.** ${share(A.singles, A.clusters)}% of campaign collectible clusters are one crate and ${share(A.sizeHist['2'] ?? 0, A.clusters)}% are two. Larger formations concentrate in a few courses: ${camp.filter(l => l.summary.largestCluster >= 6).map(l => `\`${l.id}\``).join(', ') || 'none'} have clusters of six or more. ` +
      `Evenly spaced runs of single crates occur ${spacedRuns.length} times in ${spacedLevels.size} courses, typically ${r1(median(spacedRuns.map(p => p.spacing)))} m apart.`,
    `- **Density varies by more than an order of magnitude.** The densest courses are ${dens.slice(0, 3).map(l => `\`${l.id}\` (${l.summary.per100m})`).join(', ')} and the sparsest ${dens.slice(-3).map(l => `\`${l.id}\` (${l.summary.per100m})`).join(', ')}, in counted crates per 100 m. ` +
      `${camp.filter(l => !l.summary.physical).length} courses have none. Checkpoints are spaced a median ${A.checkpointGap.median} m apart, and in ${camp.filter(l => l.summary.physical && l.summary.checkpoints >= l.summary.physical).length} courses checkpoint crates equal or outnumber the other crates.`,
    `- **Crates sit on the floor of the main line.** ${share(A.support.ground ?? 0, sum(Object.values(A.support)))}% of solid crates rest on ground and ${share(A.route.onPath, A.counted)}% of counted crates are within ${T.onPath} m of the camera lane. ` +
      `Explicit detours (> ${T.detour} m) hold ${share(A.route.detour, A.counted)}%; ${A.route.behindStart ? `${A.route.behindStart} crates sit behind the start` : 'no crate sits behind the start'}. ` +
      (highLevel ? `Elevated placement is concentrated: ${highLevel.summary.high} of the ${A.high} above-reach target crates are in \`${highLevel.id}\` (served by ${topOf(highLevel.summary.highTools, 3)}).` : 'No target crate is above jump reach.'),
    `- **Few vertical tools.** There are ${A.arrows} arrow crates across the campaign. ${A.arrowTargets.nothing ?? 0} have nothing to reach above them, and the classic arrow-with-crate-above formation appears ${A.arrowTargets.crate ?? 0} times. ` +
      `Multi-hit crates number ${A.multihit}, ${share(camp.flatMap(l => l.multihit).filter(m => m.cluster === 'single').length, A.multihit)}% of them standing alone.`,
    `- **Explosives are sparse and end-cleared.** The campaign holds ${A.explosives.tnt} TNT and ${A.explosives.nitro} Nitro. In ${greensEnd.length} of ${A.explosives.levelsWithNitro} Nitro courses every green ! stands within 40 m of the gate, after all the Nitro it clears ` +
      `(${greensEnd.filter(l => l.explosives.greenSystemic).length} of these are derived by the engine). ${A.explosives.mixedClusters} of ${A.explosives.explosiveClusters} explosive clusters mix in reward crates. ` +
      `${puzzleGreensFirst ? 'The puzzle trilogy instead puts the green ! ahead of each Nitro field' : 'The puzzle trilogy places its green ! crates'}, and mixes explosives with rewards in ${P.explosives.mixedClusters} of ${P.explosives.explosiveClusters} clusters.`,
    `- **Switches build structures as well as reward rows.** ${A.switches} ! switches wire ${A.outlineCrates} outline crates, ${share(A.outlineByKind.metal ?? 0, A.outlineCrates)}% of them steel` +
      `${steelLevel ? ` (${steelLevel.summary.outlineByKind.metal} in \`${steelLevel.id}\`)` : ''}. The rest are small reward rows of ${kindText({}, Object.fromEntries(Object.entries(A.outlineByKind).filter(([k]) => k !== 'metal')))} (switch-to-outline distances in the per-level JSON).`,
    `- **Crate rails come from touching rows.** ${A.runs} derived grind lines exist. ${share(A.runLengths['2'] ?? 0, A.runs)}% are two-crate runs, and ${share((A.runSupport.floating ?? 0) + (A.runSupport['bridges-gap'] ?? 0), A.runs)}% hang over a gap` +
      `${gapLevel ? ` (${gapRuns(gapLevel)} of them in \`${gapLevel.id}\`)` : ''}. ${A.downhill} counted crates sit on ≥ ${T.downhill * 100}% downhills, where fast skating plows through plain boxes. ` +
      `${A.afterPad ? `${A.afterPad} sit within ${T.padRunout} m after a speed pad.` : `No crate is placed within ${T.padRunout} m after a speed pad.`}`,
    `- **The puzzle levels are a different regime.** They run ${P.per100m.overall} counted crates per 100 m against ${A.per100m.overall}, with checkpoints a median ${P.checkpointGap.median} m apart against ${A.checkpointGap.median} m. ` +
      `${P.route.onPath === P.counted ? 'Every counted crate is on the camera line' : `${share(P.route.onPath, P.counted)}% of counted crates are on the camera line`}, and ${P.switches} switches, ${P.arrows} arrows and ${P.explosives.tnt + P.explosives.nitro} explosives are packed into ${Math.round(P.routeKm * 1000)} m.`, '');

  lines.push('## Limitations', '',
    `- The route line is the camera lane${levels.some(l => l.route.method !== 'camnode lane') ? `, or a spawn → checkpoint → gate chain for ${levels.filter(l => l.route.method !== 'camnode lane').map(l => `\`${l.id}\``).join(' and ')}` : ''}, not the walked path. ` +
      'Lateral offsets and the on-path / detour bands are therefore approximate, especially where the lane runs to one side of a wide area. The per-level JSON gives `summary.routeOffset`, the median 3D distance of crates from the lane.',
    '- Reach is a geometric budget (peak heights from `src/tuning.ts`, 2 m / 6 m / 15 m search radii), not a simulation. It ignores run-up speed, air control, charged skate ollies and moving geometry. *none-found* means "nothing detected", not "proven unreachable".',
    '- The state is the level at build time: switches unpressed, spin bridges closed, movers at phase 0, phase pads in their initial state. Outline crates and surfaces are reported separately, and crate rails are also counted with outlines materialised.',
    '- Hidden-from-camera crates were not estimated. Fast sections use route grade and speed pads only; actual skating speed is not simulated.',
    '- Bonus rooms, races, competitions and free-skate parks are outside the scope (see Skipped). Add any level id with `--levels id1,id2`.', '');
  return lines.join('\n');
}

await mkdir(path.dirname(OUT_JSON), { recursive: true });
if (!RENDER_ONLY) await writeFile(OUT_JSON, compactJson(output) + '\n');
await mkdir(path.dirname(OUT_MD), { recursive: true });
await writeFile(OUT_MD, renderReport(output));
log(`wrote ${RENDER_ONLY ? '' : `${path.relative(ROOT, OUT_JSON)} and `}${path.relative(ROOT, OUT_MD)} (${output.levels.length} levels)`);
