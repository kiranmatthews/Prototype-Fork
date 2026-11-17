import type { CustomComponent, CustomLevelData } from '../level';

/** Cargo belongs to safe floors and activated return galleries. Preserve the
 * launch donors, fuse height test and every timing/attack dependency. */
export function arrangeRooftopDeliveriesCrates(data:CustomLevelData):void {
  const C=data.components;
  const add=(x:number,y:number,kind:NonNullable<CustomComponent['kind']>,nm:string,grp=2,outline=false)=>
    C.push({t:'crate',p:[x,y,0],kind,nm,grp,...(outline?{outline:true}:{})});
  add(-2.96,0,'wood','ROOFTOP / PREPARE / opening mask stock');
  add(-2.96,.96,'mystery','ROOFTOP / PREPARE / opening mask stock');
  for(let i=0;i<4;i++)add(3+(i%2)*.96,Math.floor(i/2)*.96,i<2?'wood':'mystery','ROOFTOP / TEACH / opening cargo');
  add(51,2.56,'wood','ROOFTOP / REWARD / finite retreat stock');
  // Native contacts use the full character silhouette for head bonks and
  // standing spins. The spent-support payload reaches 11.543 m; TNT reaches this.
  const fuseCap=C.find(c=>c.nm==='Upper-first reward: preserve the high TNT support until claimed');
  if(fuseCap)fuseCap.p=[47,11.8,0];
  // These former floating singles now rest on the same switch-owned floors.
  const upper='Activated upper row: preserve launch and return';
  const last='Last return row: appears only after the far !';
  for(let i=C.length-1;i>=0;i--)if(C[i].nm===upper||C[i].nm===last)C.splice(i,1);
  for(let i=0;i<7;i++)add(164.6+(i<4?i:i-3)*.96,12.4+(i<4?0:.96),'wood',upper,11,true);
  for(const x of [201.6,207])for(let i=0;i<4;i++)add(x+(i%2)*.96,12.4+Math.floor(i/2)*.96,'mystery',last,12,true);
  add(239.4,4.96,'wood','ROOFTOP / TOOL / fuse-cleared finite stock');
  for(const x of [271,275])for(const [dx,dy]of [[.96,0],[0,.96],[.96,.96]])
    add(x+dx,5.2+dy,dy?'mystery':'wood','ROOFTOP / COUNT / final permanent-floor cargo');
}
