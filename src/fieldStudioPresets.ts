// Versioned, context-local Field Studio drafts. This is authoring state only:
// production uses the reviewed source recipes in gameFlowVortexProfiles.ts.
import { LOCAL_RESET_MARKER } from './localGameStorage';

import {
  FIELD_SWIRL_PRESETS,
  type FieldSwirlPreset,
} from "./swirlfield";
import {
  GAME_FLOW_VORTEX_CONTEXTS,
  GAME_FLOW_VORTEX_CONTEXT_INFO,
  cloneGameFlowVortexProfile,
  type GameFlowVortexContext,
} from "./gameFlowVortexProfiles";

export const FIELD_STUDIO_STORAGE_KEY = "solProtoFieldStudioV2";
const LEGACY_FIELD_STUDIO_STORAGE_KEY = "fieldStudioV1";
export const FIELD_STUDIO_CONTEXTS = [
  "scratch",
  ...GAME_FLOW_VORTEX_CONTEXTS,
] as const;

export type FieldStudioContext = (typeof FIELD_STUDIO_CONTEXTS)[number];

export interface FieldStudioDraft {
  name: string;
  sourcePreset: string;
  seed: number;
  preset: FieldSwirlPreset;
}

export interface FieldStudioState {
  version: 2;
  selectedContext: FieldStudioContext;
  drafts: Record<FieldStudioContext, FieldStudioDraft>;
}

export const FIELD_STUDIO_CONTEXT_INFO: Readonly<
  Record<FieldStudioContext, { label: string; description: string }>
> = Object.freeze({
  scratch: Object.freeze({
    label: "SCRATCH / WORLD",
    description: "A general-purpose field draft, independent of game-flow screens.",
  }),
  ...GAME_FLOW_VORTEX_CONTEXT_INFO,
});

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function clonePreset(preset: Readonly<FieldSwirlPreset>): FieldSwirlPreset {
  return { ...preset };
}

function defaultDraft(context: FieldStudioContext): FieldStudioDraft {
  if (context === "scratch") {
    return {
      name: "myField",
      sourcePreset: "vortex",
      seed: 1,
      preset: clonePreset(FIELD_SWIRL_PRESETS.vortex),
    };
  }
  const profile = cloneGameFlowVortexProfile(context);
  return {
    name: context,
    sourcePreset: "authored",
    seed: profile.seed,
    preset: profile.preset,
  };
}

export function createDefaultFieldStudioState(): FieldStudioState {
  return {
    version: 2,
    selectedContext: "menu",
    drafts: Object.fromEntries(
      FIELD_STUDIO_CONTEXTS.map((context) => [context, defaultDraft(context)]),
    ) as Record<FieldStudioContext, FieldStudioDraft>,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanPreset(
  value: unknown,
  fallback: Readonly<FieldSwirlPreset>,
): FieldSwirlPreset {
  if (!isRecord(value)) return clonePreset(fallback);
  const clean: Record<string, number | boolean | "alpha" | "add"> = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "number" && Number.isFinite(candidate))
      clean[key] = candidate;
    else if (typeof candidate === "boolean") clean[key] = candidate;
    else if (
      (key === "blend" || key === "blendBright") &&
      (candidate === "alpha" || candidate === "add")
    )
      clean[key] = candidate;
  }
  if (
    typeof clean.radius !== "number" ||
    typeof clean.rings !== "number" ||
    typeof clean.segs !== "number"
  )
    return clonePreset(fallback);
  return clean as FieldSwirlPreset;
}

function cleanName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/[^\w-]/g, "").slice(0, 48) || fallback;
}

function cleanSeed(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(0x7fffffff, Math.floor(value)))
    : fallback;
}

function validContext(value: unknown): value is FieldStudioContext {
  return FIELD_STUDIO_CONTEXTS.includes(value as FieldStudioContext);
}

function validSource(context: FieldStudioContext, value: unknown): string {
  if (value === "authored" && context !== "scratch") return "authored";
  return typeof value === "string" && FIELD_SWIRL_PRESETS[value]
    ? value
    : context === "scratch"
      ? "vortex"
      : "authored";
}

function readJson(storage: StorageLike | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadFieldStudioState(
  storage: StorageLike | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
): FieldStudioState {
  const state = createDefaultFieldStudioState();
  const saved = readJson(storage, FIELD_STUDIO_STORAGE_KEY);
  if (isRecord(saved) && saved.version === 2 && isRecord(saved.drafts)) {
    if (validContext(saved.selectedContext))
      state.selectedContext = saved.selectedContext;
    for (const context of FIELD_STUDIO_CONTEXTS) {
      const fallback = state.drafts[context];
      const candidate = saved.drafts[context];
      if (!isRecord(candidate)) continue;
      state.drafts[context] = {
        name: cleanName(candidate.name, fallback.name),
        sourcePreset: validSource(context, candidate.sourcePreset),
        seed: cleanSeed(candidate.seed, fallback.seed),
        preset: cleanPreset(candidate.preset, fallback.preset),
      };
    }
    return state;
  }

  // Preserve the old one-draft lab in Scratch without silently promoting it
  // into a production screen context.
  const legacy = storage?.getItem(LOCAL_RESET_MARKER) === '1'
    ? null : readJson(storage, LEGACY_FIELD_STUDIO_STORAGE_KEY);
  if (isRecord(legacy)) {
    const fallback = state.drafts.scratch;
    state.drafts.scratch = {
      ...fallback,
      name: cleanName(legacy.name, fallback.name),
      preset: cleanPreset(legacy.preset, fallback.preset),
    };
  }
  return state;
}

export function saveFieldStudioState(
  state: FieldStudioState,
  storage: StorageLike | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(FIELD_STUDIO_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function presetForFieldStudioSource(
  context: FieldStudioContext,
  sourcePreset: string,
): { seed: number; preset: FieldSwirlPreset } {
  if (sourcePreset === "authored" && context !== "scratch")
    return cloneGameFlowVortexProfile(context as GameFlowVortexContext);
  return {
    seed: context === "scratch" ? 1 : 37,
    preset: clonePreset(
      FIELD_SWIRL_PRESETS[sourcePreset] ?? FIELD_SWIRL_PRESETS.vortex,
    ),
  };
}

export function resetFieldStudioContext(
  state: FieldStudioState,
  context: FieldStudioContext,
): void {
  const draft = state.drafts[context];
  const source = presetForFieldStudioSource(context, draft.sourcePreset);
  draft.seed = source.seed;
  draft.preset = source.preset;
}

export function gameFlowProfilesFromStudio(
  state: FieldStudioState,
): Record<GameFlowVortexContext, { seed: number; preset: FieldSwirlPreset }> {
  return Object.fromEntries(
    GAME_FLOW_VORTEX_CONTEXTS.map((context) => {
      const draft = state.drafts[context];
      return [context, { seed: draft.seed, preset: clonePreset(draft.preset) }];
    }),
  ) as Record<GameFlowVortexContext, { seed: number; preset: FieldSwirlPreset }>;
}
