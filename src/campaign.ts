// Campaign-facing level order and durable save data.
//
// This deliberately does not depend on levelList(): the editor list is mutable,
// while campaign progress needs stable keys when a portal is reordered or its
// backing level is replaced.

export const DEFAULT_CAMPAIGN_LIVES = 4;
export const CAMPAIGN_SAVE_SLOTS = 3;

export interface CampaignLevelDefinition {
  /** Stable save identity. Keep this when replacing the backing level. */
  progressKey: string;
  /** Current LevelEntry id loaded by this portal. */
  levelId: string;
  /** Source-owned fallback while a published editor snapshot is still loading. */
  fallbackLevelId?: string;
  /** Player-facing name, independent of editor/debug naming. */
  name: string;
  /** Initial sapphire-style time relic target, in seconds. */
  relicTime: number;
}

export const CAMPAIGN_LEVELS: readonly CampaignLevelDefinition[] = [
  { progressKey: "jungle", levelId: "jungle", name: "Jungle Ruins", relicTime: 165 },
  {
    progressKey: "test-course",
    levelId: "test",
    fallbackLevelId: "flats",
    name: "Test Course",
    relicTime: 300,
  },
  { progressKey: "sky-bridge", levelId: "sky", name: "Sky Bridge", relicTime: 95 },
  { progressKey: "slipstream", levelId: "slip", name: "Slipstream", relicTime: 150 },
  { progressKey: "nightworks", levelId: "dark", name: "Nightworks", relicTime: 185 },
  { progressKey: "beachside-run", levelId: "beachfront", name: "Beachside Run", relicTime: 190 },
  { progressKey: "coastal", levelId: "coastal-street-run", name: "Coastal", relicTime: 420 },
  { progressKey: "island-hopper", levelId: "island-hopper", name: "Island Hopper", relicTime: 175 },
  { progressKey: "jungle-gate", levelId: "jungle-gate-run", name: "Jungle Gate", relicTime: 165 },
] as const;

const LEVEL_BY_ID = new Map<string, CampaignLevelDefinition>();
for (const level of CAMPAIGN_LEVELS) {
  LEVEL_BY_ID.set(level.levelId, level);
  if (level.fallbackLevelId) LEVEL_BY_ID.set(level.fallbackLevelId, level);
}
const LEVEL_BY_KEY = new Map(CAMPAIGN_LEVELS.map((level) => [level.progressKey, level]));

export function campaignLevelById(id: string): CampaignLevelDefinition | null {
  return LEVEL_BY_ID.get(id) ?? null;
}

export function campaignLevelByKey(key: string): CampaignLevelDefinition | null {
  return LEVEL_BY_KEY.get(key) ?? null;
}

export function isCampaignLevel(id: string): boolean {
  return LEVEL_BY_ID.has(id);
}

export interface CampaignLevelProgress {
  cleared: boolean;
  crystal: boolean;
  boxGem: boolean;
  comboGem: boolean;
  timeRelic: boolean;
  bestTime?: number;
}

export interface CampaignSaveV1 {
  v: 1;
  slot: number;
  createdAt: number;
  updatedAt: number;
  lives: number;
  fruit: number;
  levels: Record<string, CampaignLevelProgress>;
}

export interface CampaignTotals {
  percent: number;
  cleared: number;
  crystals: number;
  gems: number;
  relics: number;
  maxLevels: number;
  maxGems: number;
}

export interface GameAudioOptions {
  sfxMuted: boolean;
  musicMuted: boolean;
}

export interface CampaignInventory {
  lives: number;
  fruit: number;
}

export type CampaignSaveResult =
  | { ok: true; save: CampaignSaveV1 }
  | {
      ok: false;
      reason: "no-active-save" | "ephemeral-save" | "storage-unavailable";
    };

export interface CampaignLoadOptions {
  /** Explicit acknowledgement that unsaved working progress may be dropped. */
  discardDirty?: boolean;
}

export interface CampaignCloseOptions {
  /** Required when closing a dirty session without saving it first. */
  discardDirty?: boolean;
}

/**
 * Bonus inventory is a temporary purse. Only a completed bonus merges it
 * into the parent run, including a 100-fruit rollover across the boundary.
 */
export function mergeCompletedBonusInventory(
  parent: Readonly<CampaignInventory>,
  bonus: Readonly<CampaignInventory>,
): CampaignInventory {
  const parentLives = Math.max(0, Math.floor(parent.lives));
  const bonusLives = Math.max(0, Math.floor(bonus.lives));
  const totalFruit =
    Math.max(0, Math.floor(parent.fruit)) +
    Math.max(0, Math.floor(bonus.fruit));
  return {
    lives: parentLives + bonusLives + Math.floor(totalFruit / 100),
    fruit: totalFruit % 100,
  };
}

