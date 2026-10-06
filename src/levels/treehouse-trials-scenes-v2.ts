import * as THREE from 'three';
import {exactTreehouseSupport} from './treehouse-exact-support';
import type { CustomComponent } from '../level';

type P = [number, number, number];
const C: CustomComponent[] = [];
const G = { landscape: 16, planting: 17, craft: 18, cavern: 19, camera: 7 };
const X = 35;
const r = (n: number) => Math.round(n * 100000) / 100000;
export const TREEHOUSE_TRIALS_CAVE_EXTENSION_V2 = 30;
export const TREEHOUSE_TRIALS_PIPE_V2 = { x: X, y: -7.2, z: -349, authoringZ: -319, length: 46, flat: 1.1, radius: 4.2, deck: 1.05 };
export const TREEHOUSE_TRIALS_SKYLIGHT_POOLS_V2: readonly P[] = [[35,-7.2,-329],[35,-7.2,-345],[35,-7.2,-364],[36,-10.5,-392]];
const add = (c: CustomComponent) => C.push(c);
// Ratios measured from the accepted Meshy meshes, rather than imagined box
// defaults. Natural forms keep their source silhouette when width changes.
const naturalRatios: Record<string, [number, number]> = {
  trialsv2treea:[17.766/26,25.911/26],trialsv2treeb:[16.741/26,17.709/26],
  trialsv2crowna:[11.292/26,23.015/26],trialsv2crownb:[9.405/26,1],
  trialsv2groundcovera:[1.043/5,2.581/5],trialsv2groundcoverb:[1.826/5,4.516/5],
  trialsv2ferna:[1.601/3,2.798/3],trialsv2fernb:[1.838/3,2.957/3],
  trialsv2earthbanka:[1.316/8,3.996/8],trialsv2earthbankb:[1.628/8,3.149/8],
  trialsv2cavewalla:[7.468/12,6.705/12],trialsv2cavewallb:[11.708/12,7.415/12],
  trialsv2caveroofa:[8.348/18,13.766/18],trialsv2caveroofb:[6.26/18,9.006/18],
};
function prop(kind: string, p: P, s: P, name: string, yaw = 0, group = G.planting): void {
  const ratio=naturalRatios[kind];
  if(ratio)s=[s[0],r(s[0]*ratio[0]),r(s[0]*ratio[1])];
  add({ t: 'decor' , dkind: kind as NonNullable<CustomComponent['dkind']>, p, s, yaw, nm: name, grp: group });
}
function surface(p: P, vertices: number[], indices: number[], name: string, tex: string,
  colors?: number[], uvs?: number[], solid = false, group = G.landscape): void {
  add({ t: 'mesh', p, vertices: vertices.map(r), indices, colors: colors?.map(r), uvs: uvs?.map(r),
    tex, color: '#ffffff', solid, edgeGrinding: false, nm: name, grp: group });
}
function sculpt(geometry: THREE.BufferGeometry, p: P, name: string, color: string,
  tex = 'treehouse-timber', group = G.craft): void {
  add({ t: 'mesh', p, vertices: Array.from(geometry.attributes.position.array, r),
    uvs: tex !== "solid" && geometry.attributes.uv ? Array.from(geometry.attributes.uv.array, r) : undefined,
    indices: geometry.index ? Array.from(geometry.index.array) : undefined,
    tex, color, solid: false, edgeGrinding: false, nm: name, grp: group });
  geometry.dispose();
}
function timber(a: P, b: P, w: number, d: number, name: string, _color = '#d6c4a0'): void {
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],length=Math.hypot(dx,dy,dz);
  const yaw=Math.atan2(-dz,dx),lean=Math.atan2(dy,Math.hypot(dx,dz));
  // The accepted weathered beam's long axis is local X and its normalized
  // bottom is Y=0. Place its rotated midpoint on the exact authored span.
  const half=d/2,p:P=[(a[0]+b[0])/2+half*Math.cos(yaw)*Math.sin(lean),
    (a[1]+b[1])/2-half*Math.cos(lean),(a[2]+b[2])/2-half*Math.sin(yaw)*Math.sin(lean)];
  add({t:'decor',dkind:'trialsv2beam',p,s:[length,d,w],yaw:r(THREE.MathUtils.radToDeg(yaw)),
    amp:r(THREE.MathUtils.radToDeg(lean)),color:'#ffffff',nm:name,grp:G.craft});
}
function rope(a: P, b: P, sag: number, name: string): void {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b).sub(start);
  const mid = end.clone().multiplyScalar(.5); mid.y -= sag;
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(), mid, end]), 10, .045, 6, false);
  sculpt(geometry, a, name, '#b7a17b', 'solid');
}

