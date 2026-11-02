import type {CustomComponent,CustomLevelData} from '../level';
import type {RacePoint} from '../race/types';
import {roundCorners} from '../pathNodes';

export type SpaghettiPoint=RacePoint;
export type P=RacePoint;
export interface SpaghettiRun {name:string;stage:number;choice:number;nodes:P[];radius:number;lanes:number[];gap?:number;dock?:number;jumpEntry?:boolean;}
export interface SpaghettiDock {name:string;p:P;width:number;depth:number;yaw:number;}
export interface SpaghettiIsland {name:string;p:P;w:number;d:number;tier?:number;row?:number;}
export const SPAGHETTI_LOOP={minY:-144,height:288};
export const SPAGHETTI_CORRIDOR={halfWidth:48,near:40};
export const RECOVERY_HEIGHTS=[120,72,24,-24,-72,-120];
export const rounded=(n:number)=>Math.round(n*1000)/1000;

export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
 const p=run.nodes[0];
 return {t:'rail',p:[p[0]+offset,p[1],p[2]],pts:run.nodes.map(q=>[rounded(q[0]-p[0]),rounded(q[2]-p[2]),run.radius,rounded(q[1]-p[1])]),
  curve:'corner',dkind:'citydeck',grp:10+run.stage,nm:run.name};
}
export function spaghettiSamples(c:CustomComponent):P[]{return roundCorners(c.pts!,false).map(q=>[rounded(c.p[0]+q.x),rounded(c.p[1]+q.y),rounded(c.p[2]+q.z)]);}

