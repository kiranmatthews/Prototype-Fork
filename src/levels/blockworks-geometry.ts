import type { CustomComponent } from '../level';

export type Point = [number, number, number];
export const BLOCKWORKS_GROUND = -12;
export const ROUTE_END = 2140;

const FREQUENCY = 2 * Math.PI / 660;
const SAMPLE_SPACING = 2;
const CHUNK_LENGTH = 64;
const WALL_DEPTH = 40;
// A common binary grid keeps translated Float32 chunks joined exactly.
// Its 0.244 mm pitch is far below gameplay and authored geometry resolution.
const worldGrid = (point: Point): Point => point.map(n => Math.round(n * 4096) / 4096) as Point;
type Scalar = number | ((station: number) => number);

export function routeX(station: number): number {
  return 66 * Math.sin(FREQUENCY * station) - 18 * Math.sin(2 * FREQUENCY * station);
}

export function routeDerivative(station: number): number {
  return 66 * FREQUENCY * Math.cos(FREQUENCY * station)
    - 36 * FREQUENCY * Math.cos(2 * FREQUENCY * station);
}

export function routeTangent(station: number): Point {
  const derivative = routeDerivative(station);
  const length = Math.hypot(derivative, 1);
  return [derivative / length, 0, -1 / length];
}

/** Metres across the actual route normal, rather than along world X. */
export function routePoint(station: number, y: number, offset = 0): Point {
  const [fx, , fz] = routeTangent(station);
  return [routeX(station) - fz * offset, y, 20 - station + fx * offset];
}

/** Three's yaw rotates a primitive's local -Z toward the route tangent. */
export function routeYaw(station: number): number {
  const [fx, , fz] = routeTangent(station);
  return -Math.atan2(fx, -fz) * 180 / Math.PI;
}

export interface RibbonOptions {
  grp: number;
  offset?: Scalar;
  color?: string;
  slip?: boolean;
  iceGrip?: number;
  name?: string;
}

const valueAt = (value: Scalar, station: number): number =>
  typeof value === 'function' ? value(station) : value;
const subtract = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const unit = (v: Point): Point => {
  const length = Math.hypot(...v);
  if (!Number.isFinite(length) || length < 1e-9) throw new RangeError('Degenerate Blockworks surface normal');
  return v.map(n => Math.max(-1, Math.min(1, n / length))) as Point;
};
const stations = (a: number, b: number): number[] => {
  const count = Math.max(1, Math.ceil((b - a) / SAMPLE_SPACING));
  return Array.from({ length: count + 1 }, (_, i) => i === count ? b : a + (b - a) * i / count);
};
const requireSpan = (a: number, b: number): void => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a)
    throw new RangeError('Blockworks geometry needs an increasing finite station range');
};

/**
 * Continuous greybox road mass. Adjacent chunks share exact edge positions
 * and top normals; side/bottom/cap vertices stay separate for crisp corners.
 * The buried floor is fixed, while invisible edge shells supply the existing
 * wallpath narrow-phase collision below the ride surface.
 */
