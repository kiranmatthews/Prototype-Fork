import type { CustomComponent, CustomLevelData } from "../level";

type RoutePoint = readonly [x: number, y: number, z: number];
type CameraAnchor = readonly [x: number, y: number, z: number, radius?: number];

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;

const GROUP = {
  camera: 1,
  downhillOne: 2,
  sideClimb: 3,
  straightRidge: 4,
  downhillTwo: 5,
  templeClimb: 6,
  finale: 7,
  scenery: 8,
} as const;

const platform = (
  x: number,
  topY: number,
  z: number,
  width: number,
  depth: number,
  grp: number,
  tex = "stone",
  color = "#9b8f78",
): void =>
  add({
    t: "platform",
    p: [x, topY - 0.5, z],
    s: [width, 1, depth],
    tex,
    color,
    grp,
  });

const terrain = (
  name: string,
  path: readonly RoutePoint[],
  width: number,
  grp: number,
  color: string,
): void => {
  const [x0, y0, z0] = path[0];
  add({
    t: "terrain",
    p: [x0, y0, z0],
    w: width,
    amp: 0,
    berms: true,
    curve: "spline",
    tex: "jungle",
    color,
    nm: name,
    grp,
    pts: path.map(
      ([x, y, z]) => [r2(x - x0), r2(z - z0), 0, r2(y - y0)] as [number, number, number, number],
    ),
  });
};

const ramp = (
  x: number,
  lowY: number,
  z: number,
  len: number,
  rise: number,
  width: number,
  grp: number,
  yaw = 0,
): void =>
  add({
    t: "ramp",
    p: [x, lowY, z],
    len,
    rise,
    w: width,
    yaw,
    tex: "stone",
    color: "#a69a7d",
    grp,
  });

const wumpa = (x: number, y: number, z: number, grp: number): void =>
  add({ t: "wumpa", p: [r2(x), r2(y), r2(z)], grp });

const crate = (
  x: number,
  deckY: number,
  z: number,
  kind: NonNullable<CustomComponent["kind"]>,
  grp: number,
): void => add({ t: "crate", p: [x, deckY, z], kind, grp });

const enemy = (
  x: number,
  deckY: number,
  z: number,
  foe: NonNullable<CustomComponent["foe"]>,
  grp: number,
  range = 0,
  speed = 0,
): void => add({ t: "enemy", p: [x, deckY, z], foe, range, speed, grp });

const checkpoint = (x: number, deckY: number, z: number, grp: number): void =>
  add({ t: "checkpoint", p: [x, deckY, z], grp });

const samplePath = (path: readonly RoutePoint[], fraction: number, offset = 0): RoutePoint => {
  const lengths: number[] = [0];
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1];
    const b = path[index];
    lengths.push(
      lengths[index - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
    );
  }
  const target = Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
  let segment = 0;
  while (segment + 1 < lengths.length - 1 && lengths[segment + 1] < target) segment++;
  const a = path[segment];
  const b = path[segment + 1];
  const span = Math.max(0.001, lengths[segment + 1] - lengths[segment]);
  const t = (target - lengths[segment]) / span;
  const fx0 = b[0] - a[0];
  const fz0 = b[2] - a[2];
  const flatLength = Math.hypot(fx0, fz0) || 1;
  const leftX = -fz0 / flatLength;
  const leftZ = fx0 / flatLength;
  return [
    a[0] + (b[0] - a[0]) * t + leftX * offset,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t + leftZ * offset,
  ];
};

// A board line, not a slalom wall: fruit gently biases one side then the
// other while every breakable/enemy beat remains many metres down-course.
const flowFruit = (
  path: readonly RoutePoint[],
  count: number,
  grp: number,
  start = 0.06,
  end = 0.94,
  phase = 0,
): void => {
  for (let index = 0; index < count; index++) {
    const t = count === 1 ? 0.5 : start + ((end - start) * index) / (count - 1);
    const offset = Math.sin(index * 0.82 + phase) * 1.8;
    const [x, y, z] = samplePath(path, t, offset);
    wumpa(x, y + 1.15, z, grp);
  }
};

const jumpArc = (points: readonly RoutePoint[], grp: number): void =>
  points.forEach(([x, y, z]) => wumpa(x, y, z, grp));

