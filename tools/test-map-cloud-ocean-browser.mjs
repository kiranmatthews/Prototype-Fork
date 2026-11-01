import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5187/',out=process.env.MAP_CLOUD_GPU_OUTPUT||'/private/tmp/map-cloud-ocean';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:640,height:480}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__cloud-ocean-review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Cloud ocean composition</title>'}));
 await page.goto(new URL('__cloud-ocean-review',base).href);
 const result=await page.evaluate(async()=>{
  const text=await(await fetch('/src/unityOcean.ts')).text();
  const threeUrl=text.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1];
  const T=await import(threeUrl),{CloudPathPass}=await import('/src/cloudPathPass.ts'),{OceanPrimaryPass}=await import('/src/oceanPrimaryPass.ts'),{createCloudPlatform}=await import('/src/cloudPlatform.ts');
  const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(640,480);document.body.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,4/3,.1,100);scene.background=new T.Color(.08,.18,.4);camera.position.set(9,7,18);camera.lookAt(0,-1,0);
  const cloud=createCloudPlatform(16,10,7319,false,2.5);cloud.position.y=1;scene.add(cloud);
  const checker=new Uint8Array(64*64*4);for(let y=0;y<64;y++)for(let x=0;x<64;x++)checker.set((x+y)%2?[230,250,255,255]:[20,70,100,255],4*(x+y*64));
  const tex=new T.DataTexture(checker,64,64);tex.needsUpdate=true;tex.minFilter=tex.magFilter=T.NearestFilter;
  const behind=new T.Mesh(new T.PlaneGeometry(24,16),new T.MeshBasicMaterial({map:tex}));behind.position.set(0,0,-6);scene.add(behind);
  const front=new T.Mesh(new T.BoxGeometry(1.7,5,1.4),new T.MeshBasicMaterial({color:0xff1808}));front.position.set(1,0,6);scene.add(front);
  const ocean=new T.Group(),water=new T.Mesh(new T.PlaneGeometry(35,35),new T.MeshBasicMaterial({color:0x22ddee,transparent:true,opacity:.28,depthWrite:false}));water.rotation.x=-Math.PI/2;water.position.y=-6;ocean.add(water);scene.add(ocean);
  const cloudPass=new CloudPathPass(),primary=new OceanPrimaryPass(),targets=[];
  const rt=()=>{const t=new T.WebGLRenderTarget(640,480,{type:T.HalfFloatType,depthBuffer:true});targets.push(t);return t;};
  const reference=rt(),actual=rt(),opaque=rt(),sentinel=rt();
  const draw=(reuse,target)=>{
   renderer.autoClear=true;renderer.setRenderTarget(target);
   if(reuse){if(!primary.prepare(scene,camera,ocean))throw Error('Synthetic scene rejected');primary.render(renderer,scene,camera,target,opaque,(r,s,c,t)=>cloudPass.render(r,s,c,t));}
   else cloudPass.render(renderer,scene,camera,target);
   const data=new Uint16Array(640*480*4);renderer.readRenderTargetPixels(target,0,0,640,480,data);return data;
  };
  try{
   draw(false,reference);const a=draw(false,reference),b=draw(true,actual);let changed=0,max=0,redPixels=0;
   for(let i=0;i<a.length;i+=4){
    if(T.DataUtils.fromHalfFloat(a[i])>.9&&T.DataUtils.fromHalfFloat(a[i+1])<.1)redPixels++;
    let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(T.DataUtils.fromHalfFloat(a[i+k])-T.DataUtils.fromHalfFloat(b[i+k])));
    if(d>.001)changed++;max=Math.max(max,d);
   }
   if(redPixels<1000||changed>8)throw Error(JSON.stringify({redPixels,changed,max}));
   const objects=[];scene.traverse(o=>objects.push([o,o.layers.mask]));renderer.setRenderTarget(sentinel);renderer.autoClear=true;
   const before=cloud.onBeforeRender;cloud.onBeforeRender=()=>{throw Error('injected cloud draw failure');};
   let failed=false;
   try{primary.prepare(scene,camera,ocean);primary.render(renderer,scene,camera,actual,opaque,(r,s,c,t)=>cloudPass.render(r,s,c,t));}
   catch(e){failed=String(e).includes('injected cloud draw failure');}finally{cloud.onBeforeRender=before;}
   if(!failed||renderer.getRenderTarget()!==sentinel||!renderer.autoClear||objects.some(([o,mask])=>o.layers.mask!==mask)||scene.children.some(o=>o.userData.cloudPathComposite))throw Error('Nested pass leaked state after failure');
   draw(true,actual);
   const glError=renderer.getContext().getError();if(glError!==0)throw Error('WebGL error '+glError);
   return {changedPixels:changed,maxError:max,opaqueForegroundPixels:redPixels,height:cloudPass.diagnostics.height,failureRecovery:true,glError};
  }finally{
   cloudPass.dispose();primary.dispose();for(const t of targets)t.dispose();tex.dispose();for(const m of [cloud,behind,front,water]){m.geometry.dispose();m.material.dispose();}renderer.dispose();
  }
 });
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({result,errors},null,2));console.log('PASS actual GPU cloud/ocean composition, opaque depth and failure recovery',result);
}finally{await browser.close();}
