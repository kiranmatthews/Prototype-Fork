import type { Object3D } from 'three';

/** The rope opening measured inside Carlisle's asymmetric metal housing.
 * Rendering and contact classification share these deck-local limits. */
export function marineNetBounds(width: number, length: number): [number, number, number, number] {
  return [-width * .307, width * .357, -length * .365, length * .363];
}
/** Render-only weight contact. The collider and the movement controller keep
 * their authored support plane; no spring impulse is generated here. */
export interface TrampolineSurfacePresentation {
  press(x: number, z: number): void;
  weightOffset(x: number, z: number): number;
}
export const trampolineSurfacePresentations = new WeakMap<Object3D, TrampolineSurfacePresentation>();
