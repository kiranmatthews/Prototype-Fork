import * as THREE from 'three';
import {
  RIG_SCHEMA,
  RIG_SCHEMA_VERSION,
  type JointId,
  type LocalTransform,
  type PoseBuffer,
  type RigControlDefinition,
  type RigCoordinateSystem,
  type RigDefinition,
  type RigJointDefinition,
  type RigMirrorDefinition,
  type RigSocketDefinition,
  type Vec3Tuple,
} from './types';

export const PLAYER_PROCEDURAL_RIG_ID = 'player-procedural-v1';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteTuple(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function tuple3(value: unknown, fallback: Vec3Tuple): Vec3Tuple {
  return isFiniteTuple(value, 3) ? [value[0], value[1], value[2]] : [...fallback];
}

function captureLocalTransform(node: THREE.Object3D): LocalTransform {
  return {
    position: node.position.toArray() as Vec3Tuple,
    quaternion: node.quaternion.toArray() as [number, number, number, number],
    scale: node.scale.toArray() as Vec3Tuple,
  };
}

function metadataRestTransform(value: unknown, fallback: LocalTransform): LocalTransform {
  if (!isRecord(value)) return fallback;
  const quaternion = isFiniteTuple(value.quaternion, 4)
    ? [value.quaternion[0], value.quaternion[1], value.quaternion[2], value.quaternion[3]] as [number, number, number, number]
    : [...fallback.quaternion] as [number, number, number, number];
  const qLength = Math.hypot(...quaternion);
  const normalizedQuaternion: [number, number, number, number] = qLength > 1e-9
    ? [quaternion[0] / qLength, quaternion[1] / qLength, quaternion[2] / qLength, quaternion[3] / qLength]
    : [0, 0, 0, 1];
  return {
    position: tuple3(value.position, fallback.position),
    quaternion: normalizedQuaternion,
    scale: tuple3(value.scale, fallback.scale),
  };
}

function copyTransform(value: LocalTransform): LocalTransform {
  return {
    position: [...value.position],
    quaternion: [...value.quaternion],
    scale: [...value.scale],
  };
}

function findRuntimeRoot(root: THREE.Object3D): { root: THREE.Object3D; runtime: UnknownRecord } | null {
  if (isRecord(root.userData.sculptRuntime)) {
    return { root, runtime: root.userData.sculptRuntime };
  }
  let result: { root: THREE.Object3D; runtime: UnknownRecord } | null = null;
  root.traverse((candidate) => {
    if (!result && isRecord(candidate.userData.sculptRuntime)) {
      result = { root: candidate, runtime: candidate.userData.sculptRuntime };
    }
  });
  return result;
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.length > 0) result[key] = entry;
  }
  return result;
}

function mirroredName(id: string, available: ReadonlySet<string>): string | undefined {
  const substitutions: Array<[RegExp, string]> = [
    [/Left/g, 'Right'], [/Right/g, 'Left'],
    [/left/g, 'right'], [/right/g, 'left'],
    [/-l$/i, '-r'], [/-r$/i, '-l'],
    [/_l$/i, '_r'], [/_r$/i, '_l'],
    [/\.l$/i, '.r'], [/\.r$/i, '.l'],
  ];
  for (const [pattern, replacement] of substitutions) {
    const candidate = id.replace(pattern, replacement);
    if (candidate !== id && available.has(candidate)) return candidate;
  }
  return undefined;
}

function inferMirror(joints: RigJointDefinition[], controls: RigControlDefinition[]): RigMirrorDefinition | undefined {
  const jointIds = new Set(joints.map((joint) => joint.id));
  const controlIds = new Set(controls.map((control) => control.id));
  const jointPairs: [JointId, JointId][] = [];
  const controlPairs: [string, string][] = [];
  for (const joint of joints) {
    const partner = mirroredName(joint.id, jointIds);
    if (!partner || joint.id.localeCompare(partner) >= 0) continue;
    joint.mirrorId = partner;
    const other = joints.find((candidate) => candidate.id === partner);
    if (other) other.mirrorId = joint.id;
    jointPairs.push([joint.id, partner]);
  }
  for (const control of controls) {
    const partner = mirroredName(control.id, controlIds);
    if (!partner || control.id.localeCompare(partner) >= 0) continue;
    control.mirrorId = partner;
    const other = controls.find((candidate) => candidate.id === partner);
    if (other) other.mirrorId = control.id;
    controlPairs.push([control.id, partner]);
  }
  if (jointPairs.length === 0 && controlPairs.length === 0) return undefined;
  return { axis: 'x', jointPairs, controlPairs };
}

