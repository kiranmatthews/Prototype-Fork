import type {CustomLevelData} from '../level';

type Cargo=readonly [number,number,number,'mask'?];
/** Fixed-floor supplies in checkpoint order. Short axe/transfer intervals stay sparse. */
export const GHOST_CARGO:readonly (readonly Cargo[])[]=[
 [[12,-1.9,3,'mask'],[28,1.9,3],[48,-1.9,4]],
 [[64,1.9,3,'mask'],[70,-1.9,3],[122,-1.9,4]],
 [[146,-1.9,3],[166,1.9,3]],
 [[191,-1.9,3],[197,-1.9,3],[203,1.9,4]],
 [[235,-1.9,3],[277,1.9,3],[297,-1.9,4]],
 [[365,1.9,3],[415,1.9,3],[451,-1.9,4]],
 [[486,-1.9,3]],
 [[523,-1.9,3],[537,1.9,3],[543,-1.9,4]],
 [[594,-1.9,3],[630,1.9,3],[684,-1.9,4]],
 [[731,-1.9,3],[753,1.9,3],[797,1.9,4]],
 [[849,-1.9,3,'mask'],[899,1.9,3],[947,-1.9,4]],
 [[999,-1.9,3],[1053,-1.9,3],[1056,1.9,4]],
 [[1064,-1.9,3],[1080,1.9,3]],
 [[1107,-1.9,3],[1147,1.9,3],[1161,-1.9,4]],
 [[1224,-1.9,3],[1230,-1.9,3],[1236,1.9,4]],
 [[1291,-1.9,3],[1297,-1.9,3],[1303,1.9,4]],
 [[1357,-1.9,3],[1365,1.9,3],[1375,-1.9,4]],
 [[1418,1.9,3,'mask'],[1424,-1.9,3],[1588,-1.9,4]],
 [[1610,-1.9,3],[1648,1.9,3],[1678,-1.9,4]],
 [[1704,-1.9,3],[1790,1.9,3],[1828,-1.9,4]],
 [[1894,-1.9,3],[1908,1.9,3],[1948,-1.9,4]],
 [[1967,-1.9,3,'mask'],[1981,1.9,3],[2007,-1.9,4]],
 [[2041,-1.9,3],[2087,1.9,3],[2129,-1.9,4]],
 [[2173,-1.9,3],[2227,-1.9,3],[2234,1.9,4]],
];
export function arrangeGhostTrainCrates(data:CustomLevelData,point:(s:number,y?:number,u?:number)=>[number,number,number]):void {
 data.components=data.components.filter(c=>c.t!=='crate');
 for(const [section,columns]of GHOST_CARGO.entries())for(const [cluster,[station,offset,count,kind]]of columns.entries()){
  const p=point(station,undefined,offset);
  for(let tier=0;tier<count;tier++)data.components.push({t:'crate',p:[p[0],p[1]+tier*1.152,p[2]],kind:tier?'mystery':kind??'wood',grp:9600+section,
   nm:`GHOST CARGO / ${section+1} / ${cluster+1} · ${tier?'upper count':kind?'encounter preparation':cluster===0?'safe arrival':cluster===columns.length-1?'departure count':'waiting-area supplies'} · ${tier}`});
 }
 data.groups=[...(data.groups??[]),...GHOST_CARGO.map((_,i)=>({id:9600+i,nm:`Ghost Train checkpoint supplies ${i+1}`}))];
 data.crateLayoutRevision=1;
}
