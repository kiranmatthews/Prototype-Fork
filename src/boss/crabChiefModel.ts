import type * as THREE from 'three';

/** Shared authored pose contract for the fitted Meshy chief surface. */
export interface ChiefPose {
  time: number;
  stateTime: number;
  phase: number;
  state: string;
  target: THREE.Vector3;
  left: boolean;
  exposed: boolean;
  defeated: boolean;
}
