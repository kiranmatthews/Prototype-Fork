import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/campaign.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
  },
}).outputText;

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
  clear: () => memory.clear(),
  key: (index) => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
};

const campaign = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);

assert.equal(campaign.CAMPAIGN_LEVELS.length, 9);
assert.deepEqual(
  campaign.CAMPAIGN_LEVELS.map(({ levelId, name }) => [levelId, name]),
  [
    ["jungle", "Jungle Ruins"],
    ["test", "Test Course"],
    ["sky", "Sky Bridge"],
    ["slip", "Slipstream"],
    ["dark", "Nightworks"],
    ["beachfront", "Beachside Run"],
    ["coastal-street-run", "Coastal"],
    ["island-hopper", "Island Hopper"],
    ["jungle-gate-run", "Jungle Gate"],
  ],
  "canonical portal order or labels drifted",
);
assert.equal(
  new Set(campaign.CAMPAIGN_LEVELS.map((level) => level.progressKey)).size,
  9,
  "campaign progress keys must remain unique",
);

const store = new campaign.CampaignStore();
const save = store.newGame(1);
assert.equal(save.lives, 4);
assert.equal(save.fruit, 0);
assert.equal(store.runModesUnlocked("jungle"), false);

store.commitClear("jungle", {
  crystal: true,
  boxGem: true,
  comboGem: false,
  time: 52.4,
});
assert.equal(store.runModesUnlocked("jungle"), true);
store.updateInventory(7, 63);

const totals = store.totals();
assert.equal(totals.cleared, 1);
assert.equal(totals.crystals, 1);
assert.equal(totals.gems, 1);
assert.equal(totals.relics, 0);
assert.ok(totals.percent > 0 && totals.percent < 100);

const restored = new campaign.CampaignStore();
const loaded = restored.load(1);
assert.equal(loaded?.lives, 7);
assert.equal(loaded?.fruit, 63);
assert.equal(restored.runModesUnlocked("jungle"), true);

restored.resetInventory();
assert.equal(restored.active?.lives, 4);
assert.equal(restored.active?.fruit, 0);

const storedSlots = JSON.parse(memory.get("solProtoCampaignSavesV1"));
storedSlots[1] = { ...storedSlots[0], slot: 2, lives: 0, fruit: 87 };
memory.set("solProtoCampaignSavesV1", JSON.stringify(storedSlots));
const exhaustedReload = new campaign.CampaignStore().load(2);
assert.equal(exhaustedReload?.lives, 4, "an exhausted save did not recover to four lives");
assert.equal(exhaustedReload?.fruit, 0, "an exhausted save did not clear fruit");

assert.deepEqual(
  campaign.mergeCompletedBonusInventory(
    { lives: 4, fruit: 95 },
    { lives: 0, fruit: 10 },
  ),
  { lives: 5, fruit: 5 },
  "bonus fruit crossing 100 did not bank a parent life",
);
assert.deepEqual(
  campaign.mergeCompletedBonusInventory(
    { lives: 7, fruit: 12 },
    { lives: 2, fruit: 43 },
  ),
  { lives: 9, fruit: 55 },
  "temporary bonus lives/fruit did not merge on completion",
);

console.log("Validated canonical portal order, save slots, inventory, progress totals, and run-mode unlocks.");
