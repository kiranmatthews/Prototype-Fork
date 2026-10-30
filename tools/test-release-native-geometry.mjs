import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MeshoptDecoder} from 'meshoptimizer';
import {NATIVE_GEOMETRY_FILES,packNativeGlb,parseNativeGlb} from './release-native-geometry.mjs';
await MeshoptDecoder.ready;
let saved=0,views=0;
for(const file of NATIVE_GEOMETRY_FILES){
 const raw=await readFile('public/'+file),before=parseNativeGlb(raw),packed=await packNativeGlb(raw),after=parseNativeGlb(packed.bytes);
 assert.ok(packed.views>0);assert.ok(packed.bytes.length<raw.length);
 assert.deepEqual(await packNativeGlb(packed.bytes),{bytes:packed.bytes,views:0},'idempotent packing');
 for(const field of ['accessors','meshes','materials','images','textures','samplers','nodes','scenes','scene','skins','animations'])assert.equal(JSON.stringify(after.doc[field]),JSON.stringify(before.doc[field]),field+' changed');
 for(const [i,view] of before.doc.bufferViews.entries()){
  const original=before.binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength),next=after.doc.bufferViews[i],ext=next.extensions?.EXT_meshopt_compression;
  let decoded;
  if(ext){decoded=new Uint8Array(view.byteLength);MeshoptDecoder.decodeGltfBuffer(decoded,ext.count,ext.byteStride,after.binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter);}
  else decoded=after.binary.subarray(next.byteOffset,next.byteOffset+next.byteLength);
  assert.ok(original.equals(decoded),file+' changed buffer view '+i);views++;
 }
 saved+=raw.length-packed.bytes.length;
}
console.log('PASS native release packing: every geometry and image byte unchanged across',NATIVE_GEOMETRY_FILES.length,'models,',views,'views;',saved,'bytes saved');
