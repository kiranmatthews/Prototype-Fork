import type { CustomComponent } from "../level";
import type { JungleAssetKind } from "../jungleAssets";

/** Deliberately sparse, large plants. Two depths and an overhead canopy close the lane. */
export function jungleRuinsDressing(gx: (z: number) => number, gy: (z: number) => number): CustomComponent[] {
  const out: CustomComponent[] = [];
  const rnd = (i: number): number => { const n = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return n - Math.floor(n); };
  const add = (dkind: JungleAssetKind, p: [number, number, number], s: [number, number, number], yaw = 0, color?: string): void => {
    out.push({ t: "decor", dkind, p, s, yaw, color, solid: false });
  };
  let k = 0;
  const stretches: [number, number, number, number][] = [
    [20, -296, 0, 6.7], [-300, -486, 16, 11.5], [-490, -730, 0, 6.7],
  ];
  for (const [near, far, base, inset] of stretches) {
    for (let z = near; z > far; z -= 7.8) {
      for (const side of [-1, 1]) {
        const seed = k++ * 31;
        const jitterZ = z + (rnd(seed + 3) - 0.5) * 2;
        const y = base + gy(jitterZ) + 0.15;
        const x = gx(jitterZ) + side * (inset + rnd(seed) * 0.8);
        const fern = rnd(seed + 1) > 0.58;
        const scale = 0.92 + rnd(seed + 5) * 0.3;
        add(fern ? "junglefern" : "jungleleaf", [x, y, jitterZ],
          fern ? [6.7 * scale, 2.9 * scale, 6 * scale] : [6.6 * scale, 3.8 * scale, 6.2 * scale],
          rnd(seed + 7) * 360, rnd(seed + 11) < 0.3 ? '#bedc9b' : '#ffffff');
        // A larger, darker bank plant fills the space between foreground crowns.
        if (k % 3 !== 0) {
          add("jungleleaf", [gx(z) + side * (inset + 5.8), y - 0.3, z - 3.3],
            [10.2, 6.7, 10], rnd(seed + 17) * 360, '#70a687');
        }
        if (k % 4 < 2) {
          add("junglepalmtree", [gx(z) + side * (inset + 4.1 + rnd(seed + 19) * 2), y, z + 1],
            [13.8, 16 + rnd(seed + 23) * 4, 13.5], rnd(seed + 29) * 360, '#d4e5b3');
        }
        if (k % 6 < 2) {
          add("junglepalmtree", [gx(z) + side * (inset + 18), y - 0.5, z - 2],
            [22, 24 + rnd(seed + 31) * 5, 21], rnd(seed + 37) * 360, '#6e9c88');
          add("jungleleaf", [gx(z) + side * (inset + 18), y - 2, z - 3],
            [22, 18, 20], rnd(seed + 41) * 360, '#4c806f');
        }
      }
    }
  }

  // Strong silhouettes announce each traversal beat; the opening always clears the lane.
  for (const z of [-18, -88, -158, -251, -296, -514, -638, -685]) {
    add("hangingarch", [gx(z), gy(z) - 0.18, z], [21, 14.5, 3.1]);
  }
  add("hangingarch", [0, 11.35, -413], [21, 14, 3.1]);
  // Shrines sit on supported scenery banks, well beyond the traversable corridor.
  for (const [x, y, z, yaw, scale] of [
    [-19, 0, -65, 20, 1], [19, 0, -273, -25, 1.15],
    [-23, 16, -348, 22, 1.3], [23, 16, -438, -20, 1.2],
    [-20, 0, -604, 25, 1.05], [0, -1.5, -721, 0, 1.65],
  ]) {
    add("roofedtemple", [gx(z) + x, y + gy(z) - 0.3, z], [14 * scale, 15 * scale, 12 * scale], yaw);
  }

  // Roofline planting and occasional ruined pedestals give the temple a human scale.
  for (let z = -304; z >= -482; z -= 17) {
    const top = z > -386 ? 0 : z > -444 ? 11.5 : 11.5 - ((-444 - z) / 42) * 11.1;
    for (const side of [-1, 1]) {
      add("junglefern", [side * 7.3, top - 0.05, z], [3.8, 1.65, 3.4], side * 65);
      if (z > -325 || z < -390) add("templeplatform", [side * 7.6, top - 0.1, z - 6], [2.8, 1.3, 2.8], side * 8);
    }
  }
  return out;
}
