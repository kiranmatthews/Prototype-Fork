import * as THREE from 'three';
import { PROCEDURAL_SHIN_LENGTH, PROCEDURAL_THIGH_LENGTH } from '../legRig';
import type { CharacterProportionSettingsValue } from './settings';

interface TransformState {
  readonly object: THREE.Object3D;
  readonly basePosition: THREE.Vector3;
  readonly baseScale: THREE.Vector3;
  readonly appliedPosition: THREE.Vector3;
  readonly appliedScale: THREE.Vector3;
  movesPosition: boolean;
  movesScale: boolean;
}

interface RuntimeDeformation {
  controlId?: unknown;
  jointId?: unknown;
  downstreamJointIds?: unknown;
  lengthAxis?: unknown;
}

const EPSILON_SQ = 1e-14;

const SEGMENT_FACTORS: Readonly<
  Record<string, keyof CharacterProportionSettingsValue>
> = Object.freeze({
  'deform.torso.length': 'torsoLength',
  'deform.arm.upper.left.length': 'upperArmLength',
  'deform.arm.lower.left.length': 'forearmLength',
  'deform.arm.upper.right.length': 'upperArmLength',
  'deform.arm.lower.right.length': 'forearmLength',
  'deform.leg.upper.left.length': 'thighLength',
  'deform.leg.lower.left.length': 'shinLength',
  'deform.leg.upper.right.length': 'thighLength',
  'deform.leg.lower.right.length': 'shinLength',
});

function isRenderable(object: THREE.Object3D): boolean {
  const candidate = object as THREE.Object3D & {
    isMesh?: boolean;
    isLine?: boolean;
    isPoints?: boolean;
    isSprite?: boolean;
  };
  return Boolean(candidate.isMesh || candidate.isLine || candidate.isPoints || candidate.isSprite);
}

function finiteAxis(value: unknown): THREE.Vector3 | null {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) return null;
  const axis = new THREE.Vector3(value[0], value[1], value[2]);
  return axis.lengthSq() > 1e-10 ? axis.normalize() : null;
}

function runtimeDeformations(root: THREE.Object3D): RuntimeDeformation[] {
  const runtime = root.userData.sculptRuntime as { deformations?: unknown } | undefined;
  return Array.isArray(runtime?.deformations) ? runtime.deformations as RuntimeDeformation[] : [];
}

/**
 * Applies persistent body design as a reversible presentation layer.
 *
 * The animation rig keeps its canonical rest pose. Every call first removes
 * the previous proportion pass, then multiplies the newly authored pose. This
 * makes Character Lab edits compatible with keyframes, procedural drivers,
 * squash/stretch and preview snapshot restoration without frame accumulation.
 */
export class CharacterProportionLayer {
  private readonly states = new Map<THREE.Object3D, TransformState>();

  constructor(private readonly root: THREE.Object3D) {}

  get appliedObjectCount(): number {
    return this.states.size;
  }

  clear(): void {
    for (const state of this.states.values()) {
      if (
        state.movesPosition &&
        state.object.position.distanceToSquared(state.appliedPosition) <= EPSILON_SQ
      ) {
        state.object.position.copy(state.basePosition);
      }
      if (
        state.movesScale &&
        state.object.scale.distanceToSquared(state.appliedScale) <= EPSILON_SQ
      ) {
        state.object.scale.copy(state.baseScale);
      }
    }
    this.states.clear();
  }

