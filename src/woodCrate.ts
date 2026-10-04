import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface WoodCrate {
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  visual: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>;
  ready: Promise<void>;
  hitsRemaining: number;
  multiHit: boolean;
  pending: boolean;
  runDress: boolean;
  disposed: boolean;
  assetsLoaded: boolean;
  template: Template;
}
interface Template { geometry: THREE.BufferGeometry; materials: THREE.MeshLambertMaterial[] }
const proxies = new Map<number, THREE.BoxGeometry>();
let fallback: Template | undefined;
let texture: THREE.CanvasTexture | undefined;
let loading: Promise<Template> | undefined;
function shared<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(resource: T): T {
  resource.userData.shared = true;
  resource.userData.levelDepthFade = false;
  return resource;
}

/** Wood faces for loading, failed downloads, and numbered run-mode boxes. */
export function woodCrateTexture(): THREE.CanvasTexture {
  if (texture) return texture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ac7035'; ctx.fillRect(0, 0, 128, 128);
  for (let plank = 0; plank < 4; plank++) {
    ctx.fillStyle = ['#bd8242', '#c38a48', '#b87c3b', '#c18a49'][plank];
    ctx.fillRect(10, 10 + plank * 27, 108, 26);
    ctx.strokeStyle = '#99612e'; ctx.lineWidth = 1;
    for (let grain = 0; grain < 3; grain++) {
      const y = 17 + plank * 27 + grain * 7;
      ctx.beginPath(); ctx.moveTo(13, y); ctx.bezierCurveTo(45, y - 3, 78, y + 3, 115, y); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#674021'; ctx.lineWidth = 16;
  ctx.strokeRect(8, 8, 112, 112);
  ctx.beginPath(); ctx.moveTo(13, 13); ctx.lineTo(115, 115); ctx.moveTo(115, 13); ctx.lineTo(13, 115); ctx.stroke();
  ctx.strokeStyle = '#d49a52'; ctx.lineWidth = 10; ctx.stroke();
  ctx.strokeStyle = '#c99550'; ctx.lineWidth = 9; ctx.strokeRect(8, 8, 112, 112);
  ctx.fillStyle = '#453629';
  for (const x of [8, 120]) for (const y of [8, 120]) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); }
  texture = shared(new THREE.CanvasTexture(canvas));
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2;
  return texture;
}
function materials(map: THREE.Texture): THREE.MeshLambertMaterial[] {
  // Reinforced boxes become slightly weathered as their five hits are spent.
  return [0xffffff, 0xa88361, 0xb79470, 0xc7a27c, 0xd8af85, 0xe9bd8e, 0xffd49c].map(color =>
    shared(new THREE.MeshLambertMaterial({ map, color })));
}
function fallbackTemplate(): Template {
  return fallback ??= { geometry: shared(new THREE.BoxGeometry(1, 1, 1)), materials: materials(woodCrateTexture()) };
}
function template(): Promise<Template> {
  return loading ??= new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/wood-crate/classic-wood-crate.glb`).then(gltf => {
    gltf.scene.updateMatrixWorld(true);
    const pieces: THREE.BufferGeometry[] = [];
    let map: THREE.Texture | null = null;
    gltf.scene.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      map ??= material.map;
      const piece = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      for (const name of Object.keys(piece.attributes)) if (!['position', 'normal', 'uv'].includes(name)) piece.deleteAttribute(name);
      pieces.push(piece); mesh.geometry.dispose(); material.dispose();
    });
    if (!pieces.length || !map) throw new Error('Wood crate GLB needs textured geometry');
    const geometry = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose());
    geometry.clearGroups(); geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!, center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z); geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); shared(geometry);
    const diffuse = map as THREE.Texture; shared(diffuse); diffuse.anisotropy = 2;
    return { geometry, materials: materials(diffuse) };
  });
}
export function setWoodCrateState(crate: WoodCrate, hitsRemaining: number, pending = false, runDress = false): void {
  crate.hitsRemaining = hitsRemaining; crate.pending = pending; crate.runDress = runDress;
  crate.visual.visible = !pending && !runDress;
  crate.body.material.visible = pending || runDress;
  const index = crate.multiHit ? THREE.MathUtils.clamp(Math.ceil(hitsRemaining) + 1, 1, 6) : 0;
  crate.visual.material = crate.template.materials[index];
}
export function createWoodCrate(size = .96, multiHit = false): WoodCrate {
  const initial = fallbackTemplate();
  let proxy = proxies.get(size);
  if (!proxy) { proxy = shared(new THREE.BoxGeometry(size, size, size)); proxies.set(size, proxy); }
  const body = new THREE.Mesh(proxy, new THREE.MeshLambertMaterial({ map: woodCrateTexture(), color: 0xffffff, visible: false }));
  body.name = multiHit ? 'Five-hit wood crate' : 'Classic wood crate';
  const visual = new THREE.Mesh(initial.geometry, initial.materials[multiHit ? 6 : 0]);
  visual.name = 'Meshy classic wood crate'; visual.scale.setScalar(size); visual.castShadow = visual.receiveShadow = true;
  body.add(visual);
  const crate: WoodCrate = { body, visual, ready: Promise.resolve(), hitsRemaining: multiHit ? 5 : 1, multiHit,
    pending: false, runDress: false, disposed: false, assetsLoaded: false, template: initial };
  setWoodCrateState(crate, crate.hitsRemaining);
  crate.ready = template().then(asset => {
    if (crate.disposed) return;
    crate.template = asset; visual.geometry = asset.geometry; crate.assetsLoaded = true;
    setWoodCrateState(crate, crate.hitsRemaining, crate.pending, crate.runDress);
  }).catch(error => { if (!crate.disposed) console.warn('Wood crate GLB load failed; retaining playable wood fallback', error); });
  return crate;
}
export function disposeWoodCrate(crate: WoodCrate): void { crate.disposed = true; }
