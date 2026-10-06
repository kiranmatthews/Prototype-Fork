import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const root=new URL('../',import.meta.url);
const retained=JSON.parse(await readFile(new URL('public/jungle-kit/manifest.json',root),'utf8'));
const modular=JSON.parse(await readFile(new URL('public/jungle-kit/modular/manifest.json',root),'utf8'));
const editorAssets=JSON.parse(await readFile(new URL('public/jungle-kit/editor/manifest.json',root),'utf8'));
const files=new Map();let transfer=0;
function parse(bytes){const n=bytes.readUInt32LE(12);return {doc:JSON.parse(bytes.toString('utf8',20,20+n).trimEnd()),bin:bytes.subarray(28+n)};}
function accessor(doc,bin,id){
 const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5123:2,5125:4}[a.componentType];
 const out=[];const start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??n*bytes;
 for(let i=0;i<a.count;i++)for(let k=0;k<n;k++){const at=start+i*stride+k*bytes;out.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt32LE(at));}
 return out;
}
for(const entry of [...retained.map(e=>({...e,file:e.name,path:e.name+'.glb'})),...modular.map(e=>({...e,path:'modular/'+e.file+'.glb'})),...editorAssets.map(e=>({...e,path:'editor/'+e.file+'.glb'}))]){
 const bytes=await readFile(new URL('public/jungle-kit/'+entry.path,root));const {doc,bin}=parse(bytes);
 assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 assert.equal(doc.materials.length,1,'one material shared by both LODs');
 for(const p of doc.meshes.flatMap(m=>m.primitives)){
  for(const name of ['POSITION','NORMAL','TEXCOORD_0'])assert.ok(accessor(doc,bin,p.attributes[name]).every(Number.isFinite),entry.file+' finite '+name);
  const positions=doc.accessors[p.attributes.POSITION];
  const indices=accessor(doc,bin,p.indices);assert.ok(indices.every(i=>i>=0&&i<positions.count),entry.file+' indices in range');
 }
 if(entry.path.startsWith('modular/')||entry.editorOnly){
  assert.equal(doc.meshes.length,2,'each module has a real near/far mesh');
  assert.ok(doc.nodes.some(n=>n.name?.endsWith('LOD0'))&&doc.nodes.some(n=>n.name?.endsWith('LOD1')));
  assert.ok(entry.lodTriangles<entry.triangles*.55,'useful distant geometry reduction');
  assert.ok(entry.triangles<2700,'bounded individual module');
  const texture=doc.textures[doc.materials[0].pbrMetallicRoughness.baseColorTexture.index];
  const gpu=doc.images[texture.extensions.KHR_texture_basisu.source],fallback=doc.images[texture.source];
  assert.equal(gpu.mimeType,'image/ktx2');assert.equal(fallback.mimeType,'image/jpeg');
  const view=doc.bufferViews[gpu.bufferView],ktx=bin.subarray(view.byteOffset,view.byteOffset+view.byteLength);
  assert.deepEqual([...ktx.subarray(0,12)],[171,75,84,88,32,50,48,187,13,10,26,10]);
  assert.equal(ktx.readUInt32LE(20),2048,'sharp source albedo');assert.ok(ktx.readUInt32LE(40)>1,'precomputed mip chain');
  assert.equal(doc.extensionsRequired,undefined,'JPEG remains a portable fallback');
 }
 transfer+=bytes.length;files.set(entry.file,{...entry,doc,bin});
}
assert.equal(modular.length,17);assert.equal(editorAssets.length,5);assert.ok(transfer<32*1048576,'bounded kit and optional editor asset transfer');
const budget=JSON.parse(await readFile(new URL('tools/jungle-kit/tasks.json',root),'utf8'));
assert.ok(budget.reservedCredits<=650);

