import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report=[];
const opts={modulePath:'/src/levels/country-club.ts',source:m=>{opts.start=m.countryClubPoint(510,7,.1);opts.heading=m.countryClubFrame(510).f;return m.COUNTRY_CLUB_LEVEL;},levelId:'country-club',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir};
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r;let s=510,min=Infinity;
 const enemy=l.enemies[0];assert.ok(enemy.alive);
 while(s<610){
  const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);
  s=m.countryClubProgress(p.pos,s);
  r.tick({...r.steerToward(m.countryClubPoint(s+8,7)),jumpHeld:true,spinHeld:enemy.group.position.distanceTo(p.pos)<8&&r.frame%24<12});
  if(s>580)min=Math.min(min,p.speed);assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);
 }
 assert.equal(enemy.alive,false,'placeholder encounter did not respond to a real passing spin');assert.ok(min>22,'enemy required braking: '+min);
 report.push({test:'full-speed passing spin',kind:enemy.kind,defeated:true,minimumSpeed:min,deaths:p.totalDeaths});
},opts);
const bunker={...opts,source:m=>{bunker.start=m.countryClubPoint(180,-9,.1);bunker.heading=m.countryClubFrame(180).f;return m.COUNTRY_CLUB_LEVEL;}};
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r;let s=180,softFrames=0,minimum=Infinity;
 while(s<280){
  const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);
  s=m.countryClubProgress(p.pos,s);r.tick({...r.steerToward(m.countryClubPoint(s+8,-9)),jumpHeld:true});
  if(p.grounded&&p.groundHit?.groundSpeedLimit){softFrames++;minimum=Math.min(minimum,p.speed);}
  assert.equal(p.totalDeaths,0);
 }
 assert.ok(softFrames>300&&minimum<=2.401);assert.ok(p.speed>18,'bunker exit did not restore speed');
 report.push({test:'rounded bunker penalty and recovery',softFrames,minimumSpeed:minimum,exitSpeed:p.speed,deaths:p.totalDeaths});
},bunker);
await writeFile(`${tmpdir()}/country-club-encounter.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
