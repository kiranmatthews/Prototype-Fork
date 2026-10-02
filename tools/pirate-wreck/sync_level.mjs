import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const {PIRATE_WRECK_LEVEL:data,PIRATE_WRECK_ID:id}=await server.ssrLoadModule('/src/levels/pirate-wreck.ts');await server.close();
const path=new URL('../../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(path,'utf8'));
pack.levels=[...pack.levels.filter(level=>level.id!==id),{id,name:data.name,data}];
await writeFile(path,JSON.stringify(pack)+'\n');console.log(`Synced ${id}: ${data.components.length} components`);
