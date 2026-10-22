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
  /** Resolved on first access and retained for this callback. */
  readonly rig: PlayerAnimationRig;
  readonly deltaSeconds: number;
  /**
   * Apply all independent length controls in one absolute pass. Missing controls
   * resolve to 1, which also clears a deformation authored on the prior frame.
   * A final write may opt into deferral until Player finishes secondary joint
   * posing. Ordinary callbacks retain immediate endpoint updates by default.
   */
  applyDeformations(values: Readonly<Record<string, number>>, deferUntilSecondaryPose?: boolean): void;
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
  px: number; py: number; pz: number;
  qx: number; qy: number; qz: number; qw: number;
  sx: number; sy: number; sz: number;
  visible: boolean;
  quaternionRestored: boolean;
  rx: number; ry: number; rz: number;
  restoredOrder: THREE.EulerOrder;
}

interface AppliedDeformationState {
  readonly object: THREE.Object3D;
  readonly basePosition: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  readonly deformedPosition: THREE.Vector3;
  readonly deformedScale: THREE.Vector3;
  readonly movesPosition: boolean;
  movesScale: boolean;
  morphCount: number;
  readonly morphs: Array<{
    index: number;
    base: number;
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
    let snapshot = reusable[index];
    const p = object.position, q = object.quaternion, s = object.scale;
    if (snapshot?.object !== object) {
      // Hierarchy replacement (for example a procedural rebuild) makes
      // every later traversal slot suspect. Rebuild only from this point.
      reusable.length = index;
      snapshot = { object, px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1,
        sx: 1, sy: 1, sz: 1, visible: true, quaternionRestored: false,
        rx: 0, ry: 0, rz: 0, restoredOrder: object.rotation.order };
      reusable.push(snapshot);
    } else if (snapshot.quaternionRestored) {
      // A cached Euler result is valid only for this exact captured quaternion.
      // Object.is also preserves signed zero when a live edit changes it.
      snapshot.quaternionRestored = Object.is(snapshot.qx, q.x) && Object.is(snapshot.qy, q.y) &&
        Object.is(snapshot.qz, q.z) && Object.is(snapshot.qw, q.w);
    }
    snapshot.px = p.x; snapshot.py = p.y; snapshot.pz = p.z;
    snapshot.qx = q.x; snapshot.qy = q.y; snapshot.qz = q.z; snapshot.qw = q.w;
    snapshot.sx = s.x; snapshot.sy = s.y; snapshot.sz = s.z;
    snapshot.visible = object.visible;
    index++;
  });
  reusable.length = index;
  return reusable;
}

