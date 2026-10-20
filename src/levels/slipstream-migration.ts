import type { CustomLevelData, LevelEntry } from '../level';
import retired from './slipstream-retired-snapshots.json';

/** Complete content identities only. A local rename, camera, colour or single
 * coordinate edit keeps the saved course; resolution never rewrites storage. */
export function isRetiredSlipstreamSnapshot(entry: LevelEntry): boolean {
  const previous = retired[entry.id as keyof typeof retired];
  if (!previous || !entry.data || entry.name !== previous.name || entry.data.name !== previous.name) return false;
  return previous.hashes.includes(slipstreamSnapshotKey(entry.data));
}

// The campaign has a fresh identity so no cached version of any retired
// course can shadow the complete route. Original saves remain exportable.
export const SLIPSTREAM_COURSE_ID = 'slipstream-race';
export const LEGACY_SLIPSTREAM_IDS = ['slip', 'slipstream-2', 'astra-chimeworks', 'slipstream-continuous'] as const;
export function isLegacySlipstreamId(id: string): boolean {
  return (LEGACY_SLIPSTREAM_IDS as readonly string[]).includes(id);
}
const ARCHIVED_ENTRIES = new WeakMap<LevelEntry, LevelEntry>();
export function archivedSlipstreamEntry(entry: LevelEntry): LevelEntry {
  const cached = Object.isFrozen(entry) ? ARCHIVED_ENTRIES.get(entry) : undefined;
  if (cached) return cached;
  const archive = Object.freeze({ ...entry, id: `saved-${entry.id}`, name: `Saved: ${entry.name}`.slice(0, 28) });
  if (Object.isFrozen(entry)) ARCHIVED_ENTRIES.set(entry, archive);
  return archive;
}

/** Stable complete content identity; object-key order is not an authored edit. */
export function slipstreamSnapshotKey(data: CustomLevelData): string {
  const text = JSON.stringify(data, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  let a = 2166136261, b = 2246822519;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b ^ text.charCodeAt(i), 3266489917);
  }
  return `${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
