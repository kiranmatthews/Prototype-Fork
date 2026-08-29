import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/unitySmaa.ts`, "utf8");
const coastPost = await readFile(`${root}src/coastpost.ts`, "utf8");
const license = await readFile(
  `${root}public/unity/smaa/LICENSE.txt`,
  "utf8",
);

assert.match(source, /quality: "high"/);
assert.match(source, /maxSearchSteps: 16/);
assert.match(source, /maxDiagonalSearchSteps: 8/);
assert.match(source, /cornerRounding: 25/);
assert.match(source, /any\(isnan\(color\)\) \|\| any\(isinf\(color\)\)/);
assert.match(source, /1\.0 \/ 2\.2/);
assert.match(source, /type: THREE\.UnsignedByteType/);
assert.match(source, /calculateDiagWeights/);
assert.match(source, /detectHorizontalCorners/);
assert.match(source, /detectVerticalCorners/);
assert.doesNotMatch(source, /Added gamma correction/);
assert.match(coastPost, /import \{ UnitySmaaPass \} from "\.\/unitySmaa"/);
assert.doesNotMatch(coastPost, /postprocessing\/SMAAPass/);
assert.match(license, /Copyright \(C\) 2013 Jorge Jimenez/);
assert.match(license, /Permission is hereby granted, free of charge/);
assert.match(license, /No Unity blue-noise image is included/);

async function pngDimensions(path) {
  const bytes = await readFile(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

assert.deepEqual(
  await pngDimensions(`${root}public/unity/smaa/area.png`),
  [160, 560],
);
assert.deepEqual(
  await pngDimensions(`${root}public/unity/smaa/search.png`),
  [64, 16],
);

console.log("Unity SMAA High source-parity checks passed.");
