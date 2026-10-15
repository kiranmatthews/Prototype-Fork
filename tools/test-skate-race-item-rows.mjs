import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const rows=new Map();const data=r.source.components.filter(c=>c.t==='crate'&&c.kind==='mystery');
 for(const c of data){const key=c.nm?.split(' / ')[0];assert.match(key,/^Item row /);rows.set(key,[...(rows.get(key)??[]),c]);}
 assert.ok(rows.size>=20);assert.ok([...rows.values()].every(row=>row.length===4));
 const ray=new r.THREE.Raycaster(),bad=[];
 for(const box of r.l.crates.filter(c=>c.mystery)){
  const size=box.box.getSize(new r.THREE.Vector3());for(const v of size.toArray())assert.ok(Math.abs(v-1.92)<1e-7);
  for(const dx of [-.8,.8])for(const dz of [-.8,.8]){
   ray.set(new r.THREE.Vector3(box.mesh.position.x+dx,box.box.min.y+3,box.mesh.position.z+dz),new r.THREE.Vector3(0,-1,0));ray.far=6;
   const hit=ray.intersectObjects(r.l.groundMeshes,false).find(h=>!h.object.userData.lethal&&!h.object.userData.outOfBounds);
   if(!hit)bad.push({p:box.mesh.position.toArray(),dx,dz});
  }
 }
 assert.deepEqual(bad,[],'Every item row needs a real road under all four enlarged boxes');
 assert.equal(r.l.totalCrates,r.l.crates.filter(c=>!c.mystery&&!c.metal&&!c.bang&&!c.nitroBang&&!c.metalBounce).length);
 const first=r.l.crates.find(c=>c.mystery),home=first.mesh.position.clone();r.l.breakCrate(first);r.l.reviveRaceCrate(first,home);r.l.update(r.dt);
 assert.ok(Math.abs(first.box.max.y-first.box.min.y-1.92)<1e-7);assert.ok(first.mesh.position.distanceTo(home)<1e-7);
 console.log(JSON.stringify({rows:rows.size,itemBoxes:data.length,size:1.92,gemBoxes:r.l.totalCrates,allSupported:true,resetSizePreserved:true}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
