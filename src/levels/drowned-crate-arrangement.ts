import type {CustomComponent,CustomLevelData} from '../level';

type Cargo=[number,number,number,number,CustomComponent['kind']?];
/** Fixed cargo floors, in route order. Moving/collapsing footing stays clear. */
export const DROWNED_CARGO:readonly (readonly Cargo[])[]=[
 [[-72.4,-5.77,189,3],[-64.45,-6.136,174.25,3],[-58.5,-5.798,162,4]],
 [[-58.8,-6.311,125,3],[-43,-5.224,111.25,3],[-43.25,-5.576,93.75,4]],
 [[-49.8,0,32,3],[-48,0,24,3],[-46,-6,-55,4],[-58,-4,-50,4,'life']],
 [[-42,-6,-76,3],[-36.25,-5.737,-76,3],[1001,8,-122,4,'mask']],
 [[995.8,8.7,-141.5,3],[999.3,9.3,-153.5,3],[996.5,9.9,-175,4]],
 [[998.2,9.9,-179,3],[997.65,10.488,-201.5,3],[998,10.5,-230,4]],
 [[997.5,10.5,-234,3,'mask'],[1001.5,11,-253,3],[997,11.8,-274,4],[986.5,13.8,-276,4,'life']],
 [[997,11.8,-278,3],[997,13.4,-316,3]],
 [[996.9,13.4,-319,3,'mask'],[1000.5,15.2,-340,3],[997.5,16,-359.5,4]],
 [[996.5,16,-365,3],[995.2,16.8,-376,3],[997,18.4,-405,4]],
 [[996.5,18.4,-420,3,'mask'],[997,19.1,-443,3],[997,20.4,-466,4]],
 [[994.3,21.2,-482.2,3],[1004,21.2,-480,3],[1004,20.8,-503.5,4]],
 [[997,19.4,-518,3],[1003.5,19.4,-539,3],[997,17.2,-557.5,4]],
 [[997,17.2,-561.5,3],[1000.05,17.216,-591,3],[997,16,-616,4]],
 [[1012,16.8,-620,3],[1023,18,-620,3],[1043.5,19.6,-620,4]],
 [[1048.5,19.6,-620.2,3,'mask'],[1068.5,21,-620,3],[1101,18.6,-620.2,4]],
 [[1106.7,18.6,-620.2,3],[1135,16.6,-619.3,3],[1148,16,-620,4]],
 [[1177.5,18,-663,3],[1178,20,-686,3],[1184,20.01,-684,4]],
];
const JOBS=['quay supplies','jetty recovery','mine and grotto count','boarding preparation',
 'cargo island choices','gangway recovery','ferry refuge and high consignment','collapse recovery',
 'stern preparation','interlocking cargo','machinery outside shoulder','both shelf branches',
 'balance refuge','descending timber','broadside stairs','hoist preparation','timber count','treasury count'];

/** Apply after scenic/interior staging. Revision 1 uses the final 1.152 m grid. */
export function arrangeDrownedCrates(data:CustomLevelData):void {
 data.components=data.components.filter(c=>c.t!=='crate');
 for(const [section,cargo]of DROWNED_CARGO.entries())for(const [cluster,[x,y,z,count,kind='wood']]of cargo.entries())
  for(let tier=0;tier<count;tier++)data.components.push({t:'crate',p:[x,y+tier*1.152,z],
   kind:tier?'mystery':kind,grp:9300+section,
   nm:`MERCHANT / ${String(section+1).padStart(2,'0')} ${JOBS[section]} / ${cluster+1}${tier?` · upper ${tier}`:''}`});
 data.groups=[...(data.groups??[]),...JOBS.map((nm,i)=>({id:9300+i,nm:'Merchant cargo · '+nm}))];
 data.crateLayoutRevision=1;
}

/** Enrich the existing three puzzles without supplying replacement launchers. */
export function arrangeLedgerCrates(data:CustomLevelData):void {
 const C=data.components;
 const stack=(base:CustomComponent,count:number)=>{
  for(let i=1;i<count;i++)C.push({...base,p:[base.p[0],base.p[1]+i*1.152,base.p[2]],kind:'mystery',nm:`${base.nm} · upper ${i}`});
 };
 for(const [name,count]of [['Room 1 return: upper life',3],['Room 1 return: upper mystery',3],
  ['Room 2 fuse: refuge reward',3],['Room 3 bridge: receiver reward',3],['Room 3 bridge: receiver mystery',4]] as const)
  stack(C.find(c=>c.nm===name)!,count);
 for(const [x,name,outline]of [[-3,'LEDGER / arrival supplies',false],[29,'LEDGER / return recovery',false],
  [55,'LEDGER / fuse recovery',false],[77,'LEDGER / revealed bridge cargo',true],[99,'LEDGER / exit count',false]] as const){
  const base:CustomComponent={t:'crate',kind:'wood',p:[x,0,0],nm:name,
   grp:outline?C.find(c=>c.nm==='Room 3 bridge: local switch')!.grp:2,outline};C.push(base);stack(base,3);
 }
 data.crateLayoutRevision=1;
}
