// Offline mode is retired. A browser that installed the old cache-first worker
// must lose it on its next visit: public/sw.js replaces the old worker, deletes
// this project's offline caches and unregisters itself. Other projects' caches
// on the same origin and the player's saved data stay untouched.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const tombstone=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
// The shape of the retired worker that matters here: it caches release files
// under solProtoOffline:<scope path>:<version> and answers requests from them.
const legacy=`const CACHE='solProtoOffline:'+new URL(self.registration.scope).pathname+':legacy';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./asset.txt'])).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request))));`;
let worker=legacy,asset='old copy';
const page=`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>Retirement fixture</title>
<script>if(new URLSearchParams(location.search).has('install'))navigator.serviceWorker.register('./sw.js',{scope:'./'});</script>`;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(type,body)=>res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
  if(url.pathname==='/Prototype-Fork/'||url.pathname==='/Prototype-Fork/index.html')return send('text/html',page);
  if(url.pathname==='/Prototype-Fork/sw.js')return send('text/javascript',worker);
  if(url.pathname==='/Prototype-Fork/asset.txt')return send('text/plain',asset);
  res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/Prototype-Fork/`;
// Poll an async page condition; a bare async predicate would resolve at once.
const until=async(tab,predicate,label,limit=20000)=>{
  for(const start=Date.now();Date.now()-start<limit;await tab.waitForTimeout(200))if(await tab.evaluate(predicate))return;
  throw new Error('Timed out waiting for '+label);
};
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{})});
try{
  const context=await browser.newContext();const tab=await context.newPage();
  await tab.goto(base+'?install');
  await until(tab,async()=>{const name=(await caches.keys()).find(n=>n.startsWith('solProtoOffline:'));
    return !!navigator.serviceWorker.controller&&!!name&&(await (await caches.open(name)).keys()).length===2;},'the legacy offline copy');
  await tab.evaluate(async()=>{localStorage.setItem('solProtoSaveSlots','kept');await (await caches.open('otherProject:v1')).put('/elsewhere',new Response('foreign'));});
  // A deploy changes the asset; the installed copy still serves the stale one.
  asset='live copy';
  assert.equal(await tab.evaluate(()=>fetch('./asset.txt').then(r=>r.text())),'old copy','fixture reproduces the stale installed copy');
  // The next deploy publishes the retirement worker. A later visit checks for
  // a worker update on its own; no game code has to run for the cleanup.
  worker=tombstone;
  await tab.goto(base);
  await until(tab,async()=>(await navigator.serviceWorker.getRegistrations()).length===0,'the retirement worker to unregister');
  const after=await tab.evaluate(async()=>({caches:await caches.keys(),save:localStorage.getItem('solProtoSaveSlots')}));
  assert.deepEqual(after.caches,['otherProject:v1'],'only this project\'s offline caches are removed');
  assert.equal(after.save,'kept','saved games are untouched');
  await tab.goto(base);
  assert.equal(await tab.evaluate(()=>navigator.serviceWorker.controller),null,'the next visit is not controlled by any worker');
  assert.equal(await tab.evaluate(()=>fetch('./asset.txt').then(r=>r.text())),'live copy','the live release is served again');
  console.log('PASS retired offline copy: replaced by the retirement worker, project caches deleted, worker unregistered, live files served, saves and foreign caches kept.');
}finally{await browser.close();server.close();}
