import * as THREE from 'three';

// A peek, not a free camera. These caps keep authored course framing readable
// while still letting the player inspect a landing or glance toward a branch.
export const CAMERA_LOOK_LIMITS = Object.freeze({
  deadzone: 0.2,
  yaw: THREE.MathUtils.degToRad(10),
  pitchUp: THREE.MathUtils.degToRad(7),
  pitchDown: THREE.MathUtils.degToRad(3.5),
  attack: 3.4,
  release: 2.35,
});

export interface LookAxes {
  readonly x: number;
  readonly y: number;
}

export interface CameraLookAngles {
  readonly yaw: number;
  readonly pitch: number;
}

const finiteAxis = (value: number): number =>
  Number.isFinite(value) ? THREE.MathUtils.clamp(value, -1, 1) : 0;

/** Standard radial deadzone with a smooth take-up beyond the gate. */
export function shapeLookStick(
  rawX: number,
  rawY: number,
  deadzone = CAMERA_LOOK_LIMITS.deadzone,
): LookAxes {
  const x = finiteAxis(rawX);
  const y = finiteAxis(rawY);
  const rawMagnitude = Math.hypot(x, y);
  const magnitude = Math.min(1, rawMagnitude);
  const gate = THREE.MathUtils.clamp(
    Number.isFinite(deadzone) ? deadzone : CAMERA_LOOK_LIMITS.deadzone,
    0,
    0.95,
  );
  if (magnitude <= gate || rawMagnitude < 1e-8) return { x: 0, y: 0 };
  const linear = THREE.MathUtils.clamp((magnitude - gate) / (1 - gate), 0, 1);
  const eased = linear * linear * (3 - 2 * linear);
  return { x: (x / rawMagnitude) * eased, y: (y / rawMagnitude) * eased };
}

const softenAxis = (value: number): number => {
  const axis = finiteAxis(value);
  return Math.sign(axis) * Math.pow(Math.abs(axis), 1.35);
};

/** Stateful, frame-rate-independent visual offset. It never owns camera
 * position or the canonical direction consumed by gameplay/replays. */
export class CameraLookOffset {
  yaw = 0;
  pitch = 0;

  private readonly direction = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly worldUp = new THREE.Vector3(0, 1, 0);

  reset(): void {
    this.yaw = 0;
    this.pitch = 0;
  }

  step(inputX: number, inputY: number, deltaSeconds: number): CameraLookAngles {
    const x = softenAxis(inputX);
    const y = softenAxis(inputY);
    const yawGoal = x * CAMERA_LOOK_LIMITS.yaw;
    const pitchGoal = y >= 0
      ? y * CAMERA_LOOK_LIMITS.pitchUp
      : y * CAMERA_LOOK_LIMITS.pitchDown;
    const active = Math.abs(x) + Math.abs(y) > 1e-5;
    const response = active ? CAMERA_LOOK_LIMITS.attack : CAMERA_LOOK_LIMITS.release;
    const dt = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
    const alpha = 1 - Math.exp(-response * dt);
    this.yaw += (yawGoal - this.yaw) * alpha;
    this.pitch += (pitchGoal - this.pitch) * alpha;
    if (!active && Math.abs(this.yaw) < 1e-6) this.yaw = 0;
    if (!active && Math.abs(this.pitch) < 1e-6) this.pitch = 0;
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /** Rotate only the view direction around an already-authored aim. Positive
   * X looks screen-right; positive Y looks up. Camera position is untouched. */
  apply(camera: THREE.Camera, authoredAim: THREE.Vector3): void {
    if (Math.abs(this.yaw) + Math.abs(this.pitch) < 1e-9) return;
    this.direction.subVectors(authoredAim, camera.position);
    const distance = this.direction.length();
    if (distance < 1e-6) return;
    this.direction.multiplyScalar(1 / distance);
    // Three's positive world-Y rotation turns -Z toward -X, hence the minus.
    this.direction.applyAxisAngle(this.worldUp, -this.yaw);
    this.right.crossVectors(this.direction, this.worldUp);
    if (this.right.lengthSq() < 1e-8) this.right.set(1, 0, 0);
    else this.right.normalize();
    this.direction.applyAxisAngle(this.right, this.pitch);
    this.target.copy(camera.position).addScaledVector(this.direction, distance);
    camera.lookAt(this.target);
  }
}
