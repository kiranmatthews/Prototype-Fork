// Campaign-facing level order and durable save data.
//
// This deliberately does not depend on levelList(): the editor list is mutable,
// while campaign progress needs stable keys when a portal is reordered or its
// backing level is replaced.

export const DEFAULT_CAMPAIGN_LIVES = 4;
/** First playable hub; kept separate from append-only editor identities. */
export const CAMPAIGN_START_LEVEL_KEY = "treehouse-trail";
export const CAMPAIGN_SAVE_SLOTS = 4;
/** Placeholder target shared by every canonical trial until authored per-level. */
export const CAMPAIGN_TIME_RELIC_TARGET_SECONDS = 60;
export const MAX_RELIC_TIME_SECONDS = 86_400;
export function validRelicTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0.01 && value <= MAX_RELIC_TIME_SECONDS;
}

/** Authored level metadata wins; existing courses keep their campaign/default target. */
export function resolveRelicTime(levelId: string, data?: { relicTime?: number; medalTimes?: MedalTimes }): number {
  return validMedalTimes(data?.medalTimes) ? data.medalTimes.gold : validRelicTime(data?.relicTime) ? data.relicTime
    : campaignLevelById(levelId)?.relicTime ?? CAMPAIGN_TIME_RELIC_TARGET_SECONDS;
}

export const TIME_MEDALS = ['gold', 'silver', 'bronze'] as const;
export type TimeMedal = typeof TIME_MEDALS[number];
export type MedalTimes = Record<TimeMedal, number>;
export function validTimeMedal(value: unknown): value is TimeMedal {
  return value === 'gold' || value === 'silver' || value === 'bronze';
}
export function validMedalTimes(value: unknown): value is MedalTimes {
  if (!value || typeof value !== 'object') return false;
  const t = value as MedalTimes;
  return validRelicTime(t.gold) && validRelicTime(t.silver) && validRelicTime(t.bronze)
    && t.gold <= t.silver && t.silver <= t.bronze;
}
export function defaultMedalTimes(gold = CAMPAIGN_TIME_RELIC_TARGET_SECONDS): MedalTimes {
  const silver = Math.min(MAX_RELIC_TIME_SECONDS, Math.max(gold, Math.round(gold * 115) / 100));
  return { gold, silver, bronze: Math.min(MAX_RELIC_TIME_SECONDS, Math.max(silver, Math.round(gold * 130) / 100)) };
}
export function resolveMedalTimes(levelId: string, data?: { relicTime?: number; medalTimes?: MedalTimes }): MedalTimes {
  return validMedalTimes(data?.medalTimes) ? { ...data.medalTimes } : defaultMedalTimes(resolveRelicTime(levelId, data));
}
export function medalForTime(time: number, targets: MedalTimes): TimeMedal | null {
  if (!Number.isFinite(time) || time <= 0 || !validMedalTimes(targets)) return null;
  return TIME_MEDALS.find(tier => time <= targets[tier]) ?? null;
}
/** Legacy relic ownership represents gold; never infer/downgrade awards from edited targets. */
export function earnedTimeMedal(progress?: { timeMedal?: TimeMedal; timeRelic?: boolean } | null): TimeMedal | null {
  return validTimeMedal(progress?.timeMedal) ? progress.timeMedal : progress?.timeRelic === true ? 'gold' : null;
}
export function higherTimeMedal(a: TimeMedal | null, b: TimeMedal | null): TimeMedal | null {
  if (!a) return b; if (!b) return a;
  return TIME_MEDALS.indexOf(a) <= TIME_MEDALS.indexOf(b) ? a : b;
}
/** Keep each live editor transaction ordered, moving neighbouring targets only when necessary. */
export function editMedalTime(times: MedalTimes, tier: TimeMedal, value: number): MedalTimes {
  const next = { ...times };
  if (!Number.isFinite(value)) return next;
  next[tier] = Math.max(0.01, Math.min(MAX_RELIC_TIME_SECONDS, value));
  if (tier === 'gold') { next.silver = Math.max(next.silver, next.gold); next.bronze = Math.max(next.bronze, next.silver); }
  if (tier === 'silver') { next.gold = Math.min(next.gold, next.silver); next.bronze = Math.max(next.bronze, next.silver); }
  if (tier === 'bronze') { next.silver = Math.min(next.silver, next.bronze); next.gold = Math.min(next.gold, next.silver); }
  return next;
}

export interface CampaignLevelDefinition {
  /** Stable save identity. Keep this when replacing the backing level. */
  progressKey: string;
  /** Current LevelEntry id loaded by this portal. */
  levelId: string;
  /** Source-owned fallback while a published editor snapshot is still loading. */
  fallbackLevelId?: string;
  /** Player-facing name, independent of editor/debug naming. */
  name: string;
  /** Legacy field: the gold-medal benchmark, in seconds. */
  relicTime: number;
  /** Stable island identity used by the world-map camera and progress ledger. */
  islandId: CampaignIslandId;
  /** Horizontal sequence identity; Up/Down only connects different paths. */
  mapPath: "main" | "upper-branch" | "lower-branch";
  /** World-map hub position. Y is the character's supported feet height. */
  mapPosition: readonly [number, number, number];
  /** Progress keys that can reveal this hub. Empty means available at New Game. */
  unlockAfter: readonly string[];
  /** Branch joins may accept any cleared prerequisite; ordinary joins require all. */
  unlockMode?: "all" | "any";
  /** Boss hubs use a larger silhouette and island-end presentation. */
  boss?: boolean;
  /** Handcrafted three-run boss; its only collectible is the cup. */
  competition?: boolean;
  /** An ordinary course can omit its bonus detour while keeping its crystal. */
  bonus?: boolean;
  skateRace?: boolean;
  /** Reserved map destination; never loads a substitute gameplay course. */
  placeholder?: boolean;
  previewKey?: string;
  /** Existing free skate parks have no timed-trial medal. */
  timeTrial?: boolean;
  secretRequirement?: SecretRequirement;
  /** Set when a real coloured-gem challenge is authored for this course. */
  colouredGem?: string;
}

