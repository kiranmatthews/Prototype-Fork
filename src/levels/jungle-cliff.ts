import type { CustomComponent, CustomLevelData } from "../level";

type RoutePoint = readonly [x: number, topY: number, z: number];
type CrateKind = NonNullable<CustomComponent["kind"]>;

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;

const GROUP = {
  camera: 1,
  mainRoute: 2,
  sideCliff: 3,
  finalCorridor: 4,
  deathRoute: 5,
  actors: 6,
  scenery: 7,
} as const;

const MAIN_ROUTE: RoutePoint[] = [
  [0.12, 0.02, 3.69],
  [7.37, 1.16, -15.06],
  [18.2, 6.86, -33.81],
  [14.45, 5.67, -52.56],
  [1.5, 5.62, -71.31],
  [-5.07, 6.14, -90.06],
  [-6.99, 9.81, -108.81],
  [-16.93, 11.96, -125.74],
  [-25.85, 14.58, -146.31],
  [-27.43, 14.04, -158.73],
  [-39.24, 13.66, -164.54],
  [-51.73, 12.67, -165.32],
  [-59.72, 11.27, -158.35],
  [-59.88, 11.27, -139.88],
  [-57.46, 15.72, -121.41],
  [-60.22, 20.07, -102.94],
  [-62.92, 20.98, -84.47],
  [-63.59, 26.51, -65.99],
  [-61.18, 28.12, -43.71],
  [-56.4, 30.89, -13.78],
  [-60.26, 33.77, 13.63],
  [-65.66, 32.92, 20.02],
];

const FINAL_CORRIDOR: RoutePoint[] = [
  [-126.65, 44.65, -16.49],
  [-126.63, 41.1, -39.01],
  [-123.81, 43.6, -56.04],
  [-125.92, 47.15, -74.54],
  [-128.58, 46.94, -93.13],
  [-131.02, 49.31, -111.67],
  [-128.25, 52.88, -130.53],
  [-125.48, 56.11, -150.83],
  [-125.1, 61.56, -174.62],
  [-127.81, 62.01, -192.98],
];

const SIDE_CLIFF_CAMERA: RoutePoint[] = [
  [-65.66, 32.92, 20.02],
  [-79, 36.4, 19],
  [-94.71, 31.73, 19.01],
  [-109.43, 33.96, 20.6],
  [-116, 37.2, 5],
  [-121, 41.5, -9.5],
  [-126.65, 44.65, -16.49],
];

const terrain = (
  name: string,
  path: readonly RoutePoint[],
  width: number,
  group: number,
  color: string,
  berms = true,
): void => {
  const [x0, y0, z0] = path[0];
  add({
    t: "terrain",
    p: [x0, y0, z0],
    pts: path.map(
      ([x, y, z]) =>
        [
          r2(x - x0),
          r2(z - z0),
          0,
          r2(y - y0),
        ] as [number, number, number, number],
    ),
    w: width,
    amp: 0.16,
    berms,
    curve: "spline",
    tex: "jungle",
    color,
    nm: name,
    grp: group,
  });
};

const platform = (
  name: string,
  x: number,
  topY: number,
  z: number,
  width: number,
  depth: number,
  group: number,
  color = "#88785b",
): void => {
  add({
    t: "platform",
    p: [x, topY - 0.6, z],
    s: [width, 1.2, depth],
    tex: "stone",
    color,
    nm: name,
    grp: group,
  });
};

const samplePath = (
  path: readonly RoutePoint[],
  fraction: number,
  lateral = 0,
): RoutePoint => {
  const lengths = [0];
  for (let index = 1; index < path.length; index++) {
    const a = path[index - 1];
    const b = path[index];
    lengths.push(
      lengths[index - 1] +
        Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
    );
  }
  const target =
    Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
  let segment = 0;
  while (
    segment + 1 < lengths.length - 1 &&
    lengths[segment + 1] < target
  )
    segment++;
  const a = path[segment];
  const b = path[segment + 1];
  const span = Math.max(0.001, lengths[segment + 1] - lengths[segment]);
  const t = (target - lengths[segment]) / span;
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const flatLength = Math.hypot(dx, dz) || 1;
  return [
    a[0] + dx * t - (dz / flatLength) * lateral,
    a[1] + (b[1] - a[1]) * t,
    a[2] + dz * t + (dx / flatLength) * lateral,
  ];
};

