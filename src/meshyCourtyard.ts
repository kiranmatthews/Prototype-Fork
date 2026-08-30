import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const MESHY_COURTYARD_PATH = "meshy/ancient-stone-courtyard.glb";
export const MESHY_COURTYARD_UNIT_BOTTOM = 0.04 / 11.52;

let template: THREE.Group | null = null;
let started = false;
let settled: (() => void) | null = null;
const pending = new Set<THREE.Group>();
const pickGeometry = new THREE.BoxGeometry(1, 0.3037, 1);
const pickMaterial = new THREE.MeshBasicMaterial({
  color: 0x8fb5a0,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});
pickGeometry.userData.shared = true;
pickMaterial.userData.shared = true;

/** Resolves after the compressed owner-supplied Meshy model loads or fails. */
export const meshyCourtyardReady = new Promise<void>((resolve) => {
  settled = resolve;
});

function markShared(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.geometry.userData.shared = true;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    for (const material of materials) {
      material.userData.shared = true;
      for (const value of Object.values(material)) {
        const texture = value as THREE.Texture | null;
        if (texture?.isTexture) {
          texture.userData.shared = true;
          texture.anisotropy = 8;
        }
      }
    }
  });
}

function install(target: THREE.Group): void {
  if (!template || target.userData.meshyCourtyardReleased) return;
  const visual = template.clone(true);
  visual.position.y = MESHY_COURTYARD_UNIT_BOTTOM;
  target.add(visual);
  target.userData.assetReady = true;
}

function load(): void {
  if (started) return;
  started = true;
  new GLTFLoader().load(
    import.meta.env.BASE_URL + MESHY_COURTYARD_PATH,
    (gltf) => {
      template = gltf.scene;
      template.name = "AncientStoneCourtyard_Meshy_WebTemplate";
      markShared(template);
      for (const target of pending) install(target);
      pending.clear();
      settled?.();
    },
    undefined,
    (error) => {
      for (const target of pending) target.userData.assetError = true;
      pending.clear();
      // Node validators intentionally answer asset fetches with an empty-URL
      // 404. Keep that expected harness path quiet; a real served 404 remains
      // visible in the browser console.
      const responseUrl = (error as { response?: { url?: string } }).response?.url;
      if (responseUrl)
        console.warn("Meshy courtyard presentation failed to load", error);
      settled?.();
    },
  );
}

/**
 * Return a lightweight instance root immediately. Collision stays in level
 * primitives; this group is upgraded with shared GLB geometry when ready.
 */
export function createMeshyCourtyardVisual(): THREE.Group {
  const root = new THREE.Group();
  root.name = "AncientStoneCourtyard_Meshy_Presentation";
  root.userData.assetReady = false;
  const pickBounds = new THREE.Mesh(pickGeometry, pickMaterial);
  pickBounds.name = "AncientStoneCourtyard_EditorBounds";
  pickBounds.position.y = 0.3037 * 0.5 + MESHY_COURTYARD_UNIT_BOTTOM;
  pickBounds.visible = false;
  pickBounds.userData.editorGhost = true;
  root.add(pickBounds);
  if (template) install(root);
  else {
    pending.add(root);
    load();
  }
  return root;
}

/** Stop a disposed level root from receiving a late async model attachment. */
export function releaseMeshyCourtyard(root: THREE.Group): void {
  root.userData.meshyCourtyardReleased = true;
  pending.delete(root);
}
