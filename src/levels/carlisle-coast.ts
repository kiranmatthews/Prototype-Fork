import type {CustomComponent,CustomLevelData} from '../level';
import {buildCarlisleBoxes} from './carlisle-boxes';
import {CITY_MODULES} from '../cityModules';
import originalEntry from '../../tools/carlisle-coast/original-course.json';

// The original snapshot owns the course shape and enemy sequence. The city
// and the new box encounters fit that route; the hill rail gets clearance knots.
const original=originalEntry.data as unknown as CustomLevelData;
const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
export const CARLISLE_REMOVED_PARK_INDICES=[1,...range(20,30),...range(71,86),...range(121,123),175,176,...range(242,253),276,490,493,499,502];
const removed=new Set(CARLISLE_REMOVED_PARK_INDICES);
export const CARLISLE_ORIGINAL_INDICES=original.components.map((_,i)=>i).filter(i=>!removed.has(i)&&original.components[i].t!=='crate');
const C:CustomComponent[]=CARLISLE_ORIGINAL_INDICES.map(index=>{
 const c=JSON.parse(JSON.stringify(original.components[index])) as CustomComponent;
 c.nm=`Test Course ${index}`;
 if(c.t==='platform'||c.t==='ramp'){c.invisible=true;c.edgeGrinding=c.edgeGrinding??true;}
 if(c.t==='wall'){c.color='#9caaa9';c.tex='pavement';}
 if(c.t==='vertramp'){c.color='#b5c1c1';c.tex='pavement';}
 if(c.t==='rail'&&!c.invisible)c.dkind=[117,151].includes(index)?'cityutilitypole':'citydeck';
 if(c.t==='mover'||c.t==='crumble')c.dkind='citydeck';
 // This rail previously cut below the two raised landings. Keep its old
 // anchors and horizontal route, adding support-height knots at the crests.
 if(index===132)c.pts=[[0,0,0,0],[0,-23,0,2.98],[0,-63,0,3.2],[0,-88,0,5.96],[0,-128,0,6.2],[0,-150,0,9]];
 if(index===92)c.cameraCutaway=true;
 if(index===69){c.p[0]=0;c.s![0]=22;}
 return c;
});
const G={streets:101,buildings:102,works:103,foundations:104};
const add=(c:CustomComponent)=>C.push(c);
function prop(dkind:CustomComponent['dkind'],p:[number,number,number],s?:[number,number,number],yaw=0,grp=G.works,amp=0,solid=false){
 const ground=CITY_MODULES[dkind as keyof typeof CITY_MODULES]?.ground||dkind==='citydeck'||dkind==='citytaper';
 // Scaffolds centred on the course also have near-side braces. Cut those
 // away with the foreground frontage while keeping every usable deck/rail.
 const cameraCutaway=!ground&&p[0]>-10&&p[0]<174&&p[2]>=-1720&&p[2]<-1680;
 add({t:'decor',dkind,p,s,yaw,grp,amp,solid,...(cameraCutaway?{cameraCutaway:true}:{})});
}
function tile(kind:CustomComponent['dkind'],x:number,y:number,z:number,length:number,width:number,yaw=90,rise=0){
 prop(kind,[x,y+.003,z],[length,.15,width],yaw,G.streets,rise);
}
const mainIndices=[0,2,3,4,5,6,7,8,9,10,11,12,13,14,15,31,32,33,34,35,36,37,38,39,40,41,42,43,46,47,48,49,50,51,52,54,55,56,57,58,59,60,61,65,66,67,68];
const raisedIndices=[16,17,18,19,44,45,53];
const footIndices=[62,63,64];
interface Street {index:number;x:number;z:number;near:number;far:number;w:number;y0:number;y1:number;axis:'x'|'z';}
export const CARLISLE_STREETS:Street[]=mainIndices.map(index=>{
 const c=original.components[index],axis=index>=49&&index<=55?'x':'z';
 const length=c.t==='ramp'?c.len!:(axis==='z'?c.s![2]:c.s![0]);
 const width=c.t==='ramp'?c.w!:(axis==='z'?c.s![0]:c.s![2]);
 const y0=c.t==='ramp'?c.p[1]:c.p[1]+c.s![1]/2;
 return {index,x:c.p[0],z:c.p[2],near:axis==='z'?c.p[2]+length/2:c.p[0]-length/2,far:axis==='z'?c.p[2]-length/2:c.p[0]+length/2,w:width,y0,y1:y0+(c.t==='ramp'?c.rise!:0),axis};
});
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const surfaceY=(s:Street,t:number)=>lerp(s.y0,s.y1,t);
const point=(s:Street,t:number):[number,number,number]=>s.axis==='z'?[s.x,surfaceY(s,t),lerp(s.near,s.far,t)]:[lerp(s.near,s.far,t),surfaceY(s,t),s.z];
// Meshes follow each original platform/ramp's exact horizontal span. Bare
// road modules keep the original entities seated on asphalt at their old Y.
for(const s of CARLISLE_STREETS){
 const length=Math.abs(s.far-s.near),count=Math.ceil(length/6),step=length/count;
 for(let i=0;i<count;i++){
  const t=(i+.5)/count,[x,y,z]=point(s,t);
  tile(s.w>14?'cityroad4bare':'cityroad2bare',x,y,z,step,s.w,s.axis==='z'?90:0,(s.y1-s.y0)/count);
 }
 // City fabric outside the original ride footprint follows the same grade.
 // It is backed by deep visible retaining faces, with a clear site boundary.
 if(s.index===11)continue; // preserve the halfpipe's full curved cross-section
 const rows=Math.ceil(length/12),segment=length/rows;
 for(let i=0;i<rows;i++){
  const t=(i+.5)/rows,[x,y,z]=point(s,t),delta=(s.y1-s.y0)/rows;
  for(const side of [-1,1]){
   if((s.index===48&&side>0)||(s.index===56&&side<0))continue;
   let half=s.w/2;
   if(s.axis==='z')for(const j of [...raisedIndices,491]){
    const q=original.components[j],extent=q.s??[0,0,0];
    if(Math.abs(z-q.p[2])<extent[2]/2+segment/2+2)half=Math.max(half,side*(q.p[0]-s.x)+extent[0]/2+1);
   }
   const boundary=half+.6;
   const bx=s.axis==='z'?x+side*boundary:x,bz=s.axis==='z'?z:z+side*boundary;
   prop('cityfence',[bx,y,bz],[segment,2.15,.16],s.axis==='z'?90:0,G.works,delta);
   // The tall invisible containment follows the visible construction fence;
   // all original takeoff/landing surfaces remain inside it.
   add({t:'wall',p:[bx,Math.min(y-delta/2,y+delta/2)-1,bz],s:s.axis==='z'?[.16,18,segment]:[segment,18,.16],invisible:true,edgeGrinding:false,grp:G.works});
   const px=s.axis==='z'?x+side*(s.w/2+.35):x,pz=s.axis==='z'?z:z+side*(s.w/2+.35);
   prop('citypavementflat',[px,y-.15,pz],[segment,.15,.7],s.axis==='z'?90:0,G.foundations,delta);
   // A narrow verge closes the visual joint without adding a hidden crossing.
   const fx=s.axis==='z'?x+side*s.w/2:x,fz=s.axis==='z'?z:z+side*s.w/2;
   prop('cityretaining',[fx,-62,fz],[segment,Math.max(.5,y+62),.35],s.axis==='z'?(side<0?90:-90):(side<0?0:180),G.foundations,side<0?delta:-delta);
  }
 }
 // Front/back foundation faces retain the original gap edges and heights.
 for(const t of [0,1]){
  const [x,y,z]=point(s,t),pieces=Math.ceil(s.w/6),width=s.w/pieces;
  for(let i=0;i<pieces;i++){
   const across=-s.w/2+width*(i+.5);
   prop('cityretaining',[x+(s.axis==='z'?across:0),-62,z+(s.axis==='z'?0:across)],[width,Math.max(.5,y+62),.3],s.axis==='z'?(t===0?0:180):(t===0?90:-90),G.foundations);
  }
 }
}
// The original upper/lower platforms remain separate. Scaffolds support high
// decks at their corners, preserving the underpass and the lift approach.
for(const index of [...raisedIndices,...footIndices]){
 const c=original.components[index],top=c.p[1]+c.s![1]/2,w=c.s![0],depth=c.s![2];
 const rows=Math.ceil(depth/4.5),piece=depth/rows,cap=Math.min(1,c.s![1]);
 for(let i=0;i<rows;i++){
  const z=c.p[2]-depth/2+piece*(i+.5);
  prop('citydeck',[c.p[0],top-cap,z],[w,cap,piece]);
 }
 const bottom=footIndices.includes(index)?-48:Math.min(c.p[1]-c.s![1]/2,index===53?-16.6:index===45?-19:-5.5);
 if([16,17,18,19,44].includes(index)){
  // These were solid steps, so their cladding also reads as a solid plinth.
  const base=c.p[1]-c.s![1]/2;
  for(const side of [-1,1]){
   prop('cityretaining',[c.p[0]+side*w/2,base,c.p[2]],[depth,c.s![1],.04],side<0?90:-90);
   prop('cityretaining',[c.p[0],base,c.p[2]+side*depth/2],[w,c.s![1],.04],side>0?0:180);
  }
 }else prop('cityscaffold',[c.p[0],bottom,c.p[2]],[w,top-bottom,depth]);
}
interface Excavation {id:string;axis:'x'|'z';x:number;z:number;w:number;d:number;nearY:number;farY:number;}
export const CARLISLE_EXCAVATIONS:Excavation[]=[];
function cut(id:string,near:number,far:number,nearY:number,farY:number,x=0,width=18,axis:'x'|'z'='z',z=-1720){
 const length=Math.abs(far-near);CARLISLE_EXCAVATIONS.push({id,axis,x:axis==='z'?x:(near+far)/2,z:axis==='z'?(near+far)/2:z,w:axis==='z'?width:length,d:axis==='z'?length:width,nearY,farY});
}
cut('rope-gap',-153,-162,-4.62,-5.085);
cut('downhill-landing',-275,-288,-13,-12.57);
cut('first-rail-trench',-350,-410,-12.57,-12.6);
cut('kicker-landing',-475,-488,-10.2,-12.56);
cut('bent-wire-trench',-575,-655,-12.56,-13.115);
cut('three-rail-cut',-838,-910,-13.5,-13.5,0,22);
cut('steep-ramp-landing',-1000,-1013,-22,-21.615);
cut('upper-street-hop',-1442,-1450,-12.58,-12.565);
cut('crumble-bridge',-1495,-1511,-12.565,-12.56);
cut('drop-kicker',-1555,-1565,-11,-18.625);
cut('east-step-one',36,44,-19,-17.5,0,15,'x');
cut('east-step-two',56,62,-17.5,-16,0,15,'x');
cut('east-moving-crossing',74,100,-16,-16,0,15,'x');
cut('east-underpass-entry',118,120,-16,-16.6,0,15,'x');
cut('east-underpass-exit',134,136,-16.6,-16,0,15,'x');
cut('east-corner-joint',141.5,142,-16,-16,0,15,'x');
cut('harbour-weave',-1870,-1955,-26,-26,152,22);
cut('split-foot-docks',-2055,-2145,-26,-26,152,24);
cut('last-hop',-2228,-2234,-25.59,-25.62,152,18);
for(const h of CARLISLE_EXCAVATIONS){
 const length=h.axis==='z'?h.d:h.w,span=h.axis==='z'?h.w:h.d,steps=Math.ceil(length/6),piece=length/steps;
 for(const side of [-1,1])for(let i=0;i<steps;i++){
  const t=(i+.5)/steps,along=(t-.5)*length,y=lerp(h.nearY,h.farY,t);
  const x=h.axis==='z'?h.x+side*span/2:h.x+along,z=h.axis==='z'?h.z-along:h.z+side*span/2;
  prop('cityretaining',[x,-62,z],[piece,y+62,.35],h.axis==='z'?(side<0?90:-90):(side<0?0:180),G.works);
  prop('cityfence',[x,y,z],[piece,2.2,.16],h.axis==='z'?90:0,G.works,(h.farY-h.nearY)/steps);
 }
 // End wings close the width between each original landing and the outer
 // excavation wall; they never extend a walkable top across a jump.
 for(const end of [-1,1]){
  const y=end<0?h.nearY:h.farY,pieces=Math.ceil(span/6),piece=span/pieces;
  for(let i=0;i<pieces;i++){
   const across=-span/2+piece*(i+.5),along=end*(length/2+.025);
   const x=h.axis==='z'?h.x+across:h.x+along,z=h.axis==='z'?h.z-along:h.z+across;
   prop('cityretaining',[x,-62,z],[piece,y+62,.02],h.axis==='z'?(end<0?0:180):(end<0?90:-90),G.works);
  }
 }
 for(const end of [-1,1])for(const side of [-1,1]){
  const y=end<0?h.nearY:h.farY,along=end*length/2;
  const x=h.axis==='z'?h.x+side*(span/2+1):h.x+along+end*.6;
  const z=h.axis==='z'?h.z-along-end*.6:h.z+side*(span/2+1);
  prop('cityjersey',[x,y,z],[2.4,.85,.6],h.axis==='z'?0:90);
  prop('citycone',[x+(h.axis==='z'?side*1.6:0),y,z+(h.axis==='z'?0:side*1.6)]);
 }
 prop('citypavementflat',[h.x,-62,h.z],[h.w,.15,h.d],0,G.foundations);C[C.length-1].color='#000000';
}
// Supports follow the live rail path, including the two hill-clearance knots.
for(let i=0;i<CARLISLE_ORIGINAL_INDICES.length;i++){
 const index=CARLISLE_ORIGINAL_INDICES[i],c=C[i];if(c.t!=='rail'||c.invisible||!c.pts)continue;
 const pts=c.pts.map(p=>[c.p[0]+p[0],c.p[1]+(p[3]??0),c.p[2]+p[1]] as [number,number,number]);
 if([117,151].includes(index))for(const [x,y,z] of pts)prop('cityutilitypole',[x-.65,y-2.72,z],[1.4,3,.4]);
 else for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]),count=Math.max(1,Math.ceil(length/18));
  for(let j=0;j<=count;j++){
   const t=j/count,x=lerp(a[0],b[0],t),y=lerp(a[1],b[1],t),z=lerp(a[2],b[2],t);
   prop('cityscaffold',[x,-48,z],[1.2,y+47.6,1.2]);
  }
 }
}
// Rope anchor and moving-platform frames are scenery around the old motion.
for(const x of [-8,11])prop('cityscaffold',[x,-7,-157.5],[.8,10.5,.8]);
prop('cityscaffold',[1.5,3.5,-157.5],[21,.4,1.2]);
for(const dx of [-2.35,2.35])for(const dz of [-2.35,2.35])prop('cityscaffold',[-5+dx,-20,-1623+dz],[.5,12,.5]);
prop('cityscaffold',[84,-35,-1720],[19,18,10]);

