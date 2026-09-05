import * as THREE from 'three';

export interface CameraRigTuning {
  camDist: number;
  camHeight: number;
  /** Degrees below the horizon; negative values look up. */
  camPitch: number;
}

const degrees = (rise: number, run: number): number =>
  Math.atan2(rise, run) * 180 / Math.PI;

// v17's shipped shot, before position and orientation became independent.
// Used only to preserve the authored side/reverse/boulder/split shot offsets
// and to translate old saves. Live tuning never feeds a look-at triangle.
const LEGACY = { distance: 3.8, height: 5.1, aimHeight: 3.3, offset: -1.25 };
const BASE_PITCH = degrees(LEGACY.height - LEGACY.aimHeight, LEGACY.distance);
const BASE_DISTANCE = LEGACY.distance - LEGACY.offset;

export function cameraRigFraming(
  tuning: CameraRigTuning,
  side = 0,
  back = 0,
  boulder = 0,
  split = false,
): { distance: number; height: number; pitch: number } {
  let distance: number;
  let height: number;
  let pitch: number;
  if (split) {
    distance = LEGACY.distance;
    height = LEGACY.height * 0.85;
    pitch = degrees(height - 1.2, distance + 3);
  } else {
    const off = LEGACY.offset * (1 - boulder);
    distance = LEGACY.distance * (1 + 0.77 * side) + back * 3.8 + boulder * 18.8 - off;
    height = LEGACY.height * (1 - 0.1 * side) + back * 1.1 + boulder * 1.7;
    const aimBack = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(-off, 3.5, back), 12, boulder,
    );
    const aimHeight = THREE.MathUtils.lerp(LEGACY.aimHeight - 0.2 * side, 1.6, boulder);
    pitch = degrees(height - aimHeight, distance - aimBack);
  }
  return {
    distance: tuning.camDist + distance - BASE_DISTANCE,
    height: tuning.camHeight + height - LEGACY.height,
    pitch: tuning.camPitch + pitch - BASE_PITCH,
  };
}

/** Build the aim from the CURRENT eye and explicit orientation. Smoothing
 * camera translation must not briefly reintroduce height/distance -> pitch
 * coupling, as smoothing an independent world-space aim point would. */
export function setCameraRigAim(
  target: THREE.Vector3,
  eye: THREE.Vector3,
  forward: { x: number; z: number },
  pitchDegrees: number,
): THREE.Vector3 {
  const pitch = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(pitchDegrees, -85, 85));
  const length = Math.hypot(forward.x, forward.z);
  const horizontal = Math.cos(pitch);
  return target.set(
    eye.x + (length > 1e-6 ? forward.x / length : 0) * horizontal,
    eye.y - Math.sin(pitch),
    eye.z + (length > 1e-6 ? forward.z / length : -1) * horizontal,
  );
}

/** Convert a complete old camera snapshot, including mid-replay edits. */
export function legacyCameraRigTuning(values: Readonly<Record<string, number>>): CameraRigTuning | null {
  if (Number.isFinite(values.camPitch) ||
      !Number.isFinite(values.camDist) || !Number.isFinite(values.camHeight) ||
      !Number.isFinite(values.camTilt)) return null;
  return {
    camDist: values.camDist - (Number.isFinite(values.camOffset) ? values.camOffset : 0),
    camHeight: values.camHeight,
    camPitch: degrees(values.camHeight - values.camTilt, values.camDist),
  };
}

/** Untouched snapshots follow current defaults. If ANY old camera position
 * or aim control was deliberately edited, preserve the complete old shot. */
export function migrateLegacySavedCameraRig(
  values: Readonly<Record<string, number>>,
  defaults: Readonly<Record<string, number>>,
): CameraRigTuning | null {
  const edited = ['camDist', 'camHeight', 'camTilt', 'camOffset'].some(
    key => Number.isFinite(values[key]) && values[key] !== defaults[key],
  );
  return edited ? legacyCameraRigTuning(values) : null;
}