const crate = (
  name: string,
  p: RoutePoint,
  kind: CrateKind,
  group: number = GROUP.actors,
): void =>
  add({
    t: "crate",
    p: [r2(p[0]), r2(p[1]), r2(p[2])],
    kind,
    nm: name,
    grp: group,
  });

const wumpa = (p: RoutePoint, group: number): void =>
  add({
    t: "wumpa",
    p: [r2(p[0]), r2(p[1]), r2(p[2])],
    grp: group,
  });

const fruitLine = (
  path: readonly RoutePoint[],
  count: number,
  group: number,
  start = 0.04,
  end = 0.96,
): void => {
  for (let index = 0; index < count; index++) {
    const fraction = start + ((end - start) * index) / Math.max(1, count - 1);
    const [x, y, z] = samplePath(path, fraction, Math.sin(index * 0.8) * 1.2);
    wumpa([x, y + 1.35, z], group);
  }
};

const dressRoute = (
  path: readonly RoutePoint[],
  width: number,
  count: number,
): void => {
  for (let index = 0; index < count; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const [x, y, z] = samplePath(
      path,
      0.04 + (index * 0.92) / Math.max(1, count - 1),
      side * (width / 2 + 4.5 + (index % 3)),
    );
    if (index % 4 === 0) {
      add({
        t: "decor",
        dkind: "jungletree",
        p: [r2(x), r2(y), r2(z)],
        rise: 8 + (index % 3) * 1.2,
        amp: side * 0.07,
        nm: "jungle canopy",
        grp: GROUP.scenery,
      });
    } else if (index % 4 === 1) {
      add({
        t: "decor",
        dkind: "plants",
        p: [r2(x), r2(y), r2(z)],
        w: 1.1 + (index % 3) * 0.25,
        vr: index,
        tn: index % 4,
        seed: 16400 + index,
        nm: "cliff plants",
        grp: GROUP.scenery,
      });
    } else {
      add({
        t: "decor",
        dkind: "rocks",
        p: [r2(x), r2(y), r2(z)],
        w: 1.15 + (index % 2) * 0.35,
        vr: index,
        tn: index % 3,
        seed: 16450 + index,
        nm: "cliff rocks",
        grp: GROUP.scenery,
      });
    }
  }
};

// The extracted camera target spline is the course datum. At 80 source units
// per metre it describes a long descending loop that curls back above the
// opening clearing before arriving at the west-facing cliff traverse.
platform("start clearing", 0.12, 0.02, 9, 18, 14, GROUP.mainRoute, "#6e7546");
terrain(
  "recovered lower jungle route",
  MAIN_ROUTE.slice(0, 14),
  13,
  GROUP.mainRoute,
  "#526f3c",
);
// The return half is visibly a high tree/cliff traverse in the playthrough,
// not another full-width ground ribbon. Keeping the recovered centreline but
// narrowing its deck stops it reading as a stack of giant green flyovers from
// the opening camera.
terrain(
  "recovered upper jungle route",
  MAIN_ROUTE.slice(13),
  7.5,
  GROUP.mainRoute,
  "#49623a",
  false,
);
platform(
  "west cliff handoff",
  -65.66,
  32.92,
  20.02,
  16,
  14,
  GROUP.sideCliff,
  "#887453",
);

add({ t: "clock", p: [3.3, 0.02, 8.5], nm: "time trial clock", grp: GROUP.actors });
add({ t: "comboorb", p: [-3.3, 0.02, 8.5], nm: "combo run orb", grp: GROUP.actors });