  apply(value: Readonly<CharacterProportionSettingsValue>): void {
    this.clear();

    const rider = this.root.getObjectByName('procedural-rider');
    this.multiplyScale(
      rider,
      value.overallScale * value.bodyWidth,
      value.overallScale * value.height,
      value.overallScale * value.bodyDepth,
    );

    for (const policy of runtimeDeformations(this.root)) {
      const controlId = typeof policy.controlId === 'string' ? policy.controlId : '';
      const factorKey = SEGMENT_FACTORS[controlId];
      const axis = finiteAxis(policy.lengthAxis);
      const jointId = typeof policy.jointId === 'string' ? policy.jointId : '';
      const runtime = this.root.userData.sculptRuntime as { joints?: Record<string, string> };
      const jointName = runtime.joints?.[jointId];
      const anchor = jointName ? this.root.getObjectByName(jointName) : null;
      if (!factorKey || !axis || !anchor) continue;
      const factor = value[factorKey];
      this.scaleRenderableChildrenAlong(anchor, axis, factor);
      const endpointIds = Array.isArray(policy.downstreamJointIds)
        ? policy.downstreamJointIds.filter((id): id is string => typeof id === 'string')
        : [];
      for (const endpointId of endpointIds) {
        const endpointName = runtime.joints?.[endpointId];
        const endpoint = endpointName ? this.root.getObjectByName(endpointName) : null;
        if (endpoint?.parent === anchor) this.scalePositionAlong(endpoint, axis, factor);
      }
    }

    const legHeightDelta =
      PROCEDURAL_THIGH_LENGTH * (value.thighLength - 1) +
      PROCEDURAL_SHIN_LENGTH * (value.shinLength - 1);
    const hips = this.root.getObjectByName('hips');
    if (hips) {
      this.stateFor(hips).movesPosition = true;
      hips.position.y += legHeightDelta;
    }

    const head = this.root.getObjectByName('head');
    this.multiplyScale(
      head,
      value.headSize * value.headWidth,
      value.headSize,
      value.headSize * value.headDepth,
    );

    const neck = this.root.getObjectByName('neck');
    this.multiplyPosition(neck, 1, value.neckLength, 1);
    this.multiplyPosition(head, 1, value.neckLength, 1);
    const neckVolume = this.root.getObjectByName('neck-volume');
    this.multiplyPosition(neckVolume, 1, value.neckLength, 1);
    this.multiplyScale(neckVolume, 1, value.neckLength, 1);

    for (const side of ['left', 'right'] as const) {
      this.multiplyPosition(this.root.getObjectByName(`clavicle-${side}`), value.shoulderWidth, 1, 1);
      this.multiplyPosition(this.root.getObjectByName(`shoulder-${side}`), value.shoulderWidth, 1, 1);
      this.multiplyPosition(this.root.getObjectByName(`hip-${side}`), value.hipWidth, 1, 1);
      this.multiplyScale(this.root.getObjectByName(`wrist-${side}`), value.handSize, value.handSize, value.handSize);
      this.multiplyScale(this.root.getObjectByName(`ankle-${side}`), value.footSize, value.footSize, value.footSize);
      this.multiplyScale(this.root.getObjectByName(`ear-${side}`), value.earSize, value.earSize, value.earSize);
    }

    for (const anchorName of ['shoulder-left', 'shoulder-right', 'elbow-left', 'elbow-right']) {
      this.scaleRenderableChildrenTransverse(
        this.root.getObjectByName(anchorName),
        value.armThickness,
      );
    }
    for (const anchorName of ['hip-left', 'hip-right', 'knee-left', 'knee-right']) {
      this.scaleRenderableChildrenTransverse(
        this.root.getObjectByName(anchorName),
        value.legThickness,
      );
    }

    for (const anchorName of ['hips', 'torso-root', 'spine', 'chest']) {
      this.scaleRenderableChildrenCrossSection(
        this.root.getObjectByName(anchorName),
        value.torsoWidth,
        value.torsoDepth,
      );
    }

    for (const side of ['left', 'right'] as const) {
      for (const part of ['white', 'iris', 'pupil', 'lash'] as const) {
        this.multiplyScale(
          this.root.getObjectByName(`eye-${part}-${side}`),
          value.eyeSize,
          value.eyeSize,
          value.eyeSize,
        );
      }
    }
    this.multiplyScale(
      this.root.getObjectByName('ponytail-base'),
      value.ponytailSize,
      value.ponytailSize,
      value.ponytailSize,
    );

    for (const state of this.states.values()) {
      state.appliedPosition.copy(state.object.position);
      state.appliedScale.copy(state.object.scale);
    }
  }

  private stateFor(object: THREE.Object3D): TransformState {
    let state = this.states.get(object);
    if (!state) {
      state = {
        object,
        basePosition: object.position.clone(),
        baseScale: object.scale.clone(),
        appliedPosition: object.position.clone(),
        appliedScale: object.scale.clone(),
        movesPosition: false,
        movesScale: false,
      };
      this.states.set(object, state);
    }
    return state;
  }

  private multiplyPosition(
    object: THREE.Object3D | null | undefined,
    x: number,
    y: number,
    z: number,
  ): void {
    if (!object) return;
    this.stateFor(object).movesPosition = true;
    object.position.set(
      object.position.x * x,
      object.position.y * y,
      object.position.z * z,
    );
  }

  private multiplyScale(
    object: THREE.Object3D | null | undefined,
    x: number,
    y: number,
    z: number,
  ): void {
    if (!object) return;
    this.stateFor(object).movesScale = true;
    object.scale.set(
      object.scale.x * x,
      object.scale.y * y,
      object.scale.z * z,
    );
  }

  private scalePositionAlong(object: THREE.Object3D, axis: THREE.Vector3, factor: number): void {
    this.stateFor(object).movesPosition = true;
    const projection = object.position.dot(axis);
    object.position.addScaledVector(axis, projection * (factor - 1));
  }

  private scaleRenderableChildrenAlong(
    anchor: THREE.Object3D,
    axis: THREE.Vector3,
    factor: number,
  ): void {
    for (const visual of anchor.children.filter(isRenderable)) {
      const state = this.stateFor(visual);
      state.movesPosition = true;
      state.movesScale = true;
      const projection = visual.position.dot(axis);
      visual.position.addScaledVector(axis, projection * (factor - 1));
      visual.scale.x *= Math.abs(axis.x) * factor + (1 - Math.abs(axis.x));
      visual.scale.y *= Math.abs(axis.y) * factor + (1 - Math.abs(axis.y));
      visual.scale.z *= Math.abs(axis.z) * factor + (1 - Math.abs(axis.z));
    }
  }

  private scaleRenderableChildrenTransverse(
    anchor: THREE.Object3D | null | undefined,
    factor: number,
  ): void {
    if (!anchor) return;
    for (const visual of anchor.children.filter(isRenderable)) {
      this.multiplyPosition(visual, factor, 1, factor);
      this.multiplyScale(visual, factor, 1, factor);
    }
  }

  private scaleRenderableChildrenCrossSection(
    anchor: THREE.Object3D | null | undefined,
    width: number,
    depth: number,
  ): void {
    if (!anchor) return;
    for (const visual of anchor.children.filter(isRenderable)) {
      this.multiplyPosition(visual, width, 1, depth);
      this.multiplyScale(visual, width, 1, depth);
    }
  }
}
