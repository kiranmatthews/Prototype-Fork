import type { CustomComponent } from '../../level';
import { deck, type CrystalTrial } from './types';

type Point = [number, number, number];
// Survey coordinates are [metres right, metres down the corridor, elevation].
export type Mark = [number, number, number];
export type Feature =
  | 'hip'
  | 'rail'
  | 'relay'
  | 'cable'
  | 'fork'
  | 'bowl'
  | 'ferry'
  | 'crumble'
  | 'tide'
  | 'sweep'
  | 'switch'
  | 'flip'
  | 'stairs'
  | 'spill'
  | 'rebound'
  | 'patrol'
  | 'catch'
  | 'doubleCatch';
export type Span = [Feature, Mark, number, number?]; // feature, receiving lip, sideways bow, width in metres
type Crossing = [
  'arcade' | 'flyover' | 'terraces' | 'reservoir' | 'lock' | 'roofs' | 'yard',
  number,
  number,
  -1 | 1,
  number,
  number,
];
export interface AuthoredLine {
  spans: Span[];
  side: number;
  walk: Mark[];
}
type Section = { at: Mark; width: number; bank?: number };
const world = ([x, distance, height]: Mark): Point => [x, height, -distance];
const tone = (hex: string) => [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255) ** 2.2);
const palettes = [
  ['#b8c7c3', '#dc8d48', '#475961'],
  ['#a4b9cb', '#f3cb61', '#415872'],
  ['#cab39a', '#95d8cc', '#785b52'],
  ['#a6bbb1', '#e99c82', '#4d6862'],
  ['#b3abb9', '#f5c883', '#64596d'],
];
const round = (n: number) => Math.round(n * 1000) / 1000;

/** A rideable civil-engineering section. The top, two inset coping bands and
 * cut faces share the surveyed outline. Only the top contributes grind edges. */
