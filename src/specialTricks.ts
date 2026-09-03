// THPS-style SPECIAL meter + command grammar.
//
// Inputs are sampled only from deterministic fixed steps. A command is one
// cardinal direction followed by a second direction + the category face button
// in a tight chord; nothing is banked on DOM time and no replay channel is
// needed because replays already contain the raw axes and button edges.

export type SpecialCategory = 'flip' | 'grab' | 'grind';
export type SpecialDirection = 'up' | 'down' | 'left' | 'right';

export interface SpecialTrick {
  id: 'kickflip-mctwist' | 'the-900' | 'darkslide';
  category: SpecialCategory;
  label: string;
  directions: readonly [SpecialDirection, SpecialDirection];
  points: number;
  duration: number;
  controls: string;
}

export const SPECIAL_TRICKS: readonly SpecialTrick[] = [
  {
    id: 'kickflip-mctwist',
    category: 'flip',
    label: 'Kickflip McTwist',
    directions: ['left', 'right'],
    points: 1500,
    duration: 0.78,
    controls: '← → + □',
  },
  {
    id: 'the-900',
    category: 'grab',
    label: 'The 900',
    directions: ['right', 'down'],
    points: 900,
    duration: 0.9,
    controls: '→ ↓ + ○',
  },
  {
    id: 'darkslide',
    category: 'grind',
    label: 'Darkslide',
    directions: ['left', 'right'],
    points: 1200,
    duration: 0,
    controls: '← → + △',
  },
] as const;

export const SPECIAL_CONTROL_HELP = SPECIAL_TRICKS.map(
  (trick) => `${trick.controls}  ${trick.label}`,
).join('   ·   ');

// Economy is intentionally based on decayed trick points, before the combo
// multiplier. It can light during a long line, while props/pickups cannot fill
// it and a single enormous bank cannot mint the bar again.
export const SPECIAL_MAX = 100;
export const SPECIAL_POINTS_TO_FULL = 1200;
export const SPECIAL_INPUT_WINDOW = 0.45;
export const SPECIAL_FINAL_CHORD_GRACE = 0.1;
export const SPECIAL_DECAY_DELAY = 4;
export const SPECIAL_ACTIVE_DECAY = 18;
export const SPECIAL_PARTIAL_DECAY = 4;

interface DirectionTap {
  direction: SpecialDirection;
  age: number;
}

function directionStrength(
  direction: SpecialDirection,
  moveX: number,
  moveY: number,
): number {
  if (direction === 'left') return Math.max(0, -moveX);
  if (direction === 'right') return Math.max(0, moveX);
  if (direction === 'up') return Math.max(0, moveY);
  return Math.max(0, -moveY);
}

/**
 * Deterministic SPECIAL economy and two-direction recognizer. The Player owns
 * context/risk and calls commit only after a move genuinely starts.
 */
export class SpecialSystem {
  value = 0;

  private armed = false;
  private idleTime = 0;
  private heldDirection: SpecialDirection | null = null;
  private taps: DirectionTap[] = [];

  get fraction(): number {
    return this.value / SPECIAL_MAX;
  }

  /** Once filled, SPECIAL remains lit while its active bar drains. */
  get ready(): boolean {
    return this.armed && this.value > 0.0001;
  }

  /**
   * Read the presented meter without folding temporary Player-owned powerups
   * into the earned economy. When that outside context ends, the earned value
   * underneath is still exactly the SpecialSystem value it would otherwise be.
   */
  effectiveValue(forcedFull = false): number {
    return forcedFull ? SPECIAL_MAX : this.value;
  }

  /** Temporary readiness follows the same non-mutating rule as the meter. */
  effectiveReady(forcedReady = false): boolean {
    return forcedReady || this.ready;
  }

  get direction(): SpecialDirection | null {
    return this.heldDirection;
  }

