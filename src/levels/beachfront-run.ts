import type { CustomComponent, CustomLevelData } from "../level";
import {
  BEACHFRONT_COURSE_LENGTH as COURSE_LENGTH,
  beachfrontFootprintMaximumHeight,
  beachfrontFrameAtDistance,
  beachfrontPointAtDistance,
  beachfrontSandHeight as sandHeight,
  clampBeachfront,
  type BeachfrontWorldPoint,
} from "../beachfrontCourse";

/**
 * Unity authoring travels from -20 toward +720 on native +Z. This source
 * level reflects native Z (`webZ = -unityZ`) so the route runs down the
 * prototype's conventional -Z corridor without mirroring its lateral bends.
 */

type WorldPoint = Readonly<BeachfrontWorldPoint>;

interface BoardwalkSpan {
  island: number;
  start: number;
  end: number;
}

interface BoardwalkSequence {
  sequence: number;
  lateral: number;
  width: number;
  deckY: number;
  spans: BoardwalkSpan[];
  accessStart: number;
  accessEnd: number;
}

const BOARDWALK_ACCESS = 9;
const BOARDWALK_ACCESS_CLEARANCE = 0.18;
const BOARDWALK_ISLAND_RISE = 4;

const GROUP = {
  actors: 4,
  camera: 5,
  boardwalkFirst: 10,
} as const;

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;
const r3 = (value: number): number => Math.round(value * 1000) / 1000;
const clamp = (value: number, minimum: number, maximum: number): number =>
  clampBeachfront(value, minimum, maximum);
const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const pointAt = (distance: number, lateral = 0, y?: number): WorldPoint => {
  const point = beachfrontPointAtDistance(distance, lateral, y);
  return [r2(point[0]), r2(point[1]), r2(point[2])];
};

// Figma frame 18:9820, atlas snapshot 1536003e3a33 (12 October 2026).
// Each edited rail pair defines one rigid X/Z transform for its whole deck.
// Tuples are [angle in the X/Z plane, world X translation, world Z translation].
const boardwalkEdits = [
  [2.008581, -2.215731, -0.463551],
  [-2.282078, 3.218535, 0.526747],
  [2.553725, -9.204933, 0.217270],
  [0, 0, 0],
  [-2.543329, 18.938193, -0.693789],
  [0, -6.25, 0],
  [0, -3.75, 0],
] as const;

