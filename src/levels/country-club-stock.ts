import type { CustomLevelData, LevelEntry } from '../level';

/** Complete content identity; a changed colour, vertex or saved marker stays edited. */
export function countryClubFingerprint(data:CustomLevelData):string {
  const text=JSON.stringify(data,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]])):value);
  let a=2166136261,b=2246822519;
  for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),3266489917);}
  return `${text.length}:${(a>>>0).toString(16)}:${(b>>>0).toString(16)}`;
}
const previousStock=new Set<string>(['741569:138a24c3:129bf213','741598:3e5d772a:9471179e','2139577:e4d1cc7b:7ddae365','3199698:f06e4311:778e19db','3697153:f75d7273:ef168fdb']);
export function isPreviousCountryClubStock(entry:LevelEntry):boolean {
  return entry.id==='country-club'&&entry.name==='Country Club Circuit'&&!!entry.data&&[731,732,1034,1327,1640].includes(entry.data.components.length)&&entry.data.edgeGrindingRevision!==1
    &&previousStock.has(countryClubFingerprint(entry.data));
}
