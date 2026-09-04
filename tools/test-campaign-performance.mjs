import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [main, flow, level, swirls, player] = await Promise.all([
  readFile(`${root}src/main.ts`, "utf8"),
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/level.ts`, "utf8"),
  readFile(`${root}src/swirls.ts`, "utf8"),
  readFile(`${root}src/player.ts`, "utf8"),
]);

assert.match(
  main,
  /if \(gameFlow\.consumeGameplayFrameRequest\(\)\)/,
  "modal screens must not redraw the frozen gameplay world every frame",
);
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
assert.match(
  player,
  /else if \(this\.bonusMode\)[\s\S]{0,120}this\.onBonusDeath\(\);[\s\S]{0,80}else if \(this\.lives <= 0\)/,
  "zero-life bonus failure must return to the parent before Game Over logic",
);
assert.match(
  player,
  /else if \(!this\.bonusMode\) this\.lives--;/,
  "bonus death must never spend a parent or temporary life",
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
  /updateCampaignPortalAnimation\(playerX = this\.playerPos\.x\)/,
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

console.log("Validated campaign frame-cost guards for menus, hub HUD, portals, and bonus suspension.");
