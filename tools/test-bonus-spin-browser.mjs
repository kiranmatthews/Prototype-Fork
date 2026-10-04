import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5173/';
const output = process.env.SPIN_TEST_OUT || '/private/tmp/bonus-spin-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], retiredRequests = [];
const watch = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/whirlwind-vixen/.test(request.url())) retiredRequests.push(request.url()); });
};
const fingerprint = root => {
  let hash = 2166136261, vertices = 0, skins = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) skins++;
    const position = object.geometry.attributes.position;
    vertices += position.count;
    for (const value of position.array) hash = Math.imul(hash ^ Math.round(value * 1e5), 16777619);
  });
  return { hash: hash >>> 0, vertices, skins };
};
const fingerprintCode = fingerprint.toString();
const readyGame = page => page.waitForFunction(() => window.__game?.player.spinEffectDiagnostics?.assetReady &&
  !window.__game.gameFlow.blocksGameplay, null, { timeout: 90000 });
const readyLab = page => page.waitForFunction(() => window.__spinLab?.ready, null, { timeout: 90000 });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  context.setDefaultNavigationTimeout(90000);
  const game = await context.newPage(); watch(game);
  await game.goto(base + '?playtest&level=jungle&lite'); await readyGame(game);
  const lab = await context.newPage(); watch(lab);
  await lab.goto(base + 'spin-lab.html'); await readyLab(lab);
  const initial = await lab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode);
  await lab.getByRole('spinbutton', { name: 'Radial smear value', exact: true }).fill('340');
  await lab.waitForFunction(() => window.__spinLab.settings.sweepDegrees === 340);
  assert.deepEqual(await lab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode), initial,
    'draft edits updated the gameplay bake before Bake was pressed');
  await lab.getByRole('button', { name: 'Bake updated model', exact: true }).click();
  await lab.waitForFunction(() => window.__spinLab.bakeCount === 1, null, { timeout: 90000 });
  assert.match(await lab.locator('#lab-status').textContent(), /Baked and saved/);
  const baked = await lab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode);
  assert.notEqual(baked.hash, initial.hash); assert.equal(baked.skins, 0);
  await game.waitForFunction(() => window.__game.player.spinEffectDiagnostics.modelSource === 'baked');
  assert.deepEqual(await game.evaluate(code => eval('(' + code + ')')(window.__game.player.spinEffects.sculpture), fingerprintCode), baked,
    'the open game did not receive the lab bake');
  await lab.waitForTimeout(250);
  assert.deepEqual(await lab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode), baked,
    'spinning changed static vertices');
  await lab.screenshot({ path: output + '/lab-desktop.png' });
  const downloadEvent = lab.waitForEvent('download', { timeout: 90000 }).catch(async error => {
    throw new Error(`${error.message}; lab status: ${await lab.locator('#lab-status').textContent()}; console: ${errors.join('; ')}`);
  });
  await lab.getByRole('button', { name: 'Download baked GLB', exact: true }).click();
  const download = await downloadEvent; await download.saveAs(output + '/character-spin-smear.glb');
  const bytes = await readFile(output + '/character-spin-smear.glb');
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.ok(!gltf.skins?.length && !gltf.animations?.length, 'the exported spin model retains a rig or animation');
  assert.ok(gltf.images?.every(image => !image.uri), 'the bake depends on external texture URLs');
  await lab.reload(); await readyLab(lab);
  assert.equal(await lab.evaluate(() => window.__spinLab.settings.sweepDegrees), 340);
  assert.deepEqual(await lab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode), baked,
    'reload lost the baked geometry');
  for (const viewport of [{ width: 390, height: 844 }, { width: 568, height: 320 }]) {
    await lab.setViewportSize(viewport); await lab.waitForTimeout(150);
    const layout = await lab.evaluate(() => {
      const r = document.querySelector('#bake-model').getBoundingClientRect(), region = document.querySelector('.edit-region');
      return { bakeVisible: r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
        controlRegionHeight: region.clientHeight, pageScroll: document.scrollingElement.scrollTop };
    });
    assert.equal(layout.bakeVisible, true); assert.ok(layout.controlRegionHeight > 30); assert.equal(layout.pageScroll, 0);
    await lab.screenshot({ path: `${output}/lab-${viewport.width}x${viewport.height}.png` });
  }
  await lab.close();
  await game.bringToFront();
  await game.keyboard.down('KeyF');
  await game.waitForFunction(() => window.__game.player.spinEffectDiagnostics.sculptureVisible && !window.__game.player.bodyGroup.visible);
  await game.screenshot({ path: output + '/spin-lite.png' }); await game.keyboard.up('KeyF');

  // The real production detour returns and banks a checkpoint; falling below
  // killY exercises the game's death and respawn path, not a test-only reset.
  const expected = await game.evaluate(() => {
    const g = window.__game, p = g.player, l = g.getLevel();
    const crate = l.crates.find(c => c.alive && !c.bang && !c.nitroBang);
    l.breakCrate(crate); p.cratesBroken++;
    const result = { point: l.bonusReturnPoint().toArray(), count: p.cratesBroken,
      crate: l.crates.indexOf(crate), previous: l.activeCheckpoint?.spawnPos.toArray() ?? null };
    g.enterBonusRound(); return result;
  });
  await game.waitForFunction(() => window.__game.getCurrentLevel().id.startsWith('bonus:') && !window.__game.gameFlow.transitionActive,
    null, { timeout: 90000 });
  await game.evaluate(() => { const g = window.__game; g.player.cratesBroken = g.getLevel().totalCrates; g.returnFromBonus(true); });
  await game.waitForFunction(() => window.__game.getCurrentLevel().id === 'jungle' && !window.__game.gameFlow.transitionActive,
    null, { timeout: 90000 });
  assert.deepEqual(await game.evaluate(() => window.__game.getLevel().currentSpawn.toArray()), expected.point);
  await game.evaluate(() => { const p = window.__game.player; p.pos.y = -100; p.vVel = -20; });
  await game.waitForFunction(() => window.__game.player.state === 'dead', null, { timeout: 15000 });
  await game.waitForFunction(point => {
    const g = window.__game; return g.player.state !== 'dead' && g.player.pos.distanceTo(g.getLevel().currentSpawn) < .5 &&
      g.player.pos.distanceTo({ x: point[0], y: point[1], z: point[2] }) < .5;
  }, expected.point, { timeout: 30000 });
  const restored = await game.evaluate(index => ({ count: window.__game.player.cratesBroken,
    alive: window.__game.getLevel().crates[index].alive, completed: window.__game.getLevel().bonusRoundCompleted }), expected.crate);
  assert.deepEqual(restored, { count: expected.count, alive: false, completed: true });
  await game.waitForTimeout(400);
  await game.screenshot({ path: output + '/bonus-respawn.png' });
  await game.close();

  const full = await context.newPage(); watch(full);
  await full.goto(base + '?playtest&level=codex-lab'); await readyGame(full);
  assert.equal(await full.evaluate(() => window.__game.player.spinEffectDiagnostics.modelSource), 'baked');
  await full.keyboard.down('KeyF'); await full.waitForFunction(() => window.__game.player.spinEffectDiagnostics.sculptureVisible);
  await full.screenshot({ path: output + '/spin-full.png' }); await full.keyboard.up('KeyF');
  await full.close();

  const menuContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true, isMobile: true });
  menuContext.setDefaultNavigationTimeout(90000);
  const menu = await menuContext.newPage(); watch(menu);
  await menu.goto(base + 'menu-review.html?playtest&level=codex-lab&lite');
  await menu.waitForFunction(() => window.__menuReview && !window.__game.gameFlow.transitionActive, null, { timeout: 90000 });
  await menu.locator('[aria-label="Review prompts"]').selectOption('touch');
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }, { width: 1024, height: 768 },
    { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 320, height: 568 }]) {
    await menu.setViewportSize(viewport); await menu.evaluate(() => window.__menuReview.show('launch')); await menu.waitForTimeout(150);
    const layout = await menu.evaluate(() => ({ audit: window.__menuReview.audit(),
      rows: [...document.querySelectorAll('.game-launch-card .game-menu-button')].map(button => ({ text: button.textContent,
        x: button.getBoundingClientRect().x, y: button.getBoundingClientRect().y })),
      offlineText: document.querySelector('.game-launch-card .game-offline-status')?.textContent ?? '' }));
    assert.deepEqual(layout.audit.problems, [], `${viewport.width}x${viewport.height} home layout`);
    assert.ok(layout.rows.length >= 3);
    for (let i = 1; i < layout.rows.length; i++) {
      assert.ok(Math.abs(layout.rows[i].x - layout.rows[0].x) < 2, 'home splits into columns');
      assert.ok(layout.rows[i].y > layout.rows[i - 1].y, 'home actions do not form a vertical list');
    }
    assert.ok(layout.rows.every(row => !/SAVE OFFLINE/.test(row.text))); assert.equal(layout.offlineText, '');
    await menu.screenshot({ path: `${output}/home-${viewport.width}x${viewport.height}.png` });
  }
  await menuContext.close();
  // All game tabs are closed so pending autosaves cannot race the reset.
  const reset = await context.newPage(); watch(reset);
  await reset.goto(base + 'reset-local-data.html');
  await reset.locator('#confirm-reset').check(); await reset.locator('#reset').click();
  await reset.waitForFunction(() => document.querySelector('#status').dataset.resetComplete, null, { timeout: 30000 });
  assert.equal(await reset.locator('#status').getAttribute('data-reset-complete'), 'true', await reset.locator('#status').textContent());
  assert.deepEqual(await reset.evaluate(async () => {
    const { browserResetDependencies } = await import('/src/localGameDataReset.ts');
    const deps = browserResetDependencies(), backup = await deps.recovery.read();
    return { current: (await deps.spinModels.read()).length, backup: backup.spinModels.length,
      bytes: backup.spinModels[0].glb.byteLength > 1000 };
  }), { current: 0, backup: 1, bytes: true }, 'Reset did not back up and clear the baked binary');
  await reset.locator('#confirm-undo').check(); await reset.locator('#undo').click();
  await reset.waitForFunction(() => document.querySelector('#status').dataset.resetComplete === 'restored');
  const restoredLab = await context.newPage(); watch(restoredLab);
  await restoredLab.goto(base + 'spin-lab.html'); await readyLab(restoredLab);
  assert.deepEqual(await restoredLab.evaluate(code => eval('(' + code + ')')(window.__spinLab.production.sculpture), fingerprintCode), baked,
    'Undo did not restore the exact overlapping spin bake');
  await context.close();
  assert.deepEqual(retiredRequests, []); assert.deepEqual(errors, []);
  console.log(`PASS draft/bake separation, open-game update, static overlapping GLB, reload/reset/undo persistence, mobile authoring, lite/full real spins, real bonus death/respawn and seven home layouts; evidence ${output}`);
} finally { await browser.close(); }
