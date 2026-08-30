import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  SpinOrbitalRings,
  type SpinRingBounds,
  type SpinRingGeometryStats,
} from "./rings";
import {
  SPIN_MODEL_PATH,
  SPIN_MODEL_TEXTURE_PATH,
  SPIN_RING_LINGER_TICKS,
  SpinRingSettings,
  spinRingSettings,
  type SpinRingSettingsValue,
} from "./settings";

const SOURCE_RADIANS_PER_SECOND = 30 * 2.399;
const NEUTRAL_HORIZONTAL_SCALE = 1.15;
const NEUTRAL_VERTICAL_SCALE = 1.5;
const BOARD_RING_VERTICAL_SCALE = 0.18;

export type SpinPresentationRoute = "none" | "character" | "board";

export interface SpinPresentationSample {
  readonly step: number;
  readonly active: boolean;
  readonly boardRouteCandidate: boolean;
  readonly bodyVisible: boolean;
  readonly boardVisible: boolean;
  readonly reset?: boolean;
}

export interface SpinPresentationDiagnostics {
  readonly assetReady: boolean;
  readonly assetError: string | null;
  readonly route: SpinPresentationRoute;
  readonly sculptureVisible: boolean;
  readonly characterRingsVisible: boolean;
  readonly boardRingsVisible: boolean;
  readonly lingerTicks: number;
  readonly sourceStep: number;
  readonly pulse: number;
  readonly characterRingStats: SpinRingGeometryStats;
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

function localBoundsForBoard(board: THREE.Group): SpinRingBounds {
  const source = board.userData.settings as
    | {
        deckHalfWidth?: number;
        deckTailLength?: number;
        deckNoseLength?: number;
        boardToGroundDistance?: number;
        tailKickRise?: number;
        noseKickRise?: number;
        concaveDepth?: number;
        wheelTrackHalfWidth?: number;
        wheelWidth?: number;
      }
    | undefined;
  const halfWidth = Number(source?.deckHalfWidth ?? 0.23761481046676637);
  const wheelHalf =
    Number(source?.wheelTrackHalfWidth ?? 0.20993120968341828) +
    Number(source?.wheelWidth ?? 0.08432068675756455) * 0.5;
  const width = Math.max(halfWidth, wheelHalf) * 2;
  const length =
    Number(source?.deckTailLength ?? 0.991284191608429) +
    Number(source?.deckNoseLength ?? 0.991284191608429);
  const maximumY =
    Number(source?.boardToGroundDistance ?? 0.19172483682632447) +
    Math.max(
      Number(source?.tailKickRise ?? 0.035407111048698428),
      Number(source?.noseKickRise ?? 0.021646762266755105),
    ) +
    Number(source?.concaveDepth ?? 0.020002305507659913);
  return {
    center: new THREE.Vector3(0, maximumY * 0.5, 0),
    size: new THREE.Vector3(width, maximumY, length),
  };
}

/**
 * Presentation-only controller for the current Unity spin sculpture, its
 * independent character rings, and the intended board-routed ring treatment.
 */
export class SpinEffectsPresentation {
  readonly root = new THREE.Group();
  readonly sculpture = new THREE.Group();
  readonly characterRings: SpinOrbitalRings;
  readonly boardRingAnchor = new THREE.Group();
  readonly boardRings: SpinOrbitalRings;
  private readonly settings: SpinRingSettings;
  private readonly board: THREE.Group;
  private readonly targetBottom: number;
  private unsubscribe: (() => void) | null = null;
  private assetReady = false;
  private assetError: string | null = null;
  private route: SpinPresentationRoute = "none";
  private previousActive = false;
  private lingerStartStep = -1;
  private lastStep = -1;
  private lastBoardBuildToken = -1;
  private pulse = 0;

  constructor(options: {
    parent: THREE.Object3D;
    board: THREE.Group;
    settings?: SpinRingSettings;
    targetBottom?: number;
  }) {
    this.settings = options.settings ?? spinRingSettings;
    this.board = options.board;
    this.targetBottom = options.targetBottom ?? 0;
    this.root.name = "FoxSpinSmear_WhirlwindVixen020205_Web";
    this.root.userData.noShadow = true;
    this.sculpture.name = "WhirlwindVixen020205_Model";
    this.sculpture.visible = false;
    this.root.add(this.sculpture);
    this.characterRings = new SpinOrbitalRings(this.settings.value);
    this.characterRings.visible = false;
    this.root.add(this.characterRings);
    options.parent.add(this.root);

    this.boardRingAnchor.name = "BoardTrickRingAnchor_Web";
    this.boardRingAnchor.scale.set(1, BOARD_RING_VERTICAL_SCALE, 1);
    this.boardRings = new SpinOrbitalRings(
      this.settings.value,
      localBoundsForBoard(this.board),
    );
    this.boardRings.name = "BoardTrickOrbitalRings_Additive_Web";
    this.boardRings.visible = false;
    this.boardRingAnchor.add(this.boardRings);
    this.ensureBoardAttachment();

    this.unsubscribe = this.settings.subscribe((value) => this.applySettings(value));
    void this.loadSculpture();
  }

