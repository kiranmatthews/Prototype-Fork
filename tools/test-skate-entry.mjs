import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const data = {
  v: 1, name: 'Slippery foot jump and skate entry', spawn: [0, 65.05, 0], killY: -50,
  components: [
    { t: 'ramp', p: [0, 0, 0], len: 400, rise: 130, w: 100, yaw: 180,
      slip: true, iceGrip: .035, slipGravity: 1.9 },
    { t: 'gate', p: [0, 0, -195] },
  ],
};

await withSkateRuntime(async ({ player: p, level, CONST, TUNING }) => {
  p.competitionMode = false;
  const tick = (buttons = {}) => {
    const input = makeInput(buttons);
    p.rawInput = input;
    p.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    input.consumeEdges();
  };
  const reset = () => {
    p.respawn(level, true);
    tick();
    assert.ok(p.grounded && p.groundHit.slippy);
    assert.equal(p.freeSkate, false);
  };
  const descend = () => {
    reset();
    for (let f = 0; f < 240 && p.speed < 16; f++) {
      tick();
      assert.equal(p.freeSkate, false, 'passive downhill speed mounted the board');
    }
    assert.ok(p.speed >= 16, 'fixture did not build genuine downhill momentum');
  };
  for (const moveY of [0, 1]) {
    descend();
    tick({ jumpHeld: true, jumpPressed: true, moveY });
    tick({ jumpReleased: true, moveY });
    assert.equal(p.state, 'air');
    const speed = p.speed;
    let landed = false;
    for (let f = 0; f < 180; f++) {
      tick();
      assert.equal(p.freeSkate, false, 'a quick foot jump mounted without the hold-and-direction gesture');
      if (p.grounded) { landed = true; break; }
    }
    assert.ok(landed, 'slippery jump never landed');
    assert.ok(Math.abs(p.speed - speed) < .001, 'foot landing confiscated carried speed');
    for (let f = 0; f < 12; f++) {
      tick();
      assert.equal(p.freeSkate, false, 'foot landing automatically mounted from downhill speed');
    }
    assert.ok(p.speed > speed, 'slope stopped accelerating the on-foot slide');
    // A deliberate hold still mounts normally after the same landing.
    let mounted = false;
    for (let f = 0; f < 90; f++) {
      tick({ jumpHeld: true, jumpPressed: f === 0, moveY: 1 });
      if (p.freeSkate) {
        assert.ok(p.skateCharge >= TUNING.skateHoldTime, 'mount skipped its commitment time');
        mounted = true;
        break;
      }
    }
    assert.ok(mounted, 'fix blocked a deliberate skate mount');
    for (let f = 0; f < 12; f++) { tick(); assert.equal(p.freeSkate, true, 'mounted coasting changed'); }
  }
  // Direction alone, and a long jump charge with no direction, do not mount.
  reset();
  for (let f = 0; f < 60; f++) { tick({ moveY: 1 }); assert.equal(p.freeSkate, false); }
  reset();
  for (let f = 0; f < 90; f++) { tick({ jumpHeld: true, jumpPressed: f === 0 }); assert.equal(p.freeSkate, false); }
  // Planted hold + direction remains a valid mount from rest.
  reset();
  for (let f = 0; f < 90 && !p.freeSkate; f++) tick({ jumpHeld: true, jumpPressed: f === 0, moveY: 1 });
  assert.equal(p.freeSkate, true, 'planted push-off stopped working');
  console.log('PASS slippery foot jumps retain momentum and foot ownership; quick taps/partial gestures stay on foot; deliberate moving/planted mounts and mounted coasting still work.');
}, { levelEntry: { id: '__skate_entry', name: data.name, data } });

const springData = { ...data, components: [
  ...data.components,
  { t: 'trampoline', p: [0, 50.07, -46], s: [30, .6, 6], speed: 18, amp: 1 },
] };
await withSkateRuntime(async ({ player: p, level, CONST, TUNING }) => {
  p.competitionMode = false;
  let launched = false, landed = false, launchSpeed = 0, afterLanding = 0;
  for (let f = 0; f < 600; f++) {
    const input = makeInput();
    p.step(CONST.fixedStep, input, level);
    level.update(CONST.fixedStep);
    assert.equal(p.freeSkate, false, 'slippery momentum mounted a board after a trampoline');
    if (!launched && p.trampolineAir) { launched = true; launchSpeed = p.speed; }
    if (launched && p.grounded) landed = true;
    if (landed && ++afterLanding === 12) break;
  }
  assert.ok(launched && landed && afterLanding === 12, 'fixture missed the spring and its landing');
  assert.ok(launchSpeed > TUNING.walkSpeed + .5, 'spring test did not carry downhill speed');
  assert.ok(p.speed > TUNING.walkSpeed + .5, 'spring landing lost the downhill momentum');
  console.log('PASS passive downhill slide → native trampoline → slope landing stays on foot at carried speed.');
}, { levelEntry: { id: '__skate_entry_spring', name: springData.name, data: springData } });
