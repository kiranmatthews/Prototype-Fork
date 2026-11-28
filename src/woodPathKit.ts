/**
 * Pure layout kernel for source-faithful procedural wood paths.
 *
 * This module deliberately owns no Three.js geometry or collision objects.
 * It emits fitted-piece envelopes, seeded variants and semantic member roles.
 * The rustic Meshy renderer fits planks, timber and rope into these envelopes
 * without changing gameplay collision or level data.
 */

export type WoodPathVec3 = [x: number, y: number, z: number];

export interface WoodPathFrame {
  center: WoodPathVec3;
  forward: WoodPathVec3;
  right: WoodPathVec3;
  up: WoodPathVec3;
  width: number;
}

export interface WoodPathSampler {
  length: number;
  sampleAtDistance: (distance: number) => WoodPathFrame;
}

export interface WoodPathProfile {
  deckThickness: number;
  pathSampleSpacing: number;
  plankSpacing: number;
  plankGap: number;
  plankThickness: number;
  plankSideOverhang: number;
  plankYawJitterDegrees: number;
  plankScaleJitter: number;
  plankVerticalJitter: number;
  bentSpacing: number;
  deckSideInset: number;
  crossbeamOverhang: number;
  postRadius: number;
  crossbeamRadius: number;
  ledgerRadius: number;
  braceRadius: number;
  lowerLedgers: boolean;
  diagonalBraces: boolean;
  handrails: boolean;
  handrailHeight: number;
  balustradeVisualSpacing: number;
  balustradeCollisionSpacing: number;
  balustradeCollisionHeight: number;
  balustradeCollisionThickness: number;
  balustradeCollisionOverlap: number;
  supportProbeClearance: number;
  tonalBucketCount: number;
  /**
   * What stands under the deck. `carpentry` (the default) is the stout
   * hand-built framing described at WOOD_PATH_CARPENTRY. `unity` is the light
   * scaffold as the Unity source builds it: thin posts, one ledger a side and
   * crossed poles in every bay. Its radii above size the `unity` members, and
   * `postRadius` is the solid column inside either kind of post.
   */
  structure?: "carpentry" | "unity";
}

/**
 * THE CARPENTRY UNDER A WOOD PATH. Chunky, a little crooked, lashed with rope,
 * and built the way a carpenter would have to build it, so that nothing hangs
 * in the air:
 *
 *   planks  lie on  stringers  (timbers along the path, set on edge and lapped
 *   side by side over each bent)  which lie on the  cap beam  of each bent (a
 *   log across the path, proud of the deck on both sides)  which lies on two
 *   posts,  which stand on  sleepers  where there is ground under them and are
 *   driven piles where there is not.
 *
 * What braces a bent depends on how tall it is (see `woodPathTiers`):
 *   - under 1.2 m: nothing. Two stub posts and their cap.
 *   - up to about 1.9 m (or any height, over ground a body can walk on, until
 *     there is 1.2 m to brace above head height): knee braces, from each post
 *     up to the cap and along to the stringers.
 *   - taller: tiers. The posts are divided into panels about 3 m high (up to
 *     4.2 m on a very tall trestle). Across the bent the top panel is crossed
 *     (an X, one pole on each face of the posts) and each one below it has a
 *     single pole, leaning the other way each time, over a girt. Along the path
 *     every panel has one pole a side, zig-zagging from bay to bay, over a
 *     ledger. A bent too wide for a cross gets a chevron: two poles up to the
 *     middle of the cap or the girt.
 * Over real ground the lowest 2.3 m carry posts only, so the way under a
 * boardwalk stays open; over water or a drop the bracing runs down to 0.4 m
 * above the foot.
 *
 * A post over 5 m is two logs, over 9.5 m three, over 14 m four: butted at a
 * joint, thicker toward the foot. Every joint a pole makes with a post is
 * lashed, and so is the head of every post, and so is the splice where a
 * stringer is made of two lengths inside a bay. Each member overshoots its joints,
 * and has its own small error of thickness, length and line (from the path's
 * seed: the same path is always built the same way).
 *
 * All of this is drawn. What a body collides with is unchanged: the deck, and a
 * plumb column of `postRadius` under each end of every bent (`WoodPathBent`).
 */
export const WOOD_PATH_CARPENTRY = Object.freeze({
  /** A post's radius: 0.17 m and 12 mm for each metre of deck width, between 0.19 and 0.28. */
  postBase: 0.17,
  postPerMetre: 0.012,
  postMin: 0.19,
  postMax: 0.28,
  /** Every other member as a share of the post. */
  capRatio: 0.88,
  stringerRatio: 0.5,
  stringerMin: 0.1,
  braceRatio: 0.55,
  braceMin: 0.1,
  kneeRatio: 0.58,
  girtRatio: 0.55,
  railPost: 0.09,
  /** One stringer under each edge, one in the middle of any deck wider than 3 m between its posts, two beyond 7.5 m. */
  midStringerFrom: 3,
  twoMidStringersFrom: 7.5,
  /** Below this a bent is two stubs and a cap. */
  kneeMinHeight: 1.2,
  /** A knee brace leaves its post this far under the cap, or 42% of the way down a short post. */
  kneeDrop: 0.95,
  /** The first joint under the cap, and how far above its foot a pile's bracing stops. */
  topZone: 0.32,
  footZone: 0.4,
  /** Over ground: nothing but posts this far up. */
  headroom: 2.3,
  /**
   * A panel's height: about 3 m, growing by 0.12 m for each metre of post over 6, to 4.2 m at most. A post
   * is given another panel only once there is 0.6 of one to spare: few tall panels, not many short ones.
   */
  tier: 3,
  tierGrowth: 0.12,
  tierMax: 4.2,
  tierSpare: 0.6,
  minTier: 1.2,
  maxTiers: 5,
  /** A cross needs a panel at least this tall for its width; a wider bent gets a chevron. */
  crossAspect: 0.4,
  /** Post heights at which another log is spliced on. */
  splices: [5, 9.5, 14] as readonly number[],
  /** Metres a member runs on past its joint: at least, and at most. */
  overshoot: [0.14, 0.34] as readonly [number, number],
  /** A lashing: its height, and its radius as a share of what it binds. */
  lashHeight: 0.3,
  lashGirth: 1.12,
});

/**
 * More members than the carpentry can put into one bay with a bent at its end
 * (at most 47 in a bent: a cap, eight logs, two sleepers, ten poles, four
 * girts, eighteen lashings, two handrail posts and their two lashings; and 38
 * in a bay: twelve lengths of stringer, their eight splices, ten poles and
 * eight ledgers). The validator charges an untrusted path this much for each
 * of its bays and once more for its first bent.
 */
export const WOOD_PATH_CARPENTRY_MEMBERS_PER_BAY = 96;

/**
 * How a post of height `height` is braced: `count` panels, the joints between
 * them `step` metres apart from `top` below the cap, the last panel taking up
 * whatever is left down to `foot` (so it is between about half and one and a
 * half steps tall). No panels means knee braces, if `knees`.
 *
 * `step` is one height for a whole path (`woodPathTierStep`), so that the
 * girts and ledgers of neighbouring bents meet at the same level even where
 * the ground under them rises and falls.
 */
