// Powderkeg Peak · the edges of the world. Each case is something a player found (or a random walker did) that must
// stay closed: ground with nothing under it, a fence that ends early, a pit that lets a masked player live at its
// bottom, a jump that falls short and flies on under the mountain, a lip that can be grabbed but never climbed.
import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r => {
  const { p, l } = r, m = r.sourceModule, { RUN1, RUN2 } = m.POWDERKEG_PATHS, PLAN = m.POWDERKEG_PLAN, dt = r.CONST.fixedStep;
  const put = (x, y, z, hx = 0, hz = -1) => p.respawn(l, true, false, { position: p.pos.clone().set(x, y + .12, z), heading: p.pos.clone().set(hx, 0, hz) });
  const at = () => `(${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)}, ${p.pos.z.toFixed(2)}) ${p.state}${p.grounded ? ' on ' + (p.groundHit?.name ?? '?') : ' in the air'}`;
  const toward = (x, z, pace = 1) => r.worldDirectionInput({ x, z }, pace);
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok }); console.log('BOUNDS', ok ? 'ok  ' : 'FAIL', name, '·', detail); };

  // 1. Beside the hoist: the pit under the deck is closed on every side but the shore. Tried with the deck up, so
  // nothing carries the walker out of it.
  const hoist = l.movers.reduce((best, q) => Math.hypot(q.mesh.position.x + 3, q.mesh.position.z - PLAN.ROW_A - 1) < Math.hypot(best.mesh.position.x + 3, best.mesh.position.z - PLAN.ROW_A - 1) ? q : best);
  for (const z of [PLAN.ROW_A + 2.6, PLAN.ROW_A + 3.1, PLAN.ROW_A - 1.2]) {
    put(20, PLAN.TARN_Y, -575);
    for (let i = 0, prev = hoist.mesh.position.y; i < 1200; i++) { r.tick({}); const y = hoist.mesh.position.y; if (y > PLAN.TARN_Y + 4 && y < PLAN.TARN_Y + 8 && y > prev) break; prev = y; }
    put(-1.7, PLAN.TARN_Y - .62, z, 1, 0); for (let i = 0; i < 12; i++) r.tick({});
    const north = z < PLAN.ROW_A;
    for (let i = 0; i < 130; i++) r.tick(north ? toward(0, -1) : toward(1, 0));
    for (let i = 0; i < 60 && !p.totalDeaths; i++) r.tick({});
    check(`walking ${north ? 'north' : 'east'} out of the hoist pit from z ${z}`, !p.totalDeaths && p.pos.y > PLAN.TARN_Y - 1.5 && p.pos.x < -.8 && p.pos.z > PLAN.ROW_A - 2, at());
  }

  // 2. Both runs are fenced to their last metre: walking off the piste just before the tarn or the works yard is stopped.
  for (const [path, name] of [[RUN1, 'First Tracks'], [RUN2, 'Powderkeg Run']]) for (const side of [-1, 1]) for (const back of [.8, 1.6, 2.6, 3.6]) {
    const q = path.w(path.length - back, side * 6.5), f = path.at(path.length - back);
    put(q[0], q[1] + .4, q[2], f.fx, f.fz); for (let i = 0; i < 20; i++) r.tick({});
    for (let i = 0; i < 150; i++) r.tick(toward(f.rx * side, f.rz * side));
    const lat = path.nearest(p.pos.x, p.pos.z, 80)?.lat ?? 99;
    check(`${name}, ${side < 0 ? 'left' : 'right'} bank, ${back} m before its end`, Math.abs(lat) < 9.2 && !p.totalDeaths, `lateral ${lat.toFixed(1)} ${at()}`);
  }

  // 3. A pit is a pit with a mask on too: nobody is left standing at the bottom, and nobody falls for long.
  const falls = [
    ['the half crevasse', -3, 2.5, -70.2, 0, -1], ['the first crevasse', 2, 2.5, -84.2, 0, -1], ['the second crevasse', -2, 5, -115.2, 0, -1],
    ['the pillar field', 3.5, 7, -150.2, 0, -1], ['a gap in the lower row', 37.4, 7, PLAN.ROW_A, 1, 0], ['a gap in the upper row', 29.9, 21.8, PLAN.ROW_B - .6, -1, 0],
    ['a gap in the Old Adit', PLAN.CAVE_X + 9.4, 0, PLAN.CAVE_Z, 1, 0],
  ];
  for (const [name, x, y, z, hx, hz] of falls) for (const masks of [0, 2]) {
    put(x, y, z, hx, hz); p.masks = masks; let seconds = null, lowest = y;
    for (let i = 0; i < 480; i++) { r.tick(toward(hx, hz, i < 70 ? 1 : 0)); lowest = Math.min(lowest, p.pos.y); if (p.totalDeaths) { seconds = i * dt; break; } }
    check(`falling into ${name} with ${masks} masks`, seconds !== null && seconds < 3.2 && lowest > y - 17, seconds === null ? `still alive after 8 s at ${at()}` : `dead after ${seconds.toFixed(1)} s, ${(y - lowest).toFixed(1)} m down`);
  }
  // [run, name, near lip, far lip, lane, run-up: each starts past the last boulder or box before its crevasse]
  const GAPS = [[RUN1, 'First Tracks', 404, 410, -1.5, 46], [RUN2, 'Powderkeg Run', 244, 253, 0, 34], [RUN2, 'Powderkeg Run', 452, 461, 2, 36], [RUN2, 'Powderkeg Run', 596, 606, 0, 46]];
  for (const [path, name, a, b, lat] of GAPS) for (const masks of [0, 2]) {
    const q = path.w(a - 4, lat), f = path.at(a), y0 = q[1];
    put(q[0], q[1] + .3, q[2], f.fx, f.fz); p.masks = masks; let seconds = null, lowest = y0;
    for (let i = 0; i < 480; i++) { r.tick(toward(f.fx, f.fz, i < 80 ? 1 : 0)); lowest = Math.min(lowest, p.pos.y); if (p.totalDeaths) { seconds = i * dt; break; } }
    check(`walking into the crevasse at ${name} ${a} with ${masks} masks`, seconds !== null && seconds < 3.4 && lowest > y0 - 17, seconds === null ? `still alive after 8 s at ${at()}` : `dead after ${seconds.toFixed(1)} s, ${(y0 - lowest).toFixed(1)} m down`);
  }

  // 4. A jump that falls short of a crevasse's far lip ends in the crevasse, or on the snow: never under the mountain.
  // On the board, a tap ollie from several distances before the lip (and none at all); on foot, a running double jump.
  const under = (path) => { const q = path.nearest(p.pos.x, p.pos.z, 60); return q ? p.pos.y - path.elev(q.s) : -99; };
  for (const [path, name, a, b, lat, runUp] of GAPS) {
    for (const pop of [null, 14, 9, 6, 3.5, 1.5, .4]) {
      const q = path.w(a - runUp, lat), f = path.at(a);
      put(q[0], m.POWDERKEG_MOUNTAIN.y(q[0], q[2]), q[2], f.fx, f.fz); p.masks = 0;
      const aim = () => { const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? a, t = path.w(s + 9, lat); return toward(t[0] - p.pos.x, t[2] - p.pos.z); };
      for (let i = 0; i < 400 && !p.freeSkate; i++) r.tick({ ...aim(), jumpHeld: true });
      let popped = pop === null, lowest = 0, died = false, frames = 0, speed = 0;
      for (let i = 0; i < 900; i++) {
        const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? 0; let sample = p.grounded ? aim() : {};
        if (!popped && p.grounded && s >= a - pop) { popped = true; speed = p.speed; r.tick({ ...sample, jumpHeld: true, jumpPressed: true }); r.tick({ ...sample, jumpHeld: true }); sample = { ...sample, jumpHeld: false, jumpReleased: true }; }
        r.tick(sample); lowest = Math.min(lowest, under(path));
        if (p.totalDeaths) { died = true; break; }
        if (s > b + 2 && p.grounded && ++frames > 40) break;
      }
      const rel = under(path);
      const s1 = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? 0;
      check(`${name} ${a}: on the board, ${pop === null ? 'no jump' : `a tap ${pop} m before the lip`}`, s1 > a - 1 && lowest > -14 && (died || (p.grounded && rel > -.6)),
        `${died ? 'dead' : 'alive'}, lowest ${lowest.toFixed(1)} m under the snow${speed ? `, popped at ${speed.toFixed(1)} m/s` : ''}, ends ${at()}`);
    }
    {
      const q = path.w(a - 7, lat), f = path.at(a);
      put(q[0], m.POWDERKEG_MOUNTAIN.y(q[0], q[2]), q[2], f.fx, f.fz); p.masks = 0;
      const go = () => toward(f.fx, f.fz); let lowest = 0, died = false, doubled = false, leapt = false, hung = 0, frames = 0;
      for (let i = 0; i < 700; i++) {
        const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? 0; let sample = go();
        if (!leapt && s >= a - .5) { leapt = true; sample = { ...sample, jumpHeld: true, jumpPressed: true }; }
        else if (leapt && !doubled && !p.grounded && p.vVel < 1.5) { doubled = true; sample = { ...sample, jumpHeld: true, jumpPressed: true }; }
        else if (leapt && !p.grounded) sample = { ...sample, jumpHeld: true };
        if (p.state === 'hang') { hung++; sample = { ...go(), jumpHeld: hung % 20 < 10, jumpPressed: hung % 20 === 1 }; }
        r.tick(sample); lowest = Math.min(lowest, under(path));
        if (p.totalDeaths) { died = true; break; }
        if (s > b + 1.5 && p.grounded && ++frames > 40) break;
      }
      const rel = under(path);
      check(`${name} ${a}: on foot, a running double jump at the far lip`, lowest > -14 && (died || (p.grounded && rel > -.6)), `${died ? 'dead' : 'alive'}${hung ? ', grabbed the lip' : ''}, lowest ${lowest.toFixed(1)} m under the snow, ends ${at()}`);
    }
    // Arriving at the far lip from the air at several heights: over it, onto it, hanging from it, or into the pit.
    for (const drop of [.5, .1, -.3, -.7, -1.2, -2]) {
      const q = path.w(b - 1.1, lat), f = path.at(b);
      put(q[0], path.elev(b) + drop, q[2], f.fx, f.fz); p.masks = 0;
      let lowest = 0, died = false, hung = 0, frames = 0;
      for (let i = 0; i < 500; i++) {
        const s = path.nearest(p.pos.x, p.pos.z, 60)?.s ?? 0; let sample = toward(f.fx, f.fz);
        if (p.state === 'hang') { hung++; sample = { ...sample, jumpHeld: hung % 20 < 10, jumpPressed: hung % 20 === 1 }; }
        r.tick(sample); lowest = Math.min(lowest, under(path));
        if (p.totalDeaths) { died = true; break; }
        if (s > b + 1.5 && p.grounded && ++frames > 40) break;
      }
      const rel = under(path);
      check(`${name} ${a}: on foot, reaching the far lip ${drop >= 0 ? drop + ' m above' : -drop + ' m below'} it`, lowest > -14 && (died || (p.grounded && rel > -.6)), `${died ? 'dead' : 'alive'}${hung ? ', grabbed the lip' : ''}, lowest ${lowest.toFixed(1)} m under the snow, ends ${at()}`);
    }
  }

  // 5. The east landing is left two ways only: west along the upper row, or back down the buttress it was reached from.
  // (Its balcony stands over the far bank; the landing proper lies behind it, between the rows.)
  for (const [name, x, z, hx, hz] of [['west off the balcony', 88.8, PLAN.ROW_A + .4, -1, 0], ['west across the landing proper', 85, PLAN.ROW_A - 4, -1, 0],
    ['east across the landing proper', 85, PLAN.ROW_A - 4, 1, 0], ['south off the landing proper', 83.5, PLAN.ROW_A - 4, 0, 1]]) {
    put(x, PLAN.B0_Y, z, hx, hz); for (let i = 0; i < 12; i++) r.tick({});
    for (let i = 0; i < 240 && !p.totalDeaths; i++) r.tick(toward(hx, hz));
    check(`walking ${name} of the east landing`, !p.totalDeaths && p.pos.y > PLAN.B0_Y - .2 && p.pos.x > 80 && p.pos.x < 90.2, at());
  }

  // 6. No lip that can be grabbed and never climbed: off the end of the second buttress tier, and in a gap of the upper row.
  const hangs = [['the wall behind the buttress tiers', 100.4, 14.6, -606.6, 103, -607.9, true], ['the wall top below the upper row', 29.9, 21.8, PLAN.ROW_B - .2, 27.4, PLAN.ROW_B + 2.2, false]];
  for (const [name, x, y, z, ax, az, leap] of hangs) {
    put(x, y, z, Math.sign(ax - x), 0); for (let i = 0; i < 20; i++) r.tick({});
    if (leap) for (let i = 0; i < 20; i++) r.tick({ ...toward(ax - p.pos.x, az - p.pos.z), jumpHeld: true });
    let doubled = false, hung = false;
    for (let i = 0; i < 300 && !p.totalDeaths; i++) {
      const s = { ...toward(ax - p.pos.x, az - p.pos.z) }; if (leap && i === 0) { s.jumpHeld = false; s.jumpReleased = true; }
      if (leap && !doubled && !p.grounded && p.vVel < 1.5) { doubled = true; s.jumpHeld = true; s.jumpPressed = true; }
      r.tick(s); if (p.state === 'hang') hung = true;
    }
    check(`no hang on ${name}`, !hung, at());
  }

  const failed = results.filter(q => !q.ok);
  console.log('BOUNDS', JSON.stringify({ cases: results.length, failed: failed.length }));
  assert.equal(failed.length, 0, `Powderkeg Peak bounds: ${failed.map(q => q.name).join('; ')}`);
}, { modulePath: '/src/levels/powderkeg-peak.ts', levelId: 'powderkeg-peak', source: m => m.POWDERKEG_PEAK_LEVEL, endlessDeaths: true, maxFrames: 400000,
  controlFrame: r => { const lane = r.p.courseInputDirection(r.l); if (lane) return lane; const zone = r.l.zoneAt(r.p.pos.x, r.p.pos.z)?.dir; return zone === 'E' || zone === 'W' ? { x: 0, z: -1 } : { x: r.p.camDir.x, z: r.p.camDir.z }; } });
