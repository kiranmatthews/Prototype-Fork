import type { CustomComponent, CustomLevelData } from "../level";

/**
 * Unity authoring travels from -20 toward +720 on native +Z. This source
 * level reflects native Z (`webZ = -unityZ`) so the route runs down the
 * prototype's conventional -Z corridor without mirroring its lateral bends.
 */

type WorldPoint = readonly [x: number, y: number, z: number];

interface CourseFrame {
  x: number;
  z: number;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

interface BoardwalkIsland {
  sequence: number;
  island: number;
  start: number;
  end: number;
  lateral: number;
  width: number;
  deckY: number;
}

const COURSE_LENGTH = 740;
const COURSE_MINIMUM_UNITY_Z = -20;
const BOARDWALK_ACCESS = 9;
const BOARDWALK_DECK_Y = 1.85;

const GROUP = {
  beach: 1,
  cliff: 2,
  ocean: 3,
  actors: 4,
  camera: 5,
  boardwalkFirst: 10,
} as const;

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.max(minimum, Math.min(maximum, value));
const smoothstep = (value: number): number => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const frameAt = (rawDistance: number): CourseFrame => {
  const distance = clamp(rawDistance, 0, COURSE_LENGTH);
  const phase = (Math.PI * 2 * distance) / COURSE_LENGTH;
  const x = 15 * Math.sin(phase) + 6 * Math.sin(phase * 2);
  const derivative =
    (15 * Math.PI * 2 * Math.cos(phase) +
      12 * Math.PI * 2 * Math.cos(phase * 2)) /
    COURSE_LENGTH;
  const magnitude = Math.hypot(derivative, 1);
  const fx = derivative / magnitude;
  const fz = -1 / magnitude;
  return {
    x,
    z: -(COURSE_MINIMUM_UNITY_Z + distance),
    fx,
    fz,
    // Reflection reverses handedness: this is the exact converted Unity
    // `Vector3.Cross(up, forward)` lateral vector.
    rx: -fz,
    rz: fx,
  };
};

const sandHeight = (distance: number, lateral = 0): number => {
  const longitudinal =
    0.075 * Math.sin(distance * 0.019 + 0.55 * Math.sin(distance * 0.0043)) +
    0.05 * Math.sin(distance * 0.051 + 1.1);
  const bank = 0.035 * lateral + 0.018 * Math.sin(distance * 0.11 + lateral);
  return r2(0.18 + longitudinal + bank);
};

const pointAt = (distance: number, lateral = 0, y?: number): WorldPoint => {
  const frame = frameAt(distance);
  return [
    r2(frame.x + frame.rx * lateral),
    r2(y ?? sandHeight(distance, lateral)),
    r2(frame.z + frame.rz * lateral),
  ];
};

const yawAt = (distance: number): number => {
  const frame = frameAt(distance);
  return r2((Math.atan2(-frame.fx, -frame.fz) * 180) / Math.PI);
};

const pathPoints = (
  points: readonly WorldPoint[],
): NonNullable<CustomComponent["pts"]> => {
  const [x0, y0, z0] = points[0];
  return points.map(
    ([x, y, z]) =>
      [r2(x - x0), r2(z - z0), 0, r2(y - y0)] as [
        number,
        number,
        number,
        number,
      ],
  );
};

// One continuous procedural sand ribbon follows the same two-frequency
// shoreline spine as the Unity scene.
const sandRoute: WorldPoint[] = [];
for (let distance = 0; distance <= COURSE_LENGTH; distance += 40) {
  sandRoute.push(pointAt(distance));
}
if (sandRoute[sandRoute.length - 1][2] !== pointAt(COURSE_LENGTH)[2]) {
  sandRoute.push(pointAt(COURSE_LENGTH));
}
add({
  t: "terrain",
  p: [...sandRoute[0]],
  pts: pathPoints(sandRoute),
  w: 34,
  amp: 0.035,
  berms: false,
  curve: "spline",
  tex: "sand",
  color: "#e6c788",
  nm: "continuous beach and shallow shelf",
  grp: GROUP.beach,
});

// Procedural ocean/deep-water chunks sit just seaward of the sand ribbon.
// The blue deck is presentation; the inset pit is the actual deep-water kill.
for (let distance = 35; distance < COURSE_LENGTH; distance += 70) {
  const [oceanX, , oceanZ] = pointAt(distance, -34, -1.38);
  add({
    t: "platform",
    p: [oceanX, -1.53, oceanZ],
    s: [36, 0.3, 76],
    yaw: yawAt(distance),
    tex: "metal",
    color: "#238ea9",
    nm: "ocean surface",
    grp: GROUP.ocean,
  });
  const [hazardX, , hazardZ] = pointAt(distance, -31, -1.55);
  add({
    t: "pit",
    // Kept just under the blue surface: its shallow touch volume still kills
    // on contact, while the generic ember-pit artwork remains out of sight.
    p: [hazardX, -1.55, hazardZ],
    s: [25, 1, 69],
    yaw: yawAt(distance),
    nm: "deep water",
    grp: GROUP.ocean,
  });
}

// Chunked cliff forms keep the landward edge readable without importing the
// Unity Meshy cliff asset or producing one enormous un-cullable mesh.
for (let distance = 18, index = 0; distance < COURSE_LENGTH; distance += 46, index++) {
  const [x, y, z] = pointAt(distance, 19);
  const height = 4.8 + (index % 4) * 0.65;
  add({
    t: "rock",
    p: [x, r2(y + height * 0.34), z],
    s: [8.5 + (index % 3), height, 28],
    seed: 8100 + index * 31,
    color: index % 2 === 0 ? "#948774" : "#817665",
    tex: "stone",
    nm: "buried coast cliff",
    grp: GROUP.cliff,
  });
}

const boardwalkDefinitions = [
  [50, -1.5, 5.5],
  [138, 1.4, 5.8],
  [228, -3, 5.2],
  [318, 0.5, 6],
  [414, -2, 5.5],
  [505, 2, 5.8],
  [604, -1, 6],
] as const;

const boardwalkIslands: BoardwalkIsland[] = [];

boardwalkDefinitions.forEach(([sequenceStart, lateral, width], sequence) => {
  let cursor = sequenceStart;
  for (let island = 0; island < 4; island++) {
    const length = 10 + ((sequence * 5 + island * 7) % 9);
    const start = cursor;
    const end = start + length;
    boardwalkIslands.push({
      sequence,
      island,
      start,
      end,
      lateral,
      width,
      deckY: BOARDWALK_DECK_Y + 0.08 * Math.sin(sequence * 0.9),
    });
    cursor = end + (island < 3 ? 3 + ((sequence + island) % 3) : 0);
  }
});

const boardwalkPoint = (
  distance: number,
  lateral: number,
  y: number,
  curveSign: number,
  start: number,
  end: number,
): WorldPoint => {
  const onIsland = distance >= start && distance <= end;
  const t = clamp((distance - start) / Math.max(0.01, end - start), 0, 1);
  const curve = onIsland ? curveSign * 0.26 * Math.sin(Math.PI * t) : 0;
  return pointAt(distance, lateral + curve, y);
};

boardwalkIslands.forEach((island) => {
  const curveSign = (island.sequence + island.island) % 2 === 0 ? 1 : -1;
  const points: WorldPoint[] = [];
  const widths: number[] = [];
  if (island.island === 0) {
    const accessStart = island.start - BOARDWALK_ACCESS;
    points.push(
      boardwalkPoint(
        accessStart,
        island.lateral,
        sandHeight(accessStart, island.lateral) + 0.12,
        curveSign,
        island.start,
        island.end,
      ),
      boardwalkPoint(
        island.start - 3,
        island.lateral,
        r2(
          sandHeight(island.start - 3, island.lateral) +
            (island.deckY - sandHeight(island.start - 3, island.lateral)) * 0.72,
        ),
        curveSign,
        island.start,
        island.end,
      ),
    );
    widths.push(island.width * 0.84, island.width * 0.93);
  }
  points.push(
    boardwalkPoint(
      island.start,
      island.lateral,
      island.deckY,
      curveSign,
      island.start,
      island.end,
    ),
    boardwalkPoint(
      (island.start + island.end) * 0.5,
      island.lateral,
      island.deckY,
      curveSign,
      island.start,
      island.end,
    ),
    boardwalkPoint(
      island.end,
      island.lateral,
      island.deckY,
      curveSign,
      island.start,
      island.end,
    ),
  );
  widths.push(island.width, island.width * 1.02, island.width);
  if (island.island === 3) {
    const accessEnd = island.end + BOARDWALK_ACCESS;
    points.push(
      boardwalkPoint(
        island.end + 3,
        island.lateral,
        r2(
          sandHeight(island.end + 3, island.lateral) +
            (island.deckY - sandHeight(island.end + 3, island.lateral)) * 0.72,
        ),
        curveSign,
        island.start,
        island.end,
      ),
      boardwalkPoint(
        accessEnd,
        island.lateral,
        sandHeight(accessEnd, island.lateral) + 0.12,
        curveSign,
        island.start,
        island.end,
      ),
    );
    widths.push(island.width * 0.93, island.width * 0.84);
  }
  const [x, y, z] = points[0];
  add({
    t: "woodpath",
    p: [x, y, z],
    pts: pathPoints(points),
    widths: widths.map(r2),
    w: island.width,
    curve: "spline",
    scaffold: true,
    supports: true,
    rails: true,
    spacing: 0.72,
    baySpacing: 4.2,
    supportDepth: 4.5,
    terrainSupports: true,
    seed: 84100 + island.sequence * 4 + island.island,
    tex: "plank",
    color: "#9a6434",
    nm: `boardwalk ${island.sequence + 1}.${island.island + 1}`,
    grp: GROUP.boardwalkFirst + island.sequence,
  });
});

const surfaceY = (distance: number, lateral: number): number => {
  let highest = sandHeight(distance, lateral);
  for (const island of boardwalkIslands) {
    if (Math.abs(lateral - island.lateral) > island.width * 0.58) continue;
    let boardwalkY: number | undefined;
    if (distance >= island.start && distance <= island.end) {
      boardwalkY = island.deckY;
    } else if (
      island.island === 0 &&
      distance >= island.start - BOARDWALK_ACCESS &&
      distance < island.start
    ) {
      const t = smoothstep((distance - island.start + BOARDWALK_ACCESS) / BOARDWALK_ACCESS);
      boardwalkY =
        sandHeight(distance, lateral) +
        (island.deckY - sandHeight(distance, lateral)) * t;
    } else if (
      island.island === 3 &&
      distance > island.end &&
      distance <= island.end + BOARDWALK_ACCESS
    ) {
      const t = smoothstep((distance - island.end) / BOARDWALK_ACCESS);
      boardwalkY =
        island.deckY + (sandHeight(distance, lateral) - island.deckY) * t;
    }
    if (boardwalkY !== undefined) highest = Math.max(highest, boardwalkY);
  }
  return r2(highest);
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

crateDefinitions.forEach(([lateral, distance, kind]) => {
  const [x, , z] = pointAt(distance, lateral);
  add({
    t: "crate",
    p: [x, surfaceY(distance, lateral), z],
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

const [gateX, , gateZ] = pointAt(720);
add({
  t: "gate",
  p: [gateX, surfaceY(720, 0), gateZ],
  yaw: yawAt(720),
  nm: "beach finish",
  grp: GROUP.actors,
});

const [spawnX, , spawnZ] = pointAt(12);

export const BEACHFRONT_RUN_LEVEL: CustomLevelData = {
  v: 1,
  name: "Beachside Run",
  spawn: [spawnX, r2(surfaceY(12, 0) + 0.14), spawnZ],
  killY: -12,
  sky: "coast",
  groups: [
    { id: GROUP.beach, nm: "continuous sand" },
    { id: GROUP.cliff, nm: "landward cliff" },
    { id: GROUP.ocean, nm: "ocean and deep-water hazard" },
    { id: GROUP.actors, nm: "route actors" },
    { id: GROUP.camera, nm: "camera route" },
    ...boardwalkDefinitions.map((_, index) => ({
      id: GROUP.boardwalkFirst + index,
      nm: `boardwalk sequence ${index + 1}`,
    })),
  ],
  components,
};
