import type { CustomComponent, CustomLevelData } from '../level';
import { MOONBONE_ASSETS } from '../moonboneAssets';
import { CARLISLE_ASSETS } from '../carlisleAssets';
import { CUSTARD_ASSETS } from '../custardAssets';
import { rumblePoint, rumbleHeight, rumbleYaw, rumbleProgress } from './rumblewater-run';

type P = [number, number, number];
const assets = { ...MOONBONE_ASSETS, ...CARLISLE_ASSETS, ...CUSTARD_ASSETS };
type Kind = keyof typeof assets;
/** Registry dimensions preserve the measured GLB bounds; only a uniform
 * scale is permitted here. Y is always the grounded base of the model. */
export function moonboneProp(kind: Kind, nm: string, p: P, width: number, yaw = 0, color = '#ffffff', grp = 90): CustomComponent {
  const size = assets[kind].size, k = width / size[0];
  return { t: 'decor', dkind: kind, nm, p, s: size.map(v => v * k) as P,
    yaw, color, solid: false, scenerySolid: false, castShadow: width < 30, grp };
}

export function moonboneBonusScenery(): CustomComponent[] {
  const c: CustomComponent[] = [];
  const prop = (kind: Kind, name: string, p: P, w: number, yaw = 0, color = '#ffffff') =>
    c.push(moonboneProp(kind, name, p, w, yaw, color));
  // Three world-space planes give true camera parallax. Their native 3:2
  // image ratio is retained. The painted moon belongs to the far layer.
  prop('moonbonesky', 'Far painted moon and star field', [27, -185, -195], 480);
  prop('moonboneclouds', 'Middle drifting cloud banks', [44, -89, -103], 270);
  prop('moonboneridge', 'Near fossil valley matte', [42, -76, -68], 315, 0, '#94a5c4');

  // Overlapping eroded Meshy masses form the far shore. Vary their rotation,
  // depth and waterline while retaining each model's native proportions.
  for (const [i,x] of [-45,-22,1,24,47,70,93,116,139].entries()) {
    const width=i%2?34:30,top=[1,5,0,3,-1,4,1,6,0][i];
    const height=CARLISLE_ASSETS.coastv2buttress.size[1]*width/14;
    prop('coastv2buttress','Eroded distant ossuary shoreline',
      [x,top-height,-48-i%3*4],width,23+i*53,'#667fba');
  }

  // Arrival is intimate; the central rib vault is the hero; the return has
  // a lower, leaning arch. Negative space keeps jumps and fruit readable.
  prop('moonbonecrypt', 'Arrival vigil shrine', [-5, -.8, -8.5], 7.4, 12);
  prop('moonboneskull', 'Lift guardian on the far bank', [13, -2.4, -23], 9.4, -18);
  prop('moonboneribarch', 'Great fractured rib vault', [42, -5.8, -27], 34, -7);
  prop('moonbonecrypt', 'Upper gallery crystal altar', [25, 4.9, -9.6], 8.4, -8);
  prop('moonboneskull', 'Far vault moon-eye guardian', [58, 3.3, -19], 8.7, 20);
  prop('moonboneribarch', 'Leaning return arch', [88, -6, -25], 25, 18);
  prop('moonbonecrypt', 'Return threshold shrine', [85, -.9, -9.8], 9.2, -15);
  prop('moonboneribarch', 'Distant broken ossuary silhouette', [-23, -12, -48], 27, 31, '#657894');

  // Individual terraces seat the monuments. No repeated rectangular rear wall.
  for (const [x, y, z, w, turn] of [[-5,-8,-9,8,18],[13,-14,-23,13,-20],
    [25,-5,-10,10,-12],[58,-7,-19,11,22],[85,-11,-10,11,-16],
    [27,-17,-28,17,5],[56,-17,-28,16,-20],[77,-16,-25,14,15],[99,-16,-25,14,-25]])
    prop('coastv2ledge', 'Rooted ossuary terrace', [x,y,z], w, turn, '#7488ad');
  for (const [x,y,z,w,turn] of [[-24,-26,-37,23,5],[14,-25,-41,22,-30],
    [48,-25,-46,26,21],[78,-25,-43,23,46],[111,-24,-36,24,-32]])
    prop('coastv2buttress', 'Deep layered blue gorge', [x,y,z], w, turn, '#56698d');
  for (const [x,y] of [[-9,0],[3,0],[20,6],[29,6],[52,6],[60,6],[78,0],[90,0]]) {
    const w = y ? 10 : 8.3, h = CARLISLE_ASSETS.coastv2ledge.size[1] * w / 10;
    prop('coastv2ledge', 'Sculpted limestone platform root', [x,y-1.7-h,-.8],w,x*13,'#8e9bb4');
  }
  for (const [x,y,z] of [[-8,-.5,-5.4],[22,5.5,-5.7],[53,5.3,-7],[82,-.5,-6.6]]) {
    c.push({t:'torch',nm:'Warm vigil flame at shrine foot',p:[x,y,z],rise:1.1,w:.38,grp:90});
    prop('coastfern','Small silver fern in the stone seam',[x+1.5,y-.35,z+.5],1.7,x*17,'#8caec2');
    prop('coastfoliage','Purple ossuary groundcover',[x-1,y-.35,z+.7],1.3,x*11,'#987cb4');
  }
  for (const [x,y,z,w] of [[-15,-12,6,8],[17,-13,6,6],[66,-12,7,7],[99,-13,5,9]])
    prop('coastv2ledge','Low foreground fossil crag',[x,y,z],w,x*19,'#3d4c71');
  return c;
}

