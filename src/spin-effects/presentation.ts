import * as THREE from "three";
import { bakeSpinSmear, cloneSpinModel, DEFAULT_SPIN_SMEAR, disposeSpinModel, spinModelStats } from './smear';
import { loadSpinSmearModel, subscribeSpinSmear } from './smearStore';
import {
  DEFAULT_GROUNDED_SKATE_SPIN_BOUNDS,
  SpinOrbitalRings,
  type SpinRingGeometryStats,
} from "./rings";
import {
  groundedSkateSpinRingSettings,
  SPIN_RING_LINGER_TICKS,
  SpinRingSettings,
  spinRingSettings,
  type SpinRingSettingsValue,
} from "./settings";
import {
  advanceSpinPresentationRoute,
  createSpinPresentationRouteState,
  type SpinPresentationRoute,
  type SpinPresentationRouteState,
} from "./routing";

export type { SpinPresentationRoute } from "./routing";

const SOURCE_RADIANS_PER_SECOND = 30 * 2.399;

export interface SpinPresentationSample {
  readonly step: number;
  readonly active: boolean;
  readonly boardAttached: boolean;
  readonly groundedSkate: boolean;
  readonly bodyVisible: boolean;
  readonly reset?: boolean;
}

export interface SpinPresentationDiagnostics {
  readonly assetReady: boolean;
  readonly assetError: string | null;
  readonly route: SpinPresentationRoute;
  readonly sculptureVisible: boolean;
  readonly characterRingsVisible: boolean;
  readonly groundedSkateRingsVisible: boolean;
  readonly boardRingsVisible: boolean;
  readonly lingerTicks: number;
  readonly sourceStep: number;
  readonly pulse: number;
  readonly characterRingStats: SpinRingGeometryStats;
  readonly groundedSkateRingStats: SpinRingGeometryStats;
  readonly modelSource: 'current-character' | 'baked' | null;
  readonly modelVertices: number;
}

/**
 * Presentation-only controller for the baked current-character sculpture, its
 * independent character rings, and a separate ground-only skate-ring route.
 */
export class SpinEffectsPresentation {
  readonly root = new THREE.Group();
  readonly sculpture = new THREE.Group();
  readonly characterRings: SpinOrbitalRings;
  readonly groundedSkateRings: SpinOrbitalRings;
  private readonly settings: SpinRingSettings;
  private readonly groundedSkateSettings: SpinRingSettings;
  private readonly targetBottom: number;
  private readonly unsubscribes: (() => void)[] = [];
  private assetReady = false;
  private assetError: string | null = null;
  private routeState: SpinPresentationRouteState = createSpinPresentationRouteState();
  private pulse = 0;
  private readonly createSource?: () => THREE.Group;
  private readonly prepareSource?: () => Promise<void>;
  private modelSource: SpinPresentationDiagnostics['modelSource'] = null;
  private modelVertices = 0;
  private disposed = false;
  private loading: Promise<void> | null = null;
  private reloadRequested = false;

  constructor(options: {
    parent: THREE.Object3D;
    settings?: SpinRingSettings;
    groundedSkateSettings?: SpinRingSettings;
    targetBottom?: number;
    createSource?: () => THREE.Group;
    prepareSource?: () => Promise<void>;
  }) {
    this.settings = options.settings ?? spinRingSettings;
    this.groundedSkateSettings =
      options.groundedSkateSettings ?? groundedSkateSpinRingSettings;
    this.targetBottom = options.targetBottom ?? 0;
    this.createSource = options.createSource;
    this.prepareSource = options.prepareSource;
    this.root.name = "CurrentCharacter_RadialSpinSmear";
    this.root.userData.noShadow = true;
    this.sculpture.name = "BakedCharacter_StaticSpinModel";
    this.sculpture.visible = false;
    this.root.add(this.sculpture);
    this.characterRings = new SpinOrbitalRings(this.settings.value);
    this.characterRings.visible = false;
    this.root.add(this.characterRings);
    this.groundedSkateRings = new SpinOrbitalRings(
      this.groundedSkateSettings.value,
      DEFAULT_GROUNDED_SKATE_SPIN_BOUNDS,
    );
    this.groundedSkateRings.name =
      "GroundedSkateSpinOrbitalRings_Additive_Web";
    this.groundedSkateRings.visible = false;
    this.root.add(this.groundedSkateRings);
    options.parent.add(this.root);

    this.unsubscribes.push(
      this.settings.subscribe((value) => this.applySettings(value)),
      this.groundedSkateSettings.subscribe((value) =>
        this.applyGroundedSkateSettings(value),
      ),
      subscribeSpinSmear(() => {
        this.reloadRequested = true;
        void this.prepare();
      }),
    );
    // A microtask lets the owning Player finish constructing its rig first.
    void Promise.resolve().then(() => this.prepare());
  }

