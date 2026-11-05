// Import measured public-domain USGS elevations, never the atlas imagery or
// its display material. Keep every native 0.625m sample and triangle. Meshopt
// is lossless here: no quantization, simplification or distance substitutes.
import * as THREE from 'three';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
const input=process.argv[2];if(!input)throw Error('Usage: node tools/desert-canyon/build-survey.mjs <detailed.glb>');
const bytes=await readFile(input),jsonLength=bytes.readUInt32LE(12),source=JSON.parse(bytes.subarray(20,20+jsonLength).toString()),bin=bytes.subarray(28+jsonLength);
const primitive=source.meshes[0].primitives[0];
function attribute(id){const a=source.accessors[id],view=source.bufferViews[a.bufferView],size={VEC3:3,VEC2:2,SCALAR:1}[a.type],Type=a.componentType===5126?Float32Array:Uint32Array;return new Type(bin.buffer.slice(bin.byteOffset+(view.byteOffset||0)+(a.byteOffset||0),bin.byteOffset+(view.byteOffset||0)+(a.byteOffset||0)+a.count*size*4));}
const position=attribute(primitive.attributes.POSITION),normal=attribute(primitive.attributes.NORMAL),indices=attribute(primitive.indices),uv=attribute(primitive.attributes.TEXCOORD_0);
const count=position.length/3,colour=new Float32Array(position.length);
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
for(let i=0;i<count;i++)for(let k=0;k<3;k++){min[k]=Math.min(min[k],position[i*3+k]);max[k]=Math.max(max[k],position[i*3+k]);}
for(let i=0;i<count;i++){
  const y=position[i*3+1],up=Math.max(0,normal[i*3+1]);
  const chalk=.18+.25*Math.max(0,Math.sin(y*.15))+.16*up;
  const c=new THREE.Color('#c88150').lerp(new THREE.Color('#edcf9f'),chalk);
  c.toArray(colour,i*3);
}
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const streams=[position,normal,uv,colour,indices],types=['VEC3','VEC3','VEC2','VEC3','SCALAR'],strides=[12,12,8,12,4],chunks=[],views=[],accessors=[];
let compressedOffset=0,rawOffset=0;
for(let i=0;i<streams.length;i++){
  const stream=streams[i],raw=new Uint8Array(stream.buffer),n=raw.length/strides[i],mode=i===4?'INDICES':'ATTRIBUTES';
  const encoded=MeshoptEncoder.encodeGltfBuffer(raw,n,strides[i],mode),decoded=new Uint8Array(raw.length);
  MeshoptDecoder.decodeGltfBuffer(decoded,n,strides[i],encoded,mode);assert.deepEqual(decoded,raw,'Lossless decode must match every byte');
  views.push({buffer:1,byteOffset:rawOffset,byteLength:raw.length,...(i<4?{byteStride:strides[i]}:{}),extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:compressedOffset,byteLength:encoded.length,byteStride:strides[i],count:n,mode,filter:'NONE'}}});
  const padded=Buffer.alloc(Math.ceil(encoded.length/4)*4);padded.set(encoded);chunks.push(padded);compressedOffset+=padded.length;rawOffset+=raw.length;
  accessors.push({bufferView:i,componentType:i===4?5125:5126,count:n,type:types[i],...(i===0?{min,max}:{})});
}
const binary=Buffer.concat(chunks),gltf={asset:{version:'2.0',generator:'USGS native elevation / authored Bryce mineral material'},extensionsUsed:['EXT_meshopt_compression'],extensionsRequired:['EXT_meshopt_compression'],buffers:[{byteLength:binary.length},{byteLength:rawOffset,extensions:{EXT_meshopt_compression:{fallback:true}}}],bufferViews:views,accessors,materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.94}}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2,COLOR_0:3},indices:4,material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
let json=Buffer.from(JSON.stringify(gltf));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const result=Buffer.alloc(28+json.length+binary.length);result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(json.length,12);result.writeUInt32LE(0x4e4f534a,16);json.copy(result,20);result.writeUInt32LE(binary.length,20+json.length);result.writeUInt32LE(0x004e4942,24+json.length);binary.copy(result,28+json.length);
await writeFile(new URL('../../public/desert-canyon/survey-rim.glb',import.meta.url),result);
const report={source:'https://brycecanyon.co/assets/landmark-collection/wall-street/detailed.glb.gz',sourceData:'USGS_LPC_UT_Southern_QL1_2018_LAS_2019',sourceRights:'US Government Public Domain; geometry only',sourceGlbSha256:createHash('sha256').update(bytes).digest('hex'),vertices:count,triangles:indices.length/3,nativeSpacingMetres:.625,localBounds:{min,max},size:max.map((x,i)=>x-min[i]),bytes:result.length,sha256:createHash('sha256').update(result).digest('hex'),verification:'All five buffers losslessly decoded and byte-compared; original positions, normals, UVs and index order retained. Only vertex color is authored.'};
await writeFile(new URL('../../public/desert-canyon/survey-manifest.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