/** Curated landmarks spaced across all three acts. Clear sightline pockets
 * replace outer-bank vegetation and incidental monuments, while the full
 * riding surface, all chase refuges and every obstacle remain authored. */
export const ROLLING_BONES_LANDMARKS = [82, 376, 698, 952, 1192, 1484, 1774, 2012, 2244, 2484, 2614] as const;
export function dressRollingBones(data: CustomLevelData): void {
  const centers = ROLLING_BONES_LANDMARKS;
  data.components = data.components.filter(c => {
    if (c.t !== 'decor' || c.scenerySolid || ![90,91,92].includes(c.grp ?? 0)) return true;
    const s = rumbleProgress(c.p);
    return !centers.some((at,i) => {
      if (Math.abs(s-at) >= 30) return false;
      const mid=rumblePoint(s),side=i%2?-1:1;
      return Math.sign(c.p[0]-mid[0])===side;
    });
  });
  const add = (kind: Kind, name: string, s: number, u: number, base: number, width: number, turn = 0, color = '#ffffff') =>
    data.components.push(moonboneProp(kind,name,rumblePoint(s,base,u),width,rumbleYaw(s)+turn,color,96));
  for (const [i,s] of centers.entries()) {
    const y=rumbleHeight(s),side=i%2 ? -1 : 1, u=side*([0,3,6,10].includes(i)?36:25);
    const arch=[0,3,6,10].includes(i), crypt=[2,5,8].includes(i);
    const kind=arch?'moonboneribarch':crypt?'moonbonecrypt':'moonboneskull';
    const width=arch?(i===10?30:25):crypt?12:10;
    // Face the reverse chase camera, with a three-quarter turn toward road.
    add(kind,`Moonbone landmark ${i+1} · ${arch?'fossil gateway':crypt?'crystal shrine':'moon-eye sentinel'}`,s,u,y-1,width,180+side*-18);
    // Widen only the visual outer-bank shelf beneath the new landmark.
    const baseWidth=arch?12:14,turn=(180+side*-18)*Math.PI/180;
    for (const dx of arch?[-width*.41,width*.41]:[0])
      add('coastv2ledge','Moonbone landmark grounded shelf',s+dx*Math.sin(turn),u+dx*Math.cos(turn),
        y-1-CARLISLE_ASSETS.coastv2ledge.size[1]*baseWidth/10+.35,baseWidth,side*23,'#9da9c4');
    const massWidth=arch?32:26;
    add('coastv2buttress','Moonbone submerged connected rock mass',s+3,u+side*5,
      y-1.8-CARLISLE_ASSETS.coastv2buttress.size[1]*massWidth/14,massWidth,side*24,'#8798b8');
    add('coastfern','Moonbone silver fern pocket',s-5,u-side*4,y-.8,3.2,31,'#9dc1c8');
    add('coastfoliage','Moonbone purple groundcover pocket',s+4,u-side*3,y-.6,3.3,-21,'#a58abb');
    for(const ds of [-5,5]) data.components.push({t:'torch',nm:'Moonbone roadside vigil',p:rumblePoint(s+ds,y-.5,u-side*5),rise:2.2,w:.6,grp:96});
  }
  data.groups = [...(data.groups??[]), {id:96,nm:'Moonbone · eleven grounded night landmarks',editorOnly:true}];
}
