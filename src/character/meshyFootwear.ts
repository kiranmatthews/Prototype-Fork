import * as THREE from 'three';
import { MESHY_FOOTWEAR_ASSET } from './meshyFootwear.generated';

export const MESHY_FOOTWEAR_SCHEMA_VERSION = 1 as const;
export const MESHY_FOOTWEAR_ASSET_PATH = 'characters/meshy-footwear/';
export const MESHY_FOOTWEAR_REST_SCALE = 0.27;
export const MESHY_FOOTWEAR_LOCAL_OFFSET = Object.freeze({
  x: 0,
  y: 0.03753913,
  z: 0.065,
});
export const MESHY_FOOTWEAR_SHOE_TRIANGLES = 2504;
export const MESHY_FOOTWEAR_SOCK_TRIANGLES = 631;
export const MESHY_FOOTWEAR_TOTAL_TRIANGLES = 3135;
const SOCK_KNEE_BLEND_START_Y = 0.015;
const SOCK_KNEE_BLEND_END_Y = 0.08;

export type MeshyFootwearSide = 'left' | 'right';

export interface MeshyFootwearRig {
  readonly mount: THREE.Object3D;
  readonly knee: THREE.Bone;
  readonly ankle: THREE.Bone;
  readonly side: MeshyFootwearSide;
}

export interface MeshyFootwearComponent {
  readonly side: MeshyFootwearSide;
  readonly shoe: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly sock: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly skeleton: THREE.Skeleton;
  readonly triangles: number;
  readonly sourceSha256: string;
}

export interface MeshyFootwearTextureDiagnostics {
  readonly state: 'idle' | 'loading' | 'ready' | 'failed';
  readonly loaded: number;
  readonly requested: number;
  readonly error: string | null;
}

interface DecodedFootwear {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly islandIds: Uint8Array;
  readonly indices: Uint16Array;
}

let decodedValue: DecodedFootwear | null = null;
const geometryValues = new Map<string, THREE.BufferGeometry>();
let materialValue: THREE.MeshStandardMaterial | null = null;
let textureRequestCount = 0;
let textureLoadCount = 0;
const textureErrors: string[] = [];

