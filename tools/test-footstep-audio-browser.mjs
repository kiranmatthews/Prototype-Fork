import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv.find(arg => /^https?:/.test(arg)) || 'http://127.0.0.1:5419/';
const output = process.env.FOOTSTEP_OUTPUT || '/private/tmp/footstep-audio-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const reports = [], errors = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => { Object.defineProperty(navigator, 'getGamepads', { value: () => [] }); });
    await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay && window.__game.player.grounded, null, { timeout: 180000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(async () => {
      const g = window.__game;
      await g.sfx.prepare(); g.sfx.unlock();
      const data = { v: 1, name: 'Footstep contact review', spawn: [0, .02, 0], killY: -20, startWarpPad: false, components: [
        { t: 'platform', p: [0, -.5, 0], s: [120, 1, 120], tex: 'grass' },
        { t: 'checkpoint', p: [8, 0, 0] }, { t: 'gate', p: [0, 0, -50] },
      ] };
      const id = g.saveUserLevel({ id: '', name: data.name, data });
      if (!id || !g.switchLevel(id)) throw Error('Footstep review did not load');
      g.gameFlow.hide();
      const p = g.player;
      const r = window.__footReview = { contacts: [], sources: [], renders: [], input: null, phase: '', freeze: false, captureNext: false };
      const step = p.step.bind(p);
      p.step = (dt, input, level) => { if (!r.freeze) step(dt, r.input ? { ...input, ...r.input } : input, level); };
      const vector = p.pos.clone();
      const heights = () => p.proceduralFootwear.map(({ sole }) => {
        sole.updateWorldMatrix(true, false); const points = sole.geometry.getAttribute('position'); let min = Infinity;
        for (let i = 0; i < points.count; i++) min = Math.min(min, vector.fromBufferAttribute(points, i).applyMatrix4(sole.matrixWorld).sub(p.renderPosition).dot(p.groundHit.normal) / p.groundHit.normal.y);
        return min;
      });
      const update = p.updateFootstepAudio.bind(p);
      p.updateFootstepAudio = () => {
        if (p.grounded && p.groundHit) r.renders.push({ phase: r.phase, frame: g.frameStats.frame, heights: heights() });
        update();
      };
      const play = p.footstepAudio.play.bind(p.footstepAudio);
      p.footstepAudio.play = (side, surface, speed) => {
        r.contacts.push({ phase: r.phase, frame: g.frameStats.frame, time: performance.now(), side, surface, speed, heights: heights(), clip: g.characterAnimationRuntime.diagnostics.timelineTime });
        play(side, surface, speed);
        if (r.captureNext) { r.freeze = true; r.captureNext = false; }
      };
      const context = g.sfx.ctx, create = context.createBufferSource.bind(context);
      context.createBufferSource = () => {
        const source = create(), start = source.start.bind(source);
        source.start = (...args) => {
          if (g.sfx.emitterChannel.startsWith('footsteps-')) r.sources.push({ phase: r.phase, frame: g.frameStats.frame, context: context.state, rate: source.playbackRate.value });
          return start(...args);
        };
        return source;
      };
    });
    await page.waitForFunction(() => window.__game.player.grounded);
    const cases = [];
    for (const spec of [
      { name: 'keyboard-left', key: 'ArrowLeft' }, { name: 'keyboard-right', key: 'ArrowRight' },
      { name: 'keyboard-backward', key: 'ArrowDown' }, { name: 'analog-walk-sideways', input: { moveX: .25, moveY: 0 } },
      { name: 'analog-diagonal', input: { moveX: .46, moveY: .46 } },
      { name: 'ice-scuffs', input: { moveX: 1, moveY: 0 }, surface: 'ice' },
    ]) {
      await page.evaluate(spec => {
        const g = window.__game, r = window.__footReview;
        r.phase = spec.name; r.input = spec.input ?? null;
        const floor = g.getLevel().groundMeshes.find(mesh => ['grass', 'ice'].includes(mesh.material?.userData.texKind));
        floor.material.userData.texKind = spec.surface ?? 'grass';
        floor.userData.slippy = spec.surface === 'ice'; floor.userData.iceGrip = spec.surface === 'ice' ? .08 : undefined;
        g.player.respawn(g.getLevel(), true); g.characterAnimationRuntime.restart();
      }, spec);
      if (spec.key) await page.keyboard.down(spec.key);
      await page.waitForFunction(name => window.__footReview.contacts.filter(e => e.phase === name).length >= 5, spec.name, { timeout: 15000 });
      if (spec.key) await page.keyboard.up(spec.key);
      const result = await page.evaluate(name => {
        const r = window.__footReview;
        const contacts = r.contacts.filter(e => e.phase === name), sources = r.sources.filter(e => e.phase === name);
        r.input = null; r.phase = 'settle';
        const floor = window.__game.getLevel().groundMeshes.find(mesh => mesh.material?.userData.texKind === 'ice');
        if (floor) { floor.material.userData.texKind = 'grass'; floor.userData.slippy = false; delete floor.userData.iceGrip; }
        return { name, contacts, sources };
      }, spec.name);
      assert.equal(result.contacts.length, result.sources.length, `${spec.name}: a contact lost its real audio source`);
      assert.ok(result.sources.every(s => s.context === 'running'), 'suspended audio cannot prove playback');
      assert.ok(result.contacts.every(c => c.surface === (spec.surface ?? 'grass')));
      assert.ok(result.contacts.some(c => c.side === 'left') && result.contacts.some(c => c.side === 'right'));
      if (!spec.surface) assert.ok(result.contacts.every(c => c.heights[c.side === 'left' ? 0 : 1] <= c.heights[c.side === 'left' ? 1 : 0] + .006));
      assert.deepEqual(result.contacts.map(c => c.frame), result.sources.map(s => s.frame), 'audio attack drifted from the rendered foot');
      cases.push({ name: spec.name, contacts: result.contacts.length, actualAudioSources: result.sources.length,
        meanIntervalMs: (result.contacts.at(-1).time - result.contacts[1].time) / (result.contacts.length - 2) });
      console.log(JSON.stringify({ lite, ...cases.at(-1) }));
    }
    await page.waitForFunction(() => window.__game.player.animationClipHint === 'player.idle');
    await page.evaluate(() => { window.__footReview.phase = 'idle'; });
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => window.__footReview.contacts.filter(c => c.phase === 'idle').length), 0);
    // A real keyboard jump must not sound until an eligible foot lands again.
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(350); await page.keyboard.down('Space');
    await page.waitForTimeout(150); await page.keyboard.up('Space');
    await page.waitForFunction(() => !window.__game.player.grounded);
    await page.evaluate(() => { window.__footReview.phase = 'air'; });
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__footReview.contacts.filter(c => c.phase === 'air' && c.speed > 0).length), 0);
    await page.keyboard.up('ArrowUp');
    // Freeze a live lateral contact for full-render visual inspection.
    await page.evaluate(() => { const g = window.__game, r = window.__footReview; g.player.respawn(g.getLevel(), true); g.characterAnimationRuntime.restart(); r.phase = 'capture'; r.input = { moveX: 1, moveY: 0 }; r.captureNext = true; });
    await page.waitForFunction(() => window.__footReview.freeze);
    await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-lateral-contact.png` });
    await page.evaluate(() => {
      const g = window.__game, p = g.player, r = window.__footReview;
      r.freeze = false; r.input = null; r.phase = 'pit';
      p.pos.set(70, .5, 0); p.prevPos.copy(p.pos); p.grounded = false; p.state = 'air'; p.vVel = 0; p.snapRenderInterpolation();
    });
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    await page.waitForFunction(() => window.__game.player.grounded && window.__game.player.state === 'ride', null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__footReview.contacts.filter(c => c.phase === 'pit').length), 0);
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(8, 2.2, 0); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false; p.snapRenderInterpolation();
    });
    await page.waitForFunction(() => window.__game.getLevel().activeCheckpoint !== null);
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(0, 1.4, -50); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false; p.snapRenderInterpolation();
    });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay);
    const evidence = await page.evaluate(() => ({ contacts: window.__footReview.contacts, sources: window.__footReview.sources }));
    reports.push({ lite, stamp, cases, idleSilent: true, airborneSilent: true, pitRespawn: true, checkpoint: true, finishGate: true });
    await writeFile(`${output}/${lite ? 'lite' : 'full'}-events.json`, JSON.stringify(evidence, null, 2));
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS lite/full rendered foot contacts, real Web Audio attacks, lateral/backward/analog movement, idle and airborne silence.');
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify({ reports, errors }, null, 2));
  await browser.close();
}
