import type { CustomComponent, CustomLevelData } from '../level';

/** Fern Reliquary keeps the Primer's working tools, bridges and attack order.
 * Harvest walls replace loose rewards without adding a new launch beside the
 * high life or the conserved-arrow gallery. */
export function arrangeFernReliquaryCrates(data:CustomLevelData):void {
  const C=data.components;
  const add=(x:number,y:number,kind:NonNullable<CustomComponent['kind']>,job:string)=>
    C.push({t:'crate',p:[x,y,0],kind,grp:2,nm:`FERN / ${job}`});
  add(-2.96,0,'wood','TEACH / shield stock base');
  add(-2.96,.96,'mystery','REWARD / shield stock lid');
  for(const [x,y]of [[2.96,0],[2,.96],[2.96,.96],[2,1.92],[2.96,1.92]])
    add(x,y,y?'mystery':'wood','TEACH / opening harvest wall');
  add(6,.96,'wood','TOOL / finite support payload');
  add(6,1.92,'mystery','REWARD / finite support crown');
  // Timber boxes remain single landing markers: extra height here would
  // create an alternate launch toward the later conserved-arrow gallery.
  for(const [x,y]of [[68.04,8],[69.96,8],[67,8.96],[68.04,8.96],[69,8.96],[69.96,8.96],[69,9.92]])
    add(x,y,y>8?'mystery':'wood','REWARD / high-key gallery harvest');
  // Each separated fuse owns a small side stack; its top stays clear for the
  // deliberate stomp. The broad left retreat remains outside both blasts.
  data.components=C.filter(c=>!(c.t==='crate'&&c.p[0]===109.4));
  for(const x of [107.96,112.76])for(const y of [.6,1.56])
    data.components.push({t:'crate',p:[x,y,0],kind:y>.6?'mystery':'wood',grp:2,nm:'FERN / TOOL / fuse-cleared stock'});
  data.components.push({t:'crate',p:[114,1.56,0],kind:'mystery',grp:2,nm:'FERN / REWARD / last safe bank'});
  for(const [x,y]of [[149.96,1.2],[150.92,1.2],[149,2.16],[149.96,2.16],[150.92,2.16],[149,3.12],[149.96,3.12],[150.92,3.12]])
    data.components.push({t:'crate',p:[x,y,0],kind:y>1.2?'mystery':'wood',grp:2,nm:'FERN / COUNT / final sanctuary wall'});
}
