import type { Scene } from 'three';

/** Reflection, refraction and the primary camera observe the same authored
 * pose. Update that pose once before the passes, then restore Three's normal
 * behavior for standalone renders, editor tools and later simulation steps.
 * Camera matrices remain automatic: the reflection camera is a separate view.
 */
export function prepareWorldFrame(scene: Scene): boolean {
  const automatic = scene.matrixWorldAutoUpdate;
  if (automatic) {
    scene.updateMatrixWorld();
    scene.matrixWorldAutoUpdate = false;
  }
  return automatic;
}

export function finishWorldFrame(scene: Scene, automatic: boolean): void {
  scene.matrixWorldAutoUpdate = automatic;
}
