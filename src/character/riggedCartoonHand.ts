import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeletonHierarchy } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { CartoonGloveRig, CartoonGloveSide } from './cartoonGlove';

export const RIGGED_CARTOON_HAND_ASSET_PATH =
  'characters/three-finger-hand/three-finger-hand.glb';
export const RIGGED_CARTOON_HAND_CREDIT = 'Hand Rig by Andy Cuccaro';

const SEMANTIC_BONE_BASES = Object.freeze([
  'finger-index-proximal',
  'finger-index-middle',
  'finger-index-distal',
  'finger-middle-proximal',
  'finger-middle-middle',
  'finger-middle-distal',
  'finger-outer-proximal',
  'finger-outer-middle',
  'finger-outer-distal',
  'thumb-metacarpal',
  'thumb-proximal',
  'thumb-distal',
] as const);
const IDENTITY_QUATERNION = new THREE.Quaternion();

export interface RiggedCartoonHandSurface {
  readonly side: CartoonGloveSide;
  readonly root: THREE.Object3D;
  readonly meshes: readonly THREE.SkinnedMesh[];
  readonly bonesByName: ReadonlyMap<string, THREE.Bone>;
  readonly triangleCount: number;
  syncFrom(rig: CartoonGloveRig): void;
}

export interface RiggedCartoonHandPair {
  readonly left: RiggedCartoonHandSurface;
  readonly right: RiggedCartoonHandSurface;
  readonly triangleCount: number;
  readonly credit: typeof RIGGED_CARTOON_HAND_CREDIT;
}

let sourceScenePromise: Promise<THREE.Object3D> | null = null;

function sourceScene(): Promise<THREE.Object3D> {
  if (!sourceScenePromise) {
    sourceScenePromise = new GLTFLoader()
      .loadAsync(import.meta.env.BASE_URL + RIGGED_CARTOON_HAND_ASSET_PATH)
      .then(({ scene }) => scene)
      .catch((error) => {
        sourceScenePromise = null;
        throw error;
      });
  }
  return sourceScenePromise;
}

function triangleCount(mesh: THREE.SkinnedMesh): number {
  const geometry = mesh.geometry;
  return (geometry.index?.count ?? geometry.attributes.position.count) / 3;
}

function quaternionArray(value: unknown, label: string): THREE.Quaternion {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) {
    throw new Error(`missing finite ${label} rest quaternion`);
  }
  return new THREE.Quaternion(value[0], value[1], value[2], value[3]).normalize();
}

function vectorArray(value: unknown, label: string): THREE.Vector3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new Error(`missing finite ${label} vector`);
  }
  return new THREE.Vector3(value[0], value[1], value[2]);
}

function isolateMaterials(root: THREE.Object3D): void {
  const clones = new Map<THREE.Material, THREE.Material>();
  const isolated = (material: THREE.Material): THREE.Material => {
    let clone = clones.get(material);
    if (!clone) {
      clone = material.clone();
      clones.set(material, clone);
    }
    return clone;
  };
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(isolated)
      : isolated(mesh.material);
  });
}

class Surface implements RiggedCartoonHandSurface {
  readonly meshes: readonly THREE.SkinnedMesh[];
  readonly bonesByName: ReadonlyMap<string, THREE.Bone>;
  readonly triangleCount: number;
  private readonly orderedBones: readonly THREE.Bone[];
  private readonly restRootQuaternions = new Map<string, THREE.Quaternion>();
  private readonly restRootPositions = new Map<string, THREE.Vector3>();
  private readonly restRootMatrices = new Map<string, THREE.Matrix4>();
  private readonly restLocalScales = new Map<string, THREE.Vector3>();
  private readonly proceduralBones = new Map<string, THREE.Bone>();
  private readonly proceduralRest = new Map<string, THREE.Quaternion>();
  private readonly proceduralRestPositions = new Map<string, THREE.Vector3>();
  private readonly proceduralRestScales = new Map<string, THREE.Vector3>();
  private readonly currentProceduralRootQuaternions = new Map<string, THREE.Quaternion>();
  private readonly targetRootQuaternions = new Map<string, THREE.Quaternion>();
  private readonly targetRootMatrices = new Map<string, THREE.Matrix4>();
  private readonly inverseProceduralRootMatrix = new THREE.Matrix4();
  private readonly inverseSemanticRest = new THREE.Quaternion();
  private readonly localTarget = new THREE.Quaternion();
  private readonly currentSemanticRootPosition = new THREE.Vector3();
  private readonly targetRootPosition = new THREE.Vector3();
  private readonly localTargetPosition = new THREE.Vector3();
  private readonly inverseParentTargetMatrix = new THREE.Matrix4();

