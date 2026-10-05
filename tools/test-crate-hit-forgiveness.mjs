import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(({ THREE, Level, Player, TUNING }) => {
  const fixtures = [];
  const create = (kind = 'wood', components = []) => {
    const scene = new THREE.Scene();
    const data = {
      v: 1, name: 'Crate hit forgiveness', spawn: [6, .02, 6], killY: -20, groups: [],
      components: [
        { t: 'platform', p: [0, -.5, 0], s: [24, 1, 24] },
        { t: 'crate', p: [0, 0, 0], kind },
        ...components,
        { t: 'gate', p: [0, 0, -9] },
      ],
    };
    const level = new Level(scene, { id: 'crate-hit-forgiveness', name: data.name, data });
    const player = new Player(scene);
    player.endlessDeaths = true;
    player.rawInput = makeInput();
    player.respawn(level, true);
    fixtures.push(level);
    return { level, player, crate: level.crates[0] };
  };
  const prepare = (player, { spin = false, air = false, y = .02, previousY = y, vVel = 0 } = {}) => {
    player.state = air ? 'air' : 'ride';
    player.grounded = !air;
    player.freeSkate = false;
    player.speed = 0;
    player.walkVelocity.set(0, 0, 0);
    player.spinTimer = spin ? .2 : 0;
    player.slamActive = false;
    player.pos.set(0, y, 0);
    player.prevPos.set(0, previousY, 0);
    player.vVel = vVel;
    player.refreshCharacterBounds();
  };
  // Place the actual measured silhouette outside a crate, so the test is
  // independent of character dimensions and cannot pass through body contact.
  const spinNear = (f, axis, sign, gap, spin = true) => {
    prepare(f.player, { spin });
    const body = f.player.characterBounds;
    const delta = sign > 0
      ? f.crate.box.max[axis] + gap - body.min[axis]
      : f.crate.box.min[axis] - gap - body.max[axis];
    f.player.pos[axis] += delta;
    f.player.prevPos.copy(f.player.pos);
    f.player.refreshCharacterBounds();
    assert.equal(f.player.characterBounds.intersectsBox(f.crate.box), false, 'fixture body already touches crate');
  };
  const stompEdge = (f, axis, sign, margin, overrides = {}) => {
    const top = f.crate.box.max.y;
    prepare(f.player, { air: true, y: top - .06, previousY: top + .1, vVel: -10, ...overrides });
    f.player.pos[axis] = sign > 0 ? f.crate.box.max[axis] + margin : f.crate.box.min[axis] - margin;
    f.player.prevPos[axis] = f.player.pos[axis];
  };
  try {
    for (const axis of ['x', 'z']) for (const sign of [-1, 1]) {
      const spin = create();
      spinNear(spin, axis, sign, .34);
      spin.player.collide(spin.level);
      assert.equal(spin.crate.alive, false, `active spin missed ${sign}${axis} silhouette margin`);

      const idle = create();
      spinNear(idle, axis, sign, .3, false);
      const untouched = idle.player.pos.clone();
      idle.player.collide(idle.level);
      assert.equal(idle.crate.alive, true, `inactive spin enlarged ${sign}${axis} body contact`);
      assert.deepEqual(idle.player.pos.toArray(), untouched.toArray(), 'near miss pushed the non-spinning body');

      const far = create();
      spinNear(far, axis, sign, .36);
      far.player.collide(far.level);
      assert.equal(far.crate.alive, true, `spin reached beyond .35 m on ${sign}${axis}`);

      const stomp = create();
      stompEdge(stomp, axis, sign, .349);
      stomp.player.collide(stomp.level);
      assert.equal(stomp.crate.alive, false, `descending stomp missed ${sign}${axis} lid margin`);
      assert.equal(stomp.player.vVel, TUNING.crateBounce, 'edge stomp did not bounce');
      assert.ok(Math.abs(stomp.player.pos.y - (stomp.crate.box.max.y + .02)) < 1e-9, 'edge stomp did not seat on the authored lid');

      const wide = create();
      stompEdge(wide, axis, sign, .36);
      wide.player.collide(wide.level);
      assert.equal(wide.crate.alive, true, `stomp reached beyond .35 m on ${sign}${axis}`);
      assert.ok(wide.player.vVel <= 0, 'outside-lid contact became a bounce');
    }

    const high = create();
    spinNear(high, 'x', 1, .3);
    const rise = high.crate.box.max.y + .01 - high.player.characterBounds.min.y;
    high.player.pos.y += rise;
    high.player.prevPos.copy(high.player.pos);
    high.player.collide(high.level);
    assert.equal(high.crate.alive, true, 'spin margin grew vertically');

    for (const [label, overrides] of [
      ['rising scrape', { vVel: 10 }],
      ['side scrape', { previousY: .5 }],
    ]) {
      const scrape = create();
      stompEdge(scrape, 'x', 1, .15, overrides);
      scrape.player.collide(scrape.level);
      assert.equal(scrape.crate.alive, true, `${label} was treated as a stomp`);
      assert.ok(scrape.player.vVel !== TUNING.crateBounce, `${label} awarded a stomp bounce`);
    }

    for (const kind of ['metal', 'metalbounce', 'bang', 'nitrobang', 'tnt']) {
      const typed = create(kind);
      stompEdge(typed, 'x', 1, .15);
      typed.player.collide(typed.level);
      assert.ok(typed.player.vVel <= 0, `${kind} received destructible-lid forgiveness`);
      assert.equal(typed.crate.fuse, undefined, `${kind} edge scrape lit a fuse`);
      assert.ok(!typed.crate.bangUsed, `${kind} edge scrape fired a switch`);
    }

    const nitro = create('nitro');
    spinNear(nitro, 'x', 1, .3);
    nitro.player.collide(nitro.level);
    assert.equal(nitro.crate.alive, true, 'nitro inherited expanded spin body contact');
    assert.notEqual(nitro.player.state, 'dead', 'nitro near miss killed player');
    const tnt = create('tnt');
    spinNear(tnt, 'z', -1, .3);
    tnt.player.collide(tnt.level);
    assert.equal(tnt.crate.alive, false, 'TNT spin stopped detonating');
    assert.equal(tnt.level.explosions[0]?.safe, false, 'TNT spin became safe');

    const arrow = create('bouncy');
    stompEdge(arrow, 'z', -1, .15);
    arrow.player.collide(arrow.level);
    assert.equal(arrow.crate.alive, true, 'edge landing smashed the arrow crate');
    assert.equal(arrow.player.vVel, TUNING.arrowBounce, 'edge arrow landing missed its typed bounce');
    const multihit = create('multihit');
    stompEdge(multihit, 'x', -1, .15);
    multihit.player.collide(multihit.level);
    assert.equal(multihit.crate.alive, true, 'one edge stomp force-smashed multi-hit wood');
    assert.equal(multihit.crate.hitsRemaining, 4, 'edge stomp did not consume exactly one multi-hit');

    // Two captured misses from the supplied Ghost Train replay, translated
    // into the fixture's origin. Both crossed the lid with visible sole overlap.
    const sourceCenter = new THREE.Vector3(1.89990234375, 0, -4);
    for (const sample of [
      { frame: 2948, pos: [1.6399023437297613, .8866666666666645, -3.281579281300552], prev: [1.6399023437297613, 1.1888888888888869, -3.281579281300552], vVel: -18.13333333333334 },
      { frame: 3044, pos: [1.9065841929703249, .9324999999999974, -4.789999999951425], prev: [1.9065841929703249, 1.233333333333331, -4.789999999951425], vVel: -18.050000000000008 },
    ]) {
      const replay = create();
      prepare(replay.player, { air: true, vVel: sample.vVel });
      replay.player.pos.fromArray(sample.pos).sub(sourceCenter);
      replay.player.prevPos.fromArray(sample.prev).sub(sourceCenter);
      replay.player.collide(replay.level);
      assert.equal(replay.crate.alive, false, `Ghost Train frame ${sample.frame} still missed its crate`);
      assert.equal(replay.player.vVel, TUNING.crateBounce, `Ghost Train frame ${sample.frame} did not bounce`);
    }

    // Low crate authored first: a descending edge landing must select the
    // upper crate and snap to its lid without clearing the lower layer.
    const stack = create('wood', [{ t: 'crate', p: [0, .96, 0], kind: 'wood' }]);
    const upper = stack.level.crates[1];
    stompEdge({ ...stack, crate: upper }, 'x', 1, .15);
    stack.player.collide(stack.level);
    assert.equal(upper.alive, false, 'stack edge landing missed the highest crate');
    assert.equal(stack.crate.alive, true, 'stack edge landing cleared the lower layer');
    assert.ok(Math.abs(stack.player.pos.y - (upper.box.max.y + .02)) < 1e-9, 'stack landing snapped to lower lid');
    console.log('PASS crate attack forgiveness: spin X/Z margins, inactive/far/vertical misses, top-down edge stomps, typed hazards, arrow/multi-hit behavior, and highest stack lid.');
  } finally {
    for (const level of fixtures) level.dispose();
  }
});
