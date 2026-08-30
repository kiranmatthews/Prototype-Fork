export const PROCEDURAL_THIGH_LENGTH = 0.25;
export const PROCEDURAL_SHIN_LENGTH = 0.24;

export interface SagittalLegPose {
  hipPitch: number;
  kneeFlex: number;
  anklePitch: number;
  verticalReach: number;
  forwardReach: number;
}

/**
 * Solve a conventional two-bone leg in the rider's local Y/Z plane.
 *
 * The requested knee flex is preserved while the hip counter-rotates just
 * enough to keep the ankle under the hip. `footPitch` is the desired absolute
 * foot angle, so a planted sole uses zero and receives the matching ankle
 * counter-rotation. Segment lengths never change.
 */
export function solveSagittalLeg(
  kneeFlex: number,
  footPitch = 0,
  thighLength = PROCEDURAL_THIGH_LENGTH,
  shinLength = PROCEDURAL_SHIN_LENGTH,
): SagittalLegPose {
  const upper = Math.max(1e-4, Math.abs(thighLength));
  const lower = Math.max(1e-4, Math.abs(shinLength));
  const flex = Math.min(Math.PI - 0.08, Math.max(0, kneeFlex));
  const hipPitch = -Math.atan2(
    lower * Math.sin(flex),
    upper + lower * Math.cos(flex),
  );
  const lowerPitch = hipPitch + flex;
  return {
    hipPitch,
    kneeFlex: flex,
    anklePitch: footPitch - lowerPitch,
    verticalReach:
      upper * Math.cos(hipPitch) + lower * Math.cos(lowerPitch),
    forwardReach:
      -upper * Math.sin(hipPitch) - lower * Math.sin(lowerPitch),
  };
}

/**
 * Solve the same fixed-length chain to an ankle target expressed as distance
 * down from the hip and distance forward in rider-local +Z. Targets outside
 * the reachable annulus clamp deterministically without producing NaNs.
 */
export function solveSagittalLegTarget(
  down: number,
  forward: number,
  footPitch = 0,
  thighLength = PROCEDURAL_THIGH_LENGTH,
  shinLength = PROCEDURAL_SHIN_LENGTH,
  out?: SagittalLegPose,
): SagittalLegPose {
  const upper = Math.max(1e-4, Math.abs(thighLength));
  const lower = Math.max(1e-4, Math.abs(shinLength));
  const distance = Math.hypot(down, forward);
  const minimum = Math.abs(upper - lower) + 1e-5;
  const maximum = upper + lower - 1e-5;
  const reach = Math.min(maximum, Math.max(minimum, distance));
  const direction = distance > 1e-8 ? Math.atan2(-forward, down) : 0;
  const cosine = Math.min(
    1,
    Math.max(
      -1,
      (reach * reach - upper * upper - lower * lower) /
        (2 * upper * lower),
    ),
  );
  const kneeFlex = Math.acos(cosine);
  const hipPitch =
    direction -
    Math.atan2(
      lower * Math.sin(kneeFlex),
      upper + lower * Math.cos(kneeFlex),
    );
  const lowerPitch = hipPitch + kneeFlex;
  const result = out ?? {
    hipPitch: 0,
    kneeFlex: 0,
    anklePitch: 0,
    verticalReach: 0,
    forwardReach: 0,
  };
  result.hipPitch = hipPitch;
  result.kneeFlex = kneeFlex;
  result.anklePitch = footPitch - lowerPitch;
  result.verticalReach =
    upper * Math.cos(hipPitch) + lower * Math.cos(lowerPitch);
  result.forwardReach =
    -upper * Math.sin(hipPitch) - lower * Math.sin(lowerPitch);
  return result;
}
