import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface SpinSmearSettings {
  sweepDegrees: number;
  twistDegrees: number;
  radialScale: number;
  heightScale: number;
  flare: number;
  distortion: number;
  falloff: number;
  trailCopies: number;
  trailSpreadDegrees: number;
  trailOpacity: number;
}

export const DEFAULT_SPIN_SMEAR: Readonly<SpinSmearSettings> = Object.freeze({
  sweepDegrees: 210, twistDegrees: 100, radialScale: 1.45,
  heightScale: .88, flare: .2, distortion: .12, falloff: 1.25,
  trailCopies: 7, trailSpreadDegrees: 180, trailOpacity: .38,
});

export const SPIN_SMEAR_CONTROLS: ReadonlyArray<{
  key: keyof SpinSmearSettings; label: string; min: number; max: number; step: number;
}> = [
  { key: 'sweepDegrees', label: 'Radial smear', min: -360, max: 360, step: 1 },
  { key: 'twistDegrees', label: 'Height twist', min: -360, max: 360, step: 1 },
  { key: 'radialScale', label: 'Radial stretch', min: .5, max: 2.5, step: .01 },
  { key: 'heightScale', label: 'Height', min: .45, max: 1.5, step: .01 },
  { key: 'flare', label: 'Waist flare', min: -.4, max: .8, step: .01 },
  { key: 'distortion', label: '3D distortion', min: 0, max: .45, step: .01 },
  { key: 'falloff', label: 'Smear falloff', min: .3, max: 3, step: .01 },
  { key: 'trailCopies', label: 'Blur copies', min: 1, max: 12, step: 1 },
  { key: 'trailSpreadDegrees', label: 'Blur angular spread', min: 0, max: 360, step: 1 },
  { key: 'trailOpacity', label: 'Blur trail opacity', min: .02, max: 1, step: .01 },
];

export function normalizeSpinSmear(value: unknown): SpinSmearSettings {
  const raw = value && typeof value === 'object' ? value as Partial<SpinSmearSettings> : {};
  const result = { ...DEFAULT_SPIN_SMEAR };
  for (const { key, min, max } of SPIN_SMEAR_CONTROLS) {
    const n = raw[key];
    if (typeof n === 'number' && Number.isFinite(n)) result[key] = THREE.MathUtils.clamp(n, min, max);
  }
  result.trailCopies = Math.round(result.trailCopies);
  return result;
}

function surfaceMaterial(material: THREE.Material): THREE.Material {
  // Bake the rendered colour/texture into an ordinary exportable material.
  // Character batch shaders and skeleton uniforms never enter the snapshot.
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshBasicMaterial)
    return material.clone();
  const source = material as THREE.MeshLambertMaterial;
  return new THREE.MeshStandardMaterial({
    color: source.color ?? 0xffffff, map: source.map ?? null,
    emissive: source.emissive ?? 0x000000, emissiveMap: source.emissiveMap ?? null,
    emissiveIntensity: source.emissiveIntensity ?? 1,
    roughness: 1, metalness: 0, side: source.side,
    transparent: source.transparent, opacity: source.opacity,
    alphaTest: source.alphaTest, depthWrite: source.depthWrite,
    vertexColors: source.vertexColors,
  });
}

/** Freeze the current posed surface, including skinning and morph targets. */
export function captureSpinCharacter(
  rider: THREE.Object3D,
  reference: THREE.Object3D,
  scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
): THREE.Group {
  reference.updateWorldMatrix(true, true);
  const inverse = reference.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const result = new THREE.Group();
  result.name = 'CurrentCharacter_StaticSurface';
  rider.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object.userData.characterRenderProxy) return;
    const position = object.geometry.getAttribute('position');
    if (!position || !position.count) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
    const geometry = object.geometry.clone();
    const vertices = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      object.getVertexPosition(i, point).applyMatrix4(matrix).multiply(scale);
      point.toArray(vertices, i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.deleteAttribute('tangent');
    geometry.morphAttributes = {};
    // Flattened reflected limbs must retain outward-facing triangles.
    if (matrix.determinant() * scale.x * scale.y * scale.z < 0) {
      const index = geometry.index ?? new THREE.BufferAttribute(
        Uint32Array.from({ length: position.count }, (_, i) => i), 1);
      for (let i = 0; i + 2 < index.count; i += 3) {
        const second = index.getX(i + 1);
        index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, second);
      }
      geometry.setIndex(index);
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const materials = Array.isArray(object.material)
      ? object.material.map(surfaceMaterial) : surfaceMaterial(object.material);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.name = object.name || 'character-surface';
    mesh.renderOrder = object.renderOrder;
    result.add(mesh);
  });
  if (!result.children.length) throw new Error('The current character has no visible surface to bake.');
  return result;
}

/** Owned static vertices; textures remain shared with the source/cache. */
export function cloneSpinModel(source: THREE.Group): THREE.Group {
  const result = source.clone(true);
  result.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material)
      ? object.material.map(material => material.clone()) : object.material.clone();
  });
  return result;
}

/** Cylindrical shear, twist, volume ripples and overlapping rotated copies
 * baked once into real vertices. Runtime only rotates this fixed sculpture. */
