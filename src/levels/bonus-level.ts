import type { CustomComponent, CustomLevelData } from "../level";

/**
 * Source-owned reconstruction of Unity's BonusLevel scene.
 *
 * Unity authors this as a one-line +X course: seven supported islands, three
 * mandatory crate bridges, a vertical lift, and one rail crossing. Imported
 * Meshy platform meshes are presentation only there, so this web version keeps
 * gameplay authority in the existing primitive set as well.
 */

const GROUP = {
  platforms: 1,
  crateBridges: 2,
  mechanisms: 3,
  containment: 4,
  camera: 5,
  finish: 6,
} as const;

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};

const support = (
  name: string,
  minimumX: number,
  maximumX: number,
  topY: number,
  color: string,
): void => {
  const bottomY = -7.5;
  add({
    t: "platform",
    p: [(minimumX + maximumX) * 0.5, (bottomY + topY) * 0.5, 0],
    s: [maximumX - minimumX, topY - bottomY, 8.5],
    tex: "stone",
    color,
    edgeGrinding: false,
    nm: name,
    grp: GROUP.platforms,
  });
};

support("Start terrace", -28, -17, 0, "#756b86");
support("First puzzle bridge landing", -5.5, 6, 0, "#536b83");
support("Lift approach bench", 18, 29, 2, "#745b58");
support("Lift exit bridge", 39, 50, 5, "#526b78");
support("Rail landing terrace", 66, 77, 5, "#766b87");
support("Final puzzle landing bench", 89.5, 99, 3, "#775d58");
support("Finish bridge", 99, 112, 3, "#516d78");

type BonusCrate = readonly [x: number, deckY: number, kind: "wood" | "mystery"];

// Runtime crates are 0.96 wide. Rows meant to read as continuous use a 0.95
// pitch (a 1 cm overlap), while the larger puzzle jumps remain deliberately
// open; preserved Unity centres were 1.06–1.35 apart and created fall-through
// hairline cracks in the browser.

const bridgeA: readonly BonusCrate[] = [
  [-14.7, 0, "wood"],
  [-13.75, 0, "wood"],
  [-12.8, 0, "wood"],
  [-11.85, 0, "wood"],
  [-11.85, 0.96, "mystery"],
  [-10.9, 0, "mystery"],
  [-9.95, 0, "wood"],
  [-9, 0, "wood"],
  [-8.05, 0, "wood"],
];

const bridgeB: readonly BonusCrate[] = [
  [8.3, 0, "wood"],
  [9.25, 0, "wood"],
  [10.2, 0, "wood"],
  [11.15, 0, "wood"],
  [12.1, 0, "wood"],
  [12.1, 0.96, "wood"],
  [13.05, 0, "wood"],
  [14, 0, "wood"],
  [14, 0.96, "wood"],
  [14.95, 0, "wood"],
  [15.9, 0, "wood"],
  [15.9, 0.96, "wood"],
];

const bridgeC: readonly BonusCrate[] = [
  [78.43, 2, "wood"],
  [78.43, 2.96, "mystery"],
  [78.43, 3.92, "mystery"],
  [79.38, 3.92, "mystery"],
  [80.75, 2, "wood"],
  [80.95, 2.96, "mystery"],
  [81.9, 2.96, "mystery"],
  [83.85, 2, "wood"],
  [84.8, 2, "wood"],
  [85.75, 2, "wood"],
  [86.7, 2, "wood"],
  [87.65, 2, "mystery"],
];

const addCrateBridge = (name: string, placements: readonly BonusCrate[]): void => {
  placements.forEach(([x, deckY, kind], index) =>
    add({
      t: "crate",
      p: [x, deckY, 0],
      kind,
      nm: `${name} crate ${String(index + 1).padStart(2, "0")}`,
      grp: GROUP.crateBridges,
    }),
  );
};

addCrateBridge("Bridge A", bridgeA);
addCrateBridge("Bridge B", bridgeB);
addCrateBridge("Bridge C", bridgeC);

add({
  t: "mover",
  p: [34, 3, 0],
  s: [5.2, 0.6, 8.5],
  axis: "y",
  amp: 2,
  speed: 0.72,
  phase: 0,
  tex: "stone",
  color: "#756b86",
  nm: "Vertical Meshy terrace lift",
  grp: GROUP.mechanisms,
});

add({
  t: "rail",
  p: [58, 5.35, 0],
  len: 13.5,
  yaw: 90,
  nm: "Mid-course rail gap",
  grp: GROUP.mechanisms,
});

// Unity resolves these faces from player half-depth .5, wall skin .02, and a
// .01 centre tolerance. The .6-thick walls therefore sit at +/- .83.
for (const z of [-0.83, 0.83]) {
  add({
    t: "wall",
    p: [42, -14, z],
    s: [160, 42, 0.6],
    invisible: true,
    nm: z < 0 ? "Camera-side one-line boundary" : "Backdrop-side one-line boundary",
    grp: GROUP.containment,
  });
}

add({
  t: "zone",
  p: [42, 0, 0],
  s: [160, 1, 18],
  dir: "E",
  nm: "Whole-course east side camera",
  grp: GROUP.camera,
});
add({ t: "camnode", p: [-32, 0, 0], radius: 5, grp: GROUP.camera });
add({ t: "camnode", p: [116, 0, 0], radius: 5, grp: GROUP.camera });

// Unity places a direct floating mask collectible here. The current web level
// contract has no direct mask pickup, so a mask crate is the explicit, isolated
// approximation until that reusable primitive exists.
add({
  t: "crate",
  p: [94, 3, 0],
  kind: "mask",
  nm: "Uber mask approximation (Unity uses direct pickup)",
  grp: GROUP.finish,
});
add({
  t: "gate",
  p: [106, 3, 0],
  yaw: 90,
  nm: "Bonus finish rune / web warp gate",
  grp: GROUP.finish,
});

export const BONUS_LEVEL: CustomLevelData = {
  v: 1,
  name: "Bonus Level",
  spawn: [-24, 0.12, 0],
  killY: -13,
  hudMode: "bonus",
  sky: "night",
  components,
  groups: [
    { id: GROUP.platforms, nm: "supported Meshy islands" },
    { id: GROUP.crateBridges, nm: "33-crate puzzle bridges" },
    { id: GROUP.mechanisms, nm: "lift and rail" },
    { id: GROUP.containment, nm: "one-line depth containment", editorOnly: true },
    { id: GROUP.camera, nm: "east side camera" },
    { id: GROUP.finish, nm: "pickup and finish" },
  ],
};

export const BONUS_CRATE_COUNT = bridgeA.length + bridgeB.length + bridgeC.length;
