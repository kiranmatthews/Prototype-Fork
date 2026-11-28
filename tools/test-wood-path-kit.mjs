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
// The light scaffold as the Unity source builds it. Carlisle's piers still stand on it; a wood path's
// default is the carpentry, checked further down.
const options = {
  profile: { ...profile, structure: "unity" },
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

// ---- the carpentry: what a wood path stands on unless it asks for the light scaffold -----------------
assert.equal(profile.structure, "carpentry", "the source profiles build the carpentry");
assert.equal(kit.UNITY_LIGHT_BOARDWALK_PROFILE.structure, "carpentry");
assert.equal(kit.UNITY_BEACH_BOARDWALK_PROFILE.structure, "carpentry");
const C = kit.WOOD_PATH_CARPENTRY;
{
  // How a post is braced, by its height and by whether it stands on ground or is a pile.
  const tiers = (height, grounded) => kit.woodPathTiers(height, grounded);
  assert.deepEqual([tiers(1.0, false).count, tiers(1.0, false).knees], [0, false], "a stub post is not braced");
  assert.deepEqual([tiers(1.5, false).count, tiers(1.5, false).knees], [0, true], "a short post has knee braces");
  assert.equal(tiers(2.5, false).count, 1, "a pile 2.5 m tall has one panel");
  assert.deepEqual([tiers(3.7, true).count, tiers(3.7, true).knees], [0, true],
    "over ground a body can walk on, 3.7 m leaves less than a panel above head height: knee braces only");
  assert.equal(tiers(4.1, true).count, 1, "...and 4.1 m leaves one, above the 2.3 m of headroom");
  near(tiers(4.1, true).foot, 4.1 - C.headroom, 1e-12, "its bracing stops at head height");
  near(tiers(8, false).step, (8 - C.topZone - C.footZone) / 2, 1e-12, "an 8 m pile has two panels");
  assert.equal(tiers(18, false).count, 4, "an 18 m trestle has four tall panels, not seven short ones");
  assert.ok(tiers(18, false).step <= C.tierMax + 0.2 && tiers(40, false).count === C.maxTiers);
  // One panel height for a path: posts of different heights have their joints at the same levels.
  const step = kit.woodPathTierStep([6.8, 7.4, 8.3, 7.7, 6.9]);
  near(step, (7.4 - C.topZone - C.footZone) / 2, 1e-12, "the path's middle post sets the panel height");
  assert.deepEqual([6.8, 7.4, 8.3].map((height) => kit.woodPathTiers(height, false, step).count), [2, 2, 2]);
}
const carpentryRequests = [];
const carpentryOptions = { ...options, profile,
  supportBottom(request) { carpentryRequests.push(request); return null; } };
const carpentry = kit.buildWoodPathLayout(sampler, carpentryOptions);
// What a body collides with has not moved: the same bents, the same probes, the same rails and barriers.
assert.deepEqual(carpentryRequests, supportRequests.slice(0, 6), "the same two support probes per bent");
const column = ({ leftGrounded, rightGrounded, ...bent }) => bent;
assert.deepEqual(carpentry.bents.map(column), layout.bents.map(column), "the solid column under each end of every bent is where it was");
assert.ok(carpentry.bents.every((bent) => !bent.leftGrounded && !bent.rightGrounded), "a fallback depth is a pile, not ground");
assert.deepEqual(carpentry.planks, layout.planks, "the planks are the same planks");
assert.deepEqual(carpentry.rails, layout.rails, "both grind rails are where they were");
assert.deepEqual(carpentry.balustradeBarriers, layout.balustradeBarriers, "and so is the balustrade");
const role = (name) => carpentry.poles.filter((piece) => piece.role === name);
// An 8 m deck on 4.1 m piles, three bents: one crossed panel in each bent, one pole a side in each bay.
assert.deepEqual(
  Object.fromEntries(["support-post", "crossbeam", "top-ledger", "stringer", "midheight-cross-brace", "side-brace",
    "girt", "lower-ledger", "knee-brace", "footing", "lashing", "handrail-post", "top-rail"].map((name) => [name, role(name).length])),
  { "support-post": 6, crossbeam: 3, "top-ledger": 4, stringer: 2, "midheight-cross-brace": 6, "side-brace": 4,
    girt: 0, "lower-ledger": 0, "knee-brace": 0, footing: 0, lashing: 18, "handrail-post": 6, "top-rail": 16 },
);
assert.equal(carpentry.poles.length, 65);
const postRadius = C.postBase + C.postPerMetre * 8;
const plankUnderside = 1.05 - profile.plankThickness;
// Nothing hangs in the air. Planks lie on stringers...
for (const stringer of [...role("top-ledger"), ...role("stringer")]) {
  assert.ok(Math.abs(stringer.center[1] + stringer.radius - plankUnderside) < 0.03,
    `a stringer's top is at the planks' underside (${stringer.center[1] + stringer.radius} against ${plankUnderside})`);
  assert.ok(stringer.radius >= C.stringerMin * 0.9);
}
// ...stringers lie on the cap of each bent, which is proud of the deck on both sides...
const stringerUnderside = Math.min(...[...role("top-ledger"), ...role("stringer")].map((piece) => piece.center[1] - piece.radius));
for (const cap of role("crossbeam")) {
  assert.ok(cap.center[1] + cap.radius > stringerUnderside - 0.02 && cap.center[1] + cap.radius < stringerUnderside + 0.09,
    "the cap is right under the stringers");
  assert.ok(cap.start[0] < -4.1 && cap.end[0] > 4.1, "and runs out past the deck's edge on both sides");
  assert.ok(Math.abs(cap.radius / postRadius - C.capRatio) < 0.08);
}
// ...the cap lies on two posts, which go down to their feet.
for (const post of role("support-post")) {
  const cap = role("crossbeam")[post.bentIndex];
  const [head, foot] = post.start[1] > post.end[1] ? [post.start, post.end] : [post.end, post.start];
  assert.ok(Math.abs(head[1] - cap.center[1]) < cap.radius, "a post's head is in its cap");
  near(foot[1], -3.6, 1e-9, "a post's foot is at the depth it was given");
  assert.ok(Math.abs(Math.abs(head[0]) - 3.66) < 1e-9 && Math.hypot(foot[0] - head[0], foot[2] - head[2]) <= 0.071,
    "it stands on the post line and is out of plumb by no more than a hand's breadth");
  assert.ok(post.radius > 0.19 && post.radius < 0.3 && post.radius > profile.postRadius * 1.6,
    "it is a stout post: the solid column is inside it");
  assert.ok(post.variantIndex >= 0 && post.variantIndex < 2);
}
// Every pole that braces a bent or a bay ends on a post (and runs on a little past it).
const axes = carpentry.bents.flatMap((bent) => [[-3.66, bent.distance], [3.66, bent.distance]]);
const offAxis = (point) => Math.min(...axes.map(([x, z]) => Math.hypot(point[0] - x, point[2] - z)));
for (const brace of [...role("midheight-cross-brace"), ...role("side-brace")]) {
  for (const end of [brace.start, brace.end])
    assert.ok(offAxis(end) < postRadius + brace.radius + C.overshoot[1] + 0.05,
      `a brace ends on a post (${offAxis(end).toFixed(2)} m from the nearest)`);
  assert.ok(brace.radius >= C.braceMin * 0.9 && brace.radius > profile.braceRadius * 1.6);
  assert.ok(Math.abs(brace.end[1] - brace.start[1]) > 2.4, "and is a real diagonal");
}
// The cross in each bent is one pole on each face of the posts; the two sides of a bay lean the same way.
for (const bent of carpentry.bents) {
  const cross = role("midheight-cross-brace").filter((piece) => piece.bentIndex === bent.index);
  assert.equal(cross.length, 2);
  assert.ok((cross[0].center[2] - bent.distance) * (cross[1].center[2] - bent.distance) < 0, "one in front of the posts, one behind");
  assert.ok((cross[0].end[1] - cross[0].start[1]) * (cross[0].end[0] - cross[0].start[0])
    * (cross[1].end[1] - cross[1].start[1]) * (cross[1].end[0] - cross[1].start[0]) < 0, "leaning opposite ways");
}
for (const bay of [1, 2]) {
  const [a, b] = role("side-brace").filter((piece) => piece.bayIndex === bay);
  assert.ok((a.end[1] - a.start[1]) * (b.end[1] - b.start[1]) > 0 && a.side !== b.side);
}
assert.ok((role("side-brace")[0].end[1] - role("side-brace")[0].start[1]) * (role("side-brace")[2].end[1] - role("side-brace")[2].start[1]) < 0,
  "and the next bay leans the other way: a zig-zag");
// Every joint a pole makes with a post is lashed, and so is the rail to each handrail post.
const lashedToPost = role("lashing").filter((piece) => offAxis(piece.center) < 0.08);
assert.equal(lashedToPost.length, 12, "two joints on each of six posts");
assert.equal(role("lashing").length - lashedToPost.length, 6, "and one on each handrail post");
for (const lashing of lashedToPost) assert.ok(lashing.radius > postRadius && lashing.length > 0.2 && lashing.length < 0.4);
for (const post of role("handrail-post")) {
  const [foot, head] = post.start[1] < post.end[1] ? [post.start, post.end] : [post.end, post.start];
  near(head[1], 2.1, 1e-12, "a handrail post still tops out at the rail");
  assert.ok(foot[1] < role("crossbeam")[post.bentIndex].center[1], "and now goes down past the deck to the end of its cap");
}
assert.deepEqual(kit.buildWoodPathLayout(sampler, carpentryOptions).poles, carpentry.poles, "the same path is always built the same way");

// Over ground, and at other heights.
const onGround = (drop) => kit.buildWoodPathLayout(sampler, { ...carpentryOptions,
  supportBottom: (request) => [request.top[0], request.top[1] - drop, request.top[2]] });
const count = (built, name) => built.poles.filter((piece) => piece.role === name).length;
const stub = onGround(0.9);
assert.ok(stub.bents.every((bent) => bent.leftGrounded && bent.rightGrounded));
assert.deepEqual([count(stub, "support-post"), count(stub, "footing"), count(stub, "knee-brace"), count(stub, "midheight-cross-brace"), count(stub, "side-brace")],
  [6, 6, 0, 0, 0], "stub posts stand on sleepers and are not braced");
const low = onGround(2);
assert.deepEqual([count(low, "knee-brace"), count(low, "midheight-cross-brace"), count(low, "side-brace"), count(low, "footing")],
  [6 + 8, 0, 0, 6], "a 2 m bent has a knee brace from each post to its cap and to the stringer each way along the path");
for (const knee of low.poles.filter((piece) => piece.role === "knee-brace"))
  assert.ok(knee.length > 0.9 && knee.length < 1.7 && Math.abs(knee.end[1] - knee.start[1]) > 0.5, "a knee brace is a short strut");
const walkUnder = onGround(3.6);
assert.deepEqual([count(walkUnder, "knee-brace"), count(walkUnder, "midheight-cross-brace"), count(walkUnder, "side-brace")], [6 + 8, 0, 0],
  "over ground a 3.5 m boardwalk has knee braces under its deck and nothing lower: the way under it is open");
const headroom = onGround(5.2);
const lowestBrace = Math.min(...headroom.poles.filter((piece) => /brace/.test(piece.role)).flatMap((piece) => [piece.start[1], piece.end[1]]));
const ground = headroom.bents[0].leftBase[1];
assert.ok(count(headroom, "side-brace") === 4 && lowestBrace - ground > C.headroom - C.overshoot[1] - 0.1,
  `braced above head height: the lowest brace end is ${(lowestBrace - ground).toFixed(2)} m over the ground`);
const tall = kit.buildWoodPathLayout(sampler, { ...carpentryOptions, fallbackBaseY: -11 });
assert.equal(count(tall, "support-post"), 6 * 3, "a 12 m post is three logs");
assert.ok(count(tall, "lower-ledger") > 0 && count(tall, "girt") > 0, "a trestle has ledgers and girts between its panels");
const logs = tall.poles.filter((piece) => piece.role === "support-post" && piece.bentIndex === 0 && piece.side === -1);
assert.ok(logs[0].radius < logs[2].radius, "thicker toward the foot");
// A deck that humps: its stringers are laid in two or three lengths to a bay, and every splice that falls
// inside a bay is bound with rope, so that a stringer still runs from cap to cap in one piece.
const hump = (distance, length) => {
  const turn = (distance / length) * Math.PI, slope = (2.2 * Math.sin(2 * turn) * Math.PI) / length, n = Math.hypot(1, slope);
  return { center: [0, 1.05 + 2.2 * Math.sin(turn) ** 2, distance], right: [1, 0, 0], up: [0, 1 / n, -slope / n], forward: [0, slope / n, 1 / n] };
};
const humped = kit.buildWoodPathLayout(
  { length: 18, sampleAtDistance: (distance) => ({ ...hump(distance, 18), width: 8 }) }, carpentryOptions);
const lengths = humped.poles.filter((piece) => piece.role === "top-ledger" || piece.role === "stringer");
const splices = humped.poles.filter((piece) => piece.role === "lashing" && piece.bayIndex !== undefined);
assert.equal(lengths.length, 4 * 3 * 3, "four humped bays, three stringers across, three lengths to each");
assert.equal(splices.length, 4 * 3 * 2, "two splices to each, bound");
assert.equal(carpentry.poles.filter((piece) => piece.role === "lashing" && piece.bayIndex !== undefined).length, 0,
  "a straight flat bay has one length to a stringer and nothing to bind");
for (const splice of splices) {
  const meeting = lengths.filter((piece) => [piece.start, piece.end].some((end) =>
    Math.hypot(end[0] - splice.center[0], end[1] - splice.center[1], end[2] - splice.center[2]) < 0.12));
  assert.equal(meeting.length, 2, "a splice is where two lengths of one stringer meet");
  assert.ok(splice.radius > Math.max(...meeting.map((piece) => piece.radius)), "the rope goes round both");
  assert.ok(splice.center[1] + splice.radius < hump(splice.center[2], 18).center[1] - 0.02, "and stays under the deck's top");
}
// The validator charges a path WOOD_PATH_CARPENTRY_MEMBERS_PER_BAY for each bay and once more for its first
// bent. That covers what was built here, and the most a path can hold: a deck too wide to cross on four-log
// piles, four stringers across in three lengths to a bay.
const extreme = kit.buildWoodPathLayout(
  { length: 24, sampleAtDistance: (distance) => ({ ...hump(distance, 24), width: 12 }) },
  { ...carpentryOptions, profile: { ...profile, bentSpacing: 12 }, fallbackBaseY: -17 });
assert.deepEqual([extreme.bents.length, count(extreme, "support-post"), count(extreme, "top-ledger") + count(extreme, "stringer")],
  [3, 3 * 2 * 4, 2 * 4 * 3], "three bents of four-log piles, two bays of four stringers in three lengths");
assert.ok(count(extreme, "midheight-cross-brace") >= 3 * 2 * 4, "each of its panels has a chevron");
for (const built of [carpentry, stub, low, walkUnder, headroom, tall, humped, extreme])
  assert.ok(built.poles.filter((piece) => piece.role !== "top-rail").length <= kit.WOOD_PATH_CARPENTRY_MEMBERS_PER_BAY * built.bents.length,
    `no more members than its bays are charged for (${built.poles.filter((piece) => piece.role !== "top-rail").length} in ${built.bents.length - 1} bays)`);

console.log(
  "Validated wood-path layout: midpoint planks; the source's light scaffold topology (structure 'unity'); the carpentry (stringers on caps on posts, braced by height, lashed, deterministic) on unchanged columns, rails and barriers; dense rails/barriers, deterministic palette swaps and support probes.",
);
