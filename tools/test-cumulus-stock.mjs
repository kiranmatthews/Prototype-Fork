import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))};
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const api=await server.ssrLoadModule('/src/level.ts'),{migrateCrateLayout}=await server.ssrLoadModule('/src/crateDimensions.ts');
 const entries=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/cumulus-before-crate-refresh.json.gz',import.meta.url))));
 let saves=0,edits=0;
 for(const raw of entries){const migrated=structuredClone(raw);migrateCrateLayout(migrated.data);
  const builtin=api.BUILTIN_LEVELS.find(e=>e.id===raw.id);assert.ok(builtin);
  assert.equal(builtin.data.components.filter(c=>c.t==='crate').length,25);
  for(const entry of [raw,migrated]){
   assert.ok(api.setUserLevels([entry]));const stored=storage.get('solProtoUserLevels');
   assert.equal(api.findLevel(entry.id),builtin);assert.equal(api.isOverridden(entry.id),false);
   assert.equal(storage.get('solProtoUserLevels'),stored);assert.equal(api.getUserLevels()[0].data.components.length,raw.data.components.length);
   const working=api.getEditData(entry.id);assert.equal(working.crateLayoutRevision,1);assert.deepEqual(working,api.getEditData(entry.id));saves++;
   for(const edit of [e=>e.data.components[0].p[0]+=.01,e=>e.data.components[0].nm='My platform',e=>e.data.spawn[0]+=.01,e=>e.name='My clouds',e=>e.data.name='My clouds',e=>e.data.edgeGrindingRevision=1,e=>e.id='my-cloud-copy']){
    const authored=structuredClone(entry);edit(authored);assert.ok(api.setUserLevels([authored]));
    assert.deepEqual(api.findLevel(authored.id).data,api.getUserLevels()[0].data,'authored work remains authoritative');if(authored.id===raw.id)assert.ok(api.isOverridden(raw.id));edits++;
   }
  }
 }
 console.log(JSON.stringify({passed:true,priorSourceSnapshots:entries.length,rawAndMigratedSaves:saves,authoredVariants:edits,storedArchiveUnchanged:true,crateMigrationAppliedOnce:true}));
}finally{await server.close();}
