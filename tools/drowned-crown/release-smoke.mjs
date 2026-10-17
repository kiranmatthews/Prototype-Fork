import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(arg=>/^https?:/.test(arg))??'http://127.0.0.1:5198/';
const lite=process.argv.includes('--lite'),fourK=process.argv.includes('--4k');
const viewport=fourK?{width:3840,height:2160}:{width:1440,height:900};
const out=process.env.DROWNED_SMOKE_OUTPUT??join(tmpdir(),'drowned-crown-release');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 await page.addInitScript(()=>{window.drownedContextLosses=0;document.addEventListener('webglcontextlost',()=>window.drownedContextLosses++,true);});
 page.on('crash',()=>errors.push('Browser page crashed'));
 if(!lite)await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&renderdiag&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
 const loadingPoll=setInterval(async()=>{try{console.log('Loading '+JSON.stringify(await page.evaluate(()=>({resources:performance.getEntriesByType('resource').length,...window.__game?.getLoadingDiagnostics?.()}))));}catch{}},15000);
 try{await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:360000});}finally{clearInterval(loadingPoll);}
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.player.endlessDeaths=true;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);});
 await page.waitForFunction(()=>window.__game.player.grounded);
 const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,spawn:l.currentSpawn.toArray(),checkpoints:l.checkpoints.map(c=>c.active)};});
 const stage=(position,hard=true)=>page.evaluate(({position,hard})=>{const g=window.__game;g.player.respawn(g.getLevel(),hard,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});},{position,hard});
 const report={startedAt:new Date().toISOString(),mode:lite?'lite':fourK?'4k':'full',url:page.url(),stamp:await page.locator('.hud-build').textContent(),spawn:await sample(),views:[]};
 assert.match(report.stamp,/Codex\/sol fork/);assert.equal(report.spawn.grounded,true);
 report.publishedLevel=await page.evaluate(async()=>{const pack=await(await fetch(new URL('levels.json',location.href))).json();const data=pack.levels.find(e=>e.id==='drowned-crown').data;const bowl=data.components.find(c=>c.nm==='Bilge bowl · giant continuous transition');const lamps=data.components.filter(c=>c.nm==='Skate hold · warm upper-balcony lantern light');return{components:data.components.length,bowl:!!bowl,rise:bowl?.rise,paint:bowl?.tex,timberApronBoards:data.components.filter(c=>c.nm==='Bilge bowl · original Meshy timber apron').length,lamps:lamps.length,validLamps:lamps.every(c=>c.w>=.2)};});
 assert.equal(report.publishedLevel.bowl,true);assert.equal(report.publishedLevel.rise,16);assert.equal(report.publishedLevel.lamps,12);assert.equal(report.publishedLevel.validLamps,true);
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
 await stage([1083,0,-245],false);const banked=await sample();
 await page.waitForFunction(n=>window.__game.player.totalDeaths>n,banked.deaths,{timeout:15000});
 await page.waitForFunction(()=>window.__game.player.state==='ride'&&window.__game.player.grounded,null,{timeout:20000});
 report.checkpointRespawn=await sample();assert.equal(report.checkpointRespawn.deaths,banked.deaths+1);
 assert.ok(Math.hypot(report.checkpointRespawn.position[0]-report.checkpointRespawn.spawn[0],report.checkpointRespawn.position[2]-report.checkpointRespawn.spawn[2])<2.1);
 console.log('Release smoke: checkpoint respawn');
 for(const [name,pos] of [['bowl-overlook',[1000,16.1,-165]],['bowl-floor',[1000,.1,-230]],['upper-catwalk',[1064,26.1,-208]],['treasury',[1032,20.1,-425]]]){
  await stage(pos);await page.waitForTimeout(1800);const state=await sample();assert.equal(state.grounded,true,`${name} unsupported`);
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
