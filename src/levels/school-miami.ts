import { CatmullRomCurve3, ShapeUtils, Vector2, Vector3 } from 'three';
import type { CustomComponent, CustomLevelData } from '../level';

type Point = [number, number, number];
type Plan = [number, number];
const C: CustomComponent[] = [];
const concrete = '#a1a9a6', asphalt = '#626e70', cream = '#c7bb9a';
const brick = '#89796b', blue = '#426f7d', coping = '#c5b584';
const lowerY = -5, roofY = 7, canopyY = 3.4;
const add = (c: CustomComponent) => { C.push(c); return c; };

// Measurements use the supplied VGCartography map's original 588 × 522 frame.
// Undo its oblique projection, including the elevation displacement. Scale is
// anchored by a 28 × 15 m basketball court, 0.76 m picnic tables and 3.2 m vert.
// These are reconstructed dimensions, not extracted proprietary level data.
export function schoolMapPoint(u: number, v: number, y = lowerY): Point {
  const a = u - 284, b = v - 288 + 3.2 * (y - canopyY), det = 4.1 * 3.2 + .72 * 1.5;
  return [(3.2 * a + 1.5 * b) / det, y, (-.72 * a + 4.1 * b) / det];
}
const plan = (p: Point): Plan => [p[0], p[2]];
const mapped = (pts: Plan[], y: number): Plan[] => pts.map(([u, v]) => plan(schoolMapPoint(u, v, y)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const pointAt = (a: Point, b: Point, t: number): Point => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

function surface(nm: string, vertices: number[], indices: number[], color: string, grp: number, extra: Partial<CustomComponent> = {}) {
  return add({ t: 'mesh', nm, p: [0, 0, 0], vertices, indices, color, tex: 'pavement', vert: false, edgeGrinding: false, grp, ...extra });
}
function floor(nm: string, outline: Plan[], y: number, color: string, grp: number, holes: Plan[][] = [], solid = true) {
  const rings = [outline, ...holes], points = rings.flat(), vertices = points.flatMap(([x, z]) => [x, y, z]);
  const indices = ShapeUtils.triangulateShape(outline.map(p => new Vector2(...p)), holes.map(h => h.map(p => new Vector2(...p))))
    .flatMap(([a, b, c]) => {
      const p = points[a], q = points[b], r = points[c];
      return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0 ? [a, c, b] : [a, b, c];
    });
  return surface(nm, vertices, indices, color, grp, { solid });
}
function slab(nm: string, x: number, z: number, w: number, d: number, top: number, base: number, color: string, grp: number) {
  return add({ t: 'platform', nm, p: [x, (top + base) / 2, z], s: [w, top - base, d], tex: 'pavement', color, edgeGrinding: false, grp });
}
function polygonBlock(nm: string, outline: Plan[], top: number, base: number, color: string, grp: number) {
  return add({ t: 'platform', nm, p: [0, (top + base) / 2, 0], s: [1, top - base, 1], pts: outline, tex: 'pavement', color, edgeGrinding: false, grp });
}
function rail(nm: string, points: Point[], grp: number, color = coping) {
  const p = points[0];
  return add({ t: 'rail', nm, p, pts: points.map(q => [q[0] - p[0], q[2] - p[2], 0, q[1] - p[1]]), color, grp });
}

// Visual details share a handful of meshes. None of the window muntins,
// fencing, stair treads or court paint adds an invisible skating obstacle.
const paint = new Map<string, { vertices: number[]; indices: number[]; color: string; grp: number }>();
function quad(points: Point[], color: string, grp: number) {
  const key = `${grp}/${color}`;
  if (!paint.has(key)) paint.set(key, { vertices: [], indices: [], color, grp });
  const b = paint.get(key)!, i = b.vertices.length / 3;
  b.vertices.push(...points.flat()); b.indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
}
function paintBox(x: number, y: number, z: number, w: number, h: number, d: number, color: string, grp: number) {
  const p: Point[] = [[x-w/2,y-h/2,z-d/2],[x+w/2,y-h/2,z-d/2],[x+w/2,y+h/2,z-d/2],[x-w/2,y+h/2,z-d/2],
    [x-w/2,y-h/2,z+d/2],[x+w/2,y-h/2,z+d/2],[x+w/2,y+h/2,z+d/2],[x-w/2,y+h/2,z+d/2]];
  for (const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) quad(face.map(i => p[i]), color, grp);
}
function stripe(a: Point, b: Point, width: number, color: string, grp: number) {
  const l = Math.hypot(b[0]-a[0], b[2]-a[2]) || 1, nx = -(b[2]-a[2])/l*width/2, nz = (b[0]-a[0])/l*width/2;
  quad([[a[0]+nx,a[1],a[2]+nz],[b[0]+nx,b[1],b[2]+nz],[b[0]-nx,b[1],b[2]-nz],[a[0]-nx,a[1],a[2]-nz]], color, grp);
}
function ribbon(nm: string, points: Point[], width: number, color: string, grp: number, extra: Partial<CustomComponent> = {}) {
  const vertices: number[] = [], indices: number[] = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0,i-1)], b = points[Math.min(points.length-1,i+1)], l = Math.hypot(b[0]-a[0],b[2]-a[2]) || 1;
    const nx = (b[2]-a[2])/l, nz = -(b[0]-a[0])/l;
    vertices.push(p[0]-nx*width/2,p[1],p[2]-nz*width/2,p[0]+nx*width/2,p[1],p[2]+nz*width/2);
    if (i) { const j = (i-1)*2; indices.push(j,j+2,j+3,j,j+3,j+1); }
  });
  return surface(nm, vertices, indices, color, grp, { doubleSided: true, ...extra });
}
function hip(nm: string, x: number, y: number, z: number, w: number, d: number, h: number, bank: number, grp: number, color = cream) {
  const vertices: number[] = [];
  for (const [width,depth,top] of [[w,d,y+h],[w+bank*2,d+bank*2,y]])
    for (const [sx,sz] of [[-1,1],[1,1],[1,-1],[-1,-1]]) vertices.push(x+sx*width/2,top,z+sz*depth/2);
  const indices = [0,1,2,0,2,3];
  for (let i=0;i<4;i++) { const j=(i+1)%4; indices.push(i,i+4,j+4,i,j+4,j); }
  surface(nm, vertices, indices, color, grp);
  for (let i=0;i<4;i++) stripe(vertices.slice(i*3,i*3+3).map((v,k)=>v+(k===1?.014:0)) as Point,
    vertices.slice(((i+1)%4)*3,((i+1)%4)*3+3).map((v,k)=>v+(k===1?.014:0)) as Point,.1,'#514c3e',grp);
}
function quarter(nm: string, points: Point[], radius: number, grp: number, options: Partial<CustomComponent> = {}) {
  const p = points[0];
  return add({ t: 'vertramp', nm, p, pts: points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),
    vkind: 'quarter', w: 0, rise: radius, arc: 90, arcSteps: 32, deck: 1, tex: 'pavement', color: cream, edgeGrinding: false, grp, ...options });
}

