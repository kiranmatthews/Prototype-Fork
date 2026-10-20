import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime } from './crab-chief-harness.mjs';
await withChiefRuntime(async ({ l, p, tick }) => {
  const boss=l.boss, results=[];
  for(const endless of [false,true])for(const [phase,health,state] of [[1,7,'recover'],[2,4,'tongue-open'],[3,1,'ramp-open'],[3,0,'defeated']]){
    // Arrange an in-progress fight at the lagoon's unsupported edge. Let
    // normal falling/swimming damage, death delay and soft respawn run.
    p.respawn(l,true,false,{position:new THREE.Vector3(48,2,14)});
    p.endlessDeaths=endless;
    boss.phase=phase;boss.health=health;boss.state=state;boss.hits=9-health;
    boss.rampFormed=phase===3;boss.stateTime=0;boss.present(0);
    const lives=p.lives;
    for(let f=0;f<300&&p.state!=='dead';f++)tick();
    assert.equal(p.state,'dead',`${state}: lagoon did not kill`);
    assert.equal(p.totalDeaths,endless?1:0);assert.equal(p.lives,lives-(endless?0:1));
    for(let f=0;f<300&&p.state==='dead';f++)tick();
    assert.equal(p.state,'ride');assert.ok(p.pos.distanceTo(l.spawnPos)<.5);
    assert.equal(boss.phase,1);assert.equal(boss.health,9);assert.equal(boss.state,'waiting');
    assert.equal(boss.hits,0);assert.equal(boss.charge,0);assert.equal(boss.canFinish,false);
    assert.equal(boss.strikes.length,0);assert.equal(boss.phaseGeometry.rampActive,false);
    assert.equal(boss.phaseGeometry.tongueActive,false);assert.equal(p.masks,2);
    assert.equal(p.lives,lives-(endless?0:1),'fight reset changed life accounting');
    results.push({endless,phase,health,state,lives:p.lives,resetHealth:boss.health});
  }
  console.log(JSON.stringify(results));
  console.log('PASS real lagoon deaths restart all phases and the defeat settle at 9/9, clear transient geometry and preserve life loss.');
});
