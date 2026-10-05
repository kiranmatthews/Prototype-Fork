import * as THREE from 'three';
import type { CustomComponent } from '../level';

type P = [number, number, number];
type OutlinePoint = { x: number; z: number; nx: number; nz: number; distance: number; join: number };
type MeshData = { vertices: number[]; indices: number[]; uvs: number[]; colors: number[]; normalPairs?: [number, number][] };
type Section = { half: number; inner: number };
/** Positive/negative authored-axis ends: +Z/-Z on N legs, +X/-X on E legs. */
export interface CarlisleTerrainJoins { near: boolean; far: boolean }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { const v = clamp(t, 0, 1); return v * v * (3 - 2 * v); };
const round = (v: number) => Math.round(v * 100000) / 100000;
const hash = (value: number) => {
  const h = Math.sin(value * 127.1 + 311.7) * 43758.5453123;
  return h - Math.floor(h);
};
const noise = (value: number, seed: number) => {
  const cell = Math.floor(value), t = smooth(value - cell);
  return lerp(hash(cell + seed * 13.71), hash(cell + 1 + seed * 13.71), t);
};
const emptyMesh = (): MeshData => ({ vertices: [], indices: [], uvs: [], colors: [] });

function vertex(mesh: MeshData, p: P, uv: [number, number], color: P): number {
  const id = mesh.vertices.length / 3;
  mesh.vertices.push(...p); mesh.uvs.push(...uv); mesh.colors.push(...color);
  return id;
}

/** All three authoring meshes have baked, smooth normals and metre-scaled UVs.
 * There is no retained Three object or per-frame procedural work. */
function componentMesh(source: CustomComponent, data: MeshData, name: string,
  tex: string, solid: boolean): CustomComponent {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  const normalAttribute = geometry.getAttribute('normal');
  for (const [first, second] of data.normalPairs ?? []) {
    const normal = new THREE.Vector3(normalAttribute.getX(first) + normalAttribute.getX(second),
      normalAttribute.getY(first) + normalAttribute.getY(second), normalAttribute.getZ(first) + normalAttribute.getZ(second)).normalize();
    normalAttribute.setXYZ(first, normal.x, normal.y, normal.z);
    normalAttribute.setXYZ(second, normal.x, normal.y, normal.z);
  }
  const normals = Array.from(geometry.getAttribute('normal').array).map(round);
  geometry.dispose();
  return {
    t: 'mesh', p: [...source.p], s: [1, 1, 1], yaw: source.yaw,
    vertices: data.vertices.map(round), indices: data.indices,
    normals, uvs: data.uvs.map(round), colors: data.colors.map(round),
    tex, color: '#ffffff', solid, nm: name,
    grp: solid ? source.grp : 93, cameraCutaway: source.cameraCutaway,
    ...(solid ? {
      edgeGrinding: source.edgeGrinding, slip: source.slip, iceGrip: source.iceGrip,
      outline: source.outline, outOfBounds: source.outOfBounds, lethal: source.lethal,
      gravityTrack: source.gravityTrack, skateCamera: source.skateCamera,
    } : { edgeGrinding: false, castShadow: false }),
  };
}

/** Extra samples near the ends resolve the round caps without subdividing the
 * whole (sometimes 120 m long) central support into a fine uniform grid. */
function axisSamples(half: number, spacing: number): number[] {
  const cells = Math.max(2, Math.ceil(half * 2 / spacing));
  const values = Array.from({ length: cells + 1 }, (_, i) => lerp(-half, half, i / cells));
  if (half > 1.2) for (const end of [-1, 1]) for (const inset of [.4, .85])
    values.push(end * (half - inset));
  return Array.from(new Set(values.map(round))).sort((a, b) => a - b);
}

function laneSamples(values: number[], innerHalf: number, originalHalf: number): number[] {
  // Explicit anchors bound the flat entry/exit strip. Without these, one
  // coarse triangle could interpolate from its middle into a bevelled corner
  // before reaching the edge of the practical 1.5 m centre lane.
  const lane = Math.min(2, originalHalf * .376) * innerHalf / originalHalf;
  return Array.from(new Set([...values, -lane, 0, lane].map(round))).sort((a, b) => a - b);
}

/** A rounded rectangle first, then long concave bites and smaller chipped
 * scallops over its entire perimeter. It stays inside the native footprint;
 * centre strips at course joins retain the authored extent and top height. */
