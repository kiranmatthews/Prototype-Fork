import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/campaign.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 },
}).outputText;
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const campaign = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
const { CAMPAIGN_ISLANDS, CAMPAIGN_LEVELS, CAMPAIGN_MAP_EDGES, CampaignStore,
  campaignLevelById, validateCampaignMapGraph } = campaign;
const id = 'jungle-terraces';
assert.deepEqual(validateCampaignMapGraph(), []);
assert.equal(campaignLevelById('jungle-skyline'), null);
assert.equal(CAMPAIGN_LEVELS.filter(level=>level.progressKey===id).length,1);
assert.equal(campaign.CAMPAIGN_MAP_HUBS[20].progressKey,'jungle-skyline','archived editor map indices stay stable');
const island=CAMPAIGN_ISLANDS.find(item=>item.id==='island-1');
assert.deepEqual(island.levelKeys.slice(island.levelKeys.indexOf('jungle'),island.levelKeys.indexOf('jungle')+2),['jungle',id]);
assert.ok(!island.levelKeys.includes('jungle-skyline'));
const definition=campaignLevelById(id);
assert.equal(definition.name,'Temple of Embers');assert.equal(definition.islandId,'island-1');
assert.equal(campaign.resolveRelicTime(id),240);
const entry=CAMPAIGN_MAP_EDGES.find(edge=>edge.from==='jungle'&&edge.to===id);
assert.equal(entry.fromDirection,'up');assert.equal(entry.toDirection,'down');
assert.ok(!CAMPAIGN_MAP_EDGES.some(edge=>edge.from==='jungle-skyline'||edge.to==='jungle-skyline'));
const store=new CampaignStore();store.newGame(1);assert.equal(store.levelUnlocked(id),false);
store.commitClear('treehouse-trail',{});store.commitClear('jungle',{});
assert.equal(store.levelUnlocked(id),true);assert.equal(store.levelUnlocked('test'),true);
store.commitClear(id,{crystal:true,boxGem:true});store.commitTimeTrial(id,{time:239,timeRelic:true});
const restored=new CampaignStore();assert.ok(restored.load(1));
assert.equal(restored.levelProgress(id).crystal,true);assert.equal(restored.levelProgress(id).boxGem,true);
assert.equal(restored.levelProgress(id).bestTime,239);assert.equal(restored.levelProgress('jungle').crystal,false);
console.log('PASS one temple map entry, stable archived hub indices, Jungle unlock and one saved award owner.');
