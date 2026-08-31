import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Free female mannequin from Quaternius' Universal Animation Library 2.
 *
 * The file is deliberately loaded as-authored: its two weighted primitives and
 * 65-bone skeleton remain intact.  This module only adds relative morph targets
 * to the loaded geometry and drives the original bones at runtime.
 */
export const QUATERNIUS_FEMALE_MODEL_PATH =
  'characters/quaternius-female/mannequin-f.glb' as const;

export const QUATERNIUS_EXPECTED_TARGET_BONE_COUNT = 65 as const;

export const QUATERNIUS_TARGET_BONE_NAMES = [
  'root',
  'pelvis',
  'spine_01',
  'spine_02',
  'spine_03',
  'neck_01',
  'Head',
  'clavicle_l',
  'upperarm_l',
  'lowerarm_l',
  'hand_l',
  'index_01_l',
  'index_02_l',
  'index_03_l',
  'index_04_leaf_l',
  'middle_01_l',
  'middle_02_l',
  'middle_03_l',
  'middle_04_leaf_l',
  'pinky_01_l',
  'pinky_02_l',
  'pinky_03_l',
  'pinky_04_leaf_l',
  'ring_01_l',
  'ring_02_l',
  'ring_03_l',
  'ring_04_leaf_l',
  'thumb_01_l',
  'thumb_02_l',
  'thumb_03_l',
  'thumb_04_leaf_l',
  'clavicle_r',
  'upperarm_r',
  'lowerarm_r',
  'hand_r',
  'index_01_r',
  'index_02_r',
  'index_03_r',
  'index_04_leaf_r',
  'middle_01_r',
  'middle_02_r',
  'middle_03_r',
  'middle_04_leaf_r',
  'pinky_01_r',
  'pinky_02_r',
  'pinky_03_r',
  'pinky_04_leaf_r',
  'ring_01_r',
  'ring_02_r',
  'ring_03_r',
  'ring_04_leaf_r',
  'thumb_01_r',
  'thumb_02_r',
  'thumb_03_r',
  'thumb_04_leaf_r',
  'thigh_l',
  'calf_l',
  'foot_l',
  'ball_l',
  'ball_leaf_l',
  'thigh_r',
  'calf_r',
  'foot_r',
  'ball_r',
  'ball_leaf_r',
] as const;

export type QuaterniusTargetBoneName = typeof QUATERNIUS_TARGET_BONE_NAMES[number];

/**
 * Explicit interchange map.  A null entry is intentional: fingers keep their
 * authored local rest pose and inherit the mapped hand, while the target root
 * keeps the model's Y-up coordinate correction.  No target bone is silently
 * guessed by punctuation or name similarity.
 */
export const QUATERNIUS_TARGET_TO_SOURCE_BONE: Readonly<
  Record<QuaterniusTargetBoneName, string | null>
> = Object.freeze({
  root: null,
  pelvis: 'hips',
  spine_01: 'torso-root',
  spine_02: 'spine',
  spine_03: 'chest',
  neck_01: 'neck',
  Head: 'head',
  clavicle_l: 'clavicle-left',
  upperarm_l: 'shoulder-left',
  lowerarm_l: 'elbow-left',
  hand_l: 'wrist-left',
  index_01_l: null,
  index_02_l: null,
  index_03_l: null,
  index_04_leaf_l: null,
  middle_01_l: null,
  middle_02_l: null,
  middle_03_l: null,
  middle_04_leaf_l: null,
  pinky_01_l: null,
  pinky_02_l: null,
  pinky_03_l: null,
  pinky_04_leaf_l: null,
  ring_01_l: null,
  ring_02_l: null,
  ring_03_l: null,
  ring_04_leaf_l: null,
  thumb_01_l: null,
  thumb_02_l: null,
  thumb_03_l: null,
  thumb_04_leaf_l: null,
  clavicle_r: 'clavicle-right',
  upperarm_r: 'shoulder-right',
  lowerarm_r: 'elbow-right',
  hand_r: 'wrist-right',
  index_01_r: null,
  index_02_r: null,
  index_03_r: null,
  index_04_leaf_r: null,
  middle_01_r: null,
  middle_02_r: null,
  middle_03_r: null,
  middle_04_leaf_r: null,
  pinky_01_r: null,
  pinky_02_r: null,
  pinky_03_r: null,
  pinky_04_leaf_r: null,
  ring_01_r: null,
  ring_02_r: null,
  ring_03_r: null,
  ring_04_leaf_r: null,
  thumb_01_r: null,
  thumb_02_r: null,
  thumb_03_r: null,
  thumb_04_leaf_r: null,
  thigh_l: 'hip-left',
  calf_l: 'knee-left',
  foot_l: 'ankle-left',
  ball_l: 'toe-left',
  ball_leaf_l: null,
  thigh_r: 'hip-right',
  calf_r: 'knee-right',
  foot_r: 'ankle-right',
  ball_r: 'toe-right',
  ball_leaf_r: null,
});

export interface QuaterniusDeformationSegment {
  id: string;
  targetBone: QuaterniusTargetBoneName;
  targetEndpoint: QuaterniusTargetBoneName;
}

/** The ten independently stretchable sections published by the player rig. */
export const QUATERNIUS_DEFORMATION_SEGMENTS: readonly QuaterniusDeformationSegment[] =
  Object.freeze([
    { id: 'torso.lower', targetBone: 'spine_02', targetEndpoint: 'spine_03' },
    { id: 'torso.upper', targetBone: 'spine_03', targetEndpoint: 'neck_01' },
    { id: 'arm.upper.left', targetBone: 'upperarm_l', targetEndpoint: 'lowerarm_l' },
    { id: 'arm.lower.left', targetBone: 'lowerarm_l', targetEndpoint: 'hand_l' },
    { id: 'arm.upper.right', targetBone: 'upperarm_r', targetEndpoint: 'lowerarm_r' },
    { id: 'arm.lower.right', targetBone: 'lowerarm_r', targetEndpoint: 'hand_r' },
    { id: 'leg.upper.left', targetBone: 'thigh_l', targetEndpoint: 'calf_l' },
    { id: 'leg.lower.left', targetBone: 'calf_l', targetEndpoint: 'foot_l' },
    { id: 'leg.upper.right', targetBone: 'thigh_r', targetEndpoint: 'calf_r' },
    { id: 'leg.lower.right', targetBone: 'calf_r', targetEndpoint: 'foot_r' },
  ] satisfies QuaterniusDeformationSegment[]);

export type QuaterniusEvaluationReadiness = 'loading' | 'ready' | 'error' | 'disposed';

export interface QuaterniusEvaluationModelOptions {
  /** Evaluation-model root is attached here immediately, before async loading. */
  parent: THREE.Object3D;
  /** Root carrying sculptRuntime bind/retarget metadata for the source rig. */
  sourceRoot: THREE.Object3D;
  /**
   * Stable pose-space root shared with `parent`.  Pass the rider root when
   * sourceRoot is a scaled/animated body child, so source root motion is not
   * applied once in retargeting and again by the evaluation-model parent.
   * Defaults to sourceRoot for standalone rigs.
   */
  sourcePoseRoot?: THREE.Object3D;
  /** The live 22-bone source skeleton after all animation layers/deformations. */
  sourceSkeleton: THREE.Skeleton;
  /** Defaults to BASE_URL + QUATERNIUS_FEMALE_MODEL_PATH. */
  assetUrl?: string;
  /** Hidden by default so an async load cannot flash over the production body. */
  visible?: boolean;
  /** Injectable only for harnesses; normal runtime uses GLTFLoader directly. */
  loader?: GLTFLoader;
}

export interface QuaterniusShoulderCorrectiveWeights {
  elevation: number;
  forward: number;
}

type QuaterniusContactKey = 'footLeft' | 'footRight' | 'handLeft' | 'handRight';

export interface QuaterniusEvaluationDiagnostics {
  readiness: QuaterniusEvaluationReadiness;
  assetUrl: string;
  error: string | null;
  expectedTargetBoneCount: number;
  targetBoneCount: number;
  targetSkeletonCount: number;
  mappedTargetBoneCount: number;
  unmappedTargetBoneNames: string[];
  missingSourceBoneNames: string[];
  skinnedMeshCount: number;
  vertexCount: number;
  triangleCount: number;
  generatedMorphTargetCount: number;
  generatedNormalMorphTargetCount: number;
  updateCount: number;
  lengthScales: Record<string, number>;
  shoulderCorrectives: {
    left: QuaterniusShoulderCorrectiveWeights;
    right: QuaterniusShoulderCorrectiveWeights;
  };
  /**
   * Distance in target-local world units between the end joint and the source
   * presentation socket after the two-bone solve. Null means no such source
   * socket was published by the current source rig.
   */
  contactErrors: Record<QuaterniusContactKey, number | null>;
  boundsSize: [number, number, number];
}

