import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const [main, flow, level, swirls, player] = await Promise.all([
  readFile(`${root}src/main.ts`, "utf8"),
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/level.ts`, "utf8"),
  readFile(`${root}src/swirls.ts`, "utf8"),
  readFile(`${root}src/player.ts`, "utf8"),
]);

// Exercise the actual button callback in production, where shellBypass is
// false. Merely opening the debug panel does not prove a level click works.
const levelSelectCallback = main.slice(
  main.indexOf("ui.onLevelSelect ="),
  main.indexOf("ui.onToggle2P ="),
);
assert.ok(levelSelectCallback, "debug level callback is missing");
for (const screen of [null, "launch", "pause", "results", "gameover"]) {
  const events = [];
  const active = screen === "launch" ? null : { slot: 2 };
  const bonus = screen === "pause"
    ? { parentState: { lives: 7, fruit: 43 } }
    : null;
  let finishAssets;
  const assets = new Promise((resolve) => { finishAssets = resolve; });
  let transition;
  const context = {
    ui: {}, shellBypass: false, paused: true, pendingCompletion: { kind: "normal" },
    bonusSession: bonus,
    findLevel: (id) => id === "sky" ? { id } : null,
    guardGameplayFromMenu: () => events.push("guard"),
    restoreCommittedRunRewards: () => events.push("restore-rewards"),
    player: { lives: 0, fruit: 0, bankFlyingFruit: () => events.push("bank-fruit") },
    campaign: {
      active,
      startEphemeral() { events.push("ephemeral"); this.active = { slot: 0 }; },
    },
    switchLevel: (...args) => {
      args[4]?.(); // successful construction admits the menu's run-state commit
      events.push(args.slice(0, 3));
      return true;
    },
    prepareActivePresentationAssets: () => assets,
    gameFlow: {
      blocksGameplay: screen !== null,
      transition(action) { transition = action(); return transition; },
      hide: () => events.push("hide"),
    },
  };
  runInNewContext(levelSelectCallback, context);
  context.ui.onLevelSelect("missing");
  assert.deepEqual(events, [], "an invalid debug selection mutated the run");
  context.ui.onLevelSelect("sky");
  assert.ok(transition, `debug level selection was blocked from ${screen ?? "gameplay"}`);
  assert.equal(context.paused, false);
  assert.equal(context.pendingCompletion, null);
  assert.ok(events.some((event) => Array.isArray(event) &&
    event.join(",") === "sky,false,true"));
  assert.equal(events.includes("ephemeral"), active === null);
  if (active) assert.equal(context.campaign.active, active, "debug jump replaced the active save");
  if (bonus) {
    assert.equal(context.player.lives, 7);
    assert.equal(context.player.fruit, 43);
  }
  assert.equal(events.includes("hide"), false, "menu revealed before assets were ready");
  finishAssets();
  await transition;
  assert.equal(events.at(-1), "hide", "debug jump left the game menu blocking play");
}

assert.match(
  main,
  /if \(gameFlow\.consumeGameplayFrameRequest\(\)\)/,
  "ordinary gameplay pause screens must retain their frozen-world path",
);
const mainAst = ts.createSourceFile("main.ts", main, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let mapBackgroundBranch;
const findMapBranch = (node) => {
  if (ts.isIfStatement(node) && node.expression.getText(mainAst).includes("gameFlow.liveMapBackground"))
    mapBackgroundBranch = node;
  ts.forEachChild(node, findMapBranch);
};
findMapBranch(mainAst);
assert.ok(mapBackgroundBranch, "live map scenery branch is missing");
const liveMap = mapBackgroundBranch.thenStatement.getText(mainAst);
assert.match(liveMap, /level\.updateCampaignMapPresentation\(dt\)/);
assert.match(liveMap, /updateWaterPresentation\(dt\)/);
assert.match(liveMap, /renderGameplayWithGameFlow\(dt\)/);
assert.doesNotMatch(liveMap, /player\.step|worldMapController\.step|level\.update\(dt\)|captureGameplay/, "live scenery must not resume map navigation or gameplay simulation");
// Execute the actual guard for native, copied and ordinary levels. A copied
// campaign map has a user id, but must retain the native map's scenic behavior.
for (const [id, isCampaignMap, background, expected] of [
  ["warproom", false, true, true], ["custom-map", true, true, true],
  ["jungle", false, true, false], ["custom-map", true, false, false],
  ["warproom", true, false, false],
]) {
  const actual = runInNewContext(mapBackgroundBranch.expression.getText(mainAst), {
    current: { id }, level: { isCampaignMap }, gameFlow: { liveMapBackground: background },
  });
  assert.equal(actual, expected, `live map guard for ${id}/${isCampaignMap}/${background}`);
}
assert.match(flow, /get liveMapBackground\(\): boolean \{\s*return this\.mapDirect && this\.screen !== null && !this\.transitionActive;/);
assert.match(level, /updateCampaignMapPresentation\(dt: number\): void \{\s*this\.campaignWorldMap\?\.update\(dt\);\s*\}/, "menu scenic updates must be isolated from general Level simulation");
assert.match(
  main,
  /renderGameplayScene\(dt, false, level\.hudMode !== "hub"\)/,
  "the warp room must not composite its deliberately hidden HUD",
);
assert.match(
  main,
  /player\.bonusMode = true;[\s\S]{0,320}player\.lives = 0;[\s\S]{0,80}player\.fruit = 0;/,
  "bonus stages must expose a zero-based temporary reward purse",
);
assert.match(
  main,
  /mergeCompletedBonusInventory\(/,
  "completed bonus rewards must merge into the suspended parent inventory",
);
const launchFlow =
  flow.match(/private renderLaunch\(\): void \{[\s\S]*?\n  \}\n\n  private renderSlots/)?.[0] ?? "";
assert.ok(launchFlow, "launch-menu flow could not be inspected");
assert.match(
  launchFlow,
  /const continueSlot = this\.campaign\.continueSlot\(\);[\s\S]*if \(continueSlot !== null\)/,
  "Continue must exist only when CampaignStore resolves a valid save slot",
);
const continueAt = launchFlow.indexOf('this.button(\n        "CONTINUE"');
const continuePushAt = launchFlow.indexOf("actions.push(continueButton)");
const newGameAt = launchFlow.indexOf('this.button("NEW GAME"');
const loadGameAt = launchFlow.indexOf('this.button("LOAD GAME"');
const menuAppendAt = launchFlow.indexOf("menu.append(...actions)");
assert.ok(
  continueAt >= 0 &&
    continueAt < continuePushAt &&
    continuePushAt < newGameAt &&
    newGameAt < loadGameAt &&
    loadGameAt < menuAppendAt,
  "Continue must be created first so visual and keyboard/gamepad order agree",
);
assert.match(
  launchFlow,
  /"CONTINUE",[\s\S]{0,100}this\.callbacks\.onLoadGame\(continueSlot\)/,
  "Continue must use the normal save-load transition path",
);
const switchLevelFlow =
  main.match(/function switchLevel\([\s\S]*?\n}\n\nfunction currentCampaignName/)?.[0] ?? "";
assert.ok(switchLevelFlow, "switchLevel flow could not be inspected");
assert.doesNotMatch(
  switchLevelFlow,
  /ui\.showMessage\((?!\s*"LEVEL LOAD FAILED")/,
  "level switches must not raise an intrusive full-screen level-name splash",
);
const bonusEntryFlow =
  main.match(/function enterBonusRound\([\s\S]*?\n}\n\nfunction returnFromBonus/)?.[0] ?? "";
assert.ok(bonusEntryFlow, "bonus-entry flow could not be inspected");
assert.match(bonusEntryFlow, /player\.ttActive \|\| level\.timeTrial/, 'bonus entry needs a mode-level guard even after the player clock stops');
assert.match(main, /!player\.ttActive &&\s*!level\.timeTrial &&/, 'bonus polling must exclude trial mode');
assert.doesNotMatch(
  bonusEntryFlow,
  /BONUS ROUND!|break every box — falls return you safely/,
  "bonus entry must rely on its persistent HUD instead of a full-screen splash",
);
const bonusReturnFlow =
  main.match(/function returnFromBonus\([\s\S]*?\n}\n\nfunction checkCampaignEntrances/)?.[0] ?? "";
assert.ok(bonusReturnFlow, "bonus-return flow could not be inspected");
assert.doesNotMatch(
  bonusReturnFlow,
  /ui\.showMessage\(|BONUS COMPLETE!|BONUS MISSED|temporary rewards lost/,
  "bonus completion/failure must return through the persistent HUD without a full-screen splash",
);
assert.match(
  player,
  /else if \(this\.bonusMode\)[\s\S]{0,120}this\.onBonusDeath\(\);[\s\S]{0,100}else if \(this\.gameOverPending\)/,
  "zero-life bonus failure must return to the parent before Game Over logic",
);
assert.match(
  player,
  /else if \(!this\.bonusMode\) \{[\s\S]{0,500}if \(this\.lives <= 0\)[\s\S]{0,100}this\.lives = 0;[\s\S]{0,100}this\.gameOverPending = true;[\s\S]{0,100}else this\.lives--;/,
  "bonus death must stay free while campaign deaths clamp and latch their zero-life boundary",
);
assert.match(
  flow,
  /this\.screen !== "pause" \|\| this\.thumbnailCaptured/,
  "pause thumbnail must be captured only once",
);
assert.doesNotMatch(
  flow,
  /backdrop-filter: blur/,
  "fullscreen menu blur is too expensive for the gameplay shell",
);
assert.match(
  level,
  /this\.scene\.remove\(this\.root\)/,
  "a suspended bonus parent must be detached from scene traversal",
);
assert.match(
  level,
  /updateCampaignPortalAnimation\([\s\S]{0,100}playerX = this\.playerPos\.x,[\s\S]{0,80}playerZ = this\.playerPos\.z/,
  "the long warp-room row must suspend only distant portal animation",
);
assert.match(
  level,
  /portal\.swirl\.paused/,
  "distant portal deformation must use a frozen complete frame",
);
assert.doesNotMatch(
  level,
  /portal\.visual\.visible/,
  "distance optimization must never pop complete gate visuals",
);
assert.match(
  level,
  /SWIRL_PRESETS\.warpPortal,[\s\S]{0,80}segs: 24/,
  "warp portals must retain the low-poly gallery budget",
);
assert.match(
  level,
  /setCampaignPortalProgress\(/,
  "warp gates must expose their earned-award display",
);
assert.match(
  level,
  /courseLength \* 0\.5/,
  "bonus platforms must search around the route midpoint",
);
assert.match(
  level,
  /if \(this\.blastBroken\.length === 0\) return NO_BROKEN_CRATES/,
  "the two fixed-step reward drains must not allocate on their empty path",
);
assert.match(
  swirls,
  /if \(!this\.group\.visible\) return;/,
  "hidden portal swirls must skip dynamic buffer uploads",
);
assert.match(
  swirls,
  /this\.backMesh\.frustumCulled = true;[\s\S]{0,80}this\.addMesh\.frustumCulled = true;/,
  "fully offscreen swirl draws must use conservative frustum culling",
);

console.log("Validated campaign frame-cost guards, splash policy, hub HUD, portals, and bonus suspension.");
