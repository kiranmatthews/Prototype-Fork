import type { CustomComponent } from './level';

type Point = { x: number; y: number; z: number };
type Segment = { a: Point; b: Point; length: number; start: number };
const mix = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t,
});
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.z - a.z);
const center = (c: CustomComponent): Point => ({ x: c.p[0], y: c.p[1] + c.s![1] / 2, z: c.p[2] });

/** The opening's existing supports own this route, including editor transforms.
 * No new collision, camera lane, surface policy or movement tuning is involved. */
export class TreehouseStairPath {
  readonly segments: Segment[] = [];
  readonly length: number;

  constructor(points: Point[], private readonly supports: CustomComponent[]) {
    // Round only the flat landing corners; the actual ramp endpoints retain
    // their authored height and slope. The arc stays inside each landing.
    const rounded: Point[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1], b = points[i], c = points[i + 1];
      const before = distance(a, b), after = distance(b, c);
      const dot = ((b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z)) / (before * after);
      if (Math.abs(a.y - b.y) < .01 && Math.abs(b.y - c.y) < .01 && dot < .95) {
        const radius = Math.min(.65, before * .7, after * .7);
        const entry = mix(b, a, radius / before), exit = mix(b, c, radius / after);
        for (let j = 0; j <= 12; j++) rounded.push(mix(mix(entry, b, j / 12), mix(b, exit, j / 12), j / 12));
      } else rounded.push(b);
    }
    rounded.push(points[points.length - 1]);
    let start = 0;
    for (let i = 1; i < rounded.length; i++) {
      const length = distance(rounded[i - 1], rounded[i]);
      if (length > 1e-6) { this.segments.push({ a: rounded[i - 1], b: rounded[i], length, start }); start += length; }
    }
    this.length = start;
  }

  at(s: number): Point {
    const segment = this.segments.find(v => v.start + v.length >= s) ?? this.segments[this.segments.length - 1];
    // Extrapolate at both mouths so walking out never sticks at an endpoint.
    return mix(segment.a, segment.b, (s - segment.start) / segment.length);
  }

  locate(p: Point) {
    let best: { s: number; distance: number; x: number; z: number } | null = null;
    for (const segment of this.segments) {
      const { a, b, length, start } = segment, x = (b.x - a.x) / length, z = (b.z - a.z) / length;
      const along = (p.x - a.x) * x + (p.z - a.z) * z;
      const t = Math.max(0, Math.min(1, along / length)), q = mix(a, b, t);
      if (p.y < q.y - .55 || p.y > q.y + 12) continue;
      const d = distance(p, q);
      if (d <= 1.05 && (!best || d < best.distance)) best = { s: start + t * length, distance: d, x, z };
    }
    // Reject an exit only after finding the nearest segment. Skipping its
    // endpoint during the search would recapture a player on the next segment
    // back, briefly tugging at them as they step onto the balcony/clearing.
    if (best && (best.s === 0 || best.s >= this.length - 1e-6)) {
      const end = this.at(best.s);
      const beyond = (p.x - end.x) * best.x + (p.z - end.z) * best.z;
      if (best.s === 0 ? beyond < 0 : beyond > 0) return null;
    }
    return best;
  }

  blocksBoard(p: Point): boolean {
    return this.supports.some(c => {
      const angle = (c.yaw ?? 0) * Math.PI / 180, dx = p.x - c.p[0], dz = p.z - c.p[2];
      const x = Math.cos(angle) * dx - Math.sin(angle) * dz, z = Math.sin(angle) * dx + Math.cos(angle) * dz;
      const ramp = c.t === 'ramp', width = ramp ? c.w! : c.s![0], depth = ramp ? c.len! : c.s![2];
      const floor = ramp ? c.p[1] + Math.max(0, Math.min(1, .5 - z / depth)) * c.rise! : c.p[1] + c.s![1] / 2;
      return Math.abs(x) <= width / 2 + .25 && Math.abs(z) <= depth / 2 + .25 && p.y >= floor - .55 && p.y <= floor + 12;
    });
  }
}

