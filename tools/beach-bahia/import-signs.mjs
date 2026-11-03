// Budgeted Smart Mesh P2.0 web exports, byte-exact geometry compression; no decimation or LOD.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.BAHIA_GLTF_PACKAGE??new URL('../../package.json',import.meta.url));
const {NodeIO}=require('@gltf-transform/core'),{EXTMeshoptCompression,ALL_EXTENSIONS}=require('@gltf-transform/extensions');
const {MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
const budgets={'snack-sign':5000,'funville-marquee':8000,'pizza-slice':3000};
const tasks={'snack-sign':'b8b77c31-c9ef-434b-b49f-14ecb00e06b3','funville-marquee':'e6686d82-6293-448f-a3c1-6e24c747b097','pizza-slice':'a6469a72-166c-4770-80a3-7d8fd28cb946'};
for(const name of process.argv.slice(2)){
 const input=`${process.env.BAHIA_DOWNLOADS??`${process.env.HOME}/Downloads`}/bahia-${name}-smart.glb`,doc=await io.read(input);
 if(!budgets[name])throw Error('Unknown asset '+name);
 const indices=new Set(doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>p.getIndices())));
 const triangleCount=[...indices].reduce((n,a)=>n+a.getCount()/3,0);
 if(!Number.isInteger(triangleCount)||triangleCount<=0||triangleCount>budgets[name]||triangleCount>30000)throw Error(name+' exceeds its triangle budget: '+triangleCount);
 const originals=doc.getRoot().listAccessors().map(a=>({array:a.getArray().slice(),indices:indices.has(a)}));
 const images=doc.getRoot().listTextures().map(t=>Buffer.from(t.getImage()));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const encoded=await io.writeBinary(doc),loaded=await io.readBinary(encoded),after=loaded.getRoot().listAccessors();
 if(originals.length!==after.length)throw Error('Accessor count changed');
 originals.forEach((a,i)=>{const b=after[i].getArray();if(a.array.length!==b.length)throw Error('Accessor length changed');
  if(a.indices){for(let j=0;j<b.length;j+=3)if(![0,1,2].some(o=>[0,1,2].every(k=>a.array[j+k]===b[j+(k+o)%3])))throw Error('Triangle changed');}
  else if(a.array.some((v,j)=>v!==b[j]))throw Error('Vertex value changed');
 });
 if(loaded.getRoot().listTextures().some((t,i)=>!images[i].equals(Buffer.from(t.getImage()))))throw Error('Texture bytes changed');
 const file=`public/coastal-town/bahia-${name}.glb`;await writeFile(file,encoded);
 const manifest={name,source:'Tripo web app, Smart Mesh P2.0, Triangle; plan credits',taskId:tasks[name],credits:110,steps:{smartMesh:100,texture2K:10},textureResolution:2048,triangleBudget:budgets[name],reference:`docs/beach-bahia/concepts/${name==='pizza-slice'?'pizza-sign':name}-crash4.webp`,nativeSha256:createHash('sha256').update(await readFile(input)).digest('hex'),sha256:createHash('sha256').update(encoded).digest('hex'),bytes:encoded.length,vertices:originals[0].array.length/3,triangles:[...indices].reduce((n,a)=>n+a.getCount()/3,0),compression:'lossless EXT_meshopt_compression',allVertexValuesVerified:true,orientedTrianglesVerified:true,originalTextureBytesVerified:true};
 await writeFile(file.replace('.glb','.json'),JSON.stringify(manifest,null,2)+'\n');console.log(manifest);
}
