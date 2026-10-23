import * as THREE from 'three';

export type BreakableKind = 'glass' | 'sign';
type Member = { mesh: THREE.Mesh; bounds: THREE.Box3; visible: boolean };
export type BreakableObject = {
  id: number; kind: BreakableKind; members: Member[]; bounds: THREE.Box3; broken: boolean;
};
type Vertex = { p: THREE.Vector3; uv: THREE.Vector2; color: THREE.Vector3 };
type Triangle = [Vertex, Vertex, Vertex];
type Shard = { local: THREE.Vector3[]; center: THREE.Vector3; velocity: THREE.Vector3;
  axis: THREE.Vector3; spin: number; rotation: THREE.Quaternion };
type Batch = { mesh: THREE.Mesh; shards: Shard[]; age: number; opacity: number };

// Swept AABB against a static box. Testing the segment, rather than its enclosing
// box, prevents diagonal near-misses from breaking a neighbouring sign.
function sweptContact(body: THREE.Box3, from: THREE.Vector3, to: THREE.Vector3, target: THREE.Box3): boolean {
  let enter = 0, leave = 1;
  for (const axis of ['x', 'y', 'z'] as const) {
    const delta = to[axis] - from[axis], half = (body.max[axis] - body.min[axis]) * .5;
    const start = (body.max[axis] + body.min[axis]) * .5 - delta;
    const low = target.min[axis] - half, high = target.max[axis] + half;
    if (Math.abs(delta) < 1e-10) { if (start < low || start > high) return false; }
    else {
      const a = (low - start) / delta, b = (high - start) / delta;
      enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
      if (enter > leave) return false;
    }
  }
  return true;
}

const midpoint = (a: Vertex, b: Vertex): Vertex => ({
  p: a.p.clone().lerp(b.p, .5), uv: a.uv.clone().lerp(b.uv, .5), color: a.color.clone().lerp(b.color, .5),
});

/** Nonblocking authored scenery. Original meshes/materials remain level-owned;
 * only temporary shard geometry and cloned materials belong to this owner. */
export class BreakableScenery {
  readonly root = new THREE.Group();
  readonly objects: BreakableObject[] = [];
  onBreak: ((kind: BreakableKind, position: THREE.Vector3) => void) | null = null;
  private readonly groups = new Map<number, BreakableObject>();
  private readonly batches: Batch[] = [];
  private readonly scratch = new THREE.Vector3();
  get brokenCount(): number { return this.objects.filter(object => object.broken).length; }
  get fragmentCount(): number { return this.batches.reduce((n, batch) => n + batch.shards.length, 0); }

  add(mesh: THREE.Mesh, kind: BreakableKind, group?: number): void {
    mesh.updateWorldMatrix(true, false); mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    const id = group ?? -this.objects.length - 1;
    let object = this.groups.get(id);
    if (!object) {
      object = { id, kind, members: [], bounds: new THREE.Box3(), broken: false };
      this.objects.push(object); this.groups.set(id, object);
    }
    object.members.push({ mesh, bounds, visible: mesh.visible }); object.bounds.union(bounds);
  }

  touch(body: THREE.Box3, from: THREE.Vector3, to: THREE.Vector3): void {
    if (body.isEmpty()) return;
    for (const object of this.objects) {
      if (object.broken || !sweptContact(body, from, to, object.bounds) ||
          !object.members.some(member => sweptContact(body, from, to, member.bounds))) continue;
      object.broken = true;
      const travel = new THREE.Vector3().subVectors(to, from).normalize();
      for (const member of object.members) {
        member.mesh.visible = false; this.shatter(member.mesh, object.kind, travel);
      }
      this.onBreak?.(object.kind, object.bounds.getCenter(this.scratch));
    }
  }