export type CampaignIslandId = "island-1" | "island-2" | "island-3" | "island-4" | "island-5" | "hidden-shores";
export type SecretRequirement = 'medals-5' | 'gems-5' | 'medals-10' | 'gems-15' | 'medals-20' | 'main-medals' | 'all-clear-gems' | 'all-rewards';
export const SECRET_REQUIREMENT_LABELS: Record<SecretRequirement, string> = {
  'medals-5': '5 time trial medals', 'gems-5': '5 clear gems',
  'medals-10': '10 time trial medals', 'gems-15': '15 clear gems',
  'medals-20': '20 time trial medals', 'main-medals': 'All main game medals',
  'all-clear-gems': 'All main + earlier secret clear gems',
  'all-rewards': 'All main + earlier secret gems, medals + coloured gems',
};

export interface CampaignIslandDefinition {
  id: CampaignIslandId;
  name: string;
  subtitle: string;
  centre: readonly [number, number, number];
  levelKeys: readonly string[];
}

export const CAMPAIGN_ISLANDS: readonly CampaignIslandDefinition[] = [
  { id: 'island-1', name: 'Motu Motu', subtitle: 'JUNGLE · RIVER · BEACH', centre: [-95,0,0],
    levelKeys: ['treehouse-trail','beachside-run','jungle','rumblewater-run','coastal','jungle-cup'] },
  { id: 'island-2', name: 'The Uga Isles', subtitle: 'SUNSET · TRIBES · SHIPWRECKS', centre: [150,0,0],
    levelKeys: ['custard-creek','tribal-run','waterfall-climb','test-course','drowned-crown','crab-chief'] },
  { id: 'island-3', name: 'Spooky Shores', subtitle: 'GHOSTS · RUINS · RAILWAYS', centre: [395,0,0],
    levelKeys: ['waterpark','codex-switchback','ghost-train','hollowwake-descent','slipstream','waterpark-cup'] },
  { id: 'island-4', name: 'Maynard Quay', subtitle: 'OUTER BANKS · CLUBS · HARBOURS', centre: [640,0,0],
    levelKeys: ['carlisle-coast','country-club','rooftop-relay','maynard-course-4','maynard-course-5','maynard-boss'] },
  { id: 'island-5', name: 'Quagmire Caverns', subtitle: 'FACTORIES · NIGHTMARES · FIRE', centre: [885,0,0],
    levelKeys: ['warehouse','jungle-minefield','nightworks-after-hours','nightworks','quagmire-race','quagmire-boss'] },
  { id: 'hidden-shores', name: 'Secret Island', subtitle: 'BOSSES · MEDALS · CLEAR GEMS', centre: [1155,0,0],
    levelKeys: ['secret-1','secret-2','secret-3','secret-4','secret-5','secret-6','secret-7','secret-8'] },
];

export type CampaignMapTravelStyle = "trail" | "boardslide";
export type CampaignMapDirection = "up" | "down" | "left" | "right";

export interface CampaignMapEdgeDefinition {
  from: string;
  to: string;
  travel: CampaignMapTravelStyle;
  /** Discrete input used to leave each endpoint. Keep slots unique per hub. */
  fromDirection: CampaignMapDirection;
  toDirection: CampaignMapDirection;
  /** Optional authored lift at the route midpoint, in world metres. */
  lift?: number;
  /** Map-only curve guides; level reordering never changes runtime geometry code. */
  waypoints?: readonly (readonly [number, number, number])[];
}