interface LocalTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface SourceBinding {
  root: THREE.Object3D;
  skeleton: THREE.Skeleton;
  bonesByName: Map<string, THREE.Bone>;
  canonicalMatrices: Map<THREE.Bone, THREE.Matrix4>;
  canonicalQuaternions: Map<THREE.Bone, THREE.Quaternion>;
  restHeight: number;
}

interface TargetSkeletonBinding {
  skeleton: THREE.Skeleton;
  bonesByName: Map<string, THREE.Bone>;
  restHeight: number;
  footContactOffsets: { left: THREE.Vector3; right: THREE.Vector3 };
  handContactOffsets: { left: THREE.Vector3; right: THREE.Vector3 };
}

interface TwoBoneChain {
  root: QuaterniusTargetBoneName;
  middle: QuaterniusTargetBoneName;
  end: QuaterniusTargetBoneName;
}

interface MeshMorphBinding {
  mesh: THREE.SkinnedMesh;
  volumeIndices: Map<string, number>;
  shoulderIndices: {
    leftElevation: number;
    leftForward: number;
    rightElevation: number;
    rightForward: number;
  };
}

type UnknownRecord = Record<string, unknown>;

const _position = new THREE.Vector3();
const _otherPosition = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _otherQuaternion = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _axis = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _forward = new THREE.Vector3(0, 0, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _down = new THREE.Vector3(0, -1, 0);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function finiteTuple(value: unknown, size: number): value is number[] {
  return Array.isArray(value) && value.length === size && value.every(Number.isFinite);
}

function cloneLocal(node: THREE.Object3D): LocalTransform {
  return {
    position: node.position.clone(),
    quaternion: node.quaternion.clone().normalize(),
    scale: node.scale.clone(),
  };
}

function cloneTransform(transform: LocalTransform): LocalTransform {
  return {
    position: transform.position.clone(),
    quaternion: transform.quaternion.clone(),
    scale: transform.scale.clone(),
  };
}

function transformFromMetadata(value: unknown, fallback: LocalTransform): LocalTransform {
  if (!isRecord(value)) return cloneTransform(fallback);
  const result = cloneTransform(fallback);
  if (finiteTuple(value.position, 3)) result.position.fromArray(value.position);
  if (finiteTuple(value.quaternion, 4)) {
    result.quaternion.fromArray(value.quaternion);
    if (result.quaternion.lengthSq() < 1e-12) result.quaternion.identity();
    else result.quaternion.normalize();
  }
  if (finiteTuple(value.scale, 3)) result.scale.fromArray(value.scale);
  return result;
}

function matrixFromTransform(transform: LocalTransform, target = new THREE.Matrix4()): THREE.Matrix4 {
  return target.compose(transform.position, transform.quaternion, transform.scale);
}

function decomposeTransform(matrix: THREE.Matrix4): LocalTransform {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(position, quaternion, scale);
  return { position, quaternion: quaternion.normalize(), scale };
}

function runtimeMetadata(root: THREE.Object3D): UnknownRecord | null {
  if (isRecord(root.userData.sculptRuntime)) return root.userData.sculptRuntime;
  let result: UnknownRecord | null = null;
  root.traverse((candidate) => {
    if (!result && isRecord(candidate.userData.sculptRuntime)) {
      result = candidate.userData.sculptRuntime;
    }
  });
  return result;
}

function metadataRecord(runtime: UnknownRecord | null, key: string): UnknownRecord {
  if (!runtime) return {};
  const humanoid = isRecord(runtime.humanoid) ? runtime.humanoid : {};
  return {
    ...(isRecord(runtime[key]) ? runtime[key] as UnknownRecord : {}),
    ...(isRecord(humanoid[key]) ? humanoid[key] as UnknownRecord : {}),
  };
}

function metadataJointNames(runtime: UnknownRecord | null): Map<string, string> {
  const result = new Map<string, string>();
  if (!runtime || !isRecord(runtime.joints)) return result;
  for (const [semantic, raw] of Object.entries(runtime.joints)) {
    if (typeof raw === 'string') result.set(semantic, raw);
    else if (isRecord(raw)) {
      const name = typeof raw.nodeName === 'string' ? raw.nodeName : raw.name;
      if (typeof name === 'string') result.set(semantic, name);
    }
  }
  return result;
}

function boneRestTransforms(
  skeleton: THREE.Skeleton,
  sourceRoot: THREE.Object3D,
): { rest: Map<THREE.Bone, LocalTransform>; canonical: Map<THREE.Bone, LocalTransform> } {
  const bones = skeleton.bones;
  const boneSet = new Set(bones);
  const bindWorld = new Map<THREE.Bone, THREE.Matrix4>();
  for (let i = 0; i < bones.length; i++) {
    const inverse = skeleton.boneInverses[i];
    if (inverse) bindWorld.set(bones[i], inverse.clone().invert());
  }

  const rest = new Map<THREE.Bone, LocalTransform>();
  for (const bone of bones) {
    const world = bindWorld.get(bone);
    const parent = bone.parent;
    const parentWorld = parent && (parent as THREE.Bone).isBone && boneSet.has(parent as THREE.Bone)
      ? bindWorld.get(parent as THREE.Bone)
      : undefined;
    // For a root bone, the inverse bind contains transforms above the
    // skeleton.  Its Object3D local is the useful skeleton-relative rest.
    const local = world && parentWorld
      ? decomposeTransform(_matrix.copy(parentWorld).invert().multiply(world))
      : cloneLocal(bone);
    rest.set(bone, local);
  }

  const runtime = runtimeMetadata(sourceRoot);
  const semanticNames = metadataJointNames(runtime);
  const semanticByNodeName = new Map<string, string>();
  for (const [semantic, nodeName] of semanticNames) semanticByNodeName.set(nodeName, semantic);
  const bindPose = metadataRecord(runtime, 'bindPose');
  const retargetPose = {
    ...metadataRecord(runtime, 'retargetPose'),
    ...metadataRecord(runtime, 'canonicalTPose'),
  };

  for (const bone of bones) {
    const semantic = semanticByNodeName.get(bone.name);
    const fallback = rest.get(bone)!;
    if (semantic && isRecord(bindPose[semantic])) {
      rest.set(bone, transformFromMetadata(bindPose[semantic], fallback));
    }
  }

  const canonical = new Map<THREE.Bone, LocalTransform>();
  for (const bone of bones) {
    const semantic = semanticByNodeName.get(bone.name);
    const fallback = rest.get(bone)!;
    const published = semantic ? retargetPose[semantic] : undefined;
    canonical.set(bone, transformFromMetadata(published, fallback));
  }

  // The production source publishes these values.  Keeping the fallback here
  // also makes a conventional source skeleton useful in isolated harnesses.
  const leftShoulder = bones.find((bone) => bone.name === 'shoulder-left');
  const rightShoulder = bones.find((bone) => bone.name === 'shoulder-right');
  if (leftShoulder && !semanticByNodeName.has(leftShoulder.name)) {
    canonical.get(leftShoulder)!.quaternion.set(0, 0, Math.SQRT1_2, Math.SQRT1_2);
  }
  if (rightShoulder && !semanticByNodeName.has(rightShoulder.name)) {
    canonical.get(rightShoulder)!.quaternion.set(0, 0, -Math.SQRT1_2, Math.SQRT1_2);
  }
  return { rest, canonical };
}

/**
 * Bone matrices in a stable root-local world.  Skeleton roots often sit below
 * an Armature/scene correction node, so accumulating only bone parents loses
 * an important part of both the bind pose and the canonical T-pose.
 */
function relativeBoneMatrices(
  root: THREE.Object3D,
  bones: readonly THREE.Bone[],
  localTransform: (bone: THREE.Bone) => LocalTransform,
): Map<THREE.Bone, THREE.Matrix4> {
  // Populate matrix for static non-bone ancestors before using it below.
  root.updateWorldMatrix(true, true);
  const boneSet = new Set(bones);
  const matrices = new Map<THREE.Object3D, THREE.Matrix4>();
  const visiting = new Set<THREE.Object3D>();
  const resolve = (node: THREE.Object3D): THREE.Matrix4 => {
    if (node === root) return new THREE.Matrix4();
    const existing = matrices.get(node);
    if (existing) return existing;
    if (visiting.has(node)) throw new Error(`object hierarchy contains a cycle at "${node.name}"`);
    if (!node.parent) {
      throw new Error(`bone "${node.name}" is not a descendant of "${root.name || 'source root'}"`);
    }
    visiting.add(node);
    const parent = resolve(node.parent);
    const local = boneSet.has(node as THREE.Bone)
      ? matrixFromTransform(localTransform(node as THREE.Bone))
      : node.matrix.clone();
    const world = parent.clone().multiply(local);
    matrices.set(node, world);
    visiting.delete(node);
    return world;
  };
  const result = new Map<THREE.Bone, THREE.Matrix4>();
  for (const bone of bones) result.set(bone, resolve(bone));
  return result;
}

function currentRelativeBoneMatrices(
  root: THREE.Object3D,
  bones: readonly THREE.Bone[],
): Map<THREE.Bone, THREE.Matrix4> {
  root.updateWorldMatrix(true, true);
  const rootInverse = root.matrixWorld.clone().invert();
  const result = new Map<THREE.Bone, THREE.Matrix4>();
  for (const bone of bones) result.set(bone, rootInverse.clone().multiply(bone.matrixWorld));
  return result;
}

function matrixQuaternions(
  matrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
): Map<THREE.Bone, THREE.Quaternion> {
  const result = new Map<THREE.Bone, THREE.Quaternion>();
  for (const [bone, matrix] of matrices) {
    matrix.decompose(_position, _quaternion, _scale);
    result.set(bone, _quaternion.clone().normalize());
  }
  return result;
}

function skeletonHeight(
  matrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  bonesByName: ReadonlyMap<string, THREE.Bone>,
): number {
  const names = ['head', 'Head', 'toe-left', 'toe-right', 'ball_l', 'ball_r'];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const name of names) {
    const bone = bonesByName.get(name);
    const matrix = bone ? matrices.get(bone) : undefined;
    if (!matrix) continue;
    _position.setFromMatrixPosition(matrix);
    minY = Math.min(minY, _position.y);
    maxY = Math.max(maxY, _position.y);
  }
  if (Number.isFinite(minY) && Number.isFinite(maxY) && maxY - minY > 1e-6) {
    return maxY - minY;
  }
  for (const matrix of matrices.values()) {
    _position.setFromMatrixPosition(matrix);
    minY = Math.min(minY, _position.y);
    maxY = Math.max(maxY, _position.y);
  }
  return Number.isFinite(minY) && Number.isFinite(maxY) ? Math.max(maxY - minY, 1) : 1;
}

