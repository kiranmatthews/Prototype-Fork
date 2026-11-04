import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CrateArtKind } from './crateArt';
import { cratePartGeometry, mergeCrateParts, readCrateFragments, type CrateFragment } from './crateFragmentAsset';
import { isMetalCrate, metalCrateTemplate, currentMetalCrate } from './crateMetal';

/** Shared authored surfaces. The second asset partitions the exact same shell;
 * fracture is a state change, never a camera-distance geometry replacement. */
export interface CrateSculpt {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  fragments: CrateFragment[];
  brace: THREE.BufferGeometry;
}
export type { CrateFragment } from './crateFragmentAsset';

let loading: Promise<CrateSculpt> | undefined;
let loaded: CrateSculpt | undefined;
const materials = new Map<string, THREE.MeshStandardMaterial>();
let bracedGeometry: THREE.BufferGeometry | undefined;
let bracedFragments: CrateFragment[] | undefined;
const shared = <T extends THREE.BufferGeometry | THREE.Texture | THREE.Material>(value: T): T => {
  value.userData.shared = true; value.userData.levelDepthFade = false; return value;
};


export function prepareCrateSculpt(): Promise<CrateSculpt> {
  return loading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = `${import.meta.env.BASE_URL}props/crate-family/`;
    const [intact, broken, braceAsset] = await Promise.all([loader.loadAsync(`${base}wood-sculpt.glb`), loader.loadAsync(`${base}wood-fracture.glb`), loader.loadAsync(`${base}wood-brace.glb`)]);
    intact.scene.updateMatrixWorld(true); broken.scene.updateMatrixWorld(true);
    let surface: THREE.MeshStandardMaterial | undefined;
    const pieces: THREE.BufferGeometry[] = [];
    intact.scene.traverse(node => {
      if (!(node as THREE.Mesh).isMesh) return;
      const mesh = node as THREE.Mesh;
      pieces.push(cratePartGeometry(mesh));
      surface ??= (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    });
    if (!surface?.map || !pieces.length) throw new Error('Crate sculpt needs a complete textured exterior');
    const material = shared(surface.clone());
    material.name = 'Sculpted chestnut · painted grain, carved bevels, iron nails';
    material.roughness = .82; material.metalness = 0;
    material.normalScale.setScalar(.7);
    for (const map of [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap])
      if (map) { shared(map); map.anisotropy = 8; }
    const fragments = readCrateFragments(broken.scene);
    braceAsset.scene.updateMatrixWorld(true);
    const braceParts: THREE.BufferGeometry[] = [];
    braceAsset.scene.traverse(node => { if ((node as THREE.Mesh).isMesh) braceParts.push(cratePartGeometry(node as THREE.Mesh)); });
    loaded = { geometry: mergeCrateParts(pieces), material, fragments, brace: mergeCrateParts(braceParts) };
    return loaded;
  })();
}
export function currentCrateSculpt(): CrateSculpt | undefined { return loaded; }

function withBraces(): void {
  if (!loaded || bracedFragments) return;
  const braces: CrateFragment[] = [];
  for (let face = 0; face < 4; face++) for (const diagonal of [-1, 1]) {
    const exterior = loaded.brace.clone().scale(1, .94, 1)
      .rotateZ(diagonal * Math.PI / 4).translate(0, 0, diagonal < 0 ? .44 : .466).rotateY(face * Math.PI / 2);
    exterior.computeBoundingBox(); exterior.computeBoundingSphere(); shared(exterior);
    const bounds = exterior.boundingBox!;
    braces.push({ exterior, interior: mergeCrateParts([]), center: bounds.getCenter(new THREE.Vector3()), halfSize: bounds.getSize(new THREE.Vector3()).multiplyScalar(.5) });
  }
  bracedFragments = [...loaded.fragments, ...braces];
  bracedGeometry = shared(mergeGeometries([loaded.geometry, ...braces.map(b => b.exterior)])!);
  bracedGeometry.computeBoundingBox(); bracedGeometry.computeBoundingSphere();
}
export function crateSculptGeometry(kind: CrateArtKind): THREE.BufferGeometry | undefined {
  if (kind === 'wood' || kind === 'empty') { withBraces(); return bracedGeometry; }
  return loaded?.geometry;
}
export function crateSculptFragments(kind: CrateArtKind): CrateFragment[] | undefined {
  if (kind === 'wood' || kind === 'empty') { withBraces(); return bracedFragments; }
  return loaded?.fragments;
}

/** Stain colours leave the carved shading intact. Warm bare corners unite the
 * reward types; the metal family uses its own cool steel surface. */
