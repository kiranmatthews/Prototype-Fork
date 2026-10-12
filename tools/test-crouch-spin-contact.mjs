import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST, TUNING }) => {
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const fixtures = [];
  const create = (kinds = [], y = 0) => {
    const l = new Level(new THREE.Scene(), { id: 'crouch-spin-contact', name: 'Crouch spin', data: {
      v: 1, name: 'Crouch spin', spawn: [0, y + .02, 1.4], killY: y - 20,
      components: [{ t: 'platform', p: [0, y - .5, 0], s: [100, 1, 100] },
        ...kinds.map((kind, i) => ({ t: 'crate', p: [0, y + i * .96, 0], kind })),
        { t: 'gate', p: [0, y, -45] }],
    } });
    const p = new Player(l.scene); p.enterLevel(l.id); p.respawn(l, true);
    const suite = a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition);
    const runtime = createCharacterAnimationRuntime(p, suite);
    const tick = (input = {}) => { p.step(CONST.fixedStep, makeInput(input), l); l.update(CONST.fixedStep); };
    fixtures.push({ l, p, runtime });
    for (let i = 0; i < 60; i++) tick({ grabHeld: true });
    return { l, p, runtime, suite, tick };
  };
  try {
    for (const y of [0, -4.62, 12]) {
      const { l, p, runtime, tick } = create(['wood', 'wood', 'wood'], y);
      for (let row = 0; row < 3; row++) {
        for (let f = 0; f < 50; f++) {
          tick({ grabHeld: true, spinPressed: f === 0 });
          assert.equal(runtime.activeClipId, 'player.crouch', 'held crouch briefly revealed a standing animation');
          if (p.spinning) {
            assert.ok(p.crateAttackBox.max.y < y + .96, 'low attack crossed the next stack row');
            assert.ok(p.spinBox.max.y < y + .96, 'non-crate attack retained standing height');
          }
          assert.equal(l.crates.filter(c => !c.alive).length, row + 1,
            `one crouched spin consumed multiple stack rows at frame ${f}`);
        }
      }
      assert.equal(p.totalDeaths, 0);
    }
    for (const upper of ['tnt', 'nitro', 'metal']) {
      const { l, p, tick } = create(['wood', upper]);
      for (let f = 0; f < 40; f++) tick({ grabHeld: true, spinPressed: f === 0 });
      assert.equal(l.crates[0].alive, false);
      assert.equal(l.crates[1].alive, true, `low sweep hit upper ${upper}`);
      assert.equal(l.explosions.length, 0);
      assert.equal(p.totalDeaths, 0);
    }
    const { p, runtime, suite, tick } = create();
    for (const [moveX, moveY] of [[0, .25], [0, .5], [0, 1], [1, 0], [0, -1]]) {
      tick({ grabHeld: true, moveX, moveY });
      const clip = suite.clips.find(c => c.id === 'player.crawl');
      let phaseTravel = 0, metres = 0, previousTime = runtime.diagnostics.timelineTime;
      for (let f = 0; f < 60; f++) {
        const before = p.pos.clone();
        tick({ grabHeld: true, moveX, moveY });
        assert.equal(runtime.activeClipId, 'player.crawl');
        const next = runtime.diagnostics.timelineTime;
        phaseTravel += ((next - previousTime + clip.duration) % clip.duration) / clip.duration;
        metres += p.pos.distanceTo(before); previousTime = next;
      }
      assert.ok(Math.abs(metres - Math.hypot(moveX, moveY) * TUNING.crawlSpeed) < 1e-5, 'animation changed movement');
      assert.ok(Math.abs(phaseTravel * 1.8 - metres * clip.playbackSpeed) < 1e-5, 'crawl cadence does not match distance');
    }
    for (let f = 0; f < 30; f++) {
      tick({ grabHeld: true, moveX: .5, spinPressed: f === 0 });
      assert.equal(runtime.activeClipId, 'player.crawl', 'moving low spin lost crawl');
    }
    for (let f = 0; f < 60; f++) tick();
    tick({ spinPressed: true });
    assert.equal(runtime.activeClipId, 'player.spin', 'standing spin retained crouch');
    assert.ok(p.crateAttackBox.max.y - p.pos.y > .96, 'standing spin retained low hitbox');
    tick({ jumpPressed: true, jumpHeld: true }); tick({ jumpReleased: true });
    assert.equal(p.state, 'air', 'spin prevented jump');
    p.respawn(fixtures.at(-1).l, true); runtime.restart();
    for (let f = 0; f < 60; f++) tick();
    tick({ grabHeld: true, grabPressed: true, spinPressed: true });
    assert.equal(p.spinning, true); assert.equal(p.crawling, true);
    assert.ok(p.crateAttackBox.max.y - p.pos.y < .96, 'simultaneous crouch/spin remained tall');
    assert.notEqual(runtime.activeClipId, 'player.spin');
    console.log('PASS crouched spin: one stack layer per swing, repeated/raised/typed stacks, held-pose handoff, simultaneous input, standing reset and distance-matched crawl in every direction');
  } finally {
    for (const { l, p, runtime } of fixtures) { runtime.dispose(); p.spinEffects.dispose(); l.dispose(); }
  }
});
