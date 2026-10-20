import * as THREE from 'three';
import { createAnimationClip } from './document';
import type { AnimationClip, QuaternionTuple, Vec3Tuple } from './types';

export const ROLL_LANDING_CLIP_ID = 'player.roll-land';
export const ROLL_LANDING_DURATION = .76;
/** Brief momentum handoff into ordinary foot intent, including release/stop. */
export const ROLL_LANDING_CONTROL_SECONDS = .24;
export const ROLL_RUN_BLEND_START = .72;

// Catch, load the leading palm, roll across the shoulder/back, plant the
// trailing foot, then drive into a live running gait. Dense root samples keep
// quaternion interpolation on the forward revolution, including past π.
const PHASE = [0, .08, .18, .30, .43, .55, .65, .72, .84, 1];
const PITCH = [0, .30, 1.05, 2.35, 3.75, 5.05, 5.95, Math.PI * 2, Math.PI * 2, Math.PI * 2];
const HIP_L = [-.28, -1.25, -1.48, -1.80, -1.85, -1.60, -.95, -.55, -.38, -.28];
const HIP_R = [-.38, -1.32, -1.62, -1.95, -1.72, -1.32, -.40, .45, .35, -.28];
const KNEE_L = [.52, 2.05, 2.05, 2.25, 2.35, 2.10, 1.65, .85, .52, .52];
const KNEE_R = [.64, 2.15, 2.20, 2.35, 2.15, 1.88, 1.25, 1.48, .95, .52];
const ARM_L = [-.45, -1.30, -1.85, -2.10, -1.75, -1.10, -.60, -.70, -.25, -.30];
const ARM_R = [-.60, -1.48, -1.95, -1.72, -1.35, -.85, .35, .60, .20, -.30];

const smooth = (t: number) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
function curve(values: readonly number[], p: number): number {
  let i = 0;
  while (i < PHASE.length - 2 && p > PHASE[i + 1]) i++;
  const span = PHASE[i + 1] - PHASE[i];
  const t = Math.max(0, Math.min(1, (p - PHASE[i]) / span));
  const slope = (n: number) => {
    if (n === 0 || n === PHASE.length - 1) return 0;
    const a = (values[n] - values[n - 1]) / (PHASE[n] - PHASE[n - 1]);
    const b = (values[n + 1] - values[n]) / (PHASE[n + 1] - PHASE[n]);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  // Monotone Hermite keeps angular velocity continuous through the tumble;
  // individual beats are accents, never a series of eased stop/start poses.
  return (2*t*t*t - 3*t*t + 1)*values[i] + (t*t*t - 2*t*t + t)*span*slope(i) +
    (-2*t*t*t + 3*t*t)*values[i+1] + (t*t*t - t*t)*span*slope(i+1);
}

export function buildRollLandingClip(rigId: string): AnimationClip {
  const clip = createAnimationClip({ id: ROLL_LANDING_CLIP_ID,
    name: 'Board Dismount — Shoulder Roll to Run', rigId, duration: ROLL_LANDING_DURATION });
  clip.loop.mode = 'once';
  const samples = Array.from({ length: 81 }, (_, i) => i / 80);
  const rotation = (joint: string, pose: (p: number) => Vec3Tuple) => {
    const id = `${clip.id}:${joint}:rotation`;
    clip.tracks.push({ id, kind: 'quaternion', target: joint, keys: samples.map((p, i) => ({
      id: `${id}:${i}`, time: p * clip.duration, interpolation: 'linear',
      value: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose(p), 'XYZ')).toArray() as QuaternionTuple,
    })) });
  };
  const position = (joint: string, pose: (p: number) => Vec3Tuple) => {
    const id = `${clip.id}:${joint}:position`;
    clip.tracks.push({ id, kind: 'position', target: joint, keys: samples.map((p, i) => ({
      id: `${id}:${i}`, time: p * clip.duration, interpolation: 'linear', value: pose(p),
    })) });
  };
  const tuck = (p: number) => Math.sin(Math.PI * smooth((p - .04) / .66));
  rotation('root', p => [curve(PITCH, p), .075 * tuck(p), -.16 * tuck(p)]);
  position('root', p => {
    const pitch = curve(PITCH, p), pivot = .82;
    return [.045 * tuck(p), pivot * (1 - Math.cos(pitch)) - .28 * tuck(p), -pivot * Math.sin(pitch)];
  });
  position('hips', p => [0, -.08 * tuck(p), 0]);
  rotation('hips', p => [.07 * tuck(p), 0, .08 * tuck(p)]);
  rotation('spine', p => [.12 + .48 * tuck(p), .10 * tuck(p), -.10 * tuck(p)]);
  rotation('chest', p => [.16 * tuck(p), -.12 * tuck(p), .08 * tuck(p)]);
  rotation('neck', p => [.18 * tuck(p), -.10 * tuck(p), 0]);
  rotation('head', p => [.72 * tuck(p) - .12 * smooth((p - .55) / .2), -.24 * tuck(p), .12 * tuck(p)]);
  for (const [side, sign, hips, knees, arms] of [
    ['Left', 1, HIP_L, KNEE_L, ARM_L], ['Right', -1, HIP_R, KNEE_R, ARM_R],
  ] as const) {
    rotation(`hip${side}`, p => [curve(hips, p), sign * .07 * tuck(p), sign * (.06 + .09 * tuck(p))]);
    rotation(`knee${side}`, p => [curve(knees, p), 0, 0]);
    rotation(`ankle${side}`, p => [-.28 - .30 * tuck(p), 0, 0]);
    rotation(`toe${side}`, p => [.15 * smooth((p - .6) / .12) * (1 - smooth((p - .8) / .2)), 0, 0]);
    rotation(`clavicle${side}`, p => [0, 0, sign * .08 * tuck(p)]);
    rotation(`shoulder${side}`, p => [curve(arms, p), sign * .10 * tuck(p), sign * (.18 + .20 * tuck(p))]);
    rotation(`elbow${side}`, p => [-.55 - 1.10 * tuck(Math.max(0, p - .03)), 0, sign * .12]);
    rotation(`wrist${side}`, p => [.28 * tuck(Math.max(0, p - .055)), sign * .12, 0]);
  }
  rotation('tail', p => [-.28 * tuck(Math.max(0, p - .065)), .12 * tuck(p), 0]);
  clip.markers = [['catch', .08], ['shoulder', .25], ['back', .43], ['foot-plant', .65], ['run', .84]]
    .map(([name, p]) => ({ id: `${clip.id}:${name}`, name: String(name), time: Number(p) * clip.duration }));
  clip.tags = ['player', 'landing', 'shoulder-roll', 'momentum', 'squash-stretch'];
  clip.metadata = { progressSource: 'gameplay-actionProgress',
    motionDesign: 'palm catch / tucked shoulder roll / staggered foot plant / live run handoff',
    rootMotion: 'presentation waist pivot only; world velocity belongs to gameplay' };
  return clip;
}
