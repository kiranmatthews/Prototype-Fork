import * as THREE from 'three';
import { createAnimationSuiteDocument, createProceduralDriver } from './document';
import { PLAYER_PROCEDURAL_RIG_ID } from './rigBinding';
import {
  QUATERNIUS_JOG_FWD_DURATION,
  QUATERNIUS_JOG_FWD_ROOT_KEYS,
  QUATERNIUS_JOG_FWD_ROTATION_KEYS,
  QUATERNIUS_JOG_FWD_SOURCE,
} from './quaterniusJogFwd.generated';
import {
  UNITY_SLAM_ANTICIPATION_POSE_DEGREES,
  UNITY_SLAM_FALL_POSE_DEGREES,
  UNITY_SLAM_POSE_SOURCE,
  UNITY_SLAM_POSE_TIMING,
  type UnitySlamLimbPoseDegrees,
} from './unitySlamPose';
import type {
  AnimationClip,
  AnimationContact,
  AnimationSuiteDocument,
  AnimationTrack,
  KeyInterpolation,
  ProceduralDriverDefinition,
  ProceduralDriverTarget,
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
  'player.pace-stop',
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

/**
 * Source-catalog revision, independent from the serialized suite schema.
 * A saved suite records the revision it has seen so reconciliation can add
 * newly introduced starters and upgrade an exact untouched source starter,
 * without resurrecting deletions or overwriting browser-authored work.
 */
export const PLAYER_STARTER_CATALOG_VERSION = 5;

const PLAYER_STARTER_CATALOG_METADATA_KEY = 'playerStarterCatalogVersion';
const PRE_JOG_RUN_BACKUP_ID = 'player.run.pre-jog-local';

// FNV-1a of the canonical catalog-v2 Run starter with rigId omitted. An exact
// shipped gait can be replaced directly; an edited pre-Jog Run gets a backup
// clip before `player.run` adopts Jog_Fwd.
const LEGACY_RUN_STARTER_SIGNATURES = new Set([
  '225688c1', // source-created catalog v2 clip
  '182166e3', // normalized/migrated catalog v2 browser draft
]);

function stableCatalogValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableCatalogValue(entry)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableCatalogValue(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function starterClipSignature(clip: AnimationClip): string {
  const { rigId: _liveRigId, ...portableClip } = clip;
  const source = stableCatalogValue(portableClip);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function isJogFwdRun(clip: AnimationClip): boolean {
  const source = clip.metadata?.sourceAnimation;
  return source !== null && typeof source === 'object' && !Array.isArray(source) &&
    source.sourceClip === 'Jog_Fwd_Loop';
}

function isUntouchedSlamPlaceholder(clip: AnimationClip): boolean {
  return clip.id === 'player.slam' &&
    clip.metadata?.starterQuality === 'identity-placeholder' &&
    clip.tracks.length === 0 &&
    clip.proceduralDrivers.length === 0;
}

function preJogRunBackup(clip: AnimationClip): AnimationClip {
  return {
    ...structuredClone(clip),
    id: PRE_JOG_RUN_BACKUP_ID,
    name: `${clip.name} — Local Backup`,
    tags: [...(clip.tags ?? []), 'local-backup', 'pre-jog-fwd'],
    metadata: {
      ...(clip.metadata ?? {}),
      localBackup: {
        reason: 'player.run replaced by Quaternius Jog_Fwd',
        catalogVersion: PLAYER_STARTER_CATALOG_VERSION,
      },
    },
  };
}

const PLAYER_STARTER_CLIP_INTRODUCED_IN_VERSION: Record<
  typeof PLAYER_STARTER_CLIP_IDS[number],
  number
> = {
  'player.idle': 1,
  'player.run': 1,
  'player.pace-stop': 2,
  'player.jump': 1,
  'player.fall': 1,
  'player.land': 1,
  'player.crouch': 1,
  'player.crawl': 1,
  'player.slide': 1,
  'player.skate': 1,
  'player.grind': 1,
  'player.grab': 1,
  'player.hang': 1,
  'player.climb': 1,
  'player.rope': 1,
  'player.slam': 1,
  'player.bail': 1,
  'player.spin': 1,
};

type TimedScalar = readonly [time: number, value: number, interpolation?: KeyInterpolation];
type TimedVector = readonly [time: number, value: Vec3Tuple, interpolation?: KeyInterpolation];
type TimedEuler = readonly [time: number, x: number, y: number, z: number, interpolation?: KeyInterpolation];
type SampledVector = readonly [time: number, value: readonly [number, number, number]];
type SampledQuaternion = readonly [
  time: number,
  value: readonly [number, number, number, number],
];

const IDLE_ENTRY = {
  root: [0, 0, 0] as Vec3Tuple,
  spine: [0.015, 0, -0.025] as const,
  head: [0.015, -0.02, 0.012] as const,
  shoulderLeft: [0.03, 0, 0.025] as const,
  shoulderRight: [-0.015, 0, -0.018] as const,
  torsoLength: 1,
};

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

function sampledPositionTrack(
  clipId: string,
  target: string,
  values: readonly SampledVector[],
): AnimationTrack {
  const id = `${clipId}:${target}:position`;
  return {
    id,
    kind: 'position',
    target,
    keys: values.map(([time, value], index) => ({
      id: `${id}:key-${index}`,
      time,
      value: [...value],
      interpolation: 'linear',
    })),
  };
}

function sampledQuaternionTrack(
  clipId: string,
  target: string,
  values: readonly SampledQuaternion[],
): AnimationTrack {
  const id = `${clipId}:${target}:quaternion`;
  return {
    id,
    kind: 'quaternion',
    target,
    keys: values.map(([time, value], index) => ({
      id: `${id}:key-${index}`,
      time,
      value: [...value] as QuaternionTuple,
      interpolation: 'linear',
    })),
  };
}

function combinedQuaternionSamples(
  parent: readonly SampledQuaternion[],
  child: readonly SampledQuaternion[],
): SampledQuaternion[] {
  if (parent.length !== child.length) throw new Error('sampled quaternion clocks differ');
  return parent.map(([time, parentValue], index) => {
    const [childTime, childValue] = child[index];
    if (Math.abs(time - childTime) > 1e-6) throw new Error('sampled quaternion times differ');
    const value = new THREE.Quaternion()
      .fromArray([...parentValue])
      .multiply(new THREE.Quaternion().fromArray([...childValue]))
      .normalize()
      .toArray() as QuaternionTuple;
    return [time, value];
  });
}

function sampledRunRotationTracks(
  clipId: string,
  includeTorsoRoot: boolean,
): AnimationTrack[] {
  const torsoRoot = QUATERNIUS_JOG_FWD_ROTATION_KEYS.torsoRoot;
  return Object.entries(QUATERNIUS_JOG_FWD_ROTATION_KEYS).flatMap(([jointId, rawKeys]) => {
    if (!includeTorsoRoot && jointId === 'torsoRoot') return [];
    const keys = !includeTorsoRoot && jointId === 'spine'
      ? combinedQuaternionSamples(torsoRoot, rawKeys)
      : rawKeys;
    return [sampledQuaternionTrack(clipId, jointId, keys)];
  });
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
    positionTrack(clip.id, 'root', [[0, IDLE_ENTRY.root], [1, [0, 0.018, 0]], [2, IDLE_ENTRY.root]]),
    quaternionTrack(clip.id, 'spine', [[0, ...IDLE_ENTRY.spine], [1, -0.012, 0.02, 0.025], [2, ...IDLE_ENTRY.spine]]),
    quaternionTrack(clip.id, 'head', [[0, ...IDLE_ENTRY.head], [1, -0.01, 0.02, -0.012], [2, ...IDLE_ENTRY.head]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, ...IDLE_ENTRY.shoulderLeft], [1, -0.015, 0, -0.018], [2, ...IDLE_ENTRY.shoulderLeft]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, ...IDLE_ENTRY.shoulderRight], [1, 0.03, 0, 0.025], [2, ...IDLE_ENTRY.shoulderRight]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, IDLE_ENTRY.torsoLength], [1, 1.025], [2, IDLE_ENTRY.torsoLength]]),
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
      // Zero at the loop seam so one-shot transitions can hand off to the
      // authored idle entry exactly; the sway develops immediately afterward.
      phase: 0,
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

function buildRun(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    'player.run',
    'Run — Quaternius Jog_Fwd',
    QUATERNIUS_JOG_FWD_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    sampledPositionTrack(clip.id, 'root', QUATERNIUS_JOG_FWD_ROOT_KEYS),
    ...sampledRunRotationTracks(clip.id, includeTorsoRoot),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-stance`, 0.055, 0.185, 'footLeft'),
    contact(`${clip.id}:right-stance`, 0.522, 0.652, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:left-strike`, time: 0.067, name: 'Left foot strike' },
    { id: `${clip.id}:right-strike`, time: 0.533, name: 'Right foot strike' },
  ];
  // The imported clip already owns its cadence, bounce and arm counter-swing.
  // Keeping the old gait drivers would double those motions and stop this from
  // being the Quaternius animation the user selected.
  clip.proceduralDrivers = [];
  clip.tags = [...(clip.tags ?? []), 'quaternius', 'jog-fwd', 'imported-keyframes'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    sourceAnimation: { ...QUATERNIUS_JOG_FWD_SOURCE },
  };
  return clip;
}

