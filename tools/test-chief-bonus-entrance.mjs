import assert from 'node:assert/strict';
import * as THREE from 'three';
import { withChiefRuntime } from './crab-chief-harness.mjs';
await withChiefRuntime(async ({l,p,tick,source,module}) => {
  assert.ok(!source.components.some(component=>component.t==='bonusplatform'));
  assert.equal(l.allowsBonus,false);
  assert.equal(l.bonusPlatformDiagnostics,null);
  assert.equal(l.bonusCrateTotal,0);assert.equal(l.crystalPickup,null);assert.equal(l.warpPads.length,0);
  for(let i=0;i<30;i++)tick();
  assert.ok(p.grounded);
  // An older editor export cannot restore its boss's retired entrance.
  const copied = {...source,components:[...source.components,
    {t:'bonusplatform',p:[0,0,15],to:[0,.1,15]}, {t:'crystal',p:[0,1,15]}]};
  const clone = new module.Level(new THREE.Scene(),{id:'editor-chief-copy',name:copied.name,data:copied});
  try {
    await clone.prepareJungleAssets();
    assert.equal(clone.allowsBonus,false);
    assert.equal(clone.bonusPlatformDiagnostics,null);
    assert.equal(clone.bonusCrateTotal,0);assert.equal(clone.crystalPickup,null);assert.equal(clone.warpPads.length,0);
    assert.equal(clone.consumeBonusLanding(new THREE.Vector3(0,1.05,15),{enabled:true,grounded:true,jump:true,rising:true}),false);
  } finally {clone.dispose();}
  console.log('PASS boss source, automatic-pad exclusion and old editor-copy exclusion; supported arrival and zero bonus-box tally.');
});
