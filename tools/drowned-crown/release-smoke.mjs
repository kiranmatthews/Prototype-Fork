import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(arg=>/^https?:/.test(arg))??'http://127.0.0.1:5198/';
const lite=process.argv.includes('--lite'),fourK=process.argv.includes('--4k');
const viewFilter=process.argv.find(arg=>arg.startsWith('--views='))?.slice(8).split(',');
const viewport=fourK?{width:3840,height:2160}:{width:1440,height:900};
const out=process.env.DROWNED_SMOKE_OUTPUT??join(tmpdir(),'drowned-crown-release');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 await page.addInitScript(()=>{window.drownedContextLosses=0;document.addEventListener('webglcontextlost',()=>window.drownedContextLosses++,true);});
 page.on('crash',()=>errors.push('Browser page crashed'));
 if(!lite)await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const launchStarted=Date.now();
 await page.goto(`${base}?playtest&renderdiag&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
 const loadingPoll=setInterval(async()=>{try{console.log('Loading '+JSON.stringify(await page.evaluate(()=>({resources:performance.getEntriesByType('resource').length,...window.__game?.getLoadingDiagnostics?.()}))));}catch{}},15000);
 try{await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:360000});}finally{clearInterval(loadingPoll);}
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.player.endlessDeaths=true;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);});
 await page.waitForFunction(()=>window.__game.player.grounded);
 const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,spawn:l.currentSpawn.toArray(),checkpoints:l.checkpoints.map(c=>c.active)};});
 const stage=(position,hard=true)=>page.evaluate(({position,hard})=>{const g=window.__game;g.player.respawn(g.getLevel(),hard,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});},{position,hard});
 const report={startedAt:new Date(launchStarted).toISOString(),launchSeconds:(Date.now()-launchStarted)/1000,mode:lite?'lite':fourK?'4k':'full',url:page.url(),stamp:await page.locator('.hud-build').textContent(),spawn:await sample(),views:[]};
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.spawn.grounded,true);
 report.publishedLevel=await page.evaluate(async()=>{const pack=await(await fetch(new URL('levels.json',location.href))).json();const override=pack.levels.find(e=>e.id==='drowned-crown');let source='sync override';if(!override){const proof=await(await fetch(new URL('provenance/level-sync.json',location.href))).json();if(!proof.sourceBacked?.includes('drowned-crown'))throw new Error('Crown missing from the published library');source='bundled source';}const data=override?.data??window.__game.findLevel('drowned-crown').data;const c=data.components;return{source,components:c.length,
  oldBowl:c.some(c=>c.nm==='Bilge bowl · giant continuous transition'),
  ferries:c.filter(c=>c.t==='mover'&&c.nm?.startsWith('Wreck ferry')).length,
  crumbles:c.filter(c=>c.t==='crumble'&&c.nm?.startsWith('Wreck collapse')).length,
  boardwalks:c.filter(c=>c.dkind==='crowncrashboardwalk'&&c.nm?.startsWith('Wreck boardwalk')).length,
  enemies:c.filter(c=>c.t==='enemy'&&c.nm?.startsWith('Wreck encounter')).length,
  checkpoints:c.filter(c=>c.t==='checkpoint').length};});
 assert.equal(report.publishedLevel.oldBowl,false);assert.equal(report.publishedLevel.ferries,2);
 assert.equal(report.publishedLevel.crumbles,4);assert.equal(report.publishedLevel.boardwalks,8);
 assert.equal(report.publishedLevel.enemies,13);assert.equal(report.publishedLevel.checkpoints,17);
 console.log('Release smoke: supported launch');
 await stage([8,0,177]);const before=await sample();
 await page.waitForFunction(n=>window.__game.player.totalDeaths>n,before.deaths,{timeout:15000});
 await page.waitForFunction(()=>window.__game.player.state==='ride'&&window.__game.player.grounded,null,{timeout:20000});
 report.pitRespawn=await sample();assert.equal(report.pitRespawn.deaths,before.deaths+1);
 assert.ok(Math.hypot(report.pitRespawn.position[0]+72,report.pitRespawn.position[2]-205)<2.1);
 console.log('Release smoke: pit respawn');
 await stage([1004,8.1,-127.8]);await page.waitForTimeout(500);
 await page.evaluate(()=>{const p=window.__game.player,step=p.step.bind(p);p.step=(dt,input,level)=>{input.spinHeld=true;input.spinPressed=true;step(dt,input,level);p.step=step;};});
 await page.waitForFunction(()=>window.__game.getLevel().checkpoints.some(c=>c.active&&Math.hypot(c.spawnPos.x-1004,c.spawnPos.z+129)<4),null,{timeout:6000});
 report.checkpoint=await sample();
 await stage([1015,0,-245],false);const banked=await sample();
 await page.waitForFunction(n=>window.__game.player.totalDeaths>n,banked.deaths,{timeout:15000});
 await page.waitForFunction(()=>window.__game.player.state==='ride'&&window.__game.player.grounded,null,{timeout:20000});
 report.checkpointRespawn=await sample();assert.equal(report.checkpointRespawn.deaths,banked.deaths+1);
 assert.ok(Math.hypot(report.checkpointRespawn.position[0]-report.checkpointRespawn.spawn[0],report.checkpointRespawn.position[2]-report.checkpointRespawn.spawn[2])<2.1);
 console.log('Release smoke: checkpoint respawn');
 for(const [name,pos] of [['harbour',[-72,-5.4,205]],['opening-boardwalk',[-55.5,-5.9,138]],['scenic-ship',[-48,-5.9,-75]],['cargo-zigzag',[1000,8.1,-132]],['broken-gangways',[1000,10,-177]],['cargo-ferries',[1001,10.6,-233]],['loose-pallets',[999,11.9,-277]],['broken-stern',[1000,13.5,-319]],['cargo-combs',[1000,16.1,-363]],['stamping-machinery',[1000,18.5,-418]],['high-shelves',[1000,20.5,-469]],['broadside-stair',[1000,16.1,-618]],['broadside-hoist',[1047,19.7,-618]],['broadside-timber',[1105,18.7,-618]],['escape-bridge',[1151,16.1,-621]],['treasury',[1180,20.1,-681]]]){
  if(viewFilter&&!viewFilter.includes(name))continue;
  await stage(pos);await page.waitForTimeout(1800);const state=await sample();assert.equal(state.grounded,true,`${name} unsupported`);
  if(name==='broadside-hoist'||name==='broadside-timber'){
   state.cameraDistance=await page.evaluate(()=>{const g=window.__game;return g.camera.position.distanceTo(g.player.renderPosition.clone().add({x:0,y:1.3,z:0}));});
   assert.ok(state.cameraDistance>17.5&&state.cameraDistance<18.5,'broadside camera must reveal the next landing');
  }
  await page.screenshot({path:`${out}/${name}.png`});report.views.push({name,...state,render:await page.evaluate(()=>{const info=window.__game.renderer.info;return{...info.render,memory:{...info.memory},contextLosses:window.drownedContextLosses};})});console.log('Release smoke: '+name);
 }
 report.resolution=await page.evaluate(()=>JSON.parse(document.querySelector('#render-diagnostics').textContent));
 if(!lite){assert.equal(report.resolution.settings.enabled,false);assert.deepEqual(report.resolution.drawingBuffer,viewport);}
 report.loading=await page.evaluate(()=>window.__game.getLoadingDiagnostics());
 report.contextLosses=await page.evaluate(()=>window.drownedContextLosses);
 assert.equal(report.contextLosses,0);assert.deepEqual(report.loading.failed,[]);
 report.errors=errors;await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({pass:true,stamp:report.stamp,errors,views:report.views.map(v=>v.name)}));
}finally{await browser.close();}
