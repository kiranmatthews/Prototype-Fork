import type { CustomComponent, CustomLevelData } from "../level";
import { TREEHOUSE_OPENING_COMPONENTS } from "./treehouse-opening";

// A first outing through the bush. Both hollows have real, gently sloped
// ground: missing a jump, grind or swing never drops the player into a hazard.
const components: CustomComponent[] = [];
const add = (c: CustomComponent): void => { components.push(c); };
const GROUP = { trail: 1, practice: 2, rewards: 3, trees: 4, bush: 5, backdrop: 6, camera: 7, treehouse: 8, halfpipe: 9, opening: 10 };

export const TREEHOUSE_TRAIL_ROUTE: readonly (readonly [number, number, number])[] = [
  [0, 0, -16], [0, 0, -20],
  [0, 0, -26], [0, -0.9, -30], [0, -0.9, -34], [0, 0, -38],
  [0, 0, -46], [0, 0, -64], [1.5, 0, -72],
  [1.5, 0, -78], [1.5, -1.05, -82], [1.5, -1.05, -87], [1.5, 0, -91],
  [0, 0, -104], [0, 0, -120], [0, 0.35, -132], [0, 0.35, -150],
];

add({ t: "platform", p: [0, -2.25, -68], s: [66, 2, 188],
  tex: "jungle", color: "#5b7040", edgeGrinding: false, invisible: true,
  nm: "Soft forest floor beneath the entire trail", grp: GROUP.trail });
add({ t: "terrain", p: [0, 0, -16], w: 10, amp: 0, berms: false,
  curve: "corner", tex: "jungle", color: "#b99b60", edgeGrinding: false,
  pts: TREEHOUSE_TRAIL_ROUTE.map(([x, y, z]) => [x, z + 16, 0, y]),
  nm: "Easy bush trail · two walk-out hollows", grp: GROUP.trail });

add({ t: "rail", p: [-2, 0.5, -55], len: 12, w: 0.09, color: "#95652d",
  nm: "First grind · low straight timber rail", grp: GROUP.practice });
for (const z of [-50, -55, -60]) add({ t: "decor", dkind: "block", p: [-2, 0.15, z],
  s: [0.23, 0.55, 0.23], tex: "wood", color: "#815429", grp: GROUP.practice,
  nm: "Low rail timber support" });
add({ t: "ropeswing", p: [1.5, 7, -84.5], len: 6, amp: 0.48, speed: 0, yaw: 0,
  phase: 0, nm: "First swing · soft landing below", grp: GROUP.practice });
add({ t: "decor", dkind: "carvedlog", p: [1.5, 6.8, -84.5], s: [14, 0.7, 0.8],
  nm: "Overhead rope branch", grp: GROUP.trees });
for (const x of [-5.5, 8.5]) add({ t: "decor", dkind: "junglecanopy", p: [x, -1.25, -85],
  s: [14, 14, 13], yaw: x < 0 ? 45 : 230, nm: "Swing anchor tree", grp: GROUP.trees });

for (const [z, x] of [[-18, -2], [-67, 2], [-105, -2]] as const)
  add({ t: "crate", p: [x, 0, z], kind: "wood", nm: "Single practice crate", grp: GROUP.rewards });
for (const z of [-42, -96]) add({ t: "checkpoint", p: [0, 0, z],
  nm: z === -42 ? "Hollow checkpoint" : "Swing checkpoint", grp: GROUP.rewards });
for (const [x, y, z] of [[0, 0, -23], [0, -0.9, -32],
  [0, 0, -40], [-2, 0.5, -51], [-2, 0.5, -56], [0, 0, -64],
  [1.5, 0, -75], [1.5, -1.05, -84], [1.5, 0, -93], [0, 0, -102],
  [0, 0, -112], [0, 0.15, -125]] as const)
  add({ t: "wumpa", p: [x, y + 1.1, z], grp: GROUP.rewards });
add({ t: "crystal", p: [0, 1.45, -132], nm: "Treehouse Trail crystal", grp: GROUP.rewards });
add({ t: "gate", p: [0, 0.35, -140], yaw: 0, nm: "Treehouse clearing finish", grp: GROUP.rewards });

