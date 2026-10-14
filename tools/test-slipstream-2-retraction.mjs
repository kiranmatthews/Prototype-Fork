// Regression for the removed opening: station zero must be reachable by
// rolling forward from the flat launch without a jump or moving support.
import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
await withBlockworksRuntime(async r => {
  assert.equal(r.l.movers.length, 0);
  assert.equal(r.sourceModule.SLIPSTREAM_2_TEMPLE.length, 0);
  assert.ok(!r.source.components.some(c => c.cameraView || c.nm === 'Solid gate facade'));
  while(r.sourceModule.slipstream2Progress(r.p.pos)<60) {
    const s=r.sourceModule.slipstream2Progress(r.p.pos);
    const dir=r.l.cameraDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z);if(dir)r.p.camDir.set(dir.x,0,dir.z);
    r.tick({...r.steerToward(r.sourceModule.slipstream2Point(s+7)),jumpHeld:true});
    assert.equal(r.p.totalDeaths,0);assert.equal(r.p.isBailing,false);
  }
  assert.equal(r.p.grounded,true);
  console.log('PASS flat reservoir start rolls directly into the course, without opening platforming');
},{modulePath:'/src/levels/slipstream-2.ts',source:m=>m.SLIPSTREAM_2_LEVEL,levelId:'slipstream-2',maxFrames:1500,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
