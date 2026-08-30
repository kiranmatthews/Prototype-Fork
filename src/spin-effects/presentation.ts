import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  DEFAULT_GROUNDED_SKATE_SPIN_BOUNDS,
  SpinOrbitalRings,
  type SpinRingGeometryStats,
} from "./rings";
import {
  groundedSkateSpinRingSettings,
  SPIN_MODEL_PATH,
  SPIN_MODEL_TEXTURE_PATH,
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
const NEUTRAL_HORIZONTAL_SCALE = 1.15;
const NEUTRAL_VERTICAL_SCALE = 1.5;

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
}

const assetUrl = (path: string): string => {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return `${import.meta.env.BASE_URL}${path.replace(/^\.?\//, "")}`;
};

let modelTemplatePromise: Promise<THREE.Group> | null = null;
let baseTexture: THREE.Texture | null = null;

function getBaseTexture(): THREE.Texture {
  if (baseTexture) return baseTexture;
  baseTexture = new THREE.TextureLoader().load(assetUrl(SPIN_MODEL_TEXTURE_PATH));
  baseTexture.name = "WhirlwindVixen020205_BaseColor_Web";
  baseTexture.colorSpace = THREE.SRGBColorSpace;
  baseTexture.flipY = false;
  baseTexture.wrapS = baseTexture.wrapT = THREE.RepeatWrapping;
  baseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  baseTexture.magFilter = THREE.LinearFilter;
  baseTexture.generateMipmaps = true;
  baseTexture.anisotropy = 8;
  return baseTexture;
}

function getModelTemplate(): Promise<THREE.Group> {
  if (modelTemplatePromise) return modelTemplatePromise;
  modelTemplatePromise = new Promise((resolve, reject) => {
    new GLTFLoader().load(
      assetUrl(SPIN_MODEL_PATH),
      (gltf) => resolve(gltf.scene),
      undefined,
      reject,
    );
  });
  return modelTemplatePromise;
}

/**
 * Presentation-only controller for the current Unity spin sculpture, its
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

  constructor(options: {
    parent: THREE.Object3D;
    settings?: SpinRingSettings;
    groundedSkateSettings?: SpinRingSettings;
    targetBottom?: number;
  }) {
    this.settings = options.settings ?? spinRingSettings;
    this.groundedSkateSettings =
      options.groundedSkateSettings ?? groundedSkateSpinRingSettings;
    this.targetBottom = options.targetBottom ?? 0;
    this.root.name = "FoxSpinSmear_WhirlwindVixen020205_Web";
    this.root.userData.noShadow = true;
    this.sculpture.name = "WhirlwindVixen020205_Model";
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
    );
    void this.loadSculpture();
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
    this.pulse = Math.sin(step * (SOURCE_RADIANS_PER_SECOND / 60) * 2) * 0.09;
    this.sculpture.rotation.y = step * (SOURCE_RADIANS_PER_SECOND / 60);
    this.sculpture.scale.set(
      NEUTRAL_HORIZONTAL_SCALE * (1 + this.pulse),
      NEUTRAL_VERTICAL_SCALE * (1 - this.pulse),
      NEUTRAL_HORIZONTAL_SCALE * (1 + this.pulse),
    );
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
    this.sculpture.scale.set(
      NEUTRAL_HORIZONTAL_SCALE,
      NEUTRAL_VERTICAL_SCALE,
      NEUTRAL_HORIZONTAL_SCALE,
    );
    this.characterRings.visible = false;
    this.groundedSkateRings.visible = false;
    this.characterRings.resetPresentationState();
    this.groundedSkateRings.resetPresentationState();
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
    this.characterRings.dispose();
    this.groundedSkateRings.dispose();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
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
      const template = await getModelTemplate();
      const instance = template.clone(true);
      const texture = getBaseTexture();
      instance.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.material = new THREE.MeshBasicMaterial({
          name: "WhirlwindVixen020205_HeroFlat_Web",
          map: texture,
          color: 0xffffff,
          side: THREE.FrontSide,
        });
        object.castShadow = false;
        object.receiveShadow = false;
        object.userData.noShadow = true;
      });
      const bounds = new THREE.Box3().setFromObject(instance);
      this.sculpture.position.set(
        0,
        this.targetBottom - bounds.min.y * NEUTRAL_VERTICAL_SCALE,
        0,
      );
      this.sculpture.add(instance);
      const neutralCenter = bounds.getCenter(new THREE.Vector3()).multiply(
        new THREE.Vector3(
          NEUTRAL_HORIZONTAL_SCALE,
          NEUTRAL_VERTICAL_SCALE,
          NEUTRAL_HORIZONTAL_SCALE,
        ),
      );
      neutralCenter.add(this.sculpture.position);
      const neutralSize = bounds.getSize(new THREE.Vector3()).multiply(
        new THREE.Vector3(
          NEUTRAL_HORIZONTAL_SCALE,
          NEUTRAL_VERTICAL_SCALE,
          NEUTRAL_HORIZONTAL_SCALE,
        ),
      );
      this.characterRings.setSourceBounds({ center: neutralCenter, size: neutralSize });
      this.assetReady = true;
      this.root.userData.assetReady = true;
    } catch (error) {
      this.assetError = String(error);
      this.root.userData.assetError = this.assetError;
      console.warn("Whirlwind Vixen spin model failed to load", error);
    }
  }
}
