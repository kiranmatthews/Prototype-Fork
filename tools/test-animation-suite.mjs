import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);
};

try {
  const animation = await server.ssrLoadModule('/src/animation/index.ts');
  const {
    RigBinding,
    ANIMATION_SUITE_SCHEMA_VERSION,
    RIG_SCHEMA_VERSION,
    PLAYER_DEFORMATION_CONTROLS,
    PLAYER_STARTER_CATALOG_VERSION,
    UNITY_SLAM_ANTICIPATION_POSE_DEGREES,
    UNITY_SLAM_FALL_POSE_DEGREES,
    UNITY_SLAM_POSE_SOURCE,
    UNITY_SLAM_POSE_TIMING,
    clipTimeAt,
    bakeProceduralClip,
    composeProceduralPose,
    createAnimationClip,
    createAnimationSuiteDocument,
    createAnimationTrack,
    createLocalDraftStore,
    createPlayerStarterAnimationSuite,
    createPlayerStarterClips,
    createProceduralDriver,
    createQuaternionKeyframe,
    createRigMirrorMaps,
    createScalarKeyframe,
    createVectorKeyframe,
    findClip,
    migrateAnimationSuite,
    mirrorClip,
    mirrorPose,
    parseAnimationSuite,
    parseRigDefinition,
    removeClip,
    removeKeyframe,
    reconcilePlayerStarterAnimationSuite,
    sampleClip,
    sampleComposedClip,
    sampleProceduralDriverValue,
    sampleProceduralDrivers,
    sampleQuaternionKeys,
    sampleScalarKeys,
    setActiveClip,
    stringifyAnimationSuite,
    upsertClip,
    upsertKeyframe,
    upsertTrack,
    validateAnimationSuite,
    validateRigDefinition,
    validateProceduralEvaluators,
  } = animation;

  const visual = new THREE.Group();
  visual.name = 'player-visual';
  const nodes = {};
  const addJoint = (id, name, parent = visual) => {
    const node = new THREE.Group();
    node.name = name;
    parent.add(node);
    nodes[id] = node;
    return node;
  };
  const rider = addJoint('root', 'procedural-rider');
  const hips = addJoint('hips', 'hips', rider);
  const torsoRoot = addJoint('torsoRoot', 'upper-body', rider);
  const spine = addJoint('spine', 'spine', torsoRoot);
  const legacyChest = addJoint('chest', 'chest', spine);
  const legacyNeck = addJoint('neck', 'neck', legacyChest);
  const head = addJoint('head', 'head', legacyNeck);
  for (const side of ['Left', 'Right']) {
    const suffix = side.toLowerCase();
    const clavicle = addJoint(`clavicle${side}`, `clavicle-${suffix}`, legacyChest);
    const shoulder = addJoint(`shoulder${side}`, `shoulder-${suffix}`, clavicle);
    const elbow = addJoint(`elbow${side}`, `elbow-${suffix}`, shoulder);
    addJoint(`wrist${side}`, `wrist-${suffix}`, elbow);
    const hip = addJoint(`hip${side}`, `hip-${suffix}`, hips);
    const knee = addJoint(`knee${side}`, `knee-${suffix}`, hip);
    const ankle = addJoint(`ankle${side}`, `ankle-${suffix}`, knee);
    addJoint(`toe${side}`, `toe-${suffix}`, ankle);
    addJoint(`ear${side}`, `ear-${suffix}`, head);
  }
  addJoint('ponytailBase', 'ponytail-base', head);
  addJoint('ponytailTip', 'ponytail-tip', nodes.ponytailBase);
  addJoint('tail', 'tail-root', hips);
  hips.position.set(0, 0.71, 0);
  spine.position.set(0, 0.82, 0);
  nodes.kneeLeft.position.y = -0.26;
  nodes.kneeRight.position.y = -0.26;

  const sockets = {
    look: 'socket-look',
    gripLeft: 'socket-grip-left',
    gripRight: 'socket-grip-right',
    footLeft: 'socket-foot-left',
    heelLeft: 'socket-heel-left',
    toeLeft: 'socket-toe-left',
    footRight: 'socket-foot-right',
    heelRight: 'socket-heel-right',
    toeRight: 'socket-toe-right',
    boardLeft: 'socket-board-left',
    boardRight: 'socket-board-right',
    boardNose: 'socket-board-nose',
    boardTail: 'socket-board-tail',
  };
  for (const name of Object.values(sockets)) {
    const socket = new THREE.Object3D();
    socket.name = name;
    visual.add(socket);
  }
  const jointNames = Object.fromEntries(Object.entries(nodes).map(([id, node]) => [id, node.name]));
  const restPose = Object.fromEntries(Object.entries(nodes).map(([id, node]) => [id, {
    position: node.position.toArray(),
    quaternion: node.quaternion.toArray(),
    scale: node.scale.toArray(),
  }]));
  const controls = Object.fromEntries(Object.values(PLAYER_DEFORMATION_CONTROLS).map((id) => [id, {
    defaultValue: 1,
    min: 0.55,
    max: 1.75,
  }]));
  visual.userData.sculptRuntime = {
    schemaVersion: 2,
    kind: 'procedural-character',
    rigId: 'player-procedural-v1',
    rigName: 'Procedural Rider',
    coordinateSystem: { handedness: 'right', up: 'Y', localForward: '+Z', units: 'rig-units' },
    joints: jointNames,
    sockets,
    restPose,
    controls,
    mirrorPairs: [
      ['hipLeft', 'hipRight'],
      ['kneeLeft', 'kneeRight'],
      ['ankleLeft', 'ankleRight'],
      ['shoulderLeft', 'shoulderRight'],
      ['elbowLeft', 'elbowRight'],
      ['wristLeft', 'wristRight'],
    ],
    deformations: [{
      controlId: PLAYER_DEFORMATION_CONTROLS.legUpperLeft,
      jointId: 'hipLeft',
      downstreamJointIds: ['kneeLeft'],
      lengthAxis: [0, -1, 0],
      min: 0.55,
      max: 1.75,
      volume: 'preserve-cross-section-area',
    }],
  };

  const scalarValues = new Map();
  const binding = RigBinding.fromSculptRuntime(visual, {
    scalarTarget: { set: (id, value) => scalarValues.set(id, value) },
  });
  assert.equal(binding.definition.id, 'player-procedural-v1');
  assert.equal(binding.getJoint('hips'), hips);
  assert.equal(binding.getSocket('footLeft')?.name, 'socket-foot-left');
  assert.equal(binding.definition.joints.find((joint) => joint.id === 'hipLeft').mirrorId, 'hipRight');
  assert.equal(binding.definition.joints.find((joint) => joint.id === 'hipLeft').stretch.controlId,
    PLAYER_DEFORMATION_CONTROLS.legUpperLeft);

  // Rig v2: a conventional pelvis-rooted humanoid can retain legacy clip IDs
  // as aliases while carrying bind and canonical T-pose locals for retargeting.
  const conventionalVisual = new THREE.Group();
  conventionalVisual.name = 'conventional-visual';
  const conventionalNodes = {};
  const addConventionalJoint = (id, parent, offset = [0, 0, 0]) => {
    const node = new THREE.Group();
    node.name = `node-${id}`;
    node.position.fromArray(offset);
    parent.add(node);
    conventionalNodes[id] = node;
    return node;
  };
  const motionRoot = addConventionalJoint('motionRoot', conventionalVisual);
  const pelvis = addConventionalJoint('pelvis', motionRoot, [0, 0.7, 0]);
  const conventionalSpine = addConventionalJoint('spine', pelvis, [0, 0.18, 0]);
  const chest = addConventionalJoint('chest', conventionalSpine, [0, 0.24, 0]);
  const neck = addConventionalJoint('neck', chest, [0, 0.2, 0]);
  addConventionalJoint('head', neck, [0, 0.14, 0]);
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? 1 : -1;
    const clavicle = addConventionalJoint(`clavicle${side}`, chest, [sign * 0.12, 0.12, 0]);
    const upperArm = addConventionalJoint(`upperArm${side}`, clavicle, [sign * 0.12, 0, 0]);
    const lowerArm = addConventionalJoint(`lowerArm${side}`, upperArm, [sign * 0.34, 0, 0]);
    addConventionalJoint(`hand${side}`, lowerArm, [sign * 0.28, 0, 0]);
    const upperLeg = addConventionalJoint(`upperLeg${side}`, pelvis, [sign * 0.14, -0.08, 0]);
    const lowerLeg = addConventionalJoint(`lowerLeg${side}`, upperLeg, [0, -0.34, 0]);
    const foot = addConventionalJoint(`foot${side}`, lowerLeg, [0, -0.31, 0]);
    addConventionalJoint(`toes${side}`, foot, [0, -0.03, 0.16]);
  }
  const conventionalJointNames = Object.fromEntries(
    Object.entries(conventionalNodes).map(([id, node]) => [id, node.name]),
  );
  const conventionalRest = Object.fromEntries(
    Object.entries(conventionalNodes).map(([id, node]) => [id, {
      position: node.position.toArray(),
      quaternion: node.quaternion.toArray(),
      scale: node.scale.toArray(),
    }]),
  );
  const semanticMap = {
    root: 'motionRoot', hips: 'pelvis', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
    clavicleLeft: 'clavicleLeft', upperArmLeft: 'upperArmLeft', lowerArmLeft: 'lowerArmLeft',
    handLeft: 'handLeft', upperLegLeft: 'upperLegLeft', lowerLegLeft: 'lowerLegLeft',
    footLeft: 'footLeft', toesLeft: 'toesLeft',
    clavicleRight: 'clavicleRight', upperArmRight: 'upperArmRight', lowerArmRight: 'lowerArmRight',
    handRight: 'handRight', upperLegRight: 'upperLegRight', lowerLegRight: 'lowerLegRight',
    footRight: 'footRight', toesRight: 'toesRight',
  };
  const legacyAliases = {
    motionRoot: ['root'], pelvis: ['hips'], chest: ['torsoRoot'],
    upperArmLeft: ['shoulderLeft'], lowerArmLeft: ['elbowLeft'], handLeft: ['wristLeft'],
    upperLegLeft: ['hipLeft'], lowerLegLeft: ['kneeLeft'], footLeft: ['ankleLeft'],
    toesLeft: ['toeLeft'],
    upperArmRight: ['shoulderRight'], lowerArmRight: ['elbowRight'], handRight: ['wristRight'],
    upperLegRight: ['hipRight'], lowerLegRight: ['kneeRight'], footRight: ['ankleRight'],
    toesRight: ['toeRight'],
  };
  const tPose = structuredClone(conventionalRest);
  tPose.upperArmLeft.quaternion = [0, 0, Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
  tPose.upperArmRight.quaternion = [0, 0, -Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)];
  conventionalVisual.userData.sculptRuntime = {
    schemaVersion: 3,
    kind: 'procedural-character',
    rigId: 'conventional-player-v2',
    rigName: 'Conventional Player',
    coordinateSystem: { handedness: 'right', up: 'Y', localForward: '+Z', units: 'rig-units' },
    joints: conventionalJointNames,
    restPose: conventionalRest,
    controls,
    mirrorPairs: [
      ['shoulderLeft', 'shoulderRight'],
      ['hipLeft', 'hipRight'],
    ],
    deformations: [{
      controlId: PLAYER_DEFORMATION_CONTROLS.legUpperLeft,
      jointId: 'hipLeft',
      downstreamJointIds: ['kneeLeft'],
      lengthAxis: [0, -1, 0],
      min: 0.55,
      max: 1.75,
      volume: 'preserve-cross-section-area',
    }],
    humanoid: {
      roles: Object.fromEntries(Object.entries(semanticMap).map(([role, id]) => [id, role])),
      types: Object.fromEntries(Object.keys(conventionalNodes).map((id) => [id, 'transform'])),
      aliases: legacyAliases,
      bindPose: conventionalRest,
      canonicalTPose: tPose,
      semanticMap,
    },
  };
  const conventionalBinding = RigBinding.fromSculptRuntime(conventionalVisual);
  const conventionalRig = conventionalBinding.definition;
  assert.equal(conventionalRig.version, RIG_SCHEMA_VERSION);
  assert.equal(conventionalRig.rootJointId, 'motionRoot');
  assert.equal(conventionalRig.humanoid.hips, 'pelvis');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'spine').parentId, 'pelvis');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'chest').parentId, 'spine');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'neck').parentId, 'chest');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'clavicleLeft').parentId, 'chest');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'toesRight').parentId, 'footRight');
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'upperArmLeft').type, 'transform');
  assert.deepEqual(conventionalRig.joints.find((joint) => joint.id === 'upperArmLeft').aliases, ['shoulderLeft']);
  near(conventionalRig.joints.find((joint) => joint.id === 'upperArmLeft').retarget.quaternion[2],
    Math.sin(Math.PI / 8));
  assert.equal(parseRigDefinition(conventionalRig).version, RIG_SCHEMA_VERSION);
  const brokenConventionalRig = structuredClone(conventionalRig);
  brokenConventionalRig.joints.find((joint) => joint.id === 'toesLeft').parentId = 'pelvis';
  const brokenHierarchy = validateRigDefinition(brokenConventionalRig);
  assert.equal(brokenHierarchy.valid, false);
  assert.ok(brokenHierarchy.issues.some((entry) => entry.code === 'hierarchy.humanoid'));

  const upperLegLeftRest = conventionalNodes.upperLegLeft.position.clone();
  conventionalNodes.toesLeft.scale.setScalar(4);
  conventionalBinding.applyPose({ joints: { hipLeft: { position: [0.1, 0.02, 0] } }, scalars: {} }, { strict: true });
  near(conventionalNodes.upperLegLeft.position.x, upperLegLeftRest.x + 0.1);
  near(conventionalNodes.toesLeft.scale.x, 1);
  assert.equal(conventionalBinding.getJoint('shoulderLeft'), conventionalNodes.upperArmLeft);
  assert.equal(conventionalRig.joints.find((joint) => joint.id === 'upperLegLeft').stretch.controlId,
    PLAYER_DEFORMATION_CONTROLS.legUpperLeft);
  assert.deepEqual(conventionalRig.joints.find((joint) => joint.id === 'upperLegLeft').stretch.childIds,
    ['lowerLegLeft']);
  const conventionalMirror = createRigMirrorMaps(conventionalRig);
  assert.equal(conventionalMirror.joints.get('shoulderLeft'), 'upperArmRight');
  assert.equal(conventionalMirror.joints.get('hips'), 'hips');

  const conventionalStarter = createPlayerStarterAnimationSuite(conventionalRig);
  const conventionalValidation = validateAnimationSuite(conventionalStarter);
  assert.equal(conventionalValidation.valid, true,
    conventionalValidation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'));
  const migratedConventionalStarter = parseAnimationSuite(conventionalStarter);
  assert.ok(migratedConventionalStarter.clips.some((clip) =>
    clip.tracks.some((track) => track.kind !== 'scalar' && track.target === 'upperArmLeft')));
  assert.ok(!migratedConventionalStarter.clips.some((clip) =>
    clip.tracks.some((track) => track.kind !== 'scalar' && track.target === 'shoulderLeft')));
  assert.ok(migratedConventionalStarter.clips.some((clip) =>
    clip.tracks.some((track) => track.kind !== 'scalar' && track.target === 'chest')));
  const conventionalRoundTrip = stringifyAnimationSuite(migratedConventionalStarter);
  const roundTrippedConventional = parseAnimationSuite(conventionalRoundTrip);
  assert.deepEqual(roundTrippedConventional.rigs[0].humanoid, migratedConventionalStarter.rigs[0].humanoid);
  assert.deepEqual(roundTrippedConventional.rigs[0].joints.find((joint) => joint.id === 'upperArmLeft').aliases,
    ['shoulderLeft']);
  near(roundTrippedConventional.rigs[0].joints.find((joint) => joint.id === 'upperArmLeft').retarget.quaternion[2],
    Math.sin(Math.PI / 8));
  assert.deepEqual(
    roundTrippedConventional.clips.flatMap((clip) => clip.tracks.map((track) => [track.id, track.target])),
    migratedConventionalStarter.clips.flatMap((clip) => clip.tracks.map((track) => [track.id, track.target])),
  );

  const starterClips = createPlayerStarterClips();
  assert.equal(starterClips.length, 19);
  for (const id of [
    'player.idle', 'player.run', 'player.pace-stop', 'player.jump', 'player.double-jump', 'player.fall', 'player.land', 'player.crouch',
    'player.crawl', 'player.slide', 'player.skate', 'player.grind', 'player.grab', 'player.hang',
    'player.climb', 'player.rope', 'player.slam', 'player.bail', 'player.spin',
  ]) assert.ok(starterClips.some((clip) => clip.id === id), `missing starter clip ${id}`);
  const suite = createPlayerStarterAnimationSuite(binding.definition);
  const validation = validateAnimationSuite(suite);
  assert.equal(validation.valid, true, validation.issues.map((entry) => `${entry.path}: ${entry.message}`).join('\n'));
  const parsedSuite = parseAnimationSuite(suite);
  assert.equal(parsedSuite.activeClipId, 'player.idle');
  assert.equal(parsedSuite.metadata.playerStarterCatalogVersion, PLAYER_STARTER_CATALOG_VERSION);

  const jump = findClip(parsedSuite, 'player.jump');
  const land = findClip(parsedSuite, 'player.land');
  const idle = findClip(parsedSuite, 'player.idle');
  const run = findClip(parsedSuite, 'player.run');
  const paceStop = findClip(parsedSuite, 'player.pace-stop');
  const doubleJump = findClip(parsedSuite, 'player.double-jump');
  const slam = findClip(parsedSuite, 'player.slam');
  assert.ok(jump && doubleJump && land && idle && run && paceStop && slam);
  assert.equal(jump.playbackSpeed, 1);
  assert.ok(jump.tracks.filter((track) => track.kind === 'scalar').length >= 9);
  const jumpPose = sampleClip(jump, 0.32);
  assert.ok(jumpPose.scalars[PLAYER_DEFORMATION_CONTROLS.legLowerLeft] > 1.25);
  const landPose = sampleClip(land, 0.075);
  near(landPose.scalars[PLAYER_DEFORMATION_CONTROLS.torso], 0.62);
  assert.ok(idle.proceduralDrivers.length >= 2);
  assert.equal(run.proceduralDrivers.length, 0,
    'Jog_Fwd already owns its cadence and must not receive the legacy gait twice');

  assert.equal(doubleJump.name, 'Double Jump — Split High Jump');
  assert.equal(doubleJump.duration, 0.65);
  assert.equal(doubleJump.tracks.length, 10);
  assert.equal(doubleJump.metadata.poseIntent,
    'upright split-legged high jump; no forward somersault');
  const fullSplit = sampleClip(doubleJump, 0.08);
  const doubleRoot = new THREE.Quaternion().fromArray(fullSplit.joints.root.quaternion);
  near(Math.abs(doubleRoot.dot(new THREE.Quaternion())), 1);
  const leftHipQuaternion = new THREE.Quaternion().fromArray(fullSplit.joints.hipLeft.quaternion);
  const rightHipQuaternion = new THREE.Quaternion().fromArray(fullSplit.joints.hipRight.quaternion);
  const leftKneeDirection = new THREE.Vector3(0, -1, 0).applyQuaternion(leftHipQuaternion);
  const rightKneeDirection = new THREE.Vector3(0, -1, 0).applyQuaternion(rightHipQuaternion);
  assert.ok(leftKneeDirection.x > 0.85,
    'left double-jump thigh did not straddle toward anatomical left');
  assert.ok(rightKneeDirection.x < -0.85,
    'right double-jump thigh did not straddle toward anatomical right');
  assert.ok(fullSplit.joints.kneeLeft && fullSplit.joints.kneeRight);

  assert.equal(slam.name, 'Body Slam — Unity Pose');
  assert.equal(slam.duration, UNITY_SLAM_POSE_TIMING.duration);
  assert.equal(slam.tracks.length, 8);
  assert.equal(slam.metadata.progressSource, 'gameplay-actionProgress');
  assert.deepEqual(slam.metadata.sourceAnimation, UNITY_SLAM_POSE_SOURCE);
  const assertEulerPose = (pose, target, degrees, label) => {
    assert.ok(pose.joints[target], `${label} did not target ${target}`);
    const actual = new THREE.Quaternion().fromArray(pose.joints[target].quaternion);
    const expected = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(degrees[0]),
      THREE.MathUtils.degToRad(degrees[1]),
      THREE.MathUtils.degToRad(degrees[2]),
      'XYZ',
    ));
    near(Math.abs(actual.dot(expected)), 1, 1e-6);
  };
  const slamAnticipation = sampleClip(slam, 0);
  const slamFall = sampleClip(slam, UNITY_SLAM_POSE_TIMING.fallPoseReached);
  assertEulerPose(
    slamAnticipation,
    'shoulderLeft',
    UNITY_SLAM_ANTICIPATION_POSE_DEGREES.shoulderLeft,
    'Unity slam anticipation',
  );
  assertEulerPose(
    slamAnticipation,
    'shoulderRight',
    UNITY_SLAM_ANTICIPATION_POSE_DEGREES.shoulderRight,
    'Unity slam anticipation',
  );
  assertEulerPose(
    slamAnticipation,
    'hipLeft',
    [UNITY_SLAM_ANTICIPATION_POSE_DEGREES.hipLeft, 0, 0],
    'Unity slam anticipation',
  );
  assertEulerPose(
    slamAnticipation,
    'kneeRight',
    [UNITY_SLAM_ANTICIPATION_POSE_DEGREES.kneeRight, 0, 0],
    'Unity slam anticipation',
  );
  assertEulerPose(
    slamFall,
    'shoulderLeft',
    UNITY_SLAM_FALL_POSE_DEGREES.shoulderLeft,
    'Unity slam fall',
  );
  assertEulerPose(
    slamFall,
    'hipRight',
    [UNITY_SLAM_FALL_POSE_DEGREES.hipRight, 0, 0],
    'Unity slam fall',
  );
  assertEulerPose(slamFall, 'elbowLeft', [0, 0, 0], 'Unity slam fall');

  // Run is the native 30 FPS Quaternius Jog_Fwd loop, converted to ordinary
  // semantic keyframe tracks so every source sample remains editable.
  assert.equal(run.name, 'Run — Quaternius Jog_Fwd');
  near(run.duration, 28 / 30, 1e-6);
  assert.equal(run.rootMotion.mode, 'in-place');
  assert.equal(run.loop.mode, 'loop');
  assert.equal(run.loop.seamless, true);
  assert.equal(run.metadata.sourceAnimation.sourceClip, 'Jog_Fwd_Loop');
  assert.equal(run.metadata.sourceAnimation.sourceSha256,
    '69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997');
  assert.equal(run.metadata.sourceAnimation.sampleRate, 30);
  assert.equal(run.metadata.sourceAnimation.sourceFrameCount, 29);
  assert.ok(run.tags.includes('imported-keyframes'));
  const jogProvenance = JSON.parse(await readFile(new URL(
    '../public/animations/quaternius-jog-fwd/provenance.json',
    import.meta.url,
  ), 'utf8'));
  assert.equal(jogProvenance.asset.id, run.id);
  assert.equal(jogProvenance.source.sourceClip, run.metadata.sourceAnimation.sourceClip);
  assert.equal(jogProvenance.source.sourceFileSha256,
    run.metadata.sourceAnimation.sourceSha256);
  assert.equal(jogProvenance.conversion.transformSpace, run.transformSpace);
  assert.equal(jogProvenance.conversion.rootMotion, run.rootMotion.mode);
  const runRootTrack = run.tracks.find((track) => track.kind === 'position' && track.target === 'root');
  const runRotationTracks = run.tracks.filter((track) => track.kind === 'quaternion');
  assert.ok(runRootTrack);
  assert.equal(runRootTrack.keys.length, 29);
  assert.equal(runRotationTracks.length, 22);
  assert.ok(runRotationTracks.every((track) => track.keys.length === 29));
  assert.ok(run.tracks.every((track) => track.keys.every((key) => key.interpolation === 'linear')));
  for (const track of [runRootTrack, ...runRotationTracks]) {
    assert.deepEqual(track.keys.at(-1).value, track.keys[0].value,
      `${track.target} did not close the Jog_Fwd loop`);
  }
  assert.ok(Math.min(...runRootTrack.keys.map((key) => key.value[1])) < -0.2,
    'source pelvis compression was not retained on the visual root');
  assert.ok(Math.max(...runRootTrack.keys.map((key) => key.value[1])) > 0.02,
    'source flight/rebound height was not retained on the visual root');
  assert.deepEqual(run.tracks.filter((track) => track.kind === 'scalar'), [],
    'Jog_Fwd should not invent squash/stretch controls absent from the source');
  for (const track of runRotationTracks) {
    for (const key of track.keys) near(Math.hypot(...key.value), 1, 2e-6);
  }
  assert.deepEqual(run.contacts.map(({ effector }) => effector), ['footLeft', 'footRight']);
  near(run.markers[0].time, 0.067, 1e-6);
  near(run.markers[1].time, 0.533, 1e-6);

  // No raw source positions survive outside the cyclic pelvis/root channel;
  // the procedural character keeps its Character Lab-authored proportions.
  const runScalarTracks = run.tracks.filter((track) => track.kind === 'scalar');
  assert.deepEqual(runScalarTracks, []);
  assert.ok(run.tracks.some((track) => track.kind === 'quaternion' && track.target === 'neck'));
  assert.ok(run.tracks.some((track) => track.kind === 'quaternion' && track.target === 'head'));

  // The pace transition is selectable, strictly in-place, and ends on the
  // exact channels idle takes over on its first authored frame.
  assert.equal(paceStop.duration, 1.8);
  assert.equal(paceStop.loop.mode, 'once');
  assert.equal(paceStop.loop.seamless, false);
  assert.equal(paceStop.rootMotion.mode, 'in-place');
  assert.ok(paceStop.contacts.length >= 5);
  assert.ok(paceStop.markers.some((marker) => marker.name === 'Idle-compatible pose'));
  const paceRootTrack = paceStop.tracks.find((track) => track.kind === 'position' && track.target === 'root');
  assert.ok(paceRootTrack.keys.every((key) => key.value[0] === 0 && key.value[2] === 0));
  const paceEnd = sampleClip(paceStop, paceStop.duration);
  const idleEntry = sampleClip(idle, 0);
  assert.deepEqual(paceEnd.joints.root.position, idleEntry.joints.root.position);
  for (const jointId of ['spine', 'head', 'shoulderLeft', 'shoulderRight']) {
    assert.deepEqual(paceEnd.joints[jointId].quaternion, idleEntry.joints[jointId].quaternion,
      `${jointId} did not hand off exactly to idle`);
  }
  near(paceEnd.scalars[PLAYER_DEFORMATION_CONTROLS.torso],
    idleEntry.scalars[PLAYER_DEFORMATION_CONTROLS.torso]);
  assert.deepEqual(
    paceStop.tracks.filter((track) => track.kind === 'scalar').map((track) => track.target),
    [PLAYER_DEFORMATION_CONTROLS.torso],
  );
  const paceDecayDrivers = paceStop.proceduralDrivers.filter((driver) =>
    driver.type === 'envelope' && driver.blend === 'multiply' && driver.source === 'actionProgress');
  assert.ok(paceDecayDrivers.length >= 5, 'pace overlap was not procedurally damped');
  assert.ok(paceStop.proceduralDrivers.some((driver) => driver.source === 'transitionEntryGaitPhase'));
  assert.ok(paceStop.proceduralDrivers.some((driver) => driver.source === 'transitionEntrySpeed'));
  const paceEndpointContext = {
    normalizedSpeed: 0,
    gaitPhase: 0,
    verticalVelocity: 0,
    grounded: true,
    actionProgress: 1,
    inputs: { transitionEntryGaitPhase: 0.25, transitionEntrySpeed: 1 },
  };
  const finishedOverlap = sampleProceduralDrivers(
    paceStop.proceduralDrivers,
    paceStop.duration,
    paceEndpointContext,
  );
  near(finishedOverlap.pose.joints.root.position[1], 0);
  const composedPaceEnd = sampleComposedClip(paceStop, paceStop.duration, paceEndpointContext);
  const composedIdleEntry = sampleComposedClip(idle, 0, { ...paceEndpointContext, actionProgress: 0 });
  assert.deepEqual(composedPaceEnd.joints.root.position, composedIdleEntry.joints.root.position);
  for (const jointId of ['spine', 'head', 'shoulderLeft', 'shoulderRight']) {
    assert.deepEqual(composedPaceEnd.joints[jointId].quaternion, composedIdleEntry.joints[jointId].quaternion,
      `${jointId} composed transition endpoint did not match composed idle entry`);
  }
  near(composedPaceEnd.scalars[PLAYER_DEFORMATION_CONTROLS.torso],
    composedIdleEntry.scalars[PLAYER_DEFORMATION_CONTROLS.torso]);

  // Catalog upgrades append only clips introduced after the saved revision.
  // Same-ID authored work wins, while a current revision makes deletion an
  // intentional, persistent choice.
  const customizedIdle = { ...idle, name: 'My Hand-Tuned Idle' };
  const versionOneSuite = {
    ...parsedSuite,
    clips: parsedSuite.clips
      .filter((clip) => clip.id !== 'player.pace-stop' && clip.id !== 'player.run')
      .map((clip) => clip.id === customizedIdle.id ? customizedIdle : clip),
    metadata: { ...parsedSuite.metadata, playerStarterCatalogVersion: 1 },
  };
  const upgradedCatalog = reconcilePlayerStarterAnimationSuite(versionOneSuite, binding.definition);
  assert.equal(upgradedCatalog.metadata.playerStarterCatalogVersion, PLAYER_STARTER_CATALOG_VERSION);
  assert.equal(upgradedCatalog.clips.length, versionOneSuite.clips.length + 1);
  assert.equal(findClip(upgradedCatalog, 'player.idle'), customizedIdle,
    'reconciliation replaced a customized same-ID clip');
  assert.ok(findClip(upgradedCatalog, 'player.pace-stop'), 'new catalog clip was not appended');
  assert.equal(findClip(upgradedCatalog, 'player.run'), undefined,
    'a clip from an already-seen revision was resurrected');

  // Catalog v4 makes Jog_Fwd authoritative at `player.run`. The untouched v2
  // starter is replaced directly; a locally edited old Run is retained under
  // a backup ID so local data cannot hide the requested source animation.
  const legacyRunFixture = JSON.parse(gunzipSync(Buffer.from(
    (await readFile(
      new URL('./fixtures/player-run-catalog-v2.json.gz.b64', import.meta.url),
      'utf8',
    )).replace(/\s/g, ''),
    'base64',
  )).toString('utf8'));
  const legacyRunSuite = {
    ...parsedSuite,
    clips: parsedSuite.clips.map((clip) =>
      clip.id === 'player.run' ? legacyRunFixture : clip),
    metadata: { ...parsedSuite.metadata, playerStarterCatalogVersion: 2 },
  };
  const normalizedLegacyRunSuite = parseAnimationSuite(legacyRunSuite);
  const importedRunUpgrade = reconcilePlayerStarterAnimationSuite(
    normalizedLegacyRunSuite,
    binding.definition,
  );
  assert.equal(findClip(importedRunUpgrade, 'player.run').name, 'Run — Quaternius Jog_Fwd');
  assert.equal(
    findClip(importedRunUpgrade, 'player.run').metadata.sourceAnimation.sourceClip,
    'Jog_Fwd_Loop',
  );
  assert.equal(findClip(importedRunUpgrade, 'player.run.pre-jog-local'), undefined,
    'untouched source starter did not need a local backup');
  const customizedLegacyRun = structuredClone(findClip(normalizedLegacyRunSuite, 'player.run'));
  customizedLegacyRun.tracks[0].keys[1].value[1] += 0.001;
  const customizedRunSuite = {
    ...normalizedLegacyRunSuite,
    clips: normalizedLegacyRunSuite.clips.map((clip) =>
      clip.id === 'player.run' ? customizedLegacyRun : clip),
    metadata: { ...normalizedLegacyRunSuite.metadata, playerStarterCatalogVersion: 3 },
  };
  const replacedCustomizedRun = reconcilePlayerStarterAnimationSuite(
    customizedRunSuite,
    binding.definition,
  );
  assert.equal(findClip(replacedCustomizedRun, 'player.run').name, 'Run — Quaternius Jog_Fwd');
  const localRunBackup = findClip(replacedCustomizedRun, 'player.run.pre-jog-local');
  assert.ok(localRunBackup, 'browser-customized pre-Jog Run was not backed up');
  assert.equal(localRunBackup.tracks[0].keys[1].value[1],
    customizedLegacyRun.tracks[0].keys[1].value[1]);
  assert.ok(localRunBackup.tags.includes('local-backup'));

  // Once a draft already contains Jog_Fwd, ordinary browser edits to that
  // imported clip remain authoritative through the catalog-v4 bump.
  const customizedJogRun = structuredClone(run);
  customizedJogRun.name = 'My Tuned Jog_Fwd';
  customizedJogRun.tracks[0].keys[1].value[1] += 0.002;
  const versionThreeJogSuite = {
    ...parsedSuite,
    clips: parsedSuite.clips.map((clip) =>
      clip.id === 'player.run' ? customizedJogRun : clip),
    metadata: { ...parsedSuite.metadata, playerStarterCatalogVersion: 3 },
  };
  const preservedJogRun = reconcilePlayerStarterAnimationSuite(
    versionThreeJogSuite,
    binding.definition,
  );
  assert.equal(findClip(preservedJogRun, 'player.run'), customizedJogRun,
    'catalog reconciliation replaced an already-imported Jog_Fwd edit');
  assert.equal(findClip(preservedJogRun, 'player.run.pre-jog-local'), undefined);

  // Catalog v5 replaces only the untouched Slam identity placeholder. A user
  // who already authored any slam channel keeps that browser-owned work.
  const slamPlaceholder = {
    ...structuredClone(slam),
    name: 'Slam — Starter Placeholder',
    tracks: [],
    proceduralDrivers: [],
    markers: [],
    tags: ['player', 'starter-placeholder'],
    metadata: {
      starterQuality: 'identity-placeholder',
      note: 'Rest-pose slot ready for browser keyframing.',
    },
  };
  const versionFourPlaceholderSuite = {
    ...parsedSuite,
    clips: parsedSuite.clips.map((clip) =>
      clip.id === 'player.slam' ? slamPlaceholder : clip),
    metadata: { ...parsedSuite.metadata, playerStarterCatalogVersion: 4 },
  };
  const upgradedUnitySlam = reconcilePlayerStarterAnimationSuite(
    versionFourPlaceholderSuite,
    binding.definition,
  );
  assert.equal(findClip(upgradedUnitySlam, 'player.slam').name, 'Body Slam — Unity Pose');
  assert.equal(findClip(upgradedUnitySlam, 'player.slam').tracks.length, 8);
  const editedSlamPlaceholder = {
    ...slamPlaceholder,
    name: 'My Authored Slam',
    tracks: [structuredClone(slam.tracks[0])],
  };
  const preservedEditedSlam = reconcilePlayerStarterAnimationSuite({
    ...versionFourPlaceholderSuite,
    clips: versionFourPlaceholderSuite.clips.map((clip) =>
      clip.id === 'player.slam' ? editedSlamPlaceholder : clip),
  }, binding.definition);
  assert.equal(findClip(preservedEditedSlam, 'player.slam'), editedSlamPlaceholder,
    'catalog v5 replaced an edited local slam clip');

  const versionFiveWithoutDoubleJump = {
    ...parsedSuite,
    clips: parsedSuite.clips.filter((clip) => clip.id !== 'player.double-jump'),
    metadata: { ...parsedSuite.metadata, playerStarterCatalogVersion: 5 },
  };
  const upgradedDoubleJump = reconcilePlayerStarterAnimationSuite(
    versionFiveWithoutDoubleJump,
    binding.definition,
  );
  assert.equal(findClip(upgradedDoubleJump, 'player.double-jump').name,
    'Double Jump — Split High Jump');

  const deliberatelyDeleted = {
    ...upgradedCatalog,
    clips: upgradedCatalog.clips.filter((clip) => clip.id !== 'player.pace-stop'),
  };
  const refreshedCurrentCatalog = reconcilePlayerStarterAnimationSuite(deliberatelyDeleted, binding.definition);
  assert.equal(findClip(refreshedCurrentCatalog, 'player.pace-stop'), undefined,
    'a current version should preserve deliberate deletion');
  assert.equal(refreshedCurrentCatalog.rigs.find((candidate) => candidate.id === binding.definition.id),
    binding.definition, 'reconciliation did not refresh the embedded live rig');
  const suiteMissingLiveRig = { ...deliberatelyDeleted, rigs: [] };
  const appendedLiveRig = reconcilePlayerStarterAnimationSuite(suiteMissingLiveRig, binding.definition);
  assert.equal(appendedLiveRig.rigs.at(-1), binding.definition,
    'reconciliation did not append a missing live rig');

  // Applying the same pose twice must produce the same absolute scene state.
  const appliedPose = {
    joints: {
      hips: {
        position: [0.2, -0.1, 0.05],
        quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4).toArray(),
        scale: [1.2, 0.8, 1.1],
      },
    },
    scalars: { [PLAYER_DEFORMATION_CONTROLS.torso]: 0.7 },
  };
  binding.applyPose(appliedPose);
  const once = {
    position: hips.position.clone(),
    quaternion: hips.quaternion.clone(),
    scale: hips.scale.clone(),
  };
  binding.applyPose(appliedPose);
  assert.ok(hips.position.equals(once.position));
  assert.ok(hips.quaternion.equals(once.quaternion));
  assert.ok(hips.scale.equals(once.scale));
  near(scalarValues.get(PLAYER_DEFORMATION_CONTROLS.torso), 0.7);
  const captured = binding.capturePose(['hips']);
  near(captured.joints.hips.position[0], 0.2);
  binding.resetPose();
  near(hips.position.y, 0.71);
  near(hips.scale.x, 1);

  const mirrored = mirrorPose({
    joints: { hipLeft: { position: [0.25, 0.1, -0.2], quaternion: [0.1, 0.2, 0.3, 0.9] } },
    scalars: {},
  }, binding.definition);
  assert.deepEqual(mirrored.joints.hipRight.position, [-0.25, 0.1, -0.2]);
  assert.deepEqual(mirrored.joints.hipRight.quaternion, [0.1, -0.2, -0.3, 0.9]);

  // q and -q represent the same rotation; interpolation must take the short hemisphere.
  const halfTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2).toArray();
  const quaternionSample = sampleQuaternionKeys([
    createQuaternionKeyframe(0, halfTurn, 'linear', 'q0'),
    createQuaternionKeyframe(1, halfTurn.map((value) => -value), 'linear', 'q1'),
  ], 0.5);
  near(Math.abs(quaternionSample.reduce((sum, value, index) => sum + value * halfTurn[index], 0)), 1);
  near(sampleScalarKeys([
    createScalarKeyframe(0, 0, 'cubic', 's0'),
    createScalarKeyframe(1, 1, 'cubic', 's1'),
  ], 0.5), 0.5);

  const speedClip = createAnimationClip({ id: 'speed', name: 'Speed', rigId: binding.definition.id, duration: 1, playbackSpeed: 2 });
  near(clipTimeAt(speedClip, 0.75), 0.5);
  speedClip.loop.mode = 'once';
  near(clipTimeAt(speedClip, 2), 1);
  speedClip.loop.mode = 'ping-pong';
  near(clipTimeAt(speedClip, 0.75), 0.5);

  const motion = {
    normalizedSpeed: 0.6,
    gaitPhase: 0.25,
    verticalVelocity: -2,
    grounded: true,
    actionProgress: 0.25,
    inputs: { lean: 0.5 },
  };
  const proceduralTarget = { kind: 'position', target: 'hips', component: 'y' };
  const sine = createProceduralDriver('oscillator', proceduralTarget, {
    id: 'driver-sine', source: 'gaitPhase', amplitude: 2, frequency: 1, phase: 0, bias: 1,
  });
  near(sampleProceduralDriverValue(sine, 99, motion).value, 3);
  const triangle = createProceduralDriver('oscillator', proceduralTarget, {
    id: 'driver-triangle', source: 'gaitPhase', waveform: 'triangle', frequency: 2,
  });
  near(sampleProceduralDriverValue(triangle, 0, motion).value, 1);
  const saw = createProceduralDriver('oscillator', proceduralTarget, {
    id: 'driver-saw', source: 'gaitPhase', waveform: 'saw', phase: 0.5,
  });
  near(sampleProceduralDriverValue(saw, 0, motion).value, 0.5);
  const pulse = createProceduralDriver('pulse', proceduralTarget, {
    id: 'driver-pulse', source: 'gaitPhase', dutyCycle: 0.5,
  });
  near(sampleProceduralDriverValue(pulse, 0, motion).value, 1);
  const envelope = createProceduralDriver('envelope', proceduralTarget, {
    id: 'driver-envelope', source: 'actionProgress', attack: 0.2, hold: 0.3, release: 0.5, loop: false,
  });
  near(sampleProceduralDriverValue(envelope, 0, motion).value, 1);
  const response = createProceduralDriver('response', proceduralTarget, {
    id: 'driver-response', source: 'lean', inputRange: [0, 1], responseCurve: 'smootherstep',
  });
  near(sampleProceduralDriverValue(response, 0, motion).value, 0.5);
  const noise = createProceduralDriver('noise', proceduralTarget, {
    id: 'driver-noise', source: 'time', seed: 417, frequency: 3.25,
  });
  const noiseBefore = sampleProceduralDriverValue(noise, 1.2345, motion).value;
  sampleProceduralDriverValue(noise, 88.5, motion);
  const noiseAfter = sampleProceduralDriverValue(noise, 1.2345, motion).value;
  assert.equal(noiseBefore, noiseAfter, 'noise sampling depended on evaluation history');

  const orderedDrivers = [
    createProceduralDriver('response', proceduralTarget, {
      id: 'driver-override', order: 0, blend: 'override', source: 'lean', inputRange: [0, 1], amplitude: 4,
    }),
    createProceduralDriver('response', proceduralTarget, {
      id: 'driver-multiply', order: 1, blend: 'multiply', source: 'grounded', inputRange: [0, 1], amplitude: 3,
    }),
    createProceduralDriver('response', proceduralTarget, {
      id: 'driver-add', order: 2, blend: 'additive', source: 'grounded', inputRange: [0, 1], amplitude: 1,
    }),
  ];
  const orderedPose = sampleProceduralDrivers(orderedDrivers, 0, motion);
  near(orderedPose.pose.joints.hips.position[1], 7);
  assert.deepEqual(orderedPose.operations.map((operation) => operation.driverId),
    ['driver-override', 'driver-multiply', 'driver-add']);

  const scalarDriver = createProceduralDriver('oscillator', {
    kind: 'scalar', target: PLAYER_DEFORMATION_CONTROLS.torso, baseValue: 1,
  }, {
    id: 'driver-scalar', source: 'gaitPhase', amplitude: 0.1,
  });
  near(sampleProceduralDrivers([scalarDriver], 0, motion).pose.scalars[PLAYER_DEFORMATION_CONTROLS.torso], 1.1);
  const rotationDriver = createProceduralDriver('response', {
    kind: 'quaternion', target: 'spine', axis: [0, 1, 0],
  }, {
    id: 'driver-rotation', source: 'grounded', inputRange: [0, 1], amplitude: 0.5,
  });
  const rotationPose = sampleProceduralDrivers([rotationDriver], 0, motion).pose.joints.spine.quaternion;
  near(rotationPose[1], Math.sin(0.25));
  near(rotationPose[3], Math.cos(0.25));

  let composedClip = createAnimationClip({ id: 'composed', name: 'Composed', rigId: binding.definition.id, duration: 1 });
  const composedTrack = createAnimationTrack('position', 'hips', 'composed-position');
  composedClip = upsertTrack(composedClip, composedTrack);
  composedClip = upsertKeyframe(composedClip, composedTrack.id,
    createVectorKeyframe(0, [0, 0.1, 0], 'linear', 'composed-key-0'));
  composedClip = upsertKeyframe(composedClip, composedTrack.id,
    createVectorKeyframe(1, [0, 0.1, 0], 'linear', 'composed-key-1'));
  composedClip.proceduralDrivers = [createProceduralDriver('oscillator', proceduralTarget, {
    id: 'composed-driver', blend: 'override', source: 'gaitPhase', amplitude: 0.2,
  })];
  near(sampleComposedClip(composedClip, 0.5, motion).joints.hips.position[1], 0.3);
  near(sampleComposedClip(composedClip, 0.5, motion, { order: 'keyed-then-procedural' }).joints.hips.position[1], 0.2);
  const proceduralSample = sampleProceduralDrivers(composedClip.proceduralDrivers, 0.5, motion);
  near(composeProceduralPose(sampleClip(composedClip, 0.5), proceduralSample).joints.hips.position[1], 0.3);

  const missingCustom = createProceduralDriver('custom', proceduralTarget, {
    id: 'driver-custom', evaluatorId: 'gait.custom', source: 'time', amplitude: 2,
  });
  const missingCustomSample = sampleProceduralDrivers([missingCustom], 0.2, motion);
  assert.equal(missingCustomSample.operations.length, 0);
  assert.equal(missingCustomSample.issues.length, 1);
  const customRegistry = { 'gait.custom': (_driver, context) => context.sourceValue + 0.25 };
  near(sampleProceduralDrivers([missingCustom], 0.25, motion, { evaluators: customRegistry })
    .pose.joints.hips.position[1], 1);
  const customClip = { ...composedClip, proceduralDrivers: [missingCustom] };
  assert.equal(validateProceduralEvaluators(customClip).valid, true);
  assert.equal(validateProceduralEvaluators(customClip).issues.length, 1);
  assert.equal(validateProceduralEvaluators(customClip, customRegistry).issues.length, 0);

  const mirroredClip = mirrorClip({ ...composedClip, proceduralDrivers: [
    createProceduralDriver('oscillator', { kind: 'position', target: 'hipLeft', component: 'x' }, {
      id: 'mirror-position', amplitude: 0.2, bias: 0.1, clamp: [-0.3, 0.4],
    }),
    createProceduralDriver('oscillator', { kind: 'quaternion', target: 'shoulderLeft', axis: [0, 1, 0] }, {
      id: 'mirror-rotation', amplitude: 0.3,
    }),
  ] }, binding.definition);
  const mirroredPositionDriver = mirroredClip.proceduralDrivers.find((driver) => driver.id === 'mirror-position');
  assert.equal(mirroredPositionDriver.target.target, 'hipRight');
  assert.equal(mirroredPositionDriver.amplitude, -0.2);
  assert.deepEqual(mirroredPositionDriver.clamp, [-0.4, 0.3]);
  const mirroredRotationDriver = mirroredClip.proceduralDrivers.find((driver) => driver.id === 'mirror-rotation');
  assert.deepEqual(mirroredRotationDriver.target.axis, [0, -1, 0]);

  const bakeSource = createAnimationClip({ id: 'bake-source', name: 'Bake Source', rigId: binding.definition.id, duration: 1 });
  bakeSource.proceduralDrivers = [createProceduralDriver('oscillator', proceduralTarget, {
    id: 'bake-oscillator', source: 'time', amplitude: 1, frequency: 1,
  })];
  const baked = bakeProceduralClip(bakeSource, { fps: 4 });
  assert.equal(baked.proceduralDrivers.length, 0);
  assert.equal(baked.tracks.length, 1);
  assert.equal(baked.tracks[0].keys.length, 5);
  near(sampleClip(baked, 0.25).joints.hips.position[1], 1);
  const secondBakeDriver = createProceduralDriver('oscillator', {
    kind: 'position', target: 'hips', component: 'x',
  }, { id: 'bake-retained', source: 'time', amplitude: 0.2 });
  const partialBake = bakeProceduralClip({
    ...bakeSource,
    proceduralDrivers: [...bakeSource.proceduralDrivers, secondBakeDriver],
  }, { fps: 4, driverIds: ['bake-oscillator'], id: 'partial-bake' });
  assert.deepEqual(partialBake.proceduralDrivers.map((driver) => driver.id), ['bake-retained']);
  assert.ok(partialBake.tracks.some((track) => track.kind === 'position' && track.target === 'hips'));
  const bakedValidation = validateAnimationSuite(createAnimationSuiteDocument({
    id: 'baked-suite', name: 'Baked Suite', rigs: [binding.definition], clips: [baked], activeClipId: baked.id,
  }));
  assert.equal(bakedValidation.valid, true, JSON.stringify(bakedValidation.issues));

  const invalidDriverClip = createAnimationClip({ id: 'invalid-driver', name: 'Invalid', rigId: binding.definition.id });
  invalidDriverClip.proceduralDrivers = [createProceduralDriver('oscillator', {
    kind: 'quaternion', target: 'spine', axis: [0, 0, 0],
  }, { id: 'invalid-axis' })];
  const invalidDriverResult = validateAnimationSuite(createAnimationSuiteDocument({
    id: 'invalid-suite', name: 'Invalid Suite', rigs: [binding.definition], clips: [invalidDriverClip],
  }));
  assert.equal(invalidDriverResult.valid, false);
  assert.ok(invalidDriverResult.issues.some((entry) => entry.code === 'axis.zero'));

  let editClip = createAnimationClip({ id: 'edit', name: 'Edit', rigId: binding.definition.id, duration: 1 });
  const position = createAnimationTrack('position', 'hips', 'edit-position');
  editClip = upsertTrack(editClip, position);
  editClip = upsertKeyframe(editClip, position.id, createVectorKeyframe(0.5, [1, 2, 3], 'linear', 'edit-key'));
  assert.equal(editClip.tracks[0].keys.length, 1);
  editClip = removeKeyframe(editClip, position.id, 'edit-key');
  assert.equal(editClip.tracks[0].keys.length, 0);
  let editedDocument = createAnimationSuiteDocument({ id: 'crud', name: 'CRUD', rigs: [binding.definition] });
  editedDocument = upsertClip(editedDocument, editClip);
  editedDocument = setActiveClip(editedDocument, editClip.id);
  assert.equal(findClip(editedDocument, editClip.id), editClip);
  editedDocument = removeClip(editedDocument, editClip.id);
  assert.equal(editedDocument.activeClipId, undefined);

  const legacy = migrateAnimationSuite({
    id: 'legacy',
    name: 'Legacy',
    rig: {
      id: 'legacy-rig',
      name: 'Legacy Rig',
      joints: [{ id: 'root', name: 'root-node', parentId: null, restLocal: {
        translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1],
      } }],
      rootJointId: 'root',
    },
    animations: [{
      id: 'legacy-clip',
      name: 'Legacy Clip',
      duration: 1,
      speed: 1.25,
      loop: false,
      tracks: [{ id: 'legacy-track', channel: 'translation', jointId: 'root', keyframes: [
        { keyId: 'legacy-key', time: 0, value: [0, 0, 0], interpolation: 'hold' },
      ] }],
      drivers: [{
        id: 'legacy-driver',
        type: 'oscillator',
        target: { kind: 'position', target: 'root', component: 'x' },
        source: 'time',
        amplitude: 0.1,
      }],
    }],
    selectedClipId: 'legacy-clip',
  });
  const parsedLegacy = parseAnimationSuite(legacy);
  assert.equal(parsedLegacy.version, ANIMATION_SUITE_SCHEMA_VERSION);
  assert.equal(parsedLegacy.clips[0].proceduralDrivers.length, 1);
  assert.equal(parsedLegacy.clips[0].proceduralDrivers[0].schema, 'sol-procedural-driver');
  assert.equal(parsedLegacy.clips[0].playbackSpeed, 1.25);
  assert.equal(parsedLegacy.clips[0].tracks[0].keys[0].interpolation, 'step');

  const versionOne = {
    ...structuredClone(parsedSuite),
    version: 1,
    clips: parsedSuite.clips.map(({ proceduralDrivers: _drivers, proceduralOrder: _order, ...clip }) => clip),
  };
  const migratedVersionOne = parseAnimationSuite(versionOne);
  assert.equal(migratedVersionOne.version, ANIMATION_SUITE_SCHEMA_VERSION);
  assert.ok(migratedVersionOne.clips.every((clip) => clip.proceduralDrivers.length === 0));

  // Existing suite-v2 drafts commonly embed rig-v1. Upgrading the nested rig
  // must retain every clip/key and the original deformation policy.
  const versionTwoDraftWithRigOne = structuredClone(parsedSuite);
  versionTwoDraftWithRigOne.rigs[0].version = 1;
  const upgradedRigOneDraft = parseAnimationSuite(versionTwoDraftWithRigOne);
  assert.equal(upgradedRigOneDraft.rigs[0].version, RIG_SCHEMA_VERSION);
  const clipStructure = (document) => document.clips.map((clip) => ({
    id: clip.id,
    playbackSpeed: clip.playbackSpeed,
    tracks: clip.tracks.map((track) => ({
      id: track.id,
      kind: track.kind,
      target: track.target,
      keys: track.keys.map((key) => [key.id, key.time]),
    })),
    drivers: clip.proceduralDrivers.map((driver) => [driver.id, driver.target.kind, driver.target.target]),
  }));
  assert.deepEqual(clipStructure(upgradedRigOneDraft), clipStructure(parsedSuite));
  near(
    sampleClip(findClip(upgradedRigOneDraft, 'player.jump'), 0.32)
      .scalars[PLAYER_DEFORMATION_CONTROLS.legLowerLeft],
    sampleClip(findClip(parsedSuite, 'player.jump'), 0.32)
      .scalars[PLAYER_DEFORMATION_CONTROLS.legLowerLeft],
  );
  assert.equal(upgradedRigOneDraft.rigs[0].joints.find((joint) => joint.id === 'hipLeft').stretch.controlId,
    PLAYER_DEFORMATION_CONTROLS.legUpperLeft);

  const reverseOrder = { ...parsedSuite, clips: [...parsedSuite.clips].reverse(), rigs: [...parsedSuite.rigs].reverse() };
  assert.equal(stringifyAnimationSuite(parsedSuite), stringifyAnimationSuite(reverseOrder));
  const reversedDrivers = structuredClone(parsedSuite);
  for (const clip of reversedDrivers.clips) clip.proceduralDrivers.reverse();
  assert.equal(stringifyAnimationSuite(parsedSuite), stringifyAnimationSuite(reversedDrivers));

  class MemoryStorage {
    data = new Map();
    get length() { return this.data.size; }
    getItem(key) { return this.data.get(key) ?? null; }
    setItem(key, value) { this.data.set(key, value); }
    removeItem(key) { this.data.delete(key); }
    key(index) { return [...this.data.keys()][index] ?? null; }
  }
  const drafts = createLocalDraftStore(new MemoryStorage());
  drafts.save(parsedSuite);
  assert.equal(drafts.has(parsedSuite.id), true);
  assert.deepEqual(drafts.listDocumentIds(), [parsedSuite.id]);
  assert.equal(drafts.load(parsedSuite.id).clips.length, 19);
  drafts.remove(parsedSuite.id);
  assert.equal(drafts.load(parsedSuite.id), null);

  console.log('PASS animation suite core, procedural drivers/bake, rig binding, catalog, and drafts');
} finally {
  await server.close();
}
