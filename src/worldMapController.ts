import * as THREE from "three";
import {
  CAMPAIGN_LEVELS,
  CAMPAIGN_START_LEVEL_KEY,
  CAMPAIGN_MAP_EDGES,
  campaignLevelByKey,
  type CampaignIslandId,
  type CampaignStore,
} from "./campaign";
import type { Input } from "./input";
import type { Level } from "./level";
import type { Player } from "./player";
import { sfx } from "./audio";
import { puffs } from "./puffs";
import { islandViewAngle, lerpOrbitAngle, mapViewDirections, islandMapFrame } from "./mapView";

const UP = new THREE.Vector3(0, 1, 0);
const MAP_PLAYER_SCALE = 4.6;

export type WorldMapSection = "level-select" | "progress" | "options" | "save-load" | "quit";

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
  crossIsland: boolean;
  relocated: boolean;
  boardEngaged: boolean;
  sparkClock: number;
}

export class WorldMapController {
  private level: Level | null = null;
  private selectedKeyValue = "";
  private travel: ActiveTravel | null = null;
  private pendingRoute: string[] = [];
  private directionLatched = false;
  private cameraReady = false;
  private orbitAngle = 0;
  private orbitHeight = 0;
  private orbitDistance = 0;
  private readonly cameraEye = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
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

  get destinationKey(): string {
    return this.travel?.to ?? this.selectedKeyValue;
  }

  get moving(): boolean {
    return this.travel !== null;
  }

  activate(level: Level, preferredKey: string | null): void {
    this.player.group.visible = true;
    this.player.setWorldMapPresentationScale(MAP_PLAYER_SCALE);
    const fallback = this.campaign.recommendedMapLevelKey();
    const selected =
      preferredKey && level.campaignMapHas(preferredKey) && this.campaign.levelUnlocked(preferredKey)
        ? preferredKey
        : level.campaignMapHas(fallback)
          ? fallback
          : CAMPAIGN_START_LEVEL_KEY;
    this.level = level;
    this.selectedKeyValue = selected;
    this.travel = null;
    this.pendingRoute = [];
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
    this.player.group.visible = true;
    if (this.level) {
      this.player.setWorldMapPresentationScale(null);
      this.player.snapRenderInterpolation();
    }
    this.level = null;
    this.travel = null;
    this.pendingRoute = [];
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
    const direction = Math.abs(screenX)>=Math.abs(screenY)
      ? screenX>=0?'right':'left' : screenY>=0?'up':'down';
    const next = this.directionSlots()[direction];
    if (!next || next === this.selectedKeyValue) {
      sfx.play("enemyDown", 0.22, 1.25);
      return false;
    }
    return this.beginTravel(next);
  }

  private beginTravel(next: string): boolean {
    const level = this.level;
    if (!level || this.travel || !this.campaign.levelUnlocked(next)) return false;
    const initial = level.campaignMapTravel(this.selectedKeyValue, next, 0);
    if (!initial) return false;
    this.travel = {
      from: this.selectedKeyValue,
      to: next,
      elapsed: 0,
      duration: this.isCrossIsland(this.selectedKeyValue, next) ? 2.6 : initial.duration,
      style: initial.style,
      crossIsland: this.isCrossIsland(this.selectedKeyValue, next),
      relocated: false,
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

  /** Direct selection follows the unlocked graph, including cinematic island changes. */
  travelTo(target: string): boolean {
    if (!this.level || this.travel || !this.campaign.levelUnlocked(target)) return false;
    if (target === this.selectedKeyValue) return true;
    const routes = [[this.selectedKeyValue]], visited = new Set([this.selectedKeyValue]);
    for (let cursor = 0; cursor < routes.length; cursor++) {
      const path = routes[cursor], key = path[path.length - 1];
      for (const next of this.neighbors(key)) {
        if (visited.has(next)) continue;
        const route = [...path, next];
        if (next === target) {
          this.pendingRoute = route.slice(2);
          return this.beginTravel(route[1]);
        }
        visited.add(next); routes.push(route);
      }
    }
    return false;
  }

  /** CSS-pixel picking and directional travel in the actual rendered camera. */
  touchMap(x: number, y: number, width: number, height: number, camera: THREE.PerspectiveCamera): boolean {
    const level = this.level;
    if (!level || this.travel || width <= 0 || height <= 0 || x < 0 || y < 0 || x > width || y > height) return false;
    camera.updateMatrixWorld();
    const project = (key: string) => {
      const pose = level.campaignMapPose(key);
      if (!pose) return null;
      const point = pose.position.clone().project(camera);
      return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, z: point.z };
    };
    let nearest: string | null = null, nearestDistance = 34;
    for (const definition of CAMPAIGN_LEVELS) {
      const point = project(definition.progressKey);
      if (!point || point.z < -1 || point.z > 1 || point.x < 0 || point.x > width || point.y < 0 || point.y > height) continue;
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance < nearestDistance) { nearest = definition.progressKey; nearestDistance = distance; }
    }
    // A locked marker consumes the tap; it must not select some other path.
    if (nearest) return this.travelTo(nearest);
    const origin = project(this.selectedKeyValue);
    if (!origin) return false;
    const dx = x - THREE.MathUtils.clamp(origin.x, 24, width - 24);
    const dy = y - THREE.MathUtils.clamp(origin.y, 24, height - 24);
    const length = Math.hypot(dx, dy);
    if (length < 40) return false;
    // Keys, stick, hints and empty-space taps use the same island-facing slots.
    return this.navigate(dx, -dy);
  }

