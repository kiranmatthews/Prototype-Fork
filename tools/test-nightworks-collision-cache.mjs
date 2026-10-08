import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import {Octree} from 'three/examples/jsm/math/Octree.js';
import {Capsule} from 'three/examples/jsm/math/Capsule.js';

const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try {
 const {NightworksRocks,nightworksGeometry}=await server.ssrLoadModule('/src/nightworksRocks.ts');
 const rocks=new NightworksRocks();
 const make=(size=[5,4,5],yaw=0)=>new THREE.Mesh(nightworksGeometry('nightsteppingrock',size,yaw));
 const add=mesh=>{rocks.addSolid(mesh,new THREE.Vector3());return rocks.solids.at(-1);};
 const first=add(make()),second=add(make());
 assert.equal(first.octree,second.octree,'identical local triangles must reuse one tree');
 assert.notEqual(first.bounds,second.bounds,'each mover retains its own bounds');
 first.mesh.position.set(10,3,-8);second.mesh.position.set(-12,5,16);second.delta.set(.2,-.1,.3);
 const changedSize=add(make([5,4.01,5])),changedYaw=add(make([5,4,5],15));
 assert.notEqual(first.octree,changedSize.octree);assert.notEqual(first.octree,changedYaw.octree);
 // Snapshot ownership includes unversioned edits and replacement buffers.
 const edited=make();const originalFirst=edited.geometry.attributes.position.getX(0);
 edited.geometry.attributes.position.setX(0,originalFirst+.1);
 const changedVertex=add(edited);assert.notEqual(first.octree,changedVertex.octree);
 edited.geometry.attributes.position.setX(0,originalFirst);
 assert.equal(add(edited).octree,first.octree,'later edits cannot overwrite cached triangle identity');
 const changedIndex=make();
 [changedIndex.geometry.index.array[0],changedIndex.geometry.index.array[1]]=[changedIndex.geometry.index.array[1],changedIndex.geometry.index.array[0]];
 assert.notEqual(add(changedIndex).octree,first.octree,'winding and triangle order are collision inputs');

 let contacts=0,misses=0;
 const fixtures=[first,second,changedSize,changedYaw];
 for(const solid of fixtures){
  const proxy=new THREE.Mesh(solid.mesh.geometry),reference=new Octree().fromGraphNode(proxy);
  // Capsule resolution is order-sensitive. Compare the complete result,
  // with no epsilon, against independently constructed Three.js trees.
  for(let y=-4.5;y<=.5;y+=.5)for(let angle=0;angle<32;angle++)for(const radius of [.25,.55]){
   const theta=angle/32*Math.PI*2;
   const c=new Capsule(new THREE.Vector3(Math.cos(theta)*2.4,y,Math.sin(theta)*2.4),new THREE.Vector3(Math.cos(theta)*2.4,y+1,Math.sin(theta)*2.4),radius);
   const expected=reference.capsuleIntersect(c),actual=solid.octree.capsuleIntersect(c);
   assert.deepEqual(actual,expected);if(actual)contacts++;else misses++;
  }
  proxy.material.dispose();
 }
 // The broad-phase scratch boxes must preserve both current and previous
 // mover extents, phase disabling and successive queries without aliasing.
 const normal=new THREE.Vector3(),half={x:.3,y:.6,z:.3};
 // Build a scalar oracle using fresh temporaries; narrow-phase remains the
 // independently verified upstream Octree operation above.
 const reference=(previous,position)=>{
  const n=new THREE.Vector3(),r=Math.max(half.x,half.z)*.94,sweep=new THREE.Box3().expandByPoint(previous).expandByPoint(position).expandByScalar(r+1);let collided=false;
  for(const solid of rocks.solids){
   if(!solid.active())continue;
   const origin=solid.mesh.position.clone();if(position.y>=solid.bounds.max.y+origin.y-.18)continue;
   const bounds=solid.bounds.clone().translate(origin).union(solid.bounds.clone().translate(origin.clone().sub(solid.delta)));
   if(!sweep.intersectsBox(bounds))continue;
   const sample=previous.clone().sub(origin).add(solid.delta),step=position.clone().sub(origin).sub(sample);
   const count=Math.min(96,Math.max(1,Math.ceil(step.length()/.22)));step.divideScalar(count);let hitSolid=false;
   for(let i=0;i<count;i++){
    sample.add(step);const capsule=new Capsule(new THREE.Vector3(sample.x,sample.y+r,sample.z),new THREE.Vector3(sample.x,sample.y+Math.max(r,half.y*2-r),sample.z),r);
    const hit=solid.octree.capsuleIntersect(capsule);if(!hit||hit.depth<1e-6)continue;
    sample.add(hit.normal.clone().multiplyScalar(hit.depth+.002));const into=step.dot(hit.normal);if(into<0)step.addScaledVector(hit.normal,-into);
    n.add(hit.normal);collided=true;hitSolid=true;
   }
   if(hitSolid)position.copy(sample).add(origin);
  }
  if(collided)n.normalize();return {collided,normal:n,position};
 };
 let sweeps=0;
 for(const enabled of [true,false]){
  second.active=()=>enabled;
  for(const solid of [first,second])for(let angle=0;angle<24;angle++){
   const theta=angle/24*Math.PI*2;
   const previous=solid.mesh.position.clone().add(new THREE.Vector3(Math.cos(theta)*5,-2,Math.sin(theta)*5));
   const target=solid.mesh.position.clone().add(new THREE.Vector3(Math.cos(theta),-2,Math.sin(theta)));
   const expected=reference(previous,target.clone()),position=target.clone();
   const collided=rocks.resolve(previous,position,half,normal);
   assert.deepEqual({collided,normal,position},expected);sweeps++;
  }
 }
 assert.ok(contacts>0&&misses>0);assert.ok(rocks.diagnostics.collisionTrees<rocks.solids.length);
 const oldTree=first.octree;rocks.dispose();assert.equal(rocks.diagnostics.collisionTrees,0);
 const fresh=new NightworksRocks();fresh.addSolid(make(),new THREE.Vector3());assert.notEqual(fresh.solids[0].octree,oldTree,'retired levels release their caches');fresh.dispose();
 for(const solid of new Set(fixtures)) {solid.mesh.geometry.dispose();solid.mesh.material.dispose();}
 console.log(`PASS exact Nightworks collision reuse: ${contacts} contacts, ${misses} misses, ${sweeps} moving/phase sweeps, geometry edits and per-level disposal.`);
}finally{await server.close();}
