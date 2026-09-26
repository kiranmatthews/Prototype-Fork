import * as THREE from 'three';
import type { CrtGuestDeferredDeconvergence } from './pass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OutputShader } from 'three/examples/jsm/shaders/OutputShader.js';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { CRT_GUEST_CONVERSION_SHADERS, CRT_GUEST_FULLSCREEN_VERTEX_SHADER } from './generated/shaders';

const conversion = CRT_GUEST_CONVERSION_SHADERS.guestSrgbToLinear;
const decoderStart = conversion.indexOf('vec3 crtGuestSrgbToLinear(');
const decoderEnd = conversion.indexOf('\nvoid main()', decoderStart);
if (decoderStart < 0 || decoderEnd < 0)
  throw new Error('CRT Guest output decoder is unavailable');
const decoder = conversion.slice(decoderStart, decoderEnd);
const sourceSample = 'gl_FragColor = texture2D( tDiffuse, vUv );';
if (!OutputShader.fragmentShader.includes(sourceSample))
  throw new Error('Three OutputShader source sampling contract changed');

/** The normal OutputPass, optionally reading CRT's sRGB result directly.
 * Decode in full shader precision before the unchanged Three tone mapping
 * and display transfer. Removing the intermediate RGBA16F write avoids its
 * extra quantization; final display differences are bounded by the GPU review. */
export class CrtGuestOutputPass extends OutputPass {
  private readonly guestUniform = { value: 0 };
  // OutputPass only reads .texture from its input. This borrowed view owns no
  // render target or GPU storage and never mutates a composer buffer.
  private readonly guestInput: { texture: THREE.Texture | null } = { texture: null };
  private readonly viewport = new THREE.Vector4();
  private fallbackTarget: THREE.WebGLRenderTarget | null = null;
  private fallbackMaterial: THREE.RawShaderMaterial | null = null;
  private fallbackQuad: FullScreenQuad | null = null;
  private deconvergenceTarget: THREE.WebGLRenderTarget | null = null;
  private deconvergenceQuad: FullScreenQuad | null = null;
  private readonly finalStages = new Map<THREE.RawShaderMaterial, OutputPass>();

  constructor(
    private readonly getGuestSource: () => THREE.Texture | null,
    private readonly getDeconvergence: () => CrtGuestDeferredDeconvergence | null = () => null,
  ) {
    super();
    (this.uniforms as Record<string, THREE.IUniform>).uCrtGuestInput = this.guestUniform;
    this.material.name = 'CRT Guest decode and OutputPass';
    this.material.fragmentShader = `precision highp float;
      uniform float uCrtGuestInput;
      ${decoder}
      ${OutputShader.fragmentShader.replace(sourceSample, `${sourceSample}
        if (uCrtGuestInput > 0.5) {
          gl_FragColor.rgb = crtGuestSrgbToLinear(clamp(gl_FragColor.rgb, 0.0, 1.0));
        }
      `)}
    `;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaSeconds: number,
    maskActive: boolean,
  ): void {
    const stage = this.getDeconvergence();
    let source = this.getGuestSource();
    if (stage) {
      const viewport = this.renderToScreen ? renderer.getViewport(this.viewport) : writeBuffer.viewport;
      const ratio = this.renderToScreen ? renderer.getPixelRatio() : 1;
      if (Math.floor(viewport.z * ratio) === stage.width && Math.floor(viewport.w * ratio) === stage.height) {
        this.releaseFallbackTarget();
        this.releaseDeconvergenceTarget();
        let finalStage = this.finalStages.get(stage.material);
        if (!finalStage) {
          finalStage = makeFinalStage(stage.material);
          this.finalStages.set(stage.material, finalStage);
        }
        finalStage.renderToScreen = this.renderToScreen;
        finalStage.clear = this.clear;
        finalStage.render(renderer, writeBuffer, readBuffer, deltaSeconds, maskActive);
        return;
      }
      // Extra resizing requires the canonical deconvergence write before
      // decode and filtering. Allocate only while that uncommon path is used.
      source = this.renderDeconvergence(renderer, stage);
    } else {
      this.releaseDeconvergenceTarget();
    }
    this.guestUniform.value = source ? 1 : 0;
    this.guestInput.texture = source;
    if (source) {
      const viewport = this.renderToScreen ? renderer.getViewport(this.viewport) : writeBuffer.viewport;
      const ratio = this.renderToScreen ? renderer.getPixelRatio() : 1;
      const width = Math.floor(viewport.z * ratio), height = Math.floor(viewport.w * ratio);
      if (width !== source.image.width || height !== source.image.height) {
        // Decode/quantize must precede filtering. For a nonstandard caller
        // that resizes the final output again, retain the reference ordering.
        this.guestInput.texture = this.decodeForResize(renderer, source);
        this.guestUniform.value = 0;
      } else {
        this.releaseFallbackTarget();
      }
    } else {
      this.releaseFallbackTarget();
    }
    try {
      super.render(renderer, writeBuffer,
        source ? this.guestInput as THREE.WebGLRenderTarget : readBuffer,
        deltaSeconds, maskActive);
    } finally {
      this.guestInput.texture = null;
    }
  }

