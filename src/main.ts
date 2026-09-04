// Entry point: renderer, Crash-style corridor camera, and the deterministic
// fixed-step game loop.

import * as THREE from "three";
import { Input } from "./input";
import {
  Level,
  LevelEntry,
  CustomLevelData,
  DEFAULT_LEVEL_ID,
  setEditorBuild,
  levelList,
  findLevel,
  saveUserLevel,
  setUserLevels,
  getUserLevels,
  deleteUserLevel,
  restoreBuiltin,
  adoptLegacyLevels,
  starterCustomLevel,
  normalizeCustomLevelData,
  newLaneCursor,
  userLevelStorageHealthy,
  isEditUnlocked,
  checkEditPass,
  deckTrickInfo,
  DEFAULT_SKY,
  type SkyPreset,
} from "./level";
import { pushLevels, fetchRemoteLevels, getToken, setToken } from "./sync";
import {
  Player,
  type PlayerRunState,
  type PlayerWorldFruitSnapshot,
} from "./player";
import { UI, type HudState } from "./ui";
import { GameFlowUI, type ResultsScreenState } from "./gameFlowUI";
import {
  CampaignStore,
  DEFAULT_CAMPAIGN_LIVES,
  campaignLevelById,
  isCampaignLevel,
  loadGameAudioOptions,
  saveGameAudioOptions,
  type GameAudioOptions,
} from "./campaign";
import { BONUS_LEVEL } from "./levels/bonus-level";
import { TUNING, CONST } from "./tuning";
import {
  speedSkateFovTarget,
  stepSpeedSkateFov,
} from "./cameraSpeedEffect";
import { sfx } from "./audio";
import { Recorder, Replayer, ReplayFile, camYawOf, isReplayFile } from "./replay";
import { Editor } from "./editor";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { puffs, PUFF_PRESETS } from "./puffs";
import { swirls } from "./swirls";
import { fieldSwirls } from "./swirlfield";
import {
  CoastPostRenderer,
  type CoastPostPreCrtOverlay,
} from "./coastpost";
import { crtGuestSettings } from "./crt-guest/settings";
import { createCrtGuestTuningPanel } from "./crt-guest/panel";
import {
  renderQualitySettings,
  type RenderQualitySizes,
} from "./render-quality/settings";
import {
  createRenderQualityPanel,
  type RenderQualityPanel,
} from "./render-quality/panel";
import { PresentationFrameLimiter } from "./render-quality/frameLimiter";
import { createSkateboardTuningPanel } from "./skateboard/panel";
import { skateboardSettings } from "./skateboard/settings";
import { createSpinTuningPanel } from "./spin-effects/panel";
import {
  groundedSkateSpinRingSettings,
  spinRingSettings,
} from "./spin-effects/settings";
import { sourceComboLabelLine } from "./comboHud";
import { createVisualTreatmentPanel } from "./visual-treatment/panel";
import {
  visualTreatmentActivity,
  visualTreatmentSettings,
} from "./visual-treatment/settings";
import { createBonusParallax } from "./bonusParallax";
import { touchControlsRequested } from "./touch";
import {
  RigBinding,
  UNITY_CRAWL_CONTACT_ADAPTATION,
  createLocalDraftStore,
  createPreferredDraftStore,
  createPlayerStarterAnimationSuite,
  reconcilePlayerStarterAnimationSuite,
  type AnimationSuiteDocument,
} from "./animation";
import {
  createCharacterAnimationRuntime,
  type CharacterAnimationRuntime,
} from "./characterAnimationRuntime";

const app = document.getElementById("app")!;
const TOUCH_PRESENTATION = touchControlsRequested();
// '?lite' (headless smoke) renders in software: no AA, and resize() caps the
// internal resolution — slow frames desync the suite's wall-clock scripting.
const LITE_RENDER = window.location.search.includes("lite");
const NO_COAST_POST = window.location.search.includes("nopost");
const NO_OCEAN_PASSES = window.location.search.includes("nopasses");
const renderer = new THREE.WebGLRenderer({ antialias: !LITE_RENDER });
// NATIVE RESOLUTION. The device pixel ratio is the baseline — on a Retina
// panel that is 2x the CSS grid, and rendering below it was the single biggest
// thing making the game look cheap. Capped at 2: past that the pixels are far
// too small to see and it is pure fill-rate.
renderer.setPixelRatio(
  renderQualitySettings.enabled && !LITE_RENDER && !TOUCH_PRESENTATION
    ? 1
    : Math.min(window.devicePixelRatio || 1, 2),
);
// No tone curve. Every colour in this game was authored by eye against a raw
// output, and ACES/AgX/Neutral all pull the saturation out of it — the sky
// goes milky and the greens go grey. Shot side by side, untouched wins.
// Soft shadows. This is what stops everything reading as a lit grey box:
// contact between the skater, the props and the ground.
renderer.shadowMap.enabled = !LITE_RENDER;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
Level.setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());
app.appendChild(renderer.domElement);

