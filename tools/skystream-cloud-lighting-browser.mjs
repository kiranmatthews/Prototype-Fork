import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createPreviousCloudMaterial} from './fixtures/skystream/cloud-road-material-v1.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.slice(2).find(arg=>/^https?:/.test(arg))||'http://127.0.0.1:5187/';
const output=process.env.CLOUD_LIGHTING_OUTPUT||'/private/tmp/skystream-cloud-lighting';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,errors:[],shots:[],benchmarks:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 const started=performance.now();
 await page.goto(new URL('?playtest&level=skystream',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay);
 report.startupMs=performance.now()-started;
 await page.evaluate(async factory=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');
  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const clouds=[],fringes=[];g.getLevel().root.traverse(o=>{if(o.isMesh&&o.userData.cloudRoadVisual)clouds.push(o);if(o.userData.cloudRoadFringe)fringes.push(o)});
  const baseline=new Function('return ('+factory+')')()(THREE),originals=clouds.map(o=>o.material);
  const isolated=new THREE.Scene();isolated.fog=g.scene.fog?.clone()??null;
  g.scene.traverse(o=>{if(o.isLight){const light=o.clone();light.castShadow=false;light.position.setFromMatrixPosition(o.matrixWorld);isolated.add(light);}});
  const copies=clouds.map(o=>{const m=new THREE.Mesh(o.geometry,o.material);m.matrix.copy(o.matrixWorld);m.matrixAutoUpdate=false;isolated.add(m);return m;});
  const fringeCopies=fringes.map(o=>{const m=o.clone();m.matrix.copy(o.matrixWorld);m.matrixAutoUpdate=false;isolated.add(m);return m;});
  const poses=[{name:'road',position:[-21,151,-28],target:[2,146,-54]},
   {name:'upright-loop',position:[36,-286,-1718],target:[87,-300,-1760]},
   {name:'wall-loop',position:[178,-315,-1796],target:[157,-337,-1845]}];
  const frame=new THREE.Matrix4();fringes[0].getMatrixAt(0,frame);frame.premultiply(fringes[0].matrixWorld);
  const centre=new THREE.Vector3().setFromMatrixPosition(frame),along=new THREE.Vector3().setFromMatrixColumn(frame,0).normalize(),around=new THREE.Vector3().setFromMatrixColumn(frame,1).normalize(),outward=new THREE.Vector3().setFromMatrixColumn(frame,2).normalize();
  poses.push({name:'fringe-detail',position:centre.clone().addScaledVector(outward,1).addScaledVector(along,7).addScaledVector(around,-1).toArray(),target:centre.toArray()});
  const camera=g.camera.clone();camera.aspect=1.6;camera.updateProjectionMatrix();
  window.__cloudReview={THREE,clouds,originals,copies,fringes,fringeCopies,baseline,isolated,poses,camera,
   variant(v){[...fringes,...fringeCopies].forEach(m=>m.visible=v==='after');clouds.forEach((m,i)=>m.material=v==='before'?baseline:originals[i]);copies.forEach((m,i)=>m.material=v==='before'?baseline:originals[i]);},
   pose(i){const p=poses[i];camera.position.set(...p.position);camera.up.set(0,1,0);camera.lookAt(...p.target);camera.updateMatrixWorld(true);}};
 },createPreviousCloudMaterial.toString());
 report.geometry=await page.evaluate(()=>{
  const {clouds,originals,fringes}=window.__cloudReview;
  const materials=[...new Set(originals)];
  const textures=new Set([...materials.map(m=>{const shader={uniforms:{},vertexShader:'',fragmentShader:''};m.onBeforeCompile(shader);return shader.uniforms.uCloudNoise.value;}),...fringes.map(m=>m.material.uniforms.uCloudNoise.value)]);
  const lighting={owners:materials.length+fringes.length,textures:textures.size,baseBytes:0,mipBytes:0};
  for(const texture of textures){lighting.baseBytes+=texture.image.data.byteLength;for(let n=texture.image.width;n>=1;n>>=1)lighting.mipBytes+=n*n*n*4;}
  return {meshes:clouds.length,triangles:clouds.reduce((n,m)=>n+m.geometry.index.count/3,0),lighting,
   bakedBytes:clouds.reduce((n,m)=>n+m.geometry.attributes.cloudOptics.array.byteLength,0),materials:new Set(originals).size,fringeBatches:fringes.length,fringeInstances:fringes.reduce((n,m)=>n+m.count,0),fringeInstanceBytes:fringes.reduce((n,m)=>n+m.instanceMatrix.array.byteLength+m.geometry.attributes.fringeOptics.array.byteLength,0)};
 });
 assert.equal(report.geometry.lighting.textures,1,'Mesh lighting and all fringes must use one actual texture');
 for(const pose of process.argv.includes('--detail-only')?[3]:[0,1,2]){
  for(const variant of ['before','lighting','after']){
   const shot=await page.evaluate(async({pose,variant})=>{
    const r=window.__cloudReview,g=window.__game,renderer=g.renderer;r.pose(pose);r.variant(variant);
    const target=new r.THREE.WebGLRenderTarget(1600,1000),previous=renderer.getRenderTarget();target.texture.colorSpace=r.THREE.SRGBColorSpace;
    try{
     renderer.setRenderTarget(target);renderer.render(g.scene,r.camera);
     const pixels=new Uint8Array(1600*1000*4);renderer.readRenderTargetPixels(target,0,0,1600,1000,pixels);
     const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1000;
     const ctx=canvas.getContext('2d'),image=ctx.createImageData(1600,1000);
     for(let y=0;y<1000;y++)image.data.set(pixels.subarray((999-y)*6400,(1000-y)*6400),y*6400);
     ctx.putImageData(image,0,0);return {name:r.poses[pose].name,data:canvas.toDataURL('image/png')};
    }finally{renderer.setRenderTarget(previous);target.dispose();r.variant('after');}
   },{pose,variant});
   const filename=`${shot.name}-${variant}.png`;await writeFile(output+'/'+filename,Buffer.from(shot.data.split(',')[1],'base64'));report.shots.push(filename);
  }
  for(const size of [[1152,720],[1600,1000]]){
   const result=await page.evaluate(async({pose,size})=>{
    const r=window.__cloudReview,renderer=window.__game.renderer,gl=renderer.getContext();
    const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');r.pose(pose);
    const target=new r.THREE.WebGLRenderTarget(...size),previous=renderer.getRenderTarget();
    const samples={before:[],lighting:[],after:[]},queries=[];let disjoint=false;
    try{
     renderer.setRenderTarget(target);
     for(const v of ['before','lighting','after']){r.variant(v);for(let i=0;i<6;i++)renderer.render(r.isolated,r.camera);}
     gl.finish();
     // Alternate ABCCBA to balance warm-up/clock drift across all variants.
     for(let i=0;i<60;i++){
      const variant=['before','lighting','after','after','lighting','before'][i%6];r.variant(variant);
      if(ext){const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);renderer.render(r.isolated,r.camera);gl.endQuery(ext.TIME_ELAPSED_EXT);queries.push({query,variant});}
      else{const start=performance.now();renderer.render(r.isolated,r.camera);gl.finish();samples[variant].push(performance.now()-start);}
     }
    }finally{renderer.setRenderTarget(previous);r.variant('after');}
    if(ext){
     while(queries.some(({query})=>!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)))await new Promise(resolve=>setTimeout(resolve,10));
     disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
     for(const {query,variant}of queries){samples[variant].push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}
    }
    target.dispose();
    const stats=a=>{a.sort((x,y)=>x-y);return {medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)],samples:a.length};};
    return {pose:r.poses[pose].name,size,method:ext?'GPU timer query':'GPU-synchronized submission wall time',disjoint,before:stats(samples.before),lighting:stats(samples.lighting),after:stats(samples.after)};
   },{pose,size});
   report.benchmarks.push(result);console.log(JSON.stringify(result));assert.equal(result.disjoint,false);
  }
 }
 report.stability=await page.evaluate(async()=>{
  const r=window.__cloudReview,renderer=window.__game.renderer,target=new r.THREE.WebGLRenderTarget(320,200);
  r.variant('after');r.pose(3);const previous=renderer.getRenderTarget();
  const render=()=>{renderer.setRenderTarget(target);renderer.render(r.isolated,r.camera);const data=new Uint8Array(320*200*4);renderer.readRenderTargetPixels(target,0,0,320,200,data);renderer.setRenderTarget(previous);return data;};
  try{const a=render();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const b=render();let differingBytes=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])differingBytes++;
   r.variant('lighting');const without=render();r.variant('after');let fringePixels=0;for(let i=0;i<a.length;i+=4)if(a[i]!==without[i]||a[i+1]!==without[i+1]||a[i+2]!==without[i+2])fringePixels++;return {size:[320,200],differingBytes,fringePixels};}
  finally{renderer.setRenderTarget(previous);target.dispose();}
 });
 assert.ok(report.stability.fringePixels>0,'Visible shoulder wisps must contribute to the rendered silhouette');
 assert.equal(report.stability.differingBytes,0,'A fixed camera must render the same wisps on successive frames');
 await page.evaluate(()=>{const r=window.__cloudReview;r.variant('after');r.baseline.dispose();window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});
 await page.waitForTimeout(500);await page.screenshot({path:output+'/normal-presentation.png'});
 assert.deepEqual(report.errors,[]);console.log('PASS cloud-lighting native comparisons, alternating A/B measurements and normal presentation');
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