function shelfOutline(core: P[], hx: number, hz: number, cx: number, cz: number,
  shoulder: number, seed: number, joinAxis: 'x' | 'z', sectionAt: (along: number) => Section,
  turnPad: boolean, joins: CarlisleTerrainJoins, incomingOffset?: number): OutlinePoint[] {
  const radius = Math.min(1.6, shoulder * 1.02, hx * .34, hz * .34);
  const ideal = core.map(([x, , z]) => {
    const along = joinAxis === 'z' ? z : x;
    const section = sectionAt(along);
    let ox = joinAxis === 'z' ? x * section.half / section.inner : x * hx / cx;
    let oz = joinAxis === 'x' ? z * section.half / section.inner : z * hz / cz;
    const sectionEnd = sectionAt(joinAxis === 'z' ? oz : ox);
    if (joinAxis === 'z') ox *= sectionEnd.half / section.half;
    else oz *= sectionEnd.half / section.half;
    const boundX = joinAxis === 'z' ? sectionEnd.half : hx;
    const boundZ = joinAxis === 'x' ? sectionEnd.half : hz;
    const capAlong = joinAxis === 'z' ? oz : ox;
    const joined = capAlong >= 0 ? joins.near : joins.far;
    const crossHalf = joinAxis === 'z' ? boundX : boundZ;
    const strip = Math.min(1.75, crossHalf * .82);
    const capRadius = Math.min(radius, Math.max(.06, crossHalf - strip - .035));
    const endDistance = (joinAxis === 'z' ? hz : hx) - Math.abs(capAlong);
    const localRadius = joined ? radius : lerp(radius, capRadius, 1 - smooth(endDistance / Math.max(.2, radius * 1.7)));
    const dx = Math.max(0, Math.abs(ox) - (boundX - localRadius));
    const dz = Math.max(0, Math.abs(oz) - (boundZ - localRadius));
    if (dx > 0 && dz > 0) {
      const length = Math.hypot(dx, dz);
      ox = Math.sign(ox) * (boundX - localRadius + localRadius * dx / length);
      oz = Math.sign(oz) * (boundZ - localRadius + localRadius * dz / length);
    }
    return { x: ox, z: oz };
  });
  let distance = 0;
  return ideal.map((point, i) => {
    const before = ideal[(i + ideal.length - 1) % ideal.length], after = ideal[(i + 1) % ideal.length];
    if (i > 0) distance += Math.hypot(point.x - ideal[i - 1].x, point.z - ideal[i - 1].z);
    const tangent = new THREE.Vector2(after.x - before.x, after.z - before.z).normalize();
    const nx = -tangent.y, nz = tangent.x;
    const across = joinAxis === 'z' ? Math.abs(point.x) : Math.abs(point.z);
    // Classify the cap from its authored grid edge, not its eventual normal.
    // A shoulder's curved neighbour can turn that normal even though this
    // vertex still lies on the exact entry/exit plane.
    const onTravelCap = joinAxis === 'z' ? Math.abs(Math.abs(core[i][2]) - cz) < .00002
      : Math.abs(Math.abs(core[i][0]) - cx) < .00002;
    const along = joinAxis === 'z' ? point.z : point.x;
    const joined = along >= 0 ? joins.near : joins.far;
    const joinWidth = joined ? Math.min(2.5, (joinAxis === 'z' ? hx : hz) * .47)
      : Math.min(1.75, sectionAt(Math.sign(along) * (joinAxis === 'z' ? hz : hx)).half * .82);
    let join = onTravelCap ? smooth((joinWidth + .6 - across) / .6) : 0;
    if (incomingOffset !== undefined && onTravelCap && point.z > 0)
      join = Math.max(join, smooth((2.1 - Math.abs(point.x - incomingOffset)) / .6));
    if (turnPad) {
      const otherAcross = joinAxis === 'z' ? Math.abs(point.z) : Math.abs(point.x);
      const otherWidth = Math.min(2.5, (joinAxis === 'z' ? hz : hx) * .47);
      const inner = sectionAt(joinAxis === 'z' ? core[i][2] : core[i][0]).inner;
      const onTurnCap = Math.abs(Math.abs(joinAxis === 'z' ? core[i][0] : core[i][2]) - inner) < .00002;
      if (onTurnCap) join = Math.max(join, smooth((otherWidth + .6 - otherAcross) / .6));
    }
    const broadBite = Math.pow(noise(distance / 7.4, seed + 4), 2.4);
    const chips = noise(distance / 1.65, seed + 19);
    const localShoulder = sectionAt(joinAxis === 'z' ? point.z : point.x).half -
      sectionAt(joinAxis === 'z' ? point.z : point.x).inner;
    const recess = Math.min(localShoulder * .80, (.16 + .9 * broadBite + .35 * chips) * shoulder / 1.6) * (1 - join);
    return { x: point.x - nx * recess, z: point.z - nz * recess, nx, nz, distance, join };
  });
}

