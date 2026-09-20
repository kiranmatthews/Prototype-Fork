import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {Rail,batchRailVisuals}=await server.ssrLoadModule('/src/rails.ts');
 const rail=new Rail(Array.from({length:100},(_,i)=>new THREE.Vector3(Math.cos(i*.08)*25,4+Math.sin(i*.21)*2,Math.sin(i*.08)*25)));
 rail.object.position.set(7,2,-15);
 const triangles=()=>rail.object.children.reduce((n,mesh)=>n+mesh.geometry.index.count/3,0);
 const vertices=()=>{rail.object.updateMatrixWorld(true);const out=[];
  rail.object.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);out.push(v.clone());}});return out;};
 const before=vertices(),count=triangles(),draws=rail.object.children.length,length=rail.totalLength;
 const point=rail.pointAt(length*.37),tangent=rail.tangentAt(length*.37),bounds=new THREE.Box3().setFromObject(rail.object,true);
 const materials=new Set(rail.object.children.map(mesh=>mesh.material));let disposed=0;
 rail.object.children.forEach(mesh=>mesh.geometry.addEventListener('dispose',()=>disposed++));
 batchRailVisuals(rail.object);
 const after=vertices();assert.equal(after.length,before.length);assert.equal(triangles(),count);
 // Grouping changes order only. Every transformed source vertex must remain.
 for(const vertex of before)assert.ok(after.some(p=>p.distanceToSquared(vertex)<1e-10),'batching changed the rail surface');
 assert.ok(rail.object.children.length<draws*.4,'long polylines still submit one draw per tiny segment');
 assert.ok(disposed>0);assert.ok(rail.object.children.every(mesh=>materials.has(mesh.material)));
 assert.ok(bounds.min.distanceTo(new THREE.Box3().setFromObject(rail.object,true).min)<1e-5);
 assert.ok(bounds.max.distanceTo(new THREE.Box3().setFromObject(rail.object,true).max)<1e-5);
 assert.equal(rail.totalLength,length);assert.ok(rail.pointAt(length*.37).equals(point));assert.ok(rail.tangentAt(length*.37).equals(tangent));
 rail.object.position.x+=20;assert.ok(new THREE.Box3().setFromObject(rail.object,true).min.x>bounds.min.x+19.999);
 const invisible=new Rail([new THREE.Vector3(),new THREE.Vector3(0,1,-3)],false);batchRailVisuals(invisible.object);assert.equal(invisible.object.children.length,0);
 rail.object.traverse(o=>{if(o.isMesh)o.geometry.dispose();});materials.forEach(m=>m.dispose());
 console.log(`PASS exact rail geometry/materials, moving parent, invisible rails and unchanged grind path: ${draws} → ${rail.object.children.length} draws.`);
}finally{await server.close();}