const boardwalkXZ = (
  sequence: number,
  x: number,
  z: number,
  inverse = false,
): [number, number] => {
  const [degrees, tx, tz] = boardwalkEdits[sequence];
  const angle = (degrees * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (inverse) return [
    c * (x - tx) + s * (z - tz),
    -s * (x - tx) + c * (z - tz),
  ];
  return [c * x - s * z + tx, s * x + c * z + tz];
};

// Invert the shared curved beach frame to seat freely placed atlas objects.
const courseCoordinates = (x: number, z: number): [number, number] => {
  let distance = clamp(20 - z, 0, COURSE_LENGTH);
  for (let iteration = 0; iteration < 8; iteration++) {
    const f = beachfrontFrameAtDistance(distance);
    const along = (x - f.x) * f.fx + (z - f.z) * f.fz;
    distance = clamp(distance + along * -f.fz, 0, COURSE_LENGTH);
  }
  const f = beachfrontFrameAtDistance(distance);
  return [distance, (x - f.x) * f.rx + (z - f.z) * f.rz];
};
const sandAtWorld = (x: number, z: number): number => {
  const [distance, lateral] = courseCoordinates(x, z);
  return sandHeight(distance, lateral);
};

const pathPoints = (
  points: readonly WorldPoint[],
): NonNullable<CustomComponent["pts"]> => {
  const [x0, y0, z0] = points[0];
  return points.map(
    ([x, y, z]) =>
      [r3(x - x0), r3(z - z0), 0, r2(y - y0)] as [
        number,
        number,
        number,
        number,
      ],
  );
};

const boardwalkDefinitions = [
  [50, -1.5, 5.5],
  [138, 1.4, 5.8],
  [228, -3, 5.2],
  [318, 0.5, 6],
  [414, -2, 5.5],
  [505, 2, 5.8],
  [604, -1, 6],
] as const;

const boardwalkSequences: BoardwalkSequence[] = boardwalkDefinitions.map(
  ([sequenceStart, lateral, width], sequence) => {
    const spans: BoardwalkSpan[] = [];
    let cursor = sequenceStart;
    for (let island = 0; island < 4; island++) {
      const length = 10 + ((sequence * 5 + island * 7) % 9);
      const start = cursor;
      const end = start + length;
      spans.push({ island, start, end });
      cursor = end + (island < 3 ? 3 + ((sequence + island) % 3) : 0);
    }
    const islandBases = spans.map((span) => {
      const middle = (span.start + span.end) * 0.5;
      const centerBase = sandHeight(middle, lateral) + 0.28;
      const footprintBase =
        beachfrontFootprintMaximumHeight(
          span.start,
          span.end,
          lateral,
          width,
          13,
          13,
        ) + 0.04;
      return Math.max(centerBase, footprintBase);
    });
    return {
      sequence,
      lateral,
      width,
      deckY: Math.max(...islandBases) + BOARDWALK_ISLAND_RISE,
      spans,
      accessStart: spans[0].start - BOARDWALK_ACCESS,
      accessEnd: spans[spans.length - 1].end + BOARDWALK_ACCESS,
    };
  },
);

const boardwalkLateral = (
  sequence: BoardwalkSequence,
  span: BoardwalkSpan,
  distance: number,
): number => {
  const onIsland = distance >= span.start && distance <= span.end;
  const t = clamp(
    (distance - span.start) / Math.max(0.01, span.end - span.start),
    0,
    1,
  );
  const curveSign = (sequence.sequence + span.island) % 2 === 0 ? 1 : -1;
  const curve = onIsland ? curveSign * 0.26 * Math.sin(Math.PI * t) : 0;
  return sequence.lateral + curve;
};

const boardwalkPoint = (
  sequence: BoardwalkSequence,
  span: BoardwalkSpan,
  distance: number,
  y: number,
): WorldPoint => {
  const [x, , z] = pointAt(distance, boardwalkLateral(sequence, span, distance), y);
  const [movedX, movedZ] = boardwalkXZ(sequence.sequence, x, z);
  return [r3(movedX), y, r3(movedZ)];
};

const islandWidthScale = (
  sequence: BoardwalkSequence,
  span: BoardwalkSpan,
  distance: number,
  includeSecondaryCurve: boolean,
): number => {
  const t = clamp(
    (distance - span.start) / Math.max(0.01, span.end - span.start),
    0,
    1,
  );
  const curveSign = (sequence.sequence + span.island) % 2 === 0 ? 1 : -1;
  return (
    0.96 +
    0.06 * Math.sin(Math.PI * t) +
    (includeSecondaryCurve
      ? 0.015 * curveSign * Math.sin(Math.PI * 2 * t)
      : 0)
  );
};

const accessNode = (
  sequence: BoardwalkSequence,
  span: BoardwalkSpan,
  distance: number,
  entry: boolean,
): { point: WorldPoint; width: number } => {
  const accessStart = entry ? sequence.accessStart : span.start;
  const accessEnd = entry ? span.end : sequence.accessEnd;
  const accessT = clamp(
    (distance - accessStart) / Math.max(0.01, accessEnd - accessStart),
    0,
    1,
  );
  const lateral = boardwalkLateral(sequence, span, distance);
  const [sourceX, , sourceZ] = pointAt(distance, lateral);
  const [x, z] = boardwalkXZ(sequence.sequence, sourceX, sourceZ);
  const groundY = (sequence.sequence === 3
    ? sandHeight(distance, lateral)
    : sandAtWorld(x, z)) + BOARDWALK_ACCESS_CLEARANCE;
  const eased = smoothstep(accessT);
  const topY = entry
    ? groundY + (sequence.deckY - groundY) * eased
    : sequence.deckY + (groundY - sequence.deckY) * eased;
  const sourceWidth = islandWidthScale(sequence, span, distance, false);
  const widthScale = entry
    ? 0.84 + (sourceWidth - 0.84) * accessT
    : sourceWidth + (0.84 - sourceWidth) * accessT;
  return {
    point: boardwalkPoint(sequence, span, distance, r2(topY)),
    width: sequence.width * widthScale,
  };
};

boardwalkSequences.forEach((sequence) => {
  const first = sequence.spans[0];
  const last = sequence.spans[sequence.spans.length - 1];
  const points: WorldPoint[] = [];
  const widths: number[] = [];
  const firstDistances = [
    sequence.accessStart,
    first.start,
    (first.start + first.end) * 0.5,
    ((first.start + first.end) * 0.5 + first.end) * 0.5,
    first.end,
  ];
  for (const distance of firstDistances) {
    const node = accessNode(sequence, first, distance, true);
    points.push(node.point);
    widths.push(node.width);
  }

  for (const span of sequence.spans.slice(1, -1)) {
    for (const distance of [
      span.start,
      (span.start + span.end) * 0.5,
      span.end,
    ]) {
      points.push(boardwalkPoint(sequence, span, distance, sequence.deckY));
      widths.push(
        sequence.width * islandWidthScale(sequence, span, distance, true),
      );
    }
  }

  const lastDistances = [
    last.start,
    (last.start + (last.start + last.end) * 0.5) * 0.5,
    (last.start + last.end) * 0.5,
    last.end,
    sequence.accessEnd,
  ];
  for (const distance of lastDistances) {
    const node = accessNode(sequence, last, distance, false);
    points.push(node.point);
    widths.push(node.width);
  }

  const [x, y, z] = points[0];
  add({
    t: "woodpath",
    p: [x, y, z],
    pts: pathPoints(points),
    widths: widths.map(r2),
    w: sequence.width,
    curve: "spline",
    structureStyle: "beach",
    plankPalette: "placeholder-board",
    polePalette: "placeholder-pole",
    scaffold: true,
    supports: true,
    rails: true,

    spacing: 0.72,
    baySpacing: 4.2,
    supportDepth: 4.5,
    supportBaseY: r2(sequence.deckY - BOARDWALK_ISLAND_RISE),
    terrainSupports: true,
    seed: 84100 + sequence.sequence * 4,
    tex: "plank",
    color: "#9a6434",
    nm: `boardwalk sequence ${sequence.sequence + 1}`,
    grp: GROUP.boardwalkFirst + sequence.sequence,
  });
});

const surfaceYAtWorld = (x: number, z: number): number => {
  let highest = sandAtWorld(x, z);
  for (const sequence of boardwalkSequences) {
    const [sourceX, sourceZ] = boardwalkXZ(sequence.sequence, x, z, true);
    const [distance, lateral] = courseCoordinates(sourceX, sourceZ);
    if (Math.abs(lateral - sequence.lateral) > sequence.width * 0.58) continue;
    const first = sequence.spans[0];
    const last = sequence.spans[sequence.spans.length - 1];
    let boardwalkY: number | undefined;
    if (distance >= sequence.accessStart && distance <= first.end)
      boardwalkY = accessNode(sequence, first, distance, true).point[1];
    else if (distance > first.end && distance < last.start)
      // The former interior holes remain level inside one swept deck.
      boardwalkY = sequence.deckY;
    else if (distance >= last.start && distance <= sequence.accessEnd)
      boardwalkY = accessNode(sequence, last, distance, false).point[1];
    if (boardwalkY !== undefined) highest = Math.max(highest, boardwalkY);
  }
  return r2(highest);
};

const surfaceY = (distance: number, lateral: number): number => {
  const [x, , z] = pointAt(distance, lateral);
  return surfaceYAtWorld(x, z);
};

// Stable atlas crate numbers, with centres converted from 8 px per metre.
const movedCrates: Readonly<Record<number, readonly [number, number]>> = {
  3: [16.75, -97.875],
  4: [17, -118.125],
  5: [11.875, -184.375],
  8: [1.375, -305.5],
  9: [1, -350.625],
  12: [-15.75, -504],
  13: [-19.125, -544.125],
  15: [-17.5, -655],
  16: [-11.75, -681.75],
};

const crateDefinitions = [
  [-1, 54, "wood"],
  [-3, 85, "mystery"],
  [4, 118, "wood"],
  [5.2, 138, "wood"],
  [3, 204, "metal"],
  [-2, 246, "wood"],
  [5.8, 278, "mystery"],
  [-4, 327, "wood"],
  [3, 370, "wood"],
  [6, 406, "bouncy"],
  [-4, 488, "wood"],
  [5, 525, "wood"],
  [1, 564, "mystery"],
  [-3, 631, "wood"],
  [5.6, 670, "wood"],
  [2, 702, "mask"],
] as const;

crateDefinitions.forEach(([lateral, distance, kind], index) => {
  const [sourceX, , sourceZ] = pointAt(distance, lateral);
  const [x, z] = movedCrates[index + 1] ?? [sourceX, sourceZ];
  add({
    t: "crate",
    p: [x, surfaceYAtWorld(x, z), z],
    kind,
    grp: GROUP.actors,
  });
});

const checkpoints = [
  [4.8, 163],
  [-4.8, 306],
  [4.5, 452],
  [5.5, 598],
] as const;
checkpoints.forEach(([lateral, distance], index) => {
  const [x, , z] = pointAt(distance, lateral);
  add({
    t: "checkpoint",
    p: [x, surfaceY(distance, lateral), z],
    nm: `beach checkpoint ${index + 1}`,
    grp: GROUP.actors,
  });
});

// Preserve Unity's 84-fruit rhythm, including the landward-biased run late
// in each 28-fruit phrase. Fruit ray-seats onto a deck when it crosses one.
for (let index = 0; index < 84; index++) {
  const distance = 35 + index * 8.05;
  const phase = index % 28;
  const lateral = clamp(
    phase >= 18 && phase <= 24
      ? 4.75 + 1.05 * Math.sin(index * 0.51)
      : -0.45 + 5.4 * Math.sin(index * 0.39),
    -7.2,
    6.2,
  );
  const [x, , z] = pointAt(distance, lateral);
  add({
    t: "wumpa",
    p: [x, r2(surfaceY(distance, lateral) + 0.92), z],
    grp: GROUP.actors,
  });
}

for (let distance = 0; distance <= COURSE_LENGTH; distance += 55) {
  const [x, , z] = pointAt(distance);
  add({
    t: "camnode",
    p: [x, r2(surfaceY(distance, 0) + 2.2), z],
    radius: 18,
    grp: GROUP.camera,
  });
}

const [gateX, gateZ] = [-10, -702];
add({
  t: "gate",
  p: [gateX, surfaceYAtWorld(gateX, gateZ), gateZ],
  yaw: 0,
  nm: "beach finish",
  grp: GROUP.actors,
});

const [crystalX, crystalZ] = [-19.625, -647.375];
add({
  t: "crystal",
  p: [crystalX, r2(surfaceYAtWorld(crystalX, crystalZ) + 0.65), crystalZ],
  nm: "beach crystal",
  grp: GROUP.actors,
});

const [spawnX, spawnZ] = [2.125, -1.625];

// Apply the requested whole-course reflection after the atlas-space edits.
// The terrain, shoreline, cliff collision, and native camera lane are mirrored
// by the native Beachside builder using the same world-X convention.
for (const component of components) {
  component.p[0] = -component.p[0];
  for (const point of component.pts ?? []) point[0] = -point[0];
  if (component.yaw !== undefined) component.yaw = -component.yaw;
}

export const BEACHFRONT_RUN_LEVEL: CustomLevelData = {
  v: 1,
  name: "Beachside Run",
  spawn: [-spawnX, r2(surfaceYAtWorld(spawnX, spawnZ) + 0.14), spawnZ],
  killY: -12,
  sky: "coast",
  groups: [
    { id: GROUP.actors, nm: "route actors" },
    { id: GROUP.camera, nm: "camera route" },
    ...boardwalkDefinitions.map((_, index) => ({
      id: GROUP.boardwalkFirst + index,
      nm: `boardwalk sequence ${index + 1}`,
    })),
  ],
  components,
};
