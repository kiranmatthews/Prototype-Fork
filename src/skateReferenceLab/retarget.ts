import * as THREE from 'three';
import type {PlayerAnimationRig, PlayerRigJoint} from '../animation/bridge';

// Each sample is a SOURCE world transform, already converted to right-handed Y-up.
// Keeping the extra source spine/neck joints here avoids treating a source local
// rotation as a local rotation in Bone Man's shorter hierarchy.
export type Transform = [number, number, number, number, number, number, number];
export interface SourceBone {name: string; parent: string | null; rest: Transform}
export interface SourceClip {
  name: string; fps: number; frames: Transform[][];
  label?: string; category?: string; bank?: 'OnBoard' | 'OffBoard';
  trajectory?: [number, number, number][];
}
export interface MotionData {schema: number; bones: SourceBone[]; clips: SourceClip[]; source_bank_sha256: string}
export const BONE_MAP: ReadonlyArray<readonly [string, string]> = [
  ['HIPS', 'hips'], ['SPINE', 'torsoRoot'], ['SPINE1', 'spine'], ['SPINE3', 'chest'],
  ['NECK1', 'neck'], ['HEAD', 'head'],
  ['LEFTSHOULDER', 'clavicleLeft'], ['LEFTARM', 'shoulderLeft'],
  ['LEFTFOREARM', 'elbowLeft'], ['LEFTHAND', 'wristLeft'],
  ['RIGHTSHOULDER', 'clavicleRight'], ['RIGHTARM', 'shoulderRight'],
  ['RIGHTFOREARM', 'elbowRight'], ['RIGHTHAND', 'wristRight'],
  ['LEFTUPLEG', 'hipLeft'], ['LEFTLEG', 'kneeLeft'], ['LEFTFOOT', 'ankleLeft'], ['LEFTTOEBASE', 'toeLeft'],
  ['RIGHTUPLEG', 'hipRight'], ['RIGHTLEG', 'kneeRight'], ['RIGHTFOOT', 'ankleRight'], ['RIGHTTOEBASE', 'toeRight'],
];
const SEGMENTS = [
  ['deform.torso.length', 'HIPS', 'NECK1'],
  ['deform.arm.upper.left.length', 'LEFTARM', 'LEFTFOREARM'],
  ['deform.arm.lower.left.length', 'LEFTFOREARM', 'LEFTHAND'],
  ['deform.arm.upper.right.length', 'RIGHTARM', 'RIGHTFOREARM'],
  ['deform.arm.lower.right.length', 'RIGHTFOREARM', 'RIGHTHAND'],
  ['deform.leg.upper.left.length', 'LEFTUPLEG', 'LEFTLEG'],
  ['deform.leg.lower.left.length', 'LEFTLEG', 'LEFTFOOT'],
  ['deform.leg.upper.right.length', 'RIGHTUPLEG', 'RIGHTLEG'],
  ['deform.leg.lower.right.length', 'RIGHTLEG', 'RIGHTFOOT'],
] as const;
const position = (v: Transform) => new THREE.Vector3(v[0], v[1], v[2]);
const rotation = (v: Transform) => new THREE.Quaternion(v[3], v[4], v[5], v[6]).normalize();

export function validateMotion(data: MotionData): void {
  if (data.schema !== 1 || !Array.isArray(data.bones) || !Array.isArray(data.clips) || !data.clips.length)
    throw new Error('Unsupported local motion dataset.');
  const names = new Set(data.bones.map(b => b.name));
  if (names.size !== data.bones.length) throw new Error('Duplicate source bones.');
  for (const name of [...BONE_MAP.map(([source]) => source), 'SKATEBOARD_ROOT'])
    if (!names.has(name)) throw new Error(`Missing source joint ${name}.`);
  const check = (sample: Transform) => {
    if (!Array.isArray(sample) || sample.length !== 7 || !sample.every(Number.isFinite)) throw new Error('Invalid source transform.');
    const norm = Math.hypot(...sample.slice(3));
    if (Math.abs(norm - 1) > .001) throw new Error('Source quaternion is not normalized.');
  };
  for (const bone of data.bones) check(bone.rest);
  for (const clip of data.clips) {
    if (!(clip.fps > 0) || !clip.frames.length) throw new Error(`Invalid clock: ${clip.name}`);
    if (clip.trajectory && (clip.trajectory.length !== clip.frames.length || clip.trajectory.some(p => p.length !== 3 || !p.every(Number.isFinite))))
      throw new Error(`Invalid root trajectory: ${clip.name}`);
    for (const frame of clip.frames) {
      if (frame.length !== data.bones.length) throw new Error(`Incomplete frame: ${clip.name}`);
      frame.forEach(check);
    }
  }
}