function makeSourceBinding(
  metadataRoot: THREE.Object3D,
  skeleton: THREE.Skeleton,
  poseRoot = metadataRoot,
): SourceBinding {
  const bonesByName = new Map<string, THREE.Bone>();
  for (const bone of skeleton.bones) {
    if (bonesByName.has(bone.name)) throw new Error(`source skeleton has duplicate bone "${bone.name}"`);
    bonesByName.set(bone.name, bone);
  }
  const required = [...new Set(Object.values(QUATERNIUS_TARGET_TO_SOURCE_BONE)
    .filter((name): name is string => name !== null))];
  const missing = required.filter((name) => !bonesByName.has(name));
  if (missing.length > 0) {
    throw new Error(`source skeleton is missing mapped bones: ${missing.join(', ')}`);
  }
  const poses = boneRestTransforms(skeleton, metadataRoot);
  const canonicalMatrices = relativeBoneMatrices(
    poseRoot,
    skeleton.bones,
    (bone) => poses.canonical.get(bone)!,
  );
  return {
    root: poseRoot,
    skeleton,
    bonesByName,
    canonicalMatrices,
    canonicalQuaternions: matrixQuaternions(canonicalMatrices),
    restHeight: skeletonHeight(canonicalMatrices, bonesByName),
  };
}

function getAttributeComponent(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertex: number,
  component: number,
): number {
  if (component === 0) return attribute.getX(vertex);
  if (component === 1) return attribute.getY(vertex);
  if (component === 2) return attribute.getZ(vertex);
  return attribute.getW(vertex);
}

function boneWeight(
  mesh: THREE.SkinnedMesh,
  vertex: number,
  boneIndex: number,
): number {
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  if (!indices || !weights) return 0;
  let result = 0;
  for (let component = 0; component < Math.min(indices.itemSize, 4); component++) {
    if (getAttributeComponent(indices, vertex, component) === boneIndex) {
      result += getAttributeComponent(weights, vertex, component);
    }
  }
  return result;
}

function weightedBoneIndices(skeleton: THREE.Skeleton, names: readonly string[]): number[] {
  return names
    .map((name) => skeleton.bones.findIndex((bone) => bone.name === name))
    .filter((index) => index >= 0);
}

function bindPointInScene(
  sceneInverse: THREE.Matrix4,
  mesh: THREE.SkinnedMesh,
  vertex: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const position = mesh.geometry.getAttribute('position');
  if (!position) throw new Error(`skinned mesh "${mesh.name}" has no positions`);
  return target.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld).applyMatrix4(sceneInverse);
}

/**
 * A foot's contact point is the low band of vertices materially driven by its
 * foot/toe joints.  Keeping this in the foot bone's bind-local space means it
 * follows the target foot through IK instead of treating the ankle as a sole.
 */
function lowestWeightedBindOffset(
  scene: THREE.Object3D,
  meshes: readonly THREE.SkinnedMesh[],
  binding: TargetSkeletonBinding,
  boneNames: readonly string[],
): THREE.Vector3 {
  const indicesByMesh = new Map<THREE.SkinnedMesh, number[]>();
  let minY = Infinity;
  const sceneInverse = scene.matrixWorld.clone().invert();
  for (const mesh of meshes) {
    if (mesh.skeleton !== binding.skeleton) continue;
    const indices = weightedBoneIndices(mesh.skeleton, boneNames);
    if (indices.length === 0) continue;
    indicesByMesh.set(mesh, indices);
    const position = mesh.geometry.getAttribute('position');
    if (!position) continue;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = indices.reduce((sum, index) => sum + boneWeight(mesh, vertex, index), 0);
      if (support < 0.2) continue;
      const point = bindPointInScene(sceneInverse, mesh, vertex, _position);
      minY = Math.min(minY, point.y);
    }
  }
  const footBone = binding.bonesByName.get(boneNames[0]);
  if (!footBone || !Number.isFinite(minY)) return new THREE.Vector3();

  const centre = new THREE.Vector3();
  let totalWeight = 0;
  const lowBand = 0.015;
  for (const [mesh, indices] of indicesByMesh) {
    const position = mesh.geometry.getAttribute('position');
    if (!position) continue;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = indices.reduce((sum, index) => sum + boneWeight(mesh, vertex, index), 0);
      if (support < 0.2) continue;
      const point = bindPointInScene(sceneInverse, mesh, vertex, _position);
      const fromFloor = point.y - minY;
      if (fromFloor > lowBand) continue;
      const weight = support * (1 - fromFloor / lowBand);
      centre.addScaledVector(point, weight);
      totalWeight += weight;
    }
  }
  if (totalWeight <= 1e-6) return new THREE.Vector3();
  centre.multiplyScalar(1 / totalWeight);
  const inverseBone = footBone.matrixWorld.clone().premultiply(sceneInverse).invert();
  return centre.applyMatrix4(inverseBone);
}

function weightedBindCentroidOffset(
  scene: THREE.Object3D,
  meshes: readonly THREE.SkinnedMesh[],
  binding: TargetSkeletonBinding,
  boneName: string,
): THREE.Vector3 {
  const bone = binding.bonesByName.get(boneName);
  if (!bone) return new THREE.Vector3();
  const sceneInverse = scene.matrixWorld.clone().invert();
  const centre = new THREE.Vector3();
  let totalWeight = 0;
  for (const mesh of meshes) {
    if (mesh.skeleton !== binding.skeleton) continue;
    const index = mesh.skeleton.bones.indexOf(bone);
    const position = mesh.geometry.getAttribute('position');
    if (index < 0 || !position) continue;
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = boneWeight(mesh, vertex, index);
      if (support < 0.2) continue;
      centre.addScaledVector(bindPointInScene(sceneInverse, mesh, vertex, _position), support);
      totalWeight += support;
    }
  }
  if (totalWeight <= 1e-6) return new THREE.Vector3();
  centre.multiplyScalar(1 / totalWeight);
  return centre.applyMatrix4(bone.matrixWorld.clone().premultiply(sceneInverse).invert());
}

