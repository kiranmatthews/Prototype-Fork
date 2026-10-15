import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createCountryClubPilot} from './country-club-pilot.mjs';
const reports=[];
const options={modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',endlessDeaths:true,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir};
await withBlockworksRuntime(r=>{
 const {l,sourceModule:m,THREE}=r;let landscape=0,fairway=0;
 const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,35),b=m.COUNTRY_CLUB_BOUNDS;
 for(let x=b.minX+12;x<b.maxX;x+=24)for(let z=b.minZ+12;z<b.maxZ;z+=24){
  ray.ray.origin.set(x,m.countryClubLandHeight(x,z)+12,z);
  assert.ok(ray.intersectObjects(l.groundMeshes,false).length,`Hole in continuous landscape: ${x}/${z}`);landscape++;
 }
 for(let s=8;s<m.COUNTRY_CLUB_LENGTH-20;s+=3){
  if(m.COUNTRY_CLUB_GAPS.some(g=>s>g.a-.2&&s<g.b+.2))continue;
  const o=m.COUNTRY_CLUB_SLALOM.find(o=>Math.abs(o.s-s)<23);
  for(const u of o?[-o.side*5.2]:[-2,0,2]){
   const q=m.countryClubPoint(s,u);ray.ray.origin.set(q[0],q[1]+.3,q[2]);ray.far=.6;
   assert.ok(ray.intersectObjects(l.groundMeshes,false).some(h=>Math.abs(h.point.y-q[1])<.08&&!h.object.userData.groundSpeedLimit),`Fast fairway missing ${s}/${u}`);fairway++;
  }
 }
 assert.ok([...l.surfaceEdgeOwners.values()].every(mesh=>mesh.userData.groundSpeedLimit===undefined),'soft terrain created a fast grind shortcut');
 reports.push({test:'continuous terrain and fairway support',landscapeSamples:landscape,fairwaySamples:fairway,softGroundHasNoGrindEdges:true});
},options);
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r,pilot=createCountryClubPilot({...m,COUNTRY_CLUB_SLALOM:[]},{nodeCamera:true});
 let slow=0,min=Infinity;
 while(pilot.progress<m.COUNTRY_CLUB_SLALOM[0].s+35){r.tick(pilot.sample(p,l));pilot.observe(p,l);if(p.groundHit?.groundSpeedLimit){slow++;min=Math.min(min,p.speed);}}
 assert.ok(slow>150&&min<=2.401,'centre line bypassed the bunker penalty');assert.equal(p.totalDeaths,0);
 reports.push({test:'recoverable bunker line-choice penalty',slowFrames:slow,minimumSpeed:min});
},options);
for(let i=0;i<4;i++){
 const opts={...options,source:m=>{const p=m.COUNTRY_CLUB_PONDS[i];opts.start=[p.x,p.y+.2,p.z];return m.COUNTRY_CLUB_LEVEL;}};
 await withBlockworksRuntime(r=>{
  const {p,l,sourceModule:m}=r,pool=m.COUNTRY_CLUB_PONDS[i];
  r.until(()=>p.state==='swim',{}, {maxFrames:90,label:'enter real pond water'});
  const target=[pool.x+pool.rx*1.35,m.countryClubLandHeight(pool.x+pool.rx*1.35,pool.z),pool.z];
  r.until(()=>p.state==='ride'&&p.grounded,()=>({...r.steerToward(target),jumpHeld:true}),{maxFrames:2200,label:'swim out through the sloped bank'});
  assert.equal(p.totalDeaths,0);reports.push({test:'pond escape',pond:i,seconds:r.frame*r.dt,position:p.pos.toArray()});
 },opts);
}
const boundary={...options,source:m=>{const x=m.COUNTRY_CLUB_BOUNDS.maxX-1;boundary.start=[x,m.countryClubGroundHeight(x,0)+.1,0];return m.COUNTRY_CLUB_LEVEL;}};
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r,target=[m.COUNTRY_CLUB_BOUNDS.maxX+30,0,0];
 r.charge(32);r.releaseJump(r.steerToward(target));
 r.until(()=>p.totalDeaths===1,()=>r.steerToward(target),{allowDeath:true,maxFrames:600,label:'outer-world fall'});
 r.until(()=>p.state==='ride'&&p.grounded,{}, {allowDeath:true,maxFrames:400,label:'normal respawn'});
 assert.ok(p.pos.distanceTo(l.spawnPos)<1.5);reports.push({test:'outer-boundary pit respawn',deaths:1,returnedToSupportedSpawn:true});
},boundary);
await writeFile(`${tmpdir()}/country-club-recovery.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
