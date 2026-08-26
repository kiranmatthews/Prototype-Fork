import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The source rig names in punky-fox.glb. Keeping this list literal gives the
 * animation authoring and player adapters compile-time checked bone names.
 */
export const PUNKY_SOURCE_BONE_NAMES = [
  'Hips',
  'Spine02',
  'Spine01',
  'Spine',
  'neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
  'Ear.L',
  'Ear.R',
  'Ponytail.L',
  'Ponytail.L.Tip',
  'Ponytail.R',
  'Ponytail.R.Tip',
] as const;

export type PunkySourceBoneName = (typeof PUNKY_SOURCE_BONE_NAMES)[number];

/** Stable, engine-facing names. Source left/right follows the model file. */
export const PUNKY_BONE_MAP = {
  hips: 'Hips',
  spineLower: 'Spine02',
  spineMid: 'Spine01',
  chest: 'Spine',
  neck: 'neck',
  head: 'Head',
  leftClavicle: 'LeftShoulder',
  leftUpperArm: 'LeftArm',
  leftForearm: 'LeftForeArm',
  leftHand: 'LeftHand',
  rightClavicle: 'RightShoulder',
  rightUpperArm: 'RightArm',
  rightForearm: 'RightForeArm',
  rightHand: 'RightHand',
  leftThigh: 'LeftUpLeg',
  leftShin: 'LeftLeg',
  leftFoot: 'LeftFoot',
  leftToes: 'LeftToeBase',
  rightThigh: 'RightUpLeg',
  rightShin: 'RightLeg',
  rightFoot: 'RightFoot',
  rightToes: 'RightToeBase',
  leftEar: 'Ear.L',
  rightEar: 'Ear.R',
  leftPonytail: 'Ponytail.L',
  leftPonytailTip: 'Ponytail.L.Tip',
  rightPonytail: 'Ponytail.R',
  rightPonytailTip: 'Ponytail.R.Tip',
} as const satisfies Record<string, PunkySourceBoneName>;

export type PunkyBoneKey = keyof typeof PUNKY_BONE_MAP;
export type PunkyBoneId = PunkyBoneKey | PunkySourceBoneName;
export type PunkyBones = Readonly<Record<PunkyBoneKey, THREE.Bone>>;
export type PunkySocketKey = 'hips' | 'head' | 'leftHand' | 'rightHand' | 'leftFoot' | 'rightFoot';
export type PunkySockets = Readonly<Record<PunkySocketKey, THREE.Object3D>>;

export interface PunkyCharacterLoadOptions {
  /** Defaults to the Vite/GitHub Pages-aware public model URL. */
  url?: string;
  manager?: THREE.LoadingManager;
  onProgress?: (event: ProgressEvent<EventTarget>) => void;
  /** Model height in its eventual parent's local space. Null preserves 1.8 m. */
  targetHeight?: number | null;
  /** Put the bind-pose feet at y=0 and centre its XZ bounds. Default true. */
  normalizeOrigin?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
}

export type RootMotionMode = 'keep' | 'lock-xz' | 'lock-xyz';

export interface RegisterClipOptions {
  name?: string;
  /**
   * Keeps simulation authoritative. lock-xz preserves vertical squash/jump
   * motion while removing forward travel from the Hips position track.
   */
  rootMotion?: RootMotionMode;
  rootBone?: PunkySourceBoneName;
}

export interface PlayClipOptions {
  fade?: number;
  loop?: boolean;
  repetitions?: number;
  clampWhenFinished?: boolean;
  weight?: number;
  timeScale?: number;
  startTime?: number;
}

export interface PunkyBoneDelta {
  /** Local Euler delta, in radians. */
  rotation?: THREE.Euler | readonly [x: number, y: number, z: number];
  /** Local quaternion delta. Applied after the sampled animation by default. */
  quaternion?: THREE.Quaternion | readonly [x: number, y: number, z: number, w: number];
  translation?: THREE.Vector3 | readonly [x: number, y: number, z: number];
  /** Additive fractional scale: [0.1, 0, 0] makes X 10% larger. */
  scale?: THREE.Vector3 | readonly [x: number, y: number, z: number];
  weight?: number;
  /** Parent premultiplies the rotation; local postmultiplies it. */
  rotationSpace?: 'local' | 'parent';
}

