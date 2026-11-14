import type {CustomComponent} from '../level';

export const MOONBONE_DELIVERIES=[['crypt',-1,0,false],['gallery',23,6,false],['far-crypt',53.5,6,true],['vault',82,0,false]] as const;
export function arrangeMoonboneCrates(components:CustomComponent[]):void{
 for(let i=components.length-1;i>=0;i--){const c=components[i];if(c.t==='crate'&&!['Moon-eye arrow','Moon-eye high life'].includes(c.nm??''))components.splice(i,1);}
 // An actual cargo rebound, double jump and repeated air spins stay below
 // 14.84m here. The 15m life requires the preserved arrow's stronger bounce.
 components.find(c=>c.nm==='Moon-eye high life')!.p[1]=15;
 for(const [name,x,y,row]of MOONBONE_DELIVERIES){const shape=row?[[-1.92,0],[-.96,0],[0,0],[.96,0],[1.92,0]]:[[-.96,0],[0,0],[.96,0],[-.48,.96],[.48,.96]];
  shape.forEach(([u,h],i)=>components.push({t:'crate',p:[x+u,y+h,0],kind:i===4?'mystery':'wood',grp:2,nm:`Moonbone delivery / ${name} / box ${i+1}`}));
 }
}
