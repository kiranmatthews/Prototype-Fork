import * as THREE from "three";
import {
  FullScreenQuad,
  Pass,
} from "three/examples/jsm/postprocessing/Pass.js";
import {
  CRT_GUEST_CONVERSION_SHADERS,
  CRT_GUEST_FULLSCREEN_VERTEX_SHADER,
  CRT_GUEST_SHADERS,
} from "./generated/shaders";
import {
  disposeCrtGuestLuts,
  type CrtGuestLuts,
} from "./luts";
import {
  CRT_GUEST_QUALITY_DIMENSIONS,
  getCrtGuestParameter,
  type CrtGuestQuality,
  type CrtGuestVariant,
} from "./settings";

export type { CrtGuestQuality, CrtGuestVariant } from "./settings";

/**
 * Structural subset of the settings store used by the render pass. Keeping
 * the renderer coupled to this small surface makes the shader runtime usable
 * in capture tests without constructing the tuning panel.
 */
export interface CrtGuestSettingsLike {
  enabled: boolean;
  variant: CrtGuestVariant;
  quality: CrtGuestQuality;
  revision?: number;
  historyRevision?: number;
  getValue(id: string, variant?: CrtGuestVariant): number;
}

export interface CrtGuestPassOptions {
  luts?: CrtGuestLuts | null;
  disposeLutsOnDispose?: boolean;
  /** Legacy shorthand: initializes both source and output dimensions. */
  width?: number;
  height?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  forceDisabled?: boolean;
  /** Honor `?nocrt` and `?lite`. Defaults to true in a browser. */
  respectDisableQuery?: boolean;
}

export type CrtGuestDebugTarget =
  | "encoded"
  | "stock0"
  | "stock"
  | "afterglow-read"
  | "afterglow-write"
  | "pre"
  | "average-read"
  | "average-write"
  | "linear"
  | "glow-horizontal"
  | "glow"
  | "bloom-horizontal"
  | "bloom"
  | "reconstruction"
  | "main"
  | "deconvergence";

export interface CrtGuestTargetDiagnostic {
  width: number;
  height: number;
  bytesPerPixel: 4 | 8;
  estimatedBytes: number;
}

export interface CrtGuestPassDiagnostics {
  supported: boolean;
  capabilityReason: string | null;
  active: boolean;
  bypassReason: string | null;
  forcedDisabled: boolean;
  lutsReady: boolean;
  runtimeFailure: string | null;
  variant: CrtGuestVariant;
  quality: CrtGuestQuality;
  /** Legacy aliases for outputWidth/outputHeight. */
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  kernelWidth: number;
  kernelHeight: number;
  frameIndex: number;
  renderCount: number;
  bypassCount: number;
  failureCount: number;
  lastDrawCount: number;
  historyClearPending: boolean;
  historyResetCount: number;
  lastHistoryResetReason: string;
  settingsRevision: number | null;
  historyRevision: number | null;
  estimatedTargetBytes: number;
  targets: Partial<Record<CrtGuestDebugTarget, CrtGuestTargetDiagnostic>>;
}

interface CrtGuestShaderSet {
  stock: string;
  afterglow: string;
  pre: string;
  variant4: string;
  variant5: string;
  gaussianHorizontal: string;
  gaussianVertical: string;
  bloomHorizontal: string;
  bloomVertical: string;
  main: string;
  deconvergence: string;
}

interface CrtGuestMaterialSet {
  readonly stock: THREE.RawShaderMaterial;
  readonly afterglow: THREE.RawShaderMaterial;
  readonly pre: THREE.RawShaderMaterial;
  readonly variant4: THREE.RawShaderMaterial;
  readonly variant5: THREE.RawShaderMaterial;
  readonly gaussianHorizontal: THREE.RawShaderMaterial;
  readonly gaussianVertical: THREE.RawShaderMaterial;
  readonly bloomHorizontal: THREE.RawShaderMaterial;
  readonly bloomVertical: THREE.RawShaderMaterial;
  readonly main: THREE.RawShaderMaterial;
  readonly deconvergence: THREE.RawShaderMaterial;
  readonly all: readonly THREE.RawShaderMaterial[];
}

interface CrtGuestTargets {
  readonly encoded: THREE.WebGLRenderTarget;
  readonly stock0: THREE.WebGLRenderTarget;
  readonly stock: THREE.WebGLRenderTarget;
  readonly pre: THREE.WebGLRenderTarget;
  readonly linear: THREE.WebGLRenderTarget;
  readonly glowHorizontal: THREE.WebGLRenderTarget;
  readonly glow: THREE.WebGLRenderTarget;
  readonly bloomHorizontal: THREE.WebGLRenderTarget;
  readonly bloom: THREE.WebGLRenderTarget;
  reconstruction: THREE.WebGLRenderTarget | null;
  readonly main: THREE.WebGLRenderTarget;
  readonly deconvergence: THREE.WebGLRenderTarget;
  readonly afterglow: readonly [
    THREE.WebGLRenderTarget,
    THREE.WebGLRenderTarget,
  ];
  readonly average: readonly [
    THREE.WebGLRenderTarget,
    THREE.WebGLRenderTarget,
  ];
}

const SHADER_LIBRARY = CRT_GUEST_SHADERS as unknown as Record<
  CrtGuestVariant,
  CrtGuestShaderSet
>;

const TEXTURE_UNIFORMS = [
  "Source",
  "StockPass",
  "OriginalHistory0",
  "AfterglowPass",
  "AfterglowPassFeedback",
  "PrePass",
  "AvgLumPass",
  "AvgLumPassFeedback",
  "LinearizePass",
  "GlowPass",
  "BloomPass",
  "Pass1",
  "SamplerLUT1",
  "SamplerLUT2",
  "SamplerLUT3",
  "SamplerLUT4",
] as const;

