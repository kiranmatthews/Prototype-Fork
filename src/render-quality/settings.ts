export const RENDER_QUALITY_STORAGE_KEY = "solProtoRenderQuality.v1";
export const RENDER_QUALITY_VERSION = 1;
export const RENDER_BASE_HEIGHTS = [540, 720, 900] as const;
export const RENDER_OUTPUT_MULTIPLIERS = [1, 2, 3] as const;

export type RenderBaseHeight = (typeof RENDER_BASE_HEIGHTS)[number];
export type RenderOutputMultiplier =
  (typeof RENDER_OUTPUT_MULTIPLIERS)[number];

export interface RenderQualityState {
  enabled: boolean;
  baseHeight: RenderBaseHeight;
  outputMultiplier: RenderOutputMultiplier;
  fixed60: boolean;
}

export interface RenderQualitySizes {
  viewportWidth: number;
  viewportHeight: number;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
}

export interface RenderQualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RenderQualitySettingsOptions {
  storage?: RenderQualityStorage | null;
  loadStored?: boolean;
  persistChanges?: boolean;
}

export type RenderQualityListener = (
  state: Readonly<RenderQualityState>,
  revision: number,
) => void;

const DEFAULTS: Readonly<RenderQualityState> = Object.freeze({
  enabled: true,
  baseHeight: 720,
  outputMultiplier: 2,
  fixed60: true,
});

function browserStorage(): RenderQualityStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isBaseHeight(value: unknown): value is RenderBaseHeight {
  return (
    typeof value === "number" &&
    RENDER_BASE_HEIGHTS.includes(value as RenderBaseHeight)
  );
}

function isOutputMultiplier(value: unknown): value is RenderOutputMultiplier {
  return (
    typeof value === "number" &&
    RENDER_OUTPUT_MULTIPLIERS.includes(value as RenderOutputMultiplier)
  );
}

function parseState(value: unknown): RenderQualityState | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.version !== RENDER_QUALITY_VERSION) return null;
  if (
    typeof row.enabled !== "boolean" ||
    !isBaseHeight(row.baseHeight) ||
    !isOutputMultiplier(row.outputMultiplier) ||
    typeof row.fixed60 !== "boolean"
  )
    return null;
  return {
    enabled: row.enabled,
    baseHeight: row.baseHeight,
    outputMultiplier: row.outputMultiplier,
    fixed60: row.fixed60,
  };
}

function validDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

export class RenderQualitySettings {
  private state: RenderQualityState = { ...DEFAULTS };
  private readonly listeners = new Set<RenderQualityListener>();
  private readonly storage: RenderQualityStorage | null;
  private readonly persistChanges: boolean;
  revision = 1;

  constructor(options: RenderQualitySettingsOptions = {}) {
    this.storage =
      options.storage === undefined ? browserStorage() : options.storage;
    this.persistChanges = options.persistChanges ?? true;
    if ((options.loadStored ?? true) && this.storage) {
      try {
        const json = this.storage.getItem(RENDER_QUALITY_STORAGE_KEY);
        if (json) {
          const parsed = parseState(JSON.parse(json) as unknown);
          if (parsed) this.state = parsed;
        }
      } catch {
        // A corrupt preference must never block the game from starting.
      }
    }
  }

  get enabled(): boolean {
    return this.state.enabled;
  }

  get baseHeight(): RenderBaseHeight {
    return this.state.baseHeight;
  }

  get outputMultiplier(): RenderOutputMultiplier {
    return this.state.outputMultiplier;
  }

  get fixed60(): boolean {
    return this.state.fixed60;
  }

  snapshot(): Readonly<RenderQualityState> {
    return Object.freeze({ ...this.state });
  }

  setEnabled(enabled: boolean): boolean {
    return this.replace({ ...this.state, enabled });
  }

  setBaseHeight(baseHeight: RenderBaseHeight): boolean {
    if (!isBaseHeight(baseHeight)) throw new Error("Unsupported base height");
    return this.replace({ ...this.state, baseHeight });
  }

  setOutputMultiplier(outputMultiplier: RenderOutputMultiplier): boolean {
    if (!isOutputMultiplier(outputMultiplier))
      throw new Error("Unsupported CRT output multiplier");
    return this.replace({ ...this.state, outputMultiplier });
  }

  setFixed60(fixed60: boolean): boolean {
    return this.replace({ ...this.state, fixed60 });
  }

  reset(): void {
    this.replace({ ...DEFAULTS }, true);
  }

  computeSizes(viewportWidth: number, viewportHeight: number): RenderQualitySizes {
    const vw = validDimension(viewportWidth);
    const vh = validDimension(viewportHeight);
    const aspect = vw / vh;
    const inputHeight = this.state.baseHeight;
    // Preserve the live viewport aspect. A 16:9 viewport is exactly 1280×720;
    // portrait and ultrawide screens keep their composition without stretching.
    const inputWidth = validDimension(inputHeight * aspect);
    return {
      viewportWidth: vw,
      viewportHeight: vh,
      inputWidth,
      inputHeight,
      outputWidth: inputWidth * this.state.outputMultiplier,
      outputHeight: inputHeight * this.state.outputMultiplier,
    };
  }

  subscribe(listener: RenderQualityListener, emitCurrent = false): () => void {
    this.listeners.add(listener);
    if (emitCurrent) listener(this.snapshot(), this.revision);
    return () => this.listeners.delete(listener);
  }

  private replace(next: RenderQualityState, force = false): boolean {
    if (
      !force &&
      next.enabled === this.state.enabled &&
      next.baseHeight === this.state.baseHeight &&
      next.outputMultiplier === this.state.outputMultiplier &&
      next.fixed60 === this.state.fixed60
    )
      return false;
    this.state = next;
    this.revision += 1;
    this.persist();
    const snapshot = this.snapshot();
    for (const listener of Array.from(this.listeners)) listener(snapshot, this.revision);
    return true;
  }

  private persist(): void {
    if (!this.persistChanges || !this.storage) return;
    try {
      this.storage.setItem(
        RENDER_QUALITY_STORAGE_KEY,
        JSON.stringify({ version: RENDER_QUALITY_VERSION, ...this.state }),
      );
    } catch {
      // Rendering remains usable when browser storage is unavailable/full.
    }
  }
}

export const renderQualitySettings = new RenderQualitySettings();
