import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface CrateFragment {
  exterior: THREE.BufferGeometry;
  interior: THREE.BufferGeometry;
  center: THREE.Vector3;
  halfSize: THREE.Vector3;
}
const shared = <T extends THREE.BufferGeometry>(value: T): T => {
  value.userData.shared = true; value.userData.levelDepthFade = false; return value;
};

export function cratePartGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  if (g.index) { const indexed = g; g = g.toNonIndexed(); indexed.dispose(); }
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  if (!g.hasAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  g.clearGroups(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
export function mergeCrateParts(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (!pieces.length) {
    const empty = new THREE.BufferGeometry();
    for (const [key, size] of [['position', 3], ['normal', 3], ['uv', 2]] as const)
      empty.setAttribute(key, new THREE.Float32BufferAttribute([], size));
    return shared(empty);
  }
  const g = mergeGeometries(pieces)!; pieces.forEach(p => p.dispose());
  g.computeBoundingBox(); g.computeBoundingSphere(); return shared(g);
}


/** Preserve exterior UVs and keep the authored cut surfaces in their own draw. */
export function readCrateFragments(root: THREE.Object3D): CrateFragment[] {
  const byName = new Map<string, { exterior: THREE.BufferGeometry[]; interior: THREE.BufferGeometry[] }>();
  root.traverse(node => {
    if (!(node as THREE.Mesh).isMesh) return;
    const mesh = node as THREE.Mesh;
    let owner: THREE.Object3D | null = node;
    while (owner && !/^fragment_\d+/.test(owner.name)) owner = owner.parent;
    if (!owner) return;
    const key = owner.name.match(/^fragment_\d+/)![0];
    let bucket = byName.get(key); if (!bucket) byName.set(key, bucket = { exterior: [], interior: [] });
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (meshMaterials.length === 1) {
      const target = meshMaterials[0].name.includes('Fresh split') ? bucket.interior : bucket.exterior;
      target.push(cratePartGeometry(mesh));
    } else {
      // GLTF primitives are usually separate meshes. Handle a grouped export
      // too, so material groups cannot silently lose their fresh cut faces.
      for (const group of mesh.geometry.groups) {
        const raw = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
        const part = new THREE.BufferGeometry();
        for (const key of ['position', 'normal', 'uv']) {
          const a = raw.getAttribute(key); if (!a) continue;
          part.setAttribute(key, new THREE.Float32BufferAttribute(Array.from(a.array).slice(group.start * a.itemSize, (group.start + group.count) * a.itemSize), a.itemSize));
        }
        part.applyMatrix4(mesh.matrixWorld);
        (meshMaterials[group.materialIndex ?? 0].name.includes('Fresh split') ? bucket.interior : bucket.exterior).push(part);
        if (raw !== mesh.geometry) raw.dispose();
      }
    }
  });
  const fragments = [...byName].sort(([a], [b]) => a.localeCompare(b)).map(([, bucket]) => {
    const exterior = mergeCrateParts(bucket.exterior), interior = mergeCrateParts(bucket.interior);
    const bounds = new THREE.Box3();
    if (exterior.boundingBox) bounds.union(exterior.boundingBox);
    if (interior.boundingBox) bounds.union(interior.boundingBox);
    return { exterior, interior, center: bounds.getCenter(new THREE.Vector3()), halfSize: bounds.getSize(new THREE.Vector3()).multiplyScalar(.5) };
  });
  if (fragments.length < 12) throw new Error(`Incomplete crate fracture: ${fragments.length} pieces`);
  return fragments;
}