export function emitRibbon(
  components: CustomComponent[], a: number, b: number, top: Scalar, width: Scalar,
  options: RibbonOptions,
): void {
  requireSpan(a, b);
  const offset = options.offset ?? 0;
  if (options.iceGrip !== undefined && (!options.slip || !Number.isFinite(options.iceGrip)
    || options.iceGrip < .02 || options.iceGrip > 1))
    throw new RangeError('Authored ice needs slip:true and iceGrip between .02 and 1');
  const edgeAt = (s: number, side: -1 | 1): Point => {
    const y = valueAt(top, s), w = valueAt(width, s), u = valueAt(offset, s);
    if (!Number.isFinite(u)) throw new RangeError('Ribbon offset must be finite');
    if (!Number.isFinite(y) || y <= BLOCKWORKS_GROUND || !Number.isFinite(w) || w <= 0)
      throw new RangeError('Ribbon top must clear buried ground and width must be positive');
    return routePoint(s, y, u + side * w / 2);
  };
  const edgeDerivative = (s: number, side: -1 | 1): Point => {
    // Use the complete ribbon interval, not a chunk's ends: seam normals are
    // identical even when height and width change through a chunk boundary.
    const lo = Math.max(a, s - .05), hi = Math.min(b, s + .05);
    return subtract(edgeAt(hi, side), edgeAt(lo, side));
  };
  const topNormal = (s: number, side: -1 | 1): Point => {
    const [fx, , fz] = routeTangent(s);
    const normal = unit(cross([-fz, 0, fx], edgeDerivative(s, side)));
    if (normal[1] <= 0) throw new RangeError('Ribbon width folds through the inside of its curve');
    return normal;
  };
  const geometryEdgeAt = (s: number, side: -1 | 1): Point => {
    const point = edgeAt(s, side);
    // Separate roads can meet at different widths. Their rounded cap edges
    // need a tiny construction overlap to close sub-millimetre Float32 wedges.
    const overlap = s === a ? -.002 : s === b ? .002 : 0;
    if (overlap) {
      const forward = routeTangent(s);
      point[0] += forward[0] * overlap; point[2] += forward[2] * overlap;
    }
    return worldGrid(point);
  };
  const sideNormal = (s: number, side: -1 | 1): Point => {
    const [dx, , dz] = edgeDerivative(s, side);
    return unit([-side * dz, 0, side * dx]);
  };
  const shell = (points: Point[], anchor: Point, suffix: string): void => {
    components.push({ t: 'wallpath', p: anchor,
      pts: points.map(p => [p[0] - anchor[0], p[2] - anchor[2], 0, p[1] - WALL_DEPTH]),
      w: .16, rise: WALL_DEPTH, collisionHeight: WALL_DEPTH - .25,
      invisible: true, edgeGrinding: false, grp: options.grp,
      nm: `${options.name ?? 'Curved ground'} · ${suffix}` });
  };

  const chunks = Math.ceil((b - a) / CHUNK_LENGTH);
  for (let chunk = 0; chunk < chunks; chunk++) {
    const from = a + chunk * CHUNK_LENGTH, to = Math.min(b, from + CHUNK_LENGTH);
    const samples = stations(from, to), anchor = worldGrid(routePoint(from, 0));
    const left = samples.map(s => geometryEdgeAt(s, -1)), right = samples.map(s => geometryEdgeAt(s, 1));
    const vertices: number[] = [], normals: number[] = [], indices: number[] = [];
    const addVertex = (point: Point, normal: Point): number => {
      const index = vertices.length / 3;
      vertices.push(point[0] - anchor[0], point[1], point[2] - anchor[2]);
      normals.push(...normal); return index;
    };
    const pointAt = (index: number): Point => vertices.slice(index * 3, index * 3 + 3) as Point;
    const quad = (a: number, b: number, c: number, d: number, outward: Point): void => {
      const face = cross(subtract(pointAt(b), pointAt(a)), subtract(pointAt(c), pointAt(a)));
      const facing = face[0] * outward[0] + face[1] * outward[1] + face[2] * outward[2];
      if (facing >= 0) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    };
    const bottom = (point: Point): Point => [point[0], BLOCKWORKS_GROUND, point[2]];

    // Shared top rings interpolate normals along the entire route. Each next
    // face reuses its predecessor's two top vertices, avoiding faceted shading.
    const topRings = samples.map((s, i) => [
      addVertex(left[i], topNormal(s, -1)), addVertex(right[i], topNormal(s, 1)),
    ]);
    for (let i = 1; i < samples.length; i++)
      quad(topRings[i - 1][0], topRings[i - 1][1], topRings[i][1], topRings[i][0], [0, 1, 0]);

    for (const side of [-1, 1] as const) {
      const edge = side === -1 ? left : right;
      const rings = samples.map((s, i) => {
        const normal = sideNormal(s, side);
        return [addVertex(edge[i], normal), addVertex(bottom(edge[i]), normal)];
      });
      for (let i = 1; i < samples.length; i++)
        quad(rings[i - 1][0], rings[i][0], rings[i][1], rings[i - 1][1], sideNormal(samples[i], side));
    }
    const bottomRings = samples.map((_, i) => [
      addVertex(bottom(left[i]), [0, -1, 0]), addVertex(bottom(right[i]), [0, -1, 0]),
    ]);
    for (let i = 1; i < samples.length; i++)
      quad(bottomRings[i - 1][0], bottomRings[i][0], bottomRings[i][1], bottomRings[i - 1][1], [0, -1, 0]);
    for (const [i, sign] of [[0, -1], [samples.length - 1, 1]] as const) {
      const forward = routeTangent(samples[i]);
      const outward = forward.map(n => n * sign) as Point;
      const ids = [left[i], bottom(left[i]), bottom(right[i]), right[i]].map(p => addVertex(p, outward));
      quad(ids[0], ids[1], ids[2], ids[3], outward);
    }
    components.push({ t: 'mesh', p: anchor, vertices, normals, indices,
      vert: false, edgeGrinding: false, tex: 'solid', color: options.color ?? '#aeb4bb',
      grp: options.grp, nm: options.name ?? 'Curved ground',
      ...(options.slip ? { slip: true } : {}),
      ...(options.iceGrip === undefined ? {} : { iceGrip: options.iceGrip }) });
    shell(left, anchor, 'left mass collision');
    shell(right, anchor, 'right mass collision');
    // Only exposed ends need face collision; artificial chunk seams remain open.
    if (chunk === 0) shell([left[0], right[0]], anchor, 'entry mass collision');
    if (chunk === chunks - 1) shell([left[left.length - 1], right[right.length - 1]], anchor, 'exit mass collision');
  }
}

/** Exact sampled curved gap footprint; one simple polygon, with no bbox kill spill. */
export function emitPit(
  components: CustomComponent[], a: number, b: number, y: number, width: Scalar, grp: number,
): void {
  requireSpan(a, b);
  if (!Number.isFinite(y)) throw new RangeError('Pit height must be finite');
  const anchor = worldGrid(routePoint(a, y)), samples = stations(a, b);
  const edge = (side: -1 | 1): [number, number][] => samples.map(s => {
    const w = valueAt(width, s);
    if (!Number.isFinite(w) || w <= 0) throw new RangeError('Pit width must be positive');
    const p = worldGrid(routePoint(s, y, side * w / 2));
    return [p[0] - anchor[0], p[2] - anchor[2]];
  });
  components.push({ t: 'pit', p: anchor, pts: [...edge(-1), ...edge(1).reverse()],
    color: '#17202b', grp, nm: 'Curved gap' });
}
