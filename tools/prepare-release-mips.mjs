import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseTextureGlb,trimKtxMipChain,imageRoles,textureDigest as hash} from './release-textures.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),review=process.argv.find(a=>a.startsWith('--review='))?.slice(9);
if(!review)throw Error('Provide a candidate --review directory; original art stays in public/');
const manifestPath=path.join(review,'manifest.json'),manifest=JSON.parse(await readFile(manifestPath)),models=new Map(manifest.models.map(m=>[m.file,m]));
const policy=JSON.parse(await readFile(path.join(root,'tools/release-texture-policy.json'))),profile=policy.blockworks;
let images=0,savedBytes=0;
for(const name of (await readdir(path.join(root,'public/blockworks-art'))).filter(f=>f.endsWith('.glb')).sort()){
 const file='blockworks-art/'+name,original=await readFile(path.join(root,'public',file)),n=original.readUInt32LE(12),doc=JSON.parse(original.subarray(20,20+n));
 if(!doc.images?.some(i=>i.mimeType==='image/ktx2'))continue;
 const glb=parseTextureGlb(original),mips=[];
 for(const [index,image]of glb.doc.images.entries()){
  if(image.mimeType!=='image/ktx2')continue;
  const roles=[...imageRoles(glb.doc,index)];if(roles.length!==1)throw Error('Review ambiguous texture roles: '+file);
  const maxSize=profile.overrides[file]?.[roles[0]]??profile.limits[roles[0]];
  if(!maxSize)throw Error('Review texture role: '+roles[0]);
  const source=glb.view(image.bufferView),trimmed=trimKtxMipChain(source,maxSize);if(!trimmed.removedLevels)continue;
  mips.push({index,role:roles[0],maxSize,sourceSha256:hash(source),sha256:hash(trimmed.data),width:trimmed.width,height:trimmed.height,levels:trimmed.levels,removedLevels:trimmed.removedLevels,sourceBytes:source.length,bytes:trimmed.data.length});images++;savedBytes+=source.length-trimmed.data.length;
 }
 if(mips.length){const model=models.get(file)??{file,sourceSha256:hash(original),images:[]};model.mips=mips;models.set(file,model);}
}
manifest.models=[...models.values()].sort((a,b)=>a.file.localeCompare(b.file));manifest.policy=policy;manifest.mipPolicy='Blockworks: existing Lanczos-4 UASTC levels at reviewed limits and close-up exceptions';
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({images,savedBytes,models:manifest.models.length}));
