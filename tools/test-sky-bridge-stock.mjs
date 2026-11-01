import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';

const storage = new Map();
globalThis.localStorage = {getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value))};
globalThis.window = {location: {search: '?lite'}, addEventListener() {}};
const server = await createServer({configFile: false, appType: 'custom', logLevel: 'silent',
  optimizeDeps: {noDiscovery: true}, server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
try {
  const api = await server.ssrLoadModule('/src/level.ts');
  const {migrateCrateLayout} = await server.ssrLoadModule('/src/crateDimensions.ts');
  const builtin = api.BUILTIN_LEVELS.find(e => e.id === 'sky');
  assert.equal(builtin.data.components.find(c => c.t === 'gate').p[2], -483);
  assert.equal(builtin.data.components.filter(c => c.t === 'checkpoint').length, 7);
  for (const file of ['sky-bridge-legacy.json', 'sky-bridge-placement-legacy.json',
    'sky-bridge-cloud-v1.json.gz', 'sky-bridge-construction-v1.json.gz', 'sky-bridge-before-cloud-extension.json.gz']) {
    const bytes = await readFile(new URL('./fixtures/' + file, import.meta.url));
    const raw = JSON.parse(file.endsWith('.gz') ? gunzipSync(bytes) : bytes);
    const alreadyMigrated = structuredClone(raw);
    migrateCrateLayout(alreadyMigrated.data);
    for (const entry of [raw, alreadyMigrated]) {
      assert.ok(api.setUserLevels([entry]));
      const stored = storage.get('solProtoUserLevels');
      assert.equal(api.findLevel('sky'), builtin, file + ': saved stock must follow the current source');
      assert.equal(api.isOverridden('sky'), false, 'editor state must agree with course selection');
      assert.equal(storage.get('solProtoUserLevels'), stored, 'selection must not rewrite the archive');
      assert.equal(api.getUserLevels()[0].data.components.length, raw.data.components.length);
      const working = api.getEditData('sky');
      assert.equal(working.crateLayoutRevision, 1, 'editor uses enlarged crate coordinates');
      assert.equal(working.components.find(c => c.t === 'gate').p[2], -483);
      assert.equal(builtin.data.crateLayoutRevision, undefined, 'source remains untouched');
      for (const edit of [e => e.data.components[0].p[0] += .01,
        e => e.data.components[0].nm = 'My platform', e => e.data.spawn[0] += .01,
        e => e.name = 'My Sky Bridge', e => e.data.name = 'My Sky Bridge',
        e => e.data.edgeGrindingRevision = 1, e => e.id = 'my-sky-copy']) {
        const authored = structuredClone(entry); edit(authored);
        assert.ok(api.setUserLevels([authored]));
        assert.deepEqual(api.findLevel(authored.id).data, api.getUserLevels()[0].data, 'authored work must stay authoritative');
        if (authored.id === 'sky') assert.equal(api.isOverridden('sky'), true);
      }
    }
  }
  // Registry validation keeps the old authored coordinates for identity checks.
  // The editor and runtime apply the enlarged layout only after selection.
  const stack = {id: 'my-stack', name: 'My stack', data: {v: 1, name: 'My stack',
    spawn: [4, .1, 4], killY: -20, components: [
      {t: 'platform', p: [0, -.5, 0], s: [20, 1, 20]}, {t: 'gate', p: [0, 0, -8]},
      {t: 'crate', p: [0, 0, 0]}, {t: 'crate', p: [0, .96, 0]}]}};
  assert.ok(api.setUserLevels([stack]));
  assert.equal(api.findLevel(stack.id).data.components[3].p[1], .96);
  assert.equal(api.normalizeCustomLevelData(stack.data).components[3].p[1], .96 * 1.2, 'editor import validation still migrates the working layout');
  assert.equal(api.getEditData(stack.id).components[3].p[1], .96 * 1.2);
  assert.deepEqual(api.getEditData(stack.id), api.getEditData(stack.id), 'opening must not expand twice');
  const oldTest = JSON.parse(await readFile(new URL('./carlisle-coast/original-course.json', import.meta.url)));
  assert.ok(api.setUserLevels([oldTest]));
  assert.equal(api.findLevel('test'), api.BUILTIN_LEVELS.find(e => e.id === 'test'), 'old Test Course must follow Carlisle');
  const {RUMBLEWATER_RUN_LEVEL} = await server.ssrLoadModule('/src/levels/rumblewater-run.ts');
  for (const data of [RUMBLEWATER_RUN_LEVEL, api.normalizeCustomLevelData(RUMBLEWATER_RUN_LEVEL)]) {
    const entry = {id: 'rumblewater-run', name: data.name, data};
    assert.ok(api.setUserLevels([entry]));
    assert.equal(api.findLevel(entry.id), api.BUILTIN_LEVELS.find(e => e.id === entry.id), 'raw/migrated stock must follow Ripcord');
    const edit = structuredClone(entry); edit.data.spawn[0] += .01;
    assert.ok(api.setUserLevels([edit]));
    assert.deepEqual(api.findLevel(entry.id).data, api.getUserLevels()[0].data, 'edited river must remain local');
  }
  console.log('PASS 5 historical Sky Bridge versions, 10 raw/migrated saves, 70 authored variants, Carlisle/Ripcord stock selection, archive preservation and deferred crate layout.');
} finally { await server.close(); }
