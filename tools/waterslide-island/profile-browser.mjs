import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5348').replace(/\/$/,'');
const output=process.env.ISLAND_PROFILE_OUTPUT||'/private/tmp/slipstream-island-profile';
const views=[['forecourt',0],['inside-tunnel',260],['forest-bend',600],['first-pool',1100],['platform-pool',2680],['open-coil',3430],['coastal-reveal',3750],['finish',4050]];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
const page=await context.newPage(),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 if(process.env.ISLAND_BASELINE_DIR)for(const name of ['tropical-grove','planted-cliff'])await page.route(`**/waterslide/${name}.glb`,route=>route.fulfill({path:join(process.env.ISLAND_BASELINE_DIR,`${name}.glb`),contentType:'model/gltf-binary'}));
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.ISLAND_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'TIME TRIAL',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
 await page.evaluate(()=>{const r=window.__game.getSkateRace();window.islandStep=r.step.bind(r);r.step=()=>{};});
 for(const [name,s] of views.filter(([name])=>!process.env.ISLAND_VIEWS||process.env.ISLAND_VIEWS.split(',').includes(name))){
  await page.evaluate(s=>{
   const g=window.__game,r=g.getSkateRace(),p=g.player;r.reset('time-trial');r.phase='running';r.elapsed=50;g.ui.deathFade(0);g.scene.updateMatrixWorld(true);
   let at=null;for(let d=0;d<=12&&!at;d+=.5)at=r.course.support(r.level,s+d);if(!at)throw Error('No supported floor at '+s);
   p.resetRacePosition(r.level,at,r.course.tangent(s));r.riders[0].progress=s;r.level.playerPos.copy(p.pos);
   for(let i=0;i<35;i++){g.scene.updateMatrixWorld(true);window.islandStep(1/60,r.drive(0));p.commitRenderStep(r.level);r.commitRenderStep();}
  },s);
  await page.waitForTimeout(2200);
  // Attribute only the real primary scene draw. Shadows and reflected views
  // have a different camera and are deliberately excluded from this table.
  await page.evaluate(()=>{
   const g=window.__game,restore=[],render=g.renderer.render,probe=window.islandDrawProbe={passes:0,frames:0,lastFrame:-1,rows:[],active:false};
   g.scene.traverse(o=>{if(!o.isMesh)return;const previous=o.onBeforeRender;
    o.onBeforeRender=function(renderer,scene,camera,geometry,material,group){
     previous.apply(this,arguments);if(!probe.active||scene!==g.scene||camera!==g.camera)return;
     const c=g.getSkateRace().level.builtFromData.components[o.userData.editorIdx];
     const label=o.userData.jungleAsset||c?.nm||o.name||o.parent?.name||o.type;
     const triangles=Math.min(group?.count??Infinity,geometry.drawRange.count,geometry.index?.count??geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);
     probe.rows.push({label,triangles,shadow:o.castShadow,vertices:geometry.attributes.position.count});
    };restore.push(()=>o.onBeforeRender=previous);
   });
   g.renderer.render=function(scene,camera){
    const primary=scene===g.scene&&camera===g.camera,previous=probe.active;
    if(primary){if(probe.lastFrame!==g.frameStats.frame){probe.rows=[];probe.lastFrame=g.frameStats.frame;probe.frames++;}probe.active=true;}
    try{return render.apply(this,arguments);}finally{probe.active=previous;if(primary)probe.passes++;}
   };
   window.restoreIslandDrawProbe=()=>{g.renderer.render=render;for(const fn of restore)fn();};
  });
  await page.waitForFunction(()=>window.islandDrawProbe.frames>=4);
  const draw=await page.evaluate(()=>{
   window.restoreIslandDrawProbe();const groups={};
   for(const row of window.islandDrawProbe.rows){const a=groups[row.label]??={calls:0,triangles:0,shadowCastingDraws:0,largestVertices:0};a.calls++;a.triangles+=row.triangles;a.shadowCastingDraws+=row.shadow?1:0;a.largestVertices=Math.max(a.largestVertices,row.vertices);}
   return {primaryCalls:window.islandDrawProbe.rows.length,primaryTriangles:window.islandDrawProbe.rows.reduce((a,b)=>a+b.triangles,0),groups:Object.fromEntries(Object.entries(groups).sort((a,b)=>b[1].triangles-a[1].triangles))};
  });
  // Frame timing is sampled only after all instrumentation is removed.
  const performance=await page.evaluate(async()=>{
   const g=window.__game,dt=[];let last=-1;
   for(let i=0;dt.length<120&&i<500;i++){await new Promise(requestAnimationFrame);if(g.frameStats.frame!==last){last=g.frameStats.frame;dt.push(g.frameStats.rawDt*1000);}}
   dt.sort((a,b)=>a-b);
   return {samples:dt.length,medianMs:dt[Math.floor(dt.length*.5)],p95Ms:dt[Math.floor(dt.length*.95)],sceneDraw:g.getRenderFrameStats(),memory:{...g.renderer.info.memory},programs:g.renderer.info.programs?.length,assets:g.getSkateRace().level.jungleAssets?.diagnostics,position:g.player.pos.toArray(),camera:g.camera.position.toArray(),stamp:document.querySelector('.hud-build')?.textContent};
  });
  // GPU work can improve while the frame limiter still holds both versions at
  // 60 Hz. One query per frame spans the first render through the final pose
  // restoration, including shadows, reflections and post-processing.
  const gpu=process.env.ISLAND_GPU?await page.evaluate(async()=>{
   const g=window.__game,gl=g.renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   if(!ext)return {available:false};
   const render=g.renderer.render,restorePose=g.player.restoreRenderPose,queries=[];let active=null;
   g.renderer.render=function(){
    if(!active){active={q:gl.createQuery(),frame:g.frameStats.frame};gl.beginQuery(ext.TIME_ELAPSED_EXT,active.q);}
    return render.apply(this,arguments);
   };
   g.player.restoreRenderPose=function(){
    if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push(active);active=null;}
    return restorePose.apply(this,arguments);
   };
   try{
    const start=g.frameStats.frame;while(g.frameStats.frame<start+64)await new Promise(requestAnimationFrame);
   }finally{
    g.renderer.render=render;g.player.restoreRenderPose=restorePose;
    if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);gl.deleteQuery(active.q);}
   }
   gl.flush();
   for(let attempts=0;attempts<120&&!queries.every(({q})=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE));attempts++)await new Promise(requestAnimationFrame);
   const frames=new Map(),disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
   for(const {q,frame}of queries){if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))throw Error('GPU query timed out');frames.set(frame,(frames.get(frame)||0)+gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}
   if(disjoint)throw Error('GPU query became disjoint');
   const values=[...frames.entries()].sort((a,b)=>a[0]-b[0]).slice(1,-1).map(([,ms])=>ms).sort((a,b)=>a-b);
   return {available:true,samples:values.length,medianMs:values[Math.floor(values.length*.5)],p95Ms:values[Math.floor(values.length*.95)]};
  }):undefined;
  const row={name,s,...performance,...draw,...(gpu?{gpu}:{})};reports.push(row);
  await page.screenshot({path:`${output}/${name}.png`});
  console.log(JSON.stringify({name,medianMs:row.medianMs,p95Ms:row.p95Ms,primaryCalls:row.primaryCalls,primaryTriangles:row.primaryTriangles,gpu:row.gpu,top:Object.entries(row.groups).slice(0,6)}));
 }
 await writeFile(output+'/report.json',JSON.stringify({base,method:'1280x720, full normal presentation, stopped solo rider, 120 rendered frames per supported view after warmup. Draw attribution excludes shadow and reflection cameras. Optional GPU timing uses one query per complete render frame, including shadows, reflections and post-processing.',reports,errors},null,2));
 assert.deepEqual(errors,[]);assert.ok(reports.every(r=>r.assets?.errors.length===0),'Scenery loads without errors');assert.ok(reports.every(r=>r.samples===120));assert.ok(reports.every(r=>Object.keys(r.groups).some(k=>k.startsWith('meshy-head'))),'The primary attribution must include the character, including when the ocean requires two scene passes');
}finally{await browser.close();}
