// Source-owned Gouraud recipes for the three places that use the full-screen
// field. Field Studio keeps independent drafts for each key, which are
// promoted here once a context-specific look is approved.

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

function gameOverPreset(): Readonly<FieldSwirlPreset> {
  return Object.freeze({
    blend: "alpha",
    blendBright: "alpha",
    radius: 5.56,
    rings: 14,
    segs: 35,
    depth: 4,
    billboard: true,
    arms: 6,
    twist: 6,
    flow: 0.11,
    current: -0.002,
    sharp: 0.5,
    filament: 0.128,
    glowWidth: 1,
    wobble: 0,
    wobbleScale: 0,
    wobbleRate: 0,
    edgeCrinkle: 0,
    warpA: 0.045,
    warpAScale: 3,
    warpARate: 1.8,
    warpB: 0.05,
    warpBScale: 8,
    warpBRate: 3.2,
    warpC: 0.025,
    warpCScale: 2,
    warpCRate: 0.5,
    couple: 1,
    jag: 3,
    jagScale: 8,
    jagRate: 0.006,
    streak: 0.386,
    streakScale: 8,
    streakRate: 5.2,
    core: 0.02,
    coreGlow: 0.912,
    mottle: 0.472,
    mottleScale: 0.52,
    mottleRate: 4,
    colCore: 0,
    colFil: 10038784,
    colGlow: 16716032,
    colGround: 2359296,
    cycleRate: 0,
    hueCycle: 0,
    alpha: 1,
    body: 1,
    rim: 0.734,
    spin: 0.344,
    spinDiff: 0,
    pulse: 0.198,
    pulseRate: 6,
    colGround2: 16711867,
    colRim: 0,
  });
}

export const GAME_FLOW_VORTEX_PROFILES: Readonly<
  Record<GameFlowVortexContext, Readonly<GameFlowVortexProfile>>
> = Object.freeze({
  menu: Object.freeze({ seed: 37, preset: authoredPreset() }),
  warp: Object.freeze({ seed: 37, preset: authoredPreset() }),
  gameover: Object.freeze({ seed: 37, preset: gameOverPreset() }),
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
