// Source-owned Gouraud recipes for the three places that use the full-screen
// field. They start visually identical so introducing context routing cannot
// change the shipped look; Field Studio keeps independent drafts for each key.

import {
  FIELD_SWIRL_PRESETS,
  type FieldSwirlPreset,
} from "./swirlfield";

export const GAME_FLOW_VORTEX_CONTEXTS = [
  "menu",
  "warp",
  "gameover",
] as const;

export type GameFlowVortexContext =
  (typeof GAME_FLOW_VORTEX_CONTEXTS)[number];

export interface GameFlowVortexProfile {
  seed: number;
  preset: Readonly<FieldSwirlPreset>;
}

export const GAME_FLOW_VORTEX_CONTEXT_INFO: Readonly<
  Record<
    GameFlowVortexContext,
    { label: string; description: string }
  >
> = Object.freeze({
  menu: Object.freeze({
    label: "MENU / TITLE",
    description: "Main title plus New Game, Load Game and overwrite screens.",
  }),
  warp: Object.freeze({
    label: "WARP / LOADING",
    description: "The animated field revealed inside fades between game spaces.",
  }),
  gameover: Object.freeze({
    label: "GAME OVER",
    description: "The field behind the skull and crossbones retry screen.",
  }),
});

function authoredPreset(): Readonly<FieldSwirlPreset> {
  return Object.freeze({ ...FIELD_SWIRL_PRESETS.vortex });
}

export const GAME_FLOW_VORTEX_PROFILES: Readonly<
  Record<GameFlowVortexContext, Readonly<GameFlowVortexProfile>>
> = Object.freeze({
  menu: Object.freeze({ seed: 37, preset: authoredPreset() }),
  warp: Object.freeze({ seed: 37, preset: authoredPreset() }),
  gameover: Object.freeze({ seed: 37, preset: authoredPreset() }),
});

/** Mutable copy for a renderer instance or authoring draft. */
export function cloneGameFlowVortexProfile(
  context: GameFlowVortexContext,
): { seed: number; preset: FieldSwirlPreset } {
  const profile = GAME_FLOW_VORTEX_PROFILES[context];
  return {
    seed: profile.seed,
    preset: { ...profile.preset },
  };
}
