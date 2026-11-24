// Wall plant (wall kick on foot, wallplant on the board): the production
// Player against a source-owned Level, driven only through device input.
import assert from 'node:assert/strict';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const source = { v: 1, name: 'Wall plant fixture', spawn: [0, .05, 20], killY: -40, components: [
  { t: 'platform', p: [0, -.5, 0], s: [260, 1, 260], nm: 'Floor', edgeGrinding: false },
  // A kick shaft: two bare 16 m faces, 4 m apart.
  { t: 'wall', p: [-2.5, 0, -10], s: [1, 16, 8], nm: 'Shaft west' },
  { t: 'wall', p: [2.5, 0, -10], s: [1, 16, 8], nm: 'Shaft east' },
  // The same shaft built from blocks, whose tops are ledges to finish a climb on.
  { t: 'platform', p: [-5, 8, 60], s: [6, 16, 8], nm: 'Block shaft west' },
  { t: 'platform', p: [5, 8, 60], s: [6, 16, 8], nm: 'Block shaft east' },
  // One tall wall with nothing facing it.
  { t: 'wall', p: [30.5, 0, -10], s: [1, 16, 14], nm: 'Lone wall' },
  // A 4 m block whose top a jump can still reach: a wall to climb, not kick.
  { t: 'platform', p: [-33, 2, -10], s: [6, 4, 10], nm: 'Climbable block' },
  // Collider only: nothing is drawn, so nothing can be kicked off.
  { t: 'wall', p: [-60.5, 0, -10], s: [1, 16, 14], invisible: true, nm: 'Invisible barrier' },
  // A curved face.
  { t: 'wallpath', p: [60, 0, -10], pts: [[0, -9], [1.2, 0], [0, 9]], w: .6, rise: 16, curve: 'spline', nm: 'Curved wall' },
  // The end wall of a skate run down -Z, and a second one facing it.
  { t: 'wall', p: [0, 0, -70.5], s: [40, 16, 1], nm: 'Skate wall' },
  { t: 'wall', p: [0, 0, -45.5], s: [8, 16, 1], nm: 'Skate wall opposite' },
  // A corner: two faces at right angles.
  { t: 'wall', p: [-100.5, 0, -20], s: [1, 16, 20], nm: 'Corner west' },
  { t: 'wall', p: [-90, 0, -30.5], s: [20, 16, 1], nm: 'Corner south' },
  { t: 'gate', p: [110, 0, 110] },
] };

