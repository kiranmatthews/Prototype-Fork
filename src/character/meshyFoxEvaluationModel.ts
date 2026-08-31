import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export const MESHY_FOX_MODEL_PATH = 'characters/meshy-fox/meshy-fox.fbx' as const;
export const MESHY_FOX_PREVIEW_TEXTURE_PATH =
  'characters/meshy-fox/Character_output.fbm/texture_0.png' as const;
export const MESHY_FOX_TARGET_HEIGHT = 1.81 as const;

export const MESHY_FOX_TARGET_BONE_NAMES = [
  'Hips',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
  'Spine02', 'Spine01', 'Spine',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'neck', 'Head', 'head_end', 'headfront',
] as const;

export type MeshyFoxTargetBoneName = typeof MESHY_FOX_TARGET_BONE_NAMES[number];

export const MESHY_FOX_TARGET_TO_SOURCE_BONE: Readonly<
  Record<MeshyFoxTargetBoneName, string | null>
> = Object.freeze({
  Hips: 'hips',
  LeftUpLeg: 'hip-left',
  LeftLeg: 'knee-left',
  LeftFoot: 'ankle-left',
  LeftToeBase: 'toe-left',
  RightUpLeg: 'hip-right',
  RightLeg: 'knee-right',
  RightFoot: 'ankle-right',
  RightToeBase: 'toe-right',
  Spine02: 'torso-root',
  Spine01: 'spine',
  Spine: 'chest',
  LeftShoulder: 'clavicle-left',
  LeftArm: 'shoulder-left',
  LeftForeArm: 'elbow-left',
  LeftHand: 'wrist-left',
  RightShoulder: 'clavicle-right',
  RightArm: 'shoulder-right',
  RightForeArm: 'elbow-right',
  RightHand: 'wrist-right',
  neck: 'neck',
  Head: 'head',
  head_end: null,
  headfront: null,
});

interface MeshyFoxSegment {
  id: string;
  targetBone: MeshyFoxTargetBoneName;
  targetEndpoint: MeshyFoxTargetBoneName;
}

export const MESHY_FOX_DEFORMATION_SEGMENTS: readonly MeshyFoxSegment[] = Object.freeze([
  { id: 'torso.lower', targetBone: 'Spine02', targetEndpoint: 'Spine01' },
  { id: 'torso.upper', targetBone: 'Spine01', targetEndpoint: 'Spine' },
  { id: 'arm.upper.left', targetBone: 'LeftArm', targetEndpoint: 'LeftForeArm' },
  { id: 'arm.lower.left', targetBone: 'LeftForeArm', targetEndpoint: 'LeftHand' },
  { id: 'arm.upper.right', targetBone: 'RightArm', targetEndpoint: 'RightForeArm' },
  { id: 'arm.lower.right', targetBone: 'RightForeArm', targetEndpoint: 'RightHand' },
  { id: 'leg.upper.left', targetBone: 'LeftUpLeg', targetEndpoint: 'LeftLeg' },
  { id: 'leg.lower.left', targetBone: 'LeftLeg', targetEndpoint: 'LeftFoot' },
  { id: 'leg.upper.right', targetBone: 'RightUpLeg', targetEndpoint: 'RightLeg' },
  { id: 'leg.lower.right', targetBone: 'RightLeg', targetEndpoint: 'RightFoot' },
]);

export type MeshyFoxReadiness = 'idle' | 'loading' | 'ready' | 'error' | 'disposed';
type ContactKey = 'footLeft' | 'footRight' | 'handLeft' | 'handRight';

export interface MeshyFoxEvaluationDiagnostics {
  readiness: MeshyFoxReadiness;
  assetUrl: string;
  previewTextureUrl: string;
  error: string | null;
  targetBoneCount: number;
  mappedTargetBoneCount: number;
  missingSourceBoneNames: string[];
  skinnedMeshCount: number;
  vertexCount: number;
  triangleCount: number;
  animationCountIgnored: number;
  fitScale: number;
  rawHeight: number;
  fittedHeight: number;
  updateCount: number;
  lengthScales: Record<string, number>;
  contactErrors: Record<ContactKey, number | null>;
}

export interface MeshyFoxEvaluationModelOptions {
  parent: THREE.Object3D;
  sourceRoot: THREE.Object3D;
  sourcePoseRoot?: THREE.Object3D;
  sourceSkeleton: THREE.Skeleton;
  assetUrl?: string;
  previewTextureUrl?: string;
  visible?: boolean;
  loader?: FBXLoader;
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

interface TargetBinding {
  skeleton: THREE.Skeleton;
  bonesByName: Map<string, THREE.Bone>;
  restHeight: number;
  footContactOffsets: { left: THREE.Vector3; right: THREE.Vector3 };
  handContactOffsets: { left: THREE.Vector3; right: THREE.Vector3 };
}

interface TwoBoneChain {
  root: MeshyFoxTargetBoneName;
  middle: MeshyFoxTargetBoneName;
  end: MeshyFoxTargetBoneName;
}

type UnknownRecord = Record<string, unknown>;

const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();
const Q0 = new THREE.Quaternion();
const Q1 = new THREE.Quaternion();
const S0 = new THREE.Vector3();
const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

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

function matrixFromTransform(transform: LocalTransform): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    transform.position,
    transform.quaternion,
    transform.scale,
  );
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

