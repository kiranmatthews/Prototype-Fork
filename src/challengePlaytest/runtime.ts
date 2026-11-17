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
import { resizeRendererSurface } from '../render-quality/surfaceSize';
import { makeSkyTexture } from '../proceduralSky';
import { CameraLookOffset } from '../cameraLook';
import { CameraFallHold } from '../cameraRig';
import { CameraPortraitFraming } from '../cameraPortraitFraming';
import { GraphicsRecovery } from '../graphicsRecovery';
import { installContextResourceRecovery } from '../contextResourceRecovery';
import { releaseLostGraphicsResources } from '../lostGraphicsResources';
import { afterPresentationPaint, presentationAssets, waitForPresentationGpu } from '../presentationLoading';
import { sfx } from '../audio';
import { puffs } from '../puffs';
import { CRYSTAL_TRIALS, CRYSTAL_TRIALS_LEVEL, CRYSTAL_REJECTS_LEVEL, REJECTED_GRID, trialLevel } from '../levels/crystal-trials';
import { REJECTED_CRYSTAL_TRIALS } from '../levels/crystal-trials/rejects';

export interface PlaytestSelection { kind: 'challenge' | 'reject' | 'grid'; index?: number }
export interface PlaytestRuntime {
  readonly selection: PlaytestSelection | undefined;
  readonly finished: boolean;
  readonly checkpointRetry: boolean;
  load(selection: PlaytestSelection): Promise<void>;
  pause(): void;
  resume(): void;
  retry(): void;
}

/** Uses the production player, input, physics and animation scheme. This entry
 * has no campaign, editor or music player. */
