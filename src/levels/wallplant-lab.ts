import type { CustomComponent, CustomLevelData } from "../level";

/**
 * Compact practice course for the timed wall plant: the wall kick on foot and
 * the wallplant on the board. Readable greybox on one flat recovery floor, so
 * every miss costs a walk back and nothing else. Stations escalate one
 * variable at a time (design bible, laws 14 and 15):
 *
 *  A  one bare wall across the lane: run at it, jump, X as you meet it.
 *  B  two facing faces 4 m apart: the same press, strung into a climb. The
 *     east face is a block, so the last kick ends on its ledge.
 *  C  a board lane into an end wall: the plant turns the wipeout around, and
 *     the rails on the way back turn it into a line.
 *
 * Measured in this engine (tools/test-wall-plant.mjs): a kick gains about
 * 2.3 m per wall across a 4 m shaft, and a wall whose top is still within
 * reach of the jump, the double jump or the ledge grab is climbed, not kicked.
 */
const FLOOR = "#7f8d92", WALL = "#a7b0b8", BLOCK = "#8a96a2", TRIM = "#d5a850", LANE = "#75828c";

/** Fruit along a kick's flight: `from` is where the feet leave the wall. */
function kickArc(from: [number, number, number], away: [number, number], grp: number): CustomComponent[] {
  // A kick leaves at 9.5 m/s out and 12.5 m/s up under the foot rise gravity (33).
  return [0.12, 0.22, 0.32].map(t => ({
    t: "wumpa" as const,
    p: [from[0] + away[0] * 9.5 * t, from[1] + 12.5 * t - 16.5 * t * t + 0.5, from[2] + away[1] * 9.5 * t] as [number, number, number],
    grp,
  }));
}

export const WALLPLANT_LAB_LEVEL: CustomLevelData = {
  v: 1,
  name: "Wall Plant Lab",
  spawn: [0, 0.12, 12],
  killY: -12,
  sky: "day",
  groups: [
    { id: 1, nm: "start" },
    { id: 2, nm: "A first kick" },
    { id: 3, nm: "B kick shaft" },
    { id: 4, nm: "C board wallplant" },
    { id: 5, nm: "finish" },
  ],
  components: [
    // One recovery floor under every station: z 16 (start) to -100 (end wall).
    { t: "platform", p: [0, -0.5, -42], s: [18, 1, 116], tex: "pavement", color: FLOOR, grp: 1, nm: "Recovery floor" },

    // A. FIRST KICK. A bare face square across the lane, with room to walk
    // round either end. Its top is not a ledge, so every press kicks.
    { t: "wall", p: [0, 0, -8], s: [7, 10, 1], color: WALL, grp: 2, nm: "Practice wall" },
    ...kickArc([0, 2, -6.98], [0, 1], 2),

    // B. KICK SHAFT. West face bare; east face is a block whose top is the
    // way out: three kicks, then the ledge takes the fourth contact.
    { t: "wall", p: [-8.5, 0, -22], s: [1, 13, 6], color: WALL, grp: 3, nm: "Shaft west face" },
    { t: "platform", p: [-1.5, 5, -22], s: [5, 10, 6], tex: "solid", color: BLOCK, grp: 3, nm: "Shaft east block" },
    { t: "platform", p: [-6, 0.02, -22], s: [4, 0.04, 6], tex: "solid", color: TRIM, edgeGrinding: false, grp: 3, nm: "Shaft floor marker" },
    ...kickArc([-7.48, 2, -22], [1, 0], 3),
    ...kickArc([-4.52, 4.3, -22], [-1, 0], 3),
    // The reward for topping out sits on the block (law 7: lives sit on the risk).
    { t: "crate", p: [-1.5, 10, -22], kind: "life", grp: 3 },
    { t: "crate", p: [-0.54, 10, -22], kind: "wood", grp: 3 },
    { t: "crate", p: [-2.46, 10, -22], kind: "wood", grp: 3 },

    // The floor is at its widest here: checkpoint before the mode change to the board.
    { t: "checkpoint", p: [5, 0, -31], grp: 4 },

    // C. BOARD WALLPLANT. Sixty clear metres to charge in, a face to plant on,
    // and a rail either side of the centre line to catch on the way back.
    { t: "platform", p: [0, 0.02, -68], s: [3, 0.04, 56], tex: "solid", color: LANE, edgeGrinding: false, grp: 4, nm: "Charge line" },
    { t: "wall", p: [0, 0, -100.5], s: [18, 10, 1], color: WALL, grp: 4, nm: "Wallplant face" },
    { t: "rail", p: [2, 0.7, -77], len: 30, yaw: 0, grp: 4, nm: "Return rail east" },
    { t: "rail", p: [-2, 0.7, -77], len: 30, yaw: 0, grp: 4, nm: "Return rail west" },

    // Finish: a side pad off the lane mouth, so the lane itself is never a dead end.
    { t: "platform", p: [14, -0.5, -40], s: [10, 1, 12], tex: "checker", color: FLOOR, grp: 5, nm: "Finish pad" },
    { t: "gate", p: [15, 0, -40], grp: 5 },
  ],
};
