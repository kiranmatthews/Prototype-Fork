import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
const options={modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',endlessDeaths:true,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir};
for(let i=0;i<5;i++){
 const opts={...options,source:m=>{const p=m.COUNTRY_CLUB_PONDS[i];opts.start=[p.x+p.r[0]*p.rx*.7,p.y+.2,p.z+p.r[2]*p.rx*.7];return m.COUNTRY_CLUB_LEVEL;}};
 await withBlockworksRuntime(r=>{
  const {p,l,sourceModule:m}=r,pool=m.COUNTRY_CLUB_PONDS[i];
  r.until(()=>p.state==='swim',{}, {maxFrames:90,label:'enter real pond water'});
  const target=[pool.x+pool.r[0]*pool.rx*1.4,pool.y+1,pool.z+pool.r[2]*pool.rx*1.4];
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