await withBlockworksRuntime(async ({ p, l, tick, worldDirectionInput, server, Level, THREE, TUNING, CONST }) => {
  const saved = { ...TUNING };
  // The course switch is level data: validated, built and captured like ledgeGrabs.
  const { normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  assert.equal(normalizeCustomLevelData({ ...source, wallPlants: 'no' }), null, 'a non-boolean wallPlants was accepted');
  assert.equal(normalizeCustomLevelData(source).wallPlants, undefined);
  const optedOut = new Level(new THREE.Scene(), { id: 'wall-plant-off', name: 'off', data: { ...source, wallPlants: false } });
  try {
    assert.equal(optedOut.wallPlants, false);
    assert.equal(normalizeCustomLevelData(optedOut.captureData()).wallPlants, false, 'wallPlants: false did not survive a capture');
  } finally { optedOut.dispose(); }
  assert.equal(l.wallPlants, true);
  assert.equal(normalizeCustomLevelData(l.captureData()).wallPlants, undefined, 'the default was written into captured data');
  const dt = CONST.fixedStep;
  const place = (x, z, y = .05) => {
    p.respawn(l, true, false, { position: new THREE.Vector3(x, y, z), heading: new THREE.Vector3(0, 0, -1) });
    for (let i = 0; i < 20; i++) tick({});
    assert.ok(p.grounded && p.state === 'ride', 'fixture start is not supported');
  };
  const toward = (x, z, pace = 1) => worldDirectionInput({ x, z }, pace);
  const velocity = () => new THREE.Vector3(p.lastVelX, 0, p.lastVelZ);
  /** Run in a world direction, then a tap jump; returns airborne and moving. */
  const runJump = (dx, dz, runFrames = 16, chargeFrames = 2) => {
    for (let i = 0; i < runFrames; i++) tick(toward(dx, dz));
    for (let i = 0; i < chargeFrames; i++) tick({ ...toward(dx, dz), jumpHeld: true });
    tick(toward(dx, dz));
    assert.equal(p.state, 'air', 'the fixture jump did not leave the floor');
  };
  /** Fly holding `stick` until `until()`; throws if the air ends first. */
  const fly = (stick, until, limit = 240, label = 'flight') => {
    for (let i = 0; i < limit; i++) {
      if (until()) return i;
      tick(typeof stick === 'function' ? stick() : stick);
      if (p.grounded) break;
    }
    if (until()) return limit;
    throw new Error(`${label} ended early: ${JSON.stringify({ pos: p.pos.toArray(), state: p.state, grounded: p.grounded, vVel: p.vVel })}`);
  };
  const tapX = stick => { tick({ ...stick, jumpHeld: true }); tick({ ...stick }); };
  const onFace = () => p.wallPlantContactT > 0;
  const report = [];

  try {
    // ---- ON FOOT -----------------------------------------------------------
    // 1. The late press: touch the wall, then X inside the window.
    place(1.3, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), onFace);
    const touchY = p.pos.y;
    assert.ok(Math.abs(p.pos.x - (-1.47)) < .02, `not standing on the west face: ${p.pos.x}`);
    for (let i = 0; i < 5; i++) tick(toward(-1, 0)); // five frames late: still inside 0.2 s
    assert.ok(onFace(), 'the late window closed before 0.2 s');
    tick({ ...toward(-1, 0), jumpHeld: true });
    assert.equal(p.wallPlantChain, 1, 'a press inside the late window did not plant');
    assert.ok(p.wallPlantStickT > 0 && p.vVel === 0, 'the plant did not hold on the face');
    const plantY = p.pos.y;
    tick({ ...toward(-1, 0), jumpHeld: true });
    assert.ok(p.wallPlantStickT > 0 && Math.abs(p.pos.y - plantY) < 1e-9 && Math.abs(p.pos.x + 1.47) < .02, 'the body moved while planted');
    fly({ jumpHeld: true }, () => p.wallKickAir, 6, 'plant hold');
    assert.equal(p.lastJumpType, 'Wall Kick');
    // The camera's ride up is over half done by the launch, two steps after
    // the plant. Measured in the browser, a rise slow enough to fail this lets
    // the pop carry the rider's head out of the top of the frame.
    assert.ok(p.wallPlantCameraLift > .55 && p.wallPlantCameraLift < 1, `the camera lift lagged the kick: ${p.wallPlantCameraLift}`);
    assert.ok(Math.abs(p.walkVelocity.x - TUNING.wallPlantOut) < 1e-6 && Math.abs(p.walkVelocity.z) < 1e-6, 'head-on kick did not leave straight out');
    assert.ok(p.vVel > TUNING.wallPlantUp - 1, 'kick lost its pop');
    assert.deepEqual(p.comboLabels, ['Wall Kick']);
    assert.equal(p.airJumpUsed, false, 'the kick spent the double jump');
    // The stick still held INTO the wall never cancels the kick: the first
    // beat is committed, and even held all the way it reaches the far face.
    let x0 = p.pos.x;
    for (let i = 0; i < 6; i++) tick(toward(-1, 0));
    assert.ok(Math.abs(p.walkVelocity.x - TUNING.wallPlantOut) < 1e-6, 'the committed beat of a kick was steered');
    assert.ok(p.pos.x > x0 + .8, 'holding into the wall cancelled the kick');
    fly(toward(-1, 0), onFace, 60, 'kick held into its own wall');
    assert.ok(p.pos.x > 1.4 && p.pos.y > plantY + 1.5, `a held stick stalled the kick short of the far face: ${p.pos.toArray()}`);
    report.push(`late press +5f, touch ${touchY.toFixed(2)} m`);

    // 2. A chain up the shaft, with nothing held: only the timing of X.
    place(1.3, -10);
    runJump(-1, 0);
    let peak = 0, plants = [], armed = true;
    for (let i = 0; i < 500 && !p.grounded && p.pos.y < 13.5; i++) {
      const press = armed && onFace() && p.wallPlantContactT < TUNING.wallPlantWindow - 2 * dt;
      armed = !press;
      tick({ ...(p.wallPlantChain ? {} : toward(-1, 0)), jumpHeld: press });
      if (p.wallPlantChain > plants.length) plants.push(p.pos.y);
      peak = Math.max(peak, p.pos.y);
    }
    assert.ok(plants.length >= 5, `shaft chain broke after ${plants.length} kicks`);
    const gains = plants.slice(1).map((y, i) => y - plants[i]);
    assert.ok(gains.every(g => g > 1.8 && g < 2.8), `kicks did not climb evenly: ${gains.map(g => g.toFixed(2))}`);
    assert.ok(Math.abs(p.pos.z + 10) < 1e-6, 'a head-on chain drifted along the shaft');
    assert.equal(p.comboLabels.at(-1), `Wall Kick x${plants.length}`);
    report.push(`${plants.length}-kick chain, +${(gains.reduce((a, b) => a + b) / gains.length).toFixed(2)} m per kick`);

    // 3. The early press: X before the wall fires on contact, and is not a double jump.
    for (const lead of [1, 5, 10]) {
      place(1.3, -10);
      runJump(-1, 0);
      const framesOut = () => (p.pos.x + 1.47) / (TUNING.walkSpeed * dt);
      fly(toward(-1, 0), () => framesOut() <= lead, 120, 'approach');
      tapX(toward(-1, 0));
      assert.equal(p.doubleJumpAir, false, `an X ${lead} frames before the wall double jumped`);
      fly(toward(-1, 0), () => p.wallPlantChain === 1, 20, `early press ${lead}f`);
      assert.equal(p.airJumpUsed, false);
      fly(toward(-1, 0), () => p.wallKickAir, 8, 'plant hold');
    }
    report.push('early press 1/5/10 frames ahead');

    // 4. Too early for the buffer: the press is the double jump it always was.
    place(1.3, -10);
    runJump(-1, 0);
    tapX(toward(-1, 0));
    assert.equal(p.doubleJumpAir, true, 'a mid-air tap far from the wall was not a double jump');
    assert.equal(p.wallPlantChain, 0);

    // 5. Too late: the window is finite, and holding on does not reopen it.
    place(1.3, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), onFace);
    for (let i = 0; i < 14; i++) tick(toward(-1, 0));
    assert.equal(onFace(), false, 'the late window never closed');
    p.airJumpUsed = true; // isolate the kick from the double jump
    tapX(toward(-1, 0));
    assert.equal(p.wallPlantChain, 0, 'a press after the window still planted');
    // ...but coming OFF the wall and meeting it again is a new impact.
    for (let i = 0; i < 8; i++) tick({});
    fly(toward(-1, 0), onFace, 30, 're-impact');
    tapX(toward(-1, 0));
    assert.equal(p.wallPlantChain, 1, 'a second impact did not offer a new window');
    report.push('late miss, re-impact');

    // 6. One wall cannot be climbed: the face just kicked takes no second kick.
    place(27, -10);
    runJump(1, 0);
    fly(toward(1, 0), onFace);
    tapX(toward(1, 0));
    fly(toward(1, 0), () => p.wallKickAir, 8, 'plant hold');
    const kickedAt = p.pos.y;
    let back = 0, replant = false;
    for (; back < 200 && !p.grounded; back++) {
      tick({ ...toward(1, 0), jumpHeld: back % 6 < 2 }); // steer straight back, mashing X
      replant ||= p.wallPlantChain > 1;
      if (Math.abs(p.pos.x - 29.48) < .02 && back > 10) break;
    }
    assert.equal(replant, false, 'the same face took a second kick');
    assert.equal(p.wallPlantChain <= 1, true);
    void kickedAt;
    report.push(`lone wall: no second kick in ${(back * dt).toFixed(2)} s of steering back and mashing`);

    // 7. A wall you can still get on top of is climbed: X stays the double jump.
    place(-27, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), () => p.pos.x < -29.4, 60, 'approach to block');
    assert.equal(onFace(), false, 'a climbable wall opened a kick window');
    tapX(toward(-1, 0));
    assert.equal(p.wallPlantChain, 0, 'a climbable wall kicked the rider off its ledge');
    assert.equal(p.doubleJumpAir, true, 'X at a climbable wall was not the double jump');
    fly(toward(-1, 0), () => p.state === 'hang' || p.grounded && p.pos.y > 3.9, 120, 'climb');
    // ...unless the course designer's slider says every wall kicks.
    TUNING.wallPlantLedgeYield = 0;
    place(-27, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), onFace, 60, 'approach to block');
    tapX(toward(-1, 0));
    assert.equal(p.wallPlantChain, 1, 'wallPlantLedgeYield 0 did not kick a climbable wall');
    TUNING.wallPlantLedgeYield = saved.wallPlantLedgeYield;
    report.push('climbable wall keeps X');

    // 8. A tap the wall never answers goes back to the double jump.
    place(1.3, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), () => (p.pos.x + 1.47) / (TUNING.walkSpeed * dt) <= 8, 120, 'approach');
    tick({ ...toward(-1, 0), jumpHeld: true });
    assert.ok(p.wallPlantBufferT > 0, 'the press was not held for the wall');
    tick({}); // stick released: direct-drive air stops short of the wall
    assert.equal(p.doubleJumpAir, false);
    for (let i = 0; i < 16 && !p.doubleJumpAir; i++) tick({});
    assert.equal(p.doubleJumpAir, true, 'the unanswered tap was swallowed');
    assert.equal(p.wallPlantChain, 0);
    report.push('unanswered tap double jumps');

    // 9. A diagonal approach leaves on the mirrored diagonal.
    place(1.3, -8);
    runJump(-1, -1);
    fly(toward(-1, -1), onFace);
    tapX(toward(-1, -1));
    fly({}, () => p.wallKickAir, 8, 'plant hold');
    const along = p.wallPlantIncoming.z; // what the approach was really carrying along the face
    assert.ok(along < -3, `fixture approach was not diagonal: ${along}`);
    assert.ok(Math.abs(p.walkVelocity.x - TUNING.wallPlantOut) < 1e-6, 'diagonal kick lost its push out');
    assert.ok(Math.abs(p.walkVelocity.z - along) < 1e-6, `travel along the wall was not kept: ${p.walkVelocity.z} vs ${along}`);

    // 10. No kick off thin air, and none where the course says no.
    place(-57, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), () => p.pos.x < -59.4, 60, 'approach to barrier');
    for (let i = 0; i < 3; i++) tick(toward(-1, 0));
    assert.equal(onFace(), false, 'an invisible barrier offered a kick');
    p.airJumpUsed = true;
    tapX(toward(-1, 0));
    assert.equal(p.wallPlantChain, 0);
    l.wallPlants = false;
    place(1.3, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), () => p.pos.x < -1.45, 60, 'approach');
    for (let i = 0; i < 3; i++) tick(toward(-1, 0));
    assert.equal(onFace(), false, 'wallPlants: false still offered a kick');
    l.wallPlants = true;

    // 11. A curved wall plants along its own normal.
    place(57.5, -10);
    runJump(1, 0);
    fly(toward(1, 0), onFace, 80, 'approach to curve');
    tapX(toward(1, 0));
    fly({}, () => p.wallKickAir, 8, 'plant hold');
    assert.ok(p.walkVelocity.x < -TUNING.wallPlantOut * .9, `curved wall kicked the wrong way: ${p.walkVelocity.toArray()}`);
    report.push('diagonal, invisible, course opt-out, curved');

    // 12. The top of the shaft. Once the lip is within reach of the double jump
    // the wall is one to climb: the same X at the same wall takes the rider UP.
    place(1.3, 60);
    runJump(-1, 0);
    let side = -1, kicks = 0, atFace = false, hung = false, topDouble = false;
    for (let i = 0; i < 900 && !hung && !(p.grounded && p.pos.y < 1 && i > 30); i++) {
      const arrived = Math.abs(p.pos.x - side * 1.47) < .03;
      const press = arrived && !atFace && i % 2 === 0; // one X per arrival, a frame or two after touching
      if (press) atFace = true;
      tick({ ...toward(side, 0), jumpHeld: press }); // always holding toward the wall being flown at
      if (p.wallPlantChain > kicks) { kicks = p.wallPlantChain; side = -side; atFace = false; }
      topDouble ||= p.doubleJumpAir;
      hung ||= p.state === 'hang';
    }
    assert.ok(kicks >= 4, `only ${kicks} kicks before the top`);
    assert.ok(topDouble, 'the lip came into reach and X was still not the double jump');
    assert.ok(hung, `the climb did not finish on the shaft's ledge: ${JSON.stringify({ y: p.pos.y, state: p.state, kicks })}`);
    assert.ok(Math.abs(p.ledgeLip - 16) < .05, `hung on something that was not the top: ${p.ledgeLip}`);
    // The camera's ride stays with a rider hanging 16 m up: handing back to
    // the ground-anchored rig here sinks the shot and then lifts it again.
    for (let i = 0; i < 45; i++) tick({});
    assert.equal(p.state, 'hang', 'the fixture let go of the ledge');
    assert.equal(p.wallPlantChain, 0, 'the ledge did not re-arm the walls');
    assert.ok(p.wallPlantCameraLift > .99, `the camera ride was dropped during the hang: ${p.wallPlantCameraLift}`);
    report.push(`${kicks} kicks, a double jump and the ledge top out a 16 m shaft`);

    // 13. A kick lands on foot at run pace: carried air speed never mounts the board.
    place(1.3, -8);
    runJump(-1, -1);
    fly(toward(-1, -1), onFace);
    tapX(toward(-1, -1));
    fly({}, () => p.wallKickAir, 8, 'plant hold');
    assert.ok(p.walkVelocity.length() > TUNING.walkSpeed + .5, 'fixture kick is not faster than a run');
    for (let i = 0; i < 400 && !p.grounded; i++) tick(toward(0, -1));
    for (let i = 0; i < 30; i++) {
      tick(toward(0, -1));
      assert.equal(p.freeSkate, false, 'a wall kick landing mounted the board');
      assert.ok(p.walkVelocity.length() <= TUNING.walkSpeed + 1e-6, 'run speed exceeded after a kick');
    }
    assert.equal(p.wallKickAir, false);
    assert.equal(p.wallPlantChain, 0, 'landing did not re-arm the walls');
    // The camera's ride is held for a beat on the landing, then eases away.
    assert.ok(p.wallPlantCameraLift > .2, `the camera ride was cut at the landing: ${p.wallPlantCameraLift}`);
    for (let i = 0; i < 60; i++) tick({});
    assert.ok(p.wallPlantCameraLift < .02, `the camera ride did not ease away after the landing: ${p.wallPlantCameraLift}`);

    // 14. A corner is not a ladder: alternate two faces at right angles and the height runs out.
    // (A searched best case is two kicks, one off each face, about 6.5 m up.)
    place(-97, -27);
    runJump(-1, 0);
    let cornerPeak = 0, cornerPlants = 0;
    for (let i = 0; i < 900 && !(p.grounded && i > 40); i++) {
      // Fly at whichever corner face was not kicked last, mashing X on contact.
      const target = cornerPlants % 2 === 0 ? toward(-1, 0) : toward(0, -1);
      tick({ ...target, jumpHeld: onFace() && i % 2 === 0 });
      cornerPlants = Math.max(cornerPlants, p.wallPlantChain);
      cornerPeak = Math.max(cornerPeak, p.pos.y);
    }
    assert.ok(cornerPeak < 9, `a right-angle corner was climbed to ${cornerPeak.toFixed(2)} m`);
    report.push(`corner: ${cornerPlants} kicks, peak ${cornerPeak.toFixed(2)} m`);

    // ---- ON THE BOARD ------------------------------------------------------
    const skateIn = (stopZ, lead, hold = {}) => {
      place(0, 20);
      for (let i = 0; i < 900 && p.pos.z > stopZ; i++) tick({ moveY: 1, jumpHeld: true });
      assert.ok(p.freeSkate && p.grounded, 'the fixture run never mounted the board');
      tick({ moveY: 1 }); // release: ollie
      assert.equal(p.lastJumpType, 'Board Ollie');
      const entry = p.speed;
      let pressed = false;
      for (let i = 0; i < 200 && !p.grounded && !p.isBailing && p.wallPlantChain === 0; i++) {
        const seconds = (p.pos.z + 69.48) / Math.max(1, p.speed);
        const press = !pressed && lead !== null && seconds <= lead;
        pressed ||= press;
        tick({ ...hold, jumpHeld: press });
      }
      return entry;
    };
    // 15. The wallplant: X just before the wall turns a wipeout into a trick.
    for (const lead of [.03, .1, .18]) {
      const entry = skateIn(-62, lead);
      assert.equal(p.isBailing, false, `a wallplant pressed ${lead}s early wiped out`);
      assert.equal(p.wallPlantChain, 1, `no wallplant ${lead}s before the wall`);
      for (let i = 0; i < 8 && p.wallPlantStickT > 0; i++) tick({});
      assert.equal(p.lastJumpType, 'Wallplant');
      assert.ok(p.freeSkate && p.airFromSkate && !p.looseBoard, 'the wallplant lost the board');
      assert.ok(p.axisF.z > .99, `wallplant did not come straight back: ${p.axisF.toArray()}`);
      assert.ok(Math.abs(p.speed - entry * TUNING.wallPlantBoardKeep) < .6, `speed out ${p.speed.toFixed(2)} from ${entry.toFixed(2)} in`);
      assert.ok(p.comboLabels.includes('Wallplant'));
      assert.ok(p.comboMult >= 1, 'the wallplant did not count as a trick');
      for (let i = 0; i < 240 && !p.grounded; i++) tick({});
      assert.ok(p.grounded && p.freeSkate && !p.isBailing && p.speed > 15, 'the wallplant did not ride away');
    }
    report.push('wallplant 0.03/0.10/0.18 s early');

    // 15b. A glancing board approach is too soft to wipe out: the late press
    // counts there too, and the plant leaves on the mirrored line.
    {
      const heading = toward(.866, -.5);
      place(-14, -61.9);
      for (let i = 0; i < 900 && p.pos.z > -67.4; i++) tick({ ...heading, jumpHeld: true });
      assert.ok(p.freeSkate && p.grounded, 'the glancing run never mounted the board');
      tick(heading); // release: ollie
      fly({}, onFace, 90, 'glancing approach');
      assert.equal(p.isBailing, false, 'a glancing wall touch wiped out');
      const into = -p.wallPlantIncoming.z, along = p.wallPlantIncoming.x;
      assert.ok(into > TUNING.wallPlantMinSpeed && into < 8 && along > into, `fixture approach was not glancing: ${into.toFixed(2)} into, ${along.toFixed(2)} along`);
      tick({}); tick({});
      tapX({});
      assert.equal(p.wallPlantChain, 1, 'a late press on a soft board touch did not plant');
      for (let i = 0; i < 8 && p.wallPlantStickT > 0; i++) tick({});
      const out = Math.max(TUNING.wallPlantBoardOutMin, into * TUNING.wallPlantBoardKeep);
      assert.ok(Math.abs(p.speed * p.axisF.z - out) < .05, `glancing plant pushed out at ${(p.speed * p.axisF.z).toFixed(2)}, not ${out.toFixed(2)}`);
      assert.ok(Math.abs(p.speed * p.axisF.x - along * TUNING.wallPlantBoardKeep) < .05, 'glancing plant lost its travel along the wall');
      assert.ok(p.freeSkate && !p.looseBoard && p.comboLabels.includes('Wallplant'));
      report.push(`glancing board plant ${into.toFixed(1)} into / ${along.toFixed(1)} along`);
    }

    // 16. No press is the same wipeout it always was; so is a press far too early.
    skateIn(-62, null);
    assert.equal(p.isBailing, true, 'an unplanted wall hit no longer wipes out');
    assert.equal(p.wallPlantChain, 0);
    skateIn(-62, .45);
    assert.equal(p.wallPlantChain, 0, 'a press far outside the buffer still planted');

    // 17. A trick, a plant and another trick are three entries on one plate.
    {
      place(0, 20);
      for (let i = 0; i < 900 && p.pos.z > -62; i++) tick({ moveY: 1, jumpHeld: true });
      tick({ moveY: 1 });
      tick({ spinHeld: true }); tick({});
      let pressed = false, flipped = false;
      for (let i = 0; i < 200 && !p.grounded && !p.isBailing; i++) {
        const press = !pressed && (p.pos.z + 69.48) / Math.max(1, p.speed) <= .08;
        pressed ||= press;
        // A second flip once the plant has launched.
        const flip = p.wallPlantChain === 1 && p.wallPlantStickT <= 0 && !flipped;
        flipped ||= flip;
        tick({ jumpHeld: press, spinHeld: flip });
      }
      assert.equal(p.isBailing, false, 'the trick line wiped out');
      assert.equal(p.wallPlantChain, 0, 'landing did not re-arm');
      assert.ok(p.grounded && p.freeSkate);
      report.push(`trick line: ${p.comboLabels.join(' + ') || '(banked)'}`);
    }

    // 18. A second press on the way in is the same request, not a double jump spent before the wall.
    place(1.3, -10);
    runJump(-1, 0);
    fly(toward(-1, 0), () => (p.pos.x + 1.47) / (TUNING.walkSpeed * dt) <= 9, 120, 'approach');
    tapX(toward(-1, 0)); tapX(toward(-1, 0));
    assert.equal(p.doubleJumpAir, false, 'mashing X before the wall spent the double jump');
    fly(toward(-1, 0), () => p.wallPlantChain === 1, 20, 'mashed early press');
    assert.equal(p.airJumpUsed, false);

    // 19. A take recorded before the move replays without it, and new takes say they have it.
    {
      const { Recorder, Replayer, isReplayFile } = await server.ssrLoadModule('/src/replay.ts');
      const recorder = new Recorder(); recorder.start('wall-plant-fixture');
      const take = recorder.export();
      assert.equal(take.wallPlantPolicy, 1);
      assert.ok(isReplayFile(take));
      assert.equal(isReplayFile({ ...take, wallPlantPolicy: 2 }), false);
      const replayer = new Replayer();
      delete take.wallPlantPolicy;
      replayer.begin(take);
      try {
        place(1.3, -10);
        runJump(-1, 0);
        fly(toward(-1, 0), () => p.pos.x < -1.45, 60, 'legacy approach');
        for (let i = 0; i < 3; i++) tick(toward(-1, 0));
        assert.equal(onFace(), false, 'a legacy take was offered a kick');
        tapX(toward(-1, 0));
        assert.equal(p.wallPlantChain, 0);
        assert.equal(p.doubleJumpAir, true, 'a legacy take lost its double jump at the wall');
      } finally { replayer.end(); }
      place(1.3, -10);
      runJump(-1, 0);
      fly(toward(-1, 0), onFace, 60, 'approach after the legacy take');
    }
    report.push('mashed early press, legacy replays');

    // Presentation contract: the body squashes into the wall, stretches off it
    // and ends exactly neutral; segments deform independently, and on the board
    // the deck keeps both leg lengths.
    {
      const { sampleWallPlantMotion, WALL_PLANT_RELEASE_SECONDS } = await server.ssrLoadModule('/src/wallPlantMotion.ts');
      const leg = 'deform.leg.lower.left.length', torso = 'deform.torso.length', forearm = 'deform.arm.lower.left.length';
      const planted = sampleWallPlantMotion(1, -1, false).deformations;
      assert.ok(planted[leg] < .85 && planted[torso] < .9 && planted[leg] > .7, `the plant did not compress: ${JSON.stringify(planted)}`);
      const pushed = sampleWallPlantMotion(1, .06, false).deformations;
      assert.ok(pushed[leg] > 1.15 && pushed[torso] > 1.08, `the push did not stretch: ${JSON.stringify(pushed)}`);
      assert.ok(pushed[forearm] < pushed[leg], 'the arms did not trail the legs');
      let rebound = false;
      for (let age = 0; age <= WALL_PLANT_RELEASE_SECONDS + .08; age += 1 / 120) {
        const d = sampleWallPlantMotion(1, age, false).deformations;
        for (const value of Object.values(d)) assert.ok(value > .7 && value < 1.35, `segment length left its range at ${age.toFixed(3)}: ${value}`);
        rebound ||= d[leg] < .999 && age > .1;
      }
      assert.ok(rebound, 'the release never rebounded past neutral');
      const settled = sampleWallPlantMotion(1, WALL_PLANT_RELEASE_SECONDS + .05, false);
      assert.ok(Object.values(settled.deformations).every(value => value === 1), 'the release did not end neutral');
      assert.ok(settled.knee === 0 && settled.spine === 0 && settled.armSwing === 0, 'the pose did not end neutral');
      const deck = sampleWallPlantMotion(1, .06, true).deformations;
      assert.ok(!(leg in deck) && deck[torso] > 1, 'the board plant stretched the legs off the deck');
    }
    report.push('squash, stretch, rebound and neutral settle');

    // 20. Deterministic: the same inputs make the same run.
    const record = () => {
      place(1.3, -10);
      runJump(-1, 0);
      const trace = []; let arm = true;
      for (let i = 0; i < 120; i++) {
        const press = arm && onFace(); arm = !press;
        tick({ ...(p.wallPlantChain ? {} : toward(-1, 0)), jumpHeld: press });
        trace.push(p.pos.toArray().join(','));
      }
      return trace.join('|');
    };
    assert.equal(record(), record(), 'two identical runs diverged');

    console.log(`PASS wall plant: ${report.join('; ')}.`);
    void velocity;
  } finally { Object.assign(TUNING, saved); }
}, { source: () => source, levelId: 'wall-plant-fixture' });
