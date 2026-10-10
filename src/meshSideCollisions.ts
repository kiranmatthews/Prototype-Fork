import * as THREE from 'three';
import { WorldSolids, solidContact } from './worldSolids';

/** Opted-in authored mesh walls only. Floors, ceilings and scenery retain
 * their existing native player contact paths. */
export class MeshSideCollisions {
  private readonly solids = new WorldSolids();
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly contact = solidContact();

  add(mesh: THREE.Mesh, active: () => boolean): void {
    const positions = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const count = index?.count ?? positions.count, vertices: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const triangle = new THREE.Triangle(a, b, c), normal = new THREE.Vector3();
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(positions, index ? index.getX(i) : i);
      b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);
      c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
      if (triangle.getArea() < 1e-8 || Math.abs(triangle.getNormal(normal).y) > .01) continue;
      vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    }
    if (!vertices.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometries.push(geometry);
    this.solids.add(mesh, { geometry, active });
  }

  resolve(previous: THREE.Vector3, position: THREE.Vector3,
    half: { x: number; y: number; z: number }, normal: THREE.Vector3): boolean {
    if (!this.geometries.length) return false;
    // Keep the native box's horizontal reach even while crouching. A round
    // capsule constrained by the short stance would shrink its X/Z footprint.
    const radius = Math.hypot(half.x, half.z);
    if (!this.solids.resolve(previous, position, {
      low: 0, high: half.y * 2, radius,
      supportRadius: n => Math.abs(n.x) * half.x + Math.abs(n.z) * half.z,
      soleClearance: .25, // native platform sides also end below their rideable lip
      ignoreGround: true,
    }, this.contact)) return false;
    normal.copy(this.contact.normal);
    return true;
  }

  dispose(): void {
    this.solids.dispose();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
  }
}
