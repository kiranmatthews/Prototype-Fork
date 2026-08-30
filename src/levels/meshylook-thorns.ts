import type { CustomComponent, CustomLevelData } from "../level";

/**
 * Primitive-owned port of Unity's playable MeshyLookDev bridge row.
 *
 * The four Ancient Stone Courtyard FBXs remain visual evidence in Unity. Here,
 * alternating ramps own traversal, exact authored ridge paths own grinding,
 * and deliberately smaller pit volumes own thorn lethality.
 */

const GROUP = {
  courtyard: 1,
  rails: 2,
  thornCollision: 3,
  thornPlaceholders: 4,
  camera: 5,
  finish: 6,
} as const;

export interface ProceduralThornSpec {
  readonly identity: string;
  readonly center: readonly [number, number, number];
  readonly visualSize: readonly [number, number, number];
  readonly collisionSurfaceY: number;
  readonly collisionSize: readonly [number, number, number];
  readonly emission: {
    readonly color: string;
    readonly minimum: number;
    readonly peak: number;
    readonly cycleSeconds: number;
  };
}

const THORN_CENTERS = [0, 10.8, 21.6, 32.4] as const;
const THORN_SURFACE_Y = 1.495761;

/** Presentation and fair-collision metadata carried over from Unity. */
export const MESHYLOOK_THORN_SPECS: readonly ProceduralThornSpec[] =
  THORN_CENTERS.map((x, index) => ({
    identity: `meshylook.thorns.${String(index + 1).padStart(2, "0")}`,
    // Lift the code-native tips to the deck lip. The Unity Meshy cluster sat
    // deeper, but its HDR material/light made it read above the well; matching
    // the readable silhouette matters more than reproducing empty darkness.
    center: [x, 0.48, 0] as const,
    // Unity's fitted ThorncoilCluster bounds before its +/-6 degree module pitch.
    visualSize: [2.14, 1.01, 2.26] as const,
    collisionSurfaceY: THORN_SURFACE_Y - 0.3,
    // Visible footprint minus the player's 1m collision diameter. This makes
    // player-body overlap begin at the visible core rather than 1.3m early.
    collisionSize: [1.15, 1.6, 1.25] as const,
    emission: {
      color: "#62ff29",
      minimum: 1,
      peak: 2,
      cycleSeconds: 2.4,
    },
  }));

const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => {
  components.push(component);
};

const modules = [
  // centre X, low edge Y, horizontal length, rise, yaw
  [-0.15721084, 0.9313072, 10.7408362, 1.1289076, -90],
  [10.9572115, 0.9313072, 10.7408362, 1.1289076, 90],
  [21.44279, 0.9313072, 10.7408362, 1.1289076, -90],
  [32.557213, 0.9313072, 10.7408362, 1.1289076, 90],
] as const;

modules.forEach(([x, lowY, len, rise, yaw], index) => {
  const minimumX = x - len / 2;
  const maximumX = x + len / 2;
  const holeCenterX = THORN_CENTERS[index];
  const holeHalfX = 1.18;
  const centerWidth = 2.36;
  const sideWidth = (11.52 - centerWidth) / 2;
  const sideOffset = centerWidth / 2 + sideWidth / 2;
  const surfaceY = (worldX: number): number =>
    yaw < 0
      ? lowY + rise * ((worldX - minimumX) / len)
      : lowY + rise * ((maximumX - worldX) / len);
  const ramp = (
    name: string,
    fromX: number,
    toX: number,
    z: number,
    width: number,
  ): void => {
    const segmentLength = toX - fromX;
    const segmentRise = Math.abs(surfaceY(toX) - surfaceY(fromX));
    add({
      t: "ramp",
      p: [
        (fromX + toX) / 2,
        yaw < 0 ? surfaceY(fromX) : surfaceY(toX),
        z,
      ],
      len: segmentLength,
      rise: segmentRise,
      w: width,
      yaw,
      tex: "stone",
      color: index % 2 === 0 ? "#59666b" : "#53615f",
      nm: `Courtyard ${String(index + 1).padStart(2, "0")} ${name}`,
      grp: GROUP.courtyard,
    });
  };

  // Full-length side banks carry the exact ridge rails. The narrow centre
  // bank is split around the source thorn footprint, so the glowing cluster
  // is genuinely visible in a courtyard hole instead of buried under a ramp.
  ramp("left bank", minimumX, maximumX, -sideOffset, sideWidth);
  ramp("right bank", minimumX, maximumX, sideOffset, sideWidth);
  ramp("centre approach", minimumX, holeCenterX - holeHalfX, 0, centerWidth);
  ramp("centre departure", holeCenterX + holeHalfX, maximumX, 0, centerWidth);
});

