import * as THREE from 'three';
import { PROCEDURAL_SHIN_LENGTH, PROCEDURAL_THIGH_LENGTH } from '../legRig';
import {
  applyResolvedStretchableBoneLength,
  directStretchableBones,
  stretchableBoneLengthScale,
  stretchableBoneShaftLengthRatio,
  stretchableBoneVolumeMorphInfluence,
} from './stretchableBone';
import type { CharacterProportionSettingsValue } from './settings';

interface TransformState {
  readonly object: THREE.Object3D;
  readonly basePosition: THREE.Vector3;
  readonly baseQuaternion: THREE.Quaternion;
  readonly baseScale: THREE.Vector3;
  readonly baseMorphInfluence: number | null;
  readonly appliedPosition: THREE.Vector3;
  readonly appliedQuaternion: THREE.Quaternion;
  readonly appliedScale: THREE.Vector3;
  appliedMorphInfluence: number | null;
  movesPosition: boolean;
  movesQuaternion: boolean;
  movesScale: boolean;
  movesMorph: boolean;
}

interface RuntimeDeformation {
  controlId?: unknown;
  jointId?: unknown;
  downstreamJointIds?: unknown;
  lengthAxis?: unknown;
  volume?: unknown;
}

const EPSILON_SQ = 1e-14;
const ROTATION_EULER = new THREE.Euler(0, 0, 0, 'XYZ');
const ROTATION_QUATERNION = new THREE.Quaternion();

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

