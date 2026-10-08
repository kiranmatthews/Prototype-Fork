import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST, TUNING }) => {
  const { Rail } = await server.ssrLoadModule('/src/rails.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const { TUNING_INFO, TUNING_RANGES, TUNING_SECTIONS } = await server.ssrLoadModule('/src/tuning.ts');
  assert.equal(TUNING.grindTrickBoost, 3);
  assert.ok(TUNING_INFO.grindTrickBoost && TUNING_RANGES.grindTrickBoost);
  assert.ok(TUNING_SECTIONS.some(section => section.keys.includes('grindTrickBoost')));
  const saved = { ...TUNING };
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'rail-trick-speed', name: 'Rail trick speed', data: {
    v: 1, name: 'Rail trick speed', spawn: [0, .02, 0], killY: -30,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [500, 1, 500] }, { t: 'gate', p: [0, 0, -240] }],
  } });
  const rails = [0, 3.6].map(x => new Rail([new THREE.Vector3(x, 4, 300), new THREE.Vector3(x, 4, -300)]));
  for (const r of rails) { level.rails.push(r); level.grindRails.push(r); scene.add(r.object); }
  scene.updateMatrixWorld(true);
  const p = new Player(scene);
  let frames = 0, cases = 0;
  const tick = values => { p.step(CONST.fixedStep, makeInput(values), level); level.update(CONST.fixedStep); frames++; };
  const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
  function fixture({ park = false, dir = 1, speed = 12, reward = 3 } = {}) {
    TUNING.grindTrickBoost = reward; level.skatepark = park; p.competitionMode = park;
    const heading = rails[0].tangentAt(300).multiplyScalar(dir), position = rails[0].pointAt(300).add(new THREE.Vector3(0, .25, 0));
    p.respawn(level, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
    p.camDir.set(0, 0, -1); p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
    p.speed = speed; p.vVel = 0;
    tick({ grindPressed: true, grindHeld: true }); assert.equal(p.state, 'grind');
    close(p.speed, speed, 'initial catch gained unearned speed'); p.balanceBoostT = 100;
    for (let i = 0; i < 12; i++) tick({ grindHeld: true });
  }
  function launch(kind) {
    for (let i = 0; i < 24; i++) tick({ jumpHeld: true, jumpPressed: i === 0, grindHeld: true, moveX: kind === 'transfer-flip' && i > 20 ? 1 : 0 });
    tick({ jumpReleased: true, grindHeld: true, moveX: kind === 'transfer-flip' ? 1 : 0,
      spinPressed: ['flip', 'flip-spin', 'transfer-flip'].includes(kind), spinHeld: ['flip', 'flip-spin', 'transfer-flip'].includes(kind) });
    assert.equal(p.state, 'air');
  }
  function land(kind, grind = true) {
    const path = [];
    for (let i = 0; i < 120; i++) {
      path.push([...p.pos.toArray(), p.speed]);
      tick({ grindPressed: grind && i === 2, grindHeld: grind && i >= 2,
        spinPressed: kind === 'late-flip' && i === 34, spinHeld: kind === 'late-flip' && i === 34,
        grabPressed: kind === 'grab' && i === 1, grabHeld: kind === 'grab' && i >= 1 && i < 7,
        moveX: ['spin', 'flip-spin'].includes(kind) && i >= 1 && i < 23 ? 1 : 0 });
      if (p.state === 'grind' || p.grounded || p.isBailing) return { path, speed: p.speed, state: p.state,
        bail: p.isBailing, labels: [...p.comboLabels], balance: p.balance, age: p.balanceAge, rail: rails.indexOf(p.grindRail) };
    }
    assert.fail('air never resolved');
  }
  try {
    for (const park of [false, true]) for (const dir of [-1, 1]) {
      for (const kind of ['plain', 'flip', 'grab', 'spin', 'flip-spin', 'transfer-flip']) {
        fixture({ park, dir, reward: 0 }); launch(kind); const control = land(kind);
        fixture({ park, dir }); launch(kind); const reward = land(kind);
        assert.equal(reward.state, 'grind', `${kind}: failed to catch`); assert.equal(reward.bail, false);
        assert.deepEqual(reward.path, control.path, `${kind}: boost changed flight before catch`);
        assert.deepEqual(reward.labels, control.labels, 'speed reward changed scoring');
        close(reward.balance, control.balance, 'speed reward reset balance'); close(reward.age, control.age, 'speed reward reset difficulty');
        close(reward.speed - control.speed, kind === 'plain' ? 0 : 3, `${park}/${dir}/${kind} reward`);
        if (kind === 'transfer-flip') assert.equal(reward.rail, 1);
        const caughtSpeed = p.speed;
        for (let i = 0; i < 15; i++) tick({ grindPressed: i === 0, grindHeld: true, moveY: 1 });
        close(p.speed, caughtSpeed, 'held grind or style switch repeatedly awarded speed');
        // Prior air tricks in the combo cannot pay on the next plain hop.
        launch('plain'); const plain = land('plain'); close(plain.speed, caughtSpeed, 'previous trick leaked into plain hop');
        cases++;
      }
      for (const kind of ['late-flip', 'missing-triangle']) {
        fixture({ park, dir }); launch(kind === 'missing-triangle' ? 'flip' : kind);
        const result = land(kind, kind !== 'missing-triangle');
        assert.notEqual(result.state, 'grind', `${kind}: invalid trick earned a rail catch`);
        // A late flip misses the rail; it may finish before the lower ground
        // or use the existing sketchy/bail judgment. It earns no rail reward.
        if (kind === 'missing-triangle') assert.equal(result.bail, true, kind);
        assert.ok(result.speed <= 12); assert.equal(p.grindAirTrickCompleted, false); cases++;
      }
      fixture({ park, dir, speed: 26 });
      const speeds = [];
      for (let i = 0; i < 4; i++) { launch('flip'); const r = land('flip'); assert.equal(r.state, 'grind'); speeds.push(r.speed); }
      assert.ok(speeds[0] > 26); close(speeds.at(-1), TUNING.downhillMax, 'reward exceeded or failed to reach rail ceiling');
      assert.ok(speeds.every(s => s <= TUNING.downhillMax)); cases++;
    }
    fixture(); launch('flip');
    for (let i = 0; i < 23; i++) tick({});
    assert.equal(p.grindAirTrickCompleted, true);
    p.respawn(level, true); assert.equal(p.grindAirTrickCompleted, false); cases++;
    // A first rail catch after a normal ground trick earns no rail-link reward.
    for (const reward of [0, 3]) {
      fixture({ reward }); launch('flip'); p.grindExitAir = false;
      const r = land('flip'); assert.equal(r.state, 'grind'); close(r.speed, 12, 'ground-to-rail air earned rail-link reward'); cases++;
    }
    const old = JSON.parse(await readFile(new URL('./fixtures/grind-catch-release-replay.json', import.meta.url), 'utf8'));
    const replay = new Replayer(); TUNING.grindTrickBoost = 3;
    replay.begin(old); assert.equal(TUNING.grindTrickBoost, 0, 'old take gained an unrecorded speed reward'); replay.end();
    assert.equal(TUNING.grindTrickBoost, 3);
    replay.begin({ ...old, tuning: { ...old.tuning, grindTrickBoost: 5 } }); assert.equal(TUNING.grindTrickBoost, 5); replay.end();
    assert.equal(TUNING.grindTrickBoost, 3); cases++;
    console.log(`PASS ${cases} rail-trick speed cases over ${frames} controller frames: +3 m/s once per landed trick air, flat/transfer rails, flips/grabs/spins, both directions and modes, unchanged flight/scoring/balance, capped chains, failure/plain/style guards, reset and replay compatibility.`);
  } finally { Object.assign(TUNING, saved); level.dispose(); }
});
