import {lstat,readdir,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {unzipSync} from 'three/examples/jsm/libs/fflate.module.js';
import path from 'node:path';

/** Historical font proofs remain in public/ for local authoring. A release
 * needs the exact versions selected by the game, including their export members. */
export function retiredFontAsset(file,versions){
 for(const palette of ['bonus','counter'])if(!Number.isInteger(versions[palette])||versions[palette]<1)throw Error('Invalid active font version: '+palette);
 const atlas=file.match(/^fonts\/roo-(bonus|counter)-v(\d+)(?:-light\d+)?(?:-cap(?:128|256))?\.(?:png|json)$/);
 if(atlas)return !Object.values(versions).includes(Number(atlas[2]));
 const archive=file.match(/^fonts\/roo-image-font-v(\d+)\.zip$/);
 return !!archive&&!Object.values(versions).includes(Number(archive[1]));
}

/** Vite has already copied public assets. Prune only generated output before
 * the offline manifest is assembled; never mutate the source asset library. */
export async function pruneRetiredFontAssets({root,outDir,fontVersions}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Release output overlaps source assets');
 const directory=path.join(output,'fonts');let directoryStat;
 try{directoryStat=await lstat(directory);}catch(error){if(error.code==='ENOENT')return{files:[],bytes:0};throw error;}
 if(!directoryStat.isDirectory()||directoryStat.isSymbolicLink())throw Error('Release fonts must be a real output directory');
 const files=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const url='fonts/'+entry.name;
  if(!entry.isFile()||!retiredFontAsset(url,fontVersions))continue;
  const file=path.join(directory,entry.name),stat=await lstat(file);
  await rm(file);files.push({url,bytes:stat.size});
 }
 files.sort((a,b)=>a.url.localeCompare(b.url));
 return{files,bytes:files.reduce((sum,file)=>sum+file.bytes,0)};
}

/** The current ZIP is an authoring source, not another hosted copy of each
 * atlas. Preserve its exact members in a small on-demand export manifest. */
export async function prepareFontArchives({root,outDir,fontVersions}){
 retiredFontAsset('',fontVersions);
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Release output overlaps source assets');
 const directory=path.join(output,'fonts');
 if(!(await lstat(directory)).isDirectory()||(await lstat(directory)).isSymbolicLink())throw Error('Release fonts must be a real output directory');
 const archives=[];
 for(const version of new Set(Object.values(fontVersions))){
  const name=`roo-image-font-v${version}`,archive=await readFile(path.join(source,'fonts',name+'.zip'));
  const members=unzipSync(archive),entries=[];
  for(const [name,data] of Object.entries(members)){
   if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name==='.'||name==='..')throw Error('Unexpected font archive path: '+name);
   const entry={name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
   let published;
   try{published=await readFile(path.join(directory,name));}catch(error){if(error.code!=='ENOENT')throw error;}
   if(published){
    if(!published.equals(Buffer.from(data)))throw Error('Font archive differs from published member: '+name);
    entry.file=name;
   }else{
    if(data.length>65536)throw Error('Font archive has a large unpublished member: '+name);
    entry.inlineBase64=Buffer.from(data).toString('base64');
   }
   entries.push(entry);
  }
  const manifest=JSON.stringify({v:1,version,entries},null,2)+'\n';
  await writeFile(path.join(directory,name+'.manifest.json'),manifest);
  await rm(path.join(directory,name+'.zip'),{force:true});
  archives.push({version,members:entries.length,removedBytes:archive.length,manifestBytes:Buffer.byteLength(manifest)});
 }
 return archives;
}
