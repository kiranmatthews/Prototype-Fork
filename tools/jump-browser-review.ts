// Local A/B/C/D playtest. Live controls are the default; source drafts are never saved.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Level } from '../src/level';
import { RigBinding, createPlayerStarterAnimationSuite } from '../src/animation';
import type { AnimationClip } from '../src/animation';
import previousClips from './fixtures/pre-reference-jump-clips.json';
import { sfx } from '../src/audio';
import { createJakStudySuite, JAK_JUMP_PHYSICS } from './jak-jump-variant';
import { createJakDirectSuite, JAK_DIRECT_PHYSICS, type JakMotionBank } from './jak-direct-motion';
import { GreenEcoFire } from '../src/greenEcoFire';
import { JUMP_ECO_VENTS } from './jump-eco-vents';

const g: any = await new Promise(resolve => {
  const poll = () => {
    const game = (window as any).__game;
    if (game && !game.gameFlow.blocksGameplay) resolve(game); else requestAnimationFrame(poll);
  }; poll();
});
g.campaign.startEphemeral();
const p = g.player, runtime = g.characterAnimationRuntime;
const ecoFire = new GreenEcoFire(g.scene, JUMP_ECO_VENTS);
let ecoEnabled = true, ecoVisit = 0;
let ecoCpuMs = 0;
const binding = RigBinding.fromSculptRuntime(p.animationRig.root);
const suite = createPlayerStarterAnimationSuite(binding.definition);
const oldSuite = {...suite, clips: suite.clips.map(clip =>
  (previousClips.find(old => old.id === clip.id) as AnimationClip | undefined) ?? clip)};
