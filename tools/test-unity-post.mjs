import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as THREE from "three";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(root, file), "utf8");
const post = read("src/unityPost.ts");
const bloom = read("src/unityBloom.ts");
const lut = read("src/unityColorLut.ts");
const wrapper = read("src/coastpost.ts");

/** Execute selected dependency-free functions from their real TypeScript source. */
function loadPureFunctions(source, functionNames, constantNames = [], bindings = {}) {
  const sourceFile = ts.createSourceFile(
    "pure-functions.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const selected = [];
  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      functionNames.includes(statement.name.text)
    ) {
      selected.push(statement.getText(sourceFile));
      continue;
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          constantNames.includes(declaration.name.text),
      )
    ) {
      selected.push(statement.getText(sourceFile));
    }
  }
  assert.equal(
    selected.length,
    functionNames.length + constantNames.length,
    `could not isolate requested pure TypeScript declarations: ${[
      ...constantNames,
      ...functionNames,
    ].join(", ")}`,
  );
  const javascript = ts.transpileModule(
    selected.join("\n").replace(/\bexport\s+/g, ""),
    {
      compilerOptions: {
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const names = [...constantNames, ...functionNames];
  const bindingNames = Object.keys(bindings);
  const factory = new Function(
    ...bindingNames,
    `${javascript}\nreturn { ${names.join(", ")} };`,
  );
  return factory(...bindingNames.map((name) => bindings[name]));
}

const {
  UNITY_BLOOM_MAX_DIMENSION,
  UNITY_BLOOM_MAX_MIPS,
  unityGammaToLinear,
  unityBloomPyramidSpec,
} = loadPureFunctions(
  bloom,
  ["unityGammaToLinear", "unityBloomPyramidSpec"],
  ["UNITY_BLOOM_MAX_DIMENSION", "UNITY_BLOOM_MAX_MIPS"],
);

assert.equal(UNITY_BLOOM_MAX_DIMENSION, 960);
assert.equal(UNITY_BLOOM_MAX_MIPS, 8);
assert.equal(unityGammaToLinear(0), 0);
assert.equal(unityGammaToLinear(1), 1);
assert.ok(
  Math.abs(unityGammaToLinear(0.04045) - 0.00313080495) < 1e-10,
  "gamma threshold must use the sRGB linear toe",
);
assert.ok(
  Math.abs(unityGammaToLinear(0.78) - 0.5704816) < 1e-6,
  "Bonus' authored gamma threshold must be converted before HDR prefiltering",
);

assert.deepEqual(unityBloomPyramidSpec(1280, 720, 2, 6), {
  width: 640,
  height: 360,
  mipCount: 6,
  sizes: [
    { width: 640, height: 360 },
    { width: 320, height: 180 },
    { width: 160, height: 90 },
    { width: 80, height: 45 },
    { width: 40, height: 22 },
    { width: 20, height: 11 },
  ],
});
assert.deepEqual(
  unityBloomPyramidSpec(3840, 2160, 2, 8).sizes.slice(0, 3),
  [
    { width: 960, height: 540 },
    { width: 480, height: 270 },
    { width: 240, height: 135 },
  ],
  "native 4K bloom must be capped independently of CRT/output resolution",
);
const tinySpec = unityBloomPyramidSpec(1, 1, 4, 99);
assert.deepEqual(tinySpec, {
  width: 1,
  height: 1,
  mipCount: 1,
  sizes: [{ width: 1, height: 1 }],
});
const wideSpec = unityBloomPyramidSpec(8000, 1000, 2, 8);
assert.equal(wideSpec.width, 960);
assert.equal(wideSpec.height, 120);
assert.ok(wideSpec.mipCount <= UNITY_BLOOM_MAX_MIPS);

for (const literal of [
  "class UnityBloomPass extends Pass",
  "this.needsSwap = true",
  "URP HQ 13-sample prefilter",
  "float brightness = max(color.r, max(color.g, color.b))",
  "threshold * 0.5",
  "0.05 + this.settings.scatter * 0.9",
  "UnityBloom.PrefilterHQ13",
  "UnityBloom.Gaussian9Equivalent",
  "UnityBloom.BicubicUpsample",
  "UnityBloom.AdditiveComposite",
  "Core.hlsl SampleTexture2DBicubic",
  "vec4 bicubicFilter(float fraction)",
  'internalFormat: "RGBA16F"',
  "type: THREE.HalfFloatType",
  "colorSpace: THREE.NoColorSpace",
  "depthBuffer: false",
  "stencilBuffer: false",
  "samples: 0",
  "this.ensureTargets()",
  "this.disposeTargets()",
  "target.dispose()",
  "this.prefilterMaterial.dispose()",
  "this.blurMaterial.dispose()",
  "this.upsampleMaterial.dispose()",
  "this.compositeMaterial.dispose()",
  "this.fsQuad.dispose()",
  "visualTreatmentActivity(value).bloom",
  "setPresentationEnabled(enabled: boolean)",
  "this.enabled = this.presentationEnabled && this.lookActive",
  "const linearTint = tint.map(unityGammaToLinear)",
]) {
  assert.ok(bloom.includes(literal), `Unity bloom contract missing: ${literal}`);
}
assert.match(
  bloom,
  /private ensureTargets\(\): void \{[\s\S]*?if \([\s\S]*?currentSpec[\s\S]*?\)\s*return;[\s\S]*?allocateTargets\(\)/,
  "bloom targets must be reused while their mip specification is unchanged",
);
assert.match(
  bloom,
  /private allocateTargets\(\): void \{\s*this\.disposeTargets\(\);[\s\S]*?downTargets[\s\S]*?upTargets/,
  "a resized pyramid must dispose the previous targets before allocation",
);
assert.match(
  bloom,
  /private disposeTargets\(\): void \{[\s\S]*?target\.dispose\(\)[\s\S]*?downTargets\.length = 0[\s\S]*?upTargets\.length = 0/,
  "bloom disposal must release and forget both target chains",
);
for (const restored of [
  "renderer.setRenderTarget(previousTarget, previousFace, previousMip)",
  "renderer.setViewport(previousViewport)",
  "renderer.setScissor(previousScissor)",
  "renderer.setScissorTest(previousScissorTest)",
  "renderer.autoClear = previousAutoClear",
]) {
  assert.ok(bloom.includes(restored), `bloom does not restore renderer state: ${restored}`);
}
assert.doesNotMatch(bloom, /STREAK_|FLARE_|UnityLensFlare|lens.?flare/i);
const bicubicHelper = bloom.slice(
  bloom.indexOf("const BICUBIC_HELPER"),
  bloom.indexOf("const UPSAMPLE_FRAGMENT"),
);
assert.equal(
  (bicubicHelper.match(/texture2D\(source,/g) ?? []).length,
  4,
  "Unity/Core bicubic reconstruction must collapse to four hardware-bilinear fetches",
);
assert.doesNotMatch(
  bicubicHelper,
  /for\s*\(/,
  "HQ bloom must not regress to a sixteen-tap bicubic loop",
);

const expectedDraws = (mipCount) => 1 + 2 * (mipCount - 1) + (mipCount - 1) + 1;
assert.equal(expectedDraws(1), 2);
assert.equal(expectedDraws(6), 17);
assert.match(
  bloom,
  /for \(let index = 1; index < spec\.mipCount; index \+= 1\)[\s\S]*?draw\(this\.blurMaterial, this\.upTargets\[index\]\)[\s\S]*?draw\(this\.blurMaterial, this\.downTargets\[index\]\)/,
  "every descending mip must receive horizontal and vertical Gaussian passes",
);
assert.match(
  bloom,
  /for \(let index = spec\.mipCount - 2; index >= 0; index -= 1\)[\s\S]*?draw\(this\.upsampleMaterial, this\.upTargets\[index\]\)/,
  "the complete bloom pyramid must be reconstructed before compositing",
);

const { gammaToLinear, colorBalanceToLmsCoeffs } = loadPureFunctions(
  lut,
  [
    "gammaToLinear",
    "standardIlluminantY",
    "cieXyToLms",
    "colorBalanceToLmsCoeffs",
  ],
  [],
  { THREE },
);
assert.ok(
  Math.abs(gammaToLinear(0.72) - 0.477) < 0.001,
  "Unity picker/source filter colors must be linearized before LUT grading",
);
const neutralBalance = colorBalanceToLmsCoeffs(0, 0);
for (const channel of neutralBalance.toArray())
  assert.ok(Math.abs(channel - 1) < 2e-4, "neutral white balance must remain neutral");
const warmBalance = colorBalanceToLmsCoeffs(100, 0);
assert.ok(warmBalance.toArray().every(Number.isFinite));
assert.notDeepEqual(warmBalance.toArray(), neutralBalance.toArray());

for (const literal of [
  "class UnityColorLut",
  "UNITY_COLOR_LUT_SIZE = 32",
  "UNITY_COLOR_LUT_WIDTH = UNITY_COLOR_LUT_SIZE * UNITY_COLOR_LUT_SIZE",
  'internalFormat: "RGBA8"',
  "type: THREE.UnsignedByteType",
  "colorSpace: THREE.NoColorSpace",
  "depthBuffer: false",
  "stencilBuffer: false",
  "private dirty = true",
  "if (signature === this.signature) return",
  "if (!this.dirty || !this.settings || this.disposed) return",
  "this.dirty = false",
  "this.rebuildCount += 1",
  "this.target.dispose()",
  "this.material.dispose()",
  "this.fsQuad.dispose()",
  "gammaToLinear(value.colorFilter[0])",
]) {
  assert.ok(lut.includes(literal), `Unity color-LUT contract missing: ${literal}`);
}
for (const restored of [
  "renderer.setRenderTarget(previousTarget, previousFace, previousMip)",
  "renderer.setViewport(previousViewport)",
  "renderer.setScissor(previousScissor)",
  "renderer.setScissorTest(previousScissorTest)",
  "renderer.autoClear = previousAutoClear",
]) {
  assert.ok(lut.includes(restored), `LUT builder does not restore renderer state: ${restored}`);
}

const lutOperations = [
  "linearToLms(color) * uColorBalance",
  "linearToLogC(color)",
  "* uColorFilter",
  "softLight(gammaColor",
  "dot(color, uMixerRed)",
  "color = color * uGain + uLift",
  "vec3 hsv = rgbToHsv",
  "uHueSatCon.y * (color - vec3(luma))",
].map((needle) => lut.indexOf(needle));
assert.ok(lutOperations.every((index) => index >= 0), "LDR LUT stages are incomplete");
assert.deepEqual(
  lutOperations,
  [...lutOperations].sort((a, b) => a - b),
  "LDR LUT stages must retain Unity's white-balance-to-saturation order",
);

for (const literal of [
  'gradingMode: "low-dynamic-range"',
  "lutSize: 32",
  'lutFormat: "R8G8B8A8_UNorm"',
  "dithering: true",
  "new UnityColorLut()",
  "this.colorLut.setSettings(grading)",
  "this.colorLut.update(renderer)",
  "color = applyVignette(color)",
  "color *= uPostExposure",
  "color = neutralTonemap(color)",
  "color = acesTonemap(color)",
  "color = applyInternalLut(color)",
  "color = applyUnityDither(color)",
  "noise / 255.0",
  "this.colorLut.dispose()",
  "this.blueNoise.dispose()",
]) {
  assert.ok(post.includes(literal), `Unity grade contract missing: ${literal}`);
}
assert.doesNotMatch(post, /localBloom|brightSample|uBloom|uColorGrade|uTint/);
const gradeOperations = [
  "color = applyVignette(color)",
  "color *= uPostExposure",
  "color = acesTonemap(color)",
  "color = clamp(color, 0.0, 1.0)",
  "color = applyInternalLut(color)",
  "color = applyUnityDither(color)",
  "color = max(color, vec3(0.0))",
].map((needle) => post.indexOf(needle));
assert.ok(gradeOperations.every((index) => index >= 0), "Unity Uber stages are incomplete");
assert.deepEqual(
  gradeOperations,
  [...gradeOperations].sort((a, b) => a - b),
  "vignette, exposure, tonemap, LUT and dither must retain Unity Uber order",
);

const composerOrder = [
  "this.composer.addPass(this.renderPass)",
  "this.composer.addPass(this.smaaPass)",
  "this.composer.addPass(this.bloomPass)",
  "this.composer.addPass(this.unityPostPass)",
  "this.composer.addPass(this.preCrtOverlayPass)",
  "this.composer.addPass(this.crtPass)",
  "this.composer.addPass(this.outputPass)",
].map((needle) => wrapper.indexOf(needle));
assert.ok(composerOrder.every((index) => index >= 0), "Shared post stages are incomplete");
assert.deepEqual(composerOrder, [...composerOrder].sort((a, b) => a - b));
assert.match(
  wrapper,
  /dispose\(\): void \{[\s\S]*?this\.smaaPass\.dispose\(\)[\s\S]*?this\.bloomPass\.dispose\(\)[\s\S]*?this\.unityPostPass\.dispose\(\)[\s\S]*?this\.crtPass\?\.dispose\(\)[\s\S]*?this\.outputPass\.dispose\(\)/,
  "shared renderer must dispose every post stage in pipeline order",
);
assert.ok(
  wrapper.includes("this.bloomPass.setPresentationEnabled(unityPostActive)"),
  "the owning stack must gate bloom for disabled/nopost/lite presentation paths",
);

console.log(
  "Validated Unity Gaussian bloom sizing/lifecycle, change-driven 32^3 grading LUT, Uber order, and pre-HUD/CRT composition.",
);
