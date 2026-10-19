import * as THREE from 'three';
import type { CustomComponent, CustomLevelData } from './level';

type Point = readonly [number, number];
type Polygon = readonly Point[];
const ROOF_NAME = 'Skate hold · dark ceiling around the daylight openings';
const IDENTITY = new THREE.Matrix4();
const MARGIN = .05;

function signedArea(p: Polygon): number {
  let area = 0;
  for (let i = 1; i + 1 < p.length; i++)
    area += (p[i][0] - p[0][0]) * (p[i + 1][1] - p[0][1]) -
      (p[i][1] - p[0][1]) * (p[i + 1][0] - p[0][0]);
  return area / 2;
}

function clip(polygon: Polygon, distance: (p: Point) => number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], a = distance(p), b = distance(q);
    if (a >= 0) result.push(p);
    if ((a >= 0) !== (b >= 0)) {
      const t = a / (a - b);
      result.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return result;
}

/** Subtract each convex triangle from the remaining uncovered pieces. Union
 * coverage stays valid when triangulation overlaps; summed areas would allow
 * those overlaps to conceal a real hole. Bound fragmentation and fall back. */
function coveredBy(rectangle: Polygon, triangles: Polygon[]): boolean {
  let uncovered: Polygon[] = [rectangle];
  for (const triangle of triangles) {
    const next: Polygon[] = [];
    for (const polygon of uncovered) {
      let inside = polygon;
      for (let i = 0; i < triangle.length && inside.length; i++) {
        const p = triangle[i], q = triangle[(i + 1) % triangle.length];
        const distance = (r: Point): number => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        const outside = clip(inside, r => -distance(r));
        if (Math.abs(signedArea(outside)) > 1e-10) next.push(outside);
        inside = clip(inside, distance);
      }
    }
    if (!next.length) return true;
    if (next.length > 512) return false;
    uncovered = next;
  }
  return false;
}

function opaque(material: THREE.Material | THREE.Material[]): material is THREE.MeshStandardMaterial | THREE.MeshLambertMaterial {
  if (Array.isArray(material)) return false;
  const m = material as THREE.MeshStandardMaterial;
  return (m.isMeshStandardMaterial || (m as unknown as THREE.MeshLambertMaterial).isMeshLambertMaterial) &&
    m.visible && !m.transparent && m.opacity === 1 && !m.alphaTest && !m.alphaHash &&
    !m.displacementMap && !m.clippingPlanes?.length && m.depthWrite && m.depthTest;
}

interface CachedCell {
  geometry: THREE.BufferGeometry;
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  positionVersion: number;
  instances: THREE.InstancedBufferAttribute;
  instanceVersion: number;
  count: number;
  matrix: THREE.Matrix4;
  covered: boolean;
}
const positionVersion = (p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): number =>
  'isInterleavedBufferAttribute' in p ? p.data.version : p.version;

/** A CPU-only proof that a complete static cell is behind an opaque ceiling.
 * The bound render mesh must still cast, and the actual light must retain the
 * authored direction and include the ceiling in its depth range. No colour
 * geometry, instance buffers, physics or persistent shadow flags are changed. */
export class PlanarShadowOccluder {
  private owner?: THREE.Mesh;
  private ownerGeometry?: THREE.BufferGeometry;
  private ownerPosition?: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  private ownerPositionVersion = 0;
  private ownerIndex?: THREE.BufferAttribute | null;
  private ownerIndexVersion = 0;
  private readonly cells = new WeakMap<THREE.InstancedMesh, CachedCell>();
  private deadline = Infinity;

  /** Spread first-use proofs across frames. Until verified, a cell keeps its
   * normal shadow draw; warmed results remain available after the deadline. */
  beginPass(): void { this.deadline = performance.now() + .5; }
  private readonly lightPosition = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly point = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private readonly bounds: [number, number, number, number];