// The pool rims sit flush with the yard. Both holes are cut in the yard
// itself; there is no invisible flat foundation spanning either basin.
export const SCHOOL_POOLS: { name: string; centre: Point; toe: Plan[]; outer: Plan[]; bottom: number; depth: number }[] = [];
function pool(nm: string, centre: Point, toe: Plan[], depth: number, color: string) {
  const outer = toe.map((p,i): Plan => {
    const a=toe[(i+toe.length-1)%toe.length], b=toe[(i+1)%toe.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    return [centre[0]+p[0]+(b[1]-a[1])/l*(depth+1.1),centre[2]+p[1]-(b[0]-a[0])/l*(depth+1.1)];
  });
  const bottom = lowerY-depth;
  quarter(nm, toe.map(([x,z])=>[centre[0]+x,bottom,centre[2]+z]), depth, 5,
    { closed:true, deck:1, color, tex:'solid', arcSteps:40 });
  const bed=floor(`${nm} deep floor`, toe.map(([x,z])=>[x+centre[0],z+centre[2]]), bottom, color, 5);
  bed.uvs=toe.flatMap(([x,z])=>[x/.4,z/.4]);
  // Ceramic-sized tiles use measured arc-length UVs over the same 40-step
  // transition. Split the visual skin to retain the editor's mesh bounds.
  const stations=[0];for(let i=1;i<=toe.length;i++)stations.push(stations[i-1]+Math.hypot(toe[i%toe.length][0]-toe[i-1][0],toe[i%toe.length][1]-toe[i-1][1]));
  for(const start of [0,20]){
    const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
    for(let i=0;i<=toe.length;i++){
      const p=toe[i%toe.length],a=toe[(i+toe.length-1)%toe.length],b=toe[(i+1)%toe.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=(b[1]-a[1])/l,nz=-(b[0]-a[0])/l;
      for(let j=start;j<=start+20;j++){const angle=j/40*Math.PI/2;vertices.push(centre[0]+p[0]+nx*depth*Math.sin(angle),bottom+depth*(1-Math.cos(angle)),centre[2]+p[1]+nz*depth*Math.sin(angle));uvs.push(stations[i]/.4,angle*depth/.4);}
      if(i)for(let j=0;j<20;j++){const k=(i-1)*21+j;indices.push(k,k+21,k+22,k,k+22,k+1);}
    }
    surface(`${nm} ceramic tiles`,vertices,indices,color,5,{solid:false,uvs,doubleSided:true,depthBias:-1});
  }
  SCHOOL_POOLS.push({name:nm,centre,toe,outer,bottom,depth});
  // Subtle square tile grid on the basin floor, with a dark drain.
  paintBox(centre[0],bottom+.018,centre[2],.3,.012,.7,'#344f5a',5);
  return outer;
}
const kidneyToe: Plan[] = Array.from({length:64},(_,i)=>{
  const a=i/64*Math.PI*2, bend=.6*Math.sin(a)*Math.sin(a);
  return [Math.cos(a)*(1.8+.35*Math.sin(a))+bend,Math.sin(a)*7.1];
});
const kidneyCentre = schoolMapPoint(62,159,lowerY);
const kidneyHole = pool('Deep oval pool', kidneyCentre, kidneyToe, 3.2, '#748caa');
const squareToe: Plan[]=[];
for (const [x,z,a] of [[3.4,3.4,0],[-3.4,3.4,.5],[-3.4,-3.4,1],[3.4,-3.4,1.5]])
  for(let i=0;i<=8;i++){const t=(a+i/16)*Math.PI;squareToe.push([x+Math.cos(t)*1.1,z+Math.sin(t)*1.1]);}
const squareCentre = schoolMapPoint(149,182,lowerY);
const squareHole = pool('Square swimming pool', squareCentre, squareToe, 2.8, '#7995ad');

// Drainage trench: banks, floor and lips form one swept surface. Footbridges
// cross the open trench, so skating below a bridge and jumping over it work.
export const SCHOOL_DITCH = { a:schoolMapPoint(329,127,lowerY), b:schoolMapPoint(371,228,lowerY), depth:1.5, half:1.5, radius:1.5/(1-Math.cos(65*Math.PI/180)) };
const ditch = SCHOOL_DITCH, dl=Math.hypot(ditch.b[0]-ditch.a[0],ditch.b[2]-ditch.a[2]);
const dn: Plan=[(ditch.b[2]-ditch.a[2])/dl,-(ditch.b[0]-ditch.a[0])/dl];
const ditchWidth=ditch.half+ditch.radius*Math.sin(65*Math.PI/180);
const ditchHole: Plan[]=[
  [ditch.a[0]-dn[0]*ditchWidth,ditch.a[2]-dn[1]*ditchWidth], [ditch.b[0]-dn[0]*ditchWidth,ditch.b[2]-dn[1]*ditchWidth],
  [ditch.b[0]+dn[0]*ditchWidth,ditch.b[2]+dn[1]*ditchWidth], [ditch.a[0]+dn[0]*ditchWidth,ditch.a[2]+dn[1]*ditchWidth],
];
quarter('Drainage ditch · uninterrupted banked bed', [ditch.a,ditch.b].map(p=>[p[0],lowerY-ditch.depth,p[2]]),ditch.radius,4,
  {vkind:'half',w:ditch.half,arc:65,deck:0,vert:false,rails:false,color:'#777b70'});
export const SCHOOL_BRIDGES: {p:Point; halfSpan:number; width:number}[]=[];
for (const [i,t] of [.22,.42,.78].entries()) {
  const p=pointAt(ditch.a,ditch.b,t), halfSpan=ditchWidth+1.3, width=i===2?4.2:3.5;
  const points=Array.from({length:25},(_,j):Point=>{
    const u=j/24*2-1;return[p[0]+dn[0]*halfSpan*u,lowerY+.42*(1+Math.cos(Math.PI*u))/2,p[2]+dn[1]*halfSpan*u];
  });
  ribbon(`Footbridge ${i+1} · arched crossing`,points,width,cream,4);
  for(const side of [-1,1])rail(`Footbridge ${i+1} coping ${side}`,points.map(q=>[q[0]-dn[1]*side*width/2,q[1]+.12,q[2]+dn[0]*side*width/2]),4);
  SCHOOL_BRIDGES.push({p,halfSpan,width});
}
// Broad banks at the trench ends make it escapable at any speed.
for (const [p,sign] of [[ditch.a,1],[ditch.b,-1]] as const) {
  const tx=(ditch.b[0]-ditch.a[0])/dl*sign,tz=(ditch.b[2]-ditch.a[2])/dl*sign;
  ribbon('Ditch end roll-out',Array.from({length:17},(_,i)=>[p[0]+tx*i/16*4,lowerY-ditch.depth*smooth(i/16),p[2]+tz*i/16*4] as Point),ditch.half*2,asphalt,4);
}
// The long space between the second and third bridges contains the
// original launch wedge: approach along the bed and ollie over bridge 3.
export const SCHOOL_DITCH_KICKER={p:pointAt(ditch.a,ditch.b,.64),run:4.2,rise:1.2,direction:[(ditch.b[0]-ditch.a[0])/dl,0,(ditch.b[2]-ditch.a[2])/dl] as Point};
{
  const k=SCHOOL_DITCH_KICKER,h=k.direction;
  add({t:'ramp',nm:'Over a Footbridge · ditch launch wedge',p:[k.p[0],lowerY-ditch.depth,k.p[2]],len:k.run,rise:k.rise,w:2.8,yaw:Math.atan2(-h[0],-h[2])*180/Math.PI,tex:'wood',color:'#a28e6b',edgeGrinding:false,grp:4});
}

const yardOutline=mapped([[28,107],[53,100],[84,109],[163,83],[186,84],[269,108],[300,90],[320,46],[342,32],[485,57],[516,77],[513,110],[496,132],[512,164],[536,176],[575,195],[558,252],[502,266],[473,256],[447,278],[302,281],[273,263],[246,235],[225,216],[199,213],[168,227],[89,224],[9,189],[16,143]],lowerY);
floor('Lower campus · cut-out pool and ditch foundation',yardOutline,lowerY,concrete,1,[kidneyHole,squareHole,ditchHole]).depthBias=2;
polygonBlock('Campus bedrock below excavated pools',yardOutline,-9.8,-12,'#777669',1);
for(let i=0;i<yardOutline.length;i++){const a=yardOutline[i],b=yardOutline[(i+1)%yardOutline.length];quad([[a[0],-5,a[1]],[b[0],-5,b[1]],[b[0],-10,b[1]],[a[0],-10,a[1]]],'#868576',1);}
const upperOutline: Plan[]=[[-6,-7],[44,-7],[51,6],[85,6],[86,18],[85,45],[79,56],[18,56],[14,15],[-6,15]];
polygonBlock('Upper school court and gym apron',upperOutline,0,lowerY,cream,1);
floor('Gym paved service apron',[[18,12],[77,12],[84,17],[83,46],[77,54],[20,54]],.008,asphalt,1,[],false);
// No fence or curb crosses the two downhill routes.
export const SCHOOL_STAIRS={a:[42,0,-5] as Point,b:[37,lowerY,-37] as Point,width:11,railOffset:-1.8};
const stairs=SCHOOL_STAIRS;
const stairLine=Array.from({length:65},(_,i)=>{
  const t=i/64;return[mix(stairs.a[0],stairs.b[0],t),mix(0,lowerY,smooth(t)),mix(stairs.a[2],stairs.b[2],t)] as Point;
});
ribbon('Handicap slope · eased top and bottom',stairLine,stairs.width,asphalt,2);
// Steps occupy the inner half visually; the smooth ride surface prevents
// high-speed stair vibration without changing either endpoint or gradient.
for(let i=3;i<62;i+=2){const a=stairLine[i],b=stairLine[i+1];stripe([a[0]-4.3,a[1]+.025,a[2]],[a[0]-.3,a[1]+.025,a[2]],.14,'#c6c4b0',2);stripe([b[0]-4.3,b[1]+.025,b[2]],[b[0]-.3,b[1]+.025,b[2]],.06,'#727974',2);}
export const SCHOOL_MAIN_RAIL=stairLine.filter((_,i)=>i%4===0).map(p=>[p[0]+stairs.railOffset,p[1]+.8,p[2]] as Point);
rail('Handicap Ramp Rail · green downhill handrail',SCHOOL_MAIN_RAIL,2,'#527667');

export const SCHOOL_WEST_DESCENT:Point[]=[[0,0,-4],[-3,0,-9],[-7,-.7,-15],[-13,-2.6,-21],[-20,-4.3,-27],[-29,-5,-31],[-36,-5,-31]];
const westDescent=SCHOOL_WEST_DESCENT;
ribbon('West descent · long planter road',westDescent,9,asphalt,2);
rail('Long Ass Rail · outside planter lip',westDescent.map(p=>[p[0]-3.9,p[1]+.45,p[2]+1.2]),2,'#bead8c');
rail('Hall Pass · inside planter transfer',[[1,.5,-6],[-3,.5,-12],[-8,-.3,-17],[-13,-2,-22]],2);
export const SCHOOL_WEST_WEDGE={p:schoolMapPoint(233,214,-3.85),width:5.6,depth:1.1,rise:1.15,bank:2.1};
{
  const k=SCHOOL_WEST_WEDGE;
  hip('Funbox to Rail · west-descent wedge',k.p[0],lowerY,k.p[2],k.width,k.depth,k.rise,k.bank,7,'#ad977a');
}
// Upper grass terraces stop short of the bank and the landing lanes.
polygonBlock('Admin lawn',[[2,-25],[34,-25],[37,-7],[2,-7]],.15,-5,'#65835b',2);
slab('East approach lawn',51,-10,10,27,.12,-5,'#6c8459',2);

// Original start: a narrow blue canopy across the front of the classrooms.
export const SCHOOL_START_CANOPY:Point[]=[[257,284],[290,291],[327,299],[353,310],[372,311]].map(([u,v])=>schoolMapPoint(u,v,canopyY));
const startCanopy=SCHOOL_START_CANOPY;
ribbon('Start canopy · Gimme Gap',startCanopy,3.6,blue,2,{tex:'metal'});
for(const p of startCanopy.slice(0,-1)){paintBox(p[0],1.6,p[2],.17,3.2,.17,'#536566',2);}
// Long canopy is separate from the ramp/handrail underneath it.
export const SCHOOL_LONG_CANOPY:Point[]=[[45,3.4,16],[45,3.4,2],[43,2.8,-8],[40,.8,-21],[37,-1.6,-35]];
ribbon('Long blue canopy · secret-tape line',SCHOOL_LONG_CANOPY,3.7,blue,2,{tex:'metal'});
for(let k=0;k<SCHOOL_LONG_CANOPY.length-1;k++)for(let i=0;i<10;i++){
  const p=pointAt(SCHOOL_LONG_CANOPY[k],SCHOOL_LONG_CANOPY[k+1],i/10);
  stripe([p[0]-1.85,p[1]+.012,p[2]],[p[0]+1.85,p[1]+.012,p[2]],.05,'#78919a',2);
}
for(const [i,p] of SCHOOL_LONG_CANOPY.entries()){const base=i<2?0:i===2?-.3:i===3?-2.5:-5;paintBox(p[0]+1.5,(p[1]+base)/2,p[2],.16,p[1]-base,.16,'#657a79',2);}

// Buildings are solid at ground level, with deliberately accessible roofs.
const admin=slab('Main classroom block',22,-12.5,34,12,5,0,brick,3);
void admin;
slab('Main classroom roof',22,-12.5,34.2,12.2,5.12,4.85,concrete,3);
for(const y of [1.5,3.5])for(let x=6;x<39;x+=2.4){paintBox(x,y,-6.475,1.65,.85,.05,'#41565b',3);paintBox(x,y,-6.43,.09,.85,.04,'#c2bca6',3);}
const classroomPlan=mapped([[126,121],[174,103],[236,115],[236,142],[272,148],[272,172],[306,178],[306,192],[292,190],[292,181],[280,179],[278,200],[312,205],[329,194],[324,231],[291,211],[224,198],[224,157],[209,153],[209,141],[151,140]],0);
polygonBlock('Zigzag classroom wings and Hall Pass alcove',classroomPlan,0,lowerY,brick,3);
floor('Classroom flat roofs',classroomPlan,.035,concrete,3);
for(let i=0;i<classroomPlan.length;i++){
  const a=classroomPlan[i],b=classroomPlan[(i+1)%classroomPlan.length],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(l<5)continue;
  const nx=(b[1]-a[1])/l*.035,nz=-(b[0]-a[0])/l*.035;
  for(let s=1.3;s<l-.9;s+=2.1){const t=s/l,cx=mix(a[0],b[0],t),cz=mix(a[1],b[1],t),dx=(b[0]-a[0])/l*.65,dz=(b[1]-a[1])/l*.65;
    quad([[cx-dx+nx,-4.7,cz-dz+nz],[cx+dx+nx,-4.7,cz+dz+nz],[cx+dx+nx,-.55,cz+dz+nz],[cx-dx+nx,-.55,cz-dz+nz]],'#405255',3);
    stripe([cx-dx+nx,-2.6,cz-dz+nz],[cx+dx+nx,-2.6,cz+dz+nz],.08,'#bdbdaa',3);
  }
}

// Long opposing transitions behind the classroom wings, including the bend
// into the rear playground. Source order matters: pools -> Huge Rail -> back
// funboxes -> Park Gap -> stair/kicker landing.
const longPipeMap:Plan[]=[[62,107],[86,106],[124,92],[164,81],[181,82],[235,93],[266,101],[286,97],[300,80],[308,61],[320,45],[337,38]];
const longPipe=longPipeMap.map(([u,v])=>schoolMapPoint(u,v,lowerY));
export const SCHOOL_LONG_HALFPIPE=longPipe;
const backPipeMap:Plan[]=[[337,38],[363,42],[413,51],[470,61],[493,69],[502,82],[501,99],[493,115]];
const backPipe=backPipeMap.map(([u,v])=>schoolMapPoint(u,v,lowerY));
const perimeterPipe=[...longPipe,...backPipe.slice(1)];
// The flat lane stays continuous when the inner transition is split for
// the Mini Gap. Sampling the same outer spline prevents a floor seam at
// the bend from opening between independently swept quarterpipe sections.
const laneCurve=new CatmullRomCurve3(perimeterPipe.map(p=>new Vector3(...p)),false,'centripetal',.5);
const laneSteps=Math.max(8,Math.round(laneCurve.getLength()/1.6));
ribbon('Winding corridor · continuous flat lane',laneCurve.getSpacedPoints(laneSteps).map(p=>p.toArray() as Point),6.2,asphalt,6,{depthBias:-1});
quarter('Long winding perimeter · continuous outer vert',perimeterPipe,3,6,{w:3.1,deck:1.1,curve:'spline',color:'#aba58d'});
// The inner transition has the source's small transfer opening at the
// playground bend. The outer perimeter remains continuous across it.
const miniGapAt=longPipe[9],miniBefore=pointAt(miniGapAt,longPipe[8],1.3/Math.hypot(longPipe[8][0]-miniGapAt[0],longPipe[8][2]-miniGapAt[2]));
const miniAfter=pointAt(miniGapAt,longPipe[10],1.3/Math.hypot(longPipe[10][0]-miniGapAt[0],longPipe[10][2]-miniGapAt[2]));
export const SCHOOL_MINI_GAP={before:miniBefore,after:miniAfter,width:2.6};
quarter('Long winding halfpipe · Huge Rail inner wall',[...longPipe.slice(0,9),miniBefore].reverse(),3,6,{w:3.1,deck:1.1,curve:'spline',color:'#aba58d'});
quarter('Mini Gap · playground inner quarter',[miniAfter,...longPipe.slice(10)].reverse(),3,6,{w:3.1,deck:1.1,curve:'spline',color:'#aba58d'});
// Perimeter quarter curves back into the open courtyard, with a genuine gap
// before the short return section at the right edge of the reference.
const parkReturn=[[493,133],[494,146],[505,154]].map(([u,v])=>schoolMapPoint(u,v,lowerY));
quarter('Park Gap return quarter',parkReturn,3,6,{w:3.1,deck:1.1,curve:'spline',color:'#b7af95'});
// Physical fences are outside the transition decks, not in the riding line.
function fenceAlong(points:Point[], offset:number, grp:number, elevation=3) {
  const outside=points.map((p,i):Point=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
    return[p[0]+(b[2]-a[2])/l*offset,p[1]+elevation,p[2]-(b[0]-a[0])/l*offset];
  });
  const p=outside[0];
  add({t:'wallpath',nm:'School perimeter fence',p,pts:outside.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),w:.28,rise:3.2,curve:'spline',color:'#837d70',tex:'wood',containment:true,collisionHeight:6,grp});
}
fenceAlong(perimeterPipe,7.4,6);fenceAlong(parkReturn,7.4,6);
{
  const pts=mapped([[28,115],[17,150],[10,187]],lowerY),p:Point=[pts[0][0],lowerY,pts[0][1]];
  add({t:'wallpath',nm:'Pool-side boundary and billboard wall',p,pts:pts.map(q=>[q[0]-p[0],q[1]-p[2]]),w:.32,rise:3.2,color:'#8c8771',tex:'wood',grp:5});
}