function restoreHierarchy(snapshots: readonly MutableTransformSnapshot[]): void {
  for (const snapshot of snapshots) {
    const object = snapshot.object, q = object.quaternion, r = object.rotation;
    object.position.set(snapshot.px, snapshot.py, snapshot.pz);
    // Quaternion writes invoke Three.js's matrix-to-Euler conversion. Most
    // descendants were never posed by the overlay. Reuse a previously observed
    // canonical result only when quaternion, Euler values AND order still match;
    // equivalent rotations with a different Euler winding must still restore.
    if (!snapshot.quaternionRestored || !Object.is(q.x, snapshot.qx) || !Object.is(q.y, snapshot.qy) ||
      !Object.is(q.z, snapshot.qz) || !Object.is(q.w, snapshot.qw) ||
      !Object.is(r.x, snapshot.rx) || !Object.is(r.y, snapshot.ry) || !Object.is(r.z, snapshot.rz) ||
      r.order !== snapshot.restoredOrder) {
      q.set(snapshot.qx, snapshot.qy, snapshot.qz, snapshot.qw);
      snapshot.rx = r.x; snapshot.ry = r.y; snapshot.rz = r.z;
      snapshot.restoredOrder = r.order; snapshot.quaternionRestored = true;
    }
    object.scale.set(snapshot.sx, snapshot.sy, snapshot.sz);
    object.visible = snapshot.visible;
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

class RigNodeLookup {
  readonly byName = new Map<string, THREE.Object3D>();
  readonly byId = new Map<string, THREE.Object3D>();
  private readonly requested = new Set<string>();
  private readonly collect = (node: THREE.Object3D): void => {
    if (this.requested.has(node.name) && !this.byName.has(node.name))
      this.byName.set(node.name, node);
  };

  clear(): void {
    this.byName.clear(); this.byId.clear(); this.requested.clear();
  }

  resolve(root: THREE.Group, declaredJoints: Record<string, unknown>): Map<string, THREE.Object3D> {
    this.clear();
    const ids = Object.keys(declaredJoints);
    for (const id of ids) {
      const name = declaredJoints[id];
      if (typeof name === 'string') this.requested.add(name);
    }
    // Resolve the torso surface in the same live pass as its semantic bones.
    // Reuse storage, never old answers: edits, late parts and duplicate-name
    // depth-first ordering must still be visible on every deformation pass.
    this.requested.add('meshy-torso-surface');
    root.traverse(this.collect);
    for (const id of ids) {
      const name = declaredJoints[id];
      if (typeof name !== 'string') continue;
      const node = this.byName.get(name);
      if (node) this.byId.set(id, node);
    }
    return this.byId;
  }
}

function resolveRigJointNodes(root: THREE.Group, declaredJoints: Record<string, unknown>): Map<string, THREE.Object3D> {
  return new RigNodeLookup().resolve(root, declaredJoints);
}

function resolveRigDeformations(
  value: unknown,
  joints: ReadonlyMap<string, THREE.Object3D>,
): IndependentSegmentDeformation[] {
  return (Array.isArray(value)
    ? value.map(parseDeformation).filter((item): item is IndependentSegmentDeformation => item !== null)
    : []
  ).filter(
    (policy) => joints.has(policy.jointId) && policy.downstreamJointIds.every((id) => joints.has(id)),
  );
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
  const liveById = resolveRigJointNodes(root, declaredJoints);
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
  const deformations = resolveRigDeformations(runtime.deformations, liveById);
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
  for (let i = 0; i < state.morphCount; i++) {
    const morph = state.morphs[i]; morph.deformed = influences[morph.index];
  }
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
  private previewDeformationValues: Readonly<Record<string, number>> | null = null;
  private readonly overlayBaseline: MutableTransformSnapshot[] = [];
  private overlayBaselineApplied = false;
  private overlay: PlayerAnimationOverlay | null = null;
  private readonly deformationStates: AppliedDeformationState[] = [];
  private readonly visualDeformations = new Map<THREE.Object3D, AppliedDeformationState>();
  private readonly endpointDeformations = new Map<THREE.Object3D, AppliedDeformationState>();
  private readonly visualDeformationCache = new WeakMap<THREE.Object3D, AppliedDeformationState>();
  private readonly endpointDeformationCache = new WeakMap<THREE.Object3D, AppliedDeformationState>();
  private readonly deformationAxis = new THREE.Vector3();
  private readonly deformationOffset = new THREE.Vector3();
  private readonly deformationLookup = new RigNodeLookup();
  private deformationValues: Readonly<Record<string, number>> = {};
  private deformationBatch = false;
  private deformationPending = false;

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
    if (!this.previewSnapshot) {
      this.previewSnapshot = captureHierarchy(this.playerRoot);
      this.previewDeformationValues = { ...this.deformationValues };
    }
    return this.rig;
  }

  /** Return to the pose captured on preview entry while keeping preview open. */
  resetPreview(): void {
    if (!this.previewSnapshot) return;
    this.restoreDeformationStates(true);
    restoreHierarchy(this.previewSnapshot);
    this.deformationValues = { ...this.previewDeformationValues };
  }

  /** Restore the captured pose before relinquishing editor ownership. */
  exitPreview(): void {
    if (!this.previewSnapshot) return;
    this.restoreDeformationStates(true);
    restoreHierarchy(this.previewSnapshot);
    this.deformationValues = { ...this.previewDeformationValues };
    this.previewSnapshot = null;
    this.previewDeformationValues = null;
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
  applyOverlay(deltaSeconds: number, allowDeferredDeformations = false): void {
    if (!this.overlay || this.previewActive) return;
    captureHierarchy(this.playerRoot, this.overlayBaseline);
    this.overlayBaselineApplied = true;
    try {
      const bridge = this;
      let rig: PlayerAnimationRig | undefined;
      this.overlay({
        // Most runtime samplers already own their binding. Build the public
        // snapshot only if an overlay requests it, once for that callback.
        get rig() { return rig ??= bridge.rig; },
        deltaSeconds,
        applyDeformations: (values, deferUntilSecondaryPose) => {
          if (allowDeferredDeformations && deferUntilSecondaryPose) this.beginDeformationBatch();
          this.applyDeformations(values);
        },
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
    if (this.deformationBatch) {
      // Batch only a pose section that does not read deformed endpoints.
      // Keep absolute replacement semantics; later multiplicative layers
      // compose onto these values without reskinning each intermediate pose.
      if (values !== this.deformationValues) this.deformationValues = { ...values };
      this.deformationPending = true;
      return;
    }
    // If the animation sampler has not rewritten an endpoint since the last
    // pass, undo our prior endpoint translation. If it has, that new pose is
    // the baseline and must not be replaced with stale data.
    this.restoreDeformationStates();
    // A completed batch or modulation already owns its values. Public input
    // still gets a defensive copy; internal composition need not copy twice.
    if (values !== this.deformationValues) this.deformationValues = { ...values };

    // Elastic modifiers need live nodes and length policies, not the full
    // authoring snapshot (rest tuples, mirror links and semantic parents).
    // Resolve afresh so editor changes and late-loaded parts remain visible.
    const runtime = (this.rigRoot.userData.sculptRuntime ?? {}) as SculptRuntimeMetadata;
    const joints = this.deformationLookup.resolve(this.rigRoot, isRecord(runtime.joints) ? runtime.joints : {});
    const deformations = resolveRigDeformations(runtime.deformations, joints);
    const visualStates = this.visualDeformations, endpointStates = this.endpointDeformations;
    const axis = this.deformationAxis, offset = this.deformationOffset;
    const stateFor = (
      map: Map<THREE.Object3D, AppliedDeformationState>,
      object: THREE.Object3D,
      movesScale: boolean,
      morphIndices: readonly number[] = [],
    ): AppliedDeformationState => {
      let state = map.get(object);
      if (!state) {
        // Keep storage with the live node, not a traversal slot or old name.
        // Visuals/endpoints have separate baselines even if a node fills both
        // roles. Refresh every value after restoring the preceding layer.
        const cache = map === visualStates ? this.visualDeformationCache : this.endpointDeformationCache;
        state = cache.get(object);
        if (!state) {
          state = { object, basePosition:new THREE.Vector3(), baseScale:new THREE.Vector3(),
            deformedPosition:new THREE.Vector3(), deformedScale:new THREE.Vector3(),
            movesPosition:true, movesScale, morphs:[], morphCount:0 };
          cache.set(object, state);
        }
        state.basePosition.copy(object.position); state.baseScale.copy(object.scale);
        // Each caller captures the result after writing its transform; the
        // previous result is unused until then, so do not copy it twice.
        state.movesScale = movesScale; state.morphCount = 0;
        map.set(object, state);
      }
      const influences = (object as THREE.Mesh).morphTargetInfluences;
      for (const index of morphIndices) {
        if (!influences || index < 0 || index >= influences.length) continue;
        let existing = false;
        for (let i = 0; i < state.morphCount; i++) if (state.morphs[i].index === index) { existing = true; break; }
        if (existing) continue;
        let morph = state.morphs[state.morphCount++];
        if (!morph) state.morphs.push(morph = { index, base:0, deformed:0 });
        morph.index = index; morph.base = morph.deformed = influences[index];
      }
      return state;
    };

    for (const policy of deformations) {
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
      const anchor = joints.get(policy.jointId);
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
        const endpoint = joints.get(endpointId);
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
    const torso = this.deformationLookup.byName.get('meshy-torso-surface');
    const torsoPolicy = deformations.find(
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
    for (const state of visualStates.values()) this.deformationStates.push(state);
    for (const state of endpointStates.values()) this.deformationStates.push(state);
  }

  /** Compose a procedural length layer over any authored scalar pose, instead
   * of erasing its controls when an action interrupts that layer. */
  modulateDeformations(factors: Readonly<Record<string, number>>): void {
    const values = { ...this.deformationValues };
    for (const [control, factor] of Object.entries(factors))
      values[control] = (values[control] ?? 1) * factor;
    this.deformationValues = values;
    this.applyDeformations(values);
  }

  /** Combine adjacent authored/secondary length layers. Joint posing may
   * continue, but callers must finish before reading endpoint positions or
   * solving contacts. Repeated begin calls join the current pose batch. */
  beginDeformationBatch(): void {
    this.deformationBatch = true;
  }

  finishDeformationBatch(): void {
    if (!this.deformationBatch) return;
    this.deformationBatch = false;
    if (!this.deformationPending) return;
    this.deformationPending = false;
    this.applyDeformations(this.deformationValues);
  }

  deformationValue(control: string): number { return this.deformationValues[control] ?? 1; }

  private restoreOverlayBaseline(): void {
    // Preview entry, overlay replacement and exception recovery also cancel
    // an unfinished batch; no queued deformation can leak into the next pose.
    this.deformationBatch = this.deformationPending = false;
    this.restoreDeformationStates(true);
    this.deformationValues = {};
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
        for (let i = 0; i < state.morphCount; i++) {
          const morph = state.morphs[i];
          if (force || Math.abs(influences[morph.index] - morph.deformed) <= 1e-10) {
            influences[morph.index] = morph.base;
          }
        }
      }
    }
    this.deformationStates.length = 0;
    this.visualDeformations.clear(); this.endpointDeformations.clear();
    this.deformationLookup.clear();
  }
}