// --- auto-update: beat the 10-minute GitHub Pages HTML cache ----------------
// Pages caches index.html for up to 10 min, so a device keeps loading the OLD
// hashed JS bundle after a new push. On load, fetch the live index.html (cache
// bypassed) and, if it points at a newer bundle than the one running, reload
// ONCE to a cache-busting URL — so the freshest deploy always wins within a few
// seconds, no manual refresh. Guarded so it can never loop.
if (import.meta.env.PROD) {
  void (async (): Promise<void> => {
    try {
      const running = import.meta.url.match(/index-([\w-]+)\.js/)?.[1];
      if (!running) return;
      const res = await fetch(`./index.html?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const fresh = (await res.text()).match(/index-([\w-]+)\.js/)?.[1];
      if (!fresh || fresh === running) return; // already on the latest build
      if (sessionStorage.getItem("solProtoAutoUpdate") === fresh) return; // tried this one already
      sessionStorage.setItem("solProtoAutoUpdate", fresh);
      const url = new URL(window.location.href);
      url.searchParams.set("v", fresh);
      window.location.replace(url.toString());
    } catch {
      /* offline or blocked — just run whatever's loaded */
    }
  })();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232634);
scene.fog = new THREE.Fog(0x232634, 30, 170);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x8a6b46, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4ae, 1.55);
sun.position.set(30, 60, 20);
scene.add(sun);
scene.add(sun.target);
// SHADOWS. A directional light shadows the whole world through one ortho
// frustum, so the frustum has to be small enough to hold detail and therefore
// has to FOLLOW the skater (see updateSunShadow). 46 units square at 2048 is
// ~22 texels per unit — enough that a crate edge reads sharp — and the bias
// pair is tuned for the shallow angles the low sun throws across a deck.
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const SHADOW_HALF = 23;
sun.shadow.camera.left = -SHADOW_HALF;
sun.shadow.camera.right = SHADOW_HALF;
sun.shadow.camera.top = SHADOW_HALF;
sun.shadow.camera.bottom = -SHADOW_HALF;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 190;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.035;
// The sun rides a fixed offset from whatever it is lighting, so the frustum
// travels with play and the light direction never changes.
const SUN_OFFSET = new THREE.Vector3(38, 74, 26);
// Unity Beachfront directional light rotation (40.1, 98.9, 0), converted to
// a Three light-position offset opposite its forward ray.
const COAST_SUN_OFFSET = new THREE.Vector3(-68, 58, -11);
function updateSunShadow(focusX: number, focusY: number, focusZ: number): void {
  const offset = activeSky === "coast" ? COAST_SUN_OFFSET : SUN_OFFSET;
  sun.target.position.set(focusX, focusY, focusZ);
  sun.target.updateMatrixWorld();
  sun.position.set(
    focusX + offset.x,
    focusY + offset.y,
    focusZ + offset.z,
  );
  sun.shadow.camera.updateProjectionMatrix();
}
// Cool fill from opposite the sun: faint sky-colored bounce so the faces the
// key misses keep a hint of shape instead of going dead flat. No shadows.
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.25);
fill.position.set(-30, 25, -20);
scene.add(fill);

// '?lite' strips the pure-visual layers (sky dome, ambient particles) — used
// by the headless smoke autopilot, where software rendering can't afford the
// fill rate and slow frames desync its wall-clock input scripting.
const LITE = window.location.search.includes("lite");

// Sky dome: a big inward-facing sphere that follows the camera, painted with
// each level's gradient + sun + stars. Sits behind everything, ignores fog.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(370, 24, 12),
  new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  }),
);
sky.renderOrder = -1;
sky.frustumCulled = false;
sky.visible = !LITE;
// Unity's Camera Opaque Texture includes the skybox. Keep this backdrop in the
// ocean opaque/depth prepass even though its display material is transparent.
sky.userData.oceanOpaqueBackdrop = true;
scene.add(sky);

// Photographic skybox: a painted backdrop mapped onto the dome. It is NOT a
// full 360 wrap — it's scaled down so a good slice of the composition sits
// above the horizon, the image's own horizon (600px of 887) is pinned to the
// world horizon (the dome's equator), and its alpha-faded bottom melts into
// the retinted fog. Repeats horizontally, clamps top/bottom.
//
// THREE paintings share this geometry — day, sunset, night — same size, same
// horizon row, so switching between them is a texture swap plus colour. Which
// one is on the dome is authored per level (Level.skyPreset).
const SKY_K = 2.15; // vertical scale: >1 shrinks the image so more of it shows
// Horizontal wrap count MUST be an integer. The dome is a sphere with a UV seam
// at one longitude; a non-integer repeat (e.g. 2.15) makes the texture coord jump
// by its fractional part (0.15) across that seam — a hard vertical seam locked to
// a fixed world direction, no matter how seamless the image itself is. An integer
// count wraps the (made-seamless) image continuously across the geometry seam.
const SKY_WRAP = 2;
const SKY_IMG_H = 887;
const SKY_HORIZON_PX = 600; // the painting's own horizon, in image pixels
const SKY_HORIZON_V = 1 - SKY_HORIZON_PX / SKY_IMG_H; // ...as a texture-V coord

// ---- TIME OF DAY -----------------------------------------------------------
// Everything that made the world read as a sunset used to be hardcoded here.
// It is now one row of a table, so day and night are the same code with
// different numbers. The tints are pulls toward a colour (lerp amount `k`),
// not replacements, so each level's own theme still shows through — a jungle
// stays greener than a beach at every time of day.
//
// `top`/`bottom` only matter when the painting is missing: the procedural
// gradient sky is the fallback, and it has to read as the right time of day
// on its own (see applyTheme).
interface SkyPresetDef {
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
const SKY_PRESETS: Record<SkyPreset, SkyPresetDef> = {
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

// a preset's painted-horizon row as a texture-V coordinate
const presetHorizonV = (p: SkyPreset): number => {
  const d = SKY_PRESETS[p];
  return 1 - (d.horizonPx ?? SKY_HORIZON_PX) / (d.imgH ?? SKY_IMG_H);
};

// Both layers built from one painting (see the loader below).
interface SkyLayers {
  bg: THREE.CanvasTexture; // the dome backdrop
  mist: THREE.CanvasTexture; // the below-horizon cloud sea, drawn in front
}
const skyCache = new Map<SkyPreset, SkyLayers>(); // built once, kept for the session
const skyPending = new Set<SkyPreset>();
const skyMissing = new Set<SkyPreset>(); // 404 / decode failure — use the gradient
let activeSky: SkyPreset = DEFAULT_SKY;

// Foreground horizon mist: created up front (empty), textured by applyTheme.
// Drawn OVER the level with depth-test ON, so only geometry farther than the
// dome radius — the far horizon — sits behind it; the walkable level and the
// skater are closer, so they stay in front.
const skyMist = new THREE.Mesh(
  sky.geometry, // radius 370; the mesh follows the camera (see frame())
  new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    fog: false,
  }),
);
skyMist.renderOrder = 6; // after the world
skyMist.frustumCulled = false;
skyMist.visible = false; // until a painting is actually on it
scene.add(skyMist);

const cfgSkyTex = (
  t: THREE.Texture,
  hv = SKY_HORIZON_V,
  unityCoast = false,
): void => {
  t.colorSpace = THREE.SRGBColorSpace;
  if (unityCoast) {
    // Unity's coast shader maps the full painting over 180 degrees, walks it
    // backward over the other half, rotates the join 90 degrees, and applies
    // one fixed latitude offset. Preserve that instead of the old web dome's
    // seam blur and camera-height horizon correction.
    t.wrapS = THREE.MirroredRepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(2, 1);
    t.offset.set(0.25, -0.14450052);
    return;
  }
  // Plain repeat on a made-seamless image (see makeSeamless): a continuous wrap
  // with no hard seam AND — unlike a mirrored wrap — no bilateral fold axis.
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping; // clamp sky above / faded clouds below
  t.repeat.set(SKY_WRAP, SKY_K); // x: integer wrap (seam-free at the dome UV seam); y: vertical framing
  t.offset.set(0, hv - 0.5 * SKY_K); // horizon -> dome equator
};
// The panorama's left and right edges don't match, so tiling it shows a seam.
// A mirrored wrap hides the jump but leaves an obvious reflection axis. Instead
// make the image genuinely tileable: cross-blend a band straddling the wrap so
// both edges converge to the same average at the seam. Plain repeat is then
// continuous with no fold. (Runs once per painting, on load.)
const makeSeamless = (img: HTMLImageElement): HTMLCanvasElement => {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d")!;
  x.drawImage(img, 0, 0);
  const bw = Math.max(1, Math.round(W * 0.09)); // blend band width each side of the seam
  for (let d = 0; d < bw; d++) {
    x.globalAlpha = 0.5 * (1 - d / bw); // 0.5 at the seam, easing to 0 inward
    // pull each edge column toward its partner on the far edge (read from the
    // untouched source, so at the seam both sides become the same average)
    x.drawImage(img, d, 0, 1, H, W - 1 - d, 0, 1, H); // left col -> right band
    x.drawImage(img, W - 1 - d, 0, 1, H, d, 0, 1, H); // right col -> left band
  }
  x.globalAlpha = 1;
  return c;
};
// Build BOTH layers from one painting:
//  1) the dome backdrop (behind the level) — mountains + sky.
//  2) a foreground MIST layer — only the rich stuff BELOW the 600px horizon
//     (cloud sea, lower islands), fading out toward your feet via the
//     painting's own alpha so it never buries anything close.
function buildSkyLayers(img: HTMLImageElement, p: SkyPreset): SkyLayers {
  const W = img.naturalWidth,
    H = img.naturalHeight;
  const hv = presetHorizonV(p);
  const hpx = SKY_PRESETS[p].horizonPx ?? SKY_HORIZON_PX;
  const unityCoast = p === "coast";
  const base = unityCoast
    ? (() => {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        return canvas;
      })()
    : makeSeamless(img); // tileable ONCE, both layers share it
  const bg = new THREE.CanvasTexture(base);
  cfgSkyTex(bg, hv, unityCoast);

  const cFg = document.createElement("canvas");
  cFg.width = W;
  cFg.height = H;
  const fx = cFg.getContext("2d")!;
  fx.drawImage(base, 0, 0);
  const ramp = fx.createLinearGradient(0, 0, 0, H);
  ramp.addColorStop(0, "rgba(0,0,0,1)"); // erase the sky
  ramp.addColorStop((hpx - 30) / H, "rgba(0,0,0,1)");
  ramp.addColorStop(Math.min(1, (hpx + 40) / H), "rgba(0,0,0,0)"); // keep the clouds
  ramp.addColorStop(1, "rgba(0,0,0,0)");
  fx.globalCompositeOperation = "destination-out";
  fx.fillStyle = ramp;
  fx.fillRect(0, 0, W, H);
  fx.globalCompositeOperation = "source-over";
  const mist = new THREE.CanvasTexture(cFg);
  cfgSkyTex(mist, hv, unityCoast); // mist sits at its natural below-horizon position
  return { bg, mist };
}

// Fetch a preset's painting once and cache it. Missing files are remembered as
// missing, so a level authored for a time of day whose art hasn't landed yet
// falls back to the procedural gradient instead of retrying every rebuild.
// seaHorizon presets: depress the painted horizon by the angle down to the
// water at the dome wall, every frame. Both layers ride the same offset.
function updateSeaHorizon(): void {
  const P = SKY_PRESETS[activeSky];
  if (!P.seaHorizon) return;
  if (activeSky === "coast") return; // Unity owns one fixed panorama horizon
  const hv = presetHorizonV(activeSky);
  // Height is CLAMPED: the true angle from the mountain road (430m up) shoved
  // the painting more than half a texture down and the backdrop fell apart.
  // Near the water the formula still pins the painted waterline to the sea
  // exactly; any higher just holds that beach-level framing.
  const drop =
    Math.atan2(Math.min(12, Math.max(0, camera.position.y)), 370) / Math.PI;
  const offY = hv - 0.5 * SKY_K + drop * SKY_K;
  const bg = (sky.material as THREE.MeshBasicMaterial).map;
  if (bg) bg.offset.y = offY;
  const mm = (skyMist.material as THREE.MeshBasicMaterial).map;
  if (mm) mm.offset.y = offY;
}

function loadSky(p: SkyPreset): void {
  if (skyCache.has(p) || skyPending.has(p) || skyMissing.has(p)) return;
  skyPending.add(p);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    skyPending.delete(p);
    skyCache.set(p, buildSkyLayers(img, p));
    // A slow load that lands after the player moved on must not yank the sky
    // out from under the level they're actually looking at.
    if (activeSky === p) applyTheme();
  };
  img.onerror = () => {
    skyPending.delete(p);
    skyMissing.add(p);
    if (activeSky !== p) return;
    applyTheme(); // repaint with the gradient fallback
    // Silently swapping in a gradient reads as "the feature is broken". Say
    // which file is missing instead — once per preset, since loadSky won't
    // retry one it has already given up on.
    ui.showMessage(
      `${p.toUpperCase()} SKY ART MISSING`,
      `add public/${SKY_PRESETS[p].file} — using the painted gradient for now`,
      3600,
    );
  };
  img.src = import.meta.env.BASE_URL + SKY_PRESETS[p].file;
}
loadSky(DEFAULT_SKY);

// --- sky painting ------------------------------------------------------------
// Theme colors arrive as both '#rrggbb' strings and 0xrrggbb numbers; the
// painter mixes everything in plain [r, g, b] so it works for every level
// without touching the theme shape.
type RGB = [number, number, number];
function rgbOf(c: string | number): RGB {
  const n = typeof c === "number" ? c : parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixRGB(a: RGB, b: RGB, k: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}
function css(c: RGB, a = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
// Wrap-safe ridge profile (-1..1): integer-frequency sines only, so each
// silhouette meets itself across the dome's texture seam.
function ridge(u: number, seed: number): number {
  return (
    Math.sin((u * 3 + seed) * Math.PI * 2) * 0.45 +
    Math.sin((u * 7 + seed * 1.7) * Math.PI * 2) * 0.35 +
    Math.sin((u * 13 + seed * 2.9) * Math.PI * 2) * 0.2
  );
}

function makeSkyTexture(t: Level["theme"]): THREE.CanvasTexture {
  const W = 512;
  const H = 512; // taller than the old 256: the horizon band needs the rows
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const top = rgbOf(t.skyTop);
  const bottom = rgbOf(t.skyBottom);
  const fog = rgbOf(t.fog);
  const sunC = t.sunColorHex ? rgbOf(t.sunColorHex) : bottom;
  const white: RGB = [255, 255, 255];

  // Smooth airbrush gradient, skyTop -> skyBottom, warming into the fog as it
  // nears the horizon. Only a whisper of banding survives — an era tell, not
  // a texture.
  const skyH = Math.round(H * 0.58);
  const grad = ctx.createLinearGradient(0, 0, 0, skyH);
  grad.addColorStop(0, css(top));
  grad.addColorStop(0.55, css(mixRGB(top, bottom, 0.5)));
  grad.addColorStop(0.88, css(bottom));
  grad.addColorStop(1, css(mixRGB(bottom, fog, 0.4)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, skyH);
  const BANDS = 6;
  ctx.globalAlpha = 0.045;
  for (let i = 0; i < BANDS; i++) {
    ctx.fillStyle = css(mixRGB(top, bottom, i / (BANDS - 1)));
    ctx.fillRect(
      0,
      Math.round((i / BANDS) * skyH),
      W,
      Math.round(skyH / BANDS),
    );
  }
  ctx.globalAlpha = 1;
  // below the horizon it's all fog — that's what you see going off a cliff
  ctx.fillStyle = css(fog);
  ctx.fillRect(0, skyH, W, H - skyH);

  // Soft-edged radial blob: the one brush the whole sky is painted with.
  const puff = (x: number, y: number, r: number, col: RGB, a: number): void => {
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, css(col, a));
    g.addColorStop(0.6, css(col, a * 0.75));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  if (t.stars) {
    // soft glow dots up high, fading toward the horizon
    for (let i = 0; i < 110; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H * 0.44;
      const r = Math.random() < 0.18 ? 4 : 2.5;
      puff(x, y, r, white, (0.35 + Math.random() * 0.5) * (1 - y / (H * 0.6)));
    }
    // ...and a few hero stars: hot center inside a wide gentle halo
    for (let i = 0; i < 3; i++) {
      const x = 20 + Math.random() * (W - 40);
      const y = H * 0.04 + Math.random() * H * 0.26;
      puff(x, y, 11, white, 0.35);
      puff(x, y, 3, white, 0.95);
    }
  }

  if (t.sunColorHex) {
    // one big soft atmospheric glow with a soft-edged hot core — painted
    // before the ridges so a low sun sets behind them
    const sx = t.sunU * W;
    const sy = t.sunV * H;
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, 185);
    halo.addColorStop(0, css(sunC, 0.65));
    halo.addColorStop(0.3, css(sunC, 0.3));
    halo.addColorStop(1, css(sunC, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    puff(sx, sy, 34, mixRGB(sunC, white, 0.45), 0.85);
    puff(sx, sy, 17, mixRGB(sunC, white, 0.75), 1);
  }

  // rounded cumulus: a shaded belly row with sun-lit crowns stacked on top
  // (kept off the texture seam so the wrap never slices one in half)
  const lit = mixRGB(sunC, white, 0.72);
  const shade = mixRGB(mixRGB(sunC, bottom, 0.5), top, 0.35);
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.14 + Math.random() * 0.72);
    const cy = H * (0.15 + Math.random() * 0.25);
    const cw = 46 + Math.random() * 70;
    const n = 4 + Math.floor(Math.random() * 3);
    for (let p = 0; p < n; p++) {
      const px = cx + (p / (n - 1) - 0.5) * cw;
      puff(px, cy + 3 + Math.random() * 3, 11 + Math.random() * 7, shade, 0.7);
    }
    for (let p = 0; p < n - 1; p++) {
      const px = cx + (p / (n - 1) - 0.5) * cw + cw / (2 * (n - 1));
      puff(px, cy - 6 - Math.random() * 6, 12 + Math.random() * 9, lit, 0.85);
    }
  }

  // three rolling silhouettes easing out of the fog: far ones fog-tinted
  // (atmospheric perspective), near ones darker — painted depth, no steps
  const ridges = [
    { base: 0.5, amp: 15, col: mixRGB(fog, bottom, 0.4), seed: 3.7 },
    { base: 0.525, amp: 24, col: mixRGB(fog, [0, 0, 0], 0.22), seed: 8.1 },
    { base: 0.55, amp: 34, col: mixRGB(fog, [0, 0, 0], 0.42), seed: 5.6 },
  ];
  for (const r of ridges) {
    ctx.fillStyle = css(r.col);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 2) {
      const h = (ridge(x / W, r.seed) * 0.5 + 0.5) * r.amp;
      ctx.lineTo(x, r.base * H - h);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // thin warm haze hugging the horizon: sunlight scattered through the fog,
  // softening the ridge bases into the distance
  const hazeC = mixRGB(mixRGB(sunC, white, 0.2), fog, 0.45);
  const haze = ctx.createLinearGradient(0, H * 0.44, 0, H * 0.58);
  haze.addColorStop(0, css(hazeC, 0));
  haze.addColorStop(0.8, css(hazeC, 0.32));
  haze.addColorStop(1, css(hazeC, 0.12));
  ctx.fillStyle = haze;
  ctx.fillRect(0, Math.round(H * 0.44), W, Math.round(H * 0.14));

  // the whole horizon melts back into the fog at the bottom, so the ridges
  // read as haze, never a hard silhouette edge against the void
  const melt = ctx.createLinearGradient(0, H * 0.56, 0, H * 0.86);
  melt.addColorStop(0, css(fog, 0));
  melt.addColorStop(1, css(fog, 1));
  ctx.fillStyle = melt;
  ctx.fillRect(0, Math.round(H * 0.56), W, H - Math.round(H * 0.56));

  // default LinearFilter: the dome samples smooth, no crisped-up texels
  const tex = new THREE.CanvasTexture(canvas);
  // The canvas is painted in sRGB hex, so it has to be DECODED as sRGB — the
  // paintings already do this via cfgSkyTex. Without it the darks render about
  // three times too bright, which barely showed when this was only the
  // pre-load flash but makes a night sky come out pale grey.
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The editor wants to SEE the whole level — no fog swallowing the far end, no
// draw-distance cull. Entering drops the fog and pushes the far plane way out;
// exiting restores the level's atmosphere. The flag survives edit rebuilds
// (applyTheme runs on every commit), so fog stays off the whole session.
let editorViewActive = false;
let editorPlayFog: THREE.Scene["fog"] = null;
function syncSkyBackdropVisibility(): void {
  const bonusBackdropActive =
    (current.id === "bonus-level" || current.id.startsWith("bonus:")) && !LITE;
  const skyBridgeFogOnly = current.id === "sky" && !editorViewActive;
  const preset = SKY_PRESETS[activeSky] ?? SKY_PRESETS[DEFAULT_SKY];
  sky.visible = !LITE && !bonusBackdropActive && !skyBridgeFogOnly;
  skyMist.visible =
    skyCache.has(activeSky) &&
    !LITE &&
    !preset.seaHorizon &&
    !bonusBackdropActive &&
    !skyBridgeFogOnly;
}
function setEditorView(editing: boolean, changed = false): void {
  editorViewActive = editing;
  syncSkyBackdropVisibility();
  if (editing) {
    // Keep the live atmosphere object intact. The editor only borrows a
    // fog-free, long-distance lens; Editor restores the exact play camera.
    editorPlayFog = scene.fog;
    scene.fog = null;
    camera.far = 12000;
    camera.updateProjectionMatrix();
    return;
  }
  if (changed) applyTheme();
  else {
    scene.fog = editorPlayFog;
    syncSkyBackdropVisibility();
  }
  editorPlayFog = null;
}

let proceduralSky: THREE.CanvasTexture | null = null; // the gradient fallback, ours to dispose
let proceduralSkyKey = "";
let levelPostEnabled = false;

function applyTheme(): void {
  const t = level.theme;
  const P = SKY_PRESETS[level.skyPreset] ?? SKY_PRESETS[DEFAULT_SKY];
  const bonusBackdropActive =
    (current.id === "bonus-level" || current.id.startsWith("bonus:")) && !LITE;
  if (bonusBackdropActive && !bonusParallax.visible)
    bonusParallax.reset(player.pos, loadedLevelId);
  bonusParallax.setVisible(bonusBackdropActive);
  activeSky = level.skyPreset;
  // Sky Bridge is a true whiteout: its distance is the fog-coloured scene
  // background, not a fog-immune painted dome visible behind the last plank.
  // The editor deliberately restores the dome alongside its fog-free lens.
  syncSkyBackdropVisibility();
  levelPostEnabled = level.skyPreset === "coast" && !NO_COAST_POST;
  configureCoastPost(
    levelPostEnabled ||
      (visualTreatmentActivity(visualTreatmentSettings.value).any && !NO_COAST_POST),
  );
  loadSky(activeSky); // no-op once cached or known missing

  // TIME OF DAY drives the atmosphere; the level's theme still colours it.
  // The haze is the preset's, not the level's: the painting's alpha-faded base
  // has to melt into the far distance, and that only works if the world fades
  // to the same colour the horizon band is painted in.
  const fogNear = t.fogNear;
  // ...with a far cap so the deep distance warms into the sky behind the mist
  // without fogging the walkable level (the mist owns the horizon).
  const fogFar = Math.min(t.fogFar, P.fogFarCap);
  // editor view: no fog at all, so distant geometry stays crisp and visible
  scene.fog = editorViewActive ? null : new THREE.Fog(P.fog, fogNear, fogFar);
  scene.background = new THREE.Color(P.fog);
  // per-preset draw distance (the editor owns the far plane while editing)
  if (!editorViewActive) {
    const far = P.farPlane ?? 400;
    if (camera.far !== far) {
      camera.far = far;
      camera.updateProjectionMatrix();
      camera2.far = far;
      camera2.updateProjectionMatrix();
    }
  }

  const tint = (c: THREE.Color, hex: number, k: number): THREE.Color =>
    k > 0 ? c.lerp(new THREE.Color(hex), k) : c;
  // sky light + the ground bounce under it
  hemi.color.set(t.hemiSky);
  tint(hemi.color, P.hemiTint, P.hemiK);
  hemi.groundColor.set(t.hemiGround);
  tint(hemi.groundColor, P.groundTint, P.groundK);
  hemi.intensity = t.hemiI * P.hemiMul;
  // key light: pulled toward the preset's own light colour, then scaled
  sun.color.set(t.sunColor);
  tint(sun.color, P.sunTint, P.sunK);
  sun.intensity = t.sunI * P.sunMul;
  sun.shadow.intensity = activeSky === "coast" ? 0.62 : 1;
  // the counter-light stays a fraction of the sky light so it never competes
  fill.color.set(t.hemiSky);
  tint(fill.color, P.fillTint, P.fillK);
  fill.intensity = hemi.intensity * P.fillMul;

  // THE DOME. A loaded painting wins; otherwise the procedural gradient, painted
  // in the preset's colours so day and night still read right without the art.
  const mat = sky.material as THREE.MeshBasicMaterial;
  const mistMat = skyMist.material as THREE.MeshBasicMaterial;
  const layers = skyCache.get(activeSky);
  if (layers) {
    mat.transparent = true;
    if (mat.map !== layers.bg) {
      mat.map = layers.bg;
      mat.needsUpdate = true;
    }
    if (mistMat.map !== layers.mist) {
      mistMat.map = layers.mist;
      mistMat.needsUpdate = true;
    }
    // seaHorizon presets skip the mist layer: it repaints the below-horizon
    // band IN FRONT of everything past the dome radius, and the coast now
    // draws REAL water out to 1000m that must not be painted over.
    syncSkyBackdropVisibility();
    // cached textures are shared across levels — never dispose them here; only
    // the gradient we painted ourselves is ours to free
    if (proceduralSky) {
      proceduralSky.dispose();
      proceduralSky = null;
      proceduralSkyKey = "";
    }
    return;
  }
  mat.transparent = false;
  skyMist.visible = false; // no painting, no cloud sea to hang in front
  const gradientTheme = {
    ...t,
    skyTop: P.top,
    skyBottom: P.bottom,
    fog: P.fog,
    stars: P.stars,
    // sunset keeps the level's own sun; day swaps in a white noon one; night
    // has none, or the sky ends up with a noon sun blazing in it
    // "" reads falsy in makeSkyTexture, which is its "no disc" test
    sunColorHex: P.sunHex === null ? "" : (P.sunHex ?? t.sunColorHex),
  };
  const gradientKey = JSON.stringify(gradientTheme);
  if (proceduralSky && proceduralSkyKey === gradientKey) {
    if (mat.map !== proceduralSky) {
      mat.map = proceduralSky;
      mat.needsUpdate = true;
    }
    return;
  }
  const grad = makeSkyTexture(gradientTheme);
  mat.map = grad;
  mat.needsUpdate = true;
  if (proceduralSky) proceduralSky.dispose();
  proceduralSky = grad;
  proceduralSkyKey = gradientKey;
}

// Slightly wide lens: exaggerates depth so corridors read longer, while the
// close rig below keeps the skater big in frame. The boulder chase swaps to a
// tighter, telephoto lens (updateCamera lerps toward it) — narrowing the FOV
// compresses depth so the runway lays out flat and readable instead of
// crushing to a foreshortened sliver at the horizon.
const BOULDER_FOV = 27;
const camera = new THREE.PerspectiveCamera(TUNING.camFov, 1, 0.1, 400);
const bonusParallax = createBonusParallax(scene, camera, { visible: false });
// 2P split state (functions live further down, past the player):
let split2p = false;
let p2: Player | null = null;
const input2 = new Input(true); // pad-only: claims its own gamepad, no keyboard/touch
const camera2 = new THREE.PerspectiveCamera(TUNING.camFov, 1, 0.1, 400);
const cam2F = new THREE.Vector3(0, 0, -1);
const cam2LaneCursor = newLaneCursor();
let cam2RenderSnapVersion = -1;
let cam2SpeedFovBoost = 0;
let p2Linked = false; // P2 has claimed a pad (join/loss toasts key off this)
const pvpKicks = new Map<Player, { x: number; z: number; t: number }>();
let coastPost: CoastPostRenderer | null = null;
let renderQualityPanel: RenderQualityPanel | null = null;
let renderQualitySizes: RenderQualitySizes =
  renderQualitySettings.computeSizes(window.innerWidth, window.innerHeight);
function configureCoastPost(enabled: boolean): void {
  if (coastPost) {
    coastPost.setEnabled(enabled);
    syncPostResolution();
    return;
  }
  // The composer is now shared: the coast owns Unity neutral grading/dither,
  // while CRT Guest can remain active on every level. Its heavy render targets
  // are lazy, so retaining this shell also makes live CRT enable/disable and
  // variant changes immediate without rebuilding the renderer.
  coastPost = new CoastPostRenderer(renderer, scene, camera, {
    enabled,
    lite: LITE_RENDER,
    crtSettings: crtGuestSettings,
    resolutionMode: fixedResolutionActive() ? "fixed" : "native",
    inputWidth: renderQualitySizes.inputWidth,
    inputHeight: renderQualitySizes.inputHeight,
    outputWidth: renderQualitySizes.outputWidth,
    outputHeight: renderQualitySizes.outputHeight,
    // Unity operates on actual camera pixels. The browser drawing buffer is
    // the equivalent target, including device pixel ratio.
    pixelRatio: renderer.getPixelRatio(),
    multisample: false,
  });
}

function renderPrimaryScene(
  dt = 0,
  prepareOcean = true,
  preCrtOverlay?: CoastPostPreCrtOverlay,
): void {
  if (prepareOcean) level.water?.renderPasses(renderer, scene, camera);
  if (coastPost) coastPost.render(dt, preCrtOverlay);
  else renderer.render(scene, camera);
}

/**
 * The single-player presentation path, including every game-owned overlay.
 * Developer/tool DOM stays outside this function and therefore remains sharp.
 */
function renderGameplayScene(dt = 0, prepareOcean = true, showHud = true): void {
  // The Canvas HUD mirror follows the desktop 720p typography contract. Phone
  // landscape already has a tuned DOM HUD; sending that through Render/CRT
  // reintroduced desktop sizing and unstable corner distortion.
  const wantsPreCrtHud =
    showHud && !TOUCH_PRESENTATION && !split2p && (coastPost?.active ?? false);
  let overlayRan = false;
  ui.setGameHudComposited(wantsPreCrtHud);
  renderPrimaryScene(
    dt,
    prepareOcean,
    wantsPreCrtHud
      ? (context) => {
          const size = {
            width: context.inputWidth,
            height: context.inputHeight,
          };
          // Preserve the old visual stack: collected fruit behind the 3D
          // counter models, with all 2D HUD furniture on top of both.
          player.drawFlyingFruit(context.renderer, undefined, size);
          ui.drawIcons(context.renderer, dt, size);
          ui.drawGameHud(context.renderer, size, context.target);
          overlayRan = true;
        }
      : undefined,
  );
  if (overlayRan) return;

  // Direct/lite/split fallback: the DOM copy remains visible, while the two
  // pre-existing WebGL overlay helpers still draw over the world.
  ui.setGameHudComposited(false);
  if (!showHud) return;
  player.drawFlyingFruit(renderer);
  ui.drawIcons(renderer, dt);
}

function fixedResolutionActive(): boolean {
  // Split screen owns two scissored cameras and deliberately remains on its
  // direct renderer path until it gets two independent pre-CRT surfaces.
  // Coarse/touch devices use the native-aspect DPR path. Fixed 720p×2 was
  // allocating a 3K-wide target on an 853px phone and was the lead trigger for
  // the mobile HUD composition regression.
  return (
    renderQualitySettings.enabled &&
    !TOUCH_PRESENTATION &&
    !LITE_RENDER &&
    !split2p
  );
}

function syncPostResolution(): void {
  if (!coastPost) return;
  const optimized = fixedResolutionActive();
  coastPost.setResolutionMode(optimized ? "fixed" : "native");
  coastPost.setPixelRatio(renderer.getPixelRatio());
  const rendererSize = renderer.getSize(new THREE.Vector2());
  coastPost.setSize(rendererSize.x, rendererSize.y);
  if (optimized) {
    coastPost.setInputSize(
      renderQualitySizes.inputWidth,
      renderQualitySizes.inputHeight,
    );
    coastPost.setOutputSize(
      renderQualitySizes.outputWidth,
      renderQualitySizes.outputHeight,
    );
  } else {
    coastPost.syncOutputSizeFromRenderer();
  }
}

function resize(): void {
  const w = window.innerWidth;
  let h = window.innerHeight;
  // iOS standalone (home-screen) quirk: the layout viewport stops ABOVE the
  // home indicator and that strip never gets painted — a permanent black bar.
  // The screen knows the true height, so size the page past the viewport to
  // the physical edge (portrait only; --vh feeds the html/body/#app CSS).
  const standalone =
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone && h > w && window.screen.height > h) h = window.screen.height;
  document.documentElement.style.setProperty("--vh", h + "px");
  renderQualitySizes = renderQualitySettings.computeSizes(w, h);
  const optimized = fixedResolutionActive();
  // Optimized mode owns exact physical pixels: the world/post composer renders
  // at inputWidth×inputHeight, while the canvas is the CRT's 1×/2×/3× output.
  // Pixel ratio must be one or the browser would multiply that output again.
  // Native/lite retain the original DPR contract for a trustworthy A/B path.
  renderer.setPixelRatio(
    optimized ? 1 : Math.min(window.devicePixelRatio || 1, 2),
  );
  const nativeScale = LITE_RENDER ? 0.5 : 1;
  const renderW = optimized
    ? renderQualitySizes.outputWidth
    : Math.round(w * nativeScale);
  const renderH = optimized
    ? renderQualitySizes.outputHeight
    : Math.round(h * nativeScale);
  renderer.setSize(renderW, renderH, false);
  syncPostResolution();
  renderQualityPanel?.setMetrics(renderQualitySizes, optimized);
  renderer.domElement.style.imageRendering = "";
  const playAspect = split2p ? w / (h / 2) : w / h;
  // The editor owns the full canvas even when the retained run is split-screen.
  // Its saved play lens tracks resizes separately so closing cannot restore a
  // stale pre-rotation aspect ratio.
  camera.aspect = editorViewActive ? w / h : playAspect;
  camera.updateProjectionMatrix();
  camera2.aspect = playAspect;
  camera2.updateProjectionMatrix();
  if (editorViewActive) editor.syncPlayAspect(playAspect);
}
window.addEventListener("resize", resize);
// iOS standalone launches don't reliably fire 'resize' once the viewport
// settles behind the Dynamic Island / home indicator — catch the stragglers.
window.visualViewport?.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 250));
setTimeout(resize, 400);
setTimeout(resize, 1200);
resize();

const input = new Input();
// Each player's input refuses the other's claimed pad — and P2 additionally
// rejects any slot that mirrors P1's pad (one DualShock on USB + Bluetooth
// at once shows up as TWO slots streaming identical state).
input.rival = input2;
input2.rival = input;
const ui = new UI();
const campaign = new CampaignStore();
let gameAudioOptions: GameAudioOptions = loadGameAudioOptions();
sfx.setMuted(gameAudioOptions);
let gameFlow: GameFlowUI;
const crtGuestPanel = createCrtGuestTuningPanel({
  settings: crtGuestSettings,
  bindToggle: (toggle) => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== "F10" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      )
        return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  },
});
renderQualityPanel = createRenderQualityPanel({
  settings: renderQualitySettings,
});
renderQualityPanel.setMetrics(renderQualitySizes, fixedResolutionActive());
renderQualitySettings.subscribe(() => {
  resetRenderFrameLimiter();
  resize();
});
const skateboardPanel = createSkateboardTuningPanel({
  settings: skateboardSettings,
});
const spinPanel = createSpinTuningPanel({
  settings: spinRingSettings,
  groundedSkateSettings: groundedSkateSpinRingSettings,
});
const visualTreatmentPanel = createVisualTreatmentPanel(
  visualTreatmentSettings,
);
const presentationPanelHosts = [
  crtGuestPanel.element,
  renderQualityPanel.element,
  skateboardPanel.element,
  spinPanel.element,
  visualTreatmentPanel.element,
];
const closePresentationPanels = (): void => {
  crtGuestPanel.close();
  renderQualityPanel?.setOpen(false);
  skateboardPanel.setOpen(false);
  spinPanel.setOpen(false);
  visualTreatmentPanel.setOpen(false);
};
const toggleCharacterTailVisibility = (): void => {
  player.toggleCharacterTailVisibility();
  const state = player.characterTailVisibilityState;
  ui.showMessage(
    'CHARACTER TAIL',
    state.detail,
    1800,
  );
};
if (TOUCH_PRESENTATION) {
  ui.setPresentationTools([
    {
      label: "ANIMATION",
      open: () => {
        closePresentationPanels();
        void openAnimationStudioTool();
      },
    },
    {
      label: "CHARACTER",
      open: () => {
        closePresentationPanels();
        void openCharacterLabTool();
      },
    },
    {
      label: "TAIL",
      open: () => {
        closePresentationPanels();
        toggleCharacterTailVisibility();
      },
    },
    {
      label: "CRT",
      open: () => {
        closePresentationPanels();
        crtGuestPanel.open();
      },
    },
    {
      label: "RENDER",
      open: () => {
        closePresentationPanels();
        renderQualityPanel?.setOpen(true);
      },
    },
    {
      label: "BOARD",
      open: () => {
        closePresentationPanels();
        skateboardPanel.setOpen(true);
      },
    },
    {
      label: "SPIN",
      open: () => {
        closePresentationPanels();
        spinPanel.setOpen(true);
      },
    },
    {
      label: "LOOK",
      open: () => {
        closePresentationPanels();
        visualTreatmentPanel.setOpen(true);
      },
    },
  ]);
  const syncToolPanelState = (): void => {
    document.body.classList.toggle(
      "tool-panel-open",
      presentationPanelHosts.some((host) => host.hasAttribute("data-open")),
    );
  };
  const panelObserver = new MutationObserver(syncToolPanelState);
  for (const host of presentationPanelHosts)
    panelObserver.observe(host, {
      attributes: true,
      attributeFilter: ["data-open"],
    });
  syncToolPanelState();
} else {
  // Character and animation authoring stay reachable in every browser build.
  ui.setPresentationTools([
    {
      label: "ANIMATION",
      open: () => void openAnimationStudioTool(),
    },
    {
      label: "CHARACTER",
      open: () => void openCharacterLabTool(),
    },
    {
      label: "TAIL",
      open: toggleCharacterTailVisibility,
    },
  ]);
}
visualTreatmentSettings.subscribe((value) => {
  configureCoastPost(
    levelPostEnabled || (visualTreatmentActivity(value).any && !NO_COAST_POST),
  );
});
const recorder = new Recorder();
const replayer = new Replayer();
adoptLegacyLevels(); // one-shot: old single-slot edits become real user levels
const oceanReview = new URLSearchParams(window.location.search).has(
  "oceanreview",
);
const oceanOverview = new URLSearchParams(window.location.search).has(
  "oceanoverview",
);
const coastPhysicsReview = new URLSearchParams(window.location.search).has(
  "coastphysics",
);
const shellBypass =
  LITE_RENDER ||
  oceanReview ||
  oceanOverview ||
  coastPhysicsReview ||
  new URLSearchParams(window.location.search).has("playtest") ||
  localStorage.getItem("solProtoEditorOpen") === "1";
ui.setLifeCheatEnabled(shellBypass);
let current: LevelEntry =
  (oceanReview
    ? findLevel("beachfront")
    : coastPhysicsReview
      ? findLevel("descent")
      : null) ??
  findLevel(
    shellBypass
      ? localStorage.getItem("solProtoLevelId") ?? ""
      : "warproom",
  ) ??
  findLevel(DEFAULT_LEVEL_ID)!;
let level: Level;
const initialSceneChildren = new Set(scene.children);
try {
  level = new Level(scene, current);
} catch (error) {
  console.error("Stored level failed to build; loading the safe default.", error);
  for (const child of [...scene.children])
    if (!initialSceneChildren.has(child)) scene.remove(child);
  current = findLevel(DEFAULT_LEVEL_ID)!;
  localStorage.setItem("solProtoLevelId", current.id);
  level = new Level(scene, current);
}
let loadedLevelId = current.id;
let acc = 0;
const frameStats = {
  frame: 0,
  rawDt: 0,
  dt: 0,
  simSteps: 0,
  totalFixedSteps: 0,
  replayFrame: 0,
  accumulator: 0,
  alpha: 0,
  snapVersion: 0,
  simX: 0,
  simY: 0,
  simZ: 0,
  renderX: 0,
  renderY: 0,
  renderZ: 0,
  speed: 0,
  vVel: 0,
  state: "ride",
  grounded: false,
  bailTime: 0,
  bailRecovery: 0,
  specialMeter: 0,
  specialReady: false,
  specialName: null as string | null,
  specialSequence: 0,
  cameraTargetX: 0,
  cameraTargetY: 0,
  cameraTargetZ: 0,
  cameraX: 0,
  cameraY: 0,
  cameraZ: 0,
  cameraFov: TUNING.camFov,
  cameraSpeedFovBoost: 0,
  camera2Fov: TUNING.camFov,
  camera2SpeedFovBoost: 0,
};
const frameProbe = new URLSearchParams(window.location.search).has("frameprobe")
  ? document.createElement("pre")
  : null;
if (frameProbe) {
  frameProbe.id = "frame-probe";
  frameProbe.style.display = "none";
  document.body.appendChild(frameProbe);
}
const crtDiagnosticsProbe = new URLSearchParams(window.location.search).has(
  "crtdiag",
)
  ? document.createElement("pre")
  : null;
if (crtDiagnosticsProbe) {
  crtDiagnosticsProbe.id = "crt-diagnostics";
  crtDiagnosticsProbe.style.display = "none";
  document.body.appendChild(crtDiagnosticsProbe);
}
const renderDiagnosticsProbe = new URLSearchParams(window.location.search).has(
  "renderdiag",
)
  ? document.createElement("pre")
  : null;
const renderDiagnosticsSize = new THREE.Vector2();
if (renderDiagnosticsProbe) {
  renderDiagnosticsProbe.id = "render-diagnostics";
  renderDiagnosticsProbe.style.display = "none";
  document.body.appendChild(renderDiagnosticsProbe);
}
const lookDiagnosticsProbe = new URLSearchParams(window.location.search).has(
  "lookdiag",
)
  ? document.createElement("pre")
  : null;
if (lookDiagnosticsProbe) {
  lookDiagnosticsProbe.id = "look-diagnostics";
  lookDiagnosticsProbe.style.display = "none";
  document.body.appendChild(lookDiagnosticsProbe);
}
let editorSavedAcc: number | null = null;
let editorSavedMessage: ReturnType<UI["captureMessage"]> = null;
// A pristine hand-coded built-in keeps rendering from its exact original
// builder when first opened. Its captured data is built as a hidden,
// raycastable editor proxy; the proxy becomes the real level only after an
// actual mutation. This makes selection possible without a destructive open.
let editorPreviewLevel: Level | null = null;
// PS1 smoke and dust. One system for every soft effect; it owns its own pooled
// buffers and adds a handful of meshes to the scene that outlive level swaps
// (they carry userData.shared, so Level.dispose() leaves them alone).
puffs.attach(scene);
// ?lite is the low-end path everywhere else in this file, so it is here too:
// fewer puffs, simpler rings, no child layers.
puffs.setQuality(LITE_RENDER ? "low" : "high");
// Swirls: the band-based wormhole discs (src/swirls.ts) and the preserved
// sine-field visualizer discs (src/swirlfield.ts) — separate systems.
swirls.attach(scene);
fieldSwirls.attach(scene);
const player = new Player(scene);
const playerAnimationBinding = RigBinding.fromSculptRuntime(
  player.animationRig.root,
  { strict: false },
);
const playerAnimationStarter = createPlayerStarterAnimationSuite(
  playerAnimationBinding.definition,
);
let playerAnimationDocument: AnimationSuiteDocument = playerAnimationStarter;
try {
  const savedAnimationDocument = createLocalDraftStore().load(playerAnimationStarter.id);
  playerAnimationDocument = savedAnimationDocument
    ? reconcilePlayerStarterAnimationSuite(savedAnimationDocument, playerAnimationBinding.definition)
    : playerAnimationStarter;
} catch {
  // Private browsing/storage policy: the source-owned starter suite remains
  // fully usable, but the current session will not resume a previous draft.
}
const characterAnimationRuntime: CharacterAnimationRuntime =
  createCharacterAnimationRuntime(player, playerAnimationDocument);
let p2CharacterAnimationRuntime: CharacterAnimationRuntime | null = null;
try {
  const preferredAnimationDrafts = createPreferredDraftStore();
  void preferredAnimationDrafts
    .load(playerAnimationStarter.id)
    .then((document) => {
      if (!document || animationStudio) return;
      const reconciled = reconcilePlayerStarterAnimationSuite(
        document,
        playerAnimationBinding.definition,
      );
      playerAnimationDocument = reconciled;
      characterAnimationRuntime.setDocument(reconciled);
      p2CharacterAnimationRuntime?.setDocument(reconciled);
    })
    .catch(() => {
      // The synchronous local draft or source starter remains authoritative.
    });
} catch {
  // IndexedDB can be disabled independently of localStorage.
}

// ---- LOCAL 2-PLAYER SPLIT SCREEN (playtest sandbox) ------------------------
// Two pads, two riders in the same world: top half = P1, bottom = P2. They
// collide, stomp, and knock each other over. Time trial + combo runs are
// parked while it's on, and a reset (Share/R on either side) resets both.
// (the split2p/camera2 state lives up beside the main camera — resize() runs
// at module init and reads both)

function tintP2(): void {
  if (!p2) return;
  const apply = (): void =>
    p2!.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const mat of mats as THREE.MeshLambertMaterial[]) {
        if (!mat.color || mat.userData.p2Tint) continue;
        mat.userData.p2Tint = true;
        mat.color.lerp(new THREE.Color(0x508cff), 0.38); // P2 reads blue at a glance
      }
    });
  apply();
  // the GLB body streams in async — keep tinting until it has all arrived
  setTimeout(apply, 1200);
  setTimeout(apply, 3000);
  setTimeout(apply, 6000);
}

// RUN MODES: the time trial and the combo run. Both start by walking into a
// pickup that sits near the spawn, which is exactly wrong when you are testing
// plain platforming — hence the MENU switch. Split-screen forces them off too:
// they are single-player modes.
// Called on every level load and whenever either input to it changes, so the
// world, the player and the button label can never disagree.
let runModesOn = localStorage.getItem("solProtoRunModes") !== "off";
let endlessDeathsOn = localStorage.getItem("solProtoEndlessDeaths") === "on";
let replaySavedEndlessDeaths: boolean | null = null;
function applyEndlessDeaths(): void {
  const active = shellBypass && endlessDeathsOn;
  player.endlessDeaths = active;
  if (p2) p2.endlessDeaths = active;
  ui.setEndlessDeaths(active);
}
function restoreReplayRunRule(): void {
  if (replaySavedEndlessDeaths === null) return;
  endlessDeathsOn = replaySavedEndlessDeaths;
  replaySavedEndlessDeaths = null;
  applyEndlessDeaths();
}
function applyRunModes(): void {
  // Editor previews show every authored activator even when the gameplay
  // preference (or split-screen) normally hides run modes. The sim is frozen,
  // so visibility cannot accidentally start one.
  const campaignUnlocked =
    shellBypass ||
    !isCampaignLevel(current.id) ||
    campaign.runModesUnlocked(current.id);
  const campaignRunModesOn = shellBypass ? runModesOn : true;
  const on =
    editorViewActive ||
    (campaignRunModesOn &&
      campaignUnlocked &&
      !split2p &&
      level.hudMode === "standard");
  level.setRunModesEnabled(on);
  ui.setRunModes(campaignRunModesOn && campaignUnlocked);
  if (on) return;
  // switching off mid-run cancels it rather than freezing a live clock on screen
  level.setTimeTrial(false);
  level.setComboRun(false);
  player.ttActive = false;
  player.comboRun = false;
  if (p2) {
    p2.ttActive = false;
    p2.comboRun = false;
  }
  ui.setTimeTrial(false);
  ui.comboHalo("off");
  ui.setRunRows(false);
}

function set2P(on: boolean, force = false): void {
  if (on === split2p) return;
  if (on) {
    const pads = navigator.getGamepads
      ? Array.from(navigator.getGamepads()).filter((g) => g && g.connected)
      : [];
    if (!force && pads.length < 2) {
      ui.showMessage(
        "NEED 2 CONTROLLERS",
        `${pads.length} connected — wake pad 2 with a button press`,
        2800,
      );
      return;
    }
    if (editor.active) closeEditorToPlay();
    if (replayer.active) {
      replayer.end();
      restoreReplayRunRule();
      ui.setReplayBadge(false);
    }
    if (!p2) {
      p2 = new Player(scene);
      p2CharacterAnimationRuntime = createCharacterAnimationRuntime(
        p2,
        playerAnimationDocument,
      );
      p2.endlessDeaths = endlessDeathsOn;
      // The second rider's fruit needs the same two wires P1 got, or its
      // collected wumpa are parked on a scene nothing renders and simply
      // vanish. Its own lens; the one shared HUD counter.
      p2.cam = camera2;
      p2.hudFruitAt = () => ui.fruitIconAt();
      p2.onTrickGateBlocked = (trick) => {
        const info = deckTrickInfo(trick);
        ui.showMessage(`P2 · ${info.label.toUpperCase()} REQUIRED`, info.hint, 1800);
      };
      tintP2();
    }
    p2.group.visible = true;
    split2p = true;
    // P1 = lowest connected slot; P2 claims itself on its first press. Slot
    // NUMBERS can't be trusted (a USB+Bluetooth pad registers twice), so the
    // second rider waits for a provably-different device to speak up.
    input.releaseClaim();
    input.claimedSlot = pads.length ? pads[0]!.index : null;
    input2.releaseClaim();
    p2Linked = false;
    player.respawn(level, true);
    p2.respawn(level, true);
    p2.pos.x += 1.6; // side by side at the start line
    p2.snapRenderInterpolation();
    applyRunModes();
    ui.set2P(true);
    ui.showMessage(
      "2-PLAYER SPLIT",
      "P2 (blue, bottom): press ✕ on the OTHER pad to join",
      4200,
    );
  } else {
    split2p = false;
    if (p2) {
      level.clearTrickPrimitiveSource(p2);
      p2.group.visible = false;
    }
    // release both so the 1P scan is free to take any pad again
    input.releaseClaim();
    input2.releaseClaim();
    ui.set2P(false);
    ui.showMessage("1-PLAYER", "", 1200);
  }
  resize();
}

// PvP: stomps bounce the attacker and flatten the victim; spins, slides and
// slams bowl the other rider over; bodies never share a spot. Playtest rules:
// no damage, no score — the knockdown (bail tumble + a shove) IS the payoff.
function pvpAttack(atk: Player, vic: Player): void {
  const A = atk as unknown as Record<string, number & boolean>;
  if (vic.state === "dead" || vic.state === "gameover" || atk.state === "dead")
    return;
  const dx = vic.pos.x - atk.pos.x;
  const dz = vic.pos.z - atk.pos.z;
  const planar = Math.hypot(dx, dz);
  const ux = planar > 1e-4 ? dx / planar : 1;
  const uz = planar > 1e-4 ? dz / planar : 0;
  const dy = vic.pos.y - atk.pos.y;
  const knock = (kick: number, pop: number): void => {
    if (!vic.beginPvpKnockdown(pop, Math.sign(ux || uz || 1))) return;
    pvpKicks.set(vic, { x: ux * kick, z: uz * kick, t: 0.3 });
    sfx.play("takeDamage", 0.55);
  };
  if ((A.vVel as number) < -2 && dy < -0.9 && dy > -2.3 && planar < 0.9) {
    // STOMP: bounce off their shoulders, they eat deck
    knock(5, 2.5);
    (A.vVel as number) = TUNING.crateBounce * 0.8;
    atk.state = "air";
    (A.grounded as boolean) = false;
    sfx.play("crateBounce", 0.6);
    return;
  }
  if (Math.abs(dy) > 1.7) return;
  if (A.spinning as boolean) {
    if (planar < 1.8) knock(11, 4.5);
  } else if (A.sliding as boolean) {
    if (planar < 1.2) knock(9, 4);
  } else if (A.slamActive as boolean) {
    if (planar < TUNING.slamRadius) knock(10, 5);
  }
}

function stepPvp(dt: number): void {
  if (!p2) return;
  pvpAttack(player, p2);
  pvpAttack(p2, player);
  const dx = p2.pos.x - player.pos.x;
  const dz = p2.pos.z - player.pos.z;
  const dy = Math.abs(p2.pos.y - player.pos.y);
  const d = Math.hypot(dx, dz);
  if (d > 1e-4 && d < 0.9 && dy < 1.7) {
    const push = (0.9 - d) / 2;
    player.pos.x -= (dx / d) * push;
    player.pos.z -= (dz / d) * push;
    p2.pos.x += (dx / d) * push;
    p2.pos.z += (dz / d) * push;
  }
  for (const kick of pvpKicks.values()) {
    if (kick.t <= 0) continue;
    kick.t -= dt;
  }
  for (const [pl, kick] of pvpKicks) {
    if (kick.t > 0) {
      pl.pos.x += kick.x * dt;
      pl.pos.z += kick.z * dt;
    }
  }
}

// P2's rig: a light follow cam (lane-aware forward, ground-agnostic) — the
// full Crash rig belongs to P1; this one just keeps P2 framed and onward.
function updateCamera2(dt: number): void {
  if (!p2) return;
  const subject = p2.renderPosition;
  const snapped = cam2RenderSnapVersion !== p2.renderSnapVersion;
  if (snapped) {
    cam2RenderSnapVersion = p2.renderSnapVersion;
    cam2LaneCursor.s = -1;
  }
  const fixedReviewShot =
    current.id === "beachfront" && (oceanOverview || oceanReview);
  const p2SkateSpeed = p2.cameraSkateSpeed;
  const p2FovGoal = speedSkateFovTarget(
    p2SkateSpeed,
    p2SkateSpeed > 0 && !level.boulder && !fixedReviewShot,
    TUNING.cruiseSpeed,
    TUNING.maxSpeed,
    TUNING.camSpeedFovBoost,
  );
  cam2SpeedFovBoost = stepSpeedSkateFov(
    cam2SpeedFovBoost,
    p2FovGoal,
    dt,
    snapped,
  );
  const p2AuthoredFov = current.id === "beachfront" ? 43 : TUNING.camFov;
  const p2TargetFov = THREE.MathUtils.lerp(
    p2AuthoredFov + cam2SpeedFovBoost,
    BOULDER_FOV,
    boulderF,
  );
  if (
    Math.abs(camera2.fov - p2TargetFov) > 0.005 ||
    camera2.aspect !== camera.aspect
  ) {
    camera2.fov = p2TargetFov;
    camera2.aspect = camera.aspect;
    camera2.updateProjectionMatrix();
  }
  const lf = level.laneDirAt(
    subject.x,
    subject.y,
    subject.z,
    cam2LaneCursor,
  ) ?? { x: 0, z: -1 };
  const turn = snapped ? 1 : Math.min(1, 3.5 * dt);
  cam2F.x += (lf.x - cam2F.x) * turn;
  cam2F.z += (lf.z - cam2F.z) * turn;
  cam2F.y = 0;
  if (cam2F.lengthSq() < 1e-4) cam2F.set(0, 0, -1);
  cam2F.normalize();
  const tx = subject.x - cam2F.x * TUNING.camDist;
  const tz = subject.z - cam2F.z * TUNING.camDist;
  const ty = subject.y + TUNING.camHeight * 0.85;
  const k = snapped ? 1 : Math.min(1, 9 * dt);
  camera2.position.x += (tx - camera2.position.x) * k;
  camera2.position.y += (ty - camera2.position.y) * k;
  camera2.position.z += (tz - camera2.position.z) * k;
  camera2.lookAt(
    subject.x + cam2F.x * 3,
    subject.y + 1.2,
    subject.z + cam2F.z * 3,
  );
  p2.camDir.set(cam2F.x, 0, cam2F.z);
}
player.cam = camera; // collected wumpa fly to the HUD counter — the flight needs the lens
// ...and it needs to know where the counter IS. Read live off the icon's own
// box rather than a guessed corner: the HUD is sized in vh and the counter
// hides entirely during a run mode.
player.hudFruitAt = () => ui.fruitIconAt();
if (shellBypass) campaign.startEphemeral();
player.enterLevel(current.id);
player.hubMode = current.id === "warproom";
applyEndlessDeaths();
player.respawn(level, true);
applyRunModes(); // the saved MENU switch decides whether the pickups are there
applyTheme();
applyShadowFlags();
recorder.start(current.id, endlessDeathsOn); // the take always runs: level load -> now

gameFlow = new GameFlowUI(
  campaign,
  {
    onNewGame: startNewCampaign,
    onLoadGame: loadCampaign,
    onResume: resumeFromPause,
    onRestart: restartCurrentRun,
    onQuitLevel: quitCurrentLevel,
    onGameOverRetry: retryAfterGameOver,
    onGameOverQuit: quitAfterGameOver,
    onResultsRetry: retryFromResults,
    onResultsContinue: continueFromResults,
    onAudioOptions: applyGameAudioOptions,
  },
  gameAudioOptions,
);
ui.setLevel(
  current.id,
  level.hudMode,
  player.fruitCollectionRevision,
  input.inventoryHeld,
);
ui.setHUD(currentHudState(), 0);
gameFlow.setWarpRoom(current.id === "warproom");
if (shellBypass) gameFlow.hide();
else gameFlow.showLaunch();

// Every solid mesh in the world both casts and receives. It's a whole-scene
// traverse rather than per-builder flags because the builders are hundreds of
// call sites and a missed one reads as a hole in the lighting. Things that are
// not surfaces opt out with userData.noShadow: the sky dome, the water/lava
// planes, the blob shadow and landing X, particle sprites, editor ghosts.
function applyShadowFlags(root: THREE.Object3D = scene): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let skip = false;
    let n: THREE.Object3D | null = m;
    while (n) {
      if (n.userData.noShadow || n.userData.editorGhost) skip = true;
      n = n.parent;
    }
    const mat = m.material as THREE.Material | THREE.Material[];
    const one = Array.isArray(mat) ? mat[0] : mat;
    // Unlit basic materials are effects (glows, markers, sky), not surfaces.
    if (one && (one as THREE.MeshBasicMaterial).isMeshBasicMaterial)
      skip = true;
    m.castShadow = !skip;
    m.receiveShadow = !skip;
  });
}

interface BonusSession {
  parentLevel: Level;
  parentEntry: LevelEntry;
  parentState: PlayerRunState;
  returnPoint: THREE.Vector3;
  parentFruit: PlayerWorldFruitSnapshot[];
}

let bonusSession: BonusSession | null = null;
let resultsCameraActive = false;
let currentRunBonusBoxes = 0;
let runStartRewards = {
  crystal: false,
  boxGem: false,
  comboGem: false,
  timeRelic: false,
};
let pendingCompletion:
  | { kind: "normal" | "time" | "bonus"; time: number }
  | null = null;

function adoptCommittedCampaignProgress(levelId: string): void {
  const progress = campaign.levelProgress(levelId);
  if (!progress) {
    currentRunBonusBoxes = 0;
    runStartRewards = {
      crystal: false,
      boxGem: false,
      comboGem: false,
      timeRelic: false,
    };
    return;
  }
  player.setCampaignRelics({
    crystal: progress.crystal,
    gem: progress.boxGem,
    combo: progress.comboGem,
  });
  level.setBonusPlatformLocked(false);
  currentRunBonusBoxes = 0;
  player.bonusCrates = 0;
  runStartRewards = {
    crystal: progress.crystal,
    boxGem: progress.boxGem,
    comboGem: progress.comboGem,
    timeRelic: progress.timeRelic,
  };
}

function switchLevel(
  id: string,
  preserveEditor = false,
  preserveInventory = false,
): void {
  if (bonusSession) discardSuspendedBonus();
  // An id that no longer exists — a deleted user level, a replay or saved
  // editor target from an older list — resolves to the default course rather
  // than taking the whole game down on entry.name.toUpperCase().
  const campaignTarget = campaignLevelById(id);
  const entry =
    findLevel(id) ??
    (campaignTarget?.fallbackLevelId
      ? findLevel(campaignTarget.fallbackLevelId)
      : null) ??
    findLevel(DEFAULT_LEVEL_ID)!;
  current = entry;
  localStorage.setItem("solProtoLevelId", entry.id);
  if (replayer.active) {
    // a manual level switch cancels a running replay (and restores tuning)
    replayer.end();
    restoreReplayRunRule();
    ui.setReplayBadge(false);
  }
  // Gameplay/replay switches always close the editor, even for the same id.
  // The sole exception is the editor's own duplicate/import retarget flow.
  if (editor.active && !preserveEditor) {
    editor.exit();
    editorSavedAcc = null;
    editorSavedMessage = null;
  }
  if (editorPreviewLevel) {
    editorPreviewLevel.dispose(level);
    editorPreviewLevel = null;
  }
  level.dispose();
  puffs.clear(); // no cloud from the level you just left hanging over the new one
  swirls.clear();
  fieldSwirls.clear();
  level = new Level(scene, entry);
  loadedLevelId = entry.id;
  puffs.attach(scene);
  // Adopt the target level's relic shelf BEFORE respawning, so the run just
  // left banks its crystal and gems against the level they were earned in.
  player.enterLevel(entry.id);
  player.bonusMode = false;
  player.hubMode = entry.id === "warproom";
  currentRunBonusBoxes = 0;
  player.respawn(level, true, preserveInventory);
  adoptCommittedCampaignProgress(entry.id);
  if (split2p && p2) {
    p2.enterLevel(entry.id);
    p2.respawn(level, true);
    p2.pos.x += 1.6;
    p2.snapRenderInterpolation();
  }
  applyRunModes(); // the new level's pickups obey the switch too
  applyTheme();
  applyShadowFlags();
  ui.setLevel(
    entry.id,
    level.hudMode,
    player.fruitCollectionRevision,
    input.inventoryHeld,
  );
  ui.setHUD(currentHudState(), 0);
  const campaignName = campaignLevelById(entry.id)?.name ?? entry.name;
  ui.showMessage(campaignName.toUpperCase(), "", 1400);
  resultsCameraActive = false;
  gameFlow?.setWarpRoom(entry.id === "warproom");
  recorder.start(entry.id, endlessDeathsOn); // fresh take from this load
  (window as unknown as Record<string, unknown>).__game &&
    ((
      (window as unknown as Record<string, unknown>).__game as Record<
        string,
        unknown
      >
    ).level = level);
  if (preserveEditor) editor.onLevelRebuilt();
}

function currentCampaignName(): string {
  if (bonusSession)
    return `${campaignLevelById(bonusSession.parentEntry.id)?.name ?? bonusSession.parentEntry.name} Bonus`;
  return campaignLevelById(current.id)?.name ?? current.name;
}

function applyGameAudioOptions(options: GameAudioOptions): void {
  gameAudioOptions = { ...options };
  saveGameAudioOptions(gameAudioOptions);
  sfx.setMuted(gameAudioOptions);
}

function guardGameplayFromMenu(): void {
  input.armMenuReleaseGuard();
  if (split2p) input2.armMenuReleaseGuard();
}

function startNewCampaign(slot: number): void {
  guardGameplayFromMenu();
  void gameFlow.transition(() => {
    const save = campaign.newGame(slot);
    player.lives = save.lives;
    player.fruit = save.fruit;
    switchLevel("warproom", false, true);
    gameFlow.hide();
  });
}

function loadCampaign(slot: number): void {
  guardGameplayFromMenu();
  void gameFlow.transition(() => {
    const save = campaign.load(slot);
    if (!save) return;
    player.lives = save.lives;
    player.fruit = save.fruit;
    switchLevel("warproom", false, true);
    gameFlow.hide();
  });
}

function resumeFromPause(): void {
  paused = false;
  gameFlow.hide();
  ui.hideMessage();
  input.armMenuReleaseGuard();
  if (split2p) input2.armMenuReleaseGuard();
}

function restoreCommittedRunRewards(): void {
  const levelId = bonusSession?.parentEntry.id ?? current.id;
  const progress = campaign.levelProgress(levelId);
  if (!progress) return;
  player.setCampaignRelics({
    crystal: progress.crystal,
    gem: progress.boxGem,
    combo: progress.comboGem,
  });
}

function restartCurrentRun(): void {
  guardGameplayFromMenu();
  if (!bonusSession) player.bankFlyingFruit();
  void gameFlow.transition(() => {
    paused = false;
    if (bonusSession) {
      player.lives = bonusSession.parentState.lives;
      player.fruit = bonusSession.parentState.fruit;
      restoreCommittedRunRewards();
      discardSuspendedBonus();
      puffs.clear();
      swirls.clear();
      fieldSwirls.clear();
      puffs.attach(scene);
      player.respawn(level, true, true);
      adoptCommittedCampaignProgress(current.id);
      applyRunModes();
      applyTheme();
      applyShadowFlags();
      ui.setLevel(
        current.id,
        level.hudMode,
        player.fruitCollectionRevision,
        input.inventoryHeld,
      );
      ui.setHUD(currentHudState(), 0);
      recorder.start(current.id, endlessDeathsOn);
      gameFlow.setWarpRoom(false);
    } else {
      restoreCommittedRunRewards();
      player.respawn(level, true, true);
      adoptCommittedCampaignProgress(current.id);
      applyRunModes();
      ui.setHUD(currentHudState(), 0);
    }
    gameFlow.hide();
  });
}

function discardSuspendedBonus(): void {
  const session = bonusSession;
  if (!session) return;
  const bonusLevel = level;
  bonusSession = null;
  bonusLevel.dispose(session.parentLevel);
  session.parentLevel.setActive(true);
  level = session.parentLevel;
  current = session.parentEntry;
  loadedLevelId = current.id;
  player.bonusMode = false;
}

function quitCurrentLevel(): void {
  guardGameplayFromMenu();
  if (!bonusSession) player.bankFlyingFruit();
  if (bonusSession) {
    player.lives = bonusSession.parentState.lives;
    player.fruit = bonusSession.parentState.fruit;
  }
  campaign.updateInventory(player.lives, player.fruit);
  restoreCommittedRunRewards();
  void gameFlow.transition(() => {
    paused = false;
    if (bonusSession) discardSuspendedBonus();
    switchLevel("warproom", false, true);
    gameFlow.hide();
  });
}

function retryAfterGameOver(): void {
  guardGameplayFromMenu();
  campaign.resetInventory();
  player.lives = DEFAULT_CAMPAIGN_LIVES;
  player.fruit = 0;
  restoreCommittedRunRewards();
  void gameFlow.transition(() => {
    paused = false;
    player.respawn(level, true);
    adoptCommittedCampaignProgress(current.id);
    applyRunModes();
    ui.showDeathScreen(false);
    ui.deathFade(false);
    gameFlow.hide();
  });
}

function quitAfterGameOver(): void {
  guardGameplayFromMenu();
  campaign.resetInventory();
  player.lives = DEFAULT_CAMPAIGN_LIVES;
  player.fruit = 0;
  restoreCommittedRunRewards();
  void gameFlow.transition(() => {
    paused = false;
    switchLevel("warproom", false, true);
    ui.showDeathScreen(false);
    gameFlow.hide();
  });
}

function retryFromResults(): void {
  guardGameplayFromMenu();
  campaign.updateInventory(player.lives, player.fruit);
  void gameFlow.transition(() => {
    resultsCameraActive = false;
    switchLevel(current.id, false, true);
    gameFlow.hide();
  });
}

function continueFromResults(): void {
  guardGameplayFromMenu();
  campaign.updateInventory(player.lives, player.fruit);
  void gameFlow.transition(() => {
    resultsCameraActive = false;
    switchLevel("warproom", false, true);
    gameFlow.hide();
  });
}

function showCampaignResults(time: number, timeRelic = false): void {
  player.bankFlyingFruit();
  const definition = campaignLevelById(current.id);
  if (!definition) {
    ui.showMessage(
      "COURSE CLEAR!",
      `time ${time.toFixed(2)}s — press R / Options to go again`,
      0,
    );
    return;
  }
  const before = campaign.levelProgress(current.id);
  const firstClear = !before?.cleared;
  const boxes = player.cratesBroken + (level.runMode ? 0 : player.bonusCrates);
  if (!level.runMode && level.totalCrates > 0 && boxes >= level.totalCrates)
    player.gemEarned = true;
  campaign.commitClear(current.id, {
    crystal: player.hasCrystal,
    boxGem: player.gemEarned,
    comboGem: player.comboGemEarned,
    timeRelic,
    time,
  });
  campaign.updateInventory(player.lives, player.fruit);
  const result: ResultsScreenState = {
    levelName: definition.name,
    time,
    boxes,
    totalBoxes: level.totalCrates,
    crystal: player.hasCrystal && !runStartRewards.crystal,
    boxGem: player.gemEarned && !runStartRewards.boxGem,
    comboGem: player.comboGemEarned && !runStartRewards.comboGem,
    timeRelic: timeRelic && !runStartRewards.timeRelic,
    firstClear,
  };
  void gameFlow.transition(() => {
    ui.hideMessage();
    ui.hideTTResults();
    player.prepareResultsPose(level);
    resultsCameraActive = true;
    gameFlow.showResults(result);
  });
}

function enterCampaignLevel(targetId: string): void {
  if (!campaignLevelById(targetId)) return;
  campaign.updateInventory(player.lives, player.fruit);
  void gameFlow.transition(() => {
    switchLevel(targetId, false, true);
    gameFlow.hide();
  });
}

function enterBonusRound(): void {
  if (bonusSession || !isCampaignLevel(current.id)) return;
  player.bankFlyingFruit();
  const parentEntry = current;
  const parentLevel = level;
  const parentState = player.captureRunState();
  const parentFruit = player.captureIdleFruit();
  const returnPoint = parentLevel.bonusReturnPoint();
  void gameFlow.transition(() => {
    bonusSession = {
      parentLevel,
      parentEntry,
      parentState,
      returnPoint,
      parentFruit,
    };
    parentLevel.setActive(false);
    puffs.clear();
    swirls.clear();
    fieldSwirls.clear();
    const parentName = campaignLevelById(parentEntry.id)?.name ?? parentEntry.name;
    current = {
      id: `bonus:${parentEntry.id}`,
      name: `${parentName} Bonus`,
      data: BONUS_LEVEL,
    };
    level = new Level(scene, current);
    loadedLevelId = current.id;
    puffs.attach(scene);
    player.respawn(level, true, true);
    player.bonusMode = true;
    player.hubMode = false;
    player.bonusCrates = 0;
    applyRunModes();
    applyTheme();
    applyShadowFlags();
    ui.setLevel(
      current.id,
      level.hudMode,
      player.fruitCollectionRevision,
      input.inventoryHeld,
    );
    ui.setHUD(currentHudState(), 0);
    ui.showMessage("BONUS ROUND!", "break every box — falls return you safely", 2000);
    recorder.start(current.id, endlessDeathsOn);
    gameFlow.setWarpRoom(false);
    gameFlow.hide();
  });
}

function returnFromBonus(completed: boolean): void {
  const session = bonusSession;
  if (!session) return;
  const bonusLevel = level;
  if (completed) player.bankFlyingFruit();
  const bonusBoxes = completed ? Math.min(bonusLevel.totalCrates, player.cratesBroken) : 0;
  const state: PlayerRunState = {
    ...session.parentState,
    lives: completed ? player.lives : session.parentState.lives,
    fruit: completed ? player.fruit : session.parentState.fruit,
    bonusCrates: completed ? bonusBoxes : session.parentState.bonusCrates,
  };
  void gameFlow.transition(() => {
    bonusSession = null;
    bonusLevel.dispose(session.parentLevel);
    session.parentLevel.setActive(true);
    current = session.parentEntry;
    level = session.parentLevel;
    loadedLevelId = current.id;
    puffs.clear();
    puffs.attach(scene);
    if (completed) {
      currentRunBonusBoxes = bonusBoxes;
    }
    player.resumeSuspendedLevel(level, session.returnPoint, state);
    player.hubMode = false;
    player.restoreIdleFruit(session.parentFruit);
    if (completed) {
      level.setBonusPlatformLocked(true);
      campaign.updateInventory(state.lives, state.fruit);
    }
    applyRunModes();
    applyTheme();
    applyShadowFlags();
    ui.setLevel(
      current.id,
      level.hudMode,
      player.fruitCollectionRevision,
      input.inventoryHeld,
    );
    ui.setHUD(currentHudState(), 0);
    ui.showMessage(
      completed ? "BONUS COMPLETE!" : "BONUS MISSED",
      completed ? `${bonusBoxes} boxes banked` : "back to the bonus platform",
      1900,
    );
    recorder.start(current.id, endlessDeathsOn);
    gameFlow.hide();
  });
}

function checkCampaignEntrances(): void {
  if (gameFlow.blocksGameplay || paused || editor.active || player.state === "dead" || player.state === "gameover" || player.state === "finished")
    return;
  if (current.id === "warproom") {
    const target = level.campaignPortalAt(player.pos);
    if (target) enterCampaignLevel(target);
    return;
  }
  if (
    !bonusSession &&
    isCampaignLevel(current.id) &&
    !player.ttActive &&
    !player.comboRun &&
    player.grounded &&
    level.bonusPlatformAt(player.pos)
  )
    enterBonusRound();
}

function flushPendingCompletion(): void {
  const completion = pendingCompletion;
  if (!completion) return;
  pendingCompletion = null;
  if (completion.kind === "bonus") {
    returnFromBonus(true);
    return;
  }
  if (completion.kind === "time") {
    recordTT(current.id, completion.time);
    ui.setTimeTrial(false);
    const target = campaignLevelById(current.id)?.relicTime;
    showCampaignResults(
      completion.time,
      target !== undefined && completion.time <= target,
    );
    return;
  }
  showCampaignResults(completion.time);
}

function updateResultsCamera(): void {
  const focus = player.pos;
  camera.fov = 34;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.position.set(focus.x, focus.y + 1.65, focus.z - 5.6);
  camera.lookAt(focus.x + 1.15, focus.y + 1.1, focus.z);
  camera.updateProjectionMatrix();
}

// ---- level editor ----------------------------------------------------------
// A live edit rebuilds from the editor's in-memory source, so edit = play
// truth. A no-op session instead keeps the exact original Level alive and uses
// an unbatched proxy only for picking/guides.
function tryBuildEditorLevel(entry: LevelEntry, context: string): Level | null {
  const safeData = entry.data
    ? normalizeCustomLevelData(entry.data)
    : undefined;
  if (entry.data && !safeData) {
    ui.showMessage(
      "EDITOR BUILD REJECTED",
      `${context} · values or geometry exceed safe authoring limits`,
      3200,
    );
    return null;
  }
  const safeEntry = safeData ? { ...entry, data: safeData } : entry;
  const before = new Set(scene.children);
  const nativeRandom = Math.random;
  let seed = 0x811c9dc5;
  const seedText = `${entry.id}:${entry.name}:${entry.data?.components.length ?? 0}`;
  for (let index = 0; index < seedText.length; index++) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 0x01000193);
  }
  Math.random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return new Level(scene, safeEntry);
  } catch (error) {
    // A constructor may have attached its root before a later component
    // failed. Remove every orphan it introduced; the last good Level remains
    // mounted and authoritative.
    for (const child of [...scene.children])
      if (!before.has(child)) scene.remove(child);
    const detail = error instanceof Error ? error.message : "invalid level data";
    ui.showMessage("EDITOR BUILD FAILED", `${context} · ${detail}`, 3200);
    return null;
  } finally {
    Math.random = nativeRandom;
  }
}

function maskInitialEditorProxy(preview: Level): void {
  const originalVisible = new Map<number, boolean>();
  const materialUse = new Map<THREE.Material, number>();
  preview.pickRoot.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials)
      materialUse.set(material, (materialUse.get(material) ?? 0) + 1);
  });
  for (const child of level.pickRoot.children) {
    const index = child.userData.editorIdx as number | undefined;
    if (index === undefined) continue;
    const visible = child.visible;
    originalVisible.set(index, (originalVisible.get(index) ?? false) || visible);
  }
  for (const child of preview.pickRoot.children) {
    let hasGhost = false;
    child.traverse((object) => {
      if (object.userData.editorGhost) hasGhost = true;
    });
    const index = child.userData.editorIdx as number | undefined;
    const missingFromLiveView =
      index !== undefined && originalVisible.get(index) === false;
    if (!hasGhost && !missingFromLiveView) {
      child.visible = false;
      continue;
    }
    child.traverse((object) => {
      if (object.userData.editorGhost) return;
      const renderable = object as THREE.Object3D & {
        isMesh?: boolean;
        isLine?: boolean;
        isPoints?: boolean;
        isSprite?: boolean;
        isLight?: boolean;
      };
      if (missingFromLiveView && renderable.isMesh) {
        const mesh = object as THREE.Mesh;
        const previousMaterials = Array.isArray(mesh.material)
          ? mesh.material
          : mesh.material
            ? [mesh.material]
            : [];
        const materials = Array.isArray(mesh.material)
          ? previousMaterials.map((material) => material.clone())
          : previousMaterials[0]
            ? previousMaterials[0].clone()
            : null;
        if (materials) {
          mesh.material = materials;
          for (const material of Array.isArray(materials)
            ? materials
            : [materials]) {
            // Material.clone() copies userData. This wrapper belongs only to
            // the disposable editor proxy even when its source wrapper (and
            // still-shared texture) came from the process-wide Wumpa pool.
            delete material.userData.shared;
            material.transparent = true;
            material.opacity = Math.min(material.opacity, 0.32);
            material.depthWrite = false;
          }
          // Material.dispose does not own/dispose its texture slots; clones
          // retain those references and the detached wrappers can go now.
          for (const material of previousMaterials) {
            const left = (materialUse.get(material) ?? 1) - 1;
            materialUse.set(material, left);
            if (left === 0 && !material.userData.shared) material.dispose();
          }
        }
        return;
      }
      if (
        renderable.isMesh ||
        renderable.isLine ||
        renderable.isPoints ||
        renderable.isSprite ||
        renderable.isLight
      )
        object.visible = false;
    });
  }
}

function rebuildEditorPreview(): void {
  const working = editor.workingEntry();
  if (!working) return;
  setEditorBuild(true);
  const candidate = tryBuildEditorLevel(working, "working preview kept last good build");
  if (!candidate) return;
  if (editorPreviewLevel) editorPreviewLevel.dispose(level);
  editorPreviewLevel = candidate;
  // A real in-progress mutation is shown from the working build, but the
  // exact original object remains alive underneath for cancel/no-op restore.
  level.pickRoot.visible = false;
  editorPreviewLevel.pickRoot.visible = true;
  applyShadowFlags(editorPreviewLevel.pickRoot);
  editor.onLevelRebuilt();
}

function restoreEditorProxyBaseline(): void {
  const working = editor.workingEntry();
  if (!working) return;
  setEditorBuild(true);
  const candidate = tryBuildEditorLevel(working, "canceled edit kept original");
  if (!candidate) {
    level.pickRoot.visible = true;
    return;
  }
  if (editorPreviewLevel) editorPreviewLevel.dispose(level);
  editorPreviewLevel = candidate;
  level.pickRoot.visible = true;
  applyShadowFlags(editorPreviewLevel.pickRoot);
  maskInitialEditorProxy(editorPreviewLevel);
  editor.onLevelRebuilt();
}

function preflightEditorWorking(): boolean {
  const working = editor.workingEntry();
  if (!working) return false;
  if (working.data && !normalizeCustomLevelData(working.data)) {
    ui.showMessage(
      "CHANGE REJECTED",
      "values or geometry exceed safe authoring limits",
      2600,
    );
    return false;
  }
  return true;
}

function rebuildLevel(): void {
  if (editorPreviewLevel) {
    // No edit was committed: keep the already-built original level object,
    // rather than rebuilding even that. Its geometry, special systems,
    // materials, and runtime contract remain exactly the ones opened.
    if (
      !editor.active &&
      !editor.changedThisSession &&
      current.id === editor.targetId
    ) {
      editorPreviewLevel.dispose(level);
      editorPreviewLevel = null;
      level.pickRoot.visible = true;
      return;
    }
  }
  const next = editor?.workingEntry() ?? findLevel(current.id) ?? current;
  const candidate = tryBuildEditorLevel(next, "playable level kept last good build");
  if (!candidate) {
    level.pickRoot.visible = true;
    if (editorPreviewLevel) editorPreviewLevel.pickRoot.visible = false;
    return;
  }
  if (editorPreviewLevel) {
    editorPreviewLevel.dispose(level);
    editorPreviewLevel = null;
  }
  if (replayer.active) {
    replayer.end();
    restoreReplayRunRule();
    ui.setReplayBadge(false);
  }
  // During editing the in-memory working copy is the authority, including a
  // live handle drag that has not autosaved yet.
  current = next;
  level.dispose();
  puffs.clear();
  swirls.clear();
  fieldSwirls.clear();
  level = candidate;
  puffs.attach(scene);
  const changedLevelId = loadedLevelId !== current.id;
  loadedLevelId = current.id;
  localStorage.setItem("solProtoLevelId", current.id);
  if (changedLevelId) player.enterLevel(current.id);
  player.respawn(level, true);
  if (split2p && p2) {
    if (changedLevelId) p2.enterLevel(current.id);
    p2.respawn(level, true);
    p2.pos.x += 1.6;
    p2.snapRenderInterpolation();
  }
  applyRunModes();
  applyTheme();
  applyShadowFlags();
  ui.setLevel(
    current.id,
    level.hudMode,
    player.fruitCollectionRevision,
    input.inventoryHeld,
  );
  ui.setHUD(currentHudState(), 0);
  recorder.start(current.id, endlessDeathsOn);
  (window as unknown as Record<string, unknown>).__game &&
    ((
      (window as unknown as Record<string, unknown>).__game as Record<
        string,
        unknown
      >
    ).level = level);
  editor.onLevelRebuilt();
}
function closeEditorToPlay(): boolean {
  if (!editor.active) return false;
  const noOp = !editor.changedThisSession;
  editor.exit();
  rebuildLevel();
  if (noOp && editorSavedAcc !== null) acc = editorSavedAcc;
  if (noOp) ui.restoreMessage(editorSavedMessage);
  editorSavedAcc = null;
  editorSavedMessage = null;
  return noOp;
}
let editorExitAlreadyBuilt = false;
const editor = new Editor(
  scene,
  camera,
  renderer.domElement,
  () => editorPreviewLevel ?? level,
  {
    preflight: () => preflightEditorWorking(),
    rebuild: (committed = false) =>
      committed ? rebuildLevel() : rebuildEditorPreview(),
    resetPreview: () => restoreEditorProxyBaseline(),
    // The editor renamed / duplicated / deleted a level: the menu is stale.
    levelsChanged: (goTo?: string) => {
      if (goTo && goTo !== current.id) {
        if (editor.targetId === goTo) {
          current = findLevel(goTo) ?? current;
          localStorage.setItem("solProtoLevelId", current.id);
          ui.setLevel(
            current.id,
            level.hudMode,
            player.fruitCollectionRevision,
            input.inventoryHeld,
          );
          ui.setHUD(currentHudState(), 0);
          rebuildEditorPreview();
        } else {
          editor.exit();
          editorSavedAcc = null;
          editorSavedMessage = null;
          switchLevel(goTo);
          editorExitAlreadyBuilt = true;
        }
      } else {
        current = findLevel(current.id) ?? current;
        level.name = current.name; // a rename is live, without a rebuild
      }
      ui.refreshLevels(current.id);
    },
    exitToPlay: () => {
      let noOp = false;
      if (editorExitAlreadyBuilt) editorExitAlreadyBuilt = false;
      else noOp = closeEditorToPlay();
      if (!noOp && paused)
        ui.showMessage("PAUSED", "Options / P to resume", 0);
      else if (!noOp)
        ui.showMessage(
          "TEST RUN",
          "press ✎ LEVEL EDITOR to keep editing",
          1600,
        );
    },
    showMsg: (t, s) => ui.showMessage(t, s ?? "", 1800),
    // drop fog + extend the far plane on enter, restore on every exit path
    setView: (editing, changed) => setEditorView(editing, changed),
  },
);
// Open the editor on a level (default: whatever is loaded). A level that has
// never been edited has no data to bind to, so it goes through editLevel,
// which captures it first.
// Character Lab owns the procedural rest silhouette while gameplay is frozen.
// It is lazy so the authoring UI and OrbitControls cost nothing during play.
let characterLab: {
  frame: () => void;
  close: () => void;
  readonly diagnostics: unknown;
} | null = null;
async function openCharacterLabTool(): Promise<void> {
  if (characterLab || animationStudio) return;
  player.setCharacterUpperArmRestAngleWeight(1);
  const rig = player.enterAnimationPreview();
  try {
    const mod = await import("./characterLab");
    characterLab = mod.openCharacterLab({
      renderer,
      scene,
      camera,
      player,
      rigRoot: rig.root,
      onClose: () => {
        player.setCharacterUpperArmRestAngleWeight(
          player.animationClipHint === 'player.idle' ? 1 : 0,
        );
        player.exitAnimationPreview();
        characterAnimationRuntime.restart();
        characterLab = null;
      },
    });
    (window as unknown as { __game: Record<string, unknown> }).__game.characterLab =
      characterLab;
  } catch (error) {
    player.exitAnimationPreview();
    throw error;
  }
}
// Full character animation authoring. Gameplay is frozen while this owns the
// stage; Player snapshots and restores its authoritative pose at the boundary.
let animationStudio: {
  frame: (dt: number) => void;
  close: () => void;
  getDocument: () => unknown;
} | null = null;
async function openAnimationStudioTool(): Promise<void> {
  if (animationStudio || characterLab) return;
  const rig = player.enterAnimationPreview();
  try {
    const mod = await import("./animationStudio");
    animationStudio = mod.openAnimationStudio({
      renderer,
      scene,
      camera,
      rigRoot: rig.root,
      document: characterAnimationRuntime.document,
      applyScalars: (values) => player.applyAnimationDeformations(values),
      syncPresentation: (clip) => {
        player.setCharacterUpperArmRestAngleWeight(
          clip?.id === 'player.idle' ? 1 : 0,
        );
        player.syncCharacterAppearance();
      },
      clearPostPose: () => player.clearCrawlHandPlantPreview(),
      applyPostPose: (clip, time) => {
        if (
          clip.id === 'player.crawl' &&
          clip.metadata?.contactAdaptation === UNITY_CRAWL_CONTACT_ADAPTATION
        ) player.applyCrawlHandPlantPreview(time, clip.duration);
        else player.clearCrawlHandPlantPreview();
      },
      tailVisibility: {
        getState: () => player.characterTailVisibilityState,
        toggle: () => player.toggleCharacterTailVisibility(),
      },
      onDocumentChange: (document) => {
        playerAnimationDocument = document;
        characterAnimationRuntime.setDocument(document);
        p2CharacterAnimationRuntime?.setDocument(document);
      },
      onClose: () => {
        player.setCharacterUpperArmRestAngleWeight(
          player.animationClipHint === 'player.idle' ? 1 : 0,
        );
        player.exitAnimationPreview();
        characterAnimationRuntime.restart();
        animationStudio = null;
      },
    });
    (window as unknown as { __game: Record<string, unknown> }).__game.animationStudio =
      animationStudio;
  } catch (error) {
    player.exitAnimationPreview();
    throw error;
  }
}
// The SMOKE studio: same idea, different subject. #puffstudio on the URL.
let puffStudio: { frame: (dt: number) => void } | null = null;
async function openPuffStudioTool(): Promise<void> {
  if (puffStudio) return;
  const mod = await import("./puffstudio");
  puffStudio = mod.openPuffStudio({
    camera,
    scene,
    onClose: () => (puffStudio = null),
  });
  // Reachable from the console/harness so headless checks can drive its
  // frame() by hand — rAF (and with it the real loop) throttles headless.
  (window as unknown as { __game: Record<string, unknown> }).__game.puffStudio = puffStudio;
}
// The SWIRL studio: the band-based wormhole. #swirlstudio on the URL.
let swirlStudio: { frame: (dt: number) => void } | null = null;
async function openSwirlStudioTool(): Promise<void> {
  if (swirlStudio) return;
  const mod = await import("./swirlstudio");
  swirlStudio = mod.openSwirlStudio({
    camera,
    scene,
    onClose: () => (swirlStudio = null),
  });
  (window as unknown as { __game: Record<string, unknown> }).__game.swirlStudio = swirlStudio;
}
// The FIELD studio: the preserved sine-field disc. #fieldstudio on the URL.
let fieldStudio: { frame: (dt: number) => void } | null = null;
async function openFieldStudioTool(): Promise<void> {
  if (fieldStudio) return;
  const mod = await import("./fieldstudio");
  fieldStudio = mod.openFieldStudio({
    camera,
    scene,
    onClose: () => (fieldStudio = null),
  });
  (window as unknown as { __game: Record<string, unknown> }).__game.fieldStudio = fieldStudio;
}
// The WATER studio: fine-tunes the coast water live. #waterstudio on the URL.
let waterStudio: { frame: (dt: number) => void } | null = null;
async function openWaterStudioTool(): Promise<void> {
  if (waterStudio) return;
  const mod = await import("./waterstudio");
  waterStudio = mod.openWaterStudio({
    getWater: () => level.water,
    onClose: () => (waterStudio = null),
  });
  (window as unknown as { __game: Record<string, unknown> }).__game.waterStudio = waterStudio;
}
if (location.hash.toLowerCase().includes("characterlab")) {
  setTimeout(() => void openCharacterLabTool(), 500);
} else if (location.hash.toLowerCase().includes("animationstudio")) {
  setTimeout(() => void openAnimationStudioTool(), 500);
} else if (location.hash.toLowerCase().includes("waterstudio")) {
  setTimeout(() => void openWaterStudioTool(), 2500);
} else if (location.hash.toLowerCase().includes("puffstudio")) {
  setTimeout(() => void openPuffStudioTool(), 2500);
} else if (location.hash.toLowerCase().includes("swirlstudio")) {
  setTimeout(() => void openSwirlStudioTool(), 2500);
} else if (location.hash.toLowerCase().includes("fieldstudio")) {
  setTimeout(() => void openFieldStudioTool(), 2500);
}

function openEditor(
  target: string = current.id,
  initialData?: CustomLevelData,
  preservedMessage: ReturnType<UI["captureMessage"]> =
    paused ? ui.captureMessage() : null,
): void {
  if (editor.active) return;
  const entry = findLevel(target);
  if (!entry) return;
  if (!entry.data && !initialData) {
    editLevel(entry.id, preservedMessage);
    return;
  }
  // A cross-level pencil click intentionally loads that target, but it must
  // not replace a persistent PAUSED banner with the transient level-name
  // toast that switchLevel emits.
  if (current.id !== entry.id) switchLevel(entry.id);
  editorSavedAcc = acc;
  editorSavedMessage = preservedMessage ?? ui.captureMessage();
  // The editor owns the frame and freezes the simulation. Do not respawn,
  // cancel pause/replay, force 2P off, or otherwise disturb a no-op session.
  ui.hideMessage();
  const workingData = initialData ?? entry.data!;
  setEditorBuild(true);
  const candidate = tryBuildEditorLevel({
    id: entry.id,
    name: entry.name,
    data: workingData,
  }, "open canceled; live level untouched");
  if (!candidate) {
    setEditorBuild(false);
    editorSavedAcc = null;
    ui.restoreMessage(editorSavedMessage);
    editorSavedMessage = null;
    return;
  }
  editorPreviewLevel = candidate;
  // Hide only renderable proxy leaves, not their ancestors. Raycasting still
  // sees them, while editorGhost guides (zones, camnodes, invisible walls)
  // remain visible over the untouched original world.
  maskInitialEditorProxy(editorPreviewLevel);
  editor.enter(entry, workingData);
}
// MENU / TUNER while the editor owns the screen: the play panels are hidden
// under the tools, so a tab tap first CLOSES the editor (edits are already
// saved live) and drops back to play — then the panel opens normally.
ui.onSideTab = () => {
  if (!editor.active) return;
  const noOp = closeEditorToPlay();
  if (!noOp && paused) ui.showMessage("PAUSED", "Options / P to resume", 0);
  else if (!noOp)
    ui.showMessage(
      "EDITOR CLOSED",
      "press ✎ LEVEL EDITOR to keep editing",
      1600,
    );
};
// EDIT THIS LEVEL — opening is transactional. Data-owned levels and captured
// hand-built levels both use a hidden pick proxy; the live world is untouched
// until an actual edit commits.
function editLevel(
  id: string,
  preservedMessage: ReturnType<UI["captureMessage"]> =
    paused ? ui.captureMessage() : null,
): void {
  const entry = findLevel(id);
  if (!entry) return;
  if (entry.data) {
    openEditor(id, undefined, preservedMessage);
    return;
  }
  if (current.id !== id) switchLevel(id); // capture reads the LIVE level
  // captureData reads authored/home snapshots for dynamic entities, so this
  // harvest is side-effect free: no reset of the live run and no second
  // hand-built Level spawning global VFX behind the editor.
  const data = level.captureData();
  data.name = entry.name; // in place — not "(copy)"
  openEditor(entry.id, data, preservedMessage);
  ui.showMessage(
    `EDITING ${entry.name.toUpperCase()}`,
    "original stays untouched · first change creates an editable copy",
    2600,
  );
}
ui.onLevelEdit = (id: string) => editLevel(id);
// NEW: a blank slate that joins the menu immediately.
ui.onLevelNew = () => {
  const data = starterCustomLevel();
  data.name = "New Level";
  const id = saveUserLevel({ id: "", name: data.name, data });
  if (!userLevelStorageHealthy())
    ui.showMessage(
      "SAVE FAILED",
      "new level is session-only · export before reloading",
      3000,
    );
  switchLevel(id);
  ui.refreshLevels(id);
  openEditor(id);
  ui.showMessage("NEW LEVEL", "rename it in the editor's PROJECT tab", 2400);
};
// IMPORT: a downloaded level file becomes a new menu row. Accepts both the
// bare component data the editor exports and a whole {id,name,data} entry.
function importLevelFile(txt: string, fallbackName: string): boolean {
  let data: CustomLevelData | null = null;
  let name = fallbackName.replace(/\.json$/i, "");
  try {
    const obj = JSON.parse(txt) as {
      components?: unknown;
      name?: string;
      data?: CustomLevelData;
    };
    if (Array.isArray(obj.components)) data = obj as unknown as CustomLevelData;
    else if (obj.data && Array.isArray(obj.data.components)) data = obj.data;
    if (data) name = obj.name ?? data.name ?? name;
  } catch {
    return false;
  }
  const normalized = normalizeCustomLevelData(data);
  if (!normalized) return false;
  let probe: Level | null = null;
  try {
    probe = new Level(new THREE.Scene(), {
      id: "__import_probe",
      name,
      data: normalized,
    });
  } catch {
    return false;
  } finally {
    probe?.dispose(level);
  }
  const id = saveUserLevel({ id: "", name, data: normalized });
  if (!userLevelStorageHealthy())
    ui.showMessage(
      "SAVE FAILED",
      "level is session-only · export it before reloading",
      3000,
    );
  switchLevel(id);
  ui.refreshLevels(id);
  ui.showMessage("LEVEL IMPORTED", `${findLevel(id)?.name ?? name}`, 2000);
  return true;
}
ui.onLevelImport = (txt: string, filename: string) => {
  if (!importLevelFile(txt, filename))
    ui.showMessage("BAD LEVEL FILE", "", 1600);
};
// UNLOCK: the passcode gate for direct editing + phone sync.
ui.onUnlockEditing = async (pass: string): Promise<boolean> => {
  const ok = await checkEditPass(pass);
  if (ok) {
    ui.setEditUnlocked(true);
    ui.showMessage(
      "DIRECT EDITING UNLOCKED",
      "EDIT THIS LEVEL + SYNC are on",
      2200,
    );
  }
  return ok;
};
// SYNC UP: publish this session's whole level list to the repo file the phone
// reads. The payload IS the list — what you see is what you push.
ui.onSyncPush = async (): Promise<void> => {
  const levels = getUserLevels();
  ui.setSyncStatus(`pushing ${levels.length} level(s)…`, "busy");
  const res = await pushLevels({ v: 2, levels });
  ui.setSyncStatus(res.msg, res.ok ? "ok" : "err");
  ui.refreshEditControls();
};
// RESTORE FROM CLOUD: replace this device's list with the published one. This
// is the escape hatch for a device that has drifted — and the one-tap setup
// for a phone that has never seen the levels. It DISCARDS local levels, so the
// button is two-tap armed; and it fetches first, so an offline tap changes
// nothing.
ui.onForceResync = async (): Promise<void> => {
  ui.setSyncStatus("reading the published levels…", "busy");
  const remote = (await fetchRemoteLevels()) as {
    v?: number;
    levels?: LevelEntry[];
  } | null;
  if (!remote || !Array.isArray(remote.levels)) {
    const msg = "couldn't reach the published levels — nothing changed";
    ui.setSyncStatus(msg, "err");
    ui.showMessage("RESTORE FAILED", msg, 2600);
    return;
  }
  const before = getUserLevels().length;
  setUserLevels(remote.levels);
  localStorage.setItem("solProtoCloudPulled", "1");
  const after = getUserLevels().length;
  if (editor.active) editor.exit();
  switchLevel(findLevel(current.id) ? current.id : DEFAULT_LEVEL_ID);
  player.respawn(level, true);
  ui.refreshLevels(current.id);
  ui.refreshEditControls();
  ui.setSyncStatus(`restored ${after} level(s) from the cloud`, "ok");
  ui.showMessage(
    "LEVELS RESTORED",
    `${before} local → ${after} published`,
    2400,
  );
};
ui.onTokenSet = (t: string) => {
  setToken(t);
  ui.setSyncStatus(
    getToken() ? "token saved on this device" : "token cleared",
    getToken() ? "ok" : "busy",
  );
  ui.refreshEditControls();
};
// Prime the UI with the current unlock/token/dirty state (state provider first,
// so the initial refresh sees real values).
ui.provideEditState = () => ({
  unlocked: isEditUnlocked(),
  hasToken: !!getToken(),
  userCount: getUserLevels().length,
});
ui.setEditUnlocked(isEditUnlocked());
// Refresh-proof editing: if the page reloads mid-edit, walk straight back into
// the editor on the SAME level (camera pose restored by Editor.enter()).
// Deferred past module init — openEditor touches state declared further down.
if (localStorage.getItem("solProtoEditorOpen") === "1") {
  const t = localStorage.getItem("solProtoEditorTarget") ?? "";
  // a stale target (older build, deleted level) must not reopen on the wrong
  // level — the editor autosaves, so that would overwrite it
  if (findLevel(t)) setTimeout(() => openEditor(t), 0);
  else {
    localStorage.removeItem("solProtoEditorOpen");
    localStorage.removeItem("solProtoEditorTarget");
  }
}

// ---- CROSS-DEVICE SYNC: first-run pull ------------------------------------
// A device that has never pulled and has no levels of its own adopts the
// published list, so a phone picks up everything the Mac pushed with zero
// setup. After that the list is yours: RESTORE FROM CLOUD is the only thing
// that overwrites it, so a fetch can never eat your edits and a level you
// deleted stays deleted.
void (async () => {
  if (localStorage.getItem("solProtoCloudPulled") === "1") return;
  if (getUserLevels().length) {
    localStorage.setItem("solProtoCloudPulled", "1"); // this device authored its own
    return;
  }
  const remote = (await fetchRemoteLevels()) as { levels?: LevelEntry[] } | null;
  if (!remote || !Array.isArray(remote.levels)) return;
  // The request raced the UI. If anything was authored while it was in
  // flight, local work wins and the automatic first-run pull retires itself;
  // only the explicitly armed RESTORE action may replace a non-empty list.
  if (getUserLevels().length) {
    localStorage.setItem("solProtoCloudPulled", "1");
    return;
  }
  setUserLevels(remote.levels);
  localStorage.setItem("solProtoCloudPulled", "1");
  ui.refreshLevels(current.id);
  ui.refreshEditControls();
})();

// ---- playtest capture: input replays + gameplay video ----------------------

// Export the take since the last level load as a downloadable JSON. Drop the
// file into the chat with a note about what went wrong; the same file plays
// back deterministically (drag it onto the game window).
function exportReplay(): ReplayFile {
  return recorder.export();
}
function saveReplay(): void {
  const data = exportReplay();
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const lvlName = findLevel(data.level)?.name ?? data.level;
  a.download = `replay-${lvlName.replace(/\s+/g, "")}-${data.date.replace(/[:.]/g, "-").slice(0, 19)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const secs = (data.frames / 60).toFixed(0);
  ui.showMessage(
    "REPLAY SAVED",
    `${secs}s of input — drop the file into the chat`,
    2200,
  );
}

function loadReplay(data: unknown): void {
  // Validate every byte stream and tuning tuple before ending a current take,
  // changing the temporary run rule, or rebuilding the level.
  if (!isReplayFile(data)) {
    ui.showMessage("BAD REPLAY FILE", "unsupported version or corrupt input data", 2200);
    return;
  }
  if (!findLevel(data.level)) {
    ui.showMessage("REPLAY LEVEL MISSING", String(data.level), 2200);
    return;
  }
  if (replayer.active) {
    replayer.end();
    restoreReplayRunRule();
    ui.setReplayBadge(false);
  }
  replaySavedEndlessDeaths = endlessDeathsOn;
  endlessDeathsOn = data.endlessDeaths === true;
  applyEndlessDeaths();
  switchLevel(data.level); // clean slate: replay assumes a fresh level load
  replayer.begin(data);
  ui.setReplayBadge(true);
  ui.showMessage("REPLAY", `${(data.frames / 60).toFixed(0)}s take`, 1400);
}

// Gameplay video: records the canvas, downloads a .webm on stop.
let videoRec: MediaRecorder | null = null;
let videoChunks: Blob[] = [];
function toggleVideo(): void {
  if (videoRec) {
    videoRec.stop();
    return;
  }
  const stream = renderer.domElement.captureStream(60);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  videoRec = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 8_000_000,
  });
  videoChunks = [];
  videoRec.ondataavailable = (e) => {
    if (e.data.size > 0) videoChunks.push(e.data);
  };
  videoRec.onstop = () => {
    const blob = new Blob(videoChunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gameplay-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    videoRec = null;
    ui.setRecBadge(false);
    ui.showMessage("VIDEO SAVED", "drop the .webm into the chat", 2000);
  };
  videoRec.start(1000);
  ui.setRecBadge(true);
  ui.showMessage("RECORDING VIDEO", "press rec again to stop + save", 1800);
}

ui.onSaveReplay = saveReplay;
ui.onToggleVideo = toggleVideo;
ui.onLoadReplay = (text) => {
  try {
    loadReplay(JSON.parse(text) as ReplayFile);
  } catch {
    ui.showMessage("BAD REPLAY FILE", "", 1400);
  }
};
// drag a .json anywhere onto the game: replays play back, levels import
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f)
    f.text().then((txt) => {
      try {
        const obj = JSON.parse(txt) as {
          components?: unknown;
          data?: { components?: unknown };
          b?: unknown;
        };
        if (Array.isArray(obj.components) || Array.isArray(obj.data?.components)) {
          // a LEVEL file: it joins the menu as its own level
          importLevelFile(txt, f.name);
        } else if (Array.isArray(obj.b)) {
          loadReplay(obj as ReplayFile);
        } else {
          ui.showMessage("UNRECOGNIZED FILE", "", 1400);
        }
      } catch {
        ui.showMessage("BAD FILE", "", 1400);
      }
    });
});
ui.onLevelSelect = (id) => {
  if (!shellBypass || gameFlow.blocksGameplay) return;
  switchLevel(id);
};
ui.onToggle2P = () => {
  if (!shellBypass) {
    ui.showMessage("1 PLAYER CAMPAIGN", "split screen remains available in ?playtest", 1800);
    return;
  }
  set2P(!split2p);
};
ui.onToggleRunModes = () => {
  if (!shellBypass) {
    ui.showMessage(
      "CAMPAIGN RUN MODES",
      "time trial and combo unlock after a crystal clear",
      1800,
    );
    return;
  }
  runModesOn = !runModesOn;
  localStorage.setItem("solProtoRunModes", runModesOn ? "on" : "off");
  applyRunModes();
  ui.showMessage(
    runModesOn ? "TIME TRIAL + COMBO ON" : "TIME TRIAL + COMBO OFF",
    runModesOn ? "the stopwatch and the orb are back" : "plain platforming",
    1400,
  );
};
ui.onToggleEndlessDeaths = () => {
  if (!shellBypass) {
    ui.showMessage("CLASSIC LIVES", "campaign saves always use lives and game over", 1800);
    return;
  }
  // The click expresses a choice against the rule currently shown. Capture it
  // before replay cancellation restores the user's pre-replay preference.
  const desiredEndlessDeaths = !endlessDeathsOn;
  if (replayer.active) {
    replayer.end();
    restoreReplayRunRule();
    ui.setReplayBadge(false);
  }
  endlessDeathsOn = desiredEndlessDeaths;
  localStorage.setItem("solProtoEndlessDeaths", endlessDeathsOn ? "on" : "off");
  applyEndlessDeaths();
  // A ruleset switch starts a fresh standard run so lives, deaths, score and
  // checkpoint snapshots cannot straddle two incompatible economies.
  player.respawn(level, true);
  if (split2p && p2) {
    p2.respawn(level, true);
    p2.pos.x += 1.6;
    p2.snapRenderInterpolation();
  }
  ui.setHUD(currentHudState(), 0);
  recorder.start(current.id, endlessDeathsOn);
  ui.showMessage(
    endlessDeathsOn ? "ENDLESS DEATHS" : "CLASSIC LIVES",
    endlessDeathsOn
      ? "wumpa pays score · death count rises · score halves"
      : "100 wumpa earns a life · game over returns",
    2200,
  );
};
player.onComboBank = (amount, labels) => ui.comboBank(amount, labels);
player.onComboBail = (labels, points, multiplier) =>
  ui.comboBail(labels, points, multiplier);
// Debug cheat: clicking the HUD face banks an extra life.
ui.onLifeCheat = () => {
  if (!shellBypass || player.endlessDeaths) return;
  player.lives++;
  sfx.play("lifeGet", 0.8);
};
ui.refreshLevels(current.id); // adoption/first-run pull may have grown the list
window.addEventListener("keydown", (e) => {
  // typing in a panel field (editor coordinates, tuner values) must not
  // switch levels or fire capture hotkeys
  const t = e.target as HTMLElement | null;
  if (
    t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT")
  )
    return;
  if (!shellBypass || gameFlow.blocksGameplay || bonusSession) return;
  if (!editor.active) {
    // level hotkeys are gameplay-only — inside the editor they'd yank the
    // level out from under you
    // number row -> level, in menu order; the list is unbounded, keys are 1-9
    const rows = levelList();
    for (let i = 0; i < Math.min(9, rows.length); i++) {
      if (e.code === `Digit${i + 1}`) switchLevel(rows[i].id);
    }
  }
  if (!editor.active && (e.code === "KeyK" || e.code === "KeyL")) {
    // playtest warp: skip up and down the course by checkpoint so a section
    // halfway in doesn't cost a full run to reach
    if (player.warpCheckpoint(level, e.code === "KeyL" ? 1 : -1))
      ui.showMessage(e.code === "KeyL" ? "WARP →" : "← WARP", "", 700);
  }
  if (e.code === "F8") saveReplay(); // playtest capture: input take -> .json
  if (e.code === "F9") toggleVideo(); // playtest capture: canvas -> .webm
});

player.onDeath = () => ui.deathFade(true);
player.onRelic = (title, sub) => ui.showMessage(title, sub, 1400);
player.onTrickGateBlocked = (trick) => {
  const info = deckTrickInfo(trick);
  ui.showMessage(`${info.label.toUpperCase()} REQUIRED`, info.hint, 1800);
};
player.onFinish = (time) => {
  pendingCompletion = { kind: bonusSession ? "bonus" : "normal", time };
};
player.onBonusDeath = () => returnFromBonus(false);
player.onRespawn = () => {
  if (!bonusSession && isCampaignLevel(current.id))
    player.bonusCrates = currentRunBonusBoxes;
  ui.resetHudTransients(player.fruitCollectionRevision, input.inventoryHeld);
  ui.setHUD(currentHudState(), 0);
  ui.hideMessage();
  ui.showDeathScreen(false);
  ui.hideTTResults();
  ui.deathFade(false); // world's back in place behind the black — reveal it
};

// ---- time trial: ranked times per level, kept in this browser --------------
function recordTT(
  levelId: string,
  time: number,
): { list: number[]; rank: number } {
  let all: Record<string, number[]> = {};
  try {
    all =
      (JSON.parse(localStorage.getItem("solProtoTTtimes") ?? "{}") as Record<
        string,
        number[]
      >) ?? {};
  } catch {
    all = {};
  }
  const list = all[levelId] ?? [];
  list.push(time);
  list.sort((a, b) => a - b);
  all[levelId] = list.slice(0, 8);
  try {
    localStorage.setItem("solProtoTTtimes", JSON.stringify(all));
  } catch {
    // Results still complete when private browsing/quota blocks persistence.
  }
  return { list: all[levelId], rank: all[levelId].indexOf(time) };
}

player.onTTStart = () => {
  ui.setTimeTrial(true);
  ui.showMessage(
    "TIME TRIAL!",
    "race to the gate — numbered crates freeze the clock",
    1800,
  );
};
player.onTTEnd = () => ui.setTimeTrial(false);

// ---- combo run: green orb -> one combo to the green gem at the gate --------
player.onComboRunStart = () => {
  ui.setRunRows(true);
  ui.comboHalo("on");
  ui.showMessage(
    "COMBO RUN!",
    "start a combo NOW — one chain, all the way to the gem",
    2000,
  );
};
player.onComboGraceLow = () => ui.showMessage("START A COMBO!", "", 700);
player.onComboRunFail = () => {
  ui.comboHalo("dissipate");
  ui.showMessage("COMBO BROKEN", "", 1100);
};
player.onComboRunWin = () => {
  ui.comboHalo("dissipate");
  ui.setRunRows(false);
  ui.showMessage("COMBO GEM!", "the green gem is yours", 2200);
};
player.onComboRunEnd = () => {
  ui.comboHalo("off");
  ui.setRunRows(false);
};
player.onTTFinish = (time) => {
  pendingCompletion = { kind: "time", time };
};
player.onCheckpoint = () => ui.showMessage("CHECKPOINT", "", 900);
player.onGameOver = () => {
  campaign.resetInventory();
  player.lives = DEFAULT_CAMPAIGN_LIVES;
  player.fruit = 0;
  ui.showDeathScreen(false);
  gameFlow.showGameOver(currentCampaignName());
};

// --- Crash-style corridor camera -------------------------------------------
// Hard-locked to the course axis: it only translates, never yaws, so screen
// left/right always equal world left/right. Crash 2 framing: close and low,
// narrow lens, the player reads big against the corridor. Traveling BACK
// toward the camera (riding or grinding) eases it up and away and swings the
// look-at behind you, so the nitros you're backing into stay on screen.
// Idle-reference calibration (Crash 3 Toad Village clip): camera pitched
// ~18° down so crate TOPS read, hero's feet near the bottom of frame,
// hero ~30% of frame height.
// Base framing now lives on TUNING sliders (CAMERA section): camDist,
// camHeight, camTilt, camOffset, camFov. Special shots (side-scroll, boulder)
// scale relative to the current shipped baseline.
const camTarget = new THREE.Vector3();
const lookPoint = new THREE.Vector3();
const camAimTmp = new THREE.Vector3();
let camAnchorY = 0; // the rig's vertical anchor: the ground under the skater, eased
let camRoll = 0; // eased dutch roll tracking the grind balance needle (radians)
const aimSmooth = new THREE.Vector3(NaN, 0, 0); // lightly-damped look target (NaN = seed on first frame)
let camBack = 0; // 0 = facing down-course, eases to 1 while travelling at the camera
let sideF = 0; // eases to 1 on turned (X-running) stretches: wider framing only
let boulderF = 0; // eases to 1 on boulder-chase levels: tipped-down framing
let camSpeedFovBoost = 0; // additive high-speed skate lens push, eased in/out
const prevPlayerPos = new THREE.Vector3();
const cameraLaneCursor = newLaneCursor();
let cameraRenderSnapVersion = -1;
// The rig's "down-course" forward. Fixed at -Z normally; on levels with a
// drawn CAMERA LANE it eases along the lane's local tangent, turning the
// whole rig through winding corridors (Crash 3 camera rails).
const camF = new THREE.Vector3(0, 0, -1);
// CHASE CAM heading: the player's own travel direction, held while stopped.
// With TUNING.chaseCam on, camF follows THIS instead — the camera swings
// around behind wherever they go, so the skater always faces forward.
const chaseF = new THREE.Vector3(0, 0, -1);
let chaseSteadyT = 0; // seconds of continuous steady travel (filters pipe swings)

function updateCamera(dt: number): void {
  const subject = player.renderPosition;
  const snapped = cameraRenderSnapVersion !== player.renderSnapVersion;
  if (snapped) {
    cameraRenderSnapVersion = player.renderSnapVersion;
    prevPlayerPos.copy(subject);
    cameraLaneCursor.s = -1;
    chaseSteadyT = 0;
  }
  if (oceanOverview && current.id === "beachfront") {
    // Frozen Unity d300 seaward golden-camera coordinates.
    camera.fov = 50;
    camera.position.set(-19.7656, 18, -258.4284);
    camera.up.set(0, 1, 0);
    camera.lookAt(0.4741, 1, -314.9205);
    camera.updateProjectionMatrix();
    camSpeedFovBoost = 0;
    cam2SpeedFovBoost = 0;
    prevPlayerPos.copy(subject);
    return;
  }
  if (oceanReview && current.id === "beachfront") {
    // Exact authoritative Unity gameplay-spawn capture framing, used by the
    // parity URL. The normal menu level keeps the live course-spine camera.
    camera.fov = 43;
    camera.position.set(1.415, 5.5, 13.852);
    camera.up.set(0, 1, 0);
    camera.lookAt(4.065, 0, 2.148);
    camera.updateProjectionMatrix();
    camSpeedFovBoost = 0;
    cam2SpeedFovBoost = 0;
    prevPlayerPos.copy(subject);
    return;
  }
  // ONE rig, always facing down -Z. When the path right-angles into an
  // X-running stretch, the same camera sees it side-on — no yaw, just a
  // slightly wider, higher frame with less forward lead.
  // CHASE CAM ignores zones — the rig yaws behind the player instead.
  const chaseOn = TUNING.chaseCam > 0.5 && !level.boulder;
  // side framing only on E/W stretches — a run-at-camera ('N') zone keeps the
  // normal corridor shot: the fixed lens IS the chase framing there
  const znHere = level.zoneAt(subject.x, subject.z);
  const inTurn =
    !chaseOn && znHere !== null && (znHere.dir === "E" || znHere.dir === "W");
  sideF += ((inTurn ? 1 : 0) - sideF) * (snapped ? 1 : Math.min(1, 3.5 * dt));

  // Boulder-chase framing is a proper cinematographic shot, not just a further
  // dolly-back. The skater runs TOWARD camera, so "ahead" is the foreground the
  // wide lens crushes flat. The rig: a LONG telephoto lens (27deg) shot from a
  // LOW, FAR-back camera tilted UP the corridor — dollying back while zooming in
  // (the long lens compensates so the hero keeps its size) compresses depth hard
  // so the runway lays out flat and reads, and the low tilted-up angle keeps the
  // chasing boulder up-course pinned to the top of frame. The
  // look point aims well down-course (+Z, where you're heading) which floats the
  // hero HIGH up the screen, well off centre, with all the lead room below him
  // for the crates/gaps rushing up.
  boulderF +=
    ((level.boulder ? 1 : 0) - boulderF) *
    (snapped ? 1 : Math.min(1, 3 * dt));
  const cameraSkateSpeed = player.cameraSkateSpeed;
  const speedFovGoal = speedSkateFovTarget(
    cameraSkateSpeed,
    cameraSkateSpeed > 0 && !level.boulder,
    TUNING.cruiseSpeed,
    TUNING.maxSpeed,
    TUNING.camSpeedFovBoost,
  );
  camSpeedFovBoost = stepSpeedSkateFov(
    camSpeedFovBoost,
    speedFovGoal,
    dt,
    snapped,
  );
  const authoredFov = current.id === "beachfront" ? 43 : TUNING.camFov;
  const targetFov = THREE.MathUtils.lerp(
    authoredFov + camSpeedFovBoost,
    BOULDER_FOV,
    boulderF,
  );
  if (Math.abs(camera.fov - targetFov) > 0.005) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }

  // CHASE CAM: track the player's travel direction — but only SUSTAINED,
  // steady travel. Airs coast on the held heading; halfpipe transitions and
  // trough crossings never steer it (swinging a pipe would pinwheel the
  // shot — the level's spine is camera noise, not a heading); and the brief
  // sustain window filters what's left. Held while stopped: idling never
  // spins the frame.
  if (snapped && chaseOn) {
    const seed = level.laneDirAt(
      subject.x,
      subject.y,
      subject.z,
      cameraLaneCursor,
    ) ?? { x: 0, z: -1 };
    chaseF.set(seed.x, 0, seed.z).normalize();
  }
  const vx = dt > 0 ? (subject.x - prevPlayerPos.x) / dt : 0;
  const vz = dt > 0 ? (subject.z - prevPlayerPos.z) / dt : 0;
  chaseSteadyT = chaseOn && player.chaseSteady ? chaseSteadyT + dt : 0;
  if (chaseOn && chaseSteadyT > 0.35 && vx * vx + vz * vz > 9) {
    const inv = 1 / Math.hypot(vx, vz);
    const k = Math.min(1, 2.5 * dt);
    chaseF.x += (vx * inv - chaseF.x) * k;
    chaseF.z += (vz * inv - chaseF.z) * k;
    if (chaseF.lengthSq() > 1e-4) chaseF.normalize();
  }

  // CAMERA LANE: ease the rig's forward along the lane's local tangent (the
  // player's course axes ease the same way, so screen-up stays "onward").
  // Chase mode feeds the player's own heading through the same rig instead.
  // The turn rate sets the carve radius (radius ≈ speed / rate, since the
  // frame chases its own tail while you hold a side) — keep it LAZY: a held
  // side is a wide arc, not a spin-top.
  const lf = chaseOn
    ? chaseF
    : level.laneDirAt(
        subject.x,
        subject.y,
        subject.z,
        cameraLaneCursor,
      );
  const turnK = snapped ? 1 : Math.min(1, (chaseOn ? 1.6 : 3.5) * dt);
  camF.x += ((lf ? lf.x : 0) - camF.x) * turnK;
  camF.z += ((lf ? lf.z : -1) - camF.z) * turnK;
  camF.y = 0;
  if (camF.lengthSq() < 1e-4) camF.set(lf ? lf.x : 0, 0, lf ? lf.z : -1); // 180° pinch guard
  camF.normalize();

  const vAlong =
    dt > 0
      ? ((subject.x - prevPlayerPos.x) * camF.x +
          (subject.z - prevPlayerPos.z) * camF.z) /
        dt
      : 0;
  prevPlayerPos.copy(subject);
  // chase mode swings around behind instead of dollying back
  const movingBack =
    !chaseOn && (vAlong < -2.5 || (player.grounded && player.speed < -1.5));
  camBack +=
    ((movingBack ? 1 : 0) - camBack) *
    (snapped ? 1 : Math.min(1, 3 * dt));
  const back = camBack * (1 - sideF) * (1 - boulderF); // corridor thing only

  // side-scroll stretches scale off the sliders (9.2/5.2 and 3.7/4.1 were the
  // authored ratios) so a re-tuned base carries its feel into the turns
  const dist =
    THREE.MathUtils.lerp(TUNING.camDist, TUNING.camDist * 1.77, sideF) +
    back * 3.8 +
    boulderF * 18.8;
  const height =
    THREE.MathUtils.lerp(TUNING.camHeight, TUNING.camHeight * 0.9, sideF) +
    back * 1.1 +
    boulderF * 1.7;
  // camOffset TRANSLATES the whole rig down-course — camera AND aim move
  // together, so the skater's resting spot in frame shifts while the tilt
  // stays put. The boulder shot authors its own framing; fade the knob out.
  const off = TUNING.camOffset * (1 - boulderF);
  // CRASH RIG VERTICAL: the camera's height anchors to the GROUND under the
  // skater, not the skater — a jump rises THROUGH the frame (gentle tilt
  // tracks it) instead of yanking the whole rig skyward and pulling the
  // landing spot out of shot. FRAME-AWARE: how far a jump may rise before
  // the rig starts lifting scales with the lens — a telephoto zoom-in has a
  // tiny frame, so the rig gives sooner and an ollie never rockets across
  // the whole screen. The anchor eases along slopes/steps, follows the
  // player when there's no floor below (pits), and big verts stay framed.
  // The boulder shot keeps its authored full-follow.
  const frameHalf = Math.tan((camera.fov * Math.PI) / 360) * TUNING.camDist;
  const maxRise = THREE.MathUtils.clamp(frameHalf * 1.5, 1.5, 7);
  // No floor below = this fall ends in the void: the rig HOLDS its height
  // instead of chasing the body down (and clipping through the level floor).
  // A rising jump over the gap can still lift it via the maxRise term.
  const floorY = player.groundBelowY;
  const anchorGoal =
    floorY !== null
      ? Math.max(floorY, subject.y - maxRise)
      : Math.max(camAnchorY, subject.y - maxRise);
  camAnchorY +=
    (anchorGoal - camAnchorY) *
    (snapped ? 1 : Math.min(1, 4.5 * dt));
  // camAirLift: how much the rig rides UP with airborne height. 1 = classic
  // full-follow (the camera rises with the jump, so airs read small and snappy
  // on screen); 0 = pure ground anchor (the skater does all the on-screen
  // rising — same physics, but every air reads much bigger and floatier).
  const airLift = Math.max(TUNING.camAirLift, boulderF);
  const effY = THREE.MathUtils.lerp(camAnchorY, subject.y, airLift);
  // the gentle jump tilt also softens on tight lenses (magnified on screen);
  // kept small overall — the ground stays in shot, the skater does the rising
  const tiltTrack = 0.22 * Math.min(1, frameHalf / 4.5);

  camTarget.set(
    subject.x - camF.x * (dist - off),
    effY + height,
    subject.z - camF.z * (dist - off),
  );

  // Snap after respawn teleports; damp otherwise.
  if (snapped || camera.position.distanceTo(camTarget) > 30) {
    camera.position.copy(camTarget);
    camAnchorY = anchorGoal;
    aimSmooth.set(NaN, 0, 0); // re-seed the aim at the new shot
  } else {
    // CRASH RIG TRANSLATION: HARD along the travel axis — down-course
    // normally, the turned axis through side-scroll zones, the chase heading
    // in chase mode — and GENTLE across it, so strafes pan the view instead
    // of sliding the world sideways.
    const perpX = -camF.z;
    const perpZ = camF.x;
    const dx = camTarget.x - camera.position.x;
    const dz = camTarget.z - camera.position.z;
    const along = dx * camF.x + dz * camF.z;
    const lat = dx * perpX + dz * perpZ;
    const kAlong = 1 - Math.exp(-9 * dt);
    const kLat =
      1 -
      Math.exp(-THREE.MathUtils.lerp(3.2, 9, Math.max(sideF, boulderF)) * dt);
    // full air-lift also restores the classic stiffer vertical chase — a soft
    // y-spring on a followed jump reads as extra float
    const kY = 1 - Math.exp(-THREE.MathUtils.lerp(6, 9, airLift) * dt);
    camera.position.x += camF.x * along * kAlong + perpX * lat * kLat;
    camera.position.z += camF.z * along * kAlong + perpZ * lat * kLat;
    camera.position.y += (camTarget.y - camera.position.y) * kY;
  }

  // camTilt aims AT the body (2.1 = just over her head — the old 21° default
  // pitch, re-derived). Side / reverse / boulder keep their authored absolute
  // aims, converted from the old look-ahead shots so defaults are identical.
  // Vertically the aim tracks a jump at 35% — the gentle Crash tilt — while
  // the XZ pan follows through a light smoothing.
  const aimY = THREE.MathUtils.lerp(
    TUNING.camTilt,
    TUNING.camTilt - 0.2,
    sideF,
  );
  const aimK = THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(-off, 3.5, back), // reversing: aim swings behind you
    12, // boulder: aim well down-course, hero floats high with lead room below
    boulderF,
  );
  // the tilt glances down at a body below the anchor but never dives after a
  // long kill-plane fall — past a couple units the aim just lets them drop out
  lookPoint.set(
    subject.x - camF.x * aimK,
    effY +
      Math.max(-2.5, (subject.y - effY) * tiltTrack) +
      THREE.MathUtils.lerp(aimY, 1.6, boulderF),
    subject.z - camF.z * aimK,
  );
  if (Number.isNaN(aimSmooth.x)) aimSmooth.copy(lookPoint);
  // pan (xz) keeps the gentle smoothing; the vertical aim stiffens with
  // camAirLift — the classic rig looked straight at the body with no lag
  const kAim = 1 - Math.exp(-11 * dt);
  const kAimY = 1 - Math.exp(-THREE.MathUtils.lerp(11, 45, airLift) * dt);
  aimSmooth.x += (lookPoint.x - aimSmooth.x) * kAim;
  aimSmooth.z += (lookPoint.z - aimSmooth.z) * kAim;
  aimSmooth.y += (lookPoint.y - aimSmooth.y) * kAimY;

  camera.lookAt(aimSmooth);

  // GRIND BALANCE ROLLS THE SHOT. The needle is a horizontal lean, so the
  // horizon leans with it: a rail you are losing shows up in the frame itself
  // and not only in the meter, and catching it rights the world back up. Only
  // the horizontal meters do this — a manual's needle is nose-to-tail, and a
  // roll would say nothing about it. Applied AFTER lookAt, which rewrites the
  // orientation from scratch each frame, so the roll is about the view axis and
  // never accumulates.
  const meter = player.balanceMeter;
  const rollGoal =
    meter && meter.mode === "grind"
      ? -meter.bal * THREE.MathUtils.degToRad(TUNING.camBalanceRoll)
      : 0;
  // eased in and out, so stepping onto and off a rail is a lean rather than a snap
  camRoll += (rollGoal - camRoll) * (1 - Math.exp(-7 * dt));
  if (Math.abs(camRoll) > 1e-4) camera.rotateZ(camRoll);
}

