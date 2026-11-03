import * as THREE from 'three';
import { PuffSystem, PUFF_PRESETS } from './puffs';

export interface GreenEcoVent {
  position: readonly [number, number, number];
  scale?: number;
  seed?: number;
}

const STEP = 1 / 60;
const CAPACITY = 768;

/**
 * Reusable green eco fire: soft mouth + rising wisps + curling hot-dot trails.
 * Reconstructs the composition of Jak's green vent with our Gouraud fans.
 * One bounded PuffSystem for the whole field, separate from gameplay dust so
 * scenery cannot consume landing/skating particles. No textures/lights/bloom.
 * Call update once on the render clock, after settling the camera, not for
 * each reflection pass. Full authored particles at every viewing distance.
 */
export class GreenEcoFire {
  readonly root = new THREE.Group();
  enabled = true;
  private readonly particles = new PuffSystem(CAPACITY);
  private readonly frustum = new THREE.Frustum();
  private readonly projection = new THREE.Matrix4();
  private readonly bounds = new THREE.Sphere();
  private readonly options = {seed: 0};
  private tick = 0;
  private carry = 0;
  private visibleVents = 0;
  private disposed = false;
  private readonly vents;

  constructor(scene: THREE.Object3D, vents: readonly GreenEcoVent[]) {
    this.root.name = 'Green eco fire';
    scene.add(this.root); this.particles.attach(this.root);
    this.vents = vents.map((vent, i) => {
      const scale = vent.scale ?? 1;
      if (!(scale > 0 && Number.isFinite(scale)) || !vent.position.every(Number.isFinite))
        throw new RangeError('Green eco vents require finite positions and positive scales');
      return {position: new THREE.Vector3(...vent.position), scale, seed: vent.seed ?? i + 1, visible: true};
    });
  }

  private emit(name: string, x: number, y: number, z: number, scale: number, seed: number): void {
    this.options.seed = seed;
    const puff = this.particles.spawn(PUFF_PRESETS[name], x, y, z, this.options);
    if (!puff) return;
    puff.size *= scale; puff.vel.multiplyScalar(scale);
    puff.gravity *= scale; puff.turbAmp *= scale;
    if (name === 'greenEcoFire') puff.rot = 0;
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.root.visible = this.enabled;
    if (!this.enabled) {this.particles.clear(); this.carry = 0; this.visibleVents = 0; return;}
    // Cull whole emitters outside the view. Keep their phase running, and let
    // existing particles expire. Never reduce ring geometry or replace meshes.
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    this.visibleVents = 0;
    for (const vent of this.vents) {
      this.bounds.center.copy(vent.position); this.bounds.center.y += 3.3 * vent.scale;
      this.bounds.radius = 4.5 * vent.scale;
      vent.visible = this.frustum.intersectsSphere(this.bounds);
      if (vent.visible) this.visibleVents++;
    }
    // Bound catch-up after a background tab without spawning a flash of fire.
    const elapsed = Math.min(dt, .1);
    this.carry += elapsed;
    while (this.carry + 1e-8 >= STEP) {
      this.carry -= STEP; this.tick++;
      const time = this.tick * STEP;
      for (const vent of this.vents) {
        if (!vent.visible) continue;
        const {x, y, z} = vent.position, s = vent.scale;
        const phase = vent.seed * 2.3999632297;
        const seed = vent.seed * 100003 + this.tick * 7;
        if (this.tick % 3 === 0) for (let strand = 0; strand < 3; strand++) {
          const t = (time / 2.2 + strand / 3 + vent.seed * .137) % 1;
          const a = phase + strand * 2.094 + t * 8.5 + .23 * Math.sin(time * 2.7 + strand);
          const radius = (.55 + .45 * Math.sin(t * Math.PI)) * (1 - .65 * t);
          this.emit('greenEcoRibbon', x + Math.cos(a) * radius * s,
            y + (.25 + t * 5.9) * s, z + Math.sin(a) * radius * s, s, seed + strand);
        }
        if (this.tick % 4 === 0) {
          const a = phase + time * 4.7;
          this.emit('greenEcoFire', x + Math.cos(a) * .45 * s, y + .22 * s,
            z + Math.sin(a) * .45 * s, s, seed + 3);
        }
        if (this.tick % 8 === 0) {
          const a = phase + time * 5.3;
          this.emit('greenEcoMote', x + Math.cos(a) * .85 * s,
            y + (1 + (Math.sin(a * 1.7) + 1) * 1.5) * s, z + Math.sin(a) * .85 * s, s, seed + 4);
        }
        if (this.tick % 12 === 0) this.emit('greenEcoGlow', x, y + .025, z, s, seed + 5);
      }
    }
    this.particles.update(elapsed, camera);
  }

  get diagnostics() {
    return {enabled: this.enabled, vents: this.vents.length, visibleVents: this.visibleVents,
      particles: this.particles.liveCount, capacity: CAPACITY,
      batches: this.particles.drawCalls,
      // Puff materials are double-sided transparency (two passes in Three).
      drawCallsPerView: this.particles.drawCalls * 2,
      trianglesPerView: this.particles.triangleCount * 2, textures: 0, lights: 0};
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.particles.dispose(); this.root.removeFromParent();
  }
}
