import * as THREE from "three";
import type { CustomLevelData, SkyPreset, Theme } from "./level";

/** Hex colors are convenient to author; linear RGB tuples retain the exact
 * preset-blended native light values across JSON capture. */
export type AtmosphereColor = string | [number, number, number];
export interface CustomAtmosphereData {
  fogEnabled?: boolean;
  fogNear?: number;
  fogFar?: number;
  fogColor?: AtmosphereColor;
  ambientSky?: AtmosphereColor;
  ambientGround?: AtmosphereColor;
  ambientIntensity?: number;
  sunColor?: AtmosphereColor;
  sunIntensity?: number;
  fillColor?: AtmosphereColor;
  fillIntensity?: number;
  shadowStrength?: number;
  drawDistance?: number;
  backdrop?: "sky" | "fog";
  fallbackTop?: AtmosphereColor;
  fallbackBottom?: AtmosphereColor;
  fallbackFog?: AtmosphereColor;
  fallbackStars?: boolean;
  fallbackSunColor?: AtmosphereColor | null;
  fallbackSunU?: number;
  fallbackSunV?: number;
}
export type ResolvedAtmosphere = Required<CustomAtmosphereData>;

export const ATMOSPHERE_NUMBERS = {
  fogNear: { label: "fog start", min: 0, max: 4999.99, step: 1 },
  fogFar: { label: "fog end", min: 0.01, max: 5000, step: 1 },
  ambientIntensity: { label: "ambient intensity", min: 0, max: 8, step: 0.05 },
  sunIntensity: { label: "sun intensity", min: 0, max: 8, step: 0.05 },
  fillIntensity: { label: "fill intensity", min: 0, max: 8, step: 0.05 },
  shadowStrength: { label: "shadow strength", min: 0, max: 1, step: 0.05 },
  drawDistance: { label: "draw distance", min: 25, max: 2000, step: 10 },
  fallbackSunU: { label: "fallback sun horizontal", min: 0, max: 1, step: 0.01 },
  fallbackSunV: { label: "fallback sun vertical", min: 0, max: 1, step: 0.01 },
} as const;
export const ATMOSPHERE_COLORS = {
  fogColor: "fog color", ambientSky: "ambient sky", ambientGround: "ambient ground",
  sunColor: "sun color", fillColor: "fill color", fallbackTop: "fallback sky top",
  fallbackBottom: "fallback sky bottom", fallbackFog: "fallback horizon color", fallbackSunColor: "fallback sun color",
} as const;
const ATMOSPHERE_KEYS = new Set([...Object.keys(ATMOSPHERE_NUMBERS), ...Object.keys(ATMOSPHERE_COLORS),
  "fogEnabled", "fallbackStars", "backdrop"]);
const validColor = (value: unknown): boolean =>
  typeof value === "string" ? /^#[0-9a-fA-F]{6}$/.test(value) : Array.isArray(value) && value.length === 3 &&
    value.every(component => typeof component === "number" && Number.isFinite(component) && component >= 0 && component <= 1);
export function validAtmosphere(value: unknown): value is CustomAtmosphereData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !ATMOSPHERE_KEYS.has(key))) return false;
  for (const [key, limits] of Object.entries(ATMOSPHERE_NUMBERS)) {
    const field = data[key];
    if (field !== undefined && (typeof field !== "number" || !Number.isFinite(field) || field < limits.min || field > limits.max)) return false;
  }
  for (const key of Object.keys(ATMOSPHERE_COLORS))
    if (data[key] !== undefined && !(key === "fallbackSunColor" && data[key] === null) && !validColor(data[key])) return false;
  for (const key of ["fogEnabled", "fallbackStars"])
    if (data[key] !== undefined && typeof data[key] !== "boolean") return false;
  if (data.backdrop !== undefined && data.backdrop !== "sky" && data.backdrop !== "fog") return false;
  return data.fogNear === undefined || data.fogFar === undefined || (data.fogNear as number) < (data.fogFar as number);
}
export function atmosphereColor(value: AtmosphereColor): THREE.Color {
  return Array.isArray(value) ? new THREE.Color().setRGB(...value) : new THREE.Color(value);
}
export function atmosphereColorHex(value: AtmosphereColor): string { return `#${atmosphereColor(value).getHexString()}`; }

export const SKY_BRIDGE_FOG_NEAR = 5;
export const SKY_BRIDGE_FOG_FAR = 24;

export const CUSTOM_LEVEL_THEME: Theme = {
  skyTop: "#159ecd", skyBottom: "#c9f0e4", sunColorHex: "#fff8dc", sunU: 0.68, sunV: 0.14,
  stars: false, fog: 0xbee8dd, fogNear: 90, fogFar: 380,
  hemiSky: 0xeafcff, hemiGround: 0x94a294, hemiI: 1.2, sunColor: 0xfff6dc, sunI: 1.55,
};
export const JUNGLE_THEME_OVERRIDES = { fog: 0x537d70, fogNear: 38, fogFar: 150,
  hemiSky: 0xaed8c2, hemiGround: 0x634a2e, hemiI: 1.04, sunColor: 0xffdea0, sunI: 1.65 };

