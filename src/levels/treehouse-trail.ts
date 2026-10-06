import {encloseTreehouseWorld} from './treehouse-enclosure';
import * as THREE from "three";
import {repairTreehouseWorld} from "./treehouse-scenic-repairs";
import { treehouseTrialPoint, densifyTreehouseRoute, treehouseTrialContinuity, TREEHOUSE_TRIALS_OPENING_OCEAN } from "./treehouse-trials-continuity";
import type { CustomComponent, CustomLevelData } from "../level";
import { TREEHOUSE_OPENING_COMPONENTS, TREEHOUSE_STAIR_LANDINGS, TREEHOUSE_CLEARING_ROUTE, openingHousePoint } from "./treehouse-opening";
import { TREEHOUSE_TRIALS_ART_COMPONENTS } from "./treehouse-trials-art";
import { TREEHOUSE_TRIALS_SCENES_V2, TREEHOUSE_TRIALS_SCENE_GROUPS_V2, TREEHOUSE_TRIALS_PIPE_V2, TREEHOUSE_TRIALS_CAVE_EXTENSION_V2 } from "./treehouse-trials-scenes-v2";

type Point = [number, number, number];
const components: CustomComponent[] = [];
const add = (component: CustomComponent): void => { components.push(component); };
const GROUP = { trail: 1, practice: 2, rewards: 3, trees: 4, bush: 5, backdrop: 6,
  camera: 7, treehouse: 8, halfpipe: 9, opening: 10, coast: 11, settlement: 12,
  stream: 13, cave: 14, bridge: 15 };
const X = 35;
const round = (number: number): number => Math.round(number * 100000) / 100000;

/** World-space scene stations are shared with the visual review and art layer. */
const AUTHORING_STATIONS = {
  opening: [X, 0, -16], downhill: [X, -6.6, -71], groundRail: [X, -14, -124],
  gapRail: [X, -14, -148], coastalSettlement: [X, -14, -176],
  hutCorridor: [X, -14, -207], shallowRiver: [X, -14, -234],
  caveEntrance: [X, -14, -249 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2], caveClimb: [X, -10.8, -269 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],
  cavernHalfpipe: [X, -7.2, -319 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2], brokenBridge: [X + 1.35, -7.2, -362 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],
  caveExit: [X, -7.2, -382 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2], finish: [X, -7.2, -402 - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2],
} as const;
export const TREEHOUSE_TRIALS_STATIONS = Object.fromEntries(Object.entries(AUTHORING_STATIONS).map(([name,p]) => [name,treehouseTrialPoint(p)])) as unknown as { [K in keyof typeof AUTHORING_STATIONS]: readonly [number,number,number] };

