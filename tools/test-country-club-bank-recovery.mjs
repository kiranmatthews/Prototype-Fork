import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
for(const start of [[117.12,-7.8,-212.55],[78.9,-34.3,-562.36]])await withBlockworksRuntime(async r=>{
  r.p.beginRaceStun(0,1);
  for(let i=0;i<600;i++)r.tick({});
  const out={start,p:r.p.pos.toArray(),bailing:r.p.skateCameraBailing,bailTime:r.p.bailTimeLeft,
    grounded:r.p.grounded,normal:r.p.groundHit?.normal.toArray(),ground:r.p.groundHit?.name,speed:r.p.speed,
    slipping:r.p.slipping,onTransition:r.p.onTransition};console.log(JSON.stringify(out));
  assert.equal(r.p.skateCameraBailing,false,'A normal wipeout must slide to usable ground and finish recovery');
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',start,maxFrames:650});