const RESERVED_SETTING_IDS = new Set([
  "SourceSize",
  "OutputSize",
  "OriginalSize",
  "LinearizePassSize",
  "FrameCount",
]);

const COPY_FRAGMENT = /* glsl */ `
  #version 300 es
  precision highp float;
  precision highp sampler2D;

  uniform sampler2D Source;
  in vec2 vTexCoord;
  out vec4 FragColor;

  void main() {
    FragColor = texture(Source, vTexCoord);
  }
`;

/**
 * Literal WebGL2 execution of the Unity CRT Guest RenderGraph feature.
 *
 * Normal execution performs fourteen fullscreen draws: input conversion,
 * stock twice, afterglow, pre, two variant stages, four glow/bloom stages,
 * main, deconvergence and output conversion. It belongs after the authored
 * Unity post stage and before Three's OutputPass.
 */
export class CrtGuestPass extends Pass {
  private readonly renderer: THREE.WebGLRenderer;
  private settings: CrtGuestSettingsLike;
  private luts: CrtGuestLuts | null;
  private readonly disposeLutsOnDispose: boolean;
  private readonly materialSets: Record<
    CrtGuestVariant,
    CrtGuestMaterialSet
  >;
  private readonly inputMaterial: THREE.RawShaderMaterial;
  private readonly outputMaterial: THREE.RawShaderMaterial;
  private readonly copyMaterial: THREE.RawShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private targets: CrtGuestTargets | null = null;

  private readonly capabilitySupported: boolean;
  private readonly capabilityFailure: string | null;
  private forcedDisabledState: boolean;
  private forcedDisabledReason: string | null;
  private runtimeFailure: string | null = null;
  private disposed = false;

  /** Pre-CRT source dimensions in physical pixels. */
  private width: number;
  private height: number;
  /** Final CRT/display dimensions in physical pixels. */
  private outputWidth: number;
  private outputHeight: number;
  private readonly outputSizeScratch = new THREE.Vector2();
  private variant: CrtGuestVariant;
  private quality: CrtGuestQuality;
  private historyPing = false;
  private historyClearPending = true;
  private frameIndex = 0;
  private renderCount = 0;
  private bypassCount = 0;
  private failureCount = 0;
  private lastDrawCount = 0;
  private historyResetCount = 0;
  private lastHistoryResetReason = "initial allocation";
  private lastHistoryRevision: number | null;
  private readonly appliedSettingsRevision: Record<
    CrtGuestVariant,
    number | null
  > = { advanced: null, hd: null };

  constructor(
    renderer: THREE.WebGLRenderer,
    settings: CrtGuestSettingsLike,
    options: CrtGuestPassOptions = {},
  ) {
    super();
    this.renderer = renderer;
    this.settings = settings;
    this.luts = options.luts ?? null;
    this.disposeLutsOnDispose = options.disposeLutsOnDispose ?? false;
    const legacyWidth = validDimension(options.width ?? 1);
    const legacyHeight = validDimension(options.height ?? 1);
    this.width = validDimension(options.sourceWidth ?? legacyWidth);
    this.height = validDimension(options.sourceHeight ?? legacyHeight);
    this.outputWidth = validDimension(options.outputWidth ?? legacyWidth);
    this.outputHeight = validDimension(options.outputHeight ?? legacyHeight);
    this.variant = validVariant(settings.variant);
    this.quality = validQuality(settings.quality);
    this.lastHistoryRevision = finiteRevision(settings.historyRevision);

    const queryDisable = queryDisableReason(options.respectDisableQuery ?? true);
    this.forcedDisabledState = options.forceDisabled === true || queryDisable !== null;
    this.forcedDisabledReason = options.forceDisabled
      ? "forced by caller"
      : queryDisable;

    const capability = probeCapabilities(renderer);
    this.capabilitySupported = capability.supported;
    this.capabilityFailure = capability.reason;

    this.inputMaterial = makeMaterial(
      "CRTGuest.Input.LinearToSrgb",
      CRT_GUEST_CONVERSION_SHADERS.linearToGuestSrgb,
    );
    this.outputMaterial = makeMaterial(
      "CRTGuest.Output.SrgbToLinear",
      CRT_GUEST_CONVERSION_SHADERS.guestSrgbToLinear,
    );
    this.copyMaterial = makeMaterial("CRTGuest.Bypass", COPY_FRAGMENT);
    this.materialSets = {
      advanced: makeMaterialSet("advanced", SHADER_LIBRARY.advanced),
      hd: makeMaterialSet("hd", SHADER_LIBRARY.hd),
    };
    this.fsQuad = new FullScreenQuad(this.inputMaterial);
    this.bindLuts();
  }

  get supported(): boolean {
    return this.capabilitySupported;
  }

  get active(): boolean {
    return (
      this.enabled &&
      !this.disposed &&
      this.settings.enabled &&
      !this.forcedDisabledState &&
      this.capabilitySupported &&
      this.luts !== null &&
      this.runtimeFailure === null &&
      this.dimensionFailure() === null
    );
  }

