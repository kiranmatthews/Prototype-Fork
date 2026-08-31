import {
  ANIMATION_SUITE_SCHEMA,
  ANIMATION_SUITE_SCHEMA_VERSION,
  HUMANOID_JOINT_ROLES,
  RIG_SCHEMA,
  RIG_SCHEMA_VERSION,
  PROCEDURAL_DRIVER_SCHEMA,
  PROCEDURAL_DRIVER_SCHEMA_VERSION,
  type AnimationClip,
  type AnimationContact,
  type AnimationEvent,
  type AnimationMarker,
  type AnimationSuiteDocument,
  type AnimationTrack,
  type ClipLoopMetadata,
  type JsonValue,
  type HumanoidJointRole,
  type HumanoidSemanticMap,
  type JointStretchPolicy,
  type KeyInterpolation,
  type LocalTransform,
  type RigDefinition,
  type RigJointDefinition,
  type RootMotionMetadata,
  type ProceduralDriverDefinition,
  type ProceduralDriverTarget,
} from './types';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function tuple(value: unknown, length: 2 | 3 | 4, fallback: number[]): number[] {
  if (!Array.isArray(value) || value.length !== length || !value.every((entry) => typeof entry === 'number')) {
    return [...fallback];
  }
  return [...value] as number[];
}

function jsonRecord(value: unknown): Record<string, JsonValue> | undefined {
  return isRecord(value) ? value as Record<string, JsonValue> : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (typeof value === 'string' && value.length > 0) return [value];
  if (!Array.isArray(value)) return undefined;
  const result = [...new Set(value.filter((entry): entry is string =>
    typeof entry === 'string' && entry.length > 0))];
  return result.length > 0 ? result : undefined;
}

function legacyRest(value: unknown): LocalTransform {
  const source = isRecord(value) ? value : {};
  return {
    position: tuple(source.position ?? source.translation, 3, [0, 0, 0]) as [number, number, number],
    quaternion: tuple(source.quaternion ?? source.rotation, 4, [0, 0, 0, 1]) as [number, number, number, number],
    scale: tuple(source.scale, 3, [1, 1, 1]) as [number, number, number],
  };
}

function optionalTransform(value: unknown): LocalTransform | undefined {
  return isRecord(value) ? legacyRest(value) : undefined;
}

function nestedHumanoid(source: UnknownRecord): UnknownRecord {
  return isRecord(source.humanoid) ? source.humanoid : {};
}

function metadataRecord(source: UnknownRecord, flatKey: string, nestedKey: string): UnknownRecord {
  const nested = nestedHumanoid(source);
  const flat = isRecord(source[flatKey]) ? source[flatKey] as UnknownRecord : {};
  const bundled = isRecord(nested[nestedKey])
    ? nested[nestedKey] as UnknownRecord
    : isRecord(nested[flatKey]) ? nested[flatKey] as UnknownRecord : {};
  return { ...flat, ...bundled };
}

function migrateStretch(value: unknown): JointStretchPolicy | undefined {
  if (!isRecord(value)) return undefined;
  const mode = value.mode === 'scale' || value.mode === 'translate-children' ? value.mode : 'none';
  return {
    mode,
    ...(typeof value.controlId === 'string' ? { controlId: value.controlId } : {}),
    lengthAxis: tuple(value.lengthAxis, 3, [0, 1, 0]) as [number, number, number],
    min: number(value.min, 1),
    max: number(value.max, 1),
    ...(typeof value.preserveVolume === 'boolean' ? { preserveVolume: value.preserveVolume } : {}),
    ...(stringArray(value.childIds) ? { childIds: stringArray(value.childIds) } : {}),
  };
}

