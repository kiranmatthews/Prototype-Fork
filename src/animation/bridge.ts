import * as THREE from 'three';
import {
  applyResolvedStretchableBoneLength,
  directStretchableBones,
  stretchableBoneShaftLengthRatio,
  stretchableBoneVolumeMorphInfluence,
} from '../character/stretchableBone';
import { meshyTorsoLengthRatio } from '../character/meshyTorso';

export type RigVector3 = readonly [number, number, number];
export type RigQuaternion = readonly [number, number, number, number];

export interface RigLocalTransform {
  readonly position: RigVector3;
  readonly quaternion: RigQuaternion;
  readonly scale: RigVector3;
  readonly rotationOrder: THREE.EulerOrder;
}

export interface PlayerRigJoint {
  /** Stable animation-track target. This is semantic, never an Object3D uuid. */
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly mirrorId: string | null;
  readonly node: THREE.Object3D;
  readonly rest: RigLocalTransform;
}

export interface IndependentSegmentDeformation {
  /** Stable scalar-track target. A value of 1 is the undeformed segment. */
  readonly controlId: string;
  /** Joint that anchors the segment. Its own scale is deliberately untouched. */
  readonly jointId: string;
  /** Joints moved to the stretched segment endpoint(s), without inheriting scale. */
  readonly downstreamJointIds: readonly string[];
  /** Length axis expressed in the segment joint's local space. */
  readonly lengthAxis: RigVector3;
  readonly min: number;
  readonly max: number;
  readonly volume: 'preserve-cross-section-area' | 'none';
}

export interface PlayerAnimationRig {
  readonly schemaVersion: number;
  readonly rigId: string;
  readonly rigName: string;
  /** Root accepted by the shared RigBinding / Animation Studio. */
  readonly root: THREE.Group;
  readonly joints: readonly PlayerRigJoint[];
  readonly jointsById: ReadonlyMap<string, PlayerRigJoint>;
  readonly deformations: readonly IndependentSegmentDeformation[];
}

export interface PlayerAnimationOverlayContext {
  readonly rig: PlayerAnimationRig;
  readonly deltaSeconds: number;
  /**
   * Apply all independent length controls in one absolute pass. Missing controls
   * resolve to 1, which also clears a deformation authored on the prior frame.
   */
  applyDeformations(values: Readonly<Record<string, number>>): void;
}

export type PlayerAnimationOverlay = (context: PlayerAnimationOverlayContext) => void;

interface RuntimeRestTransform {
  position?: unknown;
  quaternion?: unknown;
  scale?: unknown;
  rotationOrder?: unknown;
}

interface SculptRuntimeMetadata {
  schemaVersion?: unknown;
  rigId?: unknown;
  rigName?: unknown;
  joints?: unknown;
  restPose?: unknown;
  mirrorPairs?: unknown;
  deformations?: unknown;
}

interface MutableTransformSnapshot {
  readonly object: THREE.Object3D;
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale: THREE.Vector3;
  readonly visible: boolean;
}

interface AppliedDeformationState {
  readonly object: THREE.Object3D;
  readonly basePosition: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  readonly deformedPosition: THREE.Vector3;
  readonly deformedScale: THREE.Vector3;
  readonly movesPosition: boolean;
  readonly movesScale: boolean;
  readonly morphs: Array<{
    readonly index: number;
    readonly base: number;
    deformed: number;
  }>;
}

const EPSILON_SQ = 1e-14;

function tuple3(value: unknown, fallback: THREE.Vector3): RigVector3 {
  if (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.slice(0, 3).every((component) => Number.isFinite(component))
  ) {
    return [Number(value[0]), Number(value[1]), Number(value[2])];
  }
  return [fallback.x, fallback.y, fallback.z];
}

function tuple4(value: unknown, fallback: THREE.Quaternion): RigQuaternion {
  if (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.slice(0, 4).every((component) => Number.isFinite(component))
  ) {
    return [Number(value[0]), Number(value[1]), Number(value[2]), Number(value[3])];
  }
  return [fallback.x, fallback.y, fallback.z, fallback.w];
}

