import * as THREE from 'three';
import { RenderInterpolator } from '../renderInterpolation';
import { BoardFractures } from './fracture';
export interface BoardDebrisWorld {
    groundMeshes: THREE.Mesh[];
    killY: number;
    walls?: THREE.Box3[];
    crumbles: {
        state: string;
    }[];
}
export interface DiscardedBoard {
    root: THREE.Group;
    velocity: THREE.Vector3;
    angular: THREE.Vector3;
    remaining: number;
    rest: boolean;
    /** Latest player-held discard advances on that player's existing step. */
    external: boolean;
    stepped: boolean;
    breakStyle: 'none' | 'snap' | 'fold';
    bounds: THREE.Box3;
    broken: boolean;
    lastSpin: object | null;
    slots: BatchSlot[];
    /** World-space linear/angular velocity is measured at the centre of mass. */
    center: THREE.Vector3;
    halfSize: THREE.Vector3;
    inverseInertia: THREE.Vector3;
    supported: boolean;
    quietTime: number;
    contactTime: number;
    airTime: number;
    impactCooldown: number;
}
type Batch = {
    mesh: THREE.InstancedMesh;
    capacity: number;
    key: string;
    slots: BatchSlot[];
};
type BatchSlot = { batch: Batch; index: number; name: string };
const DOWN = new THREE.Vector3(0, -1, 0);
const UP = new THREE.Vector3(0, 1, 0);
const GRAVITY = 24;
const CONTACT_SKIN = .006;
const brake = (speed: number, amount: number) => Math.sign(speed) * Math.max(0, Math.abs(speed) - amount);
type SurfaceBounds = { mesh: THREE.Mesh; geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; bounds: THREE.Box3; epoch: number };
/** Level-owned decorative debris. Remounting releases the current discard;
 * it never recalls or deletes it. Sleeping pieces are spatially batched, so
 * accumulating boards do not accumulate per-frame physics or draw calls. */
export class DiscardedBoards {
    readonly root = new THREE.Group();
    onImpact: ((broken: boolean, speed: number) => void) | null = null;
    onSpinHit: ((position: THREE.Vector3, removed: boolean) => void) | null = null;
    private active = new Set<DiscardedBoard>();
    private bodies = new Set<DiscardedBoard>();
    private batches = new Map<string, Batch>();
    private fractures = new BoardFractures();
    private interpolation = new RenderInterpolator();
    private ray = new THREE.Raycaster();
    private point = new THREE.Vector3();
    private normal = new THREE.Vector3();
    private normalMatrix = new THREE.Matrix3();
    private frameBodies: DiscardedBoard[] = [];
    private frameRoots: THREE.Object3D[] = [];
    private hits: THREE.Intersection[] = [];
    private surfaceBounds = new WeakMap<THREE.Mesh, SurfaceBounds>();
    private epoch = 0;
    private preparedEpoch = -1;
    private candidates: SurfaceBounds[] = [];
    private wallCandidates: THREE.Box3[] = [];
    private region = new THREE.Box3();
    private soundCooldown = 0;
    private dirtyBatches = new Set<Batch>();
    private center = new THREE.Vector3();
    private previous = new THREE.Vector3();
    private previousExtent = new THREE.Vector3();
    private extent = new THREE.Vector3();
    private lever = new THREE.Vector3();
    private contactVelocity = new THREE.Vector3();
    private direction = new THREE.Vector3();
    private impulse = new THREE.Vector3();
    private torque = new THREE.Vector3();
    private axis = new THREE.Vector3();
    private forward = new THREE.Vector3();
    private sideways = new THREE.Vector3();
    private up = new THREE.Vector3();
    private rotation = new THREE.Quaternion();
    private inverseRotation = new THREE.Quaternion();
    private matrix = new THREE.Matrix4();
    private seed = 0x61c88647;
    private disposed = false;
    private thrown = 0;
    private snapped = 0;
    private folded = 0;
    private poofed = 0;
    private settled = 0;
    private lost = 0;
    constructor(private readonly random?: () => number) {
        this.root.name = 'discarded-board-pile';
        this.root.userData.editorGhost = true;
    }
    private roll(): number {
        if (this.random)
            return this.random();
        // Cosmetic stream only. Never consume the Player's deterministic RNG.
        this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
        return this.seed / 0x100000000;
    }
    spawn(source: THREE.Group): DiscardedBoard | null {
        if (this.disposed)
            return null;
        const root = source.clone(true);
        root.name = 'discarded-board';
        root.visible = true;
        source.getWorldPosition(root.position);
        source.getWorldQuaternion(root.quaternion);
        source.getWorldScale(root.scale);
        root.scale.y = root.scale.x;
        this.root.add(root);
        const chance = this.roll();
        const board = this.addBody(root, true, chance < 0.16 ? 'snap' : chance < 0.25 ? 'fold' : 'none');
        this.thrown++;
        return board;
    }
    private addBody(root: THREE.Group, external: boolean, breakStyle: DiscardedBoard['breakStyle'], broken = false, lastSpin: object | null = null): DiscardedBoard {
        const board: DiscardedBoard = { root, external, stepped: false, breakStyle, velocity: new THREE.Vector3(), angular: new THREE.Vector3(), remaining: 30, rest: false, bounds: this.localBounds(root), broken, lastSpin, slots: [],
            center: new THREE.Vector3(), halfSize: new THREE.Vector3(), inverseInertia: new THREE.Vector3(),
            supported: false, quietTime: 0, contactTime: 0, airTime: 1, impactCooldown: 0 };
        this.measureBody(board);
        this.active.add(board);
        this.bodies.add(board);
        this.preparedEpoch = -1;
        return board;
    }

