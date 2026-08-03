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
}

export const MODEL_CUTS: Record<string, ModelCut> = {
  // filled in from the studio's export
};

/** The cut set for a model, or null if it has none / the file has changed. */
export function cutsFor(src: string, vertexCount: number): Set<number> | null {
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
  return new Set(cut.tris);
}