function pavement(name: string, rows: Section[], palette: string[], depth = 1.15): CustomComponent {
  const origin = world(rows[0].at),
    vertices: number[] = [],
    indices: number[] = [],
    colors: number[] = [];
  const [surface, paint, face] = palette.map(tone);
  const rims: [Point, Point][] = [];
  for (let i = 0; i < rows.length; i++) {
    const {
      at: [x, d, y],
      width,
      bank = 0,
    } = rows[i];
    const before = rows[Math.max(0, i - 1)].at,
      after = rows[Math.min(rows.length - 1, i + 1)].at;
    const len = Math.hypot(after[1] - before[1], after[0] - before[0]);
    const seam = i === 0 || i === rows.length - 1;
    const nx = seam ? 1 : (after[1] - before[1]) / len,
      nz = seam ? 0 : (after[0] - before[0]) / len;
    const row = [-1, -0.91, -0.82, 0.82, 0.91, 1].map((fraction, k): Point => {
      const w = width * 0.5 * fraction;
      const pt: Point = [x + nx * w - origin[0], y + bank * fraction - origin[1], -d + nz * w - origin[2]];
      vertices.push(...pt.map(round));
      colors.push(...(k === 1 || k === 4 ? paint : surface));
      return pt;
    });
    rims.push([row[0], row[5]]);
    if (i)
      for (let j = 0; j < 5; j++) {
        const a = (i - 1) * 6 + j,
          b = a + 6;
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      }
  }
  const topTriangles = indices.length / 3;
  const faceBetween = (a: Point, b: Point) => {
    const i = vertices.length / 3;
    vertices.push(
      ...a.map(round),
      ...b.map(round),
      round(b[0]),
      round(b[1] - depth),
      round(b[2]),
      round(a[0]),
      round(a[1] - depth),
      round(a[2]),
    );
    colors.push(...paint, ...paint, ...face, ...face);
    indices.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  for (let i = 1; i < rims.length; i++) {
    faceBetween(rims[i - 1][0], rims[i][0]);
    faceBetween(rims[i][1], rims[i - 1][1]);
  }
  faceBetween(rims[0][1], rims[0][0]);
  faceBetween(rims[rims.length - 1][0], rims[rims.length - 1][1]);
  const normals = Array<number>(vertices.length).fill(0);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((n) => n * 3);
    const ux = vertices[b] - vertices[a],
      uy = vertices[b + 1] - vertices[a + 1],
      uz = vertices[b + 2] - vertices[a + 2];
    const vx = vertices[c] - vertices[a],
      vy = vertices[c + 1] - vertices[a + 1],
      vz = vertices[c + 2] - vertices[a + 2];
    for (const n of [a, b, c]) {
      normals[n] += uy * vz - uz * vy;
      normals[n + 1] += uz * vx - ux * vz;
      normals[n + 2] += ux * vy - uy * vx;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    for (let j = 0; j < 3; j++) normals[i + j] = round(normals[i + j] / length);
  }
  return {
    t: 'mesh',
    nm: name,
    p: origin,
    vertices,
    indices,
    colors,
    normals,
    tex: 'solid',
    grindTopTriangles: topTriangles,
    smoothCollision: true,
  };
}

/** An extruded spandrel. The arch is open from both sides at street level. */
function vault(marks: Mark[], thickness: number, palette: string[]): CustomComponent {
  const p = world(marks[0]),
    vertices: number[] = [],
    indices: number[] = [];
  for (const [i, mark] of marks.entries()) {
    const [x, y, z] = world(mark),
      u = (2 * i) / (marks.length - 1) - 1;
    const underside = -7.9 + (y + 7.2) * Math.sqrt(Math.max(0, 1 - u * u));
    for (const [dx, h] of [
      [-thickness / 2, y],
      [thickness / 2, y],
      [thickness / 2, underside],
      [-thickness / 2, underside],
    ])
      vertices.push(round(x - p[0] + dx), round(h - p[1]), round(z - p[2]));
    if (i)
      for (let j = 0; j < 4; j++) {
        const a = (i - 1) * 4 + j,
          b = (i - 1) * 4 + ((j + 1) % 4);
        indices.push(a, b, b + 4, a, b + 4, a + 4);
      }
  }
  return { t: 'mesh', p, vertices, indices, tex: 'solid', color: palette[2], doubleSided: true, solidSides: true };
}

export function lanePoint(a: Mark, b: Mark, bow: number, t: number, offset = 0): Mark {
  return [
    a[0] + (b[0] - a[0]) * t + bow * Math.sin(Math.PI * t) ** 2 + offset,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function streetLine(
  id: number,
  brief: string,
  side: 1 | -1,
  spans: Span[],
  crossing: Crossing,
  pitBeats: number[] = [],
): CrystalTrial {
  const palette = palettes[Math.floor((id - 1) / 5)],
    components: CustomComponent[] = [];
  const sidewalk = [palette[2], palette[0], palette[2]];
  const last = spans[spans.length - 1][1],
    end = last[1],
    walk: Mark[] = [];
  const add = (label: string, data: CustomComponent, group = 1) => {
    components.push({ ...data, nm: `${id} / ${label}`, grp: group });
  };
  const street = (label: string, rows: Section[], surface = palette, depth = 1.15, group = 1) =>
    add(label, pavement(label, rows, surface, depth), group);
  const sections = (marks: Mark[], width: number) => marks.map((at) => ({ at, width }));
  add('Flat recovery floor', deck('', 0, -8, (110 - end - 93) / 2, 104, end + 203, '#738687'));
  components[0].tex = 'solid';
  street(
    'Street entrance',
    sections(
      [
        [0, -113, -8],
        [0, -101, -8],
        [0, -61, 0],
        [0, -50, 0],
        [0, -24, 0],
        [0, 0, 0],
      ],
      16,
    ),
    palette,
    1.3,
  );
  add('Checkpoint on the forecourt', { t: 'checkpoint', p: [0, 0, 31] });
  add('Approach view of both lines', {
    t: 'camnode',
    p: [0, 3, 21],
    s: [53, 32, 82],
    radius: 9,
    cameraView: true,
    cameraPresentationOnly: true,
    cameraPosition: [0, 7, 34],
    cameraTarget: [0, 2, 8],
    cameraFollowDistance: 16,
    cameraKeepDistance: true,
    cameraFollowTargetHeight: 2.6,
    cameraFov: 65,
  });
  let a: Mark = [0, 0, 0];
  spans.forEach(([kind, b, bow, width = 8], index) => {
    const group = index + 2,
      hand = Math.sign(bow) || side;
    const nextKind = spans[index + 1]?.[0],
      springLanding = nextKind === 'catch' || nextKind === 'doubleCatch';
    const mark = (t: number, dx = 0, dy = 0): Mark => {
      const q = lanePoint(a, b, bow, t, dx);
      q[2] += dy;
      return q;
    };
    const part = (label: string, data: CustomComponent) => add(`${index + 1} / ${label}`, data, group);
    const slab = (label: string, samples: [number, number, number?, number?, number?][], depth = 1.25) =>
      street(
        `${index + 1} / ${label}`,
        samples.map(([t, w, dx, dy, bank]) => ({ at: mark(t, dx, dy), width: w, bank })),
        palette,
        depth,
        group,
      );
    const rail = (label: string, samples: [number, number, number][]) => {
      const knots = samples.map(([t, dx, dy]) => world(mark(t, dx, dy))),
        p = knots[0];
      part(label, {
        t: 'rail',
        p,
        pts: knots.map(([x, y, z]) => [x - p[0], z - p[2], 2.2, y - p[1]]),
        curve: 'corner',
      });
    };
    const dynamic = (
      label: string,
      t: number,
      type: 'mover' | 'crumble' | 'phasepad',
      w: number,
      length: number,
      options: Partial<CustomComponent>,
    ) => part(label, { t: type, p: world(mark(t)), s: [w, 0.65, length], ...options });
    if (kind === 'rail' || kind === 'relay' || kind === 'cable') {
      slab('Splayed grind approach', [
        [0, 13],
        [0.18, width + 3],
        [0.32, width, 0, 0.25],
      ]);
      if (kind === 'cable') {
        const first = world(mark(0.24, 0, 1.1)),
          tip = world(mark(0.9, 0, 1.1));
        part('Sagging cable over the cut', {
          t: 'rope',
          p: first.map((v, i) => (v + tip[i]) / 2) as Point,
          len: Math.hypot(tip[0] - first[0], tip[2] - first[2]),
          yaw: (Math.atan2(first[0] - tip[0], first[2] - tip[2]) * 180) / Math.PI,
          amp: 1.1,
          shake: 2.8,
        });
      } else if (kind === 'relay') {
        rail('Approach handrail', [
          [0.22, 0, 1.05],
          [0.42, 0, 1.3],
          [0.64, -hand * 0.8, 1.3],
        ]);
        rail('Offset return handrail', [
          [0.49, hand * 2.8, 1.3],
          [0.72, hand * 2.1, 1.1],
          [0.93, 0, 0.8],
        ]);
      } else
        rail('Bent crest rail', [
          [0.22, 0, 1],
          [0.42, 0, 1.35],
          [0.65, 0, 1.65],
          [0.91, 0, 0.8],
        ]);
      if (!springLanding)
        slab('Flared grind landing', [
          [0.83, width - 1],
          [0.93, width + 1],
          [1, 13],
        ]);
      else
        slab('Side landing beside the spring', [
          [0.85, 3.2, hand * 8],
          [1, 4, hand * 8],
        ]);
    } else if (kind === 'ferry' || kind === 'crumble' || kind === 'tide') {
      slab('Observation dock', [
        [0, 14],
        [0.19, width + 5],
        [0.36, width + 2, 0, 0, 0.1 * hand],
      ]);
      const span = b[1] - a[1];
      if (kind === 'ferry')
        dynamic('Cross-travelling ferry', 0.57, 'mover', width + 0.8, span * 0.34, {
          axis: 'x',
          amp: 2.5,
          speed: 0.75,
          phase: index * 0.6,
        });
      if (kind === 'crumble') {
        dynamic('First breakaway tongue', 0.465, 'crumble', width + 1, span * 0.22, { shake: 0.9 });
        dynamic('Offset breakaway return', 0.665, 'crumble', width - 0.5, span * 0.19, { shake: 0.7 });
      }
      if (kind === 'tide') {
        // The short fixed lip lets a rider stay in motion when the first sill flashes off.
        slab('Inside takeoff beside the pulsing sill', [
          [0.27, 5.4, hand * 1.6, 0.08],
          [0.37, 4.8, hand * 2.2, 0.2],
          [0.48, 4.2, hand * 2.7, 0.46],
        ]);
        dynamic('First pulsing sill', 0.465, 'phasepad', width + 1, span * 0.22, {
          cycle: 4.4,
          amp: 0.77,
          phase: 0.1,
        });
        dynamic('Second pulsing sill', 0.665, 'phasepad', width - 0.5, span * 0.19, {
          cycle: 4.4,
          amp: 0.77,
          phase: 0.01,
        });
      }
      slab('Receiving quay', [
        [0.76, width + 2],
        [0.87, width + 4],
        [1, 14],
      ]);
    } else if (kind === 'fork' || kind === 'switch') {
      slab('Fork nose', [
        [0, 13],
        [0.15, width + 6],
        [0.27, width + 6],
      ]);
      slab(
        'Outside crescent',
        [
          [0.2, 6.8, hand * 2.8],
          [0.37, 6.5, hand * 4.7],
          [0.54, 6.2, hand * 6.4],
          [0.72, 6.4, hand * 5.2],
          [0.9, 7, hand * 2.5],
        ],
        2.4,
      );
      if (kind === 'fork')
        slab(
          'Inside cutback ledge',
          [
            [0.26, 3.8, -hand * 3],
            [0.48, 3.5, -hand * 4],
            [0.66, 3, -hand * 4],
            [0.83, 4, -hand * 3],
          ],
          1.7,
        );
      else {
        part('Switch beside the inside lip', { t: 'crate', kind: 'bang', p: world(mark(0.17, -hand * 2.4)) });
        const first = mark(0.29, -hand * 2.8),
          tip = mark(0.84, -hand * 2.8);
        const n = Math.ceil(Math.hypot(tip[0] - first[0], tip[1] - first[1]) / 1.05);
        for (let j = 0; j <= n; j++) {
          const t = j / n;
          part('Switched crate-top shortcut', {
            t: 'crate',
            kind: 'metal',
            outline: true,
            p: world([
              first[0] + (tip[0] - first[0]) * t,
              first[1] + (tip[1] - first[1]) * t,
              first[2] + (tip[2] - first[2]) * t - 1.15,
            ]),
          });
        }
      }
      slab('Rejoining fan', [
        [0.81, width + 6],
        [0.92, width + 4],
        [1, 13],
      ]);
    } else if (kind === 'bowl') {
      slab('Flared channel mouth', [
        [0, 13],
        [0.18, width + 2],
        [0.27, width],
      ]);
      const p = world(mark(0.23));
      const knots = [0.23, 0.38, 0.55, 0.72, 0.85].map((t) => world(mark(t)));
      part('Carving channel with coping', {
        t: 'vertramp',
        vkind: 'half',
        p,
        w: width * 0.52,
        rise: 3.3,
        arc: 67,
        deck: 1.7,
        curve: 'spline',
        rails: true,
        tex: 'solid',
        color: palette[0],
        pts: knots.map(([x, y, z]) => [x - p[0], z - p[2], 0, y - p[1]]),
      });
      slab('Channel apron', [
        [0.83, width],
        [0.92, width + 2],
        [1, 13],
      ]);
    } else if (kind === 'catch' || kind === 'doubleCatch') {
      // The previous grind releases directly onto this bed. A shorter pop
      // catches its near half and a later release still lands on the far half.
      const centre: Mark = [a[0], a[1] + 2, a[2] - 0.18];
      if (kind === 'catch')
        part('Rail-pop spring receiver', {
          t: 'trampoline',
          p: world(centre),
          s: [13, 0.14, 29],
          speed: 16.8,
          amp: 1.04,
        });
      else {
        part('First spring below the transfer', {
          t: 'trampoline',
          p: world([a[0] - 0.5, a[1] - 4.5, a[2] - 0.18]),
          s: [15.5, 0.14, 23],
          speed: 16.8,
          amp: 1.04,
        });
        part('Second spring under the balcony', {
          t: 'trampoline',
          p: world([a[0] + 1.8, a[1] + 17.5, a[2]]),
          s: [17, 0.14, 21],
          speed: 16.8,
          amp: 1.04,
        });
      }
      if (kind === 'doubleCatch') {
        slab(
          'High balcony after the rebound',
          [
            [0.6, width + 14, 1, 0.5],
            [0.76, width + 10, 1, 1],
            [0.88, width + 5, 0, 0.4],
            [1, 14],
          ],
          2.3,
        );
      } else
        slab(
          'High balcony after the rebound',
          [
            [0.34, width + 6, 0, 0.5],
            [0.56, width + 4, 0, 1],
            [0.8, width + 2, 0, 0.4],
            [1, 14],
          ],
          2.3,
        );
    } else if (kind === 'rebound') {
      slab('Bowed launch terrace', [
        [0, 13],
        [0.18, width + 2],
        [0.355, width, 0, -0.02],
      ]);
      part('Rebound bed across the cut', {
        t: 'trampoline',
        p: world([mark(0.47)[0], mark(0.47)[1], mark(0.27)[2] - 0.12]),
        s: [width + 1.4, 0.12, (b[1] - a[1]) * 0.4],
        speed: 15.5,
        amp: 1.05,
      });
      slab(
        'Raised spring receiver',
        [
          [0.72, width + 1, 0, 1.2],
          [0.86, width + 3, 0, 0.8],
          [1, 13],
        ],
        2.3,
      );
    } else if (kind === 'patrol') {
      slab('Offset loading bays', [
        [0, 13],
        [0.22, width, -hand * 1.2],
        [0.45, width + 4, hand * 1.2],
        [0.7, width + 3, -hand],
        [1, 13],
      ]);
      part('Crossing patrol', {
        t: 'enemy',
        foe: 'grunt',
        p: world(mark(0.39, hand * 2)),
        range: 2.3,
        speed: 1.7,
        terrainSupports: true,
      });
      part('Patrol at the far shoulder', {
        t: 'enemy',
        foe: 'grunt',
        p: world(mark(0.79, -hand * 2)),
        range: 2,
        speed: 1.3,
        terrainSupports: true,
      });
    } else if (kind === 'sweep') {
      slab(
        'Banked slalom apron',
        [
          [0, 13],
          [0.25, width + 2, 0, 0, 0.45 * hand],
          [0.51, width + 4],
          [0.77, width, 0, 0, -0.5 * hand],
          [1, 13],
        ],
        1.75,
      );
      const shoulder = 2.4 + Math.max(0, width - 12) * 0.65;
      for (const [t, sign] of [
        [0.42, -1],
        [0.78, 1],
      ])
        part('Pendulum crossing', {
          t: 'pendulum',
          p: world(mark(t, hand * sign * shoulder, 6.3)),
          len: 5.4,
          amp: 0.75,
          speed: 1.22,
          phase: sign > 0 ? 2.1 : 0.25,
          yaw: 90,
        });
    } else {
      const step = kind === 'stairs',
        drop = kind === 'spill',
        flip = kind === 'flip';
      const lip = 0.52,
        land = drop ? 0.72 : 0.67,
        rise = drop ? 1.9 : flip ? 0.65 : 1.25;
      slab(
        step ? 'Stairhead' : drop ? 'Spillway brow' : 'Oblique hip bank',
        [
          [0, 13],
          [0.19, width + 4],
          [0.36, width + 2, 0, 0.25, hand * 0.25],
          [lip, width, 0, rise, hand * 0.3],
        ],
        2.15,
      );
      slab(
        drop ? 'Lower spillway' : step ? 'Stair landing' : 'Opposing bank',
        [
          [land, width + 2, 0, drop ? -0.65 : 0.12, -hand * 0.22],
          [0.83, width + 3, 0, 0, -hand * 0.18],
          [1, 13],
        ],
        1.75,
      );
      if (step) {
        const d = ((b[1] - a[1]) * (land - lip)) / 5;
        for (let j = 0; j < 5; j++) {
          const q = mark(
            lip + ((land - lip) * (j + 0.5)) / 5,
            hand * (width * 0.5 + 1.15),
            rise * (1 - (j + 1) / 5),
          );
          part('Walkable side stair', deck('', q[0], q[2], -q[1], 2.6, d + 0.04, palette[0]));
        }
        rail('Descending stair banister', [
          [0.4, hand * width * 0.45, 1.9],
          [0.54, hand * width * 0.45, 2.05],
          [0.8, hand * width * 0.45, 0.7],
        ]);
      }
      if (flip)
        part('Kickflip aperture', {
          t: 'trickgate',
          trick: 'kick',
          p: world(mark(0.62, 0, 2)),
          s: [9.5, 7, 0.6],
          radius: 4.6,
        });
    }
    // Sight the next contact before committing. Sparse pickup arcs make an
    // offset rail or a changing dock readable at speed and reward the inside cut.
    const guide = (t: number, sideways: number, height: number) =>
      part('Landing pickup', { t: 'wumpa', p: world(mark(t, sideways, height)) });
    if (kind === 'relay') {
      guide(0.37, 0, 2.1);
      guide(0.67, hand * 2.2, 2.3);
    }
    if (kind === 'ferry' || kind === 'tide') guide(0.79, 0, 1.05);
    if (kind === 'fork' || kind === 'switch') {
      guide(0.42, -hand * 3.6, 1.05);
      guide(0.68, -hand * 3.4, 1.05);
    }
    if (kind === 'hip' || kind === 'stairs' || kind === 'flip') guide(0.65, 0, 2.35);
    if (kind === 'rebound' || kind === 'catch' || kind === 'doubleCatch') guide(0.73, 0, 3.05);
    if (pitBeats.includes(index + 1)) {
      const centre = mark(0.57);
      part('Marked death pit', {
        t: 'pit',
        p: [centre[0], -7, -centre[1]],
        s: [15, 1, (b[1] - a[1]) * 0.33],
        color: '#32252c',
      });
    }
    // The widened, fixed landing joins incoming and outgoing cambers. Its
    // recessed top also catches a wheel just outside either diagonal seam.
    if (!springLanding)
      part('Shared landing plinth', {
        t: 'platform',
        p: [b[0], b[2] - 0.36, -b[1]],
        s: [14, 0.44, 9],
        tex: 'solid',
        color: palette[2],
        pts: [
          [-7, -2.7],
          [-4.8, -4.5],
          [4.8, -4.5],
          [7, -2.7],
          [7, 2.7],
          [4.8, 4.5],
          [-4.8, 4.5],
          [-7, 2.7],
        ],
      });
    a = b;
  });
  street(
    'Crystal terrace',
    sections([last, [last[0], end + 10, last[2]], [last[0], end + 34, last[2]]], 15),
    palette,
    2.05,
  );
  add('Crystal', { t: 'crystal', p: world([last[0], end + 25, last[2]]) });
  street(
    'Exit descent',
    sections(
      [
        [last[0], end + 34, last[2]],
        [last[0], end + 40, last[2] - 0.8],
        [0, end + 70, -8],
        [0, end + 76, -8],
      ],
      10,
    ),
  );
  // A second line starts and ends on the spot itself. Its survey is independent
  // of the numbered beats so an upper line can cross above a later landing.
  const [form, from, to, flank, reach, altitude] = crossing;
  const nodes: Mark[] = [[0, 0, 0], ...spans.map((span) => span[1])];
  const near = nodes[from],
    far = nodes[to],
    run = far[1] - near[1];
  const middle = nodes[from + 1],
    viewX = middle[0];
  add('Approach to the crossing', {
    t: 'camnode',
    p: [viewX, 5, -middle[1] + 4],
    s: [47, 38, 46],
    radius: 7,
    cameraView: true,
    cameraPresentationOnly: true,
    cameraPosition: [viewX, 11, -middle[1] + 23],
    cameraTarget: [viewX, 2.9, -middle[1] - 4],
    cameraFollowDistance: 19,
    cameraKeepDistance: true,
    cameraFollowTargetHeight: 3.2,
    cameraFov: 66,
  });
  const under = (label: string, at: Mark, w: number, d: number) => {
    const [x, s, top] = at,
      h = top + 8;
    if (h < 0.9) return;
    add(label, {
      t: 'platform',
      p: [x, top - h / 2, -s],
      s: [w, h, d],
      tex: 'solid',
      color: palette[2],
      pts: [
        [-w / 2, -d * 0.26],
        [-w * 0.3, -d / 2],
        [w * 0.3, -d / 2],
        [w / 2, -d * 0.26],
        [w / 2, d * 0.26],
        [w * 0.3, d / 2],
        [-w * 0.3, d / 2],
        [-w / 2, d * 0.26],
      ],
    });
  };
  for (const q of nodes.slice(1)) under('Pier under the receiving lip', [q[0], q[1] + 0.4, q[2] - 1.4], 5, 3.1);
  under('Terrace foundation', [last[0], end + 13, last[2] - 2.1], 9, 7);
  const branch = (t: number, offset: number, lift: number): Mark => [
    near[0] + (far[0] - near[0]) * t + flank * offset,
    near[1] + run * t,
    near[2] + (far[2] - near[2]) * t + lift,
  ];
  const lane = (name: string, survey: [number, number, number, number, number?][], d = 1.1) =>
    street(
      name,
      survey.map(([t, x, y, width, bank]) => ({ at: branch(t, x, y), width, bank })),
      [palette[0], palette[1], palette[2]],
      d,
      spans.length + 2,
    );
  const edge = (name: string, survey: [number, number, number][]) => {
    const path = survey.map(([t, x, y]) => world(branch(t, x, y))),
      p = path[0];
    add(
      name,
      { t: 'rail', p, pts: path.map(([x, y, z]) => [x - p[0], z - p[2], 2.3, y - p[1]]), curve: 'corner' },
      spans.length + 2,
    );
  };
  const h = altitude,
    r = reach;
  if (form === 'arcade' || form === 'flyover') {
    const mid = form === 'flyover' ? -r * 0.5 : r,
      outer = form === 'flyover' ? -r * 0.83 : r * 0.9;
    lane(form === 'flyover' ? 'Crossing flyover' : 'Upper arcade', [
      [0, 5, 0, 5],
      [0.18, r * 0.78, h * 0.52, 5.8],
      [0.32, r, h, 6.4],
      [0.51, mid, h + 0.4, 5.8],
      [0.69, outer, h, 6.5],
      [0.85, outer * 0.6, h * 0.48, 6],
      [1, 5, 0, 5],
    ]);
    edge('Upper parapet grind', [
      [0.12, r * 0.6, h * 0.42 + 0.8],
      [0.32, r + 2, h + 0.85],
      [0.51, mid + 2, h + 1],
      [0.69, outer + 2, h + 0.8],
      [0.84, outer * 0.65, h * 0.5 + 0.65],
    ]);
    if (form === 'arcade') {
      // Two open masonry bays let the lower line pass through the abutments.
      for (const fraction of [0.32, 0.505, 0.69]) under('Arcade abutment', branch(fraction, r, h - 1.1), 4.1, 4.6);
      for (const start of [0.32, 0.505])
        for (const transverse of [-2.45, 2.45]) {
          const samples = Array.from({ length: 13 }, (_, j) => {
            const t = start + (0.185 * j) / 12;
            return branch(t, r + transverse, h - 1.12);
          });
          add('Vaulted arcade spandrel', vault(samples, 0.78, palette));
        }
    } else {
      under('Near flyover abutment', branch(0.32, r, h - 1.14), 4.4, 5.5);
      under('Far flyover abutment', branch(0.69, outer, h - 1.14), 4.4, 5.5);
    }
  } else if (form === 'terraces') {
    for (let tier = 0; tier < 3; tier++) {
      const offset = r - 4.3 * tier,
        rise = h - 1.05 * tier;
      lane(
        `Curved terrace ${tier + 1}`,
        [
          [0, 4.8, 0, 4.3],
          [0.2, offset * 0.75, rise * 0.4, 4.6],
          [0.37, offset, rise, 4.7],
          [0.57, offset + 3, rise, 5.1],
          [0.78, offset * 0.83, rise * 0.65, 4.5],
          [1, 4.8, 0, 4.3],
        ],
        2.6,
      );
    }
  } else if (form === 'reservoir' || form === 'lock') {
    const low = -Math.abs(h);
    lane(
      'Lower spill channel',
      [
        [0, 5, 0, 5.4],
        [0.22, r * 0.82, low * 0.72, 7],
        [0.39, r, low, 8],
        [0.66, r, low, 8],
        [0.81, r * 0.7, low * 0.55, 6],
        [1, 5, 0, 5.4],
      ],
      1.4,
    );
    const p = world(branch(0.28, r * 0.95, low)),
      spine = [0.28, 0.42, 0.62, 0.74].map((t) =>
        world(branch(t, r + (form === 'reservoir' ? 2 * Math.sin((t - 0.28) * 7) : 0), low)),
      );
    add(form === 'reservoir' ? 'Curved reservoir wall and coping' : 'Lock wall and coping', {
      t: 'vertramp',
      vkind: 'quarter',
      p,
      pts: spine.map(([x, y, z]) => [x - p[0], z - p[2], 0, y - p[1]]),
      curve: 'spline',
      w: 3.8,
      rise: form === 'lock' ? 3.7 : 5.4,
      arc: 74,
      deck: 1.9,
      color: palette[0],
      tex: 'solid',
    });
    edge('Overflow lip', [
      [0.19, r * 0.75, low * 0.54 + 1],
      [0.4, r - 3.8, low + 1.25],
      [0.64, r - 3.8, low + 1.25],
      [0.82, r * 0.7, low * 0.51 + 0.6],
    ]);
  } else if (form === 'roofs') {
    lane(
      'First pitched roof',
      [
        [0, 5, 0, 4.8],
        [0.17, r * 0.7, h * 0.52, 7, 0.8 * flank],
        [0.31, r, h, 7.8, 1.1 * flank],
        [0.46, r + 0.8, h + 0.5, 6.4, 0.65 * flank],
      ],
      2.8,
    );
    lane(
      'Offset sawtooth roof',
      [
        [0.51, r - 1.8, h - 0.65, 8, -0.7 * flank],
        [0.66, r + 1, h + 0.2, 8, -1.1 * flank],
        [0.84, r * 0.66, h * 0.6, 6, -0.5 * flank],
        [1, 5, 0, 5],
      ],
      2.8,
    );
    under('First roof stair tower', branch(0.31, r, h - 2.8), 5, 9);
    under('Return roof tower', branch(0.69, r, h - 2.8), 5, 9);
  } else {
    lane(
      'Switchyard mezzanine',
      [
        [0, 4.8, 0, 5],
        [0.17, r * 0.72, h * 0.35, 5],
        [0.32, r, h, 6],
        [0.45, r, h, 4.4],
      ],
      2,
    );
    lane(
      'Scissors landing',
      [
        [0.7, r - 1, h - 0.5, 7.4],
        [0.83, r * 0.76, h * 0.5, 6.1],
        [1, 5, 0, 5],
      ],
      2,
    );
    edge('Scissors inside grind', [
      [0.32, r - 1, h + 0.85],
      [0.49, r - 3, h + 1.1],
      [0.65, r - 2, h + 0.65],
      [0.76, r * 0.88, h * 0.74],
    ]);
    edge('Scissors outside transfer', [
      [0.34, r + 1, h + 0.8],
      [0.49, r + 4, h + 1.3],
      [0.65, r + 0.7, h + 1.2],
      [0.78, r * 0.88, h * 0.7 + 0.6],
    ]);
    under('Scissors undercroft', branch(0.32, r, h - 2), 3.6, 5);
    under('Mezzanine stairs', branch(0.72, r - 1, h - 2.4), 3.6, 5);
  }
  // The lower concourse touches street level midway and rejoins the crystal
  // terrace from its side. A fall, a dismount and a deliberate walk all work.
  walk.push([side * 4, -23, 0], [side * 12, -16, -0.3], [side * 21, -8, -3.4]);
  spans.forEach(([, b, bow], i) => {
    const outer = side * Math.max(22, side * b[0] + 12);
    if (i < spans.length - 1) walk.push([outer + Math.sign(bow) * 1.5, b[1] - 5, i === 0 ? -8 : -3.4]);
  });
  walk.push(
    [side * Math.max(22, side * last[0] + 13), end - 12, last[2] - 3],
    [last[0] + side * 12, end + 5, last[2] - 0.85],
    [last[0] + side * 5, end + 13, last[2]],
  );
  street('Lower walking concourse', sections(walk, 5.5), sidewalk, 0.7);
  return {
    id,
    name: String(id),
    brief,
    spawn: [0, 0.15, 43],
    exit: [0, -8, -end - 89],
    skateLine: true,
    line: { spans, side, walk },
    reviewViews: [{ name: 'approach', position: [0, 1, 12] }],
    components,
  };
}