export type PunkyAdditivePose = Partial<Record<PunkyBoneId, PunkyBoneDelta>>;

export interface PunkySecondaryMotion {
  /** World-space m/s^2. Omit to derive it from the character root. */
  acceleration?: THREE.Vector3;
  /** World-space radians/s. Omit to derive it from the character root. */
  angularVelocity?: THREE.Vector3;
  /** World-space stylised force; units are deliberately acceleration-like. */
  wind?: THREE.Vector3;
  weight?: number;
  /** Clears velocity history after a warp, respawn, or model swap. */
  teleport?: boolean;
}

export interface PunkyFrameOptions {
  /** Additive gameplay pose, evaluated after clips and before secondary motion. */
  pose?: PunkyAdditivePose;
  poseWeight?: number;
  secondary?: PunkySecondaryMotion | false;
}

export type PunkyPoseHook = (character: PunkyCharacter, dt: number) => void;

interface BoneRest {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

interface SpringConfig {
  bone: PunkyBoneKey;
  stiffness: number;
  damping: number;
  inertia: number;
  turn: number;
  wind: number;
  max: number;
  side: number;
}

interface SpringState {
  config: SpringConfig;
  angle: THREE.Vector3;
  velocity: THREE.Vector3;
}

const SPRING_CONFIGS: readonly SpringConfig[] = [
  {
    bone: 'leftPonytail',
    stiffness: 62,
    damping: 13,
    inertia: 0.012,
    turn: 0.018,
    wind: 0.008,
    max: 0.3,
    side: 1,
  },
  {
    bone: 'rightPonytail',
    stiffness: 62,
    damping: 13,
    inertia: 0.012,
    turn: 0.018,
    wind: 0.008,
    max: 0.3,
    side: -1,
  },
  {
    bone: 'leftPonytailTip',
    stiffness: 42,
    damping: 9.5,
    inertia: 0.018,
    turn: 0.025,
    wind: 0.012,
    max: 0.42,
    side: 1,
  },
  {
    bone: 'rightPonytailTip',
    stiffness: 42,
    damping: 9.5,
    inertia: 0.018,
    turn: 0.025,
    wind: 0.012,
    max: 0.42,
    side: -1,
  },
  {
    bone: 'leftEar',
    stiffness: 108,
    damping: 19,
    inertia: 0.004,
    turn: 0.008,
    wind: 0.002,
    max: 0.13,
    side: 1,
  },
  {
    bone: 'rightEar',
    stiffness: 108,
    damping: 19,
    inertia: 0.004,
    turn: 0.008,
    wind: 0.002,
    max: 0.13,
    side: -1,
  },
] as const;

const ZERO = new THREE.Vector3();
const IDENTITY_Q = new THREE.Quaternion();
const _deltaQ = new THREE.Quaternion();
const _weightedDeltaQ = new THREE.Quaternion();
const _deltaE = new THREE.Euler();
const _deltaV = new THREE.Vector3();
const _worldP = new THREE.Vector3();
const _worldQ = new THREE.Quaternion();
const _inverseQ = new THREE.Quaternion();
const _motionV = new THREE.Vector3();
const _motionA = new THREE.Vector3();
const _motionW = new THREE.Vector3();
const _motionWind = new THREE.Vector3();
const _rootDeltaQ = new THREE.Quaternion();
const _rootAxis = new THREE.Vector3();
const _parentInverse = new THREE.Matrix4();
const _localMatrix = new THREE.Matrix4();

/** GLTFLoader sanitizes dots/colons so PropertyBinding can address the node. */
function runtimeBoneName(sourceName: PunkySourceBoneName): string {
  return THREE.PropertyBinding.sanitizeNodeName(sourceName);
}

function asVector3(
  value: THREE.Vector3 | readonly [number, number, number],
  target: THREE.Vector3,
): THREE.Vector3 {
  return value instanceof THREE.Vector3 ? target.copy(value) : target.set(value[0], value[1], value[2]);
}

function asQuaternion(
  delta: PunkyBoneDelta,
  target: THREE.Quaternion,
): THREE.Quaternion | null {
  if (delta.quaternion) {
    const q = delta.quaternion;
    if (q instanceof THREE.Quaternion) return target.copy(q);
    return target.set(q[0], q[1], q[2], q[3]).normalize();
  }
  if (delta.rotation) {
    const r = delta.rotation;
    if (r instanceof THREE.Euler) return target.setFromEuler(r);
    _deltaE.set(r[0], r[1], r[2], 'XYZ');
    return target.setFromEuler(_deltaE);
  }
  return null;
}

function cloneWithoutRootMotion(
  source: THREE.AnimationClip,
  mode: RootMotionMode,
  rootBone: PunkySourceBoneName,
): THREE.AnimationClip {
  const clip = source.clone();
  if (mode === 'keep') return clip;
  for (const track of clip.tracks) {
    if (!track.name.endsWith(`${rootBone}.position`) || track.getValueSize() !== 3) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const x = values[0];
    const y = values[1];
    const z = values[2];
    for (let i = 0; i + 2 < values.length; i += 3) {
      values[i] = x;
      if (mode === 'lock-xyz') values[i + 1] = y;
      values[i + 2] = z;
    }
  }
  return clip;
}

function disposeOwnedScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry) geometries.add(mesh.geometry);
      const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of source) if (material) materials.add(material);
    }
    const skinned = object as THREE.SkinnedMesh;
    if (skinned.isSkinnedMesh && skinned.skeleton) skeletons.add(skinned.skeleton);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value);
    }
  }
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

