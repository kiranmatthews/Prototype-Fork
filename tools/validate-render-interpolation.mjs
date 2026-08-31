import assert from "node:assert/strict";
import process from "node:process";
import * as THREE from "three";
import { createServer } from "vite";

const near = (actual, expected, epsilon = 1e-6, label = "value") =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, got ${actual}`,
  );

const server = await createServer({
  logLevel: "silent",
  server: { middlewareMode: true },
});

try {
  const { RenderInterpolator } = await server.ssrLoadModule(
    "/src/renderInterpolation.ts",
  );

  const history = new RenderInterpolator();
  const root = new THREE.Group();
  const limb = new THREE.Group();
  root.add(limb);
  history.capture([root, limb]);

  root.position.x = 1;
  limb.position.y = 2;
  limb.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  history.capture([root, limb]);
  history.apply(0.5);
  near(root.position.x, 0.5, 1e-6, "root midpoint");
  near(limb.position.y, 1, 1e-6, "child midpoint");
  const halfForward = new THREE.Vector3(0, 0, 1).applyQuaternion(limb.quaternion);
  near(halfForward.x, Math.SQRT1_2, 1e-6, "quaternion midpoint x");
  near(halfForward.z, Math.SQRT1_2, 1e-6, "quaternion midpoint z");

  history.restore();
  near(root.position.x, 1, 1e-6, "root restore");
  near(limb.position.y, 2, 1e-6, "child restore");

  // Morph-only animation still participates in interpolation even though the
  // mesh's Object3D transform is unchanged.
  const face = new THREE.Mesh();
  face.morphTargetInfluences = [0, 1];
  const morphHistory = new RenderInterpolator();
  morphHistory.capture([face]);
  face.morphTargetInfluences[0] = 1;
  face.morphTargetInfluences[1] = 0.25;
  morphHistory.capture([face]);
  morphHistory.apply(0.25);
  near(face.morphTargetInfluences[0], 0.25, 1e-6, "morph midpoint 0");
  near(face.morphTargetInfluences[1], 0.8125, 1e-6, "morph midpoint 1");
  morphHistory.restore();
  near(face.morphTargetInfluences[0], 1, 1e-6, "morph restore 0");
  near(face.morphTargetInfluences[1], 0.25, 1e-6, "morph restore 1");

  // A geometry/morph-set replacement snaps the new array because its indices
  // cannot safely be paired with those from the old shape set.
  face.morphTargetInfluences = [0.2, 0.4, 0.6];
  morphHistory.capture([face]);
  morphHistory.apply(0.5);
  near(face.morphTargetInfluences[0], 0.2, 1e-6, "morph resize snap 0");
  near(face.morphTargetInfluences[2], 0.6, 1e-6, "morph resize snap 2");

  // Two fixed ticks completed in one RAF: rendering stays between the final
  // two authoritative poses instead of jumping the whole catch-up distance.
  root.position.x = 2;
  history.capture([root, limb]);
  root.position.x = 3;
  history.capture([root, limb]);
  history.apply(0.25);
  near(root.position.x, 2.25, 1e-6, "catch-up interpolation");
  history.restore();
  near(root.position.x, 3, 1e-6, "catch-up restore");

  // Shortest-path quaternion interpolation across the ±180° seam.
  const turn = new THREE.Group();
  const seam = new RenderInterpolator();
  turn.quaternion.setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(179),
  );
  seam.capture([turn]);
  turn.quaternion.setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(-179),
  );
  seam.capture([turn]);
  seam.apply(0.5);
  const seamForward = new THREE.Vector3(0, 0, 1).applyQuaternion(turn.quaternion);
  assert.ok(seamForward.z < -0.999, "quaternion slerp took the long path");
  seam.restore();

  // A pooled hidden object reappears exactly at its new current transform.
  const pooled = new THREE.Group();
  const pooledHistory = new RenderInterpolator();
  pooled.visible = false;
  pooled.position.x = 10;
  pooledHistory.capture([pooled]);
  pooled.visible = true;
  pooled.position.x = 50;
  pooledHistory.capture([pooled]);
  pooledHistory.apply(0.2);
  near(pooled.position.x, 50, 1e-6, "visible-edge snap");

  // Semantic snap restores an installed presentation pose before discarding
  // history, then the next capture seeds both endpoints at the destination.
  root.position.x = 4;
  history.capture([root, limb]);
  history.apply(0.5);
  near(root.position.x, 3.5, 1e-6, "pre-snap presentation");
  history.snap();
  near(root.position.x, 4, 1e-6, "snap restored authoritative pose");
  root.position.x = 100;
  history.capture([root, limb]);
  history.apply(0.37);
  near(root.position.x, 100, 1e-6, "teleport collapsed history");
  history.restore();
  root.position.x = 110;
  history.capture([root, limb]);
  history.apply(0.4);
  near(root.position.x, 104, 1e-6, "pre-pause interpolation");
  history.collapse();
  near(root.position.x, 110, 1e-6, "pause collapse restore");
  history.apply(0.2);
  near(root.position.x, 110, 1e-6, "pause collapse remained ready");
  history.restore();
  root.position.x = 120; // legitimate mutation while no presentation is installed
  history.snap();
  near(root.position.x, 120, 1e-6, "idle snap overwrote a legitimate mutation");

  // Accumulator oracle: zero/one/multiple-step RAFs and long-run 120 Hz drift.
  const fixed = 1 / 60;
  let accumulator = 0;
  const pump = (delta) => {
    accumulator += delta;
    let steps = 0;
    while (accumulator + 1e-10 >= fixed) {
      accumulator = Math.max(0, accumulator - fixed);
      steps++;
    }
    return { steps, alpha: accumulator / fixed };
  };
  const sequence = [pump(0.5 * fixed), pump(0.5 * fixed), pump(2.5 * fixed), pump(0.5 * fixed)];
  assert.deepStrictEqual(sequence.map((sample) => sample.steps), [0, 1, 2, 1]);
  sequence.forEach((sample, index) =>
    near(sample.alpha, [0.5, 0, 0.5, 0][index], 1e-9, `alpha ${index}`),
  );
  accumulator = 0;
  const clampedStall = pump(0.1);
  assert.equal(clampedStall.steps, 6);
  near(clampedStall.alpha, 0, 1e-9, "100 ms catch-up alpha");
  accumulator = 0;
  let ticks = 0;
  for (let i = 0; i < 10_000; i++) ticks += pump(1 / 120).steps;
  assert.equal(ticks, 5_000);
  near(accumulator, 0, 1e-9, "120 Hz accumulator drift");

  console.log(
    "Validated render interpolation: hierarchy, morph targets, catch-up, slerp, restore, visibility, teleports and accumulator cadence.",
  );
} finally {
  await server.close();
}

process.exit(0);
