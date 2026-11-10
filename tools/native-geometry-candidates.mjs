// Report released GLBs that the lossless native-geometry stage does not cover
// yet, and what packing them would save. Read-only: nothing is written.
//
//   npm run build
//   node tools/native-geometry-candidates.mjs [dist]
//
// NATIVE_GEOMETRY_FILES is a pinned list, so models added after it was written
// ship unpacked until they are listed. Before listing a model, confirm that the
// loader requesting it calls `setMeshoptDecoder` (a packed GLB requires
// EXT_meshopt_compression), then run tools/test-release-native-geometry.mjs.
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {NATIVE_GEOMETRY_FILES,packNativeGlb} from './release-native-geometry.mjs';

const dist=path.resolve(process.argv[2]??'dist'),listed=new Set(NATIVE_GEOMETRY_FILES),files=[];
async function walk(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const target=path.join(directory,entry.name);
  if(entry.isDirectory())await walk(target);
  else if(entry.name.endsWith('.glb'))files.push(path.relative(dist,target).split(path.sep).join('/'));
 }
}
await walk(dist);
const rows=[];
for(const file of files.sort()){
 if(listed.has(file))continue;
 const original=await readFile(path.join(dist,file));
 try{const packed=await packNativeGlb(original);rows.push({file,before:original.length,after:packed.bytes.length,views:packed.views});}
 catch(error){rows.push({file,before:original.length,after:original.length,views:0,error:String(error.message)});}
}
const groups=new Map();
for(const row of rows){
 const parts=row.file.split('/'),key=parts.slice(0,Math.min(parts.length-1,parts[0]==='props'?2:parts.length>2?2:1)).join('/');
 const group=groups.get(key)??{files:0,packable:0,before:0,after:0,errors:0};
 group.files++;group.before+=row.before;group.after+=row.after;if(row.views)group.packable++;if(row.error)group.errors++;groups.set(key,group);
}
const mb=bytes=>(bytes/1e6).toFixed(1).padStart(9);
console.log(`released GLBs ${files.length}, listed ${listed.size}, unlisted ${rows.length}`);
console.log('directory'.padEnd(36),'files packable  beforeMB   afterMB   savedMB');
for(const [key,group] of [...groups].sort((a,b)=>(b[1].before-b[1].after)-(a[1].before-a[1].after))){
 if(group.before===group.after&&!group.errors)continue;
 console.log(key.padEnd(36),String(group.files).padStart(5),String(group.packable).padStart(8),mb(group.before),mb(group.after),mb(group.before-group.after),group.errors?`(${group.errors} unreadable)`:'');
}
const saved=rows.reduce((sum,row)=>sum+row.before-row.after,0);
console.log(`total available: ${(saved/1e6).toFixed(1)} MB across ${rows.filter(row=>row.views).length} models`);
if(process.argv.includes('--files'))for(const row of rows.filter(row=>row.views).sort((a,b)=>(b.before-b.after)-(a.before-a.after)))console.log(mb(row.before-row.after),row.file);
