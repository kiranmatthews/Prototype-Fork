import * as THREE from 'three';

// Each of these joints can leave the skeleton in a native Bone Man wipeout.
const detachable = new Set(['hips', 'torso-root', 'head', ...['left', 'right'].flatMap(side =>
  ['shoulder', 'wrist', 'knee'].map(segment => `${segment}-${side}`))]);
const cache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Preserve the entire surface. During a modular wipeout, a triangle must belong to one
 * fragment, or its weights would draw a long ribbon between two airborne pieces. */
export function wipeoutSurface(source: THREE.SkinnedMesh): THREE.BufferGeometry {
  const original = source.geometry;
  const cached = cache.get(original);
  if (cached) return cached;
  const joints = original.getAttribute('skinIndex');
  const weights = original.getAttribute('skinWeight');
  const owner = source.skeleton.bones.map(bone => {
    let cursor: THREE.Object3D | null = bone;
    while (cursor && !detachable.has(cursor.name)) cursor = cursor.parent;
    return cursor?.name ?? 'hips';
  });
  const ownerAt = (vertex: number, influence: number) => owner[joints.getComponent(vertex, influence)];
  const ownersInMesh = new Set<string>();
  for (let v = 0; v < weights.count; v++) for (let k = 0; k < 4; k++) {
    if (weights.getComponent(v, k) > 0) ownersInMesh.add(ownerAt(v, k));
  }
  if (ownersInMesh.size < 2) { cache.set(original, original); return original; }

  const originalIndices = original.getIndex();
  const count = originalIndices?.count ?? weights.count;
  const indices: number[] = [], vertices: number[] = [], pieceJoints: number[] = [], pieceWeights: number[] = [];
  const remap = new Map<string, number>();
  for (let i = 0; i < count; i += 3) {
    const face = [0, 1, 2].map(offset => originalIndices?.getX(i + offset) ?? i + offset);
    const sums = new Map<string, number>();
    let chosen = '', best = 0;
    for (const v of face) for (let k = 0; k < 4; k++) {
      const weight = weights.getComponent(v, k);
      if (!weight) continue;
      const piece = ownerAt(v, k), sum = (sums.get(piece) ?? 0) + weight;
      sums.set(piece, sum);
      if (sum > best) { chosen = piece; best = sum; }
    }
    let fallback = 0, fallbackWeight = 0;
    for (const v of face) for (let k = 0; k < 4; k++) {
      const w = weights.getComponent(v, k);
      if (w > fallbackWeight && ownerAt(v, k) === chosen) { fallbackWeight = w; fallback = joints.getComponent(v, k); }
    }
    for (const v of face) {
      const key = `${v}/${chosen}`;
      let index = remap.get(key);
      if (index === undefined) {
        remap.set(key, index = vertices.length);
        vertices.push(v);
        const kept = [0, 1, 2, 3].map(k => ownerAt(v, k) === chosen ? weights.getComponent(v, k) : 0);
        const total = kept.reduce((a, b) => a + b, 0);
        for (let k = 0; k < 4; k++) {
          pieceJoints.push(total ? joints.getComponent(v, k) : fallback);
          pieceWeights.push(total ? kept[k] / total : Number(k === 0));
        }
      }
      indices.push(index);
    }
  }
  const copy = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
    const values = new Float32Array(vertices.length * attribute.itemSize);
    vertices.forEach((v, i) => { for (let k = 0; k < attribute.itemSize; k++) values[i * attribute.itemSize + k] = attribute.getComponent(v, k); });
    return new THREE.BufferAttribute(values, attribute.itemSize);
  };
  const geometry = new THREE.BufferGeometry();
  geometry.name = `${original.name} / detached`;
  geometry.setIndex(indices);
  for (const [name, attribute] of Object.entries(original.attributes)) {
    if (name !== 'skinIndex' && name !== 'skinWeight') geometry.setAttribute(name, copy(attribute));
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(pieceJoints, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(pieceWeights, 4));
  geometry.morphTargetsRelative = original.morphTargetsRelative;
  if (original.morphAttributes.position) geometry.morphAttributes.position = original.morphAttributes.position.map(copy);
  cache.set(original, geometry);
  return geometry;
}
