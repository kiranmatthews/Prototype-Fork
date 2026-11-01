import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CAMPAIGN_ISLANDS } from './campaign';
import type { Level } from './level';
import type { Player } from './player';

interface HubSkater {
  key: string;
  anchor: THREE.Group;
  body: THREE.Group;
  parts: THREE.Object3D[];
}

function cloneRider(source: THREE.Object3D, parts: THREE.Object3D[]): THREE.Object3D {
  // Authoring metadata contains circular rig/footwear references. It is not
  // presentation state and Object3D.clone cannot JSON-copy it. The synchronous
  // clone keeps shared surfaces and independent bones; always restore owners.
  const metadata = parts.map(part => part.userData);
  try {
    for (const part of parts) part.userData = {};
    return cloneSkeleton(source);
  } finally {
    for (let i = 0; i < parts.length; i++) parts[i].userData = metadata[i];
  }
}

/** Full authored rider surfaces; shared meshes/textures, independent bone poses. */
export class WorldMapHubSkaters {
  private readonly root = new THREE.Group();
  private readonly riders: HubSkater[] = [];
  private readonly sources: THREE.Object3D[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly bodyMatrix = new THREE.Matrix4();
  private readonly skeletons = new Set<THREE.Skeleton>();
  private disposed = false;

  constructor(private readonly player: Player, level: Level) {
    this.root.name = 'world-map-hub-skaters';
    const source = player.riderRef;
    if (!source) return;
    source.traverse(object => this.sources.push(object));
    for (const island of CAMPAIGN_ISLANDS) {
      for (const key of new Set([island.levelKeys[0], island.levelKeys[island.levelKeys.length - 1]])) {
        const pose = level.campaignMapPose(key);
        if (!pose) continue;
        const anchor = new THREE.Group(), body = new THREE.Group();
        anchor.name = `map hub skater ${key}`;
        anchor.userData.mapSkaterHub = key;
        anchor.position.copy(pose.position);
        body.matrixAutoUpdate = false;
        const model = cloneRider(source, this.sources), parts: THREE.Object3D[] = [];
        model.traverse(object => {
          parts.push(object);
          // Original rigid surfaces have layer zero while their render batch
          // owns drawing. The replicas use those complete original surfaces.
          if ((object as THREE.Mesh).isMesh && object.layers.mask === 0) object.layers.set(0);
          if (object instanceof THREE.SkinnedMesh) this.skeletons.add(object.skeleton);
        });
        body.add(model); anchor.add(body); this.root.add(anchor);
        this.riders.push({ key, anchor, body, parts });
      }
    }
    player.group.parent?.add(this.root);
  }

  get diagnostics() {
    return this.riders.map(({key, anchor}) => ({ key, visible: anchor.visible, position: anchor.position.toArray() }));
  }

  sync(selected: string, moving: boolean, crossIsland: boolean, unlocked: (key: string) => boolean): void {
    if (this.disposed) return;
    const source = this.player.riderRef;
    if (!source?.parent) return;
    source.parent.updateWorldMatrix(true, false);
    this.inverse.copy(this.player.group.matrixWorld).invert();
    this.bodyMatrix.multiplyMatrices(this.inverse, source.parent.matrixWorld);
    for (const rider of this.riders) {
      rider.anchor.visible = unlocked(rider.key) && (moving || rider.key !== selected);
      // Idle poses are shared during the pan. While the active rider walks
      // around a coast, the hub residents retain their last grounded idle.
      if (moving && !crossIsland) continue;
      rider.anchor.quaternion.copy(this.player.group.quaternion);
      rider.anchor.scale.copy(this.player.group.scale);
      rider.body.matrix.copy(this.bodyMatrix);
      rider.body.matrixWorldNeedsUpdate = true;
      for (let i = 0; i < this.sources.length; i++) {
        const from = this.sources[i], to = rider.parts[i];
        to.position.copy(from.position); to.quaternion.copy(from.quaternion); to.scale.copy(from.scale);
        to.matrix.copy(from.matrix); to.matrixAutoUpdate = from.matrixAutoUpdate;
        to.matrixWorldNeedsUpdate = true; to.visible = from.visible;
        const morphs = (from as THREE.Mesh).morphTargetInfluences;
        if (morphs) (to as THREE.Mesh).morphTargetInfluences?.splice(0, morphs.length, ...morphs);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent(); this.root.clear();
    // Skeleton palettes belong to these replicas. Geometry, materials and
    // textures belong to the player and must survive return to gameplay.
    for (const skeleton of this.skeletons) skeleton.dispose();
    this.skeletons.clear(); this.riders.length = 0; this.sources.length = 0;
  }
}
