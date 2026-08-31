import * as THREE from 'three';
import type {
  HumanoidJointRole,
  JointId,
  RigDefinition,
  RigJointDefinition,
  RigSocketDefinition,
  Vec3Tuple,
} from './types';

const EPSILON = 1e-8;
const DEFAULT_TOLERANCE = 1e-4;
const MAX_FINITE_ERROR = Number.MAX_SAFE_INTEGER;

export type IkSide = 'left' | 'right' | 'center' | 'none';
export type IkChainKind = 'arm' | 'leg' | 'generic';
export type IkVector3Input = THREE.Vector3 | readonly [number, number, number] | {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};
export type IkQuaternionInput = THREE.Quaternion | readonly [number, number, number, number] | {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
};

/**
 * A spherical local-space rotation limit. It avoids Euler discontinuities and
 * works for arbitrary creature rigs. The reference defaults to the joint's
 * local rotation at the beginning of a solve.
 */
export interface IkRotationLimit {
  referenceQuaternion?: IkQuaternionInput;
  /** Maximum local angular distance from referenceQuaternion, in radians. */
  maxAngleRadians?: number;
  /** Maximum local angular change made by one solve, in radians. */
  maxStepRadians?: number;
}

/** Serializable chain metadata. Authoring tools may declare any three-joint chain. */
export interface IkChainDefinition {
  id: string;
  name: string;
  rootId: JointId;
  midId: JointId;
  endId: JointId;
  kind?: IkChainKind;
  side?: IkSide;
  /** Optional socket below the end joint, e.g. a sole or grip point. */
  effectorSocketId?: string;
  /** Preferred bend direction in the rig root's local space. */
  defaultPoleDirection?: Vec3Tuple;
  rootLimit?: IkRotationLimit;
  midLimit?: IkRotationLimit;
}

/** The small RigBinding surface needed by this module. */
export interface IkRigBindingLike {
  readonly root: THREE.Object3D;
  readonly definition: Pick<RigDefinition, 'joints' | 'sockets' | 'coordinateSystem' | 'humanoid'>;
  readonly joints: ReadonlyMap<JointId, THREE.Object3D>;
  readonly sockets?: ReadonlyMap<string, THREE.Object3D>;
  getJoint?(id: JointId): THREE.Object3D | undefined;
}

/** A chain ready for viewport gizmos and solving. target/pole are world-space points. */
export interface ResolvedIkChain extends IkChainDefinition {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  /** The actual terminal used by the solver (socket when valid, otherwise end). */
  effector: THREE.Object3D;
  /** The resolved named socket, even when it cannot safely act as the effector. */
  effectorSocket?: THREE.Object3D;
  target: THREE.Vector3;
  pole: THREE.Vector3;
}

export interface ResolveIkChainOptions {
  target?: IkVector3Input;
  pole?: IkVector3Input;
}

export interface TwoBoneIkOptions {
  root: THREE.Object3D;
  mid: THREE.Object3D;
  end: THREE.Object3D;
  /** Must be a descendant of mid. Defaults to end. */
  effector?: THREE.Object3D;
  /** Desired world-space effector position. */
  target: IkVector3Input;
  /** World-space point toward which the middle joint should bend. */
  pole: IkVector3Input;
  /** Blend of the analytic correction, clamped to 0..1. */
  weight?: number;
  tolerance?: number;
  /** Global per-joint angular step cap, in radians. Defaults to PI. */
  maxAngularStepRadians?: number;
  rootLimit?: IkRotationLimit;
  midLimit?: IkRotationLimit;
}

export type IkSolveStatus =
  | 'reached'
  | 'clamped'
  | 'limited'
  | 'unreached'
  | 'degenerate'
  | 'invalid';

export interface IkSolveResult {
  status: IkSolveStatus;
  reached: boolean;
  /** True when reach, weight, angular-step, or joint limits constrained the solve. */
  clamped: boolean;
  /** Finite world-space distance from the final effector to the requested target. */
  error: number;
  targetDistance: number;
  solvedDistance: number;
  iterations: number;
  endPosition: THREE.Vector3;
  message?: string;
}

export interface IkLocalTransformSnapshot {
  readonly node: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
}

interface RotationWriteResult {
  ok: boolean;
  limited: boolean;
}

function finiteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function finiteVector(value: THREE.Vector3): boolean {
  return finiteNumber(value.x) && finiteNumber(value.y) && finiteNumber(value.z);
}

function finiteQuaternion(value: THREE.Quaternion): boolean {
  return finiteNumber(value.x) && finiteNumber(value.y)
    && finiteNumber(value.z) && finiteNumber(value.w)
    && value.lengthSq() > EPSILON * EPSILON;
}

function readVector(value: IkVector3Input, out: THREE.Vector3): boolean {
  if (Array.isArray(value)) {
    const tuple = value as readonly [number, number, number];
    out.set(tuple[0], tuple[1], tuple[2]);
  } else {
    const vector = value as { readonly x: number; readonly y: number; readonly z: number };
    out.set(vector.x, vector.y, vector.z);
  }
  return finiteVector(out);
}

function readQuaternion(value: IkQuaternionInput, out: THREE.Quaternion): boolean {
  if (Array.isArray(value)) {
    const tuple = value as readonly [number, number, number, number];
    out.set(tuple[0], tuple[1], tuple[2], tuple[3]);
  } else {
    const quaternion = value as {
      readonly x: number;
      readonly y: number;
      readonly z: number;
      readonly w: number;
    };
    out.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  }
  if (!finiteQuaternion(out)) return false;
  out.normalize();
  return finiteQuaternion(out);
}

function finiteClamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return THREE.MathUtils.clamp(value as number, min, max);
}

function isDescendant(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = node; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

function refreshHierarchy(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
}

function safeWorldPosition(node: THREE.Object3D, out: THREE.Vector3): boolean {
  node.getWorldPosition(out);
  return finiteVector(out);
}

function clampQuaternionFrom(
  reference: THREE.Quaternion,
  candidate: THREE.Quaternion,
  maxAngle: number,
  out: THREE.Quaternion,
): boolean {
  const angle = reference.angleTo(candidate);
  if (!Number.isFinite(angle)) return false;
  if (angle <= maxAngle + EPSILON) {
    out.copy(candidate);
    return false;
  }
  if (maxAngle <= EPSILON || angle <= EPSILON) out.copy(reference);
  else out.copy(reference).slerp(candidate, maxAngle / angle);
  out.normalize();
  return true;
}

function writeWorldRotationDelta(
  node: THREE.Object3D,
  worldDelta: THREE.Quaternion,
  weight: number,
  globalMaxStep: number,
  limit: IkRotationLimit | undefined,
): RotationWriteResult {
  if (!finiteQuaternion(worldDelta) || !finiteQuaternion(node.quaternion)) {
    return { ok: false, limited: false };
  }
  const startLocal = node.quaternion.clone().normalize();
  const startWorld = new THREE.Quaternion();
  node.getWorldQuaternion(startWorld);
  if (!finiteQuaternion(startWorld)) return { ok: false, limited: false };

  const desiredWorld = worldDelta.clone().normalize().multiply(startWorld).normalize();
  const parentWorld = new THREE.Quaternion();
  if (node.parent) node.parent.getWorldQuaternion(parentWorld);
  else parentWorld.identity();
  if (!finiteQuaternion(parentWorld)) return { ok: false, limited: false };

  const candidate = parentWorld.invert().multiply(desiredWorld).normalize();
  if (!finiteQuaternion(candidate)) return { ok: false, limited: false };

  let limited = false;
  const weighted = startLocal.clone();
  if (weight < 1 - EPSILON) {
    weighted.slerp(candidate, weight).normalize();
    limited = startLocal.angleTo(candidate) > EPSILON;
  } else {
    weighted.copy(candidate);
  }

  const perJointStep = finiteClamp(limit?.maxStepRadians, Math.PI, 0, Math.PI);
  const maxStep = Math.min(globalMaxStep, perJointStep);
  const stepped = new THREE.Quaternion();
  limited = clampQuaternionFrom(startLocal, weighted, maxStep, stepped) || limited;

  let final = stepped;
  if (limit?.maxAngleRadians !== undefined) {
    const reference = startLocal.clone();
    if (limit.referenceQuaternion && !readQuaternion(limit.referenceQuaternion, reference)) {
      return { ok: false, limited };
    }
    const maxAngle = finiteClamp(limit.maxAngleRadians, Math.PI, 0, Math.PI);
    const bounded = new THREE.Quaternion();
    limited = clampQuaternionFrom(reference, stepped, maxAngle, bounded) || limited;
    final = bounded;
  }

  if (!finiteQuaternion(final)) return { ok: false, limited };
  node.quaternion.copy(final).normalize();
  return { ok: finiteQuaternion(node.quaternion), limited };
}

function orthogonalDirection(direction: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  if (Math.abs(direction.y) < 0.8) out.set(0, 1, 0);
  else if (Math.abs(direction.x) < 0.8) out.set(1, 0, 0);
  else out.set(0, 0, 1);
  out.addScaledVector(direction, -out.dot(direction));
  if (out.lengthSq() <= EPSILON * EPSILON) out.set(0, 0, 1);
  return out.normalize();
}

function finiteDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  const distance = a.distanceTo(b);
  return Number.isFinite(distance) ? distance : MAX_FINITE_ERROR;
}

