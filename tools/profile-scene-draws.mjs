// Isolated Chrome draw census: identifies submitted geometry without changing
// quality, shadow settings, authored visibility or the user's browser profile.
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.argv[2];
if (!base) throw new Error('Usage: node tools/profile-scene-draws.mjs <base-url>');
const output = process.env.SCENE_DRAW_OUTPUT || '/private/tmp/scene-draw-census';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const rows = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  for (const id of (process.env.SCENE_DRAW_LEVELS || 'sky,treehouse-trail,test').split(',')) {
    console.log(`Loading ${id}`);
    await page.goto(new URL(`?playtest&level=${id}`, base).href);
    await page.waitForFunction(() => window.__game && !window.__game.gameFlow.blocksGameplay, null, { timeout: 120000 });
    await page.evaluate(async () => { await window.__game.getLevel().prepareJungleAssets(); });
    await page.waitForTimeout(3000);
    const row = await page.evaluate(async () => {
      const game = window.__game, renderer = game.renderer;
      const original = renderer.renderBufferDirect;
      const submitted = new Map();
      renderer.renderBufferDirect = function(camera, scene, geometry, material, object, group) {
        const shadow = !!(material.isMeshDepthMaterial || material.isMeshDistanceMaterial);
        const key = `${object.uuid}:${shadow}:${group?.start ?? 0}`;
        let item = submitted.get(key);
        if (!item) {
          const ancestors = []; let parent = object.parent;
          while (parent && parent !== game.scene) { if (parent.name) ancestors.push(parent.name); parent = parent.parent; }
          const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
          item = { name: object.name, ancestors, shadow, calls: 0,
            triangles: (group?.count ?? geometry.index?.count ?? geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1),
            sourceMaterials: sourceMaterials.map(value => ({ id: value.uuid, name: value.name, type: value.type })),
            geometry: geometry.uuid, geometryName: geometry.name, geometryType: geometry.type,
            instanced: !!object.isInstancedMesh, skinned: !!object.isSkinnedMesh,
            morphs: geometry.morphAttributes.position?.length ?? 0, userData: Object.keys(object.userData),
          };
          submitted.set(key, item);
        }
        item.calls++;
        return original.call(this, camera, scene, geometry, material, object, group);
      };
      const start = game.frameStats.frame;
      try { await new Promise(resolve => { let count = 30; const tick = () => --count > 0 ? requestAnimationFrame(tick) : resolve(); requestAnimationFrame(tick); }); }
      finally { renderer.renderBufferDirect = original; }
      const frames = game.frameStats.frame - start;
      return { id: game.getCurrentLevel().id, frames, multiDraw: !!renderer.getContext().getExtension('WEBGL_multi_draw'),
        draws: [...submitted.values()].map(value => ({ ...value, calls: value.calls / frames })) };
    });
    rows.push(row);
    const totals = new Map();
    for (const draw of row.draws) {
      const key = `${draw.shadow ? 'shadow' : 'color'} / ${draw.ancestors.find(value => value === 'player-visual') ? 'player' : draw.sourceMaterials[0]?.name || draw.name || draw.geometryType}`;
      totals.set(key, (totals.get(key) ?? 0) + draw.calls);
    }
    console.log(JSON.stringify({ id, frames: row.frames, multiDraw: row.multiDraw, total: row.draws.reduce((sum, draw) => sum + draw.calls, 0), groups: [...totals].sort((a, b) => b[1] - a[1]).slice(0, 28) }));
    await writeFile(`${output}/draws.json`, JSON.stringify({ base, rows, errors }, null, 2));
  }
} finally {
  await writeFile(`${output}/draws.json`, JSON.stringify({ base, rows, errors }, null, 2));
  await browser.close();
}
