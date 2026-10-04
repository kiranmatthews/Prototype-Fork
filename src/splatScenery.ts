import * as THREE from 'three';

/** Fixed local assets keep editor imports bounded and independent of API keys. */
export interface SplatSceneryData {
  asset: 'valley';
  p: [number, number, number];
  scale: number;
  yaw?: number;
}

export function validSplatScenery(value: unknown): value is SplatSceneryData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).every(key => ['asset', 'p', 'scale', 'yaw'].includes(key)) &&
    data.asset === 'valley' && Array.isArray(data.p) && data.p.length === 3 &&
    data.p.every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 100_000) &&
    typeof data.scale === 'number' && Number.isFinite(data.scale) && data.scale >= .01 && data.scale <= 100 &&
    (data.yaw === undefined || typeof data.yaw === 'number' && Number.isFinite(data.yaw) && Math.abs(data.yaw) <= 3600);
}

type SplatViewer = import('@mkkellogg/gaussian-splats-3d').DropInViewer;

/** Scenery owns its worker/GPU allocations and never joins the collision lists. */
export class SplatScenery {
  readonly root = new THREE.Group();
  private viewer: SplatViewer | null = null;
  private disposed = false;
  private readonly preparation: Promise<void>;
  private status: 'loading' | 'ready' | 'fallback' | 'disposed' = 'loading';
  private error: string | null = null;
  private splats = 0;
  readonly variant: '150k' | '250k';

  constructor(parent: THREE.Object3D, readonly data: SplatSceneryData) {
    this.root.name = 'Image Blaster · Gaussian splat scenery';
    parent.add(this.root);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const search = typeof window === 'undefined' ? '' : window.location.search;
    this.variant = coarse || new URLSearchParams(search).has('lite') ? '150k' : '250k';
    this.preparation = this.load().catch(error => {
      if (this.disposed) return;
      this.error = String(error);
      this.status = 'fallback';
      this.releaseViewer();
      // The ordinary authored sky/geometry remains a playable fallback.
      console.warn('Splat scenery unavailable; using the level backdrop.', error);
    });
  }

  private async load(): Promise<void> {
    // Source/editor physics tooling builds the same levels without a browser.
    if (typeof Worker === 'undefined') { this.status = 'fallback'; return; }
    const { DropInViewer, SceneRevealMode } = await import('@mkkellogg/gaussian-splats-3d');
    if (this.disposed) return;
    const viewer = new DropInViewer({
      sharedMemoryForWorkers: false, gpuAcceleratedSort: false, integerBasedSort: false,
      sphericalHarmonicsDegree: 0, halfPrecisionCovariancesOnGPU: false,
      sceneRevealMode: SceneRevealMode.Instant, dynamicScene: false,
    });
    this.viewer = viewer;
    // Use the active render target / split viewport, including the game's CRT
    // target, rather than CSS canvas size. Sorting and Gaussian projection
    // must use the same camera and framebuffer as the ordinary meshes.
    const viewport = new THREE.Vector4();
    viewer.viewer.getRenderDimensions = out => {
      const renderer = viewer.viewer.renderer;
      if (!renderer) { out.set(1, 1); return; }
      renderer.getCurrentViewport(viewport);
      const ratio = viewer.viewer.devicePixelRatio;
      out.set(viewport.z / ratio, viewport.w / ratio);
    };
    viewer.callbackMesh.renderOrder = -1000;
    viewer.callbackMesh.raycast = () => {};
    viewer.splatMesh.raycast = () => {};
    this.root.add(viewer);
    // World Labs uses Y-down. Flip about X before applying authored Y-up yaw.
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(this.data.yaw ?? 0))
      .multiply(new THREE.Quaternion(1, 0, 0, 0));
    await viewer.addSplatScene(`${import.meta.env.BASE_URL}splat-scenery/valley-${this.variant}.spz`, {
      showLoadingUI: false, progressiveLoad: false, splatAlphaRemovalThreshold: 8,
      position: this.data.p, rotation: rotation.toArray(), scale: [this.data.scale, this.data.scale, this.data.scale],
    });
    if (this.disposed) return;
    viewer.splatMesh.raycast = () => {};
    viewer.splatMesh.castShadow = false;
    viewer.splatMesh.receiveShadow = false;
    this.splats = viewer.splatMesh.getSplatCount();
    this.status = 'ready';
  }

  ready(): Promise<void> { return this.preparation; }
  get diagnostics() { return { status: this.status, asset: this.data.asset, variant: this.variant, splats: this.splats, error: this.error }; }

  private releaseViewer(): void {
    const viewer = this.viewer;
    this.viewer = null;
    if (!viewer) return;
    viewer.removeFromParent();
    // DropInViewer's callback sphere is separate from the viewer resources.
    viewer.callbackMesh.geometry.dispose();
    const material = viewer.callbackMesh.material;
    for (const m of Array.isArray(material) ? material : [material]) m.dispose();
    void viewer.dispose().catch(() => {});
  }

  dispose(): void {
    this.disposed = true;
    this.status = 'disposed';
    this.root.removeFromParent();
    this.releaseViewer();
  }
}
