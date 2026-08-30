// Unity 6 URP Uber output port: colored vignette, exposure/tonemapping,
// change-driven 32^3 LDR grading LUT, and 8-bit dithering. The separate
// UnityBloomPass feeds this pass before HUD/CRT; OutputPass remains the only
// final linear-to-sRGB transfer.

import * as THREE from "three";
import {
  FullScreenQuad,
  Pass,
} from "three/examples/jsm/postprocessing/Pass.js";
import {
  DEFAULT_VISUAL_TREATMENT,
  visualTreatmentSettings,
  type VisualTreatmentValue,
} from "./visual-treatment/settings";
import { UnityColorLut } from "./unityColorLut";

export const UNITY_POST_PROFILE = Object.freeze({
  output: Object.freeze({
    gradingMode: "low-dynamic-range" as const,
    tonemapping: "none" as const,
    lutSize: 32,
    lutFormat: "R8G8B8A8_UNorm" as const,
    dithering: true,
    fastSrgbConversion: false,
  }),
});

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FINAL_GRADE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform sampler2D tInternalLut;
  uniform sampler2D tBlueNoise;
  uniform vec4 uDitherParams;
  uniform float uGradeEnabled;
  uniform float uLutEnabled;
  uniform float uDitherEnabled;
  uniform float uLookEnabled;
  uniform float uPostExposure;
  uniform float uToneMapper;
  uniform vec3 uVignetteColor;
  uniform vec4 uVignetteParams;
  uniform float uVignetteRoundness;
  varying vec2 vUv;

  vec3 neutralCurve(vec3 x) {
    const float a = 0.2;
    const float b = 0.29;
    const float c = 0.24;
    const float d = 0.272;
    const float e = 0.02;
    const float f = 0.3;
    return ((x * (a * x + c * b) + d * e)
      / (x * (a * x + b) + d * f)) - e / f;
  }

  vec3 neutralTonemap(vec3 color) {
    color = min(max(color, 0.0), 435.18712);
    vec3 whiteScale = 1.0 / neutralCurve(vec3(5.3));
    return neutralCurve(color * whiteScale) * whiteScale;
  }

  vec3 acesTonemap(vec3 color) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((color * (a * color + b)) / (color * (c * color + d) + e), 0.0, 1.0);
  }

  vec3 applyVignette(vec3 color) {
    vec2 distanceFromCenter = abs(vUv - uVignetteParams.xy)
      * uVignetteParams.z;
    distanceFromCenter.x *= uVignetteRoundness;
    float factor = pow(
      clamp(1.0 - dot(distanceFromCenter, distanceFromCenter), 0.0, 1.0),
      uVignetteParams.w
    );
    return color * mix(uVignetteColor, vec3(1.0), factor);
  }

  vec3 applyInternalLut(vec3 color) {
    // Color.hlsl ApplyLut2D, with the active 32^3 LDR strip LUT:
    // scaleOffset = (1 / 1024, 1 / 32, 31).
    vec3 uvw = color;
    uvw.z *= 31.0;
    float shift = floor(uvw.z);
    uvw.xy = uvw.xy * 31.0 * vec2(1.0 / 1024.0, 1.0 / 32.0)
      + 0.5 * vec2(1.0 / 1024.0, 1.0 / 32.0);
    uvw.x += shift * (1.0 / 32.0);
    vec3 lowSlice = texture2D(tInternalLut, uvw.xy).rgb;
    vec3 highSlice = texture2D(
      tInternalLut,
      uvw.xy + vec2(1.0 / 32.0, 0.0)
    ).rgb;
    return mix(lowSlice, highSlice, uvw.z - shift);
  }

  vec3 linearToSrgb(vec3 color) {
    vec3 low = color * 12.92;
    vec3 high = 1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4))
      - 0.055;
    return mix(high, low, lessThanEqual(color, vec3(0.0031308)));
  }

  vec3 srgbToLinear(vec3 color) {
    vec3 low = color / 12.92;
    vec3 high = pow(
      max((color + 0.055) / 1.055, vec3(0.0)),
      vec3(2.4)
    );
    return mix(high, low, lessThanEqual(color, vec3(0.04045)));
  }

  vec3 applyUnityDither(vec3 color) {
    float noise = texture2D(
      tBlueNoise,
      vUv * uDitherParams.xy + uDitherParams.zw
    ).a * 2.0 - 1.0;
    noise = sign(noise) * (1.0 - sqrt(1.0 - abs(noise)));
    return srgbToLinear(linearToSrgb(color) + noise / 255.0);
  }

  void main() {
    vec4 source = texture2D(tSource, vUv);
    vec3 color = source.rgb;

    if (uGradeEnabled > 0.5) {
      if (uLookEnabled > 0.5 && uVignetteParams.z > 0.0) {
        color = applyVignette(color);
      }
      if (uLookEnabled > 0.5) color *= uPostExposure;
      if (uToneMapper > 1.5) color = acesTonemap(color);
      else if (uToneMapper > 0.5) color = neutralTonemap(color);
      // ApplyTonemap saturates even when TonemappingMode is None.
      color = clamp(color, 0.0, 1.0);
      if (uLutEnabled > 0.5) {
        color = applyInternalLut(color);
      }
      if (uDitherEnabled > 0.5) {
        color = applyUnityDither(color);
      }
      // UberPost applies this after dithering to prevent negative feedback
      // values. OutputPass performs the one final sRGB transfer afterward.
      color = max(color, vec3(0.0));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

const UNITY_DITHER_SIZE = 16;

function hash32(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}

/**
 * Builds a repo-native progressive blue-noise rank texture.
 *
 * Each successive rank chooses the unoccupied toroidal texel farthest from
 * the existing set (deterministic best-candidate sampling). The resulting
 * 0..255 permutation is uniform and suppresses low-frequency clusters without
 * copying Unity's package-owned blue-noise images.
 */
function makeGeneratedBlueNoise(): THREE.DataTexture {
  const count = UNITY_DITHER_SIZE * UNITY_DITHER_SIZE;
  const ranks = new Int16Array(count);
  ranks.fill(-1);
  const chosen: number[] = [];

  for (let rank = 0; rank < count; rank += 1) {
    let bestPixel = -1;
    let bestDistance = -1;
    let bestTie = -1;
    for (let pixel = 0; pixel < count; pixel += 1) {
      if (ranks[pixel] >= 0) continue;

      let minDistance = Number.POSITIVE_INFINITY;
      const px = pixel % UNITY_DITHER_SIZE;
      const py = Math.floor(pixel / UNITY_DITHER_SIZE);
      for (const prior of chosen) {
        const qx = prior % UNITY_DITHER_SIZE;
        const qy = Math.floor(prior / UNITY_DITHER_SIZE);
        const rawX = Math.abs(px - qx);
        const rawY = Math.abs(py - qy);
        const dx = Math.min(rawX, UNITY_DITHER_SIZE - rawX);
        const dy = Math.min(rawY, UNITY_DITHER_SIZE - rawY);
        minDistance = Math.min(minDistance, dx * dx + dy * dy);
      }

      if (chosen.length === 0) minDistance = 0;
      const tie = hash32(pixel ^ Math.imul(rank + 1, 0x9e3779b9));
      if (
        minDistance > bestDistance ||
        (minDistance === bestDistance && tie > bestTie)
      ) {
        bestPixel = pixel;
        bestDistance = minDistance;
        bestTie = tie;
      }
    }
    ranks[bestPixel] = rank;
    chosen.push(bestPixel);
  }

  const bytes = new Uint8Array(count * 4);
  for (let pixel = 0; pixel < count; pixel += 1) {
    const value = ranks[pixel];
    const index = pixel * 4;
    bytes[index] = value;
    bytes[index + 1] = value;
    bytes[index + 2] = value;
    bytes[index + 3] = value;
  }

  const texture = new THREE.DataTexture(
    bytes,
    UNITY_DITHER_SIZE,
    UNITY_DITHER_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = "Generated 16x16 Unity-style blue-noise ranks";
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeMaterial(
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

/**
 * Exact active Unity neutral LDR grading and dithering stage.
 *
 * The pass consumes and produces linear color, owns no render targets, and
 * issues one fullscreen draw. Add it after SMAA and before CRT/OutputPass.
 */
export class UnityPostPass extends Pass {
  private readonly colorLut = new UnityColorLut();
  private readonly blueNoise = makeGeneratedBlueNoise();
  private readonly finalGradeMaterial: THREE.ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;
  private ditherFrame = 0;
  private disposed = false;
  private aspect = 1;
  private readonly unsubscribeLook: () => void;

  constructor(width = 1, height = 1) {
    super();
    this.needsSwap = true;
    const query =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    this.finalGradeMaterial = makeMaterial(
      "UnityPost.NeutralLdrGrade",
      FINAL_GRADE_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        tInternalLut: { value: this.colorLut.texture },
        tBlueNoise: { value: this.blueNoise },
        uDitherParams: { value: new THREE.Vector4(1, 1, 0, 0) },
        uGradeEnabled: { value: query.has("rawoutput") ? 0 : 1 },
        uLutEnabled: { value: query.has("nolut") ? 0 : 1 },
        uDitherEnabled: { value: query.has("nodither") ? 0 : 1 },
        uLookEnabled: { value: 0 },
        uPostExposure: { value: 1 },
        uToneMapper: { value: 0 },
        uVignetteColor: { value: new THREE.Vector3(0, 0, 0) },
        uVignetteParams: { value: new THREE.Vector4(0.5, 0.5, 0, 1) },
        uVignetteRoundness: { value: 1 },
      },
    );
    this.fsQuad = new FullScreenQuad(this.finalGradeMaterial);
    this.unsubscribeLook = visualTreatmentSettings.subscribe(
      (value) => this.applyVisualTreatment(value),
      true,
    );
    this.setSize(width, height);
  }

  get lutDiagnostics() {
    return this.colorLut.diagnostics;
  }

  private applyVisualTreatment(value: Readonly<VisualTreatmentValue>): void {
    const grading = value.enabled
      ? value.grading
      : DEFAULT_VISUAL_TREATMENT.grading;
    const vignette = value.enabled
      ? value.vignette
      : DEFAULT_VISUAL_TREATMENT.vignette;
    this.finalGradeMaterial.uniforms.uLookEnabled.value = value.enabled ? 1 : 0;
    this.finalGradeMaterial.uniforms.uPostExposure.value = Math.pow(
      2,
      grading.exposureEV,
    );
    this.finalGradeMaterial.uniforms.uToneMapper.value =
      grading.toneMapper === "aces"
        ? 2
        : grading.toneMapper === "neutral"
          ? 1
          : 0;
    (this.finalGradeMaterial.uniforms.uVignetteColor.value as THREE.Vector3)
      .fromArray(vignette.color);
    const vignetteParams = this.finalGradeMaterial.uniforms.uVignetteParams
      .value as THREE.Vector4;
    vignetteParams.set(
      vignette.center[0],
      vignette.center[1],
      vignette.intensity * 3,
      vignette.smoothness * 5,
    );
    this.finalGradeMaterial.uniforms.uVignetteRoundness.value =
      vignette.rounded ? this.aspect : 1;
    this.colorLut.setSettings(grading);
  }

  override setSize(width: number, height: number): void {
    const fullWidth = Math.max(1, Math.floor(width));
    const fullHeight = Math.max(1, Math.floor(height));
    this.aspect = fullWidth / fullHeight;
    const rounded = visualTreatmentSettings.value.vignette.rounded;
    this.finalGradeMaterial.uniforms.uVignetteRoundness.value = rounded ? this.aspect : 1;
    (
      this.finalGradeMaterial.uniforms.uDitherParams
        .value as THREE.Vector4
    ).set(
      fullWidth / UNITY_DITHER_SIZE,
      fullHeight / UNITY_DITHER_SIZE,
      0,
      0,
    );
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed) return;

    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    const stencil = renderer.state.buffers.stencil;
    if (maskActive) stencil.setTest(false);

    try {
      if (this.finalGradeMaterial.uniforms.uLutEnabled.value > 0.5)
        this.colorLut.update(renderer);
      if (maskActive) stencil.setTest(true);
      this.finalGradeMaterial.uniforms.tSource.value = readBuffer.texture;
      const ditherParams = this.finalGradeMaterial.uniforms.uDitherParams
        .value as THREE.Vector4;
      const frame = this.ditherFrame++;
      ditherParams.z = hash32(frame * 2 + 1) / 0x100000000;
      ditherParams.w = hash32(frame * 2 + 2) / 0x100000000;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      if (this.clear) renderer.clear();
      this.fsQuad.render(renderer);
    } finally {
      if (maskActive) stencil.setTest(true);
      renderer.autoClear = oldAutoClear;
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeLook();
    this.colorLut.dispose();
    this.blueNoise.dispose();
    this.finalGradeMaterial.dispose();
    this.fsQuad.dispose();
  }
}
