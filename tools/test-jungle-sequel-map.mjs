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
const ids = ['jungle-terraces', 'jungle-skyline'];

assert.deepEqual(validateCampaignMapGraph(), [], 'sequel branches conflict with the existing map graph');
const firstSequel = CAMPAIGN_LEVELS.findIndex(level => level.progressKey === ids[0]);
assert.ok(firstSequel >= 18, 'previously published hub identities must be preserved');
assert.deepEqual(CAMPAIGN_LEVELS.slice(firstSequel, firstSequel + 2).map(level => level.progressKey), ids,
  'sequel identities must append after saved editor hub indices');
const island = CAMPAIGN_ISLANDS.find(item => item.id === 'island-1');
assert.deepEqual(island.levelKeys.slice(island.levelKeys.indexOf('jungle'), island.levelKeys.indexOf('jungle') + 3),
  ['jungle', ...ids], 'Level Select must list both sequels beside Jungle Ruins');

for (const [index, id] of ids.entries()) {
  const definition = campaignLevelById(id);
  assert.equal(definition.progressKey, id);
  assert.equal(definition.islandId, 'island-1');
  assert.equal(definition.mapPath, 'upper-branch');
  assert.equal(definition.name, ['Temple Terraces', 'Temple Skyline'][index]);
  assert.equal(campaign.resolveRelicTime(id), [105, 125][index]);
  assert.equal(CAMPAIGN_LEVELS.filter(level => level.progressKey === id).length, 1);
}
const entry = CAMPAIGN_MAP_EDGES.find(edge => edge.from === 'jungle' && edge.to === ids[0]);
assert.ok(entry, 'Jungle Ruins needs an entry to its sequel branch');
assert.equal(entry.fromDirection, 'up');
assert.equal(entry.toDirection, 'down');
const link = CAMPAIGN_MAP_EDGES.find(edge => edge.from === ids[0] && edge.to === ids[1]);
assert.equal(link?.travel, 'boardslide');
assert.equal(link?.fromDirection, 'right');
assert.equal(link?.toDirection, 'left');

const store = new CampaignStore();
store.newGame(1);
assert.equal(store.levelUnlocked(ids[0]), false);
assert.equal(store.levelUnlocked(ids[1]), false);
store.commitClear('treehouse-trail', {});
store.commitClear('jungle', {});
assert.equal(store.levelUnlocked(ids[0]), true, 'clearing Jungle Ruins must reveal Temple Terraces');
assert.equal(store.levelUnlocked(ids[1]), false, 'Temple Skyline must follow Temple Terraces');
assert.equal(store.levelUnlocked('test'), true, 'the new branch must preserve the existing Carlisle Coast route');
store.commitClear(ids[0], { crystal: true });
assert.equal(store.levelUnlocked(ids[1]), true, 'clearing Temple Terraces must reveal Temple Skyline');
store.commitClear(ids[1], { boxGem: true });
store.commitTimeTrial(ids[1], { time: 124, timeRelic: true });
const restored = new CampaignStore();
assert.ok(restored.load(1));
assert.equal(restored.levelProgress(ids[0]).crystal, true);
assert.equal(restored.levelProgress(ids[1]).boxGem, true);
assert.equal(restored.levelProgress(ids[1]).bestTime, 124);
assert.equal(restored.levelProgress('jungle').crystal, false, 'sequel progress must not overwrite Jungle Ruins');

console.log('Validated both Jungle sequel map entries, branch navigation, sequential unlocks and independent saved awards.');
