import type { CustomComponent, CustomLevelData } from "../level";
import { buildCoastalStreetKit } from "../coastalStreetKit";

/**
 * Unity's three-kilometre street is authored along native +Z. We keep every
 * source distance and height, reflecting only Z (`webZ = -unityZ`) so play
 * advances along the browser runtime's conventional -Z corridor. Positive X
 * remains screen right; that is where the Beachside sand and water are placed.
 */

interface RoadSegment {
  name: string;
  start: number;
  end: number;
  startY: number;
  endY: number;
}

interface Gap {
  name: string;
  start: number;
  end: number;
  rampX: number;
  railX: number;
}

type RailPoint = readonly [x: number, y: number, unityZ: number];

const GROUP = {
  road: 1,
  gaps: 2,
  stairs: 3,
  ledges: 4,
  rails: 5,
  actors: 6,
  beach: 7,
  camera: 8,
  town: 9,
  markings: 10,
} as const;

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const roadSegments: RoadSegment[] = [
  { name: "Market Flat", start: -30, end: 100, startY: 12, endY: 12 },
  { name: "Market Descent", start: 100, end: 300, startY: 12, endY: 4 },
  { name: "Harbour Plaza", start: 300, end: 430, startY: 4, endY: 4 },
  { name: "Canal Low", start: 441, end: 580, startY: 4, endY: 4 },
  { name: "Canal Rise", start: 580, end: 650, startY: 4, endY: 9 },
  { name: "Canal Raised Plaza", start: 650, end: 800, startY: 9, endY: 9 },
  { name: "Canal Works Descent", start: 800, end: 900, startY: 9, endY: 5 },
  { name: "Cliff Approach", start: 912, end: 1040, startY: 5, endY: 5 },
  { name: "Cliff Rise", start: 1040, end: 1110, startY: 5, endY: 15 },
  { name: "Cliff Top Plaza", start: 1110, end: 1240, startY: 15, endY: 15 },
  { name: "Cliff Descent", start: 1240, end: 1370, startY: 15, endY: 7 },
  { name: "Surf Arcade Flat", start: 1370, end: 1530, startY: 7, endY: 7 },
  { name: "Surf Arcade Descent", start: 1530, end: 1660, startY: 7, endY: 2 },
  { name: "Low Arcade Plaza", start: 1660, end: 1810, startY: 2, endY: 2 },
  { name: "Festival Low", start: 1823, end: 1960, startY: 2, endY: 2 },
  { name: "Festival Rise", start: 1960, end: 2070, startY: 2, endY: 13 },
  { name: "Festival High Plaza", start: 2070, end: 2170, startY: 13, endY: 13 },
  { name: "Festival Descent", start: 2170, end: 2280, startY: 13, endY: 6 },
  { name: "Lighthouse Flat", start: 2280, end: 2400, startY: 6, endY: 6 },
  { name: "Lighthouse Descent", start: 2400, end: 2580, startY: 6, endY: 2.5 },
  { name: "Lighthouse Low", start: 2580, end: 2680, startY: 2.5, endY: 2.5 },
  { name: "Finish Rise", start: 2694, end: 2820, startY: 2.5, endY: 7 },
  { name: "Finish Promenade", start: 2820, end: 3030, startY: 7, endY: 7 },
];

const gaps: Gap[] = [
  { name: "Market Canal Gap", start: 430, end: 441, rampX: -3.15, railX: 3.05 },
  { name: "Canal Cliff Gap", start: 900, end: 912, rampX: 3.15, railX: -3.05 },
  { name: "Arcade Festival Gap", start: 1810, end: 1823, rampX: -3.15, railX: 3.05 },
  { name: "Lighthouse Finish Gap", start: 2680, end: 2694, rampX: 3.15, railX: -3.05 },
];

const heightAt = (unityZ: number): number => {
  if (unityZ <= roadSegments[0].start) return roadSegments[0].startY;
  for (let index = 0; index < roadSegments.length; index++) {
    const segment = roadSegments[index];
    if (unityZ >= segment.start && unityZ <= segment.end) {
      return lerp(
        segment.startY,
        segment.endY,
        (unityZ - segment.start) / Math.max(0.01, segment.end - segment.start),
      );
    }
    const next = roadSegments[index + 1];
    if (next && unityZ > segment.end && unityZ < next.start) {
      return lerp(
        segment.endY,
        next.startY,
        (unityZ - segment.end) / (next.start - segment.end),
      );
    }
  }
  return roadSegments[roadSegments.length - 1].endY;
};

