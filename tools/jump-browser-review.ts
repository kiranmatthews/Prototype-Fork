// Local A/B playtest. Live controls are the default; source drafts are never saved.
import * as THREE from 'three';
import { Level } from '../src/level';
import { RigBinding, createPlayerStarterAnimationSuite } from '../src/animation';
import type { AnimationClip } from '../src/animation';
import previousClips from './fixtures/pre-reference-jump-clips.json';
import { sfx } from '../src/audio';
import { createJakStudySuite, JAK_JUMP_PHYSICS } from './jak-jump-variant';

const g: any = await new Promise(resolve => {
  const poll = () => {
    const game = (window as any).__game;
    if (game && !game.gameFlow.blocksGameplay) resolve(game); else requestAnimationFrame(poll);
  }; poll();
});
g.campaign.startEphemeral();
const p = g.player, runtime = g.characterAnimationRuntime;
const binding = RigBinding.fromSculptRuntime(p.animationRig.root);
const suite = createPlayerStarterAnimationSuite(binding.definition);
const oldSuite = {...suite, clips: suite.clips.map(clip =>
  (previousClips.find(old => old.id === clip.id) as AnimationClip | undefined) ?? clip)};
const studySuite = createJakStudySuite(suite);
let variant: 'A' | 'B' | 'C' = 'B';
let before = false, inspect = false, jakSounds = true;
let reviewLevel: Level | null = null, savedCoursePosition: THREE.Vector3 | null = null;
let mode = 'Full jump', frame = 0, frozen = false, slow = false, skips = 0;
let angle = Math.PI / 2, stopAt = 'None', hadAir = false, landFrame = 0, doubleFrame = 0;
let lastSwitch = {positionDelta: 0, verticalVelocityDelta: 0, speedDelta: 0};
const visited = new Set<string>(), soundPlays = {old: 0, new: 0};
const nativeJumpSound = sfx.playJump.bind(sfx);
sfx.playJump = (second = false) => {
  if (before || !jakSounds) {
    sfx.play('footstep2', second ? .6 : .55, second ? 1.8 : 1.5);
    soundPlays.old++;
  } else {nativeJumpSound(second); soundPlays.new++;}
};

function chooseVersion(next: 'A' | 'B' | 'C') {
  const position = p.pos.clone(), velocity = p.vVel, speed = p.speed;
  variant = next; before = next === 'A';
  p.onFootJumpStudy = next === 'C' ? JAK_JUMP_PHYSICS : null;
  // No respawn, restart, input reset or camera reset. Airborne progress and
  // landing time continue while the next presentation frame reads the new keys.
  runtime.setDocument(before ? oldSuite : variant === 'C' ? studySuite : suite);
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
  const hold = mode === 'Tap jump' ? 3 : mode === 'Running jump' ? 18 : 35, release = 50 + hold;
  const demo = {moveX: 0, moveY: mode === 'Running jump' ? 1 : 0,
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
  if (frame > 300) resetInspector();
};
const nativeRender = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => {
  if (inspect && args[1] === g.camera) {
    const target = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * 6.4, .25, Math.cos(angle) * 6.4));
    g.camera.up.set(0, 1, 0); g.camera.lookAt(target); g.camera.updateMatrixWorld(true);
  }
  return nativeRender(...args);
};

const panel = document.createElement('section'); panel.id = 'jump-ab-panel';
panel.setAttribute('aria-label', 'Jump A/B/C playtest');
panel.innerHTML = '<h1>Jump A/B/C playtest</h1>';
const versions = document.createElement('div'), current = document.createElement('div');
current.dataset.testid = 'jump-ab-current'; panel.append(versions, current);
const button = (parent: HTMLElement, label: string, fn: () => void) => {
  const b = document.createElement('button'); b.textContent = label;
  b.onclick = () => {sfx.unlock(); fn(); b.blur();}; parent.append(b); return b;
};
const oldButton = button(versions, 'A · Original', () => chooseVersion('A'));
const newButton = button(versions, 'B · Animation', () => chooseVersion('B'));
const studyButton = button(versions, 'C · Jak feel', () => chooseVersion('C'));
const instructions = document.createElement('p');
instructions.textContent = 'WASD / arrows to move · Space to jump; tap again in air for double jump. Controller controls work too.';
const continuity = document.createElement('small'); continuity.textContent = '1 / 2 / 3 switches A / B / C. C physics starts on your next foot jump; skating stays unchanged.';
panel.append(instructions, continuity);
const options = document.createElement('details'); options.innerHTML = '<summary>Playtest options</summary>';
const soundLabel = document.createElement('label'), soundBox = document.createElement('input');
soundBox.type = 'checkbox'; soundBox.checked = true;
soundBox.onchange = () => {jakSounds = soundBox.checked; soundBox.blur();};
soundLabel.append(soundBox, ' Jak sounds in B / C'); options.append(soundLabel);
const modes = document.createElement('div'); options.append(modes);
const playButton = button(modes, 'Play course', () => setInspect(false));
const inspectButton = button(modes, 'Watch motion', () => setInspect(true));
button(modes, 'Restart course', () => {
  setInspect(false); p.enterLevel(g.getCurrentLevel().id); p.respawn(g.getLevel(), true, true);
  p.freeSkate = false; runtime.restart(); visited.clear();
});
const inspectorControls = document.createElement('div'); inspectorControls.hidden = true; options.append(inspectorControls);
for (const name of ['Tap jump', 'Full jump', 'Double jump', 'Running jump'])
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
  if (['Digit1', 'Digit2', 'Digit3'].includes(event.code)) {
    event.preventDefault(); chooseVersion(event.code === 'Digit1' ? 'A' : event.code === 'Digit2' ? 'B' : 'C');
  }
}, true);
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  oldButton.setAttribute('aria-pressed', String(before)); newButton.setAttribute('aria-pressed', String(variant === 'B'));
  studyButton.setAttribute('aria-pressed', String(variant === 'C'));
  playButton.setAttribute('aria-pressed', String(!inspect)); inspectButton.setAttribute('aria-pressed', String(inspect));
  const audio = before || !jakSounds ? 'Original sounds' : sfx.jumpAudioSource;
  current.textContent = `${variant} · ${variant === 'A' ? 'Original motion + physics' : variant === 'B' ? 'New motion · original physics' : 'Jak motion + foot physics'} · ${audio}`;
  const d = runtime.diagnostics, scalars = runtime.lastSampledPose?.scalars;
  status.textContent = JSON.stringify({variant, mode: inspect ? mode : 'Live play', before, frame, frozen, slow, stopAt,
    audio, soundPlays, active: d.activeClipId, phase: d.timelineTime?.toFixed(3),
    position: p.pos.toArray().map((v: number) => +v.toFixed(3)), vVel: +p.vVel.toFixed(3), grounded: p.grounded,
    lastSwitch, torso: scalars?.['deform.torso.length']?.toFixed(2), shin: scalars?.['deform.leg.lower.left.length']?.toFixed(2),
    visited: [...visited]}, null, 2);
  requestAnimationFrame(report);
}
p.freeSkate = false; chooseVersion('B'); report();
