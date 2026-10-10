import * as THREE from "three";

export const SYSTEMIC_EDGE_TOP_NORMAL_Y = 0.72;
export const SYSTEMIC_EDGE_MIN_LENGTH = 0.001;
const WELD_QUANTIZATION = 10_000; // Unity parity: 0.1 mm topology weld

export type SurfaceBoundaryEdge = readonly [
  start: THREE.Vector3,
  end: THREE.Vector3,
];

/** Join smooth boundary segments so mesh tessellation cannot end a grind.
 * Sharp corners and ambiguous junctions remain separate catchable edges.
 * Only topology changes; every authored boundary vertex is retained. */
export function joinSurfaceBoundaryEdges(edges: readonly SurfaceBoundaryEdge[]): THREE.Vector3[][] {
  const key = (p: THREE.Vector3) => `${Math.round(p.x * WELD_QUANTIZATION)},${Math.round(p.y * WELD_QUANTIZATION)},${Math.round(p.z * WELD_QUANTIZATION)}`;
  const adjacent = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    for (const p of edge) {
      const k = key(p), indices = adjacent.get(k) ?? [];
      indices.push(index); adjacent.set(k, indices);
    }
  });
  const used = new Set<number>(), paths: THREE.Vector3[][] = [];
  const incoming = new THREE.Vector3(), outgoing = new THREE.Vector3();
  const extend = (points: THREE.Vector3[]) => {
    for (;;) {
      const end = points[points.length - 1], k = key(end), candidates = adjacent.get(k)!;
      if (candidates.length !== 2) return;
      const next = candidates.find(index => !used.has(index));
      if (next === undefined) return;
      const edge = edges[next], other = key(edge[0]) === k ? edge[1] : edge[0];
      incoming.subVectors(end, points[points.length - 2]).normalize();
      outgoing.subVectors(other, end).normalize();
      if (incoming.dot(outgoing) < Math.SQRT1_2) return;
      used.add(next); points.push(other.clone());
    }
  };
  edges.forEach(([a, b], index) => {
    if (used.has(index)) return;
    used.add(index);
    const points = [a.clone(), b.clone()];
    extend(points); points.reverse(); extend(points); points.reverse();
    paths.push(points);
  });
  return paths;
}

const weldKey = (position: THREE.BufferAttribute, index: number): string =>
  `${Math.round(position.getX(index) * WELD_QUANTIZATION)},` +
  `${Math.round(position.getY(index) * WELD_QUANTIZATION)},` +
  `${Math.round(position.getZ(index) * WELD_QUANTIZATION)}`;

/**
 * Unity-compatible systemic grind boundaries for one gameplay surface.
 *
 * Boxes expose their four transformed top edges. Other meshes weld coincident
 * split vertices for topology only, retain sufficiently horizontal triangles,
 * and expose only edges owned by exactly one retained triangle. Render and
 * collision geometry remain untouched.
 */
export function surfaceBoundaryEdges(
  mesh: THREE.Mesh,
  topNormalY = SYSTEMIC_EDGE_TOP_NORMAL_Y,
): SurfaceBoundaryEdge[] {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | undefined;
  if (!position || position.count < 3) return [];
  mesh.updateWorldMatrix(true, false);

  if (geometry.type === "BoxGeometry") {
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return [];
    const points = [
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    ].map((point) => point.applyMatrix4(mesh.matrixWorld));
    return points.map((point, index) => [
      point,
      points[(index + 1) & 3].clone(),
    ] as const).filter(
      ([start, end]) =>
        start.distanceToSquared(end) >=
        SYSTEMIC_EDGE_MIN_LENGTH * SYSTEMIC_EDGE_MIN_LENGTH,
    );
  }

  const weldedByPosition = new Map<string, number>();
  const weldedIndices = new Array<number>(position.count);
  const representatives: number[] = [];
  for (let index = 0; index < position.count; index++) {
    const key = weldKey(position, index);
    let welded = weldedByPosition.get(key);
    if (welded === undefined) {
      welded = representatives.length;
      weldedByPosition.set(key, welded);
      representatives.push(index);
    }
    weldedIndices[index] = welded;
  }

  const counts = new Map<string, { a: number; b: number; count: number }>();
  const addEdge = (first: number, second: number): void => {
    const a = Math.min(first, second);
    const b = Math.max(first, second);
    if (a === b) return;
    const key = `${a}:${b}`;
    const current = counts.get(key);
    if (current) current.count++;
    else counts.set(key, { a, b, count: 1 });
  };
  const index = geometry.getIndex();
  const triangleIndex = (offset: number): number =>
    index ? index.getX(offset) : offset;
  const triangleCount = index ? index.count : position.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  for (let offset = 0; offset + 2 < triangleCount; offset += 3) {
    const ia = triangleIndex(offset);
    const ib = triangleIndex(offset + 1);
    const ic = triangleIndex(offset + 2);
    a.fromBufferAttribute(position, ia).applyMatrix4(mesh.matrixWorld);
    b.fromBufferAttribute(position, ib).applyMatrix4(mesh.matrixWorld);
    c.fromBufferAttribute(position, ic).applyMatrix4(mesh.matrixWorld);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const normal = ab.cross(ac);
    const length = normal.length();
    if (length <= 0.000001 || Math.abs(normal.y / length) < topNormalY)
      continue;
    addEdge(weldedIndices[ia], weldedIndices[ib]);
    addEdge(weldedIndices[ib], weldedIndices[ic]);
    addEdge(weldedIndices[ic], weldedIndices[ia]);
  }

  return [...counts.values()]
    .filter((edge) => edge.count === 1)
    .sort((left, right) => left.a - right.a || left.b - right.b)
    .map(({ a: wa, b: wb }) => [
      new THREE.Vector3()
        .fromBufferAttribute(position, representatives[wa])
        .applyMatrix4(mesh.matrixWorld),
      new THREE.Vector3()
        .fromBufferAttribute(position, representatives[wb])
        .applyMatrix4(mesh.matrixWorld),
    ] as const)
    .filter(
      ([start, end]) =>
        start.distanceToSquared(end) >=
        SYSTEMIC_EDGE_MIN_LENGTH * SYSTEMIC_EDGE_MIN_LENGTH,
    );
}