const resolveSafeActorZ = (unityZ: number): number => {
  for (const gap of gaps) {
    if (unityZ > gap.start - 24 && unityZ < gap.end + 18) return gap.end + 22;
  }
  return unityZ;
};

const resolveSafeFruitZ = (unityZ: number): number => {
  for (const gap of gaps) {
    if (unityZ > gap.start - 10 && unityZ < gap.end + 8) return gap.end + 9;
  }
  return unityZ;
};

const streetKit = buildCoastalStreetKit(roadSegments, heightAt);

const railPath = (
  name: string,
  points: readonly RailPoint[],
  grp: number = GROUP.rails,
): void => {
  const [x0, y0, z0] = points[0];
  add({
    t: "rail",
    p: [r2(x0), r2(y0), r2(-z0)],
    pts: points.map(
      ([x, y, unityZ]) =>
        [r2(x - x0), r2(-(unityZ - z0)), 0, r2(y - y0)] as [
          number,
          number,
          number,
          number,
        ],
    ),
    nm: name,
    grp,
  });
};

const addRoadSurface = (
  segment: RoadSegment,
  centerX: number,
  width: number,
  name: string,
  color: string,
  grp: number,
): void => {
  const length = segment.end - segment.start;
  const middleZ = -(segment.start + segment.end) * 0.5;
  if (Math.abs(segment.endY - segment.startY) < 0.001) {
    add({
      t: "platform",
      p: [centerX, segment.startY - 0.425, middleZ],
      s: [width, 0.85, length + 0.08],
      tex: "solid",
      color,
      edgeGrinding: false,
      nm: name,
      grp,
    });
  } else {
    add({
      t: "ramp",
      p: [centerX, Math.min(segment.startY, segment.endY), middleZ],
      len: length,
      rise: Math.abs(segment.endY - segment.startY),
      w: width,
      yaw: segment.endY >= segment.startY ? 0 : 180,
      tex: "solid",
      color,
      edgeGrinding: false,
      nm: name,
      grp,
    });
  }
};

// Collision remains the exact 23-slab route. Presentation is source concrete,
// not the generic black asphalt tile with false repeating parking stripes.
for (const segment of roadSegments)
  addRoadSurface(segment, 0, 12, segment.name, "#cdcdc8", GROUP.road);
for (const shoulder of streetKit.shoulders) {
  const segment = roadSegments[shoulder.segmentIndex];
  addRoadSurface(
    segment,
    shoulder.centerX,
    shoulder.width,
    `${shoulder.side} shoulder ${shoulder.segmentIndex + 1}`,
    "#ddd8cc",
    GROUP.road,
  );
}

// Source town/canal containment. The canal wall also replaces the invented
// broad water death volume: falling over it reaches killY naturally.
for (const [segmentIndex, segment] of roadSegments.entries()) {
  add({
    t: "wallpath",
    p: [-7.2, segment.startY, -segment.start],
    pts: [
      [0, 0, 0, 0],
      [0, -(segment.end - segment.start), 0, segment.endY - segment.startY],
    ],
    w: 0.8,
    rise: 1.05,
    collisionHeight: 1.05,
    tex: "solid",
    color: "#b8bdb7",
    nm: `town wall ${segmentIndex + 1}`,
    grp: GROUP.town,
  });
  const canalHeight = Math.max(segment.startY, segment.endY) + 3.36;
  add({
    t: "wallpath",
    p: [7.2, segment.startY - canalHeight, -segment.start],
    pts: [
      [0, 0, 0, 0],
      [0, -(segment.end - segment.start), 0, segment.endY - segment.startY],
    ],
    w: 0.8,
    rise: canalHeight,
    collisionHeight: canalHeight,
    tex: "stone",
    color: "#737870",
    nm: `canal wall ${segmentIndex + 1}`,
    grp: GROUP.beach,
  });
}

