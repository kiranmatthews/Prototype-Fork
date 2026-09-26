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
  const { CODEX_LAB_LEVEL: data, BLOCKWORKS_SECTIONS: sections, BLOCKWORKS_CAMERA_ROUTE: route, BLOCKWORKS_GROUND: groundDatum } =
    await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const normalized=normalizeCustomLevelData(data);
  assert.ok(normalized,'source level must survive editor validation');
  assert.equal(normalized.components.length,data.components.length);
  assert.equal(normalized.components.filter(c=>c.iceGrip===.08).length,data.components.filter(c=>c.iceGrip===.08).length);
  level = new Level(new THREE.Scene(), { id: 'blockworks-structure', name: data.name, data });
  level.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
  const staticGround = level.groundMeshes.filter(mesh => mesh.userData.moverId === undefined);
  const floor = (x, z, fromY = 100) => {
    ray.set(new THREE.Vector3(x, fromY, z), down); ray.near = 0; ray.far = 200;
    return ray.intersectObjects(staticGround, false).find(hit => hit.face?.normal.y > .2)?.point.y;
  };
  const deathTop = (x, z) => Math.max(level.killY, ...level.pitBoxes
    .filter(box => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z).map(box => box.max.y));
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
  assert.equal(level.cameraViews.length, 0, 'building routes must use the stable course camera without view-volume transitions');

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

  const bounds = component => {
    const size = [...component.s];
    if (Math.round(component.yaw ?? 0) % 180 !== 0) [size[0], size[2]] = [size[2], size[0]];
    return new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...component.p), new THREE.Vector3(...size));
  };
  const touching = (a, b) => {
    const overlap = ['x', 'y', 'z'].map(axis => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]));
    // A face with nonzero area joins construction; corner-only contact does not.
    return overlap.every(n => n > -.012) && overlap.filter(n => n > .04).length >= 2;
  };
  const flood = (boxes, seeds) => {
    const reached = new Set(seeds), queue = [...seeds];
    for (let cursor = 0; cursor < queue.length; cursor++)
      for (let i = 0; i < boxes.length; i++) if (!reached.has(i) && touching(boxes[queue[cursor]], boxes[i])) {
        reached.add(i); queue.push(i);
      }
    return reached;
  };

  // The excavated site is real collision geometry. All static building parts
  // either reach that datum or seat on another solid, including cube stacks.
  let groundProbes = 0, foundationProbes = 0, roofProbes = 0;
  for (let index = 0; index < sections.length; index++)
    for (let v = 0; v <= sections[index].length; v += 10) for (const u of [-30, 0, 30]) {
      const [x, z] = world(index, u, v);
      near(floor(x, z, groundDatum + .05), groundDatum, `section ${index + 1} shared ground`); groundProbes++;
    }
  for (const component of data.components.filter(c => c.t === 'platform')) {
    const box = bounds(component);
    if (box.min.y <= groundDatum + .01) continue;
    for (const [fx, fz] of [[.5, .5], [.03, .03], [.97, .03], [.03, .97], [.97, .97]]) {
      const x = THREE.MathUtils.lerp(box.min.x, box.max.x, fx), z = THREE.MathUtils.lerp(box.min.z, box.max.z, fz);
      near(floor(x, z, box.min.y + .03), box.min.y, `unsupported underside of ${component.nm} at ${component.p}`); foundationProbes++;
    }
  }

  const compounds = [
    { index: 3, end: 95, path: Array.from({length:6}, (_,i) => [i%2?2.4:-2.4, 36+i*9.6, (i+1)*2.4]) },
    { index: 6, end: 122, path: [...Array.from({length:4}, (_,i) => [-4.8,36+i*9.6,(i+1)*2.4]),
      [0,69.6,9.6],[4.8,79.2,7.2],[4.8,91.2,4.8],[4.8,103.2,7.2],[4.8,115.2,4.8],[4.8,123,4.8]] },
    { index: 13, end: 70, path: [[0,34,2.4],[0,43.6,4.8],[0,53.2,7.2],[0,64,7.2]] },
  ];
  const compoundEvidence = [];
  for (const {index, end, path} of compounds) {
    const s = sections[index], a = s.yaw*Math.PI/180;
    const cells = data.components.filter(c => c.t === 'platform' && c.grp === index+10 && c.s.every(n => Math.abs(n-2.4)<.001)
      && -Math.sin(a)*(c.p[0]-s.start[0])-Math.cos(a)*(c.p[2]-s.start[2]) < end);
    assert.ok(cells.length > 50, `section ${index + 1} lacks its substantial modular building`);
    const boxes = cells.map(bounds), joined = flood(boxes, [0]);
    assert.equal(joined.size, cells.length, `section ${index + 1} modular wings are detached above their foundation`);
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
      const overlaps=['x','y','z'].map(axis=>Math.min(boxes[i].max[axis],boxes[j].max[axis])-Math.max(boxes[i].min[axis],boxes[j].min[axis]));
      assert.ok(!overlaps.every(length=>length>.001),
        `section ${index+1} has overlapping modular cells at ${cells[i].p} and ${cells[j].p}; wings must meet on the grid`);
    }
    for (const [u,v,y] of path) {
      const [x,z]=world(index,u,v);near(support(x,z),y,`section ${index+1} exposed climbing roof`);
    }
    for (let k=1;k<path.length;k++) {
      const a=path[k-1],b=path[k],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.2);let previous;
      for(let j=0;j<=steps;j++) {
        const t=j/steps,[x,z]=world(index,THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t)),y=support(x,z);
        assert.ok(y>=2.35,`section ${index+1} roof route drops into a gap/podium`);
        if(previous!==undefined)assert.ok(Math.abs(previous-y)<2.45,`section ${index+1} roof riser exceeds a cube jump`);
        previous=y;roofProbes++;
      }
    }
    compoundEvidence.push({section:index+1,joinedCells:joined.size});
  }
  // An actual courtyard has an open low interior bounded by built wings;
  // filling it with a slab or reverting either wing to islands must fail.
  let courtyardProbes=0,hallProbes=0;
  for(let v=40;v<=64;v+=2) {
    const west=world(6,-1.3,v),east=world(6,3.7,v);
    for(const u of [-1.1,1.2,3.5]) {
      const y=support(...world(6,u,v));
      assert.ok(Math.abs(y+.03)<.004,`courtyard floor must stay recessed across its 4.8m width: ${y}`);courtyardProbes++;
    }
    assert.ok(support(...west)>=4.75 && support(...east)>=4.75,'courtyard lost its opposing connected wings');
    courtyardProbes+=2;
  }
  for(const [v,y]of [[29.4,2.4],[69.6,9.6]])near(support(...world(6,1.2,v)),y,'courtyard end enclosure');
  for(let v=55;v<135;v+=.5)for(const u of [-1,0,1]) {
    near(support(...world(8,u,v)),9.6,'machine hall central roof lane');hallProbes++;
  }

  // Steel switch terrain forms connected portal frames which reach permanent
  // footings. The footings themselves sit beneath the lethal channel, so
  // adding believable supports cannot create a route before activation.
  const footings = data.components.filter(c => c.t==='platform' && c.nm==='Submerged switch-pier footing').map(bounds);
  const steel = level.crates.filter(c => c.wasOutline && c.metal);
  assert.ok(footings.length>0 && steel.length>0);
  for(const box of footings)assert.ok(box.max.y < deathTop(box.getCenter(new THREE.Vector3()).x,box.getCenter(new THREE.Vector3()).z)-.5,
    'permanent switch footing is usable before the key');
  const construction = [...footings,...steel.map(c=>c.box)];
  const groundedSteel = flood(construction,footings.map((_,i)=>i));
  assert.equal(groundedSteel.size,construction.length,'switch steel contains a disconnected floating part');
  assert.ok(steel.every(c=>c.pending),'steel terrain must remain absent until its key is used');

  // Probe the full assembled level to catch accidental support from inlays,
  // neighboring sections or other geometry under essential gaps. Real site
  // ground and pier footings are allowed only below the reset threshold.
  // Movers are deliberate crossings, so this checks permanent support.
  const gaps = [
    [0, 131, 142.5, 7], [1, 43, 61, 9], [1, 69, 101.8, 9],
    [2, 145, 156.5, 7], [4, 113, 151, 10], [5, 51, 148, 10],
    [7, 113, 148, 10], [9, 140, 151.5, 8], [10, 85, 96, 8], [10, 127, 160, 8],
    [8,34,54.8,4], [11, 43, 67.8, 10], [11, 74.2, 113, 10], [11,150,178,8],
    [12, 82, 93.5, 8], [12, 141, 153, 8], [13, 131, 149, 9],
  ];
  for (const [index, from, to, halfWidth] of gaps)
    for (let v = from + .15; v < to - .1; v += .6) for (let u = -halfWidth; u <= halfWidth; u += 1) {
      const [x, z] = world(index, u, v), y = floor(x, z);
      assert.ok(y!==undefined && y <= deathTop(x,z), `section ${index + 1} gap contains usable ground at u=${u} v=${v}, y=${y}`); gapProbes++;
    }

  const overVoid = [];
  for (const pickup of data.components.filter(c => c.t === 'wumpa')) {
    const [x, y, z] = pickup.p, ground = support(x, z);
    if (!Number.isFinite(ground) || ground <= deathTop(x,z)) { overVoid.push(pickup); continue; }
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
    groundProbes,foundationProbes,roofProbes,courtyardProbes,hallProbes,compounds:compoundEvidence,groundedSteel:steel.length,
    stableCameraViews: level.cameraViews.length, mandatoryGapProbes: gapProbes,
    groundedPickups: pickupProbes, airbornePickups: overVoid.length }, null, 2));
  console.log('PASS Blockworks grounded architecture, joined modular roofs, switch foundations, mandatory gaps, route joins and collectibles');
} finally {
  level?.dispose(); await server.close();
}
