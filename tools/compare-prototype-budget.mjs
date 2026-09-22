import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const options={original:process.env.BOARD_URL||'http://127.0.0.1:5191/',fork:process.env.FORK_URL||'http://127.0.0.1:5192/',output:process.env.BUDGET_OUTPUT||'budget.json',warmupMs:Number(process.env.BUDGET_WARMUP_MS||15000),versions:'original,fork',levels:'',baseHeight:0,outputMultiplier:1};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i].replace(/^--/,'');if(!(key in options)||!process.argv[i+1])throw new Error('Usage: --original URL --fork URL --output PATH --warmupMs 15000 [--versions fork --levels sky --baseHeight 540 --outputMultiplier 1]');options[key]=['warmupMs','baseHeight','outputMultiplier'].includes(key)?Number(process.argv[i+1]):process.argv[i+1];}
if(options.baseHeight&&![540,720,900,1080].includes(options.baseHeight))throw new Error('Unsupported baseHeight');
if(![1,2,3].includes(options.outputMultiplier))throw new Error('Unsupported outputMultiplier');

// Read-only app diagnostic. Measures live requested WebGL storage from
// allocation/deletion calls, not GPU resident memory or process RAM. Excludes
// browser-owned default framebuffer/MSAA, driver alignment, caches and deferred
// releases, image decodes and JS heaps. Depth24 is 3 logical bytes per pixel;
// drivers commonly pad it. No timings are collected while instrumented.
function installBudgetTracker() {
 const contexts=[];
 const originalGetContext=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(type,...args) {
  const gl=originalGetContext.call(this,type,...args);
  if(gl && /^(webgl2?|experimental-webgl)$/.test(type) && !gl.__budgetInstalled) install(gl);
  return gl;
 };
 function install(gl) {
  gl.__budgetInstalled=true;
  const ids=new WeakMap(),records=new Map(),warnings=new Set();let nextId=1,peak=0;
  const state={unit:0,textures:new Map(),buffers:new Map(),renderbuffer:null,framebuffer:null};
  const framebufferIds=new WeakMap(),framebuffers=new Map();let nextFramebuffer=1;
  function id(object,kind) {if(!object)return null;let n=ids.get(object);if(!n){n=nextId++;ids.set(object,n);records.set(n,{id:n,kind,bytes:0,levels:{}});}return n;}
  const finalize=typeof FinalizationRegistry==='function'?new FinalizationRegistry(n=>records.delete(n)):null;
  function total(){let n=0;for(const r of records.values())n+=r.bytes;return n;}
  function changed(){peak=Math.max(peak,total());}
  function wrap(name,after){const fn=gl[name];if(typeof fn!=='function')return;gl[name]=function(...args){const result=fn.apply(this,args);try{after(args,result);}catch(e){warnings.add(name+': '+String(e));}return result;};}
  for(const [create,remove,kind] of [['createTexture','deleteTexture','texture'],['createBuffer','deleteBuffer','buffer'],['createRenderbuffer','deleteRenderbuffer','renderbuffer']]){
   wrap(create,(_,object)=>{const n=id(object,kind);if(object)finalize?.register(object,n);});
   wrap(remove,([object])=>{const n=ids.get(object);if(n)records.delete(n);});
  }
  wrap('activeTexture',([unit])=>{state.unit=unit-gl.TEXTURE0;});
  wrap('bindTexture',([target,object])=>{state.textures.set(state.unit+':'+target,id(object,'texture'));});
  wrap('bindBuffer',([target,object])=>{state.buffers.set(target,id(object,'buffer'));});
  wrap('bindRenderbuffer',([target,object])=>{state.renderbuffer=id(object,'renderbuffer');});
  wrap('bindFramebuffer',([target,object])=>{if(target===gl.READ_FRAMEBUFFER)return;if(!object){state.framebuffer=null;return;}let n=framebufferIds.get(object);if(!n){n=nextFramebuffer++;framebufferIds.set(object,n);framebuffers.set(n,new Map());}state.framebuffer=n;});
  wrap('deleteFramebuffer',([object])=>{framebuffers.delete(framebufferIds.get(object));});
  wrap('framebufferTexture2D',([target,attachment,textarget,object])=>{const n=id(object,'texture'),r=records.get(n);if(r)r.renderTarget=true;framebuffers.get(state.framebuffer)?.set(attachment,n);});
  wrap('framebufferRenderbuffer',([target,attachment,rbtarget,object])=>{const n=id(object,'renderbuffer');framebuffers.get(state.framebuffer)?.set(attachment,n);});
  function baseTarget(target){return target>=gl.TEXTURE_CUBE_MAP_POSITIVE_X&&target<=gl.TEXTURE_CUBE_MAP_NEGATIVE_Z?gl.TEXTURE_CUBE_MAP:target;}
  function texture(target){return records.get(state.textures.get(state.unit+':'+baseTarget(target)));}
  function pixelBytes(internal,format,type) {
   const sized={33321:1,33323:2,32849:3,32856:4,35905:3,35907:4,33325:2,33327:4,34843:6,34842:8,33326:4,33328:8,34837:12,34836:16,33189:2,33190:3,36012:4,35056:4,36013:8,32854:2,32855:2,36194:2,35898:4,35902:4,36975:4};
   if(sized[internal])return sized[internal];
   const packed={32819:2,32820:2,33635:2,33640:4,35899:4,35902:4,34042:4,36269:8};
   if(packed[type])return packed[type];
   const channels=({6406:1,6409:1,6410:2,6403:1,33319:2,6407:3,6408:4,6402:1,34041:1,36244:1,33320:2,36248:3,36249:4})[format];
   const size=({5120:1,5121:1,5122:2,5123:2,5124:4,5125:4,5126:4,5131:2,36193:2})[type];
   if(channels&&size)return channels*size;
   warnings.add('unmapped format '+[internal,format,type].join('/'));return 4;
  }
  function compressedSize(internal,w,h,d=1){
   let block=16,bw=4,bh=4;
   if([33776,33777,37492,37494,36196,36283,35916,35917].includes(internal))block=8;
   else if((internal>=37808&&internal<=37821)||(internal>=37840&&internal<=37853)){const dims=[[4,4],[5,4],[5,5],[6,5],[6,6],[8,5],[8,6],[8,8],[10,5],[10,6],[10,8],[10,10],[12,10],[12,12]];[bw,bh]=dims[internal-(internal>=37840?37840:37808)];}
   else if(![33778,33779,37488,37490,37496,37497,36285,36492,36493,36494,36495].includes(internal))warnings.add('compressed storage estimated unknown '+internal);
   return Math.ceil(w/bw)*Math.ceil(h/bh)*block*d;
  }
  function setLevel(target,level,internal,width,height,depth,bytes,compressed=false,bpp=null){
   const r=texture(target);if(!r)return;r.levels[target+':'+level]={target,level,internal,width,height,depth,bytes,compressed,bpp};r.bytes=Object.values(r.levels).reduce((s,l)=>s+l.bytes,0);changed();
  }
  wrap('texImage2D',a=>{const [target,level,internal]=a;let w,h,format,type;if(a.length>=9){w=a[3];h=a[4];format=a[6];type=a[7];}else{format=a[3];type=a[4];const image=a[5];w=image?.videoWidth||image?.naturalWidth||image?.width||0;h=image?.videoHeight||image?.naturalHeight||image?.height||0;}const bpp=pixelBytes(internal,format,type);setLevel(target,level,internal,w,h,1,w*h*bpp,false,bpp);});
  wrap('texImage3D',a=>{const [target,level,internal,w,h,d,,format,type]=a,bpp=pixelBytes(internal,format,type);setLevel(target,level,internal,w,h,d,w*h*d*bpp,false,bpp);});
  wrap('compressedTexImage2D',a=>{const [target,level,internal,w,h,,data,offset,length]=a;const bytes=typeof data==='number'?data:(length??Math.max(0,(data?.byteLength??0)-(offset??0)));setLevel(target,level,internal,w,h,1,bytes,true);});
  wrap('compressedTexImage3D',a=>{const [target,level,internal,w,h,d,,data,offset,length]=a;const bytes=typeof data==='number'?data:(length??Math.max(0,(data?.byteLength??0)-(offset??0)));setLevel(target,level,internal,w,h,d,bytes,true);});
  for(const dimension of [2,3])wrap('texStorage'+dimension+'D',a=>{const [target,levels,internal,w,h,d=1]=a;const compressed=internal>=33776&&!([34842,34843,34836,34837,35905,35907,35056,36012,36013,35898,35902,36975].includes(internal));const bpp=compressed?null:pixelBytes(internal,internal,gl.UNSIGNED_BYTE);for(let level=0;level<levels;level++){const lw=Math.max(1,w>>level),lh=Math.max(1,h>>level),ld=dimension===3&&target===gl.TEXTURE_3D?Math.max(1,d>>level):d;for(const face of target===gl.TEXTURE_CUBE_MAP?[34069,34070,34071,34072,34073,34074]:[target])setLevel(face,level,internal,lw,lh,ld,compressed?compressedSize(internal,lw,lh,ld):lw*lh*ld*bpp,compressed,bpp);}});
  wrap('generateMipmap',([target])=>{const r=texture(target);if(!r)return;for(const base of Object.values(r.levels).filter(l=>l.level===0)){let {width:w,height:h,depth:d}=base,level=0;while(w>1||h>1||(target===gl.TEXTURE_3D&&d>1)){level++;w=Math.max(1,w>>1);h=Math.max(1,h>>1);if(target===gl.TEXTURE_3D)d=Math.max(1,d>>1);setLevel(base.target,level,base.internal,w,h,d,base.compressed?compressedSize(base.internal,w,h,d):w*h*d*base.bpp,base.compressed,base.bpp);}}});
  wrap('bufferData',a=>{const [target,data,,offset=0,length]=a,r=records.get(state.buffers.get(target));if(!r)return;r.bytes=typeof data==='number'?data:data?(length??Math.max(0,(data.length??data.byteLength)-offset))*(data.BYTES_PER_ELEMENT??1):0;changed();});
  function renderbuffer(a,multi){const [target,...rest]=a,[samples,format,w,h]=multi?rest:[1,...rest];const r=records.get(state.renderbuffer);if(!r)return;r.samples=samples;r.width=w;r.height=h;r.format=format;r.bytes=Math.max(1,samples)*w*h*pixelBytes(format,format,gl.UNSIGNED_BYTE);changed();}
  wrap('renderbufferStorage',a=>renderbuffer(a,false));wrap('renderbufferStorageMultisample',a=>renderbuffer(a,true));
  contexts.push({gl,ids,records,framebuffers,warnings,get peak(){return peak;}});
  }
 window.__gpuBudgetSnapshot=()=>contexts.map(c=>{
  const game=window.__game,renderer=game?.renderer;
  const markTexture=(texture,owner)=>{if(!texture?.isTexture)return;const object=renderer.properties.get(texture).__webglTexture,r=c.records.get(c.ids.get(object));if(r){r.owners??=[];const name=texture.name||texture.source?.data?.src||owner;if(!r.owners.includes(name))r.owners.push(name);}};
  if(renderer?.getContext()===c.gl)game.scene.traverse(o=>{
   if(o.shadow?.map){markTexture(o.shadow.map.texture,'Sun shadow color');markTexture(o.shadow.map.depthTexture,'Sun shadow depth');}
   for(const m of !o.material?[]:Array.isArray(o.material)?o.material:[o.material]){for(const [key,value] of Object.entries(m))if(value?.isTexture)markTexture(value,(o.name||o.type)+' material '+key);for(const [key,value] of Object.entries(m.uniforms??{}))if(value?.value?.isTexture)markTexture(value.value,(o.name||o.type)+' uniform '+key);}
  });
  for(const attachments of c.framebuffers.values()){
   const rows=[...attachments.values()].map(n=>c.records.get(n)).filter(Boolean),owners=[...new Set(rows.filter(r=>r.kind==='texture').flatMap(r=>r.owners??[]))];
   for(const r of rows)if(r.kind==='renderbuffer')r.owners=owners.length?owners.map(o=>o+' depth/MSAA attachment'):['Offscreen framebuffer depth/MSAA attachment'];
  }
  const rows=[...c.records.values()],sums={texture:0,renderbuffer:0,buffer:0};for(const r of rows){sums[r.kind]+=r.bytes;if(!r.owners?.length)r.owners=[r.kind==='texture'?(r.renderTarget?'Offscreen render target (composer/SMAA/UI; exact owner not exposed)':'Unresolved sampled texture'):r.kind==='buffer'?'Vertex/index/instance buffer':'Unresolved renderbuffer'];}
  return {logicalBytes:Object.values(sums).reduce((a,b)=>a+b,0),logicalPeakBytes:c.peak,bytes:sums,counts:Object.fromEntries(Object.keys(sums).map(k=>[k,rows.filter(r=>r.kind===k).length])),largest:rows.sort((a,b)=>b.bytes-a.bytes).slice(0,18),warnings:[...c.warnings],contextLost:c.gl.isContextLost(),backbuffer:{width:c.gl.drawingBufferWidth,height:c.gl.drawingBufferHeight,attributes:c.gl.getContextAttributes(),samples:c.gl.getParameter(c.gl.FRAMEBUFFER_BINDING)===null?c.gl.getParameter(c.gl.SAMPLES):null,excluded:true}};
 });
}

