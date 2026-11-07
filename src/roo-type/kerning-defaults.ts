import { normalizeRooPairs, type RooPairSpacing } from './kerning';

/** Authored in the Roo pair editor; source preset: docs/roo-pair-spacing/defaults.json. */
export const ROO_PAIR_SPACING_DEFAULTS: RooPairSpacing = Object.freeze({
  '-A': -.042, '?A': -.053, ')A': -.06, '//': -.106, '/4': -.062,
  '/6': -.042, '/A': -.054, '+A': -.025, '1/': .053, '2/': .05,
  '4/': .013, '7/': -.134, '7A': -.07, '8/': .007, '9/': -.056,
  '9A': -.039, 'A-': -.052, 'A?': -.045, "A'": -.025, 'A/': .028,
  'A&': -.008, 'A%': -.032, 'A+': -.028, AC: -.027, AG: -.026,
  AJ: -.013, AO: -.014, AQ: -.025, AT: -.019, AV: -.062,
  AW: -.07, AY: -.067, BA: -.01, CA: -.013, DA: -.044,
  FA: -.068, JA: -.035, KA: -.041, LA: -.034, NA: -.04,
  OA: -.049, PA: -.086, RA: -.028, SA: -.015, TA: -.047,
  UA: -.02, VA: -.109, WA: -.063, XA: -.017, YA: -.091, ZA: -.005,
});

/** Store only deviations, including explicit zero when a default is disabled. */
export function getRooPairEdits(pairs: RooPairSpacing): RooPairSpacing {
  const edits: Record<string, number> = {};
  for (const pair of new Set([...Object.keys(ROO_PAIR_SPACING_DEFAULTS), ...Object.keys(pairs)])) {
    const value = pairs[pair] ?? 0;
    if (value !== (ROO_PAIR_SPACING_DEFAULTS[pair] ?? 0)) edits[pair] = value;
  }
  return Object.freeze(edits);
}

/** Missing overrides inherit the current defaults; saved edits keep their exact values. */
export function resolveRooPairSpacing(overrides: unknown): RooPairSpacing {
  return normalizeRooPairs({ ...ROO_PAIR_SPACING_DEFAULTS, ...normalizeRooPairs(overrides, true) });
}

/** A portable preset must retain zero overrides so importing does not revive a default. */
export function rooPairPreset(pairs: RooPairSpacing): RooPairSpacing {
  return { ...ROO_PAIR_SPACING_DEFAULTS, ...getRooPairEdits(pairs) };
}