camera.position
  .copy(player.renderPosition)
  .addScaledVector(new THREE.Vector3(0, 0, 1), TUNING.camDist);
camera.position.y += TUNING.camHeight;

// --- fixed-step loop --------------------------------------------------------
const clock = new THREE.Clock();
let stepTimer = 0;
let stepIdx = 0;
const renderFrameLimiter = new PresentationFrameLimiter(60);

function resetRenderFrameLimiter(): void {
  renderFrameLimiter.reset();
  clock.getDelta(); // discard time spent changing/reallocating render targets
}

function allowRenderFrame(nowMs: number): boolean {
  return renderFrameLimiter.allow(
    nowMs,
    renderQualitySettings.fixed60 && !LITE_RENDER,
  );
}

// Continuous audio: skating/grinding loops track state and speed; walking
// pace gets footsteps.
function updateAudio(dt: number): void {
  const speedAbs = Math.abs(player.speed);
  const onGround = player.state === "ride" && player.grounded;
  // Board rolling loop: above the boardSpeed slider, or any real momentum-
  // skate roll (slow carves up a transition still sound like wheels).
  // Slides are body slides — no board, no board noise.
  // Tied to the skating STATE: wheels roll for as long as the board is out
  // and actually moving — all the way down the roll-out, no speed cutoff.
  // No speed door here either: wheels roll when the board is out and moving,
  // and stay silent when it is stowed. The old `speedAbs > boardSpeed` term
  // meant a fast run on foot rolled wheels that were not under you — and now
  // that the deck itself is state-driven, it would have been rolling wheels
  // that were not even on screen.
  const skatingNow = onGround && !player.sliding && player.boardRolling && speedAbs > 0.3;
  sfx.setLoop(
    "skate",
    "skateLoop",
    skatingNow,
    Math.min(0.55, 0.15 + speedAbs / 90),
    0.85 + speedAbs / 120,
  );
  sfx.setLoop("grind", "grindLoop", player.state === "grind", 0.55, 1);
  // Wallride: the skating loop while stuck to a wall, pitched up a touch.
  sfx.setLoop("wallride", "wallrideLoop", player.wallriding, 0.5, 1.15);
  // Triple-mask invincibility gets its theme music for the whole ride.
  sfx.setLoop("uber", "uberMusic", player.uberTimer > 0, 0.65, 1);
  // Boulder rumble: the grind loop pitched way down, louder as it closes in.
  const bo = level.boulder;
  const bDist = bo ? Math.abs(bo.st.mesh.position.z - player.pos.z) : 999;
  sfx.setLoop(
    "boulder",
    "grindLoop",
    !!bo && bo.active,
    Math.max(0.12, Math.min(0.85, 1.05 - bDist / 55)),
    0.3,
  );

  stepTimer -= dt;
  const walking =
    onGround &&
    !player.sliding &&
    !player.boardRolling &&
    speedAbs > 2 &&
    speedAbs <= TUNING.walkSpeed + 0.5;
  if (walking && stepTimer <= 0) {
    sfx.play("footstep" + (1 + (stepIdx++ % 3)), 0.35);
    stepTimer = 0.26;
  }
}

