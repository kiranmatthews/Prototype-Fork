import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createCountryClubPilot} from './country-club-pilot.mjs';

await withBlockworksRuntime(async r=>{
  const {sourceModule:m,p,l}=r,before=JSON.stringify(r.TUNING);
  assert.equal(r.source.skateRace,undefined);
  assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
  const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.deepEqual(pack.levels.find(e=>e.id==='country-club').data,JSON.parse(JSON.stringify(r.source)));
  const pilot=createCountryClubPilot(m,{nodeCamera:true,shortcut:process.argv.includes('--shortcut'),ridge:process.argv.includes('--ridge')});
  let error=null;
  try{while(p.state!=='finished'){r.tick(pilot.sample(p,l));pilot.observe(p,l);}}catch(e){error=String(e);}
  const report={length:m.COUNTRY_CLUB_LENGTH,seconds:r.frame*r.dt,state:p.state,deaths:p.totalDeaths,
    position:p.pos.toArray(),evidence:pilot.evidence,error,traceTail:r.trace.slice(-30)};
  const variant=process.argv.includes('--shortcut')?'shortcut':process.argv.includes('--ridge')?'ridge':'main';
  await writeFile(`${tmpdir()}/country-club-${variant}.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,traceTail:undefined},null,2));
  assert.equal(error,null);assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);
  assert.deepEqual(pilot.evidence.checkpoints,[0,1,2,3,4,5,6]);
  assert.equal(pilot.evidence.jumps.length,2);
  assert.ok(pilot.evidence.jumps.every(j=>j.airSeen));
  assert.equal(JSON.stringify(r.TUNING),before);
  if(variant==='shortcut'){assert.ok(pilot.evidence.shortcutFrames>100);assert.ok(pilot.evidence.shortcutJump?.airSeen);}
  if(variant==='ridge'){assert.ok(pilot.evidence.railFrames>60);assert.ok(pilot.evidence.crystal);}
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',endlessDeaths:true,maxFrames:16000,
  controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
