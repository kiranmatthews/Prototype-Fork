import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {levelSnapshotHash} from './release-levels.mjs';
const compiled=await build({entryPoints:['src/levels/codex-lab.ts'],bundle:true,format:'esm',write:false});
const {ROOFTOP_RELAY_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const path='public/levels.json',pack=JSON.parse(await readFile(path,'utf8')),entry={id:'rooftop-relay',name:data.name,data};
const i=pack.levels.findIndex(e=>e.id===entry.id);if(i<0)pack.levels.push(entry);else pack.levels[i]=entry;
await writeFile(path,JSON.stringify(pack)+'\n');console.log(`Synced only Rooftop Relay: ${data.components.length} components.`);
// Certify this complete source export, including unrounded geometry. The
// release comparator can then tolerate platform-only trigonometric roundoff
// in its source counterpart without treating the stock level as an override.
const certificatePath='tools/fixtures/stock-level-snapshots.json';
const certificates=JSON.parse(await readFile(certificatePath,'utf8'));
certificates.levels[entry.id]={snapshotSha256:levelSnapshotHash(entry),authoringRuntime:process.version};
await writeFile(certificatePath,JSON.stringify(certificates,null,2)+'\n');
