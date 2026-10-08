import * as THREE from 'three';

interface FallCameraSubject {
  renderPosition: { y: number };
  renderSnapVersion: number;
  groundBelowY: number | null;
  groundBelowIsFatal?: boolean;
  grounded: boolean;
  state: string;
}

/** Keep the complete last shot once a missed landing falls below the course.
 * Runs before any camera layer restores or reframes, so chase/loop/authored
 * shots cannot pull the eye or aim underground. Reuse the player's existing
 * support probe; this is presentation only and adds no collision queries. */
export class CameraFallHold {
  private snapVersion = -1;
  private edgeY = 0;

  shouldHold(subject: FallCameraSubject, killY: number): boolean {
    if (subject.state === 'dead' || subject.state === 'gameover') return true;
    const y = subject.renderPosition.y;
    const floor = subject.groundBelowY;
    // A floor below the death plane cannot catch this fall.
    const landing = floor !== null && Number.isFinite(floor) && floor > killY && !subject.groundBelowIsFatal;
    if (subject.renderSnapVersion !== this.snapVersion) {
      this.snapVersion = subject.renderSnapVersion;
      this.edgeY = landing ? Math.min(y, floor) : y;
      return false;
    }
    if ((subject.grounded && !subject.groundBelowIsFatal) || ['grind', 'rope', 'hang', 'swim', 'finished'].includes(subject.state)) {
      this.edgeY = y;
      return false;
    }
    if (landing) {
      this.edgeY = Math.min(y, floor);
      return false;
    }
    // A rescue jump below the lip must not pull the camera underground either;
    // resume once the rider regains the course height or a real landing.
    // The sole-height tolerance ignores interpolation/contact noise at a lip.
    return y < this.edgeY - .2;
  }
}

export interface CameraRigTuning {
  camDist: number;
  camHeight: number;
  /** Degrees below the horizon; negative values look up. */
  camPitch: number;
}

const degrees = (rise: number, run: number): number =>
  Math.atan2(rise, run) * 180 / Math.PI;

// v17's shipped shot, before position and orientation became independent.
// Used only to preserve the authored reverse/boulder/split shot offsets
// and to translate old saves. Live tuning never feeds a look-at triangle.
const LEGACY = { distance: 3.8, height: 5.1, aimHeight: 3.3, offset: -1.25 };
const BASE_PITCH = degrees(LEGACY.height - LEGACY.aimHeight, LEGACY.distance);
const BASE_DISTANCE = LEGACY.distance - LEGACY.offset;

/** Side-scrolls share the live gameplay framing, including when a level
 * carries an older wide preset. The blend also covers entry/exit transitions. */
export function cameraRigFraming(
  tuning: CameraRigTuning,
  side = 0,
  back = 0,
  boulder = 0,
  split = false,
  gameplay: CameraRigTuning = tuning,
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
    // Turning into a side-scroll changes tracking, never the player scale.
    distance = LEGACY.distance + back * 3.8 + boulder * 18.8 - off;
    height = LEGACY.height + back * 1.1 + boulder * 1.7;
    const aimBack = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(-off, 3.5, back), 12, boulder,
    );
    const aimHeight = THREE.MathUtils.lerp(LEGACY.aimHeight, 1.6, boulder);
    pitch = degrees(height - aimHeight, distance - aimBack);
  }
  return {
    distance: THREE.MathUtils.lerp(tuning.camDist, gameplay.camDist, side) + distance - BASE_DISTANCE,
    height: THREE.MathUtils.lerp(tuning.camHeight, gameplay.camHeight, side) + height - LEGACY.height,
    pitch: THREE.MathUtils.lerp(tuning.camPitch, gameplay.camPitch, side) + pitch - BASE_PITCH,
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

/** Anticipate the authored road, independently of the rider's lateral carve.
 * The returned heading is presentation only; controls retain the local lane. */
export class CourseCameraHeading {
  private yaw = 0;
  private active = false;
  readonly forward = new THREE.Vector3(0, 0, -1);

  step(origin: THREE.Vector3 | null, ahead: THREE.Vector3 | null,
    local: { x: number; z: number }, dt: number, snap: boolean): THREE.Vector3 {
    if (!origin || !ahead) {
      this.active = false;
      return this.forward.set(local.x, 0, local.z);
    }
    const dx = ahead.x - origin.x, dz = ahead.z - origin.z;
    const target = Math.hypot(dx, dz) > .001 ? Math.atan2(dx, dz) : Math.atan2(local.x, local.z);
    if (snap) this.yaw = target;
    else {
      if (!this.active) this.yaw = Math.atan2(local.x, local.z);
      const turn = Math.atan2(Math.sin(target - this.yaw), Math.cos(target - this.yaw));
      this.yaw += turn * (1 - Math.exp(-6 * Math.max(0, dt)));
    }
    this.active = true;
    return this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }
}

/** Preserve lateral camera easing until the rendered rider would clip.
 * Only pan by the minimum necessary amount; never orbit, zoom or pitch. */
export function fitCameraRigHorizontal(eye: THREE.Vector3, forward: { x: number; z: number },
  pitchDegrees: number, fov: number, aspect: number, subject: THREE.Vector3,
  bounds?: THREE.Box3 | null): number {
  if (bounds?.isEmpty()) bounds = null;
  const length = Math.hypot(forward.x, forward.z) || 1;
  const fx = forward.x / length, fz = forward.z / length, rx = -fz, rz = fx;
  const pitch = THREE.MathUtils.degToRad(pitchDegrees), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const lens = Math.tan(THREE.MathUtils.degToRad(fov) / 2) * aspect * .94;
  const minX = bounds?.min.x ?? subject.x - .7, maxX = bounds?.max.x ?? subject.x + .7;
  const minY = bounds?.min.y ?? subject.y, maxY = bounds?.max.y ?? subject.y + 2.8;
  const minZ = bounds?.min.z ?? subject.z - .7, maxZ = bounds?.max.z ?? subject.z + .7;
  let low = -Infinity, high = Infinity;
  for (const x of [minX, maxX]) for (const y of [minY, maxY]) for (const z of [minZ, maxZ]) {
    const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z;
    const depth = (dx * fx + dz * fz) * cp - dy * sp;
    if (depth <= .1) continue;
    const side = dx * rx + dz * rz, halfWidth = depth * lens;
    low = Math.max(low, side - halfWidth); high = Math.min(high, side + halfWidth);
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return 0;
  const pan = low <= high ? THREE.MathUtils.clamp(0, low, high) : (low + high) / 2;
  eye.x += rx * pan; eye.z += rz * pan;
  return pan;
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
