import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } });
const levels = [];
try {
  const { Level, BUILTIN_LEVELS, migrateCustomLevel, normalizeCustomLevelData, parseCustomLevelJson, starterCustomLevel, setEditorBuild } = await server.ssrLoadModule('/src/level.ts');
  const { isOriginalTestCourse } = await server.ssrLoadModule('/src/levels/carlisleLegacy.ts');
  const originalTest = JSON.parse(await readFile(new URL('carlisle-coast/original-course.json', import.meta.url), 'utf8'));
  const retiredTest = { ...originalTest, data: normalizeCustomLevelData(originalTest.data) };
  assert.equal(isOriginalTestCourse(retiredTest), true, 'retiring the plus revived an obsolete Test Course snapshot');
  retiredTest.data.components[0].p[0] += .25;
  assert.equal(isOriginalTestCourse(retiredTest), false, 'an actual local edit was discarded as a published snapshot');
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  for (const entry of [...BUILTIN_LEVELS, ...pack.levels]) {
    assert.ok(!entry.data?.components.some(c => c.t === 'comboorb'), `${entry.id} still ships a combo activator`);
    assert.notEqual(entry.data?.secretComboGem, true, `${entry.id} still ships an enabled challenge`);
  }
  const base = { v: 1, name: 'Secret challenge sentinel', spawn: [0, .1, 8], killY: -20, components: [
    { t: 'platform', p: [0, -.5, 0], s: [24, 1, 30] }, { t: 'gate', p: [0, 0, -10] },
    { t: 'comboorb', p: [-3, 0, 4] },
  ] };
  const retired = normalizeCustomLevelData(base);
  assert.ok(retired);
  assert.ok(!retired.components.some(c => c.t === 'comboorb'), 'legacy snapshots retain the compulsory plus');
  assert.deepEqual(migrateCustomLevel(structuredClone(retired)), retired, 'retirement is not idempotent');
  assert.ok(retired.components.some(c => c.t === 'clock'), 'trial stopwatch was removed');
  assert.ok(!starterCustomLevel().components.some(c => c.t === 'comboorb'));
  for (const value of [null, 1, 'true', {}, []]) assert.equal(normalizeCustomLevelData({ ...base, secretComboGem: value }), null);
  const authored = normalizeCustomLevelData({ ...base, secretComboGem: true });
  assert.equal(authored.components.filter(c => c.t === 'comboorb').length, 1);
  assert.deepEqual(parseCustomLevelJson(JSON.stringify(authored)), authored, 'export/import lost the opt-in');
  setEditorBuild(true);
  for (const [id, data] of [['ordinary', retired], ['secret', authored], ['deleted', { ...authored, components: authored.components.filter(c => c.t !== 'comboorb') }]]) {
    const level = new Level(new THREE.Scene(), { id, name: data.name, data }); levels.push(level);
    assert.equal(!!level.comboOrb, id === 'secret', `${id}: runtime regenerated an unauthored activator`);
    assert.deepEqual(level.captureData(), data, `${id}: runtime capture lost authored metadata`);
  }
  const secret = levels[1];
  secret.setRunModesEnabled(false); assert.equal(secret.comboOrb.group.visible, false);
  secret.setRunModesEnabled(true); assert.equal(secret.comboOrb.group.visible, true);
  secret.collectComboOrb(); assert.equal(secret.comboOrb.collected, true);
  secret.setComboRun(true); secret.spawnComboGem();
  assert.ok(secret.comboGem); assert.equal(secret.runMode, true);
  secret.setComboRun(false); assert.equal(secret.comboGem, null);
  secret.reset(true); assert.equal(secret.comboOrb.collected, false);
  assert.equal(secret.comboOrb.group.visible, true);
  console.log('PASS secret combo gems: no shipped examples, cached snapshot retirement, strict opt-in, idempotence, authoring round-trip, runtime absence/presence, deletion, prize lifecycle and replay reset.');
} finally {
  levels.forEach(level => level.dispose());
  await server.close();
}
