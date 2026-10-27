import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
const source=await readFile(new URL('../src/campaign.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const c=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const {CampaignStore,CAMPAIGN_LEVELS:levels,CAMPAIGN_ISLANDS:islands,CAMPAIGN_BOSSES:bosses,campaignLevelByKey:byKey}=c;
assert.deepEqual(islands.map(i=>[i.name,i.levelKeys.length]),[['Motu Motu',6],['The Uga Isles',6],['Spooky Shores',6],['Maynard Quay',6],['Quagmire Caverns',6],['Secret Island',8]]);
const expected=[
 ['treehouse-trail','Treehouse Trail'],['beachfront','Banana Bay'],['jungle','Jungle Ruins'],['rumblewater-run','Ripcord River'],['coastal-street-run','Beach Street'],['jungle-cup','Motu Beach Invitational'],
 ['custard-creek','Sunset Safari'],['tribal-run','Tribal Run'],['test','Uga Ambush'],['drowned-crown','The Merchant Wreck'],['crab-chief','High Chief Uga Ha ku'],
 ['waterpark','Deadwater Park'],['codex-lab','Haunted Hassle'],['ghost-train','Ghost Train'],['hollowwake-descent','Tunnelbore Tracks'],['slipstream-race','Slipstream'],['waterpark-cup','Deadwater Cup'],
 ['country-club','Country Club Circuit'],['rooftop-relay','Hogsworth Harbour'],['warehouse','Factory Fuss'],['jungle-minefield','Nightmare Grove'],['nightworks-after-hours','Guptus Eruptus'],['dark','Torchlight Trouble'],
 ['sky','Sky Bridge'],['jungle-terraces','Temple of Embers'],['jungle-gate-run','The Ancient Gates'],['rolling-bones','Rolling Bones'],['skystream','The Skystream'],['coconut-cart-rally','Coconut Cart Rally'],
];
assert.deepEqual(levels.filter(d=>!d.placeholder).map(d=>[d.levelId,d.name]),expected);
assert.equal(levels.length,38);assert.equal(levels.filter(d=>d.placeholder).length,9);
assert.equal(new Set(levels.map(d=>d.levelId)).size,38);assert.equal(new Set(levels.map(d=>d.progressKey)).size,38);
assert.deepEqual(c.validateCampaignMapGraph(),[]);assert.equal(c.CAMPAIGN_MAP_EDGES.length,37);
assert.deepEqual(bosses.map(d=>d.progressKey),['jungle-cup','crab-chief','slipstream','waterpark-cup','maynard-boss','quagmire-race','quagmire-boss']);
// IDs in old point arrays are reserved even when the course is no longer assigned.
for(const [key,index] of [['jungle',0],['test-course',1],['sky-bridge',2],['island-hopper',7],['codex-switchback',9],['treehouse-trail',12],['crab-chief',23],['ghost-train',24],['rumblewater-run',27]])assert.equal(c.campaignMapPointIndex(key),index);
// Untouched older editor captures adopt new positions; authored custom points survive.
const oldPoints=[[-151,22,0,1.35],[-111,22,0,4],[-71,22,0,6],[-47,22,0,3],[-111,-1,0,9],[48,16,0,1.35],[67,14,0,1.75],[86,14,0,2.4],[122,14,0,3.1],[104,14,0,2.8],[67,26,0,2.3],[-31,22,0,3.8],[-175,22,0,1.35],[67,4,0,6],[90,4,0,12],[143,29,0,2.1],[157,34,0,2.4],[171,29,0,3.1],[-81,-1,0,10],[-151,7,0,7],[-131,7,0,11],[294,14,0,1.4],[322,14,0,3],[350,14,0,2],[322,34,0,6],[-111,46,0,2.4],[-47,-1,0,11],[-96,65,0,2.5]];
const currentPoints=c.CAMPAIGN_MAP_HUBS.map(d=>[d.mapPosition[0],d.mapPosition[2],0,d.mapPosition[1]]);
for(const count of [11,12,13,14,28])assert.deepEqual(c.migrateCampaignMapPoints(oldPoints.slice(0,count)),currentPoints);
const beforeReorder=oldPoints.slice(0,13).map(point=>[...point]);
beforeReorder[8]=[104,14,0,3.1];beforeReorder[9]=[-71,-1,0,11];
for(const count of [12,13]){
 assert.deepEqual(c.migrateCampaignMapPoints(beforeReorder.slice(0,count)),currentPoints);
 const swapped=structuredClone(beforeReorder.slice(0,count));[swapped[3],swapped[4]]=[swapped[4],swapped[3]];
 assert.deepEqual(c.migrateCampaignMapPoints(swapped),currentPoints);
}
const beforeDeadwater=structuredClone(oldPoints);beforeDeadwater[13]=[86,4,0,6];beforeDeadwater[14]=[109,4,0,12];
assert.deepEqual(c.migrateCampaignMapPoints(beforeDeadwater),currentPoints);
const customPoints=structuredClone(oldPoints);customPoints[0][0]+=3;
assert.equal(c.migrateCampaignMapPoints(customPoints),customPoints);
assert.equal(c.migrateCampaignMapPoints(currentPoints),currentPoints);
const fresh=new CampaignStore();fresh.newGame(1);
assert.equal(fresh.levelPlayable('treehouse-trail'),true);
assert.equal(fresh.levelPlayable('beachfront'),false);
fresh.commitClear('treehouse-trail',{crystal:true,boxGem:true,comboGem:false});
assert.equal(fresh.levelPlayable('beachfront'),true);assert.equal(fresh.levelPlayable('jungle'),false);
fresh.commitClear('beachfront',{crystal:false,boxGem:false,comboGem:false});assert.equal(fresh.levelPlayable('jungle'),true);
for(const id of ['jungle','rumblewater-run','coastal-street-run'])fresh.commitClear(id,{crystal:false,boxGem:false,comboGem:false});
assert.equal(fresh.levelPlayable('jungle-cup'),true);assert.equal(fresh.levelPlayable('custard-creek'),false);
fresh.recordLevelFinished('jungle-cup');assert.equal(fresh.levelPlayable('custard-creek'),false,'losing cup unlocked next island');
fresh.commitCompetitionWin('jungle-cup');assert.equal(fresh.levelPlayable('custard-creek'),true);
fresh.commitClear('custard-creek',{crystal:false,boxGem:false,comboGem:false});
assert.equal(fresh.levelUnlocked('tribal-run'),true);assert.equal(fresh.levelPlayable('tribal-run'),true);
assert.equal(fresh.levelPlayable('test'),false,'Tribal Run must be cleared before Uga Ambush');
fresh.commitClear('tribal-run',{crystal:true,boxGem:false,comboGem:false});
assert.equal(fresh.levelPlayable('test'),true,'the remaining unbuilt ordinary slot strands the existing route');
for(const def of levels.filter(d=>d.placeholder)){
 assert.equal(fresh.levelPlayable(def.progressKey),false);
 assert.equal(fresh.commitClear(def.levelId,{crystal:true,boxGem:true,comboGem:true}),null);
 assert.equal(fresh.commitTimeTrial(def.levelId,{time:1,medal:'gold'}),null);
 assert.equal(fresh.active.levels[def.progressKey].cleared,false);
}
assert.equal(fresh.levelPlayable('warehouse'),false,'unfinished Maynard boss allowed next island');
fresh.commitClear('test',{crystal:true,boxGem:true,comboGem:false});fresh.commitTimeTrial('test',{time:53,medal:'silver'});
fresh.active.levels['sky-bridge']={cleared:true,crystal:true,boxGem:true,comboGem:true,timeRelic:true,trialTimes:[42]};
fresh.saveActive();const reload=new CampaignStore();reload.load(1);
assert.equal(reload.levelProgress('test').crystal,true);assert.equal(reload.levelProgress('test').timeMedal,'silver');
assert.equal(reload.levelPlayable('test'),true);assert.equal(reload.levelPlayable('carlisle-coast'),false,'new Carlisle inherited Uga Ambush save');
assert.deepEqual(reload.active.levels['sky-bridge'],{cleared:true,crystal:false,boxGem:true,comboGem:true,timeRelic:true,timeMedal:'gold',bestTime:42,trialTimes:[42]},'Secret Island migration should retain gems and medals');
assert.equal(reload.totals().maxLevels,29);assert.equal(reload.runModesUnlocked('warehouse'),false);
assert.deepEqual(reload.levelProgress('sky'),reload.active.levels['sky-bridge'],'reassigned Sky Bridge lost its older rewards');
assert.equal(reload.levelPlayable('sky'),false,'old completion bypassed the secret-island boss gate');
for(const [key,id,requirement] of [['secret-1','sky','medals-5'],['secret-2','jungle-terraces','gems-5'],['secret-3','jungle-gate-run','medals-10'],['secret-4','rolling-bones','gems-15'],['secret-5','skystream','medals-20']]){
 assert.equal(byKey(key).levelId,id);assert.equal(byKey(key).secretRequirement,requirement);assert.equal(!!byKey(key).placeholder,false);
}
assert.equal(c.campaignLevelById('country-club').skateRace,true);assert.equal(reload.totals().maxCups,2);
const race=new CampaignStore();race.startEphemeral();race.commitRaceResult('slipstream-race',{won:false,boxGem:false});
assert.equal(race.levelPlayable('waterpark-cup'),false,'mere race finish counted as boss defeat');
race.commitRaceResult('slipstream-race',{won:true,boxGem:true});assert.equal(race.levelPlayable('waterpark-cup'),true);assert.equal(race.levelProgress('slipstream-race').crystal,true);
race.commitRaceResult('country-club',{won:true,boxGem:true});
assert.equal(race.levelProgress('country-club').raceWon,true);assert.equal(race.levelProgress('country-club').crystal,true);
// Independently earned secret criteria; a medal tier upgrade counts once.
const secret=new CampaignStore();secret.startEphemeral();const save=secret.active;
const main=levels.filter(d=>d.islandId!=='hidden-shores'&&c.campaignHasTimeTrial(d));
for(const d of main.slice(0,4))save.levels[d.progressKey].timeMedal='gold';
assert.equal(c.secretRequirementMet('secret-1',save),false);
save.levels[main[4].progressKey].timeMedal='bronze';assert.equal(c.secretRequirementMet('secret-1',save),true);
assert.equal(c.secretIslandUnlocked(save),false,'medals alone exposed secret island');
for(const d of bosses)Object.assign(save.levels[d.progressKey],{cleared:true,cup:true,raceWon:true});
assert.equal(c.secretIslandUnlocked(save),true);
for(const d of bosses){const progress=save.levels[d.progressKey],field=d.competition?'cup':d.skateRace?'raceWon':'cleared';progress[field]=false;assert.equal(c.secretIslandUnlocked(save),false,`${d.name} was omitted from all-bosses requirement`);progress[field]=true;}
for(const d of main)save.levels[d.progressKey].timeMedal=undefined;
for(const d of main.slice(0,5))save.levels[d.progressKey].boxGem=true;
assert.equal(c.secretIslandUnlocked(save),true,'clear-gem-only opening wrongly depends on first medal slot');
assert.equal(secret.levelUnlocked('secret-1'),true,'locked secret nodes must permit travel to independent unlocked slots');
for(const [key,field,n]of [['secret-3','timeMedal',10],['secret-4','boxGem',15],['secret-5','timeMedal',20]]){
 for(const d of main)save.levels[d.progressKey][field]=undefined;
 for(const d of main.slice(0,n-1))save.levels[d.progressKey][field]=field==='boxGem'?true:'silver';
 assert.equal(c.secretRequirementMet(key,save),false);
 save.levels[main[n-1].progressKey][field]=field==='boxGem'?true:'bronze';assert.equal(c.secretRequirementMet(key,save),true);
}
for(const d of main)Object.assign(save.levels[d.progressKey],{boxGem:true,timeMedal:'bronze'});
save.levels.warehouse.boxGem=true;
assert.equal(c.secretRequirementMet('secret-6',save),true);
for(let i=1;i<=6;i++)Object.assign(save.levels[`secret-${i}`],{boxGem:true,timeMedal:'silver'});
assert.equal(c.secretRequirementMet('secret-7',save),true,'secret 7 requires its own unearned gem');
assert.equal(c.secretRequirementMet('secret-8',save),false,'empty coloured-gem catalogue auto-unlocked finale');
// Future authored coloured-gem challenge uses explicit ownership, not combo awards.
byKey('jungle').colouredGem='red';save.levels.jungle.comboGem=true;
Object.assign(save.levels['secret-7'],{boxGem:true,timeMedal:'gold'});
assert.equal(c.secretRequirementMet('secret-8',save),false);
save.levels.jungle.colouredGem=true;assert.equal(c.secretRequirementMet('secret-8',save),true,'finale requires its own rewards');
delete byKey('jungle').colouredGem;
// A completed older course remains available without inventing prerequisite clears.
const older=new CampaignStore();older.startEphemeral();older.active.levels['ghost-train'].cleared=true;
assert.equal(older.levelPlayable('ghost-train'),true);assert.equal(older.active.levels['crab-chief'].cleared,false);
// Inspection unlocks are in-memory access, not synthetic completed rewards.
const inspection=new CampaignStore();inspection.startEphemeral({unlockAll:true});
const shelfBefore=JSON.stringify(inspection.listSlots());
for(const def of levels){
 assert.equal(inspection.levelUnlocked(def.progressKey),true);
 assert.equal(inspection.levelRevealed(def.progressKey),true);
 assert.equal(inspection.levelPlayable(def.progressKey),!def.placeholder);
 assert.equal(inspection.levelProgress(def.levelId).cleared,false);
 assert.equal(inspection.levelProgress(def.levelId).boxGem,false);
 assert.equal(inspection.levelProgress(def.levelId).timeMedal,undefined);
}
assert.equal(inspection.levelStatus('secret-8'),'Unlocked · Coming soon');
assert.equal(inspection.saveActive().reason,'ephemeral-save');
assert.equal(JSON.stringify(inspection.listSlots()),shelfBefore);
inspection.startEphemeral();assert.equal(inspection.levelRevealed('secret-8'),false);
inspection.startEphemeral({unlockAll:true});inspection.newGame(2);
assert.equal(inspection.levelRevealed('secret-8'),false,'inspection unlock leaked into a new save');
inspection.startEphemeral({unlockAll:true});inspection.load(2);
assert.equal(inspection.levelRevealed('beachside-run'),false,'inspection unlock leaked into a loaded save');
console.log('PASS six-island assignments, stable save keys, placeholders, boss victories, threshold boundaries, independent secret openings, circularity prevention and old-save preservation.');

// Merge retained course records into the new slots without losing better newer runs.
const reassigned=new CampaignStore();reassigned.newGame(3);
for(const [slot,old] of [['secret-1','sky-bridge'],['secret-2','jungle-terraces'],['secret-3','jungle-gate']]){
 Object.assign(reassigned.active.levels[old],{cleared:true,crystal:true,boxGem:true,timeMedal:'gold',bestTime:42,trialTimes:[42,50]});
 Object.assign(reassigned.active.levels[slot],{timeMedal:'silver',bestTime:39,trialTimes:[39,45]});
}
reassigned.active.mapFocus='jungle-gate';reassigned.active.lastFinishedLevel='sky-bridge';reassigned.saveActive();
const migrated=new CampaignStore();migrated.load(3);
assert.equal(migrated.active.mapFocus,'secret-3');assert.equal(migrated.active.lastFinishedLevel,'secret-1');
for(const id of ['sky','jungle-terraces','jungle-gate-run']){
 const progress=migrated.levelProgress(id);
 assert.equal(progress.cleared,true);assert.equal(progress.crystal,false);assert.equal(progress.boxGem,true);
 assert.equal(progress.timeMedal,'gold');assert.equal(progress.bestTime,39);assert.deepEqual(progress.trialTimes,[39,42,45]);
 assert.equal(migrated.levelPlayable(id),false,'archived completion bypassed the secret island gate');
}
console.log('PASS secret-course save migration preserves rewards, strongest medals, best runs and remembered course identities.');

const secretRewards=new CampaignStore();secretRewards.startEphemeral({unlockAll:true});
for(const def of levels.filter(level=>level.islandId==='hidden-shores'&&!level.placeholder)){
 assert.equal(secretRewards.runModesUnlocked(def.levelId),false);
 if(def.skateRace)secretRewards.commitRaceResult(def.levelId,{won:true,boxGem:true});
 else secretRewards.commitClear(def.levelId,{crystal:true,boxGem:true,comboGem:true});
 assert.equal(secretRewards.runModesUnlocked(def.levelId),true,'A secret-course clear must unlock its medals without a crystal');
 secretRewards.commitTimeTrial(def.levelId,{time:42,medal:'gold'});
 const progress=secretRewards.levelProgress(def.levelId);
 assert.equal(progress.crystal,false);assert.equal(progress.boxGem,true);assert.equal(progress.timeMedal,'gold');
}
assert.equal(secretRewards.totals().crystals,0);
assert.equal(secretRewards.totals().gems,6);assert.equal(secretRewards.totals().relics,6);
assert.equal(secretRewards.totals().maxCrystals,levels.filter(d=>d.islandId!=='hidden-shores'&&!d.placeholder&&(!d.boss||d.skateRace)&&!d.competition).length);
console.log('PASS Secret Island awards and counts gems and medals only.');
