// REPLAY: records the exact input the sim consumes — every fixed step since
// the last level load — plus the tuning it ran under. Exports as a small
// JSON for bug reports ("here's the run where it broke"); loading the same
// file replays it deterministically, in-game or headless.
//
// Faithfulness notes: the take starts AT level load, so playback = load the
// level, apply the recorded tuning, feed the frames. Deaths, checkpoint
// restarts, tuner drags mid-run — all inside the take. The one exception is
// the 'Random' level, whose layout rolls fresh dice on every build.
//
// Determinism rests on Player.simRand (see player.ts): every random number
// that reaches SIM state — the balance needle, trip launches, '?' crate
// rewards, the thrown deck's launch — comes from a PRNG reseeded to a fixed
// constant on level load, so the same inputs walk the same stream. Visual
// randomness stays on Math.random() precisely so that skipping particles
// (headless/lite) cannot shift the sim's draw order.
//
// The pad is not the only thing the sim reads. player.camDir — where the
// camera is aiming, flattened to XZ — is sampled on the RENDER clock and then
// consumed by the sim: the lip stall picks its balance stick axis from it, and
// in chase-cam mode the entire travel frame is derived from it. Sampled on the
// render clock, it is a different number at 144Hz than at 60Hz, so a take
// recorded on one display would not reproduce on another. It rides in the file
// as one quantised yaw per frame (`cy`), which is also why main.ts snaps
// camDir to that same 1e-4 rad grid before the sim ever sees it: recorded and
// consumed are then the same value by construction. Files without `cy` are
// older takes and simply keep using the live camera.

import { TUNING } from './tuning';
import {
  legacyCarveGripEndpointsFromRecord,
  setLegacyCarveGripReplayCurve,
} from './carveGrip';
import { setLegacyVisualSurfaceFrictionReplay } from './surfaceFriction';
import { legacyCameraRigTuning } from './cameraRig';

// the button channels the sim reads, packed into one bitmask per frame.
// APPEND-ONLY: bit positions are the file format — old replays simply never
// set the newer bits.
const CHANNELS = [
  'jumpHeld',
  'grindHeld',
  'spinHeld',
  'grabHeld',
  'jumpPressed',
  'jumpReleased',
  'grindPressed',
  'spinPressed',
  'grabPressed',
  'restartPressed',
  'transferHeld',
  'transferPressed',
] as const;

type InputLike = { moveX: number; moveY: number } & Record<(typeof CHANNELS)[number], boolean>;
// player.camDir, structurally — replay.ts stays free of a three.js import
type AimLike = { x: number; z: number; set(x: number, y: number, z: number): unknown };

// the yaw grid camDir is snapped to, shared by the recorder and main.ts so
// that the value written to the file is bit-identical to the one the sim ran on
export const CAM_YAW_Q = 1e4;
export const camYawOf = (aim: { x: number; z: number }): number =>
  Math.round(Math.atan2(aim.x, aim.z) * CAM_YAW_Q) / CAM_YAW_Q;

export interface ReplayFile {
  v: 2;
  level: string; // the level's stable slug id
  date: string;
  tuning: Record<string, number>;
  tuningChanges: Array<[number, string, number]>; // [frame, key, newValue]
  mx: number[];
  my: number[];
  b: number[]; // button bitmask per frame
  cy?: number[]; // camera yaw per frame — absent in takes recorded before it
  frames: number;
  truncated: boolean;
  endlessDeaths?: boolean; // absent legacy takes use classic lives
  /** Present on takes recorded after visual materials stopped selecting physics. */
  surfaceFrictionPolicy?: 1;
}

const MAX_FRAMES = 60 * 60 * 20; // 20 min @ 60Hz, then the take stops honestly
const MAX_BUTTON_MASK = (1 << CHANNELS.length) - 1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeTuningKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 128 &&
  /^[A-Za-z][A-Za-z0-9_]*$/.test(value) &&
  value !== 'constructor' &&
  value !== 'prototype' &&
  value !== '__proto__';

/**
 * Full replay boundary validation. Loading calls this before switching level,
 * changing run rules, ending an active take, or applying tuning. Besides the
 * schema/version, the fixed-step byte streams must agree exactly with
 * `frames`; button masks may contain only declared input-channel bits.
 */
