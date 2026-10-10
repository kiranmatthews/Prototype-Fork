import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CustomComponent, CustomLevelData } from '../level';
import { ROOM_POSTERS } from './treehouse-room-art';

type Point = [number, number, number];
const C: CustomComponent[] = [];
const G = { shell: 1, furniture: 2, skate: 3, posters: 4, windows: 5, details: 6, play: 7 };
const round = (n: number) => Math.round(n * 100000) / 100000;
function mesh(name: string, geo: THREE.BufferGeometry, p: Point, color: string,
  tex = 'solid', group = G.details, extra: Partial<CustomComponent> = {}) {
  if (!geo.index) { const source = geo; geo = mergeVertices(source, .00001); source.dispose(); }
  C.push({ t: 'mesh', p, nm: name, grp: group, tex, color, solid: false,
    vertices: Array.from(geo.attributes.position.array, round),
    normals: Array.from(geo.attributes.normal.array, round),
    uvs: geo.attributes.uv ? Array.from(geo.attributes.uv.array, round) : undefined,
    indices: geo.index ? Array.from(geo.index.array) : undefined, ...extra });
  geo.dispose();
}
function box(name: string, p: Point, s: Point, color: string, tex = 'solid', group = G.details,
  extra: Partial<CustomComponent> = {}, bevel = .025) {
  const geo = bevel && Math.min(...s) > .07
    ? new RoundedBoxGeometry(...s, 1, Math.min(bevel, ...s.map(n => n / 4))) : new THREE.BoxGeometry(...s);
  if (name === 'Honey cedar floorboard') {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * .14 + ((p[0] + 7) % 3) * .23);
  }
  mesh(name, geo, p, color, tex, group, extra);
}
function beam(name: string, a: Point, b: Point, width: number, depth = width, color = '#a17c53') {
  const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const geo = new THREE.BoxGeometry(width, delta.length(), depth);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()));
  mesh(name, geo, a.map((n, i) => (n + b[i]) / 2) as Point, color, 'room-timber', G.shell);
}
function cylinder(name: string, p: Point, radius: number, height: number, color: string, rotation: Point = [0, 0, 0], top = radius, tex = 'solid', group = G.details) {
  const geo = new THREE.CylinderGeometry(top, radius, height, 16, 1);
  geo.rotateX(rotation[0]); geo.rotateY(rotation[1]); geo.rotateZ(rotation[2]);
  mesh(name, geo, p, color, tex, group);
}
function cord(name: string, points: Point[], color: string, radius = .025) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  mesh(name, new THREE.TubeGeometry(curve, 32, radius, 6, false), [0, 0, 0], color);
}
function artPlane(name: string, p: Point, w: number, h: number, tex: string, yaw = 0, group = G.windows, roll = 0) {
  const geometry = new THREE.PlaneGeometry(w, h);
  geometry.rotateZ(THREE.MathUtils.degToRad(roll));
  mesh(name, geometry, p, '#ffffff', tex, group, { yaw, castShadow: false, fog: false });
}

// One broad continuous collider, with individual raised floorboards for the art.
box('Continuous supported room floor', [-.5, -.24, 0], [13, .48, 12], '#805d3c', 'room-timber', G.shell, { solid: true }, 0);
for (let i = 0; i < 26; i++) {
  const x = -6.75 + i * .5;
  for (let j = 0; j < 3; j++) {
    const z = -4 + j * 4;
    box('Honey cedar floorboard', [x, .018, z], [.488, .036, 3.985], ['#e5c69a', '#d5b284', '#eed1a1', '#c9a77e'][i % 4], 'room-timber', G.shell, {}, 0);
    for (const dz of [-1.84, 1.84]) cylinder('Recessed floor nail', [x + .15, .039, z + dz], .015, .006, '#5c4837');
  }
}

