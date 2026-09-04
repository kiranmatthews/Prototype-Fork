// Shared title/loading/game-over background. The host deliberately owns no
// THREE resources while gameplay is active: one short-lived presentation
// stage is created on demand, draws through the game's existing WebGL context,
// and is completely released at the flow -> gameplay handoff.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  FIELD_SWIRL_PRESETS,
  FieldSwirl,
  type FieldSwirlPreset,
} from "./swirlfield";

const VIEW_HALF_HEIGHT = 4;
const VORTEX_RADIUS = FIELD_SWIRL_PRESETS.vortex.radius ?? 4.37;

export interface GameFlowVortexDiagnostics {
  active: boolean;
  resident: boolean;
  renderedFrames: number;
  targetFps: number;
  cadenceOwner: "gameplay-render-loop";
  reducedMotion: boolean;
  maskVisible: boolean;
  maskPartsLoaded: number;
  targetWidth: number;
  targetHeight: number;
  /** One direct scene submission containing both Gouraud meshes. */
  scenePasses: number;
  /** Retained in diagnostics to prove that no upscale pass is active. */
  compositePasses: number;
  maskPasses: number;
  createCount: number;
  disposeCount: number;
}

interface StageFrameResult {
  targetWidth: number;
  targetHeight: number;
  maskRendered: boolean;
}

/**
 * Lifecycle and cadence owner used by main.ts.
 *
 * `render` shares the gameplay loop's admitted 60 Hz frames without its own
 * limiter. `deactivate` is the hard ownership boundary: it disposes and nulls
 * the whole THREE stage so gameplay retains no menu scene resources.
 */
export class GameFlowVortexHost {
  private stage: GameFlowVortexStage | null = null;
  private renderedFrames = 0;
  private scenePasses = 0;
  private compositePasses = 0;
  private maskPasses = 0;
  private createCount = 0;
  private disposeCount = 0;
  private targetWidth = 0;
  private targetHeight = 0;
  private maskVisible = false;
  private maskPartsLoaded = 0;
  private permanentlyDisposed = false;
  private readonly reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  get resident(): boolean {
    return this.stage !== null;
  }

  get diagnostics(): GameFlowVortexDiagnostics {
    return {
      active: this.stage !== null,
      resident: this.stage !== null,
      renderedFrames: this.renderedFrames,
      targetFps: 60,
      cadenceOwner: "gameplay-render-loop",
      reducedMotion: this.reducedMotion,
      maskVisible: this.maskVisible,
      maskPartsLoaded: this.maskPartsLoaded,
      targetWidth: this.targetWidth,
      targetHeight: this.targetHeight,
      scenePasses: this.scenePasses,
      compositePasses: this.compositePasses,
      maskPasses: this.maskPasses,
      createCount: this.createCount,
      disposeCount: this.disposeCount,
    };
  }

  /** A resize matters only if an active stage already owns its cameras. */
  invalidate(): void {
    this.stage?.invalidate();
  }

  /**
   * Drop every presentation resource at the gameplay handoff. Repeated calls
   * during ordinary gameplay are an allocation-free no-op.
   */
  deactivate(): void {
    const stage = this.stage;
    if (!stage) return;
    stage.dispose();
    this.stage = null;
    this.disposeCount++;
    this.targetWidth = 0;
    this.targetHeight = 0;
    this.maskVisible = false;
    this.maskPartsLoaded = 0;
  }

  render(
    renderer: THREE.WebGLRenderer,
    deltaSeconds: number,
    nowMs: number,
    showMask = false,
  ): boolean {
    if (this.permanentlyDisposed) return false;
    const stage = this.ensureStage();
    stage.prepare(showMask);
    this.maskVisible = showMask;
    this.maskPartsLoaded = stage.maskPartsLoaded;

    const invalidated = stage.invalidated;
    if (this.reducedMotion && stage.renderedOnce && !invalidated) {
      return false;
    }

    const result = stage.render(
      renderer,
      this.reducedMotion ? 0 : Math.min(0.1, Math.max(0, deltaSeconds)),
      nowMs,
      showMask,
    );
    this.targetWidth = result.targetWidth;
    this.targetHeight = result.targetHeight;
    this.maskPartsLoaded = stage.maskPartsLoaded;
    this.renderedFrames++;
    this.scenePasses++;
    if (result.maskRendered) this.maskPasses++;
    return true;
  }

