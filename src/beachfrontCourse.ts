/**
 * Three-free source authority for Unity Beachfront Run's course frame and
 * sand/depth surface. Runtime presentation and source-owned level data both
 * consume this module so boardwalk approaches cannot drift from the beach.
 */

export type BeachfrontWorldPoint = [x: number, y: number, z: number];

export interface BeachfrontCourseFrame {
  distance: number;
  x: number;
  z: number;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

export const BEACHFRONT_COURSE_MINIMUM_Z = -20;
export const BEACHFRONT_COURSE_LENGTH = 740;
export const BEACHFRONT_COURSE_SAMPLE_COUNT = 149;
export const BEACHFRONT_SAND_LONGITUDINAL_SAMPLE_COUNT = 371;
export const BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS = 16;
export const BEACHFRONT_SAND_BANK_LATERAL_SEGMENTS = 48;
export const BEACHFRONT_SAND_WATERLINE_COLUMN =
  BEACHFRONT_SAND_SUBMERGED_LATERAL_SEGMENTS;
export const BEACHFRONT_SAND_SUBMERGED_SHELF_WIDTH = 16;
export const BEACHFRONT_SAND_MAXIMUM_LATERAL = 8;
export const BEACHFRONT_LANDWARD_SAND_MINIMUM_LATERAL = 12.8;
export const BEACHFRONT_LANDWARD_SAND_MAXIMUM_LATERAL = 16.8;
export const BEACHFRONT_SEA_LEVEL = -0.36;
export const BEACHFRONT_SAND_WET_TRANSITION_WIDTH = 3.5;
export const BEACHFRONT_SAND_OFFSHORE_DEPTH = 1.28;
export const BEACHFRONT_FINE_SHORE_SEAWARD_FADE = 5;
export const BEACHFRONT_FINE_SHORE_LANDWARD_FADE = 4;
export const BEACHFRONT_SAND_TEXTURE_TILE_SIZE = 5.4;

const DRY_SAND_RELIEF_AMPLITUDE = 0.04;
const SUBMERGED_SAND_RELIEF_AMPLITUDE = 0.035;

export const clampBeachfront = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.max(minimum, Math.min(maximum, value));

const clamp01 = (value: number): number => clampBeachfront(value, 0, 1);

export const lerpBeachfront = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** Unity +Z is reflected into the prototype's conventional -Z corridor. */
export function beachfrontFrameAtDistance(
  rawDistance: number,
): BeachfrontCourseFrame {
  const distance = clampBeachfront(
    rawDistance,
    0,
    BEACHFRONT_COURSE_LENGTH,
  );
  const phase = (Math.PI * 2 * distance) / BEACHFRONT_COURSE_LENGTH;
  const x = 15 * Math.sin(phase) + 6 * Math.sin(phase * 2);
  const derivative =
    (15 * Math.PI * 2 * Math.cos(phase) +
      12 * Math.PI * 2 * Math.cos(phase * 2)) /
    BEACHFRONT_COURSE_LENGTH;
  const magnitude = Math.hypot(derivative, 1);
  const fx = derivative / magnitude;
  const fz = -1 / magnitude;
  return {
    distance,
    x,
    z: -(BEACHFRONT_COURSE_MINIMUM_Z + distance),
    fx,
    fz,
    // Exact converted Unity Vector3.Cross(up, forward) after Z reflection.
    rx: -fz,
    rz: fx,
  };
}

export function beachfrontSmoothLongitudinalHeight(distance: number): number {
  return (
    0.075 *
      Math.sin(distance * 0.019 + 0.55 * Math.sin(distance * 0.0043)) +
    0.05 * Math.sin(distance * 0.051 + 1.1)
  );
}

const localizedCove = (
  distance: number,
  center: number,
  radius: number,
): number => {
  const normalized = (distance - center) / Math.max(0.01, radius);
  return Math.exp(-normalized * normalized);
};

export function beachfrontSandWidth(distance: number): number {
  const width =
    20.5 +
    Math.sin(distance * 0.018 + 0.4) +
    0.7 * Math.sin(distance * 0.043 - 1.1) +
    3.36 * localizedCove(distance, 80, 40) -
    3.36 * localizedCove(distance, 180, 35) +
    3.6 * localizedCove(distance, 290, 45) -
    3.36 * localizedCove(distance, 405, 38) +
    3.6 * localizedCove(distance, 525, 44) -
    3.36 * localizedCove(distance, 635, 38) +
    2.64 * localizedCove(distance, 710, 28);
  return clampBeachfront(width, 16, 25);
}

export const beachfrontShorelineLateral = (distance: number): number =>
  BEACHFRONT_SAND_MAXIMUM_LATERAL - beachfrontSandWidth(distance);

export function beachfrontFineShorelineOffset(distance: number): number {
  return (
    0.28 *
      Math.sin(distance * 0.21 + 0.42 * Math.sin(distance * 0.047)) +
    0.13 * Math.sin(distance * 0.43 + 1.35) +
    0.055 * Math.sin(distance * 0.71 - 0.6)
  );
}

export function beachfrontFineShorelineInfluence(
  shoreOffset: number,
): number {
  const influence =
    shoreOffset <= 0
      ? clamp01(1 + shoreOffset / BEACHFRONT_FINE_SHORE_SEAWARD_FADE)
      : clamp01(1 - shoreOffset / BEACHFRONT_FINE_SHORE_LANDWARD_FADE);
  return influence * influence * (3 - 2 * influence);
}

export function beachfrontLandwardSandEdgeLateral(distance: number): number {
  const broad =
    14.2 +
    1.05 * Math.sin(distance * 0.016 + 0.65) +
    0.62 * Math.sin(distance * 0.039 - 1.2) +
    0.48 * Math.sin(distance * 0.071 + 2.1) +
    0.9 * localizedCove(distance, 102, 54) -
    0.85 * localizedCove(distance, 236, 46) +
    1.05 * localizedCove(distance, 372, 58) -
    0.75 * localizedCove(distance, 516, 48) +
    0.8 * localizedCove(distance, 684, 42);
  const fine =
    0.32 *
      Math.sin(distance * 0.19 + 0.38 * Math.sin(distance * 0.043)) +
    0.16 * Math.sin(distance * 0.41 - 0.9) +
    0.07 * Math.sin(distance * 0.67 + 1.7);
  return clampBeachfront(
    broad + fine,
    BEACHFRONT_LANDWARD_SAND_MINIMUM_LATERAL,
    BEACHFRONT_LANDWARD_SAND_MAXIMUM_LATERAL,
  );
}

const cliffToeBurialHeight = (distance: number, lateral: number): number => {
  let toe = clamp01((lateral - 5.8) / 2.6);
  toe = toe * toe * (3 - 2 * toe);
  return toe * (0.52 + 0.08 * Math.sin(distance * 0.061 + 0.7));
};

export function beachfrontSubmergedSandRelief(
  distance: number,
  shelf: number,
): number {
  const depthFromShore = clamp01(1 - shelf);
  const envelope = 4 * shelf * depthFromShore * Math.sqrt(depthFromShore);
  const relief =
    0.68 *
      Math.sin(
        distance * 0.243 +
          shelf * 8.7 +
          0.55 * Math.sin(distance * 0.031),
      ) +
    0.32 * Math.sin(distance * 0.517 - shelf * 13.1 + 1.2);
  return SUBMERGED_SAND_RELIEF_AMPLITUDE * envelope * relief;
}

export function beachfrontDrySandRelief(
  distance: number,
  bank: number,
): number {
  let envelope = Math.sin(Math.PI * clamp01(bank));
  envelope *= envelope;
  const relief =
    0.55 *
      Math.sin(
        distance * 0.287 +
          bank * 9.4 +
          0.62 * Math.sin(distance * 0.037),
      ) +
    0.29 * Math.sin(distance * 0.631 - bank * 16.7 + 1.45) +
    0.16 * Math.sin(distance * 1.071 + bank * 27.3 - 0.8);
  return DRY_SAND_RELIEF_AMPLITUDE * envelope * relief;
}

/** Exact Unity Beachfront sand/depth surface in reflected web coordinates. */
export function beachfrontSandHeight(
  rawDistance: number,
  lateral: number,
): number {
  const distance = clampBeachfront(
    rawDistance,
    0,
    BEACHFRONT_COURSE_LENGTH,
  );
  const shoreline = beachfrontShorelineLateral(distance);
  const shoreOffset = lateral - shoreline;
  if (shoreOffset <= 0) {
    const shelf = clamp01(
      1 + shoreOffset / BEACHFRONT_SAND_SUBMERGED_SHELF_WIDTH,
    );
    return (
      BEACHFRONT_SEA_LEVEL -
      BEACHFRONT_SAND_OFFSHORE_DEPTH * Math.pow(1 - shelf, 1.8) +
      beachfrontSubmergedSandRelief(distance, shelf)
    );
  }

  const playableBankOffset = BEACHFRONT_SAND_MAXIMUM_LATERAL - shoreline;
  const bank = clamp01(shoreOffset / Math.max(0.01, playableBankOffset));
  const shoreSlope = 2.1;
  const bankProfile =
    shoreSlope * bank +
    (3 - 2 * shoreSlope) * bank * bank +
    (shoreSlope - 2) * bank * bank * bank;
  const longitudinalBlend = bank * bank * (3 - 2 * bank);
  const lowShoreNoise =
    0.012 *
    Math.sin(distance * 0.109 + 0.55 * Math.sin(distance * 0.017)) *
    16 *
    bank *
    bank *
    (1 - bank) *
    (1 - bank);
  const playableHeight =
    BEACHFRONT_SEA_LEVEL +
    0.84 * bankProfile +
    beachfrontSmoothLongitudinalHeight(distance) * longitudinalBlend +
    lowShoreNoise +
    beachfrontDrySandRelief(distance, bank);
  const cliffToeBurial = cliffToeBurialHeight(distance, lateral);
  if (lateral <= BEACHFRONT_SAND_MAXIMUM_LATERAL)
    return playableHeight + cliffToeBurial;

  const extension = lateral - BEACHFRONT_SAND_MAXIMUM_LATERAL;
  const landwardSpan = Math.max(
    0.01,
    beachfrontLandwardSandEdgeLateral(distance) -
      BEACHFRONT_SAND_MAXIMUM_LATERAL,
  );
  const extension01 = clamp01(extension / landwardSpan);
  const smoothExtension = extension01 * extension01 * (3 - 2 * extension01);
  const rollingRise =
    0.115 * extension +
    0.16 * smoothExtension +
    0.075 *
      Math.sin(
        distance * 0.083 +
          extension * 0.72 +
          0.5 * Math.sin(distance * 0.019),
      ) *
      smoothExtension;
  return playableHeight + rollingRise + cliffToeBurial;
}

export function beachfrontPointAtDistance(
  distance: number,
  lateral = 0,
  y = beachfrontSandHeight(distance, lateral),
): BeachfrontWorldPoint {
  const frame = beachfrontFrameAtDistance(distance);
  return [
    frame.x + frame.rx * lateral,
    y,
    frame.z + frame.rz * lateral,
  ];
}

export const beachfrontYawAtDistance = (distance: number): number => {
  const frame = beachfrontFrameAtDistance(distance);
  return (Math.atan2(-frame.fx, -frame.fz) * 180) / Math.PI;
};

/**
 * Unity's Beachfront island placement probe: a regular course-local lattice
 * over one authored span. Both station counts include their two endpoints.
 */
export function beachfrontFootprintMaximumHeight(
  startDistance: number,
  endDistance: number,
  centerLateral: number,
  width: number,
  longitudinalStations = 13,
  lateralStations = 13,
): number {
  const longitudinalCount = Math.max(2, Math.round(longitudinalStations));
  const lateralCount = Math.max(2, Math.round(lateralStations));
  let maximum = -Infinity;
  for (let longitudinal = 0; longitudinal < longitudinalCount; longitudinal++) {
    const distance = lerpBeachfront(
      startDistance,
      endDistance,
      longitudinal / (longitudinalCount - 1),
    );
    for (let across = 0; across < lateralCount; across++) {
      const lateral = lerpBeachfront(
        centerLateral - width * 0.5,
        centerLateral + width * 0.5,
        across / (lateralCount - 1),
      );
      maximum = Math.max(maximum, beachfrontSandHeight(distance, lateral));
    }
  }
  return maximum;
}