export function bakeSpinSmear(source: THREE.Group, value: Readonly<SpinSmearSettings>): THREE.Group {
  const settings = normalizeSpinSmear(value);
  const result = cloneSpinModel(source);
  result.name = 'CurrentCharacter_BakedRadialSmear';
  const bounds = new THREE.Box3().setFromObject(source, true);
  const height = Math.max(.01, bounds.max.y - bounds.min.y);
  const radius = Math.max(.01, Math.hypot(
    Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
    Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
  ));
  const sweep = THREE.MathUtils.degToRad(settings.sweepDegrees);
  const twist = THREE.MathUtils.degToRad(settings.twistDegrees);
  result.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      const r = Math.hypot(x, z), h = (y - bounds.min.y) / height;
      const radial = Math.min(1, r / radius), theta = Math.atan2(z, x);
      const angle = theta + sweep * Math.pow(radial, settings.falloff) + twist * (h - .5);
      const ripple = Math.sin(theta * 3 + h * Math.PI * 4);
      const outRadius = r * settings.radialScale *
        (1 + settings.flare * Math.sin(h * Math.PI) + settings.distortion * ripple);
      position.setXYZ(i, Math.cos(angle) * outRadius,
        (y - bounds.min.y) * settings.heightScale + settings.distortion * height * .06 * radial * ripple,
        Math.sin(angle) * outRadius);
    }
    position.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
  // Keep the baked feet at the gameplay origin even when ripples move them.
  const bottom = new THREE.Box3().setFromObject(result, true).min.y;
  result.traverse(object => {
    if (object instanceof THREE.Mesh) object.geometry.translate(0, -bottom, 0);
  });
  addRotatedBlurCopies(result, settings);
  result.userData.spinSmear = { version: 1, settings };
  return result;
}

/** Overlapping copies occupy the same 3D volume. Merge each part's trails so
 * copy count increases static vertices rather than multiplying draw calls. */
function addRotatedBlurCopies(model: THREE.Group, settings: SpinSmearSettings): void {
  if (settings.trailCopies <= 1) return;
  const sources: THREE.Mesh[] = [];
  model.traverse(object => { if (object instanceof THREE.Mesh) sources.push(object); });
  const spread = THREE.MathUtils.degToRad(settings.trailSpreadDegrees);
  for (const source of sources) {
    const copies: THREE.BufferGeometry[] = [];
    for (let copy = 1; copy < settings.trailCopies; copy++) {
      const geometry = source.geometry.clone();
      geometry.rotateY(-spread * copy / (settings.trailCopies - 1));
      const oldColor = geometry.getAttribute('color');
      const count = geometry.getAttribute('position').count;
      const colors = new Float32Array(count * 4);
      const fade = Math.pow(1 - copy / settings.trailCopies, .9);
      for (let vertex = 0; vertex < count; vertex++) {
        const offset = vertex * 4;
        colors[offset] = oldColor?.getX(vertex) ?? 1;
        colors[offset + 1] = oldColor?.getY(vertex) ?? 1;
        colors[offset + 2] = oldColor?.getZ(vertex) ?? 1;
        colors[offset + 3] = fade * (oldColor?.itemSize === 4 ? oldColor.getW(vertex) : 1);
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
      copies.push(geometry);
    }
    const geometry = mergeGeometries(copies, false);
    if (!geometry) throw new Error('The rotated blur copies could not be merged.');
    // Retain material groups when the original surface has several materials.
    let offset = 0;
    for (const copy of copies) {
      for (const group of copy.groups) geometry.addGroup(offset + group.start, group.count, group.materialIndex);
      offset += copy.index?.count ?? copy.getAttribute('position').count;
      copy.dispose();
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const trailMaterial = (sourceMaterial: THREE.Material): THREE.Material => {
      const material = sourceMaterial.clone() as THREE.MeshStandardMaterial;
      material.transparent = true;
      material.opacity *= settings.trailOpacity;
      material.vertexColors = true;
      material.depthWrite = false;
      return material;
    };
    const materials = Array.isArray(source.material)
      ? source.material.map(trailMaterial) : trailMaterial(source.material);
    const trail = new THREE.Mesh(geometry, materials);
    trail.name = `${source.name}_RotatedBlurCopies`;
    trail.position.copy(source.position); trail.quaternion.copy(source.quaternion); trail.scale.copy(source.scale);
    trail.renderOrder = source.renderOrder;
    source.parent!.add(trail);
  }
}

export function spinModelStats(root: THREE.Object3D): { meshes: number; vertices: number; triangles: number } {
  let meshes = 0, vertices = 0, triangles = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const count = object.geometry.getAttribute('position')?.count ?? 0;
    vertices += count;
    triangles += (object.geometry.index?.count ?? count) / 3;
  });
  return { meshes, vertices, triangles };
}

export function disposeSpinModel(root: THREE.Object3D, textures = false): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const maps = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      if (textures) for (const value of Object.values(material))
        if (value instanceof THREE.Texture) maps.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const map of maps) map.dispose();
  root.removeFromParent();
}