interface DampedOscillatorOptions {
  name: string;
  order: number;
  source?: string;
  amplitude: number;
  frequency: number;
  phase?: number;
  waveform?: 'sine' | 'triangle' | 'saw';
}

/**
 * A pure, scrub-safe damped oscillator assembled from the existing driver
 * graph: the oscillator writes a channel, then a one-shot envelope multiplies
 * that same channel from one to zero over actionProgress.
 */
function dampedOscillator(
  clipId: string,
  id: string,
  target: ProceduralDriverTarget,
  options: DampedOscillatorOptions,
): ProceduralDriverDefinition[] {
  return [
    createProceduralDriver('oscillator', target, {
      id: `${clipId}:driver:${id}`,
      name: options.name,
      order: options.order,
      source: options.source ?? 'time',
      waveform: options.waveform ?? 'sine',
      amplitude: options.amplitude,
      frequency: options.frequency,
      phase: options.phase ?? 0,
    }),
    createProceduralDriver('envelope', target, {
      id: `${clipId}:driver:${id}-decay`,
      name: `${options.name} decay`,
      order: options.order + 1,
      blend: 'multiply',
      source: 'actionProgress',
      amplitude: 1,
      frequency: 1,
      phase: 0,
      bias: 0,
      clamp: [0, 1],
      attack: 0,
      hold: 0,
      release: 1,
      loop: false,
    }),
  ];
}