function captureHierarchy(
  root: THREE.Object3D,
  reusable: MutableTransformSnapshot[] = [],
): MutableTransformSnapshot[] {
  let index = 0;
  root.traverse((object) => {
    const existing = reusable[index];
    if (existing?.object === object) {
      existing.position.copy(object.position);
      existing.quaternion.copy(object.quaternion);
      existing.scale.copy(object.scale);
      // Visibility is readonly on the snapshot's shape so callers cannot
      // rewrite it accidentally; replace this one cheap record on an edge.
      if (existing.visible !== object.visible) {
        reusable[index] = { ...existing, visible: object.visible };
      }
    } else {
      // Hierarchy replacement (for example a procedural rebuild) makes
      // every later traversal slot suspect. Rebuild only from this point.
      reusable.length = index;
      reusable.push({
        object,
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
        visible: object.visible,
      });
    }
    index++;
  });
  reusable.length = index;
  return reusable;
}

function restoreHierarchy(snapshots: readonly MutableTransformSnapshot[]): void {
  for (const snapshot of snapshots) {
    snapshot.object.position.copy(snapshot.position);
    snapshot.object.quaternion.copy(snapshot.quaternion);
    snapshot.object.scale.copy(snapshot.scale);
    snapshot.object.visible = snapshot.visible;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDeformation(value: unknown): IndependentSegmentDeformation | null {
  if (!isRecord(value)) return null;
  const controlId = typeof value.controlId === 'string' ? value.controlId : '';
  const jointId = typeof value.jointId === 'string' ? value.jointId : '';
  const downstreamJointIds = Array.isArray(value.downstreamJointIds)
    ? value.downstreamJointIds.filter((item): item is string => typeof item === 'string')
    : [];
  const axis = tuple3(value.lengthAxis, new THREE.Vector3(0, 1, 0));
  const axisLength = Math.hypot(axis[0], axis[1], axis[2]);
  if (!controlId || !jointId || axisLength < 1e-6) return null;
  const min = Number(value.min);
  const max = Number(value.max);
  return {
    controlId,
    jointId,
    downstreamJointIds,
    lengthAxis: [axis[0] / axisLength, axis[1] / axisLength, axis[2] / axisLength],
    min: Number.isFinite(min) ? Math.max(0.05, min) : 0.55,
    max: Number.isFinite(max) ? Math.max(Number.isFinite(min) ? min : 0.55, max) : 1.75,
    volume:
      value.volume === 'none' ? 'none' : 'preserve-cross-section-area',
  };
}

/** Resolve serializable sculpt metadata into live, semantically addressed nodes. */
export function resolvePlayerAnimationRig(root: THREE.Group): PlayerAnimationRig {
  const runtime = (root.userData.sculptRuntime ?? {}) as SculptRuntimeMetadata;
  const declaredJoints = isRecord(runtime.joints) ? runtime.joints : {};
  const declaredRest = isRecord(runtime.restPose) ? runtime.restPose : {};
  const mirrorById = new Map<string, string>();
  if (Array.isArray(runtime.mirrorPairs)) {
    for (const pair of runtime.mirrorPairs) {
      if (
        Array.isArray(pair) &&
        pair.length >= 2 &&
        typeof pair[0] === 'string' &&
        typeof pair[1] === 'string'
      ) {
        mirrorById.set(pair[0], pair[1]);
        mirrorById.set(pair[1], pair[0]);
      }
    }
  }

  const liveById = new Map<string, THREE.Object3D>();
  for (const [id, declaredName] of Object.entries(declaredJoints)) {
    if (typeof declaredName !== 'string') continue;
    const node = root.getObjectByName(declaredName);
    if (node) liveById.set(id, node);
  }
  const idByNode = new Map<THREE.Object3D, string>();
  for (const [id, node] of liveById) idByNode.set(node, id);

  const joints: PlayerRigJoint[] = [];
  for (const [id, node] of liveById) {
    let parent = node.parent;
    let parentId: string | null = null;
    while (parent && parent !== root.parent) {
      const semanticParent = idByNode.get(parent);
      if (semanticParent) {
        parentId = semanticParent;
        break;
      }
      parent = parent.parent;
    }
    const rawRest = isRecord(declaredRest[id])
      ? (declaredRest[id] as RuntimeRestTransform)
      : {};
    const rotationOrder =
      typeof rawRest.rotationOrder === 'string'
        ? (rawRest.rotationOrder as THREE.EulerOrder)
        : node.rotation.order;
    joints.push({
      id,
      name: node.name,
      parentId,
      mirrorId: mirrorById.get(id) ?? null,
      node,
      rest: {
        position: tuple3(rawRest.position, node.position),
        quaternion: tuple4(rawRest.quaternion, node.quaternion),
        scale: tuple3(rawRest.scale, node.scale),
        rotationOrder,
      },
    });
  }
  const jointsById = new Map(joints.map((joint) => [joint.id, joint]));
  const deformations = (Array.isArray(runtime.deformations)
    ? runtime.deformations.map(parseDeformation).filter((item): item is IndependentSegmentDeformation => item !== null)
    : []
  ).filter(
    (policy) =>
      jointsById.has(policy.jointId) &&
      policy.downstreamJointIds.every((id) => jointsById.has(id)),
  );
  return {
    schemaVersion: Number.isFinite(runtime.schemaVersion) ? Number(runtime.schemaVersion) : 1,
    rigId: typeof runtime.rigId === 'string' ? runtime.rigId : 'player.procedural',
    rigName: typeof runtime.rigName === 'string' ? runtime.rigName : 'Procedural Rider',
    root,
    joints,
    jointsById,
    deformations,
  };
}

function captureDeformedMorphs(state: AppliedDeformationState): void {
  const influences = (state.object as THREE.Mesh).morphTargetInfluences;
  if (!influences) return;
  for (const morph of state.morphs) morph.deformed = influences[morph.index];
}

function renderableDirectChildren(node: THREE.Object3D): THREE.Object3D[] {
  return node.children.filter((child) => {
    const drawable = child as THREE.Object3D & {
      isMesh?: boolean;
      isLine?: boolean;
      isPoints?: boolean;
      isSprite?: boolean;
    };
    return Boolean(drawable.isMesh || drawable.isLine || drawable.isPoints || drawable.isSprite);
  });
}

/**
 * Owns the mutation boundary between the legacy procedural pose and authored
 * animation. It intentionally knows nothing about clips or the editor UI.
 */
export class PlayerAnimationBridge {
  private previewSnapshot: MutableTransformSnapshot[] | null = null;
  private readonly overlayBaseline: MutableTransformSnapshot[] = [];
  private overlayBaselineApplied = false;
  private overlay: PlayerAnimationOverlay | null = null;
  private deformationStates: AppliedDeformationState[] = [];

  constructor(
    private readonly playerRoot: THREE.Group,
    private readonly rigRoot: THREE.Group,
  ) {}

  get previewActive(): boolean {
    return this.previewSnapshot !== null;
  }

  get rig(): PlayerAnimationRig {
    return resolvePlayerAnimationRig(this.rigRoot);
  }

  /** Snapshot the authoritative, non-interpolated pose exactly once. */
  enterPreview(): PlayerAnimationRig {
    this.restoreOverlayBaseline();
    if (!this.previewSnapshot) this.previewSnapshot = captureHierarchy(this.playerRoot);
    return this.rig;
  }

  /** Return to the pose captured on preview entry while keeping preview open. */
  resetPreview(): void {
    if (!this.previewSnapshot) return;
    this.restoreDeformationStates(true);
    restoreHierarchy(this.previewSnapshot);
  }

  /** Restore the captured pose before relinquishing editor ownership. */
  exitPreview(): void {
    if (!this.previewSnapshot) return;
    this.restoreDeformationStates(true);
    restoreHierarchy(this.previewSnapshot);
    this.previewSnapshot = null;
  }

  setOverlay(overlay: PlayerAnimationOverlay | null): () => void {
    if (this.overlay === overlay) return () => {};
    this.restoreOverlayBaseline();
    this.overlay = overlay;
    return () => {
      if (this.overlay !== overlay) return;
      this.restoreOverlayBaseline();
      this.overlay = null;
    };
  }

  /** Remove authored writes before legacy code calculates its next pose. */
  prepareLegacyPose(): void {
    this.restoreOverlayBaseline();
    // Preview normally pauses simulation. If an integration forgets to do so,
    // fail closed: return to the captured authoritative pose before gameplay
    // gets a chance to observe or accumulate an editor-authored transform.
    if (this.previewSnapshot) {
      this.restoreDeformationStates(true);
      restoreHierarchy(this.previewSnapshot);
    }
  }

  /** Run exactly once after all current syncVisual pose writes. */
  applyOverlay(deltaSeconds: number): void {
    if (!this.overlay || this.previewActive) return;
    captureHierarchy(this.playerRoot, this.overlayBaseline);
    this.overlayBaselineApplied = true;
    try {
      this.overlay({
        rig: this.rig,
        deltaSeconds,
        applyDeformations: (values) => this.applyDeformations(values),
      });
    } catch (error) {
      this.restoreOverlayBaseline();
      throw error;
    }
  }

  /**
   * Stretch each segment independently: visual children scale around their
   * anchor, endpoint joints translate, and no joint inherits non-uniform scale.
   */
  applyDeformations(values: Readonly<Record<string, number>>): void {
    // If the animation sampler has not rewritten an endpoint since the last
    // pass, undo our prior endpoint translation. If it has, that new pose is
    // the baseline and must not be replaced with stale data.
    this.restoreDeformationStates();

    const rig = this.rig;
    const visualStates = new Map<THREE.Object3D, AppliedDeformationState>();
    const endpointStates = new Map<THREE.Object3D, AppliedDeformationState>();
    const axis = new THREE.Vector3();
    const offset = new THREE.Vector3();
    const stateFor = (
      map: Map<THREE.Object3D, AppliedDeformationState>,
      object: THREE.Object3D,
      movesScale: boolean,
      morphIndices: readonly number[] = [],
    ): AppliedDeformationState => {
      let state = map.get(object);
      if (!state) {
        state = {
          object,
          basePosition: object.position.clone(),
          baseScale: object.scale.clone(),
          deformedPosition: object.position.clone(),
          deformedScale: object.scale.clone(),
          movesPosition: true,
          movesScale,
          morphs: [],
        };
        map.set(object, state);
      }
      const influences = (object as THREE.Mesh).morphTargetInfluences;
      for (const index of morphIndices) {
        if (!influences || index < 0 || index >= influences.length) continue;
        if (state.morphs.some((morph) => morph.index === index)) continue;
        state.morphs.push({ index, base: influences[index], deformed: influences[index] });
      }
      return state;
    };

    for (const policy of rig.deformations) {
      const raw = values[policy.controlId] ?? 1;
      const lengthScale = THREE.MathUtils.clamp(
        Number.isFinite(raw) ? raw : 1,
        policy.min,
        policy.max,
      );
      if (Math.abs(lengthScale - 1) <= 1e-8) continue;
      axis.fromArray(policy.lengthAxis as [number, number, number]).normalize();
      const proceduralTransverse =
        policy.volume === 'preserve-cross-section-area'
          ? 1 / Math.sqrt(lengthScale)
          : 1;
      const anchor = rig.jointsById.get(policy.jointId)?.node;
      if (!anchor) continue;

      // A stretchable cartoon bone is one semantic visual component nested
      // below the existing rig joint. Only its shaft scales. The distal
      // knobble/socket translate to the new endpoint while both knobbles keep
      // their local scale and shape exactly unchanged.
      for (const component of directStretchableBones(anchor)) {
        const shaft = stateFor(
          visualStates,
          component.shaft,
          true,
          component.metadata.surface !== 'procedural' ? [0] : [],
        );
        if (component.metadata.surface !== 'procedural') {
          const distalRigid = component.distalKnob
            ? stateFor(visualStates, component.distalKnob, false)
            : null;
          const distalSocket = stateFor(visualStates, component.distalSocket, false);
          applyResolvedStretchableBoneLength(component, lengthScale);
          const shaftLongitudinalRatio = stretchableBoneShaftLengthRatio(
            component,
            1,
            lengthScale,
          );
          const shaftTransverse = policy.volume === 'preserve-cross-section-area'
            ? stretchableBoneVolumeMorphInfluence(component, shaftLongitudinalRatio) + 1
            : 1;
          const influences = (component.shaft as THREE.Mesh).morphTargetInfluences;
          if (influences?.length) influences[0] = shaftTransverse - 1;
          component.shaft.scale.x = shaft.baseScale.x;
          component.shaft.scale.z = shaft.baseScale.z;
          shaft.deformedPosition.copy(component.shaft.position);
          shaft.deformedScale.copy(component.shaft.scale);
          captureDeformedMorphs(shaft);
          if (distalRigid && component.distalKnob) {
            distalRigid.deformedPosition.copy(component.distalKnob.position);
            distalRigid.deformedScale.copy(component.distalKnob.scale);
          }
          distalSocket.deformedPosition.copy(component.distalSocket.position);
          distalSocket.deformedScale.copy(component.distalSocket.scale);
          continue;
        }
        offset.copy(shaft.basePosition);
        const projection = offset.dot(axis);
        component.shaft.position.copy(shaft.basePosition).addScaledVector(
          axis,
          projection * (lengthScale - 1),
        );
        component.shaft.scale.copy(shaft.baseScale);
        component.shaft.scale.x *=
          Math.abs(axis.x) * lengthScale + (1 - Math.abs(axis.x)) * proceduralTransverse;
        component.shaft.scale.y *=
          Math.abs(axis.y) * lengthScale + (1 - Math.abs(axis.y)) * proceduralTransverse;
        component.shaft.scale.z *=
          Math.abs(axis.z) * lengthScale + (1 - Math.abs(axis.z)) * proceduralTransverse;
        shaft.deformedPosition.copy(component.shaft.position);
        shaft.deformedScale.copy(component.shaft.scale);

        for (const follower of [component.distalKnob, component.distalSocket]) {
          if (!follower) continue;
          const state = stateFor(visualStates, follower, false);
          offset.copy(state.basePosition);
          const followerProjection = offset.dot(axis);
          follower.position.copy(state.basePosition).addScaledVector(
            axis,
            followerProjection * (lengthScale - 1),
          );
          state.deformedPosition.copy(follower.position);
        }
      }

      for (const visual of renderableDirectChildren(anchor)) {
        const state = stateFor(visualStates, visual, true);
        offset.copy(state.basePosition);
        const projection = offset.dot(axis);
        visual.position.copy(state.basePosition).addScaledVector(
          axis,
          projection * (lengthScale - 1),
        );
        visual.scale.copy(state.baseScale);
        visual.scale.x *=
          Math.abs(axis.x) * lengthScale + (1 - Math.abs(axis.x)) * proceduralTransverse;
        visual.scale.y *=
          Math.abs(axis.y) * lengthScale + (1 - Math.abs(axis.y)) * proceduralTransverse;
        visual.scale.z *=
          Math.abs(axis.z) * lengthScale + (1 - Math.abs(axis.z)) * proceduralTransverse;
        state.deformedPosition.copy(visual.position);
        state.deformedScale.copy(visual.scale);
      }

      for (const endpointId of policy.downstreamJointIds) {
        const endpoint = rig.jointsById.get(endpointId)?.node;
        if (!endpoint || endpoint.parent !== anchor) continue;
        const state = stateFor(endpointStates, endpoint, false);
        offset.copy(state.basePosition);
        const projection = offset.dot(axis);
        endpoint.position.copy(state.basePosition).addScaledVector(
          axis,
          projection * (lengthScale - 1),
        );
        state.deformedPosition.copy(endpoint.position);
      }
    }

    // The imported torso is skinned to torsoRoot/spine/chest/neck, so moved
    // semantic bones provide its longitudinal deformation. Apply only the
    // matching cross-section correction here; scaling Y would double-stretch
    // the skin and scaling a joint would contaminate every descendant.
    const torso = rig.root.getObjectByName('meshy-torso-surface');
    const torsoPolicy = rig.deformations.find(
      (policy) => policy.controlId === 'deform.torso.length',
    );
    if (torso && torsoPolicy) {
      const raw = values[torsoPolicy.controlId] ?? 1;
      const endpointScale = THREE.MathUtils.clamp(
        Number.isFinite(raw) ? raw : 1,
        torsoPolicy.min,
        torsoPolicy.max,
      );
      if (Math.abs(endpointScale - 1) > 1e-8) {
        const state = stateFor(visualStates, torso, false, [0, 1]);
        const transverse = torsoPolicy.volume === 'preserve-cross-section-area'
          ? 1 / Math.sqrt(meshyTorsoLengthRatio(endpointScale))
          : 1;
        const influences = (torso as THREE.Mesh).morphTargetInfluences;
        if (influences?.length && influences.length >= 2) {
          influences[0] = transverse - 1;
          influences[1] = transverse - 1;
        }
        state.deformedPosition.copy(torso.position);
        state.deformedScale.copy(torso.scale);
        captureDeformedMorphs(state);
      }
    }
    this.deformationStates = [...visualStates.values(), ...endpointStates.values()];
  }

  private restoreOverlayBaseline(): void {
    this.restoreDeformationStates(true);
    if (this.overlayBaselineApplied) restoreHierarchy(this.overlayBaseline);
    this.overlayBaselineApplied = false;
  }

  private restoreDeformationStates(force = false): void {
    for (const state of this.deformationStates) {
      if (
        state.movesPosition &&
        (force || state.object.position.distanceToSquared(state.deformedPosition) <= EPSILON_SQ)
      ) state.object.position.copy(state.basePosition);
      if (
        state.movesScale &&
        (force || state.object.scale.distanceToSquared(state.deformedScale) <= EPSILON_SQ)
      ) state.object.scale.copy(state.baseScale);
      const influences = (state.object as THREE.Mesh).morphTargetInfluences;
      if (influences) {
        for (const morph of state.morphs) {
          if (force || Math.abs(influences[morph.index] - morph.deformed) <= 1e-10) {
            influences[morph.index] = morph.base;
          }
        }
      }
    }
    this.deformationStates = [];
  }
}
