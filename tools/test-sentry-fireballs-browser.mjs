import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5296/';
const output = process.env.FIREBALL_OUTPUT || '/private/tmp/sentry-fireballs-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], evidence = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => { navigator.getGamepads = () => []; });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(new URL(`?playtest&level=codex-lab${lite ? '&lite' : ''}`, base).href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const g = window.__game;
      const id = g.saveUserLevel({ id: '', name: 'Sentry fireball QA', data: {
        v: 1, name: 'Sentry fireball QA', startWarpPad: false, spawn: [0, 0.1, 10], killY: -20,
        components: [
          { t: 'platform', p: [0, -0.5, -15], s: [30, 1, 75], color: '#45594c' },
          { t: 'enemy', foe: 'sentry', p: [0, 0, 0], range: 0, speed: 0 },
          { t: 'checkpoint', p: [0, 0, -12] },
          { t: 'gate', p: [0, 0, -45] },
        ],
      } });
      if (!id || !g.switchLevel(id)) throw new Error('Cannot open sentry fireball fixture');
      await Promise.all([g.player.preparePresentationAssets(), g.getLevel().prepareJungleAssets()]);
      const level = g.getLevel(), player = g.player;
      level.setRunModesEnabled(false);
      const nativeStep = player.step.bind(player), nativeUpdate = level.update.bind(level);
      player.step = () => {}; level.update = () => {};
      level.reset(true);
      player.pos.set(0, 0.05, 10); player.prevPos.copy(player.pos);
      level.playerPos.copy(player.pos);
      level.clearProjectiles();
      const sentry = level.enemies[0]; sentry.state = 'track'; sentry.stateT = 0;
      // Exercise the actual track -> charge -> fire state machine and authored muzzle.
      for (let i = 0; i < 180 && !level.projectiles.length; i++) nativeUpdate(1 / 60);
      window.__fireballQA = { level, player, sentry, nativeStep, nativeUpdate };
    });
    const row = await page.evaluate(() => {
      const { level, sentry } = window.__fireballQA, shot = level.projectiles[0];
      if (!shot) throw new Error(`Sentry did not fire: ${JSON.stringify({ state: sentry.state, time: sentry.stateT, alive: sentry.alive,
        player: level.playerPos.toArray(), enemy: sentry.group.position.toArray() })}`);
      const origin = shot.mesh.position.clone();
      const q = shot.mesh.quaternion.clone();
      level.updateProjectiles(0.1);
      const distance = origin.distanceTo(shot.mesh.position);
      level.updateProjectiles(0.24);
      window.__fireballQA.shot = shot;
      window.__fireballQA.anchor = shot.mesh.position.clone();
      return { speed: shot.vel.length(), distance, name: shot.mesh.name,
        parts: [shot.mesh.name, ...shot.mesh.children.map(m => m.name)],
        hitbox: shot.box.getSize(origin).toArray(),
        directionStable: q.angleTo(shot.mesh.quaternion) < 1e-6,
        model: sentry.visual.diagnostics.status,
        stamp: document.querySelector('.hud-build')?.textContent };
    });
    assert.equal(row.speed, 10.5); assert.ok(Math.abs(row.distance - 1.05) < 1e-6);
    assert.equal(row.parts.length, 3); assert.equal(row.directionStable, true);
    assert.equal(row.model, 'ready'); assert.match(row.name, /Gouraud/);
    assert.match(row.stamp, /Codex\/sol fork/);
    row.hitbox.forEach(v => assert.ok(Math.abs(v - 0.7) < 1e-6));
    // Freeze gameplay only for inspection; all captures use the game's renderer,
    // including its full production postprocessing on the second pass.
    await page.evaluate(() => {
      const g = window.__game, qa = window.__fireballQA;
      const render = g.renderer.render.bind(g.renderer);
      qa.originalRender = render; qa.originalFov = g.camera.fov;
      qa.view = { x: 3.2, y: 1.3, z: 3.2 };
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(qa.anchor).add(qa.view);
          g.camera.fov = 45; g.camera.lookAt(qa.anchor); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
    });
    for (const [view, offset] of [
      ['quarter', { x: 3.2, y: 1.3, z: 3.2 }],
      ['side', { x: 3.2, y: 0.8, z: 0 }],
      ['head-on', { x: 0, y: 0.3, z: 3.5 }],
    ]) {
      await page.evaluate(offset => { window.__fireballQA.view = offset; }, offset);
      await page.waitForTimeout(180);
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${view}.png` });
    }
    const contact = await page.evaluate(() => {
      const { level, player, shot, nativeStep, sentry } = window.__fireballQA;
      let disposed = 0;
      shot.mesh.traverse(m => {
        if (m.geometry) m.geometry.addEventListener('dispose', () => disposed++);
        if (m.material) m.material.addEventListener('dispose', () => disposed++);
      });
      player.pos.copy(shot.mesh.position); player.pos.y = 0.03;
      player.prevPos.copy(player.pos); player.masks = 1;
      player.invulnTimer = player.uberTimer = 0;
      const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false,
        jumpReleased: false, grindHeld: false, grindPressed: false, spinHeld: false,
        spinPressed: false, grabHeld: false, grabPressed: false, transferHeld: false,
        transferPressed: false, inventoryHeld: true };
      nativeStep(1 / 60, neutral, level);
      const hit = { masks: player.masks, remaining: level.projectiles.length, disposed, state: player.state };
      const from = player.pos.clone().set(0, 1, 0), target = from.clone().set(0, 1, 10);
      level.spawnProjectile(sentry, from, target);
      level.reset(true);
      hit.afterReset = level.projectiles.length;
      level.spawnProjectile(sentry, from, target);
      level.killEnemy(sentry);
      hit.afterDefeat = level.projectiles.length;
      hit.glError = window.__game.renderer.getContext().getError();
      return hit;
    });
    assert.equal(contact.masks, 0); assert.equal(contact.remaining, 0);
    assert.equal(contact.disposed, 6); assert.notEqual(contact.state, 'dead');
    assert.equal(contact.afterReset, 0); assert.equal(contact.afterDefeat, 0);
    assert.equal(contact.glError, 0);
    await page.evaluate(() => {
      const g = window.__game, qa = window.__fireballQA;
      qa.player.step = qa.nativeStep; qa.level.update = qa.nativeUpdate;
      g.renderer.render = qa.originalRender;
      g.camera.fov = qa.originalFov; g.camera.updateProjectionMatrix();
    });
    await page.waitForFunction(() => window.__game.player.grounded && !window.__game.input.menuReleaseGuard);
    const start = await page.evaluate(() => window.__game.player.pos.toArray());
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(450); await page.keyboard.up('ArrowUp');
    const end = await page.evaluate(() => window.__game.player.pos.toArray());
    assert.ok(Math.hypot(end[0] - start[0], end[2] - start[2]) > 0.2, 'native traversal did not move');
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(0, 2, -12); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
    });
    await page.waitForFunction(() => window.__game.getLevel().activeCheckpoint !== null && window.__game.player.grounded);
    const snap = await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(30, 2, -12); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
      return p.renderSnapVersion;
    });
    await page.waitForFunction(() => window.__game.player.state === 'dead');
    await page.waitForFunction(s => {
      const p = window.__game.player;
      return p.grounded && p.state !== 'dead' && p.renderSnapVersion !== s;
    }, snap);
    await page.evaluate(() => {
      const p = window.__game.player; p.pos.set(0, 1.4, -45); p.prevPos.copy(p.pos); p.vVel = 0; p.grounded = false;
    });
    await page.waitForFunction(() => window.__game.player.state === 'finished' || window.__game.gameFlow.blocksGameplay);
    row.levelFlow = 'supported spawn, native traversal, checkpoint, pit respawn, finish';
    evidence.push({ lite, ...row, contact });
    console.log(`PASS ${lite ? 'lite' : 'full'}: real sentry/muzzle, 10.5 m/s, three views, mask contact, disposal, checkpoint, pit respawn and finish.`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, evidence, errors }, null, 2));
  await browser.close();
}
console.log(`PASS clean browser console. Evidence: ${output}`);
