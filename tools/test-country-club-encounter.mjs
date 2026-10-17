import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report=[];
const opts={modulePath:'/src/levels/country-club.ts',source:m=>{opts.start=m.countryClubPoint(m.COUNTRY_CLUB_ENCOUNTERS[0].s-80,7,.1);opts.heading=m.countryClubFrame(m.COUNTRY_CLUB_ENCOUNTERS[0].s-80).f;return m.COUNTRY_CLUB_LEVEL;},levelId:'country-club',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir};
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r;let s=m.COUNTRY_CLUB_ENCOUNTERS[0].s-80,min=Infinity;
 const enemy=l.enemies[0];assert.ok(enemy.alive);
 while(s<m.COUNTRY_CLUB_ENCOUNTERS[0].s+25){
  const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);
  s=m.countryClubProgress(p.pos,s);
  const d=enemy.group.position.distanceTo(p.pos),target=enemy.alive&&d<12?enemy.group.position:m.countryClubPoint(s+8,7);
  r.tick({...r.steerToward(target),jumpHeld:true,spinHeld:enemy.alive&&d<5.5});
  if(s>m.COUNTRY_CLUB_ENCOUNTERS[0].s-10)min=Math.min(min,p.speed);assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);
 }
 assert.equal(enemy.alive,false,'placeholder encounter did not respond to a real passing spin');assert.ok(min>22,'enemy required braking: '+min);
 report.push({test:'full-speed passing spin',kind:enemy.kind,defeated:true,minimumSpeed:min,deaths:p.totalDeaths});
},opts);
const bunker={...opts,source:m=>{const first=m.COUNTRY_CLUB_SLALOM[0],u=first.side*(m.countryClubWidth(first.s)/2+first.edgeOffset);bunker.start=m.countryClubPoint(first.s-45,u,.1);bunker.heading=m.countryClubFrame(m.COUNTRY_CLUB_SLALOM[0].s-45).f;return m.COUNTRY_CLUB_LEVEL;}};
await withBlockworksRuntime(r=>{
 const {p,l,sourceModule:m}=r;let s=m.COUNTRY_CLUB_SLALOM[0].s-45,softFrames=0,minimum=Infinity;
 while(s<m.COUNTRY_CLUB_SLALOM[0].s+55){
  const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);
  s=m.countryClubProgress(p.pos,s);const first=m.COUNTRY_CLUB_SLALOM[0],u=first.side*(m.countryClubWidth(first.s)/2+first.edgeOffset);r.tick({...r.steerToward(m.countryClubPoint(s+8,u)),jumpHeld:true});
  if(p.grounded&&p.groundHit?.groundSpeedLimit){softFrames++;minimum=Math.min(minimum,p.speed);}
  assert.equal(p.totalDeaths,0);
 }
 assert.ok(softFrames>300&&minimum<=2.401);assert.ok(p.speed>18,'bunker exit did not restore speed');
 report.push({test:'rounded bunker penalty and recovery',softFrames,minimumSpeed:minimum,exitSpeed:p.speed,deaths:p.totalDeaths});
},bunker);
await writeFile(`${tmpdir()}/country-club-encounter.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