function currentHudState(): HudState {
  const comboPreview = player.comboHudPreview;
  return {
    points: player.points,
    comboPoints: player.comboPoints,
    comboMult: player.comboMult,
    comboHasTrick: player.comboHasTrick,
    tricks: sourceComboLabelLine(player.comboLabels),
    comboActionRevision: player.comboActionRevision,
    comboPreview,
    specialMeter: player.specialMeter,
    specialReady: player.specialReady,
    fruit: player.fruit,
    fruitCollectionRevision: player.fruitCollectionRevision,
    lives: Math.max(0, player.lives),
    deaths: player.totalDeaths,
    endlessDeaths: player.endlessDeaths,
    cratesBroken:
      player.cratesBroken + (level.runMode ? 0 : player.bonusCrates),
    cratesTotal: level.totalCrates,
    hasCrystal: player.hasCrystal,
    hasGem: player.gemEarned,
    hasComboGem: player.comboGemEarned,
    inventoryHeld: input.inventoryHeld,
    bonusMode: level.hudMode === "bonus",
  };
}

let paused = false;

function frame(nowMs: number): void {
  requestAnimationFrame(frame);
  if (!allowRenderFrame(nowMs)) return;
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.1);
  // Animation Studio owns only presentation. Its chosen clip speed advances
  // this preview clock without advancing movement, collisions, replay, or AI.
  if (animationStudio) {
    animationStudio.frame(dt);
    ui.setGameHudComposited(false);
    renderPrimaryScene(dt);
    return;
  }
  // Character Lab owns the camera and persistent rest silhouette; the sim
  // stands down so slider edits never race gameplay or animation state.
  if (characterLab) {
    characterLab.frame();
    ui.setGameHudComposited(false);
    renderPrimaryScene(dt);
    return;
  }
  input.update();
  if (split2p) {
    input2.update();
    // join/loss toasts: P2's pad is claimed by activity, not slot number
    if (!p2Linked && input2.claimedSlot !== null) {
      p2Linked = true;
      ui.showMessage("P2 JOINED", input2.gamepadName, 1800);
    } else if (p2Linked && input2.claimedSlot === null) {
      p2Linked = false;
      ui.showMessage("P2 PAD LOST", "press any button on it to rejoin", 3000);
    }
  }
  gameFlow.update(nowMs);

  // Controller-only players fire no keydown/pointer gesture, so the audio
  // context would stay suspended until they touched the keyboard. Nudge it from
  // the poll whenever there's any input (a cheap no-op once it's running).
  if (
    input.moveX ||
    input.moveY ||
    input.jumpHeld ||
    input.grindHeld ||
    input.spinHeld ||
    input.grabHeld
  )
    sfx.unlock();

  // EDITOR MODE owns the frame outright (it supersedes pause — the sim is
  // frozen anyway, and the orbit camera + panel must keep responding).
  if (editor.active) {
    editor.update();
    input.consumeEdges();
    acc = 0;
    sky.position.copy(camera.position);
    skyMist.position.copy(camera.position);
    if (bonusParallax.visible)
      bonusParallax.update(player.pos, dt, loadedLevelId);
    updateSeaHorizon();
    ui.setGameHudComposited(false);
    renderPrimaryScene(dt);
    return;
  }

  // Options / P owns the game-native pause stack. The menu controller also
  // routes this edge back out of its nested Options screen.
  if (input.pausePressed) {
    const handled = gameFlow.handlePauseToggle();
    if (!handled && !gameFlow.blocksGameplay) {
      paused = true;
      player.collapseRenderInterpolation();
      if (split2p && p2) p2.collapseRenderInterpolation();
      ui.hideMessage();
      gameFlow.showPause({
        levelName: currentCampaignName(),
        inWarpRoom: current.id === "warproom",
      });
    }
    input.pausePressed = false;
  }

  if (gameFlow.blocksGameplay) {
    input.consumeEdges();
    if (split2p) input2.consumeEdges();
    acc = 0;
    if (resultsCameraActive) updateResultsCamera();
    sfx.stopLoops();
    renderGameplayScene(dt, true, false);
    gameFlow.captureGameplay(renderer.domElement);
    return;
  }
  paused = false;

  // Tell the player where the camera is aiming (XZ) — the lip stall aligns
  // its balance meter + stick axis with the screen using this.
  camera.getWorldDirection(camAimTmp);
  camAimTmp.y = 0;
  if (camAimTmp.lengthSq() > 1e-6) {
    // SNAP TO THE REPLAY'S YAW GRID. camDir is sampled here, on the render
    // clock, but it is consumed by the SIM — the lip stall picks its balance
    // stick axis from it, and in chase-cam mode the whole travel frame is
    // derived from it — so it has to ride in the take like any other input.
    // Quantising it here, before the sim ever reads it, is what makes the
    // number recorded and the number consumed the same by construction (the
    // same trick input.ts plays on the analog axes). 1e-4 rad is 0.006deg.
    const yaw = camYawOf(camAimTmp.normalize());
    player.camDir.set(Math.sin(yaw), 0, Math.cos(yaw));
  }

  acc += dt;
  let simSteps = 0;
  // Tiny epsilon prevents an exact half+half tick from being stranded one RAF
  // by binary floating-point error (the visible symptom is another repeated
  // pose followed by a catch-up step).
  while (acc + 1e-10 >= CONST.fixedStep) {
    // Playback: overwrite the live input with the recorded frame; when the
    // take runs out, reset to a clean level so the next live take is valid.
    if (!split2p && replayer.active && !replayer.feed(input, player.camDir)) {
      ui.setReplayBadge(false);
      ui.showMessage("REPLAY DONE", "", 1200);
      restoreReplayRunRule();
      switchLevel(current.id);
      break;
    }
    // 2P: a reset from EITHER side resets both riders to the start
    if (split2p && (input.restartPressed || input2.restartPressed)) {
      input.restartPressed = true;
      input2.restartPressed = true;
    }
    if (
      !shellBypass &&
      !split2p &&
      input.restartPressed &&
      (bonusSession !== null || current.id === "warproom" || isCampaignLevel(current.id))
    ) {
      input.restartPressed = false;
      restartCurrentRun();
      break;
    }
    player.step(CONST.fixedStep, input, level);
    if (split2p && p2) {
      p2.step(CONST.fixedStep, input2 as unknown as typeof input, level);
      stepPvp(CONST.fixedStep);
    }
    level.update(CONST.fixedStep);
    player.flushLevelCrateRewards(level);
    flushPendingCompletion();
    checkCampaignEntrances();
    // Player.step authors the fixed pose; PVP may then move either root. Only
    // now is the simulation tick complete and safe to publish to rendering.
    player.commitRenderStep(level);
    if (split2p && p2) p2.commitRenderStep(level);
    // record exactly what the sim consumed (edges intact, pre-consume)
    if (!replayer.active && !split2p) recorder.record(input, player.camDir);
    input.consumeEdges(); // one press = one step
    if (split2p) input2.consumeEdges();
    acc = Math.max(0, acc - CONST.fixedStep);
    simSteps++;
    frameStats.totalFixedSteps++;
    if (gameFlow.blocksGameplay) break;
  }

  if (!bonusSession && campaign.active)
    campaign.updateInventory(player.lives, player.fruit);

  const renderAlpha = THREE.MathUtils.clamp(acc / CONST.fixedStep, 0, 1);
  try {
    player.applyRenderInterpolation(renderAlpha);
    if (split2p && p2) p2.applyRenderInterpolation(renderAlpha);

    frameStats.frame++;
    frameStats.rawDt = rawDt;
    frameStats.dt = dt;
    frameStats.simSteps = simSteps;
    frameStats.accumulator = acc;
    frameStats.alpha = renderAlpha;
    frameStats.replayFrame = replayer.frame;
    frameStats.snapVersion = player.renderSnapVersion;
    frameStats.simX = player.pos.x;
    frameStats.simY = player.pos.y;
    frameStats.simZ = player.pos.z;
    frameStats.renderX = player.renderPosition.x;
    frameStats.renderY = player.renderPosition.y;
    frameStats.renderZ = player.renderPosition.z;
    frameStats.speed = player.speed;
    frameStats.vVel = player.vVel;
    frameStats.state = player.state;
    frameStats.grounded = player.grounded;
    frameStats.bailTime = player.bailTimeLeft;
    frameStats.bailRecovery = player.bailRecoveryK;
    frameStats.specialMeter = player.specialMeter;
    frameStats.specialReady = player.specialReady;
    frameStats.specialName = player.activeSpecialName;
    frameStats.specialSequence = player.specialSequence;

    // hold the last shot through the death blackout — no drifting after the
    // corpse; the respawn teleport re-snaps the rig when play resumes
    if (player.state !== "dead" && player.state !== "gameover") updateCamera(dt);
    if (split2p) updateCamera2(dt);
  // Puffs integrate on the RENDER clock, not the fixed step: they are pure
  // decoration with no gameplay authority, and they must billboard against the
  // camera basis that was settled a line ago or they lag the shot by a frame.
  puffStudio?.frame(dt); // spawns from the live preset before the system ticks
  puffs.update(dt, camera);
  swirlStudio?.frame(dt); // parks the preview disc down the lens
  swirls.update(dt, camera);
  fieldStudio?.frame(dt);
  fieldSwirls.update(dt, camera);
  waterStudio?.frame(dt);
  // coast water: the geometry is FIXED in world space — the camera only
  // drives visibility and the reflection viewing direction. The reflection
  // source is the ACTUAL level skybox, so hand it the active sky art (a
  // string compare per frame; reloads only when the sky really changes).
  if (level.water) {
    if (fixedResolutionActive()) {
      level.water.setPreCrtRenderSize(
        renderQualitySizes.inputWidth,
        renderQualitySizes.inputHeight,
      );
    } else {
      level.water.clearPreCrtRenderSize();
    }
    level.water.setQuality(
      level.skyPreset === "coast" &&
      !split2p &&
      !LITE_RENDER &&
      !NO_OCEAN_PASSES
        ? "full"
        : "lite",
    );
    level.water.setSkyUrl(
      import.meta.env.BASE_URL + SKY_PRESETS[activeSky].file,
      SKY_PRESETS[activeSky].fog,
      presetHorizonV(activeSky),
    );
    level.water.update(dt, camera);
  }
  updateAudio(dt);
  sky.position.copy(camera.position);
  skyMist.position.copy(camera.position);
  if (bonusParallax.visible)
    bonusParallax.update(player.pos, dt, loadedLevelId);
  updateSeaHorizon();

  ui.updateBalance(player.balanceMeter);
  ui.updateTTClock(player.ttTime, player.ttFreeze); // every frame: the trial clock is the whole show
  ui.updateBalanceBoost(player.balanceBoostT, 6);
  ui.setHUD(currentHudState(), dt);
  ui.setStats({
    speed: player.speed,
    state: player.state,
    grounded: player.grounded,
    vVel: player.vVel,
    surface: player.surfaceName,
    controller: input.gamepadName,
    jump:
      `${player.lastJumpType} · hold ${player.xHoldT.toFixed(2)}s` +
      ` · skate ${player.skateChargeT.toFixed(2)}/${TUNING.skateHoldTime.toFixed(2)}` +
      (player.skateOn ? " ✓" : ""),
    bail:
      player.bailTimeLeft > 0
        ? `${player.bailTimeLeft.toFixed(2)}s · rise ${player.bailRecoveryK.toFixed(2)}`
        : "-",
    railDist: player.railCandidateDist,
    crates: `${player.cratesBroken}/${level.totalCrates}`,
    fruit: player.fruit,
    masks:
      player.uberTimer > 0
        ? `INVINCIBLE ${player.uberTimer.toFixed(1)}s`
        : String(player.masks),
    time: player.runTime,
  });

  // Walk the shadow frustum onto the skater before drawing — it's small enough
  // to stay sharp, so it has to travel with them.
  updateSunShadow(
    player.renderPosition.x,
    player.renderPosition.y - 1,
    player.renderPosition.z,
  );

  // Unity Beachfront render contract: low-resolution mirrored capture first,
  // then opaque color+depth for refraction/intersection/caustics, then the
  // main water draw and coast-only post chain below. In lite/split mode the
  // ocean's quality switch makes these hooks a cheap feature-disable path.
  level.water?.renderPasses(renderer, scene, camera);

  if (split2p && p2) {
    ui.setGameHudComposited(false);
    const dw = renderer.domElement.width;
    const dh = renderer.domElement.height;
    renderer.setScissorTest(true);
    renderer.setViewport(0, dh / 2, dw, dh / 2);
    renderer.setScissor(0, dh / 2, dw, dh / 2);
    renderer.render(scene, camera);
    renderer.setViewport(0, 0, dw, dh / 2);
    renderer.setScissor(0, 0, dw, dh / 2);
    renderer.render(scene, camera2);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, dw, dh);
  } else {
    renderGameplayScene(dt, false);
  }
  // Single-player fruit/icons/HUD were composed together above. Split screen
  // retains its direct fallback, with each fruit flight confined to its half.
  if (split2p && p2) {
    player.drawFlyingFruit(renderer, 'top');
    p2.drawFlyingFruit(renderer, 'bottom');
  }
  // One shared set of 3D counter icons remains above both split viewports.
  if (split2p && p2) ui.drawIcons(renderer, dt);
    frameStats.cameraTargetX = camTarget.x;
    frameStats.cameraTargetY = camTarget.y;
    frameStats.cameraTargetZ = camTarget.z;
    frameStats.cameraX = camera.position.x;
    frameStats.cameraY = camera.position.y;
    frameStats.cameraZ = camera.position.z;
    frameStats.cameraFov = camera.fov;
    frameStats.cameraSpeedFovBoost = camSpeedFovBoost;
    frameStats.camera2Fov = camera2.fov;
    frameStats.camera2SpeedFovBoost = cam2SpeedFovBoost;
    if (frameProbe) frameProbe.textContent = JSON.stringify(frameStats);
    if (crtDiagnosticsProbe)
      crtDiagnosticsProbe.textContent = JSON.stringify(
        coastPost?.crt?.diagnostics ?? null,
      );
    if (renderDiagnosticsProbe) {
      renderer.getDrawingBufferSize(renderDiagnosticsSize);
      renderDiagnosticsProbe.textContent = JSON.stringify({
        settings: renderQualitySettings.snapshot(),
        active: fixedResolutionActive(),
        sizes: renderQualitySizes,
        drawingBuffer: {
          width: renderDiagnosticsSize.x,
          height: renderDiagnosticsSize.y,
        },
        presentation: coastPost?.resolution ?? null,
        ocean: level.water?.stats ?? null,
        islandFoam: level.shoreFoamDiagnostics,
        hud: ui.gameHudDiagnostics,
        frameLimiter: renderFrameLimiter.stats,
        renderedFrames: frameStats.frame,
      });
    }
    if (lookDiagnosticsProbe)
      lookDiagnosticsProbe.textContent = JSON.stringify(
        coastPost?.lookDiagnostics ?? null,
      );
  } finally {
    // Render interpolation is presentation-only. Gameplay and the next fixed
    // tick must always see the exact current simulation-authored hierarchy.
    player.restoreRenderPose();
    if (split2p && p2) p2.restoreRenderPose();
  }
}
requestAnimationFrame(frame);

