import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withAfterHoursRuntime } from './nightworks-runner.mjs';

// Input-only optional route, starting on its supported summit reading island.
// The raised coping is caught diagonally, its real charge pops into the crystal,
// and native left air steering returns to the island before the finish.
// The main course has its separate continuous-board acceptance test. This
// optional return records any natural steps onto feet instead of hiding them.
await withAfterHoursRuntime(async r => {
  const { p, l, source, THREE } = r, data = source.NIGHTWORKS_AFTER_HOURS_LEVEL;
  const quarterIndex = data.components.findIndex(c => c.nm === 'Summit crystal quarter');
  const dockIndex = data.components.findIndex(c => c.nm === 'Summit finish dock');
  assert.ok(quarterIndex >= 0 && dockIndex >= 0 && l.crystalPickup);
  const tuning = JSON.stringify(r.TUNING), lives = p.lives;
  const ray = new THREE.Raycaster();
  r.scene.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(132, 100, -673), new THREE.Vector3(0, -1, 0));
  assert.ok(Math.abs(ray.intersectObjects(l.groundMeshes, false)[0]?.point.y - 36) < .05, 'supported initial reading island');
  let mode = 'approach', mounted = false, footFrames = 0;
  let catchState = null, pop = null, crystal = null, landing = null;
  for (let frame = 0; frame < 1200 && p.state !== 'finished'; frame++) {
    let input;
    if (mode === 'approach') input = { ...r.toward([148, 38.3, -677.5]), jumpHeld: true, grindHeld: true };
    else if (mode === 'pop') input = { jumpHeld: false, grindHeld: true };
    else if (mode === 'crystal-air') input = { grindHeld: true };
    else if (mode === 'return-air') input = { moveX: -1, grindHeld: false };
    else input = { ...r.toward([132, 36, -684]), jumpHeld: true };
    const beforeTime = l.time, state = r.tick(input);
    assert.ok(Math.abs(l.time - beforeTime - r.CONST.fixedStep) < 1e-7, 'the native fixed tick owns the clock');
    assert.equal(l.timeTrial, false); assert.equal(p.ttActive, false);
    assert.ok(!p.isBailing && !['dead', 'gameover'].includes(p.state), 'optional route returns without a collision bail or death');
    mounted ||= p.boardRolling;
    if (mounted && !p.boardRolling && p.state !== 'finished') { assert.ok(landing, 'coping collection and island return stay mounted'); footFrames++; }
    if (mode === 'approach' && p.state === 'grind') {
      assert.equal(state.railComponent, quarterIndex, 'catch the actual authored quarter coping');
      assert.ok(p.boardRolling && p.xHoldT >= .4 - 1e-6, 'real mounted full charge reaches the coping');
      catchState = state; mode = 'pop';
    }
    if (mode === 'pop' && p.state === 'air') {
      assert.ok(state.input.jumpReleased && state.verticalSpeed > 9, 'native charged grind release authors the pop');
      pop = state; mode = 'crystal-air';
    }
    if (p.hasCrystal && mode === 'crystal-air') {
      assert.ok(l.crystalPickup.collected && p.boardRolling, 'real airborne rider collects the high crystal');
      crystal = state; mode = 'return-air';
    }
    if (mode === 'return-air' && p.grounded) {
      assert.equal(state.supportComponent, dockIndex, 'return to supported summit ground instead of the bonus entrance');
      landing = state; mode = 'finish';
    }
  }
  assert.ok(catchState && pop && crystal && landing, 'complete the coping, pickup and supported return sequence');
  assert.equal(p.state, 'finished'); assert.ok(p.hasCrystal && l.crystalPickup.collected);
  assert.equal(p.lives, lives, 'no reserve life was spent');
  assert.equal(JSON.stringify(r.TUNING), tuning, 'authored movement tuning remains unchanged');
  if (process.env.AFTER_HOURS_CRYSTAL_TRACE) await writeFile(process.env.AFTER_HOURS_CRYSTAL_TRACE, JSON.stringify({
    catchState, pop, crystal, landing, footFrames, end: r.snapshot(), trace: r.trace,
  }, null, 2));
  console.log(`PASS native summit crystal: actual coping/pop, high pickup, supported island return and finish; ${footFrames} foot frames during the final turn.`);
}, { start: [132, 36.1, -673], heading: [1, 0, 0] });
