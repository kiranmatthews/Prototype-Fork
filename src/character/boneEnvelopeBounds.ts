import * as THREE from 'three';

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
interface Envelope {
  geometry: THREE.BufferGeometry;
  attributes: Attribute[];
  versions: number[];
  bind: number[];
  relative: boolean;
  bones: THREE.Box3[];
  morphs: THREE.Box3[][];
  valid: boolean;
}
const version = (a: Attribute) => 'version' in a ? a.version : a.data.version;
// Matrix inversion commonly produces 1 +/- an ulp in w. Those ordinary affine
// skins must not fall back to a full scan on alternating tumble orientations.
const affine = (m: THREE.Matrix4) => m.elements[3] === 0 && m.elements[7] === 0 && m.elements[11] === 0 && Math.abs(m.elements[15] - 1) < 1e-12;

/** Conservative posed skin bounds in O(bones × morphs), independent of vertex
 * count. A normalized, nonnegative skin is a convex blend of its influenced
 * bone points, hence lies inside their union. Used only for intact knockdowns;
 * ordinary attacks retain the exact silhouette. */
export class BoneEnvelopeBounds {
  private readonly cache = new WeakMap<THREE.SkinnedMesh, Envelope>();
  private readonly point = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly box = new THREE.Box3();
  private readonly matrix = new THREE.Matrix4();
  private readonly base = new THREE.Matrix4();
  private readonly result = new THREE.Box3();

  measure(mesh: THREE.SkinnedMesh): THREE.Box3 | null {
    if (mesh.getVertexPosition !== THREE.SkinnedMesh.prototype.getVertexPosition ||
      !affine(mesh.bindMatrix) || !affine(mesh.bindMatrixInverse)) return null;
    const geometry = mesh.geometry, positions = geometry.getAttribute('position');
    const indices = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
    if (!positions || !indices || !weights) return null;
    const morphs = geometry.morphAttributes.position ?? [];
    let cached = this.cache.get(mesh);
    let stale = !cached || cached.geometry !== geometry || cached.relative !== geometry.morphTargetsRelative ||
      cached.bones.length !== mesh.skeleton.bones.length || cached.attributes.length !== morphs.length + 3;
    if (cached && !stale) {
      for (let i = 0; i < cached.attributes.length; i++) {
        const a = i === 0 ? positions : i === 1 ? indices : i === 2 ? weights : morphs[i - 3];
        if (a !== cached.attributes[i] || version(a) !== cached.versions[i]) { stale = true; break; }
      }
      for (let i = 0; i < 16; i++) if (cached.bind[i] !== mesh.bindMatrix.elements[i]) stale = true;
    }
    if (stale) {
      const attributes = [positions, indices, weights, ...morphs];
      const boxes = () => mesh.skeleton.bones.map(() => new THREE.Box3());
      cached = { geometry, attributes, versions: attributes.map(version), bind: [...mesh.bindMatrix.elements],
        relative: geometry.morphTargetsRelative, bones: boxes(), morphs: morphs.map(boxes), valid: true };
      for (let v = 0; v < positions.count; v++) {
        this.point.fromBufferAttribute(positions, v).applyMatrix4(mesh.bindMatrix);
        let total = 0;
        for (let c = 0; c < 4; c++) {
          const weight = weights.getComponent(v, c), bone = indices.getComponent(v, c);
          total += weight;
          if (weight < 0 || !Number.isFinite(weight) || weight > 0 && !cached.bones[bone]) { cached.valid = false; break; }
          if (weight === 0) continue;
          cached.bones[bone].expandByPoint(this.point);
          for (let m = 0; m < morphs.length; m++) {
            this.delta.fromBufferAttribute(morphs[m], v);
            if (!geometry.morphTargetsRelative) this.delta.sub(this.point.fromBufferAttribute(positions, v));
            const b = mesh.bindMatrix.elements, x = this.delta.x, y = this.delta.y, z = this.delta.z;
            this.delta.set(b[0] * x + b[4] * y + b[8] * z, b[1] * x + b[5] * y + b[9] * z, b[2] * x + b[6] * y + b[10] * z);
            cached.morphs[m][bone].expandByPoint(this.delta);
            this.point.fromBufferAttribute(positions, v).applyMatrix4(mesh.bindMatrix);
          }
        }
        if (Math.abs(total - 1) > 1e-5) cached.valid = false;
      }
      this.cache.set(mesh, cached);
    }
    if (!cached!.valid) return null;
    this.result.makeEmpty();
    // Compute mesh-local boxes for the existing transform and sparse-support
    // pruning paths. Attached bind inverses follow the current root each step.
    for (let bone = 0; bone < cached!.bones.length; bone++) {
      if (cached!.bones[bone].isEmpty()) continue;
      if (!affine(mesh.skeleton.bones[bone].matrixWorld) || !affine(mesh.skeleton.boneInverses[bone])) return null;
      this.box.copy(cached!.bones[bone]);
      for (let m = 0; m < morphs.length; m++) {
        const influence = mesh.morphTargetInfluences?.[m] ?? 0;
        if (!Number.isFinite(influence)) return null;
        const d = cached!.morphs[m][bone];
        this.box.min.addScaledVector(influence >= 0 ? d.min : d.max, influence);
        this.box.max.addScaledVector(influence >= 0 ? d.max : d.min, influence);
      }
      this.base.multiplyMatrices(mesh.skeleton.bones[bone].matrixWorld, mesh.skeleton.boneInverses[bone]);
      this.matrix.multiplyMatrices(mesh.bindMatrixInverse, this.base);
      this.result.union(this.box.applyMatrix4(this.matrix));
    }
    // Allow roundoff in normalized float skin weights without shrinking the
    // silhouette, including large characters and translated parent frames.
    this.result.expandByScalar(1e-4);
    return (mesh.boundingBox ??= new THREE.Box3()).copy(this.result);
  }
}
