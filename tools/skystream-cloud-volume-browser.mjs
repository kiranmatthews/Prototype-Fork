import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.slice(2).find(s=>/^https?:/.test(s))||'http://127.0.0.1:5187/';
const out=process.env.CLOUD_VOLUME_OUTPUT||'/private/tmp/skystream-cloud-volume';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,errors:[],benchmarks:[],shots:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(function tick(t){if(window.__cloudFreeze&&cb.name==='frame'){raf(tick);return;}cb(t);});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const start=performance.now();await page.goto(new URL('?playtest&level=skystream',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay);
 report.startupMs=performance.now()-start;
 await page.evaluate(()=>window.__cloudFreeze=true);
 report.resources=await page.evaluate(async()=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');
  const {createHybridCloudRoad}=await import('/src/cloudRoad.ts');
  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const roots=[];g.getLevel().root.traverse(o=>{if(o.userData.cloudRoadSource)roots.push(o);});
  const isolated=new THREE.Scene();isolated.fog=g.scene.fog?.clone()??null;
  g.scene.traverse(o=>{if(o.isLight){const l=o.clone();l.castShadow=false;l.position.setFromMatrixPosition(o.matrixWorld);isolated.add(l);}});
  const hybrid=new THREE.Group(),volume=new THREE.Group();isolated.add(hybrid,volume);
  for(const root of roots){
   const s=root.userData.cloudRoadSource,h=createHybridCloudRoad(s.sections,s.flatHalf,s.gutterRadius,s.sunDirection);
   h.matrix.copy(root.matrixWorld);h.matrixAutoUpdate=false;hybrid.add(h);
   const copy=new THREE.Group();copy.matrix.copy(root.matrixWorld);copy.matrixAutoUpdate=false;volume.add(copy);
   for(const mesh of root.children){const m=mesh.clone();m.onBeforeRender=mesh.onBeforeRender;copy.add(m);}
  }
  const camera=g.camera.clone();camera.aspect=1.6;camera.updateProjectionMatrix();
  const poses=[{name:'road',position:[-21,151,-28],target:[2,146,-54]},
   {name:'upright-loop',position:[36,-286,-1718],target:[87,-300,-1760]},
   {name:'wall-loop',position:[178,-315,-1796],target:[157,-337,-1845]}];
  const densityTextures=new Set(roots.map(r=>r.children[0].material.uniforms.uDensity.value));
  const diagnostic={owners:roots.length,textures:densityTextures.size,densityBytes:[...densityTextures].reduce((n,t)=>n+t.image.data.byteLength,0),emptyBytes:roots[0].children[0].material.uniforms.uEmpty.value.image.data.byteLength,lightingBytes:roots.reduce((n,r)=>n+r.userData.lightingBytes,0),maxAtlasDimension:Math.max(...roots.flatMap(r=>{const i=r.children[0].material.uniforms.uLight.value.image;return [i.width,i.height]})),frameBytes:roots.reduce((n,r)=>n+r.userData.frameBytes,0),roots:roots.length,chunks:roots.reduce((n,r)=>n+r.children.length,0)};
  window.__volumeReview={THREE,roots,isolated,hybrid,volume,camera,poses,
   variant(v){hybrid.visible=v==='hybrid';volume.visible=v!=='hybrid';for(const root of roots)root.children[0].material.uniforms.uSkipEmpty.value=v!=='unskipped';},
   pose(i){const p=poses[i];camera.position.set(...p.position);camera.up.set(0,1,0);camera.lookAt(...p.target);camera.updateMatrixWorld(true);}};
  return diagnostic;
 });console.log(JSON.stringify({phase:'resources',...report.resources}));
 for(let pose=0;pose<3;pose++){
  const shot=await page.evaluate(async pose=>{
   const r=window.__volumeReview,g=window.__game,renderer=g.renderer;r.pose(pose);
   const target=new r.THREE.WebGLRenderTarget(1600,1000),prev=renderer.getRenderTarget();target.texture.colorSpace=r.THREE.SRGBColorSpace;
   try{renderer.setRenderTarget(target);renderer.render(g.scene,r.camera);const pixels=new Uint8Array(1600*1000*4);renderer.readRenderTargetPixels(target,0,0,1600,1000,pixels);
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d'),image=ctx.createImageData(1600,1000);
    for(let y=0;y<1000;y++)image.data.set(pixels.subarray((999-y)*6400,(1000-y)*6400),y*6400);ctx.putImageData(image,0,0);return {name:r.poses[pose].name,data:canvas.toDataURL('image/png')};
   }finally{renderer.setRenderTarget(prev);target.dispose();}
  },pose);
  await writeFile(out+'/'+shot.name+'.png',Buffer.from(shot.data.split(',')[1],'base64'));report.shots.push(shot.name+'.png');
  const equivalence=await page.evaluate(pose=>{
   const r=window.__volumeReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(800,500),prev=renderer.getRenderTarget();r.pose(pose);
   const render=variant=>{r.variant(variant);renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const pixels=new Uint8Array(800*500*4);renderer.readRenderTargetPixels(target,0,0,800,500,pixels);return pixels;};
   try{const a=render('unskipped'),b=render('volume');let total=0,max=0,changed=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);total+=d;max=Math.max(max,d);if(d)changed++;}return {pose:r.poses[pose].name,meanByteError:total/a.length,maxByteError:max,changedBytes:changed};}
   finally{renderer.setRenderTarget(prev);target.dispose();r.variant('volume');}
  },pose);(report.skippingEquivalence??=[]).push(equivalence);console.log(JSON.stringify({phase:'skipping',...equivalence}));assert.ok(equivalence.meanByteError<.15,'Empty-space skips must preserve the integrated density');
  for(const size of [[1152,720],[1600,1000]]){
   const result=await page.evaluate(async({pose,size})=>{
    const r=window.__volumeReview,renderer=window.__game.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    r.pose(pose);const target=new r.THREE.WebGLRenderTarget(...size),prev=renderer.getRenderTarget(),samples={hybrid:[],unskipped:[],volume:[]},queries=[];
    try{
     renderer.setRenderTarget(target);
     for(const v of ['hybrid','unskipped','volume']){r.variant(v);for(let i=0;i<4;i++)renderer.render(r.isolated,r.camera);}
     gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
     for(let i=0;i<24;i++){
      const variant=['hybrid','unskipped','volume','volume','unskipped','hybrid'][i%6];r.variant(variant);
      if(ext){const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);renderer.render(r.isolated,r.camera);gl.endQuery(ext.TIME_ELAPSED_EXT);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
       while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise(resolve=>setTimeout(resolve,5));
       queries.push({query,variant});}
      else{const start=performance.now();renderer.render(r.isolated,r.camera);gl.finish();samples[variant].push(performance.now()-start);}
     }
    }finally{renderer.setRenderTarget(prev);r.variant('volume');}
    let disjoint=false;
    if(ext){while(queries.some(({query})=>!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)))await new Promise(resolve=>setTimeout(resolve,10));
     disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);for(const {query,variant}of queries){samples[variant].push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}}
    target.dispose();const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)],samples:a.length};};
    return {pose:r.poses[pose].name,size,method:ext?'GPU timer query':'submission wall time; not a GPU measurement',disjoint,hybrid:stats(samples.hybrid),unskipped:stats(samples.unskipped),volume:stats(samples.volume)};
   },{pose,size});report.benchmarks.push(result);console.log(JSON.stringify(result));assert.equal(result.disjoint,false);
  }
 }
 report.stability=await page.evaluate(async()=>{
  const r=window.__volumeReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(320,200),prev=renderer.getRenderTarget();r.pose(2);r.variant('volume');
  const render=()=>{renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const p=new Uint8Array(320*200*4);renderer.readRenderTargetPixels(target,0,0,320,200,p);renderer.setRenderTarget(prev);return p;};
  try{const a=render();await new Promise(resolve=>requestAnimationFrame(resolve));const b=render();let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;return {different};}
  finally{target.dispose();renderer.setRenderTarget(prev);}
 });assert.equal(report.stability.different,0);
 await page.screenshot({path:out+'/spawn-native.png'});
 await page.evaluate(()=>{window.__cloudFreeze=false;window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/normal-presentation.png'});
 assert.deepEqual(report.errors,[]);console.log('PASS full density, rotated loop views, GPU A/B and deterministic rendering');
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