  private neighbors(key: string): string[] {
    return CAMPAIGN_MAP_EDGES.flatMap(edge => {
      const next = edge.from === key ? edge.to : edge.to === key ? edge.from : null;
      return next && this.campaign.levelUnlocked(next) && this.level?.campaignMapHas(next) ? [next] : [];
    });
  }

  enterSelected(): boolean {
    if (!this.level || this.travel) return false;
    const definition = campaignLevelByKey(this.selectedKeyValue);
    if (!definition || !this.campaign.levelPlayable(definition.progressKey)) {
      sfx.play("enemyDown", 0.28, 0.9);
      return false;
    }
    this.callbacks.onEnterLevel(definition.levelId);
    return true;
  }

  openSection(section: WorldMapSection): void {
    if (!this.level) return;
    this.callbacks.onOpenSection(section);
  }

  step(dt: number, input: Input): void {
    const level = this.level;
    if (!level) return;
    if (input.mapLevelSelectPressed) { this.openSection("level-select"); return; }
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
      if (this.travel.crossIsland) {
        // The camera leaves the old coast before the rider is relocated. Never
        // render an airborne skater or a rail across the ocean.
        const arrived = raw >= .5;
        const pose = level.campaignMapPose(arrived ? this.travel.to : this.travel.from);
        if (pose) this.player.stepWorldMapPresentation(pose.position, pose.heading, dt, "idle");
        // Apply after pose generation: the ordinary character pass restores
        // visibility for a living rider.
        this.player.group.visible = raw < .12 || raw >= .78;
        if (arrived && !this.travel.relocated) {
          this.travel.relocated = true;
          this.player.snapRenderInterpolation();
        }
      } else if (sample) {
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
        const boardTravel = !this.travel.crossIsland && this.travel.style === "boardslide";
        this.player.group.visible = true;
        this.selectedKeyValue = this.travel.to;
        this.travel = null;
        this.campaign.setMapFocus(this.selectedKeyValue);
        const next = this.pendingRoute.shift();
        if (next && this.beginTravel(next)) return;
        this.pendingRoute = [];
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
    else if (input.mapProgressPressed || input.grindPressed) this.openSection("options");
    else if (input.mapSaveLoadPressed || input.spinPressed) this.openSection("save-load");
    else if (input.mapQuitPressed || input.grabPressed) this.openSection("quit");
  }

  frameCamera(camera: THREE.PerspectiveCamera, dt: number): void {
    const level = this.level;
    if (!level) return;
    const key = this.travel?.to ?? this.selectedKeyValue;
    const centre = level.campaignMapIslandCentre(key) ?? this.player.renderPosition.clone();
    const pose = level.campaignMapPose(key)?.position ?? this.player.renderPosition;
    const frame = islandMapFrame(this.travel && !this.travel.crossIsland ? this.player.renderPosition : pose,
      centre, camera.aspect, campaignLevelByKey(key)?.islandId);
    if (this.travel?.crossIsland) {
      const fromCentre = level.campaignMapIslandCentre(this.travel.from)!;
      const fromPose = level.campaignMapPose(this.travel.from)!.position;
      const from = islandMapFrame(fromPose, fromCentre, camera.aspect, campaignLevelByKey(this.travel.from)?.islandId);
      const raw = THREE.MathUtils.clamp(this.travel.elapsed / this.travel.duration, 0, 1);
      const t = THREE.MathUtils.smootherstep(raw, .06, .94);
      this.cameraTarget.copy(from.target).lerp(frame.target, t);
      this.cameraEye.copy(from.eye).lerp(frame.eye, t);
      this.cameraEye.y += Math.sin(t * Math.PI) * 12;
      this.orbitAngle = frame.angle;
      this.orbitDistance = frame.distance;
      this.orbitHeight = frame.height;
      this.cameraReady = true;
    } else {
      this.desiredTarget.copy(frame.target);
      if (!this.cameraReady) {
        this.cameraTarget.copy(frame.target);
        this.orbitAngle = frame.angle;
        this.orbitHeight = frame.height;
        this.orbitDistance = frame.distance;
        this.cameraReady = true;
      } else {
        const ease = 1 - Math.exp(-5 * dt);
        this.cameraTarget.lerp(this.desiredTarget, ease);
        this.orbitAngle = lerpOrbitAngle(this.orbitAngle, frame.angle, ease);
        this.orbitHeight = THREE.MathUtils.lerp(this.orbitHeight, frame.height, ease);
        this.orbitDistance = THREE.MathUtils.lerp(this.orbitDistance, frame.distance, ease);
      }
      this.cameraEye.copy(this.cameraTarget).add(new THREE.Vector3(
        Math.sin(this.orbitAngle)*this.orbitDistance,this.orbitHeight,Math.cos(this.orbitAngle)*this.orbitDistance));
    }
    camera.fov = frame.fov;
    camera.near = .1;
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
    const slots=this.directionSlots();
    return {up:!!slots.up,down:!!slots.down,left:!!slots.left,right:!!slots.right};
  }

  private directionSlots() {
    const level=this.level,pose=level?.campaignMapPose(this.selectedKeyValue);
    const centre=level?.campaignMapIslandCentre(this.selectedKeyValue);
    if(!level||!pose||!centre)return {};
    const exits=this.neighbors(this.selectedKeyValue).map(key=>({key,
      delta:level.campaignMapTravel(this.selectedKeyValue,key,.08)!.position.sub(pose.position)}));
    return mapViewDirections(islandViewAngle(pose.position,centre),exits);
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