const kinds=['citytownhouse','cityapartments','citycivic','citybrickshops','citywarehouse','citycreamoffice','cityglassoffice','cityterrace','citysteelworks'] as const;
export const CARLISLE_BLOCKS:{x:number;z:number;kind:string}[]=[];
function nearestStreet(x:number,z:number):Street {
 let best=CARLISLE_STREETS[0],distance=Infinity;
 for(const s of CARLISLE_STREETS){
  const lo=Math.min(s.near,s.far),hi=Math.max(s.near,s.far),along=s.axis==='z'?z:x,across=s.axis==='z'?x-s.x:z-s.z;
  const gap=Math.max(lo-along,0,along-hi),d=gap*gap+across*across;
  if(d<distance){distance=d;best=s;}
 }return best;
}
function streetHeight(s:Street,x:number,z:number){const along=s.axis==='z'?z:x;return surfaceY(s,Math.max(0,Math.min(1,(along-s.near)/(s.far-s.near))));}
// Buildings step with the hilly road, with gaps for junctions and machinery.
let serial=0;
for(const [cx,start,end] of [[0,10,-1708],[152,-1735,-2340]])for(const side of [-1,1]){
 for(let z=start-12;z>end;){
  const kind=kinds[(serial*5+(side<0?0:3))%kinds.length],spec=CITY_MODULES[kind],width=spec.size[0],depth=spec.size[2],mid=z-width/2,s=nearestStreet(cx,mid);
  const y=streetHeight(s,cx,mid),half=s.index===11?15:Math.max(s.w/2,7),x=cx+side*(half+5+depth/2);
  if(![[-615,13],[-1920,17],[-1600,12]].some(([at,r])=>Math.abs(mid-at)<r+width/2)){
   prop(kind,[x,y,mid],undefined,side<0?90:-90,G.buildings,0,true);CARLISLE_BLOCKS.push({x,z:mid,kind});
   if(serial%3===0)prop(kinds[(serial+2)%9],[cx+side*(half+35),y,mid-4],undefined,side<0?90:-90,G.buildings,0,true);
   prop('citypavementflat',[x,y-.15,mid],[depth+8,.15,width+3],0,G.foundations);
   if(serial%2===0){prop('citylamp',[cx+side*(half+2.5),y,mid]);prop('cityplanter',[cx+side*(half+2.8),y,mid+4],[1.6,.6,1.6]);prop('seagrape',[cx+side*(half+2.8),y+.6,mid+4]);}
  }
  z-=width+3;serial++;
 }
}
for(const side of [-1,1])for(let x=23;x<144;x+=20){
 const s=nearestStreet(x,-1720),y=streetHeight(s,x,-1720),kind=kinds[(Math.floor(x/20)+(side<0?2:4))%9],spec=CITY_MODULES[kind];
 prop(kind,[x,y,-1720+side*(12+spec.size[2]/2)],undefined,side<0?0:180,G.buildings,0,true);
 CARLISLE_BLOCKS.push({x,z:-1720+side*(12+spec.size[2]/2),kind});
 if(side<0)prop(kinds[(Math.floor(x/20)+5)%9],[x+9,y,-1767],undefined,0,G.buildings,0,true);
}
// Closed side streets give the broad plazas city intersections while leaving
// every original crate cluster and the main takeoff surfaces untouched.
for(const index of [0,31,46,61]){
 const s=CARLISLE_STREETS.find(s=>s.index===index)!,y=s.y0;
 for(const side of [-1,1])for(let d=s.w/2+3;d<64;d+=6)tile('cityroad2',s.x+side*d,y,s.z,6,12,0);
}
for(const [x,z] of [[17,-615],[171,-1920],[-17,-1600]]){
 const s=nearestStreet(x,z),y=streetHeight(s,x,z);prop('cityexcavator',[x,y,z],undefined,x>s.x?90:-90,G.buildings);
}
prop('citycivic',[152,-26,-2347],[26,28,18],0,G.buildings,0,true);

