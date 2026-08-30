import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(root, "src/coastalStreetKit.ts");
const source = readFileSync(sourceFile, "utf8");
assert.equal(/from\s+["']three["']/.test(source), false, "street kit must stay Three-free");

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: sourceFile,
}).outputText;
const encoded = Buffer.from(
  `${output}\n//# sourceURL=${pathToFileURL(sourceFile).href}`,
).toString("base64");
const kitModule = await import(`data:text/javascript;base64,${encoded}`);

const segments = [
  ["Market Flat", -30, 100, 12, 12],
  ["Market Descent", 100, 300, 12, 4],
  ["Harbour Plaza", 300, 430, 4, 4],
  ["Canal Low", 441, 580, 4, 4],
  ["Canal Rise", 580, 650, 4, 9],
  ["Canal Raised Plaza", 650, 800, 9, 9],
  ["Canal Works Descent", 800, 900, 9, 5],
  ["Cliff Approach", 912, 1040, 5, 5],
  ["Cliff Rise", 1040, 1110, 5, 15],
  ["Cliff Top Plaza", 1110, 1240, 15, 15],
  ["Cliff Descent", 1240, 1370, 15, 7],
  ["Surf Arcade Flat", 1370, 1530, 7, 7],
  ["Surf Arcade Descent", 1530, 1660, 7, 2],
  ["Low Arcade Plaza", 1660, 1810, 2, 2],
  ["Festival Low", 1823, 1960, 2, 2],
  ["Festival Rise", 1960, 2070, 2, 13],
  ["Festival High Plaza", 2070, 2170, 13, 13],
  ["Festival Descent", 2170, 2280, 13, 6],
  ["Lighthouse Flat", 2280, 2400, 6, 6],
  ["Lighthouse Descent", 2400, 2580, 6, 2.5],
  ["Lighthouse Low", 2580, 2680, 2.5, 2.5],
  ["Finish Rise", 2694, 2820, 2.5, 7],
  ["Finish Promenade", 2820, 3030, 7, 7],
].map(([name, start, end, startY, endY]) => ({
  name,
  start,
  end,
  startY,
  endY,
}));

const heightAt = (unityZ) => {
  if (unityZ <= segments[0].start) return segments[0].startY;
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (unityZ >= segment.start && unityZ <= segment.end) {
      const t = (unityZ - segment.start) / (segment.end - segment.start);
      return segment.startY + (segment.endY - segment.startY) * t;
    }
    const next = segments[index + 1];
    if (next && unityZ > segment.end && unityZ < next.start) {
      const t = (unityZ - segment.end) / (next.start - segment.end);
      return segment.endY + (next.startY - segment.endY) * t;
    }
  }
  return segments.at(-1).endY;
};

const kit = kitModule.buildCoastalStreetKit(segments, heightAt);
const assertVecClose = (actual, expected, epsilon = 1e-10) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(
      Math.abs(value - expected[index]) <= epsilon,
      `${value} differs from ${expected[index]} at index ${index}`,
    ),
  );
};
assert.equal(kit.coordinateSpace, "unity-source");
assert.equal(kit.shoulders.length, 46);
assert.equal(kit.route.arrows.length, 99);
assert.equal(
  kit.route.arrows.reduce((sum, arrow) => sum + arrow.pieces.length, 0),
  297,
);
assert.equal(kit.houses.length, 64);

assert.deepEqual(kit.shoulders[0], {
  id: "shoulder-town-01",
  role: "road-shoulder",
  palette: "coastal-sidewalk-shoulder",
  side: "town",
  segmentIndex: 0,
  segmentName: "Market Flat",
  centerX: -6.55,
  startZ: -30,
  endZ: 100,
  startY: 12,
  endY: 12,
  width: 1.3,
  thickness: 0.85,
  longitudinalOverlap: 0.08,
  surfaceKind: "ground",
  boardClassification: "road",
  edgeGrinding: false,
  solidSides: false,
});
assert.equal(kit.shoulders[1].centerX, 6.55);
assert.equal(kit.shoulders[1].side, "water");
for (let index = 0; index < segments.length; index++) {
  const pair = kit.shoulders.slice(index * 2, index * 2 + 2);
  assert.deepEqual(pair.map((shoulder) => shoulder.side), ["town", "water"]);
  assert.ok(pair.every((shoulder) => shoulder.startZ === segments[index].start));
  assert.ok(pair.every((shoulder) => shoulder.endZ === segments[index].end));
}
for (const [gapStart, gapEnd] of kitModule.COASTAL_STREET_GAPS) {
  assert.equal(
    kit.shoulders.some(
      (shoulder) => shoulder.startZ < gapStart && shoulder.endZ > gapEnd,
    ),
    false,
    `shoulders must not bridge ${gapStart}-${gapEnd}`,
  );
}

