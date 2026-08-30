/**
 * Pure layout kernel for source-faithful procedural wood paths.
 *
 * This module deliberately owns no Three.js geometry or collision objects.
 * It emits fitted-piece envelopes and semantic member roles, allowing the
 * runtime to batch placeholder boxes/cylinders today and substitute weighted
 * textured mesh variants later without changing gameplay collision or level
 * data.
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
}

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
  | "top-rail";

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
}

export interface WoodPathBent {
  index: number;
  distance: number;
  frame: WoodPathFrame;
  leftTop: WoodPathVec3;
  rightTop: WoodPathVec3;
  leftBase: WoodPathVec3;
  rightBase: WoodPathVec3;
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

  const pushPole = (
    role: WoodPathPoleRole,
    start: WoodPathVec3,
    end: WoodPathVec3,
    radius: number,
    metadata: Pick<WoodPathPolePiece, "side" | "bentIndex" | "bayIndex"> = {},
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
        options.poleVariantWeights,
      ),
      tonalBucket: unityTonalBucket(
        unityStructureSignedNoise(index, poleSeed, 83),
        profile.tonalBucketCount,
      ),
    });
  };

  if (length > 0 && (includeSupports || includeHandrails)) {
    const bentIntervals = Math.max(1, Math.ceil(length / profile.bentSpacing));
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
        return resolved && resolved.every(Number.isFinite)
          ? clone(resolved)
          : fallback;
      };
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
      };
      bents.push(bent);

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
