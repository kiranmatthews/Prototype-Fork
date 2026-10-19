import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {parseTextureGlb, repackTextureGlb, trimKtxMipChain, textureDigest as hash} from './release-textures.mjs';
import {separateKtxFormatPreferences} from './ktx-format-preferences.mjs';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const release = path.resolve(option('release') || path.join(root, 'dist'));
const out = path.resolve(option('out') || '/private/tmp/release-shared-texture-browser');
const scope = '/Prototype-Fork/';
const evidence = JSON.parse(await readFile(path.join(release, 'provenance/shared-textures.json')));
const reviewed = JSON.parse(await readFile(path.join(root, 'release-textures/manifest.json')));
const resources = new Map(), cases = [], errors = [], canceledTransfers = [];
const add = (file, body, type) => resources.set(scope + file, {body: Buffer.from(body), type});

// Reconstruct the exact preceding build stage, so the proof remains repeatable
// after this build replaces dist. Never depend on an old checkout or server.
for (const model of evidence.models) {
  let before = await readFile(path.join(root, 'public', model.file));
  const review = reviewed.models.find(m => m.file === model.file);
  if (review) {
    const parsed = parseTextureGlb(before), replacements = new Map();
    for (const image of review.images) replacements.set(image.index, await readFile(path.join(root, 'release-textures/encoded', image.sha256 + '.webp')));
    for (const mip of review.mips || []) replacements.set(mip.index, trimKtxMipChain(parsed.view(parsed.doc.images[mip.index].bufferView), mip.maxSize).data);
    before = repackTextureGlb(before, replacements);
  }
  assert.equal(hash(before), model.sourceSha256, model.file + ' source stage');
  const after = await readFile(path.join(release, model.file));
  assert.equal(hash(after), model.sha256, model.file + ' built hash');
  add('source/' + model.file, before, 'model/gltf-binary');
  add(model.file, after, 'model/gltf-binary');
  const doc = parseTextureGlb(before).doc;
  const ktx = doc.textures?.some(t => t.extensions?.KHR_texture_basisu);
  const fallback = !doc.extensionsRequired?.includes('KHR_texture_basisu');
  for (const compressed of ktx ? (fallback ? [true, false] : [true]) : [false]) cases.push({file: model.file, compressed});
}
for (const asset of evidence.assets) {
  const bytes = await readFile(path.join(release, asset.file));
  assert.equal(hash(bytes), asset.sha256);
  add(asset.file, bytes, asset.mimeType);
}
for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) add('jungle-kit/basis/' + file, await readFile(path.join(release, 'jungle-kit/basis', file)), file.endsWith('.js') ? 'text/javascript' : 'application/wasm');
const code = `
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {sceneryTextureLoader} from './src/sceneryTextureLoader.ts';
const renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(1280,960); renderer.setPixelRatio(1); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.append(renderer.domElement);
const scene=new THREE.Scene(); scene.background=new THREE.Color('#cbd2dc'); scene.add(new THREE.HemisphereLight('#f0f5ff','#6b6a78',2));
const key=new THREE.DirectionalLight('#fff2da',3); key.position.set(4,6,5); scene.add(key);
const fill=new THREE.DirectionalLight('#b9d2ff',1.1); fill.position.set(-4,2,-3); scene.add(fill);
let model, previous;
function dispose() {
 if(!model)return;
 scene.remove(model); const materials=new Set(), textures=new Set(), geometry=new Set(), skeletons=new Set();
 model.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton);if(o.geometry)geometry.add(o.geometry);for(const m of [].concat(o.material??[]))materials.add(m);});
 for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}
 for(const t of textures){t.source.data?.close?.();t.dispose();}for(const g of geometry)g.dispose();for(const s of skeletons)s.dispose();renderer.renderLists.dispose();
}
window.review=async({url,compressed,compare})=>{
 dispose(); const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 if(compressed)loader.setKTX2Loader(sceneryTextureLoader(renderer));
 const gltf=await loader.loadAsync(url); model=gltf.scene;
 model.traverse(o=>{if(/LOD1$|shadow/i.test(o.name))o.visible=false;}); scene.add(model); model.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),extent=size.length();
 const direction=new THREE.Vector3(.65,.4,1).normalize(),camera=new THREE.PerspectiveCamera(37,4/3,extent/1000,extent*10);
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tan=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5));let distance=0;
 for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=new THREE.Vector3(x*size.x*.5,y*size.y*.5,z*size.z*.5);distance=Math.max(distance,Math.abs(v.dot(up))/tan+v.dot(direction),Math.abs(v.dot(right))/(tan*camera.aspect)+v.dot(direction));}
 const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push({name:o.name,vertices:o.geometry.attributes.position.count,indices:o.geometry.index?.count,materials:[].concat(o.material).map(m=>({type:m.type,maps:Object.entries(m).filter(([k,t])=>t?.isTexture).map(([slot,t])=>({slot,width:t.image?.width,height:t.image?.height,mips:t.mipmaps.length,format:t.format,colorSpace:t.colorSpace,channel:t.channel,wrapS:t.wrapS,wrapT:t.wrapT,flipY:t.flipY}))}))});});
 const views=[];
 for(const [i,scale]of [1.12,.42].entries()){
  camera.position.copy(center).addScaledVector(direction,distance*scale);camera.lookAt(center);renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=new Uint8Array(1280*960*4);gl.readPixels(0,0,1280,960,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let max=0;if(compare)for(let j=0;j<pixels.length;j++)max=Math.max(max,Math.abs(pixels[j]-previous[i][j]));else{if(i===0)previous=[];previous.push(pixels);}
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const render={...renderer.info.render};delete render.frame;
  views.push({detail:i===1,hash:digest,max,render,memory:{...renderer.info.memory},glError:gl.getError()});
 }
 return{size:size.toArray(),animations:gltf.animations.length,meshes,views};
};window.ready=true;
`;
const bundle = await build({stdin:{contents:code, resolveDir:root, sourcefile:'shared-texture-review.ts', loader:'ts'}, bundle:true, write:false, format:'esm', platform:'browser', define:{'import.meta.env.BASE_URL':JSON.stringify(scope)}, plugins:[{name:'ktx-format-preferences', setup(b){b.onLoad({filter:/KTX2Loader\.js$/}, async args=>({contents:separateKtxFormatPreferences(await readFile(args.path,'utf8')),loader:'js'}));}}]});
add('index.html', '<!doctype html><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style><script type="module" src="./assets/review-fixture.js"></script>', 'text/html');
add('assets/review-fixture.js', bundle.outputFiles[0].contents, 'text/javascript');
const entries = [...resources].filter(([file])=>!file.startsWith(scope+'source/')).map(([file,r])=>({url:file.slice(scope.length),revision:hash(r.body),size:r.body.length}));
const manifest = {version:hash(JSON.stringify(entries)).slice(0,20), entries};
add('sw.js', (await readFile(path.join(root,'src/offline-worker.js'),'utf8')).replace('/* OFFLINE_MANIFEST */',JSON.stringify(manifest)), 'text/javascript');
add('offline-save.html', '<!doctype html><link rel="icon" href="data:,"><title>Isolated shared-texture offline proof</title>', 'text/html');
const requests=[];
const server=createServer((req,res)=>{const file=new URL(req.url,'http://localhost').pathname,r=resources.get(file);requests.push(file);if(!r){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':r.type,'Content-Length':r.body.length,'Cache-Control':'no-store'});res.end(r.body);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port+scope;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={scope,release,coverage:'Every shared release model in a nested-path studio; exact original worker with an explicit subset save, followed by offline navigation and decoding.',models:[],offline:[],errors,canceledTransfers};
await mkdir(out,{recursive:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:960},deviceScaleFactor:1});
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('crash',()=>errors.push('Page crashed'));// Three can cancel a consumed response stream; exact decoded pixels below
 // prove those assets completed. Keep cancellations separate from failures.
 page.on('requestfailed',r=>{const reason=r.failure()?.errorText;if(reason==='net::ERR_ABORTED')canceledTransfers.push(r.url());else errors.push(r.url()+': '+reason);});
 await page.goto(base+'index.html');await page.waitForFunction(()=>window.ready);
 for(const item of cases){
  const before=await page.evaluate(o=>window.review(o),{...item,url:base+'source/'+item.file,compare:false});
  const after=await page.evaluate(o=>window.review(o),{...item,url:base+item.file,compare:true});
  assert.deepEqual(after,before,item.file+' exact render and loaded model');
  for(const view of after.views){assert.equal(view.max,0);assert.equal(view.glError,0);assert.ok(view.render.triangles>0);}
  report.models.push({...item,...after});console.log(JSON.stringify({online:report.models.length,total:cases.length,file:item.file,compressed:item.compressed}));
 }
 await page.goto(base+'offline-save.html');
 report.saved=await page.evaluate(async()=>{
  await navigator.serviceWorker.register('./sw.js',{scope:'./'});const registration=await navigator.serviceWorker.ready;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offline save timed out')),120000);navigator.serviceWorker.addEventListener('message',function onMessage(event){if(event.data?.type!=='solProtoOffline')return;if(event.data.phase==='error'){clearTimeout(timer);reject(Error(JSON.stringify(event.data)));}if(event.data.phase==='ready'){clearTimeout(timer);navigator.serviceWorker.removeEventListener('message',onMessage);resolve(event.data);}});registration.active.postMessage({type:'solProtoOfflineSave'});});
 });
 assert.equal(report.saved.completed,entries.reduce((n,e)=>n+e.size,0));
 const networkCount=requests.length;await context.setOffline(true);
 await page.goto(base+'index.html');await page.waitForFunction(()=>window.ready);
 assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller),'Offline document is controlled');
 for(const [i,item]of cases.entries()){
  const offline=await page.evaluate(o=>window.review(o),{...item,url:base+item.file,compare:false});
  assert.deepEqual(offline,((({file,compressed,...render})=>render)(report.models[i])),item.file+' offline render/metadata');
  report.offline.push({file:item.file,compressed:item.compressed,hashes:offline.views.map(v=>v.hash)});
 }
 assert.equal(requests.length,networkCount,'Offline model review made no server requests');
 assert.deepEqual(errors,[]);report.pass=true;report.offlineFiles=entries.length;report.offlineBytes=report.saved.completed;
 console.log(JSON.stringify({pass:true,models:evidence.models.length,images:evidence.assets.length,decoderCases:cases.length,offlineFiles:entries.length,offlineBytes:report.offlineBytes}));
} finally {await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(resolve=>server.close(resolve));}
