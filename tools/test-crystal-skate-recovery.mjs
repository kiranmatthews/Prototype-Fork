import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runSkateTrial} from './crystal-skate-pilot.mjs';
const out=(process.env.CRYSTAL_SKATE_OUT??'/workspace/crystal-sequences')+'/recovery';await mkdir(out,{recursive:true});
for(const id of [2,3])await withBlockworksRuntime(async r=>{
 const {p,l}=r,trial=r.sourceModule.CRYSTAL_TRIALS.find(t=>t.id===id),report={id,passed:false,actions:[],evidence:[]};
 const steer=(x,z)=>{
  const a=Math.atan2(x-p.pos.x,z-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z),e=Math.atan2(Math.sin(a),Math.cos(a));
  return {moveY:1,moveX:Math.max(-1,Math.min(1,-e*3)),jumpHeld:true,grabHeld:p.grounded&&p.speed>12};
 };
 const go=(x,z)=>r.until(()=>Math.hypot(p.pos.x-x,p.pos.z-z)<5,()=>steer(x,z),{label:`Recovery skating to ${x}, ${z}`,maxFrames:1800});
 try{
  r.until(()=>p.pos.z<24,{moveY:1,jumpHeld:true},{label:'Bank the approach checkpoint'});
  assert.ok(l.checkpoints.some(cp=>cp.active));
  go(8,-8);
  if(id===3){
   r.until(()=>p.state==='dead',{moveY:1,jumpHeld:true},{label:'Deliberately miss the rail into its marked pit',allowDeath:true});
   r.until(()=>p.state==='ride'&&p.grounded&&!p.isBailing,{}, {label:'Automatic checkpoint recovery',allowDeath:true});
   assert.equal(p.totalDeaths,1);assert.ok(Math.abs(p.pos.z-35)<3);report.pitRespawn=r.snapshot();
   for(const sample of runSkateTrial({...r,trial,report,get frame(){return r.frame;}},id))r.tick(sample);
   assert.equal(p.state,'finished');assert.equal(l.skateCollectathon.collected,1);
   p.respawn(l,true);assert.equal(l.skateCollectathon.collected,0);assert.ok(l.checkpoints.every(cp=>!cp.active));
  }else{
   r.until(()=>p.grounded&&p.pos.y<-7.9,{moveY:1,jumpHeld:true},{label:'Miss the rope and land on the flat recovery floor',maxFrames:500});
   assert.equal(p.totalDeaths,0);report.safeMiss=r.snapshot();
   r.until(()=>p.speed<10,{grabHeld:true,jumpHeld:true},{label:'Brake before the recovery turn'});
   go(34,p.pos.z+25);go(34,54);
   r.until(()=>p.grounded,{moveY:1,jumpHeld:true},{label:'Land the return bank before carving'});
   r.until(()=>p.speed<8,{grabHeld:true,jumpHeld:true},{label:'Set up the return junction turn'});
   go(10,57);go(0,24);
   assert.ok(p.grounded&&Math.abs(p.pos.y)<.1&&p.freeSkate);report.returned=r.snapshot();
  }
  report.passed=true;
 }catch(e){report.failure=String(e);report.atFailure=r.snapshot();throw e;}
 finally{await writeFile(`${out}/${id}.json`,JSON.stringify(report,null,2)+'\n');}
 console.log(`PASS challenge ${id}: ${id===3?'pit respawn, successful retry and hard reset':'flat-floor miss and skating return bank'}`);
},{modulePath:'/src/levels/crystal-trials.ts',source:m=>m.trialLevel(m.CRYSTAL_TRIALS.find(t=>t.id===id)),levelId:`__skate-recovery-${id}`,endlessDeaths:true,controlFrame:()=>({x:0,z:-1})});
