import type {
  AnimationClip,
  AnimationTrack,
  JsonValue,
  PoseBuffer,
  ProceduralCompositionOrder,
  ProceduralCustomDriver,
  ProceduralDriverDefinition,
  ProceduralDriverTarget,
  ProceduralMotionContext,
  QuaternionTuple,
  ValidationIssue,
  ValidationResult,
  Vec3Tuple,
} from './types';
import { clipTimeAt, type ClipTimeOptions, sampleClip } from './sampling';

const EPSILON = 1e-10;
const TWO_PI = Math.PI * 2;

export interface ProceduralCustomEvaluatorContext {
  timelineTime: number;
  motion: ProceduralMotionContext;
  sourceValue: number;
  phase: number;
}

/** Custom evaluators must be pure functions of their arguments to remain scrub-safe. */
export type ProceduralCustomEvaluator = (
  driver: ProceduralCustomDriver,
  context: ProceduralCustomEvaluatorContext,
) => number;

export type ProceduralEvaluatorRegistry =
  | ReadonlyMap<string, ProceduralCustomEvaluator>
  | Readonly<Record<string, ProceduralCustomEvaluator>>;

export interface ProceduralSamplingOptions {
  evaluators?: ProceduralEvaluatorRegistry;
}

export function createProceduralMotionContext(
  values: Partial<ProceduralMotionContext> = {},
): ProceduralMotionContext {
  return {
    normalizedSpeed: finite(values.normalizedSpeed ?? 0),
    gaitPhase: finite(values.gaitPhase ?? 0),
    verticalVelocity: finite(values.verticalVelocity ?? 0),
    grounded: values.grounded ?? true,
    actionProgress: finite(values.actionProgress ?? 0),
    inputs: values.inputs ?? {},
  };
}

export interface ProceduralPoseOperation {
  driverId: string;
  target: ProceduralDriverTarget;
  blend: ProceduralDriverDefinition['blend'];
  value: number;
}