/**
 * Two extra multipliers turn a captured outgoing gait sample into a short
 * residual shoulder swing. Runtime supplies the frozen entry phase and speed;
 * the result remains deterministic and decays under the same action clock.
 */
function entryCarry(
  clipId: string,
  side: 'left' | 'right',
  target: ProceduralDriverTarget,
  order: number,
  phase: number,
): ProceduralDriverDefinition[] {
  return [
    createProceduralDriver('oscillator', target, {
      id: `${clipId}:driver:entry-carry-${side}`,
      name: `${side === 'left' ? 'Left' : 'Right'} outgoing gait carry`,
      order,
      source: 'transitionEntryGaitPhase',
      amplitude: 0.18,
      frequency: 1,
      phase,
    }),
    createProceduralDriver('response', target, {
      id: `${clipId}:driver:entry-carry-${side}-speed`,
      name: `${side === 'left' ? 'Left' : 'Right'} carry speed`,
      order: order + 1,
      blend: 'multiply',
      source: 'transitionEntrySpeed',
      amplitude: 1,
      inputRange: [0.25, 1],
      responseCurve: 'smoothstep',
    }),
    createProceduralDriver('envelope', target, {
      id: `${clipId}:driver:entry-carry-${side}-decay`,
      name: `${side === 'left' ? 'Left' : 'Right'} carry decay`,
      order: order + 2,
      blend: 'multiply',
      source: 'actionProgress',
      amplitude: 1,
      clamp: [0, 1],
      attack: 0,
      hold: 0,
      release: 1,
      loop: false,
    }),
  ];
}

