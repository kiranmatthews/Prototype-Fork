import * as THREE from 'three';

/** The parts of a Level crate this presentation batch reads. */
export interface CrateShellSource {
  alive: boolean;
  art?: { kind: string; shell: THREE.Mesh };
}
interface Row { crate: CrateShellSource; shell: THREE.Mesh }
interface Cell { mesh: THREE.InstancedMesh; geometry: THREE.BufferGeometry; material: THREE.Material; rows: Row[] }

const defaultBeforeRender = THREE.Object3D.prototype.onBeforeRender;

/**
 * Presentation-only instancing for repeated crate shells.
 *
 * Native crates keep ownership of contacts, breaking, fracture, labels,
 * outlines and squash animation. Each frame copies the current world pose of
 * every intact shell into a small spatial instance cell, provided the shell
 * still uses its cell's exact geometry and material and is actually drawn.
 * Anything else (outline, broken, relabelled, swapped or explosive crates, and
 * singletons) is left to draw natively, unchanged. Geometry and materials are
 * the crates' own shared art: nothing is copied, decimated or resized.
 */
export class CrateShellBatch {
  readonly root = new THREE.Group();
  private readonly cells: Cell[] = [];
  private readonly inverse = new THREE.Matrix4();
  private readonly matrix = new THREE.Matrix4();
  private disposed = false;

  constructor(private readonly owner: THREE.Object3D, crates: readonly CrateShellSource[]) {
    this.root.name = 'Batched crate shells';
    this.root.userData.assetBatchRoot = true;
    this.root.userData.editorGhost = true;
    owner.add(this.root);
    this.root.updateWorldMatrix(true, false);
    const groups = new Map<string, Row[]>();
    const position = new THREE.Vector3();
    for (const crate of crates) {
      const art = crate.art;
      if (!art || art.kind === 'tnt' || art.kind === 'nitro') continue;
      const shell = art.shell;
      const material = shell.material;
      if (!shell.isMesh || !shell.visible || Array.isArray(material) || material.transparent ||
        shell.morphTargetInfluences?.length || (shell as THREE.Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh ||
        shell.onBeforeRender !== defaultBeforeRender) continue;
      shell.getWorldPosition(position);
      const key = [Math.floor(position.x / 16), Math.floor(position.y / 12), Math.floor(position.z / 16),
        shell.geometry.uuid, material.uuid, shell.layers.mask, shell.renderOrder,
        shell.castShadow, shell.receiveShadow, shell.customDepthMaterial?.uuid,
        shell.customDistanceMaterial?.uuid].join(':');
      const rows = groups.get(key) ?? [];
      rows.push({ crate, shell });
      groups.set(key, rows);
    }
    for (const rows of groups.values()) {
      if (rows.length < 2) continue; // a singleton gains nothing
      const source = rows[0].shell;
      const material = source.material as THREE.Material;
      const mesh = new THREE.InstancedMesh(source.geometry, material, rows.length);
      source.getWorldPosition(mesh.position);
      this.root.worldToLocal(mesh.position);
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      mesh.name = 'Batched crate shells';
      mesh.userData.editorGhost = true;
      mesh.userData.noWaterShore = true;
      mesh.userData.visualOnly = true;
      mesh.layers.mask = source.layers.mask;
      mesh.renderOrder = source.renderOrder;
      mesh.customDepthMaterial = source.customDepthMaterial;
      mesh.customDistanceMaterial = source.customDistanceMaterial;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.root.add(mesh);
      this.cells.push({ mesh, geometry: source.geometry, material, rows });
    }
    this.sync();
  }

  /** True when the shell and every ancestor up to the level root are visible. */
  private drawn(shell: THREE.Object3D): boolean {
    for (let at = shell.parent; at; at = at.parent) {
      if (!at.visible) return false;
      if (at === this.owner) return true;
    }
    return false;
  }

  sync(): void {
    if (this.disposed) return;
    this.root.updateWorldMatrix(true, false);
    for (const cell of this.cells) {
      const { mesh, rows } = cell;
      mesh.updateWorldMatrix(false, false);
      this.inverse.copy(mesh.matrixWorld).invert();
      let count = 0;
      for (const row of rows) {
        const { shell } = row;
        const batched = row.crate.alive && shell.geometry === cell.geometry &&
          shell.material === cell.material && this.drawn(shell);
        // Shells were all visible when batched and nothing else toggles them,
        // so a crate that leaves the batch draws exactly as it did before.
        shell.visible = !batched;
        if (!batched) continue;
        shell.updateWorldMatrix(true, false);
        this.matrix.multiplyMatrices(this.inverse, shell.matrixWorld);
        mesh.setMatrixAt(count++, this.matrix);
      }
      mesh.count = count;
      mesh.visible = count > 0;
      // Follow the native flags after the app's shadow-policy pass.
      mesh.castShadow = rows[0].shell.castShadow;
      mesh.receiveShadow = rows[0].shell.receiveShadow;
      mesh.instanceMatrix.needsUpdate = true;
      if (count) mesh.computeBoundingSphere();
    }
  }

  get diagnostics(): { cells: number; capacity: number; visible: number } {
    return {
      cells: this.cells.length,
      capacity: this.cells.reduce((n, c) => n + c.rows.length, 0),
      visible: this.cells.reduce((n, c) => n + c.mesh.count, 0),
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { mesh, rows } of this.cells) {
      for (const row of rows) row.shell.visible = true;
      mesh.dispose(); // instance buffers only; geometry and material are shared crate art
    }
    this.root.removeFromParent();
    this.root.clear();
    this.cells.length = 0;
  }
}
