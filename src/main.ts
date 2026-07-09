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

// '?lite' strips the pure-visual layers (sky dome, ambient particles) — used
// by the headless smoke autopilot, where software rendering can't afford the
// fill rate and slow frames desync its wall-clock input scripting.
const LITE = window.location.search.includes('lite');

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

function makeSkyTexture(t: Level['theme']): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, t.skyTop);
  grad.addColorStop(1, t.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  if (t.stars) {
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.2 + Math.random() * 0.65;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.random() * 256, Math.random() * 125, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }
  if (t.sunColorHex) {
    const sx = t.sunU * 256;
    const sy = t.sunV * 256;
    const disc = ctx.createRadialGradient(sx, sy, 2, sx, sy, 44);
    disc.addColorStop(0, t.sunColorHex);
    disc.addColorStop(0.22, t.sunColorHex + 'bb');
    disc.addColorStop(1, t.sunColorHex + '00');
    ctx.fillStyle = disc;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(canvas);
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
  renderer.setSize(Math.round(w * CONST.renderScale), Math.round(h * CONST.renderScale), false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

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
player.onFinish = (time) => {
  ui.showMessage('COURSE CLEAR!', `time ${time.toFixed(2)}s — press R / Options to go again`, 0);
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
let prevPlayerZ = 0;

function updateCamera(dt: number): void {
  // ONE rig, always facing down -Z. When the path right-angles into an
  // X-running stretch, the same camera sees it side-on — no yaw, just a
  // slightly wider, higher frame with less forward lead.
  const inTurn = level.zoneAt(player.pos.x, player.pos.z) !== null;
  sideF += ((inTurn ? 1 : 0) - sideF) * Math.min(1, 3.5 * dt);

  const vz = dt > 0 ? (player.pos.z - prevPlayerZ) / dt : 0;
  prevPlayerZ = player.pos.z;
  const movingBack = vz > 2.5 || (player.grounded && player.speed < -1.5);
  camBack += ((movingBack ? 1 : 0) - camBack) * Math.min(1, 3 * dt);
  const back = camBack * (1 - sideF); // reverse pull-back is a corridor thing

  const dist = THREE.MathUtils.lerp(CAM_DIST, 9.2, sideF) + back * 3.8;
  const height = THREE.MathUtils.lerp(CAM_HEIGHT, 3.7, sideF) + back * 1.1;
  camTarget.set(player.pos.x, player.pos.y + height, player.pos.z + dist);

  // Snap after respawn teleports; damp otherwise.
  if (camera.position.distanceTo(camTarget) > 30) {
    camera.position.copy(camTarget);
  } else {
    camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
  }

  lookPoint.set(
    player.pos.x,
    player.pos.y + THREE.MathUtils.lerp(1.0, 1.5, sideF),
    player.pos.z - THREE.MathUtils.lerp(CAM_LOOKAHEAD, 2.0, sideF) + back * 8.5,
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
