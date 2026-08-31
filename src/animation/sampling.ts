import type {
  AnimationClip,
  AnimationTrack,
  PoseBuffer,
  QuaternionKeyframe,
  QuaternionTuple,
  ScalarKeyframe,
  Vec3Tuple,
  VectorKeyframe,
} from './types';

const EPSILON = 1e-9;

export function createPoseBuffer(): PoseBuffer {
  return { joints: {}, scalars: {} };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

export interface ClipTimeOptions {
  /** A live multiplier layered over the authored per-clip playbackSpeed. */
  runtimeSpeed?: number;
  /** Time within the source range at elapsedSeconds=0. */
  offset?: number;
}

/** Converts elapsed playback time to an authored timeline time. */
export function clipTimeAt(
  clip: AnimationClip,
  elapsedSeconds: number,
  options: ClipTimeOptions = {},
): number {
  const start = clip.range.start;
  const end = clip.range.end;
  const span = Math.max(0, end - start);
  if (span <= EPSILON) return start;
  const speed = clip.playbackSpeed * (options.runtimeSpeed ?? 1);
  const relative = (options.offset ?? 0) + elapsedSeconds * speed;
  if (clip.loop.mode === 'once') return start + Math.min(span, Math.max(0, relative));
  if (clip.loop.mode === 'ping-pong') {
    const phase = positiveModulo(relative, span * 2);
    return start + (phase <= span ? phase : span * 2 - phase);
  }
  return start + positiveModulo(relative, span);
}

function sortedKeys<T extends { time: number; id: string }>(keys: T[]): T[] {
  return [...keys].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

interface KeySegment<T extends { time: number; id: string }> {
  keys: T[];
  leftIndex: number;
  rightIndex: number;
  alpha: number;
}

function keySegment<T extends { time: number; id: string }>(source: T[], time: number): KeySegment<T> | null {
  if (source.length === 0) return null;
  const keys = sortedKeys(source);
  if (time <= keys[0].time) return { keys, leftIndex: 0, rightIndex: 0, alpha: 0 };
  const lastIndex = keys.length - 1;
  if (time >= keys[lastIndex].time) {
    return { keys, leftIndex: lastIndex, rightIndex: lastIndex, alpha: 0 };
  }
  let rightIndex = 1;
  while (rightIndex < keys.length && keys[rightIndex].time <= time) rightIndex += 1;
  const leftIndex = rightIndex - 1;
  const duration = keys[rightIndex].time - keys[leftIndex].time;
  return {
    keys,
    leftIndex,
    rightIndex,
    alpha: duration <= EPSILON ? 0 : clamp01((time - keys[leftIndex].time) / duration),
  };
}

function automaticScalarTangent(keys: ScalarKeyframe[], index: number): number {
  const previous = keys[Math.max(0, index - 1)];
  const next = keys[Math.min(keys.length - 1, index + 1)];
  const duration = next.time - previous.time;
  return duration <= EPSILON ? 0 : (next.value - previous.value) / duration;
}

function hermite(a: number, b: number, tangentA: number, tangentB: number, alpha: number, duration: number): number {
  const t2 = alpha * alpha;
  const t3 = t2 * alpha;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + alpha;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * a + h10 * tangentA * duration + h01 * b + h11 * tangentB * duration;
}

export function sampleScalarKeys(keys: ScalarKeyframe[], time: number): number | undefined {
  const segment = keySegment(keys, time);
  if (!segment) return undefined;
  const { leftIndex, rightIndex, alpha } = segment;
  const left = segment.keys[leftIndex];
  const right = segment.keys[rightIndex];
  if (leftIndex === rightIndex || left.interpolation === 'step') return left.value;
  if (left.interpolation === 'linear') return left.value + (right.value - left.value) * alpha;
  const duration = right.time - left.time;
  const tangentA = left.outTangent ?? automaticScalarTangent(segment.keys, leftIndex);
  const tangentB = right.inTangent ?? automaticScalarTangent(segment.keys, rightIndex);
  return hermite(left.value, right.value, tangentA, tangentB, alpha, duration);
}

function automaticVectorTangent(keys: VectorKeyframe[], index: number): Vec3Tuple {
  const previous = keys[Math.max(0, index - 1)];
  const next = keys[Math.min(keys.length - 1, index + 1)];
  const duration = next.time - previous.time;
  if (duration <= EPSILON) return [0, 0, 0];
  return [
    (next.value[0] - previous.value[0]) / duration,
    (next.value[1] - previous.value[1]) / duration,
    (next.value[2] - previous.value[2]) / duration,
  ];
}

export function sampleVectorKeys(keys: VectorKeyframe[], time: number): Vec3Tuple | undefined {
  const segment = keySegment(keys, time);
  if (!segment) return undefined;
  const { leftIndex, rightIndex, alpha } = segment;
  const left = segment.keys[leftIndex];
  const right = segment.keys[rightIndex];
  if (leftIndex === rightIndex || left.interpolation === 'step') return [...left.value];
  if (left.interpolation === 'linear') {
    return [
      left.value[0] + (right.value[0] - left.value[0]) * alpha,
      left.value[1] + (right.value[1] - left.value[1]) * alpha,
      left.value[2] + (right.value[2] - left.value[2]) * alpha,
    ];
  }
  const duration = right.time - left.time;
  const tangentA = left.outTangent ?? automaticVectorTangent(segment.keys, leftIndex);
  const tangentB = right.inTangent ?? automaticVectorTangent(segment.keys, rightIndex);
  return [
    hermite(left.value[0], right.value[0], tangentA[0], tangentB[0], alpha, duration),
    hermite(left.value[1], right.value[1], tangentA[1], tangentB[1], alpha, duration),
    hermite(left.value[2], right.value[2], tangentA[2], tangentB[2], alpha, duration),
  ];
}

function quaternionDot(a: QuaternionTuple, b: QuaternionTuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

function normalizeQuaternion(value: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  if (length <= EPSILON) return [0, 0, 0, 1];
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}

function negateQuaternion(value: QuaternionTuple): QuaternionTuple {
  return [-value[0], -value[1], -value[2], -value[3]];
}

function alignedQuaternion(reference: QuaternionTuple, value: QuaternionTuple): QuaternionTuple {
  const normalized = normalizeQuaternion(value);
  return quaternionDot(reference, normalized) < 0 ? negateQuaternion(normalized) : normalized;
}

export function slerpQuaternionHemisphereSafe(
  fromValue: QuaternionTuple,
  toValue: QuaternionTuple,
  alpha: number,
): QuaternionTuple {
  const from = normalizeQuaternion(fromValue);
  const to = alignedQuaternion(from, toValue);
  const dot = Math.min(1, Math.max(-1, quaternionDot(from, to)));
  if (dot > 0.9995) {
    return normalizeQuaternion([
      from[0] + (to[0] - from[0]) * alpha,
      from[1] + (to[1] - from[1]) * alpha,
      from[2] + (to[2] - from[2]) * alpha,
      from[3] + (to[3] - from[3]) * alpha,
    ]);
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const a = Math.sin((1 - alpha) * theta) / sinTheta;
  const b = Math.sin(alpha * theta) / sinTheta;
  return normalizeQuaternion([
    from[0] * a + to[0] * b,
    from[1] * a + to[1] * b,
    from[2] * a + to[2] * b,
    from[3] * a + to[3] * b,
  ]);
}

function multiplyQuaternions(a: QuaternionTuple, b: QuaternionTuple): QuaternionTuple {
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

function quaternionLog(value: QuaternionTuple): Vec3Tuple {
  const q = normalizeQuaternion(value);
  const vectorLength = Math.hypot(q[0], q[1], q[2]);
  if (vectorLength <= EPSILON) return [0, 0, 0];
  const angle = Math.atan2(vectorLength, Math.min(1, Math.max(-1, q[3])));
  const scale = angle / vectorLength;
  return [q[0] * scale, q[1] * scale, q[2] * scale];
}

function quaternionExp(value: Vec3Tuple): QuaternionTuple {
  const angle = Math.hypot(value[0], value[1], value[2]);
  if (angle <= EPSILON) return [0, 0, 0, 1];
  const scale = Math.sin(angle) / angle;
  return normalizeQuaternion([value[0] * scale, value[1] * scale, value[2] * scale, Math.cos(angle)]);
}

function quaternionControl(
  previousValue: QuaternionTuple,
  value: QuaternionTuple,
  nextValue: QuaternionTuple,
): QuaternionTuple {
  const current = normalizeQuaternion(value);
  const previous = alignedQuaternion(current, previousValue);
  const next = alignedQuaternion(current, nextValue);
  const inverse = inverseQuaternion(current);
  const before = quaternionLog(multiplyQuaternions(inverse, previous));
  const after = quaternionLog(multiplyQuaternions(inverse, next));
  return multiplyQuaternions(current, quaternionExp([
    -(before[0] + after[0]) * 0.25,
    -(before[1] + after[1]) * 0.25,
    -(before[2] + after[2]) * 0.25,
  ]));
}

function squadQuaternion(
  previous: QuaternionTuple,
  from: QuaternionTuple,
  to: QuaternionTuple,
  next: QuaternionTuple,
  alpha: number,
): QuaternionTuple {
  const controlFrom = quaternionControl(previous, from, to);
  const controlTo = quaternionControl(from, to, next);
  const direct = slerpQuaternionHemisphereSafe(from, to, alpha);
  const controls = slerpQuaternionHemisphereSafe(controlFrom, controlTo, alpha);
  return slerpQuaternionHemisphereSafe(direct, controls, 2 * alpha * (1 - alpha));
}

export function sampleQuaternionKeys(
  keys: QuaternionKeyframe[],
  time: number,
): QuaternionTuple | undefined {
  const segment = keySegment(keys, time);
  if (!segment) return undefined;
  const { leftIndex, rightIndex, alpha } = segment;
  const left = segment.keys[leftIndex];
  const right = segment.keys[rightIndex];
  if (leftIndex === rightIndex || left.interpolation === 'step') return normalizeQuaternion(left.value);
  if (left.interpolation === 'linear') {
    return slerpQuaternionHemisphereSafe(left.value, right.value, alpha);
  }
  const previous = segment.keys[Math.max(0, leftIndex - 1)].value;
  const next = segment.keys[Math.min(segment.keys.length - 1, rightIndex + 1)].value;
  return squadQuaternion(previous, left.value, right.value, next, alpha);
}

function sampleTrack(track: AnimationTrack, time: number, pose: PoseBuffer): void {
  if (track.enabled === false) return;
  if (track.kind === 'scalar') {
    const value = sampleScalarKeys(track.keys, time);
    if (value !== undefined) pose.scalars[track.target] = value;
    return;
  }
  const joint = pose.joints[track.target] ?? {};
  if (track.kind === 'position') {
    const value = sampleVectorKeys(track.keys, time);
    if (value !== undefined) joint.position = value;
  } else if (track.kind === 'scale') {
    const value = sampleVectorKeys(track.keys, time);
    if (value !== undefined) joint.scale = value;
  } else {
    const value = sampleQuaternionKeys(track.keys, time);
    if (value !== undefined) joint.quaternion = value;
  }
  if (Object.keys(joint).length > 0) pose.joints[track.target] = joint;
}

/** Samples an authored timeline time. Call clipTimeAt for live playback. */
export function sampleClip(clip: AnimationClip, timelineTime: number): PoseBuffer {
  const pose = createPoseBuffer();
  const time = Math.min(clip.range.end, Math.max(clip.range.start, timelineTime));
  for (const track of clip.tracks) sampleTrack(track, time, pose);
  return pose;
}

export function sampleClipAtElapsed(
  clip: AnimationClip,
  elapsedSeconds: number,
  options: ClipTimeOptions = {},
): PoseBuffer {
  return sampleClip(clip, clipTimeAt(clip, elapsedSeconds, options));
}

export function blendPoses(from: PoseBuffer, to: PoseBuffer, weight: number): PoseBuffer {
  const alpha = clamp01(weight);
  const result = createPoseBuffer();
  const jointIds = new Set([...Object.keys(from.joints), ...Object.keys(to.joints)]);
  for (const jointId of jointIds) {
    const a = from.joints[jointId] ?? {};
    const b = to.joints[jointId] ?? {};
    const joint = {} as NonNullable<PoseBuffer['joints'][string]>;
    if (a.position || b.position) {
      const av = a.position ?? [0, 0, 0];
      const bv = b.position ?? [0, 0, 0];
      joint.position = [
        av[0] + (bv[0] - av[0]) * alpha,
        av[1] + (bv[1] - av[1]) * alpha,
        av[2] + (bv[2] - av[2]) * alpha,
      ];
    }
    if (a.quaternion || b.quaternion) {
      joint.quaternion = slerpQuaternionHemisphereSafe(
        a.quaternion ?? [0, 0, 0, 1],
        b.quaternion ?? [0, 0, 0, 1],
        alpha,
      );
    }
    if (a.scale || b.scale) {
      const av = a.scale ?? [1, 1, 1];
      const bv = b.scale ?? [1, 1, 1];
      joint.scale = [
        av[0] + (bv[0] - av[0]) * alpha,
        av[1] + (bv[1] - av[1]) * alpha,
        av[2] + (bv[2] - av[2]) * alpha,
      ];
    }
    result.joints[jointId] = joint;
  }
  const controlIds = new Set([...Object.keys(from.scalars), ...Object.keys(to.scalars)]);
  for (const controlId of controlIds) {
    const a = from.scalars[controlId] ?? 0;
    const b = to.scalars[controlId] ?? 0;
    result.scalars[controlId] = a + (b - a) * alpha;
  }
  return result;
}