/** Append-only editor point identities, including retired hubs. Never compact saved indices. */
const LEGACY_CAMPAIGN_MAP_HUBS: readonly CampaignLevelDefinition[] = [
  {
    progressKey: "jungle",
    levelId: "jungle",
    name: "Jungle Ruins",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1",
    mapPath: "main",
    mapPosition: [-151, 1.35, 22],
    unlockAfter: ["treehouse-trail"],
  },
  {
    progressKey: "test-course",
    levelId: "test",
    fallbackLevelId: "flats",
    name: "Carlisle Coast",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1",
    mapPath: "main",
    mapPosition: [-111, 4, 22],
    unlockAfter: ["jungle"],
  },
  {
    progressKey: "sky-bridge",
    levelId: "sky",
    name: "Sky Bridge",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1",
    mapPath: "main",
    mapPosition: [-71, 6, 22],
    unlockAfter: ["test-course"],
  },
  {
    progressKey: "slipstream",
    levelId: "slipstream-race",
    fallbackLevelId: "slip",
    bonus: false,
    skateRace: true,
    name: "Slipstream",
    relicTime: 160,
    islandId: "island-1",
    mapPath: "main",
    mapPosition: [-47, 3, 22],
    unlockAfter: ["sky-bridge"],
  },
  {
    progressKey: "nightworks",
    levelId: "dark",
    name: "Nightworks",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1",
    mapPath: "upper-branch",
    mapPosition: [-111, 9, -1],
    unlockAfter: ["test-course"],
  },
  {
    progressKey: "beachside-run",
    levelId: "beachfront",
    name: "Beachside Run",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "main",
    mapPosition: [48, 1.35, 16],
    unlockAfter: ["jungle-cup"],
  },
  {
    progressKey: "coastal",
    levelId: "coastal-street-run",
    name: "Coastal",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "main",
    mapPosition: [67, 1.75, 14],
    unlockAfter: ["beachside-run"],
  },
  {
    progressKey: "island-hopper",
    // Retired destination; reserve this editor point identity for old maps.
    levelId: "island-hopper",
    name: "Island Hopper",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "main",
    mapPosition: [86, 2.4, 14],
    unlockAfter: ["coastal"],
  },
  {
    progressKey: "jungle-gate",
    levelId: "jungle-gate-run",
    name: "Jungle Gate",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "main",
    mapPosition: [122, 3.1, 14],
    unlockAfter: ["codex-switchback"],
    boss: true,
  },
  // Append-only identity order keeps existing editor hub indices stable.
  // Append new identities: existing editable worldmap.pts arrays use these
  // indices. Island display order lives in CAMPAIGN_ISLANDS.levelKeys.
  {
    progressKey: "codex-switchback",
    levelId: "codex-lab",
    name: "Haunted Hassle",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "main",
    mapPosition: [104, 2.8, 14],
    unlockAfter: ["coastal"],
  },
  {
    progressKey: "chimeworks",
    levelId: "astra-chimeworks",
    name: "Chimeworks",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "lower-branch",
    mapPosition: [67, 2.3, 26],
    unlockAfter: ["coastal"],
  },
  {
    progressKey: "jungle-cup", levelId: "jungle-cup", name: "Jungle Cup",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1", mapPath: "main", mapPosition: [-31, 3.8, 22],
    unlockAfter: ["slipstream"], boss: true, competition: true,
  },
  {
    progressKey: "treehouse-trail",
    levelId: "treehouse-trail",
    name: "Treehouse Trail",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-1",
    mapPath: "main",
    mapPosition: [-175, 1.35, 22],
    unlockAfter: [],
  },
  {
    progressKey: "waterpark",
    levelId: "waterpark",
    name: "Deadwater Park",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
    islandId: "island-2",
    mapPath: "upper-branch",
    mapPosition: [67, 6, 4],
    unlockAfter: ["coastal"],
  },
  {
    progressKey:"waterpark-cup",levelId:"waterpark-cup",name:"Deadwater Cup",
    relicTime:CAMPAIGN_TIME_RELIC_TARGET_SECONDS,islandId:"island-2",
    mapPath:"upper-branch",mapPosition:[90,12,4],unlockAfter:["waterpark"],competition:true,
  },
  // Retired puzzle-course slots remain only to preserve saved map point indices.
  // Their gameplay now belongs to Fern Reliquary, Lifeguard Lockup and Rooftop Deliveries.
  {
    progressKey: "crate-primer", levelId: "crate-primer", name: "Crate Primer",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS, islandId: "island-2",
    mapPath: "main", mapPosition: [143, 2.1, 29], unlockAfter: [],
  },
  {
    progressKey: "switchyard", levelId: "switchyard", name: "Switchyard",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS, islandId: "island-2",
    mapPath: "main", mapPosition: [157, 2.4, 34], unlockAfter: [],
  },
  {
    progressKey: "clockwork-gauntlet", levelId: "clockwork-gauntlet", name: "Clockwork Gauntlet",
    relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS, islandId: "island-2",
    mapPath: "main", mapPosition: [171, 3.1, 29], unlockAfter: [],
  },
  {
    progressKey:"nightworks-after-hours",levelId:"nightworks-after-hours",name:"Nightworks: After Hours",
    relicTime:75,islandId:"island-1",mapPath:"upper-branch",mapPosition:[-81,10,-1],unlockAfter:["nightworks"],
  },
  { progressKey: "jungle-terraces", levelId: "jungle-terraces", name: "Temple of Embers", relicTime: 240,
    islandId: "island-1", mapPath: "upper-branch", mapPosition: [-151, 7, 7], unlockAfter: ["jungle"] },
  // Retained only as a serialized editor-map slot; never a playable menu row.
  { progressKey: "jungle-skyline", levelId: "jungle-skyline", name: "Temple Skyline", relicTime: 125,
    islandId: "island-1", mapPath: "upper-branch", mapPosition: [-131, 11, 7], unlockAfter: ["jungle-terraces"] },
  { progressKey: "drowned-crown", levelId: "drowned-crown", name: "The Drowned Crown", relicTime: 210,
    islandId: "hidden-shores", mapPath: "main", mapPosition: [294, 1.4, 14], unlockAfter: [] },
  { progressKey: "bone-yard", levelId: "bone-yard", name: "The Bone Yard", relicTime: 60,
    islandId: "hidden-shores", mapPath: "main", mapPosition: [322, 3, 14], unlockAfter: [] },
  { progressKey: "crab-chief", levelId: "crab-chief", name: "Tidebreak · Crab Chief", relicTime: 120,
    islandId: "hidden-shores", mapPath: "main", mapPosition: [350, 2, 14], unlockAfter: [], boss: true },
  { progressKey: "ghost-train", levelId: "ghost-train", name: "Ghost Train", relicTime: 340,
    islandId: "hidden-shores", mapPath: "main", mapPosition: [322, 6, 34], unlockAfter: [] },
  // Append the identity to preserve every published editor/map point index.
  { progressKey: "custard-creek", levelId: "custard-creek", name: "Custard Creek", relicTime: 180,
    islandId: "island-1", mapPath: "lower-branch", mapPosition: [-111, 2.4, 46], unlockAfter: ["test-course"] },
  { progressKey: "slipstream-2", levelId: "slipstream-2", name: "Slipstream 2", relicTime: 72,
    islandId: "island-1", mapPath: "upper-branch", mapPosition: [-47, 11, -1], unlockAfter: ["slipstream"] },
  { progressKey:'rumblewater-run',levelId:'rumblewater-run',name:'Rumblewater Run',relicTime:118,
    islandId:'island-1',mapPath:'lower-branch',mapPosition:[-96,2.5,65],unlockAfter:['custard-creek'] },
] as const;

