// Local real-input review; no settings, source assets or browser drafts saved.
import * as THREE from 'three';
import { Level } from '../src/level';
import { RigBinding, createPlayerStarterAnimationSuite } from '../src/animation';
import type { AnimationClip } from '../src/animation';
import previousClips from './fixtures/pre-reference-jump-clips.json';
import { sfx } from '../src/audio';

const g: any = await new Promise(resolve => {
  const poll = () => { const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll); }; poll();
});
const p = g.player, runtime = g.characterAnimationRuntime;
const binding = RigBinding.fromSculptRuntime(p.animationRig.root);
const suite = createPlayerStarterAnimationSuite(binding.definition);
const level = new Level(g.scene, {id: 'jump-review', name: 'Jump review', data: {v: 1, name: 'Jump review',
  spawn: [1000, .02, 0], killY: -30, components: [
    {t: 'platform', p: [1000, -.5, 0], s: [200, 1, 200]}, {t: 'gate', p: [1000, 0, -90]},
  ]}});
let mode = 'Full jump', before = false, frame = 0, frozen = false, slow = false, skips = 0;
let angle = Math.PI / 2, stopAt = 'None', hadAir = false, landFrame = 0, doubleFrame = 0;
const visited = new Set<string>();
function reset() {
  frame = landFrame = doubleFrame = 0; frozen = hadAir = false; visited.clear();
  p.enterLevel('jump-review'); p.respawn(level, true);
  p.freeSkate = false;
  runtime.setDocument(before ? {...suite, clips: suite.clips.map(clip =>
    (previousClips.find(old => old.id === clip.id) as AnimationClip | undefined) ?? clip)} : suite);
  runtime.restart();
}
const nativeStep = p.step.bind(p);
p.step = (dt: number) => {
  if (frozen || slow && ++skips % 3 !== 0) return;
  const hold = mode === 'Tap jump' ? 3 : mode === 'Running jump' ? 18 : 35, release = 50 + hold;
  const input = {moveX: 0, moveY: mode === 'Running jump' ? 1 : 0,
    jumpHeld: frame >= 50 && frame < release, jumpPressed: frame === 50, jumpReleased: frame === release};
  if (mode === 'Double jump' && hadAir && !doubleFrame && p.vVel < 2) {
    input.jumpPressed = input.jumpHeld = true; doubleFrame = frame;
  }
  if (doubleFrame && frame === doubleFrame + 1) input.jumpReleased = true;
  nativeStep(dt, input, level); level.update(dt); frame++;
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
  if (frame > 300) reset();
};
const nativeRender = g.renderer.render.bind(g.renderer);
g.renderer.render = (...args: any[]) => {
  if (args[1] === g.camera) {
    const target = p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle) * 6.4, .25, Math.cos(angle) * 6.4));
    g.camera.up.set(0, 1, 0); g.camera.lookAt(target); g.camera.updateMatrixWorld(true);
  }
  return nativeRender(...args);
};
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;top:10px;left:10px;z-index:999999;background:#142333e8;color:white;padding:12px;width:240px;font:12px monospace';
const controls = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'jump-review-status'; status.style.whiteSpace = 'pre-wrap'; panel.append(controls, status); document.body.append(panel);
const button = (label: string, fn: () => void) => {
  const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = 'padding:5px;margin:2px'; controls.append(b);
};
for (const name of ['Tap jump', 'Full jump', 'Double jump', 'Running jump']) button(name, () => { mode = name; reset(); });
button('Before', () => { before = true; reset(); }); button('After', () => { before = false; reset(); });
for (const [name, a] of [['Front', Math.PI], ['Side', Math.PI / 2], ['Behind', 0], ['Oblique', .7]] as const) button(name, () => angle = a);
button('Freeze / play', () => frozen = !frozen); button('Slow / realtime', () => slow = !slow);
for (const name of ['None', 'Charge', 'Reach', 'Apex', 'Catch', 'Rebound', 'Settled']) button('Pause: ' + name, () => {stopAt = name; reset();});
function report() {
  panel.inert = false; panel.removeAttribute('aria-hidden');
  const d = runtime.diagnostics, scalars = runtime.lastSampledPose?.scalars;
  status.textContent = JSON.stringify({mode, before, frame, frozen, slow, stopAt,
    audio: sfx.jumpAudioSource, soundsPlayed: sfx.jumpAudioPlays,
    active: d.activeClipId, phase: d.timelineTime?.toFixed(3), vVel: p.vVel.toFixed(2), grounded: p.grounded,
    torso: scalars?.['deform.torso.length']?.toFixed(2), shin: scalars?.['deform.leg.lower.left.length']?.toFixed(2),
    visited: [...visited]}, null, 2);
  requestAnimationFrame(report);
}
reset(); report();
