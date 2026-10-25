import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE,report=[];
 const specs=route.data.components.filter(c=>c.t==='enemy'),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 assert.equal(specs.length,8);
 for(let index=0;index<specs.length;index++){
  const spec=specs[index],s=route.toLocal(spec.p)[0],enemy=l.enemies[index];
  // Check the whole patrol span, not only its home position. The diagonal
  // stretches deliberately use the supported world-axis cross-section.
  for(let i=0;i<=20;i++){
   const q=new THREE.Vector3(...spec.p);q[enemy.axis]=enemy.x0+(enemy.x1-enemy.x0)*i/20;
   ray.set(q.clone().add(new THREE.Vector3(0,2,0)),down);ray.far=4;
   assert.ok(ray.intersectObjects(l.groundMeshes,false).length,`Unsupported ${spec.foe} patrol endpoint ${i}`);
  }
  p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s-6,route.groundAt(s-6)+.12,0))});
  p.masks=0;r.stepFor(20);
  const start=r.frame,deaths=p.totalDeaths;
  r.until(()=>!enemy.alive,()=>{
   const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(cam.x,0,cam.z);
   const d=enemy.group.position.clone().sub(p.pos),near=enemy.box.distanceToPoint(p.pos)<2.1;
   const waitForHop=enemy.kind==='hopper'&&enemy.state!=='crouch'&&near;
   return{...r.worldDirectionInput(d,waitForHop?0:.42),spinHeld:near&&!waitForHop&&(p.spinning||!r.lastInput.spinHeld)};
  },{maxFrames:600,label:`unmasked ${spec.foe} encounter at ${s}`});
  r.stepFor(30);assert.equal(p.totalDeaths,deaths);assert.ok(!p.isBailing&&p.grounded);
  report.push({s,foe:spec.foe,patrolProbes:21,frames:r.frame-start,deaths:p.totalDeaths-deaths,defeated:!enemy.alive});
 }
 await writeFile('/private/tmp/temple-embers-encounters.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
