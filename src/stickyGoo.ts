import * as THREE from 'three';

/**
 * STICKY GOO. A floor that holds what stands on it: `tex: 'goo'` with a
 * `groundSpeedLimit` (level.ts marks such a surface `sticky`). Nothing here
 * changes how he moves; the limit does that. This is what it looks like.
 *
 *  - GooStrands: wherever something of his that is stuck to the floor comes
 *    away from it (a shoe lifted, a wheel or a hand dragged on), a strand of
 *    goo stretches from where it stuck, thins as it goes, lets go, and springs
 *    back into the floor.
 *  - StickyStruggle: the stick and slip of a body that is rolled or dragged
 *    over it. The walk's own struggle is in its clip (animation/stickyWalk.ts);
 *    a board and a crawl get theirs from this: held back, then let go, with a
 *    chest that is thrown on by each release.
 */

export const GOO_COLOUR = 0xff4fa8;

/** A strand lets go at this length, in metres... */
const SNAP_LENGTH = 0.46;
/** ...and takes this long to spring back into the floor. */
const RECOIL_SECONDS = 0.20;
/** A point that is dragged along the floor without leaving it lays a strand once it has gone this far. */
const DRAG_START = 0.05;
const STRANDS_EACH = 3;

/** One place on him that the floor can hold: a sole, a palm, a truck. */
export interface GooContact {
  /** Where it is, in the world. */
  point: THREE.Vector3;
  /** It is on the floor (as opposed to lifted over it). */
  down: boolean;
  /** The floor under it is goo. */
  sticky: boolean;
  /** How wide it is: the strands leave from across it. */
  width: number;
  /** The height of the floor under it. */
  floor: number;
}

interface Held {
  anchored: boolean;
  anchor: THREE.Vector3;
  /** Seconds since it let go, or -1. */
  recoil: number;
  /** Where its end was, and how long it was, when it let go. */
  from: THREE.Vector3;
  strands: THREE.Mesh[];
  pool: THREE.Mesh;
  length: number;
  /** It was on the floor last step. */
  down: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _side = new THREE.Vector3(), _q = new THREE.Quaternion();

function strandGeometry(): THREE.BufferGeometry {
  // One metre tall, standing on the floor: fat where it leaves the floor, a thread in the middle, a foot where it holds on.
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const y = i / 14, waist = 0.36 + 0.64 * Math.pow(Math.abs(2 * y - 1.1) / 1.1, 1.7);
    profile.push(new THREE.Vector2(Math.max(0.0015, 0.5 * waist * (y < 0.06 ? 1.5 - y * 8 : 1)), y));
  }
  const geometry = new THREE.LatheGeometry(profile, 7);
  geometry.userData.shared = true;
  return geometry;
}

export class GooStrands {
  readonly group = new THREE.Group();
  /** For tests and diagnostics: strands drawn this frame, and how many have let go so far. */
  readonly diagnostics = { drawn: 0, snapped: 0, longest: 0 };
  private readonly strand = strandGeometry();
  private readonly blob = new THREE.SphereGeometry(1, 10, 6);
  // (drawn a shade paler and brighter than the floor it comes off, so that a strand reads against the goo behind it)
  private readonly goo = new THREE.MeshPhongMaterial({ color: 0xffa3d6, specular: 0xffffff, shininess: 110, emissive: GOO_COLOUR, emissiveIntensity: 0.38 });
  private readonly held: Held[] = [];

  constructor(parent: THREE.Object3D) {
    this.group.name = 'Goo strands';
    this.group.userData.visualOnly = true;
    this.blob.userData.shared = true;
    this.goo.userData.shared = true;
    parent.add(this.group);
  }

  private make(): Held {
    const strands = Array.from({ length: STRANDS_EACH }, () => {
      const mesh = new THREE.Mesh(this.strand, this.goo);
      mesh.visible = false; mesh.castShadow = false; mesh.frustumCulled = false;
      this.group.add(mesh);
      return mesh;
    });
    const pool = new THREE.Mesh(this.blob, this.goo);
    pool.visible = false;
    this.group.add(pool);
    return { anchored: false, anchor: new THREE.Vector3(), recoil: -1, from: new THREE.Vector3(), strands, pool, length: 0, down: false };
  }

  /** Draw one strand from the floor at `foot` to `tip`. */
  private draw(mesh: THREE.Mesh, foot: THREE.Vector3, tip: THREE.Vector3, thick: number): void {
    const length = _d.subVectors(tip, foot).length();
    if (length < 0.012) { mesh.visible = false; return; }
    mesh.visible = true;
    mesh.position.copy(foot);
    mesh.quaternion.copy(_q.setFromUnitVectors(UP, _d.multiplyScalar(1 / length)));
    // It thins as it is drawn out, but stays a rope of the stuff and not a thread: this is seen from a long way off.
    const girth = thick / Math.sqrt(1 + length / 0.3);
    mesh.scale.set(girth, length, girth);
    this.diagnostics.drawn++;
  }

