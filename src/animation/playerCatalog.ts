import * as THREE from 'three';
import { createAnimationSuiteDocument, createProceduralDriver } from './document';
import { PLAYER_PROCEDURAL_RIG_ID } from './rigBinding';
import type {
  AnimationClip,
  AnimationContact,
  AnimationSuiteDocument,
  AnimationTrack,
  KeyInterpolation,
  QuaternionTuple,
  RigDefinition,
  Vec3Tuple,
} from './types';

export const PLAYER_DEFORMATION_CONTROLS = {
  torso: 'deform.torso.length',
  armUpperLeft: 'deform.arm.upper.left.length',
  armLowerLeft: 'deform.arm.lower.left.length',
  armUpperRight: 'deform.arm.upper.right.length',
  armLowerRight: 'deform.arm.lower.right.length',
  legUpperLeft: 'deform.leg.upper.left.length',
  legLowerLeft: 'deform.leg.lower.left.length',
  legUpperRight: 'deform.leg.upper.right.length',
  legLowerRight: 'deform.leg.lower.right.length',
} as const;

export const PLAYER_STARTER_CLIP_IDS = [
  'player.idle',
  'player.run',
  'player.jump',
  'player.fall',
  'player.land',
  'player.crouch',
  'player.crawl',
  'player.slide',
  'player.skate',
  'player.grind',
  'player.grab',
  'player.hang',
  'player.climb',
  'player.rope',
  'player.slam',
  'player.bail',
  'player.spin',
] as const;

type TimedScalar = readonly [time: number, value: number, interpolation?: KeyInterpolation];
type TimedVector = readonly [time: number, value: Vec3Tuple, interpolation?: KeyInterpolation];
type TimedEuler = readonly [time: number, x: number, y: number, z: number, interpolation?: KeyInterpolation];

function baseClip(
  id: string,
  name: string,
  duration: number,
  loopMode: AnimationClip['loop']['mode'],
  rigId: string,
): AnimationClip {
  return {
    id,
    name,
    rigId,
    duration,
    playbackSpeed: 1,
    loop: { mode: loopMode, seamless: loopMode !== 'once' },
    range: { start: 0, end: duration },
    rootMotion: { mode: 'in-place' },
    transformSpace: 'rest-local-delta',
    tracks: [],
    proceduralOrder: 'procedural-then-keyed',
    proceduralDrivers: [],
    markers: [],
    contacts: [],
    events: [],
    tags: ['player', 'starter-authored'],
    metadata: { starterQuality: 'authored-foundation' },
  };
}

function quaternionFromEuler(x: number, y: number, z: number): QuaternionTuple {
  return new THREE.Quaternion()
    .setFromEuler(new THREE.Euler(x, y, z, 'XYZ'))
    .toArray() as QuaternionTuple;
}

function quaternionTrack(clipId: string, target: string, values: TimedEuler[]): AnimationTrack {
  const id = `${clipId}:${target}:quaternion`;
  return {
    id,
    kind: 'quaternion',
    target,
    keys: values.map(([time, x, y, z, interpolation = 'cubic'], index) => ({
      id: `${id}:key-${index}`,
      time,
      value: quaternionFromEuler(x, y, z),
      interpolation,
    })),
  };
}

function positionTrack(clipId: string, target: string, values: TimedVector[]): AnimationTrack {
  const id = `${clipId}:${target}:position`;
  return {
    id,
    kind: 'position',
    target,
    keys: values.map(([time, value, interpolation = 'cubic'], index) => ({
      id: `${id}:key-${index}`,
      time,
      value: [...value],
      interpolation,
    })),
  };
}

function scalarTrack(clipId: string, target: string, values: TimedScalar[]): AnimationTrack {
  const id = `${clipId}:${target}:scalar`;
  return {
    id,
    kind: 'scalar',
    target,
    keys: values.map(([time, value, interpolation = 'cubic'], index) => ({
      id: `${id}:key-${index}`,
      time,
      value,
      interpolation,
    })),
  };
}

function contact(
  id: string,
  start: number,
  end: number,
  effector: string,
  mode: AnimationContact['mode'] = 'plant',
): AnimationContact {
  return { id, start, end, effector, mode, weight: 1 };
}

