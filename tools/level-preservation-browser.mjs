import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {homedir} from 'node:os';import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5377/';
const native=process.argv.includes('--full'),full=native||process.argv.includes('--normal'),root=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';
const out=process.env.LEVEL_BROWSER_OUTPUT||root+'/browser-'+(native?'native':full?'normal':'lite');await mkdir(out,{recursive:true});
const expected=JSON.parse(await readFile(root+'/current-registry.json','utf8'));
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',');
const entries=expected.filter(e=>only?only.includes(e.id):!full||['jungle-gate-run','bonus-jungle-gate','bonus-jungle-terraces','ghost-train'].includes(e.id));
assert.ok(entries.length,'No matching audit levels');
if(only)assert.equal(entries.length,new Set(only).size,'Unknown audit level');
// Compile the checked-out definitions independently in the browser's own JS
// engine. This verifies full data, including topology, without weakening exact
// comparisons for Node/Chrome differences in generated mesh subdivision.
const fixture=await build({stdin:{contents:"export {BUILTIN_LEVELS,migrateCustomLevel} from './src/level';",resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'levelAuditSource',logLevel:'error',platform:'browser',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':JSON.stringify(new URL(base).pathname),'import.meta.env.PROD':'true','import.meta.env.DEV':'false'}});
const report={base,full,native,levels:[],errors:[],assets:[]};const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(let at=0;at<entries.length;at+=full?1:8){
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
  try{
   if(native)await context.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:1,enabled:false,baseHeight:720,outputMultiplier:1,fixed60:true})));
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   page.on('response',r=>{if(r.status()>=400)report.assets.push({url:r.url(),status:r.status()});});
   const first=entries[at];
   await page.goto(new URL('?playtest&level='+first.id+(full?'':'&lite'),base).href,{waitUntil:'domcontentloaded',timeout:180000});
   await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,first.id,{timeout:240000});
   await page.addScriptTag({content:fixture.outputFiles[0].text});
   for(const entry of entries.slice(at,at+(full?1:8))){
    const state=await page.evaluate(async id=>{
     const g=window.__game;if(g.getCurrentLevel().id!==id&&!g.switchLevel(id))throw Error('Construction refused '+id);
     const l=g.getLevel();await l.prepareJungleAssets();await l.prepareSurfaceImages();
     if(id==='ghost-train')await l.prepareGhostTrainAssets();
     const fingerprint=data=>{if(!data)return null;const text=JSON.stringify(data,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);let a=2166136261,b=2246822519;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b^text.charCodeAt(i),3266489917);}return `${text.length}:${(a>>>0).toString(16)}:${(b>>>0).toString(16)}`;};
     const current=g.getCurrentLevel(),expected=window.levelAuditSource.BUILTIN_LEVELS.find(e=>e.id===id);return {expectedSource:fingerprint(expected.data),expectedBuilt:expected.data?fingerprint(window.levelAuditSource.migrateCustomLevel(JSON.parse(JSON.stringify(expected.data)))):null,id:current.id,name:current.name,source:fingerprint(current.data),built:fingerprint(l.builtFromData),components:l.builtFromData?.components.length??null,
      checkpoints:l.checkpoints.length,crates:l.totalCrates,bonus:l.hudMode==='bonus',loading:g.getLoadingDiagnostics(),ancient:l.ancientMechanismDiagnostics,jungle:l.jungleAssetDiagnostics,castleTextures:id==='ghost-train'?l.ghostTrainDiagnostics.textures:null,stamp:document.querySelector('.hud-build')?.textContent};
    },entry.id);
    assert.equal(state.id,entry.id,'silent fallback');
    assert.equal(state.source,state.expectedSource,entry.id+': stale selected source');
    if(state.expectedBuilt)assert.equal(state.built,state.expectedBuilt,entry.id+': stale constructed data');
    state.nodeReferenceDiffers=state.source!==entry.source;
    if(entry.bonus)assert.equal(state.checkpoints,0,entry.id+': bonus checkpoint resurfaced');
    assert.deepEqual(state.loading.failed,[],entry.id+': failed asset');assert.match(state.stamp,/Codex\/sol fork/);
    if(state.castleTextures)for(const kind of ['stone','floor','timber','bath'])assert.equal(state.castleTextures[kind],'ready',entry.id+': '+kind+' texture fallback');
    if(full){
     if(native)await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
     await page.waitForTimeout(750);
     state.presentation=await page.evaluate(()=>{const g=window.__game;return {grounded:g.player.grounded,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],ancient:g.getLevel().ancientMechanismDiagnostics};});
     if(native)assert.deepEqual(state.presentation.buffer,[1600,1000]);assert.equal(state.presentation.grounded,true,entry.id+': unsupported spawn');
     if(state.presentation.ancient){assert.deepEqual(state.presentation.ancient.errors,[]);assert.equal(state.presentation.ancient.ready,state.presentation.ancient.requested);}
     await page.screenshot({path:join(out,entry.id+'.png')});
    }
    report.levels.push(state);await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS '+entry.id+' '+state.components+' components');
   }
  }finally{await context.close();}
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.assets,[]);report.pass=true;
}finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
