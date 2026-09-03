import * as THREE from 'three';
import { MESHY_TORSO_ASSET } from './meshyTorso.generated';

export const MESHY_TORSO_SCHEMA_VERSION = 1 as const;
export const MESHY_TORSO_ASSET_PATH = 'characters/meshy-torso/';
export const MESHY_TORSO_REST_SCALE = 0.615;
export const MESHY_TORSO_REST_CENTER_Y = 1.0175;
export const MESHY_TORSO_BOTTOM_Y = 0.71;
export const MESHY_TORSO_SPINE_Y = 0.82;
export const MESHY_TORSO_CHEST_Y = 1.06;
export const MESHY_TORSO_NECK_Y = 1.325;
const MESHY_TORSO_FIXED_LOWER_FRACTION =
  (MESHY_TORSO_SPINE_Y - MESHY_TORSO_BOTTOM_Y) /
  (MESHY_TORSO_NECK_Y - MESHY_TORSO_BOTTOM_Y);

export interface MeshyTorsoRig {
  readonly mount: THREE.Object3D;
  readonly torsoRoot: THREE.Bone;
  readonly spine: THREE.Bone;
  readonly chest: THREE.Bone;
  readonly neck: THREE.Bone;
  readonly clavicleLeft: THREE.Bone;
  readonly clavicleRight: THREE.Bone;
}

export interface MeshyTorsoComponent {
  readonly mesh: THREE.SkinnedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly skeleton: THREE.Skeleton;
  readonly triangles: number;
  readonly sourceSha256: string;
}

let geometryValue: THREE.BufferGeometry | null = null;
let materialValue: THREE.MeshStandardMaterial | null = null;
let textureRequestCount = 0;
let textureLoadCount = 0;
const textureErrors: string[] = [];

export interface MeshyTorsoTextureDiagnostics {
  readonly state: 'idle' | 'loading' | 'ready' | 'failed';
  readonly loaded: number;
  readonly requested: number;
  readonly error: string | null;
}

export function meshyTorsoTextureDiagnostics(): MeshyTorsoTextureDiagnostics {
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
  result.name = 'meshy-torso-source-geometry';
  result.setAttribute(
    'position',
    new THREE.BufferAttribute(decodeFloat32(MESHY_TORSO_ASSET.positionsBase64), 3),
  );
  result.setAttribute(
    'uv',
    new THREE.BufferAttribute(decodeFloat32(MESHY_TORSO_ASSET.uvsBase64), 2),
  );
  result.setIndex(new THREE.BufferAttribute(decodeUint16(MESHY_TORSO_ASSET.indicesBase64), 1));
  const position = result.getAttribute('position');
  const widthDelta = new Float32Array(position.count * 3);
  const depthDelta = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    widthDelta[index * 3] = position.getX(index);
    depthDelta[index * 3 + 2] = position.getZ(index);
  }
  const widthMorph = new THREE.Float32BufferAttribute(widthDelta, 3);
  widthMorph.name = 'torso-width';
  const depthMorph = new THREE.Float32BufferAttribute(depthDelta, 3);
  depthMorph.name = 'torso-depth';
  result.morphAttributes.position = [widthMorph, depthMorph];
  result.morphTargetsRelative = true;
  const skinIndex = new Uint16Array(position.count * 4);
  const skinWeight = new Float32Array(position.count * 4);
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index) * MESHY_TORSO_REST_SCALE;
    const y = MESHY_TORSO_REST_CENTER_Y +
      position.getY(index) * MESHY_TORSO_REST_SCALE;
    let firstIndex: number;
    let secondIndex: number;
    let secondWeight: number;
    if (y <= MESHY_TORSO_SPINE_Y) {
      firstIndex = 0;
      secondIndex = 1;
      secondWeight = smoothstep(
        (y - MESHY_TORSO_BOTTOM_Y) /
        (MESHY_TORSO_SPINE_Y - MESHY_TORSO_BOTTOM_Y),
      );
    } else if (y <= MESHY_TORSO_CHEST_Y) {
      firstIndex = 1;
      secondIndex = 2;
      secondWeight = smoothstep(
        (y - MESHY_TORSO_SPINE_Y) /
        (MESHY_TORSO_CHEST_Y - MESHY_TORSO_SPINE_Y),
      );
    } else {
      firstIndex = 2;
      secondIndex = 3;
      secondWeight = smoothstep(
        (y - MESHY_TORSO_CHEST_Y) /
        (MESHY_TORSO_NECK_Y - MESHY_TORSO_CHEST_Y),
      );
    }
    const shoulderWeight = 0.78 * smoothstep(
      (y - 1.08) / (1.22 - 1.08),
    ) * smoothstep(
      (Math.abs(x) - 0.075) / (0.2 - 0.075),
    );
    const verticalWeight = 1 - shoulderWeight;
    const offset = index * 4;
    skinIndex[offset] = firstIndex;
    skinWeight[offset] = verticalWeight * (1 - secondWeight);
    skinIndex[offset + 1] = secondIndex;
    skinWeight[offset + 1] = verticalWeight * secondWeight;
    skinIndex[offset + 2] = x >= 0 ? 4 : 5;
    skinWeight[offset + 2] = shoulderWeight;
  }
  result.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  result.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  result.computeBoundingBox();
  result.computeBoundingSphere();
  result.userData.sharedImmutable = true;
  result.userData.sourceSha256 = MESHY_TORSO_ASSET.sourceSha256;
  geometryValue = result;
  return result;
}