const SAVES_KEY = "solProtoCampaignSavesV1";
const LAST_SLOT_KEY = "solProtoCampaignLastSlotV1";
const AUTOSAVE_KEY = "solProtoCampaignAutosaveV1";
const OPTIONS_KEY = "solProtoGameOptionsV1";

function emptyLevelProgress(): CampaignLevelProgress {
  return {
    cleared: false,
    crystal: false,
    boxGem: false,
    comboGem: false,
    timeRelic: false,
  };
}

function emptyLevels(): Record<string, CampaignLevelProgress> {
  return Object.fromEntries(
    CAMPAIGN_LEVELS.map((level) => [level.progressKey, emptyLevelProgress()]),
  );
}

function createSave(slot: number, now = Date.now()): CampaignSaveV1 {
  return {
    v: 1,
    slot,
    createdAt: now,
    updatedAt: now,
    lives: DEFAULT_CAMPAIGN_LIVES,
    fruit: 0,
    levels: emptyLevels(),
  };
}

/** Keep the live working copy structurally separate from durable snapshots. */
function cloneSave(save: Readonly<CampaignSaveV1>): CampaignSaveV1 {
  return {
    ...save,
    levels: Object.fromEntries(
      Object.entries(save.levels).map(([key, progress]) => [
        key,
        { ...progress },
      ]),
    ),
  };
}

function cloneSlots(
  slots: readonly (CampaignSaveV1 | null)[],
): Array<CampaignSaveV1 | null> {
  return slots.map((save) => (save ? cloneSave(save) : null));
}

function normalizeLevelProgress(value: unknown): CampaignLevelProgress {
  const raw = value && typeof value === "object"
    ? value as Partial<CampaignLevelProgress>
    : {};
  return {
    cleared: raw.cleared === true,
    crystal: raw.crystal === true,
    boxGem: raw.boxGem === true,
    comboGem: raw.comboGem === true,
    timeRelic: raw.timeRelic === true,
    bestTime:
      typeof raw.bestTime === "number" && Number.isFinite(raw.bestTime) && raw.bestTime > 0
        ? raw.bestTime
        : undefined,
  };
}

function normalizeSave(value: unknown, slot: number): CampaignSaveV1 | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CampaignSaveV1>;
  if (raw.v !== 1) return null;
  const levels = emptyLevels();
  const incoming = raw.levels && typeof raw.levels === "object" ? raw.levels : {};
  for (const level of CAMPAIGN_LEVELS)
    levels[level.progressKey] = normalizeLevelProgress(incoming[level.progressKey]);
  const rawLives =
    typeof raw.lives === "number" && Number.isFinite(raw.lives)
      ? Math.floor(raw.lives)
      : DEFAULT_CAMPAIGN_LIVES;
  // Zero is the final playable reserve state, not an exhausted/corrupt save.
  // Game Over writes the explicit four-life retry state before persistence;
  // only impossible negative data needs recovery here.
  const invalidLives = rawLives < 0;
  return {
    v: 1,
    slot,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
    updatedAt:
      typeof raw.updatedAt === "number" && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : Date.now(),
    lives: invalidLives ? DEFAULT_CAMPAIGN_LIVES : rawLives,
    fruit:
      !invalidLives && typeof raw.fruit === "number" && Number.isFinite(raw.fruit)
        ? Math.max(0, Math.min(99, Math.floor(raw.fruit)))
        : 0,
    levels,
  };
}

