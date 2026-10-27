import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out='docs/waterfall-climb/runs';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,evidence=[],normalizer=(await r.server.ssrLoadModule('/src/level.ts')).normalizeCustomLevelData;
 assert.ok(normalizer(r.source));
 for(const [index,direction] of [[0,[-1,0]],[4,[-1,0]],[6,[-1,0]],[8,[-1,0]],[9,[0,1]]]){
  const cp=l.checkpoints[index];
  p.respawn(l,true,false,{position:new THREE.Vector3(cp.spawnPos.x-1.1,cp.spawnPos.y,cp.spawnPos.z)});
  r.stepFor(18);assert.ok(p.grounded);r.tick({spinHeld:true});r.stepFor(24);assert.ok(cp.active);
  const lives=p.lives,before=r.snapshot(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),y=p.pos.y;
  const origin=p.pos.clone(),[dx,dz]=direction;let distance=0;
  for(let step=0;step<400;step++){
   const next=distance+.3;ray.set(new THREE.Vector3(origin.x+dx*next,y+.1,origin.z+dz*next),down);ray.far=.3;
   if(!ray.intersectObjects(l.groundMeshes,false).some(h=>Math.abs(h.point.y-y)<.05))break;distance=next;
  }
  const input={moveX:dx,moveY:-dz};
  r.walkTo([origin.x+dx*(distance-.7),y,origin.z+dz*(distance-.7)],{pace:.25,arrivalTolerance:.3,maxFrames:2200});r.charge();r.releaseJump(input);
  r.until(()=>p.state==='dead',input,{maxFrames:1000,allowDeath:true,label:`Deliberately miss from checkpoint ${index}`});
  r.until(()=>p.state==='ride'&&p.grounded,{}, {maxFrames:500,allowDeath:true,label:`Recover to checkpoint ${index}`});r.stepFor(12);
  assert.equal(p.lives,lives-1);assert.ok(p.pos.distanceTo(cp.spawnPos)<.15,JSON.stringify({checkpoint:index,expected:cp.spawnPos.toArray(),actual:r.snapshot()}));assert.ok(l.spinBridges.every(b=>b.state==='closed'));
  evidence.push({checkpoint:index,before,after:r.snapshot()});console.log('RECOVERED',index,JSON.stringify(p.pos.toArray()));
 }
 await writeFile(`${out}/redesign-recovery.json`,JSON.stringify(evidence,null,2));console.log('PASS low, basin, aqueduct, cloud and summit recovery');
},{modulePath:'/src/levels/waterfall-climb.ts',levelId:'waterfall-climb',source:m=>m.WATERFALL_CLIMB_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:15000});
