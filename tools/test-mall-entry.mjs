import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallEntryPilot} from './mall-pilot.mjs';

// Both complete entrance lines start at the authored spawn. The pop variant
// uses normal jump releases; neither fixture changes motion after respawn.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,before=JSON.stringify(r.TUNING),runs=[];
 const upperWallCoverage=[];
 for(const x of [-4.75,4.75])for(const z of [-21,5]){
  const position=new THREE.Vector3(x,40,z),solid=l.walls.some(w=>w.containsPoint(position));
  upperWallCoverage.push({position:position.toArray(),solid});
  assert.ok(solid,'The high-air enclosure must have native wall collision');
 }
 for(const pop of [false,true]){
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.MALL_LEVEL.spawn),heading:new THREE.Vector3(0,0,-1)});
  const pilot=createMallEntryPilot(m,{pop}),first=r.trace.length;
  for(let i=0;i<1000;i++){
   let input;
   if(!pilot.done)input=pilot.sample(p,l);
   else{
    const q=m.mallPoint(38,2.2),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz),f=p.axisF;
    input={moveX:p.grounded?(dx*-f.z+dz*f.x)/n:0,moveY:p.grounded?(dx*f.x+dz*f.z)/n:0,jumpHeld:true};
   }
   r.tick(input);if(!pilot.done)pilot.observe(p,l);
   if(p.isBailing||p.state==='dead'||pilot.done&&p.pos.z<m.mallPoint(34)[2])break;
  }
  const trace=r.trace.slice(first),report={pop,done:pilot.done,state:p.state,position:p.pos.toArray(),bail:p.isBailing,deaths:p.totalDeaths,frames:trace.length,evidence:pilot.evidence};runs.push(report);
  await writeFile(`/private/tmp/mall-recreation/entry-${pop?'pop':'roll'}-trace.json`,JSON.stringify(trace));
 }
 await writeFile('/private/tmp/mall-recreation/entry.json',JSON.stringify({runs,upperWallCoverage,tuningUnchanged:before===JSON.stringify(r.TUNING)},null,2));console.log(JSON.stringify(runs,null,2));
 for(const run of runs){
  assert.ok(run.done&&!run.bail&&run.deaths===0&&run.position[2]<m.mallPoint(34)[2],'Both native quarter returns must reach the doorway');
  assert.equal(run.evidence.turns.length,2);
  assert.ok(run.evidence.transitionFrames.every(n=>n>20)&&run.evidence.airFrames.every(n=>n>20));
  assert.ok(run.evidence.returnedSpeeds.every(n=>n>18),'Both turns must return with useful skating momentum');
 }
 assert.equal(JSON.stringify(r.TUNING),before);
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:2200,controlFrame:r=>r.p.axisF});
