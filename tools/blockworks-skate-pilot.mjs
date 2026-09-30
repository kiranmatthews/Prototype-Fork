import assert from 'node:assert/strict';

/** Continue a live run through the authored partial-width roof wedges.
 * Only device inputs are written: no placements, speed changes or resets. */
export function skateRoofWedges(r, label) {
  const { p, l, THREE, sourceModule: m } = r;
  const climb = m.BLOCKWORKS_CLIMBS.find(c => c.name === label);
  const wedges = m.BLOCKWORKS_SKATE_RAMPS.filter(w => w.name.startsWith(label));
  assert.ok(climb && wedges.length === climb.steps.length, `missing ${label} wedge sequence`);
  const begin = r.frame, deaths = p.totalDeaths;
  const first = wedges[0], direction = new THREE.Vector3(...first.high).sub(new THREE.Vector3(...first.low)).setY(0).normalize();
  const alreadyOnFirst = p.groundHit?.name === first.name;
  if (!alreadyOnFirst) {
    assert.ok(p.grounded && Math.abs(p.speed) < .2, `${label} approach must inherit a supported stop`);
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let start;
    for (const distance of [6, 5, 4, 3, 2]) {
      const q = new THREE.Vector3(...first.low).addScaledVector(direction, -distance);
      ray.set(q.clone().setY(first.low[1] + .2), down);
      const hit = ray.intersectObjects(l.groundMeshes, false)[0];
      if (hit && Math.abs(hit.point.y - first.low[1]) < .2) { start = q.setY(hit.point.y); break; }
    }
    assert.ok(start, `${label} has no supported skating approach`);
    r.walkTo(start, { maxFrames: 2400, label: `walk to ${label} ramp approach` });
  }
  const points = wedges.flatMap((w, index) => {
    const dir = new THREE.Vector3(...w.high).sub(new THREE.Vector3(...w.low)).setY(0).normalize();
    return [...(alreadyOnFirst && index === 0 ? [] : [new THREE.Vector3(...w.low)]),
      new THREE.Vector3(...w.high).addScaledVector(dir, 1.4)];
  });
  points.push(new THREE.Vector3(...climb.exit));
  const ridingBegin = r.frame;
  let index = 0, braking = false;
  for (let frame = 0; frame < 4200 && index < points.length; frame++) {
    const target = points[index], distance = Math.hypot(target.x - p.pos.x, target.z - p.pos.z);
    if (distance < 1.25 && p.pos.y >= target.y - .15) { index++; continue; }
    if (p.speed > 13.5) braking = true; else if (p.speed < 11.5) braking = false;
    r.tick({ ...(p.grounded ? r.steerToward(target) : {}), jumpHeld: true, grabHeld: braking });
    assert.ok(!p.isBailing && !['dead', 'gameover'].includes(p.state),
      `${label} ramp ${index}: ${JSON.stringify(r.snapshot())}`);
  }
  assert.equal(index, points.length, `${label} did not reach its roof exit: ${JSON.stringify(r.snapshot())}`);
  assert.ok(p.grounded && p.freeSkate && p.totalDeaths === deaths, `${label} must leave mounted without a death`);
  const ride = r.trace.slice(ridingBegin);
  assert.ok(ride.every(frame => !frame.input.jumpReleased), `${label} used a jump instead of the ramps`);
  const contacts = wedges.map(wedge => ({ name: wedge.name,
    frames: ride.filter(frame => frame.grounded && frame.ground?.name === wedge.name).length }));
  assert.ok(contacts.every(c => c.frames > 4), `${label} skipped a wedge: ${JSON.stringify(contacts)}`);
  return { label, frames: r.frame - begin, contacts, exit: r.snapshot() };
}