// These stations exactly follow the existing source-owned walking surfaces.
// Off-path banks are real indexed surfaces, while every native jump gap stays
// open across its full width. The centre three metres are never altered.
const profile: P[] = [
  [X,0,-16],[X,0,-28],[X,-1.7,-35],[X,-3,-42],[X,-2.2,-46],[X,-5.1,-50],
  [X,-5.5,-55],[X,-6.7,-67],[X,-5.9,-71],[X,-9,-75],[X,-9.4,-80],[X,-10.6,-94],
  [X,-9.8,-98],[X,-13,-102],[X,-13.4,-107],[X,-14,-112],[X,-14,-252],
  [X,-7.2,-284],[X,-7.2,-414],
];
function floorAt(z: number): number {
  for (let i=1;i<profile.length;i++) if (z<=profile[i-1][2]&&z>=profile[i][2]) {
    const a=profile[i-1],b=profile[i],t=(z-a[2])/(b[2]-a[2]);return a[1]+(b[1]-a[1])*t;
  }
  return z>profile[0][2]?profile[0][1]:profile[profile.length-1][1];
}
const shallowPitBeds = [
  {near:-46,far:-50,takeoff:-2.2,landing:-5.1},
  {near:-71,far:-75,takeoff:-5.9,landing:-9},
  {near:-98,far:-102,takeoff:-9.8,landing:-13},
];
function visibleBedY(z:number):number|null {
  for(const pit of shallowPitBeds)if(z<=pit.near&&z>=pit.far){
    const t=(pit.near-z)/(pit.near-pit.far);
    if(t<.6)return pit.takeoff-.7-.1*t/.6;
    return pit.takeoff-.8+(pit.landing-.7-pit.takeoff+.8)*(t-.6)/.4;
  }
  return null;
}
function porchOpening(z:number,side:number):boolean {
  return (side<0?[-169.2,-195,-217.2]:[-207.8]).some(front=>Math.abs(z-front)<3.4);
}
function gardenRelief(z:number,side:number):number {
  const huts=side<0?[-173,-199,-221]:[-212];
  let relief=1;
  for(const site of huts)relief*=1-.8*Math.exp(-Math.pow((z-site)/6.5,2));
  return relief;
}
function bank(near:number,far:number,side:number,heightAt:(z:number)=>number=floorAt):void {
  const rows=Math.ceil((near-far)/2.2),v:number[]=[],ix:number[]=[],colors:number[]=[],uv:number[]=[];
  const origin:P=[X,0,near];
  for(let row=0;row<=rows;row++){
    const z=near+(far-near)*row/rows,y=heightAt(z);
    const edge=5.5+Math.sin(z*.13+side*.7)*.45;
    const garden=gardenRelief(z,side);
    for(let col=0;col<6;col++){
      const cross=[edge-.3,edge+.35,edge+1.5,edge+3.3,edge+6.1,edge+10.3][col];
      const height=[-.08,.13,.68,1.7,2.65,1.9][col]*garden;
      const noise=(Math.sin(z*.28+col*.84)*.22+Math.sin(z*.061-side*col)*.17)*(col/5);
      v.push(side*cross,y+height+noise,z-near);uv.push((X+side*cross)/6.5,z/6.5);
      const paint=new THREE.Color('#eee8d7').lerp(new THREE.Color('#70916d'),THREE.MathUtils.smoothstep(col,0,2.2));
      paint.lerp(new THREE.Color('#394f3d'),THREE.MathUtils.smoothstep(col,3,5)*.25);
      paint.multiplyScalar(.94+Math.sin(z*.19+col*.45)*.055);colors.push(paint.r,paint.g,paint.b);
    }
  }
  for(let row=0;row<rows;row++)for(let col=0;col<5;col++){
    const a=row*6+col,b=a+1,c=a+6,d=c+1;
    if(side>0)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);
  }
  surface(origin,v,ix,`Continuous sculpted planted ${side<0?'left':'right'} bank ${near}`,'treehouse-loam',colors,uv,true);
}
for(const [near,far] of [[-28,-46],[-50,-71],[-75,-98],[-102,-145],[-151,-160],[-189,-228],[-382,-414]])
  for(const side of [-1,1])bank(near,far,side);
bank(-160,-189,-1);

// Deliberately varied, broad foliage masses establish a near/middle/far depth
// hierarchy. The path reads six to eight metres wide, with no tiny prop noise.
const plantedBands=[[-30,-139],[-153,-227],[-382,-414]];
for(const [near,far] of plantedBands)for(let z=near,i=0;z>=far;z-=4.9,i++)for(const side of [-1,1]){
  if(side>0&&z>-190&&z<-158)continue;
  const y=visibleBedY(z)??floorAt(z),phase=i*1.7+side,opening=porchOpening(z,side);
  prop(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',[X+side*(5.55+Math.sin(phase)*.55),y+.06,z],
    [opening?3.2:5.6,1.1+i%3*.12,3.7],`Broad soft groundcover at path edge ${z}`,side*90+Math.sin(phase)*12);
  const backZ=z+3.8,backY=floorAt(backZ)+2.05*gardenRelief(backZ,side)-.25;
  if(visibleBedY(backZ)===null&&!porchOpening(backZ,side))prop(i%2?'trialsv2groundcoverb':'trialsv2groundcovera',[X+side*(10.1+Math.sin(phase)*.4),backY,backZ],
    [i%2?5.8:7.2,1.5,4.3],'Broad planted moss bank behind the close fern layer',side*90+Math.sin(phase+.5)*11);

  if(i%2===0)prop(i%4?'trialsv2ferna':'trialsv2fernb',[X+side*(7.0+Math.sin(phase)*.3),(visibleBedY(z-2.2)??floorAt(z-2.2))+.12,z-2.2],
    [3.6,2.3,3.3],'Hero broad fern and red-leaf silhouette',i*53+side*88);
  if(i%3===0&&visibleBedY(z-3.5)===null)prop(i%2?'trialsv2earthbanka':'trialsv2earthbankb',[X+side*8.5,floorAt(z-3.5)-.7,z-3.5],
    [8.4,2.3,4.5],'Exposed earthy bank roots seated in the landscape',side*90+i*11,G.landscape);
}
for(const [dx,z,size,yaw] of [
  [-9.5,-32,21,28],[10.5,-52,22,-25],[-10.2,-83,23,48],[10,-111,22,-42],
  [-10.4,-169,21,17],[-10.3,-196,22,43],[10.2,-207,23,-18],[-9.8,-221,21,29],
  [-9.5,-386,22,39],[10.7,-397,21,-35],[-10.1,-413,21,12],
] as const)prop('trialsv2treeb',[X+Math.sign(dx)*(Math.abs(dx)+4.8),floorAt(z)-.35,z],[size,size*1.04,size*.84],
  'Hero rooted tree frames the route in three dimensions',yaw);
