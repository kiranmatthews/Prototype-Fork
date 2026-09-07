import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
 const c=await server.ssrLoadModule('/src/campaign.ts');
 const targets=c.resolveMedalTimes('jungle');assert.deepEqual(targets,{gold:60,silver:69,bronze:78});
 assert.deepEqual(c.resolveMedalTimes('custom',{relicTime:80}),{gold:80,silver:92,bronze:104});
 const authored={gold:40,silver:55,bronze:90};assert.deepEqual(c.resolveMedalTimes('jungle',{relicTime:80,medalTimes:authored}),authored);
 const copy=c.resolveMedalTimes('jungle',{medalTimes:authored});copy.gold=1;assert.equal(authored.gold,40);
 for(const [time,tier]of [[60,'gold'],[60.001,'silver'],[69,'silver'],[69.001,'bronze'],[78,'bronze'],[78.001,null],[NaN,null],[Infinity,null],[0,null],[-1,null]])assert.equal(c.medalForTime(time,targets),tier);
 for(const value of [null,{}, {gold:0,silver:2,bronze:3},{gold:3,silver:2,bronze:4},{gold:1,silver:2,bronze:86401},{gold:'1',silver:2,bronze:3}])assert.equal(c.validMedalTimes(value),false);
 assert.equal(c.validMedalTimes(c.defaultMedalTimes(86400)),true);
 assert.deepEqual(c.editMedalTime(targets,'gold',90),{gold:90,silver:90,bronze:90});
 assert.deepEqual(c.editMedalTime(targets,'bronze',50),{gold:50,silver:50,bronze:50});
 assert.deepEqual(c.editMedalTime(targets,'silver',45),{gold:45,silver:45,bronze:78});
 const store=new c.CampaignStore();store.newGame(1);
 for(const [time,medal,expected]of [[75,'bronze','bronze'],[67,'silver','silver'],[76,'bronze','silver'],[59,'gold','gold'],[70,null,'gold']]) {
  store.commitTimeTrial('jungle',{time,medal});assert.equal(c.earnedTimeMedal(store.levelProgress('jungle')),expected);
  store.saveActive();const tierReload=new c.CampaignStore();tierReload.load(1);assert.equal(c.earnedTimeMedal(tierReload.levelProgress('jungle')),expected,'reload promoted/downgraded a medal through the legacy flag');
 }
 assert.equal(store.levelProgress('jungle').cleared,false,'trial medals unlocked the normal clear');
 store.commitTimeTrial('test',{time:NaN,medal:'gold'});assert.equal(c.earnedTimeMedal(store.levelProgress('test')),null);
 assert.equal(store.totals().relics,1,'tier upgrades counted as extra collectible milestones');
 store.saveActive();const reload=new c.CampaignStore();reload.load(1);assert.equal(c.earnedTimeMedal(reload.levelProgress('jungle')),'gold');
 // Simulate a pre-medal durable save, including a record slower than current targets.
 const slotKey='solProtoCampaignSavesV1';
 if(memory.has(slotKey)){const payload=JSON.parse(memory.get(slotKey));const save=payload[0];save.levels.jungle.timeRelic=true;delete save.levels.jungle.timeMedal;save.levels.jungle.bestTime=120;memory.set(slotKey,JSON.stringify(payload));const legacy=new c.CampaignStore();legacy.load(1);assert.equal(c.earnedTimeMedal(legacy.levelProgress('jungle')),'gold');}
 else throw Error('save fixture key not found');
 assert.equal(c.earnedTimeMedal({timeRelic:true}),'gold');
 for(const timeRelic of ['true','false',1,{},null])assert.equal(c.earnedTimeMedal({timeRelic}),null,'malformed legacy flag granted gold');
 const models=await server.ssrLoadModule('/src/timeMedalModel.ts');
 for(const tier of c.TIME_MEDALS){const model=models.createTimeMedal(tier),box=new THREE.Box3().setFromObject(model);assert.ok(!box.isEmpty());assert.equal(model.userData.timeMedal,tier);let meshes=0;model.traverse(o=>{if(o.isMesh){meshes++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));if(o.userData.medalMetal)assert.equal(o.material.color.getHex(),models.TIME_MEDAL_COLORS[tier]);}});assert.equal(meshes,2);models.setTimeMedalTier(model,'gold');model.traverse(o=>{if(o.isMesh){if(o.userData.medalMetal)assert.equal(o.material.color.getHex(),models.TIME_MEDAL_COLORS.gold);o.geometry.dispose();o.material.dispose()}})}
 console.log('PASS medal thresholds, inclusive awards, upgrades, legacy gold migration, saves, editor ordering and 3D tiers');
}finally{await server.close()}
