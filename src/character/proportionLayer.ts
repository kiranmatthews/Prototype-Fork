import * as THREE from 'three';
import { PROCEDURAL_SHIN_LENGTH, PROCEDURAL_THIGH_LENGTH } from '../legRig';
import {
  applyResolvedStretchableBoneLength,
  directStretchableBones,
  stretchableBoneLengthScale,
  stretchableBoneShaftLengthRatio,
  stretchableBoneVolumeMorphInfluence,
} from './stretchableBone';
import {
  meshyTorsoEndpointScaleFromTransverse,
  meshyTorsoLengthRatio,
} from './meshyTorso';
import { MESHY_HEAD_DEFAULT_GAP } from './meshyHead';
import type { CharacterProportionSettingsValue } from './settings';

interface TransformState {
  readonly object: THREE.Object3D;
  readonly basePosition: THREE.Vector3;
  readonly baseQuaternion: THREE.Quaternion;
  readonly baseScale: THREE.Vector3;
  readonly appliedPosition: THREE.Vector3;
  readonly appliedQuaternion: THREE.Quaternion;
  readonly appliedScale: THREE.Vector3;
  movesPosition: boolean;
  movesQuaternion: boolean;
  movesScale: boolean;
  readonly morphs: Array<{
    readonly index: number;
    readonly base: number;
    applied: number;
  }>;
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
      const influences = (state.object as THREE.Mesh).morphTargetInfluences;
      if (influences) {
        for (const morph of state.morphs) {
          if (Math.abs(influences[morph.index] - morph.applied) <= 1e-10) {
            influences[morph.index] = morph.base;
          }
        }
      }
    }
    this.states.clear();
  }

  apply(
    value: Readonly<CharacterProportionSettingsValue>,
    options: { upperArmRestAngleWeight?: number } = {},
  ): void {
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

    const torsoSurface = this.root.getObjectByName('meshy-torso-surface');
    if (torsoSurface) {
      const state = this.stateFor(torsoSurface);
      const influences = (torsoSurface as THREE.Mesh).morphTargetInfluences;
      if (!influences || influences.length < 2) {
        throw new Error('Meshy torso requires independent width/depth morph channels');
      }
      this.ownMorphChannels(state, torsoSurface, [0, 1]);
      const animationTransverse = 1 + state.morphs.find((morph) => morph.index === 0)!.base;
      const animationLength = meshyTorsoEndpointScaleFromTransverse(animationTransverse);
      const combinedLength = animationLength * value.torsoLength;
      const composedAnimationTransverse = Math.sqrt(
        meshyTorsoLengthRatio(value.torsoLength) /
        meshyTorsoLengthRatio(combinedLength),
      );
      influences[0] = composedAnimationTransverse * value.torsoWidth - 1;
      influences[1] = composedAnimationTransverse * value.torsoDepth - 1;
    }

    const shortsSurface = this.root.getObjectByName('meshy-shorts-surface');
    if (shortsSurface) {
      const state = this.stateFor(shortsSurface);
      const influences = (shortsSurface as THREE.Mesh).morphTargetInfluences;
      if (!influences || influences.length < 3) {
        throw new Error('Meshy shorts require independent width/height/depth morph channels');
      }
      this.ownMorphChannels(state, shortsSurface, [0, 1, 2]);
      influences[0] = value.shortsWidth - 1;
      influences[1] = value.shortsHeight - 1;
      influences[2] = value.shortsDepth - 1;
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

    // Gap/overlap and fore-aft placement are presentation-only head offsets.
    // The semantic neck and torso stay fixed, and this pass runs after authored
    // pose sampling so both values compose without erasing animation channels.
    this.addPosition(
      head,
      0,
      MESHY_HEAD_DEFAULT_GAP * (value.neckLength - 1),
      value.headForwardOffset,
    );

    const upperArmRestAngleWeight = THREE.MathUtils.clamp(
      Number.isFinite(options.upperArmRestAngleWeight)
        ? options.upperArmRestAngleWeight as number
        : 1,
      0,
      1,
    );
    for (const side of ['left', 'right'] as const) {
      const sideSign = side === 'left' ? 1 : -1;
      this.multiplyPosition(this.root.getObjectByName(`clavicle-${side}`), value.shoulderWidth, 1, 1);
      this.multiplyPosition(this.root.getObjectByName(`shoulder-${side}`), value.shoulderWidth, 1, 1);
      this.multiplyQuaternion(
        this.root.getObjectByName(`shoulder-${side}`),
        0,
        0,
        THREE.MathUtils.degToRad(
          -value.upperArmRestAngle * sideSign * upperArmRestAngleWeight,
        ),
      );
      this.multiplyPosition(this.root.getObjectByName(`hip-${side}`), value.hipWidth, 1, 1);
      this.multiplyScale(this.root.getObjectByName(`wrist-${side}`), value.handSize, value.handSize, value.handSize);
      this.multiplyQuaternion(
        this.root.getObjectByName(`hand-rest-orientation-${side}`),
        THREE.MathUtils.degToRad(value.wristRestPitch),
        THREE.MathUtils.degToRad(value.wristRestYaw * sideSign),
        THREE.MathUtils.degToRad(value.wristRestRoll * sideSign),
      );
      const markAcross = value.gloveXAcross * sideSign;
      const artistMark = this.root.getObjectByName(`artist-hand-dorsal-x-${side}`);
      if (artistMark) {
        this.addPosition(artistMark, markAcross, value.gloveXAlong, value.gloveXLift);
      } else {
        for (const bar of ['a', 'b']) {
          this.addPosition(
            this.root.getObjectByName(`glove-stitch-${bar}-${side}`),
            markAcross,
            value.gloveXAlong,
            value.gloveXLift,
          );
        }
      }
      this.multiplyScale(this.root.getObjectByName(`ankle-${side}`), value.footSize, value.footSize, value.footSize);
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
    for (const anchorName of ['shoulder-left', 'shoulder-right', 'elbow-left', 'elbow-right']) {
      this.scaleStretchableKnobs(
        this.root.getObjectByName(anchorName),
        value.armKnobSize,
      );
    }
    for (const anchorName of ['hip-left', 'hip-right', 'knee-left', 'knee-right']) {
      this.scaleStretchableKnobs(
        this.root.getObjectByName(anchorName),
        value.legKnobSize,
      );
    }

    for (const state of this.states.values()) {
      state.appliedPosition.copy(state.object.position);
      state.appliedQuaternion.copy(state.object.quaternion);
      state.appliedScale.copy(state.object.scale);
      const influences = (state.object as THREE.Mesh).morphTargetInfluences;
      if (influences) {
        for (const morph of state.morphs) morph.applied = influences[morph.index];
      }
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
        appliedPosition: object.position.clone(),
        appliedQuaternion: object.quaternion.clone(),
        appliedScale: object.scale.clone(),
        movesPosition: false,
        movesQuaternion: false,
        movesScale: false,
        morphs: [],
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

  private addPosition(
    object: THREE.Object3D | null | undefined,
    x: number,
    y: number,
    z: number,
  ): void {
    if (!object) return;
    this.stateFor(object).movesPosition = true;
    object.position.x += x;
    object.position.y += y;
    object.position.z += z;
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
    this.ownMorphChannels(state, object, [0]);
    influences[0] = (1 + influences[0]) * factor - 1;
  }

  private ownMorphChannels(
    state: TransformState,
    object: THREE.Object3D,
    indices: readonly number[],
  ): void {
    const influences = (object as THREE.Mesh).morphTargetInfluences;
    if (!influences) return;
    for (const index of indices) {
      if (index < 0 || index >= influences.length) continue;
      if (state.morphs.some((morph) => morph.index === index)) continue;
      state.morphs.push({ index, base: influences[index], applied: influences[index] });
    }
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
            this.ownMorphChannels(shaftState, shaft, [0]);
            influences[0] = stretchableBoneVolumeMorphInfluence(
              component,
              stretchableBoneShaftLengthRatio(component, factor, combinedScale),
              thicknessFactor - 1,
            );
          }
        } else {
          const influences = (shaft as THREE.Mesh).morphTargetInfluences;
          if (influences?.length) {
            this.ownMorphChannels(shaftState, shaft, [0]);
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
        if (!this.states.get(component.shaft)?.morphs.some((morph) => morph.index === 0)) {
          this.multiplyThicknessMorph(component.shaft, factor);
        }
        continue;
      }
      this.multiplyScale(component.shaft, factor, 1, factor);
    }
    for (const visual of anchor.children.filter(isRenderable)) {
      this.multiplyPosition(visual, factor, 1, factor);
      this.multiplyScale(visual, factor, 1, factor);
    }
  }

  private scaleStretchableKnobs(
    anchor: THREE.Object3D | null | undefined,
    factor: number,
  ): void {
    if (!anchor) return;
    for (const component of directStretchableBones(anchor)) {
      const proximalYFactor = component.metadata.surface === 'ivory-bone-rattle-hybrid'
        ? Math.min(
            factor,
            stretchableBoneLengthScale(component) /
              Math.max(component.metadata.proximalSourceSpan ?? 1, 1e-6),
          )
        : factor;
      this.multiplyScale(component.proximalKnob, factor, proximalYFactor, factor);
      const distal = component.distalKnob;
      if (distal && component.metadata.distalKind !== 'insertion-tip') {
        const state = this.stateFor(distal);
        state.movesPosition = true;
        distal.position.y += component.metadata.baseLength *
          (1 - component.metadata.stretchEnd) * (factor - 1);
        this.multiplyScale(distal, factor, factor, factor);
      }
    }
  }

}
