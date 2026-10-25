import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from '../level';
import { SAVED_SLIPSTREAM_LEVEL } from './skystream-source';
import { SKY_BRIDGE_LEVEL } from './sky-bridge';
import { createLoopMeshData, sampleLoop } from '../loopRide';

type P = [number, number, number];
const C: CustomComponent[] = [];
const lane: P[] = [];
const IVORY = '#fff9e9', GOLD = '#dec28b', BLUE = '#557a96';
const add = (c: CustomComponent) => C.push(c);
const round = (n: number) => Math.round(n * 1e5) / 1e5;
const tuple = (v: THREE.Vector3): P => v.toArray().map(round) as P;

// The exact user-exported Saved: The Slipstream is pinned in
// tools/fixtures/skystream/saved-slipstream.json. It preserves the saved
// surface-edge policy, including its two additional finish-apron rails.
// Reflect both local path X and roll, and negate yaw: reflecting only the
// component origin leaves the turns and their banking facing the wrong way.
export function mirrorSlipstreamComponent(original: CustomComponent): CustomComponent {
  const c: CustomComponent = JSON.parse(JSON.stringify(original));
  c.p[0] = -c.p[0];
  if (c.yaw !== undefined) c.yaw = -c.yaw;
  if (c.to) c.to[0] = -c.to[0];
  if (c.pts) c.pts = c.pts.map(q => {
    const mirrored = [...q] as typeof q;
    mirrored[0] = -mirrored[0];
    if (mirrored.length === 5) mirrored[4] = -mirrored[4];
    return mirrored;
  });
  return c;
}

for (const original of SAVED_SLIPSTREAM_LEVEL.components) {
  if (original.t === 'gate' || original.t === 'crystal') continue;
  const c = mirrorSlipstreamComponent(original);
  c.grp = 1;
  if (c.t === 'camnode') { lane.push(c.p); continue; }
  if (c.t === 'platform' || c.t === 'vertramp') {
    c.tex = 'skystream-marble'; c.color = IVORY;
    // The old finish apron is now an ordinary mid-course landing.
    if (c.t === 'platform') delete c.edgeGrinding;
  }
  add(c);
}
// The old lane extended beyond its gate. Keep it up to the new connection.
lane.pop();
lane.push([0, .2, -866]);

interface RoutePart { name: string; points: P[]; width: number; group: number; }
export const SKYSTREAM_PARTS: RoutePart[] = [];
export const SKYSTREAM_SHORTCUTS: { name: string; entry: P; exit: P; drop: number; aim: P; trail: P[]; }[] = [];
export const SKYSTREAM_GAPS: { name: string; takeoff: P; landing: P; }[] = [
  { name: 'Mirrored original leap', takeoff: [-6, 7.5, -738], landing: [-7, .8, -756] },
];

function visual(geometry: THREE.BufferGeometry, p: P, color: string, name: string, tex = 'solid', group = 9) {
  const pos = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  if (tex === 'skystream-marble' && uv && normal) for (let i = 0; i < pos.count; i++) {
    if (Math.abs(normal.getY(i)) > .5) uv.setXY(i, pos.getX(i) / 6, pos.getZ(i) / 6);
    else if (Math.abs(normal.getX(i)) > .5) uv.setXY(i, pos.getZ(i) / 6, pos.getY(i) / 6);
    else uv.setXY(i, pos.getX(i) / 6, pos.getY(i) / 6);
  }
  add({ t: 'mesh', p, vertices: Array.from(pos.array).map(round),
    indices: geometry.index ? Array.from(geometry.index.array) : undefined,
    normals: normal ? Array.from(normal.array).map(round) : undefined,
    uvs: uv ? Array.from(uv.array).map(round) : undefined,
    tex, color, solid: false, edgeGrinding: false, grp: group, nm: name });
  geometry.dispose();
}

function route(name: string, points: P[], group: number, width = 6.2, roll = 0) {
  const origin = points[0];
  add({ t: 'vertramp', p: [...origin], pts: points.map((p,i) => [p[0] - origin[0], p[2] - origin[2], 0, p[1] - origin[1], roll * Math.min(1, i / 2, (points.length - 1 - i) / 2)]),
    curve: 'spline', vkind: 'half', w: width, rise: 2.4, arc: 48, arcSteps: 12,
    bank: 20, vert: false, tex: 'skystream-marble', color: IVORY, grp: group, nm: name });
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const n = Math.ceil(curve.getLength() / 5);
  const samples = Array.from({ length: n + 1 }, (_, i) => tuple(curve.getPointAt(i / n)));
  for (const p of samples) if (!lane.length || new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...lane[lane.length - 1])) > .1) lane.push(p);
  SKYSTREAM_PARTS.push({ name, points: samples, width, group });
  // A recessed lapis keel sits below the collision ribbon. It
  // gives the floating road thickness without fencing off its shortcut edges.
  const keel = new THREE.CatmullRomCurve3(samples.map(p => new THREE.Vector3(p[0], p[1] - 1.2, p[2])), false, 'centripetal');
  visual(new THREE.TubeGeometry(keel, Math.max(8, n), .42, 6, false), [0, 0, 0], BLUE, `${name} · lapis keel`);
  return points[points.length - 1];
}

