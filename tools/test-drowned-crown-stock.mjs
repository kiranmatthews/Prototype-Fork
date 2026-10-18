import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';

// Exact published early tunnel, extracted from 235991c5:public/levels.json.
// Its normal clock/material migrations match the stale browser copy reported
// on 19 October. No download or Git history is required to run this fixture.
const legacy=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/drowned-crown-stock.json.gz',import.meta.url))));
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
globalThis.window={location:{search:'?lite'},addEventListener(){}};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const api=await server.ssrLoadModule('/src/level.ts');
 const builtin=api.BUILTIN_LEVELS.find(entry=>entry.id==='drowned-crown');
 const normalized=api.normalizeUserLevelEntries([legacy])[0];
 assert.equal(normalized.data.components.length,1641);
 assert.ok(builtin.data.components.some(c=>c.dkind==='crowncrashboardwalk'));
 assert.ok(builtin.data.components.some(c=>c.dkind==='crowncrashexteriorship'));
 for(const entry of [legacy,normalized,{...normalized,data:Object.fromEntries(Object.entries(normalized.data).reverse())}]){
  assert.equal(api.setUserLevels([entry]),true);
  const before=JSON.stringify(api.getUserLevels()),saved=storage.get('solProtoUserLevels');
  assert.equal(api.findLevel(entry.id),builtin,'unchanged early snapshot must follow the current source');
  assert.equal(api.isOverridden(entry.id),false);
  assert.equal(JSON.stringify(api.getUserLevels()),before,'lookup must keep recoverable old data');
  assert.equal(storage.get('solProtoUserLevels'),saved,'lookup must not rewrite browser storage');
 }
 for(const change of [e=>e.data.spawn[0]+=.01,e=>e.data.components[0].vertices[0]+=.01,
  e=>e.data.components[0].color='#abcdef',e=>e.data.atmosphere.sunIntensity+=.01,
  e=>e.data.components[0].edgeGrinding=true,e=>e.name='My Drowned Crown',
  e=>e.data.name='My Drowned Crown',e=>e.id='u-crown-copy',e=>e.data.edgeGrindingRevision=1]){
  const edited=structuredClone(legacy);change(edited);
  assert.equal(api.setUserLevels([edited]),true);
  assert.deepEqual(api.findLevel(edited.id).data,api.getUserLevels()[0].data,'authored copy must remain exact');
  if(edited.id==='drowned-crown')assert.equal(api.isOverridden(edited.id),true);
 }
 api.saveUserLevel(structuredClone(legacy));
 assert.equal(api.findLevel(legacy.id).data.edgeGrindingRevision,1,'explicit editor save must opt out of stock migration');
 assert.equal(api.findLevel(legacy.id).data.components.length,1641);
 console.log('PASS old stock follows the full harbour; 9 authored variants and explicit editor saves stay intact; no stored data is rewritten.');
}finally{await server.close();}