for(const [dx,z,y,w,yaw] of [[-15,-58,6,25,23],[14,-91,1,26,-38],[-14,-194,-5,25,43],[14,-220,-5,24,-18],[-14,-389,1,24,35],[14,-414,1,25,-27]] as const)
  prop('trialsv2crownb',[X+dx,y,z],[w,10.5,w*.86],'Layered broad canopy behind the foreground trunks',yaw);

for(const [dx,z,y] of [[-27,-111,1],[27,-210,-5],[-27,-402,1]] as const)prop('trialsv2crowna',[X+dx,y,z],[26,11,24],'Distant soft crown behind the nearer pointed foliage',dx*2);

// Irregular river margins replace the ruler-straight rectangular bank edge.
// Low shelves sink beneath the existing shallow water and remain visual-only.
function riverMargin(z:number,near:boolean):void {
  const v:number[]=[],ix:number[]=[],colors:number[]=[],uv:number[]=[],cols=24;
  for(let row=0;row<4;row++)for(let col=0;col<=cols;col++){
    const x=-27+54*col/cols,curve=(Math.sin(x*.22)*.4+Math.sin(x*.49+.4)*.2)*THREE.MathUtils.smoothstep(Math.abs(x),3,8);
    const dz=near?-[0,.35,.9,1.5][row]:[0,.35,.9,1.5][row];
    const yy=[-14,-14.31,-14.53,-14.68][row];
    v.push(x,yy+14,z+dz+curve);
    uv.push((X+x)/7,(z+dz+curve)/7);
    const paint=new THREE.Color('#e6dcc2').lerp(new THREE.Color('#78916c'),THREE.MathUtils.smoothstep(Math.abs(x),4,8)*(1-row/4));
    colors.push(paint.r,paint.g,paint.b);
  }
  for(let row=0;row<3;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
    if(near)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);
  }
  surface([X,-14,0],v,ix,near?'Natural shelving near riverbank':'Natural shelving far riverbank','treehouse-loam',colors,uv,false);
}
riverMargin(-228,true);riverMargin(-240,false);
// Nine-by-nine contact grids are a bounded downsample of the measured
// 41x41 GLB height fields. They fit the actual flat top and sloped stone edges.
for(const [index,kind,x,z,top,w,d] of [
  [0,'trialsv2riverstonea',34.6,-230.2,-13.88,6.2,3.8],
  [1,'trialsv2riverstoneb',35.7,-234.1,-13.82,6,4.1],
  [2,'trialsv2riverstonec',34.8,-238.1,-13.9,6.5,4],
] as const){
  const contactTop=index===0?.97507:1;
  prop(kind,[x,top-contactTop,z],[w,1,d],'Hero flat naturally rounded river stone fitted to its native support',0,G.landscape);
  add(exactTreehouseSupport(C[C.length-1],`Exact visible river stone support ${index+1}`));
}
for(const [dx,z,size,yaw] of [[-7.5,-228.9,4.8,23],[8.8,-239,4.5,48],[-11,-236.5,5.4,-15],[13,-232,5.2,69],[-6,-238.8,3.7,28],[7.8,-228.2,3.9,-39]] as const){
  prop('treehousemossrock',[X+dx,-14.95,z],[size,2.2,size*.8],'Mossy rounded river margin boulder',yaw,G.landscape);
  prop('trialsv2groundcovera',[X+dx,-14.1,z],[4.8,1.1,3.5],'Soft planting spills over the riverbank rock',yaw);
}
for(const [i,dx,z] of [[0,-5.8,-232.9],[1,7,-234.6],[2,-13,-231.5],[3,12,-238],[4,-18,-235.2],[5,17,-232.8]] as const)
  prop(['trialsv2riverstonea','trialsv2riverstoneb','trialsv2riverstonec'][i%3],[X+dx,-15.02,z],[3.2,.36,2.5],
    'Visible rounded pebbles beneath clear shallow water',i*43,G.landscape);

