import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeInput } from './jungle-cup-harness.mjs';
import { withBlockworksRuntime, normalizeGameInput } from './blockworks-runner.mjs';

const source = { v: 1, name: 'Board roll landing', spawn: [0, .05, 60], killY: -80,
  components: [{ t: 'platform', p: [0, -.5, 0], s: [240, 1, 400], edgeGrinding: false },
    { t: 'gate', p: [100, 0, -180] }] };
await withBlockworksRuntime(async r => {
  const { createPlayerStarterAnimationSuite } = await r.server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await r.server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const { RigBinding } = await r.server.ssrLoadModule('/src/animation/rigBinding.ts');
  const p = r.p, l = r.l ?? r.level;
  const rig = RigBinding.fromSculptRuntime(p.animationRig.root).definition;
  const runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(rig));
  let previous = {}, samples = [];
  let lowestRollClearance = Infinity;
  const tick = (sample = {}) => {
    const input = normalizeGameInput(sample, previous); previous = { ...input };
    p.step(1 / 60, input, l); l.update(1 / 60); p.commitRenderStep(l);
    if (p.animationClipHint === 'player.roll-land') {
      p.group.updateMatrixWorld(true);
      const gap = p.interactionMeasure.sampledPlaneDistance(p.riderG, p.pos.clone().set(0, 1, 0), p.pos);
      lowestRollClearance = Math.min(lowestRollClearance, gap);
      assert.ok(gap >= -.015, `roll penetrated floor by ${-gap}m`);
      assert.deepEqual(p.riderG.scale.toArray(), [1, 1, 1], 'roll scaled the whole skeleton');
    }
    const row = { speed: Math.abs(p.speed), state: p.state, bail: p.isBailing, roll: p.rollLandingT,
      clip: p.animationClipHint, pos: p.pos.toArray(), velocity: p.walkVelocity.toArray() };
    samples.push(row); return row;
  };
  const setup = (speed, yaw = 0) => {
    p.respawn(l, true, true); previous = {}; samples = [];
    p.axisF.set(Math.sin(yaw), 0, -Math.cos(yaw)); p.axisL.set(-p.axisF.z, 0, p.axisF.x);
    p.freeSkate = true; p.speed = speed; p.lastPlanar = speed;
    p.grounded = true; p.state = 'ride'; p.groundHit = p.queryGround(l);
  };
  let cases = 0;
  try {
    for (const speed of [8, 18, 27]) for (const yaw of [0, Math.PI / 2, Math.PI]) {
      setup(speed, yaw);
      for (let i = 0; i < 12; i++) tick({ jumpHeld: true });
      tick(); assert.equal(p.state, 'air'); assert.equal(p.boardOllieAir, true);
      for (let i = 0; i < 4; i++) tick();
      const before = Math.abs(p.speed);
      tick({ jumpHeld: true }); tick({ jumpHeld: true }); tick();
      assert.equal(p.emergencyEjectLandingPending, true);
      assert.ok(Math.abs(p.speed - before) < 1e-8, 'dismount taxed speed');
      assert.ok(Math.abs(p.flyBoardVel.dot(p.axisF) - before) < 1e-8, 'deck lost its forward carry');
      assert.ok(Math.abs(p.flyBoardVel.dot(p.axisL)) > 1, 'loose deck did not clear the rolling rider');
      for (let i = 0; i < 240 && !p.grounded; i++) tick();
      assert.equal(p.isBailing, false); assert.equal(p.animationClipHint, 'player.roll-land');
      assert.ok(Math.abs(p.walkVelocity.length() - before) < 1e-7, 'touchdown lost velocity');
      assert.equal(p.freeSkate, false);
      const contact = samples.length - 1;
      for (let i = 0; i < 60 && p.rollLandingT >= 0; i++) tick();
      assert.ok(samples.slice(contact + 15).every(s => Math.hypot(...s.velocity) < .01), 'released roll kept auto-running');
      assert.equal(p.isBailing, false); assert.equal(p.animationClipHint, 'player.idle');
      assert.equal(runtime.activeClipId, 'player.idle', 'stopped roll forced a running animation');
      assert.ok(p.animationRig.joints.every(j => [...j.node.position.toArray(), ...j.node.scale.toArray()].every(Number.isFinite)));
      // Releasing the run should still stop; no permanent auto-run or phantom board recall.
      for (let i = 0; i < 180; i++) tick();
      assert.ok(p.walkVelocity.length() < .01); assert.equal(p.freeSkate, false);
      cases++;
    }
    setup(20);
    p.performBoardAbandon(.3, 'Emergency Eject', false);
    p.pos.y = 2; p.state = 'air'; p.grounded = false;
    for (let i = 0; i < 240 && !p.grounded; i++) tick({ moveY: 1 });
    const carried = p.walkVelocity.length();
    for (let i = 0; i < 120; i++) tick({ moveY: 1 });
    assert.ok(carried > r.TUNING.walkSpeed, 'fixture did not carry skate speed into contact');
    assert.ok(Math.abs(p.walkVelocity.length() - r.TUNING.walkSpeed) < 1e-6, 'run kept skate speed');
    assert.equal(p.freeSkate, false);
    tick({ jumpHeld: true }); tick();
    assert.equal(p.state, 'air', 'roll/run blocked a new jump');
    assert.notEqual(p.animationClipHint, 'player.roll-land');
    p.respawn(l, true, true);
    assert.equal(p.boardRunCarry, false); assert.equal(p.rollLandingT, -1);
    // A real excessive drop and an already active wipeout still own contact.
    for (const existingBail of [false, true]) {
      setup(18); p.performBoardAbandon(.3, 'Emergency Eject', false);
      p.pos.y = 35; p.airPeakY = 35; p.state = 'air'; p.grounded = false; p.vVel = -25;
      if (existingBail) p.bail();
      for (let i = 0; i < 100 && p.pos.y > 1; i++) tick();
      for (let i = 0; i < 8; i++) tick();
      assert.equal(p.isBailing, true, 'roll suppressed a genuine impact');
      assert.notEqual(p.animationClipHint, 'player.roll-land');
    }
    // Authored camera views used to replace the airborne travel heading with
    // the camera forward every tick. Exercise the actual second jump while
    // holding every screen direction, and while the camera turns under a hold.
    l.cameraViews.push({p:[0,0,0],s:[500,100,500],yaw:0,feather:0});
    for (const [x,y] of [[1,0],[-1,0],[0,1],[0,-1],[.6,.8]]) {
      const yaw=Math.atan2(x,y);setup(18,yaw);p.camDir.set(0,0,-1);
      const sample={moveX:x,moveY:y};
      for(let i=0;i<12;i++)tick({...sample,jumpHeld:true});
      tick(sample);for(let i=0;i<4;i++)tick(sample);
      tick({...sample,jumpHeld:true});tick({...sample,jumpHeld:true});tick(sample);
      assert.equal(p.emergencyEjectLandingPending,true);
      assert.equal(p.rawInput.moveX,x,'dismount remapped the raw horizontal input');
      assert.equal(p.rawInput.moveY,y,'dismount remapped the raw forward input');
      for(let i=0;i<24;i++) {
        p.camDir.set(Math.sin(i*.025),0,-Math.cos(i*.025));tick(sample);
        assert.ok(p.axisF.x*x-p.axisF.z*y>.98,'held dismount direction bent with the camera');
      }
      for(let i=0;i<200&&!p.grounded;i++)tick(sample);
      for(let i=0;i<20;i++)tick(sample);
      assert.ok(Math.abs(p.walkVelocity.length()-r.TUNING.walkSpeed)<1e-6,'directional dismount did not return to run speed');
      assert.ok((p.walkVelocity.x*x-p.walkVelocity.z*y)/p.walkVelocity.length()>.98,'run uses the wrong direction');
      cases++;
    }
    console.log(`PASS ${cases} native dismounts: impact carry, prompt neutral stop/idle, normal run speed, camera-stable screen directions, finite rig, jump/reset and real impacts. Lowest roll clearance ${lowestRollClearance.toFixed(4)}m.`);
  } finally { runtime.dispose(); }
}, { source: () => source, levelId: 'board-roll-landing' });