const dressRoad = (path: readonly RoutePoint[], width: number, count: number): void => {
  for (let index = 0; index < count; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const [x, y, z] = samplePath(
      path,
      0.06 + (0.88 * index) / Math.max(1, count - 1),
      side * (width / 2 + 4.5 + (index % 3)),
    );
    if (index % 4 === 0) {
      add({
        t: "decor",
        p: [r2(x), r2(y), r2(z)],
        dkind: "jungletree",
        rise: 9 + (index % 3),
        amp: side * 0.04,
        grp: GROUP.scenery,
      });
    } else if (index % 4 === 1) {
      add({
        t: "decor",
        p: [r2(x), r2(y), r2(z)],
        dkind: "toadstools",
        w: 1.2,
        grp: GROUP.scenery,
      });
    } else {
      add({
        t: "decor",
        p: [r2(x), r2(y), r2(z)],
        dkind: "rocks",
        w: 1.3 + (index % 2) * 0.4,
        vr: index,
        tn: index % 3,
        grp: GROUP.scenery,
      });
    }
  }
};

// START: wide enough to engage the board before the first downhill curve.
platform(0, 72, 27, 22, 30, GROUP.downhillOne, "stone", "#8d806b");
add({ t: "clock", p: [3, 72, 34], grp: GROUP.downhillOne });
add({ t: "comboorb", p: [-3, 72, 34], grp: GROUP.downhillOne });

// DOWNHILL I: two skate-only gap beats, with all furniture in a continuous
// forward cadence rather than horizontal crate rows.
const downOneA: RoutePoint[] = [
  [0, 72, 12], [8, 68, -16], [20, 63, -48], [12, 58, -76],
  [18, 54, -100], [18, 52, -112], [18, 52, -124],
];
terrain("downhill one — upper ribbon", downOneA, 16, GROUP.downhillOne, "#4f8d3d");
ramp(18, 52, -118, 12, 2.5, 14, GROUP.downhillOne);
add({ t: "pit", p: [18, 42, -129.5], s: [22, 1, 11], grp: GROUP.downhillOne });

const downOneB: RoutePoint[] = [
  [18, 48, -135], [14, 45, -153], [0, 40, -181],
  [-14, 36, -207], [-14, 33, -223],
];
terrain("downhill one — middle ribbon", downOneB, 16, GROUP.downhillOne, "#548f3e");
ramp(-14, 33, -229, 12, 2, 14, GROUP.downhillOne);
add({ t: "pit", p: [-14, 22, -239.5], s: [22, 1, 9], grp: GROUP.downhillOne });

const downOneC: RoutePoint[] = [
  [-14, 29, -244], [-4, 27, -262], [8, 25, -280], [8, 24, -296],
];
terrain("downhill one — corner approach", downOneC, 16, GROUP.downhillOne, "#4c863a");
platform(8, 24, -304, 22, 18, GROUP.downhillOne, "stone", "#91836c");

flowFruit(downOneA, 18, GROUP.downhillOne, 0.08, 0.88, 0.2);
flowFruit(downOneB, 16, GROUP.downhillOne, 0.08, 0.88, 1.1);
flowFruit(downOneC, 8, GROUP.downhillOne, 0.1, 0.88, 2.1);
jumpArc(
  [
    [18, 56, -126], [18, 58, -129], [18, 55, -133],
    [-14, 37, -237], [-14, 37.5, -240], [-14, 33, -243],
  ],
  GROUP.downhillOne,
);
[
  [13.3, 65.8, -30, "wood"], [14.9, 59.8, -66, "wood"],
  [17, 54.7, -96, "wood"], [11.5, 44.1, -158, "wood"],
  [-10.2, 37.1, -200, "wood"], [-14, 33.9, -218, "mystery"],
].forEach(([x, y, z, kind]) =>
  crate(x as number, y as number, z as number, kind as NonNullable<CustomComponent["kind"]>, GROUP.downhillOne),
);
enemy(14.5, 56.3, -86, "grunt", GROUP.downhillOne);
enemy(1.5, 40.5, -178, "spiker", GROUP.downhillOne);
crate(6, 40, -181, "nitro", GROUP.downhillOne);
checkpoint(8, 24, -290, GROUP.downhillOne);
dressRoad(downOneA, 16, 12);
dressRoad(downOneB, 16, 10);
dressRoad(downOneC, 16, 5);