function resultForFailure(
  status: 'invalid' | 'degenerate',
  message: string,
  effector: THREE.Object3D,
  target?: THREE.Vector3,
): IkSolveResult {
  const endPosition = new THREE.Vector3();
  if (!safeWorldPosition(effector, endPosition)) endPosition.set(0, 0, 0);
  const error = target && finiteVector(target) ? finiteDistance(endPosition, target) : MAX_FINITE_ERROR;
  return {
    status,
    reached: false,
    clamped: false,
    error,
    targetDistance: 0,
    solvedDistance: 0,
    iterations: 0,
    endPosition,
    message,
  };
}

/**
 * Solve one two-segment chain analytically. Only root/mid local quaternions are
 * written; position and scale are never touched. Invalid or degenerate input is
 * a no-op, and a failed intermediate write rolls both rotations back.
 */
export function solveTwoBoneIk(options: TwoBoneIkOptions): IkSolveResult {
  const { root, mid, end } = options;
  const effector = options.effector ?? end;
  const target = new THREE.Vector3();
  const pole = new THREE.Vector3();
  refreshHierarchy(root);

  if (root === mid || mid === end || !isDescendant(mid, root)
    || !isDescendant(end, mid) || !isDescendant(effector, mid)) {
    return resultForFailure('invalid', 'IK joints must form an ordered root → mid → end hierarchy', effector);
  }
  if (!readVector(options.target, target) || !readVector(options.pole, pole)) {
    return resultForFailure('invalid', 'IK target and pole must contain finite world coordinates', effector, target);
  }
  if (!finiteQuaternion(root.quaternion) || !finiteQuaternion(mid.quaternion)) {
    return resultForFailure('invalid', 'IK input joint rotations must be finite normalized quaternions', effector, target);
  }

  const rootStart = root.quaternion.clone();
  const midStart = mid.quaternion.clone();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  if (!safeWorldPosition(root, a) || !safeWorldPosition(mid, b) || !safeWorldPosition(effector, c)) {
    return resultForFailure('invalid', 'IK hierarchy produced a non-finite world transform', effector, target);
  }

  const upperLength = a.distanceTo(b);
  const lowerLength = b.distanceTo(c);
  if (!Number.isFinite(upperLength) || !Number.isFinite(lowerLength)
    || upperLength <= EPSILON || lowerLength <= EPSILON) {
    return resultForFailure('degenerate', 'IK segments must have non-zero finite world lengths', effector, target);
  }

  const targetOffset = target.clone().sub(a);
  const requestedDistance = targetOffset.length();
  if (!Number.isFinite(requestedDistance)) {
    return resultForFailure('invalid', 'IK target distance is not finite', effector, target);
  }

  const aimDirection = targetOffset.clone();
  if (aimDirection.lengthSq() <= EPSILON * EPSILON) aimDirection.copy(c).sub(a);
  if (aimDirection.lengthSq() <= EPSILON * EPSILON) aimDirection.copy(b).sub(a);
  if (aimDirection.lengthSq() <= EPSILON * EPSILON) aimDirection.set(0, 1, 0);
  aimDirection.normalize();

  const minReach = Math.abs(upperLength - lowerLength);
  const maxReach = upperLength + lowerLength;
  const solvedReach = THREE.MathUtils.clamp(requestedDistance, minReach, maxReach);
  const reachClamped = Math.abs(solvedReach - requestedDistance) > EPSILON;
  const desiredEnd = a.clone().addScaledVector(aimDirection, solvedReach);

  const poleDirection = pole.clone().sub(a);
  poleDirection.addScaledVector(aimDirection, -poleDirection.dot(aimDirection));
  if (poleDirection.lengthSq() <= EPSILON * EPSILON) {
    poleDirection.copy(b).sub(a);
    poleDirection.addScaledVector(aimDirection, -poleDirection.dot(aimDirection));
  }
  if (poleDirection.lengthSq() <= EPSILON * EPSILON) orthogonalDirection(aimDirection, poleDirection);
  else poleDirection.normalize();

  let along = 0;
  if (solvedReach > EPSILON) {
    along = (solvedReach * solvedReach + upperLength * upperLength - lowerLength * lowerLength)
      / (2 * solvedReach);
  }
  const bendHeight = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  const desiredMid = a.clone()
    .addScaledVector(aimDirection, along)
    .addScaledVector(poleDirection, bendHeight);

  const currentUpper = b.clone().sub(a);
  const desiredUpper = desiredMid.clone().sub(a);
  if (currentUpper.lengthSq() <= EPSILON * EPSILON || desiredUpper.lengthSq() <= EPSILON * EPSILON) {
    return resultForFailure('degenerate', 'IK upper segment could not establish a solve direction', effector, target);
  }
  currentUpper.normalize();
  desiredUpper.normalize();

  const weight = finiteClamp(options.weight, 1, 0, 1);
  const maxStep = finiteClamp(options.maxAngularStepRadians, Math.PI, 0, Math.PI);
  const rootDelta = new THREE.Quaternion().setFromUnitVectors(currentUpper, desiredUpper).normalize();
  const rootWrite = writeWorldRotationDelta(root, rootDelta, weight, maxStep, options.rootLimit);
  if (!rootWrite.ok) {
    root.quaternion.copy(rootStart);
    mid.quaternion.copy(midStart);
    refreshHierarchy(root);
    return resultForFailure('invalid', 'IK root correction produced an invalid rotation', effector, target);
  }

  refreshHierarchy(root);
  const solvedMid = new THREE.Vector3();
  const afterRootEnd = new THREE.Vector3();
  if (!safeWorldPosition(mid, solvedMid) || !safeWorldPosition(effector, afterRootEnd)) {
    root.quaternion.copy(rootStart);
    mid.quaternion.copy(midStart);
    refreshHierarchy(root);
    return resultForFailure('invalid', 'IK root correction produced a non-finite hierarchy', effector, target);
  }
  const currentLower = afterRootEnd.clone().sub(solvedMid);
  const desiredLower = desiredEnd.clone().sub(solvedMid);
  if (currentLower.lengthSq() <= EPSILON * EPSILON || desiredLower.lengthSq() <= EPSILON * EPSILON) {
    root.quaternion.copy(rootStart);
    mid.quaternion.copy(midStart);
    refreshHierarchy(root);
    return resultForFailure('degenerate', 'IK lower segment could not establish a solve direction', effector, target);
  }
  currentLower.normalize();
  desiredLower.normalize();

  const midDelta = new THREE.Quaternion().setFromUnitVectors(currentLower, desiredLower).normalize();
  const midWrite = writeWorldRotationDelta(mid, midDelta, weight, maxStep, options.midLimit);
  if (!midWrite.ok) {
    root.quaternion.copy(rootStart);
    mid.quaternion.copy(midStart);
    refreshHierarchy(root);
    return resultForFailure('invalid', 'IK middle-joint correction produced an invalid rotation', effector, target);
  }

  refreshHierarchy(root);
  const endPosition = new THREE.Vector3();
  if (!safeWorldPosition(effector, endPosition)
    || !finiteQuaternion(root.quaternion) || !finiteQuaternion(mid.quaternion)) {
    root.quaternion.copy(rootStart);
    mid.quaternion.copy(midStart);
    refreshHierarchy(root);
    return resultForFailure('invalid', 'IK solve produced a non-finite result and was rolled back', effector, target);
  }

  const error = finiteDistance(endPosition, target);
  const tolerance = finiteClamp(options.tolerance, DEFAULT_TOLERANCE, EPSILON, 1e6);
  const rotationLimited = rootWrite.limited || midWrite.limited || weight < 1 - EPSILON;
  const clamped = reachClamped || rotationLimited;
  const reached = error <= tolerance;
  let status: IkSolveStatus = 'unreached';
  if (reached) status = 'reached';
  else if (rotationLimited) status = 'limited';
  else if (reachClamped) status = 'clamped';

  return {
    status,
    reached,
    clamped,
    error,
    targetDistance: requestedDistance,
    solvedDistance: a.distanceTo(endPosition),
    iterations: 1,
    endPosition,
  };
}

