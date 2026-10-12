import type { CustomComponent, CustomLevelData, DecorKind } from '../level';

type Point = [number, number, number];
const QUARRY = 'nightworks-quarry';
export const AFTER_HOURS_ART_GROUP = 90;
export const AFTER_HOURS_VOLCANO = { center: [-150, -600, -1800] as Point, size: [1700, 850, 1500] as Point };

/** Visual dressing is additive. Every original collider, path, timing, pickup
 * and view volume retains its original dimensions and component index. */
export function withAfterHoursVolcano(source: CustomLevelData): CustomLevelData {
  const data = structuredClone(source), art: CustomComponent[] = [];
  const put = (c: CustomComponent): void => { art.push({ solid: false, edgeGrinding: false, castShadow: false, grp: AFTER_HOURS_ART_GROUP, ...c }); };
  const rock = (kind: DecorKind, p: Point, s: Point, yaw = 0, nm = 'Fractured quarry buttress'): void =>
    put({ t: 'decor', dkind: kind, p, s, yaw, nm, color: '#b6aaa9' });
  const mesh = (nm: string, p: Point, vertices: number[], indices: number[], extra: Partial<CustomComponent> = {}): void =>
    put({ t: 'mesh', nm, p, vertices, indices, tex: QUARRY, color: '#c7b3a4', emissive: '#151729', doubleSided: true, ...extra });

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
    c.invisible = true;
  };

  for (const c of data.components) {
    if (['ramp', 'vertramp', 'wall', 'wallpath', 'terrain'].includes(c.t) || (c.t === 'platform' && !c.dkind)) {
      c.tex = QUARRY; c.color = '#c6b6a5'; c.emissive = '#111727';
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

  // The lava river is safely below killY. It supplies a moving red underglow
  // through the existing voids; it cannot become an accidental landing.
  const river:number[]=[],riverIndices:number[]=[],riverUvs:number[]=[];
  for(let i=0;i<=80;i++){
    const z=80-i*12,x=45+Math.sin(i*.18)*38,width=58+Math.sin(i*.47)*16;
    for(const side of [-1,1]){river.push(x+side*width,source.killY-7,z);riverUvs.push((x+side*width)/20,z/20);}
    if(i<80){const a=i*2;riverIndices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  mesh('Lava river beneath the floating quarry',[0,0,0],river,riverIndices,{tex:'nightworks-magma',uvs:riverUvs,fog:false});

  // Transparent radial light wraps the crater and a handful of chasm vents.
  const halo=(nm:string,p:Point,w:number,h:number,opacity:number):void=>
    mesh(nm,p,[-w/2,-h/2,0,w/2,-h/2,0,w/2,h/2,0,-w/2,h/2,0],[0,1,2,0,2,3],
      {tex:'nightworks-heat',uvs:[0,0,1,0,1,1,0,1],opacity,fog:false});
  for(let i=0;i<9;i++){
    const z=-35-i*80,x=(i%2?-1:1)*(49+(i%3)*9)+55;
    rock('nightlongisland',[x,-38,z],[35,12+(i%3)*5,44],i*31,'Basalt river outcrop');
    halo('Low red vent haze',[x,-24,z-12],68,33,.27);
  }

  // Open the horizon while retaining every authored camera heading/volume.
  data.cameraRig={camDist:8.5,camHeight:6.2,camPitch:16,camFov:60};
  data.components.push(...art);
  data.groups=[...(data.groups??[]),{id:AFTER_HOURS_ART_GROUP,nm:'Volcano and quarry surfaces',editorOnly:true}];
  data.atmosphere={...data.atmosphere,backdrop:'fog',fogNear:38,fogFar:145,fogColor:'#14182a',drawDistance:2000,
    ambientSky:'#8192c2',ambientGround:'#482231',ambientIntensity:.76,
    sunColor:'#aebde5',sunIntensity:.50,fillColor:'#99819c',fillIntensity:.28};
  return data;
}

/** Shared 3D centerpiece. Both courses use the same cache-owned Meshy model
 * and GPU atlas, with their own world-space scale and pulse clock. */
export function createNightworksVolcanoScenery(center: Point = AFTER_HOURS_VOLCANO.center, size: Point = AFTER_HOURS_VOLCANO.size): CustomComponent[] {
  const [w,h,d] = size;
  const result: CustomComponent[] = [{t:'decor',dkind:'nightvolcano',nm:'Living basalt volcano',p:[...center],s:[...size],
    solid:false,castShadow:false,yaw:0,grp:AFTER_HOURS_ART_GROUP}];
  const veil=(nm:string,p:Point,width:number,height:number,tex:string,opacity:number):void=>{
    result.push({t:'mesh',nm,p,vertices:[-width/2,-height/2,0,width/2,-height/2,0,width/2,height/2,0,-width/2,height/2,0],
      indices:[0,1,2,0,2,3],uvs:[0,0,1,0,1,1,0,1],tex,opacity,fog:false,doubleSided:true,
      solid:false,edgeGrinding:false,castShadow:false,grp:AFTER_HOURS_ART_GROUP});
  };
  veil('Breathing caldera glow',[center[0],center[1]+h*.87,center[2]+d*.11],w*.31,h*.39,'nightworks-heat',.34);
  for(let i=0;i<3;i++)veil('Slow caldera ash',[center[0]+w*(.015+i*.015),center[1]+h*(1.07+i*.115),center[2]-d*.025],
    w*(.12+i*.035),h*(.25+i*.025),'nightworks-ash',.26-i*.035);
  return result;
}
