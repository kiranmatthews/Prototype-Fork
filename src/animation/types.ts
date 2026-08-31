export const RIG_SCHEMA = 'sol-rig' as const;
export const RIG_SCHEMA_VERSION = 2 as const;
export const ANIMATION_SUITE_SCHEMA = 'sol-animation-suite' as const;
export const ANIMATION_SUITE_SCHEMA_VERSION = 2 as const;
export const PROCEDURAL_DRIVER_SCHEMA = 'sol-procedural-driver' as const;
export const PROCEDURAL_DRIVER_SCHEMA_VERSION = 1 as const;

export type JointId = string;
export type ControlId = string;
export type ClipId = string;
export type TrackId = string;
export type KeyframeId = string;

export type Vec3Tuple = [number, number, number];
export type QuaternionTuple = [number, number, number, number];

export interface LocalTransform {
  position: Vec3Tuple;
  quaternion: QuaternionTuple;
  scale: Vec3Tuple;
}

export interface RigCoordinateSystem {
  handedness: 'left' | 'right';
  up: 'X' | 'Y' | 'Z';
  localForward: string;
  units: string;
  worldUnitApproximation?: string;
  visualScale?: Vec3Tuple;
}

export interface JointStretchPolicy {
  mode: 'none' | 'scale' | 'translate-children';
  /** Scalar animation control that drives this policy (1 = rest length). */
  controlId?: ControlId;
  /** Unit direction in this joint's local space. */
  lengthAxis: Vec3Tuple;
  min: number;
  max: number;
  preserveVolume?: boolean;
  childIds?: JointId[];
}

/**
 * Conventional humanoid roles are deliberately independent from scene-node
 * names and joint IDs. A procedural rig can therefore keep stable authored
 * IDs while exposing enough anatomy for retargeting and generic IK.
 */
export const HUMANOID_JOINT_ROLES = [
  'root',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'clavicleLeft',
  'upperArmLeft',
  'lowerArmLeft',
  'handLeft',
  'upperLegLeft',
  'lowerLegLeft',
  'footLeft',
  'toesLeft',
  'clavicleRight',
  'upperArmRight',
  'lowerArmRight',
  'handRight',
  'upperLegRight',
  'lowerLegRight',
  'footRight',
  'toesRight',
] as const;

export type HumanoidJointRole = typeof HUMANOID_JOINT_ROLES[number];

/** Maps conventional anatomy to stable IDs in this particular rig. */
export interface HumanoidSemanticMap {
  /** Optional motion/root joint above the pelvis. */
  root?: JointId;
  /** The pelvis/hips joint. `hips` is the interchange semantic name. */
  hips: JointId;
  spine: JointId;
  chest: JointId;
  neck: JointId;
  head: JointId;
  clavicleLeft: JointId;
  upperArmLeft: JointId;
  lowerArmLeft: JointId;
  handLeft: JointId;
  upperLegLeft: JointId;
  lowerLegLeft: JointId;
  footLeft: JointId;
  toesLeft: JointId;
  clavicleRight: JointId;
  upperArmRight: JointId;
  lowerArmRight: JointId;
  handRight: JointId;
  upperLegRight: JointId;
  lowerLegRight: JointId;
  footRight: JointId;
  toesRight: JointId;
}

export interface RigJointDefinition {
  /** Stable semantic identity used by animation tracks; never a display label. */
  id: JointId;
  /** Object3D.name used to find the live scene node. */
  nodeName: string;
  name?: string;
  parentId: JointId | null;
  rest: LocalTransform;
  /** Semantic purpose, usually one of HUMANOID_JOINT_ROLES. Open for creature rigs. */
  role?: string;
  /** Implementation category such as bone, transform, deform, control, or helper. */
  type?: string;
  /** Historical/foreign IDs accepted by clips without rewriting their tracks. */
  aliases?: JointId[];
  /** Optional source bind local, retained for faithful import and skin binding. */
  bind?: LocalTransform;
  /** Optional canonical retarget local (normally a humanoid T-pose). */
  retarget?: LocalTransform;
  mirrorId?: JointId;
  tags?: string[];
  stretch?: JointStretchPolicy;
}

export interface RigSocketDefinition {
  id: string;
  nodeName: string;
  parentJointId?: JointId;
  mirrorId?: string;
  tags?: string[];
}

