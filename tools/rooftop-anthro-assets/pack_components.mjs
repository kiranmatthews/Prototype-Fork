// Preserve exact native positions, oriented triangles and weights; bound shading precision.
import {createRequire} from 'node:module';import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const require=createRequire(process.env.ROOFTOP_GLTF_PACKAGE||'/private/tmp/rooftop-gltf-pack/package.json');
const {NodeIO}=require('@gltf-transform/core'),{ALL_EXTENSIONS,EXTMeshoptCompression}=require('@gltf-transform/extensions');
const {prune,reorder,quantize,textureCompress}=require('@gltf-transform/functions'),sharp=require('sharp'),{MeshoptEncoder,MeshoptDecoder}=require('meshoptimizer');
await Promise.all([MeshoptEncoder.ready,MeshoptDecoder.ready]);const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});
for(const name of process.argv.slice(2)){
 const file='public/rooftop-kook/'+name+'.glb',doc=await io.read(file);await doc.transform(prune({keepAttributes:true,keepLeaves:true}));
 const originals=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).map(p=>({p,indices:p.getIndices().getArray().slice(),attributes:new Map(p.listSemantics().map(s=>[s,{width:p.getAttribute(s).getElementSize(),array:p.getAttribute(s).getArray().slice()}]))}));
 for(const o of originals){const count=o.p.getAttribute('POSITION').getCount();o.p.setAttribute('_SOURCE_VERTEX',doc.createAccessor().setType('SCALAR').setBuffer(doc.getRoot().listBuffers()[0]).setArray(Uint32Array.from({length:count},(_,i)=>i)));}
 await doc.transform(reorder({encoder:MeshoptEncoder,target:'size'}));
 const key=(a,b,c)=>a<=b&&a<=c?`${a},${b},${c}`:b<=a&&b<=c?`${b},${c},${a}`:`${c},${a},${b}`;
 for(const o of originals){
  const ids=o.p.getAttribute('_SOURCE_VERTEX').getArray();
  for(const [semantic,source]of o.attributes){const a=o.p.getAttribute(semantic).getArray();for(let i=0;i<ids.length;i++)for(let k=0;k<source.width;k++)if(a[i*source.width+k]!==source.array[ids[i]*source.width+k])throw Error('Reorder changed '+semantic);}
  const expected=new Map();for(let i=0;i<o.indices.length;i+=3){const k=key(...o.indices.subarray(i,i+3));expected.set(k,(expected.get(k)||0)+1);}
  const a=o.p.getIndices().getArray();if(a.length!==o.indices.length)throw Error('Triangle count changed');
  for(let i=0;i<a.length;i+=3){const k=key(ids[a[i]],ids[a[i+1]],ids[a[i+2]]),n=expected.get(k);if(!n)throw Error('Oriented source triangle changed');if(n===1)expected.delete(k);else expected.set(k,n-1);}if(expected.size)throw Error('Missing triangles');
  const id=o.p.getAttribute('_SOURCE_VERTEX');o.p.setAttribute('_SOURCE_VERTEX',null);id.dispose();
 }
 // Quantize shading coordinates only; every position remains Float32 and exact.
 const shading=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).map(p=>({p,normal:p.getAttribute('NORMAL').getArray().slice(),uv:p.getAttribute('TEXCOORD_0').getArray().slice(),position:p.getAttribute('POSITION').getArray().slice()}));
 await doc.transform(quantize({pattern:/^(NORMAL|TEXCOORD_0)$/,quantizeNormal:12,quantizeTexcoord:16,normalizeWeights:false}));
 let maxNormalError=0,maxUvError=0;
 for(const s of shading){const p=s.p.getAttribute('POSITION').getArray();if(s.position.some((v,i)=>v!==p[i]))throw Error('Position quantized');
  for(const [semantic,old]of [['NORMAL',s.normal],['TEXCOORD_0',s.uv]]){const accessor=s.p.getAttribute(semantic),a=accessor.getArray();const divisor=a instanceof Int16Array?32767:a instanceof Uint16Array?65535:1;
   for(let i=0;i<a.length;i++){const error=Math.abs(a[i]/divisor-old[i]);if(semantic==='NORMAL')maxNormalError=Math.max(maxNormalError,error);else maxUvError=Math.max(maxUvError,error);}}
 }
 if(maxNormalError>.001||maxUvError>1/65535)throw Error('Shading precision exceeded');
 const indices=new Set(doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives().map(p=>p.getIndices())));
 const before=doc.getRoot().listAccessors().map(a=>({array:a.getArray().slice(),indices:indices.has(a)}));
 await doc.transform(textureCompress({encoder:sharp,targetFormat:'webp',quality:96,effort:100}));
 doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});
 const data=await io.writeBinary(doc),check=await io.readBinary(data),after=check.getRoot().listAccessors();
 if(before.length!==after.length)throw Error('Accessor count changed');
 before.forEach((a,i)=>{const b=after[i].getArray();if(a.array.length!==b.length)throw Error('Accessor length changed');
  if(a.indices){for(let j=0;j<b.length;j+=3)if(![0,1,2].some(o=>[0,1,2].every(k=>a.array[j+k]===b[j+(k+o)%3])))throw Error('Native triangle changed');}
  else if(a.array.some((v,j)=>v!==b[j]))throw Error('Native vertex/rig changed: '+i);
 });
 await writeFile(file,data);const manifest=JSON.parse(await readFile('public/rooftop-kook/'+name+'.json'));
 Object.assign(manifest,{bytes:data.length,sha256:createHash('sha256').update(data).digest('hex'),compression:'lossless position/topology meshopt, 12-bit normal and 16-bit UV encoding, native-resolution WebP 96 atlases',accessorsVerified:true,allOrientedSourceTrianglesVerified:true,vertexCacheReorderOnly:true,nativePositionsVerified:true,maxNormalComponentError:maxNormalError,maxUvError,originalNormalsUVsAndTextures:false});
 await writeFile('public/rooftop-kook/'+name+'.json',JSON.stringify(manifest,null,2)+'\n');console.log(name,data.length,manifest.triangles,'native triangles preserved');
}
