import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Every patrol stands on supported ground along its whole walk and can be
// defeated without a mask by an unassisted rider using ordinary inputs,
// starting beside it on its own floor.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE,report=[];
 const specs=route.data.components.filter(c=>c.t==='enemy'),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 assert.equal(specs.length,10);
 assert.deepEqual([...new Set(specs.map(c=>c.foe))].sort(),['charger','grunt','hopper','sentry','spiker','turtle'],'six enemy kinds');
 for(let index=0;index<specs.length;index++){
  const spec=specs[index],enemy=l.enemies[index],[s,,x]=route.toLocal(spec.p);
  for(let i=0;i<=20;i++){const q=new THREE.Vector3(...spec.p);q[enemy.axis]=enemy.x0+(enemy.x1-enemy.x0)*i/20;ray.set(q.clone().add(new THREE.Vector3(0,2,0)),down);ray.far=4;assert.ok(ray.intersectObjects(l.groundMeshes,false).length,`Unsupported ${spec.foe} patrol endpoint ${i}`);}
  // Approach on the enemy's own floor: beside the bull's lane, a few metres before everyone else.
  const bull=spec.foe==='charger';
  const candidates=bull?[[s-14,x-6]]:[[s-4,x],[s,x-1.6],[s,x+1.6],[s-1.6,x],[s+1.6,x]];
  const spot=candidates.find(([cs,cx])=>{const y=route.floorAt(cs,cx);return y!==undefined&&Math.abs(y-spec.p[1])<.5;})??candidates[0];
  const start=route.toWorld(spot[0],spec.p[1]+.12,spot[1]);
  p.respawn(l,true,false,{position:new THREE.Vector3(...start)});
  p.masks=0;r.stepFor(20);
  const begin=r.frame,deaths=p.totalDeaths;
  r.until(()=>!enemy.alive,()=>{
   const cam=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(cam.x,0,cam.z);
   const near=enemy.box.distanceToPoint(p.pos)<2.1;
   if(bull){
    const local=route.toLocal(p.pos.toArray()),foeS=route.toLocal(enemy.group.position.toArray())[0];
    const beside=Math.abs(local[0]-foeS)<1.2,strike=beside&&(enemy.state==='patrol'||enemy.state==='telegraph'||enemy.state==='recover');
    const goal=strike?enemy.group.position.clone():new THREE.Vector3(...route.toWorld(foeS,p.pos.y,x-6));
    const d=goal.sub(p.pos);
    return{...r.worldDirectionInput(d,beside&&!strike?0:.6),spinHeld:strike&&near&&(p.spinning||!r.lastInput.spinHeld)};
   }
   const d=enemy.group.position.clone().sub(p.pos);
   const waitForHop=enemy.kind==='hopper'&&enemy.state!=='crouch'&&near;
   // On a ledge, never step toward empty air: hold position and let the foe come.
   const ahead=p.pos.clone().addScaledVector(d.clone().setY(0).normalize(),.9),[as,,ax]=route.toLocal(ahead.toArray());
   const safe=route.floorAt(as,ax)!==undefined;
   return{...r.worldDirectionInput(d,waitForHop||!safe?0:spec.foe==='sentry'?.8:.42),spinHeld:near&&!waitForHop&&(p.spinning||!r.lastInput.spinHeld)};
  },{maxFrames:900,label:`unmasked ${spec.foe} encounter at ${s.toFixed(0)}`});
  r.stepFor(30);
  report.push({s:+s.toFixed(1),x:+x.toFixed(1),foe:spec.foe,frames:r.frame-begin,deaths:p.totalDeaths-deaths,defeated:!enemy.alive,bailing:p.isBailing,grounded:p.grounded,state:p.state});
  console.log(JSON.stringify(report.at(-1)));
  assert.equal(p.totalDeaths,deaths);assert.ok(!p.isBailing&&p.grounded,`${spec.foe} encounter must end upright on the ground`);
 }
 await writeFile('/private/tmp/temple-embers-encounters.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
