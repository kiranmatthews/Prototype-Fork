import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createCountryClubPilot} from './country-club-pilot.mjs';
const opts={modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club',endlessDeaths:true,
  controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir};
await withBlockworksRuntime(r=>{
  const {p,l,sourceModule:m,THREE}=r;
  let checks=0;
  for(let s=8;s<m.COUNTRY_CLUB_LENGTH-20;s+=2){
    if(m.COUNTRY_CLUB_GAPS.some(g=>s>g.a-.1&&s<g.b+.1))continue;
    const o=m.COUNTRY_CLUB_SLALOM.find(o=>Math.abs(o.s-s)<16);
    for(const offset of o?[-o.side*3.6]:[-2,0,2]){
      const q=m.countryClubPoint(s,offset),ray=new THREE.Raycaster(new THREE.Vector3(q[0],q[1]+.2,q[2]),new THREE.Vector3(0,-1,0),0,.5);
      assert.ok(ray.intersectObjects(l.groundMeshes,false).some(h=>Math.abs(h.point.y-q[1])<.08),`Unsupported road ${s}/${offset}`);checks++;
    }
  }
  const pilot=createCountryClubPilot(m,{nodeCamera:true});
  while(pilot.progress<m.COUNTRY_CLUB_CHECKPOINTS[4]+4){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
  assert.ok(l.checkpoints[4].active);
  // A wrong turn from the real checkpoint enters the void. Let the native
  // death/fade/respawn complete; never directly call respawn or bank a crate.
  const target=m.countryClubPoint(m.COUNTRY_CLUB_CHECKPOINTS[4]+17,35);
  while(!p.totalDeaths){r.tick({...r.steerToward(target),jumpHeld:true});assert.ok(r.frame<9000);}
  const diedAt=r.frame;
  r.until(()=>p.state==='ride'&&p.grounded,{}, {allowDeath:true,maxFrames:500,label:'normal pit recovery'});
  assert.ok(p.pos.distanceTo(l.checkpoints[4].spawnPos)<2);
  assert.equal(l.activeCheckpoint,l.checkpoints[4]);
  r.stepFor(60,{moveY:1,jumpHeld:true});assert.ok(p.grounded&&!p.isBailing);
  console.log(JSON.stringify({roadSupportSamples:checks,deathCount:p.totalDeaths,returnSeconds:(r.frame-diedAt-60)*r.dt,checkpoint:4,canContinue:true}));
},opts);
await withBlockworksRuntime(r=>{
  const {p,l,sourceModule:m}=r;
  const pilot=createCountryClubPilot({...m,COUNTRY_CLUB_SLALOM:[]},{nodeCamera:true});
  // The same centre-line input must collide with the alternating bunker nose.
  // The positive journey proves the deliberately open opposite side works.
  while(!p.isBailing&&p.state!=='dead'&&r.frame<1000){r.tick(pilot.sample(p,l));pilot.observe(p,l);}
  assert.ok(p.isBailing||p.state==='dead','Bunker intrusion did not require any line choice');
  assert.ok(pilot.progress<m.COUNTRY_CLUB_SLALOM[0].s+8);
  console.log('PASS bunker centre-line collision; opposite-side slalom verified by the complete journey.');
},opts);