// Five original picnic-table lines. Seats are separate low rideable ledges;
// only the real table/seat edges are grindable, never an invisible box rim.
export const SCHOOL_TABLES: {name:string;p:Point;length:number;yaw:number}[]=[];
function table(nm:string,p:Point,yaw=0) {
  const rad=yaw*Math.PI/180,cs=Math.cos(rad),sn=Math.sin(rad),g=7,length=3.2;
  const at=(x:number,y:number,z:number):Point=>[p[0]+x*cs+z*sn,p[1]+y,p[2]-x*sn+z*cs];
  add({t:'platform',nm,p:at(0,.69,0),s:[1.05,.14,length],yaw,tex:'wood',color:'#966b55',edgeGrinding:false,grp:g});
  for(const s of [-1,1]) {
    add({t:'platform',nm:`${nm} bench`,p:at(s*.91,.39,0),s:[.4,.12,length],yaw,tex:'wood',color:'#a67e63',edgeGrinding:false,grp:g});
    rail(`${nm} tabletop edge ${s}`,[at(s*.48,.79,-length/2),at(s*.48,.79,length/2)],g,'#bb9b78');
    for(const z of [-1,1]){const q=at(s*.4,.3,z);paintBox(q[0],q[1],q[2],.09,.6,.09,'#4b5a54',g);}
  }
  SCHOOL_TABLES.push({name:nm,p,length,yaw});
}
const startTable=schoolMapPoint(343,300,.76);startTable[1]=0;
table('Table 1 · below the starting canopy',startTable,90);
table('Table 2 · stair landing',schoolMapPoint(450,216),70);
table('Table 3 · footbridge court',schoolMapPoint(329,186),90);
table('Table 4 · back playground',schoolMapPoint(310,92),65);
table('Table 5 · square-pool corner',schoolMapPoint(219,184),65);

