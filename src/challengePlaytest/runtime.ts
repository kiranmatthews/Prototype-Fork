import * as THREE from 'three';
import { Player } from '../player';
import { Input } from '../input';
import { Level, type CustomLevelData } from '../level';
import { CONST, TUNING } from '../tuning';
import { RigBinding, createPlayerStarterAnimationSuite } from '../animation';
import { withSkatePresentationRig } from '../animation/skateCatalog';
import { createCharacterAnimationRuntime } from '../characterAnimationRuntime';
import { GameplayAnimationPresentation, gameplayAnimationDocument, prepareGameplayAnimationAssets } from '../gameplayAnimationScheme';
import { cameraViewAt, cameraViewDirection, CameraViewFraming } from '../cameraViews';
import { SkateChaseCameraOverlay } from '../skateChaseCamera';
import { CameraFallHold } from '../cameraRig';
import { CameraPortraitFraming } from '../cameraPortraitFraming';
import { presentationAssets } from '../presentationLoading';
import { sfx } from '../audio';
import { puffs } from '../puffs';
import { CRYSTAL_TRIALS, CRYSTAL_TRIALS_LEVEL, CRYSTAL_REJECTS_LEVEL, REJECTED_GRID, trialLevel } from '../levels/crystal-trials';
import { REJECTED_CRYSTAL_TRIALS } from '../levels/crystal-trials/rejects';

export interface PlaytestSelection { kind: 'challenge' | 'reject' | 'grid'; index?: number }
export interface PlaytestRuntime {
  load(selection: PlaytestSelection): Promise<void>;
  pause(): void;
  resume(): void;
  retry(): void;
}

/** Uses the production player, input, physics and animation scheme. This entry
 * has no campaign, editor sync, music player, or full-game offline installer. */