export function clipDuration(clip: SourceClip): number {return (clip.frames.length - 1) / clip.fps;}
export function sampleMotion(clip: SourceClip, time: number, output: Transform[]): void {
  const frame = THREE.MathUtils.clamp(time * clip.fps, 0, clip.frames.length - 1);
  const lower = Math.floor(frame), upper = Math.min(lower + 1, clip.frames.length - 1), alpha = frame - lower;
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (let index = 0; index < clip.frames[lower].length; index++) {
    const a = clip.frames[lower][index], b = clip.frames[upper][index];
    const out = output[index] ?? (output[index] = [0, 0, 0, 0, 0, 0, 1]);
    for (let axis = 0; axis < 3; axis++) out[axis] = THREE.MathUtils.lerp(a[axis], b[axis], alpha);
    qa.set(a[3], a[4], a[5], a[6]); qb.set(b[3], b[4], b[5], b[6]); qa.slerp(qb, alpha).normalize();
    out[3] = qa.x; out[4] = qa.y; out[5] = qa.z; out[6] = qa.w;
  }
}

function relativeRotation(node: THREE.Object3D | null, root: THREE.Object3D): THREE.Quaternion {
  if (!node || node === root) return new THREE.Quaternion();
  return relativeRotation(node.parent, root).multiply(node.quaternion).normalize();
}

interface Binding {source: number; joint: PlayerRigJoint; sourceRestInverse: THREE.Quaternion; targetRest: THREE.Quaternion}

export class SkateRetargeter {
  readonly bindings: Binding[];
  readonly translationScale: number;
  readonly board: THREE.Object3D;
  readonly sourceBoard: number;
  readonly sourceHips: number;
  readonly sampled: Transform[] = [];
  private readonly boardRestPosition: THREE.Vector3;
  private readonly boardRestRotation: THREE.Quaternion;
  private readonly lengths: {id: string; a: number; b: number; rest: number}[];
  private readonly canonical: Map<string, THREE.Quaternion>;
  readonly rootOffset = new THREE.Vector3();

  constructor(readonly rig: PlayerAnimationRig, readonly data: MotionData, targetLegLength: number) {
    validateMotion(data);
    const index = (name: string) => data.bones.findIndex(b => b.name === name);
    this.sourceBoard = index('SKATEBOARD_ROOT'); this.sourceHips = index('HIPS');
    this.board = rig.root.getObjectByName('board')!;
    if (!this.board) throw new Error('Bone Man board is missing.');
    this.boardRestPosition = this.board.position.clone();
    this.boardRestRotation = this.board.quaternion.clone();
    const sourceLegLength = position(data.bones[index('LEFTUPLEG')].rest).distanceTo(position(data.bones[index('LEFTLEG')].rest))
      + position(data.bones[index('LEFTLEG')].rest).distanceTo(position(data.bones[index('LEFTFOOT')].rest));
    this.translationScale = targetLegLength / sourceLegLength;
    const published = rig.root.userData.sculptRuntime.retargetPose as Record<string, {quaternion: [number, number, number, number]}>;
    this.canonical = new Map(rig.joints.map(joint => [joint.id, new THREE.Quaternion().fromArray(published[joint.id]?.quaternion ?? joint.rest.quaternion)]));
    this.reset();
    for (const joint of rig.joints) joint.node.quaternion.copy(this.canonical.get(joint.id)!);
    const armEndpoints: Record<string, [string, string]> = {
      shoulderLeft: ['elbowLeft', 'LEFTFOREARM'], elbowLeft: ['wristLeft', 'LEFTHAND'],
      shoulderRight: ['elbowRight', 'RIGHTFOREARM'], elbowRight: ['wristRight', 'RIGHTHAND'],
    };
    const armCorrections = new Map<string, THREE.Quaternion>();
    this.bindings = BONE_MAP.map(([source, id]) => {
      const joint = rig.jointsById.get(id);
      if (!joint) throw new Error(`Missing Bone Man joint ${id}.`);
      const targetRest = relativeRotation(joint.node, rig.root);
      const endpoint = armEndpoints[id];
      if (endpoint) {
        // RX2 mesh bind arms slope down: its "RIG_TPOSE" channel name does not
        // make the mesh bind a horizontal T-pose. Align the actual segments.
        const targetDirection = rig.jointsById.get(endpoint[0])!.node.position.clone().applyQuaternion(targetRest).normalize();
        const sourceDirection = position(data.bones[index(endpoint[1])].rest).sub(position(data.bones[index(source)].rest)).normalize();
        const correction = new THREE.Quaternion().setFromUnitVectors(targetDirection, sourceDirection);
        armCorrections.set(id, correction); targetRest.premultiply(correction);
      } else if (id === 'wristLeft' || id === 'wristRight') {
        targetRest.premultiply(armCorrections.get(id === 'wristLeft' ? 'elbowLeft' : 'elbowRight')!);
      }
      return {source: index(source), joint, sourceRestInverse: rotation(data.bones[index(source)].rest).invert(), targetRest};
    });
    this.lengths = SEGMENTS.map(([id, a, b]) => ({id, a: index(a), b: index(b), rest: position(data.bones[index(a)].rest).distanceTo(position(data.bones[index(b)].rest))}));
    this.reset();
  }