// Four planters run between the canopy and the classroom, with four more
// beneath/in front of the canopy. Trace their visible tops at their actual
// elevation so the canopy drop leads into the Gimme/Planter Gap grind line.
export const SCHOOL_PLANTERS:{p:Point;width:number;depth:number}[]=[];
for(const [i,[u,v,vertical]] of [[328,287,0],[362,294,0],[396,302,0],[431,310,0],[318,307,0],[308,322,1],[370,317,0],[405,325,0]].entries()){
  const p=schoolMapPoint(u,v,.55),[x,,z]=p,w=vertical?1.65:4,d=vertical?4:1.65;
  SCHOOL_PLANTERS.push({p,width:w,depth:d});
  slab(`Gimme Gap planter ${i+1}`,x,z,w,d,.55,0,cream,7);
  slab(`Planter ${i+1} soil`,x,z,w-.38,d-.38,.565,.5,'#5e6f4b',7);
  for(const side of [-1,1])rail(`Planter Gap ledge ${i+1}/${side}`,vertical?[[x+side*w/2,.6,z-d/2],[x+side*w/2,.6,z+d/2]]:[[x-w/2,.6,z+side*d/2],[x+w/2,.6,z+side*d/2]],7);
}
// Three pyramids around the rear playground, one beside the ditch.
for(const [i,u,v] of [[0,331,74],[1,411,69],[2,471,106],[3,398,151],[4,305,137]]){
  const p=schoolMapPoint(u,v);hip(`Courtyard funbox ${i+1}`,p[0],p[1],p[2],2.4,2.4,1.15,2.6,7);
}
const signA=schoolMapPoint(352,78),signB=schoolMapPoint(444,94);
add({t:'wallpath',nm:'Playground Rail · long freestanding mural',p:signA,pts:[[0,0],[signB[0]-signA[0],signB[2]-signA[2]]],w:.45,rise:2.5,color:'#75837c',tex:'pavement',grp:7});
rail('Playground Rail coping',[[signA[0],-2.45,signA[2]],[signB[0],-2.45,signB[2]]],7);
const signLen=Math.hypot(signB[0]-signA[0],signB[2]-signA[2]);
for(let i=0;i<12;i++){
  const a=pointAt(signA,signB,i/12),b=pointAt(signA,signB,(i+.82)/12);
  const nz=(signB[0]-signA[0])/signLen*.24,nx=-(signB[2]-signA[2])/signLen*.24;
  quad([[a[0]+nx,-4.7,a[2]+nz],[b[0]+nx,-4.7,b[2]+nz],[b[0]+nx,-2.8,b[2]+nz],[a[0]+nx,-2.8,a[2]+nz]],['#b9bdb1','#536c76','#8d9588'][i%3],7);
}

