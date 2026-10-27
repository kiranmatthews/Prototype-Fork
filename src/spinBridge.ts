import * as THREE from 'three';
import type { CustomComponent } from './level';

/** A spin-operated timber. Existing courses latch it after their first spin;
 * an authored hold time makes it a repeatable opening/hold/folding cycle.
 * p is the hinge at deployed deck height; s is [span, thickness, width].
 * Local +X is the receiving direction, rotated by the authored yaw.
 */
export class SpinBridge {
  readonly pivot = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly hitBox = new THREE.Box3();
  readonly wallBox = new THREE.Box3();
  readonly component: CustomComponent;
  activated = false;
  deployed = false;
  private progress = 0;
  private readonly duration: number;
  private readonly leaf = new THREE.Group();
  private readonly hold: number | null;
  private holdRemaining = 0;
  private closing = false;
  private readonly lamps: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>[] = [];

  get remaining(): number { return this.holdRemaining; }
  get timed(): boolean { return this.hold !== null; }
  get state(): 'closed' | 'opening' | 'open' | 'closing' {
    return !this.activated ? 'closed' : this.closing ? 'closing' : this.deployed ? 'open' : 'opening';
  }

  constructor(parent: THREE.Group, component: CustomComponent, material: THREE.Material) {
    this.component = JSON.parse(JSON.stringify(component));
    const [span, thickness, width] = component.s ?? [5, .36, 1.2];
    this.duration = Math.max(.15, Math.min(2, component.cycle ?? .55));
    this.hold = component.hold === undefined ? null : Math.max(1, Math.min(60, component.hold));
    this.pivot.position.set(...component.p);
    this.pivot.rotation.y = THREE.MathUtils.degToRad(component.yaw ?? 0);
    this.pivot.name = component.nm ?? 'Spin-deploying timber bridge';
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(span, thickness, width), material);
    this.mesh.position.set(span / 2, -thickness / 2, 0);
    this.mesh.name = this.pivot.name;
    this.mesh.userData.spinBridge = true;
    if (component.edgeGrinding !== undefined) this.mesh.userData.edgeGrinding = component.edgeGrinding;
    this.mesh.userData.vert = false;
    this.mesh.userData.undersideThickness = thickness;
    this.leaf.add(this.mesh); this.pivot.add(this.leaf);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, width + .22, 10),
      new THREE.MeshLambertMaterial({ color: '#b89558' }));
    bolt.rotation.x = Math.PI / 2; bolt.position.y = -thickness / 2;
    this.pivot.add(bolt);
    const target = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .035, 10),
      new THREE.MeshLambertMaterial({ color: '#94d171', emissive: '#244518' }));
    target.rotation.x = Math.PI / 2;
    target.position.set(-span / 2 + .8, 0, width / 2 + .025);
    this.mesh.add(target);
    if (this.hold !== null) for (let i = 0; i < 4; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(.2, .035, Math.min(width * .55, 1.8)),
        new THREE.MeshLambertMaterial({color:'#71d2b1',emissive:'#123e32'}));
      lamp.position.set(-span/2 + .65 + i * .36, thickness / 2 + .025, 0);
      this.mesh.add(lamp); this.lamps.push(lamp);
    }
    parent.add(this.pivot); this.restore(false);
  }

  trigger(hitBox: THREE.Box3): boolean {
    if (this.activated || !hitBox.intersectsBox(this.hitBox)) return false;
    this.activated = true;
    this.holdRemaining = this.hold ?? 0;
    // The moving leaf is not a stable support. Its receiving floor becomes
    // available only once it has visibly settled into the horizontal pose.
    this.wallBox.makeEmpty();
    return true;
  }

  update(dt: number): void {
    if (!this.activated || this.deployed && this.hold === null) return;
    let elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0);
    if (!this.deployed && !this.closing) {
      const used = Math.min(elapsed, (1 - this.progress) * this.duration);
      this.progress = Math.min(1, this.progress + used / this.duration);
      elapsed -= used;
      if (this.progress >= 1 - 1e-9) { this.progress = 1; this.deployed = true; }
    }
    if (this.deployed && this.hold !== null) {
      const used = Math.min(elapsed, this.holdRemaining);
      this.holdRemaining = Math.max(0, this.holdRemaining - used);
      elapsed -= used;
      if (this.holdRemaining <= 1e-9) {
        this.holdRemaining = 0; this.deployed = false; this.closing = true;
      }
    }
    if (this.closing) {
      this.progress = Math.max(0, this.progress - elapsed / this.duration);
      if (this.progress <= 1e-9) { this.restore(false); return; }
    }
    const t = this.progress * this.progress * (3 - 2 * this.progress);
    this.leaf.rotation.z = Math.PI / 2 * (1 - t);
    this.pivot.updateMatrixWorld(true);
    this.hitBox.setFromObject(this.mesh);
    this.updateLamps();
  }

  private updateLamps(): void {
    if (this.hold === null) return;
    const fraction = this.deployed ? this.holdRemaining / this.hold : this.activated ? 0 : 1;
    const warning = this.deployed && this.holdRemaining <= Math.min(1.4, this.hold * .35);
    const pulse = warning && Math.sin(this.holdRemaining * 22) > 0;
    this.lamps.forEach((lamp, index) => {
      const lit = fraction > index / this.lamps.length;
      lamp.material.color.set(lit ? warning ? '#efb64f' : '#71d2b1' : '#435750');
      lamp.material.emissive.set(lit ? pulse ? '#b34516' : '#123e32' : '#000000');
    });
  }

  /** Permanent latches are banked. Timed bridges restart closed at safe checkpoints. */
  restore(activated: boolean): void {
    if (this.hold !== null) activated = false;
    this.activated = this.deployed = activated;
    this.closing = false;
    this.holdRemaining = 0;
    this.progress = activated ? 1 : 0;
    this.leaf.rotation.z = activated ? 0 : Math.PI / 2;
    this.pivot.updateMatrixWorld(true);
    this.hitBox.setFromObject(this.mesh);
    if (activated) this.wallBox.makeEmpty();
    else this.wallBox.copy(this.hitBox);
    this.updateLamps();
  }
}