  update(dt: number, contacts: readonly GooContact[]): void {
    while (this.held.length < contacts.length) this.held.push(this.make());
    this.diagnostics.drawn = 0;
    for (const [i, held] of this.held.entries()) {
      const contact = contacts[i];
      const letGo = (): void => { if (!held.anchored) return; held.anchored = false; held.recoil = 0; if (contact) held.from.copy(contact.point); this.diagnostics.snapped++; };
      if (!contact) { letGo(); }
      else if (contact.down && contact.sticky) {
        _a.set(contact.point.x, contact.floor, contact.point.z);
        if (!held.anchored) { held.anchored = true; held.anchor.copy(_a); held.recoil = -1; }
        // Dragged on until it lets go, or lifted and set down somewhere else: the old strand goes, and what is
        // under it now takes hold.
        else if (_a.distanceTo(held.anchor) > (held.down ? SNAP_LENGTH : 0.06)) { letGo(); held.anchored = true; held.anchor.copy(_a); }
      } else if (held.anchored && (!contact.sticky && contact.down || contact.point.distanceTo(held.anchor) > SNAP_LENGTH)) letGo();

      held.down = contact?.down === true;
      const width = contact?.width ?? 0.1;
      if (held.anchored && contact) {
        const length = contact.point.distanceTo(held.anchor);
        held.length = length;
        this.diagnostics.longest = Math.max(this.diagnostics.longest, length);
        const drawn = length > (contact.down ? DRAG_START : 0.02);
        // Across the thing that is stuck, at right angles to the way it has come away.
        _side.subVectors(contact.point, held.anchor).cross(UP);
        if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0); _side.normalize();
        for (const [k, mesh] of held.strands.entries()) {
          if (!drawn) { mesh.visible = false; continue; }
          const across = (k - (STRANDS_EACH - 1) / 2) * width * 0.42;
          _a.copy(held.anchor).addScaledVector(_side, across * 1.3);
          _b.copy(contact.point).addScaledVector(_side, across);
          this.draw(mesh, _a, _b, width * (k === 1 ? 1.5 : 0.9));
        }
        held.pool.visible = drawn;
        if (drawn) { const r = width * (1.1 + 0.4 * Math.min(1, length / SNAP_LENGTH)); held.pool.position.copy(held.anchor); held.pool.scale.set(r, 0.02 + 0.05 * Math.min(1, length / 0.2), r); }
      } else if (held.recoil >= 0) {
        // Let go: it whips back into the floor, a little past flat, and is gone.
        held.recoil += Math.max(0, dt);
        const k = Math.min(1, held.recoil / RECOIL_SECONDS), left = (1 - k) * (1 - k) * Math.cos(k * 7);
        for (const [n, mesh] of held.strands.entries()) {
          if (k >= 1 || left <= 0.02) { mesh.visible = false; continue; }
          _b.copy(held.anchor).lerp(held.from, Math.max(0, left));
          this.draw(mesh, held.anchor, _b, width * (n === 1 ? 1.6 : 1.0));
        }
        const r = width * (1.4 + 0.5 * Math.sin(k * Math.PI));
        held.pool.visible = k < 1; held.pool.position.copy(held.anchor); held.pool.scale.set(r, 0.07 * (1 - k) + 0.008, r);
        if (k >= 1) held.recoil = -1;
      } else { for (const mesh of held.strands) mesh.visible = false; held.pool.visible = false; }
    }
  }

  /** Nothing is held any more (a respawn, a level change): no strand is left stretched across the course. */
  clear(): void {
    for (const held of this.held) { held.anchored = false; held.recoil = -1; held.pool.visible = false; for (const mesh of held.strands) mesh.visible = false; }
  }

  dispose(): void {
    this.group.removeFromParent();
    this.strand.dispose(); this.blob.dispose(); this.goo.dispose();
    this.held.length = 0;
  }
}

/** What the stick and slip does to a body just now. */
export interface StruggleSample {
  /** Metres he is drawn back of where he is, along his way (never forward of it). */
  lag: number;
  /** Radians the chest is thrown on (positive: forward). */
  pitch: number;
  /** The torso's length, as a share of its own: short as he is held, long as he comes free. */
  torso: number;
  /** 0..1: how hard he is being held just now. */
  strain: number;
}

/**
 * Stick and slip. Every `stride` metres something of his sticks: he is held back while the floor still has it
 * (up to `hold` metres), and it lets go. The release is a spring's: he comes forward past his place and
 * settles. Fed the distance he has really gone, so it keeps time with his speed and stops when he does.
 */
export class StickyStruggle {
  private travelled = 0;
  private lag = 0;
  private lagV = 0;
  private chest = 0;
  private chestV = 0;
  private weight = 0;
  private readonly sample: StruggleSample = { lag: 0, pitch: 0, torso: 1, strain: 0 };

  reset(): void { this.travelled = this.lag = this.lagV = this.chest = this.chestV = this.weight = 0; }

  step(dt: number, active: boolean, metres: number, stride = 0.5, hold = 0.045): StruggleSample {
    const d = Math.max(0, Math.min(0.05, dt));
    this.weight += ((active ? 1 : 0) - this.weight) * Math.min(1, 9 * d);
    if (active) this.travelled += Math.abs(metres);
    const phase = (this.travelled / stride) % 1;
    // Held for the first 62 % of each stride, more and more; then let go.
    const held = phase < 0.62 ? phase / 0.62 : 0, want = active ? -hold * held * held : 0;
    const stiff = phase < 0.62 ? 260 : 150, damp = phase < 0.62 ? 30 : 11;
    this.lagV += ((want - this.lag) * stiff - this.lagV * damp) * d;
    this.lag = Math.min(0.02, this.lag + this.lagV * d);
    // The chest goes with what the body does a moment later, and overshoots.
    this.chestV += ((-this.lag * 3.2 - this.chest) * 120 - this.chestV * 9) * d;
    this.chest += this.chestV * d;
    const s = this.sample, w = this.weight;
    s.lag = Math.min(0, this.lag) * w;
    s.pitch = THREE.MathUtils.clamp(this.chest + this.lagV * 0.09, -0.16, 0.22) * w;
    s.strain = held * w;
    s.torso = 1 + THREE.MathUtils.clamp(this.lagV * 0.05 - held * 0.03, -0.05, 0.06) * w;
    if (!active && w < 0.002) this.reset();
    return s;
  }
}
