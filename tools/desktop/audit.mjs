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
for (const required of ['index.html', 'desktop-basis-worker.js', 'levels.json', 'jungle-kit/basis/basis_transcoder.js', 'jungle-kit/basis/basis_transcoder.wasm', 'licenses/three.txt', 'licenses/three-mesh-bvh.txt'])
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
  if (row.path.endsWith('.css')) {
    for (const match of bytes.toString().matchAll(/url\(\s*["']?([^)"']+)["']?\s*\)/g)) {
      const uri = match[1].trim();
      if (uri.startsWith('data:')) continue;
      const ref = decodeURIComponent(uri.split(/[?#]/)[0]);
      const key = ref.startsWith('/') ? ref.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(row.path), ref));
      assert(keys.has(key), 'Missing CSS dependency: ' + row.path + ' -> ' + uri);
    }
  }
  if (/\.gl(?:tf|b)$/.test(row.path)) {
    let gltf;
    if (row.path.endsWith('.glb')) {
      assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Invalid GLB header: ' + row.path);
      assert.equal(bytes.readUInt32LE(4), 2);
      assert.equal(bytes.readUInt32LE(8), bytes.length);
      assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First GLB chunk must be JSON');
      const length = bytes.readUInt32LE(12);
      gltf = JSON.parse(bytes.subarray(20, 20 + length).toString().replace(/\0+$/, ''));
    } else gltf = JSON.parse(bytes);
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