/** Names and backing IDs live here; geometry and save keys retain their identities. */
const ASSIGNMENTS: Record<string, Partial<CampaignLevelDefinition> & { name: string }> = {
  'treehouse-trail': {name:'Treehouse Trail'},
  'beachside-run': {name:'Banana Bay'},
  jungle: {name:'Jungle Ruins'},
  'rumblewater-run': {name:'Ripcord River'},
  coastal: {name:'Beach Street'},
  'jungle-cup': {name:'Motu Beach Invitational',boss:true,competition:true},
  'custard-creek': {name:'Sunset Safari'},
  'tribal-run': {name:'Tribal Run',placeholder:true},
  'waterfall-climb': {name:'Waterfall Climb',placeholder:true},
  'test-course': {name:'Uga Ambush',fallbackLevelId:undefined},
  'drowned-crown': {name:'The Merchant Wreck'},
  'crab-chief': {name:'High Chief Uga Ha ku',boss:true},
  waterpark: {name:'Deadwater Park'},
  'codex-switchback': {name:'Haunted Hassle'},
  'ghost-train': {name:'Ghost Train'},
  'hollowwake-descent': {name:'Tunnelbore Tracks',levelId:'hollowwake-descent',previewKey:'hollowwake-descent',relicTime:180},
  slipstream: {name:'Slipstream',boss:true,skateRace:true},
  'waterpark-cup': {name:'Deadwater Cup',boss:true,competition:true},
  'carlisle-coast': {name:'Carlisle Coast',placeholder:true},
  'country-club': {name:'Country Club Circuit',levelId:'country-club',previewKey:'country-club',skateRace:true,bonus:false},
  'rooftop-relay': {name:'Hogsworth Harbour',levelId:'rooftop-relay',previewKey:'rooftop-relay'},
  'maynard-course-4': {name:'Unnamed Course 4',placeholder:true},
  'maynard-course-5': {name:'Unnamed Course 5',placeholder:true},
  'maynard-boss': {name:'Maynard Quay Boss',placeholder:true,boss:true},
  warehouse: {name:'Factory Fuss',levelId:'warehouse',previewKey:'warehouse',bonus:false,timeTrial:false},
  'jungle-minefield': {name:'Nightmare Grove',levelId:'jungle-minefield',previewKey:'jungle-minefield'},
  'nightworks-after-hours': {name:'Guptus Eruptus'},
  nightworks: {name:'Torchlight Trouble'},
  'quagmire-race': {name:'Skate Race',placeholder:true,boss:true,skateRace:true},
  'quagmire-boss': {name:'Monster Final Boss',placeholder:true,boss:true},
  ...Object.fromEntries((Object.keys(SECRET_REQUIREMENT_LABELS) as SecretRequirement[]).map((requirement,index) =>
    [`secret-${index+1}`, {name:['5 Medals','5 Clear Gems','10 Medals','15 Clear Gems','20 Medals','All Main Medals','All Clear Gems','All Gems & Medals'][index],placeholder:true,secretRequirement:requirement}])),
};

let previous = '';
export const CAMPAIGN_LEVELS: readonly CampaignLevelDefinition[] = CAMPAIGN_ISLANDS.flatMap(island =>
  island.levelKeys.map((key,index) => {
    const legacy = LEGACY_CAMPAIGN_MAP_HUBS.find(level => level.progressKey === key);
    const assignment = ASSIGNMENTS[key];
    const definition: CampaignLevelDefinition = {
      relicTime: CAMPAIGN_TIME_RELIC_TARGET_SECONDS,
      ...legacy, ...assignment,
      progressKey:key, levelId:assignment.levelId ?? legacy?.levelId ?? `planned-${key}`,
      islandId:island.id, mapPath:'main',
      mapPosition:[island.centre[0] + (index-(island.levelKeys.length-1)/2)*26, 1.8 + [0,.3,1.2,.6,.2,1.4,1,.4][index], 22],
      unlockAfter:previous ? [previous] : [],
    };
    // Unbuilt ordinary slots can be inspected along the trail. A missing boss
    // still seals the next island; no placeholder ever earns a synthetic clear.
    if (!definition.placeholder || definition.boss) previous = key;
    return definition;
  }),
);

/** Append only: keep every archived editor point and every old save key. */
export const CAMPAIGN_MAP_HUBS: readonly CampaignLevelDefinition[] = [
  ...LEGACY_CAMPAIGN_MAP_HUBS.map(legacy => CAMPAIGN_LEVELS.find(level => level.progressKey === legacy.progressKey) ?? legacy),
  ...CAMPAIGN_LEVELS.filter(level => !LEGACY_CAMPAIGN_MAP_HUBS.some(legacy => legacy.progressKey === level.progressKey)),
];

/** Adopt the six-island layout only for untouched old authored map captures. */
export function migrateCampaignMapPoints(points: number[][]): number[][] {
  if (points.length < 11 || points.length > LEGACY_CAMPAIGN_MAP_HUBS.length) return points;
  const legacy = LEGACY_CAMPAIGN_MAP_HUBS.slice(0,points.length).map(({mapPosition:[x,y,z]}) => [x,z,0,y]);
  const versions = [legacy];
  if (points.length === 11 || points.length === 12 || points.length === 13) {
    const beforeBlockworks = legacy.map(point => [...point]);
    beforeBlockworks[8] = [104,14,0,3.1];
    beforeBlockworks[9] = [-71,-1,0,11];
    if (points.length === 11) beforeBlockworks[4][0] = -31;
    versions.push(beforeBlockworks);
    if (points.length >= 12) {
      for (const version of [legacy,beforeBlockworks]) {
        const swapped = version.map(point => [...point]);
        [swapped[3],swapped[4]] = [swapped[4],swapped[3]];
        versions.push(swapped);
      }
    }
  }
  if (points.length >= 15) {
    const beforeDeadwater = legacy.map(point => [...point]);
    beforeDeadwater[13] = [86,4,0,6]; beforeDeadwater[14] = [109,4,0,12];
    versions.push(beforeDeadwater);
  }
  const unchanged = versions.some(version => points.every((point,index) =>
    point.length === 4 && point.every((value,axis) => value === version[index][axis])));
  return unchanged ? CAMPAIGN_MAP_HUBS.map(({mapPosition:[x,y,z]}) => [x,z,0,y]) : points;
}

