import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const orders = ['XYZ', 'XZY', 'YXZ', 'YZX', 'ZXY', 'ZYX'];
  const fixture = () => {
    const root = new THREE.Group(), nodes = [root];
    for (let i = 1; i < 65; i++) {
      const node = new THREE.Group(); node.name = 'part-' + i;
      nodes[Math.floor((i - 1) / 4)].add(node); nodes.push(node);
      node.position.set(i * .01, -.2, .5); node.rotation.set(i * .07, -.2, .35, orders[i % 6]);
      node.scale.set(.8, 1.2, i % 2 ? -1 : 1); node.visible = i % 7 !== 0;
    }
    return { root, nodes };
  };
  const live = fixture(), expected = fixture(), bridge = new PlayerAnimationBridge(live.root, live.root);
  // Independent oracle: clone the local transforms and use the standard
  // Three.js copy operations unconditionally on restore, including Euler sync.
  const capture = root => {
    const result = [];
    root.traverse(node => result.push({ node, p: node.position.clone(), q: node.quaternion.clone(),
      s: node.scale.clone(), visible: node.visible }));
    return result;
  };
  const restore = snapshot => {
    for (const { node, p, q, s, visible } of snapshot) {
      node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); node.visible = visible;
    }
  };
  const values = node => [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray(),
    ...node.rotation.toArray(), node.visible];
  let comparedNodes = 0, quaternionWrites = 0, actualRestoreWrites = 0, referenceWrites = 0;
  const watch = node => {
    const change = node.quaternion._onChangeCallback;
    node.quaternion._onChange(() => { quaternionWrites++; change(); });
  };
  live.nodes.forEach(watch);
  const compare = label => {
    for (let i = 0; i < live.nodes.length; i++) {
      assert.deepEqual(values(live.nodes[i]), values(expected.nodes[i]), `${label}, node ${i}`); comparedNodes++;
    }
  };
  let frame = 0;
  function edit(scene, phase) {
    const node = scene.nodes[(frame * 11 + phase * 7) % scene.nodes.length];
    node.position.x = Math.sin(frame * .2); node.scale.z = frame % 2 ? -1.1 : .9;
    node.rotation.set(frame * .04, -.1, .3, orders[(frame + phase) % 6]); node.visible = !node.visible;
    // Changes to the current order, Euler winding or signed zeros must not
    // bypass the authoritative quaternion-to-Euler restoration.
    const special = scene.nodes[1];
    if (frame % 9 === 0) special.rotation.set(2 * Math.PI, 0, 0, orders[frame % 6]);
    if (frame % 13 === 0) special.quaternion.set(-0, 0, -0, 1);
    if (frame % 17 === 0) special.rotation.order = orders[(frame + phase + 1) % 6];
  }
  bridge.setOverlay(() => edit(live, 1));
  for (; frame < 180; frame++) {
    for (const scene of [live, expected]) {
      if (frame === 30) scene.root.children.reverse();
      if (frame === 60) scene.nodes[3].removeFromParent();
      if (frame === 90) scene.root.add(scene.nodes[3]);
      if (frame === 120) scene.nodes[1].add(scene.nodes[64]);
      if (frame === 150) {
        const added = new THREE.Group(); scene.root.add(added); scene.nodes.push(added);
        if (scene === live) watch(added);
      }
      edit(scene, 0);
    }
    const snapshot = capture(expected.root);
    bridge.applyOverlay(1 / 60); edit(expected, 1); compare('overlay');
    const before = quaternionWrites; bridge.prepareLegacyPose(); restore(snapshot);
    referenceWrites += snapshot.length; actualRestoreWrites += quaternionWrites - before;
    compare('restore');
  }
  bridge.setOverlay(null);

  // Warm static descendants should not allocate transform objects or invoke
  // Euler conversion repeatedly; a visibility edge must reuse its record.
  const still = fixture(), quiet = new PlayerAnimationBridge(still.root, still.root);
  let callbacks = 0, clones = 0;
  for (const node of still.nodes) {
    const change = node.quaternion._onChangeCallback;
    node.quaternion._onChange(() => { callbacks++; change(); });
  }
  const vectorClone = THREE.Vector3.prototype.clone, quaternionClone = THREE.Quaternion.prototype.clone;
  try {
    THREE.Vector3.prototype.clone = function () { clones++; return vectorClone.call(this); };
    THREE.Quaternion.prototype.clone = function () { clones++; return quaternionClone.call(this); };
    quiet.setOverlay(() => {}); quiet.applyOverlay(1 / 60); quiet.prepareLegacyPose();
    const records = [...quiet.overlayBaseline]; callbacks = 0;
    for (let pass = 0; pass < 240; pass++) {
      still.nodes[3].visible = !still.nodes[3].visible;
      quiet.applyOverlay(1 / 60); quiet.prepareLegacyPose();
      assert.ok(quiet.overlayBaseline.every((record, i) => record === records[i]), 'warm snapshot storage was replaced');
    }
    assert.equal(clones, 0, 'snapshot allocated Vector3/Quaternion objects');
    assert.equal(callbacks, 0, 'unchanged descendants repeatedly converted quaternion to Euler');
    quiet.setOverlay(null);
  } finally {
    THREE.Vector3.prototype.clone = vectorClone; THREE.Quaternion.prototype.clone = quaternionClone;
  }

  // Preview reset/exit and overlay exceptions must keep the same restoration
  // boundary, even after changing order or editing a detached descendant.
  const preview = capture(expected.root);
  bridge.enterPreview();
  for (const scene of [live, expected]) { edit(scene, 1); scene.nodes[3].removeFromParent(); }
  bridge.resetPreview(); restore(preview); compare('preview reset');
  for (const scene of [live, expected]) edit(scene, 0);
  bridge.exitPreview(); restore(preview); compare('preview exit');
  const failed = capture(expected.root);
  bridge.setOverlay(() => { edit(live, 1); throw new Error('deliberate overlay failure'); });
  assert.throws(() => bridge.applyOverlay(1 / 60), /deliberate overlay failure/);
  edit(expected, 1); restore(failed); compare('failed overlay');
  bridge.setOverlay(null);
  assert.ok(actualRestoreWrites < referenceWrites / 4, 'mostly static rig kept restoring every quaternion');
  console.log(JSON.stringify({ passed: true, frames: frame, comparedNodes, referenceRestoreWrites: referenceWrites,
    actualRestoreWrites,
    warm: { nodes: still.nodes.length, frames: 240, quaternionWrites: callbacks, transformClones: clones,
      recordsReusedAcrossVisibilityChanges: true },
    exactEulerOrders: orders, liveEdits: ['rotations', 'winding', 'signed zeros', 'order', 'visibility',
      'scale', 'position', 'reordering', 'removal', 'reparenting', 'late nodes'], previewAndExceptions: true }, null, 2));
} finally { await server.close(); }