export const SCHOOL_KICKER={x:32.6,z:-41.7,gap:3.2,width:5.8,rise:1.05,run:4.2,yaw:36.86989765,direction:[-.6,0,-.8] as Point};
{
  const k=SCHOOL_KICKER;
  const offset=k.gap/2+k.run/2;
  add({t:'ramp',nm:'Kicker Gap · downhill takeoff',p:[k.x-k.direction[0]*offset,lowerY,k.z-k.direction[2]*offset],len:k.run,rise:k.rise,w:k.width,yaw:k.yaw,tex:'wood',color:'#b99773',grp:7,edgeGrinding:false});
  add({t:'ramp',nm:'Kicker Gap · facing landing',p:[k.x+k.direction[0]*offset,lowerY,k.z+k.direction[2]*offset],len:k.run,rise:k.rise,w:k.width,yaw:k.yaw+180,tex:'wood',color:'#b99773',grp:7,edgeGrinding:false});
}
// Pool-to-pool rail follows the shared deck, leaving room to roll in at
// either end. Low diving boards project into the deep oval at the far wall.
const swimRail=[schoolMapPoint(111,149),schoolMapPoint(96,184)];
rail('Swim Team Gap · pool transfer rail',swimRail.map(p=>[p[0],p[1]+.55,p[2]]),5);
for(const z of [-4,5]){
  const x=kidneyCentre[0]-4.25,cz=kidneyCentre[2]+z;
  slab('Pool diving-board pedestal',x-1.25,cz,1.1,1.2,-4.4,-5,cream,5);
  slab('Pool diving board',x,cz,3.4,.72,-4.25,-4.4,'#62858c',5);
}