// The supplied Treehouse recording contains a held Right dismount followed
// by release. Replay the unchanged input/camera stream through that encounter;
// later course positions intentionally change once the first landing is fixed.
const recording = JSON.parse(await readFile(new URL('./fixtures/board-dismount-direction-replay.json', import.meta.url), 'utf8'));
await withBlockworksRuntime(async r => {
  const { Replayer } = await r.server.ssrLoadModule('/src/replay.ts');
  const playback = new Replayer(); playback.begin(recording);
  const { p, l } = r, input = makeInput(); p.endlessDeaths = recording.endlessDeaths; p.respawn(l, true);
  let flight = 0, landing = -1;
  try {
    for (let frame = 0; frame < 4240; frame++) {
      playback.feed(input, p.camDir); const previous = p.pos.clone();
      p.step(r.dt, input, l); l.update(r.dt); p.flushLevelCrateRewards(l); p.commitRenderStep(l);
      if (p.emergencyEjectLandingPending) {
        assert.equal(input.moveX, 1); assert.equal(input.moveY, 0);
        assert.equal(p.rawInput.moveX, 1); assert.equal(p.rawInput.moveY, 0);
        const delta = p.pos.clone().sub(previous).setY(0);
        assert.ok(delta.x > .3 && Math.abs(delta.z) < .002, `frame ${frame}: Right dismount steered down-course`);
        flight++;
      }
      if (landing < 0 && p.rollLandingT >= 0) landing = frame;
      if (landing >= 0 && frame >= landing + 16 && input.moveX === 0 && input.moveY === 0)
        assert.ok(p.walkVelocity.length() < .01, `frame ${frame}: released landing kept running`);
      assert.equal(p.isBailing, false);
    }
    assert.ok(flight >= 30 && landing > 0, 'recorded dismount was not reproduced');
    console.log(`PASS supplied Treehouse replay: ${flight} correctly directed air frames; landing ${landing}, neutral stopped within 0.25s.`);
  } finally { playback.end(); }
}, { modulePath: '/src/levels/treehouse-trail.ts', source: m => m.TREEHOUSE_TRAIL_LEVEL, levelId: 'treehouse-trail' });
