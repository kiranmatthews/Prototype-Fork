import type {CustomComponent,CustomLevelData} from '../level';

/** Optional fixed-floor harvests; the vert, spines, kickers and loops stay clear. */
export const WATERPARK_CARGO:readonly (readonly [number,number,number,number])[]=[
 [-29,130,186,3],[-7,130,186,3],[-29,130,169,4],
 [-11,48,-186,3],[-39,48,-181,3],[-39,48,-190,4],
 [54,-165,-1026,3],[66,-165,-1035,3],[54,-165,-1045,4],
];
export function arrangeWaterparkCrates(data:CustomLevelData):void {
 data.components=data.components.filter(c=>c.t!=='crate');
 const jobs=['admission choice','arcade detour','survivor count'];
 for(const [i,[x,y,z,count]]of WATERPARK_CARGO.entries())for(let tier=0;tier<count;tier++)
  data.components.push({t:'crate',p:[x,y+tier*1.152,z],kind:tier?'mystery':'wood',grp:9400+Math.floor(i/3),
   nm:`DEADWATER / ${jobs[Math.floor(i/3)]} / ${i+1}${tier?` · upper ${tier}`:''}`});
 data.groups=[...(data.groups??[]),...jobs.map((nm,i)=>({id:9400+i,nm:'Deadwater cargo · '+nm}))];
 data.crateLayoutRevision=1;
}

/** Preserve the fuse, bridge and return-arrow order; expand their earned payload. */
export function arrangeValveHouseCrates(data:CustomLevelData):void {
 const C=data.components;
 C.find(c=>c.nm==='Room 1 fuse: wooden takeoff cap')!.p[1]=1.152;
 const stack=(base:CustomComponent,count:number)=>{
  for(let i=1;i<count;i++)C.push({...base,p:[base.p[0],base.p[1]+i*1.152,base.p[2]],kind:'mystery',nm:`${base.nm} · upper ${i}`});
 };
 for(const [name,count]of [['Room 1 fuse: refuge reward',3],['Room 2 bridge: receiver reward',3],
  ['Room 2 bridge: receiver mystery',4],['Room 3 return: upper life',3],['Room 3 return: upper mystery',3]] as const){
  const base=C.find(c=>c.nm===name)!;
  if(name.startsWith('Room 3'))base.p[1]=8.4;
  stack(base,count);
 }
 for(const [x,name,outline]of [[-3,'VALVE / arrival supplies',false],[23,'VALVE / fuse recovery',false],
  [44,'VALVE / revealed crossing',true],[99,'VALVE / exit count',false]] as const){
  const base:CustomComponent={t:'crate',kind:'wood',p:[x,0,0],nm:name,grp:outline?21:2,outline};
  C.push(base);stack(base,3);
 }
 data.crateLayoutRevision=1;
}
