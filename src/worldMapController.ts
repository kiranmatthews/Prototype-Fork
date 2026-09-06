import * as THREE from "three";
import {
  CAMPAIGN_ISLANDS,
  campaignLevelByKey,
  type CampaignIslandId,
  type CampaignStore,
} from "./campaign";
import type { Input } from "./input";
import type { Level } from "./level";
import type { Player } from "./player";
import { sfx } from "./audio";
import { puffs } from "./puffs";

const UP = new THREE.Vector3(0, 1, 0);
const MAP_PLAYER_SCALE = 3;

export type WorldMapSection = "progress" | "options" | "save-load" | "quit";

export interface WorldMapDirections {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface WorldMapControllerCallbacks {
  onSelection: (
    progressKey: string,
    moving: boolean,
    directions: WorldMapDirections,
  ) => void;
  onEnterLevel: (levelId: string) => void;
  onOpenSection: (section: WorldMapSection) => void;
}

interface ActiveTravel {
  from: string;
  to: string;
  elapsed: number;
  duration: number;
  style: "trail" | "boardslide";
  boardEngaged: boolean;
  sparkClock: number;
}

export class WorldMapController {
  private level: Level | null = null;
  private selectedKeyValue = "";
  private travel: ActiveTravel | null = null;
  private directionLatched = false;
  private cameraReady = false;
  private readonly cameraEye = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly desiredEye = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();

  constructor(
    private readonly campaign: CampaignStore,
    private readonly player: Player,
    private readonly callbacks: WorldMapControllerCallbacks,
  ) {}

  get active(): boolean {
    return this.level !== null;
  }

  get selectedKey(): string {
    return this.selectedKeyValue;
  }

  get moving(): boolean {
    return this.travel !== null;
  }

  activate(level: Level, preferredKey: string | null): void {
    this.player.setWorldMapPresentationScale(MAP_PLAYER_SCALE);
    const fallback = this.campaign.recommendedMapLevelKey();
    const selected =
      preferredKey && level.campaignMapHas(preferredKey) && this.campaign.levelUnlocked(preferredKey)
        ? preferredKey
        : level.campaignMapHas(fallback)
          ? fallback
          : "jungle";
    this.level = level;
    this.selectedKeyValue = selected;
    this.travel = null;
    this.directionLatched = false;
    this.cameraReady = false;
    this.campaign.setMapFocus(selected);
    const pose = level.campaignMapPose(selected);
    if (pose) {
      this.player.stepWorldMapPresentation(pose.position, pose.heading, 1 / 60, "idle");
      this.player.snapRenderInterpolation();
    }
    this.syncVisuals();
    this.callbacks.onSelection(selected, false, this.availableDirections());
  }

  deactivate(): void {
    if (this.level) {
      this.player.setWorldMapPresentationScale(null);
      this.player.snapRenderInterpolation();
    }
    this.level = null;
    this.travel = null;
    this.directionLatched = false;
    this.cameraReady = false;
  }

  refresh(): void {
    if (!this.level) return;
    this.syncVisuals();
    this.callbacks.onSelection(
      this.selectedKeyValue,
      this.moving,
      this.moving ? this.noDirections() : this.availableDirections(),
    );
  }

  revealUnlocks(progressKeys: readonly string[]): void {
    this.level?.revealCampaignMapNodes(progressKeys);
  }

  navigate(screenX: number, screenY: number): boolean {
    const level = this.level;
    if (!level || this.travel) return false;
    const next = level.campaignMapNeighbor(
      this.selectedKeyValue,
      screenX,
      screenY,
      (key) => this.campaign.levelUnlocked(key),
    );
    if (!next || next === this.selectedKeyValue) {
      sfx.play("enemyDown", 0.22, 1.25);
      return false;
    }
    const initial = level.campaignMapTravel(this.selectedKeyValue, next, 0);
    if (!initial) return false;
    this.travel = {
      from: this.selectedKeyValue,
      to: next,
      elapsed: 0,
      duration: initial.duration,
      style: initial.style,
      boardEngaged: false,
      sparkClock: 0,
    };
    this.syncVisuals();
    this.callbacks.onSelection(next, true, this.noDirections());
    sfx.play(
      initial.style === "boardslide" ? "skateTransition" : "footstep1",
      initial.style === "boardslide" ? 0.5 : 0.32,
      1.08,
    );
    return true;
  }

