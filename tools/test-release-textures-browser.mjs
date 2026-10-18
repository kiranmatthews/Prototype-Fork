import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {parseTextureGlb,repackTextureGlb,trimKtxMipChain,textureDigest} from './release-textures.mjs';
import {separateKtxFormatPreferences} from './ktx-format-preferences.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const base=process.argv.find(a=>/^https?:/.test(a))??'http://127.0.0.1:5198/',review=path.resolve(arg('review')??path.join(root,'release-textures')),out=path.resolve(arg('out')??'/private/tmp/release-texture-browser');
const manifest=JSON.parse(await readFile(path.join(review,'manifest.json'))),models=manifest.models.filter(m=>!arg('only')||arg('only').split(',').some(part=>m.file.includes(part)));
const captures=['metal-wedge','grind-rail','rivet-deck-v2','factory-wall-v2','brick-road-v2','crash-coastal-headland','crash-exterior-ship','crash-boardwalk-section','crash-cavern-rock','plank-chipped','naval-cannon','column-shaft','hopper.glb','rocksteps-b','bathhouse-arch-v3','timber-tunnel-rib'];
await mkdir(out,{recursive:true});
const code=`
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {sceneryTextureLoader} from './src/sceneryTextureLoader.ts';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1280,960);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#cbd2dc');scene.add(new THREE.HemisphereLight('#f0f5ff','#6b6a78',2));const key=new THREE.DirectionalLight('#fff2da',3);key.position.set(4,6,5);scene.add(key);const fill=new THREE.DirectionalLight('#b9d2ff',1.1);fill.position.set(-4,2,-3);scene.add(fill);
let model,camera,center,direction,distance,previous;
window.loadModel=async({url,compressed})=>{
 if(model){scene.remove(model);const textures=new Set(),materials=new Set(),geometry=new Set(),skeletons=new Set();model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material??[]))materials.add(m);});for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}for(const t of textures){t.source.data?.close?.();t.dispose();}for(const g of geometry)g.dispose();for(const s of skeletons)s.dispose();renderer.renderLists.dispose();}
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);if(compressed)loader.setKTX2Loader(sceneryTextureLoader(renderer));
 const gltf=await loader.loadAsync(url);model=gltf.scene;model.traverse(o=>{if(/LOD1$|shadow/i.test(o.name))o.visible=false;});scene.add(model);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),extent=size.length();center=box.getCenter(new THREE.Vector3());direction=new THREE.Vector3(.65,.4,1).normalize();camera=new THREE.PerspectiveCamera(37,4/3,extent/1000,extent*10);
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));distance=0;
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=new THREE.Vector3(x*size.x*.5,y*size.y*.5,z*size.z*.5);distance=Math.max(distance,Math.abs(v.dot(up))/tan+v.dot(direction),Math.abs(v.dot(right))/(tan*camera.aspect)+v.dot(direction));}
 const meshes=[];model.traverse(o=>{if(!o.isMesh)return;const materials=[].concat(o.material).map(m=>({type:m.type,maps:Object.entries(m).filter(([k,t])=>t?.isTexture).map(([slot,t])=>({slot,width:t.image?.width,height:t.image?.height,mips:t.mipmaps.length,format:t.format,colorSpace:t.colorSpace,channel:t.channel,wrapS:t.wrapS,wrapT:t.wrapT,flipY:t.flipY}))}));meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count,materials});});
 return{size:size.toArray(),animations:gltf.animations.length,meshes};
};
window.captureModel=({close,compare})=>{
 camera.position.copy(center).addScaledVector(direction,distance*(close?.42:1.12));camera.lookAt(center);renderer.render(scene,camera);
 const gl=renderer.getContext(),pixels=new Uint8Array(1280*960*4);gl.readPixels(0,0,1280,960,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
 let difference=null;if(compare){let sum=0,square=0,max=0;const histogram=new Uint32Array(256);for(let i=0;i<pixels.length;i++)if(i%4!==3){const d=Math.abs(pixels[i]-previous[i]);sum+=d;square+=d*d;max=Math.max(max,d);histogram[d]++;}const count=pixels.length/4*3;let cum=0,p99=0;for(let i=0;i<256;i++){cum+=histogram[i];if(cum>=count*.99){p99=i;break;}}difference={meanAbs:sum/count,max,p99,psnr:square?10*Math.log10(255*255/(square/count)):null};}else previous=pixels;
 return{difference,render:{...renderer.info.render},memory:{...renderer.info.memory}};
};window.ready=true;
`;
const bundle=await build({stdin:{contents:code,resolveDir:root,sourcefile:'texture-review.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':"'/'"},plugins:[{name:'ktx-fix',setup(b){b.onLoad({filter:/KTX2Loader\.js$/},async args=>({contents:separateKtxFormatPreferences(await readFile(args.path,'utf8')),loader:'js'}));}}]});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={models:[],built:process.argv.includes('--built'),errors};
try{
 const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('crash',()=>errors.push('Page crashed'));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 await page.route('**/__texture-review.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style><script type="module" src="/__texture-review.js"></script>'}));
 await page.route('**/__texture-review.js',r=>r.fulfill({contentType:'text/javascript',body:Buffer.from(bundle.outputFiles[0].contents)}));
 let source,packed;
 await page.route('**/__texture-source.glb*',r=>r.fulfill({contentType:'model/gltf-binary',body:source}));
 await page.route('**/__texture-packed.glb*',r=>r.fulfill({contentType:'model/gltf-binary',body:packed}));
 await page.goto(new URL('__texture-review.html',base).href,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.ready,null,{timeout:60000});
 for(const model of models){
  source=await readFile(path.join(root,'public',model.file));const parsed=parseTextureGlb(source),replacements=new Map();
  for(const row of model.images)replacements.set(row.index,await readFile(path.join(review,'encoded',row.sha256+'.webp')));
  for(const mip of model.mips??[])replacements.set(mip.index,trimKtxMipChain(parsed.view(parsed.doc.images[mip.index].bufferView),mip.maxSize).data);
  packed=repackTextureGlb(source,replacements);
  if(report.built){const response=await page.request.get(new URL(model.file,base).href);assert.equal(response.status(),200);assert.equal(textureDigest(await response.body()),textureDigest(packed),'Built model must be the reviewed release: '+model.file);await response.dispose();}
  const compressed=parsed.doc.textures.some(t=>t.extensions?.KHR_texture_basisu),capture=captures.some(name=>model.file.includes(name));
  const resized=!!model.mips?.length||model.images.some(i=>manifest.textures.find(t=>t.sha256===i.sha256)?.resampling);
  const item={file:model.file,resized,sourceBytes:source.length,bytes:packed.length,modes:[]};
  const fallback=parsed.doc.textures.every(t=>t.source!==undefined||!t.extensions?.KHR_texture_basisu);
  for(const mode of compressed?(fallback?[true,false]:[true]):[false]){
   const modeReport={decoder:mode?'ktx':'webp',views:[]};
   for(const close of capture?[false,true]:[false]){
    const label=close?'detail':'overview',prefix=model.file.replaceAll('/','_').replace('.glb','')+'-'+modeReport.decoder+'-'+label;
    const before=await page.evaluate(opts=>window.loadModel(opts),{url:'/__texture-source.glb',compressed:mode});
    const native=await page.evaluate(opts=>window.captureModel(opts),{close,compare:false});
    if(capture)await page.locator('canvas').screenshot({path:path.join(out,prefix+'-original.png')});
    const after=await page.evaluate(opts=>window.loadModel(opts),{url:'/__texture-packed.glb',compressed:mode});
    if(resized){
     const expected=structuredClone(before);for(let i=0;i<after.meshes.length;i++)for(let j=0;j<after.meshes[i].materials.length;j++)for(let k=0;k<after.meshes[i].materials[j].maps.length;k++){
      const actual=after.meshes[i].materials[j].maps[k],old=expected.meshes[i].materials[j].maps[k];
      assert.ok(actual.width<=old.width&&actual.height<=old.height&&actual.mips<=old.mips,model.file+' downsized map');
      old.width=actual.width;old.height=actual.height;old.mips=actual.mips;
     }
     assert.deepEqual(after,expected,model.file+' unchanged geometry/material mappings');
    }else assert.deepEqual(after,before,model.file+' runtime geometry/material mappings');
    const released=await page.evaluate(opts=>window.captureModel(opts),{close,compare:true});
    delete released.render.frame;delete native.render.frame;assert.deepEqual(released.render,native.render,model.file+' render counts');
    assert.equal(released.memory.geometries,native.memory.geometries);assert.equal(released.memory.textures,native.memory.textures);
    assert.ok(resized||released.difference.psnr===null||released.difference.psnr>=36,model.file+' rendered difference too large');
    if(capture)await page.locator('canvas').screenshot({path:path.join(out,prefix+'-release.png')});
    modeReport.views.push({view:label,...released});
   }
   item.modes.push(modeReport);
  }
  report.models.push(item);await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({done:report.models.length,total:models.length,file:model.file,modes:item.modes.map(m=>m.decoder),errors:errors.length}));
 }
 assert.deepEqual(errors,[]);report.pass=true;
}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
