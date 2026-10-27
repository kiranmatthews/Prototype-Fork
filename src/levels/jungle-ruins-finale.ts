import type { CustomComponent, CustomGroup, DecorKind } from '../level';
import type { JungleAssemblyKind } from '../jungleAssemblies';

type Point = [number, number, number];
const STONE = '#d8cfac', GOLD = '#d8b45c';
// Downward rays at the normalized centres of the native Treehouse meshes.
// Rock bounds include uneven peaks; their maximum is not a planting surface.
const ROCK_CROWN={trialsv2cavewalla:.9379323883,trialsv2cavewallb:.7366333292} as const;
export const RUINS_CLIMB_Z = -1360;
export const RUINS_SKATE_GAPS = [
  { near: -840, far: -866, runway: -718, speed: 48, name: 'The broken aqueduct' },
  { near: -970, far: -1000, runway: -866, speed: 50, name: 'Twin guardian chasm' },
  { near: -1106, far: -1138, runway: -1000, speed: 52, name: 'The hanging gardens' },
  { near: -1244, far: -1278, runway: -1138, speed: 54, name: 'Sun gate leap' },
] as const;
export const RUINS_CLIMB_LEDGES = [
  [22, 2.2, 10], [33, 4.4, 10], [44, 6.6, 10], [56, 8.8, 14],
  [71, 11, 12], [83, 13.2, 10], [94, 15.4, 10], [106, 17.6, 14],
  [121, 19.8, 12], [133, 22, 10], [144, 24.2, 10], [158, 26.4, 18],
] as const;

