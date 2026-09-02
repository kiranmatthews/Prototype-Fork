import type * as THREE from 'three';
import { surfaceFromName, type SurfaceKind } from './puffs';

/** Grass should carry momentum, but retain a light settle so rollout can end. */
export const GRASS_ROLL_FRICTION_MULTIPLIER = 0.12;

export interface SkateGroundFrictionInput {
  readonly speed: number;
  readonly steep: boolean;
  readonly surface: SurfaceKind | undefined;
  readonly steepFriction: number;
  readonly rollFriction: number;
  readonly windDrag: number;
}

/**
 * Flat-ground rolling resistance plus surface-independent air drag, in speed
 * units per second. Sand and hard surfaces retain the authored rollout; grass
 * only keeps a small settling fraction of the constant ground term. Steep
 * ground returns the legacy linear value unchanged.
 */
export function skateGroundFrictionRate(input: SkateGroundFrictionInput): number {
  const speed = Math.max(0, Number.isFinite(input.speed) ? Math.abs(input.speed) : 0);
  const steepFriction = Math.max(
    0,
    Number.isFinite(input.steepFriction) ? input.steepFriction : 0,
  );
  const rollFriction = Math.max(
    0,
    Number.isFinite(input.rollFriction) ? input.rollFriction : 0,
  );
  const windDrag = Math.max(0, Number.isFinite(input.windDrag) ? input.windDrag : 0);
  if (input.steep) return steepFriction;
  const groundFriction = rollFriction * (
    input.surface === 'grass' ? GRASS_ROLL_FRICTION_MULTIPLIER : 1
  );
  return groundFriction + windDrag * speed * speed;
}

function materialTextureKind(object: THREE.Object3D): string | undefined {
  const material = (object as THREE.Mesh).material;
  const materials = Array.isArray(material) ? material : material ? [material] : [];
  for (const candidate of materials) {
    const kind = candidate.userData?.texKind;
    if (typeof kind === 'string' && kind.length > 0) return kind;
  }
  return undefined;
}

/** Keep structural hit names intact while recovering their painted surface. */
export function surfaceKindFromGroundObject(
  object: THREE.Object3D,
  structuralName: string,
): SurfaceKind {
  const explicit = object.userData.surfaceKind ?? object.userData.surfaceName;
  return surfaceFromName(
    typeof explicit === 'string' && explicit.length > 0
      ? explicit
      : materialTextureKind(object) ?? structuralName,
  );
}