const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try {
 for(const version of options.versions.split(',')) {
  if(!['original','fork'].includes(version))throw new Error('Unsupported version '+version);
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript(installBudgetTracker);
  await context.addInitScript(()=>{localStorage.setItem('protoLevelId','sky');localStorage.setItem('protoLevelsAdopted','1');});
  if(version==='fork'&&options.baseHeight)await context.addInitScript(({baseHeight,outputMultiplier})=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:1,enabled:true,baseHeight,outputMultiplier,fixed60:true})),options);
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const address=new URL(options[version]);address.searchParams.set('playtest','');address.searchParams.set('level','sky');
  await page.goto(address.href);
  await page.waitForFunction(()=>window.__game?.renderer,{timeout:120000});
  for(const level of options.levels?options.levels.split(','):version==='original'?['sky']:['sky','jungle-cup','treehouse-trail','sky']) {
   if(await page.evaluate(()=>window.__game.getCurrentLevel().id)!==level)await page.evaluate(level=>window.__game.switchLevel(level),level);
   await page.waitForTimeout(options.warmupMs);
   const row=await page.evaluate(()=>{
    const g=window.__game,geometrySeen=new Set(),backingArrays=new Set(),meshes=[],materials=new Set(),textures=new Set();let geometryBytes=0;
    g.scene.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry,position=geo.attributes.position,triangles=(geo.index?.count??position?.count??0)/3*(o.isInstancedMesh?o.count:1);let effectiveVisible=true;for(let n=o;n;n=n.parent)if(!n.visible)effectiveVisible=false;
     let name=o.name||'(unnamed)',parent=o.parent;for(let i=0;i<3&&parent;i++,parent=parent.parent)name+=' / '+(parent.name||parent.type);
     meshes.push({name,type:o.type,triangles,vertices:position?.count??0,instances:o.isInstancedMesh?o.count:1,visible:effectiveVisible,castShadow:o.castShadow});
     if(!geometrySeen.has(geo)){geometrySeen.add(geo);for(const a of [...Object.values(geo.attributes),geo.index].filter(Boolean)){const array=a.array??a.data?.array;if(array&&!backingArrays.has(array)){backingArrays.add(array);geometryBytes+=array.byteLength;}}}
     for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const x of Object.values(m))if(x?.isTexture)textures.add(x);}
    });
    const sum=items=>items.reduce((s,m)=>s+m.triangles,0),gl=g.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
    const competition=g.getCompetition?.();
    return {url:location.href,level:g.getCurrentLevel().id,state:{player:g.player.state,position:g.player.pos.toArray(),competition:competition?{phase:competition.phase,simulating:competition.simulating}:null},budget:window.__gpuBudgetSnapshot(),scene:{meshCount:meshes.length,triangles:sum(meshes),visibleTriangles:sum(meshes.filter(m=>m.visible)),visibilityDefinition:'Object and all ancestors visible; no camera-frustum/occlusion test',uniqueGeometries:geometrySeen.size,geometryBytes,materials:materials.size,textures:textures.size,top:meshes.sort((a,b)=>b.triangles-a.triangles).slice(0,20)},renderer:{...g.renderer.info.memory,programs:g.renderer.info.programs.length},gpu:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):null,jungle:g.getLevel?.().jungleAssetDiagnostics,crt:g.getCrtDiagnostics?.(),head:g.getAlternateHeadDiagnostics?.(),quality:g.renderQualitySettings?.snapshot(),look:g.getLookDiagnostics?.(),flow:g.getGameFlowSurfaceDiagnostics?.(),vortex:g.getGameFlowVortexDiagnostics?.(),recovery:g.getGraphicsRecoveryDiagnostics?.()};
   });
   results.push({version,...row,errors:[...errors]});
   console.log(JSON.stringify({version,level:row.level,bytes:row.budget.map(b=>b.bytes),logicalMiB:row.budget.map(b=>b.logicalBytes/1048576),peakMiB:row.budget.map(b=>b.logicalPeakBytes/1048576),triangles:row.scene.triangles,visibleTriangles:row.scene.visibleTriangles,jungle:row.jungle,warnings:row.budget.flatMap(b=>b.warnings),errors}));
   await writeFile(options.output,JSON.stringify(results,null,2));
  }
  await context.close();
 }
} finally {await browser.close();}