function buildIdle(rigId: string): AnimationClip {
  const clip = baseClip('player.idle', 'Idle — Breathing Starter', 2, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0, 0]], [1, [0, 0.018, 0]], [2, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.015, 0, -0.025], [1, -0.012, 0.02, 0.025], [2, 0.015, 0, -0.025]]),
    quaternionTrack(clip.id, 'head', [[0, 0.015, -0.02, 0.012], [1, -0.01, 0.02, -0.012], [2, 0.015, -0.02, 0.012]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, 0.03, 0, 0.025], [1, -0.015, 0, -0.018], [2, 0.03, 0, 0.025]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -0.015, 0, -0.018], [1, 0.03, 0, 0.025], [2, -0.015, 0, -0.018]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1], [1, 1.025], [2, 1]]),
  ];
  clip.contacts = [
    contact(`${clip.id}:foot-left`, 0, 2, 'footLeft'),
    contact(`${clip.id}:foot-right`, 0, 2, 'footRight'),
  ];
  clip.proceduralDrivers = [
    createProceduralDriver('oscillator', { kind: 'position', target: 'root', component: 'y' }, {
      id: `${clip.id}:driver:breathing-rise`,
      name: 'Breathing rise',
      order: 0,
      source: 'time',
      waveform: 'sine',
      amplitude: 0.012,
      frequency: 0.5,
      phase: 0,
    }),
    createProceduralDriver('oscillator', { kind: 'quaternion', target: 'spine', axis: [0, 0, 1] }, {
      id: `${clip.id}:driver:weight-shift`,
      name: 'Weight shift',
      order: 1,
      source: 'time',
      waveform: 'sine',
      amplitude: 0.022,
      frequency: 0.5,
      phase: 0.25,
    }),
    createProceduralDriver('oscillator', {
      kind: 'scalar',
      target: PLAYER_DEFORMATION_CONTROLS.torso,
      baseValue: 1,
    }, {
      id: `${clip.id}:driver:torso-breath`,
      name: 'Torso breath',
      order: 2,
      blend: 'override',
      source: 'time',
      waveform: 'sine',
      amplitude: 0.018,
      frequency: 0.5,
      phase: 0,
      bias: 1,
      clamp: [0.96, 1.04],
    }),
  ];
  return clip;
}

function buildRun(rigId: string): AnimationClip {
  const clip = baseClip('player.run', 'Run — Gait Starter', 0.8, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0, 0]], [0.2, [0, 0.035, 0]], [0.4, [0, 0, 0]], [0.6, [0, 0.035, 0]], [0.8, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.08, -0.06, 0], [0.2, 0.03, 0, 0.025], [0.4, 0.08, 0.06, 0], [0.6, 0.03, 0, -0.025], [0.8, 0.08, -0.06, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.72, 0, 0], [0.4, 0.68, 0, 0], [0.8, -0.72, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 1.1, 0, 0], [0.2, 0.25, 0, 0], [0.4, 0.65, 0, 0], [0.6, 1.32, 0, 0], [0.8, 1.1, 0, 0]]),
    quaternionTrack(clip.id, 'ankleLeft', [[0, -0.3, 0, 0], [0.4, -0.15, 0, 0], [0.8, -0.3, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, 0.68, 0, 0], [0.4, -0.72, 0, 0], [0.8, 0.68, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.65, 0, 0], [0.2, 1.32, 0, 0], [0.4, 1.1, 0, 0], [0.6, 0.25, 0, 0], [0.8, 0.65, 0, 0]]),
    quaternionTrack(clip.id, 'ankleRight', [[0, -0.15, 0, 0], [0.4, -0.3, 0, 0], [0.8, -0.15, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, 0.62, 0, 0.08], [0.4, -0.68, 0, -0.04], [0.8, 0.62, 0, 0.08]]),
    quaternionTrack(clip.id, 'elbowLeft', [[0, -0.4, 0, 0], [0.4, -0.85, 0, 0], [0.8, -0.4, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -0.68, 0, 0.04], [0.4, 0.62, 0, -0.08], [0.8, -0.68, 0, 0.04]]),
    quaternionTrack(clip.id, 'elbowRight', [[0, -0.85, 0, 0], [0.4, -0.4, 0, 0], [0.8, -0.85, 0, 0]]),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-stance`, 0.04, 0.22, 'footLeft'),
    contact(`${clip.id}:right-stance`, 0.44, 0.62, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:left-strike`, time: 0.04, name: 'Left foot strike' },
    { id: `${clip.id}:right-strike`, time: 0.44, name: 'Right foot strike' },
  ];
  clip.proceduralDrivers = [
    createProceduralDriver('oscillator', { kind: 'position', target: 'root', component: 'y' }, {
      id: `${clip.id}:driver:gait-bounce`,
      name: 'Gait bounce',
      order: 0,
      source: 'gaitPhase',
      waveform: 'sine',
      amplitude: 0.026,
      frequency: 2,
      phase: 0,
    }),
    createProceduralDriver('oscillator', { kind: 'quaternion', target: 'shoulderLeft', axis: [1, 0, 0] }, {
      id: `${clip.id}:driver:arm-swing-left`,
      name: 'Left arm gait swing',
      order: 1,
      source: 'gaitPhase',
      waveform: 'sine',
      amplitude: 0.24,
      frequency: 1,
      phase: 0,
    }),
    createProceduralDriver('oscillator', { kind: 'quaternion', target: 'shoulderRight', axis: [1, 0, 0] }, {
      id: `${clip.id}:driver:arm-swing-right`,
      name: 'Right arm gait swing',
      order: 2,
      source: 'gaitPhase',
      waveform: 'sine',
      amplitude: 0.24,
      frequency: 1,
      phase: 0.5,
    }),
  ];
  return clip;
}

