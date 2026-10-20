import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5186';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/__metadata',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>CRT metadata regression</title>'}));await page.goto(`${base}/__metadata`);
 const report=await page.evaluate(async()=>{
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const source=await(await fetch('/src/crt-guest/pass.ts')).text();const THREE=await import(source.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1]);
  const {CrtGuestPass}=await import('/src/crt-guest/pass.ts'),{CrtGuestSettings}=await import('/src/crt-guest/settings.ts');
  const {loadCrtGuestLuts,disposeCrtGuestLuts}=await import('/src/crt-guest/luts.ts');
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(128,401);
  const settings=new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});settings.setEnabled(true);
  const luts=await loadCrtGuestLuts('/crt-guest/lut/'),crt=new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false});
  const input=new THREE.WebGLRenderTarget(128,401,{type:THREE.HalfFloatType,depthBuffer:false}),output=input.clone();
  const render=()=>{renderer.setRenderTarget(input);glClean('input target');renderer.clear();glClean('input clear');crt.render(renderer,output,input,1/60,false);glClean('CRT draw');};
  const pixels=new Uint16Array(4),samples=[];
  const glClean=label=>{const error=renderer.getContext().getError();assert(error===0,`${label}: GL error ${error}`);};
  const check=()=>{
   render();const material=crt.materialSets[settings.variant].main;
   renderer.readRenderTargetPixels(crt.targets.linear,Math.floor(input.width*.25),Math.floor(input.height*.25),1,1,pixels);
   const expected=THREE.DataUtils.fromHalfFloat(pixels[3]),actual=material.uniforms.uCrtInverseGamma?.value;
   assert(actual===expected,`${settings.variant}/${settings.getValue('GAMMA_INPUT')}: metadata ${actual} != target ${expected}`);
   glClean(`metadata/${settings.variant}/${settings.getValue('GAMMA_INPUT')}`);
   return {variant:settings.variant,gamma:settings.getValue('GAMMA_INPUT'),inverse:actual};
  };
  for(const variant of ['hd','advanced']){settings.setVariant(variant);for(let i=0;i<=80;i++){settings.setValue('GAMMA_INPUT',1+i*.05);samples.push(check());}}
  const rounding=crt.halfFloatRounding;
  assert(rounding==='truncate'||rounding==='nearest','Expected a calibrated conversion on this device');
  for(const width of [1,2,3]){input.setSize(width,9);output.setSize(width,9);render();glClean(`tiny/${width}`);assert(crt.materialSets.advanced.main.fragmentShader.includes('crtGuestSampleLinearBorder(LinearizePass, vec2(0.25), 0.0).w'),'Tiny source must retain its interpolated metadata reads');}
  input.setSize(128,401);output.setSize(128,401);settings.setValue('GAMMA_INPUT',3.7);check();
  const canvas=renderer.domElement,extension=renderer.getContext().getExtension('WEBGL_lose_context');
  assert(extension,'Context lifecycle test requires WEBGL_lose_context');
  const lost=new Promise(resolve=>canvas.addEventListener('webglcontextlost',resolve,{once:true}));extension.loseContext();await lost;
  await new Promise(r=>setTimeout(r,100));
  const restored=new Promise(resolve=>canvas.addEventListener('webglcontextrestored',resolve,{once:true}));extension.restoreContext();await restored;
  glClean('restoration');
  assert(crt.halfFloatRounding===null,'Restored context must discard the old calibration');
  check();assert(crt.halfFloatRounding===rounding,'Restored context must calibrate again');
  const glError=renderer.getContext().getError();assert(glError===0,`GL error ${glError}`);
  crt.dispose();input.dispose();output.dispose();disposeCrtGuestLuts(luts);
  const texturesAfterDispose=renderer.info.memory.textures;renderer.dispose();
  return {samples,rounding,tinyWidths:[1,2,3],restored:true,glError,texturesAfterDispose};
 });
 assert.deepEqual(errors,[]);assert.equal(report.texturesAfterDispose,0);
 await writeFile(process.env.CRT_METADATA_REPORT||'/private/tmp/crt-metadata.json',JSON.stringify({...report,errors},null,2));
 console.log('PASS 162 GPU metadata comparisons, tiny-source fallback, real context restoration/recalibration and complete texture disposal.');
}finally{await browser.close();}
