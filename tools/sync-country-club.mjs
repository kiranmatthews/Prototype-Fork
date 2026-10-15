import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'country-club-source-'));
try{
  const file=join(dir,'source.mjs');
  await build({entryPoints:['src/levels/country-club.ts'],bundle:true,format:'esm',outfile:file});
  const {COUNTRY_CLUB_LEVEL:data}=await import(pathToFileURL(file));
  const path='public/levels.json',pack=JSON.parse(await readFile(path,'utf8'));
  const entry={id:'country-club',name:data.name,data},index=pack.levels.findIndex(e=>e.id===entry.id);
  if(index<0)pack.levels.push(entry);else pack.levels[index]=entry;
  await writeFile(path,JSON.stringify(pack));
  console.log(`Synced ${entry.name}: ${data.components.length} components; no race payload.`);
}finally{await rm(dir,{recursive:true,force:true});}
