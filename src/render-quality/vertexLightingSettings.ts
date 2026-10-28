export const VERTEX_LIGHTING_STORAGE_KEY = 'solProtoVertexLighting.v1';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;

function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export class VertexLightingSettings {
  private current = false;
  private readonly listeners = new Set<(enabled: boolean) => void>();

  constructor(private readonly storage: Storage | null = browserStorage()) {
    try { this.current = storage?.getItem(VERTEX_LIGHTING_STORAGE_KEY) === 'true'; } catch { /* Optional preference. */ }
  }

  get enabled(): boolean { return this.current; }

  setEnabled(enabled: boolean): void {
    if (enabled === this.current) return;
    this.current = enabled;
    try { this.storage?.setItem(VERTEX_LIGHTING_STORAGE_KEY, String(enabled)); } catch { /* Live control still works. */ }
    for (const listener of this.listeners) listener(enabled);
  }

  subscribe(listener: (enabled: boolean) => void, immediate = false): () => void {
    this.listeners.add(listener);
    if (immediate) listener(this.current);
    return () => this.listeners.delete(listener);
  }
}

export const vertexLightingSettings = new VertexLightingSettings();
