// Local-only controls. Hazards belong to this review session, never saved level data.
import * as THREE from 'three';
import { CharacterBreakApart } from '../src/character/breakApart';
const g: any = await new Promise(resolve => {
  const poll = () => { const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll); }; poll();
});
g.campaign.startEphemeral(); g.gameFlow.hide();
const p = g.player, level = g.getLevel();
level.crate(2, 0, -40, 'tnt', { noAuto: true });
const reviewTnt = level.crates.at(-1);
level.crusher(0, 0, -46, 3, 3, 3.2);
const reviewCrusher = level.crushers.at(-1);
const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  spinHeld: false, spinPressed: false, grindHeld: false, grindPressed: false,
  grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false, inventoryHeld: true };
let frozen = true, manual = false, mode = 'Ready', angle = 1.12, freezeAt = .35;
let armed = false, freezeRecall = false, incidentAge = -1, maxProbes = 0, peakParts = 0;
const native = p.step.bind(p), nativeUpdate = level.update.bind(level), anchor = new THREE.Vector3();
const timings: number[] = [], effectTimes: number[] = [];
let effectMs = 0;
for (const key of ['restore', 'request', 'step'] as const) {
  const original = CharacterBreakApart.prototype[key];
  (CharacterBreakApart.prototype as any)[key] = function (...args: any[]) {
    const started = performance.now();
    try { return (original as any).apply(this, args); } finally { effectMs += performance.now() - started; }
  };
}
level.update = (dt: number) => { if (!frozen) nativeUpdate(dt); };
p.step = (dt: number, input: any, liveLevel: any) => {
  if (frozen) return;
  effectMs = 0;
  const t = performance.now(); native(dt, manual ? input : neutral, liveLevel); timings.push(performance.now() - t);
  effectTimes.push(effectMs); if (effectTimes.length > 180) effectTimes.shift();
  if (timings.length > 180) timings.shift();
  const d = p.breakApartDiagnostics;
  maxProbes = Math.max(maxProbes, d?.probesThisStep ?? 0); peakParts = Math.max(peakParts, d?.active ? d.parts : 0);
  if (incidentAge < 0 && (p.isBailing || p.state === 'dead' || p.softSkateImpactT > 0 ||
    mode === 'Masked blast' && p.masks === 0)) incidentAge = 0;
  if (incidentAge >= 0) incidentAge += dt;
  if (p.state === 'dead') p.respawnTimer = 30;
  if (armed && incidentAge >= freezeAt) { frozen = true; armed = false; }
  if (freezeRecall && d?.returnProgress >= .45) { frozen = true; freezeRecall = false; }
};
function start(kind: string, pause = .35, head: 'skull' | 'alternate' = 'skull') {
  const wall = kind === 'Head hit' || kind === 'Slow bump' || kind === 'Held-mask wall';
  const x = wall ? -7 : kind === 'Low trip' ? 7 : kind === 'Pit fall' ? 3 : 0;
  const z = /blast|Blast/.test(kind) ? -40 : kind === 'Crusher' ? -46 : kind === 'Pit fall' ? -78 : -20;
  p.respawn(level, true, true, { position: new THREE.Vector3(x, .04, z), heading: new THREE.Vector3(0, 0, -1) });
  p.masks = kind.startsWith('Masked') || kind === 'Held-mask wall' ? 1 : 0;
  p.lives = 4;
  p.invulnTimer = 0; p.uberTimer = 0;
  p.onDeath = () => {};
  reviewCrusher.phase = -level.time; nativeUpdate(0);
  native(1 / 60, neutral, level);
  p.setCharacterHeadStyle(head);
  p.freeSkate = wall || kind === 'Low trip' || kind === 'Balance bail';
  p.speed = kind === 'Slow bump' ? 8 : wall || kind === 'Low trip' ? 24 : kind === 'Balance bail' ? 10 : 0;
  if (kind === 'Contact death') p.die('contact');
  if (kind === 'Side bail') p.beginPvpKnockdown(5, 1);
  if (kind === 'Balance bail') p.bail(false, 10, 'balance');
  if (kind === 'Masked bail') p.bail(true, 24, 'landing', 30);
  if (kind === 'Blast' || kind === 'Masked blast') level.detonate(reviewTnt);
  if (kind === 'Crusher') { reviewCrusher.phase = .38 * reviewCrusher.cycle - level.time; nativeUpdate(0); }
  if (kind === 'Pit fall') { p.grounded = false; p.state = 'air'; p.vVel = -4; }
  anchor.set(x, .8, wall || kind === 'Low trip' ? -29 : z);
  mode = kind; manual = false; frozen = false; armed = true; freezeAt = pause; timings.length = 0;
  freezeRecall = false; incidentAge = -1; maxProbes = peakParts = 0; effectTimes.length = 0;
}
const render = g.renderer.render.bind(g.renderer), target = new THREE.Vector3(), eye = new THREE.Vector3();
g.renderer.render = (...args: any[]) => {
  if (args[1] === g.camera && !manual) {
    target.copy(anchor); eye.copy(target).add(new THREE.Vector3(Math.sin(angle) * 10, 4.8, Math.cos(angle) * 10));
    g.camera.position.copy(eye); g.camera.fov = 45; g.camera.lookAt(target); g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld(true);
  }
  return render(...args);
};
const panel = document.createElement('div');
panel.dataset.testid = 'bone-review-controls';
panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:999999;background:#142434ed;color:white;padding:10px;font:12px monospace;max-width:680px';
const controls = document.createElement('div'), status = document.createElement('pre');
status.dataset.testid = 'bone-yard-status'; panel.append(controls, status); document.body.append(panel);
function add(label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = 'padding:7px;margin:2px'; controls.append(b); }
for (const name of ['Head hit', 'Low trip', 'Side bail', 'Balance bail', 'Slow bump', 'Held-mask wall', 'Masked bail', 'Masked blast', 'Contact death', 'Blast', 'Crusher', 'Pit fall']) add(name, () => start(name));
add('Resume', () => { frozen = false; armed = false; }); add('Freeze', () => frozen = true);
add('Step 6 frames', () => { for (let i = 0; i < 6; i++) { native(1 / 60, neutral, level); nativeUpdate(1 / 60); } p.commitRenderStep(level); });
add('Side', () => angle = Math.PI / 2); add('Quarter', () => angle = 1.12); add('Front', () => angle = Math.PI);
add('Play course', () => { p.respawn(level, true); manual = true; frozen = false; armed = false; });
function snapshot() {
  return { mode, frozen, state: p.state, bailing: p.isBailing, ragActive: p.ragActive, masks: p.masks, lives: p.lives,
    incidentAge, maxProbes, peakParts, active: false, ...p.breakApartDiagnostics,
    wipeout: p.wipeoutDiagnostics ?? null, death: p.deathPresentationDiagnostics,
    averageStepMs: timings.length ? +(timings.reduce((a, b) => a + b, 0) / timings.length).toFixed(3) : 0,
    effectAverageMs: effectTimes.length ? +(effectTimes.reduce((a, b) => a + b, 0) / effectTimes.length).toFixed(3) : 0 };
}
(window as any).__boneReview = { start, snapshot,
  resume: (recall = false) => { frozen = false; armed = false; freezeRecall = recall; }, freeze: () => frozen = true,
  until: (age: number) => { freezeAt = age; armed = true; frozen = false; freezeRecall = false; },
  angle: (value: number) => { angle = value; } };
function report() {
  panel.inert = false; status.textContent = JSON.stringify(snapshot(), null, 1); requestAnimationFrame(report);
} report();
