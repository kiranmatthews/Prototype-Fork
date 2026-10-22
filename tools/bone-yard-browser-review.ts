// Local-only controls. Hazards belong to this review session, never saved level data.
import * as THREE from 'three';
import { CharacterBreakApart } from '../src/character/breakApart';
import type { DiscardedBoard } from '../src/skateboard/discarded';
const g: any = await new Promise(resolve => {
  const poll = () => { const game = (window as any).__game; if (game) resolve(game); else requestAnimationFrame(poll); }; poll();
});
g.campaign.startEphemeral(); g.gameFlow.hide();
const p = g.player, level = g.getLevel();
level.crate(2, 0, -40, 'tnt', { noAuto: true });
const reviewTnt = level.crates.at(-1);
level.crusher(0, 0, -46, 3, 3, 3.2);
const reviewCrusher = level.crushers.at(-1);
level.wall(7, -46, 5, .8, 0, 1.1);
// Isolated missed-jump lane: a real platform lip, with a lower catch deck so
// the rebound and later tumbles stay visible instead of immediately dying.
level.stepBlock(25, -29, 18, 28, -5, -4);
level.stepBlock(25, -35, 12, 8, -4, 0);
level.stepBlock(55, -26, 24, 65, -1, 0);
level.wall(55, -48, 12, .6, 0, 2);
level.stepBlock(85, -27, 24, 36, -1, 0);
level.ramp('bail-roll-bank', -16, 6, -28, 0, 12, new THREE.MeshLambertMaterial({color:0xb5a16b}), 85);
level.groundMeshes.at(-1)!.userData.vert = true;
// A real disappearing support exercises the same-frame get-up interruption.
// Restore it for each run; this isolated lane never edits the authored level.
level.stepBlock(115, -27, 24, 36, -5, -4);
level.stepBlock(115, -27, 24, 36, -1, 0);
const recoveryDeck = level.groundMeshes.at(-1)!, recoveryDeckWall = level.walls.at(-1)!;
let removeRecoveryDeck = false, recoveryDeckRemovedAt = -1;
const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  spinHeld: false, spinPressed: false, grindHeld: false, grindPressed: false,
  grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false, inventoryHeld: true };