  private reset(): void {
    for (const joint of this.rig.joints) {
      joint.node.position.fromArray(joint.rest.position);
      joint.node.quaternion.fromArray(joint.rest.quaternion);
      joint.node.scale.fromArray(joint.rest.scale);
    }
    this.board.position.copy(this.boardRestPosition);
    this.board.quaternion.copy(this.boardRestRotation);
  }

  apply(clip: SourceClip, time: number, options: {travel: boolean; rest: boolean}): Record<string, number> {
    this.reset();
    const scalars: Record<string, number> = {};
    this.rootOffset.set(0, 0, 0);
    if (options.rest) {
      for (const joint of this.rig.joints) joint.node.quaternion.copy(this.canonical.get(joint.id)!);
      return scalars;
    }
    sampleMotion(clip, time, this.sampled);
    // Qtarget_world = Qsource_world * inverse(Qsource_bind) * Qtarget_aligned_bind.
    // Parent conversion happens after the mapped ancestor, including skipped
    // source spine/neck joints. No Euler angle copying and no global rig scale.
    for (const binding of this.bindings) {
      const world = rotation(this.sampled[binding.source]).multiply(binding.sourceRestInverse).multiply(binding.targetRest);
      binding.joint.node.quaternion.copy(relativeRotation(binding.joint.node.parent, this.rig.root).invert().multiply(world).normalize());
    }
    const boardSource = position(this.sampled[this.sourceBoard]);
    const boardBind = position(this.data.bones[this.sourceBoard].rest);
    const removal = options.travel ? new THREE.Vector3() : boardSource.clone().sub(boardBind).setY(0);
    // A carried/thrown board moves independently of the rider. For off-board
    // clips remove the original trajectory channel, never that prop motion.
    if (!options.travel && clip.bank === 'OffBoard' && clip.trajectory) {
      const frame = THREE.MathUtils.clamp(time * clip.fps, 0, clip.frames.length - 1);
      const lower = Math.floor(frame), upper = Math.min(lower + 1, clip.frames.length - 1);
      removal.fromArray(clip.trajectory[lower]).lerp(new THREE.Vector3().fromArray(clip.trajectory[upper]), frame - lower).setY(0);
    }
    const rootTranslation = position(this.sampled[this.sourceHips]).sub(position(this.data.bones[this.sourceHips].rest)).sub(removal).multiplyScalar(this.translationScale);
    this.rig.jointsById.get('hips')!.node.position.add(rootTranslation);
    const boardDelta = rotation(this.sampled[this.sourceBoard]).multiply(rotation(this.data.bones[this.sourceBoard].rest).invert());
    this.board.quaternion.copy(boardDelta.multiply(this.boardRestRotation));
    this.board.position.add(boardSource.sub(boardBind).sub(removal).multiplyScalar(this.translationScale));
    this.rootOffset.copy(this.board.position);
    // Carry authored limb extension through the shared independent segment
    // deformation controls. Curving the spine is rotation, not torso shrink.
    for (const segment of this.lengths) {
      if (segment.id === 'deform.torso.length') continue;
      scalars[segment.id] = position(this.sampled[segment.a]).distanceTo(position(this.sampled[segment.b])) / segment.rest;
    }
    this.board.visible = true;
    return scalars;
  }
}
