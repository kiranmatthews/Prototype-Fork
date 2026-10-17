import type { CustomComponent } from '../level';

type Point = [number, number, number];
type PathPoint = [number, number];

/** Canonical ship coordinates. The scenic-set wrapper supplies its +X offset. */
export const BILGE_BOWL_LAYOUT = {
  centre: [0, 0, -230] as Point,
  floorY: 0,
  rimY: 16,
  radius: 16,
  flatHalf: .5,
  toeWidth: 67,
  toeLength: 87,
  toeCornerRadius: 18,
  copingWidth: 100,
  copingLength: 120,
  deckWidth: 8,
  apronWidth: 116,
  apronLength: 136,
  throatWidth: 13,
  exitWidth: 12,
  exitRampLength: 64,
} as const;

export const BILGE_BOWL_ANCHORS = {
  entryDeck: [0, 16, -166] as Point,
  entryLip: [0, 16, -170] as Point,
  entryToe: [0, 0, -186] as Point,
  floorArrival: [0, 0, -198] as Point,
  centre: [0, 0, -230] as Point,
  westCoping: [-50, 16, -230] as Point,
  eastCoping: [50, 16, -230] as Point,
  exitThroat: [0, 0, -273.5] as Point,
  exitRampFoot: [0, 0, -300] as Point,
  exitRampTop: [0, 16, -364] as Point,
} as const;

/** Useful input-pilot targets, not a camera spine around the bowl. */
export const BILGE_BOWL_ROUTE: Point[] = [
  BILGE_BOWL_ANCHORS.entryDeck,
  BILGE_BOWL_ANCHORS.entryLip,
  BILGE_BOWL_ANCHORS.entryToe,
  BILGE_BOWL_ANCHORS.floorArrival,
  BILGE_BOWL_ANCHORS.centre,
  BILGE_BOWL_ANCHORS.exitThroat,
  BILGE_BOWL_ANCHORS.exitRampFoot,
  BILGE_BOWL_ANCHORS.exitRampTop,
];

// Follow the toe clockwise from the north-east throat edge to north-west.
// The native quarter-sweep lateral therefore points OUT, leaving a single
// smooth wall/corner surface and a continuous coping with two intentional ends.
function bowlToe(): PathPoint[] {
  const r = BILGE_BOWL_LAYOUT.toeCornerRadius;
  const cx = BILGE_BOWL_LAYOUT.toeWidth / 2 - r;
  const cz = BILGE_BOWL_LAYOUT.toeLength / 2 - r;
  const halfGap = BILGE_BOWL_LAYOUT.throatWidth / 2;
  const path: PathPoint[] = [[halfGap, -BILGE_BOWL_LAYOUT.toeLength / 2]];
  for (const [x, z, start] of [[cx, -cz, -.5], [cx, cz, 0], [-cx, cz, .5], [-cx, -cz, 1]]) {
    for (let i = 0; i <= 24; i++) {
      const angle = (start + i / 48) * Math.PI;
      path.push([x + Math.cos(angle) * r, z + Math.sin(angle) * r]);
    }
  }
  path.push([-halfGap, -BILGE_BOWL_LAYOUT.toeLength / 2]);
  return path;
}

const clay = '#587982';
const flat = (nm: string, p: Point, width: number, length: number, depthBias = 0): CustomComponent => ({
  t: 'mesh', nm, p,
  vertices: [-width / 2, 0, length / 2, width / 2, 0, length / 2,
    width / 2, 0, -length / 2, -width / 2, 0, -length / 2],
  indices: [0, 1, 2, 0, 2, 3],
  solid: true, doubleSided: false, vert: false,
  gravityTrack: true, skateCamera: true,
  ...(depthBias > 0 ? { edgeGrinding: false } : {}),
  depthBias, tex: 'solid', color: clay, grp: 5,
});

export const PIRATE_BILGE_BOWL_COMPONENTS: CustomComponent[] = [
  // The foundation deliberately continues beneath the whole transition/apron.
  // Only its centre is exposed; the two surfaces meet at the same native Y0.
  flat('Bilge bowl · continuous buried foundation', [...BILGE_BOWL_LAYOUT.centre],
    BILGE_BOWL_LAYOUT.apronWidth, BILGE_BOWL_LAYOUT.apronLength, 2),
  {
    t: 'vertramp', nm: 'Bilge bowl · giant continuous transition',
    p: [...BILGE_BOWL_LAYOUT.centre], pts: bowlToe(),
    closed: false, curve: 'corner', vkind: 'quarter',
    w: BILGE_BOWL_LAYOUT.flatHalf, rise: BILGE_BOWL_LAYOUT.radius,
    arc: 90, arcSteps: 48, lipRise: 0, deck: BILGE_BOWL_LAYOUT.deckWidth,
    bank: 0, rails: true, hangLock: true,
    gravityTrack: true, skateCamera: true, vert: true,
    tex: 'solid', color: clay, grp: 5,
  },
  flat('Bilge bowl · open north exit channel', [0, 0, -286.75], 12, 26.5),
  {
    t: 'ramp', nm: 'Bilge bowl · gentle return to the upper gallery',
    p: [0, 0, -332], len: 64, rise: 16, w: 12, yaw: 0,
    tex: 'solid', color: clay, grp: 5,
  },
];
