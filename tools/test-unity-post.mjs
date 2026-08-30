import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const post = readFileSync(path.join(root, "src/unityPost.ts"), "utf8");
const wrapper = readFileSync(path.join(root, "src/coastpost.ts"), "utf8");

for (const literal of [
  'gradingMode: "low-dynamic-range"',
  'tonemapping: "none"',
  "lutSize: 32",
  'lutFormat: "R8G8B8A8_UNorm"',
  "dithering: true",
  "const FINAL_GRADE_FRAGMENT",
  "color = clamp(color, 0.0, 1.0)",
  "applyInternalLut(color)",
  "noise / 255.0",
  "srgbToLinear(linearToSrgb(color)",
  "color = max(color, vec3(0.0))",
  "function makeIdentityLdrLut()",
  "function makeGeneratedBlueNoise()",
  "UNITY_LUT_SIZE = 32",
  "UNITY_DITHER_SIZE = 16",
  '"UnityPost.NeutralLdrGrade"',
  "uLookEnabled",
  "uColorGrade",
  "uTint",
  "uBloom",
  "uVignette",
  "localBloom",
  "visualTreatmentSettings.subscribe",
]) {
  assert.ok(post.includes(literal), `Unity grade contract missing: ${literal}`);
}

for (const retired of [
  "BLOOM_MIP_",
  "STREAK_",
  "FLARE_",
  "UnityBloom",
  "UnityLensFlare",
  "new THREE.WebGLRenderTarget",
  "makeRenderTarget",
  "HalfFloatType",
  "tBloom",
  "mipDown",
  "mipUp",
  "bloomMip1",
  "streakTargets",
  "flareResult",
  "noflare",
  "nobloom",
  "bloomdebug",
  "prefilterdebug",
]) {
  assert.ok(!post.includes(retired), `retired coast effect remains: ${retired}`);
}

assert.doesNotMatch(post, /private readonly \w+: THREE\.WebGLRenderTarget/);
assert.equal(
  (post.match(/this\.\w+Material\s*=\s*makeMaterial\(/g) ?? []).length,
  1,
  "coast grading should construct exactly one material",
);
assert.equal(
  (post.match(/this\.fsQuad\.render\(renderer\)/g) ?? []).length,
  1,
  "coast grading should issue exactly one fullscreen draw",
);
assert.doesNotMatch(post, /private draw\s*\(/);

const order = [
  "this.composer.addPass(this.renderPass)",
  "this.composer.addPass(this.smaaPass)",
  "this.composer.addPass(this.unityPostPass)",
  "this.composer.addPass(this.crtPass)",
  "this.composer.addPass(this.outputPass)",
].map((needle) => wrapper.indexOf(needle));
assert.ok(order.every((index) => index >= 0), "Shared post stages are incomplete");
assert.deepEqual(order, [...order].sort((a, b) => a - b));

console.log(
  "Validated shared Unity post: one draw, zero owned render targets, neutral LDR LUT/dither plus tunable local bloom/grade/vignette, no retired lens-flare stack.",
);
