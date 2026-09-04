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
  const exhausted = rawLives <= 0;
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
    lives: exhausted ? DEFAULT_CAMPAIGN_LIVES : rawLives,
    fruit:
      !exhausted && typeof raw.fruit === "number" && Number.isFinite(raw.fruit)
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

function writeSlots(slots: readonly (CampaignSaveV1 | null)[]): void {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(slots));
  } catch {
    // The running session remains usable when storage is unavailable.
  }
}

export class CampaignStore {
  private slots = readSlots();
  private activeValue: CampaignSaveV1 | null = null;

  get active(): CampaignSaveV1 | null {
    return this.activeValue;
  }

  listSlots(): readonly (CampaignSaveV1 | null)[] {
    return this.slots;
  }

  newGame(slot: number): CampaignSaveV1 {
    const index = this.slotIndex(slot);
    const save = createSave(index + 1);
    this.slots[index] = save;
    this.activeValue = save;
    writeSlots(this.slots);
    return save;
  }

  load(slot: number): CampaignSaveV1 | null {
    const save = this.slots[this.slotIndex(slot)];
    this.activeValue = save;
    return save;
  }

  /** Used by ?lite and tooling without creating or overwriting a real slot. */
  startEphemeral(): CampaignSaveV1 {
    const save = createSave(0);
    this.activeValue = save;
    return save;
  }

  updateInventory(lives: number, fruit: number): void {
    const save = this.activeValue;
    if (!save) return;
    const nextLives = Math.max(0, Math.floor(lives));
    const nextFruit = Math.max(0, Math.min(99, Math.floor(fruit)));
    if (save.lives === nextLives && save.fruit === nextFruit) return;
    save.lives = nextLives;
    save.fruit = nextFruit;
    this.persist();
  }

  resetInventory(): void {
    const save = this.activeValue;
    if (!save) return;
    save.lives = DEFAULT_CAMPAIGN_LIVES;
    save.fruit = 0;
    this.persist();
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
    progress.cleared = true;
    progress.crystal = progress.crystal || rewards.crystal;
    progress.boxGem = progress.boxGem || rewards.boxGem;
    progress.comboGem = progress.comboGem || rewards.comboGem;
    progress.timeRelic = progress.timeRelic || rewards.timeRelic === true;
    if (typeof rewards.time === "number" && Number.isFinite(rewards.time) && rewards.time > 0)
      progress.bestTime = progress.bestTime === undefined
        ? rewards.time
        : Math.min(progress.bestTime, rewards.time);
    this.persist();
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

  private persist(): void {
    const save = this.activeValue;
    if (!save) return;
    save.updatedAt = Date.now();
    if (save.slot > 0) {
      this.slots[save.slot - 1] = save;
      writeSlots(this.slots);
    }
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
