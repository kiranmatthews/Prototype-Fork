import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
  const { selectWipeoutStyle } = await server.ssrLoadModule('/src/character/wipeoutPolicy.ts');
  const boundaries = [['wall', 18, 'head-pop'], ['trip', 16, 'waist-split'],
    ['rail', 16, 'loose-limbs'], ['landing', 22, 'loose-limbs']];
  for (const [cause, threshold, style] of boundaries) {
    assert.equal(selectWipeoutStyle(cause, threshold - .001, false), null);
    assert.equal(selectWipeoutStyle(cause, threshold, false), style);
    assert.equal(selectWipeoutStyle(cause, threshold + 30, false, true), null);
    assert.equal(selectWipeoutStyle(cause, NaN, false), null);
  }
  for (const cause of ['balance', 'pvp', 'contact', 'pit', 'water']) {
    assert.equal(selectWipeoutStyle(cause, 100, false), null);
    assert.equal(selectWipeoutStyle(cause, 100, true), null);
  }
  assert.equal(selectWipeoutStyle('blast', 0, true), 'blast');
  assert.equal(selectWipeoutStyle('crush', 0, true), 'crush');
  const scene = new THREE.Scene(), level = new Level(scene, { id: 'wipeout-policy', name: 'Wipeout policy', data: {
    v: 1, name: 'Wipeout policy', spawn: [0, .04, 0], killY: -30,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 100], edgeGrinding: false },
      { t: 'gate', p: [35, 0, -40] }],
  } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input;
  const reset = () => {
    p.respawn(level, true); p.invulnTimer = p.uberTimer = p.masks = 0; p.lives = 5;
    scene.updateMatrixWorld(true); p.step(CONST.fixedStep, input, level);
  };
  const active = () => !!p.breakApartDiagnostics?.active;
  const tick = () => p.step(CONST.fixedStep, input, level);
  const evidence = [];
  try {
    for (const [cause, threshold, style] of boundaries) {
      for (const masked of [false, true]) {
        reset(); p.speed = threshold; p.freeSkate = true;
        if (masked) p.masks = 1;
        p.bail(masked, threshold, cause); tick();
        assert.equal(active(), !masked, `${cause} protection`);
        if (!masked) assert.equal(p.breakApartDiagnostics.style, style);
        assert.equal(p.state === 'dead', false); assert.equal(p.lives, 5);
        evidence.push({ cause, masked, style: active() ? p.breakApartDiagnostics.style : 'intact' });
      }
    }
    reset(); p.speed = 30; p.freeSkate = true; p.bail(); tick();
    assert.equal(active(), false, 'high-speed balance miss detached pieces');
    reset(); p.beginPvpKnockdown(5, 1); tick(); assert.equal(active(), false, 'PvP detached pieces');
    for (const cause of ['contact', 'pit', 'water']) {
      reset(); p.die(cause); tick(); assert.equal(active(), false, `${cause} should remain intact`);
    }
    // Real blast collision and shield arbitration, including the hanging path.
    for (const hanging of [false, true]) for (const protection of ['none', 'mask', 'invulnerable', 'uber']) {
      reset();
      if (protection === 'mask') p.masks = 1;
      if (protection === 'invulnerable') p.invulnTimer = 1;
      if (protection === 'uber') p.uberTimer = 1;
      level.explosions.push({ center: new THREE.Vector3(0, .9, 0), radius: 4, t: CONST.blastGrow, safe: false });
      if (hanging) { p.state = 'hang'; p.hangHazards(level); } else p.blastCheck(level);
      level.explosions.length = 0;
      if (protection === 'none') {
        tick(); assert.equal(p.state, 'dead'); assert.equal(p.breakApartDiagnostics.style, 'blast');
        assert.equal(p.lives, 4); p.die('crush'); assert.equal(p.lives, 4, 'same death charged twice');
      } else { assert.notEqual(p.state, 'dead'); assert.equal(active(), false); }
      evidence.push({ blast: true, hanging, protection, state: p.state });
    }
    // Authoritative collision branch, same source and direction as the hazard.
    reset();
    level.stones.push({ box: new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)) });
    p.collide(level); level.stones.length = 0; tick();
    assert.equal(p.state, 'dead'); assert.equal(p.breakApartDiagnostics.style, 'crush');
    reset();
    level.crushers.push({ crushing: true, box: new THREE.Box3(new THREE.Vector3(-1, .4, -1), new THREE.Vector3(1, 2, 1)) });
    p.collide(level); level.crushers.length = 0; tick();
    assert.equal(p.state, 'dead'); assert.equal(p.breakApartDiagnostics.style, 'crush');
    for (const [height, vy, expected] of [[.5, -6, 'crush'], [0, -6, null], [.5, 6, null]]) {
      reset();
      const group = new THREE.Group(); group.position.set(0, height, 0);
      level.enemies.push({ group, box: new THREE.Box3(new THREE.Vector3(-.8, height, -.8),
        new THREE.Vector3(.8, height + 1, .8)), alive: true, kind: 'hopper', vy,
        touchHurt: true, spinKill: false, stompKill: false, meleeKill: false, spinRecoil: false });
      p.collide(level); level.enemies.length = 0; tick();
      assert.equal(p.state, 'dead', `hopper ${height}/${vy} did not connect: ${JSON.stringify({pos:p.pos.toArray(), box:p.playerBox, half:p.hitboxHalf, masks:p.masks, invuln:p.invulnTimer, uber:p.uberTimer})}`);
      assert.equal(active() ? p.breakApartDiagnostics.style : null, expected,
        'only a descending overhead enemy should crush');
    }
    // Partial spill can turn fatal without resurrection or a second life cost.
    reset(); p.speed = 24; p.freeSkate = true; p.bail(false, 24, 'wall'); tick();
    assert.equal(p.breakApartDiagnostics.style, 'head-pop');
    p.die('blast', new THREE.Vector3(-2, .4, 0)); tick();
    assert.equal(p.breakApartDiagnostics.style, 'blast'); assert.equal(p.breakApartDiagnostics.fatal, true);
    assert.equal(p.breakApartDiagnostics.parts, 9); assert.equal(p.lives, 4);
    reset(); assert.equal(active(), false, 'respawn retained detached joints');
    console.log(JSON.stringify({ boundaries, evidence, actualHazards: ['blast', 'hang blast', 'stone', 'crusher'], escalation: 'head-pop -> blast' }, null, 2));
  } finally { level.dispose(); }
});
