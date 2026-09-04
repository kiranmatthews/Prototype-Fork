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
const failedWrites = new Set();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    if (failedWrites.has(key)) throw new Error(`blocked write: ${key}`);
    memory.set(key, String(value));
  },
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
assert.equal(store.continueSlot(), null, "an empty save shelf exposed Continue");
assert.equal(store.autosaveEnabled, true, "autosave must default on");
assert.equal(store.dirty, false);
const save = store.newGame(1);
assert.equal(save.lives, 4);
assert.equal(save.fruit, 0);
assert.equal(store.continueSlot(), 1, "a new durable game was not continuable");
assert.equal(store.activeSlot, 1);
assert.equal(store.dirty, false, "new-game baseline did not persist cleanly");
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
assert.equal(restored.continueSlot(), 1, "Continue did not survive a reload");
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

// Continue remembers the last slot explicitly instead of mistaking the save
// with the most recent progress write for the one the player last selected.
const originalNow = Date.now;
try {
  memory.clear();
  let now = 1_000;
  Date.now = () => now;
  const shelf = new campaign.CampaignStore();
  shelf.newGame(1);
  now = 2_000;
  shelf.newGame(2);
  assert.equal(shelf.continueSlot(), 2);
  shelf.load(1);
  assert.equal(shelf.continueSlot(), 1, "Continue ignored the active slot");
  assert.equal(
    new campaign.CampaignStore().continueSlot(),
    1,
    "the last selected slot was not durable across reloads",
  );

  // Old saves predate the last-slot key. They fall back to newest update,
  // then newest creation, then lowest slot for a fully deterministic tie.
  memory.delete("solProtoCampaignLastSlotV1");
  const legacySlots = JSON.parse(memory.get("solProtoCampaignSavesV1"));
  legacySlots[0].updatedAt = 3_000;
  legacySlots[0].createdAt = 900;
  legacySlots[1].updatedAt = 4_000;
  legacySlots[1].createdAt = 800;
  memory.set("solProtoCampaignSavesV1", JSON.stringify(legacySlots));
  assert.equal(new campaign.CampaignStore().continueSlot(), 2);

  legacySlots[0].updatedAt = 4_000;
  legacySlots[0].createdAt = 800;
  memory.set("solProtoCampaignSavesV1", JSON.stringify(legacySlots));
  assert.equal(
    new campaign.CampaignStore().continueSlot(),
    1,
    "equal legacy timestamps did not prefer the lower slot",
  );

  memory.set("solProtoCampaignLastSlotV1", "3");
  assert.equal(
    new campaign.CampaignStore().continueSlot(),
    1,
    "a stale remembered slot did not fall back to a valid save",
  );

  memory.clear();
  memory.set("solProtoCampaignLastSlotV1", "1");
  assert.equal(
    new campaign.CampaignStore().continueSlot(),
    null,
    "a remembered slot without a valid save exposed Continue",
  );
} finally {
  Date.now = originalNow;
}

// Autosave-off runs mutate a deep working copy only. Slot summaries and a new
// store must keep showing the last successful durable snapshot.
memory.clear();
failedWrites.clear();
const manual = new campaign.CampaignStore();
assert.equal(manual.setAutosave(false), true);
assert.equal(manual.autosaveEnabled, false);
manual.newGame(1);
manual.newGame(2);
assert.ok(manual.load(1));
manual.updateInventory(9, 88);
manual.commitClear("jungle", {
  crystal: true,
  boxGem: true,
  comboGem: true,
  timeRelic: true,
  time: 48.2,
});
assert.equal(manual.dirty, true);
assert.equal(manual.active?.lives, 9);
assert.equal(manual.levelProgress("jungle")?.crystal, true);
assert.equal(manual.listSlots()[0]?.lives, 4);
assert.equal(manual.listSlots()[0]?.levels.jungle.crystal, false);

const exposedShelf = manual.listSlots();
exposedShelf[0].lives = 99;
exposedShelf[0].levels.jungle.crystal = true;
assert.equal(
  manual.listSlots()[0]?.lives,
  4,
  "listSlots exposed the store's durable object graph",
);
assert.equal(manual.listSlots()[0]?.levels.jungle.crystal, false);
const diskBeforeSave = new campaign.CampaignStore();
assert.equal(diskBeforeSave.autosaveEnabled, false, "autosave toggle was not durable");
assert.equal(diskBeforeSave.load(1)?.lives, 4);
assert.equal(diskBeforeSave.levelProgress("jungle")?.crystal, false);

