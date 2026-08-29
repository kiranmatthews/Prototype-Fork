import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expected = new Map([
  ["noise-1.png", "9354f4e6fb1b2153738920eb7e8b9b46a9a05dfc0ee998c485f537048d6f0b39"],
  ["noise-3.png", "bed7c1d2072b9c3d8ebb4f87885a3bfc531070d887a5b0d51f5b42c10f78ae78"],
  ["noise-4.png", "cb255d3eea3d67af16bfb98b877c5346ed42754f193eb333bdf369d27d06aa23"],
  ["caustic-1.png", "22ef9ca0d23bf5b57636e713c74a4955c1e1a9bdec9a3cc0afafaff1cdccff09"],
  ["normal-2.png", "14ffe57b51c476662e83d2c440e808f0a6db4d906493cdc7ef0a7f29321ba914"],
  ["sand-color.png", "d356654da7ecf8696b9bcc7477e06e6f09cc9bc50c674780d7c403881fe5fb43"],
  ["sand-normal.png", "f1e92408b9a5f98c2420d28ec93b4e8773f15741a12a4e7fda1bccd23e7fbbf3"],
  ["sand-mask.png", "ca61d44cb0dde84aabbedf64dc120445987f8d1465be3747c452d0922987ac33"],
  ["LICENSE.txt", "2def5a93859d1a8d868996bae6a8fc9d70fa81a2068398ccd0488870e1b8ac87"],
  ["SOURCE_REVISION.md", "2f898ba2446e98c2647f1d16ee7e1da10398012193a61da7505d42c29babd032"],
]);

for (const [file, wanted] of expected) {
  const bytes = readFileSync(path.join(root, "public/water/matrixrex", file));
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== wanted)
    throw new Error(`Unity ocean asset hash mismatch: ${file}`);
}

const ocean = readFileSync(path.join(root, "src/unityOcean.ts"), "utf8");
for (const required of [
  "wave1Length: 59.3",
  "wave2Length: 45.8",
  "reflectionScale = 0.3",
  "prepassScale = 1",
  "renderReflection(",
  "renderPrepass(",
  "sampleWaterSurface(",
  "dispose(): void",
]) {
  if (!ocean.includes(required))
    throw new Error(`Unity ocean runtime contract missing: ${required}`);
}

const waterEntry = readFileSync(path.join(root, "src/water.ts"), "utf8");
for (const retired of ["shoreAmp", "swashPhase", "wetDecay", "class SkyTexture"])
  if (waterEntry.includes(retired))
    throw new Error(`Retired CoastWater implementation leaked into water.ts: ${retired}`);

const level = readFileSync(path.join(root, "src/level.ts"), "utf8");
for (const retired of ["private seaSurface(", 'pitPlane("water"'])
  if (level.includes(retired))
    throw new Error(`Retired sea runtime remains active: ${retired}`);

console.log(
  `Validated Unity ocean port: ${expected.size} pinned assets, runtime, render passes, sampler and retired-water removal.`,
);