// A continuous city landform fills the backdrop outside the construction
// corridor. Its holes follow the original playable route and excavation rims.
// It is visual-only: original platforms, ramps and fall space own gameplay.
function backdropY(x:number,z:number):number {
 let s:Street;
 if(z>-1775&&z<-1660&&x>8&&x<141){
  s=CARLISLE_STREETS.filter(q=>q.axis==='x').reduce((best,q)=>{
   const distance=(r:Street)=>Math.max(Math.min(r.near,r.far)-x,0,x-Math.max(r.near,r.far));return distance(q)<distance(best)?q:best;
  });
 }else s=nearestStreet(x,z);
 return Math.round((streetHeight(s,x,z)+(s.index===11?7:0)-.18)*1000)/1000;
}
function corridor(z:number):[number,number][] {
 const holes:[number,number][]=[];
 if(Math.abs(z+1720)<=5.2)holes.push([-7,163]);
 for(const s of CARLISLE_STREETS)if(s.axis==='z'&&z>=Math.min(s.near,s.far)&&z<=Math.max(s.near,s.far)){
  const half=(s.index===11?22:s.w)/2+.7;holes.push([s.x-half,s.x+half]);
 }
 for(const h of CARLISLE_EXCAVATIONS)if(Math.abs(z-h.z)<=h.d/2)holes.push([h.x-h.w/2,h.x+h.w/2]);
 holes.sort((a,b)=>a[0]-b[0]);const merged:[number,number][]=[];
 for(const h of holes){const last=merged[merged.length-1];if(last&&h[0]<=last[1])last[1]=Math.max(last[1],h[1]);else merged.push([...h]);}
 return merged;
}
const terrainCuts=Array.from(new Set([
 ...Array.from({length:225},(_,i)=>60-i*12),-1710,-1730,-1714.8,-1725.2,
 ...CARLISLE_EXCAVATIONS.filter(h=>h.axis==='x').flatMap(h=>[h.z-h.d/2,h.z+h.d/2]),
 ...CARLISLE_STREETS.filter(s=>s.axis==='z').flatMap(s=>[s.near,s.far]),
 ...CARLISLE_EXCAVATIONS.filter(h=>h.axis==='z').flatMap(h=>[h.z-h.d/2,h.z+h.d/2]),
])).sort((a,b)=>a-b);
const chunks=new Map<number,{vertices:number[];uvs:number[];indices:number[]}>();
for(let i=1;i<terrainCuts.length;i++){
 const za=terrainCuts[i-1],zb=terrainCuts[i];if(zb-za<.001)continue;
 const holes=corridor((za+zb)/2),key=Math.floor((za+zb)/96)*48;
 const regions:[number,number][]=[];let left=-300;for(const [a,b] of [...holes,[452,452]]){if(a>left)regions.push([left,a]);left=Math.max(left,b);}
 let chunk=chunks.get(key);if(!chunk){chunk={vertices:[],uvs:[],indices:[]};chunks.set(key,chunk);}
 for(const [start,end] of regions){
  const n=Math.ceil((end-start)/24),dx=(end-start)/n;
  for(let j=0;j<n;j++){
   const xa=start+j*dx,xb=xa+dx,k=chunk.vertices.length/3;
   for(const [x,z] of [[xa,za],[xa,zb],[xb,zb],[xb,za]]){chunk.vertices.push(+x.toFixed(4),backdropY(x,z),+(z-key).toFixed(4));chunk.uvs.push(x/5,z/5);}
   chunk.indices.push(k,k+1,k+2,k,k+2,k+3);
  }
 }
}
for(const [z,geometry] of chunks)add({t:'mesh',p:[0,0,z],...geometry,tex:'pavement',color:'#c0c7bb',solid:false,edgeGrinding:false,grp:G.foundations});

const boxLayout=buildCarlisleBoxes(original);
export const CARLISLE_CRATE_SECTIONS=boxLayout.sections;
export const CARLISLE_CRATES=boxLayout.components;
C.push(...boxLayout.components);

export const CARLISLE_COAST_LEVEL:CustomLevelData={
 ...JSON.parse(JSON.stringify(original)),name:'Carlisle Coast',sky:'coast',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:95,fogFar:245,fogColor:'#b1cedd',ambientSky:'#d4e9f1',ambientGround:'#a69981',ambientIntensity:2,sunColor:'#ffe4bd',sunIntensity:3,fillColor:'#b2d5de',fillIntensity:.7,shadowStrength:.42,drawDistance:285},
 medalTimes:{gold:180,silver:210,bronze:255},
 groups:[...Object.entries(G).map(([nm,id])=>({id,nm})),...boxLayout.groups],components:C,
};
