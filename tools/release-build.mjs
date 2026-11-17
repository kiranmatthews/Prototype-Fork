import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {pruneRetiredFontAssets,prepareFontArchives,pruneLocalReviewAssets,prepareReviewCatalog,compactReleaseMetadata} from './release-assets.mjs';
import {prepareReleaseTextures} from './release-textures.mjs';
import {prepareTop40Textures} from './release-top40-textures.mjs';
import {prepareSharedReleaseTextures} from './release-shared-textures.mjs';
import {prepareNativeGeometry} from './release-native-geometry.mjs';
import {prepareReleaseImages} from './release-images.mjs';

/** The release step after Vite: shrink hosted assets without changing what
 * players see, then publish the tiny release descriptor the update check reads.
 * public/levels.json is a frozen snapshot read only by local tools; the game
 * no longer downloads it, so it is left out of the release. */
export function releaseBuild() {
  let root, outDir;
  return {
    name: 'boneman-release', apply: 'build',
    configResolved(config) { root = config.root; outDir = path.resolve(root, config.build.outDir); },
    async closeBundle() {
      await rm(path.join(outDir, 'levels.json'), { force: true });
      const metrics = await readFile(path.join(root, 'src/roo-type/atlas-metrics.ts'), 'utf8');
      const fontVersions = Object.fromEntries([...metrics.matchAll(/"(bonus|counter)":\{"version":(\d+)/g)].map(m => [m[1], Number(m[2])]));
      if (!fontVersions.bonus || !fontVersions.counter) throw new Error('Release font versions could not be read');
      const retired=await pruneRetiredFontAssets({root,outDir,fontVersions});
      console.log(`Release assets: kept active fonts; omitted ${retired.files.length} historical files (${(retired.bytes/1048576).toFixed(1)} MiB) from generated output.`);
      const metadata=await compactReleaseMetadata({root,outDir});
      console.log(`Release metadata: removed ${(metadata.savedBytes/1024).toFixed(1)} KiB of whitespace; all values and source files retained.`);
      const reviews=await pruneLocalReviewAssets({root,outDir});
      console.log(`Local review galleries: ${reviews.files.length} files (${(reviews.bytes/1048576).toFixed(1)} MiB) kept in the authoring library.`);
      const archives=await prepareFontArchives({root,outDir,fontVersions});
      console.log(`Font export: ${archives.length} on-demand archive(s), ${(archives.reduce((sum,item)=>sum+item.removedBytes-item.manifestBytes,0)/1048576).toFixed(1)} MiB less hosted data.`);
      const textures=await prepareReleaseTextures({root,outDir});
      console.log(`Reviewed textures: ${textures.images} reviewed images in ${textures.models} models, ${(textures.savedBytes/1048576).toFixed(1)} MiB less hosted data; original art retained.`);
      const top40=await prepareTop40Textures({root,outDir});
      console.log(`Top-40 GLB textures: ${top40.images} images in ${top40.models} models resized and optimized, ${(top40.savedBytes/1048576).toFixed(1)} MiB less hosted data.`);
      const shared=await prepareSharedReleaseTextures({root,outDir});
      console.log(`Shared textures: ${shared.images} exact images reused across ${shared.models} models, ${(shared.savedBytes/1048576).toFixed(1)} MiB less hosted data.`);
      const native=await prepareNativeGeometry({root,outDir});
      console.log(`Native geometry: ${native.files} complete models packed losslessly, ${(native.savedBytes/1048576).toFixed(1)} MiB less hosted data.`);
      const catalogue=await prepareReviewCatalog({root,outDir});
      const images=await prepareReleaseImages({root,outDir});
      console.log(`Lossless images: ${images.images} pixel-identical WebPs, ${(images.savedBytes/1048576).toFixed(1)} MiB less hosted data.`);
      console.log(`Animation catalogue: exact keyframes packed losslessly, ${(catalogue.savedBytes/1048576).toFixed(1)} MiB less hosted data.`);
      const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
      const script = [...html.matchAll(/<script\b[^>]*>/g)].map(match => match[0])
        .find(tag => /\btype=["']module["']/.test(tag));
      const entry = script?.match(/\bsrc=["'](?:\.\/)?(assets\/index-[\w-]+\.js)["']/)?.[1];
      if (!entry) throw new Error('Built game entry was not found for update discovery');
      await writeFile(path.join(outDir, 'release.json'), JSON.stringify({ entry }));
    },
  };
}