function firstMorphInfluence(object: THREE.Object3D): number | null {
  const influences = (object as THREE.Mesh).morphTargetInfluences;
  return influences?.length ? influences[0] : null;
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
      if (
        state.movesQuaternion &&
        1 - Math.abs(state.object.quaternion.dot(state.appliedQuaternion)) <= EPSILON_SQ
      ) {
        state.object.quaternion.copy(state.baseQuaternion);
      }
      const currentMorph = firstMorphInfluence(state.object);
      if (
        state.movesMorph &&
        currentMorph !== null &&
        state.appliedMorphInfluence !== null &&
        Math.abs(currentMorph - state.appliedMorphInfluence) <= 1e-10
      ) {
        (state.object as THREE.Mesh).morphTargetInfluences![0] =
          state.baseMorphInfluence ?? 0;
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
      const thicknessFactor = factorKey === 'upperArmLength' || factorKey === 'forearmLength'
        ? value.armThickness
        : factorKey === 'thighLength' || factorKey === 'shinLength'
          ? value.legThickness
          : 1;
      this.scaleStretchableBonesAlong(
        anchor,
        axis,
        factor,
        thicknessFactor,
        policy.volume === 'preserve-cross-section-area',
      );
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
      const sideSign = side === 'left' ? 1 : -1;
      this.multiplyQuaternion(
        this.root.getObjectByName(`hand-rest-orientation-${side}`),
        THREE.MathUtils.degToRad(value.wristRestPitch),
        THREE.MathUtils.degToRad(value.wristRestYaw * sideSign),
        THREE.MathUtils.degToRad(value.wristRestRoll * sideSign),
      );
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
      state.appliedQuaternion.copy(state.object.quaternion);
      state.appliedScale.copy(state.object.scale);
      state.appliedMorphInfluence = firstMorphInfluence(state.object);
    }
  }

  private stateFor(object: THREE.Object3D): TransformState {
    let state = this.states.get(object);
    if (!state) {
      state = {
        object,
        basePosition: object.position.clone(),
        baseQuaternion: object.quaternion.clone(),
        baseScale: object.scale.clone(),
        baseMorphInfluence: firstMorphInfluence(object),
        appliedPosition: object.position.clone(),
        appliedQuaternion: object.quaternion.clone(),
        appliedScale: object.scale.clone(),
        appliedMorphInfluence: firstMorphInfluence(object),
        movesPosition: false,
        movesQuaternion: false,
        movesScale: false,
        movesMorph: false,
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

  private multiplyQuaternion(
    object: THREE.Object3D | null | undefined,
    pitch: number,
    yaw: number,
    roll: number,
  ): void {
    if (!object) return;
    const state = this.stateFor(object);
    state.movesQuaternion = true;
    ROTATION_EULER.set(pitch, yaw, roll, 'XYZ');
    ROTATION_QUATERNION.setFromEuler(ROTATION_EULER);
    object.quaternion.copy(state.baseQuaternion).multiply(ROTATION_QUATERNION).normalize();
  }

  private multiplyThicknessMorph(
    object: THREE.Object3D | null | undefined,
    factor: number,
  ): void {
    if (!object) return;
    const influences = (object as THREE.Mesh).morphTargetInfluences;
    if (!influences?.length) return;
    const state = this.stateFor(object);
    state.movesMorph = true;
    influences[0] = (1 + influences[0]) * factor - 1;
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

  private scaleStretchableBonesAlong(
    anchor: THREE.Object3D,
    axis: THREE.Vector3,
    factor: number,
    thicknessFactor: number,
    preserveVolume: boolean,
  ): void {
    for (const component of directStretchableBones(anchor)) {
      const shaft = component.shaft;
      const shaftState = this.stateFor(shaft);
      shaftState.movesPosition = true;
      shaftState.movesScale = true;
      if (component.metadata.surface !== 'procedural') {
        const animationScale = stretchableBoneLengthScale(component);
        const combinedScale = animationScale * factor;
        if (component.distalKnob) {
          this.stateFor(component.distalKnob).movesPosition = true;
        }
        this.stateFor(component.distalSocket).movesPosition = true;
        applyResolvedStretchableBoneLength(
          component,
          combinedScale,
        );
        if (preserveVolume) {
          const influences = (shaft as THREE.Mesh).morphTargetInfluences;
          if (influences?.length) {
            shaftState.movesMorph = true;
            influences[0] = stretchableBoneVolumeMorphInfluence(
              component,
              stretchableBoneShaftLengthRatio(component, factor, combinedScale),
              thicknessFactor - 1,
            );
          }
        } else {
          const influences = (shaft as THREE.Mesh).morphTargetInfluences;
          if (influences?.length) {
            shaftState.movesMorph = true;
            influences[0] = thicknessFactor - 1;
          }
        }
        continue;
      }
      const shaftProjection = shaft.position.dot(axis);
      shaft.position.addScaledVector(axis, shaftProjection * (factor - 1));
      shaft.scale.x *= Math.abs(axis.x) * factor + (1 - Math.abs(axis.x));
      shaft.scale.y *= Math.abs(axis.y) * factor + (1 - Math.abs(axis.y));
      shaft.scale.z *= Math.abs(axis.z) * factor + (1 - Math.abs(axis.z));

      for (const follower of [component.distalKnob, component.distalSocket]) {
        if (!follower) continue;
        const followerState = this.stateFor(follower);
        followerState.movesPosition = true;
        const projection = follower.position.dot(axis);
        follower.position.addScaledVector(axis, projection * (factor - 1));
      }
    }
  }

  private scaleRenderableChildrenTransverse(
    anchor: THREE.Object3D | null | undefined,
    factor: number,
  ): void {
    if (!anchor) return;
    for (const component of directStretchableBones(anchor)) {
      if (component.metadata.surface !== 'procedural') {
        if (!this.states.get(component.shaft)?.movesMorph) {
          this.multiplyThicknessMorph(component.shaft, factor);
        }
        continue;
      }
      this.multiplyScale(component.shaft, factor, 1, factor);
      for (const knob of [component.proximalKnob, component.distalKnob]) {
        // Design-time thickness changes may resize a knobble, but only
        // uniformly: its double-lobe shape never squashes into an ellipsoid.
        this.multiplyPosition(knob, factor, 1, factor);
        this.multiplyScale(knob, factor, factor, factor);
      }
    }
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