const REVIEW_SECONDS = 3.35;
let frozen = true, manual = false, mode = 'Ready', angle = 1.12, freezeAt = REVIEW_SECONDS;
let armed = false, freezeRecall = false, incidentAge = -1, maxProbes = 0, peakParts = 0;
let freezeAfterBounce = false, firstBounceAge = -1;
let bouncePauseDelay = .1;
let recoveryPause: number | null = null;
let risePause: number | null = null;
let restPause = false;
let nextImpactCount: number | null = null;
const wallTrace: any[] = [];
const impactTrace: any[] = [];
const verificationSpin = new THREE.Vector3();
let previousWallImpacts = 0;
const native = p.step.bind(p), nativeUpdate = level.update.bind(level);
const nativeContact = p.kickRagdollContact.bind(p);
p.kickRagdollContact = (...args: any[]) => {
  const before = p.ragdollWorldSpin(new THREE.Vector3()).toArray();
  nativeContact(...args);
  if (impactTrace.length < 16) impactTrace.push({ age:incidentAge, joint:p.ragContactJoint,
    into:args[2], beforeSpin:before, afterSpin:p.ragdollWorldSpin(new THREE.Vector3()).toArray() });
};
class RollingTiming {
  private values = new Float64Array(180);
  private cursor = 0;
  private sum = 0;
  count = 0;
  add(ms: number) {
    this.sum += ms - (this.count === this.values.length ? this.values[this.cursor] : 0);
    this.values[this.cursor] = ms; this.cursor = (this.cursor + 1) % this.values.length;
    this.count = Math.min(this.values.length, this.count + 1);
  }
  reset() { this.cursor = this.sum = this.count = 0; }
  get mean() { return this.count ? +(this.sum / this.count).toFixed(3) : 0; }
}
const timings = new RollingTiming(), effectTimes = new RollingTiming();
let effectMs = 0;
let verification: any = null;
let boardReview: { boards: DiscardedBoard[]; age: number; settledAt: number | null; sounds: { age: number; speed: number; broken: boolean }[] } | null = null;
const boardImpact = level.discardedBoards.onImpact;
level.discardedBoards.onImpact = (broken: boolean, speed: number) => {
  boardReview?.sounds.push({ age: boardReview.age, speed, broken });
  boardImpact?.(broken, speed);
};
for (const key of ['restore', 'request', 'step'] as const) {
  const original = CharacterBreakApart.prototype[key];
  (CharacterBreakApart.prototype as any)[key] = function (...args: any[]) {
    const started = performance.now();
    try { return (original as any).apply(this, args); } finally { effectMs += performance.now() - started; }
  };
}
level.update = (dt: number) => {
  if (frozen) return;
  nativeUpdate(dt);
  if (boardReview) {
    boardReview.age += dt;
    if (!level.discardedBoards.diagnostics.active && boardReview.settledAt === null) boardReview.settledAt = boardReview.age;
    if (boardReview.age >= 12) frozen = true;
  }
};
p.step = (dt: number, input: any, liveLevel: any) => {
  if (frozen) return;
  effectMs = 0;
  const t = performance.now(); native(dt, manual ? input : neutral, liveLevel); timings.add(performance.now() - t);
  if (removeRecoveryDeck && p.bailRecoverT >= .2) {
    level.groundMeshes.splice(level.groundMeshes.indexOf(recoveryDeck), 1);
    level.walls.splice(level.walls.indexOf(recoveryDeckWall), 1);
    recoveryDeck.visible = false; removeRecoveryDeck = false; recoveryDeckRemovedAt = incidentAge;
  }
  effectTimes.add(effectMs);
  const d = p.breakApartDiagnostics;
  maxProbes = Math.max(maxProbes, d?.probesThisStep ?? 0); peakParts = Math.max(peakParts, d?.active ? d.parts : 0);
  if (incidentAge < 0 && (p.isBailing || p.state === 'dead' || p.softSkateImpactT > 0 ||
    mode === 'Masked blast' && p.masks === 0)) incidentAge = 0;
  if (incidentAge >= 0) incidentAge += dt;
  if (p.ragdollWallImpactCount > previousWallImpacts && wallTrace.length < 12) {
    wallTrace.push({age:incidentAge, at:p.pos.toArray(), velocity:[p.axisF.x*p.speed,p.vVel,p.axisF.z*p.speed]});
  }
  previousWallImpacts = p.ragdollWallImpactCount;
  if (firstBounceAge < 0 && p.ragdollImpactCount > 0) firstBounceAge = incidentAge;
  if (freezeAfterBounce && firstBounceAge >= 0 && incidentAge >= firstBounceAge + bouncePauseDelay) {
    frozen = true; armed = false; freezeAfterBounce = false;
  }
  if (recoveryPause !== null && p.bailRecoverT >= recoveryPause) {
    frozen = true; armed = false; recoveryPause = null;
  }
  if (restPause && p.bailKnockdown.restTime >= .12) { frozen = true; armed = false; restPause = false; }
  if (risePause !== null && !p.isBailing && p.bailRiseAge >= risePause) {
    frozen = true; armed = false; risePause = null;
  }
  if (nextImpactCount !== null && (p.ragdollImpactCount + p.ragdollWallImpactCount >= nextImpactCount ||
    incidentAge >= 0 && !p.isBailing)) {
    frozen = true; armed = false; nextImpactCount = null;
  }
  if (p.state === 'dead') p.respawnTimer = 30;
  if (armed && incidentAge >= freezeAt) { frozen = true; armed = false; }
  if (freezeRecall && d?.returnProgress >= .45) { frozen = true; freezeRecall = false; }
};
function start(kind: string, pause = REVIEW_SECONDS, head: 'skull' | 'alternate' = 'skull') {
  boardReview = null;
  if (!level.groundMeshes.includes(recoveryDeck)) level.groundMeshes.push(recoveryDeck);
  if (!level.walls.includes(recoveryDeckWall)) level.walls.push(recoveryDeckWall);
  recoveryDeck.visible = true; recoveryDeckRemovedAt = -1; removeRecoveryDeck = kind === 'Vanishing floor';
  const wall = kind === 'Heavy wall' || kind === 'Head hit' || kind === 'Slow bump' || kind === 'Held-mask wall';
  const trip = kind === 'Low trip' || kind === 'Mid trip';
  const edge = kind === 'Pit edge' || kind === 'Angled edge' || kind === 'Bailing into edge';
  const bank = kind === 'Bank tumble';
  const manualKind = kind === 'Manual back' ? 1 : kind === 'Nose manual forward' ? -1 : 0;
  const balanceCase = kind === 'Balance bail' || kind === 'Balance left' || manualKind !== 0;
  const x = kind === 'High fall' ? 55 : kind === 'Vanishing floor' ? 115 : bank ? 85 : edge ? 25 : wall ? -7 : trip ? 7 : kind === 'Pit fall' ? 3 : 0;
  const z = edge ? -27 : /blast|Blast/.test(kind) ? -40 : kind === 'Mid trip' ? -38 : kind === 'Crusher' ? -46 : kind === 'Pit fall' ? -78 : -20;
  p.respawn(level, true, true, { position: new THREE.Vector3(x, bank ? 4.04 : .04, z), heading: new THREE.Vector3(0, 0, -1) });
  level.discardedBoards.clear(); // each review shows only this incident's deck
  p.masks = kind.startsWith('Masked') || kind === 'Held-mask wall' ? 1 : 0;
  p.lives = 4;
  p.invulnTimer = 0; p.uberTimer = 0;
  p.onDeath = () => {};
  reviewCrusher.phase = -level.time; nativeUpdate(0);
  native(1 / 60, neutral, level);
  p.setCharacterHeadStyle(head);
  p.freeSkate = wall || trip || balanceCase;
  p.speed = kind === 'Heavy wall' ? 40 : kind === 'Slow bump' ? 8 : wall || trip ? 24 : balanceCase ? 10 : 0;
  if (kind === 'Contact death') p.die('contact');
  if (kind === 'Side bail' || kind === 'Vanishing floor') p.beginPvpKnockdown(5, 1);
  if (manualKind) {
    p.enterManual(manualKind);
    for (let i = 0; i < 12; i++) { p.balance = manualKind * .8; native(1 / 60, neutral, level); }
    p.balance = manualKind; p.balanceVel = manualKind * 5; p.balanceCritT = 10;
    native(1 / 60, neutral, level); // real meter failure path, before it clears the needle
  } else if (balanceCase) { p.balance = kind === 'Balance left' ? -1 : 1; p.bail(false, 10, 'balance'); }
  if (bank) { p.speed = 12; p.bail(false, 12, 'balance', 12); }
  if (kind === 'Masked bail') p.bail(true, 24, 'landing', 30);
  if (kind === 'Blast' || kind === 'Masked blast') level.detonate(reviewTnt);
  if (kind === 'Crusher') { reviewCrusher.phase = .38 * reviewCrusher.cycle - level.time; nativeUpdate(0); }
  if (kind === 'High fall') {
    p.pos.y = 32; p.prevPos.copy(p.pos); p.airPeakY = 32; p.vVel = -8; p.speed = 6;
    p.state = 'air'; p.grounded = false; p.freeSkate = true; p.airFromSkate = true; p.airMomentum = true; p.airGrav = 'board';
  }
  if (kind === 'Pit fall') { p.grounded = false; p.state = 'air'; p.vVel = -4; }
  if (edge) {
    p.pos.y = -1.15; p.prevPos.copy(p.pos); p.speed = 24;
    p.state = 'air'; p.grounded = false; p.vVel = -4;
    p.freeSkate = true; p.airFromSkate = true; p.airMomentum = true; p.airGrav = 'board';
    if (kind === 'Angled edge') { p.axisF.set(.5, 0, -Math.sqrt(.75)); p.axisL.set(p.axisF.z, 0, -p.axisF.x); }
    if (kind === 'Bailing into edge') { p.bail(false, 24, 'landing', 20); p.speed = 24; }
  }
  mode = kind; manual = false; frozen = false; armed = true; freezeAt = pause === REVIEW_SECONDS && (kind === 'Heavy wall' || kind === 'High fall') ? 5.5 : pause; timings.reset();
  freezeRecall = false; incidentAge = -1; maxProbes = peakParts = 0; effectTimes.reset();
  freezeAfterBounce = false; firstBounceAge = -1; bouncePauseDelay = .1;
  recoveryPause = null; risePause = null; restPause = false; nextImpactCount = null; impactTrace.length = 0;
  wallTrace.length = previousWallImpacts = 0;
}
const render = g.renderer.render.bind(g.renderer), target = new THREE.Vector3(), eye = new THREE.Vector3();
g.renderer.render = (...args: any[]) => {
  if (args[1] === g.camera && !manual) {
    target.copy(boardReview ? boardReview.boards[0].root.position : p.renderPosition);
    if (boardReview && boardReview.boards.length > 1) {
      target.set(0, 0, 0); let visible = 0;
      for (const board of boardReview.boards) if (board.root.visible) { target.add(board.root.position); visible++; }
      if (visible) target.multiplyScalar(1 / visible);
      else target.copy(boardReview.boards[0].root.position);
    }
    target.y += .8;
    const distance = boardReview ? boardReview.boards.length > 1 ? 11 : 7 : /manual/i.test(mode) ? 12 : 10;
    eye.set(Math.sin(angle) * distance, boardReview ? 3.6 : 4.8, Math.cos(angle) * distance).add(target);
    g.camera.position.copy(eye); g.camera.fov = 45; g.camera.lookAt(target); g.camera.updateProjectionMatrix(); g.camera.updateMatrixWorld(true);
  }
  return render(...args);
};
const panel = document.createElement('div');
panel.dataset.testid = 'bone-review-controls';
panel.style.cssText = 'position:fixed;bottom:8px;left:8px;z-index:999999;background:#142434ed;color:white;padding:10px;font:12px monospace;max-width:680px';
const controls = document.createElement('div'), status = document.createElement('pre');
const testControls = document.createElement('details'), controlsSummary = document.createElement('summary');
controlsSummary.textContent = 'Test controls'; testControls.open = true;
testControls.append(controlsSummary, controls);
status.dataset.testid = 'bone-yard-status';
status.style.cssText = 'max-height:40vh;overflow:auto;white-space:pre-wrap';
const diagnostics = document.createElement('details'), summary = document.createElement('summary');
summary.textContent = 'Motion diagnostics'; diagnostics.append(summary, status);
panel.append(testControls, diagnostics); document.body.append(panel);
function add(label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; b.style.cssText = 'padding:7px;margin:2px'; controls.append(b); }
for (const name of ['Head hit', 'Heavy wall', 'High fall', 'Low trip', 'Mid trip', 'Side bail', 'Balance bail', 'Balance left', 'Manual back', 'Nose manual forward', 'Bank tumble', 'Pit edge', 'Angled edge', 'Bailing into edge', 'Vanishing floor', 'Slow bump', 'Held-mask wall', 'Masked bail', 'Masked blast', 'Contact death', 'Blast', 'Crusher', 'Pit fall']) add(name, () => start(name));
add('Verify bails', verifyBails);
for (const name of ['Board toss', 'Board roll', 'Board skid', 'Board wall', 'Board pile']) add(name, () => startBoard(name));
add('Verify boards', verifyBoards);
add('Fall', () => start(mode === 'Ready' ? 'Manual back' : mode, .22));
add('Rise rebound', () => { start(mode === 'Ready' ? 'Manual back' : mode); risePause = .3; });
add('Trip catch', () => start(mode === 'Mid trip' ? 'Mid trip' : 'Low trip', .1));
add('First bounce', () => { start(mode === 'Ready' ? 'Mid trip' : mode); freezeAfterBounce = true; });
add('Floor contact', () => { start(mode === 'Ready' ? 'Mid trip' : mode); freezeAfterBounce = true; bouncePauseDelay = 0; });
add('Next impact', () => {
  if (boardReview || mode === 'Ready') start('Mid trip');
  else if (!p.isBailing) start(mode);
  nextImpactCount = p.ragdollImpactCount + p.ragdollWallImpactCount + 1;
  freezeAfterBounce = false; recoveryPause = risePause = null; restPause = false; frozen = false; armed = true;
  freezeAt = Math.max(REVIEW_SECONDS, incidentAge + REVIEW_SECONDS);
});
add('Knocked flat', () => { start(mode === 'High fall' ? 'High fall' : 'Heavy wall'); restPause = true; });
add('Get-up', () => { start(mode === 'Ready' ? 'Side bail' : mode); recoveryPause = .1; });
add('Resume', () => { frozen = false; armed = false; freezeAfterBounce = false; recoveryPause = risePause = null; restPause = false; nextImpactCount = null; }); add('Freeze', () => frozen = true);
add('Step 6 frames', () => {
  armed = false; freezeAfterBounce = false; recoveryPause = risePause = null; restPause = false; nextImpactCount = null; frozen = false;
  for (let i = 0; i < 6; i++) { p.step(1 / 60, neutral, level); level.update(1 / 60); }
  frozen = true; p.commitRenderStep(level);
});
add('Side', () => angle = Math.PI / 2); add('Quarter', () => angle = 1.12); add('Front', () => angle = Math.PI);
add('Play course', () => { boardReview = null; p.respawn(level, true); manual = true; frozen = false; armed = false; freezeAfterBounce = false; recoveryPause = risePause = null; restPause = false; nextImpactCount = null; });