const STAINS: Partial<Record<CrateArtKind, [string, number, number]>> = {
  life: ['#128b91', .92, 0], mask: ['#713a8e', .9, 0],
  bouncy: ['#578f22', .86, 0], multihit: ['#a54a16', .5, 0],
  checkpoint: ['#eeb43d', .65, .32],
  bang: ['#cba330', .8, .15], nitrobang: ['#3b9075', .8, .15], metalbounce: ['#387d92', .65, 0],
};

/** Decals are evaluated on the actual sculpt, so lettering follows its bows,
 * gaps and chips. The original local position also survives rigid fracture. */
export function crateSculptMaterial(kind: CrateArtKind, label: string, decal: THREE.Texture | null): THREE.MeshStandardMaterial | undefined {
  const metal = isMetalCrate(kind);
  if (!loaded && !metal) return undefined;
  const cacheKey = `${kind}:${label}:${metal && currentMetalCrate() ? 'tripo' : 'base'}`; const existing = materials.get(cacheKey); if (existing) return existing;
  const material = shared((metal ? metalCrateTemplate().material : loaded!.material).clone());
  const [stainHex, strength, frameStrength] = STAINS[kind] ?? ['#ffffff', 0, 0];
  const stain = new THREE.Color(stainHex);
  const hasMark = decal && label !== 'blank' && (!['wood', 'empty', 'metal'].includes(kind) || /^\d+s$/.test(label) || label === 'speed' || label === 'balance');
  material.name = `${kind} · sculpted painted surface · ${label}`;
  material.onBeforeCompile = shader => {
    shader.uniforms.crateStain = { value: stain };
    shader.uniforms.cratePaint = { value: new THREE.Vector2(strength, frameStrength) };
    shader.uniforms.crateMark = { value: decal };
    shader.uniforms.crateHasMark = { value: hasMark ? 1 : 0 };
    shader.uniforms.crateMetal = { value: metal ? 1 : 0 };
    shader.vertexShader = `varying vec3 vCrateLocal;\nvarying vec3 vCrateNormal;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrateLocal = position;\nvCrateNormal = normal;');
    shader.fragmentShader = `varying vec3 vCrateLocal;\nvarying vec3 vCrateNormal;\nuniform vec3 crateStain;\nuniform vec2 cratePaint;\nuniform sampler2D crateMark;\nuniform float crateHasMark;\nuniform float crateMetal;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 cp = vCrateLocal;
        vec3 ca = abs(cp);
        if (crateMetal > .5) {
          // Keep the generated blue-violet shading, with the calmer silver
          // saturation of the approved steel reference.
          float steelValue = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
          diffuseColor.rgb = mix(vec3(steelValue),diffuseColor.rgb,.48)*vec3(.94,1.02,1.07);
        }
        vec2 faceUV;
        float topFace = 0.0;
        if (ca.y >= ca.x && ca.y >= ca.z) { faceUV = vec2(cp.x, -cp.z * sign(cp.y)); topFace = 1.0; }
        else if (ca.x > ca.z) { faceUV = vec2(-cp.z * sign(cp.x), cp.y); }
        else { faceUV = vec2(cp.x * sign(cp.z), cp.y); }
        float rim = smoothstep(.29, .39, max(abs(faceUV.x), abs(faceUV.y)));
        float woodMask = mix(smoothstep(.015, .12, diffuseColor.r - diffuseColor.b), 1.0, crateMetal);
        float paint = mix(cratePaint.x, cratePaint.x * cratePaint.y, rim) * woodMask;
        float lightWood = max(.06, dot(diffuseColor.rgb, vec3(.45, .4, .15)));
        vec3 dyed = crateStain * pow(lightWood * 3.0, .88);
        diffuseColor.rgb = mix(diffuseColor.rgb, dyed, paint);
        vec2 markUV = faceUV / mix(.61, .49, topFace) + .5;
        float insideMark = step(0.0, markUV.x) * step(markUV.x, 1.0) * step(0.0, markUV.y) * step(markUV.y, 1.0);
        markUV.x = markUV.x * .5 + topFace * .5;
        vec4 mark = texture2D(crateMark, markUV);
        float ink = mark.a * insideMark * crateHasMark;
        diffuseColor.rgb = mix(diffuseColor.rgb, mark.rgb * (.72 + lightWood * .85), ink);
      `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - ink;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nif (crateMetal > .5) roughnessFactor = mix(.38,.72,roughnessFactor);');
  };
  material.customProgramCacheKey = () => 'crate-sculpt-painted-v1';
  materials.set(cacheKey, material); return material;
}
