import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withAfterHoursRuntime } from './nightworks-runner.mjs';

const componentOf = object => {
  for (let node = object; node; node = node.parent) if (Number.isInteger(node.userData?.editorIdx)) return node.userData.editorIdx;
  return null;
};
const checkpoints = await withAfterHoursRuntime(r => {
  const data = r.source.NIGHTWORKS_AFTER_HOURS_LEVEL;
  const stages = r.source.AFTER_HOURS_STAGES.filter(stage => stage.checkpoint);
  const authored = data.components.flatMap((component, index) => component.t === 'checkpoint' ? [{ index, component }] : []);
  assert.equal(authored.length, stages.length, 'every checkpoint belongs to one required chapter');
  assert.equal(authored.length, 7, 'the eight-chapter course banks seven reading docks');
  assert.equal(data.components.filter(c => c.t === 'clock').length, 1, 'time trial entry is explicit');
  assert.deepEqual(data.components.find(c => c.t === 'clock').p, [-6.5, 10, 5], 'the optional clock stays in its side bay');
  return stages.map(stage => {
    const checkpoint = authored.find(({ component }) => component.grp === stage.grp);
    assert.ok(checkpoint, `${stage.id}: authored checkpoint resolves to its component group`);
    assert.deepEqual(checkpoint.component.p, stage.checkpoint);
    return { id: stage.id, index: checkpoint.index, point: [...stage.checkpoint] };
  });
});

const reports = [];
for (const checkpoint of checkpoints) {
  const start = [checkpoint.point[0], checkpoint.point[1] + .1, checkpoint.point[2] + 6];
  await withAfterHoursRuntime(r => {
    const { p, l, THREE } = r, tuning = JSON.stringify(r.TUNING), lives = p.lives;
    const target = l.checkpoints.find(cp => componentOf(cp.mesh) === checkpoint.index);
    assert.ok(target, `${checkpoint.id}: live checkpoint has the authored identity`);
    assert.ok(!target.active && l.activeCheckpoint === null, 'each trial starts before banking');
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const floor = position => {
      r.scene.updateMatrixWorld(true);
      ray.set(new THREE.Vector3(position[0], 120, position[2]), down);
      return ray.intersectObjects(l.groundMeshes, false)[0];
    };
    assert.ok(Math.abs(floor(start)?.point.y - checkpoint.point[1]) < .05, `${checkpoint.id}: supported initial reading dock`);
    const tick = sample => {
      assert.equal(l.timeTrial, false, 'checkpoint recovery is a normal run');
      assert.equal(p.ttActive, false, 'the optional clock has not started a trial');
      assert.equal(l.runMode, false, 'run modes cannot disable checkpoint banking');
      const beforeTime = l.time, state = r.tick(sample);
      assert.ok(Math.abs(l.time - beforeTime - r.CONST.fixedStep) < 1e-7, 'only the production fixed tick advances the level clock');
      assert.equal(l.timeTrial, false); assert.equal(p.ttActive, false); assert.equal(l.runMode, false);
      Object.assign(state, { levelTime: l.time, timeTrial: l.timeTrial, trialActive: p.ttActive, runMode: l.runMode, lives: p.lives });
      return state;
    };
    let bankFrame = null;
    for (let frame = 0; frame < 360 && !target.active; frame++) {
      const near = Math.hypot(p.pos.x - target.spawnPos.x, p.pos.z - target.spawnPos.z) < 2.5;
      tick({ ...r.directionInput([0, 0, -1]), jumpHeld: true, spinHeld: near });
      assert.ok(!p.isBailing && !['dead', 'gameover'].includes(p.state), `${checkpoint.id}: bank safely using native inputs`);
      if (target.active) bankFrame = r.snapshot().frame;
    }
    assert.ok(target.active && bankFrame !== null, `${checkpoint.id}: real checkpoint crate banks on approach`);
    assert.equal(l.activeCheckpoint, target);
    assert.ok(p.boardRolling, `${checkpoint.id}: bank while mounted`);
    assert.ok(r.trace.some(f => f.input.spinHeld), 'native Spin input earns the checkpoint');

    // The counterweight launch dock falls west, away from its required ridges.
    // Its receiving dock falls east, away from the preceding ridge. Other
    // reading docks use the west side, outside the authored travel line.
    const side = checkpoint.id === 'workbay' ? 1 : -1;
    let fall = null, death = null;
    for (let frame = 0; frame < 900 && p.state !== 'dead'; frame++) {
      const sample = p.grounded ? { ...r.directionInput([side, 0, 0]), jumpHeld: true } : { jumpHeld: true };
      const state = tick(sample);
      assert.notEqual(p.state, 'gameover', 'fresh trial retains reserve lives');
      if (!p.grounded && !floor(state.position) && p.vVel < 0 && fall === null) fall = state;
      if (p.state !== 'dead') assert.ok(!p.isBailing, `${checkpoint.id}: failure comes from true void, not a recoverable collision bail`);
      if (p.state === 'dead') death = state;
    }
    assert.ok(fall, `${checkpoint.id}: recorded unsupported descending air beyond the island`);
    assert.ok(death && death.position[1] < l.killY, `${checkpoint.id}: the real kill-plane fall causes death`);
    assert.equal(p.lives, lives - 1, 'normal-mode void death spends exactly one reserve life');
    assert.equal(l.activeCheckpoint, target, 'death retains the actual banked checkpoint');

    let recovered = null;
    for (let frame = 0; frame < 600; frame++) {
      const state = tick({});
      assert.notEqual(p.state, 'gameover');
      if (p.state === 'ride' && p.grounded) { recovered = state; break; }
    }
    assert.ok(recovered, `${checkpoint.id}: production death timer automatically respawns the rider`);
    assert.equal(l.activeCheckpoint, target); assert.ok(target.active);
    assert.ok(p.pos.distanceTo(target.spawnPos) < .2, `${checkpoint.id}: return to the same checkpoint's authored spawn`);
    const firstRespawn = recovered;
    for (let frame = 0; frame < 10; frame++) recovered = tick({});
    assert.ok(p.state === 'ride' && p.grounded, 'automatic respawn remains stably grounded through native settle');
    const supported = floor(recovered.position);
    assert.ok(supported && Math.abs(supported.point.y - p.pos.y) < .05, `${checkpoint.id}: respawn has actual collision support ${JSON.stringify({position:p.pos.toArray(),floor:supported?.point.toArray(),ground:p.groundHit?.y})}`);
    assert.equal(p.lives, lives - 1); assert.equal(JSON.stringify(r.TUNING), tuning, 'shared movement tuning remains unchanged');
    reports.push({ checkpoint, bankFrame, fall, death, firstRespawn, recovered, livesBefore: lives, livesAfter: p.lives, timeTrial: l.timeTrial, trace: r.trace });
    console.log(`PASS ${checkpoint.id}: native mounted bank, true-void death, automatic supported checkpoint respawn.`);
  }, { start, heading: [0, 0, -1] });
}
if (process.env.AFTER_HOURS_CHECKPOINT_TRACE) await writeFile(process.env.AFTER_HOURS_CHECKPOINT_TRACE, JSON.stringify(reports, null, 2));
console.log('PASS all seven After Hours checkpoint recovery paths in normal mode; no direct checkpoint/player/clock mutations.');