function animationTime(clip: THREE.AnimationClip, time: number, loop: boolean): number {
  if (clip.duration <= 0) return 0;
  if (!loop) return THREE.MathUtils.clamp(time, 0, clip.duration);
  return THREE.MathUtils.euclideanModulo(time, clip.duration);
}

/**
 * Runtime wrapper for the full-resolution Punky Fox skin. The imported
 * SkinnedMesh stays intact; no vertex segmentation or rigid chunk conversion
 * happens in this class.
 */
export class PunkyCharacter {
  readonly root = new THREE.Group();
  readonly content = new THREE.Group();
  readonly assetRoot: THREE.Group;
  readonly mixer: THREE.AnimationMixer;
  readonly bones: PunkyBones;
  readonly sockets: PunkySockets;
  readonly meshes: readonly THREE.SkinnedMesh[];
  readonly sourceBounds: THREE.Box3;
  readonly fittedHeight: number;

  private readonly rest = new Map<THREE.Bone, BoneRest>();
  private readonly clips = new Map<string, THREE.AnimationClip>();
  private readonly hooks = new Set<PunkyPoseHook>();
  private readonly touchedBones = new Set<THREE.Bone>();
  /** Animation-sampled transform beneath the last procedural override. */
  private readonly overrideBase = new Map<THREE.Bone, BoneRest>();
  private readonly springs: SpringState[];
  private currentAction: THREE.AnimationAction | null = null;
  private previousWorldPosition = new THREE.Vector3();
  private previousWorldQuaternion = new THREE.Quaternion();
  private previousVelocity = new THREE.Vector3();
  private filteredAcceleration = new THREE.Vector3();
  private hasMotionHistory = false;
  private disposed = false;

  private constructor(
    scene: THREE.Group,
    animations: readonly THREE.AnimationClip[],
    options: PunkyCharacterLoadOptions,
  ) {
    this.root.name = 'PunkyCharacter';
    this.content.name = 'PunkyCharacterContent';
    this.assetRoot = scene;
    this.sourceBounds = new THREE.Box3().setFromObject(scene);
    const size = this.sourceBounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 1e-6) throw new Error('punky-fox.glb has invalid bind-pose bounds');

    const targetHeight = options.targetHeight === undefined ? size.y : options.targetHeight;
    const scale = targetHeight === null ? 1 : targetHeight / size.y;
    this.fittedHeight = size.y * scale;
    if (options.normalizeOrigin !== false) {
      const centre = this.sourceBounds.getCenter(new THREE.Vector3());
      scene.position.set(-centre.x, -this.sourceBounds.min.y, -centre.z);
    }
    this.content.scale.setScalar(scale);
    this.content.add(scene);
    this.root.add(this.content);

