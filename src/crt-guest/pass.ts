import * as THREE from "three";
import { planCrt, specializeCrt, fusePreLinear, optimizePreColour, optimizeHdFilter, gaussianShader, CRT_AFTERGLOW_SHADER, type CrtPlan } from "./optimize";
import { setCrtControlSourceHeight } from './controls';
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
  /** Leave the completed guest-sRGB texture for CrtGuestOutputPass. The caller
   * owns final presentation; this mode never writes/swaps the input buffer. */
  deferOutput?: boolean;
  /** Hand the configured final stage to the display owner. Requires deferOutput. */
  deferDeconvergence?: boolean;
}

export interface CrtGuestDeferredDeconvergence {
  readonly material: THREE.RawShaderMaterial;
  readonly width: number;
  readonly height: number;
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
  | "edges"
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
  outputDeferred: boolean;
  deconvergenceDeferred: boolean;
  historyClearPending: boolean;
  historyResetCount: number;
  lastHistoryResetReason: string;
  settingsRevision: number | null;
  historyRevision: number | null;
  estimatedTargetBytes: number;
  graph: CrtPlan;
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
  readonly edges: THREE.RawShaderMaterial;
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
  stock: THREE.WebGLRenderTarget | null;
  pre: THREE.WebGLRenderTarget | null;
  readonly linear: THREE.WebGLRenderTarget;
  glowHorizontal: THREE.WebGLRenderTarget | null;
  glow: THREE.WebGLRenderTarget | null;
  bloomHorizontal: THREE.WebGLRenderTarget | null;
  bloom: THREE.WebGLRenderTarget | null;
  reconstruction: THREE.WebGLRenderTarget | null;
  readonly main: THREE.WebGLRenderTarget;
  readonly deconvergence: THREE.WebGLRenderTarget | null;
  afterglow: readonly [
    THREE.WebGLRenderTarget,
    THREE.WebGLRenderTarget,
  ] | null;
  average: readonly [
    THREE.WebGLRenderTarget,
    THREE.WebGLRenderTarget,
  ] | null;
  edges: THREE.WebGLRenderTarget | null;
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

/** Dependency-driven CRT Guest graph. The old graph needs twelve draws even
 * with inactive effects. This executes only contributing stages, specializes
 * neutral shader paths and fuses source-pixel colour preparation where safe. */
export class CrtGuestPass extends Pass {
  private readonly renderer: THREE.WebGLRenderer;
  private settings: CrtGuestSettingsLike;
  private luts: CrtGuestLuts | null;
  private readonly disposeLutsOnDispose: boolean;
  private readonly deferOutput: boolean;
  private readonly deferDeconvergence: boolean;
  private deferredDeconvergenceStage: CrtGuestDeferredDeconvergence | null = null;
  private deferredOutputTexture: THREE.Texture | null = null;
  private completedOutputRevision: number | null = null;
  private readonly materialSets: Record<
    CrtGuestVariant,
    CrtGuestMaterialSet
  >;
  private readonly inputMaterial: THREE.RawShaderMaterial;
  private readonly outputMaterial: THREE.RawShaderMaterial;
  private readonly copyMaterial: THREE.RawShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private targets: CrtGuestTargets | null = null;
  private plan: CrtPlan;
  private planKey = "";
  private shaderRevision: number | null = null;
  private shaderSizeKey = "";
  private commandsDirty = true;
  private drawCommands: { material: THREE.RawShaderMaterial; target: THREE.WebGLRenderTarget | readonly [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] }[] = [];
  private frameUniforms: THREE.IUniform[] = [];

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
    this.plan = planCrt(settings, options.sourceHeight ?? options.height ?? 1);
    this.luts = options.luts ?? null;
    this.disposeLutsOnDispose = options.disposeLutsOnDispose ?? false;
    this.deferOutput = options.deferOutput ?? false;
    this.deferDeconvergence = this.deferOutput && (options.deferDeconvergence ?? false);
    this.needsSwap = !this.deferOutput;
    const legacyWidth = validDimension(options.width ?? 1);
    const legacyHeight = validDimension(options.height ?? 1);
    this.width = validDimension(options.sourceWidth ?? legacyWidth);
    this.height = validDimension(options.sourceHeight ?? legacyHeight);
    setCrtControlSourceHeight(settings, this.height);
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
      opaqueStockInputShader(CRT_GUEST_CONVERSION_SHADERS.linearToGuestSrgb),
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

