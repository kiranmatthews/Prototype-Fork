import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const api=await r.server.ssrLoadModule('/src/level.ts');
 const campaign=await r.server.ssrLoadModule('/src/campaign.ts');
 const bonus=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const original=(await r.server.ssrLoadModule('/src/levels/slipstream-1.ts')).SLIPSTREAM_1_LEVEL;
 const stale={id:'slip',name:'The Slipstream',data:{...structuredClone(original),edgeGrindingRevision:1,medalTimes:{gold:160,silver:184,bronze:208}}};
 api.setUserLevels([stale]);
 const before=JSON.stringify(api.getUserLevels());
 const canonical=api.findLevel('slipstream-continuous');
 for(const id of ['slipstream-continuous','slip','slipstream-2','astra-chimeworks']){
  assert.equal(api.findLevel(id),canonical,'Every link must resolve the complete route, even with a stale edited first course');
  const level=new api.Level(new r.THREE.Scene(),{id,name:'ID-only entry'});
  assert.ok(level.spawnPos.y>276&&level.spawnPos.y<278,id);
  assert.equal(level.checkpoints.length,15,id);assert.equal(level.finishZ,-2570,id);
  assert.equal(level.isBossLevel,false,id);assert.equal(level.allowsBonus,false,id);
  assert.equal(level.bonusCrateTotal,0,id);assert.equal(level.bonusPlatformDiagnostics,null,id);
  assert.ok(level.crystalPickup,'The optional high-route crystal remains');level.dispose();
 }
 assert.equal(JSON.stringify(api.getUserLevels()),before,'Do not overwrite the saved first course');
 assert.deepEqual(api.findLevel('saved-slip').data,api.normalizeCustomLevelData(stale.data));
 assert.ok(!api.levelList().some(e=>['bonus-slipstream','bonus-chimeworks'].includes(e.id)));
 assert.ok(!bonus.BONUS_LEVEL_ENTRIES.some(e=>['bonus-slipstream','bonus-chimeworks'].includes(e.id)));
 for(const id of ['slipstream-continuous','slip','slipstream']){
  assert.equal(campaign.levelAllowsBonus(id),false);assert.equal(campaign.levelAllowsCrystal(id),true);assert.equal(bonus.bonusCrateCount(id),0);
 }
 const store=new campaign.CampaignStore();store.startEphemeral();store.commitClear('slipstream-continuous',{crystal:true,boxGem:true});
 assert.equal(store.levelProgress('slip').crystal,true);assert.equal(store.levelProgress('slipstream-continuous').boxGem,true);
 // Editing the new course intentionally remains supported under its new id.
 const authored={...canonical,data:structuredClone(canonical.data)};authored.data.components[0].color='#123456';api.setUserLevels([stale,authored]);
 assert.equal(api.findLevel('slip').data.components[0].color,'#123456');
 api.setUserLevels([stale]);
 const archive=api.findLevel('saved-slip');assert.equal(api.findLevel('saved-slip'),archive);
 api.saveUserLevel({...archive,data:structuredClone(archive.data)});
 assert.equal(api.levelList().filter(e=>e.id==='saved-slip').length,1);
 api.deleteUserLevel('saved-slip');assert.equal(api.findLevel('saved-slip'),null);
 assert.equal(api.findLevel('slip').id,'slipstream-continuous');
 api.setUserLevels([]);
 console.log('PASS four complete load paths, stale editor cache isolation, preserved archive, crystal awards and zero bonus detours');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-continuous'});