function halo(name: string, start: P, forward: P, rx: number, rz: number, degrees: number, drop: number, turn: number, group: number) {
  const right: P = [-forward[2], 0, forward[0]];
  const count = Math.ceil(degrees / 25), angle = degrees * Math.PI / 180;
  const points: P[] = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count, a = angle * t;
    return [start[0] + right[0] * turn * rx * (1 - Math.cos(a)) + forward[0] * rz * Math.sin(a),
      start[1] - drop * t,
      start[2] + right[2] * turn * rx * (1 - Math.cos(a)) + forward[2] * rz * Math.sin(a)];
  });
  const end = route(name, points, group, 9, turn * 20);
  SKYSTREAM_SHORTCUTS.push({ name, entry: start, exit: end, drop, aim: end, trail: [] });
  return end;
}

route('Cloudhead approach', [[0, .2, -866], [-5, -1, -890], [-32, -7, -916], [-48, -12, -940]], 2);
const pearl = halo('Pearl halo · round right-hand descent', [-48, -12, -940], [0, 0, -1], 30, 30, 400, 32, 1, 2);
route('Crosswind S', [pearl, [-12, -48, -990], [38, -51, -1010], [95, -56, -1070], [120, -62, -1120]], 3);
const eye = halo('Cloud eye · wide left oval', [120, -62, -1120], [0, 0, -1], 40, 34, 400, 38, -1, 3);
route('Broken constellation launch', [eye, [72, -104, -1166], [42, -108, -1192], [30, -108, -1220]], 4);
SKYSTREAM_GAPS.push({ name: 'Broken constellation', takeoff: [30, -108, -1220], landing: [21, -114, -1234] });
route('Broken constellation catch', [[21, -114, -1234], [3, -115, -1262], [-50, -116, -1300], [-90, -118, -1320]], 4, 8);
const cork = halo('Seraph coil · tall oval quarter-turn exit', [-90, -118, -1320], [-1, 0, 0], 32, 40, 450, 42, 1, 4);
route('Falling feather switchbacks', [cork, [-136, -162, -1400], [-105, -169, -1440], [-50, -176, -1490], [8, -184, -1520], [36, -190, -1560]], 5);
const finalHalo = halo('Last halo · oblique return', [36, -190, -1560], [0, 0, -1], 30, 32, 400, 30, 1, 5);
route('Sanctuary leap launch', [finalHalo, [63, -221, -1604], [80, -222, -1620]], 5);
SKYSTREAM_GAPS.push({ name: 'Sanctuary leap', takeoff: [80, -222, -1620], landing: [80, -225, -1634] });
route('Loop summit landing', [[80, -225, -1634], [80, -225, -1645]], 6, 8);

export const SKYSTREAM_LOOP = { entry: [80, -330, -1760] as P, radius: 34, width: 12, offset: 48,
  exit: [128, -330, -1760] as P };
export const SKYSTREAM_WALL = { p: [104, -346, -1760] as P, s: [4.5, 60, 88] as P };