// The source turns into a fixed W-facing cliff shot here. Short overlapping
// ledges retain its rise/drop rhythm while remaining readable on a skateboard.
const sideLedges: readonly [string, number, number, number, number, number][] = [
  ["cliff shelf 01", -75, 35, 19, 8, 9],
  ["cliff shelf 02", -79.5, 36.4, 19, 8, 9],
  ["cliff shelf 03", -83.5, 38.06, 19, 8, 9],
  ["cliff drop 01", -88.5, 36.2, 19, 8, 9],
  ["cliff drop 02", -94.71, 31.73, 19.01, 10, 10],
  ["cliff shelf 04", -104.23, 32.23, 19.98, 10, 10],
  ["cliff shelf 05", -109.43, 33.96, 20.6, 8, 9],
  ["cliff turn 01", -113, 35.4, 13, 9, 11],
  ["cliff turn 02", -116, 37.2, 5, 9, 11],
  ["cliff turn 03", -118.12, 39.28, -2.25, 10, 12],
  ["cliff turn 04", -121, 41.5, -9.5, 10, 11],
  ["cliff summit", -126.65, 44.65, -16.49, 15, 14],
];

for (const [name, x, topY, z, width, depth] of sideLedges) {
  platform(name, x, topY, z, width, depth, GROUP.sideCliff);
}

add({
  t: "zone",
  // Start after the recovered winding ribbon has fully handed off. Entering
  // the fixed side shot on the checkpoint itself puts that camera behind the
  // elevated ribbon's end cap and fills the whole screen with green.
  p: [-99, 35, 3],
  s: [64, 1, 66],
  dir: "W",
  nm: "west-facing side cliff camera",
  grp: GROUP.camera,
});

terrain(
  "recovered rising finish corridor",
  FINAL_CORRIDOR,
  13,
  GROUP.finalCorridor,
  "#596f42",
);
platform(
  "finish shrine terrace",
  -127.9,
  60.7,
  -199,
  18,
  18,
  GROUP.finalCorridor,
  "#8d7959",
);
add({
  t: "gate",
  p: [-128, 60.7, -197.7],
  yaw: 0,
  nm: "Jungle Cliff finish",
  grp: GROUP.actors,
});
add({
  t: "wall",
  p: [-128, 60.7, -207.5],
  s: [18, 5, 1],
  tex: "stone",
  color: "#514a3b",
  nm: "finish backstop",
  grp: GROUP.finalCorridor,
});

// Optional skull/death-route challenge. It is deliberately remote like the
// mod's own DeathRoute_CameraSpline, but a pair of one-way portals makes the
// branch playable without contaminating the ordered main camera spine.
platform("death-route portal spur", -112, 35.4, 28, 9, 22, GROUP.sideCliff);
add({
  t: "returnportal",
  p: [-112, 35.4, 36],
  s: [3, 4, 1.2],
  to: [-172, 35.2, 42],
  exitYaw: 270,
  nm: "enter remote death route",
  grp: GROUP.deathRoute,
});

const deathLedges: readonly [string, number, number, number, number][] = [
  ["death route start", -177, 35.2, 16, 12],
  ["death route shelf 01", -190, 36.4, 10, 10],
  ["death route shelf 02", -201, 38, 10, 9],
  ["death route drop", -212, 36.1, 10, 10],
  ["death route shelf 03", -223, 39.2, 10, 9],
  ["death route exit", -236, 41, 16, 12],
];
for (const [name, x, topY, width, depth] of deathLedges)
  platform(name, x, topY, 42, width, depth, GROUP.deathRoute, "#665c49");

