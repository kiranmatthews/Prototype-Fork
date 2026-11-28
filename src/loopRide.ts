/** Analytic upright or horizontal wall loops: metres, entry tangent -Z. */
export interface LoopShape { radius: number; width: number; offset: number; kind?: 'vertical' | 'wall' }
export interface LoopSample {
  point: [number, number, number];
  normal: [number, number, number];
  tangent: [number, number, number];
}
export const LOOP_TURN = Math.PI * 2;

/**
 * A PLANAR loop: an upright loop with no offset. It is entered and left at the same point of the same line,
 * so the whole ring stands in one vertical plane and the track crosses over its own way in and way out. That
 * is the loop a side-scrolling course can carry (seen from the side, any loop looks like this one).
 *
 * Because its two lower quadrants stand over the approach and the run-out, its ribbon cannot be a floor: a
 * body on the line would meet the back of the quadrant it is meant to come down at the end. A planar loop is
 * therefore ridden by its analytic centreline alone (`stepLoopMotion`), and to everything else it is not
 * there: a walker, or a rider too slow for it, goes along the floor under it. See `planarLoopEntry`.
 */
export function isPlanarLoop(shape: Pick<LoopShape, 'offset' | 'kind'>): boolean {
  return shape.kind !== 'wall' && Math.abs(shape.offset) < 1e-6;
}

export function sampleLoop(shape: LoopShape, angle: number, lateral = 0): LoopSample {
  if (shape.kind === 'wall') return sampleWallLoop(shape, angle, lateral);
  const { radius: r, offset } = shape;
  const pitch = offset / LOOP_TURN;
  const lengthPerRadian = Math.hypot(r, pitch);
  return {
    point: [pitch * angle + lateral, r * (1 - Math.cos(angle)), -r * Math.sin(angle)],
    normal: [0, Math.cos(angle), Math.sin(angle)],
    tangent: [pitch / lengthPerRadian, r * Math.sin(angle) / lengthPerRadian,
      -r * Math.cos(angle) / lengthPerRadian],
  };
}

/** A descending wedding band. Banking eases from a flat entry to the
 * inward-facing wall, remains vertical for 270 degrees, then unwinds flat. */
function sampleWallLoop(shape: LoopShape, angle: number, lateral: number): LoopSample {
  const t = angle / LOOP_TURN, r = shape.radius;
  const pitch = shape.offset * (1 - Math.cos(angle)) / LOOP_TURN;
  const length = Math.hypot(r, pitch);
  const tangent: [number, number, number] = [r * Math.sin(angle) / length, pitch / length, -r * Math.cos(angle) / length];
  const ease = (v: number) => { const x = Math.max(0, Math.min(1, v)); return x*x*x*(10+x*(-15+6*x)); };
  const bank = Math.PI / 2 * ease(Math.min(angle, LOOP_TURN-angle) / (Math.PI/4));
  const radial = [Math.cos(angle), 0, Math.sin(angle)];
  const up = [-tangent[1]*Math.sin(angle), r/length, tangent[1]*Math.cos(angle)];
  const normal = up.map((v,i) => v*Math.cos(bank)+radial[i]*Math.sin(bank)) as [number,number,number];
  const side = [tangent[1]*normal[2]-tangent[2]*normal[1], tangent[2]*normal[0]-tangent[0]*normal[2], tangent[0]*normal[1]-tangent[1]*normal[0]];
  return {
    point: [r*(1-Math.cos(angle))+side[0]*lateral, shape.offset*(t-Math.sin(angle)/LOOP_TURN)+side[1]*lateral, -r*Math.sin(angle)+side[2]*lateral],
    normal, tangent,
  };
}

export function loopAngleAt(shape: LoopShape, point: readonly number[]): number {
  return (Math.atan2(-point[2], shape.radius-point[shape.kind==='wall'?0:1])+LOOP_TURN)%LOOP_TURN;
}

function loopMetric(shape: LoopShape, angle: number): number {
  return Math.hypot(shape.radius, shape.offset / LOOP_TURN * (shape.kind==='wall'?1-Math.cos(angle):1));
}

