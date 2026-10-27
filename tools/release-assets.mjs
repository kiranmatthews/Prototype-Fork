import {lstat,readdir,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Historical comparison galleries are authoring tools, not gameplay assets.
// Keep them available in public/ on the development server and mark their
// directory entries local-only; the Pages package has a fixed 1 GB budget.
export const LOCAL_REVIEW_DIRECTORIES = [
 'drowned-crown/storyboard', 'coastal-town/storyboard',
 'custard-creek/storyboard', 'sunny-beach/gallery', 'carlisle-bonus/review',
 'provenance/level-atlas',
];
export const LOCAL_REVIEW_FILES = [
 'carlisle-bonus/storyboard.html',
 // Superseded painting sources: the registries retain the alpha Treehouse
 // mattes, haunted sky-v2 and Custard pool-v4 / cliffs-v2 instead.
 'treehouse-trials/forest-depth.ktx2', 'treehouse-trials/forest-depth.webp',
 'treehouse-trials/coast-depth.ktx2', 'treehouse-trials/coast-depth.webp',
 'blockworks-art/sky.png',
 'custard-creek/waterfall-vista.webp', 'custard-creek/waterfall-vista-v3.webp',
 'custard-creek/waterfall-cliffs-cutout.webp',
];
export const localReviewAsset = file => LOCAL_REVIEW_FILES.includes(file) || LOCAL_REVIEW_DIRECTORIES.some(directory =>
 file === directory || file.startsWith(directory + '/'));

export async function pruneLocalReviewAssets({root,outDir}){
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Release output overlaps source assets');
 const files=[];
 const inspect=async(relative)=>{
  const file=path.join(output,relative),info=await lstat(file);
  if(info.isSymbolicLink())throw Error('Local review output cannot contain symbolic links');
  if(info.isDirectory())for(const entry of await readdir(file))await inspect(relative+'/'+entry);
  else if(info.isFile())files.push({url:relative,bytes:info.size});
  else throw Error('Unsupported local review output');
 };
 const directories=[];
 for(const relative of [...LOCAL_REVIEW_DIRECTORIES,...LOCAL_REVIEW_FILES]){
  try{await lstat(path.join(output,relative));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  let parent=output;
  const parts=relative.split('/');
  for(const [index,part] of parts.entries()){
   parent=path.join(parent,part);
   const info=await lstat(parent);
   const expectedFile=index===parts.length-1&&LOCAL_REVIEW_FILES.includes(relative);
   if(info.isSymbolicLink()||(expectedFile?!info.isFile():!info.isDirectory()))throw Error('Local review output must be a real directory or file');
  }
  await inspect(relative);directories.push(relative);
 }
 // Validate every target before removing any generated review directory.
 for(const relative of directories)await rm(path.join(output,relative),{recursive:true});
 files.sort((a,b)=>a.url.localeCompare(b.url));
 return{files,bytes:files.reduce((sum,file)=>sum+file.bytes,0)};
}

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
 const {unzipSync}=await import('three/examples/jsm/libs/fflate.module.js');
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

/** Keep the public atlas and its exact ZIP contents without a duplicate 55 MiB
 * archive. Its unmodified source HTML is embedded because the generated page
 * receives the download handler after this manifest is prepared. */
export async function prepareLevelAtlasArchive({root,outDir,clientFile}){
 const {unzipSync}=await import('three/examples/jsm/libs/fflate.module.js');
 const source=await realpath(path.join(root,'public')),output=await realpath(outDir);
 if(source===output||source.startsWith(output+path.sep)||output.startsWith(source+path.sep))throw Error('Release output overlaps source assets');
 const relative='provenance/level-atlas',directory=path.join(output,relative);
 for(const folder of [path.join(output,'provenance'),directory]){
  const info=await lstat(folder);
  if(!info.isDirectory()||info.isSymbolicLink())throw Error('Atlas must be a real output directory');
 }
 if(!/^assets\/[a-zA-Z0-9_.-]+\.js$/.test(clientFile))throw Error('Invalid atlas download client');
 const client=await lstat(path.join(output,clientFile));
 if(!client.isFile()||client.isSymbolicLink())throw Error('Atlas download client missing');
 const raw=await readFile(path.join(source,relative,'level-atlas.zip')),members=unzipSync(raw),entries=[];let rawSnapshotBytes=0;
 for(const [name,data] of Object.entries(members)){
  if(name.length>240||!name.split('/').every(part=>/^[a-zA-Z0-9 _.-]+$/.test(part)&&part!=='.'&&part!=='..'))throw Error('Unexpected atlas archive path: '+name);
  const entry={name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};
  if(name==='index.html'){
   if(data.length>65536)throw Error('Atlas source page is too large to inline');
   entry.inlineBase64=Buffer.from(data).toString('base64');
  }else{
   const published=await readFile(path.join(directory,name));
   if(!published.equals(Buffer.from(data)))throw Error('Atlas archive differs from published member: '+name);
   entry.file=name;
   if(name.endsWith('.gz')){
    // Static hosts may label .gz as Content-Encoding:gzip, which Fetch
    // automatically inflates. A raw binary copy preserves the ZIP member's
    // exact compressed bytes on every host, while the old URL stays valid.
    entry.file='export-'+entry.sha256+'.bin';rawSnapshotBytes+=data.length;
    const target=path.join(directory,entry.file);
    try{await writeFile(target,data,{flag:'wx'});}catch(error){
     if(error.code!=='EEXIST')throw error;
     const info=await lstat(target);
     if(!info.isFile()||info.isSymbolicLink()||!(await readFile(target)).equals(Buffer.from(data)))throw Error('Invalid existing atlas export member');
    }
   }
  }
  entries.push(entry);
 }
 if(!entries.length||entries.length>1024||entries.some(entry=>entry.bytes>64*1048576)||entries.reduce((sum,entry)=>sum+entry.bytes,0)>192*1048576)throw Error('Atlas archive exceeds the download budget');
 const manifest=JSON.stringify({v:1,entries},null,2)+'\n';
 await writeFile(path.join(directory,'level-atlas.manifest.json'),manifest);
 const html=(await readFile(path.join(source,relative,'index.html'),'utf8')).replace('</title>','</title><link rel="icon" href="data:,">');
 if(!html.includes('</body>')&&!html.includes('</html>'))throw Error('Atlas page is missing its document end');
 const boundary=html.includes('</body>')?'</body>':'</html>';
 const script=`<script type="module" src="${path.posix.relative(relative,clientFile)}"></script>`;
 await writeFile(path.join(directory,'index.html'),html.replace(boundary,script+boundary));
 await rm(path.join(directory,'level-atlas.zip'),{force:true});
 return{members:entries.length,removedBytes:raw.length,manifestBytes:Buffer.byteLength(manifest),rawSnapshotBytes,clientFile};
}
