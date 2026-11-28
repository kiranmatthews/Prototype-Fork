// Side Platform Lab: the REAL Player and Level play the second side-scrolling test course, one
// station per platforming object that Side Pipe Lab does not carry, and every claim the level
// makes about an object is read off the game's own state rather than assumed.
//
//   node tools/test-side-platform-lab.mjs        (npm run check:side-platform)
//
// What is asserted:
//   · the level data survives the same normaliser an imported level does; it is one east travel
//     zone on one line, with one gate, one stopwatch behind the spawn, and a checkpoint opening
//     every station;
//   · THE VOCABULARY: between them the two labs carry every component type the game has (but for
//     the four named below), every crate kind and every enemy kind, and this lab carries each of
//     the fields that make an object a different object (ice, deep sand, goo, water to swim, water
//     and lava that kill, a wheel, a springboard, a turntable, a lit lift, rope bridges, a rope
//     whose anchor travels, a rail that travels, a door only the air goes through...). A new
//     component type added to the game without a place in a lab fails here by name;
//   · EVERY STATION is crossed from its own checkpoint without a death, and what its object is
//     for was DONE there: the pool swum, the steel arrow's held bounce taken, the TNT's four
//     neighbours gone and every nitro cleared by the green !, both leaves spun down, both rotten
//     boards shaken, four ropes swung on, the wheel ridden under, the springboard's bounce
//     taken, the bull and the bird beaten, orbs fired and the turret beaten, both
//     ropes ground, the pad's 22 m/s reached and the wall of boxes ridden through, the ferrying
//     rail ground, the kickflip opening the gate and the heelflip making the rail real, the
//     spine's back ground, the ball beaten, three panes broken and the board taken away, and in
//     the finale the portal, the door in the air, the cloud, the gem, the bonus stone, the
//     crystal and the gate;
//   · nothing on the course leaves the play plane (|z| stays under 0.6 m);
//   · WHATEVER THE CLOCK SAYS: the stations whose object moves are crossed again with the level's
//     clock run on by other amounts, so that each is met at other points of its round;
//   · THE HAZARDS ARE HAZARDS: a player who only holds right dies at the kicker's gap, the lethal
//     water, a nitro, the second rope swing's pit, the wheel's pit, a pendulum, the rolling stone,
//     the fire, the first thorns and in the turret's corridor; stood on the bull's floor he is
//     run down; and the turret fires at a body in the open of its corridor, but not at one behind
//     the steel, in a hole, or at the next station's checkpoint;
//   · THE WHOLE COURSE, spawn to gate, is finished in one run without a death, visiting the
//     twenty-eight stations in order.
//
// Not in either lab, and why: `pipe` and `outline` are old save formats that load as other
// parts; `worldmap` is the campaign's map table; `comboorb` starts a run that must reach the gate
// in one combo, which a bench of twenty-eight stops cannot honour. Loops are a mesh field, not a
// type: a loop on one line is a planar one, and this lab carries two (its Loops station).
import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
import { makeLabBot } from './side-platform-lab-bot.mjs';

