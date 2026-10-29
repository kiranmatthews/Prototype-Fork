import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-flow-audit/access';
await mkdir(out,{recursive:true});
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,results=[];
 for(const line of m.MAYFIELD_EXPLORATION_LINES.filter(l=>!only||l.name.toLowerCase().includes(only.toLowerCase())))for(const reverse of [false,true]){
  const points=reverse?[...line.points].reverse():line.points,start=points[0],next=points[1];
  p.respawn(l,true,false,{position:new THREE.Vector3(...start).add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(next[0]-start[0],0,next[2]-start[2]).normalize()});r.stepFor(8);
  const e={name:line.name,reverse,reached:0,start:p.pos.toArray(),maxStep:0,airFrames:0,deathsBefore:p.totalDeaths,error:null,waypoints:[]};
  try{
   assert.ok(p.grounded&&Math.abs(p.pos.y-start[1])<.35,'Supported start');
   for(let i=1;i<points.length;i++){
    const q=points[i];let reached=false;
    for(let j=0;j<1800;j++){
     const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz);
     if(d<.45&&Math.abs(p.pos.y-q[1])<.4&&p.grounded){reached=true;break;}
     const f=p.courseInputDirection(l)??p.camDir,pace=Math.min(1,d/.7),before=p.pos.clone();
     r.tick({moveX:(dx*-f.z+dz*f.x)/(d||1)*pace,moveY:(dx*f.x+dz*f.z)/(d||1)*pace,spinHeld:l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.8)||l.crates.some(c=>c.alive&&c.mesh.position.distanceTo(p.pos)<2.5)});
     e.maxStep=Math.max(e.maxStep,p.pos.distanceTo(before));if(!p.grounded)e.airFrames++;
     assert.equal(p.totalDeaths,e.deathsBefore,'No fall recovery during access');assert.ok(!p.isBailing,'No bail');
    }
    assert.ok(reached,`Waypoint ${i}: wanted ${q}; at ${p.pos.toArray()} on ${p.groundHit?.name}`);
    e.reached++;e.waypoints.push({i,position:p.pos.toArray(),ground:p.groundHit?.name});
   }
  }catch(error){e.error=String(error);e.tail=r.trace.slice(-8);const c=l.meshSideCollisions.contact;e.contact={name:c.surface?.mesh.name,normal:c.normal.toArray(),point:c.point.toArray(),top:c.top};e.walls=l.walls.filter(w=>p.playerBox.intersectsBox(w)).slice(0,5).map(w=>({min:w.min.toArray(),max:w.max.toArray(),path:l.wallPathForBox(w)}));}
  e.end=p.pos.toArray();results.push(e);console.log(JSON.stringify({...e,tail:undefined}));
 }
 await writeFile(out+'/access.json',JSON.stringify(results,null,2));
 assert.ok(results.length>0&&results.every(e=>!e.error&&e.maxStep<1),'Every access line must be walkable in both directions');
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:140000});
