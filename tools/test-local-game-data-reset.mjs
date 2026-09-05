import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

class MemoryStorage {
  constructor(entries=[]){this.values=new Map(entries);}
  get length(){return this.values.size;}
  key(i){return [...this.values.keys()][i]??null;}
  getItem(k){return this.values.get(k)??null;}
  setItem(k,v){this.values.set(k,String(v));}
  removeItem(k){this.values.delete(k);}
}
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {resetLocalGameData,undoLocalGameReset}=await server.ssrLoadModule('/src/localGameDataReset.ts');
  const {readForkStudioDraft,isResettableGameKey,LOCAL_RESET_MARKER,LOCAL_RESET_RECEIPT}=await server.ssrLoadModule('/src/localGameStorage.ts');
  const fixture=()=>{
    const local=new MemoryStorage([
      ['solProtoTuning','old tuning'],['solProtoCampaignSavesV1','slot two'],
      ['solProtoUserLevels','custom levels'],['solProtoAnimationDraft:test','animation'],
      ['solProtoCharacterProportions.v1','old character'],['solProtoUnityOceanStudioV1','old water'],
      ['solProtoGHToken','test-token'],['originalProtoTuning','other project'],
      ['puffStudioV1','shared legacy'],['fieldStudioV1','shared field'],['unrelated','keep'],
    ]);
    const session=new MemoryStorage([['solProtoAutoUpdate','old build'],['unrelatedSession','keep']]);
    let drafts=[{id:'player',json:'draft JSON',updatedAt:1}],backup=null,cachesCleared=false;
    return {local,session,site:'https://example.invalid/Prototype-Fork/',
      drafts:{read:async()=>structuredClone(drafts),replace:async(v)=>{drafts=structuredClone(v);}},
      recovery:{read:async()=>backup,write:async(v)=>{backup=structuredClone(v);}},
      clearCaches:async()=>{cachesCleared=true;},get cachesCleared(){return cachesCleared;}};
  };
  const deps=fixture();
  const beforeLocal=[...deps.local.values],beforeSession=[...deps.session.values],beforeDrafts=await deps.drafts.read();
  assert.equal(readForkStudioDraft(deps.local,'solProtoPuffStudioV1','puffStudioV1'),'shared legacy');
  const receipt=await resetLocalGameData(deps);
  assert.equal(receipt.localKeys,6);assert.equal(receipt.sessionKeys,1);assert.equal(receipt.animationDrafts,1);
  for(const key of ['solProtoTuning','solProtoCampaignSavesV1','solProtoUserLevels','solProtoAnimationDraft:test'])assert.equal(deps.local.getItem(key),null);
  for(const [key,value] of beforeLocal.filter(([k])=>!isResettableGameKey(k)))assert.equal(deps.local.getItem(key),value);
  assert.equal(deps.local.getItem(LOCAL_RESET_MARKER),'1');
  assert.equal(deps.session.getItem('solProtoAutoUpdate'),null);assert.equal(deps.session.getItem('unrelatedSession'),'keep');
  assert.deepEqual(await deps.drafts.read(),[]);assert.equal(deps.cachesCleared,true);
  assert.equal(readForkStudioDraft(deps.local,'solProtoPuffStudioV1','puffStudioV1'),null,'reset must not resurrect shared legacy drafts');
  assert.ok(deps.session.getItem(LOCAL_RESET_RECEIPT));
  const backup=await deps.recovery.read();assert.ok(!backup.local.some(([k])=>k==='solProtoGHToken'));
  await undoLocalGameReset(deps);
  assert.deepEqual([...deps.local.values].sort(),beforeLocal.sort());
  assert.deepEqual([...deps.session.values].sort(),beforeSession.sort());assert.deepEqual(await deps.drafts.read(),beforeDrafts);
  const fail=fixture(),unchanged=[...fail.local.values];
  fail.recovery.write=async()=>{throw Error('quota');};
  await assert.rejects(resetLocalGameData(fail),/quota/);assert.deepEqual([...fail.local.values],unchanged,'backup failure must never delete data');
  assert.deepEqual(await fail.drafts.read(),beforeDrafts);
  const wrong=fixture();await resetLocalGameData(wrong);wrong.site='https://other.invalid/';
  await assert.rejects(undoLocalGameReset(wrong),/matching/);
  const broken=fixture();broken.clearCaches=async()=>{throw Error('cache unavailable');};
  await assert.rejects(resetLocalGameData(broken),/cache unavailable/);await undoLocalGameReset(broken);
  assert.equal(broken.local.getItem('solProtoCampaignSavesV1'),'slot two','partial failure must remain recoverable');
  const root=new URL('../',import.meta.url);
  const ui=await readFile(new URL('src/ui.ts',root),'utf8');assert.match(ui,/reset-local-game-data/);
  const html=await readFile(new URL('reset-local-data.html',root),'utf8');assert.match(html,/id="reset" disabled/);assert.match(html,/id="confirm-reset" type="checkbox"/);assert.match(html,/Undo last reset/);
  console.log('PASS scoped local data reset: settings/saves/drafts/session, foreign keys and token preservation, no legacy resurrection, durable undo, backup/partial-failure recovery, UI confirmation');
} finally {await server.close();}
