// Shared title/loading/game-over background. This deliberately reuses the
// preserved pre-band Gouraud sine-field effect rather than the newer warp-room
// portal renderer, and draws through the game's existing WebGL context.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  FIELD_SWIRL_PRESETS,
  FieldSwirl,
  type FieldSwirlPreset,
} from "./swirlfield";

const TARGET_FRAME_MS = 1000 / 30;
const VIEW_HALF_HEIGHT = 4;
const VORTEX_RADIUS = FIELD_SWIRL_PRESETS.vortex.radius ?? 4.37;

export interface GameFlowVortexDiagnostics {
  active: boolean;
  renderedFrames: number;
  targetFps: number;
  reducedMotion: boolean;
  maskVisible: boolean;
  maskPartsLoaded: number;
}

export class GameFlowVortex {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 30);
  private maskScene = new THREE.Scene();
  private maskCamera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private mask = new THREE.Group();
  private vortex: FieldSwirl;
  private size = new THREE.Vector2();
  private savedViewport = new THREE.Vector4();
  private savedScissor = new THREE.Vector4();
  private active = false;
  private invalidated = true;
  private accumulatedSeconds = 0;
  private lastRenderMs = -Infinity;
  private renderedFrames = 0;
  private renderedThisActivation = false;
  private maskStartedAt = performance.now();
  private maskVisible = false;
  private maskLoadStarted = false;
  private maskPartsLoaded = 0;
  private disposed = false;
  private boneMaterial = new THREE.MeshStandardMaterial({
    color: 0xe8d0a3,
    roughness: 0.48,
    metalness: 0,
    emissive: 0x24180b,
    emissiveIntensity: 0.22,
  });
  private skullMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b2116,
    roughness: 0.7,
    metalness: 0.08,
    emissive: 0x240804,
    emissiveIntensity: 0.72,
  });
  private reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  constructor() {
    this.scene.background = new THREE.Color(0x02030a);
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    const preset: FieldSwirlPreset = {
      ...FIELD_SWIRL_PRESETS.vortex,
      billboard: false,
    };
    this.vortex = new FieldSwirl(preset, { seed: 37 });
    this.vortex.group.position.z = 0;
    this.scene.add(this.vortex.group);
    this.maskCamera.position.set(0, 0.08, 9);
    this.maskScene.add(new THREE.HemisphereLight(0xffd9a0, 0x301008, 2.1));
    const fire = new THREE.PointLight(0xff7a18, 18, 20);
    fire.position.set(0, 1.5, 3.5);
    this.maskScene.add(fire);
    const rim = new THREE.DirectionalLight(0x7edbff, 2.2);
    rim.position.set(-4, 3, -2);
    this.maskScene.add(rim, this.mask);
  }

  get diagnostics(): GameFlowVortexDiagnostics {
    return {
      active: this.active,
      renderedFrames: this.renderedFrames,
      targetFps: 30,
      reducedMotion: this.reducedMotion,
      maskVisible: this.maskVisible,
      maskPartsLoaded: this.maskPartsLoaded,
    };
  }

  invalidate(): void {
    this.invalidated = true;
  }

  deactivate(): void {
    if (!this.active) return;
    this.active = false;
    this.renderedThisActivation = false;
    this.accumulatedSeconds = 0;
    this.lastRenderMs = -Infinity;
  }

  render(
    renderer: THREE.WebGLRenderer,
    deltaSeconds: number,
    nowMs: number,
    showMask = false,
  ): boolean {
    if (!this.active) {
      this.active = true;
      this.invalidated = true;
      this.renderedThisActivation = false;
      this.accumulatedSeconds = 0;
      this.lastRenderMs = -Infinity;
    }
    if (showMask !== this.maskVisible) {
      this.maskVisible = showMask;
      this.mask.visible = showMask;
      this.invalidated = true;
    }
    if (showMask) this.ensureMaskLoaded();
    this.accumulatedSeconds += Math.max(0, deltaSeconds);
    if (
      !this.invalidated &&
      ((this.reducedMotion && this.renderedThisActivation) ||
        nowMs - this.lastRenderMs < TARGET_FRAME_MS)
    )
      return false;

    renderer.getSize(this.size);
    const width = Math.max(1, this.size.x);
    const height = Math.max(1, this.size.y);
    const aspect = width / height;
    this.camera.left = -VIEW_HALF_HEIGHT * aspect;
    this.camera.right = VIEW_HALF_HEIGHT * aspect;
    this.camera.top = VIEW_HALF_HEIGHT;
    this.camera.bottom = -VIEW_HALF_HEIGHT;
    this.camera.updateProjectionMatrix();
    this.maskCamera.aspect = aspect;
    this.maskCamera.updateProjectionMatrix();
    // Cover the widest screen dimension so the vortex reads as a background,
    // not as a portal disc floating behind the menu card.
    const coverScale = Math.max(
      1.22,
      (VIEW_HALF_HEIGHT * aspect * 1.16) / VORTEX_RADIUS,
    );
    this.vortex.group.scale.setScalar(coverScale);
    this.vortex.update(
      this.reducedMotion
        ? 0
        : Math.min(0.1, Math.max(1 / 60, this.accumulatedSeconds)),
      this.camera,
    );
    if (showMask && !this.reducedMotion) {
      const seconds = (nowMs - this.maskStartedAt) / 1000;
      this.mask.rotation.y = Math.sin(seconds * 0.72) * 0.22;
      this.mask.rotation.z = Math.sin(seconds * 0.53) * 0.025;
      this.mask.position.y = Math.sin(seconds * 1.4) * 0.07;
    }
    this.accumulatedSeconds = 0;

    const savedTarget = renderer.getRenderTarget();
    const savedScissorTest = renderer.getScissorTest();
    const savedAutoClear = renderer.autoClear;
    renderer.getViewport(this.savedViewport);
    renderer.getScissor(this.savedScissor);
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.autoClear = true;
    renderer.render(this.scene, this.camera);
    if (showMask) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(this.maskScene, this.maskCamera);
    }
    renderer.setRenderTarget(savedTarget);
    renderer.setViewport(this.savedViewport);
    renderer.setScissor(this.savedScissor);
    renderer.setScissorTest(savedScissorTest);
    renderer.autoClear = savedAutoClear;

    this.lastRenderMs = nowMs;
    this.invalidated = false;
    this.renderedThisActivation = true;
    this.renderedFrames++;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.vortex.group);
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
    document.body.classList.remove("game-flow-mask-ready");
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
        this.maskPartsLoaded++;
        this.invalidated = true;
        if (this.maskPartsLoaded >= 2)
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
