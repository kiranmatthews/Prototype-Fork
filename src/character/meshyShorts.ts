import * as THREE from 'three';
import { MESHY_SHORTS_ASSET } from './meshyShorts.generated';

export const MESHY_SHORTS_SCHEMA_VERSION = 1 as const;
export const MESHY_SHORTS_ASSET_PATH = 'characters/meshy-shorts/';
export const MESHY_SHORTS_REST_SCALE = 0.388;
export const MESHY_SHORTS_REST_CENTER_Y = 0.627;

export interface MeshyShortsRig {
  readonly mount: THREE.Object3D;
  readonly hips: THREE.Bone;
  readonly hipLeft: THREE.Bone;
  readonly hipRight: THREE.Bone;
}

export interface MeshyShortsComponent {
  readonly mesh: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly skeleton: THREE.Skeleton;
  readonly triangles: number;
  readonly sourceSha256: string;
}

export interface MeshyShortsTextureDiagnostics {
  readonly state: 'idle' | 'loading' | 'ready' | 'failed';
  readonly loaded: number;
  readonly requested: number;
  readonly error: string | null;
}

let geometryValue: THREE.BufferGeometry | null = null;
let materialValue: THREE.MeshStandardMaterial | null = null;
let textureRequestCount = 0;
let textureLoadCount = 0;
const textureErrors: string[] = [];

export function meshyShortsTextureDiagnostics(): MeshyShortsTextureDiagnostics {
  return {
    state: textureRequestCount === 0
      ? 'idle'
      : textureErrors.length > 0
        ? 'failed'
        : textureLoadCount === textureRequestCount
          ? 'ready'
          : 'loading',
    loaded: textureLoadCount,
    requested: textureRequestCount,
    error: textureErrors.length > 0 ? textureErrors.join('; ') : null,
  };
}

function decodeFloat32(source: string): Float32Array {
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Float32Array(bytes.buffer);
}

function decodeUint8(source: string): Uint8Array {
  const binary = atob(source);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
  return result;
}

function decodeUint16(source: string): Uint16Array {
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Uint16Array(bytes.buffer);
}

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function geometry(): THREE.BufferGeometry {
  if (geometryValue) return geometryValue;
  const result = new THREE.BufferGeometry();
  result.name = 'meshy-midnight-chain-denim-geometry';
  result.setAttribute(
    'position',
    new THREE.BufferAttribute(decodeFloat32(MESHY_SHORTS_ASSET.positionsBase64), 3),
  );
  result.setAttribute(
    'uv',
    new THREE.BufferAttribute(decodeFloat32(MESHY_SHORTS_ASSET.uvsBase64), 2),
  );
  result.setIndex(new THREE.BufferAttribute(decodeUint16(MESHY_SHORTS_ASSET.indicesBase64), 1));
  const position = result.getAttribute('position');
  const sourceIndex = result.getIndex();
  if (!sourceIndex) throw new Error('Meshy shorts index data is missing');
  const islandIds = decodeUint8(MESHY_SHORTS_ASSET.islandIdsBase64);
  if (islandIds.length !== position.count) throw new Error('Meshy shorts island data length mismatch');

  const widthDelta = new Float32Array(position.count * 3);
  const lengthDelta = new Float32Array(position.count * 3);
  const depthDelta = new Float32Array(position.count * 3);
  const sourceTop = MESHY_SHORTS_ASSET.runtimeBounds.max[1];
  for (let index = 0; index < position.count; index++) {
    widthDelta[index * 3] = position.getX(index);
    lengthDelta[index * 3 + 1] = position.getY(index) - sourceTop;
    depthDelta[index * 3 + 2] = position.getZ(index);
  }
  const widthMorph = new THREE.Float32BufferAttribute(widthDelta, 3);
  widthMorph.name = 'shorts-width';
  const lengthMorph = new THREE.Float32BufferAttribute(lengthDelta, 3);
  lengthMorph.name = 'shorts-length';
  const depthMorph = new THREE.Float32BufferAttribute(depthDelta, 3);
  depthMorph.name = 'shorts-depth';
  result.morphAttributes.position = [widthMorph, lengthMorph, depthMorph];
  result.morphTargetsRelative = true;

  const islandCount = MESHY_SHORTS_ASSET.islandTriangleCounts.length;
  const islandX = new Float64Array(islandCount);
  const islandY = new Float64Array(islandCount);
  const islandVertexCount = new Uint32Array(islandCount);
  // Preserve the original triangle-list weighting of detail centroids. A
  // shared indexed vertex contributes once for every source triangle corner,
  // exactly as it did before lossless indexing.
  for (let corner = 0; corner < sourceIndex.count; corner++) {
    const index = sourceIndex.getX(corner);
    const island = islandIds[index];
    islandX[island] += position.getX(index) * MESHY_SHORTS_REST_SCALE;
    islandY[island] += MESHY_SHORTS_REST_CENTER_Y +
      position.getY(index) * MESHY_SHORTS_REST_SCALE;
    islandVertexCount[island]++;
  }
  const rigidDetailBone = new Uint8Array(islandCount);
  for (let island = 1; island < islandCount; island++) {
    const x = islandX[island] / islandVertexCount[island];
    const y = islandY[island] / islandVertexCount[island];
    rigidDetailBone[island] = y < 0.64 && Math.abs(x) > 0.04
      ? x >= 0 ? 1 : 2
      : 0;
  }

  const skinIndex = new Uint16Array(position.count * 4);
  const skinWeight = new Float32Array(position.count * 4);
  for (let index = 0; index < position.count; index++) {
    const island = islandIds[index];
    const offset = index * 4;
    if (island !== 0) {
      skinIndex[offset] = rigidDetailBone[island];
      skinWeight[offset] = 1;
      continue;
    }
    const x = position.getX(index) * MESHY_SHORTS_REST_SCALE;
    const y = MESHY_SHORTS_REST_CENTER_Y +
      position.getY(index) * MESHY_SHORTS_REST_SCALE;
    const down = smoothstep((0.68 - y) / (0.68 - 0.52));
    const side = smoothstep((Math.abs(x) - 0.025) / (0.075 - 0.025));
    const legWeight = down * side;
    skinIndex[offset] = 0;
    skinWeight[offset] = 1 - legWeight;
    skinIndex[offset + 1] = x >= 0 ? 1 : 2;
    skinWeight[offset + 1] = legWeight;
  }
  result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.sharedImmutable = true;
  result.userData.sourceSha256 = MESHY_SHORTS_ASSET.sourceSha256;
  geometryValue = result;
  return result;
}