  /** Permanently retire a host (HMR/tests/page-owned teardown). */
  dispose(): void {
    if (this.permanentlyDisposed) return;
    this.deactivate();
    this.permanentlyDisposed = true;
  }

  private ensureStage(): GameFlowVortexStage {
    if (!this.stage) {
      this.stage = new GameFlowVortexStage();
      this.createCount++;
    }
    return this.stage;
  }
}

/** Backwards-compatible value export while main.ts moves to the explicit host. */
export { GameFlowVortexHost as GameFlowVortex };

/** All THREE/WebGL-facing presentation resources live below this boundary. */
class GameFlowVortexStage {
  private vortexScene = new THREE.Scene();
  private vortexCamera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 30);
  private maskScene = new THREE.Scene();
  private maskCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private mask = new THREE.Group();
  private vortex: FieldSwirl;
  private drawingBufferSize = new THREE.Vector2();
  private canvasSize = new THREE.Vector2();
  private savedViewport = new THREE.Vector4();
  private savedScissor = new THREE.Vector4();
  private maskStartedAt = performance.now();
  private maskVisible = false;
  private maskLoadStarted = false;
  private loadedMaskParts = 0;
  private needsRender = true;
  private hasRendered = false;
  private disposed = false;

  private readonly boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d0a3,
    roughness: 0.48,
    metalness: 0,
    emissive: 0x24180b,
    emissiveIntensity: 0.22,
  });

  private readonly skullMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b2116,
    roughness: 0.7,
    metalness: 0.08,
    emissive: 0x240804,
    emissiveIntensity: 0.72,
  });

  constructor() {
    this.vortexScene.background = new THREE.Color(0x02030a);
    this.vortexCamera.position.set(0, 0, 10);
    this.vortexCamera.lookAt(0, 0, 0);
    const preset: FieldSwirlPreset = {
      ...FIELD_SWIRL_PRESETS.vortex,
      billboard: false,
    };
    this.vortex = new FieldSwirl(preset, { seed: 37 });
    this.vortex.group.position.z = 0;
    this.vortexScene.add(this.vortex.group);

    this.maskCamera.position.set(0, 0.08, 9);
    this.maskScene.add(new THREE.HemisphereLight(0xffd9a0, 0x301008, 2.1));
    const fire = new THREE.PointLight(0xff7a18, 18, 20);
    fire.position.set(0, 1.5, 3.5);
    const rim = new THREE.DirectionalLight(0x7edbff, 2.2);
    rim.position.set(-4, 3, -2);
    this.maskScene.add(fire, rim, this.mask);
  }

  get invalidated(): boolean {
    return this.needsRender;
  }

  get renderedOnce(): boolean {
    return this.hasRendered;
  }

  get maskPartsLoaded(): number {
    return this.loadedMaskParts;
  }

  invalidate(): void {
    this.needsRender = true;
  }

  prepare(showMask: boolean): void {
    if (showMask !== this.maskVisible) {
      this.maskVisible = showMask;
      this.mask.visible = showMask;
      this.needsRender = true;
      if (showMask) this.maskStartedAt = performance.now();
    }
    if (showMask) this.ensureMaskLoaded();
  }

  render(
    renderer: THREE.WebGLRenderer,
    deltaSeconds: number,
    nowMs: number,
    showMask: boolean,
  ): StageFrameResult {
    const { targetWidth, targetHeight } = this.syncSize(renderer);
    this.vortex.update(deltaSeconds, this.vortexCamera);
    if (showMask) {
      const seconds = (nowMs - this.maskStartedAt) / 1000;
      this.mask.rotation.y = Math.sin(seconds * 0.72) * 0.22;
      this.mask.rotation.z = Math.sin(seconds * 0.53) * 0.025;
      this.mask.position.y = Math.sin(seconds * 1.4) * 0.07;
    }

    const savedTarget = renderer.getRenderTarget();
    const savedFace = renderer.getActiveCubeFace();
    const savedMip = renderer.getActiveMipmapLevel();
    const savedScissorTest = renderer.getScissorTest();
    const savedAutoClear = renderer.autoClear;
    renderer.getViewport(this.savedViewport);
    renderer.getScissor(this.savedScissor);
    try {
      // Direct-to-canvas rendering preserves the exact drawing-buffer quality
      // selected by the gameplay renderer; there is no low-res intermediate.
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, this.canvasSize.x, this.canvasSize.y);
      renderer.autoClear = true;
      renderer.render(this.vortexScene, this.vortexCamera);
      if (showMask) {
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(this.maskScene, this.maskCamera);
      }
    } finally {
      renderer.setRenderTarget(savedTarget, savedFace, savedMip);
      renderer.setViewport(this.savedViewport);
      renderer.setScissor(this.savedScissor);
      renderer.setScissorTest(savedScissorTest);
      renderer.autoClear = savedAutoClear;
    }

    this.needsRender = false;
    this.hasRendered = true;
    return { targetWidth, targetHeight, maskRendered: showMask };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.vortexScene.remove(this.vortex.group);
    this.vortex.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    this.mask.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && !geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
    });
    this.boneMaterial.dispose();
    this.skullMaterial.dispose();
    this.mask.clear();
    this.maskScene.clear();
    this.vortexScene.clear();
    document.body.classList.remove("game-flow-mask-ready");
  }

  private syncSize(renderer: THREE.WebGLRenderer): {
    targetWidth: number;
    targetHeight: number;
  } {
    renderer.getDrawingBufferSize(this.drawingBufferSize);
    renderer.getSize(this.canvasSize);
    const targetWidth = Math.max(1, this.drawingBufferSize.x);
    const targetHeight = Math.max(1, this.drawingBufferSize.y);
    const aspect = targetWidth / targetHeight;
    this.vortexCamera.left = -VIEW_HALF_HEIGHT * aspect;
    this.vortexCamera.right = VIEW_HALF_HEIGHT * aspect;
    this.vortexCamera.top = VIEW_HALF_HEIGHT;
    this.vortexCamera.bottom = -VIEW_HALF_HEIGHT;
    this.vortexCamera.updateProjectionMatrix();
    this.maskCamera.aspect = aspect;
    this.maskCamera.updateProjectionMatrix();
    const coverScale = Math.max(
      1.22,
      (VIEW_HALF_HEIGHT * aspect * 1.16) / VORTEX_RADIUS,
    );
    this.vortex.group.scale.setScalar(coverScale);
    return { targetWidth, targetHeight };
  }

  private ensureMaskLoaded(): void {
    if (this.maskLoadStarted || this.disposed) return;
    this.maskLoadStarted = true;
    this.loadMaskPart("models/crossbones.glb", false);
    this.loadMaskPart("models/skull.glb", true);
  }

  private loadMaskPart(path: string, skull: boolean): void {
    new GLTFLoader().load(
      import.meta.env.BASE_URL + path,
      (gltf) => {
        const model = gltf.scene;
        if (this.disposed) {
          this.disposeLoadedModel(model);
          return;
        }
        const bounds = new THREE.Box3().setFromObject(model);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const span = Math.max(size.x, size.y, size.z) || 1;
        const fit = (skull ? 3.25 : 3.8) / span;
        model.scale.setScalar(fit);
        model.position.set(
          -center.x * fit,
          (skull ? 0.38 : -1.05) - center.y * fit,
          (skull ? 0.18 : -0.08) - center.z * fit,
        );
        const oldMaterials = new Set<THREE.Material>();
        const oldTextures = new Set<THREE.Texture>();
        model.traverse((object) => {
          const mesh = object as THREE.Mesh;
          if (!mesh.isMesh) return;
          const originals = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const material of originals) {
            if (!material || oldMaterials.has(material)) continue;
            oldMaterials.add(material);
            for (const value of Object.values(material)) {
              const texture = value as THREE.Texture | null;
              if (texture?.isTexture && !oldTextures.has(texture)) {
                oldTextures.add(texture);
                texture.dispose();
              }
            }
            material.dispose();
          }
          mesh.material = skull ? this.skullMaterial : this.boneMaterial;
        });
        this.mask.add(model);
        this.loadedMaskParts++;
        this.needsRender = true;
        if (this.loadedMaskParts >= 2)
          document.body.classList.add("game-flow-mask-ready");
      },
      undefined,
      () => {
        // The DOM PNG remains visible when either model cannot be decoded.
      },
    );
  }

  private disposeLoadedModel(model: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry && !geometries.has(mesh.geometry)) {
        geometries.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const source = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const material of source) {
        if (materials.has(material)) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          const texture = value as THREE.Texture | null;
          if (texture?.isTexture && !textures.has(texture)) {
            textures.add(texture);
            texture.dispose();
          }
        }
        material.dispose();
      }
    });
  }
}
