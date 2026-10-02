import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const REEF_COLORS = { shell: '#b83e4c', light: '#f28359', dark: '#682e46',
  gold: '#edb965', cream: '#fff0bb', teal: '#43bab6', blue: '#277c91',
  wood: '#795039', leaf: '#3b8e78', ink: '#30283d' };
/** One level-owned pool. No global cached GPU assets or remote model loads. */
export class ReefGeometry {
  readonly materials = new Map<string, THREE.MeshStandardMaterial>();
  readonly ball = new THREE.IcosahedronGeometry(1, 0);
  readonly round = new THREE.IcosahedronGeometry(1, 1);
  readonly box = new THREE.BoxGeometry(1, 1, 1);
  readonly shaft = new THREE.CylinderGeometry(1, 1, 1, 6);
  readonly cone = new THREE.ConeGeometry(1, 1, 6);
  material(color: string, emission = 0): THREE.MeshStandardMaterial {
    const key = `${color}:${emission}`;
    let material = this.materials.get(key);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: .87, metalness: .05,
        flatShading: true, emissive: color, emissiveIntensity: emission });
      this.materials.set(key, material);
    }
    return material;
  }
  mesh(parent: THREE.Object3D, shape: 'ball' | 'round' | 'box' | 'shaft' | 'cone', color: string,
    p: readonly number[], s: readonly number[], emission = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(this[shape], this.material(color, emission));
    mesh.position.set(p[0], p[1], p[2]); mesh.scale.set(s[0], s[1], s[2]);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  segment(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number,
    color: string, taper = false): THREE.Mesh {
    const mesh = this.mesh(parent, taper ? 'cone' : 'shaft', color, [0, 0, 0], [1, 1, 1]);
    this.placeSegment(mesh, a, b, radius); return mesh;
  }
  placeSegment(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, radius: number): void {
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.scale.set(radius, Math.max(.001, a.distanceTo(b)), radius);
    mesh.quaternion.setFromUnitVectors(UP, direction.subVectors(b, a).normalize());
  }
  /** Merge rigid details per articulated part, preserving its own transform. */
  batch(parent: THREE.Object3D): void {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...parent.children]) if (child instanceof THREE.Mesh && !child.userData.articulated) {
      const material = child.material as THREE.Material;
      const group = groups.get(material) ?? []; group.push(child); groups.set(material, group);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const parts = meshes.map(mesh => { mesh.updateMatrix();
        const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return geometry.applyMatrix4(mesh.matrix); });
      const geometry = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!geometry) continue;
      const batch = new THREE.Mesh(geometry, material); batch.castShadow = true; batch.receiveShadow = true;
      for (const mesh of meshes) mesh.removeFromParent(); parent.add(batch);
    }
  }
}
const UP = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