  constructor(
    readonly side: CartoonGloveSide,
    readonly root: THREE.Object3D,
  ) {
    const meshes: THREE.SkinnedMesh[] = [];
    const bonesByName = new Map<string, THREE.Bone>();
    root.traverse((object) => {
      const candidate = object as THREE.SkinnedMesh;
      if (!candidate.isSkinnedMesh) return;
      candidate.castShadow = true;
      candidate.receiveShadow = true;
      // The asset's static bounds cannot include every future authored pose.
      candidate.frustumCulled = false;
      candidate.userData.riggedCartoonHandSurface = true;
      meshes.push(candidate);
      for (const bone of candidate.skeleton.bones) {
        const previous = bonesByName.get(bone.name);
        if (previous && previous !== bone) {
          throw new Error(`${side} hand GLB duplicates skeleton bone ${bone.name}`);
        }
        bonesByName.set(bone.name, bone);
      }
    });
    if (meshes.length !== 2) {
      throw new Error(`${side} hand GLB resolved ${meshes.length}/2 skinned material surfaces`);
    }
    const required = [
      `artist-hand-root-${side}`,
      ...SEMANTIC_BONE_BASES.map((base) => `${base}-${side}`),
    ];
    for (const name of required) {
      if (!bonesByName.has(name)) throw new Error(`${side} hand GLB is missing ${name}`);
    }
    if (bonesByName.size !== required.length) {
      throw new Error(`${side} hand GLB exposes ${bonesByName.size}/${required.length} bones`);
    }

    this.meshes = Object.freeze(meshes);
    this.bonesByName = bonesByName;
    this.triangleCount = meshes.reduce((sum, mesh) => sum + triangleCount(mesh), 0);
    this.orderedBones = Object.freeze(
      [...bonesByName.values()]
        .filter((bone) => bone.name !== `artist-hand-root-${side}`)
        .sort((a, b) => this.depth(a) - this.depth(b)),
    );
    for (const bone of this.orderedBones) {
      this.targetRootQuaternions.set(bone.name, new THREE.Quaternion());
      this.targetRootMatrices.set(bone.name, new THREE.Matrix4());
    }

    root.updateWorldMatrix(true, true);
    const inverseRootMatrix = root.matrixWorld.clone().invert();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (const bone of bonesByName.values()) {
      const relative = inverseRootMatrix.clone().multiply(bone.matrixWorld);
      relative.decompose(position, quaternion, scale);
      this.restRootMatrices.set(bone.name, relative);
      this.restRootPositions.set(bone.name, position.clone());
      this.restRootQuaternions.set(bone.name, quaternion.clone().normalize());
      this.restLocalScales.set(bone.name, bone.scale.clone());
    }
  }

  syncFrom(rig: CartoonGloveRig): void {
    if (rig.side !== this.side) {
      throw new Error(`cannot drive ${this.side} artist hand from ${rig.side} semantic glove`);
    }
    if (this.proceduralBones.size === 0) this.bindProceduralRig(rig);
    rig.root.updateWorldMatrix(true, true);
    this.inverseProceduralRootMatrix.copy(rig.root.matrixWorld).invert();

    for (const artistBone of this.orderedBones) {
      const semanticBone = this.proceduralBones.get(artistBone.name);
      const semanticRest = this.proceduralRest.get(artistBone.name);
      const semanticRestPosition = this.proceduralRestPositions.get(artistBone.name);
      const semanticRestScale = this.proceduralRestScales.get(artistBone.name);
      const artistRest = this.restRootQuaternions.get(artistBone.name);
      const artistRestPosition = this.restRootPositions.get(artistBone.name);
      const artistRestScale = this.restLocalScales.get(artistBone.name);
      if (
        !semanticBone || !semanticRest || !semanticRestPosition || !semanticRestScale ||
        !artistRest || !artistRestPosition || !artistRestScale
      ) continue;

      const semanticParent = semanticBone.parent && (semanticBone.parent as THREE.Bone).isBone
        ? semanticBone.parent as THREE.Bone
        : null;
      const semanticParentRoot = semanticParent
        ? this.currentProceduralRootQuaternions.get(semanticParent.name)
        : null;
      if (semanticParent && !semanticParentRoot) {
        throw new Error(`${this.side} semantic parent ${semanticParent.name} was not solved first`);
      }
      const currentSemanticRoot = this.currentProceduralRootQuaternions.get(artistBone.name)!;
      currentSemanticRoot
        .copy(semanticParentRoot ?? IDENTITY_QUATERNION)
        .multiply(semanticBone.quaternion)
        .normalize();
      const targetRoot = this.targetRootQuaternions.get(artistBone.name)!;
      targetRoot
        .copy(currentSemanticRoot)
        .multiply(this.inverseSemanticRest.copy(semanticRest).invert())
        .multiply(artistRest)
        .normalize();

      const parent = artistBone.parent;
      const parentBone = parent && (parent as THREE.Bone).isBone
        ? parent as THREE.Bone
        : null;
      const parentTarget = parentBone
        ? this.targetRootQuaternions.get(parentBone.name) ?? this.restRootQuaternions.get(parentBone.name)
        : null;
      const parentTargetMatrix = parentBone
        ? this.targetRootMatrices.get(parentBone.name) ?? this.restRootMatrices.get(parentBone.name)
        : null;
      this.currentSemanticRootPosition
        .setFromMatrixPosition(semanticBone.matrixWorld)
        .applyMatrix4(this.inverseProceduralRootMatrix);
      this.targetRootPosition
        .copy(artistRestPosition)
        .add(this.currentSemanticRootPosition)
        .sub(semanticRestPosition);
      artistBone.position.copy(parentTargetMatrix
        ? this.localTargetPosition
          .copy(this.targetRootPosition)
          .applyMatrix4(this.inverseParentTargetMatrix.copy(parentTargetMatrix).invert())
        : this.targetRootPosition);
      artistBone.quaternion.copy(parentTarget
        ? this.localTarget.copy(parentTarget).invert().multiply(targetRoot)
        : targetRoot).normalize();
      artistBone.scale.set(
        artistRestScale.x * semanticBone.scale.x / semanticRestScale.x,
        artistRestScale.y * semanticBone.scale.y / semanticRestScale.y,
        artistRestScale.z * semanticBone.scale.z / semanticRestScale.z,
      );
      artistBone.updateMatrix();
      const targetRootMatrix = this.targetRootMatrices.get(artistBone.name)!;
      if (parentTargetMatrix) targetRootMatrix.copy(parentTargetMatrix).multiply(artistBone.matrix);
      else targetRootMatrix.copy(artistBone.matrix);
    }
    this.root.updateWorldMatrix(true, true);
  }

