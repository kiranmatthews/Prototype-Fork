import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';
import { normalizeGameInput } from './blockworks-runner.mjs';

for (const surface of ['dry', 'ice', 'slope']) {
  const ice = surface !== 'dry', slope = surface === 'slope', y = slope ? 40 : 0;
  const data = { v: 1, name: 'Ordinary trampoline landing roll', spawn: [0, y + .15, 0], killY: -80,
    components: [
      slope ? { t: 'ramp', p: [0, -20, -100], len: 400, rise: 80, w: 200, yaw: 180, slip: true, iceGrip: .035, slipGravity: 1.9 } :
      { t: 'platform', p: [0, -.5, -100], s: [200, 1, 400], ...(ice ? { slip: true, iceGrip: .035 } : {}) },
      { t: 'trampoline', p: [0, y, 0], s: [6, .2, 6], speed: 28, amp: 1 },
      { t: 'gate', p: [80, 0, -250] },
    ] };
  await withSkateRuntime(async ({ player: p, level, CONST, server }) => {
    p.competitionMode = false;
    const a = await server.ssrLoadModule('/src/animation/index.ts');
    const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
    const rig = a.RigBinding.fromSculptRuntime(p.animationRig.root).definition;
    const runtime = createCharacterAnimationRuntime(p, a.createPlayerStarterAnimationSuite(rig));
    const beginPose = p.beginRollLandingPresentation;
    const samplePose = runtime.samplePoseAt;
    let slideRecoveries = 0;
    runtime.samplePoseAt = function(clip, time, motion, ...rest) {
      if (this.activeClipId === 'player.roll-land' && motion.actionProgress >= .72 && motion.inputs?.slopeSlide) {
        assert.notEqual(clip.id, 'player.run', 'downhill roll recovered through a running stride');
        if (clip.id === 'player.slope-slide') slideRecoveries++;
      }
      return samplePose.call(this, clip, time, motion, ...rest);
    };
    let previous = {}, rollFrames = 0, minimumClearance = Infinity;
    const tick = sample => {
      const input = normalizeGameInput(sample, previous); previous = { ...input };
      p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); p.commitRenderStep(level);
      if (runtime.activeClipId === 'player.roll-land') {
        rollFrames++;
        const hit = p.groundHit;
        p.group.updateMatrixWorld(true);
        const clearance = p.interactionMeasure.sampledPlaneDistance(p.riderG, hit.normal, p.pos);
        minimumClearance = Math.min(minimumClearance, clearance);
        assert.ok(clearance >= -.015, `roll penetrated support: ${clearance}`);
        assert.deepEqual(p.riderG.scale.toArray(), [1, 1, 1]);
      }
      return { position: p.pos.toArray(), velocity: p.walkVelocity.toArray(), speed: p.speed, vy: p.vVel,
        axis: p.axisF.toArray(), state: p.state, grounded: p.grounded, board: p.freeSkate,
        carry: p.iceSlideCarry, dismountCarry: p.boardRunCarry, skateBlock: p.skateBlockT,
        skateCharge: p.skateCharge, bailing: p.isBailing };
    };
    const run = (pose, board, moveY, interrupt = false) => {
      p.beginRollLandingPresentation = pose ? beginPose : () => {};
      p.respawn(level, true); previous = {}; rollFrames = 0;
      p.freeSkate = board; p.speed = board ? 8 : 0;
      p.state = 'air'; p.grounded = false; p.vVel = -1;
      p.trampolineAir = false; p.bounceJump = false; p.airJumpUsed = true;
      const trace = [];
      let launched = false, landed = false, after = 0;
      for (let f = 0; f < 240; f++) {
        const input = !launched ? {} : !landed ? { moveY: 1 } :
          interrupt && after < 2 ? { moveY, jumpHeld: true } : { moveY };
        trace.push(tick(input));
        launched ||= p.trampolineAir;
        if (launched && p.grounded && !landed) {
          landed = true;
          assert.equal(p.emergencyEjectLandingPending, false, 'test accidentally used Abandon Ship');
          assert.equal(p.freeSkate, board, 'landing changed board ownership');
          assert.equal(p.boardRunCarry, false, 'ordinary landing acquired dismount braking');
          assert.equal(p.skateBlockT, 0, 'ordinary roll blocked mounting');
          assert.equal(p.isBailing, false);
          if (pose && !board) assert.equal(runtime.activeClipId, 'player.roll-land');
          else assert.notEqual(runtime.activeClipId, 'player.roll-land');
        }
        if (landed && ++after === (interrupt ? 6 : 75)) break;
      }
      assert.ok(launched && landed, 'fixture missed a clean native spring landing');
      if (pose && !board) assert.ok(rollFrames >= (interrupt ? 2 : 30), 'roll skipped its authored motion');
      assert.notEqual(p.animationClipHint, 'player.roll-land', 'roll did not finish or yield to the next jump');
      if (interrupt) assert.equal(p.state, 'air', 'roll blocked a fresh jump');
      return trace;
    };
    try {
      for (const board of [false, true]) for (const moveY of [0, 1]) {
        // Turn off only the new pose latch for a paired physics trace. Every
        // position, input gate, velocity and board state must remain identical.
        const baseline = run(false, board, moveY);
        assert.deepEqual(run(true, board, moveY), baseline, 'landing animation changed gameplay');
      }
      assert.deepEqual(run(true, false, 1, true), run(false, false, 1, true), 'roll changed fresh-jump input');
      if (slope) assert.ok(slideRecoveries > 0, 'downhill roll did not recover into its shoe glide');
      console.log(`PASS ${surface} spring landings: forward roll, finite settle, fresh jump, exact movement/input/board parity; floor clearance ${minimumClearance.toFixed(4)}m.`);
    } finally { p.beginRollLandingPresentation = beginPose; runtime.dispose(); }
  }, { levelEntry: { id: '__trampoline_roll', name: data.name, data } });
}