function buildJump(rigId: string): AnimationClip {
  const clip = baseClip('player.jump', 'Jump — Independent Stretch Starter', 0.75, 'once', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, -0.03, 0]], [0.14, [0, -0.12, 0.025]], [0.31, [0, 0.1, -0.015]], [0.75, [0, 0.045, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.12, 0, 0], [0.14, 0.28, 0, 0], [0.31, -0.12, 0, 0], [0.75, -0.02, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.42, 0, 0], [0.14, -0.72, 0, 0], [0.31, 0.08, 0, 0], [0.75, -0.2, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.88, 0, 0], [0.14, 1.42, 0, 0], [0.31, 0.12, 0, 0], [0.75, 0.5, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.38, 0, 0], [0.14, -0.67, 0, 0], [0.31, 0.03, 0, 0], [0.75, -0.24, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.82, 0, 0], [0.14, 1.36, 0, 0], [0.31, 0.16, 0, 0], [0.75, 0.55, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, 0.35, 0, -0.12], [0.14, 0.62, 0, -0.18], [0.34, -2.55, 0, -0.2], [0.75, -2.1, 0, -0.12]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, 0.32, 0, 0.12], [0.14, 0.58, 0, 0.18], [0.34, -2.48, 0, 0.2], [0.75, -2.05, 0, 0.12]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 0.94], [0.14, 0.82], [0.31, 1.22], [0.58, 1.12], [0.75, 1.04]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 0.94], [0.14, 0.86], [0.31, 1.19], [0.75, 1.08]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 0.96], [0.14, 0.88], [0.34, 1.26], [0.75, 1.1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 0.96], [0.14, 0.87], [0.33, 1.17], [0.75, 1.07]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 0.95], [0.14, 0.89], [0.36, 1.23], [0.75, 1.09]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 0.9], [0.14, 0.72], [0.3, 1.28], [0.58, 1.14], [0.75, 1.04]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 0.91], [0.14, 0.75], [0.32, 1.34], [0.58, 1.16], [0.75, 1.05]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 0.91], [0.14, 0.74], [0.31, 1.25], [0.58, 1.13], [0.75, 1.03]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 0.92], [0.14, 0.76], [0.33, 1.31], [0.58, 1.15], [0.75, 1.05]]),
  ];
  clip.markers = [
    { id: `${clip.id}:anticipation`, time: 0.14, name: 'Deepest anticipation' },
    { id: `${clip.id}:takeoff`, time: 0.3, name: 'Takeoff stretch' },
    { id: `${clip.id}:apex`, time: 0.58, name: 'Apex' },
  ];
  clip.events = [{ id: `${clip.id}:launch`, time: 0.3, name: 'launch' }];
  return clip;
}

function buildFall(rigId: string): AnimationClip {
  const clip = baseClip('player.fall', 'Fall — Air Silhouette Starter', 0.9, 'loop', rigId);
  clip.tracks = [
    quaternionTrack(clip.id, 'spine', [[0, -0.06, 0, -0.04], [0.45, 0.04, 0, 0.04], [0.9, -0.06, 0, -0.04]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.38, 0, 0.08], [0.45, -0.55, 0, -0.05], [0.9, -0.38, 0, 0.08]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.72, 0, 0], [0.45, 0.92, 0, 0], [0.9, 0.72, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.52, 0, -0.05], [0.45, -0.34, 0, 0.08], [0.9, -0.52, 0, -0.05]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.9, 0, 0], [0.45, 0.7, 0, 0], [0.9, 0.9, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, -1.4, 0, -0.35], [0.45, -1.15, 0, -0.2], [0.9, -1.4, 0, -0.35]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -1.15, 0, 0.2], [0.45, -1.4, 0, 0.35], [0.9, -1.15, 0, 0.2]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1.08], [0.45, 1.12], [0.9, 1.08]]),
  ];
  return clip;
}

