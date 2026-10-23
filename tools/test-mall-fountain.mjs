import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMallPilot} from './mall-pilot.mjs';

// A two-metre takeoff window must work from the real spawn with ordinary
// controller input. No velocity, jump impulse, or tuning overrides.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,before=JSON.stringify(r.TUNING),runs=[];
 for(const fountainEntry of [66.5,67.5,68.5]){
  p.respawn(l,true,false,{position:new THREE.Vector3(...r.source.spawn),heading:new THREE.Vector3(0,0,-1)});
  const pilot=createMallPilot(m,{route:'upper',fountainEntry}),first=r.trace.length;
  for(let i=0;i<900&&pilot.progress<100;i++){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
  const trace=r.trace.slice(first),jumps=pilot.evidence.jumps.filter(j=>j.name.startsWith('Fountain'));
  const contacts=trace.filter(v=>v.grounded&&v.ground?.name==='Fountain passage floor');
  const run={fountainEntry,progress:pilot.progress,state:p.state,deaths:p.totalDeaths,bails:pilot.evidence.bails,
   minimumMovingSpeed:pilot.evidence.minimumMovingSpeed,contacts:contacts.length,jumps};runs.push(run);
  await writeFile(`/private/tmp/mall-recreation/fountain-${fountainEntry}-trace.json`,JSON.stringify(trace));
 }
 // A ground-level approach must collide with each solid upright. This
 // placement isolates body collision; the route tests start at level spawn.
 const uprights=[];
 for(const u of [-2.05,2.05]){
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(69,u,12.5)),heading:new THREE.Vector3(0,0,-1)});
  let furthest=69,closest=p.pos.toArray();
  for(let i=0;i<100;i++){
   r.tick({moveY:1,jumpHeld:true});const s=m.mallProject(p.pos.x,p.pos.z,69);
   if(s>furthest){furthest=s;closest=p.pos.toArray();}
  }
  uprights.push({u,furthest,closest,end:p.pos.toArray(),state:p.state});
 }
 const report={runs,uprights,tuningUnchanged:JSON.stringify(r.TUNING)===before};
 await writeFile('/private/tmp/mall-recreation/fountain.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 for(const v of runs){
  assert.ok(v.progress>=100&&v.deaths===0&&v.bails===0,'Each takeoff must reach the upper gallery cleanly');
  assert.ok(v.contacts>=2,'Each takeoff must genuinely land inside the monument');
  assert.ok(v.jumps.length===2&&v.jumps.every(j=>j.air),'Each line must include two distinct flights');
  assert.ok(v.jumps[0].landing>=73.2&&v.jumps[0].landing<=78.8,'The first landing belongs inside the passage');
  assert.ok(v.minimumMovingSpeed>12,'Both jumps must preserve useful skating speed');
 }
 assert.ok(uprights.every(v=>v.furthest>=72.5&&v.furthest<73.3&&Math.abs(v.closest[0]-v.u)<.25),
  'Each ground-level approach must reach its upright and stop at the front face');
 assert.equal(report.tuningUnchanged,true);
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:3500,controlFrame:r=>r.p.axisF});
