import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] ?? 'http://127.0.0.1:5497', full = !!process.env.CART_FULL;
const out = process.env.CART_RUN_OUTPUT ?? '/private/tmp/cart-run-browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, serviceWorkers: 'block',
  recordVideo: { dir: out, size: { width: 1600, height: 900 } } });
const page = await context.newPage(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
try {
  await page.goto(`${base}/?playtest&level=coconut-cart-rally${full ? '' : '&lite'}`, { timeout: 180000 });
  await page.waitForFunction(() => window.__game?.getSkateRace()?.carts && !window.__game.gameFlow.blocksGameplay, null, { timeout: 180000 });
  await page.getByRole('button', { name: 'RACE', exact: true }).click();
  await page.waitForFunction(() => window.__game.getSkateRace().phase === 'running', null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.__game, r = g.getSkateRace();
    g.renderQualitySettings.setRegularResolution(null);
    window.runReview = { angle: 0, frames: [], started: 0 };
    const step = r.step.bind(r);
    r.step = (...args) => {
      step(...args);
      const a = r.carts.interactions.find(a => a.id === 0);
      if (a) {
        const rig = a.actor.player.animationRig;
        window.runReview.frames.push({ angle: window.runReview.angle, age: a.age, approach: a.approach,
          kind: a.kind, locomotion: { ...a.actor.locomotion },
          hips: rig.jointsById.get('hipLeft').node.quaternion.toArray(),
          feet: ['Left', 'Right'].map(side => rig.jointsById.get(`ankle${side}`).node.getWorldPosition(g.player.pos.clone()).toArray()),
          scale: a.actor.player.vehicleVisualRoot.getWorldScale(g.player.pos.clone()).toArray() });
      }
    };
    const render = g.renderer.render.bind(g.renderer);
    g.renderer.render = (...args) => {
      if (args[1] === g.camera) {
        const a = r.carts.interactions.find(a => a.id === 0), p = r.riders[0].player;
        const focus = a ? a.actor.root.position : p.pos;
        const angle = window.runReview.angle * Math.PI / 180;
        const yaw = a && a.age < a.approach ? a.actor.root.rotation.y : 0;
        g.camera.position.set(focus.x + Math.sin(angle + yaw) * 7, focus.y + 2.2, focus.z + Math.cos(angle + yaw) * 7);
        g.camera.fov = 42; g.camera.lookAt(focus.x, focus.y + .45, focus.z); g.camera.updateProjectionMatrix();
      }
      return render(...args);
    };
    window.startRunReview = angle => {
      r.start('race', 0); r.phase = 'running'; r.elapsed = 4;
      const c = r.carts; c.drive = () => ({ moveX: 0, moveY: 0 });
      for (const [index, offset] of [[0, 14], [1, 0]]) {
        const q = r.course.sample(45, offset), v = c.fleet.physics.carts[index];
        Object.assign(v, { x: q.x, y: c.ground(q.x, q.z).height, z: q.z, yaw: 0, vx: 0, vy: 0, vz: 0, speed: 0, grounded: true });
      }
      c.sync(); c.present(1); c.exit(0, false); c.actionCooldown[0] = 0; c.locked[1] = 0;
      const p = r.riders[0].player; p.resetRacePosition(r.level, c.exitPoint(1, 1), p.raceHeading, true);
      window.runReview.angle = angle;
      if (!c.interact(0) || c.interactions[0].cart !== 1) throw new Error('Run review did not target the rival');
      return c.interactions[0].approach;
    };
  });
  for (const angle of [0, 40, 90]) {
    const approach = await page.evaluate(angle => window.startRunReview(angle), angle);
    assert.ok(approach > 1, 'fixture must cover more than a complete run cycle');
    await page.waitForTimeout(280); await shot(`run-${angle}`);
    await page.waitForFunction(() => window.__game.getSkateRace().carts.cartForRacer[0] === 1, null, { timeout: 10000 });
    await shot(`seated-${angle}`);
    await page.evaluate(() => { window.__game.getSkateRace().carts.actionCooldown[0] = 0; });
    await page.keyboard.press('KeyE'); await page.waitForTimeout(650); await shot(`exit-${angle}`);
    await page.waitForFunction(() => !window.__game.getSkateRace().carts.isDriving(0), null, { timeout: 5000 });
  }
  await page.evaluate(() => { window.__game.renderQualitySettings.setRegularResolution(720); window.startRunReview(40); });
  await page.waitForTimeout(280); await shot('normal-720p');
  await page.waitForFunction(() => window.__game.getSkateRace().carts.cartForRacer[0] === 1, null, { timeout: 10000 });
  const report = await page.evaluate(() => ({ stamp: document.querySelector('.hud-build')?.textContent,
    glError: window.__game.renderer.getContext().getError(), frames: window.runReview.frames }));
  for (const angle of [0, 40, 90]) {
    const running = report.frames.filter(f => f.angle === angle && f.age < f.approach);
    assert.ok(running.length > 50, `${angle}: missing continuous run evidence`);
    assert.ok(running.every(f => f.locomotion.clipId === 'player.run' && f.locomotion.weight === 1 && Math.abs(f.age - f.locomotion.seconds) < 1e-5));
    assert.ok(running.every(f => f.scale.every(v => Number.isFinite(v) && v > 0)));
    assert.ok(new Set(running.map(f => f.hips.map(v => v.toFixed(3)).join(','))).size > 20, 'run stayed static');
  }
  assert.match(report.stamp, /Codex\/sol fork/); assert.equal(report.glError, 0); assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ full, ...report, errors }, null, 2) + '\n');
  console.log('PASS', JSON.stringify({ full, stamp: report.stamp, continuousFrames: report.frames.length, angles: [0, 40, 90], glError: report.glError }));
} catch (error) { await shot('failure'); console.log('ERRORS', errors); throw error; }
finally { await context.close(); await browser.close(); }
