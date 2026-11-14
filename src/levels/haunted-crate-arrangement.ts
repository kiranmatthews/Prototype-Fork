import type {CustomComponent,CustomLevelData} from '../level';
import {routePoint} from './blockworks-geometry';

type Cargo=readonly [number,number,number,number,CustomComponent['kind']?];
/** Fixed banks and roofs between the original six checkpoints. */
export const HAUNTED_CARGO:readonly (readonly Cargo[])[]=[
 [[28,0,-3.2,3,'mask'],[216,-2.4,2.3,3],[410,7.2,-2,4]],
 [[530,0,-2.3,3],[620,0,2.5,3],[680,0,-2.3,4]],
 [[1016,3.6,-3,4]], // Six retained high-air targets complete this section's ten.
 [[1060,3.6,-2.5,3],[1131,3.6,11,4,'life'],[1240,8.4,-2.3,3]],
 [[1310,8.4,-2.3,3],[1385,8.4,-3,3],[1490,13.2,-2.5,4]],
 [[1704,4.8,2.4,3,'mask'],[1858,6,-2.3,3],[1884,6,2.4,4]],
 [[1940,6,-2.3,3],[1960,6,2.3,3],[2130,13.2,-3,4]],
];
export function arrangeHauntedCrates(data:CustomLevelData):void {
 // The 700 structural steel crates and their three switches are geometry.
 data.components=data.components.filter(c=>c.t!=='crate'||c.kind==='metal'||c.kind==='bang'||c.nm?.includes('high-air crate'));
 const jobs=['entry preparation','dry ice refuges','vert recovery','foundry choices','machinery banks','roof relay preparation','crown count'];
 for(const [section,columns]of HAUNTED_CARGO.entries())for(const [cluster,[s,y,u,count,kind='wood']]of columns.entries()){
  const p=routePoint(s,y,u);
  for(let tier=0;tier<count;tier++)data.components.push({t:'crate',p:[p[0],p[1]+tier*1.152,p[2]],kind:tier?'mystery':kind,
   grp:9500+section,nm:`HAUNTED / ${jobs[section]} / ${cluster+1}${tier?` · upper ${tier}`:''}`});
 }
 for(const c of data.components)if(c.t==='enemy'&&(c.foe==='moa'||c.foe==='spiker')){c.foe='grunt';c.nm='Castle guardian · spin or pass outside';}
 data.groups=[...(data.groups??[]),...jobs.map((nm,i)=>({id:9500+i,nm:'Haunted cargo · '+nm}))];
 data.crateLayoutRevision=1;
}

/** Keep the return donor, switch-built bridge and finite-bounce cap intact. */
export function arrangeHauntedBonusCrates(data:CustomLevelData):void {
 const C=data.components;
 C.find(c=>c.nm==='Room 3 finite: upper finite support')!.p[1]=1.152;
 const stack=(base:CustomComponent,count:number)=>{
  for(let i=1;i<count;i++)C.push({...base,p:[base.p[0],base.p[1]+i*1.152,base.p[2]],kind:'mystery',nm:`${base.nm} · upper ${i}`});
 };
 for(const [name,count]of [['Room 1 return: upper life',3],['Room 1 return: upper mystery',3],
  ['Room 2 bridge: receiver reward',3],['Room 2 bridge: receiver mystery',4]] as const){
  const base=C.find(c=>c.nm===name)!;if(name.startsWith('Room 1'))base.p[1]=8.4;stack(base,count);
 }
 for(const [x,name,outline]of [[-3,'HAUNTED BONUS / arrival',false],[29,'HAUNTED BONUS / return recovery',false],
  [51,'HAUNTED BONUS / bridge cargo',true],[96,'HAUNTED BONUS / exit count',false]] as const){
  const base:CustomComponent={t:'crate',kind:'wood',p:[x,0,0],nm:name,grp:outline?21:2,outline};C.push(base);stack(base,3);
 }
 data.crateLayoutRevision=1;
}