  private shatter(source: THREE.Mesh, kind: BreakableKind, travel: THREE.Vector3): void {
    const geometry = source.geometry, positions = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv'), colors = geometry.getAttribute('color'), index = geometry.index;
    const count = (index?.count ?? positions.count) / 3, triangles: Triangle[] = [];
    const vertex = (i: number): Vertex => ({
      p: new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(source.matrixWorld),
      uv: uv ? new THREE.Vector2(uv.getX(i), uv.getY(i)) : new THREE.Vector2(),
      color: colors ? new THREE.Vector3().fromBufferAttribute(colors, i) : new THREE.Vector3(1, 1, 1),
    });
    // Bounded even for large imported surfaces. Mall's source objects all fit;
    // subdivision turns the original four-triangle signs into smaller pieces.
    for (let i = 0; i < count; i += Math.max(1, Math.ceil(count / 64))) {
      triangles.push([0, 1, 2].map(k => vertex(index ? index.getX(i * 3 + k) : i * 3 + k)) as Triangle);
    }
    while (triangles.length < 64) {
      let longest = .7 * .7, triangle = -1, edge = 0;
      triangles.forEach((t, i) => t.forEach((v, j) => {
        const length = v.p.distanceToSquared(t[(j + 1) % 3].p);
        if (length > longest) { longest = length; triangle = i; edge = j; }
      }));
      if (triangle < 0) break;
      const t = triangles[triangle], a = t[edge], b = t[(edge + 1) % 3], c = t[(edge + 2) % 3], m = midpoint(a, b);
      triangles.splice(triangle, 1, [a, m, c], [m, b, c]);
    }
    if (!triangles.length) return;
    const positionData: number[] = [], uvData: number[] = [], colorData: number[] = [], shards: Shard[] = [];
    const center = new THREE.Box3().setFromObject(source).getCenter(new THREE.Vector3());
    triangles.forEach((t, i) => {
      const p = t.reduce((sum, v) => sum.add(v.p), new THREE.Vector3()).multiplyScalar(1 / 3);
      const side = p.clone().sub(center).multiplyScalar(.35);
      const seed = (i + 1) * 2.399963229728653;
      shards.push({ local: t.map(v => v.p.clone().sub(p)), center: p,
        velocity: travel.clone().multiplyScalar(kind === 'glass' ? 6 : 4).add(side).add(new THREE.Vector3(Math.sin(seed), 2 + Math.cos(seed) * 1.2, Math.cos(seed))),
        axis: new THREE.Vector3(Math.sin(seed), .6, Math.cos(seed)).normalize(), spin: 1.5 + (i % 5) * .4,
        rotation: new THREE.Quaternion() });
      t.forEach(v => { positionData.push(...v.p.toArray()); uvData.push(...v.uv.toArray()); colorData.push(...v.color.toArray()); });
    });
    const fragments = new THREE.BufferGeometry();
    fragments.setAttribute('position', new THREE.Float32BufferAttribute(positionData, 3).setUsage(THREE.DynamicDrawUsage));
    fragments.setAttribute('uv', new THREE.Float32BufferAttribute(uvData, 2));
    if (colors) fragments.setAttribute('color', new THREE.Float32BufferAttribute(colorData, 3));
    fragments.computeVertexNormals();
    const original = Array.isArray(source.material) ? source.material[0] : source.material;
    const material = original.clone(); material.side = THREE.DoubleSide; material.transparent = true; material.depthWrite = false;
    const mesh = new THREE.Mesh(fragments, material); mesh.frustumCulled = false;
    mesh.name = `${kind} fragments`; mesh.userData.visualOnly = true;
    while (this.batches.length >= 16) this.removeBatch(0);
    this.batches.push({ mesh, shards, age: 0, opacity: material.opacity }); this.root.add(mesh);
  }

  update(dt: number): void {
    const step = Math.max(0, Math.min(dt, .1));
    for (let b = this.batches.length - 1; b >= 0; b--) {
      const batch = this.batches[b]; batch.age += step;
      if (batch.age >= .9) { this.removeBatch(b); continue; }
      const positions = batch.mesh.geometry.getAttribute('position');
      // Source polygons can span an entire doorway. Collapse each separated
      // fragment promptly so debris cannot cover the chase camera or rider.
      const shardScale = Math.max(.18, Math.exp(-7 * batch.age));
      batch.shards.forEach((shard, i) => {
        shard.velocity.y -= 20 * step; shard.center.addScaledVector(shard.velocity, step);
        shard.rotation.setFromAxisAngle(shard.axis, shard.spin * batch.age);
        shard.local.forEach((p, v) => {
          this.scratch.copy(p).multiplyScalar(shardScale).applyQuaternion(shard.rotation).add(shard.center);
          positions.setXYZ(i * 3 + v, this.scratch.x, this.scratch.y, this.scratch.z);
        });
      });
      positions.needsUpdate = true;
      if (!(batch.mesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial) batch.mesh.geometry.computeVertexNormals();
      (batch.mesh.material as THREE.Material).opacity = batch.opacity * Math.min(1, (.9 - batch.age) / .5);
    }
  }

  reset(hard: boolean): void {
    while (this.batches.length) this.removeBatch(this.batches.length - 1);
    // A fall keeps the current run's broken scenery, just like collected items.
    if (hard) for (const object of this.objects) {
      object.broken = false; for (const member of object.members) member.mesh.visible = member.visible;
    }
  }

  private removeBatch(index: number): void {
    const [batch] = this.batches.splice(index, 1);
    batch.mesh.removeFromParent(); batch.mesh.geometry.dispose();
    (batch.mesh.material as THREE.Material).dispose(); // borrowed texture maps are never disposed here
  }

  dispose(): void { this.reset(false); this.objects.length = 0; this.groups.clear(); this.root.removeFromParent(); this.onBreak = null; }
}
