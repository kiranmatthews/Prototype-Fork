import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {repairSceneryNormals}=await server.ssrLoadModule('/src/sceneryNormals.ts');
 const usable=n=>Number.isFinite(n.lengthSq())&&n.lengthSq()>1e-12;
 function check(geometry,expected){
  const before=geometry.clone(),n=geometry.getAttribute('normal'),old=before.getAttribute('normal');
  const repaired=repairSceneryNormals(geometry);assert.equal(repaired,expected);
  for(let i=0;i<n.count;i++){
   const prior=new THREE.Vector3().fromBufferAttribute(old,i),after=new THREE.Vector3().fromBufferAttribute(n,i);
   if(usable(prior))assert.deepEqual(after,prior,'keep every authored valid normal exactly');
   else assert.ok(Math.abs(after.lengthSq()-1)<1e-6,'repaired normal is finite and unit length');
  }
  for(const [key,attribute]of Object.entries(before.attributes))if(key!=='normal')assert.deepEqual(geometry.attributes[key].array,attribute.array);
  assert.deepEqual(geometry.index?.array,before.index?.array,'do not change topology');
  const version=n.version;assert.equal(repairSceneryNormals(geometry),0);assert.equal(n.version,version,'valid geometry needs no new GPU upload');
  before.dispose();return repaired;
 }
 // Two opposite windings cancel their summed normals. A fourth, unused vertex
 // also needs a defined normal; a valid authored normal must not be resmoothed.
 const opposed=new THREE.BufferGeometry();
 opposed.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,2,2,2],3));
 opposed.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,0,NaN,0,0,0,1,0,0,0,0],3));
 opposed.setIndex([0,1,2,2,1,0]);check(opposed,3);
 assert.deepEqual(new THREE.Vector3().fromBufferAttribute(opposed.attributes.normal,0),new THREE.Vector3(0,0,1));
 opposed.dispose();
 const triangle=new THREE.BufferGeometry();
 triangle.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,0,0,1,1,0,0],3));
 triangle.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(9),3));
 check(triangle,3);assert.deepEqual([...triangle.attributes.normal.array],[0,1,0,0,1,0,0,1,0]);triangle.dispose();
 const summaries=[];
 for(const [name,expected]of [['planted-cliff',1342],['tropical-grove',20]]){
  const bytes=await readFile(new URL(`../public/waterslide/${name}.glb`,import.meta.url));
  const length=bytes.readUInt32LE(12),doc=JSON.parse(bytes.toString('utf8',20,20+length)),bin=bytes.subarray(28+length);
  const attribute=id=>{
   const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],width={SCALAR:1,VEC2:2,VEC3:3}[a.type];
   const Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array}[a.componentType];
   assert.equal(v.byteStride,undefined);
   const start=(v.byteOffset??0)+(a.byteOffset??0),data=bin.subarray(start,start+a.count*width*Type.BYTES_PER_ELEMENT);
   return new THREE.BufferAttribute(new Type(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)),width);
  };
  for(const [lod,mesh]of doc.meshes.entries())for(const p of mesh.primitives){
   const geometry=new THREE.BufferGeometry();
   for(const [source,key]of [['POSITION','position'],['NORMAL','normal'],['TEXCOORD_0','uv']])geometry.setAttribute(key,attribute(p.attributes[source]));
   geometry.setIndex(attribute(p.indices));
   summaries.push({name,lod,repaired:check(geometry,lod===0?expected:0)});geometry.dispose();
  }
 }
 console.log(JSON.stringify(summaries));
 console.log('PASS finite scenery normals, preserved authored normals/geometry/UVs, opposite-face fallback and no-op repeat loads.');
}finally{await server.close();}