export interface ProceduralPoseSample {
  pose: PoseBuffer;
  operations: ProceduralPoseOperation[];
  values: Record<string, number>;
  issues: ValidationIssue[];
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function fract(value: number): number {
  return positiveModulo(value, 1);
}

function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

function smootherstep(value: number): number {
  const x = clamp01(value);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function proceduralInputValue(
  source: string,
  timelineTime: number,
  context: ProceduralMotionContext,
): number {
  if (source === 'time') return finite(timelineTime);
  if (source === 'normalizedSpeed') return finite(context.normalizedSpeed);
  if (source === 'gaitPhase') return finite(context.gaitPhase);
  if (source === 'verticalVelocity') return finite(context.verticalVelocity);
  if (source === 'grounded') return context.grounded ? 1 : 0;
  if (source === 'actionProgress') return finite(context.actionProgress);
  return finite(context.inputs?.[source] ?? 0);
}

function oscillatorSignal(driver: Extract<ProceduralDriverDefinition, { type: 'oscillator' }>, phase: number): number {
  if (driver.waveform === 'triangle') return 1 - 4 * Math.abs(fract(phase) - 0.5);
  if (driver.waveform === 'saw') return fract(phase) * 2 - 1;
  return Math.sin(phase * TWO_PI);
}

function pulseSignal(driver: Extract<ProceduralDriverDefinition, { type: 'pulse' }>, phase: number): number {
  const duty = clamp01(driver.dutyCycle);
  const cycle = fract(phase);
  const smoothing = clamp(driver.smoothing ?? 0, 0, Math.min(duty * 0.5, (1 - duty) * 0.5));
  if (smoothing <= EPSILON) return cycle < duty ? 1 : 0;
  const rise = smoothstep(cycle / smoothing);
  const fall = 1 - smoothstep((cycle - (duty - smoothing)) / smoothing);
  return Math.min(rise, fall);
}

function envelopeSignal(driver: Extract<ProceduralDriverDefinition, { type: 'envelope' }>, phase: number): number {
  const cycle = driver.loop ? fract(phase) : clamp01(phase);
  const attack = Math.max(0, driver.attack);
  const hold = Math.max(0, driver.hold);
  const release = Math.max(0, driver.release);
  if (cycle < attack) return attack <= EPSILON ? 1 : cycle / attack;
  if (cycle < attack + hold) return 1;
  if (cycle < attack + hold + release) {
    return release <= EPSILON ? 0 : 1 - (cycle - attack - hold) / release;
  }
  return 0;
}

function hashNoise(index: number, seed: number): number {
  let value = (index | 0) ^ Math.imul(seed | 0, 0x9e3779b1);
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff * 2 - 1;
}

function noiseSignal(driver: Extract<ProceduralDriverDefinition, { type: 'noise' }>, phase: number): number {
  const lower = Math.floor(phase);
  const from = hashNoise(lower, driver.seed);
  if (driver.interpolation === 'step') return from;
  const to = hashNoise(lower + 1, driver.seed);
  const alpha = smootherstep(phase - lower);
  return from + (to - from) * alpha;
}

function responseSignal(driver: Extract<ProceduralDriverDefinition, { type: 'response' }>, input: number): number {
  const span = driver.inputRange[1] - driver.inputRange[0];
  let normalized = Math.abs(span) <= EPSILON ? 0 : (input - driver.inputRange[0]) / span;
  if (!driver.extrapolate || driver.curve !== 'linear') normalized = clamp01(normalized);
  if (driver.curve === 'step') return normalized >= 0.5 ? 1 : 0;
  if (driver.curve === 'smoothstep') return smoothstep(normalized);
  if (driver.curve === 'smootherstep') return smootherstep(normalized);
  return normalized;
}

function registryEvaluator(
  registry: ProceduralEvaluatorRegistry | undefined,
  id: string,
): ProceduralCustomEvaluator | undefined {
  if (!registry) return undefined;
  const possibleMap = registry as ReadonlyMap<string, ProceduralCustomEvaluator>;
  if (typeof possibleMap.get === 'function') return possibleMap.get(id);
  return (registry as Readonly<Record<string, ProceduralCustomEvaluator>>)[id];
}

function customEvaluatorIssue(driver: ProceduralCustomDriver, message: string): ValidationIssue {
  return {
    path: `proceduralDrivers.${driver.id}`,
    code: 'procedural.custom-evaluator',
    message,
    severity: 'warning',
  };
}

export interface ProceduralDriverValueResult {
  value?: number;
  issue?: ValidationIssue;
}

export function sampleProceduralDriverValue(
  driver: ProceduralDriverDefinition,
  timelineTime: number,
  context: ProceduralMotionContext,
  options: ProceduralSamplingOptions = {},
): ProceduralDriverValueResult {
  if (driver.enabled === false) return {};
  const sourceValue = proceduralInputValue(driver.source, timelineTime, context);
  const phase = sourceValue * finite(driver.frequency, 1) + finite(driver.phase);
  let signal: number;
  if (driver.type === 'oscillator') signal = oscillatorSignal(driver, phase);
  else if (driver.type === 'pulse') signal = pulseSignal(driver, phase);
  else if (driver.type === 'envelope') signal = envelopeSignal(driver, phase);
  else if (driver.type === 'noise') signal = noiseSignal(driver, phase);
  else if (driver.type === 'response') signal = responseSignal(driver, phase);
  else {
    const evaluator = registryEvaluator(options.evaluators, driver.evaluatorId);
    if (!evaluator) {
      return { issue: customEvaluatorIssue(driver, `custom evaluator "${driver.evaluatorId}" is not registered; driver skipped`) };
    }
    try {
      signal = evaluator(driver, { timelineTime, motion: context, sourceValue, phase });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { issue: customEvaluatorIssue(driver, `custom evaluator "${driver.evaluatorId}" failed: ${detail}`) };
    }
    if (!Number.isFinite(signal)) {
      return { issue: customEvaluatorIssue(driver, `custom evaluator "${driver.evaluatorId}" returned a non-finite value`) };
    }
  }
  let value = finite(driver.bias) + finite(driver.amplitude, 1) * signal;
  if (driver.clamp) value = clamp(value, driver.clamp[0], driver.clamp[1]);
  return { value };
}

function numericBlend(current: number, value: number, blend: ProceduralDriverDefinition['blend']): number {
  if (blend === 'override') return value;
  if (blend === 'multiply') return current * value;
  return current + value;
}

function normalizeAxis(value: Vec3Tuple): Vec3Tuple | null {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= EPSILON) return null;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function normalizeQuaternion(value: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length <= EPSILON) return [0, 0, 0, 1];
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

function multiplyQuaternion(a: QuaternionTuple, b: QuaternionTuple): QuaternionTuple {
  return normalizeQuaternion([
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]);
}

function inverseQuaternion(value: QuaternionTuple): QuaternionTuple {
  const q = normalizeQuaternion(value);
  return [-q[0], -q[1], -q[2], q[3]];
}

function axisAngleQuaternion(axis: Vec3Tuple, angle: number): QuaternionTuple {
  const half = angle * 0.5;
  const sine = Math.sin(half);
  return normalizeQuaternion([axis[0] * sine, axis[1] * sine, axis[2] * sine, Math.cos(half)]);
}

function twistDecomposition(
  value: QuaternionTuple,
  axis: Vec3Tuple,
): { swing: QuaternionTuple; angle: number } {
  const q = normalizeQuaternion(value);
  const projection = q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2];
  let twist = normalizeQuaternion([
    axis[0] * projection,
    axis[1] * projection,
    axis[2] * projection,
    q[3],
  ]);
  if (twist[3] < 0) twist = [-twist[0], -twist[1], -twist[2], -twist[3]];
  const signedSine = twist[0] * axis[0] + twist[1] * axis[1] + twist[2] * axis[2];
  const angle = 2 * Math.atan2(signedSine, twist[3]);
  return { swing: multiplyQuaternion(q, inverseQuaternion(twist)), angle };
}

function applyQuaternionOperation(
  current: QuaternionTuple,
  axisValue: Vec3Tuple,
  value: number,
  blend: ProceduralDriverDefinition['blend'],
): QuaternionTuple {
  const axis = normalizeAxis(axisValue);
  if (!axis) return current;
  if (blend === 'additive') return multiplyQuaternion(current, axisAngleQuaternion(axis, value));
  const { swing, angle } = twistDecomposition(current, axis);
  const targetAngle = blend === 'multiply' ? angle * value : value;
  return multiplyQuaternion(swing, axisAngleQuaternion(axis, targetAngle));
}

function clonePose(pose: PoseBuffer): PoseBuffer {
  const result: PoseBuffer = { joints: {}, scalars: { ...pose.scalars } };
  for (const [jointId, joint] of Object.entries(pose.joints)) {
    result.joints[jointId] = {
      ...(joint.position ? { position: [...joint.position] as Vec3Tuple } : {}),
      ...(joint.quaternion ? { quaternion: [...joint.quaternion] as QuaternionTuple } : {}),
      ...(joint.scale ? { scale: [...joint.scale] as Vec3Tuple } : {}),
    };
  }
  return result;
}

function componentIndex(component: 'x' | 'y' | 'z'): 0 | 1 | 2 {
  return component === 'x' ? 0 : component === 'y' ? 1 : 2;
}

export function applyProceduralOperation(pose: PoseBuffer, operation: ProceduralPoseOperation): void {
  const { target, value, blend } = operation;
  if (target.kind === 'scalar') {
    const fallback = target.baseValue ?? (blend === 'multiply' ? 1 : 0);
    pose.scalars[target.target] = numericBlend(pose.scalars[target.target] ?? fallback, value, blend);
    return;
  }
  const joint = pose.joints[target.target] ?? {};
  if (target.kind === 'quaternion') {
    joint.quaternion = applyQuaternionOperation(
      joint.quaternion ?? [0, 0, 0, 1],
      target.axis,
      value,
      blend,
    );
  } else {
    const identity: Vec3Tuple = target.kind === 'scale' ? [1, 1, 1] : [0, 0, 0];
    const current = [...(joint[target.kind] ?? identity)] as Vec3Tuple;
    const index = componentIndex(target.component);
    current[index] = numericBlend(current[index], value, blend);
    joint[target.kind] = current;
  }
  pose.joints[target.target] = joint;
}

export function sampleProceduralDrivers(
  drivers: ProceduralDriverDefinition[],
  timelineTime: number,
  context: ProceduralMotionContext,
  options: ProceduralSamplingOptions = {},
): ProceduralPoseSample {
  const pose: PoseBuffer = { joints: {}, scalars: {} };
  const operations: ProceduralPoseOperation[] = [];
  const values: Record<string, number> = {};
  const issues: ValidationIssue[] = [];
  const ordered = [...drivers].sort((a, b) => a.order - b.order || compareText(a.id, b.id));
  for (const driver of ordered) {
    const result = sampleProceduralDriverValue(driver, timelineTime, context, options);
    if (result.issue) issues.push(result.issue);
    if (result.value === undefined) continue;
    values[driver.id] = result.value;
    const operation: ProceduralPoseOperation = {
      driverId: driver.id,
      target: driver.target,
      blend: driver.blend,
      value: result.value,
    };
    operations.push(operation);
    applyProceduralOperation(pose, operation);
  }
  return { pose, operations, values, issues };
}

export function sampleProceduralPose(
  clip: AnimationClip,
  timelineTime: number,
  context: ProceduralMotionContext,
  options: ProceduralSamplingOptions = {},
): PoseBuffer {
  return sampleProceduralDrivers(clip.proceduralDrivers, timelineTime, context, options).pose;
}

function overlayKeyedCorrections(procedural: PoseBuffer, keyed: PoseBuffer): PoseBuffer {
  const result = clonePose(procedural);
  for (const [jointId, correction] of Object.entries(keyed.joints)) {
    const base = result.joints[jointId] ?? {};
    if (correction.position) {
      const current = base.position ?? [0, 0, 0];
      base.position = [
        current[0] + correction.position[0],
        current[1] + correction.position[1],
        current[2] + correction.position[2],
      ];
    }
    if (correction.quaternion) {
      base.quaternion = multiplyQuaternion(base.quaternion ?? [0, 0, 0, 1], correction.quaternion);
    }
    if (correction.scale) {
      const current = base.scale ?? [1, 1, 1];
      base.scale = [
        current[0] * correction.scale[0],
        current[1] * correction.scale[1],
        current[2] * correction.scale[2],
      ];
    }
    result.joints[jointId] = base;
  }
  for (const [controlId, value] of Object.entries(keyed.scalars)) result.scalars[controlId] = value;
  return result;
}

export function composeProceduralPose(
  keyedPose: PoseBuffer,
  proceduralSample: ProceduralPoseSample,
  order: ProceduralCompositionOrder = 'procedural-then-keyed',
): PoseBuffer {
  if (order === 'procedural-then-keyed') {
    return overlayKeyedCorrections(proceduralSample.pose, keyedPose);
  }
  const result = clonePose(keyedPose);
  for (const operation of proceduralSample.operations) applyProceduralOperation(result, operation);
  return result;
}

export interface SampleComposedClipOptions extends ProceduralSamplingOptions {
  order?: ProceduralCompositionOrder;
}

export function sampleComposedClip(
  clip: AnimationClip,
  timelineTime: number,
  context: ProceduralMotionContext,
  options: SampleComposedClipOptions = {},
): PoseBuffer {
  const keyed = sampleClip(clip, timelineTime);
  const procedural = sampleProceduralDrivers(clip.proceduralDrivers, timelineTime, context, options);
  return composeProceduralPose(keyed, procedural, options.order ?? clip.proceduralOrder);
}

export interface SampleComposedClipAtElapsedOptions extends ClipTimeOptions, SampleComposedClipOptions {}

export function sampleComposedClipAtElapsed(
  clip: AnimationClip,
  elapsedSeconds: number,
  context: ProceduralMotionContext,
  options: SampleComposedClipAtElapsedOptions = {},
): PoseBuffer {
  return sampleComposedClip(clip, clipTimeAt(clip, elapsedSeconds, options), context, options);
}

export function validateProceduralEvaluators(
  clip: AnimationClip,
  evaluators?: ProceduralEvaluatorRegistry,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  clip.proceduralDrivers.forEach((driver, index) => {
    if (driver.type !== 'custom') return;
    if (!registryEvaluator(evaluators, driver.evaluatorId)) {
      issues.push({
        path: `$.proceduralDrivers[${index}].evaluatorId`,
        code: 'procedural.custom-evaluator-missing',
        message: `custom evaluator "${driver.evaluatorId}" is not registered; driver will safely no-op`,
        severity: 'warning',
      });
    }
  });
  return { valid: true, issues };
}

export type ProceduralBakeContext =
  | ProceduralMotionContext
  | ((timelineTime: number, normalizedTime: number) => ProceduralMotionContext);

export interface BakeProceduralClipOptions extends ProceduralSamplingOptions {
  fps: number;
  start?: number;
  end?: number;
  context?: ProceduralBakeContext;
  order?: ProceduralCompositionOrder;
  id?: string;
  name?: string;
  /** Omit to bake all drivers. Selected-driver bakes retain unselected drivers. */
  driverIds?: readonly string[];
}

function defaultBakeContext(normalizedTime: number): ProceduralMotionContext {
  return {
    normalizedSpeed: 0,
    gaitPhase: fract(normalizedTime),
    verticalVelocity: 0,
    grounded: true,
    actionProgress: clamp01(normalizedTime),
    inputs: {},
  };
}

function bakeContext(
  source: ProceduralBakeContext | undefined,
  timelineTime: number,
  normalizedTime: number,
): ProceduralMotionContext {
  if (!source) return defaultBakeContext(normalizedTime);
  return typeof source === 'function' ? source(timelineTime, normalizedTime) : source;
}

function bakedTrackId(clipId: string, kind: AnimationTrack['kind'], target: string): string {
  return `${clipId}:baked:${kind}:${target}`;
}

/** Samples the fully composed pose at a fixed rate and removes procedural drivers from the result. */
export function bakeProceduralClip(
  clip: AnimationClip,
  options: BakeProceduralClipOptions,
): AnimationClip {
  if (!Number.isFinite(options.fps) || options.fps <= 0) throw new RangeError('bake fps must be greater than zero');
  const start = options.start ?? clip.range.start;
  const end = options.end ?? clip.range.end;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new RangeError('bake range start must be before end');
  }
  const span = end - start;
  const frameCount = Math.max(1, Math.ceil(span * options.fps));
  const times = Array.from({ length: frameCount + 1 }, (_, index) =>
    index === frameCount ? end : Math.min(end, start + index / options.fps));
  const transformChannels = new Map<string, { kind: 'position' | 'quaternion' | 'scale'; target: string }>();
  const scalarTargets = new Set<string>();
  const selectedIds = options.driverIds ? new Set(options.driverIds) : undefined;
  const selectedDrivers = selectedIds
    ? clip.proceduralDrivers.filter((driver) => selectedIds.has(driver.id))
    : clip.proceduralDrivers;
  const retainedDrivers = selectedIds
    ? clip.proceduralDrivers.filter((driver) => !selectedIds.has(driver.id))
    : [];
  const bakeSource: AnimationClip = { ...clip, proceduralDrivers: selectedDrivers };
  for (const track of clip.tracks) {
    if (track.enabled === false) continue;
    if (track.kind === 'scalar') scalarTargets.add(track.target);
    else transformChannels.set(`${track.kind}:${track.target}`, { kind: track.kind, target: track.target });
  }
  for (const driver of selectedDrivers) {
    if (driver.enabled === false) continue;
    if (driver.target.kind === 'scalar') scalarTargets.add(driver.target.target);
    else transformChannels.set(
      `${driver.target.kind}:${driver.target.target}`,
      { kind: driver.target.kind, target: driver.target.target },
    );
  }
  const samples = times.map((time) => {
    const normalizedTime = (time - start) / span;
    return sampleComposedClip(
      bakeSource,
      time,
      bakeContext(options.context, time, normalizedTime),
      { evaluators: options.evaluators, order: options.order },
    );
  });
  const outputId = options.id ?? `${clip.id}.baked`;
  const tracks: AnimationTrack[] = [];
  for (const { kind, target } of [...transformChannels.values()].sort((a, b) =>
    compareText(a.target, b.target) || compareText(a.kind, b.kind))) {
    const id = bakedTrackId(outputId, kind, target);
    if (kind === 'quaternion') {
      tracks.push({
        id,
        kind,
        target,
        keys: samples.map((pose, index) => ({
          id: `${id}:key-${index}`,
          time: times[index],
          value: [...(pose.joints[target]?.quaternion ?? [0, 0, 0, 1])] as QuaternionTuple,
          interpolation: 'linear',
        })),
      });
    } else {
      const identity: Vec3Tuple = kind === 'scale' ? [1, 1, 1] : [0, 0, 0];
      tracks.push({
        id,
        kind,
        target,
        keys: samples.map((pose, index) => ({
          id: `${id}:key-${index}`,
          time: times[index],
          value: [...(pose.joints[target]?.[kind] ?? identity)] as Vec3Tuple,
          interpolation: 'linear',
        })),
      });
    }
  }
  for (const target of [...scalarTargets].sort(compareText)) {
    const id = bakedTrackId(outputId, 'scalar', target);
    tracks.push({
      id,
      kind: 'scalar',
      target,
      keys: samples.map((pose, index) => ({
        id: `${id}:key-${index}`,
        time: times[index],
        value: pose.scalars[target] ?? 0,
        interpolation: 'linear',
      })),
    });
  }
  const bakeMetadata: Record<string, JsonValue> = {
    sourceClipId: clip.id,
    fps: options.fps,
    start,
    end,
    compositionOrder: options.order ?? clip.proceduralOrder,
    driverIds: selectedDrivers.map((driver) => driver.id),
  };
  return {
    ...clip,
    id: outputId,
    name: options.name ?? `${clip.name} (Baked)`,
    range: { start, end },
    tracks,
    proceduralOrder: 'procedural-then-keyed',
    proceduralDrivers: retainedDrivers,
    tags: [...new Set([...(clip.tags ?? []), 'procedural-bake'])],
    metadata: { ...(clip.metadata ?? {}), proceduralBake: bakeMetadata },
  };
}
