// Real worker cadence during a deliberately blocked game thread, final GPU
// preparation, native/CRT presentation, resize, reduced motion and fallback.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5376/';
const output = process.env.LOADING_MOTION_OUTPUT || '/private/tmp/loading-motion';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
const cases = [
  { name: 'lite', query: '?playtest&level=codex-lab&lite', width: 1280, height: 720 },
  { name: 'full-crt', query: '?playtest&level=codex-lab', width: 1280, height: 720, crt: true },
  { name: 'native', query: '?playtest&level=codex-lab', width: 1920, height: 1080, native: true },
  { name: 'reduced', query: '?playtest&level=codex-lab', width: 390, height: 844, reduced: true },
  { name: 'fallback', query: '?playtest&level=codex-lab&lite', width: 960, height: 720, fallback: true },
  { name: 'home-fallback-reduced', query: '?', width: 390, height: 844, fallback: true, reduced: true },
];
try {
  for (const test of cases) {
    if (process.env.LOADING_MOTION_CASES && !process.env.LOADING_MOTION_CASES.split(',').includes(test.name)) continue;
    const errors = [], context = await browser.newContext({ viewport: { width: test.width, height: test.height },
      deviceScaleFactor: 1, reducedMotion: test.reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
    await context.addInitScript(test => {
      if (test.native) localStorage.setItem('solProtoRenderQuality.v1', JSON.stringify({ version: 1, enabled: false, baseHeight: 720, outputMultiplier: 1, fixed60: true }));
      if (test.fallback) HTMLCanvasElement.prototype.transferControlToOffscreen = undefined;
      window.__loadingWorkerStats = [];
      const observeStartup = () => {
        const game = window.__game;
        const title = game?.getGameFlowVortexDiagnostics().loadingTitle;
        if (game?.gameFlow.startupLoading && title?.ready) window.__startupLoadingTitle = title;
        if (!game || game.gameFlow.startupLoading) requestAnimationFrame(observeStartup);
      };
      requestAnimationFrame(observeStartup);
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(...args) {
          super(...args);
          if (String(args[0]).includes('loadingVortex')) this.addEventListener('message', ({ data }) => {
            if (data.type === 'stats') window.__loadingWorkerStats.push(data);
          });
        }
      };
    }, test);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(new URL(test.query, base).href);
      await page.waitForFunction(() => window.__game && !window.__game.gameFlow.startupLoading && !window.__game.gameFlow.loadingPhase, null, { timeout: 180000 });
      if (test.crt) await page.evaluate(() => window.__game.gameFlow.callbacks.onCrtEnabled(true));
      const startup = await page.evaluate(() => window.__game.getLoadingDiagnostics());
      assert.equal(startup.animation.active, false);
      assert.equal(startup.animation.resident, false);
      assert.equal(await page.locator('.game-loading-motion').count(), 0);
      assert.equal(await page.evaluate(() => window.__game.getGameFlowVortexDiagnostics().loadingTitle), null,
        'Startup must remove loading text before revealing the title or gameplay');
      const initialTitle = await page.evaluate(fallback => fallback ? window.__startupLoadingTitle :
        window.__loadingWorkerStats.find(s => s.title?.ready)?.title, test.fallback);
      assert.equal(initialTitle?.ready, true, 'Cold startup must display Roo loading text');
      await page.evaluate(() => {
        const g = window.__game, f = g.gameFlow;
        window.__loadingWorkerStats = [];
        const warm = f.callbacks.warmDestinationFrame, final = f.callbacks.prepareDestinationFrame;
        f.callbacks.warmDestinationFrame = async () => {
          window.__loadingHeld = 'warm';
          await new Promise(resolve => { window.__continueWarm = resolve; });
          await warm();
        };
        f.callbacks.prepareDestinationFrame = async () => {
          window.__loadingHeld = 'final';
          await new Promise(resolve => { window.__continueFinal = resolve; });
          await final();
        };
        window.__loadingTransition = f.transition(() => { assertSwitch(g.switchLevel('treehouse-trail')); f.hide(); });
        function assertSwitch(result) { if (!result) throw Error('Level switch failed'); }
      });
      await page.waitForFunction(() => window.__loadingHeld === 'warm', null, { timeout: 180000 });
      const warm = await page.evaluate(() => ({ animation: window.__game.getLoadingDiagnostics().animation,
        primary: window.__game.getGameFlowVortexDiagnostics().renderedFrames,
        title: window.__game.getGameFlowVortexDiagnostics().loadingTitle }));
      assert.equal(warm.animation.active, !test.fallback, JSON.stringify(warm));
      if (!test.fallback) assert.equal(warm.animation.failure, null);
      const title = test.fallback ? warm.title : warm.animation.title;
      assert.equal(title?.ready, true, 'Loading must carry the decoded Roo PNG title');
      assert.equal(title.text, 'LOADING');
      assert.ok(title.bounds.left > .05 && title.bounds.right < .95 && title.bounds.top > .05 && title.bounds.bottom < .95,
        'Bouncing title must fit inside the viewport');
      await page.screenshot({ path: join(output, test.name + '-warm.png') });
      const stall = await page.evaluate(() => {
        const start = performance.timeOrigin + performance.now(), until = performance.now() + 1500;
        while (performance.now() < until) { /* Simulate synchronous asset parsing. */ }
        return { start, end: performance.timeOrigin + performance.now() };
      });
      await page.waitForTimeout(650);
      const moving = await page.evaluate(() => ({ animation: window.__game.getLoadingDiagnostics().animation,
        stats: window.__loadingWorkerStats, primary: window.__game.getGameFlowVortexDiagnostics().renderedFrames }));
      if (!test.fallback && !test.reduced) {
        const during = moving.stats.filter(s => s.at >= stall.start && s.at <= stall.end);
        assert.ok(during.length >= 2, 'Worker must publish frames while main JS is blocked');
        assert.ok(during.at(-1).frames - during[0].frames >= 20, 'Loader stalled behind game work');
        assert.ok(during.at(-1).title.seconds - during[0].title.seconds > .3, 'Title bounce stalled behind game work');
        assert.ok(new Set(moving.stats.map(s => JSON.stringify(s.title.bounds))).size > 1, 'Title vertices did not animate');
        assert.equal(moving.primary, warm.primary, 'Main renderer duplicated hidden loading work');
      }
      if (test.reduced) assert.equal(moving.animation.frames, warm.animation.frames, 'Reduced motion must not run an idle animation loop');
      if (test.reduced) assert.equal((test.fallback ? warm.title : moving.animation.title).seconds, 0, 'Reduced motion title must hold its neutral pose');
      await page.evaluate(() => window.__continueWarm());
      await page.waitForFunction(() => window.__loadingHeld === 'final', null, { timeout: 180000 });
      const finalBefore = await page.evaluate(() => window.__game.getLoadingDiagnostics().animation.frames);
      await page.waitForTimeout(650);
      const final = await page.evaluate(() => ({ animation: window.__game.getLoadingDiagnostics().animation,
        phase: window.__game.gameFlow.loadingPhase, locked: window.__game.gameFlow.blocksGameplay,
        held: document.querySelectorAll('.game-loading-held-frame').length }));
      assert.equal(final.phase, 'prepare-destination'); assert.equal(final.locked, true);
      if (!test.fallback && !test.reduced) assert.ok(final.animation.frames > finalBefore, 'Final preparation froze the animation');
      assert.equal(final.held, test.fallback ? 1 : 0, 'Worker loading must avoid fullscreen readback snapshots');
      await page.screenshot({ path: join(output, test.name + '-final.png') });
      if (!test.fallback) {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(250);
        const size = await page.evaluate(() => ({ animation: window.__game.getLoadingDiagnostics().animation,
          width: window.__game.renderer.domElement.width, height: window.__game.renderer.domElement.height }));
        assert.equal(size.animation.width, size.width); assert.equal(size.animation.height, size.height);
        await page.screenshot({ path: join(output, test.name + '-rotated.png') });
      }
      await page.evaluate(() => window.__continueFinal());
      await page.evaluate(() => window.__loadingTransition);
      const destination = await page.evaluate(() => ({ loading: window.__game.getLoadingDiagnostics(),
        blocked: window.__game.gameFlow.blocksGameplay, level: window.__game.getCurrentLevel().id }));
      assert.equal(destination.blocked, false); assert.equal(destination.level, 'treehouse-trail');
      assert.equal(destination.loading.animation.resident, false); assert.equal(destination.loading.animation.active, false);
      assert.equal(destination.loading.animation.title, null);
      assert.equal(await page.evaluate(() => window.__game.getGameFlowVortexDiagnostics().loadingTitle), null,
        'Destination must release loading lettering');
      assert.equal(destination.loading.animation.starts, destination.loading.animation.stops);
      assert.deepEqual(destination.loading.pending, []); assert.deepEqual(destination.loading.failed, []);
      assert.equal(await page.locator('.game-loading-motion,.game-loading-held-frame').count(), 0);
      await page.screenshot({ path: join(output, test.name + '-destination.png') });
      assert.deepEqual(errors, []);
      rows.push({ name: test.name, startup, warm, stall, moving, final, destination, errors });
      console.log('PASS ' + test.name);
    } finally { await context.close(); await writeFile(join(output, 'report.json'), JSON.stringify({ base, rows, errors }, null, 2)); }
  }
} finally { await browser.close(); }