// Gym: an actual interior under its skating roof. Open doors at the north
// connect to the upper court without a portal, scene switch or loading seam.
export const SCHOOL_GYM={minX:22.6,maxX:74.5,minZ:14.4,maxZ:49.1,roofY,doorX:31,court:{x:48.5,z:31.75,width:15,length:28}};
const g=8;
slab('Gym roof deck',48.55,31.75,51.9,34.7,roofY,roofY-.45,concrete,g);
slab('Gym south wall',48.55,48.9,51.9,.45,6.55,0,brick,g);
slab('Gym west wall',22.8,31.75,.45,34.3,6.55,0,brick,g);
slab('Gym east wall',74.3,31.75,.45,34.3,6.55,0,brick,g);
for(const [a,b] of [[22.6,26],[36,63],[71,74.5]])slab('Gym entrance wall',(a+b)/2,14.6,b-a,.45,6.55,0,brick,g);
for(const [a,b] of [[26,36],[63,71]])slab('Gym door lintel',(a+b)/2,14.6,b-a,.45,6.55,4.2,brick,g);
floor('Gym maple basketball court',[[41,17.75],[56,17.75],[56,45.75],[41,45.75]],.012,'#e6c999',g,[],false).tex='wood';
for(const x of [40.4,56.6])paintBox(x,.027,31.75,1.1,.014,29.4,'#87464a',g);
for(const z of [17.2,46.3])paintBox(48.5,.027,z,17.3,.014,1.1,'#87464a',g);
stripe([41,.04,31.75],[56,.04,31.75],.08,'#e0d9bd',g);
for(const z of [18.4,45.1]){
  const toward=z<30?1:-1;
  stripe([45.7,.04,z],[45.7,.04,z+toward*5.8],.09,'#e0d9bd',g);stripe([51.3,.04,z],[51.3,.04,z+toward*5.8],.09,'#e0d9bd',g);
  stripe([45.7,.04,z+toward*5.8],[51.3,.04,z+toward*5.8],.09,'#e0d9bd',g);
  paintBox(48.5,3.3,z,1.8,1.05,.15,'#d5d2ba',g);paintBox(48.5,1.7,z-.4*toward,.12,3.4,.12,'#405b52',g);
  paintBox(48.5,2.95,z+.35*toward,.58,.06,.52,'#b97148',g);
}
for(let i=0;i<48;i++){const a=i/48*Math.PI*2,b=(i+1)/48*Math.PI*2;stripe([48.5+Math.cos(a)*1.8,.04,31.75+Math.sin(a)*1.8],[48.5+Math.cos(b)*1.8,.04,31.75+Math.sin(b)*1.8],.08,'#e0d9bd',g);}
quarter('Gym west wooden quarterpipe',[[30,0,45],[30,0,19]],3.4,g,{deck:1.5,color:'#c4a77c',tex:'wood'});
quarter('Gym east dark quarterpipe',[[66,0,19],[66,0,45]],3.4,g,{deck:1.5,color:'#626966',tex:'wood'});
// Tall windows keep the interior readable without adding lights/physics.
for(let x=25;x<74;x+=6){paintBox(x,5.25,48.65,3,1.15,.08,'#86a7ad',g);paintBox(x,5.25,14.86,3,1.15,.08,'#86a7ad',g);}

