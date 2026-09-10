import * as THREE from 'three';
import type { CoastWater } from './water';

/** Bounded, world-space foam rings and entry droplets shared across one swimmer's strokes. */
export class SwimEffects {
  readonly group = new THREE.Group();
  private readonly ringGeometry = new THREE.RingGeometry(.82, 1, 24);
  private readonly dropGeometry = new THREE.IcosahedronGeometry(.045, 0);
  private readonly rings = Array.from({ length: 12 }, () => {
    const mesh = new THREE.Mesh(this.ringGeometry, new THREE.MeshBasicMaterial({
      color: 0xe6fbff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
    }));
    mesh.renderOrder = 2;
    mesh.rotation.x = -Math.PI / 2; mesh.visible = false; this.group.add(mesh);
    return { mesh, age: 2, size: .3 };
  });
  private readonly drops = Array.from({ length: 12 }, () => {
    const mesh = new THREE.Mesh(this.dropGeometry, new THREE.MeshBasicMaterial({
      color: 0xdafaff, transparent: true, depthWrite: false,
    }));
    mesh.visible = false; this.group.add(mesh);
    return { mesh, velocity: new THREE.Vector3(), age: 2 };
  });
  private next = 0;
  private timer = 0;
  private wet = false;
  private swimming = false;

  reset(): void {
    this.wet = this.swimming = false; this.timer = 0;
    for (const item of [...this.rings, ...this.drops]) { item.age = 2; item.mesh.visible = false; }
  }
  step(dt: number, water: CoastWater | null, position: Readonly<THREE.Vector3>,
    speed: number, wet: boolean, swimming: boolean): void {
    if (!water) { this.reset(); return; }
    const entering = swimming && !this.swimming;
    this.timer -= dt;
    if (wet && (!this.wet || entering || this.timer <= 0)) {
      const ring = this.rings[this.next++ % this.rings.length];
      ring.age = 0; ring.size = entering ? .65 : swimming ? .42 : .25;
      ring.mesh.position.copy(position);
      this.timer = swimming ? speed > .4 ? .32 : .85 : speed > .2 ? .28 : 1;
      if (entering) this.drops.forEach((drop, i) => {
        const angle = i / this.drops.length * Math.PI * 2;
        drop.age = 0; drop.mesh.position.set(position.x, water.heightAt(position.x, position.z) + .04, position.z);
        drop.velocity.set(Math.cos(angle) * 1.4, 1.8 + i % 3 * .35, Math.sin(angle) * 1.4);
      });
    }
    this.wet = wet; this.swimming = swimming;
    for (const ring of this.rings) {
      ring.age += dt;
      ring.mesh.visible = ring.age < 1.15;
      if (!ring.mesh.visible) continue;
      const t = ring.age / 1.15;
      ring.mesh.position.y = water.heightAt(ring.mesh.position.x, ring.mesh.position.z) + .035;
      ring.mesh.scale.setScalar(ring.size + t * .8);
      ring.mesh.material.opacity = .36 * (1 - t) ** 2;
    }
    for (const drop of this.drops) {
      drop.age += dt; drop.mesh.visible = drop.age < .6;
      if (!drop.mesh.visible) continue;
      drop.velocity.y -= 6 * dt; drop.mesh.position.addScaledVector(drop.velocity, dt);
      drop.mesh.scale.set(1, 1.5, 1);
      drop.mesh.material.opacity = .7 * (1 - drop.age / .6);
    }
  }
  dispose(): void {
    this.group.removeFromParent(); this.ringGeometry.dispose(); this.dropGeometry.dispose();
    for (const item of [...this.rings, ...this.drops]) item.mesh.material.dispose();
  }
}
