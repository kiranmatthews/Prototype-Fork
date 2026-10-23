import { schoolSourcePoint, SCHOOL_SOURCE_SCALE, SCHOOL_SOURCE_RAILS, SCHOOL_GYM_ENTRY } from '../src/levels/school-source';
import { CONST } from '../src/tuning';
import { createBalancedGrind } from './school-grind-lines';
import { createSchoolSourceRoute } from './school-source-route';

type Point = [number, number, number];
type Place = (original: Point, heading: Point, speed?: number) => void;
export type SourceTrial = {
  name: string; limit: number; result: { air: number; verts: number; grinds: number; peak: number; grind?: ReturnType<typeof createBalancedGrind>['report']; route?: ReturnType<typeof createSchoolSourceRoute>['report']; drop?: { start: number[]; landing?: number[]; metres?: number; rolloutFrames: number } };
  init: () => void; sample: (frame: number) => any; observe: (frame: number) => boolean;
};

/** Device encoding is shared by native and browser checks. Both then pass
 * through Input.update(), including radial clamping and axis quantization. */
export function schoolSourceGamepad(sample: any) {
  const x = sample.moveX || 0, y = sample.moveY || 0, n = Math.hypot(x, y), raw = n ? .22 + .78 * Math.min(1, n) : 0;
  const held: any = { 0: sample.jumpHeld, 1: sample.grabHeld, 2: sample.spinHeld, 3: sample.grindHeld, 7: sample.transferHeld };
  return { id: 'School measured validation', index: 0, connected: true, mapping: 'standard', axes: n ? [x / n * raw, -y / n * raw, 0, 0] : [0, 0, 0, 0], buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: !!held[i], touched: false, value: held[i] ? 1 : 0 })) };
}

/** Feature placements only initialize a case; all subsequent movement uses
 * native controls, without changing positions, velocities or tuning. */