// Roof perimeter transitions leave the east access lane genuinely open.
// The small north-west section curves around the corner before ending at
// Mini Gap. The long north coping resumes nearer the west end of the roof,
// leaving the air-conditioner/plank line east of the gap.
export const SCHOOL_ROOF_MINI_GAP={left:[33.5,roofY,18] as Point,right:[39,roofY,18] as Point};
quarter('Gym roof west return · Mini Gap takeoff',[[27.8,roofY,45],[27.1,roofY,20],[27.7,roofY,17.8],[29,roofY,17.7],SCHOOL_ROOF_MINI_GAP.left],1.8,9,{color:'#969d96',deck:.7,curve:'spline'});
quarter('Gym roof north quarter · Mini Gap receiving coping',[SCHOOL_ROOF_MINI_GAP.right,[71,roofY,18]],1.8,9,{color:'#969d96',deck:.7});
quarter('Gym roof south quarter',[[71,roofY,46],[27,roofY,46]],1.8,9,{color:'#969d96',deck:.7});
quarter('Gym roof east upper quarter',[[71,roofY,20],[71,roofY,23]],1.8,9,{color:'#969d96',deck:.7});
quarter('Gym roof east lower quarter',[[71,roofY,34],[71,roofY,45]],1.8,9,{color:'#969d96',deck:.7});
// A distinct small roof sits across the north coping, east of the long
// awning. Its south edge is open for Roof 2 Roof; the other two sides have
// transitions and a fence. It is not a continuation of the access hill.
export const SCHOOL_BONUS_ROOF={minX:55.8,maxX:70.25,minZ:-2.5,maxZ:9.9,y:roofY};
{
  const b=SCHOOL_BONUS_ROOF;
  slab('Roof 2 Roof · separate bonus roof',(b.minX+b.maxX)/2,(b.minZ+b.maxZ)/2,b.maxX-b.minX,b.maxZ-b.minZ,b.y,0,brick,9);
  floor('Bonus roof skating surface',[[b.minX,b.minZ],[b.maxX,b.minZ],[b.maxX,b.maxZ],[b.minX,b.maxZ]],b.y+.015,concrete,9,[],false);
  const rim:Point[]=[[57.6,b.y,.2],[65.4,b.y,.2],[67.5,b.y,1.5],[67.8,b.y,4],[67.8,b.y,9.2]];
  quarter('Bonus roof · north and east quarter',rim,1.8,9,{curve:'spline',color:'#969d96',deck:.65});
  fenceAlong(rim,2.7,9,1.8);
  add({t:'ramp',nm:'Bonus roof · small return wedge',p:[57.7,b.y,4.5],len:4.8,rise:1.4,w:3.4,yaw:0,tex:'wood',color:'#ad9579',edgeGrinding:false,grp:9});
}
// The east service hill climbs from the rear alley toward the front of the
// gym. Its top turns left through the opening in the roof's east coping,
// lining up the air-conditioner kicker. Brake for the turn as in free skate.
export const SCHOOL_ROOF_ACCESS:Point[]=[];
for(let i=0;i<=40;i++){const t=i/40;SCHOOL_ROOF_ACCESS.push([80,7*smooth(t),mix(53,34,t)]);}
for(let i=1;i<=32;i++){const a=i/32*Math.PI/2;SCHOOL_ROOF_ACCESS.push([72+8*Math.cos(a),7,34-8*Math.sin(a)]);}
SCHOOL_ROOF_ACCESS.push([68,7,26]);
ribbon('Gym service hill · ground-to-roof return',SCHOOL_ROOF_ACCESS,7.6,asphalt,9);
rail('Service hill outside rail',SCHOOL_ROOF_ACCESS.slice(0,40).filter((_,i)=>i%4===0).map(p=>[p[0]+3.65,p[1]+.5,p[2]]),9);
slab('Gym roof air conditioner',54,27.5,8.5,6.2,9.1,roofY,'#566f68',9);
for(let z=25;z<31;z+=.6)paintBox(54,9.12,z,7.6,.04,.13,'#394f4d',9);
add({t:'ramp',nm:'Over the Air Conditioner · east kicker',p:[63,roofY,27.5],len:5.8,rise:2.1,w:6.2,yaw:90,color:'#ad9579',tex:'wood',edgeGrinding:false,grp:9});
add({t:'ramp',nm:'Over the Air Conditioner · west receiver',p:[45,roofY,27.5],len:5.8,rise:2.1,w:6.2,yaw:270,color:'#ad9579',tex:'wood',edgeGrinding:false,grp:9});
rail('Air-conditioner approach green rail',[[69,7.8,27.5],[63,7.8,27.5],[59.7,9.25,27.5]],9,'#527667');
// Clear the north roof edge before descending to the awning. A direct
// diagonal to the low canopy would run through the solid gym roof.
export const SCHOOL_ROOF_PLANK:Point[]=[[51,9.12,24.5],[45,9.02,15.3],[45,3.4,7.6]];
ribbon('Roof to Awning · wooden connecting plank',SCHOOL_ROOF_PLANK,1.2,'#a48a62',9,{tex:'wood'});
rail('Roof to Awning · plank grind',SCHOOL_ROOF_PLANK.map(p=>[p[0],p[1]+.06,p[2]]),9);
// Four-sided skylight: each glass slope is rideable, and the panes are only paint.
hip('Gym skylight hip',49,roofY,39.5,4.8,5.2,1.45,1.5,9,'#4e6970');
for(const x of [46.6,49,51.4])paintBox(x,8.47,39.5,.1,.045,5.1,'#b9b4a0',9);
for(const z of [37,39.5,42])paintBox(49,8.47,z,4.8,.045,.1,'#b9b4a0',9);
for(const [i,x,z,h] of [[0,32,30,.85],[1,32,35,.8],[2,65,40,.7]])hip(`Roof low vent hip ${i+1}`,x,roofY,z,1.4,2,h,1.3,9,'#7d7c66');
// Low garbage rails in the back service alley, below the roof line.
hip('West dumpster approach',18,0,34,2.3,3,1,2,10,'#6b796d');
hip('West dumpster landing',18,0,42,2.3,3,1,2,10,'#6b796d');
rail('Dumpster Rail Gap · takeoff',[[18,.55,28],[18,1.1,32],[18,1.1,35.5]],10);
rail('Dumpster Rail Gap · landing',[[18,1.1,40.5],[18,1.1,43],[18,.55,47]],10);
export const SCHOOL_GARBAGE_ROW:Plan[]=[[18.8,47.9],[18.8,48.6],[18.8,49.3],[18.9,50],[19.2,50.7],[19.6,51.3],[20.2,51.8],[20.9,52.1],[21.6,52.2],[23.3,52.2]];
for(const [i,[x,z]] of SCHOOL_GARBAGE_ROW.entries()){
  slab(`Garbage Ollie · low crate ${i+1}`,x,z,.68,.64,.48,0,'#657451',10);
  paintBox(x,.49,z,.72,.025,.68,'#87956c',10);
  for(const side of [-1,1])paintBox(x+side*.3,.25,z,.045,.4,.67,'#485a43',10);
}
quarter('Gym rear alley quarter',[[26,0,52.5],[71,0,52.5]],2.2,10,{color:'#929782',deck:.8});

