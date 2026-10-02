import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

// Local geometry/contact probes. These deliberately use checkpoint/placement
// fixtures and do not claim to be continuous source-spawn-to-gate journeys.
const ids = ['jungle-terraces', 'jungle-skyline'];
const reports = [];
for (const id of ids) {
  await withBlockworksRuntime(async r => {
    const { p, l, source, THREE } = r;
    const { normalizeCustomLevelData, vertRampSpine, vertRampPath } = await r.server.ssrLoadModule('/src/level.ts');
    const { JUNGLE_SEQUEL_ROUTES } = await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
    const route = JUNGLE_SEQUEL_ROUTES.find(route => route.id === id);
    assert.ok(normalizeCustomLevelData(source), `${id}: editor data round-trip`);
    const gates = source.components.filter(c => c.t === 'gate');
    assert.equal(gates.length, 1, `${id}: exactly one finish`);
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let surfaceProbes = 0;
    const groundAt = (point, clearance = .3) => {
      ray.set(new THREE.Vector3(...point).addScaledVector(down, -clearance), down);
      ray.far = clearance + .45;
      return ray.intersectObjects(l.groundMeshes, false)[0]?.point.y;
    };
    const support = (point, label, tolerance = .1) => {
      const y = groundAt(point);
      assert.ok(y !== undefined && Math.abs(y - point[1]) <= tolerance,
        `${id}: ${label} at ${point} has ground ${y}`);
      surfaceProbes++;
    };
    r.stepFor(30);
    assert.ok(p.grounded && !p.isBailing, `${id}: supported source spawn`);
    assert.ok(p.pos.distanceTo(l.spawnPos) < .35, `${id}: source spawn settles locally`);
    const spawn = p.pos.toArray();
    for (const c of source.components.filter(c => c.t === 'ramp')) {
      const yaw = (c.yaw ?? 0) * Math.PI / 180;
      for (let i = 1; i < 12; i++) {
        const t = i / 12, localZ = c.len * (.5 - t);
        support([c.p[0] + localZ * Math.sin(yaw), c.p[1] + c.rise * t,
          c.p[2] + localZ * Math.cos(yaw)], c.nm ?? 'ramp', .12);
      }
    }
    for (const c of source.components.filter(c => c.t === 'vertramp')) {
      const path = vertRampPath(vertRampSpine(c), c.closed === true);
      // Keep away from an exactly vertical lip and from end seams. The real
      // triangle mesh, including concavity, must support these actual samples.
      for (const along of [.2, .5, .8]) for (const sign of c.vkind === 'half' ? [-1, 1] : [1]) {
        for (const ratio of [.1, .4, .7]) {
          const angle = (c.arc ?? 90) * Math.PI / 180 * ratio;
          const point = path.frame(along, sign * ((c.w ?? 3) + (c.rise ?? 6) * Math.sin(angle)),
            (c.rise ?? 6) * (1 - Math.cos(angle))).toArray();
          support(point, c.nm ?? 'pipe profile', .12);
        }
      }
    }
    const pipeCrossings = [];
    let bailEvidence;
    const realBail = p.bail.bind(p);
    p.bail = (...args) => {
      bailEvidence = { before: r.snapshot(), pipeEndFly: p.pipeEndFly, rollOffT: p.rollOffT,
        grabPhase: p.grabPhase, grabSpinAngle: p.grabSpinAngle, stack: new Error().stack };
      return realBail(...args);
    };
    for (const pipe of route.pipes) {
      let approachX = pipe.a - 12;
      if (route.gaps.some(gap => approachX > gap.a && approachX < gap.b)) approachX = pipe.a + .5;
      let approachY = pipe.lipY;
      if (approachX < pipe.a) for (let i = 1; i < route.profile.length; i++) {
        const [ax, ay] = route.profile[i - 1], [bx, by] = route.profile[i];
        if (approachX >= ax && approachX <= bx) approachY = ay + (by - ay) * (approachX - ax) / (bx - ax);
      }
      p.respawn(l, true, false, {
        position: new THREE.Vector3(approachX, approachY + .12, 1.25),
        heading: new THREE.Vector3(1, 0, 0),
      });
      r.stepFor(20);
      const begin = r.frame;
      let braking = false;
      try {
        r.until(() => p.pos.x > pipe.b + 5 && p.grounded, () => {
          if (p.speed > 16) braking = true; else if (p.speed < 13) braking = false;
          return { moveX: p.grounded ? 1 : 0, jumpHeld: true, grabHeld: braking && p.grounded };
        },
          { maxFrames: 1200, label: `input-only ${pipe.name} crossing` });
      } catch (error) {
        await writeFile(`${tmpdir()}/${id}-pipe-failure.json`, JSON.stringify({ pipe, bailEvidence, error: String(error), trace: r.trace.slice(begin) }, null, 2));
        throw error;
      }
      const run = r.trace.slice(begin), trough = Math.min(...run.map(row => row.position[1]));
      assert.ok(trough < pipe.baseY + .2, `${id}: ${pipe.name} did not ride through its trough`);
      assert.ok(run.some(row => row.grounded && row.speed > 10), `${id}: ${pipe.name} was not skated`);
      assert.ok(run.every(row => !row.input.jumpReleased), `${id}: pipe crossing unexpectedly jumped`);
      pipeCrossings.push({ name: pipe.name, frames: r.frame - begin, trough, exit: p.pos.toArray(), speed: p.speed });
    }
    p.respawn(l, true, false);
    r.stepFor(20);
    const checkpoints = [];
    for (const cp of l.checkpoints) {
      assert.ok(p.warpCheckpoint(l, 1), `${id}: checkpoint warp follows authoring order`);
      r.stepFor(24);
      assert.ok(cp.active && p.grounded && !p.isBailing, `${id}: checkpoint ${checkpoints.length + 1} is supported`);
      assert.ok(p.pos.distanceTo(cp.spawnPos) < .4, `${id}: checkpoint rest drift`);
      const camera = l.cameraDirAt(p.pos.x, p.pos.y, p.pos.z);
      assert.ok(camera && Math.abs(camera.x) < .1 && camera.z < -.9,
        `${id}: checkpoint must retain a readable east/west side view`);
      checkpoints.push(p.pos.toArray());
    }
    assert.ok(checkpoints.length >= 2, `${id}: local retries before advanced skating`);
    const savedSpawn = l.currentSpawn.clone(), deaths = p.totalDeaths;
    const pit = l.pitBoxes[0];
    const failurePoint = pit ? pit.getCenter(new THREE.Vector3()).setY(pit.max.y - .15)
      : new THREE.Vector3(savedSpawn.x, l.killY - 1, savedSpawn.z);
    p.respawn(l, false, true, { position: failurePoint });
    r.until(() => p.totalDeaths > deaths, {}, { allowDeath: true, maxFrames: 180, label: 'real fall/pit death' });
    r.until(() => p.state === 'ride' && p.grounded, {}, { allowDeath: true, maxFrames: 360, label: 'checkpoint respawn' });
    assert.ok(p.pos.distanceTo(savedSpawn) < .4, `${id}: death restores the latest checkpoint`);
    const gate = gates[0], yaw = (gate.yaw ?? 0) * Math.PI / 180;
    const heading = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const approach = new THREE.Vector3(...gate.p).addScaledVector(heading, -5);
    support(approach.toArray(), 'finish approach');
    p.respawn(l, false, true, { position: approach.clone().add(new THREE.Vector3(0, .1, 0)), heading });
    r.stepFor(20);
    r.until(() => p.state === 'finished', () => ({ ...r.worldDirectionInput(heading), spinHeld: true }),
      { maxFrames: 180, label: 'actual finish gate contact from the supported approach' });
    reports.push({ id, spawn, surfaceProbes, pipeCrossings, checkpoints, pitRespawn: savedSpawn.toArray(), finish: p.state });
  }, { modulePath: '/src/level.ts', levelId: id, source: m => m.findLevel(id)?.data,
    controlFrame: () => ({ x: 0, z: -1 }), maxFrames: 10000, endlessDeaths: true });
}
await writeFile(`${tmpdir()}/jungle-sequels-contact-checks.json`, JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
console.log('PASS sequel spawn, continuous ramp/pipe surfaces, side camera, checkpoint fall recovery and finish contact probes');
