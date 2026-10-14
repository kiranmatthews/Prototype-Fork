import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const results=[];
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,chase=r.l.boulder.course,{THREE}=r;
 assert.equal(r.l.checkpoints.length,6);assert.equal(chase.actors.length,7);
 assert.equal(r.l.boulder.cradles.filter(Boolean).length,7,'every waiting rock has its actual breakaway cradle');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.deepEqual(normalizeCustomLevelData(r.l.captureData()).boulderChase,m.RUMBLEWATER_RUN_LEVEL.boulderChase);
 const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),target=new THREE.Vector3();
 for(const room of m.RUMBLEWATER_REFUGES){
  // Stand inside each refuge, using the normal spawn placement fixture once.
  const point=m.rumblePoint(room.checkpoint,m.rumbleHeight(room.checkpoint)+.12);
  r.p.respawn(r.l,true,false,{position:new THREE.Vector3(...point)});chase.reset(r.p.pos);r.stepFor(20);
  const supplies=r.l.crates.filter(c=>Math.abs(m.rumbleProgress(c.mesh.position)-room.checkpoint)<9&&c.alive);
  const alive=supplies.length;r.stepFor(1200);
  assert.ok(r.p.grounded&&!r.p.isBailing&&r.p.state==='ride','normal physics supports a long idle inside '+room.name);
  assert.ok(!chase.active&&chase.sheltered);assert.ok(chase.actors.every(a=>a.stone.box.isEmpty()),'there are no lethal boulder contacts in the room');
  assert.equal(supplies.filter(c=>c.alive).length,alive,'the pursuer cannot consume sheltered supplies');
  // The arch is a genuine open passage surrounded by physical stone.
  const entry=m.rumblePoint(room.entry),dir=new THREE.Vector3(...m.rumbleTangent(room.entry));
  origin.fromArray(entry).addScaledVector(dir,-3);origin.y+=1.6;ray.set(origin,dir);ray.far=6;
  const arches=r.l.root.children.filter(o=>o.userData.editorIdx!==undefined&&m.RUMBLEWATER_RUN_LEVEL.components[o.userData.editorIdx]?.grp===room.grp);
  assert.ok(arches.length>=10,'the refuge inspection includes its real meshes');
  assert.equal(ray.intersectObjects(arches,true).filter(h=>h.object.userData.solidSurface!=='none'&&!h.object.userData.editorGhost).length,0,'the doorway has no invisible front wall');
  // The lowered camera sees the rider through the roof and both portals.
  const {BoulderChaseCamera}=await r.server.ssrLoadModule('/src/boulderChase.ts');
  const camera=new THREE.PerspectiveCamera(48,16/9,.1,300),rig=new BoulderChaseCamera();let blocked=0;
  for(const s of [room.entry-18,room.entry+3,room.checkpoint,room.exit-2,room.exit+4]){
   const at=new THREE.Vector3(...m.rumblePoint(s));chase.reset(at);rig.update(camera,chase,at,20,1/60,true);
   target.copy(at).y+=1.5;const direction=target.clone().sub(camera.position);ray.set(camera.position,direction.clone().normalize());ray.far=direction.length()-.6;
   const hits=ray.intersectObjects(arches,true).filter(h=>h.object.userData.solidSurface!=='none'&&!h.object.userData.editorGhost);blocked+=hits.length?1:0;if(hits.length)console.log(JSON.stringify({room:room.name,s,camera:camera.position.toArray(),target:target.toArray(),hits:hits.map(h=>({name:h.object.name,component:m.RUMBLEWATER_RUN_LEVEL.components[h.object.userData.editorIdx]?.nm,point:h.point.toArray(),visible:h.object.visible,materialVisible:h.object.material?.visible,visualOnly:h.object.userData.visualOnly,ghost:h.object.userData.editorGhost}))}));
  }
  assert.equal(blocked,0,'the actual shelter meshes do not occlude the rider');
  results.push({name:room.name,checkpoint:room.checkpoint,secondsSafe:20,suppliesPreserved:alive,cameraOcclusions:blocked});
 }
 // K/L may move backwards without resetting the rest of the level.
 const second=m.RUMBLEWATER_REFUGES[1];
 r.p.respawn(r.l,true,false,{position:new THREE.Vector3(...m.rumblePoint(second.checkpoint,m.rumbleHeight(second.checkpoint)+.12))});
 chase.reset(r.p.pos);r.stepFor(2);assert.equal(r.l.boulder.cradles[1].state,'gone');
 assert.ok(r.p.warpCheckpoint(r.l,-1));r.stepFor(2);
 assert.equal(chase.stage,1);assert.equal(chase.actors[1].phase,'waiting');assert.equal(chase.actors[1].drop,13);
 assert.equal(r.l.boulder.cradles[1].state,'idle');assert.ok(r.l.boulder.cradles[1].mesh.visible,'backwards checkpoint warps restore the waiting stone’s cradle');
 console.log(JSON.stringify({pass:true,rooms:results,backwardsWarpRearmsCradle:true}));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL});
await mkdir('/private/tmp/rumblewater-refuges',{recursive:true});await writeFile('/private/tmp/rumblewater-refuges/geometry.json',JSON.stringify(results,null,2));