// Ten long path rails replace Unity's 46 per-slab boundary rail objects while
// retaining the five discontinuous road/gap blocks and every elevation break.
const continuousRoadBlocks = [
  [-30, 430],
  [441, 900],
  [912, 1810],
  [1823, 2680],
  [2694, 3030],
] as const;
continuousRoadBlocks.forEach(([start, end], blockIndex) => {
  for (const side of [-1, 1] as const) {
    const points: RailPoint[] = [];
    for (let unityZ = start; unityZ < end; unityZ += 55) {
      points.push([
        side * 7.2,
        heightAt(unityZ) + (side < 0 ? 1.22 : 0.95),
        unityZ,
      ]);
    }
    points.push([
      side * 7.2,
      heightAt(end) + (side < 0 ? 1.22 : 0.95),
      end,
    ]);
    railPath(
      `${side < 0 ? "town" : "beach"} boundary ${blockIndex + 1}`,
      points,
    );
  }
});

gaps.forEach((gap, index) => {
  const midpoint = (gap.start + gap.end) * 0.5;
  const rampStart = gap.start - 18;
  const rampStartY = heightAt(rampStart);
  const takeoffY = heightAt(gap.start) + 2.2;
  add({
    t: "pit",
    p: [0, r2(heightAt(midpoint) - 1), r2(-midpoint)],
    s: [14.8, 1, r2(gap.end - gap.start - 0.2)],
    nm: gap.name,
    grp: GROUP.gaps,
  });
  add({
    t: "ramp",
    p: [gap.rampX, r2(rampStartY), r2(-(rampStart + gap.start) * 0.5)],
    len: 18,
    rise: r2(takeoffY - rampStartY),
    w: 4.5,
    edgeGrinding: false,
    tex: "pavement",
    color: "#d27535",
    nm: `${gap.name} launch`,
    grp: GROUP.gaps,
  });
  railPath(
    `${gap.name} bridge`,
    [
      [gap.railX, heightAt(gap.start) + 0.72, gap.start - 1.2],
      [gap.railX, heightAt(gap.end) + 0.72, gap.end + 1.2],
    ],
    GROUP.gaps,
  );

  const preTakeoffZ = gap.start - 0.6;
  const preTakeoffY = lerp(
    rampStartY,
    takeoffY,
    (preTakeoffZ - rampStart) / (gap.start - rampStart),
  );
  const fruitPoints: RailPoint[] = [
    [gap.rampX, heightAt(gap.start - 8) + 0.9, gap.start - 8],
    [gap.rampX, preTakeoffY + 0.9, preTakeoffZ],
    [gap.rampX, heightAt(gap.start) + 3.05, midpoint],
    [gap.rampX, heightAt(gap.end + 3) + 0.9, gap.end + 3],
  ];
  fruitPoints.forEach(([x, y, unityZ], fruitIndex) =>
    add({
      t: "wumpa",
      p: [x, r2(y), r2(-unityZ)],
      nm: `gap ${index + 1} arc ${fruitIndex + 1}`,
      grp: GROUP.actors,
    }),
  );
});

const stairs = [
  [-3.2, 45, 1.35],
  [3.2, 335, 1.4],
  [-3.2, 690, 1.55],
  [3.2, 955, 1.45],
  [-3.2, 1190, 1.7],
  [3.2, 1430, 1.4],
  [-3.2, 1700, 1.35],
  [3.2, 1880, 1.45],
  [-3.2, 2140, 1.65],
  [3.2, 2830, 1.5],
] as const;

