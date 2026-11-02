import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {parseNativeGlb} from './release-native-geometry.mjs';
import {textureDigest as hash} from './release-textures.mjs';
const root=path.resolve('dist'),baseline=process.argv[2]||'/private/tmp/top40-glb-textures/baseline.json';
const packedImages=new Set(JSON.parse(await readFile('release-images/manifest.json')).files.map(row=>row.file));
async function files(dir,prefix=''){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const name=prefix+e.name;if(e.isDirectory())result.push(...await files(path.join(dir,e.name),name+'/'));else if(e.isFile())result.push(name);}return result.sort();}
const entries=await files(root),images={},models={};let total=0;
for(const file of entries){
 const full=path.join(root,file);total+=(await stat(full)).size;
 if(file.endsWith('.glb')){
  const raw=await readFile(full),{doc,binary}=parseNativeGlb(raw);
  models[file]=[];
  for(const image of doc.images??[]){
   let bytes;if(image.uri){let target=path.resolve(path.dirname(full),image.uri);assert.ok(target.startsWith(root+path.sep));if(packedImages.has(path.relative(root,target)))target=target.slice(0,-4)+'.webp';bytes=await readFile(target);}
   else{const view=doc.bufferViews[image.bufferView];assert.equal(view.buffer,0);bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);}
   models[file].push({mimeType:image.mimeType,sha256:hash(bytes)});
  }
 }else if(/\.(png|jpe?g|webp|ktx2|svg)$/.test(file)&&!file.startsWith('__shared_textures/'))images[file]=hash(await readFile(full));
}
if(process.argv.includes('--record')){await writeFile(baseline,JSON.stringify({total,count:entries.length,images,models}));console.log('Recorded exact image payloads for',Object.keys(models).length,'models and',Object.keys(images).length,'standalone images');}
else{
 const before=JSON.parse(await readFile(baseline)),selection=JSON.parse(await readFile('tools/top40-glb-textures.json')),manifest=JSON.parse(await readFile('release-textures/top40/manifest.json'));
 assert.deepEqual(images,before.images,'Standalone image assets must remain identical');
 const changed=new Set(selection.models.map(m=>m.file)),removed=new Set([...selection.removed,'rooftop-kook/heirloom-shotgun.glb']);let untouched=0;
 for(const [file,old]of Object.entries(before.models)){
  if(removed.has(file)){assert.equal(models[file],undefined,'Retired model is still shipped');continue;}
  if(!changed.has(file)){assert.deepEqual(models[file],old,'Unselected model image changed: '+file);untouched++;}
 }
 for(const model of manifest.models)assert.deepEqual(models[model.file],model.images.map(image=>({mimeType:image.mimeType,sha256:image.sha256})),'Release must contain exactly the optimized image payloads: '+model.file);
 const report={beforeBytes:before.total,afterBytes:total,savedBytes:before.total-total,remainingBytes:1000000000-total,files:entries.length,selectedModels:changed.size,untouchedModels:untouched,unchangedStandaloneImages:Object.keys(images).length,removedModels:[...removed]};
 await writeFile('/private/tmp/top40-glb-textures/size-report.json',JSON.stringify(report,null,2)+'\n');console.log('PASS release scope',JSON.stringify(report));
}
