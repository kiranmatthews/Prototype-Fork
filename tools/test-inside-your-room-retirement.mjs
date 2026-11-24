// Inside Your Room is retired: the level and its nine images are gone from the
// game, and a copy saved in an editor library still loads without them.
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createServer } from 'vite';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();')();
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const api = await server.ssrLoadModule('/src/level.ts');

  // 1. Gone from the game: no course, no texture offered, no published image.
  assert.equal(api.findLevel('inside-your-room'), null);
  assert.ok(!api.BUILTIN_LEVELS.some(level => level.id === 'inside-your-room' || level.name === 'Inside Your Room'));
  assert.ok(!api.TEX_KINDS.some(kind => kind.startsWith('room-')), 'the editor still offers a room texture');
  await assert.rejects(access(new URL('../public/treehouse-room', import.meta.url)), 'the room images are still published');
  await assert.rejects(access(new URL('../src/levels/treehouse-room.ts', import.meta.url)), 'the room source is still present');

  // 2. A saved copy stays readable. Its three surfaces fall back to stock
  // ones; the planes that only carried a poster or a window matte are dropped.
  const pictures = ['room-poster-coast', 'room-poster-canopy', 'room-poster-orbit', 'room-shore', 'room-jungle', 'room-balustrade'];
  const plane = tex => ({ t: 'mesh', p: [0, 2, -3], tex, solid: false,
    vertices: [-1, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], indices: [0, 1, 2] });
  const saved = { v: 1, name: 'My room', spawn: [0, 1, 0], killY: -30, components: [
    { t: 'platform', p: [0, -.5, 0], s: [10, 1, 10], tex: 'room-timber' },
    { t: 'platform', p: [0, -.5, -12], s: [4, 1, 4], tex: 'room-bark' },
    { t: 'platform', p: [6, -.5, 0], s: [2, 1, 2], tex: 'room-rug' },
    { t: 'platform', p: [-6, -.5, 0], s: [2, 1, 2], tex: 'stone' },
    ...pictures.map(plane),
    plane('wood'),
    { t: 'gate', p: [0, 0, -4] },
  ] };
  const data = api.normalizeCustomLevelData(structuredClone(saved));
  assert.ok(data, 'a saved copy of the room no longer loads');
  assert.deepEqual(data.components.filter(c => c.t === 'platform').map(c => c.tex), ['wood', 'waterfall-bark', 'solid', 'stone']);
  assert.deepEqual(data.components.filter(c => c.t === 'mesh').map(c => c.tex), ['wood'], 'a poster or matte plane survived without its image');
  assert.ok(data.components.some(c => c.t === 'gate'), 'the saved copy lost its gate');
  assert.ok(!JSON.stringify(data).includes('room-'), 'a retired texture kind survived migration');
  // Migrating again changes nothing.
  assert.deepEqual(api.normalizeCustomLevelData(structuredClone(data)), data);
  // The retired kinds exist for that one import step only: nothing else accepts them.
  assert.equal(api.migrateCustomLevel(structuredClone(saved)).components.some(c => c.tex?.startsWith('room-')), false);
  // ...and only those nine names: any other unknown kind is refused as before.
  assert.equal(api.normalizeCustomLevelData({ v: 1, name: 'Unknown', spawn: [0, 1, 0], killY: -30, components: [
    { t: 'platform', p: [0, -.5, 0], s: [10, 1, 10], tex: 'room-lamp' }, { t: 'gate', p: [0, 0, -4] },
  ] }), null, 'an unknown texture kind was accepted');

  // 3. In a saved library: an override under the retired id does not bring the
  // room back as a menu row, and an ordinary saved copy is still listed.
  assert.equal(api.setUserLevels([
    { id: 'inside-your-room', name: 'Inside Your Room', data: structuredClone(saved) },
    { id: 'u1', name: 'My room', data: structuredClone(saved) },
  ]), true, 'a library holding a saved room was refused');
  assert.equal(api.findLevel('inside-your-room'), null, 'a saved override resurrected the deleted room');
  assert.ok(!api.levelList().some(level => level.id === 'inside-your-room'));
  assert.equal(api.getUserLevels().length, 2, 'the saved library lost an entry');
  const copy = api.findLevel('u1');
  assert.ok(copy?.data && !copy.data.components.some(c => c.tex?.startsWith('room-')), 'the saved copy kept a retired texture');

  console.log('PASS Inside Your Room retirement: no course, texture or image; saved copies stay readable on stock surfaces; a saved override does not bring it back.');
} finally {
  await server.close();
}
