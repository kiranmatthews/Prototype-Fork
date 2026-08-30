import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src", "crateRestSurface.ts");
const source = readFileSync(file, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: file,
}).outputText;
const sourceUrl = pathToFileURL(file).href;
const encoded = Buffer.from(`${output}\n//# sourceURL=${sourceUrl}`).toString("base64");
const {
  CRATE_REST_HEIGHT_EPSILON,
  CRATE_REST_MAX_DROP,
  CRATE_REST_MAX_REPAIR_RISE,
  selectCrateRestSurface,
} = await import(`data:text/javascript;base64,${encoded}`);

assert.equal(CRATE_REST_MAX_DROP, 0.6);
assert.equal(CRATE_REST_MAX_REPAIR_RISE, 4);
assert.equal(CRATE_REST_HEIGHT_EPSILON, 0.05);

// Island Hopper's boardwalk and sand overlap. The authored-height boardwalk
// must beat the lower island regardless of ray-hit order.
for (const hits of [
  [1.05, 0.68],
  [0.68, 1.05],
]) {
  assert.equal(
    selectCrateRestSurface(hits, 1.05),
    1.05,
    "an elevated boardwalk crate selected the sand below it",
  );
}

assert.equal(
  selectCrateRestSurface([0.68, 0.91, 1.03], 1.05),
  1.03,
  "the selector did not choose the highest ordinary support",
);
assert.equal(
  selectCrateRestSurface([0, 2], 0),
  0,
  "an overhead surface displaced a crate from its authored floor",
);

// When no ordinary support exists, retain the old captured-terrain repair:
// choose the lowest surface above the authored height, up to four metres.
assert.equal(
  selectCrateRestSurface([3.2], 0),
  3.2,
  "a raised captured floor was not repaired",
);
assert.equal(
  selectCrateRestSurface([3.2, 2.4, 4.1], 0),
  2.4,
  "upward repair did not choose the lowest eligible replacement floor",
);

assert.equal(
  selectCrateRestSurface([1.05], 1),
  1.05,
  "the authored-height float tolerance excluded its upper boundary",
);
assert.equal(
  selectCrateRestSurface([0.4], 1),
  0.4,
  "the downward seating band excluded its lower boundary",
);
assert.equal(
  selectCrateRestSurface([4], 0),
  4,
  "the repair band excluded its upper boundary",
);

assert.equal(
  selectCrateRestSurface([0.399, 5.001, Number.NaN, Infinity, -Infinity], 1),
  null,
  "out-of-band or non-finite hits should not produce a floor",
);
assert.equal(selectCrateRestSurface([], 1.05), null, "an empty ray produced a floor");
assert.equal(
  selectCrateRestSurface([1.05], Number.NaN),
  null,
  "a non-finite authored height produced a floor",
);

console.log("crate rest-surface selector: ok");