export function createTreehouseStairPath(components: readonly CustomComponent[]): TreehouseStairPath | null {
  const balcony = components.find(c => c.t === 'platform' && c.nm === 'Treehouse balcony support');
  const landings = components.filter(c => c.t === 'platform' && c.nm === 'Treehouse landing support').sort((a, b) => b.p[1] - a.p[1]);
  const flights = components.filter(c => c.t === 'ramp' && c.nm === 'Treehouse stair flight support').sort((a, b) => b.p[1] - a.p[1]);
  if (!balcony?.s || landings.length !== 4 || flights.length !== 3 || landings.some(c => !c.s)) return null;
  const top = center(landings[0]), bottom = center(landings[3]);
  const yaw = (balcony.yaw ?? 0) * Math.PI / 180;
  const mouth = landings[0].s![2] / 2 + .65;
  const points: Point[] = [{ x: top.x - Math.sin(yaw) * mouth, y: top.y, z: top.z - Math.cos(yaw) * mouth }, top];
  for (let i = 0; i < flights.length; i++) {
    const c = flights[i], angle = (c.yaw ?? 0) * Math.PI / 180, half = c.len! / 2;
    const high = { x: c.p[0] - Math.sin(angle) * half, y: c.p[1] + c.rise!, z: c.p[2] - Math.cos(angle) * half };
    const low = { x: c.p[0] + Math.sin(angle) * half, y: c.p[1], z: c.p[2] + Math.cos(angle) * half };
    points.push(high, low, center(landings[i + 1]));
  }
  const last = flights[2], angle = (last.yaw ?? 0) * Math.PI / 180, exit = landings[3].s![0] / 2 + .45;
  points.push({ x: bottom.x + Math.sin(angle) * exit, y: bottom.y, z: bottom.z + Math.cos(angle) * exit });
  return new TreehouseStairPath(points, [balcony, ...landings, ...flights]);
}

/** Per-player direction latch: a held stick follows bends; releasing or
 * redirecting it chooses afresh, and an opposite input reverses immediately. */
export class TreehouseStairInput {
  private path: TreehouseStairPath | null = null;
  private inputX = 0;
  private inputY = 0;
  private direction = 1;
  reset(): void { this.path = null; this.inputX = this.inputY = 0; }

  sample(path: TreehouseStairPath | null, p: Point, moveX: number, moveY: number, frame: { x: number; z: number }) {
    const nearest = path?.locate(p);
    if (!path || !nearest) { this.reset(); return null; }
    if (this.path !== path) this.reset();
    this.path = path;
    const magnitude = Math.min(1, Math.hypot(moveX, moveY));
    if (magnitude > .001) {
      const length = Math.hypot(moveX, moveY), x = moveX / length, y = moveY / length;
      const held = x * this.inputX + y * this.inputY;
      if (held < .7) {
        if (held < -.5) this.direction *= -1;
        else {
          const wx = frame.x * y - frame.z * x, wz = frame.z * y + frame.x * x;
          let intent = wx * nearest.x + wz * nearest.z;
          if (Math.abs(intent) < .2) {
            const a = path.at(0), b = path.at(path.length);
            intent = wx * (b.x - a.x) + wz * (b.z - a.z);
          }
          this.direction = intent >= 0 ? 1 : -1;
        }
        this.inputX = x; this.inputY = y;
      }
    } else this.inputX = this.inputY = 0;
    const target = path.at(nearest.s + this.direction * .55);
    const dx = (target.x - p.x) * this.direction, dz = (target.z - p.z) * this.direction;
    const length = Math.hypot(dx, dz) || 1;
    return { x: dx / length, z: dz / length, amount: magnitude * this.direction, tangent: nearest };
  }
}