function sourceCanonicalLocals(
  skeleton: THREE.Skeleton,
  metadataRoot: THREE.Object3D,
): Map<THREE.Bone, LocalTransform> {
  const bones = skeleton.bones;
  const boneSet = new Set(bones);
  const bindWorld = new Map<THREE.Bone, THREE.Matrix4>();
  for (let index = 0; index < bones.length; index++) {
    const inverse = skeleton.boneInverses[index];
    if (inverse) bindWorld.set(bones[index], inverse.clone().invert());
  }
  const rest = new Map<THREE.Bone, LocalTransform>();
  for (const bone of bones) {
    const world = bindWorld.get(bone);
    const parent = bone.parent;
    const parentWorld = parent && (parent as THREE.Bone).isBone && boneSet.has(parent as THREE.Bone)
      ? bindWorld.get(parent as THREE.Bone)
      : undefined;
    rest.set(
      bone,
      world && parentWorld
        ? decomposeTransform(parentWorld.clone().invert().multiply(world))
        : cloneLocal(bone),
    );
  }
  const runtime = runtimeMetadata(metadataRoot);
  const semanticNames = metadataJointNames(runtime);
  const semanticByName = new Map<string, string>();
  for (const [semantic, name] of semanticNames) semanticByName.set(name, semantic);
  const bindPose = metadataRecord(runtime, 'bindPose');
  const retargetPose = {
    ...metadataRecord(runtime, 'retargetPose'),
    ...metadataRecord(runtime, 'canonicalTPose'),
  };
  for (const bone of bones) {
    const semantic = semanticByName.get(bone.name);
    if (semantic && isRecord(bindPose[semantic])) {
      rest.set(bone, transformFromMetadata(bindPose[semantic], rest.get(bone)!));
    }
  }
  const canonical = new Map<THREE.Bone, LocalTransform>();
  for (const bone of bones) {
    const semantic = semanticByName.get(bone.name);
    canonical.set(
      bone,
      transformFromMetadata(semantic ? retargetPose[semantic] : undefined, rest.get(bone)!),
    );
  }
  const left = bones.find((bone) => bone.name === 'shoulder-left');
  const right = bones.find((bone) => bone.name === 'shoulder-right');
  if (left && !semanticByName.has(left.name)) {
    canonical.get(left)!.quaternion.set(0, 0, Math.SQRT1_2, Math.SQRT1_2);
  }
  if (right && !semanticByName.has(right.name)) {
    canonical.get(right)!.quaternion.set(0, 0, -Math.SQRT1_2, Math.SQRT1_2);
  }
  return canonical;
}

function relativeBoneMatrices(
  root: THREE.Object3D,
  bones: readonly THREE.Bone[],
  localTransform: (bone: THREE.Bone) => LocalTransform,
): Map<THREE.Bone, THREE.Matrix4> {
  root.updateWorldMatrix(true, true);
  const boneSet = new Set(bones);
  const resolved = new Map<THREE.Object3D, THREE.Matrix4>();
  const visiting = new Set<THREE.Object3D>();
  const resolve = (node: THREE.Object3D): THREE.Matrix4 => {
    if (node === root) return new THREE.Matrix4();
    const existing = resolved.get(node);
    if (existing) return existing;
    if (!node.parent || visiting.has(node)) throw new Error(`invalid bone hierarchy at ${node.name}`);
    visiting.add(node);
    const parent = resolve(node.parent);
    const local = boneSet.has(node as THREE.Bone)
      ? matrixFromTransform(localTransform(node as THREE.Bone))
      : node.matrix.clone();
    const result = parent.clone().multiply(local);
    resolved.set(node, result);
    visiting.delete(node);
    return result;
  };
  return new Map(bones.map((bone) => [bone, resolve(bone)]));
}

function currentRelativeBoneMatrices(
  root: THREE.Object3D,
  bones: readonly THREE.Bone[],
): Map<THREE.Bone, THREE.Matrix4> {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  return new Map(bones.map((bone) => [bone, inverse.clone().multiply(bone.matrixWorld)]));
}

function matrixQuaternions(
  matrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
): Map<THREE.Bone, THREE.Quaternion> {
  const result = new Map<THREE.Bone, THREE.Quaternion>();
  for (const [bone, matrix] of matrices) {
    matrix.decompose(V0, Q0, S0);
    result.set(bone, Q0.clone().normalize());
  }
  return result;
}

