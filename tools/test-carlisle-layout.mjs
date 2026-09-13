import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

// The oracle is the pre-city editor snapshot, not a description of the new
// implementation. Only the independently identified spawn-right playground
// is excluded; the descending main course and every later challenge remain.
const original = JSON.parse(await readFile(new URL('carlisle-coast/original-course.json', import.meta.url), 'utf8'));
const range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);
const removed = new Set([1, ...range(20, 30), ...range(71, 86), ...range(121, 123), 175, 176,
  ...range(242, 253), 276, 490, 493, 499, 502]);
const expectedIndices = original.data.components.map((_, i) => i).filter(i => !removed.has(i) && original.data.components[i].t !== 'crate');
const expected = expectedIndices.map(i => original.data.components[i]);
const json = value => JSON.parse(JSON.stringify(value));
const countBy = (components, key) => components.reduce((out, c) => {
  const value = key(c); out[value] = (out[value] ?? 0) + 1; return out;
}, {});
assert.equal(original.data.components.length, 508, 'the immutable original snapshot has 508 components');
assert.equal(expectedIndices.length, 288, 'original non-box components survive the playground removal and authorized box overhaul');
assert.deepEqual(countBy(expected, c => c.t), {
  platform: 48, ramp: 9, wall: 10, vertramp: 1, rail: 73, gate: 1, clock: 1,
  comboorb: 1, crumble: 14, enemy: 28, checkpoint: 14, wumpa: 74,
  mover: 2, stone: 5, crusher: 2, pendulum: 2, ropeswing: 1, zone: 1, crystal: 1,
}, 'independent original challenge inventory');
assert.deepEqual(countBy(expected.filter(c => c.t === 'enemy'), c => c.foe ?? 'grunt'), {
  grunt: 6, spiker: 6, turtle: 4, hopper: 3, sentry: 2, charger: 3, floater: 2, spinner: 2,
}, 'all eight original enemy kinds and quantities');


