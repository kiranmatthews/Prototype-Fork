import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "src/woodPathKit.ts");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: file,
}).outputText;
const sourceUrl = pathToFileURL(file).href;
const encoded = Buffer.from(`${output}\n//# sourceURL=${sourceUrl}`).toString("base64");
const kit = await import(`data:text/javascript;base64,${encoded}`);

const near = (actual, expected, epsilon = 1e-9, label = "value") =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, received ${actual}`,
  );

const profile = kit.UNITY_ISLAND_BOARDWALK_PROFILE;
assert.deepEqual(
  {
    deckThickness: profile.deckThickness,
    pathSampleSpacing: profile.pathSampleSpacing,
    plankSpacing: profile.plankSpacing,
    plankGap: profile.plankGap,
    plankThickness: profile.plankThickness,
    plankSideOverhang: profile.plankSideOverhang,
    plankYawJitterDegrees: profile.plankYawJitterDegrees,
    plankScaleJitter: profile.plankScaleJitter,
    plankVerticalJitter: profile.plankVerticalJitter,
    bentSpacing: profile.bentSpacing,
    deckSideInset: profile.deckSideInset,
    crossbeamOverhang: profile.crossbeamOverhang,
    postRadius: profile.postRadius,
    crossbeamRadius: profile.crossbeamRadius,
    ledgerRadius: profile.ledgerRadius,
    braceRadius: profile.braceRadius,
    handrailHeight: profile.handrailHeight,
  },
  {
    deckThickness: 0.42,
    pathSampleSpacing: 0.35,
    plankSpacing: 0.68,
    plankGap: 0.038,
    plankThickness: 0.135,
    plankSideOverhang: 0.1,
    plankYawJitterDegrees: 1.65,
    plankScaleJitter: 0.055,
    plankVerticalJitter: 0.014,
    bentSpacing: 4.5,
    deckSideInset: 0.34,
    crossbeamOverhang: 0.48,
    postRadius: 0.115,
    crossbeamRadius: 0.09,
    ledgerRadius: 0.072,
    braceRadius: 0.055,
    handrailHeight: 1.05,
  },
);

const supportRequests = [];
const sampler = {
  length: 9,
  sampleAtDistance(distance) {
    return {
      center: [0, 1.05, distance],
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, 1],
      width: 8,
    };
  },
};
const options = {
  profile,
  plankSeed: 7129,
  poleSeed: 19411,
  fallbackBaseY: -3.6,
  plankVariantWeights: [1, 2, 1],
  poleVariantWeights: [1, 3],
  supportBottom(request) {
    supportRequests.push(request);
    return null;
  },
};
const layout = kit.buildWoodPathLayout(sampler, options);

assert.equal(layout.planks.length, 14, "ceil(9 / .68) midpoint planks");
near(layout.plankPitch, 9 / 14, 1e-12, "actual plank pitch");
near(layout.planks[0].distance, 9 / 28, 1e-12, "first plank midpoint");
near(layout.planks.at(-1).distance, 9 - 9 / 28, 1e-12, "last plank midpoint");
assert.ok(layout.planks.every((plank) => plank.distance > 0 && plank.distance < 9));
assert.ok(
  layout.planks.every(
    (plank) =>
      plank.variantIndex >= 0 &&
      plank.variantIndex < options.plankVariantWeights.length &&
      plank.tonalBucket >= 0 &&
      plank.tonalBucket < 4,
  ),
);
for (const plank of layout.planks) {
  const expectedWidth = (8 + 0.2) * plank.scaleNoise;
  const expectedDepth = (9 / 14 - 0.038) * (2 - plank.scaleNoise);
  near(plank.size[0], expectedWidth, 1e-12, `plank ${plank.index} width`);
  near(plank.size[1], 0.135, 1e-12, `plank ${plank.index} thickness`);
  near(plank.size[2], expectedDepth, 1e-12, `plank ${plank.index} depth`);
  near(
    plank.center[1] + plank.size[1] * 0.5,
    1.05 + plank.verticalOffset,
    1e-12,
    `plank ${plank.index} top`,
  );
}

assert.equal(layout.bents.length, 3, "two 4.5m bays have three bents");
near(layout.bentSpacing, 4.5, 1e-12, "actual bent spacing");
assert.equal(supportRequests.length, 6, "two support probes per bent");
for (const request of supportRequests) {
  near(request.top[1], 0.54, 1e-12, "post meets underside below crossbeam");
  near(request.probeOrigin[1], -0.175, 1e-12, "Unity ground-probe origin");
  near(request.fallback[1], -3.6, 1e-12, "Island fallback base");
}

const byRole = (role) => layout.poles.filter((piece) => piece.role === role);
assert.equal(byRole("support-post").length, 6);
assert.equal(byRole("crossbeam").length, 3);
assert.equal(byRole("handrail-post").length, 6);
assert.equal(byRole("top-ledger").length, 4);
assert.equal(byRole("lower-ledger").length, 0);
assert.equal(byRole("side-brace").length, 4);
assert.equal(byRole("midheight-cross-brace").length, 4);
assert.equal(byRole("top-rail").length, 16);
assert.equal(layout.poles.length, 43);

const firstCrossbeam = byRole("crossbeam")[0];
near(firstCrossbeam.start[0], -4.14, 1e-12, "crossbeam left overhang");
near(firstCrossbeam.end[0], 4.14, 1e-12, "crossbeam right overhang");
near(firstCrossbeam.center[1], 0.54, 1e-12, "crossbeam below deck");
near(firstCrossbeam.radius, 0.09, 1e-12, "crossbeam radius");

const midBraces = byRole("midheight-cross-brace");
assert.ok(
  midBraces.every((brace) => Math.abs(brace.end[1] - brace.start[1]) > 1.65),
  "midheight X braces must have source-authored vertical depth, not collapse flat",
);
near(
  Math.abs(midBraces[0].end[1] - midBraces[0].start[1]),
  (0.54 - -3.6) * 0.4,
  1e-12,
  "midheight brace vertical span",
);

assert.equal(layout.rails[0].points.length, Math.ceil(9 / 0.35) + 1);
assert.equal(layout.rails[1].points.length, Math.ceil(9 / 0.35) + 1);
for (const point of layout.rails[0].points) {
  near(point[0], -4.04, 1e-12, "left rail outside deck edge");
  near(point[1], 2.1, 1e-12, "left rail height");
}
for (const point of layout.rails[1].points) {
  near(point[0], 4.04, 1e-12, "right rail outside deck edge");
  near(point[1], 2.1, 1e-12, "right rail height");
}

assert.equal(layout.balustradeBarriers.length, Math.ceil(9 / 0.7) * 2);
for (const barrier of layout.balustradeBarriers) {
  near(Math.abs(barrier.center[0]), 4.04, 1e-12, "barrier edge position");
  near(barrier.center[1], 1.55, 1e-12, "barrier center height");
  near(barrier.size[0], 0.14, 1e-12, "barrier thickness");
  near(barrier.size[1], 1, 1e-12, "barrier height");
  assert.ok(barrier.size[2] > 0.7, "barrier boxes overlap along the path");
}

const repeated = kit.buildWoodPathLayout(sampler, options);
assert.deepEqual(repeated.planks, layout.planks, "seeded planks must be deterministic");
assert.deepEqual(repeated.poles, layout.poles, "seeded pole variants must be deterministic");

const swappedPalette = kit.buildWoodPathLayout(sampler, {
  ...options,
  plankVariantWeights: [1],
  poleVariantWeights: [1],
});
assert.deepEqual(
  swappedPalette.planks.map(({ variantIndex, ...piece }) => piece),
  layout.planks.map(({ variantIndex, ...piece }) => piece),
  "changing plank art must not change its fitted transform",
);
assert.deepEqual(
  swappedPalette.poles.map(({ variantIndex, ...piece }) => piece),
  layout.poles.map(({ variantIndex, ...piece }) => piece),
  "changing pole art must not change topology or fitted transforms",
);
assert.ok(swappedPalette.planks.every((piece) => piece.variantIndex === 0));
assert.ok(swappedPalette.poles.every((piece) => piece.variantIndex === 0));

assert.equal(kit.chooseUnityWeightedVariant(0, 1), -1);
assert.equal(kit.chooseUnityWeightedVariant(0, 1, [0, -2, Number.NaN]), -1);
near(
  kit.unityWoodSignedNoise(0, 7129, 17),
  0.5635656834495173,
  1e-15,
  "Unity plank scale hash",
);
near(
  kit.unityWoodSignedNoise(0, 7129, 29),
  0.5868314480378365,
  1e-15,
  "Unity plank yaw hash",
);
near(
  kit.unityWoodSignedNoise(0, 7129, 43),
  -0.8654094063363525,
  1e-15,
  "Unity plank vertical hash",
);
near(
  kit.unityStructureSignedNoise(0, 7129, 71),
  0.7323150284896407,
  1e-15,
  "Unity plank tint hash",
);
near(
  kit.unityStructureSignedNoise(0, 19411, 83),
  0.8706681020256757,
  1e-15,
  "Unity pole tint hash",
);

console.log(
  "Validated source-faithful wood-path layout: midpoint planks, full light scaffold topology, dense rails/barriers, deterministic palette swaps and support probes.",
);
