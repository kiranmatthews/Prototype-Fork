// Polygons deleted from an authored model, picked BY EYE.
//
// This file is data, not logic, and it is written by hand from what the model
// studio (src/studio.ts) exports. That is the point of it.
//
// The problem it replaces: an authored model arrives with geometry we do not
// want — this one has a tail brush we have replaced with a simulated tail —
// and there is no reliable way to describe "those polygons" as a rule. Four
// were tried. "Behind the hips and below mid-height" missed most of the brush.
// "Behind z -0.17 below the shoulders" reached up and bit a piece out of her
// ponytail. "Anything the bone vote called pelvis that hangs below the knee"
// caught one chunk and not the other. Every one of them was a guess at a shape
// from a screenshot, and every one either under-cut or hit something it should
// not have, because a rule cannot know what a polygon IS.
//
// A person looking at the model knows instantly. So the studio lets them click
// the polygons, and the answer lands here as a list. It cannot over-reach: it
// deletes exactly what was pointed at, and nothing else.
//
// THE NUMBERS are vertex-slot indices into the model's DE-INDEXED geometry —
// the same `t` the carve loop iterates, where slot t belongs to triangle t/3.
// De-indexing is deterministic, so they are stable for a given file. They are
// keyed by model path, and guarded by the vertex count that was on screen when
// they were picked: if the model is re-exported the count changes, the cuts
// stop applying, and you get the whole model back rather than a silent mess.

export interface ModelCut {
  /** vertex count of the de-indexed source when these were picked */
  vertexCount: number;
  /** vertex-slot index of each deleted triangle (slot t => triangle t/3) */
  tris: number[];
  /** ...and triangles RESCUED from the geometric cut, because it over-reached.
   *  This is the half that was missing when a rule quietly took a bite out of
   *  her ponytail: a cut you can only add to is a cut nobody can correct. */
  keep?: number[];
}

export const MODEL_CUTS: Record<string, ModelCut> = {
  // Picked in the studio, 2026-08-03: the leftover tail brush on the fox, the
  // blades of it the geometric cut never reached. 56 triangles of 2130.
  //
  // vertexCount is the file's DE-INDEXED vertex count (fox.glb is indexed with
  // 6390 indices, so 6390 slots / 2130 triangles), read from the GLB rather
  // than taken from the export's highestSlot — that field is a lower bound,
  // because slots belonging to already-discarded geometry are in no chunk for
  // the studio to see.
  'models/fox.glb': {
    vertexCount: 6390,
    tris: [
      213, 216, 219, 222, 225, 561, 567, 573, 576, 1311, 1314, 1317, 1320,
      1323, 2343, 2346, 2349, 2352, 2355, 2358, 2457, 2460, 2463, 2466, 2937,
      2940, 2943, 2946, 3270, 3273, 3276, 3279, 3372, 3378, 3387, 3390, 3393,
      3396, 4278, 4473, 4476, 4479, 4482, 4755, 4815, 4818, 5022, 5025, 5028,
      5031, 5241, 5313, 5316, 5409, 5502, 5553,
    ],
  },
};

export interface Verdict {
  /** delete these, whatever the geometric rule thinks */
  cut: Set<number>;
  /** keep these, whatever the geometric rule thinks */
  keep: Set<number>;
}

/** What a human decided about this model, or null if nothing / the file moved. */
export function cutsFor(src: string, vertexCount: number): Verdict | null {
  const key = Object.keys(MODEL_CUTS).find((k) => src.endsWith(k));
  if (!key) return null;
  const cut = MODEL_CUTS[key];
  if (cut.vertexCount !== vertexCount) {
    console.warn(
      `[modelcuts] ${key} has ${vertexCount} verts, cuts were picked against ` +
        `${cut.vertexCount} — ignoring them rather than deleting the wrong polygons.`,
    );
    return null;
  }
  return { cut: new Set(cut.tris), keep: new Set(cut.keep ?? []) };
}
