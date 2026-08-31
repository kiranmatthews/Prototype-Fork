import type {
  AnimationClip,
  AnimationContact,
  AnimationEvent,
  AnimationMarker,
  AnimationSuiteDocument,
  AnimationTrack,
  JsonValue,
  LocalTransform,
  QuaternionKeyframe,
  QuaternionTuple,
  ProceduralDriverDefinition,
  ProceduralDriverTarget,
  RigDefinition,
  RigJointDefinition,
  ScalarKeyframe,
  Vec3Tuple,
  VectorKeyframe,
} from './types';

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function finiteNumber(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function vector(value: Vec3Tuple): Vec3Tuple {
  return [finiteNumber(value[0]), finiteNumber(value[1]), finiteNumber(value[2])];
}

function quaternion(value: QuaternionTuple, reference?: QuaternionTuple): QuaternionTuple {
  const length = Math.hypot(value[0], value[1], value[2], value[3]);
  let result: QuaternionTuple = length > 1e-12
    ? [value[0] / length, value[1] / length, value[2] / length, value[3] / length]
    : [0, 0, 0, 1];
  const dot = reference
    ? result[0] * reference[0] + result[1] * reference[1] + result[2] * reference[2] + result[3] * reference[3]
    : result[3];
  if (dot < 0) result = [-result[0], -result[1], -result[2], -result[3]];
  return result.map(finiteNumber) as QuaternionTuple;
}

function localTransform(value: LocalTransform): LocalTransform {
  return {
    position: vector(value.position),
    quaternion: quaternion(value.quaternion),
    scale: vector(value.scale),
  };
}

export function canonicalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort(compareText)) result[key] = canonicalizeJson(value[key]);
    return result;
  }
  return typeof value === 'number' ? finiteNumber(value) : value;
}

function normalizeJoint(joint: RigJointDefinition): RigJointDefinition {
  return {
    id: joint.id,
    nodeName: joint.nodeName,
    ...(joint.name === undefined ? {} : { name: joint.name }),
    parentId: joint.parentId,
    rest: localTransform(joint.rest),
    ...(joint.mirrorId === undefined ? {} : { mirrorId: joint.mirrorId }),
    ...(joint.tags === undefined ? {} : { tags: [...joint.tags].sort(compareText) }),
    ...(joint.stretch === undefined ? {} : {
      stretch: {
        ...joint.stretch,
        lengthAxis: vector(joint.stretch.lengthAxis),
        ...(joint.stretch.childIds === undefined
          ? {}
          : { childIds: [...joint.stretch.childIds].sort(compareText) }),
      },
    }),
  };
}

function normalizeRig(rig: RigDefinition): RigDefinition {
  return {
    schema: rig.schema,
    version: rig.version,
    id: rig.id,
    name: rig.name,
    rootJointId: rig.rootJointId,
    coordinateSystem: {
      ...rig.coordinateSystem,
      ...(rig.coordinateSystem.visualScale
        ? { visualScale: vector(rig.coordinateSystem.visualScale) }
        : {}),
    },
    joints: rig.joints.map(normalizeJoint).sort((a, b) => compareText(a.id, b.id)),
    sockets: rig.sockets.map((socket) => ({
      ...socket,
      ...(socket.tags ? { tags: [...socket.tags].sort(compareText) } : {}),
    })).sort((a, b) => compareText(a.id, b.id)),
    controls: rig.controls.map((control) => ({ ...control })).sort((a, b) => compareText(a.id, b.id)),
    ...(rig.mirror ? {
      mirror: {
        axis: rig.mirror.axis,
        jointPairs: rig.mirror.jointPairs
          .map(([a, b]) => compareText(a, b) <= 0 ? [a, b] as [string, string] : [b, a] as [string, string])
          .sort((a, b) => compareText(a[0], b[0]) || compareText(a[1], b[1])),
        ...(rig.mirror.controlPairs ? {
          controlPairs: rig.mirror.controlPairs
            .map(([a, b]) => compareText(a, b) <= 0 ? [a, b] as [string, string] : [b, a] as [string, string])
            .sort((a, b) => compareText(a[0], b[0]) || compareText(a[1], b[1])),
        } : {}),
      },
    } : {}),
    ...(rig.metadata ? { metadata: canonicalizeJson(rig.metadata) as Record<string, JsonValue> } : {}),
  };
}

function normalizeScalarKeys(keys: ScalarKeyframe[]): ScalarKeyframe[] {
  return keys.map((key) => ({
    ...key,
    time: finiteNumber(key.time),
    value: finiteNumber(key.value),
    ...(key.inTangent === undefined ? {} : { inTangent: finiteNumber(key.inTangent) }),
    ...(key.outTangent === undefined ? {} : { outTangent: finiteNumber(key.outTangent) }),
  })).sort((a, b) => a.time - b.time || compareText(a.id, b.id));
}

function normalizeVectorKeys(keys: VectorKeyframe[]): VectorKeyframe[] {
  return keys.map((key) => ({
    ...key,
    time: finiteNumber(key.time),
    value: vector(key.value),
    ...(key.inTangent === undefined ? {} : { inTangent: vector(key.inTangent) }),
    ...(key.outTangent === undefined ? {} : { outTangent: vector(key.outTangent) }),
  })).sort((a, b) => a.time - b.time || compareText(a.id, b.id));
}

