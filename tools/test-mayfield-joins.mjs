import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-flow-audit/joins';await mkdir(out,{recursive:true});
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,results=[],ray=new THREE.Raycaster();
 // Keep the physical exit pad, but suppress its end-of-run event for these
 // bidirectional seam fixtures. The full-route/browser tests exercise finishing.
 for(const mesh of l.groundMeshes)if(mesh.userData.finishPad)mesh.userData.finishPad=false;
 l.finishGlow.makeEmpty();
 const support=q=>{ray.set(new THREE.Vector3(q[0],q[1]+1.8,q[2]),new THREE.Vector3(0,-1,0));ray.far=4;return ray.intersectObjects(l.groundMeshes,false).find(h=>Math.abs(h.point.y-q[1])<1.5&&h.face.normal.y>.45);};
 for(const join of m.MAYFIELD_JOINS.filter(j=>!only||j.name.toLowerCase().includes(only.toLowerCase()))){
  const [a,b]=join.points,dx=b[0]-a[0],dz=b[2]-a[2],d=Math.hypot(dx,dz),nx=-dz/d,nz=dx/d;
  for(const side of[-.4,-.2,0,.2,.4])for(const reverse of[false,true]){
   const at=t=>[a[0]+dx*t+nx*join.width*side,a[1]+(b[1]-a[1])*t,a[2]+dz*t+nz*join.width*side];
   const start=at(reverse?1+1.5/d:-1.5/d),end=at(reverse?-1.5/d:1+1.5/d),e={name:join.name,side,reverse,error:null,unsupported:[],maxStep:0};
   for(let i=0;i<=Math.ceil(d*2);i++){const q=at(i/Math.ceil(d*2));if(!support(q))e.unsupported.push(q);}
   try{
    assert.equal(e.unsupported.length,0,'Continuous full-width support');const h=support(start);assert.ok(h,'Supported approach');
    start[1]=h.point.y;p.respawn(l,true,false,{position:new THREE.Vector3(...start).add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(end[0]-start[0],0,end[2]-start[2]).normalize()});r.stepFor(8);const deaths=p.totalDeaths;
    let reached=false;
    for(let i=0;i<1500;i++){
     const x=end[0]-p.pos.x,z=end[2]-p.pos.z,n=Math.hypot(x,z);if(n<.5&&p.grounded){reached=true;break;}
     const f=p.courseInputDirection(l)??p.camDir,before=p.pos.clone();r.tick({moveX:(x*-f.z+z*f.x)/(n||1),moveY:(x*f.x+z*f.z)/(n||1),spinHeld:l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.8)||l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<2.5)});e.maxStep=Math.max(e.maxStep,before.distanceTo(p.pos));assert.equal(p.totalDeaths,deaths);assert.ok(!p.isBailing);assert.ok(p.pos.y>Math.min(a[1],b[1])-2,'No fall below join');
    }
    assert.ok(reached,'Clear approach and departure');
   }catch(error){e.error=String(error);e.position=p.pos.toArray();e.ground=p.groundHit?.name;}
   results.push(e);console.log(JSON.stringify(e));
  }
 }
 await writeFile(out+'/joins.json',JSON.stringify(results,null,2));assert.ok(results.length&&results.every(e=>!e.error),'All sampled join lanes must work both ways');
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:150000});
