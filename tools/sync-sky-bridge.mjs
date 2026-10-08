import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let data;
try { data=(await server.ssrLoadModule('/src/levels/sky-bridge.ts')).SKY_BRIDGE_LEVEL; }
finally { await server.close(); }
const file=new URL('../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(file,'utf8'));
const entry={id:'sky',name:data.name,data},index=pack.levels.findIndex(l=>l.id==='sky');
if(process.argv.includes('--write')) {
  if(index<0)pack.levels.push(entry);else pack.levels[index]=entry;
  await writeFile(file,JSON.stringify(pack)+'\n');
} else if(index<0||JSON.stringify(pack.levels[index])!==JSON.stringify(entry))
  throw new Error('Sky Bridge snapshot differs; run with --write');
console.log(`Sky Bridge: ${data.components.length} components; source and published snapshot agree.`);
