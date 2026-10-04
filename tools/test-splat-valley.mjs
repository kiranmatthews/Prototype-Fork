import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {splatValleyJourney} from './splat-valley-pilot.mjs';
import {runtimeAsset} from './offline-build.mjs';

await withBlockworksRuntime(async r=>{
  r.report={stage:'spawn',actions:[],evidence:[]};
  const {SPLAT_VALLEY_LEVEL:original}=await r.server.ssrLoadModule('/src/levels/splat-valley.ts');
  const {normalizeCustomLevelData:normalize}=await r.server.ssrLoadModule('/src/level.ts');
  assert.deepEqual(normalize(original).splatScenery,original.splatScenery);
  assert.deepEqual(r.l.captureData().splatScenery,original.splatScenery);
  for(const splatScenery of [
    {...original.splatScenery,asset:'https://example.invalid/world.spz'},
    {...original.splatScenery,scale:Infinity},{...original.splatScenery,scale:0},
    {...original.splatScenery,p:[0,NaN,0]},{...original.splatScenery,url:'other.spz'},
  ])assert.equal(normalize({...original,splatScenery}),null);
  assert.equal(original.components.filter(c=>c.t==='gate').length,1);
  for(const [variant,count] of [['150k',150000],['250k',250000]]){
    const file=`splat-scenery/valley-${variant}.spz`;
    assert.ok(runtimeAsset(file,{}));
    const data=gunzipSync(await readFile(new URL(`../public/${file}`,import.meta.url)));
    assert.equal(data.readUInt32LE(0),0x5053474e);assert.equal(data.readUInt32LE(4),2);
    assert.equal(data.readUInt32LE(8),count);assert.equal(data.length,16+19*count);
  }
  const p=r.p,die=p.die.bind(p);
  p.die=()=>{r.report.death={position:p.pos.toArray(),stack:new Error().stack,
    body:{min:p.playerBox.min.toArray(),max:p.playerBox.max.toArray()},
    pits:r.l.killBoxes.map(box=>({min:box.min.toArray(),max:box.max.toArray(),hit:box.intersectsBox(p.playerBox)}))};return die();};
  const pilot=splatValleyJourney(r);let next=pilot.next();
  try{while(!next.done){r.tick(next.value);next=pilot.next();}}
  catch(error){await writeFile('/private/tmp/splat-physics-failure.json',JSON.stringify({error:String(error),report:r.report,trace:r.trace},null,2));throw error;}
  await writeFile('/private/tmp/splat-physics-journey.json',JSON.stringify(next.value,null,2));
  console.log(JSON.stringify(next.value));
},{modulePath:'/src/levels/splat-valley.ts',levelId:'splat-valley',maxFrames:10000,
  source:module=>module.SPLAT_VALLEY_LEVEL});