const HUMANOID_ROLE_ALIASES: Record<HumanoidJointRole, readonly string[]> = {
  root: ['root', 'motionRoot', 'motion-root'],
  hips: ['hips', 'pelvis'],
  spine: ['spine', 'spineLower', 'lowerSpine'],
  chest: ['chest', 'spineUpper', 'upperSpine'],
  neck: ['neck'],
  head: ['head'],
  clavicleLeft: ['clavicleLeft', 'leftClavicle', 'clavicle.left', 'left.clavicle'],
  upperArmLeft: ['upperArmLeft', 'leftUpperArm', 'upperArm.left', 'left.upperArm', 'shoulderLeft'],
  lowerArmLeft: ['lowerArmLeft', 'leftLowerArm', 'lowerArm.left', 'left.lowerArm', 'elbowLeft'],
  handLeft: ['handLeft', 'leftHand', 'hand.left', 'left.hand', 'wristLeft'],
  upperLegLeft: ['upperLegLeft', 'leftUpperLeg', 'upperLeg.left', 'left.upperLeg', 'hipLeft'],
  lowerLegLeft: ['lowerLegLeft', 'leftLowerLeg', 'lowerLeg.left', 'left.lowerLeg', 'kneeLeft'],
  footLeft: ['footLeft', 'leftFoot', 'foot.left', 'left.foot', 'ankleLeft'],
  toesLeft: ['toesLeft', 'leftToes', 'toes.left', 'left.toes', 'toeLeft'],
  clavicleRight: ['clavicleRight', 'rightClavicle', 'clavicle.right', 'right.clavicle'],
  upperArmRight: ['upperArmRight', 'rightUpperArm', 'upperArm.right', 'right.upperArm', 'shoulderRight'],
  lowerArmRight: ['lowerArmRight', 'rightLowerArm', 'lowerArm.right', 'right.lowerArm', 'elbowRight'],
  handRight: ['handRight', 'rightHand', 'hand.right', 'right.hand', 'wristRight'],
  upperLegRight: ['upperLegRight', 'rightUpperLeg', 'upperLeg.right', 'right.upperLeg', 'hipRight'],
  lowerLegRight: ['lowerLegRight', 'rightLowerLeg', 'lowerLeg.right', 'right.lowerLeg', 'kneeRight'],
  footRight: ['footRight', 'rightFoot', 'foot.right', 'right.foot', 'ankleRight'],
  toesRight: ['toesRight', 'rightToes', 'toes.right', 'right.toes', 'toeRight'],
};

function semanticValue(source: UnknownRecord, role: HumanoidJointRole): string | undefined {
  for (const key of HUMANOID_ROLE_ALIASES[role]) {
    if (typeof source[key] === 'string' && source[key].length > 0) return source[key] as string;
  }
  const side = role.endsWith('Left') ? 'left' : role.endsWith('Right') ? 'right' : undefined;
  if (side && isRecord(source[side])) {
    const part = role.slice(0, -side.length);
    const nested = source[side] as UnknownRecord;
    if (typeof nested[part] === 'string' && nested[part].length > 0) return nested[part] as string;
  }
  return undefined;
}

function migrateHumanoidMap(source: UnknownRecord, joints: RigJointDefinition[]): HumanoidSemanticMap | undefined {
  const bundled = nestedHumanoid(source);
  const explicit = isRecord(source.humanoidMap)
    ? source.humanoidMap as UnknownRecord
    : isRecord(bundled.semanticMap)
      ? bundled.semanticMap as UnknownRecord
      : isRecord(bundled.humanoidMap)
        ? bundled.humanoidMap as UnknownRecord
      : isRecord(bundled.map)
        ? bundled.map as UnknownRecord
        : bundled;
  const result: Partial<HumanoidSemanticMap> = {};
  for (const role of HUMANOID_JOINT_ROLES) {
    const explicitId = semanticValue(explicit, role);
    const roleJoint = joints.find((joint) =>
      joint.role !== undefined && HUMANOID_ROLE_ALIASES[role].includes(joint.role));
    const id = explicitId ?? roleJoint?.id;
    if (id) result[role] = id;
  }
  return Object.keys(result).length > 0 ? result as HumanoidSemanticMap : undefined;
}