function normalizeQuaternionKeys(keys: QuaternionKeyframe[]): QuaternionKeyframe[] {
  const sorted = [...keys].sort((a, b) => a.time - b.time || compareText(a.id, b.id));
  let previous: QuaternionTuple | undefined;
  return sorted.map((key) => {
    const value = quaternion(key.value, previous);
    previous = value;
    return { ...key, time: finiteNumber(key.time), value };
  });
}

function normalizeTrack(track: AnimationTrack): AnimationTrack {
  if (track.kind === 'scalar') return { ...track, keys: normalizeScalarKeys(track.keys) };
  if (track.kind === 'quaternion') return { ...track, keys: normalizeQuaternionKeys(track.keys) };
  return { ...track, keys: normalizeVectorKeys(track.keys) };
}

function normalizeProceduralTarget(target: ProceduralDriverTarget): ProceduralDriverTarget {
  if (target.kind === 'quaternion') return { ...target, axis: vector(target.axis) };
  if (target.kind === 'scalar') {
    return {
      ...target,
      ...(target.baseValue === undefined ? {} : { baseValue: finiteNumber(target.baseValue) }),
    };
  }
  return { ...target };
}

function normalizeProceduralDriver(driver: ProceduralDriverDefinition): ProceduralDriverDefinition {
  const common = {
    ...driver,
    order: finiteNumber(driver.order),
    target: normalizeProceduralTarget(driver.target),
    amplitude: finiteNumber(driver.amplitude),
    frequency: finiteNumber(driver.frequency),
    phase: finiteNumber(driver.phase),
    bias: finiteNumber(driver.bias),
    seed: finiteNumber(driver.seed),
    ...(driver.clamp
      ? { clamp: [finiteNumber(driver.clamp[0]), finiteNumber(driver.clamp[1])] as [number, number] }
      : {}),
  };
  if (driver.type === 'custom') {
    return {
      ...common,
      type: 'custom',
      evaluatorId: driver.evaluatorId,
      ...(driver.params ? { params: canonicalizeJson(driver.params) as Record<string, JsonValue> } : {}),
    };
  }
  return common;
}

function timedIdSort<T extends { time: number; id: string }>(values: T[]): T[] {
  return [...values].sort((a, b) => a.time - b.time || compareText(a.id, b.id));
}

function normalizeMarker(marker: AnimationMarker): AnimationMarker {
  return { ...marker, time: finiteNumber(marker.time) };
}

function normalizeContact(contact: AnimationContact): AnimationContact {
  return {
    ...contact,
    start: finiteNumber(contact.start),
    end: finiteNumber(contact.end),
    ...(contact.weight === undefined ? {} : { weight: finiteNumber(contact.weight) }),
    ...(contact.metadata ? { metadata: canonicalizeJson(contact.metadata) as Record<string, JsonValue> } : {}),
  };
}

function normalizeEvent(event: AnimationEvent): AnimationEvent {
  return {
    ...event,
    time: finiteNumber(event.time),
    ...(event.payload === undefined ? {} : { payload: canonicalizeJson(event.payload) }),
  };
}

function normalizeClip(clip: AnimationClip): AnimationClip {
  return {
    id: clip.id,
    name: clip.name,
    rigId: clip.rigId,
    duration: finiteNumber(clip.duration),
    playbackSpeed: finiteNumber(clip.playbackSpeed),
    loop: { ...clip.loop },
    range: { start: finiteNumber(clip.range.start), end: finiteNumber(clip.range.end) },
    rootMotion: {
      ...clip.rootMotion,
      ...(clip.rootMotion.axes ? {
        axes: [...clip.rootMotion.axes].sort(
          (a, b) => ['x', 'y', 'z', 'yaw'].indexOf(a) - ['x', 'y', 'z', 'yaw'].indexOf(b),
        ),
      } : {}),
    },
    transformSpace: clip.transformSpace,
    tracks: clip.tracks.map(normalizeTrack).sort((a, b) =>
      compareText(a.target, b.target) || compareText(a.kind, b.kind) || compareText(a.id, b.id)),
    proceduralOrder: clip.proceduralOrder,
    proceduralDrivers: clip.proceduralDrivers.map(normalizeProceduralDriver)
      .sort((a, b) => a.order - b.order || compareText(a.id, b.id)),
    markers: timedIdSort(clip.markers.map(normalizeMarker)),
    contacts: [...clip.contacts].map(normalizeContact)
      .sort((a, b) => a.start - b.start || a.end - b.end || compareText(a.id, b.id)),
    events: timedIdSort(clip.events.map(normalizeEvent)),
    ...(clip.tags ? { tags: [...clip.tags].sort(compareText) } : {}),
    ...(clip.metadata ? { metadata: canonicalizeJson(clip.metadata) as Record<string, JsonValue> } : {}),
  };
}

export function normalizeAnimationSuite(document: AnimationSuiteDocument): AnimationSuiteDocument {
  return {
    schema: document.schema,
    version: document.version,
    id: document.id,
    name: document.name,
    rigs: document.rigs.map(normalizeRig).sort((a, b) => compareText(a.id, b.id)),
    clips: document.clips.map(normalizeClip).sort((a, b) => compareText(a.id, b.id)),
    ...(document.activeClipId === undefined ? {} : { activeClipId: document.activeClipId }),
    ...(document.metadata
      ? { metadata: canonicalizeJson(document.metadata) as Record<string, JsonValue> }
      : {}),
  };
}

export function stringifyAnimationSuite(document: AnimationSuiteDocument, space = 2): string {
  const normalized = normalizeAnimationSuite(document);
  const canonical = canonicalizeJson(normalized as unknown as JsonValue);
  return `${JSON.stringify(canonical, null, space)}\n`;
}
