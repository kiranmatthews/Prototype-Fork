import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readCrateFragments, type CrateFragment } from './crateFragmentAsset';

interface MetalTemplate { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; fragments?: CrateFragment[] }
let template: MetalTemplate | undefined;
let authored: MetalTemplate | undefined;
let loading: Promise<MetalTemplate> | undefined;

export function currentMetalCrate(): MetalTemplate | undefined { return authored; }

/** The metal family has its own Tripo Smart Mesh and painted steel surface.
 * Preserve every exported triangle at every distance and in reflections. */
export function prepareMetalCrate(): Promise<MetalTemplate> {
  return loading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}props/crate-family/`;
    const [gltf, broken] = await Promise.all([
      loader.loadAsync(`${base}metal-sculpt.glb`), loader.loadAsync(`${base}metal-fracture.glb`),
    ]);
    gltf.scene.updateMatrixWorld(true);
    broken.scene.updateMatrixWorld(true);
    const parts: THREE.BufferGeometry[] = [];
    let source: THREE.MeshStandardMaterial | undefined;
    gltf.scene.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      let geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      if (geometry.index) { const indexed = geometry; geometry = geometry.toNonIndexed(); indexed.dispose(); }
      for (const key of Object.keys(geometry.attributes)) if (!['position', 'normal', 'uv'].includes(key)) geometry.deleteAttribute(key);
      geometry.clearGroups(); parts.push(geometry);
      source ??= (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    });
    if (!source?.map || !parts.length) throw new Error('Metal crate needs its own textured Tripo surface');
    const geometry = mergeGeometries(parts)!; parts.forEach(part => part.dispose());
    geometry.computeBoundingBox();
    const center = geometry.boundingBox!.getCenter(new THREE.Vector3()), size = geometry.boundingBox!.getSize(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z).scale(1 / size.x, 1 / size.y, 1 / size.z);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.shared = true;
    const material = source.clone();
    material.name = 'Tripo sculpted cool steel · smooth panels and riveted gussets';
    material.roughness = 1; material.metalness = .42;
    material.normalScale.setScalar(.45); material.side = THREE.FrontSide;
    material.userData.shared = true; material.userData.levelDepthFade = false;
    for (const map of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap]) {
      if (map) { map.anisotropy = 8; map.userData.shared = true; }
    }
    authored = { geometry, material, fragments: readCrateFragments(broken.scene) }; return authored;
  })();
}
const faceRotations = [
  new THREE.Euler(), new THREE.Euler(0, Math.PI / 2, 0), new THREE.Euler(0, Math.PI, 0),
  new THREE.Euler(0, -Math.PI / 2, 0), new THREE.Euler(-Math.PI / 2, 0, 0), new THREE.Euler(Math.PI / 2, 0, 0),
];

/** A gently pinched, forged frame, with corners broad enough to carry a real
 * triangular gusset. Curves are purposeful; the silhouette stays within the
 * shared cube envelope so stacking and landing remain visually credible. */
function contour(half: number, inset: number): THREE.Shape {
  const s = new THREE.Shape(), corner = half * .12;
  s.moveTo(-half + corner, -half);
  s.bezierCurveTo(-half * .3, -half + inset, half * .3, -half + inset, half - corner, -half);
  s.lineTo(half, -half + corner);
  s.bezierCurveTo(half - inset, -half * .3, half - inset, half * .3, half, half - corner);
  s.lineTo(half - corner, half);
  s.bezierCurveTo(half * .3, half - inset, -half * .3, half - inset, -half + corner, half);
  s.lineTo(-half, half - corner);
  s.bezierCurveTo(-half + inset, half * .3, -half + inset, -half * .3, -half, -half + corner);
  s.closePath(); return s;
}
function tint(g: THREE.BufferGeometry, hex: number, wear = 0): THREE.BufferGeometry {
  if (g.index) { const old = g; g = g.toNonIndexed(); old.dispose(); }
  const p = g.getAttribute('position'), colors = new Float32Array(p.count * 3), base = new THREE.Color(hex);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const shade = .95 + Math.sin(x * 8 + y * 3) * .035 + Math.cos(y * 9 - x * 4) * .035 + wear * Math.max(0, z) * 3;
    colors[i * 3] = base.r * shade; colors[i * 3 + 1] = base.g * shade; colors[i * 3 + 2] = base.b * shade;
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return g;
}

export function metalCrateTemplate(): { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  if (authored) return authored;
  if (template) return template;
  const parts: THREE.BufferGeometry[] = [];
  for (let face = 0; face < 6; face++) {
    const rotation = new THREE.Matrix4().makeRotationFromEuler(faceRotations[face]);
    const add = (g: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, roll = 0) => {
      parts.push(tint(g, color, .1).rotateZ(roll).translate(x, y, z).applyMatrix4(rotation));
    };
    const outer = contour(.476, .041), inner = contour(.337, .024);
    outer.holes.push(new THREE.Path(inner.getPoints(5).reverse()));
    const frame = new THREE.ExtrudeGeometry(outer, { depth: .053, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .014, bevelThickness: .014, curveSegments: 5 });
    add(frame, 0x729298, 0, 0, .416);
    const panel = new THREE.ExtrudeGeometry(contour(.343, .022), { depth: .034, bevelEnabled: true, bevelSegments: 2, bevelSize: .014, bevelThickness: .01, curveSegments: 5, steps: 1 });
    // A small dish catches the key light without adding wood-like grain.
    const pp = panel.getAttribute('position');
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i);
      pp.setZ(i, pp.getZ(i) - Math.max(0, 1 - (x * x + y * y) / .21) * .018);
    }
    panel.computeVertexNormals(); add(panel, 0x3e606d, 0, 0, .384);
    for (let corner = 0; corner < 4; corner++) {
      const plate = new THREE.Shape(); plate.moveTo(.283, .469); plate.lineTo(.468, .282);
      plate.lineTo(.468, .429); plate.lineTo(.429, .468); plate.closePath();
      const g = new THREE.ExtrudeGeometry(plate, { depth: .011, bevelEnabled: true, bevelSize: .008, bevelThickness: .005, bevelSegments: 2, steps: 1 });
      add(g, 0xb7bba8, 0, 0, .48, corner * Math.PI / 2);
      // Cold-forged heads with a sloped collar, warm brass centres, and a real
      // slot across the head. The slot is geometry and reads from oblique views.
      const angle = corner * Math.PI / 2, x = .403 * (Math.cos(angle) - Math.sin(angle)), y = .403 * (Math.sin(angle) + Math.cos(angle));
      const collar = new THREE.CylinderGeometry(.032, .038, .013, 8).rotateX(Math.PI / 2);
      add(collar, 0x273d48, x, y, .498);
      const bolt = new THREE.CylinderGeometry(.024, .029, .015, 6).rotateX(Math.PI / 2);
      add(bolt, 0xc1b27b, x, y, .508, .15 + face * .12);
      add(new THREE.BoxGeometry(.027, .0045, .001), 0x293a3d, x, y, .5165, .32 + corner * .7);
    }
    for (let edge = 0; edge < 4; edge++) for (const offset of [-.18, .18]) {
      const a = edge * Math.PI / 2;
      const x = offset * Math.cos(a) - .406 * Math.sin(a), y = offset * Math.sin(a) + .406 * Math.cos(a);
      const head = new THREE.SphereGeometry(.018, 8, 5).scale(1, 1, .45);
      add(head, 0xaebbb5, x, y, .485);
    }
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); geometry.userData.shared = true;
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .43, metalness: .3 });
  material.name = 'Hammered blue steel · pewter guards and brass fasteners';
  material.userData.shared = true; material.userData.levelDepthFade = false;
  template = { geometry, material }; return template;
}

export function isMetalCrate(kind: string): boolean { return ['metal', 'metalbounce', 'bang', 'nitrobang'].includes(kind); }
