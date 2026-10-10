import type { CustomLevelData, LevelEntry } from './level';
import snapshots from './edgeGrindingSnapshots.json';

interface SnapshotIndex {
  sources: Record<string, { name: string; hashes: string[] }>;
  patches: Record<string, { name: string; hash: string; clear: number[] }>;
}
const index = snapshots as SnapshotIndex;

/** Stable content identity includes every authoring field, including the old
 * edge flags. Reordering object keys is harmless; editing a value is not. */
export function edgeGrindingFingerprint(data: CustomLevelData): string {
  const text = JSON.stringify(data, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 3266489917);
  }
  return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}

/** Only exact pre-fix defaults advance. Local geometry, colours, names and
 * explicit per-surface edits remain authoritative, including copied levels. */
export function upgradeKnownEdgeDefaults(entry: LevelEntry, builtin: LevelEntry): LevelEntry | null {
  if (!entry.data || entry.id !== builtin.id || entry.data.edgeGrindingRevision === 1) return null;
  const source = index.sources[entry.id], patch = index.patches[entry.id];
  // The registry caps imported menu titles at 28 characters. The full data
  // still has to match exactly; this accepts that existing title normalization.
  const named = (name: string | undefined) => name !== undefined &&
    (entry.name === name || entry.name === name.replace(/\s+/g, ' ').trim().slice(0, 28));
  if (!named(source?.name) && !named(patch?.name)) return null;
  const hash = edgeGrindingFingerprint(entry.data);
  if (source && named(source.name) && source.hashes.includes(hash)) return builtin;
  if (!patch || !named(patch.name) || patch.hash !== hash) return null;
  // The older published pirate snapshot differs in scenery from the source.
  // Repair only its reviewed edge flags; do not replace that saved geometry.
  const data = JSON.parse(JSON.stringify(entry.data)) as CustomLevelData;
  for (const component of patch.clear) delete data.components[component].edgeGrinding;
  return { ...entry, data };
}
