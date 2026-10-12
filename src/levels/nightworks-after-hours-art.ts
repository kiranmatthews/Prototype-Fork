import type { CustomComponent, CustomLevelData, DecorKind } from '../level';
import { calderaHorizon, calderaBasin, calderaNearScenery, basaltFormation } from './nightworks-caldera-environment';

type Point = [number, number, number];
const QUARRY = 'nightworks-basalt';
export const AFTER_HOURS_ART_GROUP = 90;
export const AFTER_HOURS_VOLCANO = { center: [-150, -600, -1800] as Point, size: [1700, 850, 1500] as Point };

/** Visual dressing is additive. Every original collider, path, timing, pickup
 * and view volume retains its original dimensions and component index. */
export function withAfterHoursVolcano(source: CustomLevelData): CustomLevelData {
  const data = structuredClone(source), art: CustomComponent[] = [];
  const put = (c: CustomComponent): void => { art.push({ solid: false, scenerySolid: false, edgeGrinding: false, castShadow: false, grp: AFTER_HOURS_ART_GROUP, ...c }); };
  const rock = (kind: DecorKind, p: Point, s: Point, yaw = 0, nm = 'Fractured quarry buttress'): void =>
    put({ t: 'decor', dkind: kind, p, s, yaw, nm, color: '#b5bfce', tex: QUARRY });
  const mesh = (nm: string, p: Point, vertices: number[], indices: number[], extra: Partial<CustomComponent> = {}): void =>
    put({ t: 'mesh', nm, p, vertices, indices, tex: QUARRY, color: '#d1d1d5', emissive: '#060913', doubleSided: true, ...extra });

  // A thin fitted cap keeps the exact supported slope. Its split, tapering
  // sides remove the box silhouette without narrowing a landing or gap.
  const chippedSlope = (c: CustomComponent): void => {
    const ramp = c.t === 'ramp', w = ramp ? c.w ?? 10 : c.s![0], d = ramp ? c.len ?? 10 : c.s![2];
    const rise = ramp ? c.rise ?? 0 : 0, top = ramp ? c.p[1] : c.p[1] + c.s![1] / 2;
    const depth = ramp ? 2.8 : Math.min(3.2, Math.max(.65, c.s![1]));
    const n = Math.max(2, Math.ceil(d / 3.2)), vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = d / 2 - d * t, y = rise * t;
      const cut = i === 0 || i === n ? .36 : -.14 - .16 * Math.sin(i * 2.7);
      const left = -w / 2 + cut, right = w / 2 - cut;
      for (const [x, yy] of [[left,y],[0,y],[right,y],[left+.45,y-depth*(.78+.2*Math.sin(i*1.9))],[right-.6,y-depth*(.85+.2*Math.cos(i*2.1))]]) {
        vertices.push(x, yy, z); uvs.push(x / 5, (z - yy * .7) / 5);
      }
      if (i < n) {
        const a = i * 5, b = a + 5;
        indices.push(a,b,a+1,a+1,b,b+1, a+1,b+1,a+2,a+2,b+1,b+2,
          a,a+3,b,b,a+3,b+3, a+2,b+2,a+4,a+4,b+2,b+4,
          a+3,a+4,b+3,b+3,a+4,b+4);
      }
    }
    indices.push(0,2,4,0,4,3,n*5,n*5+3,n*5+4,n*5,n*5+4,n*5+2);
    mesh(`Chipped stone · ${c.nm ?? c.t}`, [c.p[0], top + .012, c.p[2]], vertices, indices, { yaw: c.yaw, uvs });
    // Hiding the backing must retain its original default edge-grind policy.
    c.edgeGrinding ??= !c.invisible;
    c.invisible = true;
  };

  for (const c of data.components) {
    if(c.dkind?.startsWith('night') && c.dkind!=='nightvolcano'){c.tex=QUARRY;c.color='#c8ccd5';if(c.t==='platform')c.emissive='#070b14';}
    if(c.t==='decor'&&c.dkind==='nightdistantarch'&&c.s){
      for(const side of [-1,1]){
        const a=(c.yaw??0)*Math.PI/180,x=c.p[0]+Math.cos(a)*side*8.3,z=c.p[2]-Math.sin(a)*side*8.3;
        put(basaltFormation([x,source.killY-10,z],16,c.p[1]-(source.killY-10)+8,16,Math.abs(z)+side*3));
      }
    }
    if(c.t==='platform'&&c.dkind&&c.s&&c.s[0]>9&&c.s[2]>9){
      const base=source.killY-10,top=c.p[1]-c.s[1]/2;
      put(basaltFormation([c.p[0],base,c.p[2]],c.s[0]*.72,top-base+.2,c.s[2]*.72,Math.abs(c.p[2])+23));
    }
    if (['ramp', 'vertramp', 'wall', 'wallpath', 'terrain'].includes(c.t) || (c.t === 'platform' && !c.dkind)) {
      c.tex = QUARRY; c.color = '#d1d1d5'; c.emissive = '#060913';
      if ((c.t === 'ramp' || c.t === 'platform') && !c.pts) chippedSlope(c);
    }
    if (c.t !== 'vertramp') continue;
    const radius = c.rise ?? 4, arc = (c.arc ?? 90) * Math.PI / 180;
    const reach = (c.w ?? 3) + radius * Math.sin(arc) + (c.deck ?? 0);
    const lipY = radius * (1 - Math.cos(arc));
    const yaw = (c.yaw ?? 0) * Math.PI / 180;
    const knots: Point[] = c.pts ? c.pts.map(p => [p[0] + c.p[0], c.p[1] + (p[3] ?? 0), p[1] + c.p[2]]) :
      [[c.p[0]+Math.sin(yaw)*(c.len??24)/2,c.p[1],c.p[2]+Math.cos(yaw)*(c.len??24)/2],
       [c.p[0]-Math.sin(yaw)*(c.len??24)/2,c.p[1],c.p[2]-Math.cos(yaw)*(c.len??24)/2]];
    for (let i = 0; i < knots.length - 1; i++) {
      const a = knots[i], b = knots[i+1], len = Math.hypot(b[0]-a[0],b[2]-a[2]);
      const dx = (b[0]-a[0])/len, dz = (b[2]-a[2])/len, n = Math.max(1,Math.floor(len/6.5));
      for (let j = 0; j < n; j++) {
        const t = (j+.5)/n;
        // Leave generous clear corners around the filleted cutback turns.
        if (c.pts && (t*len < 10 || (1-t)*len < 10)) continue;
        for (const side of c.vkind === 'quarter' ? [1] : [-1,1]) {
          const x = a[0]+dx*t*len-side*dz*(reach+.85), z = a[2]+dz*t*len+side*dx*(reach+.85);
          rock('nightsteppingrock',[x,a[1]+(b[1]-a[1])*t+lipY-4.2,z],[2.4,4.2,5.8],-Math.atan2(dx,-dz)*180/Math.PI,'Split stone bank edging');
        }
      }
    }
  }

  for (const c of createNightworksVolcanoScenery()) put(c);

  for(const c of [...calderaBasin(),...calderaNearScenery()])put(c);

  // Open the horizon while retaining every authored camera heading/volume.
  data.cameraRig={camDist:8.5,camHeight:6.2,camPitch:16,camFov:60};
  data.components.push(...art);
  data.groups=[...(data.groups??[]),{id:AFTER_HOURS_ART_GROUP,nm:'Volcano and quarry surfaces',editorOnly:true}];
  data.atmosphere={...data.atmosphere,backdrop:'fog',fogNear:60,fogFar:220,fogColor:'#242536',drawDistance:2000,
    ambientSky:'#a7b7d8',ambientGround:'#66372d',ambientIntensity:1.2,
    sunColor:'#bfd2f3',sunIntensity:1.6,sunDirection:[.55,.75,.35],fillColor:'#eeb080',fillIntensity:.48,shadowStrength:.72};
  return data;
}

/** The landmark is an animated distant matte with 3D basalt at nearer depths. */
export function createNightworksVolcanoScenery(_center: Point = AFTER_HOURS_VOLCANO.center, _size: Point = AFTER_HOURS_VOLCANO.size): CustomComponent[] {
  return [calderaHorizon(_size[0]<1000)];
}
