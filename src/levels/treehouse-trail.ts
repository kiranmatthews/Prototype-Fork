import type { CustomComponent, CustomLevelData } from "../level";

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
  tex: "jungle", color: "#5b7040", edgeGrinding: false,
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

// A small timber halfpipe in its own clearing. The open ends are level with
// the apron; the whole practice area has supported ground underneath it.
add({ t: "platform", p: [11, -0.5, -13], s: [21, 1, 24], tex: "jungle", color: "#b99b60",
  edgeGrinding: false, depthBias: 2, nm: "Halfpipe clearing and open-end apron", grp: GROUP.halfpipe });
add({ t: "vertramp", p: [12, 0, -13], len: 12, w: 2.6, rise: 2.4,
  arc: 90, deck: 1.2, vkind: "half", tex: "plank", color: "#b77b3f",
  nm: "Little timber halfpipe · open ends", grp: GROUP.halfpipe });
for (const z of [-5]) add({ t: "decor", dkind: "treehousetree", p: [24, 0, z],
  s: [20, 20, 17], yaw: z * 7, nm: "Halfpipe clearing canopy", grp: GROUP.trees });

// Separate stair flights, landings, balcony and cabin use simple matching
// colliders. Meshy chunks provide their reusable visual shells below.
for (const [bottomY, z] of [[0, -14], [2.25, -23]] as const) {
  add({ t: "ramp", p: [-7, bottomY, z], len: 5.5, rise: 2.25, w: 3,
    invisible: true, edgeGrinding: false, nm: "Treehouse stair flight support", grp: GROUP.treehouse });
  add({ t: "decor", dkind: "treehousestairs", p: [-7, bottomY, z], s: [3, 2.25, 5.5],
    nm: "Meshy stair chunk", grp: GROUP.treehouse });
}
for (const [topY, z] of [[0, -9.5], [2.25, -18.5], [4.5, -27.5]] as const) {
  add({ t: "platform", p: [-7, topY - 0.175, z], s: [3.5, 0.35, 3.5],
    invisible: true, edgeGrinding: false, nm: "Treehouse landing support", grp: GROUP.treehouse });
  add({ t: "decor", dkind: "treehouselanding", p: [-7, topY - 0.35, z],
    nm: "Meshy landing chunk", grp: GROUP.treehouse });
}
add({ t: "platform", p: [-13, 4.325, -28.5], s: [22, 0.35, 3], invisible: true,
  edgeGrinding: false, nm: "Treehouse balcony support", grp: GROUP.treehouse });
add({ t: "platform", p: [-13, 4.325, -32.5], s: [18, 0.35, 5.5], invisible: true,
  edgeGrinding: false, nm: "Treehouse cabin floor support", grp: GROUP.treehouse });
add({ t: "wall", p: [-13, 4.5, -32.5], s: [17.8, 9, 5.3], invisible: true,
  nm: "Treehouse cabin facade collision", grp: GROUP.treehouse });
add({ t: "decor", dkind: "treehousebody", p: [-13, 4.5, -32.5], s: [18, 9.5, 5.5],
  nm: "Meshy treehouse body chunk", grp: GROUP.treehouse });
// The balcony's open edge faces the stairs, keeping the entrance free of its
// rope balustrade. It is still a separate selectable, reusable scenery asset.
add({ t: "decor", dkind: "treehousebalcony", p: [-13, 4.25, -28.5], s: [22, 1.5, 3], yaw: 180,
  nm: "Meshy balcony chunk · open stair entrance", grp: GROUP.treehouse });
add({ t: "decor", dkind: "treehousetree", p: [-17, 0, -42], s: [27, 24, 21],
  yaw: 0, nm: "Separate Meshy big tree · treehouse anchor", grp: GROUP.treehouse });

