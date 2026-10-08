import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { runtimeAsset } from '../offline-build.mjs';

export async function inventory(root, prefix = '') {
  const rows = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes:true })) {
    const key = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('Bundle cannot contain symlinks: ' + key);
    if (entry.isDirectory()) rows.push(...await inventory(root, key + '/'));
    else if (entry.isFile()) rows.push(key);
  }
  return rows.sort();
}
export function keepAsset(file, versions) {
  // Keep attribution beside the assets even when it isn't executable content.
  if (/(?:^|\/)[^/]*(?:license|notice|attribution|credits)[^/]*(?:\.(?:txt|md|json))?$/i.test(file)) return true;
  if (/\.(?:html|webmanifest)$/.test(file)) return false;
  return file === 'fonts/roo-bevel-source-v1.json' || runtimeAsset(file, versions);
}
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function desktopAssets() {
  let root, output;
  return {
    name:'boneman-desktop-assets',
    configResolved(config) { root = config.root; output = path.resolve(root, config.build.outDir); },
    transformIndexHtml(html) { return html.replace(/<link\b[^>]*rel="manifest"[^>]*>/g, ''); },
    async closeBundle() {
      const metrics = await readFile(path.join(root, 'src/roo-type/atlas-metrics.ts'), 'utf8');
      const versions = Object.fromEntries([...metrics.matchAll(/"(bonus|counter)":\{"version":(\d+)/g)].map(m => [m[1], Number(m[2])]));
      if (!versions.bonus || !versions.counter) throw new Error('Cannot identify active font atlases');
      const publicRoot = path.join(root, 'public');
      let omittedBytes = 0;
      for (const file of await inventory(publicRoot)) {
        if (!keepAsset(file, versions)) {
          omittedBytes += (await readFile(path.join(publicRoot, file))).length;
          continue;
        }
        await mkdir(path.dirname(path.join(output, file)), { recursive:true });
        await copyFile(path.join(publicRoot, file), path.join(output, file));
      }
      await mkdir(path.join(output, 'licenses'), { recursive:true });
      for (const name of ['three', 'three-mesh-bvh'])
        await copyFile(path.join(root, 'node_modules', name, 'LICENSE'), path.join(output, 'licenses', name + '.txt'));
      const files = [];
      for (const file of await inventory(output)) {
        if (file === 'asset-manifest.json') continue;
        const bytes = await readFile(path.join(output, file));
        files.push({ path:file, bytes:bytes.length, sha256:digest(bytes) });
      }
      const contentId = digest(JSON.stringify(files));
      const manifest = { schema:1, contentId, files };
      await writeFile(path.join(output, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
      console.log(`Desktop payload: ${files.length} files, ${(files.reduce((n,f) => n + f.bytes, 0)/1048576).toFixed(1)} MiB; omitted ${(omittedBytes/1048576).toFixed(1)} MiB of web/authoring assets.`);
    },
  };
}