function migrateJoints(source: UnknownRecord): RigJointDefinition[] {
  const restPose = isRecord(source.restPose) ? source.restPose : {};
  const roles = metadataRecord(source, 'jointRoles', 'roles');
  const types = metadataRecord(source, 'jointTypes', 'types');
  const aliases = metadataRecord(source, 'jointAliases', 'aliases');
  const bindPose = metadataRecord(source, 'bindPose', 'bindPose');
  const bundled = nestedHumanoid(source);
  const retargetPose = {
    ...(isRecord(source.retargetPose) ? source.retargetPose : {}),
    ...(isRecord(source.canonicalTPose) ? source.canonicalTPose : {}),
    ...(isRecord(bundled.retargetPose) ? bundled.retargetPose : {}),
    ...(isRecord(bundled.canonicalTPose) ? bundled.canonicalTPose : {}),
  };
  const decorate = (result: RigJointDefinition, joint: UnknownRecord): RigJointDefinition => {
    const id = result.id;
    const role = typeof joint.role === 'string' ? joint.role : typeof roles[id] === 'string' ? roles[id] as string : undefined;
    const type = typeof joint.type === 'string' ? joint.type : typeof types[id] === 'string' ? types[id] as string : undefined;
    const jointAliases = stringArray(joint.aliases ?? aliases[id]);
    const bind = optionalTransform(joint.bind ?? joint.bindLocal ?? bindPose[id]);
    const retarget = optionalTransform(joint.retarget ?? joint.retargetLocal ?? retargetPose[id]);
    const stretch = migrateStretch(joint.stretch);
    return {
      ...result,
      ...(role ? { role } : {}),
      ...(type ? { type } : {}),
      ...(jointAliases ? { aliases: jointAliases } : {}),
      ...(bind ? { bind } : {}),
      ...(retarget ? { retarget } : {}),
      ...(stretch ? { stretch } : {}),
    };
  };
  if (Array.isArray(source.joints)) {
    return source.joints.map((raw, index) => {
      const joint = isRecord(raw) ? raw : {};
      const id = text(joint.id ?? joint.semanticId, `joint-${index}`);
      const result = decorate({
        id,
        nodeName: text(joint.nodeName ?? joint.name, id),
        ...(typeof joint.displayName === 'string'
          ? { name: joint.displayName }
          : joint.nodeName !== undefined && typeof joint.name === 'string' ? { name: joint.name } : {}),
        parentId: joint.parentId === null ? null : typeof joint.parentId === 'string' ? joint.parentId : null,
        rest: legacyRest(joint.rest ?? joint.restLocal ?? restPose[id]),
      }, joint);
      if (typeof joint.mirrorId === 'string') result.mirrorId = joint.mirrorId;
      if (Array.isArray(joint.tags)) result.tags = joint.tags.filter((tag): tag is string => typeof tag === 'string');
      return result;
    });
  }
  if (isRecord(source.joints)) {
    return Object.entries(source.joints).map(([id, raw]) => {
      const joint = isRecord(raw) ? raw : {};
      const nodeName = typeof raw === 'string' ? raw : text(joint.nodeName ?? joint.name, id);
      return decorate({
        id,
        nodeName,
        ...(isRecord(raw) && raw.nodeName !== undefined && typeof raw.name === 'string' ? { name: raw.name } : {}),
        parentId: typeof joint.parentId === 'string' ? joint.parentId : null,
        rest: legacyRest(joint.rest ?? restPose[id]),
      }, joint);
    });
  }
  return [];
}

