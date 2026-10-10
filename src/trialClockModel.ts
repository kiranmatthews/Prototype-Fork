import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';

export const TRIAL_CLOCK_MODEL_PATH = 'props/trial-clock/neon-trial-timer.glb';
export const TRIAL_CLOCK_MODEL_HEIGHT = 1.65;
export interface TrialClockVisual { ready: Promise<void>; dispose(): void }
type ClockMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

function releaseModel(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  disposeTextures(textures);
}

const models = new AssetCache<string, THREE.Group>(async (_key, _dependency, wanted) => {
  const gltf = await sceneryLoads.run(() => new GLTFLoader().loadAsync(import.meta.env.BASE_URL + TRIAL_CLOCK_MODEL_PATH), wanted);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) {
    releaseModel(model);
    throw new Error('Trial clock model has no finite surface');
  }
  const scale = TRIAL_CLOCK_MODEL_HEIGHT / size.y;
  model.scale.setScalar(scale);
  model.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-scale);
  model.position.y += .2; // fit the existing hovering stopwatch and pickup box
  model.name = 'Neon trial timer · Meshy';
  model.traverse(object => {
    const mesh = object as ClockMesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.geometry.userData.shared = true; // the cache owns GPU lifetime
    mesh.material.userData.shared = true;
    mesh.material.userData.levelDepthFade = false;
    if (mesh.material.map) {
      mesh.material.map.userData.shared = true;
      mesh.material.map.anisotropy = 8;
    }
  });
  return model;
}, releaseModel);

/** Replace only the art inside the live pickup; never change its visibility or box. */
export function attachTrialClockModel(root: THREE.Group): TrialClockVisual {
  const assets = models.scope();
  let disposed = false;
  root.name = 'Time-trial clock';
  root.userData.trialClockAsset = 'loading';
  const ready = assets.load(TRIAL_CLOCK_MODEL_PATH).then(template => {
    if (disposed) return;
    const model = template.clone(true);
    model.traverse(object => { object.userData.editorIdx = root.userData.editorIdx; });
    releaseModel(root); // retire the old procedural face, materials and geometry
    root.clear();
    root.add(model);
    root.userData.trialClockAsset = 'ready';
  }).catch(error => {
    if (disposed) return;
    root.userData.trialClockAsset = 'fallback';
    const response = (error as { response?: { url?: string } }).response;
    if (!response || response.url) console.warn('Trial clock model unavailable; retaining its procedural artwork', error);
  });
  return { ready, dispose() { disposed = true; assets.dispose(); } };
}
