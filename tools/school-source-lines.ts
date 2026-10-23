import { schoolSourcePoint, SCHOOL_SOURCE_SCALE } from '../src/levels/school-source';

type Point = [number, number, number];
type Place = (original: Point, heading: Point, speed?: number) => void;
export type SourceTrial = {
  name: string; limit: number; result: { air: number; verts: number; grinds: number; peak: number };
  init: () => void; sample: (frame: number) => any; observe: (frame: number) => boolean;
};

/** Feature placements only initialize a case; all subsequent movement uses
 * native controls, without changing positions, velocities or tuning. */
export function schoolSourceTrials(p: any, level: any, place: Place): SourceTrial[] {
  const trials: SourceTrial[] = [];
  function add(name: string, init: () => void, sample: (n: number) => any, done: (frame: number, r: SourceTrial['result']) => boolean, limit = 480) {
    const result = { air: 0, verts: 0, grinds: 0, peak: -Infinity };
    trials.push({ name, limit, result, init: () => { result.air = result.verts = result.grinds = 0; result.peak = -Infinity; init(); }, sample,
      observe: frame => {
        result.air += p.state === 'air' ? 1 : 0; result.verts += p.vertAir ? 1 : 0; result.grinds += p.state === 'grind' ? 1 : 0;
        result.peak = Math.max(result.peak, p.pos.y); return done(frame, result);
      },
    });
  }
  add('Original canopy start', () => p.respawn(level, true), () => ({ moveY: 1 }), frame => frame >= 121 && p.grounded && p.pos.x > 15 && Math.abs(p.pos.z) < .2);
  for (const [name, x, heading] of [['west', -16800, [1, 0, 0]], ['east', -13500, [-1, 0, 0]]] as [string, number, Point][]) {
    const toe = name === 'west' ? -17279 : -13065;
    const toeX = schoolSourcePoint(toe, 1599, 11000)[0];
    let nearest = Infinity, released = false;
    add(`Original ${name} gym toe blocks`, () => { nearest = Infinity; place([x, 1630, 11000], heading, 6); }, () => ({}), frame => {
      const distance = (toeX - p.pos.x) * heading[0]; nearest = Math.min(nearest, distance);
      if (distance <= .25) throw Error('Passed through the raised toe');
      return frame >= 101 && nearest < .85 && p.grounded;
    }, 180);
    add(`Original ${name} gym ollie and return`, () => { released = false; place([toe + heading[0] * 14 / SCHOOL_SOURCE_SCALE, 1630, 11000], heading, 10); }, n => {
      const release = !released && (toeX - p.pos.x) * heading[0] < 5.5;
      if (release) released = true;
      return { jumpHeld: !released, jumpPressed: n === 0, jumpReleased: release };
    }, (_frame, r) => r.air > 0 && r.peak > 2.3 && p.grounded && p.pos.y < .1 && (p.pos.x - toeX) * heading[0] < -3, 1000);
  }
  for (const [name, original, heading] of [['rectangular pool', [4200, -390, -1700], [1, 0, 0]], ['oval pool', [9400, -470, -2200], [-1, 0, 0]]] as [string, Point, Point][])
    add(`Original ${name} vert return`, () => place(original, heading, 18), n => ({ jumpHeld: true, jumpPressed: n === 0 }), (_frame, r) => r.verts > 0 && p.grounded && p.rideNormal.y > .98 && p.pos.y < -26.8, 900);
  add('Existing charged flat ollie height', () => place([-15000, 1630, 13000], [0, 0, -1], 0), n => ({ jumpHeld: n < 30, jumpPressed: n === 0, jumpReleased: n === 30 }), (_frame, r) => r.air > 0 && p.grounded);
  return trials;
}

/** The same cases run through the rendered game's ordinary gamepad input. */
export function runSchoolSourceBrowserChecks(game: any) {
  const p = game.player, level = game.getLevel(), input = game.input;
  const oldStep = p.step, oldPoll = input.pollGamepad, update = input.update.bind(input);
  const report: any = { running: true, stage: '', passed: [], failure: null, frames: 0, tuningBefore: JSON.stringify(game.TUNING) };
  const place: Place = (original, heading, speed = 0) => {
    p.respawn(level, true, true, { position: p.pos.clone().set(...schoolSourcePoint(...original)), heading: p.axisF.clone().set(...heading) });
    p.axisF.set(...heading).normalize(); p.axisL.set(p.axisF.z, 0, -p.axisF.x); p.freeSkate = true; p.speed = speed;
    p.groundHit = p.queryGround(level); if (!p.groundHit) throw Error('Missing measured support');
    p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true; p.rideNormal.copy(p.groundHit.normal);
  };
  const trials = schoolSourceTrials(p, level, place);
  let sample: any = {}, frame = 0, index = 0;
  const stop = (failure: string | null) => {
    p.step = oldStep; input.pollGamepad = oldPoll; report.running = false; report.failure = failure;
    report.tuningUnchanged = report.tuningBefore === JSON.stringify(game.TUNING); delete report.tuningBefore; p.speed = 0;
  };
  const next = () => { frame = 0; sample = {}; if (index === trials.length) { stop(null); return; } report.stage = trials[index].name; trials[index].init(); };
  input.pollGamepad = () => {
    const x = sample.moveX || 0, y = sample.moveY || 0, n = Math.hypot(x, y), raw = n ? .22 + .78 * Math.min(1, n) : 0;
    const held: any = { 0: sample.jumpHeld, 1: sample.grabHeld, 2: sample.spinHeld, 3: sample.grindHeld, 7: sample.transferHeld };
    return { id: 'School measured validation', index: 0, connected: true, mapping: 'standard', axes: n ? [x / n * raw, -y / n * raw, 0, 0] : [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: !!held[i], touched: false, value: held[i] ? 1 : 0 })) };
  };
  p.step = (dt: number, controls: any, current: any) => {
    try {
      const c = trials[index]; sample = c.sample(frame); update(); oldStep.call(p, dt, controls, current); frame++; report.frames++;
      if (p.isBailing) throw Error(`${c.name}: bail`);
      if (!p.pos.toArray().every(Number.isFinite)) throw Error('Non-finite position');
      if (c.observe(frame)) { report.passed.push({ name: c.name, frames: frame, result: c.result, end: p.pos.toArray() }); index++; next(); }
      else if (frame >= c.limit) throw Error(`${c.name}: timeout at ${p.pos.toArray()}`);
    } catch (error) { stop(String(error)); }
  };
  try { next(); } catch (error) { stop(String(error)); }
  return report;
}
