import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const api=await server.ssrLoadModule('/src/level.ts');
 const campaign=await server.ssrLoadModule('/src/campaign.ts');
 const bonuses=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 assert.equal(bonuses.resolveBonusLevel('secret-1').name,'Bonus: Cloudtop Lockers');
 assert.equal(bonuses.resolveBonusLevel('secret-2').name,'Bonus: Ember Reliquary');
 const rows=campaign.CAMPAIGN_LEVELS.filter(l=>l.islandId==='hidden-shores');
 assert.deepEqual(rows.slice(0,5).map(l=>[l.levelId,l.name,l.secretRequirement]),[
  ['sky','Sky Bridge','medals-5'],['jungle-terraces','Temple of Embers','gems-5'],['jungle-gate-run','The Ancient Gates','medals-10'],
  ['rolling-bones','Rolling Bones','gems-15'],['skystream','The Skystream','medals-20']]);
 assert.ok(rows.slice(0,5).every(l=>!l.placeholder&&!l.boss));
 assert.deepEqual([rows[5].levelId,rows[5].name,rows[5].secretRequirement],['coconut-cart-rally','Coconut Cart Rally','main-medals']);
 assert.ok(rows[5].skateRace&&!rows[5].placeholder&&!rows[5].boss);
 assert.equal(campaign.levelAllowsCrystal(rows[5].levelId),false);
 assert.equal(campaign.levelAllowsBonus(rows[5].levelId),false);
 assert.equal(api.findLevel(rows[5].levelId).data.skateRace.vehicle,'golf-cart');
 await access(new URL('../public/level-previews/coconut-cart-rally.jpg',import.meta.url));
 assert.ok(rows.slice(6).every(l=>l.placeholder));
 for(const row of rows.slice(0,5)){
  const entry=api.findLevel(row.levelId);
  assert.ok(entry?.data,row.name+' has no actual course');
  assert.equal(campaign.levelAllowsCrystal(row.levelId),false);
  assert.equal(campaign.levelAllowsCrystal(row.progressKey),false);
  assert.equal(campaign.levelAllowsBonus(row.levelId),true,'Secret gems still include bonus boxes');
  // Include a stale editor crystal to prove both authored and automatically
  // placed crystals obey the campaign rule, even with a saved level override.
  const level=new api.Level(new THREE.Scene(),{...entry,data:{...entry.data,components:[...entry.data.components,{t:'crystal',p:entry.data.spawn}]}});
  assert.equal(level.crystalPickup,null,row.name+' still creates a crystal');
  assert.equal(level.isBossLevel,false,row.name+' was accidentally treated as a boss');
  assert.ok(level.bonusPlatform,row.name+' lost its bonus');
  assert.ok(level.clockPickup,row.name+' lost its time trial');
  assert.ok(level.groundMeshes.some(mesh=>mesh.userData.finishPad),row.name+' lost its finish pad');
  level.setCommittedCollectibles({crystal:true,boxGem:true});
  assert.deepEqual(level.committedCollectibleDiagnostics,{crystal:false,boxGem:true});
  level.dispose();
  await access(new URL(`../public/level-previews/${row.previewKey}.jpg`,import.meta.url));
 }
 const data={v:1,name:'The Descent',spawn:[0,1,0],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[10,1,10]},{t:'gate',p:[0,0,-4]}]};
 assert.equal(api.findLevel('descent'),null);
 api.setUserLevels([{id:'descent',name:'The Descent',data},{id:'bonus-descent',name:'Bonus Descent',data}]);
 assert.equal(api.findLevel('descent'),null,'saved override resurrected the deleted course');
 assert.equal(api.findLevel('bonus-descent'),null);
 assert.equal(api.getUserLevels().length,2,'retiring a catalogue entry must not erase the archive');
 const oldGates={...data,name:'Jungle Gate Run'};
 api.setUserLevels([{id:'jungle-gate-run',name:'Jungle Gate Run',data:oldGates}]);
 const renamed=api.findLevel('jungle-gate-run');
 assert.equal(renamed.name,'The Ancient Gates');assert.equal(renamed.data.name,'The Ancient Gates');
 assert.deepEqual(renamed.data.components,api.getUserLevels()[0].data.components,'rename changed edited geometry');
 assert.equal(api.getUserLevels()[0].name,'Jungle Gate Run','catalogue view mutated the archived editor entry');
 api.setUserLevels([]);
 console.log('PASS six real secret courses, two placeholders, existing previews, Ancient Gates rename and retired Descent override suppression.');
}finally{await server.close();}
