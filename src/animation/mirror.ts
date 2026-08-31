import type {
  AnimationClip,
  AnimationTrack,
  JointPoseDelta,
  PoseBuffer,
  QuaternionTuple,
  RigDefinition,
  ProceduralDriverDefinition,
  ProceduralDriverTarget,
  Vec3Tuple,
} from './types';

export interface RigMirrorMaps {
  joints: ReadonlyMap<string, string>;
  controls: ReadonlyMap<string, string>;
  sockets: ReadonlyMap<string, string>;
}

function addPair(map: Map<string, string>, left: string, right: string): void {
  map.set(left, right);
  map.set(right, left);
}

export function createRigMirrorMaps(rig: RigDefinition): RigMirrorMaps {
  const joints = new Map<string, string>();
  const controls = new Map<string, string>();
  const sockets = new Map<string, string>();
  for (const joint of rig.joints) {
    if (joint.mirrorId) addPair(joints, joint.id, joint.mirrorId);
    else if (!joints.has(joint.id)) joints.set(joint.id, joint.id);
  }
  for (const [left, right] of rig.mirror?.jointPairs ?? []) addPair(joints, left, right);
  for (const control of rig.controls) {
    if (control.mirrorId) addPair(controls, control.id, control.mirrorId);
    else if (!controls.has(control.id)) controls.set(control.id, control.id);
  }
  for (const [left, right] of rig.mirror?.controlPairs ?? []) addPair(controls, left, right);
  for (const socket of rig.sockets) {
    if (socket.mirrorId) addPair(sockets, socket.id, socket.mirrorId);
    else sockets.set(socket.id, socket.id);
  }
  return { joints, controls, sockets };
}

export function getMirroredJointId(rig: RigDefinition, jointId: string): string {
  return createRigMirrorMaps(rig).joints.get(jointId) ?? jointId;
}

export function getMirroredControlId(rig: RigDefinition, controlId: string): string {
  return createRigMirrorMaps(rig).controls.get(controlId) ?? controlId;
}

function mirrorVector(value: Vec3Tuple, axis: 'x' | 'y' | 'z'): Vec3Tuple {
  const result: Vec3Tuple = [...value];
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  result[index] = result[index] === 0 ? 0 : -result[index];
  return result;
}

function negated(value: number): number {
  return value === 0 ? 0 : -value;
}

/** Mirrors a rotation by conjugating it with an axis reflection matrix. */
export function mirrorQuaternion(
  value: QuaternionTuple,
  axis: 'x' | 'y' | 'z',
): QuaternionTuple {
  if (axis === 'x') return [value[0], negated(value[1]), negated(value[2]), value[3]];
  if (axis === 'y') return [negated(value[0]), value[1], negated(value[2]), value[3]];
  return [negated(value[0]), negated(value[1]), value[2], value[3]];
}

export function mirrorJointPoseDelta(
  value: JointPoseDelta,
  axis: 'x' | 'y' | 'z',
): JointPoseDelta {
  return {
    ...(value.position ? { position: mirrorVector(value.position, axis) } : {}),
    ...(value.quaternion ? { quaternion: mirrorQuaternion(value.quaternion, axis) } : {}),
    ...(value.scale ? { scale: [...value.scale] as Vec3Tuple } : {}),
  };
}

function scalarMirrorSign(rig: RigDefinition, controlId: string): 1 | -1 {
  return rig.controls.find((control) => control.id === controlId)?.mirrorSign ?? 1;
}

function signedDriverValues(
  driver: ProceduralDriverDefinition,
  sign: 1 | -1,
): Pick<ProceduralDriverDefinition, 'amplitude' | 'bias' | 'clamp'> {
  if (sign === 1) {
    return {
      amplitude: driver.amplitude,
      bias: driver.bias,
      ...(driver.clamp ? { clamp: [...driver.clamp] as [number, number] } : {}),
    };
  }
  return {
    amplitude: -driver.amplitude,
    bias: -driver.bias,
    ...(driver.clamp ? { clamp: [-driver.clamp[1], -driver.clamp[0]] } : {}),
  };
}

