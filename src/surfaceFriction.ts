import type * as THREE from 'three';
import { surfaceFromName, type SurfaceKind } from './puffs';

/** One material-independent settle everywhere except explicitly tagged Beach sand. */
export const NON_BEACH_ROLL_FRICTION_MULTIPLIER = 0.12;
let legacyVisualSurfaceReplay = false;

/** Old v2 takes predate explicit Beach-sand tagging; preserve their trajectory. */
export function setLegacyVisualSurfaceFrictionReplay(enabled: boolean): void {
  legacyVisualSurfaceReplay = enabled;
}

export interface SkateGroundFrictionInput {
  readonly speed: number;
  readonly steep: boolean;
  readonly surface: SurfaceKind | undefined;
  readonly beachSand: boolean;
  readonly steepFriction: number;
  readonly rollFriction: number;
  readonly windDrag: number;
}

/**
 * Flat-ground rolling resistance plus surface-independent air drag, in speed
 * units per second. Visual materials never select physics: every ordinary
 * surface uses the same light settle, while authored Beach sand opts into the
 * full constant term. Steep ground returns the legacy linear value unchanged.
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
  const fullSurfaceDrag = legacyVisualSurfaceReplay
    ? input.surface !== 'grass'
    : input.beachSand;
  const groundFriction = rollFriction * (
    fullSurfaceDrag ? 1 : NON_BEACH_ROLL_FRICTION_MULTIPLIER
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