function smoothstep(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function texture(
  name: string,
  colorSpace: THREE.ColorSpace,
): THREE.Texture {
  const url = `${import.meta.env.BASE_URL}${MESHY_TORSO_ASSET_PATH}${name}`;
  textureRequestCount++;
  const result = new THREE.TextureLoader().load(
    url,
    () => { textureLoadCount++; },
    undefined,
    () => { textureErrors.push(`failed to load ${url}`); },
  );
  result.name = `meshy-torso-${name}`;
  result.colorSpace = colorSpace;
  result.wrapS = THREE.ClampToEdgeWrapping;
  result.wrapT = THREE.ClampToEdgeWrapping;
  result.anisotropy = 4;
  return result;
}

function material(): THREE.MeshStandardMaterial {
  if (materialValue) return materialValue;
  materialValue = new THREE.MeshStandardMaterial({
    name: 'meshy-skeleton-tank-top-material',
    color: 0xffffff,
    map: texture('base-color.webp', THREE.SRGBColorSpace),
    roughnessMap: texture('roughness.webp', THREE.NoColorSpace),
    roughness: 1,
    metalness: 0,
    // Source normals are polygon-face normals. Derivative normals keep the
    // lighting correct while width/depth morphs move those faces.
    flatShading: true,
  });
  return materialValue;
}

export function meshyTorsoLengthRatio(endpointScale: number): number {
  const scale = Number.isFinite(endpointScale) ? Math.max(0.01, endpointScale) : 1;
  return MESHY_TORSO_FIXED_LOWER_FRACTION +
    (1 - MESHY_TORSO_FIXED_LOWER_FRACTION) * scale;
}

export function meshyTorsoEndpointScaleFromTransverse(transverse: number): number {
  const safe = Number.isFinite(transverse) && transverse > 0 ? transverse : 1;
  const lengthRatio = 1 / (safe * safe);
  return (lengthRatio - MESHY_TORSO_FIXED_LOWER_FRACTION) /
    (1 - MESHY_TORSO_FIXED_LOWER_FRACTION);
}

export function createMeshyTorso(rig: MeshyTorsoRig): MeshyTorsoComponent {
  const mesh = new THREE.SkinnedMesh(geometry(), material());
  mesh.name = 'meshy-torso-surface';
  mesh.updateMorphTargets();
  mesh.position.y = MESHY_TORSO_REST_CENTER_Y;
  mesh.scale.setScalar(MESHY_TORSO_REST_SCALE);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.userData.characterPart = 'torso-surface';
  mesh.userData.explodeWithParent = true;
  mesh.userData.meshyTorsoRuntime = {
    schemaVersion: MESHY_TORSO_SCHEMA_VERSION,
    kind: 'meshy-skeleton-tank-top-torso',
    sourceSha256: MESHY_TORSO_ASSET.sourceSha256,
    triangles: MESHY_TORSO_ASSET.triangles,
    restScale: MESHY_TORSO_REST_SCALE,
    restCenterY: MESHY_TORSO_REST_CENTER_Y,
    skinBones: [
      rig.torsoRoot.name,
      rig.spine.name,
      rig.chest.name,
      rig.neck.name,
      rig.clavicleLeft.name,
      rig.clavicleRight.name,
    ],
    attachmentJoint: 'procedural-rider',
    deformationControl: 'deform.torso.length',
  };
  rig.mount.add(mesh);
  rig.mount.updateWorldMatrix(true, true);
  const skeleton = new THREE.Skeleton([
    rig.torsoRoot,
    rig.spine,
    rig.chest,
    rig.neck,
    rig.clavicleLeft,
    rig.clavicleRight,
  ]);
  skeleton.calculateInverses();
  mesh.bind(skeleton, mesh.matrixWorld);
  return {
    mesh,
    skeleton,
    triangles: MESHY_TORSO_ASSET.triangles,
    sourceSha256: MESHY_TORSO_ASSET.sourceSha256,
  };
}
