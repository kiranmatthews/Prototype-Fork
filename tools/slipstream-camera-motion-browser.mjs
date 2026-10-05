// Read-only camera instrumentation around real keyboard play on Slipstream 1.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(value => /^https?:/.test(value)) || 'http://127.0.0.1:5193').replace(/\/$/, '');
const lite = process.argv.includes('--lite');
const journey = process.argv.includes('--journey') || process.argv.includes('--journey-only');
const recovery = process.argv.includes('--recovery') || process.argv.includes('--recovery-only');
const opening = !process.argv.includes('--journey-only') && !process.argv.includes('--recovery-only');
const output = process.env.SLIPSTREAM_CAMERA_MOTION_OUTPUT || '/private/tmp/slipstream-camera-motion';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const page = await context.newPage(); page.setDefaultNavigationTimeout(120000);
const errors = [], reports = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const ready = () => page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'slip' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
const install = async label => {
  const g = window.__game, p = g.player, l = g.getLevel(), V = p.pos.constructor;
  const forward = new V(), centre = new V(), ahead = new V(), projected = new V();
  const cursor = { s: -1 }, inputCursor = { s: -1 };
  const yaw = vector => Math.atan2(vector.x, -vector.z) * 180 / Math.PI;
  let snap = -1;
  const trace = window.slipstreamCameraMotion = { label, frames: [], tracing: true, started: performance.now(), metadata: { level: g.getCurrentLevel().id, name: g.getCurrentLevel().name, stamp: document.querySelector('.hud-build')?.textContent, lookAhead: l.cameraLookAhead, airLift: l.cameraAirLift, cameraViews: l.cameraViews.length, tuning: JSON.stringify(g.TUNING), viewport: [innerWidth, innerHeight] } };
  const render = g.renderer.render.bind(g.renderer);
  g.renderer.render = (scene, camera) => {
    const result = render(scene, camera);
    if (!trace.tracing || scene !== g.scene || camera !== g.camera || g.gameFlow.blocksGameplay) return result;
    if (snap !== p.renderSnapVersion) { cursor.s = -1; snap = p.renderSnapVersion; }
    const subject = p.renderPosition;
    const local = l.cameraDirAt(subject.x, subject.y, subject.z, cursor);
    inputCursor.s = p.laneCursor.s;
    // The copied cursor observes the actual local control basis without
    // advancing the Player's or production camera's cursor.
    const inputBasis = l.laneDirAt(p.pos.x, p.pos.y, p.pos.z, inputCursor);
    const c = l.cameraLanePointAhead(cursor, 0, centre), a = l.cameraLanePointAhead(cursor, l.cameraLookAhead || 15, ahead);
    camera.getWorldDirection(forward); projected.copy(subject).add(new V(0, 1.2, 0)).project(camera);
    const chord = a ? { x: a.x - subject.x, z: a.z - subject.z } : null;
    const roadChord = a && c ? { x: a.x - c.x, z: a.z - c.z } : null;
    const lateral = c && local ? (subject.x - c.x) * -local.z + (subject.z - c.z) * local.x : null;
    trace.frames.push({ frame: trace.frames.length, milliseconds: performance.now() - trace.started, snap, position: p.pos.toArray(), subject: subject.toArray(), eye: camera.position.toArray(), forward: forward.toArray(), quaternion: camera.quaternion.toArray(), up: camera.up.toArray(), cameraYaw: yaw(forward), cameraPitch: Math.asin(-forward.y) * 180 / Math.PI, fov: camera.fov, localYaw: local && yaw(local), futureYaw: chord && yaw(chord), roadFutureYaw: roadChord && yaw(roadChord), canonicalYaw: yaw(p.camDir), inputBasisYaw: inputBasis && yaw(inputBasis), boardYaw: yaw(p.axisF), cursor: cursor.s, inputCursor: p.laneCursor.s, centre: c?.toArray() || null, ahead: a?.toArray() || null, lateral, heroNdc: projected.toArray(), input: { x: g.input.moveX, y: g.input.moveY, jump: g.input.jumpHeld, lookX: g.input.lookX, lookY: g.input.lookY }, speed: p.speed, cameraSkateSpeed: p.cameraSkateSpeed, state: p.state, grounded: p.grounded, board: p.boardRolling, authoredSkateCamera: p.authoredSkateCamera, bailing: p.isBailing, deaths: p.totalDeaths });
    return result;
  };
};
const difference = (a, b) => ((a - b + 540) % 360) - 180;
const installJourney = async recover => {
  const g = window.__game, p = g.player, l = g.getLevel(), V = p.pos.constructor;
  const cursor = { s: -1 }, target = new V();
  const report = window.slipstreamJourney = { recover, frame: 0, done: false, failed: null, phase: 'course', checkpoints: [], deaths: [], jump: null, landing: null, recovery: null, tuning: JSON.stringify(g.TUNING), end: null };
  const snap = () => ({ frame: report.frame, phase: report.phase, position: p.pos.toArray(), speed: p.speed, state: p.state, grounded: p.grounded, board: p.boardRolling, bailing: p.isBailing, cursor: p.laneCursor.s, ground: p.groundHit ? { height: p.groundHit.y, gravityTrack: !!p.groundHit.gravityTrack } : null });
  const direction = (q, pace = 1) => { const dx = q.x - p.pos.x, dz = q.z - p.pos.z, n = Math.hypot(dx, dz) || 1; const f = l.laneDirAt(p.pos.x, p.pos.y, p.pos.z, { s: p.laneCursor.s }) || p.camDir; return { moveX: (dx * -f.z + dz * f.x) / n * pace, moveY: (dx * f.x + dz * f.z) / n * pace }; };
  let sample = {}, count = 0, released = false, aired = false, advanced = false;
  const realStep = p.step.bind(p), realCommit = p.commitRenderStep.bind(p), realUpdate = g.input.update.bind(g.input), realDeath = p.onDeath;
  g.input.pollGamepad = () => { const x = sample.moveX || 0, y = sample.moveY || 0, n = Math.hypot(x, y), raw = n ? .22 + .78 * Math.min(1, n) : 0; return { id: 'Slipstream camera journey controller', mapping: 'standard', index: 0, connected: true, axes: n ? [x / n * raw, -y / n * raw, 0, 0] : [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: i === 0 && !!sample.jumpHeld, value: i === 0 && sample.jumpHeld ? 1 : 0 })) }; };
  p.onDeath = function (...args) { report.deaths.push({ ...snap(), checkpoint: l.currentSpawn.toArray(), killY: l.killY }); if (recover) report.phase = 'respawn'; return realDeath.apply(this, args); };
  p.step = (dt, input, level) => {
    if (report.done) return;
    try {
      cursor.s = p.laneCursor.s; l.laneDirAt(p.pos.x, p.pos.y, p.pos.z, cursor); l.cameraLanePointAhead(cursor, 8, target);
      if (report.phase === 'course') {
        sample = { ...direction(target), jumpHeld: true };
        if (recover && l.checkpoints[1].active) { report.phase = 'brake'; report.banked = { index: 1, position: l.currentSpawn.toArray() }; sample = { moveY: -1 }; }
        else if (!recover && p.pos.z <= -735 && p.grounded && p.pos.y < 15) { report.phase = 'final flight'; released = true; sample = {}; report.jump = snap(); }
      } else if (report.phase === 'final flight') sample = {};
      else if (report.phase === 'finish') {
        if (p.pos.z < -827) target.set(0, .2, -852);
        sample = { ...direction(target), jumpHeld: true };
        if (p.pos.z <= -831 && p.grounded) { report.phase = 'finish pad flight'; report.padJump = snap(); sample = direction(target); }
      }
      else if (report.phase === 'finish pad flight') { target.set(0, .2, -842); sample = direction(target, .3); }
      else if (report.phase === 'brake') { sample = { moveY: -1 }; if (!p.freeSkate) { report.phase = 'settle foot'; count = 0; sample = {}; } }
      else if (report.phase === 'settle foot') { sample = {}; if (++count >= 60) report.phase = 'slow gap approach'; }
      else if (report.phase === 'slow gap approach') { sample = direction(target, .5); if (p.pos.z <= -737 && p.grounded) { report.phase = 'foot charge'; count = 0; sample = { jumpHeld: true }; } }
      else if (report.phase === 'foot charge') { sample = { jumpHeld: true }; if (++count >= 27) { report.phase = 'foot flight'; report.jump = snap(); sample = direction(target, .5); } }
      else if (report.phase === 'foot flight') sample = direction(target, .5);
      else sample = {};
      realUpdate(); realStep(dt, input, level); advanced = true;
    } catch (error) { report.failed = String(error); report.done = true; }
  };
  p.commitRenderStep = (...args) => {
    realCommit(...args); if (!advanced || report.done) return; advanced = false; report.frame++;
    for (let i = 0; i < l.checkpoints.length; i++) if (l.checkpoints[i].active && !report.checkpoints.includes(i)) report.checkpoints.push(i);
    report.end = snap();
    if (released && !p.grounded) aired = true;
    if (!recover && aired && p.grounded && p.pos.z < -756 && !report.landing) { report.landing = snap(); report.phase = 'finish'; }
    if (!recover && (p.isBailing || report.deaths.length || ['dead', 'gameover'].includes(p.state))) { report.failed = 'Actual source-to-gate controller bailed or died'; report.done = true; }
    if (!recover && p.state === 'finished') report.done = true;
    if (recover && report.deaths.length && p.grounded && p.groundHit && !p.isBailing && !['dead', 'gameover'].includes(p.state) && p.pos.distanceTo(l.currentSpawn) < .75) { report.recovery = { ...snap(), checkpoint: l.currentSpawn.toArray(), distance: p.pos.distanceTo(l.currentSpawn) }; report.done = true; }
    if (report.frame > 16000) { report.failed = 'Controller exhausted fixed-step budget'; report.done = true; }
    if (report.done) report.finalTuning = JSON.stringify(g.TUNING);
  };
};
function analyse(report) {
  const frames = report.frames;
  const active = frames.filter(f => !f.bailing && !['dead', 'gameover'].includes(f.state));
  const opening = active.filter(f => f.grounded && f.cursor >= 0 && f.cursor <= 150 && f.milliseconds < 8000);
  const yawSteps = [], yawReversals = [], cursorReversals = [];
  let previousRate = 0;
  for (let i = 1; i < frames.length; i++) {
    const f = frames[i], before = frames[i - 1], dt = (f.milliseconds - before.milliseconds) / 1000;
    if (dt <= 0 || f.snap !== before.snap || f.bailing || before.bailing || ['dead', 'gameover'].includes(f.state) || ['dead', 'gameover'].includes(before.state)) continue;
    const delta = difference(f.cameraYaw, before.cameraYaw), rate = delta / dt, localDelta = difference(f.localYaw, before.localYaw);
    yawSteps.push({ frame: f.frame, milliseconds: f.milliseconds, cursor: f.cursor, delta, rate, localDelta, lateral: f.lateral, input: f.input });
    if (Math.abs(rate) > 4 && Math.abs(previousRate) > 4 && Math.sign(rate) !== Math.sign(previousRate)) yawReversals.push({ frame: f.frame, milliseconds: f.milliseconds, cursor: f.cursor, previousRate, rate, localDelta, input: f.input });
    if (Math.abs(rate) > 4) previousRate = rate;
    if (f.cursor < before.cursor - .1) cursorReversals.push({ frame: f.frame, milliseconds: f.milliseconds, cursor: f.cursor, previousCursor: before.cursor, speed: f.speed, grounded: f.grounded, input: f.input });
  }
  const max = values => values.length ? Math.max(...values) : 0;
  const signedErrors = opening.map(f => difference(f.cameraYaw, f.inputBasisYaw));
  return { frames: frames.length, durationSeconds: frames.at(-1)?.milliseconds / 1000, first: frames[0], last: frames.at(-1), openingFrames: opening.length, openingViewToInputError: { min: Math.min(...signedErrors), max: Math.max(...signedErrors), maxAbs: max(signedErrors.map(Math.abs)) }, groundedOpeningRoadError: max(opening.map(f => Math.abs(difference(f.cameraYaw, f.roadFutureYaw)))), maximumViewToFutureError: max(active.map(f => Math.abs(difference(f.cameraYaw, f.futureYaw)))), maximumCanonicalToInputError: max(active.map(f => Math.abs(difference(f.canonicalYaw, f.inputBasisYaw)))), largestYawSteps: yawSteps.toSorted((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15), fastestYawRates: yawSteps.toSorted((a, b) => Math.abs(b.rate) - Math.abs(a.rate)).slice(0, 15), yawReversals, cursorReversals, stateCounts: frames.reduce((r, f) => (r[f.state] = (r[f.state] || 0) + 1, r), {}), maxSpeed: max(frames.map(f => f.speed)), bailingFrames: frames.filter(f => f.bailing).length, maxDeaths: max(frames.map(f => f.deaths)) };
}
try {
  for (const scenario of opening ? ['opening-centre', 'opening-carves', 'opening-strafe'] : []) {
    await page.goto(`${base}/?playtest&level=slip${lite ? '&lite' : ''}`); await ready(); await page.waitForTimeout(350);
    await page.evaluate(install, scenario);
    if (scenario !== 'opening-strafe') { await page.keyboard.down('ArrowUp'); await page.keyboard.down('Space'); }
    if (scenario === 'opening-strafe') {
      for (const [i, key] of ['ArrowRight', 'ArrowLeft'].entries()) { await page.keyboard.down(key); await page.waitForTimeout(750); await page.keyboard.up(key); await page.waitForTimeout(350); await page.screenshot({ path: `${output}/${scenario}-${i + 1}.png` }); }
      await page.waitForTimeout(600);
    } else if (scenario === 'opening-centre') {
      await page.waitForTimeout(3500); await page.screenshot({ path: `${output}/${scenario}-3.5s.png` });
      await page.waitForTimeout(4500); await page.screenshot({ path: `${output}/${scenario}-8s.png` });
      await page.waitForTimeout(6000);
    } else {
      await page.waitForTimeout(1500);
      for (const [i, key] of ['ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft'].entries()) {
        await page.keyboard.down(key); await page.waitForTimeout(350); await page.keyboard.up(key);
        await page.screenshot({ path: `${output}/${scenario}-carve-${i + 1}.png` }); await page.waitForTimeout(650);
      }
      await page.waitForTimeout(6500);
    }
    await page.keyboard.up('Space'); await page.keyboard.up('ArrowUp');
    const report = await page.evaluate(() => { window.slipstreamCameraMotion.tracing = false; return window.slipstreamCameraMotion; });
    report.base = base; report.lite = lite; report.errors = [...errors]; report.analysis = analyse(report); reports.push(report);
    await writeFile(`${output}/${scenario}.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ scenario, stamp: report.metadata.stamp, lookAhead: report.metadata.lookAhead, frames: report.frames.length, openingError: report.analysis.openingViewToInputError, openingRoadError: report.analysis.groundedOpeningRoadError, reversals: report.analysis.yawReversals.filter(r => r.milliseconds < 7000), errors }));
    assert.ok(report.frames.length > 100); assert.deepEqual(errors, []);
  }
  for (const recover of [...(journey ? [false] : []), ...(recovery ? [true] : [])]) {
    const scenario = recover ? 'checkpoint-gap-recovery' : 'source-to-gate';
    await page.goto(`${base}/?playtest&level=slip${lite ? '&lite' : ''}`); await ready(); await page.waitForTimeout(350);
    await page.evaluate(install, scenario); await page.evaluate(installJourney, recover);
    const shots = new Set(); let lastPhase = '', lastPrinted = -900;
    for (let i = 0; i < 1600; i++) {
      await page.waitForTimeout(100);
      const state = await page.evaluate(() => ({ ...window.slipstreamJourney.end, done: window.slipstreamJourney.done, failed: window.slipstreamJourney.failed }));
      if (state.phase !== lastPhase || state.frame - lastPrinted > 900 || state.done) { console.log(JSON.stringify({ scenario, ...state })); lastPhase = state.phase; lastPrinted = state.frame; }
      const shot = state.phase?.includes('flight') ? state.phase : !recover && state.cursor > 410 && state.cursor < 630 ? 'corkscrew' : !recover && state.cursor > 750 && state.cursor < 900 ? 'late-bend' : null;
      if (shot && !shots.has(shot)) { await page.screenshot({ path: `${output}/${scenario}-${shot.replaceAll(' ', '-')}.png` }); shots.add(shot); }
      if (state.done) break;
    }
    const report = await page.evaluate(() => { window.slipstreamCameraMotion.tracing = false; return { ...window.slipstreamCameraMotion, journey: window.slipstreamJourney }; });
    report.base = base; report.lite = lite; report.errors = [...errors]; report.analysis = analyse(report); reports.push(report);
    await page.screenshot({ path: `${output}/${scenario}-final.png` }); await writeFile(`${output}/${scenario}.json`, JSON.stringify(report, null, 2));
    assert.equal(report.journey.done, true); assert.equal(report.journey.failed, null, JSON.stringify(report.journey.end)); assert.equal(report.journey.tuning, report.journey.finalTuning); assert.deepEqual(report.journey.checkpoints, [0, 1]);
    if (recover) { assert.equal(report.journey.deaths.length, 1); assert.ok(report.journey.recovery.grounded && report.journey.recovery.ground); assert.ok(report.journey.deaths[0].position[2] < -738 && report.journey.deaths[0].position[2] > -756); }
    else { assert.equal(report.journey.end.state, 'finished'); assert.ok(report.journey.jump && report.journey.landing); assert.deepEqual(report.journey.deaths, []); }
    assert.deepEqual(errors, []); console.log(`PASS Slipstream actual ${scenario}, ${report.journey.frame} fixed steps, clean console.`);
  }
} finally { await writeFile(`${output}/summary.json`, JSON.stringify({ base, lite, reports: reports.map(report => ({ metadata: report.metadata, analysis: report.analysis })), errors }, null, 2)); await browser.close(); }