function buildLand(rigId: string): AnimationClip {
  const clip = baseClip('player.land', 'Land — Independent Compression Starter', 0.45, 'once', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0.04, 0]], [0.075, [0, -0.18, 0.035]], [0.2, [0, -0.055, -0.012]], [0.45, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, -0.04, 0, 0], [0.075, 0.42, 0, 0], [0.2, 0.16, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.18, 0, 0], [0.075, -0.86, 0, 0.04], [0.2, -0.45, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.38, 0, 0], [0.075, 1.52, 0, 0], [0.2, 0.82, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.22, 0, 0], [0.085, -0.8, 0, -0.04], [0.21, -0.42, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.42, 0, 0], [0.085, 1.46, 0, 0], [0.21, 0.78, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, -1.75, 0, -0.1], [0.075, 0.65, 0, -0.3], [0.2, -0.2, 0, -0.1], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -1.7, 0, 0.1], [0.085, 0.6, 0, 0.3], [0.21, -0.18, 0, 0.1], [0.45, 0, 0, 0]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1.1], [0.075, 0.62], [0.2, 1.1], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 1.08], [0.075, 0.78], [0.2, 1.06], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 1.1], [0.075, 0.82], [0.2, 1.08], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 1.07], [0.085, 0.8], [0.21, 1.05], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 1.09], [0.085, 0.81], [0.21, 1.07], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 1.08], [0.075, 0.66], [0.2, 1.1], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 1.1], [0.075, 0.7], [0.2, 1.08], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 1.07], [0.085, 0.68], [0.21, 1.09], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 1.09], [0.085, 0.72], [0.21, 1.07], [0.45, 1]]),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-foot`, 0.055, 0.45, 'footLeft'),
    contact(`${clip.id}:right-foot`, 0.065, 0.45, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:impact`, time: 0.075, name: 'Impact compression' },
    { id: `${clip.id}:rebound`, time: 0.2, name: 'Rebound overshoot' },
  ];
  clip.events = [{ id: `${clip.id}:impact-event`, time: 0.075, name: 'land-impact' }];
  return clip;
}

function buildCrouch(rigId: string): AnimationClip {
  const clip = baseClip('player.crouch', 'Crouch — Compression Starter', 0.6, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, -0.11, 0.025]], [0.3, [0, -0.125, 0.03]], [0.6, [0, -0.11, 0.025]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.24, 0, 0], [0.3, 0.28, 0, 0], [0.6, 0.24, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.62, 0, 0], [0.6, -0.62, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 1.22, 0, 0], [0.6, 1.22, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.62, 0, 0], [0.6, -0.62, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 1.22, 0, 0], [0.6, 1.22, 0, 0]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 0.88], [0.3, 0.84], [0.6, 0.88]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 0.82], [0.6, 0.82]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 0.8], [0.6, 0.8]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 0.82], [0.6, 0.82]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 0.8], [0.6, 0.8]]),
  ];
  clip.contacts = [contact(`${clip.id}:left`, 0, 0.6, 'footLeft'), contact(`${clip.id}:right`, 0, 0.6, 'footRight')];
  return clip;
}