function buildPaceStop(rigId: string): AnimationClip {
  const clip = baseClip('player.pace-stop', 'Pace Stop — Transitional Idle', 1.8, 'once', rigId);
  clip.loop.seamless = false;
  clip.tags = ['player', 'transition', 'locomotion-stop', 'procedural-keyed'];
  clip.metadata = {
    starterQuality: 'authored-foundation',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    transitionFrom: 'player.run',
    transitionTo: 'player.idle',
    progressSource: 'clip-traversal',
  };
  clip.tracks = [
    // No X/Z displacement: the pace is strictly in place. Vertical catches
    // diminish over three steps before landing on idle's exact root value.
    positionTrack(clip.id, 'root', [
      [0, [0, 0.012, 0]], [0.18, [0, -0.025, 0]], [0.46, [0, 0.025, 0]],
      [0.68, [0, -0.018, 0]], [0.96, [0, 0.018, 0]], [1.2, [0, -0.01, 0]],
      [1.43, [0, 0.006, 0]], [1.62, [0, 0.003, 0]], [1.8, IDLE_ENTRY.root],
    ]),
    quaternionTrack(clip.id, 'hips', [
      [0, 0.02, 0.045, 0.045], [0.18, 0.035, -0.04, -0.05],
      [0.46, 0.02, 0.05, 0.045], [0.68, 0.025, -0.035, -0.04],
      [0.96, 0.015, 0.035, 0.03], [1.2, 0.015, -0.02, -0.025],
      [1.43, 0.005, 0.012, 0.012], [1.62, 0, -0.006, -0.006], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'spine', [
      [0, 0.1, -0.035, -0.04], [0.18, 0.12, 0.04, 0.055],
      [0.46, 0.085, -0.05, -0.045], [0.68, 0.07, 0.04, 0.04],
      [0.96, 0.045, -0.035, -0.03], [1.2, 0.025, 0.02, 0.02],
      [1.43, -0.012, -0.01, -0.01], [1.62, 0.008, 0.005, -0.018],
      [1.8, ...IDLE_ENTRY.spine],
    ]),
    // Upper-spine overlap arrives a fraction after the pelvis/spine reversal;
    // clavicles then finish after the chest instead of stopping as one block.
    quaternionTrack(clip.id, 'chest', [
      [0, 0.012, -0.025, -0.022], [0.18, 0.018, 0.032, 0.03],
      [0.46, 0.012, -0.038, -0.026], [0.68, 0.014, 0.03, 0.024],
      [0.96, 0.008, -0.024, -0.018], [1.2, 0.006, 0.014, 0.012],
      [1.43, -0.006, -0.007, -0.006], [1.62, 0.003, 0.002, 0.003], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'clavicleLeft', [
      [0, 0.012, 0, 0.025], [0.46, -0.014, 0, -0.022],
      [0.96, 0.01, 0, 0.016], [1.43, -0.005, 0, -0.007],
      [1.62, 0.002, 0, 0.003], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'clavicleRight', [
      [0, -0.014, 0, -0.026], [0.46, 0.012, 0, 0.021],
      [0.96, -0.012, 0, -0.017], [1.43, 0.005, 0, 0.007],
      [1.62, -0.002, 0, -0.003], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'neck', [
      [0, -0.025, 0.025, 0.012], [0.46, -0.018, -0.03, -0.012],
      [0.96, -0.01, 0.02, 0.008], [1.43, 0.008, -0.008, -0.004],
      [1.62, 0.003, 0.004, 0.002], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'head', [
      [0, -0.045, 0.03, 0.015], [0.18, -0.02, -0.035, -0.018],
      [0.46, -0.03, 0.04, 0.016], [0.68, -0.01, -0.03, -0.012],
      [0.96, -0.018, 0.025, 0.01], [1.2, 0.005, -0.018, -0.006],
      [1.43, 0.012, 0.012, 0.004], [1.62, 0.015, -0.006, 0.008],
      [1.8, ...IDLE_ENTRY.head],
    ]),
    quaternionTrack(clip.id, 'hipLeft', [
      [0, -0.42, 0, 0], [0.18, -0.18, 0, 0.025], [0.46, 0.12, 0, -0.015],
      [0.68, 0.26, 0, 0.02], [0.96, -0.34, 0, -0.015], [1.2, -0.08, 0, 0.01],
      [1.43, 0.04, 0, 0], [1.62, 0.01, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'kneeLeft', [
      [0, 0.58, 0, 0], [0.18, 0.28, 0, 0], [0.46, 0.24, 0, 0],
      [0.68, 0.52, 0, 0], [0.96, 0.82, 0, 0], [1.2, 0.22, 0, 0],
      [1.43, 0.12, 0, 0], [1.62, 0.06, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'ankleLeft', [
      [0, -0.18, 0, 0], [0.18, 0.08, 0, 0], [0.46, -0.04, 0, 0],
      [0.68, -0.1, 0, 0], [0.96, -0.22, 0, 0], [1.2, 0.06, 0, 0],
      [1.43, 0, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'hipRight', [
      [0, 0.34, 0, 0], [0.18, 0.34, 0, -0.02], [0.46, -0.48, 0, 0.02],
      [0.68, -0.14, 0, -0.02], [0.96, 0.1, 0, 0.015], [1.2, 0.18, 0, -0.01],
      [1.43, -0.16, 0, 0], [1.62, -0.02, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'kneeRight', [
      [0, 0.48, 0, 0], [0.18, 0.6, 0, 0], [0.46, 1.05, 0, 0],
      [0.68, 0.25, 0, 0], [0.96, 0.2, 0, 0], [1.2, 0.4, 0, 0],
      [1.43, 0.42, 0, 0], [1.62, 0.08, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'ankleRight', [
      [0, -0.08, 0, 0], [0.18, -0.12, 0, 0], [0.46, -0.28, 0, 0],
      [0.68, 0.08, 0, 0], [0.96, 0, 0, 0], [1.2, -0.08, 0, 0],
      [1.43, -0.12, 0, 0], [1.62, 0, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'toeRight', [
      [0, 0, 0, 0], [0.96, 0, 0, 0], [1.2, -0.04, 0, 0],
      [1.43, 0.22, 0, 0], [1.62, 0.055, 0, 0], [1.8, 0, 0, 0],
    ]),
    quaternionTrack(clip.id, 'shoulderLeft', [
      [0, 0.38, 0, 0.06], [0.18, 0.28, 0, 0.05], [0.46, -0.32, 0, -0.035],
      [0.68, -0.22, 0, -0.025], [0.96, 0.2, 0, 0.035], [1.2, 0.12, 0, 0.03],
      [1.43, -0.06, 0, 0], [1.62, 0.02, 0, 0.02], [1.8, ...IDLE_ENTRY.shoulderLeft],
    ]),
    quaternionTrack(clip.id, 'elbowLeft', [
      [0, -0.42, 0, 0], [0.46, -0.62, 0, 0], [0.96, -0.34, 0, 0],
      [1.43, -0.18, 0, 0], [1.62, -0.13, 0, 0], [1.8, -0.12, 0, 0],
    ]),
    quaternionTrack(clip.id, 'shoulderRight', [
      [0, -0.42, 0, -0.055], [0.18, -0.3, 0, -0.045], [0.46, 0.34, 0, 0.04],
      [0.68, 0.24, 0, 0.03], [0.96, -0.22, 0, -0.035], [1.2, -0.13, 0, -0.025],
      [1.43, 0.065, 0, 0], [1.62, -0.01, 0, -0.015], [1.8, ...IDLE_ENTRY.shoulderRight],
    ]),
    quaternionTrack(clip.id, 'elbowRight', [
      [0, -0.62, 0, 0], [0.46, -0.42, 0, 0], [0.96, -0.48, 0, 0],
      [1.43, -0.17, 0, 0], [1.62, -0.13, 0, 0], [1.8, -0.12, 0, 0],
    ]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [
      [0, 0.99], [0.18, 0.98], [0.46, 1.01], [0.68, 0.987], [0.96, 1.008],
      [1.2, 0.995], [1.43, 1.003], [1.62, 1], [1.8, IDLE_ENTRY.torsoLength],
    ]),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-brake`, 0.1, 0.36, 'footLeft'),
    contact(`${clip.id}:right-pace`, 0.52, 0.79, 'footRight'),
    contact(`${clip.id}:left-settle`, 0.94, 1.25, 'footLeft'),
    contact(`${clip.id}:left-rest`, 1.48, 1.8, 'footLeft'),
    contact(`${clip.id}:right-rest`, 1.48, 1.8, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:release-carry`, time: 0, name: 'Outgoing run carry' },
    { id: `${clip.id}:left-brake-strike`, time: 0.18, name: 'Left braking plant' },
    { id: `${clip.id}:right-pace-strike`, time: 0.68, name: 'Right pace plant' },
    { id: `${clip.id}:left-settle-strike`, time: 1.2, name: 'Left settling plant' },
    { id: `${clip.id}:feet-settled`, time: 1.62, name: 'Both feet settled' },
    { id: `${clip.id}:idle-ready`, time: 1.8, name: 'Idle-compatible pose' },
  ];
  clip.proceduralDrivers = [
    ...dampedOscillator(clip.id, 'pace-bounce', {
      kind: 'position', target: 'root', component: 'y',
    }, {
      name: 'Diminishing pace bounce', order: 0, amplitude: 0.012, frequency: 2.05, phase: 0.25,
    }),
    ...dampedOscillator(clip.id, 'chest-counter-twist', {
      kind: 'quaternion', target: 'chest', axis: [0, 1, 0],
    }, {
      name: 'Diminishing chest counter-twist', order: 2, amplitude: 0.035, frequency: 1.1, phase: 0.08,
    }),
    ...dampedOscillator(clip.id, 'neck-overlap', {
      kind: 'quaternion', target: 'neck', axis: [0, 0, 1],
    }, {
      name: 'Delayed neck settle', order: 4, amplitude: 0.018, frequency: 1.25, phase: -0.12,
    }),
    ...entryCarry(clip.id, 'left', {
      kind: 'quaternion', target: 'shoulderLeft', axis: [1, 0, 0],
    }, 6, 0),
    ...entryCarry(clip.id, 'right', {
      kind: 'quaternion', target: 'shoulderRight', axis: [1, 0, 0],
    }, 9, 0.5),
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

function buildUnitySlam(rigId: string): AnimationClip {
  const timing = UNITY_SLAM_POSE_TIMING;
  const clip = baseClip(
    'player.slam',
    'Body Slam — Unity Pose',
    timing.duration,
    'once',
    rigId,
  );
  clip.loop.seamless = false;
  const degreesToRadians = (degrees: number): number => THREE.MathUtils.degToRad(degrees);
  const poseKeys = (
    pick: (pose: Readonly<UnitySlamLimbPoseDegrees>) => readonly [number, number, number],
  ): TimedEuler[] => {
    const anticipation = pick(UNITY_SLAM_ANTICIPATION_POSE_DEGREES)
      .map(degreesToRadians) as [number, number, number];
    const fall = pick(UNITY_SLAM_FALL_POSE_DEGREES)
      .map(degreesToRadians) as [number, number, number];
    return [
      [0, ...anticipation, 'linear'],
      [timing.anticipationHoldEnd, ...anticipation, 'linear'],
      [timing.fallPoseReached, ...fall, 'linear'],
      [timing.duration, ...fall, 'linear'],
    ];
  };
  const pitchKeys = (
    pick: (pose: Readonly<UnitySlamLimbPoseDegrees>) => number,
  ): TimedEuler[] => poseKeys((pose) => [pick(pose), 0, 0]);
  clip.tracks = [
    quaternionTrack(clip.id, 'shoulderLeft', poseKeys((pose) => pose.shoulderLeft)),
    quaternionTrack(clip.id, 'shoulderRight', poseKeys((pose) => pose.shoulderRight)),
    quaternionTrack(clip.id, 'elbowLeft', pitchKeys(() => 0)),
    quaternionTrack(clip.id, 'elbowRight', pitchKeys(() => 0)),
    quaternionTrack(clip.id, 'hipLeft', pitchKeys((pose) => pose.hipLeft)),
    quaternionTrack(clip.id, 'hipRight', pitchKeys((pose) => pose.hipRight)),
    quaternionTrack(clip.id, 'kneeLeft', pitchKeys((pose) => pose.kneeLeft)),
    quaternionTrack(clip.id, 'kneeRight', pitchKeys((pose) => pose.kneeRight)),
  ];
  clip.markers = [
    { id: `${clip.id}:anticipation`, time: 0, name: 'Unity anticipation pose' },
    { id: `${clip.id}:drop`, time: timing.fallPoseReached, name: 'Unity falling pose' },
  ];
  clip.tags = ['player', 'unity-port', 'slam', 'semantic-keyframes'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    sourceAnimation: { ...UNITY_SLAM_POSE_SOURCE },
  };
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

export function createPlayerStarterClips(
  rig: string | RigDefinition = PLAYER_PROCEDURAL_RIG_ID,
): AnimationClip[] {
  const rigId = typeof rig === 'string' ? rig : rig.id;
  const includeTorsoRoot = typeof rig === 'string' ||
    rig.joints.some((joint) => joint.id === 'torsoRoot');
  return [
    buildIdle(rigId),
    buildRun(rigId, includeTorsoRoot),
    buildPaceStop(rigId),
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
    buildUnitySlam(rigId),
    placeholder('player.bail', 'Bail', 1.1, rigId),
    placeholder('player.spin', 'Spin', 0.8, rigId),
  ];
}

function savedStarterCatalogVersion(document: AnimationSuiteDocument): number {
  const value = document.metadata?.[PLAYER_STARTER_CATALOG_METADATA_KEY];
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

/**
 * Refresh the embedded live rig and add only starters introduced after the
 * revision a saved suite has already seen. Same-ID clips normally win; the
 * exceptions are the explicit Run -> Jog_Fwd replacement and upgrading the
 * untouched Slam identity placeholder to the Unity pose. A genuinely edited
 * pre-Jog Run is retained under a backup ID while `player.run` adopts the new
 * source motion. Once a suite records the current revision, a missing clip is
 * treated as an intentional deletion and remains missing on subsequent loads.
 */
export function reconcilePlayerStarterAnimationSuite(
  document: AnimationSuiteDocument,
  rig: RigDefinition,
): AnimationSuiteDocument {
  const previousVersion = savedStarterCatalogVersion(document);
  const rigIndex = document.rigs.findIndex((candidate) => candidate.id === rig.id);
  let rigs = document.rigs;
  if (rigIndex < 0) rigs = [...document.rigs, rig];
  else if (document.rigs[rigIndex] !== rig) {
    rigs = [...document.rigs];
    rigs[rigIndex] = rig;
  }
  if (previousVersion >= PLAYER_STARTER_CATALOG_VERSION) {
    return rigs === document.rigs ? document : { ...document, rigs };
  }

  const starters = createPlayerStarterClips(rig);
  let clips = document.clips;
  if (previousVersion < 4) {
    const importedRun = starters.find((clip) => clip.id === 'player.run')!;
    const currentRun = clips.find((clip) => clip.id === 'player.run');
    if (currentRun && !isJogFwdRun(currentRun)) {
      const shouldBackUp =
        !LEGACY_RUN_STARTER_SIGNATURES.has(starterClipSignature(currentRun)) &&
        !clips.some((clip) => clip.id === PRE_JOG_RUN_BACKUP_ID);
      clips = clips.map((clip) => clip.id === 'player.run' ? importedRun : clip);
      if (shouldBackUp) clips = [...clips, preJogRunBackup(currentRun)];
    }
  }
  if (previousVersion < 5) {
    const importedSlam = starters.find((clip) => clip.id === 'player.slam')!;
    const currentSlam = clips.find((clip) => clip.id === 'player.slam');
    if (currentSlam && isUntouchedSlamPlaceholder(currentSlam)) {
      clips = clips.map((clip) => clip.id === 'player.slam' ? importedSlam : clip);
    }
  }

  const existingIds = new Set(clips.map((clip) => clip.id));
  const additions = starters.filter((clip) => {
    if (existingIds.has(clip.id)) return false;
    const introduced = PLAYER_STARTER_CLIP_INTRODUCED_IN_VERSION[
      clip.id as typeof PLAYER_STARTER_CLIP_IDS[number]
    ];
    return introduced > previousVersion && introduced <= PLAYER_STARTER_CATALOG_VERSION;
  });
  return {
    ...document,
    rigs,
    clips: additions.length > 0 ? [...clips, ...additions] : clips,
    metadata: {
      ...(document.metadata ?? {}),
      [PLAYER_STARTER_CATALOG_METADATA_KEY]: PLAYER_STARTER_CATALOG_VERSION,
    },
  };
}

export function createPlayerStarterAnimationSuite(rig: RigDefinition): AnimationSuiteDocument {
  const clips = createPlayerStarterClips(rig);
  const document = createAnimationSuiteDocument({
    id: 'player-animation-suite',
    name: 'Player Animation Suite',
    rigs: [rig],
    clips,
    activeClipId: 'player.idle',
  });
  document.metadata = {
    ...(document.metadata ?? {}),
    [PLAYER_STARTER_CATALOG_METADATA_KEY]: PLAYER_STARTER_CATALOG_VERSION,
  };
  return document;
}