const harness=await readFile(new URL('tools/validate-editor-roundtrip.mjs',root),'utf8');
const dom=harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('));
const nativeFetch=globalThis.fetch;runInThisContext(dom+'\ninstallHeadlessDom();');globalThis.self=globalThis;
// Matte scenery uses TextureLoader rather than GLB ImageBitmapLoader. Decode
// real PNG/WebP headers while the headless DOM supplies the image load event.
const originalCreateElementNS=document.createElementNS.bind(document);
function imageSize(bytes){
 if(bytes.toString('ascii',1,4)==='PNG')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'){
  for(let at=12;at+8<bytes.length;){
   const chunk=bytes.toString('ascii',at,at+4),start=at+8,length=bytes.readUInt32LE(at+4);
   if(chunk==='VP8X')return [bytes.readUIntLE(start+4,3)+1,bytes.readUIntLE(start+7,3)+1];
   if(chunk==='VP8 ')return [bytes.readUInt16LE(start+6)&0x3fff,bytes.readUInt16LE(start+8)&0x3fff];
   if(chunk==='VP8L'){const bits=bytes.readUInt32LE(start+1);return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1];}
   at=start+length+(length%2);
  }
 }
 throw new Error('Unsupported scenery image header');
}
document.createElementNS=(namespace,tag)=>{
 const element=originalCreateElementNS(namespace,tag);if(tag!=='img')return element;
 const listeners=new Map();element.addEventListener=(type,fn)=>listeners.set(type,fn);
 element.removeEventListener=type=>listeners.delete(type);
 Object.defineProperty(element,'src',{set(url){
  const path=new URL(url,'http://headless.invalid').pathname.match(/\/((?:treehouse-trail\/matte-(?:far|mid)\.png|treehouse-trials\/(?:(?:forest|coast)-depth-alpha|(?:forest|coast|cavern)-depth)\.webp|treehouse-trials-v2\/forest-water-probe\.webp|treehouse-repair\/(?:grove|ridge|cave)\.webp))$/)?.[1];
  if(path)readFile(new URL('public/'+path,root)).then(bytes=>{
   [element.width,element.height]=imageSize(bytes);listeners.get('load')?.call(element);
  }).catch(error=>listeners.get('error')?.(error));
 }});return element;
};
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);const match=new URL(url,'http://headless.invalid').pathname.match(/\/((?:jungle-kit\/(?:(?:modular|editor)\/)?|map-kit\/|nightworks-kit\/|treehouse-trail\/|treehouse-trials\/|treehouse-trials-v2\/|carlisle-coast\/|carlisle-coast-fidelity\/|beachfront\/)[\w-]+\.glb)$/);return match?new Response(await readFile(new URL('public/'+match[1],root))):new Response('',{status:404});};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {JungleAssetKit,JUNGLE_ASSETS,JUNGLE_ASSET_KINDS,jungleAssetMatrix,createJungleAssetScope,configureJungleAssetRenderer}=await server.ssrLoadModule('/src/jungleAssets.ts');
 // A Meshy export can group several atlas primitives under a named LOD root.
 // Exercise that real GLTFLoader path and its leases with a small in-memory GLB.
 function groupedFixture(){
  const geometry=new THREE.BoxGeometry(),views=[],accessors=[],chunks=[];let offset=0;
  const add=(array,type,componentType)=>{
   const buffer=Buffer.from(array.buffer,array.byteOffset,array.byteLength);
   views.push({buffer:0,byteOffset:offset,byteLength:buffer.length});chunks.push(buffer);offset+=buffer.length;
   accessors.push({bufferView:views.length-1,componentType,count:array.length/({SCALAR:1,VEC2:2,VEC3:3}[type]),type});
   const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
   return accessors.length-1;
  };
  const position=add(geometry.attributes.position.array,'VEC3',5126),normal=add(geometry.attributes.normal.array,'VEC3',5126),uv=add(geometry.attributes.uv.array,'VEC2',5126),indices=add(geometry.index.array,'SCALAR',5123);
  accessors[position].min=[-.5,-.5,-.5];accessors[position].max=[.5,.5,.5];
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,3]}],nodes:[
   {name:'AssetLOD0',children:[1,2]},{name:'left atlas primitive',mesh:0,translation:[-2,0,0]},
   {name:'right atlas primitive',mesh:0,translation:[2,0,0]},{name:'AssetLOD1',children:[4]},
   {name:'far atlas primitive',mesh:0,scale:[5,1,1]}],
   meshes:[{primitives:[{attributes:{POSITION:position,NORMAL:normal,TEXCOORD_0:uv,
    _JUNGLE_AO:add(new Float32Array(24).fill(.8),'SCALAR',5126),
    _WIND_FLEX:add(Float32Array.from({length:24},(_,i)=>geometry.attributes.position.getY(i)>0?.7:0),'SCALAR',5126)},indices,material:0}]}],
   materials:[{pbrMetallicRoughness:{metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:offset}],bufferViews:views,accessors};
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.alloc(raw.length+(4-raw.length%4)%4,32);raw.copy(json);
  const binary=Buffer.concat(chunks),header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);geometry.dispose();
  return Buffer.concat([header,json,binHeader,binary]);
 }
 const fixtureFetch=globalThis.fetch,fixture=groupedFixture();
 globalThis.fetch=async input=>{
  const url=typeof input==='string'?input:input.url;
  return url.endsWith('/treehouse-trials/cavearch.glb')||url.endsWith('/treehouse-trials-v2/tree-a.glb')||url.endsWith('/treehouse-trials-v2/awning.glb')?new Response(fixture):fixtureFetch(input);
 };
 const owner=createJungleAssetScope(),otherOwner=createJungleAssetScope();
 try{
  const merged=await owner.load('treehousecavearch');
  assert.equal(merged.geometry.attributes.position.count,48,'both high primitives survive ingest');
  assert.equal(merged.lodGeometry.attributes.position.count,24,'LOD1 is separate from high geometry');
  assert.ok(Array.from(merged.geometry.attributes.aJungleAO.array).every(value=>Math.abs(value-.8)<1e-6),'packed AO survives normalization');
  const tree=await owner.load('trialsv2treea');
  for(let i=0;i<tree.geometry.attributes.position.count;i++)assert.ok(Math.abs(tree.geometry.attributes.aJungleFlex.getX(i)
   -(tree.geometry.attributes.position.getY(i)>.5?.7:0))<1e-6,'authored leaf mask moves leaves while roots remain planted');
  const clothKit=new JungleAssetKit(true,false,false,false,'painterly');
  clothKit.add({dkind:'trialsv2awning',p:[0,3,0]});clothKit.flush();await clothKit.ready();
  try{
   const cloth=clothKit.root.children[0],shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
   cloth.material.onBeforeCompile(shader,{});
   assert.ok(shader.vertexShader.includes('transformed.y +='));
   assert.equal(shader.vertexShader.includes('transformed.x +='),false);assert.equal(shader.vertexShader.includes('transformed.z +='),false,'cloth billows only in its authored local Y');
   const depth={uniforms:{},vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader};cloth.customDepthMaterial.onBeforeCompile(depth,{});
   assert.equal(depth.vertexShader.includes('transformed.x +='),false);assert.ok(depth.vertexShader.includes('transformed.y +='));
  }finally{clothKit.dispose();}
  assert.equal(await otherOwner.load('treehousecavearch'),merged,'concurrent scene owners share the atlas geometry');
  let releases=0;merged.geometry.addEventListener('dispose',()=>releases++);
  owner.dispose();assert.equal(releases,0,'one departing level cannot dispose the incoming level geometry');
  otherOwner.dispose();assert.equal(releases,1,'last level releases merged geometry exactly once');
 }finally{owner.dispose();otherOwner.dispose();globalThis.fetch=fixtureFetch;}
 const inspection=createJungleAssetScope(),loadJungleAssetTemplate=inspection.load;
 const painterlyKit=new JungleAssetKit(true,false,false,false,'painterly');
 painterlyKit.add({dkind:'jungleleaf',p:[0,0,0]});painterlyKit.flush();await painterlyKit.ready();
 try{
  const mesh=painterlyKit.root.children[0],material=mesh.material;
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader,{});
  assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse *= vec3(0.86,0.96,1.08) * clamp(vTreehouseAO'));
  assert.equal(shader.fragmentShader.includes('reflectedLight.directDiffuse *='),false,'cool shade cannot recolour the authored key light');
  assert.equal(shader.uniforms.uJungleWindScale.value,1.65);assert.equal(shader.uniforms.uJungleWindFrequency.value,.72);
  const depth={uniforms:{},vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader};
  mesh.customDepthMaterial.onBeforeCompile(depth,{});
  assert.equal(depth.uniforms.uJungleWindScale.value,shader.uniforms.uJungleWindScale.value);
  assert.equal(depth.uniforms.uJungleWindFrequency.value,shader.uniforms.uJungleWindFrequency.value,'moving foliage and its shadow share the breeze');
  assert.ok(Math.abs(material.normalScale.x-.28*.75)<1e-12);
 }finally{painterlyKit.dispose();}
 const {templePavilionParts,templeArchParts}=await server.ssrLoadModule('/src/jungleAssemblies.ts');
 const {JUNGLE_MODULES}=await server.ssrLoadModule('/src/jungleModules.ts');
 for(const kind of ['roofedtemple','hangingarch','templewall','templeplatform'])assert.equal(JUNGLE_ASSETS[kind].file,'','assemblies cannot load a whole-building/facade GLB');
 // Read actual fitted mesh bytes for a geometry-level roof and arch audit.
 const shapes=new Map();
 function shape(kind){
  if(shapes.has(kind))return shapes.get(kind);
  let geometry;
  if(kind==='joint'||kind==='earth')geometry=new THREE.BoxGeometry(1,1,1).translate(0,.5,0);
  else {
   const spec=JUNGLE_MODULES[kind],f=files.get(spec.file.split('/').at(-1));
   const node=f.doc.nodes.find(n=>n.name?.endsWith('LOD0')),p=f.doc.meshes[node.mesh].primitives[0];
   geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(accessor(f.doc,f.bin,p.attributes.POSITION),3));geometry.setIndex(accessor(f.doc,f.bin,p.indices));
   geometry.computeBoundingBox();const b=geometry.boundingBox,size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());geometry.translate(-center.x,-b.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);
  }
  shapes.set(kind,geometry);return geometry;
 }
 function partMeshes(parts){return parts.filter(p=>p.kind!=='vine').map(p=>{const m=new THREE.Mesh(shape(p.kind),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.matrix.copy(p.matrix);m.matrixAutoUpdate=false;m.updateMatrixWorld(true);m.userData.kind=p.kind;return m;});}
 const roofMeshes=partMeshes(templePavilionParts(14,13,12,0,false));let holes=0,samples=0;
 const ray=new THREE.Raycaster();
 for(let x=-6.8;x<=6.8;x+=.45)for(let z=-5.8;z<=5.8;z+=.45){ray.set(new THREE.Vector3(x,25,z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(roofMeshes,false)[0];samples++;if(!hit||hit.point.y<8.8)holes++;}
 assert.ok(holes/samples<.025,`roof has uncovered areas: ${holes}/${samples}`);
 const archMeshes=partMeshes(templeArchParts(20,13,2.8,0));let hits=0;
 for(let i=0;i<200;i++){const phi=Math.PI*(i+.5)/200;ray.set(new THREE.Vector3(Math.cos(phi)*8,4.4+Math.sin(phi)*8,5),new THREE.Vector3(0,0,-1));if(ray.intersectObjects(archMeshes,false).length)hits++;}
 assert.ok(hits>=190,`arch joints too wide: ${hits}/200 samples covered`);

 const kit=new JungleAssetKit(true,false);
 for(const kind of JUNGLE_ASSET_KINDS)for(let i=0;i<2;i++)kit.add({dkind:kind,p:[0,0,-i*12]});
 kit.flush();await kit.ready();assert.deepEqual(kit.errors,[]);assert.equal(kit.diagnostics.ready,kit.diagnostics.placements);
 const cellMeshes=kit.root.children.filter(mesh=>mesh.isInstancedMesh);
 assert.ok(cellMeshes.length>0);
 let staticCompositions=0;
 for(const mesh of cellMeshes){
  assert.equal(mesh.matrixAutoUpdate,false,'shader wind must not recompose immutable cell transforms');
  assert.deepEqual(mesh.matrix.elements,new THREE.Matrix4().compose(mesh.position,mesh.quaternion,mesh.scale).elements);
  const originalUpdate=mesh.updateMatrix;mesh.updateMatrix=function(){staticCompositions++;return originalUpdate.call(this);};
 }
 for(const offset of [new THREE.Vector3(8,3,-11),new THREE.Vector3()]){
  kit.root.position.copy(offset);kit.root.updateMatrixWorld(true);
  for(const mesh of cellMeshes)assert.deepEqual(mesh.matrixWorld.elements,
   new THREE.Matrix4().multiplyMatrices(kit.root.matrixWorld,mesh.matrix).elements,
   'frozen cell locals must still follow a moving parent');
 }
 assert.equal(staticCompositions,0,'repeated scene passes must not compose static jungle cells');
 for(const kind of ['treehousemattefar','treehousemattemid']){
  const template=await loadJungleAssetTemplate(kind),position=template.geometry.attributes.position,normal=template.geometry.attributes.normal;
  assert.equal(template,(await loadJungleAssetTemplate(kind)),'matte texture and geometry are cached');
  for(let i=0;i<position.count;i++){assert.ok(Number.isFinite(position.getX(i)));assert.equal(position.getZ(i),0);assert.equal(normal.getZ(i),1);}
  assert.equal(template.map.colorSpace,THREE.SRGBColorSpace);assert.equal(template.map.image.width,1942);
  const draws=[];kit.root.traverse(o=>{if(o.isMesh&&o.userData.jungleAsset===kind)draws.push(o);});
  assert.ok(draws.length>0);for(const mesh of draws){assert.equal(mesh.material.isMeshBasicMaterial,true);assert.equal(mesh.material.fog,false);assert.equal(mesh.material.toneMapped,false);assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);assert.equal(mesh.material.transparent,kind==='treehousemattemid');assert.equal(mesh.material.depthWrite,kind!=='treehousemattemid');assert.equal(mesh.material.alphaTest,kind==='treehousemattemid'?.005:0);}
 }
 for(const kind of ['treehousecavearch','treehousecavewall','treehouserocksteps','treehouseporchhut','treehousecrabshack','treehousesugarcane','treehousebridgeend','treehousemossrock']){
  const template=await loadJungleAssetTemplate(kind),position=template.geometry.attributes.position;
  assert.ok(Array.from(position.array).every(Number.isFinite),kind+' has finite normalized positions');
  const size=template.geometry.boundingBox.getSize(new THREE.Vector3());
  for(const extent of size.toArray())assert.ok(extent>=1&&extent<1.19,kind+' is normalized in all axes');
  if(kind==='treehousesugarcane'){
   const flex=template.geometry.attributes.aJungleFlex;
   assert.ok(Array.from(flex.array).every(value=>Number.isFinite(value)&&value>=0&&value<=.721),'bounded cane wind');
   for(let i=0;i<position.count;i++)if(position.getY(i)<.02)assert.equal(flex.getX(i),0,'cane bases stay planted');
  }
 }
 const shaftMeshes=cellMeshes.filter(mesh=>mesh.userData.jungleAsset==='treehousetrialssunshaft');
 assert.ok(shaftMeshes.length);
 for(const mesh of shaftMeshes){
  assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);
  assert.equal(mesh.material.map,null);assert.equal(mesh.material.fog,true);assert.equal(mesh.material.depthWrite,false);
  assert.equal(mesh.material.blending,THREE.AdditiveBlending);assert.ok(mesh.material.opacity>0&&mesh.material.opacity<=.09);assert.equal(mesh.material.forceSinglePass,true);
  assert.equal(mesh.material.color.getHex(),0xffdfa8,'sun shafts retain warm daylight with white instance tints');
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader};
  mesh.material.onBeforeCompile(shader,{});
  assert.ok(shader.vertexShader.includes('vJungleShaftUv = aJungleShaftUv'));assert.ok(shader.fragmentShader.includes('shaftEnds'));
  assert.equal(shader.uniforms.uJungleTime,kit.time);
 }
 assert.ok(kit.diagnostics.placements>kit.diagnostics.components,'assemblies really expand into multiple modules');
 let lods=0;kit.root.traverse(o=>{if(o.isLOD)lods++;if(o.isMesh){assert.ok(o.geometry.userData.shared);if(JUNGLE_ASSETS[o.userData.jungleAsset]?.wind||o.userData.jungleAsset==='vine')assert.ok(o.customDepthMaterial);}});assert.equal(lods,0,'scenery keeps its authored mesh at every camera distance');
 kit.update(1/60);const time=kit.time.value;kit.update(0);assert.equal(kit.time.value,time);kit.update(1/60);assert.ok(kit.time.value>time);
 const m=jungleAssetMatrix({dkind:'stoneblock',p:[2,3,4],s:[2,1,1]});assert.deepEqual(new THREE.Vector3(0,1,0).applyMatrix4(m).toArray(),[2,4,4]);
 const late=new JungleAssetKit(false,false);late.add({dkind:'jungleleaf',p:[0,0,0]});late.dispose();await late.ready();assert.equal(late.root.children.length,0);

 const streamed=new JungleAssetKit(true,false,false,true);
 for(const z of [0,-600])streamed.add({dkind:'stoneblock',p:[0,0,z]});
 streamed.add({dkind:'treehousemattefar',p:[0,0,-1200]});streamed.flush();
 assert.equal(streamed.root.children.length,0,'deferred cells cannot start all asset loads on construction');
 streamed.setView(new THREE.Vector3(),155);await streamed.ready();
 assert.equal(streamed.diagnostics.placements,3);assert.equal(streamed.diagnostics.ready,2,'only nearby scenery plus backdrop is resident');
 const near=streamed.root.children.find(mesh=>mesh.userData.jungleAsset==='stoneblock');let retired=0;
 near.addEventListener('dispose',()=>retired++);
 streamed.setView(new THREE.Vector3(0,0,-600),155);await streamed.ready();
 assert.equal(retired,1,'leaving a cell releases its instance buffer');
 assert.equal(streamed.diagnostics.ready,2,'traversal must not accumulate distant cells');
 assert.ok(streamed.root.children.some(mesh=>mesh.position.z===-600));
 const targetGeometry=(await inspection.load('stoneblock')).geometry;
 assert.equal(streamed.root.children.find(mesh=>mesh.userData.jungleAsset==='stoneblock').geometry,targetGeometry,'streaming keeps the exact authored mesh');
 streamed.setView(new THREE.Vector3(),155);streamed.setView(new THREE.Vector3(0,0,-600),155);await streamed.ready();
 assert.equal(streamed.diagnostics.ready,2,'late activation cannot resurrect a retired cell');
 streamed.setView(new THREE.Vector3(),155,new THREE.Vector3(0,0,-600));await streamed.ready();
 assert.equal(streamed.diagnostics.ready,3,'split-screen must retain both cameras');
 assert.deepEqual(streamed.errors,[]);streamed.dispose();await streamed.ready();
 assert.equal(streamed.root.children.length,0);

 const {Level,setEditorBuild,normalizeCustomLevelData,parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 for(const depthFade of [undefined,true,false]){
  const data={v:1,name:'Low jungle floor',spawn:[0,-13.45,0],killY:-30,sky:'day',jungleAtmosphere:true,
   ...(depthFade!==undefined?{jungleDepthFade:depthFade}:{}),components:[
    {t:'platform',p:[0,-14,0],s:[8,1,8]},{t:'decor',dkind:'junglecliff',p:[12,-17,-2],s:[4,5,4]},
    {t:'gate',p:[0,-13.5,-2]}]};
  const normalized=normalizeCustomLevelData(data);assert.ok(normalized);
  assert.equal(normalized.jungleDepthFade,depthFade,'normalization preserves the authored depth-fade setting');
  assert.deepEqual(parseCustomLevelJson(JSON.stringify(data)),normalized,'JSON import retains the setting');
  const low=new Level(new THREE.Scene(),{id:'low-jungle-floor',name:data.name,data});
  try{
   await low.prepareJungleAssets();
   assert.equal(low.jungleDepthFade,depthFade!==false,'absence retains the legacy death-pit default');
   assert.equal(low.captureData().jungleDepthFade,depthFade,'editor capture retains explicit false');
   const floor=low.groundMeshes.find(mesh=>mesh.userData.editorIdx===0),scenery=[];
   low.root.traverse(mesh=>{if(mesh.isMesh&&mesh.userData.jungleAsset==='junglecliff')scenery.push(mesh);});
   assert.ok(scenery.length);
   for(const mesh of [floor,...scenery]){
    const material=mesh.material,lib=material.isMeshStandardMaterial?THREE.ShaderLib.standard:THREE.ShaderLib.lambert;
    const shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};material.onBeforeCompile(shader,{});
    assert.equal(shader.fragmentShader.includes('smoothstep(-10.0, -4.2, vJungleDepthY)'),depthFade!==false,
     'both existing ground and asynchronously loaded scenery obey the level setting');
   }
  }finally{low.dispose();}
 }
 const styledData={v:1,name:'Painterly copy',spawn:[0,1,0],killY:-30,jungleAtmosphere:true,jungleStyle:'painterly',
  components:[{t:'platform',p:[0,-1,0],s:[8,1,8]},{t:'gate',p:[0,-.5,-2]}]};
 const styled=new Level(new THREE.Scene(),{id:'portable-painterly',name:styledData.name,data:styledData});
 try{
  assert.equal(styled.captureData().jungleStyle,'painterly');assert.equal(normalizeCustomLevelData(styled.captureData()).jungleStyle,'painterly');
  const material=styled.groundMeshes[0].material,shader={uniforms:{},vertexShader:THREE.ShaderLib.phong.vertexShader,fragmentShader:THREE.ShaderLib.phong.fragmentShader};
  material.onBeforeCompile(shader,{});assert.ok(shader.fragmentShader.includes('reflectedLight.indirectDiffuse *= vec3(0.86,0.96,1.08);'));
 }finally{styled.dispose();}
 const level=new Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'});await level.prepareJungleAssets();level.pickRoot.updateMatrixWorld(true);
 const capture=JSON.parse(JSON.stringify(level.captureData()));assert.equal(capture.jungleAtmosphere,true);
 assert.equal(capture.components.filter(c=>c.t==='gate').length,1);
 const paths=capture.components.filter(c=>c.t==='terrain');assert.ok(paths.length>4&&paths.every(c=>c.tex==='dirt'),'all jungle traversal strips use dirt');
 const optionalKinds=new Set(editorAssets.map(a=>a.kind));
 assert.ok(capture.components.every(c=>!optionalKinds.has(c.dkind)),'new clay models are optional; the existing brick selection stays in the level');
 const hiddenPitVolumes=capture.components.filter(c=>c.dkind==='thornroots');
 assert.equal(hiddenPitVolumes.length,40,'retain all authored death volumes');
 assert.ok(hiddenPitVolumes.every(c=>c.invisible===true&&c.solid===true));
 let visibleThorns=0;
 level.root.traverse(o=>{if(o.isMesh&&o.userData.jungleAsset==='thornroots')visibleThorns++;});
 assert.equal(visibleThorns,0,'no thorn geometry is rendered at the bottom of pits');
 for(const mesh of level.groundMeshes.filter(m=>m.userData.terrainComp)){
  const trail=mesh.geometry.attributes.aJungleTrail;
  assert.equal(trail.count,mesh.geometry.attributes.position.count);
  assert.ok(Array.from(trail.array).every(Number.isFinite));
  assert.ok(Array.from({length:trail.count},(_,i)=>trail.getX(i)).some(x=>Math.abs(x)<.001),'the curved trail retains a dirt centre');
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};
  mesh.material.onBeforeCompile(shader,{});
  assert.ok(shader.uniforms.uJungleGrass?.value,'grass texture is bound to the real ground material');
  assert.ok(shader.vertexShader.includes('vJungleTrail = aJungleTrail'));
  assert.ok(shader.fragmentShader.includes('grassBlend'));
  assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb *= smoothstep(-10.0')>shader.fragmentShader.indexOf('#include <fog_fragment>'),'fog cannot recolour the black pit floor');
 }
 assert.equal(capture.components.filter(c=>c.dkind==='roofedtemple'||c.dkind==='hangingarch').length,0,'landmarks are authored as individual blocks');
 for(const kind of ['stoneblock','stonepaver','stoneshaft','stonecapital','stonecornice','stoneroof','stonehip','junglecanopy'])assert.ok(capture.components.some(c=>c.dkind===kind),kind+' used in the actual level');
 for(const old of ['fern','broadleaf','jungletree','palm','plants','tree','vines','log'])assert.equal(capture.components.filter(c=>c.dkind===old).length,0,old+' was replaced');
 const support=(value,p)=>new THREE.Raycaster(new THREE.Vector3(p[0],p[1]+1,p[2]),new THREE.Vector3(0,-1,0),0,3).intersectObjects(value.groundMeshes)[0]?.point.y;
 assert.ok(Math.abs(support(level,level.spawnPos.toArray())-level.spawnPos.y)<.5);
 for(let i=0;i<5;i++){const h=(i+1)*2.3,x=[-2.6,2.6,-2.6,2.6,0][i],z=-332-i*12;assert.ok(Math.abs(support(level,[x,h,z])-h)<.001,'temple tier collision');}
 const copy=new Level(new THREE.Scene(),{id:'jungle-copy',name:'Copy',data:capture});assert.deepEqual(copy.captureData(),capture);assert.equal(copy.pitBoxes.length,level.pitBoxes.length);
 setEditorBuild(true);const editable=new Level(new THREE.Scene(),{id:'jungle-editor',name:'Editor',data:capture});await editable.prepareJungleAssets();let pickable=0;
 editable.pickRoot.traverse(o=>{if(o.isMesh&&o.userData.jungleAsset){pickable++;assert.ok(Number.isInteger(o.userData.editorIdx),'asynchronous module remains pickable');}});assert.ok(pickable>1000);
 editable.dispose();setEditorBuild(false);copy.dispose();level.dispose();kit.dispose();kit.dispose();inspection.dispose();
 // No renderer above means full-resolution WebP remains the portable path.
 // A configured GPU decoder shares the same scope and disposal semantics.
 const gpuCalls=[];let gpuFailure=false;
 configureJungleAssetRenderer({}, {loadAsync(url){
  gpuCalls.push(url);
  return gpuFailure?Promise.reject(new Error('mock unsupported GPU texture'))
   :Promise.resolve(new THREE.CompressedTexture([{data:new Uint8Array(8),width:1942,height:809}],1942,809,THREE.RGBFormat));
 }});
 const compressedOwner=createJungleAssetScope();
 try{
  const template=await compressedOwner.load('treehousetrialsforestmatte');
  assert.equal(template.map.isCompressedTexture,true);assert.equal(template.map.image.width,1942);assert.equal(template.map.image.height,809);
  assert.equal(template.map.colorSpace,THREE.SRGBColorSpace);assert.equal(template.map.userData.shared,true);
  let released=0;template.map.addEventListener('dispose',()=>released++);compressedOwner.dispose();assert.equal(released,1);
 }finally{compressedOwner.dispose();}
 assert.ok(gpuCalls[0].endsWith('treehouse-trials/forest-depth-alpha.ktx2'));
 gpuFailure=true;const originalWarn=console.warn,warnings=[];console.warn=message=>warnings.push(message);
 try{
  for(let i=0;i<2;i++){
   const fallbackOwner=createJungleAssetScope();
   try{
    const template=await fallbackOwner.load('treehousetrialscoastmatte');
    assert.notEqual(template.map.isCompressedTexture,true);assert.equal(template.map.image.width,1942);
   }finally{fallbackOwner.dispose();}
  }
  assert.equal(warnings.length,1,'unsupported compression warns only once per matte kind across level transitions');
 }finally{console.warn=originalWarn;}
 gpuFailure=false;
 const {JungleStreamReflectionOwner}=await server.ssrLoadModule('/src/jungleStream.ts');
 const reflectionOwner=new JungleStreamReflectionOwner(),firstWater=reflectionOwner.acquire(),secondWater=reflectionOwner.acquire();
 const callsBeforeReflection=gpuCalls.length;
 try{
  assert.equal(firstWater.promise,secondWater.promise,'all water materials in one level borrow one template promise');
  const reflection=await firstWater.promise;assert.equal(await secondWater.promise,reflection);
  assert.equal(gpuCalls.length,callsBeforeReflection+1,'one level decodes only one reflection image');
  let disposed=0;reflection.map.addEventListener('dispose',()=>disposed++);
  firstWater.release();assert.equal(disposed,0,'another water material retains the shared reflection');
  secondWater.release();assert.equal(disposed,1,'last water material releases the reflection once');
 }finally{firstWater.release();secondWater.release();reflectionOwner.dispose();}
 console.log(`Validated 17 original modules and 5 optional editor assets, compressed textures/LODs, ${samples} roof rays, arch joints, grass-edged dirt, invisible death volumes, black depth fade, wind, collision, disposal and editor reconstruction.`);
}finally{await server.close();}