/** The native Ruins ending, using the same editable components as the editor. */
export function jungleRuinsFinale(): { components: CustomComponent[]; groups: CustomGroup[] } {
  const C: CustomComponent[] = [];
  const groups: CustomGroup[] = [
    { id: 260, nm: 'Broken aqueduct · skating surfaces' },
    { id: 261, nm: 'Broken aqueduct · jumps and rewards' },
    { id: 262, nm: 'Broken aqueduct · rooted jungle' },
    { id: 263, nm: 'Sunward ascent · climbing terraces' },
    { id: 264, nm: 'Sunward ascent · temple architecture' },
    { id: 265, nm: 'Sunward ascent · canopy and depth' },
    { id: 266, nm: 'Finale · checkpoints and camera' },
  ];
  const add = (c: CustomComponent) => { C.push(c); };
  const prop = (dkind: DecorKind, p: Point, s: Point, nm: string, yaw = 0, grp = 262, color = '#ffffff') =>
    add({ t: 'decor', dkind, p, s, yaw, color, solid: false, scenerySolid: false, castShadow: false, grp, nm });
  const assembly = (dkind: JungleAssemblyKind, p: Point, s: Point, nm: string, yaw = 0, grp = 264) => {
    add({ t: 'decor', dkind, p, s, yaw, ...(dkind === 'roofedtemple' ? {openFloor: true} : {}), seed: Math.round(Math.abs(p[0] + p[2])),
      nm, grp, solid: false, scenerySolid: false, castShadow: false });
  };
  const slab = (p: Point, s: Point, nm: string, grp = 260) => {
    add({ t: 'platform', p: [p[0], p[1] - s[1] / 2, p[2]], s, tex: 'jungle', color: STONE, artProxy: true, grp, nm });
    const h = grp === 260 ? .4 : s[1];
    assembly('templeplatform', [p[0], p[1] - h - .025, p[2]], [s[0], h, s[2]], nm + ' · bonded masonry', 0, grp);
    if(grp===260){
      // Retain the light, earth-jointed deck. Give its exposed underside real
      // stone courses instead of leaving a paper-thin slab above the ravine.
      // Broad foundation blocks are direct native-mesh instances, keeping
      // the complete course inside the editor's assembly-work limit.
      const rows=2,course=(s[1]-.37)/rows;
      for(const side of [-1,1])for(let row=0;row<rows;row++){
        for(const alongZ of [true,false]){
          const length=alongZ?s[2]:s[0]-2.2,count=Math.ceil(length/3.8),span=length/count;
          for(let n=0;n<count;n++){
            const along=-length/2+(n+.5)*span;
            prop((n+row)%4===0?'wornstoneblock':'stoneblock',
              [p[0]+(alongZ?side*(s[0]/2-.55):along),p[1]-s[1]+row*course,
                p[2]+(alongZ?along:side*(s[2]/2-.55))],
              [span+.025,course+.012,1.1],nm+' · weathered retaining courses',
              (alongZ?90:0)+((n+row)%2)*180,grp,'#e0ddc3');
          }
        }
      }
    }else{
      const count=Math.ceil(s[0]/3),span=s[0]/count;
      for(let i=0;i<count;i++)prop('stonecornice',
        [p[0]-s[0]/2+(i+.5)*span,p[1]-.38,p[2]+s[2]/2-.5],
        [span+.015,.35,1.05],nm+' · carved terrace lip',0,grp,'#e7e2ca');
    }
  };
  const fruit = (p: Point, nm: string) => add({ t: 'wumpa', p, grp: 261, nm });
  const checkpoint = (p: Point, nm: string) => add({ t: 'checkpoint', p, grp: 266, nm });
  const node = (p: Point, radius = 0) => add({ t: 'camnode', p, radius, grp: 266, nm: 'Finale camera spine' });
  const pit = (p: Point, s: Point, nm: string) => add({ t: 'pit', p, s, grp: 261, nm });
  const archFoundations = (z: number) => {
    for (const side of [-1, 1]) for (let n = 0; n < 3; n++)
      prop('stoneblock', [side * 10.5, -12.18 + n * 4, z], [4, 4, 4], 'Aqueduct arch foundation', n * 180);
  };

  checkpoint([0, 0, -702], 'Aqueduct expedition checkpoint');
  // A roomy runway after the old sanctuary introduces skating before the first
  // launch. Boost stones are the existing mechanic; no movement tuning changes.
  for (const [i, gap] of RUINS_SKATE_GAPS.entries()) {
    const toe = gap.near + 22, flatMid = (gap.runway + toe) / 2;
    slab([0, 0, flatMid], [16, 2.4, gap.runway - toe], `${gap.name} · long run-up`);
    const mid=(toe+gap.near)/2,angle=Math.atan2(4.2,22),thickness=2.4;
    add({ t: 'ramp', p: [0, 0, mid], len: 22, rise: 4.2, w: 16,
      tex: 'jungle', color: STONE, artProxy:true, grp: 260, nm: `${gap.name} · launch bank` });
    add({t:'decor',dkind:'templeplatform',
      p:[0,2.1-thickness*Math.cos(angle)-.025,mid-thickness*Math.sin(angle)],
      // The aqueduct's broad launch stones are twice the ordinary paving
      // module size. This is one fixed authored scale, with native geometry.
      s:[Math.hypot(22,4.2)/2,thickness/2,8],w:2,yaw:90,amp:angle*180/Math.PI,
      solid:false,scenerySolid:false,castShadow:false,seed:Math.abs(gap.near),grp:260,
      nm:`${gap.name} · fitted stone launch paving`});
    add({ t: 'speedpad', p: [0, .025, toe + 6], s: [8, .1, 5], speed: gap.speed, cycle: 5,
      color: '#75ab8b', grp: 261, nm: `${gap.name} · jade acceleration stone` });
    for (const dz of [-2.25, 2.25]) add({ t: 'decor', dkind: 'block', p: [0, .04, toe + 6 + dz],
      s: [8, .06, .18], tex: 'solid', color: GOLD, solid: false, scenerySolid: false,
      grp: 262, nm: 'Gold inlay around jade acceleration stone' });
    // Gold coping and spaced fruit make the lip readable before the camera
    // reaches it. Rails end on their own deck; the centre stays clear for ollies.
    for (const side of [-1, 1]) {
      add({ t: 'rail', p: [side * 6.8, .38, gap.runway - 15],
        pts: [[0, 0], [0, toe - gap.runway + 15], [0, gap.near - gap.runway + 17, 0, 3.82]],
        color: GOLD, grp: 260, nm: `${gap.name} · optional rising grind` });
      prop('stonecornice', [side * 7.35, 4, gap.near + .65], [1.2, .5, 2], 'Carved takeoff marker', 90);
    }
    pit([0, -7, (gap.near + gap.far) / 2], [23, 1, gap.near - gap.far], `${gap.name} · death pit`);
    prop('block', [0, -13.2, (gap.near + gap.far) / 2], [28, 1, gap.near - gap.far + 2], 'Black chasm floor', 0, 262, '#13281c');
    // Receiving faces are tucked under the decks: a missed jump has real
    // masonry to catch, but no invisible bridge spans the chasm.
    assembly('templewall', [0, -8.1, gap.far - .7], [16, 8, 1.3], `${gap.name} · landing abutment`, 0, 262);
    for (let z = gap.runway - 20; z > toe + 3; z -= 9) fruit([0, 1.2, z], 'Aqueduct racing line');
    for (let n = 0; n < 7; n++) {
      const t = n / 6;
      fruit([0, 5.2 + Math.sin(t * Math.PI) * 3 - t * 3.8, gap.near + 3 + (gap.far - gap.near - 6) * t], 'Golden jump arc');
    }
    assembly('hangingarch', [0, -.18, toe + 32], [25, 17, 3.1], `${gap.name} · approach arch`, 0, 262);
    archFoundations(toe + 32);
    // Optional rewards sit off the racing line, with broad, supported space.
    for (const side of [-1, 1]) add({ t: 'crate', p: [side * 5.5, 0, gap.runway - 19],
      kind: i === 2 && side < 0 ? 'mask' : 'wood', grp: 261, nm: 'Aqueduct side reward' });
    if (i === 2) checkpoint([0, 0, gap.runway - 40], 'Hanging gardens checkpoint');
    node([0, 0, gap.runway - 8]); node([0, 0, toe]); node([0, 4.2, gap.near]); node([0, 0, gap.far]);
  }
  slab([0, 0, -1307], [16, 2.4, 58], 'Sun gate · long landing and braking deck');
  slab([2, 0, -1353], [28, 3, 34], 'Sunward ascent · turning court');
  checkpoint([0, 0, -1345], 'Sunward ascent checkpoint');
  assembly('hangingarch', [0, -.1, -1310], [25, 18, 3.1], 'Sun gate arrival', 0, 262);
  archFoundations(-1310);
  node([0, 0, -1314]); node([0, 0, RUINS_CLIMB_Z], 15); node([13, 0, RUINS_CLIMB_Z]);
  add({ t: 'zone', p: [94, 0, RUINS_CLIMB_Z - 1], s: [214, 1, 34], dir: 'E', grp: 266, nm: 'Sunward ascent · right scrolling' });
  add({ t: 'camnode', p: [94, 18, RUINS_CLIMB_Z], s: [214, 88, 34], cameraView: true,
    cameraPresentationOnly: true, cameraPosition: [94, 31, RUINS_CLIMB_Z + 27],
    cameraTarget: [94, 20, RUINS_CLIMB_Z], cameraFollowDistance: 18, cameraKeepDistance: true,
    cameraFollowTargetHeight: 2.1, cameraFov: 55, cameraAspect: 16 / 9, radius: 5,
    grp: 266, nm: 'Sunward ascent · readable side camera' });

  // A deep, planted ravine follows the aqueduct. Broad crowns live behind
  // the shoulders, never in the player's trajectory or across a landing.
  for (let z = -728, i = 0; z > -1340; z -= 20, i++) for (const side of [-1, 1]) {
    const rock=i%2?'trialsv2cavewalla':'trialsv2cavewallb',rockHeight=20+(i%3)*2;
    prop(rock, [side * 23, -17, z],
      [29,rockHeight,22], 'Aqueduct eroded ravine shoulders', side*90+(i%3-1)*7,262,'#dde4ca');
    // Each planted pocket has its own buried mossy rock. Keep them behind
    // the 16 m deck and away from the jump lips, where the old clumps floated.
    const gapNearby=RUINS_SKATE_GAPS.some(g=>z<g.near+5&&z>g.far-5);
    if(!gapNearby){
      prop('treehousemossrock',[side*15.8,-3.6,z-4],[8,4,7],'Rooted aqueduct rock pocket',side*23+i*61);
      prop(i % 2 ? 'trialsv2groundcovera' : 'trialsv2groundcoverb', [side*15.8,-.15,z-4], [4.5,1.1,3.7], 'Moss rooted in ravine rock', i*91);
      prop(i%3?'trialsv2ferna':'trialsv2fernb',[side*16,-.15,z-4],[3.9,2.4,3.5],'Fern rooted in ravine rock',i*73);
    }
    const treeY=-17+rockHeight*ROCK_CROWN[rock]-.25;
    prop(i%3===0?'trialsv2treeb':'junglecanopy',[side*23,treeY,z],
      i%3===0?[31,20,21]:[27,23,26],'Aqueduct canopy rooted on the measured rock crown',side*29+i*71,262,'#b5ceb0');
    if (i % 3 === 0) {
      // The final right-hand crown surrounds the side camera on ledges 3–6.
      // Keep its full mesh, but place it beyond the climbing route and lens.
      const ascentCameraCorner=side>0&&z<RUINS_CLIMB_Z+40;
      prop('junglebackdrop', [side * 56, -8, ascentCameraCorner?RUINS_CLIMB_Z-58:z-12],
        [48, 39, 45], 'Ravine distant canopy', i * 61, 262, '#8fae99');
    }
  }
  for (const [i, z] of [-901, -1190].entries())
    assembly('roofedtemple', [i % 2 ? 28 : -28, -1, z], [14, 15, 12], 'Aqueduct wayside sanctuary', i % 2 ? -20 : 20, 262);

  // Twelve deliberately reachable rises, arranged in three architectural
  // phrases. Wide courts bank progress; the ledge faces remain grabbable.
  for (const [i, [x, y, w]] of RUINS_CLIMB_LEDGES.entries()) {
    const landing = (i + 1) % 4 === 0;
    slab([x, y, RUINS_CLIMB_Z], [w, 3.2, 9], `Sunward ascent · ledge ${i + 1}`, 263);
    // Tall piers visually grow out of the ravine rather than floating in air.
    const pierHeight = y + 6.7, courses = Math.ceil(pierHeight / 4);
    for (let n = 0; n < courses; n++) prop('stoneshaft', [x, -10 + n * pierHeight / courses, RUINS_CLIMB_Z - 2.8],
      [Math.min(w - 3, 5), pierHeight / courses, 3.2], `Ancient terrace pier ${i + 1}`, n % 2 * 180, 264);
    // Native vine bounds start at their lowest point: bury the upper ends in
    // the coping and let the loops hang below the face rather than above it.
    prop('junglevine', [x + w / 2 - 2.2, y - 4.4, RUINS_CLIMB_Z + 4.6], [3.8, 4.5, .8], 'Vines down terrace face', 0, 264, '#a8bb7e');
    prop('trialsv2groundcovera', [x - w / 2 + 1, y - .08, RUINS_CLIMB_Z - 3.8], [2.8, .65, 2], 'Moss in terrace joints', i * 59, 264);
    fruit([x, y + 1.25, RUINS_CLIMB_Z], 'Sunward ascent landing guide');
    if (landing && i < 11) {
      checkpoint([x + 1, y, RUINS_CLIMB_Z], `Sunward ascent · terrace ${i === 3 ? 1 : 2} checkpoint`);
      assembly('hangingarch', [x, y, RUINS_CLIMB_Z - 3.35], [13, 12, 2], 'Crown of the terrace');
      add({ t: 'crate', p: [x + 3, y, RUINS_CLIMB_Z - 2.8], kind: 'mystery', grp: 263, nm: 'Terrace refuge reward' });
    } else if (i % 4 === 1) add({ t: 'crate', p: [x + 1.5, y, RUINS_CLIMB_Z - 2.6], kind: 'wood', grp: 263, nm: 'Climbing side reward' });
    node([x, y, RUINS_CLIMB_Z]);
  }
  slab([179, 26.4, RUINS_CLIMB_Z], [24, 3.2, 13], 'Sunward summit · final sanctuary', 263);
  assembly('roofedtemple', [179, 26.35, RUINS_CLIMB_Z], [12, 16.5, 19], 'Sunward summit sanctuary', 90);
  for (const side of [-1, 1]) prop('junglefern', [174, 26.35, RUINS_CLIMB_Z + side * 5.4], [4, 2.2, 3.3], 'Summit garden', side * 40, 264);
  add({ t: 'gate', p: [183, 26.4, RUINS_CLIMB_Z], yaw: 90, grp: 266, nm: 'Jungle Ruins · Sunward summit finish' });
  node([191, 26.4, RUINS_CLIMB_Z]);
  pit([101, -8, RUINS_CLIMB_Z], [184, 1, 22], 'Sunward ascent · ravine death volume');
  prop('block', [104, -13, RUINS_CLIMB_Z], [220, 1, 80], 'Sunward ravine shadow floor', 0, 265, '#142b20');

  // Layered rear architecture reads in profile. Foreground remains low so
  // every takeoff, vertical face and receiving lip survives the side camera.
  add({t:'wallpath',p:[-12,-30,RUINS_CLIMB_Z-25],pts:[[0,0],[42,0,0,3],[90,0,0,14],[150,0,0,26],[220,0,0,26]],
    w:28,rise:28,curve:'spline',solid:false,invisible:true,tex:'grass',color:'#92a67b',grp:265,nm:'Rooted bank behind the climbing terraces'});
  for (let x = -10, i = 0; x < 210; x += 19, i++) {
    const y = Math.max(0, Math.min(26.4, (x - 15) * .19));
    const rock=i%2?'trialsv2cavewallb':'trialsv2cavewalla',rockHeight=(y+12)/ROCK_CROWN[rock],plantedY=y-2.18;
    prop(rock,[x,-14,RUINS_CLIMB_Z-24],
      [28,rockHeight,24], 'Sunward eroded rear cliff', (i%3-1)*8,265,'#dce3c8');
    // Leave the lost sanctuary's footprint clear of trunks and dense shrubs.
    if(i!==4){
      prop('junglecanopy',[x,plantedY,RUINS_CLIMB_Z-24],[27,24,26],'Sunward layered canopy',i*73,265,'#bad2ab');
      prop('trialsv3thicket',[x,plantedY-.12,RUINS_CLIMB_Z-24],[10,6,7],'Terrace rooted understory',i*57,265);
    }
    // Low foreground growth emerges from a real outcrop rather than hanging
    // beside the climbing columns. The face stays below the readable ledges.
    prop('trialsv2cavewallb',[x,-14,RUINS_CLIMB_Z+17],[20,y+11.2,14],'Sunward foreground rock footing',(i%3-1)*8,265,'#d1ddba');
    prop('trialsv2ferna',[x,-14+(y+11.2)*ROCK_CROWN.trialsv2cavewallb-.18,RUINS_CLIMB_Z+17],
      [5,2.6,4.5],'Rooted low foreground fern',i*39,265,'#c2d2a4');
    if (i === 4) assembly('roofedtemple', [x,plantedY-1.2,RUINS_CLIMB_Z-24], [14,15,12], 'Lost sanctuary behind the ascent',0,265);
    if(i%2===0)prop('junglebackdrop',[x,y-7,RUINS_CLIMB_Z-46],[46,33,35],'Deep forest behind the terraces',i*53,265,'#96b5a2');
    if(i%4===0)prop('treehouserepairgrove',[x+18,y-6,RUINS_CLIMB_Z-64],[84,35.08,.02],'Painted canopy beyond the summit',0,265,'#b1c8b5');
  }
  return { components: C, groups };
}
