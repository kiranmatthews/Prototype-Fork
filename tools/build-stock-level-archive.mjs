// Inputs are the complete immutable Git/source audit, never a user's save.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';
const root=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';
const sources=JSON.parse(await readFile(root+'/source-history.json','utf8'));
const packs=JSON.parse(await readFile(root+'/pack-history.json','utf8'));
const runs=(await readFile(root+'/all-deployments.jsonl','utf8')).trim().split('\n').map(line=>JSON.parse(line));
assert.equal(sources.results.length,new Set(runs.filter(r=>r.conclusion==='success').map(r=>r.head_sha)).size,'Source audit is incomplete');
assert.ok(sources.results.every(r=>r.status!=='error'),'Source evaluation failed');
assert.deepEqual(packs.errors,[],'Published pack audit is incomplete');
globalThis.window={location:{search:'?lite'},addEventListener(){}};
globalThis.localStorage={getItem(){return null;},setItem(){}};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
  const api=await server.ssrLoadModule('/src/level.ts');
  const {edgeGrindingFingerprint:fingerprint}=await server.ssrLoadModule('/src/edgeGrindingMigration.ts');
  const {migrateCrateLayout}=await server.ssrLoadModule('/src/crateDimensions.ts');
  const levels={},proof=[];
  const add=(id,name,signature)=>{
    const titles=levels[id]??={};
    for(const title of new Set([name,api.cleanLevelName(name)])){
      const hashes=titles[title]??=new Set();hashes.add(signature);
    }
  };
  const index=(entry,provenance)=>{
    const raw=structuredClone(entry.data),crates=structuredClone(raw);migrateCrateLayout(crates);
    const variants=[raw,crates,api.migrateCustomLevel(structuredClone(raw),{crateLayout:false}),api.migrateCustomLevel(structuredClone(raw))];
    const signatures=[...new Set(variants.map(fingerprint))];
    for(const signature of signatures)add(entry.id,entry.name,signature);
    proof.push({id:entry.id,...provenance,signatures});
  };
  for(const [directory,records]of [['source-snapshots',sources.snapshots],['snapshots',packs.snapshots]]){
    for(const [at,record]of records.entries()){
      const entry=JSON.parse(gunzipSync(await readFile(`${root}/${directory}/${record.sha}.json.gz`)));
      index(entry,{kind:directory,sha:record.sha,revisions:record.revisions});
      if(at%50===0)console.log(`${directory}: ${at+1}/${records.length}`);
    }
  }
  for(const entry of api.BUILTIN_LEVELS)if(entry.data)index(JSON.parse(JSON.stringify(entry)),{kind:'candidate'});
  // Prior native-builder captures were already reviewed with complete hashes.
  const edges=JSON.parse(await readFile('src/edgeGrindingSnapshots.json','utf8'));
  for(const [id,source]of Object.entries(edges.sources))for(const signature of source.hashes)add(id,source.name,signature);
  const sorted=Object.fromEntries(Object.keys(levels).sort().map(id=>[id,Object.fromEntries(Object.keys(levels[id]).sort().map(name=>[name,[...levels[id][name]].sort()]))]));
  await writeFile('src/stockLevelArchive.json',JSON.stringify({v:1,levels:sorted},null,2)+'\n');
  await writeFile(root+'/stock-archive-provenance.json',JSON.stringify({sources:sources.results.length,packVersions:packs.versions.length+packs.legacy.length,proof},null,2)+'\n');
  console.log(JSON.stringify({levels:Object.keys(levels).length,snapshots:proof.length,signatures:Object.values(sorted).reduce((n,names)=>n+Object.values(names).reduce((a,b)=>a+b.length,0),0)}));
}finally{await server.close();}