  constructor(private readonly source: CustomComponent, private readonly triangles: Polygon[],
    private readonly height: number, private readonly sun: THREE.Vector3) {
    const points = triangles.flat();
    this.bounds = [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0])),
      Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[1]))];
  }

  matches(source: CustomComponent): boolean { return source === this.source; }

  /** Called by the normal static-surface batcher, so the proof follows the
   * actual merged ceiling owner rather than assuming the source is visible. */
  bind(owner: THREE.Mesh): void {
    this.owner = owner;
    this.ownerGeometry = owner.geometry;
    this.ownerPosition = owner.geometry.attributes.position;
    this.ownerPositionVersion = positionVersion(this.ownerPosition);
    this.ownerIndex = owner.geometry.index;
    this.ownerIndexVersion = this.ownerIndex?.version ?? 0;
  }

  supports(lights: readonly THREE.Light[] | undefined, root: THREE.Object3D): boolean {
    const owner = this.owner, light = lights?.length === 1 ? lights[0] as THREE.DirectionalLight : undefined;
    if (!owner || !light?.isDirectionalLight || !light.castShadow || !root.matrixWorld.equals(IDENTITY) ||
      !owner.matrixWorld.equals(IDENTITY) || !owner.castShadow || !opaque(owner.material) ||
      owner.material.side !== THREE.DoubleSide || (owner.material.shadowSide != null && owner.material.shadowSide !== THREE.DoubleSide) ||
      owner.customDepthMaterial || owner.customDistanceMaterial || owner.geometry !== this.ownerGeometry ||
      owner.geometry.attributes.position !== this.ownerPosition || positionVersion(this.ownerPosition!) !== this.ownerPositionVersion ||
      owner.geometry.index !== this.ownerIndex || (this.ownerIndex?.version ?? 0) !== this.ownerIndexVersion ||
      owner.geometry.drawRange.start !== 0 || owner.geometry.drawRange.count < (this.ownerIndex?.count ?? this.ownerPosition!.count)) return false;
    // A detached or hidden ceiling cannot occlude the kit. Both must belong to
    // the same scene; editor cutaways and reparenting fall back to normal draws.
    let ceilingScene: THREE.Object3D = owner, kitScene: THREE.Object3D = root;
    for (let node: THREE.Object3D | null = owner; node; node = node.parent) {
      if (!node.visible) return false;
      ceilingScene = node;
    }
    for (let node: THREE.Object3D | null = root; node; node = node.parent) kitScene = node;
    if (ceilingScene !== kitScene || !(ceilingScene as THREE.Scene).isScene || owner.layers.mask !== 1) return false;
    this.lightPosition.setFromMatrixPosition(light.matrixWorld);
    this.direction.setFromMatrixPosition(light.target.matrixWorld).sub(this.lightPosition).negate().normalize();
    if (!(this.direction.distanceToSquared(this.sun) <= 1e-16)) return false;
    const camera = light.shadow.camera;
    for (const x of [this.bounds[0], this.bounds[1]]) for (const z of [this.bounds[2], this.bounds[3]]) {
      const depth = this.point.set(x, this.height, z).sub(this.lightPosition).dot(this.direction) * -1;
      if (!(depth > camera.near + .25 && depth < camera.far - .25)) return false;
    }
    return true;
  }

  covers(mesh: THREE.InstancedMesh): boolean {
    if (!mesh.visible || !mesh.castShadow || !opaque(mesh.material) || mesh.layers.mask !== 1 ||
      mesh.customDepthMaterial || mesh.customDistanceMaterial || mesh.morphTexture || mesh.geometry.morphAttributes.position?.length) return false;
    const position = mesh.geometry.attributes.position;
    if (!position) return false;
    const version = positionVersion(position), previous = this.cells.get(mesh);
    if (previous && previous.geometry === mesh.geometry && previous.position === position && previous.positionVersion === version &&
      previous.instances === mesh.instanceMatrix && previous.instanceVersion === mesh.instanceMatrix.version && previous.count === mesh.count &&
      previous.matrix.equals(mesh.matrixWorld)) return previous.covered;
    if (performance.now() >= this.deadline) return false;
    // Rebuild stale bounds when placements or geometry change, rather than
    // reusing a proof made for the old cell. A weak key never retains retirees.
    mesh.geometry.computeBoundingBox();
    mesh.computeBoundingBox();
    this.box.copy(mesh.boundingBox!).applyMatrix4(mesh.matrixWorld);
    let covered = false;
    if (!this.box.isEmpty() && this.box.max.y < this.height - .1 && [...this.box.min, ...this.box.max].every(Number.isFinite)) {
      let left = Infinity, right = -Infinity, back = Infinity, front = -Infinity;
      for (const x of [this.box.min.x, this.box.max.x]) for (const y of [this.box.min.y, this.box.max.y]) for (const z of [this.box.min.z, this.box.max.z]) {
        const distance = (this.height - y) / this.sun.y;
        const px = x + distance * this.sun.x, pz = z + distance * this.sun.z;
        left = Math.min(left, px - MARGIN); right = Math.max(right, px + MARGIN);
        back = Math.min(back, pz - MARGIN); front = Math.max(front, pz + MARGIN);
      }
      if (left >= this.bounds[0] && right <= this.bounds[1] && back >= this.bounds[2] && front <= this.bounds[3]) {
        const rectangle: Polygon = [[left, back], [right, back], [right, front], [left, front]];
        covered = coveredBy(rectangle, this.triangles);
      }
    }
    this.cells.set(mesh, {geometry: mesh.geometry, position, positionVersion: version, instances: mesh.instanceMatrix,
      instanceVersion: mesh.instanceMatrix.version, count: mesh.count, matrix: mesh.matrixWorld.clone(), covered});
    return covered;
  }
}