  /** Run exactly once per fixed simulation step, before state routing. */
  step(dt: number, moveX: number, moveY: number): void {
    const safeDt = Math.max(0, dt);
    this.idleTime += safeDt;
    for (const tap of this.taps) tap.age += safeDt;
    this.taps = this.taps.filter((tap) => tap.age <= SPECIAL_INPUT_WINDOW);

    const next = this.resolveDirection(moveX, moveY);
    if (next !== this.heldDirection) {
      this.heldDirection = next;
      if (next) {
        this.taps.push({ direction: next, age: 0 });
        if (this.taps.length > 2) this.taps.shift();
      }
    }

    if (this.idleTime > SPECIAL_DECAY_DELAY && this.value > 0) {
      const rate = this.armed ? SPECIAL_ACTIVE_DECAY : SPECIAL_PARTIAL_DECAY;
      this.value = Math.max(0, this.value - rate * safeDt);
      if (this.value === 0) this.armed = false;
    }
  }

  /** Add final repeat-decayed trick points; returns true on the fill edge. */
  award(points: number): boolean {
    if (!Number.isFinite(points) || points <= 0) return false;
    const wasReady = this.ready;
    this.value = Math.min(
      SPECIAL_MAX,
      this.value + (points / SPECIAL_POINTS_TO_FULL) * SPECIAL_MAX,
    );
    this.idleTime = 0;
    if (this.value >= SPECIAL_MAX - 1e-7) {
      this.value = SPECIAL_MAX;
      this.armed = true;
    }
    return !wasReady && this.ready;
  }

  /** Inspect an action edge without spending its command or changing meter. */
  peek(category: SpecialCategory, forcedReady = false): SpecialTrick | null {
    if (!this.effectiveReady(forcedReady) || this.taps.length < 2) return null;
    const trick = SPECIAL_TRICKS.find((candidate) => candidate.category === category);
    if (!trick) return null;
    const a = this.taps[this.taps.length - 2];
    const b = this.taps[this.taps.length - 1];
    if (a.direction !== trick.directions[0] || b.direction !== trick.directions[1])
      return null;
    if (a.age > SPECIAL_INPUT_WINDOW || b.age > SPECIAL_FINAL_CHORD_GRACE) return null;
    // A quick tap/release of direction two gets the same tiny grace as the
    // Square-at-ollie smoosh; there is never a seconds-long banked command.
    if (this.heldDirection !== b.direction && b.age > SPECIAL_FINAL_CHORD_GRACE)
      return null;
    return trick;
  }

  /** A confirmed gameplay start owns the sequence and refreshes active time. */
  commit(trick: SpecialTrick): void {
    if (!SPECIAL_TRICKS.includes(trick)) return;
    this.taps = [];
    this.idleTime = 0;
  }

  clearInput(): void {
    this.heldDirection = null;
    this.taps = [];
  }

  /** Unmasked bail/death: THPS's lit bar is lost with the combo. */
  wipe(): void {
    this.value = 0;
    this.armed = false;
    this.idleTime = 0;
    this.clearInput();
  }

  /** Level rebuild/respawn uses the same complete transient reset. */
  reset(): void {
    this.wipe();
  }

  private resolveDirection(moveX: number, moveY: number): SpecialDirection | null {
    const enter = 0.6;
    const release = 0.35;
    const current = this.heldDirection;
    const candidates: readonly SpecialDirection[] = ['up', 'down', 'left', 'right'];
    let best: SpecialDirection = 'up';
    let bestStrength = -1;
    // Vertical wins an exact diagonal, matching the deck-trick input table.
    for (const candidate of candidates) {
      const strength = directionStrength(candidate, moveX, moveY);
      if (strength > bestStrength) {
        best = candidate;
        bestStrength = strength;
      }
    }

    if (current) {
      const currentStrength = directionStrength(current, moveX, moveY);
      if (
        best !== current &&
        bestStrength >= enter &&
        bestStrength > currentStrength + 0.05
      )
        return best;
      if (currentStrength >= release) return current;
    }
    return bestStrength >= enter ? best : null;
  }
}
