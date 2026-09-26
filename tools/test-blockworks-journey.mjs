import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { runOpeningAndTerrace, runFrozen } from './test-blockworks.mjs';
import { runAqueduct } from './test-blockworks-aqueduct.mjs';
import { runFoundry } from './test-blockworks-foundry.mjs';
import { runMachinery } from './test-blockworks-movers.mjs';
import { runFinale } from './test-blockworks-finale.mjs';

// The acceptance run starts at spawn and keeps one Player/Level throughout.
// Pilots only submit real normalized inputs; chapter boundaries never reset
// position, velocity, world time, inventory, puzzle state or camera state.
const evidence=[],checkpoints=[],tracePath=process.env.BLOCKWORKS_JOURNEY_TRACE??'/tmp/blockworks-whole-journey.json';
let recording,failure,lastCheckpoint=null,stage='opening';
try{
 await withBlockworksRuntime(async r=>{
  recording={sourceSha256:createHash('sha256').update(JSON.stringify(r.source)).digest('hex'),
   fixedStep:r.dt,tuning:structuredClone(r.TUNING),frames:r.trace,actions:r.actions};
  evidence.push(...runOpeningAndTerrace(r));
  stage='frozen bends';evidence.push(runFrozen(r));
  stage='aqueduct';await runAqueduct(r);evidence.push({stage,frame:r.frame,position:r.p.pos.toArray(),speed:r.p.speed});
  stage='foundry';evidence.push(runFoundry(r,{exerciseReward:true,verifyRespawn:false}));
  stage='machinery';evidence.push(runMachinery(r));
  stage='finale';evidence.push(...runFinale(r));
  assert.equal(r.p.state,'finished','the actual player must cross the finish gate');
  assert.equal(r.p.totalDeaths,0,'acceptance journey must not hide a respawn');
  assert.ok(r.trace.every(row=>!row.bailing&&!['dead','gameover'].includes(row.state)),'acceptance journey contains a failure');
  let distance=0,largestStep=0;
  for(let i=1;i<r.trace.length;i++){
   const a=r.trace[i-1].position,b=r.trace[i].position,d=Math.hypot(...b.map((v,k)=>v-a[k]));
   distance+=d;largestStep=Math.max(largestStep,d);
  }
  assert.ok(largestStep<2.2,`unexpected teleport-sized physics step ${largestStep}`);
  assert.equal(checkpoints.length,6,'all six substantial checkpoints must be banked through inputs');
  evidence.push({stage:'complete',seconds:r.frame*r.dt,frames:r.frame,distance,largestStep,
   checkpoints:checkpoints.map(p=>({s:p.s,frame:p.frame})),finalPosition:r.p.pos.toArray()});
 },{maxFrames:90000,onTick:(sample,r)=>{
  const cp=r.l.activeCheckpoint;
  if(cp&&cp!==lastCheckpoint){lastCheckpoint=cp;const source=r.sourceModule.BLOCKWORKS_CHECKPOINTS.find(c=>Math.hypot(c.p[0]-cp.spawnPos.x,c.p[2]-cp.spawnPos.z)<.1);checkpoints.push({s:source?.s,frame:sample.frame});}
 }});
}catch(error){failure=error;}
finally{await writeFile(tracePath,JSON.stringify({evidence,checkpoints,failedStage:failure?stage:null,failure:failure?.message,recording}));}
console.log(JSON.stringify({evidence,checkpoints,tracePath,failedStage:failure?stage:null},null,2));
if(failure)throw failure;
console.log('PASS one continuous spawn-to-gate Blockworks journey with real carving, all mechanics, six checkpoint banks and no resets');
