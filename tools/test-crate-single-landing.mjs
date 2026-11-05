import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

// Four touching lids deliberately share seams and a common corner. Use the
// published dimensions and revision, rather than depending on legacy migration.
const size = 1.152;
const centers = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => [x * size / 2, z * size / 2]);
const cluster = (x, z, kinds, y = 0) => centers.map(([dx, dz], i) =>
  ({ t: 'crate', p: [x + dx, y, z + dz], kind: kinds[i] ?? kinds[0] }));
const data = {
  v: 1, name: 'One crate per landing', crateLayoutRevision: 1,
  spawn: [8, .02, 8], killY: -20, groups: [],
  components: [
    { t: 'platform', p: [0, -.5, 0], s: [30, 1, 30] },
    ...cluster(0, 0, ['wood']),
    ...cluster(5, 0, ['multihit']),
    ...cluster(-5, 0, ['wood']), ...cluster(-5, 0, ['wood'], size),
    ...cluster(0, 5, ['wood', 'tnt', 'metalbounce', 'metal']),
    ...cluster(0, -5, ['bouncy']),
    ...cluster(5, 5, ['bang']),
    ...cluster(-5, -5, ['tnt']),
    { t: 'gate', p: [10, 0, -10] },
  ],
};

await withSkateRuntime(async ({ THREE, server, player, level, CONST, TUNING }) => {
  const { CRATE_SIZE } = await server.ssrLoadModule('/src/crateDimensions.ts');
  assert.equal(CRATE_SIZE, size, 'crate dimensions changed to disguise the landing bug');
  assert.ok(CONST.playerHalf.x * 2 <= CRATE_SIZE && CONST.playerHalf.z * 2 <= CRATE_SIZE,
    'ordinary body footprint must fit on one crate');
  const allCrates = [...level.crates], crates = allCrates.slice(0, 4);
  let arrowBounces = 0;
  const bounceCrateArt = level.bounceCrateArt.bind(level);
  level.bounceCrateArt = (...args) => { arrowBounces++; return bounceCrateArt(...args); };
  const centerKey = c => [c.mesh.position.x, c.mesh.position.z].map(n => n.toFixed(3)).join(',');
  const broken = () => crates.filter(c => !c.alive);
  const reset = (reverse = false) => {
    level.reset(true);
    player.respawn(level, true);
    player.endlessDeaths = true;
    player.competitionMode = false;
    player.rawInput = makeInput();
    player.freeSkate = player.airFromSkate = false;
    player.speed = 0;
    player.walkVelocity.set(0, 0, 0);
    player.uberTimer = player.invulnTimer = player.spinTimer = 0;
    player.slamActive = false;
    arrowBounces = 0;
    level.crates.splice(0, level.crates.length, ...(reverse ? [...allCrates].reverse() : allCrates));
  };
  const drop = (x, z, { prevX = x, prevZ = z, above = .1, below = .06, speed = -10, spin = false,
    top = crates[0].box.max.y } = {}) => {
    player.state = 'air'; player.grounded = false;
    player.pos.set(x, top - below, z);
    player.prevPos.set(prevX, top + above, prevZ);
    player.vVel = speed;
    player.spinTimer = spin ? .2 : 0;
    player.refreshCharacterBounds();
    player.collide(level);
  };
  let checks = 0;
  for (const [x, z] of [...centers, [-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2],
    [0, 0], [0, -size / 2], [0, size / 2], [-size / 2, 0], [size / 2, 0]]) {
    let selected;
    for (const reverse of [false, true]) {
      reset(reverse);
      drop(x, z);
      assert.equal(broken().length, 1, `landing at ${x},${z} broke more than one crate`);
      assert.equal(player.vVel, TUNING.crateBounce, 'normal landing lost its bounce');
      const actual = centerKey(broken()[0]);
      if (selected) assert.equal(actual, selected, 'array order changed the selected lid');
      selected = actual;
      if (x && z) assert.equal(actual, `${Math.sign(x) * size / 2},${Math.sign(z) * size / 2}`,
        'selected a neighbour instead of the crate under the feet');
      // The rebound must not immediately break another member of the cluster.
      player.prevPos.copy(player.pos); player.pos.y += .2;
      player.collide(level);
      assert.equal(broken().length, 1, 'rebound hit an adjacent lid');
      checks++;
    }
  }
  reset();
  drop(.6, -size / 2, { prevX: -.6, above: .1, below: .4 });
  assert.equal(broken().length, 1);
  assert.equal(centerKey(broken()[0]), centerKey(crates[0]), 'selection used end-of-step position instead of lid-crossing point');
  checks++;

  reset();
  drop(0, 0, { above: .02, below: .84, speed: -CONST.maxFallSpeed });
  assert.equal(broken().length, 1, 'terminal-speed corner fall cleared several crates');
  assert.equal(player.vVel, TUNING.crateBounce);
  const next = crates.find(c => c.alive);
  drop(next.mesh.position.x, next.mesh.position.z);
  assert.equal(broken().length, 2, 'a later landing could not break the next crate');
  checks += 2;

  reset();
  drop(0, 0, { spin: true, below: .25 });
  assert.ok(broken().length > 1, 'active spin lost its expanded multi-crate reach');
  checks++;

  const multihit = allCrates.slice(4, 8), stack = allCrates.slice(8, 16);
  const mixed = allCrates.slice(16, 20), arrows = allCrates.slice(20, 24);
  const switches = allCrates.slice(24, 28), tnt = allCrates.slice(28, 32);
  for (const reverse of [false, true]) {
    reset(reverse);
    drop(5, 0);
    assert.equal(multihit.filter(c => c.hitsRemaining === 4).length, 1, 'corner landing hit several multihit crates');
    assert.equal(multihit.filter(c => c.hitsRemaining === 5).length, 3);
    assert.ok(multihit.every(c => c.alive));
    assert.equal(player.vVel, TUNING.crateBounce);
    checks++;

    reset(reverse);
    drop(-5, 0, { top: size * 2, above: .02, below: size * 1.5, speed: -CONST.maxFallSpeed });
    assert.equal(stack.filter(c => !c.alive).length, 1, 'deep fall cleared several stack layers');
    assert.ok(stack.slice(0, 4).every(c => c.alive), 'deep fall selected a lower lid');
    assert.equal(player.pos.y, size * 2 + .02, 'stack did not bounce from the highest lid');
    checks++;

    for (let i = 0; i < mixed.length; i++) {
      reset(reverse);
      const c = mixed[i], x = Math.sign(c.mesh.position.x) * .2,
        z = 5 + Math.sign(c.mesh.position.z - 5) * .2;
      drop(x, z);
      assert.equal(mixed[0].alive, i !== 0, 'landing on another type also smashed the wood neighbour');
      assert.equal(mixed[1].fuse !== undefined, i === 1, 'landing selected the neighbouring TNT');
      assert.equal(player.vVel, i === 2 ? TUNING.arrowBounce : i === 3 ? 0 : TUNING.crateBounce);
      if (i === 3) assert.equal(player.crateFloor, c, 'metal landing lost its lid support');
      checks++;
    }

    reset(reverse);
    drop(0, -5);
    assert.ok(arrows.every(c => c.alive));
    assert.equal(player.vVel, TUNING.arrowBounce);
    assert.equal(arrowBounces, 1, 'one corner landing triggered several arrow bounces');
    checks++;

    reset(reverse);
    drop(5, 5);
    assert.equal(switches.filter(c => c.bangUsed).length, 1, 'corner landing activated several switches');
    checks++;

    reset(reverse);
    drop(-5, -5);
    assert.equal(tnt.filter(c => c.fuse !== undefined).length, 1, 'corner landing lit several fuses');
    assert.ok(tnt.every(c => c.alive));
    checks++;
  }

  console.log(`PASS ${checks} one-crate landings: centres, seams, corners, array order, swept impact, fast falls, rebound, next bounce, multihit, stacks, TNT, arrows, metal, switches and expanded spin.`);
}, { levelEntry: { id: '__single_crate_landing', name: data.name, data } });