// Interior faces are one-sided. The close room camera can look through the
// exterior of the foreground wall without a runtime visibility special case.
function wallPanel(p: Point, w: number, h: number, yaw = 0) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * h / 3);
  mesh('Interior cedar wall', geo, p, '#eee0c6', 'room-timber', G.shell, { yaw });
}
// Back wall: two separate window openings, with a poster bay between them.
wallPanel([-.5, .65, -6], 13, 1.3);
wallPanel([-.5, 5.65, -6], 13, 1.7);
const gable = new THREE.BufferGeometry();
gable.setAttribute('position', new THREE.Float32BufferAttribute([-7, 6.45, 0, 6, 6.45, 0, -.5, 8.15, 0], 3));
gable.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 4.33, 0, 2.165, .57], 2));
gable.computeVertexNormals();
mesh('Enclosed back gable', gable, [0, 0, -6], '#eee0c6', 'room-timber', G.shell);
for (const [x, w] of [[-6.525, .95], [-.675, 3.75], [5.45, 1.1]] as const) wallPanel([x, 3.05, -6], w, 3.5);
// Left wall: broad workbench window and a smaller opening toward the entrance.
wallPanel([-7, .65, 0], 12, 1.3, 90);
wallPanel([-7, 5.65, 0], 12, 1.7, 90);
for (const [z, w] of [[-5.25, 1.5], [.8, 2.6], [4.9, 2.2]] as const) wallPanel([-7, 3.05, z], w, 3.5, 90);
// Right-hand return: small TV-side window, a skate rack and the open doorway.
wallPanel([6, .65, 0], 12, 1.3, -90);
wallPanel([6, 5.65, 0], 12, 1.7, -90);
wallPanel([6, 3.05, -3], 6, 3.5, -90);
wallPanel([6, 3.05, 4.8], 2.4, 3.5, -90);

// Physical containment stays independent of the intentionally cutaway faces.
for (const [p, s] of [[[-.5, 0, -6.08], [13.3, 8, .18]], [[-7.08, 0, 0], [.18, 8, 12]], [[6.08, 0, 0], [.18, 8, 12]], [[-1.8, 0, 6.08], [10.4, 8, .18]], [[5.97, 0, 10], [.18, 8, 8]], [[3.31, 0, 10], [.18, 8, 8]]] as [Point, Point][])
  C.push({ t: 'wall', p, s, invisible: true, edgeGrinding: false, nm: 'Room boundary', grp: G.play });

// Actual chunky joinery in front of the painted walls.
for (const x of [-6.85, -2.55, 1.1, 5.85]) beam('Back upright', [x, 0, -5.87], [x, 6.45, -5.87], .23);
for (const z of [-5.85, -.55, 2.05, 5.85]) beam('Side upright', [-6.86, 0, z], [-6.86, 6.45, z], .24);
for (const y of [.17, 5.03, 6.32]) {
  beam('Back wall rail', [-7, y, -5.87], [6, y, -5.87], .24);
  beam('Left wall rail', [-6.87, y, -6], [-6.87, y, 6], .24);
}
for (const z of [-5.85, -1.9, 2.1, 5.8]) {
  beam('Pitched roof rafter', [-7, 6.42, z], [-.5, 8.15, z], .25, .32, '#a27a4d');
  beam('Pitched roof rafter', [-.5, 8.15, z], [6, 6.42, z], .25, .32, '#a27a4d');
}
beam('Ridge beam', [-.5, 8.15, -6], [-.5, 8.15, 6], .36, .32);
// The inside of the pitched ceiling; exterior-facing polygons are culled.
for (const side of [-1, 1]) {
  const roof = new THREE.PlaneGeometry(6.73, 12);
  roof.rotateX(Math.PI / 2); roof.rotateZ(-side * Math.atan2(1.73, 6.5));
  mesh('Inside pitched cedar roof', roof, [-.5 + side * 3.25, 7.285, 0], '#b28e62', 'room-timber', G.shell);
}