/** Solve a resolved editor chain using its mutable target and pole controls. */
export function solveResolvedIkChain(
  chain: ResolvedIkChain,
  options: Omit<TwoBoneIkOptions, 'root' | 'mid' | 'end' | 'effector' | 'target' | 'pole'> = {},
): IkSolveResult {
  return solveTwoBoneIk({
    ...options,
    root: chain.root,
    mid: chain.mid,
    end: chain.end,
    effector: chain.effector,
    target: chain.target,
    pole: chain.pole,
    rootLimit: options.rootLimit ?? chain.rootLimit,
    midLimit: options.midLimit ?? chain.midLimit,
  });
}

function semanticTokens(value: string): Set<string> {
  return new Set(value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean));
}

function fieldScore(value: string | undefined, part: string, side: 'left' | 'right', weight: number): number {
  if (!value) return -1;
  const tokens = semanticTokens(value);
  if (!tokens.has(part) || !tokens.has(side)) return -1;
  return weight;
}

function jointSemanticScore(joint: RigJointDefinition, part: string, side: 'left' | 'right'): number {
  let score = Math.max(
    fieldScore(joint.id, part, side, 12),
    fieldScore(joint.nodeName, part, side, 8),
    fieldScore(joint.name, part, side, 6),
  );
  const tagText = joint.tags?.join(' ');
  score = Math.max(score, fieldScore(tagText, part, side, 10));
  score = Math.max(score, fieldScore(joint.role, part, side, 16));
  score = Math.max(score, fieldScore(joint.aliases?.join(' '), part, side, 14));
  return score;
}