    const sourceBones = new Map<string, THREE.Bone>();
    const meshes: THREE.SkinnedMesh[] = [];
    scene.traverse((object) => {
      if ((object as THREE.Bone).isBone) sourceBones.set(object.name, object as THREE.Bone);
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = object as THREE.SkinnedMesh;
        mesh.castShadow = options.castShadow ?? true;
        mesh.receiveShadow = options.receiveShadow ?? true;
        mesh.frustumCulled = options.frustumCulled ?? true;
        meshes.push(mesh);
      }
    });
    if (meshes.length === 0) throw new Error('punky-fox.glb contains no SkinnedMesh');

    const missing = PUNKY_SOURCE_BONE_NAMES.filter((name) => !sourceBones.has(runtimeBoneName(name)));
    if (missing.length > 0) {
      throw new Error(`punky-fox.glb is missing required bones: ${missing.join(', ')}`);
    }
    const semanticBones = {} as Record<PunkyBoneKey, THREE.Bone>;
    for (const key of Object.keys(PUNKY_BONE_MAP) as PunkyBoneKey[]) {
      const sourceName = PUNKY_BONE_MAP[key];
      const bone = sourceBones.get(runtimeBoneName(sourceName));
      if (!bone) throw new Error(`punky-fox.glb cannot bind semantic bone ${key} (${sourceName})`);
      semanticBones[key] = bone;
    }
    this.bones = semanticBones;
    this.meshes = meshes;
    for (const mesh of meshes) {
      if (!mesh.name) mesh.name = 'PunkyFoxSkin';
      mesh.userData.sculptPart = 'skinned-surface';
    }

    const makeSocket = (key: PunkySocketKey, parent: THREE.Bone): THREE.Object3D => {
      const socket = new THREE.Object3D();
      socket.name = `socket:${key}`;
      socket.userData.socketId = key;
      parent.add(socket);
      return socket;
    };
    this.sockets = {
      hips: makeSocket('hips', semanticBones.hips),
      head: makeSocket('head', semanticBones.head),
      leftHand: makeSocket('leftHand', semanticBones.leftHand),
      rightHand: makeSocket('rightHand', semanticBones.rightHand),
      leftFoot: makeSocket('leftFoot', semanticBones.leftFoot),
      rightFoot: makeSocket('rightFoot', semanticBones.rightFoot),
    };

    for (const bone of sourceBones.values()) {
      this.rest.set(bone, {
        position: bone.position.clone(),
        quaternion: bone.quaternion.clone(),
        scale: bone.scale.clone(),
      });
    }
    this.springs = SPRING_CONFIGS.map((config) => ({
      config,
      angle: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
    }));

    this.mixer = new THREE.AnimationMixer(scene);
    for (const clip of animations) this.registerClip(clip);
    this.root.userData.sculptRuntime = {
      schemaVersion: 1,
      kind: 'skinned-character',
      asset: 'models/punky-fox.glb',
      parts: this.bones,
      sockets: this.sockets,
      colliders: [
        {
          id: 'character-body',
          shape: 'capsule',
          radius: this.fittedHeight * 0.14,
          height: this.fittedHeight * 0.72,
          centerY: this.fittedHeight * 0.5,
          authority: 'Player gameplay collider',
        },
      ],
      destructionGroups: [],
      destructible: false,
      animationClips: this.clipNames,
    };
  }

  static async load(options: PunkyCharacterLoadOptions = {}): Promise<PunkyCharacter> {
    const url = options.url ?? `${import.meta.env.BASE_URL}models/punky-fox.glb`;
    const loader = new GLTFLoader(options.manager);
    const gltf = await loader.loadAsync(url, options.onProgress);
    try {
      return new PunkyCharacter(gltf.scene, gltf.animations, options);
    } catch (error) {
      disposeOwnedScene(gltf.scene);
      throw error;
    }
  }

  get isDisposed(): boolean {
    return this.disposed;
  }

  get visible(): boolean {
    return this.root.visible;
  }

  set visible(value: boolean) {
    this.root.visible = value;
  }

  get activeClipName(): string | null {
    return this.currentAction?.getClip().name ?? null;
  }

  get clipNames(): readonly string[] {
    return [...this.clips.keys()];
  }

  setVisible(visible: boolean): this {
    this.root.visible = visible;
    return this;
  }

  attach(parent: THREE.Object3D): this {
    parent.add(this.root);
    return this;
  }

  detach(): this {
    this.root.removeFromParent();
    return this;
  }

  /** Copy another object's local TRS. Useful when both roots share a parent. */
  syncLocalFrom(source: THREE.Object3D, copyVisibility = true): this {
    this.root.position.copy(source.position);
    this.root.quaternion.copy(source.quaternion);
    this.root.scale.copy(source.scale);
    if (copyVisibility) this.root.visible = source.visible;
    return this;
  }

  /** Copy an object's world transform, compensating for this root's parent. */
  syncWorldFrom(source: THREE.Object3D, copyVisibility = true): this {
    source.updateWorldMatrix(true, false);
    if (this.root.parent) {
      this.root.parent.updateWorldMatrix(true, false);
      _parentInverse.copy(this.root.parent.matrixWorld).invert();
      _localMatrix.multiplyMatrices(_parentInverse, source.matrixWorld);
    } else {
      _localMatrix.copy(source.matrixWorld);
    }
    _localMatrix.decompose(this.root.position, this.root.quaternion, this.root.scale);
    if (copyVisibility) this.root.visible = source.visible;
    return this;
  }

  bone(id: PunkyBoneId): THREE.Bone {
    const key = id as PunkyBoneKey;
    const semantic = this.bones[key];
    if (semantic) return semantic;
    const sourceName = id as PunkySourceBoneName;
    const bone = this.assetRoot.getObjectByName(runtimeBoneName(sourceName)) as THREE.Bone | undefined;
    if (!bone?.isBone) throw new Error(`Unknown Punky bone: ${id}`);
    return bone;
  }

  registerClip(source: THREE.AnimationClip, options: RegisterClipOptions = {}): THREE.AnimationClip {
    this.assertLive();
    const name = options.name ?? source.name;
    if (!name) throw new Error('Animation clips need a stable non-empty name');
    const clip = cloneWithoutRootMotion(
      source,
      options.rootMotion ?? 'lock-xz',
      options.rootBone ?? 'Hips',
    );
    clip.name = name;
    const old = this.clips.get(name);
    if (old) {
      if (this.currentAction?.getClip() === old) this.currentAction = null;
      this.mixer.uncacheClip(old);
    }
    this.clips.set(name, clip);
    return clip;
  }

  registerClips(
    sources: readonly THREE.AnimationClip[],
    options: Omit<RegisterClipOptions, 'name'> = {},
  ): void {
    for (const source of sources) this.registerClip(source, options);
  }

  clip(name: string): THREE.AnimationClip | null {
    return this.clips.get(name) ?? null;
  }

  playClip(name: string, options: PlayClipOptions = {}): THREE.AnimationAction {
    this.assertLive();
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`Unknown Punky animation clip: ${name}`);
    const next = this.mixer.clipAction(clip);
    const previous = this.currentAction;
    next.enabled = true;
    next.paused = false;
    next.clampWhenFinished = options.clampWhenFinished ?? options.loop === false;
    next.setLoop(options.loop === false ? THREE.LoopOnce : THREE.LoopRepeat, options.repetitions ?? Infinity);
    next.setEffectiveWeight(options.weight ?? 1);
    next.setEffectiveTimeScale(options.timeScale ?? 1);
    next.reset();
    next.time = animationTime(clip, options.startTime ?? 0, options.loop !== false);
    next.play();
    const fade = Math.max(0, options.fade ?? 0.12);
    if (previous && previous !== next) {
      if (fade > 0) next.crossFadeFrom(previous, fade, true);
      else previous.stop();
    }
    this.currentAction = next;
    return next;
  }

  stopClips(fade = 0): void {
    if (this.disposed) return;
    if (fade > 0 && this.currentAction) this.currentAction.fadeOut(fade);
    else this.mixer.stopAllAction();
    this.currentAction = null;
  }

  /**
   * Deterministically sample one clip. This intentionally replaces live
   * playback; it is intended for state-driven code animation and review rigs.
   */
  sampleClip(name: string, time: number, loop = true): THREE.AnimationAction {
    this.assertLive();
    const clip = this.clips.get(name);
    if (!clip) throw new Error(`Unknown Punky animation clip: ${name}`);
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip).reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.time = animationTime(clip, time, loop);
    action.paused = true;
    action.play();
    this.mixer.update(0);
    this.currentAction = action;
    return action;
  }

  addPoseHook(hook: PunkyPoseHook): () => void {
    this.assertLive();
    this.hooks.add(hook);
    return () => this.hooks.delete(hook);
  }

  applyBoneDelta(id: PunkyBoneId, delta: PunkyBoneDelta, outerWeight = 1): void {
    this.assertLive();
    const bone = this.bone(id);
    const weight = THREE.MathUtils.clamp((delta.weight ?? 1) * outerWeight, 0, 1);
    if (weight <= 0) return;
    if (!this.touchedBones.has(bone)) {
      let base = this.overrideBase.get(bone);
      if (!base) {
        base = {
          position: new THREE.Vector3(),
          quaternion: new THREE.Quaternion(),
          scale: new THREE.Vector3(),
        };
        this.overrideBase.set(bone, base);
      }
      base.position.copy(bone.position);
      base.quaternion.copy(bone.quaternion);
      base.scale.copy(bone.scale);
      this.touchedBones.add(bone);
    }
    const rotation = asQuaternion(delta, _deltaQ);
    if (rotation) {
      const weightedRotation = weight < 1
        ? _weightedDeltaQ.copy(IDENTITY_Q).slerp(rotation, weight)
        : rotation;
      if (delta.rotationSpace === 'parent') bone.quaternion.premultiply(weightedRotation);
      else bone.quaternion.multiply(weightedRotation);
      bone.quaternion.normalize();
    }
    if (delta.translation) {
      asVector3(delta.translation, _deltaV).multiplyScalar(weight);
      bone.position.add(_deltaV);
    }
    if (delta.scale) {
      asVector3(delta.scale, _deltaV).multiplyScalar(weight).addScalar(1);
      bone.scale.multiply(_deltaV);
    }
  }

  applyAdditivePose(pose: PunkyAdditivePose, weight = 1): void {
    for (const id of Object.keys(pose) as PunkyBoneId[]) {
      const delta = pose[id];
      if (delta) this.applyBoneDelta(id, delta, weight);
    }
  }

  /** Restore every joint to the imported bind/rest pose and clear springs. */
  resetPose(): void {
    this.assertLive();
    for (const [bone, rest] of this.rest) {
      bone.position.copy(rest.position);
      bone.quaternion.copy(rest.quaternion);
      bone.scale.copy(rest.scale);
    }
    this.touchedBones.clear();
    this.resetSecondaryMotion();
  }

  resetSecondaryMotion(): void {
    for (const spring of this.springs) {
      spring.angle.set(0, 0, 0);
      spring.velocity.set(0, 0, 0);
    }
    this.previousVelocity.set(0, 0, 0);
    this.filteredAcceleration.set(0, 0, 0);
    this.hasMotionHistory = false;
  }

  /**
   * Frame order is deliberate: undo last frame's procedural deltas, advance
   * clips, apply gameplay pose/hooks, then solve ears and ponytails last.
   */
  update(dt: number, frame: PunkyFrameOptions = {}): void {
    if (this.disposed) return;
    const step = THREE.MathUtils.clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    this.restoreTouchedBones();
    this.mixer.update(step);
    if (frame.pose) this.applyAdditivePose(frame.pose, frame.poseWeight ?? 1);
    for (const hook of this.hooks) hook(this, step);
    if (frame.secondary !== false) this.updateSecondaryMotion(step, frame.secondary);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    for (const clip of this.clips.values()) this.mixer.uncacheClip(clip);
    this.mixer.uncacheRoot(this.assetRoot);
    this.clips.clear();
    this.hooks.clear();
    this.touchedBones.clear();
    this.overrideBase.clear();
    this.root.removeFromParent();
    disposeOwnedScene(this.assetRoot);
    this.root.clear();
  }

  private updateSecondaryMotion(dt: number, input: PunkySecondaryMotion = {}): void {
    if (input.teleport) this.resetSecondaryMotion();
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldPosition(_worldP);
    this.root.getWorldQuaternion(_worldQ);

    let measuredAcceleration = ZERO;
    let measuredAngularVelocity = ZERO;
    if (dt > 1e-5 && this.hasMotionHistory) {
      _motionV.copy(_worldP).sub(this.previousWorldPosition).multiplyScalar(1 / dt);
      _motionA.copy(_motionV).sub(this.previousVelocity).multiplyScalar(1 / dt);
      if (_motionA.lengthSq() > 45 * 45) _motionA.setLength(45);
      const accelEase = 1 - Math.exp(-12 * dt);
      this.filteredAcceleration.lerp(_motionA, accelEase);
      measuredAcceleration = this.filteredAcceleration;
      this.previousVelocity.copy(_motionV);

      // current * inverse(previous) is the world-space delta. (The opposite
      // order is local-space and would be transformed a second time below.)
      _rootDeltaQ.copy(_worldQ).multiply(_inverseQ.copy(this.previousWorldQuaternion).invert()).normalize();
      if (_rootDeltaQ.w < 0) _rootDeltaQ.set(-_rootDeltaQ.x, -_rootDeltaQ.y, -_rootDeltaQ.z, -_rootDeltaQ.w);
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(_rootDeltaQ.w, -1, 1));
      const sinHalf = Math.sqrt(Math.max(1e-10, 1 - _rootDeltaQ.w * _rootDeltaQ.w));
      _rootAxis.set(_rootDeltaQ.x / sinHalf, _rootDeltaQ.y / sinHalf, _rootDeltaQ.z / sinHalf);
      measuredAngularVelocity = _motionW.copy(_rootAxis).multiplyScalar(angle / dt);
      if (_motionW.lengthSq() > 20 * 20) _motionW.setLength(20);
    } else {
      this.previousVelocity.set(0, 0, 0);
      this.hasMotionHistory = true;
    }
    this.previousWorldPosition.copy(_worldP);
    this.previousWorldQuaternion.copy(_worldQ);

    _inverseQ.copy(_worldQ).invert();
    const acceleration = _motionA.copy(input.acceleration ?? measuredAcceleration).applyQuaternion(_inverseQ);
    const angular = _motionW.copy(input.angularVelocity ?? measuredAngularVelocity).applyQuaternion(_inverseQ);
    const wind = _motionWind.copy(input.wind ?? ZERO).applyQuaternion(_inverseQ);
    const weight = THREE.MathUtils.clamp(input.weight ?? 1, 0, 1);
    const substeps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = substeps > 0 ? dt / substeps : 0;

    for (const spring of this.springs) {
      const c = spring.config;
      const targetX = THREE.MathUtils.clamp(
        (-acceleration.z * c.inertia - angular.x * c.turn + wind.z * c.wind) * weight,
        -c.max,
        c.max,
      );
      const targetY = THREE.MathUtils.clamp(
        (-angular.y * c.turn * c.side + wind.x * c.wind * c.side) * weight,
        -c.max * 0.65,
        c.max * 0.65,
      );
      const targetZ = THREE.MathUtils.clamp(
        (acceleration.x * c.inertia - angular.z * c.turn - wind.x * c.wind) * weight,
        -c.max,
        c.max,
      );
      for (let i = 0; i < substeps; i++) {
        spring.velocity.x += (targetX - spring.angle.x) * c.stiffness * h;
        spring.velocity.y += (targetY - spring.angle.y) * c.stiffness * h;
        spring.velocity.z += (targetZ - spring.angle.z) * c.stiffness * h;
        const drag = Math.exp(-c.damping * h);
        spring.velocity.multiplyScalar(drag);
        spring.angle.addScaledVector(spring.velocity, h);
      }
      spring.angle.clampScalar(-c.max, c.max);
      this.applyBoneDelta(c.bone, {
        rotation: [spring.angle.x, spring.angle.y, spring.angle.z],
      });
    }
  }

  private restoreTouchedBones(): void {
    for (const bone of this.touchedBones) {
      // Restore the animation sample that existed immediately before the
      // override, not necessarily bind pose. AnimationMixer skips redundant
      // property writes, so restoring bind pose here can otherwise make a
      // paused/constant clip silently disappear on the following frame.
      const base = this.overrideBase.get(bone);
      if (!base) continue;
      bone.position.copy(base.position);
      bone.quaternion.copy(base.quaternion);
      bone.scale.copy(base.scale);
    }
    this.touchedBones.clear();
  }

  private assertLive(): void {
    if (this.disposed) throw new Error('PunkyCharacter has been disposed');
  }
}