    /** One gesture can break a whole board OR clear fragments, never both. */
    spinAttack(box: THREE.Box3, token: object): number {
        if (this.disposed) return 0;
        let hits = 0;
        const worldBounds = new THREE.Box3();
        for (const board of [...this.bodies]) {
            if (board.lastSpin === token) continue;
            board.root.updateWorldMatrix(true, false);
            worldBounds.copy(board.bounds).applyMatrix4(board.root.matrixWorld);
            if (!box.intersectsBox(worldBounds)) continue;
            board.lastSpin = token;
            const position = worldBounds.getCenter(new THREE.Vector3());
            if (board.broken) {
                this.retire(board);
                this.poofed++;
                this.onSpinHit?.(position, true);
            } else {
                if (board.rest) this.wake(board);
                board.breakStyle = 'snap';
                this.breakBoard(board, 5);
                this.onSpinHit?.(position, false);
            }
            hits++;
        }
        return hits;
    }

    private removeSlots(board: DiscardedBoard): void {
        const matrix = new THREE.Matrix4();
        for (const slot of board.slots) {
            const batch = slot.batch;
            const last = batch.slots.pop()!;
            batch.mesh.count--;
            if (last !== slot) {
                batch.mesh.getMatrixAt(last.index, matrix);
                batch.mesh.setMatrixAt(slot.index, matrix);
                last.index = slot.index;
                batch.slots[slot.index] = last;
            }
            batch.mesh.instanceMatrix.needsUpdate = true;
            if (batch.mesh.count === 0) {
                batch.mesh.removeFromParent();
                batch.mesh.dispose();
                this.batches.delete(batch.key);
            } else batch.mesh.computeBoundingSphere();
        }
        board.slots = [];
        this.settled--;
    }

    private wake(board: DiscardedBoard): void {
        this.root.add(board.root);
        board.root.updateWorldMatrix(true, false);
        const inverse = board.root.matrixWorld.clone().invert();
        const matrix = new THREE.Matrix4();
        // Recover only this board's small transform hierarchy from its batches.
        // Sleeping piles still retain no per-mesh scene graph or physics work.
        for (const slot of board.slots) {
            slot.batch.mesh.updateWorldMatrix(true, false);
            slot.batch.mesh.getMatrixAt(slot.index, matrix);
            matrix.premultiply(slot.batch.mesh.matrixWorld).premultiply(inverse);
            const mesh = new THREE.Mesh(slot.batch.mesh.geometry, slot.batch.mesh.material);
            mesh.name = slot.name;
            matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
            board.root.add(mesh);
        }
        this.removeSlots(board);
        board.rest = false;
        board.supported = false; board.quietTime = board.contactTime = 0; board.airTime = 1;
        board.external = false;
        board.remaining = 30;
        this.active.add(board);
    }

