// Entry point: renderer, Crash-style corridor camera, and the deterministic
// fixed-step game loop.

import * as THREE from 'three';
import { Input } from './input';
import { Level, LEVEL_NAMES, setCustomLevelData } from './level';
import { Player } from './player';
import { UI } from './ui';
import { TUNING, CONST } from './tuning';
import { sfx } from './audio';
import { Recorder, Replayer, ReplayFile } from './replay';
import { Editor } from './editor';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const app = document.getElementById('app')!;
// '?lite' (headless smoke) renders in software: no AA, and resize() caps the
// internal resolution — slow frames desync the suite's wall-clock scripting.
const LITE_RENDER = window.location.search.includes('lite');
const renderer = new THREE.WebGLRenderer({ antialias: !LITE_RENDER });
renderer.setPixelRatio(1); // internal res is the renderScale knob, not the DPR
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232634);
scene.fog = new THREE.Fog(0x232634, 30, 170);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x8a6b46, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4ae, 1.55);
sun.position.set(30, 60, 20);
scene.add(sun);
// Cool fill from opposite the sun: faint sky-colored bounce so the faces the
// key misses keep a hint of shape instead of going dead flat. No shadows.
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.25);
fill.position.set(-30, 25, -20);
scene.add(fill);

// '?lite' strips the pure-visual layers (sky dome, ambient particles) — used
// by the headless smoke autopilot, where software rendering can't afford the
// fill rate and slow frames desync its wall-clock input scripting.
const LITE = window.location.search.includes('lite');

// Screen dressing: barely-there scanline texture + gentle vignette (styles
// live in index.html). Pure DOM, zero GPU cost — skipped in lite along with
// the rest of the presentation.
if (!LITE) {
  const crt = document.createElement('div');
  crt.className = 'crt-overlay';
  document.body.appendChild(crt);
}

// Sky dome: a big inward-facing sphere that follows the camera, painted with
// each level's gradient + sun + stars. Sits behind everything, ignores fog.
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(370, 24, 12),
  new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false }),
);
sky.renderOrder = -1;
sky.frustumCulled = false;
sky.visible = !LITE;
scene.add(sky);

