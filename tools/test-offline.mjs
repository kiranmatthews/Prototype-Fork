import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { runtimeAsset } from './offline-build.mjs';

const source = await readFile(new URL('../src/offline-worker.js', import.meta.url), 'utf8');
const base = 'https://example.test/Prototype-Fork/';
const hash = text => createHash('sha256').update(text).digest('hex');
const stores = new Map(), requests = [], messages = [];
let network = new Map(), online = true, quotaFailure = false;
const storage = {
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); },
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async match(key) { return entries.get(String(key))?.clone(); },
      async put(key, response) {
        if (quotaFailure) { quotaFailure = false; throw new DOMException('Full', 'QuotaExceededError'); }
        entries.set(String(key), response.clone());
      },
    };
  },
};
function release(version, files) {
  const manifest = { version, entries: Object.entries(files).map(([url, body]) => ({ url, revision: hash(body), size: Buffer.byteLength(body) })) };
  const handlers = {};
  const self = {
    registration: { scope: base },
    clients: { async claim() {}, async matchAll() { return [{ url: base, postMessage(message) { messages.push({ ...message }); } }]; } },
    addEventListener(type, handler) { handlers[type] = handler; },
  };
  runInNewContext(source.replace('/* OFFLINE_MANIFEST */', JSON.stringify(manifest)), {
    self, caches: storage, URL, Response, Headers, AbortController, crypto: webcrypto, setTimeout, clearTimeout, Date: {now:()=>1000},
    async fetch(url) {
      requests.push(url);
      if (!online) throw new TypeError('Offline');
      const clean = new URL(url); clean.search = '';
      return network.has(clean.href) ? new Response(network.get(clean.href)) : new Response('Missing', { status: 404 });
    },
  });
  return {
    async event(type, extra = {}) {
      let pending;
      handlers[type]({ ...extra, waitUntil(value) { pending = value; } });
      await pending;
    },
    fetch(path, options = {}) {
      let response;
      handlers.fetch({ request: new Request(new URL(path, base), options), respondWith(value) { response = value; } });
      return response;
    },
  };
}
function serve(files) { network = new Map(Object.entries(files).map(([url, body]) => [new URL(url, base).href, body])); }

const v1Files = { 'index.html': '<h1>Build one</h1>', 'assets/game.js': 'start()', 'levels.json': '{"v":2}', 'sfx/jump.wav': '0123456789' };
serve(v1Files);
const v1 = release('one', v1Files);
await v1.event('install'); await v1.event('activate');
assert.equal(requests.length, 4);
assert.equal(messages.at(-1).phase, 'ready');
online = false;
assert.equal(await (await v1.fetch('./?lite&v=old')).text(), v1Files['index.html']);
assert.equal(await (await v1.fetch('index.html?fresh=1')).text(), v1Files['index.html']);
assert.equal(await (await v1.fetch('levels.json?t=123')).text(), v1Files['levels.json']);
assert.equal(await (await v1.fetch('assets/game.js')).text(), 'start()');
for (const [range, body, contentRange] of [['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=7-', '789', 'bytes 7-9/10']]) {
  const response = await v1.fetch('sfx/jump.wav', { headers: { Range: range } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('Content-Range'), contentRange);
  assert.equal(await response.text(), body);
}
assert.equal((await v1.fetch('sfx/jump.wav', { headers: { Range: 'bytes=12-20' } })).status, 416);
for (const path of ['https://api.github.com/repos/test', '/Other-Game/index.html', 'unlisted.json']) assert.equal(v1.fetch(path), undefined);
assert.equal(v1.fetch('levels.json', { method: 'POST', body: 'save' }), undefined);
assert.equal(v1.fetch('levels.json', { headers: { Authorization: 'test' } }), undefined);

const foreign = await storage.open('other-game'); await foreign.put('keep', new Response('safe'));
const v2Files = { ...v1Files, 'index.html': '<h1>Build two</h1>', 'new.glb': 'model two' };
const v2 = release('two', v2Files);
online = true; serve(v2Files); network.delete(new URL('new.glb', base).href);
await assert.rejects(v2.event('install'));
assert.equal(messages.at(-1).phase, 'error');
assert.ok(stores.has('solProtoOffline:/Prototype-Fork/:one'), 'failed update preserves the working offline release');
assert.equal(await (await v1.fetch('./')).text(), v1Files['index.html']);
assert.ok(!stores.get('solProtoOffline:/Prototype-Fork/:two').has(new URL('__offline_ready__', base).href));

serve(v2Files); const beforeResume = requests.length;
await v2.event('install');
assert.equal(requests.length - beforeResume, 1, 'resume downloads only the previously missing model');
assert.equal(await (await v1.fetch('./')).text(), v1Files['index.html'], 'install does not replace the active game');
await v2.event('activate');
assert.ok(!stores.has('solProtoOffline:/Prototype-Fork/:one'));
assert.ok(stores.has('other-game'), 'cleanup is scoped to this game path');
online = false;
assert.equal(await (await v2.fetch('./')).text(), v2Files['index.html']);
assert.equal(await (await v2.fetch('new.glb')).text(), 'model two');

online = true;
const changed = { ...v2Files, 'new.glb': 'model three' };
serve({ ...changed, 'new.glb': 'wrong deployment bytes' });
const v3 = release('three', changed);
await assert.rejects(v3.event('install'), /updated during download/);
assert.ok(stores.has('solProtoOffline:/Prototype-Fork/:two'));
quotaFailure = true; serve(changed);
await assert.rejects(v3.event('install'));
assert.equal(messages.at(-1).reason, 'storage');
quotaFailure = false;
const burstFiles=Object.fromEntries(Array.from({length:100},(_,i)=>[`part-${i}.glb`,`small part ${i}`]));
serve(burstFiles);const beforeBurst=messages.length,burst=release('burst',burstFiles);
await burst.event('install');
assert.equal(messages.at(-1).phase,'ready');
assert.equal(messages.at(-1).completed,messages.at(-1).total,'throttling preserves exact final progress');
assert.ok(messages.length-beforeBurst<20,'a small-file burst does not invalidate menu artwork once per file');

const fonts = { bonus: 10, counter: 10 };
for (const file of ['fonts/roo-bonus-v10.png', 'fonts/roo-counter-v10-light2.png', 'fonts/RooRegular.otf', 'jungle-kit/basis/basis_transcoder.wasm', 'animations/skate-review/catalog.json']) assert.ok(runtimeAsset(file, fonts), file);
for (const file of ['fonts/roo-bonus-v9.png', 'fonts/roo-image-font-v10.zip', 'fonts/roo-font-v10-provenance.json', 'crt-guest/provenance/test.json', 'sw.js']) assert.ok(!runtimeAsset(file, fonts), file);
console.log('PASS offline install, reload/subpaths/queries, iOS byte ranges, scoped cache, interrupted resume, atomic updates, content validation, storage failure and current-font selection');
