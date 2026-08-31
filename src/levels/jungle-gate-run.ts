import type { CustomComponent, CustomLevelData } from "../level";

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};
const r2 = (value: number): number => Math.round(value * 100) / 100;

const LANE_DEPTH = 8.5;
const PLATFORM_THICKNESS = 1.2;
const FOUNDATION_BOTTOM = -8;

const GROUP = {
  platforms: 1,
  gaps: 2,
  rails: 3,
  actors: 4,
  containment: 5,
  camera: 6,
  scenery: 7,
} as const;

type PlatformDefinition = readonly [
  name: string,
  minimumX: number,
  maximumX: number,
  topY: number,
  wood: boolean,
];

const PLATFORM_DEFINITIONS: PlatformDefinition[] = [
  ["Start terrace", -24, 18, 0, false],
  ["Bounce landing 01", 20.5, 52, 9, true],
  ["Drop step 01", 52, 64, 7, true],
  ["Rail run-up 01", 64, 78, 6, false],
  ["Rail landing 01", 98, 139, 6, false],
  ["Bounce landing 02", 142.5, 174, 15, true],
  ["Drop step 02", 174, 188, 13, true],
  ["Skate runway 01", 188, 221, 14, false],
  ["Skate landing 01", 242, 264, 15.25, false],
  ["Rail run-up 02", 264, 295, 15.5, true],
  ["Rail landing 02", 315, 344, 15.5, true],
  ["Drop step 03", 344, 358, 14, false],
  ["Skate runway 02", 358, 383, 12, false],
  ["Finish terrace", 404, 443, 13.25, true],
];

PLATFORM_DEFINITIONS.forEach(([name, minimumX, maximumX, topY, wood]) => {
  const width = maximumX - minimumX;
  const centerX = (minimumX + maximumX) / 2;
  add({
    t: "platform",
    p: [centerX, topY - PLATFORM_THICKNESS / 2, 0],
    s: [width, PLATFORM_THICKNESS, LANE_DEPTH],
    tex: wood ? "plank" : "jungle",
    color: wood ? "#75401a" : "#3d914f",
    edgeGrinding: false,
    nm: name,
    grp: GROUP.platforms,
  });

  const foundationTop = topY - PLATFORM_THICKNESS;
  const foundationHeight = foundationTop - FOUNDATION_BOTTOM;
  if (foundationHeight > 0) {
    add({
      t: "decor",
      dkind: "block",
      p: [centerX, FOUNDATION_BOTTOM + foundationHeight / 2, 0],
      s: [Math.max(0.2, width - 0.12), foundationHeight, 8],
      tex: wood ? "wood" : "stone",
      color: wood ? "#301709" : "#333324",
      nm: `${name} foundation`,
      grp: GROUP.scenery,
    });
  }
});

// Unity's kickers rise in +X. Browser ramps rise toward local -Z, so -90° is
// the exact cardinal rotation and keeps both takeoff lips flush with the runs.
add({
  t: "ramp",
  p: [224.5, 14, 0],
  len: 7,
  rise: 1.25,
  w: LANE_DEPTH,
  yaw: -90,
  edgeGrinding: false,
  tex: "jungle",
  color: "#3d914f",
  nm: "Skate kicker 01",
  grp: GROUP.platforms,
});
add({
  t: "ramp",
  p: [386.5, 12, 0],
  len: 7,
  rise: 1.25,
  w: LANE_DEPTH,
  yaw: -90,
  edgeGrinding: false,
  tex: "jungle",
  color: "#3d914f",
  nm: "Skate kicker 02",
  grp: GROUP.platforms,
});

const thornPit = (minimumX: number, maximumX: number, name: string): void => {
  add({
    t: "pit",
    p: [(minimumX + maximumX) / 2, -4.4, 0],
    s: [maximumX - minimumX, 1, 8],
    nm: name,
    grp: GROUP.gaps,
  });
};

thornPit(18, 20.5, "Arrow climb thorns 01");
thornPit(78, 98, "Rail-only chasm 01");
thornPit(139, 142.5, "Arrow climb thorns 02");
thornPit(228, 242, "Skate-jump thorns 01");
thornPit(295, 315, "Rail-only chasm 02");
thornPit(390, 404, "Skate-jump thorns 02");

const pathRail = (
  name: string,
  points: readonly (readonly [x: number, y: number, z: number])[],
): void => {
  const first = points[0];
  add({
    t: "rail",
    p: [first[0], first[1], first[2]],
    pts: points.map(([x, y, z]) => [
      r2(x - first[0]),
      r2(z - first[2]),
      0,
      r2(y - first[1]),
    ]),
    nm: name,
    grp: GROUP.rails,
  });
};

