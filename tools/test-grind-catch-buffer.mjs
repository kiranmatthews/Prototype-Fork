import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const replayData = JSON.parse(await readFile(new URL('./fixtures/grind-catch-release-replay.json', import.meta.url), 'utf8'));
// Input-only recordings require their recorded world. The current park now
// offers additional platform rims, which correctly change earlier choices.
const recordedLevel = JSON.parse(gunzipSync(await readFile(new URL('./fixtures/grind-catch-release-level.json.gz', import.meta.url))));
await withSkateRuntime(async ({ THREE, server, Level, Player, player:p, level, step, CONST }) => {
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  const request = p.grindRequested?.bind(p) ?? (input => input.grindHeld || input.grindPressed);
  const replayCases = [];
  // A repaired catch changes the subsequent route. Replay each original
  // approach independently with its old held-only routing up to takeoff,
  // then exercise the production controller through the reported impact.
  // No recorded inputs, tuning, positions or rail/balance physics are edited.
  for (const [takeoff, impact] of [[551, 595], [2111, 2147], [3036, 3075]]) {
    for (const buffered of [false, true]) {
      const replay = new Replayer(); replay.begin(replayData);
      p.endlessDeaths = true; p.respawn(level, true);
      let frame = 0, caught = -1;
      p.grindRequested = input => buffered && frame > takeoff ? request(input) : input.grindHeld || input.grindPressed;
      const input = makeInput();
      for (; frame <= impact; frame++) {
        replay.feed(input, p.camDir);
        const prior = p.state;
        step(input);
        if (frame === takeoff) {
          assert.equal(prior, 'grind'); assert.equal(p.state, 'air');
          assert.equal(p.isBailing, false);
        }
        if (frame > takeoff && p.state === 'grind') { caught = frame; break; }
      }
      if (buffered) {
        assert.ok(caught > takeoff && caught < impact, `replay ${impact}: released Triangle failed to catch`);
        assert.equal(p.isBailing, false);
        assert.ok(p.comboMult > 1, 'catch lost the linked combo');
        assert.equal(p.grindOllieCatchGrace, 0, 'catch did not consume the request');
      } else {
        assert.equal(caught, -1, 'original routing unexpectedly caught');
        assert.equal(p.isBailing, true, 'original reported rail smack not reproduced');
      }
      replayCases.push({ takeoff, impact, buffered, caught });
      replay.end();
    }
  }
  p.grindRequested = request;

  const { Rail } = await server.ssrLoadModule('/src/rails.ts');
  const scene = new THREE.Scene();
  const flat = new Level(scene, { id: 'grind-catch-buffer', name: 'Catch buffer', data: {
    v: 1, name: 'Catch buffer', spawn: [0, .02, 0], killY: -30,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [500, 1, 500] }, { t: 'gate', p: [0, 0, -240] }],
  } });
  const rail = new Rail([new THREE.Vector3(0, 4, 50), new THREE.Vector3(0, 4, -150)]);
  flat.rails.push(rail); flat.grindRails.push(rail); scene.add(rail.object); scene.updateMatrixWorld(true);
  const rider = new Player(scene);
  const tick = values => { rider.step(CONST.fixedStep, makeInput(values), flat); flat.update(CONST.fixedStep); };
  const launch = (park, dir) => {
    flat.skatepark = park;
    const heading = rail.tangentAt(80).multiplyScalar(dir), position = rail.pointAt(80).add(new THREE.Vector3(0, .25, 0));
    rider.respawn(flat, true, true, { position, heading });
    rider.pos.copy(position); rider.prevPos.copy(position); rider.axisF.copy(heading); rider.axisL.set(heading.z, 0, -heading.x);
    rider.state = 'air'; rider.grounded = false; rider.freeSkate = rider.airFromSkate = true; rider.speed = 12; rider.vVel = 0;
    tick({ grindPressed: true, grindHeld: true }); assert.equal(rider.state, 'grind');
    rider.balanceBoostT = 10;
    for (let i = 0; i < 24; i++) tick({ jumpHeld: true, jumpPressed: i === 0, grindHeld: true });
    tick({ jumpReleased: true, grindHeld: true }); assert.equal(rider.state, 'air');
  };
  const fly = inputAt => {
    for (let i = 0; i < 100; i++) {
      tick(inputAt(i));
      if (rider.state === 'grind' || rider.grounded || rider.isBailing) return i;
    }
    assert.fail('rail ollie never resolved');
  };
  let cases = 0;
  try {
    for (const park of [false, true]) for (const dir of [-1, 1]) {
      launch(park, dir);
      const contact = fly(i => ({ grindPressed: i === 2, grindHeld: i >= 2 }));
      assert.equal(rider.state, 'grind'); cases++;
      for (const lead of [1, 5, 10]) {
        // One-frame taps as well as release after a sustained fresh hold.
        for (const held of [false, true]) {
          launch(park, dir);
          const press = held ? 2 : contact - lead;
          fly(i => ({ grindPressed: i === press, grindHeld: i >= press && i <= contact - lead }));
          assert.equal(rider.state, 'grind', `${park}/${dir}/${lead}/${held}: buffered catch failed`);
          assert.equal(rider.isBailing, false); assert.ok(rider.comboMult >= 2);
          assert.equal(rider.grindOllieCatchGrace, 0); cases++;
        }
      }
      for (const kind of ['missing', 'stale-hold', 'expired-tap']) {
        launch(park, dir);
        fly(i => ({ grindPressed: kind === 'expired-tap' && i === contact - 15,
          grindHeld: kind === 'stale-hold' || kind === 'expired-tap' && i === contact - 15 }));
        assert.equal(rider.isBailing, true, `${kind}: invalid request bypassed rail impact`);
        assert.notEqual(rider.state, 'grind'); cases++;
      }
      launch(park, dir); tick({ grindPressed: true, grindHeld: true });
      assert.ok(rider.grindOllieCatchGrace > 0);
      rider.respawn(flat, true);
      assert.equal(rider.grindOllieCatchGrace, 0); cases++;
    }
  } finally { flat.dispose(); }
  console.log(`PASS all three recorded Triangle-release bails reproduced before and caught after; ${cases} controller cases cover taps/holds, both directions/modes, consumed/expired requests, stale holds and respawn.`);
  console.log(JSON.stringify(replayCases));
}, { levelEntry: recordedLevel });
