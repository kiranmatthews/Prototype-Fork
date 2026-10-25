import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {compactPublishedLevels,levelSnapshotHash} from '../release-levels.mjs';
import {physicalFingerprint} from './polish-invariants.mjs';
// Source-only synchronization avoids constructing unrelated scenery and a
// player. Real native contacts and browser rendering have separate audits.
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null},logLevel:'error'});
try{
 const registry=await server.ssrLoadModule('/src/level.ts');
 const {SLIPSTREAM_LEVEL:source}=await server.ssrLoadModule('/src/levels/slipstream.ts');
 const {slipstreamSnapshotKey}=await server.ssrLoadModule('/src/levels/slipstream-migration.ts');
 const {JUNGLE_ASSETS}=await server.ssrLoadModule('/src/jungleAssets.ts');
 const {WATERPARK_SKYLIGHTS}=await server.ssrLoadModule('/src/levels/slipstream-island.ts');
 assert.ok(registry.normalizeCustomLevelData(source));
 const physics=physicalFingerprint({...source,components:source.components.filter(c=>c.grp!==434)});
 assert.deepEqual(physics,JSON.parse(await readFile('docs/slipstream-polish/corrective/ride-physics-baseline.json','utf8')));
 assert.equal(source.components.filter(c=>JUNGLE_ASSETS[c.dkind]?.matte).length,0);
 const pack=JSON.parse(await readFile('public/levels.json','utf8')),entry=pack.levels.find(e=>e.id==='slipstream-race');
 assert.ok(entry);
 const retired=JSON.parse(await readFile('src/levels/slipstream-retired-snapshots.json','utf8'));
 const hashes=[entry.data,registry.normalizeCustomLevelData(entry.data)].filter(Boolean).map(slipstreamSnapshotKey);
 retired[entry.id].hashes=[...new Set([...retired[entry.id].hashes,...hashes])];
 entry.name=source.name;entry.data=JSON.parse(JSON.stringify(source));
 const exact=compactPublishedLevels({...pack,levels:[entry]},registry.BUILTIN_LEVELS.filter(e=>e.id===entry.id));
 assert.deepEqual(exact.sourceBacked,[entry.id]);
 const certificate=JSON.parse(await readFile('tools/fixtures/stock-level-snapshots.json','utf8'));
 certificate.levels[entry.id]={snapshotSha256:levelSnapshotHash(entry),authoringRuntime:process.version};
 await writeFile('public/levels.json',JSON.stringify(pack)+'\n');
 await writeFile('src/levels/slipstream-retired-snapshots.json',JSON.stringify(retired,null,2)+'\n');
 await writeFile('tools/fixtures/stock-level-snapshots.json',JSON.stringify(certificate,null,2)+'\n');
 const proof={physics,components:source.components.length,meshTriangles:source.components.reduce((n,c)=>n+(c.indices?.length??0)/3,0),rocks:source.components.filter(c=>c.grp===437).length,plants:source.components.filter(c=>c.grp===438).length,roofOpenings:WATERPARK_SKYLIGHTS.length,mattePlanes:0,snapshotSha256:certificate.levels[entry.id].snapshotSha256};
 await writeFile('docs/slipstream-polish/corrective/source-validation.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}finally{await server.close();}