function stoneColor(depth: number, distance: number, seed: number, groove = false): P {
  // Colour is linear RGB, as expected by Three vertex colours. Warm exposed
  // ridges, cool occluded fissures and the lower root shade are all baked.
  const variation = lerp(.91, 1.06, noise(distance / 3.3, seed));
  const shade = (groove ? .61 : lerp(1, .70, depth)) * variation;
  return [.66 * shade, .57 * shade, .39 * shade];
}

function mossColor(x: number, z: number, seed: number, edge: boolean): P {
  const patch = noise(x * .38 + z * .19, seed + 17);
  const light = lerp(.77, 1.03, patch) * (edge ? .87 : 1);
  return [.41 * light, .53 * light, .18 * light];
}

/** One lobe is a rounded, irregular, six-sided sandstone block, never a box.
 * All lobes are baked into one dressing mesh. Their horizontal bounds are
 * clipped to the existing course footprint so they cannot cover a jump gap. */
function rockLobe(mesh: MeshData, centre: P, tangent: [number, number],
  radii: P, hx: number, hz: number, seed: number, topAt: (z: number) => number,
  shadeDepth: number): void {
  const sections = 6, first = mesh.vertices.length / 3;
  const normal: [number, number] = [-tangent[1], tangent[0]];
  const rings = [
    { y: -.5, scale: .67 }, { y: -.34, scale: 1 },
    { y: .28, scale: .98 }, { y: .5, scale: .61 },
  ];
  for (let ring = 0; ring < rings.length; ring++) for (let j = 0; j < sections; j++) {
    const angle = j / sections * Math.PI * 2 + .22;
    const wobble = lerp(.87, 1.13, hash(seed + j * 3.7 + ring * .61));
    const along = Math.cos(angle) * radii[0] * rings[ring].scale * wobble;
    const across = Math.sin(angle) * radii[2] * rings[ring].scale * wobble;
    const x = clamp(centre[0] + tangent[0] * along + normal[0] * across, -hx + .015, hx - .015);
    const z = clamp(centre[2] + tangent[1] * along + normal[1] * across, -hz + .015, hz - .015);
    const y = topAt(z) + centre[1] + rings[ring].y * radii[1] + (hash(seed + j) - .5) * .12;
    vertex(mesh, [x, y, z], [along / 3.1, y / 3.1], stoneColor(shadeDepth, j * .8, seed));
  }
  for (let ring = 0; ring < rings.length - 1; ring++) for (let j = 0; j < sections; j++) {
    const a = first + ring * sections + j, b = first + ring * sections + (j + 1) % sections;
    const c = a + sections, d = b + sections;
    mesh.indices.push(a, c, b, b, c, d);
  }
  // Flat fan caps are inside the bevel ring, away from the visible silhouette.
  const bottom = vertex(mesh, [centre[0], topAt(centre[2]) + centre[1] - radii[1] * .5, centre[2]],
    [centre[0] / 3.1, centre[2] / 3.1], stoneColor(shadeDepth, 0, seed));
  const top = vertex(mesh, [centre[0], topAt(centre[2]) + centre[1] + radii[1] * .5, centre[2]],
    [centre[0] / 3.1, centre[2] / 3.1], stoneColor(shadeDepth, 0, seed));
  for (let j = 0; j < sections; j++) {
    mesh.indices.push(bottom, first + j, first + (j + 1) % sections);
    const a = first + (rings.length - 1) * sections + j;
    const b = first + (rings.length - 1) * sections + (j + 1) % sections;
    mesh.indices.push(top, b, a);
  }
}

/** Replaces native supported decks with an actual sculpted solid. The central
 * grid and course joins have the exact original top plane, including ramp
 * tilt. The edge collar, rounded ends and tapered three-course root are part
 * of that same collision mesh; there is no hidden rectangular ground slab.
 * Solids stay below 3,200 triangles. Two visual meshes hold the broken
 * grass skin/fringe and merged fractured blocks. Everything is source data. */
