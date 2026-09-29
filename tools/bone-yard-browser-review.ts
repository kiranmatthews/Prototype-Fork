// Local-only review controls. The public playground uses ordinary gameplay.
import * as THREE from 'three';
import { CharacterBreakApart } from '../src/character/breakApart';
const g: any = await new Promise(resolve => {
  const poll = () => { const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll); }; poll();
});
g.campaign.startEphemeral(); g.gameFlow.hide();
const p = g.player;
const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  spinHeld: false, spinPressed: false, grindHeld: false, grindPressed: false,
  grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false, inventoryHeld: true };
let frozen = true, manual = false, mode = 'Ready', angle = 1.12, freezeAt = .35, armed = false, freezeRecall = false;
const native = p.step.bind(p), anchor = new THREE.Vector3();
const timings: number[] = [];
const effectTimes: number[] = [];
let effectMs = 0;
for (const key of ['restore', 'request', 'step'] as const) {
  const original = CharacterBreakApart.prototype[key];
  (CharacterBreakApart.prototype as any)[key] = function (...args: any[]) {
    const started = performance.now();
    try { return (original as any).apply(this, args); } finally { effectMs += performance.now() - started; }
  };
}
const step = (dt: number, input: any, level: any) => {
  if (frozen) return;
  effectMs = 0;
  const t = performance.now(); native(dt, manual ? input : neutral, level); timings.push(performance.now() - t);
  effectTimes.push(effectMs); if (effectTimes.length > 180) effectTimes.shift();
  if (timings.length > 180) timings.shift();
  const d = p.breakApartDiagnostics;
  if (armed && d?.active && d.age >= freezeAt) { frozen = true; armed = false; }
  if (freezeRecall && d?.returnProgress >= .45) { frozen = true; freezeRecall = false; }
};
p.step = step;
function start(kind: string, pause = .35) {
  const level = g.getLevel();
  const x = kind === 'Head hit' || kind === 'Slow bump' ? -7 : kind === 'Low trip' ? 7 : 0;
  p.respawn(level, true, true, { position: new THREE.Vector3(x, .04, -20), heading: new THREE.Vector3(0, 0, -1) });
  native(1 / 60, neutral, level);
  p.setCharacterHeadStyle('skull');
  p.freeSkate = kind !== 'Fatal scatter' && kind !== 'Side bail';
  p.speed = kind === 'Slow bump' ? 8 : kind === 'Fatal scatter' ? 0 : 24;
  p.onDeath = () => {};
  if (kind === 'Fatal scatter') { p.die(); p.respawnTimer = 30; }
  if (kind === 'Side bail') p.beginPvpKnockdown(5, 1);
  anchor.set(x, .8, kind === 'Fatal scatter' || kind === 'Side bail' ? -20 : -29);
  mode = kind; manual = false; frozen = false; armed = true; freezeAt = pause; timings.length = 0;
  freezeRecall = false;
  effectTimes.length = 0;
}
const render = g.renderer.render.bind(g.renderer), target = new THREE.Vector3(), eye = new THREE.Vector3();
g.renderer.render = (...args: any[]) => {
  if (args[1] === g.camera && !manual) {
    target.copy(anchor); eye.copy(target).add(new THREE.Vector3(Math.sin(angle) * 12, 5.5, Math.cos(angle) * 12));
    g.camera.position.copy(eye); g.camera.fov = 45; g.camera.lookAt(target); g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld(true);
  }
  return render(...args);
};
const panel = document.createElement('div');
panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:999999;background:#142434ed;color:white;padding:10px;font:12px monospace;max-width:650px';
const controls = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'bone-yard-status'; panel.append(controls, status); document.body.append(panel);
function add(label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = 'padding:7px;margin:2px'; controls.append(b); }
for (const name of ['Head hit', 'Low trip', 'Side bail', 'Fatal scatter', 'Slow bump']) add(name, () => start(name));
add('Resume', () => { frozen = false; armed = false; }); add('Freeze', () => frozen = true);
add('Step 6 frames', () => { for (let i = 0; i < 6; i++) { native(1 / 60, neutral, g.getLevel()); g.getLevel().update(1 / 60); } p.commitRenderStep(g.getLevel()); });
add('Side', () => angle = Math.PI / 2); add('Quarter', () => angle = 1.12); add('Front', () => angle = Math.PI);
add('Play course', () => { p.respawn(g.getLevel(), true); manual = true; frozen = false; armed = false; });
(window as any).__boneReview = { start, resume: (recall = false) => { frozen = false; armed = false; freezeRecall = recall; }, freeze: () => frozen = true };
function report() {
  panel.inert = false;
  status.textContent = JSON.stringify({ mode, frozen, state: p.state, ...p.breakApartDiagnostics,
    averageStepMs: timings.length ? +(timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(3) : 0,
    effectAverageMs: effectTimes.length ? +(effectTimes.reduce((a, b) => a + b, 0) / effectTimes.length).toFixed(3) : 0 }, null, 1);
  requestAnimationFrame(report);
} report();