export function migrateRigDefinition(input: unknown, fallbackId = 'rig-0'): RigDefinition {
  if (!isRecord(input)) throw new TypeError('rig definition must be an object');
  if (input.schema === RIG_SCHEMA && input.version === RIG_SCHEMA_VERSION) {
    return clone(input) as unknown as RigDefinition;
  }
  if (input.schema === RIG_SCHEMA && number(input.version, 0) > RIG_SCHEMA_VERSION) {
    throw new Error(`rig schema version ${String(input.version)} is newer than supported version ${RIG_SCHEMA_VERSION}`);
  }
  const joints = migrateJoints(input);
  const rootJointId = text(input.rootJointId, joints.find((joint) => joint.parentId === null)?.id ?? joints[0]?.id ?? 'root');
  const coordinate = isRecord(input.coordinateSystem) ? input.coordinateSystem : {};
  const handedness = coordinate.handedness === 'left' ? 'left' : 'right';
  const up = coordinate.up === 'X' || coordinate.up === 'Z' ? coordinate.up : 'Y';
  const rig: RigDefinition = {
    schema: RIG_SCHEMA,
    version: RIG_SCHEMA_VERSION,
    id: text(input.id ?? input.rigId, fallbackId),
    name: text(input.name ?? input.rigName, 'Rig'),
    rootJointId,
    coordinateSystem: {
      handedness,
      up,
      localForward: text(coordinate.localForward, '+Z'),
      units: text(coordinate.units, 'rig-units'),
      ...(typeof coordinate.worldUnitApproximation === 'string'
        ? { worldUnitApproximation: coordinate.worldUnitApproximation }
        : {}),
      ...(Array.isArray(coordinate.visualScale)
        ? { visualScale: tuple(coordinate.visualScale, 3, [1, 1, 1]) as [number, number, number] }
        : {}),
    },
    joints,
    sockets: [],
    controls: [],
  };
  if (Array.isArray(input.sockets)) {
    rig.sockets = input.sockets.map((raw, index) => {
      const socket = isRecord(raw) ? raw : {};
      const id = text(socket.id, `socket-${index}`);
      return {
        id,
        nodeName: text(socket.nodeName ?? socket.name, id),
        ...(typeof socket.parentJointId === 'string' ? { parentJointId: socket.parentJointId } : {}),
        ...(typeof socket.mirrorId === 'string' ? { mirrorId: socket.mirrorId } : {}),
        ...(Array.isArray(socket.tags)
          ? { tags: socket.tags.filter((tag): tag is string => typeof tag === 'string') }
          : {}),
      };
    });
  } else if (isRecord(input.sockets)) {
    rig.sockets = Object.entries(input.sockets)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([id, nodeName]) => ({ id, nodeName }));
  }
  if (Array.isArray(input.controls)) {
    rig.controls = input.controls.map((raw, index) => {
      const control = isRecord(raw) ? raw : {};
      return {
        id: text(control.id, `control-${index}`),
        ...(typeof control.name === 'string' ? { name: control.name } : {}),
        defaultValue: number(control.defaultValue, 0),
        ...(Number.isFinite(control.min) ? { min: control.min as number } : {}),
        ...(Number.isFinite(control.max) ? { max: control.max as number } : {}),
        ...(typeof control.mirrorId === 'string' ? { mirrorId: control.mirrorId } : {}),
        ...(control.mirrorSign === -1 || control.mirrorSign === 1 ? { mirrorSign: control.mirrorSign } : {}),
      };
    });
  }
  const humanoid = migrateHumanoidMap(input, joints);
  if (humanoid) rig.humanoid = humanoid;
  if (isRecord(input.mirror)) {
    const axis = input.mirror.axis === 'y' || input.mirror.axis === 'z' ? input.mirror.axis : 'x';
    const pairs = (value: unknown): [string, string][] | undefined => {
      if (!Array.isArray(value)) return undefined;
      const result = value.filter((entry): entry is [string, string] =>
        Array.isArray(entry) && entry.length === 2
        && typeof entry[0] === 'string' && typeof entry[1] === 'string');
      return result.length > 0 ? result.map(([left, right]) => [left, right]) : undefined;
    };
    const jointPairs = pairs(input.mirror.jointPairs) ?? [];
    const controlPairs = pairs(input.mirror.controlPairs);
    rig.mirror = { axis, jointPairs, ...(controlPairs ? { controlPairs } : {}) };
  }
  const metadata = jsonRecord(input.metadata);
  if (metadata) rig.metadata = metadata;
  return rig;
}