// A modest footpath joins the first stair landing to the main route.
add({ t: "platform", p: [-4.5, -0.3, -9.5], s: [8, 0.6, 5], tex: "jungle",
  color: "#b99b60", edgeGrinding: false, depthBias: 2,
  pts: [[-4, -2.5, 0.6], [4, -2.5, 0.6], [4, 2.5, 0.6], [-4, 2.5, 0.6]],
  nm: "Treehouse side path", grp: GROUP.treehouse });

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

// Keep the forward bush trail intact beside the new opening composition.
for (const component of components) {
  if (component.grp === GROUP.treehouse) {
    component.p[2] += 24;
    if (component.t === "ramp") { component.p[1] *= 1.8; component.rise! *= 1.8; }
    else if (component.dkind === "treehousestairs") { component.p[1] *= 1.8; component.s![1] *= 1.8; }
    else if (component.t === "platform" && component.invisible) {
      const top = (component.p[1] + component.s![1] / 2) * 1.8;
      // The timber fascia is visual. A thin support avoids catching the
      // character capsule before its feet reach the top of a stair flight.
      component.s![1] = 0.05;
      component.p[1] = top - 0.025;
    }
    else if (component.dkind === "treehouselanding") component.p[1] = (component.p[1] + 0.35) * 1.8 - 0.35;
    else if (component.dkind === "treehousebalcony") component.p[1] = 8.1 - 0.25;
    else if (component.dkind === "treehousebody" || component.t === "wall") component.p[1] *= 1.8;
  }
  else if (component.grp === GROUP.halfpipe || component.nm === "Halfpipe clearing canopy") component.p[2] += 14;
  else component.p[0] += 35;
}

add({ t: "platform", p: [-1, -2.25, 0], s: [70, 2, 80], tex: "jungle", color: "#426343",
  edgeGrinding: false, nm: "Opening safety foundation", grp: GROUP.opening });
add({ t: "platform", p: [-1, -0.5, -2], s: [70, 1, 58], tex: "jungle", color: "#60744a",
  edgeGrinding: false, depthBias: 4, nm: "Treehouse forest clearing", grp: GROUP.opening });
add({ t: "platform", p: [0, -0.35, 0], s: [1, 0.7, 1], tex: "jungle", color: "#b99b60",
  edgeGrinding: false, depthBias: 1,
  pts: [[-30, 10, 2], [21, 10, 3], [30, 1, 5], [30, -22, 1],
    [40, -22, 1], [40, 2, 8], [32, 16, 7], [23, 21, 4], [-30, 21, 2]],
  nm: "Walk right past the halfpipe · rounded turn into the bush", grp: GROUP.opening });
add({ t: "wallpath", p: [0, -1.25, 0], w: 1, rise: 24, closed: true,
  invisible: true, containment: true, curve: "corner",
  pts: [[-32, 27, 2], [60, 27, 3], [60, -157, 3], [10, -157, 3], [10, -26, 3], [-32, -26, 3]],
  nm: "Bush perimeter around opening and trail", grp: GROUP.backdrop });
add({ t: "clock", p: [26, 0, 16], nm: "Trial start at the bush trail", grp: GROUP.rewards });
add({ t: "comboorb", p: [29, 0, 14], nm: "Combo start at the bush trail", grp: GROUP.rewards });
for (const [top, z] of [[4.05, 5.5], [8.1, -3.5]] as const)
  for (const x of [-8.4, -5.6]) add({ t: "decor", dkind: "block", p: [x, top / 2, z],
    s: [0.28, top, 0.3], tex: "wood", color: "#725031", nm: "Landing timber support", grp: GROUP.treehouse });
add({ t: "decor", dkind: "treehousemattefar", p: [25, -112, -185], s: [460, 191.67, 1],
  nm: "Distant painted jungle and sky", grp: GROUP.backdrop });
add({ t: "decor", dkind: "treehousemattemid", p: [-10, -3, -40], s: [80, 33.33, 1],
  nm: "Midground painted canopy layer", grp: GROUP.backdrop });

