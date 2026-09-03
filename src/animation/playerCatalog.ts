import * as THREE from 'three';
import { createAnimationSuiteDocument, createProceduralDriver } from './document';
import { PLAYER_PROCEDURAL_RIG_ID } from './rigBinding';
import {
  FORWARD_ROLL_SQUASH_MULTIPLIER,
  FORWARD_ROLL_TUCK_INPUT,
} from './forwardRoll';
import {
  UNITY_ROPE_ANIMATION_SOURCE,
  UNITY_ROPE_CLIMB_DURATION,
  UNITY_ROPE_CLIMB_ROTATION_KEYS,
  UNITY_ROPE_HANG_DURATION,
  UNITY_ROPE_HANG_ROTATION_KEYS,
  UNITY_ROPE_RELEASE_BACKFLIP_DURATION,
  UNITY_ROPE_RELEASE_BACKFLIP_ROTATION_KEYS,
  UNITY_ROPE_RELEASE_SWING_DURATION,
  UNITY_ROPE_RELEASE_SWING_ROTATION_KEYS,
} from './unityRopeAnimations.generated';
import {
  UNITY_ROPE_CLIP_IDS,
  UNITY_ROPE_INPUTS,
} from './unityRope';
import {
  UNITY_CRAWL_DURATION,
  UNITY_CRAWL_HIPS_POSITION_KEYS,
  UNITY_CRAWL_ROTATION_KEYS,
  UNITY_CROUCH_CRAWL_ANIMATION_SOURCE,
  UNITY_CROUCH_IDLE_DURATION,
  UNITY_CROUCH_IDLE_HIPS_POSITION_KEYS,
  UNITY_CROUCH_IDLE_ROTATION_KEYS,
} from './unityCrouchCrawlAnimations.generated';
import {
  UNITY_CROUCH_CRAWL_CLIP_IDS,
  UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP,
  UNITY_CROUCH_CRAWL_TIMING,
} from './unityCrouchCrawl';
import {
  LOCOMOTION_WALK_BLEND_INPUT,
  PLAYER_WALK_CLIP_ID,
} from './locomotionBlend';
import {
  QUATERNIUS_JOG_FWD_DURATION,
  QUATERNIUS_JOG_FWD_ROOT_KEYS,
  QUATERNIUS_JOG_FWD_ROTATION_KEYS,
  QUATERNIUS_JOG_FWD_SOURCE,
} from './quaterniusJogFwd.generated';
import {
  QUATERNIUS_WALK_DURATION,
  QUATERNIUS_WALK_ROOT_KEYS,
  QUATERNIUS_WALK_ROTATION_KEYS,
  QUATERNIUS_WALK_SOURCE,
} from './quaterniusWalk.generated';
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
  'player.walk',
  'player.run',
  'player.jump',
  'player.double-jump',
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
  'player.rope-climb',
  'player.rope-release',
  'player.rope-release-charged',
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
export const PLAYER_STARTER_CATALOG_VERSION = 18;
export const UNITY_CRAWL_CONTACT_ADAPTATION =
  'runtime-and-studio palm-down ground socket IK';

const PLAYER_STARTER_CATALOG_METADATA_KEY = 'playerStarterCatalogVersion';
const PRE_JOG_RUN_BACKUP_ID = 'player.run.pre-jog-local';
const RETIRED_PACE_STOP_CLIP_ID = 'player.pace-stop';

// FNV-1a of the canonical catalog-v2 Run starter with rigId omitted. An exact
// shipped gait can be replaced directly; an edited pre-Jog Run gets a backup
// clip before `player.run` adopts Jog_Fwd.
const LEGACY_RUN_STARTER_SIGNATURES = new Set([
  '225688c1', // source-created catalog v2 clip
  '182166e3', // normalized/migrated catalog v2 browser draft
]);

const LEGACY_AIRBORNE_STARTER_SIGNATURES: Readonly<Record<string, ReadonlySet<string>>> = {
  'player.jump': new Set([
    '5a112f6f', // source catalog v6
    '792240e4', // normalized legacy-rig draft
    '08bf4483', // normalized conventional-rig draft
    '61b49347', // normalized live sculpt-runtime draft
    '97aaf1d4', // source catalog v8
    'd95f5658', // normalized catalog-v8 draft
  ]),
  'player.double-jump': new Set([
    '17b2768b', // source catalog v6
    '2c3edae2', // normalized legacy-rig draft
    '9cbb8b2b', // normalized conventional-rig draft
    'af898501', // normalized live sculpt-runtime draft
  ]),
  'player.fall': new Set([
    'f45194a1', 'fa07436b', '4aa17e81',
    'e9bb6a36', // source catalog v8
    'afce5c82', // normalized catalog-v8 draft
  ]),
  'player.land': new Set(['baa768b5', '44fd70c1', '7612e407']),
};

const LEGACY_CROUCH_CRAWL_STARTER_SIGNATURES: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  'player.crouch': new Set(['c93f806a', '4d0dd720']),
  'player.crawl': new Set(['7f7a1648', '1608c78e']),
};

/** Semantic signatures tolerate harmless JSON round-trip ordering and
 * sub-picometre quaternion normalization drift seen in long-lived browsers. */
const LEGACY_CROUCH_CRAWL_CANONICAL_SIGNATURES: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  'player.crouch': new Set(['b7595ec0']),
  'player.crawl': new Set(['3672794d']),
};

const LEGACY_UNITY_CRAWL_SIGNATURES = new Set(['522225c8']);
const LEGACY_UNITY_CRAWL_CANONICAL_SIGNATURES = new Set(['fadfab96']);
const LEGACY_YAWED_UNITY_CROUCH_SIGNATURES = new Set([
  '562671e0', // source catalog v13
  '2270a781', // deployed/browser-restored v13
  '757cd61b', // deployed catalog v12
]);
const LEGACY_YAWED_UNITY_CROUCH_CANONICAL_SIGNATURES = new Set([
  'a890da41', // source catalog v13
  'e574b172', // deployed/browser-restored v13
  'ed746188', // deployed catalog v12
]);
const LEGACY_STATIC_LANDING_SIGNATURES = new Set([
  ...LEGACY_AIRBORNE_STARTER_SIGNATURES['player.land'],
  '7f302bef', // source catalog v15
  '778dcc73', // normalized/browser catalog v15
  '7736ff6e', // deployed/browser-restored catalog v8
]);
const LEGACY_STATIC_LANDING_CANONICAL_SIGNATURES = new Set([
  'a1e20e94',
  '4fda89e9', // deployed/browser-restored catalog v8
]);