function interpolation(value: unknown): KeyInterpolation {
  if (value === 'step' || value === 'hold' || value === 'constant') return 'step';
  if (value === 'cubic' || value === 'bezier' || value === 'hermite') return 'cubic';
  return 'linear';
}

function trackKind(source: UnknownRecord): AnimationTrack['kind'] {
  const value = source.kind ?? source.channel ?? source.property;
  if (value === 'rotation' || value === 'quaternion') return 'quaternion';
  if (value === 'translation' || value === 'position') return 'position';
  if (value === 'scale') return 'scale';
  return 'scalar';
}

function migrateTrack(raw: unknown, clipIndex: number, trackIndex: number): AnimationTrack {
  const source = isRecord(raw) ? raw : {};
  const kind = trackKind(source);
  const target = text(source.target ?? source.jointId ?? source.controlId, `target-${trackIndex}`);
  const id = text(source.id, `clip-${clipIndex}-track-${trackIndex}`);
  const rawKeys = Array.isArray(source.keys)
    ? source.keys
    : Array.isArray(source.keyframes) ? source.keyframes : [];
  if (kind === 'scalar') {
    return {
      id,
      kind,
      target,
      keys: rawKeys.map((rawKey, keyIndex) => {
        const key = isRecord(rawKey) ? rawKey : {};
        return {
          id: text(key.id ?? key.keyId, `${id}-key-${keyIndex}`),
          time: number(key.time, 0),
          value: number(key.value, 0),
          interpolation: interpolation(key.interpolation),
          ...(Number.isFinite(key.inTangent) ? { inTangent: key.inTangent as number } : {}),
          ...(Number.isFinite(key.outTangent) ? { outTangent: key.outTangent as number } : {}),
        };
      }),
    };
  }
  if (kind === 'quaternion') {
    return {
      id,
      kind,
      target,
      keys: rawKeys.map((rawKey, keyIndex) => {
        const key = isRecord(rawKey) ? rawKey : {};
        return {
          id: text(key.id ?? key.keyId, `${id}-key-${keyIndex}`),
          time: number(key.time, 0),
          value: tuple(key.value, 4, [0, 0, 0, 1]) as [number, number, number, number],
          interpolation: interpolation(key.interpolation),
        };
      }),
    };
  }
  return {
    id,
    kind,
    target,
    keys: rawKeys.map((rawKey, keyIndex) => {
      const key = isRecord(rawKey) ? rawKey : {};
      return {
        id: text(key.id ?? key.keyId, `${id}-key-${keyIndex}`),
        time: number(key.time, 0),
        value: tuple(key.value, 3, kind === 'scale' ? [1, 1, 1] : [0, 0, 0]) as [number, number, number],
        interpolation: interpolation(key.interpolation),
        ...(Array.isArray(key.inTangent)
          ? { inTangent: tuple(key.inTangent, 3, [0, 0, 0]) as [number, number, number] }
          : {}),
        ...(Array.isArray(key.outTangent)
          ? { outTangent: tuple(key.outTangent, 3, [0, 0, 0]) as [number, number, number] }
          : {}),
      };
    }),
  };
}

function loopMetadata(value: unknown): ClipLoopMetadata {
  if (isRecord(value)) {
    const mode = value.mode === 'once' || value.mode === 'ping-pong' ? value.mode : 'loop';
    return { mode, seamless: value.seamless !== false };
  }
  if (value === false || value === 'once' || value === 'clamp') return { mode: 'once', seamless: false };
  if (value === 'ping-pong' || value === 'pingpong') return { mode: 'ping-pong', seamless: true };
  return { mode: 'loop', seamless: true };
}

