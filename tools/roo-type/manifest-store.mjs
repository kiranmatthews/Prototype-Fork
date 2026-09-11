import fs from 'node:fs/promises';
export async function editRasterManifest(edit){
 const path=new URL('../../art/roo-reference-match/raster-v6/manifest.json',import.meta.url),lock=new URL(path.href+'.lock');
 let handle;
 for(let attempt=0;attempt<400;attempt++){
  try{handle=await fs.open(lock,'wx');break;}catch(error){if(error.code!=='EEXIST')throw error;await new Promise(resolve=>setTimeout(resolve,50));}
 }
 if(!handle)throw new Error('Timed out waiting to update the font manifest');
 const temporary=new URL(path.href+`.tmp-${process.pid}`);
 try{
  const manifest=JSON.parse(await fs.readFile(path,'utf8')),result=await edit(manifest);
  await fs.writeFile(temporary,JSON.stringify(manifest,null,2)+'\n');await fs.rename(temporary,path);return result;
 }finally{await handle.close();await fs.unlink(lock);await fs.rm(temporary,{force:true});}
}