// Cosine descent has horizontal tangents at both ends. It supplies all loop
// energy through the existing gravity-track physics; there is no speed pad.
const dropFrom: P = [80, -225, -1645], dropTo: P = [80, -330, -1748];
const dropVertices: number[] = [], dropIndices: number[] = [], dropUV: number[] = [], dropNormals: number[] = [];
for (let i = 0; i <= 64; i++) {
  const t = i / 64, y = (dropTo[1] - dropFrom[1]) * (1 - Math.cos(Math.PI * t)) / 2, z = (dropTo[2] - dropFrom[2]) * t;
  const slope = (dropTo[1] - dropFrom[1]) * Math.PI * Math.sin(Math.PI * t) / (2 * (dropTo[2] - dropFrom[2]));
  const normal = new THREE.Vector3(0, 1, -slope).normalize();
  for (const side of [-1, 1]) { dropVertices.push(side * 8, y, z); dropUV.push(side * 8 / 6, t * 23); dropNormals.push(...normal.toArray()); }
  if (i < 64) { const a = i * 2; dropIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  lane.push([80, dropFrom[1] + y, dropFrom[2] + z]);
}
add({ t: 'mesh', p: dropFrom, vertices: dropVertices, indices: dropIndices, uvs: dropUV, normals: dropNormals,
  smoothCollision: true, gravityTrack: true, vert: false, doubleSided: true,
  tex: 'skystream-marble', color: IVORY, grp: 6, nm: 'Heavenfall · 105 metre gravity descent' });
add({ t: 'mesh', p: [80, -330, -1747], vertices: [-8,0,0,8,0,0,8,0,-14,-8,0,-14], indices:[0,1,2,0,2,3],
  uvs:[0,0,16/6,0,16/6,14/6,0,14/6], gravityTrack:true, vert:false, tex:'skystream-marble',color:IVORY,grp:6,nm:'Aureole flat approach' });
lane.push([...SKYSTREAM_LOOP.entry]);
add({ t: 'mesh', p: SKYSTREAM_LOOP.entry, ...createLoopMeshData(34, 12, 48, 192), loopRadius: 34, loopOffset: 48, w: 12,
  loopRequired: false, doubleSided: true, edgeGrinding: false,
  tex: 'skystream-marble', color: IVORY, grp: 6, nm: 'The Aureole · 68 metre vertical loop' });
for (let i = 1; i <= 96; i++) {
  const q = sampleLoop(SKYSTREAM_LOOP, i / 96 * Math.PI * 2).point;
  lane.push(q.map((v, k) => v + SKYSTREAM_LOOP.entry[k]) as P);
}
// A visible, solid barrier separates entry and exit. No completion counter
// or invisible gate validation is used to make this obstacle compulsory.
add({ t: 'wall', p: SKYSTREAM_WALL.p, s: SKYSTREAM_WALL.s, tex: 'skystream-marble', color: IVORY, grp: 6, nm: 'Aureole central sanctuary wall' });
for (const x of [101.65, 106.35]) {
  visual(new THREE.BoxGeometry(.22, 3, 90), [x, -288, -1760], GOLD, 'Sanctuary wall gilt cornice', 'metal');
  for (const z of [-1796, -1778, -1760, -1742, -1724]) {
    visual(new THREE.CylinderGeometry(.7, .9, 58, 12), [x, -316, z], '#d5deeb', 'Sanctuary wall fluted pilaster', 'skystream-marble');
    const medallion = new THREE.TorusGeometry(3.8, .24, 6, 40); medallion.rotateY(Math.PI / 2);
    visual(medallion, [x, -296, z], GOLD, 'Sanctuary wall sun seal', 'metal');
  }
}
for (const side of [-1, 1]) {
  const points = Array.from({ length: 193 }, (_, i) => {
    const q = sampleLoop(SKYSTREAM_LOOP, i / 192 * Math.PI * 2, side * 6.35);
    return new THREE.Vector3(...q.point).add(new THREE.Vector3(...SKYSTREAM_LOOP.entry));
  });
  visual(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 192, .27, 8, false), [0, 0, 0], GOLD, 'Aureole continuous gilt rim', 'metal');
}
route('Aureole runout', [[128, -330, -1760], [128, -330, -1790], [128, -330, -1812], [128, -328, -1830]], 7, 8);
SKYSTREAM_GAPS.push({ name: 'Last flight', takeoff: [128, -328, -1830], landing: [128, -338, -1850] });
route('Last flight catch', [[128, -338, -1850], [128, -341, -1880], [112, -346, -1910], [96, -348, -1928]], 7, 8);
export const SKYSTREAM_FINISH: P = [96, -348, -1960];
add({ t: 'platform', p: [96, -349, -1946], s: [26, 2, 66], tex: 'skystream-marble', color: IVORY, grp: 7, nm: 'Cloud sanctuary finish court' });
lane.push([96, -348, -1946], [96, -348, -1976]);
add({ t: 'gate', p: SKYSTREAM_FINISH, grp: 7 });

const partPoint = (name: string, t: number): P => { const p = SKYSTREAM_PARTS.find(part => part.name === name)!.points; return [...p[Math.round((p.length - 1) * t)]]; };
export const SKYSTREAM_CHECKPOINTS: P[] = [[0, .2, -854], partPoint('Broken constellation launch', .3), partPoint('Falling feather switchbacks', .13), [80, -225, -1640], [128, -330, -1794]];
for (const [i, p] of SKYSTREAM_CHECKPOINTS.entries()) add({ t: 'checkpoint', p, grp: 8, nm: `Cloud sanctuary ${i + 1}` });