export const woodPathTiers = (
  height: number,
  grounded: boolean,
  step = woodPathTierStep([height], grounded),
): { count: number; step: number; top: number; foot: number; knees: boolean } => {
  const C = WOOD_PATH_CARPENTRY;
  const foot = height - (grounded ? C.headroom : C.footZone);
  const usable = foot - C.topZone;
  if (!(usable >= C.minTier) || !(step > 0))
    return { count: 0, step: 0, top: C.topZone, foot, knees: height >= C.kneeMinHeight };
  const count = Math.max(1, Math.min(C.maxTiers, Math.round(usable / step)));
  return { count, step, top: C.topZone, foot, knees: false };
};

/** The panel height for a path whose posts are `heights` tall: that of its middle post. */
export const woodPathTierStep = (heights: readonly number[], grounded = false): number => {
  const C = WOOD_PATH_CARPENTRY;
  const braced = heights
    .filter((height) => height - C.topZone - (grounded ? C.headroom : C.footZone) >= C.minTier)
    .sort((a, b) => a - b);
  if (!braced.length) return 0;
  const height = braced[braced.length >> 1];
  const usable = height - C.topZone - (grounded ? C.headroom : C.footZone);
  const preferred = Math.max(
    C.tier,
    Math.min(C.tierMax, C.tier + C.tierGrowth * Math.max(0, height - 6)),
  );
  return usable / Math.max(1, Math.min(C.maxTiers, Math.floor(usable / preferred + 1 - C.tierSpare)));
};

/** Unity ProceduralWoodPath defaults plus ApplyLightBoardwalkPreset. */
export const UNITY_LIGHT_BOARDWALK_PROFILE: Readonly<WoodPathProfile> =
  Object.freeze({
    deckThickness: 0.32,
    pathSampleSpacing: 0.45,
    plankSpacing: 0.55,
    plankGap: 0.045,
    plankThickness: 0.16,
    plankSideOverhang: 0.16,
    plankYawJitterDegrees: 1.15,
    plankScaleJitter: 0.035,
    plankVerticalJitter: 0.012,
    bentSpacing: 4.5,
    deckSideInset: 0.34,
    crossbeamOverhang: 0.48,
    postRadius: 0.115,
    crossbeamRadius: 0.09,
    ledgerRadius: 0.072,
    braceRadius: 0.055,
    lowerLedgers: false,
    diagonalBraces: true,
    handrails: true,
    handrailHeight: 1.05,
    balustradeVisualSpacing: 1.15,
    balustradeCollisionSpacing: 0.7,
    balustradeCollisionHeight: 1,
    balustradeCollisionThickness: 0.14,
    balustradeCollisionOverlap: 0.08,
    supportProbeClearance: 0.18,
    tonalBucketCount: 4,
    structure: "carpentry",
  });

/** Exact plank/deck overrides used by Unity's Island Hopper builder. */
export const UNITY_ISLAND_BOARDWALK_PROFILE: Readonly<WoodPathProfile> =
  Object.freeze({
    ...UNITY_LIGHT_BOARDWALK_PROFILE,
    deckThickness: 0.42,
    pathSampleSpacing: 0.35,
    plankSpacing: 0.68,
    plankGap: 0.038,
    plankThickness: 0.135,
    plankSideOverhang: 0.1,
    plankYawJitterDegrees: 1.65,
    plankScaleJitter: 0.055,
    plankVerticalJitter: 0.014,
  });

/** Exact plank/deck overrides used by Unity's Beachfront boardwalks. */
export const UNITY_BEACH_BOARDWALK_PROFILE: Readonly<WoodPathProfile> =
  Object.freeze({
    ...UNITY_LIGHT_BOARDWALK_PROFILE,
    deckThickness: 0.24,
    pathSampleSpacing: 0.35,
    plankSpacing: 0.72,
    plankGap: 0.038,
    plankThickness: 0.14,
    plankSideOverhang: 0.09,
    plankYawJitterDegrees: 2.2,
    plankScaleJitter: 0.06,
    plankVerticalJitter: 0.014,
  });

export interface WoodPathPieceBasis {
  right: WoodPathVec3;
  up: WoodPathVec3;
  forward: WoodPathVec3;
}

export interface WoodPathPlankPiece {
  kind: "plank";
  index: number;
  distance: number;
  center: WoodPathVec3;
  basis: WoodPathPieceBasis;
  size: WoodPathVec3;
  yawDegrees: number;
  verticalOffset: number;
  scaleNoise: number;
  variantIndex: number;
  tonalBucket: number;
}

export type WoodPathPoleRole =
  | "support-post"
  | "crossbeam"
  | "handrail-post"
  | "top-ledger"
  | "lower-ledger"
  | "side-brace"
  | "midheight-cross-brace"
  | "top-rail"
  // the carpentry's own
  | "stringer"
  | "knee-brace"
  | "girt"
  | "footing"
  | "lashing";

export type WoodPathSide = -1 | 1;

export interface WoodPathPolePiece {
  kind: "pole";
  index: number;
  role: WoodPathPoleRole;
  start: WoodPathVec3;
  end: WoodPathVec3;
  center: WoodPathVec3;
  direction: WoodPathVec3;
  length: number;
  radius: number;
  side?: WoodPathSide;
  bentIndex?: number;
  bayIndex?: number;
  variantIndex: number;
  tonalBucket: number;
  /**
   * How a squared timber is turned about its own length: radians from standing
   * on edge (its broad faces plumb). The carpentry sets it, so that a hewn beam
   * lies square to the world and not at whatever angle its number gave it.
   * Absent, the member is turned at random, as a round pole may be.
   */
  roll?: number;
}

export interface WoodPathBent {
  index: number;
  distance: number;
  frame: WoodPathFrame;
  leftTop: WoodPathVec3;
  rightTop: WoodPathVec3;
  leftBase: WoodPathVec3;
  rightBase: WoodPathVec3;
  /** The support probe found ground under that post; false is the fallback depth (a pile over water or a drop). */
  leftGrounded: boolean;
  rightGrounded: boolean;
}

export interface WoodPathBalustradeBarrier {
  side: WoodPathSide;
  index: number;
  startEdge: WoodPathVec3;
  endEdge: WoodPathVec3;
  center: WoodPathVec3;
  basis: WoodPathPieceBasis;
  size: WoodPathVec3;
}

export interface WoodPathRailLayout {
  side: WoodPathSide;
  points: WoodPathVec3[];
}

export interface WoodPathSupportRequest {
  bentIndex: number;
  side: WoodPathSide;
  top: WoodPathVec3;
  probeOrigin: WoodPathVec3;
  fallback: WoodPathVec3;
  deckUp: WoodPathVec3;
}

export interface WoodPathKitOptions {
  profile?: Readonly<WoodPathProfile>;
  plankSeed?: number;
  poleSeed?: number;
  plankVariantWeights?: readonly number[];
  poleVariantWeights?: readonly number[];
  /** Unity Island Hopper uses -3.6. Beachfront supplies a path-local value. */
  fallbackBaseY?: number;
  /** Used only when fallbackBaseY is absent. */
  fallbackSupportDepth?: number;
  /** Return null to use the supplied fallback. */
  supportBottom?: (request: WoodPathSupportRequest) => WoodPathVec3 | null;
  includePlanks?: boolean;
  includeSupports?: boolean;
  includeHandrails?: boolean;
}

