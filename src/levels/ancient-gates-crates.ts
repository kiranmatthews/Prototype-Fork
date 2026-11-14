import type {CustomComponent} from '../level';

// Section, station, deck height, box count, cap. Keep supplies on stable
// courts, clear of launchers, timed crossings and the aqueduct run-up.
export const ANCIENT_GATES_SUPPLIES = [
 [1,-6,0,5,'mask'],[1,101,3,5,'mystery'],
 [2,117,3,4,'mystery'],[2,171,10,5,'life'],
 [3,235,5,5,'mystery'],[3,337,7,5,'mystery'],
 [4,353,7,5,'mystery'],[4,448,14,5,'mask'],
 [5,468,14,5,'mystery'],[5,583,9,5,'mystery'],
 [6,595,9,5,'mystery'],[6,599,9,5,'mystery'],
 [7,712,8,5,'mystery'],[7,830,6,5,'mystery'],
 [8,845,6,5,'mystery'],[8,938,10,5,'mystery'],
 [9,951,10,5,'mystery'],[9,1050,13,5,'mystery'],
 [10,1070,10,5,'mystery'],[10,1176,8,5,'mask'],
 [11,1266,25,5,'life'],[11,1282.5,24,5,'mystery'],
 [12,1289,24,6,'mystery'],[12,1372,16,4,'mystery'],
] as const;

export function arrangeAncientGatesCrates(components:CustomComponent[]):void{
 for(let i=components.length-1;i>=0;i--)
  if(components[i].t==='crate'&&['wood','mystery','mask','life'].includes(components[i].kind??'wood'))components.splice(i,1);
 const shapes:Record<number,[number,number][]>={
  4:[[-.48,0],[.48,0],[-.48,.96],[.48,.96]],
  5:[[-.96,0],[0,0],[.96,0],[-.48,.96],[.48,.96]],
  6:[[-.96,0],[0,0],[.96,0],[-.96,.96],[0,.96],[.96,.96]],
 };
 const counts=new Map<number,number>();
 for(const [section,x,y,count,cap]of ANCIENT_GATES_SUPPLIES){
  const cache=(counts.get(section)??0)+1;counts.set(section,cache);
  for(const [i,[u,h]]of shapes[count].entries())components.push({t:'crate',p:[x+u,y+h,0],kind:i===count-1?cap:'wood',grp:section,
   nm:`Gates supplies / section ${section} / cache ${cache} / box ${i+1}`});
 }
}