export async function createPlaytest(menu: (message?: string) => void): Promise<PlaytestRuntime> {
  const canvas = document.getElementById('challenge-world') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();scene.background = new THREE.Color('#c5cfcb');
  scene.fog = new THREE.Fog('#c5cfcb', 140, 280);
  scene.add(new THREE.HemisphereLight(0xe6f2ff, 0x788d68, 2.5));
  const sun = new THREE.DirectionalLight(0xffedce, 2.8);sun.position.set(30, 70, 30);scene.add(sun);
  const p = new Player(scene), input = new Input(false, () => true);
  p.endlessDeaths = true;
  puffs.attach(scene);puffs.setQuality('low');
  const camera = new THREE.PerspectiveCamera(62, 1, .05, 350);
  const framing = new CameraViewFraming(), skateCamera = new SkateChaseCameraOverlay();
  const portrait = new CameraPortraitFraming(), fall = new CameraFallHold();
  const binding = RigBinding.fromDefinition(p.animationRig.root,
    withSkatePresentationRig(RigBinding.fromSculptRuntime(p.animationRig.root, { strict: false }).definition), { strict: false });
  const assets = await prepareGameplayAnimationAssets();
  const animation = createCharacterAnimationRuntime(p, gameplayAnimationDocument(
    createPlayerStarterAnimationSuite(binding.definition), binding.definition, assets.jak));
  const presentation = new GameplayAnimationPresentation(p, scene, assets);
  await p.preparePresentationAssets();
  let level: Level, current: { id: string; name: string; data: CustomLevelData };
  let paused = true, last = 0, accumulator = 0, snapVersion = -1;
  const aim = new THREE.Vector3(), eye = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, -1);
  const stats = { frame: 0, totalFixedSteps: 0 };
  const count = document.getElementById('challenge-count')!;
  const hint = document.getElementById('challenge-hint')!;
  const balance = document.getElementById('challenge-balance') as HTMLMeterElement;
  let hintUntil = 0;
  const say = (message: string) => { hint.textContent = message;hintUntil = performance.now() + 5000; };
  p.onCourseHint = (title, description) => say(`${title} · ${description}`);
  p.onCheckpoint = () => say('Checkpoint saved');
  p.onFinish = () => { paused = true;queueMicrotask(() => menu('Complete. Choose another challenge or retry.')); };
  const resize = () => {
    const scale = Math.min(1, 540 / Math.min(innerWidth, innerHeight));
    renderer.setSize(Math.round(innerWidth * scale), Math.round(innerHeight * scale), false);
    camera.aspect = innerWidth / innerHeight;camera.updateProjectionMatrix();snapVersion = -1;
  };
  resize();addEventListener('resize', resize);
  const pause = () => { paused = true;accumulator = 0;input.consumeEdges(true);sfx.stopLoops(); };
  const resume = () => { paused = false;last = 0;input.consumeEdges(true);canvas.focus(); };
  const retry = () => {
    if (!level) return;p.respawn(level, true);level.setRunModesEnabled(false);
    p.endlessDeaths = true;animation.restart();accumulator = 0;snapVersion = -1;
  };
  async function load(selection: PlaytestSelection) {
    pause();level?.dispose();
    let data: CustomLevelData;
    if (selection.kind === 'grid') data = REJECTED_GRID;
    else if (selection.index === undefined) data = selection.kind === 'challenge' ? CRYSTAL_TRIALS_LEVEL : CRYSTAL_REJECTS_LEVEL;
    else {
      const trial = (selection.kind === 'challenge' ? CRYSTAL_TRIALS : REJECTED_CRYSTAL_TRIALS)[selection.index];
      if (!trial) throw Error('Unknown challenge');
      data = trialLevel(trial);
      if (selection.kind === 'reject') data.crystalTrials = 'archive';
    }
    current = { id: `phone-${selection.kind}-${selection.index ?? 'all'}`, name: data.name, data };
    level = new Level(scene, current);p.enterLevel(current.id);retry();
    await Promise.all([level.prepareJungleAssets(), level.prepareSurfaceImages()]);
    await presentationAssets.waitUntilSettled();
    hint.textContent = data.name;
    hintUntil = performance.now() + 5000;
    Object.assign(debug, { selection, trialOffset: selection.index === undefined ? undefined : [0, 0, 0] });
  }
  const debug = {
    player: p, input, scene, camera, renderer, frameStats: stats,
    getLevel: () => level, getCurrentLevel: () => current,
    load, pause, resume, retry,
    captureBonusReviewFrame: () => renderer.domElement.toDataURL('image/png'),
    get paused() { return paused; },
  };
  Object.assign(window, { __game: debug });
  function render(now: number) {
    requestAnimationFrame(render);
    const dt = Math.min(.05, (now - (last || now)) / 1000);last = now;stats.frame++;
    input.update();
    if (input.pausePressed && level) { if (!paused) menu();input.pausePressed = false; }
    if (!level || paused) { input.consumeEdges(true);return; }
    if (input.moveX || input.moveY || input.jumpHeld || input.spinHeld || input.grindHeld || input.grabHeld) sfx.unlock();
    const control = cameraViewDirection(level.cameraViews, p.pos.x, p.pos.y, p.pos.z, { x: 0, z: -1 });
    p.camDir.set(control.x, 0, control.z);forward.copy(p.camDir);
    accumulator += dt;
    while (accumulator + 1e-10 >= CONST.fixedStep && !paused) {
      p.step(CONST.fixedStep, input, level);level.update(CONST.fixedStep);
      p.flushLevelCrateRewards(level);p.commitRenderStep(level);input.consumeEdges();
      accumulator = Math.max(0, accumulator - CONST.fixedStep);stats.totalFixedSteps++;
    }
    p.applyRenderInterpolation(accumulator / CONST.fixedStep);
    try {
      portrait.restore(camera);skateCamera.restore(camera);framing.restore(camera);
      const subject = p.renderPosition, snap = snapVersion !== p.renderSnapVersion;
      if (!fall.shouldHold(p, level.killY, () => p.cameraLandingAhead(level), () => p.cameraCanRecoverFall(level))) {
        eye.copy(subject).addScaledVector(forward, -14);eye.y += 8;
        camera.position.copy(eye);aim.copy(subject);aim.y += 2.7;camera.up.set(0, 1, 0);camera.lookAt(aim);
        camera.fov = 62;camera.updateProjectionMatrix();
        framing.apply(camera, cameraViewAt(level.cameraPresentationViews, subject.x, subject.y, subject.z)
          ?? cameraViewAt(level.cameraViews, subject.x, subject.y, subject.z), subject, snap);
        skateCamera.apply(camera, p.authoredSkateCamera ? {
          position: subject, heading: p.skateCameraHeading, up: p.skateCameraUp,
          vertAir: p.vertAir, vertNormal: p.vertNormal, verticalSpeed: p.vVel,
          speed: p.cameraSkateSpeed, grounded: p.skateCameraSupported, bailing: p.skateCameraBailing,
        } : null, dt, snap, level.groundMeshes, {
          camDist: TUNING.parkCamDist, camHeight: TUNING.parkCamHeight, camPitch: TUNING.parkCamPitch, camFov: TUNING.parkCamFov,
        });
      }
      snapVersion = p.renderSnapVersion;
      portrait.apply(camera, true);
      presentation.prepareRender(camera);p.prepareMaskPresentation();puffs.update(dt, camera);
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();renderer.render(scene, camera);
    } finally { p.restoreRenderPose(); }
    const goals = level.skateCollectathon;
    count.textContent = goals ? `${goals.collected}/${goals.tokens.length} crystals · ${p.totalDeaths} deaths` : '';
    balance.hidden = p.state !== 'grind';balance.value = p.balance;
    if (now > hintUntil) hint.textContent = goals?.exitReady ? 'Exit open' : '';
  }
  requestAnimationFrame(render);
  return { load, pause, resume, retry };
}
