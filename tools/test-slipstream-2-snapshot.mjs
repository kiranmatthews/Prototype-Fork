import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
await withBlockworksRuntime(async r => {
  const m = await r.server.ssrLoadModule('/src/level.ts');
  const old = (await r.server.ssrLoadModule('/tools/fixtures/slipstream-camera/original-course.ts')).SLIPSTREAM_2_LEVEL;
  const saved = { id: 'slipstream-2', name: old.name, data: structuredClone(old) };
  const before = JSON.stringify(saved);
  assert.equal(m.isOriginalSlipstream2(saved), true);
  m.setUserLevels([saved]);
  assert.equal(m.findLevel('slipstream-2').data.components.length, r.source.components.length);
  assert.equal(m.isOverridden('slipstream-2'), false);
  assert.equal(JSON.stringify(saved), before);
  for (const edit of [e => e.name += ' edited', e => e.data.name += ' edited',
    e => e.data.components[0].p[0] += .001, e => e.data.components[0].color = '#123456',
    e => e.data.cameraAirLift = .75, e => e.data.components[0].nm = 'My platform']) {
    const custom = structuredClone(saved); edit(custom); const snapshot = JSON.stringify(custom.data);
    assert.equal(m.isOriginalSlipstream2(custom), false);
    m.setUserLevels([custom]);
    assert.equal(m.isOverridden('slipstream-2'), true);
    assert.equal(JSON.stringify(m.findLevel('slipstream-2').data), snapshot);
  }
  m.setUserLevels([]);
  console.log('PASS old published snapshot updates; renamed and edited copies retain every field');
}, { modulePath: '/src/levels/slipstream-2.ts', source: m => m.SLIPSTREAM_2_LEVEL });
