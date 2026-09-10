import * as THREE from 'three';
import type { CoastWater } from './water';
import { swirlBandOffset, swirlContourWave } from './swirlContours';

const RINGS = 12, SEGMENTS = 32, ROWS = 5, LIFETIME = 1.45;
const ROW_ALPHA = [0, .42, 1, .42, 0];

/** Wormhole contour waves + soft radial bands, reduced to one foam draw and one entry-splash draw. */
export class SwimEffects {
  readonly group = new THREE.Group();
  private readonly ringGeometry = new THREE.BufferGeometry();
  private readonly positions = new THREE.BufferAttribute(new Float32Array(RINGS * SEGMENTS * ROWS * 3), 3).setUsage(THREE.DynamicDrawUsage);
  private readonly colors = new THREE.BufferAttribute(new Float32Array(RINGS * SEGMENTS * ROWS * 4), 4).setUsage(THREE.DynamicDrawUsage);
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ vertexColors: true,
    transparent: true, depthWrite: false, side: THREE.DoubleSide });
  private readonly ringMesh = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
  private readonly dropGeometry = new THREE.IcosahedronGeometry(.045, 0);
  private readonly dropMaterial = new THREE.MeshBasicMaterial({ color: 0xdafaff, transparent: true, depthWrite: false });
  private readonly dropMesh = new THREE.InstancedMesh(this.dropGeometry, this.dropMaterial, 12);
  private readonly matrix = new THREE.Matrix4();
  private readonly rings = Array.from({ length: RINGS }, (_, i) => ({
    age: LIFETIME, size: .3, x: 0, z: 0, phase: i * 2.39996,
  }));
  private readonly drops = Array.from({ length: 12 }, () => ({
    position: new THREE.Vector3(), velocity: new THREE.Vector3(), age: 2,
  }));
  private next = 0;
  private timer = 0;
  private clock = 0;
  private wet = false;
  private swimming = false;

  constructor() {
    const indices: number[] = [];
    for (let ring = 0; ring < RINGS; ring++) for (let row = 0; row < ROWS - 1; row++) {
      for (let j = 0; j < SEGMENTS; j++) {
        const a = (ring * ROWS + row) * SEGMENTS + j;
        const b = (ring * ROWS + row) * SEGMENTS + (j + 1) % SEGMENTS;
        indices.push(a, a + SEGMENTS, b, b, a + SEGMENTS, b + SEGMENTS);
      }
    }
    this.ringGeometry.setAttribute('position', this.positions);
    this.ringGeometry.setAttribute('color', this.colors);
    this.ringGeometry.setIndex(indices);
    this.ringMesh.renderOrder = this.dropMesh.renderOrder = 2;
    // A tiny fixed pool in world space; skip bounding-box rebuilds on each ripple.
    this.ringMesh.frustumCulled = this.dropMesh.frustumCulled = false;
    this.dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringMesh.visible = this.dropMesh.visible = false;
    this.group.add(this.ringMesh, this.dropMesh);
  }
  reset(): void {
    this.wet = this.swimming = false; this.timer = this.next = this.clock = 0;
    for (const ring of this.rings) ring.age = LIFETIME;
    for (const drop of this.drops) drop.age = 2;
    this.ringMesh.visible = this.dropMesh.visible = false;
    this.positions.array.fill(0); this.colors.array.fill(0);
    this.positions.needsUpdate = this.colors.needsUpdate = true;
  }
  step(dt: number, water: CoastWater | null, position: Readonly<THREE.Vector3>,
    speed: number, wet: boolean, swimming: boolean): void {
    if (!water) { this.reset(); return; }
    this.clock += dt;
    const entering = swimming && !this.swimming;
    this.timer -= dt;
    if (wet && (!this.wet || entering || this.timer <= 0)) {
      const ring = this.rings[this.next++ % RINGS];
      ring.age = 0; ring.size = entering ? .65 : swimming ? .42 : .25;
      ring.x = position.x; ring.z = position.z;
      this.timer = swimming ? speed > .4 ? .32 : .85 : speed > .2 ? .28 : 1;
      if (entering) this.drops.forEach((drop, i) => {
        const angle = i / this.drops.length * Math.PI * 2;
        drop.age = 0; drop.position.set(position.x, water.heightAt(position.x, position.z) + .04, position.z);
        drop.velocity.set(Math.cos(angle) * 1.4, 1.8 + i % 3 * .35, Math.sin(angle) * 1.4);
      });
    }
    this.wet = wet; this.swimming = swimming;
    let active = 0;
    for (let i = 0; i < RINGS; i++) {
      const ring = this.rings[i], wasLive = ring.age < LIFETIME;
      ring.age += dt;
      const live = ring.age < LIFETIME;
      if (!live) {
        if (wasLive) for (let k = i * ROWS * SEGMENTS; k < (i + 1) * ROWS * SEGMENTS; k++) {
          this.positions.setXYZ(k, 0, 0, 0); this.colors.setW(k, 0);
        }
        continue;
      }
      active++;
      const t = Math.min(1, ring.age / LIFETIME);
      const radius = ring.size + t * 1.05;
      const y = live ? water.heightAt(ring.x, ring.z) + .045 : 0;
      // Short fade-in avoids a stamped-on circle. Wider, feathered bands
      // dissolve asymmetrically while independent lobes keep changing shape.
      const alpha = .38 * Math.min(1, t / .08) * (1 - t) ** 1.7;
      for (let j = 0; j < SEGMENTS; j++) {
        const angle = j / SEGMENTS * Math.PI * 2;
        const warp = swirlContourWave(angle, this.clock, .115, 2, ring.phase, .95) +
          swirlContourWave(angle, this.clock, .07, 3, ring.phase * .7, -.7) +
          swirlContourWave(angle, this.clock, .025, 7, ring.phase, 1.65);
        const width = (.10 + t * .10) * (1 + .25 * Math.sin(angle * 3 + ring.phase));
        const strength = .78 + .22 * Math.sin(angle * 4 + this.clock * .8 + ring.phase);
        for (let row = 0; row < ROWS; row++) {
          const vertex = (i * ROWS + row) * SEGMENTS + j;
          const r = radius * (1 + warp) + swirlBandOffset(row, width * .27, width);
          this.positions.setXYZ(vertex, live ? ring.x + Math.cos(angle) * r : 0, y,
            live ? ring.z + Math.sin(angle) * r : 0);
          this.colors.setXYZW(vertex, .79, .94, 1, live ? alpha * ROW_ALPHA[row] * strength : 0);
        }
      }
    }
    this.ringMesh.visible = active > 0;
    if (active) { this.positions.needsUpdate = true; this.colors.needsUpdate = true; }
    let dropCount = 0;
    for (const drop of this.drops) {
      drop.age += dt;
      if (drop.age >= .6) continue;
      drop.velocity.y -= 6 * dt; drop.position.addScaledVector(drop.velocity, dt);
      this.matrix.makeScale(1, 1.5, 1).setPosition(drop.position);
      this.dropMesh.setMatrixAt(dropCount++, this.matrix);
      this.dropMaterial.opacity = .7 * (1 - drop.age / .6);
    }
    this.dropMesh.count = dropCount; this.dropMesh.visible = dropCount > 0;
    if (dropCount) this.dropMesh.instanceMatrix.needsUpdate = true;
  }
  dispose(): void {
    this.group.removeFromParent(); this.ringGeometry.dispose(); this.dropGeometry.dispose();
    this.ringMaterial.dispose(); this.dropMaterial.dispose(); this.dropMesh.dispose();
  }
}