// A continuous sculpted shell makes the cave a believable enclosing landform.
// Walls are independent of collision; their inner envelope clears the riding
// decks and the bridge. Exterior bases are buried below the supported ground.
function cavernWidth(z:number):number { return z>-285?7.5:z>-347?9.1:z>-374?7.4:8.5; }
function skylightAt(z:number):boolean { return [[-252,-258],[-269,-277],[-296,-304],[-317,-326],[-340,-348],[-355,-359],[-373,-379]].some(([near,far])=>z<=near&&z>=far); }
function caveWall(near:number,far:number,side:number):void {
  const rows=Math.ceil((near-far)/3),v:number[]=[],ix:number[]=[],colors:number[]=[],uv:number[]=[];
  const rings=7;
  for(let row=0;row<=rows;row++){
    const z=near+(far-near)*row/rows,floor=floorAt(z),inner=cavernWidth(z);
    const bulge=Math.sin(z*.19+side)*.5+Math.sin(z*.073)*.38;
    const cross=[inner+.7,inner-.25,inner+.65,inner-.6,inner-1.2,18,20];
    const openLeft=side<0&&skylightAt(z);
    const heights=[-2.8,.3,3.1,7.7,openLeft?13.2:17.0,openLeft?15.1:23.0,-3.2];
    for(let col=0;col<rings;col++){
      const xx=side*(cross[col]+bulge*(col===6?.4:1));
      const yy=floor+heights[col]+Math.sin(z*.24+col*.78)*.42;
      v.push(xx,yy,z-near);uv.push((xx+X)/8+yy/14,z/8);
      const moss=THREE.MathUtils.smoothstep(col,3,5)*.35 + (col===1?.34:0);
      const paint=new THREE.Color('#ece3cc').lerp(new THREE.Color('#6d8969'),moss);
      paint.multiplyScalar(.95+Math.sin(z*.19+col*1.2)*.035);colors.push(paint.r,paint.g,paint.b);
    }
  }
  for(let row=0;row<rows;row++)for(let col=0;col<rings;col++){
    const next=(col+1)%rings,a=row*rings+col,b=row*rings+next,c=a+rings,d=b+rings;
    if(side>0)ix.push(a,c,b,b,c,d);else ix.push(a,b,c,b,d,c);
  }
  surface([X,0,near],v,ix,`Continuous enclosing ${side<0?'left':'right'} cavern rock shell`,'treehouse-stone',colors,uv,false,G.cavern);
}
for(const side of [-1,1])caveWall(-249,-382,side);
function roof(near:number,far:number):void {
  const nx=12,nz=8,v:number[]=[],ix:number[]=[],colors:number[]=[],uv:number[]=[];
  // Lower and upper shells share boundary rows, with closed rough side faces.
  for(let layer=0;layer<2;layer++)for(let row=0;row<=nz;row++)for(let col=0;col<=nx;col++){
    const x=-20+40*col/nx,z=near+(far-near)*row/nz+Math.sin(x*.42+near*.3)*1.4+Math.sin(x*.91)*.4;
    const lower=floorAt(z)+17.0+Math.cos(x*.17)*1.6+Math.sin(z*.22+x*.31)*.55;
    const y=lower+layer*(4.1+Math.sin(x*.23-z*.12)*.6);
    v.push(x,y,z-near);uv.push((x+X)/8,z/8);
    const paint=new THREE.Color(layer?'#9cad8e':'#ece3cc');
    paint.multiplyScalar(.96+Math.sin(x*.15+z*.23)*.025);colors.push(paint.r,paint.g,paint.b);
  }
  const count=(nx+1)*(nz+1);
  for(let row=0;row<nz;row++)for(let col=0;col<nx;col++){
    const x=-20+40*(col+.5)/nx,z=near+(far-near)*(row+.5)/nz;
    if(x>-17+Math.sin(z*.47)*2.2&&x<-3+Math.sin(z*.61)*2.4&&skylightAt(z))continue;
    const a=row*(nx+1)+col,b=a+1,c=a+nx+1,d=c+1;
    ix.push(a,c,b,b,c,d,a+count,b+count,c+count,b+count,d+count,c+count);
  }
  for(let row=0;row<nz;row++)for(const col of [0,nx]){
    const a=row*(nx+1)+col,b=a+nx+1;ix.push(a,a+count,b,b,a+count,b+count);
  }
  for(const row of [0,nz])for(let col=0;col<nx;col++){
    const a=row*(nx+1)+col,b=a+1;ix.push(a,b,a+count,b,b+count,a+count);
  }
  surface([X,0,near],v,ix,`Continuous natural cavern roof with skylight edge ${near}`,'treehouse-stone',colors,uv,false,G.cavern);
}
for(const [near,far] of [[-248,-258],[-264,-277],[-289,-304],[-311,-326],[-334,-348],[-353,-359],[-369,-379]])roof(near,far);
for(const [side,z,variant] of [[-1,-255,0],[1,-266,1],[-1,-279,1],[1,-293,0],[-1,-313,0],[1,-332,1],[-1,-353,1],[1,-371,0]] as const){
  const floor=floorAt(z),inner=cavernWidth(z);
  prop('trialsv2cavewallb',[X+side*(inner+5.4),floor-2.3,z],
    [13,13.4,9.8],'Hero varied cave face joins the continuous rock shell',side*90,G.cavern);
  prop(variant?'trialsv2fernb':'trialsv2ferna',[X+side*(inner-.3),floor+.25,z+2.1],
    [4.5,2.7,3.8],'Large daylit ferns seated in a cave ledge',side*71+z);
}
for(const [_dx,z,_variant,yaw] of [[-4,-258,0,-9],[5,-277,1,12],[-4,-304,1,-12],[4,-326,0,13],[-3,-348,0,-8],[4,-359,1,11],[-4,-369,0,-11]] as const)
  prop('trialsv2caveroofb',[X+7.2,floorAt(z)+17.2,z],[13.5,5.6,8.5],
    'Sculpted mossy skylight collar around an opening above',yaw,G.cavern);
