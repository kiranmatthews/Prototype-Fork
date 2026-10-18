import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(arg=>arg.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)??'/private/tmp/level-atlas-export';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],requests=[];
const report={base};const hash=data=>createHash('sha256').update(data).digest('hex');
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('Page crashed'));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{
  const NativeWorker=Worker,live=new Set();window.__atlasWorkers={created:0,peak:0,live};
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);live.add(this);window.__atlasWorkers.created++;window.__atlasWorkers.peak=Math.max(live.size,window.__atlasWorkers.peak);}
   terminate(){live.delete(this);return super.terminate();}
  };
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL,downloads=new Set();window.__atlasDownloadUrls=downloads;
  URL.createObjectURL=function(blob){const url=create.call(this,blob);if(blob.type==='application/zip')downloads.add(url);return url;};
  URL.revokeObjectURL=function(url){downloads.delete(url);return revoke.call(this,url);};
 });
 await page.goto(new URL('provenance/level-atlas/index.html#drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('header [role=status]',{state:'attached'});
 await page.waitForFunction(()=>document.querySelector('#map').dataset.loaded==='drowned-crown',null,{timeout:60000});
 await page.screenshot({path:path.join(out,'before.png')});
 const mapBefore=await page.locator('#viewport').screenshot(),detail=await page.locator('#detail').textContent();
 const link=page.locator('a[href="level-atlas.zip"]'),label=await link.textContent();
 const original=await readFile(new URL('../public/provenance/level-atlas/level-atlas.zip',import.meta.url)),expected=unzipSync(original);
 const download=async name=>{
  const started=Date.now();
  const pending=page.waitForEvent('download',{timeout:180000});await link.click();
  const failure=page.waitForFunction(()=>document.querySelector('header [role=status]').textContent.includes('Could not prepare'),null,{timeout:180000}).then(()=>{throw Error('Atlas export displayed a failure');});
  const item=await Promise.race([pending,failure]);
  assert.equal(item.suggestedFilename(),'level-atlas.zip');const file=path.join(out,name);await item.saveAs(file);
  const raw=await readFile(file),actual=unzipSync(raw);
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());
  for(const key of Object.keys(expected))assert.equal(hash(actual[key]),hash(expected[key]),key);
  assert.equal(await link.getAttribute('aria-disabled'),null);assert.equal(await link.textContent(),label);
  return{bytes:raw.length,seconds:(Date.now()-started)/1000,members:Object.keys(actual).length,allOriginalMemberHashesMatch:true};
 };
 const cdp=await page.context().newCDPSession(page);
 const memory=async()=>{await page.waitForFunction(()=>window.__atlasDownloadUrls.size===0&&window.__atlasWorkers.live.size===0,null,{timeout:10000});await cdp.send('HeapProfiler.collectGarbage');return cdp.send('Runtime.getHeapUsage');};
 report.memoryBefore=await memory();
 report.first=await download('atlas-first.zip');report.memoryAfterFirst=await memory();
 // Fail after earlier files have actually streamed. A retry must not inherit
 // unfinished compression workers or any partial data from the failed ZIP.
 await page.evaluate(()=>{
  window.__atlasNativeFetch=window.fetch;
  window.fetch=function(...args){if(new URL(String(args[0]),location.href).pathname.endsWith('/02-jungle.json'))return Promise.reject(Error('injected partial atlas failure'));return window.__atlasNativeFetch.apply(this,args);};
 });
 await link.click();await page.waitForFunction(()=>document.querySelector('header [role=status]').textContent.includes('Could not prepare'),null,{timeout:30000});
 assert.equal(await link.getAttribute('aria-disabled'),null);assert.equal(await link.textContent(),label);
 assert.equal(await page.evaluate(()=>window.__atlasWorkers.live.size),0);
 await page.evaluate(()=>{window.fetch=window.__atlasNativeFetch;delete window.__atlasNativeFetch;});
 report.retry=await download('atlas-retry.zip');report.memoryAfterRetry=await memory();
 assert.ok(report.memoryAfterRetry.usedSize-report.memoryAfterFirst.usedSize<8*1048576,'retry must not retain another complete archive in the JS heap');
 if(report.memoryAfterRetry.backingStorageSize!==undefined)assert.ok(report.memoryAfterRetry.backingStorageSize-report.memoryAfterFirst.backingStorageSize<8*1048576,'retry must release its member and ZIP buffers');
 report.retryWorks=true;report.viewportExact=hash(await page.locator('#viewport').screenshot())===hash(mapBefore);
 assert.equal(report.viewportExact,true,'export must preserve the gallery drawing and view');assert.equal(await page.locator('#detail').textContent(),detail);
 // The separate editable document remains a normal, byte-identical download.
 const [sketch]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('a[download]').filter({hasText:'Figma import'}).click()]);
 const sketchPath=path.join(out,'Level Atlas.sketch');await sketch.saveAs(sketchPath);
 report.sketchExact=hash(await readFile(sketchPath))===hash(await readFile(new URL('../public/provenance/level-atlas/Level Atlas.sketch',import.meta.url)));assert.equal(report.sketchExact,true);
 await page.waitForFunction(()=>window.__atlasDownloadUrls.size===0&&window.__atlasWorkers.live.size===0,null,{timeout:10000});
 report.workerStats=await page.evaluate(()=>({created:window.__atlasWorkers.created,peak:window.__atlasWorkers.peak,live:window.__atlasWorkers.live.size}));
 assert.equal(report.workerStats.peak,1,'at most one compression worker is active');
 report.downloadUrlsReleased=true;report.hostedArchiveRequests=requests.filter(url=>/level-atlas\.zip(?:$|[?#])/.test(url));assert.deepEqual(report.hostedArchiveRequests,[]);
 report.originalBytes=original.length;report.manifestRequests=requests.filter(url=>url.endsWith('/level-atlas.manifest.json')).length;assert.equal(report.manifestRequests,3);
 await page.screenshot({path:path.join(out,'after.png')});assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;
 console.log(JSON.stringify(report));
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2)+'\n');}
