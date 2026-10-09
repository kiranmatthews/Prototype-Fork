export function treehouseSurfaceCases(source,point){
  const quarter=source.components.find(c=>c.nm==='Reference opening · single curved timber quarterpipe');
  const long=source.components.find(c=>c.nm==='Long sunlit cavern timber halfpipe');
  const angle=quarter.yaw*Math.PI/180;
  const qp=(x,y,z)=>[quarter.p[0]+Math.cos(angle)*x+Math.sin(angle)*z,quarter.p[1]+y,quarter.p[2]-Math.sin(angle)*x+Math.cos(angle)*z];
  const cases=[];
  for(const dx of [-3,0,3])for(const board of [false,true])cases.push({name:`river ${dx} ${board?'board':'walk'}`,start:point([35+dx,-13.9,-226]),target:point([35+dx,-14,-242]),board,floor:-15.2});
  for(const z of [-2,0,2])for(const board of [false,true])cases.push({name:`quarterpipe ${z} ${board?'board':'walk'}`,start:qp(-2,.08,z),target:qp(quarter.w+quarter.rise+quarter.deck/2,quarter.rise,z),board,floor:quarter.p[1]-.15,pipe:true,crest:quarter.p[1]+quarter.rise,approachHeight:quarter.p[1]+quarter.rise*.8});
  for(const direction of [-1,1])for(const board of [false,true])cases.push({name:`cavern pipe ${direction} ${board?'board':'walk'}`,start:[long.p[0],long.p[1]+.05,long.p[2]-direction*(long.len/2+2)],target:[long.p[0],long.p[1],long.p[2]+direction*(long.len/2+2)],board,floor:long.p[1]-.25,maxFrames:900});
  return cases;
}
