import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import policy from '../../desktop/policy.cjs';
import { assetHandler } from '../../desktop/protocol.cjs';
import { keepAsset } from './assets.mjs';

test('only the bundle origin and local generated resources are allowed', () => {
  for (const url of ['boneman://game/', 'boneman://game/assets/a.js', 'data:image/png;base64,AA==', 'blob:boneman://game/123'])
    assert(policy.allowedRequest(url), url);
  for (const url of ['https://example.com', 'http://127.0.0.1/', 'ws://localhost', 'wss://example.com',
    'file:///etc/passwd', 'boneman://game.evil/', 'boneman://user@game/', 'boneman://game:80/', 'blob:https://example.com/123'])
    assert.equal(policy.allowedRequest(url), false, url);
  assert(!policy.CSP.includes("'unsafe-eval'"), 'The game window cannot compile JavaScript strings');
  assert(policy.DECODER_CSP.includes("connect-src 'none'"), 'The decoder cannot access the network');
  assert(policy.allowedNavigation('boneman://game/?playtest&level=codex-lab'));
  assert(policy.allowedNavigation('boneman://game/reset-local-data.html'));
  assert(!policy.allowedNavigation('boneman://game/arbitrary.html'));
});
test('path decoding cannot escape the manifest root on any host', () => {
  assert.equal(policy.assetKey('boneman://game/'), 'index.html');
  for (const url of ['boneman://game/%2e%2e%2fsecret', 'boneman://game/%5csecret', 'boneman://game/%00secret',
    'boneman://game/C:%5csecret', 'boneman://game/%E0%A4%A', 'file:///secret'])
    assert.equal(policy.assetKey(url), null, url);
});
test('streamed local responses support head, ranges and safe failures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'boneman-protocol-'));
  try {
    await writeFile(path.join(root, 'test.bin'), '0123456789');
    const handle = assetHandler(root, { files:[{ path:'test.bin', bytes:10 }] });
    const fetch = (key, options) => handle(new Request('boneman://game/' + key, options));
    const response = fetch('test.bin');
    assert.equal(response.headers.get('content-security-policy'), policy.CSP);
    assert.equal(await response.text(), '0123456789');
    assert.equal(await fetch('test.bin', { method:'HEAD' }).text(), '');
    for (const [range, expected] of [['bytes=2-5', '2345'], ['bytes=-3', '789'], ['bytes=7-', '789'], ['bytes=8-500', '89']]) {
      const part = fetch('test.bin', { headers:{ range } });
      assert.equal(part.status, 206);
      assert.equal(await part.text(), expected);
    }
    for (const range of ['bytes=12-20', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,5-6', 'bytes=9007199254740999-'])
      assert.equal(fetch('test.bin', { headers:{ range } }).status, 416);
    assert.equal(fetch('test.bin', { method:'POST' }).status, 405);
    assert.equal(fetch('main.cjs').status, 404);
    assert.equal(fetch('../main.cjs').status, 404);
  } finally { await rm(root, { recursive:true, force:true }); }
});
test('active runtime assets and licenses survive the smaller desktop bundle', () => {
  const versions = { bonus:10, counter:10 };
  for (const file of ['fonts/roo-bonus-v10-cap256.png', 'fonts/example.ttf', 'fonts/SECONDARY-FONT-NOTICE.md',
    'enemies/moa.glb', 'jungle-kit/basis/basis_transcoder.wasm', 'levels.json', 'fonts/roo-bevel-source-v1.json'])
    assert(keepAsset(file, versions), file);
  for (const file of ['fonts/roo-bonus-v9.png', 'fonts/roo-image-font-v10.zip', 'sw.js', 'release.json',
    'offline-save.html', 'update-game.html', 'provenance/source.glb'])
    assert.equal(keepAsset(file, versions), false, file);
});


test('cross-architecture checksum manifests can coexist in a release', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'boneman-checksums-'));
  try {
    const scripts = path.join(root, 'tools', 'desktop');
    const artifacts = path.join(root, 'desktop', 'release');
    await mkdir(scripts, {recursive:true}); await mkdir(artifacts, {recursive:true});
    const script = path.join(scripts, 'checksums.mjs');
    await copyFile(new URL('./checksums.mjs', import.meta.url), script);
    const payload = Buffer.from('offline release fixture');
    await writeFile(path.join(artifacts, 'BONEMAN-test.zip'), payload);
    for (const target of ['arm64', 'x64']) execFileSync(process.execPath, [script], {
      env:{...process.env, BONEMAN_TARGET_ARCH:target}, timeout:10000,
    });
    const names = (await readdir(artifacts)).filter(name => name.startsWith('SHA256SUMS')).sort();
    assert.deepEqual(names, ['arm64','x64'].map(target => `SHA256SUMS-${process.platform}-${target}.txt`));
    const expected = createHash('sha256').update(payload).digest('hex') + '  BONEMAN-test.zip\n';
    for (const name of names) assert.equal(await readFile(path.join(artifacts, name), 'utf8'), expected);
  } finally { await rm(root, {recursive:true, force:true}); }
});
