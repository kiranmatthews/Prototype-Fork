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
// rewards — comes from a PRNG reseeded to a fixed constant on level load, so
// the same inputs walk the same stream. Visual randomness stays on
// Math.random() precisely so that skipping particles (headless/lite) cannot
// shift the sim's draw order.

import { TUNING } from './tuning';

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

export interface ReplayFile {
  v: 2;
  level: string; // the level's stable slug id
  date: string;
  tuning: Record<string, number>;
  tuningChanges: Array<[number, string, number]>; // [frame, key, newValue]
  mx: number[];
  my: number[];
  b: number[]; // button bitmask per frame
  frames: number;
  truncated: boolean;
}

const MAX_FRAMES = 60 * 60 * 20; // 20 min @ 60Hz, then the take stops honestly

export class Recorder {
  private mx: number[] = [];
  private my: number[] = [];
  private b: number[] = [];
  private level = '';
  private tuning0: Record<string, number> = {};
  private tuningPrev: Record<string, number> = {};
  private tuningChanges: Array<[number, string, number]> = [];
  private truncated = false;

  start(level: string): void {
    this.level = level;
    this.mx = [];
    this.my = [];
    this.b = [];
    this.tuningChanges = [];
    this.truncated = false;
    this.tuning0 = { ...(TUNING as unknown as Record<string, number>) };
    this.tuningPrev = { ...this.tuning0 };
  }

  // Call once per fixed step, BEFORE consumeEdges, with the input the sim saw.
  record(input: InputLike): void {
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
      frames: this.b.length,
      truncated: this.truncated,
    };
  }
}

export class Replayer {
  private data: ReplayFile | null = null;
  frame = 0;
  private nextChange = 0;
  private savedTuning: Record<string, number> | null = null;

  get active(): boolean {
    return this.data !== null;
  }

  get total(): number {
    return this.data ? this.data.frames : 0;
  }

  // Call AFTER the level has been (re)loaded to the replay's level.
  begin(data: ReplayFile): void {
    if (!data || data.v !== 2 || !Array.isArray(data.b)) throw new Error('bad replay file');
    this.data = data;
    this.frame = 0;
    this.nextChange = 0;
    this.savedTuning = { ...(TUNING as unknown as Record<string, number>) };
    Object.assign(TUNING, data.tuning);
  }

  // Overwrite the live Input with the recorded frame. false = take is over
  // (tuning already restored) — the caller should reset to a clean level.
  feed(input: InputLike): boolean {
    const d = this.data;
    if (!d) return false;
    if (this.frame >= d.frames) {
      this.end();
      return false;
    }
    const t = TUNING as unknown as Record<string, number>;
    while (this.nextChange < d.tuningChanges.length && d.tuningChanges[this.nextChange][0] === this.frame) {
      const [, k, v] = d.tuningChanges[this.nextChange++];
      t[k] = v;
    }
    input.moveX = d.mx[this.frame];
    input.moveY = d.my[this.frame];
    const mask = d.b[this.frame];
    for (let i = 0; i < CHANNELS.length; i++) input[CHANNELS[i]] = (mask & (1 << i)) !== 0;
    this.frame++;
    return true;
  }

  end(): void {
    if (this.savedTuning) Object.assign(TUNING, this.savedTuning);
    this.savedTuning = null;
    this.data = null;
  }
}
