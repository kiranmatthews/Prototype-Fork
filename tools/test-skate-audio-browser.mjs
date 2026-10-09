import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const replay = JSON.parse(await readFile(new URL('./fixtures/treehouse-skate-audio-replay.json', import.meta.url), 'utf8'));
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:5318/';
const lite = process.argv.includes('--lite');
const output = process.env.SKATE_AUDIO_OUTPUT || join(tmpdir(), 'skate-audio-browser');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const report = { base, lite, errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getGamepads', { value: () => [] });
    window.__skateAudioEvents = [];
    let id = 0;
    const nativeCreate = AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource = function () {
      const source = nativeCreate.call(this), sourceId = ++id;
      const record = type => {
        const g = window.__game;
        if (!g?.replayer.active || !source.buffer) return;
        const duration = source.buffer.duration;
        const name = source.loop && Math.abs(duration - 29932 / 12000) < .0001 ? 'skateLoop'
          : !source.loop && Math.abs(duration - 3388 / 12000) < .0001 ? 'skateTransition' : null;
        if (name) window.__skateAudioEvents.push({ frame: g.replayer.frame, name, type, sourceId,
          contextState: this.state, loopEnd: source.loopEnd });
      };
      const start = source.start.bind(source), stop = source.stop.bind(source);
      source.start = (...args) => { record('start'); return start(...args); };
      source.stop = (...args) => { record('stop'); return stop(...args); };
      return source;
    };
  });
  const url = new URL(base); url.search = `?playtest&level=treehouse-trail${lite ? '&lite' : ''}`;
  await page.goto(url.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
  report.stamp = await page.locator('.hud-build').textContent();
  assert.match(report.stamp, /Codex\/sol fork/);
  await page.evaluate(replay => {
    const g = window.__game, p = g.player, step = p.step.bind(p);
    window.__skateAudioSamples = [];
    p.step = (...args) => {
      const result = step(...args);
      if (g.replayer.active) window.__skateAudioSamples.push({ frame: g.replayer.frame, rolling: p.skateSoundRolling,
        raw: p.state === 'ride' && p.grounded && p.boardRolling && !p.sliding && Math.abs(p.speed) > .3 });
      return result;
    };
    g.loadReplay(replay);
  }, replay);
  for (const target of [1200, 2400, 3600, replay.frames]) {
    await page.waitForFunction(target => window.__game.replayer.frame >= target, target, { timeout: 180000 });
    console.log(JSON.stringify({ stage: lite ? 'lite' : 'full', frame: target }));
  }
  Object.assign(report, await page.evaluate(() => ({ events: window.__skateAudioEvents, samples: window.__skateAudioSamples })));
  await page.screenshot({ path: join(output, `skate-audio-${lite ? 'lite' : 'full'}.png`) });
  for (const [first, last] of [[1980, 2022], [3570, 3590]]) {
    const section = report.samples.filter(s => s.frame >= first && s.frame <= last);
    assert.equal(section.length, last - first + 1);
    assert.ok(section.some(s => !s.raw), 'the real browser must traverse the reported contact gaps');
    assert.ok(section.every(s => s.rolling), 'audio contact must bridge the short gaps');
    assert.deepEqual(report.events.filter(e => e.frame >= first && e.frame <= last), [],
      'real Web Audio nodes must neither restart nor stack landing clacks inside a contact gap');
    const previous = report.events.filter(e => e.name === 'skateLoop' && e.frame < first).at(-1);
    assert.equal(previous?.type, 'start', 'a real rolling source must already be running');
    assert.equal(previous.contextState, 'running', 'a suspended context does not verify audible playback');
  }
  assert.ok(report.events.some(e => e.name === 'skateTransition'), 'real landing audio must still play');
  for (const jump of [645, 717, 787, 3249, 3591, 3933]) {
    assert.equal(report.samples.find(s => s.frame === jump)?.rolling, false, 'the fixed-step jump must silence rolling immediately');
    assert.ok(report.events.some(e => e.name === 'skateLoop' && e.type === 'stop' && e.frame >= jump && e.frame <= jump + 6),
      `jump ${jump}: the next rendered frame must stop the audio node`);
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ result: 'PASS', stamp: report.stamp, mode: lite ? 'lite' : 'full',
    frames: report.samples.length, starts: report.events.filter(e => e.type === 'start').length, errors: report.errors }));
} finally {
  await writeFile(join(output, `report-${lite ? 'lite' : 'full'}.json`), JSON.stringify(report, null, 2));
  await browser.close();
}
