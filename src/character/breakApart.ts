import * as THREE from 'three';
import {solidContact,type WorldSolids}from'../worldSolids';
import { characterElasticityAmplitudes } from '../animation/elasticity';

export type BreakApartStyle = 'head-pop' | 'waist-split' | 'loose-limbs' | 'yard-sale' | 'blast' | 'crush';
export interface BreakApartOptions {
  style?: BreakApartStyle;
  origin?: THREE.Vector3;
  impulse?: THREE.Vector3;
  strength?: number;
  seed?: number;
}
export type WipeoutDirection = 'forward' | 'back' | 'side' | 'air';
interface DebrisWorld {
  worldSolids?:WorldSolids;
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
  halfSize: THREE.Vector3;
  floorNormal: THREE.Vector3;
  floorPoint: THREE.Vector3;
  floorBounds: THREE.Box3;
  supportMatrix: THREE.Matrix4;
  impactAge: number;
  impactStrength: number;
  settleTime: number;
  elasticity: number;
  inherited: boolean;
  resting: boolean;
  restingRotation: THREE.Quaternion;
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
  private selectedCount = 0;
  private impactOrigin = new THREE.Vector3();
  private impulse = new THREE.Vector3();
  private hasImpactOrigin = false;
  private strength = 1;
  private groundSet = new Set<THREE.Mesh>();
  private groundCount = -1;
  private groundRefresh = -1;
  private surfaceBounds = new Map<THREE.Mesh, THREE.Box3>();
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
  private inverseQ = new THREE.Quaternion();
  private extent = new THREE.Vector3();
  private previous = new THREE.Vector3();
  private visualScale = new THREE.Vector3();
  private sweepNormal = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private normalMatrix = new THREE.Matrix3();
  private ray = new THREE.Raycaster();
  private hardContact=solidContact();
  private surfaceVelocity=new THREE.Vector3();
  private hits: THREE.Intersection[] = [];

  constructor(private readonly root: THREE.Object3D) {}

  get active(): boolean { return this.pending || this.initialized; }
  get preparing(): boolean { return this.pending; }
  get diagnostics() {
    return { active: this.active, style: this.style, variant: this.variant, fatal: this.fatal,
      phase: !this.active ? 'whole' : this.returning ? 'reassembling' : 'scattered',
      age: this.age, parts: this.selectedCount,
      candidates: this.candidates.length, walls: this.walls.length,
      sleeping: this.parts.filter(p => p.selected && p.sleeping).length,
      probes: this.probes, probesThisStep: this.lastProbes, contacts: this.contacts,
      returnProgress: this.returning ? Math.min(1, this.returnT / this.returnDuration) : 0 };
  }

  private random(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 0x100000000;
  }

