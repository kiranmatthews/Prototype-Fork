import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.slice(2).find(s=>/^https?:/.test(s))||'http://127.0.0.1:5187/';
const out=process.env.CLOUD_VOLUME_OUTPUT||'/private/tmp/skystream-cloud-volume';await mkdir(out,{recursive:true});
const reference=await readFile(new URL('./fixtures/skystream/cloud-road-volume-e3.frag.glsl',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,errors:[],benchmarks:[],shots:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(function tick(t){if(window.__cloudFreeze&&cb.name==='frame'){raf(tick);return;}cb(t);});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const start=performance.now();await page.goto(new URL('?playtest&level=skystream',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay);
 report.startupMs=performance.now()-start;
 await page.evaluate(()=>window.__cloudFreeze=true);
 report.resources=await page.evaluate(async reference=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');

  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const roots=[];g.getLevel().root.traverse(o=>{if(o.userData.cloudRoadSource)roots.push(o);});
  const isolated=new THREE.Scene();isolated.fog=g.scene.fog?.clone()??null;
  g.scene.traverse(o=>{if(o.isLight){const l=o.clone();l.castShadow=false;l.position.setFromMatrixPosition(o.matrixWorld);isolated.add(l);}});
  const volume=new THREE.Group();isolated.add(volume);const pairs=[];
  for(const root of roots){
   const original=root.children[0].material,previous=original.clone();previous.uniforms=original.uniforms;previous.fragmentShader=reference;previous.needsUpdate=true;
   const copy=new THREE.Group();copy.matrix.copy(root.matrixWorld);copy.matrixAutoUpdate=false;volume.add(copy);
   for(const mesh of root.children){
    const m=mesh.clone();m.onBeforeRender=mesh.onBeforeRender;copy.add(m);
    const {min,max}=mesh.userData.volumeChunk,size=max.clone().sub(min),centre=min.clone().add(max).multiplyScalar(.5);
    const previousGeometry=new THREE.BoxGeometry(...size.toArray());previousGeometry.translate(...centre.toArray());
    pairs.push({mesh,copy:m,original,previous,geometry:mesh.geometry,previousGeometry});
   }
  }
  const camera=g.camera.clone();camera.aspect=1.6;camera.updateProjectionMatrix();
  const poses=[{name:'road',position:[-21,151,-28],target:[2,146,-54]},
   {name:'upright-loop',position:[36,-286,-1718],target:[87,-300,-1760]},
   {name:'wall-loop',position:[178,-315,-1796],target:[157,-337,-1845]}];
  const densityTextures=new Set(roots.map(r=>r.children[0].material.uniforms.uDensity.value));
  const diagnostic={owners:roots.length,textures:densityTextures.size,densityBytes:[...densityTextures].reduce((n,t)=>n+t.image.data.byteLength,0),emptyBytes:roots[0].children[0].material.uniforms.uEmpty.value.image.data.byteLength,lightingBytes:roots.reduce((n,r)=>n+r.userData.lightingBytes,0),maxAtlasDimension:Math.max(...roots.flatMap(r=>{const i=r.children[0].material.uniforms.uLight.value.image;return [i.width,i.height]})),coordinateBytes:roots.reduce((n,r)=>n+r.userData.coordinateBytes,0),frameBytes:roots.reduce((n,r)=>n+r.userData.frameBytes,0),roots:roots.length,chunks:roots.reduce((n,r)=>n+r.children.length,0)};
  window.__volumeReview={THREE,roots,isolated,volume,pairs,camera,poses,
   variant(v){for(const p of pairs){p.mesh.material=p.copy.material=v==='reference'?p.previous:p.original;p.mesh.geometry=p.copy.geometry=v==='reference'?p.previousGeometry:p.geometry;}},
   pose(i){const p=poses[i];camera.position.set(...p.position);camera.up.set(0,1,0);camera.lookAt(...p.target);camera.updateMatrixWorld(true);}};
  return diagnostic;
 },reference);console.log(JSON.stringify({phase:'resources',...report.resources}));
 for(let pose=0;pose<3;pose++){
  for(const variant of ['reference','volume']){
  const shot=await page.evaluate(async ({pose,variant})=>{
   const r=window.__volumeReview,g=window.__game,renderer=g.renderer;r.pose(pose);r.variant(variant);
   const target=new r.THREE.WebGLRenderTarget(1600,1000),prev=renderer.getRenderTarget();target.texture.colorSpace=r.THREE.SRGBColorSpace;
   try{renderer.setRenderTarget(target);renderer.render(g.scene,r.camera);const pixels=new Uint8Array(1600*1000*4);renderer.readRenderTargetPixels(target,0,0,1600,1000,pixels);
    const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;const ctx=canvas.getContext('2d'),image=ctx.createImageData(1600,1000);
    for(let y=0;y<1000;y++)image.data.set(pixels.subarray((999-y)*6400,(1000-y)*6400),y*6400);ctx.putImageData(image,0,0);return {name:r.poses[pose].name,data:canvas.toDataURL('image/png')};
   }finally{renderer.setRenderTarget(prev);target.dispose();}
  },{pose,variant});
  const filename=shot.name+(variant==='reference'?'-reference':'')+'.png';
  await writeFile(out+'/'+filename,Buffer.from(shot.data.split(',')[1],'base64'));report.shots.push(filename);
  }
  const equivalence=await page.evaluate(pose=>{
   const r=window.__volumeReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(800,500),prev=renderer.getRenderTarget();r.pose(pose);
   const render=variant=>{r.variant(variant);renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const pixels=new Uint8Array(800*500*4);renderer.readRenderTargetPixels(target,0,0,800,500,pixels);return pixels;};
   try{const a=render('reference'),b=render('volume');let total=0,max=0,changed=0,large=0;for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);total+=d;max=Math.max(max,d);if(d)changed++;if(d>32)large++;}return {pose:r.poses[pose].name,meanByteError:total/a.length,maxByteError:max,changedBytes:changed,largeDifferenceBytes:large};}
   finally{renderer.setRenderTarget(prev);target.dispose();r.variant('volume');}
  },pose);(report.coordinateEquivalence??=[]).push(equivalence);console.log(JSON.stringify({phase:'coordinates',...equivalence}));assert.ok(equivalence.meanByteError<.2,'Cached coordinates must preserve the cloud appearance');
  for(const size of [[1152,720],[1600,1000]]){
   const result=await page.evaluate(async({pose,size})=>{
    const r=window.__volumeReview,renderer=window.__game.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    r.pose(pose);const target=new r.THREE.WebGLRenderTarget(...size),prev=renderer.getRenderTarget(),samples={reference:[],volume:[]},queries=[];
    try{
     renderer.setRenderTarget(target);
     for(const v of ['reference','volume']){r.variant(v);for(let i=0;i<4;i++)renderer.render(r.isolated,r.camera);}
     gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
     for(let i=0;i<24;i++){
      const variant=['reference','volume','volume','reference'][i%4];r.variant(variant);
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
    return {pose:r.poses[pose].name,size,method:ext?'GPU timer query':'submission wall time; not a GPU measurement',disjoint,reference:stats(samples.reference),volume:stats(samples.volume)};
   },{pose,size});report.benchmarks.push(result);console.log(JSON.stringify(result));assert.equal(result.disjoint,false);
  }
 }
 report.stability=await page.evaluate(async()=>{
  const r=window.__volumeReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(320,200),prev=renderer.getRenderTarget();r.pose(2);r.variant('volume');
  const render=()=>{renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const p=new Uint8Array(320*200*4);renderer.readRenderTargetPixels(target,0,0,320,200,p);renderer.setRenderTarget(prev);return p;};
  try{const a=render();await new Promise(resolve=>requestAnimationFrame(resolve));const b=render();let different=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])different++;return {different};}
  finally{target.dispose();renderer.setRenderTarget(prev);}
 });assert.equal(report.stability.different,0);
 report.skipEquivalence=await page.evaluate(()=>{
  const r=window.__volumeReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(800,500),prev=renderer.getRenderTarget(),results=[];
  try{for(let pose=0;pose<3;pose++){
   r.pose(pose);const images=[];
   for(const skip of [false,true]){for(const {original}of r.pairs)original.uniforms.uSkipEmpty.value=skip;renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const pixels=new Uint8Array(800*500*4);renderer.readRenderTargetPixels(target,0,0,800,500,pixels);images.push(pixels);}
   let total=0,max=0;for(let i=0;i<images[0].length;i++){const d=Math.abs(images[0][i]-images[1][i]);total+=d;max=Math.max(max,d);}results.push({pose:r.poses[pose].name,meanByteError:total/images[0].length,maxByteError:max});
  }return results;}finally{renderer.setRenderTarget(prev);target.dispose();for(const {original}of r.pairs)original.uniforms.uSkipEmpty.value=true;}
 });for(const result of report.skipEquivalence)assert.ok(result.maxByteError<=1,'Conservative skips must preserve occupied samples');
 const skyReview=await page.evaluate(()=>{
  const r=window.__volumeReview,g=window.__game,renderer=g.renderer,sky=g.scene.getObjectByName('Distant sky backdrop'),scene=new r.THREE.Scene(),copy=sky.clone();
  copy.onBeforeRender=sky.onBeforeRender;scene.add(copy);
  const original=sky.material,previous=original.clone();previous.onBeforeCompile=shader=>{
   original.onBeforeCompile(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('pow(1.0-smoothstep(.06,.64,skyHeight),.75)*.92','(1.0-smoothstep(.12,.5,skyHeight))*.65').replace('vec3(.025,.135,.42),bottomTint','vec3(.07,.25,.55),bottomTint');
  };previous.customProgramCacheKey=()=>original.customProgramCacheKey()+'-previous-gradient';
  const target=new r.THREE.WebGLRenderTarget(640,640),prev=renderer.getRenderTarget(),camera=r.camera.clone(),shots=[],comparisons=[];target.texture.colorSpace=r.THREE.SRGBColorSpace;camera.aspect=1;camera.fov=38;camera.updateProjectionMatrix();
  try{for(const pitch of [-65,0,65]){
   const radians=pitch*Math.PI/180;camera.position.set(0,0,0);camera.up.set(0,1,0);camera.lookAt(0,Math.sin(radians),-Math.cos(radians));camera.updateMatrixWorld();const images=[];
   for(const variant of ['before','after']){
    copy.material=variant==='before'?previous:original;renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(640*640*4);renderer.readRenderTargetPixels(target,0,0,640,640,pixels);images.push(pixels);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=640;const ctx=canvas.getContext('2d'),im=ctx.createImageData(640,640);for(let y=0;y<640;y++)im.data.set(pixels.subarray((639-y)*2560,(640-y)*2560),y*2560);ctx.putImageData(im,0,0);shots.push({name:`sky-${pitch}-${variant}.png`,data:canvas.toDataURL('image/png')});
   }
   let different=0;const mean=[0,0,0];for(let i=0;i<images[0].length;i++){if(images[0][i]!==images[1][i])different++;if(i%4<3)mean[i%4]+=images[1][i]-images[0][i];}comparisons.push({pitch,different,meanDeltaRGB:mean.map(v=>v/(640*640))});
  }return {shots,comparisons};}finally{renderer.setRenderTarget(prev);target.dispose();previous.dispose();}
 });
 for(const shot of skyReview.shots)await writeFile(out+'/'+shot.name,Buffer.from(shot.data.split(',')[1],'base64'));
 report.sky=skyReview.comparisons;assert.equal(report.sky.find(p=>p.pitch===65).different,0,'Upper original panorama must remain unchanged');assert.ok(report.sky.find(p=>p.pitch===-65).meanDeltaRGB[0]<-15,'Lower sky must gain visible blue contrast');
 await page.screenshot({path:out+'/spawn-native.png'});
 await page.evaluate(()=>{window.__cloudFreeze=false;window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/normal-presentation.png'});
 assert.deepEqual(report.errors,[]);console.log('PASS full density, rotated loop views, GPU A/B and deterministic rendering');
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
