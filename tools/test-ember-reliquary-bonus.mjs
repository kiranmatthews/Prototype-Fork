import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runEmberReliquaryJourney} from './ember-reliquary-pilot.mjs';

await withBlockworksRuntime(async r=>{
  const {normalizeCustomLevelData,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
  const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
  r.report={actions:[],evidence:[]};
  assert.ok(normalizeCustomLevelData(r.source),'Ember Reliquary remains importable and editable');
  assert.equal(resolveBonusLevel('jungle-terraces'),r.source);
  assert.equal(resolveBonusLevel('secret-2'),r.source,'the secret-slot alias must reach the reliquary');
  assert.equal(findLevel('bonus-jungle-terraces').data,r.source);
  assert.equal(r.source.sky,'night');
  assert.equal(bonusCrateCount('jungle-terraces'),17);
  assert.equal(r.l.totalCrates,17);
  assert.equal(r.l.fireTikis.length,1,'one sentinel breathes across the lane');
  // The chasm stays open until the high switch is struck.
  const ray=new r.THREE.Raycaster(new r.THREE.Vector3(),new r.THREE.Vector3(0,-1,0),0,.5);
  for(const x of [63,68,73]){ray.ray.origin.set(x,.1,0);assert.equal(r.l.raycastGround(ray).length,0,'open chasm at '+x);}
  const pilot=runEmberReliquaryJourney(r);
  try{
    let step;while(!(step=pilot.next()).done)r.tick(step.value);
    r.report.result=step.value;
    assert.equal(r.p.state,'finished');assert.equal(r.p.cratesBroken,17);assert.equal(r.p.totalDeaths,0);
    assert.equal(r.p.gemEarned,true,'standalone all-box finish awards its gem');
    console.log(JSON.stringify(r.report.result));
  }catch(error){
    console.log(JSON.stringify({error:error.message,report:r.report,last:r.snapshot()}));throw error;
  }finally{
    await writeFile('/private/tmp/ember-reliquary-journey.json',JSON.stringify({report:r.report,trace:r.trace}));
  }
},{modulePath:'/src/levels/ember-reliquary-bonus.ts',levelId:'bonus-jungle-terraces',source:m=>m.EMBER_RELIQUARY_BONUS_LEVEL,
  controlFrame:()=>({x:0,z:-1}),maxFrames:14000});
