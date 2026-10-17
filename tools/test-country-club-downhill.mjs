import assert from 'node:assert/strict';import{writeFile}from'node:fs/promises';import{tmpdir}from'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={};
await withBlockworksRuntime(r=>{
 const {sourceModule:m,l,THREE}=r;
 assert.equal(m.COUNTRY_CLUB_TILT_DEGREES,4);
 for(const [x,z]of [[0,50],[200,-400],[-200,-800],[0,-1000]])assert.ok(Math.abs(m.countryClubLandHeight(x,z)-m.countryClubBaseLandHeight(x,z)-Math.tan(4*Math.PI/180)*(z-62))<1e-8);
 const start=m.countryClubPoint(7),finish=m.countryClubPoint(m.COUNTRY_CLUB_LENGTH-14);assert.ok(start[1]-finish[1]>65);assert.ok(r.source.killY<Math.min(...r.source.components.filter(c=>c.vertices&&c.solid!==false).flatMap(c=>c.vertices.filter((_,i)=>i%3===1)))-30);
 assert.ok(m.COUNTRY_CLUB_PADS.length>=20);assert.ok(m.COUNTRY_CLUB_PADS.every(p=>p.speed>=56&&p.hold>=4));
 assert.ok(m.COUNTRY_CLUB_TRACK_PITS.length>=18);assert.equal(m.COUNTRY_CLUB_GOLF_BUNKERS.length,30);
 const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,25),pits=[];
 for(const [i,pit]of m.COUNTRY_CLUB_TRACK_PITS.entries()){
  const u=pit.side*(m.countryClubWidth(pit.s)/2+pit.edgeOffset),q=m.countryClubPoint(pit.s,u),uncut=pit.edgeOffset<0?q[1]-m.countryClubTrackPitOffset(pit.s,u):m.countryClubUncutGroundHeight(q[0],q[2]);
  ray.ray.origin.set(q[0],uncut+8,q[2]);const h=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(h,`pit ${i} has no floor`);
  const depth=uncut-h.point.y;assert.ok(depth>3.1,`pit ${i} is only ${depth}m deep`);assert.equal(h.object.userData.groundSpeedLimit,2.4);
  pits.push({index:i,s:pit.s,position:[q[0],h.point.y,q[2]],depth});
 }
 const golfDepths=m.COUNTRY_CLUB_GOLF_BUNKERS.map(b=>{const y=m.countryClubUncutGroundHeight(b.x,b.z);ray.ray.origin.set(b.x,y+8,b.z);const h=ray.intersectObjects(l.groundMeshes,false)[0];const depth=h?y-h.point.y:0;return {seed:b.seed,hole:b.hole,depth,owner:h?.object.name};});
 assert.ok(golfDepths.every(p=>p.depth>2.8),'buried/shallow golf pits: '+JSON.stringify(golfDepths.filter(p=>p.depth<=2.8)));
 Object.assign(report,{tiltDegrees:4,drop:start[1]-finish[1],pads:m.COUNTRY_CLUB_PADS.length,boostSpeeds:[...new Set(m.COUNTRY_CLUB_PADS.map(p=>p.speed))],trackPits:pits,golfPits:golfDepths,killY:r.source.killY});
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club'});
// Independent initial placements isolate every pit's recovery route. All motion
// after each normal respawn is ordinary input; the race journey is tested separately.
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m,THREE}=r;const recoveries=[];
 for(const [i,pit]of m.COUNTRY_CLUB_TRACK_PITS.entries()){
  const u=pit.side*(m.countryClubWidth(pit.s)/2+pit.edgeOffset),q=m.countryClubPoint(pit.s,u),hit=report.trackPits[i].position,target=m.countryClubPoint(pit.s,-pit.side*2);
  p.respawn(l,true,false,{position:new THREE.Vector3(hit[0],hit[1]+.1,hit[2]),heading:new THREE.Vector3(...m.countryClubFrame(pit.s).f)});
  r.until(()=>p.grounded,{}, {maxFrames:120,label:`settle in pit ${i}`});const before=r.frame;
  r.until(()=>Math.hypot(p.pos.x-target[0],p.pos.z-target[2])<2.5&&p.grounded,()=>r.steerToward(target),{maxFrames:1800,label:`walk out of sand pit ${i}`});
  assert.equal(p.totalDeaths,0);recoveries.push({pit:i,seconds:(r.frame-before)*r.dt,exit:p.pos.toArray()});
 }
 report.recoveries=recoveries;
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',maxFrames:35000,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(`${tmpdir()}/country-club-downhill.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
