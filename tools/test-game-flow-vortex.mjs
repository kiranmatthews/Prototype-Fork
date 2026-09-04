import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [stage, flow, main, field] = await Promise.all([
  readFile(`${root}src/gameFlowVortex.ts`, "utf8"),
  readFile(`${root}src/gameFlowUI.ts`, "utf8"),
  readFile(`${root}src/main.ts`, "utf8"),
  readFile(`${root}src/swirlfield.ts`, "utf8"),
]);

assert.match(stage, /FIELD_SWIRL_PRESETS\.vortex/);
assert.match(stage, /new FieldSwirl\(preset, \{ seed: 37 \}\)/);
assert.doesNotMatch(
  stage,
  /new THREE\.WebGLRenderer/,
  "the presentation vortex must reuse the gameplay WebGL context",
);
assert.doesNotMatch(
  stage,
  /fieldSwirls\.(?:spawn|attach|update|clear)/,
  "level-owned field effects must not own the persistent menu background",
);
assert.doesNotMatch(stage, /requestAnimationFrame/,
  "the vortex must stay on the existing game RAF");
assert.match(stage, /const TARGET_FRAME_MS = 1000 \/ 30/);
assert.match(stage, /this\.reducedMotion && this\.renderedThisActivation/);
assert.match(stage, /renderer\.getRenderTarget\(\)/);
assert.match(stage, /renderer\.setRenderTarget\(savedTarget\)/);
assert.match(stage, /renderer\.clearDepth\(\)[\s\S]{0,100}renderer\.render\(this\.maskScene/,
  "Game Over mask must share the existing renderer after the vortex pass");
assert.match(stage, /if \(this\.maskLoadStarted \|\| this\.disposed\) return/,
  "bone-mask assets must load once per app session");

const policy = flow.match(/get vortexBackgroundActive\(\): boolean \{[\s\S]*?\n  \}/)?.[0] ?? "";
for (const screen of ["launch", "new-slots", "load-slots", "confirm-new", "gameover"])
  assert.ok(policy.includes(`this.screen === "${screen}"`), `${screen} lost vortex ownership`);
assert.ok(policy.includes("this.loadingVortexActive"),
  "screen-less loading transitions must retain the vortex");
assert.ok(!policy.includes('this.screen === "pause"'), "Pause must retain frozen gameplay");
assert.ok(!policy.includes('this.screen === "results"'), "Results must retain its posed scene");
assert.match(
  flow,
  /get vortexGameOverMaskActive\(\): boolean \{\s*return !this\.loadingVortexActive && this\.screen === "gameover";/,
  "loading out of Game Over must show the vortex without retaining the mask",
);
assert.match(flow, /classList\.add\("vortex"\)/);
assert.match(flow, /classList\.remove\("vortex"/);
assert.match(flow, /game-shell-transitioning \.game-hud-layer/,
  "loading vortex must not retain the gameplay HUD");
assert.match(flow, /game-shell-transitioning \.tc-zone/,
  "loading vortex must not retain touch controls");
assert.match(flow, /game-over-layout[^\n]*background: rgba\(0,0,0,\.18\)/,
  "opaque Game Over CSS would hide the vortex");
assert.match(flow, /game-flow-mask-ready \.game-over-mask-fallback/);
assert.doesNotMatch(flow, /new THREE\.WebGLRenderer/,
  "Game Over must not create a second WebGL context");

assert.match(main, /const gameFlowVortex = new GameFlowVortex\(\)/);
assert.match(main, /getGameFlowVortexDiagnostics: \(\) => gameFlowVortex\.diagnostics/);
assert.match(
  main,
  /if \(gameFlow\.vortexBackgroundActive\)[\s\S]{0,240}gameFlowVortex\.render\(/,
  "blocked title/loading/Game Over frames must route to the presentation scene",
);
assert.match(field, /const bend = wob[\s\S]{0,180}: 0;/,
  "zero-wobble vortex preset should skip unused sine work");
assert.match(field, /const g = mot[\s\S]{0,220}: 0;/,
  "zero-mottle vortex preset should skip unused sine work");
assert.ok(
  (field.match(/THREE\.DynamicDrawUsage/g) ?? []).length >= 3,
  "each per-frame Gouraud attribute must advertise dynamic buffer usage",
);

console.log("Validated shared-context Gouraud vortex ownership for title, loading, and Game Over.");
