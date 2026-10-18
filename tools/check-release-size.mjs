import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// A conservative decimal 1 GB budget for the existing GitHub Pages host.
export const RELEASE_BYTE_LIMIT=1_000_000_000;
export async function measureRelease(directory){
 const groups=new Map();let files=0,bytes=0;
 const visit=async(folder,prefix='')=>{
  for(const entry of await readdir(folder,{withFileTypes:true})){
   const name=prefix+entry.name,file=path.join(folder,entry.name);
   if(entry.isSymbolicLink())throw Error('Release contains a symbolic link: '+name);
   if(entry.isDirectory())await visit(file,name+'/');
   else if(entry.isFile()){
    const size=(await stat(file)).size,group=name.split('/')[0];
    files++;bytes+=size;groups.set(group,(groups.get(group)??0)+size);
   }else throw Error('Release contains an unsupported file: '+name);
  }
 };
 await visit(directory);
 if(!files)throw Error('Release output is empty');
 return{files,bytes,groups:[...groups].map(([name,bytes])=>({name,bytes})).sort((a,b)=>b.bytes-a.bytes||a.name.localeCompare(b.name))};
}

export function releaseWithinBudget(report,limit=RELEASE_BYTE_LIMIT){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid release byte limit');
 return report.bytes<=limit;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  const report=await measureRelease(path.resolve(process.argv[2]??'dist'));
  console.log(`Release output: ${report.files} files, ${report.bytes.toLocaleString('en-US')} bytes / ${RELEASE_BYTE_LIMIT.toLocaleString('en-US')} byte budget.`);
  if(!releaseWithinBudget(report)){
   console.error(`Release is ${(report.bytes-RELEASE_BYTE_LIMIT).toLocaleString('en-US')} bytes over budget. Reduce generated output before uploading to GitHub Pages.`);
   for(const group of report.groups.slice(0,8))console.error(`  ${(group.bytes/1048576).toFixed(1)} MiB  ${group.name}`);
   process.exitCode=1;
  }else console.log('PASS release fits the hosting budget.');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