// Large carved columns, stepped capitals and open gilt crowns supply a
// consistent architectural scale. They remain below/beside playable edges.
for (const p of [[-14,150,9],[14,150,9],[-16,.2,-854],[16,.2,-854],[64,-225,-1640],[96,-225,-1640],[78,-348,-1954],[114,-348,-1954]] as P[]) {
  const [x,y,z] = p;
  visual(new THREE.CylinderGeometry(1.8, 2.2, 25, 12), [x,y-12.5,z], '#e9e5db', 'Cloud pier fluted shaft', 'skystream-marble');
  for (const [offset,r,h] of [[-.45,3.5,.9],[-1.25,2.9,.65],[-2,2.5,.45]] as const)
    visual(new THREE.CylinderGeometry(r,r+.12,h,12), [x,y+offset,z], IVORY, 'Cloud pier stepped capital', 'skystream-marble');
  visual(new THREE.TorusGeometry(2.05,.2,6,32).rotateX(Math.PI/2), [x,y-2.8,z], GOLD, 'Cloud pier gold collar', 'metal');
  visual(new THREE.ConeGeometry(2.2,9,12), [x,y-29.5,z], BLUE, 'Floating pier lapis pendant');
}
for (const [x,y,z] of [[0,150,-2],[0,.2,-849],[80,-225,-1639],[96,-348,-1954]] as P[]) {
  const arch = new THREE.TorusGeometry(12.8,.55,8,48,Math.PI);
  visual(arch,[x,y+1.6,z],GOLD,'Open sanctuary crown arch','metal');
  for(const side of [-1,1]) {
    visual(new THREE.CylinderGeometry(.6,.8,7,12),[x+side*12.8,y-1.9,z],IVORY,'Crown arch marble uprights','skystream-marble');
  }
}

for (const part of SKYSTREAM_PARTS) {
  // Fruit follows the main route. Every halo also has a shorter airborne
  // trail, making the optional edge cut legible through the cloud fog.
  for (let i=5;i<part.points.length-3;i+=7) {
    const p=part.points[i];add({t:'wumpa',p:[p[0],p[1]+1,p[2]],grp:part.group});
  }
}
// Fruit marks actual input-only edge-jump flights, including the final cut
// across Sanctuary Leap. The lower exits are ordinary grindable road.
const shortcutLines: {entry:P;exit:P;aim:P;trail:P[]}[] = [{"entry":[-11.3,-15.16,-976.03],"exit":[25.04,-49.78,-1001.52],"aim":[0,-49,-984],"trail":[[-4.28,-10.99,-980.96],[3.05,-11.51,-986.1],[10.38,-17.96,-991.24],[17.71,-30.81,-996.38]]},{"entry":[78.76,-65.75,-1160.73],"exit":[41.29,-107.34,-1189.61],"aim":[72,-104,-1166],"trail":[[71.27,-61.86,-1166.5],[63.77,-63.39,-1172.28],[56.28,-71.6,-1178.06],[48.79,-86.75,-1183.83]]},{"entry":[-113.3,-126.99,-1385.62],"exit":[-112.1,-167.51,-1430.28],"aim":[-116,-162,-1380],"trail":[[-113.06,-121.68,-1394.42],[-112.83,-122.26,-1403.21],[-112.58,-130.27,-1412.35],[-112.34,-145.64,-1421.15]]},{"entry":[61.0,-191.12,-1598.51],"exit":[85.75,-225,-1634.98],"aim":[68,-221,-1609],"trail":[[65.95,-186.72,-1605.81],[70.9,-187.29,-1613.1],[75.85,-193.8,-1620.39],[80.8,-206.71,-1627.68]]}];
shortcutLines.forEach((line,i)=>Object.assign(SKYSTREAM_SHORTCUTS[i],line,{drop:line.entry[1]-line.exit[1]}));
for (const cut of SKYSTREAM_SHORTCUTS) for(const p of cut.trail)
  add({t:'wumpa',p:[p[0],p[1]+.9,p[2]],grp:8});
for(const p of lane)add({t:'camnode',p});

export const SKYSTREAM_LEVEL: CustomLevelData = {
  v:1,name:'The Skystream',spawn:[-SAVED_SLIPSTREAM_LEVEL.spawn[0],SAVED_SLIPSTREAM_LEVEL.spawn[1],SAVED_SLIPSTREAM_LEVEL.spawn[2]],
  killY:-430,sky:'clouds',keepPlayFog:true,jungleDepthFade:false,hugeDropBail:false,
  cameraAirLift:.65,cameraLookAhead:13,
  atmosphere:{...SKY_BRIDGE_LEVEL.atmosphere!,fogNear:36,fogFar:192},relicTime:180,medalTimes:{gold:180,silver:210,bronze:250},
  groups:[{id:1,nm:'I · mirrored Saved Slipstream'},{id:2,nm:'II · pearl halo'},{id:3,nm:'III · cloud eye'},
    {id:4,nm:'IV · broken constellation and seraph coil'},{id:5,nm:'V · falling feathers'},
    {id:6,nm:'VI · the Aureole'},{id:7,nm:'VII · last flight'},{id:8,nm:'Sanctuaries and shortcuts'},
    {id:9,nm:'Marble, lapis and gilt architecture',editorOnly:true}],
  components:C,
};
