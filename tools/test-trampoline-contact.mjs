import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';
import { normalizeGameInput } from './blockworks-runner.mjs';

const data = { v: 1, name: 'Bonus: Springtide Skippers', spawn: [0, .1, 18], killY: -50,
  hugeDropBail: false, // Carlisle's authored policy; metal impacts must still bail.
  components: [
    { t: 'platform', p: [20, -.5, 0], s: [120, 1, 180] },
    { t: 'trampoline', nm: 'Contact net', p: [0, .02, 0], s: [24, .6, 24], speed: 48, amp: 1.25 },
    { t: 'mover', nm: 'Spinning net', p: [40, .02, 0], s: [24, .6, 24], axis: 'x', amp: 0, spin: 25, bounce: 48 },
    { t: 'gate', p: [0, 0, -80] },
  ] };
await withSkateRuntime(async ({ player: p, level, CONST, THREE, TUNING }) => {
  p.competitionMode = false;
  const tuning = JSON.stringify(TUNING), pad = level.groundMeshes.find(m => m.name === 'Contact net');
  let previous = {}, bails = [];
  const bail = p.bail;
  p.bail = function (...args) { bails.push(args); return bail.apply(this, args); };
  const tick = (sample = {}) => {
    const input = normalizeGameInput(sample, previous); previous = { ...input }; p.rawInput = input;
    p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep);
    assert.ok(p.pos.toArray().every(Number.isFinite));
  };
  const reset = (x, z, board = false, heading = [0, 0, -1]) => {
    p.respawn(level, true, true, { position: new THREE.Vector3(x, .1, z), heading: new THREE.Vector3(...heading) });
    previous = {}; bails = []; p.freeSkate = board; p.speed = board ? 12 : 0;
  };
  const jumpFromNet = () => {
    reset(0, 0); tick(); const id = p.trampolineLaunchId;
    for (let f = 0; f < 6; f++) tick({ jumpHeld: true });
    assert.ok(p.grounded, 'holding jump bounced a supported walker');
    tick(); assert.equal(p.state, 'air'); assert.equal(p.trampolineLaunchId, id);
    for (let f = 0; f < 180 && p.trampolineLaunchId === id; f++) tick();
    assert.equal(p.trampolineLaunchId, id + 1, 'jump landing did not launch');
    assert.ok(p.vVel > 40 && p.trampolineAir);
  };
  try {
    for (const x of [0, 10]) {
      reset(x, 18); const id = p.trampolineLaunchId;
      for (let f = 0; f < 150; f++) { tick({ moveY: 1 }); assert.ok(p.grounded && !p.isBailing); }
      assert.ok(p.pos.z < 0); assert.equal(p.trampolineLaunchId, id);
      assert.equal(pad.userData.trampolineVisualImpact, undefined, 'walking rang the bounce feedback');
      assert.equal(p.groundHit.trampolineRim, x === 10);
    }
    reset(10, 0); tick(); const gentleId = p.trampolineLaunchId;
    for (let f = 0; f < 6; f++) tick({ jumpHeld: true });
    tick(); assert.equal(p.state, 'air');
    for (let f = 0; f < 180 && !p.grounded; f++) tick();
    assert.ok(p.grounded && p.groundHit.trampolineRim && !p.isBailing, 'ordinary hop onto metal became a heavy impact');
    assert.equal(p.trampolineLaunchId, gentleId, 'ordinary rim landing bounced');
    reset(10, 18, true); const rimId = p.trampolineLaunchId;
    for (let f = 0; f < 100; f++) { tick(); assert.ok(!p.isBailing && p.freeSkate); }
    assert.ok(p.groundHit.trampolineRim); assert.equal(p.trampolineLaunchId, rimId);
    reset(0, 18, true); const entryId = p.trampolineLaunchId;
    for (let f = 0; f < 100 && !p.isBailing; f++) tick();
    assert.ok(p.isBailing && p.ragForwardTrip && !p.freeSkate);
    assert.equal(bails.length, 1); assert.equal(bails[0][2], 'trip'); assert.equal(p.trampolineLaunchId, entryId);
    for (let f = 0; f < 30; f++) tick();
    assert.equal(p.trampolineLaunchId, entryId, 'ragdoll bounced off the net');

    jumpFromNet(); const first = p.trampolineLaunchId;
    for (let f = 0; f < 360 && p.trampolineLaunchId === first; f++) tick();
    assert.equal(p.trampolineLaunchId, first + 1, 'linked landing stopped bouncing');
    assert.equal(p.isBailing, false);

    // A released board ollie clears the safe frame before touching the net.
    reset(0, 11, true);
    for (let f = 0; f < 6; f++) tick({ jumpHeld: true });
    tick(); assert.equal(p.state, 'air'); assert.equal(p.isBailing, false);
    const boardId = p.trampolineLaunchId;
    for (let f = 0; f < 180 && p.trampolineLaunchId === boardId; f++) tick();
    assert.equal(p.trampolineLaunchId, boardId + 1, JSON.stringify({pos:p.pos.toArray(),state:p.state,board:p.freeSkate,bail:p.isBailing,axis:p.axisF.toArray(),rim:p.groundHit?.trampolineRim,speed:p.speed,bails})); assert.equal(p.freeSkate, true); assert.equal(p.isBailing, false);

    jumpFromNet(); const bigId = p.trampolineLaunchId;
    for (let f = 0; f < 360 && !p.isBailing; f++) tick({ moveX: Math.abs(10 - p.pos.x) > .15 ? Math.sign(10 - p.pos.x) : 0 });
    assert.ok(p.isBailing && p.groundHit.trampolineRim, 'big bounce onto metal did not ragdoll');
    assert.equal(bails.at(-1)[2], 'landing'); assert.ok(bails.at(-1)[3] >= TUNING.hugeDropImpact);
    assert.equal(p.trampolineLaunchId, bigId, 'metal rim relaunched the big bounce');

    // The asymmetric visual opening follows every mover pose and yaw.
    const mover = level.movers[0];
    for (let f = 0; f < 4; f++) {
      level.update(.73); mover.mesh.updateMatrixWorld(true);
      for (const [x, z, rim] of [[0, 0, false], [-7.5, 0, true], [8.4, 0, false], [0, 9, true]]) {
        const at = mover.mesh.localToWorld(new THREE.Vector3(x, .3, z));
        p.pos.copy(at); p.pos.y += .1; p.prevPos.copy(p.pos); p.state = 'air'; p.grounded = false;
        const hit = p.queryGround(level);
        assert.equal(hit.mesh.uuid, mover.mesh.uuid, 'contact selected a different support'); assert.equal(hit.trampolineRim, rim);
        assert.equal(hit.trampolineBounce === undefined, rim);
      }
    }
    assert.equal(JSON.stringify(TUNING), tuning);
    console.log('PASS walkable nets; safe walk/skate metal rims; grounded board trip; actual foot jump and board ollie landings; linked bounces; high-energy rim ragdoll; rotated/moving opening; unchanged tuning.');
  } finally { p.bail = bail; }
}, { levelEntry: { id: '__trampoline_contact', name: data.name, data } });
