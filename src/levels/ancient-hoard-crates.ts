import type {CustomComponent} from '../level';

export const ANCIENT_HOARD_DELIVERIES = [
 ['arrival',-7,0,'pyramid','mystery'],
 ['jade-gallery',15,6.4,'pyramid','life'],
 ['sealed-court',32.92,0,'row','mystery'],
 ['copper-store',91,0,'row','mystery'],
 ['treasury-exit',149.92,0,'row','mystery'],
 ['last-shelf',163,6,'pyramid','life'],
 ['departure',187,0,'row','mystery'],
] as const;

export function arrangeAncientHoardCrates(components:CustomComponent[]):void{
 const retained=new Set(['Treasury lower finite chest','Treasury upper finite chest','Treasury crown before supports']);
 for(let i=components.length-1;i>=0;i--){const c=components[i];
  if(c.t!=='crate')continue;
  if(c.kind==='bouncy'||(['wood','mystery','life','multihit'].includes(c.kind??'wood')&&!c.outline&&!retained.has(c.nm??'')&&!c.nm?.startsWith('Relay cap ')))components.splice(i,1);
  else if(c.nm==='Revealed jade life'||c.nm==='Revealed jade cache')components.splice(i,1);
 }
 // One finite chest plus a real double jump reaches 8.77m. The 9m crown
 // needs the intact upper chest, so spending it early has a consequence.
 components.find(c=>c.nm==='Treasury crown before supports')!.p[1]=9;
 for(const [name,x,y,shape,cap]of ANCIENT_HOARD_DELIVERIES){
  const cells:readonly (readonly [number,number])[]=shape==='pyramid'?[[-.96,0],[0,0],[.96,0],[-.48,.96],[.48,.96]]:[[-1.92,0],[-.96,0],[0,0],[.96,0],[1.92,0]];
  for(const [i,[u,h]]of cells.entries())components.push({t:'crate',p:[x+u,y+h,0],kind:i===4?cap:'wood',grp:name==='jade-gallery'?20:2,
   ...(name==='jade-gallery'?{outline:true}:{}),nm:`Hoard delivery / ${name} / box ${i+1}`});
 }
}