function startBoard(kind: string) {
  start(kind, 1000); armed = false;
  boardReview = { boards: [], age: 0, settledAt: null, sounds: [] };
  for (let i = 0; i < (kind === 'Board pile' ? 12 : 1); i++) {
    const board: DiscardedBoard = level.discardedBoards.spawn(p.boardG);
    level.discardedBoards.release(board);
    board.root.position.set(55 + (i % 3 - 1)*.5, kind === 'Board roll' || kind === 'Board skid' ? .01 : 1, kind === 'Board wall' ? -42 : -12);
    board.root.quaternion.identity(); board.breakStyle = kind === 'Board pile' && i < 3 ? i === 0 ? 'fold' : 'snap' : 'none';
    if (kind === 'Board roll') board.velocity.set(0, 0, -12);
    else if (kind === 'Board skid') board.velocity.set(8, 0, 0);
    else {
      board.velocity.set(kind === 'Board wall' ? 0 : (i % 3 - 1)*2, kind === 'Board wall' ? 0 : 5, kind === 'Board wall' ? -24 : -16 + i*.5);
      board.angular.set(5 + i*.8, 11 - i*.4, 3 - i*.3);
    }
    boardReview.boards.push(board);
  }
}
async function verifyBoards() {
  if (verifying) return;
  verifying = true;
  const rows: any[] = [], failures: string[] = [];
  for (const kind of ['Board toss', 'Board roll', 'Board skid', 'Board wall', 'Board pile']) {
    startBoard(kind);
    for (let i = 0; i < 720; i++) { p.step(1 / 60, neutral, level); level.update(1 / 60); }
    const d = level.discardedBoards.diagnostics;
    const state = boardReview!;
    const row = { kind, ...d, seconds: state.age, settledAt: state.settledAt, sounds: state.sounds,
      position: state.boards[0].root.position.toArray() };
    if (d.active || d.lost || state.settledAt === null) failures.push(`${kind}: boards failed to settle`);
    if (state.sounds.some(event => event.age > (state.settledAt ?? 0))) failures.push(`${kind}: sound after rest`);
    if ((kind === 'Board roll' || kind === 'Board skid') && state.sounds.length) failures.push(`${kind}: quiet contact made sound`);
    rows.push(row); frozen = true;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  verification = { passed: failures.length === 0, rows, failures };
  frozen = true; diagnostics.open = true; verifying = false;
}

let verifying = false;
async function verifyBails() {
  if (verifying) return;
  verifying = true;
  const rows: any[] = [];
  const failures: string[] = [];
  for (const kind of ['Head hit', 'Heavy wall', 'High fall', 'Low trip', 'Mid trip', 'Side bail', 'Balance bail', 'Balance left', 'Manual back', 'Nose manual forward', 'Bank tumble', 'Pit edge', 'Angled edge', 'Bailing into edge', 'Vanishing floor', 'Held-mask wall', 'Masked bail', 'Blast', 'Crusher', 'Pit fall']) {
    start(kind, 1000);
    const fatal = ['Blast', 'Crusher', 'Pit fall'].includes(kind);
    const balanceCase = ['Balance bail', 'Balance left', 'Manual back', 'Nose manual forward'].includes(kind);
    const fallDirection = new THREE.Vector3(kind === 'Balance bail' ? 1 : kind === 'Balance left' ? -1 : 0, 0,
      kind === 'Manual back' ? 1 : kind === 'Nose manual forward' ? -1 : 0);
    const manualCase = kind === 'Manual back' || kind === 'Nose manual forward';
    const boardSeparation = manualCase && p.looseBoard ? p.looseBoard.velocity.dot(fallDirection) : null;
    let fallBeforeRecovery = false, recoveryAge: number | null = null, peakFallDirection = 0, freeRiseFrames = 0;
    let maxRestTime = 0, maxWaistBend = 0, faceUpRestFrames = 0;
    let entered = false, recovered = false, maxSkinScans = 0, maxStep = 0, minimumBodyLead = Infinity;
    let bankContactFrames = 0, bankRollAngle = 0;
    let supportFrames = 0, minimumClearance = Infinity, maximumClearance = -Infinity, lastFloorImpacts = 0;
    let recoveryFrames = 0, maxRecoveryTurn = 0, remainingRoll: number | null = null;
    let headHandoff: { shift: number; velocityChange: number } | null = null;
    const previousHead = p.headM.localToWorld(new THREE.Vector3(0, .3, 0)).sub(p.pos);
    const head = new THREE.Vector3(), headDelta = new THREE.Vector3(), lastHeadDelta = new THREE.Vector3();
    p.riderG.getWorldQuaternion(recoveryPrevious).normalize();
    const measure = p.interactionMeasure, skin = measure.skinnedBounds.bind(measure);
    measure.skinnedBounds = (mesh: any) => { if (p.isBailing && p.state !== 'dead') maxSkinScans++; return skin(mesh); };
    try {
      for (let i = 0; i < 480; i++) {
        const wasBailing = p.isBailing;
        const t = performance.now(); p.step(1 / 60, neutral, level); maxStep = Math.max(maxStep, performance.now() - t);
        nativeUpdate(1 / 60);
        p.headM.localToWorld(head.set(0, .3, 0)).sub(p.pos);
        headDelta.copy(head).sub(previousHead);
        if (!fatal && wasBailing && !p.isBailing) {
          headHandoff = { shift: headDelta.length(), velocityChange: headDelta.distanceTo(lastHeadDelta) };
          if (headHandoff.shift > .12 || headHandoff.velocityChange > .08)
            failures.push(`${kind}: head snapped at control handoff (${headHandoff.shift.toFixed(3)}m / ${headHandoff.velocityChange.toFixed(3)}m delta)`);
        }
        previousHead.copy(head); lastHeadDelta.copy(headDelta);
        entered ||= p.isBailing || p.state === 'dead';
        if (!fatal && p.isBailing && (p.grounded || p.ragdollImpactCount > lastFloorImpacts)) {
          const clearance = supportClearance();
          if (clearance !== null) {
            supportFrames++; minimumClearance = Math.min(minimumClearance, clearance); maximumClearance = Math.max(maximumClearance, clearance);
            if (clearance < -.012 || clearance > .026) failures.push(`${kind}: floor contact gap ${clearance.toFixed(3)}m`);
          }
        }
        lastFloorImpacts = p.ragdollImpactCount;
        p.riderG.getWorldQuaternion(recoveryCurrent).normalize();
        if (!fatal && p.isBailing && p.bailRecoverT >= 0) {
          recoveryFrames++; maxRecoveryTurn = Math.max(maxRecoveryTurn, recoveryPrevious.angleTo(recoveryCurrent));
          remainingRoll ??= p.bailRecoveryMotion.destination - p.bailRecoveryMotion.pitch;
        }
        if (balanceCase && p.isBailing && p.bailRecoverT < 0)
          peakFallDirection = Math.max(peakFallDirection, verificationSpin.set(0, 1, 0).applyQuaternion(recoveryCurrent).dot(fallDirection));
        if (p.bailRecoverT >= 0 && recoveryAge === null) { recoveryAge = p.bailFallAge; fallBeforeRecovery = p.bailHasFallen; }
        if (!p.isBailing && p.bailRiseAge >= 0) freeRiseFrames++;
        recoveryPrevious.copy(recoveryCurrent);
        if (kind === 'Bank tumble' && p.isBailing && p.grounded && p.onTransition && p.groundHit?.normal.y < .97) {
          bankContactFrames++; p.ragdollWorldSpin(verificationSpin);
          bankRollAngle += verificationSpin.length() / 60;
        }
        if ((kind === 'Low trip' || kind === 'Mid trip') && incidentAge >= .1 &&
            p.isBailing && !p.grounded && p.ragdollImpactCount === 0) {
          const lead = bodyLead(); minimumBodyLead = Math.min(minimumBodyLead, lead);
          if (lead <= .1) failures.push(`${kind}: feet led the fall at ${incidentAge.toFixed(3)}s`);
        }
        maxRestTime = Math.max(maxRestTime, p.bailKnockdown.restTime);
        if (p.bailRecoverT >= 0) maxWaistBend = Math.max(maxWaistBend, Math.abs(p.spineG.rotation.x));
        if (p.bailKnockdown.restTime > 0 && verificationSpin.set(0,0,1).applyQuaternion(p.ragQ).y > .9) faceUpRestFrames++;
        const d = p.breakApartDiagnostics;
        if (!fatal && d?.active) failures.push(`${kind}: detached body`);
        if (!p.animationRig.joints.every((j: any) =>
          [...j.node.position.toArray(), ...j.node.quaternion.toArray(), ...j.node.scale.toArray()].every(Number.isFinite))) {
          failures.push(`${kind}: invalid joint`); break;
        }
        if (entered && !fatal && !p.isBailing) recovered = true;
        if (incidentAge >= (kind === 'Heavy wall' || kind === 'High fall' ? 5.5 : REVIEW_SECONDS) && (recovered || fatal)) break;
      }
      if (!entered || !fatal && !recovered) failures.push(`${kind}: did not finish expected path`);
      if (balanceCase && (!fallBeforeRecovery || (recoveryAge ?? 0) < .45 || peakFallDirection < .35))
        failures.push(`${kind}: did not fully fall toward lost balance before getting up`);
      if (manualCase && (boardSeparation === null || boardSeparation > -8))
        failures.push(`${kind}: board did not slip opposite the body fall`);
      if (!fatal && freeRiseFrames < 15) failures.push(`${kind}: rise follow-through ended at control handoff`);
      if (kind === 'Bank tumble' && (bankContactFrames < 3 || bankRollAngle < .1))
        failures.push(`${kind}: did not exercise the supported bank roll`);
      if ((kind === 'Low trip' && p.pos.z >= -29.8) || (kind === 'Mid trip' && p.pos.z >= -46.9))
        failures.push(`${kind}: stayed behind obstacle`);
      if (kind.includes('edge') && (!wallTrace.length || wallTrace[0].velocity[2] <= 0 || p.ragdollWallImpactCount > 2))
        failures.push(`${kind}: missing or repeated wall rebound`);
      if ((kind === 'Heavy wall' || kind === 'High fall') && maxRestTime < .24) failures.push(`${kind}: missed laid-out rest`);
      if (!fatal && maxWaistBend < .55) failures.push(`${kind}: rigid waist during recovery`);
      if (maxSkinScans) failures.push(`${kind}: ${maxSkinScans} full skin scans`);
      if (fatal && (p.state !== 'dead' || p.lives !== 3)) failures.push(`${kind}: death/life count`);
      if ((kind === 'Blast' || kind === 'Crusher') && p.breakApartDiagnostics?.parts !== 9) failures.push(`${kind}: fatal parts lost`);
      rows.push({ kind, entered, recovered, maxRestTime, maxWaistBend, faceUpRestFrames, maxSkinScans, minimumBodyLead: Number.isFinite(minimumBodyLead) ? minimumBodyLead : null, parts: p.breakApartDiagnostics?.active ? p.breakApartDiagnostics.parts : 0,
        lives: p.lives, wallImpacts: p.ragdollWallImpactCount, bankContactFrames, bankRollAngle,
        supportFrames, minimumClearance: supportFrames ? minimumClearance : null, maximumClearance: supportFrames ? maximumClearance : null,
        recoveryFrames, maxRecoveryTurn, remainingRoll, fallBeforeRecovery, recoveryAge, peakFallDirection, boardSeparation, freeRiseFrames, headHandoff, impactTrace:[...impactTrace],
        position: p.pos.toArray(), seconds: +incidentAge.toFixed(3), meanStepMs: timings.mean, maxStep });
    } finally { measure.skinnedBounds = skin; }
    frozen = true;
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  frozen = true; armed = false; p.commitRenderStep(level);
  verification = { passed: failures.length === 0, rows, failures };
  diagnostics.open = true;
  verifying = false;
}
const reviewHead = new THREE.Vector3(), reviewFeet = new THREE.Vector3(), reviewFoot = new THREE.Vector3();
const reviewSupport = new THREE.Vector3();
const recoveryPrevious = new THREE.Quaternion(), recoveryCurrent = new THREE.Quaternion();
function supportClearance(): number | null {
  const hit = p.groundHit;
  if (!p.isBailing || p.state === 'dead' || !hit || hit.normal.y < .3) return null;
  p.group.updateMatrixWorld(true);
  const distance = p.interactionMeasure.sampledPlaneDistance(p.riderG, hit.normal,
    reviewSupport.set(p.pos.x, hit.y, p.pos.z));
  return Number.isFinite(distance) ? distance : null;
}
function bodyLead() {
  p.headM.getWorldPosition(reviewHead); p.ankleL.getWorldPosition(reviewFeet); p.ankleR.getWorldPosition(reviewFoot);
  return reviewHead.sub(reviewFeet.add(reviewFoot).multiplyScalar(.5)).dot(p.axisF) * Math.sign(p.speed || 1);
}
function snapshot() {
  return { mode, frozen, presentation: { blocked: g.gameFlow.blocksGameplay,
    loading: g.getLoadingDiagnostics(), renderedFrames: g.frameStats.frame },
    state: p.state, bailing: p.isBailing, ragActive: p.ragActive, masks: p.masks, lives: p.lives,
    position: p.pos.toArray(), speed: p.speed, bodyLead: bodyLead(), grounded: p.grounded, supportClearance: supportClearance(),
    knockdown: { strength:p.bailKnockdown.strength, supportTime:p.bailKnockdown.supportTime, restTime:p.bailKnockdown.restTime },
    waistBend: p.spineG?.rotation.toArray(),
    recoveryTime: p.bailRecoverT, recoveryProgress: p.bailRecoveryPose,
    recoveryRoll: p.bailRecoveryMotionReady ? { axis:[p.bailRecoveryMotion.axisX, 0, p.bailRecoveryMotion.axisZ],
      remaining:p.bailRecoveryMotion.destination - p.bailRecoveryMotion.pitch,
      spin:p.bailRecoverySpin.toArray(), momentum:p.bailRecoveryMomentum.toArray() } : null,
    fallAge: p.bailFallAge, fullyFallen: p.bailHasFallen, riseAge: p.bailRiseAge,
    recoveryInterruption: { supportRemovedAt: recoveryDeckRemovedAt, carryingPose: p.bailPoseCarry.active },
    looseBoardVelocity: p.looseBoard?.velocity.toArray() ?? null,
    incidentAge, firstBounceAge, floorImpacts: p.ragdollImpactCount, wallImpacts: p.ragdollWallImpactCount, wallTrace, impactTrace, maxProbes, peakParts, active: false, ...p.breakApartDiagnostics,
    boards: { ...level.discardedBoards.diagnostics,
      age: boardReview?.age, settledAt: boardReview?.settledAt, sounds: boardReview?.sounds,
      bodies: boardReview?.boards.map(board => ({ resting: board.rest, speed: board.velocity.length(), spin: board.angular.length(), position: board.root.position.toArray() })) },
    wipeout: p.wipeoutDiagnostics ?? null, death: p.deathPresentationDiagnostics, verification,
    averageStepMs: timings.mean, effectAverageMs: effectTimes.mean };
}
(window as any).__boneReview = { start, snapshot,
  resume: (recall = false) => { frozen = false; armed = false; freezeRecall = recall; }, freeze: () => frozen = true,
  until: (age: number) => { freezeAt = age; armed = true; frozen = false; freezeRecall = false; },
  angle: (value: number) => { angle = value; } };
let lastReport = 0;
function report(now: number) {
  panel.inert = false;
  if (diagnostics.open && now - lastReport > 150) {
    status.textContent = JSON.stringify(snapshot(), null, 1); lastReport = now;
  }
  requestAnimationFrame(report);
} requestAnimationFrame(report);
