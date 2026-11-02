import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {parseNativeGlb} from './release-native-geometry.mjs';
import {separateKtxFormatPreferences} from './ktx-format-preferences.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('..',import.meta.url)),base=(process.argv[2]||'http://127.0.0.1:5198/').replace(/\/?$/,'/'),out=process.argv[3]||'/private/tmp/top40-glb-textures/browser';
const selection=JSON.parse(await readFile('tools/top40-glb-textures.json'));
await mkdir(out,{recursive:true});
const code=`
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {sceneryTextureLoader} from './src/sceneryTextureLoader.ts';
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(1280,960);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#cbd2dc');scene.add(new THREE.HemisphereLight('#f0f5ff','#6b6a78',2));const light=new THREE.DirectionalLight('#fff2da',3);light.position.set(4,6,5);scene.add(light);const fill=new THREE.DirectionalLight('#b9d2ff',1.1);fill.position.set(-4,2,-3);scene.add(fill);
let model,camera,center,direction,distance;
window.review=async({url,compressed})=>{
 if(model){scene.remove(model);const textures=new Set(),materials=new Set(),geometry=new Set(),skeletons=new Set();model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material??[]))materials.add(m);});for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}for(const t of textures){t.source.data?.close?.();t.dispose();}for(const g of geometry)g.dispose();for(const s of skeletons)s.dispose();renderer.renderLists.dispose();}
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);if(compressed)loader.setKTX2Loader(sceneryTextureLoader(renderer));
 const gltf=await loader.loadAsync(url);model=gltf.scene;scene.add(model);model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),extent=size.length();center=box.getCenter(new THREE.Vector3());direction=new THREE.Vector3(.65,.4,1).normalize();camera=new THREE.PerspectiveCamera(37,4/3,extent/1000,extent*10);
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));distance=0;
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=new THREE.Vector3(x*size.x*.5,y*size.y*.5,z*size.z*.5);distance=Math.max(distance,Math.abs(v.dot(up))/tan+v.dot(direction),Math.abs(v.dot(right))/(tan*camera.aspect)+v.dot(direction));}
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count,materials:[].concat(o.material).map(m=>({type:m.type,maps:Object.entries(m).filter(([,t])=>t?.isTexture).map(([slot,t])=>({slot,width:t.image?.width,height:t.image?.height,mips:t.mipmaps.length,format:t.format,colorSpace:t.colorSpace,channel:t.channel,wrapS:t.wrapS,wrapT:t.wrapT,flipY:t.flipY}))}))});});
 return {size:size.toArray(),animations:gltf.animations.length,meshes};
};
window.renderReview=close=>{camera.position.copy(center).addScaledVector(direction,distance*(close?.42:1.12));camera.lookAt(center);renderer.render(scene,camera);return{triangles:renderer.info.render.triangles,glError:renderer.getContext().getError(),buffer:[renderer.domElement.width,renderer.domElement.height]};};window.ready=true;
`;
const bundle=await build({stdin:{contents:code,resolveDir:root,sourcefile:'top40-review.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':JSON.stringify(new URL(base).pathname)},plugins:[{name:'ktx-fix',setup(b){b.onLoad({filter:/KTX2Loader\.js$/},async args=>({contents:separateKtxFormatPreferences(await readFile(args.path,'utf8')),loader:'js'}));}}]});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,models:[],errors};
try{
 const page=await browser.newPage({viewport:{width:1280,height:960},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>{if(r.failure()?.errorText!=='net::ERR_ABORTED')errors.push(r.url()+': '+r.failure()?.errorText);});
 await page.route('**/__top40-review.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style><script type="module" src="./__top40-review.js"></script>'}));
 await page.route('**/__top40-review.js',r=>r.fulfill({contentType:'text/javascript',body:Buffer.from(bundle.outputFiles[0].contents)}));
 let source;await page.route('**/__top40-source.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:source}));
 await page.goto(new URL('__top40-review.html',base).href);await page.waitForFunction(()=>window.ready);
 for(const model of selection.models){
  source=await readFile(path.join(root,'public',model.file));const doc=parseNativeGlb(source).doc,compressed=doc.textures.some(t=>t.extensions?.KHR_texture_basisu),fallback=!doc.extensionsRequired?.includes('KHR_texture_basisu');
  const result={file:model.file,modes:[]};
  for(const gpu of compressed?(fallback?[true,false]:[true]):[false]){
   const before=await page.evaluate(o=>window.review(o),{url:new URL('__top40-source.glb',base).href,compressed:gpu});
   const beforeRender=await page.evaluate(()=>window.renderReview(false));
   const after=await page.evaluate(o=>window.review(o),{url:new URL(model.file,base).href,compressed:gpu});
   const expected=structuredClone(before);
   for(let i=0;i<after.meshes.length;i++)for(let j=0;j<after.meshes[i].materials.length;j++)for(let k=0;k<after.meshes[i].materials[j].maps.length;k++){
    const actual=after.meshes[i].materials[j].maps[k],prior=expected.meshes[i].materials[j].maps[k],limit=['map','emissiveMap'].includes(actual.slot)?1024:256;
    assert.ok(actual.width<=limit&&actual.height<=limit,model.file+' '+actual.slot+' exceeds cap');
    prior.width=actual.width;prior.height=actual.height;prior.mips=actual.mips;
    if(!['map','emissiveMap'].includes(actual.slot)){
     // KHR_texture_basisu requires unspecified primaries for linear data.
     // Older atlases tagged their linear normals/data with BT709 primaries.
     assert.equal(actual.colorSpace,'');assert.ok(['','srgb-linear'].includes(prior.colorSpace));prior.colorSpace='';
    }
   }
   assert.deepEqual(after,expected,model.file+' preserves native geometry/material mappings');
   const rendered=await page.evaluate(()=>window.renderReview(false));assert.equal(rendered.glError,0);assert.ok(rendered.triangles>0);assert.equal(rendered.triangles,beforeRender.triangles);assert.deepEqual(rendered.buffer,[1280,960]);
   const name=model.file.replaceAll('/','_').replace('.glb','')+(gpu?'-gpu':'-portable');
   await page.locator('canvas').screenshot({path:path.join(out,name+'.png')});
   if(model.rank<=12){await page.evaluate(()=>window.renderReview(true));await page.locator('canvas').screenshot({path:path.join(out,name+'-detail.png')});}
   result.modes.push({gpu,...rendered,maps:after.meshes.flatMap(m=>m.materials.flatMap(m=>m.maps))});
  }
  report.models.push(result);await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({done:report.models.length,total:selection.models.length,file:model.file,errors:errors.length}));
 }
 assert.deepEqual(errors,[]);report.passed=true;
}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
