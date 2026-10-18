// Compare reduced shadows with native shadows in the same frozen 4K frame.
// The ordinary colour pass must be exact when both use the same shadow map.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-shadows';
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Page crashed'));page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 for(const [view,position] of [['bowl-overlook',[1000,16.1,-165]],['bowl-floor',[1000,.1,-230]],['upper-catwalk',[1064,26.1,-208]],['moonpool',[-48,-5.8,-75]],['harbour',[-72,-5.3,205]]].filter(([name])=>!only||name===only)){
  await page.evaluate(async position=>{
   const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});
   await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();
  },position);await page.waitForTimeout(2200);
  const data=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),j=l.jungleAssets,r=g.renderer,gl=r.getContext(),scope=j.withLowDetailShadows;
   const original={autoUpdate:r.shadowMap.autoUpdate,needsUpdate:r.shadowMap.needsUpdate,target:r.getRenderTarget()};
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,restore=[];
   const kinds=new Set(['crownmeshyplankchipped','crowncrashboardwalk']);
   const groups=new Map();
   for(const cell of j.cells)if(kinds.has(cell.kind))for(const mesh of [cell.mesh,cell.farMesh])if(mesh){
    for(const [hook,pass] of [['onBeforeRender','view'],['onBeforeShadow','shadow']]){
     const previous=mesh[hook];restore.push(()=>mesh[hook]=previous);
     mesh[hook]=function(...args){
      const key=pass+' | '+cell.kind,geometry=pass==='shadow'?args[4]:args[3];
      const row=groups.get(key)??{key,calls:0,triangles:0,instances:0,lods:[]};
      row.calls++;row.instances+=mesh.count;row.triangles+=geometry.index.count/3*mesh.count;
      if(!row.lods.includes(mesh.userData.sceneryLod))row.lods.push(mesh.userData.sceneryLod);
      groups.set(key,row);previous?.apply(this,args);
     };
    }
   }
   const state=()=>JSON.stringify({cells:j.cells.map(c=>[c.mesh?.uuid,c.mesh?.visible,c.mesh?.castShadow,c.mesh?.geometry.uuid,c.farMesh?.uuid,c.farMesh?.visible,c.farMesh?.castShadow]),shadow:j.shadowLowDetail,capture:j.captureLowDetail});
   const pixels=()=>{const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
   const maximum=(a,b)=>{let value=0;for(let i=0;i<a.length;i++)value=Math.max(value,Math.abs(a[i]-b[i]));return value;};
   const capture=(reduced,freezeShadow=false)=>{
    j.withLowDetailShadows=reduced?scope:draw=>draw();
    r.shadowMap.autoUpdate=!freezeShadow;r.shadowMap.needsUpdate=!freezeShadow;
    for(let frame=0;frame<2;frame++){
     l.water?.renderPasses(r,g.scene,g.camera);groups.clear();r.info.reset();
     r.setRenderTarget(null);r.render(g.scene,g.camera);
    }
    return{pixels:pixels(),jpeg:r.domElement.toDataURL('image/jpeg',.85).split(',')[1],costs:[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key)),render:{...r.info.render}};
   };
   try{
    const initial=state(),baseline=capture(false),candidate=capture(true),control=capture(false);
    const primaryMax=maximum(capture(false,true).pixels,capture(true,true).pixels);
    r.shadowMap.autoUpdate=true;r.shadowMap.needsUpdate=true;
    j.withLowDetailShadows=function(){scope.call(j,()=>{throw Error('synthetic shadow draw failure');});};
    let caught=false;
    try{r.setRenderTarget(null);r.render(g.scene,g.camera);}catch(error){if(error.message!=='synthetic shadow draw failure')throw error;caught=true;}
    finally{j.withLowDetailShadows=scope;}
    if(!caught)throw Error('Shadow failure fixture did not execute');
    const stateRestored=state()===initial,recovered=capture(true);
    let total=0,different=0,over8=0;const histogram=new Uint32Array(256);
    for(let i=0;i<baseline.pixels.length;i+=4){let max=0;for(let c=0;c<3;c++){const diff=Math.abs(baseline.pixels[i+c]-candidate.pixels[i+c]);total+=diff;max=Math.max(max,diff);}histogram[max]++;if(max)different++;if(max>8)over8++;}
    return{width,height,controlMax:maximum(baseline.pixels,control.pixels),primaryMax,recoveryMax:maximum(candidate.pixels,recovered.pixels),stateRestored,glError:gl.getError(),contextLost:gl.isContextLost(),
     meanRgbError:total/(width*height*3),differentPixelPercent:100*different/(width*height),over8PixelPercent:100*over8/(width*height),histogram:[...histogram],
     baseline:{costs:baseline.costs,render:baseline.render},candidate:{costs:candidate.costs,render:candidate.render},memory:{...r.info.memory},
     position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,loading:g.getLoadingDiagnostics(),
     jpegs:{baseline:baseline.jpeg,candidate:candidate.jpeg}};
   }finally{
    restore.forEach(fn=>fn());j.withLowDetailShadows=scope;
    r.shadowMap.autoUpdate=original.autoUpdate;r.shadowMap.needsUpdate=original.needsUpdate;r.setRenderTarget(original.target);
   }
  });
  const {jpegs,...metrics}=data;
  for(const [name,jpeg] of Object.entries(jpegs))await writeFile(`${out}/${view}-${name}.jpg`,Buffer.from(jpeg,'base64'));
  rows.push({view,requestedPosition:position,...metrics});
  await writeFile(out+'/report.json',JSON.stringify({rows,errors},null,2)+'\n');
  assert.equal(metrics.controlMax,0,'Unchanged native-shadow control must be exact');
  assert.equal(metrics.primaryMax,0,'Colour render with identical shadow maps must be exact');
  assert.equal(metrics.recoveryMax,0,'Render must recover exactly after shadow-scope failure');
  assert.equal(metrics.stateRestored,true);assert.equal(metrics.glError,0);assert.equal(metrics.contextLost,false);
  assert.deepEqual([metrics.width,metrics.height],[3840,2160]);assert.equal(metrics.grounded,true);assert.equal(metrics.deaths,0);assert.deepEqual(metrics.loading.failed,[]);
  assert.ok(Math.hypot(metrics.position[0]-position[0],metrics.position[2]-position[2])<1.5);
  assert.ok(metrics.meanRgbError<1&&metrics.over8PixelPercent<3,'Reduced shadows differ too much for visual acceptance');
  const colour=costs=>costs.filter(row=>row.key.startsWith('view'));
  assert.deepEqual(colour(metrics.candidate.costs),colour(metrics.baseline.costs),'The native primary geometry must remain identical');
  for(const cost of metrics.candidate.costs.filter(row=>row.key.startsWith('shadow')))assert.deepEqual(cost.lods,[1]);
  assert.ok(metrics.candidate.render.triangles<metrics.baseline.render.triangles,'Reduced shadows must lower submitted geometry');
  console.log(JSON.stringify({view,primaryMax:metrics.primaryMax,controlMax:metrics.controlMax,recoveryMax:metrics.recoveryMax,meanRgbError:metrics.meanRgbError,over8PixelPercent:metrics.over8PixelPercent,baselineTriangles:metrics.baseline.render.triangles,candidateTriangles:metrics.candidate.render.triangles}));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await writeFile(out+'/report.json',JSON.stringify({rows,errors},null,2)+'\n');}
