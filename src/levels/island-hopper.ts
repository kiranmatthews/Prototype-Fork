import type { CustomComponent, CustomLevelData } from "../level";

type Vec3 = [x: number, y: number, z: number];

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;
const r3 = (value: number): number => Math.round(value * 1000) / 1000;

const COURSE_LENGTH = 384;
const DECK_Y = 1.05;

const GROUP = {
  water: 1,
  islands: 2,
  boardwalks: 3,
  jumps: 4,
  ropes: 5,
  actors: 6,
  camera: 7,
  scenery: 8,
} as const;

/** Unity's IslandHopperCenterAtDistance, with Unity Z mirrored into web -Z. */
const centerAt = (distance: number): Vec3 => {
  const d = Math.max(0, Math.min(COURSE_LENGTH, distance));
  const t = d / COURSE_LENGTH;
  const sin = Math.sin(Math.PI * t);
  return [46 * sin * sin * Math.sin(2 * Math.PI * t), DECK_Y, 24 - d];
};

const frameAt = (
  distance: number,
): { center: Vec3; forward: Vec3; right: Vec3 } => {
  const d = Math.max(0, Math.min(COURSE_LENGTH, distance));
  const before = centerAt(Math.max(0, d - 0.2));
  const after = centerAt(Math.min(COURSE_LENGTH, d + 0.2));
  const dx = after[0] - before[0];
  const dz = after[2] - before[2];
  const length = Math.hypot(dx, dz) || 1;
  const forward: Vec3 = [dx / length, 0, dz / length];
  // This is Unity's authored right vector after mirroring Unity Z. Keeping
  // it (instead of re-deriving a new handedness) preserves every actor offset.
  const right: Vec3 = [-forward[2], 0, forward[0]];
  return { center: centerAt(d), forward, right };
};

const offsetFromFrame = (distance: number, lateral = 0, lift = 0): Vec3 => {
  const { center, right } = frameAt(distance);
  return [
    r2(center[0] + right[0] * lateral),
    r2(center[1] + lift),
    r2(center[2] + right[2] * lateral),
  ];
};

const pathPoints = (
  start: number,
  end: number,
  rise = 0,
  forceCount?: number,
): NonNullable<CustomComponent["pts"]> => {
  const count = forceCount ?? Math.max(3, Math.ceil((end - start) / 4) + 1);
  const origin = centerAt(start);
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const point = centerAt(start + (end - start) * t);
    return [
      r3(point[0] - origin[0]),
      r3(point[2] - origin[2]),
      0,
      r3(point[1] - origin[1] + rise * t),
      0,
    ];
  });
};

const woodPath = (
  name: string,
  start: number,
  end: number,
  width: number,
  grp: number,
  seed: number,
  rise = 0,
): void => {
  const p = centerAt(start);
  const points = pathPoints(start, end, rise, rise === 0 ? undefined : 2);
  add({
    t: "woodpath",
    p: [r3(p[0]), r3(p[1]), r3(p[2])],
    w: width,
    s: [width, 0.42, 1],
    pts: points,
    widths: points.map(() => width),
    curve: points.length >= 3 ? "spline" : undefined,
    scaffold: true,
    supports: true,
    rails: true,
    spacing: 0.68,
    baySpacing: 3.8,
    supportDepth: 4.65,
    terrainSupports: true,
    color: "#8b5a2b",
    tex: "plank",
    seed,
    nm: name,
    grp,
  });
};

const PLATFORM_RUNS = [
  ["Platform 01", 0, 32, 19],
  ["Platform 02", 86.9, 126, 20.5],
  ["Platform 03", 172, 212, 18.5],
  ["Platform 04", 257.93, 294, 20],
  ["Platform 05", 334, 384, 22],
] as const;

const WALK_RUNS = [
  ["Walk 01", 31.2, 74, 8.2],
  ["Walk 02", 125.2, 166, 7.8],
  ["Walk 03", 211.2, 244, 8],
  ["Walk 04", 293.2, 327, 7.8],
] as const;

