// Select large adjacent drawing changes and record individually generated cels.
// This tool never generates, paints, blends or warps images.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const dir=resolve(root,'docs/fire-sprite-lab/v3');
const read=async name=>JSON.parse(await readFile(resolve(dir,name),'utf8'));
const write=async(name,value)=>writeFile(resolve(dir,name),JSON.stringify(value,null,2)+'\n');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const command=process.argv[2]||'plan';
if(command==='init'){
 try{await read('sequence.json');throw Error('Sequence already exists; retain the authored order.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const generation=await read('generation.json'),families={};
 for(const family of ['narrow','medium','broad']){
  const frames=[];
  for(let i=1;i<=12;i++){
   const file='public/fire-sprites/v2/'+family+'/'+String(i).padStart(2,'0')+'.png';
   frames.push({id:'key'+String(i).padStart(2,'0'),phase:i-1,file,sha256:hash(await readFile(resolve(root,file)))});
   if(i===1){const f=generation.frames.find(f=>f.family===family);f.id='t01';frames.push({id:f.id,phase:.5,file:f.file,sha256:f.sha256});}
  }
  families[family]=frames;
 }
 await write('generation.json',generation);
 await write('sequence.json',{targetFrames:36,fps:36,method:'Adaptively insert one separately generated drawing into the largest remaining adjacent pose change, including the seam.',families});
}else if(command==='insert'){
 const [family,id,source,prompt]=process.argv.slice(3),targets=await read('next.json'),target=targets[family];
 if(target.id!==id)throw Error('Stale generation target');
 const sequence=await read('sequence.json'),generation=await read('generation.json');
 if(sequence.families[family].length>=sequence.targetFrames)throw Error('Requested cycle is complete');
 if(sequence.families[family].some(f=>f.id===id))throw Error('Drawing already inserted');
 const file='art/fire-sprites/v3/'+family+'/'+id+'.png',bytes=await readFile(source);
 await copyFile(source,resolve(root,file));
 const record={family,id,file,source,sha256:hash(bytes),prompt,between:[target.left.id,target.right.id],
  references:await Promise.all([target.left,target.right].map(async f=>({file:f.file,sha256:hash(await readFile(resolve(root,f.file)))})))};
 generation.frames.push(record);await write('generation.json',generation);
 const frames=sequence.families[family],index=frames.findIndex(f=>f.id===target.left.id);
 frames.splice(index+1,0,{id,phase:target.phase,file,sha256:record.sha256});await write('sequence.json',sequence);
 console.log(file);
}else if(command==='replace'){
 const [family,id,source,prompt]=process.argv.slice(3);
 const sequence=await read('sequence.json'),generation=await read('generation.json');
 const entry=sequence.families[family].find(f=>f.id===id),record=generation.frames.find(f=>f.family===family&&f.id===id);
 if(!entry||!record)throw Error('Unknown drawing');
 const previous={...record},bytes=await readFile(source),sha256=hash(bytes);
 generation.rejected??=[];generation.rejected.push(previous);
 await copyFile(source,resolve(root,entry.file));
 Object.assign(entry,{sha256});Object.assign(record,{source,sha256,prompt,replaces:previous.sha256});
 await write('generation.json',generation);await write('sequence.json',sequence);console.log(entry.file);
}else if(command==='plan'){
 const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
 const sequence=await read('sequence.json');
 let cache;try{cache=await read('gap-metrics.json');}catch{cache={};}
 const next={};
 for(const [family,frames] of Object.entries(sequence.families)){
  const pixels=new Map();
  const get=async f=>{if(!pixels.has(f.id))pixels.set(f.id,await sharp(resolve(root,f.file)).toColourspace('srgb').ensureAlpha().raw().toBuffer());return pixels.get(f.id);};
  const gaps=[];
  for(let i=0;i<frames.length;i++){
   const a=frames[i],b=frames[(i+1)%frames.length],key=a.sha256+'_'+b.sha256;
   if(cache[key]===undefined){
    const aa=await get(a),bb=await get(b);
    if(aa.length!==bb.length)throw Error('Canvas changed: '+a.file+' / '+b.file);
    let d=0;
    for(let k=0;k<aa.length;k+=4){
     const ap=aa[k+3]<9?0:aa[k+3]/255,bp=bb[k+3]<9?0:bb[k+3]/255;
     d+=Math.abs(ap-bp);
     for(let c=0;c<3;c++)d+=Math.abs(aa[k+c]*ap-bb[k+c]*bp)/255;
    }
    cache[key]=d/aa.length;
   }
   gaps.push({left:a,right:b,difference:cache[key],phase:(a.phase+(i===frames.length-1?12:b.phase))/2});
  }
  // Cover the cycle before repeatedly subdividing one noisy transition.
  // Newly drawn cels can differ in colour as well as shape, so pixel distance
  // alone must not consume the entire drawing budget in one original interval.
  const density=g=>frames.filter(f=>f.id.startsWith('t')&&Math.floor(f.phase)===Math.floor(g.left.phase)).length;
  gaps.sort((a,b)=>b.difference/(1+.35*density(b))-a.difference/(1+.35*density(a)));
  const count=frames.filter(f=>f.id.startsWith('t')).length;
  next[family]=frames.length>=sequence.targetFrames?{complete:true,frameCount:frames.length}:{...gaps[0],id:'t'+String(count+1).padStart(2,'0'),frameCount:frames.length};
 }
 await write('gap-metrics.json',cache);await write('next.json',next);console.log(JSON.stringify(next));
}else throw Error('Unknown command');
