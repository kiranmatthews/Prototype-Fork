import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={harvests:[],patrolProbes:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,100);assert.equal(l.totalCrates,161);assert.equal(l.bonusCrateTotal,52);
 for(const box of l.crates){const name=r.source.components[box.mesh.userData.editorIdx].nm;if(!groups.has(name))groups.set(name,[]);groups.get(name).push(box);}
 for(const [name,boxes]of groups){
  const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(c=>c.box.min.y));
  const candidates=[];
  for(const [dx,dz]of [[0,2.7],[0,-2.7],[2.7,0],[-2.7,0]]){
   ray.set(new THREE.Vector3(x+dx,y+4,z+dz),down);ray.far=8;const hit=l.raycastGround(ray)[0];
   if(hit&&Math.abs(hit.point.y-y)<1.6){const q=hit.point.clone().add(new THREE.Vector3(0,.08,0));candidates.push({q,clearance:Math.min(...l.enemies.map(e=>e.group.position.distanceTo(q)))});}
  }
  candidates.sort((a,b)=>b.clearance-a.clearance);assert.ok(candidates.length,'dry harvest approach');
  p.respawn(l,true,false,{position:candidates[0].q,heading:boxes[0].mesh.position.clone().sub(candidates[0].q).setY(0)});r.stepFor(20,{spinHeld:true});assert.ok(p.grounded);
  r.until(()=>boxes.every(c=>!c.alive),()=>{const box=boxes.filter(c=>c.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0];
   return {...r.steerToward(box.mesh.position,{pace:.3}),spinHeld:r.frame%24<12};
  },{maxFrames:600,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,deaths:p.totalDeaths});
 }
 assert.equal(report.harvests.reduce((n,g)=>n+g.count,0),100);
 l.reset(true);
 for(let f=0;f<600;f++){l.update(1/60);if(f%20)continue;for(const enemy of l.enemies){
  ray.set(enemy.group.position.clone().add(new THREE.Vector3(0,1,0)),down);ray.far=2;const hit=l.raycastGround(ray)[0];
  assert.ok(hit&&Math.abs(hit.point.y-enemy.group.position.y)<.2,'guardian follows supported terrain');report.patrolProbes++;
 }}
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:24000,allowCheckpointTrips:true});
await writeFile(process.env.TRIBAL_GRAMMAR_OUTPUT||'/tmp/tribal-crate-grammar.json',JSON.stringify(report,null,2)+'\n');console.log('PASS Tribal crate grammar',JSON.stringify(report));
