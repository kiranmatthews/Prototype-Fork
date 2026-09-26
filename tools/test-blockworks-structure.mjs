import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

// Cross-section topology checks use the complete production-built Level.
// They complement controller traversal tests, which exercise local challenges.
const harness = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),
  harness.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();');
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
let level;
try {
  const { Level, normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const { cameraViewAt } = await server.ssrLoadModule('/src/cameraViews.ts');
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_SECTIONS: sections, BLOCKWORKS_CAMERA_ROUTE: route } =
    await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const normalized=normalizeCustomLevelData(data);
  assert.ok(normalized,'source level must survive editor validation');
  assert.equal(normalized.components.length,data.components.length);
  assert.equal(normalized.components.filter(c=>c.iceGrip===.08).length,data.components.filter(c=>c.iceGrip===.08).length);
  level = new Level(new THREE.Scene(), { id: 'blockworks-structure', name: data.name, data });
  level.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const floor = (x, z) => {
    ray.set(new THREE.Vector3(x, 100, z), down); ray.near = 0; ray.far = 200;
    return ray.intersectObjects(level.groundMeshes, false).find(hit => hit.face?.normal.y > .2)?.point.y;
  };
  // Neighbour probes tolerate triangulation-edge precision at flush joins;
  // real continuous walking is covered by test-blockworks.mjs.
  const support = (x, z) => Math.max(...[[0, 0], [.04, .04], [-.04, -.04]].map(([dx, dz]) => floor(x + dx, z + dz) ?? -Infinity));
  const world = (index, u, v) => {
    const section = sections[index], a = section.yaw * Math.PI / 180;
    return [section.start[0] + Math.cos(a) * u - Math.sin(a) * v,
      section.start[2] - Math.sin(a) * u - Math.cos(a) * v];
  };
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .055, `${message}: ${actual} != ${expected}`);
  assert.equal(level.perfectGrindBoost, false, 'ordinary rail exits must retain ordinary speed');
  assert.equal(level.zones.length, 0, 'travel zones must not override camera turns');
  assert.equal(level.cameraViews.length, 6);

  let joinProbes = 0, cornerProbes = 0, gapProbes = 0, pickupProbes = 0;
  const turnIndices = [];
  for (let i = 1; i < sections.length; i++) {
    const previous = sections[i - 1], next = sections[i];
    const endpoint = world(i - 1, 0, previous.length);
    near(endpoint[0], next.start[0], `section ${i + 1} x join`);
    near(endpoint[1], next.start[2], `section ${i + 1} z join`);
    near(previous.endY, next.start[1], `section ${i + 1} y join`);
    for (const [index, from, to] of [[i - 1, previous.length - 6, previous.length], [i, 0, 6]])
      for (const u of [-4, 0, 4]) {
        let lastY;
        for (let v = from; v <= to + .01; v += .5) {
          const [x, z] = world(index, u, v), y = support(x, z);
          assert.ok(Number.isFinite(y), `section ${i + 1} unsupported join u=${u} v=${v}`);
          if (lastY !== undefined) assert.ok(Math.abs(lastY - y) < .2, `section ${i + 1} discontinuous join`);
          if (v === 0 || v === previous.length) near(y, next.start[1], `section ${i + 1} join height`);
          lastY = y; joinProbes++;
        }
      }
    if (previous.yaw !== next.yaw) turnIndices.push(i);
  }
  assert.equal(turnIndices.length, 8);

  // Sample each rounded turn in route order; the camera may not reverse or
  // produce a discontinuity, and its intended line stays over the dry court.
  for (const index of turnIndices) {
    const corner = sections[index].start;
    const samples = route.filter(p => Math.hypot(p[0] - corner[0], p[2] - corner[2]) < 10.1);
    assert.ok(samples.length >= 9, `section ${index + 1} lacks a rounded turn`);
    let lastAngle;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], b = samples[i + 1], length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const steps = Math.max(1, Math.ceil(length / .2));
      for (let j = 0; j < steps; j++) {
        const t = j / steps, p = a.map((value, k) => value + (b[k] - value) * t);
        const direction = level.cameraDirAt(...p);
        assert.ok(direction, 'camera turn has no direction');
        const angle = Math.atan2(direction.x, direction.z);
        if (lastAngle !== undefined) {
          const difference = Math.atan2(Math.sin(angle - lastAngle), Math.cos(angle - lastAngle));
          assert.ok(Math.abs(difference) < .13, `camera discontinuity near section ${index + 1}: ${difference}`);
        }
        lastAngle = angle;
        near(support(p[0], p[2]), corner[1], `section ${index + 1} camera court`); cornerProbes++;
      }
    }
  }

  for (const view of level.cameraViews) {
    const match = cameraViewAt(level.cameraViews, view.p[0], view.p[1] - 10, view.p[2]);
    assert.equal(match?.view, view); near(match.weight, 1, 'elevated view central weight');
    const direction = level.cameraDirAt(view.p[0], view.p[1] - 10, view.p[2]);
    near(direction.x, -Math.sin(view.yaw * Math.PI / 180), 'view forward x');
    near(direction.z, -Math.cos(view.yaw * Math.PI / 180), 'view forward z');
    assert.ok(view.cameraPosition[1] > view.cameraTarget[1] + 10, 'view must see landing tops');
    assert.equal(view.cameraFollowDistance, 17);
  }

  // Probe the full assembled level to catch accidental support from inlays,
  // neighboring sections or other geometry under essential gaps. Switch
  // islands are excluded, while both scaffold/crossing voids are covered.
  const gaps = [
    [0, 131, 142.5, 7], [1, 43, 61, 9], [1, 69, 101.8, 9],
    [2, 145, 156.5, 7], [4, 113, 151, 10], [5, 51, 148, 10],
    [7, 113, 148, 10], [9, 140, 151.5, 8], [10, 85, 96, 8], [10, 127, 160, 8],
    [11, 43, 67.8, 10], [11, 74.2, 113, 10], [12, 82, 93.5, 8], [12, 141, 153, 8], [13, 131, 149, 9],
  ];
  for (const [index, from, to, halfWidth] of gaps)
    for (let v = from + .15; v < to - .1; v += .6) for (let u = -halfWidth; u <= halfWidth; u += 1) {
      const [x, z] = world(index, u, v), y = floor(x, z);
      assert.equal(y, undefined, `section ${index + 1} gap contains ground at u=${u} v=${v}, y=${y}`); gapProbes++;
    }

  const overVoid = [];
  for (const pickup of data.components.filter(c => c.t === 'wumpa')) {
    const [x, y, z] = pickup.p, ground = support(x, z);
    if (!Number.isFinite(ground)) { overVoid.push(pickup); continue; }
    assert.ok(y >= ground + .5, `pickup buried or intersects floor at ${pickup.p}: ground ${ground}`);
    assert.ok(y <= ground + 3.3, `pickup inexplicably above walkable ground at ${pickup.p}: ground ${ground}`); pickupProbes++;
  }
  // Airborne collectibles belong to an authored rail or a tested gap, never
  // to an unmarked hole caused by a misplaced platform or incorrect Y value.
  for (const pickup of overVoid) {
    const gap = gaps.some(([index, from, to, halfWidth]) => {
      const s = sections[index], a = s.yaw * Math.PI / 180, dx = pickup.p[0] - s.start[0], dz = pickup.p[2] - s.start[2];
      const u = Math.cos(a) * dx - Math.sin(a) * dz, v = -Math.sin(a) * dx - Math.cos(a) * dz;
      return v >= from - .2 && v <= to + .2 && Math.abs(u) <= halfWidth;
    });
    const rail = level.rails.some(rail => {
      for (let distance = 0; distance <= rail.totalLength; distance += .5)
        if (rail.pointAt(distance).distanceTo(new THREE.Vector3(...pickup.p)) < 2.4) return true;
      return false;
    });
    assert.ok(gap || rail, `unexplained unsupported pickup at ${pickup.p}`);
  }
  console.log(JSON.stringify({ joinProbes, roundedTurns: turnIndices.length, cornerProbes,
    elevatedViews: level.cameraViews.length, mandatoryVoidProbes: gapProbes,
    groundedPickups: pickupProbes, airbornePickups: overVoid.length }, null, 2));
  console.log('PASS Blockworks full-route joins, rounded camera, elevated views, genuine voids and collectible support');
} finally {
  level?.dispose(); await server.close();
}
