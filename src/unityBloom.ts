import * as THREE from "three";
import {
  FullScreenQuad,
  Pass,
} from "three/examples/jsm/postprocessing/Pass.js";
import {
  visualTreatmentActivity,
  visualTreatmentSettings,
  type VisualBloomValue,
} from "./visual-treatment/settings";

export const UNITY_BLOOM_MAX_DIMENSION = 960;
export const UNITY_BLOOM_MAX_MIPS = 8;

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const PREFILTER_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tSource;
  uniform vec2 uTexelSize;
  uniform vec3 uThreshold;
  varying vec2 vUv;

  vec3 sampleAt(vec2 offset) {
    return texture2D(tSource, clamp(vUv + offset * uTexelSize, 0.0, 1.0)).rgb;
  }

  void main() {
    // URP HQ 13-sample prefilter.
    vec3 A = sampleAt(vec2(-1.0, -1.0));
    vec3 B = sampleAt(vec2( 0.0, -1.0));
    vec3 C = sampleAt(vec2( 1.0, -1.0));
    vec3 D = sampleAt(vec2(-0.5, -0.5));
    vec3 E = sampleAt(vec2( 0.5, -0.5));
    vec3 F = sampleAt(vec2(-1.0,  0.0));
    vec3 G = sampleAt(vec2( 0.0,  0.0));
    vec3 H = sampleAt(vec2( 1.0,  0.0));
    vec3 I = sampleAt(vec2(-0.5,  0.5));
    vec3 J = sampleAt(vec2( 0.5,  0.5));
    vec3 K = sampleAt(vec2(-1.0,  1.0));
    vec3 L = sampleAt(vec2( 0.0,  1.0));
    vec3 M = sampleAt(vec2( 1.0,  1.0));
    vec3 color = (D + E + I + J) * 0.125;
    color += (A + B + G + F) * 0.03125;
    color += (B + C + H + G) * 0.03125;
    color += (F + G + L + K) * 0.03125;
    color += (G + H + M + L) * 0.03125;

    float threshold = uThreshold.x;
    float knee = uThreshold.y;
    color = min(vec3(uThreshold.z), color);
    float brightness = max(color.r, max(color.g, color.b));
    float softness = clamp(brightness - threshold + knee, 0.0, 2.0 * knee);
    softness = (softness * softness) / (4.0 * knee + 1e-4);
    float multiplier = max(brightness - threshold, softness)
      / max(brightness, 1e-4);
    gl_FragColor = vec4(max(color * multiplier, 0.0), 1.0);
  }
`;

const BLUR_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tSource;
  uniform vec2 uTexelSize;
  uniform vec2 uDirection;
  uniform float uStepScale;
  varying vec2 vUv;

  vec3 sampleAt(float distance) {
    vec2 offset = uDirection * uTexelSize * uStepScale * distance;
    return texture2D(tSource, clamp(vUv + offset, 0.0, 1.0)).rgb;
  }

  void main() {
    // Five bilinear taps are the exact optimized equivalent of Unity's
    // symmetric nine-weight Gaussian kernel.
    vec3 color = sampleAt(-3.23076923) * 0.07027027;
    color += sampleAt(-1.38461538) * 0.31621622;
    color += sampleAt( 0.0) * 0.22702703;
    color += sampleAt( 1.38461538) * 0.31621622;
    color += sampleAt( 3.23076923) * 0.07027027;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const BICUBIC_HELPER = /* glsl */ `
  vec4 bicubicFilter(float fraction) {
    float f2 = fraction * fraction;
    float f3 = f2 * fraction;
    return vec4(
      (1.0 - 3.0 * fraction + 3.0 * f2 - f3) / 6.0,
      (4.0 - 6.0 * f2 + 3.0 * f3) / 6.0,
      (1.0 + 3.0 * fraction + 3.0 * f2 - 3.0 * f3) / 6.0,
      f3 / 6.0
    );
  }

  vec3 sampleBicubic(sampler2D source, vec2 uv, vec2 texelSize) {
    // Core.hlsl SampleTexture2DBicubic: cubic B-spline weights collapsed into
    // four hardware-bilinear samples (rather than sixteen explicit taps).
    vec2 size = 1.0 / texelSize;
    vec2 position = uv * size + 0.5;
    vec2 center = floor(position);
    vec2 fraction = fract(position);
    vec4 weightsX = bicubicFilter(fraction.x);
    vec4 weightsY = bicubicFilter(fraction.y);
    vec2 weight0 = vec2(
      weightsX.x + weightsX.y,
      weightsY.x + weightsY.y
    );
    vec2 weight1 = vec2(
      weightsX.z + weightsX.w,
      weightsY.z + weightsY.w
    );
    vec2 offset0 = -1.0 + vec2(
      weightsX.y / weight0.x,
      weightsY.y / weight0.y
    );
    vec2 offset1 = 1.0 + vec2(
      weightsX.w / weight1.x,
      weightsY.w / weight1.y
    );
    vec2 uv00 = clamp(
      (center + vec2(offset0.x, offset0.y) - 0.5) * texelSize,
      0.0,
      1.0
    );
    vec2 uv10 = clamp(
      (center + vec2(offset1.x, offset0.y) - 0.5) * texelSize,
      0.0,
      1.0
    );
    vec2 uv01 = clamp(
      (center + vec2(offset0.x, offset1.y) - 0.5) * texelSize,
      0.0,
      1.0
    );
    vec2 uv11 = clamp(
      (center + vec2(offset1.x, offset1.y) - 0.5) * texelSize,
      0.0,
      1.0
    );
    return texture2D(source, uv00).rgb * weight0.x * weight0.y
      + texture2D(source, uv10).rgb * weight1.x * weight0.y
      + texture2D(source, uv01).rgb * weight0.x * weight1.y
      + texture2D(source, uv11).rgb * weight1.x * weight1.y;
  }