function rootMotionMetadata(value: unknown): RootMotionMetadata {
  if (!isRecord(value)) return { mode: 'in-place' };
  const mode = value.mode === 'authored' || value.mode === 'extract' ? value.mode : 'in-place';
  const axes = Array.isArray(value.axes)
    ? value.axes.filter((axis): axis is 'x' | 'y' | 'z' | 'yaw' =>
      axis === 'x' || axis === 'y' || axis === 'z' || axis === 'yaw')
    : undefined;
  return {
    mode,
    ...(typeof value.jointId === 'string' ? { jointId: value.jointId } : {}),
    ...(axes ? { axes } : {}),
  };
}

function migrateMarkers(value: unknown): AnimationMarker[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const marker = isRecord(raw) ? raw : {};
    return {
      id: text(marker.id, `marker-${index}`),
      time: number(marker.time, 0),
      name: text(marker.name, `Marker ${index + 1}`),
      ...(typeof marker.color === 'string' ? { color: marker.color } : {}),
    };
  });
}

function migrateContacts(value: unknown): AnimationContact[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const contact = isRecord(raw) ? raw : {};
    const mode = contact.mode === 'grip' || contact.mode === 'custom' ? contact.mode : 'plant';
    return {
      id: text(contact.id, `contact-${index}`),
      start: number(contact.start ?? contact.time, 0),
      end: number(contact.end ?? contact.time, 0),
      effector: text(contact.effector ?? contact.socket, 'unknown'),
      mode,
      ...(typeof contact.target === 'string' ? { target: contact.target } : {}),
      ...(Number.isFinite(contact.weight) ? { weight: contact.weight as number } : {}),
      ...(jsonRecord(contact.metadata) ? { metadata: jsonRecord(contact.metadata) } : {}),
    };
  });
}

function migrateEvents(value: unknown): AnimationEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw, index) => {
    const event = isRecord(raw) ? raw : {};
    return {
      id: text(event.id, `event-${index}`),
      time: number(event.time, 0),
      name: text(event.name ?? event.type, `Event ${index + 1}`),
      ...(event.payload === undefined ? {} : { payload: event.payload as JsonValue }),
    };
  });
}

function migrateProceduralTarget(value: unknown): ProceduralDriverTarget {
  const target = isRecord(value) ? value : {};
  const kind = target.kind === 'position' || target.kind === 'scale' || target.kind === 'quaternion'
    ? target.kind
    : 'scalar';
  const targetId = text(target.target ?? target.jointId ?? target.controlId, 'unassigned');
  if (kind === 'quaternion') {
    return {
      kind,
      target: targetId,
      axis: tuple(target.axis, 3, [1, 0, 0]) as [number, number, number],
    };
  }
  if (kind === 'position' || kind === 'scale') {
    const component = target.component === 'y' || target.component === 'z' ? target.component : 'x';
    return { kind, target: targetId, component };
  }
  return {
    kind,
    target: targetId,
    ...(Number.isFinite(target.baseValue) ? { baseValue: target.baseValue as number } : {}),
  };
}