add({
  t: "zone",
  p: [-207, 38, 42],
  s: [86, 1, 22],
  dir: "W",
  nm: "remote death-route camera",
  grp: GROUP.camera,
});
add({
  t: "returnportal",
  p: [-241, 41, 42],
  s: [3, 4, 1.2],
  yaw: 90,
  to: [-121, 41.7, -9.5],
  exitYaw: 0,
  nm: "return from death route",
  grp: GROUP.deathRoute,
});

// Source-landmark crate placements recovered from Custom_Level_Crates. Source
// Bounce crates map to the five-hit fruit crate; Arrow maps to metal bounce.
crate("source bounce 01", [6.14, 0.5, -11.77], "multihit");
// These three source transforms sat fractionally inside the camera-derived
// ribbon after the 80:1 gameplay compression. Lift only their deck value so
// the procedural crate feet remain visible; X/Z stay exact.
crate("source mystery 01", [8.41, 1.15, -17.72], "mystery");
crate("source mystery 02", [20.26, 6.47, -33.75], "mystery");
crate("source TNT 01", [20.3, 6.41, -34.73], "tnt");
crate("source TNT 02", [19.69, 5.65, -43.95], "tnt");
crate("source arrow", [-3.22, 5.2, -83.43], "metalbounce");
crate("source mask", [-3.24, 11.04, -83.39], "mask");
crate("source life 01", [-9.49, 14.64, -117.89], "life");
crate("source TNT 03", [-14.35, 12.25, -125.56], "tnt");
crate("source bounce 02", [-24.52, 15.55, -153.95], "multihit");

platform(
  "checkpoint plinth 01",
  -26.2,
  15.55,
  -145.08,
  5,
  5,
  GROUP.actors,
  "#8d7959",
);
add({
  t: "checkpoint",
  p: [-26.2, 15.55, -145.08],
  nm: "source checkpoint 01",
  grp: GROUP.actors,
});
platform(
  "checkpoint plinth 02",
  -60.35,
  34.43,
  7.87,
  6,
  6,
  GROUP.actors,
  "#8d7959",
);
add({
  t: "checkpoint",
  p: [-60.35, 34.43, 7.87],
  nm: "source checkpoint 02",
  grp: GROUP.actors,
});

crate("side mystery 01", [-66.71, 34.21, 18.18], "mystery");
crate("side mystery 02", [-82.84, 38.06, 19.01], "mystery");
crate("side mystery 03", [-94.71, 31.73, 19.01], "mystery");
crate("side mystery 04", [-104.23, 32.23, 19.98], "mystery");
crate("side TNT", [-109.43, 33.96, 20.6], "tnt");
crate("turn mystery", [-118.12, 39.28, -2.25], "mystery");

platform(
  "checkpoint plinth 03",
  -126.55,
  41.06,
  -43.94,
  6,
  6,
  GROUP.actors,
  "#8d7959",
);
add({
  t: "checkpoint",
  p: [-126.55, 41.06, -43.94],
  nm: "source checkpoint 03",
  grp: GROUP.actors,
});
crate("source bounce 03", [-131.17, 48.57, -118.6], "multihit");
crate("source life pair lower", [-125.16, 61.32, -180.89], "life");
crate("source life pair upper", [-125.16, 62.28, -180.89], "life");

// Seven ordinary crates and four nitros complete a representative 34-crate
// course count when the three checkpoint boxes above are included.
const ordinaryCrates: readonly [string, readonly RoutePoint[], number, number, CrateKind][] = [
  ["route wood 01", MAIN_ROUTE, 0.14, -2, "wood"],
  ["route wood 02", MAIN_ROUTE, 0.31, 2, "wood"],
  ["route wood 03", MAIN_ROUTE, 0.5, -1.8, "wood"],
  ["route wood 04", MAIN_ROUTE, 0.76, 1.8, "wood"],
  ["route nitro 01", MAIN_ROUTE, 0.63, 0, "nitro"],
  ["final wood", FINAL_CORRIDOR, 0.34, -2, "wood"],
  ["final nitro", FINAL_CORRIDOR, 0.68, 2, "nitro"],
];
for (const [name, path, fraction, lateral, kind] of ordinaryCrates)
  crate(name, samplePath(path, fraction, lateral), kind);

