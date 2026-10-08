// Pixel coverage plus continuous native-input scenery review. No pose or
// velocity corrections occur after the replay begins.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let playwright=process.env.PLAYWRIGHT_MODULE;
if(!playwright){try{playwright=require.resolve('playwright');}catch{playwright=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(playwright.startsWith('/')?pathToFileURL(playwright).href:playwright);
const base=(process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5252').replace(/\/$/,'');
const out=process.env.CUSTARD_HORIZON_OUTPUT??'/private/tmp/custard-horizon-browser';await mkdir(out,{recursive:true});
const traceRoot=process.env.CUSTARD_TRAVERSAL_OUTPUT??'/private/tmp/custard-horizon-traversal';
const native=JSON.parse(await readFile(traceRoot+'/report.json','utf8')).find(v=>v.name==='continuous-chapter');assert.ok(native?.pass);
const trace=JSON.parse(await readFile(traceRoot+'/continuous-chapter-trace.json','utf8'));
const channels=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
const data={v:2,level:'custard-creek',date:new Date().toISOString(),tuning:{},tuningChanges:[],mx:trace.map(t=>t.input.moveX),my:trace.map(t=>t.input.moveY),b:trace.map(t=>channels.reduce((bits,c,i)=>bits|(t.input[c]?1<<i:0),0)),cy:trace.map(t=>t.cameraYaw),frames:trace.length,truncated:false,surfaceFrictionPolicy:1};
const report={base,started:new Date().toISOString(),errors:[],requests:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:process.argv.includes('--portrait')?{width:390,height:844}:{width:1280,height:720}});page.setDefaultTimeout(180000);
 // Real keyboard/replay inputs must not combine with a connected host controller.
 await page.addInitScript(()=>{Object.defineProperty(navigator,'getGamepads',{value:()=>[]});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.route(/\/(?:treehouse-trials-v2|carlisle-coast-fidelity|beachfront)\/.*\.glb/,async route=>{
  // Model transfer latency is intentional. Loading must complete in the
  // prefetch margin, rather than first appearing in the gameplay view.
  report.requests.push(route.request().url().split('/').at(-1));await new Promise(r=>setTimeout(r,650));await route.continue();
 });
 await page.goto(base+'/?playtest&level=custard-creek&frameprobe&renderdiag',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('custard-creek');await g.switchLevel('custard-creek');await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
 await page.waitForTimeout(600);
 report.sky=await page.evaluate(()=>{const g=window.__game,s=g.scene.children.find(o=>o.userData.oceanOpaqueBackdrop);return{visible:s.visible,painted:s.material.userData.skyArtwork==='painted',backgroundFirst:!s.material.transparent&&!s.material.depthTest,radius:s.geometry.parameters.radius*s.scale.x,far:g.camera.far,backdrop:g.getLevel().atmosphere.backdrop,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.sky.backdrop,'painted sky');assert.equal(report.sky.painted,true);assert.equal(report.sky.backgroundFirst,true);assert.equal(report.sky.visible,true);assert.ok(report.sky.radius<report.sky.far);assert.match(report.sky.stamp,/Codex\/sol fork/);
 await page.screenshot({path:out+'/gameplay-start.png'});
 const pixelProof=await page.evaluate(()=>{
  const g=window.__game,r=g.renderer,kit=g.getLevel().jungleAssets,view=kit.viewPosition.clone(),target=r.getRenderTarget();
  const viewport=r.getViewport({copy:v=>v.clone()}),scissor=r.getScissor({copy:v=>v.clone()}),test=r.getScissorTest(),clear=r.getClearColor({copy:v=>v.clone()}),alpha=r.getClearAlpha();
  const capture=()=>r.domElement.toDataURL('image/png'),results=[],images=[];
  try{
   r.setRenderTarget(null);r.setScissorTest(false);r.setViewport(0,0,r.domElement.width,r.domElement.height);
   // Inspect the existing dome from the player's actual camera position.
   const horizon=g.camera.clone(),direction=g.player.axisF.clone();direction.y=.08;
   horizon.lookAt(horizon.position.clone().add(direction));horizon.updateMatrixWorld();r.render(g.scene,horizon);images.push({name:'sunset-horizon.png',data:capture()});
   for(const [kind,distances,height] of [['coastv2grass',[20,35,48,65,100],.6],['coastbeachrock',[20,110,220],1.1]]){
    const original=kit.root.children.find(m=>m.isInstancedMesh&&m.userData.jungleAsset===kind&&(!m.material.customProgramCacheKey().includes('fade-v2-true')));if(!original)throw Error('Missing actual asset '+kind);
    const scene=new g.scene.constructor();scene.background=clear.clone().setRGB(0,0,0);
    for(const light of g.scene.children.filter(o=>o.isHemisphereLight||o.isDirectionalLight)) {const copy=light.clone();copy.castShadow=false;scene.add(copy);}
    const mesh=original.clone();mesh.count=1;mesh.visible=true;mesh.position.set(0,0,0);mesh.matrixAutoUpdate=true;mesh.castShadow=false;
    const matrix=mesh.matrix.clone().identity().makeScale(1.15,kind==='coastv2grass'?.32:.64,1.15);mesh.setMatrixAt(0,matrix);mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();scene.add(mesh);
    const samples=[];
    for(const distance of distances){
     const camera=g.camera.clone();camera.aspect=r.domElement.width/r.domElement.height;camera.fov=2*Math.atan(height/(2*distance))*180/Math.PI;camera.near=.1;camera.far=1000;camera.position.set(0,kind==='coastv2grass'?.16:.32,distance);camera.lookAt(0,camera.position.y,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();kit.viewPosition.copy(camera.position);
     r.clear();r.render(scene,camera);const gl=r.getContext(),pixels=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
     let coverage=0;for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>8)coverage++;
     samples.push({distance,coverage});if(distance===20||distance===65||distance===220)images.push({name:`${kind}-${distance}m.png`,data:capture()});
    }
    results.push({kind,samples});mesh.dispose();scene.clear();
   }
  }finally{kit.viewPosition.copy(view);r.setRenderTarget(target);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(test);r.setClearColor(clear,alpha);}
  return{results,images};
 });
 report.pixelProof=pixelProof.results;
 for(const asset of pixelProof.results){const counts=asset.samples.map(v=>v.coverage);assert.ok(Math.min(...counts)>100,'rendered asset is present at every distance');assert.ok(Math.min(...counts)/Math.max(...counts)>.88,'distance preserves the projected authored silhouette');}
 for(const {name,data}of pixelProof.images)await writeFile(out+'/'+name,Buffer.from(data.split(',')[1],'base64'));
 // Settle one independent start fixture and complete its visible asset gate.
 await page.evaluate(({startWorld,startHeading})=>{const g=window.__game,p=g.player;g.campaign.startEphemeral();p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(startWorld),heading:p.axisF.clone().fromArray(startHeading)});},native);
 await page.waitForTimeout(600);await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
 await page.evaluate(({native,data})=>{
  const g=window.__game,p=g.player,l=g.getLevel(),kit=l.jungleAssets;
  p.respawn(l,true,false,{position:p.pos.clone().fromArray(native.startWorld),heading:p.axisF.clone().fromArray(native.startHeading)});
  const evidence=window.__horizonRun={frames:0,deaths:0,bails:0,samples:0,missingVisible:[],newCells:0,minReadyLead:Infinity,maxResident:0,maxTextures:0,timings:[],renders:[],states:[]};
  const known=new Set(kit.cells.filter(c=>c.mesh)),step=p.step,scenery=l.updateSceneryView;
  l.updateSceneryView=function(...args){const result=scenery.apply(this,args);if(!g.replayer.active)return result;
   const horizon=Math.min(g.camera.far,l.atmosphere.fogFar),v=g.camera.position;evidence.samples++;
   for(const cell of kit.cells){const distance=cell.bounds.distanceToPoint(v);if(!cell.mesh&&distance<horizon)evidence.missingVisible.push({frame:g.replayer.frame,kind:cell.kind,distance});if(cell.mesh&&!known.has(cell)){known.add(cell);evidence.newCells++;evidence.minReadyLead=Math.min(evidence.minReadyLead,distance-horizon);}}
   if(evidence.samples%12===0){const d=kit.diagnostics;evidence.maxResident=Math.max(evidence.maxResident,d.residentCells);evidence.maxTextures=Math.max(evidence.maxTextures,d.textureMiB);}
   return result;};
  p.step=function(...args){const active=g.replayer.active,result=step.apply(this,args);if(active){evidence.frames=g.replayer.frame;if(['dead','gameover'].includes(p.state))evidence.deaths++;if(p.isBailing)evidence.bails++;if(!evidence.states.includes(p.state))evidence.states.push(p.state);if(g.replayer.frame>=data.frames){g.replayer.end();evidence.final={position:p.pos.toArray(),grounded:p.grounded,state:p.state,crates:p.cratesBroken};g.gameFlow.showPause({levelName:'Custard Creek',inWarpRoom:false});}}return result;};
  window.__restoreHorizon=()=>{p.step=step;l.updateSceneryView=scenery;};g.replayer.begin(data);
  let observedFrame=-1,renderSamples=0;
  const measure=()=>{if(g.replayer.active&&g.frameStats.frame!==observedFrame){observedFrame=g.frameStats.frame;if(++renderSamples%12===0){evidence.timings.push(g.frameStats.rawDt*1000);evidence.renders.push({...g.getRenderFrameStats()});}}if(!evidence.final)requestAnimationFrame(measure);};requestAnimationFrame(measure);
 },{native,data});
 for(const frame of [500,1100,1700,2300]){await page.waitForFunction(frame=>window.__horizonRun.frames>=frame||window.__horizonRun.deaths||window.__horizonRun.bails,frame);await page.screenshot({path:out+`/moving-${frame}.png`});}
 await page.waitForFunction(()=>window.__horizonRun.final||window.__horizonRun.deaths||window.__horizonRun.bails);
 report.run=await page.evaluate(()=>{window.__restoreHorizon();return window.__horizonRun;});
 assert.equal(report.run.deaths,0);assert.equal(report.run.bails,0);assert.ok(report.run.final?.grounded);assert.equal(report.run.frames,data.frames);
 assert.deepEqual(report.run.missingVisible,[],'every cell is resident before crossing the actual visible horizon');assert.ok(report.run.newCells>30,'the run exercises fresh scenery activation');assert.ok(report.run.minReadyLead>25,'real arriving scenery retains a useful margin before visibility');assert.deepEqual(report.errors,[]);
 report.pass=true;report.finished=new Date().toISOString();console.log(JSON.stringify({pass:true,pixelProof:report.pixelProof,run:{...report.run,timings:undefined,renders:undefined},errors:report.errors}));
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