export const CAMPAIGN_MAP_EDGES: readonly CampaignMapEdgeDefinition[] = CAMPAIGN_LEVELS.slice(1).map((to,index) => {
  const from = CAMPAIGN_LEVELS[index], crossing = from.islandId !== to.islandId;
  return {from:from.progressKey,to:to.progressKey,travel:crossing ? 'boardslide' : 'trail',
    fromDirection:'right',toDirection:'left', ...(crossing ? {lift:6} : {})};
});

export const CAMPAIGN_BOSSES = CAMPAIGN_LEVELS.filter(level => level.boss);
export const campaignHasCourseRewards = (level: CampaignLevelDefinition): boolean =>
  !level.competition && (!level.boss || level.skateRace === true);
export const campaignHasTimeTrial = (level: CampaignLevelDefinition): boolean =>
  campaignHasCourseRewards(level) && level.timeTrial !== false;

/** One best-tier medal and one all-boxes clear gem per course. Later locked
 * secret stages are excluded from their own requirements to avoid a cycle. */
export function secretRequirementMet(key: string, save: CampaignSaveV1 | null): boolean {
  const destination = CAMPAIGN_LEVELS.find(level => level.progressKey === key);
  if (!destination?.secretRequirement || !save) return false;
  const main = CAMPAIGN_LEVELS.filter(level => level.islandId !== 'hidden-shores' && campaignHasCourseRewards(level));
  const secrets = CAMPAIGN_LEVELS.filter(level => level.islandId === 'hidden-shores');
  const earlier = secrets.slice(0,secrets.indexOf(destination));
  const courses = [...main,...earlier];
  const earned = (level: CampaignLevelDefinition) => save.levels[level.progressKey];
  const medals = courses.filter(level => campaignHasTimeTrial(level) && earnedTimeMedal(earned(level))).length;
  const gems = courses.filter(level => earned(level)?.boxGem).length;
  switch (destination.secretRequirement) {
    case 'medals-5': return medals >= 5;
    case 'gems-5': return gems >= 5;
    case 'medals-10': return medals >= 10;
    case 'gems-15': return gems >= 15;
    case 'medals-20': return medals >= 20;
    case 'main-medals': return main.filter(campaignHasTimeTrial).every(level => !!earnedTimeMedal(earned(level)));
    case 'all-clear-gems': return courses.every(level => earned(level)?.boxGem);
    case 'all-rewards': {
      const coloured = courses.filter(level => level.colouredGem);
      // No coloured challenges are authored yet. Never turn an empty set into
      // an automatic final unlock, or treat retired combo gems as coloured gems.
      return coloured.length > 0 && coloured.every(level => earned(level)?.colouredGem)
        && courses.every(level => earned(level)?.boxGem && (!campaignHasTimeTrial(level) || earnedTimeMedal(earned(level))));
    }
  }
}

export function secretIslandUnlocked(save: CampaignSaveV1 | null): boolean {
  return !!save && CAMPAIGN_BOSSES.every(level => {
    const progress = save.levels[level.progressKey];
    return level.competition ? progress?.cup === true : level.skateRace ? progress?.raceWon === true : progress?.cleared === true;
  }) && CAMPAIGN_LEVELS.some(level => secretRequirementMet(level.progressKey,save));
}

export function campaignMapPointIndex(key: string): number {
  return CAMPAIGN_MAP_HUBS.findIndex(level => level.progressKey === key);
}

const LEVEL_BY_ID = new Map<string, CampaignLevelDefinition>();
for (const level of CAMPAIGN_LEVELS) {
  LEVEL_BY_ID.set(level.levelId, level);
  if (level.fallbackLevelId) LEVEL_BY_ID.set(level.fallbackLevelId, level);
}
const LEVEL_BY_KEY = new Map(CAMPAIGN_LEVELS.map((level) => [level.progressKey, level]));

export function validateCampaignMapGraph(): string[] {
  const errors: string[] = [];
  const directionSlots = new Set<string>();
  const edgePairs = new Set<string>();
  const connectedKeys = new Set<string>();
  for (const edge of CAMPAIGN_MAP_EDGES) {
    const from = LEVEL_BY_KEY.get(edge.from), to = LEVEL_BY_KEY.get(edge.to);
    const opposite = { left: "right", right: "left", up: "down", down: "up" } as const;
    if (edge.toDirection !== opposite[edge.fromDirection])
      errors.push(`non-reciprocal map directions ${edge.from}:${edge.to}`);
    if (from && to) {
      const horizontal = from.mapPath === to.mapPath;
      if (horizontal && (edge.fromDirection !== "right" || edge.toDirection !== "left" || to.mapPosition[0] <= from.mapPosition[0]))
        errors.push(`path progression must run left-to-right ${edge.from}:${edge.to}`);
      if (!horizontal && (edge.fromDirection !== (to.mapPosition[2] < from.mapPosition[2] ? "up" : "down") || Math.abs(to.mapPosition[0] - from.mapPosition[0]) > 2))
        errors.push(`branch junction must run vertically ${edge.from}:${edge.to}`);
    }
    if (!LEVEL_BY_KEY.has(edge.from)) errors.push(`unknown map edge source ${edge.from}`);
    if (!LEVEL_BY_KEY.has(edge.to)) errors.push(`unknown map edge destination ${edge.to}`);
    if (edge.from === edge.to) errors.push(`self-connected map edge ${edge.from}`);
    const pair = [edge.from, edge.to].sort().join("|");
    if (edgePairs.has(pair)) errors.push(`duplicate map edge ${pair}`);
    edgePairs.add(pair);
    for (const [key, direction] of [
      [edge.from, edge.fromDirection],
      [edge.to, edge.toDirection],
    ] as const) {
      const slot = `${key}:${direction}`;
      if (directionSlots.has(slot)) errors.push(`duplicate map direction slot ${slot}`);
      directionSlots.add(slot);
      connectedKeys.add(key);
    }
  }
  for (const level of CAMPAIGN_LEVELS)
    if (!connectedKeys.has(level.progressKey))
      errors.push(`campaign hub has no map edge ${level.progressKey}`);
  return errors;
}

