import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({server})=>{
  const api=await server.ssrLoadModule('/src/level.ts');
  const {upgradeKnownEdgeDefaults,edgeGrindingFingerprint}=await server.ssrLoadModule('/src/edgeGrindingMigration.ts');
  const legacy=JSON.parse(await readFile(new URL('./fixtures/edge-grinding-legacy-bonus.json',import.meta.url),'utf8'));
  const builtin=api.BUILTIN_LEVELS.find(e=>e.id===legacy.id),clone=value=>JSON.parse(JSON.stringify(value));
  assert.equal(upgradeKnownEdgeDefaults(legacy,builtin),builtin);
  for(const edit of [e=>e.data.components[0].p[0]+=.01,e=>e.data.components[0].color='#abcdef',
    e=>e.name='My course',e=>e.id='u-custom',e=>e.data.components[0].edgeGrinding=true]){
    const authored=clone(legacy);edit(authored);assert.equal(upgradeKnownEdgeDefaults(authored,builtin),null);
  }
  const reordered=clone(legacy);reordered.data=Object.fromEntries(Object.entries(reordered.data).reverse());
  assert.equal(edgeGrindingFingerprint(reordered.data),edgeGrindingFingerprint(legacy.data));
  assert.equal(upgradeKnownEdgeDefaults(reordered,builtin),builtin);
  assert.equal(api.setUserLevels([clone(legacy)]),true);
  assert.equal(api.findLevel(legacy.id),builtin,'an untouched cached default must advance');
  assert.equal(api.isOverridden(legacy.id),false);

  // A deliberate editor save can match the old defaults exactly. Preserve
  // that new choice, including across export/import and cache revalidation.
  api.saveUserLevel(clone(legacy));
  let edited=api.findLevel(legacy.id);
  assert.equal(edited.data.edgeGrindingRevision,1);
  assert.equal(api.isOverridden(legacy.id),true);
  assert.deepEqual(edited.data.components,legacy.data.components);
  const exported=JSON.stringify(api.getUserLevels());
  assert.equal(api.setUserLevels(JSON.parse(exported)),true);
  edited=api.findLevel(legacy.id);assert.deepEqual(edited.data.components,legacy.data.components);
  assert.equal(upgradeKnownEdgeDefaults(edited,builtin),null);
  for(const invalid of [0,2,'1',true])assert.equal(api.normalizeCustomLevelData({...legacy.data,edgeGrindingRevision:invalid}),null);
  api.restoreBuiltin(legacy.id);assert.equal(api.findLevel(legacy.id),builtin);

  let exact=1;
  if(process.env.EDGE_GRIND_BASELINE){
    const baseline=JSON.parse(await readFile(process.env.EDGE_GRIND_BASELINE,'utf8'));
    const metadata=JSON.parse(await readFile(new URL('../src/edgeGrindingSnapshots.json',import.meta.url),'utf8'));
    for(const entry of [...baseline.entries,...baseline.published]){
      const target=api.BUILTIN_LEVELS.find(e=>e.id===entry.id);if(!target)continue;
      const result=upgradeKnownEdgeDefaults(entry,target);
      const record=metadata.sources[entry.id],patch=metadata.patches[entry.id];
      if(record?.hashes.includes(edgeGrindingFingerprint(entry.data))){
        assert.equal(result,target);
        const normalized=api.normalizeUserLevelEntries([entry])?.[0];assert.ok(normalized);
        assert.equal(upgradeKnownEdgeDefaults(normalized,target),target,'registry title normalization must not mask the upgrade');exact++;
      }
      else if(patch?.hash===edgeGrindingFingerprint(entry.data)){
        const expected=clone(entry);for(const i of patch.clear)delete expected.data.components[i].edgeGrinding;
        assert.deepEqual(result,expected,'older published scenery must remain untouched');exact++;
      }else assert.equal(result,null);
    }
  }
  console.log(`PASS ${exact} exact legacy defaults; edited/renamed/copied levels and deliberately saved opt-outs survive import/export.`);
});