  /** Same-tick collision refinement preserves entry momentum. An explicit
   * fatal blast/crush can interrupt a recoverable scatter without duplicating
   * skins or waiting for its recall to finish. Cosmetic RNG is incident-local. */
  request(kind: WipeoutDirection, velocity: THREE.Vector3, fatal = false,
    support?: { y: number; mesh?: THREE.Object3D } | null, options: BreakApartOptions = {}): void {
    if (this.pending && fatal && !options.style) { this.fatal = true; return; }
    let detached: Map<THREE.Object3D, { pivot: THREE.Vector3; rotation: THREE.Quaternion; scale: THREE.Vector3 }> | undefined;
    if (this.initialized) {
      if (!fatal || this.fatal) return;
      if (!options.style) { this.fatal = true; this.returning = false; return; }
      detached = new Map();
      for (const p of this.parts) if (p.selected) detached.set(p.node, {
        pivot: p.position.clone().sub(this.delta.copy(p.offset).multiply(p.scale).applyQuaternion(p.rotation)),
        rotation: p.rotation.clone(), scale: p.scale.clone(),
      });
      this.restore();
      this.initialized = false;
    }
    if (!this.pending) {
      this.restore();
      this.incident++;
      this.variant = options.seed === undefined ? this.incident % 3 : (options.seed >>> 0) % 3;
      this.seed = (options.seed ?? (0x6132ace ^ Math.imul(this.incident, 0x9e3779b1))) >>> 0;
      this.entryVelocity.copy(velocity);
      if (!Number.isFinite(this.entryVelocity.lengthSq())) this.entryVelocity.set(0, 0, 0);
      this.startFloor = support?.y ?? -Infinity;
      this.startFloorMesh = support?.mesh as THREE.Mesh ?? null;
      this.hasImpactOrigin = !!options.origin;
      if (options.origin) this.impactOrigin.copy(options.origin);
      this.impulse.copy(options.impulse ?? UP).multiplyScalar(options.impulse ? 1 : 0);
      this.strength = THREE.MathUtils.clamp(Number.isFinite(options.strength) ? options.strength! : 1, .3, 2);
    }
    if (options.origin) { this.hasImpactOrigin = true; this.impactOrigin.copy(options.origin); }
    if (options.impulse) this.impulse.copy(options.impulse);
    if (Number.isFinite(options.strength)) this.strength = THREE.MathUtils.clamp(options.strength!, .3, 2);
    if (!Number.isFinite(this.impulse.lengthSq())) this.impulse.set(0, 0, 0);
    if (!Number.isFinite(this.impactOrigin.lengthSq())) this.hasImpactOrigin = false;
    this.pending = true;
    this.fatal ||= fatal;
    this.style = options.style ?? (this.fatal ? 'yard-sale' : kind === 'back' ? 'head-pop' : kind === 'forward'
      ? 'waist-split' : kind === 'side' ? 'loose-limbs' : this.variant === 0 ? 'yard-sale' : 'loose-limbs');
    this.capture();
    if (detached) for (const p of this.parts) {
      const prior = detached.get(p.node);
      if (!prior || !p.selected) continue;
      p.inherited = true; p.floorMesh = null; p.floor = -Infinity; p.floorBounds.makeEmpty();
      p.rotation.copy(prior.rotation); p.scale.copy(prior.scale);
      p.position.copy(prior.pivot).add(this.delta.copy(p.offset).multiply(p.scale).applyQuaternion(p.rotation));
      p.probeY = p.position.y; p.probeX = p.position.x; p.probeZ = p.position.z;
    }
  }

  private selects(name: string): boolean {
    return this.style === 'yard-sale' || this.style === 'blast' || this.style === 'crush' ||
      (this.style === 'head-pop' ? name === 'head' : this.style === 'waist-split'
        ? name === 'hips' || name === 'torso-root'
        : name === 'head' || name.startsWith('shoulder') || name.startsWith('knee'));
  }

