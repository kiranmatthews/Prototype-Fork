// The Roo face, in one place.
//
// Two very different consumers need it and both need to know WHEN it has
// arrived: the HUD (src/rootext.ts, which measures real glyph boxes) and the
// crate textures (src/level.ts, which paints letters into a canvas at level
// build time and would otherwise bake a fallback font into the atlas).
//
// The @font-face itself is declared in roo-text.css and imported here, so
// whichever module happens to evaluate first still registers the face before
// anything asks the FontFaceSet for it.
import "./roo-text.css";

/** Everything the HUD and the crate faces can ask to draw. */
const GLYPHS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
  " !?.,:;/-+×°'\"()%&";

/** Resolves once Roo is actually usable for measuring and for canvas fills. */
export const rooReady: Promise<void> = (async () => {
  try {
    if (!document.fonts) return;
    await document.fonts.load('400 64px "Roo"', GLYPHS);
    await document.fonts.ready;
  } catch {
    // No font is not fatal: the HUD falls back to plain text and the crate
    // faces to the canvas default. Better a readable game than a dead one.
  }
})();

/** True once the face is loaded — for code that cannot await. */
export let rooLoaded = false;
void rooReady.then(() => {
  rooLoaded = true;
});