export function schoolSourceTrials(p: any, level: any, place: Place, traceRoute = false): SourceTrial[] {
  const trials: SourceTrial[] = [];
  function add(name: string, init: () => void, sample: (n: number) => any, done: (frame: number, r: SourceTrial['result']) => boolean, limit = 480) {
    const result: SourceTrial['result'] = { air: 0, verts: 0, grinds: 0, peak: -Infinity };
    trials.push({ name, limit, result, init: () => { result.air = result.verts = result.grinds = 0; result.peak = -Infinity; init(); }, sample,
      observe: frame => {
        result.air += p.state === 'air' ? 1 : 0; result.verts += p.vertAir ? 1 : 0; result.grinds += p.state === 'grind' ? 1 : 0;
        result.peak = Math.max(result.peak, p.pos.y); return done(frame, result);
      },
    });
    return result;
  }
  add('Original canopy start', () => p.respawn(level, true), () => ({ moveY: 1 }), frame => frame >= 121 && p.grounded && p.pos.x > 15 && Math.abs(p.pos.z) < .2);
  for (const [name, heading] of [['west', [1, 0, 0]], ['east', [-1, 0, 0]]] as [string, Point][]) {
    const toe = name === 'west' ? -17279 : -13065;
    const toeX = schoolSourcePoint(toe, 1599, 11000)[0];
    let released = false, turning = false, turned = false;
    add(`Smoothed ${name} gym entry and return`, () => {
      turning = turned = false;
      place([toe + heading[0] * (SCHOOL_GYM_ENTRY.runUnits + 100), 1630, 11000], heading, 18);
    }, () => {
      if (!turned && (p.pos.x - toeX) * heading[0] > 8) turning = true;
      if (turning && p.axisF.x * heading[0] < -.98) { turning = false; turned = true; }
      return { moveX: turning ? 1 : 0, grabHeld: p.speed > (turning ? 6 : 18) };
    }, (_frame, r) => {
      if (r.air) throw Error('Smooth gym entry unexpectedly launched the rider');
      return turned && p.grounded && p.pos.y < .05 && (p.pos.x - toeX) * heading[0] < -SCHOOL_GYM_ENTRY.runUnits * SCHOOL_SOURCE_SCALE - 1;
    }, 1000);
    add(`Original ${name} gym ollie and return`, () => { released = turning = turned = false; place([toe + heading[0] * 14 / SCHOOL_SOURCE_SCALE, 1630, 11000], heading, 10); }, n => {
      const release = !released && (toeX - p.pos.x) * heading[0] < 5.5;
      if (release) released = true;
      // Auto-kick keeps climbing the original flat bank. Turn below its back
      // wall, using ordinary steering/braking rather than waiting for a
      // passive rollout that only the fork's neutral-stick friction produces.
      if (!turned && (p.pos.x - toeX) * heading[0] > 16) turning = true;
      if (turning && p.axisF.x * heading[0] < -.98) { turning = false; turned = true; }
      return { jumpHeld: !released, jumpPressed: n === 0, jumpReleased: release,
        moveX: turning ? 1 : 0, grabHeld: p.grounded && (turning ? p.speed > 6 : turned && p.speed > 12) };
    }, (_frame, r) => turned && r.air > 0 && r.peak > 5 && p.grounded && p.pos.y < .1 && (p.pos.x - toeX) * heading[0] < -3, 1000);
  }
  for (const [name, original, heading] of [['rectangular pool', [4200, -390, -1700], [1, 0, 0]], ['oval pool', [9400, -470, -2200], [-1, 0, 0]]] as [string, Point, Point][])
    add(`Original ${name} vert return`, () => place(original, heading, 18), n => ({ jumpHeld: true, jumpPressed: n === 0 }), (_frame, r) => r.verts > 0 && p.grounded && p.rideNormal.y > .98 && p.pos.y < -26.8, 900);
  add('Measured charged flat ollie height', () => place([-15000, 1630, 13000], [0, 0, -1], 0), n => ({ jumpHeld: n < 30, jumpPressed: n === 0, jumpReleased: n === 30 }), (_frame, r) => {
    if (!r.air || !p.grounded) return false;
    if (r.peak < 2.1 || r.peak > 2.25) throw Error('Source-calibrated flat ollie height differs');
    return true;
  });
  const roofDrop = add('Original roof drop into lower courtyard', () => {
    place([-8000, 2825, 1700], [0, 0, -1], 10);
    if(p.pos.y < 16.8 || p.pos.y > 17)throw Error('Roof drop must start on the original roof');
    roofDrop.drop = {start:p.pos.toArray(),rolloutFrames:0};
  }, () => ({grabHeld:p.grounded && p.speed > 8}), (_frame,r) => {
    if(!r.air || !p.grounded)return false;
    const drop=roofDrop.drop!;
    if(!drop.landing){drop.landing=p.pos.toArray();drop.metres=r.peak-p.pos.y;}
    drop.rolloutFrames++;
    if(drop.rolloutFrames < 30)return false;
    if((drop.metres??0) < 30)throw Error('Roof drop omitted the original descent');
    return true;
  }, 900);
  for (const [origin, sourceX] of [['planter', -13200], ['ground', -12200]] as const) {
    let approachLine: ReturnType<typeof createBalancedGrind>, approachRail: any, approachReleased = false;
    const approach = add(`Original courtyard ollie onto rail 163 and rollout (${origin})`, () => {
      const authored = SCHOOL_SOURCE_RAILS.find(r => r.ids[0] === 163)!;
      approachRail = level.rails.find((r: any) => r.points[0].distanceTo(p.pos.clone().set(...authored.points[0])) < .001);
      if (!approachRail) throw Error('Missing courtyard rail');
      place([sourceX, origin === 'planter' ? 1800 : 1630, 4500], [-Math.SQRT1_2, 0, -Math.SQRT1_2], 18);
      const supportHeight = origin === 'planter' ? 165 * SCHOOL_SOURCE_SCALE : 0;
      if (Math.abs(p.pos.y - supportHeight) > .01) throw Error(`Wrong ${origin} approach support`);
      approachReleased = false; approachLine = createBalancedGrind(p, approachRail, CONST.fixedStep);
      approach.grind = approachLine.report;
    }, () => {
      if (approachLine.report.caught) return approachLine.sample();
      if (p.pos.z - approachRail.points[0].z < 4.5) approachReleased = true;
      return { moveY: 1, jumpHeld: !approachReleased, grindHeld: approachReleased };
    }, () => {
      if (p.state === 'grind' && p.grindRail !== approachRail) throw Error('Courtyard ollie caught the wrong rail');
      return approachLine.observe();
    }, 1500);
  }
  // Catch-and-traverse cases start 30 cm above the rail at 18 m/s. These
  // validate original chains and natural run-offs; approach ollies are a
  // separate coverage item. The controller uses ordinary balance inputs.
  for (const [root, direction] of [[163, 1], [163, -1], [784, 1], [784, -1], [206, 1], [206, -1], [797, 1], [283, -1]]) {
    // These two source rails climb farther than the final speed cap's entire
    // kinetic head. Starting at the bottom must reverse, never creep uphill
    // forever on the fork's generic minimum-grind-speed clamp.
    const reversal = direction < 0 && (root === 784 || root === 206);
    let line: ReturnType<typeof createBalancedGrind>;
    const result = add(reversal ? `Original rail ${root} uphill reversal and return` : `Original rail ${root} catch, traverse and land ${direction}`, () => {
      const authored = SCHOOL_SOURCE_RAILS.find(r => r.ids[0] === root)!;
      const start = p.pos.clone().set(...authored.points[0]);
      const length = authored.points.slice(1).reduce((sum, q, i) => sum + p.pos.clone().set(...q).distanceTo(p.pos.clone().set(...authored.points[i])), 0);
      const rail = level.rails.find((r: any) => r.points[0].distanceTo(start) < .001 && Math.abs(r.totalLength - length) < .001);
      if (!rail) throw Error(`Missing activated rail ${root}`);
      if (reversal) {
        const profile = level.skateReferencePhysics;
        const head = profile.finalSpeedLimit ** 2 / (2 * profile.park.airGravity);
        if (rail.points[0].y - rail.points.at(-1).y <= head) throw Error('Reversal fixture must retain the original over-height climb');
      }
      const t = direction > 0 ? .4 : rail.totalLength - .4;
      const heading = rail.tangentAt(t).multiplyScalar(direction).setY(0).normalize();
      const position = rail.pointAt(t).add(p.pos.clone().set(0, .3, 0));
      p.respawn(level, true, true, { position, heading }); p.axisF.copy(heading); p.axisL.set(heading.z, 0, -heading.x);
      p.freeSkate = true; p.speed = 18; p.pos.copy(position); p.prevPos.copy(position);
      p.grounded = false; p.state = 'air'; p.vVel = 0; p.airFromSkate = true; p.airGrav = 'board';
      line = createBalancedGrind(p, rail, CONST.fixedStep, false, reversal); result.grind = line.report;
    }, () => line.sample(), () => line.observe(), root === 784 && direction < 0 ? 2800 : 1800);
  }
  let route: ReturnType<typeof createSchoolSourceRoute>;
  const campus = add('Original continuous campus route', () => {
    p.respawn(level, true); p.speed = 0; p.freeSkate = true;
    route = createSchoolSourceRoute(p, traceRoute); campus.route = route.report;
  }, () => route.sample(), () => {
    if (!route.observe()) return false;
    if (route.report.distance < 900 || route.report.airFrames < 20) throw Error('Campus route omitted the canopy descent');
    if (!route.report.tableOllie.landed || !route.report.tableOllie.returned) throw Error('Campus route omitted the picnic-table ollie and rollout');
    return true;
  }, 8000);
  return trials;
}