const studySuite = createJakStudySuite(suite);
let directSuite: typeof suite | null = null;
try {
  const response = await fetch('/__jak-reference-motion/motion.json');
  if (response.ok) directSuite = createJakDirectSuite(suite, binding.definition, await response.json() as JakMotionBank);
} catch (error) { console.warn('Local Jak motion unavailable', error); }
let variant: 'A' | 'B' | 'C' | 'D' = 'B';
let before = false, inspect = false, jakSounds = true;
const nativePuffUpdate = g.puffs.update.bind(g.puffs);
g.puffs.update = (dt: number, camera: THREE.Camera) => {
  nativePuffUpdate(dt, camera);
  ecoFire.enabled = ecoEnabled && !inspect && g.getCurrentLevel().id === 'codex-lab';
  const start = performance.now();
  ecoFire.update(dt, camera);
  ecoCpuMs += (performance.now() - start - ecoCpuMs) * .04;
};
let reviewLevel: Level | null = null, savedCoursePosition: THREE.Vector3 | null = null;
let mode = 'Full jump', frame = 0, frozen = false, slow = false, skips = 0;
let angle = Math.PI / 2, stopAt = 'None', hadAir = false, landFrame = 0, doubleFrame = 0;
let lastSwitch = {positionDelta: 0, verticalVelocityDelta: 0, speedDelta: 0};
let sourceModel: THREE.Group | null = null, sourceMixer: THREE.AnimationMixer | null = null;
const sourceActions = new Map<string, THREE.AnimationAction>();
const sourceOffset = new THREE.Vector3();
async function loadSource() {
  if (sourceModel) return;
  sourceNote.textContent = 'Loading local Jak reference…';
  try {
    const gltf = await new GLTFLoader().loadAsync('/__jak-reference-motion/eichar-lod0.glb');
    sourceModel = gltf.scene; sourceModel.visible = false;
    // The exported shared buffer contains unused vertices from other meshes.
    // Keep the complete LOD0 geometry and skip invalid unused-vertex bounds.
    sourceModel.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.frustumCulled = false;
        if (node instanceof THREE.SkinnedMesh) node.boundingSphere = new THREE.Sphere(new THREE.Vector3(0,1,0),5);
      }
    });
    g.scene.add(sourceModel); sourceMixer = new THREE.AnimationMixer(sourceModel);
    for (const clip of gltf.animations) {
      const action = sourceMixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce,1); action.clampWhenFinished = true; action.play(); action.paused = true; action.weight = 0;
      sourceActions.set(clip.name.replace('eichar-',''),action);
    }
    sourceNote.textContent = 'Bone Man left · original Jak right · same source frame';
  } catch (error) { sourceBox.checked = false; sourceNote.textContent = 'Local Jak model unavailable.'; console.warn(error); }
}
function updateSource() {
  if (!sourceModel || !sourceMixer) return false;
  sourceModel.visible = inspect && variant === 'D' && sourceBox.checked;
  if (!sourceModel.visible) return false;
  const clip = runtime.document.clips.find((c: AnimationClip) => c.id === runtime.activeClipId);
  let name = clip?.metadata?.jakSourceClip as string | undefined, time = runtime.diagnostics.timelineTime ?? 0;
  if (clip?.metadata?.jakSourceLeadClip) {
    const cycle = Number(clip.metadata.jakSourceLeadFrames) / 60, lead = cycle * Number(clip.metadata.jakSourceLeadRepeats);
    if (time < lead) {name = String(clip.metadata.jakSourceLeadClip); time %= cycle;} else time -= lead;
  }
  if (clip?.metadata?.jakSourceTailClip && time * 60 >= Number(clip.metadata.jakSourceTailAt)) {
    name = String(clip.metadata.jakSourceTailClip);
    time += (Number(clip.metadata.jakSourceTailFrame) - Number(clip.metadata.jakSourceTailAt)) / 60;
  }
  time += Number(clip?.metadata?.jakSourceStartFrame ?? 0) / 60;
  if (name === 'jump' && p.footStudyFrame > 40) {name = 'jump-loop'; time = ((p.footStudyFrame - 40) / 60) % (28 / 60);}
  for (const action of sourceActions.values()) action.weight = 0;
  const set = (id: string, weight: number) => {
    const action = sourceActions.get(id); if (!action) return;
    action.enabled = true; action.weight = weight; action.time = Math.min(time, action.getClip().duration);
  };
  if (name) set(name,1); else set('stance-loop',1);
  const speed = p.walkVelocity.length();
  if (name === 'jump' || name === 'run') {
    const weight = name === 'jump' ? THREE.MathUtils.clamp((speed - 2.5) / 5,0,1) : 1 - THREE.MathUtils.clamp((speed - 4) / 5,0,1);
    set(name,1-weight); set(name === 'jump' ? 'jump-forward' : 'walk',weight);
  }
  sourceMixer.update(0);
  sourceOffset.set(Math.cos(angle),0,-Math.sin(angle)).multiplyScalar(2.5);
  sourceModel.position.copy(p.pos).add(sourceOffset); p.bodyGroup.getWorldQuaternion(sourceModel.quaternion);
  return true;
}
const visited = new Set<string>(), soundPlays = {old: 0, new: 0};
const nativeJumpSound = sfx.playJump.bind(sfx);
sfx.playJump = (second = false) => {
  if (before || !jakSounds) {
    sfx.play('footstep2', second ? .6 : .55, second ? 1.8 : 1.5);
    soundPlays.old++;
  } else {nativeJumpSound(second); soundPlays.new++;}
};

