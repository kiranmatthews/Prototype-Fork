// Local CPU attribution for the longest startup task. Build with --sourcemap
// to resolve bundled samples to source files; raw profiles stay in --out.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(import.meta.url),root=fileURLToPath(new URL('../../',import.meta.url));
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const {SourceMapConsumer}=require('source-map-js');
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'drowned-startup');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Browser page crashed'));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{
  window.__startup={tasks:[],stages:[]};performance.setResourceTimingBufferSize(4000);
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__startup.tasks.push({at:e.startTime,ms:e.duration});}).observe({entryTypes:['longtask']});
  const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='solProtoStabilityV1'){try{const e=JSON.parse(value).sessions.at(-1).events.at(-1);window.__startup.stages.push({stage:e.stage,at:performance.now()});}catch{}}return set.call(this,key,value);};
 });
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown&lite',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const {profile}=await cdp.send('Profiler.stop'),{metrics}=await cdp.send('Performance.getMetrics');
 const runtime=await page.evaluate(()=>({...window.__startup,readyMs:performance.now(),loading:window.__game.getLoadingDiagnostics()}));
 await writeFile(out+'/cpu.cpuprofile',JSON.stringify(profile));
 const nav=metrics.find(m=>m.name==='NavigationStart')?.value*1e6;
 const first=runtime.tasks.reduce((a,b)=>a.ms>b.ms?a:b),nodes=new Map(profile.nodes.map(n=>[n.id,n])),parent=new Map(),self=new Map(),total=new Map(),maps=new Map();
 for(const n of profile.nodes)for(const child of n.children??[])parent.set(child,n.id);
 let clock=profile.startTime;
 for(let i=0;i<profile.samples.length;i++){
  const us=profile.timeDeltas[i];clock+=us;const ms=(clock-nav)/1000;if(ms<first.at||ms>first.at+first.ms)continue;
  const id=profile.samples[i];self.set(id,(self.get(id)??0)+us/1000);let n=id;while(n){total.set(n,(total.get(n)??0)+us/1000);n=parent.get(n);}
 }
 async function label(id){const n=nodes.get(id),c=n.callFrame;let original=null;
  if(c.url.startsWith(new URL(base).origin)&&new URL(c.url).pathname.includes('/assets/')){const pathname=new URL(c.url).pathname,path=pathname.slice(pathname.indexOf('/assets/'));if(!maps.has(path)){try{maps.set(path,new SourceMapConsumer(JSON.parse(await readFile(root+'dist'+path+'.map','utf8'))));}catch{maps.set(path,null);}}
   original=maps.get(path)?.originalPositionFor({line:c.lineNumber+1,column:c.columnNumber});}
  return{name:c.functionName,source:original?.source??c.url,line:original?.line??c.lineNumber+1,originalName:original?.name,selfMs:Math.round(self.get(id)??0),totalMs:Math.round(total.get(id)??0)};
 }
 const report={base,runtime,errors,longestTask:first,metrics,topSelf:[],topTotal:[]};
 for(const [id]of [...self].sort((a,b)=>b[1]-a[1]).slice(0,35))report.topSelf.push(await label(id));
 for(const [id]of [...total].sort((a,b)=>b[1]-a[1]).slice(0,45))report.topTotal.push(await label(id));
 await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({readyMs:runtime.readyMs,longestTask:first,topSelf:report.topSelf.slice(0,8),errors},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(runtime.loading.pending,[]);assert.deepEqual(runtime.loading.failed,[]);
}finally{await browser.close();}