/** Shared physical contract only. Each course authors its own routes. */
export function spaghettiWorld(platforming:boolean,finishZ:number){
 const components:CustomComponent[]=[],islands:SpaghettiIsland[]=[],recovery:SpaghettiIsland[][]=[];
 const far=finishZ-24,finishY=-132;
 const add=(c:CustomComponent)=>{components.push(c);return c;};
 const slab=(name:string,p:P,w=12,d=14,color=platforming?'#c4b48e':'#8caeb6',grp=2)=>{
  islands.push({name,p:[...p],w,d});
  return add({t:'platform',nm:name,p:[p[0],p[1]-.7,p[2]],s:[w,1.4,d],grp,tex:'spaghetti-basalt',color,emissive:platforming?'#332719':'#132a34'});
 };
 const rail=(name:string,nodes:P[],radius=4,grp=5)=>add(spaghettiRail({name,nodes,radius,stage:grp-10,choice:0,lanes:[0]}));
 const fruit=(p:P,name='Lantern trail')=>add({t:'wumpa',p,nm:name,grp:3});
 const box=(p:P,kind:CustomComponent['kind']='wood',name='Route reward')=>add({t:'crate',p,kind,nm:name,grp:3});
 const rows=Math.ceil((40-(finishZ+32))/24),depth=(40-(finishZ+32))/rows;
 const order=[0,3,1,4,2,5];
 for(let row=0;row<rows;row++){
  recovery[row]=[];
  for(let tier=0;tier<6;tier++){
   const col=(order[row%6]+tier)%6;
   const island:SpaghettiIsland={name:`Recovery ${row}.${tier}`,p:[-40+16*col,RECOVERY_HEIGHTS[tier],40-(row+.5)*depth],w:16.08,d:depth+.08,row,tier};
   recovery[row][tier]=island;islands.push(island);
  }
 }
 // Closed native cuboids packed by four rows, with the actual top triangles
 // first. Existing mesh BVHs and default edge grinding retain every island.
 for(let first=0;first<rows;first+=4){
  const vertices:number[]=[],uvs:number[]=[],tops:number[]=[],sides:number[]=[];
  const originZ=recovery[first][0].p[2];
  const face=(v:P[],top=false)=>{const i=vertices.length/3;for(const p of v){vertices.push(...p);uvs.push(p[0]/8,p[2]/8);} (top?tops:sides).push(i,i+1,i+2,i,i+2,i+3);};
  for(let row=first;row<Math.min(rows,first+4);row++)for(const s of recovery[row]){
   const [x,y,z0]=s.p,z=z0-originZ,a=x-s.w/2,b=x+s.w/2,n=z+s.d/2,f=z-s.d/2,l=y-1.4;
   face([[a,y,n],[b,y,n],[b,y,f],[a,y,f]],true);
   face([[a,l,f],[b,l,f],[b,l,n],[a,l,n]]);
   face([[a,l,n],[b,l,n],[b,y,n],[a,y,n]]);
   face([[b,l,f],[a,l,f],[a,y,f],[b,y,f]]);
   face([[a,l,f],[a,l,n],[a,y,n],[a,y,f]]);
   face([[b,l,n],[b,l,f],[b,y,f],[b,y,n]]);
  }
  add({t:'mesh',nm:`Recovery islands / rows ${first}–${Math.min(rows-1,first+3)}`,p:[0,0,originZ],vertices,indices:[...tops,...sides],uvs,grindTopTriangles:tops.length/3,
   solidSides:true,tex:'spaghetti-basalt',color:platforming?'#62505f':'#476271',emissive:platforming?'#291b24':'#142632',grp:5});
 }
 const recoveryPoint=(z:number,tier:number):P=>{
  const row=Math.max(0,Math.min(rows-1,Math.floor((40-z)/depth)));
  return [...recovery[row][tier].p];
 };
 const recoveryBelow=(p:P,advance=40):P=>{
  const tier=RECOVERY_HEIGHTS.findIndex(y=>y<=p[1]-3),q=recoveryPoint(p[2]-advance,tier<0?5:tier);q[1]+=.9;return q;
 };
 const connectRecovery=(entries:P[])=>{
  for(let tier=0;tier<6;tier++){
   // End each local rail at a landing centre with aligned entry/exit tangents.
   for(let first=0;first<rows-1;first+=8){
    const last=Math.min(rows-1,first+8),nodes:P[]=[];
    for(let row=first;row<=last;row++){
     const p=recovery[row][tier].p;
     if(row===first)nodes.push([p[0],p[1]+.9,p[2]]);
     else nodes.push([p[0],p[1]+.9,p[2]+depth/2-3]);
     if(row===last)nodes.push([p[0],p[1]+.9,p[2]]);
     else nodes.push([p[0],p[1]+.9,p[2]-depth/2-1]);
    }
    rail(`Recovery weave / tier ${tier+1} / span ${first/8+1}`,nodes,3);
   }
   const end=recovery[rows-1][tier].p,x=end[0]*.4;
   rail(`Recovery collector / tier ${tier+1}`,[[end[0],end[1]+.9,end[2]],[end[0],end[1]+.9,finishZ+29],[x,finishY+.9,finishZ+14],[x,finishY+.9,finishZ+5]],2);
   const entry=entries[tier],target=recoveryPoint(entry[2]-108,tier);
   rail(`Tier exchange ${tier+1}`,[[entry[0],entry[1]+3.5,entry[2]-4],
    [entry[0],entry[1]+3.5,entry[2]-16],[target[0],target[1]+.9,target[2]]],5);
  }
 };
 const finish=()=>{
  slab('Finish collector',[0,finishY,finishZ-2],96,72,platforming?'#d0b285':'#96bbc0');
  add({t:'gate',p:[0,finishY,finishZ],grp:2,nm:'Spaghetti / shared finish'});
  if(platforming)add({t:'crystal',p:[0,finishY,finishZ+9],grp:3,nm:'Lanternworks crystal'});
 };
 const data=(spawn:P):CustomLevelData=>{
  add({t:'zone',p:[0,0,(42+far-2)/2],s:[104,1,44-far],dir:'S',grp:1,nm:'Steady forward corridor'});
  for(const side of [-1,1])add({t:'coastwall',p:[side*49,-144,42],pts:[[0,0],[0,far-44]],w:2,rise:288,grp:90,nm:'Periodic corridor side'});
  for(const z of [41,far-1])add({t:'coastwall',p:[-50,-144,z],pts:[[0,0],[100,0]],w:2,rise:288,grp:90,nm:'Periodic corridor end'});
  return {v:1,name:platforming?'Spaghetti Rails — Platforming':'Spaghetti Rails',spawn:[spawn[0],spawn[1]+.08,spawn[2]],startWarpPad:false,
   killY:-500,verticalLoop:{...SPAGHETTI_LOOP},sky:'day',keepPlayFog:true,hugeDropBail:false,perfectGrindBoost:true,allBalanceCrates:false,
   medalTimes:platforming?{gold:190,silver:270,bronze:390}:{gold:135,silver:165,bronze:210},components,
   groups:[{id:1,nm:'Forward camera',editorOnly:true},{id:2,nm:platforming?'Lantern landings':'Race interchanges',editorOnly:true},
    {id:3,nm:'Rewards and encounters',editorOnly:true},{id:5,nm:'Six-height recovery weave',editorOnly:true},{id:90,nm:'Periodic architecture',editorOnly:true}]};
 };
 return {components,islands,recovery,add,slab,rail,fruit,box,recoveryPoint,recoveryBelow,connectRecovery,finish,data,far,finishZ,finishY};
}