function skeletonHeight(
  matrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  bonesByName: ReadonlyMap<string, THREE.Bone>,
): number {
  const top = bonesByName.get('head') ?? bonesByName.get('Head');
  const left = bonesByName.get('toe-left') ?? bonesByName.get('LeftToeBase');
  const right = bonesByName.get('toe-right') ?? bonesByName.get('RightToeBase');
  const topMatrix = top ? matrices.get(top) : undefined;
  const leftMatrix = left ? matrices.get(left) : undefined;
  const rightMatrix = right ? matrices.get(right) : undefined;
  if (topMatrix && (leftMatrix || rightMatrix)) {
    const topY = V0.setFromMatrixPosition(topMatrix).y;
    const lowY = Math.min(
      leftMatrix ? V0.setFromMatrixPosition(leftMatrix).y : Infinity,
      rightMatrix ? V1.setFromMatrixPosition(rightMatrix).y : Infinity,
    );
    if (Number.isFinite(topY - lowY) && topY - lowY > 1e-6) return topY - lowY;
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const matrix of matrices.values()) {
    const y = V0.setFromMatrixPosition(matrix).y;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.max(maxY - minY, 1);
}

function makeSourceBinding(
  metadataRoot: THREE.Object3D,
  skeleton: THREE.Skeleton,
  poseRoot = metadataRoot,
): SourceBinding {
  const bonesByName = new Map<string, THREE.Bone>();
  for (const bone of skeleton.bones) bonesByName.set(bone.name, bone);
  const required = [...new Set(Object.values(MESHY_FOX_TARGET_TO_SOURCE_BONE)
    .filter((name): name is string => name !== null))];
  const missing = required.filter((name) => !bonesByName.has(name));
  if (missing.length) throw new Error(`source skeleton is missing: ${missing.join(', ')}`);
  const canonicalLocals = sourceCanonicalLocals(skeleton, metadataRoot);
  const canonicalMatrices = relativeBoneMatrices(
    poseRoot,
    skeleton.bones,
    (bone) => canonicalLocals.get(bone)!,
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

function component(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertex: number,
  index: number,
): number {
  if (index === 0) return attribute.getX(vertex);
  if (index === 1) return attribute.getY(vertex);
  if (index === 2) return attribute.getZ(vertex);
  return attribute.getW(vertex);
}

function boneWeight(mesh: THREE.SkinnedMesh, vertex: number, boneIndex: number): number {
  const indices = mesh.geometry.getAttribute('skinIndex');
  const weights = mesh.geometry.getAttribute('skinWeight');
  if (!indices || !weights) return 0;
  let value = 0;
  for (let index = 0; index < Math.min(indices.itemSize, 4); index++) {
    if (component(indices, vertex, index) === boneIndex) value += component(weights, vertex, index);
  }
  return value;
}

function weightedIndices(skeleton: THREE.Skeleton, names: readonly string[]): number[] {
  return names.map((name) => skeleton.bones.findIndex((bone) => bone.name === name))
    .filter((index) => index >= 0);
}

function bindPoint(
  sceneInverse: THREE.Matrix4,
  mesh: THREE.SkinnedMesh,
  vertex: number,
): THREE.Vector3 {
  return new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), vertex)
    .applyMatrix4(mesh.matrixWorld)
    .applyMatrix4(sceneInverse);
}

function lowestWeightedOffset(
  scene: THREE.Object3D,
  meshes: readonly THREE.SkinnedMesh[],
  binding: TargetBinding,
  names: readonly string[],
): THREE.Vector3 {
  const sceneInverse = scene.matrixWorld.clone().invert();
  const indexed = new Map<THREE.SkinnedMesh, number[]>();
  let minY = Infinity;
  for (const mesh of meshes) {
    if (mesh.skeleton !== binding.skeleton) continue;
    const indices = weightedIndices(mesh.skeleton, names);
    if (!indices.length) continue;
    indexed.set(mesh, indices);
    const position = mesh.geometry.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = indices.reduce((sum, index) => sum + boneWeight(mesh, vertex, index), 0);
      if (support >= 0.2) minY = Math.min(minY, bindPoint(sceneInverse, mesh, vertex).y);
    }
  }
  const foot = binding.bonesByName.get(names[0]);
  if (!foot || !Number.isFinite(minY)) return new THREE.Vector3();
  const centre = new THREE.Vector3();
  let total = 0;
  for (const [mesh, indices] of indexed) {
    const position = mesh.geometry.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = indices.reduce((sum, index) => sum + boneWeight(mesh, vertex, index), 0);
      if (support < 0.2) continue;
      const point = bindPoint(sceneInverse, mesh, vertex);
      const fromFloor = point.y - minY;
      if (fromFloor > 0.015) continue;
      const weight = support * (1 - fromFloor / 0.015);
      centre.addScaledVector(point, weight);
      total += weight;
    }
  }
  if (total <= 1e-6) return new THREE.Vector3();
  centre.multiplyScalar(1 / total);
  return centre.applyMatrix4(foot.matrixWorld.clone().premultiply(sceneInverse).invert());
}

