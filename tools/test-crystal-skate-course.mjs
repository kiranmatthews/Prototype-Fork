import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runSkateTrial} from './crystal-skate-pilot.mjs';
const out=(process.env.CRYSTAL_SKATE_OUT??'/workspace/crystal-sequences')+'/course';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m}=r,report={passed:false,trials:[],navigation:[],inputOnly:true,teleportsDuringCourse:0};
 const baseline=JSON.stringify(r.TUNING);
 const run=g=>{for(const sample of g)r.tick(sample);};
 const forward={moveY:1,jumpHeld:true};
 const gate=r.source.components.find(c=>c.t==='gate').p;
 assert.equal(l.skateCollectathon.tokens.length,25);assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(new Set(r.source.groups.map(g=>g.id)).size,r.source.groups.length);
 try {
  // Separate locked-exit fixture, before the continuous run's ordinary reset.
  p.respawn(l,true,false,{position:new r.THREE.Vector3(0,gate[1]+.15,gate[2]+8),heading:new r.THREE.Vector3(0,0,-1)});
  for(let i=0;i<90;i++)r.tick({moveY:1});
  assert.notEqual(p.state,'finished');assert.equal(l.skateCollectathon.exitReady,false);
  report.lockedExit=true;p.respawn(l,true);const firstFrame=r.frame;
  for(const [index,trial] of m.CRYSTAL_TRIALS.entries()){
   const local={id:trial.id,actions:[],evidence:[]},offset=m.trialOrigin(index),start=r.frame;
   report.trials.push(local);
   run(runSkateTrial({...r,trial,offset,report:local,get frame(){return r.frame;}},trial.id,{finish:false}));
   assert.equal(l.skateCollectathon.collected,index+1);assert.equal(p.totalDeaths,0);
   assert.ok(p.freeSkate);assert.equal(p.hasCrystal,false);
   local.passed=true;local.frames=r.frame-start;
   console.log(JSON.stringify({id:trial.id,passed:true,frame:r.frame,position:p.pos.toArray(),speed:p.speed}));
  }
  r.until(()=>p.pos.z<gate[2]+10,forward,{label:'Skate across the final runout'});r.releaseJump({moveY:1});
  r.until(()=>p.state==='finished',forward,{label:'Ollie through the real exit',maxFrames:180});
  assert.equal(JSON.stringify(r.TUNING),baseline);
  assert.equal(l.skateCollectathon.collected,25);report.frames=r.frame-firstFrame;report.seconds=report.frames/60;
  report.finish=r.snapshot();report.passed=true;
  l.reset(false);assert.equal(l.skateCollectathon.collected,25);l.reset(true);assert.equal(l.skateCollectathon.collected,0);
 } catch(e){report.failure=String(e);report.atFailure=r.snapshot();throw e;}
 finally {await writeFile(`${out}/native.json`,JSON.stringify(report,null,2)+'\n');await writeFile(`${out}/trace.json`,JSON.stringify(r.trace)+'\n');}
 console.log('PASS continuous skating through all 25 challenges and every connecting gap.');
},{modulePath:'/src/levels/crystal-trials.ts',source:m=>m.CRYSTAL_TRIALS_LEVEL,levelId:'__crystal-skate-course',endlessDeaths:true,controlFrame:()=>({x:0,z:-1})});