for(const [dx,z,variant] of [[-5,-256,0],[5.6,-266,1],[-5.4,-276,1],[5.5,-281,0]] as const)
  prop(variant?'trialsv2rockstepsb':'trialsv2rockstepsa',[X+dx,floorAt(z)-1.1,z],
    [6.4,2.8,8.4],'Irregular natural stair shoulders integrated with the ascent',dx*3,G.cavern);

// Four overlapping natural rock stair masses own the main climbing lane.
// Measured nine-by-nine support fields preserve real tread heights,
// with a short bevel between risers that the existing walker can climb.
const rockContacts: (number|null)[][][] = [[[null,null,0.06312,null,null,null,null,null,null],[null,0.1521,0.06155,0.30645,0.30597,0.1586,0.16225,null,null],[null,0.18094,0.29641,0.28872,0.2871,0.28075,0.28149,0.05681,null],[null,0.27082,0.27342,0.27076,0.26791,0.26769,0.26354,null,null],[null,0.10554,0.33247,0.34892,0.33066,0.24167,0.24451,0.06816,null],[null,0.07328,0.33679,0.33563,0.3389,0.34132,0.31887,0.04893,null],[null,0.24966,0.41774,0.3323,0.32877,0.33243,0.33558,null,null],[null,0.37132,0.32652,0.52941,0.52713,0.32663,0.33264,null,null],[null,0.25926,0.53002,0.51464,0.51384,0.51841,0.06764,0.16465,null],[null,0.45613,0.50885,0.49987,0.50456,0.51112,0.32857,0.25267,null],[null,0.48652,0.48389,0.47848,0.48126,0.49299,0.44244,0.40772,null],[null,0.43956,0.46829,0.66157,0.66588,0.66792,0.43059,0.41065,null],[null,0.70603,0.71612,0.64024,0.64958,0.66183,0.67956,0.23346,null],[null,0.59893,0.5328,0.6186,0.6303,0.65128,0.66842,null,null],[null,0.57214,0.84315,0.83768,0.83045,0.83912,0.59708,0.39333,null],[null,0.68213,0.81879,0.81642,0.81439,0.83317,0.57614,0.31809,null],[null,0.58399,0.79877,0.79983,0.81344,0.83269,0.74466,0.35205,null],[null,null,0.74449,0.87834,0.93596,0.80807,0.74135,0.46349,null],[null,0.12451,0.75778,0.77693,0.89232,0.83353,0.66546,0.34871,null],[null,0.08638,0.29102,0.44164,0.71256,0.83174,0.64435,null,null],[null,null,null,null,null,null,null,null,null]],[[null,null,null,null,0.01125,null,null,null,null],[null,0.13322,0.09031,0.18667,0.18594,0.20298,0.17158,null,null],[null,0.12903,0.18226,0.18605,0.18556,0.17915,0.19257,null,null],[null,0.24382,0.19552,0.17654,0.17816,0.16439,0.15351,0.07167,null],[null,null,0.22289,0.33331,0.33156,0.06087,null,0.0843,null],[null,0.35169,0.34538,0.33044,0.32759,0.32666,0.32554,null,null],[null,0.34782,0.3412,0.32832,0.32483,null,0.32733,null,null],[null,0.34528,0.34291,0.32827,0.32369,0.32474,0.32728,null,null],[null,0.16749,0.51798,0.50793,0.49554,0.48599,0.32484,null,null],[null,0.11238,0.51868,0.5183,0.49406,0.48916,0.21454,null,null],[null,0.10538,0.51746,0.49997,0.49258,0.49193,0.47606,null,null],[null,0.0967,0.17134,0.50021,0.68113,0.59416,0.5113,null,null],[null,0.249,0.55396,0.68371,0.67908,0.67841,0.53019,0.27358,null],[null,0.09077,0.64723,0.69398,0.68099,0.67716,0.69268,0.17695,null],[null,null,0.69642,0.69502,0.6751,0.67396,0.69125,null,null],[null,null,0.69872,0.69911,0.67573,0.67297,0.68996,null,null],[null,null,0.87574,0.90779,0.90486,0.905,0.89555,null,null],[null,0.56638,0.91688,0.90811,0.90285,0.90262,0.90686,0.45535,null],[null,0.58784,0.84399,0.90617,0.90124,0.90346,0.90803,0.56754,null],[null,0.5543,0.79786,0.89882,0.90231,0.90788,0.91289,0.54165,null],[null,null,null,null,null,null,null,null,null]]];
for(const [row,z,entryY,variant,dx,yaw] of [[0,-256,-14,1,-.12,-1],[1,-264,-12.3,1,.18,1.5],[2,-272,-10.6,1,.12,-1.5],[3,-280,-8.9,1,-.15,1]] as const){
  const grid=rockContacts[variant],front=grid[2][4]!,back=grid[17][4]!,height=1.7/(back-front),base=entryY-front*height;
  const x=X+dx,w=8.6,depth=12.8;
  prop(variant?'trialsv2rockstepsb':'trialsv2rockstepsa',[x,base,z],[w,height,depth],
    'Main natural rock climb · overlapping sculpted stair mass',yaw,G.cavern);
  add(exactTreehouseSupport(C[C.length-1],`Exact visible rock climb support ${row+1}`));
}