// SIDE-SCROLL CLIMB: zone boundaries sit on supported corner plazas. The
// spine continues corner-to-corner, but the zone owns the fixed side shot.
add({ t: "zone", p: [65, 24, -304], s: [114, 1, 16], dir: "E", grp: GROUP.sideClimb });
[
  [24, 24.8, 8, 9], [35, 26, 8, 9], [47, 27.2, 9, 9],
  [59, 28.6, 8, 9], [70.5, 30, 7, 9], [82, 31.2, 9, 9], [94, 33, 8, 9],
].forEach(([x, top, width, depth]) =>
  platform(x, top, -304, width, depth, GROUP.sideClimb, "stone", "#a89570"),
);
ramp(105, 33, -304, 14, 4, 9, GROUP.sideClimb, 270);
platform(122, 37, -304, 20, 30, GROUP.sideClimb, "stone", "#a89570");
[
  [24, 26], [35, 27.2], [47, 28.4], [59, 29.8],
  [70.5, 31.2], [82, 32.4], [94, 34.2],
].forEach(([x, y]) => wumpa(x, y, -304, GROUP.sideClimb));
enemy(59, 28.6, -304, "grunt", GROUP.sideClimb);
checkpoint(118, 37, -304, GROUP.sideClimb);

// STRAIGHT RIDGE: 110m of steady framing after the side-scroll handoff.
const straightRidge: RoutePoint[] = [
  [122, 37, -319], [122, 37, -359], [122, 35, -399], [122, 33, -429],
];
terrain("straight ridge", straightRidge, 14, GROUP.straightRidge, "#668f46");
add({
  t: "rail",
  p: [126, 37.9, -330],
  pts: [[0, 0, 0, 0], [0, -29, 0, 0], [0, -60, 0, -1.55]],
  grp: GROUP.straightRidge,
});
flowFruit(straightRidge, 15, GROUP.straightRidge, 0.08, 0.92, 0.4);
crate(120, 36.2, -347, "wood", GROUP.straightRidge);
crate(124, 35.5, -382, "wood", GROUP.straightRidge);
enemy(121, 34.2, -410, "grunt", GROUP.straightRidge);
checkpoint(122, 33, -424, GROUP.straightRidge);
dressRoad(straightRidge, 14, 9);

// DOWNHILL II: the fastest section and the largest board jump.
const downTwoA: RoutePoint[] = [
  [122, 33, -429], [117, 30, -454], [101, 25, -484],
  [81, 20, -511], [81, 17, -527], [81, 17, -539],
];
terrain("downhill two — upper ribbon", downTwoA, 16, GROUP.downhillTwo, "#527f39");
ramp(81, 17, -533, 12, 2.5, 16, GROUP.downhillTwo);
add({ t: "pit", p: [81, 3, -545], s: [24, 1, 12], grp: GROUP.downhillTwo });

const downTwoB: RoutePoint[] = [
  [81, 12, -551], [67, 8, -581], [46, 2, -613],
  [60, -4, -645], [60, -7, -661], [60, -7, -673],
];
terrain("downhill two — middle ribbon", downTwoB, 16, GROUP.downhillTwo, "#477633");
ramp(60, -7, -667, 12, 2, 16, GROUP.downhillTwo);
add({ t: "pit", p: [60, -18, -678], s: [24, 1, 10], grp: GROUP.downhillTwo });

const downTwoC: RoutePoint[] = [
  [60, -10, -683], [76, -14, -713], [102, -19, -747], [110, -22, -771],
];
terrain("downhill two — lower ribbon", downTwoC, 16, GROUP.downhillTwo, "#3f6e30");
platform(110, -22, -781, 24, 28, GROUP.downhillTwo, "stone", "#806f5d");

flowFruit(downTwoA, 16, GROUP.downhillTwo, 0.08, 0.88, 0.2);
flowFruit(downTwoB, 17, GROUP.downhillTwo, 0.08, 0.9, 1.2);
flowFruit(downTwoC, 13, GROUP.downhillTwo, 0.08, 0.9, 2.1);
jumpArc(
  [[81, 22, -542], [81, 24, -545], [81, 21, -548], [60, -2, -676], [60, 0, -678], [60, -6, -681]],
  GROUP.downhillTwo,
);
[
  [118.8, 31.1, -445], [93.6, 23.1, -494], [72.1, 9.5, -570],
  [51.3, 3.5, -605], [54.3, -1.6, -632], [70.1, -12.5, -702], [97.4, -18.1, -741],
].forEach(([x, y, z]) => crate(x, y, z, "wood", GROUP.downhillTwo));
enemy(107.4, 27, -472, "grunt", GROUP.downhillTwo);
enemy(61.8, 6.5, -589, "spiker", GROUP.downhillTwo);
enemy(82.9, -15.3, -722, "grunt", GROUP.downhillTwo);
enemy(106.3, -20.6, -760, "spiker", GROUP.downhillTwo);
crate(107, 25, -484, "nitro", GROUP.downhillTwo);
crate(99, -17.2, -735, "nitro", GROUP.downhillTwo);
add({ t: "crystal", p: [81, 23, -545], grp: GROUP.downhillTwo });
checkpoint(81, 12, -555, GROUP.downhillTwo);
checkpoint(110, -22, -780, GROUP.downhillTwo);
dressRoad(downTwoA, 16, 8);
dressRoad(downTwoB, 16, 9);
dressRoad(downTwoC, 16, 7);