stairs.forEach(([centerX, startZ, rise], setIndex) => {
  const baseY = heightAt(startZ);
  const approachLength = 12;
  const terraceLength = 4;
  const stepCount = 7;
  const stepDepth = 1.35;
  addRoadSurface(
    {
      name: `street stair approach ${setIndex + 1}`,
      start: startZ - approachLength,
      end: startZ,
      startY: heightAt(startZ - approachLength),
      endY: baseY + rise,
    },
    centerX,
    4.8,
    `street stair approach ${setIndex + 1}`,
    "#aaa392",
    GROUP.stairs,
  );
  add({
    t: "platform",
    p: [centerX, r2(baseY + rise - 0.35), r2(-(startZ + 2))],
    s: [4.8, 0.7, terraceLength],
    tex: "stone",
    color: "#aaa392",
    edgeGrinding: false,
    nm: `street stair terrace ${setIndex + 1}`,
    grp: GROUP.stairs,
  });
  const stairStart = startZ + terraceLength;
  for (let step = 0; step < stepCount; step++) {
    const topY = baseY + (rise * (stepCount - step)) / stepCount;
    const height = Math.max(0.16, topY - baseY);
    const unityZ = stairStart + (step + 0.5) * stepDepth;
    add({
      t: "platform",
      p: [centerX, r2(baseY + height * 0.5), r2(-unityZ)],
      s: [4.8, r2(height), stepDepth + 0.04],
      tex: "stone",
      color: "#aaa392",
      edgeGrinding: false,
      nm: `street stair step ${setIndex + 1}.${step + 1}`,
      grp: GROUP.stairs,
    });
  }
  railPath(
    `stair handrail ${setIndex + 1}`,
    [
      [centerX, baseY + rise + 0.72, stairStart - 0.3],
      [
        centerX,
        baseY + 0.72,
        stairStart + stepCount * stepDepth + 0.3,
      ],
    ],
    GROUP.stairs,
  );
});

const climbs = [
  [-3.2, 720],
  [3.2, 1130],
  [3.2, 2090],
  [-3.2, 2860],
] as const;
const climbElevations = [0.55, 1, 1.45, 1.9, 2.35, 1.9, 1.45, 1, 0.55] as const;
climbs.forEach(([centerX, startZ], sequence) => {
  climbElevations.forEach((elevation, index) => {
    const unityZ = startZ + index * 4.2;
    const top = heightAt(unityZ) + elevation;
    add({
      t: "platform",
      p: [centerX, r2(top - 0.225), r2(-unityZ)],
      s: [3.8, 0.45, 3.35],
      tex: "pavement",
      color: "#9f927d",
      edgeGrinding: false,
      nm: `climb ${sequence + 1}.${index + 1}`,
      grp: GROUP.ledges,
    });
    if (index % 2 === 0)
      add({
        t: "wumpa",
        p: [centerX, r2(top + 0.72), r2(-unityZ)],
        grp: GROUP.actors,
      });
  });
});

const boxLedges = [
  [3.1, 75, 12, 0.5], [-3.1, 350, 14, 0.45], [0, 520, 10, 0.52],
  [-3.1, 675, 12, 0.46], [-3.1, 770, 15, 0.5], [3.1, 980, 12, 0.48],
  [-3.1, 1140, 10, 0.46], [-3.1, 1210, 16, 0.52], [3.1, 1330, 12, 0.48],
  [-3.1, 1460, 14, 0.5], [3.1, 1600, 14, 0.46], [-3.1, 1730, 12, 0.5],
  [-3.1, 1765, 10, 0.44], [-3.1, 1895, 14, 0.52], [3.1, 1930, 10, 0.46],
  [-3.1, 2120, 14, 0.5], [-3.1, 2240, 16, 0.48], [-3.1, 2340, 12, 0.46],
  [3.1, 2490, 15, 0.52], [-3.1, 2610, 12, 0.48], [3.1, 2760, 12, 0.46],
  [-3.1, 2850, 14, 0.5], [-3.1, 2940, 16, 0.52], [0, 2980, 10, 0.44],
] as const;
boxLedges.forEach(([x, unityZ, length, height], index) => {
  const top = heightAt(unityZ) + height;
  add({
    t: "platform",
    p: [x, r2(top - height * 0.5), -unityZ],
    s: [1.15, height, length],
    tex: "pavement",
    color: "#8c7a65",
    nm: `box ledge ${index + 1}`,
    grp: GROUP.ledges,
  });
});