// The native halfpipe owns collision. Physical narrow boards sit only 3mm
// outside that exact circular profile, with real grooves and painted variation.
// Boards are bounded batches, rather than hundreds of separate draw objects.
const pipe={...TREEHOUSE_TRIALS_PIPE_V2,z:TREEHOUSE_TRIALS_PIPE_V2.authoringZ};
const section:{x:number;y:number;nx:number;ny:number;u:number}[]=[];
const lip=pipe.flat+pipe.radius,deck=lip+pipe.deck;
section.push({x:-deck,y:pipe.radius,nx:0,ny:1,u:0},{x:-lip,y:pipe.radius,nx:0,ny:1,u:pipe.deck});
for(let i=0;i<=12;i++){
  const a=Math.PI/2*(1-i/12);
  section.push({x:-pipe.flat-pipe.radius*Math.sin(a),y:pipe.radius*(1-Math.cos(a)),nx:Math.sin(a),ny:Math.cos(a),u:pipe.deck+pipe.radius*(Math.PI/2-a)});
}
section.push({x:pipe.flat,y:0,nx:0,ny:1,u:pipe.deck+pipe.radius*Math.PI/2+pipe.flat*2});
for(let i=1;i<=12;i++){
  const a=Math.PI/2*i/12;
  section.push({x:pipe.flat+pipe.radius*Math.sin(a),y:pipe.radius*(1-Math.cos(a)),nx:-Math.sin(a),ny:Math.cos(a),u:pipe.deck+pipe.radius*Math.PI/2+pipe.flat*2+pipe.radius*a});
}
section.push({x:deck,y:pipe.radius,nx:0,ny:1,u:pipe.deck*2+pipe.radius*Math.PI+pipe.flat*2});
const boardCount=96,pitch=pipe.length/boardCount;
for(let first=0;first<boardCount;first+=20){
  const vertices:number[]=[],ix:number[]=[],colors:number[]=[],uv:number[]=[];
  for(let board=first;board<Math.min(first+20,boardCount);board++){
    const offset=vertices.length/3;
    const shade=.94+Math.sin(board*4.17)*.045;
    for(let row=0;row<2;row++)for(const q of section){
      const z=pipe.length/2-board*pitch-(row?pitch-.013:.007);
      vertices.push(q.x+q.nx*.003,q.y+q.ny*.003,z);
      uv.push((board+row*.96)/8,q.u/4.5);
      colors.push(shade,shade*.99,shade*.965);
    }
    const n=section.length;
    for(let col=0;col<n-1;col++){
      const a=offset+col,b=a+1,c=a+n,d=c+1;ix.push(a,b,c,b,d,c);
    }
  }
  surface([pipe.x,pipe.y,pipe.z],vertices,ix,`Fitted narrow timber halfpipe boards ${first}`,'treehouse-timber',undefined,uv,false,G.craft);
  C[C.length-1].castShadow=false;
}
for(const side of [-1,1]){
  const outer=side*(deck+.3);
  for(const z of [-298,-305,-312,-319,-326,-333,-340]){
    timber([X+outer,-7.3,z],[X+outer,-3.08,z],.31,.34,'Halfpipe craft · upright beyond the deck');
    timber([X+side*(deck+.05),-7.2,z],[X+side*(deck+.8),-3.18,z],.2,.24,'Halfpipe craft · exterior diagonal brace');
    timber([X+side*(lip+.12),-3.12,z-1.7],[X+side*(deck+.55),-3.12,z+1.7],.28,.3,'Halfpipe craft · deck bearer');
    for(const height of [-2.5,-1.95]){
      const ring=new THREE.TorusGeometry(.2,.027,3,8).rotateX(Math.PI/2);
      sculpt(ring,[X+outer,height,z],'Halfpipe craft · rope knot collar','#b8a17c','solid');
    }
  }
  for(const near of [-296,-308,-320,-332]){
    const end=Math.max(-342,near-12);
    rope([X+outer,-2.5,near],[X+outer,-2.5,end],.11,'Halfpipe craft · low homemade deck rope');
    rope([X+outer,-1.95,near],[X+outer,-1.95,end],.15,'Halfpipe craft · upper homemade deck rope');
  }
}