// Smoke-test / console-poking hook.
(window as unknown as Record<string, unknown>).__game = {
  puffs,
  PUFF_PRESETS,
  swirls,
  fieldSwirls,
  player,
  level,
  getLevel: () => level,
  input,
  input2,
  TUNING,
  switchLevel,
  scene,
  camera,
  renderer,
  crtGuestSettings,
  crtGuestPanel,
  renderQualitySettings,
  renderQualityPanel,
  skateboardSettings,
  skateboardPanel,
  spinRingSettings,
  spinPanel,
  getRenderQualitySizes: () => ({ ...renderQualitySizes }),
  getRenderFrameLimiterStats: () => renderFrameLimiter.stats,
  getCrtDiagnostics: () => coastPost?.crt?.diagnostics ?? null,
  getGameHudDiagnostics: () => ui.gameHudDiagnostics,
  getSpinEffectDiagnostics: () => player.spinEffectDiagnostics,
  getRopeAnimationDiagnostics: () => player.ropeAnimationDiagnostics,
  getCharacterProportionDiagnostics: () => player.characterProportionDiagnostics,
  getCartoonGloveDiagnostics: () => player.cartoonGloveDiagnostics,
  getRiggedCartoonHandDiagnostics: () => player.riggedCartoonHandDiagnostics,
  getStretchableBoneDiagnostics: () => player.stretchableBoneDiagnostics,
  getMeshyTorsoDiagnostics: () => player.meshyTorsoDiagnostics,
  getMeshyHeadDiagnostics: () => player.meshyHeadDiagnostics,
  getAlternateHeadDiagnostics: () => player.alternateHeadDiagnostics,
  getCharacterHeadStyle: () => player.characterHeadStyle,
  setCharacterHeadStyle: (style: Parameters<typeof player.setCharacterHeadStyle>[0]) =>
    player.setCharacterHeadStyle(style),
  getMeshyShortsDiagnostics: () => player.meshyShortsDiagnostics,
  getProceduralFootwearDiagnostics: () => player.proceduralFootwearDiagnostics,
  getCharacterProportions: () => player.characterProportions,
  getActiveCharacterHeadProfile: () => player.activeCharacterHeadProfile,
  getCharacterHeadProfiles: () => player.characterHeadProfiles,
  setCharacterProportions: (patch: Parameters<typeof player.setCharacterProportions>[0]) =>
    player.setCharacterProportions(patch),
  resetCharacterProportions: () => player.resetCharacterProportions(),
  getCharacterTailVisibility: () => player.characterTailVisible,
  setCharacterTailVisible: (visible: boolean) => player.setCharacterTailVisible(visible),
  toggleCharacterTailVisibility: () => player.toggleCharacterTailVisibility(),
  getLookDiagnostics: () => coastPost?.lookDiagnostics ?? null,
  getIslandShoreFoamDiagnostics: () => level.shoreFoamDiagnostics,
  // playtest capture (also on F8/F9 + tuner buttons + drag-drop):
  exportReplay,
  saveReplay,
  loadReplay,
  toggleVideo,
  replayer,
  recorder,
  frameStats,
  set2P, // debug/harness: force past the 2-pad gate with set2P(true, true)
  getP2: () => p2,
  editor,
  openEditor,
  ui, // debug: drive menu/sync controls from the console/harness
  campaign,
  gameFlow,
  enterBonusRound,
  returnFromBonus,
  showCampaignResults,
  // debug: build/inspect the level list straight from the harness
  levelList,
  findLevel,
  saveUserLevel,
  deleteUserLevel,
  restoreBuiltin,
  getCurrentLevel: () => current,
  GLTFLoader, // debug: inspect model files from the console/harness
  openCharacterLab: openCharacterLabTool,
  openAnimationStudio: openAnimationStudioTool,
  characterAnimationRuntime,
};