// A single vertex-painted surface owns each piece of ground. The warm dirt
// softens into broad moss shoulders instead of rectangular overlaid decals.
// Exact centreline heights make every landing, checkpoint and seam measurable.
function ground(nodes: Point[], name: string, group = GROUP.trail, width = 84,
  surface: "dirt" | "stone" | "sand" = "dirt", omitCenter: boolean | number = false, columnCount = 18): void {
  const origin = nodes[0], samples: Point[] = [];
  for (let leg = 1; leg < nodes.length; leg++) {
    const a = nodes[leg - 1], b = nodes[leg], divisions = Math.ceil(Math.abs(b[2] - a[2]) / 1.6);
    for (let i = leg === 1 ? 0 : 1; i <= divisions; i++) {
      const t = i / divisions;
      samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  const columns = columnCount === 18 ? Math.round(width / 2) : columnCount, vertices: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const [x, y, z] of samples) for (let col = 0; col <= columns; col++) {
    const cross = (col / columns - 0.5) * width;
    const shoulder = THREE.MathUtils.smoothstep(Math.abs(cross), 5.4, 10.8);
    const irregularity = (Math.sin(z * 0.47 + cross * 0.27) * 0.18 + Math.sin(z * 0.19 - cross * 0.68) * 0.13) * shoulder;
    const floor = y + shoulder * 0.28 + irregularity;
    vertices.push(round(x + cross - origin[0]), round(floor - origin[1]), round(z - origin[2]));
    uvs.push(round((x + cross) / 9), round(z / 9));
    const edge = surface === "stone" ? "#83917e" : surface === "sand" ? "#93a482" : "#79936b";
    const center = surface === "stone" ? "#ded7c5" : surface === "sand" ? "#fff3d6" : "#eee8d7";
    const pathCenter=.55*Math.sin(z*.095)+.24*Math.sin(z*.31+.8);
    const pathHalf=3.5+.55*Math.sin(z*.17+1.2)+.22*Math.sin(z*.57);
    const paintEdge=THREE.MathUtils.smoothstep(Math.abs(cross-pathCenter),pathHalf,pathHalf+2.35);
    const paint = new THREE.Color(center).lerp(new THREE.Color(edge), paintEdge);
    paint.multiplyScalar(0.98 + Math.sin(z * 0.28 + cross * 0.34) * 0.025);
    colors.push(round(paint.r), round(paint.g), round(paint.b));
  }
  for (let row = 0; row < samples.length - 1; row++) for (let col = 0; col < columns; col++) {
    const cross = ((col + 0.5) / columns - 0.5) * width;
    if (omitCenter && Math.abs(cross) < (typeof omitCenter === "number" ? omitCenter : 6)) continue;
    const a = row * (columns + 1) + col, b = a + 1, c = a + columns + 1, d = c + 1;
    indices.push(a, b, c, b, d, c);
  }
  add({ t: "mesh", p: [...origin], vertices, colors, uvs, indices,
    tex: surface === "stone" ? "treehouse-stone" : surface === "dirt" ? "treehouse-loam" : surface, color: "#ffffff", edgeGrinding: false, nm: name, grp: group });
}

function surfaceBox(p: Point, size: Point, name: string, color: string, group: number,
  texture = "stone", invisible = false): void {
  add({ t: "platform", p, s: size, tex: texture === "stone" ? "treehouse-stone" : texture === "dirt" ? "treehouse-loam" : texture, color, invisible,
    edgeGrinding: false, nm: name, grp: group });
}
function water(p: Point, width: number, depth: number, name: string, group: number): void {
  add({ t: "mesh", p, vertices: [-width / 2, 0, depth / 2, width / 2, 0, depth / 2,
    -width / 2, 0, -depth / 2, width / 2, 0, -depth / 2], indices: [0, 1, 2, 1, 3, 2],
    materialStyle: "jungle-stream", solid: false, tex: "solid", opacity: 0.48,
    color: "#83bcaa", emissive: "#112721", edgeGrinding: false, nm: name, grp: group });
}
function scenery(kind: string, p: Point, size: Point,
  name: string, group: number, yaw = 0): void {
  add({ t: "decor", dkind: kind as NonNullable<CustomComponent["dkind"]>, p, s: size, yaw, nm: name, grp: group });
}
function checkpoint(z: number, y: number, name: string): void {
  add({ t: "checkpoint", p: [X - 2.1, y, z], nm: name, grp: GROUP.rewards });
}

// Leave the opening's ten-metre ground aperture exactly as authored. It owns
// the surrounding clearing as far as -28m, so descent starts beyond that seam.
ground([[X, 0, -16], [X, 0, -28]], "Clearing into enclosed jungle", GROUP.trail, 10);
ground([[X, 0, -28], [X, -1.7, -35], [X, -3.0, -42]], "Steep first dirt descent");
checkpoint(-35, -1.7, "Downhill trail checkpoint");

const jumps = [
  { from: -42, lip: -46, land: -50, base: -3, launch: -2.2, landing: -5.1, bottom: -6.1 },
  { from: -67, lip: -71, land: -75, base: -6.7, launch: -5.9, landing: -9.0, bottom: -10.0 },
  { from: -94, lip: -98, land: -102, base: -10.6, launch: -9.8, landing: -13.0, bottom: -14.0 },
];
for (const [index, jump] of jumps.entries()) {
  add({ t: "ramp", p: [X, jump.base, (jump.from + jump.lip) / 2],
    len: 4, rise: 0.8, w: 12, tex: "treehouse-loam", color: "#eee8d7", edgeGrinding: false,
    nm: `Full-width downhill launch ${index + 1}`, grp: GROUP.practice });
  ground([[X, jump.base, jump.from], [X, jump.launch, jump.lip]],
    `Planted shoulders of launch ${index + 1}`, GROUP.trail, 84, "dirt", true);
  const middle = (jump.lip + jump.land) / 2;
  surfaceBox([X, jump.bottom - 0.5, middle], [84, 1, 4],
    `Visible shallow dirt pit bottom ${index + 1}`, "#7f7750", GROUP.trail, "dirt");
  // Lower dirt landings continue the descent; no quarterpipes at the edges.
  const end = index < jumps.length - 1 ? jumps[index + 1].from : -112;
  const endY = index < jumps.length - 1 ? jumps[index + 1].base : -14;
  ground([[X, jump.landing, jump.land], [X, jump.landing - 0.4, jump.land - 5], [X, endY, end]],
    `Lower downhill landing ${index + 1}`);
  for (const side of [-1, 1]) scenery("treehousemossrock", [X + side * 8.8, jump.bottom, middle],
    [4.4, 2.8, 4.8], "Broad mossy bank at shallow pit", GROUP.bush, side * 35);
}

// The user's nine-image strip replaces the old pack's separate rail lesson.
// A continuous fern-lined grove connects the descent to the coastal village.
ground([[X, -14, -112], [X, -14, -162]], "Quiet forest connecting the downhill to the coastal settlement");
checkpoint(-136, -14, "Coastal trail checkpoint");

// The screenshot's coastal beat precedes the enclosed hut corridor. Sand is
// limited to this opening on the right, never stretched through the village.
ground([[X, -14, -162], [X, -14, -189]], "Warm coastal settlement path", GROUP.coast, 26);
// The beach joins the course at x=48 with shared boundary heights. No two
// ground surfaces overlap, and the sand gently sinks beneath the waterline.
const beachVertices: number[] = [], beachColors: number[] = [], beachIndices: number[] = [];
for (let row = 0; row <= 17; row++) {
  const z = -162 - 27 * row / 17;
  const bankY = -14 + 0.28 + Math.sin(z * 0.47 + 13 * 0.27) * 0.18 + Math.sin(z * 0.19 - 13 * 0.68) * 0.13;
  for (let col = 0; col <= 10; col++) {
    const cross = 11 * col / 10, fraction = col / 10;
    beachVertices.push(round(cross), round(bankY + (-15.12 - bankY) * fraction + 14), round(z + 162));
    const paint = new THREE.Color("#79936b").lerp(new THREE.Color("#fff3d6"), THREE.MathUtils.smoothstep(cross, 0, 4.5));
    paint.multiplyScalar(Math.min(1, 0.98 + Math.sin(z * 0.28 + 18 * 0.34) * 0.025));
    beachColors.push(round(paint.r), round(paint.g), round(paint.b));
  }
}
for (let row = 0; row < 17; row++) for (let col = 0; col < 10; col++) {
  const a = row * 11 + col, b = a + 1, c = a + 11, d = c + 1;
  beachIndices.push(a, b, c, b, d, c);
}
add({ t: "mesh", p: [48, -14, -162], vertices: beachVertices, colors: beachColors, indices: beachIndices,
  tex: "treehouse-loam", color: "#ffffff", edgeGrinding: false, nm: "Seamless small beach to the right of the route", grp: GROUP.coast });
surfaceBox([68, -15.65, -175.5], [36, 0.5, 27], "Sandy visible bed beneath the coastal inlet", "#cbb582", GROUP.coast, "dirt");
water([68, -14.6, -175.5], 36, 27, "Small clear coastal inlet beside the crab shack", GROUP.coast);
const coastalWater=components[components.length-1];
coastalWater.materialStyle='jungle-stream';coastalWater.color='#53a4c0';coastalWater.opacity=.68;
coastalWater.emissive='#072333';coastalWater.castShadow=false;
scenery("trialsv2porchhut", [25, -14.0, -173], [8.8, 6.2, 7.6], "Handmade hut overlooking the beach bend", GROUP.coast, 20);
scenery("trialsv2crabshack", [48, -15.5, -179], [11.8, 8.1, 10], "Humble crab shack beside the sandy glimpse", GROUP.coast, -58);
for (const [x, z] of [[24, -184], [27, -187], [21, -187]] as const)
  scenery("treehousesugarcane", [x, -13.9, z], [3.8, 3.5, 3], "Small lived-in sugarcane patch", GROUP.coast, x * 17);

// Three huts, broad foliage silhouettes and a clear warm centre are enough
// to establish the community. Crates and enemies are deliberately deferred.
ground([[X, -14, -189], [X, -14, -228]], "Enclosed lived-in jungle corridor", GROUP.settlement);
for (const [x, z, yaw, scale] of [[27.5, -199, 20, 1], [44.4, -212, -32, 0.88], [25.2, -221, 36, 0.82]] as const)
  scenery("trialsv2porchhut", [x, -13.9, z], [8.6 * scale, 6.3 * scale, 7.2 * scale],
    "Sparse shaded porch hut", GROUP.settlement, yaw);
checkpoint(-222, -14, "Riverbank checkpoint");
// Explicit authoring keeps the automatic midpoint entrance away from the
// coastal shot. The quiet nook has supported ground and returns to the lane.
add({ t: "bonusplatform", p: [23, -13.6, -216], to: [X, -13.9, -216],
  nm: "Secluded bonus nook behind the left corridor planting", grp: GROUP.settlement });

// The bed is less than half a metre below the surface. Three oversized,
// irregular flat stones carry the crossing, while a missed step is harmless.
surfaceBox([X, -15.1, -234], [54, 0.9, 12], "Visible shallow clear riverbed", "#b4a273", GROUP.stream, "stone");
water([X, -14.27, -234], 54, 12, "Treehouse Trials shallow river", GROUP.stream);
for (const [dx, z, yaw] of [[-8, -229.8, 25], [7, -231.3, -38], [-6, -235, 75], [8, -236.8, 122], [-15, -233.5, 43], [16, -238.5, -17]] as const)
  scenery("treehousemossrock", [X + dx, -15.25, z], [3.4, 0.58, 2.5],
    "Visible submerged mossy stream stone", GROUP.stream, yaw);
ground([[X, -14, -240], [X, -14, -282]], "Quiet forest from riverbank to distant cave mouth", GROUP.trail);

// Irregular treads and short bevelled rises create a natural uphill rock
// walk, with the same visible mesh doing collision. No neat staircase and no
// controller changes are needed. The Meshy rock clusters frame its shoulders.
const climb: Point[] = [[X, -14, -252]];
const steps = [0.62, 0.81, 0.55, 0.76, 0.61, 0.84, 0.68, 0.78, 0.62, 0.53];
let climbY = -14, climbZ = -252;
for (const [index, rise] of steps.entries()) {
  const run = index % 3 === 0 ? 3.4 : index % 3 === 1 ? 3.0 : 3.2;
  // Rounded rock riser is steep enough to read as a step, still walkable.
  climb.push([X, climbY, climbZ - run + 1.5]);
  climbY += rise; climbZ -= run;
  climb.push([X, round(climbY), round(climbZ)]);
}
climb[climb.length - 1] = [X, -7.2, -284];
ground(climb.map(([x,y,z])=>[x,y-1.25,z]), "Buried continuous rock mound beneath the natural climb", GROUP.cave, 32, "stone", false, 32);
scenery("treehousecavearch", [X, -14.5, -249], [25, 18, 8], "Open rock cave entrance around the climb", GROUP.cave);
scenery("treehousecavearch", [X, -13.5, -270], [25, 19.5, 8], "Natural cave arch above the rough ascent", GROUP.cave, 5);
ground([[X, -7.2, -284], [X, -7.2, -296]], "Top of climb into the sunlit cavern", GROUP.cave, 64, "stone");
checkpoint(-289, -7.2, "Sunlit cavern checkpoint");

// A long hand-built wooden halfpipe has open ends and one uninterrupted
// riding surface. Its broad cavern stays readable around the tall transitions.
// Wide buried rock shoulders seat the arch feet. The measured arch opening
// needs 56m outer width to clear the full 7.15m halfpipe envelope after yaw.
ground([[X, -7.35, -296], [X, -7.35, -342]], "Cavern halfpipe stone foundation", GROUP.cave, 64, "stone");
add({ t: "vertramp", p: [X, -7.2, -319], len: TREEHOUSE_TRIALS_PIPE_V2.length, w: TREEHOUSE_TRIALS_PIPE_V2.flat, rise: TREEHOUSE_TRIALS_PIPE_V2.radius, arc: 90,
  arcSteps: 32, deck: TREEHOUSE_TRIALS_PIPE_V2.deck, vkind: "half", rails: false, yaw: 0, invisible: true,
  tex: "treehouse-timber", color: "#e0d0b3", nm: "Long sunlit cavern timber halfpipe", grp: GROUP.halfpipe });
for (const side of [-1, 1]) add({ t: "rail", p: [X + side * (TREEHOUSE_TRIALS_PIPE_V2.flat + TREEHOUSE_TRIALS_PIPE_V2.radius), -7.2 + TREEHOUSE_TRIALS_PIPE_V2.radius, -319],
  len: TREEHOUSE_TRIALS_PIPE_V2.length, w: 0.1, invisible: true, color: "#b59872", nm: "Rounded timber halfpipe coping", grp: GROUP.halfpipe });

// The two surviving wooden abutments stop at the water. A single lightly
// sagging grindable rope is the sole crossing; nothing fills the broken span.
ground([[X, -7.2, -342], [X, -7.2, -350]], "Halfpipe exit and broken-bridge approach", GROUP.cave, 64, "dirt");
checkpoint(-346, -7.2, "Broken bridge checkpoint");
for (const [z, yaw] of [[-353, 180], [-371, 0]] as const) {
  surfaceBox([X, -7.36, z], [7, 0.32, 6], "Surviving bridge abutment support", "#a97945", GROUP.bridge, "wood", true);
  scenery("treehousebridgeend", [X, -8.95, z], [7, 2.5, 6], "Broken handmade bridge abutment", GROUP.bridge, yaw);
}
surfaceBox([X, -12.4, -363], [48, 1, 16], "Visible cavern river stones below broken bridge", "#7f927a", GROUP.bridge, "stone");
water([X, -10.5, -363], 48, 16, "Clear cavern river below the broken rope bridge", GROUP.bridge);
for (const [dx, z, yaw] of [[-8, -358.5, 17], [6, -361.3, -43], [-16, -363.7, 78], [17, -365.8, 128], [9, -367, -14], [-12, -360.5, 36]] as const)
  scenery("treehousemossrock", [X + dx, -12.05, z], [4.2, 1.25, 3.5],
    "Submerged visual-only cavern river rock", GROUP.bridge, yaw);
add({ t: "pit", p: [X, -11.85, -362], s: [47, 0.1, 11.8], invisible: true,
  nm: "Cavern river reset below the single rope", grp: GROUP.bridge });
add({ t: "rope", p: [X + 1.35, -5.88, -362], len: 13, amp: 0.12, shake: 18, yaw: 0,
  nm: "Single taut grindable rope across the missing bridge", grp: GROUP.bridge });
for (const z of [-355.5, -368.5]) {
  const timber = new THREE.BoxGeometry(0.46, 1.8, 0.5);
  add({ t: "mesh", p: [X + 1.35, -6.3, z], vertices: Array.from(timber.attributes.position.array, round),
    normals: Array.from(timber.attributes.normal.array, round), uvs: Array.from(timber.attributes.uv.array, round),
    indices: Array.from(timber.index!.array), solid: false, edgeGrinding: false,
    tex: "treehouse-timber", color: "#d2bc96", nm: "Timber rope anchor firmly seated on the broken deck", grp: GROUP.bridge });
  timber.dispose();
  for (const y of [-5.78, -5.87, -5.96]) {
    const lashing = new THREE.TorusGeometry(0.305, 0.038, 5, 12).rotateX(Math.PI / 2);
    add({ t: "mesh", p: [X + 1.35, y, z], vertices: Array.from(lashing.attributes.position.array, round),
      normals: Array.from(lashing.attributes.normal.array, round), indices: Array.from(lashing.index!.array),
      solid: false, edgeGrinding: false, tex: "solid", color: "#ba9a67", nm: "Simple rope lashing around bridge anchor", grp: GROUP.bridge });
    lashing.dispose();
  }
}
scenery("treehousecavearch", [X, -13.4, -360], [30, 26.3, 9], "High river cavern daylight arch", GROUP.cave, -7);

// The cave releases into an uncluttered bright path; the finish has generous
// supported space on both sides and a lower safety plane beneath all geometry.
ground([[X, -7.2, -374], [X, -7.2, -385], [X, -7.2, -414]], "Bright simple jungle cave exit", GROUP.trail, 34);
scenery("treehousecavearch", [X, -8.5, -379], [27, 18.5, 7], "Natural cave exit into warm jungle", GROUP.cave, 4);
add({ t: "crystal", p: [X + 2.6, -5.7, -396], nm: "Treehouse Trials crystal", grp: GROUP.rewards });
add({ t: "gate", p: [X, -7.2, -402], yaw: 0, nm: "Sunlit jungle trail finish", grp: GROUP.rewards });
add({ t: "clock", p: [26, 0, 6], nm: "Trial start at the bush trail", grp: GROUP.rewards });

// Shared, wind-animated foliage modules frame the corridor in loose masses.
// Keep the coastal right-hand opening and all bridge/water silhouettes clear.
for (const z of [-229, -239]) for (const side of [-1, 1])
  scenery("treehousemossrock", [X + side * 10, -14.7, z], [6.4, 3.1, 5.2], "Oversized mossy riverbank rock", GROUP.stream, z * 17);
for (const z of [-260, -277, -295, -316, -337, -355, -377]) for (const side of [-1, 1]) {
  const y = z > -284 ? -14 + (-z - 252) * 6.8 / 32 : -7.2;
  scenery("treehousemossrock", [X + side * 11.8, y - 0.55, z], [7.3, 4.5, 7], "Broad cavern-edge moss rock", GROUP.cave, side * 37 + z * 9);
  scenery("trialsv2groundcoverb", [X + side * 10.1, y, z + 2.5], [5.4, 1.972, 4.877], "Daylit vegetation in cave opening", GROUP.bush, side * 87 + z);
}

// Extend the forest after the river, translating complete downstream
// assemblies rather than changing their shape, supports or native mechanics.
for (const component of components) if (component.p[2] <= -248)
  component.p[2] -= TREEHOUSE_TRIALS_CAVE_EXTENSION_V2;

// Reuse the complete source-owned opening, omitting the old rear matte that
// would otherwise cut through the extended route at -185m.
components.push(...TREEHOUSE_OPENING_COMPONENTS.filter(c => c.dkind !== "treehousemattefar").map(c => {
  // Runtime computes the same face normals from the decorative triangles.
  // Keep original source geometry and all collider normals untouched while
  // avoiding a redundant normal array in this extended level's JSON budget.
  if (c.t !== "mesh" || c.solid !== false || !c.normals) return c;
  const { normals: _normals, ...compact } = c;
  if (c.tex === "solid") delete compact.uvs;
  // Triangle-soup timber repeats identical face vertices. Keep each authored
  // normal in the sharing key, so indexing cannot smooth a deliberate crease.
  if (c.vertices && c.indices?.every((index, i) => index === i)) {
    const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
    const shared = new Map<string, number>();
    for (let i = 0; i < c.vertices.length / 3; i++) {
      const position = c.vertices.slice(i * 3, i * 3 + 3);
      const normal = c.normals.slice(i * 3, i * 3 + 3);
      const uv = compact.uvs?.slice(i * 2, i * 2 + 2) ?? [];
      const key = [...position, ...normal, ...uv].join("/");
      let index = shared.get(key);
      if (index === undefined) {
        index = vertices.length / 3; shared.set(key, index);
        vertices.push(...position); uvs.push(...uv);
      }
      indices.push(index);
    }
    compact.vertices = vertices; compact.indices = indices;
    if (compact.uvs) compact.uvs = uvs;
  }
  return compact as CustomComponent;
}));
components.push(...TREEHOUSE_TRIALS_ART_COMPONENTS.filter(c => !c.cameraView));
components.push(...TREEHOUSE_TRIALS_SCENES_V2);
add({ t: "wallpath", p: [0, -27, 0], w: 1, rise: 48, closed: true,
  invisible: true, containment: true, curve: "corner",
  pts: [[-36, 35, 2], [74, 35, 2], [74, -450, 2], [12, -450, 2], [12, -28, 2], [-36, -28, 2]],
  nm: "Outer boundary around opening and the extended Treehouse Trials route", grp: GROUP.backdrop });

// Every change in ground height and every set piece follows one ordered lane.
// The opening uses its existing view frame; the route itself stays forward.
const balconySpawn = openingHousePoint([-16, 8.55, -0.5]);
const authoredTrailRoute: Point[] = [
  [X, 0, -16], [X, 0, -28], [X, -3, -42], [X, -2.2, -46], [X, -5.1, -50],
  [X, -6.7, -67], [X, -5.9, -71], [X, -9.0, -75], [X, -10.6, -94], [X, -9.8, -98], [X, -13, -102],
  [X, -14, -112], [X, -14, -136], [X, -13.23, -148], [X, -14, -160], [X, -14, -176], [X, -14, -207],
  [X, -14, -224], [34.6, -13.88, -230.2], [35.7, -13.82, -234.1], [34.8, -13.9, -238.1],
  [X, -14, -249], [X, -14, -252], [X, -10.8, -269], [X, -7.2, -284], [X, -7.2, -296],
  [X, -7.2, -319], [X, -7.2, -342], [X, -7.2, -350], [X + 1.35, -5.88, -362], [X, -7.2, -374],
  [X, -7.2, -385], [X, -7.2, -410],
];
const sourceTrailRoute: readonly Point[] = authoredTrailRoute.map(([x,y,z]) =>
  [x,y,z <= -248 ? z - TREEHOUSE_TRIALS_CAVE_EXTENSION_V2 : z] as Point);
export const TREEHOUSE_TRAIL_ROUTE: readonly Point[] = densifyTreehouseRoute(sourceTrailRoute).map(treehouseTrialPoint);
for (const p of [balconySpawn, ...[...TREEHOUSE_STAIR_LANDINGS].reverse()])
  add({ t: "camnode", p: [...p], radius: 0, grp: GROUP.camera });
for (const p of TREEHOUSE_CLEARING_ROUTE.slice(1))
  add({ t: "camnode", p: [...p], radius: 2, grp: GROUP.camera });
for (const p of densifyTreehouseRoute(sourceTrailRoute).slice(1))
  add({ t: "camnode", p: [...p], radius: 0, grp: GROUP.camera });


export const TREEHOUSE_TRAIL_LEVEL: CustomLevelData = {
  v: 1, name: "Treehouse Trials", spawn: balconySpawn, killY: -30,
  sky: "day", ocean: TREEHOUSE_TRIALS_OPENING_OCEAN, cameraAirLift: .7, cameraLookAhead: 9, cameraRig: {camDist:10.2,camHeight:4.9,camPitch:16.5,camFov:49}, jungleAtmosphere: true, jungleDepthFade: false, jungleStyle: "painterly", keepPlayFog: true,
  medalTimes: { gold: 88, silver: 125, bronze: 180 },
  atmosphere: { fallbackRidges:false, fallbackTop:"#348dcc", fallbackBottom:"#b6dce6", fallbackFog:"#b6dce6", fogEnabled: true, fogNear: 62, fogFar: 185, fogColor: "#618e7d",
    ambientSky: "#9fc5c4", ambientGround: "#6c6044", ambientIntensity: 0.98,
    sunColor: "#ffe0a6", sunIntensity: 1.72, fillColor: "#bdd2ca", fillIntensity: 0.42,
    shadowStrength: 0.85, drawDistance: 320 },
  components: encloseTreehouseWorld(repairTreehouseWorld(treehouseTrialContinuity(components))),
  groups: [...Object.entries(GROUP).map(([nm, id]) => ({ id, nm })), ...TREEHOUSE_TRIALS_SCENE_GROUPS_V2],
};
