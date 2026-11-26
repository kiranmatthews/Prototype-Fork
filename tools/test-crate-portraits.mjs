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
  cacheDir: '.motion-playtest-cache/crate-portrait-test-cache', server: { middlewareMode: true } });
try {
  const { createCrateArt } = await server.ssrLoadModule('/src/crateArt.ts');
  const { LIFE_PORTRAITS, setLifePortraitStyle } = await server.ssrLoadModule('/src/lifePortrait.ts');
  const first = createCrateArt('life');
  await first.ready;
  assert.ok(painted.at(-1).endsWith(LIFE_PORTRAITS.skull.file), 'default Life face must be the HUD skull');
  assert.deepEqual(Object.keys(LIFE_PORTRAITS), ['skull'], 'a removed head came back as a Life face');
  const texture = first.marks.material.map;
  // Skull is the only head: choosing it again paints and uploads nothing, and every Life crate
  // made afterwards shares the one decal.
  for (let again = 0; again < 2; again++) {
    const version = texture.version, paints = painted.length;
    setLifePortraitStyle('skull');
    assert.equal(painted.length, paints, 'choosing the current head repainted the Life face');
    assert.equal(texture.version, version, 'choosing the current head uploaded the cached decal again');
    const next = createCrateArt('life');
    await next.ready;
    assert.equal(next.marks.material.map, texture, 'new Life crates should reuse the portrait');
    assert.ok(painted.at(-1).endsWith(LIFE_PORTRAITS.skull.file), 'a new Life crate lost the HUD skull');
  }
  console.log(JSON.stringify({ pass: true, defaultBoneMan: true, heads: Object.keys(LIFE_PORTRAITS), newCratesShareDecal: true }));
} finally { await server.close(); }
