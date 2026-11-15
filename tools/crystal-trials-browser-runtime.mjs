import { CRYSTAL_TRIALS, trialOrigin } from '../src/levels/crystal-trials';

/** Run the same pilot through the application's ordinary fixed-step loop. */
export async function installCrystalTrialPilot(id) {
  const { runCrystalTrial } = id > 10 ? await import(`./crystal-trials-pilots/${id}.mjs`) : await import('./crystal-trials-pilot.mjs');
  const g = window.__game, p = g.player, l = g.getLevel();
  const index = CRYSTAL_TRIALS.findIndex(t => t.id === id);
  if (index < 0) throw Error('Unknown trial');
  const report = window.crystalTrialReport = { id, frame: 0, done: false, failure: null, actions: [], evidence: [] };
  const r = { p, l, report, source: g.getCurrentLevel().data, offset: g.trialOffset ?? trialOrigin(index),
    get frame() { return report.frame; } };
  const pilot = runCrystalTrial(r, id);
  let next = pilot.next(), last = {}, advanced = false;
  const original = { step: p.step, commit: p.commitRenderStep };
  const restore = () => { p.step = original.step; p.commitRenderStep = original.commit; };
  p.step = function(dt, input, level) {
    if (report.done) return original.step.call(this, dt, input, level);
    if (level !== l) {
      report.done = true; report.failure = 'The pilot left its source-owned course'; restore();
      return original.step.call(this, dt, input, level);
    }
    const s = next.value ?? {}, f = p.courseInputDirection(l) ?? p.camDir;
    const n = Math.hypot(f.x, f.z) || 1, dx = s.moveX ?? 0, dz = -(s.moveY ?? 0);
    input.moveX = s.skateRelative ? dx : (dx * -f.z + dz * f.x) / n;
    input.moveY = s.skateRelative ? -dz : (dx * f.x + dz * f.z) / n;
    const length = Math.hypot(input.moveX, input.moveY);
    if (length > 1) { input.moveX /= length; input.moveY /= length; }
    input.moveX = Math.round(input.moveX * 100) / 100; input.moveY = Math.round(input.moveY * 100) / 100;
    for (const h of ['jumpHeld', 'spinHeld', 'grabHeld', 'grindHeld', 'transferHeld']) {
      input[h] = s[h] ?? false; const e = h.replace('Held', 'Pressed');
      input[e] = s[e] ?? (input[h] && !last[h]);
    }
    input.jumpReleased = s.jumpReleased ?? (!input.jumpHeld && !!last.jumpHeld);
    input.restartPressed = false; last = { ...s };
    original.step.call(this, dt, input, level); advanced = true;
  };
  p.commitRenderStep = function(...args) {
    original.commit.apply(this, args);
    if (!advanced || report.done) return;
    advanced = false; report.frame++;
    try { next = pilot.next(); if (next.done) { report.result = next.value; report.done = true; } }
    catch (error) { report.failure = String(error); report.done = true; }
    report.position = p.pos.toArray(); report.state = p.state; report.deaths = p.totalDeaths;
    if (report.done) restore();
  };
  return report;
}