// UPHILL TEMPLE: open gaps are 3–4.5m with 1.2–1.8m rises — foot-jump
// dimensions. The narrow zigzag rejects a board-speed line.
const climbPlatforms: readonly [number, number, number, number, number, "platform" | "crumble"][] = [
  [106, -20.8, -803, 9, 8, "platform"], [99, -19.5, -814, 8, 8, "platform"],
  [92, -18.2, -825, 8, 8, "platform"], [84.5, -16.9, -837, 9, 9, "platform"],
  [78, -15.4, -851, 14, 12, "platform"], [83, -11.4, -880, 12, 14, "platform"],
  [90, -10.1, -895, 8, 8, "platform"], [98, -8.8, -906, 8, 8, "crumble"],
  [106, -7, -918, 9, 9, "platform"], [111, -5.5, -933, 14, 14, "platform"],
  [104, -0.5, -964, 18, 16, "platform"], [96, 0.8, -979, 8, 8, "platform"],
  [88, 2.1, -990, 8, 8, "crumble"], [80, 3.8, -1002, 9, 9, "platform"],
  [74, 5.3, -1017, 14, 12, "platform"], [74, 10.3, -1049, 22, 20, "platform"],
];
for (const [x, topY, z, width, depth, kind] of climbPlatforms) {
  if (kind === "crumble") {
    add({
      t: "crumble", p: [x, topY, z], s: [width, 1, depth], shake: 0.7,
      color: "#c88a54", tex: "stone", grp: GROUP.templeClimb,
    });
  } else platform(x, topY, z, width, depth, GROUP.templeClimb, "stone", "#987f62");
  wumpa(x, topY + 1.3, z, GROUP.templeClimb);
}
ramp(78, -15.4, -865, 16, 4, 10, GROUP.templeClimb);
ramp(111, -5.5, -948, 16, 5, 10, GROUP.templeClimb);
ramp(74, 5.3, -1031, 16, 5, 10, GROUP.templeClimb);
enemy(83, -11.4, -880, "turtle", GROUP.templeClimb, 3, 1.2);
enemy(106, -5.5, -933, "hopper", GROUP.templeClimb, 1, 1.4);
crate(82, -15.4, -851, "mystery", GROUP.templeClimb);
crate(112, -5.5, -933, "mask", GROUP.templeClimb);
checkpoint(116, -5.5, -933, GROUP.templeClimb);
checkpoint(74, 10.3, -1050, GROUP.templeClimb);

for (let index = 1; index < climbPlatforms.length; index++) {
  const a = climbPlatforms[index - 1];
  const b = climbPlatforms[index];
  if (Math.abs(b[2] - a[2]) > 18) continue;
  for (const t of [0.36, 0.7]) {
    wumpa(
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t + 1.5 + Math.sin(t * Math.PI) * 0.8,
      a[2] + (b[2] - a[2]) * t,
      GROUP.templeClimb,
    );
  }
}
for (const [index, [x, topY, z]] of climbPlatforms.entries()) {
  if (index % 3 !== 0) continue;
  add({
    t: "decor", p: [x + (index % 2 === 0 ? -9 : 9), topY, z],
    dkind: "ruinblock", s: [3.5, 4 + (index % 4), 3.5], yaw: index * 17,
    grp: GROUP.scenery,
  });
}