function buildCrawl(rigId: string): AnimationClip {
  const clip = baseClip('player.crawl', 'Crawl — Four-Point Gait Starter', 1.2, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, -0.24, 0]], [0.3, [0, -0.21, 0.015]], [0.6, [0, -0.24, 0]], [0.9, [0, -0.21, 0.015]], [1.2, [0, -0.24, 0]]]),
    quaternionTrack(clip.id, 'torsoRoot', [[0, 1.02, 0, -0.04], [0.6, 1.02, 0, 0.04], [1.2, 1.02, 0, -0.04]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -1.08, 0, 0.08], [0.6, -0.5, 0, -0.04], [1.2, -1.08, 0, 0.08]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 1.82, 0, 0], [0.6, 1.15, 0, 0], [1.2, 1.82, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.5, 0, 0.04], [0.6, -1.08, 0, -0.08], [1.2, -0.5, 0, 0.04]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 1.15, 0, 0], [0.6, 1.82, 0, 0], [1.2, 1.15, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, -1.25, 0, -0.22], [0.6, -0.72, 0, -0.08], [1.2, -1.25, 0, -0.22]]),
    quaternionTrack(clip.id, 'elbowLeft', [[0, 0.28, 0, 0], [0.6, 0.82, 0, 0], [1.2, 0.28, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -0.72, 0, 0.08], [0.6, -1.25, 0, 0.22], [1.2, -0.72, 0, 0.08]]),
    quaternionTrack(clip.id, 'elbowRight', [[0, 0.82, 0, 0], [0.6, 0.28, 0, 0], [1.2, 0.82, 0, 0]]),
    quaternionTrack(clip.id, 'head', [[0, -0.5, -0.08, 0], [0.6, -0.42, 0.08, 0], [1.2, -0.5, -0.08, 0]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 0.9], [0.6, 0.94], [1.2, 0.9]]),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-hand`, 0, 0.28, 'gripLeft', 'grip'),
    contact(`${clip.id}:right-foot`, 0, 0.28, 'footRight'),
    contact(`${clip.id}:right-hand`, 0.6, 0.88, 'gripRight', 'grip'),
    contact(`${clip.id}:left-foot`, 0.6, 0.88, 'footLeft'),
  ];
  return clip;
}

function buildSlide(rigId: string): AnimationClip {
  const clip = baseClip('player.slide', 'Slide — Low Silhouette Starter', 0.8, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, -0.15, 0]], [0.4, [0, -0.17, 0.01]], [0.8, [0, -0.15, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.38, 0, -0.12], [0.4, 0.42, 0, -0.08], [0.8, 0.38, 0, -0.12]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.78, 0, 0.12], [0.8, -0.78, 0, 0.12]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 1.42, 0, 0], [0.8, 1.42, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.58, 0, -0.15], [0.8, -0.58, 0, -0.15]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 1.08, 0, 0], [0.8, 1.08, 0, 0]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 0.82], [0.4, 0.78], [0.8, 0.82]]),
  ];
  return clip;
}

function buildSkate(rigId: string): AnimationClip {
  const clip = baseClip('player.skate', 'Skate Push — Starter', 0.9, 'loop', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0, 0]], [0.45, [0, -0.045, 0.015]], [0.9, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.12, 0, -0.03], [0.45, 0.26, 0.08, 0.08], [0.9, 0.12, 0, -0.03]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.32, 0, 0], [0.45, 0.76, 0, 0.28], [0.9, -0.32, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.64, 0, 0], [0.45, 0.38, 0, 0], [0.9, 0.64, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.44, 0, 0], [0.45, -0.56, 0, 0], [0.9, -0.44, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.88, 0, 0], [0.45, 1.02, 0, 0], [0.9, 0.88, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, 0.24, 0, 0.08], [0.45, -0.45, 0, -0.12], [0.9, 0.24, 0, 0.08]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -0.4, 0, -0.06], [0.45, 0.3, 0, 0.12], [0.9, -0.4, 0, -0.06]]),
  ];
  clip.contacts = [contact(`${clip.id}:board-foot`, 0, 0.9, 'footRight')];
  clip.events = [{ id: `${clip.id}:push`, time: 0.48, name: 'push' }];
  return clip;
}

function placeholder(id: string, label: string, duration: number, rigId: string): AnimationClip {
  const clip = baseClip(id, `${label} — Starter Placeholder`, duration, 'once', rigId);
  clip.loop.seamless = false;
  clip.tags = ['player', 'starter-placeholder'];
  clip.metadata = {
    starterQuality: 'identity-placeholder',
    note: 'Rest-pose slot ready for browser keyframing.',
  };
  return clip;
}

export function createPlayerStarterClips(rigId = PLAYER_PROCEDURAL_RIG_ID): AnimationClip[] {
  return [
    buildIdle(rigId),
    buildRun(rigId),
    buildJump(rigId),
    buildFall(rigId),
    buildLand(rigId),
    buildCrouch(rigId),
    buildCrawl(rigId),
    buildSlide(rigId),
    buildSkate(rigId),
    placeholder('player.grind', 'Grind', 1, rigId),
    placeholder('player.grab', 'Grab', 0.8, rigId),
    placeholder('player.hang', 'Hang', 1, rigId),
    placeholder('player.climb', 'Climb', 1.2, rigId),
    placeholder('player.rope', 'Rope', 1.2, rigId),
    placeholder('player.slam', 'Slam', 0.7, rigId),
    placeholder('player.bail', 'Bail', 1.1, rigId),
    placeholder('player.spin', 'Spin', 0.8, rigId),
  ];
}

export function createPlayerStarterAnimationSuite(rig: RigDefinition): AnimationSuiteDocument {
  const clips = createPlayerStarterClips(rig.id);
  return createAnimationSuiteDocument({
    id: 'player-animation-suite',
    name: 'Player Animation Suite',
    rigs: [rig],
    clips,
    activeClipId: 'player.idle',
  });
}
