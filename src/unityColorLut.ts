import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import type { VisualGradingValue } from "./visual-treatment/settings";

export const UNITY_COLOR_LUT_SIZE = 32;
export const UNITY_COLOR_LUT_WIDTH = UNITY_COLOR_LUT_SIZE * UNITY_COLOR_LUT_SIZE;

function gammaToLinear(value: number): number {
  return value <= 0.04045
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const LUT_FRAGMENT = /* glsl */ `
  precision highp float;
  uniform vec3 uColorBalance;
  uniform vec3 uColorFilter;
  uniform vec3 uHueSatCon;
  uniform vec3 uLift;
  uniform vec3 uGamma;
  uniform vec3 uGain;
  uniform vec4 uSplitShadows;
  uniform vec3 uSplitHighlights;
  uniform vec3 uMixerRed;
  uniform vec3 uMixerGreen;
  uniform vec3 uMixerBlue;
  varying vec2 vUv;

  float luminance(vec3 color) {
    return dot(color, vec3(0.2126729, 0.7151522, 0.0721750));
  }

  vec3 linearToLms(vec3 color) {
    return vec3(
      dot(vec3(0.390405, 0.549941, 0.00892632), color),
      dot(vec3(0.0708416, 0.963172, 0.00135775), color),
      dot(vec3(0.0231082, 0.128021, 0.936245), color)
    );
  }

  vec3 lmsToLinear(vec3 color) {
    return vec3(
      dot(vec3(2.85847, -1.62879, -0.0248910), color),
      dot(vec3(-0.210182, 1.15820, 0.000324281), color),
      dot(vec3(-0.0418120, -0.118169, 1.06867), color)
    );
  }

  vec3 linearToLogC(vec3 color) {
    return 0.244161 * log(max(5.555556 * color + 0.047996, vec3(1e-6)))
      / log(10.0) + 0.386036;
  }

  vec3 logCToLinear(vec3 color) {
    return (pow(vec3(10.0), (color - 0.386036) / 0.244161) - 0.047996)
      / 5.555556;
  }

  vec3 softLight(vec3 base, vec3 blend) {
    vec3 r1 = 2.0 * base * blend + base * base * (1.0 - 2.0 * blend);
    vec3 r2 = sqrt(max(base, 0.0)) * (2.0 * blend - 1.0)
      + 2.0 * base * (1.0 - blend);
    return mix(r1, r2, step(0.5, blend));
  }

  vec3 rgbToHsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }

  vec3 hsvToRgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
    return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
  }

  void main() {
    float pixelX = floor(vUv.x * 1024.0);
    float green = floor(vUv.y * 32.0);
    float blue = floor(pixelX / 32.0);
    float red = mod(pixelX, 32.0);
    vec3 color = vec3(red, green, blue) / 31.0;

    vec3 lms = linearToLms(color) * uColorBalance;
    color = lmsToLinear(lms);

    vec3 logColor = linearToLogC(color);
    logColor = (logColor - 0.4135884) * uHueSatCon.z + 0.4135884;
    color = logCToLinear(logColor) * uColorFilter;
    color = max(color, 0.0);

    vec3 gammaColor = pow(color, vec3(1.0 / 2.2));
    float luma = clamp(luminance(clamp(gammaColor, 0.0, 1.0)) + uSplitShadows.w, 0.0, 1.0);
    gammaColor = softLight(gammaColor, mix(vec3(0.5), uSplitShadows.rgb, 1.0 - luma));
    gammaColor = softLight(gammaColor, mix(vec3(0.5), uSplitHighlights, luma));
    color = pow(max(gammaColor, 0.0), vec3(2.2));

    color = vec3(
      dot(color, uMixerRed),
      dot(color, uMixerGreen),
      dot(color, uMixerBlue)
    );

    color = color * uGain + uLift;
    color = sign(color) * pow(abs(color), uGamma);

    vec3 hsv = rgbToHsv(max(color, 0.0));
    hsv.x = fract(hsv.x + uHueSatCon.x);
    color = hsvToRgb(hsv);
    luma = luminance(color);
    color = vec3(luma) + uHueSatCon.y * (color - vec3(luma));
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function standardIlluminantY(x: number): number {
  return 2.87 * x - 3 * x * x - 0.27509507;
}

function cieXyToLms(x: number, y: number): THREE.Vector3 {
  const X = x / y;
  const Z = (1 - x - y) / y;
  return new THREE.Vector3(
    0.7328 * X + 0.4296 - 0.1624 * Z,
    -0.7036 * X + 1.6975 + 0.0061 * Z,
    0.0030 * X + 0.0136 + 0.9834 * Z,
  );
}

/** Exact Unity ColorUtils.ColorBalanceToLMSCoeffs port. */
export function colorBalanceToLmsCoeffs(
  temperature: number,
  tint: number,
): THREE.Vector3 {
  const t1 = temperature / 65;
  const t2 = tint / 65;
  const x = 0.31271 - t1 * (t1 < 0 ? 0.1 : 0.05);
  const y = standardIlluminantY(x) + t2 * 0.05;
  const target = cieXyToLms(x, y);
  return new THREE.Vector3(
    0.949237 / target.x,
    1.03542 / target.y,
    1.08728 / target.z,
  );
}

export interface UnityColorLutDiagnostics {
  dirty: boolean;
  rebuildCount: number;
  width: number;
  height: number;
}

/** GPU-built 32³ LDR grading LUT. Rebuilds only after a LOOK setting changes. */
export class UnityColorLut {
  readonly target = new THREE.WebGLRenderTarget(
    UNITY_COLOR_LUT_WIDTH,
    UNITY_COLOR_LUT_SIZE,
    {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      internalFormat: "RGBA8",
      colorSpace: THREE.NoColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
      samples: 0,
    },
  );
  private readonly material = new THREE.ShaderMaterial({
    name: "UnityColorLut.Ldr32Builder",
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader: LUT_FRAGMENT,
    uniforms: {
      uColorBalance: { value: new THREE.Vector3(1, 1, 1) },
      uColorFilter: { value: new THREE.Vector3(1, 1, 1) },
      uHueSatCon: { value: new THREE.Vector3(0, 1, 1) },
      uLift: { value: new THREE.Vector3(0, 0, 0) },
      uGamma: { value: new THREE.Vector3(1, 1, 1) },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSplitShadows: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0) },
      uSplitHighlights: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      uMixerRed: { value: new THREE.Vector3(1, 0, 0) },
      uMixerGreen: { value: new THREE.Vector3(0, 1, 0) },
      uMixerBlue: { value: new THREE.Vector3(0, 0, 1) },
    },
    blending: THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private readonly fsQuad = new FullScreenQuad(this.material);
  private settings: Readonly<VisualGradingValue> | null = null;
  private signature = "";
  private dirty = true;
  private rebuildCount = 0;
  private disposed = false;
  private readonly viewport = new THREE.Vector4();
  private readonly scissor = new THREE.Vector4();

  constructor() {
    this.target.texture.name = "UnityColorLut.Ldr32.RGBA8";
  }

  get texture(): THREE.Texture {
    return this.target.texture;
  }

  get diagnostics(): UnityColorLutDiagnostics {
    return {
      dirty: this.dirty,
      rebuildCount: this.rebuildCount,
      width: this.target.width,
      height: this.target.height,
    };
  }

  setSettings(settings: Readonly<VisualGradingValue>): void {
    const signature = JSON.stringify(settings);
    if (signature === this.signature) return;
    this.settings = settings;
    this.signature = signature;
    this.dirty = true;
  }

  update(renderer: THREE.WebGLRenderer): void {
    if (!this.dirty || !this.settings || this.disposed) return;
    const value = this.settings;
    const uniforms = this.material.uniforms;
    (uniforms.uColorBalance.value as THREE.Vector3).copy(
      colorBalanceToLmsCoeffs(value.temperature, value.tint),
    );
    // URP uploads ColorAdjustments.colorFilter.value.linear. Settings retain
    // the source/picker sRGB values so their serialized Unity numbers remain
    // recognizable and HTML color inputs behave predictably.
    (uniforms.uColorFilter.value as THREE.Vector3).set(
      gammaToLinear(value.colorFilter[0]),
      gammaToLinear(value.colorFilter[1]),
      gammaToLinear(value.colorFilter[2]),
    );
    (uniforms.uHueSatCon.value as THREE.Vector3).set(
      value.hueShiftDeg / 360,
      1 + value.saturationPct / 100,
      1 + value.contrastPct / 100,
    );
    (uniforms.uLift.value as THREE.Vector3).fromArray(value.lift);
    (uniforms.uGamma.value as THREE.Vector3).fromArray(value.gamma);
    (uniforms.uGain.value as THREE.Vector3).fromArray(value.gain);
    (uniforms.uSplitShadows.value as THREE.Vector4).set(
      value.splitShadows[0],
      value.splitShadows[1],
      value.splitShadows[2],
      value.splitBalancePct / 100,
    );
    (uniforms.uSplitHighlights.value as THREE.Vector3).fromArray(value.splitHighlights);
    (uniforms.uMixerRed.value as THREE.Vector3).fromArray(value.channelMixer[0]).multiplyScalar(0.01);
    (uniforms.uMixerGreen.value as THREE.Vector3).fromArray(value.channelMixer[1]).multiplyScalar(0.01);
    (uniforms.uMixerBlue.value as THREE.Vector3).fromArray(value.channelMixer[2]).multiplyScalar(0.01);

    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace();
    const previousMip = renderer.getActiveMipmapLevel();
    const previousViewport = renderer.getViewport(this.viewport);
    const previousScissor = renderer.getScissor(this.scissor);
    const previousScissorTest = renderer.getScissorTest();
    const previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.setScissorTest(false);
      renderer.setRenderTarget(this.target);
      renderer.clear();
      this.fsQuad.render(renderer);
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousMip);
      renderer.setViewport(previousViewport);
      renderer.setScissor(previousScissor);
      renderer.setScissorTest(previousScissorTest);
      renderer.autoClear = previousAutoClear;
    }
    this.dirty = false;
    this.rebuildCount += 1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}
