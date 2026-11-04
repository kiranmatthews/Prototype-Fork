import type {CustomComponent,CustomLevelData} from '../level';
import type {RacePoint} from '../race/types';
import {roundCorners} from '../pathNodes';

export type SpaghettiPoint=RacePoint;
export type P=RacePoint;
export interface SpaghettiRun {name:string;stage:number;choice:number;nodes:P[];radius:number;lanes:number[];gap?:number;dock?:number;jumpEntry?:boolean;}
export interface SpaghettiDock {name:string;p:P;width:number;depth:number;yaw:number;}
export interface SpaghettiIsland {name:string;p:P;w:number;d:number;tier?:number;row?:number;}
export const SPAGHETTI_VERTICAL_SCALE=1/3;
export const SPAGHETTI_LOOP={minY:-48,height:96};
export const SPAGHETTI_RACE_LOOP={minY:-24,height:48};
export const SPAGHETTI_CORRIDOR={halfWidth:48,near:40};
const authoredRecoveryHeights=[120,72,24,-24,-72,-120];
export const RECOVERY_HEIGHTS=authoredRecoveryHeights.map(y=>y*SPAGHETTI_VERTICAL_SCALE);
export const rounded=(n:number)=>Math.round(n*1000)/1000;
/** Preserve headroom where a primary deck sits just below a recovery shelf.
 * Return authoring coordinates; data() applies the shared vertical scale. */
export function spaghettiClearanceHeight(y:number,platforming=true):number {
 const scale=platforming?SPAGHETTI_VERTICAL_SCALE:1/6,top=y*scale;
 const ceiling=(platforming?[...RECOVERY_HEIGHTS].reverse():[-12,12]).find(h=>h>top+.05);
 return ceiling!==undefined&&ceiling-top<6?(ceiling-6)/scale:y;
}

export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
 const p=run.nodes[0];
 return {t:'rail',p:[p[0]+offset,p[1],p[2]],pts:run.nodes.map(q=>[rounded(q[0]-p[0]),rounded(q[2]-p[2]),run.radius,rounded(q[1]-p[1])]),
  curve:'corner',dkind:'citydeck',grp:10+run.stage,nm:run.name};
}
export function spaghettiSamples(c:CustomComponent):P[]{return roundCorners(c.pts!,false).map(q=>[rounded(c.p[0]+q.x),rounded(c.p[1]+q.y),rounded(c.p[2]+q.z)]);}