function chooseVersion(next: 'A' | 'B' | 'C' | 'D') {
  if (next === 'D' && !directSuite) return;
  const position = p.pos.clone(), velocity = p.vVel, speed = p.speed;
  variant = next; before = next === 'A';
  p.onFootJumpStudy = next === 'D' ? JAK_DIRECT_PHYSICS : next === 'C' ? JAK_JUMP_PHYSICS : null;
  // No respawn, restart, input reset or camera reset. Airborne progress and
  // landing time continue while the next presentation frame reads the new keys.
  runtime.setDocument(before ? oldSuite : variant === 'D' ? directSuite! : variant === 'C' ? studySuite : suite);
  lastSwitch = {positionDelta: position.distanceTo(p.pos),
    verticalVelocityDelta: p.vVel - velocity, speedDelta: p.speed - speed};
  if (inspect && frozen) resetInspector();
}
function resetInspector() {
  if (!reviewLevel) return;
  frame = landFrame = doubleFrame = 0; frozen = hadAir = false; visited.clear();
  p.enterLevel('jump-review'); p.respawn(reviewLevel, true); p.freeSkate = false;
  runtime.restart();
}
function setInspect(value: boolean) {
  if (value === inspect) return;
  inspect = value;
  if (inspect) {
    savedCoursePosition = p.pos.clone();
    reviewLevel ??= new Level(g.scene, {id: 'jump-review', name: 'Jump review', data: {
      v: 1, name: 'Jump review', spawn: [1000, .02, 0], killY: -30, components: [
        {t: 'platform', p: [1000, -.5, 0], s: [200, 1, 200]}, {t: 'gate', p: [1000, 0, -90]},
      ],
    }});
    resetInspector();
  } else {
    frozen = false; slow = false; stopAt = 'None';
    p.enterLevel(g.getCurrentLevel().id);
    p.respawn(g.getLevel(), true, true, savedCoursePosition ? {position: savedCoursePosition} : undefined);
    p.freeSkate = false; runtime.restart();
  }
  inspectorControls.hidden = !inspect;
}
const nativeStep = p.step.bind(p);
p.step = (dt: number, input: any, level: Level) => {
  if (!inspect) {
    const result = nativeStep(dt, input, level);
    frame++; visited.add(runtime.activeClipId ?? 'legacy');
    return result;
  }
  if (!reviewLevel || frozen || slow && ++skips % 3 !== 0) return;
  const running = mode === 'Running jump' || mode === 'Run and stop';
  const hold = mode === 'Tap jump' ? 3 : running ? 18 : 35, release = 50 + hold;
  const demo = {moveX: 0, moveY: running && (mode !== 'Run and stop' || frame < 145) ? 1 : 0,
    jumpHeld: frame >= 50 && frame < release, jumpPressed: frame === 50, jumpReleased: frame === release};
  if (mode === 'Double jump' && hadAir && !doubleFrame && p.vVel < 2) {
    demo.jumpPressed = demo.jumpHeld = true; doubleFrame = frame;
  }
  if (doubleFrame && frame === doubleFrame + 1) demo.jumpReleased = true;
  nativeStep(dt, demo, reviewLevel); reviewLevel.update(dt); frame++;
  visited.add(runtime.activeClipId ?? 'legacy');
  if (!p.grounded) hadAir = true; else if (hadAir && !landFrame) landFrame = frame;
  const phase = runtime.diagnostics.motionContext?.actionProgress ?? 0;
  const targetAir = mode !== 'Double jump' || doubleFrame > 0 && frame > doubleFrame + 1;
  if (stopAt === 'Charge' && frame === release || targetAir && (
      stopAt === 'Reach' && !p.grounded && phase >= .12 && p.vVel > 0 ||
      stopAt === 'Apex' && !p.grounded && p.vVel <= 0 ||
      stopAt === 'Catch' && landFrame && frame === landFrame + 5 ||
      stopAt === 'Rebound' && landFrame && frame === landFrame + 11 ||
      stopAt === 'Settled' && landFrame && frame === landFrame + 40)) frozen = true;
  if (frame > (mode === 'Run and stop' ? 750 : 300)) resetInspector();
};
const nativeRender = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => {
  const alongside = args[1] === g.camera && updateSource();
  if (inspect && args[1] === g.camera) {
    const target = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    if (alongside) target.addScaledVector(sourceOffset,.5);
    const distance = alongside ? 8.2 : 6.4;
    g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * distance, .25, Math.cos(angle) * distance));
    g.camera.up.set(0, 1, 0); g.camera.lookAt(target); g.camera.updateMatrixWorld(true);
  }
  return nativeRender(...args);
};