function migrateProceduralDriver(raw: unknown, clipIndex: number, driverIndex: number): ProceduralDriverDefinition {
  const source = isRecord(raw) ? raw : {};
  const type = source.type === 'pulse' || source.type === 'envelope' || source.type === 'noise'
    || source.type === 'response' || source.type === 'custom'
    ? source.type
    : 'oscillator';
  const blend: ProceduralDriverDefinition['blend'] = source.blend === 'override' || source.blend === 'multiply'
    ? source.blend
    : 'additive';
  const common = {
    schema: PROCEDURAL_DRIVER_SCHEMA,
    version: PROCEDURAL_DRIVER_SCHEMA_VERSION,
    id: text(source.id, `clip-${clipIndex}-driver-${driverIndex}`),
    order: number(source.order, driverIndex),
    ...(typeof source.name === 'string' ? { name: source.name } : {}),
    ...(source.enabled === false ? { enabled: false } : {}),
    target: migrateProceduralTarget(source.target ?? source),
    blend,
    source: text(source.source ?? source.input, 'time'),
    amplitude: number(source.amplitude, 1),
    frequency: number(source.frequency, 1),
    phase: number(source.phase, 0),
    bias: number(source.bias, 0),
    seed: number(source.seed, 0),
    ...(Array.isArray(source.clamp)
      ? { clamp: tuple(source.clamp, 2, [-Number.MAX_VALUE, Number.MAX_VALUE]) as [number, number] }
      : {}),
  };
  if (type === 'oscillator') {
    const waveform = source.waveform === 'triangle' || source.waveform === 'saw' ? source.waveform : 'sine';
    return { ...common, type, waveform };
  }
  if (type === 'pulse') {
    return {
      ...common,
      type,
      dutyCycle: number(source.dutyCycle, 0.5),
      ...(Number.isFinite(source.smoothing) ? { smoothing: source.smoothing as number } : {}),
    };
  }
  if (type === 'envelope') {
    return {
      ...common,
      type,
      attack: number(source.attack, 0.2),
      hold: number(source.hold, 0.4),
      release: number(source.release, 0.4),
      loop: source.loop !== false,
    };
  }
  if (type === 'noise') {
    return { ...common, type, interpolation: source.interpolation === 'step' ? 'step' : 'smooth' };
  }
  if (type === 'response') {
    const curve = source.curve === 'step' || source.curve === 'smoothstep' || source.curve === 'smootherstep'
      ? source.curve
      : 'linear';
    return {
      ...common,
      type,
      inputRange: tuple(source.inputRange, 2, [0, 1]) as [number, number],
      curve,
      ...(source.extrapolate === true ? { extrapolate: true } : {}),
    };
  }
  return {
    ...common,
    type,
    evaluatorId: text(source.evaluatorId, 'unassigned'),
    ...(jsonRecord(source.params) ? { params: jsonRecord(source.params) } : {}),
  };
}

function migrateClip(raw: unknown, index: number, defaultRigId: string): AnimationClip {
  const source = isRecord(raw) ? raw : {};
  const rawTracks = Array.isArray(source.tracks) ? source.tracks : [];
  const tracks = rawTracks.map((track, trackIndex) => migrateTrack(track, index, trackIndex));
  const latestKey = tracks.reduce((latest, track) =>
    Math.max(latest, ...track.keys.map((key) => key.time)), 0);
  const rawRange = isRecord(source.range) ? source.range : {};
  const duration = Math.max(0, number(source.duration, number(rawRange.end, latestKey || 1)));
  const start = number(rawRange.start ?? source.start, 0);
  const end = number(rawRange.end ?? source.end, duration);
  const clip: AnimationClip = {
    id: text(source.id, `clip-${index}`),
    name: text(source.name, `Animation ${index + 1}`),
    rigId: text(source.rigId, defaultRigId),
    duration,
    playbackSpeed: number(source.playbackSpeed ?? source.speed, 1),
    loop: loopMetadata(source.loop ?? source.wrapMode),
    range: { start, end },
    rootMotion: rootMotionMetadata(source.rootMotion),
    transformSpace: 'rest-local-delta',
    tracks,
    proceduralOrder: source.proceduralOrder === 'keyed-then-procedural'
      ? 'keyed-then-procedural'
      : 'procedural-then-keyed',
    proceduralDrivers: (Array.isArray(source.proceduralDrivers)
      ? source.proceduralDrivers
      : Array.isArray(source.drivers) ? source.drivers : [])
      .map((driver, driverIndex) => migrateProceduralDriver(driver, index, driverIndex)),
    markers: migrateMarkers(source.markers),
    contacts: migrateContacts(source.contacts),
    events: migrateEvents(source.events),
  };
  if (Array.isArray(source.tags)) clip.tags = source.tags.filter((tag): tag is string => typeof tag === 'string');
  const metadata = jsonRecord(source.metadata);
  if (metadata) clip.metadata = metadata;
  return clip;
}

