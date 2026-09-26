import * as THREE from 'three';
import { createAnimationClip, createProceduralDriver } from './document';
import type { AnimationClip, AnimationTrack, QuaternionTuple, Vec3Tuple } from './types';

export const ICE_WALK_CLIP_ID = 'player.ice-walk';
export const ICE_WALK_DURATION = 1.44;
export const ICE_EFFORT_INPUT = 'iceEffort';
export const ICE_SIDE_SLIP_INPUT = 'iceSideSlip';
export const ICE_WALK_INPUTS = { effort: ICE_EFFORT_INPUT, sideSlip: ICE_SIDE_SLIP_INPUT } as const;

// Original in-place performance: a small right recovery, a longer left scuff,
// then an uneasy glide. All sampled poses become ordinary editable Studio keys.
const BEATS = [0, .12, .24, .38, .50, .63, .74, .88, 1] as const;
const LEAN = [-.065, -.115, -.025, .080, .055, .125, .018, -.095, -.065];
const DROP = [-.033, -.032, -.036, -.031, -.031, -.036, -.040, -.033, -.033];
const LEFT_KNEE = [.50, .48, .52, .62, .50, .65, .82, .64, .50];
const RIGHT_KNEE = [.52, .64, .78, .56, .48, .52, .60, .64, .52];
const LEFT_GLIDE = [.10, .12, .03, -.10, -.07, .02, .13, .11, .10];
const RIGHT_GLIDE = [-.10, -.02, .12, .13, .10, -.02, -.11, -.07, -.10];

/** Evaluate only at authoring time, so elbow/wrist delay remains editable keys. */
function delayed(values: readonly number[], phase: number, lag: number): number {
  const t = ((phase - lag) % 1 + 1) % 1;
  let i = 0;
  while (i < BEATS.length - 2 && t > BEATS[i + 1]) i++;
  const blend = (t - BEATS[i]) / (BEATS[i + 1] - BEATS[i]);
  return values[i] + (values[i + 1] - values[i]) * blend;
}

/** Match endpoint velocity as well as pose with a brief keyed regather. */
function softenLoopWrap<T extends { id: string; time: number }>(keys: T[]): T[] {
  const first = structuredClone(keys[0]), last = structuredClone(keys[keys.length - 1]);
  first.id += ':wrap-out'; first.time = .03 * ICE_WALK_DURATION;
  last.id += ':wrap-in'; last.time = .97 * ICE_WALK_DURATION;
  return [keys[0], first, ...keys.slice(1, -1), last, keys[keys.length - 1]];
}

