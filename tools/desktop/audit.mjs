import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, inventory } from './assets.mjs';
const root = fileURLToPath(new URL('../../desktop/web/', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'asset-manifest.json'), 'utf8'));
assert.equal(manifest.schema, 1);
assert.equal(digest(JSON.stringify(manifest.files)), manifest.contentId);
assert.deepEqual((await inventory(root)).filter(p => p !== 'asset-manifest.json'), manifest.files.map(f => f.path));
const keys = new Set(manifest.files.map(f => f.path));
for (const required of ['index.html', 'levels.json', 'jungle-kit/basis/basis_transcoder.js', 'jungle-kit/basis/basis_transcoder.wasm', 'licenses/three.txt', 'licenses/three-mesh-bvh.txt'])
  assert(keys.has(required), 'Missing offline dependency: ' + required);
for (const row of manifest.files) {
  assert(!/(?:^|\/)(?:sw\.js|release\.json|offline-save\.html|update-game\.html|\.env)$/.test(row.path));
  assert(!/\.(?:map|zip)$/.test(row.path));
  const bytes = await readFile(path.join(root, row.path));
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(digest(bytes), row.sha256, row.path);
  if (/\.(?:html|css)$/.test(row.path)) {
    const text = bytes.toString();
    assert(!/(?:src|href)=["'](?:https?:)?\/\/|@import\s+["'](?:https?:)?\/\/|url\(\s*["']?(?:https?:)?\/\//i.test(text), 'Remote dependency in ' + row.path);
  }
  if (row.path.endsWith('.html')) {
    for (const match of bytes.toString().matchAll(/(?:src|href)=["'](?:\.\/)?([^"'#?]+)[^"']*["']/g)) {
      if (/^(?:data:|blob:|\/|\.\/)$/.test(match[1]) || match[1].startsWith('data:')) continue;
      if (!match[1].includes(':')) assert(keys.has(match[1]), 'Missing HTML asset: ' + match[1]);
    }
  }
  if (row.path.endsWith('.gltf')) {
    const gltf = JSON.parse(bytes);
    for (const item of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
      if (!item.uri || item.uri.startsWith('data:')) continue;
      assert(!/^(?:[a-z]+:|\/\/)/i.test(item.uri), 'Remote glTF resource: ' + row.path);
      assert(keys.has(path.posix.normalize(path.posix.join(path.posix.dirname(row.path), decodeURIComponent(item.uri)))), 'Missing glTF resource: ' + item.uri);
    }
  }
  if (/^assets\/.*\.js$/.test(row.path)) {
    assert(!bytes.includes(Buffer.from('api.github.com/repos/')), 'Desktop still includes the GitHub publishing client');
    assert(!bytes.includes(Buffer.from('release.json')), 'Desktop still includes web update discovery');
  }
}
console.log('PASS offline manifest integrity, local HTML/glTF dependencies, bundled decoders and excluded web updater.');
console.log(JSON.stringify({ contentId:manifest.contentId, files:manifest.files.length, bytes:manifest.files.reduce((sum, f) => sum + f.bytes, 0) }));
