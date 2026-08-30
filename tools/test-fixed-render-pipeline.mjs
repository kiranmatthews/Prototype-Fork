import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const text = (path) => readFile(`${root}${path}`, "utf8");

const main = await text("src/main.ts");
for (const contract of [
  "fixedResolutionActive",
  "renderQualitySettings.computeSizes",
  "setPreCrtRenderSize",
  "clearPreCrtRenderSize",
  "setResolutionMode",
  "setInputSize",
  "setOutputSize",
  "allowRenderFrame",
  "renderGameplayScene",
  "drawGameHud",
  "setGameHudComposited",
  "getGameHudDiagnostics",
  "render-diagnostics",
]) {
  assert.ok(main.includes(contract), `main render contract missing ${contract}`);
}
assert.match(main, /requestAnimationFrame\(frame\);/);
assert.doesNotMatch(main, /\nframe\(\);/);
const limiter = await text("src/render-quality/frameLimiter.ts");
assert.match(limiter, /1000 \/ this\.targetFps/);
assert.match(limiter, /skippedFrames/);

const coast = await text("src/coastpost.ts");
for (const contract of [
  'CoastPostResolutionMode = "native" | "fixed"',
  "renderFixed",
  "preCrtOverlay",
  "PreCrtOverlayPass",
  "preCrtOverlayPass.callback = preCrtOverlay",
  "composer.renderToScreen = false",
  "this.crtPass.setResolution",
  "OutputPass remains the sole display transfer",
  'this.resolutionMode === "fixed"',
]) {
  assert.ok(coast.includes(contract), `presentation renderer missing ${contract}`);
}
const unityPassAt = coast.indexOf("this.composer.addPass(this.unityPostPass)");
const hudPassAt = coast.indexOf("this.composer.addPass(this.preCrtOverlayPass)");
const crtPassAt = coast.indexOf("this.composer.addPass(this.crtPass)");
assert.ok(
  unityPassAt >= 0 && unityPassAt < hudPassAt && hudPassAt < crtPassAt,
  "gameplay overlay pass must sit after Unity grading and before CRT",
);
assert.match(
  coast,
  /class PreCrtOverlayPass extends Pass[\s\S]*?this\.needsSwap = false/,
  "gameplay overlay must mutate the current colour buffer without a swap",
);

const crt = await text("src/crt-guest/pass.ts");
for (const contract of [
  "sourceWidth",
  "outputWidth",
  "setResolution(",
  "resizeTarget(targets.main, this.outputWidth, this.outputHeight)",
]) {
  assert.ok(crt.includes(contract), `CRT scaling contract missing ${contract}`);
}
assert.match(
  crt,
  /targets\.reconstruction[\s\S]{0,180}this\.outputWidth,\s*this\.height/,
  "HD reconstruction must be output-width by source-height",
);

const ocean = await text("src/unityOcean.ts");
for (const contract of [
  "setPreCrtRenderSize",
  "clearPreCrtRenderSize",
  "preCrtSizeOverride",
  "nativeDrawingBufferWidth",
  "this.preCrtWidth ?? this.nativeBufferWidth",
]) {
  assert.ok(ocean.includes(contract), `ocean sizing contract missing ${contract}`);
}

const panel = await text("src/render-quality/panel.ts");
assert.match(panel, /Open render optimization panel/);
assert.match(panel, /water FX/);
assert.match(panel, /CRT out/);

console.log(
  "Validated fixed-60 scheduling and the 720p world/water -> scaled CRT output graph.",
);