const CAMPAIGN_MAP_GRAPH_ERRORS = validateCampaignMapGraph();
if (CAMPAIGN_MAP_GRAPH_ERRORS.length)
  throw new Error(`Invalid campaign map graph: ${CAMPAIGN_MAP_GRAPH_ERRORS.join("; ")}`);

export function campaignLevelById(id: string): CampaignLevelDefinition | null {
  return LEVEL_BY_ID.get(id) ?? null;
}

export function campaignLevelByKey(key: string): CampaignLevelDefinition | null {
  return LEVEL_BY_KEY.get(key) ?? null;
}

/** Ordinary courses keep crystal awards independently of bonus detours. */
export function levelAllowsCrystal(id: string): boolean {
  const definition = campaignLevelById(id) ?? campaignLevelByKey(id);
  return (!definition?.boss || definition?.skateRace === true) && !definition?.competition;
}

/** A course can explicitly omit a bonus without becoming a boss encounter. */
export function levelAllowsBonus(id: string): boolean {
  const definition = campaignLevelById(id) ?? campaignLevelByKey(id);
  return levelAllowsCrystal(id) && definition?.bonus !== false;
}

export function isCampaignLevel(id: string): boolean {
  return LEVEL_BY_ID.has(id);
}

export interface CampaignLevelProgress {
  cleared: boolean;
  crystal: boolean;
  boxGem: boolean;
  comboGem: boolean;
  colouredGem?: boolean;
  timeRelic: boolean;
  /** Venue trophy; only an overall competition win awards it. */
  cup?: boolean;
  /** Race crystal provenance, independent of retained pre-race adventure awards. */
  raceWon?: boolean;
  /** Highest earned tier. Missing on old saves: timeRelic=true means gold. */
  timeMedal?: TimeMedal;
  bestTime?: number;
  /** Three fastest completed trials; old saves seed this from bestTime. */
  trialTimes?: number[];
}

export interface CampaignSaveV1 {
  v: 1;
  slot: number;
  createdAt: number;
  updatedAt: number;
  lives: number;
  fruit: number;
  /** Last settled world-map hub. Optional so every existing V1 save migrates. */
  mapFocus?: string;
  /** Most recently finished campaign level/run, independent of map browsing. */
  lastFinishedLevel?: string;
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
  maxCrystals: number;
  maxRelics: number;
  cups: number;
  maxCups: number;
}

export interface GameAudioOptions {
  sfxMuted: boolean;
  musicMuted: boolean;
}

export type GamePlayMode = 'modern' | 'classic';

/** Share the existing debug rule preference; old choices remain valid. */
export function loadGamePlayMode(): GamePlayMode {
  try {
    return localStorage.getItem('solProtoEndlessDeaths') === 'on' ? 'modern' : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveGamePlayMode(mode: GamePlayMode): void {
  try {
    localStorage.setItem('solProtoEndlessDeaths', mode === 'modern' ? 'on' : 'off');
  } catch {
    // Like audio options, unavailable storage leaves a session-local choice.
  }
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
    CAMPAIGN_MAP_HUBS.map((level) => [level.progressKey, emptyLevelProgress()]),
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
    mapFocus: CAMPAIGN_START_LEVEL_KEY,
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
        { ...progress, ...(progress.trialTimes ? { trialTimes: [...progress.trialTimes] } : {}) },
      ]),
    ),
  };
}

/** Old saves have no completion chronology. Use completed map progression
 * as a stable fallback; browsing hubs must not change the image. */
export function campaignSavePreviewLevel(save: Readonly<CampaignSaveV1>) {
  const finished = save.lastFinishedLevel && campaignLevelByKey(save.lastFinishedLevel);
  if (finished) return finished;
  const completed = (key: string) => save.levels[key]?.cleared || (save.levels[key]?.bestTime ?? 0) > 0;
  const progression = CAMPAIGN_ISLANDS.flatMap(island => island.levelKeys);
  const key = progression.reverse().find(completed);
  return (key && campaignLevelByKey(key)) || campaignLevelByKey(CAMPAIGN_START_LEVEL_KEY)!;
}

function cloneSlots(
  slots: readonly (CampaignSaveV1 | null)[],
): Array<CampaignSaveV1 | null> {
  return slots.map((save) => (save ? cloneSave(save) : null));
}

function normalizeLevelProgress(value: unknown, levelId: string): CampaignLevelProgress {
  const raw = value && typeof value === "object"
    ? value as Partial<CampaignLevelProgress>
    : {};
  const trialTimes = normalizeTrialTimes(raw.trialTimes, raw.bestTime);
  const timeMedal = earnedTimeMedal(raw);
  return {
    cleared: raw.cleared === true,
    crystal: levelAllowsCrystal(levelId) && raw.crystal === true,
    boxGem: raw.boxGem === true,
    comboGem: raw.comboGem === true,
    ...(raw.colouredGem === true ? {colouredGem:true} : {}),
    timeRelic: timeMedal !== null,
    ...(raw.cup === true ? { cup: true } : {}),
    ...(raw.raceWon === true ? { raceWon: true } : {}),
    ...(timeMedal ? { timeMedal } : {}),
    bestTime: trialTimes[0],
    ...(trialTimes.length ? { trialTimes } : {}),
  };
}

function normalizeTrialTimes(value: unknown, bestTime?: number): number[] {
  const times = (Array.isArray(value) ? value : []).filter((time): time is number => typeof time === "number" && Number.isFinite(time) && time > 0);
  if (typeof bestTime === "number" && Number.isFinite(bestTime) && bestTime > 0 && !times.includes(bestTime)) times.push(bestTime);
  return times.sort((a, b) => a - b).slice(0, 3);
}

