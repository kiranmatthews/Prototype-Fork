// Export the actual source-owned pavilion recipe for the neutral Blender review.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = new URL('../../.img2threejs/jungle-kit/', import.meta.url);
const server = await createServer({ root, configFile: false, logLevel: 'silent',
  cacheDir: fileURLToPath(new URL('vite-review-cache/', out)),
  server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { jungleAssemblyParts } = await server.ssrLoadModule('/src/jungleAssemblies.ts');
  const parts = jungleAssemblyParts({ dkind: 'roofedtemple', p: [0,0,0], s: [14,13,12], seed: 137 });
  mkdirSync(out, { recursive: true });
  writeFileSync(new URL('temple-assembly-review.json', out), JSON.stringify(
    parts.map(p => ({ kind: p.kind, matrix: p.matrix.elements, color: p.color })), null, 2));
  console.log(`Exported ${parts.length} actual runtime temple parts.`);
} finally {
  await server.close();
}
