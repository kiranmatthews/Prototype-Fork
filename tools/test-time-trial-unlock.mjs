import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};
const api = await import(`data:text/javascript;base64,${Buffer.from(compile(
  await readFile(new URL('../src/campaign.ts', import.meta.url), 'utf8'),
)).toString('base64')}`);
const store = new api.CampaignStore();
assert.equal(store.runModesUnlocked('jungle'), false, 'no active save');
store.newGame(1);
for (const level of api.CAMPAIGN_LEVELS) assert.equal(store.runModesUnlocked(level.levelId), false, level.name);
store.commitClear('jungle', { crystal: false, boxGem: true, comboGem: false });
assert.equal(store.runModesUnlocked('jungle'), false, 'a clear or box gem is not a secured crystal');
store.commitTimeTrial('jungle', { time: 30, medal: 'gold' });
assert.equal(store.runModesUnlocked('jungle'), false, 'old trial records cannot unlock the mode');
store.saveActive();
const reload = new api.CampaignStore();
reload.load(1);
assert.equal(reload.runModesUnlocked('jungle'), false, 'legacy clear without crystal stays locked on reload');
reload.commitClear('jungle', { crystal: true, boxGem: false, comboGem: false });
assert.equal(reload.runModesUnlocked('jungle'), true, 'later clear secures the crystal');
reload.saveActive();
const secured = new api.CampaignStore();
secured.load(1);
assert.equal(secured.runModesUnlocked('jungle'), true, 'secured crystal survives reload');
secured.newGame(2);
assert.equal(secured.runModesUnlocked('jungle'), false, 'another save does not inherit the unlock');
secured.load(1);
assert.equal(secured.runModesUnlocked('jungle'), true, 'returning to the completed save restores it');
secured.levelProgress('treehouse-trail').crystal = true;
assert.equal(secured.runModesUnlocked('treehouse-trail'), false, 'crystal without a clear stays locked');
for (const level of api.CAMPAIGN_LEVELS.filter(level => level.skateRace)) {
  secured.commitRaceResult(level.levelId, { won: false, boxGem: true });
  assert.equal(secured.runModesUnlocked(level.levelId), false, `${level.name}: losing finish`);
  secured.commitRaceResult(level.levelId, { won: true, boxGem: false });
  assert.equal(secured.runModesUnlocked(level.levelId), !level.placeholder, `${level.name}: only built races unlock after a winning finish`);
}

// Execute the actual host gate with fresh/cleared/secured progress, including
// the lite/playtest entry path that previously bypassed campaign eligibility.
const source = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
const fn = parsed.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'applyRunModes');
assert.ok(fn);
const apply = new Function('campaign', 'current', 'isCampaignLevel', 'shellBypass', 'runModesOn',
  'editorViewActive', 'split2p', 'level', 'ui', 'player', 'p2',
  `${compile(fn.getText(parsed))};applyRunModes();`);
for (const shellBypass of [false, true]) for (const cleared of [false, true]) for (const crystal of [false, true]) {
  Object.assign(secured.levelProgress('jungle'), { cleared, crystal });
  let visible;
  const player = { ttActive: false, comboRun: false };
  apply(secured, { id: 'jungle' }, api.isCampaignLevel, shellBypass, true, false, false,
    { hudMode: 'standard', setRunModesEnabled(on) { visible = on; }, setTimeTrial() {}, setComboRun() {} },
    { setRunModes() {}, setTimeTrial() {}, comboHalo() {}, setRunRows() {} }, player, null);
  assert.equal(visible, cleared && crystal, JSON.stringify({ shellBypass, cleared, crystal }));
}
console.log('PASS secured-crystal unlock, later clears, save reload/switch, legacy records, race wins and lite/playtest gate');