const railSegments = [
  [-2.7232566, 1.4191163, 2.272, 2.3686957, 1.9543022],
  [-2.7232566, 1.4191163, -2.272, 2.3686957, 1.9543022],
  [8.431305, 1.9543022, 2.272, 13.523256, 1.4191163],
  [8.431305, 1.9543022, -2.272, 13.523256, 1.4191163],
  [18.876743, 1.4191163, 2.272, 23.968697, 1.9543022],
  [18.876743, 1.4191163, -2.272, 23.968697, 1.9543022],
  [30.031305, 1.9543022, 2.272, 35.123257, 1.4191163],
  [30.031305, 1.9543022, -2.272, 35.123257, 1.4191163],
] as const;

railSegments.forEach(([x0, y0, z0, x1, y1], index) =>
  add({
    t: "rail",
    p: [x0, y0, z0],
    pts: [
      [0, 0, 0, 0],
      [x1 - x0, 0, 0, y1 - y0],
    ],
    w: 0.08,
    nm: `Courtyard ridge rail ${String(index + 1).padStart(2, "0")}`,
    grp: GROUP.rails,
  }),
);

for (let index = 0; index < MESHYLOOK_THORN_SPECS.length; index++) {
  const thorn = MESHYLOOK_THORN_SPECS[index];
  add({
    t: "pit",
    p: [thorn.center[0], thorn.collisionSurfaceY, thorn.center[2]],
    s: [thorn.collisionSize[0], 1, thorn.collisionSize[2]],
    invisible: true,
    nm: `Small thorn core ${String(index + 1).padStart(2, "0")}`,
    grp: GROUP.thornCollision,
  });
  add({
    t: "thorn",
    p: [thorn.center[0], thorn.center[1], thorn.center[2]],
    s: [...thorn.visualSize],
    color: thorn.emission.color,
    seed: 0x6a40 + index * 977,
    nm: `THORN_VISUAL_${String(index + 1).padStart(2, "0")}__${thorn.identity}`,
    grp: GROUP.thornPlaceholders,
  });
}

const cameraSpine = [
  [-5.527629, 0.9313072, 0],
  [-0.15721084, 1.495761, 0],
  [5.2132072, 2.0602148, 0],
  [10.9572115, 1.495761, 0],
  [16.32763, 0.9313072, 0],
  [21.44279, 1.495761, 0],
  [26.813208, 2.0602148, 0],
  [32.557213, 1.495761, 0],
  [37.92763, 0.9313072, 0],
] as const;

add({
  t: "zone",
  p: [16.2, 0, 0],
  s: [50, 1, 20],
  dir: "E",
  nm: "Meshy bridge-row east camera",
  grp: GROUP.camera,
});
cameraSpine.forEach(([x, y, z], index) =>
  add({
    t: "camnode",
    p: [x, y, z],
    radius: index === 0 || index === cameraSpine.length - 1 ? 4 : 0,
    grp: GROUP.camera,
  }),
);

// Unity's look-dev scene has no finish. This small supported apron and gate are
// explicitly web-only so the source-owned course satisfies the published-level
// contract without pretending the Unity lab contains progression.
add({
  t: "platform",
  p: [40.5, 0.4313072, 0],
  s: [5.2, 1, 11.52],
  tex: "stone",
  color: "#586568",
  nm: "Web-only finish apron",
  grp: GROUP.finish,
});
add({
  t: "gate",
  p: [40, 0.9313072, 0],
  yaw: 90,
  nm: "Web-only MeshyLook finish",
  grp: GROUP.finish,
});

export const MESHYLOOK_THORNS_LEVEL: CustomLevelData = {
  v: 1,
  name: "MeshyLook Thorn Courtyards",
  spawn: [-3.5385852, 1.1403642, 0],
  killY: -4,
  sky: "night",
  components,
  groups: [
    { id: GROUP.courtyard, nm: "four alternating courtyard slopes" },
    { id: GROUP.rails, nm: "exact ridge grind paths" },
    { id: GROUP.thornCollision, nm: "small lethal thorn cores" },
    { id: GROUP.thornPlaceholders, nm: "visual-only thorn placeholders" },
    { id: GROUP.camera, nm: "Unity camera spine" },
    { id: GROUP.finish, nm: "web-only completion" },
  ],
};
