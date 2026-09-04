import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("main.ts", source, ts.ScriptTarget.Latest, true);
const compile = (code) => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const functionSource = (name) => {
  const node = sourceFile.statements.find((statement) =>
    ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node?.body, `Missing actual host function ${name}`);
  return node.getText(sourceFile);
};

// Execute the actual startup branch: no copied level-selection policy in the
// test and no WebGL/browser machinery needed to check the URL trust boundary.
const startupStart = source.indexOf("const fieldStudioRequested =");
const startupEnd = source.indexOf("let level: Level;", startupStart);
assert.ok(startupStart >= 0 && startupEnd > startupStart);
const startup = new Function(
  "window", "location", "localStorage", "LITE_RENDER", "oceanReview",
  "oceanOverview", "coastPhysicsReview", "ui", "findLevel", "DEFAULT_LEVEL_ID",
  `${compile(source.slice(startupStart, startupEnd))}\nreturn { current, shellBypass };`,
);
const registry = new Map([
  ["jungle", { id: "jungle", name: "Jungle Ruins" }],
  ["warproom", { id: "warproom", name: "The Warp Room" }],
  ["slip", { id: "slip", name: "The Slipstream" }],
  ["beachfront", { id: "beachfront", name: "Beachside Run" }],
  ["descent", { id: "descent", name: "The Descent" }],
  ["astra-chimeworks", { id: "astra-chimeworks", name: "The Chimeworks — Astra" }],
]);
function select(search, { saved = "slip", lite = false, ocean = false, coast = false, editor = false } = {}) {
  const storage = new Map([
    ["solProtoLevelId", saved], ["solProtoEditorOpen", editor ? "1" : "0"],
  ]);
  return startup(
    { location: { search } }, { hash: "" }, { getItem: (key) => storage.get(key) ?? null },
    lite, ocean, false, coast, { setLifeCheatEnabled() {} },
    (id) => registry.get(id) ?? null, "jungle",
  );
}
assert.equal(select("?playtest&level=astra-chimeworks").current.id, "astra-chimeworks");
assert.equal(select("?playtest&level=astra-chimeworks").shellBypass, true);
assert.equal(select("?playtest&level=not-a-level").current.id, "slip");
assert.equal(select("?playtest&level=").current.id, "slip");
assert.equal(select("?playtest").current.id, "slip");
assert.equal(select("?playtest&level=not-a-level", { saved: "deleted" }).current.id, "jungle");
assert.equal(select("?level=astra-chimeworks").current.id, "warproom");
assert.equal(select("?level=astra-chimeworks").shellBypass, false);
assert.equal(select("?lite&level=astra-chimeworks", { lite: true }).current.id, "slip");
assert.equal(select("?level=astra-chimeworks", { editor: true }).current.id, "slip");
assert.equal(select("?playtest&level=%3Cscript%3E").current.id, "slip");
assert.equal(select("?oceanreview", { ocean: true }).current.id, "beachfront");
assert.equal(select("?coastphysics", { coast: true }).current.id, "descent");

const clear = new Function(
  "player", "level", "current", "campaignLevelById", "campaign", "runStartRewards",
  "presentCampaignResults", "ui",
  `${compile(functionSource("showCampaignResults"))}\nshowCampaignResults();`,
);
function finish({ canonical = false, before = null, runMode = false, totalBoxes = 12,
  crates = 9, bonus = 3, collected = true, starting = {} } = {}) {
  const calls = { bank: 0, progress: [], commits: [], inventory: [], results: [] };
  const current = registry.get(canonical ? "jungle" : "astra-chimeworks");
  const player = {
    cratesBroken: crates, bonusCrates: bonus, hasCrystal: collected,
    gemEarned: false, comboGemEarned: collected, lives: 6, fruit: 28,
    bankFlyingFruit() { calls.bank++; this.fruit += 2; },
  };
  clear(
    player, { runMode, totalCrates: totalBoxes }, current,
    (id) => canonical && id === "jungle" ? { name: "Canonical Jungle Name" } : null,
    {
      levelProgress(id) { calls.progress.push(id); return before; },
      commitClear(id, rewards) { calls.commits.push({ id, rewards }); },
      updateInventory(lives, fruit) { calls.inventory.push({ lives, fruit }); },
    },
    { crystal: false, boxGem: false, comboGem: false, ...starting },
    (result) => calls.results.push(result),
    { showMessage() { assert.fail("Noncanonical finishes must not fall back to a full-screen text popup"); } },
  );
  assert.equal(calls.bank, 1);
  assert.deepEqual(calls.inventory, [{ lives: 6, fruit: 30 }]);
  assert.equal(calls.results.length, 1);
  return { calls, player, result: calls.results[0] };
}

const lab = finish();
assert.deepEqual(lab.calls.progress, []);
assert.deepEqual(lab.calls.commits, [], "A debug clear must not create/modify canonical progress");
assert.deepEqual(lab.result, {
  kind: "normal", levelName: "The Chimeworks — Astra", boxes: 12, totalBoxes: 12,
  crystal: true, boxGem: true, comboGem: true, firstClear: false,
});
assert.equal(lab.player.gemEarned, true, "A complete noncanonical box tally still earns its run gem");
const incomplete = finish({ crates: 8, collected: false });
assert.equal(incomplete.result.boxes, 11);
assert.equal(incomplete.result.boxGem, false);
assert.equal(incomplete.result.crystal, false);
assert.equal(finish({ crates: 0, bonus: 0, totalBoxes: 0 }).result.boxGem, false);
const alternate = finish({ runMode: true });
assert.equal(alternate.result.boxes, 9, "Alternate runs do not count a suspended bonus tally");
assert.equal(alternate.result.boxGem, false);
const canonical = finish({ canonical: true });
assert.equal(canonical.result.levelName, "Canonical Jungle Name");
assert.equal(canonical.result.firstClear, true);
assert.deepEqual(canonical.calls.progress, ["jungle"]);
assert.deepEqual(canonical.calls.commits, [{
  id: "jungle", rewards: { crystal: true, boxGem: true, comboGem: true },
}]);
const repeat = finish({
  canonical: true, before: { cleared: true },
  starting: { crystal: true, boxGem: true, comboGem: true },
});
assert.equal(repeat.result.firstClear, false);
assert.equal(repeat.result.crystal, false);
assert.equal(repeat.result.boxGem, false);
assert.equal(repeat.result.comboGem, false);

console.log("Playtest level flow checks passed: opt-in validated links, safe startup fallbacks, and normal results without canonical progress pollution.");
