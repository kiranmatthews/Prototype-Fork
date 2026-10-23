import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallGapFixtures,createMallGapPilot} from './mall-measured-gap-pilot.mjs';
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,defaults=JSON.stringify(r.TUNING),fixtures=[];
 for(const f of mallGapFixtures){
  const q=m.mallPoint(...f.start);q[1]=m.mallSupport(q[0],q[2],q[1]+.4)+.1;assert.ok(Number.isFinite(q[1]));
  const heading=new THREE.Vector3(...f.heading).normalize();p.respawn(l,true,false,{position:new THREE.Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const pilot=createMallGapPilot(f,m.MALL_RAILS),rail=()=>p.grindRail?l.rails.indexOf(p.grindRail):null;
  while(!pilot.e.done){r.tick(pilot.sample(p,m.mallSourcePoint(...p.pos.toArray()),rail()));pilot.observe(p,m.mallSourcePoint(...p.pos.toArray()),rail());}
  fixtures.push(pilot.e);console.log(JSON.stringify({...pilot.e,trace:undefined}));
 }
 const report={fixtures,tuningUnchanged:defaults===JSON.stringify(r.TUNING)};
 await writeFile('/private/tmp/mall-recreation/measured/gaps.json',JSON.stringify(report,null,2));
 assert.ok(report.tuningUnchanged);assert.ok(fixtures.every(f=>f.reached&&!f.bail));
 const tape=fixtures.find(f=>f.kind==='tape');assert.deepEqual(tape.rails,tape.expectedRails);assert.ok(tape.approachFrames>100&&tape.beamFrames>300&&tape.beamDistance>120);
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:5000,controlFrame:r=>r.p.axisF});
