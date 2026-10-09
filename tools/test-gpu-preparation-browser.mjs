import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5345/';
const expected=process.argv.includes('--expect-prepared');
const particlesExpected=process.argv.includes('--expect-particles');
const lite=process.argv.includes('--lite');
const output=process.env.GPU_PREPARATION_OUTPUT||join(tmpdir(),'gpu-preparation');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],rows=[];
let particles=null,environment=null,failure=null;
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL('?playtest&level=sky'+(lite?'&lite':''),base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 environment=await page.evaluate(()=>{const g=window.__game,gl=g.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');return{agent:navigator.userAgent,gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],quality:g.renderQualitySettings.snapshot()};});
 await page.evaluate(()=>{
  const g=window.__game,gl=g.renderer.getContext(),a=window.gpuPreparation={active:null,events:[],owner:null,phaseTrace:[],proxies:[],screenPreparations:[],uploads:[],uploadArrays:new Map(),captureUploads:false};
  if(g.puffs.createPresentationProxy){
   const prepare=g.puffs.createPresentationProxy.bind(g.puffs);
   g.puffs.createPresentationProxy=(...args)=>{
    const proxy=prepare(...args),bounds=proxy.geometry.boundingSphere,record={style:args[0],boundsPreserved:false,removed:false};a.proxies.push(record);
    const remove=proxy.removeFromParent.bind(proxy);
    proxy.removeFromParent=()=>{record.programs=g.renderer.properties.get(proxy.material).programs?.size??0;record.geometry=proxy.geometry.id;const result=remove();record.boundsPreserved=proxy.geometry.boundingSphere===bounds;record.removed=proxy.parent===null;return result;};
    return proxy;
   };
  }
  const draw=g.renderer.renderBufferDirect.bind(g.renderer);
  g.renderer.renderBufferDirect=(camera,scene,geometry,material,object,group)=>{
   a.owner={name:object.name,material:material.name,type:material.type,wireframe:material.wireframe,particle:object.renderOrder===10&&geometry.getAttribute('color')?.itemSize===4,geometry:geometry.id,blending:material.blending,fog:material.fog};
   if(/^Puff .* preparation$/.test(object.name)&&g.renderer.getRenderTarget()===null)a.screenPreparations.push({scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),enabled:gl.isEnabled(gl.SCISSOR_TEST)});
   try{return draw(camera,scene,geometry,material,object,group);}finally{a.owner=null;}
  };
  for(const key of ['createBuffer','createTexture','compileShader','linkProgram']){
   const call=gl[key].bind(gl);gl[key]=(...args)=>{
    if(a.active&&!g.gameFlow.blocksGameplay&&g.getCurrentLevel().id===a.active&&(g.getLevel().time<1.6||a.captureUploads))
     a.events.push({key,time:g.getLevel().time,owner:a.owner?{...a.owner}:null});
    return call(...args);
   };
  }
  const upload=gl.bufferSubData.bind(gl);
  gl.bufferSubData=(...args)=>{
   const array=args[2],kind=a.uploadArrays.get(array);
   if(a.captureUploads&&kind){const start=args[3]??0,count=args[4]??array.length-start;
    a.uploads.push({kind,bytes:count*array.BYTES_PER_ELEMENT,capacity:array.byteLength,ranged:args.length>=5,frame:g.frameStats.frame});}
   return upload(...args);
  };
  a.phaseState=()=>{const l=g.getLevel();return{time:l.time,pads:l.phasePads.map(p=>({on:p.on,lit:p.mesh.material===p.litMat,member:l.groundMeshes.includes(p.mesh)}))};};
 });
 for(const id of ['dark','nightworks-after-hours']){
  const load=await page.evaluate(async id=>{
   const g=window.__game,a=window.gpuPreparation;a.active=id;a.events=[];a.phaseTrace=[];a.proxies=[];a.screenPreparations=[];let initial;const start=performance.now();
   await g.gameFlow.transition(()=>{
    g.switchLevel(id);g.gameFlow.hide();initial=a.phaseState();
    const l=g.getLevel(),update=l.update.bind(l);l.update=(...args)=>{const result=update(...args);if(l.time<=1.6)a.phaseTrace.push(a.phaseState());return result;};
   });
   return{ms:performance.now()-start,initial,after:a.phaseState()};
  },id);
  await page.waitForFunction(()=>window.__game.getLevel().time>1.6,null,{timeout:30000});
  const row=await page.evaluate(()=>{const g=window.__game,a=window.gpuPreparation;return{id:a.active,events:a.events,phaseTrace:a.phaseTrace,proxies:a.proxies,screenPreparations:a.screenPreparations,stamp:document.querySelector('.hud-build')?.textContent,failedAssets:g.getLoadingDiagnostics().failed};});
  row.load=load;rows.push(row);assert.deepEqual(row.failedAssets,[]);assert.match(row.stamp,/Codex\/sol fork/);
  if(expected)assert.equal(row.events.filter(e=>e.key==='createBuffer'&&e.owner?.wireframe).length,0,'phase wireframe buffers must prepare while covered');
  if(particlesExpected){
   assert.deepEqual(row.proxies.map(p=>p.style).sort(),['add','alpha']);
   assert.ok(row.proxies.every(p=>p.removed&&p.boundsPreserved&&p.programs>0),'temporary particle draws must prepare their programs and retire without changing live bounds');
   assert.equal(row.events.filter(e=>e.key==='compileShader'&&e.owner?.particle).length,0,'particle programs must prepare before gameplay');
   if(lite)assert.ok(row.screenPreparations.length>=4&&row.screenPreparations.every(p=>p.enabled&&p.scissor.every(n=>n===0)),'direct-screen preparation must preserve every loader pixel');
  }
 }
 // A controlled visual-effects workload uses the production dust emitter,
 // without changing player position, physics, tuning or the frame loop.
 particles=await page.evaluate(async()=>{
  const g=window.__game,a=window.gpuPreparation;a.captureUploads=true;a.uploads=[];const firstEvent=a.events.length;
  g.scene.traverse(mesh=>{
   if(!mesh.isMesh||mesh.renderOrder!==10||mesh.geometry.getAttribute('color')?.itemSize!==4)return;
   for(const name of ['position','color'])a.uploadArrays.set(mesh.geometry.getAttribute(name).array,name);
   a.uploadArrays.set(mesh.geometry.getIndex().array,'index');
  });
  if(a.uploadArrays.size===0)throw Error('No production puff batch available for the upload probe');
  let last=-1,frames=0;
  while(frames<90){await new Promise(requestAnimationFrame);if(g.frameStats.frame===last)continue;last=g.frameStats.frame;
   if(frames%10===0)g.player.emitDust(12);frames++;
  }
  a.captureUploads=false;return{frames,uploads:a.uploads,events:a.events.slice(firstEvent)};
 });
 assert.ok(particles.uploads.length>100,'measure live repeated uploads');
 if(expected)assert.ok(particles.uploads.every(u=>u.ranged),'every subsequent puff upload must retain its explicit live range');
 if(particlesExpected)assert.equal(particles.events.filter(e=>e.key==='compileShader'&&e.owner?.particle).length,0,'the first controlled dust must reuse prepared particle programs');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({levels:rows.map(r=>({id:r.id,loadMs:r.load.ms,events:r.events.length,wireframeBuffers:r.events.filter(e=>e.key==='createBuffer'&&e.owner?.wireframe).length})),particleBytes:particles.uploads.reduce((n,u)=>n+u.bytes,0),fullEquivalent:particles.uploads.reduce((n,u)=>n+u.capacity,0),wholeUploads:particles.uploads.filter(u=>!u.ranged).length,errors}));
}catch(error){failure=String(error);throw error;}
finally{await writeFile(join(output,'report.json'),JSON.stringify({base,mode:lite?'lite':'full',environment,rows,particles,errors,failure},null,2));await browser.close();}