function normalizeSave(value: unknown, slot: number): CampaignSaveV1 | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<CampaignSaveV1>;
  if (raw.v !== 1) return null;
  const levels = emptyLevels();
  const incoming = raw.levels && typeof raw.levels === "object" ? raw.levels : {};
  for (const level of CAMPAIGN_MAP_HUBS)
    levels[level.progressKey] = normalizeLevelProgress(incoming[level.progressKey],level.levelId);
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
    mapFocus: raw.mapFocus === 'island-hopper' ? 'beachside-run' :
      raw.mapFocus === "slipstream-2" || raw.mapFocus === "chimeworks" ? "slipstream" :
      typeof raw.mapFocus === "string" && campaignLevelByKey(raw.mapFocus)
        ? raw.mapFocus
        : undefined,
    lastFinishedLevel:
      raw.lastFinishedLevel === 'island-hopper' ? 'beachside-run' :
      typeof raw.lastFinishedLevel === 'string' && campaignLevelByKey(raw.lastFinishedLevel)
        ? raw.lastFinishedLevel : undefined,
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
  private ephemeralUnlockAll = false;
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
  startEphemeral(options: { unlockAll?: boolean } = {}): CampaignSaveV1 {
    const save = createSave(0);
    this.ephemeralUnlockAll = options.unlockAll === true;
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
    const definition = campaignLevelById(levelId);
    return !!definition && !definition.placeholder && campaignHasTimeTrial(definition)
      && (definition.skateRace === true || progress?.cleared === true);
  }

  private get inspectionUnlocks(): boolean {
    return this.activeValue?.slot === 0 && this.ephemeralUnlockAll;
  }

  /** True when the active save has satisfied this hub's graph prerequisites. */
  levelUnlocked(levelIdOrKey: string): boolean {
    const definition =
      campaignLevelById(levelIdOrKey) ?? campaignLevelByKey(levelIdOrKey);
    if (!definition || !this.activeValue) return false;
    if (this.inspectionUnlocks) return true;
    if (definition.islandId === 'hidden-shores') return secretIslandUnlocked(this.activeValue);
    // Previously completed courses stay playable when a new opening level is
    // inserted ahead of them; old saves keep every earned reward and record.
    if (this.activeValue.levels[definition.progressKey]?.cleared) return true;
    if (definition.unlockAfter.length === 0) return true;
    const cleared = definition.unlockAfter.map(key => {
      const prerequisite = campaignLevelByKey(key), progress = this.activeValue?.levels[key];
      if (prerequisite?.boss && prerequisite.competition) return progress?.cup === true;
      if (prerequisite?.boss && prerequisite.skateRace) return progress?.raceWon === true;
      return progress?.cleared === true;
    });
    return definition.unlockMode === "any"
      ? cleared.some(Boolean)
      : cleared.every(Boolean);
  }

  /** Menu discovery also requires each secret destination's own condition. */
  levelRevealed(levelIdOrKey: string): boolean {
    const definition = campaignLevelById(levelIdOrKey) ?? campaignLevelByKey(levelIdOrKey);
    return !!definition && this.levelUnlocked(levelIdOrKey)
      && (this.inspectionUnlocks || !definition.secretRequirement || secretRequirementMet(definition.progressKey, this.activeValue));
  }

  /** Availability is separate from map travel: placeholders are safe stops. */
  levelPlayable(levelIdOrKey: string): boolean {
    const definition = campaignLevelById(levelIdOrKey) ?? campaignLevelByKey(levelIdOrKey);
    return !!definition && !definition.placeholder && this.levelRevealed(levelIdOrKey);
  }

  levelStatus(levelIdOrKey: string): string {
    const definition = campaignLevelById(levelIdOrKey) ?? campaignLevelByKey(levelIdOrKey);
    if (!definition) return 'Unavailable';
    if (this.inspectionUnlocks) return definition.placeholder ? 'Unlocked · Coming soon' : 'Ready to play';
    if (definition.secretRequirement) {
      const requirement = SECRET_REQUIREMENT_LABELS[definition.secretRequirement];
      if (!secretIslandUnlocked(this.activeValue)) return `All bosses + ${requirement}`;
      if (!secretRequirementMet(definition.progressKey,this.activeValue)) return `Locked · ${requirement}`;
      return definition.placeholder ? 'Unlocked · Coming soon' : 'Ready to play';
    }
    if (definition.placeholder) return 'Coming soon';
    if (this.levelPlayable(levelIdOrKey)) return 'Ready to play';
    return `Locked · Complete ${definition.unlockAfter.map(key => campaignLevelByKey(key)?.name ?? key).join(' + ')}`;
  }

  /**
   * New Game starts at the first hub. Continue starts at the furthest cleared
   * hub, or the furthest currently unlocked hub when the frontier is new.
   */
  recommendedMapLevelKey(): string {
    const remembered = this.activeValue?.mapFocus;
    if (remembered && this.levelUnlocked(remembered)) return remembered;
    let candidate = CAMPAIGN_START_LEVEL_KEY;
    for (const key of CAMPAIGN_ISLANDS.flatMap(island => island.levelKeys)) {
      const definition = campaignLevelByKey(key)!;
      if (!this.levelPlayable(definition.progressKey)) continue;
      candidate = definition.progressKey;
      if (!this.activeValue?.levels[definition.progressKey]?.cleared) break;
    }
    return candidate;
  }

  setMapFocus(progressKey: string): void {
    const save = this.activeValue;
    if (
      !save ||
      !campaignLevelByKey(progressKey) ||
      !this.levelUnlocked(progressKey) ||
      save.mapFocus === progressKey
    )
      return;
    save.mapFocus = progressKey;
    this.noteWorkingChange();
  }

  /** Crossing the race line completes the course; only first place awards its crystal. */
  commitRaceResult(levelId:string,rewards:{won:boolean;boxGem:boolean}):CampaignLevelProgress|null {
    const progress=this.levelProgress(levelId);
    if(!progress||!campaignLevelById(levelId)?.skateRace||campaignLevelById(levelId)?.placeholder)return null;
    const before=JSON.stringify(progress),finishedChanged=this.updateLastFinishedLevel(levelId);
    progress.cleared=true;
    if(rewards.won){progress.crystal=true;progress.raceWon=true;}
    progress.boxGem ||= rewards.boxGem;
    if(JSON.stringify(progress)!==before||finishedChanged)this.noteWorkingChange();
    return progress;
  }

  commitClear(
    levelId: string,
    rewards: {
      crystal: boolean;
      boxGem: boolean;
      comboGem: boolean;
    },
  ): CampaignLevelProgress | null {
    const progress = this.levelProgress(levelId);
    if (!progress || campaignLevelById(levelId)?.placeholder) return null;
    if (campaignLevelById(levelId)?.competition || campaignLevelById(levelId)?.skateRace) return progress;
    const finishedChanged = this.updateLastFinishedLevel(levelId);
    const before = { ...progress };
    progress.cleared = true;
    progress.crystal = levelAllowsCrystal(levelId) && (progress.crystal || rewards.crystal);
    progress.boxGem = progress.boxGem || rewards.boxGem;
    progress.comboGem = progress.comboGem || rewards.comboGem;
    if (
      progress.cleared !== before.cleared ||
      progress.crystal !== before.crystal ||
      progress.boxGem !== before.boxGem ||
      progress.comboGem !== before.comboGem || finishedChanged
    )
      this.noteWorkingChange();
    return progress;
  }

  /**
   * Record only a completed time-trial attempt. Trial play never manufactures
   * the normal clear or collectible milestones that gate access to the mode.
   */
  commitTimeTrial(
    levelId: string,
    rewards: { time: number; medal?: TimeMedal | null; timeRelic?: boolean },
  ): CampaignLevelProgress | null {
    const progress = this.levelProgress(levelId);
    const definition = campaignLevelById(levelId);
    if (!progress || !definition || definition.placeholder || !campaignHasTimeTrial(definition)) return null;
    const beforeBestTime = progress.bestTime;
    const beforeTimeRelic = progress.timeRelic;
    const beforeMedal = progress.timeMedal;
    const beforeTimes = JSON.stringify(progress.trialTimes);
    let finishedChanged = false;
    if (Number.isFinite(rewards.time) && rewards.time > 0) {
      finishedChanged = this.updateLastFinishedLevel(levelId);
      const award = rewards.medal === undefined ? (rewards.timeRelic === true ? 'gold' : null)
        : validTimeMedal(rewards.medal) ? rewards.medal : null;
      const medal = higherTimeMedal(earnedTimeMedal(progress), award);
      if (medal) progress.timeMedal = medal;
      progress.timeRelic = medal !== null;
      progress.trialTimes = normalizeTrialTimes([
        ...normalizeTrialTimes(progress.trialTimes, progress.bestTime), rewards.time,
      ]);
      progress.bestTime = progress.trialTimes[0];
    }
    if (
      progress.bestTime !== beforeBestTime ||
      JSON.stringify(progress.trialTimes) !== beforeTimes ||
      progress.timeRelic !== beforeTimeRelic || progress.timeMedal !== beforeMedal || finishedChanged
    )
      this.noteWorkingChange();
    return progress;
  }

  commitCompetitionWin(levelId: string): boolean {
    if (!campaignLevelById(levelId)?.competition) return false;
    const progress = this.levelProgress(levelId);
    if (!progress) return false;
    const first = progress.cup !== true;
    const finishedChanged = this.updateLastFinishedLevel(levelId);
    const changed = first || !progress.cleared || finishedChanged;
    progress.cup = true;
    progress.cleared = true;
    if (changed) this.noteWorkingChange();
    return first;
  }

  /** Completing a competition without winning still identifies the last
   * finished level, without awarding a cup or marking it cleared. */
  recordLevelFinished(levelId: string): void {
    if (this.updateLastFinishedLevel(levelId)) this.noteWorkingChange();
  }

  private updateLastFinishedLevel(levelId: string): boolean {
    const definition = campaignLevelById(levelId), save = this.activeValue;
    if (!save || !definition || definition.placeholder || save.lastFinishedLevel === definition.progressKey) return false;
    save.lastFinishedLevel = definition.progressKey;
    return true;
  }

  totals(save: CampaignSaveV1 | null = this.activeValue): CampaignTotals {
    let cleared = 0;
    let crystals = 0;
    let gems = 0;
    let relics = 0;
    let earned = 0, cups = 0;
    const available = CAMPAIGN_LEVELS.filter(level => !level.placeholder);
    const maxCups = available.filter(level => level.competition).length;
    const ordinaryLevels = available.filter(campaignHasCourseRewards).length;
    const trialLevels = available.filter(campaignHasTimeTrial).length;
    const crystalLevels = available.filter(level => levelAllowsCrystal(level.levelId)).length;
    // Secret combo gems retain their save plumbing but are optional awards,
    // outside the standard completion ledger.
    const maxMilestones = available.length + ordinaryLevels + trialLevels + crystalLevels + maxCups;
    if (save) {
      for (const level of available) {
        const progress = save.levels[level.progressKey] ?? emptyLevelProgress();
        if (progress.cleared) { cleared++; earned++; }
        if (level.competition) {
          if (progress.cup) { cups++; earned++; }
          continue;
        }
        if (!campaignHasCourseRewards(level)) continue;
        if (levelAllowsCrystal(level.levelId) && progress.crystal) { crystals++; earned++; }
        if (progress.boxGem) { gems++; earned++; }
        if (campaignHasTimeTrial(level) && earnedTimeMedal(progress)) { relics++; earned++; }
      }
    }
    return {
      percent: Math.round((earned / maxMilestones) * 100),
      cleared,
      crystals,
      gems,
      relics,
      maxLevels: available.length,
      maxGems: ordinaryLevels,
      maxCrystals: crystalLevels, maxRelics: trialLevels, cups, maxCups,
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
