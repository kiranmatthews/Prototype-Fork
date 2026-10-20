import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST, TUNING }) => {
  const { Rail } = await server.ssrLoadModule('/src/rails.ts');
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'rail-ollie-intent', name: 'Rail ollies', data: {
    v: 1, name: 'Rail ollies', spawn: [0, .02, 0], killY: -30,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [500, 1, 500] }, { t: 'gate', p: [0, 0, -240] }],
  } });
  const p = new Player(scene);
  let frames = 0, cases = 0;
  const distances = [];
  const step = values => { p.step(CONST.fixedStep, makeInput(values), level); level.update(CONST.fixedStep); frames++; };
  const close = (a, b, message, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${message}: ${a} / ${b}`);
  const rails = [];
  function fixture({ park = false, yaw = 0, dir = 1, slope = 0, neighbours = false } = {}) {
    for (const rail of rails) { scene.remove(rail.object); rail.object.traverse(o => { o.geometry?.dispose(); }); }
    rails.length = level.rails.length = level.grindRails.length = 0;
    level.skatepark = park;
    const rotate = v => v.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    for (const x of neighbours ? [0, -3.6, 3.6] : [0]) {
      const rail = new Rail([rotate(new THREE.Vector3(x, 4 + 30 * slope, 30)), rotate(new THREE.Vector3(x, 4 - 120 * slope, -120))]);
      rails.push(rail); level.rails.push(rail); level.grindRails.push(rail); scene.add(rail.object);
    }
    scene.updateMatrixWorld(true);
    const rail = rails[0], t = dir === 1 ? 20 : 80;
    const heading = rail.tangentAt(t).multiplyScalar(dir); heading.y = 0; heading.normalize();
    const position = rail.pointAt(t).add(new THREE.Vector3(0, .25, 0));
    p.respawn(level, true, true, { position, heading });
    p.pos.copy(position); p.prevPos.copy(position); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
    p.camDir.set(0, 0, -1); p.state = 'air'; p.grounded = false; p.freeSkate = p.airFromSkate = true;
    p.speed = 12; p.vVel = 0;
    step({ grindHeld: true, grindPressed: true });
    assert.equal(p.grindRail, rail, 'fixture must catch through real grind input');
    p.balanceBoostT = 10;
    for (let i = 0; i < 12; i++) step({ grindHeld: true });
    return rail;
  }
  function launch({ x = 0, y = 0, releaseX = x, releaseY = y, hold = 24, lead = 3 } = {}) {
    for (let i = 0; i < hold; i++) step({ jumpHeld: true, jumpPressed: i === 0, grindHeld: true,
      moveX: i >= hold - lead ? x : 0, moveY: i >= hold - lead ? y : 0 });
    step({ jumpReleased: true, grindHeld: true, moveX: releaseX, moveY: releaseY });
    assert.equal(p.state, 'air', 'jump release leaves the rail');
    close(p.speed, p.grindVel, 'forward speed carries through launch');
    return p.pos.clone();
  }
  function finishAir(inputAt) {
    for (let i = 0; i < 150; i++) {
      step(inputAt(i));
      assert.ok(p.pos.toArray().every(Number.isFinite));
      if (p.state === 'grind' || p.grounded || p.isBailing) return i;
    }
    assert.fail('air never resolved');
  }
  try {
    for (const park of [false, true]) for (const dir of [-1, 1]) {
      // A post-pop direction spins on the same line; only a fresh airborne
      // Grind edge makes the return legal, even if that edge precedes cooldown.
      const rail = fixture({ park, dir });
      const start = launch();
      const forward = p.axisF.clone();
      let spin = 0;
      finishAir(i => {
        spin = Math.max(spin, Math.abs(p.grabSpinAngle));
        return { moveX: i >= 1 && i < 23 ? 1 : 0, grindHeld: i >= 2, grindPressed: i === 2 };
      });
      assert.equal(p.state, 'grind'); assert.equal(p.grindRail, rail);
      assert.equal(p.isBailing, false); assert.ok(spin > Math.PI / 2);
      assert.ok(p.comboLabels.some(label => label.includes('180')), 'rotation scored on the rail');
      close(p.pos.clone().sub(start).cross(forward).y, 0, 'neutral ollie drifted off its line');
      cases++;

      for (const grindHeld of [false, true]) {
        fixture({ park, dir }); launch();
        finishAir(() => ({ grindHeld }));
        assert.equal(p.isBailing, true, `missing re-press must bail, held=${grindHeld}`);
        assert.notEqual(p.state, 'grind'); cases++;
      }

      // A fresh press that is released again before contact is not a grind.
      fixture({ park, dir }); launch();
      finishAir(i => ({ grindPressed: i === 2, grindHeld: i === 2 }));
      assert.equal(p.isBailing, true); cases++;

      for (const sign of [-1, 1]) for (const hold of [3, 40]) {
        fixture({ park, dir });
        const start = launch({ x: sign, hold });
        const heading = p.axisF.clone(), speed = p.speed;
        let airFrames = 0, railHeightDistance = null;
        while (!p.grounded && !p.isBailing && airFrames < 120) {
          step({ moveX: sign }); airFrames++;
          if (p.vVel < 0 && p.pos.y <= start.y && railHeightDistance === null)
            railHeightDistance = Math.abs(p.pos.x - start.x);
          close(p.grabSpinAngle, 0, 'pre-held transfer input also spun');
        }
        assert.equal(p.grounded, true); assert.equal(p.isBailing, false);
        assert.ok((p.pos.x - start.x) * sign > 2.5, 'side exit did not clear rail');
        assert.ok(p.axisF.x * sign > .1, 'landing discarded sideways momentum');
        assert.ok(p.axisF.dot(heading) > .8, 'transfer destroyed forward heading');
        assert.ok(p.speed >= speed - .3, 'side exit lost its forward speed'); cases++;
        if (dir === 1 && sign === 1) distances.push({ park, charge: hold === 3 ? 'tap' : 'full', metres: Number(railHeightDistance.toFixed(2)) });
      }

      for (const sign of [-1, 1]) {
        fixture({ park, dir, neighbours: true }); launch({ x: sign });
        finishAir(i => ({ moveX: sign, grindHeld: i >= 2, grindPressed: i === 2 }));
        assert.equal(p.state, 'grind', 'adjacent rail should catch');
        assert.equal(p.grindRail, rails[sign < 0 ? 1 : 2]);
        assert.equal(p.isBailing, false); close(p.grabSpinAngle, 0, 'transfer unexpectedly rotated');
        assert.equal(p.grindAirLat, 0, 'rail catch leaked sideways velocity'); cases++;
      }
    }

    // Actual screen-relative takeoff on rotated/reversed/sloping rails.
    for (const park of [false, true]) for (const yaw of [0, Math.PI / 2, .65]) for (const dir of [-1, 1]) {
      fixture({ park, yaw, dir, slope: .06 });
      const rx = Math.cos(yaw), ry = Math.sin(yaw);
      const start = launch({ x: rx, y: ry });
      const forward = p.axisF.clone();
      step({});
      const delta = p.pos.clone().sub(start);
      close(delta.dot(forward), p.speed * CONST.fixedStep, 'transfer altered along-rail speed');
      assert.ok(delta.x * rx - delta.z * ry > .04, 'transfer went against screen direction'); cases++;
    }

    for (const park of [false, true]) {
      fixture({ park }); launch({ x: .5 });
      close(Math.abs(p.grindAirLat), TUNING.grindTransferSpeed / 2, 'half stick lost analog transfer distance'); cases++;
      // Same-frame / late input, stick noise and a direction released before
      // takeoff all leave the neutral trajectory intact.
      for (const opts of [{ x: 0, releaseX: 1 }, { x: .2 }, { x: 1, releaseX: 0 }, { y: 1 }]) {
        fixture({ park }); launch(opts); close(p.grindAirLat, 0, 'accidental transfer');
        const x = p.pos.x;
        for (let i = 0; i < 12; i++) step({ moveX: 1, transferHeld: i < 6 });
        close(p.pos.x, x, 'late direction / R2 steered a neutral pop'); cases++;
      }
      fixture({ park }); launch({ x: 1 });
      const lateral = p.grindAirLat;
      for (let i = 0; i < 4; i++) step({ moveX: 1, transferHeld: true });
      close(p.grabSpinAngle, 0, 'transfer hold was not consumed');
      step({});
      for (let i = 0; i < 15; i++) step({ moveX: 1, grabHeld: true, grabPressed: i === 0 });
      assert.ok(Math.abs(p.grabSpinAngle) > .3, 'fresh direction after transfer could not spin');
      close(p.grindAirLat, lateral, 'grab or R2 cancelled launch momentum'); cases++;

      fixture({ park }); launch({ x: 1 });
      p.respawn(level, true);
      assert.equal(p.grindExitAir, false); assert.equal(p.grindAirLat, 0); assert.equal(p.grindOllieCatchArmed, false); cases++;

      const rail = fixture({ park });
      p.grindT = rail.totalLength - .05;
      step({ grindHeld: true }); assert.equal(p.state, 'air');
      for (let i = 0; i < 45; i++) { step({ grindHeld: true }); assert.notEqual(p.state, 'grind', 'endpoint re-catch loop'); }
      cases++;
    }
    console.log(`PASS ${cases} rail-ollie intent cases, ${frames} native controller frames; neutral spins, fresh catch/bail, side exits, rail transfers, screen axes, stick noise, modifiers, lifecycle and endpoints. Transfer speed ${TUNING.grindTransferSpeed} m/s.`);
    console.log('Measured displacement by return to launch height:', JSON.stringify(distances));
  } finally { level.dispose(); }
});