`;

const UPSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tHighMip;
  uniform sampler2D tLowMip;
  uniform vec2 uLowTexelSize;
  uniform float uScatter;
  uniform float uHighQuality;
  varying vec2 vUv;
  ${BICUBIC_HELPER}

  void main() {
    vec3 highMip = texture2D(tHighMip, vUv).rgb;
    vec3 lowMip = uHighQuality > 0.5
      ? sampleBicubic(tLowMip, vUv, uLowTexelSize)
      : texture2D(tLowMip, vUv).rgb;
    gl_FragColor = vec4(mix(highMip, lowMip, uScatter), 1.0);
  }
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform sampler2D tSource;
  uniform sampler2D tBloom;
  uniform vec2 uBloomTexelSize;
  uniform vec4 uBloomParams;
  uniform float uHighQuality;
  varying vec2 vUv;
  ${BICUBIC_HELPER}

  void main() {
    vec3 source = texture2D(tSource, vUv).rgb;
    vec3 bloom = uHighQuality > 0.5
      ? sampleBicubic(tBloom, vUv, uBloomTexelSize)
      : texture2D(tBloom, vUv).rgb;
    gl_FragColor = vec4(source + bloom * uBloomParams.rgb * uBloomParams.a, 1.0);
  }
`;

function material(
  name: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name,
    uniforms,
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

function makeTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
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

export function unityGammaToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

export interface BloomPyramidSpec {
  width: number;
  height: number;
  mipCount: number;
  sizes: Array<{ width: number; height: number }>;
}

export function unityBloomPyramidSpec(
  sourceWidth: number,
  sourceHeight: number,
  downscale: 2 | 4,
  maxIterations: number,
): BloomPyramidSpec {
  let width = Math.max(1, Math.floor(sourceWidth / downscale));
  let height = Math.max(1, Math.floor(sourceHeight / downscale));
  const largest = Math.max(width, height);
  if (largest > UNITY_BLOOM_MAX_DIMENSION) {
    const scale = UNITY_BLOOM_MAX_DIMENSION / largest;
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }
  const available = Math.max(1, Math.floor(Math.log2(Math.max(width, height))) - 1);
  const mipCount = Math.min(
    UNITY_BLOOM_MAX_MIPS,
    Math.max(1, Math.min(Math.round(maxIterations), available)),
  );
  const sizes: BloomPyramidSpec["sizes"] = [];
  for (let index = 0; index < mipCount; index += 1) {
    sizes.push({ width, height });
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
  return { ...sizes[0], mipCount, sizes };
}

function normalizedTint(tint: readonly number[]): THREE.Vector3 {
  // URP treats volume color pickers as sRGB and uploads bloom.tint.linear.
  const linearTint = tint.map(unityGammaToLinear);
  const luminance = linearTint[0] * 0.2126
    + linearTint[1] * 0.7152
    + linearTint[2] * 0.0722;
  if (luminance <= 1e-5) return new THREE.Vector3(1, 1, 1);
  return new THREE.Vector3(
    linearTint[0] / luminance,
    linearTint[1] / luminance,
    linearTint[2] / luminance,
  );
}

export interface UnityBloomDiagnostics {
  active: boolean;
  mipCount: number;
  sizes: Array<{ width: number; height: number }>;
  drawCount: number;
  estimatedBytes: number;
}

/** Unity URP Gaussian bloom: lazy, capped, and completely skipped at zero intensity. */
export class UnityBloomPass extends Pass {
  private readonly prefilterMaterial = material("UnityBloom.PrefilterHQ13", PREFILTER_FRAGMENT, {
    tSource: { value: null },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uThreshold: { value: new THREE.Vector3(1, 0.5, 65472) },
  });
  private readonly blurMaterial = material("UnityBloom.Gaussian9Equivalent", BLUR_FRAGMENT, {
    tSource: { value: null },
    uTexelSize: { value: new THREE.Vector2(1, 1) },
    uDirection: { value: new THREE.Vector2(1, 0) },
    uStepScale: { value: 2 },
  });
  private readonly upsampleMaterial = material("UnityBloom.BicubicUpsample", UPSAMPLE_FRAGMENT, {
    tHighMip: { value: null },
    tLowMip: { value: null },
    uLowTexelSize: { value: new THREE.Vector2(1, 1) },
    uScatter: { value: 0.68 },
    uHighQuality: { value: 1 },
  });
  private readonly compositeMaterial = material("UnityBloom.AdditiveComposite", COMPOSITE_FRAGMENT, {
    tSource: { value: null },
    tBloom: { value: null },
    uBloomTexelSize: { value: new THREE.Vector2(1, 1) },
    uBloomParams: { value: new THREE.Vector4(1, 1, 1, 0) },
    uHighQuality: { value: 1 },
  });
  private readonly fsQuad = new FullScreenQuad(this.prefilterMaterial);
  private downTargets: THREE.WebGLRenderTarget[] = [];
  private upTargets: THREE.WebGLRenderTarget[] = [];
  private sourceWidth = 1;
  private sourceHeight = 1;
  private settings: Readonly<VisualBloomValue> = visualTreatmentSettings.value.bloom;
  private currentSpec: BloomPyramidSpec | null = null;
  private lookActive = false;
  private presentationEnabled = true;
  private disposed = false;
  private lastDrawCount = 0;
  private readonly unsubscribe: () => void;
  private readonly viewport = new THREE.Vector4();
  private readonly scissor = new THREE.Vector4();

  constructor(width = 1, height = 1) {
    super();
    this.needsSwap = true;
    this.setSize(width, height);
    this.unsubscribe = visualTreatmentSettings.subscribe((value) => {
      this.settings = value.bloom;
      this.lookActive = visualTreatmentActivity(value).bloom;
      this.syncEnabled();
    }, true);
  }

  /** Gates bloom with the owning presentation stack (including ?nopost). */
  setPresentationEnabled(enabled: boolean): void {
    this.presentationEnabled = enabled;
    this.syncEnabled();
  }

  get diagnostics(): UnityBloomDiagnostics {
    const sizes = this.currentSpec?.sizes.map((size) => ({ ...size })) ?? [];
    return {
      active: this.enabled && !this.disposed,
      mipCount: sizes.length,
      sizes,
      drawCount: this.lastDrawCount,
      estimatedBytes: sizes.reduce(
        (total, size) => total + size.width * size.height * 8 * 2,
        0,
      ),
    };
  }

  override setSize(width: number, height: number): void {
    this.sourceWidth = Math.max(1, Math.floor(width));
    this.sourceHeight = Math.max(1, Math.floor(height));
    if (this.currentSpec) this.rebuildTargets();
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed || !this.enabled) return;
    this.ensureTargets();
    const spec = this.currentSpec;
    if (!spec) return;

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousViewport = renderer.getViewport(this.viewport);
    const previousScissor = renderer.getScissor(this.scissor);
    const previousScissorTest = renderer.getScissorTest();
    const previousAutoClear = renderer.autoClear;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);
    renderer.autoClear = false;
    renderer.setScissorTest(false);
    this.lastDrawCount = 0;

    const draw = (shader: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null): void => {
      this.fsQuad.material = shader;
      renderer.setRenderTarget(target);
      renderer.clear();
      this.fsQuad.render(renderer);
      this.lastDrawCount += 1;
    };

    try {
      const threshold = unityGammaToLinear(this.settings.threshold);
      this.prefilterMaterial.uniforms.tSource.value = readBuffer.texture;
      (this.prefilterMaterial.uniforms.uTexelSize.value as THREE.Vector2).set(
        1 / readBuffer.width,
        1 / readBuffer.height,
      );
      (this.prefilterMaterial.uniforms.uThreshold.value as THREE.Vector3).set(
        threshold,
        threshold * 0.5,
        this.settings.clamp,
      );
      draw(this.prefilterMaterial, this.downTargets[0]);

      for (let index = 1; index < spec.mipCount; index += 1) {
        const source = this.downTargets[index - 1];
        this.blurMaterial.uniforms.tSource.value = source.texture;
        (this.blurMaterial.uniforms.uTexelSize.value as THREE.Vector2).set(
          1 / source.width,
          1 / source.height,
        );
        (this.blurMaterial.uniforms.uDirection.value as THREE.Vector2).set(1, 0);
        this.blurMaterial.uniforms.uStepScale.value = 2;
        draw(this.blurMaterial, this.upTargets[index]);

        const temporary = this.upTargets[index];
        this.blurMaterial.uniforms.tSource.value = temporary.texture;
        (this.blurMaterial.uniforms.uTexelSize.value as THREE.Vector2).set(
          1 / temporary.width,
          1 / temporary.height,
        );
        (this.blurMaterial.uniforms.uDirection.value as THREE.Vector2).set(0, 1);
        this.blurMaterial.uniforms.uStepScale.value = 1;
        draw(this.blurMaterial, this.downTargets[index]);
      }

      const scatter = 0.05 + this.settings.scatter * 0.9;
      for (let index = spec.mipCount - 2; index >= 0; index -= 1) {
        const low = index === spec.mipCount - 2
          ? this.downTargets[index + 1]
          : this.upTargets[index + 1];
        this.upsampleMaterial.uniforms.tHighMip.value = this.downTargets[index].texture;
        this.upsampleMaterial.uniforms.tLowMip.value = low.texture;
        (this.upsampleMaterial.uniforms.uLowTexelSize.value as THREE.Vector2).set(
          1 / low.width,
          1 / low.height,
        );
        this.upsampleMaterial.uniforms.uScatter.value = scatter;
        this.upsampleMaterial.uniforms.uHighQuality.value = this.settings.highQuality ? 1 : 0;
        draw(this.upsampleMaterial, this.upTargets[index]);
      }

      const result = spec.mipCount === 1 ? this.downTargets[0] : this.upTargets[0];
      const tint = normalizedTint(this.settings.tint);
      this.compositeMaterial.uniforms.tSource.value = readBuffer.texture;
      this.compositeMaterial.uniforms.tBloom.value = result.texture;
      (this.compositeMaterial.uniforms.uBloomTexelSize.value as THREE.Vector2).set(
        1 / result.width,
        1 / result.height,
      );
      (this.compositeMaterial.uniforms.uBloomParams.value as THREE.Vector4).set(
        tint.x,
        tint.y,
        tint.z,
        this.settings.intensity,
      );
      this.compositeMaterial.uniforms.uHighQuality.value = this.settings.highQuality ? 1 : 0;
      draw(this.compositeMaterial, this.renderToScreen ? null : writeBuffer);
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.autoClear = previousAutoClear;
      if (maskActive) stencil.setTest(true);
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.disposeTargets();
    this.currentSpec = null;
    this.lastDrawCount = 0;
    this.prefilterMaterial.dispose();
    this.blurMaterial.dispose();
    this.upsampleMaterial.dispose();
    this.compositeMaterial.dispose();
    this.fsQuad.dispose();
  }

  private ensureTargets(): void {
    const next = unityBloomPyramidSpec(
      this.sourceWidth,
      this.sourceHeight,
      this.settings.downscale,
      this.settings.maxIterations,
    );
    if (
      this.currentSpec &&
      this.currentSpec.mipCount === next.mipCount &&
      this.currentSpec.width === next.width &&
      this.currentSpec.height === next.height
    )
      return;
    this.currentSpec = next;
    this.allocateTargets();
  }

  private rebuildTargets(): void {
    this.currentSpec = unityBloomPyramidSpec(
      this.sourceWidth,
      this.sourceHeight,
      this.settings.downscale,
      this.settings.maxIterations,
    );
    this.allocateTargets();
  }

  private allocateTargets(): void {
    this.disposeTargets();
    if (!this.currentSpec) return;
    this.downTargets = this.currentSpec.sizes.map((size, index) =>
      makeTarget(size.width, size.height, `UnityBloom.MipDown${index}.RGBA16F`),
    );
    this.upTargets = this.currentSpec.sizes.map((size, index) =>
      makeTarget(size.width, size.height, `UnityBloom.MipUp${index}.RGBA16F`),
    );
  }

  private disposeTargets(): void {
    for (const target of [...this.downTargets, ...this.upTargets]) target.dispose();
    this.downTargets.length = 0;
    this.upTargets.length = 0;
  }

  private syncEnabled(): void {
    this.enabled = this.presentationEnabled && this.lookActive;
    if (!this.enabled) this.lastDrawCount = 0;
  }
}
