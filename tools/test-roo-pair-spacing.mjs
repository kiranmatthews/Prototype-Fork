import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const storage = new Map([['solProtoRooAppearanceV4', JSON.stringify({ tracking: -.065, shimmer: false, lightStrength: .7 })]]);
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = new EventTarget();
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: { server: createHttpServer() } }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
const close = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-10, `${message}: ${a} ≠ ${b}`);
try {
  const { layoutRooAtlas } = await server.ssrLoadModule('/src/roo-type/atlasLayout.ts');
  const { ROO_ATLAS_METRICS } = await server.ssrLoadModule('/src/roo-type/atlas-metrics.ts');
  const { normalizeRooPairs, pairsInText, parseRooPairs, exportRooPairs } = await server.ssrLoadModule('/src/roo-type/kerning.ts');
  const { getRooAppearance, setRooAppearance, rooAppearanceIsSaved, ROO_APPEARANCE_KEY, ROO_APPEARANCE_EVENT } = await server.ssrLoadModule('/src/roo-type/settings.ts');
  assert.deepEqual(getRooAppearance().pairSpacing, {}, 'old browser settings gain an empty pair map');
  assert.equal(getRooAppearance().tracking, -.065);
  assert.equal(getRooAppearance().shimmer, false);
  const clean = normalizeRooPairs({ AV: -.0714, VA: .9, aa: 1, A: .1, ABC: .1, ZZ: Infinity, 'A♥': .1, BO: '1', ON: 0 });
  assert.deepEqual(clean, { AV: -.071, VA: .3 }); assert.ok(Object.isFrozen(clean));
  for (const invalid of [null, [], 'pairs', 5]) assert.deepEqual(normalizeRooPairs(invalid), {});
  assert.deepEqual(pairsInText('avava 0/23 ♥'), ['AV', 'VA', 'A ', ' 0', '0/', '/2', '23', '3 ']);
  assert.deepEqual(parseRooPairs(exportRooPairs(clean)), clean);
  const validImport = { format: 'roo-pair-spacing', version: 1, units: 'cap-height', pairs: { AV: 0 } };
  assert.deepEqual(parseRooPairs(JSON.stringify(validImport)), { AV: 0 }, 'zero imports clear an existing edit');
  for (const bad of [null, [], {}, { ...validImport, version: 2 }, { ...validImport, units: 'px' },
    { ...validImport, pairs: { AA: .31 } }, { ...validImport, pairs: { A: 0 } },
    { ...validImport, pairs: { AV: '0.1' } }, { ...validImport, pairs: [] }]) assert.throws(() => parseRooPairs(JSON.stringify(bad)));
  for (const metrics of Object.values(ROO_ATLAS_METRICS)) {
    const baseline = layoutRooAtlas(metrics, 'AVAVA', -.065), edited = layoutRooAtlas(metrics, 'avava', -.065, { AV: -.07, VA: .02 });
    for (const [i, offset] of [0, -.07, -.05, -.12, -.1].entries()) {
      close(edited.glyphs[i].x - baseline.glyphs[i].x, offset, 'directional repeated-pair accumulation');
      assert.equal(edited.glyphs[i].sx, baseline.glyphs[i].sx); assert.equal(edited.glyphs[i].sy, baseline.glyphs[i].sy);
    }
    close(edited.width - baseline.width, -.1, 'width follows pair placement');
    assert.deepEqual(layoutRooAtlas(metrics, 'GAME', -.065, { AV: -.1 }), layoutRooAtlas(metrics, 'GAME', -.065), 'unrelated words remain identical');
    assert.deepEqual(layoutRooAtlas(metrics, 'A V', -.065, { AV: -.1 }), layoutRooAtlas(metrics, 'A V', -.065), 'edits cannot cross spaces');
    close(layoutRooAtlas(metrics, 'A V', -.065, { 'A ': .04, ' V': .02 }).width - layoutRooAtlas(metrics, 'A V', -.065).width, .06, 'space pairs');
    close(layoutRooAtlas(metrics, '23', -.065, { '23': -.05 }).glyphs[1].x - layoutRooAtlas(metrics, '23', -.065).glyphs[1].x, -.05, 'built-in number kerning is retained');
    const bonus = layoutRooAtlas(metrics, 'BONUS', -.065), bonusEdit = layoutRooAtlas(metrics, 'BONUS', -.065, { BO: -.03, ON: .02 });
    for (let i = 0; i < bonus.glyphs.length; i++) {
      close(bonusEdit.glyphs[i].x - bonus.glyphs[i].x, i === 0 ? 0 : i === 1 ? -.03 : -.01, 'optical BONUS pair offsets');
      assert.equal(bonusEdit.glyphs[i].sx, bonus.glyphs[i].sx); assert.equal(bonusEdit.glyphs[i].sy, bonus.glyphs[i].sy);
      assert.equal(bonusEdit.glyphs[i].y, bonus.glyphs[i].y);
    }
    close(bonusEdit.width - bonus.width, -.01, 'optical BONUS bounds');
    assert.equal(layoutRooAtlas(metrics, '♥', 0, {}), null);
    assert.equal(layoutRooAtlas(metrics, '', 0, {}).width, 0);
  }
  let notifications = 0; window.addEventListener(ROO_APPEARANCE_EVENT, () => notifications++);
  setRooAppearance({ pairSpacing: { AV: -.07, BO: -.03 } });
  setRooAppearance({ tracking: -.05 });
  assert.deepEqual(getRooAppearance().pairSpacing, { AV: -.07, BO: -.03 }, 'global spacing edits keep pair adjustments');
  assert.deepEqual(JSON.parse(storage.get(ROO_APPEARANCE_KEY)).pairSpacing, getRooAppearance().pairSpacing);
  assert.equal(notifications, 2); assert.equal(rooAppearanceIsSaved(), true);
  const save = localStorage.setItem;
  localStorage.setItem = () => { throw Error('Quota exceeded'); };
  setRooAppearance({ pairSpacing: { AV: .1 } });
  assert.equal(rooAppearanceIsSaved(), false); assert.equal(getRooAppearance().pairSpacing.AV, .1);
  localStorage.setItem = save;
  storage.set(ROO_APPEARANCE_KEY, JSON.stringify({ pairSpacing: { AV: -.1 }, tracking: -.06 }));
  const event = new Event('storage'); event.key = ROO_APPEARANCE_KEY; window.dispatchEvent(event);
  assert.equal(getRooAppearance().pairSpacing.AV, -.1); assert.equal(rooAppearanceIsSaved(), true);
  storage.clear(); const clear = new Event('storage'); clear.key = null; window.dispatchEvent(clear);
  assert.deepEqual(getRooAppearance().pairSpacing, {}, 'clearing storage updates open text');
  console.log('PASS pair direction, repetition, spaces, numeric kerning, optical BONUS, import validation, persistence, migration, storage errors and cross-tab refresh.');
} finally { await server.close(); }
