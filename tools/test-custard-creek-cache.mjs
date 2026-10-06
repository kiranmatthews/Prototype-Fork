import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';

const harness=await readFile(new URL('validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
try {
  const {BUILTIN_LEVELS,normalizeUserLevelEntries,isOriginalCustardCreek,setUserLevels,getUserLevels,levelList,isOverridden}=await server.ssrLoadModule('/src/level.ts');
  for(const [version,fixture,componentCount] of [
    ['04557f6 v1','custard-creek-carving-v1.ts',907],
    ['73aedc4 v2','custard-creek-coast-v2.ts',859],
    ['ba562b6 v3','custard-creek-independent-v3.ts',1132],
    ['5ac0b01 v4','custard-creek-sunset-v4.json.gz',4409],
  ]) {
    const oldData=fixture.endsWith('.gz')?JSON.parse(gunzipSync(await readFile(new URL('fixtures/'+fixture,import.meta.url)))):(await server.ssrLoadModule('/tools/fixtures/'+fixture)).CUSTARD_CREEK_LEVEL;
    const raw={id:'custard-creek',name:'Custard Creek',data:oldData};
    assert.ok(isOriginalCustardCreek(raw),version+': the exact published source is pristine');
    const pristine=normalizeUserLevelEntries([raw])?.[0];
    assert.ok(pristine,'the historical course remains importable');
    assert.ok(isOriginalCustardCreek(pristine),'parser migration retains pristine recognition');
    const builtin=BUILTIN_LEVELS.find(entry=>entry.id==='custard-creek');
    const actual=()=>levelList().find(entry=>entry.id==='custard-creek');
    assert.ok(setUserLevels([pristine]));
    assert.equal(actual(),builtin,'a pristine saved copy follows the redesigned source');
    assert.equal(isOverridden('custard-creek'),false,'editor restore state agrees with source selection');
    assert.equal(getUserLevels()[0].data.components.length,componentCount,'recognition never erases the stored historical copy');

    for(const edit of [
      entry=>{entry.data.components[0].p[0]+=.01;},
      entry=>{entry.name=entry.data.name='My Custard Creek';},
      entry=>{entry.data.components[0].nm='My creek ground';},
      entry=>{entry.data.spawn[0]+=.01;},
    ]) {
      const edited=structuredClone(pristine);edit(edited);
      assert.equal(isOriginalCustardCreek(edited),false,'an authored edit cannot match the pinned snapshot');
      assert.ok(setUserLevels([edited]));
      assert.equal(isOverridden('custard-creek'),true,'the editor continues to own a local edit');
      assert.deepEqual(actual().data,normalizeUserLevelEntries([edited])[0].data,'local geometry and naming win');
    }
    const mutable=structuredClone(pristine);
    assert.ok(isOriginalCustardCreek(mutable));
    mutable.data.components[0].p[0]+=.01;
    assert.equal(isOriginalCustardCreek(mutable),false,'mutable callers cannot reuse stale positive recognition');
    const shallowFrozen=structuredClone(pristine);Object.freeze(shallowFrozen.data);
    assert.ok(isOriginalCustardCreek(shallowFrozen));
    shallowFrozen.data.components[0].p[0]+=.01;
    assert.equal(isOriginalCustardCreek(shallowFrozen),false,'a shallow freeze cannot hide mutable child edits');
    assert.equal(isOriginalCustardCreek({...pristine,id:'my-creek'}),false,'custom identities never migrate');
    assert.equal(isOriginalCustardCreek({...pristine,name:'Custard Creek copy'}),false,'entry-only renames remain local');
  }
  const current=BUILTIN_LEVELS.find(entry=>entry.id==='custard-creek');
  assert.ok(isOriginalCustardCreek(current),'current detailed source snapshot follows the builtin');
  const edited=structuredClone(current);edited.data.components[0].p[0]+=.01;
  assert.equal(isOriginalCustardCreek(edited),false,'current sculpted edits remain authored');
  console.log('PASS Custard cache: exact raw/normalized v1, v2, v3, v4 and current published snapshots follow source; geometry, spawn, metadata, names and mutable edits remain local.');
} finally {await server.close();}
