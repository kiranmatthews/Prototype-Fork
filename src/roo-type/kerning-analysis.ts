import type { RooAtlasMetrics } from './bake';
import { ROO_ATLAS_METRICS } from './atlas-metrics';
import { releaseImageUrl } from '../releaseImageUrls';
import { roundRooSpacing } from './kerning';

const images = new Map<string, Promise<HTMLImageElement>>();
/** The inspector uses the complete source PNG, even when the game's atlas is smaller. */
export function loadKerningImage(palette: 'bonus' | 'counter'): Promise<HTMLImageElement> {
  let promise = images.get(palette);
  if (!promise) {
    promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => { images.delete(palette); reject(Error('Could not load the source artwork. Switch color or reload to retry.')); };
      image.src = releaseImageUrl(`${import.meta.env.BASE_URL}fonts/roo-${palette}-v${ROO_ATLAS_METRICS[palette].version}.png`);
    });
    images.set(palette, promise);
  }
  return promise;
}

type Profile = Array<{ left: number; right: number } | null>;
const profiles = new WeakMap<HTMLImageElement, Map<string, Profile>>();
const RESOLUTION = 160;
function profile(image: HTMLImageElement, metrics: RooAtlasMetrics, char: string): Profile {
  let cached = profiles.get(image);
  if (!cached) { cached = new Map(); profiles.set(image, cached); }
  const found = cached.get(char); if (found) return found;
  const g = metrics.glyphs[char], rows: Profile = Array(RESOLUTION).fill(null);
  if (g.width) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(g.width / metrics.capPixels * RESOLUTION); canvas.height = RESOLUTION;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scaleX = image.naturalWidth / metrics.width, scaleY = image.naturalHeight / metrics.height;
    ctx.drawImage(image, g.x * scaleX, g.y * scaleY, g.width * scaleX, g.height * scaleY,
      0, g.top * RESOLUTION, g.width / metrics.capPixels * RESOLUTION, g.height / metrics.capPixels * RESOLUTION);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < RESOLUTION; y++) {
      let left = Infinity, right = -Infinity;
      for (let x = 0; x < canvas.width; x++) if (pixels[(y * canvas.width + x) * 4 + 3] >= 140) {
        left = Math.min(left, x / RESOLUTION + g.left); right = Math.max(right, (x + 1) / RESOLUTION + g.left);
      }
      if (Number.isFinite(left)) rows[y] = { left, right };
    }
    canvas.width = canvas.height = 1;
  }
  cached.set(char, rows); return rows;
}

export function analyzeRooPair(image: HTMLImageElement, metrics: RooAtlasMetrics, pair: string, tracking: number, adjustment: number) {
  const left = profile(image, metrics, pair[0]), right = profile(image, metrics, pair[1]);
  const advance = metrics.glyphs[pair[0]].advance + (metrics.kern[pair] ?? 0) + tracking;
  const gaps = left.flatMap((edge, i) => edge && right[i] ? [advance + right[i]!.left - edge.right] : []).sort((a, b) => a - b);
  if (gaps.length < 4) return null;
  // Bring the nearest third of the facing contours toward a gentle optical gap,
  // while preserving a small minimum clearance at every sampled scanline.
  const desired = Math.max(.015 - gaps[0], .045 - gaps[Math.floor(gaps.length * .3)]);
  return { gap: gaps[0] + adjustment, suggestion: roundRooSpacing(desired), limited: Math.abs(desired) > .3 };
}
