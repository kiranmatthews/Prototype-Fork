import type { CustomLevelData } from "../level";

// The small, source-owned course for timed Codex/sol geometry iterations.
// Keep each brief legible here; move a finished experiment into
// public/levels.json only when it should become part of the synced level pack.
export const CODEX_LAB_LEVEL = {
  v: 1,
  name: "Codex Geometry Lab",
  spawn: [0, 0.6, 20],
  killY: -12,
  sky: "day",
  components: [
    // Start deck and a short jump to the landing deck.
    { t: "platform", p: [0, 0, 12], s: [26, 1, 32], tex: "checker" },
    { t: "platform", p: [0, 0, -18], s: [26, 1, 20], tex: "checker" },

    // A grind line and a transition make the template useful for both
    // corridor-platforming and board-geometry briefs.
    { t: "rail", p: [6, 1, -2], len: 16, yaw: 0 },
    {
      t: "vertramp",
      p: [-24, -0.5, -8],
      len: 36,
      w: 3,
      rise: 6,
      vkind: "half",
      tex: "stone",
    },

    // Minimal interaction/readability markers.
    { t: "crate", p: [-4, 0.5, 4], kind: "wood" },
    { t: "crate", p: [-4, 0.5, 0], kind: "bouncy" },
    { t: "wumpa", p: [0, 1.2, 4] },
    { t: "wumpa", p: [0, 1.2, 0] },
    { t: "wumpa", p: [0, 1.2, -4] },
    { t: "checkpoint", p: [0, 0.5, -12] },
    { t: "crystal", p: [0, 0.5, -24] },
    { t: "clock", p: [2, 0.5, 15] },
    { t: "comboorb", p: [-2, 0.5, 15] },
    { t: "gate", p: [0, 0.5, -26] },
  ],
  groups: [],
} satisfies CustomLevelData;
