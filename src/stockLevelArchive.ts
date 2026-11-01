import type {LevelEntry} from './level';
import {edgeGrindingFingerprint} from './edgeGrindingMigration';
import archive from './stockLevelArchive.json';

const levels=archive.levels as Record<string,Record<string,string[]>>;

/** Complete, exact historical releases only. IDs, both titles, every coordinate
 * and every authoring field participate; no rounding or geometry heuristics.
 * A deliberate editor save can pin a version with the existing author marker. */
export function isPublishedStockLevel(entry:LevelEntry):boolean {
  if(!entry.data||entry.data.edgeGrindingRevision===1)return false;
  const signatures=levels[entry.id]?.[entry.name];
  return !!signatures?.includes(edgeGrindingFingerprint(entry.data));
}
