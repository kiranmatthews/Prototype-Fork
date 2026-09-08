import * as THREE from 'three';
import { frameBlend } from './skateParkPhysics';

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

// Reference medium-camera proportions, scaled for this taller character.
// Preserve the reference's vertical framing on a widescreen viewport.
export const SKATE_CAMERA = Object.freeze({
  behind: 12 * 0.3048 * 1.25,
  above: 4.3 * 0.3048 * 1.25,
  tilt: 0.18,
  verticalFov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(72) / 2) * 3 / 4)),
});

/** A three-dimensional chase frame: transition normal is screen-up, and
 * vert air looks down the wall. Tricks do not rotate the camera. */
export class SkateChaseCamera {
  readonly forward = new THREE.Vector3(0, 0, -1);
  readonly aim = new THREE.Vector3();
  readonly desiredEye = new THREE.Vector3();
  private readonly pivot = new THREE.Vector3();
  private readonly orientation = new THREE.Quaternion();
  private readonly targetOrientation = new THREE.Quaternion();
  private readonly basis = new THREE.Matrix4();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly back = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly ray = new THREE.Raycaster();
  private wasGrounded = true;
  private landingBlendTime = 0;

  update(camera: THREE.PerspectiveCamera, rider: SkateCameraSubject, dt: number,
    snap: boolean, surfaces: THREE.Object3D[], _tuning?: unknown): void {
    const step = Math.max(0, Math.min(dt, 0.1));
    const vert = rider.vertAir && !rider.grounded;
    if (rider.grounded && !this.wasGrounded) this.landingBlendTime = 10 / 60;
    this.wasGrounded = rider.grounded;
    this.landingBlendTime = Math.max(0, this.landingBlendTime - step);
    this.forward.copy(vert ? { x: 0, y: -1, z: 0 } : rider.heading).normalize();
    this.up.copy(vert ? rider.vertNormal : rider.grounded ? rider.up : { x: 0, y: 1, z: 0 });
    this.right.crossVectors(this.forward, this.up);
    if (this.right.lengthSq() < 1e-8) this.right.set(1, 0, 0).applyQuaternion(this.orientation);
    this.right.normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    // A modest downward lens tilt is applied in the surface frame.
    this.direction.copy(this.forward).multiplyScalar(Math.cos(SKATE_CAMERA.tilt))
      .addScaledVector(this.up, -Math.sin(SKATE_CAMERA.tilt));
    this.up.multiplyScalar(Math.cos(SKATE_CAMERA.tilt))
      .addScaledVector(this.forward, Math.sin(SKATE_CAMERA.tilt));
    this.back.copy(this.direction).negate();
    this.basis.makeBasis(this.right, this.up, this.back);
    this.targetOrientation.setFromRotationMatrix(this.basis);
    if (snap) {
      this.orientation.copy(this.targetOrientation);
      this.pivot.copy(rider.position);
    } else {
      if (!rider.bailing) this.orientation.slerp(this.targetOrientation,
        frameBlend(this.landingBlendTime > 0 ? 0.375 : 0.04, step));
      this.pivot.x += (rider.position.x - this.pivot.x) * frameBlend(vert ? 1 : 0.25, step);
      this.pivot.y += (rider.position.y - this.pivot.y) * frameBlend(vert ? 1 : 0.75, step);
      this.pivot.z += (rider.position.z - this.pivot.z) * frameBlend(vert ? 1 : 0.25, step);
    }
    this.back.set(0, 0, 1).applyQuaternion(this.orientation);
    this.up.set(0, 1, 0).applyQuaternion(this.orientation);
    this.aim.copy(rider.position).addScaledVector(rider.up, SKATE_CAMERA.above);
    this.desiredEye.copy(this.pivot).addScaledVector(this.back, SKATE_CAMERA.behind)
      .addScaledVector(rider.up, SKATE_CAMERA.above);
    // Local collision correction: never rotate or displace the skater to
    // satisfy the lens. The smoothed frame naturally restores the full view.
    this.direction.subVectors(this.desiredEye, this.aim);
    const distance = this.direction.length();
    this.direction.divideScalar(Math.max(distance, 1e-6));
    this.ray.set(this.aim, this.direction);
    this.ray.near = 0.1;
    this.ray.far = distance + 0.2;
    const contact = this.ray.intersectObjects(surfaces, false)[0];
    camera.position.copy(this.desiredEye);
    if (contact) camera.position.copy(this.aim)
      .addScaledVector(this.direction, Math.max(0.35, contact.distance - 0.25));
    camera.up.copy(this.up);
    camera.lookAt(this.aim);
    // Only used by optional look controls; park steering never reads it.
    this.forward.set(-this.back.x, 0, -this.back.z);
    if (this.forward.lengthSq() < 1e-7) this.forward.set(rider.heading.x, 0, rider.heading.z);
    this.forward.normalize();
  }
}
