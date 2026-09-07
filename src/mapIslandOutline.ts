import type { IslandShoreFoam } from './islandShoreFoam';

/** Map accent only; never changes the ported in-level shoreline material. */
export const MAP_OUTLINE_FIELDS = {
  enabled: { label: 'enabled', value: 1, lo: 0, hi: 1, step: 1 },
  opacity: { label: 'opacity', value: 0.97, lo: 0, hi: 1, step: 0.001 },
  width: { label: 'width multiplier', value: 1, lo: 0, hi: 4, step: 0.01 },
  offset: { label: 'shore offset (m)', value: 0, lo: -2, hi: 2, step: 0.01 },
  edgePower: { label: 'edge falloff', value: 0.5, lo: 0.25, hi: 4, step: 0.01 },
  pulseSpeed: { label: 'pulse speed', value: 0.18, lo: 0, hi: 2, step: 0.01 },
  pulseAmount: { label: 'pulse amount', value: 0.18, lo: 0, hi: 1, step: 0.01 },
  detailFrequency: { label: 'detail frequency', value: 4.8, lo: 0, hi: 20, step: 0.1 },
} as const;
export type MapOutlineKey = keyof typeof MAP_OUTLINE_FIELDS;
export type MapOutlineParams = Record<MapOutlineKey, number>;
export function cleanMapOutline(raw: unknown): Partial<MapOutlineParams> {
  const result: Partial<MapOutlineParams> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const key of Object.keys(MAP_OUTLINE_FIELDS) as MapOutlineKey[]) {
    const value = (raw as Record<string, unknown>)[key], field = MAP_OUTLINE_FIELDS[key];
    if (typeof value === 'number' && Number.isFinite(value))
      result[key] = key === 'enabled' ? Number(value >= 0.5) : Math.max(field.lo, Math.min(field.hi, value));
  }
  return result;
}
export function mapOutlineParams(patch: Partial<MapOutlineParams>): MapOutlineParams {
  return Object.fromEntries(Object.entries(MAP_OUTLINE_FIELDS).map(([key, field]) =>
    [key, patch[key as MapOutlineKey] ?? field.value])) as MapOutlineParams;
}

const originals = new WeakMap<IslandShoreFoam, { positions: Float32Array; width: number; offset: number }>();
export function applyMapOutline(shore: IslandShoreFoam, params: MapOutlineParams): void {
  const positions = shore.geometry.getAttribute('position');
  let base = originals.get(shore);
  if (!base) {
    base = { positions: new Float32Array(positions.array), width: 1, offset: 0 };
    originals.set(shore, base);
  }
  // Rebuild only after width/offset edits, always from the authored coastline.
  // Adjacent vertices are the inner/outer edge of the same radial strip.
  if (base.width !== params.width || base.offset !== params.offset) {
    const p = base.positions;
    for (let i = 0; i < positions.count; i += 2) {
      const j = i * 3, dx = p[j + 3] - p[j], dz = p[j + 5] - p[j + 2];
      const length = Math.max(1e-6, Math.hypot(dx, dz));
      for (let band = 0; band < 2; band++) {
        const distance = params.offset + band * length * params.width;
        positions.setXYZ(i + band, p[j] + dx / length * distance, p[j + band * 3 + 1], p[j + 2] + dz / length * distance);
      }
    }
    positions.needsUpdate = true;
    shore.geometry.computeBoundingBox(); shore.geometry.computeBoundingSphere();
    base.width = params.width; base.offset = params.offset;
  }
  shore.mesh.visible = !!params.enabled && params.opacity > 0 && params.width > 0;
  const uniforms = shore.material.uniforms;
  uniforms.uBaseColor.value.set(1, 1, 1, params.opacity);
  uniforms.uEdgePower.value = params.edgePower;
  uniforms.uPulseSpeed.value = params.pulseSpeed;
  uniforms.uPulseAmount.value = params.pulseAmount;
  uniforms.uDetailFrequency.value = params.detailFrequency;
}
