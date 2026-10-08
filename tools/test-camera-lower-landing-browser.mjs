// The user's original course and input recording, through the published camera.
// Fast-forward only the earlier temple; inspect all reported jumps at render rate.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5199/';
const output = process.env.CAMERA_REPLAY_OUTPUT || '/private/tmp/slipstream-camera-browser';
await mkdir(output, { recursive: true });
const replay = JSON.parse(await readFile(new URL('./fixtures/slipstream-camera/replay.json', import.meta.url), 'utf8'));
const source = await readFile(new URL('./fixtures/slipstream-camera/original-course.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { SLIPSTREAM_2_LEVEL: data, SLIPSTREAM_2_GAPS: gaps, slipstream2Point: point, slipstream2Progress: progress } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(data => { localStorage.setItem('solProtoUserLevels', JSON.stringify([{ id: 'slipstream-2', name: data.name, data }])); localStorage.setItem('solProtoCloudPulled', '1'); }, data);
    await page.goto(`${base.replace(/\/$/, '')}/?playtest&level=slipstream-2${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent(); assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(({ replay }) => {
      const g = window.__game;
      if (g.player.pos.y < 145) throw Error('Original replay course was not loaded');
      g.loadReplay(replay); g.gameFlow.hide();
      const p = g.player, l = g.getLevel(), input = { consumeEdges() {} };
      // This runs the exact fixed-step recording, including recorded camera yaw.
      for (let i = 0; i < 2300; i++) {
        if (!g.replayer.feed(input, p.camDir)) throw Error('Replay ended during setup');
        p.step(1 / 60, input, l); l.update(1 / 60); p.flushLevelCrateRewards(l); p.commitRenderStep(l);
      }
      p.collapseRenderInterpolation();
      const report = window.__landingReview = { samples: [], done: false };
      const native = p.restoreRenderPose.bind(p);
      p.restoreRenderPose = () => {
        const f = g.replayer.frame;
        if (!report.done && f >= 2510 && f <= 3510) {
          report.samples.push({ frame: f, state: p.state, ground: p.grounded, p: p.pos.toArray(),
            floor: p.groundBelowY, v: p.vVel, eye: g.camera.position.toArray(), rotation: g.camera.quaternion.toArray() });
        }
        if (f >= 3510) report.done = true;
        native();
      };
    }, { replay, data });
    await page.waitForFunction(() => window.__game.replayer.frame >= 3000, null, { timeout: 60000 });
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-lower-catch.png` });
    await page.waitForFunction(() => window.__landingReview.done, null, { timeout: 60000 });
    const report = await page.evaluate(() => window.__landingReview);
    await writeFile(`${output}/${lite ? 'lite' : 'full'}.json`, JSON.stringify(report));
    report.jumps = gaps.slice(0, 3).map(gap => {
      const samples = report.samples.filter(s => s.state === 'air' && s.v < 0 && s.floor === null &&
        progress(s.p) > gap.a && progress(s.p) < gap.b && s.p[1] < point(gap.a)[1] - .2);
      if (samples.length < 2) return { name: gap.name, eligible: false, reason: 'This rendered playback stayed above the departure lip' };
      let changes = 0;
      for (let i = 1; i < samples.length; i++) if (JSON.stringify(samples[i].eye) !== JSON.stringify(samples[i - 1].eye)) changes++;
      assert.ok(changes >= samples.length - 2, `Camera froze through valid jump ${gap.name}`);
      assert.ok(report.samples.some(s => s.ground && progress(s.p) >= gap.b && progress(s.p) < gap.b + 25), `Did not land ${gap.name}`);
      return { name: gap.name, firstFrame: samples[0].frame, samples: samples.length, changes };
    });
    assert.ok(report.jumps.filter(j => j.samples >= 2).length >= 2, 'Need at least two rendered catches below departure height');
    reports.push({ lite, stamp, jumps: report.jumps });
    await writeFile(`${output}/${lite ? 'lite' : 'full'}.json`, JSON.stringify(report));
    await page.close(); console.log(JSON.stringify(reports.at(-1)));
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${output}/summary.json`, JSON.stringify({ base, reports, errors }, null, 2)); await browser.close(); }
