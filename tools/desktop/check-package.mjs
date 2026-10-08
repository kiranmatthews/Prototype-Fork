import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { bundlePaths } from './bundle-paths.mjs';
const require = createRequire(fileURLToPath(new URL('../../desktop/package.json', import.meta.url)));
const { extractFile, listPackage } = require('@electron/asar');
const { getCurrentFuseWire, FuseV1Options, FuseState } = await import('../../desktop/node_modules/@electron/fuses/dist/index.js');
const paths = bundlePaths();
const manifest = JSON.parse(extractFile(paths.archive, 'web/asset-manifest.json'));
for (const file of manifest.files) {
  const bytes = extractFile(paths.archive, 'web/' + file.path);
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
}
const names = listPackage(paths.archive).map(name => name.replaceAll('\\', '/'));
assert(!names.some(name => /node_modules|\.env|\.map$|vite\.config|test-results|package-lock/.test(name)), 'Development material entered the app');
const wire = await getCurrentFuseWire(paths.fuses);
for (const fuse of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments])
  assert.equal(wire[fuse], FuseState.DISABLE);
assert.equal(wire[FuseV1Options.OnlyLoadAppFromAsar], FuseState.ENABLE);
if (process.platform !== 'linux') assert.equal(wire[FuseV1Options.EnableEmbeddedAsarIntegrityValidation], FuseState.ENABLE);
console.log(JSON.stringify({ status:'passed', archive:paths.archive, contentId:manifest.contentId, files:manifest.files.length, fuses:wire }));