  get diagnostics(): CrtGuestPassDiagnostics {
    const [kernelWidth, kernelHeight] = kernelDimensions(this.quality);
    const targets = this.targetDiagnostics();
    return {
      supported: this.capabilitySupported,
      capabilityReason: this.capabilityFailure,
      active: this.active,
      bypassReason: this.bypassReason(),
      forcedDisabled: this.forcedDisabledState,
      lutsReady: this.luts !== null,
      runtimeFailure: this.runtimeFailure,
      variant: this.variant,
      quality: this.quality,
      width: this.outputWidth,
      height: this.outputHeight,
      sourceWidth: this.width,
      sourceHeight: this.height,
      outputWidth: this.outputWidth,
      outputHeight: this.outputHeight,
      kernelWidth,
      kernelHeight,
      frameIndex: this.frameIndex,
      renderCount: this.renderCount,
      bypassCount: this.bypassCount,
      failureCount: this.failureCount,
      lastDrawCount: this.lastDrawCount,
      historyClearPending: this.historyClearPending,
      historyResetCount: this.historyResetCount,
      lastHistoryResetReason: this.lastHistoryResetReason,
      settingsRevision: finiteRevision(this.settings.revision),
      historyRevision: finiteRevision(this.settings.historyRevision),
      estimatedTargetBytes: Object.values(targets).reduce(
        (sum, target) => sum + (target?.estimatedBytes ?? 0),
        0,
      ),
      targets,
    };
  }

  setSettings(settings: CrtGuestSettingsLike): void {
    if (this.settings === settings) return;
    this.settings = settings;
    this.appliedSettingsRevision.advanced = null;
    this.appliedSettingsRevision.hd = null;
    this.lastHistoryRevision = finiteRevision(settings.historyRevision);
    this.resetHistory("settings store changed");
    this.syncSettingsState();
  }

  setLuts(luts: CrtGuestLuts | null): void {
    if (this.luts === luts) return;
    if (this.disposeLutsOnDispose && this.luts) {
      disposeCrtGuestLuts(this.luts);
    }
    this.luts = luts;
    this.bindLuts();
    this.appliedSettingsRevision.advanced = null;
    this.appliedSettingsRevision.hd = null;
    this.resetHistory("LUT set changed");
  }

  setForcedDisabled(disabled: boolean, reason = "forced by caller"): void {
    if (
      this.forcedDisabledState === disabled &&
      (!disabled || this.forcedDisabledReason === reason)
    ) {
      return;
    }
    this.forcedDisabledState = disabled;
    this.forcedDisabledReason = disabled ? reason : null;
    if (!disabled) this.resetHistory("forced disable released");
  }

  /** Force parameter upload and clear both temporal feedback pairs. */
  notifyPresetChanged(): void {
    this.appliedSettingsRevision.advanced = null;
    this.appliedSettingsRevision.hd = null;
    this.resetHistory("preset changed");
  }

  /** Explicit hook for callers that mutate a non-revisioned settings object. */
  notifyVariantChanged(): void {
    this.syncSettingsState(true);
    this.resetHistory("variant changed");
  }

  retryAfterFailure(): void {
    if (this.runtimeFailure === null) return;
    this.runtimeFailure = null;
    this.disposeTargets();
    this.resetHistory("runtime retry");
  }

  resetHistory(reason = "requested by caller"): void {
    this.historyPing = false;
    this.historyClearPending = true;
    this.historyResetCount += 1;
    this.lastHistoryResetReason = reason;
  }

  override setSize(width: number, height: number): void {
    this.setResolution(width, height, width, height);
  }

  setInputSize(width: number, height: number): void {
    const nextWidth = validDimension(width);
    const nextHeight = validDimension(height);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    if (this.targets) this.resizeTargets(this.targets);
    this.resetHistory("source size changed");
  }

  setOutputSize(width: number, height: number): void {
    const nextWidth = validDimension(width);
    const nextHeight = validDimension(height);
    if (
      nextWidth === this.outputWidth &&
      nextHeight === this.outputHeight
    ) {
      return;
    }
    this.outputWidth = nextWidth;
    this.outputHeight = nextHeight;
    if (this.targets) this.resizeTargets(this.targets);
  }

  setResolution(
    sourceWidth: number,
    sourceHeight: number,
    outputWidth: number,
    outputHeight: number,
  ): void {
    const nextSourceWidth = validDimension(sourceWidth);
    const nextSourceHeight = validDimension(sourceHeight);
    const nextOutputWidth = validDimension(outputWidth);
    const nextOutputHeight = validDimension(outputHeight);
    const sourceChanged =
      nextSourceWidth !== this.width || nextSourceHeight !== this.height;
    const outputChanged =
      nextOutputWidth !== this.outputWidth ||
      nextOutputHeight !== this.outputHeight;
    if (!sourceChanged && !outputChanged) return;
    this.width = nextSourceWidth;
    this.height = nextSourceHeight;
    this.outputWidth = nextOutputWidth;
    this.outputHeight = nextOutputHeight;
    if (this.targets) this.resizeTargets(this.targets);
    if (sourceChanged) this.resetHistory("source size changed");
  }

