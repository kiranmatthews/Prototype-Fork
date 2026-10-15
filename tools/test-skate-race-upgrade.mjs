import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const old=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/slipstream-race-before-quality.json.gz',import.meta.url))));
await withBlockworksRuntime(async r=>{
 const registry=await r.server.ssrLoadModule('/src/level.ts');registry.setUserLevels([old]);
 const before=JSON.stringify(registry.getUserLevels()),current=registry.findLevel('slipstream-race');
 assert.ok(current.data.components.filter(c=>c.grp===400&&c.t==='mesh').every(c=>c.vert===false&&!c.gravityTrack));
 assert.equal(current.data.components.filter(c=>c.t==='crate'&&c.kind==='mystery').length,108);
 assert.equal(JSON.stringify(registry.getUserLevels()),before,'Stock adoption must not rewrite saved storage');
 const edited=structuredClone(old);edited.data.components.find(c=>c.t==='mesh').color='#415263';registry.setUserLevels([edited]);
 const custom=registry.findLevel('slipstream-race');assert.equal(custom.data.components.find(c=>c.t==='mesh').color,'#415263');
 assert.ok(custom.data.components.some(c=>c.grp===400&&c.gravityTrack),'An edited course must remain an authored copy');registry.setUserLevels([]);
 console.log('PASS exact shipped-race upgrade, untouched saved storage and preservation of edited courses');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
