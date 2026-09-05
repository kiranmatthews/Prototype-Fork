import * as THREE from "three";
import { Level, COMBO_GEM_TINT } from "./level";
import type { Player } from "./player";
import type { ResultsScreenState } from "./gameFlowUI";

export interface ResultsViewport { x: number; y: number; width: number; height: number }

/** Visible surface bounds, excluding hidden rig alternatives and sprite halos. */
function surfaceBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  const vertex = new THREE.Vector3();
  root.traverseVisible((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute("position");
    if (!positions) return;
    if (object instanceof THREE.SkinnedMesh) object.skeleton.update();
    for (let i = 0; i < positions.count; i++) {
      object.getVertexPosition(i, vertex).applyMatrix4(object.matrixWorld);
      bounds.expandByPoint(vertex);
    }
  });
  return bounds;
}

/** A live, disposable shot. It owns no gameplay state or simulation updates. */
export class ResultsPresentation {
  readonly rewards = new THREE.Group();
  private readonly stage: ReturnType<Level["prepareResultsBackdrop"]>;
  private readonly bounds: THREE.Box3;
  private readonly bases: number[] = [];
  private elapsed = 0;

  constructor(scene: THREE.Scene, private readonly player: Player, level: Level, result: ResultsScreenState) {
    this.rewards.name = "results-rewards";
    if (result.kind === "time-trial") {
      if (result.actualTime <= result.relicTarget) this.rewards.add(Level.timeRelicMesh());
    } else {
      if (result.crystal) this.rewards.add(Level.crystalMesh(0.46));
      if (result.boxGem) this.rewards.add(Level.gemMesh(0.68));
      if (result.comboGem) this.rewards.add(Level.gemMesh(0.68, COMBO_GEM_TINT));
    }
    this.stage = level.prepareResultsBackdrop(player.pos);
    player.prepareResultsPose(level, this.stage.position, this.stage.forward.clone().negate(), this.rewards.children.length > 0);
    const body = surfaceBounds(player.animationRig.root);
    if (body.isEmpty()) body.setFromCenterAndSize(this.stage.position.clone().add(new THREE.Vector3(0, 1.2, 0)), new THREE.Vector3(2.8, 2.4, 1));
    const right = this.stage.forward.clone().cross(new THREE.Vector3(0, 1, 0));
    this.rewards.children.forEach((reward, index) => {
      const local = surfaceBounds(reward);
      reward.position.copy(this.stage.position)
        .addScaledVector(right, (index - (this.rewards.children.length - 1) / 2) * 1.1)
        .addScaledVector(this.stage.forward, -0.22);
      reward.position.y = body.max.y + 0.28 - local.min.y;
      this.bases.push(reward.position.y);
      reward.rotation.y = Math.atan2(-this.stage.forward.x, -this.stage.forward.z);
    });
    scene.add(this.rewards);
    this.bounds = body.union(surfaceBounds(this.rewards)).expandByScalar(0.22);
  }

  update(dt: number): void {
    this.elapsed += dt;
    this.player.updateResultsPose(dt);
    this.rewards.children.forEach((reward, index) => {
      reward.position.y = this.bases[index] + Math.sin(this.elapsed * 2 + index * 0.7) * 0.075;
      reward.rotation.y += dt * 0.65;
    });
  }

  frameCamera(camera: THREE.PerspectiveCamera, width: number, height: number, viewport: ResultsViewport): void {
    camera.fov = 34;
    camera.aspect = width / height;
    const center = this.bounds.getCenter(new THREE.Vector3());
    const forward = this.stage.forward;
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0));
    const look = forward.clone().add(new THREE.Vector3(0, -0.065, 0)).normalize();
    const up = right.clone().cross(look).normalize();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanY = tan * Math.max(0.1, viewport.height / height);
    const tanX = tan * camera.aspect * Math.max(0.1, viewport.width / width);
    let distance = 1;
    // Fit all corners in camera space, including depth and the raised lens.
    // A height-only fit can crop a forward hand or shoe on a short viewport.
    const corner = new THREE.Vector3();
    for (const x of [this.bounds.min.x, this.bounds.max.x])
      for (const y of [this.bounds.min.y, this.bounds.max.y])
        for (const z of [this.bounds.min.z, this.bounds.max.z]) {
          corner.set(x, y, z).sub(center);
          distance = Math.max(distance,
            Math.abs(corner.dot(right)) / tanX - corner.dot(look),
            Math.abs(corner.dot(up)) / tanY - corner.dot(look));
        }
    distance += 0.2;
    const cx = (viewport.x + viewport.width / 2) / width;
    const cy = (viewport.y + viewport.height / 2) / height;
    camera.position.copy(center).addScaledVector(look, -distance);
    camera.lookAt(center);
    // Off-axis framing keeps the lens above the floor even on portrait screens.
    camera.setViewOffset(width, height, (0.5 - cx) * width, (0.5 - cy) * height, width, height);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  dispose(): void {
    this.player.endResultsPose();
    this.stage.restore();
    this.rewards.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.rewards.traverse((object) => {
      // Sprite geometry and all textures are shared by the actual game assets.
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
      if (object instanceof THREE.Mesh || object instanceof THREE.Sprite)
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
}
