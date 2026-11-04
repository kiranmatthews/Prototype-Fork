import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildFruitGeometry, FruitMaterial } from './fruitAssets';
import { cratePartGeometry, mergeCrateParts, readCrateFragments, type CrateFragment } from './crateFragmentAsset';

interface MultihitTemplate {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  fragments: CrateFragment[];
}
let template: MultihitTemplate | undefined;
let loading: Promise<MultihitTemplate> | undefined;
export function currentMultihitCrate(): MultihitTemplate | undefined { return template; }
export function prepareMultihitCrate(): Promise<MultihitTemplate> {
  return loading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}props/crate-family/`;
    const [intact, broken] = await Promise.all([
      loader.loadAsync(`${base}multihit-cage.glb`), loader.loadAsync(`${base}multihit-fracture.glb`),
    ]);
    intact.scene.updateMatrixWorld(true); broken.scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    let surface: THREE.MeshStandardMaterial | undefined;
    intact.scene.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      parts.push(cratePartGeometry(mesh));
      surface ??= (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    });
    if (!surface?.map || !parts.length) throw new Error('Multihit cage needs its complete sculpt and wood texture');
    const material = surface.clone(); material.roughness = .82; material.metalness = 0;
    material.name = 'Multihit cage · open bowed slats and natural timber';
    material.userData.shared = true; material.userData.levelDepthFade = false;
    for (const map of [material.map, material.normalMap, material.roughnessMap])
      if (map) { map.userData.shared = true; map.anisotropy = 8; }
    template = { geometry: mergeCrateParts(parts), material, fragments: readCrateFragments(broken.scene) };
    return template;
  })();
}

// A full authored fruit variant, also used by the world pickups. Five copies
// plus the cage remain within the complete 30k-triangle prop budget.
const fruitGeometry = buildFruitGeometry(3);
const fruitMaterial = new FruitMaterial(); fruitMaterial.userData.shared = true;
export const MULTIHIT_FRUIT_TRIANGLES = (fruitGeometry.index?.count ?? fruitGeometry.getAttribute('position').count) / 3;
const positions = [[-.16,-.16,-.14],[.16,-.16,-.14],[0,-.15,.16],[-.15,.12,.04],[.15,.12,.04]] as const;
const pose = new THREE.Object3D();

export function createMultihitContents(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(fruitGeometry, fruitMaterial, 5);
  mesh.name = 'Five Wumpa fruit · one per remaining hit';
  mesh.userData.editorGhost = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  updateMultihitContents(mesh, 5, 0, 0);
  return mesh;
}
export function updateMultihitContents(mesh: THREE.InstancedMesh, hits: number, pulse: number, time: number): void {
  mesh.count = Math.max(0, Math.min(5, Math.trunc(hits)));
  const age = .38 - pulse;
  const rebound = pulse > 0 ? Math.sin(age * 28) * Math.exp(-age * 12) * .028 : 0;
  for (let i = 0; i < mesh.count; i++) {
    const p = positions[i];
    pose.position.set(p[0], p[1] + rebound * (i < 3 ? .6 : 1), p[2]);
    pose.rotation.set((i - 2) * .055, i * 2.1 + Math.sin(time * 1.2 + i) * .012, (i % 2 ? 1 : -1) * .09);
    pose.scale.setScalar(.40); pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  // Keep the complete contents eligible throughout their small local rebound.
  mesh.boundingSphere = mesh.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), .65);
}
