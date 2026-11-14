import type {CustomComponent} from '../level';

// Each fixed landing gets one readable delivery. The final flight, rather
// than the safe finish floor, carries the room's life reward.
export const CUMULUS_DELIVERIES=[[-4,180,false],[12.5,180.4,false],[25.2,181,false],
 [37.5,180.3,true],[52,180.7,false],[66.5,180,false]] as const;
export function arrangeCumulusCrates(components:CustomComponent[]):void{
 for(let i=components.length-1;i>=0;i--)if(components[i].t==='crate')components.splice(i,1);
 for(const [i,[x,y,row]]of CUMULUS_DELIVERIES.entries()){
  const shape=row?[[-1.44,0],[-.48,0],[.48,0],[1.44,0]]:[[-.48,0],[.48,0],[-.48,.96],[.48,.96]];
  shape.forEach(([u,h],j)=>components.push({t:'crate',p:[x+u,y+h,0],kind:j===3?'mystery':'wood',grp:2,nm:`Cumulus delivery / island ${i+1} / box ${j+1}`}));
 }
 components.push({t:'crate',p:[58.7,187,0],kind:'life',grp:2,nm:'Cumulus final-flight life'});
}
