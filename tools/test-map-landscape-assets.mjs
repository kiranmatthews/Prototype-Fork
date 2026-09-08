import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {auditClosedGeometry} from './mesh-topology.mjs';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('public/map-kit/manifest.json',root),'utf8'));
assert.deepEqual(manifest.map(a=>a.file),['clay-buttress','clay-terrace']);
let bytes=0;
for(const asset of manifest){
 const data=await readFile(new URL('public/map-kit/'+asset.file+'.glb',root));bytes+=data.length;
 assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
 const length=data.readUInt32LE(12),gltf=JSON.parse(data.toString('utf8',20,20+length)),bin=data.subarray(28+length);
 assert.equal(gltf.meshes.length,2);assert.equal(gltf.materials.length,1);assert.equal(gltf.textures?.length??0,0);
 assert.ok(gltf.materials.every(m=>m.doubleSided!==true&&(m.alphaMode??'OPAQUE')==='OPAQUE'));
 const decode=id=>{
  const a=gltf.accessors[id],view=gltf.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type],size={5126:4,5125:4,5123:2,5121:1}[a.componentType];
  const out=[];for(let i=0;i<a.count;i++)for(let j=0;j<n;j++){
   const at=(view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??n*size)+j*size;
   out.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt8(at));
  }return out;
 };
 for(const [index,mesh]of gltf.meshes.entries()){
  assert.equal(mesh.primitives.length,1);const p=mesh.primitives[0],g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(decode(p.attributes.POSITION),3));g.setIndex(decode(p.indices));
  const check=auditClosedGeometry(g);
  assert.equal(check.triangles,index?asset.lodTriangles:asset.triangles);
  assert.ok(check.triangles>0&&check.triangles<15000);assert.equal(check.degenerate,0);assert.equal(check.duplicates,0);assert.equal(check.boundaries,0);assert.equal(check.winding,0);
  assert.equal(check.components.length,1);assert.equal(check.components[0].euler,2);assert.ok(check.components[0].volume>0);
  assert.ok(p.attributes.COLOR_0!==undefined);assert.ok(decode(p.attributes.NORMAL).every(Number.isFinite));g.dispose();
 }
}
assert.ok(bytes<1024*1024);
for(const name of ['rainforest-tree.glb','cliff-buttress.glb','ridge-spine.glb','sea-arch.glb','cliff-albedo.jpg'])await assert.rejects(access(new URL('public/map-kit/'+name,root)));
const catalog=await readFile(new URL('src/mapModules.ts',root),'utf8');assert.doesNotMatch(catalog,/rainforest-tree|ridge-spine|cliff-buttress|sea-arch/);
const map=await readFile(new URL('src/worldMap.ts',root),'utf8');assert.doesNotMatch(map,/dkind:'junglecanopy'|dkind:'junglepalmtree'|world map waterfall|cliff-albedo|uMapRock/);
for(const kind of ['mapbroadleaf','mappalm','mapgroundleaf'])assert.ok(map.includes(kind));
assert.match(map,/scenery\.flush\(\)/);assert.match(map,/this.scenery.update\(dt\)/);assert.match(map,/this.scenery.dispose\(\)/);
const ledger=JSON.parse(await readFile(new URL('tools/map-kit/tasks.json',root),'utf8'));assert.equal(ledger.budget,300);assert.ok(ledger.reservedCredits<=300);
assert.equal(Object.values(ledger.tasks).reduce((n,t)=>n+t.credits,0),ledger.reservedCredits);
console.log('PASS exported clay rocks: one opaque, manifold, positive-volume, genus-zero solid at both LODs; no retired models, flat cliff texture or waterfalls');