export function isReplayFile(value: unknown): value is ReplayFile {
  if (!isRecord(value) || value.v !== 2) return false;
  if (typeof value.level !== 'string' || value.level.length === 0 || value.level.length > 256)
    return false;
  if (typeof value.date !== 'string' || value.date.length > 128) return false;
  if (!Number.isInteger(value.frames) || (value.frames as number) < 0 || (value.frames as number) > MAX_FRAMES)
    return false;
  const frames = value.frames as number;
  if (typeof value.truncated !== 'boolean') return false;
  if (value.endlessDeaths !== undefined && typeof value.endlessDeaths !== 'boolean') return false;
  if (value.surfaceFrictionPolicy !== undefined && value.surfaceFrictionPolicy !== 1) return false;

  if (!Array.isArray(value.mx) || !Array.isArray(value.my) || !Array.isArray(value.b))
    return false;
  if (value.mx.length !== frames || value.my.length !== frames || value.b.length !== frames)
    return false;
  if (!value.mx.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1))
    return false;
  if (!value.my.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= -1 && n <= 1))
    return false;
  if (!value.b.every((n) => Number.isInteger(n) && n >= 0 && n <= MAX_BUTTON_MASK))
    return false;
  if (
    value.cy !== undefined &&
    (!Array.isArray(value.cy) ||
      value.cy.length > frames ||
      !value.cy.every((n) => typeof n === 'number' && Number.isFinite(n)))
  )
    return false;

  if (!isRecord(value.tuning) || Object.keys(value.tuning).length > 512) return false;
  for (const [key, number] of Object.entries(value.tuning))
    if (!safeTuningKey(key) || typeof number !== 'number' || !Number.isFinite(number)) return false;

  if (!Array.isArray(value.tuningChanges) || value.tuningChanges.length > MAX_FRAMES * 4)
    return false;
  let previousFrame = -1;
  for (const change of value.tuningChanges) {
    if (!Array.isArray(change) || change.length !== 3) return false;
    const [frame, key, number] = change;
    if (
      !Number.isInteger(frame) ||
      frame < 0 ||
      frame >= frames ||
      frame < previousFrame ||
      !safeTuningKey(key) ||
      typeof number !== 'number' ||
      !Number.isFinite(number)
    )
      return false;
    previousFrame = frame;
  }
  return true;
}

export class Recorder {
  private mx: number[] = [];
  private my: number[] = [];
  private b: number[] = [];
  private cy: number[] = [];
  private level = '';
  private tuning0: Record<string, number> = {};
  private tuningPrev: Record<string, number> = {};
  private tuningChanges: Array<[number, string, number]> = [];
  private truncated = false;
  private endlessDeaths = false;

  start(level: string, endlessDeaths = false): void {
    this.level = level;
    this.endlessDeaths = endlessDeaths;
    this.mx = [];
    this.my = [];
    this.b = [];
    this.cy = [];
    this.tuningChanges = [];
    this.truncated = false;
    this.tuning0 = { ...(TUNING as unknown as Record<string, number>) };
    this.tuningPrev = { ...this.tuning0 };
  }

  // Call once per fixed step, BEFORE consumeEdges, with the input the sim saw
  // (and the camera aim it saw, which the lip stall and chase cam both read).
  record(input: InputLike, aim?: { x: number; z: number }): void {
    if (this.b.length >= MAX_FRAMES) {
      this.truncated = true;
      return;
    }
    // tuner drags mid-take change the physics — diff and stamp them
    const t = TUNING as unknown as Record<string, number>;
    for (const k in this.tuningPrev) {
      if (t[k] !== this.tuningPrev[k]) {
        this.tuningChanges.push([this.b.length, k, t[k]]);
        this.tuningPrev[k] = t[k];
      }
    }
    let mask = 0;
    for (let i = 0; i < CHANNELS.length; i++) if (input[CHANNELS[i]]) mask |= 1 << i;
    this.mx.push(Math.round(input.moveX * 100) / 100);
    this.my.push(Math.round(input.moveY * 100) / 100);
    this.b.push(mask);
    if (aim) this.cy.push(camYawOf(aim));
  }

  get frames(): number {
    return this.b.length;
  }

  export(): ReplayFile {
    return {
      v: 2,
      level: this.level,
      date: new Date().toISOString(),
      tuning: { ...this.tuning0 },
      tuningChanges: this.tuningChanges.slice(),
      mx: this.mx.slice(),
      my: this.my.slice(),
      b: this.b.slice(),
      cy: this.cy.slice(),
      frames: this.b.length,
      truncated: this.truncated,
      endlessDeaths: this.endlessDeaths,
      surfaceFrictionPolicy: 1,
    };
  }
}

export class Replayer {
  private data: ReplayFile | null = null;
  frame = 0;
  private nextChange = 0;
  private savedTuning: Record<string, number> | null = null;
  private legacyCarveGripValues: Record<string, number> | null = null;
  private legacyCameraValues: Record<string, number> | null = null;

  get active(): boolean {
    return this.data !== null;
  }

  get total(): number {
    return this.data ? this.data.frames : 0;
  }

