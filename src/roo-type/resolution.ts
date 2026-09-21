/** Source-art resolution follows the physical display, independently of post effects. */
export type RooAtlasCap = 128 | 256 | 512;
export function rooAtlasCap(width: number, height: number, dpr: number): RooAtlasCap {
  const shortEdge = Math.min(width, height) * Math.max(1, dpr || 1);
  if (!Number.isFinite(shortEdge) || shortEdge <= 0) return 128;
  return shortEdge > 2048 ? 512 : shortEdge > 1440 ? 256 : 128;
}
export function displayAtlasCap(): RooAtlasCap {
  return typeof window === 'undefined' ? 512 : rooAtlasCap(window.innerWidth, window.innerHeight, window.devicePixelRatio);
}