export interface SkyPresetDef {
  file: string; // painted backdrop in public/
  label: string; // what the editor dropdown shows
  fog: number; // the colour the world fades into
  fogFarCap: number; // clamp on the level's own fogFar — how far you can see
  sunTint: number;
  sunK: number; // key light pulled this far toward sunTint
  sunMul: number; // ...then scaled
  groundTint: number;
  groundK: number; // hemisphere bounce off the ground
  hemiTint: number;
  hemiK: number; // hemisphere sky colour
  hemiMul: number;
  fillTint: number;
  fillK: number; // the cool counter-light opposite the key
  fillMul: number; // as a fraction of the hemisphere intensity
  top: string;
  bottom: string; // procedural fallback gradient
  stars: boolean; // fallback only: scatter a starfield
  // fallback only: the disc in the sky. A hex overrides the level's own sun,
  // undefined keeps it, null paints NONE — the disc drags a 185px halo behind
  // it, which is exactly what a night sky must not have.
  sunHex: string | null | undefined;
  // Paintings that DON'T share the classic 887px/600px geometry declare their
  // own; absent = the shared constants.
  imgH?: number;
  horizonPx?: number;
  // COAST TREATMENT: pin the painted horizon to the WORLD's sea level (y=0)
  // instead of the camera's eye level. The dome still follows the camera —
  // the horizon row is depressed by the angle down to the water at the dome
  // wall, so from 400m up you look DOWN at the sea line; at beach height the
  // drop vanishes and it behaves like every other sky.
  seaHorizon?: boolean;
  // Play-mode draw distance override (default 400). The coast pushes it way
  // out so the bay's water is actually DRAWN when you look down from the
  // road 430m up — with fog stripped off the level itself (level.ts), only
  // the sea fades, so the long view stays crisp.
  farPlane?: number;
}
export const SKY_PRESETS: Record<SkyPreset, SkyPresetDef> = {
  // Bright and open: neutral key, cool skylight, air you can see a long way
  // through. The haze is the pale blue-white of the cloud sea at noon.
  day: {
    file: "sky-day.png",
    label: "day",
    fog: 0xdfe9f2,
    fogFarCap: 340,
    sunTint: 0xfff4e0,
    sunK: 0.25,
    sunMul: 1.15,
    groundTint: 0xb9c2c8,
    groundK: 0.25,
    hemiTint: 0xdcebff,
    hemiK: 0.45,
    hemiMul: 1.15,
    fillTint: 0xcfe2ff,
    fillK: 0.5,
    fillMul: 0.26,
    top: "#3f8fd8",
    bottom: "#e9f0f4",
    stars: false,
    sunHex: "#fffdf2", // high white noon sun
  },
  // EXACTLY the look the game shipped with — these numbers are the constants
  // that used to sit inline in applyTheme, moved not changed. Switching to
  // sunset must be pixel-identical to the old build.
  sunset: {
    file: "skybox.png",
    label: "sunset",
    fog: 0xd08a7e,
    fogFarCap: 260,
    sunTint: 0xffc46a,
    sunK: 0.15,
    sunMul: 1.1,
    groundTint: 0xc79a62,
    groundK: 0.3,
    hemiTint: 0xffffff,
    hemiK: 0, // sunset left the sky colour to the level's own theme
    hemiMul: 1,
    fillTint: 0xffffff,
    fillK: 0,
    fillMul: 0.22,
    top: "#0fa3c2",
    bottom: "#ffe6ae",
    stars: false,
    sunHex: undefined, // sunset keeps the level theme's own sun, as it always did
  },
  // Moonlight. The trap here is making it pretty and unplayable: this is a
  // platformer, so a deck edge and a crate face still have to read. Measured
  // against the sunset build, a lit deck lands near half its brightness — dark
  // enough to be unmistakably night, bright enough to platform on. Most of the
  // work is done by COLOUR (deep navy haze, hard blue tints on every light)
  // rather than by darkness, which is what keeps it readable. The key stays
  // brighter than a pure-ambient scene would allow so cast shadows survive:
  // without them the world goes flat and edges stop reading at all.
  night: {
    file: "sky-night.png",
    label: "night",
    fog: 0x1b2540,
    fogFarCap: 200,
    sunTint: 0x9dbcff,
    sunK: 0.85,
    sunMul: 0.26,
    groundTint: 0x1b2540,
    groundK: 0.8,
    hemiTint: 0x40598c,
    hemiK: 0.85,
    hemiMul: 0.5,
    fillTint: 0x5f7fc4,
    fillK: 0.8,
    fillMul: 0.34,
    top: "#080f28",
    bottom: "#22345c",
    stars: true,
    sunHex: null, // no disc: its halo washes the whole sky out, and the
    // painted night reference has no moon in it either
  },
  // The Descent's own painting: a daytime tropical bay (islands, cumulus,
  // turquoise sea) with its horizon on row 626 — and the seaHorizon
  // treatment, so that painted horizon sits at the WATER, not at eye level.
  coast: {
    file: "sky-coast.png",
    label: "coast",
    fog: 0x94c9e0,
    fogFarCap: 780,
    sunTint: 0xffe8bd,
    sunK: 1,
    sunMul: 1,
    groundTint: 0x3d4d57,
    groundK: 1,
    hemiTint: 0x7ab0d1,
    hemiK: 1,
    hemiMul: 1,
    fillTint: 0x7a9694, // Unity's equator ambient term
    fillK: 1,
    fillMul: 0.32,
    top: "#3f8fd8",
    bottom: "#e9f0f4",
    stars: false,
    sunHex: "#fffdf2",
    imgH: 941,
    horizonPx: 630,
    seaHorizon: true,
    farPlane: 900,
  },
};