  private capture(): void {
    if (!this.parts.length) {
      for (const [name, x, y, z, radius, rank] of SOCKETS) {
        const node = this.root.getObjectByName(name);
        if (!node) continue;
        this.parts.push({ node, name, offset: new THREE.Vector3(x, y, z), radius, rank,
          halfSize: new THREE.Vector3(radius, radius, radius), floorNormal: new THREE.Vector3(0, 1, 0),
          floorPoint: new THREE.Vector3(), floorBounds: new THREE.Box3(), supportMatrix: new THREE.Matrix4(), impactAge: 1, impactStrength: 0, settleTime: 0, inherited: false, resting: false, restingRotation: new THREE.Quaternion(),
          elasticity: characterElasticityAmplitudes(this.fatal ? 'death' : 'bail')[name.startsWith('shoulder') ? 1 : name.startsWith('knee') ? 4 : 0],
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
    this.selectedCount = 0;
    for (const p of this.parts) { p.selected = this.selects(p.name); if (p.selected) this.selectedCount++; }
    for (const p of this.parts) {
      if (!p.selected) continue;
      p.node.matrixWorld.decompose(p.position, p.rotation, p.scale);
      // Measure an oriented local box once per incident, excluding other
      // detached semantic subtrees. A shin lies on its side, instead of
      // hovering on the old world-AABB diagonal sphere. No vertex/skin scan.
      this.bounds.makeEmpty();
      this.inverse.copy(p.node.matrixWorld).invert();
      const visit = (node: THREE.Object3D) => {
        if (!node.visible || node.userData.characterRenderProxy || node !== p.node && this.parts.some(other => other.selected && other.node === node)) return;
        const mesh = node as THREE.Mesh;
        if (mesh.isMesh) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          if (mesh.geometry.boundingBox) {
            this.matrix.multiplyMatrices(this.inverse, mesh.matrixWorld);
            this.region.copy(mesh.geometry.boundingBox).applyMatrix4(this.matrix);
            this.bounds.union(this.region);
          }
        }
        for (const child of node.children) visit(child);
      };
      visit(p.node);
      if (!this.bounds.isEmpty()) {
        this.bounds.getCenter(p.offset);
        this.bounds.getSize(p.halfSize).multiplyScalar(.5).max(this.delta.set(.025, .025, .025));
        p.radius = p.halfSize.length();
      }
      p.position.add(this.delta.copy(p.offset).multiply(p.scale).applyQuaternion(p.rotation));
      p.floor = this.startFloor; p.floorMesh = this.startFloorMesh; p.probeY = p.position.y;
      p.floorNormal.copy(UP); p.floorPoint.set(p.position.x, this.startFloor, p.position.z);
      p.floorBounds.makeEmpty();
      if (p.floorMesh) p.supportMatrix.copy(p.floorMesh.matrixWorld);
      p.probeX = p.position.x; p.probeZ = p.position.z;
      p.elasticity = characterElasticityAmplitudes(this.fatal ? 'death' : 'bail')[p.name.startsWith('shoulder') ? 1 : p.name.startsWith('knee') ? 4 : 0];
      p.bounces = 0; p.sleeping = false; p.settleTime = 0; p.impactAge = 1; p.inherited = false; p.resting = false;
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
    this.candidates.length = this.walls.length = this.selectedCount = 0;
    this.groundSet.clear(); this.surfaceBounds.clear(); this.groundCount = -1;
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
      if (!p.selected) continue;
      const side = p.name.endsWith('left') ? 1 : p.name.endsWith('right') ? -1 : (this.random() < .5 ? -1 : 1);
      if (this.startFloorMesh && !p.inherited) p.position.y = Math.max(p.position.y,
        this.startFloor + this.supportRadius(p, UP) + .008);
      const splitLegs = this.style === 'waist-split' && p.name === 'hips';
      const carry = splitLegs ? .025 : this.style === 'head-pop' ? -.18 : .36 + this.random() * .18;
      const outward = splitLegs ? .1 : (1.2 + this.random() * 2.0) * side;
      p.velocity.set(fx * speed * carry - fz * outward,
        splitLegs ? 1.0 : 3.4 + this.random() * 2 + Math.min(2, speed * .06),
        fz * speed * carry + fx * outward);
      p.angular.set((2.5 + this.random() * 5) * fz, (this.random() - .5) * 7, -(2.5 + this.random() * 5) * fx);
      if (this.style === 'head-pop') p.angular.multiplyScalar(1.4);
      if (splitLegs) p.angular.multiplyScalar(.25);
      if (this.style === 'blast') {
        // The source, not course forward, owns explosion direction. Low
        // fragments kick sideways; the upper pieces fan upward with mass cues.
        this.normal.copy(p.position).sub(this.hasImpactOrigin ? this.impactOrigin : this.origin);
        if (this.normal.lengthSq() < .01) this.normal.set(-fz * side, .2, fx * side);
        this.normal.y = Math.max(.18, this.normal.y);
        this.normal.normalize();
        const force = (5.5 + this.random() * 3) * this.strength;
        p.velocity.copy(this.entryVelocity).multiplyScalar(.28).addScaledVector(this.normal, force);
        p.velocity.y += 2.2;
        p.angular.multiplyScalar(1.15);
      } else if (this.style === 'crush') {
        // Flattened knock-out: a low radial splay, with no explosion-like
        // upward firework. Independent segment recoil supplies compression.
        this.normal.copy(p.position).sub(this.hasImpactOrigin ? this.impactOrigin : this.origin).setY(0);
        if (this.normal.lengthSq() < .01) this.normal.set(-fz * side, 0, fx * side);
        this.normal.normalize();
        p.velocity.copy(this.entryVelocity).multiplyScalar(.15).addScaledVector(this.normal, (2 + this.random() * 2.8) * this.strength);
        p.velocity.y = -.8 - this.random() * 1.2;
        p.angular.multiplyScalar(.45);
        p.impactAge = 0; p.impactStrength = 1;
      }
      p.velocity.add(this.impulse);
      p.velocity.clampLength(0, 24);
    }
    // Broadphase on impact/membership changes; bounded narrow phase. Bounds use
    // cached geometry boxes, never a vertex/skin scan or a complete scene walk.
    this.region.min.copy(this.origin).addScalar(-28);
    this.region.max.copy(this.origin).addScalar(28);
    this.region.min.y = world.killY - 4;
    this.walls.length = 0;
    this.refreshSupport(world, true);
    for (const wall of world.walls) if (this.region.intersectsBox(wall)) this.walls.push(wall);
    this.walls.sort((a, b) => a.distanceToPoint(this.origin) - b.distanceToPoint(this.origin));
    this.walls.length = Math.min(48, this.walls.length);
  }

  /** OBB support distance along an arbitrary contact normal. */
  private supportRadius(p: Part, direction: THREE.Vector3): number {
    this.inverseQ.copy(p.rotation).invert();
    this.extent.copy(direction).applyQuaternion(this.inverseQ);
    return Math.abs(this.extent.x * p.halfSize.x * p.scale.x) +
      Math.abs(this.extent.y * p.halfSize.y * p.scale.y) + Math.abs(this.extent.z * p.halfSize.z * p.scale.z);
  }

  private refreshCandidates(world: DebrisWorld): void {
    this.candidates.length = 0;
    this.surfaceBounds.clear();
    for (const mesh of world.groundMeshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) continue;
      this.bounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      if (this.region.intersectsBox(this.bounds)) {
        this.candidates.push(mesh);
        this.surfaceBounds.set(mesh, this.bounds.clone());
      }
    }
    this.candidates.sort((a, b) => this.surfaceBounds.get(a)!.distanceToPoint(this.origin) - this.surfaceBounds.get(b)!.distanceToPoint(this.origin));
    this.candidates.length = Math.min(32, this.candidates.length);
    for (const p of this.parts) if (p.floorMesh && this.surfaceBounds.has(p.floorMesh)) p.floorBounds.copy(this.surfaceBounds.get(p.floorMesh)!);
  }

  private refreshSupport(world: DebrisWorld, force = false): void {
    // Phase pads/outline floors can appear after launch, including replacement
    // by a different mesh with the same array length. Rebuild the bounded
    // broadphase only when membership changes; static settled frames stay cheap.
    let changed = force || this.groundCount !== world.groundMeshes.length;
    if (!changed) for (const mesh of world.groundMeshes) if (!this.groundSet.has(mesh)) { changed = true; break; }
    if (changed) {
      this.groundSet.clear();
      for (const mesh of world.groundMeshes) this.groundSet.add(mesh);
      this.refreshCandidates(world);
    }
    this.groundCount = world.groundMeshes.length;
    this.groundRefresh = Math.floor(this.age * 6);
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
      if (this.groundCount !== world.groundMeshes.length || this.groundRefresh !== Math.floor(this.age * 6)) this.refreshSupport(world);
      for (const p of this.parts) {
        if (!p.selected) continue;
        p.impactAge += dt;
        const crumble = p.floorMesh && world.crumbles[p.floorMesh.userData.crumbleId];
        if (p.floorMesh && (!this.groundSet.has(p.floorMesh) || crumble && (crumble.state === 'fall' || crumble.state === 'gone') || p.sleeping && !p.supportMatrix.equals(p.floorMesh.matrixWorld))) {
          p.sleeping = false; p.floor = -Infinity; p.floorMesh = null; p.settleTime = 0; p.resting = false;
        }
      }
      // At most two surface rays for the WHOLE effect. Static settled pieces
      // cost no raycasts; changed support membership wakes them above. Moving
      // support transforms wake them directly. Round-robin prevents starvation.
      for (let n = 0; n < this.parts.length && this.lastProbes < 2; n++) {
        const p = this.parts[this.scan++ % this.parts.length];
        if (!p.selected || p.sleeping) continue;
        this.probe(p, world);
      }
      for (const p of this.parts) if (p.selected) this.integrate(p, dt, world);
    }
    this.apply();
  }

  private probe(p: Part, world: DebrisWorld): void {
    this.lastProbes++; this.probes++;
    this.point.copy(p.position);
    const radius = this.supportRadius(p, UP);
    this.point.y = Math.max(p.probeY, p.position.y) + radius + .1;
    this.ray.set(this.point, DOWN); this.ray.far = 18;
    this.hits.length = 0;
    this.ray.intersectObjects(this.candidates, false, this.hits);
    p.floor = -Infinity; p.floorMesh = null;
    for (const hit of this.hits) {
      const crumble = world.crumbles[hit.object.userData.crumbleId];
      if (crumble && (crumble.state === 'fall' || crumble.state === 'gone')) continue;
      if (!this.groundSet.has(hit.object as THREE.Mesh)) continue;
      this.normal.copy(hit.face?.normal ?? UP).applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
      if (this.normal.y < .35 || hit.point.y > Math.max(p.probeY, p.position.y) + .02) continue;
      p.floor = hit.point.y; p.floorMesh = hit.object as THREE.Mesh;
      p.floorPoint.copy(hit.point); p.floorNormal.copy(this.normal); p.supportMatrix.copy(hit.object.matrixWorld);
      // Moving platforms can change transform while the effect is active.
      const bounds = this.surfaceBounds.get(p.floorMesh);
      if (bounds) { bounds.copy(p.floorMesh.geometry.boundingBox!).applyMatrix4(p.floorMesh.matrixWorld); p.floorBounds.copy(bounds); }
      break;
    }
    p.probeY = p.position.y; p.probeX = p.position.x; p.probeZ = p.position.z;
    if (p.sleeping && (!p.floorMesh || Math.abs(this.delta.copy(p.position).sub(p.floorPoint).dot(p.floorNormal) - this.supportRadius(p, p.floorNormal)) > .06)) {
      p.sleeping = false; p.settleTime = 0;
    }
  }

  private integrate(p: Part, dt: number, world: DebrisWorld): void {
    if (p.sleeping) return;
    this.previous.copy(p.position);
    p.velocity.y -= 22 * dt;
    p.position.addScaledVector(p.velocity, dt);
    const spin = p.angular.length();
    if (spin > .001) {
      this.angularQ.setFromAxisAngle(this.delta.copy(p.angular).multiplyScalar(1 / spin), spin * dt);
      p.rotation.premultiply(this.angularQ).normalize();
    }
    p.angular.multiplyScalar(Math.exp(-.65 * dt));
    if(world.worldSolids?.enabled){
      const radius=Math.hypot(p.halfSize.x*p.scale.x,p.halfSize.y*p.scale.y,p.halfSize.z*p.scale.z);
      if(world.worldSolids.resolve(this.previous,p.position,{low:0,high:0,radius,ignoreGround:true,supportRadius:n=>this.supportRadius(p,n)},this.hardContact)){
        const hit=this.hardContact;this.surfaceVelocity.copy(hit.surfaceDelta).multiplyScalar(1/Math.max(dt,1e-6));
        p.velocity.sub(this.surfaceVelocity);const inward=p.velocity.dot(hit.normal);
        if(inward<0)p.velocity.addScaledVector(hit.normal,-inward*1.35);
        p.velocity.add(this.surfaceVelocity);p.angular.multiplyScalar(.72);this.contacts++;
      }
    }
    // Swept expanded boxes catch thin walls even when a fast fragment crosses
    // the whole slab in a fixed tick. OBB projection keeps gloves/feet compact.
    const rx = this.walls.length ? this.supportRadius(p, this.normal.set(1, 0, 0)) : 0;
    const ry = this.walls.length ? this.supportRadius(p, UP) : 0;
    const rz = this.walls.length ? this.supportRadius(p, this.normal.set(0, 0, 1)) : 0;
    for (const box of world.worldSolids?.enabled?[]:this.walls) {
      let near = 0, far = 1;
      this.sweepNormal.set(0, 0, 0);
      for (let axis = 0; axis < 3; axis++) {
        const pad = axis === 0 ? rx : axis === 1 ? ry : rz;
        const from = this.previous.getComponent(axis), travel = p.position.getComponent(axis) - from;
        const low = box.min.getComponent(axis) - pad, high = box.max.getComponent(axis) + pad;
        if (Math.abs(travel) < 1e-8) { if (from < low || from > high) { far = -1; break; } continue; }
        let enter = (low - from) / travel, leave = (high - from) / travel;
        if (enter > leave) { const swap = enter; enter = leave; leave = swap; }
        if (enter > near) { near = enter; this.sweepNormal.set(0, 0, 0).setComponent(axis, travel > 0 ? -1 : 1); }
        far = Math.min(far, leave);
        if (near > far) break;
      }
      if (near > far || far < 0 || near > 1 || this.sweepNormal.lengthSq() === 0) continue;
      p.position.lerpVectors(this.previous, p.position, near).addScaledVector(this.sweepNormal, .008);
      const inward = p.velocity.dot(this.sweepNormal);
      if (inward < 0) p.velocity.addScaledVector(this.sweepNormal, -inward * 1.35);
      p.angular.multiplyScalar(.72);
      this.contacts++;
    }
    const floorValid = p.floorMesh && this.groundSet.has(p.floorMesh) &&
      p.position.x >= p.floorBounds.min.x && p.position.x <= p.floorBounds.max.x &&
      p.position.z >= p.floorBounds.min.z && p.position.z <= p.floorBounds.max.z &&
      Math.hypot(p.position.x - p.probeX, p.position.z - p.probeZ) < .8;
    if (floorValid) {
      const extent = this.supportRadius(p, p.floorNormal);
      const clearance = this.delta.copy(p.position).sub(p.floorPoint).dot(p.floorNormal) - extent;
      const inward = p.velocity.dot(p.floorNormal);
      if (clearance <= .01 && inward <= .5) {
        p.position.addScaledVector(p.floorNormal, .008 - clearance);
        const impact = Math.max(0, -inward);
        if (impact > 1.2) {
          this.contacts++; p.bounces++;
          p.impactAge = 0; p.impactStrength = Math.min(1, impact / 9);
        }
        const rebound = impact > 2 && p.bounces < 4 ? .30 + .035 * this.variant : 0;
        p.velocity.addScaledVector(p.floorNormal, impact * (1 + rebound));
        // Coulomb-like tangent damping: finite stops without friction that
        // changes with the caller's tick rate, including on sloped support.
        this.delta.copy(p.velocity).addScaledVector(p.floorNormal, -p.velocity.dot(p.floorNormal));
        const tangent = this.delta.length();
        if (tangent > 1e-5) p.velocity.addScaledVector(this.delta, -Math.min(1, (impact * .32 + 9 * dt) / tangent));
        p.angular.multiplyScalar(Math.exp(-10 * dt) * (impact > 1.2 ? .6 : 1));
        if (rebound === 0 && p.velocity.lengthSq() < 9 && p.angular.lengthSq() < 16) {
          if (!p.resting) this.chooseRestingFace(p);
          // Contact torque tips a low-energy fragment onto a broad face over
          // a finite interval. Never freeze a shin balanced on its OBB corner.
          p.rotation.rotateTowards(p.restingRotation, 3.8 * dt);
          p.angular.set(0, 0, 0);
          const support = this.supportRadius(p, p.floorNormal);
          const distance = this.delta.copy(p.position).sub(p.floorPoint).dot(p.floorNormal);
          p.position.addScaledVector(p.floorNormal, support + .008 - distance);
        } else p.resting = false;
        if (p.velocity.lengthSq() < .12 && p.angular.lengthSq() < .12 && p.floorNormal.y > .72 && p.resting && p.rotation.angleTo(p.restingRotation) < .001) p.settleTime += dt;
        else p.settleTime = 0;
        if (p.settleTime >= .18) { p.sleeping = true; p.velocity.set(0, 0, 0); p.angular.set(0, 0, 0); }
      } else { p.settleTime = 0; p.resting = false; }
    } else { p.settleTime = 0; p.resting = false; }
    // Never let a prolonged abyss death grow unbounded transforms.
    if (p.position.y < world.killY - 12 || this.age > 7) { p.sleeping = true; p.velocity.set(0, 0, 0); p.angular.set(0, 0, 0); }
  }

  private chooseRestingFace(p: Part): void {
    this.extent.copy(p.halfSize).multiply(p.scale);
    const shortest = Math.min(this.extent.x, this.extent.y, this.extent.z);
    let best = -Infinity;
    this.sweepNormal.set(0, 1, 0);
    for (let axis = 0; axis < 3; axis++) {
      // Prefer low potential energy (a broad face). Among similar dimensions,
      // use the nearest face so round heads retain varied, natural headings.
      if (this.extent.getComponent(axis) > shortest * 1.35) continue;
      this.normal.set(0, 0, 0).setComponent(axis, 1).applyQuaternion(p.rotation);
      const alignment = this.normal.dot(p.floorNormal);
      if (Math.abs(alignment) > best) {
        best = Math.abs(alignment);
        this.sweepNormal.copy(this.normal).multiplyScalar(alignment < 0 ? -1 : 1);
      }
    }
    this.angularQ.setFromUnitVectors(this.sweepNormal, p.floorNormal);
    p.restingRotation.copy(p.rotation).premultiply(this.angularQ).normalize();
    p.resting = true;
  }

  private apply(): void {
    this.root.updateWorldMatrix(true, true);
    // Capture ALL targets before moving any parent. Otherwise children chase
    // a detached parent instead of the complete animation's destination.
    for (const p of this.parts) {
      if (!p.selected) continue;
      p.localPosition.copy(p.node.position); p.localRotation.copy(p.node.quaternion); p.localScale.copy(p.node.scale);
      if (this.returning) {
        p.node.matrixWorld.decompose(p.targetPosition, p.targetRotation, p.targetScale);
        p.targetPosition.add(this.delta.copy(p.offset).multiply(p.targetScale).applyQuaternion(p.targetRotation));
      }
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
      this.visualScale.copy(p.scale);
      // A short compression/rebound uses the shared editable segment profile;
      // each detached semantic piece deforms independently, never the rig root.
      const beat = p.impactAge / .26;
      if (!this.returning && beat < 1) {
        const pulse = Math.sin(beat * Math.PI * 2) * (1 - beat) * p.elasticity * p.impactStrength;
        this.visualScale.y *= 1 - pulse;
        this.visualScale.x *= 1 + pulse * .5; this.visualScale.z *= 1 + pulse * .5;
      }
      this.point.copy(p.position).sub(this.delta.copy(p.offset).multiply(this.visualScale).applyQuaternion(p.rotation));
      this.matrix.compose(this.point, p.rotation, this.visualScale);
      p.node.parent.updateWorldMatrix(true, false);
      this.inverse.copy(p.node.parent.matrixWorld).invert();
      this.matrix.premultiply(this.inverse).decompose(p.node.position, p.node.quaternion, p.node.scale);
      // Update only this joint here. The following parent lookup recomputes
      // its ancestor path; one final traversal updates all render descendants.
      p.node.updateWorldMatrix(false, false);
    }
    this.root.updateWorldMatrix(false, true);
    this.applied = true;
  }
}
