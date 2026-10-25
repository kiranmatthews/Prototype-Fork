import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5198/';
const full=process.argv.includes('--4k');
const out=process.env.LEVEL_SYNC_OUTPUT??path.join(tmpdir(),'level-sync-browser');
const viewport=full?{width:3840,height:2160}:{width:1440,height:900};
const errors=[],requests=[],report={mode:full?'4k':'lite',checks:[],views:[]};
const hash=value=>createHash('sha256').update(value).digest('hex');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const context=await browser.newContext({viewport,deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('page crashed'));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/levels.json'))requests.push(request.url());});
 await page.addInitScript(full=>{
  if(full)localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));
  window.syncContextLosses=0;document.addEventListener('webglcontextlost',()=>window.syncContextLosses++,true);
 },full);
 const ready=async()=>{
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.waitForFunction(()=>window.__game.player.grounded);
  await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();});
  const state=await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,name:g.getCurrentLevel().name,
   components:g.getLevel().builtFromData.components.length,grounded:g.player.grounded,contextLosses:window.syncContextLosses,
   loading:g.getLoadingDiagnostics(),pulled:localStorage.getItem('solProtoCloudPulled'),saved:localStorage.getItem('solProtoUserLevels')?.length,
   userIds:JSON.parse(localStorage.getItem('solProtoUserLevels')??'[]').map(e=>e.id),stamp:document.querySelector('.hud-build')?.textContent};});
  assert.equal(state.components,1446);assert.equal(state.contextLosses,0);assert.deepEqual(state.loading.failed,[]);assert.deepEqual(state.loading.pending,[]);
  assert.match(state.stamp,/Codex\/sol fork/);return state;
 };
 await page.goto(new URL(`?playtest&renderdiag&level=drowned-crown${full?'':'&lite'}`,base).href,{waitUntil:'domcontentloaded',timeout:120000});
 report.cold=await ready();assert.equal(report.cold.pulled,'1');assert.deepEqual(report.cold.userIds,['flats']);assert.ok(report.cold.saved<18000);
 assert.equal(requests.length,1);report.checks.push('fresh browser adopts compact pack and renders full source Crown');
 const built=await readFile('dist/levels.json');
 const served=await context.request.get(new URL('levels.json',base).href);const servedBytes=await served.body();
 assert.equal(hash(servedBytes),hash(built));report.downloadBytes=servedBytes.length;report.downloadSha256=hash(servedBytes);
 if(!full){
  await page.reload({waitUntil:'domcontentloaded'});report.reload=await ready();assert.equal(requests.length,1);report.checks.push('reload uses saved overrides without another pack download');
  await page.evaluate(()=>{const g=window.__game,e=g.findLevel('drowned-crown');g.saveUserLevel({...e,name:'My local Drowned Crown',data:{...e.data,name:'My local Drowned Crown'}});localStorage.removeItem('solProtoCloudPulled');});
  const authored=await page.evaluate(()=>localStorage.getItem('solProtoUserLevels'));assert.ok(authored.includes('My local Drowned Crown'));
  await page.reload({waitUntil:'domcontentloaded'});const local=await ready();assert.equal(local.name,'My local Drowned Crown');assert.equal(requests.length,1);
  assert.equal(await page.evaluate(()=>localStorage.getItem('solProtoUserLevels')),authored);report.checks.push('authored Crown wins on reload and retires automatic sync');
  const remote=await page.evaluate(()=>{const levels=JSON.parse(localStorage.getItem('solProtoUserLevels'));const e=levels.find(e=>e.id==='drowned-crown');e.name=e.data.name='Cloud Drowned Crown';e.data.components[0].nm='Cloud restore quota proof '.repeat(4);return {v:2,levels};});
  await page.route('**/levels.json?*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(remote)}));
  const quota=await page.evaluate(()=>{
   localStorage.removeItem('solProtoCloudPulled');
   let low=0,high=6*1024*1024;
   while(low<high){const mid=Math.ceil((low+high)/2);try{localStorage.setItem('syncQuotaProof','x'.repeat(mid));low=mid;}catch{high=mid-1;}}
   localStorage.setItem('syncQuotaProof','x'.repeat(low));
   let full=false;try{localStorage.setItem('syncQuotaProof','x'.repeat(low+1));}catch{full=true;}
   window.syncBeforeLevel=window.__game.getLevel();return {fillerCharacters:low,full};
  });assert.equal(quota.full,true);
  await page.evaluate(()=>window.__game.ui.onForceResync());
  const refused=await page.evaluate(()=>({sameRun:window.__game.getLevel()===window.syncBeforeLevel,
   name:window.__game.findLevel('drowned-crown').name,pulled:localStorage.getItem('solProtoCloudPulled'),saved:localStorage.getItem('solProtoUserLevels')}));
  assert.equal(refused.sameRun,true);assert.equal(refused.name,'My local Drowned Crown');assert.equal(refused.pulled,null);assert.equal(refused.saved,authored);
  report.quota={...quota,sameRun:refused.sameRun,retainedSavedSha256:hash(refused.saved)};report.checks.push('actual browser quota failure retains live run, local archive and authorship');
  await page.evaluate(()=>localStorage.removeItem('syncQuotaProof'));await page.evaluate(()=>window.__game.ui.onForceResync());
  report.restored=await ready();assert.equal(report.restored.name,remote.levels.find(e=>e.id==='drowned-crown').name);assert.equal(report.restored.pulled,'1');
  await page.reload({waitUntil:'domcontentloaded'});report.restoredReload=await ready();assert.equal(report.restoredReload.name,report.restored.name);
  report.checks.push('successful restore and reload retain the complete edited level');
 }
 if(full){
  for(const [name,position]of [['harbour',[-72,-5.3,205]],['exterior-ship',[-48,-6.1,-75]],['broken-gangways',[1000,10,-177]]]){
   await page.evaluate(async position=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();},position);
   await page.waitForFunction(()=>window.__game.player.grounded);await page.waitForTimeout(1000);
   const view=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{scenery:(l.jungleAssets?.cells??[]).filter(c=>c.mesh).map(c=>({kind:c.kind,count:c.mesh.count})),water:!!l.water,loading:g.getLoadingDiagnostics()};});
   const kind=name==='harbour'?'crowncrashboardwalk':name==='exterior-ship'?'crowncrashexteriorship':'crowncrashboardwalk';
   assert.ok(view.scenery.some(c=>c.kind===kind&&c.count>0));assert.deepEqual(view.loading.failed,[]);assert.deepEqual(view.loading.pending,[]);
   await page.screenshot({path:path.join(out,name+'.png')});report.views.push({name,...view});
  }
  report.resolution=await page.evaluate(()=>JSON.parse(document.querySelector('#render-diagnostics').textContent));
  assert.deepEqual(report.resolution.drawingBuffer,viewport);assert.equal(report.resolution.settings.enabled,false);
  assert.equal(await page.evaluate(()=>window.syncContextLosses),0);report.checks.push('fresh native 4K harbour, Meshy boardwalk, exterior ship and hold');
 }
 assert.deepEqual(errors,[]);report.pass=true;console.log(JSON.stringify({pass:true,mode:report.mode,downloadBytes:report.downloadBytes,checks:report.checks}));
}finally{report.errors=errors;report.requests=requests;await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
