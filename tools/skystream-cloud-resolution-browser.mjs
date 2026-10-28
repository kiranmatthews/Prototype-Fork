import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.slice(2).find(s=>/^https?:/.test(s))||'http://127.0.0.1:5187/';
const out=process.env.CLOUD_RESOLUTION_OUTPUT||'/private/tmp/skystream-cloud-360p';await mkdir(out,{recursive:true});
const quick=process.argv.includes('--quick');
const occlusionOnly=process.argv.includes('--occlusion-only');
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,errors:[],sizes:[],benchmarks:[],pacing:[]};
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1});page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(function tick(t){if(window.__cloudFreeze&&cb.name==='frame'){raf(tick);return;}cb(t);});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(new URL('?playtest&level=skystream',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='skystream'&&!window.__game.gameFlow.blocksGameplay);
 for(const resolution of [null,720,480]){
  await page.evaluate(resolution=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(resolution);g.crtGuestSettings.setEnabled(false);},resolution);
  await page.waitForTimeout(700);
  const state=await page.evaluate(resolution=>({resolution:resolution??'native',...window.__game.cloudPathPass.diagnostics,drawingBuffer:[window.__game.renderer.getContext().drawingBufferWidth,window.__game.renderer.getContext().drawingBufferHeight]}),resolution);
  report.sizes.push(state);console.log(JSON.stringify({phase:'size',...state}));assert.equal(state.height,360);assert.equal(state.clouds,188);
  await page.screenshot({path:out+`/spawn-${resolution??'native'}.png`});
 }
 if(quick){assert.deepEqual(report.errors,[]);console.log('PASS cloud 360p cap and full-size scene at native/720p/480p');}
 else{
  await page.evaluate(()=>{window.__cloudFreeze=true;window.__game.renderQualitySettings.setRegularResolution(null);});
  await page.evaluate(async()=>{
   const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js'),camera=g.camera.clone();camera.aspect=1.6;camera.updateProjectionMatrix();
   const poses=[{name:'road',position:[-21,151,-28],target:[2,146,-54]},{name:'upright-loop',position:[36,-286,-1718],target:[87,-300,-1760]},{name:'wall-loop',position:[178,-315,-1796],target:[157,-337,-1845]}];
   const draw=(low,scene,camera,target)=>{g.renderer.setRenderTarget(target);if(!low||!g.cloudPathPass.render(g.renderer,scene,camera,target))g.renderer.render(scene,camera);};
   const png=(pixels,width,height)=>{const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),im=ctx.createImageData(width,height);for(let y=0;y<height;y++)im.data.set(pixels.subarray((height-1-y)*width*4,(height-y)*width*4),y*width*4);ctx.putImageData(im,0,0);return canvas.toDataURL('image/png');};
   window.__cloudResolutionReview={THREE,camera,poses,draw,png,pose(i){const p=poses[i];camera.position.set(...p.position);camera.up.set(0,1,0);camera.lookAt(...p.target);camera.updateMatrixWorld();}};
  });
  for(let pose=0;pose<(occlusionOnly?0:3);pose++){
   const unfeathered=await page.evaluate(pose=>{
    const g=window.__game,r=window.__cloudResolutionReview,target=new r.THREE.WebGLRenderTarget(1600,1000),previous=g.renderer.getRenderTarget();target.texture.colorSpace=r.THREE.SRGBColorSpace;r.pose(pose);
    try{g.cloudPathPass.featherEdges=false;r.draw(true,g.scene,r.camera,target);const pixels=new Uint8Array(1600*1000*4);g.renderer.readRenderTargetPixels(target,0,0,1600,1000,pixels);return {name:r.poses[pose].name,data:r.png(pixels,1600,1000)};}finally{g.cloudPathPass.featherEdges=true;g.renderer.setRenderTarget(previous);target.dispose();}
   },pose);await writeFile(out+'/'+unfeathered.name+'-unfeathered.png',Buffer.from(unfeathered.data.split(',')[1],'base64'));
   for(const low of [false,true]){
    const shot=await page.evaluate(({pose,low})=>{
     const g=window.__game,r=window.__cloudResolutionReview,renderer=g.renderer,previous=renderer.getRenderTarget(),target=new r.THREE.WebGLRenderTarget(1600,1000);target.texture.colorSpace=r.THREE.SRGBColorSpace;r.pose(pose);
     try{r.draw(low,g.scene,r.camera,target);const pixels=new Uint8Array(1600*1000*4);renderer.readRenderTargetPixels(target,0,0,1600,1000,pixels);return {name:r.poses[pose].name,data:r.png(pixels,1600,1000)};}finally{renderer.setRenderTarget(previous);target.dispose();}
    },{pose,low});await writeFile(out+'/'+shot.name+(low?'-360p':'-full')+'.png',Buffer.from(shot.data.split(',')[1],'base64'));
   }
   for(const size of [[1152,720],[1600,1000]]){
    const result=await page.evaluate(async({pose,size})=>{
     const g=window.__game,r=window.__cloudResolutionReview,renderer=g.renderer,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),previous=renderer.getRenderTarget(),target=new r.THREE.WebGLRenderTarget(...size);r.pose(pose);
     const samples={full:[],low:[]},shadows=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
     try{
      for(const low of [false,true])for(let i=0;i<3;i++)r.draw(low,g.scene,r.camera,target);
      for(let i=0;i<24;i++){
       const low=[false,true,true,false][i%4],variant=low?'low':'full',query=ext?gl.createQuery():null,start=performance.now();
       if(ext)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);r.draw(low,g.scene,r.camera,target);if(ext)gl.endQuery(ext.TIME_ELAPSED_EXT);
       gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
       if(ext){while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))await new Promise(resolve=>setTimeout(resolve,5));samples[variant].push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}else samples[variant].push(performance.now()-start);
      }
      const stat=a=>{a.sort((a,b)=>a-b);return {medianMs:a[Math.floor(a.length/2)],p95Ms:a[Math.floor(a.length*.95)],samples:a.length};};
      return {pose:r.poses[pose].name,size,method:ext?'GPU timer query':'wall time',disjoint:ext?gl.getParameter(ext.GPU_DISJOINT_EXT):false,full:stat(samples.full),low:stat(samples.low),cloudTarget:g.cloudPathPass.diagnostics};
     }finally{renderer.setRenderTarget(previous);renderer.shadowMap.autoUpdate=shadows;target.dispose();}
    },{pose,size});report.benchmarks.push(result);console.log(JSON.stringify({phase:'gpu',...result}));assert.equal(result.disjoint,false);assert.equal(result.cloudTarget.height,360);
   }
  }
  // Real GPU overlap: sharp opaque foreground, high-frequency scene behind a
  // translucent cloud, and transparent effects in front all retain native pixels.
  report.occlusion=await page.evaluate(()=>{
   const g=window.__game,r=window.__cloudResolutionReview,T=r.THREE,renderer=g.renderer,previous=renderer.getRenderTarget(),scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,1,100);camera.position.z=10;
   scene.background=new T.Color(.02,.04,.1);
   const pixels=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++)pixels.set((x+y)%2?[255,255,255,255]:[0,0,0,255],(x+y*64)*4);
   const tex=new T.DataTexture(pixels,64,64);tex.needsUpdate=true;tex.magFilter=tex.minFilter=T.NearestFilter;
   const behind=new T.Mesh(new T.PlaneGeometry(5,5),new T.MeshBasicMaterial({map:tex}));behind.position.z=-1;
   const front=new T.Mesh(new T.PlaneGeometry(.83,4),new T.MeshBasicMaterial({color:0xff1020}));front.position.set(.13,0,1);
   const cloud=new T.Mesh(new T.PlaneGeometry(6,6),new T.MeshBasicMaterial({color:0xc5dfff,transparent:true,opacity:.7,depthWrite:true}));cloud.userData.cloudRoadVisual=true;
   const effect=new T.Mesh(new T.PlaneGeometry(.15,3),new T.MeshBasicMaterial({color:0x00ff00,transparent:true,opacity:.8,depthWrite:false}));effect.position.set(-1,0,2);
   scene.add(behind,front,cloud,effect);const target=new T.WebGLRenderTarget(1000,1000),images=[];
   try{for(const low of [false,true]){r.draw(low,scene,camera,target);const p=new Uint8Array(1000*1000*4);renderer.readRenderTargetPixels(target,0,0,1000,1000,p);images.push(p);}
    let foregroundPixels=0,foregroundMax=0,interiorMax=0,effectPixels=0,effectMax=0;
    for(let y=200;y<800;y++)for(let x=250;x<750;x++){
     const i=(x+y*1000)*4,a=images[0],b=images[1],d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));
     if(a[i]>245&&a[i+1]<10&&a[i+2]<10){foregroundPixels++;foregroundMax=Math.max(foregroundMax,d);}
     else if(a[i+1]>190&&a[i]<70){effectPixels++;effectMax=Math.max(effectMax,d);}
     else interiorMax=Math.max(interiorMax,d);
    }
    const depthMaterial=new T.ShaderMaterial({uniforms:{t:{value:g.cloudPathPass.target.depthTexture}},depthTest:false,depthWrite:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'uniform sampler2D t;void main(){gl_FragColor=vec4(vec3(texture2D(t,vec2(.5)).r),1.0);}'}),probe=new T.Mesh(new T.PlaneGeometry(2,2),depthMaterial);
    renderer.setRenderTarget(target);renderer.render(probe,camera);const depth=new Uint8Array(4);renderer.readRenderTargetPixels(target,500,500,1,1,depth);probe.geometry.dispose();depthMaterial.dispose();
    return {foregroundPixels,foregroundMax,effectPixels,effectMax,interiorMax,depth:Array.from(depth),glError:renderer.getContext().getError(),images:images.map(p=>r.png(p,1000,1000))};
   }finally{renderer.setRenderTarget(previous);target.dispose();tex.dispose();for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}}
  });for(let i=0;i<report.occlusion.images.length;i++)await writeFile(out+`/occlusion-${i}.png`,Buffer.from(report.occlusion.images[i].split(',')[1],'base64'));delete report.occlusion.images;console.log(JSON.stringify({phase:'occlusion',...report.occlusion}));assert.ok(report.occlusion.foregroundPixels>10000);assert.equal(report.occlusion.foregroundMax,0);assert.ok(report.occlusion.effectPixels>1000);assert.ok(report.occlusion.effectMax<=1);assert.ok(report.occlusion.interiorMax<=1);
  // A sloped cloud cutting through a solid plane exposes nearest-depth stair
  // steps. Continuous-depth reconstruction should match the native boundary.
  report.intersection=await page.evaluate(()=>{
   const g=window.__game,r=window.__cloudResolutionReview,T=r.THREE,renderer=g.renderer,previous=renderer.getRenderTarget(),scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,1,100);camera.position.z=10;
   scene.background=new T.Color(.02,.04,.1);
   const solid=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshBasicMaterial({color:0xff1020}));solid.position.z=.08;
   const cloud=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshBasicMaterial({color:0xc5dfff,transparent:true,opacity:.7,depthWrite:true}));cloud.rotation.set(.25,.4,.1);cloud.userData.cloudRoadVisual=true;scene.add(solid,cloud);
   const target=new T.WebGLRenderTarget(1000,1000),images=[];
   try{for(const low of [false,true]){r.draw(low,scene,camera,target);const p=new Uint8Array(1000*1000*4);renderer.readRenderTargetPixels(target,0,0,1000,1000,p);images.push(p);}
    let changedPixels=0,foregroundPixels=0,totalDifference=0;
    for(let y=250;y<750;y++)for(let x=250;x<750;x++){const i=(x+y*1000)*4,a=images[0],b=images[1];let difference=0;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);difference=Math.max(difference,d);totalDifference+=d;}if(difference>2)changedPixels++;if(a[i]>245&&a[i+1]<10)foregroundPixels++;}
    return {changedPixels,foregroundPixels,meanChannelDifference:totalDifference/(500*500*3),images:images.map(p=>r.png(p,1000,1000))};
   }finally{renderer.setRenderTarget(previous);target.dispose();for(const mesh of scene.children){mesh.geometry.dispose();mesh.material.dispose();}}
  });for(let i=0;i<report.intersection.images.length;i++)await writeFile(out+`/intersection-${i}.png`,Buffer.from(report.intersection.images[i].split(',')[1],'base64'));delete report.intersection.images;
  console.log(JSON.stringify({phase:'intersection',...report.intersection}));assert.ok(report.intersection.foregroundPixels>20000);assert.ok(report.intersection.changedPixels<100);assert.ok(report.intersection.meanChannelDifference<.1);
  await page.evaluate(()=>{window.__cloudFreeze=false;window.__game.crtGuestSettings.setEnabled(true);});
  for(const [resolution,variants]of (occlusionOnly?[]:[[720,[false,true]],[null,[true,false]]]))for(const low of variants){
   await page.evaluate(({resolution,low})=>{const g=window.__game;g.cloudPathPass.enabled=low;g.renderQualitySettings.setRegularResolution(resolution);}, {resolution,low});await page.waitForTimeout(2200);
   const result=await page.evaluate(async({resolution,low})=>{const g=window.__game,start=performance.now(),first=g.frameStats.frame;await new Promise(resolve=>setTimeout(resolve,8000));const elapsedMs=performance.now()-start;return {resolution:resolution??'native',low,fps:(g.frameStats.frame-first)*1000/elapsedMs,cloudTarget:g.cloudPathPass.diagnostics};},{resolution,low});report.pacing.push(result);console.log(JSON.stringify({phase:'pacing',...result}));
  }
  await page.evaluate(()=>{const g=window.__game;g.cloudPathPass.enabled=true;g.renderQualitySettings.setRegularResolution(720);});await page.waitForTimeout(500);await page.screenshot({path:out+'/normal-crt.png'});
  assert.deepEqual(report.errors,[]);console.log('PASS 360p cloud pass, full-res opaque/transparent detail, GPU A/B and whole-game pacing');
 }
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