function isDefinitionDescendant(
  childId: JointId,
  ancestorId: JointId,
  byId: ReadonlyMap<JointId, RigJointDefinition>,
): boolean {
  const visited = new Set<JointId>();
  let current: JointId | null | undefined = childId;
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    current = byId.get(current)?.parentId;
  }
  return false;
}

function bestJointTriple(
  definition: Pick<RigDefinition, 'joints'>,
  parts: readonly [string, string, string],
  side: 'left' | 'right',
): readonly [RigJointDefinition, RigJointDefinition, RigJointDefinition] | undefined {
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const candidates = parts.map((part) => definition.joints
    .map((joint) => ({ joint, score: jointSemanticScore(joint, part, side) }))
    .filter((candidate) => candidate.score >= 0));
  let best: { joints: readonly [RigJointDefinition, RigJointDefinition, RigJointDefinition]; score: number } | undefined;
  for (const root of candidates[0]) {
    for (const mid of candidates[1]) {
      if (!isDefinitionDescendant(mid.joint.id, root.joint.id, byId)) continue;
      for (const end of candidates[2]) {
        if (!isDefinitionDescendant(end.joint.id, mid.joint.id, byId)) continue;
        let score = root.score + mid.score + end.score;
        if (mid.joint.parentId === root.joint.id) score += 5;
        if (end.joint.parentId === mid.joint.id) score += 5;
        if (!best || score > best.score) best = { joints: [root.joint, mid.joint, end.joint], score };
      }
    }
  }
  return best?.joints;
}

function jointByIdOrAlias(
  definition: Pick<RigDefinition, 'joints'>,
  id: JointId | undefined,
): RigJointDefinition | undefined {
  if (!id) return undefined;
  return definition.joints.find((joint) => joint.id === id)
    ?? definition.joints.find((joint) => joint.aliases?.includes(id));
}

