import * as THREE from 'three';
import { crateShardAsset, type CrateArtKind } from './crateArt';
import { solidContact, type SolidQuery, type WorldSolids } from './worldSolids';
import { CrateFracturePool } from './crateFracture';
import { CrateVfx } from './crateVfx';

export interface CrateDebrisWorld {
  worldSolids?: WorldSolids;
  raycastGround?: (ray: THREE.Raycaster) => THREE.Intersection[];
  groundMeshes: THREE.Mesh[];
  killY: number;
}
type Batch = { mesh: THREE.InstancedMesh; bodies: Shard[]; halfSize: THREE.Vector3; center: THREE.Vector3; radius: number };
type Shard = {
  batch: Batch; position: THREE.Vector3; velocity: THREE.Vector3;
  rotation: THREE.Quaternion; angular: THREE.Vector3; size: number;
  age: number; lifetime: number; settled: boolean; bounces: number;
};
const MAX_SHARDS = 64;
const DOWN = new THREE.Vector3(0, -1, 0);
/** A bounded, level-owned cosmetic pool. Shards are real volumes, share the
 * crate material, tumble independently, collide, settle, and expire. They
 * never enter gameplay collision or consume gameplay randomness. */
export class CrateEffects {
  readonly root = new THREE.Group();
  private batches = new Map<string, Batch>();
  private shards: Shard[] = [];
  private seed = 0x561c7109;
  private matrix = new THREE.Matrix4();
  private scale = new THREE.Vector3();
  private from = new THREE.Vector3();
  private next = new THREE.Vector3();
  private axis = new THREE.Vector3();
  private rotation = new THREE.Quaternion();
  private inverse = new THREE.Quaternion();
  private localNormal = new THREE.Vector3();
  private faceNormal = new THREE.Vector3();
  private restRotation = new THREE.Quaternion();
  private collisionShard: Shard | null = null;
  private contact = solidContact();
  private ray = new THREE.Raycaster();
  private query: SolidQuery = { low: 0, high: 0, radius: .07, supportRadius: normal => this.supportRadius(normal) };
  private disposed = false;
  private fracture = new CrateFracturePool();
  private vfx = new CrateVfx();
  constructor() { this.root.name = 'Crate splinters and impact accents'; this.root.userData.editorGhost = true; this.root.add(this.fracture.root, this.vfx.root); }
  private roll(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private batch(kind: CrateArtKind, variant: number): Batch {
    const key = `${kind}:${variant}`; let batch = this.batches.get(key);
    if (!batch) {
      const asset = crateShardAsset(kind, variant);
      const mesh = new THREE.InstancedMesh(asset.geometry, asset.material, MAX_SHARDS);
      mesh.name = `${kind} splinters ${variant}`; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0; mesh.visible = false; mesh.castShadow = true; mesh.receiveShadow = true;
      // CPU pool bounds replace per-frame bounding-volume work; the pool is
      // already capped and inactive batches draw nothing.
      mesh.frustumCulled = false; this.root.add(mesh);
      asset.geometry.computeBoundingBox(); asset.geometry.computeBoundingSphere();
      const bounds = asset.geometry.boundingBox!;
      batch = { mesh, bodies: [], halfSize: bounds.getSize(new THREE.Vector3()).multiplyScalar(.5), center: bounds.getCenter(new THREE.Vector3()), radius: asset.geometry.boundingSphere!.radius + asset.geometry.boundingSphere!.center.length() };
      this.batches.set(key, batch);
    }
    return batch;
  }
  emit(kind: CrateArtKind, center: THREE.Vector3, size: number, groundY: number, explosion = false, surface?: THREE.MeshStandardMaterial): void {
    if (this.disposed || kind === 'checkpoint') return;
    const authored = surface && this.fracture.emit(kind, center, size, surface, explosion);
    const count = authored ? 0 : explosion ? 22 : 15;
    while (this.shards.length + count > MAX_SHARDS) this.retire(this.shards[0]);
    for (let i = 0; i < count; i++) {
      const variant = i >= count - 3 ? 4 : i < 9 ? i % 3 : 3, angle = i / count * Math.PI * 2 + this.roll() * .35;
      const radius = (.17 + this.roll() * .16) * size;
      const power = explosion ? 1.7 : 1;
      const batch = this.batch(kind, variant);
      const shard: Shard = {
        batch, position: center.clone().add(new THREE.Vector3(Math.cos(angle) * radius, (this.roll() - .5) * size * .65, Math.sin(angle) * radius)),
        velocity: new THREE.Vector3(Math.cos(angle) * (2 + this.roll() * 3) * power, (2.7 + this.roll() * 4.7) * power, Math.sin(angle) * (2 + this.roll() * 3) * power),
        rotation: new THREE.Quaternion().setFromEuler(new THREE.Euler(this.roll() * 6, this.roll() * 6, this.roll() * 6)),
        angular: new THREE.Vector3((this.roll() - .5) * 16, (this.roll() - .5) * 11, (this.roll() - .5) * 16),
        size, age: 0, lifetime: 2.05 + this.roll() * .65, settled: false, bounces: 0,
      };
      this.shards.push(shard); batch.bodies.push(shard);
    }
    this.vfx.emit(kind, center, size, groundY, explosion);
    this.writeInstances();
  }
  private retire(shard: Shard): void {
    this.shards.splice(this.shards.indexOf(shard), 1);
    const list = shard.batch.bodies; list.splice(list.indexOf(shard), 1);
  }
  private supportRadius(normal: THREE.Vector3): number {
    const shard = this.collisionShard; if (!shard) return .07;
    this.inverse.copy(shard.rotation).invert(); this.localNormal.copy(normal).applyQuaternion(this.inverse);
    const n = this.localNormal, h = shard.batch.halfSize;
    return Math.max(.006, (Math.abs(n.x) * h.x + Math.abs(n.y) * h.y + Math.abs(n.z) * h.z - n.dot(shard.batch.center)) * shard.size);
  }
  update(dt: number, world: CrateDebrisWorld): void {
    if (this.disposed) return;
    this.fracture.update(dt, world); this.vfx.update(dt);
    if (!this.shards.length) return;
    const step = Math.min(Math.max(dt, 0), .05);
    for (const shard of this.shards.slice()) {
      shard.age += step;
      if (shard.age >= shard.lifetime || shard.position.y < world.killY - 4) { this.retire(shard); continue; }
      if (shard.settled) continue;
      const spin = shard.angular.length();
      if (spin > .001) { this.axis.copy(shard.angular).divideScalar(spin); this.rotation.setFromAxisAngle(this.axis, spin * step); shard.rotation.premultiply(this.rotation); }
      this.collisionShard = shard;
      this.from.copy(shard.position);
      shard.velocity.y -= 18 * step; shard.velocity.multiplyScalar(Math.exp(-step * .55));
      this.next.copy(shard.position).addScaledVector(shard.velocity, step);
      let collided = false;
      this.query.radius = shard.size * shard.batch.radius;
      if (world.worldSolids?.enabled) collided = world.worldSolids.cast(this.from, this.next, this.query, this.contact, false);
      if (collided) {
        shard.position.copy(this.contact.position).addScaledVector(this.contact.normal, this.contact.depth + .006);
        const into = shard.velocity.dot(this.contact.normal);
        if (into < 0) shard.velocity.addScaledVector(this.contact.normal, -into * 1.31);
        shard.velocity.multiplyScalar(.64); shard.angular.multiplyScalar(.5); shard.bounces++;
        if (this.contact.normal.y > .65) {
          const oldSupport = this.supportRadius(this.contact.normal);
          this.faceNormal.set(0, 0, 1).applyQuaternion(shard.rotation);
          if (this.faceNormal.dot(this.contact.normal) < 0) this.faceNormal.negate();
          this.rotation.setFromUnitVectors(this.faceNormal, this.contact.normal);
          this.restRotation.copy(shard.rotation).premultiply(this.rotation);
          shard.rotation.slerp(this.restRotation, shard.bounces >= 2 ? 1 : .35);
          shard.position.addScaledVector(this.contact.normal, this.supportRadius(this.contact.normal) - oldSupport);
        }
      } else {
        // Old lightweight levels may have no hard-surface registry. Sweep
        // the travelled segment against their actual ground, never a fake
        // infinite plane that would leave debris hovering beyond an edge.
        if (shard.velocity.y < 0 && !world.worldSolids?.enabled) {
          const support = this.supportRadius(this.axis.set(0, 1, 0));
          this.ray.set(this.from, DOWN); this.ray.far = this.from.y - this.next.y + support;
          const hits = world.raycastGround?.(this.ray) ?? this.ray.intersectObjects(world.groundMeshes, false);
          if (hits.length) {
            this.next.y = hits[0].point.y + support; shard.velocity.y = Math.abs(shard.velocity.y) * .27;
            shard.velocity.x *= .55; shard.velocity.z *= .55; shard.angular.multiplyScalar(.5); shard.bounces++; collided = true;
          }
        }
        shard.position.copy(this.next);
      }
      if (collided && shard.bounces >= 2 && shard.velocity.lengthSq() < 2) { shard.settled = true; shard.velocity.setScalar(0); }
    }
    this.writeInstances();
  }
  private writeInstances(): void {
    for (const batch of this.batches.values()) {
      batch.mesh.count = batch.bodies.length; batch.mesh.visible = batch.bodies.length > 0;
      batch.bodies.forEach((shard, i) => {
        const fade = Math.min(1, Math.max(0, (shard.lifetime - shard.age) / .32));
        this.scale.setScalar(shard.size * fade); this.matrix.compose(shard.position, shard.rotation, this.scale);
        batch.mesh.setMatrixAt(i, this.matrix);
      });
      if (batch.bodies.length) batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }
  clear(): void {
    this.fracture.clear(); this.vfx.clear();
    this.shards.length = 0;
    for (const batch of this.batches.values()) { batch.bodies.length = 0; batch.mesh.count = 0; batch.mesh.visible = false; }
  }
  dispose(): void {
    this.clear(); this.fracture.dispose(); this.vfx.dispose(); this.disposed = true; this.root.removeFromParent();
    for (const batch of this.batches.values()) batch.mesh.dispose();
    this.root.clear(); this.batches.clear();
  }
  get diagnostics(): { shards: number; bursts: number; drawCalls: number; limit: number } {
    return { shards: this.shards.length + this.fracture.diagnostics.shards, bursts: this.vfx.diagnostics.bursts, drawCalls: [...this.batches.values()].filter(b => b.bodies.length).length + this.vfx.diagnostics.draws + this.fracture.diagnostics.draws, limit: MAX_SHARDS + 168 };
  }
}