assert.equal(
  manual.load(2),
  null,
  "loading another slot silently discarded dirty working progress",
);
assert.equal(manual.activeSlot, 1);
assert.equal(manual.dirty, true);
assert.equal(
  manual.load(2, { discardDirty: true })?.slot,
  2,
  "explicit dirty-load acknowledgement did not switch slots",
);
assert.equal(manual.dirty, false);
assert.equal(manual.listSlots()[0]?.levels.jungle.crystal, false);

// Manual save publishes a clone, then later working edits cannot mutate it by
// alias. Discard restores that exact durable baseline.
assert.ok(manual.load(1));
manual.updateInventory(8, 44);
manual.commitClear("jungle", {
  crystal: true,
  boxGem: false,
  comboGem: false,
  time: 51.5,
});
const manualSave = manual.saveActive();
assert.equal(manualSave.ok, true);
assert.equal(manual.dirty, false);
assert.equal(manual.listSlots()[0]?.lives, 8);
assert.equal(manual.listSlots()[0]?.levels.jungle.crystal, true);
if (manualSave.ok) {
  manualSave.save.lives = 123;
  manualSave.save.levels.jungle.crystal = false;
}
assert.equal(manual.listSlots()[0]?.lives, 8);
assert.equal(manual.listSlots()[0]?.levels.jungle.crystal, true);

manual.commitClear("sky", {
  crystal: true,
  boxGem: true,
  comboGem: false,
  time: 72,
});
assert.equal(manual.dirty, true);
assert.equal(manual.listSlots()[0]?.levels["sky-bridge"].crystal, false);
const discarded = manual.discardActiveChanges();
assert.equal(discarded?.levels["sky-bridge"].crystal, false);
assert.equal(manual.levelProgress("sky")?.crystal, false);
assert.equal(manual.dirty, false);

// A failed localStorage write must not advance the durable data/timestamp or
// clear dirty state, and a protected close must not lose it accidentally.
manual.updateInventory(10, 20);
const durableBeforeFailure = manual.listSlots()[0];
const workingTimestamp = manual.active?.updatedAt;
failedWrites.add("solProtoCampaignSavesV1");
const failedSave = manual.saveActive();
assert.deepEqual(failedSave, {
  ok: false,
  reason: "storage-unavailable",
});
assert.equal(manual.dirty, true);
assert.equal(manual.active?.updatedAt, workingTimestamp);
assert.deepEqual(manual.listSlots()[0], durableBeforeFailure);
assert.equal(manual.closeActive(), false, "dirty close was not protected");
assert.equal(manual.activeSlot, 1);
failedWrites.delete("solProtoCampaignSavesV1");
assert.equal(manual.saveActive().ok, true);
assert.equal(manual.closeActive(), true);
assert.equal(manual.active, null);
assert.ok(manual.load(1));
manual.updateInventory(11, 21);
assert.equal(manual.dirty, true);
assert.equal(
  manual.closeActive({ discardDirty: true }),
  true,
  "explicit Quit Without Saving could not close a dirty session",
);
assert.equal(manual.listSlots()[0]?.lives, 10);
assert.equal(new campaign.CampaignStore().load(1)?.lives, 10);

// Enabling autosave flushes pending work; new games still establish a durable
// baseline while autosave is disabled.
memory.clear();
const toggled = new campaign.CampaignStore();
assert.equal(toggled.setAutosave(false), true);
toggled.newGame(1);
assert.equal(toggled.dirty, false);
toggled.updateInventory(6, 12);
assert.equal(toggled.dirty, true);
assert.equal(new campaign.CampaignStore().load(1)?.lives, 4);
assert.equal(toggled.setAutosave(true), true);
assert.equal(toggled.dirty, false);
assert.equal(new campaign.CampaignStore().load(1)?.lives, 6);
assert.equal(new campaign.CampaignStore().autosaveEnabled, true);

// Ephemeral playtests never masquerade as a dirty or saveable campaign slot.
memory.clear();
const ephemeral = new campaign.CampaignStore();
ephemeral.startEphemeral();
ephemeral.updateInventory(12, 55);
assert.equal(ephemeral.activeSlot, null);
assert.equal(ephemeral.dirty, false);
assert.deepEqual(ephemeral.saveActive(), {
  ok: false,
  reason: "ephemeral-save",
});
assert.equal(ephemeral.closeActive(), true);
assert.deepEqual(new campaign.CampaignStore().saveActive(), {
  ok: false,
  reason: "no-active-save",
});

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

console.log("Validated campaign slots, working snapshots, autosave, failure handling, and progress.");
