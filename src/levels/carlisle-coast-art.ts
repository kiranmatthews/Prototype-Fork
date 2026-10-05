import * as THREE from 'three';
import type {CustomComponent,CustomGroup} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';

type P=[number,number,number];
type Kind=keyof typeof CARLISLE_ASSETS;
const G={stone:90,garden:91,ruins:92,surface:93};
const r=(v:number)=>Math.round(v*10000)/10000;
const rnd=(n:number)=>{const a=Math.sin(n*127.13+7.1)*43758.5453;return a-Math.floor(a);};
const wave=(n:number)=>Math.sin(n*.17)*.63+Math.sin(n*.057+1.9)*.37;
export const CARLISLE_ART_GROUPS:CustomGroup[]=[
 {id:90,nm:'Geology · massive eroded canyon'},
 {id:91,nm:'Ecology · fine turf and rooted plants'},
 {id:92,nm:'Ruins · weathered carved remnants'},
 {id:93,nm:'Terrain · carved stone and living caps'},
];

/** Compose actual rock mass around the carved supports. The scene deliberately
 * has no flat rectangular top overlays or planar hanging side panels. */
export function buildCarlisleArt(native:readonly CustomComponent[],
 _supports:readonly CustomComponent[],caps:readonly CustomComponent[]):CustomComponent[]{
 const out:CustomComponent[]=[];
 function prop(kind:Kind,p:P,width:number,name:string,yaw=0,group=G.stone,cutaway=false,color='#ffffff',castShadow?:boolean){
  const size=CARLISLE_ASSETS[kind].size,k=width/size[0];
  out.push({t:'decor',dkind:kind,p:p.map(r) as P,s:size.map(v=>r(v*k)) as P,yaw:r(yaw),
   color,solid:false,cameraCutaway:cutaway||undefined,castShadow,nm:name,grp:group});
 }
 // Rooted fine grass uses area-weighted sampling, rather than multiplying
 // tufts when support tessellation is refined. The eroded verge gets most of
 // the clumps; the walking line stays quiet and the source budget stays fixed.
 for(const cap of caps){
  if(!cap.nm?.startsWith('Carlisle moss cap')||!cap.vertices||!cap.indices)continue;
  const v=cap.vertices,seed=Number(cap.nm.match(/\d+$/)?.[0])||0;
  const yaw=THREE.MathUtils.degToRad(cap.yaw??0),cos=Math.cos(yaw),sin=Math.sin(yaw),cross=seed>=49&&seed<=56;
  const bands=new Map<number,number>();
  for(let i=0;i<v.length;i+=3){const along=cross?v[i]:v[i+2],across=Math.abs(cross?v[i+2]:v[i]);const k=Math.round(along*10);bands.set(k,Math.max(bands.get(k)??0,across));}
  const rows=[...bands].map(([k,half])=>({along:k/10,half}));
  const candidates:{point:P;rank:number;i:number;edge:boolean}[]=[];let areaSum=0;
  for(let i=0;i<cap.indices.length;i+=3){
   const a=cap.indices[i]*3,b=cap.indices[i+1]*3,c=cap.indices[i+2]*3;
   const ax=v[b]-v[a],ay=v[b+1]-v[a+1],az=v[b+2]-v[a+2],bx=v[c]-v[a],by=v[c+1]-v[a+1],bz=v[c+2]-v[a+2];
   const ny=az*bx-ax*bz,area=Math.hypot(ay*bz-az*by,ny,ax*by-ay*bx)/2;if(ny<=0||area<.1)continue;areaSum+=area;
   let u=.18+rnd(i+seed)*.5,w=.15+rnd(i*2+seed)*.5;if(u+w>.88)w=.88-u;
   const x=v[a]+ax*u+bx*w,z=v[a+2]+az*u+bz*w,y=v[a+1]+ay*u+by*w;
   const along=cross?x:z,across=Math.abs(cross?z:x);let nearest=rows[0],distance=Infinity;
   for(const row of rows){const d=Math.abs(row.along-along);if(d<distance){nearest=row;distance=d;}}
   const edge=across>nearest.half*.72;
   const rank=-Math.log(Math.max(.0001,rnd(i+seed*21)))/(area*(edge?5.0:1));
   candidates.push({point:[cap.p[0]+x*cos+z*sin,cap.p[1]+y-.006,cap.p[2]-x*sin+z*cos],rank,i,edge});
  }
  candidates.sort((a,b)=>a.rank-b.rank);
  for(const c of candidates.slice(0,Math.min(100,Math.ceil(areaSum*.16)))){
   prop(rnd(c.i+seed*3)>.35?'coastv2grass':'coastv2grassb',c.point,
    (c.edge?.94:.72)+rnd(c.i+37)*.28,`Carlisle rooted turf ${seed} ${c.i}`,rnd(c.i+seed*41)*360,G.garden,false,'#dde0bb');
  }
 }
 // Deep landing fingers mask no collision. Their cap is buried below the
 // sculpted support; their full 3D tapered roots interrupt procedural courses.
 for(const c of native){
  if(c.t!=='platform'||!c.s||c.tex==='wood')continue;
  const index=Number(c.nm?.match(/\d+$/)?.[0]),[w,h,d]=c.s,[x,y,z]=c.p;
  const width=Math.min(8,Math.min(w,d)*.55),height=CARLISLE_ASSETS.coastv2ledge.size[1]*width/10;
  const depth=CARLISLE_ASSETS.coastv2ledge.size[2]*width/10;
  const top=y+h/2,across=index>=49&&index<=56;
  const ends=d>18||across?[-1,1]:[0];
  for(const side of ends){
   const p:P=across?[x+side*(w/2-depth/2-.13),top-.98905*height-.2,z]
    :[x+wave(index)*.27,top-.98905*height-.2,z+side*(d/2-depth/2-.13)];
   prop('coastv2ledge',p,width,`Carlisle cliff finger ${index} ${side}`,across?side*90:side>0?0:180,G.stone,false,'#e0d4bc');
  }
 }
 const nativeFloor=(x:number,z:number)=>{
  for(const c of native){
   if(c.t==='platform'&&c.s&&Math.abs(c.p[0]-x)<c.s[0]/2&&Math.abs(c.p[2]-z)<c.s[2]/2)return c.p[1]+c.s[1]/2;
   if(c.t==='ramp'&&Math.abs(c.p[0]-x)<(c.w??12)/2&&Math.abs(c.p[2]-z)<(c.len??12)/2)
    return c.p[1]+(c.rise??0)*((c.p[2]+(c.len??12)/2-z)/(c.len??12));
  }
  const points= native.filter(c=>c.t==='checkpoint');let best=points[0],dist=Infinity;
  for(const p of points){const dd=Math.abs(p.p[2]-z);if(dd<dist){best=p;dist=dd;}}
  return best?.p[1]??0;
 };
 function breathingRoom(x:number,z:number){
  let width=5.0+wave(z+11)*.65;
  if(z>-44)width=9.4+wave(z)*.65;
  if(z<-180&&z>-220)width=7.0;
  if(z<-1078&&z>-1130)width=8.2;
  if(z<-1633&&z>-1700)width=8.8;
  if(z<-1980&&z>-2055)width=8.1;
  if(z<-710&&z>-830)width=11.0;
  for(const c of native)if(c.t==='platform'&&c.s&&Math.abs(c.p[0]-x)<.1&&Math.abs(c.p[2]-z)<c.s[2]/2)
   width=Math.max(width,c.s[0]*.38+1.2);
  return width;
 }
 // Broad asymmetric masses overlap in depth and height. Stations are not a
 // uniform two-tier wall; larger corners occlude the far runway and reveal the
 // next few carved ledges against the mist.
 function canyon(x:number,near:number,far:number){
  for(let z=near,i=0;z>far;z-=17.5+rnd(i+9)*5.8,i++)for(const side of [-1,1]){
   const f=nativeFloor(x,z),width=20+rnd(i+side*37)*5.5;
   const kind:Kind=i%5===3?'coastv2cavewall':'coastv2buttress';
   const spec=CARLISLE_ASSETS[kind].size,depth=spec[2]*width/spec[0];
   const inner=breathingRoom(x,z)+(side<0?.2:1.05)+wave(z+side*30)*.4;
   prop(kind,[x+side*(inner+depth/2-.7),f-4.5-rnd(i+side)*2.5,z+side*2.4],width,
    `Carlisle canyon mass ${x} ${i} ${side}`,side<0?88+wave(z)*5:-88+wave(z+8)*5,G.stone,false,'#dbd0b8');
   // Deep backing connects the cliff to the mist-filled chasm. Offset layers
   // seal the source models' tapered corners without repeating a flat wall.
   const backWidth=27+rnd(i+side*21)*3.5;
   for(const [level,base] of [[0,-28],[1,-51]] as const)
    prop('coastv2buttress',[x+side*(inner+backWidth/2+1.8),f+base,z+3+level*2.4],backWidth,
     `Carlisle deep bedrock ${x} ${i} ${side} ${level}`,side<0?91:-91,G.stone,false,level?'#a29c89':'#bbb09c',false);
   if(i%3===0)prop('coastbeachrock' ,[x+side*(inner+2.3),f-5,z+5],8.6+rnd(i)*2,
    `Carlisle fractured toe ${x} ${i} ${side}`,side*73,G.stone,false,'#c3b89f');
   if(i%2===0)prop('coastv2earthbank',[x+side*(inner+1.6),f-.7,z-3],6.2,
    `Carlisle earthy fissure ${x} ${i} ${side}`,side<0?90:-90,G.stone,false,'#c2b99a');
   if(i%4===1){
    prop('coastfern',[x+side*(inner+.6),f+.1,z+5],1.7,
     `Carlisle crevice fern ${x} ${i} ${side}`,side*70,G.garden,false,'#c9c7a2');
    prop('coastfoliage',[x+side*(inner+1.7),f+.8,z+1],1.9,
     `Carlisle red leaf fissure ${x} ${i} ${side}`,side*90,G.garden,false,'#b4b7a0');
   }
   if(i%6===2)prop('coastpillar',[x+side*(inner+1.4),f-1.1,z-3],2.6,
    `Carlisle worn cliff relief ${x} ${i} ${side}`,side<0?76:-76,G.ruins,false,'#d2cbb8');
   if(i%8===5){
    prop('coasttree',[x+side*(inner+12),f+10,z-4],24,`Carlisle distant canopy ${x} ${i} ${side}`,i*37,G.garden,false,'#b8b89b');
    prop('coastcrown',[x+side*(inner+4),f+13,z+2],15,`Carlisle loose hanging leaves ${x} ${i} ${side}`,i*29,G.garden,false,'#b6b69b');
   }
  }
 }
 canyon(0,18,-1695);canyon(152,-1741,-2330);
 // Deliberate carved remnants, not a giant identical arch at every checkpoint.
 for(const [x,y,z] of [[0,0,-28],[0,-13.5,-928],[0,-22,-1110],[0,-19,-1655],[152,-26,-2024],[152,-26,-2308]] as P[]){
  const room=breathingRoom(x,z);
  for(const side of [-1,1])prop('coastpillar',[x+side*(room+.8),y-1,z],3.1,
   `Carlisle temple remnant ${z} ${side}`,side*8,G.ruins,false,'#d7cbb2');
 }
 // Side-view canyon has real deep-rooted ledges and permanent rear mass.
 // The near bank and foreground planting cut away without changing support.
 for(let x=6,i=0;x<164;x+=19+rnd(i+51)*3,i++)for(const side of [-1,1]){
  const y=x<40?-19:-16,cutaway=side>0,width=21+rnd(i)*4;
  prop('coastv2buttress',[x,y-6,-1720+side*(8.5+width/2)],width,
   `Carlisle E canyon mass ${i} ${side}`,side>0?179:2,G.stone,cutaway,'#d7ceb8');
  for(const [level,base] of [[0,-30],[1,-53]] as const)prop('coastv2buttress',[x+3,y+base,-1720+side*24],29,
   `Carlisle E deep foundation ${i} ${side} ${level}`,side>0?178:-2,G.stone,cutaway,level?'#a49f8d':'#bbb29f',false);
  if(i%3===0)prop('coastv2cavewall',[x+8,y-8,-1720+side*19],18,
   `Carlisle E fractured corner ${i} ${side}`,side>0?181:-3,G.stone,cutaway,'#cfc7b3');
  if(i%2===0)prop('coastfern',[x+1,y+.3,-1720+side*6.6],1.9,
   `Carlisle E crevice plant ${i} ${side}`,i*29,G.garden,cutaway,'#c4c4a7');
 }
 for(const z of [-707,-743,-782,-817])for(const side of [-1,1]){
  prop('coastv2buttress',[side*20.6,-23,z],25,`Carlisle halfpipe outer geology ${z} ${side}`,side<0?87:-87,G.stone,false,'#d2c5af');
  prop('coastv2buttress',[side*23.5,-46,z+4],29,`Carlisle halfpipe deep buttress ${z} ${side}`,side<0?93:-93,G.stone,false,'#aca58f',false);
 }
 prop('coastv2buttress',[152,-34,-2340],35,'Carlisle sanctuary closed bedrock',0,G.stone,false,'#cec7b5');
 return out;
}