export const ROOM_WINDOWS = [
  { name: 'bedside bay', p: [-4.3, 3.05, -5.94] as Point, w: 3.5, yaw: 0 },
  { name: 'shoreline bay', p: [3.05, 3.05, -5.94] as Point, w: 3.7, yaw: 0 },
  { name: 'workbench bay', p: [-6.94, 3.05, -2.55] as Point, w: 4.0, yaw: 90 },
  { name: 'entrance casement', p: [-6.94, 3.05, 3.0] as Point, w: 1.8, yaw: 90 },
  { name: 'TV-side casement', p: [5.94, 3.05, 1.8] as Point, w: 3.6, yaw: -90 },
];
for (const win of ROOM_WINDOWS) {
  const angle = THREE.MathUtils.degToRad(win.yaw);
  const at = (x: number, y: number, z = 0): Point => [win.p[0] + x * Math.cos(angle) + z * Math.sin(angle), y, win.p[2] - x * Math.sin(angle) + z * Math.cos(angle)];
  for (const x of [-win.w / 2, win.w / 2]) beam(win.name + ' jamb', at(x, 1.3), at(x, 4.8), .19, .26);
  for (const y of [1.3, 4.8]) beam(win.name + ' lintel', at(-win.w / 2 - .12, y), at(win.w / 2 + .12, y), .21, .3);
  box(win.name + ' deep sill', at(0, 1.3, .12), [win.w + .36, .16, .65], '#cfaa77', 'room-timber', G.shell, { yaw: win.yaw });
}

// Three matte planes per facade: nearby balcony, middle jungle, far coast.
// Real metre separation gives parallax through every opening as the player moves.
for (const [name, p, yaw] of [['back', [-.5, 0, -6], 0], ['left', [-7, 0, 0], 90], ['right', [6, 0, 0], -90]] as [string, Point, number][]) {
  const angle = THREE.MathUtils.degToRad(yaw);
  const at = (depth: number, y: number): Point => [p[0] - Math.sin(angle) * depth, y, p[2] - Math.cos(angle) * depth];
  artPlane(`${name} distant shoreline · 28m`, at(28, 6), 88, 49.5, 'room-shore', yaw);
  artPlane(`${name} middle jungle · 9m`, at(9, 3.5), 39, 21.94, 'room-jungle', yaw);
  artPlane(`${name} balcony balustrade · 1.8m`, at(1.8, 1.65), 21, 7.5, 'room-balustrade', yaw);
}

// A living tree passes through a fitted collar in the boards and roof.
const trunk = new THREE.CylinderGeometry(.53, .87, 8.5, 13, 12);
const vp = trunk.attributes.position;
for (let i = 0; i < vp.count; i++) {
  const y = vp.getY(i), x = vp.getX(i), z = vp.getZ(i), k = 1 + .1 * Math.sin(y * 2.3 + Math.atan2(z, x) * 5);
  vp.setXYZ(i, x * k + Math.sin(y * .4) * .17, y, z * k);
}
trunk.computeVertexNormals();
const trunkUv = trunk.attributes.uv;
for (let i = 0; i < trunkUv.count; i++) trunkUv.setXY(i, trunkUv.getX(i) * 2, trunkUv.getY(i) * 3);
mesh('Living tree through the room', trunk, [-4.85, 4.1, -.95], '#dfd0ac', 'room-bark', G.furniture, { solid: true });
for (const end of [[-6.1, 7.5, -2.9], [-2.7, 8.15, -2.2]] as Point[])
  beam('Tree branch', [-4.85, 5.25, -.95], end, .36, .48, '#69513a');
cylinder('Fitted tree floor collar', [-4.85, .07, -.95], 1.02, .13, '#9b794e', [0, 0, 0], .93, 'room-timber', G.furniture);

// Daybed, mattress, linen folds and mismatched cushions.
box('Low timber daybed', [-3.7, .49, -4.45], [4.5, .62, 2.25], '#a88458', 'room-timber', G.furniture, { solid: true }, .07);
for (const x of [-5.72, -1.7]) for (const z of [-5.34, -3.53]) box('Daybed leg', [x, .24, z], [.2, .48, .2], '#755a3d', 'room-timber');
box('Deep soft mattress', [-3.7, .91, -4.4], [4.38, .39, 2.15], '#c1bfa2', 'solid', G.furniture, { solid: true }, .16);
box('Faded teal duvet', [-3.38, 1.13, -4.37], [3.45, .23, 2.05], '#477c79', 'solid', G.furniture, {}, .11);
box('Duvet hanging over bed', [-3.35, .76, -3.32], [3.4, .85, .15], '#356867', 'solid', G.furniture, {}, .06);
for (let i = 0; i < 15; i++) box('Soft linen fold', [-4.95 + i * .235, .77, -3.24 - .022 * Math.sin(i)], [.065, .73, .045], i % 3 ? '#417370' : '#527f7a', 'solid', G.details, {}, .02);
for (const [x, color, yaw] of [[-5.33, '#e4d7b8', -12], [-4.6, '#bfa680', 11], [-1.93, '#325955', -7]] as [number, string, number][])
  box('Slouched pillow', [x, 1.23, -4.65], [.85, .3, 1.4], color, 'solid', G.furniture, { yaw }, .14);