function applyRuntimeMirrorPairs(
  runtime: UnknownRecord,
  joints: RigJointDefinition[],
  inferred: RigMirrorDefinition | undefined,
): RigMirrorDefinition | undefined {
  if (!Array.isArray(runtime.mirrorPairs)) return inferred;
  const jointById = new Map(joints.map((joint) => [joint.id, joint]));
  const pairs = new Map<string, [JointId, JointId]>();
  for (const [left, right] of inferred?.jointPairs ?? []) {
    pairs.set([left, right].sort().join('\u0000'), [left, right]);
  }
  for (const raw of runtime.mirrorPairs) {
    if (!Array.isArray(raw) || raw.length !== 2 || typeof raw[0] !== 'string' || typeof raw[1] !== 'string') continue;
    const left = jointById.get(raw[0]);
    const right = jointById.get(raw[1]);
    if (!left || !right) continue;
    left.mirrorId = right.id;
    right.mirrorId = left.id;
    pairs.set([left.id, right.id].sort().join('\u0000'), [left.id, right.id]);
  }
  if (pairs.size === 0 && !(inferred?.controlPairs?.length)) return undefined;
  return {
    axis: inferred?.axis ?? 'x',
    jointPairs: [...pairs.values()],
    ...(inferred?.controlPairs ? { controlPairs: inferred.controlPairs } : {}),
  };
}

function applyRuntimeDeformations(
  runtime: UnknownRecord,
  joints: RigJointDefinition[],
  controls: RigControlDefinition[],
): void {
  if (!Array.isArray(runtime.deformations)) return;
  const jointById = new Map(joints.map((joint) => [joint.id, joint]));
  const controlIds = new Set(controls.map((control) => control.id));
  for (const raw of runtime.deformations) {
    if (!isRecord(raw) || typeof raw.jointId !== 'string' || typeof raw.controlId !== 'string') continue;
    const joint = jointById.get(raw.jointId);
    if (!joint || !controlIds.has(raw.controlId) || !isFiniteTuple(raw.lengthAxis, 3)) continue;
    const childIds = Array.isArray(raw.downstreamJointIds)
      ? raw.downstreamJointIds.filter((id): id is string => typeof id === 'string' && jointById.has(id))
      : [];
    joint.stretch = {
      mode: 'translate-children',
      controlId: raw.controlId,
      lengthAxis: [raw.lengthAxis[0], raw.lengthAxis[1], raw.lengthAxis[2]],
      min: Number.isFinite(raw.min) ? raw.min as number : 0.5,
      max: Number.isFinite(raw.max) ? raw.max as number : 2,
      preserveVolume: raw.volume === 'preserve-cross-section-area',
      childIds,
    };
  }
}

function coordinateSystemFromRuntime(runtime: UnknownRecord): RigCoordinateSystem {
  const source = isRecord(runtime.coordinateSystem) ? runtime.coordinateSystem : {};
  const handedness = source.handedness === 'left' ? 'left' : 'right';
  const up = source.up === 'X' || source.up === 'Z' ? source.up : 'Y';
  return {
    handedness,
    up,
    localForward: typeof source.localForward === 'string' ? source.localForward : '+Z',
    units: typeof source.units === 'string' ? source.units : 'rig-units',
    ...(typeof source.worldUnitApproximation === 'string'
      ? { worldUnitApproximation: source.worldUnitApproximation }
      : {}),
    ...(isFiniteTuple(source.visualScale, 3)
      ? { visualScale: [source.visualScale[0], source.visualScale[1], source.visualScale[2]] as Vec3Tuple }
      : {}),
  };
}