function canonicalizeClipJointTargets(clip: AnimationClip, rig: RigDefinition | undefined): AnimationClip {
  if (!rig) return clip;
  const aliases = new Map<string, string>();
  for (const joint of rig.joints) {
    aliases.set(joint.id, joint.id);
    for (const alias of joint.aliases ?? []) if (!aliases.has(alias)) aliases.set(alias, joint.id);
  }
  const canonical = (id: string): string => aliases.get(id) ?? id;
  return {
    ...clip,
    rootMotion: clip.rootMotion.jointId
      ? { ...clip.rootMotion, jointId: canonical(clip.rootMotion.jointId) }
      : clip.rootMotion,
    tracks: clip.tracks.map((track) => track.kind === 'scalar'
      ? track
      : { ...track, target: canonical(track.target) }),
    proceduralDrivers: clip.proceduralDrivers.map((driver) => driver.target.kind === 'scalar'
      ? driver
      : { ...driver, target: { ...driver.target, target: canonical(driver.target.target) } }),
  };
}

/** Upgrades the legacy unversioned/v0 editor shape to the canonical v1 document. */
export function migrateAnimationSuite(input: unknown): AnimationSuiteDocument {
  const parsed = typeof input === 'string' ? JSON.parse(input) as unknown : input;
  if (!isRecord(parsed)) throw new TypeError('animation suite must be an object');
  if (parsed.schema === ANIMATION_SUITE_SCHEMA && parsed.version === ANIMATION_SUITE_SCHEMA_VERSION) {
    // Suite v2 predates rig v2. Preserve clips and draft/editor payloads byte-for-
    // byte at the object level while upgrading only their embedded rig records.
    const current = clone(parsed) as unknown as AnimationSuiteDocument;
    current.rigs = (Array.isArray(parsed.rigs) ? parsed.rigs : [])
      .map((rig, index) => migrateRigDefinition(rig, `rig-${index}`));
    const rigById = new Map(current.rigs.map((rig) => [rig.id, rig]));
    current.clips = (Array.isArray(current.clips) ? current.clips : [])
      .map((clip) => canonicalizeClipJointTargets(clip, rigById.get(clip.rigId)));
    return current;
  }
  if (parsed.schema === ANIMATION_SUITE_SCHEMA && number(parsed.version, 0) > ANIMATION_SUITE_SCHEMA_VERSION) {
    throw new Error(
      `animation suite schema version ${String(parsed.version)} is newer than supported version ${ANIMATION_SUITE_SCHEMA_VERSION}`,
    );
  }
  const rawRigs = Array.isArray(parsed.rigs)
    ? parsed.rigs
    : parsed.rig === undefined ? [] : [parsed.rig];
  const rigs = rawRigs.map((rig, index) => migrateRigDefinition(rig, `rig-${index}`));
  const defaultRigId = rigs[0]?.id ?? text(parsed.rigId, 'rig-0');
  const rawClips = Array.isArray(parsed.clips)
    ? parsed.clips
    : Array.isArray(parsed.animations) ? parsed.animations : [];
  const rigById = new Map(rigs.map((rig) => [rig.id, rig]));
  const clips = rawClips.map((clip, index) => {
    const migrated = migrateClip(clip, index, defaultRigId);
    return canonicalizeClipJointTargets(migrated, rigById.get(migrated.rigId));
  });
  const document: AnimationSuiteDocument = {
    schema: ANIMATION_SUITE_SCHEMA,
    version: ANIMATION_SUITE_SCHEMA_VERSION,
    id: text(parsed.id, 'animation-suite'),
    name: text(parsed.name, 'Animation Suite'),
    rigs,
    clips,
  };
  const activeClipId = parsed.activeClipId ?? parsed.selectedClipId;
  if (typeof activeClipId === 'string') document.activeClipId = activeClipId;
  const metadata = jsonRecord(parsed.metadata);
  if (metadata) document.metadata = metadata;
  return document;
}
