import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

const rows = [];
await withBlockworksRuntime(async r => {
  const { p, l, THREE, TUNING } = r, path = l.treehouseStairPath;
  assert.ok(path, 'authored stair supports create a guide');
  const tuning = JSON.stringify(TUNING);
  const place = s => {
    const q = path.at(s);
    p.respawn(l, true, false, { position: new THREE.Vector3(q.x, q.y + .03, q.z) });
    r.stepFor(3);
  };
  const safe = label => {
    assert.equal(p.freeSkate, false, `${label}: mounted on the stairs`);
    assert.notEqual(p.state, 'grind', `${label}: mounted through a grind catch`);
    assert.equal(p.isBailing, false, `${label}: bailed`);
    assert.equal(p.totalDeaths, 0, `${label}: died`);
  };
  for (const [label, start, moveY, end] of [
    ['down', .2, -1, path.length - .2], ['up', path.length - .5, 1, .2],
    ['slow down', .2, -.25, path.length - .2], ['slow up', path.length - .5, .25, .2],
  ]) {
    place(start); let frames = 0, maxOffset = 0;
    for (; frames < 1800; frames++) {
      r.tick({ moveY }); safe(label);
      const sample = path.locate(p.pos);
      if (sample) maxOffset = Math.max(maxOffset, sample.distance);
      if (moveY < 0 ? !sample || sample.s >= end : !sample || sample.s <= end) break;
    }
    assert.ok(frames < 1800, `${label}: no route completion ${JSON.stringify(r.snapshot())}`);
    assert.ok(maxOffset < .45, `${label}: left safe centre corridor (${maxOffset})`);
    assert.ok(moveY < 0 ? p.pos.y < .3 : p.pos.y > 8.3, `${label}: wrong end height`);
    rows.push({ label, frames, maxOffset, position: p.pos.toArray() });
  }
  assert.ok(rows[2].frames > rows[0].frames * 2.5, 'analog walking retains reduced speed');
  assert.ok(rows[3].frames > rows[1].frames * 2.5, 'analog ascent retains reduced speed');

  // Every landing, ramp and the balcony: a held jump gesture never mounts,
  // then releasing it still launches and lands under ordinary gravity.
  for (const s of [0, 2.6, 4.8, 7.1, 9.6, 12.2, 14.8, 17.8, path.length - 2]) {
    place(s); const before = p.pos.clone();
    for (let i = 0; i < 65; i++) { r.tick({ moveY: -.15, jumpHeld: true }); safe(`charge ${s}`); }
    r.tick({ moveY: -.15 });
    assert.equal(p.state, 'air', `jump release at ${s}`);
    let peak = p.pos.y;
    for (let i = 0; i < 180 && !p.grounded; i++) { r.tick({ moveY: -.15 }); safe(`jump ${s}`); peak = Math.max(peak, p.pos.y); }
    assert.ok(p.grounded, `jump ${s}: did not land`);
    assert.ok(peak > before.y + .3, `jump ${s}: vertical arc suppressed`);
    rows.push({ label: `jump ${s}`, peak, position: p.pos.toArray() });
  }
  for (const s of [3.5, 7, 10.8, 14.8]) {
    place(s); r.stepFor(26, { moveY: -.7 });
    const turning = path.locate(p.pos).s;
    r.stepFor(32, { moveY: .7 }); safe('reverse');
    assert.ok(path.locate(p.pos).s < turning, 'opposite input reverses without fighting the camera');
    r.stepFor(60); const stopped = p.pos.clone(); r.stepFor(60);
    assert.ok(p.pos.distanceTo(stopped) < .001, 'neutral input stops without autonomous progress');
    rows.push({ label: `reverse / stop ${s}`, position: p.pos.toArray() });
  }
  const balcony = r.source.components.find(c => c.nm === 'Treehouse balcony support');
  for (const offset of [-5.5, 0, 5.5]) {
    const a = balcony.yaw * Math.PI / 180;
    p.respawn(l, true, false, { position: new THREE.Vector3(balcony.p[0] + Math.cos(a) * offset, 8.43, balcony.p[2] - Math.sin(a) * offset) });
    r.stepFor(3);
    for (let i = 0; i < 65; i++) { r.tick({ moveX: .1, jumpHeld: true, grindHeld: true }); safe('balcony'); }
    r.tick({ moveX: .1 }); assert.equal(p.state, 'air', 'balcony jump still works');
  }
  const { createTreehouseStairPath } = await r.server.ssrLoadModule('/src/treehouseStairGuide.ts');
  assert.equal(createTreehouseStairPath([{ t: 'platform', p: [0, 0, 0], s: [30, 1, 30] }]), null, 'ordinary levels opt out');
  assert.equal(path.blocksBoard({ x: balcony.p[0], y: 0, z: balcony.p[2] }), false, 'ground beneath balcony remains unrestricted');
  assert.equal(path.locate({ ...path.at(4), y: 0 }), null, 'ground beneath upper stair flight is not captured');
  // Ground-level clearing still supports the normal deliberate mount.
  p.respawn(l, true, false, { position: new THREE.Vector3(0, .04, 10) }); r.stepFor(3);
  assert.equal(path.blocksBoard(p.pos), false);
  r.stepFor(80, { moveX: .6, jumpHeld: true });
  assert.equal(p.freeSkate, true, 'normal mount is available in the clearing');
  assert.equal(JSON.stringify(TUNING), tuning, 'shared movement tuning stays unchanged');
}, { modulePath: '/src/levels/treehouse-trail.ts', levelId: 'treehouse-trail', source: m => m.TREEHOUSE_TRAIL_LEVEL,
  controlFrame: r => r.p.courseInputDirection(r.l) ?? r.p.camDir });
await writeFile(process.env.TREEHOUSE_STAIR_REPORT ?? '/private/tmp/treehouse-stair-guide.json', JSON.stringify(rows, null, 2));
console.log(`PASS Treehouse stair guidance: ${rows.length} traversal, analog, jump, reversal and stop cases; balcony mounting blocked; clearing mounting restored.`);