const started = Date.now();
await withSkateRuntime(async ({ server, scene, player: p, level: stock, CONST }) => {
  const lab = await server.ssrLoadModule('/src/levels/side-platform-lab.ts');
  const pipeLab = await server.ssrLoadModule('/src/levels/side-pipe-lab.ts');
  const { Level, findLevel, normalizeCustomLevelData, CUSTOM_COMPONENT_TYPES } = await server.ssrLoadModule('/src/level.ts');
  const { planarLoopEntry } = await server.ssrLoadModule('/src/loopRide.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  stock.dispose();
  const { STATIONS, START, ISLAND, SIDE_PLATFORM_LAB_SPAN: SPAN } = lab;

  // ---- the data contract ----------------------------------------------------
  const entry = findLevel('side-platform-lab');
  assert.ok(entry?.data, 'Side Platform Lab is a registered, data-built level');
  assert.equal(entry.name, 'Side Platform Lab');
  assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(entry.data))), 'the level data passes the import normaliser');
  const parts = entry.data.components;
  const count = (t, test = () => true) => parts.filter(c => c.t === t && test(c)).length;
  assert.equal(count('gate'), 1, 'one finish gate');
  assert.equal(count('clock'), 1, 'one stopwatch');
  assert.ok(parts.find(c => c.t === 'clock').p[0] < entry.data.spawn[0], '...and it waits behind the spawn');
  const zones = parts.filter(c => c.t === 'zone');
  assert.ok(zones.length === 1 && zones[0].dir === 'E' && zones[0].sideOn === true, 'the whole course is one east travel zone, played on one line');
  assert.ok(zones[0].p[0] - zones[0].s[0] / 2 < SPAN.x0 && zones[0].p[0] + zones[0].s[0] / 2 > SPAN.x1, '...which covers all of it');
  const floors = parts.filter(c => c.t === 'platform');
  assert.ok(entry.data.killY < Math.min(...floors.map(c => c.p[1] - c.s[1] / 2)), 'killY sits below every floor');
  assert.equal(count('bonusplatform'), 1, 'one bonus stone (the game allows one)');

  // ---- the stations -----------------------------------------------------------
  // (how many there are is not written here: the list of checks further down, one for each in course order, is the count)
  assert.equal(new Set(STATIONS.map(s => s.id)).size, STATIONS.length, 'each station has its own name');
  assert.equal(STATIONS[0].x0, START.x1, 'the first opens where the arrival floor ends');
  STATIONS.forEach((s, i) => {
    assert.ok(s.x1 > s.x0 + 20, `${s.id}: has room (${s.x1 - s.x0} m)`);
    if (i) assert.ok(STATIONS[i - 1].x1 === s.x0 && STATIONS[i - 1].endTop === s.top, `${s.id}: begins where ${STATIONS[i - 1].id} ends, at its height`);
    assert.ok(Math.abs(s.checkpoints[0][0] - (s.x0 + 2.5)) < 1e-9 && s.checkpoints[0][1] === s.top, `${s.id}: opens on a checkpoint`);
  });
  assert.equal(STATIONS.at(-1).x1, SPAN.x1, 'the last ends the course');
  assert.equal(count('checkpoint'), STATIONS.reduce((n, s) => n + s.checkpoints.length, 0), 'every checkpoint belongs to a station');
  // one line: nothing a body touches is off it but the fire heads, which stand behind the line and breathe across it
  const offLine = parts.filter(c => Math.abs(c.p[2]) > 0.01 && !['wall', 'platform', 'firetiki', 'torch', 'rope', 'decor'].includes(c.t) && !(c.t === 'pendulum' && !c.yaw));
  assert.deepEqual(offLine.map(c => c.nm ?? c.t), [], 'no pickup, crate, enemy or hazard is placed off the play line');

  // ---- the vocabulary -----------------------------------------------------------
  const pipeParts = pipeLab.SIDE_PIPE_LAB_LEVEL.components;
  const NOT_PLACED = { pipe: 'an old save format: it loads as a vertramp', outline: 'an old save format: it loads as a wood crate',
    worldmap: 'the campaign map table', comboorb: 'starts a reach-the-gate-in-one-combo run, which a bench of stops cannot honour' };
  const here = new Set(parts.map(c => c.t)), there = new Set(pipeParts.map(c => c.t));
  for (const type of CUSTOM_COMPONENT_TYPES) {
    if (type in NOT_PLACED) { assert.ok(!here.has(type) && !there.has(type), `${type} is in neither lab (${NOT_PLACED[type]})`); continue; }
    assert.ok(here.has(type) || there.has(type), `the component type "${type}" is in one of the two labs`);
  }
  for (const type of Object.keys(NOT_PLACED)) assert.ok(CUSTOM_COMPONENT_TYPES.has(type), `${type} is still a type the game has`);
  const kindsOf = (list, t, key) => new Set(list.filter(c => c.t === t).map(c => c[key]));
  const crateKinds = new Set([...kindsOf(parts, 'crate', 'kind'), ...kindsOf(pipeParts, 'crate', 'kind')]);
  for (const kind of ['wood', 'bouncy', 'metalbounce', 'metal', 'nitro', 'tnt', 'mask', 'life', 'multihit', 'mystery', 'bang', 'nitrobang', 'empty'])
    assert.ok(crateKinds.has(kind), `the crate kind "${kind}" is in one of the two labs`);
  const foeKinds = new Set([...kindsOf(parts, 'enemy', 'foe'), ...kindsOf(pipeParts, 'enemy', 'foe')]);
  for (const foe of ['grunt', 'spiker', 'turtle', 'charger', 'hopper', 'floater', 'sentry', 'spinner', 'moa'])
    assert.ok(foeKinds.has(foe), `the enemy "${foe}" is in one of the two labs`);
  assert.deepEqual([...kindsOf(parts, 'enemy', 'foe')].sort(), ['charger', 'moa', 'sentry'], 'this lab has the three enemies the other lacks');
  // what makes an object a different object is often a field, not a type: each of these is on this course
  const has = (label, test) => assert.ok(parts.some(test), `this lab carries ${label}`);
  has('a ramp that rises east and one that falls east', c => c.t === 'ramp' && c.yaw === -90);
  has('a ramp that falls east', c => c.t === 'ramp' && c.yaw === 90);
  has('a terrain strip turned east', c => c.t === 'terrain' && c.yaw === -90);
  has('a timber road on its scaffold', c => c.t === 'woodpath' && c.scaffold === true);
  has('boulders', c => c.t === 'rock');
  has('a log', c => c.t === 'decor' && c.dkind === 'log');
  has('a statue', c => c.t === 'decor' && c.dkind === 'idol');
  has('a wall path', c => c.t === 'wallpath');
  has('a coast wall', c => c.t === 'coastwall');
  has('ice', c => c.t === 'platform' && c.slip === true && c.iceGrip !== undefined);
  has('an ice chute that carries you down', c => c.t === 'ramp' && c.slip === true && c.slipGravity !== undefined);
  has('deep sand', c => c.groundSpeedLimit !== undefined && c.tex !== 'goo');
  has('a sticky floor', c => c.groundSpeedLimit !== undefined && c.tex === 'goo');
  has('water to swim in', c => c.t === 'mesh' && c.materialStyle === 'water' && c.swimDepth !== undefined && c.solid === false && !c.lethal);
  has('water that kills', c => c.t === 'mesh' && c.materialStyle === 'water' && c.lethal === true && c.solid === false);
  has('lava', c => c.t === 'mesh' && c.lethal === true && c.solid === true);
  has('a steel block that is not a crate', c => c.t === 'metal');
  assert.equal(parts.filter(c => c.t === 'mesh' && c.loopRadius > 0 && c.loopOffset === 0).length, 2, 'this lab carries two planar loops');
  has('a spin bridge that stays down', c => c.t === 'spinbridge' && c.hold === undefined);
  has('a spin bridge that folds again', c => c.t === 'spinbridge' && c.hold > 0);
  has('rope-bridge boards', c => c.t === 'platform' && c.bridgeSpan);
  has('rotten rope-bridge boards', c => c.t === 'crumble' && c.bridgeSpan);
  has('rope-bridge hand ropes', c => c.t === 'rope' && c.bridgeSpan);
  has('rope-bridge bearer ropes', c => c.t === 'decor' && c.dkind === 'braidedrope' && c.bridgeSpan);
  has('a rope to grind that is no part of a bridge', c => c.t === 'rope' && !c.bridgeSpan);
  has('rope swings', c => c.t === 'ropeswing' && !c.range);
  has('a rope swing whose anchor travels', c => c.t === 'ropeswing' && c.range > 0);
  has('decks on an orbit', c => c.t === 'mover' && c.orbit);
  has('a deck that bounces', c => c.t === 'mover' && c.bounce > 0);
  has('a deck that turns', c => c.t === 'mover' && c.spin);
  has('a lift with a fire on it', c => c.t === 'mover' && c.lit === true && c.axis === 'y');
  has('pendulums swinging across the line', c => c.t === 'pendulum' && c.yaw === 90);
  has('a pendulum swinging along it', c => c.t === 'pendulum' && !c.yaw);
  has('a stone that rolls along the line', c => c.t === 'stone' && c.axis === 'x');
  has('a stone that rolls across it', c => c.t === 'stone' && c.axis === 'z');
  has('fire heads', c => c.t === 'firetiki');
  has('a fire head that turns', c => c.t === 'firetiki' && c.amp > 0);
  has('torches', c => c.t === 'torch');
  has('thorns', c => c.t === 'thorn');
  has('a plane that takes the board away', c => c.t === 'tumblezone' && c.checkpointTrip === true);
  has('a speed pad', c => c.t === 'speedpad');
  has('a rail that travels', c => c.t === 'rail' && c.amp > 0 && c.axis === 'x');
  has('a trick gate', c => c.t === 'trickgate');
  has('a trick rail', c => c.t === 'trickrail');
  has('a grindosaurus', c => c.t === 'grindosaurus');
  has('an angry ball in a side-on pipe', c => c.t === 'angryball');
  has('glass', c => c.t === 'mesh' && c.breakable === 'glass');
  has('a breakable sign', c => c.t === 'mesh' && c.breakable === 'sign');
  has('a portal', c => c.t === 'returnportal' && !c.airOnly);
  has('a door only the air goes through', c => c.t === 'returnportal' && c.airOnly === true);
  has('a cloud', c => c.t === 'platform' && c.cloudRoad === true);
  has('a coloured gem', c => c.t === 'colouredgem');
  has('the crystal', c => c.t === 'crystal');
  assert.ok(parts.filter(c => c.t === 'ramp' && c.yaw === 90).length >= 2 && count('ropeswing') === 4 && count('pendulum') === 5 && count('firetiki') === 3
    && count('mover') === 5 && count('spinbridge') === 2 && count('returnportal') === 3, 'the counts the stations are written for');

  // ---- the course, built --------------------------------------------------------
  const level = new Level(scene, entry);
  scene.updateMatrixWorld(true);
  p.competitionMode = false; p.endlessDeaths = true;
  assert.ok(level.allowsBonus && level.bonusPlatformDiagnostics, 'the bonus stone is built');
  assert.deepEqual([level.ropeSwings.length, level.pendulums.length, level.stones.length, level.fireTikis.length, level.spinBridges.length, level.movers.length,
    level.movingRails.length, level.trickGates.length, level.trickRails.length, level.grindosauri.length, level.angryBalls.length, level.returnPortals.length,
    level.halfpipes.length, level.enemies.length, level.breakableScenery.objects.length, level.colouredGemPickups.length, level.crumbles.length],
    [4, 5, 2, 3, 2, 5, 1, 1, 1, 1, 1, 3, 1, 3, 3, 1, 2], 'every object the stations are written for is built');
  assert.equal(level.checkpoints.length, count('checkpoint'), 'every checkpoint is built');
  assert.ok(level.chainGrabs.length === level.pendulums.length && level.chainGrabs.every(chain => !level.ropeSwings.includes(chain)),
    'every pendulum\'s chain can be held, and none of them is counted as a rope swing');
  assert.ok(level.ropeBridges.spans.length === 4 && level.ropeBridges.diagnostics.decks === 10, 'two rope bridges are hung, ten boards between them, and the two free ropes are spans of their own');
  const bot = makeLabBot({ p, level, lab, CONST, makeInput });
  const S = bot.S;
  const told = log => `reached ${log.reached.toFixed(1)} of ${log.goal.toFixed(1)} in ${log.seconds} s` +
    `${log.died.length ? '; died ' + log.died.map(d => `${d.station} x${d.x} y${d.y} t${d.t}`).join(', ') : ''}; ${JSON.stringify(log.facts)}`;

  // (what the two rings ask for at their feet: loopRide.ts finds them by riding the centreline)
  const loopForces = { gravity: TUNING.groundGravity, pump: TUNING.pipePumpGain + TUNING.chargeBoost, friction: TUNING.pipeFriction, drag: TUNING.windDrag, braking: TUNING.turnaround };
  const RINGS = { small: planarLoopEntry(4, loopForces), big: planarLoopEntry(6, loopForces) };
  assert.ok(level.loopMeshes.length === 2 && level.loopMeshes.every(mesh => mesh.userData.planarLoop && !level.groundMeshes.includes(mesh)),
    'both rings are built as planar loops: ridden by their centrelines, and no floor to anything else');

  // ---- every station, from its own checkpoint ---------------------------------------
  /** What each station's object is for, and that it was done. */
  const DONE = {
    ramps: () => {}, terrain: () => {}, timber: () => {}, rocks: () => {}, ice: () => {},
    sticky: log => { assert.ok(log.seconds > 11, `the goo holds him to a trudge (${log.seconds} s for 40 m, 15 of them goo)`);
      assert.ok(log.facts.gooPace <= 1.45, `...at its pace (${log.facts.gooPace} m/s)`);
      assert.ok(log.facts.stickySteps > 300, `he walks it with the walk that peels each shoe off it (${log.facts.stickySteps} steps of play)`);
      assert.ok(log.facts.strands >= 12, `and every shoe that leaves it draws a strand that lets go (${log.facts.strands})`); },
    water: (log, e) => assert.equal(e.swims, 1, 'the pool is swum'),
    arrows: (log, e) => { assert.ok(log.facts.steelArrowLaunch >= 19.5, `the steel arrow's HELD bounce is taken (${log.facts.steelArrowLaunch} m/s)`); assert.ok(e.boxes >= 5, 'the boxes on the way are broken'); },
    explosives: log => { assert.equal(log.facts.tntCleared, 5, 'the TNT takes its four neighbours with it'); assert.equal(log.facts.nitrosLeft, 0, 'the green ! clears every nitro'); },
    spinbridge: log => assert.ok(log.facts.leaf1Down && log.facts.leaf2Down, 'both leaves are spun down'),
    ropebridge: log => { assert.equal(log.facts.rottenShaken, 2, 'both rotten boards are set shaking');
      assert.ok(log.facts.sag1 > 0.3 && log.facts.sag2 > 0.3, `both decks give under a runner (${log.facts.sag1} and ${log.facts.sag2} m)`); },
    trampoline: log => { assert.equal(log.facts.nets, 2, 'both trampolines are rope nets');
      assert.ok(log.facts.sag > 0.25, `the first net gives under a body stood on it (${log.facts.sag} m)`);
      const bounces = String(log.facts.bounces ?? '').split(',').map(Number);
      assert.ok(Math.abs(bounces[0] - 16) < 0.6, `hopped on, it throws him at its plain speed (${bounces[0]} m/s)`);
      assert.ok(bounces.some(v => Math.abs(v - 20) < 0.8) && log.facts.shelf, `Jump held at the landing is the high bounce, and it reaches the shelf (${log.facts.bounces} m/s)`); },
    swings: (log, e) => assert.equal(e.swings, 4, 'four ropes are swung on'),
    decks: log => { assert.ok(log.facts.wheelDip <= -3, `the wheel is ridden under (${log.facts.wheelDip} m)`); assert.ok(log.facts.springboardLaunch >= 15.5, `the springboard's bounce is taken (${log.facts.springboardLaunch} m/s)`); },
    pendulums: (log, e) => { assert.ok(log.facts.underLongPendulum, 'the pendulum that swings along the line is run under while it is up');
      // (its chain is caught from a running jump off the ledge, over the ball; climbed down as far as it lets him and up
      // to its top; the fruit hung over it is taken; and it is leapt off)
      assert.ok(log.facts.chainHeld === true && e.swings === 1, 'the first pendulum\'s chain is caught from the ledge, and it is a chain and not a rope');
      assert.ok(log.facts.chainLowest > 2.6 && log.facts.chainLowest < 2.75, `it lets him down to its lowest hold and no lower (${log.facts.chainLowest} m down a 6 m chain: 3.3 m over the ball)`);
      assert.ok(log.facts.chainClimbed >= 1.5, `it is climbed from its lowest hold to its top (${log.facts.chainClimbed} m)`);
      assert.equal(log.facts.chainFruit, 3, 'the fruit hung over it is taken from the chain');
      assert.ok(log.maxZ < 0.05, `holding a chain that swings across the line, he stays on the line (${log.maxZ} m off it)`); },
    stones: () => {}, fire: () => {},
    thorns: log => assert.equal(log.bails, 0, 'the three patches are jumped without a fall'),
    bull: (log, e) => assert.equal(e.foes, 1, 'the bull is beaten'),
    turret: (log, e) => { assert.ok(log.facts.orbsFired >= 1, 'the turret fires'); assert.ok(log.facts.orbsDucked >= 1, 'an orb is let pass over a hole'); assert.ok(log.facts.sentryDown && e.foes === 1, 'the turret is beaten'); },
    bird: (log, e) => assert.equal(e.foes, 1, 'the bird is beaten'),
    rope: (log, e) => assert.equal(e.grinds, 2, 'both ropes are ground'),
    speed: (log, e) => { assert.ok(log.facts.padSpeed >= 20, `the pad gives its speed (${log.facts.padSpeed} m/s)`); assert.equal(e.boxes, 4, 'the wall of boxes is ridden through'); },
    loop: log => { assert.equal(log.facts.rings, 2, 'both rings are ridden round');
      assert.ok(log.facts.ring1In >= RINGS.small.coasting + 1 && log.facts.ring1Top > 7.9, `its pad carries him round the first with nothing held (in at ${log.facts.ring1In} m/s, ${log.facts.ring1Top} m up)`);
      assert.ok(log.facts.ring2In >= RINGS.big.pumped + 1.5 && log.facts.ring2In < RINGS.big.coasting && log.facts.ring2Top > 11.9,
        `the accelerator and the way down carry him round the second, which nothing but the pump would (in at ${log.facts.ring2In} m/s, ${log.facts.ring2Top} m up)`);
      assert.equal(log.bails, 0, 'without a fall'); },
    ferry: (log, e) => assert.equal(e.grinds, 1, 'the travelling rail is ground'),
    tricks: (log, e) => { assert.ok(log.facts.gateOpen, 'the kickflip opens the gate'); assert.ok(log.facts.railReal && e.grinds === 1, 'the heelflip makes the rail real, and it is ground'); assert.equal(log.bails, 0, 'without a fall'); },
    spine: (log, e) => assert.ok(log.facts.spineBeaten && e.grinds === 1, "the spine's back is ground and it is beaten"),
    ball: log => assert.ok(log.facts.ballDown, 'the ball is beaten'),
    glass: log => { assert.equal(log.facts.panesBroken, 3, 'three panes are broken'); assert.equal(log.facts.boardTrips, 1, 'the plane takes his board'); },
    finale: (log, e) => { assert.equal(e.doors, 3, 'the portal, the door in the air and the portal back are gone through');
      assert.ok(log.facts.cloud && log.facts.gem && log.facts.bonusStone && log.facts.crystal && log.finished, 'the cloud, the gem, the bonus stone, the crystal and the gate'); },
  };
  assert.deepEqual(Object.keys(DONE), STATIONS.map(s => s.id), 'a check for every station, in course order');
  const alone = {};
  for (const s of STATIONS) {
    const log = bot.play({ station: s.id });
    assert.ok(log.ok, `${s.id}: crossed from its checkpoint (${told(log)})`);
    assert.ok(log.maxZ < 0.6, `${s.id}: on the play line throughout (|z| ${log.maxZ.toFixed(2)})`);
    DONE[s.id](log, log.evidence[s.id] ?? {});
    alone[s.id] = log;
  }
  console.log(`  ${STATIONS.length} stations crossed from their own checkpoints (${Object.values(alone).reduce((n, log) => n + log.seconds, 0).toFixed(0)} s of play)`);
  // the finale's plain way: past both arrows and under the ledge, to the gate
  const plain = bot.play({ station: 'finale', plain: true });
  assert.ok(plain.ok && plain.finished && !plain.facts.cloud && !plain.facts.bonusStone && plain.evidence.finale.doors === 1,
    `the finale's plain way goes past both arrows, under the ledge, to the gate (${told(plain)})`);

  // ---- whatever the clock says ---------------------------------------------------------
  for (const [id, warms] of [['swings', [1.3, 2.9, 7]], ['decks', [2.3, 4.7]], ['pendulums', [1.7, 2.6]], ['stones', [3.4]], ['fire', [3.4]], ['turret', [3.4]],
    ['bird', [5.1]], ['ferry', [1.7, 5.1]], ['spine', [5.1]], ['bull', [3.4]]]) {
    for (const warm of warms) {
      const log = bot.play({ station: id, warm });
      assert.ok(log.ok, `${id}: crossed with the clock run on ${warm} s (${told(log)})`);
      DONE[id](log, log.evidence[id] ?? {});
    }
  }
  console.log('  the stations that move are crossed at other points of their rounds');

  // ---- the hazards are hazards -----------------------------------------------------------
  const within = (d, s, from, to) => d.station === s.id && d.x >= from - 1 && d.x <= to + 1;
  const naive = (id, why, from, to) => {
    const log = bot.play({ station: id, naive: true, seconds: 40 });
    assert.ok(log.died.length === 1 && within(log.died[0], S[id], from, to), `${id}: a player who only holds right dies at ${why} (${told(log)})`);
  };
  naive('ramps', "the gap off the kicker (a walker is not thrown by a ramp: it is jumped)", S.ramps.marks.kicker, S.ramps.marks.landing);
  naive('water', 'the water that kills', S.water.marks.lethal, S.water.marks.lethalEnd);
  naive('explosives', 'a nitro', S.explosives.marks.nitro - 1.5, S.explosives.marks.nitro2 + 1.5);
  naive('trampoline', 'the pit before the second net', S.trampoline.marks.brink, S.trampoline.marks.net2);
  naive('swings', "the second swing's pit", S.swings.marks.brink2, S.swings.marks.far2);
  naive('decks', "the wheel's pit", S.decks.x0 + 10, S.decks.x0 + 24);
  naive('pendulums', 'a pendulum', S.pendulums.marks.first - 2, S.pendulums.marks.along + 6);
  naive('stones', 'the rolling stone', S.stones.marks.along - 10, S.stones.marks.along + 10);
  naive('fire', 'a breath or the lava', S.fire.marks.head - 3, S.fire.marks.lavaEnd);
  naive('thorns', 'the first thorns', S.thorns.marks.thorn1 - 1, S.thorns.marks.thorn1 + 1);
  naive('turret', 'an orb, in its corridor', S.turret.marks.cover, S.turret.marks.sentry);
  // the turret sees the far end of its own corridor, and not the next station's checkpoint
  {
    const idle = makeInput(), sentry = level.enemies.find(e => e.kind === 'sentry');
    const stand = (x, y, seconds) => {
      level.reset(true); level.time = 0;
      p.respawn(level, true, false, { position: p.pos.clone().set(x, y + 0.15, 0), heading: p.pos.clone().set(1, 0, 0) });
      let fired = 0, died = false;
      for (let i = 0; i < seconds * 60 && !died; i++) { bot.tick(idle); fired = Math.max(fired, level.projectiles.length); died = p.state === 'dead'; }
      return { fired, died };
    };
    const open = stand(S.turret.marks.cover + 3, S.turret.top, 6);
    assert.ok(open.fired >= 1 && open.died, 'stood in the open of its corridor, 22 m off, he is fired at and hit');
    const hidden = stand(S.turret.marks.cover - 2, S.turret.top, 6);
    assert.ok(hidden.fired === 0 && !hidden.died, 'stood behind the steel, he is not fired at');
    const holed = stand(S.turret.marks.hole1End - 1, S.turret.top - 1.6, 6);
    assert.ok(holed.fired === 0 && !holed.died, 'stood in a hole, against the wall nearest it, he is not fired at');
    const next = stand(S.bird.checkpoints[0][0] + 1.3, S.bird.top, 6);
    assert.ok(sentry.alive && next.fired === 0 && !next.died, "stood at the next station's checkpoint, behind the turret, he is not fired at");
    // (the bull is harmless while it stands dizzy, so a runner may pass it by luck: stood on its floor, he is run down)
    const under = stand(S.pendulums.marks.along, S.pendulums.top, 6);
    assert.ok(under.died, 'stood under the pendulum that swings along the line, he is struck');
    const penned = stand(S.bull.marks.pen + 5, S.bull.top, 10);
    assert.ok(penned.died, "stood on the bull's floor, he is run down");
    const watching = stand(S.bull.marks.pen - 3, S.bull.top, 10);
    assert.ok(!watching.died, '...and stood off it, he is left alone');
  }
  console.log('  hazards kill a player who only holds right; the turret sees its corridor and no further');

  // ---- the spin bridges, met badly ------------------------------------------------------------
  {
    const M = S.spinbridge.marks, top = S.spinbridge.top, east = p.pos.clone().set(1, 0, 0);
    const leafAt = x => level.spinBridges.reduce((b, o) => Math.abs(o.pivot.position.x - x) < Math.abs(b.pivot.position.x - x) ? o : b);
    const first = leafAt(M.hinge1), timed = leafAt(M.hinge2), fromBank = b => b.hitBox.clone().translate(p.pos.clone().set(-0.3, 0, 0));
    const put = x => {
      level.reset(true); level.time = 0;
      p.respawn(level, true, false, { position: p.pos.clone().set(x, top + 0.15, 0), heading: east });
      for (let i = 0; i < 20; i++) bot.tick(makeInput());
    };
    const pad = () => { const was = { jump: false, spin: false }; return (moveX, jump = false, spin = false) => {
      const input = makeInput({ moveX });
      input.jumpHeld = jump; input.jumpPressed = jump && !was.jump; input.jumpReleased = !jump && was.jump;
      input.spinHeld = spin; input.spinPressed = spin && !was.spin;
      was.jump = jump; was.spin = spin;
      bot.tick(input);
    }; };
    // A running spin: he never lets go of the stick, and the leaf is still falling when he is at the hinge.
    for (const short of [0.9, 1.6, 2.6]) {
      put(M.hinge1 - 9);
      const press = pad();
      let spun = false, held = 0;
      for (let k = 0; k < 360 && p.state !== 'dead' && p.pos.x < M.far1 + 2; k++) {
        const spin = !spun && p.pos.x > M.hinge1 - short;
        if (spin) spun = true;
        if (first.state === 'opening' && p.pos.x > M.hinge1 - 0.8) held++;
        press(1, false, spin);
      }
      assert.ok(p.state !== 'dead' && p.pos.x >= M.far1 && first.state === 'open',
        `a running spin begun ${short} m short of the leaf is carried over it and not dropped under it (x ${(p.pos.x - M.hinge1).toFixed(1)} past the hinge, ${p.state})`);
      assert.ok(held > 0, 'he is held at the hinge while the leaf falls');
    }
    // ...and the same on the board: held at the brink, not smacked or tripped, and across with his speed.
    for (const short of [1.0, 2.8]) {
      put(M.hinge1 - 11);
      const press = pad();
      let spun = false, slowest = Infinity, fell = false;
      for (let k = 0; k < 420 && p.state !== 'dead' && p.pos.x < M.far1 + 2; k++) {
        const spin = !spun && p.freeSkate && p.pos.x > M.hinge1 - short;
        if (spin) spun = true;
        press(1, !p.freeSkate && p.grounded && !spun, spin);
        if (spun) slowest = Math.min(slowest, Math.abs(p.speed));
        fell ||= p.isBailing;
      }
      assert.ok(p.state !== 'dead' && p.pos.x >= M.far1 && p.freeSkate && !fell && slowest > 9,
        `a riding spin begun ${short} m short crosses on the board without a fall (x ${(p.pos.x - M.hinge1).toFixed(1)}, ${p.state}, slowest ${slowest.toFixed(1)} m/s)`);
    }
    // Stood on the timed leaf as it is let go: thrown up and back over the hinge, and down on the bank.
    const thrown = (how, ride) => {
      let left = null, apex = 0, down = null, behind = Infinity;
      for (let k = 0; k < 900 && p.state !== 'dead' && down === null; k++) {
        const grounded = p.grounded;
        ride(k);
        if (left === null && grounded && !p.grounded && timed.state === 'closing') left = { out: p.pos.x - M.hinge2, board: p.freeSkate, k };
        if (left === null) continue;
        const out = p.pos.x - M.hinge2, up = p.pos.y - top;
        apex = Math.max(apex, up);
        if (!p.grounded && out > 0 && out < timed.span) behind = Math.min(behind, Math.atan2(Math.max(0, up), out) - timed.leaf.rotation.z);
        if (p.grounded && k > left.k + 3) down = { out, board: p.freeSkate, bail: p.isBailing };
      }
      assert.ok(left, `${how}: he is thrown as the leaf is let go`);
      assert.ok(p.state !== 'dead' && down && !down.bail, `${how}: he comes down alive and on his feet`);
      assert.ok(down.out < -1.5 && down.out > -5, `${how}: on the bank behind the hinge (${down.out.toFixed(1)} m)`);
      assert.ok(apex > 2.2 && behind > -0.01, `${how}: over the leaf, which comes up behind him and not through him (apex ${apex.toFixed(1)} m, leaf ${(behind * 57.3).toFixed(0)} deg behind at its nearest)`);
      // ...and the throw's carry is spent there: a second and a half on, hands off, he is still on that bank
      for (let k = 0; k < 90 && p.state !== 'dead'; k++) bot.tick(makeInput());
      const after = { out: p.pos.x - M.hinge2, board: p.freeSkate, speed: Math.abs(p.speed) };
      assert.ok(p.state !== 'dead' && p.grounded && after.board === down.board && after.out < -1.5 && after.out > -12 && after.speed <= (after.board ? 6.5 : 0.5),
        `${how}: he stays on the bank he was thrown to (${after.out.toFixed(1)} m, ${after.board ? 'rolling' : 'stood'} at ${after.speed.toFixed(1)} m/s)`);
      return { left, down, apex };
    };
    const apexes = [];
    for (const out of [1, 5, 9.3]) {
      put(M.hinge2 - 1.6);
      assert.ok(timed.trigger(fromBank(timed)));
      const press = pad();
      const walk = () => press(timed.state !== 'open' ? 0 : p.pos.x < M.hinge2 + out - 0.15 ? 0.8 : p.pos.x > M.hinge2 + out + 0.4 ? -0.5 : 0);
      const flight = thrown(`stood ${out} m out on the timed leaf`, walk);
      assert.ok(!flight.left.board && !flight.down.board, 'on foot he is thrown and lands on foot');
      apexes.push(flight.apex);
    }
    assert.ok(apexes[0] < apexes[1] && apexes[1] < apexes[2], `the further out he stood, the higher he is thrown (${apexes.map(a => a.toFixed(1)).join(', ')} m)`);
    // ...and on the board: ridden onto so that it is let go under him, he is thrown the same way and keeps the board.
    for (const wait of [2.2, 2.5]) {
      put(M.hinge2 - 10);
      assert.ok(first.trigger(fromBank(first)) && timed.trigger(fromBank(timed)));
      const press = pad();
      const ride = k => { const go = k / 60 > wait && timed.state !== 'closing'; press(go ? 1 : 0, go && !p.freeSkate && p.grounded); };
      const flight = thrown(`riding the timed leaf (set off after ${wait} s)`, ride);
      assert.ok(flight.left.board && flight.down.board, 'on the board he is thrown and lands on the board');
    }
    // Late for it: a body that reaches the hinge while the leaf is on its way up is stopped there.
    put(M.hinge2 - 6);
    assert.ok(timed.trigger(fromBank(timed)));
    const press = pad();
    let most = -Infinity;
    for (let k = 0; k < 600 && p.state !== 'dead' && timed.state !== 'closed'; k++) { press(timed.state === 'closing' || timed.remaining < 0.45 && timed.state === 'open' ? 1 : 0); most = Math.max(most, p.pos.x - M.hinge2); }
    for (let k = 0; k < 60 && p.state !== 'dead'; k++) press(1);
    assert.ok(p.state !== 'dead' && p.grounded && p.pos.x < M.hinge2, `walking at the leaf as it folds, he is stopped at the hinge and not let into the pit (got to ${most.toFixed(2)} m)`);
  }
  console.log('  spin bridges: a running spin crosses, on foot and on the board; the timed leaf throws what is on it back to its bank');

  // ---- ice and goo under a board ---------------------------------------------------------------
  {
    const east = p.pos.clone().set(1, 0, 0), up = p.pos.clone(), q = p.group.quaternion.clone();
    const ride = (x, top, until, each) => {
      level.reset(true); level.time = 0;
      p.respawn(level, true, false, { position: p.pos.clone().set(x, top + 0.15, 0), heading: east });
      for (let i = 0; i < 20; i++) bot.tick(makeInput());
      let was = false, fell = false;
      for (let k = 0; k < 900 && p.state !== 'dead' && !until(); k++) {
        const jump = !p.freeSkate && p.grounded, input = makeInput({ moveX: 1 });
        input.jumpHeld = jump; input.jumpPressed = jump && !was; input.jumpReleased = !jump && was; was = jump;
        bot.tick(input);
        fell ||= p.isBailing;
        each();
      }
      return { fell, dead: p.state === 'dead' };
    };
    // The ice chute falls 2 m in 8: a board on it lies on it. (It used to stand level, 14 degrees off the ice.)
    const I = S.ice.marks, offSlope = [];
    const chute = ride(I.chute - 5.5, S.ice.top, () => p.pos.x > I.chute + 7.8, () => {
      if (!p.freeSkate || !p.grounded || !p.groundHit?.slippy || p.pos.x < I.chute + 2 || p.groundHit.normal.y > 0.999) return;
      p.boardG.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q);
      offSlope.push(Math.acos(Math.min(1, Math.abs(up.dot(p.groundHit.normal)))) * 180 / Math.PI);
    });
    assert.ok(!chute.fell && !chute.dead && offSlope.length > 10, `the chute is ridden on the board (${offSlope.length} steps on its slope)`);
    assert.ok(Math.max(...offSlope) < 2, `...with the deck lying on the ice (never more than ${Math.max(...offSlope).toFixed(1)} degrees off it)`);
    // Goo holds a board to its pace too, sticking and slipping, and its trucks draw strands after them.
    const G = S.sticky.marks, before = p.gooDiagnostics.snapped, paces = [];
    let held = 0, drawn = 0;
    const goo = ride(G.from - 7.5, S.sticky.top, () => p.pos.x > G.to - 0.5, () => {
      if (!p.freeSkate || !p.grounded || !p.groundHit?.sticky || p.pos.x < G.from + 2) return;
      paces.push(Math.abs(p.speed)); held = Math.min(held, p.gooDiagnostics.lag); drawn = Math.max(drawn, p.gooDiagnostics.drawn);
    });
    assert.ok(!goo.fell && !goo.dead && paces.length > 100, `the goo is ridden on the board (${paces.length} steps on it)`);
    assert.ok(Math.max(...paces) <= 1.45, `...at its pace (${Math.max(...paces).toFixed(2)} m/s)`);
    assert.ok(held < -0.02 && held > -0.08, `...sticking and slipping (drawn back ${(-held * 100).toFixed(1)} cm at the most)`);
    assert.ok(drawn >= 3 && p.gooDiagnostics.snapped - before >= 6, `...and drawing strands that let go (${p.gooDiagnostics.snapped - before})`);
  }
  console.log('  a board lies on the ice chute; goo holds a board to its pace, sticking and slipping');

  // ---- the loops, met otherwise -------------------------------------------------------------
  {
    const L = S.loop, M = L.marks, east = p.pos.clone().set(1, 0, 0);
    const drive = (from, controller, seconds = 30) => {
      level.reset(true); level.time = 0;
      p.respawn(level, true, false, { position: p.pos.clone().set(from[0], from[1] + 0.15, 0), heading: east });
      for (let i = 0; i < 20; i++) bot.tick(makeInput());
      const seen = { bails: 0, fellFrom: null, taken: [] };
      let jumped = false, bailing = false, active = false;
      for (let k = 0; k < seconds * 60 && p.state !== 'dead' && p.pos.x < L.x1 - 1; k++) {
        const want = controller(), input = makeInput({ moveX: want.moveX ?? 1 });
        input.jumpHeld = !!want.jump; input.jumpPressed = !!want.jump && !jumped; input.jumpReleased = !want.jump && jumped; jumped = !!want.jump;
        const before = p.loopStatus;
        bot.tick(input);
        const now = p.loopStatus;
        if (now.active && !active) seen.taken.push(+p.speed.toFixed(1));
        if (!now.active && active && now.completed === before.completed) seen.fellFrom = +(p.pos.y - L.endTop).toFixed(1);
        if (p.isBailing && !bailing) seen.bails++;
        active = now.active; bailing = p.isBailing;
      }
      return seen;
    };
    const mounting = () => !p.freeSkate && p.grounded;
    // on foot: a player who only holds right walks the whole station, under both rings
    const walked = bot.play({ station: 'loop', naive: true, seconds: 40 });
    assert.ok(walked.ok && p.loopStatus.completed === 0 && walked.bails === 0, `loop: a player who only holds right walks under both rings (${told(walked)})`);
    // on the board with nothing held: the pad carries him round the first; the second is not his, and he rolls under it
    const coasted = drive(L.checkpoints[0], () => ({ jump: mounting() }));
    assert.ok(p.state !== 'dead' && p.pos.x >= L.x1 - 1 && p.loopStatus.completed === 1 && coasted.taken.length === 1 && coasted.bails === 0,
      `loop: a rider with nothing held is carried round the first ring by its pad and rolls under the second (taken on at ${coasted.taken} m/s, ${p.loopStatus.completed} round)`);
    // from a standstill at the second checkpoint, the accelerator is enough for the second
    const fresh = bot.play({ station: 'loop', from: [L.checkpoints[1][0] + 1.3, L.checkpoints[1][1] + 0.15] });
    assert.ok(fresh.ok && fresh.facts.rings === 1 && fresh.facts.ring2In >= RINGS.big.pumped + 1 && fresh.bails === 0,
      `loop: from a standstill at its checkpoint, the accelerator and the way down are enough for the second ring (${told(fresh)})`);
    // let go at its foot, he comes off it past the upright and falls inside it: a fall he gets up from
    let onIt = false;
    const dropped = drive(L.checkpoints[1], () => { onIt ||= p.loopStatus.active; return { jump: !onIt }; }, 26);
    assert.ok(dropped.taken.length === 1 && dropped.bails === 1 && dropped.fellFrom > 6 && p.state !== 'dead' && p.loopStatus.completed === 0,
      `loop: the accelerator let go at the second ring's foot is a fall from inside it, and not a death (fell from ${dropped.fellFrom} m, ${p.state})`);
  }
  console.log('  loops: walked under; the pad carries a rider round the first; the second wants the accelerator, from a standstill too, and drops a rider who lets go');

  // ---- the whole course ------------------------------------------------------------------
  const course = bot.play();
  assert.ok(course.finished && course.died.length === 0, `the whole course is finished in one run without a death (${told(course)})`);
  assert.deepEqual([...course.visited.keys()], STATIONS.map(s => s.id), 'the stations are visited in order');
  assert.ok(course.maxZ < 0.6, `the whole course is played on one line (|z| ${course.maxZ.toFixed(2)})`);
  assert.equal(course.bails, 1, 'he falls once on the way, at the plane that takes the board');
  for (const s of STATIONS) DONE[s.id]({ ...course, seconds: course.visited.get(s.id).t1 === null ? course.seconds - course.visited.get(s.id).t0 : course.visited.get(s.id).t1 - course.visited.get(s.id).t0,
    bails: alone[s.id].bails }, course.evidence[s.id] ?? {});
  assert.ok(Math.abs(ISLAND.top - S.finale.top - 14) < 1e-9, 'the cloud is 14 m over the finale');

  level.dispose();
  console.log(`PASS Side Platform Lab: ${(SPAN.x1 - SPAN.x0).toFixed(0)} m, ${STATIONS.length} stations, finished in ${course.seconds.toFixed(1)} s of play without a death ` +
    `(his one fall is the plane that takes the board); every object used as its station intends; checked in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}, { animationScheme: 'D' });