function mappedJointTriple(
  definition: Pick<RigDefinition, 'joints' | 'humanoid'>,
  roles: readonly [HumanoidJointRole, HumanoidJointRole, HumanoidJointRole],
): readonly [RigJointDefinition, RigJointDefinition, RigJointDefinition] | undefined {
  const byId = new Map(definition.joints.map((joint) => [joint.id, joint]));
  const joints = roles.map((role) => {
    const mappedId = definition.humanoid?.[role];
    return jointByIdOrAlias(definition, mappedId)
      ?? definition.joints.find((joint) => joint.role === role);
  });
  const [root, mid, end] = joints;
  if (!root || !mid || !end
    || !isDefinitionDescendant(mid.id, root.id, byId)
    || !isDefinitionDescendant(end.id, mid.id, byId)) return undefined;
  return [root, mid, end];
}

function socketSemanticScore(
  socket: RigSocketDefinition,
  role: 'grip' | 'foot',
  side: 'left' | 'right',
): number {
  let score = Math.max(
    fieldScore(socket.id, role, side, 12),
    fieldScore(socket.nodeName, role, side, 8),
  );
  score = Math.max(score, fieldScore(socket.tags?.join(' '), role, side, 10));
  return score;
}

function inferEffectorSocket(
  definition: Pick<RigDefinition, 'sockets'>,
  role: 'grip' | 'foot',
  side: 'left' | 'right',
): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const socket of definition.sockets) {
    const score = socketSemanticScore(socket, role, side);
    if (score >= 0 && (!best || score > best.score)) best = { id: socket.id, score };
  }
  return best?.id;
}

function localForwardVector(definition: Pick<RigDefinition, 'coordinateSystem'>): Vec3Tuple {
  const match = /^([+-]?)([xyz])$/i.exec(definition.coordinateSystem.localForward.trim());
  if (!match) return [0, 0, 1];
  const sign = match[1] === '-' ? -1 : 1;
  if (match[2].toLowerCase() === 'x') return [sign, 0, 0];
  if (match[2].toLowerCase() === 'y') return [0, sign, 0];
  return [0, 0, sign];
}

/** Infer left/right arm and leg chains without requiring humanoid engine classes. */
export function inferHumanoidIkChainDefinitions(
  definition: Pick<RigDefinition, 'joints' | 'sockets' | 'coordinateSystem' | 'humanoid'>,
): IkChainDefinition[] {
  const result: IkChainDefinition[] = [];
  const poleDirection = localForwardVector(definition);
  for (const side of ['left', 'right'] as const) {
    const suffix = side === 'left' ? 'Left' : 'Right';
    const arm = mappedJointTriple(definition, [
      `upperArm${suffix}` as HumanoidJointRole,
      `lowerArm${suffix}` as HumanoidJointRole,
      `hand${suffix}` as HumanoidJointRole,
    ]) ?? bestJointTriple(definition, ['shoulder', 'elbow', 'wrist'], side);
    if (arm) {
      const effectorSocketId = inferEffectorSocket(definition, 'grip', side);
      result.push({
        id: `arm.${side}`,
        name: `${side === 'left' ? 'Left' : 'Right'} arm`,
        rootId: arm[0].id,
        midId: arm[1].id,
        endId: arm[2].id,
        kind: 'arm',
        side,
        ...(effectorSocketId ? { effectorSocketId } : {}),
        defaultPoleDirection: [...poleDirection],
      });
    }
    const leg = mappedJointTriple(definition, [
      `upperLeg${suffix}` as HumanoidJointRole,
      `lowerLeg${suffix}` as HumanoidJointRole,
      `foot${suffix}` as HumanoidJointRole,
    ]) ?? bestJointTriple(definition, ['hip', 'knee', 'ankle'], side);
    if (leg) {
      const effectorSocketId = inferEffectorSocket(definition, 'foot', side);
      result.push({
        id: `leg.${side}`,
        name: `${side === 'left' ? 'Left' : 'Right'} leg`,
        rootId: leg[0].id,
        midId: leg[1].id,
        endId: leg[2].id,
        kind: 'leg',
        side,
        ...(effectorSocketId ? { effectorSocketId } : {}),
        defaultPoleDirection: [...poleDirection],
      });
    }
  }
  return result;
}

