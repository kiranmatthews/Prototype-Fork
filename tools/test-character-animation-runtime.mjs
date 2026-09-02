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
    PACE_STOP_CLIP_ID,
    ACTION_PROGRESS_TIMELINE_CLIP_IDS,
    PACE_STOP_CROSSFADE_SECONDS,
    PACE_STOP_MIN_PEAK_SPEED,
    PACE_STOP_MIN_RUN_SECONDS,
    LEGACY_GAMEPLAY_PRESENTATION_CLIP_IDS,
    PLAYER_STATE_CLIP_IDS,
    PLAYER_TRANSITION_CLIP_IDS,
    createCharacterAnimationRuntime,
  } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {
    UNITY_ROPE_CLIP_IDS,
    UNITY_ROPE_INPUTS,
    UNITY_ROPE_TIMING,
    UNITY_CROUCH_CRAWL_CLIP_IDS,
    UNITY_CRAWL_CONTACT_ADAPTATION,
    UNITY_CROUCH_CRAWL_TIMING,
  } = await server.ssrLoadModule('/src/animation/index.ts');

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
    jointAliases: {
      hips: ['legacyPelvis'],
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

  const allIds = [...PLAYER_STATE_CLIP_IDS, ...PLAYER_TRANSITION_CLIP_IDS];
  assert.equal(allIds.length, 21);
  assert.equal(new Set(allIds).size, 21);
  assert.deepEqual(LEGACY_GAMEPLAY_PRESENTATION_CLIP_IDS, ['player.skate']);
  assert.deepEqual(ACTION_PROGRESS_TIMELINE_CLIP_IDS, [
    'player.jump', 'player.double-jump', 'player.fall', 'player.rope-climb',
    'player.rope-release', 'player.slam',
  ]);

  const actionProgressTimelineIds = new Set(ACTION_PROGRESS_TIMELINE_CLIP_IDS);

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
    loop: { mode: PLAYER_TRANSITION_CLIP_IDS.includes(id) ? 'once' : 'loop', seamless: !PLAYER_TRANSITION_CLIP_IDS.includes(id) },
    range: { start: 0, end: id === 'player.land' ? 0.2 : id === PACE_STOP_CLIP_ID ? 0.4 : 1 },
    rootMotion: { mode: 'in-place' },
    transformSpace: 'rest-local-delta',
    tracks: [positionTrack(id, x)],
    proceduralOrder: 'procedural-then-keyed',
    proceduralDrivers: [],
    markers: [],
    contacts: [],
    events: [],
    metadata: actionProgressTimelineIds.has(id)
      ? { progressSource: 'gameplay-actionProgress' }
      : undefined,
  });
  const clips = allIds.map((id, index) => makeClip(id, index));
  const crawlClip = clips.find((clip) => clip.id === UNITY_CROUCH_CRAWL_CLIP_IDS.crawl);
  crawlClip.metadata = { contactAdaptation: UNITY_CRAWL_CONTACT_ADAPTATION };
  const chargedRopeRelease = makeClip(UNITY_ROPE_CLIP_IDS.chargedRelease, 100);
  chargedRopeRelease.metadata = { progressSource: 'gameplay-actionProgress' };
  clips.push(chargedRopeRelease);
  const ropeReleaseClip = clips.find((clip) => clip.id === UNITY_ROPE_CLIP_IDS.release);
  ropeReleaseClip.metadata = {
    ...ropeReleaseClip.metadata,
    variantBlend: {
      clipId: UNITY_ROPE_CLIP_IDS.chargedRelease,
      source: UNITY_ROPE_INPUTS.releaseCharge,
    },
  };
  const runClip = clips.find((clip) => clip.id === 'player.run');
  runClip.tracks.push({
    id: 'player.run:torso-length',
    kind: 'scalar',
    target: 'deform.torso.length',
    keys: [{ id: 'player.run:torso-length:key', time: 0, value: 1.4, interpolation: 'step' }],
  });
  const paceClip = clips.find((clip) => clip.id === PACE_STOP_CLIP_ID);
  // The pace clip deliberately owns only a historical alias. Runtime
  // playability must resolve it through the live binding, just like applyPose.
  paceClip.tracks = [positionTrack(PACE_STOP_CLIP_ID, allIds.indexOf(PACE_STOP_CLIP_ID))];
  paceClip.tracks[0].target = 'legacyPelvis';
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
  let lowPoseOuterOwnership = null;
  let lowPoseOuterOwnershipRemoved = 0;
  let crawlContactPhase = null;
  let crawlContactWeight = 0;
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
    setAuthoredCrawlContactPhase(phase, weight = 1) {
      crawlContactPhase = phase;
      crawlContactWeight = phase === null ? 0 : weight;
    },
    setAuthoredLowPoseOuterOwnership(next) {
      lowPoseOuterOwnership = next;
      return () => {
        if (lowPoseOuterOwnership === next) lowPoseOuterOwnership = null;
        lowPoseOuterOwnershipRemoved++;
      };
    },
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
  assert.equal(typeof lowPoseOuterOwnership, 'function');
  assert.equal(lowPoseOuterOwnership(0.016), 0,
    'ordinary test clips unexpectedly claimed Unity low-pose outer ownership');

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
  const airborneRoutes = new Set([
    'player.jump', 'player.double-jump', 'player.fall', 'player.rope-release',
  ]);
  const stateRouteOrder = [
    ...PLAYER_STATE_CLIP_IDS.filter((id) => !airborneRoutes.has(id)),
    ...airborneRoutes,
  ];
  for (const id of stateRouteOrder) {
    hint = id;
    grounded = !airborneRoutes.has(id);
    runtime.restart();
    if (id === 'player.skate') hips.position.x = 99;
    tick(0.016);
    if (id === 'player.skate') {
      assert.equal(runtime.diagnostics.requestedClipId, 'player.skate');
      assert.equal(runtime.activeClipId, null);
      assert.equal(runtime.diagnostics.authoredPoseApplied, false);
      near(hips.position.x, 99, 1e-8);
    } else {
      assert.equal(runtime.activeClipId, id);
      if (actionProgressTimelineIds.has(id))
        near(runtime.diagnostics.timelineTime, actionProgress);
    }
  }

  // Unity's attached rope states crossfade for exactly six source frames.
  // Climb phase is gameplay-scrubbed and may run forward or backward without
  // restarting the clip clock.
  hint = UNITY_ROPE_CLIP_IDS.hang;
  grounded = false;
  actionProgress = 0.2;
  motionInputs = { ...motionInputs, [UNITY_ROPE_INPUTS.releaseCharge]: 0 };
  runtime.restart();
  tick(0.001);
  const ropeHangX = hips.position.x;
  hint = UNITY_ROPE_CLIP_IDS.climb;
  actionProgress = 0.5;
  tick(0.016);
  near(hips.position.x, ropeHangX);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  tick(UNITY_ROPE_TIMING.attachedBlend);
  near(hips.position.x,
    allIds.indexOf(UNITY_ROPE_CLIP_IDS.climb) + actionProgress);
  near(runtime.diagnostics.transitionBlendWeight, 1);

  // Rope release continuously blends the Unity swing-jump and charged
  // backflip source clips from the fixed-step charge value.
  hint = 'player.idle';
  grounded = true;
  tick(0.016);
  hint = UNITY_ROPE_CLIP_IDS.release;
  grounded = false;
  actionProgress = 0.5;
  motionInputs = { ...motionInputs, [UNITY_ROPE_INPUTS.releaseCharge]: 0 };
  runtime.restart();
  tick(0.001);
  const lowReleaseX = allIds.indexOf(UNITY_ROPE_CLIP_IDS.release) + 0.5;
  near(hips.position.x, lowReleaseX);
  motionInputs = { ...motionInputs, [UNITY_ROPE_INPUTS.releaseCharge]: 1 };
  tick(0.016);
  near(hips.position.x, 100.5);
  motionInputs = { ...motionInputs, [UNITY_ROPE_INPUTS.releaseCharge]: 0.5 };
  tick(0.016);
  near(hips.position.x, (lowReleaseX + 100.5) * 0.5);

  // Unity crouch/crawl uses the same five-frame rapid blend on entry, exit,
  // and between the two low poses.
  hint = 'player.idle';
  grounded = false; // avoid synthesizing an unrelated landing edge in this routing fixture
  tick(0.016);
  hint = UNITY_CROUCH_CRAWL_CLIP_IDS.crouch;
  tick(0.016);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  tick(UNITY_CROUCH_CRAWL_TIMING.rapidBlend);
  near(runtime.diagnostics.transitionBlendWeight, 1);
  hint = UNITY_CROUCH_CRAWL_CLIP_IDS.crawl;
  tick(0.016);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  near(crawlContactWeight, 0);
  tick(UNITY_CROUCH_CRAWL_TIMING.rapidBlend * 0.5);
  near(runtime.diagnostics.transitionBlendWeight, 0.5, 1e-5);
  near(crawlContactWeight, 0.5, 1e-5);
  near(crawlContactPhase, runtime.diagnostics.timelineTime);
  tick(UNITY_CROUCH_CRAWL_TIMING.rapidBlend * 0.5);
  near(runtime.diagnostics.transitionBlendWeight, 1);
  near(crawlContactWeight, 1);
  hint = 'player.idle';
  tick(0.016);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  near(crawlContactWeight, 1);
  tick(UNITY_CROUCH_CRAWL_TIMING.rapidBlend * 0.5);
  near(crawlContactWeight, 0.5, 1e-5);
  tick(UNITY_CROUCH_CRAWL_TIMING.rapidBlend * 0.5);
  near(crawlContactWeight, 0);
  assert.equal(crawlContactPhase, null);

  // Airborne state clips are phase-locked to gameplay actionProgress instead
  // of drifting with frame time. The second pop owns a fresh progress phase.
  hint = 'player.jump';
  grounded = false;
  actionProgress = 0.24;
  runtime.restart();
  tick(0.001);
  near(runtime.diagnostics.timelineTime, 0.24);
  tick(0.24);
  near(runtime.diagnostics.timelineTime, 0.24);
  hint = 'player.double-jump';
  actionProgress = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.double-jump');
  near(runtime.diagnostics.timelineTime, 0);
  actionProgress = 0.5;
  tick(0.016);
  near(runtime.diagnostics.timelineTime, 0.5);

  // Studio/manual preview remains ordinary speed-controlled clip playback.
  hint = 'player.slam';
  grounded = false;
  actionProgress = 0.8;
  runtime.setManualClipOverride('player.slam');
  runtime.restart();
  tick(0.001);
  near(runtime.diagnostics.timelineTime, 0);
  tick(0.2);
  near(runtime.diagnostics.timelineTime, 0.2);
  runtime.setManualClipOverride(null);

  // Membership in the known route list is not sufficient: an edited legacy
  // clip remains ordinary time-based playback unless its own metadata opts in.
  const timeBasedLegacyJump = {
    ...clips.find((clip) => clip.id === 'player.jump'),
    metadata: { progressSource: 'clip-traversal' },
  };
  const suiteWithTimeBasedLegacyJump = {
    ...suite,
    clips: suite.clips.map((clip) =>
      clip.id === timeBasedLegacyJump.id ? timeBasedLegacyJump : clip),
  };
  runtime.setDocument(suiteWithTimeBasedLegacyJump);
  hint = 'player.jump';
  grounded = false;
  actionProgress = 0.9;
  runtime.restart();
  tick(0.001);
  near(runtime.diagnostics.timelineTime, 0);
  tick(0.2);
  near(runtime.diagnostics.timelineTime, 0.2);
  runtime.setDocument(suite);

  // Slam impact remains in the authored slam pose; the generic landing
  // transient must not replace its flattened/recovery phase.
  runtime.restart();
  hint = 'player.slam';
  grounded = false;
  actionProgress = 0.66;
  tick(0.016);
  grounded = true;
  actionProgress = 0.83;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.slam');
  assert.equal(runtime.diagnostics.landingOneShotActive, false);
  near(runtime.diagnostics.timelineTime, 0.83);

  // The slot remains explicitly previewable/editable; only automatic gameplay
  // routing yields to the proven procedural skate mount and stance.
  hint = 'player.skate';
  grounded = true;
  runtime.setManualClipOverride('player.skate');
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.skate');
  assert.equal(runtime.diagnostics.authoredPoseApplied, true);
  runtime.setManualClipOverride(null);
  runtime.restart();
  tick(0.016);
  assert.equal(runtime.diagnostics.requestedClipId, 'player.skate');
  assert.equal(runtime.activeClipId, null);

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

  const resetStateRouting = () => {
    runtime.setManualClipOverride('player.idle');
    hint = 'player.idle';
    grounded = true;
    normalizedSpeed = 0;
    gaitPhase = 0;
    tick(0.001);
    runtime.setManualClipOverride(null);
    runtime.restart();
    tick(0.001);
    assert.equal(runtime.activeClipId, 'player.idle');
    assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  };
  const qualifyRun = (
    speed = PACE_STOP_MIN_PEAK_SPEED + 0.25,
    phase = 0.73,
    seconds = PACE_STOP_MIN_RUN_SECONDS + 0.02,
  ) => {
    hint = 'player.run';
    grounded = true;
    normalizedSpeed = speed;
    gaitPhase = phase;
    tick(0.01);
    tick(seconds);
    assert.equal(runtime.activeClipId, 'player.run');
  };

  // A meaningful run -> idle edge owns one pace-stop traversal. Entry gait
  // phase and peak speed are frozen into generic procedural inputs, while a
  // short authored-time crossfade preserves the arbitrary outgoing stride.
  resetStateRouting();
  qualifyRun(0.72, 0.73);
  // The routed run can spend its final frame below the qualifying peak. Keep
  // that frame's planted-foot phase, but retain the meaningful peak momentum.
  normalizedSpeed = 0.08;
  gaitPhase = 0.81;
  tick(0.01);
  const outgoingRunX = hips.position.x;
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, PACE_STOP_CLIP_ID);
  assert.equal(runtime.diagnostics.requestedClipId, PACE_STOP_CLIP_ID);
  assert.equal(runtime.diagnostics.pacingOneShotActive, true);
  assert.equal(runtime.diagnostics.landingOneShotActive, false);
  assert.equal(runtime.diagnostics.transientClipId, PACE_STOP_CLIP_ID);
  near(runtime.diagnostics.transitionEntryGaitPhase, 0.81);
  near(runtime.diagnostics.transitionEntrySpeed, 0.72);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  near(runtime.diagnostics.motionContext.actionProgress, 0);
  near(runtime.diagnostics.motionContext.inputs.transitionEntryGaitPhase, 0.81);
  near(runtime.diagnostics.motionContext.inputs.transitionEntrySpeed, 0.72);
  near(hips.position.x, outgoingRunX);
  near(deformationValues['deform.torso.length'], 1.4);

  tick(PACE_STOP_CROSSFADE_SECONDS / 2);
  // smoothstep(0.5) = 0.5. The target clip has no scalar channel, so it must
  // blend toward the rig's default 1 rather than the generic numeric zero.
  near(runtime.diagnostics.transitionBlendWeight, 0.5);
  near(deformationValues['deform.torso.length'], 1.2);
  near(hips.position.x, (outgoingRunX + allIds.indexOf(PACE_STOP_CLIP_ID)
    + PACE_STOP_CROSSFADE_SECONDS / 2) / 2);
  near(runtime.diagnostics.motionContext.actionProgress,
    (PACE_STOP_CROSSFADE_SECONDS / 2) / paceClip.range.end);

  tick(paceClip.range.end);
  assert.equal(runtime.activeClipId, PACE_STOP_CLIP_ID);
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  near(runtime.diagnostics.motionContext.actionProgress, 1);
  near(hips.position.x, allIds.indexOf(PACE_STOP_CLIP_ID) + paceClip.range.end);
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');

  // A zero live multiplier is a real freeze, not accumulated wall time waiting
  // to jump the transition to its end when playback resumes.
  resetStateRouting();
  qualifyRun(0.8, 0.61);
  runtime.setPlaybackSpeedMultiplier(0);
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, PACE_STOP_CLIP_ID);
  tick(0.5);
  near(runtime.diagnostics.timelineTime, paceClip.range.start);
  near(runtime.diagnostics.motionContext.actionProgress, 0);
  near(runtime.diagnostics.transitionBlendWeight, 0);
  assert.equal(runtime.diagnostics.pacingOneShotActive, true);
  runtime.setPlaybackSpeedMultiplier(1);
  tick(0.05);
  near(runtime.diagnostics.timelineTime, paceClip.range.start + 0.05);
  assert.ok(runtime.diagnostics.motionContext.actionProgress > 0);
  assert.ok(runtime.diagnostics.transitionBlendWeight > 0);
  assert.equal(runtime.diagnostics.pacingOneShotActive, true);

  // Neither a short tap nor a long low-speed shuffle qualifies as a run-stop.
  resetStateRouting();
  qualifyRun(PACE_STOP_MIN_PEAK_SPEED + 0.2, 0.2, PACE_STOP_MIN_RUN_SECONDS * 0.5);
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  resetStateRouting();
  qualifyRun(PACE_STOP_MIN_PEAK_SPEED * 0.5, 0.2, PACE_STOP_MIN_RUN_SECONDS + 0.1);
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);

  // Any gameplay-owned state interrupts pacing in the same sampled frame.
  for (const interruption of [
    'player.run', 'player.jump', 'player.double-jump', 'player.fall', 'player.crouch', 'player.crawl', 'player.slide',
    'player.skate', 'player.grind', 'player.grab', 'player.hang', 'player.climb',
    'player.rope', 'player.rope-climb', 'player.rope-release',
    'player.slam', 'player.spin', 'player.bail',
  ]) {
    resetStateRouting();
    qualifyRun();
    hint = 'player.idle';
    normalizedSpeed = 0;
    tick(0.016);
    assert.equal(runtime.activeClipId, PACE_STOP_CLIP_ID);
    hint = interruption;
    grounded = !airborneRoutes.has(interruption);
    tick(0.016);
    if (interruption === 'player.skate') {
      assert.equal(runtime.diagnostics.requestedClipId, interruption);
      assert.equal(runtime.activeClipId, null,
        'skate did not return control to the procedural presentation');
    } else {
      assert.equal(runtime.activeClipId, interruption, `${interruption} did not interrupt pace-stop`);
    }
    assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  }

  // A fresh landing wins if the landing edge and a synthetic run->idle edge
  // occur together; this guards routing priority independent of Player timing.
  resetStateRouting();
  qualifyRun();
  grounded = false;
  tick(0.016);
  grounded = true;
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.land');
  assert.equal(runtime.diagnostics.landingOneShotActive, true);
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);

  // A missing or identity-placeholder transition falls through to idle in the
  // triggering frame instead of hiding the valid gameplay pose.
  resetStateRouting();
  const suiteWithoutPace = { ...suite, clips: suite.clips.filter((clip) => clip.id !== PACE_STOP_CLIP_ID) };
  runtime.setDocument(suiteWithoutPace);
  qualifyRun();
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  const emptyPace = { ...paceClip, tracks: [], proceduralDrivers: [] };
  runtime.setDocument({ ...suite, clips: suite.clips.map((clip) => clip.id === PACE_STOP_CLIP_ID ? emptyPace : clip) });
  resetStateRouting();
  qualifyRun();
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);

  // Removing an active transient's clip cancels it immediately. A manual clip
  // and a disabled runtime also discard qualifications rather than banking a
  // stale flourish for later.
  runtime.setDocument(suite);
  resetStateRouting();
  qualifyRun();
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.diagnostics.pacingOneShotActive, true);
  runtime.setDocument(suiteWithoutPace);
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  runtime.setDocument(suite);

  resetStateRouting();
  qualifyRun();
  runtime.setManualClipOverride('player.spin');
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.spin');
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  runtime.setManualClipOverride(null);
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');

  resetStateRouting();
  qualifyRun();
  runtime.setEnabled(false);
  hint = 'player.idle';
  normalizedSpeed = 0;
  tick(0.016);
  assert.equal(runtime.activeClipId, null);
  assert.equal(runtime.diagnostics.pacingOneShotActive, false);
  runtime.setEnabled(true);
  tick(0.016);
  assert.equal(runtime.activeClipId, 'player.idle');

  runtime.setDocument(suite);
  resetStateRouting();
  normalizedSpeed = 0.5;
  gaitPhase = 0.25;
  verticalVelocity = -3;
  actionProgress = 0.4;
  motionInputs = { balance: 0.75, charge: 0.2, travelSign: 1 };

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
  assert.equal(lowPoseOuterOwnership, null);
  assert.equal(lowPoseOuterOwnershipRemoved, 1);
  assert.equal(runtime.diagnostics.disposed, true);
  runtime.dispose();
  assert.equal(overlayRemoved, 1);
  assert.equal(lowPoseOuterOwnershipRemoved, 1);

  console.log('PASS character animation runtime routing, procedural composition, live context, fallback, and disposal');
} finally {
  await server.close();
}
