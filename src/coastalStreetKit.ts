/**
 * Pure source-authority descriptors for Coastal Street Run's streetscape.
 *
 * Coordinates deliberately remain in the Unity scene's +Z convention. The
 * browser level performs its usual `(x, y, z) -> (x, y, -z)` reflection at
 * the presentation boundary. Keeping that conversion out of this module
 * makes every source measurement directly auditable and leaves the semantic
 * pieces suitable for boxes today or fitted meshes later.
 */

export type CoastalStreetVec3 = readonly [x: number, y: number, z: number];
export type CoastalStreetRgb = readonly [r: number, g: number, b: number];

export interface CoastalStreetRoadSegment {
  name: string;
  start: number;
  end: number;
  startY: number;
  endY: number;
}

export type CoastalStreetHeightSampler = (unityZ: number) => number;

export type CoastalStreetPaletteId =
  | "coastal-road"
  | "coastal-sidewalk-shoulder"
  | "coastal-route-marking"
  | "coastal-roof"
  | "coastal-window"
  | "coastal-trim"
  | `coastal-building-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

export type CoastalStreetPieceRole =
  | "road-shoulder"
  | "route-arrow-shaft"
  | "route-arrow-head"
  | "route-start-stripe"
  | "building-body"
  | "building-roof"
  | "building-window"
  | "building-awning"
  | "building-door";

export interface CoastalStreetPaletteDescriptor {
  id: CoastalStreetPaletteId;
  role:
    | "road"
    | "shoulder"
    | "route-marking"
    | "building"
    | "roof"
    | "window"
    | "trim";
  color: CoastalStreetRgb;
  lit: boolean;
  metallic?: number;
  smoothness?: number;
  specular?: CoastalStreetRgb;
}

export interface CoastalStreetSurfaceFrame {
  /** Local +X in Unity source coordinates. */
  right: CoastalStreetVec3;
  /** Local +Y, normal to the road grade. */
  up: CoastalStreetVec3;
  /** Local +Z, following the Unity course direction. */
  forward: CoastalStreetVec3;
}

export interface CoastalStreetLocalBoxDescriptor {
  id: string;
  role: "route-arrow-shaft" | "route-arrow-head";
  palette: "coastal-route-marking";
  center: CoastalStreetVec3;
  size: CoastalStreetVec3;
  /** Unity Euler degrees, applied in the arrow's local road frame. */
  rotationDeg: CoastalStreetVec3;
}

export interface CoastalStreetWorldBoxDescriptor {
  id: string;
  role: Exclude<
    CoastalStreetPieceRole,
    "road-shoulder" | "route-arrow-shaft" | "route-arrow-head"
  >;
  palette: CoastalStreetPaletteId;
  center: CoastalStreetVec3;
  size: CoastalStreetVec3;
  /** Unity Euler degrees. */
  rotationDeg: CoastalStreetVec3;
  visualOnly: true;
}

export interface CoastalStreetShoulderDescriptor {
  id: string;
  role: "road-shoulder";
  palette: "coastal-sidewalk-shoulder";
  side: "town" | "water";
  segmentIndex: number;
  segmentName: string;
  centerX: number;
  startZ: number;
  endZ: number;
  startY: number;
  endY: number;
  width: number;
  thickness: number;
  longitudinalOverlap: number;
  surfaceKind: "ground";
  boardClassification: "road";
  edgeGrinding: false;
  solidSides: false;
}

export interface CoastalStreetArrowDescriptor {
  id: string;
  role: "route-arrow";
  palette: "coastal-route-marking";
  unityZ: number;
  position: CoastalStreetVec3;
  frame: CoastalStreetSurfaceFrame;
  pieces: readonly [
    CoastalStreetLocalBoxDescriptor,
    CoastalStreetLocalBoxDescriptor,
    CoastalStreetLocalBoxDescriptor,
  ];
  visualOnly: true;
}

export interface CoastalStreetLabelMetadata {
  id: string;
  role: "start-label" | "district-label";
  text: string;
  position: CoastalStreetVec3;
  color: CoastalStreetRgb;
  characterSize: number;
  visualOnly: true;
}

export interface CoastalStreetRouteDescriptor {
  arrows: readonly CoastalStreetArrowDescriptor[];
  startStripe: CoastalStreetWorldBoxDescriptor;
  labels: readonly CoastalStreetLabelMetadata[];
}

export interface CoastalStreetHouseDescriptor {
  id: string;
  index: number;
  district: number;
  unityZ: number;
  baseY: number;
  body: CoastalStreetWorldBoxDescriptor;
  roof: CoastalStreetWorldBoxDescriptor;
  windows: readonly [
    CoastalStreetWorldBoxDescriptor,
    CoastalStreetWorldBoxDescriptor,
    CoastalStreetWorldBoxDescriptor,
  ];
  awning: CoastalStreetWorldBoxDescriptor;
  door: CoastalStreetWorldBoxDescriptor;
}

export interface CoastalStreetKitDescriptor {
  coordinateSpace: "unity-source";
  palettes: readonly CoastalStreetPaletteDescriptor[];
  shoulders: readonly CoastalStreetShoulderDescriptor[];
  route: CoastalStreetRouteDescriptor;
  houses: readonly CoastalStreetHouseDescriptor[];
}

const SPECULAR: CoastalStreetRgb = [0.2, 0.2, 0.2];
const BUILDING_COLORS = [
  [0.96, 0.44, 0.19],
  [0.1, 0.64, 0.69],
  [0.35, 0.48, 0.67],
  [0.72, 0.28, 0.7],
  [0.95, 0.66, 0.12],
  [0.8, 0.78, 0.66],
  [0.32, 0.72, 0.63],
] as const satisfies readonly CoastalStreetRgb[];

const litPalette = (
  id: CoastalStreetPaletteId,
  role: CoastalStreetPaletteDescriptor["role"],
  color: CoastalStreetRgb,
): CoastalStreetPaletteDescriptor => ({
  id,
  role,
  color,
  lit: true,
  metallic: 0,
  smoothness: 0.5,
  specular: SPECULAR,
});

/** Current saved material values in CoastalStreetRun.unity. */
export const COASTAL_STREET_PALETTES: readonly CoastalStreetPaletteDescriptor[] = [
  litPalette("coastal-road", "road", [0.61, 0.61, 0.58]),
  litPalette("coastal-sidewalk-shoulder", "shoulder", [0.72, 0.69, 0.6]),
  {
    id: "coastal-route-marking",
    role: "route-marking",
    color: [1, 0.7, 0.08],
    lit: false,
  },
  ...BUILDING_COLORS.map((color, index) =>
    litPalette(
      `coastal-building-${index + 1}` as CoastalStreetPaletteId,
      "building",
      color,
    ),
  ),
  litPalette("coastal-roof", "roof", [0.35, 0.11, 0.08]),
  {
    id: "coastal-window",
    role: "window",
    color: [0.035, 0.22, 0.32],
    lit: false,
  },
  litPalette("coastal-trim", "trim", [1, 0.78, 0.33]),
];

export const COASTAL_STREET_SOURCE_COUNTS = {
  roadSegments: 23,
  shoulders: 46,
  arrows: 99,
  arrowPieces: 297,
  houses: 64,
  houseBodies: 64,
  houseRoofs: 64,
  houseWindows: 192,
  houseAwnings: 64,
  houseDoors: 64,
} as const;

export const COASTAL_STREET_GAPS = [
  [430, 441],
  [900, 912],
  [1810, 1823],
  [2680, 2694],
] as const;

export const COASTAL_STREET_DISTRICT_LABELS = [
  { z: -20, text: "SUNSET MARKET" },
  { z: 455, text: "CANAL WORKS" },
  { z: 925, text: "CLIFFSIDE STEPS" },
  { z: 1385, text: "SURF ARCADE" },
  { z: 1838, text: "FESTIVAL HEIGHTS" },
  { z: 2295, text: "LIGHTHOUSE RUN" },
  { z: 2710, text: "FINISH PROMENADE" },
] as const;

const finite = (value: number, label: string): number => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
};

const sampleHeight = (
  heightAt: CoastalStreetHeightSampler,
  unityZ: number,
): number => finite(heightAt(unityZ), `heightAt(${unityZ})`);

const buildingPalette = (district: number): CoastalStreetPaletteId =>
  `coastal-building-${district + 1}` as CoastalStreetPaletteId;

const roadDistrictAt = (unityZ: number): number => {
  if (unityZ < 441) return 0;
  if (unityZ < 912) return 1;
  if (unityZ < 1370) return 2;
  if (unityZ < 1823) return 3;
  if (unityZ < 2280) return 4;
  if (unityZ < 2694) return 5;
  return 6;
};

const insideGap = (unityZ: number, padding: number): boolean =>
  COASTAL_STREET_GAPS.some(
    ([start, end]) => unityZ > start - padding && unityZ < end + padding,
  );

/** Exact Unity road frame sampled over the source builder's 0.5 m baseline. */
export function coastalStreetRoadFrame(
  heightAt: CoastalStreetHeightSampler,
  unityZ: number,
): CoastalStreetSurfaceFrame {
  const rise =
    sampleHeight(heightAt, unityZ + 0.25) -
    sampleHeight(heightAt, unityZ - 0.25);
  const run = 0.5;
  const length = Math.hypot(rise, run);
  return {
    right: [1, 0, 0],
    up: [0, run / length, -rise / length],
    forward: [0, rise / length, run / length],
  };
}

export function describeCoastalStreetShoulders(
  roadSegments: readonly CoastalStreetRoadSegment[],
): readonly CoastalStreetShoulderDescriptor[] {
  if (roadSegments.length !== COASTAL_STREET_SOURCE_COUNTS.roadSegments) {
    throw new Error(
      `Coastal Street needs ${COASTAL_STREET_SOURCE_COUNTS.roadSegments} road segments; received ${roadSegments.length}`,
    );
  }
  const shoulders: CoastalStreetShoulderDescriptor[] = [];
  roadSegments.forEach((segment, segmentIndex) => {
    for (const value of [segment.start, segment.end, segment.startY, segment.endY])
      finite(value, `${segment.name || `segment ${segmentIndex + 1}`} measurement`);
    if (segment.end <= segment.start)
      throw new Error(`${segment.name || `segment ${segmentIndex + 1}`} has no length`);
    for (const side of ["town", "water"] as const) {
      shoulders.push({
        id: `shoulder-${side}-${String(segmentIndex + 1).padStart(2, "0")}`,
        role: "road-shoulder",
        palette: "coastal-sidewalk-shoulder",
        side,
        segmentIndex,
        segmentName: segment.name,
        centerX: side === "town" ? -6.55 : 6.55,
        startZ: segment.start,
        endZ: segment.end,
        startY: segment.startY,
        endY: segment.endY,
        width: 1.3,
        thickness: 0.85,
        longitudinalOverlap: 0.08,
        surfaceKind: "ground",
        boardClassification: "road",
        edgeGrinding: false,
        solidSides: false,
      });
    }
  });
  return shoulders;
}

const arrowPieces = (index: number): CoastalStreetArrowDescriptor["pieces"] => {
  const prefix = `route-arrow-${String(index).padStart(3, "0")}`;
  return [
    {
      id: `${prefix}-shaft`,
      role: "route-arrow-shaft",
      palette: "coastal-route-marking",
      center: [0, 0, -0.2],
      size: [0.31, 0.028, 1.25],
      rotationDeg: [0, 0, 0],
    },
    {
      id: `${prefix}-head-left`,
      role: "route-arrow-head",
      palette: "coastal-route-marking",
      center: [-0.25, 0, 0.44],
      size: [0.27, 0.028, 0.82],
      rotationDeg: [0, -43, 0],
    },
    {
      id: `${prefix}-head-right`,
      role: "route-arrow-head",
      palette: "coastal-route-marking",
      center: [0.25, 0, 0.44],
      size: [0.27, 0.028, 0.82],
      rotationDeg: [0, 43, 0],
    },
  ];
};

export function describeCoastalStreetRoute(
  heightAt: CoastalStreetHeightSampler,
): CoastalStreetRouteDescriptor {
  const arrows: CoastalStreetArrowDescriptor[] = [];
  for (let unityZ = -5; unityZ <= 2990; unityZ += 30) {
    if (insideGap(unityZ, 2)) continue;
    const index = arrows.length + 1;
    const frame = coastalStreetRoadFrame(heightAt, unityZ);
    const surfaceY = sampleHeight(heightAt, unityZ);
    arrows.push({
      id: `route-arrow-${String(index).padStart(3, "0")}`,
      role: "route-arrow",
      palette: "coastal-route-marking",
      unityZ,
      position: [
        0,
        surfaceY + frame.up[1] * 0.025,
        unityZ + frame.up[2] * 0.025,
      ],
      frame,
      pieces: arrowPieces(index),
      visualOnly: true,
    });
  }
  if (arrows.length !== COASTAL_STREET_SOURCE_COUNTS.arrows) {
    throw new Error(
      `Coastal Street produced ${arrows.length} arrows; expected ${COASTAL_STREET_SOURCE_COUNTS.arrows}`,
    );
  }

  const startStripe: CoastalStreetWorldBoxDescriptor = {
    id: "route-start-stripe",
    role: "route-start-stripe",
    palette: "coastal-route-marking",
    center: [0, sampleHeight(heightAt, -10) + 0.025, -10],
    size: [10.5, 0.028, 0.34],
    rotationDeg: [0, 0, 0],
    visualOnly: true,
  };
  const labels: CoastalStreetLabelMetadata[] = [
    {
      id: "route-start-label",
      role: "start-label",
      text: "START",
      position: [0, sampleHeight(heightAt, -7) + 0.032, -7],
      color: [1, 0.7, 0.08],
      characterSize: 0.105,
      visualOnly: true,
    },
    ...COASTAL_STREET_DISTRICT_LABELS.map((label, index) => ({
      id: `district-label-${String(index + 1).padStart(2, "0")}`,
      role: "district-label" as const,
      text: label.text,
      position: [
        0,
        sampleHeight(heightAt, label.z) + 0.034,
        label.z,
      ] as CoastalStreetVec3,
      color: [1, 0.72, 0.1] as CoastalStreetRgb,
      characterSize: 0.062,
      visualOnly: true as const,
    })),
  ];
  return { arrows, startStripe, labels };
}

const worldBox = (
  id: string,
  role: CoastalStreetWorldBoxDescriptor["role"],
  palette: CoastalStreetPaletteId,
  center: CoastalStreetVec3,
  size: CoastalStreetVec3,
  rotationDeg: CoastalStreetVec3 = [0, 0, 0],
): CoastalStreetWorldBoxDescriptor => ({
  id,
  role,
  palette,
  center,
  size,
  rotationDeg,
  visualOnly: true,
});

export function describeCoastalStreetHouses(
  heightAt: CoastalStreetHeightSampler,
): readonly CoastalStreetHouseDescriptor[] {
  const houses: CoastalStreetHouseDescriptor[] = [];
  const count = COASTAL_STREET_SOURCE_COUNTS.houses;
  for (let index = 0; index < count; index++) {
    const unityZ = -5 + (3010 - -5) * (index / (count - 1));
    const district = roadDistrictAt(unityZ);
    const baseY = sampleHeight(heightAt, unityZ) - 0.55;
    const districtHeight = district === 2 || district === 5 ? 5 : 0;
    const height = 8 + districtHeight + ((index * 3 + district) % 5) * 1.55;
    const centerX = -14 - ((index + district) % 3) * 1.45;
    const length = 39 + (index % 4) * 2.5;
    const facadeX = centerX + 5.81;
    const houseNumber = index + 1;
    const prefix = `house-${String(houseNumber).padStart(2, "0")}`;
    const bodyPalette = buildingPalette(district);
    const awningPalette = buildingPalette((district + 2) % BUILDING_COLORS.length);
    const window = (
      offset: -1 | 0 | 1,
      windowIndex: number,
    ): CoastalStreetWorldBoxDescriptor =>
      worldBox(
        `${prefix}-window-${windowIndex + 1}`,
        "building-window",
        "coastal-window",
        [facadeX, baseY + height * 0.61, unityZ + offset * 7.2],
        [0.12, 2.15, 3.4],
      );
    const windows: CoastalStreetHouseDescriptor["windows"] = [
      window(-1, 0),
      window(0, 1),
      window(1, 2),
    ];

    houses.push({
      id: prefix,
      index,
      district,
      unityZ,
      baseY,
      body: worldBox(
        `${prefix}-body`,
        "building-body",
        bodyPalette,
        [centerX, baseY + height * 0.5, unityZ],
        [11.5, height, length],
      ),
      roof: worldBox(
        `${prefix}-roof`,
        "building-roof",
        "coastal-roof",
        [centerX, baseY + height + 0.42, unityZ],
        [12.3, 0.84, length + 1.2],
        [0, 0, index % 2 === 0 ? 3.5 : -3.5],
      ),
      windows,
      awning: worldBox(
        `${prefix}-awning`,
        "building-awning",
        awningPalette,
        [facadeX + 0.55, baseY + 3, unityZ - 2],
        [1.25, 0.23, 9],
        [0, 0, -6],
      ),
      door: worldBox(
        `${prefix}-door`,
        "building-door",
        "coastal-trim",
        [facadeX, baseY + 1.55, unityZ + 11.5],
        [0.13, 3.1, 1.7],
      ),
    });
  }
  return houses;
}

export function buildCoastalStreetKit(
  roadSegments: readonly CoastalStreetRoadSegment[],
  heightAt: CoastalStreetHeightSampler,
): CoastalStreetKitDescriptor {
  return {
    coordinateSpace: "unity-source",
    palettes: COASTAL_STREET_PALETTES,
    shoulders: describeCoastalStreetShoulders(roadSegments),
    route: describeCoastalStreetRoute(heightAt),
    houses: describeCoastalStreetHouses(heightAt),
  };
}