function mirrorProceduralTarget(
  target: ProceduralDriverTarget,
  rig: RigDefinition,
  maps: RigMirrorMaps,
): { target: ProceduralDriverTarget; sign: 1 | -1 } {
  const axis = rig.mirror?.axis ?? 'x';
  if (target.kind === 'scalar') {
    const sign = scalarMirrorSign(rig, target.target);
    return {
      target: {
        ...target,
        target: maps.controls.get(target.target) ?? target.target,
        ...(target.baseValue === undefined ? {} : { baseValue: target.baseValue * sign }),
      },
      sign,
    };
  }
  const jointTarget = maps.joints.get(target.target) ?? target.target;
  if (target.kind === 'quaternion') {
    const mirroredAxis = axis === 'x'
      ? [target.axis[0], negated(target.axis[1]), negated(target.axis[2])] as Vec3Tuple
      : axis === 'y'
        ? [negated(target.axis[0]), target.axis[1], negated(target.axis[2])] as Vec3Tuple
        : [negated(target.axis[0]), negated(target.axis[1]), target.axis[2]] as Vec3Tuple;
    return { target: { ...target, target: jointTarget, axis: mirroredAxis }, sign: 1 };
  }
  const sign = target.kind === 'position' && target.component === axis ? -1 : 1;
  return { target: { ...target, target: jointTarget }, sign };
}

function mirrorProceduralDriver(
  driver: ProceduralDriverDefinition,
  rig: RigDefinition,
  maps: RigMirrorMaps,
): ProceduralDriverDefinition {
  const mirrored = mirrorProceduralTarget(driver.target, rig, maps);
  return {
    ...driver,
    target: mirrored.target,
    ...signedDriverValues(driver, mirrored.sign),
  };
}

export function mirrorPose(pose: PoseBuffer, rig: RigDefinition): PoseBuffer {
  const axis = rig.mirror?.axis ?? 'x';
  const maps = createRigMirrorMaps(rig);
  const mirrored: PoseBuffer = { joints: {}, scalars: {} };
  for (const [jointId, value] of Object.entries(pose.joints)) {
    mirrored.joints[maps.joints.get(jointId) ?? jointId] = mirrorJointPoseDelta(value, axis);
  }
  for (const [controlId, value] of Object.entries(pose.scalars)) {
    mirrored.scalars[maps.controls.get(controlId) ?? controlId] = value * scalarMirrorSign(rig, controlId);
  }
  return mirrored;
}

function mirrorTrack(track: AnimationTrack, rig: RigDefinition, maps: RigMirrorMaps): AnimationTrack {
  if (track.kind === 'scalar') {
    const sign = scalarMirrorSign(rig, track.target);
    return {
      ...track,
      target: maps.controls.get(track.target) ?? track.target,
      keys: track.keys.map((key) => ({
        ...key,
        value: key.value * sign,
        ...(key.inTangent === undefined ? {} : { inTangent: key.inTangent * sign }),
        ...(key.outTangent === undefined ? {} : { outTangent: key.outTangent * sign }),
      })),
    };
  }
  const target = maps.joints.get(track.target) ?? track.target;
  if (track.kind === 'position') {
    return {
      ...track,
      target,
      keys: track.keys.map((key) => ({
        ...key,
        value: mirrorVector(key.value, rig.mirror?.axis ?? 'x'),
        ...(key.inTangent ? { inTangent: mirrorVector(key.inTangent, rig.mirror?.axis ?? 'x') } : {}),
        ...(key.outTangent ? { outTangent: mirrorVector(key.outTangent, rig.mirror?.axis ?? 'x') } : {}),
      })),
    };
  }
  if (track.kind === 'quaternion') {
    return {
      ...track,
      target,
      keys: track.keys.map((key) => ({
        ...key,
        value: mirrorQuaternion(key.value, rig.mirror?.axis ?? 'x'),
      })),
    };
  }
  return { ...track, target, keys: track.keys.map((key) => ({ ...key, value: [...key.value] })) };
}

export interface MirrorClipOptions {
  id?: string;
  name?: string;
}

export function mirrorClip(
  clip: AnimationClip,
  rig: RigDefinition,
  options: MirrorClipOptions = {},
): AnimationClip {
  const maps = createRigMirrorMaps(rig);
  return {
    ...clip,
    ...(options.id ? { id: options.id } : {}),
    ...(options.name ? { name: options.name } : {}),
    tracks: clip.tracks.map((track) => mirrorTrack(track, rig, maps)),
    proceduralDrivers: clip.proceduralDrivers.map((driver) => mirrorProceduralDriver(driver, rig, maps)),
    contacts: clip.contacts.map((contact) => ({
      ...contact,
      effector: maps.sockets.get(contact.effector) ?? contact.effector,
    })),
  };
}