function controlsFromRuntime(runtime: UnknownRecord): RigControlDefinition[] {
  if (!isRecord(runtime.controls)) return [];
  const controls: RigControlDefinition[] = [];
  for (const [id, raw] of Object.entries(runtime.controls)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      controls.push({ id, defaultValue: raw });
      continue;
    }
    if (!isRecord(raw) || !Number.isFinite(raw.defaultValue)) continue;
    const control: RigControlDefinition = { id, defaultValue: raw.defaultValue as number };
    if (typeof raw.name === 'string') control.name = raw.name;
    if (Number.isFinite(raw.min)) control.min = raw.min as number;
    if (Number.isFinite(raw.max)) control.max = raw.max as number;
    if (raw.mirrorSign === -1 || raw.mirrorSign === 1) control.mirrorSign = raw.mirrorSign;
    controls.push(control);
  }
  return controls;
}

function makeRigDefinition(
  root: THREE.Object3D,
  runtime: UnknownRecord,
  options: RigBindingOptions,
): { definition: RigDefinition; jointNodes: Map<JointId, THREE.Object3D>; socketNodes: Map<string, THREE.Object3D> } {
  const jointNames = stringRecord(runtime.joints);
  if (Object.keys(jointNames).length === 0) {
    throw new Error('sculptRuntime.joints must declare semantic joint IDs and Object3D names');
  }
  const jointNodes = new Map<JointId, THREE.Object3D>();
  const nodeToId = new Map<THREE.Object3D, JointId>();
  for (const [id, nodeName] of Object.entries(jointNames)) {
    const node = root.getObjectByName(nodeName);
    if (!node) {
      if (options.strict !== false) throw new Error(`sculptRuntime joint "${id}" cannot find node "${nodeName}"`);
      continue;
    }
    jointNodes.set(id, node);
    nodeToId.set(node, id);
  }
  if (jointNodes.size === 0) throw new Error('sculptRuntime did not resolve any live joints');
  const restPose = isRecord(runtime.restPose) ? runtime.restPose : {};
  const joints: RigJointDefinition[] = [];
  for (const [id, node] of jointNodes) {
    let parentId: JointId | null = null;
    let ancestor = node.parent;
    while (ancestor) {
      const semantic = nodeToId.get(ancestor);
      if (semantic) {
        parentId = semantic;
        break;
      }
      if (ancestor === root) break;
      ancestor = ancestor.parent;
    }
    joints.push({
      id,
      nodeName: node.name,
      parentId,
      rest: metadataRestTransform(restPose[id], captureLocalTransform(node)),
    });
  }
  const rootJointId = jointNodes.has('root')
    ? 'root'
    : joints.find((joint) => joint.parentId === null)?.id ?? joints[0].id;
  const rootJoint = joints.find((joint) => joint.id === rootJointId);
  if (rootJoint) rootJoint.parentId = null;

  const socketNames = stringRecord(runtime.sockets);
  const socketNodes = new Map<string, THREE.Object3D>();
  const sockets: RigSocketDefinition[] = [];
  for (const [id, nodeName] of Object.entries(socketNames)) {
    const node = root.getObjectByName(nodeName);
    if (!node) {
      if (options.strict !== false) throw new Error(`sculptRuntime socket "${id}" cannot find node "${nodeName}"`);
      continue;
    }
    socketNodes.set(id, node);
    let parentJointId: JointId | undefined;
    let ancestor: THREE.Object3D | null = node.parent;
    while (ancestor) {
      const semantic = nodeToId.get(ancestor);
      if (semantic) {
        parentJointId = semantic;
        break;
      }
      if (ancestor === root) break;
      ancestor = ancestor.parent;
    }
    sockets.push({ id, nodeName, ...(parentJointId ? { parentJointId } : {}) });
  }
  const socketIds = new Set(sockets.map((socket) => socket.id));
  for (const socket of sockets) {
    const partner = mirroredName(socket.id, socketIds);
    if (partner) socket.mirrorId = partner;
  }
  const controls = controlsFromRuntime(runtime);
  applyRuntimeDeformations(runtime, joints, controls);
  const kind = typeof runtime.kind === 'string' ? runtime.kind : 'procedural-rig';
  const defaultRigId = kind === 'procedural-character'
    ? PLAYER_PROCEDURAL_RIG_ID
    : `${(root.name || kind).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}-rig-v1`;
  const definition: RigDefinition = {
    schema: RIG_SCHEMA,
    version: RIG_SCHEMA_VERSION,
    id: options.rigId ?? (typeof runtime.rigId === 'string' ? runtime.rigId : defaultRigId),
    name: options.rigName ?? (typeof runtime.rigName === 'string' ? runtime.rigName : root.name || 'Procedural Rig'),
    rootJointId,
    coordinateSystem: coordinateSystemFromRuntime(runtime),
    joints,
    sockets,
    controls,
    metadata: {
      source: 'sculptRuntime',
      sourceSchemaVersion: Number.isFinite(runtime.schemaVersion) ? runtime.schemaVersion as number : 0,
      kind,
    },
  };
  const mirror = applyRuntimeMirrorPairs(runtime, joints, inferMirror(joints, controls));
  if (mirror) definition.mirror = mirror;
  return { definition, jointNodes, socketNodes };
}

