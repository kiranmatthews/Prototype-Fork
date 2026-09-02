import * as THREE from 'three';
import { MESHY_COCO_HEAD_ASSET } from './meshyCocoHead.generated';

export const MESHY_COCO_HEAD_SCHEMA_VERSION = 1 as const;
export const MESHY_COCO_HEAD_ASSET_PATH = 'characters/meshy-coco-head/';
export const MESHY_COCO_HEAD_REST_SCALE = 0.46;

export interface MeshyCocoHeadComponent {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly triangles: number;
  readonly sourceSha256: string;
}

export interface MeshyCocoHeadTextureDiagnostics {
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

export function meshyCocoHeadTextureDiagnostics(): MeshyCocoHeadTextureDiagnostics {
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

function geometry(): THREE.BufferGeometry {
  if (geometryValue) return geometryValue;
  const result = new THREE.BufferGeometry();
  result.name = 'meshy-coco-alternate-head-geometry';
  result.setAttribute(
    'position',
    new THREE.BufferAttribute(decodeFloat32(MESHY_COCO_HEAD_ASSET.positionsBase64), 3),
  );
  result.setAttribute(
    'uv',
    new THREE.BufferAttribute(decodeFloat32(MESHY_COCO_HEAD_ASSET.uvsBase64), 2),
  );
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.sharedImmutable = true;
  result.userData.sourceSha256 = MESHY_COCO_HEAD_ASSET.sourceSha256;
  geometryValue = result;
  return result;
}

function texture(name: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const url = `${import.meta.env.BASE_URL}${MESHY_COCO_HEAD_ASSET_PATH}${name}`;
  textureRequestCount++;
  const result = new THREE.TextureLoader().load(
    url,
    () => { textureLoadCount++; },
    undefined,
    () => { textureErrors.push(`failed to load ${url}`); },
  );
  result.name = `meshy-coco-head-${name}`;
  result.colorSpace = colorSpace;
  result.wrapS = THREE.ClampToEdgeWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.anisotropy = 4;
  return result;
}

function material(): THREE.MeshStandardMaterial {
  if (materialValue) return materialValue;
  materialValue = new THREE.MeshStandardMaterial({
    name: 'meshy-coco-alternate-head-material',
    color: 0xffffff,
    map: texture('base-color.png', THREE.SRGBColorSpace),
    normalMap: texture('normal.png', THREE.NoColorSpace),
    roughnessMap: texture('roughness.png', THREE.NoColorSpace),
    metalnessMap: texture('metallic.png', THREE.NoColorSpace),
    roughness: 1,
    metalness: 1,
    flatShading: true,
  });
  return materialValue;
}

export function createMeshyCocoHead(): MeshyCocoHeadComponent {
  const mesh = new THREE.Mesh(geometry(), material());
  mesh.name = 'meshy-coco-alternate-head-surface';
  mesh.scale.setScalar(MESHY_COCO_HEAD_REST_SCALE);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = 'alternate-head-surface';
  mesh.userData.explodeWithParent = true;
  mesh.userData.meshyCocoHeadRuntime = {
    schemaVersion: MESHY_COCO_HEAD_SCHEMA_VERSION,
    kind: 'meshy-coco-alternate-head',
    sourceSha256: MESHY_COCO_HEAD_ASSET.sourceSha256,
    triangles: MESHY_COCO_HEAD_ASSET.triangles,
    restScale: MESHY_COCO_HEAD_REST_SCALE,
    attachmentJoint: 'head',
    evaluationOnly: true,
  };
  return {
    mesh,
    triangles: MESHY_COCO_HEAD_ASSET.triangles,
    sourceSha256: MESHY_COCO_HEAD_ASSET.sourceSha256,
  };
}
