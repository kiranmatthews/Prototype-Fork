import * as THREE from "three";

export interface LedgeBasis {
  nx: number;
  nz: number;
  tx: number;
  tz: number;
  skin: number;
}

export interface LedgeCatchEnvelope {
  reach: number;
  minimumAirRise: number;
  maximumRisingSpeed: number;
  nearMiss: number;
  forwardProbe: number;
  airIntoThreshold: number;
  groundedIntoThreshold: number;
}

/**
 * Expand the default catch gates for a level-authored 0..1 accessibility
 * assist. Zero is byte-for-byte the shipped global feel; one is the generous
 * Jungle Gate recovery envelope, still far short of bridging its route gaps.
 */
export function ledgeCatchEnvelope(
  baseReach: number,
  assistValue: number,
  out?: LedgeCatchEnvelope,
): LedgeCatchEnvelope {
  const assist = Math.min(1, Math.max(0, assistValue));
  const envelope = out ?? ({} as LedgeCatchEnvelope);
  envelope.reach = baseReach + assist * 1.4;
  envelope.minimumAirRise = 0.7 - assist * 0.25;
  envelope.maximumRisingSpeed = 1.5 + assist * 4.5;
  envelope.nearMiss = 0.14 + assist * 0.26;
  envelope.forwardProbe = 0.62 + assist * 0.3;
  envelope.airIntoThreshold = 0.2 - assist * 0.12;
  envelope.groundedIntoThreshold = 0.65 - assist * 0.2;
  return envelope;
}

/**
 * Build one horizontal ledge frame for arbitrary (including diagonal) faces.
 * `skin` is the AABB support radius along the normal plus a small air gap.
 */
export function ledgeBasis(
  normal: { x: number; z: number },
  halfX: number,
  halfZ: number,
  airGap = 0.06,
): LedgeBasis {
  const length = Math.hypot(normal.x, normal.z);
  const nx = length > 1e-6 ? normal.x / length : 0;
  const nz = length > 1e-6 ? normal.z / length : 1;
  return {
    nx,
    nz,
    tx: nz,
    tz: -nx,
    skin: Math.abs(nx) * halfX + Math.abs(nz) * halfZ + airGap,
  };
}

/** The actual lip point beneath a hanging body centre. */
export function ledgeEdgePoint(
  out: THREE.Vector3,
  anchor: { x: number; y: number; z: number },
  basis: LedgeBasis,
): THREE.Vector3 {
  return out.set(
    anchor.x - basis.nx * basis.skin,
    anchor.y,
    anchor.z - basis.nz * basis.skin,
  );
}

/** A standing foot point `depth` inward from the lip, along -normal. */
export function ledgeLandingPoint(
  out: THREE.Vector3,
  anchor: { x: number; y: number; z: number },
  basis: LedgeBasis,
  depth: number,
  groundY: number,
): THREE.Vector3 {
  const fromAnchor = basis.skin + depth;
  return out.set(
    anchor.x - basis.nx * fromAnchor,
    groundY,
    anchor.z - basis.nz * fromAnchor,
  );
}

/** Advance a hanging body along the ledge tangent. */
export function ledgeTraversePoint(
  out: THREE.Vector3,
  anchor: { x: number; y: number; z: number },
  basis: LedgeBasis,
  distance: number,
): THREE.Vector3 {
  return out.set(
    anchor.x + basis.tx * distance,
    anchor.y,
    anchor.z + basis.tz * distance,
  );
}

/** Physics body volume for a standing or climbing foot position. */
export function ledgeBodyBox(
  out: THREE.Box3,
  feet: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  inset = 0.025,
): THREE.Box3 {
  const hx = Math.max(0.05, half.x - inset);
  const hz = Math.max(0.05, half.z - inset);
  out.min.set(feet.x - hx, feet.y + inset, feet.z - hz);
  out.max.set(
    feet.x + hx,
    feet.y + half.y * 2 - inset,
    feet.z + hz,
  );
  return out;
}

/** Supports ending at the foot plane are not standing-body obstructions. */
export function ledgeBlockerIntersects(
  blocker: THREE.Box3,
  body: THREE.Box3,
  footY: number,
  supportEpsilon = 0.12,
): boolean {
  return blocker.max.y > footY + supportEpsilon && blocker.intersectsBox(body);
}
