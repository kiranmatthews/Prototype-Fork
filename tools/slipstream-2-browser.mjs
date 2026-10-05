// Actual Chrome gameplay through the shared pilot and ordinary Input gamepad
// mapping. The production Player, collision, camera and fixed-step loop move Roo.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv.find(value => /^https?:/.test(value)) || 'http://127.0.0.1:5193').replace(/\/$/, '');
const modes = process.argv.includes('--full-only') ? ['full'] : process.argv.includes('--lite-only') ? ['lite'] : ['lite', 'full'];
const respawnOnly = process.argv.includes('--respawn-only'), skipRespawn = process.argv.includes('--skip-respawn');
const live = process.argv.includes('--live');
const capturePrefix = live ? 'live-' : '';
const output = '/private/tmp/slipstream-2-browser'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
const page = await context.newPage();
let fixture = null;
if (live) {
  const ts = (await import('typescript')).default;
  const source = await readFile(new URL('../src/levels/slipstream-2.ts', import.meta.url), 'utf8');
  const pilot = await readFile(new URL('./slipstream-2-pilot.mjs', import.meta.url), 'utf8');
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  fixture = { sourceHash: createHash('sha256').update(source).digest('hex'), pilotHash: createHash('sha256').update(pilot).digest('hex'), sourceRequests: 0, pilotRequests: 0 };
  // Only the fixture's two helper modules are supplied locally. The deployed
  // engine, published level pack, rendering, assets and physics stay live.
  await page.route('**/src/levels/slipstream-2.ts', route => { fixture.sourceRequests++; return route.fulfill({ status: 200, contentType: 'application/javascript', body: javascript }); });
  await page.route('**/tools/slipstream-2-pilot.mjs', route => { fixture.pilotRequests++; return route.fulfill({ status: 200, contentType: 'application/javascript', body: pilot }); });
}
page.setDefaultNavigationTimeout(120000);
const errors = [], reports = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const ready = () => page.waitForFunction(() => window.__game?.getCurrentLevel().id === 'slipstream-2' && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
const install = async ({ respawn }) => {
  const g = window.__game, p = g.player, l = g.getLevel();
  const source = await import('/src/levels/slipstream-2.ts');
  const { createSlipstream2Pilot } = await import('/tools/slipstream-2-pilot.mjs');
  const pilot = createSlipstream2Pilot(source);
  const report = window.slipstream2Review = { frame: 0, done: false, failed: null, phase: pilot.phase, evidence: pilot.evidence, deathEvents: [], end: null, tuning: JSON.stringify(g.TUNING), collision: {}, respawn, driveStage: 'pilot' };
  const snap = () => ({ frame: report.frame, phase: report.phase, position: p.pos.toArray(), speed: p.speed, verticalSpeed: p.vVel, grounded: p.grounded, state: p.state, board: p.boardRolling, bailing: p.isBailing, deaths: p.totalDeaths, station: source.slipstream2Progress(p.pos), temple: pilot.evidence.temple.length, jumps: pilot.evidence.jumps.length, ground: p.groundHit ? { height: p.groundHit.y, mover: p.groundHit.moverId !== undefined, gravityTrack: !!p.groundHit.gravityTrack } : null });
  l.root.updateMatrixWorld(true);
  const ray = new p.raycaster.constructor();
  const support = q => { ray.set(p.pos.clone().fromArray(q).add(p.pos.clone().set(0, 3, 0)), p.pos.clone().set(0, -1, 0)); ray.near = 0; ray.far = 6; return ray.intersectObjects(l.groundMeshes, false).map(hit => ({ height: hit.point.y, distance: hit.distance, name: hit.object.name })); };
  report.collision.spawn = support(source.SLIPSTREAM_2_LEVEL.spawn);
  report.collision.roads = [0, ...source.SLIPSTREAM_2_CHECKPOINTS.map(checkpoint => checkpoint.s)].map(s => ({ s, hits: support(source.slipstream2Point(s)) }));
  report.collision.gaps = source.SLIPSTREAM_2_GAPS.map(gap => ({ name: gap.name, width: gap.width, hits: support(source.slipstream2Point((gap.a + gap.b) / 2)) }));
  let sample = {}, advanced = false;
  const realUpdate = g.input.update.bind(g.input), realStep = p.step.bind(p), realCommit = p.commitRenderStep.bind(p), realDeath = p.onDeath;
  const direction = (q, pace) => { const dx = q[0] - p.pos.x, dz = q[2] - p.pos.z, d = Math.hypot(dx, dz) || 1, f = p.courseInputDirection(l) ?? p.camDir; return { moveX: (dx * -f.z + dz * f.x) / d * pace, moveY: (dx * f.x + dz * f.z) / d * pace }; };
  // Invert the radial deadzone so desired analog values still pass through
  // the real Input.update deadzone, two-decimal quantization and button edges.
  g.input.pollGamepad = () => {
    const x = sample.moveX || 0, y = sample.moveY || 0, length = Math.hypot(x, y), magnitude = Math.min(1, length);
    const raw = magnitude ? .22 + .78 * magnitude : 0;
    const held = { 0: !!sample.jumpHeld, 1: !!sample.grabHeld, 2: !!sample.spinHeld, 3: !!sample.grindHeld, 7: !!sample.transferHeld };
    return { id: 'Slipstream 2 validation controller', index: 0, connected: true, mapping: 'standard', axes: length ? [x / length * raw, -y / length * raw, 0, 0] : [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: !!held[i], touched: !!held[i], value: held[i] ? 1 : 0 })) };
  };
  p.onDeath = function (...args) {
    report.deathEvents.push({ ...snap(), pit: l.pitBoxes.findIndex(box => box.intersectsBox(p.playerBox)), checkpoint: l.currentSpawn.toArray() });
    if (respawn) report.driveStage = 'respawn';
    return realDeath.apply(this, args);
  };
  p.step = (dt, input, level) => {
    if (report.done) return;
    try {
      if (report.driveStage === 'pilot') sample = pilot.sample(p, l);
      else if (report.driveStage === 'brake') {
        sample = { moveY: -1 };
        if (!p.freeSkate) { report.driveStage = 'settle foot'; report.stageFrames = 0; sample = {}; }
      } else if (report.driveStage === 'settle foot') {
        sample = {};
        if (++report.stageFrames >= 60) report.driveStage = 'slow approach';
      } else if (report.driveStage === 'slow approach') {
        const station = source.slipstream2Progress(p.pos);
        sample = direction(source.slipstream2Point(station + 9), .5);
        // Walking intentionally stops at unsupported edges. Release a real
        // charged foot jump at low speed to test the gap's fatal water instead.
        if (station >= source.SLIPSTREAM_2_GAPS[0].a - 1.6 && p.grounded) { report.driveStage = 'slow charge'; report.stageFrames = 0; sample = { jumpHeld: true }; }
      } else if (report.driveStage === 'slow charge') {
        sample = { jumpHeld: true };
        if (++report.stageFrames >= 27) { report.driveStage = 'slow flight'; report.slowTakeoff = snap(); sample = direction(source.slipstream2Point(source.slipstream2Progress(p.pos) + 9), .5); }
      } else if (report.driveStage === 'slow flight') sample = direction(source.slipstream2Point(source.slipstream2Progress(p.pos) + 9), .5);
      else sample = {};
      realUpdate(); realStep(dt, input, level); advanced = true;
    } catch (error) { report.failed = { message: String(error), snapshot: snap() }; report.done = true; }
  };
  p.commitRenderStep = (...args) => {
    realCommit(...args); if (!advanced || report.done) return; advanced = false; report.frame++;
    try {
      if (report.driveStage === 'pilot') {
        pilot.observe(p, l); report.phase = pilot.phase;
        if (respawn && l.checkpoints[3].active) { report.checkpoint = { index: 3, position: l.currentSpawn.toArray(), contact: snap() }; report.driveStage = 'brake'; }
      } else report.phase = report.driveStage;
      report.end = snap();
      if (!respawn && (p.isBailing || report.deathEvents.length || ['dead', 'gameover'].includes(p.state))) throw Error('The actual gameplay journey bailed or died');
      if (!respawn && p.state === 'finished') { report.done = true; report.finalTuning = JSON.stringify(g.TUNING); }
      if (respawn && report.deathEvents.length && p.grounded && p.groundHit && !p.isBailing && !['dead', 'gameover'].includes(p.state) && p.pos.distanceTo(l.currentSpawn) < .75) {
        report.recovered = { ...snap(), checkpointDistance: p.pos.distanceTo(l.currentSpawn), support: support(p.pos.toArray()), checkpoint: l.currentSpawn.toArray() };
        report.done = true; report.finalTuning = JSON.stringify(g.TUNING);
      }
      if (report.frame > 18000) throw Error('The actual gameplay fixture exceeded 18000 fixed steps');
    } catch (error) { report.failed = { message: String(error), snapshot: snap() }; report.done = true; }
  };
};
try {
  for (const mode of modes) {
    const attempts = respawnOnly ? [true] : skipRespawn ? [false] : [false, true];
    for (const respawn of attempts) {
      await page.goto(`${base}/?playtest&level=slipstream-2${mode === 'lite' ? '&lite' : ''}`); await ready();
      await page.waitForTimeout(300);
      const spawn = await page.evaluate(() => ({ position: window.__game.player.pos.toArray(), grounded: window.__game.player.grounded, stamp: document.querySelector('.hud-build')?.textContent, dropBailDistance: window.__game.TUNING.hugeDropDistance, dropBailImpact: window.__game.TUNING.hugeDropImpact }));
      assert.equal(spawn.grounded, true); assert.match(spawn.stamp, /Codex\/sol fork/);
      await page.evaluate(install, { respawn });
      const shots = new Set(); let state, lastPhase = '', lastLogFrame = -900, deadline = Date.now() + 600000;
      while (Date.now() < deadline) {
        await page.waitForTimeout(100);
        state = await page.evaluate(() => { const r = window.slipstream2Review; return { done: r.done, phase: r.phase, frame: r.frame, position: window.__game.player.pos.toArray(), grounded: window.__game.player.grounded, temple: r.evidence.temple.length, jumps: r.evidence.jumps.length, failed: r.failed }; });
        const interestingPhase = !state.phase.startsWith('temple') || (state.phase === 'temple settle' && state.temple % 8 === 0);
        if ((state.phase !== lastPhase && interestingPhase) || state.frame - lastLogFrame >= 900 || state.done) { console.log(JSON.stringify({ mode, respawn, ...state })); lastLogFrame = state.frame; }
        lastPhase = state.phase;
        const shot = !respawn && state.phase === 'temple charge' && state.temple >= 3 && state.temple < 6 ? 'temple-tier-1' : !respawn && state.phase === 'temple charge' && state.temple >= 11 && state.temple < 14 ? 'temple-tier-2' : !respawn && state.phase === 'temple charge' && state.temple >= 19 && state.temple < 22 ? 'temple-tier-3' : !respawn && !state.grounded && state.phase === 'Sun Gate flight' ? 'first-leap' : !respawn && !state.grounded && state.phase === 'Twin Spires II flight' ? 'middle-leap' : !respawn && !state.grounded && state.phase === 'Last Flight II flight' ? 'final-leap' : respawn && state.phase === 'slow flight' && !state.grounded ? 'failed-slow-leap' : null;
        if (shot && !shots.has(shot)) { await page.screenshot({ path: `${output}/${capturePrefix}${shot}-${mode}.png` }); shots.add(shot); }
        if (state.done) break;
      }
      const report = await page.evaluate(() => window.slipstream2Review);
      report.mode = mode; report.spawn = spawn; report.screenshots = [...shots]; report.consoleErrors = [...errors]; reports.push(report);
      await page.screenshot({ path: `${output}/${capturePrefix}${respawn ? 'checkpoint-respawn' : 'finish'}-${mode}.png` });
      await writeFile(`${output}/${capturePrefix}${respawn ? 'respawn' : 'journey'}-${mode}.json`, JSON.stringify(report, null, 2));
      assert.equal(report.done, true, 'Actual browser fixture timed out'); assert.equal(report.failed, null, JSON.stringify(report.failed)); assert.equal(report.tuning, report.finalTuning);
      assert.ok(report.collision.spawn.length); assert.ok(report.collision.roads.every(road => road.hits.length)); assert.ok(report.collision.gaps.every(gap => gap.hits.length === 0));
      if (respawn) { assert.equal(report.deathEvents.length, 1); assert.ok(report.slowTakeoff.grounded && !report.slowTakeoff.board && report.slowTakeoff.speed < 8); assert.ok(report.deathEvents[0].pit >= 0, 'The slow leap must touch a real pit'); assert.ok(report.recovered.grounded && report.recovered.support.length); assert.ok(report.recovered.checkpointDistance < .75); assert.deepEqual(report.recovered.checkpoint, report.checkpoint.position); }
      else { assert.equal(report.end.state, 'finished'); assert.equal(report.evidence.temple.length, 24); assert.equal(report.evidence.jumps.length, 12); assert.ok(report.evidence.jumps.every(jump => jump.airSeen && jump.takeoff.speed > 18)); assert.equal(report.evidence.temple.filter(landing => landing.moving).length, 6); assert.equal(report.evidence.checkpoints.length, 16); assert.deepEqual(report.deathEvents, []); }
      assert.deepEqual(errors, []); console.log(`PASS ${mode} ${respawn ? 'real slow pit death and supported checkpoint respawn' : 'temple, twelve real jumps and finish gate'}`);
    }
  }
} finally { await writeFile(`${output}/${live ? 'live-' : ''}summary.json`, JSON.stringify({ base, live, fixture, reports, errors }, null, 2)); await browser.close(); }
