import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-5) => {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`);
};

const finiteQuaternion = (quaternion) => quaternion.toArray().every(Number.isFinite)
  && Math.abs(quaternion.length() - 1) < 1e-6;

try {
  const {
    captureIkChainTransforms,
    inferHumanoidIkChains,
    resolveIkChain,
    restoreIkChainTransforms,
    solveResolvedIkChain,
    solveTwoBoneIk,
  } = await server.ssrLoadModule('/src/animation/ik.ts');

  // A translated/rotated rig root verifies that all controls and errors are in world space.
  const scene = new THREE.Group();
  const rigRoot = new THREE.Group();
  rigRoot.position.set(2, 1, -3);
  rigRoot.rotation.y = 0.35;
  scene.add(rigRoot);
  const root = new THREE.Group();
  const mid = new THREE.Group();
  const end = new THREE.Group();
  const socket = new THREE.Object3D();
  root.name = 'test-root';
  mid.name = 'test-mid';
  end.name = 'test-end';
  socket.name = 'test-effector';
  mid.position.set(0, -2, 0);
  end.position.set(0, -2, 0);
  socket.position.set(0, -0.25, 0);
  rigRoot.add(root);
  root.add(mid);
  mid.add(end);
  end.add(socket);
  scene.updateWorldMatrix(true, true);

  const rootWorld = root.getWorldPosition(new THREE.Vector3());
  const target = rootWorld.clone().add(new THREE.Vector3(1.1, -3.5, 0.8));
  const pole = rootWorld.clone().add(new THREE.Vector3(0, 0, 3));
  const direct = solveTwoBoneIk({ root, mid, end, effector: socket, target, pole });
  assert.equal(direct.status, 'reached');
  assert.equal(direct.reached, true);
  assert.equal(direct.clamped, false);
  assert.ok(direct.error < 1e-5, `reachable solve error was ${direct.error}`);
  assert.ok(finiteQuaternion(root.quaternion));
  assert.ok(finiteQuaternion(mid.quaternion));
  near(direct.endPosition.distanceTo(target), direct.error);

  root.quaternion.identity();
  mid.quaternion.identity();
  scene.updateWorldMatrix(true, true);
  const farTarget = rootWorld.clone().add(new THREE.Vector3(20, 0, 0));
  const unreachable = solveTwoBoneIk({ root, mid, end, effector: socket, target: farTarget, pole });
  assert.equal(unreachable.status, 'clamped');
  assert.equal(unreachable.reached, false);
  assert.equal(unreachable.clamped, true);
  near(rootWorld.distanceTo(unreachable.endPosition), 4.25, 1e-5);
  assert.ok(Number.isFinite(unreachable.error));

  root.quaternion.identity();
  mid.quaternion.identity();
  scene.updateWorldMatrix(true, true);
  const limited = solveTwoBoneIk({
    root,
    mid,
    end,
    effector: socket,
    target,
    pole,
    rootLimit: { referenceQuaternion: [0, 0, 0, 1], maxAngleRadians: 0.1 },
    midLimit: { referenceQuaternion: [0, 0, 0, 1], maxAngleRadians: 0.1 },
  });
  assert.equal(limited.status, 'limited');
  assert.equal(limited.clamped, true);
  assert.ok(root.quaternion.angleTo(new THREE.Quaternion()) <= 0.100001);
  assert.ok(mid.quaternion.angleTo(new THREE.Quaternion()) <= 0.100001);

  const rootBeforeInvalid = root.quaternion.clone();
  const midBeforeInvalid = mid.quaternion.clone();
  const invalid = solveTwoBoneIk({
    root,
    mid,
    end,
    effector: socket,
    target: [Number.NaN, 0, 0],
    pole,
  });
  assert.equal(invalid.status, 'invalid');
  assert.equal(root.quaternion.equals(rootBeforeInvalid), true);
  assert.equal(mid.quaternion.equals(midBeforeInvalid), true);
  assert.ok(Number.isFinite(invalid.error));

  // Semantic inference is topology checked, but remains independent of Bone/humanoid classes.
  const semanticRoot = new THREE.Group();
  const joints = new Map();
  const sockets = new Map();
  const jointDefinitions = [];
  const socketDefinitions = [];
  const addJoint = (id, nodeName, parent, parentId, offset) => {
    const node = new THREE.Group();
    node.name = nodeName;
    node.position.fromArray(offset);
    parent.add(node);
    joints.set(id, node);
    jointDefinitions.push({
      id,
      nodeName,
      parentId,
      rest: {
        position: node.position.toArray(),
        quaternion: node.quaternion.toArray(),
        scale: node.scale.toArray(),
      },
    });
    return node;
  };
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? 1 : -1;
    const shoulder = addJoint(`shoulder${side}`, `shoulder-${side.toLowerCase()}`,
      semanticRoot, null, [sign * 0.4, 1, 0]);
    const elbow = addJoint(`elbow${side}`, `elbow-${side.toLowerCase()}`,
      shoulder, `shoulder${side}`, [0, -0.5, 0]);
    const wrist = addJoint(`wrist${side}`, `wrist-${side.toLowerCase()}`,
      elbow, `elbow${side}`, [0, -0.45, 0]);
    const hip = addJoint(`hip${side}`, `hip-${side.toLowerCase()}`,
      semanticRoot, null, [sign * 0.2, 0, 0]);
    const knee = addJoint(`knee${side}`, `knee-${side.toLowerCase()}`,
      hip, `hip${side}`, [0, -0.7, 0]);
    const ankle = addJoint(`ankle${side}`, `ankle-${side.toLowerCase()}`,
      knee, `knee${side}`, [0, -0.65, 0]);
    for (const [role, parent] of [['grip', wrist], ['foot', ankle]]) {
      const id = `${role}${side}`;
      const effector = new THREE.Object3D();
      effector.name = `socket-${role}-${side.toLowerCase()}`;
      effector.position.y = -0.1;
      parent.add(effector);
      sockets.set(id, effector);
      socketDefinitions.push({ id, nodeName: effector.name, parentJointId: role === 'grip'
        ? `wrist${side}` : `ankle${side}` });
    }
  }
  semanticRoot.updateWorldMatrix(true, true);
  const binding = {
    root: semanticRoot,
    definition: {
      joints: jointDefinitions,
      sockets: socketDefinitions,
      coordinateSystem: {
        handedness: 'right',
        up: 'Y',
        localForward: '+Z',
        units: 'rig-units',
      },
    },
    joints,
    sockets,
  };
  const inferred = inferHumanoidIkChains(binding);
  assert.deepEqual(inferred.map((chain) => chain.id),
    ['arm.left', 'leg.left', 'arm.right', 'leg.right']);
  assert.ok(inferred.every((chain) => chain.target instanceof THREE.Vector3));
  assert.ok(inferred.every((chain) => chain.pole instanceof THREE.Vector3));
  assert.equal(inferred.find((chain) => chain.id === 'arm.left').effectorSocketId, 'gripLeft');
  assert.equal(inferred.find((chain) => chain.id === 'leg.right').effectorSocketId, 'footRight');

  // Explicit humanoid roles take precedence over names. None of these IDs or
  // node names contain shoulder/elbow/wrist/hip/knee/ankle search tokens.
  const mappedRoot = new THREE.Group();
  const mappedJoints = new Map();
  const mappedDefinitions = [];
  const mappedSockets = new Map();
  const mappedSocketDefinitions = [];
  const mappedHumanoid = {};
  const addMapped = (id, role, parent, parentId, offset) => {
    const node = new THREE.Group();
    node.name = `opaque-${id}`;
    node.position.fromArray(offset);
    parent.add(node);
    mappedJoints.set(id, node);
    mappedDefinitions.push({
      id, nodeName: node.name, parentId, role, type: 'transform',
      rest: { position: [...offset], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
    });
    mappedHumanoid[role] = id;
    return node;
  };
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? 1 : -1;
    const armA = addMapped(`a0${side}`, `upperArm${side}`, mappedRoot, null, [sign * 0.4, 1, 0]);
    const armB = addMapped(`a1${side}`, `lowerArm${side}`, armA, `a0${side}`, [sign * 0.5, 0, 0]);
    const armC = addMapped(`a2${side}`, `hand${side}`, armB, `a1${side}`, [sign * 0.45, 0, 0]);
    const legA = addMapped(`b0${side}`, `upperLeg${side}`, mappedRoot, null, [sign * 0.2, 0, 0]);
    const legB = addMapped(`b1${side}`, `lowerLeg${side}`, legA, `b0${side}`, [0, -0.7, 0]);
    const legC = addMapped(`b2${side}`, `foot${side}`, legB, `b1${side}`, [0, -0.65, 0]);
    for (const [kind, terminal] of [['grip', armC], ['foot', legC]]) {
      const id = `${kind}${side}`;
      const node = new THREE.Object3D();
      node.name = `opaque-socket-${id}`;
      terminal.add(node);
      mappedSockets.set(id, node);
      mappedSocketDefinitions.push({ id, nodeName: node.name });
    }
  }
  mappedRoot.updateWorldMatrix(true, true);
  const mappedBinding = {
    root: mappedRoot,
    definition: {
      joints: mappedDefinitions,
      sockets: mappedSocketDefinitions,
      humanoid: mappedHumanoid,
      coordinateSystem: { handedness: 'right', up: 'Y', localForward: '+Z', units: 'rig-units' },
    },
    joints: mappedJoints,
    sockets: mappedSockets,
  };
  const mappedChains = inferHumanoidIkChains(mappedBinding);
  assert.deepEqual(mappedChains.map((chain) => [chain.id, chain.rootId, chain.midId, chain.endId]), [
    ['arm.left', 'a0Left', 'a1Left', 'a2Left'],
    ['leg.left', 'b0Left', 'b1Left', 'b2Left'],
    ['arm.right', 'a0Right', 'a1Right', 'a2Right'],
    ['leg.right', 'b0Right', 'b1Right', 'b2Right'],
  ]);

  const declared = resolveIkChain({
    id: 'custom.left-leg',
    name: 'Custom left leg',
    rootId: 'hipLeft',
    midId: 'kneeLeft',
    endId: 'ankleLeft',
    kind: 'generic',
    effectorSocketId: 'footLeft',
    defaultPoleDirection: [0, 0, 1],
  }, binding);
  assert.ok(declared);
  const snapshot = captureIkChainTransforms(declared);
  declared.target.add(new THREE.Vector3(0.25, 0.2, 0.2));
  const declaredResult = solveResolvedIkChain(declared);
  assert.equal(declaredResult.reached, true);
  assert.equal(restoreIkChainTransforms(snapshot), true);
  assert.ok(declared.root.quaternion.equals(snapshot[0].quaternion));

  console.log('PASS animation IK inference, bounded analytic solve, limits, and rollback');
} finally {
  await server.close();
}
