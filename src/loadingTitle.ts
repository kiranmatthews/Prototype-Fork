import * as THREE from 'three';
import { ROO_ATLAS_METRICS } from './roo-type/atlas-metrics';
import { layoutRooAtlas, rooAtlasGlyphRect } from './roo-type/atlasLayout';
import { releaseImageUrl } from './releaseImageUrls';

const TEXT = 'LOADING';
const metrics = ROO_ATLAS_METRICS.counter;
const layout = layoutRooAtlas(metrics, TEXT, -.065)!;
const rects = layout.glyphs.map(entry => rooAtlasGlyphRect(metrics, entry));
const inkTop = Math.min(...layout.glyphs.map(entry => metrics.glyphs[entry.char].inkTop ?? 0));
const inkBottom = Math.max(...layout.glyphs.map(entry => metrics.glyphs[entry.char].inkBottom ?? 1));
const centreY = (inkTop + inkBottom) / 2;

function capHeight(width: number, height: number): number {
  return Math.min(height * .18, width * .80 / layout.width);
}

/** Reuse a single shipped PNG light frame, at the actual title's pixel size. */
export function loadingTitleAtlasUrl(width: number, height: number): string {
  const cap = capHeight(width, height);
  const suffix = cap <= 128 ? '-cap128' : cap <= 256 ? '-cap256' : '';
  return releaseImageUrl(`${import.meta.env.BASE_URL}fonts/roo-counter-v${metrics.version}${suffix}.png`);
}

export interface LoadingTitleDiagnostics {
  text: 'LOADING';
  ready: boolean;
  seconds: number;
  /** Normalized viewport bounds, including this frame's bounce and padding. */
  bounds: { left: number; top: number; right: number; bottom: number };
}

/** Seven atlas quads, one texture and one draw. Animation only updates 28 vertices. */
export class LoadingTitle {
  private geometry = new THREE.BufferGeometry();
  private positions = new THREE.BufferAttribute(new Float32Array(TEXT.length * 12), 3).setUsage(THREE.DynamicDrawUsage);
  private material = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
  readonly mesh = new THREE.Mesh(this.geometry, this.material);
  private texture: THREE.Texture | null = null;
  private seconds = 0;
  private disposed = false;
  private pending: Promise<void> | null = null;
  private request: AbortController | null = null;
  private url = '';
  private bounds = { left: .5, top: .5, right: .5, bottom: .5 };

  constructor() {
    const uv = new Float32Array(TEXT.length * 8), indices: number[] = [];
    for (let i = 0; i < TEXT.length; i++) {
      const glyph = metrics.glyphs[TEXT[i]], x = glyph.x / metrics.width, y = 1 - glyph.y / metrics.height;
      const w = glyph.width / metrics.width, h = glyph.height / metrics.height;
      uv.set([x, y, x, y - h, x + w, y - h, x + w, y], i * 8);
      const v = i * 4;
      indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    this.geometry.setAttribute('position', this.positions);
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry.setIndex(indices);
    this.mesh.name = 'Roo PNG loading title';
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  get diagnostics(): LoadingTitleDiagnostics {
    return { text: TEXT, ready: !!this.texture, seconds: this.seconds, bounds: { ...this.bounds } };
  }

  prepare(url: string): Promise<void> {
    if (this.disposed || this.url === url) return this.pending ?? Promise.resolve();
    this.url = url;
    this.pending = this.load(url);
    return this.pending;
  }

  private async load(url: string): Promise<void> {
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    // Worker animation starts independently. Allow a cold hosted atlas to
    // arrive while it moves, with bounded cancellation for offline fallback.
    const timeout = setTimeout(() => request.abort(), 15000);
    try {
      let texture: THREE.Texture;
      if (typeof createImageBitmap === 'function') {
        const response = await fetch(url, { signal: request.signal, priority: 'high' });
        if (!response.ok) throw new Error(`Loading atlas HTTP ${response.status}`);
        const image = await createImageBitmap(await response.blob(), { imageOrientation: 'flipY', premultiplyAlpha: 'none' });
        texture = new THREE.Texture(image);
        texture.flipY = false;
      } else {
        // Older main-thread fallbacks can still display the same PNG artwork.
        const image = new Image();
        image.decoding = 'async';
        await new Promise<void>((resolve, reject) => {
          const clean = (): void => { image.onload = image.onerror = null; request.signal.removeEventListener('abort', abort); };
          const abort = (): void => { clean(); image.src = ''; reject(new Error('Loading atlas cancelled')); };
          request.signal.addEventListener('abort', abort, { once: true });
          image.onload = () => { clean(); resolve(); };
          image.onerror = () => { clean(); reject(new Error('Loading atlas unavailable')); };
          image.src = url;
        });
        texture = new THREE.Texture(image);
      }
      if (this.disposed || this.url !== url || request.signal.aborted) { this.releaseTexture(texture); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      if (this.texture) this.releaseTexture(this.texture);
      this.texture = texture;
      this.material.map = texture;
      this.material.needsUpdate = true;
      this.mesh.visible = true;
    } catch {
      // Offline/missing art must not hold up the existing loading readiness gate.
      // Retain a successfully loaded resolution when an upgrade fails.
    } finally {
      clearTimeout(timeout);
      if (this.request === request) this.request = null;
    }
  }

  update(dt: number, width: number, height: number, viewHeight: number): void {
    this.seconds += Math.max(0, Math.min(.1, dt));
    const cap = capHeight(width, height), scale = cap / height * viewHeight;
    const aspect = width / height;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const phase = ((this.seconds - i * .095) % 2.8 + 2.8) % 2.8;
      let lift = 0, stretch = 1, tilt = 0;
      if (phase < .12) stretch -= .06 * Math.sin(Math.PI * phase / .12);
      else if (phase < .72) {
        const t = (phase - .12) / .60;
        lift = .17 * Math.sin(Math.PI * t);
        stretch += .055 * Math.sin(2 * Math.PI * t);
        tilt = .025 * Math.sin(2 * Math.PI * t);
      } else if (phase < .90) stretch -= .04 * Math.sin(Math.PI * (phase - .72) / .18);
      const squash = 1 / Math.sqrt(stretch);
      const pivotX = rect.x + rect.width / 2, pivotY = rect.y + rect.height;
      const cos = Math.cos(tilt), sin = Math.sin(tilt);
      for (let corner = 0; corner < 4; corner++) {
        const x = ((corner >= 2 ? rect.width : 0) - rect.width / 2) * squash;
        const y = (corner === 0 || corner === 3 ? rect.height : 0) * stretch;
        const px = (pivotX - (layout.min + layout.max) / 2 + x * cos - y * sin) * scale;
        const py = (centreY - pivotY + lift + x * sin + y * cos) * scale;
        this.positions.setXYZ(i * 4 + corner, px, py, 1);
        const nx = .5 + px / (viewHeight * aspect), ny = .5 - py / viewHeight;
        left = Math.min(left, nx); right = Math.max(right, nx);
        top = Math.min(top, ny); bottom = Math.max(bottom, ny);
      }
    }
    this.positions.needsUpdate = true;
    Object.assign(this.bounds, { left, top, right, bottom });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.request?.abort(); this.request = null;
    this.mesh.removeFromParent();
    this.geometry.dispose(); this.material.dispose();
    if (this.texture) this.releaseTexture(this.texture);
    this.texture = null;
  }

  private releaseTexture(texture: THREE.Texture): void {
    texture.dispose();
    (texture.image as ImageBitmap)?.close?.();
  }
}
