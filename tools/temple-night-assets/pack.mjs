import {readFile,writeFile,mkdir} from 'node:fs/promises';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)(process.env.TEMPLE_SHARP_MODULE || 'sharp');
const source='.img2threejs/temple-night-assets/tiki-head-source.glb',output='public/temple-night/tiki-head.glb';
const raw=await readFile(source),n=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+n)),bin=raw.subarray(28+n);
const replacements=new Map(),images=[];
for(const [i,img]of doc.images.entries()){
 const view=doc.bufferViews[img.bufferView],data=bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
 const isAlbedo=doc.materials.some(m=>doc.textures[m.pbrMetallicRoughness?.baseColorTexture?.index]?.source===i);
 const size=isAlbedo?2048:1024;
 const packed=await sharp(data).resize({width:size,height:size,fit:'inside',withoutEnlargement:true}).jpeg({quality:isAlbedo?90:88,chromaSubsampling:'4:4:4'}).toBuffer();
 replacements.set(img.bufferView,packed);img.mimeType='image/jpeg';images.push({index:i,size,bytes:packed.length});
}
const parts=[];let offset=0;
for(const [i,view]of doc.bufferViews.entries()){
 const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
 const bytes=replacements.get(i)??bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
 view.byteOffset=offset;view.byteLength=bytes.length;parts.push(bytes);offset+=bytes.length;
}
const pad=(4-offset%4)%4;if(pad){parts.push(Buffer.alloc(pad));offset+=pad;}
doc.buffers=[{byteLength:offset}];delete doc.extras;for(const m of doc.materials){delete m.extras;m.doubleSided=false;}
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+offset,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binaryHeader=Buffer.alloc(8);binaryHeader.writeUInt32LE(offset,0);binaryHeader.writeUInt32LE(0x004e4942,4);
const packed=Buffer.concat([header,json,binaryHeader,...parts]);await mkdir('public/temple-night',{recursive:true});await writeFile(output,packed);
const manifest={provider:'Meshy',taskId:'01a1332a-aca0-75aa-803b-31669bae593e',credits:15,reference:'tools/temple-night-assets/references/tiki-head.png',geometry:'Original generated geometry and UVs preserved; JPEG atlas encoding only.',sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),sha256:crypto.createHash('sha256').update(packed).digest('hex'),bytes:packed.length,images,triangles:doc.meshes.reduce((n,m)=>n+m.primitives.reduce((a,p)=>a+(p.indices===undefined?doc.accessors[p.attributes.POSITION].count:doc.accessors[p.indices].count)/3,0),0)};
await writeFile('public/temple-night/tiki-head-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(manifest);
