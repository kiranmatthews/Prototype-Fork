// SHARED PRESENTATION POST STACK --------------------------------------------
//
// Exact active order from Unity 6000.5.7f1 / URP when every authored stage is
// enabled:
//   RenderPass -> SMAA High -> UnityPostPass -> gameplay HUD -> CRT Guest
//   -> OutputPass
//
// UnityPostPass owns only neutral LDR Uber grading and dithering. Glow/bloom
// belongs to the separately authored CRT/presentation path.
// CRT Guest encodes that linear result into its expected sRGB working space,
// runs the canonical chain, then decodes to linear again. OutputPass alone
// performs the renderer's final display transfer.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UNITY_POST_PROFILE, UnityPostPass } from "./unityPost";
import { UnitySmaaPass } from "./unitySmaa";
import { CrtGuestPass } from "./crt-guest/pass";
import {
  disposeCrtGuestLuts,
  loadCrtGuestLuts,
  type CrtGuestLuts,
} from "./crt-guest/luts";
import type { CrtGuestSettings } from "./crt-guest/settings";

export const BEACHFRONT_POST_PROFILE = UNITY_POST_PROFILE;

export interface CoastPostOptions {
  /** Enables the Beachfront-only Unity neutral grading/dither path. */
  enabled?: boolean;
  lite?: boolean;
  pixelRatio?: number;
  /** Enables the shared CRT Guest stage through this presentation store. */
  crtSettings?: CrtGuestSettings;
  crtLutBaseUrl?: string;
  resolutionMode?: CoastPostResolutionMode;
  /** Fixed-mode pre-CRT dimensions, in physical pixels. */
  inputWidth?: number;
  inputHeight?: number;
  /** Fixed-mode CRT/output dimensions, in physical pixels. */
  outputWidth?: number;
  outputHeight?: number;
  /** Retained for caller compatibility; Unity's target uses MSAA 1. */
  multisample?: boolean;
}

export type CoastPostRenderPath = "post" | "direct";
export type CoastPostResolutionMode = "native" | "fixed";

export interface CoastPostResolutionState {
  mode: CoastPostResolutionMode;
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  scaleX: number;
  scaleY: number;
}

export interface CoastPostPreCrtOverlayContext
  extends CoastPostResolutionState {
  renderer: THREE.WebGLRenderer;
  target: THREE.WebGLRenderTarget;
}

export type CoastPostPreCrtOverlay = (
  context: CoastPostPreCrtOverlayContext,
) => void;

/**
 * A no-swap composer pass that paints game-owned overlays into the completed
 * pre-CRT colour buffer. Keeping this as a real pass makes the insertion point
 * identical in native and fixed-resolution modes: Unity grading has finished,
 * while CRT reconstruction and the final display transfer have not begun.
 */
class PreCrtOverlayPass extends Pass {
  callback: CoastPostPreCrtOverlay | undefined;
  private readonly viewportScratch = new THREE.Vector4();
  private readonly scissorScratch = new THREE.Vector4();

  constructor(
    private readonly facade: THREE.WebGLRenderer,
    private readonly getResolution: () => CoastPostResolutionState,
  ) {
    super();
    this.needsSwap = false;
  }

  render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    const callback = this.callback;
    if (!callback) return;

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousViewport = renderer.getViewport(this.viewportScratch);
    const previousScissor = renderer.getScissor(this.scissorScratch);
    const previousScissorTest = renderer.getScissorTest();
    const previousAutoClear = renderer.autoClear;
    const configured = this.getResolution();
    const resolution: CoastPostResolutionState = {
      ...configured,
      inputWidth: readBuffer.width,
      inputHeight: readBuffer.height,
      scaleX: configured.outputWidth / readBuffer.width,
      scaleY: configured.outputHeight / readBuffer.height,
    };
    try {
      renderer.setRenderTarget(readBuffer);
      // The facade speaks physical pre-CRT pixels even when the real renderer
      // is in native DPR>1 mode.
      this.facade.setViewport(0, 0, readBuffer.width, readBuffer.height);
      renderer.setScissorTest(false);
      callback({
        ...resolution,
        renderer: this.facade,
        target: readBuffer,
      });
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.autoClear = previousAutoClear;
    }
  }
}

