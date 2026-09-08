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
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);const match=url.match(/\/jungle-kit\/((?:(?:modular|editor)\/)?[\w-]+\.glb)$/);return match?new Response(await readFile(new URL('public/jungle-kit/'+match[1],root))):new Response('',{status:404});};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {JungleAssetKit,JUNGLE_ASSETS,JUNGLE_ASSET_KINDS,jungleAssetMatrix}=await server.ssrLoadModule('/src/jungleAssets.ts');
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
 assert.ok(kit.diagnostics.placements>kit.diagnostics.components,'assemblies really expand into multiple modules');
 let lods=0;kit.root.traverse(o=>{if(o.isLOD)lods++;if(o.isMesh){assert.ok(o.geometry.userData.shared);if(JUNGLE_ASSETS[o.userData.jungleAsset]?.wind||o.userData.jungleAsset==='vine')assert.ok(o.customDepthMaterial);}});assert.ok(lods>5);
 kit.update(1/60);const time=kit.time.value;kit.update(0);assert.equal(kit.time.value,time);kit.update(1/60);assert.ok(kit.time.value>time);
 const m=jungleAssetMatrix({dkind:'stoneblock',p:[2,3,4],s:[2,1,1]});assert.deepEqual(new THREE.Vector3(0,1,0).applyMatrix4(m).toArray(),[2,4,4]);
 const late=new JungleAssetKit(false,false);late.add({dkind:'jungleleaf',p:[0,0,0]});late.dispose();await late.ready();assert.equal(late.root.children.length,0);

 const {Level,setEditorBuild}=await server.ssrLoadModule('/src/level.ts');
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
 editable.dispose();setEditorBuild(false);copy.dispose();level.dispose();kit.dispose();kit.dispose();
 console.log(`Validated 17 original modules and 5 optional editor assets, compressed textures/LODs, ${samples} roof rays, arch joints, grass-edged dirt, invisible death volumes, black depth fade, wind, collision, disposal and editor reconstruction.`);
}finally{await server.close();}
