import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Every patrol stands on supported ground along its whole walk and can be
// defeated without a mask by an unassisted rider using ordinary inputs.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE,report=[];
 const specs=route.data.components.filter(c=>c.t==='enemy'),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 assert.equal(specs.length,7);
 assert.deepEqual([...new Set(specs.map(c=>c.foe))].sort(),['charger','floater','grunt','hopper','sentry','spiker','turtle'],'seven enemy kinds');
 for(let index=0;index<specs.length;index++){
  const spec=specs[index],s=route.toLocal(spec.p)[0],enemy=l.enemies[index];
  for(let i=0;i<=20;i++){
   const q=new THREE.Vector3(...spec.p);q[enemy.axis]=enemy.x0+(enemy.x1-enemy.x0)*i/20;
   ray.set(q.clone().add(new THREE.Vector3(0,2,0)),down);ray.far=4;
   assert.ok(ray.intersectObjects(l.groundMeshes,false).length,`Unsupported ${spec.foe} patrol endpoint ${i}`);
  }
  // The bull runs the centre of its gallery; the rider approaches on the left
  // shoulder and strikes while it is patrolling, winding up or dizzy.
  const bull=spec.foe==='charger',approachSide=bull?-4.1:0;
  p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s-6,route.groundAt(s-6)+.12,approachSide))});
  p.masks=0;r.stepFor(20);
  const start=r.frame,deaths=p.totalDeaths;
  r.until(()=>!enemy.alive,()=>{
   const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(cam.x,0,cam.z);
   const near=enemy.box.distanceToPoint(p.pos)<2.1;
   if(bull){
    const local=route.toLocal(p.pos.toArray()),foeS=route.toLocal(enemy.group.position.toArray())[0];
    const beside=Math.abs(local[0]-foeS)<1.2,strike=beside&&(enemy.state==='patrol'||enemy.state==='telegraph'||enemy.state==='recover');
    const goal=strike?enemy.group.position.clone():new THREE.Vector3(...route.toWorld(foeS,p.pos.y,-4.1));
    const d=goal.sub(p.pos);
    return{...r.worldDirectionInput(d,beside&&!strike?0:.6),spinHeld:strike&&near&&(p.spinning||!r.lastInput.spinHeld)};
   }
   const d=enemy.group.position.clone().sub(p.pos);
   const waitForHop=enemy.kind==='hopper'&&enemy.state!=='crouch'&&near;
   return{...r.worldDirectionInput(d,waitForHop?0:spec.foe==='sentry'?.8:.42),spinHeld:near&&!waitForHop&&(p.spinning||!r.lastInput.spinHeld)};
  },{maxFrames:900,label:`unmasked ${spec.foe} encounter at ${s}`});
  r.stepFor(30);
  report.push({s,foe:spec.foe,patrolProbes:21,frames:r.frame-start,deaths:p.totalDeaths-deaths,defeated:!enemy.alive,bailing:p.isBailing,grounded:p.grounded,state:p.state,position:p.pos.toArray()});
  console.log(JSON.stringify(report.at(-1)));
  assert.equal(p.totalDeaths,deaths);assert.ok(!p.isBailing&&p.grounded,`${spec.foe} encounter must end upright on the ground`);
 }
 await writeFile('/private/tmp/temple-embers-encounters.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
