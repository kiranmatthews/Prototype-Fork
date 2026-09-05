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

const UP = new THREE.Vector3(0, 1, 0);

export type WorldMapSection = "progress" | "options" | "save-load" | "quit";

export interface WorldMapControllerCallbacks {
  onSelection: (progressKey: string, moving: boolean) => void;
  onEnterLevel: (levelId: string) => void;
  onOpenSection: (section: WorldMapSection) => void;
}

interface ActiveTravel {
  from: string;
  to: string;
  elapsed: number;
  duration: number;
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
    const pose = level.campaignMapPose(selected);
    if (pose) {
      this.player.stepWorldMapPresentation(pose.position, pose.heading, 1 / 60, "idle");
      this.player.snapRenderInterpolation();
    }
    this.syncVisuals();
    this.callbacks.onSelection(selected, false);
  }

  deactivate(): void {
    this.level = null;
    this.travel = null;
    this.directionLatched = false;
    this.cameraReady = false;
  }

  refresh(): void {
    if (!this.level) return;
    this.syncVisuals();
    this.callbacks.onSelection(this.selectedKeyValue, this.moving);
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
    };
    this.syncVisuals();
    this.callbacks.onSelection(next, true);
    sfx.play(initial.style === "boardslide" ? "railLand" : "footstep1", 0.32, 1.08);
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
        this.player.stepWorldMapPresentation(
          sample.position,
          sample.tangent,
          dt,
          sample.style === "boardslide" ? "boardslide" : "walk",
        );
      }
      if (raw >= 1) {
        this.selectedKeyValue = this.travel.to;
        this.travel = null;
        const pose = level.campaignMapPose(this.selectedKeyValue);
        if (pose)
          this.player.stepWorldMapPresentation(pose.position, pose.heading, dt, "idle");
        this.syncVisuals();
        this.callbacks.onSelection(this.selectedKeyValue, false);
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
    if (!this.level) return;
    const definition = campaignLevelByKey(this.travel?.to ?? this.selectedKeyValue);
    const island = CAMPAIGN_ISLANDS.find(
      (candidate) => candidate.id === definition?.islandId,
    );
    const islandCentre = island
      ? new THREE.Vector3(...island.centre)
      : this.player.renderPosition.clone();
    const bridgeTravel = this.travel && this.isCrossIsland(this.travel.from, this.travel.to);
    if (bridgeTravel) {
      this.desiredTarget.copy(this.player.renderPosition);
      this.desiredTarget.y = 1.8;
    } else {
      this.desiredTarget.copy(islandCentre);
      this.desiredTarget.y = 2.5;
    }
    this.desiredEye.copy(this.desiredTarget).add(new THREE.Vector3(0, 50, 61));
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
    camera.fov = 39;
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

  private isCrossIsland(from: string, to: string): boolean {
    const fromIsland: CampaignIslandId | undefined = campaignLevelByKey(from)?.islandId;
    const toIsland: CampaignIslandId | undefined = campaignLevelByKey(to)?.islandId;
    return !!fromIsland && !!toIsland && fromIsland !== toIsland;
  }
}
