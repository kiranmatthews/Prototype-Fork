import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let level;
const failures = [], evidence = {};
const check = (name, run) => { try { evidence[name] = run(); } catch (error) { failures.push(`${name}: ${error.message}`); } };
const near = (a, b, why, tolerance = .025) => assert.ok(Math.abs(a - b) <= tolerance, `${why}: ${a} != ${b}`);
const value = (v, s) => typeof v === 'function' ? v(s) : v;
try {
  const { Level, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { TUNING } = await server.ssrLoadModule('/src/tuning.ts');
  const { cameraRigFraming, setCameraRigAim } = await server.ssrLoadModule('/src/cameraRig.ts');
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_ROADS: roads, BLOCKWORKS_GAPS: gaps,
    BLOCKWORKS_CLIMBS: climbs, BLOCKWORKS_CHECKPOINTS: checkpoints,
    BLOCKWORKS_GROUND: ground, ROUTE_END: end, routePoint } = await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const normalized = normalizeCustomLevelData(data);
  check('editor normalization', () => { assert.ok(normalized, 'source must remain valid editor data'); return { components: normalized.components.length }; });
  level = new Level(new THREE.Scene(), { id: 'blockworks-structure', name: data.name, data });
  level.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const staticGround = level.groundMeshes.filter(mesh => mesh.userData.moverId === undefined);
  const ribbons = staticGround.filter(mesh => {
    const c = data.components[mesh.userData.editorIdx];
    return c?.t === 'mesh' && c.solid !== false && c.vert === false;
  });
  const hits = (p, meshes = staticGround, fromY = 50) => {
    ray.set(new THREE.Vector3(p[0], fromY, p[2]), down); ray.near = 0; ray.far = 150;
    return ray.intersectObjects(meshes, false).filter(hit => hit.face.normal.y > .15);
  };
  const floor = (p, fromY = 50) => hits(p, staticGround, fromY)[0]?.point.y;
  const deathTop = p => Math.max(level.killY, ...level.pitBoxes.filter(box =>
    p[0] >= box.min.x && p[0] <= box.max.x && p[2] >= box.min.z && p[2] <= box.max.z
    && !level.pitMissesPoly(box, p[0], p[2])).map(box => box.max.y));
  const safeFloor = (p, fromY = 50) => { const y = floor(p, fromY); return y !== undefined && y > deathTop(p) + .08 ? y : null; };

  check('curved road support and chunk seams', () => {
    let probes = 0, seams = 0, maxError = 0;
    for (const road of roads) {
      const samples = [];
      for (let s = road.a + .2; s < road.b - .1; s += 1.1) samples.push(s);
      for (let s = road.a + 64; s < road.b; s += 64) for (const d of [-.015, 0, .015]) { samples.push(s + d); seams += 3; }
      for (const s of samples) for (const side of [-.43, 0, .43]) {
        const top = value(road.top, s), width = value(road.width, s), offset = value(road.offset, s);
        const p = routePoint(s, top, offset + side * width);
        const hit = hits(p, ribbons, top + .1).find(hit => Math.abs(hit.point.y - top) < .04);
        assert.ok(hit, `missing ribbon at s=${s.toFixed(3)}, side=${side}, expectedY=${top}`);
        maxError = Math.max(maxError, Math.abs(hit.point.y - top)); probes++;
      }
    }
    assert.ok(probes > 3000 && seams > 20);
    for (const mesh of ribbons) {
      mesh.geometry.computeBoundingBox();
      near(mesh.geometry.boundingBox.min.y + mesh.position.y, ground, 'road mass does not reach shared ground', .001);
      assert.equal(mesh.userData.vert, false); assert.equal(mesh.userData.edgeGrinding, false);
    }
    return { roads: roads.length, ribbonMeshes: ribbons.length, probes, seamProbes: seams, maxHeightError: maxError };
  });

  check('road-to-road joins', () => {
    let joins = 0;
    for (const before of roads) for (const after of roads) {
      if (Math.abs(before.b - after.a) > .0001) continue;
      const s = before.b, y0 = value(before.top, s), y1 = value(after.top, s);
      const u0 = value(before.offset, s), u1 = value(after.offset, s);
      const lo = Math.max(u0 - value(before.width, s) / 2, u1 - value(after.width, s) / 2) + .3;
      const hi = Math.min(u0 + value(before.width, s) / 2, u1 + value(after.width, s) / 2) - .3;
      if (hi < lo || Math.abs(y0 - y1) > .08) continue; // intentional raised exits are movement challenges
      for (const u of [lo, (lo + hi) / 2, hi]) for (const delta of [-.02, 0, .02]) {
        const y = delta < 0 ? value(before.top, s + delta) : value(after.top, s + delta);
        assert.ok(hits(routePoint(s + delta, y, u), ribbons, y + .12).some(h => Math.abs(h.point.y - y) < .05),
          `unsupported road join at station ${s}, u=${u}, offset=${delta}`); joins++;
      }
    }
    return { joinProbes: joins };
  });

  check('shared ground, building foundations and climbing roofs', () => {
    let groundProbes = 0, foundationProbes = 0, roofProbes = 0;
    for (let s = 0; s <= end; s += 15) for (const u of [-25, 0, 25]) {
      const p = routePoint(s, ground, u);
      near(floor(p, ground + .05), ground, 'shared ground support', .002);
      assert.ok(deathTop(p) > ground + .3, 'shared ground became a walkable bypass'); groundProbes++;
    }
    for (const c of data.components.filter(c => c.t === 'platform')) {
      const bottom = c.p[1] - c.s[1] / 2;
      if (bottom <= ground + .01) continue;
      const a = (c.yaw ?? 0) * Math.PI / 180;
      for (const [fx, fz] of [[0, 0], [-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) {
        const dx = c.s[0] * fx, dz = c.s[2] * fz;
        const p = [c.p[0] + Math.cos(a) * dx + Math.sin(a) * dz, bottom,
          c.p[2] - Math.sin(a) * dx + Math.cos(a) * dz];
        near(floor(p, bottom + .04), bottom, `floating module ${c.nm} at ${c.p}`, .055); foundationProbes++;
      }
    }
    // Every visible LEGO cell must be enclosed by its actual solid building,
    // even though the repeated cube faces do not each need another collider.
    const buildings = data.components.filter(c => c.t === 'platform' && c.nm === 'Solid modular building');
    const modules = data.components.filter(c => c.nm === 'Jump-sized roof module');
    assert.ok(buildings.length >= 7 && modules.length > 300);
    const contains = (body, p) => {
      const a = (body.yaw ?? 0) * Math.PI / 180, dx = p[0] - body.p[0], dz = p[2] - body.p[2];
      return Math.abs(Math.cos(a) * dx - Math.sin(a) * dz) <= body.s[0] / 2 + .002
        && Math.abs(p[1] - body.p[1]) <= body.s[1] / 2 + .002
        && Math.abs(Math.sin(a) * dx + Math.cos(a) * dz) <= body.s[2] / 2 + .002;
    };
    for (const module of modules) {
      assert.equal(module.solid, false);
      const a = (module.yaw ?? 0) * Math.PI / 180;
      const points = [];
      for (let i = 0; i < module.vertices.length; i += 3) {
        const x = module.vertices[i] * module.s[0], y = module.vertices[i + 1] * module.s[1], z = module.vertices[i + 2] * module.s[2];
        points.push([module.p[0] + Math.cos(a) * x + Math.sin(a) * z,
          module.p[1] + y, module.p[2] - Math.sin(a) * x + Math.cos(a) * z]);
      }
      assert.ok(buildings.some(body => body.grp === module.grp && points.every(p => contains(body, p))),
        `visible module has no enclosing solid mass at ${module.p}`);
    }
    for (const climb of climbs) {
      for (const step of climb.steps) {
        near(floor(step.point, step.top + .1), step.top, `${climb.name} landing roof`); roofProbes++;
      }
      near(floor(climb.start, climb.start[1] + .2), climb.start[1], `${climb.name} entry`);
      near(floor(climb.exit, climb.exit[1] + .2), climb.exit[1], `${climb.name} exit`);
    }
    return { groundProbes, foundationProbes, roofProbes, solidBuildings: buildings.length, supportedVisualModules: modules.length, climbs: climbs.map(c => c.name) };
  });

  check('permanent hazards stay open and cannot be walked across', () => {
    let gapProbes = 0;
    const crossings = [];
    for (const gap of gaps) {
      // Ordinary jump/rail/mover channels must contain no hidden permanent
      // centre bridge. The foundry intentionally contains two isolated towers.
      if (!gap.kind.includes('switch')) for (let s = gap.a + .8; s < gap.b - .8; s += .7)
        for (const u of [-2, 0, 2]) {
          const p = routePoint(s, gap.y, u);
          assert.equal(safeFloor(p), null, `${gap.kind} filled at ${s.toFixed(2)}, u=${u}`); gapProbes++;
        }
      // Flood actual supported cells rather than assuming that a pit label or
      // long gap is sufficient. Includes permanent foundry islands and guides;
      // pending metal and movers deliberately cannot form a permanent bypass.
      const ds = 1, du = .8, a = gap.a - 2, b = gap.b + 2;
      const rows = Math.ceil((b - a) / ds) + 1, columns = Math.ceil(gap.width / du) + 1;
      const heights = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) =>
        safeFloor(routePoint(a + row * (b - a) / (rows - 1), gap.y, -gap.width / 2 + col * gap.width / (columns - 1)))));
      const visited = new Set(), queue = [];
      for (let col = 0; col < columns; col++) if (heights[0][col] !== null) { const id = col; visited.add(id); queue.push(id); }
      for (let head = 0; head < queue.length; head++) {
        const id = queue[head], row = Math.floor(id / columns), col = id % columns;
        assert.ok(row < rows - 1, `permanent walking bypass across ${gap.kind} at ${gap.a}`);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1]]) {
          const r = row + dr, c = col + dc, next = r * columns + c;
          if (r < 0 || r >= rows || c < 0 || c >= columns || visited.has(next) || heights[r][c] === null
            || Math.abs(heights[r][c] - heights[row][col]) > .4) continue;
          visited.add(next); queue.push(next);
        }
      }
      assert.ok(queue.length > 0, `hazard ${gap.kind} has no supported approach cells`);
      crossings.push({ kind: gap.kind, station: gap.a, reachableApproachCells: queue.length });
    }
    return { gapProbes, crossings };
  });

  check('checkpoints bank substantial completed challenges', () => {
    assert.deepEqual(checkpoints.map(cp => cp.s), [422, 750, 1030, 1280, 1550, 1910]);
    assert.equal(level.checkpoints.length, 6);
    assert.equal(data.atmosphere.fogFar, 230);
    for (const p of [data.spawn, ...checkpoints.map(cp => cp.p)]) {
      const y = safeFloor(p, p[1] + .5); assert.ok(y !== null, `unsupported or lethal checkpoint ${p}`);
      near(y, p[1], 'checkpoint deck', p === data.spawn ? .2 : .05);
    }
    const spans = [];
    for (let i = 0; i < checkpoints.length - 1; i++) {
      const a = checkpoints[i], b = checkpoints[i + 1], distance = new THREE.Vector3(...a.p).distanceTo(new THREE.Vector3(...b.p));
      assert.ok(distance >= 250 && distance > data.atmosphere.fogFar, 'adjacent checkpoints are visible in the same short court');
      // Euclidean spacing alone is insufficient: the tilted camera shortens
      // fog depth. Use the production forward rig at its widest skate FOV and
      // bound every idle-spin angle of the next checkpoint's actual cube.
      const framing = cameraRigFraming(TUNING);
      const maximumFov = TUNING.camFov + TUNING.camSpeedFovBoost;
      const camera = new THREE.PerspectiveCamera(maximumFov, 16 / 9, .1, data.atmosphere.fogFar);
      camera.position.set(a.p[0], a.p[1] + framing.height, a.p[2] + framing.distance);
      const aim = new THREE.Vector3();
      setCameraRigAim(aim, camera.position, { x: 0, z: -1 }, framing.pitch);
      camera.lookAt(aim); camera.updateMatrixWorld(true);
      const checkpointBox = level.checkpoints[i + 1].box;
      const size = checkpointBox.getSize(new THREE.Vector3()), centre = checkpointBox.getCenter(new THREE.Vector3());
      const diameter = Math.hypot(size.x, size.z);
      const spinningBounds = new THREE.Box3().setFromCenterAndSize(centre, new THREE.Vector3(diameter, size.y, diameter));
      const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      // A perspective far plane uses the same camera-space depth as linear
      // scene fog; clipping at fogFar proves the entire visible cube is hidden.
      assert.equal(new THREE.Frustum().setFromProjectionMatrix(projection).intersectsBox(spinningBounds), false,
        `checkpoint ${b.s} remains visible from ${a.s} at maximum normal skate FOV`);
      const depths = [];
      for (const x of [spinningBounds.min.x, spinningBounds.max.x])
        for (const y of [spinningBounds.min.y, spinningBounds.max.y])
          for (const z of [spinningBounds.min.z, spinningBounds.max.z])
            depths.push(-new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse).z);
      const minimumFogDepth = Math.min(...depths);
      const challenges = gaps.filter(g => g.a > a.s && g.b < b.s);
      assert.ok(challenges.length > 0, 'checkpoint span has no mandatory traversal break');
      const blocking = [];
      for (const [from, to] of [[a, b], [b, a]]) {
        const count = Math.ceil(distance), previous = [...from.p]; let blocked;
        for (let j = 1; j <= count; j++) {
          const t = j / count, p = from.p.map((n, k) => n + (to.p[k] - n) * t);
          const y = safeFloor(p, previous[1] + .35);
          if (y === null || Math.abs(y - previous[1]) > .4) { blocked = { point: p.map(n => +n.toFixed(2)), reason: y === null ? 'lethal ground/void' : 'unwalkable height change' }; break; }
          previous[0] = p[0]; previous[1] = y; previous[2] = p[2];
        }
        assert.ok(blocked, 'adjacent checkpoints share an uninterrupted walkable ground sightline'); blocking.push(blocked);
      }
      spans.push({ from: a.s, to: b.s, metres: +distance.toFixed(1), maximumFov, minimumFogDepth: +minimumFogDepth.toFixed(2), fogFar: data.atmosphere.fogFar, challenges: challenges.map(g => g.kind), blockedBothWays: blocking });
    }
    return spans;
  });

  check('crate construction and collectible placement', () => {
    let crateProbes = 0, groundedPickups = 0, airbornePickups = 0;
    const ordinary = data.components.filter(c => c.t === 'crate' && !c.outline);
    for (const crate of ordinary) {
      near(floor(crate.p, crate.p[1] + .1), crate.p[1], `unsupported authored ${crate.kind} crate`, .06); crateProbes++;
    }
    const footings = data.components.filter(c => c.t === 'platform' && c.nm === 'Submerged steel footing');
    assert.ok(footings.length > 10);
    for (const c of footings) {
      const top = c.p[1] + c.s[1] / 2; assert.ok(top < deathTop(c.p) - .5, 'unactivated footing became safe terrain');
    }
    const steel = level.crates.filter(c => c.metal && c.wasOutline);
    assert.ok(steel.length > 150 && steel.every(c => c.pending));
    const boxes = [...footings.map(c => new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...c.p), new THREE.Vector3(...c.s))), ...steel.map(c => c.box)];
    const connected = new Set(footings.map((_, i) => i)), queue = [...connected];
    const touching = (a, b) => {
      const overlap = ['x', 'y', 'z'].map(k => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
      return overlap.every(v => v >= -.012) && overlap.filter(v => v > .05).length >= 2;
    };
    for (let head = 0; head < queue.length; head++) for (let i = 0; i < boxes.length; i++)
      if (!connected.has(i) && touching(boxes[queue[head]], boxes[i])) { connected.add(i); queue.push(i); }
    assert.equal(connected.size, boxes.length, 'ghost steel contains disconnected floating construction');
    for (const c of data.components.filter(c => ['wumpa', 'crystal', 'clock', 'comboorb'].includes(c.t))) {
      const y = safeFloor(c.p);
      if (y !== null) {
        const clearance = c.p[1] - y;
        assert.ok(clearance >= (c.t === 'clock' || c.t === 'comboorb' ? -.06 : .5), `buried ${c.t} at ${c.p}, floor ${y}`);
        assert.ok(clearance <= 3.5, `unexplained high ${c.t} at ${c.p}, floor ${y}`); groundedPickups++;
      } else {
        // Air rewards must sit in an actual lethal crossing or next to a real rail.
        const insideGap = level.pitBoxes.some(box => c.p[0] >= box.min.x && c.p[0] <= box.max.x
          && c.p[2] >= box.min.z && c.p[2] <= box.max.z && box.max.y > ground + 2
          && !level.pitMissesPoly(box, c.p[0], c.p[2]));
        const onRail = level.rails.some(rail => {
          for (let s = 0; s <= rail.totalLength; s += .5) if (rail.pointAt(s).distanceTo(new THREE.Vector3(...c.p)) < 2.5) return true;
          return false;
        });
        assert.ok(insideGap || onRail, `unexplained unsupported pickup ${c.p}`); airbornePickups++;
      }
    }
    return { groundedCrates: crateProbes, groundedSteel: steel.length, groundedPickups, airbornePickups };
  });
  console.log(JSON.stringify({ evidence, failures }, null, 2));
  assert.equal(failures.length, 0, failures.join('\n'));
  console.log('PASS curved Blockworks support/seams, grounded construction, mandatory hazards, sparse checkpoints and pickups');
} finally { level?.dispose(); await server.close(); }
