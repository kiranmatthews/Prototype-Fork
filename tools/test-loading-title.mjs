import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const originalFetch = globalThis.fetch;
const originalBitmap = globalThis.createImageBitmap;
try {
  const { LoadingTitle, loadingTitleAtlasUrl } = await server.ssrLoadModule('/src/loadingTitle.ts');
  const images = [];
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  globalThis.createImageBitmap = async () => {
    const image = { closed: 0, close() { this.closed++; } }; images.push(image); return image;
  };
  const title = new LoadingTitle();
  const vertices = title.mesh.geometry.getAttribute('position');
  assert.equal(vertices.count, 28); assert.equal(title.mesh.geometry.index.count, 42);
  await title.prepare('neutral.png');
  await title.prepare('neutral.png');
  assert.equal(images.length, 1, 'Repeated preparation must reuse the decoded PNG');
  assert.equal(title.diagnostics.ready, true);
  for (const [width, height] of [[1920, 1080], [390, 844], [844, 390], [3840, 2160]]) {
    for (let frame = 0; frame < 180; frame++) {
      title.update(1 / 60, width, height, 8);
      const b = title.diagnostics.bounds;
      assert.ok(b.left > .05 && b.right < .95 && b.top > .05 && b.bottom < .95,
        `Animated bounds clipped at ${width}x${height}: ${JSON.stringify(b)}`);
      assert.ok([...vertices.array].every(Number.isFinite));
    }
    assert.equal(title.mesh.geometry.getAttribute('position'), vertices, 'Bounce must reuse its GPU buffer');
  }
  const still = new LoadingTitle();
  still.update(0, 390, 844, 8);
  const pose = [...still.mesh.geometry.getAttribute('position').array];
  for (let frame = 0; frame < 30; frame++) still.update(0, 390, 844, 8);
  assert.deepEqual([...still.mesh.geometry.getAttribute('position').array], pose, 'Zero delta must remain still');
  still.dispose();
  assert.match(loadingTitleAtlasUrl(390, 844), /-cap128\.png$/);
  assert.match(loadingTitleAtlasUrl(1920, 1080), /-cap256\.png$/);
  assert.match(loadingTitleAtlasUrl(3840, 2160), /v10\.png$/);
  await title.prepare('native.png');
  assert.equal(images[0].closed, 1, 'Resolution replacement must release the old image');
  let geometryDisposals = 0, materialDisposals = 0;
  title.mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
  title.mesh.material.addEventListener('dispose', () => materialDisposals++);
  title.dispose(); title.dispose();
  assert.equal(images[1].closed, 1); assert.equal(geometryDisposals, 1); assert.equal(materialDisposals, 1);
  let complete;
  globalThis.createImageBitmap = () => new Promise(resolve => { complete = resolve; });
  const cancelled = new LoadingTitle(), pending = cancelled.prepare('late.png');
  await new Promise(resolve => setImmediate(resolve));
  cancelled.dispose();
  const late = { closed: 0, close() { this.closed++; } }; complete(late); await pending;
  assert.equal(late.closed, 1); assert.equal(cancelled.diagnostics.ready, false);
  let signal;
  globalThis.fetch = async (_, options) => {
    signal = options.signal;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Aborted'))));
  };
  const downloading = new LoadingTitle(), aborted = downloading.prepare('cancelled.png');
  downloading.dispose(); await aborted;
  assert.equal(signal.aborted, true, 'Releasing the loader must cancel in-flight atlas requests');
  globalThis.fetch = async () => { throw new Error('Offline'); };
  const offline = new LoadingTitle(); await offline.prepare('missing.png');
  assert.equal(offline.diagnostics.ready, false); offline.dispose();
  console.log('PASS responsive Roo bounce, retained buffers, reduced motion, atlas resolution and image/GPU lifecycle');
} finally {
  globalThis.fetch = originalFetch;
  if (originalBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = originalBitmap;
  await server.close();
}
