export function treehouseSurfaceCases(source,point){
  const half=source.components.find(c=>c.nm==='Camera-aligned timber halfpipe');
  const long=source.components.find(c=>c.nm==='Long sunlit cavern timber halfpipe');
  const angle=half.yaw*Math.PI/180;
  const pipePoint=(x,y,z)=>[half.p[0]+Math.cos(angle)*x+Math.sin(angle)*z,half.p[1]+y,half.p[2]-Math.sin(angle)*x+Math.cos(angle)*z];
  const cases=[];
  for(const dx of [-3,0,3])for(const board of [false,true])cases.push({name:`river ${dx} ${board?'board':'walk'}`,start:point([35+dx,-13.9,-226]),target:point([35+dx,-14,-242]),board,floor:-15.2});
  for(const z of [-2,0,2])for(const board of [false,true]){
    const side=z<0?-1:1;
    const entry=2,entryY=half.rise-Math.sqrt(half.rise**2-(entry-half.w)**2)+.04;
    cases.push({name:`opening halfpipe ${side}/${z} ${board?'board':'walk'}`,start:pipePoint(-side*entry,entryY,z),target:pipePoint(side*(half.w+half.rise+half.deck/2),half.rise,z),board,floor:half.p[1]-.15,pipe:true,crest:half.p[1]+half.rise,approachHeight:half.p[1]+half.rise*.8});
  }
  for(const direction of [-1,1])for(const board of [false,true])cases.push({name:`cavern pipe ${direction} ${board?'board':'walk'}`,start:[long.p[0],long.p[1]+.05,long.p[2]-direction*(long.len/2+2)],target:[long.p[0],long.p[1],long.p[2]+direction*(long.len/2+2)],board,floor:long.p[1]-.25,maxFrames:900});
  return cases;
}
