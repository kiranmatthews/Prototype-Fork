import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [main, flow, level, swirls] = await Promise.all([
  readFile(`${root}src/main.ts`, "utf8"),
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/level.ts`, "utf8"),
  readFile(`${root}src/swirls.ts`, "utf8"),
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
  /updateCampaignPortalVisibility\(playerX = this\.playerPos\.x\)/,
  "the long warp-room row must distance-cull portal visuals",
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

console.log("Validated campaign frame-cost guards for menus, hub HUD, portals, and bonus suspension.");