function stableCatalogValue(value: unknown, quantizeNumbers = false): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) =>
      stableCatalogValue(entry, quantizeNumbers)).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) =>
        `${JSON.stringify(key)}:${stableCatalogValue(record[key], quantizeNumbers)}`);
    return `{${entries.join(',')}}`;
  }
  if (quantizeNumbers && typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value * 1e12) / 1e12;
    return JSON.stringify(Object.is(rounded, -0) ? 0 : rounded);
  }
  return JSON.stringify(value) ?? 'null';
}

function hashCatalogValue(value: unknown, quantizeNumbers = false): string {
  const source = stableCatalogValue(value, quantizeNumbers);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function starterClipSignature(clip: AnimationClip): string {
  const { rigId: _liveRigId, ...portableClip } = clip;
  return hashCatalogValue(portableClip);
}

function canonicalLegacyStarterClipSignature(clip: AnimationClip): string {
  const { rigId: _liveRigId, ...portableClip } = clip;
  const byId = <T extends { id: string }>(a: T, b: T) => a.id.localeCompare(b.id);
  const byTimeThenId = <T extends { id: string; time: number }>(a: T, b: T) =>
    a.time - b.time || byId(a, b);
  const canonical = {
    ...portableClip,
    tracks: [...portableClip.tracks]
      .sort(byId)
      .map((track) => ({ ...track, keys: [...track.keys].sort(byTimeThenId) })),
    proceduralDrivers: [...portableClip.proceduralDrivers]
      .sort((a, b) => a.order - b.order || byId(a, b)),
    markers: [...portableClip.markers].sort(byTimeThenId),
    contacts: [...portableClip.contacts]
      .sort((a, b) => a.start - b.start || a.end - b.end || byId(a, b)),
    events: [...portableClip.events].sort(byTimeThenId),
    tags: [...(portableClip.tags ?? [])].sort(),
  };
  return hashCatalogValue(canonical, true);
}

function withCrawlWristYawRevision(clip: AnimationClip): AnimationClip {
  if (clip.metadata?.wristYawRevision === 1) return clip;
  const halfTurn = new THREE.Quaternion(0, 1, 0, 0);
  return {
    ...clip,
    tracks: clip.tracks.map((track) => {
      if (
        track.kind !== 'quaternion' ||
        (track.target !== 'wristLeft' && track.target !== 'wristRight')
      ) return track;
      return {
        ...track,
        keys: track.keys.map((key) => ({
          ...key,
          value: new THREE.Quaternion()
            .fromArray(key.value)
            .multiply(halfTurn)
            .normalize()
            .toArray() as QuaternionTuple,
        })),
      };
    }),
    metadata: {
      ...clip.metadata,
      wristYawRevision: 1,
      wristYawCorrectionDegrees: 180,
    },
  };
}

function forwardRollSquashDrivers(clipId: string): ProceduralDriverDefinition[] {
  return Object.values(PLAYER_DEFORMATION_CONTROLS).map((controlId, index) =>
    createProceduralDriver('response', {
      kind: 'scalar',
      target: controlId,
      baseValue: 1,
    }, {
      id: `${clipId}:driver:forward-roll-squash:${controlId}`,
      name: `Forward-roll squash · ${controlId}`,
      order: 900 + index,
      blend: 'multiply',
      source: FORWARD_ROLL_TUCK_INPUT,
      amplitude: FORWARD_ROLL_SQUASH_MULTIPLIER - 1,
      bias: 1,
      clamp: [FORWARD_ROLL_SQUASH_MULTIPLIER, 1],
      inputRange: [0, 1],
      responseCurve: 'smootherstep',
    }));
}

function hasForwardRollSquashLayer(clip: AnimationClip): boolean {
  return clip.proceduralDrivers.some((driver) =>
    driver.source === FORWARD_ROLL_TUCK_INPUT &&
    driver.target.kind === 'scalar');
}

function withForwardRollSquashLayer(clip: AnimationClip): AnimationClip {
  if (hasForwardRollSquashLayer(clip)) return clip;
  return {
    ...clip,
    proceduralOrder: 'keyed-then-procedural',
    proceduralDrivers: [...clip.proceduralDrivers, ...forwardRollSquashDrivers(clip.id)],
    tags: [...new Set([...(clip.tags ?? []), 'forward-roll-squash'])],
    metadata: {
      ...(clip.metadata ?? {}),
      forwardRollInput: FORWARD_ROLL_TUCK_INPUT,
      forwardRollSquashMultiplier: FORWARD_ROLL_SQUASH_MULTIPLIER,
    },
  };
}

function isJogFwdRun(clip: AnimationClip): boolean {
  const source = clip.metadata?.sourceAnimation;
  return source !== null && typeof source === 'object' && !Array.isArray(source) &&
    source.sourceClip === 'Jog_Fwd_Loop';
}

function isUnityWalkingWomanWalk(clip: AnimationClip): boolean {
  if (clip.id !== PLAYER_WALK_CLIP_ID) return false;
  if (clip.name === 'Walk — Unity PunkyFox Walking Woman') return true;
  const source = clip.metadata?.sourceAnimation;
  if (source === null || typeof source !== 'object' || Array.isArray(source))
    return false;
  return source.sourceName === 'Walking Woman' ||
    source.sourceAsset ===
      'Assets/Game/Art/Characters/PunkyFox/Generated/PunkyFox_Walk.anim';
}

function isUntouchedSlamPlaceholder(clip: AnimationClip): boolean {
  return clip.id === 'player.slam' &&
    clip.metadata?.starterQuality === 'identity-placeholder' &&
    clip.tracks.length === 0 &&
    clip.proceduralDrivers.length === 0;
}

function isUntouchedRopePlaceholder(clip: AnimationClip): boolean {
  return clip.id === UNITY_ROPE_CLIP_IDS.hang &&
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
  'player.walk': 17,
  'player.run': 1,
  'player.jump': 1,
  'player.double-jump': 6,
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
  'player.rope-climb': 10,
  'player.rope-release': 10,
  'player.rope-release-charged': 10,
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

function sampledRotationTracks(
  clipId: string,
  values: Readonly<Record<string, readonly SampledQuaternion[]>>,
  includeTorsoRoot = true,
  excludedJoints: ReadonlySet<string> = new Set(),
): AnimationTrack[] {
  return Object.entries(values).flatMap(([jointId, keys]) =>
    (!includeTorsoRoot && jointId === 'torsoRoot') || excludedJoints.has(jointId)
      ? []
      : [sampledQuaternionTrack(clipId, jointId, keys)]);
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

function sampledQuaterniusRotationTracks(
  clipId: string,
  values: Readonly<Record<string, readonly SampledQuaternion[]>>,
  includeTorsoRoot: boolean,
): AnimationTrack[] {
  const torsoRoot = values.torsoRoot;
  return Object.entries(values).flatMap(([jointId, rawKeys]) => {
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
    ...sampledQuaterniusRotationTracks(
      clip.id,
      QUATERNIUS_JOG_FWD_ROTATION_KEYS,
      includeTorsoRoot,
    ),
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
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    sourceAnimation: { ...QUATERNIUS_JOG_FWD_SOURCE },
    variantBlend: {
      clipId: PLAYER_WALK_CLIP_ID,
      source: LOCOMOTION_WALK_BLEND_INPUT,
    },
  };
  return clip;
}

function buildJump(rigId: string): AnimationClip {
  const clip = baseClip('player.jump', 'Jump — Stretch, Apex Squash', 1, 'once', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0.08, 0]], [0.1, [0, 0.14, -0.01]], [0.5, [0, 0.12, -0.01]], [0.85, [0, 0, 0.005]], [1, [0, -0.08, 0.015]]]),
    quaternionTrack(clip.id, 'spine', [[0, -0.12, 0, 0], [0.1, -0.18, 0, 0], [0.5, -0.1, 0, 0], [0.85, 0.08, 0, 0], [1, 0.22, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, 0.08, 0, 0], [0.1, 0.15, 0, 0], [0.5, 0.05, 0, 0], [0.85, -0.42, 0, 0], [1, -0.78, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.12, 0, 0], [0.1, 0.06, 0, 0], [0.5, 0.18, 0, 0], [0.85, 0.92, 0, 0], [1, 1.45, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, 0.05, 0, 0], [0.1, 0.12, 0, 0], [0.5, 0.03, 0, 0], [0.85, -0.39, 0, 0], [1, -0.74, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.12, 0, 0], [0.1, 0.06, 0, 0], [0.5, 0.18, 0, 0], [0.85, 0.88, 0, 0], [1, 1.4, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, -2.45, 0, 0.18], [0.1, -2.62, 0, 0.22], [0.5, -2.48, 0, 0.2], [0.85, -0.65, 0, 0.14], [1, 0.45, 0, 0.12]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -2.4, 0, -0.18], [0.1, -2.58, 0, -0.22], [0.5, -2.44, 0, -0.2], [0.85, -0.62, 0, -0.14], [1, 0.42, 0, -0.12]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1.25], [0.1, 1.42], [0.5, 1.36], [0.85, 0.9], [1, 0.78]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 1.24], [0.1, 1.34], [0.5, 1.3], [0.85, 0.92], [1, 0.86]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 1.3], [0.1, 1.42], [0.5, 1.36], [0.85, 0.88], [1, 0.82]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 1.24], [0.1, 1.34], [0.5, 1.3], [0.85, 0.92], [1, 0.86]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 1.3], [0.1, 1.42], [0.5, 1.36], [0.85, 0.88], [1, 0.82]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 1.4], [0.1, 1.55], [0.5, 1.48], [0.85, 0.82], [1, 0.74]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 1.48], [0.1, 1.65], [0.5, 1.56], [0.85, 0.78], [1, 0.7]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 1.4], [0.1, 1.55], [0.5, 1.48], [0.85, 0.82], [1, 0.74]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 1.48], [0.1, 1.65], [0.5, 1.56], [0.85, 0.78], [1, 0.7]]),
  ];
  clip.markers = [
    { id: `${clip.id}:takeoff-stretch`, time: 0.1, name: 'Maximum rising stretch' },
    { id: `${clip.id}:apex-squash`, time: 1, name: 'Apex catch-up squash' },
  ];
  clip.events = [{ id: `${clip.id}:launch`, time: 0, name: 'launch' }];
  clip.tags = [
    'player', 'jump', 'squash-stretch', 'rise-stretch', 'apex-squash',
  ];
  clip.metadata = {
    starterQuality: 'authored-foundation',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    deformationArc: 'charged squash -> rising stretch -> apex squash -> neutral fall',
  };
  return withForwardRollSquashLayer(clip);
}