/** Shared physical contract only. Each course authors its own routes. */
export function spaghettiWorld(platforming:boolean,finishZ:number){
 const scale=platforming?SPAGHETTI_VERTICAL_SCALE:1/6,loop=platforming?SPAGHETTI_LOOP:SPAGHETTI_RACE_LOOP;
 const recoveryHeights=platforming?authoredRecoveryHeights:[72,-72,72,-72,72,-72];
 const components:CustomComponent[]=[],islands:SpaghettiIsland[]=[],recovery:SpaghettiIsland[][]=[];
 const far=finishZ-24,finishY=-132;
 const add=(c:CustomComponent)=>{components.push(c);return c;};
 const slab=(name:string,p:P,w=12,d=14,color=platforming?'#c4b48e':'#8caeb6',grp=2)=>{
  islands.push({name,p:[...p],w,d});
  return add({t:'platform',nm:name,p:[p[0],p[1]-.7,p[2]],s:[w,1.4,d],grp,tex:'spaghetti-basalt',color,emissive:platforming?'#332719':'#132a34'});
 };
 const rail=(name:string,nodes:P[],radius=4,grp=5)=>add(spaghettiRail({name,nodes,radius,stage:grp-10,choice:0,lanes:[0]}));
 // An ordinary closed riding surface: gravity earns the launch speed. The
 // midpoint stays in the island inventory; no extra floor fills the gaps.
 const downhill=(name:string,p:P,width:number,length:number,drop:number,grp:number)=>{
  islands.push({name,p:[...p],w:width,d:length});
  const x=width/2,z=length/2,h=drop/2;
  return add({t:'mesh',nm:name,p,vertices:[-x,h,z,x,h,z,x,-h,-z,-x,-h,-z,-x,h-1.4,z,x,h-1.4,z,x,-h-1.4,-z,-x,-h-1.4,-z],
   indices:[0,1,2,0,2,3,4,7,6,4,6,5,4,5,1,4,1,0,7,3,2,7,2,6,4,0,3,4,3,7,5,6,2,5,2,1],
   grindTopTriangles:2,solidSides:true,gravityTrack:true,tex:'spaghetti-basalt',color:'#c6a56e',grp});
 };
 const fork=(name:string,a:SpaghettiIsland,b:SpaghettiIsland,side=-1,grp=5,mouth=4)=>{
  const ax=a.p[0]+side*mouth,bx=b.p[0]+side*3;
  // Separate mouths can be selected on the landing, then both ends flatten
  // before their platforms. Never turn sideways across a platform edge.
  const nodes:P[]=[[ax,a.p[1]+.9,a.p[2]+2],[ax,a.p[1]+.9,a.p[2]-a.d/2-2],
   [bx,b.p[1]+.9,b.p[2]+b.d/2+3],[bx,b.p[1]+.9,b.p[2]+2]];
  const component=rail(name,nodes,6,grp);
  const drop=a.p[1]-b.p[1],color=drop>55?'#eeac6e':drop>5?'#88d8d2':'#d5bfed';
  const arrowWidth=Math.min(1.15,a.w/2-mouth-.1);
  add({t:'mesh',nm:name+' / departure arrow',p:[ax,a.p[1]+.02,a.p[2]+4],vertices:[-arrowWidth,0,1.3,0,0,-1.5,arrowWidth,0,1.3,0,0,.4],indices:[0,1,3,1,2,3],
   color,emissive:color,tex:'solid',solid:false,scenerySolid:false,castShadow:false,doubleSided:true,grp});
  return component;
 };
 const fruit=(p:P,name='Lantern trail')=>add({t:'wumpa',p,nm:name,grp:3});
 const box=(p:P,kind:CustomComponent['kind']='wood',name='Route reward')=>add({t:'crate',p,kind,nm:name,grp:3});
 const rows=Math.ceil((40-(finishZ+32))/24),depth=(40-(finishZ+32))/rows;
 const order=[0,3,1,4,2,5];
 for(let row=0;row<rows;row++){
  recovery[row]=[];
  for(let tier=0;tier<6;tier++){
   const col=(order[row%6]+tier)%6;
   const island:SpaghettiIsland={name:`Recovery ${row}.${tier}`,p:[-40+16*col,recoveryHeights[tier],40-(row+.5)*depth],w:16.08,d:depth+.08,row,tier};
   recovery[row][tier]=island;islands.push(island);
  }
 }
 // Closed native cuboids packed by four rows, with the actual top triangles
 // first. Existing mesh BVHs and default edge grinding retain every island.
 const buildRecovery=()=>{for(let first=0;first<rows;first+=4){
  const vertices:number[]=[],uvs:number[]=[],tops:number[]=[],sides:number[]=[];
  const originZ=recovery[first][0].p[2];
  const face=(v:P[],top=false)=>{const i=vertices.length/3;for(const p of v){vertices.push(...p);uvs.push(p[0]/8,p[2]/8);} (top?tops:sides).push(i,i+1,i+2,i,i+2,i+3);};
  for(let row=first;row<Math.min(rows,first+4);row++)for(const s of recovery[row]){
   const [x,y,z0]=s.p,z=z0-originZ,a=x-s.w/2,b=x+s.w/2,n=z+s.d/2,f=z-s.d/2;
   const spring=components.find(c=>c.t==='trampoline'&&Math.abs(c.p[1]-y)<.1&&Math.abs(c.p[0]-x)<.1&&Math.abs(c.p[2]-z0)<.1);
   // Recess the backing directly beneath a spring. The existing native pad
   // covers the opening, while Carlisle's net can sag without a second floor.
   const pieces=spring?(()=>{const sx=spring.s![0]/2,sz=spring.s![2]/2;
    return [[a,x-sx,f,n,y],[x+sx,b,f,n,y],[x-sx,x+sx,f,z-sz,y],[x-sx,x+sx,z+sz,n,y],[x-sx,x+sx,z-sz,z+sz,y-2.4]];
   })():[[a,b,f,n,y]];
   for(const [a,b,f,n,y] of pieces){const l=y-1.4;
    face([[a,y,n],[b,y,n],[b,y,f],[a,y,f]],true);
    face([[a,l,f],[b,l,f],[b,l,n],[a,l,n]]);
    face([[a,l,n],[b,l,n],[b,y,n],[a,y,n]]);
    face([[b,l,f],[a,l,f],[a,y,f],[b,y,f]]);
    face([[a,l,f],[a,l,n],[a,y,n],[a,y,f]]);
    face([[b,l,n],[b,l,f],[b,y,f],[b,y,n]]);
   }
  }
  add({t:'mesh',nm:`Recovery islands / rows ${first}–${Math.min(rows-1,first+3)}`,p:[0,0,originZ],vertices,indices:[...tops,...sides],uvs,grindTopTriangles:tops.length/3,
   solidSides:true,tex:'spaghetti-basalt',color:platforming?'#62505f':'#476271',emissive:platforming?'#291b24':'#142632',grp:5});
 }};
 const recoveryPoint=(z:number,tier:number):P=>{
  const row=Math.max(0,Math.min(rows-1,Math.floor((40-z)/depth)));
  return [...recovery[row][tier].p];
 };
 const recoveryBelow=(p:P,advance=40):P=>{
  const points=recoveryHeights.map((_,tier)=>recoveryPoint(p[2]-advance,tier));
  const q=[...(points.find(q=>q[1]<=p[1]-3)??points[5])] as P;q[1]+=.9;return q;
 };
 const recoveryLanding=(z:number,tier:number)=>recovery[Math.max(0,Math.min(rows-1,Math.floor((40-z)/depth)))][tier];
 const lowerLanding=(p:P,advance=120,extra=0)=>{
  const candidates=recoveryHeights.map((_,tier)=>recoveryLanding(p[2]-advance,tier)).filter(h=>h.p[1]<=p[1]-6).sort((a,b)=>b.p[1]-a.p[1]);
  return candidates[Math.min(extra,candidates.length-1)]??recoveryLanding(p[2]-advance,5);
 };
 const connectRecovery=()=>{
  for(let tier=0;tier<6;tier++){
   // Three interleaved threads retain every landing but replace the old
   // near-sideways zigzags with longer forward diagonals. Each local span
   // still hands off at a supported centre with an aligned tangent.
   for(let thread=0;thread<3;thread++){
    const final=rows-1-((rows-1-thread)%3);
    for(let first=thread;first<final;first+=24){
     const last=Math.min(final,first+24),nodes:P[]=[];
     for(let row=first;row<=last;row+=3){
      const p=recovery[row][tier].p;
      if(row===first)nodes.push([p[0],p[1]+.9,p[2]]);
      else nodes.push([p[0],p[1]+.9,p[2]+10]);
      if(row===last)nodes.push([p[0],p[1]+.9,p[2]]);
      else nodes.push([p[0],p[1]+.9,p[2]-10]);
     }
     rail(`Recovery weave / tier ${tier+1} / thread ${thread+1} / span ${(first-thread)/24+1}`,nodes,3);
    }
    const end=recovery[final][tier].p,x=end[0]*.4;
    rail(`Recovery collector / tier ${tier+1} / thread ${thread+1}`,[[end[0],end[1]+.9,end[2]],[end[0],end[1]+.9,end[2]-6],[x,finishY+.9,finishZ+14],[x,finishY+.9,finishZ+5]],2);
   }
   const spacing=platforming?9:12;
   for(let row=3+tier%3,index=0;row+7<rows;row+=spacing,index++){
    const a=recovery[row][tier],mode=index%3;
    const lower=recovery[row+6].find(b=>b.p[1]<a.p[1]-.1);
    if(mode===0||!lower)fork(`Recovery fork / ${row}.${tier} / level express`,a,recovery[row+6][tier],-1);
    else {
     fork(`Recovery fork / ${row}.${tier} / shallow descent`,a,lower,-1);
     if(mode===2)fork(`Recovery fork / ${row}.${tier} / steep descent`,a,recovery[row+4][platforming?Math.min(5,tier+2):lower.tier!],1);
    }
   }
  }
 };
 const finish=()=>{
  slab('Finish collector',[0,finishY,finishZ-2],96,72,platforming?'#d0b285':'#96bbc0');
  add({t:'gate',p:[0,finishY,finishZ],grp:2,nm:'Spaghetti / shared finish'});
  if(platforming)add({t:'crystal',p:[0,finishY,finishZ+9],grp:3,nm:'Lanternworks crystal'});
 };
 const data=(spawn:P):CustomLevelData=>{
  // Compress height differences, never the rider, collision thickness or
  // Carlisle artwork. Native rails retain their useful clearance above decks.
  for(const c of components){
   const y=c.p[1];c.p=[c.p[0],y*scale,c.p[2]];
   if((c.t==='platform'||c.t==='crumble'||c.t==='mover')&&c.s){
    const recess=c.nm?.endsWith('/ spring well')?2.4:0;
    c.p[1]=(y+c.s[1]/2+recess)*scale-c.s[1]/2-recess;
   }
   if(c.t==='rail'){c.p[1]+=.9*(1-scale);if(c.pts)c.pts=c.pts.map(p=>[p[0],p[1],p[2]??0,(p[3]??0)*scale]);}
   if(c.t==='mesh'&&c.vertices)c.vertices=c.vertices.map((v,i)=>i%3===1?v*scale:v);
   // Keep the quarter-circle pipe profile: flattening it removes the native
   // lip-release/transfer. Its base and stacked receiver heights still shrink.
   if(c.t==='ramp'&&c.rise!==undefined)c.rise*=scale;
   if(c.t==='trampoline'){c.p[1]+=.03*(1-scale);c.speed=(c.speed??32)*Math.sqrt(scale);}
   if(c.t==='speedpad')c.p[1]+=.03*(1-scale);
  }
  for(const island of islands)island.p[1]*=scale;
  buildRecovery();
  add({t:'zone',p:[0,0,(42+far-2)/2],s:[104,1,44-far],dir:'S',grp:1,nm:'Steady forward corridor'});
  for(const side of [-1,1])add({t:'coastwall',p:[side*49,loop.minY,42],pts:[[0,0],[0,far-44]],w:2,rise:loop.height,grp:90,nm:'Periodic corridor side'});
  for(const z of [41,far-1])add({t:'coastwall',p:[-50,loop.minY,z],pts:[[0,0],[100,0]],w:2,rise:loop.height,grp:90,nm:'Periodic corridor end'});
  return {v:1,name:platforming?'Spaghetti Rails — Platforming':'Spaghetti Rails',spawn:[spawn[0],spawn[1]*scale+.08,spawn[2]],startWarpPad:false,
   killY:-180,verticalLoop:{...loop},sky:'day',keepPlayFog:true,hugeDropBail:false,perfectGrindBoost:true,allBalanceCrates:false,
   medalTimes:platforming?{gold:190,silver:270,bronze:390}:{gold:135,silver:165,bronze:210},components,
   groups:[{id:1,nm:'Forward camera',editorOnly:true},{id:2,nm:platforming?'Lantern landings':'Race interchanges',editorOnly:true},
    {id:3,nm:'Rewards and encounters',editorOnly:true},{id:5,nm:platforming?'Six-height recovery weave':'Two-height recovery weave',editorOnly:true},{id:90,nm:'Periodic architecture',editorOnly:true}]};
 };
 return {components,islands,recovery,add,slab,downhill,rail,fork,fruit,box,recoveryPoint,recoveryBelow,recoveryLanding,lowerLanding,connectRecovery,finish,data,far,finishZ,finishY,scale};
}
