import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(arg=>arg.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(arg=>arg.startsWith('--out='))?.slice(6)??'/private/tmp/release-font-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],requests=[];
const report={base};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,acceptDownloads:true});
 page.on('pageerror',error=>errors.push(error.message));page.on('crash',()=>errors.push('Page crashed'));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('request',request=>requests.push(request.url()));
 await page.addInitScript(()=>{
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL,live=new Set();window.__fontObjectUrls=live;
  URL.createObjectURL=function(...args){const url=create.apply(this,args);live.add(url);return url;};
  URL.revokeObjectURL=function(url){live.delete(url);return revoke.call(this,url);};
 });
 await page.goto(new URL('roo-type-lab.html',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.rooTypeLab?.ready,null,{timeout:60000});
 await page.locator('#shimmer').uncheck();await page.waitForTimeout(250);
 const metrics=await page.evaluate(()=>window.rooTypeLab.metrics());report.version=metrics.version;
 const original=await readFile(new URL(`../public/fonts/roo-image-font-v${metrics.version}.zip`,import.meta.url));
 const expected=unzipSync(original),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 await page.evaluate(()=>{window.__fontCanvasBefore=document.querySelector('canvas').toDataURL();});
 const label=await page.locator('#atlas').textContent();
 const download=async name=>{
  const [download]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.locator('#atlas').click()]);
  assert.equal(download.suggestedFilename(),`roo-image-font-v${metrics.version}.zip`);
  const target=path.join(out,name);await download.saveAs(target);
  const raw=await readFile(target),actual=unzipSync(raw);
  assert.deepEqual(Object.keys(actual).sort(),Object.keys(expected).sort());
  for(const key of Object.keys(expected))assert.equal(hash(actual[key]),hash(expected[key]),key+' must preserve its original bytes');
  assert.equal(await page.locator('#atlas').isEnabled(),true);assert.equal(await page.locator('#atlas').textContent(),label);
  return{bytes:raw.length,entries:Object.entries(actual).map(([name,bytes])=>({name,bytes:bytes.length,sha256:hash(bytes)}))};
 };
 report.firstDownload=await download('font-first.zip');
 // A failed request must leave the studio usable and its action retryable.
 await page.evaluate(()=>{
  window.__fontNativeFetch=window.fetch;
  window.fetch=function(...args){if(String(args[0]).endsWith('.manifest.json'))return Promise.reject(Error('injected font download failure'));return window.__fontNativeFetch.apply(this,args);};
 });
 await page.locator('#atlas').click();
 await page.waitForFunction(()=>document.querySelector('#report').textContent.includes('Could not prepare'));
 assert.equal(await page.locator('#atlas').isEnabled(),true);assert.equal(await page.locator('#atlas').textContent(),label);
 await page.evaluate(()=>{window.fetch=window.__fontNativeFetch;delete window.__fontNativeFetch;});
 report.retryDownload=await download('font-retry.zip');
 report.canvasExact=await page.evaluate(()=>window.__fontCanvasBefore===document.querySelector('canvas').toDataURL());
 assert.equal(report.canvasExact,true,'export does not alter the font artwork or preview settings');
 await page.waitForFunction(()=>window.__fontObjectUrls.size===0,null,{timeout:10000});
 report.objectUrlsReleased=true;report.retryWorks=true;report.originalBytes=original.length;
 report.archiveRequests=requests.filter(url=>/\.zip(?:$|\?)/.test(url));assert.deepEqual(report.archiveRequests,[],'the public download no longer fetches a duplicate hosted ZIP');
 report.manifestRequests=requests.filter(url=>url.endsWith('.manifest.json')).length;assert.equal(report.manifestRequests,2);
 await page.screenshot({path:path.join(out,'studio.png')});
 assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;
 console.log(JSON.stringify({pass:true,version:report.version,members:report.firstDownload.entries.length,downloadBytes:report.firstDownload.bytes,canvasExact:report.canvasExact,retryWorks:true,archiveRequests:0,errors}));
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify({...report,errors},null,2)+'\n');}
