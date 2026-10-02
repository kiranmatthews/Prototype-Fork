import type { CustomComponent, CustomLevelData } from '../level';
import { buildIslandShelfGeometry } from '../islandShelf';

// All playable surfaces use the ordinary editor component pipeline. The
// encounter owns only the chief, attacks and presentation, never rider tuning.
export const REEF = { chiefZ: -28, pearl: [0, 1.4, -19] as [number, number, number],
  spawn: [0, .12, 17] as [number, number, number], centreZ: -14, railY: .68 };
const components: CustomComponent[] = [];
export const REEF_SEA_LEVEL = -1.08;
const add = (c: CustomComponent) => components.push(c);
const outline: [number, number, number][] = [
  [-16, 22, 3], [-22, 16, 4], [-22, -19, 4], [-15, -27, 4],
  [15, -27, 4], [22, -19, 4], [22, 16, 4], [16, 22, 3],
];
add({ t: 'platform', p: [0, -1.15, -14], s: [1, 2.3, 1], pts: outline,
  color: '#d7b685', tex: 'solid', edgeGrinding: false, nm: 'Coralstone arena · supported top at zero' });
// Reuse Island Hopper's authored Unity shelf and MatrixRex sand. Its original
// .72m crown is translated to the existing arena datum, preserving the fight.
const coastOutline = Array.from({length:48}, (_, i) => {
  const a = i * Math.PI / 24; return [Math.cos(a) * 33, Math.sin(a) * 36] as [number, number];
});
const shelf = buildIslandShelfGeometry(coastOutline, {centerY:0, seaLevel:-.36, phase:1.8});
shelf.translate(0, -.72, 0);
const shelfIndex = shelf.getIndex()!;
for(let i=0;i<shelfIndex.count;i+=3){const b=shelfIndex.getX(i+1);shelfIndex.setX(i+1,shelfIndex.getX(i+2));shelfIndex.setX(i+2,b);}
shelf.computeVertexNormals();
add({t:'mesh', p:[0,0,-14], vertices:Array.from(shelf.getAttribute('position').array),
  indices:Array.from(shelf.getIndex()!.array), materialStyle:'unity-sand', tex:'sand',
  solid:true, edgeGrinding:false, nm:'Island Hopper coastal shelf · reused sand/shore geometry'});
shelf.dispose();
add({ t: 'woodpath', p: [0, 0, 23], pts: [[0, 0, 0, 0], [0, -17, 0, 0]], widths: [6, 6],
  w: 6, supportDepth: 3, baySpacing: 3, structureStyle: 'island',
  edgeGrinding: false, nm: 'Arrival canoe pier' });
add({ t: 'platform', p: [0, -.55, -43], s: [14, 1.1, 15], color: '#628d84', tex: 'solid',
  edgeGrinding: false, nm: 'Victory causeway' });
