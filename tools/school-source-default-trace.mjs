import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Compare this trace against the prior task runtime to verify that levels
// without skateReference retain their authored drive/turn/jump/brake/coast.
await withSkateRuntime(async ({ THREE, Level, Player, scene, CONST }) => {
  const data = { v: 1, name: 'Default School movement trace', skatepark: true,
    spawn: [0, .05, 100], killY: -30, components: [
      { t: 'platform', p: [0, -.5, 0], s: [600, 1, 600], edgeGrinding: false },
      { t: 'gate', p: [250, 0, -250] },
    ] };
  const level = new Level(scene, { id: 'school-default-trace', name: data.name, data });
  scene.updateMatrixWorld(true);
  const p = new Player(scene); p.rawInput = makeInput(); p.endlessDeaths = true;
  p.respawn(level, true, true, { position: new THREE.Vector3(0, .05, 100), heading: new THREE.Vector3(0, 0, -1) });
  const trace = []; let held = false;
  try {
    for (let i = 0; i < 960; i++) {
      const sample = [{}, { moveY: 1 }, { moveY: 1, jumpHeld: true }, { moveY: 1 },
        { moveX: .4, moveY: .9, jumpHeld: true }, {}, { moveY: -1, grabHeld: true },
        { moveY: 1, jumpHeld: true }][Math.floor(i / 120)];
      const nextHeld = !!sample.jumpHeld;
      const input = makeInput({ ...sample, jumpPressed: nextHeld && !held, jumpReleased: held && !nextHeld }); held = nextHeld;
      p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
      assert.ok(!p.isBailing && p.pos.toArray().every(Number.isFinite));
      trace.push({ position: p.pos.toArray(), speed: p.speed, vertical: p.vVel, heading: p.axisF.toArray(), state: p.state, grounded: p.grounded });
    }
    const result = { frames: trace.length, sha256: createHash('sha256').update(JSON.stringify(trace)).digest('hex'), trace };
    if (process.argv[2]) assert.deepEqual(result, JSON.parse(await readFile(process.argv[2], 'utf8')));
    if (process.env.SCHOOL_DEFAULT_REPORT) await writeFile(process.env.SCHOOL_DEFAULT_REPORT, JSON.stringify(result));
    console.log(JSON.stringify({ frames: result.frames, sha256: result.sha256 }));
  } finally { level.dispose(); }
});
