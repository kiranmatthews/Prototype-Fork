import { schoolSourcePoint, schoolOriginalPoint, SCHOOL_SOURCE_SCALE } from '../src/levels/school-source';

// Source coordinates cover campus lanes and the original picnic table. Heights
// come from native support during play, never from this steering controller.
export const SCHOOL_SOURCE_ROUTE = [
  [-8500, 6391], [-9300, 5500], [-9300, 5250], [-7000, 5500],
  [-5500, 5250], [-5300, 4400], [-5000, 3800], [-4500, 3200], [-4000, 2000], [-4000, 700],
  [-2400, -1000], [0, -1000], [2500, -2000], [2500, 800],
  [6000, 1000], [8500, 1300], [10000, 800], [11000, 0], [11300, -2000], [11000, -5200],
  [9500, -6200], [8000, -7300], [6500, -8200],
  [4500, -8300], [2000, -8300], [0, -9000], [-3000, -9000],
  [-7000, -9000], [-8000, -7500], [-10000, -6000], [-12000, -4500],
  [-12000, -3300], [-14000, -3300], [-14500, -2300], [-14500, -1100],
];

/** Input-only native-spawn route. No position, velocity or state correction. */
export function createSchoolSourceRoute(p: any, traceTurn = false) {
  const points = SCHOOL_SOURCE_ROUTE.map(([x, z]) => schoolSourcePoint(x, 0, z));
  let index = 0, stageFrames = 0, tableReleased = false;
  const tableFront = schoolSourcePoint(-8673, 1716, 5250)[0];
  const tableBack = schoolSourcePoint(-8185, 1716, 5250)[0];
  const previous = p.pos.clone();
  const report = { frames: 0, waypoints: 0, totalWaypoints: points.length, distance: 0, airFrames: 0,
    tableOllie: { released: false, landed: false, returned: false, release: [] as number[] },
    visits: [] as any[], ...(traceTurn ? { turnTrace: [] as any[] } : {}) };
  return { report, sample() {
    const target = points[index]; if (!target) return {};
    const distance = Math.hypot(p.pos.x - target[0], p.pos.z - target[2]);
    if (distance < 2.5) {
      report.visits.push({ index, frame: report.frames, source: schoolOriginalPoint(...p.pos.toArray() as [number, number, number]), grounded: p.grounded });
      index++; report.waypoints = index; stageFrames = 0;
      if (!points[index]) return {};
    }
    const q = points[index], desired = Math.atan2(q[0] - p.pos.x, -(q[2] - p.pos.z));
    const heading = Math.atan2(p.axisF.x, -p.axisF.z), delta = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
    const turn = Math.max(-1, Math.min(1, delta * 3));
    if (p.state === 'air') return {};
    // The original picnic table occupies this lane. Charge while completing
    // the turn, then ollie onto its top and ride off its far edge.
    if (index === 3 && !tableReleased && p.pos.x - tableFront < 2.6) {
      tableReleased = true; report.tableOllie.released = true;
      report.tableOllie.release = p.pos.toArray();
    }
    return { moveX: +turn.toFixed(2), moveY: +Math.sqrt(1 - turn * turn).toFixed(2),
      jumpHeld: index === 3 && !tableReleased,
      grabHeld: p.grounded && (p.speed > (Math.abs(delta) > .35 || distance < 8 ? 6 : 12.5)) };
  }, observe() {
    report.frames++; stageFrames++; report.distance += previous.distanceTo(p.pos); previous.copy(p.pos);
    report.airFrames += p.state === 'air' ? 1 : 0;
    if (tableReleased && p.grounded && p.pos.x < tableFront && p.pos.x > tableBack &&
        Math.abs(p.pos.y - 117 * SCHOOL_SOURCE_SCALE) < .02) report.tableOllie.landed = true;
    if (report.tableOllie.landed && p.grounded && p.pos.x < tableBack && Math.abs(p.pos.y) < .02) report.tableOllie.returned = true;
    if (report.turnTrace && report.frames >= 300 && report.frames <= 700) report.turnTrace.push({
      frame: report.frames, position: p.pos.toArray(), heading: p.axisF.toArray(), normal: p.rideNormal.toArray(),
      speed: p.speed, vertical: p.vVel, state: p.state, grounded: p.grounded, manual: p.manualing,
      freeSkate: p.freeSkate, camera: p.camDir.toArray(), ground: p.groundHit?.name,
      kickClock: p.parkKickGroundSeconds, input: [p.rawInput.moveX, p.rawInput.moveY, p.rawInput.grabHeld],
    });
    if (stageFrames > 1800) throw Error(`Campus route stalled before waypoint ${index}`);
    return index === points.length && p.grounded;
  } };
}
