import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';

const data = {v: 1, name: 'Source coping departure', skatepark: true,
  skateReference: {kind: 'thps1', metresPerUnit: .01808, stats: {ollie: 4, speed: 8, air: 8}},
  spawn: [0, .05, 20], killY: -30, components: [
    {t: 'platform', p: [0, -.5, 0], s: [100, 1, 100], edgeGrinding: false},
    {t: 'rail', p: [15, 1, 0], len: 10, coping: true}, {t: 'gate', p: [40, 0, -40]},
  ]};
await withBlockworksRuntime(async r => {
  const {p, l} = r, rail = l.rails[0], reference = l.skateReferencePhysics, fixtures = [];
  const tuning = JSON.stringify(r.TUNING);
  for (const f of [
    {name: 'Fresh source roll-off across coping', source: true, coping: true, rose: false, grace: .08, smack: false},
    {name: 'Source ollie descends onto coping', source: true, coping: true, rose: true, grace: .08, smack: true},
    {name: 'Source fall after departure grace', source: true, coping: true, rose: false, grace: 0, smack: true},
    {name: 'Source roll-off onto a separate bar', source: true, coping: false, rose: false, grace: .08, smack: true},
    {name: 'Existing level retains its contact rule', source: false, coping: true, rose: false, grace: .08, smack: true},
  ]) {
    l.skateReferencePhysics = f.source ? reference : undefined;
    p.respawn(l, true, false); rail.coping = f.coping;
    // Independent crossing fixtures exercise the production contact method.
    // The complete Mall route test separately uses only device input.
    const q = rail.pointAt(rail.totalLength / 2);
    p.pos.copy(q); p.pos.y -= .05;
    p.prevPos.copy(q); p.prevPos.y += .2;
    p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
    p.speed = 20; p.vVel = -25; p.airRose = f.rose; p.coyoteTimer = f.grace;
    p.regrindCd = p.vertLandGraceT = 0; p.vertAir = p.pipeHang = false;
    const smack = p.railLandSmack(makeInput(), l);
    fixtures.push({...f, actualSmack: smack}); assert.equal(smack, f.smack, f.name);
  }
  assert.equal(JSON.stringify(r.TUNING), tuning);
  await writeFile('/private/tmp/mall-recreation/measured/reference-coping.json', JSON.stringify({fixtures, tuningUnchanged: true}, null, 2));
  console.log('PASS fresh coping roll-off; real jump, late fall, ordinary bar and existing-level contacts retained.');
}, {modulePath: '/src/levels/mall-measured.ts', source: () => data, levelId: 'reference-coping', maxFrames: 1});
