const takeoffPoints = {
  hip: 0.475,
  stairs: 0.475,
  spill: 0.475,
  flip: 0.475,
  rebound: 0.125,
  ferry: 0.22,
  crumble: 0.5,
  tide: 0.5,
};

/** QA pilot. Every yield is a device input for one production physics step. */
export function* runStreet(r, mode = 'skate') {
  const { p, l, trial, lanePoint, report } = r,
    line = trial.line,
    originZ = r.offset?.[2] ?? 0;
  const startDeaths = p.totalDeaths,
    beats = (report.beats = []);
  let stage = '',
    grindFrames = 0,
    airFrames = 0;
  function requireRoute(value, message) {
    if (!value) throw Error(message);
  }
  const dist = () => originZ - p.pos.z;
  const towards = (x, d) => {
    const dx = x - p.pos.x,
      dy = d - dist(),
      n = Math.hypot(dx, dy) || 1;
    return { moveX: dx / n, moveY: dy / n };
  };
  function* walkTo([x, d]) {
    for (let i = 0; i < 6000; i++) {
      if (Math.hypot(x - p.pos.x, d - dist()) < 0.65 || p.state === 'finished') return;
      yield { ...towards(x, d), spinHeld: dist() > -34 && dist() < -29 };
    }
    throw Error(`Cannot reach ${x},${d}`);
  }
  for (let i = 0; i < (r.waitFrames ?? 0); i++) yield {};
  const end = line.spans[line.spans.length - 1][1];
  if (mode === 'walk') {
    stage = report.stage = 'walk the lower concourse';
    yield* walkTo([0, -32]);
    for (const mark of line.walk) yield* walkTo(mark);
    stage = report.stage = 'walk through the crystal';
    yield* walkTo([end[0], end[1] + 25]);
    stage = report.stage = 'walk off the terrace';
    for (const mark of [
      [end[0], end[1] + 34],
      [end[0], end[1] + 40],
      [0, end[1] + 70],
      [0, end[1] + 89],
    ])
      yield* walkTo(mark);
  } else {
    let a = [0, 0, 0];
    for (const [index, [kind, b, bow]] of line.spans.entries()) {
      const span = b[1] - a[1],
        hand = Math.sign(bow) || line.side;
      stage = report.stage = `${index + 1} ${kind}`;
      const started = r.frame,
        railStart = grindFrames,
        airStart = airFrames,
        springStart = p.trampolineLaunchId;
      const contacts = new Set();
      let popped = false,
        flipped = false,
        second = false,
        transferRelease = false,
        rearmAt = -1;
      let sideTakeoff;
      const rail = ['rail', 'relay', 'cable'].includes(kind);
      const firstSill =
        kind === 'tide' &&
        l.phasePads.find((pad) => Math.abs(pad.mesh.position.z - (originZ - a[1] - span * 0.465)) < 1);

      while (dist() < b[1] && r.frame - started < 1450) {
        const t = (dist() - a[1]) / span;
        if (firstSill && sideTakeoff === undefined && t > 0.025) {
          const toSill = (Math.max(0, 0.36 - t) * span) / Math.max(12, p.speed);
          const atSill = ((l.time + toSill) / firstSill.cycle + firstSill.phase) % 1;
          const timeOnSill = (0.17 * span) / Math.max(12, p.speed);
          sideTakeoff = atSill + timeOnSill / firstSill.cycle >= firstSill.duty;
        }
        const takeoff = ['hip', 'stairs', 'spill', 'flip'].includes(kind) && t > 0.26 && t < 0.53;
        const ahead = takeoff ? 14 : 7,
          nextDistance = dist() + ahead;
        const look = Math.max(0, Math.min(1, (nextDistance - a[1]) / span));
        let offset = 0;
        if (kind === 'fork' || kind === 'switch')
          offset = hand * 5.8 * Math.sin(Math.PI * Math.max(0, Math.min(1, (look - 0.13) / 0.79))) ** 2;
        if (sideTakeoff) offset = hand * 2.4 * Math.sin(Math.PI * look);
        if (kind === 'patrol') offset = hand * (look < 0.57 ? -1.8 : 1.8);
        if (kind === 'sweep') offset = hand * (look < 0.58 ? 1.9 : -1.9);
        if (kind === 'relay' && second) offset = hand * 2.4 * Math.max(0, 1 - (look - 0.66) / 0.31);
        let target = lanePoint(a, b, bow, look, offset);
        if (nextDistance > b[1]) {
          const next = line.spans[index + 1];
          target = next
            ? lanePoint(b, next[1], next[2], Math.min(1, (nextDistance - b[1]) / (next[1][1] - b[1])))
            : [b[0], nextDistance, b[2]];
        }
        let input = dist() < 0 ? towards(0, 0) : towards(target[0], Math.max(target[1], dist() + 1.2));
        const popAt = sideTakeoff ? 0.435 : rail ? 0.205 : (takeoffPoints[kind] ?? -1);
        input.jumpHeld =
          dist() < -21 ||
          (popAt > 0 &&
            !popped &&
            !(rail && flipped) &&
            t >= popAt - Math.max(7, p.speed * 0.56) / span &&
            t <= popAt + 0.1);
        if (p.state === 'grind') {
          input = {
            moveY: 1,
            moveX: Math.max(-1, Math.min(1, -p.balance * 5 - p.balanceVel * 0.65)),
            grindHeld: true,
            jumpHeld: true,
          };
          if (kind === 'relay' && !second && t > 0.56) {
            if (!transferRelease) {
              input.moveX = hand;
              transferRelease = true;
            } else {
              input.moveX = hand;
              input.jumpHeld = false;
              input.grindHeld = false;
              second = true;
              rearmAt = r.frame + 2;
            }
          } else if (t > 0.83 && !popped) {
            input.jumpHeld = false;
            input.grindHeld = false;
            popped = true;
          }
        } else if (rail) {
          input.grindHeld =
            !popped &&
            !p.grounded &&
            r.frame >= rearmAt &&
            t > 0.16 &&
            t < (kind === 'relay' && second ? 0.935 : 0.83);
          if (t > 0.205 && !flipped && p.grounded) {
            input.jumpHeld = false;
            flipped = true;
          }
        } else if (['hip', 'stairs', 'spill', 'flip'].includes(kind) && t > 0.475 && !popped && p.grounded) {
          input.jumpHeld = false;
          popped = true;
        } else if (kind === 'rebound' && t > 0.125 && !popped && p.grounded) {
          input.jumpHeld = false;
          popped = true;
        } else if (kind === 'flip' && t > 0.38 && !flipped && p.state === 'air' && p.airFromSkate) {
          input = { spinHeld: true, spinPressed: true, moveX: 0, moveY: 0 };
          flipped = true;
        } else if (['crumble', 'ferry', 'tide'].includes(kind) && t > popAt && !popped && p.grounded) {
          input.jumpHeld = false;
          popped = true;
        }
        if (!p.grounded && p.state !== 'grind' && !input.spinHeld) {
          input.moveX = 0;
          input.moveY = 1;
        }
        yield input;
        if (p.grindRail) contacts.add(l.rails.indexOf(p.grindRail));
        if (p.state === 'grind') grindFrames++;
        if (!p.grounded) airFrames++;
        requireRoute(!p.isBailing && p.totalDeaths === startDeaths, `Bailed during ${stage}`);
        if (dist() > a[1] + 2 && p.pos.y < Math.min(a[2], b[2]) - 3.3) throw Error('Missed the upper line');
      }
      requireRoute(dist() >= b[1], 'Stalled');
      beats.push({
        kind,
        ...(firstSill ? { sideTakeoff } : {}),
        seconds: (r.frame - started) / 60,
        air: airFrames - airStart,
        grind: grindFrames - railStart,
        railContacts: [...contacts],
        springs: p.trampolineLaunchId - springStart,
      });
      a = b;
    }
    stage = report.stage = 'collect and finish';
    for (const [x, d] of [
      [end[0], end[1] + 26],
      [end[0], end[1] + 39],
      [0, end[1] + 70],
      [0, end[1] + 92],
    ]) {
      for (let i = 0; dist() < d && p.state !== 'finished' && i < 360; i++)
        yield towards(x, Math.min(d, dist() + 7));
    }
  }
  return beats;
}