export interface RigControlDefinition {
  id: ControlId;
  name?: string;
  defaultValue: number;
  min?: number;
  max?: number;
  mirrorId?: ControlId;
  /** Applied after swapping a mirrored pair; useful for signed controls. */
  mirrorSign?: 1 | -1;
}

export interface RigMirrorDefinition {
  axis: 'x' | 'y' | 'z';
  jointPairs: [JointId, JointId][];
  controlPairs?: [ControlId, ControlId][];
}

export interface RigDefinition {
  schema: typeof RIG_SCHEMA;
  version: typeof RIG_SCHEMA_VERSION;
  id: string;
  name: string;
  rootJointId: JointId;
  coordinateSystem: RigCoordinateSystem;
  joints: RigJointDefinition[];
  sockets: RigSocketDefinition[];
  controls: RigControlDefinition[];
  /** Present when this arbitrary rig also satisfies the humanoid contract. */
  humanoid?: HumanoidSemanticMap;
  mirror?: RigMirrorDefinition;
  metadata?: Record<string, JsonValue>;
}

export type KeyInterpolation = 'step' | 'linear' | 'cubic';

export interface ScalarKeyframe {
  id: KeyframeId;
  time: number;
  value: number;
  interpolation: KeyInterpolation;
  inTangent?: number;
  outTangent?: number;
}

export interface VectorKeyframe {
  id: KeyframeId;
  time: number;
  value: Vec3Tuple;
  interpolation: KeyInterpolation;
  inTangent?: Vec3Tuple;
  outTangent?: Vec3Tuple;
}

export interface QuaternionKeyframe {
  id: KeyframeId;
  time: number;
  value: QuaternionTuple;
  interpolation: KeyInterpolation;
}

interface TrackBase {
  id: TrackId;
  target: string;
  name?: string;
  enabled?: boolean;
}

export interface PositionTrack extends TrackBase {
  kind: 'position';
  target: JointId;
  keys: VectorKeyframe[];
}

export interface QuaternionTrack extends TrackBase {
  kind: 'quaternion';
  target: JointId;
  keys: QuaternionKeyframe[];
}

export interface ScaleTrack extends TrackBase {
  kind: 'scale';
  target: JointId;
  keys: VectorKeyframe[];
}

export interface ScalarTrack extends TrackBase {
  kind: 'scalar';
  target: ControlId;
  keys: ScalarKeyframe[];
}

export type TransformTrack = PositionTrack | QuaternionTrack | ScaleTrack;
export type AnimationTrack = TransformTrack | ScalarTrack;
export type AnimationKeyframe = ScalarKeyframe | VectorKeyframe | QuaternionKeyframe;

export type ProceduralBlendMode = 'additive' | 'override' | 'multiply';
export type ProceduralCompositionOrder = 'procedural-then-keyed' | 'keyed-then-procedural';

export interface ProceduralVectorTarget {
  kind: 'position' | 'scale';
  target: JointId;
  component: 'x' | 'y' | 'z';
}

export interface ProceduralQuaternionTarget {
  kind: 'quaternion';
  target: JointId;
  /** Output is a signed angle in radians around this local-space unit axis. */
  axis: Vec3Tuple;
}

export interface ProceduralScalarTarget {
  kind: 'scalar';
  target: ControlId;
  /** Used only when no keyed/base scalar value exists. */
  baseValue?: number;
}

export type ProceduralDriverTarget =
  | ProceduralVectorTarget
  | ProceduralQuaternionTarget
  | ProceduralScalarTarget;

interface ProceduralDriverBase {
  schema: typeof PROCEDURAL_DRIVER_SCHEMA;
  version: typeof PROCEDURAL_DRIVER_SCHEMA_VERSION;
  id: string;
  /** Stable evaluation order; ties resolve by ID. */
  order: number;
  name?: string;
  enabled?: boolean;
  target: ProceduralDriverTarget;
  blend: ProceduralBlendMode;
  /** Built-ins are time, normalizedSpeed, gaitPhase, verticalVelocity, grounded, and actionProgress. */
  source: string;
  amplitude: number;
  frequency: number;
  phase: number;
  bias: number;
  seed: number;
  clamp?: [number, number];
}

