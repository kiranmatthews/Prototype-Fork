import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

const source = await text("src/hudVisibility.ts");
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
  },
}).outputText;
const hud = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
);

const frame = (overrides = {}) => ({
  mode: "standard",
  fruitCollectionRevision: 0,
  inventoryHeld: false,
  hasEarnedRelic: false,
  nowMs: 1_000,
  ...overrides,
});

{
  const state = new hud.HudVisibilityState();
  assert.deepEqual(state.update(frame()), {
    showLife: true,
    showBonusTitle: false,
    showFruit: false,
    showBoxes: false,
    showEarnedRelics: false,
  }, "regular gameplay must begin with only the life HUD visible");

  assert.equal(
    state.update(frame({ fruitCollectionRevision: 1, nowMs: 1_100 })).showFruit,
    true,
    "a fruit collection event did not open the fruit popup",
  );
  assert.equal(
    state.update(frame({ fruitCollectionRevision: 1, nowMs: 1_100 + hud.HUD_FRUIT_POP_MS - 1 })).showFruit,
    true,
    "fruit popup closed before its timer elapsed",
  );
  assert.equal(
    state.update(frame({ fruitCollectionRevision: 1, nowMs: 1_100 + hud.HUD_FRUIT_POP_MS })).showFruit,
    false,
    "fruit popup outlived its timer",
  );
  assert.equal(
    state.update(frame({ fruitCollectionRevision: 0, nowMs: 3_000 })).showFruit,
    false,
    "a revision reset was misclassified as fruit collection",
  );
  assert.equal(
    state.update(frame({ fruitCollectionRevision: 2, nowMs: 3_100 })).showFruit,
    true,
    "collection after a rollover/reset did not reopen the fruit popup",
  );
  state.clearTransient();
  assert.equal(
    state.update(frame({ fruitCollectionRevision: 2, nowMs: 3_101 })).showFruit,
    false,
    "run/restart transient clear left a fruit popup armed",
  );
}

{
  const state = new hud.HudVisibilityState();
  state.update(frame());
  let visibility = state.update(frame({
    inventoryHeld: true,
    hasEarnedRelic: true,
    nowMs: 2_000,
  }));
  assert.equal(visibility.showBoxes, true, "L2 did not reveal the box tally");
  assert.equal(
    visibility.showEarnedRelics,
    true,
    "L2 did not reveal earned relic inventory",
  );

  visibility = state.update(frame({
    hasEarnedRelic: true,
    nowMs: 2_000 + hud.HUD_INVENTORY_LINGER_MS - 1,
  }));
  assert.equal(visibility.showBoxes, true, "inventory did not linger after L2 release");
  assert.equal(visibility.showEarnedRelics, true);

  visibility = state.update(frame({
    hasEarnedRelic: true,
    nowMs: 2_000 + hud.HUD_INVENTORY_LINGER_MS,
  }));
  assert.equal(visibility.showBoxes, false, "inventory outlived its reveal timer");
  assert.equal(visibility.showEarnedRelics, false);

  visibility = state.update(frame({ inventoryHeld: true, nowMs: 5_000 }));
  assert.equal(visibility.showBoxes, true);
  assert.equal(
    visibility.showEarnedRelics,
    false,
    "an unearned relic exposed a ghost placeholder",
  );
}

{
  const state = new hud.HudVisibilityState();
  const visibility = state.update(frame({
    mode: "bonus",
    fruitCollectionRevision: 12,
    hasEarnedRelic: true,
    nowMs: 8_000,
  }));
  assert.deepEqual(visibility, {
    showLife: true,
    showBonusTitle: true,
    showFruit: true,
    showBoxes: true,
    showEarnedRelics: false,
  }, "bonus stages must keep their title and numeric tally visible");
}

{
  const input = await text("src/input.ts");
  assert.match(input, /k\.has\('KeyI'\)/, "keyboard inventory fallback is missing");
  assert.match(
    input,
    /pad\.buttons\[6\]\?\.pressed;\s*\/\/ L2 = collection inventory/,
    "standard-gamepad L2 is not mapped to inventory",
  );
  const replay = await text("src/replay.ts");
  const channels = replay.match(/const CHANNELS = \[[\s\S]*?\] as const;/)?.[0] ?? "";
  assert.doesNotMatch(
    channels,
    /inventoryHeld/,
    "presentation-only inventory input leaked into deterministic replay channels",
  );

  const level = await text("src/level.ts");
  assert.match(level, /hudMode\?: "bonus";/, "custom level bonus HUD tag is missing");
  assert.match(
    level,
    /hudMode: "standard" \| "bonus" = "standard";/,
    "runtime Level HUD mode is missing",
  );
  assert.match(
    level,
    /source\.hudMode !== undefined && source\.hudMode !== "bonus"/,
    "custom level HUD mode is not validated",
  );
  assert.match(
    level,
    /builtin\.data\?\.hudMode && override\.data && !override\.data\.hudMode/,
    "legacy edited bonus levels do not inherit built-in HUD semantics",
  );
  const bonus = await text("src/levels/bonus-level.ts");
  assert.match(bonus, /hudMode: "bonus"/, "the source bonus stage is not marked");
  const touch = await text("src/touch.ts");
  assert.match(touch, /inventoryActive\(\): boolean/,
    "touch controls have no L2-equivalent inventory gesture");
  assert.match(input, /inventory = inventory \|\| tc\.inventoryActive\(\)/,
    "touch inventory gesture is not merged into presentation input");
}

console.log("Validated regular/bonus HUD visibility, reveal timers, earned-only relics, and L2 semantics.");
