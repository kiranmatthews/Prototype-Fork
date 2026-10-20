type Entry={name:string;bytes:number;sha256:string;file?:string;inlineBase64?:string};
type Manifest={v:number;entries:Entry[]};
const safePath=(name:unknown):name is string=>typeof name==='string'&&name.length<=240&&name.split('/').every(part=>/^[a-zA-Z0-9 _.-]+$/.test(part)&&part!=='.'&&part!=='..');

/** Stream one existing member at a time into the download. Source members are
 * released between files; only ZIP output chunks accumulate for the Blob. */
export async function buildLevelAtlasArchive(base:URL,fetcher:typeof fetch=fetch,progress:(completed:number,total:number)=>void=()=>{}):Promise<Blob>{
 const response=await fetcher(new URL('level-atlas.manifest.json',base),{cache:'no-store'});
 if(!response.ok)throw Error('Atlas manifest unavailable');
 const manifest=await response.json() as Manifest;
 if(manifest.v!==1||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>1024)throw Error('Invalid atlas manifest');
 const names=new Set<string>();let total=0;
 for(const entry of manifest.entries){
  if(!safePath(entry.name)||names.has(entry.name)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>64*1048576||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error('Invalid atlas member');
  if(!(safePath(entry.file)&&entry.inlineBase64===undefined)&&!(entry.file===undefined&&typeof entry.inlineBase64==='string'&&entry.inlineBase64.length<131072))throw Error('Invalid atlas source');
  names.add(entry.name);total+=entry.bytes;
 }
 if(total>192*1048576)throw Error('Atlas export exceeds its memory budget');
 const {Zip,ZipPassThrough,ZipDeflate,AsyncZipDeflate}=await import('three/examples/jsm/libs/fflate.module.js');
 const chunks:Uint8Array<ArrayBuffer>[]=[];
 let failed:Error|null=null,resolve!:(blob:Blob)=>void,reject!:(error:Error)=>void;
 const finished=new Promise<Blob>((yes,no)=>{resolve=yes;reject=no;});
 // A compression failure may arrive while a member is still being awaited.
 void finished.catch(()=>{});
 const zip=new Zip((error,chunk,final)=>{
  if(error){failed=error;reject(error);return;}
  chunks.push(chunk.buffer instanceof ArrayBuffer?new Uint8Array(chunk.buffer,chunk.byteOffset,chunk.byteLength):new Uint8Array(chunk));
  if(final)resolve(new Blob(chunks,{type:'application/zip'}));
 });
 try{
  let completed=0;progress(0,total);
  for(const entry of manifest.entries){
   if(failed)throw failed;
   let bytes:Uint8Array<ArrayBuffer>;
   if(entry.file){
    const url=new URL(entry.file.split('/').map(encodeURIComponent).join('/'),base);
    url.searchParams.set('revision',entry.sha256);
    const asset=await fetcher(url);
    if(!asset.ok)throw Error('Atlas member unavailable');
    bytes=new Uint8Array(await asset.arrayBuffer());
   }else bytes=Uint8Array.from(atob(entry.inlineBase64!),c=>c.charCodeAt(0));
   if(bytes.length!==entry.bytes)throw Error('Incomplete atlas member: '+entry.name);
   if(globalThis.crypto?.subtle){
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    if(Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')!==entry.sha256)throw Error('Atlas member changed: '+entry.name);
   }
   // Already-compressed images, source snapshots and Sketch archives need no
   // second deflate. Compress text in a worker, never all 231 inputs at once.
   const TextZip=bytes.length>65536?AsyncZipDeflate:ZipDeflate;
   const file=/\.(?:json|svg|html|md|txt)$/i.test(entry.name)?new TextZip(entry.name,{level:6}):new ZipPassThrough(entry.name);
   file.mtime=new Date(2000,0,1);
   await new Promise<void>((yes,no)=>{
    zip.add(file);const output=file.ondata!;
    file.ondata=(error,data,final)=>{output(error,data,final);if(error)no(error);else if(final)yes();};
    file.push(bytes,true);
   });
   if(failed)throw failed;
   completed+=entry.bytes;progress(completed,total);
  }
  zip.end();return await finished;
 }catch(error){zip.terminate();chunks.length=0;throw error;}
}
