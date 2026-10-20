import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createServer} from 'vite';
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
 assert.deepEqual(rows.slice(0,3).map(l=>[l.levelId,l.name,l.secretRequirement]),[
  ['sky','Sky Bridge','medals-5'],['jungle-terraces','Temple of Embers','gems-5'],['jungle-gate-run','The Ancient Gates','medals-10']]);
 assert.ok(rows.slice(0,3).every(l=>!l.placeholder&&!l.boss));
 assert.ok(rows.slice(3).every(l=>l.placeholder));
 for(const row of rows.slice(0,3)){
  assert.ok(api.findLevel(row.levelId)?.data,row.name+' has no actual course');
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
 console.log('PASS three real secret courses, five placeholders, existing previews, Ancient Gates rename and retired Descent override suppression.');
}finally{await server.close();}