  enterSelected(): boolean {
    if (!this.level || this.travel) return false;
    const definition = campaignLevelByKey(this.selectedKeyValue);
    if (!definition || !this.campaign.levelUnlocked(definition.progressKey)) {
      sfx.play("enemyDown", 0.28, 0.9);
      return false;
    }
    this.callbacks.onEnterLevel(definition.levelId);
    return true;
  }

  openSection(section: WorldMapSection): void {
    if (!this.level || this.travel) return;
    this.callbacks.onOpenSection(section);
  }

  step(dt: number, input: Input): void {
    const level = this.level;
    if (!level) return;
    if (this.travel) {
      this.travel.elapsed += dt;
      const raw = THREE.MathUtils.clamp(
        this.travel.elapsed / Math.max(this.travel.duration, 0.001),
        0,
        1,
      );
      const eased = raw * raw * (3 - 2 * raw);
      const sample = level.campaignMapTravel(
        this.travel.from,
        this.travel.to,
        eased,
      );
      if (sample) {
        let presentation: "walk" | "boardslide" = "walk";
        if (sample.style === "boardslide") {
          const mountEnd = 0.12;
          const landStart = 0.88;
          if (raw >= mountEnd && raw <= landStart) {
            presentation = "boardslide";
            if (!this.travel.boardEngaged) {
              this.travel.boardEngaged = true;
              sfx.play("railLand", 0.72, 1.08);
              puffs.burst("spark", sample.position.x, sample.position.y, sample.position.z, {
                count: 6,
                strength: 0.8,
                dir: sample.tangent.clone().negate().setY(0.45),
              });
            }
            this.travel.sparkClock -= dt;
            if (this.travel.sparkClock <= 0) {
              this.travel.sparkClock = 0.075;
              puffs.burst("spark", sample.position.x, sample.position.y, sample.position.z, {
                count: 2,
                strength: 0.3,
                dir: sample.tangent.clone().negate().setY(0.2),
              });
            }
          } else {
            const phase = raw < mountEnd
              ? raw / mountEnd
              : (raw - landStart) / (1 - landStart);
            sample.position.y += Math.sin(phase * Math.PI) * 0.28;
          }
        }
        this.player.stepWorldMapPresentation(
          sample.position,
          sample.tangent,
          dt,
          presentation,
        );
      }
      if (raw >= 1) {
        const boardTravel = this.travel.style === "boardslide";
        this.selectedKeyValue = this.travel.to;
        this.travel = null;
        this.campaign.setMapFocus(this.selectedKeyValue);
        const pose = level.campaignMapPose(this.selectedKeyValue);
        if (pose)
          this.player.stepWorldMapPresentation(pose.position, pose.heading, dt, "idle");
        this.syncVisuals();
        this.callbacks.onSelection(
          this.selectedKeyValue,
          false,
          this.availableDirections(),
        );
        if (boardTravel) sfx.play("skateHalt", 0.4, 1.2);
        sfx.play("crystalGet", 0.2, 1.65);
      }
      return;
    }

    const pose = level.campaignMapPose(this.selectedKeyValue);
    if (pose)
      this.player.stepWorldMapPresentation(pose.position, pose.heading, dt, "idle");

    const tappedDirection = Math.hypot(input.mapDirectionX, input.mapDirectionY) > 0.25;
    const magnitude = Math.hypot(input.moveX, input.moveY);
    if (tappedDirection) {
      this.directionLatched = magnitude > 0.24;
      this.navigate(input.mapDirectionX, input.mapDirectionY);
    } else if (magnitude < 0.24) this.directionLatched = false;
    else if (!this.directionLatched && magnitude > 0.55) {
      this.directionLatched = true;
      this.navigate(input.moveX, input.moveY);
    }

    if (input.confirmPressed || input.jumpPressed) this.enterSelected();
    else if (input.mapProgressPressed || input.grindPressed) this.openSection("progress");
    else if (input.mapSaveLoadPressed || input.spinPressed) this.openSection("save-load");
    else if (input.mapQuitPressed || input.grabPressed) this.openSection("quit");
  }

