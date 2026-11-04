import assert from 'node:assert/strict';
import { createServer } from 'vite';

const painted = [];
const noop = () => {};
const context = new Proxy({
  drawImage: image => painted.push(image.src),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  measureText: text => ({ width: text.length * 8 }),
}, { get: (target, key) => target[key] ?? noop });
globalThis.document = { createElement: () => ({ getContext: () => context }) };
globalThis.Image = class {
  set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); }
  get src() { return this.url; }
};
const server = await createServer({ appType: 'custom', logLevel: 'silent',
  cacheDir: '.release-queue/crate-portrait-test-cache', server: { middlewareMode: true } });
try {
  const { createCrateArt } = await server.ssrLoadModule('/src/crateArt.ts');
  const { LIFE_PORTRAITS, setLifePortraitStyle } = await server.ssrLoadModule('/src/lifePortrait.ts');
  const first = createCrateArt('life');
  await first.ready;
  assert.ok(painted.at(-1).endsWith(LIFE_PORTRAITS.skull.file), 'default Life face must be the HUD skull');
  const texture = first.marks.material.map;
  for (const style of ['alternate', 'skull', 'alternate', 'skull']) {
    const version = texture.version;
    setLifePortraitStyle(style);
    assert.ok(painted.at(-1).endsWith(LIFE_PORTRAITS[style].file), 'head switch left stale painted artwork');
    assert.ok(texture.version > version, 'cached decal was not uploaded after switching heads');
    const next = createCrateArt('life');
    await next.ready;
    assert.equal(next.marks.material.map, texture, 'new Life crates should reuse the updated portrait');
  }
  console.log(JSON.stringify({ pass: true, defaultBoneMan: true, existingAndNewCratesUpdate: true, headSwitches: 4 }));
} finally { await server.close(); }
