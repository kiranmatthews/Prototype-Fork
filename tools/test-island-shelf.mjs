import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src/islandShelf.ts");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText.replace(
  'from "three"',
  `from "${pathToFileURL(path.join(root, "node_modules/three/build/three.module.js")).href}"`,
);
const module = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const { UNITY_ISLAND_SHELF_PROFILE: profile, buildIslandShelfGeometry } = module;
assert.deepEqual(profile.radiusScales, [0.46, 0.78, 1, 1.2]);
assert.deepEqual(profile.innerHeights, [0.68, 0.48]);
const outline = Array.from({ length: 48 }, (_, index) => {
  const angle = (index / 48) * Math.PI * 2;
  return [Math.cos(angle) * 17.5, Math.sin(angle) * 23];
});
const geometry = buildIslandShelfGeometry(outline, {
  centerY: 1.05,
  seaLevel: -0.36,
  phase: 0,
});
assert.equal(geometry.getAttribute("position").count, 193);
assert.equal(geometry.getIndex().count / 3, 336);
const position = geometry.getAttribute("position");
assert.ok(Math.abs(position.getY(0) - (0.72 - 1.05)) < 1e-6);
assert.ok(Math.abs(position.getY(1) - (0.68 + 0.025 - 1.05)) < 1e-6);
const ringThree = 1 + 3 * 48;
assert.ok(Math.abs(position.getY(ringThree) - (-1.12 - 1.05)) < 1e-6);
const resampled = buildIslandShelfGeometry(outline.filter((_, index) => index % 2 === 0), {
  centerY: 1.05,
  seaLevel: -0.36,
  phase: 0,
});
assert.equal(resampled.getAttribute("position").count, 193);
assert.throws(
  () => buildIslandShelfGeometry(outline.slice(0, 2), { centerY: 1.05, seaLevel: -0.36, phase: 0 }),
  RangeError,
);
resampled.dispose();
geometry.dispose();
console.log("Validated Unity four-ring island shelf geometry and shoreline heights.");