function buildDoubleJump(rigId: string): AnimationClip {
  const clip = baseClip(
    'player.double-jump',
    'Double Jump — Split High Jump',
    1,
    'once',
    rigId,
  );
  clip.loop.seamless = false;
  clip.tracks = [
    // Keep the editable inner rider root neutral; gameplay also gates the
    // outer legacy somersault with doubleJumpAir before this layer is sampled.
    quaternionTrack(clip.id, 'root', [
      [0, 0, 0, 0, 'linear'], [1, 0, 0, 0, 'linear'],
    ]),
    quaternionTrack(clip.id, 'spine', [
      [0, 0, 0, 0, 'linear'], [0.12, -0.06, 0, 0, 'linear'],
      [0.5, 0.08, 0, 0, 'linear'], [1, 0, 0, 0, 'linear'],
    ]),
    quaternionTrack(clip.id, 'hipLeft', [
      [0, -0.2, 0, 0.8, 'linear'], [0.12, -0.3, 0, 1.18, 'linear'],
      [0.5, -0.42, 0, 1.08, 'linear'], [1, -0.12, 0, 0.8, 'linear'],
    ]),
    quaternionTrack(clip.id, 'hipRight', [
      [0, -0.2, 0, -0.8, 'linear'], [0.12, -0.3, 0, -1.18, 'linear'],
      [0.5, -0.42, 0, -1.08, 'linear'], [1, -0.12, 0, -0.8, 'linear'],
    ]),
    quaternionTrack(clip.id, 'kneeLeft', [
      [0, 0.12, 0, 0, 'linear'], [0.12, 0.06, 0, 0, 'linear'],
      [0.5, 0.32, 0, 0, 'linear'], [1, 0.18, 0, 0, 'linear'],
    ]),
    quaternionTrack(clip.id, 'kneeRight', [
      [0, 0.12, 0, 0, 'linear'], [0.12, 0.06, 0, 0, 'linear'],
      [0.5, 0.32, 0, 0, 'linear'], [1, 0.18, 0, 0, 'linear'],
    ]),
    quaternionTrack(clip.id, 'shoulderLeft', [
      [0, -0.15, 0, 1.9, 'linear'], [0.12, -0.25, 0, 2.3, 'linear'],
      [0.5, 0.15, 0, 2.15, 'linear'], [1, -0.05, 0, 1.75, 'linear'],
    ]),
    quaternionTrack(clip.id, 'shoulderRight', [
      [0, -0.15, 0, -1.9, 'linear'], [0.12, -0.25, 0, -2.3, 'linear'],
      [0.5, 0.15, 0, -2.15, 'linear'], [1, -0.05, 0, -1.75, 'linear'],
    ]),
    quaternionTrack(clip.id, 'elbowLeft', [
      [0, -0.12, 0, 0, 'linear'], [1, -0.12, 0, 0, 'linear'],
    ]),
    quaternionTrack(clip.id, 'elbowRight', [
      [0, -0.12, 0, 0, 'linear'], [1, -0.12, 0, 0, 'linear'],
    ]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1.16], [0.12, 1.26], [0.5, 0.84], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 1.12], [0.12, 1.2], [0.5, 0.9], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 1.16], [0.12, 1.24], [0.5, 0.88], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 1.12], [0.12, 1.2], [0.5, 0.9], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 1.16], [0.12, 1.24], [0.5, 0.88], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 1.2], [0.12, 1.3], [0.5, 0.82], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 1.24], [0.12, 1.36], [0.5, 0.78], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 1.2], [0.12, 1.3], [0.5, 0.82], [0.72, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 1.24], [0.12, 1.36], [0.5, 0.78], [0.72, 1], [1, 1]]),
  ];
  clip.markers = [
    { id: `${clip.id}:split`, time: 0.12, name: 'Full split' },
    { id: `${clip.id}:apex`, time: 0.5, name: 'High-jump apex squash' },
  ];
  clip.tags = ['player', 'double-jump', 'split', 'high-jump', 'no-roll'];
  clip.metadata = {
    starterQuality: 'authored-foundation',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    poseIntent: 'upright split-legged high jump; no forward somersault',
  };
  return clip;
}

