// Device-input pilot shared by the Node production-controller check and the
// browser smoke test. It never writes position, velocity, tuning or level state.
export function createSlipstream2Pilot(source, options = {}) {
  const { SLIPSTREAM_2_LEVEL: data, SLIPSTREAM_2_GAPS: gaps, SLIPSTREAM_2_END: end,
    slipstream2Point: point, slipstream2Progress: progress } = source;
  const line = source.slipstream2Line ?? point;
  const ordered = data.components.filter(c => c.t === 'camnode' && !c.cameraView).map(c => c.p);
  const start = point(0), startIndex = ordered.findIndex(p => p.every((v, i) => Math.abs(v - start[i]) < .001));
  const temple = ordered.slice(1, startIndex);
  const evidence = { temple: [], jumps: [], checkpoints: [], mountedFrames: 0, maxSpeed: 0, highRailFrames: 0, crystal: false };
  let index = 0, counter = 0, phase = 'temple settle', activeGap = null, airSeen = false, frame = 0;
  const targetMover = l => {
    const q = temple[index];
    return q && l.movers.find(m => Math.hypot(m.base.x - q[0], m.base.y + m.mesh.geometry.parameters.height / 2 - q[1]) < .05);
  };
  const target = (p, l) => {
    const q = temple[index];
    if (!q) return null;
    const mover = targetMover(l);
    return mover ? [mover.mesh.position.x, q[1], mover.mesh.position.z] : q;
  };
  const direction = (p, l, q, pace = 1) => {
    const dx = q[0] - p.pos.x, dz = q[2] - p.pos.z, d = Math.hypot(dx, dz);
    if (d < .025) return {};
    const f = p.courseInputDirection(l) ?? { x: p.camDir.x, z: p.camDir.z };
    return { moveX: (dx * -f.z + dz * f.x) / d * pace, moveY: (dx * f.x + dz * f.z) / d * pace };
  };
  const snapshot = p => ({ phase, frame, position: p.pos.toArray(), speed: p.speed, up: p.vVel, grounded: p.grounded, state: p.state });
  return {
    evidence,
    get templeCount() { return temple.length; },
    get phase() { return phase; },
    sample(p, l) {
      if (options.nodeCamera) {
        const camera = l.cameraDirAt(p.pos.x, p.pos.y, p.pos.z);
        if (camera) p.camDir.set(camera.x, 0, camera.z);
      }
      if (p.isBailing || ['dead', 'gameover'].includes(p.state)) throw Error('Slipstream 2 pilot lost control: ' + JSON.stringify(snapshot(p)));
      if (phase.startsWith('temple')) {
        const q = target(p, l), d = q && Math.hypot(q[0] - p.pos.x, q[2] - p.pos.z);
        if (!q) { phase = 'skate'; return { ...direction(p, l, point(12)), jumpHeld: true }; }
        if (phase === 'temple settle') {
          if (++counter < 22) return {};
          counter = 0;
          phase = q[1] > p.pos.y + .5 ? 'temple charge' : 'temple walk';
        }
        if (phase === 'temple charge') {
          if (++counter <= 27) return { jumpHeld: true };
          const mover = targetMover(l);
          const futureZ = mover ? mover.base.z + Math.sin((l.time + .52) * mover.speed + mover.phase) * mover.amp : q[2];
          if (Math.hypot(q[0] - p.pos.x, futureZ - p.pos.z) > 5.25 || d > 5.4) return { jumpHeld: true };
          if (mover && Math.cos((l.time + .52) * mover.speed + mover.phase) < .25) return { jumpHeld: true };
          counter = 0; phase = 'temple air'; airSeen = false;
          return { ...direction(p, l, q), jumpReleased: true };
        }
        if (phase === 'temple walk') {
          if (d < .18) {
            evidence.temple.push({ index, moving: false, landing: p.pos.toArray(), frame });
            index++; counter = 0; phase = 'temple settle'; return {};
          }
          return direction(p, l, q, Math.min(.45, .12 + d / 5));
        }
        if (phase === 'temple centre') {
          if (d < .18) { index++; counter = 0; phase = 'temple settle'; return {}; }
          return { ...direction(p, l, q, Math.min(.35, .1 + d / 5)), spinHeld: frame % 25 === 0 };
        }
        if (phase === 'temple air') return direction(p, l, q, Math.min(1, d / .8));
      }
      const s = progress(p.pos);
      if (options.highRoute && s > 246 && s < 374) {
        phase = 'high route';
        if (p.state === 'grind') return { jumpHeld: true, grindHeld: true, moveX: Math.max(-1, Math.min(1, -p.balance * 5 - p.balanceVel * .7)) };
        const q = Math.min(374, s + 6), fork = q > 258 && q < 374 ? 8 * Math.sin(Math.PI * (q - 258) / 116) ** 2 : 0;
        return { ...direction(p, l, point(q, -2 * fork, fork * .4)), jumpHeld: true, grindHeld: s > 272 && s < 346 };
      }
      if (activeGap) {
        if (!p.grounded) return {};
        if (s > activeGap.b) {
          evidence.jumps.push({ name: activeGap.name, width: activeGap.width, takeoff: activeGap.takeoff,
            landing: p.pos.toArray(), landingSpeed: p.speed, airSeen });
          activeGap = null; airSeen = false;
        }
      }
      const next = gaps.find(g => s < g.b);
      if (next && p.grounded && s >= next.a - 7.75 && s < next.a - 6) {
        activeGap = { ...next, takeoff: { position: p.pos.toArray(), speed: p.speed, station: s, frame } };
        phase = next.name + ' flight'; return { jumpReleased: true };
      }
      phase = next ? next.name + ' approach' : 'finish';
      return { ...direction(p, l, line(Math.min(end, s + 7))), jumpHeld: true };
    },
    observe(p, l) {
      frame++; evidence.maxSpeed = Math.max(evidence.maxSpeed, Math.abs(p.speed));
      if (phase === 'high route' && p.state === 'grind') evidence.highRailFrames++;
      evidence.crystal ||= p.hasCrystal;
      if (p.freeSkate) evidence.mountedFrames++;
      if (phase === 'temple air') {
        if (!p.grounded) airSeen = true;
        else if (airSeen) {
          const q = target(p, l);
          if (Math.abs(p.pos.y - q[1]) > .15) throw Error('Temple jump landed on the wrong tier: ' + JSON.stringify(snapshot(p)));
          evidence.temple.push({ index, moving: p.groundHit?.moverId !== undefined, landing: p.pos.toArray(), frame });
          counter = 0; phase = 'temple centre'; airSeen = false;
        }
      }
      if (phase.startsWith('temple') && (p.freeSkate || p.airFromSkate)) throw Error('Temple pilot unexpectedly required skating');
      if (activeGap && !p.grounded) airSeen = true;
      for (let i = 0; i < l.checkpoints.length; i++) if (l.checkpoints[i].active && !evidence.checkpoints.includes(i)) evidence.checkpoints.push(i);
      if (frame > 16000) throw Error('Slipstream 2 pilot exceeded its device-input budget: ' + JSON.stringify(snapshot(p)));
    },
  };
}
