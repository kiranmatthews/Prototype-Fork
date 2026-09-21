import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) files.push(name);
  }
  return files.sort();
}

// Derive font versions from the same metrics used by the game. Old atlases,
// ZIP exports and provenance stay available online without filling phones.
export function runtimeAsset(file, fontVersions) {
  // An online escape hatch must remain reachable through stale cache-first workers.
  if (file === 'update-game.html' || file === 'offline-save.html') return false;
  if (file === 'sw.js' || /(?:^|\/)(?:provenance|UpstreamSource)\//.test(file)) return false;
  if (!/\.(?:html|js|css|json|webmanifest|png|jpe?g|webp|svg|glb|gltf|bin|ktx2|wasm|wav|mp3|ogg|m4a|mp4|webm|otf|ttf|woff2?)$/.test(file)) return false;
  if (file.startsWith('fonts/')) {
    if (/\.(?:otf|ttf|woff2?)$/.test(file)) return true;
    const atlas = file.match(/^fonts\/roo-(bonus|counter)-v(\d+)(?:-light\d+)?(?:-cap(?:128|256))?\.png$/);
    return !!atlas && fontVersions[atlas[1]] === Number(atlas[2]);
  }
  return true;
}

export function offlineBuild() {
  let root, outDir;
  return {
    name: 'boneman-offline', apply: 'build',
    configResolved(config) { root = config.root; outDir = path.resolve(root, config.build.outDir); },
    async closeBundle() {
      const metrics = await readFile(path.join(root, 'src/roo-type/atlas-metrics.ts'), 'utf8');
      const fontVersions = Object.fromEntries([...metrics.matchAll(/"(bonus|counter)":\{"version":(\d+)/g)].map(m => [m[1], Number(m[2])]));
      if (!fontVersions.bonus || !fontVersions.counter) throw new Error('Offline font versions could not be read');
      const entries = [];
      for (const file of await filesIn(outDir)) {
        if (!runtimeAsset(file, fontVersions)) continue;
        const bytes = await readFile(path.join(outDir, file));
        entries.push({ url: file, revision: hash(bytes), size: bytes.length });
      }
      const worker = await readFile(path.join(root, 'src/offline-worker.js'), 'utf8');
      const version = hash(JSON.stringify(entries) + worker).slice(0, 20);
      const output = worker.replace('/* OFFLINE_MANIFEST */', JSON.stringify({ version, entries }));
      await writeFile(path.join(outDir, 'sw.js'), output);
      const total = entries.reduce((sum, entry) => sum + entry.size, 0);
      console.log(`Offline game: ${entries.length} files, ${(total / 1048576).toFixed(1)} MiB, version ${version}`);
    },
  };
}
