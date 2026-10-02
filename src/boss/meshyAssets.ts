import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AssetCache, disposeTextures } from '../assetLifetime';
import { sceneryLoads } from '../assetLoadQueue';

export const chiefAssets = new AssetCache<string, GLTF>(async (url, _dependency, wanted) => {
  const gltf = await sceneryLoads.run(() => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url), wanted);
  gltf.scene.traverse(node => {
    const mesh = node as THREE.Mesh; if (!mesh.isMesh) return;
    mesh.geometry.userData.shared = true;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      material.userData.shared = true;
      for (const value of Object.values(material)) if (value?.isTexture) value.userData.shared = true;
    }
  });
  return gltf;
}, gltf => {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  gltf.scene.traverse(node => {
    const mesh = node as THREE.SkinnedMesh; if (!mesh.isMesh) return;
    geometries.add(mesh.geometry); if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  });
  for (const material of materials) { for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); material.dispose(); }
  for (const geometry of geometries) geometry.dispose(); disposeTextures(textures);
});
export const bossAssetUrl = (file: string) => `${import.meta.env.BASE_URL}boss/${file}`;
