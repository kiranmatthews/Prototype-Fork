// Entry point: renderer, Crash-style corridor camera, and the deterministic
// fixed-step game loop.

import * as THREE from 'three';
import { Input } from './input';
import { Level } from './level';
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
const level = new Level(scene);
const player = new Player(scene);
player.respawn(level, true);

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
// narrow lens, the player reads big against the corridor.
const CAM_DIST = 7;
const CAM_HEIGHT = 3.3;
const CAM_LOOKAHEAD = 5.5;
const camTarget = new THREE.Vector3();
const lookPoint = new THREE.Vector3();

function updateCamera(dt: number): void {
  camTarget.set(player.pos.x, player.pos.y + CAM_HEIGHT, player.pos.z + CAM_DIST);

  // Snap after respawn teleports; damp otherwise.
  if (camera.position.distanceTo(camTarget) > 30) {
    camera.position.copy(camTarget);
  } else {
    camera.position.lerp(camTarget, 1 - Math.exp(-9 * dt));
  }

  lookPoint.set(player.pos.x, player.pos.y + 1.0, player.pos.z - CAM_LOOKAHEAD);
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
    time: player.runTime,
  });

  renderer.render(scene, camera);
}
frame();

// Smoke-test / console-poking hook.
(window as unknown as Record<string, unknown>).__game = { player, level, input, TUNING };