function weightedCentroidOffset(
  scene: THREE.Object3D,
  meshes: readonly THREE.SkinnedMesh[],
  binding: TargetBinding,
  name: string,
): THREE.Vector3 {
  const bone = binding.bonesByName.get(name);
  if (!bone) return new THREE.Vector3();
  const sceneInverse = scene.matrixWorld.clone().invert();
  const centre = new THREE.Vector3();
  let total = 0;
  for (const mesh of meshes) {
    if (mesh.skeleton !== binding.skeleton) continue;
    const index = mesh.skeleton.bones.indexOf(bone);
    const position = mesh.geometry.getAttribute('position');
    for (let vertex = 0; vertex < position.count; vertex++) {
      const support = boneWeight(mesh, vertex, index);
      if (support < 0.2) continue;
      centre.addScaledVector(bindPoint(sceneInverse, mesh, vertex), support);
      total += support;
    }
  }
  if (total <= 1e-6) return new THREE.Vector3();
  centre.multiplyScalar(1 / total);
  return centre.applyMatrix4(bone.matrixWorld.clone().premultiply(sceneInverse).invert());
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return Math.floor((geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) / 3);
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
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if ((value as THREE.Texture | undefined)?.isTexture) textures.add(value as THREE.Texture);
        }
      }
    }
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
      skeletons.add((object as THREE.SkinnedMesh).skeleton);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const skeleton of skeletons) skeleton.dispose();
}

function defaultAssetUrl(): string {
  return `${import.meta.env.BASE_URL}${MESHY_FOX_MODEL_PATH}`;
}