export function buildCarlisleRockTerrain(component: CustomComponent, index: number,
  protectedPoints: readonly P[] = [], joins: CarlisleTerrainJoins = { near: true, far: true }): {
  surfaces: CustomComponent[]; dressing: CustomComponent[];
} {
  if ((component.t !== 'platform' && component.t !== 'ramp') || component.invisible ||
    component.tex === 'wood' || component.pts || (component.t === 'platform' && !component.s))
    return { surfaces: [component], dressing: [] };
  const ramp = component.t === 'ramp';
  const width = ramp ? component.w ?? 12 : component.s![0];
  const length = ramp ? component.len ?? 12 : component.s![2];
  if (width < 1 || length < 1) return { surfaces: [component], dressing: [] };
  const hx = width / 2, hz = length / 2, seed = index * 7.31 + 21;
  const shoulder = Math.min(1.65, hx * .27, hz * .27);
  const cx = hx - shoulder, cz = hz - shoulder;
  const xs = laneSamples(axisSamples(cx, 2.05), cx, hx);
  const zs = laneSamples(axisSamples(cz, 3.15), cz, hz);
  if (index === 48) {
    // This turn landing is centred at world X 4, while the approaching N
    // corridor is centred at X 0. Anchor its actual incoming lane explicitly.
    xs.push(...[-5.5, -4, -2.5].map(x => round(x * cx / hx)));
    xs.sort((a, b) => a - b);
  }
  const topAt = ramp ? (z: number) => (component.rise ?? 3) * (.5 - z / length)
    : (_z: number) => component.s![1] / 2;
  const originalDepth = ramp ? 1 : component.s![1];
  // A short, broad landing is still an N-travel pad. Only the authored
  // side-scroll crossing runs along X; inferring direction from aspect ratio
  // would erode the Z takeoff/landing strip on pads such as original #12.
  const joinAxis: 'x' | 'z' = index >= 49 && index <= 56 ? 'x' : 'z';
  const halfAcross = joinAxis === 'z' ? hx : hz, halfAlong = joinAxis === 'z' ? hz : hx;
  const yaw = THREE.MathUtils.degToRad(component.yaw ?? 0), cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const localPoints = protectedPoints.flatMap(point => {
    const dx = point[0] - component.p[0], dz = point[2] - component.p[2];
    const x = dx * cosine - dz * sine, z = dx * sine + dz * cosine;
    const along = joinAxis === 'z' ? z : x, across = joinAxis === 'z' ? x : z;
    return Math.abs(along) <= halfAlong + .8 && Math.abs(across) <= halfAcross + .8
      ? [{ along, across }] : [];
  });
  const turnPad = index === 48 || index === 56;
  // The N→E landing and E→N exit have two real centre joins. A protected
  // cross-strip opens the secondary join, while the rest of the pad remains
  // scalloped. It adds no support outside the original turn footprint.
  if (turnPad) localPoints.push({ along: 0, across: halfAcross - .79 });
  const sectionAt = (along: number): Section => {
    // The quiet centre ribbon is typically half the former runway width.
    // Broad local bulges protect authored crates, enemies and checkpoints.
    const nearEnd = along >= 0;
    const joined = nearEnd ? joins.near : joins.far;
    const taper = joined ? 1 - smooth((halfAlong - Math.abs(along) - .8) / 3.2) : 0;
    const narrow = halfAcross * (.50 + .18 * noise(along / 9.4, seed + 8));
    let half = lerp(narrow, halfAcross, taper), protectedInner = 0;
    for (const point of localPoints) {
      // Cover both neighbouring grid rows at full width. This keeps a 75 cm
      // support radius at the authored point even between 3 m sample rows.
      const weight = 1 - smooth((Math.abs(point.along - along) - 2.7) / 2.8);
      const required = (Math.abs(point.across) + .79) * weight;
      protectedInner = Math.max(protectedInner, required);
      half = Math.max(half, Math.min(halfAcross, required + Math.min(.75, shoulder)));
    }
    const centralLane = Math.min(1.55, halfAcross * .34);
    const rim = Math.min(shoulder, Math.max(.035, half - protectedInner), half - centralLane);
    return { half, inner: Math.max(.22, half - rim) };
  };
  const capFraction = (value: number, along: number): number => {
    const innerAlong = joinAxis === 'z' ? cz : cx;
    if (Math.abs(Math.abs(along) - innerAlong) > .00002 || (along >= 0 ? joins.near : joins.far)) return value;
    const endHalf = sectionAt(Math.sign(along) * halfAlong).half;
    const oldAnchor = Math.min(2, halfAcross * .376) / halfAcross;
    const newAnchor = Math.min(1.75, endHalf * .82) / endHalf;
    const abs = Math.abs(value);
    // Move the existing lane anchors on this cap only; the monotonic mapping
    // preserves all tessellation and avoids adding whole-grid subdivisions.
    return Math.sign(value) * (abs <= oldAnchor ? abs * newAnchor / oldAnchor
      : newAnchor + (abs - oldAnchor) * (1 - newAnchor) / (1 - oldAnchor));
  };
  const broadShelf = Math.min(width, length) >= 8 && Math.max(width, length) >= 20;
  const depth = Math.max(originalDepth, broadShelf ? 8.2 + hash(seed) * .8
    : Math.max(width, length) > 20 ? 5.5 : Math.min(3.6, Math.min(width, length) * .61));
  const rock = emptyMesh(), moss = emptyMesh(), blocks = emptyMesh();
  rock.normalPairs = [];
  const grid: number[][] = [], mossGrid: number[][] = [];
  for (const z of zs) {
    const row: number[] = [], mossRow: number[] = [];
    for (const x of xs) {
      const section = sectionAt(joinAxis === 'z' ? z : x);
      const gx = joinAxis === 'z' ? capFraction(x / cx, z) * section.inner : x;
      const gz = joinAxis === 'x' ? capFraction(z / cz, x) * section.inner : z;
      row.push(vertex(rock, [gx, topAt(gz), gz], [gx / 3.1, gz / 3.1], stoneColor(0, gx + gz, seed)));
      mossRow.push(vertex(moss, [gx, topAt(gz) + .003, gz], [(gx + component.p[0]) / 4.4, (gz + component.p[2]) / 4.4], mossColor(gx, gz, seed, false)));
    }
    grid.push(row); mossGrid.push(mossRow);
  }
  for (let z = 0; z < zs.length - 1; z++) for (let x = 0; x < xs.length - 1; x++) {
    const a = grid[z][x], b = grid[z][x + 1], c = grid[z + 1][x], d = grid[z + 1][x + 1];
    rock.indices.push(a, c, b, b, c, d); moss.indices.push(a, c, b, b, c, d);
  }
  const border: number[] = [];
  for (let x = 0; x < xs.length - 1; x++) border.push(grid[zs.length - 1][x]);
  for (let z = zs.length - 1; z > 0; z--) border.push(grid[z][xs.length - 1]);
  for (let x = xs.length - 1; x > 0; x--) border.push(grid[0][x]);
  for (let z = 0; z < zs.length - 1; z++) border.push(grid[z][0]);
  const core = border.map(i => rock.vertices.slice(i * 3, i * 3 + 3) as P);
  const outline = shelfOutline(core, hx, hz, cx, cz, shoulder, seed, joinAxis, sectionAt, turnPad, joins, index === 48 ? -4 : undefined);
  const freeStrength = (point: OutlinePoint): number => {
    const along = joinAxis === 'z' ? point.z : point.x;
    const nearEnd = along >= 0;
    if (nearEnd ? joins.near : joins.far) return 0;
    return 1 - smooth((halfAlong - Math.abs(along) - 1.1) / 3);
  };
  const bodyPoint = (point: OutlinePoint, fraction: number, inset: number): [number, number] => {
    let x = point.x - point.nx * inset, z = point.z - point.nz * inset;
    const strength = freeStrength(point);
    if (strength > 0) {
      const along = joinAxis === 'z' ? point.z : point.x, across = joinAxis === 'z' ? point.x : point.z;
      const normalAcross = joinAxis === 'z' ? point.nx : point.nz;
      const actualHalf = sectionAt(along).half;
      const lobes = 3 + (hash(seed + 41) > .48 ? 1 : 0);
      const ridge = Math.cos((across / Math.max(.3, actualHalf) + 1) * Math.PI * lobes + seed * .11);
      const setback = Math.min(halfAlong * .62, (1.55 + .75 * ridge) * lerp(.50, 1, smooth(fraction / .65)));
      const sculptedAcross = across * (1 - .60 * fraction) - normalAcross * inset * (1 - fraction);
      const sculptedAlong = along - Math.sign(along) * setback;
      if (joinAxis === 'z') { x = lerp(x, sculptedAcross, strength); z = lerp(z, sculptedAlong, strength); }
      else { z = lerp(z, sculptedAcross, strength); x = lerp(x, sculptedAlong, strength); }
    }
    if (Math.abs(point.x) > .15 && x * point.x <= 0) x = Math.sign(point.x) * .12;
    if (Math.abs(point.z) > .15 && z * point.z <= 0) z = Math.sign(point.z) * .12;
    return [clamp(x, -hx + .008, hx - .008), clamp(z, -hz + .008, hz - .008)];
  };
  let previous = border, previousMoss = [...border];
  // The broad strata are separated by only two narrow inset fissures. The
  // other rings round the rock shoulders and taper the foundation roots.
  const strata = [
    { fraction: .35, drop: -.014, inset: 0, groove: false },
    { fraction: .67, drop: .055, inset: 0, groove: false },
    { fraction: 1, drop: .26, inset: 0, groove: false },
    { fraction: 1, drop: .27 * depth, inset: .28, groove: true },
    { fraction: 1, drop: .51 * depth, inset: .10, groove: false },
    { fraction: 1, drop: .535 * depth, inset: .37, groove: true },
    { fraction: 1, drop: depth, inset: .95, groove: false },
  ];
  const lastMoss: number[] = [];
  for (let ring = 0; ring < strata.length; ring++) {
    const profile = strata[ring], current: number[] = [], currentMoss: number[] = [];
    for (let j = 0; j < outline.length; j++) {
      const point = outline[j], inner = core[j];
      const stratification = noise(point.distance / 3.1, seed + Math.floor(ring / 3) * 8);
      const inset = ring < 3 ? 0 : profile.inset + (.15 + .18 * ring / strata.length) * stratification;
      const boundInset = ring < 3 && point.join > .99 ? 0 : .008;
      let x = clamp(lerp(inner[0], point.x, profile.fraction) - point.nx * inset, -hx + boundInset, hx - boundInset);
      let z = clamp(lerp(inner[2], point.z, profile.fraction) - point.nz * inset, -hz + boundInset, hz - boundInset);
      if (ring >= 3) [x, z] = bodyPoint(point, clamp(profile.drop / depth, 0, 1), inset);
      // Narrow ribbons still need a real foundation. A deep inward ring must
      // never cross the centre and invert the two opposite rock faces.
      if (ring > 3) {
        if (Math.abs(point.x) > .15 && x * point.x <= 0) x = Math.sign(point.x) * .12;
        if (Math.abs(point.z) > .15 && z * point.z <= 0) z = Math.sign(point.z) * .12;
      }
      const relief = ring < 3 ? (noise(point.distance / 1.8, seed + 7) - .5) * .032
        : (stratification - .5) * Math.min(.27, depth * .06);
      const drop = ring < 3 ? profile.drop * (1 - point.join) : profile.drop;
      const y = topAt(z) - drop + relief * (1 - point.join);
      current.push(vertex(rock, [x, y, z], ring < 3 ? [x / 3.1, z / 3.1]
        : [point.distance / 3.1, y / 3.1], stoneColor(profile.drop / depth, point.distance, seed, profile.groove)));
      if (ring < 2) currentMoss.push(vertex(moss, [x, y + .003, z],
        [(x + component.p[0]) / 4.4, (z + component.p[2]) / 4.4], mossColor(x, z, seed, ring === 1)));
      if (ring === 2) lastMoss.push(vertex(moss, [clamp(x + point.nx * .024, -hx, hx),
        y - .03 - .13 * hash(seed + j * 11), clamp(z + point.nz * .024, -hz, hz)],
        [(x + component.p[0]) / 4.4, (z + component.p[2]) / 4.4], mossColor(x, z, seed, true)));
    }
    const subcrest: (number | undefined)[] = [];
    if (ring === 3) for (let j = 0; j < outline.length; j++) {
      const point = outline[j];
      if (freeStrength(point) <= .001) continue;
      const [x, z] = bodyPoint(point, .10, .035);
      const y = topAt(z) - depth * .10 + (noise(point.distance / 2.7, seed + 73) - .5) * .08;
      subcrest[j] = vertex(rock, [x, y, z], [point.distance / 3.1, y / 3.1], stoneColor(.1, point.distance, seed));
    }
    for (let j = 0; j < outline.length; j++) {
      const next = (j + 1) % outline.length;
      const a = previous[j], b = previous[next], c = current[j], d = current[next];
      const m = subcrest[j], n = subcrest[next];
      if (m !== undefined && n !== undefined) rock.indices.push(a, m, b, b, m, n, m, c, n, n, c, d);
      else if (m !== undefined) rock.indices.push(a, m, b, b, m, d, m, c, d);
      else if (n !== undefined) rock.indices.push(a, c, n, a, n, b, c, d, n);
      else rock.indices.push(a, c, b, b, c, d);
      if (ring < 2) {
        const ma = previousMoss[j], mb = previousMoss[next], mc = currentMoss[j], md = currentMoss[next];
        moss.indices.push(ma, mc, mb, mb, mc, md);
      } else if (ring === 2 && hash(seed + j * 3.4) > .72) {
        // Opaque torn tongues, rather than a continuous green vertical panel.
        moss.indices.push(previousMoss[j], lastMoss[j], previousMoss[next],
          previousMoss[next], lastMoss[j], lastMoss[next]);
      }
    }
    if (ring === 2) {
      // The cap has X/Z UVs. The vertical rock begins with a geometrically
      // identical ring carrying perimeter/Y UVs, so no wall triangle spans
      // the large cap-to-wall coordinate jump at long shelf ends.
      previous = current.map((original, j) => {
        const p = rock.vertices.slice(original * 3, original * 3 + 3) as P;
        const clone = vertex(rock, p, [outline[j].distance / 3.1, p[1] / 3.1], rock.colors.slice(original * 3, original * 3 + 3) as P);
        rock.normalPairs!.push([original, clone]);
        return clone;
      });
    } else previous = current;
    if (ring < 2) previousMoss = currentMoss;
  }
  const bottom = vertex(rock, [0, topAt(0) - depth, 0], [0, 0], stoneColor(1, 0, seed));
  for (let j = 0; j < previous.length; j++) rock.indices.push(bottom, previous[(j + 1) % previous.length], previous[j]);
  // Staggered stones occupy the two broad exposed courses. Sampling by
  // perimeter distance gives large chunks, not a wall of little masonry tiles.
  let lastDistance = -100;
  for (let j = 0; j < outline.length; j++) {
    const point = outline[j];
    if (point.distance - lastDistance < 9.6 + hash(seed + j) * 3.8) continue;
    lastDistance = point.distance;
    const normal = new THREE.Vector2(point.nx, point.nz);
    const tangent: [number, number] = [normal.y, -normal.x];
    const course = j % 2 ? .40 : .15;
    const inset = .16 + hash(seed + j * 1.3) * .27;
    rockLobe(blocks, [point.x - point.nx * inset, -depth * course, point.z - point.nz * inset], tangent,
      [1.05 + hash(seed + j * 2) * .65, Math.min(1.6, depth * .24), .32 + hash(seed + j * 4) * .19],
      hx, hz, seed + j * 17, topAt, course);
  }
  // Paint the actual top geometry for the two-texture geological material.
  // Cap vertices share the same ordering until the torn hanging tongues.
  for(let i=0;i<moss.vertices.length/3;i++){
    const n=i*3;if(Math.abs(rock.vertices[n]-moss.vertices[n])>1e-5||Math.abs(rock.vertices[n+2]-moss.vertices[n+2])>1e-5||Math.abs(rock.vertices[n+1]+.003-moss.vertices[n+1])>1e-5)break;
    rock.colors.splice(n,3,...moss.colors.slice(n,n+3));
  }
  const surface = componentMesh(component, rock, `Carlisle rock support ${index}`, 'coast-stone', true);
  // Existing authored grind rails remain. Hundreds of tiny procedural bevel
  // edges should not become additional auto-generated grind paths.
  surface.edgeGrinding = false;
  const cap = componentMesh(component, moss, `Carlisle moss cap ${index}`, 'coast-moss', false);
  cap.depthBias = -1;
  return {
    surfaces: [surface],
    dressing: [cap,
      ...(blocks.indices.length ? [componentMesh(component, blocks, `Carlisle rock courses ${index}`, 'coast-stone', false)] : [])],
  };
}
