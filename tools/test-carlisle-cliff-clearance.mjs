import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const replay=JSON.parse(await readFile(new URL('fixtures/carlisle-cliff-replay.json',import.meta.url),'utf8'));
const full=process.argv.includes('--full'),first=full?0:5807;
await withBlockworksRuntime(async r=>{
 const {Replayer}=await r.server.ssrLoadModule('/src/replay.ts');
 const {CarlisleSceneryCamera,CarlisleSceneryCollision}=await r.server.ssrLoadModule('/src/carlisleSceneryCollision.ts');
 const camera=new r.THREE.PerspectiveCamera(49,1.6,.1,400),framing=new CarlisleSceneryCamera();
 const recordedFeet=new r.THREE.Vector3(15.17459,-35.22637452246039,-192.584759);
 camera.position.copy(recordedFeet).add(new r.THREE.Vector3(0,5.1,5.05));camera.lookAt(recordedFeet.clone().add(new r.THREE.Vector3(0,1.3,0)));
 const wanted=camera.position.clone(),orientation=camera.quaternion.clone(),anchor=recordedFeet.clone().add(new r.THREE.Vector3(0,.58,0));
 const before=r.l.carlisleScenery.cameraFraction(anchor,camera.position,.22);
 assert.ok(before>.5&&before<.8,'the recorded final camera really crosses the cliff');
 framing.apply(camera,r.l.carlisleScenery,recordedFeet,1/60,true);
 assert.ok(camera.position.distanceTo(wanted)>1,'camera retracts before the rock');
 assert.equal(r.l.carlisleScenery.cameraFraction(anchor,camera.position,.22),1,'corrected camera arm is clear');
 const finalCamera=camera.position.toArray();framing.restore(camera);
 assert.ok(camera.position.equals(wanted)&&camera.quaternion.equals(orientation),'clearance does not feed back into the authored camera');
 const clearFeet=new r.THREE.Vector3(0,-5.085,-185);camera.position.copy(clearFeet).add(new r.THREE.Vector3(0,5.1,5.05));const clearEye=camera.position.clone();
 framing.apply(camera,r.l.carlisleScenery,clearFeet,1/60,true);assert.ok(camera.position.equals(clearEye),'main route retains its authored view');
 // An upward strike on the real stone underside must stop below it, while a
 // down-ray originating inside the model must not treat that underside as a floor.
 const stone=new CarlisleSceneryCollision(),mesh=stone.add({t:'decor',dkind:'coastv2buttress',p:[0,0,0],s:[14,12.975,14],solid:true});
 const ray=new r.THREE.Raycaster(new r.THREE.Vector3(0,-2,0),new r.THREE.Vector3(0,1,0));
 let bottom;
 for(const x of [-5,-3,-1,1,3,5])for(const z of [-5,-3,-1,1,3,5]){
  ray.set(new r.THREE.Vector3(x,-2,z),new r.THREE.Vector3(0,1,0));const hit=ray.intersectObject(mesh)[0];
  if(hit?.face.normal.y<-.8){bottom=hit;break;}
 }
 assert.ok(bottom,'measured stone has a real downward face');
 const from=bottom.point.clone().add(new r.THREE.Vector3(0,-2,0)),to=bottom.point.clone().add(new r.THREE.Vector3(0,1,0));
 const ceiling=stone.resolve(from,to,.35,1.6);assert.ok(ceiling&&ceiling.normal.y<-.65);assert.ok(ceiling.y+1.6<=bottom.point.y+.08,'continuous sweep prevents rising through the ceiling');
 ray.set(bottom.point.clone().add(new r.THREE.Vector3(0,.1,0)),new r.THREE.Vector3(0,-1,0));ray.far=1;
 assert.ok(ray.intersectObject(mesh).every(hit=>hit.face.normal.y>0),'downward faces never become ground, even when real shelves overlap');stone.dispose();
 const take=new Replayer(),input={},events=[];let undersideSupports=0,lastGround='',maxStep=0;
 take.begin(replay);take.frame=first;
 try{for(let f=first;f<replay.frames;f++){
  const before=r.p.pos.clone();take.feed(input,r.p.camDir);r.tick(input);
  const hit=r.p.groundHit;if(r.p.grounded&&hit?.mesh?.userData.carlisleScenery&&hit.normal.y<=0)undersideSupports++;
  if(r.p.state==='ride'&&r.p.grounded&&hit?.mesh?.userData.carlisleScenery)maxStep=Math.max(maxStep,Math.abs(r.p.pos.y-before.y));
  if(lastGround!==hit?.name){events.push({frame:f,position:r.p.pos.toArray(),ground:hit?.name});lastGround=hit?.name;}
  assert.ok(r.p.pos.toArray().every(Number.isFinite),'replay remains finite');
 }}finally{take.end();}
 assert.equal(undersideSupports,0,'recorded cliff exploration cannot stand on downward faces');
 if(!full){assert.ok(r.p.grounded);assert.ok(r.p.pos.y>-7,'final checkpoint take stays out of the buried cliff layers');}
 const report={first,frames:replay.frames-first,undersideSupports,maxStep,final:r.p.pos.toArray(),deaths:r.p.totalDeaths,recordedCameraFraction:before,correctedCamera:finalCamera,events};
 await writeFile('/private/tmp/carlisle-cliff-clearance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,events:events.length}));
},{modulePath:'/src/levels/carlisle-coast.ts',source:m=>m.CARLISLE_COAST_LEVEL,levelId:'test',start:full?undefined:[0,-4.985,-185],heading:[0,0,-1],endlessDeaths:true,maxFrames:replay.frames+10});