// A full-depth black CRT, curved glass, separate bezel, vents and controls.
const tv = { x: 2.7, z: -4.36, yaw: 8 };
const ta = THREE.MathUtils.degToRad(tv.yaw);
const tp = (x: number, y: number, z: number): Point => [tv.x + x * Math.cos(ta) + z * Math.sin(ta), y, tv.z - x * Math.sin(ta) + z * Math.cos(ta)];
const tvBox = (name: string, p: Point, s: Point, color: string, bevel = .035) => box(name, tp(...p), s, color, 'solid', G.furniture, { yaw: tv.yaw }, bevel);
box('TV cabinet', [2.7, .66, -4.55], [4.55, 1.3, 1.7], '#ba9767', 'room-timber', G.furniture, { solid: true }, .065);
C.push({ t: 'wall', p: [2.7, 0, -4.55], s: [4.55, 1.3, 1.7], invisible: true, edgeGrinding: false,
  nm: 'TV cabinet body collision', grp: G.furniture });
C.push({ t: 'wall', p: [-3.7, 0, -4.45], s: [4.5, 1.08, 2.25], invisible: true, edgeGrinding: false,
  nm: 'Daybed body collision', grp: G.furniture });
C.push({ t: 'wall', p: [-4.85, 0, -.95], s: [1.38, 8, 1.38], invisible: true, edgeGrinding: false,
  nm: 'Living trunk body collision', grp: G.furniture });
for (const x of [1.05, 2.3, 3.55, 4.55]) box('Cabinet inset panel', [x, .69, -3.679], [1.03, .99, .045], '#c1a170', 'room-timber', G.details, {}, .015);
for (const x of [1.44, 2.69, 3.94]) cylinder('Cabinet dark knob', [x, .83, -3.6], .06, .08, '#3a332a', [Math.PI / 2, 0, 0]);
tvBox('CRT rear housing', [0, 2.14, -.16], [2.15, 1.74, 1.28], '#171a1b', .12);
tvBox('CRT thick black front bezel', [0, 2.18, .54], [2.34, 1.83, .29], '#202728', .10);
tvBox('CRT inset glass surround', [-.15, 2.29, .698], [1.81, 1.36, .07], '#080e11', .08);
const screen = new THREE.PlaneGeometry(1.67, 1.23, 20, 16);
const sp = screen.attributes.position;
for (let i = 0; i < sp.count; i++) sp.setZ(i, .075 * (1 - (sp.getX(i) / .86) ** 2) * (1 - (sp.getY(i) / .64) ** 2));
screen.computeVertexNormals();
mesh('CRT curved blue-green glass', screen, tp(-.15, 2.29, .741), '#9bc6c8', 'room-shore', G.furniture, { yaw: tv.yaw, castShadow: false });
for (let i = 0; i < 12; i++) tvBox('CRT speaker grille', [.955, 1.87 + i * .061, .717], [.17, .022, .01], '#070a0c', 0);
for (const x of [-.75, -.5, -.25, 0]) tvBox('CRT front control', [x, 1.445, .706], [.13, .057, .025], '#51595a', .008);
tvBox('CRT power button', [.86, 1.45, .72], [.15, .1, .04], '#3c4949', .012);
mesh('CRT green power LED', new THREE.SphereGeometry(.024, 8, 6), tp(.64, 1.45, .74), '#9ceb95', 'solid', G.details, { emissive: '#48bf39' });
for (let i = 0; i < 10; i++) tvBox('CRT side ventilation', [1.087, 2.0 + i * .063, -.13], [.012, .022, .78], '#070b0d', 0);
box('Compact game console', [4.38, 1.44, -4.2], [.85, .23, .66], '#777d77', 'solid', G.furniture, {}, .04);
box('Console cartridge slot', [4.38, 1.563, -4.3], [.52, .008, .08], '#272e2d');
box('Wired gamepad', [3.85, 1.46, -3.97], [.55, .14, .33], '#a0a298', 'solid', G.details, { yaw: -18 }, .065);
for (const x of [3.68, 4.02]) cylinder('Gamepad button', [x, 1.535, -3.97], .045, .01, x < 3.8 ? '#313936' : '#966348');
cord('Controller cable', [[3.85, 1.41, -4.1], [3.56, 1.37, -3.7], [4.77, 1.37, -3.72], [4.49, 1.46, -4.28]], '#282e28', .015);