export class CoastPostRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly smaaPass: UnitySmaaPass;
  private readonly unityPostPass: UnityPostPass;
  private readonly preCrtOverlayPass: PreCrtOverlayPass;
  private readonly crtPass: CrtGuestPass | null;
  private readonly outputPass: OutputPass;
  private crtOutputTarget: THREE.WebGLRenderTarget | null = null;
  private enabledState: boolean;
  private liteState: boolean;
  private readonly noSmaa: boolean;
  private crtLuts: CrtGuestLuts | null = null;
  private disposed = false;
  private width: number;
  private height: number;
  private pixelRatio: number;
  private resolutionMode: CoastPostResolutionMode;
  private inputWidth: number;
  private inputHeight: number;
  private outputWidth: number;
  private outputHeight: number;
  private composerTailAttached = true;
  private composerPixelRatio: number;
  private composerWidth: number;
  private composerHeight: number;
  private readonly sizeScratch = new THREE.Vector2();
  private readonly viewportScratch = new THREE.Vector4();
  private readonly scissorScratch = new THREE.Vector4();
  private readonly preCrtOverlayRenderer: THREE.WebGLRenderer;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    options: CoastPostOptions = {},
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabledState = options.enabled ?? false;
    this.liteState = options.lite ?? false;
    this.noSmaa = new URLSearchParams(window.location.search).has("nosmaa");

    renderer.getSize(this.sizeScratch);
    this.width = Math.max(1, this.sizeScratch.x);
    this.height = Math.max(1, this.sizeScratch.y);
    this.pixelRatio = CoastPostRenderer.validPixelRatio(
      options.pixelRatio ?? renderer.getPixelRatio(),
    );
    const drawingBuffer = renderer.getDrawingBufferSize(this.sizeScratch);
    this.resolutionMode = options.resolutionMode ?? "native";
    this.inputWidth = CoastPostRenderer.validDimension(
      options.inputWidth ?? this.width * this.pixelRatio,
    );
    this.inputHeight = CoastPostRenderer.validDimension(
      options.inputHeight ?? this.height * this.pixelRatio,
    );
    this.outputWidth = CoastPostRenderer.validDimension(
      options.outputWidth ?? drawingBuffer.x,
    );
    this.outputHeight = CoastPostRenderer.validDimension(
      options.outputHeight ?? drawingBuffer.y,
    );
    this.preCrtOverlayRenderer = makePreCrtOverlayRenderer(
      renderer,
      () => ({ width: this.inputWidth, height: this.inputHeight }),
    );

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);
    this.composerPixelRatio = this.pixelRatio;
    this.composerWidth = this.width;
    this.composerHeight = this.height;

    // Unity PC_RPAsset: MSAA 1. Runtime camera: SMAA mode 2, quality High.
    this.composer.renderTarget1.samples = 0;
    this.composer.renderTarget2.samples = 0;

    this.renderPass = new RenderPass(scene, camera);
    this.smaaPass = new UnitySmaaPass(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );
    this.unityPostPass = new UnityPostPass(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );
    this.preCrtOverlayPass = new PreCrtOverlayPass(
      this.preCrtOverlayRenderer,
      () => this.resolution,
    );
    this.crtPass = options.crtSettings
      ? new CrtGuestPass(renderer, options.crtSettings, {
          sourceWidth: this.inputWidth,
          sourceHeight: this.inputHeight,
          outputWidth: this.outputWidth,
          outputHeight: this.outputHeight,
        })
      : null;
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.smaaPass);
    this.composer.addPass(this.unityPostPass);
    this.composer.addPass(this.preCrtOverlayPass);
    if (this.crtPass) this.composer.addPass(this.crtPass);
    this.composer.addPass(this.outputPass);
    this.applyResolutionMode();
    this.syncPassEnablement();

    if (this.crtPass) {
      const lutRoot =
        options.crtLutBaseUrl ??
        `${import.meta.env.BASE_URL}crt-guest/lut/`;
      void loadCrtGuestLuts(lutRoot).then(
        (luts) => {
          if (this.disposed) {
            disposeCrtGuestLuts(luts);
            return;
          }
          this.crtLuts = luts;
          this.crtPass?.setLuts(luts);
        },
        (error: unknown) => {
          console.error("CRT Guest LUTs failed to load; using direct output.", error);
        },
      );
    }
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  get lite(): boolean {
    return this.liteState;
  }

  get active(): boolean {
    return (
      !this.liteState &&
      !this.disposed &&
      (
        this.resolutionMode === "fixed" ||
        this.enabledState ||
        (this.crtPass?.active ?? false)
      )
    );
  }

  get crt(): CrtGuestPass | null {
    return this.crtPass;
  }

  get resolution(): CoastPostResolutionState {
    return {
      mode: this.resolutionMode,
      inputWidth: this.inputWidth,
      inputHeight: this.inputHeight,
      outputWidth: this.outputWidth,
      outputHeight: this.outputHeight,
      scaleX: this.outputWidth / this.inputWidth,
      scaleY: this.outputHeight / this.inputHeight,
    };
  }

  setResolutionMode(mode: CoastPostResolutionMode): void {
    if (mode !== "native" && mode !== "fixed") {
      throw new Error(`Unknown presentation resolution mode: ${String(mode)}`);
    }
    if (mode === this.resolutionMode) return;
    this.resolutionMode = mode;
    if (mode === "native") {
      const rendererSize = this.renderer.getSize(this.sizeScratch);
      this.width = CoastPostRenderer.validDimension(rendererSize.x);
      this.height = CoastPostRenderer.validDimension(rendererSize.y);
      this.pixelRatio = CoastPostRenderer.validPixelRatio(
        this.renderer.getPixelRatio(),
      );
    }
    this.readRendererOutputSize();
    this.crtPass?.resetHistory("resolution mode changed");
    this.applyResolutionMode();
  }

  /** Set fixed-mode pre-CRT dimensions, in physical pixels. */
  setInputSize(width: number, height: number): void {
    const nextWidth = CoastPostRenderer.validDimension(width);
    const nextHeight = CoastPostRenderer.validDimension(height);
    if (nextWidth === this.inputWidth && nextHeight === this.inputHeight) return;
    this.inputWidth = nextWidth;
    this.inputHeight = nextHeight;
    if (this.resolutionMode === "fixed") this.applyResolutionMode();
  }

  /** Set fixed-mode CRT/output dimensions, in physical pixels. */
  setOutputSize(width: number, height: number): void {
    const nextWidth = CoastPostRenderer.validDimension(width);
    const nextHeight = CoastPostRenderer.validDimension(height);
    if (
      nextWidth === this.outputWidth &&
      nextHeight === this.outputHeight
    ) {
      return;
    }
    this.outputWidth = nextWidth;
    this.outputHeight = nextHeight;
    if (this.resolutionMode === "fixed") this.applyCrtResolution();
  }

  /** Follow the renderer's current drawing buffer for fixed-mode output. */
  syncOutputSizeFromRenderer(): void {
    this.readRendererOutputSize();
    if (this.resolutionMode === "fixed") this.applyCrtResolution();
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabledState) return;
    this.enabledState = enabled;
    this.crtPass?.resetHistory("upstream post topology changed");
    this.syncPassEnablement();
  }

  setLite(lite: boolean): void {
    if (lite === this.liteState) return;
    this.liteState = lite;
    this.crtPass?.resetHistory("presentation path changed");
  }

  setScene(scene: THREE.Scene): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.renderPass.scene = scene;
    this.crtPass?.resetHistory("scene changed");
  }

  setCamera(camera: THREE.Camera): void {
    if (camera === this.camera) return;
    this.camera = camera;
    this.renderPass.camera = camera;
    this.crtPass?.resetHistory("camera changed");
  }

  /** CSS-pixel dimensions; EffectComposer multiplies these by DPR. */
  setSize(width: number, height: number): void {
    const nextWidth = CoastPostRenderer.validDimension(width);
    const nextHeight = CoastPostRenderer.validDimension(height);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    if (this.resolutionMode === "fixed") this.readRendererOutputSize();
    this.applyResolutionMode();
  }

  setPixelRatio(pixelRatio: number): void {
    const next = CoastPostRenderer.validPixelRatio(pixelRatio);
    if (next === this.pixelRatio) return;
    this.pixelRatio = next;
    if (this.resolutionMode === "fixed") this.readRendererOutputSize();
    this.applyResolutionMode();
  }

  render(
    deltaSeconds = 0,
    preCrtOverlay?: CoastPostPreCrtOverlay,
  ): CoastPostRenderPath {
    if (this.disposed) {
      throw new Error("CoastPostRenderer.render() called after dispose()");
    }
    this.syncPassEnablement();
    // EffectComposer owns a complete full-frame target. Preserve caller-owned
    // split-screen viewports by using the direct path while scissoring.
    if (!this.active || this.renderer.getScissorTest()) {
      this.renderer.render(this.scene, this.camera);
      return "direct";
    }
    this.preCrtOverlayPass.callback = preCrtOverlay;
    try {
      if (this.resolutionMode === "fixed") {
        this.renderFixed(deltaSeconds);
      } else {
        this.composer.render(deltaSeconds);
      }
    } finally {
      // Never retain closures over live Player/UI state between frames.
      this.preCrtOverlayPass.callback = undefined;
    }
    return "post";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.smaaPass.dispose();
    this.unityPostPass.dispose();
    this.crtPass?.dispose();
    this.crtOutputTarget?.dispose();
    this.crtOutputTarget = null;
    if (this.crtLuts) {
      // The pass borrows these textures; this renderer owns the async load.
      disposeCrtGuestLuts(this.crtLuts);
      this.crtLuts = null;
    }
    this.outputPass.dispose();
    this.composer.dispose();
  }

  private renderFixed(deltaSeconds: number): void {
    const previousTarget = this.renderer.getRenderTarget();
    const previousFace = this.renderer.getActiveCubeFace();
    const previousMip = this.renderer.getActiveMipmapLevel();
    const previousViewport = this.renderer.getViewport(this.viewportScratch);
    const previousScissor = this.renderer.getScissor(this.scissorScratch);
    const previousScissorTest = this.renderer.getScissorTest();
    const previousAutoClear = this.renderer.autoClear;
    try {
      // Fixed mode keeps only the scene/SMAA/Unity-post prefix in the
      // composer. Its readBuffer is therefore the complete pre-CRT frame.
      this.composer.render(deltaSeconds);
      const source = this.composer.readBuffer;
      if (
        source.width !== this.inputWidth ||
        source.height !== this.inputHeight
      ) {
        this.inputWidth = source.width;
        this.inputHeight = source.height;
        this.applyCrtResolution();
      }

      let finalLinear = source;
      if (this.crtPass?.active) {
        const crtOutput = this.ensureCrtOutputTarget();
        this.crtPass.setResolution(
          source.width,
          source.height,
          this.outputWidth,
          this.outputHeight,
        );
        this.crtPass.renderToScreen = false;
        this.crtPass.render(
          this.renderer,
          crtOutput,
          source,
          deltaSeconds,
          false,
        );
        finalLinear = crtOutput;
      }

      // OutputPass remains the sole display transfer. With CRT bypassed it
      // also performs the base-to-display upscale directly from source.
      this.renderer.setViewport(previousViewport);
      this.renderer.setScissor(previousScissor);
      this.renderer.setScissorTest(false);
      this.outputPass.renderToScreen = true;
      this.outputPass.render(
        this.renderer,
        this.composer.writeBuffer,
        finalLinear,
        deltaSeconds,
        false,
      );
    } finally {
      this.renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      this.renderer.setViewport(previousViewport);
      this.renderer.setScissor(previousScissor);
      this.renderer.setScissorTest(previousScissorTest);
      this.renderer.autoClear = previousAutoClear;
    }
  }

  private applyResolutionMode(): void {
    if (this.resolutionMode === "fixed") {
      this.detachComposerTail();
      this.configureComposer(this.inputWidth, this.inputHeight, 1);
      this.inputWidth = this.composer.readBuffer.width;
      this.inputHeight = this.composer.readBuffer.height;
      this.applyCrtResolution();
      return;
    }

    this.readRendererOutputSize();
    this.configureComposer(this.width, this.height, this.pixelRatio);
    this.attachComposerTail();
    this.inputWidth = this.composer.readBuffer.width;
    this.inputHeight = this.composer.readBuffer.height;
    this.crtPass?.setResolution(
      this.inputWidth,
      this.inputHeight,
      this.outputWidth,
      this.outputHeight,
    );
    this.crtOutputTarget?.dispose();
    this.crtOutputTarget = null;
  }

  private configureComposer(
    width: number,
    height: number,
    pixelRatio: number,
  ): void {
    if (pixelRatio !== this.composerPixelRatio) {
      this.composerPixelRatio = pixelRatio;
      this.composer.setPixelRatio(pixelRatio);
    }
    if (width !== this.composerWidth || height !== this.composerHeight) {
      this.composerWidth = width;
      this.composerHeight = height;
      this.composer.setSize(width, height);
    }
  }

  private applyCrtResolution(): void {
    this.crtPass?.setResolution(
      this.inputWidth,
      this.inputHeight,
      this.outputWidth,
      this.outputHeight,
    );
    if (this.crtOutputTarget) {
      this.crtOutputTarget.setSize(this.outputWidth, this.outputHeight);
    }
  }

  private ensureCrtOutputTarget(): THREE.WebGLRenderTarget {
    if (!this.crtOutputTarget) {
      this.crtOutputTarget = makeLinearTarget(
        this.outputWidth,
        this.outputHeight,
        "CRTGuest.OutputLinear.RGBA16F",
      );
    } else if (
      this.crtOutputTarget.width !== this.outputWidth ||
      this.crtOutputTarget.height !== this.outputHeight
    ) {
      this.crtOutputTarget.setSize(this.outputWidth, this.outputHeight);
    }
    return this.crtOutputTarget;
  }

  private detachComposerTail(): void {
    if (!this.composerTailAttached) return;
    if (this.crtPass) this.composer.removePass(this.crtPass);
    this.composer.removePass(this.outputPass);
    this.composer.renderToScreen = false;
    this.composerTailAttached = false;
  }

  private attachComposerTail(): void {
    if (this.composerTailAttached) return;
    if (this.crtPass) this.composer.addPass(this.crtPass);
    this.composer.addPass(this.outputPass);
    this.composer.renderToScreen = true;
    this.composerTailAttached = true;
  }

  private readRendererOutputSize(): void {
    const size = this.renderer.getDrawingBufferSize(this.sizeScratch);
    this.outputWidth = CoastPostRenderer.validDimension(size.x);
    this.outputHeight = CoastPostRenderer.validDimension(size.y);
  }

  private syncPassEnablement(): void {
    const crtActive = this.crtPass?.active ?? false;
    // Entering an offscreen composer drops the WebGLRenderer's default-buffer
    // MSAA. Keep Unity SMAA High in front of either authored post path.
    this.smaaPass.enabled =
      !this.noSmaa &&
      (this.resolutionMode === "fixed" || this.enabledState || crtActive);
    this.unityPostPass.enabled = this.enabledState;
    if (this.crtPass) this.crtPass.enabled = true;
  }

  private static validDimension(value: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
  }

  private static validPixelRatio(value: number): number {
    return Number.isFinite(value) ? Math.max(0.1, value) : 1;
  }
}

