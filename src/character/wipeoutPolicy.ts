import type { BreakApartStyle } from './breakApart';

/** Presentation severity only: damage, movement, shields and recovery remain
 * owned by the controller. Speed is the incoming impact, before rebound. */
export type WipeoutCause = 'balance' | 'wall' | 'trip' | 'rail' | 'landing' |
  'pvp' | 'contact' | 'pit' | 'water' | 'blast' | 'crush';

export function selectWipeoutStyle(
  cause: WipeoutCause, _impact: number, fatal: boolean, protectedHit = false,
): BreakApartStyle | null {
  // A recoverable crash always keeps its connected body, at every speed.
  // Only the fatal hazard routes may request the existing break-apart effects.
  if (!fatal || protectedHit) return null;
  if (cause === 'blast') return 'blast';
  if (cause === 'crush') return 'crush';
  return null;
}
