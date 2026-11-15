// Powderkeg Peak · fair restarts and landings. Each case is a way the level used to punish a player who did the
// obvious thing: hold the stick after a restart, take the full jump, stand in the safe pocket, coast along the fruit.
import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r => {
  const { p, l } = r, m = r.sourceModule, { RUN1, RUN2 } = m.POWDERKEG_PATHS, PLAN = m.POWDERKEG_PLAN, dt = r.CONST.fixedStep, X = PLAN.CAVE_X;
  const put = (x, y, z, hx = 0, hz = -1) => p.respawn(l, true, false, { position: p.pos.clone().set(x, y + .12, z), heading: p.pos.clone().set(hx, 0, hz) });
  const at = () => `(${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)}) ${p.state}${p.grounded ? ' on ' + (p.groundHit?.name ?? '?') : ' in the air'}`;
  const toward = (x, z, pace = 1) => r.worldDirectionInput({ x, z }, pace);
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok }); console.log('FAIR', ok ? 'ok  ' : 'FAIL', name, '·', detail); };
  const checkpoint = name => l.checkpoints.find(c => c.mesh.userData.sourceName?.includes(name)) ?? l.checkpoints.find(c => Math.hypot(c.spawnPos.x - name[0], c.spawnPos.z - name[1]) < 1.5);
  const foeNear = (x, z) => l.enemies.filter(e => e.alive).sort((a, b) => a.box.distanceToPoint(p.pos.clone().set(x, p.pos.y, z)) - b.box.distanceToPoint(p.pos.clone().set(x, p.pos.y, z)))[0];

  // 1. Every checkpoint on foot: restart there and hold the way the course runs. Nothing may kill inside the first
  // second and a quarter, and no box of Nitro may go off.
  const nitroAlive = () => l.crates.filter(c => c.alive && c.nitro).length;
  for (const cp of l.checkpoints) {
    const s = cp.spawnPos, onRun = [RUN1, RUN2].some(path => { const q = path.nearest(s.x, s.z, 9); return q && q.s > 2 && q.s < path.length - 2; });
    if (onRun) continue;
    const zone = l.zoneAt(s.x, s.z)?.dir, h = zone === 'E' ? [1, 0] : zone === 'W' ? [-1, 0] : [0, -1], nitro = nitroAlive();
    put(s.x, s.y - .1, s.z, h[0], h[1]); for (let i = 0; i < 6; i++) r.tick({});
    let died = null; for (let i = 0; i < 75; i++) { r.tick(toward(h[0], h[1])); if (p.totalDeaths) { died = i * dt; break; } }
    check(`restart at (${s.x.toFixed(1)}, ${s.z.toFixed(1)}) holding ${zone ?? 'N'}`, died === null && nitroAlive() === nitro, died === null ? at() : `dead after ${died.toFixed(2)} s at ${at()}`);
  }

  // 2. Off the glazed gallery of the upper row: the full running jump lands clear of the bristleback, and holding on a
  // moment after touchdown is survivable.
  {
    const B = PLAN.ROW_B_LEDGES, z = PLAN.ROW_B, edge = B[0].x0;
    put(edge + 7, PLAN.B0_Y, z, -1, 0); for (let i = 0; i < 6; i++) r.tick({});
    let leapt = false, landed = null, gap = null, died = false;
    for (let i = 0; i < 400 && !died; i++) {
      let sample = toward(-1, 0);
      if (!leapt && p.pos.x < edge + .45) { leapt = true; sample = { ...sample, jumpHeld: true, jumpPressed: true }; } else if (leapt && !p.grounded && p.vVel > 0) sample = { ...sample, jumpHeld: true };
      r.tick(sample); died = p.totalDeaths > 0;
      if (leapt && p.grounded && landed === null && p.pos.x < edge - 1) { landed = p.pos.x; const foe = foeNear(58.3, z); gap = foe ? p.pos.x - .5 - foe.box.max.x : 99; for (let k = 0; k < 9 && !died; k++) { r.tick(toward(-1, 0)); died = p.totalDeaths > 0; } break; }
    }
    check('upper row: a full running jump off the ice', landed !== null && !died && gap > 1.1, landed === null ? `never landed: ${at()}` : `landed at x ${landed.toFixed(2)}, ${gap.toFixed(2)} m from the bristleback, ${died ? 'dead' : 'alive'} after holding on`);
  }

  // 3. The pocket between the adit's quick stampers holds a standing player through both stampers' cycles.
  {
    put(X + 44.3, 2.8, PLAN.CAVE_Z, 1, 0); let died = false;
    for (let i = 0; i < 420 && !died; i++) { r.tick({}); died = p.totalDeaths > 0; }
    check('adit: standing in the pocket between the quick stampers', !died, at());
  }

  // 4. Arriving in the adit with the stick still held the way the arrow threw you (west) does not walk back out.
  {
    const door = l.returnPortals?.find?.(q => q.destination.x > 400) ?? null, to = door ? door.destination : p.pos.clone().set(X + 5, .12, PLAN.CAVE_Z + .4);
    put(to.x, to.y - .12, to.z, 1, 0); let out = false;
    for (let i = 0; i < 90; i++) { r.tick(toward(-1, 0)); if (p.pos.x < 400) out = true; }
    check('adit: arriving with the stick held west', !out && !p.totalDeaths, at());
    put(to.x, to.y - .12, to.z, 1, 0); out = false;
    for (let i = 0; i < 90; i++) { r.tick(toward(0, -1)); if (p.pos.x < 400) out = true; }
    check('adit: arriving with the stick held into the screen', !out && !p.totalDeaths, at());
  }

  // 5. The wide gap in the adit: the full running jump lands with room before the bristleback.
  {
    const A = PLAN.ADIT, z = PLAN.CAVE_Z, edge = X + A[4].x1;
    put(edge - 7, A[4].y, z, 1, 0); for (let i = 0; i < 6; i++) r.tick({});
    let leapt = false, landed = null, gap = null, died = false;
    for (let i = 0; i < 400 && !died; i++) {
      let sample = toward(1, 0);
      if (!leapt && p.pos.x > edge - .45) { leapt = true; sample = { ...sample, jumpHeld: true, jumpPressed: true }; } else if (leapt && !p.grounded && p.vVel > 0) sample = { ...sample, jumpHeld: true };
      r.tick(sample); died = p.totalDeaths > 0;
      if (leapt && p.grounded && landed === null && p.pos.x > edge + 1) { landed = p.pos.x; const foe = foeNear(X + 62.6, z); gap = foe ? foe.box.min.x - (p.pos.x + .5) : 99; break; }
    }
    check('adit: the full running jump over the wide gap', landed !== null && !died && gap > .5, landed === null ? `never landed: ${at()}` : `landed at x ${(landed - X).toFixed(2)}, ${gap.toFixed(2)} m from the bristleback`);
  }

  // 6. On the board. A rider who only coasts along the fruit is not tripped; from the last checkpoint the long gap is
  // cleared by holding the ollie for the last few metres (a bare tap falls short, by design).
  const ride = (path, s0, lat0, lane, to, { hold = null, pop = null } = {}) => {
    const q = path.w(s0, lat0), f = path.at(s0);
    put(q[0], m.POWDERKEG_MOUNTAIN.y(q[0], q[2]), q[2], f.fx, f.fz); p.masks = 0;
    const aim = () => { const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? s0, t = path.w(s + 9, lane(s)); return toward(t[0] - p.pos.x, t[2] - p.pos.z); };
    for (let i = 0; i < 400 && !p.freeSkate; i++) r.tick({ ...aim(), jumpHeld: true });
    const out = { bails: [], died: false, speedAtPop: 0, slowest: 99 }; let wasBailing = false, popped = false;
    for (let i = 0; i < 4000; i++) {
      const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? 0; if (s >= to) break;
      let sample = p.grounded ? aim() : {};
      if (!p.freeSkate && !p.airFromSkate && !p.isBailing) sample = { ...aim(), jumpHeld: true };          // remount after a spill
      else if (pop !== null && !popped && p.grounded) {
        if (s >= pop - .4) { popped = true; out.speedAtPop = p.speed; if (hold === 0) { r.tick({ ...sample, jumpHeld: true, jumpPressed: true }); r.tick({ ...sample, jumpHeld: true }); } sample = { ...sample, jumpHeld: false, jumpReleased: true }; }
        else if (hold > 0 && s >= pop - hold) sample = { ...sample, jumpHeld: true };
      }
      r.tick(sample);
      if (p.isBailing && !wasBailing) out.bails.push(+s.toFixed(0)); wasBailing = p.isBailing;
      if (p.freeSkate && p.grounded) out.slowest = Math.min(out.slowest, p.speed);
      if (p.totalDeaths) { out.died = true; break; }
    }
    return out;
  };
  const laneOf = knots => s => { if (s <= knots[0][0]) return knots[0][1]; for (let i = 1; i < knots.length; i++) if (s <= knots[i][0]) { const [a, la] = knots[i - 1], [b, lb] = knots[i]; return la + (lb - la) * (s - a) / (b - a); } return knots[knots.length - 1][1]; };
  {
    const out = ride(RUN2, 6, 0, () => 0, 120);
    check('Powderkeg Run: coasting down the fruit from the summit checkpoint', !out.bails.length && !out.died, `spills at ${out.bails.join(', ') || 'none'}`);
  }
  {
    // The fruit of First Tracks from its mid-run checkpoint to the shore.
    const out = ride(RUN1, 336, 1.2, laneOf([[346, 1.2], [372, 2.6], [414, 2.6], [440, -1], [456, 2.6], [469, 2.6], [489, -1], [538, 0], [554, 0]]), RUN1.length - 6);
    check('First Tracks: coasting down the fruit from the mid-run checkpoint', !out.bails.length && !out.died, `spills at ${out.bails.join(', ') || 'none'}, slowest ${out.slowest.toFixed(1)} m/s`);
  }
  for (const hold of [4, 5, 6, 8, 12, 26]) {
    const out = ride(RUN2, 550, 0, () => 0, 622, { pop: 596, hold });
    // Four metres is the least that gets across (it lands low on the apron and may spill); from five it is clean.
    check(`Powderkeg Run: the long gap from its checkpoint, the ollie held for the last ${hold} m`, !out.died && (hold < 5 || !out.bails.length), `${out.died ? 'dead' : out.bails.length ? 'over, with a spill' : 'over'}, popped at ${out.speedAtPop.toFixed(1)} m/s`);
  }
  {
    const out = ride(RUN2, 550, 0, () => 0, 622, { pop: 596, hold: 0 });
    console.log('FAIR note the long gap from its checkpoint with a bare tap:', out.died ? 'falls short (as designed)' : 'clears', `at ${out.speedAtPop.toFixed(1)} m/s`);
  }
  // The other crevasses, each from its own checkpoint (or from as far back as the last boulder allows): a tap is enough.
  for (const [path, name, s0, lat, gap] of [[RUN1, 'First Tracks 404', 336, -1.5, 404], [RUN2, 'Powderkeg Run 452', 414, 2, 452]]) {
    const out = ride(path, s0, lat, () => lat, gap + 22, { pop: gap, hold: 0 });
    check(`${name}: a tap from its checkpoint`, !out.died && !out.bails.length, `${out.died ? 'dead' : 'over'}, popped at ${out.speedAtPop.toFixed(1)} m/s`);
  }

  const failed = results.filter(q => !q.ok);
  console.log('FAIR', JSON.stringify({ cases: results.length, failed: failed.length }));
  assert.equal(failed.length, 0, `Powderkeg Peak fairness: ${failed.map(q => q.name).join('; ')}`);
}, { modulePath: '/src/levels/powderkeg-peak.ts', levelId: 'powderkeg-peak', source: m => m.POWDERKEG_PEAK_LEVEL, endlessDeaths: true, maxFrames: 400000,
  controlFrame: r => { const lane = r.p.courseInputDirection(r.l); if (lane) return lane; const zone = r.l.zoneAt(r.p.pos.x, r.p.pos.z)?.dir; return zone === 'E' || zone === 'W' ? { x: 0, z: -1 } : { x: r.p.camDir.x, z: r.p.camDir.z }; } });
