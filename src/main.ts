// Entry point: renderer, Crash-style corridor camera, and the deterministic
// fixed-step game loop.

import * as THREE from 'three';
import { Input } from './input';
import { Level, LEVEL_NAMES } from './level';
import { Player } from './player';
import { UI } from './ui';
import { TUNING, CONST } from './tuning';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(1); // low internal res + pixelated upscale = PS1 vibe
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x232634);
scene.fog = new THREE.Fog(0x232634, 30, 170);

scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x32281f, 1.0));
const sun = new THREE.DirectionalLight(0xfff2d8, 1.4);
sun.position.set(30, 60, 20);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);

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
let currentCourse = Math.min(4, Math.max(0, Number(localStorage.getItem('protoLevel')) || 0));
let level = new Level(scene, currentCourse);
const player = new Player(scene);
player.respawn(level, true);

function switchLevel(id: number): void {
  currentCourse = id;
  localStorage.setItem('protoLevel', String(id));
  level.dispose();
  level = new Level(scene, id);
  player.respawn(level, true);
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
});

player.onDeath = () => {
  ui.flash();
  ui.showMessage('WIPEOUT!', '', 800);
};
player.onFinish = (time) => {
  ui.showMessage('COURSE CLEAR!', `time ${time.toFixed(2)}s — press R / Options to go again`, 0);
};
player.onRespawn = () => ui.hideMessage();
player.onCheckpoint = () => ui.showMessage('CHECKPOINT', '', 900);

// --- Crash-style corridor camera -------------------------------------------
// Hard-locked to the course axis: it only translates, never yaws, so screen
// left/right always equal world left/right. Crash 2 framing: close and low,
// narrow lens, the player reads big against the corridor. Traveling BACK
// toward the camera (riding or grinding) eases it up and away and swings the
// look-at behind you, so the nitros you're backing into stay on screen.
const CAM_DIST = 7;
const CAM_HEIGHT = 3.3;
const CAM_LOOKAHEAD = 5.5;
const camTarget = new THREE.Vector3();
const lookPoint = new THREE.Vector3();
let camBack = 0; // 0 = facing down-course, eases to 1 while travelling at the camera
let prevPlayerZ = 0;

function updateCamera(dt: number): void {
  // Side-scroll levels: camera off to the +X side, screen right = down-course.
  // The look direction is a CONSTANT offset from the camera itself (not the
  // player), so the damped follow can never tilt the horizon — the camera
  // only translates, and movement reads through parallax and the floor
  // pattern.
  if (level.sideScroll) {
    camTarget.set(player.pos.x + 14, player.pos.y + 3.6, player.pos.z - 1.5);
    if (camera.position.distanceTo(camTarget) > 30) {
      camera.position.copy(camTarget);
    } else {
      camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
    }
    lookPoint.set(camera.position.x - 14, camera.position.y - 2.0, camera.position.z);
    camera.lookAt(lookPoint);
    prevPlayerZ = player.pos.z;
    return;
  }

  const vz = dt > 0 ? (player.pos.z - prevPlayerZ) / dt : 0;
  prevPlayerZ = player.pos.z;
  const movingBack = vz > 2.5 || (player.grounded && player.speed < -1.5);
  camBack += ((movingBack ? 1 : 0) - camBack) * Math.min(1, 3 * dt);

  const dist = CAM_DIST + camBack * 4.5;
  const height = CAM_HEIGHT + camBack * 1.3;
  camTarget.set(player.pos.x, player.pos.y + height, player.pos.z + dist);

  // Snap after respawn teleports; damp otherwise.
  if (camera.position.distanceTo(camTarget) > 30) {
    camera.position.copy(camTarget);
  } else {
    camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
  }

  lookPoint.set(
    player.pos.x,
    player.pos.y + 1.0,
    player.pos.z - CAM_LOOKAHEAD + camBack * 9.5,
  );
  camera.lookAt(lookPoint);
}

camera.position.copy(player.pos).addScaledVector(new THREE.Vector3(0, 0, 1), CAM_DIST);
camera.position.y += CAM_HEIGHT;

// --- fixed-step loop --------------------------------------------------------
const clock = new THREE.Clock();
let acc = 0;

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

  ui.updateBalance(player.state === 'grind', player.balance);
  ui.setHUD({
    points: player.points,
    combo: player.comboMult > 0 ? `${player.comboPoints} × ${player.comboMult}` : '',
    fruit: player.fruit,
    crates: `${player.cratesBroken}/${level.totalCrates}`,
  });
  ui.setStats({
    speed: player.speed,
    state: player.state,
    grounded: player.grounded,
    vVel: player.vVel,
    surface: player.surfaceName,
    controller: input.gamepadName,
    railDist: player.railCandidateDist,
    crates: `${player.cratesBroken}/${level.totalCrates}`,
    fruit: player.fruit,
    masks: `${player.masks} (${Math.round(player.trickMeter * 100)}%)`,
    time: player.runTime,
  });

  renderer.render(scene, camera);
}
frame();

// Smoke-test / console-poking hook.
(window as unknown as Record<string, unknown>).__game = { player, level, input, TUNING, switchLevel };
