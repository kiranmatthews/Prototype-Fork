// BEACHFRONT POST STACK -------------------------------------------------------
//
// A Three.js port of the Unity profile at:
// Assets/Game/Data/SourceLevelPorts/BeachfrontRun_Showcase1Post.asset
//
// Required render-loop order:
//   1. Update the coast scene, camera and camera matrices.
//   2. On a canvas resize, resize the WebGLRenderer first, then call
//      setPixelRatio(dpr) / setSize(cssWidth, cssHeight) here. Sizes are CSS
//      pixels; EffectComposer applies the DPR itself.
//   3. Enable this class only while the coast level is active.
//   4. Call render() INSTEAD OF renderer.render(scene, camera). It renders to
//      the default framebuffer; rendering the scene first would do the work
//      twice and would immediately be overwritten by RenderPass.
//
// EffectComposer is a full-frame pipeline, so it cannot safely process one
// scissored half of a split-screen frame. render() detects scissor testing and
// deliberately falls back to renderer.render(scene, camera). For split screen,
// set viewport + scissor for each camera and call render() once per view; bloom
// and flares are skipped while scissoring. A future split-screen post path must
// render each view into its own composer/target and composite those two results.
//
// The steady-state render path creates no application-side objects. Render
// targets, uniforms, vectors and passes are all allocated by the constructor or
// by an explicit resize.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** Exact serialized values from BeachfrontRun_Showcase1Post.asset. */
export const BEACHFRONT_POST_PROFILE = Object.freeze({
  bloom: Object.freeze({
    threshold: 1,
    intensity: 0.3,
    scatter: 0.7,
    highQualityFiltering: true,
  }),
  lensFlare: Object.freeze({
    intensity: 0.49,
    firstFlareIntensity: 1,
    secondaryFlareIntensity: 0.5,
    warpedFlareIntensity: 3,
    warpedFlareScaleX: 1,
    warpedFlareScaleY: 1,
    samples: 1,
    sampleDimmer: 0.5,
    vignetteEffect: 1,
    startingPosition: 1.25,
    scale: 1.5,
    streaksIntensity: 0.24,
    streaksLength: 0.83,
    streaksOrientationDegrees: 0,
    streaksThreshold: 0.25,
    resolutionDivisor: 4,
    chromaticAberrationIntensity: 0.3,
  }),
});

export interface CoastPostOptions {
  /** Coast-level switch. Non-coast levels should leave this false. */
  enabled?: boolean;
  /** The ?lite/headless switch. Lite always wins over enabled. */
  lite?: boolean;
  /** Override the renderer's current DPR at construction. */
  pixelRatio?: number;
  /** Use 4x MSAA for the full-resolution scene target on WebGL2. */
  multisample?: boolean;
}

export type CoastPostRenderPath = "post" | "direct";

