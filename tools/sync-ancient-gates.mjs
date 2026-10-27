import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {levelSnapshotHash} from './release-levels.mjs';
const compiled=await build({stdin:{contents:"export {JUNGLE_GATE_RUN_LEVEL} from './src/levels/ancient-gates-route'; export {ANCIENT_GATES_BONUS} from './src/levels/ancient-gates-bonus';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const path='public/levels.json',pack=JSON.parse(await readFile(path,'utf8'));
const certPath='tools/fixtures/stock-level-snapshots.json',certs=JSON.parse(await readFile(certPath,'utf8'));
for(const [id,data] of [['jungle-gate-run',m.JUNGLE_GATE_RUN_LEVEL],['bonus-jungle-gate',m.ANCIENT_GATES_BONUS]]){
 const entry={id,name:data.name,data},i=pack.levels.findIndex(e=>e.id===id);
 if(i<0)pack.levels.push(entry);else pack.levels[i]=entry;
 certs.levels[id]={snapshotSha256:levelSnapshotHash(entry),authoringRuntime:process.version};
 console.log(`Synced only ${id}: ${data.components.length} components`);
}
await writeFile(path,JSON.stringify(pack)+'\n');await writeFile(certPath,JSON.stringify(certs,null,2)+'\n');
