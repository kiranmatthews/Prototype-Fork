import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {homedir} from 'node:os';import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5377/';
const root=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit',out=process.env.STOCK_CACHE_OUTPUT||root+'/browser-cache';await mkdir(out,{recursive:true});
const packed=await build({entryPoints:['src/crateDimensions.ts'],bundle:true,write:false,format:'esm'});
const {migrateCrateLayout}=await import('data:text/javascript;base64,'+Buffer.from(packed.outputFiles[0].text).toString('base64'));
const legacy=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/stock-archive-ancient-gates.json.gz',import.meta.url))));
const migrated=structuredClone(legacy);migrateCrateLayout(migrated.data);
const edited=structuredClone(legacy);edited.data.spawn[0]+=.01;
const report={base,cases:[],errors:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const [name,entry]of [['cached-stock',legacy],['crate-migrated-stock',migrated],['authored-copy',edited]]){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  try{
   await context.addInitScript(entry=>{if(!localStorage.getItem('solProtoUserLevels')){localStorage.setItem('solProtoUserLevels',JSON.stringify([entry]));localStorage.setItem('solProtoCloudPulled','1');}},{...entry});
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   const ready=()=>page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-gate-run'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
   const snapshot=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),data=g.getCurrentLevel().data;return{nativeGates:data.components.filter(c=>c.dkind==='ancienttikigate').length,components:data.components.length,spawn:data.spawn,checkpoints:l.checkpoints.length,archive:localStorage.getItem('solProtoUserLevels'),loading:g.getLoadingDiagnostics(),stamp:document.querySelector('.hud-build')?.textContent};});
   await page.goto(new URL('?playtest&level=jungle-gate-run&lite',base).href,{waitUntil:'domcontentloaded',timeout:180000});await ready();let state=await snapshot();
   assert.equal(state.archive,JSON.stringify([entry]),name+': archived save changed');assert.deepEqual(state.loading.failed,[]);
   if(name==='authored-copy'){assert.equal(state.nativeGates,0);assert.equal(state.spawn[0],edited.data.spawn[0]);}
   else{assert.ok(state.nativeGates>0,'old stock hid recovered native scenery');assert.equal(state.components,3011);assert.equal(state.checkpoints,11);}
   if(name==='cached-stock'){await page.reload({waitUntil:'domcontentloaded'});await ready();const after=await snapshot();assert.equal(after.nativeGates,state.nativeGates);assert.equal(after.archive,state.archive);}
   const {archive,...summary}=state;report.cases.push({name,...summary,archiveUnchanged:true});console.log('PASS '+name);
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);report.pass=true;
}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
