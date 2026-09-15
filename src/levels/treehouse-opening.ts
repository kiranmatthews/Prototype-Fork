import * as THREE from "three";
import type { CustomComponent } from "../level";

type Point = [number, number, number];
const C: CustomComponent[] = [];
const G = { house: 8, pipe: 9, ground: 10, backdrop: 6 };
const add = (component: CustomComponent) => C.push(component);
const r = (value: number) => Math.round(value * 100000) / 100000;

function mesh(geometry: THREE.BufferGeometry, p: Point, name: string, group: number,
  color: string, tex = "wood", extra: Partial<CustomComponent> = {}): void {
  add({ t: "mesh", p, nm: name, grp: group, color, tex, solid: false, edgeGrinding: false,
    vertices: Array.from(geometry.attributes.position.array, r),
    normals: Array.from(geometry.attributes.normal.array, r),
    uvs: geometry.attributes.uv ? Array.from(geometry.attributes.uv.array, r) : undefined,
    indices: geometry.index ? Array.from(geometry.index.array) : Array.from({ length: geometry.attributes.position.count }, (_, i) => i), ...extra });
  geometry.dispose();
}

function timber(a: Point, b: Point, width: number, depth: number, name: string, group = G.house): void {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const bevel = Math.min(width, depth) * 0.09;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + bevel, -depth / 2 + bevel);
  shape.lineTo(width / 2 - bevel, -depth / 2 + bevel);
  shape.lineTo(width / 2 - bevel, depth / 2 - bevel);
  shape.lineTo(-width / 2 + bevel, depth / 2 - bevel); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: delta.length() - bevel * 2,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1 });
  geometry.translate(0, 0, bevel);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()));
  mesh(geometry, a, name, group, "#85562e");
}

function rope(a: Point, b: Point, sag: number, name: string, group = G.house, radius = 0.047): void {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b).sub(start);
  const mid = end.clone().multiplyScalar(0.5); mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), mid, end]);
  mesh(new THREE.TubeGeometry(curve, 12, radius, 6, false), a, name, group, "#b58d52", "solid");
}

function railing(points: Point[], name: string, group = G.house): void {
  for (const p of points) {
    timber(p, [p[0], p[1] + 1.22, p[2]], 0.22, 0.24, name + " post", group);
    for (const h of [0.55, 1.06]) {
      const ring = new THREE.TorusGeometry(0.145, 0.031, 5, 12).rotateX(Math.PI / 2);
      mesh(ring, [p[0], p[1] + h, p[2]], name + " rope lashing", group, "#b58d52", "solid");
    }
  }
  for (let i = 1; i < points.length; i++) for (const h of [0.55, 1.06])
    rope([points[i - 1][0], points[i - 1][1] + h, points[i - 1][2]],
      [points[i][0], points[i][1] + h, points[i][2]], 0.10, name + " rope", group);
}

const treeCenter: Point = [-17, 0, -6];
const houseYaw = -10;
const houseAngle = THREE.MathUtils.degToRad(houseYaw);
export function openingHousePoint(p: Point): Point {
  const x = p[0] - treeCenter[0], z = p[2] - treeCenter[2];
  return [r(treeCenter[0] + Math.cos(houseAngle) * x + Math.sin(houseAngle) * z), p[1],
    r(treeCenter[2] - Math.sin(houseAngle) * x + Math.cos(houseAngle) * z)];
}

