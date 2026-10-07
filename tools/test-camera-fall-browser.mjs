// Exercise the normal game entry and real player gravity in an isolated
// browser save. Works against a dev server or the published Pages bundle.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5297/';
const output = process.env.CAMERA_FALL_OUTPUT || '/private/tmp/camera-fall-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], reports = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const url = new URL(base); url.search = `?playtest&level=codex-lab${lite ? '&lite' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    for (const mode of ['corridor', 'partial-follow', 'full-follow', 'chase', 'authored', 'split']) {
      await page.evaluate(mode => {
        const g = window.__game;
        g.set2P(false); g.gameFlow.hide();
        const data = { v: 1, name: `Camera fall ${mode}`, spawn: [0, 8.1, 0], killY: -35,
          cameraAirLift: mode === 'full-follow' ? 1 : mode === 'partial-follow' ? .8 : 0,
          components: [
            { t: 'platform', p: [0, 7.5, 0], s: [12, 1, 32] },
            { t: 'platform', p: [14, -.5, 0], s: [12, 1, 32] },
            { t: 'gate', p: [0, 8, -12] },
          ] };
        if (mode === 'authored') data.components.push({ t: 'camnode', cameraView: true,
          p: [0, 0, 0], s: [120, 160, 120], yaw: 0, radius: 2,
          cameraPosition: [0, 16, 14], cameraTarget: [0, 9, 0], cameraFollowDistance: 10 });
        const id = g.saveUserLevel({ id: '', name: data.name, data });
        if (!id || !g.switchLevel(id)) throw Error('Could not load isolated fall fixture');
        g.gameFlow.hide(); g.TUNING.chaseCam = mode === 'chase' ? 1 : 0;
        if (mode === 'split') g.set2P(true, true);
        const p = mode === 'split' ? g.getP2() : g.player, level = g.getLevel();
        const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
          grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false, grabHeld: false,
          grabPressed: false, transferHeld: false, transferPressed: false, inventoryHeld: true };
        const native = p.__fallNativeStep || p.step.bind(p); p.__fallNativeStep = native;
        const state = { samples: [], direction: 0, deaths: 0, respawned: false, active: true, p,
          initialSnap: p.renderSnapVersion, lower: false };
        p.step = (dt, input, level) => {
          // Use the normal charged jump to clear the protective teeter catch.
          if (state.jumpAge < 0 && state.direction && Math.abs(p.pos.x) > 3) state.jumpAge = 0;
          const charging = state.jumpAge >= 0 && state.jumpAge < .5;
          if (charging) state.jumpAge += dt;
          native(dt, { ...neutral, moveX: state.direction,
            jumpHeld: charging && state.jumpAge < .5, jumpReleased: charging && state.jumpAge >= .5 }, level);
        };
        const place = () => {
          p.respawn(level, true, true, { position: p.pos.clone().set(0, 8.05, 0), heading: p.pos.clone().set(0, 0, -1) });
          p.lives = 5; p.freeSkate = true; p.speed = 0;
          state.jumpAge = -1;
          state.initialSnap = p.renderSnapVersion;
        };
        place();
        if (window.__fallProbe) window.__fallProbe.active = false;
        window.__fallProbe = state;
        const sample = () => {
          if (!state.active) return;
          const c = p.cam;
          state.samples.push({ y: p.pos.y, x: p.pos.x, grounded: p.grounded, state: p.state,
            floor: p.groundBelowY, snap: p.renderSnapVersion, eye: c.position.toArray(),
            rotation: c.quaternion.toArray(), fov: c.fov });
          if (p.state === 'dead') { state.deaths++; state.direction = 0; }
          if (state.deaths && p.state !== 'dead' && p.renderSnapVersion !== state.initialSnap) state.respawned = true;
          requestAnimationFrame(sample);
        };
        state.place = place; sample();
      }, mode);
      await page.waitForFunction(() => window.__fallProbe.p.grounded);
      await page.waitForTimeout(300);
      await page.evaluate(() => { window.__fallProbe.direction = -1; });
      await page.waitForFunction(() => window.__fallProbe.p.pos.y < 0 && window.__fallProbe.p.state === 'air');
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${mode}-fall.png` });
      await page.waitForFunction(() => window.__fallProbe.respawned, null, { timeout: 12000 });
      await page.waitForFunction(() => window.__fallProbe.p.grounded);
      const result = await page.evaluate(() => {
        const s = window.__fallProbe;
        const result = { samples: s.samples, respawn: { grounded: s.p.grounded, y: s.p.pos.y, eye: s.p.cam.position.toArray() } };
        s.samples = []; s.deaths = 0; s.respawned = false; s.lower = true; s.place();
        return result;
      });
      const falling = result.samples.filter(s => s.state === 'air' && s.y < 7.5);
      assert.ok(falling.length > 15 && falling.at(-1).y < -25, `${mode}: did not exercise a deep fall`);
      const shot = falling[0];
      for (const sample of falling) {
        assert.deepEqual(sample.eye, shot.eye, `${mode}: camera moved down the void`);
        assert.deepEqual(sample.rotation, shot.rotation, `${mode}: camera aimed after the falling body`);
        assert.equal(sample.fov, shot.fov, `${mode}: held lens drifted`);
      }
      assert.ok(shot.eye[1] > 8, `${mode}: held shot is below the floor`);
      assert.ok(result.respawn.grounded && Math.abs(result.respawn.y - 8) < .1);
      assert.ok(result.respawn.eye[1] > 8, `${mode}: respawn camera stayed underground`);
      // Walk off the other side onto the lower shelf. It is a real landing,
      // so the camera must descend and regain support without a death.
      await page.waitForFunction(() => window.__fallProbe.p.grounded);
      await page.evaluate(() => { window.__fallProbe.direction = 1; });
      await page.waitForFunction(() => {
        const s = window.__fallProbe;
        if (s.p.pos.x > 12) s.direction = 0;
        return s.p.grounded && s.p.pos.y < 1;
      }, null, { timeout: 12000 });
      await page.waitForTimeout(400);
      const lower = await page.evaluate(() => {
        const s = window.__fallProbe; s.active = false;
        return { y: s.p.pos.y, eyeY: s.p.cam.position.y, deaths: s.deaths, floor: s.p.groundBelowY };
      });
      assert.equal(lower.deaths, 0); assert.ok(lower.eyeY < result.respawn.eye[1] - 3, `${mode}: lower landing camera stayed frozen`);
      reports.push({ lite, mode, stamp, heldFrames: falling.length, deepestY: falling.at(-1).y, shot, respawn: result.respawn, lower });
      console.log(`${lite ? 'lite' : 'full'} ${mode}: held ${falling.length} fall frames, respawn and lower landing pass`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, reports, errors }, null, 2));
  await browser.close();
}
console.log(`PASS camera void hold in all camera modes, real gravity, respawn and lower landings; clean consoles. ${output}`);
