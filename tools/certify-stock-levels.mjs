// Explicit maintenance command. Never certify edited overrides or infer stock
// identity by rounded geometry. Only exact full exports qualify here.
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {compactPublishedLevels,levelSnapshotHash} from './release-levels.mjs';
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',
  server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
  const {BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
  const pack=JSON.parse(await readFile('public/levels.json','utf8'));
  const exact=compactPublishedLevels(pack,BUILTIN_LEVELS);
  const levels={};
  for(const id of exact.sourceBacked){
    const snapshot=pack.levels.find(e=>e.id===id);
    levels[id]={snapshotSha256:levelSnapshotHash(snapshot)};
  }
  const proof={v:2,authoringRuntime:process.version,sourceNumericTolerance:1e-9,sourceYawToleranceDegrees:1e-8,
    method:'Exact complete JSON equality at certification; unrounded saved-snapshot hash plus complete source-data comparison with bounded runtime-only roundoff at build time.',levels};
  await writeFile('tools/fixtures/stock-level-snapshots.json',JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({certified:exact.sourceBacked,retained:exact.pack.levels.map(e=>e.id)}));
}finally{await server.close();}
