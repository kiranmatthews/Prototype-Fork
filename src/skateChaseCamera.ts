import * as THREE from 'three';

export interface SkateCameraSubject {
  position: Readonly<THREE.Vector3>;
  heading: Readonly<THREE.Vector3>;
  up: Readonly<THREE.Vector3>;
  vertAir: boolean;
  vertNormal: Readonly<THREE.Vector3>;
  verticalSpeed: number;
  speed: number;
  grounded: boolean;
  bailing: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** One angular spring, including exact 180s. Vector lerps collapse at 180. */
export function chaseHeadingStep(yaw: number, target: number, dt: number): number {
  const seconds = Math.max(0, dt);
  const eased = wrap(target - yaw) * (1 - Math.exp(-9 * seconds));
  const maximum = THREE.MathUtils.degToRad(300) * seconds;
  return yaw + THREE.MathUtils.clamp(eased, -maximum, maximum);
}

/** A rider-following skate shot. It follows jump height, holds the launch
 * heading through tricks, then opens the return line as a vert air falls.
 * Its output is presentation only: input never feeds back through this rig. */
export class SkateChaseCamera {
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly aim = new THREE.Vector3();
  readonly desiredEye = new THREE.Vector3();
  private readonly pivot = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private readonly direction = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly safeEye = new THREE.Vector3();
  private yaw = Math.PI;
  private returnYaw: number | null = null;
  private wasVert = false;

  update(camera: THREE.PerspectiveCamera, rider: SkateCameraSubject, dt: number,
    snap: boolean, surfaces: THREE.Object3D[], tuning: { camDist: number; camHeight: number; camPitch: number }): void {
    const step = Math.max(0, Math.min(dt, 0.1));
    const heading = Math.atan2(rider.heading.x, rider.heading.z);
    if (snap) {
      this.yaw = heading;
      this.pivot.copy(rider.position);
      this.returnYaw = null;
      this.wasVert = false;
    }
    const vert = rider.vertAir && !rider.grounded;
    if (vert && !this.wasVert) this.returnYaw = null;
    let target = heading;
    if (vert) {
      // Up and tricks hold the approach. The return is chosen ONCE at the
      // apex, so an almost head-on 180 cannot change orbit side every frame.
      if (rider.verticalSpeed < 3 && this.returnYaw === null) {
        const n = rider.vertNormal;
        const dot = rider.heading.x * n.x + rider.heading.z * n.z;
        this.returnYaw = Math.atan2(rider.heading.x - 2 * dot * n.x,
          rider.heading.z - 2 * dot * n.z);
      }
      target = this.returnYaw ?? heading;
    }
    if (!rider.bailing) this.yaw = chaseHeadingStep(this.yaw, target, step);
    this.wasVert = vert;
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.pivot.lerp(rider.position, 1 - Math.exp(-22 * step));
    const distance = THREE.MathUtils.clamp(tuning.camDist + 3.5, 5, 18);
    const height = THREE.MathUtils.clamp(tuning.camHeight - 1.5, 2.5, 10);
    this.aim.copy(this.pivot).addScaledVector(rider.up, 1.5)
      .addScaledVector(this.forward, 0.75 * Math.max(0, rider.up.y));
    this.aim.y += Math.tan(THREE.MathUtils.degToRad(25.35 - tuning.camPitch)) * distance;
    this.desiredEye.copy(this.pivot).addScaledVector(this.forward, -distance);
    this.desiredEye.y += height;
    // A descending wall needs a closer, higher perch. Keep its horizontal
    // bearing behind the rider: a full tangent-frame orbit can cross over
    // the torso and accidentally make the camera look BACK up the ramp.
    const intoSlope = this.forward.dot(rider.up);
    if ((rider.grounded || rider.verticalSpeed < 0) && intoSlope > 0 && rider.up.y < 0.999) {
      const steepness = THREE.MathUtils.clamp(1 - rider.up.y, 0, 1);
      this.desiredEye.copy(this.pivot).addScaledVector(this.forward, -distance * (1 - 0.55 * steepness));
      this.desiredEye.y += height + distance * 0.35 * steepness;
    }
    // Lift the eye over a transition/deck before pulling the lens inward.
    // The query is local in height so roofs well overhead cannot yank it up.
    this.origin.copy(this.desiredEye).addScaledVector(UP, 5);
    this.ray.set(this.origin, this.direction.set(0, -1, 0));
    this.ray.far = 6;
    const floor = this.ray.intersectObjects(surfaces, false).find(h => h.face && h.face.normal.y > 0.1);
    if (floor) this.desiredEye.y = Math.max(this.desiredEye.y, floor.point.y + 0.65);
    // Camera collision is separate from the skater's movement. Pull in
    // immediately on obstruction; recovering distance is naturally damped.
    // On vert the rider lies along the surface normal: a target 1.5m
    // vertically above their feet is empty air, and clears the coping while
    // the real body remains hidden below it. Probe from the tilted torso.
    this.origin.copy(rider.position).addScaledVector(rider.up, 1.5);
    const obstructionAt = () => {
      this.direction.subVectors(this.desiredEye, this.origin);
      const distance = this.direction.length();
      this.direction.multiplyScalar(1 / Math.max(distance, 1e-6));
      this.ray.set(this.origin, this.direction);
      this.ray.far = distance + 0.35;
      return this.ray.intersectObjects(surfaces, false).find(h => h.distance > 0.15);
    };
    let obstruction = obstructionAt();
    let lifted = false;
    if (obstruction) {
      const baseY = this.desiredEye.y;
      this.desiredEye.y = baseY + 9;
      if (!obstructionAt()) {
        // Find the lowest clear perch, avoiding a staircase of height jumps.
        let low = baseY, high = this.desiredEye.y;
        for (let i = 0; i < 7; i++) {
          this.desiredEye.y = (low + high) * 0.5;
          if (obstructionAt()) low = this.desiredEye.y;
          else high = this.desiredEye.y;
        }
        this.desiredEye.y = high + 0.2;
        obstruction = obstructionAt();
        lifted = true;
      } else {
        this.desiredEye.y = baseY;
        obstruction = obstructionAt();
      }
    }
    const length = this.desiredEye.distanceTo(this.origin);
    this.safeEye.copy(this.desiredEye);
    if (obstruction && obstruction.distance < length + 0.35)
      this.safeEye.copy(this.origin).addScaledVector(this.direction, Math.max(0.65, obstruction.distance - 0.45));
    if (snap || obstruction || lifted) camera.position.copy(this.safeEye);
    else camera.position.lerp(this.safeEye, 1 - Math.exp(-25 * step));
    camera.up.set(0, 1, 0);
    camera.lookAt(this.aim);
  }
}
