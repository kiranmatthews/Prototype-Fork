// Byte-exact geometry compression: no simplification, quantization or LODs.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.ROOFTOP_GLTF_PACKAGE||import.meta.url);
const {NodeIO}=require('@gltf-transform/core'),{EXTMeshoptCompression,ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp');
const {MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
for(const name of process.argv.slice(2)){
 const file='public/rooftop-kook/'+name+'.glb',doc=await io.read(file);
 const indices=new Set(doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>p.getIndices())));
 const originals=doc.getRoot().listAccessors().map(a=>({name:a.getName(),type:a.getType(),array:a.getArray().slice(),indices:indices.has(a)}));
 await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/baseColorTexture|metallicRoughnessTexture/,quality:94,effort:100}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const encoded=await io.writeBinary(doc),loaded=await io.readBinary(encoded);
 const after=loaded.getRoot().listAccessors();
 if(originals.length!==after.length)throw Error('Accessor count changed');
 originals.forEach((a,i)=>{const b=after[i].getArray();if(a.array.length!==b.length)throw Error('Accessor length changed');
  if(a.indices){for(let j=0;j<b.length;j+=3)if(![0,1,2].some(offset=>[0,1,2].every(k=>a.array[j+k]===b[j+(k+offset)%3])))throw Error('Triangle changed');}
  else if(a.array.some((v,j)=>v!==b[j]))throw Error(name+' geometry changed at accessor '+i);
 });
 await writeFile(file,encoded);
 const bytes=await readFile(file),manifest=JSON.parse(await readFile('public/rooftop-kook/'+name+'.json'));
 Object.assign(manifest,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),geometryCompression:'lossless EXT_meshopt_compression',allVertexAndSkinValuesVerified:true,orientedTrianglesVerified:true,texturePacking:(name==='heirloom-shotgun'?'2K base colour, 1K PBR':'4K base colour, 2K PBR')+'; WebP quality 94 colour/roughness, original packed normal map'});
 await writeFile('public/rooftop-kook/'+name+'.json',JSON.stringify(manifest,null,2)+'\n');console.log(name,bytes.length,'all geometry, skin and animation values identical');
}
