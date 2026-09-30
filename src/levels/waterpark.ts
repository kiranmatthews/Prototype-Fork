import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { createLoopMeshData } from '../loopRide';

// A forward skate line through six drained wave pools, then the abandoned
// coaster's jump decks. Keep the shared lips exact: the live spine-transfer
// move reflects the rider across that line into the next analytic halfpipe.
const C: CustomComponent[] = [];
const TEAL = '#67aaa4', AQUA = '#93d2c8', RUST = '#bb7758', CREAM = '#e9d8ae', DARK = '#344e54';
const groups: CustomGroup[] = [
  { id: 1, nm: '01 · High dive entrance', editorOnly: true },
  { id: 2, nm: '02 · Six giant spine pools', editorOnly: true },
  { id: 3, nm: '03 · Coaster jump decks', editorOnly: true },
  { id: 4, nm: '04 · Loop of death', editorOnly: true },
  { id: 5, nm: 'Abandoned park silhouette', editorOnly: true },
  { id: 6, nm: 'Camera route', editorOnly: true },
];
const add = (component: CustomComponent) => C.push(component);
function deck(x: number, z: number, top: number, width: number, length: number, grp: number, name: string, color = TEAL) {
  add({ t: 'platform', p: [x, top - .6, z], s: [width, 1.2, length], tex: 'solid', color, edgeGrinding: false, grp, nm: name });
}
function arrow(x: number, y: number, z: number, grp: number) {
  add({ t: 'mesh', p: [x, y + .035, z], vertices: [-1.4,0,1.3, 1.4,0,1.3, 0,0,-1.6], indices: [0,1,2], solid: false,
    doubleSided: true, tex: 'solid', color: CREAM, edgeGrinding: false, grp, nm: 'Forward route arrow' });
}
function checkpoint(x: number, y: number, z: number, grp: number, name: string) {
  add({ t: 'checkpoint', p: [x,y,z], grp, nm: name });
}
function fruitLine(x: number, y: number, near: number, far: number, grp: number, spacing = 7) {
  for (let z = near; z >= far; z -= spacing) add({ t: 'wumpa', p: [x,y,z], grp });
}
function block(x: number, y: number, z: number, width: number, height: number, length: number, color: string, name: string) {
  add({ t: 'decor', dkind: 'block', p: [x,y,z], s: [width,height,length], w: width, rise: height, tex: 'solid', color, grp: 5, nm: name });
}

// The entrance is already at coping height: even the first drop gives enough
// energy to climb the 14 m wall at the far end. The open centre is 28 m wide.
deck(0, 10, 14, 28, 20, 1, 'High dive loading deck', CREAM);
checkpoint(-4, 14, 12, 1, 'High dive start');
arrow(0,14,6,1);
add({ t: 'clock', p: [-10,14,18], grp: 1 });
add({ t: 'comboorb', p: [10,14,18], grp: 1 });

export const WATERPARK_POOLS = Array.from({ length: 6 }, (_, i) => ({
  centerZ: -20 - i * 40, radius: 14, flatHalf: 6, nearLip: -i * 40, farLip: -40 - i * 40,
}));
for (const [i, pool] of WATERPARK_POOLS.entries()) {
  add({ t: 'vertramp', p: [0,0,pool.centerZ], yaw: 90, len: 28, rise: pool.radius, w: pool.flatHalf,
    vkind: 'half', arc: 90, deck: 0, rails: false, edgeGrinding: false, tex: 'solid', color: i % 2 ? AQUA : TEAL,
    grp: 2, nm: `Giant spine pool ${i + 1} · 14 m vert` });
  arrow(0,0,pool.centerZ,2);
  fruitLine(0,1,pool.centerZ+4,pool.centerZ-4,2,4);
  if (i === 2 || i === 4) checkpoint(-4,0,pool.centerZ+3,2,`Spine pool ${i + 1} restart`);
  // The source-owned speed jets make a low-speed checkpoint retry useful;
  // the walls and transfer still use the unchanged live skating physics.
  add({ t: 'speedpad', p: [0,.025,pool.centerZ+2], s: [12,.15,4], speed: 43, cycle: .55,
    tex: 'solid', color: CREAM, grp: 2, nm: 'Pool-floor charge jet' });
  for (const side of [-1,1]) {
    block(side * 15.5,-9,pool.centerZ,2,23,39,RUST,'Rusting pool side frame');
    for (const z of [pool.nearLip-2,pool.farLip+2]) block(side*17,-9,z,1.8,23,1.8,DARK,'Pool support tower');
  }
}

