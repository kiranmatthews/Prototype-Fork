/**
 * Semantic body-slam pose authored in the Unity port for its procedural/source
 * rig. The production PunkyFox skin plays model-specific Meshy clips, so these
 * joint-space values are the portable source of truth for the browser rig.
 */
export const UNITY_SLAM_POSE_SOURCE = Object.freeze({
  project: 'Board Platformer Unity',
  sourceFile: 'Assets/Game/Runtime/Debug/SourceFoxRigPresentation.cs',
  sourceLines: '333-342',
  sourceSha256: '921c52477bfa9d37dc6b32058ed38ae3a8ea364ccd29eda67d8b3588388336ab',
  productionFallClip: 'PunkyFox_Fall1',
  productionFallSha256: 'fd059480c8d83aa4ab9f44518eb5d1ed3f40adf6896d7f30b703a5762c8a682d',
  productionRecoveryClip: 'PunkyFox_Backflip_and_Rise',
  productionRecoverySha256: 'a960a98fd453cbf61de230eacfbfb7fc1058b0f17fcf2acf432425b615bc29bf',
  retargetPolicy: 'semantic procedural-rig pose; gameplay retains root motion and timing',
});

export interface UnitySlamLimbPoseDegrees {
  readonly shoulderLeft: readonly [pitch: number, yaw: number, roll: number];
  readonly shoulderRight: readonly [pitch: number, yaw: number, roll: number];
  readonly hipLeft: number;
  readonly hipRight: number;
  readonly kneeLeft: number;
  readonly kneeRight: number;
}

// Unity's right-named fallback pivot owns the source model's +X/left limb.
// Three.js also declares +X as anatomical left, while its Z-roll sign is the
// inverse of Unity's. These are already converted to browser semantic sides.
export const UNITY_SLAM_ANTICIPATION_POSE_DEGREES: Readonly<UnitySlamLimbPoseDegrees> =
  Object.freeze({
    shoulderLeft: [145, 0, 50] as const,
    shoulderRight: [145, 0, -50] as const,
    hipLeft: -82,
    hipRight: -82,
    kneeLeft: 112,
    kneeRight: 112,
  });

export const UNITY_SLAM_FALL_POSE_DEGREES: Readonly<UnitySlamLimbPoseDegrees> =
  Object.freeze({
    shoulderLeft: [-38, 0, 50] as const,
    shoulderRight: [-38, 0, -50] as const,
    hipLeft: 18,
    hipRight: 18,
    kneeLeft: 6,
    kneeRight: 6,
  });

/**
 * The live clip is scrubbed by Player.animationIntent.actionProgress: Unity's
 * 0.32-second anticipation occupies 0..0.33, forced descent begins at 0.66, and
 * impact/recovery owns the final third. Manual Studio playback uses 1 second.
 */
export const UNITY_SLAM_POSE_TIMING = Object.freeze({
  anticipationHoldEnd: 0.33,
  fallPoseReached: 0.66,
  duration: 1,
  unityAnticipationSeconds: 0.32,
  unityPoseTransitionSeconds: 5 / 60,
});
