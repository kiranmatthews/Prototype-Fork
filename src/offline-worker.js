/* Generated into sw.js by tools/offline-build.mjs. Classic worker for iOS. */
const MANIFEST = /* OFFLINE_MANIFEST */;
const BASE = self.registration.scope;
const PREFIX = `solProtoOffline:${new URL(BASE).pathname}:`;
const CACHE = PREFIX + MANIFEST.version;
const READY = new URL('__offline_ready__', BASE).href;
const ENTRIES = new Map(MANIFEST.entries.map(entry => [new URL(entry.url, BASE).href, entry]));
const TOTAL = MANIFEST.entries.reduce((sum, entry) => sum + entry.size, 0);
let status = { type: 'solProtoOffline', protocol: 3, phase: 'idle', completed: 0, total: TOTAL };
let lastProgressReport = 0;
const pendingEntries = new Map();
let storageWork = Promise.resolve();
let saveJob = null;
let inventory = null;
const documentCaches = new Map();
const ENTRY_PARAM = '__game_entry';

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
    // Read one body. clone() would tee the stream and buffer the entire unread
    // branch while hashing, on top of the ArrayBuffer and cache write.
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const revision = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (revision !== entry.revision) throw new Error('Game updated during download');
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.set('Content-Length', String(bytes.byteLength));
    return new Response(bytes, { status: response.status, statusText: response.statusText, headers });
  } finally { clearTimeout(timeout); }
}
// One bounded installer writer; foreground misses bypass this path entirely.
function ensureEntry(cache, entry, previous = []) {
  const request = key(entry), pending = pendingEntries.get(request);
  if (pending) return pending;
  const job = storageWork.then(async () => {
    const existing = await cache.match(request);
    if (existing) { await existing.body?.cancel(); return; }
    let response;
    for (const name of previous) {
      response = await (await caches.open(name)).match(request);
      if (response) break;
    }
    await cache.put(request, response || await download(entry));
  });
  storageWork = job.catch(() => {});
  pendingEntries.set(request, job);
  const release = () => pendingEntries.delete(request);
  job.then(release, release);
  return job;
}
async function installGame() {
  await requireSaveScreen();
  const cache = await caches.open(CACHE);
  const previous = [];
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || name === CACHE) continue;
    const ready = await (await caches.open(name)).match(READY);
    // A failed older install can never serve a client. Keep this version's
    // partial progress, but do not accumulate abandoned partial releases.
    if (!ready) { await caches.delete(name); continue; }
    await ready.body?.cancel();
    previous.push(name);
  }
  await report({ phase: 'saving', completed: 0 });
  try {
    for (const entry of MANIFEST.entries) {
      await requireSaveScreen();
      await ensureEntry(cache, entry, previous);
      status.completed += entry.size;
      await report({ completed: status.completed });
    }
  } catch (error) {
    await report({ phase: 'error', reason: error?.name === 'QuotaExceededError' ? 'storage' : error?.message === 'game-open' ? 'game-open' : 'network' });
    throw error;
  }
  await cache.put(READY, new Response(MANIFEST.version));
  inventory=null;documentCaches.clear();
  await report({ phase: 'ready', completed: TOTAL, olderCopy:false });
  // Only an explicit save, with every game window closed, may activate early.
  await requireSaveScreen();
  await self.skipWaiting();
}
// Browsers update workers on navigation independently of register(). Never
// allocate a complete release alongside a live game, even on automatic update.
async function requireSaveScreen() {
  const clients = (await self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
    .filter(client => client.url.startsWith(BASE));
  const save = new URL('offline-save.html', BASE).pathname;
  if (!clients.some(client => new URL(client.url).pathname === save) ||
      clients.some(client => !['offline-save.html', 'update-game.html', 'stability-report.html'].some(page => new URL(client.url).pathname === new URL(page, BASE).pathname))) {
    throw new Error('game-open');
  }
}
// Automatic script updates must be installable without downloading the game.
// They wait for the old clients to close; bulk saving is a separate message.
self.addEventListener('install', () => {});
self.addEventListener('activate', event => event.waitUntil((async () => {
  const complete=await completeCaches();
  if(complete.includes(CACHE)) {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
  }
  // A lightweight update retains the last complete offline release.
  inventory=null;documentCaches.clear();
  await self.clients.claim();
  await report(complete.includes(CACHE)?{phase:'ready',completed:TOTAL,olderCopy:false}:{phase:'idle',completed:0,olderCopy:complete.length>0});
})()));
self.addEventListener('message', event => {
  if(event.data?.type==='solProtoOfflineSave'){
    const source=event.source?.url?new URL(event.source.url):null,save=new URL('offline-save.html',BASE);
    if(!source||source.origin!==save.origin||source.pathname!==save.pathname)return;
    if(!saveJob){saveJob=installGame().catch(async error=>{
      if(status.phase!=='error')await report({phase:'error',reason:error?.message==='game-open'?'game-open':error?.name==='QuotaExceededError'?'storage':'network'});
      throw error;
    });const clear=()=>{saveJob=null;};saveJob.then(clear,clear);}
    event.waitUntil(saveJob);return;
  }
  if (event.data?.type !== 'solProtoOfflineStatus') return;
  event.waitUntil((async () => {
    inventory=null;
    const complete=await completeCaches(),ready=complete.includes(CACHE);
    event.source?.postMessage(ready ? { ...status, phase: 'ready', completed: TOTAL,olderCopy:false } : {...status,olderCopy:complete.length>0});
  })());
});

function completeCaches(){
  return inventory??=(async()=>{
    const result=[];
    for(const name of (await caches.keys()).reverse())if(name.startsWith(PREFIX)){
      const ready=await(await caches.open(name)).match(READY);
      if(ready){await ready.body?.cancel();result.push(name);}
    }
    return result;
  })().catch(error=>{inventory=null;throw error;});
}
async function documentEntry(response){
  // Published HTML is small; model/audio bodies never enter this copy path.
  if(Number(response.headers.get('content-length'))>131072)return null;
  const html=await response.clone().text();
  return html.match(/<script\b[^>]*\bsrc=["'](?:\.\/)?assets\/([\w-]+\.js)["']/)?.[1]??null;
}
async function cacheForDocument(url,entry){
  const clean=new URL(url);clean.search='';clean.hash='';if(clean.href===BASE)clean.pathname+='index.html';
  const id=clean.href+'|'+entry;
  if(documentCaches.size>=32&&!documentCaches.has(id))documentCaches.clear();
  if(!documentCaches.has(id)){
    const lookup=(async()=>{
    for(const name of await completeCaches()){
      const response=await(await caches.open(name)).match(clean.href,{ignoreSearch:true});
      if(response){const found=await documentEntry(response);await response.body?.cancel();if(found===entry)return name;}
    }
    return null;
    })().catch(error=>{if(documentCaches.get(id)===lookup)documentCaches.delete(id);throw error;});
    documentCaches.set(id,lookup);
  }
  return documentCaches.get(id);
}
async function navigation(request,clean){
  let response;
  try{
    response=await fetch(request,{cache:'no-store'});
    if(!response.ok){await response.body?.cancel();throw Error('navigation unavailable');}
  }catch(error){
    response=undefined;
    for(const name of await completeCaches()){
      response=await(await caches.open(name)).match(clean.href,{ignoreSearch:true});
      if(response)break;
    }
    if(!response)throw error;
  }
  const entry=await documentEntry(response),target=new URL(request.url);
  if(entry&&target.searchParams.get(ENTRY_PARAM)!==entry){
    target.searchParams.set(ENTRY_PARAM,entry);await response.body?.cancel();
    return Response.redirect(target.href,302);
  }
  return response;
}

async function rangedResponse(response, range) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match || (!match[1] && !match[2])) return response;
  const body = await response.blob(), length = body.size;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (start > end || start >= length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${length}` } });
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('authorization')) return;
  const url = new URL(request.url);
  if (url.origin !== new URL(BASE).origin || !url.href.startsWith(BASE)) return;
  url.search = ''; url.hash = '';
  if (url.href === BASE) url.pathname += 'index.html';
  const entry = ENTRIES.get(url.href);
  const relative=url.href.slice(BASE.length);
  // Retired hashed bundles/fonts can still belong to a pinned offline document.
  if (!entry&&!/^(?:assets|fonts)\/[\w./-]+\.(?:js|css|png|otf|ttf|woff2?)$/.test(relative)) return;
  event.respondWith((async () => {
    if(request.mode==='navigate'&&/\.html$/.test(url.pathname))return navigation(request,url);
    let response;
    try {
      const client=event.clientId?await self.clients.get(event.clientId):null;
      let page=client?.url?new URL(client.url):null;
      // Early document preloads can precede a readable WindowClient URL.
      if(!page?.searchParams.has(ENTRY_PARAM)&&request.referrer){
        const referrer=new URL(request.referrer);
        if(referrer.href.startsWith(BASE)&&referrer.searchParams.has(ENTRY_PARAM))page=referrer;
      }
      const value=page?.searchParams.get(ENTRY_PARAM),token=value&&value.length<=160&&/^[\w-]+\.js$/.test(value)?value:null;
      const name=token?await cacheForDocument(page.href,token):!client&&(await completeCaches()).includes(CACHE)?CACHE:null;
      if(name)response=await(await caches.open(name)).match(url.href,{ignoreSearch:true});
    }
    catch { return fetch(request); } // storage restrictions cannot break online play
    if (!response) {
      // Cache eviction/quota cannot gate a foreground load behind hashing,
      // storage writes, or an installer queue. Normal HTTP handles this miss.
      return fetch(request);
    }
    const range = request.headers.get('range');
    return range ? rangedResponse(response, range) : response;
  })());
});
