import * as THREE from 'three';

/** Minimal visual pitch fit for a posed hero at the existing close camera.
 * Eye, lens and gameplay heading are never changed. Bounds come from the
 * player's existing pose cache; this layer performs no character measurement. */
export class CameraHeroFraming {
  private pitch = 0;
  private readonly point = new THREE.Vector3();
  reset(): void { this.pitch = 0; }

  apply(camera: THREE.PerspectiveCamera, bounds: THREE.Box3 | null | undefined, dt: number, snap = false): void {
    if (!bounds || bounds.isEmpty()) { this.reset(); return; }
    if (snap) this.reset();
    camera.updateMatrixWorld(true);
    let low = Infinity, high = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          this.point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          if (this.point.z >= -camera.near) continue;
          const angle = Math.atan2(this.point.y, -this.point.z);
          low = Math.min(low, angle); high = Math.max(high, angle);
        }
    if (!Number.isFinite(low) || !Number.isFinite(high)) { this.reset(); return; }
    const limit = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) * .5) * .92);
    const minimum = high - limit, maximum = low + limit;
    // Follow the pose immediately if it would leave the frame; otherwise let
    // the correction relax toward the ordinary pitch as the rider rights.
    const relaxed = this.pitch * Math.exp(-10 * Math.max(0, dt));
    this.pitch = minimum <= maximum ? THREE.MathUtils.clamp(relaxed, minimum, maximum) : (low + high) * .5;
    if (Math.abs(this.pitch) > 1e-7) camera.rotateX(this.pitch);
  }
}
