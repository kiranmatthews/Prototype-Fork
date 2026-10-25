import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';
import { isGraphicsReset } from './lostGraphicsResources';

type BeaconKind = 'arrival' | 'finish';

function releaseModel(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      for (const value of Object.values(material))
        if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  disposeTextures(textures);
}

const models = new AssetCache<BeaconKind, THREE.Group>(async (kind, _dependency, wanted) => {
  const gltf = await sceneryLoads.run(() => new GLTFLoader().loadAsync(
    `${import.meta.env.BASE_URL}props/beacon-platforms/${kind}.glb`), wanted);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0)) {
    releaseModel(model);
    throw new Error('Beacon platform needs a finite closed surface');
  }
  // Baked assets use the existing pad's metre-space footprint and deck plane.
  model.name = `Meshy ${kind} beacon platform`;
  model.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.visualOnly = true;
    mesh.geometry.userData.shared = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.shared = true;
      material.userData.levelDepthFade = false;
      for (const value of Object.values(material)) {
        const texture = value as THREE.Texture;
        if (!texture?.isTexture) continue;
        texture.userData.shared = true;
        texture.anisotropy = 8;
      }
    }
  });
  return model;
}, releaseModel);

/** Keep all authored collision/finish flags on the original three flat solids. */
export function attachBeaconPlatform(group: THREE.Group, solids: THREE.Mesh[], arrival: boolean): Promise<void> {
  const kind: BeaconKind = arrival ? 'arrival' : 'finish';
  const assets = models.scope();
  let disposed = false;
  group.userData.beaconPlatform = kind;
  group.userData.beaconPlatformState = 'loading';
  // Level owns the collider geometry; previews call WarpPad.dispose(). Both
  // release this lease, including when a download completes after a level exit.
  const owner = solids[0].geometry;
  const dispose = (event: { type: string; graphicsReset?: boolean }): void => {
    if (isGraphicsReset(event) || disposed) return;
    disposed = true;
    owner.removeEventListener('dispose', dispose);
    group.userData.beaconPlatformState = 'disposed';
    assets.dispose();
  };
  owner.addEventListener('dispose', dispose);
  return assets.load(kind).then(template => {
    if (disposed) return;
    const artwork = template.clone(true);
    artwork.traverse(object => { object.userData.editorIdx = group.userData.editorIdx; });
    group.add(artwork);
    // Material visibility preserves raycasts, editor ownership and finish
    // eligibility; setting Mesh.visible=false would hide the collision owner.
    for (const solid of solids)
      for (const material of Array.isArray(solid.material) ? solid.material : [solid.material]) material.visible = false;
    group.userData.beaconPlatformState = 'ready';
  }).catch(error => {
    if (disposed) return;
    group.userData.beaconPlatformState = 'fallback';
    const response = (error as { response?: { url?: string } }).response;
    if (!response || response.url) console.warn('Beacon platform unavailable; retaining supported stone fallback', error);
  });
}
