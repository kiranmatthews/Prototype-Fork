import type { BreakApartStyle } from './breakApart';

/** Presentation severity only: damage, movement, shields and recovery remain
 * owned by the controller. Speed is the incoming impact, before rebound. */
export type WipeoutCause = 'balance' | 'wall' | 'trip' | 'rail' | 'landing' |
  'pvp' | 'contact' | 'pit' | 'water' | 'blast' | 'crush';

export function selectWipeoutStyle(
  cause: WipeoutCause, impact: number, fatal: boolean, protectedHit = false,
): BreakApartStyle | null {
  if (protectedHit) return null;
  if (fatal) {
    if (cause === 'blast') return 'blast';
    if (cause === 'crush') return 'crush';
    return null;
  }
  // A lost balance or missed trick is not an impact, even at high speed.
  // Head/waist/limb separation is reserved for clear, hard physical contacts.
  const speed = Number.isFinite(impact) ? Math.max(0, impact) : 0;
  if (cause === 'wall' && speed >= 18) return 'head-pop';
  if (cause === 'trip' && speed >= 16) return 'waist-split';
  if (cause === 'rail' && speed >= 16) return 'loose-limbs';
  if (cause === 'landing' && speed >= 22) return 'loose-limbs';
  return null;
}