  private renderDeconvergence(renderer: THREE.WebGLRenderer, stage: CrtGuestDeferredDeconvergence): THREE.Texture {
    this.deconvergenceTarget ??= new THREE.WebGLRenderTarget(stage.width, stage.height, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    this.deconvergenceTarget.texture.name = 'CRTGuest.Deconvergence.ResizeFallback.RGBA16F';
    this.deconvergenceTarget.setSize(stage.width, stage.height);
    this.deconvergenceQuad ??= new FullScreenQuad(stage.material);
    this.deconvergenceQuad.material = stage.material;
    const autoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.setRenderTarget(this.deconvergenceTarget);
      this.deconvergenceQuad.render(renderer);
    } finally {
      renderer.autoClear = autoClear;
    }
    return this.deconvergenceTarget.texture;
  }

  private releaseDeconvergenceTarget(): void {
    this.deconvergenceTarget?.dispose();
    this.deconvergenceTarget = null;
  }

  private decodeForResize(renderer: THREE.WebGLRenderer, source: THREE.Texture): THREE.Texture {
    this.fallbackMaterial ??= new THREE.RawShaderMaterial({
      name: 'CRT Guest decode before extra output scaling',
      glslVersion: THREE.GLSL3,
      vertexShader: CRT_GUEST_FULLSCREEN_VERTEX_SHADER,
      fragmentShader: conversion,
      uniforms: { Source: { value: null } },
      depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    });
    this.fallbackQuad ??= new FullScreenQuad(this.fallbackMaterial);
    this.fallbackTarget ??= new THREE.WebGLRenderTarget(source.image.width, source.image.height, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false,
    });
    this.fallbackTarget.setSize(source.image.width, source.image.height);
    this.fallbackMaterial.uniforms.Source.value = source;
    renderer.setRenderTarget(this.fallbackTarget);
    this.fallbackQuad.render(renderer);
    return this.fallbackTarget.texture;
  }

  private releaseFallbackTarget(): void {
    this.fallbackTarget?.dispose();
    this.fallbackTarget = null;
    if (this.fallbackMaterial) this.fallbackMaterial.uniforms.Source.value = null;
  }

  override dispose(): void {
    this.releaseFallbackTarget();
    this.releaseDeconvergenceTarget();
    this.deconvergenceQuad?.dispose();
    for (const stage of this.finalStages.values()) stage.dispose();
    this.finalStages.clear();
    this.fallbackMaterial?.dispose();
    this.fallbackQuad?.dispose();
    super.dispose();
  }
}

/** Retain the generated Guest shader verbatim apart from its entry point,
 * then append Three's own tone mapping/display sequence. Uniform objects are
 * borrowed so settings and temporal/frame bindings have one authoritative owner. */
function makeFinalStage(source: THREE.RawShaderMaterial): OutputPass {
  const output = new OutputPass();
  const sourceMain = /void\s+main\s*\(\s*\)/;
  if (!sourceMain.test(source.fragmentShader)) throw new Error('CRT deconvergence entry point is unavailable');
  const sampleEnd = OutputShader.fragmentShader.indexOf(sourceSample) + sourceSample.length;
  const tailEnd = OutputShader.fragmentShader.lastIndexOf('}');
  const display = OutputShader.fragmentShader.slice(sampleEnd, tailEnd).replace(/gl_FragColor/g, 'FragColor');
  output.uniforms = { ...source.uniforms, ...output.uniforms };
  output.material.name = 'CRT Guest deconvergence, decode and OutputPass';
  output.material.glslVersion = THREE.GLSL3;
  output.material.vertexShader = CRT_GUEST_FULLSCREEN_VERTEX_SHADER;
  output.material.fragmentShader = `
    precision highp float;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    ${decoder}
    ${source.fragmentShader.replace(sourceMain, 'void crtGuestDeconvergence()')}
    void main() {
      crtGuestDeconvergence();
      FragColor.rgb = crtGuestSrgbToLinear(clamp(FragColor.rgb, 0.0, 1.0));
      ${display}
    }
  `;
  output.material.uniforms = output.uniforms as Record<string, THREE.IUniform>;
  output.material.depthTest = false;
  output.material.depthWrite = false;
  output.material.blending = THREE.NoBlending;
  output.material.toneMapped = false;
  return output;
}