    private retire(board: DiscardedBoard): void {
        if (board.slots.length) this.removeSlots(board);
        board.root.visible = false;
        board.velocity.set(0, 0, 0); board.angular.set(0, 0, 0);
        board.root.clear();
        board.root.removeFromParent();
        board.rest = true;
        this.active.delete(board);
        this.bodies.delete(board);
    }
    release(board: DiscardedBoard | null): void {
        if (board)
            board.external = false;
    }
    /** Continue released boards even if their original player dies or leaves P2. */
    update(dt: number, world: BoardDebrisWorld): void {
        // A reusable snapshot keeps new fragments out of the current iteration.
        // Once asleep, a pile incurs no queries, integration or pose allocations.
        this.frameBodies.length = 0;
        for (const board of this.active) this.frameBodies.push(board);
        for (const board of this.frameBodies) {
            if (!board.stepped) this.step(board, dt, world);
            board.stepped = false;
        }
        this.frameBodies.length = this.frameRoots.length = 0;
        for (const board of this.active) this.frameRoots.push(board.root);
        this.interpolation.capture(this.frameRoots);
        for (const batch of this.dirtyBatches) if (batch.mesh.parent) batch.mesh.computeBoundingSphere();
        this.dirtyBatches.clear();
        this.soundCooldown = Math.max(0, this.soundCooldown - dt);
        this.epoch++;
    }
    step(board: DiscardedBoard, dt: number, world: BoardDebrisWorld): void {
        if (this.disposed || !board.root.visible) return;
        board.stepped = true;
        board.remaining -= dt;
        if (board.rest || dt <= 0) return;
        // The game uses 60 Hz. Bound the same solver for larger caller steps,
        // rather than allowing a slow frame to tunnel through a thin platform.
        const steps = Math.min(8, Math.ceil(dt * 60));
        const h = Math.min(dt, 8 / 60) / steps;
        for (let i = 0; i < steps && !board.rest; i++) this.integrate(board, h, world);
    }

