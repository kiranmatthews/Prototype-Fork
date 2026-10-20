// Exact frozen-frame comparison of ceiling occlusion against the existing
// shadow LOD policy. Runs only against a local preview and stores local proof.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-hold-shadows';
const lite=process.argv.includes('--lite'),only=process.argv.find(a=>a.startsWith('--only='))?.slice(7);
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'This check must remain local');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 const page=await browser.newPage({viewport:lite?{width:1440,height:900}:{width:3840,height:2160},deviceScaleFactor:1});
 page.on('crash',()=>errors.push('Page crashed'));page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown'+(lite?'&lite':''),base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>window.__game.campaign.startEphemeral());
 const views=[['bowl-overlook',[1000,16.1,-165]],['bowl-floor',[1000,.1,-230]],['upper-catwalk',[1064,26.1,-208]],
  ['treasury',[1032,20.1,-425]],['moonpool',[-48,-5.8,-75]],['harbour',[-72,-5.3,205]]];
 for(const [view,position]of views.filter(([name])=>!only||name===only)){
  await page.evaluate(async position=>{const g=window.__game;
   g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});
   await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);
  },position);await page.waitForTimeout(2400);
  const result=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),kit=l.jungleAssets,proof=kit?.shadowOccluder,r=g.renderer,gl=r.getContext();
   if(!kit)throw Error('Missing scenery kit');
   const original={auto:r.shadowMap.autoUpdate,needs:r.shadowMap.needsUpdate,target:r.getRenderTarget(),scope:kit.withLowDetailShadows};
   const hooks=[],costs=new Map(),state=()=>JSON.stringify(kit.cells.map(c=>[c.mesh?.uuid,c.mesh?.visible,c.mesh?.castShadow,c.mesh?.geometry.uuid,c.farMesh?.uuid,c.farMesh?.visible,c.farMesh?.castShadow]));
   for(const cell of kit.cells)for(const mesh of [cell.mesh,cell.farMesh])if(mesh){
    for(const [hook,pass]of [['onBeforeRender','view'],['onBeforeShadow','shadow']]){
     const previous=mesh[hook];hooks.push(()=>mesh[hook]=previous);
     mesh[hook]=function(...args){const key=pass+' | '+cell.kind,geo=pass==='shadow'?args[4]:args[3],row=costs.get(key)??{key,calls:0,triangles:0};
      row.calls++;row.triangles+=(geo.index?.count??geo.attributes.position.count)/3*mesh.count;costs.set(key,row);previous?.apply(this,args);};
    }
   }
   g.player.snapRenderInterpolation();l.updateSceneryView(g.camera);g.scene.updateMatrixWorld(true);
   const initial=state(),width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   const capture=enabled=>{
    kit.setShadowOccluder(enabled?proof:undefined);r.shadowMap.autoUpdate=true;r.shadowMap.needsUpdate=true;
    for(let i=0;i<2;i++){l.water?.renderPasses(r,g.scene,g.camera);costs.clear();r.info.reset();r.setRenderTarget(null);r.render(g.scene,g.camera);}
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return{pixels,jpeg:r.domElement.toDataURL('image/jpeg',.9).split(',')[1],render:{...r.info.render},costs:[...costs.values()].sort((a,b)=>a.key.localeCompare(b.key))};
   };
   const diff=(a,b)=>{let max=0,sum=0,over1=0;for(let i=0;i<a.length;i+=4){let pixel=0;for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);max=Math.max(max,d);sum+=d;pixel=Math.max(pixel,d);}over1+=pixel>1;}return{max,mean:sum/(width*height*3),pixelsOver1:over1};};
   try{
    const baseline=capture(false),candidate=capture(true),control=capture(false);
    const memory={...r.info.memory};
    kit.setShadowOccluder(proof);kit.withLowDetailShadows=function(draw,lights){original.scope.call(this,()=>{throw Error('synthetic shadow failure');},lights);};
    let caught=false;try{r.render(g.scene,g.camera);}catch(error){if(error.message!=='synthetic shadow failure')throw error;caught=true;}
    kit.withLowDetailShadows=original.scope;
    const restored=state()===initial,recovered=capture(true);
    return{width,height,hasProof:!!proof,boundOwner:proof?.owner?.name??null,comparison:diff(baseline.pixels,candidate.pixels),control:diff(baseline.pixels,control.pixels),
     recovery:diff(candidate.pixels,recovered.pixels),caught,restored,baseline:{render:baseline.render,costs:baseline.costs},candidate:{render:candidate.render,costs:candidate.costs},
     memory,glError:gl.getError(),contextLost:gl.isContextLost(),position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,
     loading:g.getLoadingDiagnostics(),textureMiB:kit.diagnostics.textureMiB,jpegs:{baseline:baseline.jpeg,candidate:candidate.jpeg}};
   }finally{
    hooks.forEach(restore=>restore());kit.setShadowOccluder(proof);kit.withLowDetailShadows=original.scope;
    r.shadowMap.autoUpdate=original.auto;r.shadowMap.needsUpdate=original.needs;r.setRenderTarget(original.target);
   }
  });
  const {jpegs,...metrics}=result;
  for(const [name,jpeg]of Object.entries(jpegs))await writeFile(`${out}/${view}-${name}.jpg`,Buffer.from(jpeg,'base64'));
  rows.push({view,lite,requestedPosition:position,...metrics});await writeFile(out+'/report.json',JSON.stringify({rows,errors},null,2)+'\n');
  assert.equal(metrics.hasProof,!lite);if(!lite)assert.ok(metrics.boundOwner,'proof binds the real merged roof');
  assert.equal(metrics.control.max,0);assert.equal(metrics.recovery.max,0);assert.equal(metrics.caught,true);assert.equal(metrics.restored,true);
  assert.ok(metrics.comparison.max<=1&&metrics.comparison.mean<.00001,'Ceiling optimization must be pixel exact apart from isolated rounding');
  assert.equal(metrics.glError,0);assert.equal(metrics.contextLost,false);assert.equal(metrics.grounded,true);assert.equal(metrics.deaths,0);
  assert.deepEqual(metrics.loading.failed,[]);assert.deepEqual(errors,[]);
  const primary=costs=>costs.filter(c=>c.key.startsWith('view |'));
  assert.deepEqual(primary(metrics.baseline.costs),primary(metrics.candidate.costs),'Primary geometry and draw calls must remain identical');
  assert.deepEqual([metrics.width,metrics.height],lite?[720,450]:[3840,2160]);
  if(!lite&&view==='bowl-overlook')assert.ok(metrics.candidate.render.triangles<metrics.baseline.render.triangles,'real hold view must save shadow work');
  console.log(JSON.stringify({view,lite,pixelMax:metrics.comparison.max,calls:[metrics.baseline.render.calls,metrics.candidate.render.calls],
   triangles:[metrics.baseline.render.triangles,metrics.candidate.render.triangles],textureMiB:metrics.textureMiB}));
 }
 console.log('Verified frozen shadow comparisons, unchanged primary draws, restored failure state and zero browser/GL errors.');
}finally{await browser.close();}