export function buildIceWalkClip(rigId: string, includeTorsoRoot = true): AnimationClip {
  const clip = createAnimationClip({ id: ICE_WALK_CLIP_ID,
    name: 'Ice Walk — Scuff and Counterbalance', rigId, duration: ICE_WALK_DURATION });
  clip.proceduralOrder = 'keyed-then-procedural';
  const rotation = (joint: string, poses: readonly Vec3Tuple[]): void => {
    const id = `${clip.id}:${joint}:quaternion`;
    clip.tracks.push({ id, target: joint, kind: 'quaternion', keys: softenLoopWrap(poses.map((pose, i) => ({
      id: `${id}:${i}`, time: BEATS[i] * clip.duration,
      value: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose, 'XYZ')).toArray() as QuaternionTuple,
      interpolation: 'cubic',
    }))) });
  };
  const position = (joint: string, poses: readonly Vec3Tuple[]): void => {
    const id = `${clip.id}:${joint}:position`;
    clip.tracks.push({ id, target: joint, kind: 'position', keys: softenLoopWrap(poses.map((pose, i) => ({
      id: `${id}:${i}`, time: BEATS[i] * clip.duration, value: [...pose], interpolation: 'cubic',
    }))) } as AnimationTrack);
  };
  // No root trajectory, root scale or skeleton-wide squash. The small pelvis
  // gather makes soft knees credible while the controller owns every metre.
  position('root', BEATS.map(() => [0, 0, 0]));
  position('hips', BEATS.map((_, i) => [LEAN[i] * -.11, DROP[i], 0]));
  rotation('hips', BEATS.map((_, i) => [0, LEAN[i] * .20, LEAN[i] * -.18]));
  if (includeTorsoRoot) rotation('torsoRoot', BEATS.map((_, i) => [.055, 0, LEAN[i] * .28]));
  rotation('spine', BEATS.map((_, i) => [includeTorsoRoot ? .035 : .09, LEAN[i] * .10, LEAN[i] * (includeTorsoRoot ? .30 : .58)]));
  rotation('chest', BEATS.map((_, i) => [.025, LEAN[i] * -.10, LEAN[i] * .60]));
  rotation('neck', BEATS.map((_, i) => [-.045, LEAN[i] * -.08, LEAN[i] * -.40]));
  rotation('head', BEATS.map((_, i) => [-.045, LEAN[i] * -.12, LEAN[i] * -.60]));

  const armX = [[.18, .07, -.12, .20, .28, .05, -.18, .04, .18],
    [-.08, .12, .24, .08, -.10, -.19, .10, .24, -.08]];
  const spread = [[1.12, 1.40, 1.30, .99, 1.05, 1.24, 1.45, 1.34, 1.12],
    [1.32, 1.10, .98, 1.23, 1.48, 1.34, 1.05, 1.16, 1.32]];
  const elbows = [[-.45, -.36, -.56, -.62, -.37, -.42, -.58, -.51, -.45],
    [-.57, -.49, -.37, -.44, -.61, -.54, -.36, -.48, -.57]];
  for (const [side, sign, index] of [['Left', 1, 0], ['Right', -1, 1]] as const) {
    const knee = index === 0 ? LEFT_KNEE : RIGHT_KNEE;
    const glide = index === 0 ? LEFT_GLIDE : RIGHT_GLIDE;
    const hip = knee.map((bend, i) => -bend / 2 + glide[i]);
    rotation(`clavicle${side}`, BEATS.map((_, i) => [0, 0, sign * .06 - LEAN[i] * .10]));
    rotation(`shoulder${side}`, BEATS.map((_, i) => [armX[index][i], sign * .08 - LEAN[i] * .45, sign * spread[index][i]]));
    rotation(`elbow${side}`, BEATS.map(phase => [delayed(elbows[index], phase, .06), 0, sign * .16]));
    rotation(`wrist${side}`, BEATS.map(phase => [delayed(armX[index], phase, .11) * -.55,
      sign * .18, sign * .06 - delayed(LEAN, phase, .11) * .85]));
    rotation(`hip${side}`, BEATS.map((_, i) => [hip[i], 0, sign * .065]));
    rotation(`knee${side}`, BEATS.map((_, i) => [knee[i], 0, 0]));
    rotation(`ankle${side}`, BEATS.map((_, i) => [-hip[i] - knee[i], 0, -sign * .065]));
    rotation(`toe${side}`, BEATS.map(() => [0, 0, 0]));
  }

  const response = (joint: string, axis: Vec3Tuple, source: string, amount: number, signed = false): void => {
    clip.proceduralDrivers.push(createProceduralDriver('response', { kind: 'quaternion', target: joint, axis }, {
      id: `${clip.id}:response:${source}:${joint}:${axis.join('-')}`, name: `${source} · ${joint}`,
      order: 100 + clip.proceduralDrivers.length, blend: 'additive', source,
      amplitude: amount * (signed ? 2 : 1), bias: signed ? -amount : 0,
      inputRange: signed ? [-1, 1] : [0, 1], responseCurve: signed ? 'linear' : 'smoothstep',
      clamp: [Math.min(0, -Math.abs(amount)), Math.abs(amount)],
    }));
  };
  // Effort deepens the soft gathering and raises the balance arms. Signed
  // side slip produces a coherent counter-lean with an opposing head turn.
  response('spine', [1, 0, 0], ICE_EFFORT_INPUT, .055);
  response('head', [1, 0, 0], ICE_EFFORT_INPUT, -.055);
  response('chest', [0, 0, 1], ICE_SIDE_SLIP_INPUT, -.10, true);
  response('neck', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .04, true);
  response('head', [0, 0, 1], ICE_SIDE_SLIP_INPUT, .06, true);
  for (const [side, sign] of [['Left', 1], ['Right', -1]] as const) {
    response(`shoulder${side}`, [0, 0, 1], ICE_EFFORT_INPUT, sign * .10);
    response(`shoulder${side}`, [1, 0, 0], ICE_SIDE_SLIP_INPUT, -sign * .12, true);
  }
  const glideContact = (name: string, start: number, end: number, effector: string) => ({
    id: `${clip.id}:${name}`, start: start * clip.duration, end: end * clip.duration,
    effector, mode: 'custom' as const, weight: 1,
    metadata: { surface: 'ice', planarContact: 'glide', verticalContact: 'ground', locking: 'no-world-XZ-plant' },
  });
  clip.contacts = [glideContact('left-long-glide', 0, .62, 'footLeft'),
    glideContact('left-catch', .84, 1, 'footLeft'), glideContact('right-entry-glide', 0, .13, 'footRight'),
    glideContact('right-long-glide', .32, 1, 'footRight')];
  clip.markers = [{ id: `${clip.id}:right-scuff`, time: .24 * clip.duration, name: 'Small right recovery' },
    { id: `${clip.id}:left-scuff`, time: .74 * clip.duration, name: 'Long left corrective scuff' }];
  clip.tags = ['player', 'starter-authored', 'ice', 'locomotion', 'balance', 'in-place'];
  clip.metadata = { starterQuality: 'authored-foundation', starterCatalogVersion: 32,
    performance: 'Original low scuffs, asymmetric corrections and delayed arm counterbalance',
    referenceStudy: { url: 'https://www.youtube.com/watch?v=x_Q7VARdpdg&t=107s',
      scope: 'PS1 Snow Go posture reference only; original keys and timing, no extracted animation' },
    motionInputs: { [ICE_EFFORT_INPUT]: { min: 0, max: 1, default: 0 },
      [ICE_SIDE_SLIP_INPUT]: { min: -1, max: 1, default: 0 } },
    footContactPolicy: 'Low lifted recoveries separated by surface glides; never a locked skating foot',
    headPolicy: 'Counter-rotate chest sway and slip; no camera or gameplay changes' };
  return clip;
}
