// Unity 6 URP bloom + screen-space lens flare port.
//
// Source parity targets:
// - com.unity.render-pipelines.universal/Shaders/PostProcessing/Bloom.shader
// - .../Runtime/Passes/PostProcess/BloomPostProcessPass.cs
// - com.unity.render-pipelines.core/Runtime/PostProcessing/Shaders/
//   LensFlareScreenSpaceCommon.hlsl
//
// The pass consumes linear HDR color and includes the active Uber output
// permutation: Bloom, Tonemapping None's required saturation, the neutral LDR
// 32^3 internal LUT, and 8-bit dithering. It deliberately leaves the final
// linear-to-sRGB transfer to Three's OutputPass.

import * as THREE from "three";
import {
  FullScreenQuad,
  Pass,
} from "three/examples/jsm/postprocessing/Pass.js";

const BLOOM_MIP_COUNT = 6;

/** Runtime values after Unity's C# preprocessing of the serialized profile. */
export const UNITY_POST_PROFILE = Object.freeze({
  bloom: Object.freeze({
    downscale: 2,
    highQualityFiltering: true,
    threshold: 1,
    thresholdKnee: 0.5,
    clamp: 65472,
    mipCount: BLOOM_MIP_COUNT,
    scatter: 0.68,
    intensity: 0.3,
  }),
  lensFlare: Object.freeze({
    bloomMip: 1,
    intensity: 0.49,
    firstFlareIntensity: 1,
    secondaryFlareIntensity: 0.5,
    warpedFlareIntensity: 3,
    warpedFlareScale: Object.freeze([1, 1] as const),
    samples: 1,
    sampleDimmer: 0.5,
    vignetteEffect: 1,
    startingPosition: 1.25,
    scale: 1.5,
    chromaticAberrationIntensity: 0.015,
    streaksIntensity: 0.24,
    streaksLength: 0.83,
    streaksOrientationDegrees: 0,
    streaksThreshold: 0.25,
    resolutionDivisor: 4,
  }),
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

const BLOOM_PREFILTER_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform vec2 uSourceTexelSize;
  varying vec2 vUv;

  vec3 samplePrefilter(vec2 offset) {
    return texture2D(tSource, vUv + uSourceTexelSize * offset).rgb;
  }

  void main() {
    // Unity's HQ 13-tap downsample. The overlapping 2x2 boxes are intentional.
    vec3 A = samplePrefilter(vec2(-1.0, -1.0));
    vec3 B = samplePrefilter(vec2( 0.0, -1.0));
    vec3 C = samplePrefilter(vec2( 1.0, -1.0));
    vec3 D = samplePrefilter(vec2(-0.5, -0.5));
    vec3 E = samplePrefilter(vec2( 0.5, -0.5));
    vec3 F = samplePrefilter(vec2(-1.0,  0.0));
    vec3 G = samplePrefilter(vec2( 0.0,  0.0));
    vec3 H = samplePrefilter(vec2( 1.0,  0.0));
    vec3 I = samplePrefilter(vec2(-0.5,  0.5));
    vec3 J = samplePrefilter(vec2( 0.5,  0.5));
    vec3 K = samplePrefilter(vec2(-1.0,  1.0));
    vec3 L = samplePrefilter(vec2( 0.0,  1.0));
    vec3 M = samplePrefilter(vec2( 1.0,  1.0));

    vec3 color = (D + E + I + J) * 0.125;
    color += (A + B + G + F) * 0.03125;
    color += (B + C + H + G) * 0.03125;
    color += (F + G + L + K) * 0.03125;
    color += (G + H + M + L) * 0.03125;

    color = min(vec3(65472.0), color);

    float brightness = max(color.r, max(color.g, color.b));
    float softness = clamp(brightness - 1.0 + 0.5, 0.0, 1.0);
    softness = (softness * softness) / (2.0 + 0.0001);
    float multiplier =
      max(brightness - 1.0, softness) / max(brightness, 0.0001);
    color = max(color * multiplier, vec3(0.0));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOOM_BLUR_HORIZONTAL_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform vec2 uSourceTexelSize;
  varying vec2 vUv;

  vec3 sampleHdr(vec2 uv, vec2 clampTexelSize) {
    vec2 maxUv = vec2(1.0) - 0.5 * clampTexelSize;
    return texture2D(tSource, clamp(uv, vec2(0.0), maxUv)).rgb;
  }

  void main() {
    // This pass both downsamples by two and applies Unity's exact 9-tap kernel.
    vec2 texelSize = uSourceTexelSize * 2.0;
    vec3 c0 = sampleHdr(vUv - vec2(texelSize.x * 4.0, 0.0), texelSize);
    vec3 c1 = sampleHdr(vUv - vec2(texelSize.x * 3.0, 0.0), texelSize);
    vec3 c2 = sampleHdr(vUv - vec2(texelSize.x * 2.0, 0.0), texelSize);
    vec3 c3 = sampleHdr(vUv - vec2(texelSize.x * 1.0, 0.0), texelSize);
    vec3 c4 = sampleHdr(vUv, texelSize);
    vec3 c5 = sampleHdr(vUv + vec2(texelSize.x * 1.0, 0.0), texelSize);
    vec3 c6 = sampleHdr(vUv + vec2(texelSize.x * 2.0, 0.0), texelSize);
    vec3 c7 = sampleHdr(vUv + vec2(texelSize.x * 3.0, 0.0), texelSize);
    vec3 c8 = sampleHdr(vUv + vec2(texelSize.x * 4.0, 0.0), texelSize);

    vec3 color =
      c0 * 0.01621622 +
      c1 * 0.05405405 +
      c2 * 0.12162162 +
      c3 * 0.19459459 +
      c4 * 0.22702703 +
      c5 * 0.19459459 +
      c6 * 0.12162162 +
      c7 * 0.05405405 +
      c8 * 0.01621622;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOOM_BLUR_VERTICAL_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform vec2 uSourceTexelSize;
  varying vec2 vUv;

  vec3 sampleHdr(vec2 offset) {
    vec2 uv = vUv - offset * uSourceTexelSize;
    vec2 maxUv = vec2(1.0) - 0.5 * uSourceTexelSize;
    return texture2D(tSource, clamp(uv, vec2(0.0), maxUv)).rgb;
  }

  void main() {
    // Five bilinear taps reconstruct Unity's nine-tap vertical Gaussian.
    vec3 c0 = sampleHdr(-vec2(0.0, 3.23076923));
    vec3 c1 = sampleHdr(-vec2(0.0, 1.38461538));
    vec3 c2 = sampleHdr( vec2(0.0, 0.0));
    vec3 c3 = sampleHdr( vec2(0.0, 1.38461538));
    vec3 c4 = sampleHdr( vec2(0.0, 3.23076923));

    vec3 color =
      c0 * 0.07027027 +
      c1 * 0.31621622 +
      c2 * 0.22702703 +
      c3 * 0.31621622 +
      c4 * 0.07027027;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BLOOM_UPSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tHighMip;
  uniform sampler2D tLowMip;
  uniform vec4 uLowMipSize;
  varying vec2 vUv;

  vec2 bSpline3MiddleLeft(vec2 x) {
    return vec2(0.16666667) + x * (0.5 + x * (0.5 - x * 0.5));
  }

  vec2 bSpline3MiddleRight(vec2 x) {
    return vec2(0.66666667) + x * (-1.0 + 0.5 * x) * x;
  }

  vec2 bSpline3Rightmost(vec2 x) {
    return vec2(0.16666667) +
      x * (-0.5 + x * (0.5 - x * 0.16666667));
  }

  vec3 sampleLowMipBicubic(vec2 coord) {
    vec2 xy = coord * uLowMipSize.xy + 0.5;
    vec2 ic = floor(xy);
    vec2 fc = fract(xy);

    vec2 r = bSpline3Rightmost(fc);
    vec2 mr = bSpline3MiddleRight(fc);
    vec2 ml = bSpline3MiddleLeft(fc);
    vec2 l = vec2(1.0) - mr - ml - r;

    vec2 weights0 = r + mr;
    vec2 weights1 = ml + l;
    vec2 offsets0 = -1.0 + mr / weights0;
    vec2 offsets1 =  1.0 + l / weights1;

    vec2 uv00 = (ic + vec2(offsets0.x, offsets0.y) - 0.5)
      * uLowMipSize.zw;
    vec2 uv10 = (ic + vec2(offsets1.x, offsets0.y) - 0.5)
      * uLowMipSize.zw;
    vec2 uv01 = (ic + vec2(offsets0.x, offsets1.y) - 0.5)
      * uLowMipSize.zw;
    vec2 uv11 = (ic + vec2(offsets1.x, offsets1.y) - 0.5)
      * uLowMipSize.zw;

    uv00 = clamp(uv00, vec2(0.0), vec2(1.0));
    uv10 = clamp(uv10, vec2(0.0), vec2(1.0));
    uv01 = clamp(uv01, vec2(0.0), vec2(1.0));
    uv11 = clamp(uv11, vec2(0.0), vec2(1.0));

    return weights0.y * (
      weights0.x * texture2D(tLowMip, uv00).rgb +
      weights1.x * texture2D(tLowMip, uv10).rgb
    ) + weights1.y * (
      weights0.x * texture2D(tLowMip, uv01).rgb +
      weights1.x * texture2D(tLowMip, uv11).rgb
    );
  }

  void main() {
    vec3 highMip = texture2D(tHighMip, vUv).rgb;
    vec3 lowMip = sampleLowMipBicubic(vUv);
    gl_FragColor = vec4(mix(highMip, lowMip, 0.68), 1.0);
  }
`;

const STREAK_PREFILTER_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tBloomMip;
  uniform vec2 uBloomTexelSize;
  varying vec2 vUv;

  vec3 sampleBloom(vec2 uv) {
    vec2 maxUv = vec2(1.0) - 0.5 * uBloomTexelSize;
    return texture2D(tBloomMip, clamp(uv, vec2(0.0), maxUv)).rgb;
  }

  void main() {
    // Authored orientation is zero. Unity preprocesses it to anamorphism
    // (-1, 0), so prefiltering straddles one source texel vertically.
    float dy = -uBloomTexelSize.y;
    vec2 u0 = clamp(vec2(vUv.x, vUv.y - dy), 0.0, 1.0);
    vec2 u1 = clamp(vec2(vUv.x, vUv.y + dy), 0.0, 1.0);
    vec3 color = (sampleBloom(u0) + sampleBloom(u1)) * 0.5;

    float brightness = max(color.r, max(color.g, color.b));
    color *= max(brightness - 0.25, 0.0) / max(brightness, 0.0001);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const STREAK_DOWNSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform vec2 uSourceTexelSize;
  uniform float uMipLevel;
  uniform float uStreakLength;
  varying vec2 vUv;

  vec3 sampleScaled(vec2 uv) {
    vec2 maxUv = vec2(1.0) - 0.5 * uSourceTexelSize;
    return texture2D(tSource, clamp(uv, vec2(0.0), maxUv)).rgb;
  }

  void main() {
    // GetAnamorphism() == (-1, 0), resolution ratio == 4.
    float dx =
      -uSourceTexelSize.x * uStreakLength * (uMipLevel + 1.0) / 4.0;

    vec2 u0 = clamp(vUv - vec2(dx * 5.0, 0.0), 0.0, 1.0);
    vec2 u1 = clamp(vUv - vec2(dx * 3.0, 0.0), 0.0, 1.0);
    vec2 u2 = clamp(vUv - vec2(dx * 1.0, 0.0), 0.0, 1.0);
    vec2 u3 = clamp(vUv + vec2(dx * 1.0, 0.0), 0.0, 1.0);
    vec2 u4 = clamp(vUv + vec2(dx * 3.0, 0.0), 0.0, 1.0);
    vec2 u5 = clamp(vUv + vec2(dx * 5.0, 0.0), 0.0, 1.0);

    vec3 color =
      sampleScaled(u0) * (1.0 / 12.0) +
      sampleScaled(u1) * (2.0 / 12.0) +
      sampleScaled(u2) * (3.0 / 12.0) +
      sampleScaled(u3) * (3.0 / 12.0) +
      sampleScaled(u4) * (2.0 / 12.0) +
      sampleScaled(u5) * (1.0 / 12.0);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const STREAK_UPSAMPLE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform vec2 uSourceTexelSize;
  uniform float uMipLevel;
  uniform float uStreakLength;
  varying vec2 vUv;

  vec3 sampleScaled(vec2 uv) {
    vec2 maxUv = vec2(1.0) - 0.5 * uSourceTexelSize;
    return texture2D(tSource, clamp(uv, vec2(0.0), maxUv)).rgb;
  }

  void main() {
    float dx =
      -uSourceTexelSize.x * uStreakLength * 1.5
      * (uMipLevel + 1.0) / 4.0;

    vec2 u0 = clamp(vUv - vec2(dx, 0.0), 0.0, 1.0);
    vec2 u1 = clamp(vUv, 0.0, 1.0);
    vec2 u2 = clamp(vUv + vec2(dx, 0.0), 0.0, 1.0);

    vec3 color =
      sampleScaled(u0) * 0.25 +
      sampleScaled(u1) * 0.5 +
      sampleScaled(u2) * 0.25;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const FLARE_COMPOSITION_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tBloomMip;
  uniform sampler2D tStreak;
  uniform vec2 uBloomTexelSize;
  uniform vec2 uStreakTexelSize;
  uniform vec2 uWarpedScale;
  varying vec2 vUv;

  const float PI = 3.141592653589793;
  const float SQRT_TWO = 1.4142135623730951;
  const float CHROMA = 0.015;

  vec2 clampForBilinear(vec2 uv, vec2 texelSize) {
    return clamp(
      uv,
      vec2(0.0),
      vec2(1.0) - 0.5 * texelSize
    );
  }

  vec2 scaleUv(vec2 uv, float signedScale, bool polar) {
    bool invert = signedScale < 0.0;
    float scale = abs(signedScale);

    if (polar) {
      float inverseScale = 1.0 / scale;
      vec2 p = vec2(
        uWarpedScale.x * 2.0 * inverseScale * (uv.x - 0.5),
        uWarpedScale.y * 2.0 * inverseScale * (uv.y - 0.5)
      );

      float radius = clamp(length(p) / SQRT_TWO, 0.0, 1.0);
      float angle = atan(p.x, p.y);
      float angularUv = 1.0 -
        clamp((angle + PI) / (2.0 * PI), 0.0, 1.0);
      return vec2(angularUv, invert ? 1.0 - radius : radius);
    }

    vec2 result = (uv - 0.5) / scale + 0.5;
    return invert ? 1.0 - result : result;
  }

  vec2 chromaDiff(vec2 uv) {
    vec2 coords = 2.0 * uv - 1.0;
    vec2 endpoint = uv - coords * dot(coords, coords) * CHROMA;
    return (endpoint - uv) / 3.0;
  }

  vec3 sampleBloomGhost(
    vec2 screenUv,
    float signedScale,
    bool polar
  ) {
    vec2 diff = chromaDiff(screenUv);
    vec2 uv = scaleUv(screenUv, signedScale, polar);
    return vec3(
      texture2D(
        tBloomMip,
        clampForBilinear(uv, uBloomTexelSize)
      ).r,
      texture2D(
        tBloomMip,
        clampForBilinear(uv + diff, uBloomTexelSize)
      ).g,
      texture2D(
        tBloomMip,
        clampForBilinear(uv + 2.0 * diff, uBloomTexelSize)
      ).b
    );
  }

  vec3 sampleStreak(vec2 screenUv) {
    vec2 diff = chromaDiff(screenUv);
    return vec3(
      texture2D(
        tStreak,
        clampForBilinear(screenUv, uStreakTexelSize)
      ).r,
      texture2D(
        tStreak,
        clampForBilinear(screenUv + diff, uStreakTexelSize)
      ).g,
      texture2D(
        tStreak,
        clampForBilinear(screenUv + 2.0 * diff, uStreakTexelSize)
      ).b
    );
  }

  void main() {
    // There is one authored sample, so sampleDimmer^0 is exactly one.
    float sampleScale = pow(1.25, 1.5);

    vec3 classic = sampleBloomGhost(vUv, -sampleScale, false)
      * (0.5 * 0.1);
    vec3 classicInv = sampleBloomGhost(vUv, sampleScale, false)
      * (1.0 * 0.1);
    vec3 polarInv = sampleBloomGhost(vUv, -sampleScale, true)
      * (3.0 * 0.1);

    float vignetteX = clamp(
      pow(abs(2.0 * vUv.x - 1.0), 2.0),
      0.0,
      1.0
    );
    float vignetteY = clamp(
      pow(abs(2.0 * vUv.y - 1.0), 2.0),
      0.0,
      1.0
    );
    float vignetteRound = clamp(
      pow(vignetteX + vignetteY, 2.0),
      0.0,
      1.0
    );

    vec3 regularFlare = (classicInv + classic) * vignetteRound;
    regularFlare += polarInv * vignetteX;
    vec3 streakFlare = sampleStreak(vUv) * 0.24;

    gl_FragColor = vec4((regularFlare + streakFlare) * 0.49, 1.0);
  }
`;

const FLARE_WRITE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tFlare;
  varying vec2 vUv;

  void main() {
    gl_FragColor = vec4(texture2D(tFlare, vUv).rgb, 1.0);
  }
`;

const FINAL_COMPOSITE_FRAGMENT = /* glsl */ `
  precision highp float;

  uniform sampler2D tSource;
  uniform sampler2D tBloom;
  uniform sampler2D tInternalLut;
  uniform sampler2D tBlueNoise;
  uniform vec4 uBloomSize;
  uniform vec4 uDitherParams;
  uniform float uBloomIntensity;
  uniform float uBloomDebug;
  uniform float uGradeEnabled;
  uniform float uLutEnabled;
  uniform float uDitherEnabled;
  varying vec2 vUv;

  vec2 bSpline3MiddleLeft(vec2 x) {
    return vec2(0.16666667) + x * (0.5 + x * (0.5 - x * 0.5));
  }

  vec2 bSpline3MiddleRight(vec2 x) {
    return vec2(0.66666667) + x * (-1.0 + 0.5 * x) * x;
  }

  vec2 bSpline3Rightmost(vec2 x) {
    return vec2(0.16666667) +
      x * (-0.5 + x * (0.5 - x * 0.16666667));
  }

  vec3 sampleBloomBicubic(vec2 coord) {
    // UberPost clamps the bloom UV for bilinear sampling before applying the
    // same four-bilinear-tap B-spline used by Bloom.shader.
    coord = clamp(
      coord,
      vec2(0.0),
      vec2(1.0) - 0.5 * uBloomSize.zw
    );

    vec2 xy = coord * uBloomSize.xy + 0.5;
    vec2 ic = floor(xy);
    vec2 fc = fract(xy);

    vec2 r = bSpline3Rightmost(fc);
    vec2 mr = bSpline3MiddleRight(fc);
    vec2 ml = bSpline3MiddleLeft(fc);
    vec2 l = vec2(1.0) - mr - ml - r;

    vec2 weights0 = r + mr;
    vec2 weights1 = ml + l;
    vec2 offsets0 = -1.0 + mr / weights0;
    vec2 offsets1 =  1.0 + l / weights1;

    vec2 uv00 = (ic + vec2(offsets0.x, offsets0.y) - 0.5)
      * uBloomSize.zw;
    vec2 uv10 = (ic + vec2(offsets1.x, offsets0.y) - 0.5)
      * uBloomSize.zw;
    vec2 uv01 = (ic + vec2(offsets0.x, offsets1.y) - 0.5)
      * uBloomSize.zw;
    vec2 uv11 = (ic + vec2(offsets1.x, offsets1.y) - 0.5)
      * uBloomSize.zw;

    uv00 = clamp(uv00, vec2(0.0), vec2(1.0));
    uv10 = clamp(uv10, vec2(0.0), vec2(1.0));
    uv01 = clamp(uv01, vec2(0.0), vec2(1.0));
    uv11 = clamp(uv11, vec2(0.0), vec2(1.0));

    return weights0.y * (
      weights0.x * texture2D(tBloom, uv00).rgb +
      weights1.x * texture2D(tBloom, uv10).rgb
    ) + weights1.y * (
      weights0.x * texture2D(tBloom, uv01).rgb +
      weights1.x * texture2D(tBloom, uv11).rgb
    );
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
    vec3 bloom = sampleBloomBicubic(vUv);
    if (uBloomDebug > 0.5) {
      gl_FragColor = vec4(bloom * 0.05, 1.0);
      return;
    }
    vec3 color = source.rgb + bloom * uBloomIntensity;

    if (uGradeEnabled > 0.5) {
      // Common.hlsl ApplyTonemap returns saturate(input) even when the active
      // TonemappingMode is None. The neutral default volume then samples the
      // internally generated 32^3 R8 UNorm identity LUT.
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

const UNITY_LUT_SIZE = 32;
const UNITY_LUT_WIDTH = UNITY_LUT_SIZE * UNITY_LUT_SIZE;
const UNITY_DITHER_SIZE = 16;

function makeIdentityLdrLut(): THREE.DataTexture {
  const bytes = new Uint8Array(
    UNITY_LUT_WIDTH * UNITY_LUT_SIZE * 4,
  );
  for (let green = 0; green < UNITY_LUT_SIZE; green += 1) {
    for (let blue = 0; blue < UNITY_LUT_SIZE; blue += 1) {
      for (let red = 0; red < UNITY_LUT_SIZE; red += 1) {
        const x = blue * UNITY_LUT_SIZE + red;
        const index = (green * UNITY_LUT_WIDTH + x) * 4;
        bytes[index] = Math.round(red * 255 / (UNITY_LUT_SIZE - 1));
        bytes[index + 1] = Math.round(
          green * 255 / (UNITY_LUT_SIZE - 1),
        );
        bytes[index + 2] = Math.round(
          blue * 255 / (UNITY_LUT_SIZE - 1),
        );
        bytes[index + 3] = 255;
      }
    }
  }

  const texture = new THREE.DataTexture(
    bytes,
    UNITY_LUT_WIDTH,
    UNITY_LUT_SIZE,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.name = "Unity neutral LDR 32^3 identity LUT";
  texture.colorSpace = THREE.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function hash32(value: number): number {
  let x = value | 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
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

function makeRenderTarget(
  width: number,
  height: number,
  name: string,
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.name = name;
  target.texture.generateMipmaps = false;
  target.texture.colorSpace = THREE.NoColorSpace;
  return target;
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
 * Exact active Unity URP Gaussian bloom, screen-space lens flare, and neutral
 * LDR Uber output pass.
 *
 * Add it after the scene RenderPass and before any OutputPass. EffectComposer
 * supplies physical-pixel dimensions to setSize(), and this pass swaps because
 * it writes the complete linear-HDR scene plus bloom to writeBuffer (or
 * directly to screen).
 */
export class UnityPostPass extends Pass {
  /** Reconstructed bloom mip 1, used as the flare source. */
  readonly bloomMip1: THREE.Texture;

  private readonly mipDown: THREE.WebGLRenderTarget[] = [];
  private readonly mipUp: THREE.WebGLRenderTarget[] = [];
  private readonly streakTargets: readonly [
    THREE.WebGLRenderTarget,
    THREE.WebGLRenderTarget,
  ];
  private readonly flareResult: THREE.WebGLRenderTarget;
  private readonly internalLut = makeIdentityLdrLut();
  private readonly blueNoise = makeGeneratedBlueNoise();

  private readonly prefilterMaterial: THREE.ShaderMaterial;
  private readonly blurHorizontalMaterial: THREE.ShaderMaterial;
  private readonly blurVerticalMaterial: THREE.ShaderMaterial;
  private readonly upsampleMaterial: THREE.ShaderMaterial;
  private readonly streakPrefilterMaterial: THREE.ShaderMaterial;
  private readonly streakDownsampleMaterial: THREE.ShaderMaterial;
  private readonly streakUpsampleMaterial: THREE.ShaderMaterial;
  private readonly flareCompositionMaterial: THREE.ShaderMaterial;
  private readonly flareWriteMaterial: THREE.ShaderMaterial;
  private readonly finalCompositeMaterial: THREE.ShaderMaterial;
  private readonly materials: readonly THREE.ShaderMaterial[];
  private readonly fsQuad: FullScreenQuad;

  private width = 1;
  private height = 1;
  private streakPassCount = 1;
  private ditherFrame = 0;
  private readonly flareEnabled =
    typeof window === "undefined" ||
    !new URLSearchParams(window.location.search).has("noflare");
  private readonly prefilterDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("prefilterdebug");
  private disposed = false;

  constructor(width = 1, height = 1) {
    super();

    this.needsSwap = true;

    for (let i = 0; i < BLOOM_MIP_COUNT; i += 1) {
      this.mipDown.push(makeRenderTarget(1, 1, `UnityBloom.down${i}`));
      this.mipUp.push(makeRenderTarget(1, 1, `UnityBloom.up${i}`));
    }

    this.streakTargets = [
      makeRenderTarget(1, 1, "UnityLensFlare.streak0"),
      makeRenderTarget(1, 1, "UnityLensFlare.streak1"),
    ];
    this.flareResult = makeRenderTarget(
      1,
      1,
      "UnityLensFlare.composition",
    );

    this.bloomMip1 = this.mipUp[1].texture;

    this.prefilterMaterial = makeMaterial(
      "UnityBloom.Prefilter",
      BLOOM_PREFILTER_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        uSourceTexelSize: { value: new THREE.Vector2(1, 1) },
      },
    );
    this.blurHorizontalMaterial = makeMaterial(
      "UnityBloom.BlurHorizontal",
      BLOOM_BLUR_HORIZONTAL_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        uSourceTexelSize: { value: new THREE.Vector2(1, 1) },
      },
    );
    this.blurVerticalMaterial = makeMaterial(
      "UnityBloom.BlurVertical",
      BLOOM_BLUR_VERTICAL_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        uSourceTexelSize: { value: new THREE.Vector2(1, 1) },
      },
    );
    this.upsampleMaterial = makeMaterial(
      "UnityBloom.UpsampleBicubic",
      BLOOM_UPSAMPLE_FRAGMENT,
      {
        tHighMip: { value: null as THREE.Texture | null },
        tLowMip: { value: null as THREE.Texture | null },
        uLowMipSize: { value: new THREE.Vector4(1, 1, 1, 1) },
      },
    );
    this.streakPrefilterMaterial = makeMaterial(
      "UnityLensFlare.StreakPrefilter",
      STREAK_PREFILTER_FRAGMENT,
      {
        tBloomMip: { value: this.bloomMip1 },
        uBloomTexelSize: { value: new THREE.Vector2(1, 1) },
      },
    );
    this.streakDownsampleMaterial = makeMaterial(
      "UnityLensFlare.StreakDownsample",
      STREAK_DOWNSAMPLE_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        uSourceTexelSize: { value: new THREE.Vector2(1, 1) },
        uMipLevel: { value: 0 },
        uStreakLength: { value: 0 },
      },
    );
    this.streakUpsampleMaterial = makeMaterial(
      "UnityLensFlare.StreakUpsample",
      STREAK_UPSAMPLE_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        uSourceTexelSize: { value: new THREE.Vector2(1, 1) },
        uMipLevel: { value: 0 },
        uStreakLength: { value: 0 },
      },
    );
    this.flareCompositionMaterial = makeMaterial(
      "UnityLensFlare.Composition",
      FLARE_COMPOSITION_FRAGMENT,
      {
        tBloomMip: { value: this.bloomMip1 },
        tStreak: { value: this.streakTargets[0].texture },
        uBloomTexelSize: { value: new THREE.Vector2(1, 1) },
        uStreakTexelSize: { value: new THREE.Vector2(1, 1) },
        uWarpedScale: { value: new THREE.Vector2(1, 1) },
      },
    );
    this.flareWriteMaterial = makeMaterial(
      "UnityLensFlare.WriteToBloom",
      FLARE_WRITE_FRAGMENT,
      {
        tFlare: { value: this.flareResult.texture },
      },
    );
    this.flareWriteMaterial.transparent = true;
    this.flareWriteMaterial.blending = THREE.CustomBlending;
    this.flareWriteMaterial.blendEquation = THREE.AddEquation;
    this.flareWriteMaterial.blendSrc = THREE.OneFactor;
    this.flareWriteMaterial.blendDst = THREE.OneFactor;
    this.flareWriteMaterial.blendEquationAlpha = THREE.AddEquation;
    this.flareWriteMaterial.blendSrcAlpha = THREE.OneFactor;
    this.flareWriteMaterial.blendDstAlpha = THREE.OneFactor;

    this.finalCompositeMaterial = makeMaterial(
      "UnityPost.FinalComposite",
      FINAL_COMPOSITE_FRAGMENT,
      {
        tSource: { value: null as THREE.Texture | null },
        tBloom: { value: this.mipUp[0].texture },
        tInternalLut: { value: this.internalLut },
        tBlueNoise: { value: this.blueNoise },
        uBloomSize: { value: new THREE.Vector4(1, 1, 1, 1) },
        uDitherParams: { value: new THREE.Vector4(1, 1, 0, 0) },
        uBloomIntensity: {
          value:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("nobloom")
              ? 0
              : UNITY_POST_PROFILE.bloom.intensity,
        },
        uBloomDebug: {
          value:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("bloomdebug")
              ? 1
              : 0,
        },
        uGradeEnabled: {
          value:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("rawoutput")
              ? 0
              : 1,
        },
        uLutEnabled: {
          value:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("nolut")
              ? 0
              : 1,
        },
        uDitherEnabled: {
          value:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).has("nodither")
              ? 0
              : 1,
        },
      },
    );

    this.materials = [
      this.prefilterMaterial,
      this.blurHorizontalMaterial,
      this.blurVerticalMaterial,
      this.upsampleMaterial,
      this.streakPrefilterMaterial,
      this.streakDownsampleMaterial,
      this.streakUpsampleMaterial,
      this.flareCompositionMaterial,
      this.flareWriteMaterial,
      this.finalCompositeMaterial,
    ];
    this.fsQuad = new FullScreenQuad(this.prefilterMaterial);

    this.setSize(width, height);
  }

  override setSize(width: number, height: number): void {
    const fullWidth = Math.max(1, Math.floor(width));
    const fullHeight = Math.max(1, Math.floor(height));
    this.width = fullWidth;
    this.height = fullHeight;

    let mipWidth = Math.max(1, Math.floor(fullWidth / 2));
    let mipHeight = Math.max(1, Math.floor(fullHeight / 2));
    for (let i = 0; i < BLOOM_MIP_COUNT; i += 1) {
      this.mipDown[i].setSize(mipWidth, mipHeight);
      this.mipUp[i].setSize(mipWidth, mipHeight);
      mipWidth = Math.max(1, Math.floor(mipWidth / 2));
      mipHeight = Math.max(1, Math.floor(mipHeight / 2));
    }

    const streakWidth = Math.max(1, Math.floor(fullWidth / 4));
    const streakHeight = Math.max(1, Math.floor(fullHeight / 4));
    this.streakTargets[0].setSize(streakWidth, streakHeight);
    this.streakTargets[1].setSize(streakWidth, streakHeight);
    this.flareResult.setSize(streakWidth, streakHeight);

    this.streakPassCount = Math.max(
      1,
      Math.floor(Math.log2(Math.max(fullWidth, fullHeight))),
    );

    const bloomMip1Width = this.mipUp[1].width;
    const bloomMip1Height = this.mipUp[1].height;
    (
      this.streakPrefilterMaterial.uniforms.uBloomTexelSize
        .value as THREE.Vector2
    ).set(1 / bloomMip1Width, 1 / bloomMip1Height);
    (
      this.flareCompositionMaterial.uniforms.uBloomTexelSize
        .value as THREE.Vector2
    ).set(1 / bloomMip1Width, 1 / bloomMip1Height);
    (
      this.flareCompositionMaterial.uniforms.uStreakTexelSize
        .value as THREE.Vector2
    ).set(1 / streakWidth, 1 / streakHeight);
    (
      this.flareCompositionMaterial.uniforms.uWarpedScale
        .value as THREE.Vector2
    ).set(fullWidth / fullHeight, 1);
    (
      this.finalCompositeMaterial.uniforms.uBloomSize
        .value as THREE.Vector4
    ).set(
      this.mipUp[0].width,
      this.mipUp[0].height,
      1 / this.mipUp[0].width,
      1 / this.mipUp[0].height,
    );
    (
      this.finalCompositeMaterial.uniforms.uDitherParams
        .value as THREE.Vector4
    ).set(
      fullWidth / UNITY_DITHER_SIZE,
      fullHeight / UNITY_DITHER_SIZE,
      0,
      0,
    );

    // LensFlareCommonSRP: serializedLength * 10 * actualWidth * 0.0005.
    const processedStreakLength =
      UNITY_POST_PROFILE.lensFlare.streaksLength
      * 10
      * fullWidth
      * 0.0005;
    this.streakDownsampleMaterial.uniforms.uStreakLength.value =
      processedStreakLength;
    this.streakUpsampleMaterial.uniforms.uStreakLength.value =
      processedStreakLength;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    maskActive: boolean,
  ): void {
    if (this.disposed) {
      return;
    }

    if (readBuffer.width !== this.width || readBuffer.height !== this.height) {
      this.setSize(readBuffer.width, readBuffer.height);
    }

    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    const stencil = renderer.state.buffers.stencil;
    if (maskActive) {
      stencil.setTest(false);
    }

    try {
      // Bloom prefilter into half-resolution mip 0.
      this.prefilterMaterial.uniforms.tSource.value = readBuffer.texture;
      (
        this.prefilterMaterial.uniforms.uSourceTexelSize
          .value as THREE.Vector2
      ).set(1 / readBuffer.width, 1 / readBuffer.height);
      this.draw(renderer, this.mipDown[0], this.prefilterMaterial);

      // Gaussian downsample chain. mipUp[i] is the horizontal temporary.
      for (let i = 1; i < BLOOM_MIP_COUNT; i += 1) {
        const source = this.mipDown[i - 1];

        this.blurHorizontalMaterial.uniforms.tSource.value = source.texture;
        (
          this.blurHorizontalMaterial.uniforms.uSourceTexelSize
            .value as THREE.Vector2
        ).set(1 / source.width, 1 / source.height);
        this.draw(renderer, this.mipUp[i], this.blurHorizontalMaterial);

        const horizontal = this.mipUp[i];
        this.blurVerticalMaterial.uniforms.tSource.value = horizontal.texture;
        (
          this.blurVerticalMaterial.uniforms.uSourceTexelSize
            .value as THREE.Vector2
        ).set(1 / horizontal.width, 1 / horizontal.height);
        this.draw(renderer, this.mipDown[i], this.blurVerticalMaterial);
      }

      // Reconstruct from mip 5 through mip 0 with Unity's bicubic B-spline.
      for (let i = BLOOM_MIP_COUNT - 2; i >= 0; i -= 1) {
        const highMip = this.mipDown[i];
        const lowMip =
          i === BLOOM_MIP_COUNT - 2
            ? this.mipDown[i + 1]
            : this.mipUp[i + 1];

        this.upsampleMaterial.uniforms.tHighMip.value = highMip.texture;
        this.upsampleMaterial.uniforms.tLowMip.value = lowMip.texture;
        (
          this.upsampleMaterial.uniforms.uLowMipSize
            .value as THREE.Vector4
        ).set(
          lowMip.width,
          lowMip.height,
          1 / lowMip.width,
          1 / lowMip.height,
        );
        this.draw(renderer, this.mipUp[i], this.upsampleMaterial);
      }

      if (this.flareEnabled) {
        // Screen-space streak prefilter and same-size ping-pong pyramid.
        this.draw(
          renderer,
          this.streakTargets[0],
          this.streakPrefilterMaterial,
        );

        const streakTexelSize =
          this.streakDownsampleMaterial.uniforms.uSourceTexelSize
            .value as THREE.Vector2;
        streakTexelSize.set(
          1 / this.streakTargets[0].width,
          1 / this.streakTargets[0].height,
        );

        let even = false;
        for (let i = 0; i < this.streakPassCount; i += 1) {
          even = i % 2 === 0;
          const source = even ? this.streakTargets[0] : this.streakTargets[1];
          const destination =
            even ? this.streakTargets[1] : this.streakTargets[0];
          this.streakDownsampleMaterial.uniforms.tSource.value = source.texture;
          this.streakDownsampleMaterial.uniforms.uMipLevel.value = i;
          this.draw(renderer, destination, this.streakDownsampleMaterial);
        }

        const startIndex = even ? 1 : 0;
        (
          this.streakUpsampleMaterial.uniforms.uSourceTexelSize
            .value as THREE.Vector2
        ).copy(streakTexelSize);
        for (let i = startIndex; i < startIndex + 2; i += 1) {
          even = i % 2 === 0;
          const source = even ? this.streakTargets[0] : this.streakTargets[1];
          const destination =
            even ? this.streakTargets[1] : this.streakTargets[0];
          this.streakUpsampleMaterial.uniforms.tSource.value = source.texture;
          this.streakUpsampleMaterial.uniforms.uMipLevel.value =
            i - startIndex;
          this.draw(renderer, destination, this.streakUpsampleMaterial);
        }

        const finalStreak = even
          ? this.streakTargets[1]
          : this.streakTargets[0];
        this.flareCompositionMaterial.uniforms.tStreak.value =
          finalStreak.texture;
        this.draw(
          renderer,
          this.flareResult,
          this.flareCompositionMaterial,
        );

        // Unity writes the quarter-resolution flare into reconstructed bloom
        // mip 0 using Blend One One, before the 0.3 bloom intensity.
        this.draw(renderer, this.mipUp[0], this.flareWriteMaterial);
      }

      if (maskActive) {
        stencil.setTest(true);
      }

      this.finalCompositeMaterial.uniforms.tSource.value =
        readBuffer.texture;
      this.finalCompositeMaterial.uniforms.tBloom.value = this.prefilterDebug
        ? this.mipDown[0].texture
        : this.mipUp[0].texture;
      const ditherParams = this.finalCompositeMaterial.uniforms.uDitherParams
        .value as THREE.Vector4;
      const frame = this.ditherFrame++;
      ditherParams.z = hash32(frame * 2 + 1) / 0x100000000;
      ditherParams.w = hash32(frame * 2 + 2) / 0x100000000;
      const destination = this.renderToScreen ? null : writeBuffer;
      renderer.setRenderTarget(destination);
      if (this.clear) {
        renderer.clear();
      }
      this.fsQuad.material = this.finalCompositeMaterial;
      this.fsQuad.render(renderer);
    } finally {
      if (maskActive) {
        stencil.setTest(true);
      }
      renderer.autoClear = oldAutoClear;
    }
  }

  override dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    for (const target of this.mipDown) {
      target.dispose();
    }
    for (const target of this.mipUp) {
      target.dispose();
    }
    this.streakTargets[0].dispose();
    this.streakTargets[1].dispose();
    this.flareResult.dispose();
    this.internalLut.dispose();
    this.blueNoise.dispose();

    for (const material of this.materials) {
      material.dispose();
    }
    this.fsQuad.dispose();
  }

  private draw(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    material: THREE.Material,
  ): void {
    this.fsQuad.material = material;
    renderer.setRenderTarget(target);
    this.fsQuad.render(renderer);
  }
}