const BEACHFRONT_LENS_FLARE_SHADER = {
  name: "BeachfrontUnityScreenSpaceLensFlare",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tFlareSource: { value: null as THREE.Texture | null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;

    uniform sampler2D tDiffuse;
    uniform sampler2D tFlareSource;
    varying vec2 vUv;

    // Serialized Unity ScreenSpaceLensFlare values. Keeping these compile-time
    // constants lets WebGL fold the one-sample profile into a small shader.
    const float FLARE_INTENSITY = 0.49;
    const float FIRST_INTENSITY = 1.0;
    const float SECONDARY_INTENSITY = 0.5;
    const float WARPED_INTENSITY = 3.0;
    const float VIGNETTE_EFFECT = 1.0;
    const float STARTING_POSITION = 1.25;
    const float FLARE_SCALE_EXPONENT = 1.5;
    const float STREAK_INTENSITY = 0.24;
    const float STREAK_LENGTH = 0.83;
    const float STREAK_THRESHOLD = 0.25;
    const float CHROMA_INTENSITY = 0.3;
    const float REGULAR_FLARE_MULTIPLIER = 0.1;
    const float SQRT_TWO = 1.4142135623730951;
    const float PI = 3.141592653589793;

    vec2 clampUv(vec2 uv) {
      // Match Unity's bilinear clamp sampler. Half a texel inset is not needed
      // here because Three owns both source and destination render targets.
      return clamp(uv, vec2(0.0), vec2(1.0));
    }

    vec2 scaledUv(vec2 uv, float signedScale, bool polar) {
      bool invert = signedScale < 0.0;
      float scale = abs(signedScale);

      if (polar) {
        // Direct port of LensFlareScreenSpaceCommon.hlsl scaleUV(): the warped
        // flare reads the source in polar coordinates and reverses radius.
        vec2 p = (uv - 0.5) * (2.0 / scale);
        float radius = length(p) / SQRT_TWO;
        float angle = atan(p.x, p.y);
        float angularUv = 1.0 - ((angle + PI) / (2.0 * PI));
        return vec2(angularUv, invert ? 1.0 - radius : radius);
      }

      vec2 result = (uv - 0.5) / scale + 0.5;
      return invert ? 1.0 - result : result;
    }

    vec3 chromaticSource(vec2 sampleUv, vec2 screenUv) {
      // URP uses three fixed samples: R at uv, G one third of the way toward
      // the aberrated endpoint, B two thirds of the way there.
      vec2 coords = 2.0 * screenUv - 1.0;
      vec2 endUv = screenUv
        - coords * dot(coords, coords) * CHROMA_INTENSITY;
      vec2 diff = (endUv - screenUv) / 3.0;

      return vec3(
        texture2D(tFlareSource, clampUv(sampleUv)).r,
        texture2D(tFlareSource, clampUv(sampleUv + diff)).g,
        texture2D(tFlareSource, clampUv(sampleUv + 2.0 * diff)).b
      );
    }

    vec3 regularFlare(
      vec2 uv,
      float signedScale,
      float intensity,
      bool polar
    ) {
      vec2 sourceUv = scaledUv(uv, signedScale, polar);
      return chromaticSource(sourceUv, uv) * intensity;
    }

    vec3 thresholdedSource(vec2 uv) {
      vec3 color = texture2D(tFlareSource, clampUv(uv)).rgb;
      float brightness = max(color.r, max(color.g, color.b));
      return color
        * max(brightness - STREAK_THRESHOLD, 0.0)
        / max(brightness, 0.0001);
    }

    vec3 horizontalStreak(vec2 uv) {
      // URP creates the streak through a quarter-resolution downsample /
      // upsample pyramid. This fixed 13-tap reconstruction retains its broad,
      // smooth horizontal footprint without allocating two more render-target
      // pyramids. The source itself is UnrealBloom's quarter-resolution mip 1.
      vec3 streak = thresholdedSource(uv) * 0.18;
      streak += (
        thresholdedSource(uv + vec2(-0.04 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.04 * STREAK_LENGTH, 0.0))
      ) * 0.14;
      streak += (
        thresholdedSource(uv + vec2(-0.10 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.10 * STREAK_LENGTH, 0.0))
      ) * 0.12;
      streak += (
        thresholdedSource(uv + vec2(-0.18 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.18 * STREAK_LENGTH, 0.0))
      ) * 0.10;
      streak += (
        thresholdedSource(uv + vec2(-0.28 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.28 * STREAK_LENGTH, 0.0))
      ) * 0.08;
      streak += (
        thresholdedSource(uv + vec2(-0.39 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.39 * STREAK_LENGTH, 0.0))
      ) * 0.055;
      streak += (
        thresholdedSource(uv + vec2(-0.50 * STREAK_LENGTH, 0.0))
        + thresholdedSource(uv + vec2(0.50 * STREAK_LENGTH, 0.0))
      ) * 0.035;

      // Sum of the fixed weights above: keep energy stable as length changes.
      return streak / 1.24;
    }

    void main() {
      vec2 uv = vUv;
      vec3 base = texture2D(tDiffuse, uv).rgb;

      // Unity's only authored sample uses pow(i + start, scale), i == 0.
      float sampleScale = pow(STARTING_POSITION, FLARE_SCALE_EXPONENT);

      vec3 first = regularFlare(
        uv,
        sampleScale,
        FIRST_INTENSITY * REGULAR_FLARE_MULTIPLIER,
        false
      );
      vec3 secondary = regularFlare(
        uv,
        -sampleScale,
        SECONDARY_INTENSITY * REGULAR_FLARE_MULTIPLIER,
        false
      );
      vec3 warped = regularFlare(
        uv,
        -sampleScale,
        WARPED_INTENSITY * REGULAR_FLARE_MULTIPLIER,
        true
      );

      // This is the profile's vignetteEffect, not a dark image vignette. It
      // suppresses regular flare ghosts at the center of the screen.
      float vignetteX = clamp(pow(abs(2.0 * uv.x - 1.0), 2.0), 0.0, 1.0);
      float vignetteY = clamp(pow(abs(2.0 * uv.y - 1.0), 2.0), 0.0, 1.0);
      float vignetteRound = clamp(
        pow(vignetteX + vignetteY, 2.0),
        0.0,
        1.0
      );
      vignetteRound = mix(1.0, vignetteRound, VIGNETTE_EFFECT);

      vec3 flare = (first + secondary) * vignetteRound;
      flare += warped * vignetteX;
      flare += horizontalStreak(uv) * STREAK_INTENSITY;

      gl_FragColor = vec4(base + flare * FLARE_INTENSITY, 1.0);
    }
  `,
};

/**
 * Owns the full-screen post chain for the coast level.
 *
 * `render()` is the only per-frame entry point. `enabled`, `lite`, resize and
 * DPR changes are explicit so level switching never rebuilds GPU resources.
 */
export class CoastPostRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly flarePass: ShaderPass;
  private readonly outputPass: OutputPass;
  private readonly flareFallback: THREE.DataTexture;
  private flareSourceReady = false;
  private enabledState: boolean;
  private liteState: boolean;
  private disposed = false;
  private width: number;
  private height: number;
  private pixelRatio: number;
  private readonly sizeScratch = new THREE.Vector2();

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

    renderer.getSize(this.sizeScratch);
    this.width = Math.max(1, this.sizeScratch.x);
    this.height = Math.max(1, this.sizeScratch.y);
    this.pixelRatio = CoastPostRenderer.validPixelRatio(
      options.pixelRatio ?? renderer.getPixelRatio(),
    );

    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(this.width, this.height);

    // WebGLRenderer's canvas antialiasing does not apply to an off-screen
    // RenderPass. Preserve equivalent edge quality with multisampled composer
    // scene targets where WebGL2 supports it.
    const samples =
      (options.multisample ?? true) && renderer.capabilities.isWebGL2 ? 4 : 0;
    this.composer.renderTarget1.samples = samples;
    this.composer.renderTarget2.samples = samples;

    this.renderPass = new RenderPass(scene, camera);
    this.bloomPass = new UnrealBloomPass(
      this.sizeScratch.set(
        this.width * this.pixelRatio,
        this.height * this.pixelRatio,
      ),
      BEACHFRONT_POST_PROFILE.bloom.intensity,
      BEACHFRONT_POST_PROFILE.bloom.scatter,
      BEACHFRONT_POST_PROFILE.bloom.threshold,
    );

    this.flarePass = new ShaderPass(BEACHFRONT_LENS_FLARE_SHADER);
    // The first frame uses a valid black texture. UnrealBloom's private mip is
    // assigned only after it has actually rendered; binding it in the
    // constructor makes Three try to upload an uninitialised target once per
    // flare sample and floods the console. Later frames use Unity's bloomMip 1.
    this.flareFallback = new THREE.DataTexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      THREE.RGBAFormat,
    );
    this.flareFallback.needsUpdate = true;
    this.flarePass.uniforms.tFlareSource.value = this.flareFallback;

    // OutputPass restores the renderer's configured output color transfer.
    // Without it the off-screen linear target would be shown as a dark image.
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.flarePass);
    this.composer.addPass(this.outputPass);
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  get lite(): boolean {
    return this.liteState;
  }

  /** True only when the coast post path can run for a non-scissored frame. */
  get active(): boolean {
    return this.enabledState && !this.liteState && !this.disposed;
  }

  setEnabled(enabled: boolean): void {
    this.enabledState = enabled;
  }

  setLite(lite: boolean): void {
    this.liteState = lite;
  }

  setScene(scene: THREE.Scene): void {
    this.scene = scene;
    this.renderPass.scene = scene;
  }

  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
    this.renderPass.camera = camera;
  }

  /** CSS-pixel dimensions; do not pass drawing-buffer dimensions here. */
  setSize(width: number, height: number): void {
    const nextWidth = CoastPostRenderer.validDimension(width);
    const nextHeight = CoastPostRenderer.validDimension(height);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.composer.setSize(nextWidth, nextHeight);
    this.resetFlareSource();
  }

  setPixelRatio(pixelRatio: number): void {
    const next = CoastPostRenderer.validPixelRatio(pixelRatio);
    if (next === this.pixelRatio) return;
    this.pixelRatio = next;
    this.composer.setPixelRatio(next);
    this.resetFlareSource();
  }

  /**
   * Renders to the screen. Returns the selected path for diagnostics without
   * allocating a result object.
   */
  render(deltaSeconds = 0): CoastPostRenderPath {
    if (this.disposed) {
      throw new Error("CoastPostRenderer.render() called after dispose()");
    }

    // Composer passes own full-frame render targets. A live scissor indicates
    // the game's split-screen path, which must retain each caller-owned view.
    if (!this.active || this.renderer.getScissorTest()) {
      this.renderer.render(this.scene, this.camera);
      return "direct";
    }

    this.composer.render(deltaSeconds);
    if (!this.flareSourceReady) {
      this.flarePass.uniforms.tFlareSource.value =
        this.bloomPass.renderTargetsVertical[1].texture;
      this.flareSourceReady = true;
    }
    return "post";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.bloomPass.dispose();
    this.flarePass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
    this.flareFallback.dispose();
  }

  private resetFlareSource(): void {
    this.flareSourceReady = false;
    this.flarePass.uniforms.tFlareSource.value = this.flareFallback;
  }

  private static validDimension(value: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
  }

  private static validPixelRatio(value: number): number {
    return Number.isFinite(value) ? Math.max(0.1, value) : 1;
  }
}
