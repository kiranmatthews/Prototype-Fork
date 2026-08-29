// The wumpa fruit, as one shared model.
//
// Three places draw this apple — the floating pickups in a level, the burst
// of fruit that sprays out of a smashed crate, and the HUD counter icon — and
// all three used to build their own low-poly sphere. They now share ONE
// authored model (public/models/wumpa.glb, repacked by tools/bake-wumpa.mjs),
// loaded once and handed out as cheap meshes over shared geometry.
//
// The load is async and levels build synchronously, so a caller gets its
// Group back immediately with a stand-in sphere inside it, and every
// outstanding group is upgraded in place the moment the real model lands.
// Nothing has to know whether it asked early or late.
//
// The model is baked centred on its own origin, so a Group returned here
// spins about the middle of the fruit — see the recentring note in the bake
// tool. Rotate the GROUP, not the mesh inside it.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Native height of the baked model, measured on load; art is scaled by it. */
let unitHeight = 1;
let geometry: THREE.BufferGeometry | null = null;
let material: THREE.Material | null = null;

/** Groups handed out before the model arrived, waiting to be filled. */
const pending: THREE.Group[] = [];

// The stand-in: the sphere this replaced, so a level that builds before the
// fetch completes still shows fruit rather than a hole. Shared, like the real
// thing — a level can place dozens.
const standInGeo = new THREE.SphereGeometry(0.5, 8, 6);
const standInMat = new THREE.MeshLambertMaterial({
  color: 0xff9028,
  emissive: 0x4a2006,
});
standInGeo.userData.shared = true;
standInMat.userData.shared = true;

let started = false;
let settled: (() => void) | null = null;
/** Resolves once the model is in (or has failed) — for harnesses and tests. */
export const wumpaReady = new Promise<void>((r) => (settled = r));

function build(): THREE.Mesh {
  const m =
    geometry && material
      ? new THREE.Mesh(geometry, material)
      : new THREE.Mesh(standInGeo, standInMat);
  // Shadow flags belong HERE, not on the one-shot scene traverse that sets
  // them for everything else (applyShadowFlags in main.ts, called only from
  // switchLevel). Fruit bodies are created during play now, and the model swap
  // below throws the old mesh away, so a body made after that traverse — or
  // upgraded after it — would otherwise be the only apple in a cluster not
  // casting a shadow.
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function load(): void {
  if (started) return;
  started = true;
  new GLTFLoader().load(
    import.meta.env.BASE_URL + "models/wumpa.glb",
    (gltf) => {
      let found: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!found && m.isMesh) found = m;
      });
      const mesh = found as THREE.Mesh | null;
      if (!mesh) {
        pending.length = 0; // nothing to upgrade to — stop holding the groups
        settled?.();
        return;
      }
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox!;
      unitHeight = bb.max.y - bb.min.y || 1;
      geometry = mesh.geometry;
      // SHARED, and not the level's to free: every wumpa in the game draws
      // this one geometry/material/texture — a level's pickups, the player's
      // fruit pool, the HUD icon. Level.dispose() traverses its root and frees
      // what it finds, which would pull the GPU buffers out from under all of
      // them on a level switch. The flag tells it to leave these alone.
      geometry.userData.shared = true;
      // The whole game is lit with Lambert; a PBR standard material here
      // would light differently from everything around it and cost more for
      // a fruit that is a few dozen pixels across. Keep the baked colour map,
      // drop the shading model. The gentle emissive is what the old sphere
      // had — it keeps the fruit readable in the shadowed half of a level.
      const src = mesh.material as THREE.MeshStandardMaterial;
      material = new THREE.MeshLambertMaterial({
        map: src.map,
        color: 0xffffff,
        emissive: 0x2a1505,
        side: THREE.DoubleSide, // the source is double-sided; the leaf is a plane
      });
      material.userData.shared = true; // see the note on the geometry above
      for (const group of pending.splice(0)) {
        group.clear();
        group.add(build());
        group.scale.setScalar(
          ((group.userData.wumpaHeight as number | undefined) ?? 1) /
            unitHeight,
        );
        delete group.userData.wumpaPending;
      }
      settled?.();
    },
    undefined,
    () => {
      // Missing or unparseable: everyone keeps the stand-in sphere rather
      // than losing the fruit entirely. Drop the waiting list, though —
      // `pending` is only a list of groups to upgrade, and with no model
      // coming it would pin every wumpa Group ever handed out for the life of
      // the page, including the ones their levels have long since discarded.
      pending.length = 0;
      settled?.();
    },
  );
}

/**
 * How tall a wumpa stands in the world — ALL of them.
 *
 * There is one size because there is one fruit. It used to be three numbers in
 * three files: 0.48 for a level's floating pickups, 0.34 for the burst out of
 * a crate, and 1 for the HUD icon that gets rescaled anyway. Every one of them
 * traced back to the diameter of the placeholder sphere the authored model
 * replaced, which is a reason they ended up that way and not a reason to keep
 * them — and it meant crate fruit read as a lesser, smaller thing than the
 * fruit sitting on a ledge, when they are the same apple.
 */
export const WUMPA_SIZE = 0.7;

/**
 * One wumpa, scaled so it stands `height` world units tall, centred on its
 * own origin. Spin the returned group about Y for the idle turn.
 */
export function wumpaMesh(height = 1): THREE.Group {
  load();
  const group = new THREE.Group();
  group.add(build());
  group.userData.wumpaHeight = height;
  group.scale.setScalar(height / (geometry ? unitHeight : 1));
  if (!geometry) {
    pending.push(group);
    group.userData.wumpaPending = true;
  }
  return group;
}

/** Stop an unmounted/disposed level fruit from being retained by async load. */
export function releaseWumpaMesh(group: THREE.Object3D): void {
  const candidate = group as THREE.Group;
  if (!candidate.userData.wumpaPending) return;
  const index = pending.indexOf(candidate);
  if (index >= 0) pending.splice(index, 1);
  delete candidate.userData.wumpaPending;
}
