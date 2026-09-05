import type { CustomComponent, CustomLevelData } from "../level";

// A forgiving +X bonus: broad terraces and two short hops. Every box has
// permanent floor below it, so collecting the rewards cannot destroy the route.
const components: CustomComponent[] = [];
for (const [left, right, top] of [[-16, 2, 0], [4, 20, 0.35], [22, 54, 0]]) {
  components.push({ t: "platform", p: [(left + right) / 2, (top - 5) / 2, 0],
    s: [right - left, top + 5, 8.5], tex: "stone", color: "#827591",
    edgeGrinding: false, nm: "Wide bonus terrace", grp: 1 });
}
const boxes: [number, number, NonNullable<CustomComponent["kind"]>][] = [
  [-9, 0, "wood"], [-6, 0, "wood"], [-3, 0, "wood"], [0, 0, "wood"],
  [7, 0.35, "wood"], [10, 0.35, "wood"], [13, 0.35, "wood"],
  [16, 0.35, "wood"], [16, 1.31, "wood"], [18, 0.35, "wood"],
  [25, 0, "wood"], [28, 0, "wood"], [31, 0, "wood"], [34, 0, "wood"],
  [37, 0, "wood"], [40, 0, "wood"], [43, 0, "life"], [46, 0, "mask"],
];
boxes.forEach(([x, y, kind], i) => components.push({ t: "crate", p: [x, y, 0], kind,
  nm: `Bonus reward ${i + 1}`, grp: 2 }));
for (const x of [-11, -8, -5, -2, 6, 9, 12, 15, 24, 27, 30, 33, 36, 39, 42])
  components.push({ t: "wumpa", p: [x, (x >= 4 && x <= 20 ? 0.35 : 0) + 1.15, 0], grp: 2 });
for (const z of [-0.83, 0.83]) components.push({ t: "wall", p: [19, -14, z],
  s: [80, 42, 0.6], invisible: true, nm: "Side-scrolling boundary", grp: 3 });
components.push(
  { t: "zone", p: [19, 0, 0], s: [80, 1, 18], dir: "E", grp: 3 },
  { t: "camnode", p: [-18, 0, 0], radius: 5, grp: 3 },
  { t: "camnode", p: [56, 0, 0], radius: 5, grp: 3 },
  { t: "gate", p: [50, 0, 0], yaw: 90, nm: "Bonus return", grp: 4 },
);

export const EASY_BONUS_LEVEL: CustomLevelData = {
  v: 1, name: "Bonus: Easy Street", spawn: [-12, 0.12, 0], killY: -10,
  hudMode: "bonus", sky: "night", components,
  groups: [{ id: 1, nm: "Permanent broad terraces" }, { id: 2, nm: "Safe rewards" },
    { id: 3, nm: "Left-to-right camera and containment", editorOnly: true }, { id: 4, nm: "Return gate" }],
};
export const DEFAULT_BONUS_CRATE_COUNT = boxes.length;