/** The same centreline drives rendering and contact, so the rider cannot float above facets. */
export function createLoopMeshData(radius: number, width: number, offset: number, steps = 160, kind: LoopShape['kind'] = 'vertical') {
  const shape = { radius, width, offset, kind };
  const vertices: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = [];
  const count = Math.max(32, Math.min(256, Math.round(steps)));
  for (let i = 0; i <= count; i++) {
    for (const side of [-1, 1]) {
      const s = sampleLoop(shape, i / count * LOOP_TURN, side * width / 2);
      vertices.push(...s.point); normals.push(...s.normal);
      uvs.push((side + 1) / 2 * width / 5, i / count * LOOP_TURN * radius / 5);
    }
    if (i < count) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return { vertices, normals, uvs, indices };
}

export interface LoopMotion { angle: number; speed: number }
export interface LoopForces { gravity: number; pump: number; friction: number; drag: number; braking: number }
/** Positive pressure is required: the track can push the wheels inward, never pull them. */
export function loopContactPressure(shape: LoopShape, angle: number, speed: number, gravity: number): number {
  if (shape.kind === 'wall') {
    const sample = sampleLoop(shape, angle), delta = 0.0001;
    const a = sampleLoop(shape, angle-delta).tangent, b = sampleLoop(shape, angle+delta).tangent;
    const curvature = sample.normal.reduce((sum,n,i)=>sum+n*(b[i]-a[i])/(2*delta*loopMetric(shape,angle)),0);
    return speed*speed*curvature + gravity*sample.normal[1];
  }
  const pitch = shape.offset / LOOP_TURN;
  return speed * speed * shape.radius / (shape.radius * shape.radius + pitch * pitch)
    + gravity * Math.cos(angle);
}

export function stepLoopMotion(shape: LoopShape, motion: LoopMotion, dt: number,
  charge: number, brake: boolean, forces: LoopForces, recovering = false): LoopMotion & { attached: boolean; complete: boolean } {
  let { angle, speed } = motion;
  const count = Math.max(1, Math.ceil(dt * 120)), step = dt / count;
  for (let i = 0; i < count; i++) {
    const lengthPerRadian = loopMetric(shape, angle);
    const slope = shape.kind==='wall' ? sampleLoop(shape, angle).tangent[1] : shape.radius * Math.sin(angle) / lengthPerRadian;
    const sign = Math.sign(speed || -slope);
    const accel = -forces.gravity * slope + (recovering ? 0 : forces.pump * charge * Math.max(0, slope))
      - sign * (forces.friction + forces.drag * speed * speed + (brake ? forces.braking : 0));
    speed = recovering ? speed + accel * step : Math.max(0, speed + accel * step);
    angle = Math.max(0, Math.min(LOOP_TURN, angle + speed / lengthPerRadian * step));
    if ((!recovering && speed < 0.5) || loopContactPressure(shape, angle, speed, forces.gravity) < 0)
      return { angle, speed, attached: false, complete: false };
    if (angle >= LOOP_TURN || (recovering && angle <= 0)) return { angle, speed, attached: true, complete: true };
  }
  return { angle, speed, attached: true, complete: false };
}

/**
 * The speeds a planar loop of this radius asks for at its foot, with these forces: `coasting` goes round with
 * nothing held; `pumped` goes round with the charge held from the foot (the pump works only on the way up).
 * Below `pumped` no rider can make it, and a planar loop does not take one on: he goes under it.
 * Found by riding the centreline, so they are the speeds the ride itself agrees with.
 */
export function planarLoopEntry(radius: number, forces: LoopForces): { coasting: number; pumped: number } {
  const key = [radius, forces.gravity, forces.pump, forces.friction, forces.drag].join(':');
  const known = PLANAR_ENTRY.get(key);
  if (known) return known;
  const shape: LoopShape = { radius, width: 2, offset: 0 };
  const rides = (speed: number, charge: number): boolean => {
    let motion: LoopMotion = { angle: 0, speed };
    for (let i = 0; i < 3600; i++) {
      const next = stepLoopMotion(shape, motion, 1 / 60, charge, false, forces);
      if (!next.attached) return false;
      if (next.complete) return true;
      motion = next;
    }
    return false;
  };
  const least = (charge: number): number => {
    let low = 0, high = 4 * Math.sqrt(5 * forces.gravity * radius) + 10;
    for (let i = 0; i < 28; i++) { const mid = (low + high) / 2; if (rides(mid, charge)) high = mid; else low = mid; }
    return high;
  };
  const entry = { coasting: least(0), pumped: least(1) };
  PLANAR_ENTRY.set(key, entry);
  return entry;
}
const PLANAR_ENTRY = new Map<string, { coasting: number; pumped: number }>();

