/** Maximum distance a crate may be seated below its authored deck height. */
export const CRATE_REST_MAX_DROP = 0.6;

/**
 * Maximum upward repair applied to stale captures whose replacement floor is
 * higher than the originally sampled terrain.
 */
export const CRATE_REST_MAX_REPAIR_RISE = 4;

/** Float/authoring tolerance for a surface intended to meet the authored deck. */
export const CRATE_REST_HEIGHT_EPSILON = 0.05;

/**
 * Pick the floor a data-authored crate should rest on from vertical ray hits.
 *
 * `deckY` is the authored crate-base height. A surface at or just below that
 * height is ordinary support, so the highest such surface wins. This keeps an
 * elevated deck above underlying terrain from burying its crate in the lower
 * surface. If there is no ordinary support, the lowest eligible surface above
 * the authored height wins instead; that preserves the editor's legacy repair
 * for captures whose flattened replacement terrain moved upward.
 */
export function selectCrateRestSurface(
  surfaceYs: Iterable<number>,
  deckY: number,
): number | null {
  if (!Number.isFinite(deckY)) return null;

  const minimum = deckY - CRATE_REST_MAX_DROP;
  const supportCeiling = deckY + CRATE_REST_HEIGHT_EPSILON;
  const repairCeiling = deckY + CRATE_REST_MAX_REPAIR_RISE;
  let support: number | null = null;
  let repair: number | null = null;

  for (const y of surfaceYs) {
    if (!Number.isFinite(y) || y < minimum || y > repairCeiling) continue;
    if (y <= supportCeiling) {
      if (support === null || y > support) support = y;
    } else if (repair === null || y < repair) {
      repair = y;
    }
  }

  return support ?? repair;
}
