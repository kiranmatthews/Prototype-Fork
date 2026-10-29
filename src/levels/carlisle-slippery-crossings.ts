import type { CustomComponent } from '../level';

type Point = [number, number, number];
type Value = number | ((s: number) => number);
export type CarlisleRoad = { name: string; a: number; b: number; y: Value; width: Value; offset: Value; components: CustomComponent[] };
type Anchor = { s: number; radius: number };
export type CarlisleCrossing = {
  name: string; a: number; b: number; y: number; grade: number;
  slopes: { from: number; to: number; grade: number }[];
  anchors: Anchor[]; hazards: { s: number; u: number; y: number; width: number }[];
  bounds: (s: number) => [number, number];
  height: (s: number, u: number) => number;
};
const value = (v: Value, s: number) => typeof v === 'number' ? v : v(s);
export const CARLISLE_MIN_SLIDE_LENGTH = 18;

/** Replace overlapping flat quays with one supported ribbon. Its dry restart
 * islands and icy banks share exact seams; no flat collider remains underneath. */
export function buildCarlisleCrossings(components: CustomComponent[], roads: CarlisleRoad[],
  point: (s: number, y: number, u?: number) => Point, yaw: (s: number) => number,
  group: (s: number) => number, stops: { s: number; y: number }[],
  jumps: { from: [number, number, number?]; to: [number, number, number?] }[],
  railCatches: {s: number; y: number}[] = []): CarlisleCrossing[] {
  const runs: CarlisleRoad[][] = [];
  for (const road of [...roads].sort((a, b) => a.a - b.a)) {
    const previous = runs[runs.length - 1];
    if (previous && road.a <= Math.max(...previous.map(r => r.b)) &&
      Math.abs(value(road.y, road.a) - value(previous[0].y, previous[0].a)) < .001) previous.push(road);
    else runs.push([road]);
  }
  const removed = new Set<CustomComponent>(), crossings: CarlisleCrossing[] = [];
  const machinery = components.filter(c => c.t === 'mover').map(c => {
    let station = 0, distance = Infinity;
    for (let s = 0; s <= 4000; s += 2) {
      const p = point(s, 0), d = (p[0] - c.p[0]) ** 2 + (p[2] - c.p[2]) ** 2;
      if (d < distance) { station = s; distance = d; }
    }
    const [w, , d] = c.s ?? [12, 1.4, 12];
    return { s: station, y: c.p[1] - point(station, 0)[1], vertical: c.axis === 'y' ? Math.abs(c.amp ?? 0) : 0,
      radius: (c.spin ? Math.hypot(w, d) : Math.max(w, d)) / 2 + Math.hypot(...(c.orbit ?? [0, 0])) +
        (c.axis === 'y' ? 0 : Math.abs(c.amp ?? 0)) + 2 };
  });
  for (const run of runs) {
    const a = Math.min(...run.map(r => r.a)), b = Math.max(...run.map(r => r.b));
    if (b - a < 38) continue;
    const y = value(run[0].y, a), index = crossings.length;
    const anchors: Anchor[] = [{ s: a, radius: 3 }, { s: b, radius: 3 }];
    // A horizontal moving deck may overlap a quay while boarding. Keep its
    // entire swept footprint level so the bank cannot cross through it.
    for (const m of machinery) if (Math.abs(m.y - y) < m.vertical + 2 && m.s + m.radius > a && m.s - m.radius < b)
      anchors.push({ s: m.s, radius: m.radius });
    for (const stop of stops) if (stop.s >= a && stop.s <= b && stop.y === y) {
      anchors.push({ s: stop.s, radius: stop.s === 0 ? 12 : 2.5 });
      if (stop.s > 0) anchors.push({ s: stop.s + 7, radius: 3.5 });
    }
    for (const jump of jumps) for (const station of [jump.from, jump.to])
      if (station[0] >= a - 8 && station[0] <= b + 8 && station[1] === y)
        anchors.push({ s: station[0], radius: jump.from === station ? 8 : 7 });
    for (const catchAt of railCatches) if (catchAt.s >= a && catchAt.s <= b && catchAt.y === y)
      anchors.push({s: catchAt.s, radius: 7});
    if (b > 3990) anchors.push({ s: 4000, radius: 18 });
    const clearance = (s: number) => Math.min(...anchors.map(p => Math.abs(s - p.s) - p.radius));
    const bounds = (s: number): [number, number] => {
      const active = run.filter(r => s >= r.a - .001 && s <= r.b + .001);
      return [Math.min(...active.map(r => value(r.offset, s) - value(r.width, s) / 2)),
        Math.max(...active.map(r => value(r.offset, s) + value(r.width, s) / 2))];
    };
    // The course's elevation profile integrates these straight downhill
    // pitches. Across the width the surface stays level: no alternating banks.
    const grade = Math.tan((a < 1280 ? 18 : a < 2700 ? 22 : 26) * Math.PI / 180);
    const height = (_s: number, _u: number) => y;
    const crossing: CarlisleCrossing = { name: `${run[0].name} · downhill slick`, a, b, y, grade, slopes: [], anchors, hazards: [], bounds, height };
    crossings.push(crossing);
    for (const road of run) for (const c of road.components) removed.add(c);
    // Include every road edge and dry-island edge as a knot, keeping the
    // physical ribbon continuous where widths change and where traction ends.
    const knots = new Set<number>([a, b]);
    for (let s = a; s < b; s += .5) knots.add(s);
    for (const r of run) { knots.add(r.a); knots.add(r.b); }
    for (const p of anchors) for (const s of [p.s - p.radius, p.s + p.radius]) if (s > a && s < b) knots.add(s);
    const samples = [...knots].sort((x, z) => x - z), spans: { from: number; to: number; wet: boolean; knots: number[] }[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const from = samples[i], to = samples[i + 1], wet = clearance((from + to) / 2) > .001, previous = spans[spans.length - 1];
      if (previous?.wet === wet) { previous.to = to; previous.knots.push(to); }
      else spans.push({ from, to, wet, knots: [from, to] });
    }
    // Checkpoint and launch clearances can leave metre-long scraps. Those
    // belong to the dry island, not to a new downhill/slippery challenge.
    const continuous: typeof spans = [];
    for (const span of spans) {
      if (span.to - span.from < CARLISLE_MIN_SLIDE_LENGTH) span.wet = false;
      const previous = continuous[continuous.length - 1];
      if (previous?.wet === span.wet) {
        previous.to = span.to; previous.knots.push(...span.knots.slice(1));
      } else continuous.push(span);
    }
    if (continuous.every(span => !span.wet)) crossing.name = `${run[0].name} · dry connector`;
    for (const [part, span] of continuous.entries()) {
      if (span.wet) crossing.slopes.push({from: span.from, to: span.to, grade});
      // One origin makes shared Float32 seam vertices identical across the
      // separate dry and slippery materials, including at checkpoint toes.
      const origin = point(a, y), vertices: number[] = [], indices: number[] = [];
      const columns = 4, layer = columns + 1, row = layer * 2;
      for (const s of span.knots) {
        const [left, right] = bounds(s);
        for (const down of [0, 1.6]) for (let i = 0; i <= columns; i++) {
          const u = left + (right - left) * i / columns;
          const p = point(s, height(s, u) - down, u); vertices.push(...p.map((v, i) => v - origin[i]));
        }
      }
      for (let i = 0; i < span.knots.length - 1; i++) for (let j = 0; j < columns; j++) {
        const k = i * row + j; indices.push(k, k + 1, k + row + 1, k, k + row + 1, k + row);
      }
      const topTriangles = indices.length / 3;
      for (let i = 0; i < span.knots.length - 1; i++) {
        const k = i * row;
        for (let j = 0; j < columns; j++) { const d = k + layer + j; indices.push(d, d + row, d + row + 1, d, d + row + 1, d + 1); }
        indices.push(k, k + row, k + row + layer, k, k + row + layer, k + layer);
        const r = k + columns; indices.push(r, r + layer, r + row + layer, r, r + row + layer, r + row);
      }
      const last = (span.knots.length - 1) * row;
      for (let j = 0; j < columns; j++) indices.push(j, j + layer, j + layer + 1, j, j + layer + 1, j + 1,
        last + j, last + j + 1, last + j + layer + 1, last + j, last + j + layer + 1, last + j + layer);
      components.push({ t: 'mesh', nm: `${crossing.name} · ${span.wet ? 'ice' : 'safe'} ${part + 1}`, p: origin, vertices, indices,
        grindTopTriangles: topTriangles, solid: true, solidSides: true, tex: 'solid', color: span.wet ? '#86a5b7' : '#aeb5b9', grp: group(span.from),
        ...(span.wet ? { slip: true, iceGrip: .02, slipGravity: 1 } : {}) });
      if (!span.wet || span.to - span.from < 7) continue;
      const sites = span.to - span.from > 27 ? [.32, .73] : [.55];
      for (const [j, t] of sites.entries()) {
        const s = span.from + (span.to - span.from) * t, [left, right] = bounds(s), width = Math.min(4.8, (right - left) * .25);
        const sign = (index + part + j) % 2 ? -1 : 1;
        const u = (left + right) / 2 + sign * (right - left) * .27;
        const base = height(s, u), name = `${crossing.name} · red teeth ${part + 1}.${j + 1}`;
        crossing.hazards.push({ s, u, y: base, width });
        const origin = point(s, base, u), vertices: number[] = [], indices: number[] = [];
        for (let tooth = 0; tooth < 3; tooth++) {
          const centre = u + (tooth - 1) * width / 3, half = width / 6, start = vertices.length / 3;
          for (const [ds, du, rise] of [[-.9, -half, 0], [-.9, half, 0], [.9, half, 0], [.9, -half, 0], [0, 0, 2.6]]) {
            const at = point(s + ds, height(s + ds, centre + du) + rise, centre + du);
            vertices.push(...at.map((v, i) => v - origin[i]));
          }
          indices.push(start, start + 1, start + 4, start + 1, start + 2, start + 4, start + 2, start + 3, start + 4,
            start + 3, start, start + 4, start, start + 3, start + 2, start, start + 2, start + 1);
        }
        components.push({ t: 'mesh', nm: name, p: origin, vertices, indices, solid: false, tex: 'solid', color: '#b74435', doubleSided: true, grp: group(s) });
        components.push({ t: 'pit', nm: `${name} · contact`, p: point(s, base + 1.1, u), s: [width - .45, 1, 1.35], yaw: yaw(s), invisible: true, grp: group(s) });
        components.push({ t: 'wumpa', nm: `${name} · clear line`, p: point(s, height(s, -u) + 1, -u), grp: group(s) });
      }
    }
  }
  const retained = components.filter(c => !removed.has(c)); components.splice(0, components.length, ...retained);
  // Rest-side crates and the starting clock sit on their new actual surface.
  for (const c of components) if (['crate', 'clock'].includes(c.t)) {
    let best: { run: CarlisleCrossing; s: number; u: number; d: number } | null = null;
    for (const run of crossings) for (let s = run.a; s <= run.b; s += .5) {
      const at = point(s, 0), d = Math.hypot(at[0] - c.p[0], at[2] - c.p[2]);
      if (d < (best?.d ?? Infinity)) {
        const side = point(s, 0, 1); best = { run, s, u: (c.p[0] - at[0]) * (side[0] - at[0]) + (c.p[2] - at[2]) * (side[2] - at[2]), d };
      }
    }
    if (best && best.d < 16 && Math.abs(c.p[1] - point(best.s, best.run.y)[1]) < .1)
      c.p[1] = point(best.s, best.run.height(best.s, best.u), best.u)[1];
  }
  return crossings;
}
