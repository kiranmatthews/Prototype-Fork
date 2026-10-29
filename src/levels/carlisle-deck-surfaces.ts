import type { CustomComponent } from '../level';

type P = [number, number, number];
type XZ = [number, number];
const side = (a: XZ, b: XZ, p: P) => (b[0] - a[0]) * (p[2] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function halfPlane(points: P[], a: XZ, b: XZ, inside: boolean): P[] {
  const result: P[] = [], sign = inside ? 1 : -1;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], q = points[(i + 1) % points.length];
    const dp = side(a, b, p) * sign, dq = side(a, b, q) * sign;
    if (dp >= 0) result.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      result.push(p.map((v, axis) => v + (q[axis] - v) * t) as P);
    }
  }
  return result;
}
function subtract(points: P[], outline: XZ[]): P[][] {
  let intersection = points;
  for (let i = 0; i < outline.length && intersection.length >= 3; i++)
    intersection = halfPlane(intersection, outline[i], outline[(i + 1) % outline.length], true);
  const area = intersection.reduce((sum, p, i) => {
    const q = intersection[(i + 1) % intersection.length]; return sum + p[0] * q[2] - q[0] * p[2];
  }, 0);
  if (intersection.length < 3 || Math.abs(area) < 1e-8) return [points];
  const outside: P[][] = [];
  for (let i = 0; i < outline.length && points.length >= 3; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const part = halfPlane(points, a, b, false);
    if (part.length >= 3) outside.push(part);
    points = halfPlane(points, a, b, true);
  }
  return outside;
}
function hull(points: XZ[]): XZ[] {
  const ordered = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (a: XZ, b: XZ, c: XZ) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const part = (input: XZ[]) => { const out: XZ[] = []; for (const p of input) {
    while (out.length > 1 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
    out.push(p);
  } return out.slice(0, -1); };
  return [...part(ordered), ...part([...ordered].reverse())];
}

/** Dock tops end at each spring/lift berth. No second floor remains a few
 * centimetres under its deck; springs retain their native low boarding lip. */
export function fitCarlisleDeckBerths(components: CustomComponent[]): void {
  const berths = components.filter(c => c.t === 'trampoline' || c.t === 'mover' &&
    (c.bounce !== undefined || c.axis === 'y' && !c.orbit)).map(c => {
    const [w, , d] = c.s!, yaw = (c.yaw ?? 0) * Math.PI / 180;
    const points: XZ[] = [];
    const amp = c.t === 'mover' ? Math.abs(c.amp ?? 0) : 0;
    for (const shift of [-amp, amp]) for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2])
      points.push([c.p[0] + x * Math.cos(yaw) + z * Math.sin(yaw) + (c.axis === 'x' ? shift : 0),
        c.p[2] - x * Math.sin(yaw) + z * Math.cos(yaw) + (c.axis === 'z' ? shift : 0)]);
    const outline = hull(points), vertical = c.axis === 'y' ? amp : 0;
    return { outline, low: c.p[1] - vertical - .08, high: c.p[1] + vertical + .08,
      minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
      minZ: Math.min(...points.map(p => p[1])), maxZ: Math.max(...points.map(p => p[1])) };
  });
  for (const c of components) {
    if (c.t !== 'mesh' || !c.solid || !c.grindTopTriangles || !c.vertices || !c.indices) continue;
    const original = c.vertices, oldIndices = c.indices, tops: number[] = [], vertices = [...original];
    const vertex = (index: number): P => [original[index * 3] + c.p[0], original[index * 3 + 1] + c.p[1], original[index * 3 + 2] + c.p[2]];
    let changed = false;
    for (let i = 0; i < c.grindTopTriangles * 3; i += 3) {
      const source = oldIndices.slice(i, i + 3).map(vertex);
      let pieces = [source], cut = false;
      for (const b of berths) {
        if (source.some(p => p[1] < b.low || p[1] > b.high) ||
            Math.max(...source.map(p => p[0])) <= b.minX || Math.min(...source.map(p => p[0])) >= b.maxX ||
            Math.max(...source.map(p => p[2])) <= b.minZ || Math.min(...source.map(p => p[2])) >= b.maxZ) continue;
        pieces = pieces.flatMap(p => {
          const result = subtract(p, b.outline);
          if (result.length !== 1 || result[0] !== p) cut = true;
          return result;
        });
      }
      if (!cut) { tops.push(...oldIndices.slice(i, i + 3)); continue; }
      changed = true;
      for (const piece of pieces) for (let j = 1; j < piece.length - 1; j++) {
        const triangle = [piece[0], piece[j], piece[j + 1]];
        const area = side([triangle[0][0], triangle[0][2]], [triangle[1][0], triangle[1][2]], triangle[2]);
        if (Math.abs(area) < 1e-8) continue;
        if (area > 0) triangle.reverse();
        for (const p of triangle) { tops.push(vertices.length / 3); vertices.push(...p.map((v, axis) => v - c.p[axis])); }
      }
    }
    if (changed) {
      c.vertices = vertices; c.indices = [...tops, ...oldIndices.slice(c.grindTopTriangles * 3)];
      c.grindTopTriangles = tops.length / 3;
    }
  }
  // A painted quay arrow must not poke through the inset spring face.
  for (let i = components.length - 1; i >= 0; i--) {
    const c = components[i];
    if (c.nm !== 'Route chevron' || !c.vertices) continue;
    const points: P[] = [];
    for (let j = 0; j < c.vertices.length; j += 3)
      points.push([c.p[0] + c.vertices[j], c.p[1] + c.vertices[j + 1], c.p[2] + c.vertices[j + 2]]);
    if (berths.some(b => points.every(p => p[1] >= b.low && p[1] <= b.high) &&
        subtract(points, b.outline)[0] !== points)) components.splice(i, 1);
  }
}