    private measureBody(board: DiscardedBoard): void {
        board.bounds.getCenter(board.center);
        board.bounds.getSize(board.halfSize).multiply(board.root.scale).multiplyScalar(.5);
        const h = board.halfSize;
        // Unit mass box inertia, measured once from the actual deck/pieces.
        board.inverseInertia.set(3 / Math.max(.002, h.y*h.y + h.z*h.z),
            3 / Math.max(.002, h.x*h.x + h.z*h.z), 3 / Math.max(.002, h.x*h.x + h.y*h.y));
    }
    private placeRoot(board: DiscardedBoard): void {
        this.point.copy(board.center).multiply(board.root.scale).applyQuaternion(board.root.quaternion);
        board.root.position.copy(this.center).sub(this.point);
    }
    private supportRadius(board: DiscardedBoard, normal: THREE.Vector3): number {
        this.inverseRotation.copy(board.root.quaternion).invert();
        this.extent.copy(normal).applyQuaternion(this.inverseRotation);
        const h = board.halfSize, e = this.extent;
        return Math.abs(e.x)*h.x + Math.abs(e.y)*h.y + Math.abs(e.z)*h.z;
    }
    private inverseInertia(board: DiscardedBoard, vector: THREE.Vector3): THREE.Vector3 {
        return vector.applyQuaternion(this.inverseRotation).multiply(board.inverseInertia).applyQuaternion(board.root.quaternion);
    }
    private contactLever(board: DiscardedBoard): void {
        const e = this.extent, h = board.halfSize;
        // A face contact uses its centre; an edge/corner uses its actual lever.
        // This avoids choosing a random corner on an already flat board.
        this.lever.set(Math.abs(e.x) < .025 ? 0 : -Math.sign(e.x)*h.x,
            Math.abs(e.y) < .025 ? 0 : -Math.sign(e.y)*h.y,
            Math.abs(e.z) < .025 ? 0 : -Math.sign(e.z)*h.z).applyQuaternion(board.root.quaternion);
    }
    private applyImpulse(board: DiscardedBoard, direction: THREE.Vector3, magnitude: number): void {
        this.impulse.copy(direction).multiplyScalar(magnitude);
        board.velocity.add(this.impulse);
        this.torque.crossVectors(this.lever, this.impulse);
        board.angular.add(this.inverseInertia(board, this.torque));
    }
    private effectiveMass(board: DiscardedBoard, direction: THREE.Vector3): number {
        this.torque.crossVectors(this.lever, direction);
        this.inverseInertia(board, this.torque).cross(this.lever);
        return 1 + Math.max(0, this.torque.dot(direction));
    }
    private impact(board: DiscardedBoard, speed: number, broken = false): void {
        // Only energetic contact edges make sound. Static support and tiny
        // rebounds are silent; a pile of fragments cannot stack many voices.
        if (speed < 1.8 || board.impactCooldown > 0 || this.soundCooldown > 0) return;
        board.impactCooldown = .12;
        this.soundCooldown = .055;
        this.onImpact?.(broken, speed);
    }
    private integrate(board: DiscardedBoard, dt: number, world: BoardDebrisWorld): void {
        const root = board.root, velocity = board.velocity, angular = board.angular;
        board.impactCooldown = Math.max(0, board.impactCooldown - dt);
        this.prepareSurfaces(world);
        this.previous.copy(board.center).multiply(root.scale).applyQuaternion(root.quaternion).add(root.position);
        this.center.copy(this.previous);
        if (this.wallCandidates.length) {
            this.previousExtent.set(this.supportRadius(board, this.axis.set(1, 0, 0)),
                this.supportRadius(board, UP), this.supportRadius(board, this.axis.set(0, 0, 1)));
        }
        velocity.y -= GRAVITY * dt;
        this.center.addScaledVector(velocity, dt);
        // World angular velocity + quaternion integration, about the centre of
        // mass rather than the old wheel/root pivot and ordered Euler angles.
        angular.multiplyScalar(Math.exp(-.12 * dt));
        const spin = angular.length();
        if (spin > .0001) {
            this.axis.copy(angular).multiplyScalar(1 / spin);
            this.rotation.setFromAxisAngle(this.axis, spin * dt);
            root.quaternion.premultiply(this.rotation).normalize();
        }
        this.placeRoot(board);
        if (root.position.y < world.killY - 8 || board.remaining < -15) {
            this.retire(board); this.lost++; return;
        }
        if (this.collideWalls(board)) return;
        const floor = this.findFloor(board, world);
        if (floor === null) {
            board.supported = false; board.quietTime = board.contactTime = 0;
            board.airTime += dt; return;
        }
        const radius = this.supportRadius(board, this.normal);
        const distance = (this.center.y - floor) * this.normal.y;
        if (distance > radius + CONTACT_SKIN + (board.supported ? .025 : 0)) {
            board.supported = false; board.quietTime = board.contactTime = 0;
            board.airTime += dt; return;
        }
        // Resolve along the real surface normal, including ramps. The ray's
        // plane is evaluated at the current XZ, so this is a signed distance.
        this.center.addScaledVector(this.normal, radius + CONTACT_SKIN - distance);
        this.contactLever(board);
        this.contactVelocity.crossVectors(angular, this.lever).add(velocity);
        const closing = Math.max(0, -this.contactVelocity.dot(this.normal));
        const landing = !board.supported && board.airTime >= .045;
        if (landing && closing > 3.5 && board.breakStyle !== 'none') {
            this.placeRoot(board); this.impact(board, closing, true); this.breakBoard(board, closing); return;
        }
        if (landing) this.impact(board, closing);
        board.contactTime += dt;
        this.up.copy(UP).applyQuaternion(root.quaternion);
        const alignment = Math.abs(this.up.dot(this.normal));
        board.supported ||= alignment > .95 && Math.abs(velocity.dot(this.normal)) < 1.5 && angular.lengthSq() < 9;
        if (!board.supported) {
            const restitution = landing && closing > 2 ? .38 : 0;
            const impulse = closing * (1 + restitution) / this.effectiveMass(board, this.normal);
            this.applyImpulse(board, this.normal, impulse);
            this.contactVelocity.crossVectors(angular, this.lever).add(velocity);
            this.direction.copy(this.contactVelocity).addScaledVector(this.normal, -this.contactVelocity.dot(this.normal));
            const slip = this.direction.length();
            if (slip > .001) {
                this.direction.multiplyScalar(1 / slip);
                const friction = Math.min(slip / this.effectiveMass(board, this.direction), impulse * .48);
                this.applyImpulse(board, this.direction, -friction);
            }
            angular.multiplyScalar(Math.exp(-3.5 * dt));
            angular.clampLength(0, 32);
            board.supported = velocity.dot(this.normal) < 1.25 &&
                (alignment > .86 && angular.lengthSq() < 25 || board.contactTime > .16);
        }
        board.airTime = 0;
        if (board.supported) this.slide(board, dt, radius);
        this.placeRoot(board);
        if (board.quietTime >= .2) {
            velocity.set(0, 0, 0); angular.set(0, 0, 0); board.rest = true;
            this.sleep(board);
        }
    }

