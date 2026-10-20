import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-5, `${label}: ${a} != ${b}`);
await withSkateRuntime(async ({ THREE, server, Level, Player, CONST }) => {
  const a = await server.ssrLoadModule('/src/animation/index.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const level = new Level(new THREE.Scene(), { id: 'low-spin', name: 'Low spin', data: {
    v: 1, name: 'Low spin', spawn: [0, .02, 0], killY: -20,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 100] }, { t: 'gate', p: [0, 0, -45] }],
  } });
  const p = new Player(level.scene);
  const rig = a.RigBinding.fromSculptRuntime(p.animationRig.root);
  const runtime = createCharacterAnimationRuntime(p, a.createPlayerStarterAnimationSuite(rig.definition));
  const tick = (overrides = {}) => { p.step(CONST.fixedStep, makeInput(overrides), level); level.update(CONST.fixedStep); };
  const reset = () => {
    p.enterLevel('low-spin'); p.respawn(level, true); runtime.restart();
    for (let f = 0; f < 30; f++) tick();
  };
  try {
    reset();
    await p.preparePresentationAssets();
    assert.equal(p.spinEffectDiagnostics.assetReady, true);
    const effects = p.spinEffects;
    const model = new THREE.Box3().setFromObject(effects.sculpture.children[0]);
    const neutralHeight = model.max.y - model.min.y;
    for (const [name, frames] of [['crouch-enter', 8], ['crouch', 60], ['crawl', 60], ['slide-early', 5], ['slide-late', 15]]) {
      reset();
      const slide = name.startsWith('slide');
      if (slide) {
        for (let f = 0; f < 25; f++) tick({ moveY: 1 });
        tick({ moveY: 1, grabPressed: true, grabHeld: true });
        assert.equal(p.sliding, true);
      }
      const input = { grabHeld: true, moveY: name === 'crawl' ? .25 : slide ? 1 : 0 };
      for (let f = 0; f < frames; f++) tick(input);
      const before = new THREE.Box3();
      p.interactionMeasure.measureRelative(p.riderG, p.group, before);
      if (p.grounded) before.min.y = Math.max(0, before.min.y);
      const scale = p.riderG.scale.toArray();
      tick({ ...input, spinPressed: true });
      assert.equal(p.spinning, true, name);
      if (name === 'slide-late') assert.equal(p.slideTimer, 0, 'late spin did not exercise slide cancellation');
      assert.equal(effects.sculptureVisible, true, name);
      assert.ok(p.spinStanceBounds.min.distanceTo(before.min) < 1e-5, `${name}: capture happened after pose replacement`);
      const expectedHeight = before.max.y - before.min.y;
      near(effects.characterFrame.scale.y * neutralHeight, expectedHeight, `${name} height`);
      near(effects.characterFrame.position.y, before.min.y, `${name} bottom`);
      near(effects.characterFrame.position.x, (before.min.x + before.max.x) / 2, `${name} x`);
      near(effects.characterFrame.position.z, (before.min.z + before.max.z) / 2, `${name} z`);
      assert.deepEqual(p.riderG.scale.toArray(), scale, 'live skeleton was scaled');
      const transform = effects.characterFrame.matrix.clone();
      effects.characterFrame.updateMatrix(); transform.copy(effects.characterFrame.matrix);
      // Release crouch / let the slide end. The source height is latched until
      // the next attack, including all fifteen ring-handoff ticks.
      let lingering = false;
      for (let f = 0; f < 50; f++) {
        tick(); effects.characterFrame.updateMatrix();
        assert.deepEqual(effects.characterFrame.matrix.elements, transform.elements, `${name}: spin grew during handoff`);
        if (!p.spinning && effects.characterRings.visible) lingering = true;
      }
      assert.equal(lingering, true);
      tick({ spinPressed: true });
      assert.deepEqual(effects.characterFrame.scale.toArray(), [1, 1, 1], 'standing spin retained compression');
      assert.deepEqual(effects.characterFrame.position.toArray(), [0, 0, 0], 'standing spin retained low offset');
      console.log(`PASS ${name}: ${(expectedHeight / neutralHeight).toFixed(3)} height, latched pose and normal next spin`);
    }
    reset(); for (let f = 0; f < 60; f++) tick({ grabHeld: true });
    tick({ grabHeld: true, spinPressed: true });
    const lowScale = effects.characterFrame.scale.y;
    const initialY = p.pos.y;
    tick({ grabHeld: true, jumpHeld: true, jumpPressed: true });
    tick({ grabHeld: true, jumpReleased: true });
    for (let f = 0; f < 5; f++) tick({ grabHeld: true });
    assert.equal(p.state, 'air'); assert.ok(p.pos.y > initialY);
    assert.equal(p.spinning, true);
    near(effects.characterFrame.scale.y, lowScale, 'crouch jump changed an active spin');
    // Respawn during the effect must retire it and not contaminate the next attack.
    reset(); tick({ spinPressed: true });
    assert.deepEqual(effects.characterFrame.scale.toArray(), [1, 1, 1]);
    assert.deepEqual(effects.groundedSkateRings.scale.toArray(), [1, 1, 1]);
    assert.equal(effects.groundedSkateRings.parent, effects.root);
    console.log('PASS crouch-jump carry, respawn and independent skateboard rings');
    // Relative measurement must be invariant under translated, yawed and
    // sloped world frames; transforming an already-unioned world box is wrong.
    reset(); for (let f = 0; f < 60; f++) tick({ grabHeld: true });
    const local = new THREE.Box3(), tilted = new THREE.Box3();
    p.interactionMeasure.measureRelative(p.riderG, p.group, local);
    const { captureSpinCharacter, disposeSpinModel } = await server.ssrLoadModule('/src/spin-effects/smear.ts');
    const surface = captureSpinCharacter(p.riderG, p.group);
    const exported = new THREE.Box3().setFromObject(surface, true);
    assert.ok(local.min.distanceTo(exported.min) < 1e-5 && local.max.distanceTo(exported.max) < 1e-5,
      'stance differs from the independently frozen, rendered character surface');
    disposeSpinModel(surface);
    p.group.position.set(16, 8, -32); p.group.rotation.set(.35, 1.2, -.2);
    p.interactionMeasure.measureRelative(p.riderG, p.group, tilted);
    assert.ok(local.min.distanceTo(tilted.min) < 1e-5 && local.max.distanceTo(tilted.max) < 1e-5);
    effects.reset();
    assert.deepEqual(effects.characterFrame.scale.toArray(), [1, 1, 1]);
    assert.equal(effects.sculptureVisible, false);
    console.log('PASS local-frame invariance and reset');
  } finally { runtime.dispose(); p.spinEffects.dispose(); level.dispose(); }
});
