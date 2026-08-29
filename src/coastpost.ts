// UNITY BEACHFRONT POST STACK -----------------------------------------------
//
// Exact active order from Unity 6000.5.7f1 / URP:
//   RenderPass -> SMAA High -> UnityPostPass -> OutputPass
//
// UnityPostPass owns the literal half-resolution six-mip HQ Gaussian bloom,
// reconstructed-mip1 screen-space flare, quarter-resolution streak ping-pong,
// flare-before-bloom composition, neutral LDR Uber grading and dithering.
// OutputPass alone performs the renderer's final sRGB transfer.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UNITY_POST_PROFILE, UnityPostPass } from "./unityPost";
import { UnitySmaaPass } from "./unitySmaa";

export const BEACHFRONT_POST_PROFILE = UNITY_POST_PROFILE;

export interface CoastPostOptions {
  enabled?: boolean;
  lite?: boolean;
  pixelRatio?: number;
  /** Retained for caller compatibility; Unity's target uses MSAA 1. */
  multisample?: boolean;
}

export type CoastPostRenderPath = "post" | "direct";

export class CoastPostRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly smaaPass: UnitySmaaPass;
  private readonly unityPostPass: UnityPostPass;
  private readonly outputPass: OutputPass;
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
    this.outputPass = new OutputPass();

    this.composer.addPass(this.renderPass);
    if (!new URLSearchParams(window.location.search).has("nosmaa")) {
      this.composer.addPass(this.smaaPass);
    }
    this.composer.addPass(this.unityPostPass);
    this.composer.addPass(this.outputPass);
  }

  get enabled(): boolean {
    return this.enabledState;
  }

  get lite(): boolean {
    return this.liteState;
  }

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

  /** CSS-pixel dimensions; EffectComposer multiplies these by DPR. */
  setSize(width: number, height: number): void {
    const nextWidth = CoastPostRenderer.validDimension(width);
    const nextHeight = CoastPostRenderer.validDimension(height);
    if (nextWidth === this.width && nextHeight === this.height) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.composer.setSize(nextWidth, nextHeight);
  }

  setPixelRatio(pixelRatio: number): void {
    const next = CoastPostRenderer.validPixelRatio(pixelRatio);
    if (next === this.pixelRatio) return;
    this.pixelRatio = next;
    this.composer.setPixelRatio(next);
  }

  render(deltaSeconds = 0): CoastPostRenderPath {
    if (this.disposed) {
      throw new Error("CoastPostRenderer.render() called after dispose()");
    }
    // EffectComposer owns a complete full-frame target. Preserve caller-owned
    // split-screen viewports by using the direct path while scissoring.
    if (!this.active || this.renderer.getScissorTest()) {
      this.renderer.render(this.scene, this.camera);
      return "direct";
    }
    this.composer.render(deltaSeconds);
    return "post";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.smaaPass.dispose();
    this.unityPostPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }

  private static validDimension(value: number): number {
    return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
  }

  private static validPixelRatio(value: number): number {
    return Number.isFinite(value) ? Math.max(0.1, value) : 1;
  }
}