// One broad visual ocean, with a low death sheet below it. The sheet sits far
// enough under the island shelves and deck that only a genuine water fall hits.
add({
  t: "decor",
  dkind: "block",
  p: [0, -0.42, -168],
  s: [220, 0.08, 440],
  color: "#278cab",
  tex: "metal",
  nm: "shallow tropical ocean",
  grp: GROUP.water,
});
add({
  t: "pit",
  p: [0, -1.45, -168],
  s: [220, 1, 440],
  nm: "deep water death",
  grp: GROUP.water,
});

// Unity's five sand shelves are low elliptical playable islands. The swept
// boardwalk is only 0.37 m above their crests, so support posts visibly meet.
PLATFORM_RUNS.forEach(([name, start, end, width], index) => {
  const middle = (start + end) / 2;
  const { center, forward, right } = frameAt(middle);
  const halfWidth = width / 2 + 8;
  const halfLength = (end - start) / 2 + 7;
  const points: [number, number][] = [];
  for (let step = 0; step < 24; step++) {
    const angle = (step / 24) * Math.PI * 2;
    const lateral = Math.cos(angle) * halfWidth;
    const longitudinal = Math.sin(angle) * halfLength;
    points.push([
      r2(right[0] * lateral + forward[0] * longitudinal),
      r2(right[2] * lateral + forward[2] * longitudinal),
    ]);
  }
  add({
    t: "platform",
    p: [r2(center[0]), 0.36, r2(center[2])],
    s: [halfWidth * 2, 0.64, halfLength * 2],
    pts: points,
    tex: "sand",
    color: "#e8a84f",
    nm: `Sand island ${index + 1}`,
    grp: GROUP.islands,
  });

  // Sparse island silhouettes keep the route readable without turning the
  // level into a high-draw-call foliage field.
  for (const side of [-1, 1]) {
    const prop = offsetFromFrame(middle + side * halfLength * 0.42, side * (halfWidth - 3));
    add({
      t: "decor",
      dkind: "palm",
      p: [prop[0], 0.68, prop[2]],
      rise: 5.2 + index * 0.18,
      amp: side * 0.1,
      yaw: index * 37 + side * 11,
      nm: `${name} palm ${side < 0 ? "left" : "right"}`,
      grp: GROUP.scenery,
    });
    const rock = offsetFromFrame(middle - side * halfLength * 0.25, side * (halfWidth - 1.5));
    add({
      t: "decor",
      dkind: "rocks",
      p: [rock[0], 0.55, rock[2]],
      w: 1.4 + (index % 2) * 0.25,
      vr: index * 2 + (side > 0 ? 1 : 0),
      tn: index % 3,
      grp: GROUP.scenery,
    });
  }
});

PLATFORM_RUNS.forEach(([name, start, end, width], index) =>
  woodPath(name, start, end, width, GROUP.boardwalks, 7129 + index * 181),
);
WALK_RUNS.forEach(([name, start, end, width], index) =>
  woodPath(name, start, end, width, GROUP.boardwalks, 8123 + index * 197),
);

// The walk/ramp overlaps are exact. Each takeoff finishes 1.7 m high, leaving
// the same 4.9 m and 5.93 m air gaps before the next island as the Unity scene.
woodPath("Ramp jump 01", 73.55, 82, 8.2, GROUP.jumps, 93009, 1.7);
woodPath("Ramp jump 02", 243.55, 252, 8, GROUP.jumps, 93010, 1.7);

const ropeBridge = (name: string, start: number, end: number): void => {
  const a = centerAt(start);
  const b = centerAt(end);
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  add({
    t: "rope",
    p: [r3((a[0] + b[0]) / 2), DECK_Y + 0.45, r3((a[2] + b[2]) / 2)],
    len: r3(Math.hypot(dx, dz)),
    yaw: r2((Math.atan2(dx, dz) * 180) / Math.PI),
    amp: 1.2,
    shake: 3,
    nm: name,
    grp: GROUP.ropes,
  });
};

ropeBridge("Rope bridge 01", 165.4, 172.6);
ropeBridge("Rope bridge 02", 326.25, 334.75);