// Separate full-UV artwork over independent paper backs. The small taped
// corners are geometry and survive every image swap.
for (const poster of ROOM_POSTERS) {
  const yaw = THREE.MathUtils.degToRad(poster.yaw);
  artPlane('Poster · ' + poster.id, poster.p, poster.width, poster.height, poster.texture, poster.yaw, G.posters, poster.tilt);
  for (const side of [-1, 1]) {
    const x = side * poster.width * .34, y = poster.p[1] + poster.height * .46;
    box('Poster masking tape', [poster.p[0] + x * Math.cos(yaw) + .012 * Math.sin(yaw), y, poster.p[2] - x * Math.sin(yaw) + .012 * Math.cos(yaw)], [.22, .14, .01], '#d4c493', 'solid', G.posters, { yaw: poster.yaw }, 0);
  }
}

// Actual separate decks, trucks and wheels; every display pose is baked into
// local geometry before using the same data-driven mesh pipeline.
function skateboard(name: string, p: Point, rotation: Point, graphic: string, complete = true) {
  const first = C.length;
  const outline = new THREE.Shape();
  outline.moveTo(-.25, -.7); outline.quadraticCurveTo(-.25, -.98, 0, -.99);
  outline.quadraticCurveTo(.25, -.98, .25, -.7); outline.lineTo(.25, .7);
  outline.quadraticCurveTo(.25, .98, 0, .99); outline.quadraticCurveTo(-.25, .98, -.25, .7); outline.closePath();
  const deck = new THREE.ExtrudeGeometry(outline, { depth: .055, bevelEnabled: true, bevelSize: .025, bevelThickness: .012, bevelSegments: 2, steps: 1 });
  deck.rotateX(-Math.PI / 2);
  mesh(name + ' laminated deck', deck, [0, 0, 0], '#c19e64', 'solid', G.skate);
  const underside = new THREE.ShapeGeometry(outline);
  const uv = underside.attributes.uv;
  const pos = underside.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + .27) / .54, (pos.getY(i) + 1) / 2);
  underside.rotateX(Math.PI / 2);
  mesh(name + ' screenprinted graphic', underside, [0, -.016, 0], '#ffffff', graphic, G.skate, { doubleSided: true });
  if (complete) {
    const grip = new THREE.ShapeGeometry(outline);
    grip.rotateX(-Math.PI / 2);
    mesh(name + ' charcoal grip tape', grip, [0, .071, 0], '#29312e', 'solid', G.skate);
  }
  if (complete) for (const z of [-.65, .65]) {
    box(name + ' steel truck', [0, -.15, z], [.57, .10, .12], '#9da29b', 'solid', G.skate);
    box(name + ' truck base', [0, -.07, z], [.17, .12, .22], '#777e78', 'solid', G.skate);
    for (const x of [-.3, .3]) cylinder(name + ' urethane wheel', [x, -.2, z], .125, .11, '#e1c698', [0, 0, Math.PI / 2], .125, 'solid', G.skate);
  }
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation));
  for (const c of C.slice(first)) {
    const offset = new THREE.Vector3(...c.p);
    for (let i = 0; i < c.vertices!.length; i += 3) {
      const v = new THREE.Vector3(...c.vertices!.slice(i, i + 3) as Point).add(offset).applyMatrix4(matrix);
      c.vertices!.splice(i, 3, round(v.x), round(v.y), round(v.z));
    }
    for (let i = 0; i < (c.normals?.length ?? 0); i += 3) {
      const v = new THREE.Vector3(...c.normals!.slice(i, i + 3) as Point).transformDirection(matrix);
      c.normals!.splice(i, 3, round(v.x), round(v.y), round(v.z));
    }
    c.p = [...p];
  }
}
skateboard('Leaning complete skateboard', [4.91, 1.03, -2.79], [-1.35, .1, .18], 'room-poster-orbit');
skateboard('Floor cruiser', [1.7, .29, 2.45], [0, -.43, 0], 'room-poster-canopy');
for (const [i, graphic] of ['room-poster-coast', 'room-poster-canopy', 'room-poster-orbit'].entries()) {
  skateboard('Wall deck ' + (i + 1), [5.77, 4.0, -4.95 + i * .73], [-Math.PI / 2, 0, -Math.PI / 2], graphic, false);
  cylinder('Deck wall peg', [5.71, 3.55, -4.95 + i * .73], .045, .25, '#987248', [0, 0, Math.PI / 2]);
}

