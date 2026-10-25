import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';

const url = import.meta.env.BASE_URL + 'rooftop-kook/storm-case.glb';
const textures = (material: THREE.Material): THREE.Texture[] =>
  Object.values(material).filter((value): value is THREE.Texture => !!value?.isTexture);
const cache = new AssetCache<string, { scene: THREE.Group; bounds: THREE.Box3 }>(async (_key, _dependency, wanted) => {
  const gltf = await sceneryLoads.run(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url), wanted);
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(n => Number.isFinite(n) && n > 0)) throw Error('Meshy flight case has invalid bounds');
  gltf.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    mesh.castShadow = mesh.receiveShadow = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.shared = true;
      for (const texture of textures(material)) { texture.userData.shared = true; texture.anisotropy = 8; }
    }
  });
  return { scene: gltf.scene, bounds };
}, asset => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), maps = new Set<THREE.Texture>();
  asset.scene.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) { for (const texture of textures(material)) maps.add(texture); material.dispose(); }
  for (const geometry of geometries) geometry.dispose();
  disposeTextures(maps);
});

export interface StormCase {
  ready: Promise<void>;
  loaded: boolean;
  visual: THREE.Group;
  setPending(pending: boolean): void;
  dispose(): void;
}

/** Borrow the complete Meshy model. The original box owns contacts, stacking,
 * falling and gunfire cover; artwork follows it as a child at every distance. */
export function dressStormCase(body: THREE.Mesh, size = .96): StormCase {
  const lease = cache.acquire('storm-case'), visual = new THREE.Group();
  visual.name = 'Meshy yacht-club catering flight case';
  const fallback = Array.isArray(body.material) ? body.material : [body.material];
  let disposed = false;
  body.add(visual);
  const result: StormCase = {
    loaded: false, visual, ready: Promise.resolve(),
    setPending(pending) { visual.visible = !pending; },
    dispose() { if (disposed) return; disposed = true; visual.removeFromParent(); lease.release(); },
  };
  result.ready = lease.promise.then(asset => {
    if (disposed) return;
    const span = asset.bounds.getSize(new THREE.Vector3()), center = asset.bounds.getCenter(new THREE.Vector3());
    visual.scale.set(size / span.x, size / span.y, size / span.z);
    visual.position.copy(center).multiply(visual.scale).negate();
    visual.add(asset.scene.clone(true));
    // Hide only the original solid face; outline crates retain their separate ghost material.
    for (const material of fallback) material.visible = false;
    result.loaded = true;
  }).catch(error => { if (!disposed) console.warn('Meshy flight case unavailable; retaining the playable metal box', error); });
  return result;
}