const reservedSideAt = (unityZ: number): number => {
  for (const [centerX, startZ] of stairs) {
    if (unityZ > startZ - 13 && unityZ < startZ + 15)
      return Math.sign(centerX);
  }
  for (const [centerX, startZ] of climbs) {
    if (unityZ > startZ - 2 && unityZ < startZ + 38)
      return Math.sign(centerX);
  }
  for (const [x, centerZ, length] of boxLedges) {
    if (
      Math.abs(x) > 0.1 &&
      unityZ > centerZ - length * 0.5 - 1 &&
      unityZ < centerZ + length * 0.5 + 1
    )
      return Math.sign(x);
  }
  return 0;
};

const freestandingRails = [
  [2.5, 115, 260, 0.7], [-2.5, 360, 400, 0.68], [2.4, 670, 790, 0.7],
  [-2.4, 820, 890, 0.72], [-2.4, 930, 1030, 0.68], [0, 1120, 1230, 0.72],
  [-2.3, 1250, 1360, 0.72], [2.3, 1390, 1510, 0.68], [-2.3, 1540, 1650, 0.72],
  [2.3, 1670, 1790, 0.68], [-2.3, 1980, 2060, 0.72], [2.3, 2180, 2270, 0.72],
  [-2.3, 2410, 2570, 0.72], [2.3, 2830, 2990, 0.68],
] as const;
freestandingRails.forEach(([x, start, end, railHeight], index) => {
  const points: RailPoint[] = [];
  for (let unityZ = start; unityZ < end; unityZ += 18) {
    points.push([x, heightAt(unityZ) + railHeight, unityZ]);
  }
  points.push([x, heightAt(end) + railHeight, end]);
  railPath(`street rail ${index + 1}`, points);
});

const boostDistances = [120, 405, 825, 875, 1260, 1550, 1785, 2190, 2420, 2655, 2720];
boostDistances.forEach((unityZ, index) =>
  add({
    t: "speedpad",
    p: [0, r2(heightAt(unityZ) + 0.02), -unityZ],
    s: [4.2, 0.22, 5.4],
    speed: 38 + (index % 3) * 2,
    cycle: 3.2,
    nm: `street boost ${index + 1}`,
    grp: GROUP.road,
  }),
);

const gruntDistances = [270, 315, 550, 620, 1040, 1105, 1380, 1518, 1950, 2148, 2295];
gruntDistances.forEach((unityZ, index) =>
  add({
    t: "enemy",
    p: [0, r2(heightAt(unityZ)), -unityZ],
    foe: "grunt",
    range: 3.45 + (index % 3) * 0.25,
    speed: 2.6 + (index % 4) * 0.35,
    grp: GROUP.actors,
  }),
);
const crossingThreats = [470, 1080, 1860, 2390, 2810];
crossingThreats.forEach((unityZ, index) =>
  add({
    t: "enemy",
    p: [[-4, 3.25, -2, 4, 0][index], r2(heightAt(unityZ)), -unityZ],
    foe: "spinner",
    range: 4,
    speed: 4.4 + index * 0.45,
    nm: `street crossing threat ${index + 1}`,
    grp: GROUP.actors,
  }),
);

const lanePattern = [0, -3.4, 3.4, -1.7, 1.7];
for (let index = 0; index < 52; index++) {
  const unityZ = resolveSafeActorZ(lerp(30, 2970, index / 51));
  const kind: NonNullable<CustomComponent["kind"]> =
    index % 13 === 8 ? "bouncy" : index % 7 === 4 ? "mystery" : "wood";
  const reservedSide = reservedSideAt(unityZ);
  add({
    t: "crate",
    p: [
      reservedSide === 0
        ? lanePattern[index % lanePattern.length]
        : -reservedSide * 3.5,
      r2(heightAt(unityZ)),
      r2(-unityZ),
    ],
    kind,
    grp: GROUP.actors,
  });
}

const checkpointCoordinates = [
  [-3.5, 510], [3.5, 1000], [-3.5, 1490], [-3.5, 2050], [-3.5, 2520], [3.5, 2860],
] as const;
checkpointCoordinates.forEach(([x, unityZ], index) =>
  add({
    t: "checkpoint",
    p: [x, r2(heightAt(unityZ)), -unityZ],
    nm: `coastal checkpoint ${index + 1}`,
    grp: GROUP.actors,
  }),
);