// A broad exit kicker meets the final bowl at its flat, then rises ABOVE its
// forward transition. That turns the last drop-in into a forward gap jump.
add({ t: 'ramp', p: [0,0,-230], len: 20, rise: 14, w: 20, tex: 'solid', color: RUST, edgeGrinding: false, grp: 3, nm: 'Wavebreaker launch · 14 m rise' });
export const WATERPARK_JUMPS = [
  { takeoff: -240, landing: -258, takeoffY: 14, landingY: 10 },
  { takeoff: -318, landing: -338, takeoffY: 18, landingY: 16 },
  { takeoff: -404, landing: -426, takeoffY: 18, landingY: 22 },
];
deck(0,-277,10,26,38,3,'First coaster landing',AQUA);
checkpoint(-4,10,-280,3,'Coaster jump one');
arrow(0,10,-288,3);
add({ t: 'speedpad', p: [0,10.025,-291], s: [12,.15,5], speed: 42, cycle: .8, grp: 3, nm: 'Second jump charge jet' });
add({ t: 'ramp', p: [0,10,-307], len: 22, rise: 8, w: 20, tex: 'solid', color: RUST, edgeGrinding: false, grp: 3, nm: 'Rust chute kicker · 8 m rise' });
deck(0,-350,16,26,24,3,'Second coaster catch deck',TEAL);
checkpoint(-4,16,-349,3,'Coaster jump two');
add({ t: 'ramp', p: [0,6,-371], len: 18, rise: 10, w: 26, yaw: 180, tex: 'solid', color: TEAL, edgeGrinding: false, grp: 3, nm: 'Second coaster descent' });
add({ t: 'speedpad', p: [0,6.025,-385], s: [12,.15,7], speed: 44, cycle: .8, grp: 3, nm: 'Third jump charge jet' });
deck(0,-385,6,26,10,3,'Final kicker charge deck',CREAM);
add({ t: 'ramp', p: [0,6,-397], len: 14, rise: 12, w: 20, tex: 'solid', color: RUST, edgeGrinding: false, grp: 3, nm: 'High flume kicker · 12 m rise' });
// Descending landing catches a range of airs and delivers the momentum into
// the final charging straight. Its high end faces the approaching rider.
deck(0,-436,22,26,20,3,'High splashdown catch deck',AQUA);
add({ t: 'ramp', p: [0,0,-463], len: 34, rise: 22, w: 26, yaw: 180, tex: 'solid', color: AQUA, edgeGrinding: false, grp: 3, nm: 'Dry splashdown chute' });
deck(0,-480,0,14,40,4,'Loop charging runway',CREAM);
checkpoint(-4,0,-483,4,'Loop of death restart');
arrow(0,0,-484,4);
add({ t: 'speedpad', p: [0,.025,-493], s: [13,.15,14], speed: 64, cycle: .6, grp: 4, nm: 'Loop of death charge launch' });

// One continuous 52 m coaster loop, with separate entry/exit lanes.
export const WATERPARK_LOOP = { entry: [0,0,-500] as [number,number,number], radius: 26, width: 14, offset: 20 };
add({ t: 'mesh', p: WATERPARK_LOOP.entry, ...createLoopMeshData(26,14,20), w: 14, loopRadius: 26, loopOffset: 20, loopRequired: true,
  tex: 'solid', color: RUST, doubleSided: true, edgeGrinding: false, grp: 4, nm: 'Loop of death · 52 m tall' });
deck(20,-530,0,14,60,4,'Loop exit runway',AQUA);
arrow(20,0,-542,4);
add({ t: 'crystal', p: [20,1.2,-547], grp: 4, nm: 'Coaster survivor crystal' });
add({ t: 'gate', p: [20,0,-554], grp: 4, nm: 'Deadwater Park exit' });
fruitLine(20,1,-516,-542,4);

for (const [y,z] of [[10,-282],[16,-351],[22,-436]]) for (const x of [-7,7]) {
  add({ t: 'crate', p: [x,y,z], kind: 'wood', grp: 3, nm: 'Forgotten park supply crate' });
}

// Clear empty space under every jump; the dark basin catches missed gaps
// promptly while keeping a visible abandoned pool floor far below the ride.
add({ t: 'pit', p: [5,-8,-282], s: [110,1,610], color: '#243b3e', grp: 5, nm: 'Drained park failure basin' });
for (const z of [-265,-343,-432,-470]) for (const x of [-21,21]) {
  block(x,-9,z,2,22,2,RUST,'Abandoned flume support');
  block(x,-9,z-9,3,5,7,DARK,'Old pump house');
}
for (const z of [12,-260,-340,-430,-550]) for (const x of [-27,34]) {
  add({ t: 'decor', dkind: 'palm', p: [x,-8,z], w: 1.3, rise: 15, amp: x<0?.12:-.12, grp: 5, nm: 'Overgrown waterpark palm' });
}
// A straight ordered camera spine keeps forward on screen aligned with every
// crosswise pool and stays forward-facing through the vertical loop.
for (let z = 30; z >= -610; z -= 20) add({ t: 'camnode', p: [0,0,z], grp: 6 });

add({ t: 'camnode', p: [10,26,-500], s: [70,80,110], cameraView: true, yaw: 0, radius: 10,
  cameraPosition: [90,28,-470], cameraTarget: [10,24,-500], cameraFov: 52, cameraAspect: 16/9, grp: 6, nm: 'Loop of death wide spectator view' });
// Follow the actual airborne rider through these oversized airs. The ordinary
// low corridor rig can leave a 14 m coping launch outside the top of the frame.
// The loop shot above wins inside its fully weighted arena; both keep Up = -Z.
add({ t: 'camnode', p: [0,28,-280], s: [120,160,700], cameraView: true, yaw: 0, radius: 1,
  cameraPosition: [10,17,30], cameraTarget: [0,1.3,0], cameraFollowDistance: 28,
  cameraFov: 58, cameraAspect: 16/9, grp: 6, nm: 'Giant air follow camera' });

export const WATERPARK_LEVEL: CustomLevelData = {
  v: 1, name: 'Deadwater Park', spawn: [0,14.15,14], killY: -18, sky: 'day', keepPlayFog: true,
  atmosphere: { fogEnabled: true, fogNear: 130, fogFar: 390, fogColor: '#a3b8b4', backdrop: 'fog',
    ambientSky: '#e6f1ed', ambientGround: '#52716d', ambientIntensity: 1.05, sunColor: '#fff0d4', sunIntensity: 1.35,
    fillColor: '#b0dbd8', fillIntensity: .45, drawDistance: 480, shadowStrength: .6 },
  medalTimes: { gold: 85, silver: 115, bronze: 155 }, components: C, groups,
};