function buildFall(rigId: string): AnimationClip {
  const clip = baseClip('player.fall', 'Fall — Apex Squash to Neutral', 1, 'once', rigId);
  clip.loop.seamless = false;
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, -0.08, 0.015]], [0.18, [0, -0.04, 0.01]], [0.38, [0, 0, 0]], [1, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, 0.22, 0, 0], [0.18, 0.12, 0, 0], [0.38, 0.02, 0, 0], [1, 0.02, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.78, 0, 0], [0.18, -0.48, 0, 0], [0.38, -0.25, 0, 0.04], [1, -0.25, 0, 0.04]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 1.45, 0, 0], [0.18, 0.9, 0, 0], [0.38, 0.5, 0, 0], [1, 0.5, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.74, 0, 0], [0.18, -0.46, 0, 0], [0.38, -0.28, 0, -0.04], [1, -0.28, 0, -0.04]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 1.4, 0, 0], [0.18, 0.86, 0, 0], [0.38, 0.54, 0, 0], [1, 0.54, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, 0.45, 0, 0.12], [0.18, -0.35, 0, 0.06], [0.38, -1.2, 0, -0.22], [1, -1.2, 0, -0.22]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, 0.42, 0, -0.12], [0.18, -0.32, 0, -0.06], [0.38, -1.15, 0, 0.22], [1, -1.15, 0, 0.22]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 0.78], [0.18, 0.9], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 0.86], [0.18, 0.94], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 0.82], [0.18, 0.91], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 0.86], [0.18, 0.94], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 0.82], [0.18, 0.91], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 0.74], [0.18, 0.88], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 0.7], [0.18, 0.84], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 0.74], [0.18, 0.88], [0.38, 1], [1, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 0.7], [0.18, 0.84], [0.38, 1], [1, 1]]),
  ];
  clip.markers = [
    { id: `${clip.id}:apex-squash`, time: 0, name: 'Apex catch-up squash' },
    { id: `${clip.id}:neutral`, time: 0.38, name: 'Neutral descent' },
  ];
  clip.tags = [
    'player', 'fall', 'squash-stretch', 'neutralize',
  ];
  clip.metadata = {
    starterQuality: 'authored-foundation',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    deformationArc: 'apex squash -> neutral descent',
  };
  return withForwardRollSquashLayer(clip);
}