function smoothUnit(value: number): number {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function appendRelativeMorph(
  mesh: THREE.SkinnedMesh,
  name: string,
  deltas: Float32Array,
): number {
  const geometry = mesh.geometry;
  const positionTargets = geometry.morphAttributes.position ?? [];
  const normalTargets = geometry.morphAttributes.normal ?? [];
  if (positionTargets.length > 0 && !geometry.morphTargetsRelative) {
    throw new Error(`cannot append relative morph "${name}" to absolute morph geometry`);
  }
  if (normalTargets.length !== positionTargets.length) {
    throw new Error(`cannot append relative morph "${name}" to mismatched normal targets`);
  }
  geometry.morphTargetsRelative = true;
  const position = new THREE.Float32BufferAttribute(deltas, 3);
  position.name = name;
  const normal = new THREE.Float32BufferAttribute(relativeNormalDeltas(mesh, deltas), 3);
  normal.name = name;
  positionTargets.push(position);
  normalTargets.push(normal);
  geometry.morphAttributes.position = positionTargets;
  geometry.morphAttributes.normal = normalTargets;
  return positionTargets.length - 1;
}

/** Recompute a fully deformed normal field, then store it as a relative delta. */
function relativeNormalDeltas(mesh: THREE.SkinnedMesh, deltas: Float32Array): Float32Array {
  const geometry = mesh.geometry;
  const sourcePosition = geometry.getAttribute('position');
  if (!sourcePosition || !geometry.getAttribute('normal')) {
    throw new Error(`skinned mesh "${mesh.name}" needs positions and normals for morph correctives`);
  }
  const basePositions = new Float32Array(sourcePosition.count * 3);
  const deformedPositions = new Float32Array(sourcePosition.count * 3);
  for (let vertex = 0; vertex < sourcePosition.count; vertex++) {
    const offset = vertex * 3;
    basePositions[offset] = sourcePosition.getX(vertex);
    basePositions[offset + 1] = sourcePosition.getY(vertex);
    basePositions[offset + 2] = sourcePosition.getZ(vertex);
    deformedPositions[offset] = basePositions[offset] + deltas[offset];
    deformedPositions[offset + 1] = basePositions[offset + 1] + deltas[offset + 1];
    deformedPositions[offset + 2] = basePositions[offset + 2] + deltas[offset + 2];
  }
  const computeNormals = (positions: Float32Array): Float32Array => {
    const temporary = new THREE.BufferGeometry();
    temporary.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (geometry.index) temporary.setIndex(geometry.index);
    temporary.computeVertexNormals();
    const normal = temporary.getAttribute('normal');
    const result = new Float32Array(positions.length);
    for (let vertex = 0; vertex < sourcePosition.count; vertex++) {
      const offset = vertex * 3;
      result[offset] = normal.getX(vertex);
      result[offset + 1] = normal.getY(vertex);
      result[offset + 2] = normal.getZ(vertex);
    }
    temporary.dispose();
    return result;
  };
  const baseNormals = computeNormals(basePositions);
  const deformedNormals = computeNormals(deformedPositions);
  const result = new Float32Array(basePositions.length);
  for (let index = 0; index < result.length; index++) result[index] = deformedNormals[index] - baseNormals[index];
  return result;
}

function bindRestMatrix(skeleton: THREE.Skeleton, boneName: string): THREE.Matrix4 {
  const index = skeleton.bones.findIndex((bone) => bone.name === boneName);
  if (index < 0 || !skeleton.boneInverses[index]) {
    throw new Error(`target skeleton cannot resolve bind matrix for "${boneName}"`);
  }
  return skeleton.boneInverses[index].clone().invert();
}

function radialMorphDeltas(
  mesh: THREE.SkinnedMesh,
  segment: QuaterniusDeformationSegment,
): Float32Array {
  const position = mesh.geometry.getAttribute('position');
  if (!position) throw new Error(`skinned mesh "${mesh.name}" has no positions`);
  const skeleton = mesh.skeleton;
  const boneIndex = skeleton.bones.findIndex((bone) => bone.name === segment.targetBone);
  if (boneIndex < 0) throw new Error(`target segment bone "${segment.targetBone}" is missing`);
  const start = bindRestMatrix(skeleton, segment.targetBone);
  const end = bindRestMatrix(skeleton, segment.targetEndpoint);
  const origin = new THREE.Vector3().setFromMatrixPosition(start);
  const endpoint = new THREE.Vector3().setFromMatrixPosition(end);
  const axis = endpoint.sub(origin).normalize();
  const inverseBind = mesh.bindMatrix.clone().invert();
  const inverseBindDirection = new THREE.Matrix3().setFromMatrix4(inverseBind);
  const deltas = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const support = boneWeight(mesh, vertex, boneIndex);
    if (support <= 1e-6) continue;
    _position.fromBufferAttribute(position, vertex).applyMatrix4(mesh.bindMatrix);
    _radial.copy(_position).sub(origin);
    _radial.addScaledVector(axis, -_radial.dot(axis));
    _delta.copy(_radial).multiplyScalar(support).applyMatrix3(inverseBindDirection);
    const offset = vertex * 3;
    deltas[offset] = _delta.x;
    deltas[offset + 1] = _delta.y;
    deltas[offset + 2] = _delta.z;
  }
  return deltas;
}

function shoulderMorphDeltas(
  mesh: THREE.SkinnedMesh,
  side: 'left' | 'right',
  kind: 'elevation' | 'forward',
): Float32Array {
  const suffix = side === 'left' ? '_l' : '_r';
  const upperName = `upperarm${suffix}`;
  const lowerName = `lowerarm${suffix}`;
  const clavicleName = `clavicle${suffix}`;
  const skeleton = mesh.skeleton;
  const upperIndex = skeleton.bones.findIndex((bone) => bone.name === upperName);
  const clavicleIndex = skeleton.bones.findIndex((bone) => bone.name === clavicleName);
  const chestIndex = skeleton.bones.findIndex((bone) => bone.name === 'spine_03');
  if (upperIndex < 0 || clavicleIndex < 0 || chestIndex < 0) {
    throw new Error(`target ${side} shoulder corrective cannot resolve its bones`);
  }
  const start = bindRestMatrix(skeleton, upperName);
  const end = bindRestMatrix(skeleton, lowerName);
  const origin = new THREE.Vector3().setFromMatrixPosition(start);
  const endpoint = new THREE.Vector3().setFromMatrixPosition(end);
  const armAxis = endpoint.sub(origin);
  const armLength = Math.max(armAxis.length(), 1e-4);
  armAxis.normalize();
  const radius = armLength * 0.72;
  const position = mesh.geometry.getAttribute('position');
  if (!position) throw new Error(`skinned mesh "${mesh.name}" has no positions`);
  const inverseBindDirection = new THREE.Matrix3().setFromMatrix4(mesh.bindMatrix.clone().invert());
  const deltas = new Float32Array(position.count * 3);
  for (let vertex = 0; vertex < position.count; vertex++) {
    const skinSupport = THREE.MathUtils.clamp(
      boneWeight(mesh, vertex, upperIndex) +
      boneWeight(mesh, vertex, clavicleIndex) * 0.65 +
      boneWeight(mesh, vertex, chestIndex) * 0.22,
      0,
      1,
    );
    if (skinSupport <= 1e-6) continue;
    _position.fromBufferAttribute(position, vertex).applyMatrix4(mesh.bindMatrix);
    const distance = _position.distanceTo(origin);
    if (distance >= radius) continue;
    const falloff = smoothUnit(1 - distance / radius) * skinSupport;
    _radial.copy(_position).sub(origin);
    _radial.addScaledVector(armAxis, -_radial.dot(armAxis));
    if (_radial.lengthSq() > 1e-10) _radial.normalize();
    if (kind === 'elevation') {
      // Deltoid cap inflation plus a small upward lift keeps the shoulder
      // round instead of pinching into the clavicle as the arm rises.
      _delta.copy(_radial).multiplyScalar(armLength * 0.075);
      _delta.addScaledVector(_up, armLength * 0.035);
    } else {
      // A signed runtime weight turns this anterior bulge into the matching
      // posterior correction for backward reaches.
      _delta.copy(_forward).multiplyScalar(armLength * 0.08);
      _delta.addScaledVector(_radial, armLength * 0.018);
    }
    _delta.multiplyScalar(falloff).applyMatrix3(inverseBindDirection);
    const offset = vertex * 3;
    deltas[offset] = _delta.x;
    deltas[offset + 1] = _delta.y;
    deltas[offset + 2] = _delta.z;
  }
  return deltas;
}

