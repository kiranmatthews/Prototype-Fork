import * as THREE from 'three';

export type BreakApartStyle = 'head-pop' | 'waist-split' | 'loose-limbs' | 'yard-sale';
export type WipeoutDirection = 'forward' | 'back' | 'side' | 'air';
interface DebrisWorld {
  groundMeshes: THREE.Mesh[];
  walls: THREE.Box3[];
  crumbles: { state: string }[];
  killY: number;
}
interface Part {
  node: THREE.Object3D;
  name: string;
  offset: THREE.Vector3;
  radius: number;
  rank: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Quaternion;
  angular: THREE.Vector3;
  scale: THREE.Vector3;
  localPosition: THREE.Vector3;
  localRotation: THREE.Quaternion;
  localScale: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Quaternion;
  targetScale: THREE.Vector3;
  fromPosition: THREE.Vector3;
  fromRotation: THREE.Quaternion;
  floor: number;
  floorMesh: THREE.Mesh | null;
  probeY: number;
  probeX: number;
  probeZ: number;
  bounces: number;
  sleeping: boolean;
  selected: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (x: number) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };
// Parents precede children. These are the EXISTING semantic joints: no copies
// of skins, materials, skeletons or draw calls, and no joint constraint solver.
const SOCKETS = [
  ['hips', 0, -.18, 0, .42, 0],
  ['torso-root', 0, .27, 0, .39, 1],
  ['head', 0, .20, 0, .24, 5],
  ['shoulder-left', 0, -.18, 0, .24, 2],
  ['wrist-left', 0, -.06, 0, .13, 4],
  ['shoulder-right', 0, -.18, 0, .24, 2.3],
  ['wrist-right', 0, -.06, 0, .13, 4.3],
  ['knee-left', 0, -.17, 0, .27, 3],
  ['knee-right', 0, -.17, 0, .27, 3.3],
] as const;

/** Presentation-only modular wipeouts. Restore before ANY gameplay/animation
 * work; apply after the authoritative pose and interaction bounds are finished.
 * Existing render interpolation and rigid palettes then carry the pieces.
 * The authored bail/death clip still supplies its editable independent segment
 * elasticity, hand flails and secondary motion beneath each loose joint.
 */
export class CharacterBreakApart {
  private parts: Part[] = [];
  private applied = false;
  private pending = false;
  private initialized = false;
  private fatal = false;
  private age = 0;
  private returning = false;
  private returnT = 0;
  private returnDuration = .58;
  private style: BreakApartStyle = 'head-pop';
  private incident = 0;
  private variant = 0;
  private seed = 0x6132ace;
  private entryVelocity = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private candidates: THREE.Mesh[] = [];
  private walls: THREE.Box3[] = [];
  private scan = 0;
  private probes = 0;
  private lastProbes = 0;
  private contacts = 0;
  private startFloor = -Infinity;
  private startFloorMesh: THREE.Mesh | null = null;
  private bounds = new THREE.Box3();
  private region = new THREE.Box3();
  private matrix = new THREE.Matrix4();
  private inverse = new THREE.Matrix4();
  private delta = new THREE.Vector3();
  private point = new THREE.Vector3();
  private angularQ = new THREE.Quaternion();
  private normal = new THREE.Vector3();
  private normalMatrix = new THREE.Matrix3();
  private ray = new THREE.Raycaster();
  private hits: THREE.Intersection[] = [];

  constructor(private readonly root: THREE.Object3D) {}