function readSlots(): Array<CampaignSaveV1 | null> {
  const slots = Array.from<CampaignSaveV1 | null>({ length: CAMPAIGN_SAVE_SLOTS }).fill(null);
  try {
    const raw = JSON.parse(localStorage.getItem(SAVES_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return slots;
    for (let index = 0; index < CAMPAIGN_SAVE_SLOTS; index++)
      slots[index] = normalizeSave(raw[index], index + 1);
  } catch {
    // Storage can be blocked or an older build can have left malformed data.
  }
  return slots;
}

function writeSlots(slots: readonly (CampaignSaveV1 | null)[]): boolean {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
    return true;
  } catch {
    return false;
  }
}

function readLastSlot(): number | null {
  try {
    const slot = Number(localStorage.getItem(LAST_SLOT_KEY));
    return Number.isInteger(slot) && slot >= 1 && slot <= CAMPAIGN_SAVE_SLOTS
      ? slot
      : null;
  } catch {
    return null;
  }
}

function writeLastSlot(slot: number): boolean {
  try {
    localStorage.setItem(LAST_SLOT_KEY, String(slot));
    return true;
  } catch {
    return false;
  }
}

function readAutosave(): boolean {
  try {
    // Preserve the historical always-save behavior unless explicitly disabled.
    return localStorage.getItem(AUTOSAVE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeAutosave(enabled: boolean): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, enabled ? "on" : "off");
    return true;
  } catch {
    return false;
  }
}

export class CampaignStore {
  /** Snapshots known to have been written; never shared with the live run. */
  private persistedSlots = readSlots();
  /** Mutable working copy for the active run. */
  private activeValue: CampaignSaveV1 | null = null;
  private lastSlot = readLastSlot();
  private dirtyValue = false;
  private autosaveValue = readAutosave();

  get active(): CampaignSaveV1 | null {
    return this.activeValue;
  }

  get activeSlot(): number | null {
    const slot = this.activeValue?.slot ?? 0;
    return slot > 0 ? slot : null;
  }

  get dirty(): boolean {
    return this.dirtyValue;
  }

  get autosaveEnabled(): boolean {
    return this.autosaveValue;
  }

  listSlots(): readonly (CampaignSaveV1 | null)[] {
    // The UI may inspect these freely without gaining a mutation path back to
    // the last durable snapshots.
    return cloneSlots(this.persistedSlots);
  }

  /**
   * Durable save selected by Continue. Prefer the slot actually used this
   * session/across reloads, then fall back to the newest legacy save.
   */
  continueSlot(): number | null {
    const activeSlot = this.activeValue?.slot ?? 0;
    if (activeSlot > 0 && this.persistedSlots[activeSlot - 1]) return activeSlot;
    if (this.lastSlot && this.persistedSlots[this.lastSlot - 1])
      return this.lastSlot;

    let latest: CampaignSaveV1 | null = null;
    for (const save of this.persistedSlots) {
      if (!save) continue;
      if (
        !latest ||
        save.updatedAt > latest.updatedAt ||
        (save.updatedAt === latest.updatedAt && save.createdAt > latest.createdAt) ||
        (save.updatedAt === latest.updatedAt &&
          save.createdAt === latest.createdAt &&
          save.slot < latest.slot)
      )
        latest = save;
    }
    return latest?.slot ?? null;
  }

  newGame(slot: number): CampaignSaveV1 {
    const index = this.slotIndex(slot);
    const save = createSave(index + 1);
    this.activeValue = save;
    this.dirtyValue = true;
    this.lastSlot = save.slot;
    // Slot creation/overwrite is an explicit save operation even when later
    // gameplay autosave is disabled. A failed write leaves a playable, dirty
    // working game that can be retried with saveActive().
    this.saveActive();
    writeLastSlot(save.slot);
    return save;
  }

  load(
    slot: number,
    options: CampaignLoadOptions = {},
  ): CampaignSaveV1 | null {
    const save = this.persistedSlots[this.slotIndex(slot)];
    if (!save) return null;
    if (this.dirtyValue && !options.discardDirty) return null;
    this.activeValue = cloneSave(save);
    this.dirtyValue = false;
    this.lastSlot = save.slot;
    writeLastSlot(save.slot);
    return this.activeValue;
  }

  /** Used by ?lite and tooling without creating or overwriting a real slot. */
  startEphemeral(): CampaignSaveV1 {
    const save = createSave(0);
    this.activeValue = save;
    this.dirtyValue = false;
    return save;
  }

  /**
   * Persist the active working copy atomically from the store's perspective.
   * The durable shelf and timestamp change only after localStorage accepts it.
   */
  saveActive(): CampaignSaveResult {
    const active = this.activeValue;
    if (!active) return { ok: false, reason: "no-active-save" };
    if (active.slot <= 0) return { ok: false, reason: "ephemeral-save" };

    const snapshot = cloneSave(active);
    snapshot.updatedAt = Date.now();
    const nextSlots = cloneSlots(this.persistedSlots);
    nextSlots[active.slot - 1] = snapshot;
    if (!writeSlots(nextSlots))
      return { ok: false, reason: "storage-unavailable" };

    this.persistedSlots = nextSlots;
    active.updatedAt = snapshot.updatedAt;
    this.dirtyValue = false;
    this.lastSlot = active.slot;
    writeLastSlot(active.slot);
    return { ok: true, save: cloneSave(snapshot) };
  }

  /** Restore the active slot's last durable snapshot without closing it. */
  discardActiveChanges(): CampaignSaveV1 | null {
    const slot = this.activeSlot;
    const persisted = slot ? this.persistedSlots[slot - 1] : null;
    this.activeValue = persisted ? cloneSave(persisted) : null;
    this.dirtyValue = false;
    return this.activeValue;
  }

  /**
   * End the active session. Dirty data is protected unless the caller has
   * explicitly chosen Quit Without Saving.
   */
  closeActive(options: CampaignCloseOptions = {}): boolean {
    if (this.dirtyValue && !options.discardDirty) return false;
    this.activeValue = null;
    this.dirtyValue = false;
    return true;
  }

  /**
   * Autosave is a device preference. Enabling it immediately flushes a dirty
   * durable run; the false result lets UI report either write failure honestly.
   */
  setAutosave(enabled: boolean): boolean {
    this.autosaveValue = enabled;
    const preferenceSaved = writeAutosave(enabled);
    const activeSaved = enabled && this.dirtyValue
      ? this.saveActive().ok
      : true;
    return preferenceSaved && activeSaved;
  }

  updateInventory(lives: number, fruit: number): void {
    const save = this.activeValue;
    if (!save) return;
    const nextLives = Math.max(0, Math.floor(lives));
    const nextFruit = Math.max(0, Math.min(99, Math.floor(fruit)));
    if (save.lives === nextLives && save.fruit === nextFruit) return;
    save.lives = nextLives;
    save.fruit = nextFruit;
    this.noteWorkingChange();
  }

  resetInventory(): void {
    const save = this.activeValue;
    if (!save) return;
    if (save.lives === DEFAULT_CAMPAIGN_LIVES && save.fruit === 0) return;
    save.lives = DEFAULT_CAMPAIGN_LIVES;
    save.fruit = 0;
    this.noteWorkingChange();
  }

  levelProgress(levelId: string): CampaignLevelProgress | null {
    const definition = campaignLevelById(levelId);
    const save = this.activeValue;
    if (!definition || !save) return null;
    return save.levels[definition.progressKey];
  }

  runModesUnlocked(levelId: string): boolean {
    const progress = this.levelProgress(levelId);
    return progress ? progress.cleared && progress.crystal : false;
  }

  commitClear(
    levelId: string,
    rewards: {
      crystal: boolean;
      boxGem: boolean;
      comboGem: boolean;
      timeRelic?: boolean;
      time?: number;
    },
  ): CampaignLevelProgress | null {
    const progress = this.levelProgress(levelId);
    if (!progress) return null;
    const before = { ...progress };
    progress.cleared = true;
    progress.crystal = progress.crystal || rewards.crystal;
    progress.boxGem = progress.boxGem || rewards.boxGem;
    progress.comboGem = progress.comboGem || rewards.comboGem;
    progress.timeRelic = progress.timeRelic || rewards.timeRelic === true;
    if (typeof rewards.time === "number" && Number.isFinite(rewards.time) && rewards.time > 0)
      progress.bestTime = progress.bestTime === undefined
        ? rewards.time
        : Math.min(progress.bestTime, rewards.time);
    if (
      progress.cleared !== before.cleared ||
      progress.crystal !== before.crystal ||
      progress.boxGem !== before.boxGem ||
      progress.comboGem !== before.comboGem ||
      progress.timeRelic !== before.timeRelic ||
      progress.bestTime !== before.bestTime
    )
      this.noteWorkingChange();
    return progress;
  }

  totals(save: CampaignSaveV1 | null = this.activeValue): CampaignTotals {
    let cleared = 0;
    let crystals = 0;
    let gems = 0;
    let relics = 0;
    let earned = 0;
    const maxMilestones = CAMPAIGN_LEVELS.length * 5;
    if (save) {
      for (const level of CAMPAIGN_LEVELS) {
        const progress = save.levels[level.progressKey] ?? emptyLevelProgress();
        if (progress.cleared) { cleared++; earned++; }
        if (progress.crystal) { crystals++; earned++; }
        if (progress.boxGem) { gems++; earned++; }
        if (progress.comboGem) { gems++; earned++; }
        if (progress.timeRelic) { relics++; earned++; }
      }
    }
    return {
      percent: Math.round((earned / maxMilestones) * 100),
      cleared,
      crystals,
      gems,
      relics,
      maxLevels: CAMPAIGN_LEVELS.length,
      maxGems: CAMPAIGN_LEVELS.length * 2,
    };
  }

  private noteWorkingChange(): void {
    const save = this.activeValue;
    if (!save || save.slot <= 0) return;
    this.dirtyValue = true;
    if (this.autosaveValue) this.saveActive();
  }

  private slotIndex(slot: number): number {
    return Math.max(0, Math.min(CAMPAIGN_SAVE_SLOTS - 1, Math.floor(slot) - 1));
  }
}

export function loadGameAudioOptions(): GameAudioOptions {
  try {
    const value = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? "{}") as Partial<GameAudioOptions>;
    return {
      sfxMuted: value.sfxMuted === true,
      musicMuted: value.musicMuted === true,
    };
  } catch {
    return { sfxMuted: false, musicMuted: false };
  }
}

export function saveGameAudioOptions(options: GameAudioOptions): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // Preferences simply remain session-local when storage is unavailable.
  }
}