const panel = document.createElement('section'); panel.id = 'jump-ab-panel';
panel.setAttribute('aria-label', 'Jump A/B/C/D playtest');
panel.innerHTML = '<h1>Jump A/B/C/D playtest</h1>';
const versions = document.createElement('div'), current = document.createElement('div');
versions.className = 'versions';
current.dataset.testid = 'jump-ab-current'; panel.append(versions, current);
const button = (parent: HTMLElement, label: string, fn: () => void) => {
  const b = document.createElement('button'); b.textContent = label;
  b.onclick = () => {sfx.unlock(); fn(); b.blur();}; parent.append(b); return b;
};
const oldButton = button(versions, 'A · Original', () => chooseVersion('A'));
const newButton = button(versions, 'B · Animation', () => chooseVersion('B'));
const studyButton = button(versions, 'C · Jak feel', () => chooseVersion('C'));
const directButton = button(versions, 'D · Direct Jak', () => chooseVersion('D'));
directButton.disabled = !directSuite;
if (!directSuite) directButton.title = 'Start the local server with the extracted Jak motion bank to enable D.';
const controlsToggle = button(panel,'Hide controls',() => {
  const compact = panel.classList.toggle('compact');
  controlsToggle.textContent = compact ? 'Show controls' : 'Hide controls';
});
controlsToggle.className = 'controls-toggle';
const instructions = document.createElement('p');
instructions.textContent = 'WASD / arrows to move · Space to jump; tap again in air for double jump. Controller controls work too.';
const continuity = document.createElement('small'); continuity.textContent = '1 / 2 / 3 / 4 switches A / B / C / D. Air physics changes on your next foot jump.';
panel.append(instructions, continuity);
const directHint = document.createElement('p');
directHint.textContent = 'D uses extracted Jak motion and recovery pacing. Your release-to-jump / hold-to-skate controls stay the same.';
panel.append(directHint);
const options = document.createElement('details'); options.innerHTML = '<summary>Playtest options</summary>';
const soundLabel = document.createElement('label'), soundBox = document.createElement('input');
soundBox.type = 'checkbox'; soundBox.checked = true;
soundBox.onchange = () => {jakSounds = soundBox.checked; soundBox.blur();};
soundLabel.append(soundBox, ' Jak sounds in B / C / D'); options.append(soundLabel);
const ecoLabel = document.createElement('label'), ecoBox = document.createElement('input');
ecoBox.type = 'checkbox'; ecoBox.checked = true;
ecoBox.onchange = () => {ecoEnabled = ecoBox.checked; ecoBox.blur();};
ecoLabel.append(ecoBox, ' Green eco fire'); options.append(ecoLabel);
const modes = document.createElement('div'); options.append(modes);
const playButton = button(modes, 'Play course', () => setInspect(false));
const inspectButton = button(modes, 'Watch motion', () => setInspect(true));
button(modes, 'Restart course', () => {
  setInspect(false); p.enterLevel(g.getCurrentLevel().id); p.respawn(g.getLevel(), true, true);
  p.freeSkate = false; runtime.restart(); visited.clear();
});
const ecoNote = document.createElement('small');
button(modes, 'Next eco vent', () => {
  setInspect(false); ecoEnabled = ecoBox.checked = true;
  const vent = JUMP_ECO_VENTS[ecoVisit++ % JUMP_ECO_VENTS.length];
  p.enterLevel(g.getCurrentLevel().id);
  p.respawn(g.getLevel(), true, true, {position: new THREE.Vector3(...vent.approach)});
  p.freeSkate = false; runtime.restart(); ecoNote.textContent = `Eco vent · ${vent.name}`;
});
options.append(ecoNote);
const inspectorControls = document.createElement('div'); inspectorControls.hidden = true; options.append(inspectorControls);
const sourceLabel = document.createElement('label'), sourceBox = document.createElement('input'), sourceNote = document.createElement('small');
sourceBox.type = 'checkbox'; sourceBox.onchange = () => {if (sourceBox.checked) void loadSource(); sourceBox.blur();};
sourceLabel.append(sourceBox,' Show original Jak alongside (D)'); inspectorControls.append(sourceLabel,sourceNote);
for (const name of ['Tap jump', 'Full jump', 'Double jump', 'Running jump', 'Run and stop'])
  button(inspectorControls, name, () => {mode = name; resetInspector();});