// --- sky painting ------------------------------------------------------------
// Theme colors arrive as both '#rrggbb' strings and 0xrrggbb numbers; the
// painter mixes everything in plain [r, g, b] so it works for every level
// without touching the theme shape.
type RGB = [number, number, number];
function rgbOf(c: string | number): RGB {
  const n = typeof c === 'number' ? c : parseInt(c.slice(1), 16);
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

function makeSkyTexture(t: Level['theme']): THREE.CanvasTexture {
  const W = 512;
  const H = 512; // taller than the old 256: the horizon band needs the rows
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
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
    ctx.fillRect(0, Math.round((i / BANDS) * skyH), W, Math.round(skyH / BANDS));
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
  return new THREE.CanvasTexture(canvas);
}

function applyTheme(): void {
  const t = level.theme;
  scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  scene.background = new THREE.Color(t.fog);
  hemi.color.set(t.hemiSky);
  // ground bounce leans toward warm sand: every theme reads a touch tropical
  hemi.groundColor.set(t.hemiGround).lerp(new THREE.Color(0xc79a62), 0.3);
  hemi.intensity = t.hemiI;
  // key light nudged warmer and brighter than the theme asks — golden-hour key
  sun.color.set(t.sunColor).lerp(new THREE.Color(0xffc46a), 0.15);
  sun.intensity = t.sunI * 1.1;
  // the counter-light stays a fraction of the sky light so it never competes
  fill.color.set(t.hemiSky);
  fill.intensity = t.hemiI * 0.22;
  const mat = sky.material as THREE.MeshBasicMaterial;
  const old = mat.map;
  mat.map = makeSkyTexture(t);
  mat.needsUpdate = true;
  if (old) old.dispose();
}

// Slightly wide lens: exaggerates depth so corridors read longer, while the
// close rig below keeps the skater big in frame. The boulder chase swaps to a
// tighter, telephoto lens (updateCamera lerps toward it) — narrowing the FOV
// compresses depth so the runway lays out flat and readable instead of
// crushing to a foreshortened sliver at the horizon.
const BOULDER_FOV = 27;
const camera = new THREE.PerspectiveCamera(TUNING.camFov, 1, 0.1, 400);

function resize(): void {
  const w = window.innerWidth;
  let h = window.innerHeight;
  // iOS standalone (home-screen) quirk: the layout viewport stops ABOVE the
  // home indicator and that strip never gets painted — a permanent black bar.
  // The screen knows the true height, so size the page past the viewport to
  // the physical edge (portrait only; --vh feeds the html/body/#app CSS).
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone && h > w && window.screen.height > h) h = window.screen.height;
  document.documentElement.style.setProperty('--vh', h + 'px');
  const rs = LITE_RENDER ? Math.min(TUNING.renderScale, 0.5) : TUNING.renderScale;
  renderer.setSize(Math.round(w * rs), Math.round(h * rs), false);
  // Upscale sampling follows the scale: chunky pixels only when the slider is
  // pulled into PS1 territory; at 0.7+ the stretch stays smooth.
  renderer.domElement.style.imageRendering = TUNING.renderScale < 0.7 ? 'pixelated' : '';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
// iOS standalone launches don't reliably fire 'resize' once the viewport
// settles behind the Dynamic Island / home indicator — catch the stragglers.
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
setTimeout(resize, 400);
setTimeout(resize, 1200);
resize();
// renderScale is a live tuner slider; the frame loop re-resizes when it moves.
let appliedScale = TUNING.renderScale;

const input = new Input();
const ui = new UI();
const recorder = new Recorder();
const replayer = new Replayer();
let currentCourse = Math.min(LEVEL_NAMES.length - 1, Math.max(0, Number(localStorage.getItem('protoLevel')) || 0));
let level = new Level(scene, currentCourse);
const player = new Player(scene);
player.cam = camera; // collected wumpa fly to the HUD counter — the flight needs the lens
player.respawn(level, true);
applyTheme();
recorder.start(currentCourse); // the take always runs: level load -> now

function switchLevel(id: number): void {
  currentCourse = id;
  localStorage.setItem('protoLevel', String(id));
  if (replayer.active) {
    // a manual level switch cancels a running replay (and restores tuning)
    replayer.end();
    ui.setReplayBadge(false);
  }
  if (editor.active && id !== 7) editor.exit(); // leaving Custom closes the editor
  level.dispose();
  level = new Level(scene, id);
  player.respawn(level, true);
  applyTheme();
  ui.setLevel(id);
  ui.showMessage(LEVEL_NAMES[id].toUpperCase(), '', 1400);
  recorder.start(id); // fresh take from this load
  (window as unknown as Record<string, unknown>).__game &&
    (((window as unknown as Record<string, unknown>).__game as Record<string, unknown>).level = level);
}

// ---- level editor (Custom level, slot 8) -----------------------------------
const editor = new Editor(scene, camera, renderer.domElement, () => level, {
  // every edit rebuilds the custom level from data, so edit = play truth
  rebuild: () => {
    level.dispose();
    level = new Level(scene, 7);
    player.respawn(level, true);
    applyTheme();
    recorder.start(7);
    (window as unknown as Record<string, unknown>).__game &&
      (((window as unknown as Record<string, unknown>).__game as Record<string, unknown>).level = level);
    editor.onLevelRebuilt();
  },
  exitToPlay: () => {
    editor.exit();
    player.respawn(level, true);
    ui.showMessage('TEST RUN', 'press ✎ LEVEL EDITOR to keep editing', 1600);
  },
  showMsg: (t, s) => ui.showMessage(t, s ?? '', 1800),
});
function openEditor(): void {
  if (editor.active) return;
  if (currentCourse !== 7) switchLevel(7);
  // clear anything that could sit over/under the editor: a paused sim, a
  // dead/game-over player, the death overlay
  paused = false;
  ui.hideMessage();
  player.respawn(level, true);
  ui.showDeathScreen(false);
  editor.enter();
}
ui.onEditorOpen = openEditor;
// MENU / TUNER while the editor owns the screen: the play panels are hidden
// under the tools, so a tab tap first CLOSES the editor (edits are already
// saved live) and drops back to play — then the panel opens normally.
ui.onSideTab = () => {
  if (!editor.active) return;
  editor.exit();
  player.respawn(level, true);
  ui.showMessage('EDITOR CLOSED', 'press ✎ LEVEL EDITOR to keep editing', 1600);
};
// EDIT A COPY: capture whatever level is loaded into editor components and
// open the editor on it. The previous custom level is backed up so nothing
// is silently lost. Bespoke set pieces without a component language
// (boulder chase, side-scroll zones, sky-ropes, decor foliage) don't come
// through — the copy is the editable geometry.
ui.onEditCopy = () => {
  const wasBuiltIn = currentCourse !== 7;
  if (wasBuiltIn) {
    const data = level.captureData();
    const prev = localStorage.getItem('protoCustomLevel');
    if (prev) localStorage.setItem('protoCustomLevelBackup', prev);
    localStorage.setItem('protoCustomLevel', JSON.stringify(data));
    setCustomLevelData(data);
  }
  openEditor();
  if (wasBuiltIn) {
    ui.showMessage('EDITING A COPY', `${level.name} → custom slot (previous custom backed up)`, 2600);
  }
};
// Refresh-proof editing: if the page reloads mid-edit, walk straight back
// into the editor (the camera pose is restored by Editor.enter()). Deferred
// past module init — openEditor touches state declared further down.
if (localStorage.getItem('protoEditorOpen') === '1') setTimeout(() => openEditor(), 0);

// ---- playtest capture: input replays + gameplay video ----------------------

// Export the take since the last level load as a downloadable JSON. Drop the
// file into the chat with a note about what went wrong; the same file plays
// back deterministically (drag it onto the game window).
function exportReplay(): ReplayFile {
  return recorder.export();
}
function saveReplay(): void {
  const data = exportReplay();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `replay-${LEVEL_NAMES[data.level].replace(/\s+/g, '')}-${data.date.replace(/[:.]/g, '-').slice(0, 19)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  const secs = (data.frames / 60).toFixed(0);
  ui.showMessage('REPLAY SAVED', `${secs}s of input — drop the file into the chat`, 2200);
}

function loadReplay(data: ReplayFile): void {
  switchLevel(data.level); // clean slate: replay assumes a fresh level load
  replayer.begin(data);
  ui.setReplayBadge(true);
  if (data.level === 2) ui.showMessage('REPLAY', 'random level: layout may differ from the take', 2000);
  else ui.showMessage('REPLAY', `${(data.frames / 60).toFixed(0)}s take`, 1400);
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
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  videoRec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  videoChunks = [];
  videoRec.ondataavailable = (e) => {
    if (e.data.size > 0) videoChunks.push(e.data);
  };
  videoRec.onstop = () => {
    const blob = new Blob(videoChunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gameplay-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    videoRec = null;
    ui.setRecBadge(false);
    ui.showMessage('VIDEO SAVED', 'drop the .webm into the chat', 2000);
  };
  videoRec.start(1000);
  ui.setRecBadge(true);
  ui.showMessage('RECORDING VIDEO', 'press rec again to stop + save', 1800);
}

ui.onSaveReplay = saveReplay;
ui.onToggleVideo = toggleVideo;
ui.onLoadReplay = (text) => {
  try {
    loadReplay(JSON.parse(text) as ReplayFile);
  } catch {
    ui.showMessage('BAD REPLAY FILE', '', 1400);
  }
};
// drag a .json anywhere onto the game: replays play back, levels import
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f)
    f.text().then((txt) => {
      try {
        const obj = JSON.parse(txt) as { components?: unknown; b?: unknown };
        if (Array.isArray(obj.components)) {
          // a custom LEVEL file: adopt it and go there
          if (currentCourse !== 7) switchLevel(7);
          editor.importLevel(obj as never);
          ui.showMessage('LEVEL IMPORTED', '', 1600);
        } else if (Array.isArray(obj.b)) {
          loadReplay(obj as ReplayFile);
        } else {
          ui.showMessage('UNRECOGNIZED FILE', '', 1400);
        }
      } catch {
        ui.showMessage('BAD FILE', '', 1400);
      }
    });
});
ui.onLevelSelect = switchLevel;
player.onComboBank = (amount) => ui.comboBank(amount);
player.onComboBail = () => ui.comboBail();
// Debug cheat: clicking the HUD face banks an extra life.
ui.onLifeCheat = () => {
  player.lives++;
  sfx.play('lifeGet', 0.8);
};
ui.setLevel(currentCourse);
window.addEventListener('keydown', (e) => {
  // typing in a panel field (editor coordinates, tuner values) must not
  // switch levels or fire capture hotkeys
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  if (!editor.active) {
    // level hotkeys are gameplay-only — inside the editor they'd yank the
    // level out from under you
    if (e.code === 'Digit1') switchLevel(0);
    if (e.code === 'Digit2') switchLevel(1);
    if (e.code === 'Digit3') switchLevel(2);
    if (e.code === 'Digit4') switchLevel(3);
    if (e.code === 'Digit5') switchLevel(4);
    if (e.code === 'Digit6') switchLevel(5);
    if (e.code === 'Digit7') switchLevel(6);
    if (e.code === 'Digit8') switchLevel(7); // Custom (the editor's level)
    if (e.code === 'Digit9') switchLevel(8); // The Overgrowth
  }
  if (e.code === 'F8') saveReplay(); // playtest capture: input take -> .json
  if (e.code === 'F9') toggleVideo(); // playtest capture: canvas -> .webm
});

player.onDeath = () => ui.deathFade(true);
player.onRelic = (title, sub) => ui.showMessage(title, sub, 1400);
player.onFinish = (time) => {
  // the gate tallies the collectathon haul alongside the clear time
  const gem = player.gemEarned
    ? 'gem ✓'
    : `gem ✗ (${player.cratesBroken}/${level.totalCrates} boxes)`;
  const crystal = player.hasCrystal ? 'crystal ✓' : 'crystal ✗';
  ui.showMessage(
    'COURSE CLEAR!',
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
function recordTT(levelId: number, time: number): { list: number[]; rank: number } {
  let all: Record<string, number[]> = {};
  try {
    all = (JSON.parse(localStorage.getItem('protoTTtimes') ?? '{}') as Record<string, number[]>) ?? {};
  } catch {
    all = {};
  }
  const list = all[levelId] ?? [];
  list.push(time);
  list.sort((a, b) => a - b);
  all[levelId] = list.slice(0, 8);
  localStorage.setItem('protoTTtimes', JSON.stringify(all));
  return { list: all[levelId], rank: all[levelId].indexOf(time) };
}

player.onTTStart = () => {
  ui.setTimeTrial(true);
  ui.showMessage('TIME TRIAL!', 'race to the gate — numbered crates freeze the clock', 1800);
};
player.onTTEnd = () => ui.setTimeTrial(false);

// ---- combo run: green orb -> one combo to the green gem at the gate --------
player.onComboRunStart = () => {
  ui.setRunRows(true);
  ui.comboHalo('on');
  ui.showMessage('COMBO RUN!', 'reach the green gem at the gate in ONE combo', 2000);
};
player.onComboRunFail = () => {
  ui.comboHalo('dissipate');
  ui.showMessage('COMBO BROKEN', '', 1100);
};
player.onComboRunWin = () => {
  ui.comboHalo('dissipate');
  ui.setRunRows(false);
  ui.showMessage('COMBO GEM!', 'the green gem is yours', 2200);
};
player.onComboRunEnd = () => {
  ui.comboHalo('off');
  ui.setRunRows(false);
};
player.onTTFinish = (time) => {
  const { list, rank } = recordTT(currentCourse, time);
  ui.setTimeTrial(false);
  ui.showTTResults(time, list, rank);
};
player.onCheckpoint = () => ui.showMessage('CHECKPOINT', '', 900);
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
  const inTurn = !chaseOn && znHere !== null && (znHere.dir === 'E' || znHere.dir === 'W');
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
  const lf = chaseOn ? chaseF : level.laneDirAt(player.pos.x, player.pos.z);
  const turnK = Math.min(1, (chaseOn ? 1.6 : 3.5) * dt);
  camF.x += ((lf ? lf.x : 0) - camF.x) * turnK;
  camF.z += ((lf ? lf.z : -1) - camF.z) * turnK;
  camF.y = 0;
  if (camF.lengthSq() < 1e-4) camF.set(lf ? lf.x : 0, 0, lf ? lf.z : -1); // 180° pinch guard
  camF.normalize();

  const vAlong =
    dt > 0
      ? ((player.pos.x - prevPlayerPos.x) * camF.x + (player.pos.z - prevPlayerPos.z) * camF.z) / dt
      : 0;
  prevPlayerPos.copy(player.pos);
  // chase mode swings around behind instead of dollying back
  const movingBack = !chaseOn && (vAlong < -2.5 || (player.grounded && player.speed < -1.5));
  camBack += ((movingBack ? 1 : 0) - camBack) * Math.min(1, 3 * dt);
  const back = camBack * (1 - sideF) * (1 - boulderF); // corridor thing only

  // side-scroll stretches scale off the sliders (9.2/5.2 and 3.7/4.1 were the
  // authored ratios) so a re-tuned base carries its feel into the turns
  const dist = THREE.MathUtils.lerp(TUNING.camDist, TUNING.camDist * 1.77, sideF) + back * 3.8 + boulderF * 18.8;
  const height =
    THREE.MathUtils.lerp(TUNING.camHeight, TUNING.camHeight * 0.9, sideF) + back * 1.1 + boulderF * 1.7;
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
    floorY !== null ? Math.max(floorY, player.pos.y - maxRise) : Math.max(camAnchorY, player.pos.y - maxRise);
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
    const kLat = 1 - Math.exp(-THREE.MathUtils.lerp(3.2, 9, Math.max(sideF, boulderF)) * dt);
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
  const aimY = THREE.MathUtils.lerp(TUNING.camTilt, TUNING.camTilt - 0.2, sideF);
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
}

camera.position.copy(player.pos).addScaledVector(new THREE.Vector3(0, 0, 1), TUNING.camDist);
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
  const onGround = player.state === 'ride' && player.grounded;
  // Board rolling loop: above the boardSpeed slider, or any real momentum-
  // skate roll (slow carves up a transition still sound like wheels).
  // Slides are body slides — no board, no board noise.
  // Tied to the skating STATE: wheels roll for as long as the board is out
  // and actually moving — all the way down the roll-out, no speed cutoff.
  const skatingNow =
    onGround &&
    !player.sliding &&
    (speedAbs > TUNING.boardSpeed || (player.boardRolling && speedAbs > 0.3));
  sfx.setLoop(
    'skate',
    'skateLoop',
    skatingNow,
    Math.min(0.55, 0.15 + speedAbs / 90),
    0.85 + speedAbs / 120,
  );
  sfx.setLoop('grind', 'grindLoop', player.state === 'grind', 0.55, 1);
  // Wallride: the skating loop while stuck to a wall, pitched up a touch.
  sfx.setLoop('wallride', 'wallrideLoop', player.wallriding, 0.5, 1.15);
  // Triple-mask invincibility gets its theme music for the whole ride.
  sfx.setLoop('uber', 'uberMusic', player.uberTimer > 0, 0.65, 1);
  // Boulder rumble: the grind loop pitched way down, louder as it closes in.
  const bo = level.boulder;
  const bDist = bo ? Math.abs(bo.st.mesh.position.z - player.pos.z) : 999;
  sfx.setLoop(
    'boulder',
    'grindLoop',
    !!bo && bo.active,
    Math.max(0.12, Math.min(0.85, 1.05 - bDist / 55)),
    0.3,
  );

  stepTimer -= dt;
  const walking =
    onGround && !player.sliding && !player.boardRolling && speedAbs > 2 && speedAbs <= TUNING.walkSpeed + 0.5;
  if (walking && stepTimer <= 0) {
    sfx.play('footstep' + (1 + (stepIdx++ % 3)), 0.35);
    stepTimer = 0.26;
  }
}

let paused = false;

function frame(): void {
  requestAnimationFrame(frame);
  if (TUNING.renderScale !== appliedScale) {
    appliedScale = TUNING.renderScale;
    resize(); // chunk knob moved: rebuild the internal buffer at the new res
  }
  const dt = Math.min(clock.getDelta(), 0.1);
  input.update();

  // Controller-only players fire no keydown/pointer gesture, so the audio
  // context would stay suspended until they touched the keyboard. Nudge it from
  // the poll whenever there's any input (a cheap no-op once it's running).
  if (input.moveX || input.moveY || input.jumpHeld || input.grindHeld || input.spinHeld || input.grabHeld)
    sfx.unlock();

  // EDITOR MODE owns the frame outright (it supersedes pause — the sim is
  // frozen anyway, and the orbit camera + panel must keep responding).
  if (editor.active) {
    editor.update();
    input.consumeEdges();
    acc = 0;
    sky.position.copy(camera.position);
    renderer.render(scene, camera);
    return;
  }

  // Options / P toggles pause: the sim stops dead, the frame still renders.
  if (input.pausePressed) {
    paused = !paused;
    if (paused) ui.showMessage('PAUSED', 'Options / P to resume', 0);
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
    if (replayer.active && !replayer.feed(input)) {
      ui.setReplayBadge(false);
      ui.showMessage('REPLAY DONE', '', 1200);
      switchLevel(currentCourse);
      break;
    }
    player.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    // record exactly what the sim consumed (edges intact, pre-consume)
    if (!replayer.active) recorder.record(input);
    input.consumeEdges(); // one press = one step
    acc -= CONST.fixedStep;
  }

  // hold the last shot through the death blackout — no drifting after the
  // corpse; the respawn teleport re-snaps the rig when play resumes
  if (player.state !== 'dead' && player.state !== 'gameover') updateCamera(dt);
  updateAudio(dt);
  sky.position.copy(camera.position);

  ui.updateBalance(player.balanceMeter);
  ui.updateTTClock(player.ttTime, player.ttFreeze); // every frame: the trial clock is the whole show
  const tricks = player.comboLabels;
  ui.setHUD({
    points: player.points,
    comboPoints: player.comboPoints,
    comboMult: player.comboMult,
    comboHasTrick: player.comboHasTrick,
    tricks: (tricks.length > 6 ? '… + ' : '') + tricks.slice(-6).join(' + '),
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
      (player.skateOn ? ' ✓' : ''),
    railDist: player.railCandidateDist,
    crates: `${player.cratesBroken}/${level.totalCrates}`,
    fruit: player.fruit,
    masks: player.uberTimer > 0 ? `INVINCIBLE ${player.uberTimer.toFixed(1)}s` : String(player.masks),
    time: player.runTime,
  });

  renderer.render(scene, camera);
}
frame();

// Smoke-test / console-poking hook.
(window as unknown as Record<string, unknown>).__game = {
  player,
  level,
  input,
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
  editor,
  openEditor,
  GLTFLoader, // debug: inspect model files from the console/harness
};
