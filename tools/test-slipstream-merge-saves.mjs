import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const m=await r.server.ssrLoadModule('/src/level.ts');
 const {ASTRA_CHIMEWORKS_LEVEL}=await r.server.ssrLoadModule('/src/levels/astra-chimeworks.ts');
 const saved=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/slipstream-before-merge.json.gz',import.meta.url))));
 saved.push({id:'astra-chimeworks',name:ASTRA_CHIMEWORKS_LEVEL.name,data:structuredClone(ASTRA_CHIMEWORKS_LEVEL)});
 const before=JSON.stringify(saved);
 assert.ok(m.setUserLevels(saved));
 assert.equal(m.findLevel('slip').data,r.source);
 assert.equal(m.findLevel('slipstream-2').id,'slip');
 assert.equal(m.findLevel('astra-chimeworks').id,'slip');
 assert.equal(m.isOverridden('slip'),false);
 assert.equal(m.levelList().filter(e=>['slip','slipstream-2','astra-chimeworks'].includes(e.id)).length,1);
 assert.equal(JSON.stringify(saved),before);
 for(const entry of saved) for(const edit of [e=>e.name+=' edit',e=>e.data.name+=' edit',
  e=>e.data.components[0].p[0]+=.001,e=>e.data.components[0].color='#123456',e=>e.data.cameraAirLift=.8]) {
  const copy=structuredClone(entry);edit(copy);
  assert.ok(m.setUserLevels([copy]));
  assert.equal(m.findLevel(copy.id).id,copy.id);
  assert.deepEqual(m.findLevel(copy.id).data,m.normalizeCustomLevelData(copy.data));
  if(copy.id==='slip')assert.equal(m.isOverridden('slip'),true);
 }
 m.setUserLevels([]);
 console.log('PASS exact stock saves merge; all 15 deliberate local edits survive; retired selections redirect without rewriting storage');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slip'});
