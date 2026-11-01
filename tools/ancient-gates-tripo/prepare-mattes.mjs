// Format conversion only: preserve native dimensions and aspect ratio.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(process.env.ANCIENT_SHARP_PACKAGE||import.meta.url),sharp=require('sharp');
const prompts=JSON.parse(await readFile('tools/ancient-gates-tripo/references/matte-prompts.json','utf8'));
const records=[],definitions={},retainedLegacyImages=[];
await mkdir('tools/ancient-gates-tripo/references/previous-mattes',{recursive:true});
for(const [key,kind,sourceName,oldName,runtimeName] of [
 ['valley-matte','ancientgatevalley','valley-matte-v2','gate-valley','valley-panorama-v2'],
 ['hoard-matte','ancientgatehoard','hoard-matte-v2','gatekeeper-hoard','hoard-panorama-v2'],
]){
 const original=`tools/ancient-gates-tripo/references/${sourceName}.png`,runtime=`public/ancient-gates/${runtimeName}.webp`;
 const input=await readFile(original),meta=await sharp(input).metadata();
 const output=await sharp(input).webp({quality:86,effort:6}).toBuffer();
 const after=await sharp(output).metadata();
 if(after.width!==meta.width||after.height!==meta.height)throw Error('Matte pixels were resampled');
 await writeFile(runtime,output);
 const old=`public/ancient-gates/${oldName}.webp`,archived=`tools/ancient-gates-tripo/references/previous-mattes/${oldName}.webp`;
 try{await access(archived);}catch(error){if(error.code!=='ENOENT')throw error;await copyFile(old,archived);}
 // Retain the old scenery files too. Re-encode their storage without changing
 // dimensions; keep the exact original bytes in the authoring archive.
 const legacySource=await readFile(archived),legacy=await sharp(legacySource).webp({quality:78,effort:6}).toBuffer();
 await writeFile(old,legacy);
 retainedLegacyImages.push({runtime:old,original:archived,bytes:legacy.length,originalBytes:legacySource.length,conversion:'WebP quality 78, native dimensions retained'});
 definitions[kind]={file:'',image:`ancient-gates/${runtimeName}.webp`,label:kind==='ancientgatevalley'?'Ancient Gates · misty jungle valley':'Ancient Gates · shaded hoard ravine',
  size:[180*meta.width/meta.height,180,.02],wind:false,matte:true,edgeFade:.055,fog:false};
 records.push({prompt:prompts.prompts.find(p=>p.key===key).prompt,original,runtime,
  sourceSha256:createHash('sha256').update(input).digest('hex'),runtimeSha256:createHash('sha256').update(output).digest('hex'),
  bytes:output.length,width:meta.width,height:meta.height,conversion:'WebP quality 86, no resampling or creative edits'});
}
await writeFile('tools/ancient-gates-tripo/legacy-mattes.json',JSON.stringify(definitions,null,2)+'\n');
await writeFile('docs/ancient-gates/imagegen-prompts.json',JSON.stringify({mode:'built-in image_gen',intent:'generate',revision:'New distant mattes behind the preserved 3D scenery',assets:records,retainedLegacyImages,shippedImageBytes:records.reduce((n,r)=>n+r.bytes,0)},null,2)+'\n');
console.log(JSON.stringify(records.map(({runtime,bytes,width,height})=>({runtime,bytes,width,height}))));
