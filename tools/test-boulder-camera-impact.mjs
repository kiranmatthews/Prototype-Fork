import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
let camera,rig;
const report={};
await withBlockworksRuntime(async r=>{
 const {BoulderChaseCamera}=await r.server.ssrLoadModule('/src/boulderChase.ts');
 camera=new r.THREE.PerspectiveCamera(48,16/9,.1,400);rig=new BoulderChaseCamera();
 rig.update(camera,r.l.boulder.course,r.p.pos,0,r.dt,true);
 let deaths=0,startPosition,run,deathFrame=0,respawnFrame=0;
 r.p.onDeath=()=>{
  deaths++;deathFrame=r.frame;startPosition=r.l.boulder.course.stone.mesh.position.clone();
  run=r.l.boulder.course.beginCameraRun(r.p.fatalChaseBoulder,camera.position,camera.getWorldDirection(new r.THREE.Vector3()));
  if(run){r.p.holdDeathPresentation(run.watchSeconds);assert.ok(run.curve.v0.distanceTo(startPosition)<1e-9,'the same sphere starts at its fatal contact');}
 };
 r.p.onRespawn=()=>{respawnFrame=r.frame;};
 r.stepFor(20);
 r.until(()=>r.sourceModule.rumbleProgress(r.p.pos)>12,()=>r.steerToward(r.sourceModule.rumblePoint(18)),{maxFrames:400,label:'activate pursuit'});
 r.until(()=>r.p.state==='dead',{}, {maxFrames:900,allowDeath:true,label:'actual pursuing boulder contact'});
 assert.equal(r.p.fatalChaseBoulder,0);assert.ok(run);assert.equal(deaths,1);assert.ok(!run.hit);
 // Declared corpse-only fixture: immersion after a genuine fatal collision
 // must not replace the already-started camera presentation or its deadline.
 const water=r.l.lethalWaterSurfaceAt(r.p.pos.x,r.p.pos.z);assert.notEqual(water,null);r.p.pos.y=water-.2;r.tick();
 assert.notEqual(r.p.waterDeathSurface,null);
 const frozenEye=camera.position.clone();let maxStep=0;
 while(!run.hit){const before=r.l.boulder.course.stone.mesh.position.clone();r.tick();maxStep=Math.max(maxStep,before.distanceTo(r.l.boulder.course.stone.mesh.position));
  assert.ok(r.l.boulder.course.stone.box.isEmpty(),'the death presentation cannot inflict a second hit');
  assert.ok(r.l.boulder.course.actors[0].crushBox.isEmpty());assert.equal(r.p.state,'dead');
 }
 const contactClearance=r.l.boulder.course.stone.mesh.position.distanceTo(frozenEye)-run.radius;
 assert.ok(contactClearance>=.19&&contactClearance<.6,'the front of the sphere actually reaches the lens');
 assert.ok(maxStep<1.2,'camera approach remains continuous');
 const paused=r.l.boulder.course.stone.mesh.position.clone(),elapsed=run.elapsed;r.l.boulder.course.update(0,r.p.pos);
 assert.equal(run.elapsed,elapsed);assert.ok(paused.equals(r.l.boulder.course.stone.mesh.position));
 r.until(()=>r.p.state==='ride'&&r.p.grounded,{}, {maxFrames:400,allowDeath:true,label:'natural checkpoint reset after the impact hold'});
 assert.equal(deaths,1);assert.equal(r.p.lives,3);assert.equal(r.p.fatalChaseBoulder,-1);assert.equal(r.l.boulder.course.cameraRun,null);
 assert.ok((respawnFrame-deathFrame)*r.dt>=run.watchSeconds+.68,'respawn cannot cut off the crack reveal');
 assert.ok(Math.abs(run.watchSeconds-run.duration-2.55)<1e-9,'two extra seconds after impact');
 report.cameraImpact={holdAfterImpact:run.watchSeconds-run.duration,corpseWaterContact:true,secondsToLens:run.duration,contactClearance,maxStep,deathCount:deaths,respawnSeconds:(respawnFrame-deathFrame)*r.dt,paused:true};
 r.p.die('water');assert.equal(run,null);assert.equal(r.l.boulder.course.cameraRun,null,'water and unrelated deaths never crack the display');
 report.otherDeathsUnchanged=true;console.log(JSON.stringify(report));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL,
 onTick:(_,r)=>{if(camera&&r.p.state!=='dead'&&r.p.state!=='gameover')rig.update(camera,r.l.boulder.course,r.p.pos,r.p.speed,r.dt,false);},maxFrames:2400});
await mkdir('/private/tmp/boulder-camera-review',{recursive:true});await writeFile('/private/tmp/boulder-camera-review/runtime.json',JSON.stringify(report,null,2));