  // Call AFTER the level has been (re)loaded to the replay's level.
  begin(data: ReplayFile): void {
    if (!isReplayFile(data)) throw new Error('bad replay file');
    this.data = data;
    this.frame = 0;
    this.nextChange = 0;
    this.savedTuning = { ...(TUNING as unknown as Record<string, number>) };
    const replayTuning = { ...data.tuning };
    this.legacyCameraValues = legacyCameraRigTuning(replayTuning) ? { ...replayTuning } : null;
    const hasDirectCarveGrip =
      Number.isFinite(replayTuning.carveGripLow) &&
      Number.isFinite(replayTuning.carveGripHigh);
    this.legacyCarveGripValues = !hasDirectCarveGrip &&
      legacyCarveGripEndpointsFromRecord(replayTuning)
      ? { ...replayTuning }
      : null;
    setLegacyCarveGripReplayCurve(this.legacyCarveGripValues);
    setLegacyVisualSurfaceFrictionReplay(data.surfaceFrictionPolicy !== 1);
    // Retired controls never become live dynamic properties. Legacy takes use
    // the shadow above, translated into direct endpoints below.
    delete replayTuning.carveGrip;
    delete replayTuning.carveGripRatio;
    delete replayTuning.camTilt;
    delete replayTuning.camOffset;
    Object.assign(TUNING, replayTuning);
    this.refreshLegacyCarveGrip();
    this.refreshLegacyCamera();
  }

  // Overwrite the live Input with the recorded frame. false = take is over
  // (tuning already restored) — the caller should reset to a clean level.
  feed(input: InputLike, aim?: AimLike): boolean {
    const d = this.data;
    if (!d) return false;
    if (this.frame >= d.frames) {
      this.end();
      return false;
    }
    const t = TUNING as unknown as Record<string, number>;
    let refreshLegacyCarveGrip = false;
    let refreshLegacyCamera = false;
    while (this.nextChange < d.tuningChanges.length && d.tuningChanges[this.nextChange][0] === this.frame) {
      const [, k, v] = d.tuningChanges[this.nextChange++];
      if (this.legacyCarveGripValues) {
        this.legacyCarveGripValues[k] = v;
        if (
          k === 'carveGrip' ||
          k === 'carveGripRatio' ||
          k === 'cruiseSpeed' ||
          k === 'maxSpeed'
        ) refreshLegacyCarveGrip = true;
      }
      if (this.legacyCameraValues) {
        this.legacyCameraValues[k] = v;
        if (k === 'camDist' || k === 'camHeight' || k === 'camTilt' || k === 'camOffset')
          refreshLegacyCamera = true;
      }
      if (k !== 'carveGrip' && k !== 'carveGripRatio' && k !== 'camTilt' && k !== 'camOffset') t[k] = v;
    }
    if (refreshLegacyCarveGrip) this.refreshLegacyCarveGrip();
    if (refreshLegacyCamera) this.refreshLegacyCamera();
    input.moveX = d.mx[this.frame];
    input.moveY = d.my[this.frame];
    const mask = d.b[this.frame];
    for (let i = 0; i < CHANNELS.length; i++) input[CHANNELS[i]] = (mask & (1 << i)) !== 0;
    // camera aim is a sim input too (lip stall axis, chase-cam travel frame).
    // Older takes have no `cy`, so they keep whatever the live camera is doing.
    if (aim && d.cy && this.frame < d.cy.length) {
      const y = d.cy[this.frame];
      aim.set(Math.sin(y), 0, Math.cos(y));
    }
    this.frame++;
    return true;
  }

  end(): void {
    if (this.savedTuning) Object.assign(TUNING, this.savedTuning);
    this.savedTuning = null;
    this.legacyCarveGripValues = null;
    this.legacyCameraValues = null;
    setLegacyCarveGripReplayCurve(null);
    setLegacyVisualSurfaceFrictionReplay(false);
    this.data = null;
  }

  private refreshLegacyCamera(): void {
    if (!this.legacyCameraValues) return;
    const cameraRig = legacyCameraRigTuning(this.legacyCameraValues);
    if (cameraRig) Object.assign(TUNING, cameraRig);
  }

  private refreshLegacyCarveGrip(): void {
    if (!this.legacyCarveGripValues) return;
    // Current replay max/cruise values may have changed independently; keep
    // the legacy shadow synchronized before deriving its direct endpoints.
    this.legacyCarveGripValues.maxSpeed = TUNING.maxSpeed;
    this.legacyCarveGripValues.cruiseSpeed = TUNING.cruiseSpeed;
    const migrated = legacyCarveGripEndpointsFromRecord(
      this.legacyCarveGripValues,
    );
    setLegacyCarveGripReplayCurve(this.legacyCarveGripValues);
    if (!migrated) return;
    TUNING.carveGripLow = migrated.low;
    TUNING.carveGripHigh = migrated.high;
  }
}
