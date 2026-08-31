import {
  ANIMATION_SUITE_SCHEMA,
  ANIMATION_SUITE_SCHEMA_VERSION,
  type AnimationClip,
  type AnimationKeyframe,
  type AnimationSuiteDocument,
  type AnimationTrack,
  type ClipId,
  type KeyInterpolation,
  PROCEDURAL_DRIVER_SCHEMA,
  PROCEDURAL_DRIVER_SCHEMA_VERSION,
  type ProceduralBlendMode,
  type ProceduralDriverDefinition,
  type ProceduralDriverTarget,
  type JsonValue,
  type QuaternionKeyframe,
  type RigDefinition,
  type ScalarKeyframe,
  type TrackId,
  type Vec3Tuple,
  type VectorKeyframe,
} from './types';

let fallbackIdCounter = 0;

export function createAnimationId(prefix = 'anim'): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  fallbackIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackIdCounter.toString(36)}`;
}

export interface CreateAnimationSuiteOptions {
  id?: string;
  name?: string;
  rigs?: RigDefinition[];
  clips?: AnimationClip[];
  activeClipId?: ClipId;
}

export function createAnimationSuiteDocument(
  options: CreateAnimationSuiteOptions = {},
): AnimationSuiteDocument {
  const document: AnimationSuiteDocument = {
    schema: ANIMATION_SUITE_SCHEMA,
    version: ANIMATION_SUITE_SCHEMA_VERSION,
    id: options.id ?? createAnimationId('suite'),
    name: options.name ?? 'Animation Suite',
    rigs: options.rigs ? [...options.rigs] : [],
    clips: options.clips ? [...options.clips] : [],
  };
  if (options.activeClipId !== undefined) document.activeClipId = options.activeClipId;
  return document;
}

export interface CreateAnimationClipOptions {
  id?: string;
  name?: string;
  rigId: string;
  duration?: number;
  playbackSpeed?: number;
}

export function createAnimationClip(options: CreateAnimationClipOptions): AnimationClip {
  const duration = options.duration ?? 1;
  return {
    id: options.id ?? createAnimationId('clip'),
    name: options.name ?? 'New Animation',
    rigId: options.rigId,
    duration,
    playbackSpeed: options.playbackSpeed ?? 1,
    loop: { mode: 'loop', seamless: true },
    range: { start: 0, end: duration },
    rootMotion: { mode: 'in-place' },
    transformSpace: 'rest-local-delta',
    tracks: [],
    proceduralOrder: 'procedural-then-keyed',
    proceduralDrivers: [],
    markers: [],
    contacts: [],
    events: [],
  };
}

export function createAnimationTrack(
  kind: AnimationTrack['kind'],
  target: string,
  id = createAnimationId('track'),
): AnimationTrack {
  if (kind === 'position') return { id, kind, target, keys: [] };
  if (kind === 'quaternion') return { id, kind, target, keys: [] };
  if (kind === 'scale') return { id, kind, target, keys: [] };
  return { id, kind, target, keys: [] };
}

export function createScalarKeyframe(
  time: number,
  value: number,
  interpolation: KeyInterpolation = 'linear',
  id = createAnimationId('key'),
): ScalarKeyframe {
  return { id, time, value, interpolation };
}

export function createVectorKeyframe(
  time: number,
  value: Vec3Tuple,
  interpolation: KeyInterpolation = 'linear',
  id = createAnimationId('key'),
): VectorKeyframe {
  return { id, time, value: [...value], interpolation };
}

export function createQuaternionKeyframe(
  time: number,
  value: [number, number, number, number],
  interpolation: KeyInterpolation = 'linear',
  id = createAnimationId('key'),
): QuaternionKeyframe {
  return { id, time, value: [...value], interpolation };
}

export interface CreateProceduralDriverOptions {
  id?: string;
  name?: string;
  order?: number;
  blend?: ProceduralBlendMode;
  source?: string;
  amplitude?: number;
  frequency?: number;
  phase?: number;
  bias?: number;
  seed?: number;
  clamp?: [number, number];
  waveform?: 'sine' | 'triangle' | 'saw';
  dutyCycle?: number;
  smoothing?: number;
  attack?: number;
  hold?: number;
  release?: number;
  loop?: boolean;
  noiseInterpolation?: 'step' | 'smooth';
  inputRange?: [number, number];
  responseCurve?: 'step' | 'linear' | 'smoothstep' | 'smootherstep';
  extrapolate?: boolean;
  evaluatorId?: string;
  params?: Record<string, JsonValue>;
}

export function createProceduralDriver(
  type: ProceduralDriverDefinition['type'],
  target: ProceduralDriverTarget,
  options: CreateProceduralDriverOptions = {},
): ProceduralDriverDefinition {
  const common = {
    schema: PROCEDURAL_DRIVER_SCHEMA,
    version: PROCEDURAL_DRIVER_SCHEMA_VERSION,
    id: options.id ?? createAnimationId('driver'),
    order: options.order ?? 0,
    ...(options.name === undefined ? {} : { name: options.name }),
    target: structuredClone(target),
    blend: options.blend ?? 'additive' as const,
    source: options.source ?? 'time',
    amplitude: options.amplitude ?? 1,
    frequency: options.frequency ?? 1,
    phase: options.phase ?? 0,
    bias: options.bias ?? 0,
    seed: options.seed ?? 0,
    ...(options.clamp === undefined ? {} : { clamp: [...options.clamp] as [number, number] }),
  };
  if (type === 'oscillator') return { ...common, type, waveform: options.waveform ?? 'sine' };
  if (type === 'pulse') {
    return { ...common, type, dutyCycle: options.dutyCycle ?? 0.5, smoothing: options.smoothing ?? 0 };
  }
  if (type === 'envelope') {
    return {
      ...common,
      type,
      attack: options.attack ?? 0.2,
      hold: options.hold ?? 0.4,
      release: options.release ?? 0.4,
      loop: options.loop ?? true,
    };
  }
  if (type === 'noise') {
    return { ...common, type, interpolation: options.noiseInterpolation ?? 'smooth' };
  }
  if (type === 'custom') {
    return {
      ...common,
      type,
      evaluatorId: options.evaluatorId ?? 'unassigned',
      ...(options.params ? { params: structuredClone(options.params) } : {}),
    };
  }
  return {
    ...common,
    type,
    inputRange: options.inputRange ? [...options.inputRange] : [0, 1],
    curve: options.responseCurve ?? 'linear',
    extrapolate: options.extrapolate ?? false,
  };
}

export function upsertProceduralDriver(
  clip: AnimationClip,
  driver: ProceduralDriverDefinition,
): AnimationClip {
  const proceduralDrivers = [...clip.proceduralDrivers];
  const index = proceduralDrivers.findIndex((candidate) => candidate.id === driver.id);
  if (index < 0) proceduralDrivers.push(driver);
  else proceduralDrivers[index] = driver;
  return { ...clip, proceduralDrivers };
}

export function removeProceduralDriver(clip: AnimationClip, driverId: string): AnimationClip {
  return {
    ...clip,
    proceduralDrivers: clip.proceduralDrivers.filter((driver) => driver.id !== driverId),
  };
}

export function duplicateProceduralDriver(
  driver: ProceduralDriverDefinition,
  id = createAnimationId('driver'),
  name = driver.name ? `${driver.name} Copy` : undefined,
): ProceduralDriverDefinition {
  const duplicate = { ...structuredClone(driver), id };
  if (name === undefined) delete duplicate.name;
  else duplicate.name = name;
  return duplicate;
}

export function findClip(
  document: AnimationSuiteDocument,
  clipId: ClipId,
): AnimationClip | undefined {
  return document.clips.find((clip) => clip.id === clipId);
}

export function upsertClip(
  document: AnimationSuiteDocument,
  clip: AnimationClip,
): AnimationSuiteDocument {
  const index = document.clips.findIndex((candidate) => candidate.id === clip.id);
  const clips = [...document.clips];
  if (index < 0) clips.push(clip);
  else clips[index] = clip;
  return { ...document, clips };
}

export function removeClip(
  document: AnimationSuiteDocument,
  clipId: ClipId,
): AnimationSuiteDocument {
  const clips = document.clips.filter((clip) => clip.id !== clipId);
  const next = { ...document, clips };
  if (next.activeClipId === clipId) delete next.activeClipId;
  return next;
}

export function setActiveClip(
  document: AnimationSuiteDocument,
  clipId: ClipId | undefined,
): AnimationSuiteDocument {
  const next = { ...document };
  if (clipId === undefined) delete next.activeClipId;
  else next.activeClipId = clipId;
  return next;
}

export function duplicateClip(
  clip: AnimationClip,
  id = createAnimationId('clip'),
  name = `${clip.name} Copy`,
): AnimationClip {
  return {
    ...structuredClone(clip),
    id,
    name,
  };
}

export function upsertTrack(clip: AnimationClip, track: AnimationTrack): AnimationClip {
  const index = clip.tracks.findIndex((candidate) => candidate.id === track.id);
  const tracks = [...clip.tracks];
  if (index < 0) tracks.push(track);
  else tracks[index] = track;
  return { ...clip, tracks };
}

export function removeTrack(clip: AnimationClip, trackId: TrackId): AnimationClip {
  return { ...clip, tracks: clip.tracks.filter((track) => track.id !== trackId) };
}

function valueMatchesTrack(track: AnimationTrack, key: AnimationKeyframe): boolean {
  if (track.kind === 'scalar') return typeof key.value === 'number';
  if (!Array.isArray(key.value)) return false;
  return track.kind === 'quaternion' ? key.value.length === 4 : key.value.length === 3;
}

function withKeys(track: AnimationTrack, keys: AnimationKeyframe[]): AnimationTrack {
  if (track.kind === 'scalar') {
    return { ...track, keys: keys as ScalarKeyframe[] };
  }
  if (track.kind === 'quaternion') {
    return { ...track, keys: keys as QuaternionKeyframe[] };
  }
  return { ...track, keys: keys as VectorKeyframe[] };
}

export function upsertKeyframe(
  clip: AnimationClip,
  trackId: TrackId,
  key: AnimationKeyframe,
): AnimationClip {
  const tracks = clip.tracks.map((track) => {
    if (track.id !== trackId) return track;
    if (!valueMatchesTrack(track, key)) {
      throw new TypeError(`key ${key.id} value does not match ${track.kind} track ${track.id}`);
    }
    const keys: AnimationKeyframe[] = [...track.keys];
    const index = keys.findIndex((candidate) => candidate.id === key.id);
    if (index < 0) keys.push(key);
    else keys[index] = key;
    keys.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
    return withKeys(track, keys);
  });
  if (!tracks.some((track) => track.id === trackId)) {
    throw new Error(`animation track not found: ${trackId}`);
  }
  return { ...clip, tracks };
}

export function removeKeyframe(
  clip: AnimationClip,
  trackId: TrackId,
  keyId: string,
): AnimationClip {
  let found = false;
  const tracks = clip.tracks.map((track) => {
    if (track.id !== trackId) return track;
    found = true;
    return withKeys(
      track,
      track.keys.filter((key) => key.id !== keyId),
    );
  });
  if (!found) throw new Error(`animation track not found: ${trackId}`);
  return { ...clip, tracks };
}
