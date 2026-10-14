import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {Rail,nearestRail}=await server.ssrLoadModule('/src/rails.ts');
 const rails=Array.from({length:40},(_,j)=>new Rail(Array.from({length:8},(_,i)=>new THREE.Vector3(Math.sin(i+j)*14+j,i*i*.2-j,Math.cos(i*2+j)*18-i*4)),false));
 rails.push(new Rail([new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,0)],false));rails.push(rails[0]);rails[8].grindable=false;
 const reference=p=>{let best=null;for(const rail of rails){if(!rail.grindable)continue;const sample=rail.closest(p);if(!best||sample.distance<best.sample.distance)best={rail,sample};}return best;};
 for(let phase=0;phase<3;phase++){
  if(phase===1)for(const rail of rails.slice(0,40))for(const p of rail.points)p.add(new THREE.Vector3(4,20,-7));
  if(phase===2)for(const rail of rails.slice(0,40)){rail.points[3].y+=7;rail.rebake();}
  for(let i=0;i<1500;i++){
   const p=new THREE.Vector3(Math.sin(i*13.57)*100,Math.cos(i*.17)*55,Math.sin(i*.127)*90);
   const expected=reference(p),actual=nearestRail(rails,p);assert.equal(actual.rail,expected.rail);assert.deepEqual(actual.sample,expected.sample);
  }
 }
 assert.equal(nearestRail([],new THREE.Vector3()),null);
 console.log('PASS 4,500 exact nearest-rail samples, rigid motion, rebaked deformation, ties, disabled rails and degenerate segments');
}finally{await server.close();}
