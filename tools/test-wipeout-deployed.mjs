// Uses only the normal bundled game and its existing debug handle. No source
// module/review-page dependency, so this also verifies the public Pages build.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2];
assert.ok(base, 'Usage: node tools/test-wipeout-deployed.mjs <deployment URL>');
const output = process.env.WIPEOUT_DEPLOY_OUTPUT || '/private/tmp/wipeout-deployed';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-features=LocalNetworkAccessChecks'] });
const evidence = [], errors = [];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const url = new URL(base); url.search = `?playtest&level=bone-yard${lite ? '&lite' : ''}`;
    await page.goto(url.href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const g = window.__game; await Promise.all([g.player.preparePresentationAssets(), g.getLevel().prepareJungleAssets()]);
    });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game, p = g.player, level = g.getLevel();
      g.campaign.startEphemeral(); g.gameFlow.hide(); p.onDeath = () => {};
      const native = p.step.bind(p), update = level.update.bind(level);
      const neutral = { moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
        grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false, grabHeld: false,
        grabPressed: false, transferHeld: false, transferPressed: false, inventoryHeld: true };
      p.step = () => {}; level.update = () => {};
      level.crate(2, 0, -20, 'tnt', { noAuto: true }); const tnt = level.crates.at(-1);
      level.crusher(0, 0, -40, 3, 3, 3.2); const crusher = level.crushers.at(-1);
      const anchor = p.pos.clone(), render = g.renderer.render.bind(g.renderer);
      g.renderer.render = (...args) => {
        if (args[1] === g.camera) {
          g.camera.position.copy(anchor).add({ x: 8, y: 5, z: 6 });
          g.camera.fov = 45; g.camera.lookAt(anchor); g.camera.updateProjectionMatrix();
        }
        return render(...args);
      };
      const tick = () => { native(1 / 60, neutral, level); update(1 / 60); p.commitRenderStep(level); };
      window.__wipeoutDeployed = {
        run(name) {
          const wall = name === 'wall', trip = name === 'trip';
          const pos = p.pos.clone().set(wall ? -7 : trip ? 7 : 0, .04, name === 'crush' ? -40 : -20);
          p.respawn(level, true, true, { position: pos, heading: pos.clone().set(0, 0, -1) });
          p.lives = 4; p.masks = name === 'protected-blast' ? 1 : 0; p.invulnTimer = p.uberTimer = 0;
          crusher.phase = -level.time; update(0); tick(); p.rawInput = neutral;
          anchor.copy(pos).add({ x: 0, y: .8, z: wall || trip ? -9 : 0 });
          p.freeSkate = wall || trip || name === 'balance'; p.speed = wall || trip ? 24 : name === 'balance' ? 10 : 0;
          if (name === 'balance') p.bail(false, 10, 'balance');
          if (name === 'pvp') p.beginPvpKnockdown(5, 1);
          if (name === 'blast' || name === 'protected-blast') level.detonate(tnt);
          if (name === 'crush') { crusher.phase = .38 * crusher.cycle - level.time; update(0); }
          if (name === 'contact') p.die('contact');
          let incident = 0, maxProbes = 0;
          for (let i = 0; i < 150; i++) {
            tick(); const d = p.breakApartDiagnostics; maxProbes = Math.max(maxProbes, d?.probesThisStep ?? 0);
            if (p.isBailing || p.state === 'dead' || name === 'protected-blast' && p.masks === 0) incident++;
            if (incident >= 21) break;
          }
          const row = { name, state: p.state, lives: p.lives, masks: p.masks, bailing: p.isBailing,
            active: false, ...p.breakApartDiagnostics, maxProbes };
          return row;
        },
        recover() {
          for (let i = 0; i < 360 && (p.isBailing || p.breakApartDiagnostics?.active); i++) tick();
          return { state: p.state, lives: p.lives, active: Boolean(p.breakApartDiagnostics?.active), bailing: p.isBailing,
            finite: p.animationRig.joints.every(j => [...j.node.position.toArray(), ...j.node.scale.toArray()].every(Number.isFinite)) };
        },
      };
    });
    for (const [name, style] of [['balance', null], ['pvp', null], ['wall', 'head-pop'], ['trip', 'waist-split'],
      ['protected-blast', null], ['contact', null], ['blast', 'blast'], ['crush', 'crush']]) {
      const row = await page.evaluate(name => window.__wipeoutDeployed.run(name), name);
      assert.equal(row.active, Boolean(style), name); if (style) assert.equal(row.style, style, name);
      assert.ok(row.maxProbes <= 2, name);
      if (['contact', 'blast', 'crush'].includes(name)) { assert.equal(row.state, 'dead'); assert.equal(row.lives, 3); }
      if (name === 'protected-blast') { assert.notEqual(row.state, 'dead'); assert.equal(row.masks, 0); }
      await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-${name}.png` });
      const recovered = await page.evaluate(() => window.__wipeoutDeployed.recover());
      assert.notEqual(recovered.state, 'dead'); assert.equal(recovered.active, false); assert.equal(recovered.bailing, false);
      assert.equal(recovered.finite, true); if (['contact', 'blast', 'crush'].includes(name)) assert.equal(recovered.lives, 3);
      evidence.push({ lite, stamp, ...row, recovered });
      console.log(`${lite ? 'lite' : 'full'} ${name}: ${style ?? 'intact'}, restored`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally { await writeFile(`${output}/results.json`, JSON.stringify({ base, evidence, errors }, null, 2)); await browser.close(); }
console.log(`PASS deployed normal entry: ${evidence.length} cases, source stamp, actual TNT/crusher, one life, recall/respawn and clean console. ${output}`);
