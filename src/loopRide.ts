/** A banked vertical loop: metres, entry tangent -Z, one full turn then exit. */
export interface LoopShape { radius: number; width: number; offset: number }
export interface LoopSample {
  point: [number, number, number];
  normal: [number, number, number];
  tangent: [number, number, number];
}
export const LOOP_TURN = Math.PI * 2;

export function sampleLoop(shape: LoopShape, angle: number, lateral = 0): LoopSample {
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

/** The same centreline drives rendering and contact, so the rider cannot float above facets. */
export function createLoopMeshData(radius: number, width: number, offset: number, steps = 160) {
  const shape = { radius, width, offset };
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
  const pitch = shape.offset / LOOP_TURN;
  return speed * speed * shape.radius / (shape.radius * shape.radius + pitch * pitch)
    + gravity * Math.cos(angle);
}

export function stepLoopMotion(shape: LoopShape, motion: LoopMotion, dt: number,
  charge: number, brake: boolean, forces: LoopForces, recovering = false): LoopMotion & { attached: boolean; complete: boolean } {
  let { angle, speed } = motion;
  const lengthPerRadian = Math.hypot(shape.radius, shape.offset / LOOP_TURN);
  const count = Math.max(1, Math.ceil(dt * 120)), step = dt / count;
  for (let i = 0; i < count; i++) {
    const slope = shape.radius * Math.sin(angle) / lengthPerRadian;
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
