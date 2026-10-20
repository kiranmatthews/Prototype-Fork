import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'drowned-profile');
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
const fort=process.argv.includes('--fort');
const lite=process.argv.includes('--lite'),interior=process.argv.includes('--interior');
const treasury=process.argv.includes('--treasury'),harbour=process.argv.includes('--harbour');
const moonpool=process.argv.includes('--moonpool'),fourK=process.argv.includes('--4k');
const viewport=fourK?{width:3840,height:2160}:{width:1440,height:900};
const levelPack=process.argv.find(a=>a.startsWith('--levels='))?.slice(9);
const override=levelPack?JSON.parse(await readFile(levelPack,'utf8')).levels.find(entry=>entry.id==='drowned-crown'):null;
if(levelPack)assert.ok(override?.data,'The local comparison pack must contain Drowned Crown');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Browser page crashed'));
 await page.addInitScript(()=>{window.drownedContextLosses=0;document.addEventListener('webglcontextlost',()=>window.drownedContextLosses++,true);});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 if(override)await page.addInitScript(entry=>{
  // First-run sync updates the registry after the active level is built. Seed
  // this isolated browser first, so comparisons use the requested geometry.
  localStorage.setItem('solProtoUserLevels',JSON.stringify([entry]));
  localStorage.setItem('solProtoCloudPulled','1');
 },override);
 const started=Date.now();
 await page.goto(`${base}?playtest&renderdiag&level=drowned-crown${lite?'&lite':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const report={url:page.url(),levelOverride:levelPack??null,viewport,launchSeconds:(Date.now()-started)/1000,views:[]};
 if(override){
  const actual=await page.evaluate(()=>window.__game.getLevel().builtFromData);
  // Ordinary imports append a default trial clock when none was authored.
  // Verify every requested field/component; allow only that one known append.
  const extra=actual.components.slice(override.data.components.length);
  if(extra.length===1&&extra[0].t==='clock'&&!override.data.components.some(c=>c.t==='clock')){
   assert.deepEqual(extra[0],{t:'clock',p:[override.data.spawn[0]+2,override.data.spawn[1],override.data.spawn[2]-5]});
   report.automaticClock=actual.components.pop();
  }
  assert.ok(isDeepStrictEqual(actual,override.data),'The active authored data must match the requested comparison');
  report.overrideApplied=true;
 }
 const views=fort?[['fort-approach',[-43,-5.4,90]],['fort-gate',[-48,-1.3,60]],['mine-entrance',[-48,.1,48]],['mine-turn',[-48,.1,20]],['fissure',[-34,-2.9,-8]]]:harbour?[['harbour',[-72,-5.3,205]],['harbour-market',[-71.5004,-6.05,193.0957]],['harbour-bend',[-69.2184,-6.1078,181.0963]],['harbour-cargo',[-57,-6,140]]]:moonpool?[['moonpool-approach',[-48,-5.8,-62]],['moonpool-lookout',[-48,-5.8,-75]],['moonpool-boarding',[-35,-5.8,-76]]]:treasury?[['treasury-entry',[1032,19,-411]],['treasury-approach',[1032,21,-423]],['treasury-port',[1027,22,-426]],['treasury-starboard',[1037,22,-426]],['treasury-arch',[1032,22,-434]]]:[['harbour',[-72,-5.3,205]],['moonpool',[-48,-6.1,-75]],['bowl-overlook',[1000,16.1,-165]],['bowl-floor',[1000,.1,-230]],['upper-catwalk',[1064,26.1,-208]],['treasury',[1032,20.1,-425]],['harbour-return',[-72,-5.3,205]]];
 for(const [name,pos] of views.filter(([name])=>(!only||name===only)&&(!interior||name.startsWith('bowl-')||name==='upper-catwalk'))){
  await page.evaluate(pos=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...pos),heading:g.player.camDir.clone().set(0,0,-1)});},pos);
  await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();});
  await page.waitForTimeout(2000);
  const sample=await page.evaluate(async()=>{
   const g=window.__game,groups=new Map(),restore=[],waterBefore={...g.getLevel().water?.stats};
   const instrument=(mesh,hook,pass)=>{
    const previous=mesh[hook];restore.push(()=>mesh[hook]=previous);
    mesh[hook]=function(...args){
     const geometry=mesh.geometry,material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
     const key=pass+' | '+(mesh.userData.jungleAsset||material?.name||mesh.name||mesh.type);
     const entry=groups.get(key)??{key,calls:0,triangles:0,instances:0};
     const count=mesh.isInstancedMesh?mesh.count:1;
     entry.calls++;entry.instances+=count;entry.triangles+=(geometry.index?.count??geometry.attributes.position?.count??0)/3*count;groups.set(key,entry);
     previous?.apply(this,args);
    };
   };
   g.scene.traverse(mesh=>{if(mesh.isMesh){instrument(mesh,'onBeforeRender','view');instrument(mesh,'onBeforeShadow','shadow');}});
   const frames=[],times=[];let last=performance.now();
   try{
    await new Promise(resolve=>{const sample=now=>{times.push(now-last);last=now;frames.push({...g.getRenderFrameStats()});if(frames.length<90)requestAnimationFrame(sample);else resolve();};requestAnimationFrame(sample);});
   }finally{restore.forEach(fn=>fn());}
   const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
   return{position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,state:g.player.state,camera:g.camera.position.toArray(),cameraQuaternion:g.camera.quaternion.toArray(),fov:g.camera.fov,
    frameMs:{median:percentile(times,.5),p95:percentile(times,.95)},calls:percentile(frames.map(f=>f.calls),.5),triangles:percentile(frames.map(f=>f.triangles),.5),memory:{...g.renderer.info.memory},
    water:{stats:{...g.getLevel().water?.stats},delta:Object.fromEntries(Object.entries(g.getLevel().water?.stats??{}).filter(([key])=>['reflectionRenders','prepassRenders','occludedPassFrames','primaryReuseRenders','primaryReuseFallbacks'].includes(key)).map(([key,value])=>[key,value-waterBefore[key]]))},
    costs:[...groups.values()].map(v=>({...v,calls:v.calls/frames.length,triangles:Math.round(v.triangles/frames.length),instances:Math.round(v.instances/frames.length)})).sort((a,b)=>b.triangles-a.triangles).slice(0,18),
    contextLosses:window.drownedContextLosses,loading:g.getLoadingDiagnostics(),scenery:g.getLevel().jungleAssets?.diagnostics};
  });
  assert.equal(sample.deaths,0,name+' died while settling or sampling');
  assert.equal(sample.state,'ride',name+' left the ordinary supported player state');
  assert.equal(sample.grounded,true,name+' is unsupported');
  assert.ok(Math.hypot(sample.position[0]-pos[0],sample.position[2]-pos[2])<1.5&&Math.abs(sample.position[1]-pos[1])<3,
   name+' moved away from the requested viewpoint: '+JSON.stringify({requested:pos,actual:sample.position}));
  assert.equal(sample.contextLosses,0);assert.deepEqual(sample.loading.failed,[]);
  // After settling, hidden exterior water must not redraw the staged interior.
  if(!lite){
   for(const pass of ['reflectionRenders','prepassRenders']){
    if(fort||name.startsWith('harbour')||name.startsWith('moonpool'))assert.ok(sample.water.delta[pass]>0,name+' lost visible ocean passes');
    else assert.equal(sample.water.delta[pass],0,name+' is rendering the hidden ocean');
   }
  }
  report.views.push({name,requestedPosition:pos,...sample});
  // Small previews keep review transfer costs bounded; full game render stays native.
  await page.screenshot({path:join(output,name+'.jpg'),type:'jpeg',quality:65});
  console.log(JSON.stringify({name,calls:sample.calls,triangles:sample.triangles,frameMs:sample.frameMs,water:sample.water.delta,top:sample.costs.slice(0,4)}));
 }
 report.resolution=await page.evaluate(()=>JSON.parse(document.querySelector('#render-diagnostics').textContent));
 if(!lite){assert.equal(report.resolution.settings.enabled,false);assert.deepEqual(report.resolution.drawingBuffer,viewport);}
 report.errors=errors;await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');assert.deepEqual(errors,[]);
}finally{await browser.close();}
