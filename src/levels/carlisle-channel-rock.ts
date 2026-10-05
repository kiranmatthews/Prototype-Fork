import * as THREE from 'three';
import type { CustomComponent } from '../level';

type P = [number, number, number];
const round = (value: number) => Math.round(value * 100000) / 100000;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A closed stone foundation under Carlisle's original analytical halfpipe.
 * This is scenery only: the original U owns all riding, contact and grinds.
 * Sixteen adaptive segments per bank concentrate samples near its vertical
 * tangent. Their vertical interpolation error fits inside the 4.5cm setback;
 * ordinary uniform-angle sagitta alone would not prove bank clearance. */
export function buildCarlisleChannelRock(component: CustomComponent): CustomComponent[] {
  if (component.t !== 'vertramp' || component.pts || component.vkind !== 'half') return [];
  const radius = component.rise ?? 4.5, flat = component.w ?? 3, length = component.len ?? 120;
  const outer = flat + radius + .3, arcSegments = 16;
  const angleAt = (step: number) => Math.PI / 2 * (1 - (1 - step / arcSegments) ** 2);
  const profile: [number, number][] = [[-outer, radius - .045]];
  for (let step = arcSegments; step >= 0; step--) {
    const angle = angleAt(step);
    profile.push([-flat - radius * Math.sin(angle), radius * (1 - Math.cos(angle)) - .045]);
  }
  profile.push([flat, -.045]);
  for (let step = 1; step <= arcSegments; step++) {
    const angle = angleAt(step);
    profile.push([flat + radius * Math.sin(angle), radius * (1 - Math.cos(angle)) - .045]);
  }
  profile.push([outer, radius - .045]);
  const alongSegments = Math.min(12, Math.max(4, Math.ceil(length / 10)));
  const along = Array.from({ length: alongSegments + 1 }, (_, i) => mix(-length / 2, length / 2, i / alongSegments));
  const vertices: number[] = [], indices: number[] = [], uvs: number[] = [], colors: number[] = [];
  const vertex = (p: P, uv: [number, number], fraction: number, crease = false): number => {
    const index = vertices.length / 3;
    const variation = .95 + .055 * Math.sin(p[2] * .31 + p[0] * .84);
    const shade = mix(1, .72, fraction) * variation * (crease ? .82 : 1);
    vertices.push(...p); uvs.push(...uv); colors.push(.59 * shade, .49 * shade, .32 * shade);
    return index;
  };
  const quad = (a: number, b: number, c: number, d: number) => indices.push(a, c, b, b, c, d);
  const clone = (original: number, uv: [number, number], fraction: number, crease = false): number => {
    const id = vertex(vertices.slice(original * 3, original * 3 + 3) as P, uv, fraction, crease);
    return id;
  };
  const body = (column: number, row: number, fraction: number): P => {
    const [sourceX, top] = profile[column], sourceZ = along[row];
    const base = -10.45 - .44 * Math.sin(sourceZ * .091) - .24 * Math.cos(sourceZ * .23) - .16 * Math.cos(sourceX * .81);
    const y = mix(top, base, fraction);
    // Positive-Y bank walls descend vertically. Taper starts below the flat
    // riding floor; leaning an upper bank wall inward could cross the true
    // near-vertical curve between otherwise-safe sampled vertices.
    const taper = Math.max(0, Math.min(1, (-.15 - y) / (-.15 - base)));
    // Scale the full cross-section with the shoulder. Moving only its last
    // vertex inward could invert the lip against its neighbouring bank node.
    const scallop = (.28 + .39 * (.5 + .5 * Math.sin(sourceZ * .43 + Math.sign(sourceX))))
      * taper * Math.abs(sourceX) / outer;
    let x = sourceX * (1 - .42 * taper) - Math.sign(sourceX) * scallop;
    let z = sourceZ;
    if (row === 0 || row === along.length - 1) {
      const lobe = .85 + .76 * (.5 + .5 * Math.cos(sourceX / outer * Math.PI * 3.2 + .37));
      z -= Math.sign(sourceZ) * lobe * fraction;
    }
    x = Math.max(-outer, Math.min(outer, x));
    return [x, y, z];
  };
  const topUv = (p: P): [number, number] => {
    const cross = Math.abs(p[0]);
    const bank = Math.max(0, cross - flat);
    const arc = Math.sign(p[0]) * (Math.min(cross, flat)
      + radius * Math.asin(Math.min(1, bank / radius)) + Math.max(0, bank - radius));
    // Bedding follows the length. Arc distance stays metric at the vertical
    // lip, where an X/Z projection would stretch the last segment ~326×.
    return [(p[2] + length / 2) / 3.1, (arc + flat + radius * Math.PI / 2) / 3.1];
  };

  // The entire U top is one grid, including the flat middle. There are no
  // separate floating bank ribbons and no terrain beyond the measured lip.
  const topGrid: number[][] = [];
  for (let row = 0; row < along.length; row++) {
    const ids: number[] = [];
    for (let column = 0; column < profile.length; column++) {
      const p = body(column, row, 0);
      ids.push(vertex(p, topUv(p), 0));
    }
    topGrid.push(ids);
  }
  for (let row = 0; row < along.length - 1; row++) for (let column = 0; column < profile.length - 1; column++)
    quad(topGrid[row][column], topGrid[row][column + 1], topGrid[row + 1][column], topGrid[row + 1][column + 1]);

  // Closed perimeter order matches the sculpted shelves: +Z left→right,
  // +X near→far, -Z right→left, -X far→near. Only three deep broad courses.
  const border: { column: number; row: number; top: number; end: boolean }[] = [];
  for (let column = 0; column < profile.length - 1; column++)
    border.push({ column, row: along.length - 1, top: topGrid[topGrid.length - 1][column], end: true });
  for (let row = along.length - 1; row > 0; row--)
    border.push({ column: profile.length - 1, row, top: topGrid[row][profile.length - 1], end: row === along.length - 1 });
  for (let column = profile.length - 1; column > 0; column--)
    border.push({ column, row: 0, top: topGrid[0][column], end: true });
  for (let row = 0; row < along.length - 1; row++)
    border.push({ column: 0, row, top: topGrid[row][0], end: row === 0 });

  const sideUv = (p: P, end: boolean): [number, number] => [end ? p[0] / 3.2 : p[2] / 3.2, p[1] / 3.2];
  let previous = border.map(point => {
    const p = vertices.slice(point.top * 3, point.top * 3 + 3) as P;
    return clone(point.top, sideUv(p, point.end), 0);
  });
  const wallSeams = new Map<string, number>();
  const wallId = (id: number, end: boolean, fraction: number): number => {
    const p = vertices.slice(id * 3, id * 3 + 3) as P, uv = sideUv(p, end);
    if (Math.abs(uvs[id * 2] - uv[0]) < 1e-8) return id;
    const key = `${id}:${end}`;
    const existing = wallSeams.get(key); if (existing !== undefined) return existing;
    const cloned = clone(id, uv, fraction, fraction > 0 && fraction < 1);
    wallSeams.set(key, cloned); return cloned;
  };
  let previousFraction = 0;
  for (const fraction of [.27, .62, 1]) {
    const current = border.map(point => {
      const p = body(point.column, point.row, fraction);
      return vertex(p, sideUv(p, point.end), fraction, fraction < 1);
    });
    for (let i = 0; i < border.length; i++) {
      const next = (i + 1) % border.length;
      const end = border[i].row === border[next].row && (border[i].row === 0 || border[i].row === along.length - 1);
      quad(wallId(previous[i], end, previousFraction), wallId(previous[next], end, previousFraction),
        wallId(current[i], end, fraction), wallId(current[next], end, fraction));
    }
    previous = current;
    previousFraction = fraction;
  }

  // Ear-clipped bottom follows the lobed front and scalloped side footprint;
  // its mildly varying Y remains below -9m. It closes the whole stone mass.
  const bottom = previous.map(id => {
    const p = vertices.slice(id * 3, id * 3 + 3) as P;
    return clone(id, [p[0] / 3.2, p[2] / 3.2], 1);
  });
  const polygon = bottom.map(id => new THREE.Vector2(vertices[id * 3], vertices[id * 3 + 2]));
  for (const triangle of THREE.ShapeUtils.triangulateShape(polygon, [])) {
    const [a, b, c] = triangle.map(i => bottom[i]);
    const ax = vertices[b * 3] - vertices[a * 3], az = vertices[b * 3 + 2] - vertices[a * 3 + 2];
    const bx = vertices[c * 3] - vertices[a * 3], bz = vertices[c * 3 + 2] - vertices[a * 3 + 2];
    if (az * bx - ax * bz < 0) indices.push(a, b, c); else indices.push(a, c, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  const normalGroups = new Map<string, number[]>();
  for (let id = 0; id < vertices.length / 3; id++) {
    const key = vertices.slice(id * 3, id * 3 + 3).map(round).join('/');
    const group = normalGroups.get(key); if (group) group.push(id); else normalGroups.set(key, [id]);
  }
  for (const group of normalGroups.values()) {
    if (group.length < 2) continue;
    const normal = new THREE.Vector3();
    for (const id of group) normal.add(new THREE.Vector3(normals.getX(id), normals.getY(id), normals.getZ(id)));
    normal.normalize();
    for (const id of group) normals.setXYZ(id, normal.x, normal.y, normal.z);
  }
  const bakedNormals = Array.from(normals.array).map(round); geometry.dispose();
  return [{
    t: 'mesh', p: [...component.p], s: [1, 1, 1], yaw: component.yaw,
    vertices: vertices.map(round), indices, normals: bakedNormals,
    uvs: uvs.map(round), colors: colors.map(round), tex: 'coast-bedrock', color: '#ffffff',
    solid: false, edgeGrinding: false, castShadow: false, grp: 90,
    nm: 'Carlisle halfpipe carved stone foundation',
  }];
}