function makeLinearTarget(
  width: number,
  height: number,
  name: string,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    internalFormat: "RGBA16F",
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

function makePreCrtOverlayRenderer(
  renderer: THREE.WebGLRenderer,
  inputSize: () => { width: number; height: number },
): THREE.WebGLRenderer {
  // Present a DPR-1 physical-pixel facade to overlay helpers. The underlying
  // renderer multiplies viewport/scissor inputs by its real DPR even while an
  // offscreen target is bound, so the facade divides those writes back down.
  return new Proxy(renderer, {
    get(target, property) {
      if (property === "getSize") {
        return (result: THREE.Vector2): THREE.Vector2 => {
          const size = inputSize();
          return result.set(size.width, size.height);
        };
      }
      if (property === "getDrawingBufferSize") {
        return (result: THREE.Vector2): THREE.Vector2 => {
          const size = inputSize();
          return result.set(size.width, size.height);
        };
      }
      if (property === "getPixelRatio") return (): number => 1;
      if (property === "getViewport" || property === "getScissor") {
        return (result: THREE.Vector4): THREE.Vector4 => {
          const getter = property === "getViewport"
            ? target.getViewport.bind(target)
            : target.getScissor.bind(target);
          getter(result);
          return result.multiplyScalar(target.getPixelRatio());
        };
      }
      if (property === "setViewport" || property === "setScissor") {
        return (
          x: number | THREE.Vector4,
          y?: number,
          width?: number,
          height?: number,
        ): void => {
          const pixelRatio = target.getPixelRatio();
          const setter = property === "setViewport"
            ? target.setViewport.bind(target)
            : target.setScissor.bind(target);
          if (x instanceof THREE.Vector4) {
            setter(
              x.x / pixelRatio,
              x.y / pixelRatio,
              x.z / pixelRatio,
              x.w / pixelRatio,
            );
          } else {
            setter(
              x / pixelRatio,
              (y ?? 0) / pixelRatio,
              (width ?? 0) / pixelRatio,
              (height ?? 0) / pixelRatio,
            );
          }
        };
      }
      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, property, value) {
      return Reflect.set(target, property, value, target);
    },
  });
}