const harness = await readFile(new URL('validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const nativeFetch = globalThis.fetch;
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({width: 1024, height: 1024, close() {}});
globalThis.ProgressEvent ??= class {constructor(type, data) {this.type = type; Object.assign(this, data);}};
globalThis.fetch = async input => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('blob:')) return nativeFetch(input);
  const path = new URL(url, 'http://headless.invalid').pathname;
  try {return new Response(await readFile(new URL('../public' + path, import.meta.url)));}
  catch {return new Response('', {status: 404});}
};
const server = await createServer({logLevel: 'silent', server: {middlewareMode: true}, appType: 'custom'});
let oracle, city;
try {
  const {Level, normalizeCustomLevelData, normalizeUserLevelEntries} = await server.ssrLoadModule('/src/level.ts');
  const {CARLISLE_COAST_LEVEL: data, CARLISLE_ORIGINAL_INDICES: indices} = await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
  assert.deepEqual(indices, expectedIndices, 'retained components begin the city data in exactly original order');
  assert.equal(data.name, 'Carlisle Coast');
  assert.deepEqual(data.spawn, original.data.spawn, 'the original supported spawn is preserved');
  assert.equal(data.killY, original.data.killY, 'the original below-course death height remains');
  const presentation = new Set(['invisible', 'dkind', 'tex', 'color', 'nm', 'cameraCutaway']);
  const gameplay = c => Object.fromEntries(Object.entries(c).filter(([key]) => !presentation.has(key)));
  for (let j = 0; j < expected.length; j++) {
    const index = indices[j], a = gameplay(json(expected[j])), b = gameplay(json(data.components[j]));
    // A visible original surface implicitly grinds by default. Hiding its
    // old render skin requires making that same true value explicit, since
    // the runtime otherwise opts invisible components out. Real derived
    // edge paths are independently compared below, so this is semantic
    // preservation rather than an exemption for changing grind behavior.
    if (expected[j].edgeGrinding === undefined && !expected[j].invisible &&
        ['platform', 'ramp'].includes(expected[j].t) && b.edgeGrinding === true)
      delete b.edgeGrinding;
    if (index === 69) {
      // This wall spanned both the main course and the deleted playground.
      // It may be narrowed, but must still close the original 14 m corridor.
      assert.equal(b.p[1], a.p[1]); assert.equal(b.p[2], a.p[2]);
      assert.equal(b.s[1], a.s[1]); assert.equal(b.s[2], a.s[2]);
      assert.ok(b.s[0] >= 14 && b.s[0] <= a.s[0], 'rear closure is retained after removing the side park');
      assert.ok(b.p[0] - b.s[0] / 2 <= -7 && b.p[0] + b.s[0] / 2 >= 7, 'rear wall spans the main course');
      a.p[0] = b.p[0]; a.s[0] = b.s[0];
    }
    if(index===132){
      assert.equal(b.pts.length,6,'hill rail has two additional crest knots');
      assert.deepEqual(b.pts.filter((_,i)=>[0,2,4,5].includes(i)),a.pts,'original hill rail anchors are retained');
      assert.deepEqual(b.pts[1],[0,-23,0,2.98]);assert.deepEqual(b.pts[3],[0,-88,0,5.96]);
      a.pts=b.pts;
    }
    assert.deepEqual(b, a, `original #${index} ${a.t}: coordinates, dimensions, motion and gameplay properties`);
  }
  const dressing = data.components.slice(indices.length);
  const dressingTypes = new Set(['decor', 'mesh', 'platform', 'wall', 'wallpath', 'coastwall', 'pit', 'crate']);
  assert.ok(dressing.every(c => dressingTypes.has(c.t)), 'additions dress and support the original route; no substitute enemies, crossings or camera zones');
  assert.equal(data.components.filter(c => c.t === 'zone').length, 1, 'only the original side-scroll section');
  assert.equal(data.components.filter(c => c.t === 'camnode').length, 0, 'no replacement camera spine overrides the original flow');
  const normalized = normalizeCustomLevelData(json(data));
  assert.ok(normalized, 'corrected city passes the actual runtime contract');
  const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
  assert.ok(normalizeUserLevelEntries(pack.levels), 'published pack is importable');
  assert.deepEqual(pack.levels.find(e => e.id === 'test')?.data, json(data), 'source and published Carlisle agree');

  // Both worlds go through the real migration/build/collision pipeline. Data
  // identity alone would miss an asset renderer moving support or seating an
  // enemy/crate on newly added dressing above its original floor.
  const oracleData = {...json(original.data), components: json(expected)};
  oracle = new Level(new THREE.Scene(), {id: 'carlisle-original-oracle', name: oracleData.name, data: oracleData});
  city = new Level(new THREE.Scene(), {id: 'carlisle-restored-oracle', name: data.name, data});
  await city.prepareJungleAssets();
  oracle.root.updateMatrixWorld(true); city.root.updateMatrixWorld(true);
  assert.deepEqual(city.cityAssetDiagnostics.errors, [], 'city art loads without asset failures');
  assert.equal(city.cityAssetDiagnostics.ready, city.cityAssetDiagnostics.placements, 'all placed city assets are ready');
  const round = n => Math.round(n * 1e6) / 1e6;
  const vector = v => v ? v.toArray().map(round) : null;
  const box = b => b ? [vector(b.min), vector(b.max)] : null;
  const subset = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, typeof o[k] === 'number' ? round(o[k]) : o[k]]));
  const transform = o => o ? {p: vector(o.position), r: o.rotation.toArray().map(v => typeof v === 'number' ? round(v) : v)} : null;
  const entityState = level => ({
    enemies: level.enemies.map(e => ({...subset(e, ['kind', 'x0', 'x1', 'speed', 'axis', 'baseY', 'cross', 'homeX', 'homeZ']), home: vector(e.homePosition), p: vector(e.group.position), box: box(e.box)})),

    movers: level.movers.map(m => ({...subset(m, ['amp', 'speed', 'phase']), base: vector(m.base), axis: vector(m.axisV), pose: transform(m.mesh)})),
    crumbles: level.crumbles.map(c => ({...subset(c, ['shakeTime', 'fallSpeed', 'regen', 'yaw']), base: vector(c.base), pose: transform(c.mesh)})),
    stones: level.stones.map(s => ({...subset(s, ['x', 'z0', 'z1', 'speed', 'r', 'axis', 'x0', 'x1', 'z']), box: box(s.box), p: vector(s.mesh.position)})),
    crushers: level.crushers.map(c => ({...subset(c, ['x', 'z', 'w', 'd', 'h', 'restY', 'raise', 'cycle', 'phase']), box: box(c.box), p: vector(c.mesh.position)})),
    pendulums: level.pendulums.map(p => ({...subset(p, ['len', 'amp', 'speed', 'phase', 'yaw']), box: box(p.box), pose: transform(p.pivot)})),
    ropes: level.ropeSwings.map(r => ({...subset(r, ['len', 'amp', 'speed', 'phase', 'yaw']), anchor: vector(r.anchor), pose: transform(r.pivot)})),
    checkpoints: level.checkpoints.map(c => ({box: box(c.box), spawn: vector(c.spawnPos)})),
    finish: box(level.finishBox), finishGlow: box(level.finishGlow), gateYaw: level.gateYaw,
  });
  assert.deepEqual(entityState(city), entityState(oracle), 'real runtime enemies and motion hazards, checkpoints and finish retain their original placement/parameters');
  const authoredRails = level => level.rails.filter(r => Number.isInteger(r.object.userData.editorIdx) && r.object.userData.editorIdx < expected.length);
  const railState = level => authoredRails(level).filter(r=>indices[r.object.userData.editorIdx]!==132).map(r => ({index: r.object.userData.editorIdx, points: r.points.map(vector), length: round(r.totalLength)}));
  assert.deepEqual(railState(city), railState(oracle), 'authored grind paths retain exact lengths, heights and directions');
  assert.ok(authoredRails(city).length >= 73, 'all original rail components build real grind paths');
  const edgeKey = r => r.points.map(vector).map(p => p.join(',')).sort().join('|');
  const cityEdges = new Set(city.surfaceEdgeRails.map(edgeKey));
  for (const edge of oracle.surfaceEdgeRails) {
    // The only edited wall is the rear closure beside the removed park.
    if (edge.points.every(p => p.z >= 14.49 && p.z <= 15.51)) continue;
    assert.ok(cityEdges.has(edgeKey(edge)), 'original systemic grindable ledge remains: ' + edgeKey(edge));
  }

  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const floor = (level, x, y, z, meshes = level.groundMeshes, far = 4) => {
    ray.set(new THREE.Vector3(x, y, z), down); ray.near = 0; ray.far = far;
    return ray.intersectObjects(meshes, false)[0];
  };
  let supportProbes = 0, rampProbes = 0;
  const failures = [], blocked = [];
  const probe = (index, x, y, z, label) => {
    const wanted = floor(oracle, x, y, z), actual = floor(city, x, y, z);
    supportProbes++;
    if (!wanted || !actual || Math.abs(wanted.point.y - actual.point.y) > .001)
      failures.push({index: indices[index], label, x, z, expectedY: wanted?.point.y, actualY: actual?.point.y});
    const originalSky = floor(oracle, x, 100, z, oracle.groundMeshes, 160);
    const citySky = floor(city, x, 100, z, city.groundMeshes, 160);
    if (originalSky && (!citySky || Math.abs(originalSky.point.y - citySky.point.y) > .001))
      failures.push({index: indices[index], label: 'added solid above ' + label, x, z, expectedY: originalSky.point.y, actualY: citySky?.point.y});
    if (wanted) {
      const feet = new THREE.Vector3(x, wanted.point.y + .45, z);
      if (!oracle.walls.some(w => w.containsPoint(feet)) && city.walls.some(w => w.containsPoint(feet)))
        blocked.push({index: indices[index], label, x, z, y: feet.y});
    }
  };
  for (let j = 0; j < expected.length; j++) {
    const c = expected[j];
    if (c.t === 'ramp') {
      // Analytic authored slope, sampled at both sides and every metre of
      // travel: this catches a flattened road skin masking a valid ramp.
      const angle = (c.yaw ?? 0) * Math.PI / 180;
      for (let step = 0; step <= c.len; step++) for (const lateral of [-.42, 0, .42]) {
        const t = .002 + .996 * step / c.len, dx = lateral * c.w, dz = c.len * (.5 - t);
        const x = c.p[0] + dx * Math.cos(angle) + dz * Math.sin(angle);
        const z = c.p[2] - dx * Math.sin(angle) + dz * Math.cos(angle);
        const y = c.p[1] + c.rise * t;
        const originalHit = floor(oracle, x, y + .2, z);
        assert.ok(originalHit && Math.abs(originalHit.point.y - y) < .025, `original #${indices[j]} slope is measurable at ${t}`);
        probe(j, x, y + .2, z, 'ramp profile'); rampProbes++;
      }
    } else if (c.t === 'vertramp') {
      const ownMeshes = oracle.groundMeshes.filter(m => m.userData.editorIdx === j);
      const bounds = new THREE.Box3();
      for (const mesh of ownMeshes) bounds.union(new THREE.Box3().setFromObject(mesh));
      assert.ok(!bounds.isEmpty(), 'the original 120 m halfpipe has real curved contact meshes');
      for (let sx = .02; sx < 1; sx += .04) for (let sz = .025; sz < 1; sz += .05) {
        const x = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, sx), z = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, sz);
        const own = floor(oracle, x, bounds.max.y + .2, z, ownMeshes, 30);
        if (own) probe(j, x, own.point.y + .2, z, 'halfpipe curved contact');
      }
    } else if (['platform', 'crumble', 'mover', 'wall'].includes(c.t) && indices[j] !== 69) {
      const ownMeshes = oracle.groundMeshes.filter(m => m.userData.editorIdx === j);
      for (const mesh of ownMeshes) {
        const bounds = new THREE.Box3().setFromObject(mesh);
        for (const sx of [.08, .25, .5, .75, .92]) for (const sz of [.04, .2, .4, .6, .8, .96]) {
          const x = THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, sx);
          const z = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, sz);
          const own = floor(oracle, x, bounds.max.y + .2, z, ownMeshes, 30);
          if (own) probe(j, x, own.point.y + .2, z, c.t + ' surface');
        }
      }
    }
  }
  assert.deepEqual(failures, [], 'city skins/foundations never flatten or raise the original playable support');
  assert.deepEqual(blocked, [], 'city building/barrier collision never blocks an originally open course surface');
  assert.ok(rampProbes > 800 && supportProbes > 2600, 'collision probes cover every slope and original platform');

  // Thin added walls can fall between the platform grids above. Sweep the
  // actual player's footprint densely through both eastbound joins and the
  // north-to-east turn, including five walking lanes across each opening.
  const joins = [
    {name: 'E exit from original corner #48', a: [9, -1720], b: [36, -1720]},
    {name: 'E entry into original corner #56', a: [136, -1720], b: [152, -1720]},
    {name: 'N approach into original corner #48', a: [0, -1698], b: [0, -1720]},
    {name: 'turn across original corner #48', a: [0, -1720], b: [14, -1720]},
  ];
  const {CONST} = await server.ssrLoadModule('/src/tuning.ts');
  let joinProbes = 0, clearJoinProbes = 0, joinBlockerCount = 0;
  const joinBlockers = [];
  for (const {name, a, b} of joins) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), steps = Math.ceil(length / .1);
    for (let i = 0; i <= steps; i++) for (const side of [-2.7, -1.35, 0, 1.35, 2.7]) {
      const x = a[0] + dx * i / steps - dz / length * side, z = a[1] + dz * i / steps + dx / length * side;
      const support = floor(oracle, x, 100, z, oracle.groundMeshes, 100 - oracle.killY);
      if (!support) continue;
      const y = support.point.y, half = CONST.playerHalf;
      const body = new THREE.Box3(new THREE.Vector3(x - half.x, y + .12, z - half.z), new THREE.Vector3(x + half.x, y + 2 * half.y, z + half.z));
      assert.ok([...body.min.toArray(), ...body.max.toArray()].every(Number.isFinite), 'join sweep uses the real finite player half-extents');
      joinProbes++;
      if (oracle.walls.some(w => w.intersectsBox(body))) continue;
      clearJoinProbes++;
      const blocker = city.walls.find(w => w.intersectsBox(body));
      if (blocker) {
        joinBlockerCount++;
        if (joinBlockers.length < 24) joinBlockers.push({name, x: round(x), y: round(y), z: round(z), wall: box(blocker)});
      }
    }
  }
  assert.equal(joinBlockerCount, 0, `${joinBlockerCount} blocked original join body probes: ${JSON.stringify(joinBlockers)}`);
  assert.ok(joinProbes > 3500, 'dense sweeps cover the original travel joins across their usable width');
  assert.ok(clearJoinProbes > 3000, 'the wall oracle leaves thousands of genuinely open join samples to verify');

  // Query loaded render triangles as well as physics. A decorative pavement
  // band with solid:false can visually erase a jump while all collision tests
  // remain green. Only the near LOD's visible ground parts participate;
  // collider proxies, editor ghosts, shadows and deep void floors do not.
  const {CITY_ASSETS} = await server.ssrLoadModule('/src/cityAssets.ts');
  const visualGround = [];
  city.root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const kind = mesh.userData.cityAsset;
    const component = data.components[mesh.userData.editorIdx];
    const authoredSurface = mesh.userData.editorIdx >= indices.length && component?.t === 'mesh';
    if (!CITY_ASSETS[kind]?.ground && !authoredSurface) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!materials.some(m => m.visible && !m.isShadowMaterial && (!m.transparent || m.opacity > .05))) return;
    for (let parent = mesh; parent; parent = parent.parent) {
      if (!parent.visible || parent.userData.editorGhost) return;
      if (parent.parent?.isLOD && parent.parent.levels[0].object !== parent) return;
    }
    const bounds = new THREE.Box3().setFromObject(mesh);
    if (bounds.max.y <= city.killY) return;
    visualGround.push({mesh, bounds, kind: kind ?? 'authored mesh'});
  });
  assert.ok(visualGround.length > 100, 'gap visibility probes inspect the loaded city ground art');

  // Independent original take-off/landing intervals. Samples skip the exact
  // original stepping pads but still require air beneath and around them.
  const gaps = [
    ['z', 0, -153, -162, -4.5], ['z', 0, -275, -288, -10],
    ['z', 0, -350, -410, -12], ['z', 0, -475, -488, -9],
    ['z', 0, -575, -655, -12], ['z', 0, -838, -910, -13],
    ['z', 0, -1000, -1013, -21], ['z', 0, -1442, -1450, -12],
    ['z', 0, -1495, -1511, -12], ['z', 0, -1555, -1565, -10],
    ['x', -1720, 36, 44, -16], ['x', -1720, 56, 62, -15],
    ['x', -1720, 74, 100, -15], ['x', -1720, 118, 120, -11],
    ['x', -1720, 134, 136, -11], ['x', -1720, 141.5, 142, -15],
    ['z', 152, -1870, -1955, -25], ['z', 152, -2055, -2145, -25],
    ['z', 152, -2228, -2234, -25],
  ];
  let gapProbes = 0, visualGapProbes = 0;
  const visualFills = [];
  for (const [axis, fixed, start, end, height] of gaps) {
    const steps = Math.max(3, Math.ceil(Math.abs(end - start)));
    for (let i = 0; i <= steps; i++) for (const side of [-3.5, 0, 3.5]) {
      const along = THREE.MathUtils.lerp(start, end, .025 + .95 * i / steps);
      const x = axis === 'x' ? along : fixed + side, z = axis === 'x' ? fixed + side : along;
      const baselineHit = floor(oracle, x, 100, z, oracle.groundMeshes, 100 - oracle.killY);
      if (baselineHit) continue;
      const cityHit = floor(city, x, 100, z, city.groundMeshes, 100 - city.killY);
      assert.ok(!cityHit, `original jump gap stays empty at ${x},${z}; new floor at ${cityHit?.point.y}`);
      const candidates = visualGround.filter(v => x >= v.bounds.min.x && x <= v.bounds.max.x && z >= v.bounds.min.z && z <= v.bounds.max.z);
      const visibleHit = floor(city, x, 100, z, candidates.map(v => v.mesh), 100 - city.killY);
      if (visibleHit) visualFills.push({x: round(x), z: round(z), y: round(visibleHit.point.y), kind: visibleHit.object.userData.cityAsset, instance: visibleHit.instanceId});
      visualGapProbes++;
      gapProbes++;
    }
  }
  assert.ok(gapProbes > 800, 'gap preservation covers the full main route, side-scroll and final foot split');
  assert.equal(visualFills.length, 0, `${visualFills.length} original gap samples are visually covered by ground art: ${JSON.stringify(visualFills.slice(0, 24))}`);

  // Side-scrolling is an explicit E zone, not merely a camera pointing down
  // the eastbound street. Its extent is kept to the original authored section.
  assert.deepEqual(city.zones, oracle.zones, 'original side-scroll extent and travel direction');
  for (const x of [9, 9.001, 40, 75, 109, 140.999, 141]) for (const z of [-1729.99, -1720, -1710.01]) {
    assert.equal(city.zoneAt(x, z)?.dir, 'E');
    assert.equal(city.laneDirAt(x, -16, z), null, 'side-scroll owns the input frame');
  }
  for (const [x, z] of [[8.99, -1720], [141.01, -1720], [75, -1730.01], [75, -1709.99], [0, -1200], [152, -1850]])
    assert.equal(city.zoneAt(x, z), null, 'side-scroll does not leak into neighboring sections');

  // Use the real Player catch/landing solver on progression-facing lips.
  // At joins with old ground immediately outside, both versions must reject
  // the catch equally: a continuous floor is not a recoverable ledge.
  const {Player} = await server.ssrLoadModule('/src/player.ts');
  const originalPlayer = new Player(oracle.scene), cityPlayer = new Player(city.scene);
  const ledgeInput = {grindHeld: false, moveX: 0, moveY: 1, jumpHeld: false, jumpPressed: false};
  const tryCatch = (player, level, point, direction) => {
    player.rawInput = ledgeInput;
    player.pos.copy(point); player.prevPos.copy(point); player.state = 'air'; player.grounded = false;
    player.vVel = -1; player.speed = 0; player.freeSkate = false;
    player.lastVelX = direction.x * 4; player.lastVelZ = direction.z * 4;
    player.axisF.copy(direction); player.axisL.set(direction.z, 0, -direction.x);
    player.ledgeCoolT = 0; player.comboRun = false;
    const caught = player.tryLedgeGrabMesh(level);
    return {caught, ...(caught ? {lip: player.ledgeLip, landing: player.ledgeLanding.clone(), normal: player.ledgeNormal.clone()} : {})};
  };
  let ledgeProbes = 0, ledgeCatches = 0, joinedLips = 0;
  const catchesByOriginal = new Map();
  for (let j = 0; j < expected.length; j++) {
    const c = expected[j], index = indices[j];
    if (c.t !== 'platform') continue;
    const east = index >= 49 && index <= 56;
    const forward = new THREE.Vector3(east ? 1 : 0, 0, east ? 0 : -1);
    const top = c.p[1] + c.s[1] / 2;
    for (const side of [-.25, 0, .25]) for (const distance of [.35, .55]) for (const depth of [.9, 1.2]) {
      const point = new THREE.Vector3(
        east ? c.p[0] - c.s[0] / 2 - distance : c.p[0] + side * c.s[0],
        top - depth,
        // The E platforms feed a 9 m street into the wider corner #56.
        // Probe its incoming lanes, not the intentional outer containment.
        east ? c.p[2] + side * Math.min(c.s[2], 9) : c.p[2] + c.s[2] / 2 + distance,
      );
      const before = tryCatch(originalPlayer, oracle, point, forward), after = tryCatch(cityPlayer, city, point, forward);
      ledgeProbes++;
      assert.equal(after.caught, before.caught, `original #${index} ${east ? '+X' : '-Z'} front lip catch parity at ${point.toArray()}`);
      if (!before.caught) {joinedLips++; continue;}
      assert.ok(Math.abs(after.lip - before.lip) < .00001, `original #${index} true ledge height`);
      assert.ok(after.landing.distanceTo(before.landing) < .00001, `original #${index} validated mantle landing point`);
      assert.ok(after.normal.distanceTo(before.normal) < .00001, `original #${index} catch-facing normal`);
      const support = floor(city, after.landing.x, after.lip + .1, after.landing.z);
      assert.ok(support && Math.abs(support.point.y - after.lip) < .001, `original #${index} mantle destination remains supported`);
      catchesByOriginal.set(index, (catchesByOriginal.get(index) ?? 0) + 1); ledgeCatches++;
    }
  }
  assert.equal(ledgeProbes, 576, 'every retained platform gets twelve progression-facing Player probes');
  assert.ok(ledgeCatches > 200 && joinedLips > 100, 'both valid catches and original continuous-floor rejections are exercised');
  for (const index of [16, 17, 18, 19, 45, 53, 63])
    assert.ok(catchesByOriginal.get(index) > 0, `raised/foot platform #${index} has verified real Player catches`);

  // The old mover/crumble mesh remains the collision authority. Its detailed
  // deck is a visible child: compare its real local bounds and relative world
  // transform, then exercise the original move, shake, fall and hide cycles.
  const movingSkins = [...city.movers, ...city.crumbles].map(item => {
    const parent = item.mesh, children = [];
    parent.traverse(mesh => {
      if (mesh === parent || !mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (materials.some(m => m.visible && !m.isShadowMaterial)) children.push(mesh);
    });
    assert.ok(children.length >= 2, 'each moving/breakaway collider has a detailed visible deck skin');
    assert.ok((Array.isArray(parent.material) ? parent.material : [parent.material]).every(m => !m.visible), 'draft moving collider skin stays hidden');
    parent.geometry.computeBoundingBox();
    const inverse = parent.matrixWorld.clone().invert();
    return {parent, children, local: children.map(mesh => inverse.clone().multiply(mesh.matrixWorld).toArray().map(round))};
  });
  assert.equal(movingSkins.length, 16, 'both original movers and all fourteen crumble pads have attached skins');
  const effectiveVisible = mesh => {
    for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return false;
    return true;
  };
  let skinChecks = 0;
  const verifyMovingSkins = () => {
    city.root.updateMatrixWorld(true);
    for (const {parent, children, local} of movingSkins) {
      const inverse = parent.matrixWorld.clone().invert(), visualBounds = new THREE.Box3();
      for (let i = 0; i < children.length; i++) {
        const mesh = children[i], relative = inverse.clone().multiply(mesh.matrixWorld);
        assert.ok(relative.toArray().every((value, k) => Math.abs(value - local[i][k]) < .000001), 'deck world transform remains attached to the original moving collider');
        assert.equal(effectiveVisible(mesh), effectiveVisible(parent), 'deck visibility follows its moving/breakaway collider');
        mesh.geometry.computeBoundingBox(); visualBounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(relative));
      }
      const support = parent.geometry.boundingBox;
      for (const axis of ['x', 'z']) {
        assert.ok(Math.abs(visualBounds.min[axis] - support.min[axis]) < .0001, 'moving skin starts on the original collider footprint');
        assert.ok(Math.abs(visualBounds.max[axis] - support.max[axis]) < .0001, 'moving skin ends on the original collider footprint');
      }
      assert.ok(Math.abs(visualBounds.max.y - support.max.y) < .0001, 'detailed moving deck top agrees with the original contact height');
      skinChecks++;
    }
  };
  verifyMovingSkins();

  // Both moving platforms and the rope/pendulum/crusher encounters must also
  // agree over time; matching static editor transforms is insufficient.
  for (const delta of [0, .1, .45, .8, 1.1, 1.4]) {
    oracle.update(delta); city.update(delta);
    oracle.root.updateMatrixWorld(true); city.root.updateMatrixWorld(true);
    assert.deepEqual(entityState(city), entityState(oracle), `actual obstacle motion remains identical at t=${round(city.time)}`);
    assert.deepEqual(railState(city), railState(oracle), 'live rail positions retain the original route');
    verifyMovingSkins();
  }
  for (let i = 0; i < city.crumbles.length; i++) {oracle.touchCrumble(i); city.touchCrumble(i);}
  const crumbleStates = new Set();
  for (const delta of [.1, .3, .15, .35, .65, .6]) {
    oracle.update(delta); city.update(delta);
    oracle.root.updateMatrixWorld(true); city.root.updateMatrixWorld(true);
    assert.deepEqual(entityState(city), entityState(oracle), 'crumble shake/fall transforms retain original behavior');
    for (const crumble of city.crumbles) crumbleStates.add(crumble.state);
    verifyMovingSkins();
  }
  assert.ok(['shake', 'fall', 'gone'].every(state => crumbleStates.has(state)), 'attached decks are checked through shake, tumble and disappearance');
  assert.ok(city.crumbles.every(c => c.state === 'gone' && !c.mesh.visible), 'all broken deck skins vanish with their original pads');
  assert.ok(normalizeCustomLevelData(city.captureData()), 'editor capture remains a valid complete level');
  console.log(`PASS Carlisle restoration: all 288 retained non-box originals match independently (hill rail clearance exception); 28 enemies, 73 rails, 9 slopes, 14 crumble pads, 14 checkpoints; ${supportProbes} real support probes (${rampProbes} slope probes), ${joinProbes} join body-clearance probes, ${gapProbes} open-gap and ${visualGapProbes} rendered-gap probes, ${ledgeProbes} Player ledge probes (${ledgeCatches} matching catches), ${skinChecks} attached moving-deck checks, timed obstacle parity, original E side-scroll, source/published parity.`);
} finally {
  city?.dispose(); oracle?.dispose(); await server.close();
}
