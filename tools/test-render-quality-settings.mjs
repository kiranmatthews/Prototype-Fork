import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/render-quality/settings.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", output)(module, module.exports);
const api = module.exports;

const settings = new api.RenderQualitySettings({
  storage: null,
  loadStored: false,
  persistChanges: false,
});
assert.deepEqual(settings.snapshot(), {
  enabled: true,
  baseHeight: 720,
  outputMultiplier: 2,
  fixed60: true,
});
assert.deepEqual(settings.computeSizes(1280, 720), {
  viewportWidth: 1280,
  viewportHeight: 720,
  inputWidth: 1280,
  inputHeight: 720,
  outputWidth: 2560,
  outputHeight: 1440,
});
settings.setOutputMultiplier(3);
assert.deepEqual(settings.computeSizes(1920, 1080), {
  viewportWidth: 1920,
  viewportHeight: 1080,
  inputWidth: 1280,
  inputHeight: 720,
  outputWidth: 3840,
  outputHeight: 2160,
});
settings.setBaseHeight(540);
assert.deepEqual(settings.computeSizes(390, 844), {
  viewportWidth: 390,
  viewportHeight: 844,
  inputWidth: 250,
  inputHeight: 540,
  outputWidth: 750,
  outputHeight: 1620,
});

let updates = 0;
const unsubscribe = settings.subscribe(() => updates++);
settings.setFixed60(false);
unsubscribe();
settings.setFixed60(true);
assert.equal(updates, 1);

const limiterSource = await readFile(
  `${root}src/render-quality/frameLimiter.ts`,
  "utf8",
);
const limiterOutput = ts.transpileModule(limiterSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const limiterModule = { exports: {} };
new Function("module", "exports", limiterOutput)(
  limiterModule,
  limiterModule.exports,
);
const Limiter = limiterModule.exports.PresentationFrameLimiter;
for (const hz of [60, 120, 144, 240]) {
  const limiter = new Limiter(60);
  let accepted = 0;
  for (let frame = 1; frame <= hz; frame += 1) {
    if (limiter.allow((frame * 1000) / hz, true)) accepted += 1;
  }
  assert.ok(
    accepted >= 59 && accepted <= 61,
    `${hz} Hz source produced ${accepted} presented frames`,
  );
}
const roundedSixty = new Limiter(60);
let roundedAccepted = 0;
for (let frame = 1; frame <= 600; frame += 1) {
  // Browser timestamps are commonly quantized to 0.1 ms. A strict nested
  // deadline can alias these 16.7/33.3/50.0 stamps down to 30 or even 20 Hz.
  const timestamp = Math.round(((frame * 1000) / 60) * 10) / 10;
  if (roundedSixty.allow(timestamp, true)) roundedAccepted += 1;
}
assert.ok(
  roundedAccepted >= 599 && roundedAccepted <= 600,
  `rounded 60 Hz source produced ${roundedAccepted} presented frames`,
);
const uncapped = new Limiter(60);
for (let frame = 1; frame <= 144; frame += 1)
  assert.equal(uncapped.allow((frame * 1000) / 144, false), true);
assert.equal(uncapped.stats.acceptedFrames, 144);

console.log(
  "Validated fixed-resolution sizing, persistence, and exact 60 FPS gating.",
);
