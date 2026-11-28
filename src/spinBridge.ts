import * as THREE from 'three';
import type { CustomComponent } from './level';

/** A spin-operated timber. Existing courses latch it after their first spin;
 * an authored hold time makes it a repeatable opening/hold/folding cycle.
 * p is the hinge at deployed deck height; s is [span, thickness, width].
 * Local +X is the receiving direction, rotated by the authored yaw.
 *
 * A timed leaf is a sprung one. In the last moment of its hold it is drawn
 * down a little against the spring, and then it is let go: it whips up fast
 * and settles upright, and whatever stood on it is thrown the way the leaf
 * goes, up and back over the hinge (the throw itself is the Player's:
 * `slingFromSpinBridge`).
 */
/** Seconds of the hold's end in which a timed leaf is drawn down before it is let go. */
const DRAW_SECONDS = 0.16;
/** How far it is drawn down: radians below level. */
const DRAW_ANGLE = 0.035;
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

  private readonly spanLength: number;
  private readonly width: number;
  /** The wall the leaf is when it stands upright. */
  private readonly upright = new THREE.Box3();
  /** The most the leaf may have risen while a body it threw is still over it (radians), or null. */
  private lead: number | null = null;
  private leadAge = 0;
  /** Time of the fold not yet spent: the step it is let go in is spent on the throw (see update). */
  private owed = 0;
  /** It was spun from the bank behind its hinge (see trigger). */
  private fromBank = false;

  get remaining(): number { return this.holdRemaining; }
  get timed(): boolean { return this.hold !== null; }
  /** Length of the leaf from its hinge. */
  get span(): number { return this.spanLength; }
  /** Seconds the leaf takes to fall, and to whip back up. */
  get foldSeconds(): number { return this.duration; }
  /** How wide the leaf is, across its length. */
  get breadth(): number { return this.width; }
  /** The leaf is on its way down and was spun from the bank: a body on the ground there is held at the brink. */
  get shutsHinge(): boolean { return this.activated && !this.deployed && !this.closing && this.fromBank; }
  /**
   * A body the leaf has thrown is still in the air over it, at this angle about the hinge (radians up from
   * the leaf's level): the leaf comes up BEHIND him, never through him, and does not stand upright (a wall
   * again) until he is clear. Told again each step while it holds; null, or a quarter second's silence, ends it.
   */
  holdBehind(angle: number | null): void {
    this.lead = angle; this.leadAge = 0;
    if (angle !== null && this.closing) this.wallBox.makeEmpty(); // his way back over the hinge is open from this step on
  }
  /**
   * The leaf, on its way up, comes up to a body whose feet are at this point: he is within its length and
   * width, and its next step (of `dt` seconds) brings it to the angle he is at about the hinge, or it has
   * only just passed it. Asked before the leaf moves, so that he is thrown ahead of it and not through
   * it. A body it passed long ago (one that dropped in behind it) is not met, nor one below the deck.
   */
  meets(feet: THREE.Vector3, dt: number): boolean {
    if (!this.closing) return false;
    const yaw = this.pivot.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw), hinge = this.pivot.position;
    const dx = feet.x - hinge.x, dz = feet.z - hinge.z, out = dx * c - dz * s;
    if (out < 0 || out > this.spanLength || Math.abs(dx * s + dz * c) > this.width / 2 + 0.3) return false;
    const his = Math.atan2(feet.y - hinge.y, Math.max(0.01, out));
    const next = Math.max(0, this.progress - (Math.max(0, dt) + this.owed) / this.duration);
    return his > -0.08 && Math.PI / 2 * (1 - next * next * next) >= his - 0.02 && this.leaf.rotation.z <= his + 0.4;
  }
  /** The world direction the leaf lies along when it is down: from the hinge to its far end. */
  receiving(out: THREE.Vector3): THREE.Vector3 {
    const yaw = this.pivot.rotation.y;
    return out.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }
  get state(): 'closed' | 'opening' | 'open' | 'closing' {
    return !this.activated ? 'closed' : this.closing ? 'closing' : this.deployed ? 'open' : 'opening';
  }

  constructor(parent: THREE.Group, component: CustomComponent, material: THREE.Material) {
    this.component = JSON.parse(JSON.stringify(component));
    const [span, thickness, width] = component.s ?? [5, .36, 1.2];
    this.spanLength = span;
    this.width = width;
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
    // The moving leaf is not a stable support: its receiving floor becomes
    // available only once it has visibly settled into the horizontal pose.
    // The wall the upright leaf was retires at once, so a body in the air
    // (a jump with the spin in it) goes on over the hinge and comes down on
    // the leaf as it lands.
    this.wallBox.makeEmpty();
    // A body on the GROUND behind the hinge has no air to wait in: let off the
    // brink he would be under the leaf before it was a floor. Spun from the
    // bank, the hinge is shut to him until the leaf is down (`shutsHinge`: the
    // Player holds him at the brink, without a smack, and he goes on as it
    // lands). Spun from the leaf's own side there is no drop ahead of him.
    const yaw = this.pivot.rotation.y, hinge = this.pivot.position;
    this.fromBank = ((hitBox.min.x + hitBox.max.x) / 2 - hinge.x) * Math.cos(yaw)
      - ((hitBox.min.z + hitBox.max.z) / 2 - hinge.z) * Math.sin(yaw) < 0;
    // (A timed leaf shuts the hinge to everybody the moment it is let go: see update.)
    return true;
  }

  update(dt: number): void {
    if (!this.activated || this.deployed && this.hold === null) return;
    let elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0), letGo = false;
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
        // The leaf does not move in the step it is let go in. The Player's step comes before this one,
        // so that is the step in which whatever stands on it is thrown, and the leaf then comes up
        // behind it instead of through it. The time is owed, not lost: the fold ends when it always did.
        // (A step longer than the whole fold is not a played one, and is spent as it always was.)
        if (elapsed < this.duration) { this.owed = elapsed; elapsed = 0; letGo = true; }
      }
    }
    if (this.closing) {
      if (!letGo) { elapsed += this.owed; this.owed = 0; }
      const was = this.progress;
      this.progress = Math.max(0, this.progress - elapsed / this.duration);
      if (this.lead !== null && (this.leadAge += Math.max(0, dt)) > 0.25) this.lead = null;
      if (this.lead !== null) {
        // It waits for him; it does not go back down for him.
        // (the leaf's angle is a quarter turn times one less the cube of what is left to go)
        const most = Math.min(Math.PI / 2, Math.max(0, this.lead));
        this.progress = Math.max(this.progress, Math.min(was, Math.cbrt(1 - most / (Math.PI / 2))));
        this.wallBox.makeEmpty();
      } else this.wallBox.copy(this.upright); // let go with nobody over it, the hinge is shut again at once
      if (this.progress <= 1e-9) { this.restore(false); return; }
    }
    // Falling, the leaf eases out of its stand and into its seat. Let go, it
    // whips: nearly half of the way up in the first fifth of the time, then it
    // settles (progress runs 1 to 0, and its cube leaves 1 fastest).
    const t = this.closing ? this.progress * this.progress * this.progress
      : this.progress * this.progress * (3 - 2 * this.progress);
    // (drawn down against its spring as the hold runs out: the same floor, 3.5 cm lower for each metre out)
    const draw = this.deployed && this.hold !== null && this.holdRemaining < DRAW_SECONDS
      ? DRAW_ANGLE * (1 - this.holdRemaining / DRAW_SECONDS) ** 2 : 0;
    this.leaf.rotation.z = Math.PI / 2 * (1 - t) - draw;
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
    this.lead = null;
    this.owed = 0;
    this.fromBank = false;
    this.holdRemaining = 0;
    this.progress = activated ? 1 : 0;
    this.leaf.rotation.z = activated ? 0 : Math.PI / 2;
    this.pivot.updateMatrixWorld(true);
    this.hitBox.setFromObject(this.mesh);
    if (activated) this.wallBox.makeEmpty();
    else { this.upright.copy(this.hitBox); this.wallBox.copy(this.hitBox); }
    this.updateLamps();
  }
}