add({t:'platform',p:[0,-.65,-59],s:[17,1.3,16],color:'#b1b5a2',tex:'stone',edgeGrinding:false,nm:'Throne-islet foundation beyond victory arch'});
add({ t: 'gate', p: [0, 0, -49], nm: 'Reef crown exit · sealed until chief yields' });
add({ t: 'checkpoint', p: [0, 0, 5.5], nm: 'Arena arrival · phase progress survives a retry' });
add({ t: 'pit', p: [0, -2.8, -15], s: [130, 1, 130], invisible: true, nm: 'Deep lagoon respawn' });
// Broad ramps offer a skating line back from both elevated reef terraces.
for (const side of [-1, 1]) {
  add({ t: 'platform', p: [side * 18, .45, -13], s: [5.5, .9, 23], color: '#79978b',
    tex: 'stone', edgeGrinding: false, nm: `${side < 0 ? 'West' : 'East'} pearl terrace` });
  add({ t: 'ramp', p: [side * 18, 0, 2], len: 8, rise: .9, w: 5.5,
    tex: 'stone', color: '#849c87', edgeGrinding: false, nm: 'Pearl terrace roll-in' });
  add({ t: 'ramp', p: [side * 18, 0, -28], len: 8, rise: .9, w: 5.5, yaw: 180,
    tex: 'stone', color: '#849c87', edgeGrinding: false, nm: 'Pearl terrace return' });
  // A low, immediately catchable entry runs from the front court and curves
  // back toward the exposed pearl. Both paths use real grind/balance physics.
  const points: [number, number, number, number][] = [
    [side * 11, 1, 2, 0], [side * 14, -6, 3, .25], [side * 14, -14, 3, .25],
    [side * 11, -21, 3, .25], [side * 6, -21, 2, .15],
  ];
  add({ t: 'rail', p: [0, REEF.railY, 0], pts: points, nm: `${side < 0 ? 'West' : 'East'} pearl-charge rail` });
  for (const z of [3, -7, -19, -31])
    add({ t: 'torch', p: [side * 23.5, 0, z], rise: 2.8, w: .65, nm: 'Reef fire basket' });
  for (const z of [0, -25]) add({ t: 'crate', p: [side * 18, .9, z], kind: 'mask', nm: 'Optional storm protection' });
}
// A printed spiral and shell-inlay rings make the arena read as a deliberate
// ceremonial place without hiding the attack circles under busy floor detail.
for (const radius of [5.5, 11.5, 18.5]) {
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16, b = a + Math.PI / 16 * .83, inner = radius - .16;
    add({ t: 'mesh', p: [0, .018, REEF.centreZ], vertices: [
      Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * radius, 0, Math.sin(a) * radius,
      Math.cos(b) * radius, 0, Math.sin(b) * radius, Math.cos(b) * inner, 0, Math.sin(b) * inner,
    ], indices: [0, 2, 1, 0, 3, 2], color: radius === 11.5 ? '#74948d' : '#a48058',
    tex: 'solid', solid: false, doubleSided: true, edgeGrinding: false, nm: 'Shell mosaic inlay' });
  }
}
for (const z of [20, 2, -20, -45]) add({ t: 'camnode', p: [0, 0, z], radius: 0, nm: 'Stable north-facing arena controls' });
// Established project vegetation and rock models replace the temporary kit.
for (const side of [-1,1]) for (let i=0;i<5;i++) {
  const z=4-i*10, x=side*(25+(i%2)*2), y=-.45;
  add({t:'decor',dkind:'junglepalmtree',p:[x,y,z],s:[7.2,9+(i%2)*1.5,7.2],solid:false,yaw:i*47+side*19,
    nm:'Existing Jungle Ruins coastal palm'});
  add({t:'decor',dkind:'junglefern',p:[x+side*2,y,z-3],w:.9,solid:false,yaw:i*71,nm:'Existing jungle shore fern'});
  add({t:'decor',dkind:'jungleleaf',p:[x-side*2,y,z+2],w:.7,solid:false,yaw:i*53,nm:'Existing tropical ground foliage'});
  add({t:'decor',dkind:'rocks',p:[x+side*1.5,-.9,z+4],w:1.5+(i%3)*.2,vr:i,tn:i%3,
    nm:'Existing project shoreline rock cluster'});
}
for(const side of [-1,1]) for(const z of [-4,-24])
  add({t:'decor',dkind:'mapcliff',p:[side*30,-1.6,z],s:[6.5,3.8,7],yaw:side*19,solid:false,
    color:'#b9c5b5',nm:'Existing map-kit shoreline rock'});
// An authored arena shot keeps the whole chief, the attack floor and rider in
// view. Translation-only following preserves that composition at the edges.
add({ t: 'camnode', p: [0, 4, -16], s: [64, 30, 86], yaw: 0, radius: 3, cameraView: true,
  cameraPosition: [0, 30, 39], cameraTarget: [0, 2, -14], cameraFov: 55, cameraAspect: 1.6,
  cameraFollowDistance: 38, cameraIntroDistance: 15, nm: 'Chief establishing shot and arena follow' });

export const CRAB_CHIEF_LEVEL: CustomLevelData = {
  v: 1, name: 'Tidebreak · Crab Chief', encounter: 'crab-chief',
  spawn: REEF.spawn, killY: -7, sky: 'coast', cameraAirLift: .45,
  ocean:{geometryVersion:2,p:[-150,REEF_SEA_LEVEL,-14],length:360,yaw:0,seaward:1,width:360,
    overlap:6,longitudinalSegments:128,lateralSegments:128,sourceCoordinates:'three'},
  unitySand:[{p:[0,.006,-14],s:[44,.012,49]}],
  shoreFoam:[{center:[0,REEF_SEA_LEVEL,-14],right:[1,0,0],forward:[0,0,1],axes:[33,36],phase:1.8}],
  keepPlayFog: true,
  atmosphere: { backdrop: 'sky', fogColor: '#a6d4d8', fogNear: 100, fogFar: 260,
    ambientSky: '#c0e4ea', ambientGround: '#a1906f', ambientIntensity: 1.35,
    sunColor: '#fff0d1', sunIntensity: 1.65 },
  components,
};
