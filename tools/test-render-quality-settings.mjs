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
  outputMultiplier: 1,
  fixed60: true,
});
assert.deepEqual(settings.computeSizes(1280, 720), {
  viewportWidth: 1280,
  viewportHeight: 720,
  inputWidth: 1280,
  inputHeight: 720,
  outputWidth: 1280,
  outputHeight: 720,
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
  inputWidth: 540,
  inputHeight: 1169,
  outputWidth: 1620,
  outputHeight: 3507,
});

// Rotation must transpose exactly, preserving physical density and fill cost.
// Viewport size only changes aspect; no display-DPR argument is involved.
for (const baseHeight of api.RENDER_BASE_HEIGHTS) {
  settings.setBaseHeight(baseHeight);
  for (const [width, height] of [[393,852],[390,844],[320,568],[768,1024],[720,1280],[1080,1920]]) {
    for (const multiplier of api.RENDER_OUTPUT_MULTIPLIERS) {
      settings.setOutputMultiplier(multiplier);
      const portrait = settings.computeSizes(width, height);
      const landscape = settings.computeSizes(height, width);
      assert.equal(portrait.inputWidth, baseHeight);
      assert.equal(landscape.inputHeight, baseHeight);
      assert.equal(portrait.inputHeight, landscape.inputWidth);
      assert.equal(portrait.outputWidth, landscape.outputHeight);
      assert.equal(portrait.outputHeight, landscape.outputWidth);
      assert.equal(portrait.inputWidth * portrait.inputHeight,
        landscape.inputWidth * landscape.inputHeight);
      assert.ok(Math.abs(portrait.inputHeight / portrait.inputWidth - height / width) <= 0.5 / baseHeight + 1e-12);
    }
  }
}
assert.equal(settings.regularResolution, "custom");
for (const value of [540, 720, 1080]) {
  settings.setRegularResolution(value);
  assert.equal(settings.enabled, true);
  assert.equal(settings.outputMultiplier, 1);
  assert.equal(settings.regularResolution, value);
  assert.equal(settings.computeSizes(393,852).outputWidth, value);
}
settings.setBaseHeight(900);
assert.equal(settings.regularResolution, "custom");
settings.setRegularResolution(null);
assert.equal(settings.regularResolution, "max");
assert.equal(settings.enabled, false);
assert.throws(() => settings.setRegularResolution(640), /Unsupported/);
settings.reset();
assert.equal(settings.regularResolution, 720);
assert.deepEqual(settings.computeSizes(720,720), {
  viewportWidth:720, viewportHeight:720, inputWidth:720, inputHeight:720,
  outputWidth:720, outputHeight:720,
});
for (const [width, height] of [[0,0],[NaN,Infinity],[-1,-2]]) {
  const size = settings.computeSizes(width, height);
  assert.equal(size.inputWidth,720);
  assert.equal(size.inputHeight,720);
}

// V1 silently overrode touch output; V2 makes authoring scales explicit on
// every device while preserving base resolution, MAX and the frame limiter.
for (const enabled of [true, false]) {
  for (const version of [1, api.RENDER_QUALITY_VERSION]) {
    const stored = {version, enabled, baseHeight:540, outputMultiplier:3, fixed60:false};
    let written;
    const loaded = new api.RenderQualitySettings({storage:{
      getItem: key => { assert.equal(key, api.RENDER_QUALITY_STORAGE_KEY); return JSON.stringify(stored); },
      setItem: (key, value) => { written=JSON.parse(value); },
    }});
    assert.deepEqual(loaded.snapshot(), {
      enabled, baseHeight:540, outputMultiplier:version===1?1:3, fixed60:false,
    });
    loaded.setRegularResolution(720);
    assert.deepEqual(written, {version:api.RENDER_QUALITY_VERSION, enabled:true, baseHeight:720, outputMultiplier:1, fixed60:false});
  }
}
const unreadable = new api.RenderQualitySettings({storage:{getItem:()=>'{broken',setItem:()=>{throw Error('full');}}});
assert.equal(unreadable.regularResolution,720);
assert.doesNotThrow(()=>unreadable.setRegularResolution(540));

settings.setRegularResolution(1080);
const high = settings.computeSizes(393,852);
settings.setRegularResolution(540);
const low = settings.computeSizes(393,852);
assert.ok(Math.abs(low.inputWidth*low.inputHeight/(high.inputWidth*high.inputHeight)-0.25)<0.001,
  "540p must rasterize one quarter as many pixels as 1080p");

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