// 124 route fruit + 16 gap-arc + 20 climb fruit = the source 160.
let previousRouteFruitZ = Number.NEGATIVE_INFINITY;
for (let index = 0; index < 124; index++) {
  let unityZ = resolveSafeFruitZ(lerp(15, 2990, index / 123));
  if (unityZ < previousRouteFruitZ + 3)
    unityZ = previousRouteFruitZ + 3;
  previousRouteFruitZ = unityZ;
  add({
    t: "wumpa",
    p: [r2(Math.sin(index * 0.67) * 2.05), r2(heightAt(unityZ) + 0.9), r2(-unityZ)],
    grp: GROUP.actors,
  });
}

for (const house of streetKit.houses) {
  add({
    t: "decor",
    dkind: "coastalhouse",
    p: [house.body.center[0], r2(house.baseY), r2(-house.unityZ)],
    s: [house.body.size[0], house.body.size[1], house.body.size[2]],
    tn: house.district,
    vr: house.index,
    nm: `coastal house ${house.index + 1}`,
    grp: GROUP.town,
  });
}

for (const arrow of streetKit.route.arrows) {
  add({
    t: "decor",
    dkind: "roadarrow",
    p: [arrow.position[0], r2(arrow.position[1]), r2(-arrow.position[2])],
    amp: r2((Math.asin(arrow.frame.forward[1]) * 180) / Math.PI),
    nm: arrow.id,
    grp: GROUP.markings,
  });
}
add({
  t: "decor",
  dkind: "block",
  p: [
    streetKit.route.startStripe.center[0],
    streetKit.route.startStripe.center[1],
    -streetKit.route.startStripe.center[2],
  ],
  s: [
    streetKit.route.startStripe.size[0],
    streetKit.route.startStripe.size[1],
    streetKit.route.startStripe.size[2],
  ],
  tex: "solid",
  color: "#ffb314",
  nm: "source start stripe",
  grp: GROUP.markings,
});

const cameraDistances = new Set<number>();
for (let unityZ = -20; unityZ <= 3030; unityZ += 190)
  cameraDistances.add(unityZ);
for (const segment of roadSegments) {
  cameraDistances.add(segment.start);
  cameraDistances.add(segment.end);
}
for (const unityZ of [...cameraDistances].sort((a, b) => a - b)) {
  add({
    t: "camnode",
    p: [0, r2(heightAt(unityZ) + 2.2), -unityZ],
    radius: 28,
    grp: GROUP.camera,
  });
}

add({
  t: "crystal",
  p: [0, r2(heightAt(2940) + 0.7), -2940],
  nm: "Coastal crystal",
  grp: GROUP.actors,
});
add({
  t: "gate",
  p: [0, r2(heightAt(3005)), -3005],
  yaw: 0,
  nm: "finish promenade",
  grp: GROUP.actors,
});

export const COASTAL_STREET_RUN_LEVEL: CustomLevelData = {
  v: 1,
  name: "Coastal Street Run",
  spawn: [0, r2(heightAt(-15) + 0.12), 15],
  killY: -6,
  sky: "coast",
  ocean: {
    p: [9.2, -0.36, -1500],
    length: 3400,
    yaw: 0,
    seaward: 1,
    width: 180,
    overlap: 4,
    longitudinalSegments: 160,
    lateralSegments: 128,
    sourceCoordinates: "unity",
  },
  unitySand: [
    {
      p: [55, -0.78, -1500],
      s: [70, 0.8, 3300],
    },
  ],
  groups: [
    { id: GROUP.road, nm: "district road" },
    { id: GROUP.gaps, nm: "death gaps and alternatives" },
    { id: GROUP.stairs, nm: "street stairs" },
    { id: GROUP.ledges, nm: "ledges and climb routes" },
    { id: GROUP.rails, nm: "grind rails" },
    { id: GROUP.actors, nm: "crates, fruit, checkpoints and enemies" },
    { id: GROUP.beach, nm: "screen-right MatrixRex coast" },
    { id: GROUP.camera, nm: "camera route" },
    { id: GROUP.town, nm: "left-side coastal town" },
    { id: GROUP.markings, nm: "painted route markings" },
  ],
  components,
};
