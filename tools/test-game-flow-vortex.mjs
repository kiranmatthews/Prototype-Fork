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
assert.match(stage, /export class GameFlowVortexHost/);
assert.match(stage, /private stage: GameFlowVortexStage \| null = null/);
const hostStart = stage.indexOf("export class GameFlowVortexHost");
const hostEnd = stage.indexOf("class GameFlowVortexStage");
assert.ok(hostStart >= 0 && hostEnd > hostStart, "host/stage ownership boundary missing");
const hostSource = stage.slice(hostStart, hostEnd);
assert.doesNotMatch(
  hostSource,
  /new THREE\.|new FieldSwirl/,
  "an inactive host must not allocate THREE presentation resources",
);
assert.match(
  hostSource,
  /private ensureStage\(\): GameFlowVortexStage[\s\S]{0,180}new GameFlowVortexStage\(\)/,
  "the THREE stage must be created lazily by render",
);
assert.match(
  hostSource,
  /deactivate\(\): void \{[\s\S]{0,280}stage\.dispose\(\);[\s\S]{0,120}this\.stage = null;[\s\S]{0,120}this\.disposeCount\+\+/,
  "deactivation must dispose and release the resident stage",
);
assert.doesNotMatch(stage, /PresentationFrameLimiter|VORTEX_RENDER_HZ/,
  "the vortex must share the outer gameplay cadence without a quality gate");
assert.match(stage, /targetFps: 60/);
assert.match(stage, /cadenceOwner: "gameplay-render-loop"/);
assert.match(stage, /this\.reducedMotion && stage\.renderedOnce/);
assert.match(stage, /renderer\.getRenderTarget\(\)/);
assert.match(stage, /renderer\.setRenderTarget\(savedTarget, savedFace, savedMip\)/);
assert.match(
  stage,
  /try \{[\s\S]{0,600}renderer\.setRenderTarget\(null\);[\s\S]{0,400}renderer\.render\(this\.vortexScene, this\.vortexCamera\);[\s\S]{0,700}finally \{[\s\S]{0,400}renderer\.setRenderTarget\(savedTarget, savedFace, savedMip\)/,
  "presentation exceptions must restore shared gameplay renderer state",
);
assert.match(stage, /renderer\.clearDepth\(\)[\s\S]{0,100}renderer\.render\(this\.maskScene/,
  "Game Over mask must render directly after the vortex pass");
assert.match(stage, /if \(this\.maskLoadStarted \|\| this\.disposed\) return/,
  "bone-mask assets must load once per resident stage");

for (const fieldName of [
  "resident",
  "targetWidth",
  "targetHeight",
  "scenePasses",
  "compositePasses",
  "maskPasses",
  "createCount",
  "disposeCount",
]) {
  assert.match(
    stage,
    new RegExp(`${fieldName}:`),
    `diagnostics must expose ${fieldName}`,
  );
}
assert.match(stage, /resident: this\.stage !== null/);
assert.match(stage, /get resident\(\): boolean \{\s*return this\.stage !== null;/);
assert.match(stage, /this\.createCount\+\+/);
assert.match(stage, /this\.scenePasses\+\+/);
assert.doesNotMatch(stage, /this\.compositePasses\+\+/,
  "direct rendering must report zero composite passes");
assert.match(stage, /if \(result\.maskRendered\) this\.maskPasses\+\+/);

assert.match(stage, /renderer\.getDrawingBufferSize\(this\.drawingBufferSize\)/);
assert.match(stage, /renderer\.getSize\(this\.canvasSize\)/);
assert.match(
  stage,
  /renderer\.setRenderTarget\(null\)[\s\S]{0,300}renderer\.setViewport\(0, 0, this\.canvasSize\.x, this\.canvasSize\.y\)[\s\S]{0,300}renderer\.render\(this\.vortexScene, this\.vortexCamera\)/,
  "both ordered Gouraud meshes must render directly at full canvas resolution",
);
assert.doesNotMatch(
  stage,
  /WebGLRenderTarget|compositeScene|compositeCamera|compositeMaterial|gameFlowVortexTargetSize|MAX_TARGET_(?:WIDTH|HEIGHT)/,
  "the full-quality vortex must not retain a low-resolution upscale path",
);
assert.match(stage, /this\.vortex\.dispose\(\)/,
  "deactivation must release the Gouraud geometry and materials");

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
assert.match(
  flow,
  /transitionCurtain\.setAttribute\("aria-hidden", "true"\);[\s\S]{0,260}transitionCurtain\.hidden = true;/,
  "inactive transition curtain must begin outside layout",
);
const transitionLifecycle =
  flow.match(/async transition\(action:[\s\S]*?\n  \}/)?.[0] ?? "";
const revealCurtain = transitionLifecycle.indexOf(
  "this.transitionCurtain.hidden = false",
);
const settleCurtain = transitionLifecycle.indexOf(
  "void this.transitionCurtain.offsetWidth",
);
const activateCurtain = transitionLifecycle.indexOf(
  'this.transitionCurtain.classList.add("active")',
);
assert.ok(
  revealCurtain >= 0 &&
    revealCurtain < settleCurtain &&
    settleCurtain < activateCurtain,
  "curtain must expose and settle opacity zero before fade activation",
);
const deactivateCurtain = transitionLifecycle.indexOf(
  'this.transitionCurtain.classList.remove("vortex", "active")',
);
const fadeCleanup = transitionLifecycle.indexOf(
  "await wait(this.reducedMotion ? 20 : 520)",
  deactivateCurtain,
);
const hideCurtain = transitionLifecycle.indexOf(
  "this.transitionCurtain.hidden = true",
  deactivateCurtain,
);
assert.ok(
  deactivateCurtain >= 0 &&
    deactivateCurtain < fadeCleanup &&
    fadeCleanup < hideCurtain,
  "curtain must stay displayed until its normal/reduced-motion fade cleanup",
);
assert.match(
  flow,
  /\.game-transition-curtain\[hidden\] \{ display: none !important; \}/,
  "hidden curtain must release its full-viewport compositor layer",
);
assert.match(flow, /game-shell-transitioning \.game-hud-layer/,
  "loading vortex must not retain the gameplay HUD");
assert.match(flow, /game-shell-transitioning \.tc-zone/,
  "loading vortex must not retain touch controls");
assert.match(flow, /game-over-layout[^\n]*background: rgba\(0,0,0,\.18\)/,
  "opaque Game Over CSS would hide the vortex");
assert.match(flow, /game-flow-mask-ready \.game-over-mask-fallback/);
assert.doesNotMatch(flow, /new THREE\.WebGLRenderer/,
  "Game Over must not create a second WebGL context");

assert.match(main, /const gameFlowVortex = new GameFlowVortex(?:Host)?\(\)/);
assert.match(main, /const GAMEPLAY_RENDER_HZ = 60/);
assert.match(main, /getGameFlowVortexDiagnostics: \(\) => gameFlowVortex\.diagnostics/);
assert.match(
  main,
  /function releaseGameplayPostForGameFlow\(\): void \{[\s\S]{0,220}coastPost\.suspendForGameFlow\(\);/,
  "loading must release the mutually-exclusive gameplay post targets",
);
assert.match(
  main,
  /if \(!gameFlowVortex\.resident\)\s*releaseGameplayPostForGameFlow\(\);[\s\S]{0,180}gameFlowVortex\.render\(/,
  "post targets must collapse before the full-quality vortex takes renderer ownership",
);
assert.match(
  main,
  /configureCoastPost\([\s\S]{0,260}if \(coastPost\?\.suspended\) \{[\s\S]{0,120}coastPost\.resumeFromGameFlow\(\);/,
  "the destination frame must recreate gameplay post resources under the fade",
);
assert.doesNotMatch(
  main,
  /loadSky\(DEFAULT_SKY\);/,
  "startup must not decode an unused default sky behind the launch screen",
);
assert.match(main, /const skyPending = new Map<SkyPreset, PendingSkyLoad>\(\)/);
assert.match(main, /function retainOnlyActiveSky\(\): void/);
assert.match(
  main,
  /texture\.dispose\(\);[\s\S]{0,420}canvas\.width = 1;[\s\S]{0,80}canvas\.height = 1;/,
  "sky eviction must release GPU and decoded-canvas backing",
);
assert.match(
  main,
  /let bonusParallax: BonusParallax \| null = null/,
  "bonus backdrop must have no app-start asset owner",
);
assert.match(main, /function releaseBonusParallax\(\): void/);
assert.match(main, /async function prepareActivePresentationAssets\(\): Promise<void>/);
assert.match(main, /await prepareActivePresentationAssets\(\);/);
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

console.log("Validated lazy, direct full-resolution 60 Hz Gouraud vortex ownership and lifecycle.");