  /** Completed current output, never a stale texture after bypass or failure. */
  get deferredOutput(): THREE.Texture | null {
    return this.active && this.completedOutputRevision === finiteRevision(this.settings.revision)
      ? this.deferredOutputTexture : null;
  }

  /** Borrowed final-stage material, valid only after a complete current graph. */
  get deferredDeconvergence(): CrtGuestDeferredDeconvergence | null {
    return this.active && this.completedOutputRevision === finiteRevision(this.settings.revision)
      ? this.deferredDeconvergenceStage : null;
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
      outputDeferred: this.deferOutput,
      deconvergenceDeferred: this.deferDeconvergence,
      historyClearPending: this.historyClearPending,
      historyResetCount: this.historyResetCount,
      lastHistoryResetReason: this.lastHistoryResetReason,
      settingsRevision: finiteRevision(this.settings.revision),
      historyRevision: finiteRevision(this.settings.historyRevision),
      estimatedTargetBytes: Object.values(targets).reduce(
        (sum, target) => sum + (target?.estimatedBytes ?? 0),
        0,
      ),
      graph: { ...this.plan },
      targets,
    };
  }

  setSettings(settings: CrtGuestSettingsLike): void {
    if (this.settings === settings) return;
    this.settings = settings;
    this.shaderRevision = null;
    setCrtControlSourceHeight(settings, this.height);
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
    this.shaderRevision = null;
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
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
    this.historyPing = false;
    this.historyClearPending = true;
    this.historyResetCount += 1;
    this.lastHistoryResetReason = reason;
  }

  /** Turning the effect off must release its frame/history buffers too. */
  releaseInactiveTargets(): void {
    if (this.active || !this.targets) return;
    this.disposeTargets();
    this.resetHistory("inactive CRT targets released");
    this.lastDrawCount = 0;
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
    setCrtControlSourceHeight(this.settings, this.height);
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
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
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
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
    setCrtControlSourceHeight(this.settings, this.height);
    this.outputWidth = nextOutputWidth;
    this.outputHeight = nextOutputHeight;
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
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
      case "stock0":
        // Legacy RGB review aliases for the now-fused encoding/stock stages.
        // Their downstream consumers never used the encoded source alpha.
        return targets.stock?.texture ?? null;
      case "stock":
        return targets.stock?.texture ?? null;
      case "afterglow-read":
        return targets.afterglow?.[read].texture ?? null;
      case "afterglow-write":
        return targets.afterglow?.[write].texture ?? null;
      case "pre":
        return targets.pre?.texture ?? null;
      case "average-read":
        return targets.average?.[read].texture ?? null;
      case "average-write":
        return targets.average?.[write].texture ?? null;
      case "edges":
        return targets.edges?.texture ?? null;
      case "linear":
        return targets.linear.texture;
      case "glow-horizontal":
        return targets.glowHorizontal?.texture ?? null;
      case "glow":
        return targets.glow?.texture ?? null;
      case "bloom-horizontal":
        return targets.bloomHorizontal?.texture ?? null;
      case "bloom":
        return targets.bloom?.texture ?? null;
      case "reconstruction":
        return targets.reconstruction?.texture ?? null;
      case "main":
        return targets.main.texture;
      case "deconvergence":
        return targets.deconvergence?.texture ?? null;
    }
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
    if (this.disposed) return;
    if (renderer !== this.renderer) {
      this.recordFailure("rendered with a different WebGLRenderer");
    }
    if (readBuffer.width !== this.width || readBuffer.height !== this.height) {
      this.setInputSize(readBuffer.width, readBuffer.height);
    }
    if (!this.deferOutput && !this.renderToScreen) {
      if (
        writeBuffer.width !== this.outputWidth ||
        writeBuffer.height !== this.outputHeight
      ) {
        this.setOutputSize(writeBuffer.width, writeBuffer.height);
      }
    } else if (!this.deferOutput) {
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
      this.releaseInactiveTargets();
      this.bypassCount += 1;
      this.lastDrawCount = this.deferOutput ? 0 : 1;
      if (!this.deferOutput) this.renderBypass(renderer, writeBuffer, readBuffer, maskActive);
      return;
    }

