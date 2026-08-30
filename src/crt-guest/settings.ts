// Presentation-only CRT Guest settings. This module intentionally has no
// dependency on the game runtime so the renderer, tuning panel, and tests can
// all consume the same source-pinned parameter contract.

export const CRT_GUEST_SOURCE_REPOSITORY =
  "https://github.com/libretro/slang-shaders";
export const CRT_GUEST_SOURCE_COMMIT =
  "a62d9cda9140294d22b6da5e4ff4187365890d42";
export const CRT_GUEST_SOURCE_CAPTURED = "2026-08-25";
export const CRT_GUEST_PRESET_VERSION = 1;
export const CRT_GUEST_DEFAULT_FILE_NAME = "CRTGuest.internal.json";
export const CRT_GUEST_STORAGE_KEY = "solProtoCrtGuestPreset.v1";

export const CRT_GUEST_VARIANTS = ["advanced", "hd"] as const;
export type CrtGuestVariant = (typeof CRT_GUEST_VARIANTS)[number];

export const CRT_GUEST_QUALITIES = [
  "exact",
  "balanced",
  "apple-tv",
] as const;
export type CrtGuestQuality = (typeof CRT_GUEST_QUALITIES)[number];

export const CRT_GUEST_QUALITY_DIMENSIONS = Object.freeze({
  exact: Object.freeze({ width: 800, height: 600 }),
  balanced: Object.freeze({ width: 600, height: 450 }),
  "apple-tv": Object.freeze({ width: 400, height: 300 }),
} satisfies Record<CrtGuestQuality, { width: number; height: number }>);

