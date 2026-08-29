import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const post = readFileSync(path.join(root, "src/unityPost.ts"), "utf8");
const wrapper = readFileSync(path.join(root, "src/coastpost.ts"), "utf8");

for (const literal of [
  "const BLOOM_MIP_COUNT = 6",
  "thresholdKnee: 0.5",
  "scatter: 0.68",
  "intensity: 0.3",
  "color = min(vec3(65472.0), color)",
  "c0 * 0.01621622",
  "c4 * 0.22702703",
  "c0 * 0.07027027",
  "c1 * 0.31621622",
  "mix(highMip, lowMip, 0.68)",
  "chromaticAberrationIntensity: 0.015",
  "streaksIntensity: 0.24",
  "sampleScaled(u0) * (1.0 / 12.0)",
  "source.rgb + bloom * uBloomIntensity",
  "color = clamp(color, 0.0, 1.0)",
  "applyInternalLut(color)",
  "noise / 255.0",
  "srgbToLinear(linearToSrgb(color)",
  "color = max(color, vec3(0.0))",
  "function makeIdentityLdrLut()",
  "function makeGeneratedBlueNoise()",
  "UNITY_LUT_SIZE = 32",
  "UNITY_DITHER_SIZE = 16",
]) {
  assert.ok(post.includes(literal), `literal Unity post contract missing: ${literal}`);
}

for (const retired of [
  "UnrealBloomPass",
  "CHROMA_INTENSITY = 0.3",
  "horizontalStreak(vec2 uv)",
]) {
  assert.ok(!wrapper.includes(retired), `retired approximate post path remains: ${retired}`);
}

for (const order of [
  "this.composer.addPass(this.renderPass)",
  "this.composer.addPass(this.smaaPass)",
  "this.composer.addPass(this.unityPostPass)",
  "this.composer.addPass(this.outputPass)",
]) {
  assert.ok(wrapper.includes(order), `Unity post pass order missing: ${order}`);
}

console.log("Validated Unity SMAA, six-mip HQ bloom/flare, LDR identity grading and generated-noise dithering.");