// FINAL DESCENT: a last board line and 11m speed jump onto the finish terrace.
const finale: RoutePoint[] = [
  [74, 10.3, -1059], [68, 7.3, -1081], [50, 2.3, -1109],
  [28, -2.7, -1137], [16, -6.7, -1161], [16, -9.7, -1175],
];
terrain("final descent", finale, 16, GROUP.finale, "#486f35");
ramp(16, -9.7, -1181, 12, 2.4, 16, GROUP.finale);
add({ t: "pit", p: [16, -22, -1192.5], s: [24, 1, 11], grp: GROUP.finale });
platform(16, -14, -1214, 22, 32, GROUP.finale, "stone", "#91765b");
checkpoint(16, -14, -1205, GROUP.finale);
add({ t: "gate", p: [16, -14, -1220], yaw: 0, grp: GROUP.finale });
add({ t: "wall", p: [16, -14, -1231], s: [22, 4, 1], tex: "stone", grp: GROUP.finale });
flowFruit(finale, 18, GROUP.finale, 0.07, 0.9, 1.4);
jumpArc([[16, -5, -1190], [16, -3.5, -1193], [16, -10, -1197]], GROUP.finale);
crate(69.9, 8.3, -1074, "wood", GROUP.finale);
enemy(59, 4.8, -1095, "grunt", GROUP.finale);
crate(49.2, 2.1, -1110, "wood", GROUP.finale);
enemy(35.1, -1.1, -1128, "spiker", GROUP.finale);
crate(22.5, -4.5, -1148, "wood", GROUP.finale);
crate(32, -3.2, -1140, "nitro", GROUP.finale);
dressRoad(finale, 16, 10);

// CAMERA SPINE: surface-matched and ordered spawn-to-gate. Design anchors
// are densified to <=8m; side-scroll corners live wholly inside the zone.
const cameraAnchors: CameraAnchor[] = [
  [0, 72, 42], [0, 72, 12, 5], [8, 68, -16, 6], [20, 63, -48, 7],
  [12, 58, -76, 7], [18, 54, -100, 5], [18, 52, -112], [18, 54.5, -124],
  [18, 48, -135], [14, 45, -153, 6], [0, 40, -181, 7], [-14, 36, -207, 6],
  [-14, 33, -223], [-14, 35, -235], [-14, 29, -244], [-4, 27, -262, 5],
  [8, 25, -280, 4], [8, 24, -296, 3], [8, 24, -304, 5], [122, 37, -304, 5],
  [122, 37, -334], [122, 37, -359], [122, 35, -399], [122, 33, -429, 6],
  [117, 30, -454, 7], [101, 25, -484, 7], [81, 20, -511, 6], [81, 17, -527],
  [81, 19.5, -539], [81, 12, -551], [67, 8, -581, 7], [46, 2, -613, 7],
  [60, -4, -645, 6], [60, -7, -661], [60, -5, -673], [60, -10, -683],
  [76, -14, -713, 7], [102, -19, -747, 7], [110, -22, -771, 5],
  [110, -22, -781, 4], [106, -20.8, -803, 3], [92, -18.2, -825, 4],
  [78, -15.4, -851, 4], [78, -11.4, -873, 3], [83, -11.4, -880, 3],
  [98, -8.8, -906, 4], [111, -5.5, -933, 4], [111, -0.5, -956, 3],
  [104, -0.5, -964, 3], [88, 2.1, -990, 4], [74, 5.3, -1017, 4],
  [74, 10.3, -1039, 3], [74, 10.3, -1059, 5], [68, 7.3, -1081, 6],
  [50, 2.3, -1109, 7], [28, -2.7, -1137, 7], [16, -6.7, -1161, 5],
  [16, -9.7, -1175], [16, -7.3, -1187], [16, -14, -1198], [16, -14, -1238],
];

const pushCameraNode = ([x, y, z, radius = 0]: CameraAnchor): void =>
  add({
    t: "camnode",
    p: [r2(x), r2(y), r2(z)],
    radius: radius || undefined,
    grp: GROUP.camera,
  });

pushCameraNode(cameraAnchors[0]);
for (let index = 0; index < cameraAnchors.length - 1; index++) {
  const a = cameraAnchors[index];
  const b = cameraAnchors[index + 1];
  const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 8));
  for (let step = 1; step <= count; step++) {
    if (step === count) pushCameraNode(b);
    else {
      const t = step / count;
      pushCameraNode([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ]);
    }
  }
}

export const CODEX_LAB_LEVEL = {
  v: 1,
  name: "Codex Switchback Run",
  spawn: [0, 72.6, 28],
  killY: -42,
  sky: "day",
  components,
  groups: [
    { id: GROUP.camera, nm: "camera spine" },
    { id: GROUP.downhillOne, nm: "downhill one" },
    { id: GROUP.sideClimb, nm: "side-scroll climb" },
    { id: GROUP.straightRidge, nm: "straight ridge" },
    { id: GROUP.downhillTwo, nm: "downhill two" },
    { id: GROUP.templeClimb, nm: "uphill temple" },
    { id: GROUP.finale, nm: "final descent" },
    { id: GROUP.scenery, nm: "scenery" },
  ],
} satisfies CustomLevelData;