    let failure: unknown = null;
    const oldAutoClear = renderer.autoClear;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);
    renderer.autoClear = false;

    try {
      this.prepareGraph();
      const targets = this.ensureTargets();
      if (this.historyClearPending) this.clearHistory(renderer, targets);
      this.applySettings(this.variant);
      this.lastDrawCount = this.executeGraph(
        renderer,
        writeBuffer,
        readBuffer,
        targets,
      );
      if (this.deferOutput) {
        this.deferredOutputTexture = targets.deconvergence?.texture ?? null;
        if (this.deferDeconvergence) {
          this.deferredDeconvergenceStage = {
            material: this.materialSets[this.variant].deconvergence,
            width: this.outputWidth, height: this.outputHeight,
          };
        }
        this.completedOutputRevision = finiteRevision(this.settings.revision);
      }
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
      this.lastDrawCount = this.deferOutput ? 0 : 1;
      if (!this.deferOutput) this.renderBypass(renderer, writeBuffer, readBuffer, maskActive);
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
    const m = this.materialSets[this.variant];
    if (this.commandsDirty) this.configureGraph(targets);
    const read = this.historyPing ? 1 : 0, write = 1 - read;
    const linear = this.variant === "hd" ? m.variant4 : m.variant5;
    bindTexture(this.plan.fuseInput ? linear : this.inputMaterial, "Source", readBuffer.texture);
    for (const uniform of this.frameUniforms) uniform.value = this.frameIndex;
    if (targets.afterglow) {
      bindTexture(m.afterglow, "AfterglowPassFeedback", targets.afterglow[read].texture);
      bindTexture(this.plan.fusePre ? linear : m.pre, "AfterglowPass", targets.afterglow[write].texture);
    }
    if (targets.average) {
      bindTexture(m.variant4, "AvgLumPassFeedback", targets.average[read].texture);
      bindTexture(m.main, "RasterLumPass", targets.average[write].texture);
      bindTexture(m.deconvergence, "RasterLumPass", targets.average[write].texture);
    }
    for (const command of this.drawCommands)
      this.draw(renderer, 'width' in command.target ? command.target : command.target[write], command.material);
    const draws = this.drawCommands.length;
    if (this.deferDeconvergence || this.deferOutput) return draws;
    bindTexture(this.outputMaterial, "Source", targets.deconvergence!.texture);
    this.draw(renderer, this.renderToScreen ? null : writeBuffer, this.outputMaterial, this.clear);
    return draws + 1;
  }

  /** Static dimensions, sampler bindings and draw order change only with the
   * graph. The hot path updates input/history/frame uniforms and issues draws. */
  private configureGraph(t: CrtGuestTargets): void {
    const m = this.materialSets[this.variant];
    this.drawCommands = [];
    const stage = (material: THREE.RawShaderMaterial,
      target: THREE.WebGLRenderTarget | readonly [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget],
      source: THREE.WebGLRenderTarget | null, textures: Record<string, THREE.Texture | null> = {}) => {
      const output = 'width' in target ? target : target[0];
      configureStage(material, source?.width ?? this.width, source?.height ?? this.height,
        output.width, output.height, this.width, this.height, this.frameIndex);
      bindTexture(material, "Source", source?.texture ?? null);
      for (const name in textures) bindTexture(material, name, textures[name]);
      this.drawCommands.push({ material, target });
    };
    if (t.stock) stage(this.inputMaterial, t.stock, null);
    if (t.afterglow) stage(m.afterglow, t.afterglow, t.stock, { OriginalHistory0: t.stock!.texture });
    const linear = this.variant === 'hd' ? m.variant4 : m.variant5;
    const preTextures = { StockPass: t.stock?.texture ?? null, AfterglowPass: t.stock?.texture ?? null };
    if (this.plan.fusePre) stage(linear,t.linear,t.stock,preTextures);
    else {
      stage(m.pre,t.pre!,t.stock,preTextures);
      if (t.average) stage(m.variant4,t.average,t.pre);
      if (t.edges) stage(m.edges,t.edges,t.pre);
      stage(linear,t.linear,t.pre,{ PrePass:t.pre!.texture });
    }
    if (t.reconstruction) stage(m.variant5,t.reconstruction,t.linear,{ LinearizePass:t.linear.texture });
    if (t.glowHorizontal && t.glow) {
      stage(m.gaussianHorizontal,t.glowHorizontal,t.linear,{ LinearizePass:t.linear.texture });
      stage(m.gaussianVertical,t.glow,t.glowHorizontal);
    }
    if (t.bloomHorizontal && t.bloom) {
      stage(m.bloomHorizontal,t.bloomHorizontal,t.linear,{ LinearizePass:t.linear.texture });
      stage(m.bloomVertical,t.bloom,t.bloomHorizontal);
    }
    const common = {
      LinearizePass:t.linear.texture, PrePass:t.pre?.texture ?? t.stock?.texture ?? null,
      AvgLumPass:t.edges?.texture ?? null, RasterLumPass:null, BloomPass:t.bloom?.texture ?? null,
      GlowPass:t.glow?.texture ?? null, StockPass:t.stock?.texture ?? null,
    };
    const mainSource = t.reconstruction ?? t.linear;
    stage(m.main,t.main,mainSource,{...common,Pass1:mainSource.texture});
    configureStage(m.deconvergence,this.outputWidth,this.outputHeight,this.outputWidth,this.outputHeight,
      this.width,this.height,this.frameIndex);
    bindTexture(m.deconvergence,'Source',t.main.texture);
    for (const name in common) bindTexture(m.deconvergence,name,common[name as keyof typeof common]);
    if (!this.deferDeconvergence) this.drawCommands.push({ material:m.deconvergence,target:t.deconvergence! });
    this.frameUniforms = [];
    for (const material of [...this.drawCommands.map(command=>command.material),m.deconvergence]) {
      for (const name of ['uParams_FrameCount','uGlobal_FrameCount']) {
        const uniform = material.uniforms[name];
        if (uniform && !this.frameUniforms.includes(uniform)) this.frameUniforms.push(uniform);
      }
    }
    this.commandsDirty = false;
  }

  private prepareGraph(): void {
    const revision = finiteRevision(this.settings.revision);
    const sizeKey = `${this.variant}/${this.width}/${this.height}/${this.outputWidth}/${this.outputHeight}/${this.quality}`;
    if (revision !== null && revision === this.shaderRevision && sizeKey === this.shaderSizeKey) return;
    const previousPlan = this.plan;
    this.plan = planCrt(this.settings, this.height, this.width, this.outputWidth);
    const key = JSON.stringify(this.plan);
    if (key !== this.planKey) {
      this.planKey = key;
      if (this.targets) this.resizeTargets(this.targets);
      if (previousPlan.afterglow !== this.plan.afterglow || previousPlan.average !== this.plan.average ||
          previousPlan.scalarAverage !== this.plan.scalarAverage || previousPlan.mipmaps !== this.plan.mipmaps)
        this.resetHistory("temporal dependencies changed");
    }
    const v = (id: string) => this.settings.getValue(id, this.variant);
    const shaders = { ...SHADER_LIBRARY[this.variant], edges: SHADER_LIBRARY.advanced.variant4 };
    shaders.pre = optimizePreColour(shaders.pre, this.settings);
    const materials = this.materialSets[this.variant];
    for (const name of Object.keys(shaders) as (keyof typeof shaders)[]) {
      if (name === "stock") continue;
      if (name === 'edges' && this.variant !== 'advanced') continue;
      let fragment = shaders[name];
      if (name === 'afterglow') fragment = CRT_AFTERGLOW_SHADER;
      const isLinear = name === (this.variant === "hd" ? "variant4" : "variant5");
      if (isLinear && this.plan.fusePre) fragment = fusePreLinear(shaders.pre, fragment, this.plan.fuseInput);
      if (name === 'pre' || (isLinear && this.plan.fusePre))
        fragment = fragment.replace(/(?:pre_)?crtGuestSamplePointBorder\((StockPass|AfterglowPass), vTexCoord, 0\.0\)/g,
          'texelFetch($1, ivec2(gl_FragCoord.xy), 0)');
      if (name === "deconvergence" && this.plan.fusePre) {
        // With vigstr=0 every pre alpha is exactly 1, including clamped borders.
        fragment = fragment.replace(/crtGuestSampleLinearBorder\(PrePass,.*?\)\.w/g, '1.0');
      }
      if (name === "variant4" && this.variant === "advanced")
        fragment = fragment.replace('vec4(c1, c2, c3, ltotal)', 'vec4(0.0, 0.0, 0.0, ltotal)');
      if (name === 'edges') fragment = fragment.replace('vec4(c1, c2, c3, ltotal)', 'vec4(c1, c2, c3, 1.0)');
      if (this.variant === 'advanced' && (name === 'main' || name === 'deconvergence')) {
        fragment = fragment.replace('uniform highp sampler2D AvgLumPass;',
          'uniform highp sampler2D AvgLumPass;\nuniform highp sampler2D RasterLumPass;');
        fragment = fragment.replace(/crtGuestSampleLinearBorder\(AvgLumPass, vec2\(0\.5\), 0\.0\)\.w/g,
          'crtGuestSampleLinearBorder(RasterLumPass, vec2(0.5), 0.0).w');
      }
      if (/^(gaussian|bloom)(Horizontal|Vertical)$/.test(name)) {
        const horizontal = name.endsWith("Horizontal"), bloom = name.startsWith("bloom");
        const fineValue = v(bloom ? 'FINE_BLOOM' : 'FINE_GLOW');
        const fine = fineValue > .5 ? fineValue : .75 + .25 * fineValue;
        const auto = this.variant === 'hd' && horizontal && this.height < 375
          ? 1 + Math.max(0, Math.min(1, v('auto_res') * Math.round(this.width / 300) - 1)) : 1;
        const sourceHeight = bloom && this.variant === 'advanced' ? kernelDimensions(this.quality)[1] : this.height;
        fragment = gaussianShader({ horizontal, bloom,
          radius: v(bloom ? (horizontal ? 'SIZEHB' : 'SIZEVB') : (horizontal ? 'SIZEH' : 'SIZEV')),
          sigma: v(bloom ? (horizontal ? 'SIGMA_HB' : 'SIGMA_VB') : (horizontal ? 'SIGMA_H' : 'SIGMA_V')),
          fine, auto, magic: !bloom && horizontal && v('m_glow') > .5,
          pair: !bloom && fine === 1 && (!horizontal || v('m_glow') < .5) && (horizontal || sourceHeight === this.height),
        });
      }
      if (this.variant === 'hd' && (name === 'variant5' || name === 'main'))
        fragment = optimizeHdFilter(fragment, name === 'variant5', this.settings, this.width, this.height);
      fragment = withoutVersionDirective(specializeCrt(fragment, this.settings, this.variant));
      const material = materials[name];
      if (material.fragmentShader !== fragment) {
        // Dispose superseded GPU programs instead of retaining every slider state.
        material.dispose();
        material.fragmentShader = fragment;
        const discovered = discoverUniforms(fragment);
        for (const uniform in discovered) material.uniforms[uniform] ??= discovered[uniform];
        material.needsUpdate = true;
        this.appliedSettingsRevision[this.variant] = null;
      }
    }
    this.bindLuts();
    this.commandsDirty = true;
    this.shaderRevision = revision;
    this.shaderSizeKey = sizeKey;
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
    const rgba16f = (name: string) => makeTarget(1, 1, THREE.HalfFloatType, `CRTGuest.${name}.RGBA16F`);
    this.targets = {
      stock: null, pre: null, linear: rgba16f("Linear"),
      glowHorizontal: null, glow: null, bloomHorizontal: null, bloom: null,
      reconstruction: null, main: rgba16f("Main"),
      deconvergence: this.deferDeconvergence ? null : rgba16f("Deconvergence"),
      afterglow: null, average: null, edges: null,
    };
    this.resizeTargets(this.targets);
    this.resetHistory("targets allocated");
    return this.targets;
  }

  private resizeTargets(targets: CrtGuestTargets): void {
    this.commandsDirty = true;
    this.plan = planCrt(this.settings, this.height, this.width, this.outputWidth);
    const [kw, kh] = kernelDimensions(this.quality);
    const reconcile = (target: THREE.WebGLRenderTarget | null, needed: boolean,
      width: number, height: number, byte: boolean, name: string) => {
      if (!needed) { target?.dispose(); return null; }
      target ??= makeTarget(width, height, byte ? THREE.UnsignedByteType : THREE.HalfFloatType, `CRTGuest.${name}`);
      resizeTarget(target, width, height); return target;
    };
    targets.stock = reconcile(targets.stock, !this.plan.fuseInput, this.width, this.height, true, 'Stock');
    targets.pre = reconcile(targets.pre, !this.plan.fusePre, this.width, this.height, true, 'Pre');
    if (targets.pre) configurePreMipmaps(targets.pre, this.plan.mipmaps);
    if (this.plan.afterglow) {
      targets.afterglow ??= [makeTarget(1,1,THREE.UnsignedByteType,'CRTGuest.AfterglowA'), makeTarget(1,1,THREE.UnsignedByteType,'CRTGuest.AfterglowB')];
      for (const t of targets.afterglow) resizeTarget(t,this.width,this.height);
    } else if (targets.afterglow) { for (const t of targets.afterglow) t.dispose(); targets.afterglow = null; }
    if (this.plan.average) {
      targets.average ??= [makeTarget(1,1,THREE.UnsignedByteType,'CRTGuest.AverageA'), makeTarget(1,1,THREE.UnsignedByteType,'CRTGuest.AverageB')];
      for (const t of targets.average) resizeTarget(t,1,1);
    } else if (targets.average) { for (const t of targets.average) t.dispose(); targets.average = null; }
    targets.edges = reconcile(targets.edges,this.plan.edges,this.width,this.height,true,'Edges');
    resizeTarget(targets.linear,this.width,this.height);
    resizeTarget(targets.main, this.outputWidth, this.outputHeight);
    if (targets.deconvergence) resizeTarget(targets.deconvergence,this.outputWidth,this.outputHeight);
    targets.glowHorizontal = reconcile(targets.glowHorizontal,this.plan.glow,kw,this.height,false,'GlowHorizontal');
    targets.glow = reconcile(targets.glow,this.plan.glow,kw,kh,false,'Glow');
    targets.bloomHorizontal = reconcile(targets.bloomHorizontal,this.plan.bloom,kw,this.variant === 'advanced' ? kh : this.height,false,'BloomHorizontal');
    targets.bloom = reconcile(targets.bloom,this.plan.bloom,this.width,this.variant === 'advanced' ? this.height : kh,false,'Bloom');
    targets.reconstruction = reconcile(targets.reconstruction,this.plan.reconstruction,this.outputWidth,this.height,false,'Reconstruction');
  }

  private clearHistory(
    renderer: THREE.WebGLRenderer,
    targets: CrtGuestTargets,
  ): void {
    const previousColor = renderer.getClearColor(new THREE.Color());
    const previousAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 1);
    try {
      for (const target of [...(targets.afterglow ?? []), ...(targets.average ?? [])]) {
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
    this.commandsDirty = true;
    this.drawCommands = [];
    this.frameUniforms = [];
    this.deferredOutputTexture = null;
    this.deferredDeconvergenceStage = null;
    if (!this.targets) return;
    const targets = this.targets;
    const all = new Set<THREE.WebGLRenderTarget | null>([
      targets.stock,
      targets.pre,
      targets.edges,
      targets.linear,
      targets.glowHorizontal,
      targets.glow,
      targets.bloomHorizontal,
      targets.bloom,
      targets.main,
      ...(targets.deconvergence ? [targets.deconvergence] : []),
      ...(targets.afterglow ?? []),
      ...(targets.average ?? []),
    ]);
    if (targets.reconstruction) all.add(targets.reconstruction);
    for (const target of all) target?.dispose();
    this.targets = null;
  }

  private targetDiagnostics(): Partial<
    Record<CrtGuestDebugTarget, CrtGuestTargetDiagnostic>
  > {
    const targets = this.targets;
    if (!targets) return {};
    const read = this.historyPing ? 1 : 0;
    const write = this.historyPing ? 0 : 1;
    const diagnostic: Partial<Record<CrtGuestDebugTarget, CrtGuestTargetDiagnostic>> = {};
    const entries: [CrtGuestDebugTarget, THREE.WebGLRenderTarget | null | undefined][] = [
      ['stock', targets.stock], ['pre', targets.pre], ['linear', targets.linear],
      ['edges', targets.edges],
      ['glow-horizontal',targets.glowHorizontal], ['glow',targets.glow],
      ['bloom-horizontal',targets.bloomHorizontal], ['bloom',targets.bloom],
      ['main',targets.main], ['deconvergence',targets.deconvergence], ['reconstruction',targets.reconstruction],
      ['afterglow-read',targets.afterglow?.[read]], ['afterglow-write',targets.afterglow?.[write]],
      ['average-read',targets.average?.[read]], ['average-write',targets.average?.[write]],
    ];
    for (const [name,target] of entries) if (target) diagnostic[name] = targetDiagnostic(target,
      target.texture.type === THREE.UnsignedByteType ? 4 : 8,
      target.texture.generateMipmaps ? 4/3 : 1);
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
    edges: makeMaterial(`CRTGuest.${variant}.edges`, SHADER_LIBRARY.advanced.variant4),
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
  const uniforms = material.uniforms;
  for (const prefix of ["uParams_", "uGlobal_"]) {
    const set = (name: string, w: number, h: number) => {
      const uniform = uniforms[prefix + name];
      if (uniform) (uniform.value as THREE.Vector4).set(w, h, 1/w, 1/h);
    };
    set("SourceSize", sourceWidth, sourceHeight);
    set("OutputSize", outputWidth, outputHeight);
    set("OriginalSize", linearWidth, linearHeight);
    set("LinearizePassSize", linearWidth, linearHeight);
    const frame = uniforms[prefix + "FrameCount"];
    if (frame) frame.value = frameIndex;
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
  // WebGL2 immutable texture storage fixes the mip count at allocation. Merely
  // setting needsUpdate on an existing render target doesn't add mip levels.
  target.dispose();
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

/** Fuse the only stock operation (opaque alpha) into canonical input encoding.
 * Keep generated shader sources untouched, and execute their original main
 * before setting alpha so gamma, clamp and RGBA8 quantization stay identical. */
function opaqueStockInputShader(source: string): string {
  return `#define main crtGuestEncodeInput
${source}
#undef main
void main() {
  crtGuestEncodeInput();
  FragColor.a = 1.0;
}
`;
}