pathRail("Rising long rail", [
  [76.5, 6.35, 0],
  [84, 6.35, 0.25],
  [92, 6.35, -0.25],
  [99.5, 6.35, 0],
]);
pathRail("High canopy rail", [
  [293.5, 15.85, 0],
  [301, 15.85, -0.25],
  [309, 15.85, 0.25],
  [316.5, 15.85, 0],
]);

add({
  t: "crate",
  p: [13.5, 0, 0],
  kind: "metalbounce",
  nm: "Arrow climb 01",
  grp: GROUP.actors,
});
add({
  t: "crate",
  p: [135.5, 6, 0],
  kind: "metalbounce",
  nm: "Arrow climb 02",
  grp: GROUP.actors,
});
add({ t: "checkpoint", p: [106, 6, 0], nm: "Checkpoint 01", grp: GROUP.actors });
add({
  t: "checkpoint",
  p: [251, 15.25, 0],
  nm: "Checkpoint 02",
  grp: GROUP.actors,
});
add({
  t: "checkpoint",
  p: [325, 15.5, 0],
  nm: "Checkpoint 03",
  grp: GROUP.actors,
});
add({ t: "gate", p: [428, 13.25, 0], yaw: 90, grp: GROUP.actors });
add({ t: "clock", p: [-15, 0, -2.5], grp: GROUP.actors });
add({ t: "comboorb", p: [-15, 0, 2.5], grp: GROUP.actors });

// Invisible depth boundaries reproduce the guarded 8.5 m side-view lane.
for (const z of [-4.55, 4.55]) {
  add({
    t: "wall",
    p: [212.5, -20, z],
    s: [485, 54, 0.6],
    collisionHeight: 54,
    invisible: true,
    nm: z < 0 ? "Near depth boundary" : "Far depth boundary",
    grp: GROUP.containment,
  });
}

add({
  t: "zone",
  p: [212.5, 0, 0],
  s: [535, 1, 18],
  dir: "E",
  nm: "Whole-course east side view",
  grp: GROUP.camera,
});
add({ t: "camnode", p: [-30, 0, 0], radius: 0, grp: GROUP.camera });
add({ t: "camnode", p: [455, 0, 0], radius: 0, grp: GROUP.camera });

// A low, sparse palisade keeps the jungle-gate rhythm without crossing the
// side-camera sightline. The Unity scene's 28m-high backdrop silhouettes sit
// too close to the browser camera and would turn into foreground occluders.
for (let x = -30; x <= 455; x += 56) {
  const height = 5.5 + 0.5 * Math.sin(x * 0.17);
  add({
    t: "decor",
    dkind: "block",
    p: [x, -1.5 + height / 2, 4.25],
    s: [0.72, r2(height), 0.72],
    color: "#75401a",
    tex: "wood",
    nm: "Palisade post",
    grp: GROUP.scenery,
  });
  add({
    t: "decor",
    dkind: "block",
    p: [x, -1.5 + height + 0.35, 4.25],
    s: [0.9, 1.5, 0.9],
    yaw: 45,
    color: "#301709",
    tex: "wood",
    nm: "Palisade cap",
    grp: GROUP.scenery,
  });
}
for (let x = -5; x <= 443; x += 84) {
  add({
    t: "decor",
    dkind: "block",
    p: [x, 1.75, 4.1],
    s: [1.35, 6.5, 0.9],
    color: "#333324",
    tex: "stone",
    nm: "Gate pier",
    grp: GROUP.scenery,
  });
}

export const JUNGLE_GATE_RUN_LEVEL: CustomLevelData = {
  v: 1,
  name: "Jungle Gate Run",
  spawn: [-20, 0.12, 0],
  killY: -18,
  // The source course's two arrow-crate ascents were notoriously exacting.
  // Keep their geometry, but give every intended lip in this level the full
  // catch envelope: earlier hand contact, more reach, and a wider near miss.
  ledgeAssist: 1,
  sky: "day",
  groups: [
    { id: GROUP.platforms, nm: "side-scroll platforms" },
    { id: GROUP.gaps, nm: "thorn gaps" },
    { id: GROUP.rails, nm: "required grind rails" },
    { id: GROUP.actors, nm: "arrow crates and checkpoints" },
    { id: GROUP.containment, nm: "depth containment" },
    { id: GROUP.camera, nm: "east travel camera" },
    { id: GROUP.scenery, nm: "great gate dressing" },
  ],
  components,
};