  prepare(): Promise<void> {
    if (this.disposed || this.assetReady && !this.reloadRequested) return Promise.resolve();
    return this.loading ??= (async () => {
      do {
        this.reloadRequested = false;
        await this.loadSculpture();
      } while (this.reloadRequested && !this.disposed);
    })().finally(() => { this.loading = null; });
  }

  get sculptureVisible(): boolean {
    return this.sculpture.visible;
  }

  get presentationRoute(): SpinPresentationRoute {
    return this.routeState.route;
  }

  get diagnostics(): SpinPresentationDiagnostics {
    const lingerTicks =
      this.routeState.lingerStartStep >= 0 &&
      this.routeState.lastStep >= this.routeState.lingerStartStep
        ? this.routeState.lastStep - this.routeState.lingerStartStep
        : -1;
    return {
      assetReady: this.assetReady,
      assetError: this.assetError,
      route: this.routeState.route,
      sculptureVisible: this.sculpture.visible,
      characterRingsVisible: this.characterRings.visible,
      groundedSkateRingsVisible: this.groundedSkateRings.visible,
      boardRingsVisible: this.groundedSkateRings.visible,
      lingerTicks,
      sourceStep: this.routeState.lastStep,
      pulse: this.pulse,
      characterRingStats: this.characterRings.geometryStats,
      groundedSkateRingStats: this.groundedSkateRings.geometryStats,
      modelSource: this.modelSource,
      modelVertices: this.modelVertices,
    };
  }

  update(sample: SpinPresentationSample): void {
    const step = Math.floor(sample.step);
    const frame = advanceSpinPresentationRoute(
      this.routeState,
      {
        step,
        active: sample.active,
        boardAttached: sample.boardAttached,
        groundedSkate: sample.groundedSkate,
        reset: sample.reset,
      },
      SPIN_RING_LINGER_TICKS,
    );
    this.routeState = frame.state;
    this.sculpture.rotation.y = step * (SOURCE_RADIANS_PER_SECOND / 60);
    this.sculpture.visible =
      frame.characterActive && sample.bodyVisible && this.assetReady;

    const characterRingsVisible =
      sample.bodyVisible &&
      (frame.characterActive || frame.characterLingering);
    this.characterRings.visible = characterRingsVisible;
    if (characterRingsVisible)
      this.characterRings.applyStep(step, !frame.characterActive);
    else this.characterRings.resetPresentationState();

    const groundedSkateRingsVisible =
      sample.bodyVisible && frame.groundedSkateActive;
    this.groundedSkateRings.visible = groundedSkateRingsVisible;
    if (groundedSkateRingsVisible)
      this.groundedSkateRings.applyStep(step, false);
    else this.groundedSkateRings.resetPresentationState();
  }

  reset(): void {
    this.routeState = createSpinPresentationRouteState();
    this.pulse = 0;
    this.sculpture.visible = false;
    this.sculpture.rotation.set(0, 0, 0);
    this.sculpture.scale.setScalar(1);
    this.characterRings.visible = false;
    this.groundedSkateRings.visible = false;
    this.characterRings.resetPresentationState();
    this.groundedSkateRings.resetPresentationState();
  }

  dispose(): void {
    this.disposed = true;
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
    this.characterRings.dispose();
    this.groundedSkateRings.dispose();
    disposeSpinModel(this.sculpture);
    this.root.removeFromParent();
  }

  private applySettings(value: Readonly<SpinRingSettingsValue>): void {
    this.characterRings.applySettings(value);
  }

  private applyGroundedSkateSettings(
    value: Readonly<SpinRingSettingsValue>,
  ): void {
    this.groundedSkateRings.applySettings(value);
  }

  private async loadSculpture(): Promise<void> {
    try {
      const template = await loadSpinSmearModel();
      await this.prepareSource?.();
      if (this.disposed) return;
      let instance: THREE.Group;
      if (template) instance = cloneSpinModel(template);
      else if (this.createSource) {
        const source = this.createSource();
        try { instance = bakeSpinSmear(source, DEFAULT_SPIN_SMEAR); }
        finally { disposeSpinModel(source); }
      } else return;
      instance.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false;
        object.receiveShadow = false;
        object.userData.noShadow = true;
      });
      const bounds = new THREE.Box3().setFromObject(instance);
      for (const child of [...this.sculpture.children]) disposeSpinModel(child);
      this.sculpture.position.set(0, this.targetBottom - bounds.min.y, 0);
      this.sculpture.add(instance);
      const neutralCenter = bounds.getCenter(new THREE.Vector3());
      neutralCenter.add(this.sculpture.position);
      const neutralSize = bounds.getSize(new THREE.Vector3());
      this.characterRings.setSourceBounds({ center: neutralCenter, size: neutralSize });
      this.assetReady = true;
      this.assetError = null;
      this.modelSource = template ? 'baked' : 'current-character';
      this.modelVertices = spinModelStats(instance).vertices;
      this.root.userData.assetReady = true;
    } catch (error) {
      this.assetError = String(error);
      this.root.userData.assetError = this.assetError;
      console.warn("Current character spin model failed to bake", error);
    }
  }
}
