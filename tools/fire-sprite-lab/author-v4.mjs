// Record individual built-in imagegen calls. This tool does not draw, resample,
// interpolate, align or change pixels. Phase is an authored timeline index.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=resolve(root,'docs/fire-sprite-lab/v4');
const path=resolve(dir,'generation.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
let record;try{record=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;record={tool:'built-in imagegen',status:'AUTHORING — candidates require motion review',fps:40,targetFrames:48,frames:[],rejected:[]};}
const [command,...args]=process.argv.slice(2);
if(command==='register'){
 const [family,id,phaseText,source,prompt,...references]=args,phase=Number(phaseText);
 if(!['narrow','medium','broad'].includes(family)||!/^k?\d{2}(?:-r\d+)?$/.test(id)||!Number.isInteger(phase)||phase<0||phase>=48)throw Error('Invalid drawing identity');
 if(record.frames.some(f=>f.family===family&&f.phase===phase))throw Error('Phase already recorded; preserve its original and explicitly reject before replacement');
 const bytes=await readFile(source),file=`art/fire-sprites/v4/${family}/${id}.png`;
 await mkdir(dirname(resolve(root,file)),{recursive:true});await copyFile(source,resolve(root,file));
 const neighbours=record.frames.filter(f=>f.family===family).sort((a,b)=>a.phase-b.phase);
 const previous=record.rejected.findLast(f=>f.family===family&&f.phase===phase&&resolve(root,f.file)===resolve(root,references[0]||''));
 const inherited=previous&&(previous.temporalNeighbours||(previous.references.length===2?previous.references.map(r=>r.file):undefined));
 const temporalNeighbours=references.length===1&&phase%8!==0?(inherited||[(neighbours.findLast(f=>f.phase<phase)||neighbours.at(-1)).file,(neighbours.find(f=>f.phase>phase)||neighbours[0]).file]):undefined;
 record.frames.push({family,id,phase,file,source,sha256:hash(bytes),prompt,references:await Promise.all(references.map(async file=>({file,sha256:hash(await readFile(resolve(root,file)))}))),...(temporalNeighbours?{temporalNeighbours}:{}),review:'candidate'});
 record.frames.sort((a,b)=>a.family.localeCompare(b.family)||a.phase-b.phase);
 await writeFile(path,JSON.stringify(record,null,2)+'\n');
 console.log(file);
}else if(command==='reject'){
 const [family,phaseText,...reason]=args,phase=Number(phaseText);
 const index=record.frames.findIndex(f=>f.family===family&&f.phase===phase);
 if(index<0)throw Error('Unknown drawing');
 const entry=record.frames.splice(index,1)[0];
 record.rejected.push({...entry,review:'rejected',reason:reason.join(' ')});
 await writeFile(path,JSON.stringify(record,null,2)+'\n');
 console.log('Preserved rejected original: '+entry.file);
}else if(command==='cycles'){
 for(const family of args.length?args:['narrow','medium','broad']){
  const frames=record.frames.filter(f=>f.family===family).sort((a,b)=>a.phase-b.phase);
  if(frames.length!==48||frames.some((f,i)=>f.phase!==i))throw Error('Finish all48 ordered cels before writing a final cycle: '+family);
  const manifest={id:family,fps:record.fps,frames:frames.map(f=>({file:'../../../'+f.file,phase:f.phase}))};
  await writeFile(resolve(dir,family+'-cycle.json'),JSON.stringify(manifest,null,2)+'\n');
 }
 console.log('Wrote explicit ordered review cycles; no art approval implied.');
}else if(command==='status'){
 console.log(JSON.stringify(Object.fromEntries(['narrow','medium','broad'].map(f=>[f,record.frames.filter(x=>x.family===f).map(x=>x.phase)]))));
}else throw Error('Use register, reject, cycles or status');
