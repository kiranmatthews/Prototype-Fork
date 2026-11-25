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

  // Rotated, non-uniform character proportions must not change the analytic
  // segment lengths as the joints turn. Contacts are still world-space.
  rigRoot.scale.set(1.18,1.36,.92);rigRoot.rotation.set(.2,.35,-.1);
  for(const local of [[1.1,-3.5,.8],[-.4,-2.9,1.2],[.8,-3.8,-.1]]){
    root.quaternion.identity();mid.quaternion.identity();scene.updateWorldMatrix(true,true);
    const scaledTarget=rigRoot.localToWorld(new THREE.Vector3(...local));
    const scaledPole=rigRoot.localToWorld(new THREE.Vector3(0,0,3));
    const result=solveTwoBoneIk({root,mid,end,target:scaledTarget,pole:scaledPole,solveSpace:rigRoot});
    assert.ok(result.error<1e-5,`affine contact missed by ${result.error}`);
    assert.equal(result.status,'reached');
    assert.deepEqual(mid.position.toArray(),[0,-2,0]);assert.deepEqual(end.position.toArray(),[0,-2,0]);
  }

  // ---- under the rider's proportions, through the side-on hang ----------------
  // A bone below a rotated (1.18, 1.36, 1.18) body has a sheared world matrix,
  // and a sheared matrix holds no single rotation: taking one apart answers
  // differently on each branch of the matrix-to-quaternion conversion. A
  // side-on halfpipe hang is a quarter turn, then a quarter turn: a 120 degree
  // rotation whose trace is zero and whose diagonal is all zeros, so every
  // branch condition is undecided at once. The solve must not notice. It works
  // in each joint's parent, so its answer cannot depend on which way the whole
  // rig faces: the same leg, turned as one piece, must solve to the same joint
  // rotations, and its foot must simply turn with it.
  {
    const world = new THREE.Group();
    const body = new THREE.Group();
    body.scale.set(1.18, 1.36, 1.18);
    body.position.set(3, 7, -2);
    world.add(body);
    const hip = new THREE.Group();
    const knee = new THREE.Group();
    const ankle = new THREE.Group();
    hip.position.set(0.12, 0.9, 0);
    knee.position.set(0, -0.45, 0);
    ankle.position.set(0, -0.42, 0);
    body.add(hip);
    hip.add(knee);
    knee.add(ankle);
    const quarterTurns = (x, y, z, turns) =>
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(x, y, z), turns * Math.PI / 2);
    // Onto the wall, the rig's own half turn, then a quarter turn of facing.
    const hang = quarterTurns(0, 0, 1, 1).multiply(quarterTurns(0, 1, 0, 2)).multiply(quarterTurns(0, 1, 0, -1));
    body.quaternion.copy(hang);
    world.updateWorldMatrix(true, true);
    const hung = body.matrixWorld.elements;
    assert.ok([hung[0], hung[5], hung[10]].every((value) => Math.abs(value) < 1e-12),
      'reference: in the side-on hang the body\'s rotation has an all-zero diagonal, and so a zero trace');

    /** A node's own axes in the world, read off its matrix: never a decomposed rotation. */
    const axesOf = (node) => {
      const e = node.matrixWorld.elements;
      return [0, 4, 8].map((i) => new THREE.Vector3(e[i], e[i + 1], e[i + 2]).normalize());
    };
    const modes = [
      // [how it is asked for, the option, the miss three passes may leave (metres)]
      ['by default', {}, 2e-3],
      ['accounting for parent scale', { accountForParentScale: true }, 2e-3],
      ['in the body\'s solve space', { solveSpace: body }, 1e-5],
    ];
    // Target and pole are given in the body's own frame, so they ride with it.
    const legs = [
      { name: 'a nearly straight leg', rest: [[-0.10, 0.04, 0.06], [0.16, 0, 0]],
        target: [0.16, 0.10, 0.10], pole: [0.12, 0.5, 1.5], loop: 0.03 },
      { name: 'a bent leg', rest: [[-0.5, 0.15, 0.2], [0.9, 0, 0]],
        target: [0.30, 0.22, 0.28], pole: [0.15, 0.6, 1.5], loop: 0.06 },
    ];
    const solveLeg = (leg, options, target = leg.target) => {
      hip.quaternion.setFromEuler(new THREE.Euler(...leg.rest[0]));
      knee.quaternion.setFromEuler(new THREE.Euler(...leg.rest[1]));
      world.updateWorldMatrix(true, true);
      const worldTarget = body.localToWorld(new THREE.Vector3(...target));
      const worldPole = body.localToWorld(new THREE.Vector3(...leg.pole));
      let result;
      for (let pass = 0; pass < 3; pass++) {
        result = solveTwoBoneIk({ root: hip, mid: knee, end: ankle, target: worldTarget, pole: worldPole, ...options });
      }
      world.updateWorldMatrix(true, true);
      return result;
    };

    for (const leg of legs) {
      for (const [label, options, reach] of modes) {
        // The whole rig turned through the hang about three different axes, a
        // thousandth of a radian at a time. Turning about the hang's own axis
        // takes the trace through zero; the middle step is the hang exactly.
        let first = null;
        let jointSpread = 0;
        let footSpread = 0;
        let worstMiss = 0;
        for (const axis of [[-1, 1, -1], [1, 0, 0], [0.3, -0.5, 0.8]]) {
          const about = new THREE.Vector3(...axis).normalize();
          for (let k = -600; k <= 600; k++) {
            const turned = new THREE.Quaternion().setFromAxisAngle(about, k * 0.001);
            body.quaternion.copy(turned).multiply(hang);
            const result = solveLeg(leg, options);
            assert.notEqual(result.status, 'invalid', `${leg.name}, ${label}: solved at ${k * 0.001} rad off the hang`);
            const back = turned.clone().invert();
            const now = { joints: [hip.quaternion.clone(), knee.quaternion.clone()],
              foot: axesOf(ankle).map((direction) => direction.applyQuaternion(back)) };
            first ??= now;
            jointSpread = Math.max(jointSpread, ...now.joints.map((q, i) => q.angleTo(first.joints[i])));
            footSpread = Math.max(footSpread, ...now.foot.map((direction, i) => direction.angleTo(first.foot[i])));
            worstMiss = Math.max(worstMiss, result.error);
          }
        }
        assert.ok(jointSpread < 1e-6, `${leg.name}, ${label}: turned as one piece through the side-on hang, ` +
          `the solved hip and knee change by ${jointSpread.toExponential(1)} rad (they should not change at all)`);
        assert.ok(footSpread < 1e-6, `${leg.name}, ${label}: and the foot turns with the rig, ` +
          `to within ${footSpread.toExponential(1)} rad`);
        if (process.env.IK_TRACE) console.log('TRACE turned', JSON.stringify({ leg: leg.name, label, jointSpread, footSpread, worstMiss }));
        assert.ok(worstMiss < reach, `${leg.name}, ${label}: three passes reach the target under the body's ` +
          `proportions (worst miss ${(worstMiss * 1000).toFixed(3)} mm)`);

        // Held exactly in the hang while the foot is carried round a loop: the
        // joints follow it. A pop is one step many times the size of the rest.
        body.quaternion.copy(hang);
        const steps = 720;
        let last = null;
        let worstStep = 0;
        let worstFootStep = 0;
        let travelled = 0;
        for (let k = 0; k <= steps; k++) {
          const angle = k / steps * 2 * Math.PI;
          solveLeg(leg, options, [leg.target[0] + leg.loop * Math.cos(angle),
            leg.target[1] + leg.loop * 0.5 * Math.sin(2 * angle), leg.target[2] + leg.loop * Math.sin(angle)]);
          const now = { joints: [hip.quaternion.clone(), knee.quaternion.clone()], foot: axesOf(ankle) };
          if (last) {
            const step = Math.max(...now.joints.map((q, i) => q.angleTo(last.joints[i])));
            worstStep = Math.max(worstStep, step);
            travelled += step;
            worstFootStep = Math.max(worstFootStep, ...now.foot.map((direction, i) => direction.angleTo(last.foot[i])));
          }
          last = now;
        }
        const usual = travelled / steps;
        assert.ok(usual > 5e-4, `reference: ${leg.name} really is carried round its loop (${usual.toFixed(4)} rad a step)`);
        if (process.env.IK_TRACE) console.log('TRACE loop', JSON.stringify({ leg: leg.name, label, worstStep, worstFootStep, usual }));
        assert.ok(worstStep < 4 * usual && worstFootStep < 4 * usual, `${leg.name}, ${label}: held in the hang with its foot ` +
          `carried round a loop, no step is a pop (the largest is ${worstStep.toFixed(4)} rad for the joints and ` +
          `${worstFootStep.toFixed(4)} rad for the foot; the usual one is ${usual.toFixed(4)})`);
      }
    }

    // The scale-aware aim used to be asked for by name. It is now the only
    // conversion there is, so asking for it changes nothing; and where nothing
    // is stretched unevenly it is what it always was, the shortest world turn
    // conjugated into the parent, which solves a rigid or evenly scaled rig
    // exactly in one pass, whichever way it faces.
    body.quaternion.copy(hang);
    solveLeg(legs[1], {});
    const byDefault = [hip.quaternion.clone(), knee.quaternion.clone()];
    solveLeg(legs[1], { accountForParentScale: true });
    assert.ok(byDefault[0].equals(hip.quaternion) && byDefault[1].equals(knee.quaternion),
      'accountForParentScale no longer changes the solve: every solve aims through the parent\'s whole transform');
    body.scale.setScalar(1.36);
    for (const facing of [hang, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, -1.9, 0.4))]) {
      body.quaternion.copy(facing);
      hip.quaternion.setFromEuler(new THREE.Euler(...legs[1].rest[0]));
      knee.quaternion.setFromEuler(new THREE.Euler(...legs[1].rest[1]));
      world.updateWorldMatrix(true, true);
      const even = solveTwoBoneIk({ root: hip, mid: knee, end: ankle,
        target: body.localToWorld(new THREE.Vector3(...legs[1].target)), pole: body.localToWorld(new THREE.Vector3(...legs[1].pole)) });
      assert.ok(even.status === 'reached' && even.error < 1e-5, `an evenly scaled rig is solved exactly in one pass (${even.error})`);
    }

    // A small rig is not a collapsed one; a flattened parent still is, and is refused.
    body.scale.set(1.18e-3, 1.36e-3, 1.18e-3);
    body.quaternion.copy(hang);
    for (const [label, options] of modes) {
      const small = solveLeg(legs[1], options);
      assert.notEqual(small.status, 'invalid', `a rig a thousandth of the size is still solved ${label}`);
    }
    body.scale.set(1.18, 0, 1.18);
    hip.quaternion.setFromEuler(new THREE.Euler(...legs[1].rest[0]));
    knee.quaternion.setFromEuler(new THREE.Euler(...legs[1].rest[1]));
    const before = [hip.quaternion.clone(), knee.quaternion.clone()];
    world.updateWorldMatrix(true, true);
    const flat = solveTwoBoneIk({ root: hip, mid: knee, end: ankle,
      target: body.localToWorld(new THREE.Vector3(...legs[1].target)), pole: body.localToWorld(new THREE.Vector3(...legs[1].pole)) });
    assert.ok(flat.status === 'invalid' || flat.status === 'degenerate', `a flattened parent is refused (${flat.status})`);
    assert.ok(hip.quaternion.equals(before[0]) && knee.quaternion.equals(before[1]), 'and the refused solve leaves the joints as they were');
  }

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