export function meshyFootwearTextureDiagnostics(): MeshyFootwearTextureDiagnostics {
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

function decoded(): DecodedFootwear {
  if (decodedValue) return decodedValue;
  const positions = decodeFloat32(MESHY_FOOTWEAR_ASSET.positionsBase64);
  const normals = decodeFloat32(MESHY_FOOTWEAR_ASSET.normalsBase64);
  const uvs = decodeFloat32(MESHY_FOOTWEAR_ASSET.uvsBase64);
  const islandIds = decodeUint8(MESHY_FOOTWEAR_ASSET.islandIdsBase64);
  const indices = decodeUint16(MESHY_FOOTWEAR_ASSET.indicesBase64);
  const vertexCount = MESHY_FOOTWEAR_ASSET.indexedVertices;
  if (
    positions.length !== vertexCount * 3 ||
    normals.length !== vertexCount * 3 ||
    uvs.length !== vertexCount * 2 ||
    islandIds.length !== vertexCount ||
    indices.length !== MESHY_FOOTWEAR_ASSET.vertices
  ) throw new Error('Meshy footwear generated attribute length mismatch');
  decodedValue = { positions, normals, uvs, islandIds, indices };
  return decodedValue;
}

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function sockKneeWeight(ankleLocalY: number): number {
  return smoothstep(
    (ankleLocalY - SOCK_KNEE_BLEND_START_Y) /
    (SOCK_KNEE_BLEND_END_Y - SOCK_KNEE_BLEND_START_Y),
  );
}

function partGeometry(
  part: 'shoe' | 'sock',
  side: MeshyFootwearSide,
): THREE.BufferGeometry {
  const cacheKey = `${part}:${side}`;
  const cached = geometryValues.get(cacheKey);
  if (cached) return cached;
  const source = decoded();
  const wantSock = part === 'sock';
  const selectedTriangles = wantSock
    ? MESHY_FOOTWEAR_SOCK_TRIANGLES
    : MESHY_FOOTWEAR_SHOE_TRIANGLES;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices = new Uint16Array(selectedTriangles * 3);
  const targetBySource = new Map<number, number>();
  const mirror = side === 'right' ? -1 : 1;
  let targetCorner = 0;
  for (let triangle = 0; triangle < MESHY_FOOTWEAR_ASSET.triangles; triangle++) {
    const sourceOffset = triangle * 3;
    const sourceVertices = [
      source.indices[sourceOffset],
      source.indices[sourceOffset + 1],
      source.indices[sourceOffset + 2],
    ];
    const island = source.islandIds[sourceVertices[0]];
    if (
      source.islandIds[sourceVertices[1]] !== island ||
      source.islandIds[sourceVertices[2]] !== island
    ) throw new Error('Meshy footwear triangle crosses connected islands');
    if ((island === MESHY_FOOTWEAR_ASSET.sockIslandId) !== wantSock) continue;
    const order = side === 'right' ? [0, 2, 1] : [0, 1, 2];
    for (const corner of order) {
      const sourceVertex = sourceVertices[corner];
      let targetVertex = targetBySource.get(sourceVertex);
      if (targetVertex !== undefined) {
        indices[targetCorner++] = targetVertex;
        continue;
      }
      targetVertex = targetBySource.size;
      targetBySource.set(sourceVertex, targetVertex);
      indices[targetCorner++] = targetVertex;
      const sourcePosition = sourceVertex * 3;
      positions.push(
        mirror * source.positions[sourcePosition] * MESHY_FOOTWEAR_REST_SCALE +
        MESHY_FOOTWEAR_LOCAL_OFFSET.x,
        source.positions[sourcePosition + 1] * MESHY_FOOTWEAR_REST_SCALE +
        MESHY_FOOTWEAR_LOCAL_OFFSET.y,
        source.positions[sourcePosition + 2] * MESHY_FOOTWEAR_REST_SCALE +
        MESHY_FOOTWEAR_LOCAL_OFFSET.z,
      );
      normals.push(
        mirror * source.normals[sourcePosition],
        source.normals[sourcePosition + 1],
        source.normals[sourcePosition + 2],
      );
      uvs.push(source.uvs[sourceVertex * 2], source.uvs[sourceVertex * 2 + 1]);
    }
  }
  if (targetCorner !== selectedTriangles * 3) {
    throw new Error(`Meshy footwear ${part} split produced ${targetCorner / 3} triangles`);
  }
  const positionArray = new Float32Array(positions);
  const result = new THREE.BufferGeometry();
  result.name = `meshy-shoe-sock-${part}-${side}-geometry`;
  result.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  result.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
  result.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  result.setIndex(new THREE.BufferAttribute(indices, 1));
  result.computeBoundingBox();
  if (wantSock) {
    const bounds = result.boundingBox!;
    const centerX = (bounds.min.x + bounds.max.x) * 0.5;
    const centerZ = (bounds.min.z + bounds.max.z) * 0.5;
    const thicknessDelta = new Float32Array(positionArray.length);
    const skinIndex = new Uint16Array(targetBySource.size * 4);
    const skinWeight = new Float32Array(targetBySource.size * 4);
    for (let index = 0; index < targetBySource.size; index++) {
      const offset = index * 3;
      const y = positionArray[offset + 1];
      const kneeWeight = sockKneeWeight(y);
      thicknessDelta[offset] = (positionArray[offset] - centerX) * kneeWeight;
      thicknessDelta[offset + 2] = (positionArray[offset + 2] - centerZ) * kneeWeight;
      const skinOffset = index * 4;
      skinIndex[skinOffset] = 0;
      skinWeight[skinOffset] = kneeWeight;
      skinIndex[skinOffset + 1] = 1;
      skinWeight[skinOffset + 1] = 1 - kneeWeight;
    }
    const thicknessMorph = new THREE.Float32BufferAttribute(thicknessDelta, 3);
    thicknessMorph.name = 'sock-thickness';
    result.morphAttributes.position = [thicknessMorph];
    result.morphTargetsRelative = true;
    result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  }
  result.computeBoundingSphere();
  result.userData.sharedImmutable = true;
  result.userData.sourceSha256 = MESHY_FOOTWEAR_ASSET.sourceSha256;
  result.userData.footwearPart = part;
  result.userData.anatomicalSide = side;
  geometryValues.set(cacheKey, result);
  return result;
}

function texture(name: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const url = `${import.meta.env.BASE_URL}${MESHY_FOOTWEAR_ASSET_PATH}${name}`;
  textureRequestCount++;
  const result = new THREE.TextureLoader().load(
    url,
    () => { textureLoadCount++; },
    undefined,
    () => { textureErrors.push(`failed to load ${url}`); },
  );
  result.name = `meshy-footwear-${name}`;
  result.colorSpace = colorSpace;
  result.wrapS = THREE.ClampToEdgeWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.anisotropy = 4;
  return result;
}

function material(): THREE.MeshStandardMaterial {
  if (materialValue) return materialValue;
  materialValue = new THREE.MeshStandardMaterial({
    name: 'meshy-shoe-sock-material',
    color: 0xffffff,
    map: texture('base-color.webp', THREE.SRGBColorSpace),
    roughnessMap: texture('roughness.webp', THREE.NoColorSpace),
    roughness: 1,
    metalness: 0,
    flatShading: false,
  });
  return materialValue;
}

export function createMeshyFootwear(rig: MeshyFootwearRig): MeshyFootwearComponent {
  const shoe = new THREE.Mesh(partGeometry('shoe', rig.side), material());
  shoe.name = `meshy-shoe-surface-${rig.side}`;
  shoe.castShadow = true;
  shoe.receiveShadow = true;
  shoe.userData.characterPart = 'shoe-surface';
  shoe.userData.anatomicalSide = rig.side;
  shoe.userData.explodeWithParent = true;
  rig.ankle.add(shoe);

  rig.mount.updateWorldMatrix(true, true);
  const ankleInMount = rig.mount.worldToLocal(
    rig.ankle.getWorldPosition(new THREE.Vector3()),
  );
  const sock = new THREE.SkinnedMesh(partGeometry('sock', rig.side), material());
  sock.name = `meshy-sock-surface-${rig.side}`;
  sock.position.copy(ankleInMount);
  sock.updateMorphTargets();
  sock.castShadow = true;
  sock.receiveShadow = true;
  sock.frustumCulled = false;
  sock.userData.characterPart = 'sock-surface';
  sock.userData.anatomicalSide = rig.side;
  sock.userData.explodeWithParent = true;
  rig.mount.add(sock);
  rig.mount.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton([rig.knee, rig.ankle]);
  skeleton.calculateInverses();
  sock.bind(skeleton, sock.matrixWorld);

  const runtimeMetadata = {
    schemaVersion: MESHY_FOOTWEAR_SCHEMA_VERSION,
    kind: 'meshy-shoe-and-sock',
    sourceSha256: MESHY_FOOTWEAR_ASSET.sourceSha256,
    side: rig.side,
    triangles: MESHY_FOOTWEAR_TOTAL_TRIANGLES,
    shoeTriangles: MESHY_FOOTWEAR_SHOE_TRIANGLES,
    sockTriangles: MESHY_FOOTWEAR_SOCK_TRIANGLES,
    shoeAttachment: rig.ankle.name,
    sockSkinBones: [rig.knee.name, rig.ankle.name],
    footSizeControl: 'footSize',
    sockThicknessControl: 'legThickness',
  } as const;
  shoe.userData.meshyFootwearRuntime = runtimeMetadata;
  sock.userData.meshyFootwearRuntime = runtimeMetadata;

  return {
    side: rig.side,
    shoe,
    sock,
    skeleton,
    triangles: MESHY_FOOTWEAR_TOTAL_TRIANGLES,
    sourceSha256: MESHY_FOOTWEAR_ASSET.sourceSha256,
  };
}
