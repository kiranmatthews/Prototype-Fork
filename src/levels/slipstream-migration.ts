import type { LevelEntry } from '../level';
import { edgeGrindingFingerprint } from '../edgeGrindingMigration';
import retired from './slipstream-retired-snapshots.json';
import edges from '../edgeGrindingSnapshots.json';

/** Complete content identities only. A local rename, camera, colour or single
 * coordinate edit keeps the saved course; resolution never rewrites storage. */
export function isRetiredSlipstreamSnapshot(entry: LevelEntry): boolean {
  const previous = retired[entry.id as keyof typeof retired];
  if (!previous || !entry.data || entry.name !== previous.name || entry.data.name !== previous.name) return false;
  const earlier = edges.sources[entry.id as keyof typeof edges.sources];
  return [...previous.hashes, ...(earlier?.hashes ?? [])].includes(edgeGrindingFingerprint(entry.data));
}
