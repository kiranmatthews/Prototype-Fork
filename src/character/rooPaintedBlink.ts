import * as THREE from 'three';
import { RooBlinkClock } from './rooBlinkTiming';
import { paintRooLids, prepareRooLidPaint, ROO_BLINK_PAINT_STEPS, ROO_BLINK_TEXTURE_SIZE } from './rooBlinkPaint';

export const ROO_BLINK_ASSET_PATH = 'characters/roo-texture-blink/';
let paintSamples: Promise<Float32Array> | null = null;

function loadPaintSamples(): Promise<Float32Array> {
  if (!paintSamples) paintSamples = new THREE.ImageLoader().loadAsync(
    `${import.meta.env.BASE_URL}${ROO_BLINK_ASSET_PATH}paint-coordinates.png`,
  ).then((image) => {
    if (image.width !== ROO_BLINK_TEXTURE_SIZE || image.height !== ROO_BLINK_TEXTURE_SIZE)
      throw new Error('Roo blink paint coordinates have unexpected dimensions');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = ROO_BLINK_TEXTURE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('2D canvas unavailable for Roo blink coordinates');
    context.drawImage(image, 0, 0);
    return prepareRooLidPaint(context.getImageData(0, 0, canvas.width, canvas.height).data);
  });
  return paintSamples;
}

/** Each player owns its clock, material and single reusable GPU paint layer. */
export class RooPaintedBlink {
  readonly clock = new RooBlinkClock();
  private texture: THREE.CanvasTexture | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private pixels: ImageData | null = null;
  private samples: Float32Array | null = null;
  private state: 'loading' | 'ready' | 'failed' | 'disposed' = 'loading';
  private error: string | null = null;
  private paintedAmount = 0;
  private updates = 0;
  private paintMs = 0;

  constructor(material: THREE.MeshStandardMaterial) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = ROO_BLINK_TEXTURE_SIZE;
      this.context = canvas.getContext('2d');
      if (!this.context) throw new Error('2D canvas unavailable for Roo blink paint');
      this.pixels = this.context.createImageData(canvas.width, canvas.height);
      this.texture = new THREE.CanvasTexture(canvas);
      this.texture.name = 'roo-blink-paint-256-rgba';
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.generateMipmaps = false;
      this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
      const paint = { value: this.texture };
      const previousCompile = material.onBeforeCompile;
      const previousKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        previousCompile.call(material, shader, renderer);
        shader.uniforms.rooBlinkPaint = paint;
        shader.fragmentShader = 'uniform sampler2D rooBlinkPaint;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          vec4 rooLid = texture2D(rooBlinkPaint, vMapUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, rooLid.rgb, rooLid.a);`);
      };
      material.customProgramCacheKey = () => `${previousKey}|roo-painted-blink-v1`;
      material.needsUpdate = true;
      void loadPaintSamples().then((samples) => {
        if (this.state === 'disposed') return;
        this.samples = samples;
        this.state = 'ready';
        this.clock.reset();
      }, (error: unknown) => this.fail(error));
    } catch (error) { this.fail(error); }
  }

  private fail(error: unknown): void {
    if (this.state === 'disposed') return;
    this.state = 'failed';
    this.error = error instanceof Error ? error.message : String(error);
    // Keep the unpainted head visible when an optional paint asset cannot load.
  }

  update(dt: number, active: boolean): void {
    if (this.state !== 'ready') return;
    const value = this.clock.step(dt, active);
    const amount = Math.round(value * ROO_BLINK_PAINT_STEPS) / ROO_BLINK_PAINT_STEPS;
    if (amount === this.paintedAmount) return;
    const start = performance.now();
    paintRooLids(amount, this.pixels!.data, this.samples!);
    this.context!.putImageData(this.pixels!, 0, 0);
    this.texture!.needsUpdate = true;
    this.paintedAmount = amount;
    this.updates++;
    this.paintMs = performance.now() - start;
  }

  dispose(): void {
    this.state = 'disposed';
    this.texture?.dispose();
    this.context = this.pixels = this.samples = null;
  }

  get diagnostics() {
    return { state: this.state, error: this.error, ...this.clock.diagnostics,
      paintedAmount: this.paintedAmount, textureUpdates: this.updates,
      lastPaintMs: this.paintMs, overlayBytes: ROO_BLINK_TEXTURE_SIZE ** 2 * 4 };
  }
}