  private bindProceduralRig(rig: CartoonGloveRig): void {
    for (const bone of rig.bones) {
      const artistName = bone.name;
      if (!this.bonesByName.has(artistName)) {
        throw new Error(`${this.side} semantic glove has no artist target for ${artistName}`);
      }
      this.proceduralBones.set(artistName, bone);
      this.currentProceduralRootQuaternions.set(artistName, new THREE.Quaternion());
      this.proceduralRest.set(
        artistName,
        quaternionArray(
          bone.userData.cartoonGloveRestRootQuaternion,
          `${artistName} semantic`,
        ),
      );
      this.proceduralRestPositions.set(
        artistName,
        vectorArray(
          bone.userData.cartoonGloveRestRootPosition,
          `${artistName} semantic rest position`,
        ),
      );
      this.proceduralRestScales.set(
        artistName,
        vectorArray(
          bone.userData.cartoonGloveRestLocalScale,
          `${artistName} semantic rest scale`,
        ),
      );
    }
    if (this.proceduralBones.size !== SEMANTIC_BONE_BASES.length) {
      throw new Error(
        `${this.side} semantic glove exposes ${this.proceduralBones.size}/${SEMANTIC_BONE_BASES.length} bones`,
      );
    }
  }

  private depth(object: THREE.Object3D): number {
    let depth = 0;
    for (let node = object.parent; node && node !== this.root; node = node.parent) depth++;
    return depth;
  }
}

export function createRiggedCartoonHandPairFromScene(
  source: THREE.Object3D,
): RiggedCartoonHandPair {
  const scene = cloneSkeletonHierarchy(source);
  isolateMaterials(scene);
  const roots = {
    left: scene.getObjectByName('artist-hand-left'),
    right: scene.getObjectByName('artist-hand-right'),
  };
  if (!roots.left || !roots.right) throw new Error('artist hand GLB is missing its left/right roots');
  roots.left.removeFromParent();
  roots.right.removeFromParent();
  const left = new Surface('left', roots.left);
  const right = new Surface('right', roots.right);
  return {
    left,
    right,
    triangleCount: left.triangleCount + right.triangleCount,
    credit: RIGGED_CARTOON_HAND_CREDIT,
  };
}

/** Attach and validate both surfaces as one transaction. */
export function attachAndSyncRiggedCartoonHandPair(
  pair: RiggedCartoonHandPair,
  left: CartoonGloveRig,
  right: CartoonGloveRig,
): void {
  left.root.add(pair.left.root);
  right.root.add(pair.right.root);
  try {
    pair.left.syncFrom(left);
    pair.right.syncFrom(right);
  } catch (error) {
    pair.left.root.removeFromParent();
    pair.right.root.removeFromParent();
    throw error;
  }
}

export async function loadRiggedCartoonHandPair(): Promise<RiggedCartoonHandPair> {
  return createRiggedCartoonHandPairFromScene(await sourceScene());
}