function defaultPoleForChain(
  definition: IkChainDefinition,
  rig: IkRigBindingLike,
  root: THREE.Object3D,
  mid: THREE.Object3D,
  effector: THREE.Object3D,
): THREE.Vector3 {
  refreshHierarchy(rig.root);
  const rootPosition = new THREE.Vector3();
  const midPosition = new THREE.Vector3();
  const endPosition = new THREE.Vector3();
  root.getWorldPosition(rootPosition);
  mid.getWorldPosition(midPosition);
  effector.getWorldPosition(endPosition);
  const reach = Math.max(rootPosition.distanceTo(midPosition) + midPosition.distanceTo(endPosition), 1);
  const localDirection = new THREE.Vector3();
  if (!readVector(definition.defaultPoleDirection ?? localForwardVector(rig.definition), localDirection)
    || localDirection.lengthSq() <= EPSILON * EPSILON) localDirection.set(0, 0, 1);
  localDirection.transformDirection(rig.root.matrixWorld).normalize();
  return rootPosition.addScaledVector(localDirection, reach);
}

/** Resolve one declared generic chain against live Object3D nodes. */
export function resolveIkChain(
  definition: IkChainDefinition,
  rig: IkRigBindingLike,
  options: ResolveIkChainOptions = {},
): ResolvedIkChain | undefined {
  const boundJoint = (id: JointId): THREE.Object3D | undefined => {
    const direct = rig.getJoint?.(id) ?? rig.joints.get(id);
    if (direct) return direct;
    const canonical = rig.definition.joints.find((joint) => joint.aliases?.includes(id))?.id;
    return canonical ? rig.joints.get(canonical) : undefined;
  };
  const root = boundJoint(definition.rootId);
  const mid = boundJoint(definition.midId);
  const end = boundJoint(definition.endId);
  if (!root || !mid || !end || !isDescendant(mid, root) || !isDescendant(end, mid)) return undefined;

  const effectorSocket = definition.effectorSocketId
    ? rig.sockets?.get(definition.effectorSocketId)
    : undefined;
  const effector = effectorSocket && isDescendant(effectorSocket, mid) ? effectorSocket : end;
  refreshHierarchy(rig.root);
  const target = new THREE.Vector3();
  if (!options.target || !readVector(options.target, target)) effector.getWorldPosition(target);
  const pole = new THREE.Vector3();
  if (!options.pole || !readVector(options.pole, pole)) {
    pole.copy(defaultPoleForChain(definition, rig, root, mid, effector));
  }
  return {
    ...definition,
    root,
    mid,
    end,
    effector,
    ...(effectorSocket ? { effectorSocket } : {}),
    target,
    pole,
  };
}

export function resolveIkChains(
  definitions: readonly IkChainDefinition[],
  rig: IkRigBindingLike,
): ResolvedIkChain[] {
  const resolved: ResolvedIkChain[] = [];
  for (const definition of definitions) {
    const chain = resolveIkChain(definition, rig);
    if (chain) resolved.push(chain);
  }
  return resolved;
}

/** Infer and resolve the standard player chains in one call for Animation Studio. */
export function inferHumanoidIkChains(rig: IkRigBindingLike): ResolvedIkChain[] {
  return resolveIkChains(inferHumanoidIkChainDefinitions(rig.definition), rig);
}

export function captureIkChainTransforms(chain: ResolvedIkChain): IkLocalTransformSnapshot[] {
  const nodes = chain.end === chain.effector
    ? [chain.root, chain.mid, chain.end]
    : [chain.root, chain.mid, chain.end, chain.effector];
  return nodes.map((node) => ({
    node,
    position: node.position.clone(),
    quaternion: node.quaternion.clone(),
    scale: node.scale.clone(),
  }));
}

/** Restore captured locals. Invalid snapshots are skipped rather than poisoning a hierarchy. */
export function restoreIkChainTransforms(snapshots: readonly IkLocalTransformSnapshot[]): boolean {
  let restored = true;
  const roots = new Set<THREE.Object3D>();
  for (const snapshot of snapshots) {
    if (!finiteVector(snapshot.position) || !finiteQuaternion(snapshot.quaternion)
      || !finiteVector(snapshot.scale)) {
      restored = false;
      continue;
    }
    snapshot.node.position.copy(snapshot.position);
    snapshot.node.quaternion.copy(snapshot.quaternion).normalize();
    snapshot.node.scale.copy(snapshot.scale);
    roots.add(snapshot.node);
  }
  for (const node of roots) node.updateWorldMatrix(true, true);
  return restored;
}
