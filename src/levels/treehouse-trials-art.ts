import type { CustomComponent } from '../level';
import { TREEHOUSE_TRIALS_CAVE_EXTENSION_V2, TREEHOUSE_TRIALS_SKYLIGHT_POOLS_V2 } from './treehouse-trials-scenes-v2';

// Painted depth lives beyond the actual course, never across a walk/grind line.
// Foreground Meshy silhouettes and the existing alpha-cutout forest give every
// beat three independently authored layers without distant geometry density.
const C: CustomComponent[] = [];
const add = (c: CustomComponent) => C.push(c);
const backdrop = 6;
const light = 15;
add({t:'decor',dkind:'treehousetrialsforestmatte',p:[35,-26,-482],s:[220,92,.02],
  nm:'Quiet painted jungle beyond the finish',grp:backdrop});
for (const [x,y,z,w] of [
  [-10,-4,-83,76],[-8,-24,-119,70],[78,-24,-131,65],
  [-8,-18,-241,70],[78,-18,-241,65],
  [-8,-13,-444,70],[78,-13,-444,65],
] as const) add({t:'decor',dkind:'treehousetrialsforestmatte',p:[x,y,z],s:[w,w/2.4,.02],
  nm:'Distant forest beyond the real bank silhouettes',grp:backdrop});
add({t:'decor',dkind:'treehousetrialscoastmatte',p:[103,-33,-182],s:[96,40,.02],yaw:-60,
  nm:'Coastal settlement inlet and distant islands',grp:backdrop});

for (const [x,y,z,w] of [
  [-2,-5,-83,60],[73,-18,-109,60],
  [0,-17,-223,60],[75,-17,-226,62],
  [0,-10,-428,60],[78,-10,-433,62],
] as const) add({t:'decor',dkind:'treehousemattemid',p:[x,y,z],s:[w,w/2.4,.02],
  color:'#a2bca8',nm:'Painted midground trunks behind real foliage',grp:backdrop});

for (const [x,z] of [[-2,-350],[72,-371]] as const)
  add({t:'decor',dkind:'treehousetrialscavematte',p:[x,-19,z-TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],s:[60,25,.02],
    color:'#a2b4a8',nm:'Deep cavern recesses behind the sculpted walls',grp:backdrop});

// A fixed shared shader supplies soft roof light; no extra point lights,
// shadow maps, particle emitters or post-processing pass are required.
for (const [i,p] of [
  [34,-13.8,-260-TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],
  [38,-10,-278-TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],
  ...TREEHOUSE_TRIALS_SKYLIGHT_POOLS_V2,
].entries()) add({t:'decor',dkind:'treehousetrialssunshaft',p:[p[0],p[1]+.05,p[2]],s:[i<2?2.4:3.5,27,.02],amp:32.45,yaw:-23.96,
  nm:'Soft daylight through a cavern roof opening',grp:light});

// A close, lower eye lets the broad canopy and cavern roofs read above the
// rider, while the existing lane still owns movement and heading. Feather
// into this ordinary forward shot after the opening's authored right turn.
add({t:'camnode',cameraView:true,p:[35,-5,-176],s:[43,64,34],radius:7,
  cameraPosition:[23,-8,-160],cameraTarget:[35,-12,-180],cameraFov:49,
  cameraFollowDistance:13.5,cameraFollowTargetHeight:1.5,
  nm:'Close diagonal glimpse of the coastal crab shack and inlet',grp:7});
add({t:'camnode',cameraView:true,p:[35,-5,-224],s:[43,64,392],radius:9,
  cameraPosition:[35,4,-204],cameraTarget:[35,0,-227],cameraFov:55,
  cameraFollowDistance:10.3,cameraFollowTargetHeight:1.5,
  nm:'Close forward scene composition with visible canopy and cave roof',grp:7});

export const TREEHOUSE_TRIALS_ART_COMPONENTS = C;