export interface ScalarControlTarget {
  set(id: string, value: number): void;
  reset?(id: string, defaultValue: number): void;
}

export interface RigBindingOptions {
  rigId?: string;
  rigName?: string;
  strict?: boolean;
  scalarTarget?: ScalarControlTarget;
}

export interface ApplyPoseOptions {
  weight?: number;
  resetUnspecified?: boolean;
  strict?: boolean;
  scalarTarget?: ScalarControlTarget;
}

export class RigBinding {
  readonly root: THREE.Object3D;
  readonly definition: RigDefinition;
  readonly joints: ReadonlyMap<JointId, THREE.Object3D>;
  readonly sockets: ReadonlyMap<string, THREE.Object3D>;
  private readonly restTransforms = new Map<JointId, LocalTransform>();
  private readonly defaultScalarTarget?: ScalarControlTarget;

  private constructor(
    root: THREE.Object3D,
    definition: RigDefinition,
    joints: Map<JointId, THREE.Object3D>,
    sockets: Map<string, THREE.Object3D>,
    scalarTarget?: ScalarControlTarget,
  ) {
    this.root = root;
    this.definition = definition;
    this.joints = joints;
    this.sockets = sockets;
    this.defaultScalarTarget = scalarTarget;
    for (const joint of definition.joints) this.restTransforms.set(joint.id, copyTransform(joint.rest));
  }

  static fromSculptRuntime(sourceRoot: THREE.Object3D, options: RigBindingOptions = {}): RigBinding {
    const found = findRuntimeRoot(sourceRoot);
    if (!found) throw new Error('no userData.sculptRuntime metadata found below the supplied root');
    const built = makeRigDefinition(found.root, found.runtime, options);
    return new RigBinding(found.root, built.definition, built.jointNodes, built.socketNodes, options.scalarTarget);
  }

  static fromDefinition(
    root: THREE.Object3D,
    definition: RigDefinition,
    options: Omit<RigBindingOptions, 'rigId' | 'rigName'> = {},
  ): RigBinding {
    const joints = new Map<JointId, THREE.Object3D>();
    for (const joint of definition.joints) {
      const node = root.getObjectByName(joint.nodeName);
      if (!node) {
        if (options.strict !== false) throw new Error(`rig joint "${joint.id}" cannot find node "${joint.nodeName}"`);
        continue;
      }
      joints.set(joint.id, node);
    }
    const sockets = new Map<string, THREE.Object3D>();
    for (const socket of definition.sockets) {
      const node = root.getObjectByName(socket.nodeName);
      if (!node) {
        if (options.strict !== false) throw new Error(`rig socket "${socket.id}" cannot find node "${socket.nodeName}"`);
        continue;
      }
      sockets.set(socket.id, node);
    }
    return new RigBinding(root, definition, joints, sockets, options.scalarTarget);
  }

  getJoint(id: JointId): THREE.Object3D | undefined {
    return this.joints.get(id);
  }

  getSocket(id: string): THREE.Object3D | undefined {
    return this.sockets.get(id);
  }

  getRestTransform(id: JointId): LocalTransform | undefined {
    const rest = this.restTransforms.get(id);
    return rest ? copyTransform(rest) : undefined;
  }