  getDebugTexture(name: CrtGuestDebugTarget): THREE.Texture | null {
    const targets = this.targets;
    if (!targets) return null;
    const read = this.historyPing ? 1 : 0;
    const write = this.historyPing ? 0 : 1;
    switch (name) {
      case "encoded":
        return targets.encoded.texture;
      case "stock0":
        return targets.stock0.texture;
      case "stock":
        return targets.stock.texture;
      case "afterglow-read":
        return targets.afterglow[read].texture;
      case "afterglow-write":
        return targets.afterglow[write].texture;
      case "pre":
        return targets.pre.texture;
      case "average-read":
        return targets.average[read].texture;
      case "average-write":
        return targets.average[write].texture;
      case "linear":
        return targets.linear.texture;
      case "glow-horizontal":
        return targets.glowHorizontal.texture;
      case "glow":
        return targets.glow.texture;
      case "bloom-horizontal":
        return targets.bloomHorizontal.texture;
      case "bloom":
        return targets.bloom.texture;
      case "reconstruction":
        return targets.reconstruction?.texture ?? null;
      case "main":
        return targets.main.texture;
      case "deconvergence":
        return targets.deconvergence.texture;
    }
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed) return;
    if (renderer !== this.renderer) {
      this.recordFailure("rendered with a different WebGLRenderer");
    }
    if (readBuffer.width !== this.width || readBuffer.height !== this.height) {
      this.setInputSize(readBuffer.width, readBuffer.height);
    }
    if (!this.renderToScreen) {
      if (
        writeBuffer.width !== this.outputWidth ||
        writeBuffer.height !== this.outputHeight
      ) {
        this.setOutputSize(writeBuffer.width, writeBuffer.height);
      }
    } else {
      const drawingBufferSize = renderer.getDrawingBufferSize(
        this.outputSizeScratch,
      );
      if (
        drawingBufferSize.x !== this.outputWidth ||
        drawingBufferSize.y !== this.outputHeight
      ) {
        this.setOutputSize(drawingBufferSize.x, drawingBufferSize.y);
      }
    }
    this.syncSettingsState();

    if (!this.active) {
      this.bypassCount += 1;
      this.lastDrawCount = 1;
      this.renderBypass(renderer, writeBuffer, readBuffer, maskActive);
      return;
    }

