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
  isEditUnlocked,
  checkEditPass,
  DEFAULT_SKY,
  type SkyPreset,
} from "./level";
import { pushLevels, fetchRemoteLevels, getToken, setToken } from "./sync";
import { Player } from "./player";
import { UI } from "./ui";
import { TUNING, CONST } from "./tuning";
import { sfx } from "./audio";
import { Recorder, Replayer, ReplayFile } from "./replay";
import { Editor } from "./editor";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { puffs, PUFF_PRESETS } from "./puffs";
import { swirls } from "./swirls";

const app = document.getElementById("app")!;
// '?lite' (headless smoke) renders in software: no AA, and resize() caps the
// internal resolution — slow frames desync the suite's wall-clock scripting.
const LITE_RENDER = window.location.search.includes("lite");
const renderer = new THREE.WebGLRenderer({ antialias: !LITE_RENDER });
// NATIVE RESOLUTION. The device pixel ratio is the baseline — on a Retina
// panel that is 2x the CSS grid, and rendering below it was the single biggest
// thing making the game look cheap. Capped at 2: past that the pixels are far
// too small to see and it is pure fill-rate.
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
      if (sessionStorage.getItem("protoAutoUpdate") === fresh) return; // tried this one already
      sessionStorage.setItem("protoAutoUpdate", fresh);
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
function updateSunShadow(focusX: number, focusY: number, focusZ: number): void {
  sun.target.position.set(focusX, focusY, focusZ);
  sun.target.updateMatrixWorld();
  sun.position.set(
    focusX + SUN_OFFSET.x,
    focusY + SUN_OFFSET.y,
    focusZ + SUN_OFFSET.z,
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

// Screen dressing: barely-there scanline texture + gentle vignette (styles
// live in index.html). Pure DOM, zero GPU cost — skipped in lite along with
// the rest of the presentation.
if (!LITE) {
  const crt = document.createElement("div");
  crt.className = "crt-overlay";
  document.body.appendChild(crt);
}

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

const cfgSkyTex = (t: THREE.Texture): void => {
  t.colorSpace = THREE.SRGBColorSpace;
  // Plain repeat on a made-seamless image (see makeSeamless): a continuous wrap
  // with no hard seam AND — unlike a mirrored wrap — no bilateral fold axis.
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping; // clamp sky above / faded clouds below
  t.repeat.set(SKY_WRAP, SKY_K); // x: integer wrap (seam-free at the dome UV seam); y: vertical framing
  t.offset.set(0, SKY_HORIZON_V - 0.5 * SKY_K); // horizon -> dome equator
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
function buildSkyLayers(img: HTMLImageElement): SkyLayers {
  const W = img.naturalWidth,
    H = img.naturalHeight;
  const base = makeSeamless(img); // tileable ONCE, both layers share it
  const bg = new THREE.CanvasTexture(base);
  cfgSkyTex(bg);

  const cFg = document.createElement("canvas");
  cFg.width = W;
  cFg.height = H;
  const fx = cFg.getContext("2d")!;
  fx.drawImage(base, 0, 0);
  const ramp = fx.createLinearGradient(0, 0, 0, H);
  ramp.addColorStop(0, "rgba(0,0,0,1)"); // erase the sky
  ramp.addColorStop((SKY_HORIZON_PX - 30) / H, "rgba(0,0,0,1)");
  ramp.addColorStop((SKY_HORIZON_PX + 40) / H, "rgba(0,0,0,0)"); // keep the clouds
  ramp.addColorStop(1, "rgba(0,0,0,0)");
  fx.globalCompositeOperation = "destination-out";
  fx.fillStyle = ramp;
  fx.fillRect(0, 0, W, H);
  fx.globalCompositeOperation = "source-over";
  const mist = new THREE.CanvasTexture(cFg);
  cfgSkyTex(mist); // mist sits at its natural below-horizon position (no lift)
  return { bg, mist };
}

// Fetch a preset's painting once and cache it. Missing files are remembered as
// missing, so a level authored for a time of day whose art hasn't landed yet
// falls back to the procedural gradient instead of retrying every rebuild.
function loadSky(p: SkyPreset): void {
  if (skyCache.has(p) || skyPending.has(p) || skyMissing.has(p)) return;
  skyPending.add(p);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    skyPending.delete(p);
    skyCache.set(p, buildSkyLayers(img));
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
function setEditorView(editing: boolean): void {
  editorViewActive = editing;
  camera.far = editing ? 12000 : 400; // 400 = the play draw distance
  camera.updateProjectionMatrix();
  applyTheme(); // re-applies (or clears) fog for the new mode
}

let proceduralSky: THREE.CanvasTexture | null = null; // the gradient fallback, ours to dispose

function applyTheme(): void {
  const t = level.theme;
  const P = SKY_PRESETS[level.skyPreset] ?? SKY_PRESETS[DEFAULT_SKY];
  activeSky = level.skyPreset;
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
    skyMist.visible = !LITE;
    // cached textures are shared across levels — never dispose them here; only
    // the gradient we painted ourselves is ours to free
    if (proceduralSky) {
      proceduralSky.dispose();
      proceduralSky = null;
    }
    return;
  }
  mat.transparent = false;
  skyMist.visible = false; // no painting, no cloud sea to hang in front
  const grad = makeSkyTexture({
    ...t,
    skyTop: P.top,
    skyBottom: P.bottom,
    fog: P.fog,
    stars: P.stars,
    // sunset keeps the level's own sun; day swaps in a white noon one; night
    // has none, or the sky ends up with a noon sun blazing in it
    // "" reads falsy in makeSkyTexture, which is its "no disc" test
    sunColorHex: P.sunHex === null ? "" : (P.sunHex ?? t.sunColorHex),
  });
  mat.map = grad;
  mat.needsUpdate = true;
  if (proceduralSky) proceduralSky.dispose();
  proceduralSky = grad;
}

// Slightly wide lens: exaggerates depth so corridors read longer, while the
// close rig below keeps the skater big in frame. The boulder chase swaps to a
// tighter, telephoto lens (updateCamera lerps toward it) — narrowing the FOV
// compresses depth so the runway lays out flat and readable instead of
// crushing to a foreshortened sliver at the horizon.
const BOULDER_FOV = 27;
const camera = new THREE.PerspectiveCamera(TUNING.camFov, 1, 0.1, 400);
// 2P split state (functions live further down, past the player):
let split2p = false;
let p2: Player | null = null;
const input2 = new Input(true); // pad-only: claims its own gamepad, no keyboard/touch
const camera2 = new THREE.PerspectiveCamera(TUNING.camFov, 1, 0.1, 400);
const cam2F = new THREE.Vector3(0, 0, -1);
let p2Linked = false; // P2 has claimed a pad (join/loss toasts key off this)
const pvpKicks = new Map<Player, { x: number; z: number; t: number }>();

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
  // Native resolution, always. The headless smoke mode is the one exception:
  // it renders at half size purely to keep the software rasteriser quick.
  const rs = LITE_RENDER ? 0.5 : 1;
  renderer.setSize(Math.round(w * rs), Math.round(h * rs), false);
  renderer.domElement.style.imageRendering = "";
  camera.aspect = split2p ? w / (h / 2) : w / h;
  camera.updateProjectionMatrix();
  camera2.aspect = camera.aspect;
  camera2.updateProjectionMatrix();
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
const recorder = new Recorder();
const replayer = new Replayer();
adoptLegacyLevels(); // one-shot: old single-slot edits become real user levels
let current: LevelEntry =
  findLevel(localStorage.getItem("protoLevelId") ?? "") ??
  findLevel(DEFAULT_LEVEL_ID)!;
let level = new Level(scene, current);
// PS1 smoke and dust. One system for every soft effect; it owns its own pooled
// buffers and adds a handful of meshes to the scene that outlive level swaps
// (they carry userData.shared, so Level.dispose() leaves them alone).
puffs.attach(scene);
// ?lite is the low-end path everywhere else in this file, so it is here too:
// fewer puffs, simpler rings, no child layers.
puffs.setQuality(LITE_RENDER ? "low" : "high");
// Swirls: the polar-grid wormhole/scenery discs (see src/swirls.ts).
swirls.attach(scene);
const player = new Player(scene);

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
let runModesOn = localStorage.getItem("protoRunModes") !== "off";
function applyRunModes(): void {
  const on = runModesOn && !split2p;
  level.setRunModesEnabled(on);
  ui.setRunModes(runModesOn);
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
    if (editor.active) editor.exit();
    if (replayer.active) {
      replayer.end();
      ui.setReplayBadge(false);
    }
    if (!p2) {
      p2 = new Player(scene);
      // The second rider's fruit needs the same two wires P1 got, or its
      // collected wumpa are parked on a scene nothing renders and simply
      // vanish. Its own lens; the one shared HUD counter.
      p2.cam = camera2;
      p2.hudFruitAt = () => ui.fruitIconAt();
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
    applyRunModes();
    ui.set2P(true);
    ui.showMessage(
      "2-PLAYER SPLIT",
      "P2 (blue, bottom): press ✕ on the OTHER pad to join",
      4200,
    );
  } else {
    split2p = false;
    if (p2) p2.group.visible = false;
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
  const V = vic as unknown as Record<string, number & boolean>;
  if (vic.state === "dead" || vic.state === "gameover" || atk.state === "dead")
    return;
  const dx = vic.pos.x - atk.pos.x;
  const dz = vic.pos.z - atk.pos.z;
  const planar = Math.hypot(dx, dz);
  const ux = planar > 1e-4 ? dx / planar : 1;
  const uz = planar > 1e-4 ? dz / planar : 0;
  const dy = vic.pos.y - atk.pos.y;
  const knock = (kick: number, pop: number): void => {
    if (
      (V.bailDownT as number) > 0 ||
      (V.invulnTimer as number) > 0 ||
      (V.uberTimer as number) > 0
    )
      return;
    (V.bailDownT as number) = 0.9;
    (V.invulnTimer as number) = 1.1; // no juggle-locking the loser
    vic.state = "air";
    (V.grounded as boolean) = false;
    (V.vVel as number) = pop;
    (V.speed as number) = (V.speed as number) * 0.3;
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
  if (camera2.fov !== camera.fov || camera2.aspect !== camera.aspect) {
    camera2.fov = camera.fov;
    camera2.aspect = camera.aspect;
    camera2.updateProjectionMatrix();
  }
  const lf = level.laneDirAt(p2.pos.x, p2.pos.y, p2.pos.z, p2.laneCursor) ?? { x: 0, z: -1 };
  cam2F.x += (lf.x - cam2F.x) * Math.min(1, 3.5 * dt);
  cam2F.z += (lf.z - cam2F.z) * Math.min(1, 3.5 * dt);
  cam2F.y = 0;
  if (cam2F.lengthSq() < 1e-4) cam2F.set(0, 0, -1);
  cam2F.normalize();
  const tx = p2.pos.x - cam2F.x * TUNING.camDist;
  const tz = p2.pos.z - cam2F.z * TUNING.camDist;
  const ty = p2.pos.y + TUNING.camHeight * 0.85;
  const k = Math.min(1, 9 * dt);
  camera2.position.x += (tx - camera2.position.x) * k;
  camera2.position.y += (ty - camera2.position.y) * k;
  camera2.position.z += (tz - camera2.position.z) * k;
  camera2.lookAt(
    p2.pos.x + cam2F.x * 3,
    p2.pos.y + 1.2,
    p2.pos.z + cam2F.z * 3,
  );
  p2.camDir.set(cam2F.x, 0, cam2F.z);
}
player.cam = camera; // collected wumpa fly to the HUD counter — the flight needs the lens
// ...and it needs to know where the counter IS. Read live off the icon's own
// box rather than a guessed corner: the HUD is sized in vh and the counter
// hides entirely during a run mode.
player.hudFruitAt = () => ui.fruitIconAt();
player.enterLevel(current.id);
player.respawn(level, true);
applyRunModes(); // the saved MENU switch decides whether the pickups are there
applyTheme();
recorder.start(current.id); // the take always runs: level load -> now

// Every solid mesh in the world both casts and receives. It's a whole-scene
// traverse rather than per-builder flags because the builders are hundreds of
// call sites and a missed one reads as a hole in the lighting. Things that are
// not surfaces opt out with userData.noShadow: the sky dome, the water/lava
// planes, the blob shadow and landing X, particle sprites, editor ghosts.
function applyShadowFlags(): void {
  scene.traverse((o) => {
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

function switchLevel(id: string): void {
  // An id that no longer exists — a deleted user level, a replay or saved
  // editor target from an older list — resolves to the default course rather
  // than taking the whole game down on entry.name.toUpperCase().
  const entry = findLevel(id) ?? findLevel(DEFAULT_LEVEL_ID)!;
  current = entry;
  localStorage.setItem("protoLevelId", entry.id);
  if (replayer.active) {
    // a manual level switch cancels a running replay (and restores tuning)
    replayer.end();
    ui.setReplayBadge(false);
  }
  if (editor.active && editor.targetId !== entry.id) editor.exit(); // leaving the level under edit closes it
  level.dispose();
  puffs.clear(); // no cloud from the level you just left hanging over the new one
  swirls.clear();
  level = new Level(scene, entry);
  puffs.attach(scene);
  // Adopt the target level's relic shelf BEFORE respawning, so the run just
  // left banks its crystal and gems against the level they were earned in.
  player.enterLevel(entry.id);
  player.respawn(level, true);
  if (split2p && p2) {
    p2.enterLevel(entry.id);
    p2.respawn(level, true);
    p2.pos.x += 1.6;
  }
  applyRunModes(); // the new level's pickups obey the switch too
  applyTheme();
  applyShadowFlags();
  ui.setLevel(entry.id);
  ui.showMessage(entry.name.toUpperCase(), "", 1400);
  recorder.start(entry.id); // fresh take from this load
  (window as unknown as Record<string, unknown>).__game &&
    ((
      (window as unknown as Record<string, unknown>).__game as Record<
        string,
        unknown
      >
    ).level = level);
}

// ---- level editor ----------------------------------------------------------
// Every edit rebuilds the level under edit from its data, so edit = play
// truth. The editor only ever binds to a USER level, and openEditor has
// already switched to it — so `current` is the level being edited. Named,
// because entering and leaving the editor rebuild too (scenery is baked for
// play and loose for editing — see setEditorBuild).
function rebuildLevel(): void {
  current = findLevel(current.id) ?? current; // pick up the just-saved data/name
  level.dispose();
  puffs.clear();
  swirls.clear();
  level = new Level(scene, current);
  puffs.attach(scene);
  player.respawn(level, true);
  applyRunModes();
  applyTheme();
  recorder.start(current.id);
  (window as unknown as Record<string, unknown>).__game &&
    ((
      (window as unknown as Record<string, unknown>).__game as Record<
        string,
        unknown
      >
    ).level = level);
  editor.onLevelRebuilt();
}
const editor = new Editor(scene, camera, renderer.domElement, () => level, {
  rebuild: () => rebuildLevel(),
  // The editor renamed / duplicated / deleted a level: the menu is stale.
  levelsChanged: (goTo?: string) => {
    if (goTo && goTo !== current.id) switchLevel(goTo);
    else {
      current = findLevel(current.id) ?? current;
      level.name = current.name; // a rename is live, without a rebuild
    }
    ui.refreshLevels(current.id);
  },
  exitToPlay: () => {
    editor.exit(); // clears the editor build mode
    rebuildLevel(); // ...and this bakes the scenery back down for play
    player.respawn(level, true);
    ui.showMessage("TEST RUN", "press ✎ LEVEL EDITOR to keep editing", 1600);
  },
  showMsg: (t, s) => ui.showMessage(t, s ?? "", 1800),
  // drop fog + extend the far plane on enter, restore on every exit path
  setView: (editing) => setEditorView(editing),
});
// Open the editor on a level (default: whatever is loaded). A level that has
// never been edited has no data to bind to, so it goes through editLevel,
// which captures it first.
// ── the model studio (src/studio.ts) ──────────────────────────────────────
// A dev tool for the questions that are only answerable by eye — which
// polygons of an authored model are junk, where the tail sits, what colour it
// is. Lazy: nothing of it is fetched until somebody asks for it.
let studio: { frame: () => void } | null = null;
async function openStudioTool(): Promise<void> {
  if (studio) return;
  const mod = await import("./studio");
  studio = mod.openStudio({ renderer, scene, camera, player, onClose: () => (studio = null) });
}
// Openable WITHOUT a console, because the person whose eyes this borrows is
// playing the deployed build on a phone or a laptop, not sitting in devtools:
// put #studio on the URL. Deferred so the character model is installed and
// there is something to click before the panel appears.
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
// The SWIRL studio: wormhole and scenery-swirl discs. #swirlstudio on the URL.
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
if (location.hash.toLowerCase().includes("puffstudio")) {
  setTimeout(() => void openPuffStudioTool(), 2500);
} else if (location.hash.toLowerCase().includes("swirlstudio")) {
  setTimeout(() => void openSwirlStudioTool(), 2500);
} else if (location.hash.toLowerCase().includes("studio")) {
  // Long enough for the character GLB to land. The studio re-reads the body on
  // every interaction anyway, so this is only about what you see first.
  setTimeout(() => void openStudioTool(), 5000);
}

function openEditor(target: string = current.id): void {
  if (split2p) set2P(false); // the editor is a one-player room
  if (editor.active) return;
  const entry = findLevel(target);
  if (!entry) return;
  if (!entry.data) {
    editLevel(entry.id);
    return;
  }
  if (current.id !== entry.id) switchLevel(entry.id);
  // clear anything that could sit over/under the editor: a paused sim, a
  // dead/game-over player, the death overlay
  paused = false;
  ui.hideMessage();
  player.respawn(level, true);
  ui.showDeathScreen(false);
  // Scenery is baked into shared meshes for play and cannot be clicked in
  // that form, so opening the editor rebuilds it loose. Only when the flag
  // actually flips — reopening the editor twice must not rebuild twice.
  if (setEditorBuild(true)) rebuildLevel();
  editor.enter(entry);
}
// MENU / TUNER while the editor owns the screen: the play panels are hidden
// under the tools, so a tab tap first CLOSES the editor (edits are already
// saved live) and drops back to play — then the panel opens normally.
ui.onSideTab = () => {
  if (!editor.active) return;
  editor.exit(); // clears the editor build mode
  rebuildLevel(); // ...and this bakes the scenery back down for play
  player.respawn(level, true);
  ui.showMessage("EDITOR CLOSED", "press ✎ LEVEL EDITOR to keep editing", 1600);
};
// EDIT THIS LEVEL — the level itself, not a copy of it. A level that already
// builds from data opens straight in the editor. A BUILT-IN has no data yet,
// so the first edit captures its geometry into components and stores that
// under the SAME id: it keeps its name, its place in the menu and its best
// times, and from then on it IS the edited version. The hand-coded builder is
// still underneath — "restore original" in the editor drops the edits and
// hands the shipped design back.
//
// Bespoke set pieces without a component language (side-scroll zones,
// sky-ropes, decor foliage) don't survive the capture — what you get is the
// editable geometry.
function editLevel(id: string): void {
  const entry = findLevel(id);
  if (!entry) return;
  if (entry.data) {
    openEditor(id);
    return;
  }
  if (current.id !== id) switchLevel(id); // capture reads the LIVE level
  const data = level.captureData();
  data.name = entry.name; // in place — not "(copy)"
  saveUserLevel({ id: entry.id, name: entry.name, data });
  switchLevel(entry.id); // rebuild: the level now IS its captured data
  ui.refreshLevels(entry.id);
  openEditor(entry.id);
  ui.showMessage(
    `EDITING ${entry.name.toUpperCase()}`,
    "edits save to this level — restore original is in the PROJECT tab",
    2600,
  );
}
ui.onLevelEdit = (id: string) => editLevel(id);
// NEW: a blank slate that joins the menu immediately.
ui.onLevelNew = () => {
  const data = starterCustomLevel();
  data.name = "New Level";
  const id = saveUserLevel({ id: "", name: data.name, data });
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
  if (!data) return false;
  const id = saveUserLevel({ id: "", name, data });
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
  localStorage.setItem("protoCloudPulled", "1");
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
if (localStorage.getItem("protoEditorOpen") === "1") {
  const t = localStorage.getItem("protoEditorTarget") ?? "";
  // a stale target (older build, deleted level) must not reopen on the wrong
  // level — the editor autosaves, so that would overwrite it
  if (findLevel(t)) setTimeout(() => openEditor(t), 0);
  else {
    localStorage.removeItem("protoEditorOpen");
    localStorage.removeItem("protoEditorTarget");
  }
}

// ---- CROSS-DEVICE SYNC: first-run pull ------------------------------------
// A device that has never pulled and has no levels of its own adopts the
// published list, so a phone picks up everything the Mac pushed with zero
// setup. After that the list is yours: RESTORE FROM CLOUD is the only thing
// that overwrites it, so a fetch can never eat your edits and a level you
// deleted stays deleted.
void (async () => {
  if (localStorage.getItem("protoCloudPulled") === "1") return;
  if (getUserLevels().length) {
    localStorage.setItem("protoCloudPulled", "1"); // this device authored its own
    return;
  }
  const remote = (await fetchRemoteLevels()) as { levels?: LevelEntry[] } | null;
  if (!remote || !Array.isArray(remote.levels)) return;
  setUserLevels(remote.levels);
  localStorage.setItem("protoCloudPulled", "1");
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

function loadReplay(data: ReplayFile): void {
  if (!findLevel(data.level)) {
    ui.showMessage("REPLAY LEVEL MISSING", String(data.level), 2200);
    return;
  }
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
ui.onLevelSelect = switchLevel;
ui.onToggle2P = () => set2P(!split2p);
ui.onToggleRunModes = () => {
  runModesOn = !runModesOn;
  localStorage.setItem("protoRunModes", runModesOn ? "on" : "off");
  applyRunModes();
  ui.showMessage(
    runModesOn ? "TIME TRIAL + COMBO ON" : "TIME TRIAL + COMBO OFF",
    runModesOn ? "the stopwatch and the orb are back" : "plain platforming",
    1400,
  );
};
player.onComboBank = (amount) => ui.comboBank(amount);
player.onComboBail = () => ui.comboBail();
// Debug cheat: clicking the HUD face banks an extra life.
ui.onLifeCheat = () => {
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
player.onFinish = (time) => {
  // the gate tallies the collectathon haul alongside the clear time
  const gem = player.gemEarned
    ? "gem ✓"
    : `gem ✗ (${player.cratesBroken}/${level.totalCrates} boxes)`;
  const crystal = player.hasCrystal ? "crystal ✓" : "crystal ✗";
  ui.showMessage(
    "COURSE CLEAR!",
    `time ${time.toFixed(2)}s — ${crystal} · ${gem} — press R / Options to go again`,
    0,
  );
};
player.onRespawn = () => {
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
      (JSON.parse(localStorage.getItem("protoTTtimes") ?? "{}") as Record<
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
  localStorage.setItem("protoTTtimes", JSON.stringify(all));
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
  const { list, rank } = recordTT(current.id, time);
  ui.setTimeTrial(false);
  ui.showTTResults(time, list, rank);
};
player.onCheckpoint = () => ui.showMessage("CHECKPOINT", "", 900);
player.onGameOver = () => ui.showDeathScreen(true);

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
// camHeight, camTilt, camOffset, camFov. The hand-tuned defaults
// are unchanged; special shots (side-scroll, boulder) scale relative to them.
const camTarget = new THREE.Vector3();
const lookPoint = new THREE.Vector3();
const camAimTmp = new THREE.Vector3();
let camAnchorY = 0; // the rig's vertical anchor: the ground under the skater, eased
let camRoll = 0; // eased dutch roll tracking the grind balance needle (radians)
const aimSmooth = new THREE.Vector3(NaN, 0, 0); // lightly-damped look target (NaN = seed on first frame)
let camBack = 0; // 0 = facing down-course, eases to 1 while travelling at the camera
let sideF = 0; // eases to 1 on turned (X-running) stretches: wider framing only
let boulderF = 0; // eases to 1 on boulder-chase levels: tipped-down framing
const prevPlayerPos = new THREE.Vector3();
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
  // ONE rig, always facing down -Z. When the path right-angles into an
  // X-running stretch, the same camera sees it side-on — no yaw, just a
  // slightly wider, higher frame with less forward lead.
  // CHASE CAM ignores zones — the rig yaws behind the player instead.
  const chaseOn = TUNING.chaseCam > 0.5 && !level.boulder;
  // side framing only on E/W stretches — a run-at-camera ('N') zone keeps the
  // normal corridor shot: the fixed lens IS the chase framing there
  const znHere = level.zoneAt(player.pos.x, player.pos.z);
  const inTurn =
    !chaseOn && znHere !== null && (znHere.dir === "E" || znHere.dir === "W");
  sideF += ((inTurn ? 1 : 0) - sideF) * Math.min(1, 3.5 * dt);

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
  boulderF += ((level.boulder ? 1 : 0) - boulderF) * Math.min(1, 3 * dt);
  const targetFov = THREE.MathUtils.lerp(TUNING.camFov, BOULDER_FOV, boulderF);
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
  const vx = dt > 0 ? (player.pos.x - prevPlayerPos.x) / dt : 0;
  const vz = dt > 0 ? (player.pos.z - prevPlayerPos.z) / dt : 0;
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
  const lf = chaseOn ? chaseF : level.laneDirAt(player.pos.x, player.pos.y, player.pos.z, player.laneCursor);
  const turnK = Math.min(1, (chaseOn ? 1.6 : 3.5) * dt);
  camF.x += ((lf ? lf.x : 0) - camF.x) * turnK;
  camF.z += ((lf ? lf.z : -1) - camF.z) * turnK;
  camF.y = 0;
  if (camF.lengthSq() < 1e-4) camF.set(lf ? lf.x : 0, 0, lf ? lf.z : -1); // 180° pinch guard
  camF.normalize();

  const vAlong =
    dt > 0
      ? ((player.pos.x - prevPlayerPos.x) * camF.x +
          (player.pos.z - prevPlayerPos.z) * camF.z) /
        dt
      : 0;
  prevPlayerPos.copy(player.pos);
  // chase mode swings around behind instead of dollying back
  const movingBack =
    !chaseOn && (vAlong < -2.5 || (player.grounded && player.speed < -1.5));
  camBack += ((movingBack ? 1 : 0) - camBack) * Math.min(1, 3 * dt);
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
      ? Math.max(floorY, player.pos.y - maxRise)
      : Math.max(camAnchorY, player.pos.y - maxRise);
  camAnchorY += (anchorGoal - camAnchorY) * Math.min(1, 4.5 * dt);
  // camAirLift: how much the rig rides UP with airborne height. 1 = classic
  // full-follow (the camera rises with the jump, so airs read small and snappy
  // on screen); 0 = pure ground anchor (the skater does all the on-screen
  // rising — same physics, but every air reads much bigger and floatier).
  const airLift = Math.max(TUNING.camAirLift, boulderF);
  const effY = THREE.MathUtils.lerp(camAnchorY, player.pos.y, airLift);
  // the gentle jump tilt also softens on tight lenses (magnified on screen);
  // kept small overall — the ground stays in shot, the skater does the rising
  const tiltTrack = 0.22 * Math.min(1, frameHalf / 4.5);

  camTarget.set(
    player.pos.x - camF.x * (dist - off),
    effY + height,
    player.pos.z - camF.z * (dist - off),
  );

  // Snap after respawn teleports; damp otherwise.
  if (camera.position.distanceTo(camTarget) > 30) {
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
    player.pos.x - camF.x * aimK,
    effY +
      Math.max(-2.5, (player.pos.y - effY) * tiltTrack) +
      THREE.MathUtils.lerp(aimY, 1.6, boulderF),
    player.pos.z - camF.z * aimK,
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
  .copy(player.pos)
  .addScaledVector(new THREE.Vector3(0, 0, 1), TUNING.camDist);
camera.position.y += TUNING.camHeight;

// --- fixed-step loop --------------------------------------------------------
const clock = new THREE.Clock();
let acc = 0;
let stepTimer = 0;
let stepIdx = 0;

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

let paused = false;

function frame(): void {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  // The model studio takes the stage: it owns the camera, the sim stands down,
  // and the world is still drawn so there is something to point at. Everything
  // else in this function is skipped, which is also what stops the game
  // reading input while somebody is dragging sliders.
  if (studio) {
    // No sim: the tail sits in its REST pose, which is the pose you actually
    // want to judge a shape against, and nothing moves under the cursor while
    // you are trying to click a polygon.
    studio.frame();
    renderer.render(scene, camera);
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
    renderer.render(scene, camera);
    return;
  }

  // Options / P toggles pause: the sim stops dead, the frame still renders.
  if (input.pausePressed) {
    paused = !paused;
    if (paused) ui.showMessage("PAUSED", "Options / P to resume", 0);
    else ui.hideMessage();
  }
  if (paused) {
    input.consumeEdges(); // presses while paused must not fire on resume
    acc = 0;
    renderer.render(scene, camera);
    return;
  }

  // Tell the player where the camera is aiming (XZ) — the lip stall aligns
  // its balance meter + stick axis with the screen using this.
  camera.getWorldDirection(camAimTmp);
  camAimTmp.y = 0;
  if (camAimTmp.lengthSq() > 1e-6) player.camDir.copy(camAimTmp.normalize());

  acc += dt;
  while (acc >= CONST.fixedStep) {
    // Playback: overwrite the live input with the recorded frame; when the
    // take runs out, reset to a clean level so the next live take is valid.
    if (!split2p && replayer.active && !replayer.feed(input)) {
      ui.setReplayBadge(false);
      ui.showMessage("REPLAY DONE", "", 1200);
      switchLevel(current.id);
      break;
    }
    // 2P: a reset from EITHER side resets both riders to the start
    if (split2p && (input.restartPressed || input2.restartPressed)) {
      input.restartPressed = true;
      input2.restartPressed = true;
    }
    player.step(CONST.fixedStep, input, level);
    if (split2p && p2) {
      p2.step(CONST.fixedStep, input2 as unknown as typeof input, level);
      stepPvp(CONST.fixedStep);
    }
    level.update(CONST.fixedStep);
    // record exactly what the sim consumed (edges intact, pre-consume)
    if (!replayer.active && !split2p) recorder.record(input);
    input.consumeEdges(); // one press = one step
    if (split2p) input2.consumeEdges();
    acc -= CONST.fixedStep;
  }

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
  updateAudio(dt);
  sky.position.copy(camera.position);
  skyMist.position.copy(camera.position);

  ui.updateBalance(player.balanceMeter);
  ui.updateTTClock(player.ttTime, player.ttFreeze); // every frame: the trial clock is the whole show
  ui.updateBalanceBoost(player.balanceBoostT, 6);
  const tricks = player.comboLabels;
  ui.setHUD({
    points: player.points,
    comboPoints: player.comboPoints,
    comboMult: player.comboMult,
    comboHasTrick: player.comboHasTrick,
    tricks: (tricks.length > 6 ? "… + " : "") + tricks.slice(-6).join(" + "),
    fruit: player.fruit,
    lives: Math.max(0, player.lives),
    crates: `${player.cratesBroken}/${level.totalCrates}`,
    hasCrystal: player.hasCrystal,
    hasGem: player.gemEarned,
    hasComboGem: player.comboGemEarned,
  });
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
  updateSunShadow(player.pos.x, player.pos.y - 1, player.pos.z);

  if (split2p && p2) {
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
    renderer.render(scene, camera);
  }
  // Collected fruit sails to the counter on its own flat layer, over the
  // finished world and under the HUD icons it is flying to. In split screen
  // each rider's flight is confined to that rider's half.
  if (split2p && p2) {
    player.drawFlyingFruit(renderer, 'top');
    p2.drawFlyingFruit(renderer, 'bottom');
  } else {
    player.drawFlyingFruit(renderer);
  }
  // The crate, fruit and relic HUD icons are real 3D, spun and drawn over the
  // finished frame into each icon's own DOM box.
  ui.drawIcons(renderer, dt);
}
frame();

// Smoke-test / console-poking hook.
(window as unknown as Record<string, unknown>).__game = {
  puffs,
  PUFF_PRESETS,
  swirls,
  player,
  level,
  input,
  input2,
  TUNING,
  switchLevel,
  scene,
  camera,
  renderer,
  // playtest capture (also on F8/F9 + tuner buttons + drag-drop):
  exportReplay,
  saveReplay,
  loadReplay,
  toggleVideo,
  replayer,
  recorder,
  set2P, // debug/harness: force past the 2-pad gate with set2P(true, true)
  getP2: () => p2,
  editor,
  openEditor,
  ui, // debug: drive menu/sync controls from the console/harness
  // debug: build/inspect the level list straight from the harness
  levelList,
  findLevel,
  saveUserLevel,
  deleteUserLevel,
  restoreBuiltin,
  getCurrentLevel: () => current,
  GLTFLoader, // debug: inspect model files from the console/harness
  openStudio: openStudioTool, // point-and-click answers: __game.openStudio()
};
