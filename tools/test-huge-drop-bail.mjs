import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { makeInput } from './jungle-cup-harness.mjs';

const base = {
  v: 1, name: 'Huge-drop landing boundary', spawn: [0, .05, 0], killY: -200,
  components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 200] },
    { t: 'gate', p: [35, 0, -80] }],
};

await withBlockworksRuntime(async r => {
  const { TUNING, TUNING_VERSION } = await r.server.ssrLoadModule('/src/tuning.ts');
  const defaults = { ...TUNING };
  assert.equal(TUNING.hugeDropDistance, 24);
  assert.equal(TUNING.hugeDropImpact, 20);
  assert.ok(TUNING_VERSION >= 25);

  // Walk or skate off an authored supported deck. Observe production contact
  // judgement without changing the player, its velocity, or the tuning.
  const descend = ({ height, board = false, transition = false }) => {
    const scene = new r.THREE.Scene();
    const floorY = transition ? -100 : 0;
    const data = { ...base, spawn: [0, height + .05, 20], components: [
      { t: 'platform', p: [0, height - .5, 0], s: [6, 1, 60], edgeGrinding: false },
      { t: 'platform', p: [0, floorY - .5, -50], s: [100, 1, 200], edgeGrinding: false },
      ...(transition ? [{ t: 'ramp', p: [0, 10, -54], len: 6, rise: 12, w: 20, yaw: 180,
        edgeGrinding: false }] : []),
      { t: 'gate', p: [35, floorY, -100] },
    ] };
    const level = new r.Level(scene, { id: 'huge-drop-test', name: data.name, data });
    level.update(0); scene.updateMatrixWorld(true);
    const player = new r.Player(scene);
    player.enterLevel('huge-drop-test'); player.endlessDeaths = true;
    player.rawInput = makeInput(); player.respawn(level, true, false);
    const judge = player.beginHugeDropLandingBail;
    const contacts = [];
    player.beginHugeDropLandingBail = function (hit, x, z) {
      const length = hit.normal.length() || 1;
      const contact = { descent: this.airPeakY - hit.y,
        normalImpact: Math.max(0, -(x * hit.normal.x + this.vVel * hit.normal.y + z * hit.normal.z) / length),
        normal: hit.normal.toArray(), surfaceY: hit.y };
      const bailed = judge.call(this, hit, x, z);
      if (hit.y < height - 1) contacts.push({ ...contact, bailed });
      return bailed;
    };
    try {
      for (let frame = 0; frame < 1500 && !contacts.length; frame++) {
        const input = makeInput({ moveY: 1, jumpHeld: board, jumpPressed: board && frame === 0 });
        player.step(r.dt, input, level); level.update(r.dt);
        if (['dead', 'gameover'].includes(player.state)) break;
      }
      assert.ok(contacts.length, `No landing from ${height} m ${transition ? 'onto transition' : 'onto flat'}`);
      return { height, board, transition, ...contacts[0], bailing: player.isBailing };
    } finally { level.dispose(); }
  };

  const drops = [];
  for (const [height, board] of [
    ...[12, 20, 23.99, 24, 24.01, 40].map(height => [height, false]),
    ...[23.99, 24, 24.01].map(height => [height, true]),
  ]) {
    const result = descend({ height, board }); drops.push(result);
    assert.ok(Math.abs(result.descent - height) < .001, `Drop did not measure authored height: ${JSON.stringify(result)}`);
    assert.ok(result.normalImpact > 20, 'Flat drop did not reach the unchanged hard-impact threshold');
    assert.equal(result.bailed, height >= 24, `Wrong native landing judgement: ${JSON.stringify(result)}`);
    assert.equal(result.bailing, height >= 24);
  }
  const aligned = descend({ height: 50, board: true, transition: true });
  assert.ok(aligned.descent > 24, `Transition test did not cover a huge descent: ${JSON.stringify(aligned)}`);
  assert.ok(aligned.normalImpact < 20, `Transition approach was not aligned: ${JSON.stringify(aligned)}`);
  assert.equal(aligned.bailed, false, 'Well-aligned transition landing bailed');
  assert.equal(aligned.bailing, false);

  // Use the actual saved-settings loader. The existing defaults snapshot
  // distinguishes an untouched historical 12 from a deliberate custom 12.
  document.body.dataset ??= {};
  const { UI } = await r.server.ssrLoadModule('/src/ui.ts');
  const ui = { defaults, sliderEls: new Map() };
  const historical = { ...defaults, hugeDropDistance: 12 };
  const storage = globalThis.localStorage;
  const migrations = [];
  try {
    for (const [name, savedDefaults, savedTuning, expectedDistance, expectedImpact] of [
      ['untouched v24', historical, historical, 24, 20],
      ['custom distance', historical, { ...historical, hugeDropDistance: 18 }, 18, 20],
      ['deliberate historical 12', { ...historical, hugeDropDistance: 10 }, historical, 12, 20],
      ['custom impact', historical, { ...historical, hugeDropImpact: 28 }, 24, 28],
      ['missing historical key', {}, {}, 24, 20],
    ]) {
      globalThis.localStorage = { getItem: () => JSON.stringify({ __v: 24,
        defaults: savedDefaults, tuning: savedTuning }) };
      const loaded = UI.prototype.readSaved.call(ui);
      assert.equal(loaded.hugeDropDistance, expectedDistance, name);
      assert.equal(loaded.hugeDropImpact, expectedImpact, name);
      migrations.push({ name, distance: loaded.hugeDropDistance, impact: loaded.hugeDropImpact });
    }
  } finally { globalThis.localStorage = storage; }
  assert.deepEqual(TUNING, defaults, 'Landing and migration checks changed runtime tuning');
  console.log(JSON.stringify({ drops, aligned, migrations, version: TUNING_VERSION }, null, 2));
}, { modulePath: '/src/levels/codex-lab.ts', source: () => base,
  levelId: 'huge-drop-test', maxFrames: 1 });
