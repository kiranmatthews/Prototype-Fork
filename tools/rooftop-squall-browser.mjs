import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/storm-squall/local';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as THREE from 'three';export {installSkyProjection} from './src/skyProjection';export {sampleStormSquall} from './src/stormSquall';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
await page.route('**/squall-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
await page.addInitScript(()=>{
 window.__stormAudio={decoded:false,events:[]};const api=AudioContext.prototype,decode=api.decodeAudioData,create=api.createBufferSource;
 api.decodeAudioData=function(...args){return decode.apply(this,args).then(b=>{if(Math.abs(b.duration-6.4)<.001)window.__stormAudio.decoded=true;return b;});};
 api.createBufferSource=function(...args){const node=create.apply(this,args),start=node.start.bind(node),stop=node.stop.bind(node);let record;
  node.start=(...values)=>{if(node.buffer&&Math.abs(node.buffer.duration-6.4)<.001){record={duration:node.buffer.duration,loop:node.loop,rate:node.playbackRate.value,stopped:false,clock:window.__game?.getLevel().rainPresentation.time};window.__stormAudio.events.push(record);}return start(...values);};
  node.stop=(...values)=>{if(record)record.stopped=true;return stop(...values);};return node;};
});
const state=()=>page.evaluate(()=>{const g=window.__game,sky=g.scene.getObjectByName('Distant sky backdrop'),probe={uniforms:{},vertexShader:'#include <project_vertex>',fragmentShader:'#include <map_fragment>'};sky.material.onBeforeCompile(probe,g.renderer);return {level:g.getCurrentLevel().id,weather:g.getStormDiagnostics(),uniform:probe.uniforms.uSkyStorm.value.toArray(),audio:window.__stormAudio,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};});
try{
 await page.goto(base+'/?lite&playtest&level=rooftop-relay',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.keyboard.press('Control');await page.waitForFunction(()=>window.__stormAudio.decoded,null,{timeout:90000});
 await page.evaluate(async()=>{const {sampleStormSquall}=await import('/squall-fixture.js');window.__game.getLevel().rainWeather.uniforms.uTime.value=sampleStormSquall(0,.86).thunderAt-.3;});
 await page.waitForFunction(()=>window.__stormAudio.events.length>0,null,{timeout:5000});const lite=await state();assert.equal(lite.audio.events[0].loop,false);assert.equal(lite.audio.events[0].stopped,false);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__game.gameFlow.blocksGameplay);const litePaused=await state();assert.equal(litePaused.audio.events[0].stopped,true);
 await page.goto(base+'/?playtest&level=rooftop-relay',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.keyboard.press('Control');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);window.__stormLook=[0,-1];g.input.pollGamepad=()=>({id:'Storm review',index:0,connected:true,mapping:'standard',axes:[0,0,...window.__stormLook],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))});});
 await page.waitForFunction(()=>window.__stormAudio.decoded,null,{timeout:90000});
 await page.waitForTimeout(1400);
 const gpu=await page.evaluate(async()=>{
  const {THREE,installSkyProjection,sampleStormSquall}=await import('/squall-fixture.js'),g=window.__game,original=g.scene.getObjectByName('Distant sky backdrop');
  const renderer=new THREE.WebGLRenderer(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,10),geometry=new THREE.PlaneGeometry(2,2),material=new THREE.MeshBasicMaterial({map:original.material.map,depthWrite:false,depthTest:false}),sky=new THREE.Mesh(geometry,material);
  renderer.setSize(64,64);renderer.outputColorSpace=THREE.SRGBColorSpace;scene.add(sky);
  const control=installSkyProjection(sky,{value:new THREE.Color('#aebdca')},{value:1},{value:1},{value:0});control.setHazeElevation(.065);
  const target=new THREE.WebGLRenderTarget(64,64),draw=(strength,down=false)=>{const az=sampleStormSquall(0,.86).azimuth;camera.lookAt(Math.sin(az),down?-5:.27,Math.cos(az));camera.updateMatrixWorld(true);control.setStormGlow(strength,az);renderer.setRenderTarget(target);renderer.render(scene,camera);const bytes=new Uint8Array(64*64*4);renderer.readRenderTargetPixels(target,0,0,64,64,bytes);return bytes;};
  const off=draw(0),on=draw(.86),restored=draw(0),lowOff=draw(0,true),lowOn=draw(.86,true);
  let positive=0,maxDifference=0,restoreDifference=0,belowDifference=0,brightness=0;
  for(let i=0;i<off.length;i++){if(i%4===3)continue;const delta=on[i]-off[i];if(delta>0)positive++;maxDifference=Math.max(maxDifference,Math.abs(delta));restoreDifference=Math.max(restoreDifference,Math.abs(restored[i]-off[i]));belowDifference=Math.max(belowDifference,Math.abs(lowOn[i]-lowOff[i]));brightness+=off[i];}
  target.dispose();geometry.dispose();material.dispose();renderer.dispose();return {positive,maxDifference,restoreDifference,belowDifference,brightness};
 });
 assert.ok(gpu.brightness>0&&gpu.positive>2000&&gpu.maxDifference>8,'The actual sky shader must visibly illuminate a broad cloud region');assert.equal(gpu.restoreDifference,0);assert.equal(gpu.belowDifference,0,'Cloud illumination must never brighten the below-horizon fog');
 const timeline=await page.evaluate(async()=>{const {sampleStormSquall}=await import('/squall-fixture.js'),l=window.__game.getLevel();window.__rainUpdate=l.rainWeather.update.bind(l.rainWeather);l.rainWeather.update=()=>{};return sampleStormSquall(0,.86);});
 const at=async(time,name)=>{await page.evaluate(t=>window.__game.getLevel().rainWeather.uniforms.uTime.value=t,time);await page.waitForTimeout(120);const snap=await state();await page.screenshot({path:out+'/'+name+'.png'});return snap;};
 const before=await at(timeline.start-.1,'cloud-before'),peak=await at(timeline.start+.675,'cloud-glow'),after=await at(timeline.start+1.45,'cloud-after');
 assert.deepEqual(peak.buffer,[2560,1440]);assert.ok(peak.weather.glow>.8&&peak.uniform[3]>.8);assert.equal(before.weather.glow,0);assert.equal(after.weather.glow,0);
 await page.evaluate(t=>{const l=window.__game.getLevel();l.rainWeather.uniforms.uTime.value=t;},timeline.thunderAt-.2);await page.waitForTimeout(50);
 await page.evaluate(()=>window.__game.getLevel().rainWeather.update=window.__rainUpdate);
 await page.waitForFunction(()=>window.__stormAudio.events.length>0,null,{timeout:5000});const thunder=await state();assert.ok(thunder.weather.cues>0);assert.equal(thunder.audio.events[0].loop,false);assert.equal(thunder.audio.events[0].stopped,false);assert.ok(thunder.audio.events[0].clock>=timeline.thunderAt&&thunder.audio.events[0].clock-timeline.thunderAt<.1);
 await page.keyboard.press('p');await page.waitForFunction(()=>window.__game.gameFlow.blocksGameplay);const paused=await state();assert.equal(paused.weather.glow,0);assert.equal(paused.uniform[3],0);assert.equal(paused.audio.events.at(-1).stopped,true);
 await page.keyboard.press('p');await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);await page.waitForTimeout(400);const resumed=await state();assert.equal(resumed.audio.events.length,thunder.audio.events.length,'Resume must not replay the same thunder');
 await page.evaluate(()=>{window.__stormLook=[0,0];return window.__game.switchLevel('codex-lab');});await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});const dry=await state();assert.equal(dry.uniform[3],0);assert.equal(dry.weather.glow,0);
 await page.evaluate(()=>window.__game.switchLevel('rooftop-relay'));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});const returned=await state();assert.equal(returned.weather.glow,0);assert.equal(returned.audio.events.length,thunder.audio.events.length);
 await page.evaluate(()=>{const level=window.__game.getLevel();return Promise.all([level.prepareJungleAssets(),level.prepareSurfaceImages()]);});
 await page.waitForFunction(()=>window.__game.scene.getObjectByName('Distant sky backdrop').material.map?.source.data.width===1774,null,{timeout:30000});await page.waitForTimeout(500);
 await page.screenshot({path:out+'/normal-gameplay.png'});
 await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(350);const regular=await state();await page.screenshot({path:out+'/regular-presentation.png'});
 await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});await page.waitForTimeout(200);assert.deepEqual((await state()).buffer,[2560,1440]);
 assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,lite,litePaused,gpu,timeline,before,peak,after,thunder,paused,resumed,dry,returned,regular,errors},null,2)+'\n');console.log('PASS lite and native cloud glow, actual GPU fog isolation, real finite thunder audio, pause/return cancellation and dry-level restoration');
}finally{await browser.close();}
