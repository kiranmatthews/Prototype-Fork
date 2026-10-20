import { createSlipstream2Pilot } from './slipstream-2-pilot.mjs';

// Input-only route driver, shared by native and real-browser validation.
export function createContinuousPilot(source, reservoir, options = {}) {
  const off = source.SLIPSTREAM_OFFSETS;
  const shift = (p, o) => p.map((n, i) => n + o[i]);
  const point2 = (s, u = 0, h = 0) => shift(reservoir.slipstream2Point(s, u, h), off.reservoir);
  const sequel = createSlipstream2Pilot({ ...reservoir,
    SLIPSTREAM_2_LEVEL: { ...reservoir.SLIPSTREAM_2_LEVEL, components: reservoir.SLIPSTREAM_2_LEVEL.components
      .filter(c => c.t !== 'camnode' || c.p[2] <= -32).map(c => ({ ...c, p: shift(c.p, off.reservoir) })) },
    slipstream2Point: point2,
    slipstream2Line: s => shift(reservoir.slipstream2Line(s), off.reservoir),
    slipstream2Progress: p => -p.z - 930,
  }, { highRoute: options.highRoute });
  let phase = 'sky ribbon', firstReleased = false, chimeReleased = false, finalReleased = false;
  let step = 0, count = 0, aired = false, footPhase = 'walk', braking = false, frame = 0;
  const evidence = { phases: [], checkpoints: [], jumps: [], reservoir: sequel.evidence, footLandings: [], maxSpeed: 0 };
  const target = { x: 0, y: 0, z: 0, set(x,y,z) { this.x=x;this.y=y;this.z=z;return this; }, copy(p) { return this.set(p.x,p.y,p.z); }, lerp(p,t) { this.x+=(p.x-this.x)*t;this.y+=(p.y-this.y)*t;this.z+=(p.z-this.z)*t;return this; } };
  const direction = (p, l, q, pace = 1) => {
    const dx = q[0] - p.pos.x, dz = q[2] - p.pos.z, d = Math.hypot(dx, dz) || 1;
    const f = p.courseInputDirection(l) ?? p.camDir;
    return { moveX: (dx * -f.z + dz * f.x) / d * pace, moveY: (dx * f.x + dz * f.z) / d * pace };
  };
  const lane = (p, l) => {
    const cursor = { s: p.laneCursor.s };
    l.laneDirAt(p.pos.x, p.pos.y, p.pos.z, cursor);
    l.cameraLanePointAhead(cursor, 7, target);
    return direction(p, l, [target.x, target.y, target.z]);
  };
  const snap = p => ({ phase, frame, p: p.pos.toArray(), speed: p.speed, state: p.state, grounded: p.grounded, step, footPhase });
  const footSteps = [
    ...Array.from({ length: 7 }, (_, i) => ({ takeoff: i ? -244 - (i - 1) * 10 - 3.15 : -237.65,
      landing: -244 - i * 10, y: 26.3 + i * .4 })),
    { takeoff: -307.15, landing: -313, y: 29 },
    ...Array.from({ length: 3 }, (_, i) => ({ takeoff: i ? -382 - (i - 1) * 10 - 3.1 : -375.65,
      landing: -382 - i * 10, y: 29 })),
    { takeoff: -405.15, landing: -412, y: 28 },
  ];
  return {
    evidence, get phase() { return phase; },
    sample(p, l) {
      if (options.nodeCamera) {
        const dir = l.cameraDirAt(p.pos.x, p.pos.y, p.pos.z, { s: p.laneCursor.s });
        if (dir) p.camDir.set(dir.x, 0, dir.z);
      }
      if (p.isBailing || ['dead','gameover'].includes(p.state)) throw Error('Continuous pilot lost control: ' + JSON.stringify(snap(p)));
      const z = p.pos.z, cz = z - off.chimeworks[2];
      if (z > -930) {
        phase = z < -814 ? 'reservoir causeway' : 'sky ribbon';
        if (!firstReleased && z <= -735 && p.grounded) { firstReleased = true; evidence.jumps.push(snap(p)); return {}; }
        if (firstReleased && !p.grounded) return {};
        return { ...lane(p,l), jumpHeld: true };
      }
      if (z > -1828) { phase = 'reservoir'; return sequel.sample(p,l); }
      if (cz > -214) {
        phase = cz > 24 ? 'brass promenade' : 'chimeworks overture';
        if (!chimeReleased && cz <= -156.5 && p.grounded) { chimeReleased = true; evidence.jumps.push(snap(p)); return {}; }
        if (chimeReleased && !p.grounded) return {};
        return { ...lane(p,l), jumpHeld: true, grabHeld: cz < -80 && p.speed > 23 };
      }
      if (phase !== 'keys' && phase !== 'crescendo' && phase !== 'final chord') {
        phase = 'brake for keys';
        if (p.freeSkate) return { moveY: -1 };
        phase = 'keys'; footPhase = 'walk';
      }
      if (phase === 'keys') {
        const next = footSteps[step];
        if (!next) {
          if (cz > -430) return { ...direction(p,l,shift([18,28,-431],off.chimeworks)), spinHeld: frame % 32 < 12 };
          phase = 'crescendo'; return { ...lane(p,l), jumpHeld: true };
        }
        const q = shift([18, next.y, footPhase === 'air' ? next.landing : next.takeoff], off.chimeworks);
        const d = Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
        if (footPhase === 'walk') {
          if (d > .15) return { ...direction(p,l,q,Math.min(.9,.3+d/1.5)), spinHeld: (step === 0 || step === 8) && frame % 32 < 12 };
          footPhase = 'charge'; count = 0;
        }
        if (footPhase === 'charge') {
          if (++count <= 27) return { jumpHeld: true };
          footPhase = 'air'; aired = false;
          return { ...direction(p,l,shift([18,next.y,next.landing],off.chimeworks)), jumpReleased: true };
        }
        return direction(p,l,q,Math.min(1,d/.7));
      }
      phase = cz < -620 ? 'final chord' : 'crescendo';
      if (!finalReleased && cz <= -613 && p.grounded) { finalReleased = true; evidence.jumps.push(snap(p)); return {}; }
      if (finalReleased && !p.grounded) return {};
      if (cz <= -645 && p.grounded) return direction(p,l,shift([14,5,-658],off.chimeworks));
      if (p.speed > 28) braking = true; else if (p.speed < 25) braking = false;
      return { ...lane(p,l), jumpHeld: true, grabHeld: braking, spinHeld: cz > -435 && frame % 32 < 12 };
    },
    observe(p,l) {
      frame++; evidence.maxSpeed = Math.max(evidence.maxSpeed, p.speed);
      if (evidence.phases.at(-1)?.name !== phase) evidence.phases.push({ name: phase, frame, p: p.pos.toArray() });
      if (phase === 'reservoir') sequel.observe(p,l);
      if (phase === 'keys' && footPhase === 'air') {
        if (!p.grounded) aired = true;
        else if (aired) {
          const next = footSteps[step], y = next.y + off.chimeworks[1];
          if (Math.abs(p.pos.y-y) > .3) throw Error('Wrong key landing: '+JSON.stringify(snap(p)));
          evidence.footLandings.push(snap(p)); step++; footPhase = 'walk';
        }
      }
      for (let i=0;i<l.checkpoints.length;i++) if(l.checkpoints[i].active && !evidence.checkpoints.includes(i)) evidence.checkpoints.push(i);
      if (frame > 24000) throw Error('Continuous pilot timed out: '+JSON.stringify(snap(p)));
    },
  };
}