// Workbench / repair station, spare wheel set and compact skate paraphernalia.
box('Skate repair bench top', [-5.75, 1.42, 2.5], [1.9, .18, 2.5], '#bd955f', 'room-timber', G.furniture, { solid: true }, .035);
for (const x of [-6.48, -5.02]) for (const z of [1.5, 3.5]) beam('Workbench leg', [x, .05, z], [x, 1.4, z], .15);
for (let i = 0; i < 4; i++) cylinder('Spare wheel', [-5.55 + (i % 2) * .29, 1.6, 1.8 + Math.floor(i / 2) * .28], .12, .13, '#ddbd83');
box('Spare truck axle', [-5.7, 1.58, 2.6], [.65, .13, .14], '#a1a8a1');
box('Skate tool handle', [-5.7, 1.58, 2.98], [.43, .065, .09], '#273c3b', 'solid', G.details, { yaw: 27 });
const helmet = new THREE.SphereGeometry(.37, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
mesh('Battered teal skate helmet', helmet, [-5.86, 1.53, 3.2], '#38635b');
for (let i = 0; i < 4; i++) box('Helmet vent', [-6.04 + .115 * i, 1.87, 3.14], [.048, .022, .12], '#142b2b', 'solid', G.details, {}, .018);
cord('Helmet chin strap', [[-6.08, 1.55, 3.2], [-6.1, 1.43, 3.46], [-5.67, 1.44, 3.43], [-5.6, 1.55, 3.2]], '#283533', .025);
for (const x of [-5.91, -5.38]) {
  box('Skate shoe white sole', [x, .09, 3.9], [.34, .14, .7], '#d8caaa', 'solid', G.details, { yaw: -12 }, .06);
  box('Canvas skate shoe', [x, .23, 3.82], [.32, .22, .57], '#344448', 'solid', G.details, { yaw: -12 }, .08);
  for (let i = 0; i < 4; i++) box('White shoe lace', [x, .355, 3.68 + i * .07], [.2, .017, .022], '#efe0bc');
}

// Rug sits flush with the floor, with individual fringe threads at each end.
const rug = new THREE.PlaneGeometry(5.7, 3.8).rotateX(-Math.PI / 2).rotateY(-.08);
mesh('Worn woven medallion rug', rug, [-.4, .049, .0], '#eee3cc', 'room-rug', G.furniture, { castShadow: false });
for (const z of [-1.93, 1.93]) for (let i = 0; i < 45; i++) box('Rug fringe', [-3.14 + i * .12, .047, z], [.025, .012, .13], '#c8b78e', 'solid', G.details, { yaw: -4.6 }, 0);

// Low stools, stacked zines and a few plants make the edges feel inhabited.
cylinder('Round skate stool seat', [-3.5, .85, 2.52], .53, .18, '#bf9b64', [0, 0, 0], .53, 'room-timber', G.furniture);
for (let i = 0; i < 3; i++) {
  const a = i * Math.PI * 2 / 3;
  beam('Stool leg', [-3.5 + Math.cos(a) * .38, .04, 2.52 + Math.sin(a) * .38], [-3.5 + Math.cos(a) * .29, .83, 2.52 + Math.sin(a) * .29], .12);
}
box('Zine and tape shelf', [-6.49, 4.92, 2.75], [.72, .14, 2.55], '#b38a57', 'room-timber');
for (let i = 0; i < 9; i++) box('Collected skate zine', [-6.42, 5.15, 1.95 + i * .16], [.42, .34 + (i % 3) * .07, .09], ['#b3794d', '#d0b685', '#386363', '#494c43'][i % 4]);
for (let i = 0; i < 5; i++) box('VHS skate tape', [1.05 + .035 * (i % 2), 1.39 + i * .085, -4.16], [.72, .07, .4], i % 2 ? '#c6b18a' : '#3b4440', 'solid', G.details, { yaw: -4 + i * 2 });
function plant(p: Point, scale = 1) {
  cylinder('Terracotta pot', [p[0], p[1] + .23 * scale, p[2]], .23 * scale, .43 * scale, '#aa704a', [0, 0, 0], .31 * scale);
  cylinder('Pot dark earth', [p[0], p[1] + .453 * scale, p[2]], .275 * scale, .01, '#453d29');
  for (let i = 0; i < 8; i++) {
    const angle = i * 2.4, length = (.46 + .09 * (i % 3)) * scale;
    const leaf = new THREE.SphereGeometry(1, 8, 6).scale(.11 * scale, length / 2, .035 * scale);
    leaf.rotateZ(.65); leaf.rotateY(angle);
    mesh('Broadleaf houseplant', leaf, [p[0] + Math.cos(angle) * length * .28, p[1] + .45 * scale + length * .3, p[2] + Math.sin(angle) * length * .28], ['#5f7e45', '#809653', '#426d48'][i % 3]);
  }
}
plant([-6.6, 1.39, -3.3], .8); plant([4.7, 1.39, -5.38], .78); plant([-1.13, .06, -5.26], 1.1);

// Warm hanging shade and a small visible bulb. Emission stays in the scene.
cord('Pendant flex', [[-.5, 8.0, -.3], [-.5, 6.05, -.3]], '#343b30', .021);
cylinder('Pendant dark metal shade', [-.5, 5.91, -.3], .51, .27, '#303d36', [0, 0, 0], .16);
mesh('Pendant warm bulb', new THREE.SphereGeometry(.13, 12, 8), [-.5, 5.76, -.3], '#fff1b5', 'solid', G.details, { emissive: '#ffe69c' });

// The exit is deliberately in a short recessed hall, outside the room's
// central composition; checkpoints/respawn use the existing level lifecycle.
box('Exit threshold', [4.6, .03, 4.87], [2.5, .06, 1.9], '#b78f5c', 'room-timber', G.shell);
box('Exit hall supported floor', [4.6, -.15, 9.7], [2.7, .3, 7.8], '#bd965e', 'room-timber', G.shell, { solid: true });
C.push({ t: 'checkpoint', p: [4.6, .05, 8.2], nm: 'Room exit checkpoint', grp: G.play });
C.push({ t: 'clock', p: [-6.1, .05, 5.25], nm: 'Optional trial clock by the entrance', grp: G.play });
C.push({ t: 'gate', p: [4.6, .02, 12.8], yaw: 180, nm: 'Leave your room', grp: G.play });
C.push({ t: 'camnode', p: [-.5, 2, 0], s: [60, 60, 60], cameraView: true, radius: .2,
  yaw: 0, cameraPosition: [1.5, 3.5, 7.2], cameraTarget: [-.5, 1.9, -1],
  cameraFollowDistance: 6.9, cameraFollowTargetHeight: 1.9, cameraFov: 62, cameraAspect: 1.45,
  nm: 'Room exploration camera', grp: G.play });

export const TREEHOUSE_ROOM_LEVEL: CustomLevelData = {
  v: 1, name: 'Inside Your Room', spawn: [-.4, .08, -.35], killY: -8, sky: 'sunset',
  cameraRig: { camDist: 6.9, camHeight: 3.5, camPitch: .2, camFov: 62 },
  atmosphere: { fogEnabled: false, backdrop: 'fog', fogColor: '#9faf96', ambientSky: '#fff0d1', ambientGround: '#8c7253',
    ambientIntensity: 1.2, sunColor: '#ffdb99', sunIntensity: 1.45, fillColor: '#b9d7d0', fillIntensity: .36,
    shadowStrength: .65, drawDistance: 180 },
  groups: Object.entries(G).map(([nm, id]) => ({ id, nm, editorOnly: true })), components: C,
};
