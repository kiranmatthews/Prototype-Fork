import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5348').replace(/\/$/,''),output=process.env.GRAPHICS_OUTPUT||'/private/tmp/slipstream-graphics-recovery',lite=process.env.GRAPHICS_LITE==='1';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'}),errors=[],rows=[],bufferSamples=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
// Screenshots hide NaNs after tone mapping. Read the floating-point source
// buffers using the driver's advertised read type, before and after restoration.
async function readBuffers(label){
 const buffers=await page.evaluate(()=>{
  const g=window.__game,w=g.getSkateRace().level.water,gl=g.renderer.getContext(),out=[];
  const previous=g.renderer.getRenderTarget();
  try{for(const target of [w.reflectionTarget,w.prepassTarget]){
   if(!target)continue;const beforeReadError=gl.getError();g.renderer.setRenderTarget(target);
   const afterBindError=gl.getError(),framebufferStatus=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
   const readFormat=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_FORMAT),readType=gl.getParameter(gl.IMPLEMENTATION_COLOR_READ_TYPE);
   const pixels=readType===gl.FLOAT?new Float32Array(target.width*target.height*4):readType===gl.HALF_FLOAT?new Uint16Array(target.width*target.height*4):new Uint8Array(target.width*target.height*4);
   gl.readPixels(0,0,target.width,target.height,readFormat,readType,pixels);
   let invalid=0,nonzero=0;const bad=[];
   for(let i=0;i<pixels.length;i++)if(i%4!==3){if(readType===gl.FLOAT?!Number.isFinite(pixels[i]):readType===gl.HALF_FLOAT&&(pixels[i]&31744)===31744){invalid++;if(bad.length<12)bad.push({i,value:String(pixels[i])});}if(pixels[i])nonzero++;}
   out.push({name:target.texture.name,dimensions:[target.width,target.height],type:target.texture.type,afterBindError,framebufferStatus,readFormat,readType,beforeReadError,invalid,nonzero,bad,glError:gl.getError()});
  }}finally{g.renderer.setRenderTarget(previous);}
  return out;
 });
 bufferSamples.push({label,buffers});
 await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,bufferSamples,errors},null,2));
 console.log(JSON.stringify({label,buffers}));
 assert.equal(buffers.length,lite?0:2,'full rendering must restore both ocean buffers');
 for(const b of buffers){assert.equal(b.beforeReadError,0);assert.equal(b.afterBindError,0);assert.equal(b.framebufferStatus,36053);assert.equal(b.invalid,0);assert.equal(b.glError,0);assert.ok(b.nonzero>0);}
}
async function snapshot(){return page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),w=r.level.water;return {stamp:document.querySelector('.hud-build')?.textContent,steps:g.frameStats.totalFixedSteps,frame:g.frameStats.frame,elapsed:r.elapsed,riders:r.riders.map(a=>({position:a.player.pos.toArray(),progress:a.progress,falls:a.falls,deaths:a.player.totalDeaths})),recovery:g.getGraphicsRecoveryDiagnostics(),water:{...w.stats,queryActive:w.visibilityQueryActive,occluded:w.waterOccluded},memory:{...g.renderer.info.memory},glError:g.renderer.getContext().getError(),assets:r.level.jungleAssets.diagnostics,loading:g.getLoadingDiagnostics()};});}
async function recover(label,midDraw=false){
 if(process.env.GRAPHICS_SKIP_LOSSES)return;
 const before=await snapshot();await page.screenshot({path:`${output}/${label}-before.png`});
 await page.evaluate(mid=>{const g=window.__game,w=g.getSkateRace().level.water,ext=g.renderer.getContext().getExtension('WEBGL_lose_context');if(!ext)throw Error('Missing context-loss extension');window.recoveryExtension=ext;if(mid){const original=w.ribbon.onBeforeRender;w.ribbon.onBeforeRender=function(...args){this.onBeforeRender=original;original.apply(this,args);ext.loseContext();};}else ext.loseContext();},midDraw);
 await page.waitForFunction(()=>window.__game.getGraphicsRecoveryDiagnostics().lost);
 const held=await snapshot();await page.waitForTimeout(500);const still=await snapshot();
 assert.equal(still.steps,held.steps,'simulation cannot advance while graphics are lost');assert.equal(still.elapsed,held.elapsed);assert.deepEqual(still.riders,held.riders,'all riders must remain frozen');
 assert.equal(await page.locator('[data-graphics-recovery]').count(),1);
 await page.evaluate(()=>window.recoveryExtension.restoreContext());
 await page.waitForFunction(frame=>{const g=window.__game;return !g.getGraphicsRecoveryDiagnostics().lost&&g.frameStats.frame>frame+35;},held.frame,{timeout:60000});
 const after=await snapshot();await page.screenshot({path:`${output}/${label}-after.png`});
 assert.equal(after.recovery.losses,before.recovery.losses+1);assert.equal(after.recovery.restores,after.recovery.losses);assert.equal(after.glError,0);assert.equal(after.water.queryActive,false);
 if(!lite&&label.includes('water')){assert.ok(after.water.reflectionRenders>before.water.reflectionRenders);assert.ok(after.water.prepassRenders>before.water.prepassRenders);}
 assert.equal(await page.locator('[data-graphics-recovery]').count(),0);assert.deepEqual(after.assets.errors,[]);assert.deepEqual(after.loading.failed,[]);
 rows.push({label,midDraw,before,held,still,after});await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,bufferSamples,errors},null,2));console.log(JSON.stringify({label,recovery:after.recovery,water:after.water,errors}));
}
async function view(s){await page.evaluate(s=>{const g=window.__game,r=g.getSkateRace(),p=g.player;r.reset('time-trial');r.phase='running';r.elapsed=50;g.ui.deathFade(0);g.scene.updateMatrixWorld(true);let at=null;for(let d=0;d<=12&&!at;d+=.5)at=r.course.support(r.level,s+d);if(!at)throw Error('No supported floor');p.resetRacePosition(r.level,at,r.course.tangent(s));r.riders[0].progress=s;r.level.playerPos.copy(p.pos);for(let i=0;i<35;i++){g.scene.updateMatrixWorld(true);window.recoveryOriginalStep(1/60,r.drive(0));p.commitRenderStep(r.level);r.commitRenderStep();}r.level.water.debug.freeze=true;r.level.water.time=30;r.level.water.markWavesDirty();},s);await page.waitForTimeout(1800);}
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${lite?'&lite':''}`,{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');await page.waitForTimeout(500);
 await recover('eight-riders-running');
 await page.evaluate(()=>{const r=window.__game.getSkateRace();window.recoveryOriginalStep=r.step.bind(r);r.step=()=>{};});
 await view(260);await recover('inside-flume');
 await view(3750);await readBuffers('coastal-before-loss');await recover('coastal-water',!lite);await readBuffers('coastal-after-loss');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(1000);await readBuffers('portrait-before-loss');await recover('portrait-water');await readBuffers('portrait-after-loss');
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(800);
 await readBuffers('after-resizes-and-recovery');
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.step=window.recoveryOriginalStep;r.level.water.debug.freeze=false;r.reset('race');});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
 const origin=await page.evaluate(()=>window.__game.player.pos.toArray());const startSteps=await page.evaluate(()=>window.__game.frameStats.totalFixedSteps);await page.keyboard.down('ArrowUp');await page.waitForFunction(start=>window.__game.frameStats.totalFixedSteps>=start+60,startSteps,{timeout:60000});await page.keyboard.up('ArrowUp');
 const movement=await page.evaluate(origin=>{const p=window.__game.player;return{distance:Math.hypot(...p.pos.toArray().map((v,i)=>v-origin[i])),deaths:p.totalDeaths,position:p.pos.toArray()};},origin);assert.ok(movement.distance>1);assert.equal(movement.deaths,0);
 // Retire restored resources through the ordinary menu path, then return.
 const transitions=[];
 for(const id of ['flats','slipstream-race']){
  await page.evaluate(id=>window.__game.ui.onLevelSelect(id),id);
  await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay&&!window.__game.gameFlow.loadingPhase,id,{timeout:180000});
  await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,glError:g.renderer.getContext().getError(),loading:g.getLoadingDiagnostics(),recovery:g.getGraphicsRecoveryDiagnostics()};});
  transitions.push(state);assert.equal(state.glError,0);assert.deepEqual(state.loading.failed,[]);assert.equal(state.recovery.lost,false);
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,bufferSamples,movement,transitions,errors},null,2));console.log(JSON.stringify({bufferSamples,movement,errors}));
}catch(error){await page.screenshot({path:output+'/failure.png'}).catch(()=>{});await writeFile(output+'/report.json',JSON.stringify({base,lite,rows,bufferSamples,errors,failure:String(error)},null,2));throw error;}finally{await browser.close();}
