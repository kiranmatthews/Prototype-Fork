import { DefaultLoadingManager } from 'three';
import { RELEASE_IMAGE_FILES } from './releaseImageFiles';

const files = new Set<string>(RELEASE_IMAGE_FILES);

/** Release-only, pixel-identical image containers. Original PNGs remain the
 * development and export sources. Preserve subpath hosting and cache keys. */
export function releaseImageUrl(url: string, packed = import.meta.env.PROD): string {
  if (!packed || /^(?:data:|blob:)/.test(url)) return url;
  const split = url.search(/[?#]/), path = split < 0 ? url : url.slice(0, split);
  const suffix = split < 0 ? '' : url.slice(split);
  for (const file of files) {
    if (path === file || path.endsWith('/' + file)) return path.slice(0, -4) + '.webp' + suffix;
  }
  return url;
}

// Three's common loader manager covers standalone scenery maps as well as
// their uses in reflections and editor previews. DOM images call the same
// resolver explicitly. Embedded GLB images and user uploads are unaffected.
if (import.meta.env.PROD) DefaultLoadingManager.setURLModifier(releaseImageUrl);