    let failure: unknown = null;
    const oldAutoClear = renderer.autoClear;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);
    renderer.autoClear = false;

    try {
      const targets = this.ensureTargets();
      if (this.historyClearPending) this.clearHistory(renderer, targets);
      this.applySettings(this.variant);
      this.lastDrawCount = this.executeGraph(
        renderer,
        writeBuffer,
        readBuffer,
        targets,
      );
      this.historyPing = !this.historyPing;
      this.historyClearPending = false;
      this.frameIndex = (this.frameIndex + 1) >>> 0;
      this.renderCount += 1;
    } catch (error) {
      failure = error;
    } finally {
      if (maskActive) stencil.setTest(true);
      renderer.autoClear = oldAutoClear;
    }

    if (failure !== null) {
      this.recordFailure(errorMessage(failure));
      this.lastDrawCount = 1;
      this.renderBypass(renderer, writeBuffer, readBuffer, maskActive);
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.disposeTargets();
    this.inputMaterial.dispose();
    this.outputMaterial.dispose();
    this.copyMaterial.dispose();
    for (const variant of ["advanced", "hd"] as const) {
      for (const material of this.materialSets[variant].all) material.dispose();
    }
    this.fsQuad.dispose();
    if (this.disposeLutsOnDispose && this.luts) {
      disposeCrtGuestLuts(this.luts);
    }
    this.luts = null;
  }

  private executeGraph(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    targets: CrtGuestTargets,
  ): number {
    const materials = this.materialSets[this.variant];
    const readIndex = this.historyPing ? 1 : 0;
    const writeIndex = this.historyPing ? 0 : 1;
    const afterglowRead = targets.afterglow[readIndex];
    const afterglowWrite = targets.afterglow[writeIndex];
    const averageRead = targets.average[readIndex];
    const averageWrite = targets.average[writeIndex];
    const [kernelWidth, kernelHeight] = kernelDimensions(this.quality);
    const bloomHorizontalHeight =
      this.variant === "advanced" ? kernelHeight : this.height;
    const bloomHeight =
      this.variant === "advanced" ? this.height : kernelHeight;
    let draws = 0;

    bindTexture(this.inputMaterial, "Source", readBuffer.texture);
    this.draw(renderer, targets.encoded, this.inputMaterial);
    draws += 1;

    configureStage(
      materials.stock,
      this.width,
      this.height,
      this.width,
      this.height,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(materials.stock, "Source", targets.encoded.texture);
    this.draw(renderer, targets.stock0, materials.stock);
    draws += 1;
    bindTexture(materials.stock, "Source", targets.stock0.texture);
    this.draw(renderer, targets.stock, materials.stock);
    draws += 1;

    configureStage(
      materials.afterglow,
      this.width,
      this.height,
      this.width,
      this.height,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(materials.afterglow, "Source", targets.stock.texture);
    bindTexture(
      materials.afterglow,
      "OriginalHistory0",
      targets.encoded.texture,
    );
    bindTexture(
      materials.afterglow,
      "AfterglowPassFeedback",
      afterglowRead.texture,
    );
    this.draw(renderer, afterglowWrite, materials.afterglow);
    draws += 1;

    configureStage(
      materials.pre,
      this.width,
      this.height,
      this.width,
      this.height,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(materials.pre, "Source", afterglowWrite.texture);
    bindTexture(materials.pre, "StockPass", targets.stock.texture);
    bindTexture(materials.pre, "AfterglowPass", afterglowWrite.texture);
    this.draw(renderer, targets.pre, materials.pre);
    draws += 1;

    if (this.variant === "advanced") {
      configureStage(
        materials.variant4,
        this.width,
        this.height,
        this.width,
        this.height,
        this.width,
        this.height,
        this.frameIndex,
      );
      bindTexture(materials.variant4, "Source", targets.pre.texture);
      bindTexture(
        materials.variant4,
        "AvgLumPassFeedback",
        averageRead.texture,
      );
      this.draw(renderer, averageWrite, materials.variant4);
      draws += 1;

      configureStage(
        materials.variant5,
        this.width,
        this.height,
        this.width,
        this.height,
        this.width,
        this.height,
        this.frameIndex,
      );
      bindTexture(materials.variant5, "Source", targets.pre.texture);
      bindTexture(materials.variant5, "PrePass", targets.pre.texture);
      this.draw(renderer, targets.linear, materials.variant5);
      draws += 1;
    } else {
      configureStage(
        materials.variant4,
        this.width,
        this.height,
        this.width,
        this.height,
        this.width,
        this.height,
        this.frameIndex,
      );
      bindTexture(materials.variant4, "Source", targets.pre.texture);
      this.draw(renderer, targets.linear, materials.variant4);
      draws += 1;

      const reconstruction = targets.reconstruction;
      if (!reconstruction) {
        throw new Error("HD reconstruction target was not allocated");
      }
      configureStage(
        materials.variant5,
        this.width,
        this.height,
        this.outputWidth,
        this.height,
        this.width,
        this.height,
        this.frameIndex,
      );
      bindTexture(materials.variant5, "Source", targets.linear.texture);
      bindTexture(
        materials.variant5,
        "LinearizePass",
        targets.linear.texture,
      );
      this.draw(renderer, reconstruction, materials.variant5);
      draws += 1;
    }

    configureStage(
      materials.gaussianHorizontal,
      this.width,
      this.height,
      kernelWidth,
      this.height,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(
      materials.gaussianHorizontal,
      "Source",
      targets.linear.texture,
    );
    bindTexture(
      materials.gaussianHorizontal,
      "LinearizePass",
      targets.linear.texture,
    );
    this.draw(renderer, targets.glowHorizontal, materials.gaussianHorizontal);
    draws += 1;

    configureStage(
      materials.gaussianVertical,
      kernelWidth,
      this.height,
      kernelWidth,
      kernelHeight,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(
      materials.gaussianVertical,
      "Source",
      targets.glowHorizontal.texture,
    );
    this.draw(renderer, targets.glow, materials.gaussianVertical);
    draws += 1;

    configureStage(
      materials.bloomHorizontal,
      this.width,
      this.height,
      kernelWidth,
      bloomHorizontalHeight,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(
      materials.bloomHorizontal,
      "Source",
      targets.linear.texture,
    );
    bindTexture(
      materials.bloomHorizontal,
      "LinearizePass",
      targets.linear.texture,
    );
    this.draw(renderer, targets.bloomHorizontal, materials.bloomHorizontal);
    draws += 1;

    configureStage(
      materials.bloomVertical,
      kernelWidth,
      bloomHorizontalHeight,
      this.width,
      bloomHeight,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(
      materials.bloomVertical,
      "Source",
      targets.bloomHorizontal.texture,
    );
    this.draw(renderer, targets.bloom, materials.bloomVertical);
    draws += 1;

    const mainSource =
      this.variant === "advanced"
        ? targets.linear
        : targets.reconstruction;
    if (!mainSource) throw new Error("CRT Guest main source is unavailable");
    configureStage(
      materials.main,
      mainSource.width,
      mainSource.height,
      this.outputWidth,
      this.outputHeight,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(materials.main, "Source", mainSource.texture);
    bindTexture(materials.main, "LinearizePass", targets.linear.texture);
    bindTexture(materials.main, "PrePass", targets.pre.texture);
    bindTexture(materials.main, "BloomPass", targets.bloom.texture);
    if (this.variant === "advanced") {
      bindTexture(materials.main, "AvgLumPass", averageWrite.texture);
    } else {
      bindTexture(materials.main, "Pass1", mainSource.texture);
    }
    this.draw(renderer, targets.main, materials.main);
    draws += 1;

    configureStage(
      materials.deconvergence,
      this.outputWidth,
      this.outputHeight,
      this.outputWidth,
      this.outputHeight,
      this.width,
      this.height,
      this.frameIndex,
    );
    bindTexture(materials.deconvergence, "Source", targets.main.texture);
    bindTexture(materials.deconvergence, "StockPass", targets.stock.texture);
    bindTexture(
      materials.deconvergence,
      "LinearizePass",
      targets.linear.texture,
    );
    bindTexture(materials.deconvergence, "PrePass", targets.pre.texture);
    bindTexture(materials.deconvergence, "GlowPass", targets.glow.texture);
    bindTexture(materials.deconvergence, "BloomPass", targets.bloom.texture);
    if (this.variant === "advanced") {
      bindTexture(
        materials.deconvergence,
        "AvgLumPass",
        averageWrite.texture,
      );
    }
    this.draw(renderer, targets.deconvergence, materials.deconvergence);
    draws += 1;

    bindTexture(
      this.outputMaterial,
      "Source",
      targets.deconvergence.texture,
    );
    this.draw(
      renderer,
      this.renderToScreen ? null : writeBuffer,
      this.outputMaterial,
      this.clear,
    );
    draws += 1;
    return draws;
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget | null,
    material: THREE.Material,
    clear = false,
  ): void {
    this.fsQuad.material = material;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear();
    this.fsQuad.render(renderer);
  }

  private renderBypass(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    maskActive: boolean,
  ): void {
    const oldAutoClear = renderer.autoClear;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);
    renderer.autoClear = false;
    try {
      bindTexture(this.copyMaterial, "Source", readBuffer.texture);
      this.draw(
        renderer,
        this.renderToScreen ? null : writeBuffer,
        this.copyMaterial,
        this.clear,
      );
    } finally {
      if (maskActive) stencil.setTest(true);
      renderer.autoClear = oldAutoClear;
    }
  }

  private ensureTargets(): CrtGuestTargets {
    if (this.targets) return this.targets;
    const rgba8 = (name: string): THREE.WebGLRenderTarget =>
      makeTarget(1, 1, THREE.UnsignedByteType, name);
    const rgba16f = (name: string): THREE.WebGLRenderTarget =>
      makeTarget(1, 1, THREE.HalfFloatType, name);
    this.targets = {
      encoded: rgba8("CRTGuest.Encoded.RGBA8"),
      stock0: rgba8("CRTGuest.Stock0.RGBA8"),
      stock: rgba8("CRTGuest.Stock.RGBA8"),
      pre: rgba8("CRTGuest.Pre.RGBA8"),
      linear: rgba16f("CRTGuest.Linear.RGBA16F"),
      glowHorizontal: rgba16f("CRTGuest.GlowHorizontal.RGBA16F"),
      glow: rgba16f("CRTGuest.Glow.RGBA16F"),
      bloomHorizontal: rgba16f("CRTGuest.BloomHorizontal.RGBA16F"),
      bloom: rgba16f("CRTGuest.Bloom.RGBA16F"),
      reconstruction: null,
      main: rgba16f("CRTGuest.Main.RGBA16F"),
      deconvergence: rgba16f("CRTGuest.Deconvergence.RGBA16F"),
      afterglow: [
        rgba8("CRTGuest.AfterglowA.RGBA8"),
        rgba8("CRTGuest.AfterglowB.RGBA8"),
      ],
      average: [
        rgba8("CRTGuest.AverageA.RGBA8"),
        rgba8("CRTGuest.AverageB.RGBA8"),
      ],
    };
    this.resizeTargets(this.targets);
    this.resetHistory("targets allocated");
    return this.targets;
  }

  private resizeTargets(targets: CrtGuestTargets): void {
    const [kernelWidth, kernelHeight] = kernelDimensions(this.quality);
    const bloomHorizontalHeight =
      this.variant === "advanced" ? kernelHeight : this.height;
    const bloomHeight =
      this.variant === "advanced" ? this.height : kernelHeight;

    for (const target of [
      targets.encoded,
      targets.stock0,
      targets.stock,
      targets.pre,
      targets.linear,
      ...targets.afterglow,
      ...targets.average,
    ]) {
      resizeTarget(target, this.width, this.height);
    }
    resizeTarget(targets.main, this.outputWidth, this.outputHeight);
    resizeTarget(
      targets.deconvergence,
      this.outputWidth,
      this.outputHeight,
    );
    configurePreMipmaps(targets.pre, this.variant === "advanced");
    resizeTarget(targets.glowHorizontal, kernelWidth, this.height);
    resizeTarget(targets.glow, kernelWidth, kernelHeight);
    resizeTarget(
      targets.bloomHorizontal,
      kernelWidth,
      bloomHorizontalHeight,
    );
    resizeTarget(targets.bloom, this.width, bloomHeight);

    if (this.variant === "hd") {
      if (!targets.reconstruction) {
        targets.reconstruction = makeTarget(
          this.outputWidth,
          this.height,
          THREE.HalfFloatType,
          "CRTGuest.Reconstruction.RGBA16F",
        );
      } else {
        resizeTarget(
          targets.reconstruction,
          this.outputWidth,
          this.height,
        );
      }
    } else if (targets.reconstruction) {
      targets.reconstruction.dispose();
      targets.reconstruction = null;
    }
  }

  private clearHistory(
    renderer: THREE.WebGLRenderer,
    targets: CrtGuestTargets,
  ): void {
    const previousColor = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    try {
      for (const target of [...targets.afterglow, ...targets.average]) {
        renderer.setRenderTarget(target);
        renderer.clear(true, false, false);
      }
    } finally {
      renderer.setClearColor(previousColor, previousAlpha);
    }
  }

  private syncSettingsState(forceVariant = false): void {
    const nextVariant = validVariant(this.settings.variant);
    const nextQuality = validQuality(this.settings.quality);
    if (forceVariant || nextVariant !== this.variant) {
      this.variant = nextVariant;
      if (this.targets) this.resizeTargets(this.targets);
      this.appliedSettingsRevision[nextVariant] = null;
      this.resetHistory("variant changed");
    }
    if (nextQuality !== this.quality) {
      this.quality = nextQuality;
      if (this.targets) this.resizeTargets(this.targets);
    }

    const historyRevision = finiteRevision(this.settings.historyRevision);
    if (
      historyRevision !== null &&
      this.lastHistoryRevision !== null &&
      historyRevision !== this.lastHistoryRevision
    ) {
      this.resetHistory("settings history revision changed");
    }
    this.lastHistoryRevision = historyRevision;
  }

  private applySettings(variant: CrtGuestVariant): void {
    const revision = finiteRevision(this.settings.revision);
    if (
      revision !== null &&
      this.appliedSettingsRevision[variant] === revision
    ) {
      return;
    }
    for (const material of this.materialSets[variant].all) {
      for (const uniformName of Object.keys(material.uniforms)) {
        const id = settingIdForUniform(uniformName);
        if (!id || RESERVED_SETTING_IDS.has(id)) continue;
        if (!getCrtGuestParameter(id)) continue;
        const value = this.settings.getValue(id, variant);
        if (!Number.isFinite(value)) {
          throw new Error(`CRT Guest setting '${id}' is not finite`);
        }
        material.uniforms[uniformName].value = value;
      }
    }
    this.appliedSettingsRevision[variant] = revision;
  }

  private bindLuts(): void {
    const values: Record<string, THREE.Texture | null> = {
      SamplerLUT1: this.luts?.trinitron ?? null,
      SamplerLUT2: this.luts?.inverseTrinitron ?? null,
      SamplerLUT3: this.luts?.nec ?? null,
      SamplerLUT4: this.luts?.ntsc ?? null,
    };
    for (const variant of ["advanced", "hd"] as const) {
      for (const material of this.materialSets[variant].all) {
        for (const [name, texture] of Object.entries(values)) {
          bindTexture(material, name, texture);
        }
      }
    }
  }

  private recordFailure(detail: string): void {
    this.runtimeFailure = detail;
    this.failureCount += 1;
  }

  private bypassReason(): string | null {
    if (this.disposed) return "disposed";
    if (!this.enabled) return "Pass.enabled is false";
    if (!this.settings.enabled) return "disabled in CRT settings";
    if (this.forcedDisabledState) {
      return this.forcedDisabledReason ?? "forced disabled";
    }
    if (!this.capabilitySupported) {
      return this.capabilityFailure ?? "unsupported WebGL2 capabilities";
    }
    if (!this.luts) return "CRT LUTs are not ready";
    if (this.runtimeFailure) return this.runtimeFailure;
    return this.dimensionFailure();
  }

  private dimensionFailure(): string | null {
    const maximum = this.renderer.capabilities.maxTextureSize;
    const [kernelWidth, kernelHeight] = kernelDimensions(this.quality);
    const largest = Math.max(
      this.width,
      this.height,
      this.outputWidth,
      this.outputHeight,
      kernelWidth,
      kernelHeight,
    );
    return largest > maximum
      ? `CRT target dimension ${largest} exceeds MAX_TEXTURE_SIZE ${maximum}`
      : null;
  }

  private disposeTargets(): void {
    if (!this.targets) return;
    const targets = this.targets;
    const all = new Set<THREE.WebGLRenderTarget>([
      targets.encoded,
      targets.stock0,
      targets.stock,
      targets.pre,
      targets.linear,
      targets.glowHorizontal,
      targets.glow,
      targets.bloomHorizontal,
      targets.bloom,
      targets.main,
      targets.deconvergence,
      ...targets.afterglow,
      ...targets.average,
    ]);
    if (targets.reconstruction) all.add(targets.reconstruction);
    for (const target of all) target.dispose();
    this.targets = null;
  }

  private targetDiagnostics(): Partial<
    Record<CrtGuestDebugTarget, CrtGuestTargetDiagnostic>
  > {
    const targets = this.targets;
    if (!targets) return {};
    const read = this.historyPing ? 1 : 0;
    const write = this.historyPing ? 0 : 1;
    const diagnostic: Partial<
      Record<CrtGuestDebugTarget, CrtGuestTargetDiagnostic>
    > = {
      encoded: targetDiagnostic(targets.encoded, 4),
      stock0: targetDiagnostic(targets.stock0, 4),
      stock: targetDiagnostic(targets.stock, 4),
      "afterglow-read": targetDiagnostic(targets.afterglow[read], 4),
      "afterglow-write": targetDiagnostic(targets.afterglow[write], 4),
      pre: targetDiagnostic(
        targets.pre,
        4,
        this.variant === "advanced" ? 4 / 3 : 1,
      ),
      "average-read": targetDiagnostic(targets.average[read], 4),
      "average-write": targetDiagnostic(targets.average[write], 4),
      linear: targetDiagnostic(targets.linear, 8),
      "glow-horizontal": targetDiagnostic(targets.glowHorizontal, 8),
      glow: targetDiagnostic(targets.glow, 8),
      "bloom-horizontal": targetDiagnostic(targets.bloomHorizontal, 8),
      bloom: targetDiagnostic(targets.bloom, 8),
      main: targetDiagnostic(targets.main, 8),
      deconvergence: targetDiagnostic(targets.deconvergence, 8),
    };
    if (targets.reconstruction) {
      diagnostic.reconstruction = targetDiagnostic(targets.reconstruction, 8);
    }
    return diagnostic;
  }
}

function makeMaterialSet(
  variant: CrtGuestVariant,
  shaders: CrtGuestShaderSet,
): CrtGuestMaterialSet {
  const make = (stage: keyof CrtGuestShaderSet): THREE.RawShaderMaterial =>
    makeMaterial(`CRTGuest.${variant}.${stage}`, shaders[stage]);
  const set = {
    stock: make("stock"),
    afterglow: make("afterglow"),
    pre: make("pre"),
    variant4: make("variant4"),
    variant5: make("variant5"),
    gaussianHorizontal: make("gaussianHorizontal"),
    gaussianVertical: make("gaussianVertical"),
    bloomHorizontal: make("bloomHorizontal"),
    bloomVertical: make("bloomVertical"),
    main: make("main"),
    deconvergence: make("deconvergence"),
  };
  return {
    ...set,
    all: Object.values(set),
  };
}

function makeMaterial(name: string, fragment: string): THREE.RawShaderMaterial {
  const uniforms = discoverUniforms(
    `${CRT_GUEST_FULLSCREEN_VERTEX_SHADER}\n${fragment}`,
  );
  for (const sampler of TEXTURE_UNIFORMS) {
    uniforms[sampler] ??= { value: null };
  }
  return new THREE.RawShaderMaterial({
    name,
    glslVersion: THREE.GLSL3,
    vertexShader: withoutVersionDirective(CRT_GUEST_FULLSCREEN_VERTEX_SHADER),
    fragmentShader: withoutVersionDirective(fragment),
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    toneMapped: false,
  });
}

function discoverUniforms(source: string): Record<string, THREE.IUniform> {
  const uniforms: Record<string, THREE.IUniform> = {};
  const declaration =
    /uniform\s+(?:(?:lowp|mediump|highp)\s+)?(sampler2D|float|int|uint|bool|vec2|vec3|vec4)\s+([A-Za-z_]\w*)\s*(?:\[[^\]]+\])?\s*;/g;
  for (const match of source.matchAll(declaration)) {
    const type = match[1];
    const name = match[2];
    if (!type || !name || uniforms[name]) continue;
    uniforms[name] = { value: initialUniformValue(type) };
  }
  return uniforms;
}

function initialUniformValue(type: string): unknown {
  switch (type) {
    case "sampler2D":
      return null;
    case "vec2":
      return new THREE.Vector2();
    case "vec3":
      return new THREE.Vector3();
    case "vec4":
      return new THREE.Vector4();
    case "bool":
      return false;
    default:
      return 0;
  }
}

function configureStage(
  material: THREE.RawShaderMaterial,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  linearWidth: number,
  linearHeight: number,
  frameIndex: number,
): void {
  const sourceSize = sizeVector(sourceWidth, sourceHeight);
  const outputSize = sizeVector(outputWidth, outputHeight);
  const originalSize = sizeVector(linearWidth, linearHeight);
  const linearSize = sizeVector(linearWidth, linearHeight);
  for (const prefix of ["uParams_", "uGlobal_", "params_", "global_"]) {
    setVectorUniform(material, `${prefix}SourceSize`, sourceSize);
    setVectorUniform(material, `${prefix}OutputSize`, outputSize);
    setVectorUniform(material, `${prefix}OriginalSize`, originalSize);
    setVectorUniform(material, `${prefix}LinearizePassSize`, linearSize);
    setNumberUniform(material, `${prefix}FrameCount`, frameIndex);
  }
}

function bindTexture(
  material: THREE.RawShaderMaterial,
  name: string,
  texture: THREE.Texture | null,
): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = texture;
}

function setVectorUniform(
  material: THREE.RawShaderMaterial,
  name: string,
  source: THREE.Vector4,
): void {
  const uniform = material.uniforms[name];
  if (!uniform) return;
  if (uniform.value instanceof THREE.Vector4) {
    uniform.value.copy(source);
  } else {
    uniform.value = source.clone();
  }
}

function setNumberUniform(
  material: THREE.RawShaderMaterial,
  name: string,
  value: number,
): void {
  const uniform = material.uniforms[name];
  if (uniform) uniform.value = value;
}

function sizeVector(width: number, height: number): THREE.Vector4 {
  return new THREE.Vector4(width, height, 1 / width, 1 / height);
}

function settingIdForUniform(uniformName: string): string | null {
  for (const prefix of ["uParams_", "uGlobal_", "params_", "global_"]) {
    if (uniformName.startsWith(prefix)) return uniformName.slice(prefix.length);
  }
  return null;
}

function makeTarget(
  width: number,
  height: number,
  type: THREE.TextureDataType,
  name: string,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type,
    internalFormat: type === THREE.HalfFloatType ? "RGBA16F" : "RGBA8",
    colorSpace: THREE.NoColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
  });
  target.texture.name = name;
  return target;
}

function resizeTarget(
  target: THREE.WebGLRenderTarget,
  width: number,
  height: number,
): void {
  if (target.width === width && target.height === height) return;
  target.setSize(width, height);
}

function configurePreMipmaps(
  target: THREE.WebGLRenderTarget,
  enabled: boolean,
): void {
  const texture = target.texture;
  const minFilter = enabled
    ? THREE.LinearMipmapLinearFilter
    : THREE.LinearFilter;
  if (
    texture.generateMipmaps === enabled &&
    texture.minFilter === minFilter
  ) {
    return;
  }
  texture.generateMipmaps = enabled;
  texture.minFilter = minFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

function probeCapabilities(renderer: THREE.WebGLRenderer): {
  supported: boolean;
  reason: string | null;
} {
  if (!renderer.capabilities.isWebGL2) {
    return { supported: false, reason: "CRT Guest requires WebGL2" };
  }
  if (!renderer.extensions.has("EXT_color_buffer_float")) {
    return {
      supported: false,
      reason: "EXT_color_buffer_float is unavailable",
    };
  }
  const target = makeTarget(
    1,
    1,
    THREE.HalfFloatType,
    "CRTGuest.CapabilityProbe",
  );
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMip = renderer.getActiveMipmapLevel();
  try {
    renderer.setRenderTarget(target);
    const gl = renderer.getContext();
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      return {
        supported: false,
        reason: `RGBA16F framebuffer incomplete (0x${status.toString(16)})`,
      };
    }
  } catch (error) {
    return { supported: false, reason: errorMessage(error) };
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousMip);
    target.dispose();
  }
  return { supported: true, reason: null };
}

function targetDiagnostic(
  target: THREE.WebGLRenderTarget,
  bytesPerPixel: 4 | 8,
  multiplier = 1,
): CrtGuestTargetDiagnostic {
  return {
    width: target.width,
    height: target.height,
    bytesPerPixel,
    estimatedBytes: Math.ceil(
      target.width * target.height * bytesPerPixel * multiplier,
    ),
  };
}

function validDimension(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function validVariant(value: CrtGuestVariant): CrtGuestVariant {
  return value === "advanced" ? "advanced" : "hd";
}

function validQuality(value: CrtGuestQuality): CrtGuestQuality {
  if (value === "exact" || value === "balanced") return value;
  return "apple-tv";
}

function kernelDimensions(
  quality: CrtGuestQuality,
): readonly [number, number] {
  const dimensions = CRT_GUEST_QUALITY_DIMENSIONS[quality];
  return [dimensions.width, dimensions.height];
}

function finiteRevision(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) ? value : null;
}

function queryDisableReason(respect: boolean): string | null {
  if (!respect || typeof window === "undefined") return null;
  const query = new URLSearchParams(window.location.search);
  if (query.has("nocrt")) return "disabled by ?nocrt";
  if (query.has("lite")) return "disabled by ?lite";
  return null;
}

function withoutVersionDirective(source: string): string {
  return source.replace(/^\s*#version\s+300\s+es\s*(?:\r?\n)?/, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
