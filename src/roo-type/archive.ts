type ArchiveEntry={name:string;bytes:number;sha256:string;file?:string;inlineBase64?:string};

/** Reassemble the original export members from the atlases already hosted by
 * the studio. Fetch sequentially and create one ZIP, only after a user click. */
export async function buildRooFontArchive(fonts:URL,version:number,fetcher:typeof fetch=fetch):Promise<Blob>{
 const response=await fetcher(new URL(`roo-image-font-v${version}.manifest.json`,fonts));
 if(!response.ok)throw Error('Font archive manifest unavailable');
 const manifest=await response.json() as {v:number;version:number;entries:ArchiveEntry[]};
 if(manifest.v!==1||manifest.version!==version||!Array.isArray(manifest.entries)||!manifest.entries.length||manifest.entries.length>64)throw Error('Invalid font archive manifest');
 const files:Record<string,Uint8Array>=Object.create(null);
 for(const entry of manifest.entries){
  if(!/^[a-zA-Z0-9_.-]+$/.test(entry.name)||entry.name==='.'||entry.name==='..'||Object.prototype.hasOwnProperty.call(files,entry.name)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||entry.bytes>64*1048576||!/^[0-9a-f]{64}$/.test(entry.sha256))throw Error('Invalid font archive member');
  let bytes:Uint8Array<ArrayBuffer>;
  if(entry.file===entry.name&&entry.inlineBase64===undefined){
   const asset=await fetcher(new URL(entry.file,fonts));
   if(!asset.ok)throw Error('Font archive member unavailable');
   bytes=new Uint8Array(await asset.arrayBuffer());
  }else if(entry.file===undefined&&typeof entry.inlineBase64==='string')bytes=Uint8Array.from(atob(entry.inlineBase64),c=>c.charCodeAt(0));
  else throw Error('Invalid font archive source');
  if(bytes.length!==entry.bytes)throw Error('Incomplete font archive member');
  // Web Crypto is available on Pages and localhost. Plain-HTTP LAN previews
  // still retain length checks and ZIP CRCs without requiring a secure origin.
  if(globalThis.crypto?.subtle){
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   const hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
   if(hash!==entry.sha256)throw Error('Font archive member changed');
  }
  files[entry.name]=bytes;
 }
 const {zip}=await import('three/examples/jsm/libs/fflate.module.js');
 const bytes=await new Promise<Uint8Array>((resolve,reject)=>zip(files,{level:0},(error,data)=>error?reject(error):resolve(data)));
 const data=bytes.buffer instanceof ArrayBuffer?new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength):new Uint8Array(bytes);
 return new Blob([data],{type:'application/zip'});
}
