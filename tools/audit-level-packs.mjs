import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';await mkdir(out+'/snapshots',{recursive:true});
const git=(...a)=>execFileSync('git',a,{maxBuffer:192*1024*1024});
const revisions=git('log','--first-parent','--format=%H','origin/main','--','public/levels.json').toString().trim().split('\n');
const snapshots=new Map(),versions=[],errors=[],legacy=[];
for(const [i,revision] of revisions.entries()){
 let bytes;try{bytes=git('show',revision+':public/levels.json');}catch(e){errors.push({revision,error:'missing pack'});continue;}
 let pack;try{pack=JSON.parse(bytes);}catch{errors.push({revision,error:'invalid JSON'});continue;}
 const levels=Array.isArray(pack)?pack:pack.levels;
 if(!Array.isArray(levels)){
  if(pack&&typeof pack==='object'&&Object.keys(pack).every(key=>/^\d+$/.test(key))){
   const slots=Object.fromEntries(Object.entries(pack).map(([slot,data])=>[slot,{name:data.name,components:data.components?.length}]));
   legacy.push({revision,format:'pre-registry numeric slots',slots,rawBlob:git('rev-parse',revision+':public/levels.json').toString().trim()});
  }else errors.push({revision,error:'unrecognized pack format'});
  continue;
 }
 const entries=[];
 for(const entry of levels){
  if(!entry.data||!entry.id){errors.push({revision,id:entry.id,error:'missing id/data'});continue;}
  const json=JSON.stringify(entry),sha=createHash('sha256').update(json).digest('hex');
  let saved=snapshots.get(sha);
  if(!saved){saved={sha,id:entry.id,name:entry.name,components:entry.data.components?.length,bytes:json.length,revisions:[]};snapshots.set(sha,saved);await writeFile(out+'/snapshots/'+sha+'.json.gz',gzipSync(json));}
  saved.revisions.push(revision);entries.push({id:entry.id,sha});
 }
 versions.push({revision,bytes:bytes.length,entries});
 if(i%15===0)console.log(JSON.stringify({checked:i+1,total:revisions.length,unique:snapshots.size}));
}
await writeFile(out+'/pack-history.json',JSON.stringify({versions,snapshots:[...snapshots.values()],errors,legacy},null,2)+'\n');
console.log(JSON.stringify({complete:true,versions:versions.length,snapshots:snapshots.size,errors,legacy:legacy.length}));
