import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallRailFixtures,createMallRailPilot} from './mall-measured-rail-pilot.mjs';

// Each section begins at rest on a measured floor. Every later state is the
// result of ordinary controller samples, including the ollie and rail exit.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,report={paths:0,edges:0,maxNodeError:0,fixtures:[]};
 assert.equal(l.rails.length,m.MALL_RAILS.length);
 for(const [i,source] of m.MALL_RAILS.entries()){
  const rail=l.rails[i];assert.equal(rail.closed,source.closed);
  for(const q of source.points){const error=rail.closest(new THREE.Vector3(...q)).distance;report.maxNodeError=Math.max(report.maxNodeError,error);assert.ok(error<.0001,`Rail ${i} moved from its source node`);}
  report.paths++;report.edges+=source.points.length-1+Number(source.closed);
 }
 assert.equal(report.edges,214);
 for(const f of mallRailFixtures){
  const start=m.mallPoint(...f.start),heading=new THREE.Vector3(...f.direction);
  start[1]=m.mallSupport(start[0],start[2],start[1]+.4)+.1;assert.ok(Number.isFinite(start[1]),f.name);
  p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const pilot=createMallRailPilot(f,m,l,p,THREE.Vector3);
  while(!pilot.e.done){r.tick(pilot.sample());pilot.observe();}
  report.fixtures.push(pilot.e);
 }
 await writeFile('/private/tmp/mall-recreation/measured/rails.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,fixtures:report.fixtures.map(({trace,...f})=>f)}));
 const full=report.fixtures.find(f=>f.name==='Concourse display, both bends and outward exit');assert.deepEqual(full.crossedNodes,[59,60]);assert.ok(full.grindDistance>38&&full.groundFrames===30);
 assert.ok(report.fixtures.every(f=>f.rails.includes(f.targetRail)&&f.grindFrames>=20&&f.grindDistance>3&&f.landed&&!f.bail),'Measured rails need an ordinary-input catch, sustained grind and clean exit');
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:4000,controlFrame:r=>r.p.axisF});
