import type { CustomComponent } from "../level";
import type { JungleAssetKind } from "../jungleAssets";

/** The original Jungle Ruins has a 13.5 m sanctuary and an 11.5 m terrace. */
export const JUNGLE_SEQUEL_TEMPLE_HEIGHTS = [40.5, 81] as const;

type Profile = readonly (readonly [number, number])[];

function profileHeight(profile: Profile, x: number): number {
  if (!profile.length) return 0;
  if (x <= profile[0][0]) return profile[0][1];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    if (x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / Math.max(.01, b[0] - a[0]);
  }
  return profile[profile.length - 1][1];
}

/**
 * Side-on jungle architecture. Every component is visual-only and behind the
 * eight-metre route. Tier modules have a fixed budget; increasing temple height
 * never expands a wall/pavilion assembly into thousands of hidden stones.
 */
export function jungleSequelArt(variant: 1 | 2, profile: Profile): CustomComponent[] {
  const out: CustomComponent[] = [];
  const end = profile[profile.length - 1]?.[0] ?? (variant === 1 ? 480 : 630);
  const highest = profile.reduce<readonly [number, number]>((a, b) => b[1] > a[1] ? b : a, [end * .66, 0]);
  const summit = highest[0];
  const tiers = variant === 1 ? 3 : 6;
  const tierHeight = 11.5;
  const stone = variant === 1 ? "#bbc5a6" : "#a9bba6";
  const edge = variant === 1 ? "#dde0b9" : "#d0ddbf";
  const jade = variant === 1 ? "#568f77" : "#4c9b89";
  const rnd = (seed: number): number => {
    const n = Math.sin(seed * 12.9898 + variant * 11.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const add = (dkind: JungleAssetKind, p: [number, number, number], s: [number, number, number],
    nm: string, color = stone, yaw = 0, amp = 0): void => {
    out.push({ t: "decor", dkind, p, s, nm, color, yaw, amp, solid: false });
  };

  // Setbacks, bonded stone courses, cornices and inset pilasters make a single
  // readable stepped sanctuary. A deep rear face gives the tiers genuine volume.
  for (let tier = 0; tier < tiers; tier++) {
    const width = (variant === 1 ? 70 : 102) - tier * (variant === 1 ? 18 : 14);
    const y = tier * tierHeight;
    const z = -21 - tier * .55;
    const name = `Temple tier ${tier + 1}`;
    const blocks = Math.ceil(width / 11);
    const span = width / blocks;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < blocks; i++) {
        add((row + i + tier) % 7 === 0 ? "wornstoneblock" : "stoneblock",
          [summit - width / 2 + (i + .5) * span, y + row * 3.55, z],
          [span - .08, 3.48, 17], `${name} bonded masonry`,
          (i + row) % 3 === 0 ? "#a6b59b" : stone, (i + row) % 2 ? 180 : 0);
      }
    }
    add("stonecornice", [summit, y + 10.64, z + .3], [width + 2.4, .86, 18.7], `${name} terrace cornice`, edge);
    // Three repeated pier bays read at game distance without dense ornament.
    for (const fraction of [-.39, 0, .39]) {
      const x = summit + fraction * width;
      add("stonebase", [x, y + .2, z + 8.2], [3.4, .8, 2.7], `${name} pier base`, edge);
      add("stoneshaft", [x, y + 1, z + 8.2], [2.3, 8.3, 2.1], `${name} recessed pier`, stone);
      add("stonecapital", [x, y + 9.3, z + 8.2], [3.8, 1.25, 2.9], `${name} pier capital`, edge);
    }
    for (const side of [-1, 1]) {
      add("stonefrieze", [summit + side * width * .19, y + 6.4, z + 8.65],
        [3.6, 2.7, .55], `${name} spiral relief`, "#d8daba");
      add("junglevine", [summit + side * width * .28, y + 7.3, z + 9],
        [7, 3.5, .65], `${name} hanging vine`, "#799762");
    }
    // A green watercourse band connects the stone sanctuary to its skate pipes.
    add("stonelintel", [summit, y + 2, z + 8.7], [width * .73, .48, .7], `${name} jade watercourse`, jade);
  }

  // A compact hip-roof crown rises exactly to the requested overall silhouette.
  // It is assembled from low-count modules rather than an oversized pavilion.
  const crownBase = tiers * tierHeight;
  const crownHeight = JUNGLE_SEQUEL_TEMPLE_HEIGHTS[variant - 1] - crownBase;
  const crownWidth = variant === 1 ? 22 : 26;
  const crownZ = -23 - (tiers - 1) * .55;
  const roofBase = crownBase + crownHeight - 3.3;
  for (const side of [-1, 1]) {
    add("stonebase", [summit + side * crownWidth * .32, crownBase, crownZ + 5.2],
      [3.2, .65, 3.2], "Summit pavilion base", edge);
    add("stoneshaft", [summit + side * crownWidth * .32, crownBase + .65, crownZ + 5.2],
      [2.2, Math.max(1, roofBase - crownBase - 1.35), 2.2], "Summit pavilion column", stone);
    add("stonecapital", [summit + side * crownWidth * .32, roofBase - .7, crownZ + 5.2],
      [3.5, .7, 3.5], "Summit pavilion capital", edge);
  }
  add("stonecornice", [summit, roofBase, crownZ], [crownWidth, .6, 13], "Summit pavilion lintel", edge);
  for (let row = 0; row < 3; row++) {
    const width = crownWidth - row * 5.5;
    add("stoneroof", [summit, roofBase + .6 + row * .72, crownZ + 3.2 - row * .6],
      [width, .9, 6.4 - row * 1.2], "Summit stepped jade roof", jade);
    add("stoneroof", [summit, roofBase + .6 + row * .72, crownZ - 3.2 + row * .6],
      [width, .9, 6.4 - row * 1.2], "Summit stepped jade roof", jade, 180);
  }
  add("stoneridge", [summit, JUNGLE_SEQUEL_TEMPLE_HEIGHTS[variant - 1] - .5, crownZ],
    [crownWidth - 12, .5, 1.8], "Sanctuary summit ridge", edge);

  // The elevated skate route belongs to the same aqueduct: piers end just below
  // its surface, while a rear edge ribbon follows its individual ascents.
  for (let x = 25, index = 0; x < end - 12; x += 34, index++) {
    const top = profileHeight(profile, x);
    if (top < 3) continue;
    const base = Math.max(-4, top - (variant === 1 ? 25 : 37));
    add("stonebase", [x, base, -9.5], [4.2, 1, 4], "Aqueduct support foot", edge);
    add("stoneshaft", [x, base + 1, -9.5], [2.6, Math.max(.5, top - base - 2.3), 2.8], "Aqueduct support pier", stone);
    add("stonecapital", [x, top - 1.3, -9.5], [5.8, 1, 4], "Aqueduct support capital", edge);
    if (index % 2 === 0) add("junglevine", [x - 1.5, top - 5, -7.8], [5.8, 4, .6], "Aqueduct trailing vine", "#79945d");
  }
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 4 || Math.max(a[1], b[1]) < 2) continue;
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    add("stonelintel", [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1.4, -8.4],
      [length + .15, .7, 1.9], "Aqueduct rear jade coping", jade, 0, angle);
  }

  // Layered vegetation stays behind the structures. There are deliberately no
  // foreground trunks or canopy cards between the camera and the skate line.
  for (let x = -25, i = 0; x < end + 35; x += 29, i++) {
    const r = rnd(i + 3);
    const y = Math.max(-5, profileHeight(profile, x) - 8);
    add(i % 3 === 0 ? "junglefern" : "jungleleaf", [x, y, -13 - r * 2],
      [7.5 + r * 2, 4 + r * 2, 7], "Jungle bank planting", i % 2 ? "#679474" : "#8fac7b", r * 360);
    if (i % 2 === 0) {
      add("junglecanopy", [x + 7, y - 5, -40 - r * 7],
        [24, 24 + r * 10, 21], "Rear jungle canopy", "#668f80", r * 360);
    } else {
      add("junglepalmtree", [x - 4, y - 2, -25 - r * 5],
        [12, 19 + r * 6, 11], "Rear temple palm", "#a5bc8a", r * 180);
    }
    if (i % 3 === 0) add("junglebackdrop", [x + 11, y - 15, -70],
      [52, 43 + r * 8, 38], "Distant jungle silhouette", "#6a9181", r * 360);
  }

  // Entry/exit gateways repeat the central temple's relief and jade cornice,
  // giving the long profile clear architectural punctuation at human scale.
  for (const x of [18, end - 23]) {
    const y = profileHeight(profile, x);
    for (const side of [-1, 1]) {
      add("stonebase", [x + side * 5, y - 1, -11], [3, .9, 3], "Rear gateway base", edge);
      add("stoneshaft", [x + side * 5, y - .1, -11], [2, 6.5, 2], "Rear gateway column", stone);
      add("stonecapital", [x + side * 5, y + 6.4, -11], [3.1, 1, 3.1], "Rear gateway capital", edge);
    }
    add("stonelintel", [x, y + 7.4, -11], [13.8, 1.1, 3], "Rear gateway jade lintel", jade);
    add("stonefrieze", [x, y + 7.5, -9.35], [3.1, 1.4, .45], "Rear gateway crest", edge);
    add("junglevine", [x, y + 5.6, -9.3], [10, 2.6, .65], "Rear gateway hanging vine", "#7c985e");
  }
  return out;
}