function installMorphs(mesh: THREE.SkinnedMesh): MeshMorphBinding {
  // GLTFLoader can share BufferGeometry between scene instances.  The source
  // asset stays immutable so an evaluation load cannot leak generated targets
  // into another mannequin or an editor preview.
  mesh.geometry = mesh.geometry.clone();
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (!mesh.geometry.getAttribute('skinIndex') || !mesh.geometry.getAttribute('skinWeight')) {
    throw new Error(`skinned mesh "${mesh.name}" has no four-weight skin attributes`);
  }
  const volumeIndices = new Map<string, number>();
  for (const segment of QUATERNIUS_DEFORMATION_SEGMENTS) {
    const name = `sol-volume:${segment.id}`;
    volumeIndices.set(segment.id, appendRelativeMorph(mesh, name, radialMorphDeltas(mesh, segment)));
  }
  const shoulderIndices = {
    leftElevation: appendRelativeMorph(
      mesh,
      'sol-corrective:shoulder.left.elevation',
      shoulderMorphDeltas(mesh, 'left', 'elevation'),
    ),
    leftForward: appendRelativeMorph(
      mesh,
      'sol-corrective:shoulder.left.forward',
      shoulderMorphDeltas(mesh, 'left', 'forward'),
    ),
    rightElevation: appendRelativeMorph(
      mesh,
      'sol-corrective:shoulder.right.elevation',
      shoulderMorphDeltas(mesh, 'right', 'elevation'),
    ),
    rightForward: appendRelativeMorph(
      mesh,
      'sol-corrective:shoulder.right.forward',
      shoulderMorphDeltas(mesh, 'right', 'forward'),
    ),
  };
  mesh.updateMorphTargets();
  return { mesh, volumeIndices, shoulderIndices };
}

function disposeScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if ((value as THREE.Texture | undefined)?.isTexture) textures.add(value as THREE.Texture);
        }
      }
    }
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh) skeletons.add(skinned.skeleton);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

function defaultAssetUrl(): string {
  return `${import.meta.env.BASE_URL}${QUATERNIUS_FEMALE_MODEL_PATH}`;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  const count = geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
  return Math.floor(count / 3);
}

/**
 * Runtime adapter for the Quaternius female evaluation mannequin.
 *
 * updateAfterSourcePose() must run after the player's final authored pose and
 * deformation layer.  It retargets from the source canonical T-pose, moves
 * target endpoints by the final source length ratios, then applies volume and
 * shoulder morph influences.
 */
export class QuaterniusEvaluationModel {
  readonly root = new THREE.Group();
  readonly assetUrl: string;

  private loadedScene: THREE.Group | null = null;
  private targetSkeletons: THREE.Skeleton[] = [];
  private targetBindings: TargetSkeletonBinding[] = [];
  private targetMeshes: THREE.SkinnedMesh[] = [];
  private targetRest = new Map<THREE.Bone, LocalTransform>();
  private targetRestMatrices = new Map<THREE.Bone, THREE.Matrix4>();
  private targetRestQuaternions = new Map<THREE.Bone, THREE.Quaternion>();
  private morphBindings: MeshMorphBinding[] = [];
  private source: SourceBinding;
  private loader: GLTFLoader;
  private loadPromise: Promise<this> | null = null;
  private state: QuaterniusEvaluationReadiness = 'loading';
  private failure: Error | null = null;
  private updates = 0;
  private generatedMorphs = 0;
  private generatedNormalMorphs = 0;
  private vertices = 0;
  private triangles = 0;
  private bounds = new THREE.Vector3();
  private lengthScales: Record<string, number> = {};
  private shoulderWeights = {
    left: { elevation: 0, forward: 0 },
    right: { elevation: 0, forward: 0 },
  };
  private contactErrors = {
    footLeft: null as number | null,
    footRight: null as number | null,
    handLeft: null as number | null,
    handRight: null as number | null,
  };

  constructor(options: QuaterniusEvaluationModelOptions) {
    this.root.name = 'quaternius-female-evaluation-model';
    this.root.visible = options.visible ?? false;
    this.assetUrl = options.assetUrl ?? defaultAssetUrl();
    this.loader = options.loader ?? new GLTFLoader();
    this.source = makeSourceBinding(
      options.sourceRoot,
      options.sourceSkeleton,
      options.sourcePoseRoot,
    );
    options.parent.add(this.root);
  }

  static async load(options: QuaterniusEvaluationModelOptions): Promise<QuaterniusEvaluationModel> {
    const model = new QuaterniusEvaluationModel(options);
    await model.load();
    return model;
  }

  static fromScene(
    scene: THREE.Group,
    options: QuaterniusEvaluationModelOptions,
  ): QuaterniusEvaluationModel {
    const model = new QuaterniusEvaluationModel(options);
    model.installScene(scene);
    return model;
  }

  /** Idempotent async load; failures remain inspectable through diagnostics. */
  load(): Promise<this> {
    if (this.loadPromise) return this.loadPromise;
    if (this.state === 'disposed') return Promise.reject(new Error('evaluation model is disposed'));
    this.loadPromise = this.loader.loadAsync(this.assetUrl)
      .then((gltf) => {
        if (this.state === 'disposed') {
          disposeScene(gltf.scene);
          throw new Error('evaluation model was disposed while loading');
        }
        this.installScene(gltf.scene);
        return this;
      })
      .catch((value: unknown) => {
        const error = toError(value);
        if (this.state !== 'disposed') {
          this.failure = error;
          this.state = 'error';
          this.root.visible = false;
        }
        throw error;
      });
    return this.loadPromise;
  }

  get readiness(): QuaterniusEvaluationReadiness {
    return this.state;
  }

  get error(): Error | null {
    return this.failure;
  }

  get scene(): THREE.Group | null {
    return this.loadedScene;
  }

  get targetRoot(): THREE.Object3D | null {
    return this.loadedScene;
  }

  get targetSkeleton(): THREE.Skeleton | null {
    return this.targetSkeletons[0] ?? null;
  }

  get skinnedMeshes(): readonly THREE.SkinnedMesh[] {
    return this.targetMeshes;
  }

  get diagnostics(): QuaterniusEvaluationDiagnostics {
    const mappedTargetBoneCount = Object.values(QUATERNIUS_TARGET_TO_SOURCE_BONE)
      .filter((name) => name !== null).length;
    return {
      readiness: this.state,
      assetUrl: this.assetUrl,
      error: this.failure?.message ?? null,
      expectedTargetBoneCount: QUATERNIUS_EXPECTED_TARGET_BONE_COUNT,
      targetBoneCount: this.targetSkeleton?.bones.length ?? 0,
      targetSkeletonCount: this.targetSkeletons.length,
      mappedTargetBoneCount,
      unmappedTargetBoneNames: QUATERNIUS_TARGET_BONE_NAMES
        .filter((name) => QUATERNIUS_TARGET_TO_SOURCE_BONE[name] === null),
      missingSourceBoneNames: this.missingSourceBoneNames(),
      skinnedMeshCount: this.targetMeshes.length,
      vertexCount: this.vertices,
      triangleCount: this.triangles,
      generatedMorphTargetCount: this.generatedMorphs,
      generatedNormalMorphTargetCount: this.generatedNormalMorphs,
      updateCount: this.updates,
      lengthScales: { ...this.lengthScales },
      shoulderCorrectives: {
        left: { ...this.shoulderWeights.left },
        right: { ...this.shoulderWeights.right },
      },
      contactErrors: { ...this.contactErrors },
      boundsSize: this.bounds.toArray() as [number, number, number],
    };
  }

  setVisible(visible: boolean): void {
    if (this.state === 'disposed') return;
    this.root.visible = visible && this.state === 'ready';
  }

  /** Replace source references after the player rebuilds its live skeleton. */
  rebindSource(
    sourceRoot: THREE.Object3D,
    sourceSkeleton: THREE.Skeleton,
    sourcePoseRoot?: THREE.Object3D,
  ): void {
    if (this.state === 'disposed') throw new Error('cannot rebind a disposed evaluation model');
    this.source = makeSourceBinding(sourceRoot, sourceSkeleton, sourcePoseRoot);
    if (this.state === 'ready') this.reset();
  }

