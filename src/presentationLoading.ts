import * as THREE from "three";

/** Two RAF boundaries allow the browser to paint before synchronous scene work. */
export const afterPresentationPaint = (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

/** Track nested GLTF/image/texture requests, not just the manager's first URL. */
export class PresentationAssetReadiness {
  private pending = new Map<string, number>();
  private failures = new Set<string>();
  private revision = 0;

  constructor(manager: THREE.LoadingManager) {
    const start = manager.itemStart.bind(manager);
    const end = manager.itemEnd.bind(manager);
    const error = manager.itemError.bind(manager);
    manager.itemStart = (url) => {
      this.pending.set(url, (this.pending.get(url) ?? 0) + 1);
      this.revision++;
      start(url);
    };
    manager.itemEnd = (url) => {
      const count = this.pending.get(url) ?? 0;
      if (count <= 1) this.pending.delete(url);
      else this.pending.set(url, count - 1);
      this.revision++;
      end(url);
    };
    manager.itemError = (url) => { this.failures.add(url); error(url); };
  }

  get diagnostics(): { pending: string[]; failed: string[]; revision: number } {
    return { pending: [...this.pending.keys()], failed: [...this.failures], revision: this.revision };
  }

  async waitUntilSettled(paint = afterPresentationPaint): Promise<void> {
    // An onLoad callback can start child textures or attach a decoded GLTF in
    // a microtask. Require a quiet painted interval after the final completion.
    for (;;) {
      const revision = this.revision;
      await paint();
      if (this.pending.size === 0 && revision === this.revision) return;
    }
  }
}

// Imported before construction of the first Level/Player. Individual asset
// owners keep their existing error/fallback behavior; a failed request settles
// normally instead of holding the user behind an endless loading screen.
export const presentationAssets = new PresentationAssetReadiness(THREE.DefaultLoadingManager);

/** Include canvas-backed portrait/sticker images in the same readiness gate. */
export function trackPresentationImage(image: HTMLImageElement, url: string): void {
  const manager = THREE.DefaultLoadingManager;
  manager.itemStart(url);
  let settled = false;
  const finish = (failed: boolean): void => {
    if (settled) return;
    settled = true;
    if (failed) manager.itemError(url);
    manager.itemEnd(url);
  };
  image.addEventListener("load", () => finish(false), { once: true });
  image.addEventListener("error", () => finish(true), { once: true });
}

export type LoadingTransitionPhase = "cover" | "prepare-vortex" | "vortex" | "cover-destination" | "prepare-destination" | "reveal";
export const MINIMUM_VORTEX_MS = 2000;

export interface LoadingTransitionHooks {
  phase: (phase: LoadingTransitionPhase) => void;
  prepareVortex: () => Promise<void>;
  load: () => void | Promise<void>;
  waitForAssets: () => Promise<void>;
  prepareDestination: () => Promise<void>;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
  paint?: () => Promise<void>;
}

/** Readiness-driven sequence; the input lock is held by GameFlowUI throughout. */
export async function runLoadingTransition(hooks: LoadingTransitionHooks, reducedMotion: boolean, vortex = true): Promise<void> {
  const wait = hooks.wait ?? ((ms) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));
  const now = hooks.now ?? (() => performance.now());
  const paint = hooks.paint ?? afterPresentationPaint;
  const fade = reducedMotion ? 20 : 360;
  hooks.phase("cover");
  await wait(fade);
  await paint();
  if (vortex) {
    hooks.phase("prepare-vortex");
    await hooks.prepareVortex();
    await paint();
    hooks.phase("vortex");
    await wait(fade);
    await paint();
  }
  const visibleAt = now();
  // Start destination work only after the vortex's reveal has actually painted.
  await hooks.load();
  await hooks.waitForAssets();
  if (vortex) {
    await wait(Math.max(0, MINIMUM_VORTEX_MS - (now() - visibleAt)));
    hooks.phase("cover-destination");
    await wait(fade);
    await paint();
  }
  hooks.phase("prepare-destination");
  await hooks.prepareDestination();
  await paint();
  hooks.phase("reveal");
  await wait(reducedMotion ? 20 : 520);
  await paint();
}