export async function createPlaytest(menu: (message?: string) => void): Promise<PlaytestRuntime> {
  const canvas = document.getElementById('challenge-world') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio <= 1 });
  const gl = renderer.getContext();
  installContextResourceRecovery(canvas, gl);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;renderer.toneMappingExposure = 1.1;
  const scene = new THREE.Scene();scene.background = new THREE.Color('#aebdc2');
  scene.fog = new THREE.Fog('#aebdc2', 140, 285);
  scene.add(new THREE.HemisphereLight(0xcbdfff, 0x76634d, 1.25));
  const sun = new THREE.DirectionalLight(0xffdfa8, 1.65);
  sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=.035;
  Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:.5,far:145});
  sun.shadow.camera.updateProjectionMatrix();scene.add(sun,sun.target);
  renderer.shadowMap.enabled=true;
  const sky=new THREE.Mesh(new THREE.SphereGeometry(290,32,16),new THREE.MeshBasicMaterial({side:THREE.BackSide,depthWrite:false,fog:false}));
  sky.renderOrder=-1;scene.add(sky);
  const p = new Player(scene), input = new Input();
  p.endlessDeaths = true;
  puffs.attach(scene);puffs.setQuality('low');
  const camera = new THREE.PerspectiveCamera(62, 1, .05, 350);
  const framing = new CameraViewFraming(), skateCamera = new SkateChaseCameraOverlay();
  const portrait = new CameraPortraitFraming(), fall = new CameraFallHold(), look = new CameraLookOffset();
  let level: Level, current: { id: string; name: string; data: CustomLevelData };
  let active: PlaytestSelection | undefined;
  let paused = true, last = 0, accumulator = 0, snapVersion = -1;

  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height || gl.isContextLost()) return;
    resizeRendererSurface(renderer, width, height, devicePixelRatio || 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    snapVersion = -1;
  }
  const graphics = new GraphicsRecovery(canvas, () => {
    input.consumeEdges(true);
    sfx.stopLoops();
    releaseLostGraphicsResources([scene, level, p]);
  }, () => {
    // A loss inside Three's shadow pass can leave its offscreen target selected.
    renderer.resetState();
    renderer.setRenderTarget(null);
    renderer.shadowMap.needsUpdate = true;
    resize();
    accumulator = 0;
    last = 0;
    input.consumeEdges(true);
    p.snapRenderInterpolation();
  });
  resize();
  addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  addEventListener('pageshow', resize);
  const binding = RigBinding.fromDefinition(p.animationRig.root,
    withSkatePresentationRig(RigBinding.fromSculptRuntime(p.animationRig.root, { strict: false }).definition), { strict: false });
  const assets = await prepareGameplayAnimationAssets();
  const animation = createCharacterAnimationRuntime(p, gameplayAnimationDocument(
    createPlayerStarterAnimationSuite(binding.definition), binding.definition, assets.jak));
  const presentation = new GameplayAnimationPresentation(p, scene, assets);
  await p.preparePresentationAssets();
  const aim = new THREE.Vector3(), eye = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, -1);
  const stats = { frame: 0, totalFixedSteps: 0 };
  const count = document.getElementById('challenge-count')!;
  const hint = document.getElementById('challenge-hint')!;
  const balance = document.getElementById('challenge-balance') as HTMLMeterElement;
  let hintUntil = 0;
  const say = (message: string) => { hint.textContent = message;hintUntil = performance.now() + 5000; };
  const checkpointTrial = () => {
    if (active?.kind !== 'challenge' || active.index !== undefined || !level.activeCheckpoint) return;
    return CRYSTAL_TRIALS[level.checkpoints.findIndex(cp => cp === level.activeCheckpoint)];
  };
  p.onCourseHint = (title, description) => say(`${title} · ${description}`);
  p.onCheckpoint = () => {
    const trial = checkpointTrial();
    say(trial ? `${trial.name} · Checkpoint saved` : 'Checkpoint saved');
  };
  p.onFinish = () => { paused = true;queueMicrotask(() => menu(`${current.name} complete.`)); };
  const pause = () => { paused = true;accumulator = 0;input.consumeEdges(true);sfx.stopLoops(); };
  const resume = () => {
    if (!active || p.state === 'finished') return;
    paused = false;last = 0;input.consumeEdges(true);canvas.focus();
  };
  const reset = (hard: boolean) => {
    p.respawn(level, hard);level.setRunModesEnabled(false);
    p.endlessDeaths = true;look.reset();animation.restart();accumulator = 0;snapVersion = -1;
  };
  const retry = () => {
    if (!active) return;
    const trial = p.state === 'finished' ? undefined : checkpointTrial();
    reset(!trial);
    say(trial ? `${trial.name} · From checkpoint` : current.name);
  };
  async function load(selection: PlaytestSelection) {
    pause();
    let data: CustomLevelData;
    if (selection.kind === 'grid') data = REJECTED_GRID;
    else if (selection.index === undefined) data = selection.kind === 'challenge' ? CRYSTAL_TRIALS_LEVEL : CRYSTAL_REJECTS_LEVEL;
    else {
      const trial = (selection.kind === 'challenge' ? CRYSTAL_TRIALS : REJECTED_CRYSTAL_TRIALS)[selection.index];
      if (!trial) throw Error('Unknown challenge');
      data = trialLevel(trial);
      if (selection.kind === 'reject') data.crystalTrials = 'archive';
    }
    active = undefined;
    level?.dispose();
    current = { id: `phone-${selection.kind}-${selection.index ?? 'all'}`, name: data.name, data };
    level = new Level(scene, current);p.enterLevel(current.id);reset(true);
    sky.material.map ??= makeSkyTexture(level.theme);sky.material.needsUpdate=true;
    for(const mesh of level.groundMeshes){mesh.receiveShadow=true;mesh.castShadow=mesh.userData.castShadow!==false;}
    await Promise.all([level.prepareJungleAssets(), level.prepareSurfaceImages()]);
    await presentationAssets.waitUntilSettled();
    p.prepareStartPresentation(level);
    await presentCourse();
    active = selection;
    say(data.name);
  }
  const debug = {
    player: p, input, scene, camera, renderer, frameStats: stats,
    getLevel: () => level, getCurrentLevel: () => current,
    get selection() { return active; },
    get trialOffset() { return active?.index === undefined ? undefined : [0, 0, 0]; },
    load, pause, resume, retry,
    captureBonusReviewFrame: () => {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return canvas.toDataURL('image/png');
    },
    get paused() { return paused; },
  };
  Object.assign(window, { __game: debug });
  function setControlDirection() {
    const control = cameraViewDirection(level.cameraViews, p.pos.x, p.pos.y, p.pos.z, { x: 0, z: -1 });
    p.camDir.set(control.x, 0, control.z);forward.copy(p.camDir);
  }
  function drawWorld(dt: number, interpolation: number) {
    p.applyRenderInterpolation(interpolation);
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
      look.step(input.lookX, input.lookY, dt);look.apply(camera, aim);
      snapVersion = p.renderSnapVersion;
      portrait.apply(camera, true);
      presentation.prepareRender(camera);p.prepareMaskPresentation();puffs.update(dt, camera);
      sky.position.copy(camera.position);sun.target.position.copy(subject);sun.position.copy(subject);sun.position.x-=26;sun.position.y+=48;sun.position.z+=21;
      scene.updateMatrixWorld(true);camera.updateMatrixWorld();
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    } finally { p.restoreRenderPose(); }
  }
  async function presentCourse() {
    // Keep the picker over the canvas until the GPU has completed a spawn frame
    // in the current context. A reset during that draw needs a new frame.
    for (;;) {
      await graphics.ready();
      if (!document.hidden && canvas.clientWidth && canvas.clientHeight && !gl.isContextLost()) {
        const generation = graphics.diagnostics.restores;
        try {
          resize();
          setControlDirection();
          drawWorld(0, 1);
          await waitForPresentationGpu(renderer);
          await afterPresentationPaint();
          if (!document.hidden && !gl.isContextLost() && generation === graphics.diagnostics.restores) {
            // WebKit can discard a covered drawing buffer between paints.
            // Redraw in the same turn that reveals the HUD and the canvas.
            drawWorld(0, 1);
            if (!gl.isContextLost()) return;
          }
        } catch (error) {
          if (!gl.isContextLost()) throw error;
        }
      }
      await afterPresentationPaint();
    }
  }
  function advance(now: number) {
    const dt = Math.min(.05, (now - (last || now)) / 1000);last = now;
    input.update();
    if (input.pausePressed && level) { if (!paused) menu();input.pausePressed = false; }
    if (!level || paused) { input.consumeEdges(true);return; }
    if (input.moveX || input.moveY || input.jumpHeld || input.spinHeld || input.grindHeld || input.grabHeld) sfx.unlock();
    setControlDirection();
    accumulator += dt;
    while (accumulator + 1e-10 >= CONST.fixedStep && !paused) {
      p.step(CONST.fixedStep, input, level);level.update(CONST.fixedStep);
      p.flushLevelCrateRewards(level);p.commitRenderStep(level);input.consumeEdges();
      accumulator = Math.max(0, accumulator - CONST.fixedStep);stats.totalFixedSteps++;
    }
    drawWorld(dt, accumulator / CONST.fixedStep);
    const goals = level.skateCollectathon;
    count.textContent = goals ? `${goals.collected}/${goals.tokens.length} crystals · ${p.totalDeaths} deaths` : '';
    balance.hidden = p.state !== 'grind';balance.value = p.balance;
    if (now > hintUntil) hint.textContent = goals?.exitReady ? 'Exit open' : '';
  }
  function render(now: number) {
    requestAnimationFrame(render);
    stats.frame++;
    if (document.hidden || graphics.lost || gl.isContextLost()) {
      last = 0;
      return;
    }
    try {
      advance(now);
    } catch (error) {
      if (gl.isContextLost()) return; // The driver can fail a draw before the loss event is delivered.
      menu('The course could not be drawn. Tap Play to try again.');
      console.error(error);
    }
  }
  requestAnimationFrame(render);
  return { load, pause, resume, retry,
    get selection() { return active; },
    get finished() { return p.state === 'finished'; },
    get checkpointRetry() { return p.state !== 'finished' && !!checkpointTrial(); },
  };
}
