import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {addWaterparkDeckLook}=await server.ssrLoadModule('/src/waterparkDeck.ts');
 for(const size of [[9,.6,7],[48,1.2,38],[2,.2,3]]){
  const geometry=new THREE.BoxGeometry(...size),positions=geometry.attributes.position.array.slice(),normals=geometry.attributes.normal.array.slice(),indices=geometry.index.array.slice();
  const map=new THREE.Texture(),material=new THREE.MeshPhongMaterial({map,color:'#89a6a4',emissive:'#123456',opacity:.8,transparent:true,side:THREE.DoubleSide,fog:false});
  let prior=0;material.onBeforeCompile=shader=>{prior++;shader.uniforms.retained={value:3};};material.customProgramCacheKey=()=> 'previous';
  addWaterparkDeckLook(material,geometry,12);addWaterparkDeckLook(material,geometry,12);
  const shader={...THREE.ShaderLib.phong,uniforms:{}};material.onBeforeCompile(shader);
  assert.equal(prior,1);assert.equal(shader.uniforms.retained.value,3);
  assert.deepEqual(shader.uniforms.waterparkHalf.value.toArray(),size.map(s=>Math.fround(s/2)));
  assert.equal(shader.uniforms.waterparkSeed.value,12);assert.equal(material.customProgramCacheKey(),'previous|waterpark-pool-deck-v1');
  assert.equal(material.map,map);assert.equal(material.bumpMap,null);assert.equal(material.normalMap,null);
  assert.equal(material.color.getHexString(),'89a6a4');assert.equal(material.emissive.getHexString(),'123456');assert.equal(material.opacity,.8);assert.equal(material.transparent,true);assert.equal(material.side,THREE.DoubleSide);assert.equal(material.fog,false);
  assert.deepEqual(geometry.attributes.position.array,positions);assert.deepEqual(geometry.attributes.normal.array,normals);assert.deepEqual(geometry.index.array,indices);
  const copy=material.clone();addWaterparkDeckLook(copy,geometry);const copied={...THREE.ShaderLib.phong,uniforms:{}};copy.onBeforeCompile(copied);assert.ok(copied.uniforms.waterparkHalf,'cloned metadata must not suppress shader installation');
  copy.dispose();material.dispose();geometry.dispose();map.dispose();
 }
 const {Level,setEditorBuild,migrateCustomLevel}=await server.ssrLoadModule('/src/level.ts');
 const components=[
  {t:'platform',p:[0,-.5,0],s:[9,1,7],tex:'waterslide-fiberglass',color:'#ffffff',yaw:31},
  {t:'crumble',p:[0,1,-11],s:[9,.6,7],tex:'waterslide-fiberglass',color:'#edf0ea',shake:1.15,speed:20},
  {t:'mover',p:[0,1,-22],s:[10,.7,7],tex:'waterslide-fiberglass',color:'#ffffff',axis:'x',amp:2.2,speed:.7,phase:1.4},
  {t:'platform',p:[20,0,0],s:[6,1,4],tex:'stone'},
  {t:'mover',p:[20,1,-22],s:[8,.7,7],axis:'x',amp:2,speed:.5},
  {t:'ramp',p:[-15,0,-12],w:6,len:8,rise:3,tex:'waterslide-fiberglass'},
  {t:'mesh',p:[-15,0,0],vertices:[-3,0,3,3,0,3,0,0,-3],indices:[0,1,2],tex:'waterslide-fiberglass'},
  {t:'gate',p:[0,1,-30]},
 ];
 const data=migrateCustomLevel({v:1,name:'Pool deck presentation',spawn:[0,.15,0],killY:-30,components});
 for(const editing of [false,true]){
  setEditorBuild(editing);const level=new Level(new THREE.Scene(),{id:'pool-deck-test',name:data.name,data:structuredClone(data)});
  try{
   const at=i=>level.groundMeshes.find(m=>m.userData.editorIdx===i);
   for(const i of [0,1,2]){const mesh=at(i);assert.ok(mesh);assert.equal(mesh.material.userData.texKind,'waterslide-fiberglass');assert.equal(mesh.material.userData.waterparkDeck?.version,1);assert.equal(mesh.geometry.type,'BoxGeometry');assert.equal(mesh.userData.slippy,undefined);assert.ok(mesh.material.map.source===at(0).material.map.source,'reuse the existing image source');}
   for(const i of [3,4,5,6])assert.equal(at(i)?.material.userData.waterparkDeck,undefined,'unrelated surfaces keep their existing finish');
   assert.equal(at(2).material.color.getHexString(),'ffffff');assert.equal(at(4).material.userData.texKind,'metal');
   assert.deepEqual(level.captureData(),data,'presentation must not change the editor level data');
   const mover=level.movers[0];assert.deepEqual(mover.base.toArray(),[0,1-.7/2,-22]);assert.equal(mover.amp,2.2);assert.equal(mover.speed,.7);assert.equal(mover.phase,1.4);
   const crumble=level.crumbles[0];assert.ok(crumble);if(!editing)assert.ok(level.surfaceEdgeRails.length>=12,'ordinary platform edges remain grindable');
   const maps=new Set();level.root.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.map)maps.add(m.map);});
   const disposed=new Map([...maps].map(m=>[m,0]));for(const m of maps)m.addEventListener('dispose',()=>disposed.set(m,disposed.get(m)+1));
   level.dispose();assert.ok([...disposed.values()].every(n=>n===1),'existing material/texture retirement remains single-owner');
  }catch(error){level.dispose();throw error;}
 }
 setEditorBuild(false);
 console.log('PASS pool deck shader composition, metric box bounds, unchanged geometry/tints, editor capture, moving/falling ownership, default grind edges and texture retirement.');
}finally{await server.close();}