    private slide(board: DiscardedBoard, dt: number, previousRadius: number): void {
        const q = board.root.quaternion, v = board.velocity, n = this.normal;
        // Keep a brief rocking settle. Alignment never snaps, and the actual
        // oriented bounds keep either the wheels or upside-down deck grounded.
        this.up.copy(UP).applyQuaternion(q);
        const facingUp = this.up.dot(n) >= 0;
        this.axis.copy(n).multiplyScalar(facingUp ? 1 : -1);
        this.rotation.setFromUnitVectors(this.up, this.axis).multiply(q);
        q.slerp(this.rotation, 1 - Math.exp(-14 * dt));
        const yaw = board.angular.dot(n);
        board.angular.copy(n).multiplyScalar(yaw * Math.exp(-6 * dt));
        v.addScaledVector(n, -v.dot(n));
        this.forward.set(0, 0, 1).applyQuaternion(q);
        this.forward.addScaledVector(n, -this.forward.dot(n)).normalize();
        this.sideways.crossVectors(n, this.forward).normalize();
        const along = v.dot(this.forward), across = v.dot(this.sideways);
        const rolling = facingUp && !board.broken && this.up.dot(n) > .92;
        // Coulomb friction reaches an exact stop, unlike exponential drag's
        // endless tail. Wheels coast along the deck but resist sideways skid.
        v.copy(this.forward).multiplyScalar(brake(along, (rolling ? 1.8 + Math.abs(along) * .04 : 9) * dt));
        v.addScaledVector(this.sideways, brake(across, (rolling ? 11 : 9) * dt));
        const radius = this.supportRadius(board, n);
        // Rotation changed the support distance; preserve this same plane.
        this.center.addScaledVector(n, radius - previousRadius);
        this.up.copy(UP).applyQuaternion(q);
        if (v.lengthSq() < .012 && board.angular.lengthSq() < .035 && Math.abs(this.up.dot(n)) > .999)
            board.quietTime += dt;
        else board.quietTime = 0;
    }
    private findFloor(board: DiscardedBoard, world: BoardDebrisWorld): number | null {
        this.point.copy(this.center);
        // Do not see through ceilings. A floor must be below the previous
        // centre of mass, not anywhere in a 2.5 m column above the board.
        this.point.y = Math.max(this.previous.y, this.center.y) + .05;
        const radius = board.halfSize.length();
        this.ray.set(this.point, DOWN);
        this.ray.far = Math.max(0, this.point.y - this.center.y) + radius + .1;
        this.hits.length = 0;
        this.prepareSurfaces(world);
        for (const cached of this.candidates) {
            const mesh = cached.mesh;
            const crumble = world.crumbles[mesh.userData.crumbleId];
            if (crumble && (crumble.state === 'fall' || crumble.state === 'gone')) continue;
            const b = cached.bounds, p = this.point;
            if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z || p.y < b.min.y || p.y - this.ray.far > b.max.y) continue;
            this.ray.intersectObject(mesh, false, this.hits);
        }
        this.hits.sort((a, b) => a.distance - b.distance);
        let floor: number | null = null;
        for (const hit of this.hits) {
            this.normal.copy(hit.face?.normal ?? UP).applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
            if (this.normal.y < .15) continue;
            // Also reject the back/underside of double-sided ramp meshes.
            if (this.direction.copy(this.previous).sub(hit.point).dot(this.normal) < -.06) continue;
            floor = hit.point.y;
            break;
        }
        // Some authored barriers have a solid box without a ground-ray mesh.
        // Their tops must also catch boards, while overhead boxes stay ignored.
        for (const wall of this.wallCandidates) {
            const p = this.point, top = wall.max.y;
            if (p.x < wall.min.x || p.x > wall.max.x || p.z < wall.min.z || p.z > wall.max.z ||
                top > Math.min(p.y, this.previous.y + .05) || top < p.y - this.ray.far || floor !== null && top <= floor) continue;
            floor = top; this.normal.copy(UP);
        }
        return floor;
    }
    private prepareSurfaces(world: BoardDebrisWorld): void {
        if (this.preparedEpoch === this.epoch) return;
        this.preparedEpoch = this.epoch;
        this.region.makeEmpty(); this.candidates.length = this.wallCandidates.length = 0;
        for (const body of this.active) {
            const p = body.root.position;
            const margin = body.halfSize.length()*2 + body.velocity.length() * (8 / 60) + .5;
            this.region.min.x = Math.min(this.region.min.x, p.x - margin);
            this.region.max.x = Math.max(this.region.max.x, p.x + margin);
            this.region.min.z = Math.min(this.region.min.z, p.z - margin);
            this.region.max.z = Math.max(this.region.max.z, p.z + margin);
        }
        // One bounds pass per pile step, shared by all boards and fragments.
        // Moving matrices refresh here; no per-board whole-level raycasts.
        for (const mesh of world.groundMeshes) {
            let cached = this.surfaceBounds.get(mesh);
            if (!cached) {
                cached = { mesh, geometry: mesh.geometry, matrix: new THREE.Matrix4(), bounds: new THREE.Box3(), epoch: -1 };
                this.surfaceBounds.set(mesh, cached);
            }
            if (cached.epoch !== this.epoch) {
                if (cached.bounds.isEmpty() || cached.geometry !== mesh.geometry || !cached.matrix.equals(mesh.matrixWorld)) {
                    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
                    cached.bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
                    cached.matrix.copy(mesh.matrixWorld); cached.geometry = mesh.geometry;
                }
                cached.epoch = this.epoch;
            }
            const b = cached.bounds, r = this.region;
            if (b.max.x >= r.min.x && b.min.x <= r.max.x && b.max.z >= r.min.z && b.min.z <= r.max.z)
                this.candidates.push(cached);
        }
        if (world.walls) for (const wall of world.walls) {
            const r = this.region;
            if (wall.max.x >= r.min.x && wall.min.x <= r.max.x && wall.max.z >= r.min.z && wall.min.z <= r.max.z)
                this.wallCandidates.push(wall);
        }
    }
    private collideWalls(board: DiscardedBoard): boolean {
        if (!this.wallCandidates.length) return false;
        // Swept slab entry against existing solid barriers, with the oriented
        // board footprint. Only side entries count; a supported top is ground.
        const rx = this.supportRadius(board, this.axis.set(1, 0, 0));
        const ry = this.supportRadius(board, UP);
        const rz = this.supportRadius(board, this.axis.set(0, 0, 1));
        const dx = this.center.x - this.previous.x, dz = this.center.z - this.previous.z;
        let fraction = 2, nx = 0, nz = 0, plane = 0;
        for (const wall of this.wallCandidates) {
            for (let axis = 0; axis < 2; axis++) {
                const from = axis === 0 ? this.previous.x : this.previous.z;
                const to = axis === 0 ? this.center.x : this.center.z;
                const extent = axis === 0 ? rx : rz;
                const previousExtent = axis === 0 ? this.previousExtent.x : this.previousExtent.z;
                const low = axis === 0 ? wall.min.x : wall.min.z;
                const high = axis === 0 ? wall.max.x : wall.max.z;
                const sign = from < low ? -1 : from > high ? 1 : 0;
                if (!sign) continue;
                const boundary = sign < 0 ? low : high;
                const before = (from - boundary)*sign - previousExtent;
                const after = (to - boundary)*sign - extent;
                // Include swept rotation: an expanding nose can hit the wall
                // before the centre crosses the old expanded slab boundary.
                if (after > CONTACT_SKIN || before <= after) continue;
                const t = Math.max(0, before / (before - after));
                if (t > 1 || t >= fraction) continue;
                const cross = axis === 0 ? this.previous.z + dz*t : this.previous.x + dx*t;
                const crossExtent = axis === 0 ? rz : rx;
                if (cross < (axis === 0 ? wall.min.z : wall.min.x) - crossExtent ||
                    cross > (axis === 0 ? wall.max.z : wall.max.x) + crossExtent) continue;
                const y = this.previous.y + (this.center.y - this.previous.y)*t;
                if (y - ry >= wall.max.y - .025 || y + ry <= wall.min.y) continue;
                fraction = t; nx = axis === 0 ? sign : 0; nz = axis === 1 ? sign : 0; plane = boundary;
            }
        }
        if (fraction > 1) return false;
        this.normal.set(nx, 0, nz);
        this.center.lerpVectors(this.previous, this.center, fraction);
        if (nx) this.center.x = plane + nx*(rx + CONTACT_SKIN);
        else this.center.z = plane + nz*(rz + CONTACT_SKIN);
        const speed = Math.max(0, -board.velocity.dot(this.normal));
        board.velocity.addScaledVector(this.normal, speed * 1.4).multiplyScalar(.88);
        board.angular.multiplyScalar(.8); board.supported = false; board.contactTime = 0;
        this.placeRoot(board);
        if (speed > 3.5 && board.breakStyle !== 'none') {
            this.impact(board, speed, true); this.breakBoard(board, speed); return true;
        }
        this.impact(board, speed);
        return false;
    }
    private breakBoard(board: DiscardedBoard, impact: number): void {
        const style = board.breakStyle;
        board.breakStyle = 'none';
        board.broken = true;
        const halves = this.fractures.split(board.root);
        if (style === 'snap') {
            this.snapped++;
            for (let i = 0; i < 2; i++) {
                const half = halves[i];
                half.position.copy(board.root.position);
                half.quaternion.copy(board.root.quaternion);
                half.scale.copy(board.root.scale);
                const kick = new THREE.Vector3((this.roll() - 0.5) * 1.4, 0, i === 0 ? 1.4 : -1.4).applyQuaternion(board.root.quaternion);
                half.position.addScaledVector(kick, 0.045);
                this.root.add(half);
                const piece = this.addBody(half, false, 'none', true, board.lastSpin);
                piece.velocity.copy(board.velocity).multiplyScalar(0.45).add(kick);
                piece.velocity.y = Math.min(4, 1.5 + impact * 0.16);
                piece.angular.set((i === 0 ? 1 : -1) * 7, 3 + this.roll() * 4, (this.roll() - 0.5) * 8);
            }
            this.retire(board);
        }
        else {
            this.folded++;
            const pivot = Number(board.root.userData.gripTop ?? 0.2);
            board.root.clear();
            for (let i = 0; i < 2; i++) {
                const hinge = new THREE.Group();
                hinge.position.y = pivot;
                hinge.rotation.x = (i === 0 ? -1 : 1) * 0.95;
                halves[i].position.y = -pivot;
                hinge.add(halves[i]);
                board.root.add(hinge);
            }
            board.root.name = 'taco-board';
            board.bounds = this.localBounds(board.root);
            this.measureBody(board);
            board.supported = false; board.contactTime = 0; board.airTime = 1;
            board.velocity.multiplyScalar(0.4);
            board.velocity.y = Math.min(3, 1 + impact * 0.12);
            board.angular.multiplyScalar(0.4);
        }
    }
    private localBounds(root: THREE.Group): THREE.Box3 {
        root.updateWorldMatrix(true, true);
        const inverse = root.matrixWorld.clone().invert(), matrix = new THREE.Matrix4();
        const bounds = new THREE.Box3();
        root.traverseVisible(object => {
            const mesh = object as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry)
                return;
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            matrix.multiplyMatrices(inverse, mesh.matrixWorld);
            bounds.union(mesh.geometry.boundingBox!.clone().applyMatrix4(matrix));
        });
        return bounds;
    }
    private sleep(board: DiscardedBoard): void {
        board.root.updateWorldMatrix(true, true);
        const inverse = this.root.matrixWorld.clone().invert();
        const cell = `${Math.floor(board.root.position.x / 32)},${Math.floor(board.root.position.z / 32)}`;
        board.root.traverseVisible(object => {
            const source = object as THREE.Mesh;
            if (!source.isMesh || !source.geometry)
                return;
            const materials = Array.isArray(source.material) ? source.material : [source.material];
            const key = `${cell}:${source.geometry.id}:${materials.map(m => m.id).join(',')}`;
            let batch = this.batches.get(key);
            if (!batch || batch.mesh.count >= batch.capacity) {
                const capacity = batch ? batch.capacity * 2 : 16;
                const mesh = new THREE.InstancedMesh(source.geometry, source.material, capacity);
                mesh.name = 'resting-board-pieces';
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.raycast = () => { };
                mesh.count = batch?.mesh.count ?? 0;
                if (batch) {
                    mesh.instanceMatrix.array.set(batch.mesh.instanceMatrix.array);
                    batch.mesh.removeFromParent();
                    batch.mesh.dispose();
                }
                if (batch) { batch.mesh = mesh; batch.capacity = capacity; }
                else batch = { mesh, capacity, key, slots: [] };
                this.batches.set(key, batch);
                this.root.add(mesh);
            }
            const slot: BatchSlot = { batch, index: batch.mesh.count, name: source.name };
            batch.slots.push(slot);
            board.slots.push(slot);
            batch.mesh.setMatrixAt(batch.mesh.count++, this.matrix.multiplyMatrices(inverse, source.matrixWorld));
            batch.mesh.instanceMatrix.needsUpdate = true;
            this.dirtyBatches.add(batch);
        });
        // All GPU geometry/materials are borrowed by the batches; the transform
        // hierarchy can now go away. Never dispose a live skateboard's resources.
        board.root.clear();
        board.root.removeFromParent();
        this.active.delete(board);
        this.settled++;
    }
    applyRenderInterpolation(alpha: number): void { this.interpolation.apply(alpha); }
    restoreRenderPose(): void { this.interpolation.restore(); }
    get diagnostics(): {
        thrown: number;
        snapped: number;
        folded: number;
        active: number;
        settledPieces: number;
        batches: number;
        lost: number;
        poofed: number;
    } {
        return { thrown: this.thrown, snapped: this.snapped, folded: this.folded, active: this.active.size, settledPieces: this.settled, batches: this.batches.size, lost: this.lost, poofed: this.poofed };
    }
    /** Clear the current life without retiring the Level's reusable owner. */
    clear(): void {
        if (this.disposed)
            return;
        this.interpolation.snap();
        for (const body of this.bodies) {
            body.root.visible = false;
            body.root.clear();
            body.slots = [];
            body.rest = true;
            body.external = false;
        }
        this.active.clear();
        this.bodies.clear();
        this.frameBodies.length = this.frameRoots.length = this.hits.length = 0;
        this.dirtyBatches.clear(); this.soundCooldown = 0;
        this.surfaceBounds = new WeakMap(); this.candidates.length = this.wallCandidates.length = 0; this.preparedEpoch = -1;
        this.settled = 0;
        for (const { mesh } of this.batches.values())
            mesh.dispose();
        this.batches.clear();
        this.root.clear();
        this.thrown = this.snapped = this.folded = this.poofed = this.lost = 0;
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.clear();
        this.disposed = true;
        this.root.removeFromParent();
        this.fractures.dispose();
    }
}