// Two narrow timber margins and a fitted lip bearer make each full-width
// earth launch read as homemade construction, exactly as in the downhill image.
for(const [from,lip,base,top] of [[-42,-46,-3,-2.2],[-67,-71,-6.7,-5.9],[-94,-98,-10.6,-9.8]]){
  for(const side of [-1,1])timber([X+side*5.0,base-.05,from],[X+side*5.0,top-.05,lip],.8,.12,
    'Dirt launch · fitted weathered timber side boards');
  timber([X-5.8,top-.09,lip],[X+5.8,top-.09,lip],.17,.22,'Dirt launch · weathered timber lip');
}

// Quiet homemade details belong to settlement porches, never the play lane.
for(const [x,z,yaw] of [[25,-173,20],[27.5,-199,20],[44.4,-212,-32]] as const){
  for(let i=0;i<3;i++)prop('trialsv2plank',[x-1+i*.72,-12.78,z+3.7],[3,.13,.4],
    'Separate irregular porch approach board',90+yaw,G.craft);
}

// Accepted mesh measurements put the baked hut cloth at local Z<=3.6m
// (3.8m on the coast). These short live extensions start 12.5cm beyond it,
// avoiding coplanar fabric and retaining over two metres of hem clearance.
for(const [name,centre,cap] of [
  ['Corridor porch',[28.9707,-9.85,-194.9593],-9.48],
  ['Coastal porch',[26.5391,-10.0,-168.7714],-9.63],
] as const){
  const yaw=20,angle=THREE.MathUtils.degToRad(yaw),width=4.8,depth=1.15;
  prop('trialsv2awning',[...centre],[width,.32,depth],`${name} · living coral cloth with a free billowing hem`,yaw,G.craft);
  const ends:P[]=[];
  for(const side of [-1,1]){
    const x=centre[0]+side*width/2*Math.cos(angle)+depth/2*Math.sin(angle);
    const z=centre[2]-side*width/2*Math.sin(angle)+depth/2*Math.cos(angle);
    const top:P=[x,cap,z];ends.push(top);
    timber([x,-14.12,z],top,.17,.19,`${name} · weathered cloth corner post`);
  }
  timber(ends[0],ends[1],.12,.15,`${name} · light crossbar supporting the pinned cloth corners`);
}

// Per-scene authored forward compositions use the existing camera architecture.
// The image references guide proportion, while the ordered lane still owns
// travel through all native ramps, grind lines, supports and checkpoints.
for(const [name,p,s,eye,target,fov,distance] of [
  ['Downhill ledges framed by close banks',[35,-6,-86],[29,60,125],[35,3,-68],[35,-7,-86],50,9.8],
  ['Coastal hut sugarcane and stilt shack reveal',[35,-10,-176],[36,50,38],[26,-9,-157],[41,-12.7,-181],49,11],
  ['Enclosed porch corridor and clear shallow river',[35,-8,-220],[30,60,77],[43,-7,-199],[35,-12,-223],50,9.5],
  ['Natural uphill cavern daylight',[35,-4,-269],[31,60,61],[35,-1,-246],[35,-6,-271],52,10.2],
  ['Long wooden cavern halfpipe framed by rock roof',[35,-1,-320],[32,60,56],[36.2,-2,-298],[35,-5.7,-320],55,9.6],
  ['Broken bridge single rope oblique reveal',[35,-1,-362],[32,60,34],[42,-2.2,-344],[35,-5.5,-362],52,10.5],
  ['Bright narrow jungle path after the cave',[35,-1,-398],[31,60,58],[35,-2.5,-376],[35,-5.8,-400],49,9.8],
] as const)add({t:'camnode',cameraView:true,p:[...p],s:[...s],radius:5,
  cameraPosition:[...eye],cameraTarget:[...target],cameraFov:fov,cameraFollowDistance:distance,
  cameraFollowTargetHeight:1.35,nm:name,grp:G.camera});

// Shallow near shelves reveal actual soil behind the launch lips, then
// descend to the lower landings. Contact uses the existing ordinary ground contact,
// with the original deeper floor/reset retained as a backup below it.
for(const [index,pit] of shallowPitBeds.entries()){
  const origin:P=[X,0,pit.near],v:number[]=[],ix:number[]=[],uv:number[]=[];
  for(const t of [0,.3,.6,1])for(const x of [-42,42]){
    const z=pit.near+(pit.far-pit.near)*t;
    v.push(x,visibleBedY(z)!,z-pit.near);uv.push((X+x)/6,z/6);
  }
  for(let row=0;row<3;row++){const a=row*2,b=a+1,c=a+2,d=c+1;ix.push(a,b,c,b,d,c);}
  add({t:'mesh',p:origin,vertices:v,indices:ix,uvs:uv,vert:false,
    edgeGrinding:false,tex:'treehouse-loam',color:'#e9e1cf',nm:`Visible shallow solid dirt bed ${index+1}`,grp:G.landscape});
}

