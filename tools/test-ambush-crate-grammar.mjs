import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runAmbushOpening} from './ambush-pilot.mjs';
const report={harvests:[],patrolProbes:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,170);assert.equal(l.totalCrates,205);assert.equal(l.bonusCrateTotal,25);
 for(const box of l.crates){const spec=r.source.components[box.mesh.userData.editorIdx];if(box.metalBounce||box.bang||box.nitroBang||spec.nm.startsWith('Warehouse deferred'))continue;
  const name=spec.nm.includes(' / revealed cargo')?spec.nm.split(' / revealed cargo')[0]+' / revealed cargo':spec.nm.split(' ·')[0];
  if(!groups.has(name))groups.set(name,[]);groups.get(name).push(box);
 }
 for(const [name,boxes]of groups){
  const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(c=>c.box.min.y));
  const candidates=[];
  for(const [dx,dz]of [[0,2.5],[0,-2.5],[2.5,0],[-2.5,0]]){
   ray.set(new THREE.Vector3(x+dx,y+3,z+dz),down);ray.far=7;const hit=l.raycastGround(ray)[0];
   if(hit&&Math.abs(hit.point.y-y)<1.1){const q=hit.point.clone().add(new THREE.Vector3(0,.08,0));candidates.push({q,clearance:Math.min(...l.enemies.map(e=>e.group.position.distanceTo(q)))});}
  }
  candidates.sort((a,b)=>b.clearance-a.clearance);assert.ok(candidates.length,'dry harvest approach: '+name);
  p.respawn(l,true,false,{position:candidates[0].q,heading:boxes[0].mesh.position.clone().sub(candidates[0].q).setY(0)});r.stepFor(20);
  if(boxes[0].pending){
   const button=l.crates.find(b=>b.bang&&boxes[0].groupIds.some(id=>b.groupIds.includes(id)));
   r.until(()=>button.bangUsed,()=>({...r.steerToward(button.mesh.position,{pace:.3}),spinHeld:r.frame%24<12}),{maxFrames:400,label:'activate '+name});
  }
  r.until(()=>boxes.every(c=>!c.alive),()=>{const box=boxes.filter(c=>c.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0];
   return {...r.steerToward(box.mesh.position,{pace:.3}),spinHeld:r.frame%24<12};
  },{maxFrames:800,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,deaths:p.totalDeaths});
 }
 assert.equal(report.harvests.reduce((n,g)=>n+g.count,0),163);
 const button=l.crates.find(c=>c.nitroBang);p.respawn(l,true,false,{position:button.mesh.position.clone().add(new THREE.Vector3(-2,0,2))});r.stepFor(20);
 r.until(()=>button.bangUsed,()=>({...r.steerToward(button.mesh.position,{pace:.3}),spinHeld:r.frame%24<12}),{maxFrames:400,label:'remote Nitro credit'});r.stepFor(90);
 assert.ok(l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx].nm.startsWith('Warehouse deferred')).every(b=>!b.alive));assert.equal(p.totalDeaths,0);report.deferredCargo=3;
 l.reset(true);assert.ok(l.crates.every(b=>b.alive));assert.equal(l.crates.filter(b=>b.pending).length,12);
 assert.ok(l.crates.filter(b=>b.bang||b.nitroBang).every(b=>!b.bangUsed));report.retryRestores=true;
 report.enemyKinds=[...new Set(l.enemies.map(e=>e.kind))];assert.equal(l.enemies.length,20);
 for(let f=0;f<600;f++){l.update(1/60);if(f%20)continue;for(const enemy of l.enemies){
  ray.set(new THREE.Vector3(enemy.group.position.x,enemy.baseY+2,enemy.group.position.z),down);ray.far=4;const hit=l.raycastGround(ray)[0];
  assert.ok(hit&&Math.abs(hit.point.y-enemy.baseY)<.65,'supported '+enemy.kind+' at '+enemy.group.position.toArray());report.patrolProbes++;
 }}
 p.respawn(l,true);report.opening=runInputPilot(r,runAmbushOpening);assert.equal(p.totalDeaths,0);assert.equal(p.cratesBroken,3);
},{modulePath:'/src/levels/carlisle-coast.ts',source:m=>m.CARLISLE_COAST_LEVEL,levelId:'test',controlFrame:()=>({x:0,z:-1}),maxFrames:60000,allowCheckpointTrips:true});
await writeFile(process.env.AMBUSH_GRAMMAR_OUTPUT||'/tmp/ambush-crate-grammar.json',JSON.stringify(report,null,2)+'\n');console.log('PASS Ambush cargo',JSON.stringify(report));