// One continuous surface owns the opening floor. Vertex tint blends dirt into planting
// without coplanar grass/path/apron rectangles or transparent ground decals.
const vertices: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
const nx = 80, nz = 40, x0 = -35, z0 = -28, dx = 1.25, dz = 1.5;
const trail = [[-33, 16], [20, 16], [29, 12], [35, 3], [35, -24]];
function distanceToTrail(x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], vx = b[0] - a[0], vz = b[1] - a[1];
    const t = THREE.MathUtils.clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz), 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - t * vx, z - a[1] - t * vz));
  }
  return best;
}
for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
  const x = x0 + ix * dx, z = z0 + iz * dz;
  vertices.push(x, 0, z); uvs.push(x / 9, z / 9);
  const noise = Math.sin(x * 0.81 + z * 0.24) * 0.45 + Math.sin(z * 1.03 - x * 0.33) * 0.25;
  const trailDistance = Math.min(distanceToTrail(x, z), Math.hypot((x - 14) * 0.62, (z - 0) * 0.8) - 2,
    Math.hypot((x + 11) * 0.7, (z - 8) * 0.8) - 2);
  const grass = THREE.MathUtils.smoothstep(trailDistance + noise, 4.7, 8.2);
  const color = new THREE.Color("#c2a478").lerp(new THREE.Color("#52673d"), grass);
  color.multiplyScalar(0.97 + Math.sin(x * 0.32 + z * 0.48) * 0.03);
  colors.push(color.r, color.g, color.b);
}
for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
  const x = x0 + (ix + 0.5) * dx, z = z0 + (iz + 0.5) * dz;
  // The existing forward terrain takes ownership exactly at z=-16.
  if (z < -16 && x >= 30 && x < 40) continue;
  const a = iz * (nx + 1) + ix, b = a + 1, c = a + nx + 1, d = c + 1;
  indices.push(a, c, b, b, c, d);
}
// Adjacent chunks share identical boundary vertices and tint. Each stays
// within the editor's bounded mesh contract; no triangle is duplicated.
for (const rowStart of [0, 20]) {
  const first = rowStart * (nx + 1), count = 21 * (nx + 1), chunkIndices: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const row = Math.floor(Math.min(indices[i], indices[i + 1], indices[i + 2]) / (nx + 1));
    if (row >= rowStart && row < rowStart + 20) chunkIndices.push(indices[i] - first, indices[i + 1] - first, indices[i + 2] - first);
  }
  add({ t: "mesh", p: [0, 0, 0], vertices: vertices.slice(first * 3, (first + count) * 3),
    colors: colors.slice(first * 3, (first + count) * 3), uvs: uvs.slice(first * 2, (first + count) * 2),
    indices: chunkIndices, tex: "dirt", color: "#ffffff", edgeGrinding: false,
    nm: "Continuous painted opening ground " + rowStart, grp: G.ground });
}
add({ t: "platform", p: [-1, -2.25, 0], s: [74, 2, 80], invisible: true,
  edgeGrinding: false, nm: "Opening safety foundation", grp: G.ground });

const houseStart = C.length;
const landings: readonly Point[] = [[-2, 0, 9], [-9, 2.8, 9], [-9, 5.6, 2], [-16, 8.4, 2]];
export const TREEHOUSE_STAIR_LANDINGS = landings.map(openingHousePoint);
for (let i = 0; i < landings.length; i++) {
  const [x, top, z] = landings[i], depth = i === 3 ? 2 : 3;
  add({ t: "platform", p: [x, top - 0.025, z], s: [3.04, 0.05, depth + 0.04], invisible: true,
    edgeGrinding: false, nm: "Treehouse landing support", grp: G.house });
  add({ t: "decor", dkind: "treehouselanding", p: [x, top - 0.32, z], s: [3, 0.32, depth],
    nm: "Separate fitted Meshy landing", grp: G.house });
}
const flights = [
  { p: [-5.5, 0, 9] as Point, yaw: 90 },
  { p: [-9, 2.8, 5.5] as Point, yaw: 0 },
  { p: [-12.5, 5.6, 2] as Point, yaw: 90 },
];
for (const { p, yaw } of flights) {
  add({ t: "ramp", p, len: 4, rise: 2.8, w: 2.4, yaw, invisible: true,
    edgeGrinding: false, nm: "Treehouse stair flight support", grp: G.house });
  add({ t: "decor", dkind: "treehousestairs", p: [...p], s: [2.4, 2.8, 4], yaw,
    nm: "Meshy stair flight wrapping around the trunk", grp: G.house });
  const angle = THREE.MathUtils.degToRad(yaw), across = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const forward = new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));
  for (const side of [-1, 1]) {
    const base = new THREE.Vector3(...p).addScaledVector(across, side * 1.27);
    const points = [-1.7, 0, 1.7].map(t => {
      const q = base.clone().addScaledVector(forward, t); q.y += (t + 2) / 4 * 2.8;
      return q.toArray() as Point;
    });
    railing(points, "Stair rope handrail");
  }
}

add({ t: "decor", dkind: "treehousehost", p: treeCenter, s: [15.5, 15, 10],
  nm: "Rooted forked tree physically supporting the cabin", grp: G.house });