/** Deliberately limited to the static Crown ceiling. Edited/deforming material,
 * non-planar geometry and gameplay groups fail closed. */
export function createHoldShadowOccluder(data: CustomLevelData | null | undefined): PlanarShadowOccluder | undefined {
  if (data?.atmosphere?.profile !== 'drowned-crown') return;
  const roofs = data.components.filter(c => c.nm === ROOF_NAME), c = roofs[0], sun = data.atmosphere.sunDirection;
  const fields = new Set(['t', 'p', 'vertices', 'indices', 'solid', 'doubleSided', 'tex', 'color', 'grp', 'nm', 's', 'yaw']);
  if (roofs.length !== 1 || c.t !== 'mesh' || c.solid !== false || c.tex !== 'solid' || c.doubleSided !== true ||
    Object.keys(c).some(key => !fields.has(key)) || (c.yaw ?? 0) !== 0 || (c.s ?? [1, 1, 1]).some(s => s !== 1) ||
    !c.p.every(Number.isFinite) || !sun?.every(Number.isFinite) || sun[1] <= .1 ||
    !c.vertices?.length || c.vertices.length % 3 || c.vertices.length > 4096 || !c.vertices.every(Number.isFinite) ||
    !c.indices?.length || c.indices.length % 3 || c.indices.length > 768 ||
    c.indices.some(i => !Number.isInteger(i) || i < 0 || i >= c.vertices!.length / 3)) return;
  const groups = new Map(data.groups?.map(group => [group.id, group])), visited = new Set<number>();
  for (let id = c.grp; id !== undefined;) {
    const group = groups.get(id);
    if (!group?.editorOnly || visited.has(id)) return;
    visited.add(id); id = group.parent;
  }
  // Match the float32 vertices after the existing batcher's translation.
  const xyz = Array.from({length: c.vertices.length / 3}, (_, i) =>
    c.vertices!.slice(i * 3, i * 3 + 3).map((v, axis) => Math.fround(Math.fround(v) + c.p[axis])));
  const height = xyz[0][1];
  if (!xyz.every(p => p[1] === height)) return;
  const triangles: Polygon[] = [];
  for (let i = 0; i < c.indices.length; i += 3) {
    const triangle = c.indices.slice(i, i + 3).map(index => [xyz[index][0], xyz[index][2]] as Point);
    const area = signedArea(triangle);
    if (Math.abs(area) < 1e-8) return;
    if (area < 0) triangle.reverse();
    triangles.push(triangle);
  }
  return new PlanarShadowOccluder(c, triangles, height, new THREE.Vector3(...sun).normalize());
}
