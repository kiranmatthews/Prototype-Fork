import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildFruitGeometry } from './fruitAssets';
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

// Taut, inflated fruit with uninterrupted cheeks. Keep every source triangle
// and the complete crowns, but author a clean balloon surface for this cage.
// The packing comes from large overlapping volumes, never projected grooves.
const fruitGeometry = buildFruitGeometry(3);
const fruitMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .29,
  metalness: 0, clearcoat: .3, clearcoatRoughness: .24, sheen: .08, sheenColor: 0xffda8c });
fruitMaterial.name = 'Packed fruit · taut waxy skin'; fruitMaterial.userData.shared = true;
export const MULTIHIT_FRUIT_TRIANGLES = (fruitGeometry.index?.count ?? fruitGeometry.getAttribute('position').count) / 3;
const pose = new THREE.Object3D();
const smooth = THREE.MathUtils.smoothstep;
const source = fruitGeometry.getAttribute('position'), part = fruitGeometry.getAttribute('fruitPart');
const uv = fruitGeometry.getAttribute('uv'), colors = fruitGeometry.getAttribute('color');
const green = new THREE.Color('#6ecb22'), yellow = new THREE.Color('#ffd51b');
const orange = new THREE.Color('#ff8612'), red = new THREE.Color('#ed3020'), color = new THREE.Color();
for (let i = 0; i < source.count; i++) {
  if (part.getX(i) === 0) {
    const y = uv.getY(i) * 2 - 1, angle = (uv.getX(i) - .5) * Math.PI * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y)), shoulder = 1 + .06 * y;
    source.setXYZ(i, Math.cos(angle) * radius * .38 * shoulder,
      -.055 + y * .3731 - (y > 0 ? .072 * Math.exp(-radius * radius / .065) : 0),
      Math.sin(angle) * radius * .38 * shoulder);
    color.copy(green).lerp(yellow, smooth(y, -.95, -.42));
    color.lerp(orange, smooth(y, -.25, .43)); color.lerp(red, smooth(y, .20, .80));
    colors.setXYZ(i, color.r, color.g, color.b);
  } else {
    // Short, complete crowns nestle between the inflated bellies.
    source.setXYZ(i, source.getX(i) * .65, .2461 + (source.getY(i) - .2461) * .65, source.getZ(i) * .65);
  }
}
fruitGeometry.computeVertexNormals();
const normals = fruitGeometry.getAttribute('normal'), normal = new THREE.Vector3(), other = new THREE.Vector3();
for (const [a, b] of fruitGeometry.userData.fruitNormalSeams as [number, number][]) {
  normal.fromBufferAttribute(normals, a).add(other.fromBufferAttribute(normals, b)).normalize();
  normals.setXYZ(a, normal.x, normal.y, normal.z); normals.setXYZ(b, normal.x, normal.y, normal.z);
}
fruitGeometry.name = 'Inflated Wumpa · smooth full cheeks, complete crown and stalk';
fruitGeometry.computeBoundingBox(); fruitGeometry.computeBoundingSphere();
const packing = [
  { p: [-.135,-.01,-.135], s: [.72,.90,.72], yaw: -.7 },
  { p: [.135,-.025,-.135], s: [.72,.86,.72], yaw: 2.2 },
  { p: [-.135,-.035,.135], s: [.72,.84,.72], yaw: .3 },
  { p: [.135,.035,.135], s: [.72,.94,.72], yaw: 2.9 },
  { p: [0,.13,0], s: [.98,.70,.98], yaw: 1.5 },
];

export function createMultihitContents(): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(fruitGeometry, fruitMaterial, 5);
  mesh.name = 'Inflated Wumpa packed against the cage · one per remaining hit';
  mesh.userData.editorGhost = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  updateMultihitContents(mesh, 5, 0, 0);
  return mesh;
}
export function updateMultihitContents(mesh: THREE.InstancedMesh, hits: number, pulse: number, _time: number): void {
  mesh.count = Math.max(0, Math.min(5, Math.trunc(hits)));
  const age = .38 - pulse;
  const rebound = pulse > 0 ? Math.sin(age * 28) * Math.exp(-age * 12) * .006 : 0;
  for (let i = 0; i < mesh.count; i++) {
    const { p, s, yaw } = packing[i];
    pose.position.set(p[0], p[1] + rebound * (i < 4 ? .6 : 1), p[2]);
    pose.rotation.set(0, yaw, 0); pose.scale.set(s[0], s[1], s[2]); pose.updateMatrix(); mesh.setMatrixAt(i, pose.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  // Keep the complete contents eligible throughout their small local rebound.
  mesh.boundingSphere = mesh.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), .85);
}
