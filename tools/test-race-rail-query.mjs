import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {Rail,nearestRail}=await server.ssrLoadModule('/src/rails.ts');
 const rails=Array.from({length:40},(_,j)=>new Rail(Array.from({length:8},(_,i)=>new THREE.Vector3(Math.sin(i+j)*14+j,i*i*.2-j,Math.cos(i*2+j)*18-i*4)),false));
 rails.push(new Rail([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0)],false));rails.push(rails[0]);rails[8].grindable=false;
 const reference=(p,candidates=rails)=>{let best=null;for(const rail of candidates){if(!rail.grindable)continue;const sample=rail.closest(p);if(!best||sample.distance<best.sample.distance)best={rail,sample};}return best;};
 for(let phase=0;phase<3;phase++){
  if(phase===1)for(const rail of rails.slice(0,40))for(const p of rail.points)p.add(new THREE.Vector3(4,20,-7));
  if(phase===2)for(const rail of rails.slice(0,40)){rail.points[3].y+=7;rail.rebake();}
  for(let i=0;i<1500;i++){
   const p=new THREE.Vector3(Math.sin(i*13.57)*100,Math.cos(i*.17)*55,Math.sin(i*.127)*90);
   const expected=reference(p),actual=nearestRail(rails,p);assert.equal(actual.rail,expected.rail);assert.deepEqual(actual.sample,expected.sample);
  }
 }
 let extra=0,bakedEndpointCases=0;
 const compare=(candidates,p)=>{
  const expected=reference(p,candidates),actual=nearestRail(candidates,p);
  assert.equal(actual?.rail,expected?.rail);assert.deepEqual(actual?.sample,expected?.sample);
  for(const rail of candidates){const bound=rail.distanceLowerBound(p),distance=rail.closestDistance(p);assert.ok(!(bound>distance),'bounds must contain the actual baked path');}
  extra++;
 };
 // Warm both boxes, then translate into and out of the winning position.
 const moving=[new Rail([new THREE.Vector3(0,0,-2),new THREE.Vector3(0,0,2)],false),new Rail([new THREE.Vector3(100,0,-2),new THREE.Vector3(100,0,2)],false)];
 for(const offset of [0,-99,210,-111]){moving[1].translate(new THREE.Vector3(offset,0,0));for(const x of [-1,0,1,100,210])compare(moving,new THREE.Vector3(x,.2,0));}
 moving[0].grindable=false;compare(moving,new THREE.Vector3());moving[0].grindable=true;compare(moving,new THREE.Vector3());
 const tie=new Rail(moving[0].points.map(p=>p.clone()),false);
 assert.equal(nearestRail([tie,moving[0]],new THREE.Vector3(1,0,0)).rail,tie);
 compare([tie,moving[0],tie],new THREE.Vector3(1,0,0));
 // A restore may keep a previous bake. It must invalidate bounds even when
 // its first node never moves, without silently changing that baked path.
 const restored=new Rail([new THREE.Vector3(),new THREE.Vector3(10,50,10),new THREE.Vector3(20,0,20)],false),query=new THREE.Vector3(10,80,10);
 compare([...moving,restored],query);restored.points[1].y=80;restored.invalidateQueryBounds();compare([...moving,restored],query);
 restored.points[1].y=-80;restored.rebake();compare([...moving,restored],new THREE.Vector3(10,-80,10));
 // Tiny owned translations can round away at the first node while changing
 // another node. Explicit invalidation must still refresh the cached box.
 const tinyMove=new Rail([new THREE.Vector3(1e5,0,0),new THREE.Vector3(0,0,0),new THREE.Vector3(1e5,0,0)],false);
 compare([moving[0],tinyMove],new THREE.Vector3(-1e-12,0,0));tinyMove.translate(new THREE.Vector3(-1e-12,0,0));assert.equal(tinyMove.points[0].x,1e5);compare([moving[0],tinyMove],new THREE.Vector3(-1e-12,0,0));
 for(const scale of [1e-12,1,1e5,1e12])for(let i=1;i<=80;i++){
  const a=new THREE.Vector3(Math.sin(i*1.3)*scale,Math.cos(i*.7)*scale,Math.sin(i*.3)*scale),b=a.clone().add(new THREE.Vector3(Math.sin(i)*scale,Math.cos(i*2)*scale,Math.sin(i*3)*scale));
  const rail=new Rail([a,b],false),point=rail.pointAt(rail.totalLength),authored=new THREE.Box3().setFromPoints(rail.points);
  if(!authored.containsPoint(point))bakedEndpointCases++;
  assert.equal(rail.distanceLowerBound(point),0,'baked endpoint must remain inside its query bounds');
  compare([moving[0],rail],point);rail.rebake();compare([moving[0],rail],rail.pointAt(rail.totalLength));
 }
 assert.ok(bakedEndpointCases>0,'exercise normalization beyond authored endpoint bounds');
 const uncertain=new Rail([new THREE.Vector3(1,0,-2),new THREE.Vector3(1,0,2)],false);uncertain.distanceLowerBound=()=>NaN;compare([moving[0],uncertain],new THREE.Vector3(1,0,0));
 assert.equal(nearestRail([],new THREE.Vector3()),null);
 console.log(`PASS ${4500+extra} exact nearest-rail samples; direct/owned motion, unchanged-origin restores, rebakes, ties, disabled/degenerate rails and ${bakedEndpointCases} baked endpoints beyond authored bounds`);
}finally{await server.close();}