crate("death-route wood 01", [-181, 35.2, 42], "wood", GROUP.deathRoute);
crate("death-route nitro 01", [-195.5, 36.4, 42], "nitro", GROUP.deathRoute);
crate("death-route life", [-206.5, 38, 42], "life", GROUP.deathRoute);
crate("death-route wood 02", [-212, 36.1, 42], "wood", GROUP.deathRoute);
crate("death-route nitro 02", [-224, 39.2, 42], "nitro", GROUP.deathRoute);

fruitLine(MAIN_ROUTE, 28, GROUP.mainRoute);
fruitLine(FINAL_CORRIDOR, 14, GROUP.finalCorridor, 0.05, 0.91);
for (const [index, [, x, topY, z]] of sideLedges.entries()) {
  if (index % 2 === 0) wumpa([x, topY + 1.35, z], GROUP.sideCliff);
}
for (let index = 0; index < 6; index++)
  wumpa([-178 - index * 11.2, 40 + Math.sin(index) * 1.2, 42], GROUP.deathRoute);

dressRoute(MAIN_ROUTE, 13, 24);
dressRoute(FINAL_CORRIDOR, 13, 12);

// Temple fragments thicken toward the finish without narrowing the road.
for (let index = 0; index < 6; index++) {
  const [x, y, z] = samplePath(FINAL_CORRIDOR, 0.12 + index * 0.15);
  for (const side of [-1, 1] as const) {
    add({
      t: "decor",
      dkind: "ruinblock",
      p: [r2(x + side * (8.5 + (index % 2))), r2(y), r2(z)],
      s: [2.8, 4.5 + (index % 3) * 1.1, 2.8],
      yaw: index * 19 + (side < 0 ? 7 : -7),
      nm: "temple corridor pier",
      grp: GROUP.scenery,
    });
  }
}
add({
  t: "decor",
  dkind: "idol",
  p: [-118, 39.3, -8],
  w: 1.4,
  yaw: 180,
  nm: "death-route idol",
  grp: GROUP.scenery,
});

// Keep the camera/control lane faithful to the recovered targets. Densifying
// long spans prevents abrupt steering changes without inventing new turns.
const cameraAnchors: RoutePoint[] = [
  [0.12, 0.02, 11],
  ...MAIN_ROUTE,
  ...SIDE_CLIFF_CAMERA.slice(1),
  ...FINAL_CORRIDOR.slice(1),
  [-128, 60.7, -204],
];
const pushCameraNode = ([x, y, z]: RoutePoint): void =>
  add({
    t: "camnode",
    p: [r2(x), r2(y), r2(z)],
    grp: GROUP.camera,
  });

pushCameraNode(cameraAnchors[0]);
for (let index = 0; index < cameraAnchors.length - 1; index++) {
  const a = cameraAnchors[index];
  const b = cameraAnchors[index + 1];
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 8),
  );
  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    pushCameraNode([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
  }
}

export const JUNGLE_CLIFF_LEVEL: CustomLevelData = {
  v: 1,
  name: "Jungle Cliff",
  spawn: [0.12, 0.14, 9],
  killY: -18,
  ledgeAssist: 0.55,
  sky: "sunset",
  groups: [
    { id: GROUP.camera, nm: "recovered camera spine and travel zones" },
    { id: GROUP.mainRoute, nm: "winding jungle route" },
    { id: GROUP.sideCliff, nm: "west-facing cliff traverse" },
    { id: GROUP.finalCorridor, nm: "rising temple corridor" },
    { id: GROUP.deathRoute, nm: "optional remote death route" },
    { id: GROUP.actors, nm: "source crate landmarks and run furniture" },
    { id: GROUP.scenery, nm: "jungle and temple dressing" },
  ],
  components,
};
