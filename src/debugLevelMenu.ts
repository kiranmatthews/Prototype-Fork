import { CAMPAIGN_LEVELS, campaignLevelById } from './campaign';
import type { LevelEntry } from './level';
import { BONUS_LEVEL_ENTRIES, resolveBonusLevel } from './levels/themed-bonuses';

// Use the authored bonus associations, including parents whose map/save keys
// have changed. Saved editor copies need not share the source data object.
const bonusIdByData = new Map(BONUS_LEVEL_ENTRIES.map(entry => [entry.data, entry.id]));
const bonusIds = new Set(BONUS_LEVEL_ENTRIES.map(entry => entry.id));

/** Display names/order only: keep registry IDs, editor data and saves intact. */
export function debugLevelMenu(entries: readonly LevelEntry[]): LevelEntry[] {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const shown = new Set<string>();
  const rows: LevelEntry[] = [];
  const append = (entry: LevelEntry, name = campaignLevelById(entry.id)?.name ?? entry.name): void => {
    if (shown.has(entry.id)) return;
    shown.add(entry.id);
    rows.push({ ...entry, name });
    const bonusId = bonusIdByData.get(resolveBonusLevel(entry.id));
    const bonus = bonusId ? byId.get(bonusId) : undefined;
    if (bonus && !shown.has(bonus.id)) {
      shown.add(bonus.id);
      rows.push({ ...bonus, name: `${name} Bonus` });
    }
  };

  for (const course of CAMPAIGN_LEVELS) {
    if (course.placeholder) continue;
    const entry = byId.get(course.levelId)
      ?? (course.fallbackLevelId ? byId.get(course.fallbackLevelId) : undefined);
    if (entry) append(entry, course.name);
  }
  // Unmapped tools and custom courses follow the map in registry order, with
  // their authored bonuses beside them too. The shared fallback has no parent.
  for (const entry of entries) {
    if (!bonusIds.has(entry.id) && entry.id !== 'bonus-easy') append(entry);
  }
  for (const entry of entries) {
    if (!shown.has(entry.id)) append(entry, entry.id === 'bonus-easy' ? 'Bonus' : entry.name);
  }
  return rows;
}
