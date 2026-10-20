import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime } from './crab-chief-harness.mjs';

// Arrange phase three before each attempt, then use only production input
// through the complete run-up, supported ramp, jump/spin and rebound.
await withChiefRuntime(async ({ l, p, tick }) => {
  const boss=l.boss, results=[];
  for(const x of [-1.5,0,1.5])for(const release of [-13,-14,-15,-16,-17,-18,-99]){
    p.respawn(l,true,false,{position:new THREE.Vector3(x,.12,7)});
    boss.phase=3;boss.health=3;boss.state='ramp-open';boss.rampFormed=true;boss.present(0);
    let released=false, supported=false, takeoff=null;
    for(let frame=0;frame<360&&!boss.hits;frame++){
      supported ||= p.grounded && p.groundHit?.mesh===boss.phaseGeometry.sandRamp;
      if(p.pos.z<release)released=true;
      tick({moveY:1,jumpHeld:!released,spinPressed:p.state==='air'&&p.pos.z<-19&&frame%10===0});
      if(p.state==='air'&&!takeoff)takeoff=p.pos.toArray();
    }
    assert.ok(supported,`x=${x}, release=${release}: no real ramp contact`);
    assert.equal(boss.hits,1,`x=${x}, release=${release}: visible ramp spin failed to damage the chief`);
    assert.equal(boss.health,2);assert.equal(boss.strikes[0].kind,'sand-spin');
    assert.ok(boss.strikes[0].rampSpeed>=boss.phaseGeometry.requiredSpeed);
    assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);
    assert.equal(p.state,'air');assert.ok(p.axisF.z>0,'successful hit did not rebound into the arena');
    for(let i=0;i<12;i++)tick();assert.equal(boss.hits,1,'one spin removed multiple health segments');
    results.push({x,release,takeoff,rampSpeed:boss.strikes[0].rampSpeed});
  }
  console.log(JSON.stringify(results));
  console.log(`PASS ${results.length} real phase-three ramp approaches: early/late ollies and natural launches, earned spin hit, one segment and safe rebound.`);
});