for (const [name, a] of [['Front', Math.PI], ['Side', Math.PI / 2], ['Behind', 0], ['Oblique', .7]] as const)
  button(inspectorControls, name, () => angle = a);
button(inspectorControls, 'Freeze / play', () => frozen = !frozen);
button(inspectorControls, 'Slow / realtime', () => slow = !slow);
for (const name of ['None', 'Charge', 'Reach', 'Apex', 'Catch', 'Rebound', 'Settled'])
  button(inspectorControls, 'Pause: ' + name, () => {stopAt = name; resetInspector();});
const diagnostics = document.createElement('details'); diagnostics.innerHTML = '<summary>Diagnostics</summary>';
const status = document.createElement('pre'); status.dataset.testid = 'jump-review-status'; diagnostics.append(status);
options.append(diagnostics); panel.append(options); document.body.append(panel);
window.addEventListener('keydown', event => {
  if (event.repeat || (event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]')) return;
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(event.code)) {
    event.preventDefault(); chooseVersion(event.code === 'Digit1' ? 'A' : event.code === 'Digit2' ? 'B' : event.code === 'Digit3' ? 'C' : 'D');
  }
}, true);
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  oldButton.setAttribute('aria-pressed', String(before)); newButton.setAttribute('aria-pressed', String(variant === 'B'));
  studyButton.setAttribute('aria-pressed', String(variant === 'C'));
  directButton.setAttribute('aria-pressed', String(variant === 'D'));
  directHint.hidden = variant !== 'D';
  instructions.textContent = 'WASD / arrows to move · Space to jump; tap again in air for double jump. Hold while running to skate.';
  playButton.setAttribute('aria-pressed', String(!inspect)); inspectButton.setAttribute('aria-pressed', String(inspect));
  const audio = before || !jakSounds ? 'Original sounds' : sfx.jumpAudioSource;
  current.textContent = `${variant} · ${variant === 'A' ? 'Original motion + physics' : variant === 'B' ? 'New motion · original physics' : variant === 'C' ? 'Jak motion + foot physics' : 'Direct source motion + Jak timing'} · ${audio}`;
  const d = runtime.diagnostics, scalars = runtime.lastSampledPose?.scalars;
  status.textContent = JSON.stringify({variant, mode: inspect ? mode : 'Live play', before, frame, frozen, slow, stopAt,
    audio, soundPlays, sourceFrame: p.footStudyFrame, sourceClip: runtime.document.clips.find((c: AnimationClip) => c.id === runtime.activeClipId)?.metadata?.jakSourceClip, skating: p.freeSkate, active: d.activeClipId, phase: d.timelineTime?.toFixed(3),
    position: p.pos.toArray().map((v: number) => +v.toFixed(3)), vVel: +p.vVel.toFixed(3), grounded: p.grounded,
    lastSwitch, torso: scalars?.['deform.torso.length']?.toFixed(2), shin: scalars?.['deform.leg.lower.left.length']?.toFixed(2),
    ecoFire: {...ecoFire.diagnostics, cpuMs: +ecoCpuMs.toFixed(3)}, visited: [...visited]}, null, 2);
  requestAnimationFrame(report);
}
p.freeSkate = false; chooseVersion(directSuite ? 'D' : 'B'); report();
