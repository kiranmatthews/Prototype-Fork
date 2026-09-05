import * as THREE from 'three';
import { RenderInterpolator } from '../renderInterpolation';
import { BoardFractures } from './fracture';
export interface BoardDebrisWorld {
    groundMeshes: THREE.Mesh[];
    killY: number;
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
}
type Batch = {
    mesh: THREE.InstancedMesh;
    capacity: number;
    key: string;
    slots: BatchSlot[];
};
type BatchSlot = { batch: Batch; index: number; name: string };
const DOWN = new THREE.Vector3(0, -1, 0);
/** Level-owned decorative debris. Remounting releases the current discard;
 * it never recalls or deletes it. Sleeping pieces are spatially batched, so
 * accumulating boards do not accumulate per-frame physics or draw calls. */
export class DiscardedBoards {
    readonly root = new THREE.Group();
    onImpact: ((broken: boolean) => void) | null = null;
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
        const board: DiscardedBoard = { root, external, stepped: false, breakStyle, velocity: new THREE.Vector3(), angular: new THREE.Vector3(), remaining: 30, rest: false, bounds: this.localBounds(root), broken, lastSpin, slots: [] };
        this.active.add(board);
        this.bodies.add(board);
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
        board.external = false;
        board.remaining = 30;
        this.active.add(board);
    }

    private retire(board: DiscardedBoard): void {
        if (board.slots.length) this.removeSlots(board);
        board.root.visible = false;
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
        for (const board of [...this.active]) {
            // Active players already stepped their latest board. Fill in released
            // boards and a disabled P2 without double-stepping either.
            if (!board.stepped)
                this.step(board, dt, world);
            board.stepped = false;
        }
        this.interpolation.capture([...this.active].map(board => board.root));
    }
    step(board: DiscardedBoard, dt: number, world: BoardDebrisWorld): void {
        if (this.disposed || !board.root.visible)
            return;
        board.stepped = true;
        board.remaining -= dt;
        if (board.rest)
            return;
        const root = board.root, velocity = board.velocity;
        const previousY = root.position.y;
        velocity.y -= 24 * dt;
        root.position.addScaledVector(velocity, dt);
        root.rotation.x += board.angular.x * dt;
        root.rotation.y += board.angular.y * dt;
        root.rotation.z += board.angular.z * dt;
        if (root.position.y < world.killY - 8 || board.remaining < -15) {
            this.retire(board);
            this.lost++;
            return;
        }
        if (velocity.y >= 0)
            return;
        // The board's own height owns this ray. A respawn on a distant/high
        // checkpoint must not change where a discarded board finds its floor.
        this.point.copy(root.position);
        this.point.y = Math.max(previousY, root.position.y) + 2.5;
        this.ray.set(this.point, DOWN);
        this.ray.far = Math.max(12, previousY - root.position.y + 4);
        const hits = this.ray.intersectObjects(world.groundMeshes, false);
        let floor: number | null = null;
        for (const hit of hits) {
            const crumble = world.crumbles[hit.object.userData.crumbleId];
            if (crumble && (crumble.state === 'fall' || crumble.state === 'gone'))
                continue;
            this.normal.copy(hit.face?.normal ?? THREE.Object3D.DEFAULT_UP)
                .applyNormalMatrix(this.normalMatrix.getNormalMatrix(hit.object.matrixWorld));
            if (this.normal.y < 0.1)
                continue;
            floor = hit.point.y;
            break;
        }
        if (floor === null || root.position.y > floor + 0.06)
            return;
        root.position.y = floor + 0.06;
        const impact = -velocity.y;
        if (impact > 3.5 && board.breakStyle !== 'none') {
            this.breakBoard(board, impact);
            this.onImpact?.(true);
            return;
        }
        if (impact > 2.2) {
            velocity.y = impact * 0.45;
            velocity.x *= 0.6;
            velocity.z *= 0.6;
            board.angular.multiplyScalar(0.55);
            this.onImpact?.(false);
            return;
        }
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion);
        const targetUp = this.normal.clone().multiplyScalar(up.dot(this.normal) < 0 ? -1 : 1);
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
        forward.addScaledVector(this.normal, -forward.dot(this.normal));
        if (forward.lengthSq() < 1e-6)
            forward.set(1, 0, 0).addScaledVector(this.normal, -this.normal.x);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(targetUp, forward).normalize();
        root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, targetUp, forward));
        let minimum = Infinity;
        for (const x of [board.bounds.min.x, board.bounds.max.x])
            for (const y of [board.bounds.min.y, board.bounds.max.y])
                for (const z of [board.bounds.min.z, board.bounds.max.z]) {
                    this.point.set(x, y, z).multiply(root.scale).applyQuaternion(root.quaternion);
                    minimum = Math.min(minimum, this.point.dot(this.normal));
                }
        root.position.y = floor - minimum / this.normal.y + 0.006;
        velocity.set(0, 0, 0);
        board.angular.set(0, 0, 0);
        board.rest = true;
        this.sleep(board);
        this.onImpact?.(false);
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
            mesh.geometry.computeBoundingBox();
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
                mesh.userData.noShadow = true;
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
            batch.mesh.setMatrixAt(batch.mesh.count++, new THREE.Matrix4().multiplyMatrices(inverse, source.matrixWorld));
            batch.mesh.instanceMatrix.needsUpdate = true;
            batch.mesh.computeBoundingSphere();
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