// Real Meshy foliage: one shared texture/mesh per family, instanced by the
// existing jungle kit with wind and canopy LODs. Keep the ten-metre trail clear.
for (let i = 3; i < 15; i++) {
  const z = 7 - i * 10.6;
  for (const side of [-1, 1]) {
    const x = side * (10.5 + (i % 3) * 1.5);
    if (i % 2 === 0) add({ t: "decor", dkind: "junglecanopy", p: [x, -1.25, z],
      s: [15 + i % 3, 13.5 + i % 4, 14], yaw: (i * 71 + side * 29) % 360,
      nm: "Meshy broad canopy", grp: GROUP.trees });
    add({ t: "decor", dkind: i % 3 === 0 ? "junglepalmtree" : "jungleleaf",
      p: [side * (7.2 + (i % 2) * 0.8), -1.15, z - 3],
      w: i % 3 === 0 ? 0.9 : 0.85, yaw: i * 57 + side * 31,
      nm: "Meshy trail-edge broadleaf", grp: GROUP.bush });
    for (let j = 0; j < 2; j++) add({ t: "decor", dkind: "junglefern",
      p: [side * (6.8 + j * 3.5), -1.2, z - 2 - j * 4], w: 0.72 + (i % 3) * 0.12,
      yaw: i * 43 + j * 95, nm: "Meshy fern undergrowth", grp: GROUP.bush });
    if (i % 2 === 1 && i >= 7) add({ t: "decor", dkind: "junglebackdrop", p: [side * 27, -3, z],
      s: [28, 27 + i % 4, 26], yaw: i * 33, color: "#76957e",
      nm: "Distant jungle canopy", grp: GROUP.backdrop });
    if (i % 3 === 0) add({ t: "rock", p: [side * 6.9, -0.6, z + 1], s: [2.1, 1.5, 1.7],
      color: "#6d8076", seed: 120 + i, edgeGrinding: false, nm: "Trail-edge mossy stone", grp: GROUP.bush });
  }
}
for (const z of [-17, -55, -107, -138]) add({ t: "decor", dkind: "junglevine",
  p: [0, 10.5, z], s: [18, 3.5, 1.4], nm: "High hanging canopy vine", grp: GROUP.trees });

// The forward-facing bush route starts beyond the opening's right turn.
for (const component of components) component.p[0] += 35;
components.push(...TREEHOUSE_OPENING_COMPONENTS);
add({ t: "wallpath", p: [0, -1.25, 0], w: 1, rise: 24, closed: true,
  invisible: true, containment: true, curve: "corner",
  pts: [[-32, 27, 2], [60, 27, 3], [60, -157, 3], [10, -157, 3], [10, -26, 3], [-32, -26, 3]],
  nm: "Bush perimeter around opening and trail", grp: GROUP.backdrop });
add({ t: "clock", p: [26, 0, 16], nm: "Trial start at the bush trail", grp: GROUP.rewards });
add({ t: "comboorb", p: [29, 0, 14], nm: "Combo start at the bush trail", grp: GROUP.rewards });

for (const [x, y, z, radius] of [[-30, 0, 16, 0], [-10, 0, 16, 0], [12, 0, 16, 0],
  [24, 0, 16, 10], [35, 0, 3, 10], [35, 0, -20, 0], [35, 0, -45, 0], [35, 0, -65, 8],
  [36.5, 0, -80, 8], [36.5, 0, -94, 8], [35, 0, -111, 8], [35, 0.35, -150, 0]] as const)
  add({ t: "camnode", p: [x, y, z], radius, grp: GROUP.camera });
add({ t: "camnode", cameraView: true, p: [-5, 5, 16], s: [66, 60, 90], yaw: 0, radius: 12,
  cameraPosition: [-1, 8.5, 36], cameraTarget: [-1, 5.5, -5], cameraFov: 46, cameraAspect: 16 / 9,
  nm: "Reference opening shot · release into forward trail", grp: GROUP.camera });

export const TREEHOUSE_TRAIL_LEVEL: CustomLevelData = {
  v: 1, name: "Treehouse Trail", spawn: [-5.5, 0.15, 16], killY: -12,
  sky: "day", jungleAtmosphere: true, keepPlayFog: true,
  medalTimes: { gold: 32, silver: 48, bronze: 70 },
  atmosphere: { fogEnabled: true, fogNear: 65, fogFar: 170, fogColor: "#497d75",
    ambientSky: "#a1c5ba", ambientGround: "#51452e", ambientIntensity: 0.98,
    sunColor: "#ffcf8c", sunIntensity: 1.85, fillColor: "#4f9685", fillIntensity: 0.4,
    shadowStrength: 0.8, drawDistance: 380 },
  components,
  groups: Object.entries(GROUP).map(([nm, id]) => ({ id, nm })),
};