export interface ProceduralOscillatorDriver extends ProceduralDriverBase {
  type: 'oscillator';
  waveform: 'sine' | 'triangle' | 'saw';
}

export interface ProceduralPulseDriver extends ProceduralDriverBase {
  type: 'pulse';
  dutyCycle: number;
  /** Fraction of a cycle used to soften each pulse edge. */
  smoothing?: number;
}

export interface ProceduralEnvelopeDriver extends ProceduralDriverBase {
  type: 'envelope';
  /** Fractions of a normalized envelope cycle. Remaining time is zero. */
  attack: number;
  hold: number;
  release: number;
  loop: boolean;
}

export interface ProceduralNoiseDriver extends ProceduralDriverBase {
  type: 'noise';
  interpolation: 'step' | 'smooth';
}

export interface ProceduralResponseDriver extends ProceduralDriverBase {
  type: 'response';
  inputRange: [number, number];
  curve: 'step' | 'linear' | 'smoothstep' | 'smootherstep';
  extrapolate?: boolean;
}

/** Extension boundary for deterministic gait, IK, look-at, and spring evaluators. */
export interface ProceduralCustomDriver extends ProceduralDriverBase {
  type: 'custom';
  evaluatorId: string;
  params?: Record<string, JsonValue>;
}

export type ProceduralDriverDefinition =
  | ProceduralOscillatorDriver
  | ProceduralPulseDriver
  | ProceduralEnvelopeDriver
  | ProceduralNoiseDriver
  | ProceduralResponseDriver
  | ProceduralCustomDriver;

export interface ProceduralMotionContext {
  normalizedSpeed: number;
  gaitPhase: number;
  verticalVelocity: number;
  grounded: boolean;
  actionProgress: number;
  /** Game-specific, finite scalar inputs addressed by driver.source. */
  inputs?: Readonly<Record<string, number>>;
}

export interface ClipLoopMetadata {
  mode: 'once' | 'loop' | 'ping-pong';
  seamless: boolean;
}

export interface ClipRange {
  start: number;
  end: number;
}

export interface RootMotionMetadata {
  mode: 'in-place' | 'authored' | 'extract';
  jointId?: JointId;
  axes?: Array<'x' | 'y' | 'z' | 'yaw'>;
}

export interface AnimationMarker {
  id: string;
  time: number;
  name: string;
  color?: string;
}

export interface AnimationContact {
  id: string;
  start: number;
  end: number;
  effector: string;
  mode: 'plant' | 'grip' | 'custom';
  target?: string;
  weight?: number;
  metadata?: Record<string, JsonValue>;
}

export interface AnimationEvent {
  id: string;
  time: number;
  name: string;
  payload?: JsonValue;
}

export interface AnimationClip {
  id: ClipId;
  name: string;
  rigId: string;
  duration: number;
  /** Authored default speed. Runtime speed multipliers are applied on top. */
  playbackSpeed: number;
  loop: ClipLoopMetadata;
  range: ClipRange;
  rootMotion: RootMotionMetadata;
  transformSpace: 'rest-local-delta';
  tracks: AnimationTrack[];
  /** Explicit layer ownership: procedural motion is the base by default. */
  proceduralOrder: ProceduralCompositionOrder;
  proceduralDrivers: ProceduralDriverDefinition[];
  markers: AnimationMarker[];
  contacts: AnimationContact[];
  events: AnimationEvent[];
  tags?: string[];
  metadata?: Record<string, JsonValue>;
}

export interface AnimationSuiteDocument {
  schema: typeof ANIMATION_SUITE_SCHEMA;
  version: typeof ANIMATION_SUITE_SCHEMA_VERSION;
  id: string;
  name: string;
  rigs: RigDefinition[];
  clips: AnimationClip[];
  activeClipId?: ClipId;
  metadata?: Record<string, JsonValue>;
}

/**
 * A sampled pose contains deltas from the immutable rig rest transform:
 * position is additive, quaternion is composed after rest, and scale is
 * multiplicative. This makes repeated application non-cumulative.
 */
export interface JointPoseDelta {
  position?: Vec3Tuple;
  quaternion?: QuaternionTuple;
  scale?: Vec3Tuple;
}

export interface PoseBuffer {
  joints: Record<JointId, JointPoseDelta>;
  scalars: Record<ControlId, number>;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
