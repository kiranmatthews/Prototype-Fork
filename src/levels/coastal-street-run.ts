import type { CustomComponent, CustomLevelData } from "../level";

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

const isInsideGap = (unityZ: number, padding = 0): boolean =>
  gaps.some(
    (gap) => unityZ > gap.start - padding && unityZ < gap.end + padding,
  );

const resolveSafeActorZ = (unityZ: number): number => {
  for (const gap of gaps) {
    if (unityZ > gap.start - 24 && unityZ < gap.end + 18) return gap.end + 22;
  }
  return unityZ;
};

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

// The source road uses 23 exact slabs. Flat pieces stay boxes; grade changes
// become analytic ramps whose low/high ends meet their neighbours precisely.
for (const segment of roadSegments) {
  const length = segment.end - segment.start;
  const middleZ = -(segment.start + segment.end) * 0.5;
  if (Math.abs(segment.endY - segment.startY) < 0.001) {
    add({
      t: "platform",
      p: [0, segment.startY - 0.425, middleZ],
      s: [12, 0.85, length + 0.08],
      tex: "asphalt",
      color: "#59636b",
      nm: segment.name,
      grp: GROUP.road,
    });
  } else {
    add({
      t: "ramp",
      p: [0, Math.min(segment.startY, segment.endY), middleZ],
      len: length,
      rise: Math.abs(segment.endY - segment.startY),
      w: 12,
      yaw: segment.endY >= segment.startY ? 0 : 180,
      tex: "asphalt",
      color: "#59636b",
      nm: segment.name,
      grp: GROUP.road,
    });
  }
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
      points.push([side * 6.55, heightAt(unityZ) + 0.72, unityZ]);
    }
    points.push([side * 6.55, heightAt(end) + 0.72, end]);
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

  const fruitPoints: RailPoint[] = [
    [gap.rampX, heightAt(gap.start - 8) + 0.9, gap.start - 8],
    [gap.rampX, takeoffY + 0.9, gap.start - 0.6],
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

stairs.forEach(([centerX, startZ, railHeight], setIndex) => {
  for (let step = 0; step < 4; step++) {
    const unityZ = startZ + step * 1.55;
    const top = heightAt(unityZ) + 0.18 * (step + 1);
    add({
      t: "platform",
      p: [centerX, r2(top - 0.14), r2(-unityZ)],
      s: [4.8, 0.28, 1.62],
      tex: "stone",
      color: "#aaa392",
      nm: `street stair ${setIndex + 1}.${step + 1}`,
      grp: GROUP.stairs,
    });
  }
  const side = Math.sign(centerX);
  railPath(
    `stair handrail ${setIndex + 1}`,
    [
      [centerX + side * 2.15, heightAt(startZ) + railHeight, startZ - 0.8],
      [
        centerX + side * 2.15,
        heightAt(startZ + 6.2) + railHeight + 0.72,
        startZ + 7,
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
const climbElevations = [0.55, 1.45, 2.35, 1.45, 0.55] as const;
const climbIndices = [0, 2, 4, 6, 8] as const;
climbs.forEach(([centerX, startZ], sequence) => {
  climbIndices.forEach((sourceIndex, index) => {
    const unityZ = startZ + sourceIndex * 4.2;
    const top = heightAt(unityZ) + climbElevations[index];
    add({
      t: "platform",
      p: [centerX, r2(top - 0.225), r2(-unityZ)],
      s: [3.8, 0.45, 3.35],
      tex: "pavement",
      color: "#9f927d",
      nm: `climb ${sequence + 1}.${index + 1}`,
      grp: GROUP.ledges,
    });
    add({
      t: "wumpa",
      p: [centerX, r2(top + 0.78), r2(-unityZ)],
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
for (let index = 0; index < 32; index++) {
  const unityZ = resolveSafeActorZ(lerp(30, 2970, index / 31));
  const kind: NonNullable<CustomComponent["kind"]> =
    index % 13 === 8 ? "bouncy" : index % 7 === 4 ? "mystery" : "wood";
  add({
    t: "crate",
    p: [lanePattern[index % lanePattern.length], r2(heightAt(unityZ)), r2(-unityZ)],
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

// A lighter fruit population than Unity's 160 keeps the browser draw count
// sensible while preserving the long route rhythm and every authored jump arc.
for (let index = 0; index < 64; index++) {
  let unityZ = lerp(15, 2990, index / 63);
  if (isInsideGap(unityZ, 9)) unityZ += 22;
  add({
    t: "wumpa",
    p: [r2(Math.sin(index * 0.67) * 2.05), r2(heightAt(unityZ) + 0.9), r2(-unityZ)],
    grp: GROUP.actors,
  });
}

// Reuse Beachside's warm sand / turquoise deep-water treatment on screen
// right, but straighten it to match the street's fixed camera axis.
add({
  t: "terrain",
  p: [30, -0.72, 60],
  pts: [
    [0, 0, 0, 0],
    [1.5, -760, 0, 0.14],
    [-1, -1530, 0, -0.04],
    [1.2, -2300, 0, 0.11],
    [0, -3150, 0, 0],
  ],
  w: 36,
  amp: 0.04,
  curve: "spline",
  berms: false,
  tex: "sand",
  color: "#e6c788",
  nm: "screen-right beach",
  grp: GROUP.beach,
});
add({
  t: "platform",
  p: [64, -1.53, -1485],
  s: [38, 0.3, 3300],
  tex: "metal",
  color: "#238ea9",
  nm: "screen-right ocean",
  grp: GROUP.beach,
});
add({
  t: "pit",
  // Submerged beneath the blue presentation deck so the shared pit artwork
  // does not turn the coastal water into lava; its touch volume still reaches
  // the water surface.
  p: [65, -1.55, -1485],
  s: [27, 1, 3250],
  nm: "screen-right deep water",
  grp: GROUP.beach,
});

for (let unityZ = -20; unityZ <= 3030; unityZ += 190) {
  add({
    t: "camnode",
    p: [0, r2(heightAt(unityZ) + 2.2), -unityZ],
    radius: 28,
    grp: GROUP.camera,
  });
}

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
  groups: [
    { id: GROUP.road, nm: "district road" },
    { id: GROUP.gaps, nm: "death gaps and alternatives" },
    { id: GROUP.stairs, nm: "street stairs" },
    { id: GROUP.ledges, nm: "ledges and climb routes" },
    { id: GROUP.rails, nm: "grind rails" },
    { id: GROUP.actors, nm: "crates, fruit, checkpoints and enemies" },
    { id: GROUP.beach, nm: "screen-right Beachside treatment" },
    { id: GROUP.camera, nm: "camera route" },
  ],
  components,
};
