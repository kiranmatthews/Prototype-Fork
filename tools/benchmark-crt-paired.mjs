// Alternate reference/candidate batches to reduce GPU clock/thermal bias.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const candidate=process.argv[2]||'http://127.0.0.1:5186',baseline=process.argv[3]||'http://127.0.0.1:5187';
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={candidate,baseline,method:'Alternating AB/BA; seven paired batches, each 48 frames after 24 warmup frames.',cases:[]};
const pages=[],errors=[];
try {
 for(const base of [baseline,candidate]){
  const page=await browser.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/__paired',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Paired CRT timing</title>'}));await page.goto(`${base}/__paired`);
  await page.evaluate(async()=>{
   const module=await(await fetch('/src/crt-guest/pass.ts')).text();const THREE=await import(module.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1]);
   const {CrtGuestPass}=await import('/src/crt-guest/pass.ts'),{CrtGuestOutputPass}=await import('/src/crt-guest/output.ts');
   const {CrtGuestSettings}=await import('/src/crt-guest/settings.ts'),{loadCrtGuestLuts}=await import('/src/crt-guest/luts.ts');
   const renderer=new THREE.WebGLRenderer({antialias:false});renderer.toneMapping=THREE.ACESFilmicToneMapping;
   const settings=new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});
   const crt=new CrtGuestPass(renderer,settings,{luts:await loadCrtGuestLuts('/crt-guest/lut/'),respectDisableQuery:false,deferOutput:true,deferDeconvergence:true});
   const final=new CrtGuestOutputPass(()=>crt.deferredOutput,()=>crt.deferredDeconvergence);final.renderToScreen=true;
   const input=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false}),spare=input.clone();
   const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 p;void main(){gl_FragColor=vec4(p.x*p.x,p.y*p.y,mod(floor(gl_FragCoord.x/3.)+floor(gl_FragCoord.y/3.),2.),1.);}'});
   const scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
   const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!ext)throw new Error('GPU timer unavailable');
   const render=()=>{crt.render(renderer,spare,input,1/60,false);final.render(renderer,spare,input,1/60,false);};
   window.__paired={
    setup(spec){settings.applyStartupPreset();settings.setVariant(spec.variant||'hd');if(spec.defaults)settings.resetCurrentDefaults();settings.setEnabled(true);for(const [id,v]of Object.entries(spec.patch||{}))settings.setValue(id,v);renderer.setRenderTarget(null);renderer.setSize(spec.ow||1920,spec.oh||1080);input.setSize(spec.w||1920,spec.h||1080);spare.setSize(spec.ow||1920,spec.oh||1080);crt.setResolution(input.width,input.height,spare.width,spare.height);renderer.setRenderTarget(input);renderer.render(scene,camera);for(let i=0;i<24;i++)render();gl.finish();},
    async measure(){for(let i=0;i<24;i++)render();gl.finish();const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();for(let i=0;i<48;i++)render();gl.endQuery(ext.TIME_ELAPSED_EXT);gl.finish();const wallMs=(performance.now()-start)/48;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))await new Promise(r=>setTimeout(r,5));const ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6/48,disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);gl.deleteQuery(q);return {ms,wallMs,disjoint,draws:crt.diagnostics.lastDrawCount+1,bytes:crt.diagnostics.estimatedTargetBytes};}
   };
  });
 }
 const specs=[{name:'startup-native-1080'},{name:'startup-upscaled-1080',w:640,h:360},
  {name:'hd-effects-native',defaults:true,patch:{glow:.4,bloom:.5,halation:.5,vigstr:.3}},
  {name:'hd-effects-upscaled',w:640,h:360,defaults:true,patch:{glow:.4,bloom:.5,halation:.5}},
  {name:'hd-defaults-540',w:320,h:180,ow:960,oh:540,defaults:true},
  {name:'advanced-colour',w:127,h:73,ow:387,oh:213,variant:'advanced',defaults:true,patch:{CP:3,CS:2,TNTC:4,WP:35,wp_saturation:1.3,contr:.2,pre_gc:.8}},
  {name:'threshold-only-native',patch:{AS:0,BP:25,bth:125}}];
 for(const spec of specs){
  for(const page of pages)await page.evaluate(spec=>window.__paired.setup(spec),spec);
  const samples=[[],[]];
  for(let round=0;round<7;round++)for(const index of round%2?[1,0]:[0,1]){const value=await pages[index].evaluate(()=>window.__paired.measure());assert.equal(value.disjoint,false);samples[index].push(value);}
  const med=v=>v.toSorted((a,b)=>a-b)[Math.floor(v.length/2)];
  const before=med(samples[0].map(v=>v.ms)),after=med(samples[1].map(v=>v.ms));
  const row={spec,beforeMs:before,afterMs:after,savedPercent:100*(1-after/before),samples};report.cases.push(row);console.log(spec.name,JSON.stringify({before,after,savedPercent:row.savedPercent}));
 }
 assert.deepEqual(errors,[]);
}finally{report.errors=errors;await writeFile(process.env.CRT_PAIRED_REPORT||'/private/tmp/crt-paired.json',JSON.stringify(report,null,2));await browser.close();}
