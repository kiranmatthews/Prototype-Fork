import assert from 'node:assert/strict';
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
  const {
    PLAYER_STATE_CLIP_IDS,
    createCharacterAnimationRuntime,
  } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');

  const root = new THREE.Group();
  root.name = 'runtime-rig-root';
  const hips = new THREE.Group();
  hips.name = 'runtime-hips';
  hips.position.y = 2;
  root.add(hips);
  const head = new THREE.Group();
  head.name = 'runtime-head';
  head.position.y = 3;
  hips.add(head);
  root.userData.sculptRuntime = {
    schemaVersion: 2,
    kind: 'procedural-character',
    rigId: 'player-procedural-v1',
    rigName: 'Runtime Test Rider',
    joints: {
      root: root.name,
      hips: hips.name,
      head: head.name,
    },
    controls: {
      'deform.torso.length': { defaultValue: 1, min: 0.5, max: 1.5 },
    },
    restPose: {
      root: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
      hips: { position: [0, 2, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
      head: { position: [0, 3, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
    },
  };

  const allIds = [...PLAYER_STATE_CLIP_IDS, 'player.land'];
  assert.equal(allIds.length, 17);
  assert.equal(new Set(allIds).size, 17);

  const positionTrack = (clipId, x) => ({
    id: `${clipId}:hips`,
    kind: 'position',
    target: 'hips',
    keys: [
      { id: `${clipId}:a`, time: 0, value: [x, 0, 0], interpolation: 'linear' },
      { id: `${clipId}:b`, time: 1, value: [x + 1, 0, 0], interpolation: 'linear' },
    ],
  });
  const makeClip = (id, x) => ({
    id,
    name: id,
    rigId: 'player-procedural-v1',
    duration: 1,
    playbackSpeed: 1,
    loop: { mode: id === 'player.land' ? 'once' : 'loop', seamless: id !== 'player.land' },
    range: { start: 0, end: id === 'player.land' ? 0.2 : 1 },
    rootMotion: { mode: 'in-place' },
    transformSpace: 'rest-local-delta',
    tracks: [positionTrack(id, x)],
    proceduralOrder: 'procedural-then-keyed',
    proceduralDrivers: [],
    markers: [],
    contacts: [],
    events: [],
  });
  const clips = allIds.map((id, index) => makeClip(id, index));
  const suite = {
    schema: 'sol-animation-suite',
    version: 2,
    id: 'runtime-test',
    name: 'Runtime Test',
    rigs: [],
    clips,
  };

  let hint = 'player.idle';
  let grounded = true;
  let normalizedSpeed = 0.5;
  let gaitPhase = 0.25;
  let verticalVelocity = -3;
  let actionProgress = 0.4;
  let motionInputs = { balance: 0.75, charge: 0.2, travelSign: 1 };
  let overlay = null;
  let overlayRemoved = 0;
  let deformationValues = null;
  let hipsXWhenDeformed = null;
  const fakePlayer = {
    get grounded() { return grounded; },
    get animationClipHint() { return hint; },
    get animationIntent() {
      return {
        clipId: hint,
        motion: {
          normalizedSpeed,
          gaitPhase,
          verticalVelocity,
          grounded,
          actionProgress,
          inputs: motionInputs,
        },
      };
    },
    animationRig: { root },
    setAuthoredPoseOverlay(next) {
      overlay = next;
      return () => {
        if (overlay === next) overlay = null;
        overlayRemoved++;
      };
    },
  };
  const tick = (dt) => {
    assert.ok(overlay, 'runtime overlay was not installed');
    overlay({
      deltaSeconds: dt,
      applyDeformations(values) {
        hipsXWhenDeformed = hips.position.x;
        deformationValues = { ...values };
      },
    });
  };

  const runtime = createCharacterAnimationRuntime(fakePlayer, suite);
  assert.equal(runtime.binding.root, root);

  // The authored pose is a final presentation layer. It replaces its tracked
  // hip channel while leaving an untracked legacy head channel untouched.
  hips.position.x = 99;
  head.position.z = 7;
  tick(0.1);
  assert.equal(runtime.activeClipId, 'player.idle');
  near(hips.position.x, 0);
  near(head.position.z, 7);
  near(hipsXWhenDeformed, 0);

  // Every state-owned route resolves to its catalog clip.
  const stateRouteOrder = [
    ...PLAYER_STATE_CLIP_IDS.filter((id) => id !== 'player.jump' && id !== 'player.fall'),
    'player.jump',
    'player.fall',
  ];
  for (const id of stateRouteOrder) {
    hint = id;
    grounded = id !== 'player.jump' && id !== 'player.fall';
    runtime.restart();
    tick(0.016);
    assert.equal(runtime.activeClipId, id);
  }

  // Landing is detected from the public airborne -> grounded edge and held
  // for one range traversal before locomotion takes ownership again.
  hint = 'player.fall';
  grounded = false;
  runtime.restart();
  tick(0.016);
  hint = 'player.run';
  grounded = true;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.land');
  assert.equal(runtime.diagnostics.landingOneShotActive, true);
  near(runtime.diagnostics.motionContext.actionProgress, 0);
  tick(0.21);
  assert.equal(runtime.activeClipId, 'player.land');
  assert.equal(runtime.diagnostics.landingOneShotActive, false);
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.run');

  // Authored clip speed, live multiplier, range start, and looping all feed
  // the shared timeline conversion rather than a runtime-specific sampler.
  const timedIdle = {
    ...clips.find((clip) => clip.id === 'player.idle'),
    duration: 2,
    playbackSpeed: 2,
    range: { start: 0.5, end: 1.5 },
    tracks: [{
      id: 'timed-idle:hips',
      kind: 'position',
      target: 'hips',
      keys: [
        { id: 'timed-a', time: 0.5, value: [5, 0, 0], interpolation: 'linear' },
        { id: 'timed-b', time: 1, value: [10, 0, 0], interpolation: 'linear' },
        { id: 'timed-c', time: 1.5, value: [15, 0, 0], interpolation: 'linear' },
      ],
    }],
  };
  const timedSuite = { ...suite, clips: suite.clips.map((clip) => clip.id === timedIdle.id ? timedIdle : clip) };
  runtime.setDocument(timedSuite);
  runtime.setManualClipOverride('player.idle');
  tick(0.016);
  near(runtime.diagnostics.timelineTime, 0.5);
  near(hips.position.x, 5);
  tick(0.25);
  near(runtime.diagnostics.timelineTime, 1);
  near(hips.position.x, 10);
  tick(0.5);
  near(runtime.diagnostics.timelineTime, 1);
  near(hips.position.x, 10);
  runtime.setPlaybackSpeedMultiplier(0.5);
  runtime.restart();
  tick(0.016);
  tick(0.5);
  near(runtime.diagnostics.timelineTime, 1);
  near(hips.position.x, 10);

  // Scalar deformation is passed after transform sampling, and document
  // replacement changes an already-selected clip without rebuilding runtime.
  const liveIdle = {
    ...timedIdle,
    playbackSpeed: 1,
    tracks: [
      { ...timedIdle.tracks[0], keys: [
        { id: 'live-a', time: 0.5, value: [25, 0, 0], interpolation: 'step' },
      ] },
      {
        id: 'live-idle:torso',
        kind: 'scalar',
        target: 'deform.torso.length',
        keys: [{ id: 'live-scalar', time: 0.5, value: 1.3, interpolation: 'step' }],
      },
    ],
    proceduralDrivers: [{
      schema: 'sol-procedural-driver',
      version: 1,
      id: 'live-idle:speed-offset',
      order: 0,
      type: 'response',
      target: { kind: 'position', target: 'hips', component: 'x' },
      blend: 'additive',
      source: 'normalizedSpeed',
      amplitude: 4,
      frequency: 1,
      phase: 0,
      bias: 0,
      seed: 1,
      inputRange: [0, 1],
      curve: 'linear',
    }],
  };
  runtime.setDocument({ ...timedSuite, clips: timedSuite.clips.map((clip) => clip.id === liveIdle.id ? liveIdle : clip) });
  tick(0.016);
  // Explicit default order: procedural base first, then authored keyed
  // corrections. 0.5 normalized speed produces +2, then the +25 key.
  near(hips.position.x, 27);
  near(hipsXWhenDeformed, 27);
  near(deformationValues['deform.torso.length'], 1.3);
  assert.equal(runtime.diagnostics.proceduralOrder, 'procedural-then-keyed');
  assert.equal(runtime.diagnostics.proceduralDriverCount, 1);
  assert.deepEqual(runtime.diagnostics.motionContext, {
    normalizedSpeed: 0.5,
    gaitPhase: 0.25,
    verticalVelocity: -3,
    grounded: true,
    actionProgress: 0.4,
    inputs: { balance: 0.75, charge: 0.2, travelSign: 1 },
  });

  // Re-sampling the same clip time and gameplay context is scrub-safe: no
  // hidden driver state accumulates across restart/seek-equivalent playback.
  runtime.restart();
  tick(0.016);
  near(hips.position.x, 27);

  // The opposite explicit order lets a procedural override own the keyed
  // result, proving runtime delegates composition rather than hard-coding it.
  const overrideIdle = {
    ...liveIdle,
    proceduralOrder: 'keyed-then-procedural',
    proceduralDrivers: [{
      ...liveIdle.proceduralDrivers[0],
      id: 'live-idle:speed-override',
      blend: 'override',
    }],
  };
  runtime.setDocument({ ...timedSuite, clips: timedSuite.clips.map((clip) => clip.id === overrideIdle.id ? overrideIdle : clip) });
  runtime.restart();
  tick(0.016);
  near(hips.position.x, 2);
  near(hipsXWhenDeformed, 2);
  assert.equal(runtime.diagnostics.proceduralOrder, 'keyed-then-procedural');

  // A selected placeholder or missing clip is explicitly a no-op. The legacy
  // pose therefore survives until a real authored track exists.
  const proceduralOnly = {
    ...clips.find((clip) => clip.id === 'player.grind'),
    tracks: [],
    proceduralDrivers: [{
      schema: 'sol-procedural-driver',
      version: 1,
      id: 'grind:balance-control',
      order: 0,
      type: 'response',
      target: { kind: 'scalar', target: 'deform.torso.length', baseValue: 1 },
      blend: 'override',
      source: 'balance',
      amplitude: 1,
      frequency: 1,
      phase: 0,
      bias: 0,
      seed: 2,
      inputRange: [0, 1],
      curve: 'linear',
    }],
  };
  const placeholder = { ...clips.find((clip) => clip.id === 'player.hang'), tracks: [], proceduralDrivers: [] };
  runtime.setDocument({ ...suite, clips: suite.clips.map((clip) => {
    if (clip.id === proceduralOnly.id) return proceduralOnly;
    if (clip.id === placeholder.id) return placeholder;
    return clip;
  }) });
  runtime.setManualClipOverride('player.grind');
  hips.position.x = 123;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.grind');
  assert.equal(runtime.diagnostics.authoredPoseApplied, true);
  near(hips.position.x, 123);
  near(deformationValues['deform.torso.length'], 0.75);
  runtime.setManualClipOverride('player.hang');
  tick(0.016);
  assert.equal(runtime.activeClipId, null);
  assert.equal(runtime.diagnostics.authoredPoseApplied, false);
  runtime.setManualClipOverride('not-in-document');
  tick(0.016);
  assert.equal(runtime.activeClipId, null);

  runtime.dispose();
  assert.equal(overlay, null);
  assert.equal(overlayRemoved, 1);
  assert.equal(runtime.diagnostics.disposed, true);
  runtime.dispose();
  assert.equal(overlayRemoved, 1);

  console.log('PASS character animation runtime routing, procedural composition, live context, fallback, and disposal');
} finally {
  await server.close();
}
