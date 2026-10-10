import * as THREE from 'three';
import type { CustomComponent } from './level';

/** A Great Gate-style timber plank adapted to latch after its first spin.
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

  constructor(parent: THREE.Group, component: CustomComponent, material: THREE.Material) {
    this.component = JSON.parse(JSON.stringify(component));
    const [span, thickness, width] = component.s ?? [5, .36, 1.2];
    this.duration = Math.max(.15, Math.min(2, component.cycle ?? .55));
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
    parent.add(this.pivot); this.restore(false);
  }

  trigger(hitBox: THREE.Box3): boolean {
    if (this.activated || !hitBox.intersectsBox(this.hitBox)) return false;
    this.activated = true;
    // The moving leaf is not a stable support. Its receiving floor becomes
    // available only once it has visibly settled into the horizontal pose.
    this.wallBox.makeEmpty();
    return true;
  }

  update(dt: number): void {
    if (!this.activated || this.deployed) return;
    this.progress = Math.min(1, this.progress + Math.max(0, dt) / this.duration);
    const t = this.progress * this.progress * (3 - 2 * this.progress);
    this.leaf.rotation.z = Math.PI / 2 * (1 - t);
    this.pivot.updateMatrixWorld(true);
    this.hitBox.setFromObject(this.mesh);
    this.deployed = this.progress === 1;
  }

  /** Checkpoints bank the latch, so restoring an in-flight activation settles it. */
  restore(activated: boolean): void {
    this.activated = this.deployed = activated;
    this.progress = activated ? 1 : 0;
    this.leaf.rotation.z = activated ? 0 : Math.PI / 2;
    this.pivot.updateMatrixWorld(true);
    this.hitBox.setFromObject(this.mesh);
    if (activated) this.wallBox.makeEmpty();
    else this.wallBox.copy(this.hitBox);
  }
}