// Close the authored terrain volumes. Low gameplay cameras must meet earth
// and rock beneath a ledge, never see the distant sky through a thin sheet.
function closedShore(z:number,top:number,bottom:number,width:number,depth:number,name:string,tex:string):void {
  const cols=16,ring=5,v:number[]=[],ix:number[]=[],paint:number[]=[],uv:number[]=[];
  for(let col=0;col<=cols;col++){
    const x=(col/cols-.5)*width,edge=THREE.MathUtils.smoothstep(Math.abs(x),4.2,9);
    const curve=Math.sin(x*.17+.3)*.35*edge,rough=Math.sin(x*.23)*.12*edge;
    const outline=[[top+rough,curve],[(top+bottom)/2,curve+.18],[bottom-.12,curve+.45],
      [bottom-.12,-depth],[top+rough,-depth]];
    for(let q=0;q<ring;q++){
      v.push(x,outline[q][0],outline[q][1]);uv.push((X+x)/6,outline[q][0]/6);
      const color=new THREE.Color(tex==='treehouse-loam'?'#eee8d7':'#ece3cc');
      color.lerp(new THREE.Color('#75906d'),edge*(q===0||q===4?.52:.16));
      color.multiplyScalar(q===1?.91:.97);paint.push(color.r,color.g,color.b);
    }
  }
  for(let col=0;col<cols;col++)for(let q=0;q<ring;q++){
    const next=(q+1)%ring,a=col*ring+q,b=a+ring,c=col*ring+next,d=c+ring;
    ix.push(a,c,b,b,c,d);
  }
  for(const end of [0,cols*ring])for(let q=1;q<ring-1;q++)
    if(end===0)ix.push(end,end+q,end+q+1);else ix.push(end,end+q+1,end+q);
  surface([X,0,z],v,ix,name,tex,paint,uv,false,G.landscape);
}
closedShore(-50,-5.1,-6.2,84,4,'First lower landing · closed earthen cut face','treehouse-loam');
closedShore(-75,-9,-10.1,84,4,'Second lower landing · closed earthen cut face','treehouse-loam');
closedShore(-102,-13,-14.1,84,4,'Third lower landing · closed earthen cut face','treehouse-loam');
closedShore(-240,-14,-14.8,54,2,'Shallow stream farbank · closed shelving earth face','treehouse-loam');
closedShore(-368,-7.2,-12.6,48,6,'Broken bridge farshore · continuous rock mass beneath the landing','treehouse-stone');

// Varied near-bank rock silhouettes mask the farshore's closed structural
// face. Their feet are buried in the riverbed and their tops carry planting.
for(const [dx,yaw] of [[-15,7],[-8,-6],[8,5],[15,-8]] as const){
  const width=6,top=-12.8+width*naturalRatios.trialsv2cavewallb[0];
  prop('trialsv2cavewallb',[X+dx,-12.8,-367.7],[width,5.85,3.7],
    'Broken bridge farshore · broad mossy rock face silhouette',yaw,G.cavern);
  prop(dx<0?'trialsv2ferna':'trialsv2fernb',[X+dx,top-.22,-369.2],[3.6,2.2,3.6],
    'Broken bridge farshore · fern planted on the mossy bank',yaw*7);
}

// The river now has a real thirty-metre forest beat before the cave. All
// cave, halfpipe, bridge and exit assemblies translate together; local mesh
// coordinates, measured contacts and camera direction are retained exactly.
for(const component of C)if(component.p[2]<=-248){
  component.p[2]-=TREEHOUSE_TRIALS_CAVE_EXTENSION_V2;
  if(component.cameraPosition)component.cameraPosition[2]-=TREEHOUSE_TRIALS_CAVE_EXTENSION_V2;
  if(component.cameraTarget)component.cameraTarget[2]-=TREEHOUSE_TRIALS_CAVE_EXTENSION_V2;
}
for(const side of [-1,1])bank(-240,-282,side,()=>-14);
for(let z=-243,i=0;z>=-279;z-=4.9,i++)for(const side of [-1,1]){
  prop(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',[X+side*5.7,-13.94,z],[side<0&&Math.abs(z+251.8)<3.5?3.2:5.6,1.2,3.8],
    'Forested river-to-cave transition groundcover',side*90+Math.sin(i*.8)*12);
  if(i%2===0)prop(i%4?'trialsv2ferna':'trialsv2fernb',[X+side*7.8,-13.7,z-2.2],[3.7,2.2,3.7],
    'Broad fern at the quiet forest decompression beat',side*74+i*31);
}
for(const [dx,z,kind,yaw] of [[-15,-248,'trialsv2treea',24],[14.6,-258,'trialsv2treeb',-27],[-14.8,-273,'trialsv2treea',42]] as const)
  prop(kind,[X+dx,-14.35,z],[23,22,20],'Mature forest before the distant cave entrance',yaw);
prop('trialsv2porchhut',[25.4,-13.9,-255],[7.1,5.6,6.8],'Quiet background porch beyond the river',28);
add({t:'camnode',cameraView:true,p:[35,-8,-261],s:[32,55,47],radius:5,
  cameraPosition:[35,-7,-239],cameraTarget:[35,-12,-261],cameraFov:50,cameraFollowDistance:9.5,
  cameraFollowTargetHeight:1.35,nm:'Quiet forest and porch beyond the river before the cave',grp:7});

export const TREEHOUSE_TRIALS_SCENES_V2 = C;
export const TREEHOUSE_TRIALS_SCENE_GROUPS_V2 = Object.entries(G).filter(([name])=>name!=='camera').map(([nm,id])=>({id,nm}));
