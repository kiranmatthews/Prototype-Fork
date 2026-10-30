import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {airCargoPilot} from './carlisle-air-cargo-pilot.mjs';
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const lite=process.argv.includes('--lite'),base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484';
const out=process.env.CARLISLE_AUDIO_OUT??`art/carlisle-shipyard/harbour-sound/${lite?'lite':'review'}`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,lite,errors:[]};
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
const ambienceRequests=[];page.on('request',r=>{if(r.url().includes('/sfx/carlisle/'))ambienceRequests.push(r.url());});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const keys=new Set();
async function press(input){
 const next=new Set();if(input.jumpHeld)next.add('Space');if(input.moveY)next.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.moveX)next.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.spinHeld)next.add('KeyF');
 for(const key of [...keys])if(!next.has(key)){await page.keyboard.up(key);keys.delete(key);}
 for(const key of next)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
}
const snapshot=()=>page.evaluate(()=>{const g=window.__game,s=g.sfx;return{level:g.getCurrentLevel().id,context:s.ctx.state,sfxBusGain:s.sfxBus.gain.value,mix:g.getLevel().carlisleShipyardDiagnostics?.ambience,loops:[...s.loops.entries()].filter(([id])=>id.startsWith('carlisle-')).map(([id,c])=>({id,name:c.name,gain:c.gain.gain.value,rate:c.src.playbackRate.value,duration:c.src.buffer.duration,channels:c.src.buffer.numberOfChannels,end:c.src.loopEnd,correctBuffer:c.src.buffer===s.buffers.get(c.name)}))};});
const rms=()=>page.evaluate(async()=>{const s=window.__game.sfx,a=s.ctx.createAnalyser();a.fftSize=2048;s.master.connect(a);const values=[];for(let i=0;i<8;i++){await new Promise(r=>setTimeout(r,35));const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);values.push(Math.sqrt(x.reduce((sum,n)=>sum+n*n,0)/x.length));}s.master.disconnect(a);a.disconnect();return Math.sqrt(values.reduce((n,v)=>n+v*v,0)/values.length);});
try{
 await page.goto(base+'/?playtest&level='+(lite?'codex-lab':'carlisle-coast')+'&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(lite){
  report.coldOther=await page.evaluate(async()=>{const s=window.__game.sfx;await s.prepare();return{water:s.buffers.has('carlisleWater'),wind:s.buffers.has('carlisleWind')};});
  assert.deepEqual(report.coldOther,{water:false,wind:false});assert.equal(ambienceRequests.length,0,'another level downloaded the long ambience');
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();});
 }
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();await g.sfx.prepare();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);return{build:document.querySelector('.hud-build')?.textContent,art:g.getLevel().carlisleShipyardDiagnostics,grounds:g.getLevel().groundMeshes.length,crates:g.getLevel().crates.length};});
 await page.keyboard.press('ArrowUp');await page.waitForTimeout(1100);
 report.dock=await snapshot();assert.equal(report.dock.context,'running');assert.equal(report.dock.loops.length,2);assert.ok(report.dock.mix.waterGain>report.dock.mix.windGain*3);
 assert.ok(report.dock.loops.every(c=>c.duration>40&&c.rate===1));
 await page.evaluate(()=>{const s=window.__game.sfx;window.__harbourSources=[...s.loops.entries()].filter(([id])=>id.startsWith('carlisle-')).map(([id,c])=>[id,c.src]);});
 report.dockRms=await rms();assert.ok(report.dockRms>.001,'harbour bed is silent after gesture');
 if(!lite){
  await page.screenshot({path:out+'/dock-native.png'});
  await page.evaluate(()=>{const s=window.__game.sfx,dest=s.ctx.createMediaStreamDestination();s.master.connect(dest);const chunks=[],recorder=new MediaRecorder(dest.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.__harbourRecording={dest,recorder,chunks};recorder.start();});
 }
 const encounter=api.CARLISLE_RELAY_AIR_CARGO.find(e=>e.name==='Socket starboard gap'),jump=api.CARLISLE_RELAY_JUMPS.find(j=>j.name===encounter.jump),target=api.carlislePoint(...jump.to);
 await press({jumpHeld:true});await page.waitForTimeout(80);
 await page.evaluate(name=>{const g=window.__game,p=g.player,c=g.getCurrentLevel().data.components.find(c=>c.nm===name&&c.t==='trampoline');p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(c.p[0],c.p[1]+.15,c.p[2]),heading:p.pos.clone().set(0,0,-1)});p.totalDeaths=0;p.freeSkate=false;p.speed=0;p.masks=0;},jump.name);
 const pilot=airCargoPilot(encounter,target,{sideDeadzone:.85}),samples=[];let launched=false,landed=false,previous=0;
 for(let i=0;i<500;i++){
  const p=await page.evaluate(()=>{const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;return{at:p.pos.toArray(),forward:[f.x,0,f.z],side:[-f.z,0,f.x],spring:p.trampolineAir,vy:p.vVel,grounded:p.grounded,state:p.state,deaths:p.totalDeaths,bail:p.isBailing,broken:p.cratesBroken,mix:{...g.getLevel().carlisleShipyardDiagnostics.ambience}};});samples.push(p);
  if(p.spring&&p.vy>15)launched=true;if(p.deaths||p.state==='dead'||p.bail)break;
  if(launched&&samples.length>8&&(p.grounded||previous<0&&p.vy>15)){landed=true;break;}
  previous=p.vy;await press(pilot(p));await page.waitForTimeout(16);
 }
 await press({});const end=samples.at(-1),peak=samples.reduce((a,b)=>a.mix.height>b.mix.height?a:b);
 report.flight={launched,landed,broken:end.broken,deaths:end.deaths,distance:Math.hypot(...end.at.map((v,i)=>v-target[i])),apex:peak.mix,samples:samples.map(p=>({y:p.at[1],vy:p.vy,...p.mix}))};
 assert.ok(landed&&end.deaths===0&&end.broken>=2&&report.flight.distance<15,'keyboard cargo flight failed');
 assert.ok(peak.mix.windGain>peak.mix.waterGain*1.6,'wind did not open up at the bounce apex');
 report.continuousSources=await page.evaluate(()=>window.__harbourSources.every(([id,src])=>window.__game.sfx.loops.get(id)?.src===src));assert.ok(report.continuousSources,'ordinary updates restarted ambience');
 if(!lite){
  const recording=await page.evaluate(async()=>{const {recorder,chunks,dest}=window.__harbourRecording;await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop();});window.__game.sfx.master.disconnect(dest);dest.stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:recorder.mimeType});return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});});
  await writeFile(out+'/live-bounce.webm',Buffer.from(recording.split(',')[1],'base64'));
 }
 await page.evaluate(()=>{const g=window.__game;g.player.respawn(g.getLevel(),true);g.sfx.setVolumes({sfxVolume:0,musicVolume:1});});await page.waitForTimeout(300);
 report.mutedRms=await rms();assert.ok(report.mutedRms<1e-6,'harbour bypasses SFX mute');
 await page.evaluate(()=>window.__game.sfx.setVolumes({sfxVolume:1,musicVolume:1}));await page.waitForTimeout(300);report.restoredRms=await rms();assert.ok(report.restoredRms>.001);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__game.gameFlow.currentScreen==='pause');await page.waitForTimeout(80);
 report.pause=await snapshot();assert.equal(report.pause.loops.length,0);
 await page.getByRole('button',{name:'RESUME',exact:true}).click();await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);await page.waitForTimeout(150);
 report.resume=await snapshot();assert.equal(report.resume.loops.length,2);
 await page.evaluate(async()=>{const g=window.__game;g.switchLevel('codex-lab');await g.getLevel().prepareJungleAssets();});await page.waitForTimeout(150);
 report.otherLevel=await snapshot();assert.equal(report.otherLevel.loops.length,0,'harbour leaked into another level');
 await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForFunction(()=>window.__game.player.grounded);await page.waitForTimeout(200);
 report.bonus=await snapshot();assert.equal(report.bonus.loops.length,2);assert.ok(report.bonus.mix.waterGain>report.bonus.mix.windGain*3);
 await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForTimeout(250);report.returned=await snapshot();assert.equal(report.returned.loops.length,2);
 if(!lite){await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(200);await page.screenshot({path:out+'/dock-normal.png'});}
 report.ambienceRequests=ambienceRequests;assert.equal(ambienceRequests.length,2,'level round trips refetched ambience');
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.message;throw e;}
finally{await press({}).catch(()=>{});await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({passed:report.passed,build:report.main?.build,dock:report.dock?.mix,apex:report.flight?.apex,crateFlight:{landed:report.flight?.landed,crates:report.flight?.broken,deaths:report.flight?.deaths},dockRms:report.dockRms,mutedRms:report.mutedRms,pause:report.pause?.loops.length,bonus:report.bonus?.loops.length,other:report.otherLevel?.loops.length,returned:report.returned?.loops.length,errors:report.errors}));
