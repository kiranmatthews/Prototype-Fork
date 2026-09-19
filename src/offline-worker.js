/* Generated into sw.js by tools/offline-build.mjs. Classic worker for iOS. */
const MANIFEST = /* OFFLINE_MANIFEST */;
const BASE = self.registration.scope;
const PREFIX = `solProtoOffline:${new URL(BASE).pathname}:`;
const CACHE = PREFIX + MANIFEST.version;
const READY = new URL('__offline_ready__', BASE).href;
const ENTRIES = new Map(MANIFEST.entries.map(entry => [new URL(entry.url, BASE).href, entry]));
const TOTAL = MANIFEST.entries.reduce((sum, entry) => sum + entry.size, 0);
let status = { type: 'solProtoOffline', phase: 'saving', completed: 0, total: TOTAL };
let lastProgressReport = 0;

function key(entry) {
  const url = new URL(entry.url, BASE);
  url.searchParams.set('__offline_revision', entry.revision);
  return url.href;
}
async function report(patch) {
  status = { ...status, ...patch };
  // Hundreds of small cached files must not trigger hundreds of menu/CRT
  // artwork invalidations. Phase changes and direct status requests stay immediate.
  const now = Date.now();
  if (!patch.phase && now - lastProgressReport < 250) return;
  lastProgressReport = now;
  for (const client of await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })) {
    if (client.url.startsWith(BASE)) client.postMessage(status);
  }
}
async function download(entry) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(key(entry), { cache: 'no-store', signal: controller.signal, priority: 'low' });
    if (!response.ok || response.status === 206) throw new Error('Download failed');
    // A deploy can change un-hashed public filenames halfway through a save.
    // Never mark a mixed or incomplete release as safe for airplane mode.
    const bytes = await response.clone().arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const revision = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (revision !== entry.revision) throw new Error('Game updated during download');
    return response;
  } finally { clearTimeout(timeout); }
}
async function installGame() {
  const cache = await caches.open(CACHE);
  const previous = (await caches.keys()).filter(name => name.startsWith(PREFIX) && name !== CACHE);
  let cursor = 0, stopped = false;
  await report({ phase: 'saving', completed: 0 });
  // Limit parallel transfers and hashing memory on phones. Interrupted saves
  // reuse their completed files, as do updates with unchanged asset revisions.
  const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
    while (!stopped && cursor < MANIFEST.entries.length) {
      const entry = MANIFEST.entries[cursor++], request = key(entry);
      try {
        let response = await cache.match(request);
        if (!response) {
          for (const name of previous) {
            response = await (await caches.open(name)).match(request);
            if (response) break;
          }
          await cache.put(request, response || await download(entry));
        }
        status.completed += entry.size;
        await report({ completed: status.completed });
      } catch (error) { stopped = true; throw error; }
    }
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    await report({ phase: 'error', reason: failure.reason?.name === 'QuotaExceededError' ? 'storage' : 'network' });
    throw failure.reason;
  }
  await cache.put(READY, new Response(MANIFEST.version));
  await report({ phase: 'ready', completed: TOTAL });
  // Updates wait for existing game windows to close. No mid-run reload and
  // no new worker serving old HTML with a different version of its assets.
}
self.addEventListener('install', event => event.waitUntil(installGame()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  }
  await self.clients.claim();
  await report({ phase: 'ready', completed: TOTAL });
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'solProtoOfflineStatus') return;
  event.waitUntil((async () => {
    const ready = await (await caches.open(CACHE)).match(READY);
    event.source?.postMessage(ready ? { ...status, phase: 'ready', completed: TOTAL } : status);
  })());
});

async function rangedResponse(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return response;
  const bytes = await response.arrayBuffer(), length = bytes.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (start > end || start >= length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== new URL(BASE).origin || !url.href.startsWith(BASE)) return;
  url.search = ''; url.hash = '';
  if (url.href === BASE) url.pathname += 'index.html';
  const entry = ENTRIES.get(url.href);
  if (!entry) return; // Never cache cloud sync, credentials or other projects.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    let response = await cache.match(key(entry));
    if (!response) {
      response = await download(entry);
      await cache.put(key(entry), response.clone());
    }
    const range = request.headers.get('range');
    return range ? rangedResponse(response, range) : response;
  })());
});
