import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const baseline=JSON.parse(await readFile(new URL('./fixtures/shore-field-baseline.json',import.meta.url),'utf8')).slipstream;
await withBlockworksRuntime(async r=>{
 const field=r.l.water.shoreField,data=field.texture.image.data;
 const actual={size:[field.texture.image.width,field.texture.image.height],bounds:field.bounds.toArray(),segments:field.segments,hasBed:field.hasBed,sha256:createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex')};
 assert.deepEqual(actual,baseline,'the actual Slipstream must retain every distance, direction and seabed texel');
 console.log(JSON.stringify({...actual,buildMs:r.l.water.stats.shoreFieldBuildMs}));
 console.log('PASS full Slipstream: all 4,194,304 half-float coast channels and field dimensions match the original production browser.');
},{modulePath:'/src/levels/slipstream.ts',levelId:'slipstream-race',source:m=>m.SLIPSTREAM_LEVEL});
