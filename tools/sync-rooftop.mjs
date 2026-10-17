import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const compiled=await build({entryPoints:['src/levels/codex-lab.ts'],bundle:true,format:'esm',write:false});
const {ROOFTOP_RELAY_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const path='public/levels.json',pack=JSON.parse(await readFile(path,'utf8')),entry={id:'rooftop-relay',name:data.name,data};
const i=pack.levels.findIndex(e=>e.id===entry.id);if(i<0)pack.levels.push(entry);else pack.levels[i]=entry;
await writeFile(path,JSON.stringify(pack)+'\n');console.log(`Synced only Rooftop Relay: ${data.components.length} components.`);
