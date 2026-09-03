import * as THREE from 'three';
import { MESHY_BOOLIEROO_HEAD_ASSET } from './meshyBoolieRooHead.generated';

export const MESHY_BOOLIEROO_HEAD_SCHEMA_VERSION = 1 as const;
export const MESHY_BOOLIEROO_HEAD_ASSET_PATH = 'characters/meshy-boolieroo-head/';
export const MESHY_BOOLIEROO_HEAD_REST_SCALE = 0.46;

export interface MeshyBoolieRooHeadComponent {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly triangles: number;
  readonly sourceSha256: string;
}

export interface MeshyBoolieRooHeadTextureDiagnostics {
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

export function meshyBoolieRooHeadTextureDiagnostics(): MeshyBoolieRooHeadTextureDiagnostics {
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

function decodeUint16(source: string): Uint16Array {
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Uint16Array(bytes.buffer);
}

function geometry(): THREE.BufferGeometry {
  if (geometryValue) return geometryValue;
  const result = new THREE.BufferGeometry();
  result.name = 'meshy-boolieroo-alternate-head-geometry';
  result.setAttribute(
    'position',
    new THREE.BufferAttribute(decodeFloat32(MESHY_BOOLIEROO_HEAD_ASSET.positionsBase64), 3),
  );
  result.setAttribute(
    'uv',
    new THREE.BufferAttribute(decodeFloat32(MESHY_BOOLIEROO_HEAD_ASSET.uvsBase64), 2),
  );
  result.setIndex(
    new THREE.BufferAttribute(decodeUint16(MESHY_BOOLIEROO_HEAD_ASSET.indicesBase64), 1),
  );
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.sharedImmutable = true;
  result.userData.sourceSha256 = MESHY_BOOLIEROO_HEAD_ASSET.sourceSha256;
  geometryValue = result;
  return result;
}

function texture(name: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  const url = `${import.meta.env.BASE_URL}${MESHY_BOOLIEROO_HEAD_ASSET_PATH}${name}`;
  textureRequestCount++;
  const result = new THREE.TextureLoader().load(
    url,
    () => { textureLoadCount++; },
    undefined,
    () => { textureErrors.push(`failed to load ${url}`); },
  );
  result.name = `meshy-boolieroo-head-${name}`;
  result.colorSpace = colorSpace;
  result.wrapS = THREE.ClampToEdgeWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.anisotropy = 4;
  return result;
}

function material(): THREE.MeshStandardMaterial {
  if (materialValue) return materialValue;
  materialValue = new THREE.MeshStandardMaterial({
    name: 'meshy-boolieroo-alternate-head-material',
    color: 0xffffff,
    map: texture('base-color.webp', THREE.SRGBColorSpace),
    roughnessMap: texture('roughness.webp', THREE.NoColorSpace),
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  return materialValue;
}

export function createMeshyBoolieRooHead(): MeshyBoolieRooHeadComponent {
  const mesh = new THREE.Mesh(geometry(), material());
  mesh.name = 'meshy-boolieroo-alternate-head-surface';
  mesh.scale.setScalar(MESHY_BOOLIEROO_HEAD_REST_SCALE);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = 'alternate-head-surface';
  mesh.userData.explodeWithParent = true;
  mesh.userData.meshyBoolieRooHeadRuntime = {
    schemaVersion: MESHY_BOOLIEROO_HEAD_SCHEMA_VERSION,
    kind: 'meshy-boolieroo-alternate-head',
    sourceSha256: MESHY_BOOLIEROO_HEAD_ASSET.sourceSha256,
    triangles: MESHY_BOOLIEROO_HEAD_ASSET.triangles,
    restScale: MESHY_BOOLIEROO_HEAD_REST_SCALE,
    attachmentJoint: 'head',
    presentationMount: 'head-presentation',
    neckGapControl: 'neckLength',
    headForwardOffsetControl: 'headForwardOffset',
    neutralTiltControl: 'headRestPitch',
    scaleControls: ['headSize', 'headWidth', 'headDepth'],
    evaluationOnly: true,
  };
  return {
    mesh,
    triangles: MESHY_BOOLIEROO_HEAD_ASSET.triangles,
    sourceSha256: MESHY_BOOLIEROO_HEAD_ASSET.sourceSha256,
  };
}