  /**
   * Copy the final live source pose. Call only after keys, procedural drivers,
   * IK and endpoint deformation have all completed for the current frame.
   */
  updateAfterSourcePose(): void {
    if (this.state !== 'ready' || this.targetSkeletons.length === 0) return;
    const sourceMatrices = currentRelativeBoneMatrices(
      this.source.root,
      this.source.skeleton.bones,
    );
    const sourceQuaternions = matrixQuaternions(sourceMatrices);
    const segmentScales = this.sourceSegmentScales(sourceMatrices);
    for (const binding of this.targetBindings) {
      this.retargetSkeleton(binding, sourceMatrices, sourceQuaternions, segmentScales);
    }

    this.root.updateMatrixWorld(true);
    this.applyPresentationIk();
    this.applyMorphWeights(sourceMatrices, segmentScales);
    this.root.updateMatrixWorld(true);
    for (const skeleton of this.targetSkeletons) skeleton.update();
    this.updates++;
  }

  /** Restore target bind transforms and clear only morphs generated here. */
  reset(): void {
    if (this.state === 'disposed') return;
    for (const skeleton of this.targetSkeletons) {
      for (const bone of skeleton.bones) {
        const rest = this.targetRest.get(bone);
        if (!rest) continue;
        bone.position.copy(rest.position);
        bone.quaternion.copy(rest.quaternion);
        bone.scale.copy(rest.scale);
      }
      skeleton.update();
    }
    for (const binding of this.morphBindings) {
      const influences = binding.mesh.morphTargetInfluences;
      if (!influences) continue;
      for (const index of binding.volumeIndices.values()) influences[index] = 0;
      influences[binding.shoulderIndices.leftElevation] = 0;
      influences[binding.shoulderIndices.leftForward] = 0;
      influences[binding.shoulderIndices.rightElevation] = 0;
      influences[binding.shoulderIndices.rightForward] = 0;
    }
    this.lengthScales = Object.fromEntries(
      QUATERNIUS_DEFORMATION_SEGMENTS.map((segment) => [segment.id, 1]),
    );
    this.shoulderWeights = {
      left: { elevation: 0, forward: 0 },
      right: { elevation: 0, forward: 0 },
    };
    this.contactErrors = {
      footLeft: null,
      footRight: null,
      handLeft: null,
      handRight: null,
    };
    this.root.updateMatrixWorld(true);
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.state = 'disposed';
    this.root.visible = false;
    this.root.removeFromParent();
    if (this.loadedScene) disposeScene(this.loadedScene);
    this.root.clear();
    this.loadedScene = null;
    this.targetSkeletons = [];
    this.targetBindings = [];
    this.targetMeshes = [];
    this.targetRest.clear();
    this.targetRestMatrices.clear();
    this.targetRestQuaternions.clear();
    this.morphBindings = [];
  }

