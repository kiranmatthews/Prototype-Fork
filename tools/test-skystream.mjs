import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {slipstreamPlayableLength} from './slipstream-course-length.mjs';
import {createSkystreamPilot} from './skystream-pilot.mjs';
const output=process.env.SKYSTREAM_REVIEW_DIR??join(tmpdir(),'skystream-review');
await mkdir(output,{recursive:true});

await withBlockworksRuntime(async r=>{
 const {p,l,source,sourceModule:m}=r;
 const saved=JSON.parse(await readFile(new URL('./fixtures/skystream/saved-slipstream.json',import.meta.url),'utf8'));
 const original=await r.server.ssrLoadModule('/src/levels/skystream-source.ts');
 assert.deepEqual(original.SAVED_SLIPSTREAM_LEVEL,saved,'Keep the exact exported saved course as the mirrored foundation');
 const api=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(api.normalizeCustomLevelData(source),'The full editor data must survive normalization');
 const before=slipstreamPlayableLength(saved).playable,after=slipstreamPlayableLength(source).playable;
 console.log({baselineMetres:before,skystreamMetres:after,ratio:after/before,components:source.components.length});
 assert.ok(after/before>3.3&&after/before<4,'Retain the long route and extend it with two full loops');
 for(const original of saved.components.filter(c=>c.t==='vertramp')){
  const reflected=source.components.find(c=>c.t==='vertramp'&&c.p[2]===original.p[2]);
  const a=api.vertRampSpine(original),b=api.vertRampSpine(reflected);
  assert.equal(a.length,b.length);
  a.forEach((q,i)=>{assert.ok(Math.abs(q.x+b[i].x)<1e-6&&Math.abs(q.y-b[i].y)<1e-6&&Math.abs(q.z-b[i].z)<1e-6&&Math.abs(q.roll+b[i].roll)<1e-6);});
 }
 assert.equal(l.loopMeshes.length,3);assert.ok(l.loopMeshes.every(mesh=>mesh.userData.loopRequired===false));
 assert.ok(source.components.every(c=>!['rail','rope','ropeswing'].includes(c.t)),'Skystream has no standalone rails or ropes');
 assert.equal(l.ropeSwings.length,0);assert.equal(l.ropes.length,0);
 assert.deepEqual(l.loopMeshes.map(mesh=>mesh.userData.loopKind??'vertical'),['vertical','wall','vertical']);
 const roads=source.components.filter(c=>c.t==='vertramp'||c.t==='mesh'&&c.solid!==false);
 assert.ok(roads.every(c=>c.cloudRoad&&c.tex==='solid'),'Every road is cloud, without marble or painted markings');
 const shells=[];l.root.traverse(o=>{if(o.isMesh&&o.userData.cloudRoadVisual)shells.push(o);});
 assert.ok(shells.length>100&&shells.every(mesh=>!l.groundMeshes.includes(mesh)),'Cloud billows must never affect driving contact');
 assert.ok(l.groundMeshes.filter(mesh=>mesh.userData.cloudRoad).every(mesh=>!mesh.visible),'Only the cloud shell should be visible');
 const roundtrip=api.normalizeCustomLevelData(l.captureData());
 assert.ok(roundtrip&&roundtrip.components.some(c=>c.loopKind==='wall'),'Editor roundtrip preserves wall-loop orientation');
 const {resolveLevelAtmosphere}=await r.server.ssrLoadModule('/src/levelAtmosphere.ts');
 const atmosphere=resolveLevelAtmosphere(l);
 assert.equal(atmosphere.fogNear,90);assert.equal(atmosphere.fogFar,440);
 assert.equal(l.crystalPickup,null);assert.equal(l.isBossLevel,false);
 const probes=[source.spawn,...source.components.filter(c=>['checkpoint','gate','crate'].includes(c.t)).map(c=>c.p)];
 const ray=new r.THREE.Raycaster();l.root.updateMatrixWorld(true);
 for(const q of probes){
  ray.set(new r.THREE.Vector3(q[0],q[1]+2,q[2]),new r.THREE.Vector3(0,-1,0));ray.far=4;
  const hit=ray.intersectObjects(l.groundMeshes.filter(mesh=>!mesh.userData.startWarpPad&&!mesh.userData.finishPad),false)[0];
  assert.ok(hit&&Math.abs(hit.point.y-q[1])<.5,'Unsupported crate/checkpoint/spawn/finish '+q+' actual '+hit?.point.y);
 }
 const crates=source.components.filter(c=>c.t==='crate');
 for(const line of m.SKYSTREAM_CRATE_LINES){
  for(let i=1;i<line.positions.length;i++)
   assert.ok(new r.THREE.Vector3(...line.positions[i]).distanceTo(new r.THREE.Vector3(...line.positions[i-1]))>=13,
    line.name+': give the rider room to recover speed between boxes');
 }
 for(const c of crates)for(const gap of m.SKYSTREAM_GAPS){
  const position=new r.THREE.Vector3(...c.p);
  assert.ok(position.distanceTo(new r.THREE.Vector3(...gap.takeoff))>24,'Keep jump setup clear');
  assert.ok(position.distanceTo(new r.THREE.Vector3(...gap.landing))>28,'Keep touchdown and rollout clear');
 }
 if(process.argv.includes('--structure'))return;
 const pilot=createSkystreamPilot(m),tuning=JSON.stringify(r.TUNING);
 let error,finished,recovery;
 try{
  for(let i=0;i<42000&&p.state!=='finished';i++){
   r.tick(pilot.sample(p,l));pilot.observe(p,l);
   if(i%1800===0)console.log(JSON.stringify({frame:i,index:pilot.index,p:p.pos.toArray(),speed:p.speed,state:p.state}));
   assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),'Lost route '+JSON.stringify({index:pilot.index,...r.snapshot()}));
  }
  assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);
  assert.ok(pilot.evidence.inverted&&pilot.evidence.loopEntrySpeed>55);
  assert.equal(p.loopStatus.completed,3);
  assert.ok(pilot.evidence.loops[0].inverted&&pilot.evidence.loops[1].wall&&pilot.evidence.loops[2].inverted);
  assert.equal(pilot.evidence.gaps.length,4);assert.ok(pilot.evidence.gaps.every(g=>g.aired&&g.landed));
  assert.equal(JSON.stringify(r.TUNING),tuning);
  finished={...r.snapshot(),cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,
   remainingCrates:l.crates.filter(c=>c.alive).map(c=>c.mesh.position.toArray())};
  assert.equal(p.cratesBroken,l.totalCrates-l.bonusCrateTotal,'Collect every main-course box/checkpoint in one forward skating run');
  // A normal retry uses the checkpoint earned by the route above. Drive off
  // its edge, let the real pit/death path run, and verify the supported return.
  p.respawn(l,false);
  const checkpoint=p.pos.clone();
  for(let i=0;i<1200&&p.totalDeaths===0;i++)r.tick({...r.worldDirectionInput([1,0,0]),jumpHeld:true});
  assert.equal(p.totalDeaths,1,'Leaving the course must reach its kill plane');
  for(let i=0;i<600&&(p.isBailing||p.state==='dead'||!p.grounded);i++)r.tick({});
  assert.ok(p.grounded&&!p.isBailing&&p.pos.distanceTo(checkpoint)<3,'Pit respawn must return to the earned checkpoint');
  recovery=r.snapshot();
 }catch(e){error=String(e);}
 await writeFile(join(output,'native.json'),JSON.stringify({evidence:pilot.evidence,index:pilot.index,end:finished??r.snapshot(),recovery,error,trace:r.trace}));
 console.log(JSON.stringify({evidence:pilot.evidence,index:pilot.index,end:finished??r.snapshot(),recovery,error}));
 assert.equal(error,undefined);
},{modulePath:'/src/levels/skystream.ts',source:m=>m.SKYSTREAM_LEVEL,levelId:'skystream',endlessDeaths:true,maxFrames:43000,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
