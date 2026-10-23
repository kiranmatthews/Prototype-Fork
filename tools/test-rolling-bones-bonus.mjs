import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runRollingBonesBonus} from './rolling-bones-bonus-pilot.mjs';

await withBlockworksRuntime(async r=>{
  const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
  const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  r.report={actions:[],evidence:[]};
  assert.ok(normalizeCustomLevelData(r.source),'Moonbone remains importable and editable');
  assert.equal(resolveBonusLevel('rolling-bones'),r.source);
  assert.equal(resolveBonusLevel('secret-4'),r.source,'campaign progress alias must reach Moonbone');
  assert.equal(findLevel('bonus-rolling-bones').data,r.source);
  assert.notEqual(resolveBonusLevel('rumblewater-run'),r.source,'Ripcord keeps its own room');
  assert.equal(r.source.sky,'night');
  assert.equal(bonusCrateCount('rolling-bones'),16);
  assert.equal(r.l.totalCrates,16);
  // The scenic bones must not fill the actual bridge gaps or catch a missed jump.
  const ray=new r.THREE.Raycaster(new r.THREE.Vector3(),new r.THREE.Vector3(0,-1,0),0,.5);
  for(const x of [35.85,39.55,43.25,47.2,69.5]) {
    ray.ray.origin.set(x,x===69.5?4.3:6.1,0);
    assert.equal(r.l.raycastGround(ray).length,0,'open moonpool gap '+x);
  }
  const pilot=runRollingBonesBonus(r);
  try {
    let step;while(!(step=pilot.next()).done)r.tick(step.value);
    r.report.result=step.value;
    assert.equal(r.p.state,'finished');assert.equal(r.p.cratesBroken,16);assert.equal(r.p.totalDeaths,0);
    assert.equal(r.p.gemEarned,true,'standalone all-box finish awards its gem');
    console.log(JSON.stringify(r.report));
  } catch(error) {
    console.log(JSON.stringify({error:error.message,report:r.report,last:r.snapshot()}));throw error;
  } finally {
    await writeFile('/private/tmp/rolling-bones-bonus-journey.json',JSON.stringify({report:r.report,trace:r.trace}));
  }
},{modulePath:'/src/levels/rolling-bones-bonus.ts',levelId:'bonus-rolling-bones',source:m=>m.ROLLING_BONES_BONUS_LEVEL,
  controlFrame:()=>({x:0,z:-1}),maxFrames:12000});