function buildLand(rigId: string): AnimationClip {
  const clip = baseClip('player.land', 'Land — Independent Compression Starter', 0.45, 'once', rigId);
  clip.tracks = [
    positionTrack(clip.id, 'root', [[0, [0, 0.04, 0]], [0.075, [0, -0.18, 0.035]], [0.18, [0, 0.06, -0.012]], [0.3, [0, 0.015, 0]], [0.45, [0, 0, 0]]]),
    quaternionTrack(clip.id, 'spine', [[0, -0.04, 0, 0], [0.075, 0.42, 0, 0], [0.2, 0.16, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'hipLeft', [[0, -0.18, 0, 0], [0.075, -0.86, 0, 0.04], [0.2, -0.45, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'kneeLeft', [[0, 0.38, 0, 0], [0.075, 1.52, 0, 0], [0.2, 0.82, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'hipRight', [[0, -0.22, 0, 0], [0.085, -0.8, 0, -0.04], [0.21, -0.42, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'kneeRight', [[0, 0.42, 0, 0], [0.085, 1.46, 0, 0], [0.21, 0.78, 0, 0], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderLeft', [[0, -1.75, 0, -0.1], [0.075, 0.65, 0, -0.3], [0.2, -0.2, 0, -0.1], [0.45, 0, 0, 0]]),
    quaternionTrack(clip.id, 'shoulderRight', [[0, -1.7, 0, 0.1], [0.085, 0.6, 0, 0.3], [0.21, -0.18, 0, 0.1], [0.45, 0, 0, 0]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.torso, [[0, 1], [0.075, 0.72], [0.18, 1.1], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 1], [0.075, 0.82], [0.18, 1.06], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 1], [0.075, 0.78], [0.18, 1.08], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 1], [0.075, 0.82], [0.18, 1.06], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 1], [0.075, 0.78], [0.18, 1.08], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperLeft, [[0, 1], [0.075, 0.68], [0.18, 1.08], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerLeft, [[0, 1], [0.075, 0.72], [0.18, 1.06], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legUpperRight, [[0, 1], [0.075, 0.68], [0.18, 1.08], [0.34, 0.98], [0.45, 1]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.legLowerRight, [[0, 1], [0.075, 0.72], [0.18, 1.06], [0.34, 0.98], [0.45, 1]]),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-foot`, 0.055, 0.45, 'footLeft'),
    contact(`${clip.id}:right-foot`, 0.065, 0.45, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:impact`, time: 0.075, name: 'Impact compression' },
    { id: `${clip.id}:rebound`, time: 0.18, name: 'Rebound overshoot' },
    { id: `${clip.id}:settle`, time: 0.34, name: 'Cushion settle' },
  ];
  clip.events = [{ id: `${clip.id}:impact-event`, time: 0.075, name: 'land-impact' }];
  clip.tags = ['player', 'landing', 'cushion', 'squash-stretch'];
  clip.metadata = {
    starterQuality: 'authored-foundation',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    deformationArc: 'neutral fall -> cushion squash -> rebound -> settle',
    continuedRunTransition: {
      impactCrossfadeSeconds: 0.06,
      blendStartSeconds: 0.055,
      blendEndSeconds: 0.28,
      phaseSource: 'touchdown gait phase plus authored playback clock',
      contactPolicy: 'phase-matched moving run feet; no gameplay or world-space foot lock',
    },
  };
  return clip;
}

function unityCrouchCrawlSourceMetadata(
  sourceKey: 'crouchIdle' | 'crawl',
) {
  return {
    ...UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.clips[sourceKey],
    bindAsset: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.bindAsset,
    bindAssetSha256: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.bindAssetSha256,
    sampleRate: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.sampleRate,
    maximumQuaternionErrorDegrees:
      UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.maximumQuaternionErrorDegrees,
    maximumHipsPositionError:
      UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.maximumHipsPositionError,
    conversion: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.conversion,
    translationPolicy: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.translationPolicy,
    rootYawPolicy: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.rootYawPolicy,
    loopPolicy: UNITY_CROUCH_CRAWL_ANIMATION_SOURCE.loopPolicy,
  };
}

function buildWalk(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    PLAYER_WALK_CLIP_ID,
    'Walk — Quaternius Walk_Loop',
    QUATERNIUS_WALK_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    sampledPositionTrack(clip.id, 'root', QUATERNIUS_WALK_ROOT_KEYS),
    ...sampledQuaterniusRotationTracks(
      clip.id,
      QUATERNIUS_WALK_ROTATION_KEYS,
      includeTorsoRoot,
    ),
  ];
  clip.contacts = [
    contact(`${clip.id}:right-stance-wrap`, 0, 0.067, 'footRight'),
    contact(`${clip.id}:left-stance`, 0.167, 0.667, 'footLeft'),
    contact(`${clip.id}:right-stance`, 0.833, clip.duration, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:left-strike`, time: 0.167, name: 'Left foot strike' },
    { id: `${clip.id}:right-strike`, time: 0.833, name: 'Right foot strike' },
  ];
  clip.tags = [
    'player', 'quaternius', 'walk-loop', 'walk', 'locomotion',
    'source-animation-retarget', 'imported-keyframes',
  ];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    sourceAnimation: { ...QUATERNIUS_WALK_SOURCE },
    locomotionBlend: {
      idleThreshold: 0,
      walkThreshold: 1 / 3,
      runThreshold: 1,
      input: LOCOMOTION_WALK_BLEND_INPUT,
    },
  };
  return clip;
}

function scaledUnityLowPosePositionKeys(
  keys: readonly SampledVector[],
): SampledVector[] {
  const scaleXZ = UNITY_CROUCH_CRAWL_TIMING.sourceModelScale / 1.18;
  const scaleY = UNITY_CROUCH_CRAWL_TIMING.sourceModelScale / 1.36;
  return keys.map(([time, value]) => [time, [
    value[0] * scaleXZ,
    value[1] * scaleY + UNITY_CROUCH_CRAWL_TIMING.floorLift / 1.36,
    value[2] * scaleXZ,
  ]]);
}

function buildCrouch(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    UNITY_CROUCH_CRAWL_CLIP_IDS.crouch,
    'Crouch Idle — Unity PunkyFox',
    UNITY_CROUCH_IDLE_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    sampledPositionTrack(
      clip.id,
      'hips',
      scaledUnityLowPosePositionKeys(UNITY_CROUCH_IDLE_HIPS_POSITION_KEYS),
    ),
    ...sampledRotationTracks(
      clip.id,
      UNITY_CROUCH_IDLE_ROTATION_KEYS,
      includeTorsoRoot,
    ),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-foot`, 0, clip.duration, 'footLeft'),
    contact(`${clip.id}:right-foot`, 0, clip.duration, 'footRight'),
  ];
  clip.markers = [
    { id: `${clip.id}:look`, time: clip.duration * 0.5, name: 'Look-around beat' },
  ];
  clip.tags = ['player', 'unity-port', 'crouch', 'idle', 'source-animation-retarget'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    sourceAnimation: unityCrouchCrawlSourceMetadata('crouchIdle'),
    floorLift: UNITY_CROUCH_CRAWL_TIMING.floorLift,
    outerPoseOwnership: UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP,
  };
  return clip;
}

function buildCrawl(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    UNITY_CROUCH_CRAWL_CLIP_IDS.crawl,
    'Crawl — Unity PunkyFox',
    UNITY_CRAWL_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    sampledPositionTrack(
      clip.id,
      'hips',
      scaledUnityLowPosePositionKeys(UNITY_CRAWL_HIPS_POSITION_KEYS),
    ),
    ...sampledRotationTracks(
      clip.id,
      UNITY_CRAWL_ROTATION_KEYS,
      includeTorsoRoot,
    ),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperLeft, [[0, 1.4], [clip.duration, 1.4]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerLeft, [[0, 1.4], [clip.duration, 1.4]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armUpperRight, [[0, 1.4], [clip.duration, 1.4]]),
    scalarTrack(clip.id, PLAYER_DEFORMATION_CONTROLS.armLowerRight, [[0, 1.4], [clip.duration, 1.4]]),
  ];
  const half = clip.duration * 0.5;
  const plantIn = clip.duration * 0.27;
  const plantOut = clip.duration * 0.73;
  clip.contacts = [
    contact(`${clip.id}:left-hand-a`, 0, plantIn, 'gripLeft'),
    contact(`${clip.id}:left-hand-b`, plantOut, clip.duration, 'gripLeft'),
    contact(`${clip.id}:right-foot-a`, 0, plantIn, 'footRight'),
    contact(`${clip.id}:right-foot-b`, plantOut, clip.duration, 'footRight'),
    contact(`${clip.id}:right-hand`, clip.duration * 0.23, clip.duration * 0.77, 'gripRight'),
    contact(`${clip.id}:left-foot`, clip.duration * 0.23, clip.duration * 0.77, 'footLeft'),
  ];
  clip.markers = [
    { id: `${clip.id}:left-diagonal`, time: 0, name: 'Left-hand diagonal plant' },
    { id: `${clip.id}:right-diagonal`, time: half, name: 'Right-hand diagonal plant' },
  ];
  clip.tags = ['player', 'unity-port', 'crawl', 'locomotion', 'source-animation-retarget'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    sourceAnimation: unityCrouchCrawlSourceMetadata('crawl'),
    floorLift: UNITY_CROUCH_CRAWL_TIMING.floorLift,
    outerPoseOwnership: UNITY_CROUCH_CRAWL_OUTER_POSE_OWNERSHIP,
    contactAdaptation: UNITY_CRAWL_CONTACT_ADAPTATION,
    wristYawRevision: 1,
    wristYawCorrectionDegrees: 180,
  };
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

type UnityRopeSourceKey = keyof typeof UNITY_ROPE_ANIMATION_SOURCE.clips;
const UNITY_ROPE_IK_AUTHORED_JOINTS = new Set([
  'clavicleLeft', 'shoulderLeft', 'elbowLeft',
  'clavicleRight', 'shoulderRight', 'elbowRight',
]);

function unityRopeGripTracks(
  clipId: string,
  duration: number,
  climbing: boolean,
): AnimationTrack[] {
  if (!climbing) {
    return [
      quaternionTrack(clipId, 'clavicleLeft', [[0, 0, 0, 0.04], [duration, 0, 0, 0.04]]),
      quaternionTrack(clipId, 'clavicleRight', [[0, 0, 0, -0.04], [duration, 0, 0, -0.04]]),
      quaternionTrack(clipId, 'shoulderLeft', [[0, 0, 0.5, -2.72], [duration, 0, 0.5, -2.72]]),
      quaternionTrack(clipId, 'shoulderRight', [[0, 0, -0.5, 2.72], [duration, 0, -0.5, 2.72]]),
      quaternionTrack(clipId, 'elbowLeft', [[0, -0.22, 0, 0], [duration, -0.22, 0, 0]]),
      quaternionTrack(clipId, 'elbowRight', [[0, -0.22, 0, 0], [duration, -0.22, 0, 0]]),
    ];
  }
  const q1 = duration * 0.25;
  const q2 = duration * 0.5;
  const q3 = duration * 0.75;
  return [
    quaternionTrack(clipId, 'clavicleLeft', [
      [0, 0, 0, 0.04], [q1, 0.08, 0, 0.12], [q2, 0, 0, 0.04],
      [q3, -0.08, 0, -0.04], [duration, 0, 0, 0.04],
    ]),
    quaternionTrack(clipId, 'clavicleRight', [
      [0, 0, 0, -0.04], [q1, -0.08, 0, 0.04], [q2, 0, 0, -0.04],
      [q3, 0.08, 0, -0.12], [duration, 0, 0, -0.04],
    ]),
    quaternionTrack(clipId, 'shoulderLeft', [
      [0, 0, 0.5, -2.72], [q1, -0.1, 0.4, -2.85], [q2, 0, 0.5, -2.72],
      [q3, -0.35, 0.35, -2.35], [duration, 0, 0.5, -2.72],
    ]),
    quaternionTrack(clipId, 'shoulderRight', [
      [0, 0, -0.5, 2.72], [q1, -0.35, -0.35, 2.35], [q2, 0, -0.5, 2.72],
      [q3, -0.1, -0.4, 2.85], [duration, 0, -0.5, 2.72],
    ]),
    quaternionTrack(clipId, 'elbowLeft', [
      [0, -0.22, 0, 0], [q1, -0.1, 0, 0], [q2, -0.22, 0, 0],
      [q3, -0.95, 0, 0], [duration, -0.22, 0, 0],
    ]),
    quaternionTrack(clipId, 'elbowRight', [
      [0, -0.22, 0, 0], [q1, -0.95, 0, 0], [q2, -0.22, 0, 0],
      [q3, -0.1, 0, 0], [duration, -0.22, 0, 0],
    ]),
  ];
}

function unityRopeSourceMetadata(sourceKey: UnityRopeSourceKey) {
  return {
    ...UNITY_ROPE_ANIMATION_SOURCE.clips[sourceKey],
    bindAsset: UNITY_ROPE_ANIMATION_SOURCE.bindAsset,
    bindAssetSha256: UNITY_ROPE_ANIMATION_SOURCE.bindAssetSha256,
    sampleRate: UNITY_ROPE_ANIMATION_SOURCE.sampleRate,
    maximumQuaternionErrorDegrees:
      UNITY_ROPE_ANIMATION_SOURCE.maximumQuaternionErrorDegrees,
    conversion: UNITY_ROPE_ANIMATION_SOURCE.conversion,
    translationPolicy: UNITY_ROPE_ANIMATION_SOURCE.translationPolicy,
  };
}

function buildUnityRopeHang(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    UNITY_ROPE_CLIP_IDS.hang,
    'Rope Hang — Unity PunkyFox',
    UNITY_ROPE_HANG_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    ...sampledRotationTracks(
      clip.id,
      UNITY_ROPE_HANG_ROTATION_KEYS,
      includeTorsoRoot,
      UNITY_ROPE_IK_AUTHORED_JOINTS,
    ),
    ...unityRopeGripTracks(clip.id, clip.duration, false),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-grip`, 0, clip.duration, 'gripLeft', 'grip'),
    contact(`${clip.id}:right-grip`, 0, clip.duration, 'gripRight', 'grip'),
  ];
  clip.markers = [
    { id: `${clip.id}:attached`, time: 0, name: 'Attached grip' },
    { id: `${clip.id}:idle-overlap`, time: clip.duration * 0.5, name: 'Hanging overlap' },
  ];
  clip.tags = ['player', 'unity-port', 'rope', 'hang', 'source-animation-retarget'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    sourceAnimation: unityRopeSourceMetadata('hang'),
    gripAdaptation: 'Unity post-animation two-bone solve; semantic preview keys',
    physicalSwingOwnership: 'gameplay rope; attached body samples idle independently',
  };
  return clip;
}

function buildUnityRopeClimb(rigId: string, includeTorsoRoot: boolean): AnimationClip {
  const clip = baseClip(
    UNITY_ROPE_CLIP_IDS.climb,
    'Rope Climb — Unity PunkyFox',
    UNITY_ROPE_CLIMB_DURATION,
    'loop',
    rigId,
  );
  clip.tracks = [
    ...sampledRotationTracks(
      clip.id,
      UNITY_ROPE_CLIMB_ROTATION_KEYS,
      includeTorsoRoot,
      UNITY_ROPE_IK_AUTHORED_JOINTS,
    ),
    ...unityRopeGripTracks(clip.id, clip.duration, true),
  ];
  clip.contacts = [
    contact(`${clip.id}:left-grip`, 0, clip.duration, 'gripLeft', 'grip'),
    contact(`${clip.id}:right-grip`, 0, clip.duration, 'gripRight', 'grip'),
  ];
  clip.markers = [
    { id: `${clip.id}:left-pull`, time: clip.duration * 0.25, name: 'Left pull' },
    { id: `${clip.id}:right-pull`, time: clip.duration * 0.75, name: 'Right pull' },
  ];
  clip.tags = ['player', 'unity-port', 'rope', 'climb', 'reversible', 'source-animation-retarget'];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    playbackDirectionSource: UNITY_ROPE_INPUTS.climbDirection,
    sourceAnimation: unityRopeSourceMetadata('climb'),
    gripAdaptation: 'Unity post-animation two-bone solve; semantic preview keys',
  };
  return clip;
}

function buildUnityRopeRelease(
  rigId: string,
  charged: boolean,
  includeTorsoRoot: boolean,
): AnimationClip {
  const clip = baseClip(
    charged ? UNITY_ROPE_CLIP_IDS.chargedRelease : UNITY_ROPE_CLIP_IDS.release,
    charged
      ? 'Rope Release — Unity Charged Backflip'
      : 'Rope Release — Unity Swing Jump',
    charged
      ? UNITY_ROPE_RELEASE_BACKFLIP_DURATION
      : UNITY_ROPE_RELEASE_SWING_DURATION,
    'once',
    rigId,
  );
  clip.loop.seamless = false;
  clip.tracks = sampledRotationTracks(
    clip.id,
    charged
      ? UNITY_ROPE_RELEASE_BACKFLIP_ROTATION_KEYS
      : UNITY_ROPE_RELEASE_SWING_ROTATION_KEYS,
    includeTorsoRoot,
  );
  clip.contacts = [
    contact(`${clip.id}:left-release`, 0, Math.min(clip.duration, 5 / 60), 'gripLeft', 'grip'),
    contact(`${clip.id}:right-release`, 0, Math.min(clip.duration, 5 / 60), 'gripRight', 'grip'),
  ];
  clip.markers = [
    { id: `${clip.id}:release`, time: 0, name: 'Grip release' },
    ...(charged ? [{
      id: `${clip.id}:backflip-apex`,
      time: clip.duration * 0.5,
      name: 'Charged backflip apex',
    }] : []),
  ];
  clip.events = [{ id: `${clip.id}:leap`, time: 0, name: 'rope-leap' }];
  clip.tags = [
    'player', 'unity-port', 'rope', 'release',
    charged ? 'charged-backflip' : 'swing-jump',
    'source-animation-retarget',
  ];
  clip.metadata = {
    starterQuality: 'source-animation-retarget',
    starterCatalogVersion: PLAYER_STARTER_CATALOG_VERSION,
    progressSource: 'gameplay-actionProgress',
    sourceAnimation: unityRopeSourceMetadata(
      charged ? 'releaseBackflip' : 'releaseSwing',
    ),
    ...(charged ? {
      variantFor: UNITY_ROPE_CLIP_IDS.release,
      variantWeight: 1,
    } : {
      variantBlend: {
        clipId: UNITY_ROPE_CLIP_IDS.chargedRelease,
        source: UNITY_ROPE_INPUTS.releaseCharge,
      },
    }),
  };
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
    buildWalk(rigId, includeTorsoRoot),
    buildRun(rigId, includeTorsoRoot),
    buildJump(rigId),
    buildDoubleJump(rigId),
    buildFall(rigId),
    buildLand(rigId),
    buildCrouch(rigId, includeTorsoRoot),
    buildCrawl(rigId, includeTorsoRoot),
    buildSlide(rigId),
    buildSkate(rigId),
    placeholder('player.grind', 'Grind', 1, rigId),
    placeholder('player.grab', 'Grab', 0.8, rigId),
    placeholder('player.hang', 'Hang', 1, rigId),
    placeholder('player.climb', 'Climb', 1.2, rigId),
    buildUnityRopeHang(rigId, includeTorsoRoot),
    buildUnityRopeClimb(rigId, includeTorsoRoot),
    buildUnityRopeRelease(rigId, false, includeTorsoRoot),
    buildUnityRopeRelease(rigId, true, includeTorsoRoot),
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
 * exceptions are explicit upgrades for shipped, signature-identical starters:
 * Walk/Run -> Quaternius sources, Crouch/Crawl/Rope/Slam -> Unity sources,
 * and the phase-locked airborne deformation arc. The retired Pace Stop is
 * removed from saved suites. A genuinely edited pre-Jog Run is retained under
 * a backup ID while `player.run` adopts the new source motion. Once a suite
 * records the current revision, a missing clip is treated as an intentional
 * deletion and remains missing on subsequent loads.
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
  let clips = document.clips.filter((clip) =>
    clip.id !== RETIRED_PACE_STOP_CLIP_ID);
  const activeClipId = document.activeClipId === RETIRED_PACE_STOP_CLIP_ID
    ? 'player.idle'
    : document.activeClipId;
  if (previousVersion >= PLAYER_STARTER_CATALOG_VERSION) {
    return rigs === document.rigs &&
      clips.length === document.clips.length &&
      activeClipId === document.activeClipId
      ? document
      : { ...document, rigs, clips, activeClipId };
  }

  const starters = createPlayerStarterClips(rig);
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
  if (previousVersion < 9) {
    for (const [clipId, untouchedSignatures] of Object.entries(
      LEGACY_AIRBORNE_STARTER_SIGNATURES,
    )) {
      const current = clips.find((clip) => clip.id === clipId);
      const imported = starters.find((clip) => clip.id === clipId);
      if (
        current && imported &&
        untouchedSignatures.has(starterClipSignature(current))
      ) {
        clips = clips.map((clip) => clip.id === clipId ? imported : clip);
      }
    }
    // A locally edited Jump/Fall can keep every authored key and still gain
    // the new gameplay curl layer when it had no procedural graph of its own.
    // Input zero is identity, so ordinary/manual playback remains unchanged.
    for (const clipId of ['player.jump', 'player.fall']) {
      const current = clips.find((clip) => clip.id === clipId);
      if (
        current &&
        current.proceduralDrivers.length === 0 &&
        !hasForwardRollSquashLayer(current)
      ) {
        const upgraded = withForwardRollSquashLayer(current);
        clips = clips.map((clip) => clip.id === clipId ? upgraded : clip);
      }
    }
  }
  if (previousVersion < 10) {
    const importedRope = starters.find((clip) =>
      clip.id === UNITY_ROPE_CLIP_IDS.hang)!;
    const currentRope = clips.find((clip) =>
      clip.id === UNITY_ROPE_CLIP_IDS.hang);
    if (currentRope && isUntouchedRopePlaceholder(currentRope)) {
      clips = clips.map((clip) =>
        clip.id === UNITY_ROPE_CLIP_IDS.hang ? importedRope : clip);
    }
  }
  if (previousVersion < 12) {
    for (const [clipId, untouchedSignatures] of Object.entries(
      LEGACY_CROUCH_CRAWL_STARTER_SIGNATURES,
    )) {
      const current = clips.find((clip) => clip.id === clipId);
      const imported = starters.find((clip) => clip.id === clipId);
      if (
        current && imported &&
        (untouchedSignatures.has(starterClipSignature(current)) ||
          LEGACY_CROUCH_CRAWL_CANONICAL_SIGNATURES[clipId]?.has(
            canonicalLegacyStarterClipSignature(current),
          ))
      ) {
        clips = clips.map((clip) => clip.id === clipId ? imported : clip);
      }
    }
  }
  if (previousVersion < 13) {
    const current = clips.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
    const imported = starters.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
    if (
      current && imported &&
      (LEGACY_UNITY_CRAWL_SIGNATURES.has(starterClipSignature(current)) ||
        LEGACY_UNITY_CRAWL_CANONICAL_SIGNATURES.has(
          canonicalLegacyStarterClipSignature(current),
        ))
    ) {
      clips = clips.map((clip) =>
        clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl ? imported : clip);
    }
  }
  if (previousVersion < 15) {
    const current = clips.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crouch);
    const imported = starters.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crouch);
    if (
      current && imported &&
      (LEGACY_YAWED_UNITY_CROUCH_SIGNATURES.has(starterClipSignature(current)) ||
        LEGACY_YAWED_UNITY_CROUCH_CANONICAL_SIGNATURES.has(
          canonicalLegacyStarterClipSignature(current),
        ))
    ) {
      clips = clips.map((clip) =>
        clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crouch ? imported : clip);
    }
  }
  if (previousVersion < 16) {
    const current = clips.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
    if (current) {
      clips = clips.map((clip) =>
        clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl
          ? withCrawlWristYawRevision(clip)
          : clip);
    }
    const currentLand = clips.find((clip) => clip.id === 'player.land');
    const importedLand = starters.find((clip) => clip.id === 'player.land');
    if (
      currentLand && importedLand &&
      (LEGACY_STATIC_LANDING_SIGNATURES.has(starterClipSignature(currentLand)) ||
        LEGACY_STATIC_LANDING_CANONICAL_SIGNATURES.has(
          canonicalLegacyStarterClipSignature(currentLand),
        ))
    ) {
      clips = clips.map((clip) => clip.id === 'player.land' ? importedLand : clip);
    }
  }
  if (previousVersion < 18) {
    const currentWalk = clips.find((clip) => clip.id === PLAYER_WALK_CLIP_ID);
    const importedWalk = starters.find((clip) => clip.id === PLAYER_WALK_CLIP_ID);
    if (currentWalk && importedWalk && isUnityWalkingWomanWalk(currentWalk)) {
      clips = clips.map((clip) =>
        clip.id === PLAYER_WALK_CLIP_ID ? importedWalk : clip);
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
    activeClipId,
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