export interface CrtGuestParameterRange {
  readonly default: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface CrtGuestParameterDefinition {
  readonly index: number;
  readonly id: string;
  readonly label: string;
  readonly group: string;
  readonly variants: readonly CrtGuestVariant[];
  readonly supportsAdvanced: boolean;
  readonly supportsHd: boolean;
  readonly advanced: CrtGuestParameterRange | null;
  readonly hd: CrtGuestParameterRange | null;
}

export interface CrtGuestParameterGroup {
  readonly id: string;
  readonly parameters: readonly CrtGuestParameterDefinition[];
}

type RangeRow = readonly [
  defaultValue: number,
  minimum: number,
  maximum: number,
  step: number,
];
type CatalogRow = readonly [
  id: string,
  label: string,
  group: string,
  advanced: RangeRow | null,
  hd: RangeRow | null,
];

// Exact case-sensitive order and values from ParameterManifest.json at the
// pinned source commit. Unsupported variant slots are null, never inferred.
const PARAMETER_ROWS: readonly CatalogRow[] = [
  ["internal_res","Internal Resolution","resolution",null,[1,0.5,8,0.1]],
  ["auto_res","SNES/Amiga Hi-Res Auto Mode","resolution",null,[0,0,1,1]],
  ["esrc","Afterglow Effect Source: OriginalHistory | Source","afterglow",[1,1,2,1],[1,1,2,1]],
  ["bth","Afterglow Effect Threshold","afterglow",[4,1,125,1],[4,1,125,1]],
  ["PR","Persistence Red","afterglow",[0.32,0,0.5,0.01],[0.32,0,0.5,0.01]],
  ["PG","Persistence Green","afterglow",[0.32,0,0.5,0.01],[0.32,0,0.5,0.01]],
  ["PB","Persistence Blue","afterglow",[0.32,0,0.5,0.01],[0.32,0,0.5,0.01]],
  ["AS","Afterglow Strength","afterglow",[0.2,0,0.6,0.01],[0.2,0,0.6,0.01]],
  ["agsat","Afterglow saturation","afterglow",[0.5,0,1,0.01],[0.5,0,1,0.01]],
  ["CS","Display Gamut: sRGB, Modern, DCI, Adobe, Rec.2020, P3","color",[0,0,5,1],[0,0,5,1]],
  ["CP","CRT Profile: EBU | P22 | SMPTE-C | Philips | Trin.","color",[0,-1,5,1],[0,-1,5,1]],
  ["TNTC","LUT Colors: NTSC-J | Trinit. | Nec Mult. | NTSC 1953","color",[0,0,4,1],[0,0,4,1]],
  ["LS","LUT Size","color",[32,16,64,16],[32,16,64,16]],
  ["WP","Color Temperature %","color",[0,-100,100,5],[0,-100,100,5]],
  ["wp_saturation","Saturation Adjustment","color",[1,0,2,0.05],[1,0,2,0.05]],
  ["pre_bb","Brightness Adjustment","color",[1,0,2,0.01],[1,0,2,0.01]],
  ["contr","Contrast Adjustment","color",[0,-2,2,0.05],[0,-2,2,0.05]],
  ["pre_gc","Gamma Correct Adjustment","color",[1,0.5,1.75,0.025],[1,0.5,1.75,0.025]],
  ["sega_fix","Sega Brightness Fix","color",[0,0,1,1],[0,0,1,1]],
  ["BP","Raise Black Level","color",[0,-100,25,1],[0,-100,25,1]],
  ["vigstr","Vignette Strength","color",[0,0,2,0.05],[0,0,2,0.05]],
  ["vigdef","Vignette Size","color",[1,0.5,3,0.1],[1,0.5,3,0.1]],
  ["lsmooth","Raster Bloom Effect Smoothing","rasterBloom",[0.7,0.5,0.99,0.01],null],
  ["lsdev","Raster Bloom Smoothing Bright Deviation","rasterBloom",[0,-0.25,0.25,0.01],null],
  ["OS","R. Bloom Overscan Mode","rasterBloom",[1,0,2,1],null],
  ["BLOOM","Raster bloom %","rasterBloom",[0,0,20,1],null],
  ["GAMMA_INPUT","Gamma Input","gamma",[2.4,1,5,0.05],[1.8,1,5,0.05]],
  ["gamma_out","Gamma out","gamma",[2.4,1,5,0.05],[1.75,1,5,0.05]],
  ["inter","Interlace Trigger Resolution/VGA Trigger:","interlacingAndResampling",[375,0,800,25],[375,0,800,25]],
  ["interm","Interlace Mode: OFF, Normal 1-3,6; Interpolation 4-5","interlacingAndResampling",[1,0,6,1],[4,0,5,1]],
  ["iscan","Interlacing Scanline Effect ('Laced brightness)","interlacingAndResampling",[0.2,0,1,0.05],[0.2,0,1,0.05]],
  ["intres","Internal Resolution Y: 0.5...y-dowsample divider","interlacingAndResampling",[0,0,10,0.5],[0,0,10,0.5]],
  ["downsample_levelx","Downsampling-X (High-res content, pre-scalers)","interlacingAndResampling",[0,0,3,0.05],null],
  ["downsample_levely","Downsampling-Y (High-res content, pre-scalers)","interlacingAndResampling",[0,0,3,0.05],null],
  ["iscans","Interlacing (Scanline) Saturation","interlacingAndResampling",[0.25,0,1,0.05],[0.25,0,1,0.05]],
  ["vga_mode","VGA Single/Double Scan mode","interlacingAndResampling",[0,0,1,1],[0,0,1,1]],
  ["hiscan","High Resolution Scanlines (prepend a scaler...)","interlacingAndResampling",[0,0,1,1],[0,0,1,1]],
  ["h_sharp","Horizontal sharpness","filtering",[5.2,0.2,15,0.1],null],
  ["s_sharp","Substractive sharpness (1.0 recommended)","filtering",[0.5,0,2,0.1],null],
  ["ring","Substractive sharpness Ringing","filtering",[0,0,3,0.05],null],
  ["smart_ei","Smart Edges Effect Strength","filtering",[0,0,0.75,0.01],null],
  ["ei_limit","Smart Edges Effect Strength Limit","filtering",[0.25,0,0.75,0.01],null],
  ["sth","Smart Edges Smoothing Threshold","filtering",[0.23,0,1,0.01],null],
  ["HSHARPNESS","Horizontal Filter Range","filtering",null,[1,1,8,0.05]],
  ["SIGMA_HOR","Horizontal Blur Sigma","filtering",null,[0.5,0.1,7,0.025]],
  ["S_SHARP","Substractive Sharpness","filtering",null,[1,0,2,0.1]],
  ["HSHARP","Sharpness Definition","filtering",null,[1.2,0,2,0.1]],
  ["MAXS","Maximum Sharpness","filtering",null,[0.15,0,0.3,0.01]],
  ["HARNG","Substractive Sharpness Ringing","filtering",null,[0.2,0,4,0.1]],
  ["VSHARPNESS","Vertical Filter Range","filtering",null,[1,1,8,0.05]],
  ["SIGMA_VER","Vertical Blur Sigma","filtering",null,[0.5,0.1,7,0.025]],
  ["m_glow","Ordinary Glow / Magic Glow","magicGlow",[0,0,2,1],[0,0,2,1]],
  ["m_glow_cutoff","Magic Glow Cutoff","magicGlow",[0.12,0,0.4,0.01],[0.12,0,0.4,0.01]],
  ["m_glow_low","Magic Glow Low Strength","magicGlow",[0.35,0,7,0.05],[0.35,0,7,0.05]],
  ["m_glow_high","Magic Glow High Strength","magicGlow",[5,0,7,0.1],[5,0,7,0.1]],
  ["m_glow_dist","Magic Glow Distribution","magicGlow",[1,0.2,4,0.05],[1,0.2,4,0.05]],
  ["m_glow_mask","Magic Glow Mask Strength","magicGlow",[1,0,2,0.025],[1,0,2,0.025]],
  ["FINE_GLOW","Fine Glow/M.Glow Sampling","glowKernel",[1,-1,5,1],[1,-1,5,1]],
  ["SIZEH","Horizontal Glow Radius","glowKernel",[6,1,50,1],[6,1,50,1]],
  ["SIGMA_H","Horizontal Glow Sigma","glowKernel",[1.2,0.2,15,0.05],[1.2,0.2,15,0.05]],
  ["SIZEV","Vertical Glow Radius","glowKernel",[6,1,50,1],[6,1,50,1]],
  ["SIGMA_V","Vertical Glow Sigma","glowKernel",[1.2,0.2,15,0.05],[1.2,0.2,15,0.05]],
  ["FINE_BLOOM","Fine Bloom/Halation Sampling","bloomHalationKernel",[1,-1,5,1],[1,-1,5,1]],
  ["SIZEHB","Horizontal Bloom/Halation Radius","bloomHalationKernel",[3,1,50,1],[3,1,50,1]],
  ["SIGMA_HB","Horizontal Bloom/Halation Sigma","bloomHalationKernel",[0.75,0.25,15,0.025],[0.75,0.25,15,0.025]],
  ["SIZEVB","Vertical Bloom/Halation Radius","bloomHalationKernel",[3,1,50,1],[3,1,50,1]],
  ["SIGMA_VB","Vertical Bloom/Halation Sigma","bloomHalationKernel",[0.6,0.25,15,0.025],[0.6,0.25,15,0.025]],
  ["glow","(Magic) Glow Strength","brightnessAndBlend",[0.08,-2,2,0.01],[0.08,-2,2,0.01]],
  ["bloom","Bloom Strength","brightnessAndBlend",[0,-2,2,0.05],[0,-2,2,0.05]],
  ["mask_bloom","Mask Bloom","brightnessAndBlend",[0,-2,2,0.05],[0,-2,2,0.05]],
  ["bloom_dist","Bloom Distribution","brightnessAndBlend",[0,-2,3,0.05],[0,-2,3,0.05]],
  ["halation","Halation Strength","brightnessAndBlend",[0,-2,2,0.025],[0,-2,2,0.025]],
  ["bmask1","Bloom Mask Strength","brightnessAndBlend",[0,-1,1,0.025],[0,-1,1,0.025]],
  ["hmask1","Halation Mask Strength","brightnessAndBlend",[0.35,-1,1,0.025],[0.35,-1,1,0.025]],
  ["gamma_c","Gamma correct","brightnessAndBlend",[1,0.5,2,0.025],[1,0.5,2,0.025]],
  ["gamma_c2","Complementary Gamma correct","brightnessAndBlend",[1,1,2,0.025],[1,1,2,0.025]],
  ["brightboost","Bright Boost Dark Pixels","brightnessAndBlend",[1.4,0.25,10,0.05],[1.4,0.25,10,0.05]],
  ["brightboost1","Bright Boost Bright Pixels","brightnessAndBlend",[1.1,0.25,3,0.025],[1.1,0.25,3,0.025]],
  ["clips","Clip Saturated Color Beams","brightnessAndBlend",[0,-1,1,0.05],[0,-1,1,0.05]],
  ["gsl","Scanline Type","scanlines",[0,-1,2,1],[0,-1,2,1]],
  ["scanline1","Scanline Beam Shape Center","scanlines",[6,-20,40,0.5],[6,-20,40,0.5]],
  ["scanline2","Scanline Beam Shape Edges","scanlines",[8,0,70,1],[8,0,70,1]],
  ["beam_min","Scanline Shape Dark Pixels","scanlines",[1.3,0.25,10,0.05],[1.2,0.25,10,0.05]],
  ["beam_max","Scanline Shape Bright Pixels","scanlines",[1,0.2,3.5,0.025],[1,0.2,3.5,0.025]],
  ["tds","Thinner Dark Scanlines","scanlines",[0,0,1,1],[0,0,1,1]],
  ["beam_size","Increased Bright Scanline Beam","scanlines",[0.6,0,1,0.05],[0.6,0,1,0.05]],
  ["scans","Scanline Saturation / Mask Falloff","scanlines",[0.5,0,6,0.1],[0.5,0,6,0.1]],
  ["scan_falloff","Scanline Falloff","scanlines",[1,0.1,2,0.025],[1,0.1,2,0.025]],
  ["spike","Scanline Spike Removal","scanlines",[1,0,2,0.1],[1,0,2,0.1]],
  ["scangamma","Scanline Gamma","scanlines",[2.4,0.5,5,0.05],[2.4,0.5,5,0.05]],
  ["rolling_scan","Rolling Scanlines","scanlines",[0,-1,1,0.01],[0,-1,1,0.01]],
  ["no_scanlines","No-scanline mode","scanlines",[0,0,1.5,0.05],[0,0,1.5,0.05]],
  ["TATE","TATE Mode","screenGeometry",[0,0,1,1],null],
  ["IOS","Integer Scaling: Odd:Y, Even:'X'+Y","screenGeometry",[0,0,4,1],[0,0,4,1]],
  ["warpX","CurvatureX (default 0.03)","screenGeometry",[0,0,0.25,0.01],[0,0,0.25,0.01]],
  ["warpY","CurvatureY (default 0.04)","screenGeometry",[0,0,0.25,0.01],[0,0,0.25,0.01]],
  ["c_shape","Curvature Shape","screenGeometry",[0.25,0.05,0.6,0.05],[0.25,0.05,0.6,0.05]],
  ["overscanX","Overscan X original pixels","screenGeometry",[0,-200,200,1],[0,-200,200,1]],
  ["overscanY","Overscan Y original pixels","screenGeometry",[0,-200,200,1],[0,-200,200,1]],
  ["VShift","Vertical shift Y original pixels","screenGeometry",[0,-200,200,1],[0,-200,200,1]],
  ["csize","Corner Size","screenGeometry",[0,0,0.35,0.01],[0,0,0.35,0.01]],
  ["bsize1","Border Size","screenGeometry",[0,0,2,0.01],[0,0,2,0.01]],
  ["sborder","Border Intensity","screenGeometry",[0.75,0.25,2,0.05],[0.75,0.25,2,0.05]],
  ["barspeed","Hum Bar Speed","screenGeometry",[50,5,200,1],[50,5,200,1]],
  ["barintensity","Hum Bar Intensity","screenGeometry",[0,-1,1,0.01],[0,-1,1,0.01]],
  ["bardir","Hum Bar Direction","screenGeometry",[0,0,1,1],[0,0,1,1]],
  ["shadowMask","CRT Mask: 0:CGWG, 1-4:Lottes, 5-14:'Trinitron'","phosphorMask",[0,-1,14,1],[0,-1,14,1]],
  ["maskstr","Mask Strength (0, 5-14)","phosphorMask",[0.3,-0.5,1,0.025],[0.3,-0.5,1,0.025]],
  ["mcut","Mask 5-14 Low Strength","phosphorMask",[1.1,0,2,0.05],[1.1,0,2,0.05]],
  ["maskboost","CRT Mask Boost","phosphorMask",[1,1,3,0.05],[1,1,3,0.05]],
  ["masksize","CRT Mask Size","phosphorMask",[1,1,4,1],[1,1,4,1]],
  ["mask_zoom","CRT Mask Zoom (+ mask width)","phosphorMask",[0,-10,6,1],[0,-10,6,1]],
  ["mzoom_sh","CRT Mask Zoom Sharpen (needs Mask Zoom)","phosphorMask",[0,0,1,0.05],[0,0,1,0.05]],
  ["mshift","(Transform to) Shadow Mask","phosphorMask",[0,0,1,0.5],[0,0,1,0.5]],
  ["mask_layout","Mask Layout: RGB or BGR (check LCD panel)","phosphorMask",[0,0,1,1],[0,0,1,1]],
  ["maskDark","Lottes maskDark","phosphorMask",[0.5,0,2,0.05],[0.5,0,2,0.05]],
  ["maskLight","Lottes maskLight","phosphorMask",[1.5,0,2,0.05],[1.5,0,2,0.05]],
  ["mask_gamma","Mask gamma","phosphorMask",[2.4,1,5,0.05],[2.4,1,5,0.05]],
  ["slotmask","Slot Mask Strength Bright Pixels","phosphorMask",[0,0,1,0.05],[0,0,1,0.05]],
  ["slotmask1","Slot Mask Strength Dark Pixels","phosphorMask",[0,0,1,0.05],[0,0,1,0.05]],
  ["slotwidth","Slot Mask Width (0:Auto)","phosphorMask",[0,0,16,1],[0,0,16,1]],
  ["double_slot","Slot Mask Height: 2x1 or 4x1...","phosphorMask",[2,1,4,1],[2,1,4,1]],
  ["slotms","Slot Mask Thickness","phosphorMask",[1,1,4,1],[1,1,4,1]],
  ["smoothmask","Smooth Masks in bright scanlines","phosphorMask",[0,0,2,0.25],[0,0,2,0.25]],
  ["smask_mit","Mitigate Slotmask Interaction","phosphorMask",[0,0,1,0.05],[0,0,1,0.05]],
  ["bmask","Base (black) Mask strength","phosphorMask",[0,0,0.25,0.01],[0,0,0.25,0.01]],
  ["mclip","Preserve Mask Strength","phosphorMask",[0,0,1,0.025],[0,0,1,0.025]],
  ["pr_scan","Preserve Scanline Properties","phosphorMask",[0.1,0,1,0.025],[0.1,0,1,0.025]],
  ["edgemask","Mitigate Mask on Edges","phosphorMask",[0,0,1,0.1],[0,0,1,0.1]],
  ["dctypex","Deconvergence type X : 0.0 - static, other - dynamic","deconvergenceNoiseOutput",[0,0,0.75,0.05],[0,0,0.75,0.05]],
  ["dctypey","Deconvergence type Y : 0.0 - static, other - dynamic","deconvergenceNoiseOutput",[0,0,0.75,0.05],[0,0,0.75,0.05]],
  ["deconrr","Horizontal Deconvergence Red Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["deconrg","Horizontal Deconvergence Green Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["deconrb","Horizontal Deconvergence Blue Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["deconrry","Vertical Deconvergence Red Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["deconrgy","Vertical Deconvergence Green Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["deconrby","Vertical Deconvergence Blue Range","deconvergenceNoiseOutput",[0,-15,15,0.25],[0,-15,15,0.25]],
  ["decons","Deconvergence Strength","deconvergenceNoiseOutput",[1,0,3,0.1],[1,0,3,0.1]],
  ["addnoised","Add Noise","deconvergenceNoiseOutput",[0,-1,1,0.02],[0,-1,1,0.02]],
  ["noiseresd","Noise Resolution","deconvergenceNoiseOutput",[2,1,10,1],[2,1,10,1]],
  ["noisetype","Noise Type: Colored, Luma","deconvergenceNoiseOutput",[0,0,1,1],[0,0,1,1]],
  ["post_br","Post Brightness","deconvergenceNoiseOutput",[1,0.25,5,0.01],[1,0.25,5,0.01]],
  ["oimage","Show Original Image","deconvergenceNoiseOutput",[0,0,1,0.25],[0,0,1,0.25]],
];

function makeRange(row: RangeRow | null): CrtGuestParameterRange | null {
  if (!row) return null;
  return Object.freeze({
    default: row[0],
    min: row[1],
    max: row[2],
    step: row[3],
  });
}

export const CRT_GUEST_PARAMETER_CATALOG: readonly CrtGuestParameterDefinition[] =
  Object.freeze(
    PARAMETER_ROWS.map((row, index) => {
      const advanced = makeRange(row[3]);
      const hd = makeRange(row[4]);
      const variants: CrtGuestVariant[] = [];
      if (advanced) variants.push("advanced");
      if (hd) variants.push("hd");
      return Object.freeze({
        index,
        id: row[0],
        label: row[1],
        group: row[2],
        variants: Object.freeze(variants),
        supportsAdvanced: advanced !== null,
        supportsHd: hd !== null,
        advanced,
        hd,
      });
    }),
  );

const PARAMETER_BY_ID = new Map<string, CrtGuestParameterDefinition>();
for (const parameter of CRT_GUEST_PARAMETER_CATALOG) {
  if (PARAMETER_BY_ID.has(parameter.id)) {
    throw new Error("Duplicate CRT Guest parameter ID: " + parameter.id);
  }
  PARAMETER_BY_ID.set(parameter.id, parameter);
}

const GROUPS: CrtGuestParameterGroup[] = [];
for (const parameter of CRT_GUEST_PARAMETER_CATALOG) {
  let group = GROUPS[GROUPS.length - 1];
  if (!group || group.id !== parameter.group) {
    group = { id: parameter.group, parameters: [] };
    GROUPS.push(group);
  }
  (group.parameters as CrtGuestParameterDefinition[]).push(parameter);
}
for (const group of GROUPS) {
  Object.freeze(group.parameters);
  Object.freeze(group);
}
export const CRT_GUEST_PARAMETER_GROUPS: readonly CrtGuestParameterGroup[] =
  Object.freeze(GROUPS);

export const CRT_GUEST_PARAMETER_COUNTS = Object.freeze({
  advanced: 133,
  hd: 130,
  shared: 120,
  union: 143,
});

if (
  CRT_GUEST_PARAMETER_CATALOG.length !== CRT_GUEST_PARAMETER_COUNTS.union ||
  CRT_GUEST_PARAMETER_CATALOG.filter((entry) => entry.supportsAdvanced).length !==
    CRT_GUEST_PARAMETER_COUNTS.advanced ||
  CRT_GUEST_PARAMETER_CATALOG.filter((entry) => entry.supportsHd).length !==
    CRT_GUEST_PARAMETER_COUNTS.hd ||
  CRT_GUEST_PARAMETER_CATALOG.filter(
    (entry) => entry.supportsAdvanced && entry.supportsHd,
  ).length !== CRT_GUEST_PARAMETER_COUNTS.shared
) {
  throw new Error("CRT Guest parameter catalog count mismatch.");
}

export function getCrtGuestParameter(
  id: string,
): CrtGuestParameterDefinition | undefined {
  return PARAMETER_BY_ID.get(id);
}

export function getCrtGuestRange(
  parameter: CrtGuestParameterDefinition,
  variant: CrtGuestVariant,
): CrtGuestParameterRange | null {
  return variant === "advanced" ? parameter.advanced : parameter.hd;
}

const STARTUP_ADVANCED_VALUES = Object.freeze([0.0,0.0,1.0,4.0,0.3199999928474426,0.3199999928474426,0.3199999928474426,0.20000000298023224,0.5,0.0,0.0,0.0,32.0,0.0,1.0,1.0,0.0,1.0,0.0,0.0,0.0,1.0,0.699999988079071,0.0,1.0,0.0,2.4000000953674316,2.4000000953674316,375.0,1.0,0.20000000298023224,0.0,0.0,0.0,0.25,0.0,0.0,5.199999809265137,0.5,0.0,0.0,0.25,0.23000000417232513,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.11999999731779099,0.3499999940395355,5.0,1.0,1.0,1.0,6.0,1.2000000476837158,6.0,1.2000000476837158,1.0,3.0,0.75,3.0,0.6000000238418579,0.07999999821186066,0.0,0.0,0.0,0.0,0.0,0.3499999940395355,1.0,1.0,1.399999976158142,1.100000023841858,0.0,0.0,6.0,8.0,1.2999999523162842,1.0,0.0,0.6000000238418579,0.5,1.0,1.0,2.4000000953674316,0.0,0.0,0.0,0.0,0.0,0.0,0.25,0.0,0.0,0.0,0.0,0.0,0.75,50.0,0.0,0.0,0.0,0.30000001192092896,1.100000023841858,1.0,1.0,0.0,0.0,0.0,0.0,0.5,1.5,2.4000000953674316,0.0,0.0,0.0,2.0,1.0,0.0,0.0,0.0,0.0,0.10000000149011612,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,1.0,0.0,2.0,0.0,1.0,0.0]);
const STARTUP_HD_VALUES = Object.freeze([4.200000286102295,0.0,1.0,1.0,0.3199999928474426,0.3199999928474426,0.3199999928474426,0.28999999165534973,1.0,0.0,1.0,0.0,32.0,30.0,1.0,1.1100000143051147,0.0,1.2000000476837158,0.0,-31.0,0.0,0.5,0.0,0.0,0.0,0.0,1.7999999523162842,1.75,0.0,0.0,0.0,2.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,1.0,0.22500000894069672,1.0,1.0,0.14999999105930328,1.600000023841858,1.0,0.5,1.0,0.3400000035762787,0.3499999940395355,5.0,1.0,1.0,2.0,29.0,1.2000000476837158,34.0,2.049999952316284,1.0,3.0,0.75,3.0,0.6000000238418579,0.07999995350837708,0.15000003576278687,0.05000003054738045,0.6500000357627869,2.9802322387695312e-08,0.0,0.3499999940395355,1.0,1.0,0.25,1.0,1.4901161193847656e-08,1.0,7.0,8.0,0.25,1.0,0.0,0.6000000238418579,0.5,1.0,1.0,1.0,0.0,0.0,0.0,0.0,0.0,0.0,0.05000000074505806,0.0,0.0,0.0,0.0,0.0,0.75,87.0,0.019999977201223373,0.0,6.0,0.30000001192092896,0.20000000298023224,1.399999976158142,1.0,1.0,0.0,0.0,0.0,0.5,1.5,2.4000000953674316,0.0,0.0,0.0,2.0,1.0,2.0,0.0,0.0,0.0,0.10000000149011612,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,1.0,-2.2351741790771484e-08,3.0,0.0,1.0,0.0]);

export interface CrtGuestPresetData {
  version: number;
  sourceCommit: string;
  enabled: boolean;
  variant: number;
  quality: number;
  advancedValues: readonly number[];
  hdValues: readonly number[];
}

export const CRT_GUEST_STARTUP_PRESET: Readonly<CrtGuestPresetData> =
  Object.freeze({
    version: CRT_GUEST_PRESET_VERSION,
    sourceCommit: CRT_GUEST_SOURCE_COMMIT,
    enabled: true,
    variant: 1,
    quality: 2,
    advancedValues: STARTUP_ADVANCED_VALUES,
    hdValues: STARTUP_HD_VALUES,
  });

export const CRT_GUEST_STARTUP_PRESET_SHA256 =
  "7a29c04ed24fe24c51242c171d7ccbdca697a3e2c8c1e49ea5d3cd90fa7b89a4";

export interface CrtGuestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CrtGuestSettingsOptions {
  storage?: CrtGuestStorage | null;
  storageKey?: string;
  loadStored?: boolean;
  persistChanges?: boolean;
  initialState?: "startup" | "defaults";
}

export type CrtGuestSettingsChangeKind =
  | "initial"
  | "enabled"
  | "variant"
  | "quality"
  | "parameter"
  | "reset-current"
  | "reset-all"
  | "preset"
  | "history-reset";

export interface CrtGuestSettingsChange {
  readonly kind: CrtGuestSettingsChangeKind;
  readonly revision: number;
  readonly historyRevision: number;
  readonly historyChanged: boolean;
  readonly parameterId?: string;
  readonly variant?: CrtGuestVariant;
}

export type CrtGuestSettingsListener = (
  change: CrtGuestSettingsChange,
  settings: CrtGuestSettings,
) => void;

export interface CrtGuestSettingsSnapshot {
  readonly enabled: boolean;
  readonly variant: CrtGuestVariant;
  readonly quality: CrtGuestQuality;
  readonly revision: number;
  readonly historyRevision: number;
  readonly advancedValues: readonly number[];
  readonly hdValues: readonly number[];
}

export type CrtGuestResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

function success(): CrtGuestResult {
  return { ok: true };
}

function failure(error: string): CrtGuestResult {
  return { ok: false, error };
}

function browserStorage(): CrtGuestStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function rangeFor(
  parameter: CrtGuestParameterDefinition,
  variant: CrtGuestVariant,
): CrtGuestParameterRange | null {
  return variant === "advanced" ? parameter.advanced : parameter.hd;
}

// Unity's Mathf.Round uses midpoint-to-even behavior. Preserve it instead of
// JavaScript's +infinity midpoint rule so half-step typed values agree.
function roundToEven(value: number): number {
  const lower = Math.floor(value);
  const fraction = value - lower;
  const tolerance = Number.EPSILON * Math.max(4, Math.abs(value) * 4);
  if (Math.abs(fraction - 0.5) <= tolerance) {
    return lower % 2 === 0 ? lower : lower + 1;
  }
  return Math.round(value);
}

export function normalizeCrtGuestValue(
  parameter: CrtGuestParameterDefinition,
  value: number,
  variant: CrtGuestVariant,
): number | null {
  const range = rangeFor(parameter, variant);
  if (!range || !Number.isFinite(value)) return null;
  let normalized = Math.min(range.max, Math.max(range.min, value));
  if (range.step > 0) {
    normalized =
      range.min +
      roundToEven((normalized - range.min) / range.step) * range.step;
    normalized = Math.min(range.max, Math.max(range.min, normalized));
    if (
      range.min <= 0 &&
      range.max >= 0 &&
      Math.abs(normalized) <= range.step * 0.5 + 0.000001
    ) {
      normalized = 0;
    }
  }
  if (parameter.id === "LS") normalized = 32;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function variantFromCode(value: unknown): CrtGuestVariant | null {
  return value === 0 ? "advanced" : value === 1 ? "hd" : null;
}

function qualityFromCode(value: unknown): CrtGuestQuality | null {
  return value === 0
    ? "exact"
    : value === 1
      ? "balanced"
      : value === 2
        ? "apple-tv"
        : null;
}

function variantCode(value: CrtGuestVariant): number {
  return value === "advanced" ? 0 : 1;
}

function qualityCode(value: CrtGuestQuality): number {
  return value === "exact" ? 0 : value === "balanced" ? 1 : 2;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

interface ValidatedPreset {
  enabled: boolean;
  variant: CrtGuestVariant;
  quality: CrtGuestQuality;
  advancedValues: number[];
  hdValues: number[];
}

function validatePreset(value: unknown): ValidatedPreset | string {
  if (!isObject(value)) return "CRT preset must be a JSON object.";
  if (value.version !== CRT_GUEST_PRESET_VERSION) {
    return "Unsupported CRT preset version '" + String(value.version) + "'.";
  }
  if (value.sourceCommit !== CRT_GUEST_SOURCE_COMMIT) {
    return "CRT preset targets a different upstream shader revision.";
  }
  if (typeof value.enabled !== "boolean") {
    return "CRT preset contains an invalid enabled flag.";
  }
  const variant = variantFromCode(value.variant);
  const quality = qualityFromCode(value.quality);
  if (!variant || !quality) {
    return "CRT preset contains an invalid variant or quality mode.";
  }
  if (
    !Array.isArray(value.advancedValues) ||
    !Array.isArray(value.hdValues) ||
    value.advancedValues.length !== CRT_GUEST_PARAMETER_COUNTS.union ||
    value.hdValues.length !== CRT_GUEST_PARAMETER_COUNTS.union
  ) {
    return (
      "Expected " +
      CRT_GUEST_PARAMETER_COUNTS.union +
      " CRT parameters for both variants."
    );
  }

  const advancedValues = defaultsFor("advanced");
  const hdValues = defaultsFor("hd");
  for (const parameter of CRT_GUEST_PARAMETER_CATALOG) {
    const advancedRaw = value.advancedValues[parameter.index];
    const hdRaw = value.hdValues[parameter.index];
    if (parameter.supportsAdvanced) {
      if (typeof advancedRaw !== "number" || !Number.isFinite(advancedRaw)) {
        return "CRT parameter '" + parameter.id + "' is not finite.";
      }
      advancedValues[parameter.index] =
        normalizeCrtGuestValue(parameter, advancedRaw, "advanced") ?? 0;
    }
    if (parameter.supportsHd) {
      if (typeof hdRaw !== "number" || !Number.isFinite(hdRaw)) {
        return "CRT parameter '" + parameter.id + "' is not finite.";
      }
      hdValues[parameter.index] =
        normalizeCrtGuestValue(parameter, hdRaw, "hd") ?? 0;
    }
  }

  return {
    enabled: value.enabled,
    variant,
    quality,
    advancedValues,
    hdValues,
  };
}

function defaultsFor(variant: CrtGuestVariant): number[] {
  return CRT_GUEST_PARAMETER_CATALOG.map((parameter) => {
    const range = rangeFor(parameter, variant);
    if (!range) return 0;
    return parameter.id === "LS" ? 32 : range.default;
  });
}

export class CrtGuestSettings {
  private enabledState = false;
  private variantState: CrtGuestVariant = "hd";
  private qualityState: CrtGuestQuality = "exact";
  private advancedValues = defaultsFor("advanced");
  private hdValues = defaultsFor("hd");
  private readonly listeners = new Set<CrtGuestSettingsListener>();
  private readonly storage: CrtGuestStorage | null;
  private readonly storageKey: string;
  private readonly persistChanges: boolean;
  private persistenceTimer: ReturnType<typeof setTimeout> | null = null;

  private revisionState = 1;
  private historyRevisionState = 1;
  lastStorageError: string | null = null;

  constructor(options: CrtGuestSettingsOptions = {}) {
    this.storage =
      options.storage === undefined ? browserStorage() : options.storage;
    this.storageKey = options.storageKey ?? CRT_GUEST_STORAGE_KEY;
    this.persistChanges = options.persistChanges ?? true;

    if ((options.initialState ?? "startup") === "startup") {
      const startup = validatePreset(CRT_GUEST_STARTUP_PRESET);
      if (typeof startup === "string") throw new Error(startup);
      this.replaceSilently(startup);
    }

    if ((options.loadStored ?? true) && this.storage) {
      try {
        const saved = this.storage.getItem(this.storageKey);
        if (saved !== null) {
          const parsed: unknown = JSON.parse(saved);
          const validated = validatePreset(parsed);
          if (typeof validated === "string") this.lastStorageError = validated;
          else this.replaceSilently(validated);
        }
      } catch (error) {
        this.lastStorageError =
          "Could not load saved CRT preset: " + errorMessage(error);
      }
    }
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  get variant(): CrtGuestVariant {
    return this.variantState;
  }

  get quality(): CrtGuestQuality {
    return this.qualityState;
  }

  get revision(): number {
    return this.revisionState;
  }

  get historyRevision(): number {
    return this.historyRevisionState;
  }

  get parameterCount(): number {
    return CRT_GUEST_PARAMETER_CATALOG.length;
  }

  setEnabled(enabled: boolean): boolean {
    if (this.enabledState === enabled) return false;
    this.enabledState = enabled;
    this.commit("enabled", true);
    return true;
  }

  setVariant(variant: CrtGuestVariant): boolean {
    if (!CRT_GUEST_VARIANTS.includes(variant)) {
      throw new Error("Unknown CRT Guest variant: " + String(variant));
    }
    if (this.variantState === variant) return false;
    this.variantState = variant;
    this.commit("variant", true, undefined, variant);
    return true;
  }

  setQuality(quality: CrtGuestQuality): boolean {
    if (!CRT_GUEST_QUALITIES.includes(quality)) {
      throw new Error("Unknown CRT Guest quality: " + String(quality));
    }
    if (this.qualityState === quality) return false;
    this.qualityState = quality;
    this.commit("quality", false);
    return true;
  }

  getValue(id: string, variant = this.variantState): number {
    const parameter = PARAMETER_BY_ID.get(id);
    if (!parameter) throw new Error("Unknown CRT Guest parameter: " + id);
    return this.getValueAt(parameter.index, variant);
  }

  getValueAt(index: number, variant = this.variantState): number {
    this.validateIndex(index);
    return variant === "advanced"
      ? this.advancedValues[index]
      : this.hdValues[index];
  }

  copyValues(variant: CrtGuestVariant): number[] {
    return (variant === "advanced" ? this.advancedValues : this.hdValues).slice();
  }

  setValue(id: string, value: number, variant = this.variantState): boolean {
    const parameter = PARAMETER_BY_ID.get(id);
    if (!parameter) throw new Error("Unknown CRT Guest parameter: " + id);
    return this.setValueAt(parameter.index, value, variant);
  }

  setValueAt(
    index: number,
    value: number,
    variant = this.variantState,
  ): boolean {
    this.validateIndex(index);
    const parameter = CRT_GUEST_PARAMETER_CATALOG[index];
    const normalized = normalizeCrtGuestValue(parameter, value, variant);
    if (normalized === null) return false;
    const values = variant === "advanced" ? this.advancedValues : this.hdValues;
    const previous = values[index];
    if (
      !(normalized === 0 && previous !== 0) &&
      Math.abs(previous - normalized) <= 0.000001
    ) {
      return false;
    }
    values[index] = normalized;
    this.commit("parameter", false, parameter.id, variant);
    return true;
  }

  resetCurrentDefaults(): void {
    if (this.variantState === "advanced") {
      this.advancedValues = defaultsFor("advanced");
    } else {
      this.hdValues = defaultsFor("hd");
    }
    this.commit("reset-current", true, undefined, this.variantState);
  }

  resetAllDefaults(): void {
    this.enabledState = false;
    this.variantState = "hd";
    this.qualityState = "exact";
    this.advancedValues = defaultsFor("advanced");
    this.hdValues = defaultsFor("hd");
    this.commit("reset-all", true);
  }

  applyStartupPreset(): CrtGuestResult {
    return this.applyPreset(CRT_GUEST_STARTUP_PRESET);
  }

  applyPreset(value: unknown): CrtGuestResult {
    const validated = validatePreset(value);
    if (typeof validated === "string") return failure(validated);
    this.replaceSilently(validated);
    this.commit("preset", true);
    return success();
  }

  importJson(json: string): CrtGuestResult {
    if (!json.trim()) return failure("CRT preset JSON is empty.");
    try {
      const parsed: unknown = JSON.parse(json);
      return this.applyPreset(parsed);
    } catch (error) {
      return failure("Could not parse CRT preset: " + errorMessage(error));
    }
  }

  exportPreset(): CrtGuestPresetData {
    return {
      version: CRT_GUEST_PRESET_VERSION,
      sourceCommit: CRT_GUEST_SOURCE_COMMIT,
      enabled: this.enabledState,
      variant: variantCode(this.variantState),
      quality: qualityCode(this.qualityState),
      advancedValues: this.advancedValues.slice(),
      hdValues: this.hdValues.slice(),
    };
  }

  exportJson(pretty = true): string {
    return JSON.stringify(this.exportPreset(), null, pretty ? 2 : undefined);
  }

  snapshot(): CrtGuestSettingsSnapshot {
    return Object.freeze({
      enabled: this.enabledState,
      variant: this.variantState,
      quality: this.qualityState,
      revision: this.revision,
      historyRevision: this.historyRevision,
      advancedValues: Object.freeze(this.advancedValues.slice()),
      hdValues: Object.freeze(this.hdValues.slice()),
    });
  }

  subscribe(
    listener: CrtGuestSettingsListener,
    emitCurrent = false,
  ): () => void {
    this.listeners.add(listener);
    if (emitCurrent) {
      listener(
        Object.freeze({
          kind: "initial",
          revision: this.revision,
          historyRevision: this.historyRevision,
          historyChanged: false,
        }),
        this,
      );
    }
    return () => this.listeners.delete(listener);
  }

  requestHistoryReset(): void {
    this.historyRevisionState += 1;
    this.emit("history-reset", true);
  }

  saveToStorage(): CrtGuestResult {
    if (this.persistenceTimer !== null) {
      clearTimeout(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    if (!this.storage) return failure("CRT preset storage is unavailable.");
    try {
      this.storage.setItem(this.storageKey, this.exportJson(false));
      this.lastStorageError = null;
      return success();
    } catch (error) {
      const message = "Could not save CRT preset: " + errorMessage(error);
      this.lastStorageError = message;
      return failure(message);
    }
  }

  loadFromStorage(): CrtGuestResult {
    if (!this.storage) return failure("CRT preset storage is unavailable.");
    try {
      const json = this.storage.getItem(this.storageKey);
      if (json === null) return failure("No saved CRT preset was found.");
      const result = this.importJson(json);
      this.lastStorageError = result.ok ? null : result.error;
      return result;
    } catch (error) {
      const message = "Could not load saved CRT preset: " + errorMessage(error);
      this.lastStorageError = message;
      return failure(message);
    }
  }

  clearStoredPreset(): CrtGuestResult {
    if (!this.storage) return failure("CRT preset storage is unavailable.");
    try {
      this.storage.removeItem(this.storageKey);
      this.lastStorageError = null;
      return success();
    } catch (error) {
      const message = "Could not clear saved CRT preset: " + errorMessage(error);
      this.lastStorageError = message;
      return failure(message);
    }
  }

  dispose(): void {
    if (this.persistenceTimer !== null) {
      clearTimeout(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    this.listeners.clear();
  }

  private validateIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.parameterCount) {
      throw new RangeError("CRT Guest parameter index is out of range: " + index);
    }
  }

  private replaceSilently(preset: ValidatedPreset): void {
    this.enabledState = preset.enabled;
    this.variantState = preset.variant;
    this.qualityState = preset.quality;
    this.advancedValues = preset.advancedValues.slice();
    this.hdValues = preset.hdValues.slice();
  }

  private commit(
    kind: CrtGuestSettingsChangeKind,
    historyChanged: boolean,
    parameterId?: string,
    variant?: CrtGuestVariant,
  ): void {
    this.revisionState += 1;
    if (historyChanged) this.historyRevisionState += 1;
    this.emit(kind, historyChanged, parameterId, variant);
    this.schedulePersistence();
  }

  private emit(
    kind: CrtGuestSettingsChangeKind,
    historyChanged: boolean,
    parameterId?: string,
    variant?: CrtGuestVariant,
  ): void {
    const change: CrtGuestSettingsChange = Object.freeze({
      kind,
      revision: this.revision,
      historyRevision: this.historyRevision,
      historyChanged,
      parameterId,
      variant,
    });
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(change, this);
      } catch (error) {
        console.error("CRT Guest settings subscriber failed.", error);
      }
    }
  }

  private schedulePersistence(): void {
    if (!this.persistChanges || !this.storage) return;
    if (this.persistenceTimer !== null) clearTimeout(this.persistenceTimer);
    this.persistenceTimer = setTimeout(() => {
      this.persistenceTimer = null;
      this.saveToStorage();
    }, 120);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Main integration can share this instance; tests and tools can construct an
// isolated CrtGuestSettings with storage disabled.
export const crtGuestSettings = new CrtGuestSettings();
