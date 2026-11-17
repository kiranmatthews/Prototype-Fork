import type {CustomComponent} from '../level';
import {RUMBLEWATER_REFUGES,rumbleProgress,rumblePoint,rumbleHeight} from './rumblewater-run';

// Shelter supplies leave the central restart lane clear. Smash barricades,
// Nitro lane markers, the opening mask and both branch lives keep their jobs.
export const ROLLING_BONES_CARGO = [
 [1,319,-3.5,4,'mystery'],[1,319,3.5,5,'mystery'],
 [2,734,-3.5,5,'mystery'],[2,734,3.5,5,'mask'],
 [3,1173,-3.5,3,'mystery'],[4,1663,-3.5,3,'mystery'],
 [5,2011,-3.5,6,'mask'],[6,2480,-3.5,2,'mystery'],
 [7,2656,4,5,'mystery'],[7,2664,-4,6,'mystery'],
] as const;

export function arrangeRollingBonesCrates(components:CustomComponent[]):void{
 for(let i=components.length-1;i>=0;i--){const c=components[i];if(c.t!=='crate')continue;
  const s=rumbleProgress(c.p),barrier=c.kind==='wood'&&[1006,1468,2310,2451].some(x=>Math.abs(s-x)<.1);
  const branch=c.kind==='life'&&[225,663].some(x=>Math.abs(s-x)<.1),mask=c.kind==='mask'&&Math.abs(s-35)<.1;
  if(!barrier&&!branch&&!mask&&!['metal','nitro','nitrobang'].includes(c.kind??'wood'))components.splice(i,1);
 }
 const shapes:Record<number,[number,number][]>={2:[[-.48,0],[.48,0]],3:[[-.48,0],[.48,0],[0,.96]],
  4:[[-.48,0],[.48,0],[-.48,.96],[.48,.96]],5:[[-.96,0],[0,0],[.96,0],[-.48,.96],[.48,.96]],
  6:[[-.96,0],[0,0],[.96,0],[-.96,.96],[0,.96],[.96,.96]]};
 const counts=new Map<number,number>();
 for(const [section,s,u,count,cap]of ROLLING_BONES_CARGO){const q=rumblePoint(s,rumbleHeight(s),u),cache=(counts.get(section)??0)+1;counts.set(section,cache);
  for(const [i,[x,y]]of shapes[count].entries())components.push({t:'crate',p:[q[0]+x,q[1]+y,q[2]],kind:i===count-1?cap:'wood',grp:section<7?RUMBLEWATER_REFUGES[section-1].grp:23,nm:`Bones shelter / section ${section} / cache ${cache} / box ${i+1}`});
 }
}
