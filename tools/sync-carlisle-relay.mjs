import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {CARLISLE_TIDAL_RELAY_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const path='public/levels.json',pack=JSON.parse(await readFile(path,'utf8'));
// Carlisle is a built-in source-owned level. Keeping its dense collision mesh
// in the editor snapshot archive duplicates the bundle and exceeds the bounded
// archive inspection budget. Remove only this ID; preserve all other snapshots.
pack.levels=pack.levels.filter(entry=>entry.id!=='carlisle-coast');
await writeFile(path,JSON.stringify(pack)+'\n');
const certificatePath='tools/fixtures/stock-level-snapshots.json',certificates=JSON.parse(await readFile(certificatePath,'utf8'));
delete certificates.levels['carlisle-coast'];
await writeFile(certificatePath,JSON.stringify(certificates,null,2)+'\n');
console.log(`Carlisle Coast stays source-owned: ${data.components.length} components; no duplicate editor snapshot.`);