function defaultTextureUrl(): string {
  return `${import.meta.env.BASE_URL}${MESHY_FOX_PREVIEW_TEXTURE_PATH}`;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export class MeshyFoxEvaluationModel {
  readonly root = new THREE.Group();
  readonly assetUrl: string;
  readonly previewTextureUrl: string;

  private state: MeshyFoxReadiness = 'idle';
  private failure: Error | null = null;
  private loader: FBXLoader;
  private loadPromise: Promise<this> | null = null;
  private loadedScene: THREE.Group | null = null;
  private source: SourceBinding;
  private targetBindings: TargetBinding[] = [];
  private targetSkeletons: THREE.Skeleton[] = [];
  private targetMeshes: THREE.SkinnedMesh[] = [];
  private targetRest = new Map<THREE.Bone, LocalTransform>();
  private targetRestMatrices = new Map<THREE.Bone, THREE.Matrix4>();
  private targetCanonicalQuaternions = new Map<THREE.Bone, THREE.Quaternion>();
  private vertices = 0;
  private triangles = 0;
  private ignoredAnimations = 0;
  private fitScale = 1;
  private rawHeight = 0;
  private updates = 0;
  private lengthScales: Record<string, number> = {};
  private contactErrors: Record<ContactKey, number | null> = {
    footLeft: null,
    footRight: null,
    handLeft: null,
    handRight: null,
  };

  constructor(options: MeshyFoxEvaluationModelOptions) {
    this.root.name = 'meshy-fox-evaluation-model';
    this.root.visible = options.visible ?? false;
    this.assetUrl = options.assetUrl ?? defaultAssetUrl();
    this.previewTextureUrl = options.previewTextureUrl ?? defaultTextureUrl();
    if (options.loader) this.loader = options.loader;
    else {
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        if (!url.startsWith('blob:')) return url;
        // Meshy embeds an 8192² basecolor in the FBX. Redirect its private blob
        // to the committed 2048² preview copy: same pixels at review scale,
        // ~16 MiB GPU residency instead of ~256 MiB.
        if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
        return this.previewTextureUrl;
      });
      this.loader = new FBXLoader(manager);
    }
    this.source = makeSourceBinding(
      options.sourceRoot,
      options.sourceSkeleton,
      options.sourcePoseRoot,
    );
    options.parent.add(this.root);
  }

  static fromScene(
    scene: THREE.Group,
    options: MeshyFoxEvaluationModelOptions,
  ): MeshyFoxEvaluationModel {
    const model = new MeshyFoxEvaluationModel(options);
    model.installScene(scene);
    return model;
  }

  get readiness(): MeshyFoxReadiness {
    return this.state;
  }

  get error(): Error | null {
    return this.failure;
  }

  get scene(): THREE.Group | null {
    return this.loadedScene;
  }

  get diagnostics(): MeshyFoxEvaluationDiagnostics {
    return {
      readiness: this.state,
      assetUrl: this.assetUrl,
      previewTextureUrl: this.previewTextureUrl,
      error: this.failure?.message ?? null,
      targetBoneCount: this.targetSkeletons[0]?.bones.length ?? 0,
      mappedTargetBoneCount: Object.values(MESHY_FOX_TARGET_TO_SOURCE_BONE)
        .filter((name) => name !== null).length,
      missingSourceBoneNames: this.missingSourceBones(),
      skinnedMeshCount: this.targetMeshes.length,
      vertexCount: this.vertices,
      triangleCount: this.triangles,
      animationCountIgnored: this.ignoredAnimations,
      fitScale: this.fitScale,
      rawHeight: this.rawHeight,
      fittedHeight: MESHY_FOX_TARGET_HEIGHT,
      updateCount: this.updates,
      lengthScales: { ...this.lengthScales },
      contactErrors: { ...this.contactErrors },
    };
  }

  load(): Promise<this> {
    if (this.loadPromise) return this.loadPromise;
    if (this.state === 'disposed') return Promise.reject(new Error('Meshy fox is disposed'));
    this.state = 'loading';
    this.loadPromise = this.loader.loadAsync(this.assetUrl)
      .then((scene) => {
        if (this.state === 'disposed') {
          disposeScene(scene);
          throw new Error('Meshy fox was disposed while loading');
        }
        this.installScene(scene);
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

  setVisible(visible: boolean): void {
    if (this.state !== 'disposed') this.root.visible = visible && this.state === 'ready';
  }

  rebindSource(
    sourceRoot: THREE.Object3D,
    sourceSkeleton: THREE.Skeleton,
    sourcePoseRoot?: THREE.Object3D,
  ): void {
    if (this.state === 'disposed') throw new Error('cannot rebind disposed Meshy fox');
    this.source = makeSourceBinding(sourceRoot, sourceSkeleton, sourcePoseRoot);
    if (this.state === 'ready') this.reset();
  }

  updateAfterSourcePose(): void {
    if (this.state !== 'ready') return;
    const sourceMatrices = currentRelativeBoneMatrices(this.source.root, this.source.skeleton.bones);
    const sourceQuaternions = matrixQuaternions(sourceMatrices);
    const segmentScales = this.sourceSegmentScales(sourceMatrices);
    for (const binding of this.targetBindings) {
      this.retargetSkeleton(binding, sourceMatrices, sourceQuaternions, segmentScales);
    }
    this.root.updateMatrixWorld(true);
    this.applyPresentationIk();
    this.root.updateMatrixWorld(true);
    for (const skeleton of this.targetSkeletons) skeleton.update();
    this.lengthScales = segmentScales;
    this.updates++;
  }

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
    this.lengthScales = Object.fromEntries(
      MESHY_FOX_DEFORMATION_SEGMENTS.map((segment) => [segment.id, 1]),
    );
    this.contactErrors = { footLeft: null, footRight: null, handLeft: null, handRight: null };
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
    this.targetBindings = [];
    this.targetSkeletons = [];
    this.targetMeshes = [];
    this.targetRest.clear();
    this.targetRestMatrices.clear();
    this.targetCanonicalQuaternions.clear();
  }

  private installScene(scene: THREE.Group): void {
    if (this.state === 'disposed') throw new Error('cannot install into disposed Meshy fox');
    if (this.loadedScene) throw new Error('Meshy fox scene is already installed');
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const map = (material as THREE.MeshStandardMaterial).map;
        if (map) map.colorSpace = THREE.SRGBColorSpace;
      }
      meshes.push(mesh);
    });
    if (!meshes.length) throw new Error('Meshy fox FBX contains no SkinnedMesh');
    const skeletons = [...new Set(meshes.map((mesh) => mesh.skeleton))];
    for (const skeleton of skeletons) this.validateTargetSkeleton(skeleton);
    scene.updateMatrixWorld(true);
    const rawBounds = new THREE.Box3().setFromObject(scene);
    const rawHeight = rawBounds.max.y - rawBounds.min.y;
    if (!Number.isFinite(rawHeight) || rawHeight <= 1e-6) throw new Error('Meshy fox bounds are invalid');
    this.rawHeight = rawHeight;
    this.fitScale = MESHY_FOX_TARGET_HEIGHT / rawHeight;
    this.root.scale.setScalar(this.fitScale);
    this.targetRest.clear();
    this.targetRestMatrices.clear();
    this.targetBindings = skeletons.map((skeleton) => {
      const bonesByName = new Map(skeleton.bones.map((bone) => [bone.name, bone]));
      for (const bone of skeleton.bones) this.targetRest.set(bone, cloneLocal(bone));
      const restMatrices = relativeBoneMatrices(scene, skeleton.bones, (bone) => this.targetRest.get(bone)!);
      for (const [bone, matrix] of restMatrices) this.targetRestMatrices.set(bone, matrix);
      const binding: TargetBinding = {
        skeleton,
        bonesByName,
        restHeight: skeletonHeight(restMatrices, bonesByName),
        footContactOffsets: { left: new THREE.Vector3(), right: new THREE.Vector3() },
        handContactOffsets: { left: new THREE.Vector3(), right: new THREE.Vector3() },
      };
      this.installTargetCanonicalPose(binding, restMatrices);
      return binding;
    });
    for (const binding of this.targetBindings) {
      binding.footContactOffsets.left = lowestWeightedOffset(
        scene, meshes, binding, ['LeftFoot', 'LeftToeBase'],
      );
      binding.footContactOffsets.right = lowestWeightedOffset(
        scene, meshes, binding, ['RightFoot', 'RightToeBase'],
      );
      binding.handContactOffsets.left = weightedCentroidOffset(scene, meshes, binding, 'LeftHand');
      binding.handContactOffsets.right = weightedCentroidOffset(scene, meshes, binding, 'RightHand');
    }
    this.targetSkeletons = skeletons;
    this.targetMeshes = meshes;
    this.vertices = meshes.reduce(
      (sum, mesh) => sum + (mesh.geometry.getAttribute('position')?.count ?? 0),
      0,
    );
    this.triangles = meshes.reduce((sum, mesh) => sum + triangleCount(mesh.geometry), 0);
    this.ignoredAnimations = scene.animations?.length ?? 0;
    this.loadedScene = scene;
    scene.name = 'meshy-fox-native-skin';
    this.root.add(scene);
    this.state = 'ready';
    this.failure = null;
    this.reset();
  }

  private installTargetCanonicalPose(
    binding: TargetBinding,
    restMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  ): void {
    const restQuaternions = matrixQuaternions(restMatrices);
    for (const [bone, quaternion] of restQuaternions) {
      this.targetCanonicalQuaternions.set(bone, quaternion);
    }
    for (const side of ['Left', 'Right'] as const) {
      const upper = binding.bonesByName.get(`${side}Arm`);
      const lower = binding.bonesByName.get(`${side}ForeArm`);
      const hand = binding.bonesByName.get(`${side}Hand`);
      if (!upper || !lower || !hand) continue;
      const start = new THREE.Vector3().setFromMatrixPosition(restMatrices.get(upper)!);
      const end = new THREE.Vector3().setFromMatrixPosition(restMatrices.get(lower)!);
      const restDirection = end.sub(start).normalize();
      const desiredDirection = new THREE.Vector3(side === 'Left' ? 1 : -1, 0, 0);
      const delta = new THREE.Quaternion().setFromUnitVectors(restDirection, desiredDirection);
      for (const bone of [upper, lower, hand]) {
        this.targetCanonicalQuaternions.set(
          bone,
          delta.clone().multiply(restQuaternions.get(bone)!).normalize(),
        );
      }
    }
  }

  private validateTargetSkeleton(skeleton: THREE.Skeleton): void {
    if (skeleton.bones.length !== MESHY_FOX_TARGET_BONE_NAMES.length) {
      throw new Error(`Meshy fox has ${skeleton.bones.length} bones; expected 24`);
    }
    const actual = new Set(skeleton.bones.map((bone) => bone.name));
    const missing = MESHY_FOX_TARGET_BONE_NAMES.filter((name) => !actual.has(name));
    if (missing.length) throw new Error(`Meshy fox is missing bones: ${missing.join(', ')}`);
  }

  private missingSourceBones(): string[] {
    return [...new Set(Object.values(MESHY_FOX_TARGET_TO_SOURCE_BONE)
      .filter((name): name is string => name !== null))]
      .filter((name) => !this.source.bonesByName.has(name));
  }

  private sourceSegmentScales(
    sourceMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
  ): Record<string, number> {
    const result: Record<string, number> = {};
    for (const segment of MESHY_FOX_DEFORMATION_SEGMENTS) {
      const startName = MESHY_FOX_TARGET_TO_SOURCE_BONE[segment.targetBone];
      const endName = MESHY_FOX_TARGET_TO_SOURCE_BONE[segment.targetEndpoint];
      const start = startName ? this.source.bonesByName.get(startName) : undefined;
      const end = endName ? this.source.bonesByName.get(endName) : undefined;
      const currentStart = start ? sourceMatrices.get(start) : undefined;
      const currentEnd = end ? sourceMatrices.get(end) : undefined;
      const restStart = start ? this.source.canonicalMatrices.get(start) : undefined;
      const restEnd = end ? this.source.canonicalMatrices.get(end) : undefined;
      if (!currentStart || !currentEnd || !restStart || !restEnd) {
        result[segment.id] = 1;
        continue;
      }
      const currentLength = V0.setFromMatrixPosition(currentStart)
        .distanceTo(V1.setFromMatrixPosition(currentEnd));
      const restLength = V0.setFromMatrixPosition(restStart)
        .distanceTo(V1.setFromMatrixPosition(restEnd));
      result[segment.id] = restLength > 1e-6
        ? THREE.MathUtils.clamp(currentLength / restLength, 0.25, 4)
        : 1;
    }
    return result;
  }

  private retargetSkeleton(
    binding: TargetBinding,
    sourceMatrices: ReadonlyMap<THREE.Bone, THREE.Matrix4>,
    sourceQuaternions: ReadonlyMap<THREE.Bone, THREE.Quaternion>,
    segmentScales: Readonly<Record<string, number>>,
  ): void {
    const targetSet = new Set(binding.skeleton.bones);
    const desiredWorld = new Map<THREE.Bone, THREE.Matrix4>();
    const endpointScale = new Map<MeshyFoxTargetBoneName, number>(
      MESHY_FOX_DEFORMATION_SEGMENTS.map((segment) => [
        segment.targetEndpoint,
        segmentScales[segment.id] ?? 1,
      ]),
    );
    const sourceHips = this.source.bonesByName.get('hips')!;
    const sourceCurrent = sourceMatrices.get(sourceHips)!;
    const sourceCanonical = this.source.canonicalMatrices.get(sourceHips)!;
    const targetHips = binding.bonesByName.get('Hips')!;
    const targetHipsRest = this.targetRestMatrices.get(targetHips)!;
    const desiredHips = new THREE.Vector3().setFromMatrixPosition(targetHipsRest);
    const heightRatio = binding.restHeight / Math.max(this.source.restHeight, 1e-6);
    desiredHips.addScaledVector(
      V0.setFromMatrixPosition(sourceCurrent).sub(V1.setFromMatrixPosition(sourceCanonical)),
      heightRatio,
    );
    const applyBone = (bone: THREE.Bone): void => {
      const rest = this.targetRest.get(bone)!;
      const restWorld = this.targetRestMatrices.get(bone)!;
      const parent = bone.parent;
      const parentWorld = parent && (parent as THREE.Bone).isBone && targetSet.has(parent as THREE.Bone)
        ? desiredWorld.get(parent as THREE.Bone)!
        : restWorld.clone().multiply(matrixFromTransform(rest).invert());
      const parentQuaternion = new THREE.Quaternion();
      parentWorld.decompose(V0, parentQuaternion, S0);
      const local = cloneTransform(rest);
      if (bone.name === 'Hips') {
        local.position.copy(desiredHips).applyMatrix4(parentWorld.clone().invert());
      } else {
        local.position.multiplyScalar(endpointScale.get(bone.name as MeshyFoxTargetBoneName) ?? 1);
      }
      const sourceName = MESHY_FOX_TARGET_TO_SOURCE_BONE[bone.name as MeshyFoxTargetBoneName];
      const sourceBone = sourceName ? this.source.bonesByName.get(sourceName) : undefined;
      if (sourceBone) {
        const desiredQuaternion = sourceQuaternions.get(sourceBone)!.clone()
          .multiply(this.source.canonicalQuaternions.get(sourceBone)!.clone().invert())
          .multiply(this.targetCanonicalQuaternions.get(bone)!)
          .normalize();
        local.quaternion.copy(parentQuaternion.invert().multiply(desiredQuaternion)).normalize();
      }
      bone.position.copy(local.position);
      bone.quaternion.copy(local.quaternion);
      bone.scale.copy(local.scale);
      desiredWorld.set(bone, parentWorld.clone().multiply(matrixFromTransform(local)));
      for (const child of bone.children) {
        if ((child as THREE.Bone).isBone && targetSet.has(child as THREE.Bone)) applyBone(child as THREE.Bone);
      }
    };
    for (const bone of binding.skeleton.bones) {
      const parent = bone.parent;
      if (!parent || !(parent as THREE.Bone).isBone || !targetSet.has(parent as THREE.Bone)) applyBone(bone);
    }
  }

  private sourceSocketTarget(name: string): THREE.Vector3 | null {
    const socket = this.source.root.getObjectByName(name);
    if (!socket || !this.loadedScene) return null;
    this.source.root.updateWorldMatrix(true, true);
    return this.loadedScene.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
  }

  private sourceChainPoleHint(chain: TwoBoneChain): THREE.Vector3 | null {
    const names = [chain.root, chain.middle, chain.end]
      .map((name) => MESHY_FOX_TARGET_TO_SOURCE_BONE[name]);
    const [root, middle, end] = names.map((name) =>
      name ? this.source.bonesByName.get(name) : undefined);
    if (!root || !middle || !end) return null;
    this.source.root.updateWorldMatrix(true, true);
    const rootPosition = root.getWorldPosition(new THREE.Vector3());
    const middleDirection = middle.getWorldPosition(new THREE.Vector3()).sub(rootPosition);
    const endDirection = end.getWorldPosition(new THREE.Vector3()).sub(rootPosition);
    if (middleDirection.lengthSq() <= 1e-10 || endDirection.lengthSq() <= 1e-10) return null;
    const upperLength = middleDirection.length();
    endDirection.normalize();
    const bend = middleDirection.addScaledVector(endDirection, -middleDirection.dot(endDirection));
    return bend.length() > upperLength * 0.05 ? bend : null;
  }

  private sourceForwardWorld(): THREE.Vector3 {
    this.source.root.updateWorldMatrix(true, true);
    const origin = this.source.root.getWorldPosition(new THREE.Vector3());
    return this.source.root.localToWorld(new THREE.Vector3(0, 0, 1)).sub(origin).normalize();
  }

  private setBoneWorldQuaternion(bone: THREE.Bone, world: THREE.Quaternion): void {
    if (!bone.parent) bone.quaternion.copy(world);
    else {
      bone.parent.getWorldQuaternion(Q1);
      bone.quaternion.copy(Q1.invert().multiply(world)).normalize();
    }
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
    const referenceLength = Math.max(rawPole.length(), 1e-6);
    const pole = rawPole.addScaledVector(direction, -rawPole.dot(direction));
    if (pole.length() <= referenceLength * 0.05) {
      pole.copy(stableForward).addScaledVector(direction, -stableForward.dot(direction));
      if (pole.lengthSq() <= 1e-10) pole.copy(FORWARD).cross(direction);
      if (pole.lengthSq() <= 1e-10) pole.copy(UP).cross(direction);
    }
    pole.normalize();
    const rootAngle = Math.acos(THREE.MathUtils.clamp(
      (upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach),
      -1,
      1,
    ));
    const solvedMiddle = rootPosition.clone()
      .addScaledVector(direction, upperLength * Math.cos(rootAngle))
      .addScaledVector(pole, upperLength * Math.sin(rootAngle));
    const currentUpper = middlePosition.clone().sub(rootPosition);
    const desiredUpper = solvedMiddle.clone().sub(rootPosition);
    if (currentUpper.lengthSq() > 1e-12 && desiredUpper.lengthSq() > 1e-12) {
      const world = root.getWorldQuaternion(new THREE.Quaternion());
      this.setBoneWorldQuaternion(
        root,
        new THREE.Quaternion().setFromUnitVectors(
          currentUpper.normalize(),
          desiredUpper.normalize(),
        ).multiply(world),
      );
    }
    this.root.updateMatrixWorld(true);
    const middleActual = middle.getWorldPosition(new THREE.Vector3());
    const currentLower = end.getWorldPosition(new THREE.Vector3()).sub(middleActual);
    const desiredLower = solvedEnd.clone().sub(middleActual);
    if (currentLower.lengthSq() > 1e-12 && desiredLower.lengthSq() > 1e-12) {
      const world = middle.getWorldQuaternion(new THREE.Quaternion());
      this.setBoneWorldQuaternion(
        middle,
        new THREE.Quaternion().setFromUnitVectors(
          currentLower.normalize(),
          desiredLower.normalize(),
        ).multiply(world),
      );
    }
    this.root.updateMatrixWorld(true);
  }

  private solveTwoBoneIk(
    binding: TargetBinding,
    chain: TwoBoneChain,
    contactTarget: THREE.Vector3,
    contactOffset: THREE.Vector3,
  ): number | null {
    const root = binding.bonesByName.get(chain.root);
    const middle = binding.bonesByName.get(chain.middle);
    const end = binding.bonesByName.get(chain.end);
    if (!root || !middle || !end) return null;
    const passes = contactOffset.lengthSq() > 1e-12 ? 3 : 1;
    for (let pass = 0; pass < passes; pass++) {
      this.root.updateMatrixWorld(true);
      const endPosition = end.getWorldPosition(new THREE.Vector3());
      const target = contactOffset.lengthSq() > 1e-12
        ? contactTarget.clone().sub(end.localToWorld(contactOffset.clone()).sub(endPosition))
        : contactTarget;
      this.solveTwoBoneEnd(
        root,
        middle,
        end,
        target,
        this.sourceChainPoleHint(chain),
        this.sourceForwardWorld(),
      );
    }
    const contact = contactOffset.lengthSq() > 1e-12
      ? end.localToWorld(contactOffset.clone())
      : end.getWorldPosition(new THREE.Vector3());
    return contact.distanceTo(contactTarget);
  }

  private applyPresentationIk(): void {
    const chains: readonly [ContactKey, TwoBoneChain, string, 'foot' | 'hand'][] = [
      ['footLeft', { root: 'LeftUpLeg', middle: 'LeftLeg', end: 'LeftFoot' }, 'socket-foot-left', 'foot'],
      ['footRight', { root: 'RightUpLeg', middle: 'RightLeg', end: 'RightFoot' }, 'socket-foot-right', 'foot'],
      ['handLeft', { root: 'LeftArm', middle: 'LeftForeArm', end: 'LeftHand' }, 'socket-grip-left', 'hand'],
      ['handRight', { root: 'RightArm', middle: 'RightForeArm', end: 'RightHand' }, 'socket-grip-right', 'hand'],
    ];
    const errors: Record<ContactKey, number | null> = {
      footLeft: null,
      footRight: null,
      handLeft: null,
      handRight: null,
    };
    for (let index = 0; index < this.targetBindings.length; index++) {
      const binding = this.targetBindings[index];
      for (const [key, chain, socketName, kind] of chains) {
        const localTarget = this.sourceSocketTarget(socketName);
        if (!localTarget || !this.loadedScene) continue;
        const worldTarget = this.loadedScene.localToWorld(localTarget.clone());
        const side = key.endsWith('Left') ? 'left' : 'right';
        const offset = kind === 'foot'
          ? binding.footContactOffsets[side]
          : binding.handContactOffsets[side];
        const error = this.solveTwoBoneIk(binding, chain, worldTarget, offset);
        if (index === 0) errors[key] = error;
      }
    }
    this.contactErrors = errors;
  }
}
