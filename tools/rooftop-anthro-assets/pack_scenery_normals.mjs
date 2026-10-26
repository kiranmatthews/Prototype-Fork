// Make room for the full animal meshes by packing existing rooftop normal maps.
// No resize, no change to any geometry/UV/skin value or colour/roughness atlas.
import {createRequire} from 'node:module';import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const require=createRequire('/private/tmp/rooftop-gltf-pack/package.json'),{NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions'),{textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp'),{MeshoptDecoder,MeshoptEncoder}=require('meshoptimizer');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder,'meshopt.encoder':MeshoptEncoder});
await mkdir('.img2threejs/rooftop-anthro/scenery-before',{recursive:true});
for(const name of ['clubhouse','storm-veranda']){
 const file='public/rooftop-kook/'+name+'.glb';await copyFile(file,'.img2threejs/rooftop-anthro/scenery-before/'+name+'.glb');const doc=await io.read(file);
 const original=doc.getRoot().listAccessors().map(a=>a.getArray().slice());
 const normals=new Set(doc.getRoot().listMaterials().map(m=>m.getNormalTexture()).filter(Boolean)),unchanged=doc.getRoot().listTextures().filter(t=>!normals.has(t)).map(t=>[t,Buffer.from(t.getImage())]);
 const dimensions=await Promise.all([...normals].map(t=>sharp(t.getImage()).metadata().then(m=>[m.width,m.height])));
 await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',slots:/normalTexture/,quality:98,effort:100}));
 for(const [t,b]of unchanged)if(!b.equals(Buffer.from(t.getImage())))throw Error('Colour or roughness atlas changed');
 const afterDimensions=await Promise.all([...normals].map(t=>sharp(t.getImage()).metadata().then(m=>[m.width,m.height])));if(JSON.stringify(dimensions)!==JSON.stringify(afterDimensions))throw Error('Normal map resized');
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const encoded=await io.writeBinary(doc),check=await io.readBinary(encoded);const accessors=check.getRoot().listAccessors();
 if(original.length!==accessors.length||original.some((a,i)=>a.length!==accessors[i].getArray().length||a.some((v,j)=>v!==accessors[i].getArray()[j])))throw Error('Native geometry changed');
 await writeFile(file,encoded);const path='public/rooftop-kook/'+name+'.json',report=JSON.parse(await readFile(path));report.texturePacking=report.texturePacking.replace('original packed normal map','native-size WebP quality 98 normal map');Object.assign(report,{bytes:encoded.length,sha256:createHash('sha256').update(encoded).digest('hex'),normalMapPacking:'Native dimensions, WebP 98; all vertex values and colour/roughness atlas bytes verified unchanged'});await writeFile(path,JSON.stringify(report,null,2)+'\n');console.log(name,encoded.length);
}
