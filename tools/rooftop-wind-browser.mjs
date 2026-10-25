import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/storm-wind/local';
await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export {StormFoliageWind} from './src/stormFoliageWind'; export * as THREE from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/storm-wind-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
await page.route('**/storm-wind-review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Storm wind GPU validation</title>'}));
try{
 await page.goto(base+'/storm-wind-review');
 const gpu=await page.evaluate(async()=>{
  const {THREE,StormFoliageWind}=await import('/storm-wind-fixture.js'),weather=new StormFoliageWind();
  const shader={uniforms:{},vertexShader:''},body=weather.vertex(shader,'transformed+=vec3(.013,.006,-.004)*aJungleFlex;');
  const renderer=new THREE.WebGLRenderer();renderer.setSize(1,1);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  const scene=new THREE.Scene(),camera=new THREE.Camera(),target=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType}),pixel=new Float32Array(4);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([.12,.9,-.08,.12,.9,-.08,.12,.9,-.08],3));
  geometry.setAttribute('aClip',new THREE.Float32BufferAttribute([-1,-1,3,-1,-1,3],2));
  geometry.setAttribute('aJungleFlex',new THREE.Float32BufferAttribute([1,1,1],1));
  const material=new THREE.ShaderMaterial({uniforms:shader.uniforms,depthTest:false,depthWrite:false,
   vertexShader:shader.vertexShader+`attribute vec2 aClip;attribute float aJungleFlex;varying vec3 vWorld;void main(){vec3 transformed=position;${body}vec4 world=modelMatrix*instanceMatrix*vec4(transformed,1.0);vWorld=world.xyz;gl_Position=vec4(aClip,0.0,1.0);}`,
   fragmentShader:'varying vec3 vWorld;void main(){gl_FragColor=vec4(vWorld,1.0);}'});
  const mesh=new THREE.InstancedMesh(geometry,material,1);mesh.frustumCulled=false;scene.add(mesh);mesh.rotation.y=.23;mesh.position.set(-25,20,5);
  const samples=[];const position=new THREE.Vector3(.12,.9,-.08),calmOffset=new THREE.Vector3(.013,.006,-.004);
  for(const yaw of [0,.57,Math.PI/2,2.8])for(const scale of [[18,11,9],[9,17,24]]){
   const instance=new THREE.Matrix4().compose(new THREE.Vector3(3,-2,1),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...scale));
   mesh.setMatrixAt(0,instance);mesh.instanceMatrix.needsUpdate=true;scene.updateMatrixWorld(true);
   const matrix=mesh.matrixWorld.clone().multiply(instance),inverse=matrix.clone().invert(),rest=position.clone().applyMatrix4(matrix);
   const render=()=>{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,1,1,pixel);return new THREE.Vector3(...pixel.slice(0,3));};
   for(const time of [0,1.7,5.3,14.2]){
    weather.set({intensity:1,wind:[5.5,2.8]},time);geometry.attributes.aJungleFlex.array.fill(1);geometry.attributes.aJungleFlex.needsUpdate=true;
    const leaf=render(),delta=leaf.clone().sub(rest),direction=new THREE.Vector3(5.5,0,2.8).normalize();
    const along=delta.dot(direction),across=Math.abs(delta.dot(new THREE.Vector3(-direction.z,0,direction.x))),local=leaf.clone().applyMatrix4(inverse).distanceTo(position);
    geometry.attributes.aJungleFlex.array.fill(0);geometry.attributes.aJungleFlex.needsUpdate=true;const rootError=render().distanceTo(rest);
    samples.push({yaw,scale,time,along,across,local,rootError});
   }
   geometry.attributes.aJungleFlex.array.fill(1);geometry.attributes.aJungleFlex.needsUpdate=true;
   weather.set(undefined,7);const dryError=render().distanceTo(position.clone().add(calmOffset).applyMatrix4(matrix));
   weather.set({intensity:0,wind:[5.5,2.8]},9);const disabledError=render().distanceTo(position.clone().add(calmOffset).applyMatrix4(matrix));
   samples.push({yaw,scale,dryError,disabledError});
  }
  const independent=new StormFoliageWind().diagnostics;
  geometry.dispose();material.dispose();target.dispose();renderer.dispose();return {samples,independent};
 });
 for(const s of gpu.samples){
  if('rootError'in s){assert.ok(s.rootError<.00002,'Root moved: '+JSON.stringify(s));assert.ok(s.local<.067,'Wind escaped existing geometry bounds: '+JSON.stringify(s));assert.ok(s.along>.05&&s.across<s.along*.8,'Rotated foliage did not follow world wind: '+JSON.stringify(s));}
  else{assert.ok(s.dryError<.00002&&s.disabledError<.00002,'Dry breeze changed: '+JSON.stringify(s));}
 }
 assert.deepEqual(gpu.independent,{wind:[0,0],intensity:0,time:0});
 await page.goto(base+'/?playtest&level=rooftop-relay',{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);await g.getLevel().prepareJungleAssets();});
 const state=()=>page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),trees=[];
  l.root.traverseVisible(o=>{if(o.isMesh&&['countryoak','countryumbrellapine'].includes(o.userData.jungleAsset)){
   const make=()=>({uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:''}),shader=make(),depth=make();o.material.onBeforeCompile(shader,g.renderer);o.customDepthMaterial.onBeforeCompile(depth,g.renderer);
   const a=shader.uniforms,b=depth.uniforms,positions=new Uint32Array(o.geometry.attributes.position.array.buffer);let hash=2166136261;for(const v of positions)hash=Math.imul(hash^v,16777619)>>>0;
   trees.push({kind:o.userData.jungleAsset,vertices:o.geometry.attributes.position.count,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3,hash,wind:a.uStormFoliageWind.value.toArray(),time:a.uStormFoliageTime.value,sharedShadow:a.uStormFoliageWind===b.uStormFoliageWind&&a.uStormFoliageTime===b.uStormFoliageTime});
  }});
  return {level:g.getCurrentLevel().id,rain:l.rainDiagnostics,wind:l.jungleAssetDiagnostics?.weatherWind,trees,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};
 });
 await page.waitForTimeout(700);const initial=await state();assert.deepEqual(initial.buffer,[2560,1440]);assert.ok(initial.trees.length>0);
 for(const t of initial.trees){assert.ok(t.sharedShadow);assert.deepEqual(t.wind,[5.5,2.8,.86]);assert.equal(t.time,initial.rain.time);}
 await page.screenshot({path:out+'/wind-before.png'});await page.waitForTimeout(2200);const later=await state();
 assert.ok(later.wind.time>initial.wind.time);assert.deepEqual(later.trees.map(t=>[t.kind,t.vertices,t.triangles,t.hash]),initial.trees.map(t=>[t.kind,t.vertices,t.triangles,t.hash]));
 await page.screenshot({path:out+'/wind-later.png'});
 // Inspect the same native tree geometry at close range, using its live
 // material/clock. This is an isolated review canvas, not a game asset.
 const closeup=await page.evaluate(async()=>{
  const {THREE}=await import('/storm-wind-fixture.js'),g=window.__game;let source;
  g.getLevel().root.traverseVisible(o=>{if(!source&&o.isInstancedMesh&&o.userData.jungleAsset==='countryumbrellapine')source=o;});
  if(!source)throw Error('Missing native tree for close-up review');
  const material=source.material.clone();material.onBeforeCompile=(shader,renderer)=>{
   source.material.onBeforeCompile(shader,renderer);
   // The review tree is at the origin, below the game's fog datum. Disable
   // that copied uniform only on this material; retain the live game fog.
   if(shader.uniforms.uHeightFogProfile)shader.uniforms.uHeightFogProfile={value:new THREE.Vector3()};
  };material.customProgramCacheKey=()=>source.material.customProgramCacheKey()+'|tree-review';
  const matrix=new THREE.Matrix4();source.getMatrixAt(0,matrix);matrix.premultiply(source.matrixWorld);
  const mesh=new THREE.Mesh(source.geometry,material),ignored=new THREE.Vector3();matrix.decompose(ignored,mesh.quaternion,mesh.scale);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#aebdca');scene.add(mesh,new THREE.HemisphereLight('#c7d8e8','#87939b',1.22));
  const sun=new THREE.DirectionalLight('#e3edf2',1.35);sun.position.set(-20,40,25);scene.add(sun);
  scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(mesh),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
  const camera=new THREE.PerspectiveCamera(40,2560/1440,.1,300);camera.position.copy(centre).add(new THREE.Vector3(.25,.08,1).multiplyScalar(Math.max(size.x*1440/2560,size.y)/Math.tan(20*Math.PI/180)*.69));camera.lookAt(centre);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(2560,1440);renderer.toneMapping=g.renderer.toneMapping;renderer.toneMappingExposure=g.renderer.toneMappingExposure;
  Object.assign(renderer.domElement.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',zIndex:'2147483647'});document.body.append(renderer.domElement);
  let frame;const draw=()=>{renderer.render(scene,camera);frame=requestAnimationFrame(draw);};draw();
  window.treeReviewPixels=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(2560*1440*4);gl.readPixels(0,0,2560,1440,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let changed=0;for(let y=32;y<1440;y+=64)for(let x=32;x<2560;x+=64){const i=(y*2560+x)*4;if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>18)changed++;}return changed;};
  window.closeTreeReview=()=>{cancelAnimationFrame(frame);renderer.domElement.remove();renderer.dispose();material.dispose();};
  return {kind:source.userData.jungleAsset,vertices:source.geometry.attributes.position.count,triangles:(source.geometry.index?.count??source.geometry.attributes.position.count)/3,scale:mesh.scale.toArray()};
 });
 for(let i=0;i<3;i++){await page.waitForTimeout(1800);assert.ok(await page.evaluate(()=>window.treeReviewPixels())>80,'Close-up must actually show the native tree');await page.screenshot({path:out+`/tree-closeup-${i}.png`});}
 await page.evaluate(()=>window.closeTreeReview());
 await page.evaluate(()=>window.__game.switchLevel('codex-lab'));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const dry=await state();if(dry.wind)assert.equal(dry.wind.intensity,0);
 await page.evaluate(()=>window.__game.switchLevel('rooftop-relay'));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const revisited=await state();assert.deepEqual(revisited.wind.wind,[5.5,2.8]);assert.equal(revisited.wind.intensity,.86);assert.deepEqual(errors,[]);
 await writeFile(out+'/wind-browser.json',JSON.stringify({base,gpu,initial,later,closeup,dry,revisited,errors},null,2)+'\n');console.log('PASS 32 actual GPU wind/root/bounds samples, eight dry restores, native geometry, shared rain clock/shadows, close-up motion and real level transitions');
}finally{await browser.close();}
