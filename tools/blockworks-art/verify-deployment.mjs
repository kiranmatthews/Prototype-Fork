import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_DEPLOY_URL||'https://kiranmatthews.github.io/Prototype-Fork/';
const revision=process.env.BLOCKWORKS_DEPLOY_SHA||'';
const out=process.env.BLOCKWORKS_DEPLOY_OUTPUT||'docs/blockworks-art/deployment';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('tools/blockworks-art/asset-manifest.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'?playtest&level=codex-lab&release='+encodeURIComponent(revision),{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 const state=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),components=l.captureData().components,lamp=components.find(c=>c.dkind==='bw-lantern');return {lanternPlacement:lamp?{p:lamp.p,rise:lamp.rise,s:lamp.s}:null,wedges:{stone:components.filter(c=>c.dkind==='bw-stone-wedge').length,metal:components.filter(c=>c.dkind==='bw-metal-wedge').length},name:l.name,sky:l.skyPreset,stamp:document.querySelector('.hud-build')?.textContent,assets:l.blockworksArtDiagnostics,position:g.player.pos.toArray(),grounded:g.player.grounded,frame:g.getRenderFrameStats()};
 });
 assert.equal(state.name,'Haunted Hassle');
 assert.equal(state.sky,'haunted');
 assert.equal(state.lanternPlacement?.rise,1.85,'the storyboard-scale lantern placement must be deployed');
 assert.match(state.stamp,/Codex\/sol fork/);
 for(const status of Object.values(state.assets.surfaces.models))assert.equal(status,'ready');
 for(const model of Object.values(state.assets.scenery.models))assert.equal(model.status,'ready');
 for(const status of Object.values(state.assets.mattes.textures))assert.equal(status,'ready');
 assert.deepEqual(Object.keys(state.assets.surfaces.models).sort(),['bw-aqueduct-coping','bw-aqueduct-v3','bw-flagstone-deck-v4','bw-grind-rail','bw-ice-deck','bw-metal-wedge','bw-rivet-deck-v2','bw-stone-wedge']);
 for(const kind of ['bw-parapet-v2','bw-spire-v2','bw-viaduct-v2','bw-jungle-shelf-v2','bw-coaster-v2'])assert.equal(state.assets.scenery.models[kind]?.status,'ready',kind+' fidelity component');
 assert.equal(Object.keys(state.assets.surfaces.models).length+Object.keys(state.assets.scenery.models).length,25);
 assert.equal(state.assets.scenery.boundCrates,703);
 assert.deepEqual(state.wedges,{stone:14,metal:5});
 assert.equal(state.assets.scenery.visibleBoundCrates,3,'fresh run keeps the 700 structural blocks ghosted and the three switches visible');
 await page.keyboard.down('ArrowUp');await page.waitForTimeout(850);await page.keyboard.up('ArrowUp');await page.waitForTimeout(120);
 const movement=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,state:window.__game.player.state,deaths:window.__game.player.totalDeaths}));
 assert.ok(Math.hypot(movement.position[0]-state.position[0],movement.position[2]-state.position[2])>.5,'deployed game must respond to actual keyboard input');
 assert.equal(movement.deaths,0);
 const provenance={};
 for(const name of ['flagstone-deck-v4','stone-wedge','metal-wedge','grind-rail','steel-switch','rivet-deck-v2','aqueduct-v3']){
  const response=await page.request.get(base+'blockworks-art/'+name+'.provenance.json?release='+encodeURIComponent(revision));
  assert.ok(response.ok(),name+' provenance');
  const data=await response.json();assert.equal(data.sha256,manifest[name].sha256,name+' deployed provenance');
  const model=await page.request.get(base+'blockworks-art/'+name+'.glb?release='+encodeURIComponent(revision));assert.ok(model.ok(),name+' deployed GLB');
  const actual=createHash('sha256').update(await model.body()).digest('hex');assert.equal(actual,manifest[name].sha256,name+' deployed GLB bytes');provenance[name]=actual;
 }
 await page.screenshot({path:out+'/deployed-blockworks.png'});
 const report={checkedAt:new Date().toISOString(),url:base+'?playtest&level=codex-lab',revision,state,movement,provenance,errors};
 await writeFile(out+'/verification.json',JSON.stringify(report,null,2)+'\n');
 assert.deepEqual(errors,[],'deployed browser errors');
 console.log(JSON.stringify(report));
}finally{await browser.close();}
