import { sfx } from './audio';
import type { SurfaceKind } from './puffs';

export type FootSide = 'left' | 'right';
export type FootstepSurface = SurfaceKind | 'ice';
export type FootstepGait = 'walk' | 'run';

/** Sound IDs registered in audio.ts. Missing surface/gait banks use generic.
 * Boardwalk foley belongs to wood; rock foley belongs to stone. Keep samples
 * trimmed to their attack: cadence belongs to the feet, never playback rate. */
export const FOOTSTEP_BANKS: Partial<Record<FootstepSurface, Partial<Record<FootstepGait, readonly string[]>>>> = {
  generic: { walk: ['footstep1', 'footstep2', 'footstep3'], run: ['footstep1', 'footstep2', 'footstep3'] },
};

export function footstepSound(surface: FootstepSurface, gait: FootstepGait, index: number): string {
  const bank = FOOTSTEP_BANKS[surface]?.[gait];
  const fallback = FOOTSTEP_BANKS.generic![gait]!;
  const samples = bank?.length ? bank : fallback;
  return samples[index % samples.length];
}

/** Uses the collision's material classification without changing traction. */
export function footstepSurface(surface: SurfaceKind, materialName: string): FootstepSurface {
  if (surface === 'snow' && /ice|frost/i.test(materialName)) return 'ice';
  if (surface === 'generic' && /boardwalk|timber/i.test(materialName)) return 'wood';
  if (surface === 'generic' && /basalt|limestone|granite/i.test(materialName)) return 'stone';
  return surface;
}

interface FootContact {
  previous: number;
  peak: number;
  trough: number;
  armed: boolean;
  descending: boolean;
}

/** Observes the FINAL rendered soles, including blends, elasticity and seating.
 * A lifted foot fires once as it meets the floor or finishes its downstroke.
 * The latter also covers the authored jog's small clearance above the floor.
 * Relative foot height rearms it; torso bounce cannot repeat a planted step. */
export class FootstepContacts {
  private feet: [FootContact, FootContact] | null = null;
  private scuffing = false;

  reset(): void { this.feet = null; }

  sample(heights: readonly [number, number], scuffing = false): FootSide[] {
    if (!heights.every(Number.isFinite)) { this.reset(); return []; }
    if (this.scuffing !== scuffing) this.reset();
    this.scuffing = scuffing;
    // Ice has asymmetric gliding legs: its recovering foot can stay above the
    // other even at contact. Relative lift removes the shared torso bounce;
    // a fresh rise and completed fall identify each small corrective scuff.
    const signals = scuffing ? [heights[0] - heights[1], heights[1] - heights[0]] : heights;
    this.feet ??= signals.map(height => ({ previous: height, peak: height, trough: height, armed: false, descending: false })) as [FootContact, FootContact];
    const landed: FootSide[] = [];
    for (const index of [0, 1] as const) {
      const foot = this.feet[index], height = heights[index], other = heights[1 - index];
      const signal = signals[index];
      foot.trough = Math.min(foot.trough, signal);
      const lifted = scuffing ? signal - foot.trough > .025 : height > .03 && height - other > .045;
      if (!foot.armed && lifted) {
        foot.armed = true;
        foot.peak = signal;
        foot.descending = false;
      }
      foot.peak = Math.max(foot.peak, signal);
      if (signal < foot.previous - .0003) foot.descending = true;
      const atFloor = !scuffing && height <= .012 && height <= foot.previous + .0003;
      const bottomOfStride = foot.descending && signal >= foot.previous - .0003;
      if (foot.armed && foot.peak - signal >= .025 && (scuffing || height <= other + .006) && (atFloor || bottomOfStride)) {
        landed.push(index === 0 ? 'left' : 'right');
        foot.armed = false;
        foot.descending = false;
        foot.peak = foot.trough = signal;
      }
      foot.previous = signal;
    }
    return landed;
  }
}

/** Per-player variation: multiple players never share a cadence or sample cursor. */
let nextFootstepEmitter = 0;
export class FootstepAudio {
  readonly contacts = new FootstepContacts();
  private index = 0;
  private readonly emitter = `footsteps-${nextFootstepEmitter++}`;

  play(side: FootSide, surface: FootstepSurface, normalizedSpeed: number): void {
    const speed = Math.max(0, Math.min(1, normalizedSpeed));
    const gait: FootstepGait = speed > .55 ? 'run' : 'walk';
    // Distinct feet must not steal one another's attack through one-shot debounce.
    sfx.withGain(1, () => sfx.play(footstepSound(surface, gait, this.index++), .24 + .16 * speed, 1, .025), `${this.emitter}-${side}`);
  }
}
