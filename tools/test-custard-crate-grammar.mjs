import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={harvests:[],patrolProbes:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 assert.equal(l.crates.length,171);assert.equal(l.totalCrates,212);assert.equal(l.bonusCrateTotal,27);
 const floor=(x,y,z)=>{ray.set(new THREE.Vector3(x,y+.2,z),down);ray.far=.5;return l.raycastGround(ray)[0];};
 for(const c of l.crates)assert.ok(floor(c.mesh.position.x,c.box.min.y,c.mesh.position.z)||l.crates.some(b=>b!==c&&Math.abs(b.box.max.y-c.box.min.y)<.05&&Math.abs(b.mesh.position.x-c.mesh.position.x)<.05&&Math.abs(b.mesh.position.z-c.mesh.position.z)<.05),'every crate has native ground or stack support');
 report.supported=l.crates.length;
 // Components of touching crates, including separate groups with the same role.
 const remaining=new Set(l.crates),groups=[];
 while(remaining.size){const group=[remaining.values().next().value];remaining.delete(group[0]);
  for(let i=0;i<group.length;i++)for(const c of remaining){const a=group[i].mesh.position,b=c.mesh.position;if(Math.abs(a.x-b.x)<1.4&&Math.abs(a.y-b.y)<1.4&&Math.abs(a.z-b.z)<1.4){group.push(c);remaining.delete(c);}}
  groups.push(group);
 }
 for(const boxes of groups){
  if(boxes.some(c=>c.nitro||c.nitroBang))continue;
  const center=boxes.reduce((v,c)=>v.add(c.mesh.position),new THREE.Vector3()).divideScalar(boxes.length),y=Math.min(...boxes.map(c=>c.box.min.y));
  const start=[[0,2.6],[0,-2.6],[2.6,0],[-2.6,0]].map(([x,z])=>new THREE.Vector3(center.x+x,y+.08,center.z+z)).find(q=>floor(q.x,y,q.z));
  assert.ok(start,'native approach footing');p.respawn(l,true,false,{position:start,heading:center.clone().sub(start).setY(0)});r.stepFor(20);
  assert.ok(p.grounded);assert.ok(Math.abs(p.pos.y-y)<.4);
  const name=r.source.components[boxes[0].mesh.userData.editorIdx].nm;
  r.until(()=>boxes.every(c=>!c.alive),()=>{
   const box=boxes.filter(c=>c.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0];
   return {...r.steerToward(box.mesh.position,{pace:.3}),spinHeld:r.frame%24<12};
  },{maxFrames:600,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,position:center.toArray(),deaths:p.totalDeaths});
 }
 // The last switch remotely destroys the framed Nitro pair and its cap.
 const green=l.crates.find(c=>c.nitroBang),nitroGroup=groups.find(g=>g.some(c=>c.nitro));
 p.respawn(l,true,false,{position:green.mesh.position.clone().setY(green.box.min.y+.08).add(new THREE.Vector3(2.6,0,0))});r.stepFor(20);
 r.until(()=>green.bangUsed,()=>({...r.steerToward(green.mesh.position,{pace:.3}),spinHeld:r.frame%24<12}),{maxFrames:400,label:'final green switch'});r.stepFor(90);
 assert.equal(nitroGroup.length,3);assert.ok(nitroGroup.every(c=>!c.alive));assert.equal(p.totalDeaths,0);report.remoteNitro={count:3,deaths:0};
 // A checkpoint retry restores the unbanked deferred reward.
 l.reset(true);l.activateCheckpoint(l.checkpoints[10],0);l.triggerBang(green);r.stepFor(90);l.reset(false);
 assert.ok(nitroGroup.every(c=>c.alive));assert.equal(green.bangUsed,false);report.checkpointRestores=true;
 for(let f=0;f<600;f++){l.update(1/60);if(f%20)continue;for(const enemy of l.enemies){
  ray.set(enemy.group.position.clone().setY(enemy.baseY+1),down);ray.far=2;const hit=l.raycastGround(ray)[0];
  assert.ok(hit&&Math.abs(hit.point.y-enemy.baseY)<.45,'patrol has native footing');report.patrolProbes++;
 }}
 report.enemies=l.enemies.map(e=>e.kind);report.kinds=[...new Set(report.enemies)];assert.equal(report.kinds.length,2);
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??r.p.camDir,maxFrames:30000,allowCheckpointTrips:true});
await writeFile(process.env.CUSTARD_GRAMMAR_OUTPUT||'/tmp/custard-crate-grammar.json',JSON.stringify(report,null,2)+'\n');console.log('PASS Sunset crate grammar',JSON.stringify(report));
