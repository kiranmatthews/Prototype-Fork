import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5198/';
const full=process.argv.includes('--4k'),out=process.env.DROWNED_STOCK_OUTPUT??join(tmpdir(),'drowned-stock-browser');
const viewport=full?{width:3840,height:2160}:{width:1440,height:900};
const legacy=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/drowned-crown-stock.json.gz',import.meta.url))));
const saved=JSON.stringify([legacy]);
const published=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8')).levels.find(e=>e.id==='drowned-crown');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={mode:full?'4k':'lite',views:[]};
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('crash',()=>errors.push('Browser page crashed'));
 await page.addInitScript(({saved,full})=>{
  if(localStorage.getItem('solProtoUserLevels')===null)localStorage.setItem('solProtoUserLevels',saved);
  localStorage.setItem('solProtoCloudPulled','1');
  if(full)localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));
  window.stockContextLosses=0;document.addEventListener('webglcontextlost',()=>window.stockContextLosses++,true);
 },{saved,full});
 await page.goto(new URL(`?playtest&renderdiag&level=drowned-crown${full?'':'&lite'}`,base).href,{waitUntil:'domcontentloaded',timeout:120000});
 const ready=async()=>{
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.waitForFunction(()=>window.__game.player.grounded);
  const actual=await page.evaluate(()=>window.__game.getLevel().builtFromData);
  const clock=actual.components.pop();assert.deepEqual(clock,{t:'clock',p:[-70,-5.88,200]});
  // Chrome and Node differ at a few trig rounding boundaries in procedural
  // placement. Check every field, allowing only sub-nanometre numeric drift.
  let floatDifferences=0,maxNumericDifference=0;
  const compare=(a,b,path='level')=>{
   if(typeof a==='number'&&typeof b==='number'){
    const delta=Math.abs(a-b);assert.ok(delta<=1e-9,`${path}: ${a} != ${b}`);
    if(delta){floatDifferences++;maxNumericDifference=Math.max(maxNumericDifference,delta);}return;
   }
   if(a&&b&&typeof a==='object'&&typeof b==='object'){
    assert.equal(Array.isArray(a),Array.isArray(b),path);
    assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),path);
    for(const key of Object.keys(a))compare(a[key],b[key],path+'.'+key);return;
   }
   assert.equal(a,b,path);
  };
  compare(actual,published.data);report.sourceComparison={floatDifferences,maxNumericDifference};
  assert.equal(await page.evaluate(()=>localStorage.getItem('solProtoUserLevels')),saved,'stock lookup must preserve old recoverable bytes');
 };
 await ready();report.coldComponents=published.data.components.length+1;
 if(!full){await page.reload({waitUntil:'domcontentloaded'});await ready();report.reload=true;}
 for(const [name,position]of [['harbour',[-72,-5.3,205]],['exterior-ship',[-48,-6.1,-75]],['bowl-overlook',[1000,16.1,-165]]]){
  await page.evaluate(async position=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();},position);
  await page.waitForFunction(()=>window.__game.player.grounded);
  await page.waitForTimeout(1200);
  const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{grounded:g.player.grounded,position:g.player.pos.toArray(),loading:g.getLoadingDiagnostics(),contextLosses:window.stockContextLosses,memory:{...g.renderer.info.memory},scenery:(l.jungleAssets?.cells??[]).filter(c=>c.mesh).map(c=>({kind:c.kind,count:c.mesh.count})),water:!!l.water,stamp:document.querySelector('.hud-build')?.textContent};});
  assert.equal(state.grounded,true);assert.equal(state.contextLosses,0);assert.deepEqual(state.loading.failed,[]);assert.deepEqual(state.loading.pending,[]);
  const kind=name==='harbour'?'crowncrashboardwalk':name==='exterior-ship'?'crowncrashexteriorship':'crownmeshyplankchipped';
  assert.ok(state.scenery.some(c=>c.kind===kind&&c.count>0),`${kind} must be loaded as native scenery`);
  if(name==='harbour')assert.equal(state.water,true);
  assert.match(state.stamp,/Codex\/sol fork/);
  await page.screenshot({path:join(out,name+'.png')});report.views.push({name,...state});
  console.log(JSON.stringify({name,grounded:state.grounded,residentCells:state.scenery.length,errors:state.loading.failed}));
 }
 report.resolution=await page.evaluate(()=>JSON.parse(document.querySelector('#render-diagnostics').textContent));
 if(full){assert.deepEqual(report.resolution.drawingBuffer,viewport);assert.equal(report.resolution.settings.enabled,false);}
 assert.deepEqual(errors,[]);report.pass=true;
}finally{report.errors=errors;await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