  get active(): boolean { return this.pending || this.initialized; }
  get preparing(): boolean { return this.pending; }
  get diagnostics() {
    return { active: this.active, style: this.style, variant: this.variant, fatal: this.fatal,
      phase: !this.active ? 'whole' : this.returning ? 'reassembling' : 'scattered',
      age: this.age, parts: this.parts.filter(p => p.selected).length,
      sleeping: this.parts.filter(p => p.selected && p.sleeping).length,
      probes: this.probes, probesThisStep: this.lastProbes, contacts: this.contacts,
      returnProgress: this.returning ? Math.min(1, this.returnT / this.returnDuration) : 0 };
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  /** May be refined in the same collision tick (generic bail -> low trip). */
  request(kind: WipeoutDirection, velocity: THREE.Vector3, fatal = false, support?: { y: number; mesh?: THREE.Object3D } | null): void {
    if (this.initialized) {
      if (fatal) { this.fatal = true; this.returning = false; }
      return;
    }
    if (!this.pending) {
      this.restore();
      this.incident++;
      this.variant = this.incident % 3;
      this.entryVelocity.copy(velocity);
      this.startFloor = support?.y ?? -Infinity;
      this.startFloorMesh = support?.mesh as THREE.Mesh ?? null;
      this.capture();
    }
    this.pending = true;
    this.fatal ||= fatal;
    this.style = this.fatal ? 'yard-sale' : kind === 'back' ? 'head-pop' : kind === 'forward'
      ? 'waist-split' : kind === 'side' ? 'loose-limbs' : this.variant === 0 ? 'yard-sale' : 'loose-limbs';
  }

  private capture(): void {
    if (!this.parts.length) {
      for (const [name, x, y, z, radius, rank] of SOCKETS) {
        const node = this.root.getObjectByName(name);
        if (!node) continue;
        this.parts.push({ node, name, offset: new THREE.Vector3(x, y, z), radius, rank,
          position: new THREE.Vector3(), velocity: new THREE.Vector3(), rotation: new THREE.Quaternion(),
          angular: new THREE.Vector3(), scale: new THREE.Vector3(), localPosition: new THREE.Vector3(),
          localRotation: new THREE.Quaternion(), localScale: new THREE.Vector3(),
          targetPosition: new THREE.Vector3(), targetRotation: new THREE.Quaternion(), targetScale: new THREE.Vector3(),
          fromPosition: new THREE.Vector3(), fromRotation: new THREE.Quaternion(),
          floor: -Infinity, floorMesh: null, probeY: 0, probeX: 0, probeZ: 0,
          bounces: 0, sleeping: false, selected: false });
      }
    }
    this.root.updateWorldMatrix(true, true);
    this.root.getWorldPosition(this.origin);
    for (const p of this.parts) {
      p.node.matrixWorld.decompose(p.position, p.rotation, p.scale);
      p.position.add(this.delta.copy(p.offset).multiply(p.scale).applyQuaternion(p.rotation));
      if (p.name === 'head' || p.name.startsWith('knee') || p.name.startsWith('wrist')) {
        // The editable head profile lives BELOW the semantic bone. Measure its
        // cached geometry boxes once per incident so giant/skull/Roo heads all
        // bounce above the floor without a per-frame skin or vertex scan.
        this.bounds.makeEmpty();
        p.node.traverseVisible(node => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh || mesh.userData.characterRenderProxy) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            this.region.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
            this.bounds.union(this.region);
          }
        });
        if (!this.bounds.isEmpty()) {
          this.bounds.getCenter(p.position);
          p.node.worldToLocal(this.point.copy(p.position)); p.offset.copy(this.point);
          p.radius = this.bounds.getSize(this.delta).length() * .5 / Math.max(p.scale.x, p.scale.y, p.scale.z);
        }
      }
      p.floor = this.startFloor; p.floorMesh = this.startFloorMesh; p.probeY = p.position.y;
      p.probeX = p.position.x; p.probeZ = p.position.z;
      p.bounces = 0; p.sleeping = false;
    }
  }

  /** Exact restoration also covers interrupted recovery, warp and skin edits. */
  restore(): void {
    if (!this.applied) return;
    for (const p of this.parts) {
      if (!p.selected) continue;
      p.node.position.copy(p.localPosition);
      p.node.quaternion.copy(p.localRotation);
      p.node.scale.copy(p.localScale);
    }
    this.applied = false;
    this.root.updateWorldMatrix(true, true);
  }

  reset(): void {
    this.restore();
    this.pending = this.initialized = this.fatal = this.returning = false;
    this.age = this.returnT = 0;
    this.candidates.length = this.walls.length = 0;
    for (const p of this.parts) p.selected = false;
  }

  private launch(world: DebrisWorld): void {
    this.pending = false; this.initialized = true;
    this.age = this.returnT = this.probes = this.contacts = this.scan = 0;
    this.returning = false;
    const speed = Math.min(25, this.entryVelocity.length());
    const forward = this.delta.copy(this.entryVelocity).setY(0);
    if (forward.lengthSq() < .01) forward.set(0, 0, -1);
    forward.normalize();
    const fx = forward.x, fz = forward.z;
    for (const p of this.parts) {
      p.selected = this.style === 'yard-sale' || (this.style === 'head-pop' ? p.name === 'head'
        : this.style === 'waist-split' ? p.name === 'hips' || p.name === 'torso-root'
        : p.name === 'head' || p.name.startsWith('shoulder') || p.name.startsWith('knee'));
      if (!p.selected) continue;
      const side = p.name.endsWith('left') ? 1 : p.name.endsWith('right') ? -1 : (this.random() < .5 ? -1 : 1);
      if (this.startFloorMesh) p.position.y = Math.max(p.position.y,
        this.startFloor + p.radius * Math.max(p.scale.x, p.scale.y, p.scale.z) + .015);
      const splitLegs = this.style === 'waist-split' && p.name === 'hips';
      const carry = splitLegs ? .025 : this.style === 'head-pop' ? -.18 : .36 + this.random() * .18;
      const outward = splitLegs ? .1 : (1.2 + this.random() * 2.0) * side;
      p.velocity.set(fx * speed * carry - fz * outward,
        splitLegs ? 1.0 : 3.4 + this.random() * 2 + Math.min(2, speed * .06),
        fz * speed * carry + fx * outward);
      p.angular.set((2.5 + this.random() * 5) * fz, (this.random() - .5) * 7, -(2.5 + this.random() * 5) * fx);
      if (this.style === 'head-pop') p.angular.multiplyScalar(1.4);
      if (splitLegs) p.angular.multiplyScalar(.25);
    }
    // One broadphase on impact; bounded narrow phase thereafter. Bounds use
    // cached geometry boxes, never a vertex/skin scan or a complete scene walk.
    this.region.min.copy(this.origin).addScalar(-28);
    this.region.max.copy(this.origin).addScalar(28);
    this.region.min.y = world.killY - 4;
    this.candidates.length = this.walls.length = 0;
    for (const mesh of world.groundMeshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) continue;
      this.bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      if (this.region.intersectsBox(this.bounds)) this.candidates.push(mesh);
    }
    // Closest surfaces first: a large course cannot make every shard expensive.
    this.candidates.sort((a, b) => this.surfaceDistance(a) - this.surfaceDistance(b));
    this.candidates.length = Math.min(32, this.candidates.length);
    for (const wall of world.walls) if (this.region.intersectsBox(wall)) this.walls.push(wall);
    this.walls.sort((a, b) => a.distanceToPoint(this.origin) - b.distanceToPoint(this.origin));
    this.walls.length = Math.min(48, this.walls.length);
  }

  private surfaceDistance(mesh: THREE.Mesh): number {
    return this.bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).distanceToPoint(this.origin);
  }

  step(dt: number, world: DebrisWorld, recovering: boolean, timeLeft: number, bailing: boolean): void {
    this.lastProbes = 0;
    if (this.pending) this.launch(world);
    if (!this.initialized) return;
    this.age += dt;
    if (!this.fatal && !this.returning && (recovering || !bailing || this.age > 5)) {
      this.returning = true;
      this.returnT = 0;
      this.returnDuration = THREE.MathUtils.clamp(timeLeft * .88, .24, .58);
      for (const p of this.parts) {
        p.fromPosition.copy(p.position); p.fromRotation.copy(p.rotation);
      }
    }
    if (this.returning) {
      this.returnT += dt;
      if (this.returnT >= this.returnDuration) { this.reset(); return; }
    } else {
      for (const p of this.parts) {
        if (!p.selected || !p.sleeping || !p.floorMesh) continue;
        const crumble = world.crumbles[p.floorMesh.userData.crumbleId];
        if (!world.groundMeshes.includes(p.floorMesh) || crumble && (crumble.state === 'fall' || crumble.state === 'gone')) {
          p.sleeping = false; p.floor = -Infinity; p.floorMesh = null;
        }
      }
      // Two staggered downward probes per tick for the ENTIRE effect, including
      // nine-part fatal scatter. Sleeping parts recheck support at 6 Hz.
      for (let n = 0; n < this.parts.length && this.lastProbes < 2; n++) {
        const p = this.parts[this.scan++ % this.parts.length];
        if (!p.selected || p.sleeping && Math.floor(this.age * 6) === Math.floor((this.age - dt) * 6)) continue;
        this.probe(p, world);
      }
      for (const p of this.parts) if (p.selected) this.integrate(p, dt, world);
    }
    this.apply();
  }

  private probe(p: Part, world: DebrisWorld): void {
    this.lastProbes++; this.probes++;
    this.point.copy(p.position);
    this.point.y = Math.max(p.probeY, p.position.y) + p.radius * Math.max(p.scale.x, p.scale.y, p.scale.z) + .1;
    this.ray.set(this.point, DOWN); this.ray.far = 18;
    this.hits.length = 0;
    this.ray.intersectObjects(this.candidates, false, this.hits);
    p.floor = -Infinity; p.floorMesh = null;
    for (const hit of this.hits) {
      const crumble = world.crumbles[hit.object.userData.crumbleId];
      if (crumble && (crumble.state === 'fall' || crumble.state === 'gone')) continue;
      if (!world.groundMeshes.includes(hit.object as THREE.Mesh)) continue;
      this.normal.copy(hit.face?.normal ?? UP).applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
      if (this.normal.y < .35) continue;
      p.floor = hit.point.y; p.floorMesh = hit.object as THREE.Mesh; break;
    }
    p.probeY = p.position.y; p.probeX = p.position.x; p.probeZ = p.position.z;
    if (p.sleeping && (!p.floorMesh || Math.abs(p.position.y - p.floor - p.radius * Math.max(p.scale.x, p.scale.y, p.scale.z)) > .15)) p.sleeping = false;
  }

  private integrate(p: Part, dt: number, world: DebrisWorld): void {
    if (p.sleeping) return;
    const radius = p.radius * Math.max(p.scale.x, p.scale.y, p.scale.z);
    const oldY = p.position.y;
    this.point.copy(p.position);
    p.velocity.y -= 22 * dt;
    p.position.addScaledVector(p.velocity, dt);
    // Cheap swept face collision, using only nearby existing wall boxes.
    for (const box of this.walls) {
      if (p.position.y - radius > box.max.y || p.position.y + radius < box.min.y) continue;
      if (p.position.x + radius < box.min.x || p.position.x - radius > box.max.x || p.position.z + radius < box.min.z || p.position.z - radius > box.max.z) continue;
      if (this.point.z >= box.max.z + radius) { p.position.z = box.max.z + radius; p.velocity.z = Math.abs(p.velocity.z) * .48; }
      else if (this.point.z <= box.min.z - radius) { p.position.z = box.min.z - radius; p.velocity.z = -Math.abs(p.velocity.z) * .48; }
      else if (this.point.x >= box.max.x + radius) { p.position.x = box.max.x + radius; p.velocity.x = Math.abs(p.velocity.x) * .48; }
      else if (this.point.x <= box.min.x - radius) { p.position.x = box.min.x - radius; p.velocity.x = -Math.abs(p.velocity.x) * .48; }
    }
    const spin = p.angular.length();
    if (spin > .001) {
      this.angularQ.setFromAxisAngle(this.delta.copy(p.angular).multiplyScalar(1 / spin), spin * dt);
      p.rotation.premultiply(this.angularQ).normalize();
    }
    p.angular.multiplyScalar(Math.exp(-.5 * dt));
    const floorValid = p.floorMesh && world.groundMeshes.includes(p.floorMesh) &&
      Math.hypot(p.position.x - p.probeX, p.position.z - p.probeZ) < 1.8;
    if (floorValid && p.velocity.y < 0 && p.position.y <= p.floor + radius && oldY >= p.floor - radius) {
      p.position.y = p.floor + radius + .015;
      this.contacts++; p.bounces++;
      const impact = -p.velocity.y;
      p.velocity.y = impact * (.36 + .04 * this.variant);
      p.velocity.x *= .65; p.velocity.z *= .65; p.angular.multiplyScalar(.58);
      if (impact < 2.2 || p.bounces >= 4) { p.sleeping = true; p.velocity.set(0, 0, 0); p.angular.set(0, 0, 0); }
    }
    // Never let a prolonged abyss death grow unbounded transforms.
    if (p.position.y < world.killY - 12 || this.age > 7) { p.sleeping = true; p.velocity.set(0, 0, 0); }
  }

  private apply(): void {
    this.root.updateWorldMatrix(true, true);
    // Capture ALL targets before moving any parent. Otherwise children chase
    // a detached parent instead of the complete animation's destination.
    for (const p of this.parts) {
      if (!p.selected) continue;
      p.localPosition.copy(p.node.position); p.localRotation.copy(p.node.quaternion); p.localScale.copy(p.node.scale);
      p.node.matrixWorld.decompose(p.targetPosition, p.targetRotation, p.targetScale);
      p.targetPosition.add(this.delta.copy(p.offset).multiply(p.targetScale).applyQuaternion(p.targetRotation));
    }
    for (const p of this.parts) {
      if (!p.selected || !p.node.parent) continue;
      if (this.returning) {
        const t = this.returnT / this.returnDuration;
        const u = THREE.MathUtils.clamp((t - p.rank * .032) / (1 - p.rank * .032), 0, 1);
        const k = smooth(u);
        p.position.lerpVectors(p.fromPosition, p.targetPosition, k);
        // Lift clear of the floor, then dock hips -> limbs -> head. Finite
        // recoil closes exactly, even if mash shortens the original recovery.
        p.position.y += Math.sin(Math.PI * u) * (.3 + p.rank * .035) * (1 - u);
        p.rotation.slerpQuaternions(p.fromRotation, p.targetRotation, k);
        p.scale.lerp(p.targetScale, k);
      }
      this.point.copy(p.position).sub(this.delta.copy(p.offset).multiply(p.scale).applyQuaternion(p.rotation));
      this.matrix.compose(this.point, p.rotation, p.scale);
      p.node.parent.updateWorldMatrix(true, false);
      this.inverse.copy(p.node.parent.matrixWorld).invert();
      this.matrix.premultiply(this.inverse).decompose(p.node.position, p.node.quaternion, p.node.scale);
      p.node.updateWorldMatrix(false, true);
    }
    this.applied = true;
  }
}
