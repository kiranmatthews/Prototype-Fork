// Lossless storage packing only. Every decoded buffer view is byte-for-byte
// identical: no weld, quantization, remesh, distance swap or texture change.
import assert from 'node:assert/strict';
import {readFile,writeFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
export const NATIVE_GEOMETRY_FILES=[
 'country-club-art/oak.glb','map-landmarks/oak.glb',
 'drowned-crown/excellence/treasure-mound-bank.glb',
 'drowned-crown/excellence/treasure-mound-hero.glb',
 'drowned-crown/excellence/treasure-mound-shallow.glb',
 'drowned-crown/excellence/crash-mine-shell.glb',
 'drowned-crown/excellence/crash-cavern-canopy.glb',
 'drowned-crown/excellence/crash-exterior-ship.glb',
 'drowned-crown/excellence/crash-boardwalk-section.glb',
 'drowned-crown/excellence/crash-coastal-headland.glb',
 'drowned-crown/excellence/galleon-hull.glb',
 'drowned-crown/excellence/crash-galleon-painted.glb',
 'drowned-crown/excellence/headland.glb',
 'drowned-crown/excellence/cavern-buttress.glb',
 'drowned-crown/fitted-hull.glb',
 'waterslide/island-headland.glb',
 'treehouse-trials-v3/canopy-bough.glb',
 'map-landmarks/ship.glb',
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function parseNativeGlb(bytes){
 assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);
 assert.equal(bytes.readUInt32LE(8),bytes.length);const length=bytes.readUInt32LE(12);
 assert.equal(bytes.readUInt32LE(16),0x4e4f534a);assert.equal(bytes.readUInt32LE(24+length),0x004e4942);
 return {doc:JSON.parse(bytes.subarray(20,20+length)),binary:bytes.subarray(28+length)};
}
export async function packNativeGlb(original){
 await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
 const {doc,binary}=parseNativeGlb(original);
 if(doc.extensionsRequired?.includes('EXT_meshopt_compression'))return {bytes:original,views:0};
 assert.equal(doc.buffers.length,1);assert.equal(doc.buffers[0].uri,undefined);
 const components={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4},counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
 const indexViews=new Set(doc.meshes.flatMap(m=>m.primitives.filter(p=>p.indices!==undefined).map(p=>doc.accessors[p.indices].bufferView)));
 const chunks=[];let length=0,fallback=0,views=0;
 const append=data=>{const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}const offset=length;chunks.push(data);length+=data.length;return offset;};
 for(const [i,view] of doc.bufferViews.entries()){
  assert.equal(view.buffer,0);const source=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
  const accessors=doc.accessors.filter(a=>a.bufferView===i),first=accessors[0],indices=indexViews.has(i);
  const stride=view.byteStride??(first?components[first.componentType]*counts[first.type]:0);
  const eligible=accessors.length>0&&stride>0&&source.length%stride===0&&
   (indices?(stride===2||stride===4):(stride%4===0&&stride<=256));
  if(!eligible){view.byteOffset=append(source);continue;}
  const count=source.length/stride,mode=indices?'INDICES':'ATTRIBUTES';
  const encoded=Buffer.from(MeshoptEncoder.encodeGltfBuffer(source,count,stride,mode));
  if(encoded.length>=source.length){view.byteOffset=append(source);continue;}
  const decoded=new Uint8Array(source.length);
  MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,encoded,mode,'NONE');
  assert.ok(source.equals(decoded),'Native geometry byte changed');
  const offset=append(encoded);fallback=(fallback+3)&~3;
  view.buffer=1;view.byteOffset=fallback;fallback+=source.length;
  view.extensions={...view.extensions,EXT_meshopt_compression:{buffer:0,byteOffset:offset,byteLength:encoded.length,byteStride:stride,count,mode,filter:'NONE'}};
  views++;
 }
 if(!views)return {bytes:original,views:0};
 doc.buffers=[{byteLength:length},{byteLength:fallback,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 for(const key of ['extensionsUsed','extensionsRequired'])doc[key]=[...new Set([...(doc[key]??[]),'EXT_meshopt_compression'])];
 const json=Buffer.from(JSON.stringify(doc)),jsonPad=Buffer.alloc((4-json.length%4)%4,32),binPad=Buffer.alloc((4-length%4)%4);
 const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);
 header.writeUInt32LE(28+json.length+jsonPad.length+length+binPad.length,8);header.writeUInt32LE(json.length+jsonPad.length,12);header.writeUInt32LE(0x4e4f534a,16);
 binHeader.writeUInt32LE(length+binPad.length);binHeader.writeUInt32LE(0x004e4942,4);
 return {bytes:Buffer.concat([header,json,jsonPad,binHeader,...chunks,binPad]),views};
}
export async function prepareNativeGeometry({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 assert.ok(source!==output&&!output.startsWith(source+path.sep)&&!source.startsWith(output+path.sep),'Output overlaps source assets');
 const files=[];
 for(const file of NATIVE_GEOMETRY_FILES){
  const target=path.join(output,file);assert.equal(await realpath(target),target,'Unexpected asset symlink');
  const original=await readFile(target),packed=await packNativeGlb(original);
  if(packed.views){assert.ok(packed.bytes.length<original.length);await writeFile(target,packed.bytes);}
  files.push({file,sourceBytes:original.length,bytes:packed.bytes.length,sourceSha256:sha(original),sha256:sha(packed.bytes),verifiedViews:packed.views});
 }
 const evidence=Buffer.from(JSON.stringify({v:1,mode:'Lossless buffer packing; all decoded geometry bytes verified, textures unchanged',files})+'\n');
 await writeFile(path.join(output,'provenance/native-geometry.json'),evidence);
 return {files:files.length,savedBytes:files.reduce((n,f)=>n+f.sourceBytes-f.bytes,0)-evidence.length};
}
