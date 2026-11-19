import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const [origin, directory] = process.argv.slice(2);
if (!origin || !directory) throw new Error('Usage: node tools/cargo-rider/playtest.mjs <game URL> <output directory>');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = resolve(directory);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const mode of ['lite', 'normal', 'native']) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(90_000);
    const errors = [], files = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => {
      if (response.url().includes('/characters/cargo-rider/')) files.push([response.url(), response.status()]);
    });
    const url = new URL(origin.endsWith('/') ? origin : origin + '/');
    url.search = '?playtest&level=codex-lab&tool=characterlab' + (mode === 'lite' ? '&lite' : '');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await page.getByRole('button', { name: 'Cargo Roo', exact: true }).click();
    await page.waitForFunction(() => window.__game.player.cargoLoadState === 'ready');
    await page.getByRole('button', { name: 'Wink', exact: true }).click();
    const blink = await page.evaluate(() => window.__game.player.cargoSurface.meshes
      .filter(mesh => mesh.morphTargetDictionary?.['Blink.L'] !== undefined)
      .map(mesh => mesh.morphTargetInfluences[mesh.morphTargetDictionary['Blink.L']]));
    assert.ok(blink.length && blink.every(value => value === 1));
    if (mode === 'normal') await page.keyboard.press('Escape');
    else await page.getByTitle('Close Character Lab').click();
    await page.waitForFunction(() => !document.body.classList.contains('character-lab-open'));
    if (await page.evaluate(() => window.__game.gameFlow.developerChromeVisible)) await page.keyboard.press('m');
    if (mode === 'native') {
      await page.evaluate(() => {
        const game = window.__game;
        game.renderQualitySettings.setRegularResolution(null);
        game.crtGuestSettings.setEnabled(false);
      });
      await page.waitForFunction(() => {
        const canvas = window.__game.renderer.domElement;
        return canvas.width === innerWidth * devicePixelRatio && canvas.height === innerHeight * devicePixelRatio;
      });
    }
    await page.waitForFunction(() => window.__game.player.grounded && !window.__game.gameFlow.blocksGameplay);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(360);
    await page.keyboard.press('Space');
    await page.waitForTimeout(230);
    await page.keyboard.up('ArrowUp');
    await page.screenshot({ path: join(output, mode + '.png') });
    const state = await page.evaluate(() => {
      const game = window.__game, p = game.player, surface = p.cargoSurface, canvas = game.renderer.domElement;
      return { level: game.getCurrentLevel().id, stamp: document.querySelector('.hud-build')?.textContent,
        visible: surface.root.visible, expression: surface.expression, style: p.characterHeadStyle,
        triangles: surface.meshes.reduce((sum, m) => sum + (m.geometry.index?.count ?? m.geometry.attributes.position.count)/3, 0),
        buffer: [canvas.width, canvas.height], gl: game.renderer.getContext().getError() };
    });
    assert.match(state.stamp, /Codex\/sol fork/);
    assert.equal(state.level, 'codex-lab');
    assert.equal(state.expression, 'live');
    assert.equal(state.style, 'cargo');
    assert.ok(state.visible && state.triangles === 148656);
    assert.equal(state.gl, 0);
    assert.ok(files.some(([path, status]) => path.endsWith('.glb') && status === 200));
    assert.ok(files.some(([path, status]) => path.endsWith('.webp') && status === 200));
    url.searchParams.delete('tool');
    await page.goto(url.href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__game?.player.cargoSurface?.root.visible);
    await page.evaluate(() => window.__game.setCharacterHeadStyle('skull'));
    await page.waitForFunction(() => !window.__game.player.cargoSurface.root.visible);
    assert.deepEqual(errors, []);
    results.push({ mode, ...state, files, errors });
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  await writeFile(join(output, 'playtest.json'), JSON.stringify(results, null, 2) + '\n');
} finally {
  await browser.close();
}