// Rear classroom forms the far skyline beyond the playground sign.
const rearCentre=schoolMapPoint(414,50,-1.8);
slab('Rear classroom facade',rearCentre[0],rearCentre[2],30,5,-1.8,lowerY,brick,3);
slab('Rear blue classroom roof',rearCentre[0],rearCentre[2],30.3,5.3,-1.65,-1.85,blue,3);
for(let i=-13;i<=13;i+=2.6)paintBox(rearCentre[0]+i,-3.8,rearCentre[2]+2.53,1.2,1.4,.05,'#465b60',3);

// Recovery is available at each session without forcing a linear course.
// Native free-skate has no finish trigger: crossing the original skating
// lines should never unexpectedly end a run.
export const SCHOOL_CHECKPOINTS:Point[]=[[6,0,9],[26,-5,-39],[-52,-5,-23],[62,7,38],[37,0,31]];
for(const [i,p] of SCHOOL_CHECKPOINTS.entries())add({t:'checkpoint',nm:['Upper court','Lower courtyard','Pool deck','Gym roof','Gym interior'][i],p,grp:11});
// Native skateparks take their initial facing from a travel zone; camera
// nodes describe the course but do not override the free-skate heading.
add({t:'zone',nm:'Starting canopy · face the Gimme Gap',p:[10,canopyY,0],s:[29,1,4.2],dir:'E',grp:11});
for(const p of [[-3,canopyY,0],[16,canopyY,1],[39,0,-5],[37,-5,-38],[10,-5,-52],[-35,-5,-58],[-61,-5,-32]] as Point[])add({t:'camnode',p,grp:11});

for(const batch of paint.values())surface('School architectural detail',batch.vertices,batch.indices,batch.color,batch.grp,{solid:false,tex:'solid',doubleSided:true,castShadow:false});
export const SCHOOL_MIAMI_LEVEL:CustomLevelData={
  v:1,name:'School · Miami',spawn:[.5,canopyY+.08,0],killY:-18,sky:'day',skatepark:true,
  keepPlayFog:true,
  atmosphere:{fogEnabled:true,fogNear:160,fogFar:340,fogColor:'#b3c1bc',backdrop:'fog',ambientSky:'#e0eced',ambientGround:'#7b8071',ambientIntensity:1.15,sunColor:'#fff0d1',sunIntensity:1.35,fillColor:'#a6c8d0',fillIntensity:.4,drawDistance:430,shadowStrength:.65},
  components:C,
  groups:['Campus foundation','Start and downhill routes','Classrooms','Drainage ditch and footbridges','Swimming pools','Long halfpipe and perimeter','Tables and street obstacles','Gym interior','Gym roof and secret-tape route','Service alley','Session recovery'].map((nm,i)=>({id:i+1,nm,editorOnly:true})),
};
