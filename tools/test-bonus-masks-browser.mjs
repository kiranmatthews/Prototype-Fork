// Runs against a production preview or GitHub Pages, with real entry/exit fades.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2] || 'http://127.0.0.1:5349/';
const output = process.env.BONUS_MASK_OUTPUT || '/private/tmp/bonus-mask-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reports = [], errors = [];
const cases = [
  { name: 'empty-clear', count: 0, action: 'keep', expected: 0 },
  { name: 'single-clear', count: 1, action: 'keep', expected: 1 },
  { name: 'spent-clear', count: 2, action: 'spend', expected: 0 },
  { name: 'earned-clear', count: 0, action: 'pickup', expected: 1 },
  { name: 'uber-clear', count: 3, action: 'keep', expected: 2 },
  { name: 'expired-clear', count: 3, action: 'expire', expected: 2 },
  { name: 'spent-death', count: 2, action: 'spend', expected: 0, death: true },
  { name: 'uber-death', count: 3, action: 'keep', expected: 2, death: true },
];
try {
  for (const lite of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}?playtest&level=codex-lab${lite ? '&lite' : ''}`);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    const stamp = await page.locator('.hud-build').textContent();
    assert.match(stamp, /Codex\/sol fork/);
    await page.evaluate(() => {
      const g = window.__game;
      const data = { v: 1, name: 'Bonus mask continuity', spawn: [0, .1, 5], killY: -12, startWarpPad: false,
        components: [
          { t: 'platform', p: [0, -.5, -5], s: [24, 1, 40] },
          { t: 'checkpoint', p: [-6, 0, 5] },
          { t: 'bonusplatform', p: [6, 0, 0], to: [0, .1, 0] },
          { t: 'wall', p: [10, 1, -5], s: [1, 2, 8] },
          { t: 'gate', p: [0, 0, -18] },
        ],
      };
      window.__maskParent = g.saveUserLevel({ id: '', name: data.name, data });
      const resume = g.player.resumeSuspendedLevel.bind(g.player);
      g.player.resumeSuspendedLevel = (...args) => {
        const before = { masks: g.player.masks, uber: g.player.uberTimer };
        resume(...args);
        window.__maskReturn = { before, after: { masks: g.player.masks, uber: g.player.uberTimer } };
      };
    });
    const ready = () => page.waitForFunction(() => !window.__game.gameFlow.blocksGameplay &&
      window.__game.player.grounded && window.__game.player.state === 'ride', null, { timeout: 120000 });
    for (const test of cases) {
      await page.evaluate(count => {
        const g = window.__game, p = g.player;
        g.switchLevel(window.__maskParent); g.gameFlow.hide();
        const l = g.getLevel();
        l.activateCheckpoint(l.checkpoints[0], 0, p.fruit, 2, 0);
        for (let i = 0; i < count; i++) p.gainMask();
        window.__maskReturn = null;
        window.__maskEntry = { masks: p.masks, uber: p.uberTimer };
        g.enterBonusRound(true);
      }, test.count);
      await page.waitForFunction(() => window.__game.getCurrentLevel().id.startsWith('bonus:') &&
        !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
      const entered = await page.evaluate(() => ({ masks: window.__game.player.masks, uber: window.__game.player.uberTimer }));
      assert.equal(entered.masks, Math.min(2, test.count), `${test.name}: entry mask count`);
      assert.equal(entered.uber > 0, test.count === 3, `${test.name}: entry invincibility`);
      await page.evaluate(action => {
        const g = window.__game, p = g.player;
        if (action === 'spend') { p.uberTimer = 0; while (p.spendMask()) {} }
        if (action === 'pickup') p.smashCrate(g.getLevel(), g.getLevel().crates.find(c => c.mask));
        if (action === 'expire') p.uberTimer = .01;
      }, test.action);
      if (test.action === 'expire') await page.waitForFunction(() => window.__game.player.uberTimer === 0);
      await page.evaluate(death => {
        const g = window.__game, p = g.player, l = g.getLevel();
        if (death) p.pos.set(999, l.killY - 4, 999);
        else l.finishGlow.getCenter(p.pos);
        p.prevPos.copy(p.pos); p.speed = p.vVel = 0; p.walkVelocity.set(0, 0, 0); p.grounded = false;
      }, !!test.death);
      await page.waitForFunction(() => window.__maskReturn && window.__game.getCurrentLevel().id === window.__maskParent &&
        !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
      await ready();
      const result = await page.evaluate(() => {
        const g = window.__game, p = g.player, l = g.getLevel();
        return { transition: window.__maskReturn, masks: p.masks, uber: p.uberTimer,
          checkpointMasks: l.activeCheckpoint.savedMasks, completed: l.bonusRoundCompleted,
          visible: p.maskMesh.visible, crossbones: !!p.maskBones?.visible };
      });
      assert.deepEqual(result.transition.after, result.transition.before, `${test.name}: transition changed protection`);
      assert.equal(result.masks, test.expected, test.name);
      assert.equal(result.completed, !test.death);
      assert.equal(result.checkpointMasks, test.death ? 2 : test.expected);
      assert.equal(result.uber > 0, test.count === 3 && test.action !== 'expire' && !test.death);
      assert.equal(result.visible, test.expected > 0);
      if (test.name === 'spent-clear') {
        await page.screenshot({ path: `${output}/${lite ? 'lite' : 'full'}-empty-return.png` });
        // A later parent death must restore the new zero-mask checkpoint.
        await page.evaluate(() => {
          const g = window.__game, p = g.player;
          p.pos.set(999, g.getLevel().killY - 4, 999); p.grounded = false;
        });
        await page.waitForFunction(() => window.__game.player.state === 'dead');
        await ready();
        assert.equal(await page.evaluate(() => window.__game.player.masks), 0);
      }
      reports.push({ lite, test: test.name, stamp, entered, result });
      console.log(`PASS ${lite ? 'lite' : 'full'} ${test.name}: ${result.masks} masks, ${result.uber.toFixed(2)}s invincibility`);
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ base, reports, errors }, null, 2));
  await browser.close();
}
console.log(`PASS real bonus gates/deaths, entry/return protection, returned checkpoints and clean lite/full consoles. ${output}`);
