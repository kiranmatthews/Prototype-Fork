import * as THREE from 'three';

interface PickupVisual { mesh: THREE.Object3D; alive: boolean }
interface Row { pickup: PickupVisual; body: THREE.Mesh; visible: boolean }
interface Cell { mesh: THREE.InstancedMesh; rows: Row[] }

/** Presentation-only batches. Native pickup groups remain the gameplay,
 * deformation and editor owners; each draw copies their current pose. */
export class PickupVisualBatch {
 readonly root = new THREE.Group();
 private readonly cells: Cell[] = [];
 private readonly inverse = new THREE.Matrix4();
 private readonly matrix = new THREE.Matrix4();
 private disposed = false;
 constructor(parent: THREE.Object3D, pickups: readonly PickupVisual[]) {
  this.root.name = 'Floating fruit batches';
  this.root.userData.assetBatchRoot = true;
  parent.add(this.root);this.root.updateWorldMatrix(true, false);
  const groups = new Map<string, Row[]>();
  for (const pickup of pickups) {
   let body: THREE.Mesh | undefined;
   pickup.mesh.traverse(object => { if ((object as THREE.Mesh).isMesh && object.userData.milkBlob) body = object as THREE.Mesh; });
   if (!body || !body.visible || Array.isArray(body.material) || body.material.transparent || !body.morphTargetInfluences) continue;
   const p = pickup.mesh.position;
   const key = [Math.floor(p.x / 16), Math.floor(p.y / 12), Math.floor(p.z / 16),
    body.geometry.uuid, body.material.uuid, body.layers.mask, body.renderOrder,
    body.castShadow, body.receiveShadow, body.customDepthMaterial?.uuid].join(':');
   const rows = groups.get(key) ?? [];rows.push({ pickup, body, visible: body.visible });groups.set(key, rows);
  }
  for (const rows of groups.values()) {
   // A singleton gains nothing and would allocate an unnecessary morph table.
   if (rows.length < 2) continue;
   const source = rows[0].body;
   const mesh = new THREE.InstancedMesh(source.geometry, source.material, rows.length);
   source.getWorldPosition(mesh.position);this.root.worldToLocal(mesh.position);
   mesh.updateMatrix();mesh.matrixAutoUpdate = false;
   mesh.name = 'Batched floating fruit';mesh.userData.noWaterShore = true;
   mesh.layers.mask = source.layers.mask;mesh.renderOrder = source.renderOrder;
   mesh.customDepthMaterial = source.customDepthMaterial;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
   // Three allocates its table from count on the first write. Reserve the
   // full cell before compaction, so collection and respawn never resize it.
   mesh.setMorphAt(0, source);
   this.root.add(mesh);this.cells.push({ mesh, rows });
  }
  this.sync();
 }
 sync(): void {
  if (this.disposed) return;
  this.root.updateWorldMatrix(true, false);
  for (const { mesh, rows } of this.cells) {
   mesh.updateWorldMatrix(false, false);this.inverse.copy(mesh.matrixWorld).invert();
   let count = 0;
   for (const { pickup, body } of rows) {
    body.visible = false;
    if (!pickup.alive || !pickup.mesh.visible) continue;
    body.updateWorldMatrix(true, false);
    this.matrix.multiplyMatrices(this.inverse, body.matrixWorld);
    mesh.setMatrixAt(count, this.matrix);mesh.setMorphAt(count, body);count++;
   }
   mesh.count = count;mesh.visible = count > 0;
   // Follow the actual native flags after the app's shadow-policy pass.
   mesh.castShadow = rows[0].body.castShadow;mesh.receiveShadow = rows[0].body.receiveShadow;
   mesh.instanceMatrix.needsUpdate = true;
   if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
   if (count) mesh.computeBoundingSphere();
  }
 }
 get diagnostics(): { cells: number; capacity: number; visible: number; morphBytes: number } {
  return { cells: this.cells.length, capacity: this.cells.reduce((n,c) => n+c.rows.length,0),
   visible: this.cells.reduce((n,c) => n+c.mesh.count,0),
   morphBytes: this.cells.reduce((n,c) => n+(c.mesh.morphTexture?.image.data.byteLength??0),0) };
 }
 dispose(): void {
  if (this.disposed) return;
  this.disposed = true;
  for (const {mesh,rows} of this.cells) {
   for (const row of rows) row.body.visible = row.visible;
   mesh.dispose(); // instance buffers and morph table only; source art is shared
  }
  this.root.removeFromParent();this.root.clear();this.cells.length = 0;
 }
}
