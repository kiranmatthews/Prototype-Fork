// Runtime storage packing only: retain all vertex/index bytes and 2K colour atlases.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {parseTextureGlb,repackTextureGlb} from '../release-textures.mjs';
import {packNativeGlb} from '../release-native-geometry.mjs';
const require=createRequire(process.env.ANCIENT_SHARP_PACKAGE||import.meta.url),sharp=require('sharp');
const files=['tiki-gateway','canyon-buttress','tiki-support-pier','tiered-shrine','rooted-tropical-cluster'];
await mkdir('tools/ancient-gates-tripo/generated/runtime-originals',{recursive:true});
const evidence=[];
for(const name of files){
 const runtime='public/ancient-gates-tripo/'+name+'.glb',original='tools/ancient-gates-tripo/generated/runtime-originals/'+name+'.glb';
 try{await access(original);}catch{await copyFile(runtime,original);}
 const bytes=await readFile(original),source=parseTextureGlb(bytes),replacements=new Map(),textures=[];
 const baseImages=new Set(source.doc.materials.map(m=>m.pbrMetallicRoughness?.baseColorTexture?.index).filter(i=>i!==undefined).map(i=>source.doc.textures[i].source));
 for(const [i,img] of source.doc.images.entries()){
  const image=source.view(img.bufferView),meta=await sharp(image).metadata(),base=baseImages.has(i);
  const limit=base?2048:(i===2?1024:512);
  const encoded=await sharp(image).resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true}).webp({quality:base?80:92,effort:6}).toBuffer();
  const after=await sharp(encoded).metadata();if(base&&(after.width!==meta.width||after.height!==meta.height))throw Error('Colour atlas dimensions changed');
  if(encoded.length<image.length)replacements.set(i,encoded);
  textures.push({index:i,width:after.width,height:after.height,sourceWidth:meta.width,sourceHeight:meta.height,originalBytes:image.length,bytes:Math.min(image.length,encoded.length),encoding:encoded.length<image.length?base?'2K WebP quality 80':'WebP quality 92; normal 1K / ORM 512':img.mimeType});
 }
 const textured=repackTextureGlb(bytes,replacements),packed=await packNativeGlb(textured);await writeFile(runtime,packed.bytes);
 evidence.push({name,sourceBytes:bytes.length,bytes:packed.bytes.length,sourceSha256:createHash('sha256').update(bytes).digest('hex'),sha256:createHash('sha256').update(packed.bytes).digest('hex'),allDecodedGeometryBytesIdentical:true,verifiedGeometryViews:packed.views,textures});
 console.log(name,bytes.length,'→',packed.bytes.length);
}
await writeFile('docs/ancient-gates/tripo/storage-packing.json',JSON.stringify({nativeGeometry:'Every decoded buffer view verified byte-for-byte; no mesh reduction, quantization or LOD.',assets:evidence},null,2)+'\n');
