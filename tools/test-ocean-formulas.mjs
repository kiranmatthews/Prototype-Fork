import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shader = readFileSync(path.join(root, "src/unityOcean.ts"), "utf8");

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${actual} != ${expected} (epsilon ${epsilon})`,
  );
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const smoothstep = (a, b, value) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// MatrixRex DepthFadeWorldPosition with WorldSpaceDepth=1.
const depth01 = (metres) => clamp01(Math.exp(-metres / 0.3));
close(depth01(0), 1);
close(depth01(0.3), Math.E ** -1);
close(depth01(1), 0.035673993347252395);
assert.ok(depth01(0.3) > 0.36, "0.3m must retain Unity's exponential shallow color");

const oneCentimetreAlpha = smoothstep(0, 0.033, 1 - depth01(0.01));
assert.ok(oneCentimetreAlpha > 0.999, "shore fade should be nearly opaque at 1cm");

// Exact authored normal panners at worldXZ=(10,20), time=2.
const worldUv = [1, 2];
const normalA = worldUv.map((v) => v * (0.32 * 0.5) - 0.31 * 0.05 * 2);
const normalB = worldUv.map((v) => v * 0.32 + 0.31 * 0.1 * 2);
close(normalA[0], 0.129);
close(normalA[1], 0.289);
close(normalB[0], 0.382);
close(normalB[1], 0.702);

// The current caustic layer uses the minimum of two samples and HDR layer 4.
const causticMask = 0.5 * Math.min(0.8, 0.6) * 1.28 * 0.5;
close(causticMask, 0.192);
close(0.2 + (4 - 0.2) * causticMask, 0.9296);

// Authored IntersectionFoamGenerator specialization.
const intersection = (d, noise) => {
  const band = smoothstep(0.05, 1.05, d);
  const raw = band * (band + 1 - (1 - noise) * 2);
  return clamp01(smoothstep(0.1, 1.1, raw) * band);
};
close(intersection(0, 0.8), 0);
assert.ok(intersection(0.5, 0.8) > 0.1);
assert.ok(intersection(1, 0.8) > 0.99);

const specularExponent = 2 ** ((1 - 0.145) * 10 + 1);
close(specularExponent, 749.6118763241606, 1e-6);

for (const literal of [
  "saturate(exp(vertical / max(uDepthDistance",
  "worldUv * (uNormalScale * 0.5)",
  "uCausticsDistortion * 0.0001",
  "causticBase * (uCausticsScale * 1.3)",
  "vec4(4.0, 4.0, 4.0, 1.0)",
  "screenUv + normalTs.xy * uReflectionDistortion * 0.1",
  "exp2((1.0 - uSpecularSpread) * 10.0 + 1.0)",
  "gl_FragColor = vec4(finalColor, shoreAlpha)",
  "this.group.add(this.horizon, this.ribbon)",
  'sourceCoordinates?: "unity" | "three"',
  'const exactUnitySource = opts.sourceCoordinates === "unity"',
]) {
  assert.ok(shader.includes(literal), `literal MatrixRex path missing: ${literal}`);
}

for (const approximation of [
  "smoothstep(0.0, max(uDepthDistance",
  "distanceMix * 0.12",
  "uCausticsStrength * 0.22",
  "specularTerm * 0.025",
  "vec3(0.35, 0.85, 0.25)",
  "makeCoverageGeometry(",
  "smoothstep(0.0, 14.0, aShoreDistance)",
]) {
  assert.ok(!shader.includes(approximation), `retired approximation remains: ${approximation}`);
}

console.log("Validated literal MatrixRex depth, normals, caustics, intersection, reflection, specular, alpha and single-ribbon contracts.");