// Plant the foreground around the actual entrance view, leaving the route
// and both landmark silhouettes readable rather than filling a grid.
for (const [x, z, scale] of [[-28, 3, 1.5], [-22, -3, 1.3], [-4, -10, 1.2],
  [3, -9, 1.1], [20, -10, 1.3], [27, 4, 1.2], [-29, 22, 1], [29, 24, 1],
  [-24, 8, 0.85], [-18, 7, 0.7], [-3, 8, 0.8], [4, 9, 0.7], [22, 10, 0.75]] as const) {
  add({ t: "decor", dkind: "treehousebush", p: [x, 0, z], w: scale, yaw: x * 17,
    nm: "Opening broadleaf clump", grp: GROUP.opening });
  add({ t: "decor", dkind: "junglefern", p: [x + 1.4, 0, z + 1], w: scale * 0.8, yaw: z * 11,
    nm: "Opening fern clump", grp: GROUP.opening });
}
for (const [x, z] of [[-30, -13], [27, -14]] as const)
  add({ t: "decor", dkind: "treehousetree", p: [x, 0, z], s: [24, 22, 19], yaw: x < 0 ? 35 : 190,
    nm: "Opening layered canopy", grp: GROUP.opening });
for (const [x, z, w] of [[-26, 2, 2.7], [-23, 3, 1.8], [23, -6, 1.7]] as const)
  add({ t: "rock", p: [x, 0.6, z], s: [w, 1.6, w * 0.85], color: "#637c76", seed: x * x,
    edgeGrinding: false, nm: "Opening mossy stones", grp: GROUP.opening });
add({ t: "torch", p: [-8.2, 8.1, -5.6], rise: 1.2, w: 0.2,
  nm: "Warm treehouse doorway lantern", grp: GROUP.treehouse });
for (const x of [6.4, 17.6]) {
  for (const z of [-4, 1, 6]) add({ t: "decor", dkind: "block", p: [x, 3.05, z],
    s: [0.22, 1.3, 0.22], tex: "wood", color: "#80582f", nm: "Halfpipe deck fence post", grp: GROUP.halfpipe });
  add({ t: "decor", dkind: "block", p: [x, 3.55, 1], s: [0.2, 0.2, 10.4], tex: "wood",
    color: "#a57946", nm: "Halfpipe deck handrail chunk", grp: GROUP.halfpipe });
}

for (const [x, y, z, radius] of [[-30, 0, 16, 0], [-10, 0, 16, 0], [12, 0, 16, 0],
  [24, 0, 16, 10], [35, 0, 3, 10], [35, 0, -20, 0], [35, 0, -45, 0], [35, 0, -65, 8],
  [36.5, 0, -80, 8], [36.5, 0, -94, 8], [35, 0, -111, 8], [35, 0.35, -150, 0]] as const)
  add({ t: "camnode", p: [x, y, z], radius, grp: GROUP.camera });
add({ t: "camnode", cameraView: true, p: [-5, 5, 16], s: [66, 60, 50], yaw: 0, radius: 12,
  cameraPosition: [0, 7.5, 35], cameraTarget: [0, 3, -7], cameraFov: 45,
  nm: "Reference opening shot · release into forward trail", grp: GROUP.camera });

export const TREEHOUSE_TRAIL_LEVEL: CustomLevelData = {
  v: 1, name: "Treehouse Trail", spawn: [-10, 0.15, 16], killY: -12,
  sky: "day", jungleAtmosphere: true, keepPlayFog: true,
  medalTimes: { gold: 32, silver: 48, bronze: 70 },
  atmosphere: { fogEnabled: true, fogNear: 65, fogFar: 170, fogColor: "#497d75",
    ambientSky: "#bddbc3", ambientGround: "#71603b", ambientIntensity: 1.12,
    sunColor: "#ffdc99", sunIntensity: 1.8, fillColor: "#80b9a7", fillIntensity: 0.55,
    shadowStrength: 0.8, drawDistance: 380 },
  components,
  groups: Object.entries(GROUP).map(([nm, id]) => ({ id, nm })),
};
