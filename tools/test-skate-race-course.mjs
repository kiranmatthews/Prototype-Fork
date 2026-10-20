import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';

// Exhaustive ordered reference: deliberately visit every segment rather than
// sharing the production range search. Ties belong to the first eligible leg.
function reference(knots,p,previous,window=70){
 let best=Infinity,s=previous??0,offset=0,arc=0;
 for(let i=0;i<knots.length-1;i++){
  const a=knots[i],b=knots[i+1],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],end=arc+Math.hypot(x,y,z),start=arc;arc=end;
  if(previous!==undefined&&(end<previous-window||start>previous+window))continue;
  const span=end-start||1,low=previous===undefined?0:Math.max(0,(previous-window-start)/span),high=previous===undefined?1:Math.min(1,(previous+window-start)/span);
  const t=Math.max(low,Math.min(high,((p.x-a[0])*x+(p.y-a[1])*y+(p.z-a[2])*z)/(x*x+y*y+z*z||1)));
  const dx=p.x-a[0]-x*t,dy=p.y-a[1]-y*t,dz=p.z-a[2]-z*t,d=dx*dx+dy*dy+dz*dz;
  if(d<best){best=d;s=start+(end-start)*t;offset=(dx*-z+dz*x)/(Math.hypot(x,z)||1);}
 }
 return {s,distance:Math.sqrt(best),offset};
}
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {RaceCourse}=await server.ssrLoadModule('/src/race/course.ts');let checked=0;
 const check=(course,p,previous,window)=>{assert.deepEqual(course.project(p,previous,window),reference(course.knots,p,previous,window),`query ${checked}: previous=${previous}, window=${window}`);checked++;};
 const fixtures=[
  [[0,0,0,10],[0,0,-20,10]],
  [[0,0,0,10],[0,0,0,10],[0,0,-20,10],[0,0,-20,10],[10,0,-20,10],[10,0,-20,10]],
  Array.from({length:8},()=>[4,5,6,10]),
  [[0,0,0,10],[0,10,0,10],[0,10,-10,10],[0,20,-10,10]],
  [[-10,0,-10,10],[10,0,10,10],[-10,0,10,10],[10,0,-10,10]],
  [[0,0,0,10],[0,0,-20,10],[10,5,-20,10],[0,10,-20,10],[0,10,0,10]],
  [[-100000,99999,-99999,10],[-99999,100000,-99997,10],[-99999,100000,-99997,10],[-99998,99998,-99995,10]],
 ];
 for(const knots of fixtures){
  const course=new RaceCourse(knots),positions=[...knots.map(k=>new THREE.Vector3(...k.slice(0,3))),new THREE.Vector3(0,3,-10),new THREE.Vector3(12,-6,17)];
  const previous=[undefined,-100,0,...course.arc.flatMap(s=>[s-1e-10,s,s+1e-10]),course.length+100];
  for(const p of positions)for(const s of previous)for(const window of [0,1e-10,1,20,70,Infinity,-1,NaN])check(course,p,s,window);
  for(const s of [NaN,Infinity,-Infinity])check(course,positions[0],s,70);
 }
 const crossing=new RaceCourse(fixtures[4]);assert.equal(crossing.project(new THREE.Vector3(0,3,0)).s,crossing.arc[1]/2,'An equal-distance crossing must keep its first leg');
 const empty=new RaceCourse(fixtures[0]).project(new THREE.Vector3(0,0,0),100,5);assert.deepEqual(empty,{s:100,distance:Infinity,offset:0});
 const stacked=new RaceCourse(fixtures[5]),upper=stacked.project(new THREE.Vector3(0,0,-10),stacked.length-10,2);assert.ok(upper.distance>=10,'A bounded projection must not switch to a closer lower leg');
 let state=19410;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
 for(const size of [3,17,128,1050,4096]){
  const knots=[];let x=0,y=0,z=0;
  for(let i=0;i<size;i++){if(i%7){x+=(random()-.5)*20;y+=(random()-.5)*5;z+=(random()-.5)*20;}knots.push([x,y,z,10]);}
  const course=new RaceCourse(knots);
  for(let i=0;i<1000;i++){const s=(random()*1.2-.1)*course.length,p=course.sample(s);p.x+=(random()-.5)*80;p.y+=(random()-.5)*30;p.z+=(random()-.5)*80;check(course,p,i%11===0?undefined:s,[0,20,25,40,55,70,80,180][i%8]);}
 }
 console.log(`PASS ${checked} exact ordered course projections, inclusive window boundaries, repeated knots, vertical/stacked legs, ties, empty windows and 4,096-knot courses`);
}finally{await server.close();}