  frameCamera(camera: THREE.PerspectiveCamera, dt: number): void {
    const level = this.level;
    if (!level) return;
    const definition = campaignLevelByKey(this.travel?.to ?? this.selectedKeyValue);
    const island = CAMPAIGN_ISLANDS.find(
      (candidate) => candidate.id === definition?.islandId,
    );
    const islandCentre = island
      ? new THREE.Vector3(...island.centre)
      : this.player.renderPosition.clone();
    const targetPose = level.campaignMapPose(this.travel?.to ?? this.selectedKeyValue);
    const portrait = camera.aspect < 0.75;
    const northView = !this.travel && targetPose
      ? THREE.MathUtils.smoothstep(islandCentre.z - targetPose.position.z, 8, 16)
      : 0;
    const orbitSide = (targetPose?.position.x ?? islandCentre.x) < islandCentre.x ? -1 : 1;
    const travelSample = this.travel
      ? level.campaignMapTravel(
          this.travel.from,
          this.travel.to,
          THREE.MathUtils.clamp(this.travel.elapsed / this.travel.duration, 0, 1),
        )
      : null;
    const boardTravel = travelSample?.style === "boardslide";
    const crossIsland = this.travel
      ? this.isCrossIsland(this.travel.from, this.travel.to)
      : false;
    if (this.travel) {
      this.desiredTarget.copy(this.player.renderPosition).lerp(islandCentre, 0.12);
      this.desiredTarget.y = this.player.renderPosition.y + (boardTravel ? 2.2 : 3.1);
    } else {
      this.desiredTarget.copy(islandCentre);
      if (targetPose)
        this.desiredTarget.lerp(targetPose.position, portrait ? 0.9 : 0.52 + northView * 0.3);
      this.desiredTarget.y = (targetPose?.position.y ?? 1.5) + 3.25;
    }
    const travelProgress = this.travel
      ? THREE.MathUtils.clamp(this.travel.elapsed / this.travel.duration, 0, 1)
      : 0;
    const bridgePullback = crossIsland ? Math.sin(travelProgress * Math.PI) : 0;
    this.desiredEye.copy(this.desiredTarget).add(
      new THREE.Vector3(
        northView * orbitSide * 36,
        (boardTravel ? 27 : portrait ? 28 : 31) + bridgePullback * 10 + northView * 4,
        (boardTravel ? 39 : portrait ? 39 : 43) + bridgePullback * 13 - northView * 12,
      ),
    );
    if (!this.cameraReady) {
      this.cameraEye.copy(this.desiredEye);
      this.cameraTarget.copy(this.desiredTarget);
      this.cameraReady = true;
    } else {
      const eyeEase = 1 - Math.exp(-2.6 * dt);
      const targetEase = 1 - Math.exp(-3.2 * dt);
      this.cameraEye.lerp(this.desiredEye, eyeEase);
      this.cameraTarget.lerp(this.desiredTarget, targetEase);
    }
    camera.fov = boardTravel ? 45 : portrait ? 46 : 42;
    camera.near = 0.1;
    camera.far = 900;
    camera.up.copy(UP);
    camera.position.copy(this.cameraEye);
    camera.lookAt(this.cameraTarget);
    camera.updateProjectionMatrix();
  }

  private syncVisuals(): void {
    this.level?.setCampaignMapProgress(
      this.travel?.to ?? this.selectedKeyValue,
      (levelId) => this.campaign.levelProgress(levelId),
      (key) => this.campaign.levelUnlocked(key),
    );
  }

  private availableDirections(): WorldMapDirections {
    const level = this.level;
    if (!level) return this.noDirections();
    const can = (x: number, y: number): boolean =>
      level.campaignMapNeighbor(
        this.selectedKeyValue,
        x,
        y,
        (key) => this.campaign.levelUnlocked(key),
      ) !== null;
    return {
      up: can(0, 1),
      down: can(0, -1),
      left: can(-1, 0),
      right: can(1, 0),
    };
  }

  private noDirections(): WorldMapDirections {
    return { up: false, down: false, left: false, right: false };
  }

  private isCrossIsland(from: string, to: string): boolean {
    const fromIsland: CampaignIslandId | undefined = campaignLevelByKey(from)?.islandId;
    const toIsland: CampaignIslandId | undefined = campaignLevelByKey(to)?.islandId;
    return !!fromIsland && !!toIsland && fromIsland !== toIsland;
  }
}
