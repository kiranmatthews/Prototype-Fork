import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const out=process.env.RIPCORD_OUTPUT||'/tmp/ripcord-crate-review';await mkdir(out,{recursive:true});
const reports=[];
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r;
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const crate of l.crates){
  ray.set(crate.mesh.position.clone().setY(crate.box.min.y+.06),down);ray.far=.15;
  assert.ok(l.raycastGround(ray).length||l.crates.some(other=>other!==crate&&Math.abs(other.box.max.y-crate.box.min.y)<.08&&Math.abs(other.mesh.position.x-crate.mesh.position.x)<.1&&Math.abs(other.mesh.position.z-crate.mesh.position.z)<.1),'cargo has native ground or stack support');
  const s=m.ripcordProgress(crate.mesh.position);
  assert.ok(m.RIPCORD_REFUGES.some(room=>s>room.entry+3&&s<room.exit-3)||s>m.RIPCORD_SANCTUARY_START+10,'every harvest is outside the active chase and clear of its entry/exit');
 }
 const fixtures=[...m.RIPCORD_REFUGES.map(room=>({name:room.name,a:room.entry,b:room.exit,start:room.checkpoint-8})),
  {name:'Sanctuary',a:m.RIPCORD_SANCTUARY_START,b:m.RIPCORD_END,start:m.RIPCORD_END-16}];
 let harvested=0;
 for(const f of fixtures){
  l.reset(true);p.respawn(l,true,false,{position:new THREE.Vector3(...m.ripcordPoint(f.start,m.ripcordHeight(f.start)+.12)),heading:new THREE.Vector3(...m.ripcordTangent(f.start))});r.stepFor(25);
  const boxes=l.crates.filter(c=>{const s=m.ripcordProgress(c.mesh.position);return s>f.a&&s<f.b;});
  assert.ok(p.grounded,'supported collection fixture');
  const pending=new Set(boxes);
  while([...pending].some(c=>c.alive)){
   const box=[...pending].filter(c=>c.alive).sort((a,b)=>a.box.min.y-b.box.min.y||r.distanceTo(a.mesh.position)-r.distanceTo(b.mesh.position))[0];
   r.until(()=>!box.alive,()=>({...r.steerToward(box.mesh.position,{pace:.3}),spinHeld:r.frame%26<13}),{maxFrames:800,label:f.name+' ordinary-input harvest'});
   r.stepFor(26);pending.delete(box);
  }
  assert.ok(boxes.every(c=>!c.alive));assert.equal(p.totalDeaths,0);harvested+=boxes.length;
  reports.push({fixture:f.name,harvested:boxes.length,deaths:p.totalDeaths});
 }
 // A new life starts after the checkpoint, with the unbanked departure stock restored.
 l.reset(true);l.activateCheckpoint(l.checkpoints[0],0);
 const after=l.crates.filter(c=>r.source.components[c.mesh.userData.editorIdx]?.nm?.startsWith('Terrace vault / LAST CHANCE'));
 for(const crate of after)l.breakCrate(crate,true);
 l.reset(false);assert.ok(after.length&&after.every(c=>c.alive));
 await writeFile(out+'/cargo.json',JSON.stringify({supported:l.crates.length,harvested,fixtures:reports,checkpointRestore:true},null,2));
 console.log('PASS Ripcord supported shelter/finish cargo, ordinary-input harvest and checkpoint restoration.',harvested);
},{modulePath:'/src/levels/ripcord-river.ts',levelId:'rumblewater-run',source:m=>m.RIPCORD_RIVER_LEVEL,maxFrames:16000,
 controlFrame:r=>r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1},allowCheckpointTrips:true});