  private installScene(scene: THREE.Group): void {
    if (this.state === 'disposed') {
      disposeScene(scene);
      throw new Error('cannot install a scene into a disposed evaluation model');
    }
    if (this.loadedScene) throw new Error('evaluation model scene is already installed');
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) meshes.push(mesh);
    });
    if (meshes.length === 0) throw new Error('Quaternius female GLB contains no SkinnedMesh');
    const skeletons = [...new Set(meshes.map((mesh) => mesh.skeleton))];
    for (const skeleton of skeletons) this.validateTargetSkeleton(skeleton);

    scene.updateMatrixWorld(true);
    this.targetRest.clear();
    this.targetRestMatrices.clear();
    this.targetRestQuaternions.clear();
    this.targetBindings = skeletons.map((skeleton) => {
      const bonesByName = new Map(skeleton.bones.map((bone) => [bone.name, bone]));
      if (bonesByName.size !== skeleton.bones.length) {
        throw new Error('Quaternius target skeleton contains duplicate bone names');
      }
      for (const bone of skeleton.bones) this.targetRest.set(bone, cloneLocal(bone));
      const restMatrices = relativeBoneMatrices(scene, skeleton.bones, (bone) => this.targetRest.get(bone)!);
      const restQuaternions = matrixQuaternions(restMatrices);
      for (const [bone, matrix] of restMatrices) this.targetRestMatrices.set(bone, matrix);
      for (const [bone, quaternion] of restQuaternions) this.targetRestQuaternions.set(bone, quaternion);
      return {
        skeleton,
        bonesByName,
        restHeight: skeletonHeight(restMatrices, bonesByName),
        footContactOffsets: { left: new THREE.Vector3(), right: new THREE.Vector3() },
        handContactOffsets: { left: new THREE.Vector3(), right: new THREE.Vector3() },
      };
    });
    for (const binding of this.targetBindings) {
      binding.footContactOffsets.left = lowestWeightedBindOffset(
        scene,
        meshes,
        binding,
        ['foot_l', 'ball_l', 'ball_leaf_l'],
      );
      binding.footContactOffsets.right = lowestWeightedBindOffset(
        scene,
        meshes,
        binding,
        ['foot_r', 'ball_r', 'ball_leaf_r'],
      );
      binding.handContactOffsets.left = weightedBindCentroidOffset(scene, meshes, binding, 'hand_l');
      binding.handContactOffsets.right = weightedBindCentroidOffset(scene, meshes, binding, 'hand_r');
    }
    this.targetMeshes = meshes;
    this.targetSkeletons = skeletons;
    this.vertices = meshes.reduce(
      (sum, mesh) => sum + (mesh.geometry.getAttribute('position')?.count ?? 0),
      0,
    );
    this.triangles = meshes.reduce((sum, mesh) => sum + triangleCount(mesh.geometry), 0);

    this.morphBindings = meshes.map(installMorphs);
    this.generatedMorphs = this.morphBindings.reduce(
      (sum, binding) => sum + binding.volumeIndices.size + 4,
      0,
    );
    this.generatedNormalMorphs = this.generatedMorphs;
    this.loadedScene = scene;
    this.root.add(scene);
    scene.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(scene).getSize(this.bounds);
    this.state = 'ready';
    this.failure = null;
    this.root.visible = this.root.visible;
    this.reset();
  }

  private validateTargetSkeleton(skeleton: THREE.Skeleton): void {
    if (skeleton.bones.length !== QUATERNIUS_EXPECTED_TARGET_BONE_COUNT) {
      throw new Error(
        `Quaternius target skeleton has ${skeleton.bones.length} bones; ` +
        `expected ${QUATERNIUS_EXPECTED_TARGET_BONE_COUNT}`,
      );
    }
    const actual = skeleton.bones.map((bone) => bone.name);
    const missing = QUATERNIUS_TARGET_BONE_NAMES.filter((name) => !actual.includes(name));
    const unexpected = actual.filter(
      (name) => !(QUATERNIUS_TARGET_BONE_NAMES as readonly string[]).includes(name),
    );
    if (missing.length > 0 || unexpected.length > 0) {
      throw new Error(
        `Quaternius target skeleton contract changed` +
        `${missing.length ? `; missing: ${missing.join(', ')}` : ''}` +
        `${unexpected.length ? `; unexpected: ${unexpected.join(', ')}` : ''}`,
      );
    }
  }

  private missingSourceBoneNames(): string[] {
    const required = [...new Set(Object.values(QUATERNIUS_TARGET_TO_SOURCE_BONE)
      .filter((name): name is string => name !== null))];
    return required.filter((name) => !this.source.bonesByName.has(name));
  }

  /**
   * Ratio of source endpoint distance to its canonical-world distance.  This
   * deliberately measures joints in root-local world space instead of a
   * child-local vector: authored deformation may sit below a non-bone armature
   * correction or a static non-uniform presentation scale.
   */
  private sourceSegmentScales(
    sourceMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const segment of QUATERNIUS_DEFORMATION_SEGMENTS) {
      const sourceStartName = QUATERNIUS_TARGET_TO_SOURCE_BONE[segment.targetBone];
      const sourceEndName = QUATERNIUS_TARGET_TO_SOURCE_BONE[segment.targetEndpoint];
      const sourceStart = sourceStartName ? this.source.bonesByName.get(sourceStartName) : undefined;
      const sourceEnd = sourceEndName ? this.source.bonesByName.get(sourceEndName) : undefined;
      const currentStart = sourceStart ? sourceMatrices.get(sourceStart) : undefined;
      const currentEnd = sourceEnd ? sourceMatrices.get(sourceEnd) : undefined;
      const canonicalStart = sourceStart ? this.source.canonicalMatrices.get(sourceStart) : undefined;
      const canonicalEnd = sourceEnd ? this.source.canonicalMatrices.get(sourceEnd) : undefined;
      if (!currentStart || !currentEnd || !canonicalStart || !canonicalEnd) {
        result[segment.id] = 1;
        continue;
      }
      _position.setFromMatrixPosition(currentStart);
      _otherPosition.setFromMatrixPosition(currentEnd);
      const currentLength = _position.distanceTo(_otherPosition);
      _position.setFromMatrixPosition(canonicalStart);
      _otherPosition.setFromMatrixPosition(canonicalEnd);
      const canonicalLength = _position.distanceTo(_otherPosition);
      result[segment.id] = canonicalLength > 1e-6
        ? THREE.MathUtils.clamp(currentLength / canonicalLength, 0.25, 4)
        : 1;
    }
    return result;
  }

  private retargetSkeleton(
    binding: TargetSkeletonBinding,
    sourceMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
    sourceQuaternions: ReadonlyMap<THREE.Bone, THREE.Quaternion>,
    segmentScales: Readonly<Record<string, number>>,
  ): void {
    const targetSet = new Set(binding.skeleton.bones);
    const desiredWorld = new Map<THREE.Bone, THREE.Matrix4>();
    const endpointScale = new Map<QuaterniusTargetBoneName, number>(
      QUATERNIUS_DEFORMATION_SEGMENTS.map((segment): [QuaterniusTargetBoneName, number] => [
        segment.targetEndpoint,
        segmentScales[segment.id] ?? 1,
      ]),
    );
    const sourcePelvis = this.source.bonesByName.get('hips')!;
    const sourcePelvisCurrent = sourceMatrices.get(sourcePelvis)!;
    const sourcePelvisCanonical = this.source.canonicalMatrices.get(sourcePelvis)!;
    const targetPelvis = binding.bonesByName.get('pelvis')!;
    const targetPelvisRest = this.targetRestMatrices.get(targetPelvis)!;
    const heightRatio = binding.restHeight / Math.max(this.source.restHeight, 1e-6);
    const desiredPelvisPosition = new THREE.Vector3().setFromMatrixPosition(targetPelvisRest);
    _position.setFromMatrixPosition(sourcePelvisCurrent);
    _otherPosition.setFromMatrixPosition(sourcePelvisCanonical);
    desiredPelvisPosition.addScaledVector(_position.sub(_otherPosition), heightRatio);

    const applyBone = (bone: THREE.Bone): void => {
      const rest = this.targetRest.get(bone)!;
      const restWorld = this.targetRestMatrices.get(bone)!;
      const restWorldQuaternion = this.targetRestQuaternions.get(bone)!;
      const parent = bone.parent;
      const parentWorld = parent && (parent as THREE.Bone).isBone && targetSet.has(parent as THREE.Bone)
        ? desiredWorld.get(parent as THREE.Bone)!
        : restWorld.clone().multiply(_matrix.copy(matrixFromTransform(rest)).invert());
      const parentQuaternion = new THREE.Quaternion();
      parentWorld.decompose(_position, parentQuaternion, _scale);
      const sourceName = QUATERNIUS_TARGET_TO_SOURCE_BONE[bone.name as QuaterniusTargetBoneName];
      const sourceBone = sourceName ? this.source.bonesByName.get(sourceName) : undefined;

      const local = cloneTransform(rest);
      if (bone.name === 'pelvis') {
        local.position.copy(desiredPelvisPosition).applyMatrix4(parentWorld.clone().invert());
      } else {
        const scale = endpointScale.get(bone.name as QuaterniusTargetBoneName) ?? 1;
        local.position.multiplyScalar(scale);
      }
      if (sourceBone) {
        const currentSource = sourceQuaternions.get(sourceBone)!;
        const canonicalSource = this.source.canonicalQuaternions.get(sourceBone)!;
        // Both rigs publish +X-left, Y-up, +Z-forward canonical poses. Apply
        // the source's canonical-world delta to the target bind orientation.
        const desiredQuaternion = currentSource.clone()
          .multiply(canonicalSource.clone().invert())
          .multiply(restWorldQuaternion)
          .normalize();
        local.quaternion.copy(parentQuaternion.invert().multiply(desiredQuaternion)).normalize();
      }

      bone.position.copy(local.position);
      bone.quaternion.copy(local.quaternion);
      bone.scale.copy(local.scale);
      desiredWorld.set(bone, parentWorld.clone().multiply(matrixFromTransform(local)));

      for (const child of bone.children) {
        if ((child as THREE.Bone).isBone && targetSet.has(child as THREE.Bone)) {
          applyBone(child as THREE.Bone);
        }
      }
    };

    for (const bone of binding.skeleton.bones) {
      const parent = bone.parent;
      if (!parent || !(parent as THREE.Bone).isBone || !targetSet.has(parent as THREE.Bone)) applyBone(bone);
    }
  }

  private sourceSocketTarget(sourceSocketName: string): THREE.Vector3 | null {
    const socket = this.source.root.getObjectByName(sourceSocketName);
    if (!socket || !this.loadedScene) return null;
    this.source.root.updateWorldMatrix(true, true);
    return this.loadedScene.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
  }

  private setBoneWorldQuaternion(bone: THREE.Bone, worldQuaternion: THREE.Quaternion): void {
    if (!bone.parent) {
      bone.quaternion.copy(worldQuaternion);
      return;
    }
    bone.parent.getWorldQuaternion(_otherQuaternion);
    bone.quaternion.copy(_otherQuaternion.invert().multiply(worldQuaternion)).normalize();
  }

  /**
   * Preserve the source chain's preferred bend side. This is sampled in world
   * space because presentation IK runs after the target scene is parented.
   */
  private sourceChainPoleHint(chain: TwoBoneChain): THREE.Vector3 | null {
    const sourceRootName = QUATERNIUS_TARGET_TO_SOURCE_BONE[chain.root];
    const sourceMiddleName = QUATERNIUS_TARGET_TO_SOURCE_BONE[chain.middle];
    const sourceEndName = QUATERNIUS_TARGET_TO_SOURCE_BONE[chain.end];
    const sourceRoot = sourceRootName ? this.source.bonesByName.get(sourceRootName) : undefined;
    const sourceMiddle = sourceMiddleName ? this.source.bonesByName.get(sourceMiddleName) : undefined;
    const sourceEnd = sourceEndName ? this.source.bonesByName.get(sourceEndName) : undefined;
    if (!sourceRoot || !sourceMiddle || !sourceEnd) return null;
    this.source.root.updateWorldMatrix(true, true);
    const rootPosition = sourceRoot.getWorldPosition(new THREE.Vector3());
    const middleDirection = sourceMiddle.getWorldPosition(new THREE.Vector3()).sub(rootPosition);
    const endDirection = sourceEnd.getWorldPosition(new THREE.Vector3()).sub(rootPosition);
    if (middleDirection.lengthSq() <= 1e-10 || endDirection.lengthSq() <= 1e-10) return null;
    const sourceUpperLength = middleDirection.length();
    endDirection.normalize();
    const bend = middleDirection.addScaledVector(endDirection, -middleDirection.dot(endDirection));
    // Do this test in source space. Projecting a perfectly straight source leg
    // against an offset target contact invents a false lateral bend and makes
    // the target knees scissor through the stance.
    return bend.length() > sourceUpperLength * 0.05 ? bend : null;
  }

  private sourceForwardWorld(): THREE.Vector3 {
    this.source.root.updateWorldMatrix(true, true);
    const origin = this.source.root.getWorldPosition(new THREE.Vector3());
    return this.source.root.localToWorld(new THREE.Vector3(0, 0, 1)).sub(origin).normalize();
  }

  private solveTwoBoneEnd(
    root: THREE.Bone,
    middle: THREE.Bone,
    end: THREE.Bone,
    target: THREE.Vector3,
    poleHint: THREE.Vector3 | null,
    stableForward: THREE.Vector3,
  ): void {
    this.root.updateMatrixWorld(true);
    const rootPosition = root.getWorldPosition(new THREE.Vector3());
    const middlePosition = middle.getWorldPosition(new THREE.Vector3());
    const endPosition = end.getWorldPosition(new THREE.Vector3());
    const upperLength = rootPosition.distanceTo(middlePosition);
    const lowerLength = middlePosition.distanceTo(endPosition);
    if (upperLength <= 1e-6 || lowerLength <= 1e-6) return;

    const rootToTarget = target.clone().sub(rootPosition);
    if (rootToTarget.lengthSq() <= 1e-12) rootToTarget.copy(endPosition).sub(rootPosition);
    if (rootToTarget.lengthSq() <= 1e-12) return;
    const direction = rootToTarget.normalize();
    const reach = THREE.MathUtils.clamp(
      rootPosition.distanceTo(target),
      Math.abs(upperLength - lowerLength) + 1e-5,
      upperLength + lowerLength - 1e-5,
    );
    const solvedEnd = rootPosition.clone().addScaledVector(direction, reach);
    const rawPole = (poleHint ?? middlePosition.clone().sub(rootPosition)).clone();
    const poleReferenceLength = Math.max(rawPole.length(), 1e-6);
    const pole = rawPole;
    pole.addScaledVector(direction, -pole.dot(direction));
    // A straight leg has no physical bend vector. Tiny X/Z noise from the
    // mannequin bind pose is not a valid pole: use rider-forward so both knees
    // stay in their anatomical lanes instead of scissoring toward the centre.
    if (pole.length() <= poleReferenceLength * 0.05) {
      pole.copy(stableForward).addScaledVector(direction, -stableForward.dot(direction));
      if (pole.lengthSq() <= 1e-10) pole.copy(_forward).cross(direction);
      if (pole.lengthSq() <= 1e-10) pole.copy(_up).cross(direction);
    }
    pole.normalize();
    const rootAngle = Math.acos(THREE.MathUtils.clamp(
      (upperLength * upperLength + reach * reach - lowerLength * lowerLength) /
        (2 * upperLength * reach),
      -1,
      1,
    ));
    const solvedMiddle = rootPosition.clone()
      .addScaledVector(direction, upperLength * Math.cos(rootAngle))
      .addScaledVector(pole, upperLength * Math.sin(rootAngle));

    const currentUpper = middlePosition.clone().sub(rootPosition);
    const desiredUpper = solvedMiddle.clone().sub(rootPosition);
    if (currentUpper.lengthSq() > 1e-12 && desiredUpper.lengthSq() > 1e-12) {
      const currentWorld = root.getWorldQuaternion(new THREE.Quaternion());
      const delta = new THREE.Quaternion().setFromUnitVectors(
        currentUpper.normalize(),
        desiredUpper.normalize(),
      );
      this.setBoneWorldQuaternion(root, delta.multiply(currentWorld));
    }

    this.root.updateMatrixWorld(true);
    const solvedMiddleActual = middle.getWorldPosition(new THREE.Vector3());
    const solvedEndActual = end.getWorldPosition(new THREE.Vector3());
    const currentLower = solvedEndActual.sub(solvedMiddleActual);
    const desiredLower = solvedEnd.clone().sub(solvedMiddleActual);
    if (currentLower.lengthSq() > 1e-12 && desiredLower.lengthSq() > 1e-12) {
      const currentWorld = middle.getWorldQuaternion(new THREE.Quaternion());
      const delta = new THREE.Quaternion().setFromUnitVectors(
        currentLower.normalize(),
        desiredLower.normalize(),
      );
      this.setBoneWorldQuaternion(middle, delta.multiply(currentWorld));
    }

    this.root.updateMatrixWorld(true);
  }

  private solveTwoBoneIk(
    binding: TargetSkeletonBinding,
    chain: TwoBoneChain,
    contactTarget: THREE.Vector3,
    contactOffset?: THREE.Vector3,
    poleHint?: THREE.Vector3 | null,
    stableForward?: THREE.Vector3,
  ): number | null {
    const root = binding.bonesByName.get(chain.root);
    const middle = binding.bonesByName.get(chain.middle);
    const end = binding.bonesByName.get(chain.end);
    if (!root || !middle || !end) return null;

    // The offset is bind-local and follows the target end bone.  Two small
    // passes make the actual sole/palm converge on the socket rather than
    // placing the ankle or wrist joint itself at the contact point.
    const passes = contactOffset && contactOffset.lengthSq() > 1e-12 ? 3 : 1;
    for (let pass = 0; pass < passes; pass++) {
      this.root.updateMatrixWorld(true);
      const endPosition = end.getWorldPosition(new THREE.Vector3());
      const jointTarget = contactOffset
        ? contactTarget.clone().sub(end.localToWorld(contactOffset.clone()).sub(endPosition))
        : contactTarget;
      this.solveTwoBoneEnd(
        root,
        middle,
        end,
        jointTarget,
        poleHint ?? null,
        stableForward ?? _forward,
      );
    }
    this.root.updateMatrixWorld(true);
    const contactPosition = contactOffset
      ? end.localToWorld(contactOffset.clone())
      : end.getWorldPosition(new THREE.Vector3());
    return contactPosition.distanceTo(contactTarget);
  }

  private applyPresentationIk(): void {
    const chains: readonly [QuaterniusContactKey, TwoBoneChain, string, 'foot' | 'hand'][] = [
      ['footLeft', { root: 'thigh_l', middle: 'calf_l', end: 'foot_l' }, 'socket-foot-left', 'foot'],
      ['footRight', { root: 'thigh_r', middle: 'calf_r', end: 'foot_r' }, 'socket-foot-right', 'foot'],
      ['handLeft', { root: 'upperarm_l', middle: 'lowerarm_l', end: 'hand_l' }, 'socket-grip-left', 'hand'],
      ['handRight', { root: 'upperarm_r', middle: 'lowerarm_r', end: 'hand_r' }, 'socket-grip-right', 'hand'],
    ];
    const errors = {
      footLeft: null as number | null,
      footRight: null as number | null,
      handLeft: null as number | null,
      handRight: null as number | null,
    };
    for (let index = 0; index < this.targetBindings.length; index++) {
      const binding = this.targetBindings[index];
      for (const [key, chain, socketName, kind] of chains) {
        const targetLocal = this.sourceSocketTarget(socketName);
        if (!targetLocal || !this.loadedScene) continue;
        const targetWorld = this.loadedScene.localToWorld(targetLocal.clone());
        const side: 'left' | 'right' = key.endsWith('Left') ? 'left' : 'right';
        const contactOffset = kind === 'foot'
          ? binding.footContactOffsets[side]
          : binding.handContactOffsets[side];
        const error = this.solveTwoBoneIk(
          binding,
          chain,
          targetWorld,
          contactOffset,
          this.sourceChainPoleHint(chain),
          this.sourceForwardWorld(),
        );
        if (index === 0) errors[key] = error;
      }
    }
    this.contactErrors = errors;
  }

  private shoulderCorrective(
    side: 'left' | 'right',
    matrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  ): QuaterniusShoulderCorrectiveWeights {
    const shoulder = this.source.bonesByName.get(`shoulder-${side}`)!;
    const elbow = this.source.bonesByName.get(`elbow-${side}`)!;
    const shoulderMatrix = matrices.get(shoulder)!;
    const elbowMatrix = matrices.get(elbow)!;
    _position.setFromMatrixPosition(shoulderMatrix);
    _otherPosition.setFromMatrixPosition(elbowMatrix);
    _axis.copy(_otherPosition).sub(_position).normalize();
    const elevationRadians = Math.acos(THREE.MathUtils.clamp(_axis.dot(_down), -1, 1));
    const elevation = smoothUnit((elevationRadians / (Math.PI * 0.5) - 0.1) / 0.8);
    const forwardSigned = THREE.MathUtils.clamp(_axis.dot(_forward), -1, 1);
    const forward = Math.sign(forwardSigned) * smoothUnit((Math.abs(forwardSigned) - 0.08) / 0.72);
    return { elevation, forward };
  }

  private applyMorphWeights(
    sourceMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
    lengthScales: Readonly<Record<string, number>>,
  ): void {
    const shoulders = {
      left: this.shoulderCorrective('left', sourceMatrices),
      right: this.shoulderCorrective('right', sourceMatrices),
    };
    for (const binding of this.morphBindings) {
      const influences = binding.mesh.morphTargetInfluences;
      if (!influences) continue;
      for (const [segmentId, index] of binding.volumeIndices) {
        const scale = lengthScales[segmentId] ?? 1;
        influences[index] = 1 / Math.sqrt(scale) - 1;
      }
      influences[binding.shoulderIndices.leftElevation] = shoulders.left.elevation;
      influences[binding.shoulderIndices.leftForward] = shoulders.left.forward;
      influences[binding.shoulderIndices.rightElevation] = shoulders.right.elevation;
      influences[binding.shoulderIndices.rightForward] = shoulders.right.forward;
    }
    this.lengthScales = { ...lengthScales };
    this.shoulderWeights = shoulders;
  }
}

export async function loadQuaterniusEvaluationModel(
  options: QuaterniusEvaluationModelOptions,
): Promise<QuaterniusEvaluationModel> {
  return QuaterniusEvaluationModel.load(options);
}

export function createQuaterniusEvaluationModelFromScene(
  scene: THREE.Group,
  options: QuaterniusEvaluationModelOptions,
): QuaterniusEvaluationModel {
  return QuaterniusEvaluationModel.fromScene(scene, options);
}