  resetPose(): void {
    for (const [id, node] of this.joints) {
      const rest = this.restTransforms.get(id);
      if (!rest) continue;
      node.position.fromArray(rest.position);
      node.quaternion.fromArray(rest.quaternion);
      node.scale.fromArray(rest.scale);
    }
    for (const control of this.definition.controls) {
      this.defaultScalarTarget?.reset?.(control.id, control.defaultValue);
      if (!this.defaultScalarTarget?.reset) this.defaultScalarTarget?.set(control.id, control.defaultValue);
    }
  }

  applyPose(pose: PoseBuffer, options: ApplyPoseOptions = {}): void {
    const weight = Math.min(1, Math.max(0, options.weight ?? 1));
    const resetUnspecified = options.resetUnspecified !== false;
    const strict = options.strict === true;
    const identity = new THREE.Quaternion();
    const deltaQuaternion = new THREE.Quaternion();
    for (const [id, node] of this.joints) {
      const rest = this.restTransforms.get(id);
      if (!rest) continue;
      const delta = pose.joints[id];
      if (!delta && !resetUnspecified) continue;
      const position = delta?.position ?? [0, 0, 0];
      const scale = delta?.scale ?? [1, 1, 1];
      node.position.set(
        rest.position[0] + position[0] * weight,
        rest.position[1] + position[1] * weight,
        rest.position[2] + position[2] * weight,
      );
      deltaQuaternion.fromArray(delta?.quaternion ?? [0, 0, 0, 1]).normalize();
      identity.identity().slerp(deltaQuaternion, weight);
      node.quaternion.fromArray(rest.quaternion).multiply(identity).normalize();
      node.scale.set(
        rest.scale[0] * (1 + (scale[0] - 1) * weight),
        rest.scale[1] * (1 + (scale[1] - 1) * weight),
        rest.scale[2] * (1 + (scale[2] - 1) * weight),
      );
    }
    if (strict) {
      for (const id of Object.keys(pose.joints)) {
        if (!this.joints.has(id)) throw new Error(`pose targets unbound joint: ${id}`);
      }
    }
    const scalarTarget = options.scalarTarget ?? this.defaultScalarTarget;
    if (scalarTarget) {
      const controls = new Map(this.definition.controls.map((control) => [control.id, control]));
      if (resetUnspecified) {
        for (const control of this.definition.controls) {
          const authored = pose.scalars[control.id];
          const value = control.defaultValue + ((authored ?? control.defaultValue) - control.defaultValue) * weight;
          scalarTarget.set(control.id, value);
        }
      } else {
        for (const [id, authored] of Object.entries(pose.scalars)) {
          const control = controls.get(id);
          if (!control) {
            if (strict) throw new Error(`pose targets unbound scalar control: ${id}`);
            continue;
          }
          scalarTarget.set(id, control.defaultValue + (authored - control.defaultValue) * weight);
        }
      }
    }
  }

  /** Captures the live scene state as rest-local deltas for keyframing. */
  capturePose(jointIds?: Iterable<JointId>): PoseBuffer {
    const pose: PoseBuffer = { joints: {}, scalars: {} };
    const ids = jointIds ? [...jointIds] : [...this.joints.keys()];
    const inverseRest = new THREE.Quaternion();
    const current = new THREE.Quaternion();
    for (const id of ids) {
      const node = this.joints.get(id);
      const rest = this.restTransforms.get(id);
      if (!node || !rest) continue;
      inverseRest.fromArray(rest.quaternion).invert();
      current.copy(inverseRest).multiply(node.quaternion).normalize();
      pose.joints[id] = {
        position: [
          node.position.x - rest.position[0],
          node.position.y - rest.position[1],
          node.position.z - rest.position[2],
        ],
        quaternion: current.toArray() as [number, number, number, number],
        scale: [
          rest.scale[0] === 0 ? 1 : node.scale.x / rest.scale[0],
          rest.scale[1] === 0 ? 1 : node.scale.y / rest.scale[1],
          rest.scale[2] === 0 ? 1 : node.scale.z / rest.scale[2],
        ],
      };
    }
    return pose;
  }
}

export function applyPose(binding: RigBinding, pose: PoseBuffer, options?: ApplyPoseOptions): void {
  binding.applyPose(pose, options);
}

export function resetPose(binding: RigBinding): void {
  binding.resetPose();
}
