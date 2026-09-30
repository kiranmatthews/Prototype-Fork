import assert from 'node:assert/strict';
import { withWaterparkRuntime } from './waterpark-runner.mjs';

await withWaterparkRuntime(r => {
  const { p, l, source, tick, trace } = r;
  const before = JSON.stringify(r.TUNING);
  assert.equal(l.halfpipes.length, 6, 'Six real analytic pools must back the authored verts');
  assert.equal(l.rails.length, 0, 'Coping rails must not steal charged forward transfers');
  assert.equal(source.WATERPARK_LEVEL.components.filter(c => c.t === 'gate').length, 1);
  assert.equal(source.WATERPARK_LEVEL.components.filter(c => c.t === 'crystal').length, 1);
  let jump = 0, transfers = 0, inJump = null, priorStage = 0, priorPipe = -1;
  let inverted = false, finished = false;
  const jumps = [];
  for (let i = 0; i < 3600; i++) {
    let jumpHeld = true;
    if (p.vertAir && p.pipeHang) {
      const release = p.vertBoardRelease;
      // The automatic coping pop spends launch. Release, make a fresh press,
      // then release over the ridge; remain released until touchdown so the
      // next bowl's charge can arm normally.
      jumpHeld = release.stage === 1 && p.pos.y > 14.5 && !release.pressArmed;
    }
    const edge = source.WATERPARK_JUMPS[jump];
    if (p.grounded && !p.groundHit?.halfpipe && edge && p.pos.z-edge.takeoff < 1.4) {
      jumpHeld = false;
      inJump = { index: jump, start: p.pos.toArray(), peak: p.pos.y };
      jump++;
    }
    const state = tick({ moveY: 1, jumpHeld });
    assert.equal(state.bailing, false, `Traversal bailed: ${JSON.stringify(state)}`);
    assert.notEqual(state.state, 'dead', `Traversal died: ${JSON.stringify(state)}`);
    if (state.releaseStage === 2 && priorStage === 1 && state.pipe === priorPipe+1) transfers++;
    priorStage = state.releaseStage; priorPipe = state.pipe;
    if (inJump) {
      inJump.peak = Math.max(inJump.peak,p.pos.y);
      if (p.grounded) { jumps.push({ ...inJump, end: p.pos.toArray() }); inJump = null; }
    }
    inverted ||= p.loopStatus.active && p.rideNormal.y < -.9;
    if (p.state === 'finished' && p.loopStatus.completed === 1) { finished = true; break; }
  }
  assert.equal(transfers,5,'Five deliberate forward spine transfers must cross all six giant pools');
  assert.equal(jumps.length,3,'All three ramp gaps must take off and land');
  for (const flight of jumps) {
    const gap = source.WATERPARK_JUMPS[flight.index];
    assert.ok(flight.end[2] <= gap.landing, `Gap ${flight.index+1} must reach its far catch deck`);
    assert.ok(flight.peak > gap.takeoffY+4, `Gap ${flight.index+1} must make a substantial ramp air`);
  }
  assert.ok(inverted && finished,'One uninterrupted input-only run must invert, complete the loop and reach the finish');
  assert.ok(trace.every(t => t.rail === null),'Forward progression must never be hijacked by a grind');
  assert.equal(JSON.stringify(r.TUNING),before,'No movement tuning may change');
  console.log(`Deadwater Park: ${transfers} forward transfers, ${jumps.length} giant gap landings, full inversion and finish in ${(trace.length*r.CONST.fixedStep).toFixed(1)} s.`);
});

await withWaterparkRuntime(({ p, l, tick }) => {
  let activated = false, fell = false, recovered = false;
  for (let i=0;i<1200;i++) {
    if (!activated) {
      tick({moveY:1,jumpHeld:true,spinHeld:p.pos.z<14});
      activated = l.checkpoints[0].active;
    } else if (!fell) {
      tick({moveX:1,jumpHeld:true});
      fell = p.state === 'dead';
    } else {
      tick({});
      if (p.state === 'ride' && p.grounded) { recovered=true;break; }
    }
  }
  assert.ok(activated,'Spinning through the checkpoint must bank it');
  assert.ok(fell,'Missing the high deck must reach the failure basin');
  assert.ok(recovered,'Pit death must return to the activated checkpoint');
  assert.ok(Math.abs(p.pos.x+4)<.2 && Math.abs(p.pos.z-12)<.2,'Checkpoint respawn must use its supported authored deck');
  console.log('Deadwater Park: checkpoint activation, missed-deck pit death and supported checkpoint respawn passed.');
}, {start:[-4,14.15,16]});