add({ t: "wall", p: [-17, 0, -6], s: [3.2, 8.3, 3.2], invisible: true,
  pts: Array.from({ length: 12 }, (_, i) => [Math.cos(i / 12 * Math.PI * 2) * 1.6, Math.sin(i / 12 * Math.PI * 2) * 1.6]),
  nm: "Supporting trunk collision", grp: G.house });
add({ t: "decor", dkind: "treehousebody", p: [-17, 8.4, -6.1], s: [11.8, 8.1, 8.2],
  nm: "Proportioned detailed Meshy treehouse cabin", grp: G.house });
add({ t: "platform", p: [-17, 8.375, -6.1], s: [10.2, 0.05, 7.8], invisible: true,
  edgeGrinding: false, nm: "Treehouse cabin floor support", grp: G.house });
add({ t: "wall", p: [-17, 8.4, -6.1], s: [9.6, 7.5, 6.8], invisible: true,
  nm: "Treehouse cabin facade collision", grp: G.house });
mesh(new THREE.BoxGeometry(2.1, 2.9, 0.04), [-13.8, 10.25, -5.1], "Warm recessed doorway", G.house,
  "#d58f40", "solid", { emissive: "#a35312" });
add({ t: "decor", dkind: "treehousebalconydeck", p: [-17, 8.05, -0.5], s: [14.5, 0.35, 3],
  nm: "Separate Meshy wraparound balcony deck", grp: G.house });
add({ t: "platform", p: [-17, 8.375, -0.5], s: [14.5, 0.05, 3], invisible: true,
  edgeGrinding: false, nm: "Treehouse balcony support", grp: G.house });
// Front railing leaves a real entrance matching the final stair landing.
railing([[-24.05, 8.4, 0.9], [-20.85, 8.4, 0.9], [-17.6, 8.4, 0.9]], "Balcony outer edge");
railing([[-14.4, 8.4, 0.9], [-11.8, 8.4, 0.9], [-9.95, 8.4, 0.9]], "Balcony outer edge");
railing([[-24.05, 8.4, -1.9], [-24.05, 8.4, 0.9]], "Balcony left return");
railing([[-9.95, 8.4, -1.9], [-9.95, 8.4, 0.9]], "Balcony right return");
for (const x of [-23.2, -18.5, -14, -10.8]) {
  timber([x, 7.95, -7.5], [x, 7.95, 0.8], 0.34, 0.42, "Balcony timber bearer");
  timber([-17, 4.8, -6], [x, 7.95, 0.4], 0.3, 0.38, "Angled timber brace tied into the trunk");
}
for (const [x, top, z] of landings.slice(1)) {
  timber([x - 1.2, 0, z - 1.1], [x - 1.2, top - 0.12, z - 1.1], 0.3, 0.32, "Landing support post");
  timber([-17, Math.max(0.6, top - 2.2), -6], [x, top - 0.25, z], 0.22, 0.28, "Landing brace into tree");
}
// A small hanging lantern replaces the exposed fire plume.
for (const [x, y, z] of [[-12.8, 9.7, -1.2], [-14.8, 4.6, 0.8]] as const) {
  rope([x, y + 0.85, z], [x, y + 0.25, z], 0, "Lantern hanger", G.house, 0.022);
  mesh(new THREE.BoxGeometry(0.35, 0.52, 0.3), [x, y, z], "Warm lantern glass", G.house,
    "#efb45c", "solid", { emissive: "#cc6c15" });
  for (const sx of [-0.22, 0.22]) for (const sz of [-0.19, 0.19])
    timber([x + sx, y - 0.32, z + sz], [x + sx, y + 0.32, z + sz], 0.055, 0.055, "Lantern frame");
  timber([x - 0.27, y + 0.34, z], [x + 0.27, y + 0.34, z], 0.42, 0.1, "Lantern cap");
}
// Transform the entire assembly together so treads, landings and collision
// retain the same joins after its slight reference-camera rotation.
for (const component of C.slice(houseStart)) {
  component.p = openingHousePoint(component.p);
  component.yaw = (component.yaw ?? 0) + houseYaw;
}

// Deep, compact, angled timber halfpipe: a narrow flat, tall transitions and
// a real underside scaffold. Its floor sits 10cm above the clearing.
export const TREEHOUSE_HALFPIPE: CustomComponent = { t: "vertramp", p: [14, 0.1, -0.8],
  len: 5.8, w: 0.9, rise: 4.2, arc: 90, arcSteps: 32, deck: 1.5, vkind: "half", yaw: -20,
  tex: "wood", color: "#bd8b53", nm: "Deep angled timber halfpipe", grp: G.pipe };
