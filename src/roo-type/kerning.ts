/** Pair adjustments are additive, in cap-height units, and shared by both palettes. */
export type RooPairSpacing = Readonly<Record<string, number>>;
export const ROO_PAIR_LIMIT = .3;
export const ROO_PAIR_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.,:;/-+\'"()%&';
export const isRooPair = (pair: string): boolean => pair.length === 2 && [...pair].every(char => ROO_PAIR_CHARACTERS.includes(char));
export const roundRooSpacing = (value: number): number => Math.round(Math.max(-ROO_PAIR_LIMIT, Math.min(ROO_PAIR_LIMIT, value)) * 1000) / 1000;

export function normalizeRooPairs(raw: unknown): RooPairSpacing {
  const pairs: Record<string, number> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [pair, value] of Object.entries(raw)) {
      if (isRooPair(pair) && typeof value === 'number' && Number.isFinite(value)) {
        const rounded = roundRooSpacing(value);
        if (rounded) pairs[pair] = rounded;
      }
    }
  }
  return Object.freeze(pairs);
}

export function pairsInText(raw: string): string[] {
  const text = raw.toUpperCase(), result = new Set<string>();
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2);
    if (isRooPair(pair) && pair !== '  ') result.add(pair);
  }
  return [...result];
}

/** Strict import: reject the whole file instead of silently dropping bad edits. */
export function parseRooPairs(json: string): Record<string, number> {
  const data: unknown = JSON.parse(json);
  if (!data || typeof data !== 'object') throw Error('Choose a Roo pair-spacing JSON file.');
  const value = data as Record<string, unknown>;
  if (value.format !== 'roo-pair-spacing' || value.version !== 1 || value.units !== 'cap-height' ||
      !value.pairs || typeof value.pairs !== 'object' || Array.isArray(value.pairs)) {
    throw Error('Choose a Roo pair-spacing JSON file (version 1).');
  }
  const pairs: Record<string, number> = {};
  for (const [pair, amount] of Object.entries(value.pairs)) {
    if (!isRooPair(pair) || typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount) > ROO_PAIR_LIMIT) {
      throw Error('Every entry must be a supported two-character pair with spacing between −0.3 and +0.3.');
    }
    pairs[pair] = roundRooSpacing(amount);
  }
  return pairs;
}

export function exportRooPairs(pairs: RooPairSpacing): string {
  return JSON.stringify({ format: 'roo-pair-spacing', version: 1, units: 'cap-height',
    pairs: Object.fromEntries(Object.entries(pairs).sort(([a], [b]) => a.localeCompare(b))) }, null, 2) + '\n';
}