  get sculptureVisible(): boolean {
    return this.sculpture.visible;
  }

  get presentationRoute(): SpinPresentationRoute {
    return this.route;
  }

  get diagnostics(): SpinPresentationDiagnostics {
    const lingerTicks =
      this.lingerStartStep >= 0 && this.lastStep >= this.lingerStartStep
        ? this.lastStep - this.lingerStartStep
        : -1;
    return {
      assetReady: this.assetReady,
      assetError: this.assetError,
      route: this.route,
      sculptureVisible: this.sculpture.visible,
      characterRingsVisible: this.characterRings.visible,
      boardRingsVisible: this.boardRings.visible,
      lingerTicks,
      sourceStep: this.lastStep,
      pulse: this.pulse,
      characterRingStats: this.characterRings.geometryStats,
    };
  }

  update(sample: SpinPresentationSample): void {
    const step = Math.floor(sample.step);
    if (sample.reset || (this.lastStep >= 0 && step < this.lastStep)) {
      this.reset();
    }
    this.ensureBoardAttachment();
    const newStep = step !== this.lastStep;
    if (sample.active && (!this.previousActive || this.route === "none")) {
      this.route = sample.boardRouteCandidate ? "board" : "character";
      this.lingerStartStep = -1;
    } else if (newStep && !sample.active && this.previousActive) {
      this.lingerStartStep = step;
    }
    if (sample.active) this.lingerStartStep = -1;
    const lingerTicks =
      this.lingerStartStep >= 0 ? step - this.lingerStartStep : Number.MAX_SAFE_INTEGER;
    const lingering = lingerTicks >= 0 && lingerTicks < SPIN_RING_LINGER_TICKS;
    if (!sample.active && !lingering && this.lingerStartStep >= 0)
      this.lingerStartStep = -1;

    const characterActive = sample.active && this.route === "character";
    const boardActive = sample.active && this.route === "board";
    this.pulse = Math.sin(step * (SOURCE_RADIANS_PER_SECOND / 60) * 2) * 0.09;
    this.sculpture.rotation.y = step * (SOURCE_RADIANS_PER_SECOND / 60);
    this.sculpture.scale.set(
      NEUTRAL_HORIZONTAL_SCALE * (1 + this.pulse),
      NEUTRAL_VERTICAL_SCALE * (1 - this.pulse),
      NEUTRAL_HORIZONTAL_SCALE * (1 + this.pulse),
    );
    this.sculpture.visible =
      characterActive && sample.bodyVisible && this.assetReady;

    const characterRingsVisible =
      this.route === "character" &&
      sample.bodyVisible &&
      (characterActive || lingering);
    this.characterRings.visible = characterRingsVisible;
    if (characterRingsVisible)
      this.characterRings.applyStep(step, !characterActive);
    else this.characterRings.resetPresentationState();

    const boardRingsVisible =
      this.route === "board" && sample.boardVisible && (boardActive || lingering);
    this.boardRings.visible = boardRingsVisible;
    if (boardRingsVisible)
      this.boardRings.applyStep(step, false);
    else this.boardRings.resetPresentationState();

    if (newStep) this.previousActive = sample.active;
    this.lastStep = step;
  }

  reset(): void {
    this.route = "none";
    this.previousActive = false;
    this.lingerStartStep = -1;
    this.lastStep = -1;
    this.pulse = 0;
    this.sculpture.visible = false;
    this.sculpture.rotation.set(0, 0, 0);
    this.sculpture.scale.set(
      NEUTRAL_HORIZONTAL_SCALE,
      NEUTRAL_VERTICAL_SCALE,
      NEUTRAL_HORIZONTAL_SCALE,
    );
    this.characterRings.visible = false;
    this.boardRings.visible = false;
    this.characterRings.resetPresentationState();
    this.boardRings.resetPresentationState();
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.characterRings.dispose();
    this.boardRings.dispose();
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    this.root.removeFromParent();
    this.boardRingAnchor.removeFromParent();
  }

  private applySettings(value: Readonly<SpinRingSettingsValue>): void {
    this.characterRings.applySettings(value);
    this.boardRings.applySettings(value);
  }

  private ensureBoardAttachment(): void {
    if (this.boardRingAnchor.parent !== this.board) this.board.add(this.boardRingAnchor);
    const token = Number(this.board.userData.buildToken ?? 0);
    if (token === this.lastBoardBuildToken) return;
    this.lastBoardBuildToken = token;
    this.boardRings.setSourceBounds(localBoundsForBoard(this.board));
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