const CRATE_DISTANCES = [
  18, 43, 61, 96, 106, 123, 139, 154, 183, 195,
  211, 226, 239, 267, 278, 292, 305, 319, 350, 365,
];
const lateralPattern = [0, -2.15, 2.15, -1.1, 1.1];
CRATE_DISTANCES.forEach((distance, index) => {
  let lateral = lateralPattern[index % lateralPattern.length];
  if ((distance >= 34 && distance <= 74) || (distance >= 204 && distance <= 244))
    lateral = index % 2 === 0 ? -2.6 : 2.6;
  const p = offsetFromFrame(distance, lateral);
  const kind = index % 7 === 4 ? "mystery" : index % 11 === 8 ? "bouncy" : "wood";
  add({ t: "crate", p, kind, nm: `Crate ${index + 1}`, grp: GROUP.actors });
});

[104, 190, 274].forEach((distance, index) => {
  add({
    t: "checkpoint",
    p: offsetFromFrame(distance, index % 2 === 0 ? 3.5 : -3.5),
    nm: `Checkpoint ${index + 1}`,
    grp: GROUP.actors,
  });
});

const rampFruitLift = (
  distance: number,
  rampStart: number,
  takeoff: number,
  landing: number,
): number => {
  if (distance <= takeoff)
    return 0.9 + 1.7 * ((distance - rampStart) / (takeoff - rampStart));
  const air = (distance - takeoff) / (landing - takeoff);
  return 0.9 + 1.7 * (1 - air) + Math.sin(air * Math.PI) * 0.35;
};

const fruitLift = (distance: number): number => {
  if (distance >= 73.55 && distance <= 86.9)
    return rampFruitLift(distance, 73.55, 82, 86.9);
  if (distance >= 243.55 && distance <= 257.93)
    return rampFruitLift(distance, 243.55, 252, 257.93);
  return 0.9;
};

for (let index = 0; index < 49; index++) {
  const distance = 14 + index * 7.25;
  const onGuide =
    (distance >= 69 && distance <= 89) ||
    (distance >= 238 && distance <= 260) ||
    (distance >= 162 && distance <= 176) ||
    (distance >= 323 && distance <= 338);
  const lateral = onGuide ? 0 : Math.sin(index * 0.73) * 1.85;
  add({
    t: "wumpa",
    p: offsetFromFrame(distance, lateral, fruitLift(distance)),
    nm: `Fruit ${index + 1}`,
    grp: GROUP.actors,
  });
}

const spawn = offsetFromFrame(10, 0, 0.12);
const finish = frameAt(374);
const gateYaw = r2(
  (Math.atan2(-finish.forward[0], -finish.forward[2]) * 180) / Math.PI,
);
add({
  t: "gate",
  p: [r2(finish.center[0]), DECK_Y, r2(finish.center[2])],
  yaw: gateYaw,
  grp: GROUP.actors,
});
add({ t: "clock", p: offsetFromFrame(15, 3), grp: GROUP.actors });
add({ t: "comboorb", p: offsetFromFrame(15, -3), grp: GROUP.actors });

// The source scene uses 129 points. Seventeen authored camera knots preserve
// the same S-curve while keeping editor selection and validation lightweight.
for (let distance = 0; distance <= COURSE_LENGTH; distance += 24) {
  const p = centerAt(distance);
  add({
    t: "camnode",
    p: [r2(p[0]), r2(p[1]), r2(p[2])],
    radius: 7,
    nm: `Course spine ${distance}m`,
    grp: GROUP.camera,
  });
}

export const ISLAND_HOPPER_LEVEL: CustomLevelData = {
  v: 1,
  name: "Island Hopper",
  spawn,
  killY: -2.65,
  sky: "coast",
  groups: [
    { id: GROUP.water, nm: "ocean and deep water" },
    { id: GROUP.islands, nm: "sand islands" },
    { id: GROUP.boardwalks, nm: "joined boardwalks" },
    { id: GROUP.jumps, nm: "ramp jumps" },
    { id: GROUP.ropes, nm: "rope bridges" },
    { id: GROUP.actors, nm: "crates, fruit, and goals" },
    { id: GROUP.camera, nm: "curved camera spine" },
    { id: GROUP.scenery, nm: "island dressing" },
  ],
  components,
};