const arrowZ = kit.route.arrows.map((arrow) => arrow.unityZ);
assert.equal(arrowZ[0], -5);
assert.equal(arrowZ.at(-1), 2965);
assert.equal(arrowZ.includes(2695), false, "arrow over the fourth gap must be omitted");
for (const z of arrowZ) assert.equal((z + 5) % 30, 0);
assert.deepEqual(kit.route.arrows[0].pieces.map((piece) => piece.size), [
  [0.31, 0.028, 1.25],
  [0.27, 0.028, 0.82],
  [0.27, 0.028, 0.82],
]);
assert.deepEqual(kit.route.arrows[0].pieces.map((piece) => piece.center), [
  [0, 0, -0.2],
  [-0.25, 0, 0.44],
  [0.25, 0, 0.44],
]);
assert.deepEqual(kit.route.arrows[0].pieces.map((piece) => piece.rotationDeg), [
  [0, 0, 0],
  [0, -43, 0],
  [0, 43, 0],
]);
assert.deepEqual(kit.route.startStripe.size, [10.5, 0.028, 0.34]);
assert.deepEqual(kit.route.startStripe.center, [0, 12.025, -10]);
assert.deepEqual(kit.route.labels.map((label) => label.text), [
  "START",
  "SUNSET MARKET",
  "CANAL WORKS",
  "CLIFFSIDE STEPS",
  "SURF ARCADE",
  "FESTIVAL HEIGHTS",
  "LIGHTHOUSE RUN",
  "FINISH PROMENADE",
]);

const slopedArrow = kit.route.arrows.find((arrow) => arrow.unityZ === 115);
assert.ok(slopedArrow);
const forwardLength = Math.hypot(...slopedArrow.frame.forward);
const upLength = Math.hypot(...slopedArrow.frame.up);
const frameDot = slopedArrow.frame.forward.reduce(
  (sum, value, index) => sum + value * slopedArrow.frame.up[index],
  0,
);
assert.ok(Math.abs(forwardLength - 1) < 1e-12);
assert.ok(Math.abs(upLength - 1) < 1e-12);
assert.ok(Math.abs(frameDot) < 1e-12);
assert.ok(slopedArrow.frame.forward[1] < 0, "Market descent arrow follows its grade");

const pieces = kit.houses.flatMap((house) => [
  house.body,
  house.roof,
  ...house.windows,
  house.awning,
  house.door,
]);
assert.equal(pieces.filter((piece) => piece.role === "building-body").length, 64);
assert.equal(pieces.filter((piece) => piece.role === "building-roof").length, 64);
assert.equal(pieces.filter((piece) => piece.role === "building-window").length, 192);
assert.equal(pieces.filter((piece) => piece.role === "building-awning").length, 64);
assert.equal(pieces.filter((piece) => piece.role === "building-door").length, 64);
assert.ok(pieces.every((piece) => piece.visualOnly));

const first = kit.houses[0];
assert.equal(first.unityZ, -5);
assert.equal(first.district, 0);
assert.equal(first.baseY, 11.45);
assert.deepEqual(first.body.center, [-14, 15.45, -5]);
assert.deepEqual(first.body.size, [11.5, 8, 39]);
assert.equal(first.body.palette, "coastal-building-1");
assert.deepEqual(first.roof.center, [-14, 19.87, -5]);
assert.deepEqual(first.roof.size, [12.3, 0.84, 40.2]);
assert.deepEqual(first.roof.rotationDeg, [0, 0, 3.5]);
assert.deepEqual(first.windows.map((window) => window.center[2]), [-12.2, -5, 2.2]);
assert.equal(first.awning.palette, "coastal-building-3");
assertVecClose(first.awning.center, [-7.64, 14.45, -7]);
assertVecClose(first.door.center, [-8.19, 13, 6.5]);

const last = kit.houses.at(-1);
assert.equal(last.unityZ, 3010);
assert.equal(last.district, 6);
assert.ok(last.body.center[0] <= -8.25, "all houses stay on the source left side");
for (const house of kit.houses) {
  assert.equal(house.baseY, heightAt(house.unityZ) - 0.55);
  assert.equal(house.windows.length, 3);
  assert.ok(house.body.center[0] + house.body.size[0] / 2 <= -8.25 + 1e-9);
}

const palette = new Map(kit.palettes.map((entry) => [entry.id, entry]));
assert.deepEqual(palette.get("coastal-road").color, [0.61, 0.61, 0.58]);
assert.deepEqual(palette.get("coastal-sidewalk-shoulder").color, [0.72, 0.69, 0.6]);
assert.deepEqual(palette.get("coastal-route-marking"), {
  id: "coastal-route-marking",
  role: "route-marking",
  color: [1, 0.7, 0.08],
  lit: false,
});
assert.deepEqual(palette.get("coastal-roof").color, [0.35, 0.11, 0.08]);
assert.deepEqual(palette.get("coastal-window").color, [0.035, 0.22, 0.32]);
assert.deepEqual(palette.get("coastal-trim").color, [1, 0.78, 0.33]);
assert.equal(
  [...palette.values()].filter((entry) => entry.role === "building").length,
  7,
);

assert.deepEqual(
  kitModule.buildCoastalStreetKit(segments, heightAt),
  kit,
  "descriptor generation must be deterministic",
);
assert.throws(
  () => kitModule.describeCoastalStreetShoulders(segments.slice(1)),
  /needs 23 road segments/,
);
assert.throws(
  () => kitModule.describeCoastalStreetRoute(() => Number.NaN),
  /must be finite/,
);

console.log(
  `Coastal Street kit validated: ${kit.shoulders.length} shoulders, ${kit.route.arrows.length} arrows, ${kit.houses.length} houses.`,
);
