// Entry point: renderer, Crash-style corridor camera, and the deterministic
// fixed-step game loop.

import * as THREE from 'three';
import { Input } from './input';
import { Level, LEVEL_NAMES } from './level';
import { Player } from './player';
import { UI } from './ui';
import { TUNING, CONST } from './tuning';
import { sfx } from './audio';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1); // low internal res + pixelated upscale = PS1 vibe
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232634);
scene.fog = new THREE.Fog(0x232634, 30, 170);

const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x32281f, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
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

// CRT dressing: scanlines + vignette (styles live in index.html). Pure DOM,
// zero GPU cost — skipped in lite along with the rest of the presentation.
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

  // Deliberately banded gradient: skyTop -> skyBottom quantized into fat
  // steps, a checkered dither row chewing each seam. PS1 sky, not airbrush.
  const skyH = Math.round(H * 0.58);
  const BANDS = 14;
  for (let i = 0; i < BANDS; i++) {
    const y0 = Math.round((i / BANDS) * skyH);
    const y1 = Math.round(((i + 1) / BANDS) * skyH);
    ctx.fillStyle = css(mixRGB(top, bottom, i / (BANDS - 1)));
    ctx.fillRect(0, y0, W, y1 - y0);
    if (i > 0) {
      // the previous band bleeds down in alternating 4px cells
      ctx.fillStyle = css(mixRGB(top, bottom, (i - 1) / (BANDS - 1)));
      for (let x = (i % 2) * 4; x < W; x += 8) ctx.fillRect(x, y0, 4, 2);
    }
  }
  // below the horizon it's all fog — that's what you see going off a cliff
  ctx.fillStyle = css(fog);
  ctx.fillRect(0, skyH, W, H - skyH);

  if (t.stars) {
    // varied specks up high, fading toward the horizon glow
    for (let i = 0; i < 130; i++) {
      const y = Math.random() * H * 0.44;
      const s = Math.random() < 0.14 ? 3 : Math.random() < 0.45 ? 2 : 1;
      ctx.globalAlpha = (0.25 + Math.random() * 0.6) * (1 - y / (H * 0.6));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.random() * W, y, s, s);
    }
    // ...and a few hero stars with cross-sparkle arms
    for (let i = 0; i < 3; i++) {
      const x = 20 + Math.random() * (W - 40);
      const y = H * 0.04 + Math.random() * H * 0.26;
      ctx.globalAlpha = 0.95;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.globalAlpha = 0.45;
      ctx.fillRect(x - 7, y, 15, 1);
      ctx.fillRect(x, y - 7, 1, 15);
    }
    ctx.globalAlpha = 1;
  }

  if (t.sunColorHex) {
    // big soft halo, a hot core, and an anamorphic glare stripe across it —
    // painted before the ridges so a low sun sets behind them
    const sx = t.sunU * W;
    const sy = t.sunV * H;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 120);
    halo.addColorStop(0, css(sunC, 0.95));
    halo.addColorStop(0.2, css(sunC, 0.55));
    halo.addColorStop(1, css(sunC, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = css(mixRGB(sunC, white, 0.6));
    ctx.beginPath();
    ctx.arc(sx, sy, 15, 0, Math.PI * 2);
    ctx.fill();
    const glare = ctx.createLinearGradient(sx - 170, 0, sx + 170, 0);
    glare.addColorStop(0, css(sunC, 0));
    glare.addColorStop(0.5, css(mixRGB(sunC, white, 0.4), 0.55));
    glare.addColorStop(1, css(sunC, 0));
    ctx.fillStyle = glare;
    ctx.fillRect(sx - 170, sy - 1, 340, 3);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(sx - 110, sy - 4, 220, 9);
    ctx.globalAlpha = 1;
  }

  // blocky cutout clouds, lit from the sun's side of the palette (kept off
  // the texture seam so the wrap never slices one in half)
  const lit = mixRGB(sunC, white, 0.6);
  const shade = mixRGB(mixRGB(sunC, bottom, 0.5), top, 0.35);
  for (let i = 0; i < 5; i++) {
    const cx = W * (0.12 + Math.random() * 0.76);
    const cy = H * (0.16 + Math.random() * 0.24);
    const cw = 46 + Math.random() * 72;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = css(shade);
    ctx.fillRect(cx - cw / 2, cy, cw, 7);
    ctx.fillStyle = css(lit);
    ctx.fillRect(cx - cw / 2 + 7, cy - 6, cw * 0.72, 6);
    ctx.fillRect(cx - cw / 2 + 18, cy - 11, cw * 0.38, 5);
  }
  ctx.globalAlpha = 1;

  // three ridge silhouettes stepping out of the fog: far ones hazy
  // (fog-tinted), near ones darker — cheap painted depth on the horizon
  const ridges = [
    { base: 0.5, amp: 15, col: mixRGB(fog, bottom, 0.4), seed: 3.7 },
    { base: 0.525, amp: 24, col: mixRGB(fog, [0, 0, 0], 0.22), seed: 8.1 },
    { base: 0.55, amp: 34, col: mixRGB(fog, [0, 0, 0], 0.42), seed: 5.6 },
  ];
  for (const r of ridges) {
    ctx.fillStyle = css(r.col);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      // 4px columns, heights snapped to 3px: chunky polygon mountains
      const h = (ridge(x / W, r.seed) * 0.5 + 0.5) * r.amp;
      const y = Math.round((r.base * H - h) / 3) * 3;
      ctx.lineTo(x, y);
      ctx.lineTo(x + 4, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  // the whole horizon melts back into the fog at the bottom, so the ridges
  // read as haze, never a hard silhouette edge against the void
  const melt = ctx.createLinearGradient(0, H * 0.56, 0, H * 0.86);
  melt.addColorStop(0, css(fog, 0));
  melt.addColorStop(1, css(fog, 1));
  ctx.fillStyle = melt;
  ctx.fillRect(0, Math.round(H * 0.56), W, H - Math.round(H * 0.56));

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; // keep the dither cells crisp on the dome
  return tex;
}

function applyTheme(): void {
  const t = level.theme;
  scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  scene.background = new THREE.Color(t.fog);
  hemi.color.set(t.hemiSky);
  hemi.groundColor.set(t.hemiGround);
  hemi.intensity = t.hemiI;
  sun.color.set(t.sunColor);
  sun.intensity = t.sunI;
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
// close rig below keeps the skater big in frame.
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(Math.round(w * TUNING.renderScale), Math.round(h * TUNING.renderScale), false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
// renderScale is a live tuner slider; the frame loop re-resizes when it moves.
let appliedScale = TUNING.renderScale;

const input = new Input();
const ui = new UI();
let currentCourse = Math.min(5, Math.max(0, Number(localStorage.getItem('protoLevel')) || 0));
let level = new Level(scene, currentCourse);
const player = new Player(scene);
player.respawn(level, true);
applyTheme();

function switchLevel(id: number): void {
  currentCourse = id;
  localStorage.setItem('protoLevel', String(id));
  level.dispose();
  level = new Level(scene, id);
  player.respawn(level, true);
  applyTheme();
  ui.setLevel(id);
  ui.showMessage(LEVEL_NAMES[id].toUpperCase(), '', 1400);
  (window as unknown as Record<string, unknown>).__game &&
    (((window as unknown as Record<string, unknown>).__game as Record<string, unknown>).level = level);
}
ui.onLevelSelect = switchLevel;
// Debug cheat: clicking the HUD face banks an extra life.
ui.onLifeCheat = () => {
  player.lives++;
  sfx.play('lifeGet', 0.8);
};
ui.setLevel(currentCourse);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') switchLevel(0);
  if (e.code === 'Digit2') switchLevel(1);
  if (e.code === 'Digit3') switchLevel(2);
  if (e.code === 'Digit4') switchLevel(3);
  if (e.code === 'Digit5') switchLevel(4);
  if (e.code === 'Digit6') switchLevel(5);
});

player.onDeath = () => {
  ui.flash();
  ui.showMessage('WIPEOUT!', '', 800);
};
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
};
player.onCheckpoint = () => ui.showMessage('CHECKPOINT', '', 900);
player.onGameOver = () => ui.showDeathScreen(true);

// --- Crash-style corridor camera -------------------------------------------
// Hard-locked to the course axis: it only translates, never yaws, so screen
// left/right always equal world left/right. Crash 2 framing: close and low,
// narrow lens, the player reads big against the corridor. Traveling BACK
// toward the camera (riding or grinding) eases it up and away and swings the
// look-at behind you, so the nitros you're backing into stay on screen.
const CAM_DIST = 5.2;
const CAM_HEIGHT = 2.8;
const CAM_LOOKAHEAD = 5.0;
const camTarget = new THREE.Vector3();
const lookPoint = new THREE.Vector3();
let camBack = 0; // 0 = facing down-course, eases to 1 while travelling at the camera
let sideF = 0; // eases to 1 on turned (X-running) stretches: wider framing only
let boulderF = 0; // eases to 1 on boulder-chase levels: tipped-down framing
let prevPlayerZ = 0;

function updateCamera(dt: number): void {
  // ONE rig, always facing down -Z. When the path right-angles into an
  // X-running stretch, the same camera sees it side-on — no yaw, just a
  // slightly wider, higher frame with less forward lead.
  const inTurn = level.zoneAt(player.pos.x, player.pos.z) !== null;
  sideF += ((inTurn ? 1 : 0) - sideF) * Math.min(1, 3.5 * dt);

  // Boulder-chase framing: same zoom/scale, but the camera rides higher and
  // tips DOWN so the ground under and just ahead of the skater — where the
  // obstacles arrive from — fills more of the frame. It REPLACES the reverse
  // pull-back below (stacking both shoved the look target behind the player
  // and dumped the skater out of the frame).
  boulderF += ((level.boulder ? 1 : 0) - boulderF) * Math.min(1, 3 * dt);

  const vz = dt > 0 ? (player.pos.z - prevPlayerZ) / dt : 0;
  prevPlayerZ = player.pos.z;
  const movingBack = vz > 2.5 || (player.grounded && player.speed < -1.5);
  camBack += ((movingBack ? 1 : 0) - camBack) * Math.min(1, 3 * dt);
  const back = camBack * (1 - sideF) * (1 - boulderF); // corridor thing only

  const dist = THREE.MathUtils.lerp(CAM_DIST, 9.2, sideF) + back * 3.8 + boulderF * 1.9;
  const height =
    THREE.MathUtils.lerp(CAM_HEIGHT, 3.7, sideF) + back * 1.1 + boulderF * 2.05;
  camTarget.set(player.pos.x, player.pos.y + height, player.pos.z + dist);

  // Snap after respawn teleports; damp otherwise.
  if (camera.position.distanceTo(camTarget) > 30) {
    camera.position.copy(camTarget);
  } else {
    camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
  }

  lookPoint.set(
    player.pos.x,
    player.pos.y + THREE.MathUtils.lerp(1.0, 1.5, sideF) - boulderF * 1.1,
    player.pos.z -
      THREE.MathUtils.lerp(CAM_LOOKAHEAD, 2.0, sideF) +
      back * 8.5 +
      boulderF * 6.5,
  );
  camera.lookAt(lookPoint);
}

camera.position.copy(player.pos).addScaledVector(new THREE.Vector3(0, 0, 1), CAM_DIST);
camera.position.y += CAM_HEIGHT;

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
  const skatingNow =
    onGround &&
    !player.sliding &&
    (speedAbs > TUNING.boardSpeed || (player.boardRolling && speedAbs > 3));
  sfx.setLoop(
    'skate',
    'skateLoop',
    skatingNow,
    Math.min(0.55, 0.15 + speedAbs / 90),
    0.85 + speedAbs / 120,
  );
  sfx.setLoop('grind', 'grindLoop', player.state === 'grind', 0.55, 1);
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

function frame(): void {
  requestAnimationFrame(frame);
  if (TUNING.renderScale !== appliedScale) {
    appliedScale = TUNING.renderScale;
    resize(); // chunk knob moved: rebuild the internal buffer at the new res
  }
  const dt = Math.min(clock.getDelta(), 0.1);
  input.update();

  acc += dt;
  while (acc >= CONST.fixedStep) {
    player.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    input.consumeEdges(); // one press = one step
    acc -= CONST.fixedStep;
  }

  updateCamera(dt);
  updateAudio(dt);
  sky.position.copy(camera.position);

  ui.updateBalance(player.state === 'grind', player.balance);
  const tricks = player.comboLabels;
  ui.setHUD({
    points: player.points,
    comboPoints: player.comboPoints,
    comboMult: player.comboMult,
    tricks: (tricks.length > 6 ? '… + ' : '') + tricks.slice(-6).join(' + '),
    fruit: player.fruit,
    lives: Math.max(0, player.lives),
    crates: `${player.cratesBroken}/${level.totalCrates}`,
    hasCrystal: player.hasCrystal,
    hasGem: player.gemEarned,
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
(window as unknown as Record<string, unknown>).__game = { player, level, input, TUNING, switchLevel };