add(TREEHOUSE_HALFPIPE);
const pipeAngle = THREE.MathUtils.degToRad(TREEHOUSE_HALFPIPE.yaw!);
const pipePoint = (x: number, y: number, z: number): Point => [
  14 + Math.cos(pipeAngle) * x + Math.sin(pipeAngle) * z, y,
  -0.8 - Math.sin(pipeAngle) * x + Math.cos(pipeAngle) * z];
for (const side of [-1, 1]) {
  const x = side * 5.85;
  railing([-2.7, 0, 2.7].map(z => pipePoint(x, 4.3, z)), "Halfpipe rope deck fence", G.pipe);
  rope(pipePoint(side * 5.1, 4.35, -2.95), pipePoint(side * 5.1, 4.35, 2.95), 0,
    "Rounded timber coping", G.pipe, 0.12);
  for (const z of [-2.2, 2.2]) {
    timber(pipePoint(x, 0, z), pipePoint(x, 4.22, z), 0.38, 0.4, "Halfpipe scaffold upright", G.pipe);
    timber(pipePoint(side * 2.3, 0.1, z), pipePoint(x, 4.15, z), 0.26, 0.3, "Halfpipe diagonal brace", G.pipe);
  }
  timber(pipePoint(x, 0.25, -2.2), pipePoint(x, 4.1, 2.2), 0.22, 0.26, "Halfpipe lateral X brace", G.pipe);
  timber(pipePoint(x, 0.25, 2.2), pipePoint(x, 4.1, -2.2), 0.22, 0.26, "Halfpipe lateral X brace", G.pipe);
}

// The host canopy is a separate fitted Meshy module, leaving the cabin and
// load-bearing trunk visible. Peripheral trees never enter the roof volume.
add({ t: "decor", dkind: "treehousecanopy", p: [-18, 16.7, -7], s: [31, 11, 24], yaw: -8,
  nm: "Separate canopy above the treehouse roof", grp: G.house });
for (const [x, z, size, yaw] of [[-31, -10, 23, 35], [28, -9, 24, 195], [24, 10, 22, -35]] as const)
  add({ t: "decor", dkind: "treehousetree", p: [x, 0, z], s: [size, size, size * 0.82], yaw,
    color: "#cad4c4", nm: "Framing jungle tree", grp: G.ground });
for (const [x, z, size] of [[-30, 7, 1.4], [-24, 9, 1.1], [-26, -1, 1.35], [-9, -4, 0.9],
  [-4, 4, 1.0], [1, 3, 0.8], [6, -6, 1.2], [21, -9, 1.1], [24, 7, 1],
  [-28, 23, 1.15], [28, 24, 1.2], [-17, 8, 0.6], [-4, 10, 0.55]] as const)
  add({ t: "decor", dkind: "treehousebush", p: [x, 0, z], w: size, yaw: x * 17,
    color: "#b8d0b7", nm: "Planted understory clump", grp: G.ground });
for (const [i, x] of [-26, -20, -12, -5, 2, 9, 17, 24].entries())
  add({ t: "decor", dkind: "treehousebush", p: [x, 0, -18 + Math.sin(i * 2.3) * 2],
    s: [7.5, 3.5, 6], yaw: i * 71, color: "#7f9f87", nm: "Layered rear undergrowth", grp: G.ground });
for (const [x, z, size] of [[-26, 8, 2.8], [-22.8, 9, 1.6], [24, -3, 1.8]] as const)
  add({ t: "rock", p: [x, 0.45, z], s: [size, 1.5, size * 0.8], color: "#6f8987", seed: x * x,
    edgeGrinding: false, nm: "Mossy opening stones", grp: G.ground });
add({ t: "decor", dkind: "treehousemattefar", p: [25, -205, -185], s: [960, 400, 1],
  nm: "Distant painted jungle and sky", grp: G.backdrop });
add({ t: "decor", dkind: "treehousemattemid", p: [-10, -3, -40], s: [80, 33.33, 1],
  nm: "Midground painted canopy layer", grp: G.backdrop });

export const TREEHOUSE_OPENING_COMPONENTS = C;
