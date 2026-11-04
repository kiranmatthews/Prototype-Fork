import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-maze';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const stops=r.sourceModule.SPAGHETTI_PLATFORMER_BOX_ROUTE,legs=r.sourceModule.SPAGHETTI_PLATFORMER_ROUTE_LEGS,islands=r.sourceModule.SPAGHETTI_PLATFORMER_ISLANDS,C=r.source.components;
 const report={stops:stops.length,boxes:[],collections:[],clippedRails:[],junctions:[],tiers:[...new Set(stops.filter(s=>s.tier!==undefined).map(s=>s.p[1]))],direction:{forward:0,backward:0,sideways:0}};
 const ray=new r.THREE.Raycaster();
 for(const c of C.filter(c=>c.t==='crate'||c.t==='checkpoint')){
  ray.set(new r.THREE.Vector3(c.p[0],c.p[1]+.1,c.p[2]),new r.THREE.Vector3(0,-1,0));ray.far=.3;
  const supported=r.l.raycastGround(ray).some(h=>h.face?.normal.y>.5);report.boxes.push({name:c.nm,p:c.p,supported});
 }
 for(const leg of legs){
  const dx=leg.to.p[0]-leg.from.p[0],dz=leg.to.p[2]-leg.from.p[2];report.direction[Math.abs(dx)>Math.abs(dz)*1.2?'sideways':dz>0?'backward':'forward']++;
  if(leg.kind!=='rail')continue;
  const blockers=new Set();
  for(let i=0;i<leg.points.length-1;i++){
   const a=leg.points[i],b=leg.points[i+1],n=Math.max(1,Math.ceil(Math.hypot(...a.map((v,k)=>b[k]-v))));
   for(let j=0;j<=n;j++){
    const p=a.map((v,k)=>v+(b[k]-v)*j/n);
    for(const s of islands)if(p[1]<s.p[1]-.05&&p[1]+2.8>s.p[1]-1.4&&Math.abs(p[0]-s.p[0])<s.w/2+.3&&Math.abs(p[2]-s.p[2])<s.d/2+.3)blockers.add(s.name);
   }
  }
  if(blockers.size)report.clippedRails.push({name:leg.name,rail:leg.rail,blockers:[...blockers]});
  if(leg.rail.includes('/ lantern ')){
   const start=new r.THREE.Vector3(...leg.points[0]);start.y+=1.3;
   const near=r.l.rails.map(q=>({name:q.object.userData.sourceName,d:q.closestDistance(start)})).sort((a,b)=>a.d-b.d).slice(0,3);report.junctions.push({name:leg.rail,near});
  }
 }
 // Collect each marked cache from its actual supported stop. These are
 // independent contact fixtures, not a claimed uninterrupted full playthrough.
 for(let i=0;i<stops.length-1;i++){
  const stop=stops[i],authored=C.filter(c=>c.t==='crate'&&c.nm.startsWith(`Lantern itinerary / ${i+1} /`));
  const boxes=authored.map(c=>r.l.crates.find(b=>Math.abs(b.mesh.position.x-c.p[0])<.05&&Math.abs(b.mesh.position.z-c.p[2])<.05&&Math.abs(b.mesh.position.y-c.p[1])<3));
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(stop.p[0],stop.p[1]+.08,stop.p[2]),heading:new r.THREE.Vector3(0,0,-1)});
  for(const box of boxes)for(let f=0;f<180&&box?.alive;f++)r.tick({...r.steerToward(box.mesh.position,{pace:.25,tolerance:1.8}),spinHeld:true,spinPressed:f%24===0});
  report.collections.push({name:stop.name,count:boxes.length,broken:boxes.every(b=>b&&!b.alive),end:boxes.every(b=>b&&!b.alive)?undefined:r.snapshot()});
 }
 const cp=C.find(c=>c.t==='checkpoint');
 r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(cp.p[0],cp.p[1]+.08,cp.p[2]+3),heading:new r.THREE.Vector3(0,0,-1)});
 for(let f=0;f<240&&!r.l.activeCheckpoint;f++)r.tick({...r.steerToward(cp.p),spinHeld:true,spinPressed:f%24===0});
 const checkpoint=!!r.l.activeCheckpoint;
 const gate=C.find(c=>c.t==='gate');
 r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(0,gate.p[1]+.08,gate.p[2]+13),heading:new r.THREE.Vector3(0,0,-1)});
 for(let f=0;f<600&&r.p.state!=='finished';f++)r.tick(r.steerToward([0,gate.p[1],gate.p[2]-4]));
 report.finish={state:r.p.state,crystal:r.p.hasCrystal,checkpoint};
 await writeFile(out+'/layout.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,boxes:report.boxes.filter(b=>!b.supported),collections:report.collections.filter(c=>!c.broken)}));
 assert.ok(report.collections.every(c=>c.broken),'Every marked crate can be broken from its real landing');
 assert.ok(report.finish.crystal&&report.finish.state==='finished'&&report.finish.checkpoint,'Native checkpoint, crystal and finish interactions work');
 assert.equal(report.clippedRails.length,0,'Marked rails leave room for the rider beneath existing platforms');
 assert.deepEqual(report.tiers.sort((a,b)=>a-b),[-40,-24,-8,8,24,40]);
 assert.ok(report.direction.backward>=4&&report.direction.sideways>=2,'The route uses northbound and sideways legs');
 assert.ok(report.boxes.every(b=>b.supported),'Every route box has real ground at the correct height');
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming'});
