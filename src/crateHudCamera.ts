import * as THREE from 'three';

/** A shallow, front-led view, judged against the Crash 2/3 and N. Sane HUDs.
 * These are our art-direction values, not recovered camera data from those games.
 */
export const CRATE_HUD_VIEW = Object.freeze({
  tilt: THREE.MathUtils.degToRad(17),
  yaw: THREE.MathUtils.degToRad(23),
  focalLength: 100,
  fill: .94,
  turnRate: .6,
});

export function createCrateHudCamera(focalLength = CRATE_HUD_VIEW.focalLength): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(20, 1, .1, 20);
  camera.setFocalLength(focalLength);
  // A one-unit-high gate at the origin, just like the other HUD icons.
  camera.position.z = .5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  camera.updateMatrixWorld();
  return camera;
}

/** Fit the entire rotating cylinder, including perspective foreshortening.
 * The envelope is independent of yaw, so the crate never breathes or clips as
 * it turns. Works for the normal HUD, portrait slots and moving Bonus receipts.
 */
export function crateHudScale(
  aspect: number,
  halfHeight: number,
  radius: number,
  distance: number,
  tilt = CRATE_HUD_VIEW.tilt,
  fill = CRATE_HUD_VIEW.fill,
): number {
  if (aspect <= 0 || halfHeight <= 0 || radius <= 0 || distance <= 0) return 0;
  const sin = Math.sin(tilt), cos = Math.cos(tilt);
  let lo = 0, hi = Math.min(1 / halfHeight, aspect / radius);
  for (let i = 0; i < 24; i++) {
    const scale = (lo + hi) / 2;
    let fits = true;
    for (const y of [-halfHeight, halfHeight]) {
      const a = distance - scale * y * sin;
      const b = scale * radius * cos;
      // Maximum projected horizontal radius of a perspective-projected circle.
      if (a <= Math.abs(b) || scale * distance * radius / Math.sqrt(a * a - b * b) > aspect * fill / 2) fits = false;
      for (const z of [-radius, radius]) {
        const depth = distance - scale * (y * sin + z * cos);
        const screenY = scale * distance * (y * cos - z * sin) / depth;
        if (depth <= .1 || Math.abs(screenY) > fill / 2) fits = false;
      }
    }
    if (fits) lo = scale; else hi = scale;
  }
  return lo;
}