interface AtmosphereSource {
  theme: Theme;
  skyPreset: SkyPreset;
  jungleAtmosphere: boolean;
  isCampaignMap: boolean;
  skyBackdrop?: "sky" | "fog";
  atmosphere?: CustomAtmosphereData;
}
/** Resolve defaults first, then final authored overrides. The result is shared
 * by rendering, native capture and editor controls, including fallback skies. */
export function resolveLevelAtmosphere(source: AtmosphereSource): ResolvedAtmosphere {
  const t = source.theme, preset = SKY_PRESETS[source.skyPreset] ?? SKY_PRESETS.sunset;
  const blend = (base: number, tint: number, amount: number): [number, number, number] =>
    new THREE.Color(base).lerp(new THREE.Color(tint), amount).toArray() as [number, number, number];
  const linear = (hex: number): [number, number, number] => new THREE.Color(hex).toArray() as [number, number, number];
  const ambientIntensity = t.hemiI * preset.hemiMul;
  const defaults: ResolvedAtmosphere = {
    fogEnabled: true, fogNear: t.fogNear, fogFar: Math.min(t.fogFar, preset.fogFarCap),
    fogColor: linear(source.jungleAtmosphere ? t.fog : preset.fog),
    ambientSky: blend(t.hemiSky, preset.hemiTint, preset.hemiK),
    ambientGround: blend(t.hemiGround, preset.groundTint, preset.groundK), ambientIntensity,
    sunColor: blend(t.sunColor, preset.sunTint, preset.sunK), sunIntensity: t.sunI * preset.sunMul,
    fillColor: blend(t.hemiSky, preset.fillTint, preset.fillK), fillIntensity: ambientIntensity * preset.fillMul,
    shadowStrength: source.skyPreset === "coast" ? 0.62 : 1,
    drawDistance: source.jungleAtmosphere ? 175 : preset.farPlane ?? 400,
    backdrop: source.skyBackdrop ?? "sky", fallbackTop: preset.top, fallbackBottom: preset.bottom, fallbackFog: linear(preset.fog),
    fallbackStars: preset.stars, fallbackSunColor: preset.sunHex === null ? null : (preset.sunHex ?? t.sunColorHex) || null,
    fallbackSunU: t.sunU, fallbackSunV: t.sunV,
  };
  if (source.isCampaignMap) Object.assign(defaults, {
    ambientSky: linear(0xd9f0ff), ambientGround: linear(0xaebc87), ambientIntensity: 1.8,
    sunColor: linear(0xffecd0), sunIntensity: 1.85, shadowStrength: 0.36,
    fillColor: linear(0xc0eaff), fillIntensity: 0.8,
  });
  const result = { ...defaults };
  for (const [key, value] of Object.entries(source.atmosphere ?? {}))
    if (value !== undefined) (result as unknown as Record<string, unknown>)[key] = value;
  // Sparse range overrides still describe a valid fog interval. Only the
  // inherited counterpart may move; two authored endpoints validate strictly.
  if (result.fogNear >= result.fogFar) {
    if (source.atmosphere?.fogFar === undefined) result.fogFar = result.fogNear + 0.01;
    else result.fogNear = Math.max(0, result.fogFar - 0.01);
  }
  return result;
}
export function resolveDataAtmosphere(data: CustomLevelData, levelId?: string): ResolvedAtmosphere {
  return resolveLevelAtmosphere({ theme: { ...CUSTOM_LEVEL_THEME,
      ...(levelId === "sky" ? { fogNear: SKY_BRIDGE_FOG_NEAR, fogFar: SKY_BRIDGE_FOG_FAR } : {}),
      ...(data.jungleAtmosphere ? JUNGLE_THEME_OVERRIDES : {}) },
    skyBackdrop: levelId === "sky" ? "fog" : "sky",
    skyPreset: data.sky ?? "sunset", jungleAtmosphere: !!data.jungleAtmosphere,
    isCampaignMap: data.components.some(component => component.t === "worldmap"), atmosphere: data.atmosphere });
}


/** Explicit cross-ID copies/exports retain the authored behavior of old
 * data-backed Sky Bridge overrides without rewriting a read-only open. */
export function withPortableAtmosphere(data: CustomLevelData, sourceId?: string): CustomLevelData {
  if (sourceId !== "sky") return data;
  return { ...data, keepPlayFog: data.keepPlayFog ?? true, atmosphere: resolveDataAtmosphere(data, sourceId) };
}