function texture(name: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const url = `${import.meta.env.BASE_URL}${MESHY_SHORTS_ASSET_PATH}${name}`;
  textureRequestCount++;
  const result = new THREE.TextureLoader().load(
    url,
    () => { textureLoadCount++; },
    undefined,
    () => { textureErrors.push(`failed to load ${url}`); },
  );
  result.name = `meshy-shorts-${name}`;
  result.colorSpace = colorSpace;
  result.wrapS = THREE.ClampToEdgeWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.anisotropy = 4;
  return result;
}

function material(): THREE.MeshStandardMaterial {
  if (materialValue) return materialValue;
  materialValue = new THREE.MeshStandardMaterial({
    name: 'meshy-midnight-chain-denim-material',
    color: 0xffffff,
    map: texture('base-color.webp', THREE.SRGBColorSpace),
    roughnessMap: texture('roughness.webp', THREE.NoColorSpace),
    metalnessMap: texture('metallic.webp', THREE.NoColorSpace),
    roughness: 1,
    metalness: 1,
    flatShading: true,
  });
  return materialValue;
}

export function createMeshyShorts(rig: MeshyShortsRig): MeshyShortsComponent {
  const mesh = new THREE.SkinnedMesh(geometry(), material());
  mesh.name = 'meshy-shorts-surface';
  mesh.position.y = MESHY_SHORTS_REST_CENTER_Y;
  mesh.scale.setScalar(MESHY_SHORTS_REST_SCALE);
  mesh.updateMorphTargets();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.characterPart = 'shorts-surface';
  mesh.userData.explodeWithParent = true;
  mesh.userData.meshyShortsRuntime = {
    schemaVersion: MESHY_SHORTS_SCHEMA_VERSION,
    kind: 'meshy-midnight-chain-denim-shorts',
    sourceSha256: MESHY_SHORTS_ASSET.sourceSha256,
    triangles: MESHY_SHORTS_ASSET.triangles,
    restScale: MESHY_SHORTS_REST_SCALE,
    restCenterY: MESHY_SHORTS_REST_CENTER_Y,
    skinBones: [rig.hips.name, rig.hipLeft.name, rig.hipRight.name],
    proportionControls: ['shortsWidth', 'shortsHeight', 'shortsDepth'],
  };
  rig.mount.add(mesh);
  rig.mount.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton([rig.hips, rig.hipLeft, rig.hipRight]);
  skeleton.calculateInverses();
  mesh.bind(skeleton, mesh.matrixWorld);
  return {
    mesh,
    skeleton,
    triangles: MESHY_SHORTS_ASSET.triangles,
    sourceSha256: MESHY_SHORTS_ASSET.sourceSha256,
  };
}