/** The same cases run through the rendered game's ordinary gamepad input. */
export function runSchoolSourceBrowserChecks(game: any, routeOnly = false, filter?: RegExp) {
  const p = game.player, level = game.getLevel(), input = game.input;
  const oldStep = p.step, oldPoll = input.pollGamepad, update = input.update.bind(input);
  const report: any = { running: true, stage: '', passed: [], failure: null, frames: 0, tuningBefore: JSON.stringify(game.TUNING) };
  const place: Place = (original, heading, speed = 0) => {
    p.respawn(level, true, true, { position: p.pos.clone().set(...schoolSourcePoint(...original)), heading: p.axisF.clone().set(...heading) });
    p.axisF.set(...heading).normalize(); p.axisL.set(p.axisF.z, 0, -p.axisF.x); p.freeSkate = true; p.speed = speed;
    p.groundHit = p.queryGround(level); if (!p.groundHit) throw Error('Missing measured support');
    p.pos.y = p.groundHit.y; p.prevPos.copy(p.pos); p.grounded = true; p.rideNormal.copy(p.groundHit.normal);
  };
  const trials = schoolSourceTrials(p, level, place, routeOnly).filter(c => (!routeOnly || c.name === 'Original continuous campus route') && (!filter || filter.test(c.name)));
  let sample: any = {}, frame = 0, index = 0;
  const stop = (failure: string | null) => {
    p.step = oldStep; input.pollGamepad = oldPoll; report.running = false; report.failure = failure;
    report.tuningUnchanged = report.tuningBefore === JSON.stringify(game.TUNING); delete report.tuningBefore; p.speed = 0;
  };
  const next = () => { frame = 0; sample = {}; if (index === trials.length) { stop(null); return; } report.stage = trials[index].name; trials[index].init(); };
  input.pollGamepad = () => schoolSourceGamepad(sample);
  p.step = (dt: number, controls: any, current: any) => {
    try {
      const c = trials[index]; sample = c.sample(frame); update(); oldStep.call(p, dt, controls, current); frame++; report.frames++;
      if (p.isBailing) throw Error(`${c.name}: bail`);
      if (p.state === 'hang') throw Error(`${c.name}: on-foot ledge hang in a skate park`);
      if (!p.pos.toArray().every(Number.isFinite)) throw Error('Non-finite position');
      if (c.observe(frame)) { report.passed.push({ name: c.name, frames: frame, result: c.result, end: p.pos.toArray() }); index++; next(); }
      else if (frame >= c.limit) throw Error(`${c.name}: timeout at ${p.pos.toArray()}`);
    } catch (error) { stop(String(error)); }
  };
  try { next(); } catch (error) { stop(String(error)); }
  return report;
}