export interface WoodPathLayout {
  profile: Readonly<WoodPathProfile>;
  length: number;
  plankPitch: number;
  bentSpacing: number;
  planks: WoodPathPlankPiece[];
  poles: WoodPathPolePiece[];
  bents: WoodPathBent[];
  balustradeBarriers: WoodPathBalustradeBarrier[];
  rails: [left: WoodPathRailLayout, right: WoodPathRailLayout];
}

const UINT_MAX = 0xffffffff;

const finite = (value: number, fallback = 0): number =>
  Number.isFinite(value) ? value : fallback;

const v = (x = 0, y = 0, z = 0): WoodPathVec3 => [x, y, z];
const add = (a: WoodPathVec3, b: WoodPathVec3): WoodPathVec3 =>
  v(a[0] + b[0], a[1] + b[1], a[2] + b[2]);
const subtract = (a: WoodPathVec3, b: WoodPathVec3): WoodPathVec3 =>
  v(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const multiply = (a: WoodPathVec3, scalar: number): WoodPathVec3 =>
  v(a[0] * scalar, a[1] * scalar, a[2] * scalar);
const addScaled = (
  a: WoodPathVec3,
  b: WoodPathVec3,
  scalar: number,
): WoodPathVec3 => add(a, multiply(b, scalar));
const dot = (a: WoodPathVec3, b: WoodPathVec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: WoodPathVec3, b: WoodPathVec3): WoodPathVec3 =>
  v(
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  );
const magnitude = (a: WoodPathVec3): number => Math.hypot(a[0], a[1], a[2]);
const normalize = (
  a: WoodPathVec3,
  fallback: WoodPathVec3 = [0, 1, 0],
): WoodPathVec3 => {
  const length = magnitude(a);
  return length > 1e-8 ? multiply(a, 1 / length) : [...fallback];
};
const lerp = (a: WoodPathVec3, b: WoodPathVec3, t: number): WoodPathVec3 =>
  v(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );
const clone = (a: WoodPathVec3): WoodPathVec3 => [...a];

const normalizedFrame = (frame: WoodPathFrame): WoodPathFrame => {
  const forward = normalize(frame.forward, [0, 0, 1]);
  let up = subtract(frame.up, multiply(forward, dot(frame.up, forward)));
  up = normalize(up, [0, 1, 0]);
  let right = normalize(cross(up, forward), frame.right);
  if (dot(right, frame.right) < 0) right = multiply(right, -1);
  up = normalize(cross(forward, right), up);
  return {
    center: v(
      finite(frame.center[0]),
      finite(frame.center[1]),
      finite(frame.center[2]),
    ),
    forward,
    right,
    up,
    width: Math.max(0.25, finite(frame.width, 6)),
  };
};

/** Exact unchecked-uint noise used by Unity ProceduralWoodPath jitter. */
export const unityWoodSignedNoise = (
  index: number,
  seed: number,
  salt: number,
): number => {
  let value =
    (Math.imul(index | 0, 73856093) ^
      Math.imul(seed | 0, 19349663) ^
      Math.imul(salt | 0, 83492791)) >>>
    0;
  value = (value ^ (value >>> 13)) >>> 0;
  value = Math.imul(value, 1274126177) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return (value / UINT_MAX) * 2 - 1;
};

/** Exact stronger hash used by Unity's batched placeholder pole tint. */
export const unityStructureSignedNoise = (
  index: number,
  seed: number,
  salt: number,
): number => {
  let value =
    (Math.imul(index | 0, 73856093) ^
      Math.imul(seed | 0, 19349663) ^
      Math.imul(salt | 0, 83492791)) >>>
    0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return (value / UINT_MAX) * 2 - 1;
};

export const unityTonalBucket = (noise: number, bucketCount = 4): number => {
  const count = Math.max(1, Math.min(8, Math.round(bucketCount)));
  const normalized = Math.max(0, Math.min(1, noise * 0.5 + 0.5));
  return Math.min(count - 1, Math.floor(normalized * count));
};

const unityVariantHash = (index: number, seed: number): number => {
  let value = ((index | 0) + 0x9e3779b9) >>> 0;
  value =
    (value ^
      (((seed | 0) + 0x85ebca6b + ((value << 6) >>> 0) + (value >>> 2)) >>>
        0)) >>>
    0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
};

/** Returns -1 when a palette has no usable variants. */
export const chooseUnityWeightedVariant = (
  index: number,
  seed: number,
  rawWeights?: readonly number[],
): number => {
  if (!rawWeights?.length) return -1;
  const weights = rawWeights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? Math.max(0.001, weight) : 0,
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return -1;
  let cursor = (unityVariantHash(index, seed) / UINT_MAX) * total;
  let fallback = -1;
  for (let candidate = 0; candidate < weights.length; candidate++) {
    const weight = weights[candidate];
    if (weight <= 0) continue;
    fallback = candidate;
    cursor -= weight;
    if (cursor <= 0) return candidate;
  }
  return fallback;
};

/** Shared by construction and the untrusted-level support-work budget. */
export const woodPathBentIntervals = (length: number, bentSpacing: number): number =>
  Math.max(1, Math.ceil(length / Math.max(0.5, finite(bentSpacing, 4.5))));

const profileWithSafety = (
  raw: Readonly<WoodPathProfile>,
): Readonly<WoodPathProfile> => ({
  ...raw,
  deckThickness: Math.max(0.02, finite(raw.deckThickness, 0.32)),
  pathSampleSpacing: Math.max(0.05, finite(raw.pathSampleSpacing, 0.45)),
  plankSpacing: Math.max(0.08, finite(raw.plankSpacing, 0.55)),
  plankGap: Math.max(0, finite(raw.plankGap, 0.045)),
  plankThickness: Math.max(0.02, finite(raw.plankThickness, 0.16)),
  plankSideOverhang: Math.max(0, finite(raw.plankSideOverhang, 0.16)),
  plankYawJitterDegrees: Math.max(
    0,
    finite(raw.plankYawJitterDegrees, 1.15),
  ),
  plankScaleJitter: Math.max(0, finite(raw.plankScaleJitter, 0.035)),
  plankVerticalJitter: Math.max(0, finite(raw.plankVerticalJitter, 0.012)),
  bentSpacing: Math.max(0.5, finite(raw.bentSpacing, 4.5)),
  deckSideInset: Math.max(0, finite(raw.deckSideInset, 0.34)),
  crossbeamOverhang: Math.max(0, finite(raw.crossbeamOverhang, 0.48)),
  postRadius: Math.max(0.025, finite(raw.postRadius, 0.115)),
  crossbeamRadius: Math.max(0.025, finite(raw.crossbeamRadius, 0.09)),
  ledgerRadius: Math.max(0.02, finite(raw.ledgerRadius, 0.072)),
  braceRadius: Math.max(0.02, finite(raw.braceRadius, 0.055)),
  handrailHeight: Math.max(0.25, finite(raw.handrailHeight, 1.05)),
  balustradeVisualSpacing: Math.max(
    0.1,
    finite(raw.balustradeVisualSpacing, 1.15),
  ),
  balustradeCollisionSpacing: Math.max(
    0.1,
    finite(raw.balustradeCollisionSpacing, 0.7),
  ),
  balustradeCollisionHeight: Math.max(
    0.25,
    Math.min(
      Math.max(0.25, finite(raw.handrailHeight, 1.05)),
      finite(raw.balustradeCollisionHeight, 1),
    ),
  ),
  balustradeCollisionThickness: Math.max(
    0.025,
    finite(raw.balustradeCollisionThickness, 0.14),
  ),
  balustradeCollisionOverlap: Math.max(
    0,
    finite(raw.balustradeCollisionOverlap, 0.08),
  ),
  supportProbeClearance: Math.max(0, finite(raw.supportProbeClearance, 0.18)),
  tonalBucketCount: Math.max(
    1,
    Math.min(8, Math.round(finite(raw.tonalBucketCount, 4))),
  ),
  structure: raw.structure === "unity" ? "unity" : "carpentry",
});

const topAt = (
  frame: WoodPathFrame,
  side: WoodPathSide,
  profile: Readonly<WoodPathProfile>,
): WoodPathVec3 =>
  addScaled(
    addScaled(
      frame.center,
      frame.up,
      -(profile.deckThickness + profile.crossbeamRadius),
    ),
    frame.right,
    side * Math.max(0.2, frame.width * 0.5 - profile.deckSideInset),
  );

const balustradeEdge = (
  frame: WoodPathFrame,
  side: WoodPathSide,
): WoodPathVec3 =>
  addScaled(frame.center, frame.right, side * (frame.width * 0.5 + 0.04));

const balustradeTop = (
  frame: WoodPathFrame,
  side: WoodPathSide,
  profile: Readonly<WoodPathProfile>,
): WoodPathVec3 =>
  addScaled(balustradeEdge(frame, side), frame.up, profile.handrailHeight);

const projectedUp = (
  preferred: WoodPathVec3,
  forward: WoodPathVec3,
): WoodPathVec3 => {
  let up = subtract(preferred, multiply(forward, dot(preferred, forward)));
  if (magnitude(up) < 1e-6)
    up = subtract([0, 1, 0], multiply(forward, forward[1]));
  return normalize(up, [0, 1, 0]);
};

interface CarpentryJob {
  profile: Readonly<WoodPathProfile>;
  bents: WoodPathBent[];
  sample: (distance: number) => WoodPathFrame;
  seed: number;
  pushPole: (
    role: WoodPathPoleRole,
    start: WoodPathVec3,
    end: WoodPathVec3,
    radius: number,
    metadata?: Pick<WoodPathPolePiece, "side" | "bentIndex" | "bayIndex" | "roll">,
  ) => void;
  includeSupports: boolean;
  includeHandrails: boolean;
}

/** One post of a bent, as the carpentry draws it. */
interface CarpentryPost {
  side: WoodPathSide;
  top: WoodPathVec3;
  base: WoodPathVec3;
  height: number;
  grounded: boolean;
  radius: number;
  tiers: ReturnType<typeof woodPathTiers>;
  /** Depths below the head at which something is lashed to it. */
  joints: number[];
}

const horizontal = (a: WoodPathVec3, fallback: WoodPathVec3): WoodPathVec3 =>
  normalize([a[0], 0, a[2]], fallback);

/** See WOOD_PATH_CARPENTRY. */
const buildCarpentry = (job: CarpentryJob): void => {
  const C = WOOD_PATH_CARPENTRY;
  const { profile, bents, pushPole, sample, seed } = job;
  if (!bents.length) return;
  // Every "error" a member has is a hash of what it is and where: the same
  // path is always built the same way, whatever else is on the course.
  const noise = (key: number, kind: number): number =>
    unityStructureSignedNoise(key, seed, 211 + kind * 37);
  const jitter = (key: number, kind: number, amount: number): number =>
    noise(key, kind) * amount;
  const overshoot = (key: number, kind: number): number =>
    C.overshoot[0] + (noise(key, kind) * 0.5 + 0.5) * (C.overshoot[1] - C.overshoot[0]);
  /** A member from a to b, run on past both joints, and not quite where the rule says: each end is out by up to `off` metres up or down. */
  const member = (
    role: WoodPathPoleRole,
    from: WoodPathVec3,
    to: WoodPathVec3,
    radius: number,
    key: number,
    metadata: Pick<WoodPathPolePiece, "side" | "bentIndex" | "bayIndex">,
    past: readonly [number, number] | null = null,
    off = 0.045,
    floors: readonly [number, number] = [-Infinity, -Infinity],
    ceilings: readonly [number, number] = [Infinity, Infinity],
  ): void => {
    const a: WoodPathVec3 = [from[0], from[1] + jitter(key, 14, off), from[2]];
    const b: WoodPathVec3 = [to[0], to[1] + jitter(key, 15, off), to[2]];
    const along = subtract(b, a);
    const span = magnitude(along);
    if (span < 1e-4) return;
    const unit = multiply(along, 1 / span);
    let [before, after] = past ?? [overshoot(key, 1), overshoot(key, 2)];
    // An end that comes down at a post's foot runs on only as far as the ground (`floors`: the lowest each end may go).
    if (unit[1] > 1e-3) before = Math.max(0, Math.min(before, (a[1] - floors[0]) / unit[1]));
    if (unit[1] < -1e-3) after = Math.max(0, Math.min(after, (b[1] - floors[1]) / -unit[1]));
    // ...and one that goes up to a post's head stops under its cap (`ceilings`).
    if (unit[1] < -1e-3) before = Math.max(0, Math.min(before, (ceilings[0] - a[1]) / -unit[1]));
    if (unit[1] > 1e-3) after = Math.max(0, Math.min(after, (ceilings[1] - b[1]) / unit[1]));
    pushPole(
      role,
      addScaled(a, unit, -before),
      addScaled(b, unit, after),
      radius * (1 + jitter(key, 3, 0.08)),
      // (a squared timber is set on edge, a few degrees out)
      { ...metadata, roll: jitter(key, 16, 0.09) },
    );
  };
  const meanWidth = bents.reduce((sum, bent) => sum + bent.frame.width, 0) / bents.length;
  const postRadius = Math.max(C.postMin, Math.min(C.postMax, C.postBase + C.postPerMetre * meanWidth));
  const capRadius = postRadius * C.capRatio;
  const stringerRadius = Math.max(C.stringerMin, postRadius * C.stringerRatio);
  const braceRadius = Math.max(C.braceMin, postRadius * C.braceRatio);
  const kneeRadius = postRadius * C.kneeRatio;
  const girtRadius = postRadius * C.girtRatio;
  // From the top of the deck down: planks, then stringers under them, then the cap under those.
  const stringerDepth = profile.plankThickness + stringerRadius - 0.015;
  const capDepth = profile.plankThickness + stringerRadius * 2 * 0.93 + capRadius * 0.9;
  const at = (frame: WoodPathFrame, across: number, down: number, along = 0): WoodPathVec3 =>
    addScaled(
      addScaled(addScaled(frame.center, frame.right, across), frame.up, -down),
      frame.forward,
      along,
    );
  const postLine = (frame: WoodPathFrame): number =>
    Math.max(0.2, frame.width * 0.5 - profile.deckSideInset);

  // ---- the bents: their caps, and where their posts stand ---------------------------------------------
  const posts: [CarpentryPost | null, CarpentryPost | null][] = [];
  if (job.includeSupports)
    for (const bent of bents) {
      const frame = bent.frame;
      const half = postLine(frame);
      const key = bent.index * 64;
      const ahead = horizontal(frame.forward, [0, 0, 1]);
      const reach = Math.max(profile.crossbeamOverhang, postRadius * 1.9);
      pushPole(
        "crossbeam",
        at(frame, -(half + reach + Math.abs(jitter(key, 4, 0.12))), capDepth + jitter(key, 5, 0.015)),
        at(frame, half + reach + Math.abs(jitter(key, 6, 0.12)), capDepth + jitter(key, 7, 0.015)),
        capRadius * (1 + jitter(key, 8, 0.07)),
        { bentIndex: bent.index, roll: jitter(key, 16, 0.09) },
      );
      const pair: [CarpentryPost | null, CarpentryPost | null] = [null, null];
      for (const side of [-1, 1] as const) {
        const head = at(frame, side * half, capDepth - capRadius * 0.22);
        const foot = side < 0 ? bent.leftBase : bent.rightBase;
        const grounded = side < 0 ? bent.leftGrounded : bent.rightGrounded;
        const height = head[1] - foot[1];
        if (height < 0.25) continue; // the cap lies on the ground here
        const lean = Math.min(0.05, height * 0.012);
        const base: WoodPathVec3 = [
          foot[0] + jitter(key + side + 2, 9, lean),
          foot[1],
          foot[2] + jitter(key + side + 2, 10, lean),
        ];
        const post: CarpentryPost = {
          side,
          top: head,
          base,
          height,
          grounded,
          radius: postRadius * (1 + jitter(key + side + 2, 11, 0.06)),
          tiers: woodPathTiers(height, grounded, 0),
          joints: [],
        };
        pair[side < 0 ? 0 : 1] = post;
        if (grounded && height >= 0.6) {
          // A sleeper: a short log along the path, a third of it in the ground, that the post stands on.
          const sleeper = post.radius * 0.82;
          const centre: WoodPathVec3 = [base[0], base[1] + sleeper * 0.3, base[2]];
          const run = post.radius * (2.3 + Math.abs(jitter(key + side + 2, 12, 0.6)));
          pushPole(
            "footing",
            addScaled(centre, ahead, -run),
            addScaled(centre, ahead, run),
            sleeper,
            { side, bentIndex: bent.index },
          );
        }
      }
      posts.push(pair);
    }
  // One panel height for the whole path, from its middle post: joints then sit level from bent to bent.
  const all = posts.flat().filter((post): post is CarpentryPost => post !== null);
  for (const grounded of [false, true]) {
    const step = woodPathTierStep(
      all.filter((post) => post.grounded === grounded).map((post) => post.height),
      grounded,
    );
    for (const post of all)
      if (post.grounded === grounded) post.tiers = woodPathTiers(post.height, grounded, step);
  }
  const on = (post: CarpentryPost, depth: number): WoodPathVec3 =>
    lerp(post.top, post.base, Math.min(1, depth / post.height));
  /** How far below its head a post's joint `level` is: evenly stepped, the last one at its foot. */
  const node = (post: CarpentryPost, level: number): number =>
    level >= post.tiers.count ? post.tiers.foot : post.tiers.top + level * post.tiers.step;
  const joint = (post: CarpentryPost, depth: number): void => {
    if (!post.joints.some((other) => Math.abs(other - depth) < 0.18)) post.joints.push(depth);
  };

  // ---- what braces each bent across the path ---------------------------------------------------------
  if (job.includeSupports)
    for (const [order, bent] of bents.entries()) {
      const frame = bent.frame;
      const half = postLine(frame);
      const key = bent.index * 64;
      const ahead = horizontal(frame.forward, [0, 0, 1]);
      const [left, right] = posts[order];
      const lowest = Math.min(left?.height ?? 0, right?.height ?? 0);
      if (left && right && left.tiers.count === 0 && right.tiers.count === 0) {
        if (lowest >= C.kneeMinHeight)
          for (const post of [left, right]) {
            // A knee brace: from the post up to the cap, on the face of the bent that looks down the path.
            const drop = Math.min(C.kneeDrop, post.height * 0.42);
            const face = multiply(ahead, (post.radius + kneeRadius) * 0.55);
            member(
              "knee-brace",
              add(on(post, drop), face),
              add(at(frame, post.side * (half - drop * 0.95), capDepth + capRadius * 0.55), face),
              kneeRadius,
              key + 8 + post.side,
              { side: post.side, bentIndex: bent.index },
              [0.1, 0.08],
              0.015,
            );
            joint(post, drop);
          }
      } else if (left && right) {
        const panels = Math.min(left.tiers.count, right.tiers.count);
        for (let level = 0; level < panels; level++) {
          const tall = (node(left, level + 1) - node(left, level) + node(right, level + 1) - node(right, level)) * 0.5;
          const crossed = tall >= C.crossAspect * half * 2;
          const front = multiply(ahead, (postRadius + braceRadius) * 0.72);
          const back = multiply(ahead, -(postRadius + braceRadius) * 0.72);
          const braceKey = key + 16 + level * 4;
          const metadata = { bentIndex: bent.index };
          if (crossed) {
            // The top panel is crossed, one pole on each face of the posts. Each panel under it has one
            // pole, leaning the other way each time.
            const rising = ((bent.index + level) & 1) === 0;
            if (level === 0 || rising)
              member("midheight-cross-brace", add(on(left, node(left, level + 1)), front),
                add(on(right, node(right, level)), front), braceRadius, braceKey, metadata, null, 0.045,
                [left.base[1] + braceRadius, right.base[1] + braceRadius], [left.top[1], right.top[1]]);
            if (level === 0 || !rising)
              member("midheight-cross-brace", add(on(right, node(right, level + 1)), back),
                add(on(left, node(left, level)), back), braceRadius, braceKey + 1, metadata, null, 0.045,
                [right.base[1] + braceRadius, left.base[1] + braceRadius], [right.top[1], left.top[1]]);
          } else {
            // Too wide to cross: a chevron, both poles up to the middle of the cap (or of the girt above).
            const apex = level === 0
              ? at(frame, 0, capDepth + capRadius * 0.8)
              : lerp(on(left, node(left, level)), on(right, node(right, level)), 0.5);
            member("midheight-cross-brace", add(on(left, node(left, level + 1)), front), add(apex, front),
              braceRadius, braceKey, metadata, [overshoot(braceKey, 1), 0.06], 0.045,
              [left.base[1] + braceRadius, -Infinity]);
            member("midheight-cross-brace", add(on(right, node(right, level + 1)), back), add(apex, back),
              braceRadius, braceKey + 1, metadata, [overshoot(braceKey + 1, 1), 0.06], 0.045,
              [right.base[1] + braceRadius, -Infinity]);
          }
          joint(left, node(left, level));
          joint(right, node(right, level));
          joint(left, node(left, level + 1));
          joint(right, node(right, level + 1));
          if (level > 0) {
            // A girt across the bent between two panels, on the far face from the pole above it.
            const face = multiply(ahead, -(postRadius + girtRadius) * 0.8);
            member("girt", add(on(left, node(left, level)), face), add(on(right, node(right, level)), face),
              girtRadius, braceKey + 2, metadata);
          }
        }
      }
    }

  // ---- the bays: stringers, and what braces the bents along the path -----------------------------
  if (job.includeSupports)
    for (let index = 1; index < bents.length; index++) {
      const before = bents[index - 1];
      const after = bents[index];
      const key = index * 64 + 32;
      const span = after.distance - before.distance;
      // Stringers follow the deck: a bay that humps or turns is laid in two or three lengths.
      const mid = sample((before.distance + after.distance) * 0.5);
      const chord = lerp(before.frame.center, after.frame.center, 0.5);
      const sag = magnitude(subtract(mid.center, chord));
      const lengths = sag > 0.16 || span > 11 ? 3 : sag > 0.05 || span > 7.5 ? 2 : 1;
      const between = postLine(mid) * 2;
      const middles = between >= C.twoMidStringersFrom ? 2 : between >= C.midStringerFrom ? 1 : 0;
      const lines = middles === 2 ? [-1, -1 / 3, 1 / 3, 1] : middles === 1 ? [-1, 0, 1] : [-1, 1];
      // Consecutive bays lap side by side over the cap they share.
      const lap = ((index & 1) === 0 ? 1 : -1) * stringerRadius * 0.85;
      for (const [line, share] of lines.entries())
        for (let piece = 0; piece < lengths; piece++) {
          const from = sample(before.distance + (span * piece) / lengths);
          const to = sample(before.distance + (span * (piece + 1)) / lengths);
          const first = piece === 0;
          const last = piece === lengths - 1;
          member(
            share === -1 || share === 1 ? "top-ledger" : "stringer",
            at(from, share * postLine(from) + lap, stringerDepth),
            at(to, share * postLine(to) + lap, stringerDepth),
            stringerRadius,
            key + line * 4 + piece,
            { side: share < 0 ? -1 : share > 0 ? 1 : undefined, bayIndex: index },
            [
              first ? (index === 1 ? 0.04 : overshoot(key + line * 4, 1)) : 0.06,
              last ? (index === bents.length - 1 ? 0.04 : overshoot(key + line * 4, 2)) : 0.06,
            ],
            0, // (a stringer bears on the caps and under the planks: it is where the rule says)
          );
          if (last) continue;
          // Where one length ends inside a bay the next is scarfed to it, and the splice is bound with rope:
          // a stringer runs from cap to cap in one piece, however many lengths it was made from.
          const splice = at(to, share * postLine(to) + lap, stringerDepth);
          const bound = C.lashHeight * (0.5 + jitter(key + line * 4 + piece, 13, 0.08));
          pushPole(
            "lashing",
            addScaled(splice, to.forward, -bound),
            addScaled(splice, to.forward, bound),
            stringerRadius * C.lashGirth,
            { side: share < 0 ? -1 : share > 0 ? 1 : undefined, bayIndex: index },
          );
        }
      for (const side of [-1, 1] as const) {
        const a = posts[index - 1]?.[side < 0 ? 0 : 1];
        const b = posts[index]?.[side < 0 ? 0 : 1];
        if (!a || !b) continue;
        const outward = multiply(horizontal(mid.right, [1, 0, 0]), side);
        const panels = Math.min(a.tiers.count, b.tiers.count);
        const metadata = { side, bayIndex: index };
        if (panels === 0) {
          // Knee braces along the path: from each post up to the stringer over it, into the bay.
          for (const [post, bent, into] of [[a, before, 1], [b, after, -1]] as const) {
            if (!post.tiers.knees || post.tiers.count > 0) continue;
            const drop = Math.min(C.kneeDrop, post.height * 0.42, span * 0.3);
            const frame = sample(bent.distance + into * drop);
            const face = multiply(outward, (post.radius + kneeRadius) * 0.5);
            member(
              "knee-brace",
              add(on(post, drop), face),
              add(at(frame, side * postLine(frame), stringerDepth + stringerRadius * 0.6), face),
              kneeRadius,
              key + 24 + (side + 1) + (into + 1) * 2,
              metadata,
              [0.1, 0.08],
              0.015,
            );
            joint(post, drop);
          }
          continue;
        }
        for (let level = 0; level < panels; level++) {
          // One pole a side in every panel, zig-zagging from bay to bay and from panel to panel.
          // (both sides of a bay lean the same way: seen from the side that is one zig-zag, not a cross)
          const rising = ((index + level) & 1) === 0;
          const face = multiply(outward, (postRadius + braceRadius) * 0.75);
          member(
            "side-brace",
            add(on(a, node(a, rising ? level + 1 : level)), face),
            add(on(b, node(b, rising ? level : level + 1)), face),
            braceRadius,
            key + 40 + level * 4 + (side + 1),
            metadata,
            null,
            0.045,
            [a.base[1] + braceRadius, b.base[1] + braceRadius],
            [a.top[1], b.top[1]],
          );
          joint(a, node(a, level));
          joint(a, node(a, level + 1));
          joint(b, node(b, level));
          joint(b, node(b, level + 1));
          if (level > 0) {
            const ledge = multiply(outward, (postRadius + girtRadius) * 0.85);
            member("lower-ledger", add(on(a, node(a, level)), ledge), add(on(b, node(b, level)), ledge),
              girtRadius, key + 41 + level * 4 + (side + 1), metadata);
          }
        }
      }
    }

  // ---- the posts themselves, now that every joint on them is known --------------------------------
  if (job.includeSupports)
    for (const [bentIndex, pair] of posts.entries())
      for (const post of pair) {
        if (!post) continue;
        const key = bentIndex * 64 + 48 + (post.side + 1);
        const metadata = { side: post.side, bentIndex: bents[bentIndex].index };
        const logs = 1 + C.splices.filter((height) => post.height > height).length;
        // A splice is made at a joint if there is one near it: that is where it would be lashed anyway.
        const cuts = [0];
        for (let log = 1; log < logs; log++) {
          const even = (post.height * log) / logs;
          const near = post.joints.reduce(
            (best, depth) => (Math.abs(depth - even) < Math.abs(best - even) ? depth : best),
            Infinity,
          );
          cuts.push(Math.abs(near - even) < 0.75 ? near : even);
        }
        cuts.push(post.height);
        for (let log = 0; log < logs; log++) {
          // Thicker toward the foot; each log starts a hand's breadth inside the one above it.
          const girth = logs === 1 ? 1 : 0.95 + (0.13 * log) / (logs - 1);
          pushPole(
            "support-post",
            on(post, Math.max(0, cuts[log] - (log ? 0.1 : 0))),
            on(post, cuts[log + 1]),
            post.radius * girth,
            metadata,
          );
          if (log) {
            const depth = cuts[log];
            if (!post.joints.some((other) => Math.abs(other - depth) < 0.18)) post.joints.push(depth);
          }
        }
        // The head of every post is lashed to its cap, and so is every joint a pole makes with it.
        if (post.height >= 0.6 && !post.joints.some((depth) => depth < 0.4)) post.joints.push(0.2);
        for (const [order, depth] of post.joints.sort((p, q) => p - q).entries()) {
          if (depth > post.height - 0.05) continue;
          const half = C.lashHeight * (0.5 + jitter(key + order, 13, 0.08));
          pushPole(
            "lashing",
            on(post, Math.max(0.02, depth - half)),
            on(post, Math.min(post.height, depth + half)),
            post.radius * (logs === 1 ? 1 : 1.05) * C.lashGirth,
            metadata,
          );
        }
      }

  // ---- handrail posts: lashed to the end of each cap, with a turn of rope where the rail passes ----
  if (job.includeHandrails)
    for (const bent of bents) {
      const frame = bent.frame;
      for (const side of [-1, 1] as const) {
        const across = side * (frame.width * 0.5 + 0.04);
        const foot = job.includeSupports ? at(frame, across, capDepth + capRadius * 0.9) : at(frame, across, 0);
        const head = at(frame, across, -profile.handrailHeight);
        const radius = job.includeSupports ? C.railPost : profile.ledgerRadius;
        pushPole("handrail-post", foot, head, radius, { side, bentIndex: bent.index });
        if (!job.includeSupports) continue;
        pushPole("lashing", at(frame, across, -profile.handrailHeight + 0.2),
          at(frame, across, -profile.handrailHeight + 0.03), radius * 1.5, { side, bentIndex: bent.index });
      }
    }
};

export const buildWoodPathLayout = (
  sampler: WoodPathSampler,
  options: WoodPathKitOptions = {},
): WoodPathLayout => {
  const profile = profileWithSafety(
    options.profile ?? UNITY_LIGHT_BOARDWALK_PROFILE,
  );
  const length = Math.max(0, finite(sampler.length));
  const sample = (distance: number): WoodPathFrame =>
    normalizedFrame(sampler.sampleAtDistance(Math.max(0, Math.min(length, distance))));
  const plankSeed = options.plankSeed ?? 7319;
  const poleSeed = options.poleSeed ?? 19411;
  const includePlanks = options.includePlanks !== false;
  const includeSupports = options.includeSupports !== false;
  const includeHandrails = options.includeHandrails ?? profile.handrails;
  const planks: WoodPathPlankPiece[] = [];
  const poles: WoodPathPolePiece[] = [];
  const bents: WoodPathBent[] = [];
  const balustradeBarriers: WoodPathBalustradeBarrier[] = [];
  const rails: [WoodPathRailLayout, WoodPathRailLayout] = [
    { side: -1, points: [] },
    { side: 1, points: [] },
  ];

  const plankIntervals = Math.max(1, Math.ceil(length / profile.plankSpacing));
  const plankPitch = length > 0 ? length / plankIntervals : 0;
  if (includePlanks && length > 0) {
    const visualDepth = Math.max(0.08, plankPitch - profile.plankGap);
    for (let index = 0; index < plankIntervals; index++) {
      const distance = (index + 0.5) * plankPitch;
      const frame = sample(distance);
      const scaleNoise =
        1 +
        unityWoodSignedNoise(index, plankSeed, 17) * profile.plankScaleJitter;
      const yawDegrees =
        unityWoodSignedNoise(index, plankSeed, 29) *
        profile.plankYawJitterDegrees;
      const verticalOffset =
        unityWoodSignedNoise(index, plankSeed, 43) * profile.plankVerticalJitter;
      const yaw = (yawDegrees * Math.PI) / 180;
      const right = normalize(
        add(
          multiply(frame.right, Math.cos(yaw)),
          multiply(frame.forward, -Math.sin(yaw)),
        ),
        frame.right,
      );
      const forward = normalize(
        add(
          multiply(frame.right, Math.sin(yaw)),
          multiply(frame.forward, Math.cos(yaw)),
        ),
        frame.forward,
      );
      planks.push({
        kind: "plank",
        index,
        distance,
        center: addScaled(
          frame.center,
          frame.up,
          -(profile.plankThickness * 0.5 - verticalOffset),
        ),
        basis: { right, up: clone(frame.up), forward },
        size: [
          (frame.width + profile.plankSideOverhang * 2) * scaleNoise,
          profile.plankThickness,
          visualDepth * (2 - scaleNoise),
        ],
        yawDegrees,
        verticalOffset,
        scaleNoise,
        variantIndex: chooseUnityWeightedVariant(
          index,
          plankSeed,
          options.plankVariantWeights,
        ),
        tonalBucket: unityTonalBucket(
          unityStructureSignedNoise(index, plankSeed, 71),
          profile.tonalBucketCount,
        ),
      });
    }
  }

  // The rustic palette's three timbers are a hewn (flattened) beam, a round
  // log and a squared timber with a split in it. The carpentry's posts and
  // sleepers are logs (a lashing sits snug on a log), its caps mostly logs,
  // its stringers squared, and its braces whatever comes. A palette of
  // another size is used as it is given.
  const weights = options.poleVariantWeights;
  const shaped = weights?.length === 3 && profile.structure !== "unity";
  // (in the rustic palette's order: the hewn beam, the round log, the squared and split timber)
  const logs = shaped ? [0, weights![1], 0] : weights;
  const mostlyLogs = shaped ? [0, weights![1], weights![2] * 0.35] : weights;
  const squared = shaped ? [weights![0], weights![1] * 0.15, weights![2]] : weights;
  const paletteFor = (role: WoodPathPoleRole): readonly number[] | undefined =>
    role === "support-post" || role === "footing"
      ? logs
      : role === "crossbeam"
        ? mostlyLogs
        : role === "top-ledger" || role === "stringer"
          ? squared
          : weights;
  const pushPole = (
    role: WoodPathPoleRole,
    start: WoodPathVec3,
    end: WoodPathVec3,
    radius: number,
    metadata: Pick<WoodPathPolePiece, "side" | "bentIndex" | "bayIndex" | "roll"> = {},
  ): void => {
    const index = poles.length;
    const delta = subtract(end, start);
    const pieceLength = magnitude(delta);
    if (pieceLength < 1e-5) return;
    poles.push({
      kind: "pole",
      index,
      role,
      start: clone(start),
      end: clone(end),
      center: lerp(start, end, 0.5),
      direction: multiply(delta, 1 / pieceLength),
      length: pieceLength,
      radius,
      ...metadata,
      variantIndex: chooseUnityWeightedVariant(
        index,
        poleSeed,
        paletteFor(role),
      ),
      tonalBucket: unityTonalBucket(
        unityStructureSignedNoise(index, poleSeed, 83),
        profile.tonalBucketCount,
      ),
    });
  };

  if (length > 0 && (includeSupports || includeHandrails)) {
    const carpentry = profile.structure !== "unity";
    const bentIntervals = woodPathBentIntervals(length, profile.bentSpacing);
    const bentSpacing = length / bentIntervals;
    for (let index = 0; index <= bentIntervals; index++) {
      const distance = index * bentSpacing;
      const frame = sample(distance);
      const leftTop = topAt(frame, -1, profile);
      const rightTop = topAt(frame, 1, profile);
      const resolveBottom = (
        side: WoodPathSide,
        top: WoodPathVec3,
      ): WoodPathVec3 => {
        const fallback =
          options.fallbackBaseY === undefined
            ? v(
                top[0],
                top[1] - Math.max(0.5, options.fallbackSupportDepth ?? 3.5),
                top[2],
              )
            : v(top[0], finite(options.fallbackBaseY, top[1] - 3.5), top[2]);
        const probeOrigin = addScaled(
          top,
          frame.up,
          -(
            profile.deckThickness +
            profile.postRadius +
            profile.supportProbeClearance
          ),
        );
        const resolved = options.supportBottom?.({
          bentIndex: index,
          side,
          top: clone(top),
          probeOrigin,
          fallback: clone(fallback),
          deckUp: clone(frame.up),
        });
        const found = !!resolved && resolved.every(Number.isFinite);
        if (side < 0) leftGrounded = found;
        else rightGrounded = found;
        return found ? clone(resolved!) : fallback;
      };
      let leftGrounded = false;
      let rightGrounded = false;
      const leftBase = resolveBottom(-1, leftTop);
      const rightBase = resolveBottom(1, rightTop);
      const bent: WoodPathBent = {
        index,
        distance,
        frame,
        leftTop,
        rightTop,
        leftBase,
        rightBase,
        leftGrounded,
        rightGrounded,
      };
      bents.push(bent);
      // The carpentry is built once every bent is known (below).
      if (carpentry) continue;

      if (includeSupports) {
        pushPole("support-post", leftBase, leftTop, profile.postRadius, {
          side: -1,
          bentIndex: index,
        });
        pushPole("support-post", rightBase, rightTop, profile.postRadius, {
          side: 1,
          bentIndex: index,
        });
        pushPole(
          "crossbeam",
          addScaled(leftTop, frame.right, -profile.crossbeamOverhang),
          addScaled(rightTop, frame.right, profile.crossbeamOverhang),
          profile.crossbeamRadius,
          { bentIndex: index },
        );
      }

      if (includeHandrails) {
        for (const side of [-1, 1] as const) {
          const railBase = balustradeEdge(frame, side);
          pushPole(
            "handrail-post",
            railBase,
            addScaled(railBase, frame.up, profile.handrailHeight),
            profile.ledgerRadius,
            { side, bentIndex: index },
          );
        }
      }

      if (index === 0 || !includeSupports) continue;
      const previous = bents[index - 1];
      pushPole("top-ledger", previous.leftTop, leftTop, profile.ledgerRadius, {
        side: -1,
        bayIndex: index,
      });
      pushPole("top-ledger", previous.rightTop, rightTop, profile.ledgerRadius, {
        side: 1,
        bayIndex: index,
      });
      if (profile.lowerLedgers) {
        pushPole(
          "lower-ledger",
          lerp(previous.leftBase, previous.leftTop, 0.38),
          lerp(leftBase, leftTop, 0.38),
          profile.ledgerRadius,
          { side: -1, bayIndex: index },
        );
        pushPole(
          "lower-ledger",
          lerp(previous.rightBase, previous.rightTop, 0.38),
          lerp(rightBase, rightTop, 0.38),
          profile.ledgerRadius,
          { side: 1, bayIndex: index },
        );
      }
      if (profile.diagonalBraces) {
        const alternate = (index & 1) === 0;
        const sideBrace = (
          side: WoodPathSide,
          start: WoodPathVec3,
          end: WoodPathVec3,
        ): void =>
          pushPole(
            "side-brace",
            lerp(start, end, 0.08),
            lerp(start, end, 0.92),
            profile.braceRadius,
            { side, bayIndex: index },
          );
        sideBrace(
          -1,
          alternate ? previous.leftBase : leftBase,
          alternate ? leftTop : previous.leftTop,
        );
        sideBrace(
          1,
          alternate ? rightBase : previous.rightBase,
          alternate ? previous.rightTop : rightTop,
        );
        pushPole(
          "midheight-cross-brace",
          lerp(previous.leftBase, previous.leftTop, 0.3),
          lerp(rightBase, rightTop, 0.7),
          profile.braceRadius,
          { bayIndex: index },
        );
        pushPole(
          "midheight-cross-brace",
          lerp(previous.rightBase, previous.rightTop, 0.7),
          lerp(leftBase, leftTop, 0.3),
          profile.braceRadius,
          { bayIndex: index },
        );
      }
    }

    if (carpentry)
      buildCarpentry({
        profile,
        bents,
        sample,
        seed: poleSeed,
        pushPole,
        includeSupports,
        includeHandrails,
      });

    if (includeHandrails) {
      const visualIntervals = Math.max(
        1,
        Math.ceil(length / profile.balustradeVisualSpacing),
      );
      for (let index = 1; index <= visualIntervals; index++) {
        const previous = sample((length * (index - 1)) / visualIntervals);
        const current = sample((length * index) / visualIntervals);
        for (const side of [-1, 1] as const)
          pushPole(
            "top-rail",
            balustradeTop(previous, side, profile),
            balustradeTop(current, side, profile),
            profile.ledgerRadius,
            { side, bayIndex: index },
          );
      }

      const collisionIntervals = Math.max(
        1,
        Math.ceil(length / profile.balustradeCollisionSpacing),
      );
      for (let index = 1; index <= collisionIntervals; index++) {
        const previous = sample((length * (index - 1)) / collisionIntervals);
        const current = sample((length * index) / collisionIntervals);
        for (const side of [-1, 1] as const) {
          const startEdge = balustradeEdge(previous, side);
          const endEdge = balustradeEdge(current, side);
          const startCenter = addScaled(
            startEdge,
            previous.up,
            profile.balustradeCollisionHeight * 0.5,
          );
          const endCenter = addScaled(
            endEdge,
            current.up,
            profile.balustradeCollisionHeight * 0.5,
          );
          const delta = subtract(endCenter, startCenter);
          const barrierLength = magnitude(delta);
          if (barrierLength < 1e-5) continue;
          const forward = multiply(delta, 1 / barrierLength);
          const up = projectedUp(add(previous.up, current.up), forward);
          const right = normalize(cross(up, forward), previous.right);
          balustradeBarriers.push({
            side,
            index,
            startEdge,
            endEdge,
            center: lerp(startCenter, endCenter, 0.5),
            basis: { right, up, forward },
            size: [
              profile.balustradeCollisionThickness,
              profile.balustradeCollisionHeight,
              barrierLength + profile.balustradeCollisionOverlap,
            ],
          });
        }
      }

      const railIntervals = Math.max(
        1,
        Math.ceil(length / profile.pathSampleSpacing),
      );
      for (let index = 0; index <= railIntervals; index++) {
        const frame = sample((length * index) / railIntervals);
        rails[0].points.push(balustradeTop(frame, -1, profile));
        rails[1].points.push(balustradeTop(frame, 1, profile));
      }
    }

    return {
      profile,
      length,
      plankPitch,
      bentSpacing,
      planks,
      poles,
      bents,
      balustradeBarriers,
      rails,
    };
  }

  return {
    profile,
    length,
    plankPitch,
    bentSpacing: 0,
    planks,
    poles,
    bents,
    balustradeBarriers,
    rails,
  };
};
